// Project.productivityAdjustments 저장·조회·삭제 검증
// 1) 임시 프로젝트 생성 (adjustments 포함)
// 2) GET /api/projects/:id → productivityAdjustments 확인
// 3) PUT로 adjustments 업데이트
// 4) 마지막 DELETE 정리

const ADJ = [
  { taskId: '18', multiplier: 1.5 },
  { taskId: '17', multiplier: 0.75 },
]

const createRes = await fetch('http://localhost:3000/api/projects', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '_verify_adjustments_' + Date.now(),
    type: '공동주택',
    ground: 20, basement: 2, lowrise: 0,
    hasTransfer: false,
    productivityAdjustments: ADJ,
  }),
})
const p = await createRes.json()
console.log(`1) POST → id=${p.id}, productivityAdjustments=${JSON.stringify(p.productivityAdjustments)}`)
if (!createRes.ok) { console.error('FAIL create', p); process.exit(1) }

const getRes = await fetch(`http://localhost:3000/api/projects/${p.id}`)
const got = await getRes.json()
console.log(`2) GET → ${JSON.stringify(got.productivityAdjustments)}`)
const matched = JSON.stringify(got.productivityAdjustments) === JSON.stringify(ADJ)
console.log(`   라운드트립 일치: ${matched ? '✅' : '❌'}`)

const NEW_ADJ = [{ taskId: '1', multiplier: 2.0 }]
const putRes = await fetch(`http://localhost:3000/api/projects/${p.id}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ productivityAdjustments: NEW_ADJ }),
})
const upd = await putRes.json()
console.log(`3) PUT → ${JSON.stringify(upd.productivityAdjustments)}`)
const updOk = JSON.stringify(upd.productivityAdjustments) === JSON.stringify(NEW_ADJ)
console.log(`   업데이트 일치: ${updOk ? '✅' : '❌'}`)

const delRes = await fetch(`http://localhost:3000/api/projects/${p.id}`, { method: 'DELETE' })
console.log(`4) DELETE status=${delRes.status}`)

process.exit(matched && updOk ? 0 : 1)
