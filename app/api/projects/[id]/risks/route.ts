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
      type:        body.type ?? 'opportunity',
      category:    body.category,
      content:     body.content,
      impactType:  body.impactType ?? 'cost',
      impactDays:  body.impactDays != null ? Number(body.impactDays)  : null,
      impactCost:  body.impactCost != null ? Number(body.impactCost)  : null,
      probability: body.probability != null ? Number(body.probability) : 100,
      response:    body.response  ?? null,
      owner:       body.owner     ?? null,
      status:      body.status    ?? 'identified',
      // 실무 R&O 필드
      code:            body.code          ?? null,
      rev:             body.rev != null ? Number(body.rev) : null,
      subCategory:     body.subCategory   ?? null,
      proposer:        body.proposer      ?? '동양',
      proposedAt:      body.proposedAt    ?? null,
      proposedCost:    body.proposedCost  != null ? Number(body.proposedCost)  : null,
      confirmedCost:   body.confirmedCost != null ? Number(body.confirmedCost) : null,
      progress:        body.progress      ?? '진행',
      confirmedAt:     body.confirmedAt   ?? null,
      expectedAt:      body.expectedAt    ?? null,
      designApplied:   body.designApplied ?? null,
      note:            body.note          ?? null,
    },
  })
  return NextResponse.json(item, { status: 201 })
}
