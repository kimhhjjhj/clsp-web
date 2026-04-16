import type { ProjectInput, WBSTask } from '@/lib/types'

// ═══════════════════════════════════════════════════════════
// CSV 데이터 — QuickPlan_생산성.csv (CP 공종, 20행)
// 파이썬 원본 build_default_tasks_csv_only() 기반
// ═══════════════════════════════════════════════════════════
export interface DBRow {
  category: string   // 대분류
  sub:      string   // 중분류
  name:     string   // 작업명
  unit:     string   // 단위
  prod:     number | null  // 생산성 (단위당 처리량)
  stdDays:  number | null  // 소요기간(일) (단위당 일수)
  wbsCode?: string
}

const CP_DB: DBRow[] = [
  { category: '공사준비', sub: '공통가설', name: '가설울타리',       unit: 'm',   prod: 115,  stdDays: null, wbsCode: 'T.1.1' },
  { category: '공사준비', sub: '공통가설', name: '가설사무실',       unit: '개소', prod: 8,    stdDays: null, wbsCode: 'T.1.2' },
  { category: '공사준비', sub: '공통가설', name: '가설 전기/용수',   unit: '전체', prod: null, stdDays: 5,   wbsCode: 'T.1.3' },
  { category: '공사준비', sub: '공통가설', name: '부지정지',         unit: 'm2',  prod: 1000, stdDays: null, wbsCode: 'T.1.4' },
  { category: '토목공사', sub: '흙막이공사', name: 'CIP(철근망)',    unit: 'm',   prod: 100,  stdDays: null, wbsCode: 'C.1.1' },
  { category: '토목공사', sub: '흙막이공사', name: 'CIP(H-BEAM)',   unit: 'm',   prod: 70,   stdDays: null, wbsCode: 'C.1.2' },
  { category: '토목공사', sub: '흙막이공사', name: '장비조립',       unit: '전체', prod: null, stdDays: 5,   wbsCode: 'C.1.3' },
  { category: '토목공사', sub: '흙막이공사', name: '캠빔 설치',      unit: 'm',   prod: 30,   stdDays: null, wbsCode: 'C.1.4' },
  { category: '토목공사', sub: '차수공사',   name: 'SGR공사',        unit: 'm',   prod: 300,  stdDays: null, wbsCode: 'C.2.1' },
  { category: '토목공사', sub: '토공사',     name: '터파기(풍화토)', unit: 'm3',  prod: 350,  stdDays: null, wbsCode: 'C.3.1' },
  { category: '토목공사', sub: '토공사',     name: '터파기(풍화암)', unit: 'm3',  prod: 250,  stdDays: null, wbsCode: 'C.3.2' },
  { category: '토목공사', sub: '토공사',     name: '터파기(연암)',   unit: 'm3',  prod: 150,  stdDays: null, wbsCode: 'C.3.3' },
  { category: '골조공사', sub: '골조공사',   name: '기초',           unit: '전체', prod: null, stdDays: 20,  wbsCode: 'A.1.1' },
  { category: '골조공사', sub: '골조공사',   name: '지하층',         unit: '층',  prod: null, stdDays: 25,  wbsCode: 'A.1.2' },
  { category: '골조공사', sub: '골조공사',   name: '지상층(저층부)', unit: '층',  prod: null, stdDays: 15,  wbsCode: 'A.1.3' },
  { category: '골조공사', sub: '골조공사',   name: '전이층(PIT포함)', unit: '층', prod: null, stdDays: 30,  wbsCode: 'A.1.4' },
  { category: '골조공사', sub: '골조공사',   name: '지상층(세팅층)', unit: '층',  prod: null, stdDays: 20,  wbsCode: 'A.1.5' },
  { category: '골조공사', sub: '골조공사',   name: '지상층(기준층)', unit: '층',  prod: null, stdDays: 7,   wbsCode: 'A.1.6' },
  { category: '골조공사', sub: '골조공사',   name: '지상층(최상층)', unit: '층',  prod: null, stdDays: 10,  wbsCode: 'A.1.7' },
  { category: '마감공사', sub: '공동주택',   name: '공동주택마감',   unit: '전체', prod: null, stdDays: 210, wbsCode: 'A.2.1' },
]

// ═══════════════════════════════════════════════════════════
// 가동률 (파이썬 WORK_RATES와 동일)
// 공사준비/토목: 66.6%, 골조: 63.2%, 마감: None(적용 안 함)
// ═══════════════════════════════════════════════════════════
export function getWorkRate(category: string): number | null {
  if (category.startsWith('공사준비')) return 0.666
  if (category.startsWith('토목공사')) return 0.666
  if (category.startsWith('골조공사')) return 0.632
  if (category.startsWith('마감공사')) return null  // 별도 산정 (raw 그대로)
  return 1.0
}

// ═══════════════════════════════════════════════════════════
// 기간 계산 (파이썬 calc_duration과 동일)
// 생산성 있으면: qty / prod / work_rate
// 소요기간 있으면: qty * stdDays / work_rate
// ═══════════════════════════════════════════════════════════
export function calcDuration(row: DBRow, qty: number): number {
  const rate = getWorkRate(row.category)
  let durRaw = 0

  if (row.prod !== null && row.prod > 0) {
    durRaw = qty / row.prod
  } else if (row.stdDays !== null && row.stdDays > 0) {
    durRaw = qty * row.stdDays
  } else {
    return 0
  }

  if (rate !== null && rate > 0) {
    return Math.round(durRaw / rate * 10) / 10  // 소수점 1자리
  }
  return Math.round(durRaw * 10) / 10
}

// ═══════════════════════════════════════════════════════════
// 물량 자동 산정 (파이썬 compute_quantities()와 동일)
// ═══════════════════════════════════════════════════════════
export function computeQuantities(p: ProjectInput): Record<string, number> {
  const sitePerim = p.sitePerim ?? 0
  const bldgPerim = p.bldgPerim ?? 0
  const bldgArea  = p.bldgArea  ?? 0
  const basement  = p.basement  ?? 0
  const ground    = p.ground    ?? 0
  const lowrise   = p.lowrise   ?? 0
  const hasTr     = p.hasTransfer
  const wtBot     = p.wtBottom  ?? 0
  const waBot     = p.waBottom  ?? 0

  // 지하층 굴착 깊이 (층당 3.5m + 기초 1.0m)
  const totalExc = basement > 0 ? basement * 3.5 + 1.0 : 0
  const wtDepth  = Math.min(wtBot, totalExc)
  const waDepth  = Math.max(0, Math.min(waBot, totalExc) - wtDepth)
  const rkDepth  = Math.max(0, totalExc - wtDepth - waDepth)

  // 흙막이 물량
  const cipCnt      = bldgPerim > 0 ? Math.floor(bldgPerim / 0.5) : 0
  const cipRebarCnt = Math.floor(cipCnt * 2 / 3)
  const cipHbeamCnt = cipCnt - cipRebarCnt
  const cipRebarLen = cipRebarCnt * (wtBot + 1)
  const cipHbeamLen = cipHbeamCnt * (totalExc + 2)
  const sgrCount    = sitePerim > 0 ? Math.floor(sitePerim / 0.5) : 0
  const phtoDepth   = totalExc > 0 ? totalExc * 0.5 : 0
  const sgrLen      = sgrCount * (phtoDepth + 1)
  const cambeamLen  = Math.floor(bldgPerim)

  // 골조 층 수 분류
  const numSetting  = ground > 0 ? 1 : 0
  const numTop      = ground > 0 ? 1 : 0
  const numStandard = Math.max(0, ground - lowrise - numSetting - numTop)

  return {
    '가설울타리':       sitePerim,
    '가설사무실':       8,
    '가설 전기/용수':   1,
    '부지정지':         bldgArea,
    'CIP(철근망)':      cipRebarLen,
    'CIP(H-BEAM)':      cipHbeamLen,
    '장비조립':         1,
    '캠빔 설치':        cambeamLen,
    'SGR공사':          sgrLen,
    '터파기(풍화토)':   bldgArea * wtDepth,
    '터파기(풍화암)':   bldgArea * waDepth,
    '터파기(연암)':     bldgArea * rkDepth,
    '기초':             1,
    '지하층':           basement,
    '지상층(저층부)':   lowrise,
    '전이층(PIT포함)':  hasTr ? 1 : 0,
    '지상층(세팅층)':   numSetting,
    '지상층(기준층)':   numStandard,
    '지상층(최상층)':   numTop,
    '공동주택마감':     1,
  }
}

// ═══════════════════════════════════════════════════════════
// WBS 자동 생성 — 파이썬 build_default_tasks_csv_only() 포팅
// 선후행: 단순 순차 (각 작업의 선행 = 바로 앞 작업)
// 물량 0이거나 기간 0인 작업은 제외
// ═══════════════════════════════════════════════════════════
export function generateWBS(p: ProjectInput): WBSTask[] {
  const qtys  = computeQuantities(p)
  const tasks: WBSTask[] = []
  let nextId  = 1
  let prevId  = ''

  for (const row of CP_DB) {
    // 물량 결정
    let qty = qtys[row.name] ?? 0

    // 단위가 '층'인데 물량이 없으면 ground 층수로 대체
    if (qty <= 0 && row.unit === '층') qty = Math.max(1, p.ground)
    // 전체/개소/전체 단위는 1
    if (qty <= 0 && ['전체', '개소', '대', '주'].includes(row.unit)) qty = 1

    if (qty <= 0) continue  // 물량 없으면 건너뜀

    const dur = calcDuration(row, qty)
    if (dur <= 0) continue  // 기간 0이면 건너뜀

    const tid = String(nextId++)
    tasks.push({
      id:           tid,
      wbsCode:      row.wbsCode,
      name:         row.name,
      category:     row.category,
      subcategory:  row.sub,
      unit:         row.unit,
      quantity:     qty,
      productivity: row.prod !== null ? String(row.prod) : undefined,
      stdDays:      row.stdDays !== null ? String(row.stdDays) : undefined,
      duration:     Math.max(0.1, dur),
      predecessors: prevId ? [prevId] : [],
    })
    prevId = tid
  }

  return tasks
}
