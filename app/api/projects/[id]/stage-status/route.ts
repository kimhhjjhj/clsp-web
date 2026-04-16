import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params

  const [
    project,
    taskCount,
    riskCount,
    baselineCount,
    latestWeekly,
    latestDaily,
    weeklyDistinct,
  ] = await Promise.all([
    // stage1: Project의 lastCpmDuration
    prisma.project.findUnique({ where: { id }, select: { lastCpmDuration: true } }),
    // stage1: Task 테이블에 해당 projectId 데이터 있는지
    prisma.task.count({ where: { projectId: id } }),
    // stage2: RiskOpportunity count
    prisma.riskOpportunity.count({ where: { projectId: id } }),
    // stage2: BaselineTask count
    prisma.baselineTask.count({ where: { projectId: id } }),
    // stage3: 최신 WeeklyProgress actualRate (평균)
    prisma.weeklyProgress.aggregate({
      where: { projectId: id },
      _avg: { actualRate: true },
      _max: { year: true, weekNo: true },
    }),
    // stage3: DailyReport 최신 date
    prisma.dailyReport.findFirst({
      where: { projectId: id },
      orderBy: { date: 'desc' },
      select: { date: true },
    }),
    // stage4: WeeklyProgress distinct (year,weekNo) count
    prisma.weeklyProgress.findMany({
      where: { projectId: id },
      select: { year: true, weekNo: true },
      distinct: ['year', 'weekNo'],
    }),
  ])

  return NextResponse.json({
    stage1: {
      hasCpm: taskCount > 0,
      totalDuration: project?.lastCpmDuration ?? null,
    },
    stage2: {
      riskCount,
      hasBaseline: baselineCount > 0,
    },
    stage3: {
      latestRate: latestWeekly._avg.actualRate ?? null,
      lastReportDate: latestDaily?.date ?? null,
    },
    stage4: {
      weeklyReportCount: weeklyDistinct.length,
    },
  })
}
