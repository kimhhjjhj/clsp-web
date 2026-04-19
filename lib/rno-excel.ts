// ═══════════════════════════════════════════════════════════
// R&O 엑셀 ↔ DB 변환 ((주)동양 건설부문 실무 양식 호환)
//
// 엑셀 포맷:
// - 시트명: "토목R&O", "철콘R&O", "전기R&O" 등 "XR&O" 패턴
// - 행 3: 헤더 (NO | REV | 제안일자 | 날짜(함수용) | 제안사 | 세부공종 | 내용 | 제안금액 | 확정금액 | 진행현황 | 확정일자 | 예정완료일 | 설계반영 | 비고)
// - 행 4~ : 데이터 (NO가 비어있으면 유효하지 않은 행)
// - 금액 단위: 백만원
// - 날짜: Excel serial (45720 = 2025-03-26)
// ═══════════════════════════════════════════════════════════

// 시트명 → 표준 카테고리 매핑
const SHEET_CATEGORY_MAP: Record<string, string> = {
  '공통가설_현관R&O': '공통가설',
  '토목R&O':         '토목',
  '철콘R&O':         '철콘',
  '철골R&O':         '철골',
  '습식도장R&O':     '습식도장',
  '수장R&O':         '수장',
  '창호판넬R&O':     '창호판넬',
  '금속 및 기타R&O': '금속 및 기타',
  '기계R&O':         '기계',
  '전기R&O':         '전기',
  '소방R&O':         '소방',
  '조경R&O':         '조경',
  '장비R&O':         '장비',
  '기타보험료R&O':   '기타보험료',
}

export interface RnoRow {
  code: string | null        // "CV-001"
  rev: number | null
  subCategory: string | null
  proposer: string | null
  proposedAt: string | null  // YYYY-MM-DD
  content: string
  proposedCost: number | null
  confirmedCost: number | null
  progress: string | null
  confirmedAt: string | null
  expectedAt: string | null
  designApplied: string | null
  note: string | null
}

export interface ParsedRno {
  category: string
  rows: RnoRow[]
  summary: { proposedSum: number; confirmedSum: number; proposedCount: number; confirmedCount: number }
}

// Excel serial(1900 기준) → YYYY-MM-DD
export function excelSerialToDate(v: unknown): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'string') {
    // 이미 YYYY-MM-DD거나 유사 문자열
    const m = v.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
    if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[3])).padStart(2, '0')}`
    const n = Number(v)
    if (!Number.isFinite(n)) return null
    v = n
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  // 1900 기준, 윤년 오버플로우 고려 (Excel 1900-02-29 버그 감안)
  if (v < 59) return null  // 너무 과거 무시
  const ms = (v - 25569) * 86400 * 1000  // 25569 = 1970-01-01
  const d = new Date(ms)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function toNumberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[, ]/g, ''))
  return Number.isFinite(n) ? n : null
}

function normalizeProgress(v: unknown): string | null {
  if (!v) return null
  const s = String(v).trim()
  if (!s) return null
  // 허용된 값으로 한정
  if (['진행', '확정', '미반영', '재검토'].includes(s)) return s
  // 부분 일치 (공백·괄호 제거)
  const clean = s.replace(/[\s()（）]/g, '')
  if (clean.includes('확정')) return '확정'
  if (clean.includes('미반영')) return '미반영'
  if (clean.includes('재검토')) return '재검토'
  if (clean.includes('진행')) return '진행'
  return s  // 원문 유지
}

function normalizeDesign(v: unknown): string | null {
  if (v == null || v === '') return null
  const s = String(v).trim()
  if (!s || s === '-') return '-'
  if (/^y(es)?$/i.test(s)) return 'Yes'
  if (/^no?$/i.test(s)) return 'No'
  return s
}

/**
 * 워크북 전체 파싱 — R&O 시트만 추출해 카테고리별 파싱 결과 반환
 */
export function parseRnoWorkbook(rows2DBySheet: Record<string, unknown[][]>): ParsedRno[] {
  const results: ParsedRno[] = []

  for (const [sheetName, rows] of Object.entries(rows2DBySheet)) {
    const category = SHEET_CATEGORY_MAP[sheetName]
    if (!category) continue  // R&O 시트 아니거나 매핑 없으면 skip

    // 헤더 행 찾기 — 'NO'로 시작하는 행
    let headerIdx = -1
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const first = String(rows[i]?.[0] ?? '').trim()
      if (first === 'NO') { headerIdx = i; break }
    }
    if (headerIdx < 0) continue

    const header = rows[headerIdx].map(c => String(c ?? '').trim())
    // 컬럼 인덱스 추정 — 샘플R&O는 '날짜(함수용)' 없지만 나머지엔 있음
    const colIdx: Record<string, number> = {}
    header.forEach((h, i) => {
      const clean = h.replace(/\s/g, '').replace(/[⏎\n]/g, '')
      if (clean === 'NO') colIdx.code = i
      else if (clean === 'REV') colIdx.rev = i
      else if (clean === '제안일자') colIdx.proposedAt = i
      else if (clean === '제안사') colIdx.proposer = i
      else if (clean === '세부공종') colIdx.subCategory = i
      else if (clean === '내용') colIdx.content = i
      else if (clean === '제안금액') colIdx.proposedCost = i
      else if (clean === '확정금액') colIdx.confirmedCost = i
      else if (clean.startsWith('진행현황')) colIdx.progress = i
      else if (clean === '확정일자') colIdx.confirmedAt = i
      else if (clean === '예정완료일') colIdx.expectedAt = i
      else if (clean.startsWith('설계반영')) colIdx.designApplied = i
      else if (clean === '비고') colIdx.note = i
    })

    const out: RnoRow[] = []
    let proposedSum = 0, confirmedSum = 0, proposedCount = 0, confirmedCount = 0

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r || r.every(c => c == null || c === '')) continue
      const code = String(r[colIdx.code] ?? '').trim()
      const content = String(r[colIdx.content] ?? '').trim()
      // code 없고 content도 없으면 공백/집계 행 (skip)
      if (!code && !content) continue
      // 내용만 있는 메모 행은 살리되, code 없으면 유효 R&O 아님 → skip (사용자 판단)
      if (!code || /^(CV|RC|ST|FN|IN|PA|MT|ME|EL|FP|LS|LL|TW)-\d+/i.test(code) === false) continue
      // 샘플 양식 placeholder 제거 (XX-000 이면서 내용에 안내문/지시 텍스트)
      if (/\-0+$/.test(code)) {
        if (!content || /(지우지\s*말것|R&O\s*내용\s*입력|예시|샘플|입력\s*양식|TEMPLATE)/i.test(content)) continue
        if (/입력$/.test(content)) continue  // '제안금액입력', '확정금액 입력' 같은 placeholder
      }

      const proposedCost = toNumberOrNull(r[colIdx.proposedCost])
      const confirmedCost = toNumberOrNull(r[colIdx.confirmedCost])
      if (proposedCost != null) { proposedSum += proposedCost; proposedCount++ }
      if (confirmedCost != null) { confirmedSum += confirmedCost; confirmedCount++ }

      out.push({
        code,
        rev: toNumberOrNull(r[colIdx.rev]) != null ? Math.round(toNumberOrNull(r[colIdx.rev])!) : null,
        subCategory: String(r[colIdx.subCategory] ?? '').trim() || null,
        proposer: String(r[colIdx.proposer] ?? '').trim() || null,
        proposedAt: excelSerialToDate(r[colIdx.proposedAt]),
        content,
        proposedCost,
        confirmedCost,
        progress: normalizeProgress(r[colIdx.progress]),
        confirmedAt: excelSerialToDate(r[colIdx.confirmedAt]),
        expectedAt: excelSerialToDate(r[colIdx.expectedAt]),
        designApplied: normalizeDesign(r[colIdx.designApplied]),
        note: String(r[colIdx.note] ?? '').trim() || null,
      })
    }

    results.push({
      category,
      rows: out,
      summary: {
        proposedSum: Math.round(proposedSum * 10) / 10,
        confirmedSum: Math.round(confirmedSum * 10) / 10,
        proposedCount,
        confirmedCount,
      },
    })
  }

  return results
}

/**
 * R&O 배열 → 엑셀 헤더·행 생성 (export용)
 */
export const RNO_EXPORT_HEADER = [
  'NO', 'REV', '제안일자', '제안사', '세부공종', '내용',
  '제안금액(백만)', '확정금액(백만)', '진행현황', '확정일자', '예정완료일', '설계반영', '비고',
]

export function rnoRowToExcelArray(r: RnoRow): (string | number | null)[] {
  return [
    r.code ?? '',
    r.rev ?? 0,
    r.proposedAt ?? '',
    r.proposer ?? '',
    r.subCategory ?? '',
    r.content,
    r.proposedCost ?? '',
    r.confirmedCost ?? '',
    r.progress ?? '',
    r.confirmedAt ?? '',
    r.expectedAt ?? '',
    r.designApplied ?? '',
    r.note ?? '',
  ]
}
