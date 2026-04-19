import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)

// tsx 없이 실행: lib/excel-import/paju-parser.ts 대신 직접 xlsx 써서 파싱 흉내
const XLSX = require('xlsx')
const file = process.argv[2]
const buf = fs.readFileSync(file)
const wb = XLSX.read(buf, { cellDates: true })

function parseBlocked(ws, nameField, qtyField) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false })
  let subRow = -1
  for (let r = 0; r < 8; r++) {
    for (let c = 2; c < (data[r]?.length ?? 0); c++) {
      if (String(data[r][c] ?? '').trim() === nameField) { subRow = r; break }
    }
    if (subRow >= 0) break
  }
  if (subRow < 0) return { blocks: 0, days: 0, entries: 0, sample: [] }
  const headerRow = data[subRow]
  const blockStarts = []
  for (let c = 2; c < headerRow.length; c++) {
    if (String(headerRow[c] ?? '').trim() === nameField) blockStarts.push(c)
  }
  const blocks = blockStarts.map((start, i) => {
    const end = blockStarts[i + 1] ?? Math.min(start + 8, headerRow.length)
    const fields = {}
    for (let c = start; c < end; c++) {
      const key = String(headerRow[c] ?? '').trim()
      if (key) fields[key] = c
    }
    return { start, end, fields }
  })
  let days = 0, entries = 0
  const sample = []
  for (let r = subRow + 1; r < data.length; r++) {
    const row = data[r]
    const v = row[0]
    let iso = null
    if (v instanceof Date) iso = v.toISOString().slice(0, 10)
    else if (typeof v === 'number') {
      const d = XLSX.SSF.parse_date_code(v)
      if (d) iso = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
    } else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) iso = v.slice(0, 10)
    if (!iso) continue
    let dayEntries = 0
    for (const b of blocks) {
      const name = String(row[b.fields[nameField]] ?? '').trim()
      const qty = Number(row[b.fields[qtyField]])
      if (name && Number.isFinite(qty) && qty > 0) {
        dayEntries++
        if (sample.length < 5) sample.push({ date: iso, name, qty })
      }
    }
    if (dayEntries > 0) { days++; entries += dayEntries }
  }
  return { blocks: blocks.length, days, entries, sample }
}

console.log('\n── 자재반입1 ──')
const matRes = parseBlocked(wb.Sheets['자재반입1'], '품명', '수량')
console.log(matRes)

console.log('\n── 장비투입1 ──')
const eqRes = parseBlocked(wb.Sheets['장비투입1'], '장비명', '가동대수')
console.log(eqRes)
