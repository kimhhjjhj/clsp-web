// 주요 페이지 HTTP 상태·응답 크기·에러 마커 체크
// 클라이언트 SPA라 HTML은 얇지만 500 에러·Next.js 에러 바운더리 감지

const PAGES = [
  '/', '/bid', '/projects', '/standards', '/analytics', '/companies', '/risks',
  '/admin/productivity', '/import',
]

let pass = 0, fail = 0

for (const path of PAGES) {
  const r = await fetch('http://localhost:3000' + path)
  const text = await r.text()
  const len = text.length

  // Next.js 에러 마커 감지
  const hasNextError = text.includes('__next_error') || text.includes('Application error')
  // React 서버 사이드 렌더 실패 감지
  const hasServerError = r.status >= 500

  const ok = r.ok && !hasNextError && !hasServerError
  if (ok) pass++; else fail++
  console.log(
    `  ${ok ? '✅' : '❌'} ${path.padEnd(25)} status=${r.status} html=${String(len).padStart(7)} bytes`
    + (hasNextError ? ' ← Next 에러 마커' : '')
  )
}

// 프로젝트 상세 1개
const projRes = await fetch('http://localhost:3000/api/projects')
const projects = await projRes.json()
const first = projects[0]
if (first) {
  const detail = await fetch('http://localhost:3000/projects/' + first.id)
  const txt = await detail.text()
  const ok = detail.ok && !txt.includes('Application error')
  if (ok) pass++; else fail++
  console.log(`  ${ok ? '✅' : '❌'} /projects/${first.id.slice(0, 8)}... status=${detail.status}`)

  // 단계별
  for (const n of [2, 3, 4]) {
    const st = await fetch(`http://localhost:3000/projects/${first.id}/stage/${n}`)
    const stTxt = await st.text()
    const stOk = st.ok && !stTxt.includes('Application error')
    if (stOk) pass++; else fail++
    console.log(`  ${stOk ? '✅' : '❌'} /projects/.../stage/${n}     status=${st.status}`)
  }
}

console.log(`\n페이지 상태: ✅ ${pass} / ❌ ${fail}`)
process.exit(fail === 0 ? 0 : 1)
