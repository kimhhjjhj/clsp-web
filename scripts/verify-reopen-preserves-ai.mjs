// /bid?projectId=xxx 재편집 흐름이 기존 aiCostEstimate를 보존하는지 검증
// 시나리오:
// 1) POST로 프로젝트 생성 + aiCostEstimate 저장
// 2) /bid PUT 흉내 — aiCostEstimate 없이 재저장 (현재 UI가 그렇게 함)
// 3) 재GET해서 aiCostEstimate 보존됐는지 확인

const AI = {
  summary: { grandTotalKRW: 100_000_000, pricePerPyongKRW: 3_000_000, pricePerSqmKRW: 900_000 },
  trades: [{ name: '골조', totalKRW: 50_000_000 }],
  estimatedAt: '2026-04-19T00:00:00.000Z',
}

const p = await fetch('http://localhost:3000/api/projects', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '_verify_ai_preserve_' + Date.now(),
    type: '공동주택',
    ground: 20, basement: 2, lowrise: 0, hasTransfer: false,
    bldgArea: 30000,
    aiCostEstimate: AI,
  }),
}).then(r => r.json())
console.log(`1) POST id=${p.id}  aiCostEstimate.grandTotal=${p.aiCostEstimate?.summary?.grandTotalKRW}`)

// 2) /bid 재편집 플로우 흉내 — aiCostEstimate: null 보냄 (현재 코드)
const put = await fetch(`http://localhost:3000/api/projects/${p.id}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: p.name, ground: 20, basement: 2, lowrise: 0, hasTransfer: false,
    bldgArea: 30000,
    aiCostEstimate: null,   // ← UI가 aiEstimate 복원 안하므로 null 보냄 (추정)
    productivityAdjustments: [{ taskId: '1', multiplier: 1.5 }],
    lastCpmDuration: 700,
  }),
}).then(r => r.json())
console.log(`2) PUT 응답 aiCostEstimate:`, put.aiCostEstimate === null ? '<null>' : (put.aiCostEstimate?.summary ? 'EXISTS' : '?'))

// 3) 재GET
const got = await fetch(`http://localhost:3000/api/projects/${p.id}`).then(r => r.json())
console.log(`3) 재GET aiCostEstimate:`, got.aiCostEstimate === null ? '<null — 날아감!>' : (got.aiCostEstimate?.summary ? 'EXISTS - 보존됨' : '?'))

await fetch(`http://localhost:3000/api/projects/${p.id}`, { method: 'DELETE' })

const preserved = got.aiCostEstimate && got.aiCostEstimate.summary
console.log(`\n결과: ${preserved ? '✅ 보존됨' : '❌ null로 덮어써짐 (버그)'}`)
process.exit(preserved ? 0 : 1)
