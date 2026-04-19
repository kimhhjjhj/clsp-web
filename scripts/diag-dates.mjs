import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

// cellFormula: true 로 수식까지 받아오기
const wb = XLSX.readFile('samples/상봉동공사일보_240620.xlsx', {
  cellDates: true,
  cellFormula: true,
  cellText: false,
})

const ws = wb.Sheets['상봉']

// 마지막 블록의 E셀 직접 접근 (E108624)
function inspect(addr) {
  const cell = ws[addr]
  if (!cell) return console.log(`${addr}: 없음`)
  console.log(`\n━ 셀 ${addr} ━`)
  console.log(`  t (type)      : ${cell.t}`)
  console.log(`  v (value)     : ${cell.v}`)
  if (cell.v instanceof Date) {
    console.log(`    └ Date UTC    : ${cell.v.toISOString()}`)
    console.log(`    └ getFullY/M/D: ${cell.v.getFullYear()}-${cell.v.getMonth()+1}-${cell.v.getDate()}`)
    console.log(`    └ getUTCY/M/D : ${cell.v.getUTCFullYear()}-${cell.v.getUTCMonth()+1}-${cell.v.getUTCDate()}`)
    console.log(`    └ time value  : ${cell.v.getTime()}`)
  }
  console.log(`  f (formula)   : ${cell.f ?? '(없음)'}`)
  console.log(`  w (formatted) : ${cell.w ?? '(없음)'}`)
  console.log(`  z (fmt code)  : ${cell.z ?? '(없음)'}`)
}

// 마지막 몇 블록의 E셀
for (const row of [108503, 108624]) {
  inspect(`E${row}`)
  inspect(`F${row}`)
}

// 시스템 타임존
console.log(`\n━ 시스템 ━`)
console.log(`  TZ offset: ${new Date().getTimezoneOffset()} (분) — 음수면 UTC+, 양수면 UTC-`)
console.log(`  now local: ${new Date().toString()}`)
console.log(`  now ISO  : ${new Date().toISOString()}`)
