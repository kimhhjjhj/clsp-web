import XLSX from 'xlsx'
import fs from 'fs'

const file = 'samples/01.상봉동_준공내역서(하자이행증권 발행용)_24.07.02.xlsx'
const buf = fs.readFileSync(file)
const wb = XLSX.read(buf, { type: 'buffer' })

console.log('=== 시트 목록 ===')
wb.SheetNames.forEach((n, i) => console.log(`${i+1}. ${n}`))

for (const name of wb.SheetNames.slice(0, 20)) {
  const ws = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  console.log(`\n=== [${name}] ${rows.length}행 ===`)
  // 상위 10행만
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const r = rows[i].map(c => String(c ?? '').slice(0, 30))
    if (r.every(c => !c)) continue
    console.log(`  ${String(i + 1).padStart(3)}: ${r.join(' | ')}`)
  }
}
