// /bid saveAsProject → Task seed → GET 로 조회 → 벤치마크 API 반영 확인
// 전체 플로우를 API 레벨로 검증

const BID = {
  ground: 20, basement: 2, lowrise: 0, hasTransfer: false,
  siteArea: 6000, bldgArea: 30000, buildingArea: 1500,
  sitePerim: 300, bldgPerim: 220, wtBottom: 3, waBottom: 6,
}

// 1) /bid estimate로 CPM 결과 받기
const est = await fetch('http://localhost:3000/api/bid/estimate', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(BID),
}).then(r => r.json())
console.log(`1) estimate → totalDuration=${est.cpm.totalDuration}, tasks=${est.cpm.tasks.length}`)

// 2) saveAsProject 흉내 — Task 시드 포함
const createRes = await fetch('http://localhost:3000/api/projects', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '_verify_task_seed_' + Date.now(),
    type: '공동주택',
    ...BID,
    lastCpmDuration: est.cpm.totalDuration,
    tasks: est.cpm.tasks.map(t => ({
      name: t.name, category: t.category, duration: t.duration,
      subcategory: t.subcategory, unit: t.unit, quantity: t.quantity,
      productivity: t.productivity, stdDays: t.stdDays, wbsCode: t.wbsCode,
    })),
  }),
})
const p = await createRes.json()
console.log(`2) POST → id=${p.id}, tasks 저장 ${p.tasks?.length}개`)
if (!p.tasks || p.tasks.length !== est.cpm.tasks.length) {
  console.error('❌ Task 개수 불일치')
  process.exit(1)
}

// 3) GET /api/projects/:id → tasks 확인
const got = await fetch(`http://localhost:3000/api/projects/${p.id}`).then(r => r.json())
console.log(`3) GET → tasks=${got.tasks.length}개, 첫 공종="${got.tasks[0].name}" ${got.tasks[0].duration}일`)

// 4) /api/benchmark/tasks?type=공동주택&exclude=방금생성한id 하면 기존 벤치마크
const benchBefore = await fetch('http://localhost:3000/api/benchmark/tasks?type=' + encodeURIComponent('공동주택') + '&exclude=' + p.id).then(r => r.json())
// 반대로 exclude 안 하면 새 Task도 포함됨
const benchWith = await fetch('http://localhost:3000/api/benchmark/tasks?type=' + encodeURIComponent('공동주택')).then(r => r.json())
const diff = benchWith.count - benchBefore.count
console.log(`4) 벤치마크 API:`)
console.log(`   exclude=${p.id}: ${benchBefore.count}공종`)
console.log(`   포함: ${benchWith.count}공종 (Δ${diff >= 0 ? '+' : ''}${diff})`)

// 5) 정리
await fetch(`http://localhost:3000/api/projects/${p.id}`, { method: 'DELETE' })
console.log(`5) DELETE 정리`)

const pass = p.tasks.length === est.cpm.tasks.length && got.tasks.length === est.cpm.tasks.length
console.log(`\n결과: ${pass ? '✅ Task 시드 저장·조회·벤치마크 반영 확인' : '❌'}`)
process.exit(pass ? 0 : 1)
