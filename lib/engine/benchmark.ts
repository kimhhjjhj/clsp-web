// ═══════════════════════════════════════════════════════════
// (주)동양 건설부문 과거 프로젝트 벤치마크 비교 (Add-on, 순수 함수)
//
// 목적: 현재 CPM 추정값이 과거 동급 프로젝트 평균 대비 어느 위치인지 표시.
// 원칙: AI/외부 데이터 없음. 회사 자체 과거 실적만 사용 (건설 빅데이터 부재 대응).
//
// 지표: "총 층수당 일수" = duration / (ground + basement + lowrise)
// 이유: 면적(bldgArea) null 프로젝트가 많고, 층수는 거의 항상 기입되어 있음.
//
// 읽기 전용 — 기존 CPM·WBS·API 전혀 건드리지 않음.
// ═══════════════════════════════════════════════════════════

export interface BenchmarkSample {
  name: string
  type: string | null
  ground: number | null
  basement: number | null
  lowrise: number | null
  duration: number    // lastCpmDuration
}

export interface BenchmarkInput {
  type: string | null          // 현재 프로젝트 용도
  ground: number
  basement: number
  lowrise: number
  currentDuration: number      // 현재 CPM 총공기
}

export type BenchmarkLevel = 'short' | 'normal' | 'long' | 'insufficient'

export interface BenchmarkResult {
  level: BenchmarkLevel
  sampleCount: number          // 비교에 쓴 과거 프로젝트 수
  avgDaysPerFloor: number | null
  currentDaysPerFloor: number
  deviationPercent: number     // 평균 대비 편차 (%)
  label: string                // 짧은 한 줄
  detail: string               // 설명문 (툴팁용)
  samples: Array<{ name: string; totalFloors: number; duration: number; daysPerFloor: number }>
}

// 편차 판정 임계
const SHORT_THRESHOLD = -15   // -15% 이하 → 짧음 (낙관적)
const LONG_THRESHOLD = 15     // +15% 이상 → 길음 (보수적)
const MIN_SAMPLES = 2         // 최소 표본

function totalFloors(s: { ground: number | null; basement: number | null; lowrise: number | null }) {
  return (s.ground ?? 0) + (s.basement ?? 0) + (s.lowrise ?? 0)
}

export function computeBenchmark(
  input: BenchmarkInput,
  samples: readonly BenchmarkSample[],
): BenchmarkResult {
  const currentFloors = input.ground + input.basement + input.lowrise
  const currentDaysPerFloor = currentFloors > 0 ? input.currentDuration / currentFloors : 0

  // 같은 용도·유의미 데이터만 필터
  const valid = samples.filter(s => {
    const f = totalFloors(s)
    return f > 0
      && s.duration > 0
      && (input.type ? s.type === input.type : true)
  })

  if (valid.length < MIN_SAMPLES) {
    return {
      level: 'insufficient',
      sampleCount: valid.length,
      avgDaysPerFloor: null,
      currentDaysPerFloor: Math.round(currentDaysPerFloor * 10) / 10,
      deviationPercent: 0,
      label: '비교 표본 부족',
      detail: `동일 용도(${input.type ?? '미지정'}) 과거 프로젝트가 ${valid.length}개뿐이라 벤치마크 불가 (최소 ${MIN_SAMPLES}개 필요)`,
      samples: valid.map(s => ({
        name: s.name,
        totalFloors: totalFloors(s),
        duration: s.duration,
        daysPerFloor: Math.round((s.duration / totalFloors(s)) * 10) / 10,
      })),
    }
  }

  const perFloorArr = valid.map(s => s.duration / totalFloors(s))
  const avg = perFloorArr.reduce((a, b) => a + b, 0) / perFloorArr.length
  const deviation = ((currentDaysPerFloor - avg) / avg) * 100

  let level: BenchmarkLevel = 'normal'
  if (deviation <= SHORT_THRESHOLD) level = 'short'
  else if (deviation >= LONG_THRESHOLD) level = 'long'

  const sign = deviation >= 0 ? '+' : ''
  const label =
    level === 'short' ? `평균보다 ${Math.abs(deviation).toFixed(0)}% 짧음 ⚠️` :
    level === 'long'  ? `평균보다 ${deviation.toFixed(0)}% 김 ⚠️` :
                        `평균 근접 (${sign}${deviation.toFixed(0)}%)`

  const detail =
    `회사 과거 ${valid.length}개 프로젝트 평균: 층당 ${avg.toFixed(1)}일 · ` +
    `현재: 층당 ${currentDaysPerFloor.toFixed(1)}일 (${sign}${deviation.toFixed(1)}%)`

  return {
    level,
    sampleCount: valid.length,
    avgDaysPerFloor: Math.round(avg * 10) / 10,
    currentDaysPerFloor: Math.round(currentDaysPerFloor * 10) / 10,
    deviationPercent: Math.round(deviation * 10) / 10,
    label,
    detail,
    samples: valid.map(s => ({
      name: s.name,
      totalFloors: totalFloors(s),
      duration: s.duration,
      daysPerFloor: Math.round((s.duration / totalFloors(s)) * 10) / 10,
    })),
  }
}

// 색상 팔레트 (CP·Abnormal과 통일된 톤)
export const BENCHMARK_COLORS: Record<BenchmarkLevel, { bg: string; text: string; border: string }> = {
  short:        { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  normal:       { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  long:         { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  insufficient: { bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200' },
}
