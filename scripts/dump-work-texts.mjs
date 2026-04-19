// 파주 엑셀에서 작업 관련 텍스트 전체 추출 → 빈도순 리스트
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const file = process.argv[2] || 'samples/파주스튜디오 일보_김현재.xlsx'
const wb = XLSX.readFile(file, { cellDates: true })

const SHEETS = [
  '작업사항1', '작업사항2',
  '작업계획1', '작업계획2',
  '특기사항1', '특기사항2',
]

const allTexts = []
for (const name of SHEETS) {
  const ws = wb.Sheets[name]
  if (!ws) continue
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false })
  for (let r = 0; r < data.length; r++) {
    const row = data[r]
    // 헤더 행 skip (B열이 "요일")
    if (String(row[1] ?? '').trim() === '요일') continue
    // 첫 셀이 날짜가 아닌 행도 skip (타이틀 등)
    const first = row[0]
    const isDate = first instanceof Date || typeof first === 'number' ||
      (typeof first === 'string' && /^\d{4}-\d{2}-\d{2}/.test(first))
    if (!isDate && r < 3) continue

    for (let c = 2; c < row.length; c++) {
      const s = String(row[c] ?? '').trim()
      if (!s || s.length < 3) continue
      if (/^Rev\./i.test(s)) continue
      if (/^(작업\s*(사항|계획)\d+|특기사항\d+)$/.test(s)) continue // 헤더 텍스트
      allTexts.push(s)
    }
  }
}

// 중복 제거 (완전 동일한 것)
const unique = Array.from(new Set(allTexts))

console.log(`총 텍스트: ${allTexts.length}건, 중복 제거 후: ${unique.length}건`)

// 샘플 500개 균등 샘플링
const N = Math.min(500, unique.length)
const step = unique.length / N
const samples = []
for (let i = 0; i < N; i++) {
  samples.push(unique[Math.floor(i * step)])
}

// 파일 저장
fs.writeFileSync('scripts/work-samples.txt', samples.join('\n'), 'utf8')
console.log(`\n${samples.length}개 샘플을 scripts/work-samples.txt에 저장`)

// 빈도 분석: 2~4글자 단어 top 50
const wordCount = new Map()
for (const t of unique) {
  // 공백, 특수문자 기준으로 분리
  const words = t.split(/[\s,.:;·()\/\-~]+/).filter(w => w.length >= 2 && w.length <= 6)
  for (const w of words) {
    if (/^\d+$/.test(w)) continue // 숫자만은 제외
    wordCount.set(w, (wordCount.get(w) ?? 0) + 1)
  }
}
const topWords = Array.from(wordCount.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 80)

console.log('\n── 빈도 TOP 80 단어 ──')
for (const [w, c] of topWords) {
  console.log(`${c.toString().padStart(4)} | ${w}`)
}
