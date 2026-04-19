// 공종 단위 벤치마크 편차 실데이터 검증
// /api/benchmark/tasks + /api/bid/estimate 결합해 편차 ±30% 초과 공종 확인

const BID = {
  ground: 20, basement: 2, lowrise: 0, hasTransfer: false,
  siteArea: 6000, bldgArea: 30000, buildingArea: 1500,
  sitePerim: 300, bldgPerim: 220, wtBottom: 3, waBottom: 6,
}

const [estRes, benchRes] = await Promise.all([
  fetch('http://localhost:3000/api/bid/estimate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(BID),
  }),
  fetch('http://localhost:3000/api/benchmark/tasks?type=%EA%B3%B5%EB%8F%99%EC%A3%BC%ED%83%9D'),
])

const est = await estRes.json()
const { stats } = await benchRes.json()

const byName = new Map(stats.map(s => [s.name, s]))

const devs = []
for (const t of est.cpm.tasks) {
  const s = byName.get(t.name)
  if (!s || s.avg <= 0) continue
  const dev = ((t.duration - s.avg) / s.avg) * 100
  devs.push({
    name: t.name,
    current: t.duration,
    avg: s.avg, min: s.min, max: s.max,
    dev, projects: s.projects,
  })
}

devs.sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev))

console.log(`=== 공종 단위 벤치마크 편차 (공동주택 ${BID.ground}F/${BID.basement}B/${BID.lowrise}LR) ===\n`)
console.log(`비교 가능 공종: ${devs.length}개 (과거 DB에 ≥2프로젝트 존재하는 공종만)\n`)

let longCnt = 0, shortCnt = 0, normalCnt = 0
for (const d of devs) {
  const sign = d.dev >= 0 ? '+' : ''
  const level = d.dev <= -30 ? 'short ⬇️' : d.dev >= 30 ? 'long ⬆️' : 'normal ─'
  if (level.startsWith('short')) shortCnt++
  else if (level.startsWith('long')) longCnt++
  else normalCnt++
  console.log(`  ${d.name.padEnd(22)} ${String(d.current).padStart(5)}일 vs 평균 ${String(d.avg).padStart(5)}일 [${d.min}~${d.max}] ${sign}${d.dev.toFixed(0).padStart(4)}%  ${level}`)
}
console.log(`\n── 분포 ── long: ${longCnt} · short: ${shortCnt} · normal: ${normalCnt}`)
