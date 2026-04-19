import XLSX from 'xlsx'
import fs from 'fs'

const file = 'samples/01.상봉동_준공내역서(하자이행증권 발행용)_24.07.02.xlsx'
const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' })

// 총괄집계 + 각 공종 집계표 샘플
const targets = ['집계표', '총괄집계', '공통가설집계', '토목집계', '건축집계', '설비집계', '전기집계', '전기소방집계', '기계소방집계']

for (const name of targets) {
  if (!wb.Sheets[name]) continue
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
  console.log(`\n━━━ [${name}] ${rows.length}행 ━━━`)
  // 금액 있는 행 위주로 상위 40행
  let shown = 0
  for (let i = 0; i < rows.length && shown < 40; i++) {
    const r = rows[i].map(c => String(c ?? '').slice(0, 40))
    if (r.every(c => !c)) continue
    console.log(`  ${String(i + 1).padStart(3)}: ${r.join(' | ')}`)
    shown++
  }
}
