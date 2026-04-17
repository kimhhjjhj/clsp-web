// ═══════════════════════════════════════════════════════════
// 프로세스맵 분석기
// - Critical Path 계산 (CPM Forward/Backward pass)
// - 충돌 감지 (레인 겹침, 선행 미완료, 순환 참조)
// ═══════════════════════════════════════════════════════════

import type { ProcessMap, ProcessMapCard, ProcessMapLink } from './types'

export interface CpmStats {
  cardId: string
  es: number
  ef: number
  ls: number
  lf: number
  tf: number          // total float
  isCritical: boolean
}

export type ConflictKind =
  | 'lane_overlap'        // 같은 레인 같은 시간대 두 카드
  | 'predecessor_unmet'   // 선행이 아직 안 끝났는데 후행 시작
  | 'cycle'               // 순환 의존

export interface Conflict {
  kind: ConflictKind
  cardIds: string[]       // 관련된 카드들
  message: string
}

export interface MapAnalysis {
  cpm: Map<string, CpmStats>
  criticalPath: Set<string>
  conflicts: Conflict[]
  projectDuration: number
}

// ── 순환 감지 (DFS) ─────────────────────────────────
function detectCycles(cards: ProcessMapCard[], links: ProcessMapLink[]): string[][] {
  const adj = new Map<string, string[]>()
  for (const c of cards) adj.set(c.id, [])
  for (const l of links) {
    if (adj.has(l.fromCardId)) adj.get(l.fromCardId)!.push(l.toCardId)
  }

  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  const parent = new Map<string, string | null>()
  const cycles: string[][] = []

  for (const c of cards) color.set(c.id, WHITE)

  function dfs(u: string) {
    color.set(u, GRAY)
    for (const v of adj.get(u) ?? []) {
      if (color.get(v) === WHITE) {
        parent.set(v, u)
        dfs(v)
      } else if (color.get(v) === GRAY) {
        // cycle: v ... u 까지 거슬러 올라가기
        const cycle = [v]
        let cur: string | null = u
        while (cur && cur !== v) {
          cycle.push(cur)
          cur = parent.get(cur) ?? null
        }
        cycles.push(cycle.reverse())
      }
    }
    color.set(u, BLACK)
  }

  for (const c of cards) {
    if (color.get(c.id) === WHITE) dfs(c.id)
  }
  return cycles
}

// ── Forward pass (ES, EF) ─────────────────────────
function forwardPass(cards: ProcessMapCard[], links: ProcessMapLink[]): Map<string, { es: number; ef: number }> {
  const result = new Map<string, { es: number; ef: number }>()
  const indeg = new Map<string, number>()
  const preds = new Map<string, ProcessMapLink[]>()
  const cardMap = new Map<string, ProcessMapCard>()
  for (const c of cards) {
    cardMap.set(c.id, c)
    indeg.set(c.id, 0)
    preds.set(c.id, [])
  }
  for (const l of links) {
    if (!cardMap.has(l.fromCardId) || !cardMap.has(l.toCardId)) continue
    indeg.set(l.toCardId, (indeg.get(l.toCardId) ?? 0) + 1)
    preds.get(l.toCardId)!.push(l)
  }

  const queue: string[] = []
  for (const [id, d] of indeg) if (d === 0) queue.push(id)

  while (queue.length) {
    const u = queue.shift()!
    const uCard = cardMap.get(u)!
    const ps = preds.get(u) ?? []
    let es = 0
    for (const p of ps) {
      const fromStats = result.get(p.fromCardId)
      const fromCard = cardMap.get(p.fromCardId)
      if (!fromStats || !fromCard) continue
      const lag = p.lag ?? 0
      let minStart: number
      switch (p.type) {
        case 'SS': minStart = fromStats.es + lag; break
        case 'FF': minStart = fromStats.ef + lag - uCard.duration; break
        case 'SF': minStart = fromStats.es + lag - uCard.duration; break
        case 'FS':
        default: minStart = fromStats.ef + lag
      }
      if (minStart > es) es = minStart
    }
    const ef = es + uCard.duration
    result.set(u, { es, ef })

    // 후행으로 indeg 감소
    for (const l of links) {
      if (l.fromCardId !== u) continue
      const newDeg = (indeg.get(l.toCardId) ?? 0) - 1
      indeg.set(l.toCardId, newDeg)
      if (newDeg === 0) queue.push(l.toCardId)
    }
  }

  // 순환에 속한 카드는 es=ef=0으로 채움 (분석 실패 처리)
  for (const c of cards) if (!result.has(c.id)) result.set(c.id, { es: 0, ef: c.duration })

  return result
}

// ── Backward pass (LS, LF) ─────────────────────────
function backwardPass(
  cards: ProcessMapCard[],
  links: ProcessMapLink[],
  fwd: Map<string, { es: number; ef: number }>,
  projectDuration: number,
): Map<string, { ls: number; lf: number }> {
  const result = new Map<string, { ls: number; lf: number }>()
  const outdeg = new Map<string, number>()
  const succs = new Map<string, ProcessMapLink[]>()
  const cardMap = new Map<string, ProcessMapCard>()
  for (const c of cards) {
    cardMap.set(c.id, c)
    outdeg.set(c.id, 0)
    succs.set(c.id, [])
  }
  for (const l of links) {
    if (!cardMap.has(l.fromCardId) || !cardMap.has(l.toCardId)) continue
    outdeg.set(l.fromCardId, (outdeg.get(l.fromCardId) ?? 0) + 1)
    succs.get(l.fromCardId)!.push(l)
  }

  const queue: string[] = []
  for (const [id, d] of outdeg) if (d === 0) {
    // 끝 노드: LF = projectDuration (또는 자기 EF)
    const f = fwd.get(id)
    if (!f) continue
    queue.push(id)
    result.set(id, { lf: projectDuration, ls: projectDuration - cardMap.get(id)!.duration })
  }

  while (queue.length) {
    const u = queue.shift()!
    const uCard = cardMap.get(u)!

    // 선행자로 영향 전파
    for (const l of links) {
      if (l.toCardId !== u) continue
      const fromCard = cardMap.get(l.fromCardId)
      if (!fromCard) continue
      const uBack = result.get(u)
      if (!uBack) continue
      const lag = l.lag ?? 0
      let maxFinish: number
      switch (l.type) {
        case 'SS': maxFinish = uBack.ls - lag + fromCard.duration; break
        case 'FF': maxFinish = uBack.lf - lag; break
        case 'SF': maxFinish = uBack.ls - lag; break
        case 'FS':
        default: maxFinish = uBack.ls - lag
      }
      const prev = result.get(l.fromCardId)
      if (!prev || maxFinish < prev.lf) {
        result.set(l.fromCardId, { lf: maxFinish, ls: maxFinish - fromCard.duration })
      }
      const newDeg = (outdeg.get(l.fromCardId) ?? 0) - 1
      outdeg.set(l.fromCardId, newDeg)
      if (newDeg === 0) queue.push(l.fromCardId)
    }
  }

  for (const c of cards) {
    if (!result.has(c.id)) {
      const f = fwd.get(c.id)
      if (f) result.set(c.id, { ls: f.es, lf: f.ef })
    }
  }
  return result
}

// ── 메인 분석기 ─────────────────────────────────────────
export function analyzeProcessMap(map: ProcessMap): MapAnalysis {
  const cards = map.cards
  const links = map.links

  // 1) 순환 체크 (cycle)
  const cycles = detectCycles(cards, links)

  // 2) CPM
  const fwd = forwardPass(cards, links)
  const projectDuration = Math.max(0, ...Array.from(fwd.values()).map(v => v.ef))
  const bwd = backwardPass(cards, links, fwd, projectDuration)

  const cpm = new Map<string, CpmStats>()
  const criticalPath = new Set<string>()
  for (const c of cards) {
    const f = fwd.get(c.id) ?? { es: 0, ef: c.duration }
    const b = bwd.get(c.id) ?? { ls: f.es, lf: f.ef }
    const tf = b.ls - f.es
    const isCritical = Math.abs(tf) < 0.01 && cards.some(x => x.id === c.id)
    cpm.set(c.id, { cardId: c.id, es: f.es, ef: f.ef, ls: b.ls, lf: b.lf, tf, isCritical })
    if (isCritical) criticalPath.add(c.id)
  }

  // 3) 충돌 감지
  const conflicts: Conflict[] = []

  // 3-1) 순환
  for (const cy of cycles) {
    conflicts.push({
      kind: 'cycle',
      cardIds: cy,
      message: `순환 의존성: ${cy.slice(0, 3).map(id => cards.find(c => c.id === id)?.title ?? id.slice(0, 6)).join(' → ')}${cy.length > 3 ? ' → …' : ''}`,
    })
  }

  // 3-2) 레인 내 시간 겹침 (타임라인 기준)
  const byLane = new Map<string, ProcessMapCard[]>()
  for (const c of cards) {
    if (!byLane.has(c.laneId)) byLane.set(c.laneId, [])
    byLane.get(c.laneId)!.push(c)
  }
  for (const [laneId, laneCards] of byLane) {
    const sorted = [...laneCards].sort((a, b) => a.startDay - b.startDay)
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j]
        if (b.startDay >= a.startDay + a.duration) break
        conflicts.push({
          kind: 'lane_overlap',
          cardIds: [a.id, b.id],
          message: `레인 겹침: "${a.title}" (D+${a.startDay}~${a.startDay + a.duration})과 "${b.title}" (D+${b.startDay}~${b.startDay + b.duration})`,
        })
      }
    }
  }

  // 3-3) 선행 미완료 (수동으로 배치된 startDay가 선행 EF 이전이면 경고)
  const cardById = new Map<string, ProcessMapCard>()
  for (const c of cards) cardById.set(c.id, c)
  for (const l of links) {
    const from = cardById.get(l.fromCardId)
    const to = cardById.get(l.toCardId)
    if (!from || !to) continue
    const fromEf = from.startDay + from.duration
    const lag = l.lag ?? 0
    const required = (() => {
      switch (l.type) {
        case 'SS': return { field: 'startDay', value: from.startDay + lag }
        case 'FF': return { field: 'ef', value: fromEf + lag }
        case 'SF': return { field: 'ef', value: from.startDay + lag }
        case 'FS':
        default: return { field: 'startDay', value: fromEf + lag }
      }
    })()
    const actual = required.field === 'ef' ? to.startDay + to.duration : to.startDay
    if (actual < required.value) {
      conflicts.push({
        kind: 'predecessor_unmet',
        cardIds: [from.id, to.id],
        message: `선행 미완료: "${to.title}" 시작일(D+${to.startDay})이 "${from.title}" 종료(D+${fromEf}${lag ? ` + ${lag}` : ''})보다 빠름`,
      })
    }
  }

  return { cpm, criticalPath, conflicts, projectDuration }
}
