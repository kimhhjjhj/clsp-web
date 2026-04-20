// ═══════════════════════════════════════════════════════════
// 공기(일수) 표시 포맷 유틸
//
// 기본: "N개월 (M일)" 형태로 가독성 향상
// 30 미만은 그냥 일수로만.
// ═══════════════════════════════════════════════════════════

/** 일수를 반올림된 개월로 변환 (30일 = 1개월 기준) */
export function daysToMonths(days: number): number {
  return Math.round(days / 30)
}

export interface FormatOptions {
  /** 표시 방식
   *  - 'full'   : "30개월 (899일)" (기본)
   *  - 'months' : "30개월"
   *  - 'days'   : "899일"
   *  - 'both'   : "899일 · 약 30개월"
   */
  mode?: 'full' | 'months' | 'days' | 'both'
  /** 매우 짧은 기간(예: 30일 미만)일 때 개월 대신 일만 표시 */
  compactShort?: boolean
  /** 음수/0 처리 */
  emptyText?: string
  /** 숫자 포매팅 — 천 단위 쉼표 (기본 true) */
  commaSeparated?: boolean
}

/** 공기 표시 포맷터 — 개월(일) 조합
 *  예:   899 → "30개월 (899일)"
 *        21  → "21일" (compactShort=true 기본)
 *        null/0 → "—"
 */
export function formatDuration(days: number | null | undefined, opts: FormatOptions = {}): string {
  const {
    mode = 'full',
    compactShort = true,
    emptyText = '—',
    commaSeparated = true,
  } = opts

  if (days == null || !isFinite(days) || days <= 0) return emptyText

  const rounded = Math.round(days)
  const months = daysToMonths(rounded)
  const daysStr = commaSeparated ? rounded.toLocaleString() : String(rounded)

  if (compactShort && rounded < 30) {
    // 30일 미만 — 일수만
    return `${daysStr}일`
  }

  switch (mode) {
    case 'months': return `${months}개월`
    case 'days':   return `${daysStr}일`
    case 'both':   return `${daysStr}일 · 약 ${months}개월`
    case 'full':
    default:       return `${months}개월 (${daysStr}일)`
  }
}

/** 짧은 표시 — 카드/테이블 등 좁은 공간 */
export function formatDurationShort(days: number | null | undefined): string {
  if (days == null || !isFinite(days) || days <= 0) return '—'
  const rounded = Math.round(days)
  const months = daysToMonths(rounded)
  if (rounded < 30) return `${rounded}일`
  return `${months}개월`
}

/** 메인 숫자 (예: 카드 대형 표시) + 서브 텍스트로 나눠서 반환
 *  예: { main: "30", unit: "개월", sub: "899일" }
 *      0/null: { main: "—", unit: "", sub: "" }
 */
export function splitDurationDisplay(days: number | null | undefined): {
  main: string
  unit: string
  sub: string
} {
  if (days == null || !isFinite(days) || days <= 0) {
    return { main: '—', unit: '', sub: '' }
  }
  const rounded = Math.round(days)
  if (rounded < 30) {
    return { main: String(rounded), unit: '일', sub: '' }
  }
  return {
    main: String(daysToMonths(rounded)),
    unit: '개월',
    sub: `${rounded.toLocaleString()}일`,
  }
}
