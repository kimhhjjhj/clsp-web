import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeTrade } from '@/lib/normalizers/aliases'

type Params = { params: Promise<{ id: string }> }

interface ManpowerEntry { trade: string; today: number }
interface MaterialEntry { name: string; spec: string; today: number; unit?: string }

// 공종 ↔ 자재 매핑 (물량당 인일 계산 가능한 경우)
const TRADE_MATERIAL_MAP: Record<string, { matName: string; unit: string }> = {
  '철콘(철근)': { matName: '철근', unit: 'mandays/ton' },
  '철근': { matName: '철근', unit: 'mandays/ton' },
  '철콘(타설)': { matName: '레미콘', unit: 'mandays/m3' },
  '콘크리트': { matName: '레미콘', unit: 'mandays/m3' },
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: '프로젝트 없음' }, { status: 404 })

  const reports = await prisma.dailyReport.findMany({
    where: { projectId: id },
    orderBy: { date: 'asc' },
    select: { date: true, manpower: true, materialList: true },
  })

  if (reports.length === 0) {
    return NextResponse.json({ error: '일보 데이터가 없습니다.' }, { status: 400 })
  }

  // 공종별 집계
  const tradeStats = new Map<
    string,
    { totalManDays: number; activeDays: Set<string>; firstDate: string; lastDate: string }
  >()
  const materialTotals = new Map<string, number>()

  for (const r of reports) {
    const mp = (r.manpower as ManpowerEntry[] | null) ?? []
    for (const m of mp) {
      if (!m.today || m.today <= 0) continue
      const tradeKey = normalizeTrade(m.trade)
      if (!tradeKey) continue
      const cur = tradeStats.get(tradeKey) ?? {
        totalManDays: 0,
        activeDays: new Set<string>(),
        firstDate: r.date,
        lastDate: r.date,
      }
      cur.totalManDays += m.today
      cur.activeDays.add(r.date)
      if (r.date < cur.firstDate) cur.firstDate = r.date
      if (r.date > cur.lastDate) cur.lastDate = r.date
      tradeStats.set(tradeKey, cur)
    }
    const mat = (r.materialList as MaterialEntry[] | null) ?? []
    for (const x of mat) {
      if (!x.today || x.today <= 0) continue
      materialTotals.set(x.name, (materialTotals.get(x.name) ?? 0) + x.today)
    }
  }

  const created: { id: string; trade: string; value: number; unit: string }[] = []

  for (const [trade, s] of tradeStats.entries()) {
    const activeDays = s.activeDays.size
    if (activeDays === 0) continue

    // 1) 일평균 투입 (항상)
    const avgDaily = Math.round((s.totalManDays / activeDays) * 100) / 100
    const source = {
      totalManDays: s.totalManDays,
      activeDays,
      firstDate: s.firstDate,
      lastDate: s.lastDate,
      projectName: project.name,
    }

    const existingAvg = await prisma.productivityProposal.findFirst({
      where: { projectId: id, trade, unit: 'man/day', status: 'pending' },
      select: { id: true },
    })
    const avgProposal = existingAvg
      ? await prisma.productivityProposal.update({
          where: { id: existingAvg.id },
          data: { value: avgDaily, sampleSize: activeDays, source },
        })
      : await prisma.productivityProposal.create({
          data: {
            projectId: id,
            trade,
            value: avgDaily,
            unit: 'man/day',
            sampleSize: activeDays,
            source,
          },
        })
    created.push({ id: avgProposal.id, trade, value: avgDaily, unit: 'man/day' })

    // 2) 물량당 인일 (매칭 자재 있을 때)
    const mapping = TRADE_MATERIAL_MAP[trade]
    if (mapping) {
      const qty = materialTotals.get(mapping.matName)
      if (qty && qty > 0) {
        const perUnit = Math.round((s.totalManDays / qty) * 100) / 100
        const mSource = { ...source, totalMaterial: qty, matName: mapping.matName }

        const existing = await prisma.productivityProposal.findFirst({
          where: { projectId: id, trade, unit: mapping.unit, status: 'pending' },
          select: { id: true },
        })
        const p = existing
          ? await prisma.productivityProposal.update({
              where: { id: existing.id },
              data: { value: perUnit, sampleSize: activeDays, source: mSource },
            })
          : await prisma.productivityProposal.create({
              data: {
                projectId: id,
                trade,
                value: perUnit,
                unit: mapping.unit,
                sampleSize: activeDays,
                source: mSource,
              },
            })
        created.push({ id: p.id, trade, value: perUnit, unit: mapping.unit })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    count: created.length,
    proposals: created,
  })
}
