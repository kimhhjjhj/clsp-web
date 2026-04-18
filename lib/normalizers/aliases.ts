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

// ═══════════════════════════════════════════════════════════
// 비공종 필터 — 관리·안전관리자·현장소장 등
// 목적: 이들은 "공종"이 아니므로 생산성 DB 집계에서 제외해야 함
// 정책: DB 값은 비파괴. 저장 시·읽기 시 양쪽 필터 (이미 저장된 것 방어)
// ═══════════════════════════════════════════════════════════
const NON_TRADE_SET = new Set<string>([
  '관리', '직영인부', '직원', '안전관리자', '현장소장', '감리',
])

export function isNonTrade(trade: string | null | undefined): boolean {
  if (!trade) return true
  const cleaned = cleanSpaces(String(trade))
  return NON_TRADE_SET.has(cleaned)
}

// ═══════════════════════════════════════════════════════════
// 공종 대분류 매핑 — 키워드 기반
// 활용: 생산성 DB · 전사 분석에서 필터/그룹핑
// 분류 불가능한 경우 '기타'
// ═══════════════════════════════════════════════════════════
export type TradeCategory = '골조' | '토목' | '마감' | '설비' | '전기·통신' | '가설·관리' | '외부·조경' | '기타'

export const TRADE_CATEGORIES: TradeCategory[] = [
  '골조', '토목', '마감', '설비', '전기·통신', '가설·관리', '외부·조경', '기타'
]

// 순서 중요 — 앞에 매칭되면 결정 (더 구체적인 것부터)
const CATEGORY_RULES: { key: TradeCategory; keywords: string[] }[] = [
  { key: '전기·통신', keywords: ['전기', '통신', '소방', '약전', '정보통신'] },
  { key: '설비',     keywords: ['설비', '배관', '위생', '공조', '냉난방', 'EHP', '기계', '소화', '급배수'] },
  { key: '골조',     keywords: ['철근', '콘크리트', '타설', '형틀', '거푸집', '골조', '철콘', '지하층', '지상층', '기초', '전이층'] },
  { key: '토목',     keywords: ['토공', '터파기', 'CIP', 'SGR', '흙막이', '캠빔', '차수', '복토', '되메우기', '잔토'] },
  { key: '마감',     keywords: ['내장', '타일', '도장', '창호', '석재', '금속', '단열', '방수', '목공', '도배', '마감', '석공', '수장', '유리', '천장', '바닥', '페인트'] },
  { key: '외부·조경', keywords: ['조경', '포장', '옥상', '부지정지', '외부', '외벽'] },
  { key: '가설·관리', keywords: ['가설', '울타리', '철거', '부지', '관리', '직영', '공통', '사무실'] },
]

export function getTradeCategory(trade: string): TradeCategory {
  if (!trade) return '기타'
  const t = trade.trim()
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(kw => t.includes(kw))) return rule.key
  }
  return '기타'
}
