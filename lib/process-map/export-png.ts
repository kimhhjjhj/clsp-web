// ═══════════════════════════════════════════════════════════
// 프로세스맵 플로우를 PNG로 내보내기
// 의존성 추가 없이 SVG serialize → Canvas 로 직접 렌더링
// ═══════════════════════════════════════════════════════════

import type { ProcessMap, ProcessMapCard, ProcessMapLane, ProcessMapLink, ProcessMapGroup } from './types'

const DEFAULT_W = 160
const DEFAULT_H = 56

interface ExportOptions {
  title?: string
  highlightCritical?: Set<string>
  conflictCardIds?: Set<string>
  scale?: number  // 해상도 배율 (2 = 2x retina)
}

// 카드 배경색 결정
function cardBg(card: ProcessMapCard, lane?: ProcessMapLane): string {
  const STATUS: Record<string, string> = {
    in_progress: '#2563eb',
    done: '#16a34a',
    blocked: '#dc2626',
  }
  if (card.status && STATUS[card.status]) return STATUS[card.status]
  return lane?.color ?? '#64748b'
}

// L자 경로 (링크)
function linkPath(from: ProcessMapCard, to: ProcessMapCard): string {
  if (from.x == null || to.x == null) return ''
  const fw = from.w ?? DEFAULT_W, fh = from.h ?? DEFAULT_H
  const tw = to.w ?? DEFAULT_W, th = to.h ?? DEFAULT_H
  const cx1 = from.x + fw / 2, cy1 = (from.y ?? 0) + fh / 2
  const cx2 = to.x + tw / 2, cy2 = (to.y ?? 0) + th / 2
  const dx = cx2 - cx1, dy = cy2 - cy1
  let x1, y1, x2, y2
  if (Math.abs(dx) > Math.abs(dy)) {
    x1 = dx > 0 ? from.x + fw : from.x
    y1 = cy1
    x2 = dx > 0 ? to.x : to.x + tw
    y2 = cy2
  } else {
    x1 = cx1
    y1 = dy > 0 ? (from.y ?? 0) + fh : from.y ?? 0
    x2 = cx2
    y2 = dy > 0 ? (to.y ?? 0) : (to.y ?? 0) + th
  }
  const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2
  return Math.abs(dx) > Math.abs(dy)
    ? `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`
    : `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// SVG 문자열 생성
export function buildSvg(map: ProcessMap, opts: ExportOptions = {}): { svg: string; width: number; height: number } {
  const { title, highlightCritical = new Set(), conflictCardIds = new Set() } = opts
  const cards = map.cards.filter(c => c.x != null && c.y != null)
  const groups = map.groups ?? []
  const laneById = new Map<string, ProcessMapLane>()
  for (const l of map.lanes) laneById.set(l.id, l)

  // bbox 계산
  const xs: number[] = []
  const ys: number[] = []
  for (const c of cards) {
    xs.push(c.x!, c.x! + (c.w ?? DEFAULT_W))
    ys.push(c.y!, c.y! + (c.h ?? DEFAULT_H))
  }
  for (const g of groups) {
    xs.push(g.x, g.x + g.w); ys.push(g.y, g.y + g.h)
  }
  if (xs.length === 0) return { svg: '', width: 0, height: 0 }
  const PAD = 30
  const TITLE_H = title ? 40 : 0
  const minX = Math.min(...xs) - PAD
  const minY = Math.min(...ys) - PAD
  const maxX = Math.max(...xs) + PAD
  const maxY = Math.max(...ys) + PAD
  const width = maxX - minX
  const height = maxY - minY + TITLE_H

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
  svg += `<rect width="${width}" height="${height}" fill="#ffffff"/>`

  // 제목
  if (title) {
    svg += `<text x="${PAD}" y="24" font-family="sans-serif" font-size="16" font-weight="700" fill="#1e293b">${esc(title)}</text>`
    svg += `<line x1="0" y1="${TITLE_H - 1}" x2="${width}" y2="${TITLE_H - 1}" stroke="#e2e8f0"/>`
  }

  svg += `<g transform="translate(${-minX}, ${-minY + TITLE_H})">`

  // 마커
  svg += `<defs>
    <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/></marker>
    <marker id="arr-cp" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#ea580c"/></marker>
  </defs>`

  // 그룹 박스
  for (const g of groups) {
    svg += `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="${g.color}1a" stroke="${g.color}" stroke-width="2" stroke-dasharray="5,3" rx="8"/>`
    svg += `<text x="${g.x + 8}" y="${g.y - 6}" font-family="sans-serif" font-size="11" font-weight="600" fill="${g.color}">${esc(g.label)}</text>`
  }

  // 링크
  for (const link of map.links) {
    const from = cards.find(c => c.id === link.fromCardId)
    const to = cards.find(c => c.id === link.toCardId)
    if (!from || !to) continue
    const isCp = highlightCritical.has(from.id) && highlightCritical.has(to.id)
    const p = linkPath(from, to)
    svg += `<path d="${p}" stroke="${isCp ? '#ea580c' : '#64748b'}" stroke-width="${isCp ? 2.5 : 1.5}" fill="none" marker-end="url(#${isCp ? 'arr-cp' : 'arr'})"/>`
  }

  // 카드
  for (const c of cards) {
    const lane = laneById.get(c.laneId)
    const bg = cardBg(c, lane)
    const w = c.w ?? DEFAULT_W
    const h = c.h ?? DEFAULT_H
    const shape = c.shape ?? 'task'
    const isCp = highlightCritical.has(c.id)
    const hasConflict = conflictCardIds.has(c.id)
    const stroke = hasConflict ? '#dc2626' : isCp ? '#ea580c' : '#fff'
    const sw = (hasConflict || isCp) ? 2 : 1

    if (shape === 'decision') {
      const points = `${c.x! + w / 2},${c.y!} ${c.x! + w},${c.y! + h / 2} ${c.x! + w / 2},${c.y! + h} ${c.x!},${c.y! + h / 2}`
      svg += `<polygon points="${points}" fill="${bg}" stroke="${stroke}" stroke-width="${sw}"/>`
    } else if (shape === 'milestone') {
      const points = `${c.x! + w / 2},${c.y!} ${c.x! + w},${c.y! + h / 2} ${c.x! + w / 2},${c.y! + h} ${c.x!},${c.y! + h / 2}`
      svg += `<polygon points="${points}" fill="${bg}" stroke="${stroke}" stroke-width="${sw}"/>`
    } else if (shape === 'start' || shape === 'end') {
      const cx = c.x! + w / 2, cy = c.y! + h / 2
      svg += `<circle cx="${cx}" cy="${cy}" r="${Math.min(w, h) / 2}" fill="${shape === 'start' ? '#16a34a' : '#64748b'}" stroke="${stroke}" stroke-width="${sw}"/>`
    } else if (shape === 'note') {
      svg += `<rect x="${c.x}" y="${c.y}" width="${w}" height="${h}" fill="#fef3c7" stroke="#fde68a" stroke-width="1" rx="2"/>`
    } else {
      svg += `<rect x="${c.x}" y="${c.y}" width="${w}" height="${h}" fill="${bg}" stroke="${stroke}" stroke-width="${sw}" rx="6"/>`
    }
    // 라벨
    const textColor = shape === 'note' ? '#78350f' : '#ffffff'
    const lines = wrapText(c.title, Math.floor((w - 16) / 6))
    const startY = c.y! + h / 2 - ((lines.length - 1) * 6) + 4
    lines.forEach((line, i) => {
      svg += `<text x="${c.x! + w / 2}" y="${startY + i * 12}" font-family="sans-serif" font-size="10" font-weight="600" fill="${textColor}" text-anchor="middle">${esc(line)}</text>`
    })
    if (isCp) {
      svg += `<rect x="${c.x! + 4}" y="${c.y! + 4}" width="16" height="10" fill="#ea580c" rx="2"/>`
      svg += `<text x="${c.x! + 12}" y="${c.y! + 12}" font-family="sans-serif" font-size="8" font-weight="700" fill="#fff" text-anchor="middle">CP</text>`
    }
  }

  svg += `</g></svg>`
  return { svg, width, height }
}

function wrapText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  // 한글은 2배로 카운트 (간략 근사)
  const out: string[] = []
  let cur = ''
  for (const ch of text) {
    cur += ch
    if (cur.length >= maxChars) { out.push(cur); cur = ''; if (out.length >= 2) break }
  }
  if (cur) out.push(cur)
  if (out.length >= 2 && text.length > out.join('').length) out[1] += '…'
  return out
}

// SVG → PNG 변환 후 다운로드
export async function exportToPng(
  map: ProcessMap,
  opts: ExportOptions = {},
  fileName = 'process-map.png',
): Promise<void> {
  const { svg, width, height } = buildSvg(map, opts)
  if (!svg) { alert('내보낼 카드가 없습니다.'); return }
  const scale = opts.scale ?? 2

  // SVG → data URL
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('SVG 로드 실패'))
    img.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context 없음')
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(url)

  canvas.toBlob((blob) => {
    if (!blob) { alert('PNG 생성 실패'); return }
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    link.click()
    URL.revokeObjectURL(link.href)
  }, 'image/png')
}
