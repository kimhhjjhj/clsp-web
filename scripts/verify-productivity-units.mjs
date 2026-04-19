// 새 단위(mandays/m2·mandays/floor·days/floor) 제안이 정상 생성되는지 확인
// 기존 man/day와 병존, 파괴 없음

const projectsRes = await fetch('http://localhost:3000/api/projects')
const projects = await projectsRes.json()

// 일보 있는 프로젝트만
const withReports = projects.filter(p => (p._count?.dailyReports ?? 0) > 0)
console.log(`일보 있는 프로젝트: ${withReports.length}개\n`)

for (const p of withReports) {
  console.log(`── ${p.name} (${p._count.dailyReports}일보) ──`)
  const res = await fetch(`http://localhost:3000/api/projects/${p.id}/productivity/propose`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
  })
  const data = await res.json()
  if (!res.ok) { console.log(`  에러: ${data.error}\n`); continue }

  // 단위별 카운트
  const byUnit = new Map()
  for (const pr of data.proposals) {
    byUnit.set(pr.unit, (byUnit.get(pr.unit) ?? 0) + 1)
  }
  for (const [unit, cnt] of [...byUnit.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${unit.padEnd(16)} ${cnt}개 제안`)
  }

  // 샘플 (공종별 몇 개만)
  const sample = new Map()  // trade → { 'man/day': v, 'mandays/m2': v, 'mandays/floor': v, 'days/floor': v }
  for (const pr of data.proposals) {
    if (!sample.has(pr.trade)) sample.set(pr.trade, {})
    sample.get(pr.trade)[pr.unit] = pr.value
  }
  const picked = ['내장', '철콘(형틀)', '미장', '타일', '도장', '철콘(타설)']
  console.log(`  주요 공종 요약:`)
  for (const trade of picked) {
    const row = sample.get(trade)
    if (!row) continue
    const parts = []
    if (row['man/day'] !== undefined) parts.push(`${row['man/day']} 명/일`)
    if (row['mandays/m2'] !== undefined) parts.push(`${row['mandays/m2']} 인일/㎡`)
    if (row['mandays/floor'] !== undefined) parts.push(`${row['mandays/floor']} 인일/층`)
    if (row['days/floor'] !== undefined) parts.push(`${row['days/floor']} 일/층`)
    if (row['mandays/ton'] !== undefined) parts.push(`${row['mandays/ton']} 인일/톤`)
    if (row['mandays/m3'] !== undefined) parts.push(`${row['mandays/m3']} 인일/㎥`)
    console.log(`    ${trade.padEnd(14)} ${parts.join(' · ')}`)
  }
  console.log()
}
