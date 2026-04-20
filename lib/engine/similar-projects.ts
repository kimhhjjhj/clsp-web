// ═══════════════════════════════════════════════════════════
// 유사 프로젝트 기반 공기 추천 엔진
//
// 휴리스틱 공식(AI 프리셋·회귀식)의 구조적 한계를 벗어나기 위한
// 데이터 기반 접근. 과거 DB의 프로젝트 속성과 유사도를 계산해
// 상위 N개의 실제 공기(actualDuration) 또는 CPM 결과(lastCpmDuration)를
// 가중 평균한다.
//
// F18 자사 회귀식이 충분히 학습되기 전까지의 1차 데이터 기반 신호.
// 향후 embedding + pgvector 로 확장 가능.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

export interface SimilarityInput {
  type?: string | null
  ground?: number | null
  basement?: number | null
  lowrise?: number | null
  bldgArea?: number | null
  buildingArea?: number | null
  siteArea?: number | null
  hasTransfer?: boolean
  constructionMethod?: string | null
  wtBottom?: number | null
  waBottom?: number | null
  location?: string | null
  excludeProjectId?: string
}

export interface SimilarProjectMatch {
  id: string
  name: string
  client?: string | null
  type?: string | null
  ground?: number | null
  basement?: number | null
  lowrise?: number | null
  bldgArea?: number | null
  constructionMethod?: string | null
  hasTransfer: boolean
  location?: string | null
  startDate?: string | null
  actualCompletionDate?: string | null
  actualDuration?: number | null
  lastCpmDuration?: number | null
  // 유사도 결과
  similarity: number           // 0~1
  similarityBreakdown: {        // 각 요소 기여도
    type: number
    area: number
    ground: number
    basement: number
    method: number
    transfer: number
    location: number
  }
  // 이 프로젝트가 공기 추천 계산에 기여한 가중치 (actualDuration > CPM)
  durationSource: 'actual' | 'cpm' | null
  durationUsed: number | null
}

export interface DurationRecommendation {
  count: number                     // 유사 프로젝트 수
  mean: number                      // 가중 평균 (일)
  median: number
  min: number
  max: number
  std: number                       // 표준편차
  confidence: 'low' | 'medium' | 'high'  // 샘플 수와 유사도에 따라
  // 실적 vs CPM 비율
  actualSampleCount: number          // actualDuration 있는 샘플 수
  cpmSampleCount: number
  // 메모
  reasons: string[]                  // 추천 신뢰도 근거
}

// ─────────────────────────────────────────────────────────
// 유사도 계산 (0~1)
// ─────────────────────────────────────────────────────────

/** 숫자 유사도: 1 - |a-b| / max(a,b). 양쪽이 비어있으면 0.5 (중립). */
function numSim(a?: number | null, b?: number | null, sensitivity = 1): number {
  if (a == null || b == null) return 0.5
  if (a === 0 && b === 0) return 1
  const max = Math.max(Math.abs(a), Math.abs(b))
  if (max === 0) return 1
  const diff = Math.abs(a - b) / max
  // sensitivity > 1 이면 차이를 더 크게 벌점
  return Math.max(0, 1 - Math.pow(diff, 1 / sensitivity))
}

function strMatch(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0.5
  if (a === b) return 1
  return 0
}

/** 지역 근접 — 시/도 단위 매칭 (간단히 앞 글자 기준) */
function locationProximity(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0.5
  const aFirst = a.trim().slice(0, 2)
  const bFirst = b.trim().slice(0, 2)
  if (aFirst === bFirst) return 1
  return 0
}

export function computeSimilarity(input: SimilarityInput, target: SimilarityInput): {
  total: number
  breakdown: SimilarProjectMatch['similarityBreakdown']
} {
  const typeS     = strMatch(input.type, target.type)
  const areaS     = numSim(input.bldgArea, target.bldgArea)
  const groundS   = numSim(input.ground, target.ground, 1.2)      // 층수 차이에 민감
  const basementS = numSim(input.basement, target.basement, 1.5)  // 지하는 공기 영향 큼 → 민감
  const methodS   = strMatch(input.constructionMethod, target.constructionMethod)
  const transferS = input.hasTransfer === target.hasTransfer ? 1 : 0
  const locS      = locationProximity(input.location, target.location)

  // 가중치 — 합계 1.0
  const W = {
    type: 0.25, area: 0.20, ground: 0.15, basement: 0.10,
    method: 0.10, transfer: 0.10, location: 0.10,
  }

  const total =
    W.type * typeS
    + W.area * areaS
    + W.ground * groundS
    + W.basement * basementS
    + W.method * methodS
    + W.transfer * transferS
    + W.location * locS

  return {
    total: Math.round(total * 1000) / 1000,
    breakdown: {
      type: typeS, area: areaS, ground: groundS, basement: basementS,
      method: methodS, transfer: transferS, location: locS,
    },
  }
}

// ─────────────────────────────────────────────────────────
// 유사 프로젝트 검색
// ─────────────────────────────────────────────────────────

export async function findSimilarProjects(
  input: SimilarityInput,
  opts: { minSimilarity?: number; limit?: number; includeCpmOnly?: boolean } = {},
): Promise<SimilarProjectMatch[]> {
  const minSimilarity = opts.minSimilarity ?? 0.5
  const limit = opts.limit ?? 10
  // 기본: 준공된 프로젝트(actualDuration)만 사용
  //   includeCpmOnly=true 로 명시해야 계획중/진행중 프로젝트의 lastCpmDuration 도 후보 포함
  const includeCpmOnly = opts.includeCpmOnly ?? false

  const candidates = await prisma.project.findMany({
    where: {
      id: input.excludeProjectId ? { not: input.excludeProjectId } : undefined,
      // 준공(actualDuration 있는) 프로젝트만 기본 필터
      //   "유사 프로젝트"의 의미는 "완료되어 실제 공기가 밝혀진 사례"여야 하므로
      //   계획·진행중 프로젝트의 CPM 예측값은 참고 신뢰도 낮음
      ...(includeCpmOnly
        ? { OR: [{ lastCpmDuration: { not: null } }, { actualDuration: { not: null } }] }
        : { actualDuration: { not: null } }
      ),
    },
    select: {
      id: true, name: true, client: true, type: true,
      ground: true, basement: true, lowrise: true, bldgArea: true,
      constructionMethod: true, hasTransfer: true, location: true,
      startDate: true, actualCompletionDate: true, actualDuration: true,
      lastCpmDuration: true,
    },
  })

  const matches: SimilarProjectMatch[] = []
  for (const c of candidates) {
    const { total, breakdown } = computeSimilarity(input, {
      type: c.type, ground: c.ground, basement: c.basement, lowrise: c.lowrise,
      bldgArea: c.bldgArea, hasTransfer: c.hasTransfer,
      constructionMethod: c.constructionMethod, location: c.location,
    })
    if (total < minSimilarity) continue

    let durationSource: 'actual' | 'cpm' | null = null
    let durationUsed: number | null = null
    if (c.actualDuration != null && c.actualDuration > 0) {
      durationSource = 'actual'
      durationUsed = c.actualDuration
    } else if (c.lastCpmDuration != null && c.lastCpmDuration > 0) {
      durationSource = 'cpm'
      durationUsed = c.lastCpmDuration
    }

    matches.push({
      ...c,
      similarity: total,
      similarityBreakdown: breakdown,
      durationSource,
      durationUsed,
    })
  }

  matches.sort((a, b) => b.similarity - a.similarity)
  return matches.slice(0, limit)
}

// ─────────────────────────────────────────────────────────
// 공기 추천 계산
// ─────────────────────────────────────────────────────────

export function recommendDuration(matches: SimilarProjectMatch[]): DurationRecommendation | null {
  const valid = matches.filter(m => m.durationUsed != null && m.durationUsed > 0)
  if (valid.length === 0) return null

  // 가중: actualDuration은 3배, CPM은 1배. 유사도도 함께 곱함.
  const weighted = valid.map(m => {
    const sourceWeight = m.durationSource === 'actual' ? 3 : 1
    return {
      value: m.durationUsed as number,
      weight: m.similarity * sourceWeight,
    }
  })

  const totalW = weighted.reduce((s, w) => s + w.weight, 0)
  if (totalW === 0) return null

  const mean = weighted.reduce((s, w) => s + w.value * w.weight, 0) / totalW

  // 중위 (단순 중위, 가중 중위는 단순화)
  const sortedValues = [...valid.map(m => m.durationUsed as number)].sort((a, b) => a - b)
  const median = sortedValues.length % 2 === 0
    ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
    : sortedValues[Math.floor(sortedValues.length / 2)]

  const min = Math.min(...sortedValues)
  const max = Math.max(...sortedValues)

  // 표준편차
  const variance = valid.reduce((s, m) => s + Math.pow((m.durationUsed as number) - mean, 2), 0) / valid.length
  const std = Math.sqrt(variance)

  // 신뢰도 판정
  const actualCount = valid.filter(m => m.durationSource === 'actual').length
  const cpmCount = valid.filter(m => m.durationSource === 'cpm').length
  const avgSim = valid.reduce((s, m) => s + m.similarity, 0) / valid.length

  let confidence: 'low' | 'medium' | 'high' = 'low'
  if (valid.length >= 5 && actualCount >= 2 && avgSim >= 0.7) confidence = 'high'
  else if (valid.length >= 3 && avgSim >= 0.6) confidence = 'medium'

  const reasons: string[] = []
  reasons.push(`샘플 ${valid.length}개 (실적 ${actualCount}개, CPM ${cpmCount}개)`)
  reasons.push(`평균 유사도 ${(avgSim * 100).toFixed(0)}%`)
  if (actualCount === 0) {
    reasons.push('⚠️ 준공 실적 프로젝트 0건 — CPM 결과만 기반 → 신뢰도 제한적')
  }
  if (valid.length < 3) {
    reasons.push('⚠️ 샘플 3건 미만 — 통계적 안정성 낮음')
  }
  if (std / mean > 0.3) {
    reasons.push(`⚠️ 편차 큼 (CV=${((std / mean) * 100).toFixed(0)}%) — 프로젝트 간 이질성 주의`)
  }

  return {
    count: valid.length,
    mean: Math.round(mean),
    median: Math.round(median),
    min: Math.round(min),
    max: Math.round(max),
    std: Math.round(std),
    confidence,
    actualSampleCount: actualCount,
    cpmSampleCount: cpmCount,
    reasons,
  }
}
