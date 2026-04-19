import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params

  const [
    project,
    taskCount,
    riskAgg,
    opportunityCount,
    baselineCount,
    latestWeekly,
    weeklyAvg,
    latestDaily,
    dailyReportCount,
    weeklyDistinct,
  ] = await Promise.all([
    prisma.project.findUnique({ where: { id }, select: { lastCpmDuration: true } }),
    prisma.task.count({ where: { projectId: id } }),
    prisma.riskOpportunity.count({ where: { projectId: id, type: 'risk' } }),
    prisma.riskOpportunity.count({ where: { projectId: id, type: 'opportunity' } }),
    prisma.baselineTask.count({ where: { projectId: id } }),
    prisma.weeklyProgress.findFirst({
      where: { projectId: id },
      orderBy: [{ year: 'desc' }, { weekNo: 'desc' }],
      select: { year: true, weekNo: true },
    }),
    prisma.weeklyProgress.aggregate({
      where: { projectId: id },
      _avg: { actualRate: true, plannedRate: true },
    }),
    prisma.dailyReport.findFirst({
      where: { projectId: id },
      orderBy: { date: 'desc' },
      select: { date: true },
    }),
    prisma.dailyReport.count({ where: { projectId: id } }),
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
      taskCount,
    },
    stage2: {
      riskCount: riskAgg,
      opportunityCount,
      hasBaseline: baselineCount > 0,
      baselineTaskCount: baselineCount,
    },
    stage3: {
      latestRate: weeklyAvg._avg.actualRate ?? null,
      plannedRate: weeklyAvg._avg.plannedRate ?? null,
      lastReportDate: latestDaily?.date ?? null,
      dailyReportCount,
      latestWeek: latestWeekly ? `${latestWeekly.year}년 ${latestWeekly.weekNo}주차` : null,
    },
    stage4: {
      weeklyReportCount: weeklyDistinct.length,
    },
  })
}
