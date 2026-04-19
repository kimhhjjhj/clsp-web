// ═══════════════════════════════════════════════════════════
// 공종 단위 벤치마크 비교 (Add-on, 순수 함수)
//
// 과거 프로젝트 Task duration을 기준으로 각 공종의 편차 계산.
// 레벨 판정: ±30% 이내 normal, 초과 시 short/long.
// 표본 n ≥ 2 인 공종만 비교 가능 (insufficient는 제외하여 반환).
// ═══════════════════════════════════════════════════════════

export interface TaskStat {
  name: string
  avg: number
  min: number
  max: number
  std: number
  n: number          // 전체 task 표본
  projects: number   // 고유 프로젝트 수
}

export interface TaskBenchDeviation {
  name: string
  current: number
  avg: number
  min: number
  max: number
  deviationPercent: number   // (current - avg) / avg * 100
  level: 'short' | 'long' | 'normal'
  n: number
  projects: number
}

const DEVIATION_THRESHOLD = 30  // ±30% 이내는 normal

export function compareTaskBenchmarks(
  currentTasks: ReadonlyArray<{ name: string; duration: number }>,
  stats: ReadonlyArray<TaskStat>,
): TaskBenchDeviation[] {
  const byName = new Map(stats.map(s => [s.name, s]))
  const out: TaskBenchDeviation[] = []

  for (const t of currentTasks) {
    const s = byName.get(t.name)
    if (!s || s.avg <= 0) continue
    const dev = ((t.duration - s.avg) / s.avg) * 100
    const level: 'short' | 'long' | 'normal' =
      dev <= -DEVIATION_THRESHOLD ? 'short' :
      dev >=  DEVIATION_THRESHOLD ? 'long'  : 'normal'
    out.push({
      name: t.name,
      current: t.duration,
      avg: s.avg, min: s.min, max: s.max,
      deviationPercent: Math.round(dev * 10) / 10,
      level,
      n: s.n, projects: s.projects,
    })
  }
  // 편차 큰 순 정렬 (절대값)
  return out.sort((a, b) => Math.abs(b.deviationPercent) - Math.abs(a.deviationPercent))
}

export function deviantOnly(items: ReadonlyArray<TaskBenchDeviation>): TaskBenchDeviation[] {
  return items.filter(x => x.level !== 'normal')
}
