import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

// paju-parser 대신 작업사항 시트에서 직접 텍스트 추출
const file = process.argv[2] || 'samples/파주스튜디오 일보_김현재.xlsx'
const wb = XLSX.readFile(file, { cellDates: true })
const ws = wb.Sheets['작업사항1']
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false })

// extractor 재구현 (inline, 테스트용)
const WORK_TYPE_KEYWORDS = [
  { key: '철근', patterns: ['철근'] },
  { key: '형틀', patterns: ['형틀', '거푸집'] },
  { key: '콘크리트', patterns: ['콘크리트', '타설', '레미콘'] },
  { key: '해체', patterns: ['해체', '탈형'] },
  { key: '철골', patterns: ['철골'] },
  { key: '조적', patterns: ['조적', '블록', '벽돌'] },
  { key: '미장', patterns: ['미장'] },
  { key: '방수', patterns: ['방수'] },
  { key: '타일', patterns: ['타일'] },
  { key: '도장', patterns: ['도장', '페인트'] },
  { key: '창호', patterns: ['창호', '유리'] },
  { key: '내장', patterns: ['내장', '석고보드', '경량'] },
  { key: '설비배관', patterns: ['설비', '배관', '덕트', '오배수', '급수'] },
  { key: '전기배선', patterns: ['전기', '배선', '간선', '포설'] },
  { key: '가설', patterns: ['가설전기', '가설울타리', '호이스트', '타워크레인'] },
  { key: '청소', patterns: ['청소', '정리', '하역'] },
]

function extract(text) {
  const buildings = new Set()
  const floors = new Set()
  const workTypes = new Set()
  if (!text) return { buildings: [], floors: [], workTypes: [] }
  let m
  const bp = /(\d{1,3})\s*동/g
  while ((m = bp.exec(text)) !== null) buildings.add(`${m[1]}동`)
  const fp1 = /(\d{1,2})\s*F(?![a-z])/g
  while ((m = fp1.exec(text)) !== null) floors.add(`${m[1]}F`)
  const fp2 = /(옥상|옥탑|피트|지붕|전실)/g
  while ((m = fp2.exec(text)) !== null) floors.add(m[1])
  const fp3 = /지하\s*(\d+)\s*층/g
  while ((m = fp3.exec(text)) !== null) floors.add(`B${m[1]}F`)
  for (const w of WORK_TYPE_KEYWORDS) {
    for (const p of w.patterns) {
      if (text.includes(p)) { workTypes.add(w.key); break }
    }
  }
  return {
    buildings: Array.from(buildings),
    floors: Array.from(floors),
    workTypes: Array.from(workTypes),
  }
}

// 데이터 행에서 텍스트 수집 (마지막 500행부터 최대 30개)
const samples = []
const start = Math.max(2, data.length - 500)
for (let r = start; r < data.length && samples.length < 30; r++) {
  const row = data[r]
  for (let c = 2; c < row.length; c++) {
    const s = String(row[c] ?? '').trim()
    if (s && !/^Rev\./.test(s) && s.length > 5 && !/^작업\s*사항/.test(s)) {
      samples.push(s)
      if (samples.length >= 30) break
    }
  }
}

console.log(`총 테스트 샘플: ${samples.length}개\n`)
let hit = { b: 0, f: 0, w: 0 }
for (const s of samples) {
  const r = extract(s)
  if (r.buildings.length) hit.b++
  if (r.floors.length) hit.f++
  if (r.workTypes.length) hit.w++
  console.log('───')
  console.log('원문:', s.slice(0, 80))
  console.log(
    `  → 동: [${r.buildings.join(', ') || '-'}]  층: [${r.floors.join(', ') || '-'}]  작업: [${r.workTypes.join(', ') || '-'}]`
  )
}
console.log('\n── 정규식 적중률 ──')
console.log(`동 검출:   ${hit.b}/${samples.length} (${Math.round(hit.b/samples.length*100)}%)`)
console.log(`층 검출:   ${hit.f}/${samples.length} (${Math.round(hit.f/samples.length*100)}%)`)
console.log(`작업 검출: ${hit.w}/${samples.length} (${Math.round(hit.w/samples.length*100)}%)`)
