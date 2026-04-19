import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string; rid: string }> }

// 부분 업데이트 — undefined 인 필드는 건드리지 않음, null 은 명시적 삭제
function pick<T>(v: T): T | undefined {
  return v === undefined ? undefined : v
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { rid } = await params
  const body = await req.json()
  const item = await prisma.riskOpportunity.update({
    where: { id: rid },
    data: {
      type:          pick(body.type),
      category:      pick(body.category),
      content:       pick(body.content),
      impactType:    pick(body.impactType),
      impactDays:    body.impactDays  !== undefined ? (body.impactDays  != null ? Number(body.impactDays)  : null) : undefined,
      impactCost:    body.impactCost  !== undefined ? (body.impactCost  != null ? Number(body.impactCost)  : null) : undefined,
      probability:   body.probability !== undefined ? Number(body.probability) : undefined,
      response:      pick(body.response),
      owner:         pick(body.owner),
      status:        pick(body.status),
      // 실무 R&O 필드
      code:          pick(body.code),
      rev:           body.rev !== undefined ? (body.rev != null ? Number(body.rev) : null) : undefined,
      subCategory:   pick(body.subCategory),
      proposer:      pick(body.proposer),
      proposedAt:    pick(body.proposedAt),
      proposedCost:  body.proposedCost  !== undefined ? (body.proposedCost  != null ? Number(body.proposedCost)  : null) : undefined,
      confirmedCost: body.confirmedCost !== undefined ? (body.confirmedCost != null ? Number(body.confirmedCost) : null) : undefined,
      progress:      pick(body.progress),
      confirmedAt:   pick(body.confirmedAt),
      expectedAt:    pick(body.expectedAt),
      designApplied: pick(body.designApplied),
      note:          pick(body.note),
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { rid } = await params
  await prisma.riskOpportunity.delete({ where: { id: rid } })
  return NextResponse.json({ ok: true })
}
