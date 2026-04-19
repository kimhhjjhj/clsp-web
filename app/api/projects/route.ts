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

interface TaskSeed {
  name: string
  category?: string | null
  subcategory?: string | null
  unit?: string | null
  quantity?: number | null
  productivity?: string | null
  stdDays?: string | null
  duration: number
  wbsCode?: string | null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tasksSeed = Array.isArray(body.tasks) ? (body.tasks as TaskSeed[]) : null
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
        constructionMethod: typeof body.constructionMethod === 'string' ? body.constructionMethod : undefined,
        prdCount: typeof body.prdCount === 'number' ? body.prdCount : undefined,
        lastCpmDuration: typeof body.lastCpmDuration === 'number' ? body.lastCpmDuration : undefined,
        aiCostEstimate: body.aiCostEstimate ?? undefined,
        productivityAdjustments: body.productivityAdjustments ?? undefined,
        // Task 시드: /bid에서 저장 시 CPM 결과 함께 보존
        // → 공종 벤치마크·분석의 표본으로 활용
        ...(tasksSeed && tasksSeed.length > 0 ? {
          tasks: {
            create: tasksSeed
              .filter(t => t && typeof t.name === 'string' && typeof t.duration === 'number' && t.duration > 0)
              .map(t => ({
                name: t.name,
                category: t.category ?? null,
                subcategory: t.subcategory ?? null,
                unit: t.unit ?? null,
                quantity: t.quantity ?? null,
                productivity: t.productivity ?? null,
                stdDays: t.stdDays ?? null,
                duration: t.duration,
                wbsCode: t.wbsCode ?? null,
              })),
          },
        } : {}),
      },
      include: { tasks: true },
    })
    return NextResponse.json(project, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/projects]', err)
    return NextResponse.json({ error: err?.message ?? '저장 실패' }, { status: 500 })
  }
}
