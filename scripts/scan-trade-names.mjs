// 제안 DB와 일보에 실제 등장하는 모든 trade 이름 스캔
// WBS_TRADE_MAP 매핑 추가 후보 도출용
// 2026-04: 실제 wbs-trade-map.ts와 동기화 (수동 미러 — ts 직접 import 불가)

const stdRes = await fetch('http://localhost:3000/api/company-standards?includeProposals=1')
const stdData = await stdRes.json()

// lib/engine/wbs-trade-map.ts 의 모든 값 (RC_FRAME + SCAFFOLD + APARTMENT_FINISH + 개별 매핑)
const CURRENT_MAPPED = new Set([
  // 공사준비
  '가설울타리', '안전시설물', '직영',
  '가설전기', '전기/통신', '전기', '통신',
  '토목', '부대토목', '영구배수',
  // 토목
  '철골', '할석',
  // RC 골조 (파주 + 상봉 + 보조재)
  '철콘(철근)', '철근',
  '철콘(형틀)', '형틀',
  '철콘(타설)', '콘크리트',
  '철콘(직영)',
  '갱폼', '알폼/갱폼', '시스템서포트', '데크',
  '방수',
  // 가설 장비
  '비계', '시스템비계', '호이스트', '타워크레인',
  // 공동주택 마감 27종
  '내장', '도장', '타일', '미장', '조적', '유리', '가구', '석재', '금속',
  '기계/설비', '소방', '소방(전기)', '소방(기계)',
  '견출(습식)',
  '도배', '마루', '샤워부스', 'PL창호', '외부판넬',
  'EHP', '전열교환기', '전열교환기,에어컨', '자동제어', '도시가스',
  '엘리베이터', '기계식주차', '월패드',
  '조경',
  '준공청소', '해체/정리',
])

// 비공종 (매핑 제외)
const NON_TRADE = new Set([
  '관리', '직영인부', '직원', '안전관리자', '현장소장', '감리',
])

const allTrades = new Set()
for (const s of stdData.standards ?? []) allTrades.add(s.trade)
for (const c of stdData.candidates ?? []) allTrades.add(c.trade)

const unmapped = []
const nonTrade = []

for (const t of allTrades) {
  if (NON_TRADE.has(t)) { nonTrade.push(t); continue }
  if (CURRENT_MAPPED.has(t)) continue
  unmapped.push(t)
}

console.log(`=== 전체 trade ${allTrades.size}종 ===`)
console.log(`매핑 있음: ${allTrades.size - unmapped.length - nonTrade.length}종`)
console.log(`매핑 없음 (추가 후보): ${unmapped.length}종`)
console.log(`비공종 제외: ${nonTrade.length}종\n`)

console.log('── 매핑 추가 후보 (확인 필요) ──')
for (const t of unmapped.sort()) {
  // 제안 DB에서 샘플 수 조회
  const cand = stdData.candidates?.find(c => c.trade === t)
  const approved = stdData.standards?.find(s => s.trade === t)
  const samples = (approved?.sampleCount ?? 0) + (cand?.totalSamples ?? 0)
  const projects = cand?.projectCount ?? (approved ? 1 : 0)
  console.log(`  ${t.padEnd(20)} 샘플 ${samples}일 / 프로젝트 ${projects}개`)
}

console.log('\n── 비공종 (제외됨) ──')
for (const t of nonTrade.sort()) console.log(`  ${t}`)
