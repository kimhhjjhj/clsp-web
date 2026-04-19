// PUT /api/projects/:id 시 lastCpmDuration 반영 검증
// 시나리오: /bid에서 조정 적용 → 새 총공기로 DB 업데이트

// 1) 임시 프로젝트 생성
const p = await fetch('http://localhost:3000/api/projects', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '_verify_put_cpm_' + Date.now(),
    type: '공동주택',
    ground: 20, basement: 2, lowrise: 0, hasTransfer: false,
    lastCpmDuration: 500,
  }),
}).then(r => r.json())
console.log(`1) POST → lastCpmDuration=${p.lastCpmDuration}`)

// 2) PUT으로 duration 수정 (사용자가 조정해서 줄어든 경우)
const upd = await fetch(`http://localhost:3000/api/projects/${p.id}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: p.name, ground: 20, basement: 2, lowrise: 0, hasTransfer: false,
    lastCpmDuration: 420,
  }),
}).then(r => r.json())
console.log(`2) PUT → lastCpmDuration=${upd.lastCpmDuration}`)

// 3) 재GET 확인
const re = await fetch(`http://localhost:3000/api/projects/${p.id}`).then(r => r.json())
console.log(`3) 재GET → lastCpmDuration=${re.lastCpmDuration}`)

// 4) lastCpmDuration 없이 PUT → 기존 값 유지 (덮어쓰기 방지)
const noDur = await fetch(`http://localhost:3000/api/projects/${p.id}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: p.name, ground: 20, basement: 2, lowrise: 0, hasTransfer: false,
    // lastCpmDuration 생략
  }),
}).then(r => r.json())
console.log(`4) PUT(생략) → lastCpmDuration=${noDur.lastCpmDuration} (420 유지 기대)`)

// 5) 정리
await fetch(`http://localhost:3000/api/projects/${p.id}`, { method: 'DELETE' })

const pass = re.lastCpmDuration === 420 && noDur.lastCpmDuration === 420
console.log(`\n결과: ${pass ? '✅ PUT 시 duration 반영 + 미전달 시 유지' : '❌'}`)
process.exit(pass ? 0 : 1)
