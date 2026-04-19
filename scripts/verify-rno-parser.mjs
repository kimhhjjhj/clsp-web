// R&O 파서 검증 — 실제 부천 삼정 엑셀로 파싱해 카테고리별 건수·합계 출력
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

// lib/rno-excel.ts 순수 함수들 복제 (ts 직접 import 불가)
const SHEET_CATEGORY_MAP = {
  '공통가설_현관R&O': '공통가설', '토목R&O': '토목', '철콘R&O': '철콘', '철골R&O': '철골',
  '습식도장R&O': '습식도장', '수장R&O': '수장', '창호판넬R&O': '창호판넬',
  '금속 및 기타R&O': '금속 및 기타', '기계R&O': '기계', '전기R&O': '전기', '소방R&O': '소방',
  '조경R&O': '조경', '장비R&O': '장비', '기타보험료R&O': '기타보험료',
}

function excelSerialToDate(v) {
  if (v == null || v === '') return null
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
    if (m) return `${m[1]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`
    const n = Number(v); if (!Number.isFinite(n)) return null; v = n
  }
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 59) return null
  const ms = (v - 25569) * 86400 * 1000
  const d = new Date(ms); if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

const wb = XLSX.read(fs.readFileSync(
  path.join(process.cwd(), 'samples', '[부천 삼정 AI 허브센터] R&O파일250924.xlsx')
), { type: 'buffer' })

const rows2DBySheet = {}
for (const name of wb.SheetNames) {
  rows2DBySheet[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', blankrows: false })
}

// 파싱 로직 인라인 (간소화)
function parse() {
  const results = []
  for (const [sheetName, rows] of Object.entries(rows2DBySheet)) {
    const category = SHEET_CATEGORY_MAP[sheetName]
    if (!category) continue
    let headerIdx = -1
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      if (String(rows[i]?.[0] ?? '').trim() === 'NO') { headerIdx = i; break }
    }
    if (headerIdx < 0) continue
    const header = rows[headerIdx].map(c => String(c ?? '').trim().replace(/\s/g, '').replace(/[⏎\n]/g, ''))
    const colIdx = {}
    header.forEach((h, i) => {
      if (h === 'NO') colIdx.code = i
      else if (h === 'REV') colIdx.rev = i
      else if (h === '제안일자') colIdx.proposedAt = i
      else if (h === '제안사') colIdx.proposer = i
      else if (h === '세부공종') colIdx.subCategory = i
      else if (h === '내용') colIdx.content = i
      else if (h === '제안금액') colIdx.proposedCost = i
      else if (h === '확정금액') colIdx.confirmedCost = i
      else if (h.startsWith('진행현황')) colIdx.progress = i
      else if (h === '확정일자') colIdx.confirmedAt = i
      else if (h === '예정완료일') colIdx.expectedAt = i
      else if (h.startsWith('설계반영')) colIdx.designApplied = i
      else if (h === '비고') colIdx.note = i
    })

    const out = []
    let propSum = 0, confSum = 0, propCnt = 0, confCnt = 0
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r || r.every(c => c == null || c === '')) continue
      const code = String(r[colIdx.code] ?? '').trim()
      if (!/^(CV|RC|ST|FN|IN|PA|MT|ME|EL|FP|LS|LL|TW)-\d+/i.test(code)) continue
      const pc = typeof r[colIdx.proposedCost] === 'number' ? r[colIdx.proposedCost] : Number(String(r[colIdx.proposedCost] ?? '').replace(/[, ]/g, ''))
      const cc = typeof r[colIdx.confirmedCost] === 'number' ? r[colIdx.confirmedCost] : Number(String(r[colIdx.confirmedCost] ?? '').replace(/[, ]/g, ''))
      if (Number.isFinite(pc)) { propSum += pc; propCnt++ }
      if (Number.isFinite(cc)) { confSum += cc; confCnt++ }
      out.push({ code, content: String(r[colIdx.content] ?? '').slice(0, 30) })
    }
    results.push({ category, count: out.length, propSum: Math.round(propSum), confSum: Math.round(confSum), propCnt, confCnt, sample: out[0] })
  }
  return results
}

const all = parse()
console.log(`파싱된 R&O 시트: ${all.length}개\n`)
let total = 0, totProp = 0, totConf = 0
for (const r of all) {
  total += r.count
  totProp += r.propSum
  totConf += r.confSum
  console.log(`  ${r.category.padEnd(14)} ${String(r.count).padStart(3)}건 · 제안합 ${String(r.propSum).padStart(6)} · 확정합 ${String(r.confSum).padStart(6)} (단위:백만) · 제안${r.propCnt}/확정${r.confCnt}`)
  if (r.sample) console.log(`    예시: ${r.sample.code} — ${r.sample.content}`)
}
console.log(`\n총 ${total}건 · 제안합 ${totProp}백만 · 확정합 ${totConf}백만`)
