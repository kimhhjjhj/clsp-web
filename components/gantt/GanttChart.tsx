'use client'

import React, { useRef, useCallback, useState, useEffect } from 'react'
import type { CPMResult } from '@/lib/types'
import { FullscreenToggle, fullscreenClass, useFullscreen } from '@/components/common/Fullscreen'

export type GanttViewMode = 'day' | 'week' | 'month'

interface GanttChartProps {
  tasks: CPMResult[]
  totalDuration: number
  startDate?: string
  viewMode: GanttViewMode
}

// viewMode별 기본 px/day
const BASE_PX: Record<GanttViewMode, number> = { day: 28, week: 8, month: 3 }
const ZOOM_MIN = 0.3
const ZOOM_MAX = 5

const ROW_H = 40
const CAT_H = 44
const HDR_H = 44

const CATEGORY_COLORS: Record<string, string> = {
  '공사준비': '#64748b', '토목공사': '#d97706', '골조공사': '#3b82f6',
  '마감공사': '#10b981', '설비공사': '#06b6d4', '전기공사': '#8b5cf6',
  '외부공사': '#22c55e', '부대공사': '#ef4444',
}

// ── Column defs ───────────────────────────────────────────────────────
type ColKey = 'wbs' | 'name' | 'duration' | 'start' | 'end' | 'pred' | 'succ'
const COL_DEFAULTS: Record<ColKey, number> = { wbs: 72, name: 200, duration: 58, start: 82, end: 82, pred: 110, succ: 110 }
const COL_MIN: Record<ColKey, number>      = { wbs: 40, name: 100, duration: 44, start: 60, end: 60, pred: 60, succ: 60 }
const COL_LABELS: Record<ColKey, string>   = { wbs: 'WBS', name: '공종명', duration: '기간', start: '시작일', end: '완료일', pred: '선행', succ: '후행' }
const COL_KEYS: ColKey[] = ['wbs', 'name', 'duration', 'start', 'end', 'pred', 'succ']

// ── Helpers ───────────────────────────────────────────────────────────
function groupBy<T>(arr: T[], key: (x: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>()
  for (const item of arr) { const k = key(item); if (!map.has(k)) map.set(k, []); map.get(k)!.push(item) }
  return Array.from(map.entries())
}
function addDays(s: string, n: number): Date { const d = new Date(s); d.setDate(d.getDate() + n); return d }
function fmtShort(d: Date) { return `${d.getMonth() + 1}/${d.getDate()}` }
function fmtFull(d: Date)  { return d.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' }) }
function fmtMonth(d: Date) { return d.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short' }) }

// ── ColResizeHandle ───────────────────────────────────────────────────
function ColResizeHandle({ onDelta }: { onDelta: (dx: number) => void }) {
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    let last = e.clientX
    const move = (ev: MouseEvent) => { onDelta(ev.clientX - last); last = ev.clientX }
    const up   = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }
  return (
    <div onMouseDown={onMouseDown}
      className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize z-10 select-none group">
      <div className="w-px h-5 bg-border group-hover:bg-blue-400 group-hover:w-0.5 transition-all" />
    </div>
  )
}

// ── PanelSplitter ─────────────────────────────────────────────────────
function PanelSplitter({ onDelta }: { onDelta: (dx: number) => void }) {
  const [active, setActive] = useState(false)
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setActive(true)
    let last = e.clientX
    const move = (ev: MouseEvent) => { onDelta(ev.clientX - last); last = ev.clientX }
    const up   = () => { setActive(false); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }
  return (
    <div
      onMouseDown={onMouseDown}
      className={`flex-shrink-0 w-1.5 cursor-col-resize select-none flex items-center justify-center group transition-colors z-20 relative
        ${active ? 'bg-blue-500' : 'bg-border hover:bg-blue-400'}`}
      style={{ minHeight: '100%' }}
    >
      {/* grip dots */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute">
        {[0,1,2,3,4].map(i => <div key={i} className="w-1 h-1 rounded-full bg-white/80" />)}
      </div>
    </div>
  )
}

// ── ZoomBar ───────────────────────────────────────────────────────────
function ZoomBar({ zoom, onChange }: { zoom: number; onChange: (z: number) => void }) {
  return (
    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 bg-background/90 backdrop-blur border border-border rounded-lg px-3 py-1.5 shadow-md select-none">
      <button onClick={() => onChange(Math.max(ZOOM_MIN, zoom - 0.2))}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors text-sm font-bold">−</button>
      <div className="w-20 relative flex items-center">
        <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={0.05} value={zoom}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full h-1 accent-blue-500 cursor-pointer" />
      </div>
      <button onClick={() => onChange(Math.min(ZOOM_MAX, zoom + 0.2))}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors text-sm font-bold">+</button>
      <span className="text-[11px] text-muted-foreground w-9 text-right tabular-nums">{Math.round(zoom * 100)}%</span>
      <button onClick={() => onChange(1)} className="text-[10px] text-blue-500 hover:text-blue-600 font-medium ml-1">초기화</button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────
export function GanttChart({ tasks, totalDuration, startDate, viewMode }: GanttChartProps) {
  const [collapsed,   setCollapsed]   = useState<Set<string>>(new Set())
  const [colWidths,   setColWidths]   = useState<Record<ColKey, number>>({ ...COL_DEFAULTS })
  const [hoveredRow,  setHoveredRow]  = useState<string | null>(null)
  const [zoom,        setZoom]        = useState(1)
  const [leftW,       setLeftW]       = useState<number | null>(null)  // null = auto (sum of cols)
  const { fullscreen, toggle: toggleFullscreen } = useFullscreen()

  const leftRef   = useRef<HTMLDivElement>(null)
  const rightRef  = useRef<HTMLDivElement>(null)
  const syncing   = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const colSum    = COL_KEYS.reduce((s, k) => s + colWidths[k], 0)
  const panelW    = leftW ?? colSum
  const pxPerDay  = BASE_PX[viewMode] * zoom
  const totalWidth = Math.max(totalDuration * pxPerDay + 120, 600)

  // ── Col resize ──
  function resizeCol(col: ColKey, dx: number) {
    setColWidths(p => ({ ...p, [col]: Math.max(COL_MIN[col], p[col] + dx) }))
  }

  // ── Panel splitter ──
  function resizePanel(dx: number) {
    setLeftW(prev => {
      const cur = prev ?? colSum
      return Math.max(200, Math.min(900, cur + dx))
    })
  }

  // ── Scroll sync ──
  const onLeftScroll = useCallback(() => {
    if (syncing.current) return; syncing.current = true
    if (rightRef.current && leftRef.current) rightRef.current.scrollTop = leftRef.current.scrollTop
    requestAnimationFrame(() => { syncing.current = false })
  }, [])
  const onRightScroll = useCallback(() => {
    if (syncing.current) return; syncing.current = true
    if (leftRef.current && rightRef.current) leftRef.current.scrollTop = rightRef.current.scrollTop
    requestAnimationFrame(() => { syncing.current = false })
  }, [])

  // ── Ctrl+Wheel zoom ──
  useEffect(() => {
    const el = rightRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z - e.deltaY * 0.001)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Row list ──
  type Row = { kind: 'cat'; cat: string; tasks: CPMResult[] } | { kind: 'task'; task: CPMResult }
  const groups = groupBy(tasks, t => t.category)
  const rows: Row[] = []
  for (const [cat, catTasks] of groups) {
    rows.push({ kind: 'cat', cat, tasks: catTasks })
    if (!collapsed.has(cat)) for (const t of catTasks) rows.push({ kind: 'task', task: t })
  }
  const totalRowsH = rows.reduce((h, r) => h + (r.kind === 'cat' ? CAT_H : ROW_H), 0)

  // ── Today ──
  let todayX: number | null = null
  if (startDate) {
    const diff = Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000)
    if (diff >= 0 && diff <= totalDuration) todayX = diff * pxPerDay
  }

  // ── Header cells ──
  function buildCells() {
    const cells: { label: string; left: number; width: number }[] = []
    if (viewMode === 'day') {
      let d = 0
      while (d <= totalDuration) {
        cells.push({ label: startDate ? fmtFull(addDays(startDate, d)) : `Day ${d + 1}`, left: d * pxPerDay, width: 7 * pxPerDay })
        d += 7
      }
    } else if (viewMode === 'week') {
      for (let w = 0; w * 7 <= totalDuration; w++) {
        const off = w * 7
        cells.push({ label: startDate ? fmtMonth(addDays(startDate, off)) : `W${w + 1}`, left: off * pxPerDay, width: 7 * pxPerDay })
      }
    } else {
      for (let m = 0; m * 30 <= totalDuration; m++) {
        const off = m * 30
        cells.push({ label: startDate ? fmtMonth(addDays(startDate, off)) : `M${m + 1}`, left: off * pxPerDay, width: 30 * pxPerDay })
      }
    }
    return cells
  }
  const headerCells = buildCells()

  // ── Row tops ──
  const rowTops: number[] = []; let acc = 0
  for (const r of rows) { rowTops.push(acc); acc += r.kind === 'cat' ? CAT_H : ROW_H }

  return (
    <div className={fullscreen ? `${fullscreenClass(fullscreen, 'bg-white')} flex flex-col` : 'relative h-full'}>
      <div className="absolute top-2 right-2 z-30">
        <FullscreenToggle fullscreen={fullscreen} onToggle={toggleFullscreen} />
      </div>
    <div ref={containerRef} className={`flex border border-border rounded-xl overflow-hidden bg-background shadow-sm select-none ${fullscreen ? 'flex-1' : 'h-full'}`}>

      {/* ── LEFT PANEL ── */}
      <div className="flex flex-col flex-shrink-0" style={{ width: panelW }}>

        {/* Header */}
        <div className="flex-shrink-0 flex border-b border-r border-border bg-muted/40" style={{ height: HDR_H }}>
          {COL_KEYS.map(col => (
            <div key={col} className="relative flex items-center px-3" style={{ width: colWidths[col], flexShrink: 0 }}>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide truncate">{COL_LABELS[col]}</span>
              <ColResizeHandle onDelta={dx => resizeCol(col, dx)} />
            </div>
          ))}
        </div>

        {/* Rows */}
        <div ref={leftRef} className="flex-1 overflow-y-auto overflow-x-hidden border-r border-border" style={{ height: 0 }} onScroll={onLeftScroll}>
          {rows.map((row, i) => {
            if (row.kind === 'cat') {
              const color = CATEGORY_COLORS[row.cat] ?? '#6b7280'
              const isCol = collapsed.has(row.cat)
              const crit  = row.tasks.filter(t => t.isCritical).length
              return (
                <div key={`cl-${row.cat}`}
                  className="flex items-center border-b border-border cursor-pointer hover:bg-accent/60 transition-colors"
                  style={{ height: CAT_H, minWidth: panelW }}
                  onClick={() => setCollapsed(p => { const n = new Set(p); n.has(row.cat) ? n.delete(row.cat) : n.add(row.cat); return n })}>
                  <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
                    <span className="text-[10px] text-muted-foreground/60">{isCol ? '▶' : '▼'}</span>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-[12px] font-semibold text-foreground truncate">{row.cat}</span>
                    <span className="text-[11px] text-muted-foreground">({row.tasks.length})</span>
                    {crit > 0 && <span className="text-[11px] font-semibold text-orange-500 ml-1">● CP {crit}</span>}
                  </div>
                </div>
              )
            }
            const task    = row.task
            const isCrit  = task.isCritical
            const dur     = Math.round(task.duration)
            const sStr    = startDate ? fmtShort(addDays(startDate, task.ES)) : `D${task.ES}`
            const eStr    = startDate ? fmtShort(addDays(startDate, task.EF)) : `D${task.EF}`
            const predStr = task.predecessors?.join(', ') || '-'
            const succStr = task.successors?.join(', ')  || '-'
            const isHov   = hoveredRow === task.taskId
            return (
              <div key={`tl-${task.taskId}`}
                className="flex border-b border-border/50 transition-colors"
                style={{ height: ROW_H, minWidth: panelW, background: isHov ? (isCrit ? 'rgba(251,146,60,0.12)' : 'hsl(var(--accent)/0.6)') : (isCrit ? 'rgba(251,146,60,0.05)' : undefined) }}
                onMouseEnter={() => setHoveredRow(task.taskId)} onMouseLeave={() => setHoveredRow(null)}>
                {/* WBS */}
                <div className="flex items-center px-3 overflow-hidden flex-shrink-0" style={{ width: colWidths.wbs }}>
                  <span className="text-[10px] font-mono text-muted-foreground/50 truncate">{task.wbsCode ?? ''}</span>
                </div>
                {/* Name */}
                <div className="flex items-center px-3 overflow-hidden flex-shrink-0" style={{ width: colWidths.name }}>
                  <span className={`text-[12px] font-medium truncate ${isCrit ? 'text-orange-500' : 'text-foreground/85'}`}>{task.name}</span>
                </div>
                {/* Duration */}
                <div className="flex items-center justify-center px-2 overflow-hidden flex-shrink-0" style={{ width: colWidths.duration }}>
                  <span className={`text-[12px] font-semibold tabular-nums ${isCrit ? 'text-orange-500' : 'text-foreground/70'}`}>{dur}d</span>
                </div>
                {/* Start */}
                <div className="flex items-center px-3 overflow-hidden flex-shrink-0" style={{ width: colWidths.start }}>
                  <span className="text-[11px] tabular-nums text-foreground/55">{sStr}</span>
                </div>
                {/* End */}
                <div className="flex items-center px-3 overflow-hidden flex-shrink-0" style={{ width: colWidths.end }}>
                  <span className="text-[11px] tabular-nums text-foreground/55">{eStr}</span>
                </div>
                {/* Pred */}
                <div className="flex items-center px-3 overflow-hidden flex-shrink-0" style={{ width: colWidths.pred }} title={predStr}>
                  <span className="text-[11px] text-foreground/45 truncate">{predStr}</span>
                </div>
                {/* Succ */}
                <div className="flex items-center px-3 overflow-hidden flex-shrink-0" style={{ width: colWidths.succ }} title={succStr}>
                  <span className="text-[11px] text-foreground/45 truncate">{succStr}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── SPLITTER ── */}
      <PanelSplitter onDelta={resizePanel} />

      {/* ── RIGHT PANEL ── */}
      <div className="flex flex-col flex-1 overflow-hidden relative">

        {/* Timeline header */}
        <div className="flex-shrink-0 relative border-b border-border bg-muted/40 overflow-x-hidden" style={{ height: HDR_H }} id="gantt-header-scroll">
          <div className="relative h-full" style={{ width: totalWidth }}>
            {headerCells.map((c, i) => (
              <div key={i} className="absolute inset-y-0 border-r border-border/30 flex items-center px-3" style={{ left: c.left, width: c.width }}>
                <span className="text-[11px] text-muted-foreground font-medium truncate">{c.label}</span>
              </div>
            ))}
            {todayX !== null && <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" style={{ left: todayX }} />}
          </div>
        </div>

        {/* Bars */}
        <div ref={rightRef} className="flex-1 overflow-auto" style={{ height: 0 }}
          onScroll={e => {
            const hdr = document.getElementById('gantt-header-scroll')
            if (hdr) hdr.scrollLeft = (e.target as HTMLDivElement).scrollLeft
            onRightScroll()
          }}>
          <div className="relative" style={{ width: totalWidth, height: totalRowsH }}>
            {headerCells.map((c, i) => (
              <div key={i} className="absolute top-0 bottom-0 border-r border-border/15" style={{ left: c.left }} />
            ))}
            {todayX !== null && <div className="absolute top-0 bottom-0 w-0.5 bg-red-400/50 z-10" style={{ left: todayX }} />}

            {rows.map((row, i) => {
              const top = rowTops[i]; const height = row.kind === 'cat' ? CAT_H : ROW_H
              if (row.kind === 'cat') {
                return <div key={`cr-${row.cat}`} className="absolute left-0 right-0 border-b border-border bg-muted/15" style={{ top, height }} />
              }
              const task  = row.task
              const dur   = Math.round(task.duration)
              const barL  = task.ES * pxPerDay
              const barW  = Math.max(dur * pxPerDay, 8)
              const color = CATEGORY_COLORS[task.category] ?? '#3b82f6'
              const bg    = task.isCritical ? '#f97316' : color
              const isHov = hoveredRow === task.taskId
              return (
                <div key={`br-${task.taskId}`}
                  className="absolute left-0 right-0 border-b border-border/30 flex items-center transition-colors"
                  style={{ top, height, background: isHov ? (task.isCritical ? 'rgba(251,146,60,0.12)' : 'hsl(var(--accent)/0.6)') : (task.isCritical ? 'rgba(251,146,60,0.05)' : undefined) }}
                  onMouseEnter={() => setHoveredRow(task.taskId)} onMouseLeave={() => setHoveredRow(null)}>
                  {task.TF > 0 && (
                    <div className="absolute rounded-full opacity-15"
                      style={{ left: barL, width: (dur + task.TF) * pxPerDay, height: 8, background: bg, top: '50%', transform: 'translateY(-50%)' }} />
                  )}
                  <div className="absolute rounded-md flex items-center overflow-hidden shadow-sm transition-all"
                    style={{ left: barL, width: barW, height: 24, background: bg, top: '50%', transform: 'translateY(-50%)' }}
                    title={`${task.name}\n${dur}일${startDate ? `\n${fmtFull(addDays(startDate, task.ES))} → ${fmtFull(addDays(startDate, task.EF))}` : ''}\nTF: ${task.TF}일`}>
                    {barW > 36 && <span className="px-2 text-white text-[10px] font-semibold truncate drop-shadow-sm">{dur}d</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Zoom bar */}
        <ZoomBar zoom={zoom} onChange={setZoom} />
      </div>
    </div>
    </div>
  )
}
