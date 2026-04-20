// ═══════════════════════════════════════════════════════════
// AI 공사비 추정 — 관리자 큐레이션 방식
//
// 흐름:
//   관리자 → Claude Opus 4.7 대화 세션에서 추정 받음
//   → 결과를 /projects/[id]/edit 폼에 입력
//   → Project.aiCostEstimate JSON 필드에 저장
//   → /bid 공사비 탭에서 캐시 값으로 표시 (런타임 API 호출 0건)
// ═══════════════════════════════════════════════════════════

export interface AiCostTrade {
  /** 공종명 (예: "철근콘크리트", "마감공사", "기계설비") */
  category: string
  /** 금액 (만원) */
  amount: number
  /** 전체 대비 비중 (%) — 없으면 UI에서 자동 계산 */
  pctOfTotal?: number
  /** 단가·산출 근거 메모 (예: "1,500원/kg × 8,000톤") */
  note?: string
}

export interface AiCostEstimateData {
  /** 총 공사비 (만원) */
  totalAmount: number
  /** 평당 단가 (만원/평) — 선택 */
  unitPrice?: number
  /** 범위 최소 (만원) */
  rangeMin?: number
  /** 범위 최대 (만원) */
  rangeMax?: number
  /** 신뢰도 */
  confidence: 'low' | 'medium' | 'high'
  /** 추정자 — 모델명 또는 이름 */
  estimator: string
  /** 추정 일시 (ISO) */
  estimatedAt: string
  /** 공종별 기여 분해 */
  trades: AiCostTrade[]
  /** 종합 근거 텍스트 */
  rationale: string
}
