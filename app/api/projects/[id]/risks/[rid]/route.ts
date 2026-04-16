import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string; rid: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { rid } = await params
  const body = await req.json()
  const item = await prisma.riskOpportunity.update({
    where: { id: rid },
    data: {
      type:        body.type,
      category:    body.category,
      content:     body.content,
      impactType:  body.impactType,
      impactDays:  body.impactDays  != null ? Number(body.impactDays)  : null,
      impactCost:  body.impactCost  != null ? Number(body.impactCost)  : null,
      probability: Number(body.probability),
      response:    body.response ?? null,
      owner:       body.owner    ?? null,
      status:      body.status,
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { rid } = await params
  await prisma.riskOpportunity.delete({ where: { id: rid } })
  return NextResponse.json({ ok: true })
}
