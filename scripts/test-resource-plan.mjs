// 서버 API를 통해 CPM 계산 → 자원 계획 엔진 검증
const BASE = 'http://localhost:3000'
const PROJECT_ID = process.argv[2] || 'cmo2tduw701khodbn4xzhri5d'

async function main() {
  // 1) CPM 계산
  const cpmRes = await fetch(`${BASE}/api/projects/${PROJECT_ID}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'cp' }),
  })
  const cpm = await cpmRes.json()
  console.log(`CPM 계산 완료: ${cpm.tasks.length}개 공종, 총공기 ${cpm.totalDuration}일`)

  // 2) 표준 조회
  const stdRes = await fetch(`${BASE}/api/company-standards?includeProposals=1`)
  const stdData = await stdRes.json()
  const stds = []
  for (const s of stdData.standards ?? []) {
    stds.push({ trade: s.trade, unit: s.unit, value: s.value, approved: true, sampleCount: s.sampleCount })
  }
  for (const c of stdData.candidates ?? []) {
    if (!stds.some(x => x.trade === c.trade && x.unit === c.unit)) {
      stds.push({ trade: c.trade, unit: c.unit, value: c.avgValue, approved: false, sampleCount: c.totalSamples })
    }
  }
  console.log(`표준 후보: ${stds.length}개`)

  // 3) 엔진 임포트 (절대경로 file://)
  const path = await import('node:path')
  const { pathToFileURL } = await import('node:url')
  const url = pathToFileURL(path.resolve('lib/engine/resource-plan.ts')).href
  // TS를 직접 import할 수 없으므로 tsx 없이 동작하려면 엔진 로직을 직접 재구현하거나 API로 노출
  // 여기서는 간단히 CPMResult에 ES/EF 있으니 직접 계산 검증

  // 수동 재현: 각 task에 대해 WBS_TRADE_MAP 매핑
  const { WBS_TRADE_MAP } = await import('../lib/engine/wbs-trade-map.ts').catch(() => null) ?? {}
  console.log('엔진 직접 import 실패 — 대체로 API 응답만 검증')

  // 간단히 가능한 수준까지: task ES/EF 분포
  const totalDur = cpm.totalDuration
  console.log(`\n처음 5개 공종 ES/EF:`)
  cpm.tasks.slice(0, 5).forEach(t => {
    console.log(`  ${t.name.padEnd(20)} ES=${t.ES} EF=${t.EF} dur=${t.duration} ${t.isCritical?'CP':''}`)
  })
  console.log(`\n... 마지막 5개:`)
  cpm.tasks.slice(-5).forEach(t => {
    console.log(`  ${t.name.padEnd(20)} ES=${t.ES} EF=${t.EF} dur=${t.duration} ${t.isCritical?'CP':''}`)
  })

  // std lookup 만들어서 간단 합산
  const stdMap = new Map()
  for (const s of stds) if (s.unit === 'man/day') stdMap.set(s.trade, s.value)

  // 공종 매핑 (하드코드 사본)
  const RC = ['철콘(철근)','철근','철콘(형틀)','형틀','철콘(타설)','콘크리트','철콘(직영)']
  const WBS_MAP = {
    '가설울타리': ['가설울타리','안전시설물','직영'],
    '가설사무실': ['가설전기','직영'],
    '가설 전기/용수': ['가설전기','전기/통신','전기','통신'],
    '부지정지': ['토목','직영'],
    'CIP(철근망)': ['토목','철콘(철근)','철근'],
    'CIP(H-BEAM)': ['토목','철골'],
    '장비조립': ['토목'],
    '캠빔 설치': ['토목','철골'],
    'SGR공사': ['토목'],
    '터파기(풍화토)': ['토목','할석'],
    '터파기(풍화암)': ['토목','할석'],
    '터파기(연암)': ['토목','할석'],
    '기초': RC,
    '지하층': [...RC, '방수'],
    '지상층(저층부)': RC,
    '전이층(PIT포함)': RC,
    '지상층(세팅층)': RC,
    '지상층(기준층)': RC,
    '지상층(최상층)': RC,
    '공동주택마감': ['내장','도장','타일','미장','방수','조적','유리','가구','석재','금속','기계/설비','전기/통신','전기','통신','소방','소방(전기)','소방(기계)','견출(습식)'],
  }

  // 일별 합산
  const days = []
  let totalMD = 0
  let peak = { d: 0, count: 0 }
  const uncovered = new Set()
  for (let d = 0; d < totalDur; d++) {
    let dayTotal = 0
    const tradeAgg = new Map()
    for (const t of cpm.tasks) {
      if (!(t.ES <= d && d < t.EF)) continue
      const related = WBS_MAP[t.name] ?? []
      const hits = related.filter(tr => stdMap.has(tr))
      if (hits.length === 0 && related.length > 0) uncovered.add(t.name)
      for (const tr of hits) {
        const v = stdMap.get(tr)
        tradeAgg.set(tr, (tradeAgg.get(tr) ?? 0) + v)
        dayTotal += v
      }
    }
    days.push({ d, total: Math.round(dayTotal * 10) / 10, trades: tradeAgg.size })
    totalMD += dayTotal
    if (dayTotal > peak.count) peak = { d, count: dayTotal }
  }

  console.log(`\n=== 자원 계획 요약 ===`)
  console.log(`총 공기: ${totalDur}일`)
  console.log(`피크: ${peak.d+1}일차에 ${Math.round(peak.count*10)/10}명`)
  console.log(`일평균: ${Math.round(totalMD/totalDur*10)/10}명`)
  console.log(`총 인일: ${Math.round(totalMD)}`)
  console.log(`미커버 공종 (${uncovered.size}): ${[...uncovered].join(', ')}`)

  console.log(`\n첫 7일 표본:`)
  days.slice(0, 7).forEach(x => console.log(`  D${x.d+1}: 총${x.total}명 ${x.trades}종 공종`))
  console.log(`\n피크 주변 ±2일:`)
  for (let k = Math.max(0, peak.d-2); k <= Math.min(days.length-1, peak.d+2); k++) {
    console.log(`  D${k+1}${k===peak.d?'★':' '}: 총${days[k].total}명 ${days[k].trades}종`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
