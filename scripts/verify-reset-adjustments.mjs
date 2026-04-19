// 시나리오: 조정값이 저장된 프로젝트 → "조정 초기화" 후 업데이트
// 기대: DB의 productivityAdjustments가 빈 배열 또는 null 이 되어야 함
//       (?? undefined 때문에 기존값 유지돼버리면 = 버그)

const p = await fetch('http://localhost:3000/api/projects', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '_verify_reset_' + Date.now(),
    ground: 20, basement: 2,
    productivityAdjustments: [{ taskId: '1', multiplier: 1.5 }, { taskId: '2', multiplier: 0.8 }],
  }),
}).then(r => r.json())
console.log(`초기: ${p.productivityAdjustments?.length}건`)

// /bid UI가 '초기화' 시 보내는 형태 추정
// 현재 코드: multipliers.size > 0 ? 배열 : null
// null을 보내면 PUT의 ?? undefined 로 undefined가 되어 기존값 유지됨 → 버그!

// 1) 현재 /bid UI 동작 흉내 — null 보냄
await fetch(`http://localhost:3000/api/projects/${p.id}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ productivityAdjustments: null }),
})
const g1 = await fetch(`http://localhost:3000/api/projects/${p.id}`).then(r => r.json())
console.log(`PUT null 후: ${g1.productivityAdjustments?.length ?? 'null'}건`)
const nullBehavior = g1.productivityAdjustments?.length === 2 ? '유지됨 (의도?)' : '삭제됨'
console.log(`  → ${nullBehavior}`)

// 2) 빈 배열 보냄 — 명시적 초기화 의도
await fetch(`http://localhost:3000/api/projects/${p.id}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ productivityAdjustments: [] }),
})
const g2 = await fetch(`http://localhost:3000/api/projects/${p.id}`).then(r => r.json())
const arr = Array.isArray(g2.productivityAdjustments) ? g2.productivityAdjustments : null
console.log(`PUT [] 후: length=${arr?.length ?? 'null'}`)
const emptyOk = arr?.length === 0
console.log(`  → ${emptyOk ? '✅ 빈 배열 저장됨' : '❌ 빈 배열 저장 안 됨'}`)

await fetch(`http://localhost:3000/api/projects/${p.id}`, { method: 'DELETE' })

// 권장 동작: UI가 '초기화' 시 빈 배열을 보내면 DB도 빈 배열로 업데이트되어야 함.
// 현재 /bid 코드는 null을 보냄 → ?? undefined 로 무시. 이 경우 빈 배열로 보내도록 수정 필요.
