// ═══════════════════════════════════════════════════════════
// POST /api/bid/similar-projects
//
// 프로젝트 속성으로 DB에서 유사 프로젝트를 찾아 공기 추천값 제공.
// 휴리스틱(AI 프리셋·회귀식) 대신 실제 데이터 기반 신호.
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { findSimilarProjects, recommendDuration, type SimilarityInput } from '@/lib/engine/similar-projects'

export async function POST(req: NextRequest) {
  const body = await req.json() as SimilarityInput & {
    minSimilarity?: number
    limit?: number
  }

  const matches = await findSimilarProjects(body, {
    minSimilarity: body.minSimilarity ?? 0.5,
    limit: body.limit ?? 10,
  })

  const recommendation = recommendDuration(matches)

  return NextResponse.json({
    matches,
    recommendation,
    // 클라이언트에서 fallback 처리용
    dataAvailable: matches.length > 0,
    fallbackMessage: matches.length === 0
      ? '유사 프로젝트 없음 — 휴리스틱(AI 프리셋·회귀식) 참고값만 가용. 더 많은 실적 축적 필요.'
      : null,
  })
}
