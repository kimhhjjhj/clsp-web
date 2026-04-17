import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeTrade } from '@/lib/normalizers/aliases'

type Params = { params: Promise<{ id: string }> }

interface ManpowerEntry { trade: string; company: string; today: number }
interface MaterialEntry { name: string; spec: string; today: number; unit?: string }
interface EquipmentEntry { name: string; spec: string; today: number }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const reports = await prisma.dailyReport.findMany({
    where: { projectId: id },
    orderBy: { date: 'asc' },
  })

  if (reports.length === 0) {
    return NextResponse.json({
      overall: null,
      tradeSummary: [],
      monthlyTrend: [],
      dowPattern: [],
      weatherImpact: [],
      materialSummary: [],
      equipmentSummary: [],
    })
  }

  // ── 공종별 집계 ────────────────────
  const tradeMap = new Map<
    string,
    { total: number; days: Set<string>; first: string; last: string; peak: number; peakDate: string }
  >()

  // ── 월별 집계 ────────────────────
  const monthMap = new Map<string, { total: number; days: Set<string> }>()

  // ── 요일별 집계 ────────────────────
  const DOW = ['일', '월', '화', '수', '목', '금', '토']
  const dowMap = new Map<string, { total: number; allDays: number; activeDays: number }>()

  // ── 날씨별 집계 ────────────────────
  const weatherMap = new Map<string, { total: number; days: number }>()

  // ── 자재 집계 ────────────────────
  const materialMap = new Map<
    string,
    { name: string; spec: string; unit?: string; total: number; days: Set<string> }
  >()

  // ── 장비 집계 ────────────────────
  const equipmentMap = new Map<
    string,
    { name: string; spec: string; totalCount: number; days: Set<string> }
  >()

  for (const r of reports) {
    const date = r.date
    const mp = (r.manpower as ManpowerEntry[] | null) ?? []
    const mat = (r.materialList as MaterialEntry[] | null) ?? []
    const eq = (r.equipmentList as EquipmentEntry[] | null) ?? []
    const dayTotal = mp.reduce((s, m) => s + (m.today || 0), 0)

    // 공종별 (정규화 적용 — 공백/오타 통일)
    for (const m of mp) {
      if (!m.today || m.today <= 0) continue
      const tradeKey = normalizeTrade(m.trade)
      if (!tradeKey) continue
      const cur = tradeMap.get(tradeKey) ?? {
        total: 0,
        days: new Set<string>(),
        first: date,
        last: date,
        peak: 0,
        peakDate: date,
      }
      cur.total += m.today
      cur.days.add(date)
      if (date < cur.first) cur.first = date
      if (date > cur.last) cur.last = date
      if (m.today > cur.peak) {
        cur.peak = m.today
        cur.peakDate = date
      }
      tradeMap.set(tradeKey, cur)
    }

    // 월별
    const month = date.slice(0, 7)
    const mm = monthMap.get(month) ?? { total: 0, days: new Set<string>() }
    mm.total += dayTotal
    if (dayTotal > 0) mm.days.add(date)
    monthMap.set(month, mm)

    // 요일별: allDays(일보 있는 전체 일수) + activeDays(투입>0)
    const dow = DOW[new Date(date).getDay()]
    const dm = dowMap.get(dow) ?? { total: 0, allDays: 0, activeDays: 0 }
    dm.total += dayTotal
    dm.allDays += 1
    if (dayTotal > 0) dm.activeDays += 1
    dowMap.set(dow, dm)

    // 날씨별
    if (r.weather && dayTotal > 0) {
      const wm = weatherMap.get(r.weather) ?? { total: 0, days: 0 }
      wm.total += dayTotal
      wm.days += 1
      weatherMap.set(r.weather, wm)
    }

    // 자재
    for (const m of mat) {
      if (!m.today || m.today <= 0) continue
      const key = `${m.name}|${m.spec}`
      const cur = materialMap.get(key) ?? {
        name: m.name,
        spec: m.spec,
        unit: m.unit,
        total: 0,
        days: new Set<string>(),
      }
      cur.total += m.today
      cur.days.add(date)
      if (!cur.unit && m.unit) cur.unit = m.unit
      materialMap.set(key, cur)
    }

    // 장비
    for (const e of eq) {
      if (!e.today || e.today <= 0) continue
      const key = `${e.name}|${e.spec}`
      const cur = equipmentMap.get(key) ?? {
        name: e.name,
        spec: e.spec,
        totalCount: 0,
        days: new Set<string>(),
      }
      cur.totalCount += e.today
      cur.days.add(date)
      equipmentMap.set(key, cur)
    }
  }

  const tradeSummary = Array.from(tradeMap.entries())
    .map(([trade, v]) => ({
      trade,
      totalManDays: v.total,
      activeDays: v.days.size,
      firstDate: v.first,
      lastDate: v.last,
      peakCount: v.peak,
      peakDate: v.peakDate,
      durationDays:
        Math.round(
          (new Date(v.last).getTime() - new Date(v.first).getTime()) / 86400000,
        ) + 1,
    }))
    .sort((a, b) => b.totalManDays - a.totalManDays)

  const monthlyTrend = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      totalWorkers: v.total,
      activeDays: v.days.size,
      avgPerDay: v.days.size > 0 ? Math.round((v.total / v.days.size) * 10) / 10 : 0,
    }))

  const dowPattern = DOW.map(dow => {
    const v = dowMap.get(dow) ?? { total: 0, allDays: 0, activeDays: 0 }
    return {
      dow,
      totalWorkers: v.total,
      allDays: v.allDays,       // 프로젝트 내 이 요일 총 일수
      activeDays: v.activeDays,  // 투입>0인 날
      days: v.activeDays,        // 하위호환
      avg: v.allDays > 0 ? Math.round((v.total / v.allDays) * 10) / 10 : 0,        // 전체 평균 (0 포함)
      activeAvg: v.activeDays > 0 ? Math.round((v.total / v.activeDays) * 10) / 10 : 0, // 활동일만 평균
      utilizationRate: v.allDays > 0 ? Math.round((v.activeDays / v.allDays) * 1000) / 10 : 0, // 가동률 %
    }
  })

  const weatherImpact = Array.from(weatherMap.entries())
    .map(([weather, v]) => ({
      weather,
      totalWorkers: v.total,
      days: v.days,
      avg: v.days > 0 ? Math.round((v.total / v.days) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.days - a.days)

  const materialSummary = Array.from(materialMap.values())
    .map(m => ({
      name: m.name,
      spec: m.spec,
      unit: m.unit ?? '',
      totalQuantity: Math.round(m.total * 100) / 100,
      days: m.days.size,
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity)

  const equipmentSummary = Array.from(equipmentMap.values())
    .map(e => ({
      name: e.name,
      spec: e.spec,
      totalCount: e.totalCount,
      days: e.days.size,
    }))
    .sort((a, b) => b.days - a.days)

  const projectStart = reports[0].date
  const projectEnd = reports[reports.length - 1].date
  const totalActiveDays = new Set(
    reports.filter(r => {
      const mp = (r.manpower as ManpowerEntry[] | null) ?? []
      return mp.some(m => m.today > 0)
    }).map(r => r.date),
  ).size
  const totalManDays = tradeSummary.reduce((s, t) => s + t.totalManDays, 0)

  return NextResponse.json({
    overall: {
      projectStart,
      projectEnd,
      totalDays:
        Math.round(
          (new Date(projectEnd).getTime() - new Date(projectStart).getTime()) /
            86400000,
        ) + 1,
      activeDays: totalActiveDays,
      totalManDays,
      tradeCount: tradeSummary.length,
      avgPerActiveDay:
        totalActiveDays > 0 ? Math.round((totalManDays / totalActiveDays) * 10) / 10 : 0,
    },
    tradeSummary,
    monthlyTrend,
    dowPattern,
    weatherImpact,
    materialSummary,
    equipmentSummary,
  })
}
