import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const wb = XLSX.readFile('samples/상봉동공사일보_240620.xlsx', { cellDates: true })

function toISO(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  return null
}
function noSpace(v) { return String(v ?? '').replace(/\s+/g, '') }

for (const sname of ['Sheet1', '상봉']) {
  const ws = wb.Sheets[sname]
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true })
  const starts = []
  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < Math.min(data[r]?.length ?? 0, 3); c++) {
      if (noSpace(data[r][c]) === '공사일보') { starts.push(r); break }
    }
  }

  console.log(`\n═══ ${sname} (${starts.length}블록) ═══`)
  // 첫 블록과 마지막 블록
  const picks = [starts[0], starts[starts.length - 1]]
  for (const st of picks) {
    console.log(`\n─ 블록 R${st+1} 상세 (st=${st}) ─`)
    // 첫 8행 전체 스캔, 모든 Date/ISO 추출
    for (let r = st; r < Math.min(st + 8, data.length); r++) {
      const row = data[r] || []
      const found = []
      for (let c = 0; c < Math.min(row.length, 20); c++) {
        const iso = toISO(row[c])
        if (iso) found.push(`${String.fromCharCode(65+c)}${r+1}=${iso}`)
      }
      if (found.length > 0) console.log(`  ${found.join(' · ')}`)
    }
  }
}
