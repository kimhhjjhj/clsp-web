import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

// 모든 일보에서 공종/회사/자재/장비명 뽑아 빈도 분석
const reports = await p.dailyReport.findMany({
  select: { manpower: true, materialList: true, equipmentList: true },
})

const trades = new Map()
const companies = new Map()
const materials = new Map()
const equipments = new Map()

function bump(m, k) {
  if (!k) return
  const s = String(k).trim()
  if (!s) return
  m.set(s, (m.get(s) ?? 0) + 1)
}

for (const r of reports) {
  const mp = Array.isArray(r.manpower) ? r.manpower : []
  for (const x of mp) {
    bump(trades, x.trade)
    bump(companies, x.company)
  }
  const mat = Array.isArray(r.materialList) ? r.materialList : []
  for (const x of mat) bump(materials, x.name)
  const eq = Array.isArray(r.equipmentList) ? r.equipmentList : []
  for (const x of eq) bump(equipments, x.name)
}

function top(m, label, n = 40) {
  console.log(`\n━━━ ${label} (${m.size}종) ━━━`)
  const sorted = [...m.entries()].sort((a, b) => b[1] - a[1])
  for (const [k, v] of sorted.slice(0, n)) {
    console.log(`  ${String(v).padStart(5)}  ${k}`)
  }
}

top(trades, '공종 trade')
top(companies, '회사 company')
top(materials, '자재 materialName')
top(equipments, '장비 equipmentName')

await p.$disconnect()
