'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface BuildingDiagramProps {
  ground: number
  basement: number
  lowrise: number
  hasTransfer: boolean
  wtBottom: number
  waBottom: number
  excDepth: number
  isAutoExc?: boolean
}

// ── 스케일 ──────────────────────────────────────────────────
const BSMT_H   = 22   // px / 지하층
const FLOOR_M  = 4.0
const SOIL_PX  = BSMT_H / FLOOR_M  // 5.5 px/m
const MAT_H    = 16
const SVG_W    = 300
const BLDG_L   = 72
const BLDG_R   = 228
const BLDG_W   = BLDG_R - BLDG_L
const PAD_TOP  = 20
const PAD_BOT  = 68
const MIN_BLOCK = 28  // 블록 최소 높이

const C = {
  soil:      '#C8A050',
  rock:      '#A09878',
  softRock:  '#8890A8',
  basement:  '#AED6F1',
  mat:       '#94A3B8',
  matStroke: '#475569',
  lowrise:   '#3AACA0',
  transfer:  '#D4A017',
  standard:  '#5BA85A',
  top:       '#4A90D9',
  groundLn:  '#374151',
  label:     '#6b7280',
  exc:       '#ef4444',
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

// ── 층 그룹 구성 ─────────────────────────────────────────────
interface FloorGroup {
  label: string
  subLabel?: string   // "× 15층"
  color: string
  floors: number      // 실제 층수
  minH: number        // 최소 픽셀
  fStart: number      // 시작 층 번호 (1-based)
  fEnd: number
}

function buildGroups(g: number, lr: number, hasTransfer: boolean): FloorGroup[] {
  if (g <= 0) return []
  const groups: FloorGroup[] = []
  let cursor = 1

  // 저층부
  if (lr > 0) {
    groups.push({
      label: '저층부', subLabel: `× ${lr}F`,
      color: C.lowrise, floors: lr,
      minH: MIN_BLOCK, fStart: cursor, fEnd: cursor + lr - 1,
    })
    cursor += lr
  }

  // 전이층
  if (hasTransfer && cursor <= g) {
    groups.push({
      label: '전이층', color: C.transfer, floors: 1,
      minH: MIN_BLOCK, fStart: cursor, fEnd: cursor,
    })
    cursor++
  }

  // 기준층 (최상층 빼고)
  const stdEnd = g - 1
  if (cursor <= stdEnd) {
    const cnt = stdEnd - cursor + 1
    groups.push({
      label: '기준층', subLabel: `× ${cnt}F`,
      color: C.standard, floors: cnt,
      minH: MIN_BLOCK * 2, fStart: cursor, fEnd: stdEnd,
    })
    cursor = stdEnd + 1
  }

  // 최상층
  if (cursor <= g) {
    groups.push({
      label: '최상층', color: C.top, floors: 1,
      minH: MIN_BLOCK, fStart: g, fEnd: g,
    })
  }

  // 순서: 저층부 → 전이층 → 기준층 → 최상층 (아래→위)
  return groups
}

export default function BuildingDiagram({
  ground, basement, lowrise, hasTransfer,
  wtBottom, waBottom, excDepth, isAutoExc,
}: BuildingDiagramProps) {
  const g   = Math.max(0, ground)
  const b   = Math.max(0, basement)
  const lr  = clamp(lowrise, 0, g > 0 ? g - 1 : 0)
  const wt  = Math.max(0, wtBottom)
  const wa  = Math.max(wt, waBottom)
  const ra  = wa   // 풍화암 하단 이하 전부 연암
  const exc = Math.max(0, excDepth)

  // ── 층 그룹 & 픽셀 계산 ────────────────────────────────
  const groups = buildGroups(g, lr, hasTransfer)
  // 총 지상 블록 높이: 최소높이 보장 + 비율 배분
  const totalFloors  = g
  const totalMinH    = groups.reduce((s, gr) => s + gr.minH, 0)
  const extraH       = Math.max(0, totalFloors * 8 - totalMinH)  // 비례 추가
  const totalAbovePx = totalMinH + extraH

  // 각 그룹 픽셀
  const groupPx = groups.map(gr => {
    const base = gr.minH
    const extra = totalFloors > 0 ? extraH * (gr.floors / totalFloors) : 0
    return Math.round(base + extra)
  })

  // 지하/토층
  const bsmtStructPx = b * BSMT_H + (b > 0 ? MAT_H : 0)
  const soilPx       = Math.max(wt, wa, ra, exc) * SOIL_PX
  const belowPx      = Math.max(bsmtStructPx, soilPx) + 8

  const GROUND_Y     = PAD_TOP + totalAbovePx
  const SVG_H        = GROUND_Y + belowPx + PAD_BOT

  const wtPx  = wt * SOIL_PX
  const waPx  = (wa - wt) * SOIL_PX
  const raPx  = (ra - wa) * SOIL_PX

  const bsmtBottomY = GROUND_Y + b * BSMT_H
  const excArrowPx  = b > 0 ? bsmtBottomY - GROUND_Y + MAT_H : exc * SOIL_PX

  // ── Zoom / Pan (드래그 수정) ─────────────────────────
  const containerRef  = useRef<HTMLDivElement>(null)
  const [zoom, setZoom]   = useState(1)
  const [pan,  setPan]    = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [g, b])

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    setZoom(z => clamp(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.3, 4))
  }, [])
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    setIsDragging(true)
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }, [isDragging])

  const stopDrag = useCallback(() => setIsDragging(false), [])

  const showDiagram = g > 0

  return (
    <div className="w-full flex flex-col" style={{ background: '#f8fafc', borderRadius: 8, overflow: 'hidden' }}>

      {/* 컨트롤 바 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-white flex-shrink-0">
        <span className="text-[10px] text-gray-400 font-medium truncate">
          {showDiagram
            ? `지상 ${g}F / 지하 ${b}F${b > 0 ? ` · 굴착 ${exc}m${isAutoExc ? ' (자동)' : ''}` : ''}`
            : '층수를 입력하면 단면이 표시됩니다'}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setZoom(z => clamp(z / 1.25, 0.3, 4))}
            className="w-6 h-6 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center text-sm leading-none">−</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
            className="h-6 px-1.5 rounded border border-gray-200 bg-white text-[10px] text-gray-500 hover:bg-gray-50 font-mono min-w-[38px] text-center">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => setZoom(z => clamp(z * 1.25, 0.3, 4))}
            className="w-6 h-6 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center text-sm leading-none">+</button>
        </div>
      </div>

      {/* 캔버스 */}
      <div
        ref={containerRef}
        style={{ height: 380, overflow: 'hidden', position: 'relative',
          cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      >
        <div style={{
          transform: `translate(calc(-50% + ${pan.x}px), ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'top center',
          width: SVG_W,
          position: 'absolute',
          left: '50%',
          top: 0,
          // 드래그 중에는 transition 없애서 부드럽게
          transition: isDragging ? 'none' : 'transform 0.08s ease',
        }}>
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width={SVG_W} height={SVG_H}
            style={{ fontFamily: 'sans-serif', display: 'block' }}>

            <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#f8fafc" />

            {/* ── 토층 배경 ── */}
            {wtPx > 0 && <rect x={0} y={GROUND_Y} width={SVG_W} height={wtPx} fill={C.soil}     opacity={0.28} />}
            {waPx > 0 && <rect x={0} y={GROUND_Y+wtPx} width={SVG_W} height={waPx} fill={C.rock}    opacity={0.36} />}
            {raPx > 0 && <rect x={0} y={GROUND_Y+wtPx+waPx} width={SVG_W} height={raPx} fill={C.softRock} opacity={0.36} />}

            {/* ── GL 라인 ── */}
            <line x1={0} y1={GROUND_Y} x2={SVG_W} y2={GROUND_Y} stroke={C.groundLn} strokeWidth={2} />
            <text x={BLDG_L - 4} y={GROUND_Y - 5} fontSize={8.5} fill={C.label} textAnchor="end">GL±0</text>

            {!showDiagram && (
              <text x={SVG_W/2} y={GROUND_Y - 24} fontSize={11} fill="#9ca3af" textAnchor="middle">
                지상층수를 입력하세요
              </text>
            )}

            {/* ── 지상 그룹 블록 ── */}
            {(() => {
              let curY = GROUND_Y
              return groups.map((gr, idx) => {
                const h = groupPx[idx]
                curY -= h
                const blockY = curY
                const isFirst = idx === 0                  // GL 바로 위 (저층부)
                const isLast  = idx === groups.length - 1  // 최상단 (최상층)

                return (
                  <g key={gr.label + idx}>
                    {/* 블록 */}
                    <rect x={BLDG_L} y={blockY} width={BLDG_W} height={h}
                      fill={gr.color} stroke="rgba(0,0,0,0.15)" strokeWidth={0.8}
                      rx={isLast ? 3 : 0}
                    />
                    {/* 층 구분선 (기준층 내부 - 5층마다) */}
                    {gr.floors > 3 && (() => {
                      const pxPerFloor = h / gr.floors
                      return Array.from({ length: gr.floors - 1 }, (_, i) => (
                        <line key={i}
                          x1={BLDG_L} y1={blockY + (i + 1) * pxPerFloor}
                          x2={BLDG_R} y2={blockY + (i + 1) * pxPerFloor}
                          stroke="rgba(255,255,255,0.25)" strokeWidth={0.5}
                        />
                      ))
                    })()}
                    {/* 라벨 */}
                    <text x={BLDG_L + BLDG_W / 2} y={blockY + h / 2 - (gr.subLabel ? 5 : 0) + 1}
                      fontSize={10} fill="white" textAnchor="middle" fontWeight="700">
                      {gr.label}
                    </text>
                    {gr.subLabel && (
                      <text x={BLDG_L + BLDG_W / 2} y={blockY + h / 2 + 9}
                        fontSize={9} fill="rgba(255,255,255,0.85)" textAnchor="middle">
                        {gr.subLabel}
                      </text>
                    )}
                    {/* 층 번호 (우측) */}
                    <text x={BLDG_R + 5} y={blockY + 8}
                      fontSize={7.5} fill={C.label}>F{gr.fEnd}</text>
                    {isFirst && (
                      <text x={BLDG_R + 5} y={GROUND_Y - 3}
                        fontSize={7.5} fill={C.label}>F{gr.fStart}</text>
                    )}
                  </g>
                )
              })
            })()}

            {/* ── 지하층 ── */}
            {Array.from({ length: b }, (_, i) => (
              <g key={`b${i}`}>
                <rect x={BLDG_L} y={GROUND_Y + i * BSMT_H} width={BLDG_W} height={BSMT_H - 1}
                  fill={C.basement} stroke="#7fb3d3" strokeWidth={0.5} />
                <text x={BLDG_L + BLDG_W / 2} y={GROUND_Y + i * BSMT_H + BSMT_H / 2 + 4}
                  fontSize={9} fill="#1e4a6b" textAnchor="middle" fontWeight="600">B{i + 1}</text>
              </g>
            ))}

            {/* ── MAT 기초 ── */}
            {b > 0 && (
              <g>
                <rect x={BLDG_L - 6} y={bsmtBottomY} width={BLDG_W + 12} height={MAT_H}
                  fill={C.mat} stroke={C.matStroke} strokeWidth={1} rx={1} />
                {Array.from({ length: 9 }, (_, i) => (
                  <line key={i}
                    x1={BLDG_L - 6 + i * (BLDG_W + 12) / 8} y1={bsmtBottomY}
                    x2={BLDG_L - 6 + (i - 1) * (BLDG_W + 12) / 8} y2={bsmtBottomY + MAT_H}
                    stroke={C.matStroke} strokeWidth={0.6} opacity={0.35} />
                ))}
                <text x={BLDG_L + BLDG_W / 2} y={bsmtBottomY + MAT_H / 2 + 4}
                  fontSize={8} fill="white" textAnchor="middle" fontWeight="700" letterSpacing="1">MAT</text>
              </g>
            )}

            {/* 건물 외곽선 */}
            {showDiagram && (() => {
              const topY = GROUND_Y - totalAbovePx
              const botY = b > 0 ? GROUND_Y + b * BSMT_H : GROUND_Y
              return <rect x={BLDG_L} y={topY} width={BLDG_W} height={botY - topY}
                fill="none" stroke="#374151" strokeWidth={1.5} />
            })()}

            {/* ── 굴착 화살표 ── */}
            {excArrowPx > 0 && (
              <g>
                <line x1={BLDG_L - 16} y1={GROUND_Y} x2={BLDG_L - 16} y2={GROUND_Y + excArrowPx}
                  stroke={C.exc} strokeWidth={1.2} strokeDasharray="4,2" />
                <line x1={BLDG_L - 22} y1={GROUND_Y}              x2={BLDG_L - 10} y2={GROUND_Y}              stroke={C.exc} strokeWidth={1} />
                <line x1={BLDG_L - 22} y1={GROUND_Y + excArrowPx} x2={BLDG_L - 10} y2={GROUND_Y + excArrowPx} stroke={C.exc} strokeWidth={1} />
                <text x={BLDG_L - 25} y={GROUND_Y + excArrowPx / 2 - 3} fontSize={7} fill={C.exc} textAnchor="end">굴착</text>
                <text x={BLDG_L - 25} y={GROUND_Y + excArrowPx / 2 + 7} fontSize={8} fill={C.exc} textAnchor="end" fontWeight="700">{exc}m{isAutoExc ? '*' : ''}</text>
                {isAutoExc && (
                  <text x={BLDG_L - 25} y={GROUND_Y + excArrowPx / 2 + 17} fontSize={6} fill="#f97316" textAnchor="end">(자동)</text>
                )}
              </g>
            )}

            {/* ── 토층 라벨 ── */}
            {wtPx > 6 && <text x={BLDG_R + 8} y={GROUND_Y + wtPx / 2 + 4}              fontSize={7.5} fill="#92610a">풍화토 {wt}m</text>}
            {waPx > 6 && <text x={BLDG_R + 8} y={GROUND_Y + wtPx + waPx / 2 + 4}       fontSize={7.5} fill="#6b5a3e">풍화암 {(wa-wt).toFixed(1)}m</text>}
            {raPx > 6 && <text x={BLDG_R + 8} y={GROUND_Y + wtPx + waPx + raPx / 2 + 4} fontSize={7.5} fill="#4a5568">연암 {(ra-wa).toFixed(1)}m</text>}

            {/* ── 범례 ── */}
            <g transform={`translate(4, ${SVG_H - PAD_BOT + 10})`}>
              <text fontSize={7} fontWeight="700" fill={C.label}>범례</text>
              {[
                { c: C.lowrise,  l: '저층부' }, { c: C.transfer, l: '전이층' },
                { c: C.standard, l: '기준층' }, { c: C.top,      l: '최상층' },
                { c: C.basement, l: '지하층' }, { c: C.mat,      l: 'MAT' },
              ].map((item, i) => (
                <g key={item.l} transform={`translate(${i * 46}, 10)`}>
                  <rect x={0} y={0} width={10} height={9} fill={item.c} rx={1.5} />
                  <text x={13} y={8} fontSize={6.5} fill="#4b5563">{item.l}</text>
                </g>
              ))}
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
}
