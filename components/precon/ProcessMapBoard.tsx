'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, Trash2, Save, Download, Upload, ZoomIn, ZoomOut, Loader2,
  Link2, Unlink, Edit3, ChevronRight, Palette, GanttChartSquare, Workflow,
  Undo2, Redo2, Image as ImageIcon, Sparkles,
} from 'lucide-react'
import {
  type ProcessMap, type ProcessMapLane, type ProcessMapCard, type ProcessMapLink,
  EMPTY_MAP, DEFAULT_LANES, genId,
} from '@/lib/process-map/types'
import { analyzeProcessMap } from '@/lib/process-map/analyzer'
import { autoLayout } from '@/lib/process-map/auto-layout'
import { exportToPng } from '@/lib/process-map/export-png'
import FlowCanvas from './FlowCanvas'
import { AlertTriangle, Zap } from 'lucide-react'

const LANE_H = 60
const HEADER_H = 40
const LANE_LABEL_W = 140
const CARD_H = 36
const MIN_DAY_W = 2
const MAX_DAY_W = 24

const STATUS_COLORS: Record<string, string> = {
  planned: '#64748b',
  in_progress: '#2563eb',
  done: '#16a34a',
  blocked: '#dc2626',
}

interface Props {
  projectId: string
  startDate?: string | null
}

export default function ProcessMapBoard({ projectId, startDate }: Props) {
  const [map, setMapRaw] = useState<ProcessMap>(EMPTY_MAP)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [dayWidth, setDayWidth] = useState(6)
  const [editingCard, setEditingCard] = useState<ProcessMapCard | null>(null)
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'timeline' | 'flow'>('timeline')
  const boardRef = useRef<HTMLDivElement>(null)

  // ── Undo/Redo 히스토리 (throttle 방식) ──────────────────
  const history = useRef<ProcessMap[]>([])
  const future = useRef<ProcessMap[]>([])
  const lastPushRef = useRef(0)
  const MAX_HISTORY = 50
  const HISTORY_THROTTLE = 400  // 400ms 내 연속 변경은 1 히스토리로

  // setMap 래퍼 — 자동으로 history push + dirty
  const setMap: React.Dispatch<React.SetStateAction<ProcessMap>> = useCallback((updater) => {
    setMapRaw(prev => {
      const now = Date.now()
      if (now - lastPushRef.current > HISTORY_THROTTLE) {
        history.current.push(JSON.parse(JSON.stringify(prev)))
        if (history.current.length > MAX_HISTORY) history.current.shift()
        future.current = []
        lastPushRef.current = now
        setDirty(true)
      }
      return typeof updater === 'function' ? (updater as (p: ProcessMap) => ProcessMap)(prev) : updater
    })
  }, [])

  const undo = useCallback(() => {
    if (history.current.length === 0) return
    setMapRaw(current => {
      const prev = history.current.pop()!
      future.current.push(JSON.parse(JSON.stringify(current)))
      setDirty(true)
      return prev
    })
  }, [])

  const redo = useCallback(() => {
    if (future.current.length === 0) return
    setMapRaw(current => {
      const next = future.current.pop()!
      history.current.push(JSON.parse(JSON.stringify(current)))
      setDirty(true)
      return next
    })
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isEditable = (e.target as HTMLElement)?.tagName === 'INPUT'
        || (e.target as HTMLElement)?.tagName === 'TEXTAREA'
      if (isEditable) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault(); undo()
      } else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
        || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault(); redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  // ── 로드 ───────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/projects/${projectId}/process-map`)
      .then(r => r.json())
      .then((data) => {
        setMap({
          lanes: data.lanes ?? [],
          cards: data.cards ?? [],
          links: data.links ?? [],
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [projectId])

  // ── 저장 ───────────────────────────────────────────────
  const save = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/process-map`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(map),
      })
      if (res.ok) {
        setDirty(false)
        setNotice('저장됨')
        setTimeout(() => setNotice(null), 1500)
      }
    } finally {
      setSaving(false)
    }
  }, [projectId, map])

  // ── 베이스라인 import ─────────────────────────────────
  async function importBaseline() {
    if (!confirm('베이스라인 공정표에서 카드를 불러올까요?\n기존 카드(베이스라인 연동)는 업데이트되고, 수동 카드는 보존됩니다.')) return
    setImporting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/process-map/import-baseline`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        const r = await fetch(`/api/projects/${projectId}/process-map`).then(r => r.json())
        setMap({ lanes: r.lanes ?? [], cards: r.cards ?? [], links: r.links ?? [] })
        setNotice(`${data.imported}개 카드 가져옴`)
        setTimeout(() => setNotice(null), 2500)
      } else {
        alert(data.error ?? '가져오기 실패')
      }
    } finally {
      setImporting(false)
    }
  }

  // 기존 markDirty 호출 코드 호환용 (setMap 래퍼에 이미 dirty/history 처리됨)
  function markDirty() { setDirty(true) }

  // ── 레인 CRUD ───────────────────────────────────────
  function addLane() {
    const preset = DEFAULT_LANES.find(d => !map.lanes.some(l => l.name === d.name))
    const lane: ProcessMapLane = {
      id: genId('lane'),
      name: preset?.name ?? `협력사 ${map.lanes.length + 1}`,
      color: preset?.color ?? '#64748b',
      order: map.lanes.length,
    }
    setMap(m => ({ ...m, lanes: [...m.lanes, lane] }))
    markDirty()
  }
  function updateLane(id: string, patch: Partial<ProcessMapLane>) {
    setMap(m => ({ ...m, lanes: m.lanes.map(l => l.id === id ? { ...l, ...patch } : l) }))
    markDirty()
  }
  function removeLane(id: string) {
    if (!confirm('이 레인과 소속 카드들을 삭제할까요?')) return
    setMap(m => ({
      ...m,
      lanes: m.lanes.filter(l => l.id !== id),
      cards: m.cards.filter(c => c.laneId !== id),
      links: m.links.filter(lk => {
        const cardIds = m.cards.filter(c => c.laneId !== id).map(c => c.id)
        return cardIds.includes(lk.fromCardId) && cardIds.includes(lk.toCardId)
      }),
    }))
    markDirty()
  }

  // ── 카드 CRUD ───────────────────────────────────────
  function addCard(laneId: string, startDay: number) {
    const card: ProcessMapCard = {
      id: genId('card'),
      laneId,
      title: '새 작업',
      startDay: Math.max(0, Math.round(startDay)),
      duration: 5,
      status: 'planned',
    }
    setMap(m => ({ ...m, cards: [...m.cards, card] }))
    setEditingCard(card)
    markDirty()
  }
  function updateCard(id: string, patch: Partial<ProcessMapCard>) {
    setMap(m => ({ ...m, cards: m.cards.map(c => c.id === id ? { ...c, ...patch } : c) }))
    markDirty()
  }
  function removeCard(id: string) {
    setMap(m => ({
      ...m,
      cards: m.cards.filter(c => c.id !== id),
      links: m.links.filter(l => l.fromCardId !== id && l.toCardId !== id),
    }))
    markDirty()
  }

  // ── 링크 CRUD ─────────────────────────────────────
  function addLink(fromId: string, toId: string) {
    if (fromId === toId) return
    if (map.links.some(l => l.fromCardId === fromId && l.toCardId === toId)) return
    const link: ProcessMapLink = { id: genId('link'), fromCardId: fromId, toCardId: toId, type: 'FS' }
    setMap(m => ({ ...m, links: [...m.links, link] }))
    markDirty()
  }
  function removeLink(id: string) {
    setMap(m => ({ ...m, links: m.links.filter(l => l.id !== id) }))
    markDirty()
  }

  // ── 전체 공기 ─────────────────────────────────────
  const totalDays = useMemo(() => {
    const max = map.cards.reduce((s, c) => Math.max(s, c.startDay + c.duration), 0)
    return Math.max(30, max + 10)  // 최소 30일 표시
  }, [map.cards])

  // ── 분석 (CP + 충돌) ─────────────────────────────
  const analysis = useMemo(() => analyzeProcessMap(map), [map])

  // ── 드래그 상태 ──────────────────────────────────────
  const [drag, setDrag] = useState<{
    type: 'move' | 'resize'
    cardId: string
    startX: number
    origStartDay: number
    origDuration: number
    origLaneId: string
  } | null>(null)

  const onCardMouseDown = useCallback((e: React.MouseEvent, card: ProcessMapCard, mode: 'move' | 'resize') => {
    if (linkingFrom) return
    e.preventDefault()
    e.stopPropagation()
    setDrag({
      type: mode,
      cardId: card.id,
      startX: e.clientX,
      origStartDay: card.startDay,
      origDuration: card.duration,
      origLaneId: card.laneId,
    })
  }, [linkingFrom])

  useEffect(() => {
    if (!drag) return
    function onMove(ev: MouseEvent) {
      if (!drag) return
      const deltaX = ev.clientX - drag.startX
      const deltaDays = Math.round(deltaX / dayWidth)
      if (drag.type === 'move') {
        updateCard(drag.cardId, { startDay: Math.max(0, drag.origStartDay + deltaDays) })
      } else {
        updateCard(drag.cardId, { duration: Math.max(1, drag.origDuration + deltaDays) })
      }

      // 레인 변경 (move 한정, vertical offset)
      if (drag.type === 'move' && boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect()
        const relY = ev.clientY - rect.top - HEADER_H
        const laneIdx = Math.floor(relY / LANE_H)
        const laneSorted = [...map.lanes].sort((a, b) => a.order - b.order)
        const targetLane = laneSorted[laneIdx]
        if (targetLane && targetLane.id !== drag.origLaneId) {
          updateCard(drag.cardId, { laneId: targetLane.id })
        }
      }
    }
    function onUp() { setDrag(null) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, dayWidth, map.lanes])

  // ── 날짜 라벨 ────────────────────────────────────────
  const startBase = startDate ? new Date(startDate) : null
  const dateLabel = (day: number): string => {
    if (!startBase) return `D+${day}`
    const d = new Date(startBase)
    d.setDate(d.getDate() + day)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const sortedLanes = useMemo(
    () => [...map.lanes].sort((a, b) => a.order - b.order),
    [map.lanes],
  )

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Loader2 size={20} className="animate-spin text-gray-400 mx-auto" />
      </div>
    )
  }

  const totalBoardW = LANE_LABEL_W + totalDays * dayWidth

  return (
    <div className="space-y-3">
      {/* 뷰 토글 */}
      <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-lg w-fit">
        <button
          onClick={() => setViewMode('timeline')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            viewMode === 'timeline' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        ><GanttChartSquare size={13} /> 타임라인 (스윔레인)</button>
        <button
          onClick={() => setViewMode('flow')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            viewMode === 'flow' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        ><Workflow size={13} /> 플로우 (자유 캔버스)</button>
      </div>

      {/* 툴바 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={addLane}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-xs font-semibold rounded-lg hover:bg-gray-50"
          >
            <Plus size={12} /> 레인(협력사) 추가
          </button>
          <button
            onClick={importBaseline}
            disabled={importing}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold rounded-lg hover:bg-purple-200 disabled:opacity-50"
          >
            {importing ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            베이스라인에서 가져오기
          </button>
          {viewMode === 'flow' && (
            <button
              onClick={() => {
                if (!confirm('모든 카드를 위상 정렬 기반으로 자동 배치합니다. 현재 x,y 위치가 덮어쓰기됩니다.')) return
                setMap(autoLayout(map))
                markDirty()
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-semibold rounded-lg hover:bg-indigo-200"
              title="위상 정렬 기반 카드 자동 배치"
            ><Sparkles size={12} /> 자동 배치</button>
          )}
          <button
            onClick={() => {
              exportToPng(map, {
                title: `프로세스맵 — ${new Date().toISOString().slice(0, 10)}`,
                highlightCritical: analysis.criticalPath,
                conflictCardIds: new Set(analysis.conflicts.flatMap(c => c.cardIds)),
              }, `process-map-${new Date().toISOString().slice(0, 10)}.png`)
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200"
            title="PNG 이미지로 내보내기"
          ><ImageIcon size={12} /> PNG 저장</button>
          {viewMode === 'timeline' && (
            <div className="inline-flex items-center gap-1 text-xs text-gray-500">
              <button onClick={() => setDayWidth(w => Math.max(MIN_DAY_W, w - 2))} className="p-1 hover:bg-gray-100 rounded"><ZoomOut size={12} /></button>
              <span className="font-mono">{dayWidth}px/일</span>
              <button onClick={() => setDayWidth(w => Math.min(MAX_DAY_W, w + 2))} className="p-1 hover:bg-gray-100 rounded"><ZoomIn size={12} /></button>
            </div>
          )}
          {linkingFrom && (
            <span className="text-xs text-blue-700 bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg flex items-center gap-1">
              <Link2 size={11} /> 연결할 후행 카드를 클릭하세요
              <button onClick={() => setLinkingFrom(null)} className="ml-1 text-blue-500 hover:text-blue-900">취소</button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg">
            <button
              onClick={undo}
              disabled={history.current.length === 0}
              className="p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-l-lg"
              title="실행 취소 (Ctrl+Z)"
            ><Undo2 size={13} /></button>
            <button
              onClick={redo}
              disabled={future.current.length === 0}
              className="p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-r-lg"
              title="다시 실행 (Ctrl+Y)"
            ><Redo2 size={13} /></button>
          </div>
          {notice && <span className="text-xs text-green-700">✓ {notice}</span>}
          {dirty && <span className="text-xs text-orange-500">● 미저장</span>}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            저장
          </button>
        </div>
      </div>

      {/* 분석 배너 */}
      {(analysis.criticalPath.size > 0 || analysis.conflicts.length > 0) && (
        <div className="flex flex-wrap gap-2 items-center text-xs">
          {analysis.criticalPath.size > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-800 rounded-lg font-semibold">
              <Zap size={11} /> Critical Path {analysis.criticalPath.size}개 · 총공기 {analysis.projectDuration}일
            </span>
          )}
          {analysis.conflicts.length > 0 && (
            <details className="inline-block">
              <summary className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-800 rounded-lg font-semibold cursor-pointer hover:bg-red-200">
                <AlertTriangle size={11} /> 경고 {analysis.conflicts.length}건
              </summary>
              <div className="absolute z-20 mt-1 bg-white border border-red-200 rounded-lg shadow-lg p-2 max-w-lg max-h-60 overflow-auto">
                <ul className="text-[11px] text-red-900 space-y-0.5">
                  {analysis.conflicts.slice(0, 20).map((c, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-red-400">
                        {c.kind === 'cycle' ? '↻' : c.kind === 'lane_overlap' ? '⇄' : '⏰'}
                      </span>
                      <span>{c.message}</span>
                    </li>
                  ))}
                  {analysis.conflicts.length > 20 && (
                    <li className="text-red-400 pt-1">+ {analysis.conflicts.length - 20}건 더</li>
                  )}
                </ul>
              </div>
            </details>
          )}
        </div>
      )}

      {/* 보드 (타임라인) */}
      {viewMode === 'timeline' && (
      <div
        className="bg-white border border-gray-200 rounded-xl overflow-auto"
        ref={boardRef}
        style={{ maxHeight: 'min(70vh, 720px)' }}
      >
        {sortedLanes.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            레인이 없습니다. 상단 <strong>&quot;레인 추가&quot;</strong> 버튼 또는 <strong>&quot;베이스라인에서 가져오기&quot;</strong>로 시작하세요.
          </div>
        ) : (
          <div style={{ width: totalBoardW, position: 'relative' }}>
            {/* 헤더(시간축) */}
            <div
              className="flex items-center bg-gray-50 border-b border-gray-200 sticky top-0 z-10"
              style={{ height: HEADER_H, paddingLeft: LANE_LABEL_W }}
            >
              {Array.from({ length: Math.ceil(totalDays / Math.max(5, Math.floor(30 / (dayWidth / 3)))) + 1 }).map((_, i) => {
                const step = Math.max(5, Math.floor(30 / (dayWidth / 3)))
                const day = i * step
                if (day > totalDays) return null
                return (
                  <div key={i} style={{ position: 'absolute', left: LANE_LABEL_W + day * dayWidth }} className="text-[10px] text-gray-500 font-mono">
                    <div className="h-full border-l border-gray-200" style={{ position: 'absolute', top: HEADER_H, height: totalDays * LANE_H + LANE_H * 10 }} />
                    <span style={{ position: 'absolute', left: 2, top: 6 }}>
                      {dateLabel(day)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* 레인들 */}
            {sortedLanes.map((lane) => {
              const laneCards = map.cards.filter(c => c.laneId === lane.id)
              return (
                <div
                  key={lane.id}
                  className="relative border-b border-gray-100 group"
                  style={{ height: LANE_H, background: lane.color + '05' }}
                  onDoubleClick={e => {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                    const x = e.clientX - rect.left - LANE_LABEL_W
                    if (x < 0) return
                    const day = Math.floor(x / dayWidth)
                    addCard(lane.id, day)
                  }}
                >
                  {/* 레인 라벨 */}
                  <div
                    className="absolute top-0 left-0 bottom-0 flex items-center gap-1 px-2 bg-white border-r border-gray-200 sticky z-[5]"
                    style={{ width: LANE_LABEL_W, left: 0 }}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: lane.color }} />
                    <input
                      className="flex-1 min-w-0 text-xs font-semibold bg-transparent outline-none truncate"
                      value={lane.name}
                      onChange={e => updateLane(lane.id, { name: e.target.value })}
                    />
                    <input
                      type="color"
                      value={lane.color}
                      onChange={e => updateLane(lane.id, { color: e.target.value })}
                      className="w-4 h-4 rounded cursor-pointer opacity-0 group-hover:opacity-100"
                      title="색상"
                    />
                    <button
                      onClick={() => removeLane(lane.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-600"
                    ><Trash2 size={11} /></button>
                  </div>

                  {/* 카드들 */}
                  {laneCards.map(card => {
                    const left = LANE_LABEL_W + card.startDay * dayWidth
                    const width = Math.max(dayWidth * 1, card.duration * dayWidth)
                    const isLinkingThis = linkingFrom === card.id
                    const isCritical = analysis.criticalPath.has(card.id)
                    const hasConflict = analysis.conflicts.some(c => c.cardIds.includes(card.id))
                    const borderCls = isLinkingThis
                      ? 'border-blue-600'
                      : hasConflict
                      ? 'border-red-500 ring-2 ring-red-200'
                      : isCritical
                      ? 'border-orange-500'
                      : 'border-transparent hover:border-white'
                    return (
                      <div
                        key={card.id}
                        className={`absolute rounded-md shadow-sm cursor-move select-none text-xs text-white flex items-center px-1.5 overflow-hidden border-2 ${borderCls}`}
                        style={{
                          top: (LANE_H - CARD_H) / 2,
                          left,
                          width,
                          height: CARD_H,
                          background: STATUS_COLORS[card.status ?? 'planned'] === '#64748b' ? lane.color : STATUS_COLORS[card.status ?? 'planned'],
                          zIndex: isLinkingThis ? 20 : 1,
                        }}
                        onMouseDown={e => onCardMouseDown(e, card, 'move')}
                        onClick={e => {
                          if (linkingFrom && linkingFrom !== card.id) {
                            addLink(linkingFrom, card.id)
                            setLinkingFrom(null)
                            e.stopPropagation()
                          }
                        }}
                        onDoubleClick={e => { e.stopPropagation(); setEditingCard(card) }}
                        title={`${card.title} (${card.duration}일${card.baselineTaskId ? ' · MSP' : ''})${isCritical ? ' · Critical Path' : ''}${hasConflict ? ' · ⚠ 충돌' : ''}`}
                      >
                        {isCritical && (
                          <span className="mr-1 text-[9px] bg-orange-500 text-white px-1 rounded flex-shrink-0">CP</span>
                        )}
                        <span className="truncate flex-1">{card.title}</span>
                        {hasConflict && (
                          <AlertTriangle size={10} className="ml-1 text-red-200 flex-shrink-0" />
                        )}
                        {card.baselineTaskId && (
                          <span className="ml-1 text-[9px] bg-black/30 px-1 rounded flex-shrink-0">MSP</span>
                        )}
                        {/* 리사이즈 핸들 */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30"
                          onMouseDown={e => onCardMouseDown(e, card, 'resize')}
                        />
                        {/* 후행 연결 버튼 */}
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setLinkingFrom(card.id) }}
                          className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border border-gray-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 hover:bg-blue-500"
                          title="후행 카드 연결"
                        ><ChevronRight size={8} className="text-gray-700" /></button>
                      </div>
                    )
                  })}

                  {laneCards.length === 0 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 text-[10px] text-gray-300 italic pointer-events-none"
                      style={{ left: LANE_LABEL_W + 8 }}
                    >
                      더블클릭으로 카드 추가
                    </div>
                  )}
                </div>
              )
            })}

            {/* 의존성 화살표 (SVG 오버레이) */}
            <DependencyArrows
              cards={map.cards}
              links={map.links}
              lanes={sortedLanes}
              dayWidth={dayWidth}
              totalDays={totalDays}
              onRemoveLink={removeLink}
            />
          </div>
        )}
      </div>

      )}

      {/* 플로우 뷰 */}
      {viewMode === 'flow' && (
        <FlowCanvas
          map={map}
          setMap={setMap}
          onEditCard={setEditingCard}
          markDirty={markDirty}
          analysis={analysis}
        />
      )}

      {/* 카드 편집 모달 */}
      {editingCard && (
        <CardEditorModal
          card={editingCard}
          lanes={sortedLanes}
          onClose={() => setEditingCard(null)}
          onSave={patch => {
            updateCard(editingCard.id, patch)
            setEditingCard(null)
          }}
          onDelete={() => {
            removeCard(editingCard.id)
            setEditingCard(null)
          }}
        />
      )}

      {/* 통계 */}
      <div className="flex gap-3 text-xs text-gray-500">
        <span>레인 {sortedLanes.length}</span>
        <span>카드 {map.cards.length}</span>
        <span>의존성 {map.links.length}</span>
        <span>전체 {totalDays}일</span>
      </div>
    </div>
  )
}

// ── 카드 편집 모달 ───────────────────────────────────────
function CardEditorModal({
  card, lanes, onClose, onSave, onDelete,
}: {
  card: ProcessMapCard
  lanes: ProcessMapLane[]
  onClose: () => void
  onSave: (patch: Partial<ProcessMapCard>) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(card.title)
  const [laneId, setLaneId] = useState(card.laneId)
  const [startDay, setStartDay] = useState(card.startDay)
  const [duration, setDuration] = useState(card.duration)
  const [note, setNote] = useState(card.note ?? '')
  const [status, setStatus] = useState(card.status ?? 'planned')

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Edit3 size={13} /> 카드 편집</h3>
        <div className="space-y-2.5">
          <div>
            <label className="text-xs text-gray-500 font-semibold">작업명</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500 font-semibold">레인</label>
              <select value={laneId} onChange={e => setLaneId(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white">
                {lanes.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">시작일(D+)</label>
              <input type="number" min={0} value={startDay} onChange={e => setStartDay(Number(e.target.value))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">기간(일)</label>
              <input type="number" min={1} value={duration} onChange={e => setDuration(Number(e.target.value))} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-semibold">상태</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white">
              <option value="planned">계획</option>
              <option value="in_progress">진행중</option>
              <option value="done">완료</option>
              <option value="blocked">차단</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-semibold">메모</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          {card.baselineTaskId && (
            <div className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-1">
              MSP 베이스라인 연동 카드 · 다음 import 시 기간이 덮어쓰일 수 있음
            </div>
          )}
        </div>
        <div className="flex justify-between mt-4">
          <button onClick={onDelete} className="text-xs text-red-600 flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded"><Trash2 size={11} /> 삭제</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button
              onClick={() => onSave({ title, laneId, startDay, duration, note, status })}
              className="px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >저장</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 의존성 화살표 SVG 오버레이 ───────────────────────────
function DependencyArrows({
  cards, links, lanes, dayWidth, totalDays, onRemoveLink,
}: {
  cards: ProcessMapCard[]
  links: ProcessMapLink[]
  lanes: ProcessMapLane[]
  dayWidth: number
  totalDays: number
  onRemoveLink: (id: string) => void
}) {
  const laneOrder = new Map<string, number>()
  lanes.forEach((l, i) => laneOrder.set(l.id, i))

  const width = LANE_LABEL_W + totalDays * dayWidth
  const height = HEADER_H + lanes.length * LANE_H

  return (
    <svg
      className="absolute pointer-events-none"
      style={{ top: 0, left: 0 }}
      width={width}
      height={height}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
        </marker>
      </defs>
      {links.map(link => {
        const from = cards.find(c => c.id === link.fromCardId)
        const to = cards.find(c => c.id === link.toCardId)
        if (!from || !to) return null
        const fLane = laneOrder.get(from.laneId) ?? 0
        const tLane = laneOrder.get(to.laneId) ?? 0
        const fromX = LANE_LABEL_W + (from.startDay + from.duration) * dayWidth
        const fromY = HEADER_H + fLane * LANE_H + LANE_H / 2
        const toX = LANE_LABEL_W + to.startDay * dayWidth
        const toY = HEADER_H + tLane * LANE_H + LANE_H / 2
        // L자 꺾임
        const midX = fromX + 8
        const path = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX - 3} ${toY}`
        return (
          <g key={link.id} className="pointer-events-auto">
            <path d={path} stroke="#94a3b8" strokeWidth="1" fill="none" markerEnd="url(#arrow)" />
            <circle
              cx={(midX + toX) / 2}
              cy={toY}
              r={4}
              fill="transparent"
              className="cursor-pointer"
              onClick={e => { e.stopPropagation(); if (confirm('이 의존성을 삭제할까요?')) onRemoveLink(link.id) }}
            >
              <title>클릭하여 삭제</title>
            </circle>
          </g>
        )
      })}
    </svg>
  )
}
