'use client'

import { Fragment, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { getWorkRate, explainDuration, type ProductivitySource } from '@/lib/engine/wbs'
import { buildAbnormalIndex } from '@/lib/engine/abnormal-detection'
import { WBS_TRADE_MAP } from '@/lib/engine/wbs-trade-map'
import type { CPMResult } from '@/lib/types'
import { ChevronDown, ChevronUp, Info, AlertTriangle } from 'lucide-react'
import { FullscreenToggle, fullscreenClass, useFullscreen } from '@/components/common/Fullscreen'

export interface CompanyStandardSummary {
  trade: string
  unit: string
  value: number
  approved: boolean
  sampleCount?: number
}

interface Props {
  byCategory: Record<string, CPMResult[]>
  fmtProductivity: (task: CPMResult) => string
  categoryColors: Record<string, string>
  standards?: CompanyStandardSummary[]
}

export interface WBSTableHandle {
  expandAll: () => void
  collapseAll: () => void
}

const DEFAULT_WIDTHS = [260, 80, 64, 130, 64, 78, 64, 210, 48]

const HEADERS: { label: string; align: 'left' | 'center' | 'right'; color?: string }[] = [
  { label: '공종명',        align: 'left'   },
  { label: '물량',          align: 'right'  },
  { label: '단위',          align: 'center' },
  { label: '생산성',        align: 'left'   },
  { label: 'W.D',           align: 'right',  color: '#2563eb' },
  { label: '가동률',        align: 'center' },
  { label: 'C.D',           align: 'right'  },
  { label: '회사 실적',     align: 'left',   color: '#7c3aed' },
  { label: 'CP',            align: 'center' },
]

const WBSTable = forwardRef<WBSTableHandle, Props>(function WBSTable({ byCategory, fmtProductivity, categoryColors, standards }, ref) {
  const [colWidths, setColWidths] = useState(DEFAULT_WIDTHS)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(Object.keys(byCategory)))
  const resizing = useRef<{ col: number; startX: number; startW: number } | null>(null)
  const { fullscreen, toggle: toggleFullscreen } = useFullscreen()

  // trade → { value, approved, sampleCount } lookup (man/day만)
  const stdLookup = new Map<string, CompanyStandardSummary>()
  for (const s of standards ?? []) {
    if (s.unit === 'man/day') stdLookup.set(s.trade, s)
  }

  // 비정상 공종 탐지 — 카테고리 평균 대비 과도 or 전체 공기 지배
  const allTasks = Object.values(byCategory).flat()
  const totalDuration = Math.max(0, ...allTasks.map(t => t.EF))
  const abnormalIndex = buildAbnormalIndex(
    allTasks.map(t => ({ name: t.name, category: t.category, duration: t.duration })),
    totalDuration,
  )

  function companyActual(taskName: string): { avg: number; approved: boolean; trades: string[]; totalSamples: number } | null {
    const trades = WBS_TRADE_MAP[taskName] ?? []
    if (trades.length === 0) return null
    const found: CompanyStandardSummary[] = []
    for (const tr of trades) {
      const hit = stdLookup.get(tr)
      if (hit) found.push(hit)
    }
    if (found.length === 0) return null
    // 샘플 수 기반 가중 평균 (sample 많은 trade가 더 신뢰도 높음)
    const totalW = found.reduce((s, x) => s + (x.sampleCount ?? 1), 0)
    const weighted = found.reduce((s, x) => s + x.value * (x.sampleCount ?? 1), 0)
    const avg = Math.round((weighted / totalW) * 10) / 10
    const approved = found.every(x => x.approved)
    return { avg, approved, trades: found.map(f => f.trade), totalSamples: totalW }
  }

  // 공종의 생산성 출처 결정 (explainDuration의 source 인자용)
  // - 회사 표준 매칭되고 전부 approved → 'approved'
  // - 매칭은 되는데 일부 또는 전부 미승인 → 'proposal'
  // - 매칭 안 됨 → 'default' (CP_DB 기본값)
  function productivitySource(taskName: string): ProductivitySource {
    const ca = companyActual(taskName)
    if (!ca) return { type: 'default' }
    return {
      type: ca.approved ? 'approved' : 'proposal',
      sampleCount: ca.totalSamples,
      mappedTrades: ca.trades,
    }
  }

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
    <div className={`relative ${fullscreenClass(fullscreen, 'bg-white')}`}>
      <div className="absolute top-2 right-2 z-30">
        <FullscreenToggle fullscreen={fullscreen} onToggle={toggleFullscreen} />
      </div>
      <div className={`overflow-auto thin-scroll w-full ${fullscreen ? 'max-h-[calc(100vh-80px)]' : ''}`}>
      <table style={{ width: totalW, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 13 }}>
        <colgroup>
          {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>

        {/* ── 헤더 (스크롤 시 상단 고정) ── */}
        <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {HEADERS.map((h, i) => (
              <th
                key={i}
                style={{
                  position: 'relative',
                  background: '#f8fafc',
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
              <Fragment key={cat}>
                {/* 카테고리 헤더 행 */}
                <tr
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
                  <td colSpan={9} style={{ padding: '7px 10px' }}>
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
                  // W.D(raw) = 물량 / 생산성 또는 물량 × 표준일수 — 가동률 적용 전
                  // C.D(calendar) = task.duration (generateWBS에서 가동률 적용된 최종값)
                  const prodNum = task.productivity ? Number(task.productivity) : null
                  const stdNum  = task.stdDays      ? Number(task.stdDays)      : null
                  const qty = task.quantity ?? 0
                  const rawWD =
                    prodNum && prodNum > 0 ? qty / prodNum :
                    stdNum  && stdNum  > 0 ? qty * stdNum  : 0
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

                      {/* W.D — Add-on: ⓘ 아이콘 호버 시 기간 산정 근거 툴팁 */}
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, fontSize: 14, color: '#2563eb' }}>
                        {(() => {
                          const exp = task.quantity != null
                            ? explainDuration(
                                {
                                  category: task.category,
                                  unit: task.unit ?? undefined,
                                  prod: task.productivity ? Number(task.productivity) : null,
                                  stdDays: task.stdDays ? Number(task.stdDays) : null,
                                },
                                task.quantity,
                                productivitySource(task.name),
                              )
                            : null
                          const tooltip = exp
                            ? [
                                exp.formula,
                                '',
                                '── 계산 단계 ──',
                                ...exp.steps,
                                ...(exp.assumptions.length ? ['', '── 가정 ──', ...exp.assumptions] : []),
                                ...(exp.source ? ['', exp.source] : []),
                              ].join('\n')
                            : '물량 정보 없음'
                          const abn = abnormalIndex.map.get(task.name)
                          return (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span>{rawWD > 0 ? Math.round(rawWD) : '—'}</span>
                              {abn && (
                                <span
                                  title={`⚠️ 비정상 공종\n${abn.message}\n\n이 공종의 기간이 다른 공종 대비 과도할 수 있습니다. 물량·생산성을 재확인하세요.`}
                                  aria-label="비정상 공종"
                                  style={{ display: 'inline-flex', cursor: 'help', color: '#dc2626' }}
                                >
                                  <AlertTriangle size={11} />
                                </span>
                              )}
                              <span
                                title={tooltip}
                                aria-label="기간 산정 근거"
                                style={{ display: 'inline-flex', cursor: 'help', color: '#94a3b8', opacity: 0.7 }}
                              >
                                <Info size={11} />
                              </span>
                            </span>
                          )
                        })()}
                      </td>

                      {/* 공종별 가동률 */}
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>
                        {wrLabel}
                      </td>

                      {/* C.D = W.D ÷ 가동률 (= task.duration, generateWBS에서 이미 적용됨) */}
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: '#475569' }}>
                        {Math.round(task.duration)}
                      </td>

                      {/* 회사 실적 (가중 평균 투입 인원) */}
                      <td style={{ padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {(() => {
                          const ca = companyActual(task.name)
                          if (!ca) {
                            return <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>
                          }
                          const tooltip = `관련 공종 ${ca.trades.length}개: ${ca.trades.join(', ')}\n누적 활동일 ${ca.totalSamples}일 샘플 기반 가중평균`
                          return (
                            <span title={tooltip}>
                              <span style={{
                                fontFamily: 'monospace',
                                fontWeight: 600,
                                color: ca.approved ? '#059669' : '#d97706',
                              }}>
                                {ca.avg}
                              </span>
                              <span style={{ color: '#94a3b8', marginLeft: 3, fontSize: 11 }}>명/일</span>
                              <span style={{ color: '#cbd5e1', marginLeft: 5, fontSize: 10 }}>
                                ({ca.trades.length}공종·{ca.totalSamples}일)
                              </span>
                              {!ca.approved && (
                                <span style={{
                                  fontSize: 9, fontWeight: 600, color: '#d97706',
                                  background: '#fef3c7', borderRadius: 3, padding: '0 3px', marginLeft: 4,
                                }}>대기</span>
                              )}
                            </span>
                          )
                        })()}
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
              </Fragment>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
})

export default WBSTable
