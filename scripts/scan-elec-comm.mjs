import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

// 전기/통신 vs 전기 vs 통신 데이터 비교
const reports = await p.dailyReport.findMany({
  select: { date: true, manpower: true, workToday: true, projectId: true },
  orderBy: { date: 'asc' },
})

const projects = await p.project.findMany({ select: { id: true, name: true } })
const pmap = Object.fromEntries(projects.map(p => [p.id, p.name]))

// 각 trade별로 (회사, 프로젝트) 분포
const stats = { '전기': {}, '통신': {}, '전기/통신': {}, '소방(전기)': {}, '소방(기계)': {} }
const sampleWorks = { '전기': [], '통신': [], '전기/통신': [] }

for (const r of reports) {
  const mp = Array.isArray(r.manpower) ? r.manpower : []
  const projName = pmap[r.projectId] ?? r.projectId
  for (const m of mp) {
    if (!stats[m.trade]) continue
    const key = `${projName} | ${m.company ?? '(회사없음)'}`
    stats[m.trade][key] = (stats[m.trade][key] ?? 0) + 1

    // workToday 샘플 수집 (최대 5개씩)
    if (sampleWorks[m.trade] && sampleWorks[m.trade].length < 8) {
      const wt = r.workToday
      if (wt) {
        const text = Array.isArray(wt) ? wt.join(' / ') : JSON.stringify(wt).slice(0, 200)
        if (text.length > 5) {
          sampleWorks[m.trade].push(`[${r.date}] ${text.slice(0, 250)}`)
        }
      }
    }
  }
}

for (const [trade, dist] of Object.entries(stats)) {
  console.log(`\n━━ ${trade} ━━`)
  const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1])
  for (const [k, v] of sorted) {
    console.log(`  ${String(v).padStart(5)}  ${k}`)
  }
}

for (const [trade, samples] of Object.entries(sampleWorks)) {
  console.log(`\n━━ ${trade} 작업내용 샘플 ━━`)
  for (const s of samples) console.log(`  · ${s}`)
}

await p.$disconnect()
