import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 통합 검색 — 프로젝트·일보·태스크·제안 대상
// 가벼운 LIKE 기반. 결과 수 각 카테고리 최대 10개.

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q || q.length < 1) return NextResponse.json({ results: [] })

  const lowerQ = q.toLowerCase()

  // 병렬 쿼리
  const [projects, reports, tasks, proposals] = await Promise.all([
    prisma.project.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { client: { contains: q, mode: 'insensitive' } },
          { location: { contains: q, mode: 'insensitive' } },
          { contractor: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: { id: true, name: true, location: true, client: true },
    }),
    prisma.dailyReport.findMany({
      where: {
        OR: [
          { date: { contains: q } },
          { notes: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        projectId: true,
        project: { select: { name: true } },
        notes: true,
      },
    }),
    prisma.task.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: {
        id: true,
        name: true,
        category: true,
        projectId: true,
        project: { select: { name: true } },
      },
    }),
    prisma.productivityProposal.findMany({
      where: {
        OR: [
          { trade: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, trade: true, value: true, unit: true, status: true, projectId: true },
    }),
  ])

  const results = [
    ...projects.map(p => ({
      kind: 'project' as const,
      id: p.id,
      title: p.name,
      subtitle: [p.client, p.location].filter(Boolean).join(' · ') || undefined,
      href: `/projects/${p.id}`,
    })),
    ...reports.map(r => ({
      kind: 'report' as const,
      id: r.id,
      title: `${r.date} 일보`,
      subtitle: [r.project?.name, r.notes?.slice(0, 40)].filter(Boolean).join(' · ') || undefined,
      href: `/projects/${r.projectId}/daily-reports/${r.id}`,
    })),
    ...tasks.map(t => ({
      kind: 'task' as const,
      id: t.id,
      title: t.name,
      subtitle: [t.project?.name, t.category].filter(Boolean).join(' · ') || undefined,
      href: `/projects/${t.projectId}/stage/1`,
    })),
    ...proposals.map(p => ({
      kind: 'proposal' as const,
      id: p.id,
      title: `${p.trade} · ${p.value} ${p.unit}`,
      subtitle: `생산성 제안 · ${p.status}`,
      href: `/admin/productivity`,
    })),
  ]

  return NextResponse.json({ results, counts: {
    project: projects.length,
    report: reports.length,
    task: tasks.length,
    proposal: proposals.length,
  }})
}
