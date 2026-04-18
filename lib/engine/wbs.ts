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
// 기간 산정 근거 설명 (Add-on, 순수 함수)
// - 기존 calcDuration 로직을 건드리지 않고 step-by-step 풀어씀
// - UI에 툴팁·상세 패널로 표시하기 위한 데이터
// ═══════════════════════════════════════════════════════════
export interface DurationExplanation {
  formula: string           // 한 줄 요약 ("물량 100 ÷ 생산성 50 ÷ 작업률 0.666 = 기간 3일")
  steps: string[]           // 단계별 계산 과정
  assumptions: string[]     // 주의·가정 (예: 작업률의 의미)
  inputs: {                 // 원본 입력값 (UI 테이블용)
    qty: number
    unit?: string
    prod: number | null
    stdDays: number | null
    workRate: number | null
    category: string
  }
  result: number            // 최종 기간(일)
}

export interface DurationLike {
  category: string
  unit?: string | null
  prod?: number | null
  stdDays?: number | null
}

/**
 * 공종의 기간이 어떻게 계산됐는지 설명.
 * WBSTask / DBRow 둘 다 받을 수 있게 DurationLike로 추상화.
 */
export function explainDuration(row: DurationLike, qty: number): DurationExplanation {
  const rate = getWorkRate(row.category)
  const prod = row.prod ?? null
  const stdDays = row.stdDays ?? null
  const unit = row.unit ?? undefined
  const steps: string[] = []
  const assumptions: string[] = []
  let durRaw = 0
  let basis = ''

  // 1) 원시 기간 (작업률 적용 전)
  if (prod !== null && prod > 0) {
    durRaw = qty / prod
    steps.push(`① 원시 기간 = 물량 ${fmt(qty)} ${unit ?? ''} ÷ 생산성 ${prod} ${unit ?? ''}/일 = ${fmt(durRaw)}일`)
    basis = `물량 ${fmt(qty)} ÷ 생산성 ${prod}`
  } else if (stdDays !== null && stdDays > 0) {
    durRaw = qty * stdDays
    steps.push(`① 원시 기간 = 물량 ${fmt(qty)} ${unit ?? ''} × 표준일수 ${stdDays}일 = ${fmt(durRaw)}일`)
    basis = `물량 ${fmt(qty)} × 표준일수 ${stdDays}`
  } else {
    return {
      formula: '산정 불가 (생산성·표준일수 모두 없음)',
      steps: ['생산성(prod) 또는 표준일수(stdDays) 중 하나는 있어야 합니다.'],
      assumptions: [],
      inputs: { qty, unit, prod, stdDays, workRate: rate, category: row.category },
      result: 0,
    }
  }

  // 2) 작업률 적용
  let final = durRaw
  if (rate !== null && rate > 0) {
    final = durRaw / rate
    steps.push(`② 작업률 보정 = ${fmt(durRaw)}일 ÷ ${rate} (${categoryLabel(row.category)} 작업률) = ${fmt(final)}일`)
    assumptions.push(
      `작업률 ${rate}은 하루 중 실제 작업시간 비율. ${categoryLabel(row.category)} 기준 업계 평균치.`
    )
  } else {
    steps.push(`② 작업률 미적용 (${categoryLabel(row.category)}은 원시 기간 그대로)`)
    assumptions.push(`마감공사 등 일부는 작업률 보정 없이 표준일수 그대로 사용.`)
  }

  // 3) 반올림
  const rounded = Math.round(final * 10) / 10
  if (rounded !== final) {
    steps.push(`③ 소수점 1자리 반올림 → ${rounded}일`)
  }

  const formula = rate !== null && rate > 0
    ? `${basis} ÷ 작업률 ${rate} = ${rounded}일`
    : `${basis} = ${rounded}일`

  return {
    formula,
    steps,
    assumptions,
    inputs: { qty, unit, prod, stdDays, workRate: rate, category: row.category },
    result: rounded,
  }
}

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString()
  return (Math.round(n * 100) / 100).toString()
}

function categoryLabel(cat: string): string {
  if (cat.startsWith('공사준비') || cat.startsWith('토목공사')) return '공사준비·토목'
  if (cat.startsWith('골조공사')) return '골조'
  if (cat.startsWith('마감공사')) return '마감'
  return cat
}

// ═══════════════════════════════════════════════════════════
// 물량 자동 산정 (파이썬 compute_quantities()와 동일)
// ═══════════════════════════════════════════════════════════
export function computeQuantities(p: ProjectInput): Record<string, number> {
  const sitePerim = p.sitePerim ?? 0
  const bldgPerim = p.bldgPerim ?? 0
  const bldgArea  = p.bldgArea  ?? 0
  const siteArea  = p.siteArea  ?? 0
  const basement  = p.basement  ?? 0
  const ground    = p.ground    ?? 0
  const lowrise   = p.lowrise   ?? 0
  const hasTr     = p.hasTransfer
  const wtBot     = p.wtBottom  ?? 0
  const waBot     = p.waBottom  ?? 0

  // 건축면적 (1층 footprint) — 터파기·부지정지에 사용.
  // 직접 입력 > 연면적÷총층수 추정 > 대지면적×0.5(건폐율 50%) > 0
  const totalFloors = ground + basement
  const estFromBldg = bldgArea > 0 && totalFloors > 0 ? bldgArea / totalFloors : 0
  const estFromSite = siteArea > 0 ? siteArea * 0.5 : 0
  const buildingArea = p.buildingArea && p.buildingArea > 0
    ? p.buildingArea
    : estFromBldg > 0 ? estFromBldg : estFromSite

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
    '부지정지':         buildingArea,                  // 건축면적 (1층 footprint)
    'CIP(철근망)':      cipRebarLen,
    'CIP(H-BEAM)':      cipHbeamLen,
    '장비조립':         1,
    '캠빔 설치':        cambeamLen,
    'SGR공사':          sgrLen,
    '터파기(풍화토)':   buildingArea * wtDepth,        // 건축면적 × 풍화토 깊이
    '터파기(풍화암)':   buildingArea * waDepth,
    '터파기(연암)':     buildingArea * rkDepth,
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

    // 전체/개소 단위는 물량 미입력 시 1로 가정 (가설사무실·기초·마감 등)
    if (qty <= 0 && ['전체', '개소', '대', '주'].includes(row.unit)) qty = 1

    // '층' 단위는 물량이 정말 0이면 해당 공종 자체가 없는 것 → skip
    // (저층부 0층 / 전이층 없음 / 지상 0층 케이스)
    if (qty <= 0) continue

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
