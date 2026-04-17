import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractFromText } from '@/lib/work-extractor'
import { normalizeTrade } from '@/lib/normalizers/aliases'

type Params = { params: Promise<{ id: string }> }

interface WorkSection { building: string[]; mep: string[] }
interface ManpowerEntry { trade: string; today: number }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const reports = await prisma.dailyReport.findMany({
    where: { projectId: id },
    orderBy: { date: 'asc' },
    select: {
      date: true,
      workToday: true,
      manpower: true,
    },
  })

  if (reports.length === 0) {
    return NextResponse.json({
      locations: [],
      workTypes: [],
      matrix: [],
      unclassifiedCount: 0,
      totalItemCount: 0,
    })
  }

  // 집계 맵
  const locMap = new Map<
    string,
    { days: Set<string>; manDays: number; mentions: number; first: string; last: string }
  >()
  const partMap = new Map<
    string,
    { days: Set<string>; manDays: number; mentions: number; first: string; last: string }
  >()
  const wtMap = new Map<
    string,
    {
      days: Set<string>
      manDays: number
      mentions: number
      first: string
      last: string
      relatedTrades: Map<string, number>
    }
  >()
  const matrixMap = new Map<string, { location: string; workType: string; days: Set<string> }>()
  const partMatrixMap = new Map<string, { part: string; workType: string; days: Set<string> }>()

  let totalItems = 0
  let unclassifiedItems = 0

  for (const r of reports) {
    const date = r.date
    const wt = (r.workToday as WorkSection | null) ?? { building: [], mep: [] }
    const mp = (r.manpower as ManpowerEntry[] | null) ?? []
    const dayManDays = mp.reduce((s, m) => s + (m.today || 0), 0)

    // 금일 작업 텍스트 전부 모음 (building + mep)
    const items = [...(wt.building ?? []), ...(wt.mep ?? [])]
    if (items.length === 0) continue

    for (const text of items) {
      totalItems++
      const ext = extractFromText(text)
      if (
        ext.locations.length === 0 &&
        ext.parts.length === 0 &&
        ext.workTypes.length === 0
      ) {
        unclassifiedItems++
        continue
      }

      // 위치 집계
      for (const loc of ext.locations) {
        const cur = locMap.get(loc) ?? {
          days: new Set<string>(),
          manDays: 0,
          mentions: 0,
          first: date,
          last: date,
        }
        cur.days.add(date)
        cur.mentions++
        if (date < cur.first) cur.first = date
        if (date > cur.last) cur.last = date
        locMap.set(loc, cur)
      }

      // 부위 집계
      for (const p of ext.parts) {
        const cur = partMap.get(p) ?? {
          days: new Set<string>(),
          manDays: 0,
          mentions: 0,
          first: date,
          last: date,
        }
        cur.days.add(date)
        cur.mentions++
        if (date < cur.first) cur.first = date
        if (date > cur.last) cur.last = date
        partMap.set(p, cur)
      }

      // 작업종류 집계
      for (const w of ext.workTypes) {
        const cur = wtMap.get(w) ?? {
          days: new Set<string>(),
          manDays: 0,
          mentions: 0,
          first: date,
          last: date,
          relatedTrades: new Map<string, number>(),
        }
        cur.days.add(date)
        cur.mentions++
        if (date < cur.first) cur.first = date
        if (date > cur.last) cur.last = date
        for (const m of mp) {
          if (m.today > 0) {
            const tradeKey = normalizeTrade(m.trade)
            if (tradeKey) cur.relatedTrades.set(tradeKey, (cur.relatedTrades.get(tradeKey) ?? 0) + m.today)
          }
        }
        wtMap.set(w, cur)
      }

      // 위치 × 작업 매트릭스
      for (const loc of ext.locations) {
        for (const w of ext.workTypes) {
          const key = `${loc}|${w}`
          const cur = matrixMap.get(key) ?? {
            location: loc, workType: w, days: new Set<string>(),
          }
          cur.days.add(date)
          matrixMap.set(key, cur)
        }
      }

      // 부위 × 작업 매트릭스
      for (const p of ext.parts) {
        for (const w of ext.workTypes) {
          const key = `${p}|${w}`
          const cur = partMatrixMap.get(key) ?? {
            part: p, workType: w, days: new Set<string>(),
          }
          cur.days.add(date)
          partMatrixMap.set(key, cur)
        }
      }
    }

    // 그 날 man-day를 언급된 위치/부위/작업에 분배 (대략값)
    const daySeenLocs = new Set<string>()
    const daySeenParts = new Set<string>()
    const daySeenWts = new Set<string>()
    for (const text of items) {
      const ext = extractFromText(text)
      ext.locations.forEach(l => daySeenLocs.add(l))
      ext.parts.forEach(p => daySeenParts.add(p))
      ext.workTypes.forEach(w => daySeenWts.add(w))
    }
    if (daySeenLocs.size > 0) {
      const share = dayManDays / daySeenLocs.size
      for (const l of daySeenLocs) {
        const cur = locMap.get(l)
        if (cur) cur.manDays += share
      }
    }
    if (daySeenParts.size > 0) {
      const share = dayManDays / daySeenParts.size
      for (const p of daySeenParts) {
        const cur = partMap.get(p)
        if (cur) cur.manDays += share
      }
    }
    if (daySeenWts.size > 0) {
      const share = dayManDays / daySeenWts.size
      for (const w of daySeenWts) {
        const cur = wtMap.get(w)
        if (cur) cur.manDays += share
      }
    }
  }

  const locations = Array.from(locMap.entries())
    .map(([loc, v]) => ({
      location: loc,
      days: v.days.size,
      manDays: Math.round(v.manDays),
      mentions: v.mentions,
      firstDate: v.first,
      lastDate: v.last,
      durationDays:
        Math.round(
          (new Date(v.last).getTime() - new Date(v.first).getTime()) / 86400000,
        ) + 1,
    }))
    .sort((a, b) => b.manDays - a.manDays)

  const workTypes = Array.from(wtMap.entries())
    .map(([wt, v]) => ({
      workType: wt,
      days: v.days.size,
      manDays: Math.round(v.manDays),
      mentions: v.mentions,
      firstDate: v.first,
      lastDate: v.last,
      durationDays:
        Math.round(
          (new Date(v.last).getTime() - new Date(v.first).getTime()) / 86400000,
        ) + 1,
      relatedTrades: Array.from(v.relatedTrades.entries())
        .map(([trade, count]) => ({ trade, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    }))
    .sort((a, b) => b.manDays - a.manDays)

  const matrix = Array.from(matrixMap.values())
    .map(m => ({
      location: m.location,
      workType: m.workType,
      days: m.days.size,
    }))
    .sort((a, b) => b.days - a.days)

  const parts = Array.from(partMap.entries())
    .map(([p, v]) => ({
      part: p,
      days: v.days.size,
      manDays: Math.round(v.manDays),
      mentions: v.mentions,
      firstDate: v.first,
      lastDate: v.last,
      durationDays:
        Math.round(
          (new Date(v.last).getTime() - new Date(v.first).getTime()) / 86400000,
        ) + 1,
    }))
    .sort((a, b) => b.manDays - a.manDays)

  const partMatrix = Array.from(partMatrixMap.values())
    .map(m => ({
      part: m.part,
      workType: m.workType,
      days: m.days.size,
    }))
    .sort((a, b) => b.days - a.days)

  return NextResponse.json({
    locations,
    parts,
    workTypes,
    matrix,
    partMatrix,
    unclassifiedCount: unclassifiedItems,
    totalItemCount: totalItems,
  })
}
