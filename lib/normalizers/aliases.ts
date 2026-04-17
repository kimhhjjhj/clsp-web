// ═══════════════════════════════════════════════════════════
// 공종/회사 별칭 정규화 사전
// 목적: analytics·proposal 집계 시 같은 엔티티의 표기 차이를 통일
// 원칙: DB 값은 바꾸지 않음 (비파괴). 읽기 시점에만 정규화.
// ═══════════════════════════════════════════════════════════

// 도메인 확인 완료된 공종 별칭 (사용자 확인: 2026-04-17)
// 유지하는 것 (같은 이름 같아 보여도 다름):
//   - "직영인부" ≠ "직영" ≠ "철콘(직영)" (회사가 다름)
//   - "전기" / "통신" / "전기/통신" (상봉은 세분화, 파주는 통합 원본)
//   - "소방(전기)" / "소방(기계)" (공종이 실제로 다름)
export const TRADE_ALIAS: Record<string, string> = {
  // 공백 오염 (같은 값인데 공백이 여러 칸 들어간 경우)
  '관      리': '관리',
  '가설 울타리': '가설울타리',
  // 명백한 동일 표기
  '기계설비': '기계/설비',
  '조경공사': '조경',
  '석공사': '석재',
  '금속창호 및 잡철': '금속',
}

export const COMPANY_ALIAS: Record<string, string> = {
  // 같은 회사 오타
  '다원이엔씨': '다원이앤씨',
}

// 공백 안정화: 앞뒤 공백 제거 + 연속 공백 단일화
function cleanSpaces(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

export function normalizeTrade(raw: string | null | undefined): string {
  if (!raw) return ''
  const cleaned = cleanSpaces(String(raw))
  return TRADE_ALIAS[cleaned] ?? TRADE_ALIAS[raw as string] ?? cleaned
}

export function normalizeCompany(raw: string | null | undefined): string {
  if (!raw) return ''
  const cleaned = cleanSpaces(String(raw))
  return COMPANY_ALIAS[cleaned] ?? COMPANY_ALIAS[raw as string] ?? cleaned
}
