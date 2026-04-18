// 비정상 공종 탐지 검증
// z-score + dominance 규칙이 실데이터에서 어떻게 작동하는지 확인

const BID_INPUT = {
  ground: 20, basement: 2, lowrise: 0, hasTransfer: false,
  siteArea: 6000, bldgArea: 30000, buildingArea: 1500,
  sitePerim: 300, bldgPerim: 220, wtBottom: 3, waBottom: 6,
}

const res = await fetch('http://localhost:3000/api/bid/estimate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(BID_INPUT),
})
const data = await res.json()
const tasks = data.cpm.tasks
const total = data.cpm.totalDuration

// 카테고리별 통계
const byCat = new Map()
for (const t of tasks) {
  if (!byCat.has(t.category)) byCat.set(t.category, [])
  byCat.get(t.category).push(t)
}

console.log('=== 카테고리별 분포 ===')
for (const [cat, ts] of byCat) {
  const durs = ts.map(t => t.duration)
  const mean = durs.reduce((s, x) => s + x, 0) / durs.length
  const variance = durs.reduce((s, x) => s + (x - mean) ** 2, 0) / durs.length
  const std = Math.sqrt(variance)
  console.log(`\n[${cat}] ${ts.length}개 공종, 평균 ${mean.toFixed(1)}일, 표준편차 ${std.toFixed(1)}일`)
  for (const t of ts) {
    const multiple = mean > 0 ? t.duration / mean : 0
    const z = std > 0 ? (t.duration - mean) / std : 0
    const share = t.duration / total
    const tag = []
    if (ts.length >= 3 && z >= 1.5) tag.push(`🔺 z=${z.toFixed(2)}`)
    else if (ts.length < 3 && multiple >= 3) tag.push(`🔺 ${multiple.toFixed(1)}배`)
    if (share >= 0.20) tag.push(`🟥 전체의 ${(share * 100).toFixed(0)}%`)
    console.log(`  ${tag.length > 0 ? tag.join(' ') : '  '}  ${t.name.padEnd(18)} ${t.duration}일`)
  }
}

console.log(`\n총 공기: ${total}일 / 공종 ${tasks.length}개`)
