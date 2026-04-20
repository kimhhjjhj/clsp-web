import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    include: { tasks: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()

  // 준공 실적 actualDuration은 startDate·actualCompletionDate에서 항상 재계산 (단일 진실 소스)
  //   - client 가 잘못된 값을 보내거나, 착공일만 바꾸고 actualDuration은 옛날 값을 유지하는 케이스 방지
  function computeActualDuration(): number | null {
    const start = body.startDate ?? null
    const end = body.actualCompletionDate ?? null
    if (!start || !end) return null
    const s = new Date(start)
    const e = new Date(end)
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null
    const d = Math.round((e.getTime() - s.getTime()) / 86400000)
    return d > 0 ? d : null
  }
  const recomputedActualDuration = computeActualDuration()

  const project = await prisma.project.update({
    where: { id },
    data: {
      name: body.name,
      client: body.client,
      contractor: body.contractor,
      location: body.location,
      type: body.type,
      startDate: body.startDate,
      ground: body.ground,
      basement: body.basement,
      lowrise: body.lowrise,
      hasTransfer: body.hasTransfer,
      sitePerim: body.sitePerim,
      bldgPerim: body.bldgPerim,
      siteArea: body.siteArea,
      bldgArea: body.bldgArea,
      buildingArea: body.buildingArea,
      wtBottom: body.wtBottom,
      waBottom: body.waBottom,
      constructionMethod: body.constructionMethod,
      prdCount: body.prdCount,
      // JSON 필드는 null 받으면 기존값 유지 (삭제 원하면 별도 DELETE 동작 필요)
      // Prisma JSON에 raw null 넣으면 오류 → null도 undefined로 치환
      industrySpecific: body.industrySpecific ?? undefined,
      productivityAdjustments: body.productivityAdjustments ?? undefined,
      aiCostEstimate: body.aiCostEstimate ?? undefined,
      aiScheduleEstimate: body.aiScheduleEstimate ?? undefined,
      lastCpmDuration:
        typeof body.lastCpmDuration === 'number' ? body.lastCpmDuration : undefined,
      // 준공 실적 (F18 자사 회귀식 학습용)
      actualCompletionDate: body.actualCompletionDate ?? undefined,
      actualDuration: recomputedActualDuration,
    },
  })
  return NextResponse.json(project)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  await prisma.project.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
