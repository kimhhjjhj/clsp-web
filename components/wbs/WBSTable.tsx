'use client'

import { useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { getWorkRate } from '@/lib/engine/wbs'
import type { CPMResult } from '@/lib/types'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  byCategory: Record<string, CPMResult[]>
  fmtProductivity: (task: CPMResult) => string
  categoryColors: Record<string, string>
}

export interface WBSTableHandle {
  expandAll: () => void
  collapseAll: () => void
}

const DEFAULT_WIDTHS = [260, 80, 64, 150, 64, 88, 64, 48]

const HEADERS: { label: string; align: 'left' | 'center' | 'right'; color?: string }[] = [
  { label: '공종명',        align: 'left'   },
  { label: '물량',          align: 'right'  },
  { label: '단위',          align: 'center' },
  { label: '생산성',        align: 'left'   },
  { label: 'W.D',           align: 'right',  color: '#2563eb' },
  { label: '공종별 가동률', align: 'center' },
  { label: 'C.D',           align: 'right'  },
  { label: 'CP',            align: 'center' },
]

const WBSTable = forwardRef<WBSTableHandle, Props>(function WBSTable({ byCategory, fmtProductivity, categoryColors }, ref) {
  const [colWidths, setColWidths] = useState(DEFAULT_WIDTHS)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(Object.keys(byCategory)))
  const resizing = useRef<{ col: number; startX: number; startW: number } | null>(null)

  useImperativeHandle(ref, () => ({
    expandAll:   () => setExpanded(new Set(Object.keys(byCategory))),
    collapseAll: () => setExpanded(new Set()),
  }))

  const toggleCat = (cat: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })

  const onResizeStart = useCallback((col: number, e: React.MouseEvent) => {
    e.preventDefault()
    resizing.current = { col, startX: e.clientX, startW: colWidths[col] }
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const { col, startX, startW } = resizing.current
      const newW = Math.max(40, startW + ev.clientX - startX)
      setColWidths(prev => { const next = [...prev]; next[col] = newW; return next })
    }
    const onUp = () => {
      resizing.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [colWidths])

  const totalW = colWidths.reduce((a, b) => a + b, 0)

  return (
    <div className="overflow-auto w-full">
      <table style={{ width: totalW, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 13 }}>
        <colgroup>
          {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>

        {/* ── 헤더 ── */}
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {HEADERS.map((h, i) => (
              <th
                key={i}
                style={{
                  position: 'relative',
                  padding: '8px 10px',
                  textAlign: h.align,
                  fontSize: 11,
                  fontWeight: 600,
                  color: h.color ?? '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {h.label}
                {/* 리사이즈 핸들 */}
                <span
                  onMouseDown={e => onResizeStart(i, e)}
                  style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0,
                    width: 5, cursor: 'col-resize',
                    background: 'transparent',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#cbd5e1')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                />
              </th>
            ))}
          </tr>
        </thead>

        {/* ── 바디 ── */}
        <tbody>
          {Object.entries(byCategory).map(([cat, tasks]) => {
            const isExp = expanded.has(cat)
            const critCount = tasks.filter(t => t.isCritical).length
            const dotColor = categoryColors[cat] ?? '#94a3b8'

            return (
              <>
                {/* 카테고리 헤더 행 */}
                <tr
                  key={`cat-${cat}`}
                  onClick={() => toggleCat(cat)}
                  style={{
                    background: '#f1f5f9',
                    borderTop: '1px solid #e2e8f0',
                    borderBottom: '1px solid #e2e8f0',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#e8edf5')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#f1f5f9')}
                >
                  <td colSpan={8} style={{ padding: '7px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isExp
                        ? <ChevronUp size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                        : <ChevronDown size={13} style={{ color: '#64748b', flexShrink: 0 }} />}
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{cat}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>({tasks.length}개)</span>
                      {critCount > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: '#fff',
                          background: '#f97316', borderRadius: 4, padding: '1px 6px',
                        }}>CP {critCount}</span>
                      )}
                    </div>
                  </td>
                </tr>

                {/* 태스크 행 */}
                {isExp && tasks.map(task => {
                  const wr = getWorkRate(task.category)
                  const wrLabel = wr === null ? '—' : `${(wr * 100).toFixed(1)}%`
                  const isCp = task.isCritical
                  return (
                    <tr
                      key={task.taskId}
                      style={{
                        background: isCp ? 'rgba(249,115,22,0.04)' : '#fff',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = isCp ? 'rgba(249,115,22,0.08)' : '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = isCp ? 'rgba(249,115,22,0.04)' : '#fff')}
                    >
                      {/* 공종명 */}
                      <td style={{ padding: '6px 10px 6px 28px', overflow: 'hidden' }}>
                        <div style={{ color: isCp ? '#ea580c' : '#1e293b', fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {task.name}
                        </div>
                        {task.wbsCode && (
                          <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{task.wbsCode}</div>
                        )}
                      </td>

                      {/* 물량 */}
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>
                        {task.quantity != null ? task.quantity.toLocaleString() : '—'}
                      </td>

                      {/* 단위 */}
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: 12, color: '#64748b' }}>
                        {task.unit ?? '—'}
                      </td>

                      {/* 생산성 */}
                      <td style={{ padding: '6px 10px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {fmtProductivity(task)}
                      </td>

                      {/* W.D */}
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, fontSize: 14, color: '#2563eb' }}>
                        {Math.round(task.duration)}
                      </td>

                      {/* 공종별 가동률 */}
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>
                        {wrLabel}
                      </td>

                      {/* C.D */}
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: '#475569' }}>
                        {Math.round(task.duration * 7 / 5)}
                      </td>

                      {/* CP */}
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        {isCp && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: '#fff',
                            background: '#f97316', borderRadius: 3, padding: '1px 5px',
                          }}>CP</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})

export default WBSTable
