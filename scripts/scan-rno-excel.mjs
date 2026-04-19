// 샘플 R&O 엑셀 구조 파악 — 시트·컬럼·데이터 분포 분석
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

const file = path.join(process.cwd(), 'samples', '[부천 삼정 AI 허브센터] R&O파일250924.xlsx')
const buf = fs.readFileSync(file)
const wb = XLSX.read(buf, { type: 'buffer' })

console.log(`=== 파일: ${path.basename(file)} ===`)
console.log(`시트 (${wb.SheetNames.length}):`)
for (const name of wb.SheetNames) console.log(`  - ${name}`)

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]
  const range = ws['!ref']
  console.log(`\n── [${name}] range=${range} ──`)

  // 헤더 영역 추정: 첫 15행 전체 출력
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false })
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = rows[i]
    if (!Array.isArray(r) || r.every(c => !c)) continue
    const preview = r.slice(0, 12).map(c => {
      const s = String(c).trim()
      return s.length > 18 ? s.slice(0, 18) + '…' : s.padEnd(18)
    }).join(' | ')
    console.log(`  ${String(i).padStart(2)}: ${preview}`)
  }
  if (rows.length > 15) console.log(`  … +${rows.length - 15}행`)
}
