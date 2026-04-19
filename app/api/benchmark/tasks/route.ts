import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ═══════════════════════════════════════════════════════════
// 공종별 벤치마크 API — 과거 프로젝트 Task 집계
//
// 응답: 공종명 → { avg, min, max, n, projects }
// n ≥ 2 인 공종만 반환 (1개뿐이면 벤치마크 불가)
//
// 필터: lastCpmDuration 있는 프로젝트 + 현재 프로젝트 제외(선택)
// ═══════════════════════════════════════════════════════════

export async function GET(req: Request) {
  const url = new URL(req.url)
  const excludeId = url.searchParams.get('exclude')  // 현재 편집 중 프로젝트 ID
  const type = url.searchParams.get('type')          // 용도 필터 (예: 공동주택)

  const projects = await prisma.project.findMany({
    where: {
      lastCpmDuration: { gt: 0 },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      ...(type ? { type } : {}),
    },
    select: {
      id: true, name: true, type: true,
      tasks: { select: { name: true, duration: true } },
    },
  })

  const byName = new Map<string, { durations: number[]; projects: Set<string> }>()
  for (const p of projects) {
    for (const t of p.tasks) {
      if (!t.name || t.duration <= 0) continue
      const cur = byName.get(t.name) ?? { durations: [], projects: new Set() }
      cur.durations.push(t.duration)
      cur.projects.add(p.name)
      byName.set(t.name, cur)
    }
  }

  const stats = [...byName.entries()]
    .filter(([, v]) => v.projects.size >= 2)
    .map(([name, v]) => {
      const durations = v.durations
      const n = durations.length
      const avg = durations.reduce((a, b) => a + b, 0) / n
      const min = Math.min(...durations)
      const max = Math.max(...durations)
      const variance = durations.reduce((s, x) => s + (x - avg) ** 2, 0) / n
      return {
        name,
        avg: Math.round(avg * 10) / 10,
        min: Math.round(min * 10) / 10,
        max: Math.round(max * 10) / 10,
        std: Math.round(Math.sqrt(variance) * 10) / 10,
        n,
        projects: v.projects.size,
      }
    })

  return NextResponse.json({ count: stats.length, stats })
}
