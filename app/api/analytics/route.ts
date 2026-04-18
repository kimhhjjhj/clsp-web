import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeTrade, normalizeCompany, getTradeCategory } from '@/lib/normalizers/aliases'

interface ManpowerEntry { trade: string; company?: string; today: number }
interface MaterialEntry { name: string; today: number }
interface EquipmentEntry { name: string; today: number }

export async function GET(_req: NextRequest) {
  const [projects, reports] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true, name: true, ground: true, basement: true, bldgArea: true,
        startDate: true, lastCpmDuration: true, type: true,
        _count: { select: { tasks: true, dailyReports: true } },
      },
    }),
    prisma.dailyReport.findMany({
      orderBy: { date: 'asc' },
      select: { date: true, weather: true, manpower: true, materialList: true, equipmentList: true, projectId: true },
    }),
  ])

  // 공종별 집계
  const tradeMap = new Map<string, { total: number; days: Set<string>; companies: Set<string>; projects: Set<string>; monthly: Map<string, number> }>()
  // 월별 집계
  const monthMap = new Map<string, { total: number; days: Set<string> }>()
  // 요일별
  const DOW = ['일', '월', '화', '수', '목', '금', '토']
  const dowMap = new Map<string, { total: number; allDays: number; activeDays: number }>()
  // 날씨
  const weatherMap = new Map<string, { total: number; days: number }>()
  // 프로젝트별
  const byProject = new Map<string, { totalManDays: number; activeDays: Set<string>; trades: Set<string> }>()
  // 자재·장비 누계
  const materialMap = new Map<string, number>()
  const equipmentMap = new Map<string, number>()
  const companySet = new Set<string>()

  let totalManDays = 0
  let totalReportDays = 0
  const reportDates = new Set<string>()

  for (const r of reports) {
    const date = r.date
    reportDates.add(date)
    totalReportDays++

    const mp = (r.manpower as ManpowerEntry[] | null) ?? []
    const dayTotal = mp.reduce((s, m) => s + (m.today || 0), 0)
    totalManDays += dayTotal

    for (const m of mp) {
      if (!m.today || m.today <= 0) continue
      const tradeKey = normalizeTrade(m.trade)
      const companyKey = normalizeCompany(m.company)
      if (companyKey) companySet.add(companyKey)
      if (tradeKey) {
        const cur = tradeMap.get(tradeKey) ?? { total: 0, days: new Set<string>(), companies: new Set<string>(), projects: new Set<string>(), monthly: new Map<string, number>() }
        cur.total += m.today
        cur.days.add(date)
        if (companyKey) cur.companies.add(companyKey)
        cur.projects.add(r.projectId)
        const month = date.slice(0, 7)
        cur.monthly.set(month, (cur.monthly.get(month) ?? 0) + m.today)
        tradeMap.set(tradeKey, cur)
      }
    }

    // 월별
    const month = date.slice(0, 7)
    const mm = monthMap.get(month) ?? { total: 0, days: new Set<string>() }
    mm.total += dayTotal
    if (dayTotal > 0) mm.days.add(date)
    monthMap.set(month, mm)

    // 요일
    const dow = DOW[new Date(date).getDay()]
    const dm = dowMap.get(dow) ?? { total: 0, allDays: 0, activeDays: 0 }
    dm.total += dayTotal
    dm.allDays += 1
    if (dayTotal > 0) dm.activeDays += 1
    dowMap.set(dow, dm)

    // 날씨
    if (r.weather && dayTotal > 0) {
      const wm = weatherMap.get(r.weather) ?? { total: 0, days: 0 }
      wm.total += dayTotal
      wm.days += 1
      weatherMap.set(r.weather, wm)
    }

    // 프로젝트별
    const pj = byProject.get(r.projectId) ?? { totalManDays: 0, activeDays: new Set<string>(), trades: new Set<string>() }
    pj.totalManDays += dayTotal
    if (dayTotal > 0) pj.activeDays.add(date)
    for (const m of mp) {
      const t = normalizeTrade(m.trade)
      if (t) pj.trades.add(t)
    }
    byProject.set(r.projectId, pj)

    // 자재
    const mat = (r.materialList as MaterialEntry[] | null) ?? []
    for (const x of mat) if (x.today > 0) materialMap.set(x.name, (materialMap.get(x.name) ?? 0) + x.today)
    // 장비
    const eq = (r.equipmentList as EquipmentEntry[] | null) ?? []
    for (const x of eq) if (x.today > 0) equipmentMap.set(x.name, (equipmentMap.get(x.name) ?? 0) + x.today)
  }

  // 공종 상위 50 (생산성 DB 페이지용으로 확장)
  const topTrades = Array.from(tradeMap.entries())
    .map(([trade, v]) => ({
      trade,
      category: getTradeCategory(trade),
      totalManDays: Math.round(v.total * 10) / 10,
      activeDays: v.days.size,
      companies: v.companies.size,
      projectCount: v.projects.size,
      avgDaily: v.days.size > 0 ? Math.round((v.total / v.days.size) * 10) / 10 : 0,
      avgDaysPerProject: v.projects.size > 0 ? Math.round(v.days.size / v.projects.size) : 0,
      monthlyTrend: Array.from(v.monthly.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, manDays]) => ({ month, manDays: Math.round(manDays * 10) / 10 })),
    }))
    .sort((a, b) => b.totalManDays - a.totalManDays)
    .slice(0, 50)

  const monthlyTrend = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      totalManDays: Math.round(v.total * 10) / 10,
      activeDays: v.days.size,
      avgDaily: v.days.size > 0 ? Math.round((v.total / v.days.size) * 10) / 10 : 0,
    }))

  const dowPattern = DOW.map(d => {
    const v = dowMap.get(d) ?? { total: 0, allDays: 0, activeDays: 0 }
    return {
      dow: d,
      totalManDays: Math.round(v.total * 10) / 10,
      allDays: v.allDays,
      activeDays: v.activeDays,
      avgAllDays: v.allDays > 0 ? Math.round((v.total / v.allDays) * 10) / 10 : 0,
      utilization: v.allDays > 0 ? Math.round((v.activeDays / v.allDays) * 100) : 0,
    }
  })

  const weatherImpact = Array.from(weatherMap.entries())
    .map(([weather, v]) => ({
      weather,
      totalManDays: Math.round(v.total * 10) / 10,
      days: v.days,
      avgDaily: v.days > 0 ? Math.round((v.total / v.days) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.totalManDays - a.totalManDays)

  const projectSummary = projects.map(p => {
    const d = byProject.get(p.id)
    // 평당 투입 인일 (연면적 기반 벤치마크)
    const manDaysPerSqm = d && p.bldgArea && p.bldgArea > 0
      ? Math.round((d.totalManDays / p.bldgArea) * 100) / 100
      : null

    return {
      id: p.id,
      name: p.name,
      type: p.type,
      ground: p.ground,
      basement: p.basement,
      bldgArea: p.bldgArea,
      startDate: p.startDate,
      lastCpmDuration: p.lastCpmDuration,
      taskCount: p._count.tasks,
      reportCount: p._count.dailyReports,
      totalManDays: d ? Math.round(d.totalManDays * 10) / 10 : 0,
      activeDays: d?.activeDays.size ?? 0,
      tradeCount: d?.trades.size ?? 0,
      manDaysPerSqm,     // 연면적당 투입 인일 (있는 프로젝트만)
    }
  })

  const topMaterials = Array.from(materialMap.entries())
    .map(([name, qty]) => ({ name, qty: Math.round(qty * 100) / 100 }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10)

  const topEquipment = Array.from(equipmentMap.entries())
    .map(([name, count]) => ({ name, count: Math.round(count * 10) / 10 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return NextResponse.json({
    overall: {
      projectCount: projects.length,
      totalReports: totalReportDays,
      totalManDays: Math.round(totalManDays * 10) / 10,
      uniqueDates: reportDates.size,
      uniqueTrades: tradeMap.size,
      uniqueCompanies: companySet.size,
      avgDailyOverall: reportDates.size > 0 ? Math.round((totalManDays / reportDates.size) * 10) / 10 : 0,
    },
    topTrades,
    monthlyTrend,
    dowPattern,
    weatherImpact,
    projectSummary,
    topMaterials,
    topEquipment,
  })
}
