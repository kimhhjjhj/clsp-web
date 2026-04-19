import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const wb = XLSX.readFile('samples/상봉동공사일보_240620.xlsx', { cellDates: true })

function noSpace(v) { return String(v ?? '').replace(/\s+/g, '') }
function toISO(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  return null
}

// 두 시트 비교
for (const sname of ['Sheet1', '상봉']) {
  const ws = wb.Sheets[sname]
  if (!ws) continue
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true })
  const starts = []
  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < Math.min(data[r]?.length ?? 0, 3); c++) {
      if (noSpace(data[r][c]) === '공사일보') { starts.push(r); break }
    }
  }

  console.log(`\n── 시트 "${sname}" (${starts.length}블록) ──`)
  console.log('블록 | R.titleDate (E) | R.weatherDate (I) | 요일 차이')

  // 첫 5 + 마지막 5
  const picks = [...starts.slice(0, 3), ...starts.slice(-5)]
  for (const st of picks) {
    const row0 = data[st] || []      // 타이틀 행
    const row2 = data[st + 2] || []  // 기상 행 (보통 블록의 4번째 행, 인덱스 +2)
    const row3 = data[st + 3] || []  // 혹시 한 행 더 아래

    // 타이틀 행에서 날짜 찾기 (보통 E 또는 D)
    let titleDate = null
    for (let c = 3; c < 9; c++) {
      const d = toISO(row0[c])
      if (d) { titleDate = { col: String.fromCharCode(65+c), value: d }; break }
    }
    // 기상 행에서 날짜 찾기 (보통 I)
    let weatherDate = null
    for (const row of [row2, row3]) {
      for (let c = 7; c < 13; c++) {
        const d = toISO(row[c])
        if (d) { weatherDate = { col: String.fromCharCode(65+c), value: d }; break }
      }
      if (weatherDate) break
    }

    const diff = (titleDate && weatherDate)
      ? (new Date(weatherDate.value).getTime() - new Date(titleDate.value).getTime()) / 86400000
      : null

    console.log(
      `R${String(st+1).padStart(5)} | ${titleDate?.value ?? '-'} (${titleDate?.col ?? ''}) | ${weatherDate?.value ?? '-'} (${weatherDate?.col ?? ''}) | ${diff !== null ? diff + '일' : '?'}`
    )
  }
}
