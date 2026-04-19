// ═══════════════════════════════════════════════════════════
// 국토부 2026 적정 공사기간 가이드라인 기반 참고값 산정
//
// 출처: '2026년 적정 공사기간 확보를 위한 가이드라인' (국토교통부, 2026.01)
// 용도: CP_DB·CPM 계산 결과와 나란히 비교할 **참고값** 산정.
//       현행 프로젝트의 CP_DB 생산성·공기는 그대로 유지, 가이드라인 결과는
//       별도 배지·카드로 "국토부 공식 산정 시 대략 얼마"를 보여줌.
//
// 산정식: 공사기간 = 준비기간 + CP 공종별(작업일수 + 비작업일수) + 정리기간
//   - 작업일수 = 물량 ÷ 1일 작업량 (부록 4)
//   - 비작업일수 = 법정공휴일 + 기상여건 비작업일 - 중복 (최소 월 8일)
// ═══════════════════════════════════════════════════════════

export interface GuidelineInput {
  type?: string          // 공동주택 | 오피스텔 | 업무시설 등
  ground: number         // 지상 층수
  basement: number       // 지하 층수
  lowrise: number        // 저층부 층수
  hasTransfer: boolean
  roofFloors?: number    // 옥탑 층수 (기본 2)
  startDate?: string     // 착공일 (미지정 시 비작업일수 평균치 사용)
}

export interface GuidelinePhase {
  name: string
  days: number
  note?: string
}

export interface GuidelineResult {
  byType: string
  preparationDays: number            // 준비기간
  criticalWorkDays: number           // CP 공종별 작업일수 합
  nonWorkDays: number                // 비작업일수(CP 기간 중 법정공휴일·기상)
  cleanupDays: number                // 정리기간
  total: number                      // 총 공사기간
  phases: GuidelinePhase[]           // 단계별 내역 (참고용)
  notes: string[]                    // 산정 근거
  reference: string                  // 가이드라인 페이지
}

/** 공동주택 준비기간 45일 외 유형별 값 (가이드라인 p.13 참고) */
const PREP_DAYS_BY_TYPE: Record<string, number> = {
  '공동주택': 45,
  '오피스텔': 50,
  '업무시설': 60,
  '데이터센터': 90,
  '스튜디오': 60,
  '기타': 50,
}

/** 공동주택 기준 CP 주요 공종별 표준 작업일수 (가이드라인 + 실무 근사) */
const APT_PHASE_STD = {
  foundation: 30,     // 기초
  basementPerFloor: 25,
  lowerPerFloor: 20,  // 저층부(근생) 층당
  transferPit: 55,    // 전이매트 + PIT 합
  standardPerFloor: 7,  // 기준층당
  roofPerFloor: 10,
  finishing: 210,     // 공동주택마감
}

/** 월별 비작업일수 평균 — 서울 철근콘크리트 기준 (p.19 예시 연 100.3일 ≈ 월 8.4) */
const AVG_NON_WORK_PER_MONTH = 10  // 주 40시간 근무 기준 하한(월 8)을 상회 보수적 가정

/** 월간 실작업일수 가정 (주 5일 × 4주 = 20일 근처, 보수적 25일) */
const WORKING_DAYS_PER_MONTH = 22

export function computeGuidelineSchedule(input: GuidelineInput): GuidelineResult {
  const type = input.type && input.type in PREP_DAYS_BY_TYPE ? input.type : '공동주택'
  const prep = PREP_DAYS_BY_TYPE[type]
  const cleanup = 30

  // CP 공종별 작업일수 — 공동주택 기준 (다른 유형은 근사)
  const phases: GuidelinePhase[] = []
  const roofFloors = input.roofFloors ?? 2
  const stdFloors = Math.max(0, input.ground - input.lowrise - roofFloors)

  // 기초 (지하 있으면만)
  if (input.basement > 0) {
    phases.push({ name: '기초(MAT)', days: APT_PHASE_STD.foundation, note: '콘크리트 타설·양생' })
  }
  // 지하층
  if (input.basement > 0) {
    phases.push({
      name: `지하 ${input.basement}개층`,
      days: input.basement * APT_PHASE_STD.basementPerFloor,
      note: `층당 ${APT_PHASE_STD.basementPerFloor}일`,
    })
  }
  // 저층부
  if (input.lowrise > 0) {
    phases.push({
      name: `저층부 ${input.lowrise}개층`,
      days: input.lowrise * APT_PHASE_STD.lowerPerFloor,
      note: `층당 ${APT_PHASE_STD.lowerPerFloor}일`,
    })
  }
  // 전이층 + PIT
  if (input.hasTransfer) {
    phases.push({ name: '전이매트 + PIT', days: APT_PHASE_STD.transferPit, note: '전이층 포함' })
  }
  // 기준층
  if (stdFloors > 0) {
    phases.push({
      name: `기준층 ${stdFloors}개층`,
      days: stdFloors * APT_PHASE_STD.standardPerFloor,
      note: `층당 ${APT_PHASE_STD.standardPerFloor}일`,
    })
  }
  // 옥탑
  if (roofFloors > 0 && input.ground > input.lowrise + roofFloors) {
    phases.push({
      name: `옥탑 ${roofFloors}개층`,
      days: roofFloors * APT_PHASE_STD.roofPerFloor,
      note: `층당 ${APT_PHASE_STD.roofPerFloor}일`,
    })
  }
  // 마감
  phases.push({
    name: '공동주택마감',
    days: APT_PHASE_STD.finishing,
    note: '외장·내장·MEP·가구 등',
  })

  const criticalWorkDays = phases.reduce((s, p) => s + p.days, 0)

  // 비작업일수 — 총 작업일수를 월간 근무일로 나눠 개월수 추정 후 × 월평균 비작업일
  const estMonths = criticalWorkDays / WORKING_DAYS_PER_MONTH
  const nonWorkDays = Math.round(estMonths * AVG_NON_WORK_PER_MONTH)

  const total = prep + criticalWorkDays + nonWorkDays + cleanup

  const notes = [
    `국토부 ${type} 기준 준비기간 ${prep}일 (가이드라인 p.13)`,
    `정리기간 ${cleanup}일 (준공 전 1개월, p.17)`,
    `비작업일수 = 월 약 ${AVG_NON_WORK_PER_MONTH}일 × 예상 ${estMonths.toFixed(1)}개월 ≈ ${nonWorkDays}일 (서울 철콘 기준 p.19 근사)`,
    'CP 공종별 작업일수는 상봉동 CP_DB 기본값 기반 추정 — 실제는 공종·공법·지반 등으로 편차 있음',
    '참고값 전용 — ±20% 이내 차이는 정상 범위 (가이드라인 p.24)',
  ]

  return {
    byType: type,
    preparationDays: prep,
    criticalWorkDays,
    nonWorkDays,
    cleanupDays: cleanup,
    total,
    phases,
    notes,
    reference: '국토교통부 2026 적정 공사기간 확보 가이드라인',
  }
}

/** CPM 결과와 가이드라인 결과를 비교해 편차 라벨 반환 */
export function compareWithCpm(cpmDays: number, guidelineDays: number): {
  deviationPct: number
  label: string
  severity: 'ok' | 'warn' | 'alert'
  color: string
} {
  const diff = cpmDays - guidelineDays
  const pct = Math.round((diff / guidelineDays) * 1000) / 10
  const absPct = Math.abs(pct)
  const severity: 'ok' | 'warn' | 'alert' =
    absPct <= 20 ? 'ok' :
    absPct <= 35 ? 'warn' :
    'alert'
  const sign = pct >= 0 ? '+' : ''
  const label =
    severity === 'ok' ? `가이드라인 근접 (${sign}${pct}%)` :
    severity === 'warn' ? `가이드라인 대비 ${sign}${pct}% 이탈 주의` :
    `가이드라인과 ${sign}${pct}% 큰 차이 — 재검토 필요`
  const color =
    severity === 'ok' ? '#059669' :
    severity === 'warn' ? '#d97706' :
    '#dc2626'
  return { deviationPct: pct, label, severity, color }
}
