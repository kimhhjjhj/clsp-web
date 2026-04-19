// ═══════════════════════════════════════════════════════════
// 국토부 2026 적정 공사기간 가이드라인 참고값 산정
// 출처: '2026년 적정 공사기간 확보를 위한 가이드라인' (국토교통부, 2026.01)
//
// 원칙: CP_DB·CPM 계산은 건드리지 않음. 오직 비교용 참고값 산정.
//
// 두 가지 모드:
//   1) 간이(approximate): 착공일·지역 없이 평균치로 빠르게 추정
//   2) 정밀(precise):     착공일+지역+공종별 월별 비작업일수 표 이용
// ═══════════════════════════════════════════════════════════

import {
  PREP_DAYS, CLEANUP_DAYS, WORKWEEK40_MIN_NONWORK_PER_MONTH,
  ACCEPTANCE_DEVIATION_PCT, apartmentBenchmark,
} from './guideline-data/misc'
import { legalHolidays } from './guideline-data/holidays'
import {
  climateNonWorkDays, mapToWorkCategory, type Region, type WorkCategory,
} from './guideline-data/non-work-days'
import { computeRegressionDays } from './guideline-data/regression'

export interface GuidelineInput {
  type?: string
  ground: number
  basement: number
  lowrise: number
  hasTransfer: boolean
  roofFloors?: number
  startDate?: string        // YYYY-MM-DD (정밀 모드용)
  region?: Region           // 정밀 모드용. 없으면 '서울'
  bldgArea?: number         // 회귀식용
}

export interface GuidelinePhase {
  name: string
  days: number
  note?: string
}

export interface GuidelineResult {
  mode: 'approximate' | 'precise'
  byType: string
  preparationDays: number
  criticalWorkDays: number
  nonWorkDays: number
  cleanupDays: number
  total: number
  phases: GuidelinePhase[]
  monthlyNonWork?: { ym: string; legal: number; climate: number; overlap: number; applied: number }[]
  notes: string[]
  reference: string
}

/** 공동주택 기준 CP 주요 공종별 표준 작업일수 (실무 근사) */
const APT_PHASE_STD = {
  foundation: 30,
  basementPerFloor: 25,
  lowerPerFloor: 20,
  transferPit: 55,
  standardPerFloor: 7,
  roofPerFloor: 10,
  finishing: 210,
}

/** 월간 실작업일수 가정 (주 5일 × 4주 근사) */
const WORKING_DAYS_PER_MONTH = 22

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + Math.round(days))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildPhases(input: GuidelineInput): GuidelinePhase[] {
  const phases: GuidelinePhase[] = []
  const roofFloors = input.roofFloors ?? 2
  const stdFloors = Math.max(0, input.ground - input.lowrise - roofFloors)
  if (input.basement > 0) {
    phases.push({ name: '기초(MAT)', days: APT_PHASE_STD.foundation })
    phases.push({
      name: `지하 ${input.basement}개층`,
      days: input.basement * APT_PHASE_STD.basementPerFloor,
    })
  }
  if (input.lowrise > 0) {
    phases.push({
      name: `저층부 ${input.lowrise}개층`,
      days: input.lowrise * APT_PHASE_STD.lowerPerFloor,
    })
  }
  if (input.hasTransfer) {
    phases.push({ name: '전이매트 + PIT', days: APT_PHASE_STD.transferPit })
  }
  if (stdFloors > 0) {
    phases.push({
      name: `기준층 ${stdFloors}개층`,
      days: stdFloors * APT_PHASE_STD.standardPerFloor,
    })
  }
  if (roofFloors > 0 && input.ground > input.lowrise + roofFloors) {
    phases.push({ name: `옥탑 ${roofFloors}개층`, days: roofFloors * APT_PHASE_STD.roofPerFloor })
  }
  phases.push({ name: '공동주택마감', days: APT_PHASE_STD.finishing })
  return phases
}

/** 간이 모드 (착공일 없음) — 평균치로 빠르게 */
export function computeGuidelineSchedule(input: GuidelineInput): GuidelineResult {
  const type = input.type && input.type in PREP_DAYS ? input.type : '공동주택'
  const prep = PREP_DAYS[type]
  const phases = buildPhases(input)
  const criticalWorkDays = phases.reduce((s, p) => s + p.days, 0)

  // 월평균 비작업일 10일 가정 (서울 철콘 연 100.3일 근사)
  const estMonths = criticalWorkDays / WORKING_DAYS_PER_MONTH
  const nonWorkDays = Math.round(estMonths * 10)
  const total = prep + criticalWorkDays + nonWorkDays + CLEANUP_DAYS

  return {
    mode: 'approximate',
    byType: type,
    preparationDays: prep,
    criticalWorkDays,
    nonWorkDays,
    cleanupDays: CLEANUP_DAYS,
    total,
    phases,
    notes: [
      `국토부 ${type} 기준 준비기간 ${prep}일 (가이드라인 p.13)`,
      `정리기간 ${CLEANUP_DAYS}일 (p.17)`,
      `비작업일수 월평균 10일 근사 — 정밀값은 착공일·지역 입력 시 부록 3 표로 계산`,
      '참고값 전용 — CP_DB·CPM 계산과 별개',
    ],
    reference: '국토교통부 2026 적정 공사기간 확보 가이드라인',
  }
}

/**
 * 정밀 모드 — 착공일·지역 기반 월별 비작업일수 계산
 * 국토부 산식: 비작업일수 = (법정공휴일 + 기상여건 - 중복) ≥ 주40시간 하한(월 8일)
 */
export function computeGuidelineSchedulePrecise(input: GuidelineInput & { startDate: string }): GuidelineResult {
  const type = input.type && input.type in PREP_DAYS ? input.type : '공동주택'
  const prep = PREP_DAYS[type]
  const phases = buildPhases(input)
  const criticalWorkDays = phases.reduce((s, p) => s + p.days, 0)
  const region: Region = input.region ?? '서울'
  const workCat: WorkCategory = '철근콘크리트'   // 공동주택 CP 대표 공종 = 철콘

  // 착공 시점부터 월별 진행 — 작업일 소진까지
  const monthly: { ym: string; legal: number; climate: number; overlap: number; applied: number }[] = []
  let remainWork = criticalWorkDays
  let cur = new Date(input.startDate + 'T00:00:00')
  cur.setDate(cur.getDate() + prep)  // 준비기간 지난 후부터 CP 공사 시작
  let iterations = 0
  let totalNonWork = 0

  while (remainWork > 0 && iterations < 120) {    // 최대 10년
    const year = cur.getFullYear()
    const month0 = cur.getMonth()
    const calendarDays = new Date(year, month0 + 1, 0).getDate()

    const legal = legalHolidays(year, month0)
    const climate = climateNonWorkDays(workCat, region, month0)
    const overlap = Math.round(legal * climate / calendarDays)
    const rawNonWork = legal + climate - overlap
    const applied = Math.max(rawNonWork, WORKWEEK40_MIN_NONWORK_PER_MONTH)

    const workable = calendarDays - applied
    const advance = Math.min(workable, remainWork)

    monthly.push({
      ym: `${year}-${String(month0 + 1).padStart(2, '0')}`,
      legal: Math.round(legal * 10) / 10,
      climate: Math.round(climate * 10) / 10,
      overlap: Math.round(overlap * 10) / 10,
      applied: Math.round(applied * 10) / 10,
    })

    if (advance >= remainWork) {
      // 마지막 달 부분 비작업일 비례
      const partialNonWork = applied * (remainWork / workable)
      totalNonWork += partialNonWork
      remainWork = 0
    } else {
      totalNonWork += applied
      remainWork -= advance
    }

    cur.setMonth(cur.getMonth() + 1)
    cur.setDate(1)
    iterations++
  }

  const nonWorkDays = Math.round(totalNonWork)
  const total = prep + criticalWorkDays + nonWorkDays + CLEANUP_DAYS

  return {
    mode: 'precise',
    byType: type,
    preparationDays: prep,
    criticalWorkDays,
    nonWorkDays,
    cleanupDays: CLEANUP_DAYS,
    total,
    phases,
    monthlyNonWork: monthly,
    notes: [
      `국토부 ${type} 기준 준비기간 ${prep}일 + 정리기간 ${CLEANUP_DAYS}일`,
      `지역: ${region} · 공종 기준: ${workCat} (부록 3)`,
      `월별 비작업일수 = 법정공휴일 + 기상여건 − 중복 (주 40시간 근무제 하한 ${WORKWEEK40_MIN_NONWORK_PER_MONTH}일)`,
      `착공 ${input.startDate} → 준공 ${addDays(input.startDate, total)}`,
      `적정성 임계 ±${ACCEPTANCE_DEVIATION_PCT}% (p.24)`,
    ],
    reference: '국토교통부 2026 적정 공사기간 확보 가이드라인 (부록 1·2·3 정밀 반영)',
  }
}

/** 회귀공식 참고 (부록 5) */
export function computeGuidelineRegression(facility: string, bldgArea?: number): {
  days: number | null
  inRange: boolean
  formula: string | null
} {
  if (!bldgArea || bldgArea <= 0) return { days: null, inRange: false, formula: null }
  const r = computeRegressionDays(facility, bldgArea)
  return {
    days: r.days,
    inRange: r.inRange,
    formula: r.formula?.formulaLabel ?? null,
  }
}

/** 규모 기반 업계 밴드 (실무가이드 공동주택, p.129~) */
export function guidelineBenchmark(ground: number) {
  return apartmentBenchmark(ground)
}

/** CPM 결과 vs 가이드라인 대조 — ±20/35% 임계 */
export function compareWithCpm(cpmDays: number, guidelineDays: number) {
  const diff = cpmDays - guidelineDays
  const pct = Math.round((diff / guidelineDays) * 1000) / 10
  const absPct = Math.abs(pct)
  const severity: 'ok' | 'warn' | 'alert' =
    absPct <= ACCEPTANCE_DEVIATION_PCT ? 'ok' :
    absPct <= 35 ? 'warn' : 'alert'
  const sign = pct >= 0 ? '+' : ''
  const label =
    severity === 'ok' ? `가이드라인 근접 (${sign}${pct}%)` :
    severity === 'warn' ? `가이드라인 대비 ${sign}${pct}% 이탈 주의` :
    `가이드라인과 ${sign}${pct}% 큰 차이 — 재검토 필요`
  const color =
    severity === 'ok' ? '#059669' :
    severity === 'warn' ? '#d97706' : '#dc2626'
  return { deviationPct: pct, label, severity, color }
}

// Re-export for convenience
export { findDailyOutput, dailyOutputByCategory } from './guideline-data/daily-output'
export { climateRulesFor } from './guideline-data/climate-rules'
export { elevatorInstallDays, SITE_CONDITIONS_CHECKLIST } from './guideline-data/misc'
export type { Region, WorkCategory }
