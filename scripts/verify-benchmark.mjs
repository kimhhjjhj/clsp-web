// 회사 과거 프로젝트 벤치마크 비교 검증
// /api/projects 로 실제 프로젝트 가져와 computeBenchmark 순수 함수와 동일한 로직 재구현

const res = await fetch('http://localhost:3000/api/projects')
const projects = await res.json()

console.log(`=== 전체 프로젝트 ${projects.length}개 ===\n`)

// 공동주택 + lastCpmDuration 있는 것만 대상
const valid = projects.filter(p =>
  p.type === '공동주택'
  && p.lastCpmDuration > 0
  && ((p.ground ?? 0) + (p.basement ?? 0) + (p.lowrise ?? 0)) > 0
)

console.log(`공동주택 + 공기 데이터 있는 프로젝트: ${valid.length}개`)
console.log('─'.repeat(70))

const perFloorArr = []
for (const p of valid) {
  const floors = (p.ground ?? 0) + (p.basement ?? 0) + (p.lowrise ?? 0)
  const dpf = p.lastCpmDuration / floors
  perFloorArr.push(dpf)
  console.log(`  ${p.name.padEnd(40)} ${String(floors).padStart(3)}층 · ${String(p.lastCpmDuration).padStart(4)}일 · ${dpf.toFixed(1)}일/층`)
}

const avg = perFloorArr.reduce((a, b) => a + b, 0) / perFloorArr.length
console.log('─'.repeat(70))
console.log(`평균: 층당 ${avg.toFixed(1)}일\n`)

// 현재 추정 (BidPage 기본값)
const BID_INPUT = {
  ground: 20, basement: 2, lowrise: 0, hasTransfer: false,
  siteArea: 6000, bldgArea: 30000, buildingArea: 1500,
  sitePerim: 300, bldgPerim: 220, wtBottom: 3, waBottom: 6,
}

const estRes = await fetch('http://localhost:3000/api/bid/estimate', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(BID_INPUT),
})
const est = await estRes.json()
const totalDuration = est.cpm.totalDuration
const currentFloors = BID_INPUT.ground + BID_INPUT.basement + BID_INPUT.lowrise
const currentDpf = totalDuration / currentFloors
const deviation = ((currentDpf - avg) / avg) * 100

console.log(`=== 현재 추정 (기본값 입력) ===`)
console.log(`  ${currentFloors}층 · ${totalDuration}일 · 층당 ${currentDpf.toFixed(1)}일`)
console.log(`  편차: ${deviation >= 0 ? '+' : ''}${deviation.toFixed(1)}% (평균 대비)`)

const level = deviation <= -15 ? 'short ⚠️ 낙관적' : deviation >= 15 ? 'long ⚠️ 보수적' : 'normal ✅ 평균 근접'
console.log(`  판정: ${level}`)
