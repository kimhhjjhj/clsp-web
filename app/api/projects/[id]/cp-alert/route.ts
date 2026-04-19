// CP(Critical Path) 공종 조기 경보 API
//
// 계산 방식 (간이):
// 1) 저장된 Task 중 isCritical 근사 — 현재 schema에 isCritical 필드가 없어 CPM 재계산으로 확인
// 2) 프로젝트 startDate 기준 "지금쯤 몇 일차인가" 계산
// 3) 각 CP 공종의 계획 ES/EF와 비교해 "이미 끝났어야 할/진행 중이어야 할" 공종 선별
// 4) 해당 공종의 normalizedTrade로 일보 투입 있는지 확인 → 투입 없으면 지연 가능성
// 5) 간단 규칙: 계획 종료일 지났는데 투입 없음 → high · 시작일 지났는데 투입 없음 → medium

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWBS } from '@/lib/engine/wbs'
import { calculateCPM } from '@/lib/engine/cpm'
import { WBS_TRADE_MAP } from '@/lib/engine/wbs-trade-map'
import { normalizeTrade } from '@/lib/normalizers/aliases'
import { getProjectStatus } from '@/lib/project-status'
import type { ProjectInput } from '@/lib/types'

interface ManpowerEntry { trade: string; today: number }

type Severity = 'high' | 'medium' | 'low'
interface Alert {
  taskName: string
  taskCategory: string
  plannedStart: string | null
  plannedFinish: string | null
  daysPastStart: number
  daysPastFinish: number
  severity: Severity
  message: string
  relatedTrades: string[]
  observedManDays: number
}

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!project.startDate) {
    return NextResponse.json({ alerts: [], summary: { hasStartDate: false } })
  }

  // 준공/보관 프로젝트는 CP 경보 무의미 — 모든 CP 공종이 과거 날짜라 전부 경보로 잡힘
  const [dailyReportCount, latestReport] = await Promise.all([
    prisma.dailyReport.count({ where: { projectId: id } }),
    prisma.dailyReport.findFirst({
      where: { projectId: id },
      orderBy: { date: 'desc' },
      select: { date: true },
    }),
  ])
  const projectStatus = getProjectStatus({
    latestReportDate: latestReport?.date ?? null,
    _count: { dailyReports: dailyReportCount },
  })
  if (projectStatus === 'completed' || projectStatus === 'archived') {
    return NextResponse.json({
      alerts: [],
      summary: {
        hasStartDate: true,
        projectStart: project.startDate,
        projectStatus,
      },
    })
  }

  // WBS + CPM 재계산
  const input: ProjectInput = {
    name: project.name,
    ground: project.ground ?? 0,
    basement: project.basement ?? 0,
    lowrise: project.lowrise ?? 0,
    hasTransfer: project.hasTransfer,
    sitePerim: project.sitePerim ?? undefined,
    bldgPerim: project.bldgPerim ?? undefined,
    siteArea: project.siteArea ?? undefined,
    bldgArea: project.bldgArea ?? undefined,
    buildingArea: project.buildingArea ?? undefined,
    wtBottom: project.wtBottom ?? undefined,
    waBottom: project.waBottom ?? undefined,
    mode: 'cp',
  }
  const wbsTasks = generateWBS(input)
  const cpmResult = calculateCPM(wbsTasks)
  const cpTasks = cpmResult.tasks.filter(t => t.isCritical)

  // 일보에서 공종별 투입 일수·인일 집계
  const reports = await prisma.dailyReport.findMany({
    where: { projectId: id },
    select: { date: true, manpower: true },
  })
  const tradeManDays = new Map<string, number>()
  for (const r of reports) {
    const mp = (r.manpower as ManpowerEntry[] | null) ?? []
    for (const m of mp) {
      if (!m.today || m.today <= 0) continue
      const t = normalizeTrade(m.trade)
      if (t) tradeManDays.set(t, (tradeManDays.get(t) ?? 0) + m.today)
    }
  }

  const startDate = new Date(project.startDate)
  const today = new Date()
  const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / 86400000)

  function offsetToDate(days: number): string {
    const d = new Date(startDate)
    d.setDate(d.getDate() + Math.round(days))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const alerts: Alert[] = []
  for (const t of cpTasks) {
    const plannedStart = offsetToDate(t.ES)
    const plannedFinish = offsetToDate(t.EF)
    const daysPastStart = Math.max(0, daysSinceStart - t.ES)
    const daysPastFinish = Math.max(0, daysSinceStart - t.EF)

    // 관련 trade 조회
    const relatedTrades = WBS_TRADE_MAP[t.name] ?? []
    const observed = relatedTrades.reduce((sum, tr) => sum + (tradeManDays.get(tr) ?? 0), 0)

    // 경보 규칙
    let severity: Severity | null = null
    let message = ''

    if (daysPastFinish > 0 && observed === 0) {
      severity = 'high'
      message = `계획 종료일(${plannedFinish}) 지났으나 투입 이력 없음 — ${daysPastFinish}일 초과`
    } else if (daysPastFinish > 0 && observed > 0) {
      severity = 'medium'
      message = `계획 종료일(${plannedFinish}) 지났으나 진행 중 (${observed} 인일 투입) — ${daysPastFinish}일 초과`
    } else if (daysPastStart > 7 && observed === 0) {
      severity = 'medium'
      message = `계획 시작일(${plannedStart}) 지났으나 투입 이력 없음 — ${daysPastStart}일 지연`
    } else if (daysPastStart > 0 && observed === 0 && daysPastStart >= 3) {
      severity = 'low'
      message = `계획 시작일(${plannedStart}) 지났으나 투입 이력 없음 — ${daysPastStart}일`
    }

    if (severity) {
      alerts.push({
        taskName: t.name,
        taskCategory: t.category,
        plannedStart,
        plannedFinish,
        daysPastStart,
        daysPastFinish,
        severity,
        message,
        relatedTrades,
        observedManDays: Math.round(observed * 10) / 10,
      })
    }
  }

  // severity 순 정렬
  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
  alerts.sort((a, b) => order[a.severity] - order[b.severity])

  return NextResponse.json({
    alerts,
    summary: {
      hasStartDate: true,
      projectStart: project.startDate,
      daysSinceStart,
      cpTaskCount: cpTasks.length,
      alertCount: alerts.length,
      highSeverityCount: alerts.filter(a => a.severity === 'high').length,
    },
  })
}
