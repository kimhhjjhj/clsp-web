// 과거 프로젝트의 Task(공종) 이름·duration 분포 스캔
// Cycle 10: 공종 단위 벤치마크 가능성 평가

const projectsRes = await fetch('http://localhost:3000/api/projects')
const projects = await projectsRes.json()

console.log(`=== ${projects.length}개 프로젝트의 Task 분포 ===\n`)

const tradeMap = new Map()  // taskName → { occurrences, durations, projects }
for (const p of projects) {
  try {
    const res = await fetch(`http://localhost:3000/api/projects/${p.id}`)
    if (!res.ok) continue
    const data = await res.json()
    const tasks = data.tasks ?? data.project?.tasks ?? []
    console.log(`[${p.name}] ${tasks.length}개 공종`)
    for (const t of tasks) {
      const key = t.name
      const cur = tradeMap.get(key) ?? { durations: [], projects: new Set() }
      cur.durations.push(t.duration)
      cur.projects.add(p.name)
      tradeMap.set(key, cur)
    }
  } catch (e) {
    console.log(`[${p.name}] 오류: ${e.message}`)
  }
}

console.log(`\n=== 공종명 수집 ===`)
console.log(`고유 공종: ${tradeMap.size}개\n`)

// 2개 이상 프로젝트에 등장한 공종만 벤치마크 가치 있음
const benchCandidates = [...tradeMap.entries()]
  .filter(([, v]) => v.projects.size >= 2)
  .sort((a, b) => b[1].projects.size - a[1].projects.size)

console.log(`── 2개 이상 프로젝트 공통 공종 (벤치마크 가능): ${benchCandidates.length}개 ──`)
for (const [name, v] of benchCandidates) {
  const avg = v.durations.reduce((a, b) => a + b, 0) / v.durations.length
  const min = Math.min(...v.durations)
  const max = Math.max(...v.durations)
  console.log(`  ${name.padEnd(22)} ${v.projects.size}개 프로젝트 · 평균 ${avg.toFixed(0)}일 (${min}~${max})`)
}
