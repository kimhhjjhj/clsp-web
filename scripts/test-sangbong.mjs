// sangbong-parser.ts 로직 검증 (ts 재컴파일 없이 핵심 로직만 복제)
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const file = 'samples/상봉동공사일보_240620.xlsx'
const buf = fs.readFileSync(file)
const wb = XLSX.read(buf, { cellDates: true })

function noSpace(v) { return String(v ?? '').replace(/\s+/g, '') }
function normStr(v) {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).trim()
}
function toISODate(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  return null
}

const daysMap = new Map()
let totalBlocks = 0

for (const sheet of wb.SheetNames) {
  const ws = wb.Sheets[sheet]
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true })
  const starts = []
  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < Math.min((data[r]?.length ?? 0), 3); c++) {
      if (noSpace(data[r][c]) === '공사일보') { starts.push(r); break }
    }
  }
  totalBlocks += starts.length
  console.log(`시트 "${sheet}": ${starts.length}개 블록`)

  for (let i = 0; i < starts.length; i++) {
    const st = starts[i]
    const en = starts[i + 1] ?? Math.min(st + 200, data.length)

    let date = null, weather = null
    for (let r = st; r < Math.min(st + 6, en); r++) {
      const row = data[r] || []
      for (let c = 0; c < row.length; c++) {
        const iso = toISODate(row[c])
        if (iso && !date) date = iso
        const s = normStr(row[c])
        if (!weather && /^(맑음|흐림|비|눈|구름)/.test(s)) weather = s
      }
    }
    if (!date) continue

    // 투입인원 헤더
    let mpHeader = -1
    for (let r = st; r < en; r++) {
      if (noSpace(data[r]?.[8]) === '공종' && noSpace(data[r]?.[11]) === '업체명') {
        mpHeader = r; break
      }
    }
    let totalR = -1
    for (let r = mpHeader + 1; r < en; r++) {
      if (noSpace(data[r]?.[8]) === '총계') { totalR = r; break }
    }
    const mp = []
    let lastCat = '', lastSub = '', lastCo = ''
    const mpEnd = totalR > 0 ? totalR : (mpHeader + 50)
    if (mpHeader > 0) {
      for (let r = mpHeader + 1; r < mpEnd; r++) {
        const row = data[r] || []
        const bc = normStr(row[8]), sub = normStr(row[9]), co = normStr(row[11])
        const today = Number(row[13] ?? 0), tot = Number(row[14] ?? 0), yest = Number(row[12] ?? 0)
        if (bc) lastCat = bc
        if (sub) lastSub = sub
        if (co) lastCo = co
        const trade = sub || lastSub || bc || lastCat
        if (!trade) continue
        if (today === 0 && tot === 0 && yest === 0) continue
        mp.push({ trade, company: co || lastCo, yest, today, tot })
      }
    }

    if (!daysMap.has(date) || daysMap.get(date).mp.length < mp.length) {
      daysMap.set(date, { date, weather, mp })
    }
  }
}

const days = Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date))
console.log(`\n총 블록: ${totalBlocks}, 고유 날짜: ${days.length}`)
console.log(`기간: ${days[0]?.date} ~ ${days[days.length-1]?.date}`)

console.log('\n── 샘플 5일 (첫, 중간, 마지막) ──')
const samples = [days[0], days[Math.floor(days.length/4)], days[Math.floor(days.length/2)], days[days.length-2], days[days.length-1]].filter(Boolean)
for (const d of samples) {
  console.log(`\n📅 ${d.date} ${d.weather ?? ''} — 업체 ${d.mp.length}개`)
  d.mp.filter(m => m.today > 0).slice(0, 8).forEach(m => {
    console.log(`  ${m.trade.padEnd(14)} │ ${m.company.padEnd(20)} │ 금일 ${m.today} · 누계 ${m.tot}`)
  })
  if (d.mp.filter(m => m.today > 0).length === 0) console.log('  (금일 투입 0)')
}
