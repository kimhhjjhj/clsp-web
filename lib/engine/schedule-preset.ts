// ═══════════════════════════════════════════════════════════
// 공기 프리셋 룰 — 유형/규모 기반 합리적 총공기 산출
// 근거: (주)동양 건설부문 실적 DB + 2026년 한국 건축 실무 관례
// 입력은 bid 페이지의 BidInput과 동일. CPM 없이도 즉시 호출 가능.
// ═══════════════════════════════════════════════════════════

export interface SchedulePresetInput {
  type?: string
  ground?: number
  basement?: number
  lowrise?: number
  hasTransfer?: boolean
  bldgArea?: number        // 연면적 ㎡
  buildingArea?: number    // 건축면적 ㎡
  siteArea?: number
  wtBottom?: number        // 풍화토 바닥 m
  waBottom?: number        // 풍화암 바닥 m
}

export interface SchedulePhase {
  name: string
  days: number
  ratio: number       // 전체 대비 비율
  startDay: number    // 착공 기준 오프셋
  endDay: number
  note?: string
}

export interface SchedulePresetResult {
  totalDuration: number          // 일
  phases: SchedulePhase[]
  formula: string                // 계산 근거 한 줄
  notes: string[]                // 가정/한계
  byType: string                 // 적용된 유형
  confidence: 'low' | 'medium' | 'high'
}

/** 유형별 계수 */
const TYPE_RULES: Record<string, {
  base: number          // 기본 공기(일)
  areaCoef: number      // 연면적당 추가일 (일/㎡)
  groundCoef: number    // 지상층당 일
  basementCoef: number  // 지하층당 일 (지하가 공기 병목)
  lowriseCoef: number   // 저층부 추가(일)
  transferAddon: number // 전이층 추가(일)
  confidence: 'low' | 'medium' | 'high'
}> = {
  '공동주택':   { base: 180, areaCoef: 0.015, groundCoef: 6,  basementCoef: 14, lowriseCoef: 4,  transferAddon: 25, confidence: 'high'   },
  '오피스텔':   { base: 150, areaCoef: 0.012, groundCoef: 5,  basementCoef: 13, lowriseCoef: 4,  transferAddon: 20, confidence: 'medium' },
  '업무시설':   { base: 180, areaCoef: 0.014, groundCoef: 7,  basementCoef: 16, lowriseCoef: 5,  transferAddon: 30, confidence: 'medium' },
  '데이터센터': { base: 300, areaCoef: 0.025, groundCoef: 10, basementCoef: 20, lowriseCoef: 6,  transferAddon: 40, confidence: 'medium' },
  '스튜디오':   { base: 220, areaCoef: 0.018, groundCoef: 8,  basementCoef: 17, lowriseCoef: 5,  transferAddon: 30, confidence: 'low'    },
  '기타':       { base: 180, areaCoef: 0.015, groundCoef: 6,  basementCoef: 15, lowriseCoef: 4,  transferAddon: 25, confidence: 'low'    },
}

/** 단계별 공기 분포 — 가설(5%)·토공(15%)·골조(30%)·외부마감(40%)·MEP준공(10%) */
const PHASE_DIST: { name: string; ratio: number; note?: string }[] = [
  { name: '가설·착공 준비', ratio: 0.05, note: '현장 개설·가설·민원 협의' },
  { name: '토공·기초',      ratio: 0.15, note: '터파기·기초·지하외벽' },
  { name: '골조공사',       ratio: 0.30, note: '지상·지하 골조 + 전이층' },
  { name: '외부·마감',      ratio: 0.40, note: '외장·내장·창호·도장' },
  { name: 'MEP·준공',       ratio: 0.10, note: '기계·전기·소방·시운전·준공검사' },
]

export function computeSchedulePreset(input: SchedulePresetInput): SchedulePresetResult {
  const type = input.type && input.type in TYPE_RULES ? input.type : '기타'
  const r = TYPE_RULES[type]

  const area   = Math.max(0, input.bldgArea ?? 0)
  const g      = Math.max(0, input.ground ?? 0)
  const b      = Math.max(0, input.basement ?? 0)
  const low    = Math.max(0, input.lowrise ?? 0)
  const hasXfer = !!input.hasTransfer

  // 지반 보정: 풍화암 깊을수록(waBottom 큼) 터파기·기초 지연
  const waBottom = input.waBottom ?? 0
  const groundPenalty = waBottom > 8 ? 15 : waBottom > 5 ? 7 : 0

  const totalDuration = Math.round(
    r.base
    + area * r.areaCoef
    + g * r.groundCoef
    + b * r.basementCoef
    + low * r.lowriseCoef
    + (hasXfer ? r.transferAddon : 0)
    + groundPenalty
  )

  // phases — 비율로 배분하되 누적 시 반올림 오차가 totalDuration에 흡수되도록
  let runningStart = 0
  const phases: SchedulePhase[] = PHASE_DIST.map((p, idx) => {
    const days = idx === PHASE_DIST.length - 1
      ? totalDuration - runningStart     // 마지막 단계가 잔여 수용
      : Math.round(totalDuration * p.ratio)
    const start = runningStart
    const end   = runningStart + days
    runningStart = end
    return { name: p.name, days, ratio: p.ratio, startDay: start, endDay: end, note: p.note }
  })

  const parts = [
    `${type} 기본 ${r.base}일`,
    area > 0 ? `연면적 ${area.toLocaleString()}㎡ × ${r.areaCoef}` : null,
    g > 0 ? `지상 ${g}층 × ${r.groundCoef}일` : null,
    b > 0 ? `지하 ${b}층 × ${r.basementCoef}일` : null,
    low > 0 ? `저층부 ${low}층 × ${r.lowriseCoef}일` : null,
    hasXfer ? `전이층 +${r.transferAddon}일` : null,
    groundPenalty > 0 ? `풍화암 ${waBottom}m → +${groundPenalty}일` : null,
  ].filter((s): s is string => !!s)

  const formula = parts.join(' + ')

  const notes = [
    `${type} 유형 (주)동양 건설부문 과거 실적 평균 기준`,
    '민원·악천후·설계 변경 등 외부 변수는 포함하지 않음',
    hasXfer ? '전이층(Transfer Slab)은 구조 검토·양생으로 추가 공기 반영' : '전이층 없음',
  ].filter((s): s is string => !!s)

  return {
    totalDuration,
    phases,
    formula,
    notes,
    byType: type,
    confidence: r.confidence,
  }
}
