'use client'

import React, { useRef, useCallback, useState, useEffect } from 'react'
import type { CPMResult } from '@/lib/types'

export type GanttViewMode = 'day' | 'week' | 'month'

interface GanttChartProps {
  tasks: CPMResult[]
  totalDuration: number
  startDate?: string
  viewMode: GanttViewMode
}

const PX_PER_DAY: Record<GanttViewMode, number> = { day: 28, week: 8, month: 3 }
const ROW_H = 40
const CAT_H = 44
const HDR_H = 44

const CATEGORY_COLORS: Record<string, string> = {
  '공사준비': '#64748b',
  '토목공사': '#d97706',
  '골조공사': '#3b82f6',
  '마감공사': '#10b981',
  '설비공사': '#06b6d4',
  '전기공사': '#8b5cf6',
  '외부공사': '#22c55e',
  '부대공사': '#ef4444',
}

// ── Column definitions ────────────────────────────────────────────────
type ColKey = 'wbs' | 'name' | 'duration' | 'start' | 'end' | 'pred' | 'succ'
const COL_DEFAULTS: Record<ColKey, number> = {
  wbs: 72, name: 200, duration: 58, start: 82, end: 82, pred: 110, succ: 110,
}
const COL_MIN: Record<ColKey, number> = {
  wbs: 40, name: 100, duration: 44, start: 60, end: 60, pred: 60, succ: 60,
}
const COL_LABELS: Record<ColKey, string> = {
  wbs: 'WBS', name: '공종명', duration: '기간', start: '시작일', end: '완료일', pred: '선행', succ: '후행',
}
const COL_KEYS: ColKey[] = ['wbs', 'name', 'duration', 'start', 'end', 'pred', 'succ']

// ── Helpers ───────────────────────────────────────────────────────────
function groupBy<T>(arr: T[], key: (x: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>()
  for (const item of arr) {
    const k = key(item)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(item)
  }
  return Array.from(map.entries())
}

function addDays(dateStr: string, days: number): Date {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d
}

function fmtShort(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function fmtFull(d: Date): string {
  return d.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' })
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short' })
}

// ── ResizeHandle ──────────────────────────────────────────────────────
function ResizeHandle({ onResize }: { onResize: (dx: number) => void }) {
  const startX = useRef(0)
  const dragging = useRef(false)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      onResize(ev.clientX - startX.current)
      startX.current = ev.clientX
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize group z-10 select-none"
    >
      <div className="w-px h-5 bg-border group-hover:bg-blue-400 group-hover:w-0.5 transition-all" />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────
export function GanttChart({ tasks, totalDuration, startDate, viewMode }: GanttChartProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>({ ...COL_DEFAULTS })
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  const leftRef  = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const syncing  = useRef(false)

  const pxPerDay   = PX_PER_DAY[viewMode]
  const totalWidth = Math.max(totalDuration * pxPerDay + 120, 800)
  const leftTotalW = COL_KEYS.reduce((s, k) => s + colWidths[k], 0)

  function resizeCol(col: ColKey, dx: number) {
    setColWidths(prev => ({
      ...prev,
      [col]: Math.max(COL_MIN[col], prev[col] + dx),
    }))
  }

  // ── Sync scroll ──
  const onLeftScroll = useCallback(() => {
    if (syncing.current) return
    syncing.current = true
    if (rightRef.current && leftRef.current)
      rightRef.current.scrollTop = leftRef.current.scrollTop
    requestAnimationFrame(() => { syncing.current = false })
  }, [])

  const onRightScroll = useCallback(() => {
    if (syncing.current) return
    syncing.current = true
    if (leftRef.current && rightRef.current)
      leftRef.current.scrollTop = rightRef.current.scrollTop
    requestAnimationFrame(() => { syncing.current = false })
  }, [])

  // ── Rows ──
  type CatRow  = { kind: 'cat';  cat: string; tasks: CPMResult[] }
  type TaskRow = { kind: 'task'; task: CPMResult }
  type Row = CatRow | TaskRow

  const groups = groupBy(tasks, t => t.category)
  const rows: Row[] = []
  for (const [cat, catTasks] of groups) {
    rows.push({ kind: 'cat', cat, tasks: catTasks })
    if (!collapsed.has(cat)) {
      for (const t of catTasks) rows.push({ kind: 'task', task: t })
    }
  }

  const totalRowsHeight = rows.reduce((h, r) => h + (r.kind === 'cat' ? CAT_H : ROW_H), 0)

  // ── Today line ──
  let todayX: number | null = null
  if (startDate) {
    const diff = Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000)
    if (diff >= 0 && diff <= totalDuration) todayX = diff * pxPerDay
  }

  // ── Header cells ──
  type HeaderCell = { label: string; left: number; width: number }

  function buildHeaderCells(): HeaderCell[] {
    const cells: HeaderCell[] = []
    if (viewMode === 'day') {
      let d = 0
      while (d <= totalDuration) {
        cells.push({
          label: startDate ? fmtFull(addDays(startDate, d)) : `Day ${d + 1}`,
          left: d * pxPerDay, width: 7 * pxPerDay,
        })
        d += 7
      }
    } else if (viewMode === 'week') {
      const totalWeeks = Math.ceil(totalDuration / 7)
      for (let w = 0; w < totalWeeks; w++) {
        const off = w * 7
        cells.push({
          label: startDate ? fmtMonth(addDays(startDate, off)) : `W${w + 1}`,
          left: off * pxPerDay, width: 7 * pxPerDay,
        })
      }
    } else {
      const totalMonths = Math.ceil(totalDuration / 30)
      for (let m = 0; m < totalMonths; m++) {
        const off = m * 30
        cells.push({
          label: startDate ? fmtMonth(addDays(startDate, off)) : `M${m + 1}`,
          left: off * pxPerDay, width: 30 * pxPerDay,
        })
      }
    }
    return cells
  }

  const headerCells = buildHeaderCells()

  // ── Row tops ──
  const rowTops: number[] = []
  let acc = 0
  for (const r of rows) { rowTops.push(acc); acc += r.kind === 'cat' ? CAT_H : ROW_H }

  // ── Cell render helper ──
  function Cell({ col, children, align = 'left', muted = false, mono = false, critical = false }:
    { col: ColKey; children: React.ReactNode; align?: 'left'|'right'|'center'; muted?: boolean; mono?: boolean; critical?: boolean }) {
    return (
      <div
        className={[
          'flex items-center overflow-hidden px-3',
          align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : '',
          muted ? 'text-muted-foreground' : '',
          mono ? 'font-mono' : '',
          critical ? 'text-orange-500' : '',
        ].filter(Boolean).join(' ')}
        style={{ width: colWidths[col], flexShrink: 0 }}
      >
        {children}
      </div>
    )
  }

  return (
    <div className="flex h-full border border-border rounded-xl overflow-hidden bg-background shadow-sm">

      {/* ── LEFT PANEL ───────────────────────────── */}
      <div className="flex flex-col flex-shrink-0 border-r border-border" style={{ width: leftTotalW }}>

        {/* Header */}
        <div
          className="flex-shrink-0 flex border-b border-border bg-muted/40"
          style={{ height: HDR_H }}
        >
          {COL_KEYS.map(col => (
            <div
              key={col}
              className="relative flex items-center px-3 select-none"
              style={{ width: colWidths[col], flexShrink: 0 }}
            >
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
                {COL_LABELS[col]}
              </span>
              <ResizeHandle onResize={dx => resizeCol(col, dx)} />
            </div>
          ))}
        </div>

        {/* Rows */}
        <div
          ref={leftRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          onScroll={onLeftScroll}
          style={{ height: 0 }}
        >
          {rows.map((row, i) => {
            if (row.kind === 'cat') {
              const color = CATEGORY_COLORS[row.cat] ?? '#6b7280'
              const isCol = collapsed.has(row.cat)
              const crit  = row.tasks.filter(t => t.isCritical).length
              return (
                <div
                  key={`cl-${row.cat}`}
                  className="flex items-center border-b border-border cursor-pointer select-none hover:bg-accent/60 transition-colors"
                  style={{ height: CAT_H, minWidth: leftTotalW }}
                  onClick={() => setCollapsed(prev => {
                    const next = new Set(prev); next.has(row.cat) ? next.delete(row.cat) : next.add(row.cat); return next
                  })}
                >
                  <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
                    <span className="text-[10px] text-muted-foreground/60">{isCol ? '▶' : '▼'}</span>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-[12px] font-semibold text-foreground truncate">{row.cat}</span>
                    <span className="text-[11px] text-muted-foreground ml-1">({row.tasks.length})</span>
                    {crit > 0 && <span className="text-[11px] font-semibold text-orange-500 ml-1">● CP {crit}</span>}
                  </div>
                </div>
              )
            }

            const task     = row.task
            const isCrit   = task.isCritical
            const dur      = Math.round(task.duration)
            const startStr = startDate ? fmtShort(addDays(startDate, task.ES)) : `D${task.ES}`
            const endStr   = startDate ? fmtShort(addDays(startDate, task.EF)) : `D${task.EF}`
            const predStr  = task.predecessors?.join(', ') || '-'
            const succStr  = task.successors?.join(', ') || '-'
            const isHover  = hoveredRow === task.taskId

            return (
              <div
                key={`tl-${task.taskId}`}
                className="flex border-b border-border/50 transition-colors cursor-default"
                style={{
                  height: ROW_H,
                  minWidth: leftTotalW,
                  background: isHover
                    ? isCrit ? 'rgba(251,146,60,0.12)' : 'hsl(var(--accent)/0.6)'
                    : isCrit ? 'rgba(251,146,60,0.05)' : undefined,
                }}
                onMouseEnter={() => setHoveredRow(task.taskId)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <Cell col="wbs" mono muted>
                  <span className="text-[10px] opacity-60 truncate">{task.wbsCode ?? ''}</span>
                </Cell>
                <Cell col="name" critical={isCrit}>
                  <span className={`text-[12px] truncate font-medium ${isCrit ? 'text-orange-500' : 'text-foreground/85'}`}>
                    {task.name}
                  </span>
                </Cell>
                <Cell col="duration" align="center">
                  <span className={`text-[12px] font-semibold tabular-nums ${isCrit ? 'text-orange-500' : 'text-foreground/70'}`}>
                    {dur}d
                  </span>
                </Cell>
                <Cell col="start" muted>
                  <span className="text-[11px] tabular-nums text-foreground/60">{startStr}</span>
                </Cell>
                <Cell col="end" muted>
                  <span className="text-[11px] tabular-nums text-foreground/60">{endStr}</span>
                </Cell>
                <Cell col="pred" muted>
                  <span className="text-[11px] text-foreground/50 truncate" title={predStr}>{predStr}</span>
                </Cell>
                <Cell col="succ" muted>
                  <span className="text-[11px] text-foreground/50 truncate" title={succStr}>{succStr}</span>
                </Cell>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL ──────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Timeline header */}
        <div
          className="flex-shrink-0 relative border-b border-border bg-muted/40 overflow-x-hidden"
          style={{ height: HDR_H }}
          id="gantt-header-scroll"
        >
          <div className="relative h-full" style={{ width: totalWidth }}>
            {headerCells.map((cell, i) => (
              <div
                key={i}
                className="absolute inset-y-0 border-r border-border/30 flex items-center px-3"
                style={{ left: cell.left, width: cell.width }}
              >
                <span className="text-[11px] text-muted-foreground font-medium truncate">{cell.label}</span>
              </div>
            ))}
            {todayX !== null && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" style={{ left: todayX }} />
            )}
          </div>
        </div>

        {/* Bars */}
        <div
          ref={rightRef}
          className="flex-1 overflow-auto"
          style={{ height: 0 }}
          onScroll={e => {
            const hdr = document.getElementById('gantt-header-scroll')
            if (hdr) hdr.scrollLeft = (e.target as HTMLDivElement).scrollLeft
            onRightScroll()
          }}
        >
          <div className="relative" style={{ width: totalWidth, height: totalRowsHeight }}>

            {/* Grid lines */}
            {headerCells.map((cell, i) => (
              <div key={i} className="absolute top-0 bottom-0 border-r border-border/15" style={{ left: cell.left }} />
            ))}

            {/* Today */}
            {todayX !== null && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-400/50 z-10" style={{ left: todayX }} />
            )}

            {rows.map((row, i) => {
              const top    = rowTops[i]
              const height = row.kind === 'cat' ? CAT_H : ROW_H

              if (row.kind === 'cat') {
                return (
                  <div
                    key={`cr-${row.cat}`}
                    className="absolute left-0 right-0 border-b border-border bg-muted/15"
                    style={{ top, height }}
                  />
                )
              }

              const task   = row.task
              const dur    = Math.round(task.duration)
              const barL   = task.ES * pxPerDay
              const barW   = Math.max(dur * pxPerDay, 8)
              const color  = CATEGORY_COLORS[task.category] ?? '#3b82f6'
              const bg     = task.isCritical ? '#f97316' : color
              const isHov  = hoveredRow === task.taskId

              return (
                <div
                  key={`br-${task.taskId}`}
                  className="absolute left-0 right-0 border-b border-border/30 flex items-center"
                  style={{
                    top, height,
                    background: isHov
                      ? task.isCritical ? 'rgba(251,146,60,0.12)' : 'hsl(var(--accent)/0.6)'
                      : task.isCritical ? 'rgba(251,146,60,0.05)' : undefined,
                  }}
                  onMouseEnter={() => setHoveredRow(task.taskId)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {/* Float bar */}
                  {task.TF > 0 && (
                    <div
                      className="absolute rounded-full opacity-15"
                      style={{
                        left: barL, width: (dur + task.TF) * pxPerDay,
                        height: 8, background: bg, top: '50%', transform: 'translateY(-50%)',
                      }}
                    />
                  )}
                  {/* Main bar */}
                  <div
                    className="absolute rounded-md flex items-center overflow-hidden shadow-sm"
                    style={{
                      left: barL, width: barW, height: 24,
                      background: bg, top: '50%', transform: 'translateY(-50%)',
                    }}
                    title={`${task.name}\n${dur}일${startDate ? `\n${fmtFull(addDays(startDate, task.ES))} → ${fmtFull(addDays(startDate, task.EF))}` : ''}\nTF: ${task.TF}일`}
                  >
                    {barW > 36 && (
                      <span className="px-2 text-white text-[10px] font-semibold truncate drop-shadow-sm">
                        {dur}d
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
