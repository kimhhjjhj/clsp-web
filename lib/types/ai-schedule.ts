// ═══════════════════════════════════════════════════════════
// AI 공기 추론 — 관리자 큐레이션 방식
//
// 흐름:
//   관리자(사용자) → Claude Opus 4.7 대화 세션에서 추론 받음
//   → 결과를 /projects/[id]/edit 폼에 입력
//   → Project.aiScheduleEstimate JSON 필드에 저장
//   → /bid 공기 탭에서 캐시 값으로 표시 (런타임 API 호출 0건)
// ═══════════════════════════════════════════════════════════

export interface AiScheduleFactor {
  /** 요소 이름 (예: "공동주택 20층 기본") */
  label: string
  /** 기여 일수 (범위 또는 단일) — 문자열로 허용 ("-80~-120", "+25~35", "900~1000") */
  days: string
  /** 근거 메모 */
  note?: string
}

export interface AiScheduleEstimateData {
  /** 중앙 추정값 (일) */
  totalDuration: number
  /** 범위 최소/최대 (일) — 없으면 totalDuration 단일 */
  rangeMin?: number
  rangeMax?: number
  /** 신뢰도 */
  confidence: 'low' | 'medium' | 'high'
  /** 추정자 — 모델명 또는 이름 */
  estimator: string
  /** 추정 일시 (ISO) */
  estimatedAt: string
  /** 요소별 기여 분해 */
  factors: AiScheduleFactor[]
  /** 종합 근거 텍스트 */
  rationale: string
}
