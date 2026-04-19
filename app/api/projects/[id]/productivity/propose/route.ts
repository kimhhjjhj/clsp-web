import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeTrade, isNonTrade } from '@/lib/normalizers/aliases'

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
      if (isNonTrade(tradeKey)) continue  // 비공종(관리·안전관리자 등) 제외
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

  // 프로젝트 분모 (면적·층수) — 단위 물량당 지표 계산용
  const bldgArea = project.bldgArea ?? 0
  const totalFloors = (project.ground ?? 0) + (project.basement ?? 0) + (project.lowrise ?? 0)

  const created: { id: string; trade: string; value: number; unit: string }[] = []

  async function upsertProposal(params: {
    trade: string
    value: number
    unit: string
    sampleSize: number
    source: unknown
  }) {
    const existing = await prisma.productivityProposal.findFirst({
      where: { projectId: id, trade: params.trade, unit: params.unit, status: 'pending' },
      select: { id: true },
    })
    const row = existing
      ? await prisma.productivityProposal.update({
          where: { id: existing.id },
          data: { value: params.value, sampleSize: params.sampleSize, source: params.source as any },
        })
      : await prisma.productivityProposal.create({
          data: {
            projectId: id,
            trade: params.trade,
            value: params.value,
            unit: params.unit,
            sampleSize: params.sampleSize,
            source: params.source as any,
          },
        })
    created.push({ id: row.id, trade: params.trade, value: params.value, unit: params.unit })
  }

  for (const [trade, s] of tradeStats.entries()) {
    const activeDays = s.activeDays.size
    if (activeDays === 0) continue

    const baseSource = {
      totalManDays: s.totalManDays,
      activeDays,
      firstDate: s.firstDate,
      lastDate: s.lastDate,
      projectName: project.name,
    }

    // 1) man/day — 일평균 투입 (규모 감)
    await upsertProposal({
      trade,
      value: Math.round((s.totalManDays / activeDays) * 100) / 100,
      unit: 'man/day',
      sampleSize: activeDays,
      source: baseSource,
    })

    // 2) 자재 물량당 인일 (철근·레미콘 등 매핑 자재 입력된 경우만)
    const mapping = TRADE_MATERIAL_MAP[trade]
    if (mapping) {
      const qty = materialTotals.get(mapping.matName)
      if (qty && qty > 0) {
        await upsertProposal({
          trade,
          value: Math.round((s.totalManDays / qty) * 100) / 100,
          unit: mapping.unit,
          sampleSize: activeDays,
          source: { ...baseSource, totalMaterial: qty, matName: mapping.matName },
        })
      }
    }

    // 3) 연면적당 인일 — bldgArea 있을 때 (자재 매핑 안 되는 공종도 유효)
    //    예: 내장 4106인일 / 30000㎡ = 0.137 인일/㎡
    if (bldgArea > 0) {
      await upsertProposal({
        trade,
        value: Math.round((s.totalManDays / bldgArea) * 10000) / 10000,  // 소수 4자리 (작은 값)
        unit: 'mandays/m2',
        sampleSize: activeDays,
        source: { ...baseSource, bldgArea },
      })
    }

    // 4) 층당 인일 — 총층수 있을 때
    //    예: 철콘(형틀) 1700인일 / 24층 = 70.8 인일/층
    if (totalFloors > 0) {
      await upsertProposal({
        trade,
        value: Math.round((s.totalManDays / totalFloors) * 100) / 100,
        unit: 'mandays/floor',
        sampleSize: activeDays,
        source: { ...baseSource, totalFloors },
      })

    // 5) 층당 활동일수 — 공기 감 (현장 체감)
    //    예: 미장 308일 / 24층 = 12.8 일/층
      await upsertProposal({
        trade,
        value: Math.round((activeDays / totalFloors) * 100) / 100,
        unit: 'days/floor',
        sampleSize: activeDays,
        source: { ...baseSource, totalFloors },
      })
    }
  }

  return NextResponse.json({
    ok: true,
    count: created.length,
    proposals: created,
  })
}
