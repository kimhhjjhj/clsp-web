// /bid 조정 UI 서버측 검증
// adjustments 옵션이 반영되어 duration·totalDuration이 정확히 변하는지 확인

const BID = {
  ground: 20, basement: 2, lowrise: 0, hasTransfer: false,
  siteArea: 6000, bldgArea: 30000, buildingArea: 1500,
  sitePerim: 300, bldgPerim: 220, wtBottom: 3, waBottom: 6,
}

// 1) 원본
const r0 = await fetch('http://localhost:3000/api/bid/estimate', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(BID),
}).then(r => r.json())

console.log(`원본: ${r0.cpm.totalDuration}일 / ${r0.cpm.taskCount}공종\n`)

// 2) 가장 긴 공종 1개를 1.5x (단축) / 0.5x (연장)
const longest = [...r0.cpm.tasks].sort((a, b) => b.duration - a.duration)[0]
console.log(`대상: "${longest.name}" (원본 ${longest.duration}일, taskId=${longest.taskId})\n`)

for (const m of [2.0, 1.5, 1.0, 0.75, 0.5]) {
  const res = await fetch('http://localhost:3000/api/bid/estimate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...BID, adjustments: [{ taskId: longest.taskId, multiplier: m }] }),
  })
  const d = await res.json()
  const t = d.cpm.tasks.find(x => x.taskId === longest.taskId)
  const expected = Math.max(1, Math.round((longest.duration / m) * 10) / 10)
  const pass = t.duration === expected ? '✅' : '❌'
  const totalDiff = d.cpm.totalDuration - r0.cpm.totalDuration
  console.log(`  ${pass} ${m}× → 공종 ${t.duration}일 (기대 ${expected}) · 총 ${d.cpm.totalDuration}일 (Δ${totalDiff >= 0 ? '+' : ''}${totalDiff})`)
}

// 3) 여러 공종 동시 조정
const top3 = [...r0.cpm.tasks].sort((a, b) => b.duration - a.duration).slice(0, 3)
const multi = await fetch('http://localhost:3000/api/bid/estimate', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...BID, adjustments: top3.map(t => ({ taskId: t.taskId, multiplier: 2.0 })) }),
}).then(r => r.json())
console.log(`\n상위 3공종 모두 2.0× 동시 적용 → 총 ${multi.cpm.totalDuration}일 (Δ${multi.cpm.totalDuration - r0.cpm.totalDuration})`)
