'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════
//  DXF 도면 미리보기 — claude1.py CadPreviewWidget 포팅
//  SITE = 빨간 점선  |  CON_outline = 노란 실선  |  기타 = 숨김
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
}

const W = 420, H = 400

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export default function DxfPreview({ segments, loops, highlightLayers, bbox }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1.0)
  const panRef = useRef({ x: 0, y: 0 })
  const [, forceRender] = useState(0)
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const hlSet = new Set(highlightLayers)
  const hasHL = hlSet.size > 0

  // ── 좌표 변환 ──
  const getView = useCallback(() => {
    if (!bbox) return { ox: 0, oy: 0, sc: 1 }
    const [minX, minY, maxX, maxY] = bbox
    const dw = maxX - minX || 1, dh = maxY - minY || 1
    const PAD = 32
    return { ox: minX, oy: minY, dw, dh, sc: Math.min((W - PAD * 2) / dw, (H - PAD * 2) / dh) }
  }, [bbox])

  // ── Canvas 렌더링 (claude1.py paintEvent 포팅) ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    // 배경 (Python: #1A202C)
    ctx.fillStyle = '#1A202C'
    ctx.fillRect(0, 0, W, H)

    if (segments.length === 0) {
      ctx.fillStyle = '#64748b'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText('도면 미리보기 없음', W / 2, H / 2)
      ctx.fillText('DXF 파일을 불러오세요.', W / 2, H / 2 + 18)
      return
    }

    // 십자선
    ctx.strokeStyle = 'rgba(40,55,75,0.4)'; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2)
    ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()

    const v = getView()
    const sc = v.sc * zoom
    const px = panRef.current.x, py = panRef.current.y
    const PAD = 32

    const toScr = (wx: number, wy: number): [number, number] => [
      PAD + (wx - v.ox) * sc + px,
      H - PAD - (wy - v.oy) * sc + py,  // Y flip
    ]

    // ── 기타 레이어 (HL 없으면 레이어별 색상, HL 있으면 완전 숨김) ──
    if (!hasHL) {
      ctx.lineWidth = 1
      for (const seg of segments) {
        const hue = Math.abs(hashStr(seg.layer)) % 360
        ctx.strokeStyle = `hsl(${hue}, 60%, 59%)`
        const [sx1, sy1] = toScr(seg.x1, seg.y1)
        const [sx2, sy2] = toScr(seg.x2, seg.y2)
        ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke()
      }
    }
    // HL 있으면 기타 레이어 skip (Python: continue)

    // ── SITE 면 채우기 (반투명) ──
    for (const loop of loops) {
      if (loop.layer !== 'SITE') continue
      const sp = loop.pts.map(([x, y]) => toScr(x, y))
      ctx.fillStyle = 'rgba(220,50,50,0.06)'
      ctx.beginPath(); sp.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
      ctx.closePath(); ctx.fill()
    }

    // ── CON_outline 면 채우기 ──
    for (const loop of loops) {
      if (loop.layer !== 'CON_outline') continue
      const sp = loop.pts.map(([x, y]) => toScr(x, y))
      ctx.fillStyle = 'rgba(255,220,0,0.06)'
      ctx.beginPath(); sp.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
      ctx.closePath(); ctx.fill()
    }

    // ── SITE 선분 (빨간 점선 — Python: QColor(220,50,50) DashLine 2.5) ──
    if (hasHL) {
      ctx.strokeStyle = 'rgb(220, 50, 50)'
      ctx.lineWidth = 2.5
      ctx.setLineDash([7, 4])
      for (const seg of segments) {
        if (seg.layer.toUpperCase() !== 'SITE') continue
        const [sx1, sy1] = toScr(seg.x1, seg.y1)
        const [sx2, sy2] = toScr(seg.x2, seg.y2)
        ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke()
      }
      ctx.setLineDash([])
    }

    // ── CON_outline 선분 (노란 실선 — Python: QColor(255,220,0) 2.0) ──
    if (hasHL) {
      ctx.strokeStyle = 'rgb(255, 220, 0)'
      ctx.lineWidth = 2.0
      for (const seg of segments) {
        if (seg.layer !== 'CON_outline') continue
        const [sx1, sy1] = toScr(seg.x1, seg.y1)
        const [sx2, sy2] = toScr(seg.x2, seg.y2)
        ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke()
      }
    }

    // ── 범례 (Python 방식) ──
    if (hasHL) {
      const ly = H - 28
      // 대지경계선 (빨간 점선)
      ctx.strokeStyle = 'rgb(220,50,50)'; ctx.lineWidth = 2; ctx.setLineDash([5, 3])
      ctx.beginPath(); ctx.moveTo(12, ly); ctx.lineTo(40, ly); ctx.stroke(); ctx.setLineDash([])
      ctx.fillStyle = '#B4B4B4'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left'
      ctx.fillText('대지경계선', 46, ly + 4)

      // 건축외곽선 (노란 실선)
      ctx.strokeStyle = 'rgb(255,220,0)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(140, ly); ctx.lineTo(168, ly); ctx.stroke()
      ctx.fillStyle = '#B4B4B4'
      ctx.fillText('건축외곽선(지하)', 174, ly + 4)
    }

    // ── 상단 면적 정보 ──
    const siteL = loops.find(l => l.layer === 'SITE')
    const bldgL = loops.find(l => l.layer === 'CON_outline')
    if (siteL || bldgL) {
      ctx.font = '10px sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'right'
      const parts: string[] = []
      if (siteL) parts.push(`대지 ${siteL.area.toFixed(1)}m²`)
      if (bldgL) parts.push(`건물 ${bldgL.area.toFixed(1)}m²`)
      ctx.fillText(parts.join('  │  '), W - 12, 16)
    }

    // 세그먼트 수 + 줌
    ctx.font = '9px sans-serif'; ctx.fillStyle = '#475569'; ctx.textAlign = 'left'
    ctx.fillText(`${segments.length.toLocaleString()} segs  ×${zoom.toFixed(1)}`, 8, 14)
  }, [segments, loops, getView, zoom, hasHL, highlightLayers])

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

  // ── Drag pan (window events — 캔버스 밖 드래그 지원) ──
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; e.preventDefault()
    isDragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      panRef.current = { x: panRef.current.x + e.clientX - lastPos.current.x, y: panRef.current.y + e.clientY - lastPos.current.y }
      lastPos.current = { x: e.clientX, y: e.clientY }
      forceRender(n => n + 1)
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const resetView = useCallback(() => { setZoom(1); panRef.current = { x: 0, y: 0 }; forceRender(n => n + 1) }, [])

  return (
    <div className="flex flex-col bg-[#1A202C]" style={{ width: W }}>
      {/* 컨트롤 바 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700">
        <span className="text-[10px] text-slate-400">CAD 도면 미리보기 (SITE=빨강점선 외곽=노랑실선)</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => clamp(z / 1.25, 0.05, 30))}
            className="w-6 h-6 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm flex items-center justify-center">−</button>
          <button onClick={resetView}
            className="h-6 px-1.5 rounded bg-slate-700 text-[10px] text-slate-300 hover:bg-slate-600 font-mono min-w-[38px] text-center">
            맞춤
          </button>
          <button onClick={() => setZoom(z => clamp(z * 1.25, 0.05, 30))}
            className="w-6 h-6 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm flex items-center justify-center">+</button>
        </div>
      </div>

      {/* 캔버스 */}
      <div
        ref={containerRef}
        style={{ width: W, height: H, cursor: 'grab', userSelect: 'none' }}
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
