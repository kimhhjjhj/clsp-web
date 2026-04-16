import type { WBSTask, CPMResult, CPMSummary } from '@/lib/types'

/**
 * CPM (Critical Path Method) 계산 엔진
 * 파이썬 EXE 버전의 CPM 로직을 TypeScript로 포팅
 */
export function calculateCPM(tasks: WBSTask[]): CPMSummary {
  if (tasks.length === 0) {
    return { totalDuration: 0, criticalPath: [], tasks: [] }
  }

  // id → task 맵
  const taskMap = new Map<string, WBSTask>()
  for (const t of tasks) taskMap.set(t.id, t)

  // 결과 초기화
  const results = new Map<string, CPMResult>()
  for (const t of tasks) {
    results.set(t.id, {
      taskId:       t.id,
      name:         t.name,
      category:     t.category,
      subcategory:  t.subcategory,
      wbsCode:      t.wbsCode,
      unit:         t.unit,
      quantity:     t.quantity,
      productivity: t.productivity,
      stdDays:      t.stdDays,
      duration:     t.duration,
      ES: 0,
      EF: 0,
      LS: 0,
      LF: 0,
      TF: 0,
      FF: 0,
      isCritical: false,
      predecessors: [],
      successors: [],
    })
  }

  // ── 위상 정렬 (Kahn's algorithm) ──────────────────────────────────
  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>() // id → successors[]

  for (const t of tasks) {
    inDegree.set(t.id, t.predecessors.length)
    if (!adjList.has(t.id)) adjList.set(t.id, [])
    for (const predId of t.predecessors) {
      if (!adjList.has(predId)) adjList.set(predId, [])
      adjList.get(predId)!.push(t.id)
    }
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const topoOrder: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    topoOrder.push(id)
    for (const succId of adjList.get(id) ?? []) {
      const newDeg = (inDegree.get(succId) ?? 0) - 1
      inDegree.set(succId, newDeg)
      if (newDeg === 0) queue.push(succId)
    }
  }

  // ── Forward Pass (ES, EF 계산) ────────────────────────────────────
  for (const id of topoOrder) {
    const r = results.get(id)!
    const task = taskMap.get(id)!
    let maxEF = 0
    for (const predId of task.predecessors) {
      const predEF = results.get(predId)?.EF ?? 0
      if (predEF > maxEF) maxEF = predEF
    }
    r.ES = maxEF
    r.EF = r.ES + task.duration
  }

  // 전체 공기 = max(EF)
  const totalDuration = Math.max(...Array.from(results.values()).map(r => r.EF))

  // ── Backward Pass (LS, LF 계산) ───────────────────────────────────
  // 종료 태스크의 LF = totalDuration
  for (const r of results.values()) {
    r.LF = totalDuration
  }

  for (const id of [...topoOrder].reverse()) {
    const r = results.get(id)!
    const succs = adjList.get(id) ?? []
    if (succs.length > 0) {
      r.LF = Math.min(...succs.map(sId => results.get(sId)?.LS ?? totalDuration))
    }
    r.LS = r.LF - r.duration
  }

  // ── Float & Critical Path ──────────────────────────────────────────
  for (const r of results.values()) {
    r.TF = r.LF - r.EF          // = LS - ES
    r.isCritical = r.TF === 0
  }

  // Free Float: EF 기준 후속 태스크 ES의 min - EF
  for (const id of topoOrder) {
    const r = results.get(id)!
    const succs = adjList.get(id) ?? []
    if (succs.length > 0) {
      r.FF = Math.min(...succs.map(sId => results.get(sId)?.ES ?? 0)) - r.EF
    } else {
      r.FF = totalDuration - r.EF
    }
  }

  // 선행/후행 이름 채우기
  for (const t of tasks) {
    const r = results.get(t.id)!
    r.predecessors = t.predecessors.map(predId => taskMap.get(predId)?.name ?? predId)
    r.successors   = (adjList.get(t.id) ?? []).map(succId => taskMap.get(succId)?.name ?? succId)
  }

  // 크리티컬 패스 순서대로
  const criticalPath = topoOrder
    .filter(id => results.get(id)?.isCritical)
    .map(id => results.get(id)!.name)

  return {
    totalDuration,
    criticalPath,
    tasks: topoOrder.map(id => results.get(id)!),
  }
}
