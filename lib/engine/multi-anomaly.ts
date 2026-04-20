// ═══════════════════════════════════════════════════════════
// G8. Multi-signal Anomaly Detection
//
// 다섯 가지 시그널을 통합해 Task별 위험 스코어 (0~100) 계산:
//   1. 생산성 z-score (F4 ProductivityObservation |z| ≥ 1.5)
//   2. CPM ES 지연 (F1 CpmSnapshot 두 스냅샷 간 deltaES > 0)
//   3. 일보 미제출 (최근 7일 기준)
//   4. 크리티컬 경로 신규 진입
//   5. Duration 증가
//
// 엔진 본체는 기존 abnormal-detection.ts와 분리. 이 파일은 조회만.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

export interface Signal {
  source: string
  value: number       // 0~1 정규화
  weight: number      // 상수
  contribution: number // value × weight
  detail?: string
}

export interface TaskAnomaly {
  taskId: string
  taskName: string
  score: number
  severity: 'low' | 'med' | 'high'
  signals: Signal[]
}

const WEIGHTS = {
  productivityZ:  25,
  cpmDelayES:     30,
  reportMissing:  15,
  criticalEntry:  20,
  durationDelta:  10,
} as const

interface SnapTask {
  taskId: string
  name: string
  category: string
  ES: number
  EF: number
  duration: number
  isCritical: boolean
}

export async function detectTaskAnomalies(projectId: string): Promise<TaskAnomaly[]> {
  // 1) 최근 2개 스냅샷
  const snaps = await prisma.cpmSnapshot.findMany({
    where: { projectId },
    orderBy: { capturedAt: 'desc' },
    take: 2,
  })
  if (snaps.length === 0) return []

  const latest = snaps[0]
  const prev   = snaps[1]
  const latestTasks = (latest.tasksSnapshot as unknown as SnapTask[]) ?? []
  const prevMap = new Map<string, SnapTask>(
    prev ? ((prev.tasksSnapshot as unknown as SnapTask[]) ?? []).map(t => [t.taskId, t]) : [],
  )

  // 2) 최근 30일 flagged 생산성 관측
  const from = new Date(); from.setDate(from.getDate() - 30)
  const fromStr = from.toISOString().slice(0, 10)
  const obs = await prisma.productivityObservation.findMany({
    where: {
      projectId,
      date: { gte: fromStr },
      status: { in: ['flagged', 'proposed'] },
    },
  })
  const obsByTrade = new Map<string, number>()
  for (const o of obs) {
    if (o.zScore == null) continue
    const cur = obsByTrade.get(o.trade) ?? 0
    obsByTrade.set(o.trade, Math.max(cur, Math.abs(o.zScore)))
  }

  // 3) 일보 미제출 (최근 7일 중 비어있는 날)
  const from7 = new Date(); from7.setDate(from7.getDate() - 7)
  const reports = await prisma.dailyReport.findMany({
    where: { projectId, date: { gte: from7.toISOString().slice(0, 10) } },
    select: { date: true },
  })
  const reportDates = new Set(reports.map(r => r.date))
  let missingDays = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    if (!reportDates.has(d.toISOString().slice(0, 10))) missingDays++
  }

  // 4) Task별 점수
  const results: TaskAnomaly[] = []
  for (const t of latestTasks) {
    const prevT = prevMap.get(t.taskId)
    const signals: Signal[] = []

    // (1) 생산성
    let pz = 0
    for (const [trade, z] of obsByTrade) {
      if (t.name.includes(trade) || trade.includes(t.name)) {
        pz = Math.max(pz, z)
      }
    }
    if (pz > 0) {
      const v = Math.min(1, pz / 3)
      signals.push({
        source: 'productivity-z', value: v, weight: WEIGHTS.productivityZ,
        contribution: v * WEIGHTS.productivityZ,
        detail: `생산성 |z|=${pz.toFixed(2)}`,
      })
    }

    // (2) CPM ES 지연
    if (prevT) {
      const dES = t.ES - prevT.ES
      if (dES > 0) {
        const v = Math.min(1, dES / 30)
        signals.push({
          source: 'cpm-delay-es', value: v, weight: WEIGHTS.cpmDelayES,
          contribution: v * WEIGHTS.cpmDelayES,
          detail: `ES +${dES.toFixed(1)}일`,
        })
      }
    }

    // (3) 일보 미제출 — 프로젝트 전체 적용 (공종 무관)
    if (missingDays > 0) {
      const v = Math.min(1, missingDays / 7)
      signals.push({
        source: 'report-missing', value: v, weight: WEIGHTS.reportMissing,
        contribution: v * WEIGHTS.reportMissing,
        detail: `최근 7일 중 ${missingDays}일 일보 미제출`,
      })
    }

    // (4) CP 신규 진입
    if (prevT && !prevT.isCritical && t.isCritical) {
      signals.push({
        source: 'critical-entry', value: 1, weight: WEIGHTS.criticalEntry,
        contribution: WEIGHTS.criticalEntry,
        detail: 'CP에 새로 진입',
      })
    }

    // (5) Duration 증가
    if (prevT) {
      const dDur = t.duration - prevT.duration
      if (dDur > 0) {
        const v = Math.min(1, dDur / 10)
        signals.push({
          source: 'duration-delta', value: v, weight: WEIGHTS.durationDelta,
          contribution: v * WEIGHTS.durationDelta,
          detail: `기간 +${dDur.toFixed(1)}일`,
        })
      }
    }

    const score = Math.round(signals.reduce((s, x) => s + x.contribution, 0))
    if (score <= 0) continue
    const severity: 'low' | 'med' | 'high' =
      score >= 60 ? 'high' : score >= 30 ? 'med' : 'low'

    results.push({ taskId: t.taskId, taskName: t.name, score, severity, signals })
  }

  results.sort((a, b) => b.score - a.score)
  return results
}

/** 감지 결과 DB 저장. 이전 미해결 기록 중 임계 이하로 내려간 건은 resolved 처리. */
export async function persistAnomalies(projectId: string, results: TaskAnomaly[]) {
  const existing = await prisma.anomalySignal.findMany({
    where: { projectId, kind: 'task', resolvedAt: null },
  })
  const currentIds = new Set(results.map(r => r.taskId))

  // 해소된 것 마킹
  for (const e of existing) {
    if (!currentIds.has(e.subjectId)) {
      await prisma.anomalySignal.update({
        where: { id: e.id },
        data: { resolvedAt: new Date(), note: '자동 해소 (감지 임계 이하)' },
      })
    }
  }

  // 신규/업데이트
  for (const r of results) {
    const already = existing.find(e => e.subjectId === r.taskId)
    if (already) {
      await prisma.anomalySignal.update({
        where: { id: already.id },
        data: {
          score: r.score,
          severity: r.severity,
          signals: r.signals as object,
          detectedAt: new Date(),
        },
      })
    } else {
      await prisma.anomalySignal.create({
        data: {
          projectId,
          kind: 'task',
          subjectId: r.taskId,
          subjectName: r.taskName,
          score: r.score,
          severity: r.severity,
          signals: r.signals as object,
        },
      })
    }
  }
}
