import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const wb = XLSX.readFile('samples/상봉동공사일보_240620.xlsx', { cellDates: true })
const ws = wb.Sheets['상봉']
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true })

function noSpace(v) { return String(v ?? '').replace(/\s+/g, '') }
function toISODateFixed(v) {
  if (v instanceof Date) {
    const d = new Date(v.getTime())
    if (d.getHours() >= 22) {
      d.setDate(d.getDate() + 1)
      d.setHours(0, 0, 0, 0)
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return null
}

const starts = []
for (let r = 0; r < data.length; r++) {
  for (let c = 0; c < Math.min(data[r]?.length ?? 0, 3); c++) {
    if (noSpace(data[r][c]) === '공사일보') { starts.push(r); break }
  }
}

console.log(`총 ${starts.length}블록`)
console.log(`\n── 첫 5 + 마지막 5 블록 (수정 전/후 비교) ──`)
const picks = [...starts.slice(0, 5), ...starts.slice(-5)]
for (const st of picks) {
  const row = data[st] || []
  let oldDate = null, newDate = null
  for (let c = 0; c < row.length; c++) {
    const v = row[c]
    if (v instanceof Date && !oldDate) {
      oldDate = `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`
      newDate = toISODateFixed(v)
      break
    }
  }
  const changed = oldDate !== newDate ? ' ⚠️ 변경' : ''
  console.log(`R${String(st+1).padStart(6)}: 이전 ${oldDate} → 수정 ${newDate}${changed}`)
}
