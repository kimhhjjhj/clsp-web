import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string; aid: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { aid } = await params
  const body = await req.json()
  const item = await prisma.scheduleAcceleration.update({
    where: { id: aid },
    data: {
      category:  body.category,
      method:    body.method,
      days:      Number(body.days),
      costRate:  Number(body.costRate),
      condition: body.condition ?? null,
      reference: body.reference ?? null,
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { aid } = await params
  await prisma.scheduleAcceleration.delete({ where: { id: aid } })
  return NextResponse.json({ ok: true })
}
