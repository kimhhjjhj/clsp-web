// 특정 시트의 모든 컬럼 헤더 + 몇 행 미리보기
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const [file, sheet] = process.argv.slice(2)
const wb = XLSX.readFile(file, { cellDates: true })
const ws = wb.Sheets[sheet]
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false })

console.log(`시트: ${sheet}, 전체 ${data.length}행`)
console.log('\n── 행 1~5 전체 컬럼 ──')
for (let i = 0; i < Math.min(5, data.length); i++) {
  const row = data[i].map(c => {
    if (c instanceof Date) return c.toISOString().slice(0, 10)
    return String(c).trim().replace(/\s+/g, ' ').slice(0, 15)
  })
  console.log(`R${i + 1}:`)
  row.forEach((v, ci) => {
    if (v) console.log(`  C${ci + 1}(${XLSX.utils.encode_col(ci)}): ${v}`)
  })
}

// 첫 데이터 행 (공종별 헤더 + 숫자) 하나만
console.log('\n── 첫 데이터 행 샘플 ──')
for (let i = 2; i < Math.min(10, data.length); i++) {
  const row = data[i]
  if (row.some(c => c !== '')) {
    row.forEach((v, ci) => {
      if (v !== '' && v !== null && v !== undefined) {
        const disp = v instanceof Date ? v.toISOString().slice(0, 10) : String(v)
        console.log(`  C${ci + 1}(${XLSX.utils.encode_col(ci)}): ${disp}`)
      }
    })
    break
  }
}
