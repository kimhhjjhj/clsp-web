// 재추정 시 AI 값이 PUT으로 실제 반영되는지

const V1 = { summary: { grandTotalKRW: 100_000_000 }, trades: [], estimatedAt: '2026-04-19T00:00:00Z' }
const V2 = { summary: { grandTotalKRW: 150_000_000 }, trades: [], estimatedAt: '2026-04-19T12:00:00Z' }

const p = await fetch('http://localhost:3000/api/projects', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '_verify_ai_update_' + Date.now(), ground: 20, basement: 2, aiCostEstimate: V1 }),
}).then(r => r.json())
console.log(`POST V1 = ${p.aiCostEstimate?.summary?.grandTotalKRW}`)

await fetch(`http://localhost:3000/api/projects/${p.id}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ aiCostEstimate: V2 }),
})

const re = await fetch(`http://localhost:3000/api/projects/${p.id}`).then(r => r.json())
const reValue = re.aiCostEstimate?.summary?.grandTotalKRW
console.log(`PUT V2 후 재GET = ${reValue}`)

const pass = reValue === 150_000_000
console.log(pass ? '✅ AI 재추정 반영됨' : `❌ 반영 안 됨 (실제 ${reValue})`)

await fetch(`http://localhost:3000/api/projects/${p.id}`, { method: 'DELETE' })
process.exit(pass ? 0 : 1)
