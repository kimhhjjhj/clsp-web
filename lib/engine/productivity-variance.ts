// ═══════════════════════════════════════════════════════════
// F4. Productivity Variance — 관측값 기록 + z-score + 편차 집계
//
// 기존 abnormal-detection.ts / task-benchmark.ts 와 성격이 다른 층:
//  - 이 파일은 "회사 표준(CompanyStandardProductivity) 대비 실측" 비교
//  - DailyReport 저장 시 자동 집계
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

const Z_FLAG_THRESHOLD = 1.5   // |z| ≥ 1.5 → flagged
const Z_PROPOSE_THRESHOLD = 2.0 // |z| ≥ 2.0 이 30일 내 3회 이상 → proposed
const PROPOSE_MIN_COUNT = 3

export interface ObservationInput {
  projectId: string
  dailyReportId?: string
  trade: string
  date: string   // YYYY-MM-DD
  quantity?: number
  manDays: number  // 실제 투입 인일
  unit?: string  // 기본 'man/day'
}

/** 회사 표준과 비교하여 z-score 계산 (표준 없으면 null). */
async function computeZScore(trade: string, unit: string, observed: number): Promise<number | null> {
  const std = await prisma.companyStandardProductivity.findFirst({
    where: { trade, unit },
  })
  if (!std) return null
  // z-score: (observed - std) / (std * 0.3)  — 표준편차 근사로 std값의 30% 사용
  // (실제 CompanyStandardProductivity는 평균만 저장하므로 근사치로 사용)
  const pseudoStd = std.value * 0.3
  if (pseudoStd <= 0) return null
  return (observed - std.value) / pseudoStd
}

/** 관측값 1건 기록. dailyReport save 훅에서 호출. */
export async function recordObservation(input: ObservationInput): Promise<string | null> {
  try {
    // 생산성 계산: man/day 단위 기준 (1일당 투입 인원)
    // input.manDays가 이미 일일 투입 인원일 수도, 누적 인일 수일 수도 있음
    // quantity가 주어지면 mandays/unit 형태로 계산
    const unit = input.unit ?? 'man/day'
    let observedValue = input.manDays
    if (input.quantity && input.quantity > 0) {
      // mandays/unit = 총 인일 / 수량
      observedValue = input.manDays / input.quantity
    }
    if (!isFinite(observedValue) || observedValue <= 0) return null

    const z = await computeZScore(input.trade, unit, observedValue)
    const status = z !== null && Math.abs(z) >= Z_FLAG_THRESHOLD ? 'flagged' : 'noted'

    const row = await prisma.productivityObservation.create({
      data: {
        projectId: input.projectId,
        dailyReportId: input.dailyReportId,
        trade: input.trade,
        date: input.date,
        observedValue,
        unit,
        quantity: input.quantity,
        manDays: input.manDays,
        zScore: z,
        status,
      },
      select: { id: true },
    })
    return row.id
  } catch (e) {
    console.warn('[productivity-variance] record failed:', (e as Error).message)
    return null
  }
}

export interface VarianceSummary {
  trade: string
  unit: string
  observationCount: number
  avgObserved: number
  companyStandard: number | null
  avgZScore: number
  maxAbsZScore: number
  flaggedCount: number
  lastObservedAt: string
}

/** 프로젝트 × 기간 내 공종별 편차 요약. 회사 표준 있는 공종만 포함. */
export async function summarizeVariance(opts: {
  projectId: string
  days: number // 최근 N일
}): Promise<VarianceSummary[]> {
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - opts.days)
  const fromStr = fromDate.toISOString().slice(0, 10)

  const rows = await prisma.productivityObservation.findMany({
    where: {
      projectId: opts.projectId,
      date: { gte: fromStr },
    },
    orderBy: { date: 'desc' },
  })
  if (rows.length === 0) return []

  // trade × unit 별 집계
  const groups = new Map<string, typeof rows>()
  for (const r of rows) {
    const key = `${r.trade}|${r.unit}`
    const arr = groups.get(key) ?? []
    arr.push(r)
    groups.set(key, arr)
  }

  const stds = await prisma.companyStandardProductivity.findMany()
  const stdMap = new Map(stds.map(s => [`${s.trade}|${s.unit}`, s.value]))

  const out: VarianceSummary[] = []
  for (const [key, items] of groups) {
    const [trade, unit] = key.split('|')
    const zs = items.map(i => i.zScore ?? 0).filter(z => !isNaN(z))
    const avgZ = zs.length > 0 ? zs.reduce((s, z) => s + z, 0) / zs.length : 0
    const maxAbsZ = zs.length > 0 ? Math.max(...zs.map(z => Math.abs(z))) : 0
    out.push({
      trade,
      unit,
      observationCount: items.length,
      avgObserved: items.reduce((s, i) => s + i.observedValue, 0) / items.length,
      companyStandard: stdMap.get(key) ?? null,
      avgZScore: Math.round(avgZ * 100) / 100,
      maxAbsZScore: Math.round(maxAbsZ * 100) / 100,
      flaggedCount: items.filter(i => i.status === 'flagged' || i.status === 'proposed').length,
      lastObservedAt: items[0].date,
    })
  }
  // 편차 큰 순
  return out.sort((a, b) => b.maxAbsZScore - a.maxAbsZScore)
}

/** 편차 지속 공종 → ProductivityProposal 자동 생성. 이미 pending 있으면 스킵. */
export async function autoProposalsFromVariance(opts: {
  projectId: string
  days?: number
}): Promise<{ created: number; skipped: number }> {
  const days = opts.days ?? 30
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - days)
  const fromStr = fromDate.toISOString().slice(0, 10)

  const rows = await prisma.productivityObservation.findMany({
    where: {
      projectId: opts.projectId,
      date: { gte: fromStr },
      zScore: { not: null },
    },
  })
  // trade|unit 별 |z| >= 2.0 건수
  const violation = new Map<string, typeof rows>()
  for (const r of rows) {
    if (r.zScore === null) continue
    if (Math.abs(r.zScore) < Z_PROPOSE_THRESHOLD) continue
    const key = `${r.trade}|${r.unit}`
    const arr = violation.get(key) ?? []
    arr.push(r)
    violation.set(key, arr)
  }

  let created = 0, skipped = 0
  for (const [key, items] of violation) {
    if (items.length < PROPOSE_MIN_COUNT) { skipped++; continue }
    const [trade, unit] = key.split('|')

    // 동일 trade의 pending 제안 있으면 스킵
    const existing = await prisma.productivityProposal.findFirst({
      where: { trade, unit, status: 'pending', projectId: opts.projectId },
    })
    if (existing) { skipped++; continue }

    // 평균값 계산
    const avgValue = items.reduce((s, i) => s + i.observedValue, 0) / items.length
    const totalManDays = items.reduce((s, i) => s + (i.manDays ?? 0), 0)
    const dateRange = { from: items[items.length - 1].date, to: items[0].date }

    await prisma.productivityProposal.create({
      data: {
        projectId: opts.projectId,
        trade,
        value: Math.round(avgValue * 100) / 100,
        unit,
        sampleSize: items.length,
        source: {
          auto: true,
          reason: 'variance_auto',
          totalManDays,
          activeDays: items.length,
          dateRange,
          avgAbsZScore: Math.round(items.reduce((s, i) => s + Math.abs(i.zScore ?? 0), 0) / items.length * 100) / 100,
        },
        status: 'pending',
      },
    })
    created++

    // observation 상태 'proposed' 로 업데이트
    await prisma.productivityObservation.updateMany({
      where: { id: { in: items.map(i => i.id) } },
      data: { status: 'proposed' },
    })
  }
  return { created, skipped }
}
