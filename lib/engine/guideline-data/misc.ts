// 기타 가이드라인 참고 데이터 — 준비기간·승강기·실무가이드 공동주택 등
// 국토부 가이드라인 p.13·22·129~

/** 공종 유형별 준비기간 (p.13 표) */
export const PREP_DAYS: Record<string, number> = {
  '공동주택':      45,
  '고속도로공사':  180,
  '철도공사':      90,
  '포장공사(신설)': 50,
  '포장공사(수선)': 60,
  '공동구공사':    80,
  '상수도공사':    60,
  '하천공사':      40,
  '항만공사':      40,
  '강교가설공사':  90,
  'PC교량 공사':   70,
  '교량보수공사':  60,
  // 실무 기본값
  '오피스텔':      50,
  '업무시설':      60,
  '데이터센터':    90,
  '스튜디오':      60,
  '기타':          50,
}

/** 정리기간 — 준공 전 1개월 (p.17) */
export const CLEANUP_DAYS = 30

/** 주 40시간 근무제 하한 — 월 8일 (p.20) */
export const WORKWEEK40_MIN_NONWORK_PER_MONTH = 8

/** 승강기 설치 적정공기 (p.22, 한국승강기공사협회) */
export interface ElevatorSpec {
  speedBelow105mpm: boolean  // 105m/분 이하
  floors: number
  units: number
}

export function elevatorInstallDays(spec: ElevatorSpec): number | null {
  const { speedBelow105mpm, floors, units } = spec
  if (speedBelow105mpm) {
    if (floors <= 19) {
      if (units <= 9) return 90
      if (units <= 19) return 120
      return 140
    } else {
      // 20층 이상
      if (units <= 9) return 105
      if (units <= 19) return 125
      return 150
    }
  } else {
    // 240m/분 이상
    if (floors <= 39) {
      if (units <= 9) return 195
      if (units <= 19) return 220
      return 240
    } else {
      // 40층 이상
      if (units <= 9) return 220
      if (units <= 19) return 240
      return 265
    }
  }
}

/** 비상저감조치 관련 수도권 가동률 손실 (p.15) */
export const DUST_ANNUAL_LOSS_DAYS_METRO = 5  // 수도권 미세먼지 연평균 5일 추가 손실

/** 산업안전 기준 — 타워크레인 풍속 제한 (p.14) */
export const TOWER_CRANE_LIMITS = {
  installRemoveWindMS: 10,  // 10m/s 초과 설치·해체 중지
  operationWindMS: 15,       // 15m/s 초과 운행 제한
}

/** 실무가이드 공동주택 — 층수별 참고 공기 (p.129~, 국토부 권장 범위) */
export interface ApartmentBenchmark {
  floorRange: string
  typicalMonths: [number, number]   // [최소, 최대]
  typicalDays: [number, number]
  note?: string
}
export const APARTMENT_BENCHMARKS: ApartmentBenchmark[] = [
  { floorRange: '저층(1~5F)',     typicalMonths: [12, 18], typicalDays: [360, 540], note: '근린·다세대 수준' },
  { floorRange: '중층(6~15F)',    typicalMonths: [18, 26], typicalDays: [540, 780] },
  { floorRange: '고층(16~25F)',   typicalMonths: [24, 32], typicalDays: [720, 960] },
  { floorRange: '초고층(26F~)',   typicalMonths: [30, 42], typicalDays: [900, 1260], note: '전이층·MEP 복잡' },
]

export function apartmentBenchmark(ground: number): ApartmentBenchmark {
  if (ground <= 5) return APARTMENT_BENCHMARKS[0]
  if (ground <= 15) return APARTMENT_BENCHMARKS[1]
  if (ground <= 25) return APARTMENT_BENCHMARKS[2]
  return APARTMENT_BENCHMARKS[3]
}

/** 공사기간 적정성 판정 임계 (p.24) */
export const ACCEPTANCE_DEVIATION_PCT = 20   // ±20% 이내면 정상, 초과 시 재검토

/** 시공조건 명시 항목 (부록 6, p.121~124) — 리스트 형태 체크리스트 */
export const SITE_CONDITIONS_CHECKLIST: string[] = [
  '용지보상 완료 여부 및 잔여 업무',
  '인허가 진행 현황 (도로점용·굴착·교통소통·지하안전영향평가 등)',
  '지장물 이설 (도시가스·상수도·통신·한전·하수도)',
  '문화재 시·발굴 계획',
  '지반조사 결과 및 특이사항',
  '주변 공사 간섭 (인접 공사 공정)',
  '교통처리계획 (도심지)',
  '민원 발생 위험',
  '공해·환경 규제 (소음·분진·진동)',
  '특수 공법 필요성',
]
