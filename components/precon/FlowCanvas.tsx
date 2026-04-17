'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, Trash2, Link2, Edit3, Diamond, Circle, Square, StickyNote,
  MousePointer2, Hand, Maximize2, Map as MapIcon, Group,
} from 'lucide-react'
import type { ProcessMap, ProcessMapCard, ProcessMapLane, ProcessMapLink, ProcessMapGroup, CardShape } from '@/lib/process-map/types'
import { genId, LINK_TYPE_LABEL } from '@/lib/process-map/types'
import type { MapAnalysis } from '@/lib/process-map/analyzer'
import { AlertTriangle } from 'lucide-react'

const DEFAULT_W = 160
const DEFAULT_H = 56
const SNAP_THRESHOLD = 6     // px
const GRID_SIZE = 10         // px 그리드 스냅

interface Props {
  map: ProcessMap
  setMap: React.Dispatch<React.SetStateAction<ProcessMap>>
  onEditCard: (c: ProcessMapCard) => void
  markDirty: () => void
  analysis?: MapAnalysis
}

type ConnectingState = {
  fromId: string
  fromCx: number; fromCy: number      // 출발 carrier center (canvas 좌표)
  mouseX: number; mouseY: number       // 현재 마우스 (canvas 좌표)
}

type LassoState = {
  startX: number; startY: number
  curX: number; curY: number
}

export default function FlowCanvas({ map, setMap, onEditCard, markDirty, analysis }: Props) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [tool, setTool] = useState<'select' | 'pan'>('select')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [connecting, setConnecting] = useState<ConnectingState | null>(null)
  const [lasso, setLasso] = useState<LassoState | null>(null)
  const [showMinimap, setShowMinimap] = useState(true)
  const [snapGuides, setSnapGuides] = useState<{ x?: number; y?: number }>({})
  const [editingLink, setEditingLink] = useState<ProcessMapLink | null>(null)
  const [groupDrag, setGroupDrag] = useState<{
    groupId: string
    startX: number; startY: number
    origGroup: { x: number; y: number }
    origCards: Record<string, { x: number; y: number }>
    mode: 'move' | 'resize'
    handle?: 'nw' | 'ne' | 'sw' | 'se'
  } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // ── 초기 좌표 자동 배치 ──────────────
  useEffect(() => {
    const needsPlacement = map.cards.filter(c => c.x == null || c.y == null)
    if (needsPlacement.length === 0) return
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

  // ── 좌표 변환 (screen → canvas) ──────────────
  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    }
  }, [pan, zoom])

  // ── 휠 줌 ──────────────
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = el!.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const oldZoom = zoom
      const newZoom = Math.min(2, Math.max(0.3, zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
      // 마우스 기준으로 확대 (zoom-to-cursor)
      setZoom(newZoom)
      setPan(p => ({
        x: mx - ((mx - p.x) / oldZoom) * newZoom,
        y: my - ((my - p.y) / oldZoom) * newZoom,
      }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom])

  // ── 배경 마우스다운 (팬/라쏘) ──────────────
  const [panning, setPanning] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const onBgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    if (connecting) { setConnecting(null); return }
    if (tool === 'pan' || e.button === 1 || e.altKey) {
      e.preventDefault()
      setPanning({ startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y })
    } else if (e.button === 0) {
      // 라쏘 시작
      const pt = screenToCanvas(e.clientX, e.clientY)
      setLasso({ startX: pt.x, startY: pt.y, curX: pt.x, curY: pt.y })
      setSelectedIds(new Set())
    }
  }, [tool, pan, connecting, screenToCanvas])

  // ── 팬 이동 ──────────────
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

  // ── 라쏘 ──────────────
  useEffect(() => {
    if (!lasso) return
    function onMove(ev: MouseEvent) {
      if (!lasso) return
      const pt = screenToCanvas(ev.clientX, ev.clientY)
      setLasso(l => l ? { ...l, curX: pt.x, curY: pt.y } : null)
    }
    function onUp() {
      if (!lasso) return
      // 라쏘 사각형 내 카드 선택
      const minX = Math.min(lasso.startX, lasso.curX)
      const maxX = Math.max(lasso.startX, lasso.curX)
      const minY = Math.min(lasso.startY, lasso.curY)
      const maxY = Math.max(lasso.startY, lasso.curY)
      const selected = new Set<string>()
      for (const c of map.cards) {
        if (c.x == null || c.y == null) continue
        const cx = c.x + (c.w ?? DEFAULT_W) / 2
        const cy = c.y + (c.h ?? DEFAULT_H) / 2
        if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
          selected.add(c.id)
        }
      }
      setSelectedIds(selected)
      setLasso(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [lasso, screenToCanvas, map.cards])

  // ── 카드 드래그 (이동) ──────────────
  const [drag, setDrag] = useState<{
    cardIds: string[]
    startX: number; startY: number
    origPositions: Record<string, { x: number; y: number }>
  } | null>(null)

  const onCardMouseDown = useCallback((e: React.MouseEvent, card: ProcessMapCard) => {
    if (connecting) return
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
  }, [tool, connecting, map.cards, selectedIds])

  useEffect(() => {
    if (!drag) return
    function onMove(ev: MouseEvent) {
      if (!drag) return
      const dx = (ev.clientX - drag.startX) / zoom
      const dy = (ev.clientY - drag.startY) / zoom

      // 스냅: 다른 카드의 x/y 엣지와 정렬되도록
      let snapDx = dx, snapDy = dy
      let guideX: number | undefined, guideY: number | undefined
      const ids = new Set(drag.cardIds)
      const others = map.cards.filter(c => !ids.has(c.id) && c.x != null && c.y != null)
      // 대표 카드 하나(이동 그룹 중 첫 번째)의 이동 후 위치 계산
      const leadId = drag.cardIds[0]
      const leadOrig = drag.origPositions[leadId]
      const lead = map.cards.find(c => c.id === leadId)
      if (lead && leadOrig) {
        const newX = leadOrig.x + dx
        const newY = leadOrig.y + dy
        const w = lead.w ?? DEFAULT_W, h = lead.h ?? DEFAULT_H
        const edgesX = [newX, newX + w / 2, newX + w]
        const edgesY = [newY, newY + h / 2, newY + h]
        let bestDxDiff = Infinity, bestDyDiff = Infinity
        for (const o of others) {
          const ow = o.w ?? DEFAULT_W, oh = o.h ?? DEFAULT_H
          const oEdgesX = [o.x!, o.x! + ow / 2, o.x! + ow]
          const oEdgesY = [o.y!, o.y! + oh / 2, o.y! + oh]
          for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
              const diffX = oEdgesX[j] - edgesX[i]
              if (Math.abs(diffX) < SNAP_THRESHOLD && Math.abs(diffX) < bestDxDiff) {
                snapDx = dx + diffX
                bestDxDiff = Math.abs(diffX)
                guideX = oEdgesX[j]
              }
              const diffY = oEdgesY[j] - edgesY[i]
              if (Math.abs(diffY) < SNAP_THRESHOLD && Math.abs(diffY) < bestDyDiff) {
                snapDy = dy + diffY
                bestDyDiff = Math.abs(diffY)
                guideY = oEdgesY[j]
              }
            }
          }
        }
        // 그리드 스냅 (다른 카드 정렬 없을 때만)
        if (bestDxDiff === Infinity) snapDx = Math.round((leadOrig.x + dx) / GRID_SIZE) * GRID_SIZE - leadOrig.x
        if (bestDyDiff === Infinity) snapDy = Math.round((leadOrig.y + dy) / GRID_SIZE) * GRID_SIZE - leadOrig.y
      }
      setSnapGuides({ x: guideX, y: guideY })

      setMap(m => ({
        ...m,
        cards: m.cards.map(c => {
          if (!drag.cardIds.includes(c.id)) return c
          const orig = drag.origPositions[c.id]
          if (!orig) return c
          return { ...c, x: Math.round(orig.x + snapDx), y: Math.round(orig.y + snapDy) }
        }),
      }))
    }
    function onUp() { setDrag(null); setSnapGuides({}); markDirty() }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, zoom, setMap, markDirty, map.cards])

  // ── 드래그로 연결 ──────────────
  const onHandleMouseDown = useCallback((e: React.MouseEvent, card: ProcessMapCard) => {
    e.stopPropagation()
    e.preventDefault()
    const w = card.w ?? DEFAULT_W, h = card.h ?? DEFAULT_H
    const cx = (card.x ?? 0) + w / 2
    const cy = (card.y ?? 0) + h / 2
    const pt = screenToCanvas(e.clientX, e.clientY)
    setConnecting({
      fromId: card.id,
      fromCx: cx,
      fromCy: cy,
      mouseX: pt.x,
      mouseY: pt.y,
    })
  }, [screenToCanvas])

  useEffect(() => {
    if (!connecting) return
    function onMove(ev: MouseEvent) {
      if (!connecting) return
      const pt = screenToCanvas(ev.clientX, ev.clientY)
      setConnecting(c => c ? { ...c, mouseX: pt.x, mouseY: pt.y } : null)
    }
    function onUp(ev: MouseEvent) {
      if (!connecting) return
      // 마우스 아래에 카드 있는지 검사
      const pt = screenToCanvas(ev.clientX, ev.clientY)
      const target = map.cards.find(c => {
        if (c.x == null || c.y == null || c.id === connecting.fromId) return false
        const w = c.w ?? DEFAULT_W, h = c.h ?? DEFAULT_H
        return pt.x >= c.x && pt.x <= c.x + w && pt.y >= c.y && pt.y <= c.y + h
      })
      if (target) {
        // 이미 같은 링크 있으면 무시
        const exists = map.links.some(l => l.fromCardId === connecting.fromId && l.toCardId === target.id)
        if (!exists) {
          setMap(m => ({
            ...m,
            links: [...m.links, { id: genId('link'), fromCardId: connecting.fromId, toCardId: target.id, type: 'FS' }],
          }))
          markDirty()
        }
      }
      setConnecting(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [connecting, screenToCanvas, map.cards, map.links, setMap, markDirty])

  // ── 도형 추가 ──────────────
  function addShape(shape: CardShape) {
    const laneId = map.lanes[0]?.id
    if (!laneId) { alert('레인을 먼저 추가하세요.'); return }
    const vp = canvasRef.current
    const cx = vp ? (vp.clientWidth / 2 - pan.x) / zoom : 200
    const cy = vp ? (vp.clientHeight / 2 - pan.y) / zoom : 200
    const w = (shape === 'milestone' || shape === 'start' || shape === 'end') ? 80 : DEFAULT_W
    const h = (shape === 'milestone' || shape === 'start' || shape === 'end') ? 80 : DEFAULT_H
    const card: ProcessMapCard = {
      id: genId('card'),
      laneId,
      title: shape === 'decision' ? '결정?' : shape === 'milestone' ? '마일스톤' : shape === 'start' ? '시작' : shape === 'end' ? '종료' : shape === 'note' ? '메모' : '새 작업',
      startDay: 0,
      duration: 1,
      shape,
      x: Math.round(cx - w / 2),
      y: Math.round(cy - h / 2),
      w, h,
      status: 'planned',
    }
    setMap(m => ({ ...m, cards: [...m.cards, card] }))
    markDirty()
  }

  // ── 그룹 추가 ──────────────
  function addGroup() {
    const vp = canvasRef.current
    const cx = vp ? (vp.clientWidth / 2 - pan.x) / zoom : 200
    const cy = vp ? (vp.clientHeight / 2 - pan.y) / zoom : 200
    const group: ProcessMapGroup = {
      id: genId('group'),
      label: `Phase ${(map.groups?.length ?? 0) + 1}`,
      color: '#64748b',
      x: Math.round(cx - 200),
      y: Math.round(cy - 120),
      w: 400,
      h: 240,
    }
    setMap(m => ({ ...m, groups: [...(m.groups ?? []), group] }))
    markDirty()
  }

  // ── 그룹 드래그 (이동/리사이즈) ──────────────
  const onGroupMouseDown = useCallback((e: React.MouseEvent, group: ProcessMapGroup, mode: 'move' | 'resize', handle?: 'nw' | 'ne' | 'sw' | 'se') => {
    e.stopPropagation()
    e.preventDefault()
    if (tool === 'pan') return
    // 그룹 내 카드 좌표 기록 (이동 시 함께 움직임)
    const origCards: Record<string, { x: number; y: number }> = {}
    if (mode === 'move') {
      for (const c of map.cards) {
        if (c.x == null || c.y == null) continue
        const cw = c.w ?? DEFAULT_W, ch = c.h ?? DEFAULT_H
        const cx = c.x + cw / 2, cy = c.y + ch / 2
        if (cx >= group.x && cx <= group.x + group.w && cy >= group.y && cy <= group.y + group.h) {
          origCards[c.id] = { x: c.x, y: c.y }
        }
      }
    }
    setGroupDrag({
      groupId: group.id,
      startX: e.clientX,
      startY: e.clientY,
      origGroup: { x: group.x, y: group.y },
      origCards,
      mode,
      handle,
    })
  }, [tool, map.cards])

  useEffect(() => {
    if (!groupDrag) return
    function onMove(ev: MouseEvent) {
      if (!groupDrag) return
      const dx = (ev.clientX - groupDrag.startX) / zoom
      const dy = (ev.clientY - groupDrag.startY) / zoom
      setMap(m => ({
        ...m,
        groups: (m.groups ?? []).map(g => {
          if (g.id !== groupDrag.groupId) return g
          if (groupDrag.mode === 'move') {
            return { ...g, x: Math.round(groupDrag.origGroup.x + dx), y: Math.round(groupDrag.origGroup.y + dy) }
          }
          // resize by handle
          const orig = groupDrag.origGroup
          let newX = g.x, newY = g.y, newW = g.w, newH = g.h
          if (groupDrag.handle === 'se') { newW = Math.max(80, g.w + dx); newH = Math.max(60, g.h + dy) }
          if (groupDrag.handle === 'ne') { newY = orig.y + dy; newH = Math.max(60, g.h - dy); newW = Math.max(80, g.w + dx) }
          if (groupDrag.handle === 'sw') { newX = orig.x + dx; newW = Math.max(80, g.w - dx); newH = Math.max(60, g.h + dy) }
          if (groupDrag.handle === 'nw') { newX = orig.x + dx; newY = orig.y + dy; newW = Math.max(80, g.w - dx); newH = Math.max(60, g.h - dy) }
          return { ...g, x: Math.round(newX), y: Math.round(newY), w: Math.round(newW), h: Math.round(newH) }
        }),
        cards: m.cards.map(c => {
          if (groupDrag.mode !== 'move') return c
          const orig = groupDrag.origCards[c.id]
          if (!orig) return c
          return { ...c, x: Math.round(orig.x + dx), y: Math.round(orig.y + dy) }
        }),
      }))
    }
    function onUp() { setGroupDrag(null); markDirty() }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [groupDrag, zoom, setMap, markDirty])

  function updateGroup(id: string, patch: Partial<ProcessMapGroup>) {
    setMap(m => ({ ...m, groups: (m.groups ?? []).map(g => g.id === id ? { ...g, ...patch } : g) }))
    markDirty()
  }
  function removeGroup(id: string) {
    setMap(m => ({ ...m, groups: (m.groups ?? []).filter(g => g.id !== id) }))
    markDirty()
  }

  // ── 선택 카드 삭제 ──────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isEditable = (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA'
      if (isEditable) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0 && !connecting) {
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
      if (e.key === 'Escape') { setConnecting(null); setLasso(null); setSelectedIds(new Set()) }
      if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey) setTool('select')
      if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey) setTool('pan')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, connecting, setMap, markDirty])

  // ── Zoom to fit ──────────────
  function zoomToFit() {
    const cards = map.cards.filter(c => c.x != null && c.y != null)
    if (cards.length === 0) return
    const minX = Math.min(...cards.map(c => c.x!))
    const minY = Math.min(...cards.map(c => c.y!))
    const maxX = Math.max(...cards.map(c => c.x! + (c.w ?? DEFAULT_W)))
    const maxY = Math.max(...cards.map(c => c.y! + (c.h ?? DEFAULT_H)))
    const vp = canvasRef.current
    if (!vp) return
    const PAD = 40
    const contentW = maxX - minX + PAD * 2
    const contentH = maxY - minY + PAD * 2
    const newZoom = Math.min(2, Math.min(vp.clientWidth / contentW, vp.clientHeight / contentH))
    setZoom(newZoom)
    setPan({
      x: -minX * newZoom + PAD * newZoom,
      y: -minY * newZoom + PAD * newZoom,
    })
  }

  // ── 연결선 경로 계산 ──────────────
  function getLinkPath(from: ProcessMapCard, to: ProcessMapCard): { path: string; midX: number; midY: number } | null {
    if (from.x == null || to.x == null) return null
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
    const path = Math.abs(dx) > Math.abs(dy)
      ? `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`
      : `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`
    return { path, midX: (midX + x2) / 2, midY: (midY + y2) / 2 }
  }

  const cardBBox = useMemo(() => {
    const cards = map.cards.filter(c => c.x != null && c.y != null)
    if (cards.length === 0) return null
    const minX = Math.min(...cards.map(c => c.x!))
    const minY = Math.min(...cards.map(c => c.y!))
    const maxX = Math.max(...cards.map(c => c.x! + (c.w ?? DEFAULT_W)))
    const maxY = Math.max(...cards.map(c => c.y! + (c.h ?? DEFAULT_H)))
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
  }, [map.cards])

  return (
    <div className="relative border border-gray-200 rounded-xl bg-gray-50 overflow-hidden" style={{ height: 'min(70vh, 720px)' }}>
      {/* 툴바 */}
      <div className="absolute top-2 left-2 z-20 bg-white border border-gray-200 rounded-lg shadow-sm flex items-center gap-0.5 p-1">
        <ToolBtn active={tool === 'select'} onClick={() => setTool('select')} icon={<MousePointer2 size={13} />} title="선택/이동 (V)" />
        <ToolBtn active={tool === 'pan'} onClick={() => setTool('pan')} icon={<Hand size={13} />} title="화면 이동 (H · Alt+드래그도 가능)" />
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn onClick={() => addShape('task')} icon={<Square size={13} />} title="작업 박스" />
        <ToolBtn onClick={() => addShape('decision')} icon={<Diamond size={13} />} title="결정 (분기)" />
        <ToolBtn onClick={() => addShape('milestone')} icon={<Circle size={13} />} title="마일스톤" />
        <ToolBtn onClick={() => addShape('start')} icon={<span className="text-[10px] font-bold">S</span>} title="시작" />
        <ToolBtn onClick={() => addShape('end')} icon={<span className="text-[10px] font-bold">E</span>} title="종료" />
        <ToolBtn onClick={() => addShape('note')} icon={<StickyNote size={13} />} title="메모" />
        <ToolBtn onClick={addGroup} icon={<Group size={13} />} title="그룹/Phase 박스" />
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn onClick={zoomToFit} icon={<Maximize2 size={13} />} title="전체 맞춤" />
        <ToolBtn active={showMinimap} onClick={() => setShowMinimap(v => !v)} icon={<MapIcon size={13} />} title="미니맵" />
        <span className="text-[10px] text-gray-400 px-1 font-mono">{Math.round(zoom * 100)}%</span>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className="text-[10px] text-gray-600 hover:text-gray-900 px-1">100%</button>
      </div>

      {/* 안내 */}
      <div className="absolute top-2 right-2 z-20 text-[10px] text-gray-500 bg-white/80 px-2 py-1 rounded border border-gray-200">
        V/H 도구 · Ctrl+휠 줌 · Alt+드래그 팬 · 빈공간 드래그 라쏘 · 카드 핸들 드래그로 연결
      </div>

      {connecting && (
        <div className="absolute top-12 left-2 z-20 text-xs text-blue-700 bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg flex items-center gap-1">
          <Link2 size={11} /> 목표 도형에 드롭하세요 (ESC 취소)
        </div>
      )}

      {/* 캔버스 */}
      <div
        ref={canvasRef}
        className={`absolute inset-0 overflow-hidden ${tool === 'pan' || panning ? 'cursor-grab' : ''} ${panning ? 'cursor-grabbing' : ''} ${connecting ? 'cursor-crosshair' : ''}`}
        onMouseDown={onBgMouseDown}
        style={{
          backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)',
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* 변환 컨테이너 */}
        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: 0, height: 0 }}>
          {/* 그룹 박스 (최하층) */}
          {(map.groups ?? []).map(group => (
            <GroupBox
              key={group.id}
              group={group}
              onMouseDown={(e, mode, handle) => onGroupMouseDown(e, group, mode, handle)}
              onLabelChange={label => updateGroup(group.id, { label })}
              onColorChange={color => updateGroup(group.id, { color })}
              onRemove={() => { if (confirm('그룹 박스만 삭제합니다 (내부 카드는 남음).')) removeGroup(group.id) }}
            />
          ))}

          {/* 링크 SVG */}
          <svg style={{ position: 'absolute', left: -5000, top: -5000, width: 10000, height: 10000, pointerEvents: 'none', overflow: 'visible' }}>
            <defs>
              <marker id="fc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
              </marker>
              <marker id="fc-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb" />
              </marker>
              <marker id="fc-arrow-cp" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ea580c" />
              </marker>
            </defs>
            <g transform="translate(5000, 5000)">
              {/* 스냅 가이드 */}
              {snapGuides.x != null && (
                <line x1={snapGuides.x} y1={-5000} x2={snapGuides.x} y2={5000} stroke="#ec4899" strokeDasharray="3,3" strokeWidth={1} />
              )}
              {snapGuides.y != null && (
                <line x1={-5000} y1={snapGuides.y} x2={5000} y2={snapGuides.y} stroke="#ec4899" strokeDasharray="3,3" strokeWidth={1} />
              )}
              {map.links.map(link => {
                const from = map.cards.find(c => c.id === link.fromCardId)
                const to = map.cards.find(c => c.id === link.toCardId)
                if (!from || !to) return null
                const p = getLinkPath(from, to)
                if (!p) return null
                const isCp = analysis?.criticalPath.has(link.fromCardId) && analysis?.criticalPath.has(link.toCardId)
                const labelText = link.type === 'FS' && !link.lag ? null : `${link.type}${link.lag ? (link.lag > 0 ? '+' : '') + link.lag : ''}`
                return (
                  <g key={link.id} style={{ pointerEvents: 'auto' }}>
                    {/* 클릭 히트박스 넓게 */}
                    <path d={p.path} stroke="transparent" strokeWidth="10" fill="none"
                      style={{ cursor: 'pointer' }}
                      onClick={e => { e.stopPropagation(); setEditingLink(link) }}
                    />
                    <path
                      d={p.path}
                      stroke={isCp ? '#ea580c' : '#64748b'}
                      strokeWidth={isCp ? 2.5 : 1.5}
                      fill="none"
                      markerEnd={isCp ? 'url(#fc-arrow-cp)' : 'url(#fc-arrow)'}
                      style={{ pointerEvents: 'none' }}
                    />
                    {labelText && (
                      <g transform={`translate(${p.midX}, ${p.midY})`} style={{ pointerEvents: 'none' }}>
                        <rect x={-18} y={-8} width={36} height={16} fill="#fff" stroke={isCp ? '#ea580c' : '#94a3b8'} strokeWidth={0.5} rx={3} />
                        <text textAnchor="middle" y={4} fontSize={9} fill={isCp ? '#ea580c' : '#475569'} fontWeight={600}>{labelText}</text>
                      </g>
                    )}
                  </g>
                )
              })}

              {/* 드래그 중 임시 연결선 */}
              {connecting && (
                <line
                  x1={connecting.fromCx}
                  y1={connecting.fromCy}
                  x2={connecting.mouseX}
                  y2={connecting.mouseY}
                  stroke="#2563eb"
                  strokeWidth={2}
                  strokeDasharray="5,3"
                  markerEnd="url(#fc-arrow-active)"
                />
              )}

              {/* 라쏘 사각형 */}
              {lasso && (
                <rect
                  x={Math.min(lasso.startX, lasso.curX)}
                  y={Math.min(lasso.startY, lasso.curY)}
                  width={Math.abs(lasso.curX - lasso.startX)}
                  height={Math.abs(lasso.curY - lasso.startY)}
                  fill="rgba(37,99,235,0.08)"
                  stroke="#2563eb"
                  strokeDasharray="4,3"
                  strokeWidth={1}
                />
              )}
            </g>
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
            const isConnecting = connecting?.fromId === card.id
            const isCritical = analysis?.criticalPath.has(card.id) ?? false
            const hasConflict = analysis?.conflicts.some(c => c.cardIds.includes(card.id)) ?? false

            return (
              <div
                key={card.id}
                className="absolute select-none"
                style={{ left: card.x, top: card.y, width: w, height: h }}
                onMouseDown={e => onCardMouseDown(e, card)}
                onClick={e => {
                  if (!drag) {
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
                  selected={selected || isConnecting}
                  hasBaseline={!!card.baselineTaskId}
                  status={card.status}
                  isCritical={isCritical}
                  hasConflict={hasConflict}
                />
                {/* 연결 핸들 4방향 (선택 시만 표시) */}
                {(selected || isConnecting) && (
                  <>
                    <ConnectHandle x={w / 2 - 5} y={-6} onMouseDown={e => onHandleMouseDown(e, card)} />
                    <ConnectHandle x={w - 4} y={h / 2 - 5} onMouseDown={e => onHandleMouseDown(e, card)} />
                    <ConnectHandle x={w / 2 - 5} y={h - 4} onMouseDown={e => onHandleMouseDown(e, card)} />
                    <ConnectHandle x={-6} y={h / 2 - 5} onMouseDown={e => onHandleMouseDown(e, card)} />
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* 미니맵 */}
        {showMinimap && cardBBox && (
          <Minimap
            bbox={cardBBox}
            cards={map.cards}
            laneById={laneById}
            viewport={{ pan, zoom, width: canvasRef.current?.clientWidth ?? 800, height: canvasRef.current?.clientHeight ?? 600 }}
            onNavigate={(cx, cy) => {
              if (!canvasRef.current) return
              // 클릭한 canvas 좌표를 뷰포트 중앙으로
              setPan({
                x: canvasRef.current.clientWidth / 2 - cx * zoom,
                y: canvasRef.current.clientHeight / 2 - cy * zoom,
              })
            }}
          />
        )}
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

      {/* 다중 선택 배지 */}
      {selectedIds.size > 1 && (
        <div className="absolute bottom-2 left-2 z-20 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg">
          {selectedIds.size}개 선택됨 · 드래그로 함께 이동, Delete로 일괄 삭제
        </div>
      )}

      {/* Link 타입 편집 모달 */}
      {editingLink && (
        <LinkEditorModal
          link={editingLink}
          fromTitle={map.cards.find(c => c.id === editingLink.fromCardId)?.title ?? ''}
          toTitle={map.cards.find(c => c.id === editingLink.toCardId)?.title ?? ''}
          onClose={() => setEditingLink(null)}
          onSave={(patch) => {
            setMap(m => ({ ...m, links: m.links.map(l => l.id === editingLink.id ? { ...l, ...patch } : l) }))
            markDirty()
            setEditingLink(null)
          }}
          onDelete={() => {
            setMap(m => ({ ...m, links: m.links.filter(l => l.id !== editingLink.id) }))
            markDirty()
            setEditingLink(null)
          }}
        />
      )}
    </div>
  )
}

// ── 그룹 박스 ──────────────────────────────────────
function GroupBox({
  group, onMouseDown, onLabelChange, onColorChange, onRemove,
}: {
  group: ProcessMapGroup
  onMouseDown: (e: React.MouseEvent, mode: 'move' | 'resize', handle?: 'nw' | 'ne' | 'sw' | 'se') => void
  onLabelChange: (label: string) => void
  onColorChange: (color: string) => void
  onRemove: () => void
}) {
  return (
    <div
      className="absolute group"
      style={{
        left: group.x, top: group.y, width: group.w, height: group.h,
        background: group.color + '1a',
        border: `2px dashed ${group.color}`,
        borderRadius: 8,
        pointerEvents: 'none',
      }}
    >
      {/* 헤더바 (이동 핸들) */}
      <div
        className="absolute -top-7 left-0 flex items-center gap-1 bg-white/90 border border-gray-200 rounded px-1.5 py-0.5 text-xs cursor-move"
        style={{ pointerEvents: 'auto' }}
        onMouseDown={e => onMouseDown(e, 'move')}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: group.color }} />
        <input
          value={group.label}
          onChange={e => onLabelChange(e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          className="font-semibold text-gray-800 bg-transparent outline-none w-[120px]"
        />
        <input
          type="color"
          value={group.color}
          onChange={e => onColorChange(e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          className="w-4 h-4 rounded cursor-pointer opacity-0 group-hover:opacity-100"
        />
        <button
          onClick={onRemove}
          onMouseDown={e => e.stopPropagation()}
          className="text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100"
        ><Trash2 size={11} /></button>
      </div>

      {/* 4 모서리 리사이즈 핸들 */}
      {(['nw', 'ne', 'sw', 'se'] as const).map(h => {
        const pos = {
          nw: { left: -5, top: -5, cursor: 'nwse-resize' },
          ne: { right: -5, top: -5, cursor: 'nesw-resize' },
          sw: { left: -5, bottom: -5, cursor: 'nesw-resize' },
          se: { right: -5, bottom: -5, cursor: 'nwse-resize' },
        }[h]
        return (
          <div
            key={h}
            className="absolute w-3 h-3 bg-white border border-gray-400 rounded-sm opacity-0 group-hover:opacity-100"
            style={{ ...pos, pointerEvents: 'auto' }}
            onMouseDown={e => onMouseDown(e, 'resize', h)}
          />
        )
      })}
    </div>
  )
}

// ── Link 편집 모달 ──────────────────────────────────────
function LinkEditorModal({
  link, fromTitle, toTitle, onClose, onSave, onDelete,
}: {
  link: ProcessMapLink
  fromTitle: string
  toTitle: string
  onClose: () => void
  onSave: (patch: Partial<ProcessMapLink>) => void
  onDelete: () => void
}) {
  const [type, setType] = useState(link.type)
  const [lag, setLag] = useState(link.lag ?? 0)

  const descriptions: Record<ProcessMapLink['type'], string> = {
    FS: '선행이 끝나야 후행 시작 (가장 일반적)',
    SS: '선행이 시작하면 후행도 시작',
    FF: '선행 종료 = 후행 종료',
    SF: '선행이 시작해야 후행 종료 (드묾)',
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold mb-1 flex items-center gap-2"><Link2 size={13} /> 선후행 관계 편집</h3>
        <p className="text-xs text-gray-500 mb-3">
          <span className="font-semibold">{fromTitle}</span> → <span className="font-semibold">{toTitle}</span>
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-semibold">관계 유형</label>
            <div className="mt-1 grid grid-cols-4 gap-1">
              {(['FS', 'SS', 'FF', 'SF'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >{t}</button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">{LINK_TYPE_LABEL[type]} — {descriptions[type]}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-semibold">지연(Lag, 일)</label>
            <input
              type="number"
              value={lag}
              onChange={e => setLag(Number(e.target.value))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="예: 2 (선행 끝나고 2일 후), -3 (3일 겹침)"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">양수: 지연 / 음수: 선행 종료 전 후행 시작</p>
          </div>
        </div>
        <div className="flex justify-between mt-4">
          <button onClick={onDelete} className="text-xs text-red-600 flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded"><Trash2 size={11} /> 연결 삭제</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button
              onClick={() => onSave({ type, lag: lag || undefined })}
              className="px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >저장</button>
          </div>
        </div>
      </div>
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

// ── 연결 핸들 ──────────────────────────────────────
function ConnectHandle({ x, y, onMouseDown }: { x: number; y: number; onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full hover:bg-blue-500 hover:scale-125 transition-transform cursor-crosshair"
      style={{ left: x, top: y, zIndex: 5 }}
      title="드래그하여 다른 도형에 연결"
    />
  )
}

// ── 미니맵 ──────────────────────────────────────
function Minimap({
  bbox, cards, laneById, viewport, onNavigate,
}: {
  bbox: { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number }
  cards: ProcessMapCard[]
  laneById: Map<string, ProcessMapLane>
  viewport: { pan: { x: number; y: number }; zoom: number; width: number; height: number }
  onNavigate: (cx: number, cy: number) => void
}) {
  const MM_W = 160
  const MM_H = 100
  const PAD = 20
  const contentW = bbox.w + PAD * 2
  const contentH = bbox.h + PAD * 2
  const scale = Math.min(MM_W / contentW, MM_H / contentH)
  const offsetX = -bbox.minX + PAD
  const offsetY = -bbox.minY + PAD

  // 현재 뷰포트를 미니맵 좌표로
  const vpX = (-viewport.pan.x / viewport.zoom + offsetX) * scale
  const vpY = (-viewport.pan.y / viewport.zoom + offsetY) * scale
  const vpW = (viewport.width / viewport.zoom) * scale
  const vpH = (viewport.height / viewport.zoom) * scale

  function onClick(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    // 미니맵 좌표를 canvas 좌표로 역변환
    const cx = mx / scale - offsetX
    const cy = my / scale - offsetY
    onNavigate(cx, cy)
  }

  return (
    <div
      className="absolute bottom-2 right-2 z-20 bg-white/95 border border-gray-300 rounded-lg shadow-lg overflow-hidden cursor-pointer"
      style={{ width: MM_W, height: MM_H }}
      onClick={onClick}
    >
      <svg width={MM_W} height={MM_H}>
        {/* 카드 */}
        {cards.map(c => {
          if (c.x == null || c.y == null) return null
          const color = laneById.get(c.laneId)?.color ?? '#64748b'
          return (
            <rect
              key={c.id}
              x={(c.x + offsetX) * scale}
              y={(c.y + offsetY) * scale}
              width={(c.w ?? DEFAULT_W) * scale}
              height={(c.h ?? DEFAULT_H) * scale}
              fill={color}
              opacity={0.7}
            />
          )
        })}
        {/* 뷰포트 */}
        <rect
          x={vpX}
          y={vpY}
          width={vpW}
          height={vpH}
          fill="rgba(37,99,235,0.15)"
          stroke="#2563eb"
          strokeWidth={1}
        />
      </svg>
    </div>
  )
}

// ── 도형 렌더러 ──────────────────────────────────
function ShapeRenderer({
  shape, title, color, width, height, selected, hasBaseline, status, isCritical, hasConflict,
}: {
  shape: CardShape
  title: string
  color: string
  width: number
  height: number
  selected: boolean
  hasBaseline: boolean
  status?: string
  isCritical?: boolean
  hasConflict?: boolean
}) {
  const borderColor = hasConflict ? '#dc2626' : selected ? '#2563eb' : isCritical ? '#ea580c' : 'transparent'
  const borderWidth = (selected || hasConflict) ? 2 : isCritical ? 2 : 0

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
      {isCritical && (
        <span className="absolute top-1 left-1 bg-orange-500 text-white text-[8px] font-bold px-1 rounded">CP</span>
      )}
      {hasConflict && (
        <AlertTriangle size={12} className="absolute -top-1.5 -right-1.5 text-red-600 fill-white" />
      )}
      {hasBaseline && (
        <span className="absolute top-1 right-1 bg-black/40 text-[8px] px-1 rounded">MSP</span>
      )}
    </div>
  )
}
