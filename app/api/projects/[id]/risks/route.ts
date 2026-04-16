import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params
  const items = await prisma.riskOpportunity.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const item = await prisma.riskOpportunity.create({
    data: {
      projectId:   id,
      type:        body.type,
      category:    body.category,
      content:     body.content,
      impactType:  body.impactType,
      impactDays:  body.impactDays  ? Number(body.impactDays)  : null,
      impactCost:  body.impactCost  ? Number(body.impactCost)  : null,
      probability: Number(body.probability),
      response:    body.response  ?? null,
      owner:       body.owner     ?? null,
      status:      body.status    ?? 'identified',
    },
  })
  return NextResponse.json(item, { status: 201 })
}
