// ═══════════════════════════════════════════════════════════
// CP 집중도 평가 (Add-on, 순수 함수)
//
// 배경: 전체 공기 중 크리티컬 패스 공종들이 차지하는 비율이 높을수록
//       프로젝트는 '한 공종만 밀려도 전체 지연'되는 빡빡한 상태.
//       비율이 낮으면 병행 여지·여유가 있다는 뜻.
//
// 규칙 기반 (AI 최소화). 기존 CPM 결과를 전혀 건드리지 않는 읽기 전용.
// ═══════════════════════════════════════════════════════════

export type CpLevel = 'tight' | 'moderate' | 'loose'

export interface CpAssessable {
  duration: number
  isCritical: boolean
}

export interface CpAssessment {
  cpDays: number
  totalDuration: number     // 전체 공기 (주어지면 그대로, 없으면 tasks에서 max(EF) 추정 불가 → 합계 사용)
  ratio: number             // cpDays / totalDuration (0~1)
  level: CpLevel
  label: string             // '매우 빡빡' / '적정' / '여유'
  reason: string            // 1줄 설명
  cpTaskCount: number
  totalTaskCount: number
}

const THRESHOLD_TIGHT = 0.70      // 업계 관행: 70% 이상이면 여유 없음
const THRESHOLD_MODERATE = 0.40   // 40% 미만이면 여유 많음 (병행 많음)

/**
 * CP 집중도 평가.
 * - tasks: CPM 결과 (isCritical·duration 포함)
 * - totalDuration: 실제 총 공기 (ES/EF 기반, 주어지지 않으면 cpDays로 대체)
 */
export function assessCriticalPath(
  tasks: readonly CpAssessable[],
  totalDuration?: number,
): CpAssessment {
  const cpTasks = tasks.filter(t => t.isCritical)
  const cpDays = cpTasks.reduce((s, t) => s + t.duration, 0)
  // totalDuration 없으면 CP 길이가 곧 전체 (순차 연결 가정)
  const total = (totalDuration && totalDuration > 0) ? totalDuration : cpDays
  const ratio = total > 0 ? cpDays / total : 0

  let level: CpLevel
  let label: string
  let reason: string

  if (ratio >= THRESHOLD_TIGHT) {
    level = 'tight'
    label = '매우 빡빡'
    reason = 'CP가 전체 공기의 70% 이상 — 한 공종만 지연돼도 바로 전체 공기 연장'
  } else if (ratio >= THRESHOLD_MODERATE) {
    level = 'moderate'
    label = '적정'
    reason = 'CP와 병행 작업이 균형 — 업계 평균 범위'
  } else {
    level = 'loose'
    label = '여유'
    reason = 'CP 비중이 낮음 — 병행 공종이 많아 일부 지연을 흡수 가능'
  }

  return {
    cpDays: Math.round(cpDays * 10) / 10,
    totalDuration: Math.round(total * 10) / 10,
    ratio: Math.round(ratio * 1000) / 1000,
    level,
    label,
    reason,
    cpTaskCount: cpTasks.length,
    totalTaskCount: tasks.length,
  }
}

/**
 * 레벨별 색상 (UI 일관 사용)
 */
export const CP_LEVEL_COLORS: Record<CpLevel, { bg: string; text: string; dot: string; hex: string }> = {
  tight:    { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    hex: '#ef4444' },
  moderate: { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500',  hex: '#f59e0b' },
  loose:    { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', hex: '#10b981' },
}
