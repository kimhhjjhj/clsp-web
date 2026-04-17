// ═══════════════════════════════════════════════════════════
// 자동 레이아웃 — DAG 위상 정렬 기반 계층 배치
// links 기반으로 각 카드의 depth(세대) 계산 → 세대별 열 배치
// 같은 세대 내에서는 lane 순서 기준 세로 배치
// ═══════════════════════════════════════════════════════════

import type { ProcessMap, ProcessMapCard, ProcessMapLane } from './types'

const COL_W = 220  // 세대 간 가로 간격
const ROW_H = 90   // 카드 간 세로 간격
const PAD = 60

// 각 카드의 세대(depth) 계산 — 시작(indeg=0)은 0세대, 그 다음은 max(선행)+1
export function computeDepth(cards: ProcessMapCard[], links: { fromCardId: string; toCardId: string }[]): Map<string, number> {
  const result = new Map<string, number>()
  const indeg = new Map<string, number>()
  const preds = new Map<string, string[]>()
  for (const c of cards) { indeg.set(c.id, 0); preds.set(c.id, []) }
  for (const l of links) {
    if (!indeg.has(l.fromCardId) || !indeg.has(l.toCardId)) continue
    indeg.set(l.toCardId, (indeg.get(l.toCardId) ?? 0) + 1)
    preds.get(l.toCardId)!.push(l.fromCardId)
  }

  const queue: string[] = []
  for (const c of cards) {
    if ((indeg.get(c.id) ?? 0) === 0) {
      result.set(c.id, 0)
      queue.push(c.id)
    }
  }

  while (queue.length) {
    const u = queue.shift()!
    const myDepth = result.get(u) ?? 0
    for (const l of links) {
      if (l.fromCardId !== u) continue
      const v = l.toCardId
      const newDepth = myDepth + 1
      result.set(v, Math.max(result.get(v) ?? 0, newDepth))
      const newDeg = (indeg.get(v) ?? 0) - 1
      indeg.set(v, newDeg)
      if (newDeg === 0) queue.push(v)
    }
  }

  // 순환에 속한 카드는 0
  for (const c of cards) if (!result.has(c.id)) result.set(c.id, 0)
  return result
}

// 자동 레이아웃 적용: cards의 x,y 새로 계산
export function autoLayout(map: ProcessMap): ProcessMap {
  const cards = map.cards
  const lanes = [...map.lanes].sort((a, b) => a.order - b.order)
  const laneIdx = new Map<string, number>()
  lanes.forEach((l, i) => laneIdx.set(l.id, i))

  const depth = computeDepth(cards, map.links)

  // 같은 depth 안에서 lane order로 정렬, 같은 lane 안에서는 title
  const byDepth = new Map<number, ProcessMapCard[]>()
  for (const c of cards) {
    const d = depth.get(c.id) ?? 0
    if (!byDepth.has(d)) byDepth.set(d, [])
    byDepth.get(d)!.push(c)
  }

  const newCards = [...cards]
  const sortedDepths = [...byDepth.keys()].sort((a, b) => a - b)
  for (const d of sortedDepths) {
    const group = byDepth.get(d)!
    // lane 순서로
    group.sort((a, b) => (laneIdx.get(a.laneId) ?? 0) - (laneIdx.get(b.laneId) ?? 0))
    group.forEach((c, i) => {
      const idx = newCards.findIndex(x => x.id === c.id)
      if (idx === -1) return
      newCards[idx] = {
        ...c,
        x: PAD + d * COL_W,
        y: PAD + i * ROW_H,
      }
    })
  }

  return { ...map, cards: newCards }
}
