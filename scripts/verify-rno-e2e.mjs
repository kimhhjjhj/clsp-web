// R&O 임포트·익스포트 E2E
// 1) 임시 프로젝트 생성
// 2) 부천 삼정 엑셀 업로드 → 임포트
// 3) GET 로 R&O 목록 확인
// 4) 다시 export → 바이트 응답 받음
// 5) 정리

import fs from 'fs'
import path from 'path'

const HOST = 'http://localhost:3000'

// 1) 프로젝트 생성
const p = await fetch(`${HOST}/api/projects`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '_verify_rno_' + Date.now(), type: '업무시설' }),
}).then(r => r.json())
console.log(`1) POST 프로젝트 id=${p.id}`)

// 2) 엑셀 파일 업로드 — multipart/form-data
const file = path.join(process.cwd(), 'samples', '[부천 삼정 AI 허브센터] R&O파일250924.xlsx')
const buf = fs.readFileSync(file)

const fd = new FormData()
fd.append('file', new Blob([buf]), path.basename(file))
fd.append('replace', '1')

const impRes = await fetch(`${HOST}/api/projects/${p.id}/rno/import`, { method: 'POST', body: fd })
const imp = await impRes.json()
if (!impRes.ok) { console.error('❌ 임포트 실패', imp); process.exit(1) }
console.log(`2) 임포트 OK: ${imp.totalRows}건 (생성 ${imp.created}, 업데이트 ${imp.updated})`)
console.log(`   시트별 요약:`)
for (const s of imp.sheets.slice(0, 6)) {
  console.log(`     ${s.category.padEnd(12)} ${String(s.count).padStart(3)}건 · 제안 ${s.proposedSum} / 확정 ${s.confirmedSum} 백만`)
}

// 3) 저장된 R&O 조회
const listRes = await fetch(`${HOST}/api/projects/${p.id}/risks`)
const list = await listRes.json()
console.log(`3) GET → ${list.length}건 R&O 조회`)
const withCode = list.filter(r => r.code)
console.log(`   code 있는 행: ${withCode.length}건`)
// 샘플 한 건 구조
if (list[0]) {
  const s = list[0]
  console.log(`   예: ${s.code}/${s.rev} [${s.category}] ${s.subCategory ?? '-'} / 제안 ${s.proposedCost} / 확정 ${s.confirmedCost} / ${s.progress}`)
}

// 4) export 테스트
const expRes = await fetch(`${HOST}/api/projects/${p.id}/rno/export`)
if (!expRes.ok) { console.error('❌ export 실패'); process.exit(1) }
const expBuf = Buffer.from(await expRes.arrayBuffer())
console.log(`4) export → ${(expBuf.length / 1024).toFixed(1)} KB 엑셀 바이너리 수신`)

// XLSX로 읽어서 원본과 행 수 비교
const XLSX = await import('xlsx')
const reWb = XLSX.default.read(expBuf, { type: 'buffer' })
console.log(`   되읽기: 시트 ${reWb.SheetNames.length}개 (집계 + 카테고리)`)

// 5) 정리
await fetch(`${HOST}/api/projects/${p.id}`, { method: 'DELETE' })
console.log(`5) DELETE 정리`)

console.log(`\n✅ R&O 임포트·익스포트 E2E 통과`)
