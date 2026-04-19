import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

const file = path.join(process.cwd(), 'samples', 'mep 장비성 금액 제외.xlsx')
const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' })

console.log(`시트 ${wb.SheetNames.length}:`)
for (const n of wb.SheetNames) console.log(`  - ${n}`)

for (const n of wb.SheetNames) {
  const ws = wb.Sheets[n]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false })
  console.log(`\n===== [${n}] range=${ws['!ref']} · ${rows.length}행 =====`)
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const r = rows[i]
    if (!Array.isArray(r) || r.every(c => !c)) continue
    const cells = r.slice(0, 10).map(c => {
      const s = String(c).trim().replace(/\n/g, '⏎')
      return s.length > 30 ? s.slice(0, 30) + '…' : s
    })
    console.log(`  ${String(i).padStart(2)}: ${cells.join(' | ')}`)
  }
  if (rows.length > 60) console.log(`  … +${rows.length - 60}행`)
}
