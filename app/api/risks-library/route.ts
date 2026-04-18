// 전사 R&O 라이브러리 — 모든 프로젝트의 RiskOpportunity를 통합 조회
// 신규 프로젝트 착수 시 유사 리스크를 미리 파악하는 용도

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const type = url.searchParams.get('type') ?? undefined       // risk | opportunity
  const category = url.searchParams.get('category') ?? undefined
  const projectType = url.searchParams.get('projectType') ?? undefined  // 프로젝트 유형 필터

  const items = await prisma.riskOpportunity.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(category ? { category } : {}),
      ...(projectType ? { project: { type: projectType } } : {}),
    },
    include: {
      project: { select: { id: true, name: true, type: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // 카테고리별 집계 + 유형별 평균 영향
  const byCategory = new Map<string, { count: number; riskCount: number; oppCount: number; avgImpactDays: number; totalImpact: number }>()
  for (const i of items) {
    const cur = byCategory.get(i.category) ?? { count: 0, riskCount: 0, oppCount: 0, avgImpactDays: 0, totalImpact: 0 }
    cur.count++
    if (i.type === 'risk') cur.riskCount++
    else cur.oppCount++
    cur.totalImpact += (i.impactDays ?? 0)
    byCategory.set(i.category, cur)
  }
  const categorySummary = Array.from(byCategory.entries()).map(([category, v]) => ({
    category,
    count: v.count,
    riskCount: v.riskCount,
    oppCount: v.oppCount,
    avgImpactDays: v.count > 0 ? Math.round((v.totalImpact / v.count) * 10) / 10 : 0,
  })).sort((a, b) => b.count - a.count)

  return NextResponse.json({
    items: items.map(i => ({
      id: i.id,
      projectId: i.projectId,
      projectName: i.project.name,
      projectType: i.project.type,
      type: i.type,
      category: i.category,
      content: i.content,
      impactType: i.impactType,
      impactDays: i.impactDays,
      impactCost: i.impactCost,
      probability: i.probability,
      response: i.response,
      owner: i.owner,
      status: i.status,
      createdAt: i.createdAt,
    })),
    totalCount: items.length,
    categorySummary,
  })
}
