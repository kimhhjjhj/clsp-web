'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, Trash2, Save, Download, Upload, ZoomIn, ZoomOut, Loader2,
  Link2, Unlink, Edit3, ChevronRight, Palette, GanttChartSquare, Workflow,
  Undo2, Redo2, Image as ImageIcon, Sparkles, MessageSquare, LayoutGrid, HelpCircle,
} from 'lucide-react'
import {
  type ProcessMap, type ProcessMapLane, type ProcessMapCard, type ProcessMapLink, type CardComment,
  type CardRequest, type CardResources, type CardWorker, type CardMaterial,
  EMPTY_MAP, DEFAULT_LANES, LECTURE_DEFAULT_LANES, DEFAULT_ZONE_ROWS, DEFAULT_ZONE_COLS, genId,
} from '@/lib/process-map/types'
import PullPlanBoard from './PullPlanBoard'
import { analyzeProcessMap } from '@/lib/process-map/analyzer'
import { autoLayout } from '@/lib/process-map/auto-layout'
import { exportToPng } from '@/lib/process-map/export-png'
import { useAutoSaveDraft } from '@/lib/hooks/useAutoSaveDraft'
import DraftRestoreBanner from '@/components/common/DraftRestoreBanner'
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
  const [viewMode, setViewMode] = useState<'pull' | 'timeline' | 'flow'>('pull')
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

  // ── 서버 버전 추적 (draft 충돌 감지용) ────────────
  const [serverVersion, setServerVersion] = useState<string | undefined>(undefined)

  // ── 로드 ───────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/projects/${projectId}/process-map`)
      .then(r => r.json())
      .then((data) => {
        setMap({
          lanes: data.lanes ?? [],
          cards: data.cards ?? [],
          links: data.links ?? [],
          groups: data.groups ?? [],
        })
        setServerVersion(data.updatedAt ?? undefined)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [projectId])

  // ── 자동 저장 (localStorage draft) ─────────────────
  const draftKey = `pmap-draft:${projectId}`
  const { hasDraft, draftEnvelope, lastSavedAt, clearDraft, applyDraft } = useAutoSaveDraft<ProcessMap>({
    key: draftKey,
    data: map,
    enabled: !loading && dirty,   // 서버 로드 완료 + 미저장 변경이 있을 때만
    serverVersion,
    isMeaningful: (m) => m.lanes.length > 0 || m.cards.length > 0,
  })

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
        const data = await res.json()
        setDirty(false)
        setNotice('저장됨')
        setServerVersion(data.updatedAt ?? new Date().toISOString())
        clearDraft()
        setTimeout(() => setNotice(null), 1500)
      } else {
        setNotice('저장 실패 — 초안은 자동 보관됨')
        setTimeout(() => setNotice(null), 3000)
      }
    } catch {
      setNotice('네트워크 오류 — 초안은 자동 보관됨')
      setTimeout(() => setNotice(null), 3000)
    } finally {
      setSaving(false)
    }
  }, [projectId, map, clearDraft])

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
      {/* 복구 배너 (저장되지 않은 초안이 있을 때) */}
      {hasDraft && draftEnvelope && (
        <DraftRestoreBanner
          savedAt={draftEnvelope.savedAt}
          label="프로세스맵 변경"
          onRestore={() => applyDraft(d => { setMapRaw(d); setDirty(true); setNotice('초안 복원됨'); setTimeout(() => setNotice(null), 2000) })}
          onDiscard={() => { clearDraft(); setNotice('초안 폐기됨'); setTimeout(() => setNotice(null), 1500) }}
        />
      )}

      {/* 뷰 토글 */}
      <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-lg w-fit">
        <button
          onClick={() => setViewMode('pull')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            viewMode === 'pull' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
          title="동양건설 강의자료 기준 — 주 단위, 협력사 주도, 마일스톤 역산"
        ><LayoutGrid size={13} /> Pull Planning (협력사 주도)</button>
        <button
          onClick={() => setViewMode('timeline')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            viewMode === 'timeline' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        ><GanttChartSquare size={13} /> 타임라인 (일 단위)</button>
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
            onClick={() => {
              if (map.lanes.length > 0 && !confirm('기존 레인을 모두 유지하고 강의자료 기본 레인(시공사+토목+철골+골조+마감+지원)을 추가합니다. 계속할까요?')) return
              const existingNames = new Set(map.lanes.map(l => l.name))
              const presetLanes = LECTURE_DEFAULT_LANES
                .filter(p => !existingNames.has(p.name))
                .map(p => ({ id: genId('lane'), ...p, order: p.order + map.lanes.length }))
              setMap(m => ({ ...m, lanes: [...m.lanes, ...presetLanes] }))
              markDirty()
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold rounded-lg hover:bg-amber-200"
            title="강의자료 기준 기본 레인 세트 (시공사/토목/철골/골조/마감/전기·통신/기계·설비/소방/가설·안전)"
          >
            <LayoutGrid size={12} /> 강의자료 프리셋 적용
          </button>
          <button
            onClick={addLane}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-xs font-semibold rounded-lg hover:bg-gray-50"
          >
            <Plus size={12} /> 레인 추가
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
          {dirty && (
            <span className="text-xs text-orange-500" title={lastSavedAt ? `자동 초안 ${new Date(lastSavedAt).toLocaleTimeString('ko-KR')}` : '자동 저장 대기중'}>
              ● 미저장{lastSavedAt ? ' (자동보관됨)' : ''}
            </span>
          )}
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

      {/* 보드 (Pull Planning) — 강의자료 기준 */}
      {viewMode === 'pull' && (
        <PullPlanBoard
          map={map}
          setMap={setMap}
          startDate={startDate}
          onEditCard={setEditingCard}
          markDirty={markDirty}
          analysis={analysis}
          linkingFrom={linkingFrom}
          setLinkingFrom={setLinkingFrom}
        />
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
                        {card.comments && card.comments.length > 0 && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-[9px] bg-black/30 px-1 rounded flex-shrink-0">
                            <MessageSquare size={8} />{card.comments.length}
                          </span>
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
  const [assignee, setAssignee] = useState(card.assignee ?? '')
  const [kind, setKind] = useState(card.kind ?? card.shape ?? 'task')
  const [askType, setAskType] = useState(card.askType ?? 'predecessor')
  const [requestTo, setRequestTo] = useState(card.requestTo ?? '')
  const [comments, setComments] = useState<CardComment[]>(card.comments ?? [])
  const [newAuthor, setNewAuthor] = useState('')
  const [newText, setNewText] = useState('')

  // 강의자료 양식 필드
  const [location, setLocation] = useState(card.location ?? '')
  const [workContent, setWorkContent] = useState(card.workContent ?? '')
  const [workZones, setWorkZones] = useState<string[]>(card.workZones ?? [])
  const [workers, setWorkers] = useState<CardWorker[]>(card.resources?.workers ?? [])
  const [equipment, setEquipment] = useState<string[]>(card.resources?.equipment ?? [])
  const [materials, setMaterials] = useState<CardMaterial[]>(card.resources?.materials ?? [])
  const [request, setRequest] = useState<CardRequest>(card.request ?? {})
  // 섹션 접기
  const [openSection, setOpenSection] = useState<'basic' | 'work' | 'zone' | 'request' | 'comments'>('basic')

  function toggleZone(zone: string) {
    setWorkZones(prev => prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone])
  }
  function addWorker() { setWorkers(w => [...w, { trade: '', count: 0 }]) }
  function updateWorker(i: number, patch: Partial<CardWorker>) { setWorkers(w => w.map((x, j) => j === i ? { ...x, ...patch } : x)) }
  function removeWorker(i: number) { setWorkers(w => w.filter((_, j) => j !== i)) }
  function addMaterial() { setMaterials(m => [...m, { name: '' }]) }
  function updateMaterial(i: number, patch: Partial<CardMaterial>) { setMaterials(m => m.map((x, j) => j === i ? { ...x, ...patch } : x)) }
  function removeMaterial(i: number) { setMaterials(m => m.filter((_, j) => j !== i)) }
  function addEquipment() { setEquipment(e => [...e, '']) }
  function updateEquipment(i: number, val: string) { setEquipment(e => e.map((x, j) => j === i ? val : x)) }
  function removeEquipment(i: number) { setEquipment(e => e.filter((_, j) => j !== i)) }

  const totalWorkers = workers.reduce((s, w) => s + (w.count || 0), 0)

  function addComment() {
    const text = newText.trim()
    if (!text) return
    const author = newAuthor.trim() || '미지정'
    setComments(cs => [...cs, {
      id: `cmt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      author,
      text,
      createdAt: new Date().toISOString(),
    }])
    setNewText('')
    // 발언자는 유지 (같은 사람이 연속 발언하는 경우 많음)
  }

  function removeComment(id: string) {
    setComments(cs => cs.filter(c => c.id !== id))
  }

  function fmtTime(iso: string): string {
    try {
      const d = new Date(iso)
      return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    } catch { return '' }
  }

  const SectionHeader = ({ id, title, right }: { id: typeof openSection; title: string; right?: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => setOpenSection(id)}
      className={`w-full flex items-center justify-between px-3 py-2 border-t border-gray-100 text-xs font-semibold ${
        openSection === id ? 'bg-slate-50 text-slate-900' : 'bg-white text-gray-500 hover:bg-gray-50'
      }`}
    >
      <span className="flex items-center gap-1.5">
        <span className={`w-1 h-3 rounded-full ${openSection === id ? 'bg-blue-600' : 'bg-gray-300'}`} />
        {title}
      </span>
      {right}
    </button>
  )

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Edit3 size={14} /> 카드 편집 · <span className="text-gray-400 font-normal">{title || '(제목 없음)'}</span>
          </h3>
          <span className="text-[10px] text-gray-400">{kind === 'ask' ? '요청사항' : kind === 'milestone' ? '마일스톤' : kind === 'decision' ? '결정' : '작업'}</span>
        </div>

        {/* 섹션: 기본 */}
        <SectionHeader id="basic" title="1. 기본정보" />
        {openSection === 'basic' && (
        <div className="p-4 space-y-2.5 overflow-auto">
          {/* 종류 (task/ask/milestone 등) */}
          <div>
            <label className="text-xs text-gray-500 font-semibold">종류</label>
            <div className="mt-1 grid grid-cols-5 gap-1">
              {[
                { k: 'task', label: '작업', bg: 'bg-blue-100 text-blue-800' },
                { k: 'ask', label: '요청', bg: 'bg-amber-100 text-amber-800' },
                { k: 'milestone', label: '마일스톤', bg: 'bg-orange-100 text-orange-800' },
                { k: 'decision', label: '결정', bg: 'bg-purple-100 text-purple-800' },
                { k: 'note', label: '메모', bg: 'bg-yellow-100 text-yellow-800' },
              ].map(o => (
                <button
                  key={o.k}
                  onClick={() => setKind(o.k as any)}
                  className={`px-2 py-1.5 rounded text-[11px] font-semibold border transition-colors ${
                    kind === o.k ? `${o.bg} border-current` : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >{o.label}</button>
              ))}
            </div>
          </div>

          {/* Ask 전용 옵션 */}
          {kind === 'ask' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-amber-800 font-semibold">요청 유형</label>
                  <select value={askType} onChange={e => setAskType(e.target.value as any)} className="mt-0.5 w-full border border-amber-200 rounded px-2 py-1.5 text-xs bg-white">
                    <option value="predecessor">선행완료</option>
                    <option value="material">자재납품</option>
                    <option value="approval">승인/검측</option>
                    <option value="info">정보/도면</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-amber-800 font-semibold">요청 대상</label>
                  <input value={requestTo} onChange={e => setRequestTo(e.target.value)} placeholder="예: 형틀/다원이앤씨"
                    className="mt-0.5 w-full border border-amber-200 rounded px-2 py-1.5 text-xs bg-white" />
                </div>
              </div>
            </div>
          )}

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
          <div className="grid grid-cols-2 gap-2">
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
              <label className="text-xs text-gray-500 font-semibold">담당자</label>
              <input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="예: 박소장/새한기업" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
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
        )}

        {/* 섹션: 작업 사항 */}
        <SectionHeader
          id="work"
          title="2. 작업 사항"
          right={<span className="text-[10px] text-gray-400">
            {totalWorkers > 0 && `인원 ${totalWorkers}명`}
            {equipment.filter(x=>x.trim()).length > 0 && ` · 장비 ${equipment.filter(x=>x.trim()).length}`}
            {materials.filter(m=>m.name).length > 0 && ` · 자재 ${materials.filter(m=>m.name).length}`}
          </span>}
        />
        {openSection === 'work' && (
        <div className="p-4 space-y-2.5 overflow-auto">
          <div>
            <label className="text-xs text-gray-500 font-semibold">작업내용</label>
            <textarea
              value={workContent}
              onChange={e => setWorkContent(e.target.value)}
              rows={2}
              placeholder="예) B2F 바닥 1구간 철근 배근 및 매립 박스 고정"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>

          {/* 투입인원 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500 font-semibold">투입인원 {totalWorkers > 0 && <span className="text-blue-600">(총 {totalWorkers}명)</span>}</label>
              <button type="button" onClick={addWorker} className="text-[11px] text-blue-600 hover:underline">+ 추가</button>
            </div>
            {workers.length === 0 ? (
              <div className="text-[11px] text-gray-400 italic py-1">입력된 인원 없음</div>
            ) : (
              <ul className="space-y-1">
                {workers.map((w, i) => (
                  <li key={i} className="grid grid-cols-[1fr_1fr_80px_auto] gap-1 items-center">
                    <input value={w.trade} onChange={e => updateWorker(i, { trade: e.target.value })} placeholder="공종 (예: 철근)" className="border border-gray-200 rounded px-2 py-1 text-xs" />
                    <input value={w.company ?? ''} onChange={e => updateWorker(i, { company: e.target.value })} placeholder="회사 (예: 새한기업)" className="border border-gray-200 rounded px-2 py-1 text-xs" />
                    <input type="number" min={0} value={w.count || ''} onChange={e => updateWorker(i, { count: Number(e.target.value) })} placeholder="명" className="border border-gray-200 rounded px-2 py-1 text-xs font-mono" />
                    <button type="button" onClick={() => removeWorker(i)} className="text-gray-300 hover:text-red-500"><Trash2 size={11} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 투입장비 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500 font-semibold">투입장비</label>
              <button type="button" onClick={addEquipment} className="text-[11px] text-blue-600 hover:underline">+ 추가</button>
            </div>
            {equipment.length === 0 ? (
              <div className="text-[11px] text-gray-400 italic py-1">입력된 장비 없음</div>
            ) : (
              <ul className="space-y-1">
                {equipment.map((e, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <input value={e} onChange={ev => updateEquipment(i, ev.target.value)} placeholder="예) 타워크레인 2대, 굴착기 1대" className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
                    <button type="button" onClick={() => removeEquipment(i)} className="text-gray-300 hover:text-red-500"><Trash2 size={11} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 투입자재 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500 font-semibold">투입자재</label>
              <button type="button" onClick={addMaterial} className="text-[11px] text-blue-600 hover:underline">+ 추가</button>
            </div>
            {materials.length === 0 ? (
              <div className="text-[11px] text-gray-400 italic py-1">입력된 자재 없음</div>
            ) : (
              <ul className="space-y-1">
                {materials.map((m, i) => (
                  <li key={i} className="grid grid-cols-[1fr_80px_70px_auto] gap-1 items-center">
                    <input value={m.name} onChange={e => updateMaterial(i, { name: e.target.value })} placeholder="자재명 (예: 레미콘 25-21-150)" className="border border-gray-200 rounded px-2 py-1 text-xs" />
                    <input type="number" value={m.qty ?? ''} onChange={e => updateMaterial(i, { qty: e.target.value ? Number(e.target.value) : undefined })} placeholder="수량" className="border border-gray-200 rounded px-2 py-1 text-xs font-mono" />
                    <input value={m.unit ?? ''} onChange={e => updateMaterial(i, { unit: e.target.value })} placeholder="단위" className="border border-gray-200 rounded px-2 py-1 text-xs" />
                    <button type="button" onClick={() => removeMaterial(i)} className="text-gray-300 hover:text-red-500"><Trash2 size={11} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        )}

        {/* 섹션: 작업 구간 (구역 그리드) */}
        <SectionHeader
          id="zone"
          title="3. 작업 구간"
          right={workZones.length > 0 ? <span className="text-[10px] text-blue-600 font-semibold">{workZones.join(', ')}</span> : undefined}
        />
        {openSection === 'zone' && (
        <div className="p-4 space-y-2.5 overflow-auto">
          <div>
            <label className="text-xs text-gray-500 font-semibold">위치 (자유 입력)</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="예) B2F 바닥 1구간, 101동 3F" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-semibold mb-1 block">그리드 구역 선택 (A~D × 1~6)</label>
            <div className="inline-block border border-gray-200 rounded-lg overflow-hidden">
              <table className="border-collapse">
                <thead>
                  <tr>
                    <th className="w-8 h-7 bg-gray-50 border-b border-r border-gray-200 text-[10px] text-gray-400"></th>
                    {DEFAULT_ZONE_COLS.map(col => (
                      <th key={col} className="w-8 h-7 bg-gray-50 border-b border-r border-gray-200 text-[10px] font-semibold text-gray-600">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEFAULT_ZONE_ROWS.map(row => (
                    <tr key={row}>
                      <td className="w-8 h-8 bg-gray-50 border-b border-r border-gray-200 text-[10px] font-semibold text-center text-gray-600">{row}</td>
                      {DEFAULT_ZONE_COLS.map(col => {
                        const zoneId = `${row}-${col}`
                        const selected = workZones.includes(zoneId)
                        return (
                          <td
                            key={zoneId}
                            onClick={() => toggleZone(zoneId)}
                            className={`w-8 h-8 border-b border-r border-gray-200 cursor-pointer transition-colors text-[9px] text-center font-mono ${
                              selected ? 'bg-blue-600 text-white font-bold' : 'hover:bg-blue-50 text-gray-300'
                            }`}
                          >{selected ? '●' : zoneId}</td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">칸 클릭으로 선택/해제 · 선택: <span className="font-mono">{workZones.join(', ') || '없음'}</span></p>
          </div>
        </div>
        )}

        {/* 섹션: 타 공종 요청사항 */}
        <SectionHeader
          id="request"
          title="4. 타 공종 요청사항"
          right={(request.targetTrade || request.task) ? <span className="text-[10px] text-amber-700 font-semibold">{request.targetTrade || '미지정'}: {request.task || ''}</span> : undefined}
        />
        {openSection === 'request' && (
        <div className="p-4 space-y-2.5 overflow-auto">
          <p className="text-[11px] text-gray-500 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
            다른 공종에게 "이걸 해줘야 내 작업이 들어갈 수 있다"고 요청하는 사항. 강의자료 양식 상단 영역.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 font-semibold">해당 공종</label>
              <input value={request.targetTrade ?? ''} onChange={e => setRequest(r => ({ ...r, targetTrade: e.target.value }))} placeholder="예) 형틀, 전기" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">위치</label>
              <input value={request.location ?? ''} onChange={e => setRequest(r => ({ ...r, location: e.target.value }))} placeholder="예) B2F 코어 벽체" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-semibold">요청작업</label>
            <input value={request.task ?? ''} onChange={e => setRequest(r => ({ ...r, task: e.target.value }))} placeholder="예) 슬리브 매립 완료 + 배근 검측 요청" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 font-semibold">요청 구간</label>
              <input value={request.zone ?? ''} onChange={e => setRequest(r => ({ ...r, zone: e.target.value }))} placeholder="예) A-1, A-2, B-1" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">요청 일정</label>
              <input value={request.date ?? ''} onChange={e => setRequest(r => ({ ...r, date: e.target.value }))} placeholder="예) 2026-05-12 까지" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
        )}

        {/* 섹션: 회의 코멘트 */}
        <SectionHeader
          id="comments"
          title="5. 회의 코멘트"
          right={<span className="text-[10px] text-gray-400">{comments.length}건</span>}
        />
        {openSection === 'comments' && (
        <div className="p-4 space-y-2.5 overflow-auto">
          {/* 기존 코멘트 */}
          {comments.length > 0 && (
            <ul className="space-y-1.5 max-h-52 overflow-auto">
              {comments.map(c => (
                <li key={c.id} className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-gray-700">{c.author}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400">{fmtTime(c.createdAt)}</span>
                      <button onClick={() => removeComment(c.id)} className="text-gray-300 hover:text-red-600" title="삭제">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap leading-snug">{c.text}</p>
                </li>
              ))}
            </ul>
          )}

          {/* 신규 코멘트 입력 */}
          <div className="bg-blue-50/40 border border-blue-100 rounded-lg p-2 space-y-1.5">
            <input
              value={newAuthor}
              onChange={e => setNewAuthor(e.target.value)}
              placeholder="발언자 (예: 박소장/새한기업)"
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-white"
            />
            <textarea
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addComment() }}
              rows={2}
              placeholder="의견 / 우려 / 조건 입력 (Ctrl+Enter로 추가)"
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-white resize-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addComment}
                disabled={!newText.trim()}
                className="text-[11px] px-2.5 py-1 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
              >코멘트 추가</button>
            </div>
          </div>
        </div>
        )}

        <div className="flex justify-between p-3 border-t border-gray-200 bg-gray-50">
          <button onClick={onDelete} className="text-xs text-red-600 flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded"><Trash2 size={11} /> 삭제</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button
              onClick={() => {
                const hasReq = request.targetTrade || request.task || request.location || request.zone || request.date
                const cleanEquip = equipment.filter(x => x.trim())
                const cleanMat = materials.filter(m => m.name.trim())
                const cleanWork = workers.filter(w => w.trade.trim() || w.count > 0)
                const res: CardResources | undefined = (cleanWork.length || cleanEquip.length || cleanMat.length) ? {
                  workers: cleanWork.length ? cleanWork : undefined,
                  equipment: cleanEquip.length ? cleanEquip : undefined,
                  materials: cleanMat.length ? cleanMat : undefined,
                } : undefined
                onSave({
                  title, laneId, startDay, duration, note, status,
                  assignee: assignee || undefined,
                  comments,
                  kind,
                  askType: kind === 'ask' ? askType : undefined,
                  requestTo: kind === 'ask' ? (requestTo || undefined) : undefined,
                  location: location || undefined,
                  workContent: workContent || undefined,
                  workZones: workZones.length ? workZones : undefined,
                  resources: res,
                  request: hasReq ? request : undefined,
                })
              }}
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
