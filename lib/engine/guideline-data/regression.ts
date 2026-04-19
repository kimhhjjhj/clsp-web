// 부록 5 — 시설물별 공사기간 산정공식 (회귀분석)
// 국토부 가이드라인 p.118~120
// 최근 5~10년 준공 실적 회귀 분석. 적용범위 밖은 활용 불가.

export interface RegressionFormula {
  facility: string              // 시설물 구분
  variable: string              // 독립변수 (연면적, 연장, 층수 등)
  unit: string                  // 변수 단위
  coefA: number                 // 계수 a
  coefB: number                 // 계수 b
  formulaLabel: string          // 식 설명
  range: { min: number; max: number } // 적용범위
  compute: (x: number) => number       // days(x)
  note?: string
}

/** 공동주택 (연면적 기반) */
const APT: RegressionFormula = {
  facility: '공동주택',
  variable: '연면적',
  unit: 'm²',
  coefA: 0.00725,
  coefB: 420,
  formulaLabel: '공기(일) = 0.00725 × 연면적 + 420',
  range: { min: 5000, max: 150000 },
  compute: x => 0.00725 * x + 420,
  note: '세대수 기반 산정식도 있으나 연면적식이 일반적으로 적용',
}

/** 오피스텔 */
const OFFICETEL: RegressionFormula = {
  facility: '오피스텔',
  variable: '연면적',
  unit: 'm²',
  coefA: 0.0065,
  coefB: 400,
  formulaLabel: '공기(일) = 0.0065 × 연면적 + 400',
  range: { min: 5000, max: 100000 },
  compute: x => 0.0065 * x + 400,
}

/** 업무시설 (일반 사무실) */
const OFFICE: RegressionFormula = {
  facility: '업무시설',
  variable: '연면적',
  unit: 'm²',
  coefA: 0.0078,
  coefB: 440,
  formulaLabel: '공기(일) = 0.0078 × 연면적 + 440',
  range: { min: 10000, max: 200000 },
  compute: x => 0.0078 * x + 440,
}

/** 학교 (교육연구시설) */
const SCHOOL: RegressionFormula = {
  facility: '학교',
  variable: '연면적',
  unit: 'm²',
  coefA: 0.0105,
  coefB: 300,
  formulaLabel: '공기(일) = 0.0105 × 연면적 + 300',
  range: { min: 3000, max: 50000 },
  compute: x => 0.0105 * x + 300,
}

/** 병원 (요양·의료시설) */
const HOSPITAL: RegressionFormula = {
  facility: '병원',
  variable: '연면적',
  unit: 'm²',
  coefA: 0.012,
  coefB: 500,
  formulaLabel: '공기(일) = 0.012 × 연면적 + 500',
  range: { min: 5000, max: 100000 },
  compute: x => 0.012 * x + 500,
  note: 'MEP 복잡도 ↑',
}

/** 도로 (포장공사, 2차로 기준) */
const ROAD: RegressionFormula = {
  facility: '도로공사',
  variable: '연장',
  unit: 'km',
  coefA: 75,
  coefB: 180,
  formulaLabel: '공기(일) = 75 × 연장(km) + 180',
  range: { min: 1, max: 30 },
  compute: x => 75 * x + 180,
}

/** 교량 (PSC거더교 기준) */
const BRIDGE: RegressionFormula = {
  facility: '교량',
  variable: '연장',
  unit: 'm',
  coefA: 0.9,
  coefB: 300,
  formulaLabel: '공기(일) = 0.9 × 연장(m) + 300',
  range: { min: 100, max: 2000 },
  compute: x => 0.9 * x + 300,
}

/** 터널 (NATM, 도심지 기준) */
const TUNNEL: RegressionFormula = {
  facility: '터널',
  variable: '연장',
  unit: 'm',
  coefA: 0.35,
  coefB: 360,
  formulaLabel: '공기(일) = 0.35 × 연장(m) + 360',
  range: { min: 500, max: 10000 },
  compute: x => 0.35 * x + 360,
}

export const REGRESSION_FORMULAS: Record<string, RegressionFormula> = {
  '공동주택': APT,
  '오피스텔': OFFICETEL,
  '업무시설': OFFICE,
  '학교':     SCHOOL,
  '병원':     HOSPITAL,
  '도로공사': ROAD,
  '교량':     BRIDGE,
  '터널':     TUNNEL,
}

export function regressionFor(facility: string): RegressionFormula | null {
  return REGRESSION_FORMULAS[facility] ?? null
}

/** 시설물별 회귀 공기 계산 + 범위 체크 */
export function computeRegressionDays(
  facility: string,
  x: number,
): { days: number | null; inRange: boolean; formula: RegressionFormula | null } {
  const f = regressionFor(facility)
  if (!f) return { days: null, inRange: false, formula: null }
  const inRange = x >= f.range.min && x <= f.range.max
  return { days: Math.round(f.compute(x)), inRange, formula: f }
}
