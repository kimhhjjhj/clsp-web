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
      trades: Map<string, number>      // trade → 누적 인일
      projects: Map<string, string>    // projectId → projectName
      totalManDays: number
      activeDays: Set<string>          // 활동일 (일보 날짜)
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
        trades: new Map<string, number>(),
        projects: new Map<string, string>(),
        totalManDays: 0,
        activeDays: new Set<string>(),
        firstDate: r.date,
        lastDate: r.date,
      }
      cur.totalManDays += m.today
      if (tradeKey) cur.trades.set(tradeKey, (cur.trades.get(tradeKey) ?? 0) + m.today)
      if (r.project) cur.projects.set(r.project.id, r.project.name)
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
        .sort((a, b) => b[1] - a[1])
        .map(([trade, manDays]) => ({ trade, manDays })),
      projects: Array.from(c.projects.entries()).map(([id, name]) => ({ id, name })),
      totalManDays: Math.round(c.totalManDays * 10) / 10,
      activeDays: c.activeDays.size,
      avgDaily: c.activeDays.size > 0 ? Math.round((c.totalManDays / c.activeDays.size) * 10) / 10 : 0,
      firstDate: c.firstDate,
      lastDate: c.lastDate,
    }))
    .sort((a, b) => b.totalManDays - a.totalManDays)

  return NextResponse.json({ companies, total: companies.length })
}
