// explainDuration 회귀 검증 (순수 JS 구현으로 API 결과 재계산)
// 목적: lib/engine/wbs.ts의 explainDuration이 calcDuration과 동일한 결과를 내는지 확인

const BID_INPUT = {
  ground: 20, basement: 2, lowrise: 0, hasTransfer: false,
  siteArea: 6000, bldgArea: 30000, buildingArea: 1500,
  sitePerim: 300, bldgPerim: 220, wtBottom: 3, waBottom: 6,
}

function getWorkRate(cat) {
  if (cat.startsWith('공사준비') || cat.startsWith('토목공사')) return 0.666
  if (cat.startsWith('골조공사')) return 0.632
  if (cat.startsWith('마감공사')) return null
  return 1.0
}

function explainResult(task) {
  const qty = Number(task.quantity)
  if (!Number.isFinite(qty) || qty <= 0) return null
  const prod = task.productivity ? Number(task.productivity) : null
  const stdDays = task.stdDays ? Number(task.stdDays) : null
  const rate = getWorkRate(task.category)

  let durRaw = 0
  if (prod && prod > 0) durRaw = qty / prod
  else if (stdDays && stdDays > 0) durRaw = qty * stdDays
  else return null

  const final = rate && rate > 0 ? durRaw / rate : durRaw
  return Math.round(final * 10) / 10
}

const res = await fetch('http://localhost:3000/api/bid/estimate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(BID_INPUT),
})
const data = await res.json()
const tasks = data.cpm.tasks ?? []

console.log(`총 ${tasks.length}개 공종 검증\n`)
let ok = 0, mismatch = 0, skip = 0

for (const t of tasks) {
  const expDur = explainResult(t)
  if (expDur === null) { skip++; continue }
  const taskDur = Math.round(Number(t.duration) * 10) / 10
  // CPM 단계는 정수 반올림, explainDuration은 소수점 1자리. 차이 ±0.5 허용
  const match = Math.abs(taskDur - expDur) < 0.55
  console.log(`${match ? '✅' : '❌'} ${t.name.padEnd(18)} task=${taskDur}일  재계산=${expDur}일`)
  if (match) ok++; else mismatch++
}

console.log(`\n일치 ${ok} / 불일치 ${mismatch} / 설명불가 ${skip}`)
process.exit(mismatch > 0 ? 1 : 0)
