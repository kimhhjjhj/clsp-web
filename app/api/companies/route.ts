import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeCompany, normalizeTrade } from '@/lib/normalizers/aliases'

// 모든 일보의 manpower에서 협력사 집계
// 반환: [{ company, trades[], projects[], totalManDays, activeDays, firstDate, lastDate }]
interface ManpowerEntry { trade: string; company?: string; today: number }

export async function GET(_req: NextRequest) {
  const reports = await prisma.dailyReport.findMany({
    select: {
      date: true,
      manpower: true,
      projectId: true,
      project: { select: { id: true, name: true } },
    },
  })

  const companyMap = new Map<
    string,
    {
      company: string
      trades: Map<string, { manDays: number; days: Set<string> }>  // trade → 누적 인일 + 활동일 집합
      projects: Map<string, { name: string; manDays: number; days: Set<string> }>
      totalManDays: number
      activeDays: Set<string>
      firstDate: string
      lastDate: string
    }
  >()

  for (const r of reports) {
    const mp = (r.manpower as ManpowerEntry[] | null) ?? []
    for (const m of mp) {
      if (!m.today || m.today <= 0) continue
      const companyKey = normalizeCompany(m.company)
      if (!companyKey) continue
      const tradeKey = normalizeTrade(m.trade)
      const cur = companyMap.get(companyKey) ?? {
        company: companyKey,
        trades: new Map<string, { manDays: number; days: Set<string> }>(),
        projects: new Map<string, { name: string; manDays: number; days: Set<string> }>(),
        totalManDays: 0,
        activeDays: new Set<string>(),
        firstDate: r.date,
        lastDate: r.date,
      }
      cur.totalManDays += m.today
      if (tradeKey) {
        const t = cur.trades.get(tradeKey) ?? { manDays: 0, days: new Set<string>() }
        t.manDays += m.today
        t.days.add(r.date)
        cur.trades.set(tradeKey, t)
      }
      if (r.project) {
        const p = cur.projects.get(r.project.id) ?? { name: r.project.name, manDays: 0, days: new Set<string>() }
        p.manDays += m.today
        p.days.add(r.date)
        cur.projects.set(r.project.id, p)
      }
      cur.activeDays.add(r.date)
      if (r.date < cur.firstDate) cur.firstDate = r.date
      if (r.date > cur.lastDate) cur.lastDate = r.date
      companyMap.set(companyKey, cur)
    }
  }

  const companies = Array.from(companyMap.values())
    .map(c => ({
      company: c.company,
      trades: Array.from(c.trades.entries())
        .sort((a, b) => b[1].manDays - a[1].manDays)
        .map(([trade, v]) => ({ trade, manDays: Math.round(v.manDays * 10) / 10, days: v.days.size })),
      projects: Array.from(c.projects.entries())
        .sort((a, b) => b[1].manDays - a[1].manDays)
        .map(([id, v]) => ({ id, name: v.name, manDays: Math.round(v.manDays * 10) / 10, days: v.days.size })),
      totalManDays: Math.round(c.totalManDays * 10) / 10,
      activeDays: c.activeDays.size,
      avgDaily: c.activeDays.size > 0 ? Math.round((c.totalManDays / c.activeDays.size) * 10) / 10 : 0,
      firstDate: c.firstDate,
      lastDate: c.lastDate,
    }))
    .sort((a, b) => b.totalManDays - a.totalManDays)

  return NextResponse.json({ companies, total: companies.length })
}
