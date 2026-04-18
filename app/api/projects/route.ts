import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { tasks: true, dailyReports: true } },
      dailyReports: {
        select: { date: true },
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
  })
  // dailyReports → latestReportDate 로 축약
  const shaped = projects.map(({ dailyReports, ...rest }) => ({
    ...rest,
    latestReportDate: dailyReports[0]?.date ?? null,
  }))
  return NextResponse.json(shaped)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const project = await prisma.project.create({
      data: {
        name: body.name,
        client: body.client,
        contractor: body.contractor,
        location: body.location,
        type: body.type,
        startDate: body.startDate,
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
      },
    })
    return NextResponse.json(project, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/projects]', err)
    return NextResponse.json({ error: err?.message ?? '저장 실패' }, { status: 500 })
  }
}
