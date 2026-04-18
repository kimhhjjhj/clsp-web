// 생산성 출처 매핑 실데이터 검증
// - API로 company-standards + CPM tasks 가져옴
// - WBS_TRADE_MAP과 교차해 각 공종별 출처(approved/proposal/default) 분포 측정

const BID_INPUT = {
  ground: 20, basement: 2, lowrise: 0, hasTransfer: false,
  siteArea: 6000, bldgArea: 30000, buildingArea: 1500,
  sitePerim: 300, bldgPerim: 220, wtBottom: 3, waBottom: 6,
}

// lib/engine/wbs-trade-map.ts 동기 복제 (ts 직접 import 불가 → 수동 미러)
// 2026-04: RC_FRAME_TRADES + SCAFFOLD_EQUIPMENT + APARTMENT_FINISH_TRADES 확장 반영
const RC_FRAME_TRADES = [
  '철콘(철근)', '철근',
  '철콘(형틀)', '형틀',
  '철콘(타설)', '콘크리트',
  '철콘(직영)',
  '갱폼', '알폼/갱폼', '시스템서포트', '데크',
]
const SCAFFOLD_EQUIPMENT = ['비계', '시스템비계', '호이스트', '타워크레인']
const APARTMENT_FINISH_TRADES = [
  '내장', '도장', '타일', '미장', '방수', '조적', '유리', '가구', '석재', '금속',
  '기계/설비', '전기/통신', '전기', '통신',
  '소방', '소방(전기)', '소방(기계)',
  '견출(습식)',
  '도배', '마루', '샤워부스', 'PL창호', '외부판넬',
  'EHP', '전열교환기', '전열교환기,에어컨', '자동제어', '도시가스',
  '엘리베이터', '기계식주차', '월패드',
  '조경',
]
const WBS_TRADE_MAP_PARTIAL = {
  '가설울타리':      ['가설울타리', '안전시설물', '직영'],
  '가설사무실':      ['가설전기', '직영', ...SCAFFOLD_EQUIPMENT],
  '가설 전기/용수':  ['가설전기', '전기/통신', '전기', '통신'],
  '부지정지':        ['토목', '직영', '부대토목', '영구배수'],
  'CIP(철근망)':     ['토목', '철콘(철근)', '철근'],
  'CIP(H-BEAM)':     ['토목', '철골'],
  '장비조립':        ['토목'],
  '캠빔 설치':       ['토목', '철골'],
  'SGR공사':         ['토목'],
  '터파기(풍화토)':  ['토목', '할석'],
  '터파기(풍화암)':  ['토목', '할석'],
  '터파기(연암)':    ['토목', '할석'],
  '기초':            RC_FRAME_TRADES,
  '지하층':          [...RC_FRAME_TRADES, '방수'],
  '지상층(저층부)':  RC_FRAME_TRADES,
  '전이층(PIT포함)': RC_FRAME_TRADES,
  '지상층(세팅층)':  RC_FRAME_TRADES,
  '지상층(기준층)':  RC_FRAME_TRADES,
  '지상층(최상층)':  RC_FRAME_TRADES,
  '공동주택마감':    APARTMENT_FINISH_TRADES,
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
