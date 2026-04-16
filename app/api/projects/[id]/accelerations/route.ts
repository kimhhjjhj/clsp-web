import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params
  const items = await prisma.scheduleAcceleration.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const item = await prisma.scheduleAcceleration.create({
    data: {
      projectId: id,
      category:  body.category,
      method:    body.method,
      days:      Number(body.days),
      costRate:  Number(body.costRate),
      condition: body.condition ?? null,
      reference: body.reference ?? null,
    },
  })
  return NextResponse.json(item, { status: 201 })
}
