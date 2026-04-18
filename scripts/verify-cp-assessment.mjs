// CP 집중도 평가 실데이터 검증
// /api/bid/estimate 응답에서 isCritical·duration 추출 후 비율 계산

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
const tasks = data.cpm.tasks ?? []
const total = data.cpm.totalDuration

const cpTasks = tasks.filter(t => t.isCritical)
const cpDays = cpTasks.reduce((s, t) => s + t.duration, 0)
const ratio = total > 0 ? cpDays / total : 0

let level, label
if (ratio >= 0.70) { level = 'tight'; label = '매우 빡빡' }
else if (ratio >= 0.40) { level = 'moderate'; label = '적정' }
else { level = 'loose'; label = '여유' }

console.log(`=== CP 집중도 ===`)
console.log(`전체 공기: ${total}일`)
console.log(`CP 공종 수: ${cpTasks.length} / ${tasks.length}`)
console.log(`CP 일수 합: ${cpDays}일`)
console.log(`비율: ${(ratio * 100).toFixed(1)}%`)
console.log(`레벨: ${level} (${label})`)
console.log()
console.log(`CP 공종 목록:`)
for (const t of cpTasks) {
  console.log(`  - ${t.name.padEnd(18)} ${t.duration}일`)
}
