// ═══════════════════════════════════════════════════════════
// 유형별 개략 공사비 프리셋 (2026-04 시점 · 한국 건설시세)
//
// 출처 참고:
// - 국토부 건설공사 표준품셈 2025
// - 대한건설협회 시중노임단가 2025-하반기
// - 업계 실거래 평균 (공동주택 RC 25~30층 · 수도권)
//
// 전략: CPM 공종 물량 + 유형별 단가 표 → 물량×단가 방식으로
//       AI API 없이도 바로 Trade/Item/Summary 구조 생성
// ═══════════════════════════════════════════════════════════

import type { CPMResult } from './types'

export interface CostItem {
  name: string
  qty: number
  unit: string
  unitPriceKRW: number
  subtotalKRW: number
}

export interface CostTrade {
  category: string
  items: CostItem[]
  categorySubtotalKRW: number
}

export interface CostSummary {
  directCostKRW: number
  indirectCostKRW: number
  generalAdminKRW: number
  profitKRW: number
  vatKRW: number
  grandTotalKRW: number
  pricePerSqmKRW: number
  pricePerPyongKRW: number
}

export interface CostResult {
  trades: CostTrade[]
  summary: CostSummary
  notes: string
  source: 'preset' | 'ai'
}

// 단가 테이블 — 기준 단위당 직접공사비(원, 자재+노무+경비 일체)
// 2026-04 기준 · 수도권 공동주택 RC 20~30층 평균 실거래
// 출처: 표준품셈 · 시중노임단가 2025H2 · 건자재 물가(한국건설기술연구원)
export const UNIT_PRICES: Record<string, { unit: string; price: number; label: string }> = {
  // 골조 (RC = 철근·거푸집·콘크리트·노무 일체)
  'RC':              { unit: '㎥',   price: 1_050_000, label: '철근콘크리트 (철근+콘크리트+거푸집+노무 일체)' },
  '거푸집':          { unit: '㎡',   price: 85_000,   label: '거푸집 (유로폼·알폼 평균)' },
  '철근':            { unit: 'ton',  price: 1_700_000, label: '철근 (SD400 자재+가공+조립)' },
  '레미콘':          { unit: '㎥',   price: 135_000,  label: '레미콘 25MPa (자재+타설)' },
  // 토공
  '터파기':          { unit: '㎥',   price: 32_000,   label: '터파기 (굴착+운반+처리)' },
  '흙막이':          { unit: '㎡',   price: 480_000,  label: 'CIP 흙막이 (D500 기준)' },
  // 마감 (공동주택 준공 기준)
  '내장':            { unit: '㎡',   price: 290_000,  label: '내장 (석고보드+도배+몰딩 일체)' },
  '도장':            { unit: '㎡',   price: 65_000,   label: '도장 (수성·유성 평균)' },
  '타일':            { unit: '㎡',   price: 220_000,  label: '타일 (욕실·주방, 자재+시공)' },
  '미장':            { unit: '㎡',   price: 58_000,   label: '미장' },
  '방수':            { unit: '㎡',   price: 95_000,   label: '방수 (옥상·화장실·지하 평균)' },
  '석재':            { unit: '㎡',   price: 480_000,  label: '석재 마감 (화강석)' },
  '창호':            { unit: '㎡',   price: 680_000,  label: 'PL 창호 (시스템창호 단열바)' },
  '도배':            { unit: '㎡',   price: 32_000,   label: '도배' },
  '마루':            { unit: '㎡',   price: 240_000,  label: '마루 (강마루)' },
  // 설비·전기
  '기계설비':        { unit: '㎡',   price: 260_000,  label: '기계·위생·공조 (연면적당)' },
  '전기':            { unit: '㎡',   price: 175_000,  label: '전기 (배선·콘센트·조명 일체)' },
  '통신':            { unit: '㎡',   price: 52_000,   label: '통신 (LAN·방송·CCTV)' },
  '소방':            { unit: '㎡',   price: 95_000,   label: '소방 (스프링클러·경보·제연)' },
  '엘리베이터':      { unit: '대',   price: 95_000_000, label: '엘리베이터 1대 (15인승)' },
  'EHP':             { unit: '대',   price: 4_500_000, label: 'EHP 실외기 1대' },
  // 외부·조경
  '조경':            { unit: '㎡',   price: 150_000,  label: '조경 (대지면적 - 건축면적)' },
  '포장':            { unit: '㎡',   price: 120_000,  label: '외부 포장 (아스콘·보도블럭)' },
  // 가설
  '비계':            { unit: '㎡',   price: 45_000,   label: '외부 비계 (연면적 환산)' },
  '가설전기':        { unit: '식',   price: 35_000_000, label: '가설전기 일체' },
  '가설사무실':      { unit: '식',   price: 50_000_000, label: '가설사무실·창고 일체' },
  // 데이터센터 전용 (Tier III 기준, 2026-Q2)
  'DC_UPS':           { unit: 'kVA',  price: 850_000,       label: 'UPS 시스템 (kVA당, 배터리·Switchgear 포함)' },
  'DC_발전기':        { unit: 'kW',   price: 450_000,       label: '디젤발전기 (kW당, 연료탱크·배관 포함)' },
  'DC_CRAC':          { unit: '대',   price: 85_000_000,    label: '정밀공조 CRAC 50kW급' },
  'DC_수배전':        { unit: 'MVA',  price: 180_000_000,   label: '수변전 (MVA당, 변압기·AS·MCSG)' },
  'DC_FM200':         { unit: '식',   price: 180_000_000,   label: 'FM-200/Inergen 자동소화 (홀 단위)' },
  'DC_RMS_BMS':       { unit: '식',   price: 250_000_000,   label: 'RMS/BMS 모니터링 시스템' },
  'DC_보안':          { unit: '식',   price: 120_000_000,   label: '보안 (카드리더·CCTV·생체인증)' },
  'DC_PowerDist':     { unit: '랙',   price: 12_000_000,    label: 'PDU/RPP 분전 (IT랙당)' },
  'DC_액세스바닥':    { unit: '㎡',   price: 280_000,       label: '액세스플로어 (데이터홀)' },
}

export type PriceKey = string

// 유형별 계수 — 연면적당 추가 아이템의 구성비 조정
export interface TypePreset {
  label: string
  finishMultiplier: number   // 마감 단가 배율 (오피스텔은 공동주택보다 다소 높음)
  mepMultiplier: number      // 기계설비 배율 (데센은 50% 이상 ↑)
  electricMultiplier: number // 전기 배율
  structureMultiplier: number// 골조 배율
  notes: string
}

export const TYPE_PRESETS: Record<string, TypePreset> = {
  '공동주택': {
    label: '공동주택 (아파트·주상복합 25~30층 기준)',
    finishMultiplier: 1.0, mepMultiplier: 1.0, electricMultiplier: 1.0, structureMultiplier: 1.0,
    notes: '내장·창호 비중 큼. 세대 수 많을수록 반복 단가 이점.',
  },
  '오피스텔': {
    label: '오피스텔',
    finishMultiplier: 1.15, mepMultiplier: 1.1, electricMultiplier: 1.05, structureMultiplier: 1.0,
    notes: '마감 등급·발코니 확장 불가 등 세부 공정 증가.',
  },
  '업무시설': {
    label: '업무시설 (오피스)',
    finishMultiplier: 0.85, mepMultiplier: 1.2, electricMultiplier: 1.15, structureMultiplier: 1.05,
    notes: '커튼월·MEP 비중 ↑. 내장 마감 스펙은 공동주택보다 낮음.',
  },
  '데이터센터': {
    label: '데이터센터 (Tier III 기준)',
    finishMultiplier: 0.5, mepMultiplier: 3.5, electricMultiplier: 3.0, structureMultiplier: 1.2,
    notes: '전기·공조·UPS 중심. 마감 비중 낮음. Tier 등급 올라갈수록 급상승.',
  },
  '연구시설': {
    label: '연구시설·R&D',
    finishMultiplier: 1.0, mepMultiplier: 1.6, electricMultiplier: 1.3, structureMultiplier: 1.1,
    notes: '클린룸·특수 설비 영향.',
  },
  '병원': {
    label: '병원·의료시설',
    finishMultiplier: 1.2, mepMultiplier: 1.8, electricMultiplier: 1.4, structureMultiplier: 1.1,
    notes: '방사선실·수술실 등 특수구역 다수.',
  },
  '근린생활': {
    label: '근린생활시설',
    finishMultiplier: 0.9, mepMultiplier: 0.9, electricMultiplier: 0.9, structureMultiplier: 0.95,
    notes: '일반 상가·점포 수준.',
  },
}

// CPM 공종 → 단가 테이블 키 매핑
function mapTaskToPrice(taskName: string, category: string): PriceKey | null {
  const n = taskName
  // 골조
  if (/철근/.test(n) && !/망/.test(n)) return '철근'
  if (/콘크리트|타설/.test(n)) return 'RC'
  if (/형틀|거푸집/.test(n)) return '거푸집'
  if (/기초|지하층|지상층|전이층/.test(n)) return 'RC'
  // 토공
  if (/터파기/.test(n)) return '터파기'
  if (/CIP|흙막이|가시설/.test(n)) return '흙막이'
  // 가설
  if (/가설울타리|안전시설/.test(n)) return '비계'
  if (/가설 전기|가설전기/.test(n)) return '가설전기'
  if (/가설사무실/.test(n)) return '가설사무실'
  // 마감 '한 덩어리' 는 여기서 null 반환 → buildAreaBasedItems에서 세분 보충
  if (/마감$|공동주택마감/.test(n)) return null
  // 카테고리 기반 (CPM이 세분화된 경우)
  if (category === '전기공사') return '전기'
  if (category === '설비공사') return '기계설비'
  if (category === '외부공사') return '조경'
  if (category === '부대공사') return '포장'
  return null
}

// 데이터센터 장비 자동 산정 — 연면적(㎡) 기반 근사
// 가정: 데이터홀 60% · 용량 1.2kW/㎡ (IT load)
function buildDataCenterEquipment(bldgArea: number): CostTrade {
  const itHallArea = bldgArea * 0.6
  const itLoadKW = Math.round(itHallArea * 1.2)       // IT 파워(kW)
  const totalLoadKW = Math.round(itLoadKW * 2.2)      // + 공조·손실 (PUE 2.2 역산)
  const kvaLoad = Math.round(itLoadKW * 1.1)          // UPS kVA (PF 0.9)
  const mvaLoad = Math.max(1, Math.round(totalLoadKW / 1000))  // 수변전 MVA
  const cracCount = Math.max(2, Math.round(itLoadKW / 250))    // 50kW급 × N+1 가정
  const rackCount = Math.max(20, Math.round(itLoadKW / 8))     // 랙당 8kW 평균
  const firePods = Math.max(1, Math.round(itHallArea / 500))   // FM200 1식/500㎡

  const items: CostItem[] = []
  const add = (key: string, qty: number) => {
    const u = UNIT_PRICES[key]; if (!u) return
    items.push({
      name: u.label, qty, unit: u.unit, unitPriceKRW: u.price,
      subtotalKRW: Math.round(qty * u.price),
    })
  }
  add('DC_UPS',        kvaLoad)
  add('DC_발전기',     totalLoadKW)
  add('DC_수배전',     mvaLoad)
  add('DC_CRAC',       cracCount)
  add('DC_PowerDist',  rackCount)
  add('DC_액세스바닥', itHallArea)
  add('DC_FM200',      firePods)
  add('DC_RMS_BMS',    1)
  add('DC_보안',       1)

  return {
    category: 'IT 전용설비 (데이터센터)',
    items,
    categorySubtotalKRW: items.reduce((s, i) => s + i.subtotalKRW, 0),
  }
}

// 유형별 추가 아이템 — CPM에 없지만 연면적 기반으로 꼭 들어가는 것들
function buildAreaBasedItems(bldgArea: number, preset: TypePreset, cpmCategories: Set<string>, projectType?: string): CostTrade[] {
  const trades: CostTrade[] = []
  const addIf = (cond: boolean, cat: string, items: CostItem[]) => {
    if (cond && items.length > 0) {
      const subtotal = items.reduce((s, i) => s + i.subtotalKRW, 0)
      trades.push({ category: cat, items, categorySubtotalKRW: subtotal })
    }
  }

  // 마감공사 — CPM이 이미 '마감' 한 줄로 쓸 수도 있고, 세분화 없으면 여기서 풀어냄
  if (!cpmCategories.has('마감공사')) {
    const finishItems: CostItem[] = []
    const fm = preset.finishMultiplier
    const push = (key: PriceKey, qty: number) => {
      const u = UNIT_PRICES[key]
      const price = Math.round(u.price * fm)
      finishItems.push({ name: u.label, qty, unit: u.unit, unitPriceKRW: price, subtotalKRW: Math.round(qty * price) })
    }
    push('내장', bldgArea)
    push('도장', bldgArea * 2.8)  // 벽·천장 환산 배수
    push('타일', bldgArea * 0.18)  // 욕실·주방
    push('미장', bldgArea * 0.4)
    push('방수', bldgArea * 0.15)
    push('창호', bldgArea * 0.12)
    addIf(true, '마감공사', finishItems)
  }

  // 데이터센터 전용 IT 설비
  if (projectType === '데이터센터') {
    trades.push(buildDataCenterEquipment(bldgArea))
  }

  // 설비 (기계+전기+통신+소방) — CPM에 '설비공사'·'전기공사' 분리 없으면
  if (!cpmCategories.has('설비공사')) {
    const items: CostItem[] = []
    const u = UNIT_PRICES['기계설비']
    const price = Math.round(u.price * preset.mepMultiplier)
    items.push({ name: u.label, qty: bldgArea, unit: u.unit, unitPriceKRW: price, subtotalKRW: bldgArea * price })
    addIf(true, '설비공사', items)
  }
  if (!cpmCategories.has('전기공사')) {
    const items: CostItem[] = []
    const e = UNIT_PRICES['전기']; const ep = Math.round(e.price * preset.electricMultiplier)
    items.push({ name: e.label, qty: bldgArea, unit: e.unit, unitPriceKRW: ep, subtotalKRW: bldgArea * ep })
    const c = UNIT_PRICES['통신']
    items.push({ name: c.label, qty: bldgArea, unit: c.unit, unitPriceKRW: c.price, subtotalKRW: bldgArea * c.price })
    const s = UNIT_PRICES['소방']
    items.push({ name: s.label, qty: bldgArea, unit: s.unit, unitPriceKRW: s.price, subtotalKRW: bldgArea * s.price })
    addIf(true, '전기공사', items)
  }

  return trades
}

/**
 * 룰 기반 개략 공사비 — API 키 없을 때, 또는 빠른 프리셋 추정용
 */
export function estimateFromPreset(input: {
  type?: string
  bldgArea?: number
  buildingArea?: number
  ground?: number
  basement?: number
  totalDuration?: number
  tasks: Array<Pick<CPMResult, 'name' | 'category' | 'quantity' | 'unit' | 'duration'>>
}): CostResult {
  const preset = TYPE_PRESETS[input.type ?? '공동주택'] ?? TYPE_PRESETS['공동주택']
  const bldgArea = input.bldgArea ?? 30000

  // CPM tasks → 카테고리별 집계 + 아이템 생성
  const byCategory = new Map<string, CostItem[]>()
  const cpmCategories = new Set<string>()
  for (const t of input.tasks) {
    const key = mapTaskToPrice(t.name, t.category)
    if (!key) continue
    const u = UNIT_PRICES[key]
    const qty = t.quantity && t.quantity > 0 ? t.quantity : null
    if (!qty) continue  // 물량 없는 공종은 skip (뒤에서 연면적 기반 보충)
    let price = u.price
    if (t.category === '마감공사') price = Math.round(price * preset.finishMultiplier)
    else if (t.category === '설비공사') price = Math.round(price * preset.mepMultiplier)
    else if (t.category === '전기공사') price = Math.round(price * preset.electricMultiplier)
    else if (t.category === '골조공사') price = Math.round(price * preset.structureMultiplier)
    const subtotal = Math.round(qty * price)
    const arr = byCategory.get(t.category) ?? []
    arr.push({
      name: `${t.name} — ${u.label}`,
      qty: Math.round(qty * 100) / 100,
      unit: u.unit,
      unitPriceKRW: price,
      subtotalKRW: subtotal,
    })
    byCategory.set(t.category, arr)
    cpmCategories.add(t.category)
  }

  const trades: CostTrade[] = Array.from(byCategory.entries()).map(([cat, items]) => ({
    category: cat,
    items,
    categorySubtotalKRW: items.reduce((s, i) => s + i.subtotalKRW, 0),
  }))

  // 누락 카테고리 (연면적 기반 보충)
  const extraTrades = buildAreaBasedItems(bldgArea, preset, cpmCategories, input.type)
  trades.push(...extraTrades)

  // 직접공사비 = 모든 카테고리 합
  const direct = trades.reduce((s, t) => s + t.categorySubtotalKRW, 0)
  // 간접 10%, 관리 5.5%, 이윤 10%, 부가세 10%
  const indirect = Math.round(direct * 0.10)
  const base1 = direct + indirect
  const admin = Math.round(base1 * 0.055)
  const base2 = base1 + admin
  const profit = Math.round(base2 * 0.10)
  const base3 = base2 + profit
  const vat = Math.round(base3 * 0.10)
  const grand = base3 + vat

  const pricePerSqm = bldgArea > 0 ? Math.round(grand / bldgArea) : 0
  const pricePerPyong = Math.round(pricePerSqm * 3.306)  // ㎡→평 환산

  const summary: CostSummary = {
    directCostKRW: direct,
    indirectCostKRW: indirect,
    generalAdminKRW: admin,
    profitKRW: profit,
    vatKRW: vat,
    grandTotalKRW: grand,
    pricePerSqmKRW: pricePerSqm,
    pricePerPyongKRW: pricePerPyong,
  }

  const notes = [
    `프리셋 추정 (${preset.label}) · 2026-04 단가표 기준`,
    preset.notes,
    `연면적 ${bldgArea.toLocaleString()}㎡ × 평당 ${Math.round(pricePerPyong / 10000).toLocaleString()}만원`,
    'CPM 물량 있는 공종은 실측 단가, 없는 공종(마감·MEP·전기)은 연면적 기반 분해.',
    '간접 10% · 관리 5.5% · 이윤 10% · 부가세 10% 표준 계수 적용.',
  ].join(' · ')

  return { trades, summary, notes, source: 'preset' }
}
