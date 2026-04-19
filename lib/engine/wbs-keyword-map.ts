// ═══════════════════════════════════════════════════════════
// CP_DB 공종 ↔ 일보 텍스트 키워드 매핑 (규칙 기반, v3)
//
// v3 추가:
//   - excludes: 같은 절에 있으면 매칭 취소할 단어들 (해체/철거/이전 등)
//   - phaseWindow: 공사준비·초기 공종은 첫 일보 기준 N일 이내만 유효
//     (준공 앞두고 나오는 '사무실 이전' 같은 잔공사는 제외)
// ═══════════════════════════════════════════════════════════

export type Rule = string[]   // AND 관계

export interface TaskMatch {
  /** 절 하나가 한 규칙의 모든 단어를 포함하면 매칭 */
  rules: Rule[]
  /** 같은 절에 이 단어가 있으면 매칭 취소 */
  excludes?: string[]
  /** 공사 초반부에만 유효 — 첫 일보로부터 N일 이후는 스킵 */
  earlyWindowDays?: number
}

export const CPDB_RULES: Record<string, TaskMatch> = {
  // ── 공사준비 (대부분 착공 초반 2~3개월 내에만 유효) ──
  '가설울타리': {
    rules:    [['가설울타리'], ['가설', '울타리'], ['가설', '휀스'], ['휀스', '설치']],
    excludes: ['디자인휀스', '디자인 휀스', '디자인', '해체', '철거'],
    earlyWindowDays: 60,
  },
  '가설사무실': {
    rules:    [['가설사무실'], ['가설', '사무실'], ['현장사무실'], ['현장', '사무실']],
    excludes: ['이전', '정리', '청소', '철거', '해체'],
    earlyWindowDays: 90,
  },
  '가설 전기/용수': {
    rules:    [['가설전기'], ['가설', '전기'], ['가설용수'], ['가설', '용수'], ['가설설비'], ['RPP']],
    excludes: ['해체', '철거'],
    earlyWindowDays: 90,
  },
  '부지정지': {
    rules:    [['부지정지'], ['부지', '정지'], ['성토'], ['정지', '작업']],
    earlyWindowDays: 60,
  },

  // ── 토목공사 (착공 후 6개월 이내) ──
  'CIP(철근망)': {
    rules:    [['CIP', '철근'], ['CIP', '천공'], ['CIP(철근']],
    excludes: ['해체', '철거', '제거'],
    earlyWindowDays: 240,
  },
  'CIP(H-BEAM)': {
    rules:    [['CIP', 'H-BEAM'], ['CIP', 'H빔'], ['CIP', 'H BEAM'], ['CIP', 'H-beam'], ['CIP(H']],
    excludes: ['해체', '철거', '제거'],
    earlyWindowDays: 240,
  },
  '장비조립': {
    rules:    [['장비', '조립'], ['장비', '반입'], ['크레인', '조립']],
    excludes: ['해체', '철거'],
    earlyWindowDays: 180,
  },
  '캠빔 설치': {
    rules:    [['캠빔', '설치'], ['캠빔'], ['캠 빔'], ['웨일러']],
    excludes: ['해체', '철거', '제거'],
    earlyWindowDays: 240,
  },
  'SGR공사': {
    rules:    [['SGR'], ['차수', '그라우팅'], ['차수그라우팅']],
    excludes: ['해체'],
    earlyWindowDays: 180,
  },
  '터파기(풍화토)':  { rules: [['풍화토']], excludes: ['해체'], earlyWindowDays: 240 },
  '터파기(풍화암)':  { rules: [['풍화암']], excludes: ['해체'], earlyWindowDays: 240 },
  '터파기(연암)':    { rules: [['연암'], ['경암']], excludes: ['해체'], earlyWindowDays: 240 },

  // ── 골조공사 ──
  '기초': {
    rules:    [['기초', '타설'], ['기초', '콘크리트'], ['기초', '배근'], ['기초', '철근'], ['매트기초'], ['MAT', '타설'], ['매트', '타설']],
    excludes: ['해체', '철거'],
  },
  '지하층': {
    rules:    [['지하', '타설'], ['지하', '형틀'], ['지하', '배근'], ['지하', '콘크리트'], ['B1F'], ['B2F'], ['B3F']],
    excludes: ['해체', '철거'],
  },
  '지상층(저층부)':  { rules: [['저층부']], excludes: ['해체'] },
  '전이층(PIT포함)': { rules: [['PIT'], ['피트층'], ['전이층']], excludes: ['해체'] },
  '지상층(세팅층)':  { rules: [['세팅층']], excludes: ['해체'] },
  '지상층(기준층)':  { rules: [['기준층']], excludes: ['해체'] },
  '지상층(최상층)':  { rules: [['최상층'], ['옥상층'], ['옥탑']], excludes: ['해체'] },

  // ── 마감공사 ──
  '공동주택마감': {
    rules: [
      ['도배'], ['마루'], ['타일'], ['도장'], ['창호'],
      ['샤워부스'], ['PL창'], ['석재'], ['가구'], ['싱크대'],
      ['엘리베이터'], ['EHP'], ['전열교환기'], ['자동제어'],
      ['도시가스'], ['월패드'], ['조경', '식재'], ['조경', '수목'],
      ['준공청소'],
    ],
    excludes: ['해체'],
  },
}

export function splitClauses(text: string): string[] {
  return text
    .split(/[\n\r\t·,.;|/]/g)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

function clauseMatchesRule(clause: string, rule: Rule): boolean {
  for (const kw of rule) if (!clause.includes(kw)) return false
  return true
}

function clauseExcluded(clause: string, excludes?: string[]): boolean {
  if (!excludes || excludes.length === 0) return false
  for (const ex of excludes) if (clause.includes(ex)) return true
  return false
}

/**
 * 단순 매칭 — phase 체크는 API 레벨에서.
 * UI/스크립트용 단일 텍스트 검사.
 */
export function matchesTask(text: string, taskName: string): boolean {
  const m = CPDB_RULES[taskName]
  if (!m) return false
  for (const c of splitClauses(text)) {
    if (clauseExcluded(c, m.excludes)) continue
    for (const r of m.rules) {
      if (clauseMatchesRule(c, r)) return true
    }
  }
  return false
}

export function findMatchDetails(
  text: string,
  taskName: string,
): { clause: string; rule: Rule }[] {
  const m = CPDB_RULES[taskName]
  if (!m) return []
  const out: { clause: string; rule: Rule }[] = []
  const seen = new Set<string>()
  for (const c of splitClauses(text)) {
    if (clauseExcluded(c, m.excludes)) continue
    for (const r of m.rules) {
      if (clauseMatchesRule(c, r)) {
        const key = c + '|' + r.join('+')
        if (!seen.has(key)) { seen.add(key); out.push({ clause: c, rule: r }) }
      }
    }
  }
  return out
}

export function rulesSummary(taskName: string): string[] {
  const m = CPDB_RULES[taskName]
  if (!m) return []
  return m.rules.map(r => r.join('+'))
}

export function earlyWindowFor(taskName: string): number | null {
  return CPDB_RULES[taskName]?.earlyWindowDays ?? null
}
