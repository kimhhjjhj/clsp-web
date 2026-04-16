'use client'

import React, { useRef, useCallback, useState } from 'react'
import type { CPMResult } from '@/lib/types'

// ── Types ──────────────────────────────────────────────────────────────
export type GanttViewMode = 'day' | 'week' | 'month'

interface GanttChartProps {
  tasks: CPMResult[]
  totalDuration: number
  startDate?: string          // YYYY-MM-DD, optional
  viewMode: GanttViewMode
}

// ── Constants ──────────────────────────────────────────────────────────
const PX_PER_DAY: Record<GanttViewMode, number> = { day: 28, week: 8, month: 3 }
const ROW_H = 36   // px — task row height
const CAT_H = 40   // px — category header row height
const HDR_H = 52   // px — timeline header height

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

// ── Helpers ────────────────────────────────────────────────────────────
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

function fmtDate(d: Date): string {
  return d.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' })
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short' })
}

// ── Main Component ─────────────────────────────────────────────────────
export function GanttChart({ tasks, totalDuration, startDate, viewMode }: GanttChartProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const leftRef  = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const syncing  = useRef(false)

  const pxPerDay   = PX_PER_DAY[viewMode]
  const totalWidth = Math.max(totalDuration * pxPerDay + 120, 800)

  // ── Sync vertical scroll ──
  const onLeftScroll  = useCallback(() => {
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

  // ── Row list ──
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
    const diffDays = Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000)
    if (diffDays >= 0 && diffDays <= totalDuration) todayX = diffDays * pxPerDay
  }

  // ── Timeline header cells ──
  type HeaderCell = { label: string; subLabel?: string; left: number; width: number }

  function buildHeaderCells(): HeaderCell[] {
    const cells: HeaderCell[] = []
    if (viewMode === 'day') {
      // Top: month groups, Bottom: individual days (every 7)
      let d = 0
      while (d <= totalDuration) {
        const label = startDate
          ? fmtDate(addDays(startDate, d))
          : `Day ${d + 1}`
        cells.push({ label, left: d * pxPerDay, width: 7 * pxPerDay })
        d += 7
      }
    } else if (viewMode === 'week') {
      // weeks
      const totalWeeks = Math.ceil(totalDuration / 7)
      for (let w = 0; w < totalWeeks; w++) {
        const dayOffset = w * 7
        const label = startDate
          ? fmtMonth(addDays(startDate, dayOffset))
          : `W${w + 1}`
        cells.push({ label, left: dayOffset * pxPerDay, width: 7 * pxPerDay })
      }
    } else {
      // months
      const totalMonths = Math.ceil(totalDuration / 30)
      for (let m = 0; m < totalMonths; m++) {
        const dayOffset = m * 30
        const label = startDate
          ? fmtMonth(addDays(startDate, dayOffset))
          : `M${m + 1}`
        cells.push({ label, left: dayOffset * pxPerDay, width: 30 * pxPerDay })
      }
    }
    return cells
  }

  const headerCells = buildHeaderCells()

  // ── Tooltip label ──
  function barLabel(task: CPMResult): string {
    if (startDate) {
      const s = fmtDate(addDays(startDate, task.ES))
      const e = fmtDate(addDays(startDate, task.EF))
      return `${task.name}\n${task.duration}일  (${s} → ${e})\nTF: ${task.TF}일`
    }
    return `${task.name}\n${task.duration}일  (D${task.ES}→D${task.EF})\nTF: ${task.TF}일`
  }

  // ── Row top-offset lookup ──
  const rowTops: number[] = []
  let acc = 0
  for (const r of rows) {
    rowTops.push(acc)
    acc += r.kind === 'cat' ? CAT_H : ROW_H
  }

  return (
    <div className="flex h-full border border-border rounded-lg overflow-hidden bg-background">

      {/* ── LEFT PANEL ─────────────────────────────── */}
      <div className="flex flex-col w-[460px] flex-shrink-0 border-r border-border">

        {/* Header */}
        <div
          className="flex-shrink-0 grid border-b border-border bg-muted/50"
          style={{ height: HDR_H, gridTemplateColumns: '56px 1fr 60px' }}
        >
          <div className="flex items-end pb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">WBS</div>
          <div className="flex items-end pb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">공종명</div>
          <div className="flex items-end pb-2 px-2 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">기간</div>
        </div>

        {/* Rows */}
        <div
          ref={leftRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          onScroll={onLeftScroll}
          style={{ height: 0 }}  /* flex child needs explicit height 0 to scroll */
        >
          {rows.map((row, i) => {
            if (row.kind === 'cat') {
              const color = CATEGORY_COLORS[row.cat] ?? '#6b7280'
              const crit  = row.tasks.filter(t => t.isCritical).length
              const isCol = collapsed.has(row.cat)
              return (
                <div
                  key={`cl-${row.cat}`}
                  className="flex items-center gap-2 px-3 border-b border-border cursor-pointer select-none hover:bg-muted/40 transition-colors"
                  style={{ height: CAT_H }}
                  onClick={() => setCollapsed(prev => {
                    const next = new Set(prev)
                    next.has(row.cat) ? next.delete(row.cat) : next.add(row.cat)
                    return next
                  })}
                >
                  <span className="text-[10px] text-muted-foreground w-3">{isCol ? '▶' : '▼'}</span>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-xs font-semibold flex-1 truncate">{row.cat}</span>
                  <span className="text-[10px] text-muted-foreground">({row.tasks.length})</span>
                  {crit > 0 && (
                    <span className="text-[10px] font-medium text-orange-400 ml-1">CP {crit}</span>
                  )}
                </div>
              )
            }

            // task row
            const task = row.task
            const isCrit = task.isCritical
            return (
              <div
                key={`tl-${task.taskId}`}
                className="grid border-b border-border/60"
                style={{
                  height: ROW_H,
                  gridTemplateColumns: '56px 1fr 60px',
                  background: isCrit ? 'rgba(251,146,60,0.06)' : undefined,
                }}
              >
                <div className="flex items-center px-3 font-mono text-[9px] text-muted-foreground/50 truncate">
                  {task.wbsCode ?? ''}
                </div>
                <div className={`flex items-center px-2 pl-5 text-[11px] truncate ${isCrit ? 'text-orange-400' : 'text-foreground/80'}`}>
                  {task.name}
                </div>
                <div className={`flex items-center justify-end px-2 font-mono text-[11px] ${isCrit ? 'text-orange-400' : 'text-muted-foreground'}`}>
                  {task.duration}d
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Timeline header (sticky top) */}
        <div
          className="flex-shrink-0 relative border-b border-border bg-muted/50 overflow-x-hidden"
          style={{ height: HDR_H, minWidth: 0 }}
          id="gantt-header-scroll"
        >
          {/* inner div has full timeline width */}
          <div className="relative h-full" style={{ width: totalWidth }}>
            {headerCells.map((cell, i) => (
              <div
                key={i}
                className="absolute inset-y-0 border-r border-border/40 flex items-end pb-2 px-2"
                style={{ left: cell.left, width: cell.width }}
              >
                <span className="text-[10px] text-muted-foreground font-mono truncate">{cell.label}</span>
              </div>
            ))}
            {todayX !== null && (
              <div className="absolute top-0 bottom-0 w-px bg-red-500 z-10" style={{ left: todayX }} />
            )}
          </div>
        </div>

        {/* Bars scroll area */}
        <div
          ref={rightRef}
          className="flex-1 overflow-auto"
          style={{ height: 0 }}
          onScroll={(e) => {
            // sync header horizontal scroll
            const hdr = document.getElementById('gantt-header-scroll')
            if (hdr) hdr.scrollLeft = (e.target as HTMLDivElement).scrollLeft
            onRightScroll()
          }}
        >
          <div className="relative" style={{ width: totalWidth, height: totalRowsHeight }}>

            {/* Vertical grid lines */}
            {headerCells.map((cell, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-r border-border/20"
                style={{ left: cell.left }}
              />
            ))}

            {/* Today line */}
            {todayX !== null && (
              <div
                className="absolute top-0 bottom-0 w-px bg-red-500/40 z-10"
                style={{ left: todayX }}
              />
            )}

            {/* Rows + bars */}
            {rows.map((row, i) => {
              const top    = rowTops[i]
              const height = row.kind === 'cat' ? CAT_H : ROW_H

              if (row.kind === 'cat') {
                const color = CATEGORY_COLORS[row.cat] ?? '#6b7280'
                return (
                  <div
                    key={`cr-${row.cat}`}
                    className="absolute left-0 right-0 border-b border-border bg-muted/20"
                    style={{ top, height }}
                  />
                )
              }

              const task  = row.task
              const barL  = task.ES * pxPerDay
              const barW  = Math.max(task.duration * pxPerDay, 6)
              const color = CATEGORY_COLORS[task.category] ?? '#3b82f6'
              const bg    = task.isCritical ? '#f97316' : color
              const isCrit = task.isCritical

              return (
                <div
                  key={`br-${task.taskId}`}
                  className="absolute left-0 right-0 border-b border-border/40 flex items-center"
                  style={{ top, height, background: isCrit ? 'rgba(251,146,60,0.05)' : undefined }}
                >
                  {/* Float (slack) bar — light background from ES to LS */}
                  {task.TF > 0 && (
                    <div
                      className="absolute h-1.5 rounded opacity-20"
                      style={{
                        left: barL,
                        width: (task.duration + task.TF) * pxPerDay,
                        background: bg,
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                    />
                  )}
                  {/* Main bar */}
                  <div
                    className="absolute rounded flex items-center overflow-hidden cursor-pointer group"
                    style={{
                      left: barL,
                      width: barW,
                      height: 22,
                      background: bg,
                      top: '50%',
                      transform: 'translateY(-50%)',
                    }}
                    title={barLabel(task)}
                  >
                    {barW > 32 && (
                      <span className="px-2 text-white text-[9px] font-medium truncate">
                        {task.duration}d
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
