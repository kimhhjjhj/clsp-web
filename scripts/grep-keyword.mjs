// samples의 모든 엑셀에서 특정 키워드 포함 문장 추출
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const keyword = process.argv[2] || '벽체'
const maxShow = Number(process.argv[3] ?? 20)

const files = fs.readdirSync('samples').filter(f => f.endsWith('.xlsx'))

const hits = []

for (const f of files) {
  const wb = XLSX.readFile(`samples/${f}`, { cellDates: true })
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false })
    for (let r = 0; r < data.length; r++) {
      const row = data[r]
      for (let c = 0; c < row.length; c++) {
        const s = String(row[c] ?? '').trim()
        if (s.includes(keyword) && s.length >= 4 && s.length < 100) {
          hits.push({ file: f, sheet: sheetName, row: r + 1, text: s })
        }
      }
    }
  }
}

// 중복 제거 (text 기준)
const unique = Array.from(new Map(hits.map(h => [h.text, h])).values())

console.log(`\n"${keyword}" 포함 문장: 총 ${hits.length}건, 중복제거 ${unique.length}건\n`)
console.log(`── 샘플 ${Math.min(maxShow, unique.length)}건 ──`)
for (const h of unique.slice(0, maxShow)) {
  console.log(`[${h.sheet}] ${h.text}`)
}
