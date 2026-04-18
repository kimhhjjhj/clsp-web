// 유사 프로젝트 벤치마크 API
// 입력: type / ground / basement / bldgArea
// 출력: 유사도 top 5 프로젝트 + 평균 공기·생산성·주요 공종

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeTrade } from '@/lib/normalizers/aliases'

interface ManpowerEntry { trade: string; today: number }

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const type = url.searchParams.get('type') ?? undefined
  const ground = url.searchParams.get('ground') ? Number(url.searchParams.get('ground')) : undefined
  const basement = url.searchParams.get('basement') ? Number(url.searchParams.get('basement')) : undefined
  const bldgArea = url.searchParams.get('bldgArea') ? Number(url.searchParams.get('bldgArea')) : undefined
  const limit = Number(url.searchParams.get('limit') ?? 5)

  const projects = await prisma.project.findMany({
    include: {
      _count: { select: { tasks: true, dailyReports: true } },
    },
  })

  // 유사도 점수 계산 (0~100)
  const scored = projects.map(p => {
    let score = 0
    let factors = 0

    // 유형 매치 (0 or 40)
    if (type && p.type) {
      factors += 40
      if (p.type === type) score += 40
    }

    // 지상 층수 ±2 → 만점 30
    if (ground !== undefined && p.ground) {
      factors += 30
      const diff = Math.abs(p.ground - ground)
      if (diff === 0) score += 30
      else if (diff <= 2) score += Math.max(0, 30 - diff * 5)
      else if (diff <= 5) score += Math.max(0, 15 - diff * 2)
    }

    // 지하 층수 (0 or 10)
    if (basement !== undefined && p.basement !== null && p.basement !== undefined) {
      factors += 10
      if (Math.abs((p.basement ?? 0) - basement) <= 1) score += 10
      else if (Math.abs((p.basement ?? 0) - basement) <= 3) score += 5
    }

    // 연면적 ±30% → 만점 20
    if (bldgArea !== undefined && p.bldgArea) {
      factors += 20
      const ratio = Math.min(p.bldgArea, bldgArea) / Math.max(p.bldgArea, bldgArea)
      score += Math.round(ratio * 20)
    }

    const normalizedScore = factors > 0 ? Math.round((score / factors) * 100) : 0
    return { project: p, score: normalizedScore, factors }
  }).filter(x => x.factors >= 30 && x.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  // 각 프로젝트의 투입 인원 집계
  const projectIds = scored.map(s => s.project.id)
  const reports = projectIds.length > 0
    ? await prisma.dailyReport.findMany({
        where: { projectId: { in: projectIds } },
        select: { projectId: true, manpower: true },
      })
    : []

  const byProject = new Map<string, { totalManDays: number; activeDays: Set<string>; trades: Map<string, number> }>()
  for (const r of reports) {
    const mp = (r.manpower as ManpowerEntry[] | null) ?? []
    const cur = byProject.get(r.projectId) ?? { totalManDays: 0, activeDays: new Set<string>(), trades: new Map() }
    for (const m of mp) {
      if (!m.today || m.today <= 0) continue
      cur.totalManDays += m.today
      const t = normalizeTrade(m.trade)
      if (t) cur.trades.set(t, (cur.trades.get(t) ?? 0) + m.today)
    }
    byProject.set(r.projectId, cur)
  }

  const results = scored.map(({ project: p, score }) => {
    const agg = byProject.get(p.id)
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      ground: p.ground,
      basement: p.basement,
      bldgArea: p.bldgArea,
      startDate: p.startDate,
      lastCpmDuration: p.lastCpmDuration,
      similarityScore: score,
      taskCount: p._count.tasks,
      reportCount: p._count.dailyReports,
      totalManDays: agg ? Math.round(agg.totalManDays * 10) / 10 : 0,
      topTrades: agg ? Array.from(agg.trades.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([trade, manDays]) => ({ trade, manDays })) : [],
    }
  })

  // 전체 평균 (유사도 50 이상만)
  const reliable = results.filter(r => r.similarityScore >= 50)
  const aggregate = reliable.length > 0 ? {
    count: reliable.length,
    avgDuration: Math.round(reliable.reduce((s, r) => s + (r.lastCpmDuration ?? 0), 0) / reliable.length),
    avgManDays: Math.round(reliable.reduce((s, r) => s + r.totalManDays, 0) / reliable.length),
    avgArea: Math.round(reliable.reduce((s, r) => s + (r.bldgArea ?? 0), 0) / reliable.length),
  } : null

  return NextResponse.json({ results, aggregate })
}
