// 입찰·견적 모드 API — 프로젝트를 DB에 저장하지 않고 개략공기·자원·원가 즉시 추정
// 기존 /api/projects/calculate 는 DB Task를 생성하지만, 이건 ephemeral 계산만.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWBS } from '@/lib/engine/wbs'
import { calculateCPM } from '@/lib/engine/cpm'
import { buildResourcePlan, type StandardLookup } from '@/lib/engine/resource-plan'
import type { ProjectInput } from '@/lib/types'

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<ProjectInput> & {
    monthlyFinCost?: number      // 월 금융·관리비 (만원)
    delayScenarios?: number[]    // 몇 주 지연 시나리오 (기본 [2, 4, 8])
  }

  const input: ProjectInput = {
    name: body.name ?? '임시 견적',
    ground: body.ground ?? 0,
    basement: body.basement ?? 0,
    lowrise: body.lowrise ?? 0,
    hasTransfer: body.hasTransfer ?? false,
    sitePerim: body.sitePerim,
    bldgPerim: body.bldgPerim,
    siteArea: body.siteArea,
    bldgArea: body.bldgArea,
    buildingArea: body.buildingArea,
    wtBottom: body.wtBottom,
    waBottom: body.waBottom,
    mode: body.mode ?? 'cp',
  }

  // WBS + CPM
  const wbsTasks = generateWBS(input)
  const cpmSummary = calculateCPM(wbsTasks)

  // 회사 표준 (man/day)
  const standards = await prisma.companyStandardProductivity.findMany()
  const proposals = await prisma.productivityProposal.findMany({
    where: { status: { in: ['pending', 'approved'] } },
    select: { trade: true, value: true, unit: true, sampleSize: true, status: true },
  })
  const stdLookup: StandardLookup[] = []
  for (const s of standards) stdLookup.push({ trade: s.trade, unit: s.unit, value: s.value, approved: true, sampleCount: s.sampleCount })
  // pending 제안도 approved 없을 때만 활용
  const approvedKeys = new Set(standards.map(s => `${s.trade}|${s.unit}`))
  const tradeGroups = new Map<string, { sum: number; count: number }>()
  for (const p of proposals) {
    const key = `${p.trade}|${p.unit}`
    if (approvedKeys.has(key)) continue
    const cur = tradeGroups.get(key) ?? { sum: 0, count: 0 }
    cur.sum += p.value; cur.count++
    tradeGroups.set(key, cur)
  }
  for (const [key, v] of tradeGroups) {
    const [trade, unit] = key.split('|')
    stdLookup.push({ trade, unit, value: v.sum / v.count, approved: false, sampleCount: v.count })
  }

  // 자원 계획
  const resourcePlan = buildResourcePlan(cpmSummary.tasks, stdLookup)

  // 개략 원가 추정 (매우 거친 추정 - 노임 기반)
  // 공종별 일평균 인원 × 일단가(평균 27만원/일 가정)
  const DAILY_WAGE = 270000
  const laborCostKRW = resourcePlan.totalManDays * DAILY_WAGE
  // 자재·경비 대략 노무비의 1.4배로 가정 (일반 건축)
  const totalEstimateKRW = laborCostKRW * (1 + 1.4)

  // 지연 시나리오
  const monthlyFinCost = body.monthlyFinCost ?? 0  // 만원
  const delayWeeks = body.delayScenarios ?? [2, 4, 8]
  const delayScenarios = delayWeeks.map(w => ({
    weeks: w,
    additionalCostKRW: Math.round((w / 4) * (monthlyFinCost * 10000)),
  }))

  return NextResponse.json({
    input,
    cpm: {
      totalDuration: cpmSummary.totalDuration,
      criticalPathCount: cpmSummary.tasks.filter(t => t.isCritical).length,
      taskCount: cpmSummary.tasks.length,
      tasks: cpmSummary.tasks,
    },
    resourcePlan: {
      totalDuration: resourcePlan.totalDuration,
      peak: resourcePlan.peak,
      avgDaily: resourcePlan.avgDaily,
      totalManDays: resourcePlan.totalManDays,
      monthlyTotals: resourcePlan.monthlyTotals,
      uncoveredTasks: resourcePlan.uncoveredTasks,
    },
    estimate: {
      laborCostKRW: Math.round(laborCostKRW),
      totalEstimateKRW: Math.round(totalEstimateKRW),
      dailyWage: DAILY_WAGE,
      laborRatio: 0.417, // laborCost / totalEstimate
    },
    delayScenarios,
  })
}
