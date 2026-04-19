// ═══════════════════════════════════════════════════════════
// CP_DB 공종별 프로젝트 실적 분석 API
// - 선택 프로젝트의 일보 manpower를 CP_DB 공종에 매핑해 실제 vs 기준 비교
// - 물량: computeQuantities(프로젝트 규모) 기반 계획값
// - 실제: 해당 공종에 매핑된 trade들의 활동일·인일 합
// - 편차: 실제 기간(활동일) vs 계획 기간(calcDuration) 비교 %
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CP_DB, computeQuantities, calcDuration } from '@/lib/engine/wbs'
import { WBS_TRADE_MAP } from '@/lib/engine/wbs-trade-map'
import { normalizeTrade } from '@/lib/normalizers/aliases'
import type { ProjectInput } from '@/lib/types'

interface ManpowerEntry { trade: string; today: number }

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const reports = await prisma.dailyReport.findMany({
    where: { projectId },
    select: { date: true, manpower: true },
    orderBy: { date: 'asc' },
  })

  // 1) 프로젝트 규모 → 계획 물량
  const input: ProjectInput = {
    name: project.name,
    type: project.type ?? '공동주택',
    ground: project.ground ?? 0,
    basement: project.basement ?? 0,
    lowrise: project.lowrise ?? 0,
    hasTransfer: project.hasTransfer,
    bldgArea:     project.bldgArea     ?? undefined,
    buildingArea: project.buildingArea ?? undefined,
    siteArea:     project.siteArea     ?? undefined,
    sitePerim:    project.sitePerim    ?? undefined,
    bldgPerim:    project.bldgPerim    ?? undefined,
    wtBottom:     project.wtBottom     ?? undefined,
    waBottom:     project.waBottom     ?? undefined,
    mode: 'cp',
  }
  const qtys = computeQuantities(input)

  // 2) trade(normalized) → { manDays, dates(Set) } 집계
  const tradeAgg = new Map<string, { manDays: number; dates: Set<string> }>()
  for (const r of reports) {
    const list = (r.manpower as ManpowerEntry[] | null) ?? []
    for (const m of list) {
      if (!m || !m.today || m.today <= 0) continue
      const t = normalizeTrade(m.trade)
      if (!t) continue
      const agg = tradeAgg.get(t) ?? { manDays: 0, dates: new Set<string>() }
      agg.manDays += Number(m.today)
      agg.dates.add(r.date)
      tradeAgg.set(t, agg)
    }
  }

  // 3) CP_DB 각 공종마다 매핑 trade 집계
  const rows = CP_DB.map(row => {
    const trades = WBS_TRADE_MAP[row.name] ?? []
    let observedManDays = 0
    const observedDates = new Set<string>()
    for (const t of trades) {
      const agg = tradeAgg.get(t)
      if (!agg) continue
      observedManDays += agg.manDays
      agg.dates.forEach(d => observedDates.add(d))
    }
    const observedActiveDays = observedDates.size
    const plannedQty = qtys[row.name] ?? 0
    const applicable = plannedQty > 0 || ['전체', '개소', '대', '주'].includes(row.unit)
    const effectiveQty = plannedQty > 0 ? plannedQty : (applicable ? 1 : 0)
    const plannedDays = effectiveQty > 0 ? calcDuration(row, effectiveQty) : 0

    // 실제 생산성 역산 (관측값 기준)
    //  - 생산성(prod) 유형: 단위/일 = 물량 / 활동일
    //  - 표준일수(stdDays) 유형: 일/단위 = 활동일 / 물량
    let actualProd: number | null = null
    let actualStdDays: number | null = null
    if (effectiveQty > 0 && observedActiveDays > 0) {
      if (row.prod !== null) {
        actualProd = Math.round((effectiveQty / observedActiveDays) * 10) / 10
      } else if (row.stdDays !== null) {
        actualStdDays = Math.round((observedActiveDays / effectiveQty) * 10) / 10
      }
    }

    // 편차: 계획 기간 vs 실제 활동일 (plannedDays가 가동률 포함이므로 그대로 비교)
    const deviationDays = observedActiveDays > 0 && plannedDays > 0
      ? Math.round((observedActiveDays - plannedDays) * 10) / 10
      : null
    const deviationPct = observedActiveDays > 0 && plannedDays > 0
      ? Math.round(((observedActiveDays - plannedDays) / plannedDays) * 1000) / 10
      : null

    return {
      wbsCode: row.wbsCode ?? null,
      category: row.category,
      sub: row.sub,
      name: row.name,
      unit: row.unit,
      cpdbProd: row.prod,
      cpdbStdDays: row.stdDays,
      mappedTrades: trades,
      plannedQty: effectiveQty,
      plannedDays: Math.round(plannedDays * 10) / 10,
      observedManDays: Math.round(observedManDays * 10) / 10,
      observedActiveDays,
      actualProd,
      actualStdDays,
      deviationDays,
      deviationPct,
      hasMapping: trades.length > 0,
      hasObservation: observedManDays > 0,
      applicable,
    }
  })

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      type: project.type,
      ground: project.ground,
      basement: project.basement,
      startDate: project.startDate,
    },
    totalReports: reports.length,
    firstDate: reports[0]?.date ?? null,
    lastDate: reports.at(-1)?.date ?? null,
    rows,
  })
}
