// ═══════════════════════════════════════════════════════════
// F3. Delay Root-Cause Attribution
//
// CpmSnapshot 2개 사이 기간의 Task 지연을 원인별로 분해.
//
// 입력 소스:
//   - CpmSnapshot.tasksSnapshot diff → 공종별 ES/duration 지연
//   - DailyReport.weather (비작업일 'rain'/'snow') → 기상 지연
//   - ProductivityObservation.zScore (flagged) → 생산성 지연
//   - 향후 TaskConstraint 도입 시 → 제약 지연
//
// 이 파일은 순수 계산 엔진. generateWBS / calculateCPM 은 호출하지 않음.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { diffSnapshots } from './cpm-snapshot'

export type DelayCause =
  | 'weather' | 'manpower' | 'material' | 'design-change'
  | 'constraint' | 'productivity' | 'unknown'

export interface AttributionResult {
  projectId: string
  periodFrom: string
  periodTo: string
  totalDelayDays: number
  byCause: Record<DelayCause, number>
  byTask: {
    taskId: string
    taskName: string
    delayDays: number
    causes: { cause: DelayCause; days: number }[]
  }[]
  persisted: number  // DelayAttribution 로 저장된 레코드 수
}

export async function computeDelayAttribution(opts: {
  projectId: string
  fromSnapshotId: string
  toSnapshotId: string
  persist?: boolean
}): Promise<AttributionResult | null> {
  const diff = await diffSnapshots(opts.fromSnapshotId, opts.toSnapshotId)
  if (!diff) return null

  const periodFrom = diff.from.capturedAt.toISOString().slice(0, 10)
  const periodTo   = diff.to.capturedAt.toISOString().slice(0, 10)

  // 기간 내 기상 비작업일 수집 (DailyReport.weather 기준)
  const reports = await prisma.dailyReport.findMany({
    where: {
      projectId: opts.projectId,
      date: { gte: periodFrom, lte: periodTo },
    },
    select: { id: true, date: true, weather: true },
  })
  const weatherNonWorkDays = reports.filter(r => {
    const w = (r.weather ?? '').toLowerCase()
    return w.includes('비') || w.includes('눈') || w.includes('rain') || w.includes('snow') ||
           w.includes('폭풍') || w.includes('태풍')
  }).length

  // 기간 내 flagged 관측값 (생산성 이슈)
  const flaggedObs = await prisma.productivityObservation.findMany({
    where: {
      projectId: opts.projectId,
      date: { gte: periodFrom, lte: periodTo },
      status: { in: ['flagged', 'proposed'] },
    },
    select: { id: true, trade: true, zScore: true, date: true },
  })

  // Task별 지연 = deltaDuration + deltaES 양의 값 (늦어진 것만)
  const byTask: AttributionResult['byTask'] = []
  const byCause: Record<DelayCause, number> = {
    weather: 0, manpower: 0, material: 0, 'design-change': 0,
    constraint: 0, productivity: 0, unknown: 0,
  }

  for (const shifted of diff.shiftedTasks) {
    const delay = Math.max(0, shifted.deltaDuration) + Math.max(0, shifted.deltaES)
    if (delay < 0.1) continue

    // 원인 귀속 (단순 규칙 기반)
    const causes: { cause: DelayCause; days: number }[] = []
    let remaining = delay

    // 1) 생산성: 이 Task의 trade와 매칭되는 flagged 관측이 있으면 그 비중
    const obsHits = flaggedObs.filter(o =>
      shifted.name.includes(o.trade) || o.trade.includes(shifted.name)
    )
    if (obsHits.length > 0) {
      const productivityShare = Math.min(remaining, remaining * 0.5)
      if (productivityShare > 0.1) {
        causes.push({ cause: 'productivity', days: Math.round(productivityShare * 10) / 10 })
        remaining -= productivityShare
      }
    }

    // 2) 기상: 공종 이름이 외부/골조/지붕/외장 계열이면 기상 영향 크게
    const weatherSensitive = /(토공|골조|외벽|지붕|외장|방수|조경|포장)/.test(shifted.name)
    if (weatherSensitive && weatherNonWorkDays > 0) {
      const weatherShare = Math.min(remaining, weatherNonWorkDays * 0.5) // 비작업일 1일 = 0.5일 기여
      if (weatherShare > 0.1) {
        causes.push({ cause: 'weather', days: Math.round(weatherShare * 10) / 10 })
        remaining -= weatherShare
      }
    }

    // 3) 나머지는 unknown
    if (remaining > 0.1) {
      causes.push({ cause: 'unknown', days: Math.round(remaining * 10) / 10 })
    }

    // 합계 업데이트
    for (const c of causes) byCause[c.cause] += c.days

    byTask.push({
      taskId: shifted.taskId,
      taskName: shifted.name,
      delayDays: Math.round(delay * 10) / 10,
      causes,
    })
  }

  // 지연 큰 순
  byTask.sort((a, b) => b.delayDays - a.delayDays)

  const totalDelayDays = Object.values(byCause).reduce((s, v) => s + v, 0)
  let persisted = 0

  if (opts.persist && byTask.length > 0) {
    // 기존 같은 기간 기록 삭제 후 재작성 (idempotent)
    await prisma.delayAttribution.deleteMany({
      where: { projectId: opts.projectId, periodFrom, periodTo },
    })
    for (const t of byTask) {
      for (const c of t.causes) {
        await prisma.delayAttribution.create({
          data: {
            projectId: opts.projectId,
            taskId: t.taskId,
            taskName: t.taskName,
            periodFrom, periodTo,
            cause: c.cause,
            days: c.days,
            evidence: {
              snapshotFrom: diff.from.id,
              snapshotTo: diff.to.id,
              observationIds: flaggedObs.map(o => o.id),
              weatherNonWorkDays,
            },
          },
        })
        persisted++
      }
    }
  }

  return {
    projectId: opts.projectId,
    periodFrom, periodTo,
    totalDelayDays: Math.round(totalDelayDays * 10) / 10,
    byCause,
    byTask,
    persisted,
  }
}

/** DB에 저장된 귀속 조회 (cause 또는 task 단위 집계). */
export async function loadAttributions(opts: {
  projectId: string
  groupBy?: 'cause' | 'task'
}): Promise<{ cause?: Record<string, number>; tasks?: { taskId: string; taskName: string; total: number; causes: { cause: string; days: number }[] }[] }> {
  const rows = await prisma.delayAttribution.findMany({
    where: { projectId: opts.projectId },
    orderBy: { computedAt: 'desc' },
  })

  if (opts.groupBy === 'cause') {
    const map: Record<string, number> = {}
    for (const r of rows) map[r.cause] = (map[r.cause] ?? 0) + r.days
    return { cause: map }
  }
  // by task
  const tmap = new Map<string, { taskId: string; taskName: string; total: number; causes: Map<string, number> }>()
  for (const r of rows) {
    if (!r.taskId) continue
    const cur = tmap.get(r.taskId) ?? {
      taskId: r.taskId, taskName: r.taskName ?? r.taskId,
      total: 0, causes: new Map<string, number>(),
    }
    cur.total += r.days
    cur.causes.set(r.cause, (cur.causes.get(r.cause) ?? 0) + r.days)
    tmap.set(r.taskId, cur)
  }
  const tasks = Array.from(tmap.values())
    .map(t => ({
      taskId: t.taskId, taskName: t.taskName, total: Math.round(t.total * 10) / 10,
      causes: Array.from(t.causes.entries()).map(([cause, days]) => ({ cause, days: Math.round(days * 10) / 10 })),
    }))
    .sort((a, b) => b.total - a.total)
  return { tasks }
}
