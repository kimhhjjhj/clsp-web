// 엑셀 파일 구조 스캔 — 시트명, 각 시트 크기, 첫 30행 미리보기
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('사용법: node scripts/scan-excel.mjs <파일1> [<파일2> ...]')
  process.exit(1)
}

for (const f of files) {
  const abs = path.resolve(f)
  console.log('\n' + '='.repeat(80))
  console.log('📄 ' + abs)
  console.log('크기: ' + (fs.statSync(abs).size / 1024 / 1024).toFixed(2) + ' MB')
  console.log('='.repeat(80))

  const wb = XLSX.readFile(abs, { cellDates: true, cellNF: false, cellText: false })
  console.log('\n시트 개수: ' + wb.SheetNames.length)
  console.log('시트 목록:')
  wb.SheetNames.forEach((n, i) => {
    const ws = wb.Sheets[n]
    const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null
    const rows = range ? range.e.r - range.s.r + 1 : 0
    const cols = range ? range.e.c - range.s.c + 1 : 0
    console.log(`  [${i}] ${n}  —  ${rows}행 × ${cols}열`)
  })

  // 특정 시트 프리뷰 가능 (--sheet=이름)
  const sheetArg = process.env.SHEET
  const firstSheet = sheetArg && wb.SheetNames.includes(sheetArg) ? sheetArg : wb.SheetNames[0]
  const ws = wb.Sheets[firstSheet]
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false })
  console.log(`\n── 첫 시트 "${firstSheet}" 프리뷰 (처음 30행) ──`)
  data.slice(0, 30).forEach((row, i) => {
    const cleaned = row.map(c => {
      if (c instanceof Date) return c.toISOString().slice(0, 10)
      const s = String(c).trim()
      return s.length > 30 ? s.slice(0, 27) + '...' : s
    })
    const nonEmpty = cleaned.filter(c => c !== '').length
    if (nonEmpty === 0) return
    console.log(`R${String(i + 1).padStart(3)} │ ` + cleaned.slice(0, 15).join(' │ '))
  })

  console.log(`\n(전체 ${data.length}행)`)
}
