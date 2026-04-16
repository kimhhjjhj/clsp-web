'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════
//  DXF 도면 인터랙티브 미리보기
//  모든 닫힌 폴리곤 표시 → 클릭으로 대지경계/건물외곽 선택
// ═══════════════════════════════════════════════════════════════

interface Segment {
  x1: number; y1: number; x2: number; y2: number
  layer: string
}

interface Loop {
  layer: string
  pts: [number, number][]
  area: number
  perim: number
}

interface Props {
  segments: Segment[]
  loops: Loop[]
  highlightLayers: string[]
  bbox: [number, number, number, number] | null
  onSiteSelect?: (loop: Loop) => void
  onBldgSelect?: (loop: Loop) => void
}

const W = 420, H = 400

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function pointInPolygon(px: number, py: number, pts: [number, number][]): boolean {
  let inside = false
  const n = pts.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside
  }
  return inside
}

export default function DxfPreview({ segments, loops, bbox, onSiteSelect, onBldgSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1.0)
  const panRef = useRef({ x: 0, y: 0 })
  const [, forceRender] = useState(0)
  const isDragging = useRef(false)
  const dragMoved = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const [selectMode, setSelectMode] = useState<'site' | 'bldg' | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [selectedSiteIdx, setSelectedSiteIdx] = useState<number | null>(null)
  const [selectedBldgIdx, setSelectedBldgIdx] = useState<number | null>(null)

  // ── 좌표 변환 ──
  const getView = useCallback(() => {
    if (!bbox) return { ox: 0, oy: 0, dw: 1, dh: 1, sc: 1 }
    const [minX, minY, maxX, maxY] = bbox
    const dw = maxX - minX || 1, dh = maxY - minY || 1
    const PAD = 32
    return { ox: minX, oy: minY, dw, dh, sc: Math.min((W - PAD * 2) / dw, (H - PAD * 2) / dh) }
  }, [bbox])

  const toWorld = useCallback((sx: number, sy: number): [number, number] => {
    const v = getView()
    const sc = v.sc * zoom
    const PAD = 32
    const px = panRef.current.x, py = panRef.current.y
    return [(sx - PAD - px) / sc + v.ox, (H - PAD - sy + py) / sc + v.oy]
  }, [getView, zoom])

  // ── Canvas 렌더링 ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    ctx.fillStyle = '#1A202C'
    ctx.fillRect(0, 0, W, H)

    if (segments.length === 0 && loops.length === 0) {
      ctx.fillStyle = '#64748b'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText('도면 미리보기 없음', W / 2, H / 2)
      ctx.fillText('DXF 파일을 불러오세요.', W / 2, H / 2 + 18)
      return
    }

    const v = getView()
    const sc = v.sc * zoom
    const px = panRef.current.x, py = panRef.current.y
    const PAD = 32

    const toScr = (wx: number, wy: number): [number, number] => [
      PAD + (wx - v.ox) * sc + px,
      H - PAD - (wy - v.oy) * sc + py,
    ]

    // ── 세그먼트 (얇고 흐리게) ──
    ctx.lineWidth = 0.5
    for (const seg of segments) {
      const hue = Math.abs(hashStr(seg.layer)) % 360
      ctx.strokeStyle = `hsla(${hue}, 40%, 55%, 0.25)`
      const [sx1, sy1] = toScr(seg.x1, seg.y1)
      const [sx2, sy2] = toScr(seg.x2, seg.y2)
      ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke()
    }

    // ── 폴리곤 (선택/호버/기본 상태별 색상) ──
    for (let i = 0; i < loops.length; i++) {
      const loop = loops[i]
      const sp = loop.pts.map(([x, y]) => toScr(x, y))
      const isHov = i === hoveredIdx
      const isSite = i === selectedSiteIdx
      const isBldg = i === selectedBldgIdx

      ctx.beginPath()
      sp.forEach(([x, y], j) => j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
      ctx.closePath()

      if (isSite) {
        ctx.fillStyle = 'rgba(220,50,50,0.18)'
        ctx.fill()
        ctx.strokeStyle = 'rgb(220,50,50)'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 4])
        ctx.stroke(); ctx.setLineDash([])
      } else if (isBldg) {
        ctx.fillStyle = 'rgba(255,220,0,0.15)'
        ctx.fill()
        ctx.strokeStyle = 'rgb(255,220,0)'; ctx.lineWidth = 2.0; ctx.setLineDash([])
        ctx.stroke()
      } else if (isHov && selectMode) {
        ctx.fillStyle = selectMode === 'site' ? 'rgba(220,100,100,0.22)' : 'rgba(255,220,50,0.18)'
        ctx.fill()
        ctx.strokeStyle = selectMode === 'site' ? 'rgba(220,100,100,0.9)' : 'rgba(255,220,50,0.9)'
        ctx.lineWidth = 1.8; ctx.setLineDash([])
        ctx.stroke()
      } else {
        ctx.fillStyle = 'rgba(100,140,180,0.07)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(100,140,180,0.4)'; ctx.lineWidth = 1.0
        ctx.stroke()
      }
    }

    // ── 호버 면적 툴팁 ──
    if (hoveredIdx !== null && hoveredIdx < loops.length && selectMode) {
      const loop = loops[hoveredIdx]
      const sp = loop.pts.map(([x, y]) => toScr(x, y))
      const cx = sp.reduce((s, [x]) => s + x, 0) / sp.length
      const cy = sp.reduce((s, [, y]) => s + y, 0) / sp.length
      const label = `${loop.layer}  ${loop.area.toFixed(1)}m²`
      ctx.font = 'bold 11px sans-serif'
      const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(15,23,42,0.9)'
      ctx.fillRect(cx - tw / 2 - 7, cy - 19, tw + 14, 21)
      ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center'
      ctx.fillText(label, cx, cy - 4)
    }

    // ── 범례 ──
    const ly = H - 20
    ctx.font = '10px sans-serif'; ctx.textAlign = 'left'
    if (selectedSiteIdx !== null) {
      const l = loops[selectedSiteIdx]
      ctx.strokeStyle = 'rgb(220,50,50)'; ctx.lineWidth = 2; ctx.setLineDash([5, 3])
      ctx.beginPath(); ctx.moveTo(10, ly); ctx.lineTo(32, ly); ctx.stroke(); ctx.setLineDash([])
      ctx.fillStyle = '#fca5a5'
      ctx.fillText(`대지 ${l.area.toFixed(1)}m²`, 38, ly + 4)
    }
    if (selectedBldgIdx !== null) {
      const l = loops[selectedBldgIdx]
      ctx.strokeStyle = 'rgb(255,220,0)'; ctx.lineWidth = 2; ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(150, ly); ctx.lineTo(172, ly); ctx.stroke()
      ctx.fillStyle = '#fde68a'
      ctx.fillText(`건물 ${l.area.toFixed(1)}m²`, 178, ly + 4)
    }

    // ── 통계 ──
    ctx.font = '9px sans-serif'; ctx.fillStyle = '#475569'; ctx.textAlign = 'left'
    ctx.fillText(`${loops.length} polygons  ×${zoom.toFixed(1)}`, 8, 14)
  }, [segments, loops, getView, zoom, hoveredIdx, selectedSiteIdx, selectedBldgIdx, selectMode])

  useEffect(() => { draw() }, [draw])

  // ── Wheel zoom ──
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    setZoom(z => clamp(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.05, 30))
  }, [])
  useEffect(() => {
    const el = containerRef.current; if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  // ── Mouse: drag pan + hover + click select ──
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; e.preventDefault()
    isDragging.current = true; dragMoved.current = false
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const dx = e.clientX - lastPos.current.x, dy = e.clientY - lastPos.current.y
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true
        panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy }
        lastPos.current = { x: e.clientX, y: e.clientY }
        forceRender(n => n + 1)
        return
      }
      if (!selectMode) return
      const canvas = canvasRef.current; if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const [wx, wy] = toWorld(e.clientX - rect.left, e.clientY - rect.top)
      let found = -1
      for (let i = 0; i < loops.length; i++) {
        if (pointInPolygon(wx, wy, loops[i].pts)) { found = i; break }
      }
      setHoveredIdx(found >= 0 ? found : null)
    }
    const onUp = (e: MouseEvent) => {
      if (!isDragging.current) return
      isDragging.current = false
      if (!dragMoved.current && selectMode) {
        const canvas = canvasRef.current; if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const [wx, wy] = toWorld(e.clientX - rect.left, e.clientY - rect.top)
        for (let i = 0; i < loops.length; i++) {
          if (pointInPolygon(wx, wy, loops[i].pts)) {
            if (selectMode === 'site') { setSelectedSiteIdx(i); onSiteSelect?.(loops[i]) }
            else { setSelectedBldgIdx(i); onBldgSelect?.(loops[i]) }
            break
          }
        }
      }
    }
    const onLeave = () => { if (!selectMode) return; setHoveredIdx(null) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    const canvas = canvasRef.current
    canvas?.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      canvas?.removeEventListener('mouseleave', onLeave)
    }
  }, [selectMode, loops, toWorld, onSiteSelect, onBldgSelect])

  const resetView = useCallback(() => { setZoom(1); panRef.current = { x: 0, y: 0 }; forceRender(n => n + 1) }, [])

  const cursorStyle = selectMode ? (hoveredIdx !== null ? 'pointer' : 'crosshair') : 'grab'

  return (
    <div className="flex flex-col bg-[#1A202C]" style={{ width: W }}>
      {/* 컨트롤 바 */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-700 gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setSelectMode(m => m === 'site' ? null : 'site'); setHoveredIdx(null) }}
            className={`h-6 px-2 rounded text-[10px] font-medium transition-colors ${
              selectMode === 'site' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            대지경계 선택
          </button>
          <button
            onClick={() => { setSelectMode(m => m === 'bldg' ? null : 'bldg'); setHoveredIdx(null) }}
            className={`h-6 px-2 rounded text-[10px] font-medium transition-colors ${
              selectMode === 'bldg' ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            건물외곽 선택
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => clamp(z / 1.25, 0.05, 30))}
            className="w-6 h-6 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm flex items-center justify-center">−</button>
          <button onClick={resetView}
            className="h-6 px-1.5 rounded bg-slate-700 text-[10px] text-slate-300 hover:bg-slate-600 font-mono min-w-[38px] text-center">맞춤</button>
          <button onClick={() => setZoom(z => clamp(z * 1.25, 0.05, 30))}
            className="w-6 h-6 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm flex items-center justify-center">+</button>
        </div>
      </div>

      {/* 모드 안내 */}
      {selectMode && (
        <div className={`px-3 py-1 text-[10px] text-center ${
          selectMode === 'site' ? 'bg-red-900/40 text-red-200' : 'bg-yellow-900/40 text-yellow-200'
        }`}>
          {selectMode === 'site' ? '대지경계선으로 사용할 폴리곤을 클릭하세요' : '건물외곽선으로 사용할 폴리곤을 클릭하세요'}
        </div>
      )}

      {/* 캔버스 */}
      <div
        ref={containerRef}
        style={{ width: W, height: H, cursor: cursorStyle, userSelect: 'none' }}
        onMouseDown={onMouseDown}
      >
        <canvas ref={canvasRef} style={{ width: W, height: H, display: 'block' }} />
      </div>
    </div>
  )
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
