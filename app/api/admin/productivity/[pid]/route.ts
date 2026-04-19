import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ pid: string }> }

// PATCH: 승인/거부/값수정
export async function PATCH(req: NextRequest, { params }: Params) {
  const { pid } = await params
  const body = await req.json()
  const action: 'approve' | 'reject' | 'update' = body.action

  const proposal = await prisma.productivityProposal.findUnique({ where: { id: pid } })
  if (!proposal) return NextResponse.json({ error: '제안 없음' }, { status: 404 })

  if (action === 'update') {
    // 값만 수정 (status는 pending 유지)
    const updated = await prisma.productivityProposal.update({
      where: { id: pid },
      data: {
        value: body.value != null ? Number(body.value) : proposal.value,
        reviewerNote: body.reviewerNote ?? proposal.reviewerNote,
      },
    })
    return NextResponse.json(updated)
  }

  if (action === 'reject') {
    const updated = await prisma.productivityProposal.update({
      where: { id: pid },
      data: {
        status: 'rejected',
        reviewerNote: body.reviewerNote ?? null,
        approvedBy: body.approvedBy ?? 'admin',
        approvedAt: new Date(),
      },
    })
    return NextResponse.json(updated)
  }

  if (action === 'approve') {
    // 값 수정도 동시 가능
    const finalValue = body.value != null ? Number(body.value) : proposal.value

    // 1) 제안 상태 업데이트
    const updated = await prisma.productivityProposal.update({
      where: { id: pid },
      data: {
        status: 'approved',
        value: finalValue,
        reviewerNote: body.reviewerNote ?? proposal.reviewerNote,
        approvedBy: body.approvedBy ?? 'admin',
        approvedAt: new Date(),
      },
    })

    // 2) CompanyStandardProductivity 업데이트 (이미 있으면 가중평균)
    const existing = await prisma.companyStandardProductivity.findUnique({
      where: { trade_unit: { trade: proposal.trade, unit: proposal.unit } },
    })
    if (existing) {
      const newCount = existing.sampleCount + 1
      const newValue =
        Math.round(
          ((existing.value * existing.sampleCount + finalValue) / newCount) * 100,
        ) / 100
      const prevIds = Array.isArray(existing.sourceProposalIds)
        ? (existing.sourceProposalIds as string[])
        : []
      await prisma.companyStandardProductivity.update({
        where: { id: existing.id },
        data: {
          value: newValue,
          sampleCount: newCount,
          sourceProposalIds: [...prevIds, pid],
          lastUpdated: new Date(),
        },
      })
    } else {
      await prisma.companyStandardProductivity.create({
        data: {
          trade: proposal.trade,
          unit: proposal.unit,
          value: finalValue,
          sampleCount: 1,
          sourceProposalIds: [pid],
        },
      })
    }

    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
}

// DELETE: 제안 삭제 (pending만)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { pid } = await params
  await prisma.productivityProposal.delete({ where: { id: pid } })
  return NextResponse.json({ ok: true })
}
