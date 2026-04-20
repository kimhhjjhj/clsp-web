// ═══════════════════════════════════════════════════════════
// 공기 Smart Estimate — 다단 폴백 엔진
//
// 기존 AI 프리셋(schedule-preset.ts 하드코딩 공식)의 구조적 한계를
// 보완하기 위해, 가용한 데이터 소스를 우선순위대로 시도해 가장
// 신뢰도 높은 값을 반환한다.
//
// 우선순위:
//   1) 자사 회귀식 (F18 InternalRegression) — n ≥ 10, R² ≥ 0.7
//   2) 유사 준공 프로젝트 KNN — n ≥ 3, avgSimilarity ≥ 0.6
//   3) 국토부 회귀식 — 연면적 적용범위 내
//   4) 하드코딩 휴리스틱 공식 (기존 schedule-preset)
//
// 응답에 source·confidence·fallbackReasons 포함해 UI 에서 투명하게 표시.
// 기존 schedule-preset.ts 는 수정하지 않고 re-export 해 호환 유지.
// ═══════════════════════════════════════════════════════════

import { computeSchedulePreset, type SchedulePresetInput, type SchedulePresetResult } from './schedule-preset'
import { findSimilarProjects, recommendDuration } from './similar-projects'
import { loadRegression } from './internal-regression'
import { computeGuidelineRegression } from './guideline'

export type EstimateSource =
  | 'internal-regression'     // 자사 실적 회귀 (F18)
  | 'similar-projects-knn'    // 유사 준공 프로젝트 평균
  | 'guideline-regression'    // 국토부 부록 5 회귀식
  | 'heuristic-formula'       // 하드코딩 공식 (fallback)

export interface LayerAttempt {
  source: EstimateSource
  attempted: boolean
  accepted: boolean
  value?: number
  confidence?: 'low' | 'medium' | 'high'
  reason: string           // 왜 채택/거부되었나
}

export interface SmartEstimateResult extends SchedulePresetResult {
  /** 실제 사용된 소스 */
  source: EstimateSource
  /** 각 레이어 시도 이력 — UI 투명성용 */
  layers: LayerAttempt[]
  /** 전반적 신뢰도 재판정 */
  smartConfidence: 'low' | 'medium' | 'high'
}

// 자사 회귀 채택 임계
const INTERNAL_MIN_SAMPLE = 10
const INTERNAL_MIN_R2 = 0.7
// 유사 프로젝트 KNN 채택 임계
const SIMILAR_MIN_SAMPLE = 3
const SIMILAR_MIN_AVG_SIM = 0.6

/** 프리셋 공식 기반 phases 만들기 — totalDuration 을 덮어쓸 때 재사용 */
function rebuildPhases(preset: SchedulePresetResult, newTotal: number): SchedulePresetResult['phases'] {
  let running = 0
  return preset.phases.map((p, i, arr) => {
    const days = i === arr.length - 1
      ? newTotal - running
      : Math.round(newTotal * p.ratio)
    const start = running
    const end = running + days
    running = end
    return { ...p, days, startDay: start, endDay: end }
  })
}

export async function computeSmartEstimate(input: SchedulePresetInput & {
  excludeProjectId?: string
  location?: string
  constructionMethod?: string | null
}): Promise<SmartEstimateResult> {
  // 기존 공식 계산을 baseline으로 항상 확보 (phases·formula 참조용)
  const heuristic = computeSchedulePreset(input)
  const type = heuristic.byType

  const layers: LayerAttempt[] = []

  // ─── Layer 1: 자사 회귀식 (F18) ───────────────────────────
  let internalResult: { days: number; confidence: 'medium' | 'high' } | null = null
  try {
    const loaded = await loadRegression(type)
    const attempted: LayerAttempt = {
      source: 'internal-regression',
      attempted: true, accepted: false,
      reason: '',
    }
    if (!loaded) {
      attempted.reason = '학습된 자사 회귀식 없음 (준공 프로젝트 실적 부족)'
    } else if (loaded.sampleSize < INTERNAL_MIN_SAMPLE) {
      attempted.reason = `샘플 부족 (n=${loaded.sampleSize} < ${INTERNAL_MIN_SAMPLE})`
    } else if (loaded.rSquared < INTERNAL_MIN_R2) {
      attempted.reason = `적합도 낮음 (R²=${loaded.rSquared.toFixed(2)} < ${INTERNAL_MIN_R2})`
    } else if (!input.bldgArea || input.bldgArea <= 0) {
      attempted.reason = '연면적 입력 없음'
    } else {
      const days = Math.max(1, Math.round(
        loaded.coefficients.slope * input.bldgArea + loaded.coefficients.intercept
      ))
      internalResult = {
        days,
        confidence: loaded.sampleSize >= 20 && loaded.rSquared >= 0.85 ? 'high' : 'medium',
      }
      attempted.accepted = true
      attempted.value = days
      attempted.confidence = internalResult.confidence
      attempted.reason = `자사 회귀식 채택 (n=${loaded.sampleSize}, R²=${loaded.rSquared.toFixed(2)})`
    }
    layers.push(attempted)
  } catch (e) {
    layers.push({
      source: 'internal-regression', attempted: true, accepted: false,
      reason: `오류: ${(e as Error).message}`,
    })
  }

  if (internalResult) {
    return {
      ...heuristic,
      totalDuration: internalResult.days,
      phases: rebuildPhases(heuristic, internalResult.days),
      formula: `자사 회귀식 (F18): ${heuristic.byType} 연면적 × 자사 계수`,
      notes: [
        `자사 준공 실적 기반 회귀로 산출 (${heuristic.byType})`,
        ...heuristic.notes.slice(1),
      ],
      source: 'internal-regression',
      smartConfidence: internalResult.confidence,
      layers,
    }
  }

  // ─── Layer 2: 유사 준공 프로젝트 KNN ──────────────────────
  let similarResult: { days: number; confidence: 'low' | 'medium' | 'high'; n: number; avgSim: number } | null = null
  try {
    const matches = await findSimilarProjects(
      {
        type: input.type, ground: input.ground, basement: input.basement,
        lowrise: input.lowrise, bldgArea: input.bldgArea, buildingArea: input.buildingArea,
        siteArea: input.siteArea, hasTransfer: input.hasTransfer,
        constructionMethod: input.constructionMethod ?? null,
        wtBottom: input.wtBottom, waBottom: input.waBottom,
        location: input.location, excludeProjectId: input.excludeProjectId,
      },
      { minSimilarity: 0.5, limit: 10 /* includeCpmOnly 기본 false = 준공 실적만 */ },
    )
    const rec = recommendDuration(matches)
    const attempted: LayerAttempt = {
      source: 'similar-projects-knn',
      attempted: true, accepted: false,
      reason: '',
    }
    if (!rec || rec.count === 0) {
      attempted.reason = '유사 준공 프로젝트 없음 (DB에 actualDuration 입력 필요)'
    } else if (rec.count < SIMILAR_MIN_SAMPLE) {
      attempted.reason = `샘플 부족 (n=${rec.count} < ${SIMILAR_MIN_SAMPLE})`
    } else if (rec.actualSampleCount === 0) {
      attempted.reason = 'actualDuration 샘플 0건 — CPM 예측치만으로는 채택 불가'
    } else {
      const avgSim = matches.slice(0, rec.count).reduce((s, m) => s + m.similarity, 0) / rec.count
      if (avgSim < SIMILAR_MIN_AVG_SIM) {
        attempted.reason = `평균 유사도 낮음 (${(avgSim * 100).toFixed(0)}% < ${(SIMILAR_MIN_AVG_SIM * 100).toFixed(0)}%)`
      } else {
        similarResult = { days: rec.mean, confidence: rec.confidence, n: rec.count, avgSim }
        attempted.accepted = true
        attempted.value = rec.mean
        attempted.confidence = rec.confidence
        attempted.reason = `유사 준공 프로젝트 ${rec.count}건 평균 (유사도 ${(avgSim * 100).toFixed(0)}%, 실적 ${rec.actualSampleCount}건)`
      }
    }
    layers.push(attempted)
  } catch (e) {
    layers.push({
      source: 'similar-projects-knn', attempted: true, accepted: false,
      reason: `오류: ${(e as Error).message}`,
    })
  }

  if (similarResult) {
    return {
      ...heuristic,
      totalDuration: similarResult.days,
      phases: rebuildPhases(heuristic, similarResult.days),
      formula: `유사 준공 프로젝트 ${similarResult.n}건 평균 (유사도 ${(similarResult.avgSim * 100).toFixed(0)}%)`,
      notes: [
        '자사 DB 의 유사 준공 프로젝트 실적 평균',
        '유사도 가중 평균, 실적(actualDuration)에 3배 가중',
        ...heuristic.notes.slice(2),
      ],
      source: 'similar-projects-knn',
      smartConfidence: similarResult.confidence,
      layers,
    }
  }

  // ─── Layer 3: 국토부 회귀식 ─────────────────────────────
  let guidelineResult: { days: number; confidence: 'low' | 'medium' } | null = null
  try {
    const reg = computeGuidelineRegression(type, input.bldgArea)
    const attempted: LayerAttempt = {
      source: 'guideline-regression',
      attempted: true, accepted: false,
      reason: '',
    }
    if (!reg.days) {
      attempted.reason = `${type} 회귀식 없음 또는 연면적 미입력`
    } else if (!reg.inRange) {
      // 범위 밖이면 채택은 안 하지만 참고로 기록
      attempted.value = reg.days
      attempted.reason = `적용 범위 밖 (${reg.formula})`
    } else {
      guidelineResult = { days: reg.days, confidence: 'medium' }
      attempted.accepted = true
      attempted.value = reg.days
      attempted.confidence = 'medium'
      attempted.reason = `국토부 부록 5 회귀식 (${reg.formula})`
    }
    layers.push(attempted)
  } catch (e) {
    layers.push({
      source: 'guideline-regression', attempted: true, accepted: false,
      reason: `오류: ${(e as Error).message}`,
    })
  }

  if (guidelineResult) {
    return {
      ...heuristic,
      totalDuration: guidelineResult.days,
      phases: rebuildPhases(heuristic, guidelineResult.days),
      formula: `국토부 부록 5 회귀식 (연면적 ${input.bldgArea?.toLocaleString()}㎡ 기반)`,
      notes: [
        '국토부 2026 가이드라인 부록 5 시설물별 회귀식',
        '⚠️ 연면적 단변수 기반 — 층수·동수·지반 영향 미반영 (참고값)',
        ...heuristic.notes.slice(2),
      ],
      source: 'guideline-regression',
      smartConfidence: guidelineResult.confidence,
      layers,
    }
  }

  // ─── Layer 4: 하드코딩 휴리스틱 (최종 fallback) ─────────
  layers.push({
    source: 'heuristic-formula',
    attempted: true, accepted: true,
    value: heuristic.totalDuration,
    confidence: 'low',
    reason: '상위 3개 레이어 모두 사용 불가 → 하드코딩 휴리스틱 fallback',
  })

  return {
    ...heuristic,
    source: 'heuristic-formula',
    smartConfidence: 'low',   // 휴리스틱은 항상 신뢰도 낮게 재판정
    layers,
  }
}

/** 소스별 한국어 라벨 */
export const SOURCE_LABEL: Record<EstimateSource, string> = {
  'internal-regression':   '자사 회귀식 (F18)',
  'similar-projects-knn':  '유사 준공 프로젝트 평균',
  'guideline-regression':  '국토부 회귀식 (참고)',
  'heuristic-formula':     '하드코딩 휴리스틱 (fallback)',
}

/** 소스별 정확도·신뢰도 메타 */
export const SOURCE_META: Record<EstimateSource, {
  color: string
  badge: string
  shortDesc: string
}> = {
  'internal-regression': {
    color: '#059669',
    badge: '⭐ 최우선',
    shortDesc: '자사 준공 실적 기반 학습된 회귀식. 가장 신뢰도 높음.',
  },
  'similar-projects-knn': {
    color: '#2563eb',
    badge: '📊 데이터 기반',
    shortDesc: '자사 DB 의 유사 준공 프로젝트 실적 평균.',
  },
  'guideline-regression': {
    color: '#7c3aed',
    badge: '📘 법정 참조',
    shortDesc: '국토부 부록 5 전국 회귀식. 연면적만 반영.',
  },
  'heuristic-formula': {
    color: '#d97706',
    badge: '⚠️ 휴리스틱',
    shortDesc: '하드코딩 공식. 계수 근거 불투명. 실적 데이터 누적 시 자동 승격.',
  },
}
