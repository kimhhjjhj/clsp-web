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
      wtBottom: body.wtBottom,
      waBottom: body.waBottom,
      industrySpecific: body.industrySpecific !== undefined ? body.industrySpecific : undefined,
    },
  })
  return NextResponse.json(project)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  await prisma.project.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
