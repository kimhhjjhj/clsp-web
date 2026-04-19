// /bid?projectId=xxx 로드·편집·PUT 저장 E2E 검증
// UI 렌더링 없이 API 레벨 왕복만 검증

// 1) 임시 프로젝트 생성
const p0 = await fetch('http://localhost:3000/api/projects', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '_verify_reopen_' + Date.now(),
    type: '공동주택',
    ground: 15, basement: 1, lowrise: 0,
    hasTransfer: false,
    productivityAdjustments: [{ taskId: '1', multiplier: 1.25 }],
  }),
}).then(r => r.json())
console.log(`1) POST → id=${p0.id}, 초기 adj=${JSON.stringify(p0.productivityAdjustments)}`)

// 2) /bid가 로드 시 GET 호출을 흉내
const loaded = await fetch(`http://localhost:3000/api/projects/${p0.id}`).then(r => r.json())
console.log(`2) GET → name=${loaded.name}, ground=${loaded.ground}, adj=${JSON.stringify(loaded.productivityAdjustments)}`)

// 3) 사용자가 UI에서 조정값 변경 후 '프로젝트 업데이트' (PUT)
const newAdj = [
  { taskId: '1', multiplier: 1.5 },
  { taskId: '18', multiplier: 0.75 },
]
const putRes = await fetch(`http://localhost:3000/api/projects/${p0.id}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: loaded.name,
    ground: 16,  // 층수도 1 증가
    basement: 1, lowrise: 0, hasTransfer: false,
    productivityAdjustments: newAdj,
  }),
})
const updated = await putRes.json()
console.log(`3) PUT → ground=${updated.ground}, adj=${JSON.stringify(updated.productivityAdjustments)}`)

// 4) 재GET — 영속 확인
const reGet = await fetch(`http://localhost:3000/api/projects/${p0.id}`).then(r => r.json())
console.log(`4) 재GET → ground=${reGet.ground}, adj=${JSON.stringify(reGet.productivityAdjustments)}`)

const pass =
  reGet.ground === 16 &&
  JSON.stringify(reGet.productivityAdjustments) === JSON.stringify(newAdj)
console.log(`\n결과: ${pass ? '✅ 로드→편집→PUT→재GET 왕복 일치' : '❌ 불일치'}`)

// 5) 정리
await fetch(`http://localhost:3000/api/projects/${p0.id}`, { method: 'DELETE' })
console.log('5) DELETE 정리 완료')

process.exit(pass ? 0 : 1)
