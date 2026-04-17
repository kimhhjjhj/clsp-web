'use client'

// ═══════════════════════════════════════════════════════════
// Pull Planning Board — 동양건설 강의자료 기준
//
// - 주 단위 시간축 (주별 시작~끝 날짜 표시)
// - 최상단 시공사/마일스톤 레인 고정
// - 카드는 "끝나는 날" 기준 포스트잇 스티커로 부착
// - 협력사별 색상 레인
// - Ask(요청) 카드 별도 타입
// - Handoff 링크 강조
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, Trash2, Pin, StickyNote, HelpCircle, Flag, GitFork, Circle,
  ChevronUp, ChevronDown, Link2,
} from 'lucide-react'
import type { ProcessMap, ProcessMapLane, ProcessMapCard, ProcessMapLink, CardKind, AskType, LaneKind } from '@/lib/process-map/types'
import { genId, buildWeekAxis } from '@/lib/process-map/types'
import type { MapAnalysis } from '@/lib/process-map/analyzer'

const HEADER_H = 56    // 주 헤더
const LANE_H = 80      // 레인 세로 크기 (포스트잇 2장 정도)
const LANE_LABEL_W = 180
const WEEK_W_DEFAULT = 140  // 주 1칸의 가로 px
const STICKER_MIN_W = 120
const STICKER_H = 56

interface Props {
  map: ProcessMap
  setMap: React.Dispatch<React.SetStateAction<ProcessMap>>
  startDate?: string | null
  onEditCard: (c: ProcessMapCard) => void
  markDirty: () => void
  analysis?: MapAnalysis
  linkingFrom: string | null
  setLinkingFrom: (id: string | null) => void
}

export default function PullPlanBoard({
  map, setMap, startDate, onEditCard, markDirty, analysis,
  linkingFrom, setLinkingFrom,
}: Props) {
  const [weekWidth, setWeekWidth] = useState(WEEK_W_DEFAULT)

  // ── 전체 공기 ─────────────────────────────────────
  const totalDays = useMemo(() => {
    const max = map.cards.reduce((s, c) => Math.max(s, c.startDay + c.duration), 0)
    const milestones = map.cards.filter(c => c.kind === 'milestone' || c.shape === 'milestone')
    const maxMs = milestones.reduce((s, c) => Math.max(s, c.startDay + c.duration), 0)
    return Math.max(max, maxMs, 28)  // 최소 4주
  }, [map.cards])

  const weeks = useMemo(() => buildWeekAxis(totalDays, startDate ?? undefined), [totalDays, startDate])

  // 레인 정렬: pinned 먼저, 그 다음 order
  const sortedLanes = useMemo(() =>
    [...map.lanes].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
      return a.order - b.order
    }),
  [map.lanes])

  const totalBoardW = LANE_LABEL_W + weeks.length * weekWidth

  // ── 레인 조작 ─────────────────────────────────────
  function addLane(kind: LaneKind) {
    const order = map.lanes.length
    const defaults = {
      contractor: { name: '시공사', color: '#1e293b' },
      trade:      { name: `공종 ${order}`, color: '#2563eb' },
      support:    { name: `지원 ${order}`, color: '#64748b' },
    }
    const lane: ProcessMapLane = {
      id: genId('lane'),
      kind, order,
      pinned: kind === 'contractor',
      ...defaults[kind],
    }
    setMap(m => ({ ...m, lanes: [...m.lanes, lane] }))
    markDirty()
  }

  function updateLane(id: string, patch: Partial<ProcessMapLane>) {
    setMap(m => ({ ...m, lanes: m.lanes.map(l => l.id === id ? { ...l, ...patch } : l) }))
    markDirty()
  }
  function removeLane(id: string) {
    if (!confirm('이 레인과 소속 카드들을 삭제합니다.')) return
    setMap(m => {
      const cardIds = m.cards.filter(c => c.laneId === id).map(c => c.id)
      return {
        ...m,
        lanes: m.lanes.filter(l => l.id !== id),
        cards: m.cards.filter(c => c.laneId !== id),
        links: m.links.filter(l => !cardIds.includes(l.fromCardId) && !cardIds.includes(l.toCardId)),
      }
    })
    markDirty()
  }
  function moveLaneUp(id: string) {
    setMap(m => {
      const sorted = [...m.lanes].sort((a, b) => a.order - b.order)
      const idx = sorted.findIndex(l => l.id === id)
      if (idx <= 0) return m
      const swap = sorted[idx - 1]
      if (swap.pinned && !sorted[idx].pinned) return m
      const newLanes = m.lanes.map(l => {
        if (l.id === id) return { ...l, order: swap.order }
        if (l.id === swap.id) return { ...l, order: sorted[idx].order }
        return l
      })
      return { ...m, lanes: newLanes }
    })
    markDirty()
  }
  function moveLaneDown(id: string) {
    setMap(m => {
      const sorted = [...m.lanes].sort((a, b) => a.order - b.order)
      const idx = sorted.findIndex(l => l.id === id)
      if (idx < 0 || idx >= sorted.length - 1) return m
      const swap = sorted[idx + 1]
      if (sorted[idx].pinned && !swap.pinned) return m
      const newLanes = m.lanes.map(l => {
        if (l.id === id) return { ...l, order: swap.order }
        if (l.id === swap.id) return { ...l, order: sorted[idx].order }
        return l
      })
      return { ...m, lanes: newLanes }
    })
    markDirty()
  }

  // ── 카드 조작 ─────────────────────────────────────
  function addCard(laneId: string, startDay: number, kind: CardKind = 'task') {
    const lane = map.lanes.find(l => l.id === laneId)
    const card: ProcessMapCard = {
      id: genId('card'),
      laneId,
      title: kind === 'ask' ? '요청사항' : kind === 'milestone' ? '마일스톤' : '새 작업',
      startDay: Math.max(0, Math.round(startDay)),
      duration: kind === 'milestone' ? 0.5 : 5,
      kind,
      finishAnchor: true,  // Pull 원칙: 종료일 기준
      proposedBy: lane?.ownerCompany ? `${lane.ownerCompany}${lane.ownerName ? '/' + lane.ownerName : ''}` : undefined,
      proposedAt: new Date().toISOString(),
      status: 'planned',
    }
    setMap(m => ({ ...m, cards: [...m.cards, card] }))
    markDirty()
  }

  function updateCard(id: string, patch: Partial<ProcessMapCard>) {
    setMap(m => ({ ...m, cards: m.cards.map(c => c.id === id ? { ...c, ...patch } : c) }))
    markDirty()
  }

  // ── 카드 드래그 ─────────────────────────────────────
  const [drag, setDrag] = useState<{
    cardId: string
    startX: number
    origStartDay: number
    origDuration: number
    origLaneId: string
    mode: 'move' | 'resize-right' | 'resize-left'
  } | null>(null)

  const boardRef = useRef<HTMLDivElement>(null)

  const dayWidth = weekWidth / 7

  const onStickerMouseDown = useCallback((e: React.MouseEvent, card: ProcessMapCard, mode: 'move' | 'resize-right' | 'resize-left') => {
    if (linkingFrom) return
    e.preventDefault()
    e.stopPropagation()
    setDrag({
      cardId: card.id,
      startX: e.clientX,
      origStartDay: card.startDay,
      origDuration: card.duration,
      origLaneId: card.laneId,
      mode,
    })
  }, [linkingFrom])

  useEffect(() => {
    if (!drag) return
    function onMove(ev: MouseEvent) {
      if (!drag) return
      const deltaX = ev.clientX - drag.startX
      const deltaDays = Math.round(deltaX / dayWidth)

      if (drag.mode === 'move') {
        updateCard(drag.cardId, { startDay: Math.max(0, drag.origStartDay + deltaDays) })
      } else if (drag.mode === 'resize-right') {
        updateCard(drag.cardId, { duration: Math.max(0.5, drag.origDuration + deltaDays) })
      } else {
        // resize-left: 시작을 당기고 기간을 보존
        const newStart = Math.max(0, drag.origStartDay + deltaDays)
        const deltaActual = newStart - drag.origStartDay
        updateCard(drag.cardId, {
          startDay: newStart,
          duration: Math.max(0.5, drag.origDuration - deltaActual),
        })
      }

      // 레인 변경 (vertical)
      if (drag.mode === 'move' && boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect()
        const relY = ev.clientY - rect.top - HEADER_H
        const idx = Math.floor(relY / LANE_H)
        const lane = sortedLanes[idx]
        if (lane && lane.id !== drag.origLaneId) {
          updateCard(drag.cardId, { laneId: lane.id })
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
  }, [drag, dayWidth, sortedLanes])

  // ── 링크 추가 (후행 연결 모드) ──────────
  function handleCardClick(card: ProcessMapCard) {
    if (linkingFrom && linkingFrom !== card.id) {
      // 동일 링크 중복 체크
      if (!map.links.some(l => l.fromCardId === linkingFrom && l.toCardId === card.id)) {
        setMap(m => ({
          ...m,
          links: [...m.links, { id: genId('link'), fromCardId: linkingFrom, toCardId: card.id, type: 'FS' }],
        }))
        markDirty()
      }
      setLinkingFrom(null)
    }
  }

  if (sortedLanes.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-500">
        <p className="mb-2">레인이 없습니다.</p>
        <p className="text-xs text-gray-400">상단 툴바에서 프리셋을 적용하거나 공종 레인을 추가하세요.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-auto" ref={boardRef} style={{ maxHeight: 'min(78vh, 820px)' }}>
      <div style={{ width: totalBoardW, position: 'relative' }}>
        {/* 헤더 — 주 단위 */}
        <div
          className="sticky top-0 z-20 flex items-stretch bg-gradient-to-b from-slate-50 to-white border-b-2 border-slate-200"
          style={{ height: HEADER_H }}
        >
          <div
            className="flex-shrink-0 flex items-center px-3 text-xs font-bold text-slate-500 border-r-2 border-slate-200 bg-white"
            style={{ width: LANE_LABEL_W }}
          >
            구분
          </div>
          {weeks.map((w, i) => (
            <div
              key={w.index}
              className="flex-shrink-0 flex flex-col items-center justify-center border-r border-slate-200 text-xs"
              style={{ width: weekWidth }}
            >
              <div className="font-bold text-slate-700">W{w.index}</div>
              {w.startDate && (
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {w.startDate.slice(5).replace('-', '/')}~{w.endDate!.slice(5).replace('-', '/')}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 레인들 */}
        {sortedLanes.map(lane => {
          const laneCards = map.cards.filter(c => c.laneId === lane.id)
          const bgTint = lane.kind === 'contractor' ? 'bg-slate-50' : ''
          return (
            <div
              key={lane.id}
              className={`relative flex items-stretch border-b border-slate-100 ${bgTint} group/lane`}
              style={{ height: LANE_H }}
              onDoubleClick={e => {
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                const x = e.clientX - rect.left - LANE_LABEL_W
                if (x < 0) return
                const day = Math.max(0, Math.round(x / dayWidth))
                addCard(lane.id, day, lane.kind === 'contractor' ? 'milestone' : 'task')
              }}
            >
              {/* 레인 라벨 */}
              <div
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 border-r-2 border-slate-200 bg-white z-10"
                style={{ width: LANE_LABEL_W, borderLeft: `4px solid ${lane.color}` }}
              >
                <div className="flex-1 min-w-0">
                  <input
                    className="w-full font-semibold text-xs text-slate-800 bg-transparent outline-none truncate"
                    value={lane.name}
                    onChange={e => updateLane(lane.id, { name: e.target.value })}
                  />
                  <input
                    className="w-full text-[10px] text-slate-500 bg-transparent outline-none truncate mt-0.5"
                    placeholder="협력사명"
                    value={lane.ownerCompany ?? ''}
                    onChange={e => updateLane(lane.id, { ownerCompany: e.target.value })}
                  />
                </div>
                {lane.pinned && <Pin size={10} className="text-slate-400" />}
                <div className="flex flex-col opacity-0 group-hover/lane:opacity-100 transition-opacity">
                  <button onClick={() => moveLaneUp(lane.id)} className="p-0.5 hover:text-slate-700 text-slate-300"><ChevronUp size={10} /></button>
                  <button onClick={() => moveLaneDown(lane.id)} className="p-0.5 hover:text-slate-700 text-slate-300"><ChevronDown size={10} /></button>
                </div>
                <input
                  type="color"
                  value={lane.color}
                  onChange={e => updateLane(lane.id, { color: e.target.value })}
                  className="w-4 h-4 rounded cursor-pointer opacity-0 group-hover/lane:opacity-100"
                  title="레인 색"
                />
                <button
                  onClick={() => removeLane(lane.id)}
                  className="text-slate-300 hover:text-red-500 opacity-0 group-hover/lane:opacity-100"
                ><Trash2 size={11} /></button>
              </div>

              {/* 타임축 영역 */}
              <div className="relative flex-1">
                {/* 주 그리드 */}
                {weeks.map((w, i) => (
                  <div
                    key={w.index}
                    className="absolute top-0 bottom-0 border-r border-slate-100"
                    style={{ left: i * weekWidth, width: weekWidth, background: i % 2 === 0 ? 'transparent' : 'rgba(241,245,249,0.3)' }}
                  />
                ))}

                {/* 카드 스티커 */}
                {laneCards.map(card => (
                  <Sticker
                    key={card.id}
                    card={card}
                    lane={lane}
                    dayWidth={dayWidth}
                    laneH={LANE_H}
                    isCritical={analysis?.criticalPath.has(card.id) ?? false}
                    hasConflict={analysis?.conflicts.some(c => c.cardIds.includes(card.id)) ?? false}
                    isLinkingThis={linkingFrom === card.id}
                    onMouseDown={(e, mode) => onStickerMouseDown(e, card, mode)}
                    onClick={() => handleCardClick(card)}
                    onDoubleClick={() => onEditCard(card)}
                    onStartLink={() => setLinkingFrom(card.id)}
                  />
                ))}

                {laneCards.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-300 italic pointer-events-none">
                    더블클릭하여 {lane.kind === 'contractor' ? '마일스톤' : '작업'} 추가
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* 의존성 화살표 (전체 오버레이) */}
        <DependencyOverlay
          lanes={sortedLanes}
          cards={map.cards}
          links={map.links}
          dayWidth={dayWidth}
          weekCount={weeks.length}
          onRemoveLink={id => {
            if (confirm('이 연결을 삭제할까요?')) {
              setMap(m => ({ ...m, links: m.links.filter(l => l.id !== id) }))
              markDirty()
            }
          }}
        />

        {/* 레인 추가 버튼 */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-t border-slate-200">
          <span className="text-xs text-slate-500">레인 추가:</span>
          <button onClick={() => addLane('contractor')} className="text-[11px] px-2 py-1 bg-slate-700 text-white rounded hover:bg-slate-800">시공사/마일스톤</button>
          <button onClick={() => addLane('trade')} className="text-[11px] px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">주공종</button>
          <button onClick={() => addLane('support')} className="text-[11px] px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700">지원공종</button>
          <span className="ml-auto text-xs text-slate-500">
            칸 너비:
            <input type="range" min={80} max={220} step={10} value={weekWidth} onChange={e => setWeekWidth(Number(e.target.value))} className="mx-2 align-middle" />
            {weekWidth}px/주
          </span>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Sticker (카드) — 포스트잇 스타일
// ────────────────────────────────────────────────────────
function Sticker({
  card, lane, dayWidth, laneH, isCritical, hasConflict, isLinkingThis,
  onMouseDown, onClick, onDoubleClick, onStartLink,
}: {
  card: ProcessMapCard
  lane: ProcessMapLane
  dayWidth: number
  laneH: number
  isCritical: boolean
  hasConflict: boolean
  isLinkingThis: boolean
  onMouseDown: (e: React.MouseEvent, mode: 'move' | 'resize-right' | 'resize-left') => void
  onClick: () => void
  onDoubleClick: () => void
  onStartLink: () => void
}) {
  const kind = card.kind ?? card.shape ?? 'task'
  const width = Math.max(STICKER_MIN_W, card.duration * dayWidth)
  const left = card.startDay * dayWidth
  const top = (laneH - STICKER_H) / 2

  if (kind === 'milestone') {
    return (
      <div
        className="absolute flex flex-col items-center justify-center cursor-move select-none"
        style={{ left: left - 16, top: top - 2, width: 80, height: STICKER_H + 4 }}
        onMouseDown={e => onMouseDown(e, 'move')}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        title={`${card.title} · D+${card.startDay}`}
      >
        <Flag size={14} className="text-orange-500" fill="#fb923c" />
        <div className="text-[10px] font-bold text-orange-600 text-center leading-tight px-1 mt-1 line-clamp-2">
          {card.title}
        </div>
      </div>
    )
  }

  // Ask / Task / Decision / Note → 포스트잇 형태
  const styles = stickerStyle(kind, lane.color, isCritical, hasConflict, isLinkingThis, card.status)

  return (
    <div
      className="absolute group/sticker select-none cursor-move shadow-sm"
      style={{
        left,
        top,
        width,
        height: STICKER_H,
        ...styles.container,
      }}
      onMouseDown={e => onMouseDown(e, 'move')}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={`${card.title}\n${card.duration}일${card.proposedBy ? '\n제안: ' + card.proposedBy : ''}${hasConflict ? '\n⚠ 충돌' : ''}${isCritical ? '\n★ Critical' : ''}`}
    >
      {/* 상단 라벨 (제안자/공종) */}
      {card.proposedBy && (
        <div className="absolute -top-3 left-1 text-[9px] text-slate-500 bg-white/90 px-1 rounded border border-slate-200 truncate max-w-[110px]">
          {card.proposedBy}
        </div>
      )}

      {/* 왼쪽 리사이즈 핸들 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover/sticker:opacity-100 hover:bg-black/20"
        onMouseDown={e => { e.stopPropagation(); onMouseDown(e, 'resize-left') }}
      />

      {/* 본문 */}
      <div className="flex items-center gap-1 px-2 py-1 h-full" style={styles.inner}>
        {kind === 'ask' && <HelpCircle size={11} className="flex-shrink-0" />}
        {kind === 'decision' && <GitFork size={11} className="flex-shrink-0" />}
        {isCritical && <span className="text-[8px] font-bold bg-orange-500 text-white px-1 rounded flex-shrink-0">CP</span>}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold truncate leading-tight">{card.title}</div>
          {card.requestTo && kind === 'ask' && (
            <div className="text-[9px] opacity-80 truncate">→ {card.requestTo}</div>
          )}
          {(() => {
            const totalWorkers = card.resources?.workers?.reduce((s, w) => s + (w.count || 0), 0) ?? 0
            const zones = card.workZones?.length ? card.workZones.slice(0, 3).join(',') + (card.workZones.length > 3 ? `+${card.workZones.length - 3}` : '') : null
            const parts: string[] = []
            if (card.duration >= 1) parts.push(`${card.duration}일`)
            if (totalWorkers > 0) parts.push(`👷${totalWorkers}`)
            if (zones) parts.push(`📍${zones}`)
            if (card.comments?.length) parts.push(`💬${card.comments.length}`)
            if (parts.length === 0) return null
            return <div className="text-[9px] opacity-70 mt-0.5 truncate">{parts.join(' · ')}</div>
          })()}
        </div>
        {card.request && (card.request.targetTrade || card.request.task) && (
          <span className="text-[8px] bg-amber-400/80 text-amber-900 px-1 rounded flex-shrink-0" title={`요청: ${card.request.targetTrade || '?'} - ${card.request.task || ''}`}>📌</span>
        )}
        {card.baselineTaskId && (
          <span className="text-[8px] bg-black/20 px-1 rounded flex-shrink-0">MSP</span>
        )}
      </div>

      {/* 오른쪽 리사이즈 + 후행 링크 */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover/sticker:opacity-100 hover:bg-black/20"
        onMouseDown={e => { e.stopPropagation(); onMouseDown(e, 'resize-right') }}
      />
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onStartLink() }}
        className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full flex items-center justify-center opacity-0 group-hover/sticker:opacity-100 hover:bg-blue-500 hover:scale-110 transition-transform z-10"
        title="후행 연결"
      ><Link2 size={8} className="text-blue-500" /></button>

      {/* 충돌 경고 */}
      {hasConflict && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white" title="공정 충돌" />
      )}
    </div>
  )
}

// 카드 종류별 스타일
function stickerStyle(kind: CardKind, laneColor: string, isCritical: boolean, hasConflict: boolean, isLinking: boolean, status?: string): { container: React.CSSProperties; inner: React.CSSProperties } {
  const border = hasConflict ? '2px solid #dc2626'
    : isLinking ? '2px solid #2563eb'
    : isCritical ? '2px solid #ea580c'
    : '1px solid rgba(0,0,0,0.1)'

  if (kind === 'ask') {
    // 노란 포스트잇 (요청사항)
    return {
      container: { background: '#fef3c7', borderRadius: 2, border, boxShadow: '1px 2px 3px rgba(0,0,0,0.08)' },
      inner: { color: '#78350f' },
    }
  }
  if (kind === 'note') {
    return {
      container: { background: '#fde68a', borderRadius: 2, border, boxShadow: '1px 2px 3px rgba(0,0,0,0.08)' },
      inner: { color: '#78350f' },
    }
  }
  if (kind === 'decision') {
    return {
      container: { background: '#e9d5ff', borderRadius: 4, border, boxShadow: '1px 2px 3px rgba(0,0,0,0.08)' },
      inner: { color: '#581c87' },
    }
  }

  // task
  const STATUS: Record<string, string> = {
    in_progress: '#2563eb',
    done: '#16a34a',
    blocked: '#dc2626',
  }
  const bg = (status && STATUS[status]) || laneColor
  return {
    container: { background: bg, borderRadius: 4, border, boxShadow: '1px 2px 3px rgba(0,0,0,0.15)' },
    inner: { color: '#fff' },
  }
}

// ────────────────────────────────────────────────────────
// 의존성 화살표
// ────────────────────────────────────────────────────────
function DependencyOverlay({
  lanes, cards, links, dayWidth, weekCount, onRemoveLink,
}: {
  lanes: ProcessMapLane[]
  cards: ProcessMapCard[]
  links: ProcessMapLink[]
  dayWidth: number
  weekCount: number
  onRemoveLink: (id: string) => void
}) {
  const laneOrder = new Map<string, number>()
  lanes.forEach((l, i) => laneOrder.set(l.id, i))

  const width = LANE_LABEL_W + weekCount * (dayWidth * 7)
  const height = HEADER_H + lanes.length * LANE_H

  return (
    <svg
      className="absolute pointer-events-none"
      style={{ top: 0, left: 0 }}
      width={width}
      height={height}
    >
      <defs>
        <marker id="pull-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
        </marker>
        <marker id="pull-arrow-handoff" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ea580c" />
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
        const midX = fromX + 10
        const path = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX - 2} ${toY}`
        const isCross = from.laneId !== to.laneId
        const stroke = link.isHandoff || isCross ? '#ea580c' : '#94a3b8'
        const dash = link.type !== 'FS' ? '4,2' : undefined
        return (
          <g key={link.id} style={{ pointerEvents: 'auto' }}>
            <path
              d={path}
              stroke={stroke}
              strokeWidth={link.isHandoff ? 2 : 1.2}
              strokeDasharray={dash}
              fill="none"
              markerEnd={`url(#pull-arrow${link.isHandoff ? '-handoff' : ''})`}
              style={{ cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); onRemoveLink(link.id) }}
            />
            {(link.type !== 'FS' || link.lag) && (
              <text x={midX + 2} y={(fromY + toY) / 2 - 2} fontSize={9} fill={stroke} fontWeight={600}>
                {link.type}{link.lag ? (link.lag > 0 ? '+' : '') + link.lag : ''}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
