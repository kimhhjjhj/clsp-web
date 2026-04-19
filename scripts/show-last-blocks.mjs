import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const wb = XLSX.readFile('samples/상봉동공사일보_240620.xlsx', { cellDates: true })
const ws = wb.Sheets['상봉']
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true })

function noSpace(v) { return String(v ?? '').replace(/\s+/g, '') }
function iso(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  return null
}

const starts = []
for (let r = 0; r < data.length; r++) {
  for (let c = 0; c < Math.min(data[r]?.length ?? 0, 3); c++) {
    if (noSpace(data[r][c]) === '공사일보') { starts.push(r); break }
  }
}

// 마지막 3개 블록
const picks = starts.slice(-3)
for (const st of picks) {
  const end = starts[starts.indexOf(st) + 1] ?? data.length
  const dateCell = data[st]?.[4]
  const date = iso(dateCell) ?? '-'

  console.log(`\n═══════ E열 날짜: ${date} ═══════`)

  // 금일 작업 + 명일 작업 텍스트
  let workTodayRow = -1, workTomorrowRow = -1, notesRow = -1
  for (let r = st; r < end; r++) {
    const s = noSpace(data[r]?.[0])
    if (s === '금일작업내용') workTodayRow = r
    if (s === '명일작업내용') workTomorrowRow = r
    if (s === '특기사항') notesRow = r
  }

  function collect(from, to, tag) {
    if (from < 0) return
    console.log(`  [${tag}]`)
    for (let r = from + 1; r < Math.min(to, end); r++) {
      const row = data[r] || []
      for (const col of [0, 4]) {
        const s = String(row[col] ?? '').trim()
        if (!s || s.length < 3) continue
        if (/^(공사일보|금일작업|명일작업|특기사항|총계|공종|자재|장비|토공)/.test(s.replace(/\s+/g,''))) continue
        console.log(`    · ${s}`)
      }
    }
  }

  collect(workTodayRow, workTomorrowRow > 0 ? workTomorrowRow : end, '금일 작업')
  collect(workTomorrowRow, notesRow > 0 ? notesRow : end, '명일 작업')

  // 금일 투입 인원 합계 (간단하게 N열 합)
  let totalToday = 0
  const topTrades = []
  for (let r = st + 5; r < end; r++) {
    const row = data[r] || []
    const trade = String(row[9] ?? '').trim() || String(row[8] ?? '').trim()
    const today = Number(row[13] ?? 0)
    if (Number.isFinite(today) && today > 0 && trade) {
      totalToday += today
      topTrades.push(`${trade} ${today}명`)
    }
  }
  console.log(`  [금일 투입] 총 ${totalToday}명 — ${topTrades.slice(0, 6).join(', ')}`)
}
