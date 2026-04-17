'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Link2, Edit3, Diamond, Circle, Square, StickyNote, MousePointer2, Hand } from 'lucide-react'
import type { ProcessMap, ProcessMapCard, ProcessMapLane, ProcessMapLink, CardShape } from '@/lib/process-map/types'
import { genId } from '@/lib/process-map/types'

const DEFAULT_W = 160
const DEFAULT_H = 56

interface Props {
  map: ProcessMap
  setMap: React.Dispatch<React.SetStateAction<ProcessMap>>
  onEditCard: (c: ProcessMapCard) => void
  markDirty: () => void
}

export default function FlowCanvas({ map, setMap, onEditCard, markDirty }: Props) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null)
  const [tool, setTool] = useState<'select' | 'pan'>('select')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const canvasRef = useRef<HTMLDivElement>(null)

  // 팬 상태
  const [panning, setPanning] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  // 카드 드래그 상태
  const [drag, setDrag] = useState<{
    cardIds: string[]
    startX: number; startY: number
    origPositions: Record<string, { x: number; y: number }>
  } | null>(null)

  // ── 초기 좌표 자동 배치 (x,y 없는 카드들) ──────────────
  useEffect(() => {
    const needsPlacement = map.cards.filter(c => c.x == null || c.y == null)
    if (needsPlacement.length === 0) return
    // 레인별 가로 줄로 배치
    const laneOrder = new Map<string, number>()
    map.lanes.sort((a, b) => a.order - b.order).forEach((l, i) => laneOrder.set(l.id, i))
    const counts = new Map<string, number>()
    setMap(m => ({
      ...m,
      cards: m.cards.map(c => {
        if (c.x != null && c.y != null) return c
        const lIdx = laneOrder.get(c.laneId) ?? 0
        const idx = counts.get(c.laneId) ?? 0
        counts.set(c.laneId, idx + 1)
        return {
          ...c,
          x: 40 + idx * (DEFAULT_W + 40),
          y: 40 + lIdx * (DEFAULT_H + 60),
          shape: c.shape ?? 'task',
          w: c.w ?? DEFAULT_W,
          h: c.h ?? DEFAULT_H,
        }
      }),
    }))
  }, [map.cards, map.lanes, setMap])

  const laneById = useMemo(() => {
    const m = new Map<string, ProcessMapLane>()
    for (const l of map.lanes) m.set(l.id, l)
    return m
  }, [map.lanes])

  // ── 배경 마우스 이벤트 (팬) ──────────────
  const onBgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    if (linkingFrom) { setLinkingFrom(null); return }
    setSelectedIds(new Set())
    if (tool === 'pan' || e.button === 1 || e.altKey) {
      e.preventDefault()
      setPanning({ startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y })
    }
  }, [tool, pan, linkingFrom])

  useEffect(() => {
    if (!panning) return
    function onMove(ev: MouseEvent) {
      if (!panning) return
      setPan({ x: panning.origX + (ev.clientX - panning.startX), y: panning.origY + (ev.clientY - panning.startY) })
    }
    function onUp() { setPanning(null) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [panning])

  // ── 휠 줌 ──────────────
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom(z => Math.min(2, Math.max(0.3, z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── 카드 드래그 ──────────────
  const onCardMouseDown = useCallback((e: React.MouseEvent, card: ProcessMapCard) => {
    if (linkingFrom) return
    if (tool === 'pan') return
    e.stopPropagation()
    e.preventDefault()
    const isMulti = selectedIds.has(card.id) && selectedIds.size > 1
    const ids = isMulti ? [...selectedIds] : [card.id]
    if (!isMulti) setSelectedIds(new Set([card.id]))
    const origPositions: Record<string, { x: number; y: number }> = {}
    for (const id of ids) {
      const c = map.cards.find(x => x.id === id)
      if (c && c.x != null && c.y != null) origPositions[id] = { x: c.x, y: c.y }
    }
    setDrag({ cardIds: ids, startX: e.clientX, startY: e.clientY, origPositions })
  }, [tool, linkingFrom, map.cards, selectedIds])

  useEffect(() => {
    if (!drag) return
    function onMove(ev: MouseEvent) {
      if (!drag) return
      const dx = (ev.clientX - drag.startX) / zoom
      const dy = (ev.clientY - drag.startY) / zoom
      setMap(m => ({
        ...m,
        cards: m.cards.map(c => {
          if (!drag.cardIds.includes(c.id)) return c
          const orig = drag.origPositions[c.id]
          if (!orig) return c
          return { ...c, x: Math.round(orig.x + dx), y: Math.round(orig.y + dy) }
        }),
      }))
    }
    function onUp() { setDrag(null); markDirty() }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, zoom, setMap, markDirty])

  // ── 도형 추가 ──────────────
  function addShape(shape: CardShape) {
    const laneId = map.lanes[0]?.id
    if (!laneId) { alert('레인을 먼저 추가하세요.'); return }
    const viewportCenter = {
      x: (canvasRef.current?.clientWidth ?? 800) / 2 / zoom - pan.x / zoom,
      y: (canvasRef.current?.clientHeight ?? 600) / 2 / zoom - pan.y / zoom,
    }
    const card: ProcessMapCard = {
      id: genId('card'),
      laneId,
      title: shape === 'decision' ? '결정?' : shape === 'milestone' ? '마일스톤' : shape === 'start' ? '시작' : shape === 'end' ? '종료' : shape === 'note' ? '메모' : '새 작업',
      startDay: 0,
      duration: 1,
      shape,
      x: Math.round(viewportCenter.x - DEFAULT_W / 2),
      y: Math.round(viewportCenter.y - DEFAULT_H / 2),
      w: shape === 'milestone' || shape === 'start' || shape === 'end' ? 80 : DEFAULT_W,
      h: shape === 'milestone' || shape === 'start' || shape === 'end' ? 80 : DEFAULT_H,
      status: 'planned',
    }
    setMap(m => ({ ...m, cards: [...m.cards, card] }))
    markDirty()
  }

  // ── 링크 추가 ──────────────
  function addLink(fromId: string, toId: string) {
    if (fromId === toId) return
    if (map.links.some(l => l.fromCardId === fromId && l.toCardId === toId)) return
    const link: ProcessMapLink = { id: genId('link'), fromCardId: fromId, toCardId: toId, type: 'FS' }
    setMap(m => ({ ...m, links: [...m.links, link] }))
    markDirty()
  }

  // ── 선택 카드 삭제 ──────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0 && !linkingFrom) {
        if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
        e.preventDefault()
        if (!confirm(`선택한 ${selectedIds.size}개 도형을 삭제할까요?`)) return
        setMap(m => ({
          ...m,
          cards: m.cards.filter(c => !selectedIds.has(c.id)),
          links: m.links.filter(l => !selectedIds.has(l.fromCardId) && !selectedIds.has(l.toCardId)),
        }))
        setSelectedIds(new Set())
        markDirty()
      }
      if (e.key === 'Escape') { setLinkingFrom(null); setSelectedIds(new Set()) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, linkingFrom, setMap, markDirty])

  return (
    <div className="relative border border-gray-200 rounded-xl bg-gray-50 overflow-hidden" style={{ height: 'min(70vh, 720px)' }}>
      {/* 툴바 */}
      <div className="absolute top-2 left-2 z-20 bg-white border border-gray-200 rounded-lg shadow-sm flex items-center gap-0.5 p-1">
        <ToolBtn active={tool === 'select'} onClick={() => setTool('select')} icon={<MousePointer2 size={13} />} title="선택/이동 (V)" />
        <ToolBtn active={tool === 'pan'} onClick={() => setTool('pan')} icon={<Hand size={13} />} title="화면 이동 (Alt+드래그도 가능)" />
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn onClick={() => addShape('task')} icon={<Square size={13} />} title="작업 박스" />
        <ToolBtn onClick={() => addShape('decision')} icon={<Diamond size={13} />} title="결정 (분기)" />
        <ToolBtn onClick={() => addShape('milestone')} icon={<Circle size={13} />} title="마일스톤" />
        <ToolBtn onClick={() => addShape('start')} icon={<span className="text-[10px] font-bold">S</span>} title="시작" />
        <ToolBtn onClick={() => addShape('end')} icon={<span className="text-[10px] font-bold">E</span>} title="종료" />
        <ToolBtn onClick={() => addShape('note')} icon={<StickyNote size={13} />} title="메모" />
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <span className="text-[10px] text-gray-400 px-1">{Math.round(zoom * 100)}%</span>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className="text-[10px] text-gray-600 hover:text-gray-900 px-1">100%</button>
      </div>

      {/* 안내 */}
      <div className="absolute top-2 right-2 z-20 text-[10px] text-gray-500 bg-white/80 px-2 py-1 rounded border border-gray-200">
        도구: V/H · 줌: Ctrl+휠 · 팬: Alt+드래그 · 삭제: Del
      </div>

      {linkingFrom && (
        <div className="absolute top-12 left-2 z-20 text-xs text-blue-700 bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg flex items-center gap-1">
          <Link2 size={11} /> 연결할 도형을 클릭
          <button onClick={() => setLinkingFrom(null)} className="ml-1 text-blue-500 hover:text-blue-900">ESC</button>
        </div>
      )}

      {/* 캔버스 */}
      <div
        ref={canvasRef}
        className={`absolute inset-0 overflow-hidden ${tool === 'pan' || panning ? 'cursor-grab' : ''} ${panning ? 'cursor-grabbing' : ''}`}
        onMouseDown={onBgMouseDown}
        style={{
          backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)',
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* 변환 컨테이너 */}
        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: 0, height: 0 }}>
          {/* 링크 SVG (도형 아래에 그려서 겹치지 않게) */}
          <svg style={{ position: 'absolute', left: -5000, top: -5000, width: 10000, height: 10000, pointerEvents: 'none', overflow: 'visible' }}>
            <defs>
              <marker id="fc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
              </marker>
            </defs>
            {map.links.map(link => {
              const from = map.cards.find(c => c.id === link.fromCardId)
              const to = map.cards.find(c => c.id === link.toCardId)
              if (!from || !to || from.x == null || to.x == null) return null
              const fw = from.w ?? DEFAULT_W, fh = from.h ?? DEFAULT_H
              const tw = to.w ?? DEFAULT_W, th = to.h ?? DEFAULT_H
              const cx1 = from.x + fw / 2, cy1 = (from.y ?? 0) + fh / 2
              const cx2 = to.x + tw / 2, cy2 = (to.y ?? 0) + th / 2

              // 가까운 엣지에서 출발/도착 (상하좌우 중)
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
                y2 = dy > 0 ? to.y ?? 0 : (to.y ?? 0) + th
              }

              // 오프셋 5000씩 이동 (SVG 원점 맞추기)
              const ox = 5000, oy = 5000
              const midX = (x1 + x2) / 2
              const midY = (y1 + y2) / 2
              const path = Math.abs(dx) > Math.abs(dy)
                ? `M ${x1 + ox} ${y1 + oy} L ${midX + ox} ${y1 + oy} L ${midX + ox} ${y2 + oy} L ${x2 + ox} ${y2 + oy}`
                : `M ${x1 + ox} ${y1 + oy} L ${x1 + ox} ${midY + oy} L ${x2 + ox} ${midY + oy} L ${x2 + ox} ${y2 + oy}`

              return (
                <g key={link.id} style={{ pointerEvents: 'auto' }}>
                  <path
                    d={path}
                    stroke="#64748b" strokeWidth="1.5" fill="none" markerEnd="url(#fc-arrow)"
                    style={{ cursor: 'pointer' }}
                    onClick={e => {
                      e.stopPropagation()
                      if (confirm('이 연결을 삭제할까요?')) {
                        setMap(m => ({ ...m, links: m.links.filter(l => l.id !== link.id) }))
                        markDirty()
                      }
                    }}
                  />
                </g>
              )
            })}
          </svg>

          {/* 카드(도형) */}
          {map.cards.map(card => {
            if (card.x == null || card.y == null) return null
            const lane = laneById.get(card.laneId)
            const color = lane?.color ?? '#64748b'
            const w = card.w ?? DEFAULT_W
            const h = card.h ?? DEFAULT_H
            const shape = card.shape ?? 'task'
            const selected = selectedIds.has(card.id)
            const isLinkingThis = linkingFrom === card.id

            return (
              <div
                key={card.id}
                className="absolute select-none"
                style={{ left: card.x, top: card.y, width: w, height: h }}
                onMouseDown={e => onCardMouseDown(e, card)}
                onClick={e => {
                  if (linkingFrom && linkingFrom !== card.id) {
                    addLink(linkingFrom, card.id)
                    setLinkingFrom(null)
                    e.stopPropagation()
                  } else if (!drag) {
                    setSelectedIds(new Set([card.id]))
                    e.stopPropagation()
                  }
                }}
                onDoubleClick={e => { e.stopPropagation(); onEditCard(card) }}
              >
                <ShapeRenderer
                  shape={shape}
                  title={card.title}
                  color={color}
                  width={w}
                  height={h}
                  selected={selected || isLinkingThis}
                  hasBaseline={!!card.baselineTaskId}
                  status={card.status}
                />
                {/* 후행 연결 포인트 */}
                {selected && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setLinkingFrom(card.id) }}
                    className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full flex items-center justify-center shadow hover:bg-blue-500"
                    style={{ left: w + 2, top: h / 2 - 8 }}
                    title="후행 연결"
                  >
                    <Link2 size={8} className="text-blue-500" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 우측 속성 패널 (선택 시) */}
      {selectedIds.size === 1 && (() => {
        const c = map.cards.find(x => selectedIds.has(x.id))
        if (!c) return null
        return (
          <div className="absolute bottom-2 right-2 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs w-56">
            <div className="font-semibold mb-1 truncate">{c.title}</div>
            <div className="text-[10px] text-gray-400 mb-1.5">
              {c.shape ?? 'task'} · {c.baselineTaskId ? 'MSP 연동' : '수동'}
            </div>
            <button
              onClick={() => onEditCard(c)}
              className="w-full flex items-center justify-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-[11px] hover:bg-blue-700"
            ><Edit3 size={10} /> 편집</button>
          </div>
        )
      })()}
    </div>
  )
}

function ToolBtn({ active, onClick, icon, title }: { active?: boolean; onClick: () => void; icon: React.ReactNode; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
        active ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'
      }`}
    >{icon}</button>
  )
}

// ── 도형 렌더러 ─────────────────────────────────────
function ShapeRenderer({
  shape, title, color, width, height, selected, hasBaseline, status,
}: {
  shape: CardShape
  title: string
  color: string
  width: number
  height: number
  selected: boolean
  hasBaseline: boolean
  status?: string
}) {
  const borderColor = selected ? '#2563eb' : 'transparent'
  const borderWidth = selected ? 2 : 0

  const statusBg: Record<string, string> = {
    planned: color,
    in_progress: '#2563eb',
    done: '#16a34a',
    blocked: '#dc2626',
  }
  const bg = (status && statusBg[status]) ? statusBg[status] : color

  if (shape === 'decision') {
    return (
      <div style={{ width, height, position: 'relative' }}>
        <svg width={width} height={height} style={{ position: 'absolute' }}>
          <polygon
            points={`${width/2},2 ${width-2},${height/2} ${width/2},${height-2} 2,${height/2}`}
            fill={bg}
            stroke={selected ? '#2563eb' : '#fff'}
            strokeWidth={selected ? 3 : 1}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-semibold px-2 text-center" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
          {title}
        </div>
      </div>
    )
  }

  if (shape === 'milestone') {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{ width, height, background: bg, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', border: `${borderWidth}px solid ${borderColor}` }}
      >
        <span className="text-white text-[10px] font-semibold text-center px-2" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
          {title}
        </span>
      </div>
    )
  }

  if (shape === 'start' || shape === 'end') {
    return (
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{ width, height, background: shape === 'start' ? '#16a34a' : '#64748b', border: `${borderWidth}px solid ${borderColor}` }}
      >
        <span className="text-white text-xs font-bold">{title}</span>
      </div>
    )
  }

  if (shape === 'note') {
    return (
      <div
        className="relative p-2 shadow-md"
        style={{
          width, height,
          background: '#fef3c7',
          borderTop: '3px solid #fde68a',
          borderLeft: `${borderWidth}px solid ${borderColor || '#fde68a'}`,
          borderRight: `${borderWidth}px solid ${borderColor || '#fde68a'}`,
          borderBottom: `${borderWidth}px solid ${borderColor || '#fde68a'}`,
        }}
      >
        <p className="text-[10px] text-amber-900 line-clamp-3">{title}</p>
      </div>
    )
  }

  // task (기본)
  return (
    <div
      className="relative flex items-center justify-center rounded-md shadow-sm text-white"
      style={{
        width, height,
        background: bg,
        border: `${borderWidth}px solid ${borderColor}`,
      }}
    >
      <span className="text-[11px] font-semibold text-center px-2 line-clamp-2" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
        {title}
      </span>
      {hasBaseline && (
        <span className="absolute top-1 right-1 bg-black/40 text-[8px] px-1 rounded">MSP</span>
      )}
    </div>
  )
}
