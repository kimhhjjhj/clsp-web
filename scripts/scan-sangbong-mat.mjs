import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const wb = XLSX.readFile('samples/상봉동공사일보_240620.xlsx', { cellDates: true })
const ws = wb.Sheets['Sheet1']
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true })
// 첫 블록 R67~R100 (자재/장비 영역)
console.log('── 첫 블록 R60~R100 (토공/자재/장비) ──')
for (let r = 58; r < 102; r++) {
  const row = data[r]
  if (!row || row.every(c => c === '')) continue
  const cells = row.slice(0, 22).map((c, i) => {
    if (c === '' || c == null) return null
    let s = c instanceof Date ? c.toISOString().slice(0,10) : String(c)
    s = s.replace(/\s+/g, ' ').trim()
    if (s.length > 20) s = s.slice(0,17) + '..'
    return `[${String.fromCharCode(65+i)}]${s}`
  }).filter(Boolean)
  console.log(`R${String(r+1).padStart(3)} │ ${cells.join(' · ')}`)
}
