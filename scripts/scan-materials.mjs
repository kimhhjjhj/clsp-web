// 일보(DailyReport.materialList)에 실제로 입력된 자재 종류 + 누적 물량 스캔
// 목적: TRADE_MATERIAL_MAP 확장 근거 확보

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const projects = await prisma.project.findMany({
  select: {
    id: true, name: true,
    dailyReports: { select: { date: true, materialList: true, manpower: true } },
  },
})

const byMaterial = new Map()  // name → { unit, totalQty, projects, days }
const byTrade = new Map()      // trade → { totalManDays, days, projects }

for (const p of projects) {
  for (const r of p.dailyReports) {
    const mats = r.materialList ?? []
    for (const m of Array.isArray(mats) ? mats : []) {
      if (!m?.name || !m?.today || m.today <= 0) continue
      const key = m.name
      const cur = byMaterial.get(key) ?? { unit: m.unit ?? '?', totalQty: 0, projects: new Set(), days: 0 }
      cur.totalQty += m.today
      cur.projects.add(p.name)
      cur.days++
      if (m.unit && !cur.unit) cur.unit = m.unit
      byMaterial.set(key, cur)
    }
    const mp = r.manpower ?? []
    for (const man of Array.isArray(mp) ? mp : []) {
      if (!man?.trade || !man?.today || man.today <= 0) continue
      const cur = byTrade.get(man.trade) ?? { totalManDays: 0, days: 0, projects: new Set() }
      cur.totalManDays += man.today
      cur.days++
      cur.projects.add(p.name)
      byTrade.set(man.trade, cur)
    }
  }
}

console.log(`\n=== materialList 실제 등록 자재 (상위 30, 총물량 기준) ===`)
const mats = [...byMaterial.entries()]
  .sort((a, b) => b[1].totalQty - a[1].totalQty)
  .slice(0, 30)
for (const [name, v] of mats) {
  console.log(`  ${name.padEnd(22)} ${String(v.totalQty.toFixed(1)).padStart(10)} ${(v.unit ?? '').padEnd(5)} · ${v.days}일 · 프로젝트 ${v.projects.size}개`)
}

console.log(`\n=== manpower 등록 공종 (상위 25, 총 인일 기준) ===`)
const trades = [...byTrade.entries()]
  .sort((a, b) => b[1].totalManDays - a[1].totalManDays)
  .slice(0, 25)
for (const [name, v] of trades) {
  console.log(`  ${name.padEnd(22)} ${String(v.totalManDays.toFixed(0)).padStart(8)}인일 · ${v.days}일 활동 · 프로젝트 ${v.projects.size}개`)
}

console.log(`\n고유 자재 ${byMaterial.size}종 / 고유 공종 ${byTrade.size}종`)
await prisma.$disconnect()
