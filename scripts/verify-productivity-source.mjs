// 생산성 출처 매핑 실데이터 검증
// - API로 company-standards + CPM tasks 가져옴
// - WBS_TRADE_MAP과 교차해 각 공종별 출처(approved/proposal/default) 분포 측정

const BID_INPUT = {
  ground: 20, basement: 2, lowrise: 0, hasTransfer: false,
  siteArea: 6000, bldgArea: 30000, buildingArea: 1500,
  sitePerim: 300, bldgPerim: 220, wtBottom: 3, waBottom: 6,
}

// WBS_TRADE_MAP 최소 복제 (검증용)
// 실제로는 lib/engine/wbs-trade-map.ts에 있지만 TS 직접 임포트 불가
const WBS_TRADE_MAP_PARTIAL = {
  '철근콘크리트': ['철근', '콘크리트', '형틀', '타설'],
  '지상층(기준층)': ['철근', '콘크리트', '형틀', '직영'],
  '지하층': ['철근', '콘크리트', '형틀', '직영'],
  '기초': ['철근', '콘크리트', '형틀', '토공'],
  '공동주택마감': ['내장', '타일', '도장', '창호', '석재'],
  'CIP(철근망)': ['토공', 'CIP'],
  'SGR공사': ['토공', 'SGR'],
  '터파기(풍화토)': ['토공'],
  '터파기(풍화암)': ['토공'],
  '터파기(연암)': ['토공'],
}

async function main() {
  const [stdRes, estRes] = await Promise.all([
    fetch('http://localhost:3000/api/company-standards?includeProposals=1'),
    fetch('http://localhost:3000/api/bid/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(BID_INPUT),
    }),
  ])
  const stdData = await stdRes.json()
  const estData = await estRes.json()

  // trade → { approved, sampleCount } lookup (man/day)
  const lookup = new Map()
  for (const s of stdData.standards ?? []) {
    if (s.unit === 'man/day') lookup.set(s.trade, { approved: true, count: s.sampleCount ?? 0 })
  }
  for (const c of stdData.candidates ?? []) {
    if (c.unit === 'man/day' && !lookup.has(c.trade)) {
      lookup.set(c.trade, { approved: false, count: c.totalSamples ?? 0 })
    }
  }

  console.log(`회사 표준 데이터: 승인 ${stdData.standards?.length ?? 0}종 / 제안 ${stdData.candidates?.length ?? 0}종\n`)

  const dist = { approved: 0, proposal: 0, default: 0 }
  const tasks = estData.cpm.tasks ?? []

  for (const t of tasks) {
    const tradesForTask = WBS_TRADE_MAP_PARTIAL[t.name] ?? []
    let label = 'default'
    let matched = []
    let samples = 0
    let anyProposal = false
    let allApproved = true
    let hit = false

    for (const tr of tradesForTask) {
      const m = lookup.get(tr)
      if (m) {
        hit = true
        matched.push(tr)
        samples += m.count
        if (!m.approved) { anyProposal = true; allApproved = false }
      }
    }

    if (hit) label = allApproved ? 'approved' : 'proposal'
    dist[label]++

    const mark = label === 'approved' ? '✅' : label === 'proposal' ? '🟡' : '⚪'
    console.log(
      `${mark} ${t.name.padEnd(20)} → ${label.padEnd(9)} ${
        hit ? `(${matched.join('·')} · 샘플 ${samples})` : '(CP_DB 기본값)'
      }`
    )
  }

  console.log('\n── 출처 분포 ──')
  console.log(`  ✅ 회사 승인: ${dist.approved}개`)
  console.log(`  🟡 제안(미승인): ${dist.proposal}개`)
  console.log(`  ⚪ 시스템 기본값: ${dist.default}개`)
  console.log(`  전체: ${tasks.length}개`)
}

main().catch(err => { console.error(err); process.exit(1) })
