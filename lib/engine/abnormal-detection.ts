// ═══════════════════════════════════════════════════════════
// 비정상 공종 탐지 (Add-on, 순수 함수)
//
// 목적: CPM 결과에서 '이 공종은 과도하게 길다'는 경고를 UI에 표시.
// 원칙: AI 최소화, 통계 기반 (카테고리 내 평균/표준편차 + 전체 비중).
//
// 기존 WBS/CPM/API 전혀 건드리지 않는 읽기 전용 레이어.
// ═══════════════════════════════════════════════════════════

export interface AbnormalCandidate {
  name: string
  category: string
  duration: number
}

export type AbnormalReason = 'category-outlier' | 'dominant' | 'both'

export interface AbnormalTask {
  name: string
  duration: number
  reason: AbnormalReason
  categoryMean: number
  categoryStd: number
  zScore: number
  multiple: number        // duration / categoryMean (배수, 사용자 친화)
  shareOfTotal: number    // duration / totalDuration
  message: string         // 짧은 한 줄
}

// 규칙 임계값
const Z_SCORE_THRESHOLD = 1.5   // 카테고리 내 z-score
const DOMINANCE_THRESHOLD = 0.20 // 전체 공기의 20% 이상이면 dominant

/**
 * 카테고리별 평균·표준편차 계산
 */
function categoryStats(tasks: readonly AbnormalCandidate[]) {
  const byCategory = new Map<string, number[]>()
  for (const t of tasks) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, [])
    byCategory.get(t.category)!.push(t.duration)
  }
  const stats = new Map<string, { mean: number; std: number; count: number }>()
  for (const [cat, durations] of byCategory) {
    const mean = durations.reduce((s, x) => s + x, 0) / durations.length
    const variance = durations.reduce((s, x) => s + (x - mean) ** 2, 0) / durations.length
    stats.set(cat, { mean, std: Math.sqrt(variance), count: durations.length })
  }
  return stats
}

/**
 * 비정상 공종 탐지 — 두 가지 기준 OR
 *  1) 카테고리 내 z-score ≥ 1.5 (평균 대비 크게 벗어남)
 *  2) 전체 공기의 20% 이상 차지 (dominant)
 * 카테고리 표본 ≤ 2면 z-score 계산 의미 없어 multiple만 사용
 */
export function detectAbnormal(
  tasks: readonly AbnormalCandidate[],
  totalDuration: number,
): AbnormalTask[] {
  if (tasks.length === 0 || totalDuration <= 0) return []
  const stats = categoryStats(tasks)
  const results: AbnormalTask[] = []

  for (const t of tasks) {
    const s = stats.get(t.category)
    if (!s) continue
    const multiple = s.mean > 0 ? t.duration / s.mean : 0
    const zScore = s.std > 0 ? (t.duration - s.mean) / s.std : 0
    const share = t.duration / totalDuration

    // 카테고리 표본이 2개 이하면 z-score 대신 multiple 3배 이상을 기준
    const isOutlier = s.count >= 3
      ? zScore >= Z_SCORE_THRESHOLD
      : multiple >= 3

    const isDominant = share >= DOMINANCE_THRESHOLD

    if (!isOutlier && !isDominant) continue

    let reason: AbnormalReason = 'category-outlier'
    if (isOutlier && isDominant) reason = 'both'
    else if (isDominant) reason = 'dominant'

    // 사용자 친화 메시지
    const parts: string[] = []
    if (isOutlier) {
      parts.push(`${t.category} 카테고리 평균 ${Math.round(s.mean)}일 대비 ${multiple.toFixed(1)}배`)
    }
    if (isDominant) {
      parts.push(`전체 공기의 ${Math.round(share * 100)}% 차지`)
    }

    results.push({
      name: t.name,
      duration: t.duration,
      reason,
      categoryMean: Math.round(s.mean * 10) / 10,
      categoryStd: Math.round(s.std * 10) / 10,
      zScore: Math.round(zScore * 100) / 100,
      multiple: Math.round(multiple * 10) / 10,
      shareOfTotal: Math.round(share * 1000) / 1000,
      message: parts.join(' · '),
    })
  }

  // duration 큰 순 정렬 (심각도 우선)
  return results.sort((a, b) => b.duration - a.duration)
}

/**
 * 공종명 → AbnormalTask lookup (UI에서 O(1) 조회)
 */
export function buildAbnormalIndex(tasks: readonly AbnormalCandidate[], totalDuration: number) {
  const list = detectAbnormal(tasks, totalDuration)
  const map = new Map<string, AbnormalTask>()
  for (const a of list) map.set(a.name, a)
  return { list, map }
}
