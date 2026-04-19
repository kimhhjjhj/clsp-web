import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const where = status ? { status } : {}
  const proposals = await prisma.productivityProposal.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      project: { select: { id: true, name: true } },
    },
  })
  const standards = await prisma.companyStandardProductivity.findMany({
    orderBy: { trade: 'asc' },
  })
  return NextResponse.json({ proposals, standards })
}
