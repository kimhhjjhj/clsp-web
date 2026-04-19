// 상봉동 일보 구조 정밀 분석 — 블록 패턴 찾기
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const file = 'samples/상봉동공사일보_240620.xlsx'
const wb = XLSX.readFile(file, { cellDates: true })
const ws = wb.Sheets['Sheet1']
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false })

console.log(`총 ${data.length}행\n`)

// "공사일보" 타이틀 위치 찾기 (공백 제거해서 매칭)
console.log('── "공사일보" 타이틀 행 위치 (처음 10개) ──')
const blockStarts = []
for (let r = 0; r < data.length; r++) {
  for (let c = 0; c < (data[r]?.length ?? 0); c++) {
    const s = String(data[r][c] ?? '').replace(/\s/g, '')
    if (s === '공사일보') {
      blockStarts.push({ row: r, col: c })
      break
    }
  }
}
console.log(`총 ${blockStarts.length}개 블록 발견`)
for (const b of blockStarts.slice(0, 5)) {
  console.log(`  R${b.row + 1}, C${b.col + 1}`)
}
if (blockStarts.length > 1) {
  const gaps = []
  for (let i = 1; i < Math.min(blockStarts.length, 20); i++) {
    gaps.push(blockStarts[i].row - blockStarts[i - 1].row)
  }
  console.log(`블록 간 행 간격 (처음 20): ${gaps.join(', ')}`)
  const avg = gaps.reduce((s, n) => s + n, 0) / gaps.length
  console.log(`평균 ${avg.toFixed(1)}행`)
}

// 첫 블록 자세히 (200행까지)
console.log('\n── 첫 블록 상세 (최대 100행) ──')
const start = blockStarts[0]?.row ?? 0
const end = Math.min(start + 100, blockStarts[1]?.row ?? data.length)
for (let r = start; r < end; r++) {
  const row = data[r]
  if (!row || row.every(c => c === '')) continue
  const cells = row.slice(0, 20).map((c, i) => {
    if (c === '' || c == null) return null
    let s = c instanceof Date ? c.toISOString().slice(0, 10) : String(c)
    s = s.replace(/\s+/g, ' ').trim()
    if (s.length > 25) s = s.slice(0, 22) + '...'
    return `[${String.fromCharCode(65 + i)}]${s}`
  }).filter(Boolean)
  console.log(`R${String(r + 1).padStart(4)} │ ${cells.join(' · ')}`)
}
