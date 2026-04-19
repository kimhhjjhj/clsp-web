// R&O 시트 상세 컬럼·데이터 포맷 분석
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

const file = path.join(process.cwd(), 'samples', '[부천 삼정 AI 허브센터] R&O파일250924.xlsx')
const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' })

// R&O가 붙은 시트들
const rnoSheets = wb.SheetNames.filter(n => /R&O/.test(n))
console.log(`R&O 시트: ${rnoSheets.length}개`)
console.log(`샘플·공종별 R&O 구조 분석\n`)

function printSheet(name, limit = 20) {
  const ws = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false })
  console.log(`\n===== [${name}] range=${ws['!ref']} =====`)
  // 실제 컬럼명 영역 찾기 — 첫 5행 원시 출력
  for (let i = 0; i < Math.min(limit, rows.length); i++) {
    const r = rows[i]
    if (!Array.isArray(r) || r.every(c => !c)) { console.log(`  ${String(i).padStart(2)}: (빈 행)`); continue }
    const cells = r.map(c => {
      const s = String(c).trim().replace(/\n/g, '⏎')
      return s.length > 22 ? s.slice(0, 22) + '…' : s
    })
    console.log(`  ${String(i).padStart(2)}: ${cells.slice(0, 15).join(' | ')}`)
  }
}

// 샘플R&O (양식) + 토목·철콘·전기·기계 각각
const targets = ['샘플R&O', '토목R&O', '철콘R&O', '전기R&O', '기계R&O']
for (const t of targets) {
  if (wb.SheetNames.includes(t)) printSheet(t, 25)
}
