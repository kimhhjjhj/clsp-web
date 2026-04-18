// DB에 비공종(관리·안전관리자·현장소장·감리·직원 등)으로 저장된 제안 개수 스캔
// 이들은 "공종"이 아니므로 생산성 DB에서 제외되어야 함

const NON_TRADE = new Set([
  '관리', '직영인부', '직원', '안전관리자', '현장소장', '감리',
])

const res = await fetch('http://localhost:3000/api/company-standards?includeProposals=1')
const data = await res.json()

let nonTradeProposals = 0
let nonTradeSamples = 0
const byTrade = new Map()

for (const p of data.proposals ?? []) {
  if (!NON_TRADE.has(p.trade)) continue
  nonTradeProposals++
  nonTradeSamples += p.sampleSize ?? 0
  byTrade.set(p.trade, (byTrade.get(p.trade) ?? 0) + 1)
}

console.log(`=== 비공종으로 등록된 제안 ===`)
console.log(`전체 제안: ${data.proposals?.length ?? 0}건`)
console.log(`비공종 제안: ${nonTradeProposals}건 (${nonTradeSamples}일 샘플)\n`)

for (const [trade, count] of [...byTrade.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${trade.padEnd(10)} ${count}건`)
}

// candidates 쪽도 확인
console.log(`\n=== candidates (집계)에 포함된 비공종 ===`)
let nonTradeCand = 0
for (const c of data.candidates ?? []) {
  if (!NON_TRADE.has(c.trade)) continue
  nonTradeCand++
  console.log(`  ${c.trade.padEnd(10)} 평균 ${c.avgValue} ${c.unit} (제안 ${c.proposalCount}건 · 샘플 ${c.totalSamples}일)`)
}
console.log(`총 ${nonTradeCand}종 후보 포함됨 (필터링 필요)`)
