import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const includeProposals = req.nextUrl.searchParams.get('includeProposals') === '1'

  const standards = await prisma.companyStandardProductivity.findMany({
    orderBy: [{ unit: 'asc' }, { trade: 'asc' }],
  })

  if (!includeProposals) {
    return NextResponse.json({ standards })
  }

  // pending + approved 제안 함께 반환 (표준이 없는 trade도 볼 수 있게)
  const proposals = await prisma.productivityProposal.findMany({
    where: { status: { in: ['pending', 'approved'] } },
    orderBy: [{ unit: 'asc' }, { trade: 'asc' }],
    select: {
      id: true,
      projectId: true,
      trade: true,
      value: true,
      unit: true,
      sampleSize: true,
      status: true,
      source: true,
      project: { select: { name: true } },
    },
  })

  // trade+unit 별로 aggregate — 표준이 없으면 제안들의 평균을 후보로 제시
  const candidateMap = new Map<
    string,
    { trade: string; unit: string; values: number[]; samples: number; projects: Set<string> }
  >()
  for (const p of proposals) {
    const key = `${p.trade}|${p.unit}`
    const cur = candidateMap.get(key) ?? {
      trade: p.trade,
      unit: p.unit,
      values: [],
      samples: 0,
      projects: new Set<string>(),
    }
    cur.values.push(p.value)
    cur.samples += p.sampleSize
    if (p.project?.name) cur.projects.add(p.project.name)
    candidateMap.set(key, cur)
  }
  const candidates = Array.from(candidateMap.values()).map(c => ({
    trade: c.trade,
    unit: c.unit,
    avgValue: Math.round((c.values.reduce((a, b) => a + b, 0) / c.values.length) * 100) / 100,
    proposalCount: c.values.length,
    totalSamples: c.samples,
    projectCount: c.projects.size,
  }))

  return NextResponse.json({ standards, proposals, candidates })
}
