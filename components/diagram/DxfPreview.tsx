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
  width?: number
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function pointInPolygon(px: number, py: number, pts: [number, number][]): boolean {
  let inside = false; const n = pts.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside
  }
  return inside
}
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1; const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}
function minEdgeDist(px: number, py: number, pts: [number, number][]): number {
  const n = pts.length; let min = Infinity
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n]
    const d = distToSegment(px, py, x1, y1, x2, y2); if (d < min) min = d
  }
  return min
}

// 2%~98% percentile bbox (아웃라이어 제거, 맞춤 버튼용)
function getSmartBbox(segs: Segment[], loops: Loop[]): [number, number, number, number] | null {
  const xs: number[] = [], ys: number[] = []
  for (const s of segs) { xs.push(s.x1, s.x2); ys.push(s.y1, s.y2) }
  for (const l of loops) { for (const [x, y] of l.pts) { xs.push(x); ys.push(y) } }
  if (xs.length === 0) return null
  xs.sort((a, b) => a - b); ys.sort((a, b) => a - b)
  const n = xs.length
  const x0 = xs[Math.floor(n * 0.02)], x1 = xs[Math.min(n - 1, Math.floor(n * 0.98))]
  const y0 = ys[Math.floor(n * 0.02)], y1 = ys[Math.min(n - 1, Math.floor(n * 0.98))]
  if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return [xs[0], ys[0], xs[n - 1], ys[n - 1]]
  return [x0, y0, x1, y1]
}

// 화면 픽셀 기준 12px 이내 가장 가까운 코너 점 스냅
function findSnap(
  wx: number, wy: number,
  segs: Segment[], loops: Loop[],
  sc: number
): [number, number] | null {
  const r = 12 / sc
  let best: [number, number] | null = null, bestDist = r
  const check = (x: number, y: number) => {
    const d = Math.hypot(wx - x, wy - y)
    if (d < bestDist) { bestDist = d; best = [x, y] }
  }
  for (const s of segs) { check(s.x1, s.y1); check(s.x2, s.y2) }
  for (const l of loops) { for (const [x, y] of l.pts) check(x, y) }
  return best
}

function formatDist(d: number): string {
  if (d >= 1) return `${d.toFixed(2)} m`
  return `${(d * 100).toFixed(1)} cm`
}

export default function DxfPreview({ segments, loops, bbox, onSiteSelect, onBldgSelect, width }: Props) {
  const W = width ?? 420
  const H = Math.round(W * 0.88)
  const whRef = useRef({ W, H })
  useEffect(() => { whRef.current = { W, H } }, [W, H])

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

  // 거리 측정 도구
  const [measureMode, setMeasureMode] = useState(false)
  const [measureDone, setMeasureDone] = useState(false)     // UI 배너용
  const [measurePtsCnt, setMeasurePtsCnt] = useState(0)    // UI 배너용
  const measureModeRef  = useRef(false)
  const measureDoneRef  = useRef(false)
  const measurePtsRef   = useRef<[number, number][]>([])   // 확정 점 배열 (월드 좌표)
  const measureCursorRef = useRef<[number, number] | null>(null) // 마우스 월드 좌표 (스냅 적용)
  const measureSnapRef  = useRef(false)                    // 현재 스냅 중 여부

  useEffect(() => { measureModeRef.current = measureMode }, [measureMode])
  useEffect(() => { measureDoneRef.current = measureDone }, [measureDone])

  // refs (stale closure 방지)
  const selectModeRef   = useRef<'site' | 'bldg' | null>(null)
  const segmentsRef     = useRef<Segment[]>(segments)
  const loopsRef        = useRef<Loop[]>(loops)
  const bboxRef         = useRef(bbox)
  const zoomRef         = useRef(zoom)
  const onSiteSelectRef = useRef(onSiteSelect)
  const onBldgSelectRef = useRef(onBldgSelect)
  useEffect(() => { selectModeRef.current = selectMode }, [selectMode])
  useEffect(() => { segmentsRef.current = segments }, [segments])
  useEffect(() => { loopsRef.current = loops }, [loops])
  useEffect(() => { bboxRef.current = bbox }, [bbox])
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { onSiteSelectRef.current = onSiteSelect }, [onSiteSelect])
  useEffect(() => { onBldgSelectRef.current = onBldgSelect }, [onBldgSelect])

  // ── 좌표 변환 (기존 bbox 기준) ──
  const getView = useCallback(() => {
    if (!bbox) return { ox: 0, oy: 0, sc: 1 }
    const [minX, minY, maxX, maxY] = bbox
    const dw = maxX - minX || 1, dh = maxY - minY || 1
    const PAD = 32
    return { ox: minX, oy: minY, sc: Math.min((W - PAD * 2) / dw, (H - PAD * 2) / dh) }
  }, [bbox, W, H])

  // 현재 월드→스크린 스케일 계산 (스냅 반경용)
  const getScaleRef = useRef<() => number>(() => 1)
  useEffect(() => {
    getScaleRef.current = () => {
      const b = bboxRef.current; if (!b) return 1
      const [bx0, by0, bx1, by1] = b
      const { W: cW, H: cH } = whRef.current; const PAD = 32
      const baseSc = Math.min((cW - PAD * 2) / (bx1 - bx0 || 1), (cH - PAD * 2) / (by1 - by0 || 1))
      return baseSc * zoomRef.current
    }
  })

  // 파일 로드 시 자동 맞춤 + 측정 초기화
  const resetMeasure = useCallback(() => {
    measurePtsRef.current = []
    measureCursorRef.current = null
    measureSnapRef.current = false
    measureDoneRef.current = false
    setMeasureDone(false)
    setMeasurePtsCnt(0)
  }, [])

  useEffect(() => {
    setZoom(1); panRef.current = { x: 0, y: 0 }
    setSelectedSiteIdx(null); setSelectedBldgIdx(null); setHoveredIdx(null)
    setSelectMode(null); setMeasureMode(false); resetMeasure()
    forceRender(n => n + 1)
  }, [bbox, resetMeasure])

  // ── Canvas 렌더링 ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#1A202C'; ctx.fillRect(0, 0, W, H)

    if (segments.length === 0 && loops.length === 0) {
      ctx.fillStyle = '#64748b'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText('도면 미리보기 없음', W / 2, H / 2)
      ctx.fillText('DXF 파일을 불러오세요.', W / 2, H / 2 + 18)
      return
    }

    const v = getView(); const sc = v.sc * zoom
    const px = panRef.current.x, py = panRef.current.y; const PAD = 32
    const toScr = (wx: number, wy: number): [number, number] => [
      PAD + (wx - v.ox) * sc + px,
      H - PAD - (wy - v.oy) * sc + py,
    ]

    // ── 세그먼트 ──
    ctx.lineWidth = 1.0
    for (const seg of segments) {
      const hue = Math.abs(hashStr(seg.layer)) % 360
      ctx.strokeStyle = `hsla(${hue}, 70%, 70%, 0.75)`
      const [sx1, sy1] = toScr(seg.x1, seg.y1); const [sx2, sy2] = toScr(seg.x2, seg.y2)
      ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke()
    }

    // ── 폴리곤 ──
    for (let i = 0; i < loops.length; i++) {
      const loop = loops[i]; const sp = loop.pts.map(([x, y]) => toScr(x, y))
      const isHov = i === hoveredIdx, isSite = i === selectedSiteIdx, isBldg = i === selectedBldgIdx
      ctx.beginPath()
      sp.forEach(([x, y], j) => j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
      ctx.closePath()
      if (isSite) {
        ctx.fillStyle = 'rgba(220,50,50,0.18)'; ctx.fill()
        ctx.strokeStyle = 'rgb(220,50,50)'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 4])
        ctx.stroke(); ctx.setLineDash([])
      } else if (isBldg) {
        ctx.fillStyle = 'rgba(255,220,0,0.15)'; ctx.fill()
        ctx.strokeStyle = 'rgb(255,220,0)'; ctx.lineWidth = 2.0; ctx.setLineDash([]); ctx.stroke()
      } else if (isHov && selectMode) {
        ctx.fillStyle = selectMode === 'site' ? 'rgba(220,100,100,0.22)' : 'rgba(255,220,50,0.18)'; ctx.fill()
        ctx.strokeStyle = selectMode === 'site' ? 'rgba(220,100,100,0.9)' : 'rgba(255,220,50,0.9)'
        ctx.lineWidth = 1.8; ctx.setLineDash([]); ctx.stroke()
      } else {
        ctx.fillStyle = 'rgba(100,140,180,0.07)'; ctx.fill()
        ctx.strokeStyle = 'rgba(100,140,180,0.4)'; ctx.lineWidth = 1.0; ctx.stroke()
      }
    }

    // ── 호버 툴팁 ──
    if (hoveredIdx !== null && hoveredIdx < loops.length && selectMode) {
      const loop = loops[hoveredIdx]
      const sp = loop.pts.map(([x, y]) => toScr(x, y))
      const cx = sp.reduce((s, [x]) => s + x, 0) / sp.length
      const cy = sp.reduce((s, [, y]) => s + y, 0) / sp.length
      const label = `${loop.layer}  ${loop.area.toFixed(1)}m²`
      ctx.font = 'bold 11px sans-serif'; const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(15,23,42,0.9)'; ctx.fillRect(cx - tw / 2 - 7, cy - 19, tw + 14, 21)
      ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center'; ctx.fillText(label, cx, cy - 4)
    }

    // ── 거리 측정 오버레이 ──
    const pts = measurePtsRef.current
    const cursor = measureCursorRef.current
    const done = measureDoneRef.current
    const snapped = measureSnapRef.current

    if (pts.length > 0 || (!done && cursor)) {
      let totalDist = 0

      // 확정 선분 + 각 거리 레이블
      ctx.lineWidth = 1.5; ctx.setLineDash([5, 3])
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = toScr(pts[i][0], pts[i][1])
        const [bx, by] = toScr(pts[i + 1][0], pts[i + 1][1])
        ctx.strokeStyle = 'rgba(0,210,255,0.9)'
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
        const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
        totalDist += d
        // 선분 중간 거리
        const mx = (ax + bx) / 2, my = (ay + by) / 2
        ctx.font = '10px sans-serif'; const lbl = formatDist(d); const tw = ctx.measureText(lbl).width
        ctx.fillStyle = 'rgba(0,12,28,0.82)'; ctx.fillRect(mx - tw / 2 - 4, my - 14, tw + 8, 15)
        ctx.fillStyle = 'rgba(0,210,255,0.9)'; ctx.textAlign = 'center'; ctx.fillText(lbl, mx, my - 3); ctx.textAlign = 'left'
      }

      // 미완성 선분 (마지막 확정점 → cursor)
      if (!done && cursor && pts.length > 0) {
        const [ax, ay] = toScr(pts[pts.length - 1][0], pts[pts.length - 1][1])
        const [bx, by] = toScr(cursor[0], cursor[1])
        ctx.strokeStyle = 'rgba(0,210,255,0.4)'
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
        const d = Math.hypot(cursor[0] - pts[pts.length - 1][0], cursor[1] - pts[pts.length - 1][1])
        const running = totalDist + d
        const mx = (ax + bx) / 2, my = (ay + by) / 2
        ctx.font = '10px sans-serif'; const lbl = formatDist(d); const tw = ctx.measureText(lbl).width
        ctx.fillStyle = 'rgba(0,12,28,0.7)'; ctx.fillRect(mx - tw / 2 - 4, my - 14, tw + 8, 15)
        ctx.fillStyle = 'rgba(0,210,255,0.55)'; ctx.textAlign = 'center'; ctx.fillText(lbl, mx, my - 3); ctx.textAlign = 'left'
        // 합계 미리보기 (cursor 옆)
        const [cx2, cy2] = toScr(cursor[0], cursor[1])
        const sumLbl = `합계 ${formatDist(running)}`; const stw = ctx.measureText(sumLbl).width
        ctx.font = 'bold 10px sans-serif'
        ctx.fillStyle = 'rgba(0,12,28,0.88)'; ctx.fillRect(cx2 + 10, cy2 - 16, stw + 10, 17)
        ctx.fillStyle = 'rgba(0,210,255,0.85)'; ctx.fillText(sumLbl, cx2 + 15, cy2 - 4)
      }
      ctx.setLineDash([])

      // 확정 점
      for (let i = 0; i < pts.length; i++) {
        const [sx, sy] = toScr(pts[i][0], pts[i][1])
        ctx.beginPath(); ctx.arc(sx, sy, i === 0 ? 5 : 3.5, 0, Math.PI * 2)
        ctx.fillStyle = i === 0 ? 'rgba(0,210,255,1)' : 'rgba(0,185,215,0.9)'; ctx.fill()
      }

      // cursor 포인트 + 스냅 강조
      if (!done && cursor) {
        const [sx, sy] = toScr(cursor[0], cursor[1])
        if (snapped) {
          // 노란 스냅 링
          ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(255,215,0,0.95)'; ctx.lineWidth = 2; ctx.stroke()
          ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(255,215,0,1)'; ctx.fill()
        } else {
          ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(0,210,255,0.65)'; ctx.fill()
        }
      }

      // 완료 시 총 거리 배너
      if (done && totalDist > 0) {
        ctx.font = 'bold 12px sans-serif'
        const lbl = `총 거리: ${formatDist(totalDist)}  (${pts.length - 1}구간)`
        const tw = ctx.measureText(lbl).width
        ctx.fillStyle = 'rgba(0,10,25,0.93)'; ctx.fillRect(W / 2 - tw / 2 - 12, H - 52, tw + 24, 28)
        ctx.fillStyle = 'rgba(0,210,255,1)'; ctx.textAlign = 'center'; ctx.fillText(lbl, W / 2, H - 33); ctx.textAlign = 'left'
        ctx.font = '9px sans-serif'; ctx.fillStyle = 'rgba(0,180,220,0.6)'
        ctx.fillText('클릭하면 새 측정 시작', W / 2 - ctx.measureText('클릭하면 새 측정 시작').width / 2 + 1, H - 20)
      }
    }

    // ── 범례 ──
    const ly = H - 20
    ctx.font = '10px sans-serif'; ctx.textAlign = 'left'
    if (selectedSiteIdx !== null) {
      const l = loops[selectedSiteIdx]
      ctx.strokeStyle = 'rgb(220,50,50)'; ctx.lineWidth = 2; ctx.setLineDash([5, 3])
      ctx.beginPath(); ctx.moveTo(10, ly); ctx.lineTo(32, ly); ctx.stroke(); ctx.setLineDash([])
      ctx.fillStyle = '#fca5a5'; ctx.fillText(`대지 ${l.area.toFixed(1)}m²`, 38, ly + 4)
    }
    if (selectedBldgIdx !== null) {
      const l = loops[selectedBldgIdx]
      ctx.strokeStyle = 'rgb(255,220,0)'; ctx.lineWidth = 2; ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(150, ly); ctx.lineTo(172, ly); ctx.stroke()
      ctx.fillStyle = '#fde68a'; ctx.fillText(`건물 ${l.area.toFixed(1)}m²`, 178, ly + 4)
    }

    // ── 통계 ──
    ctx.font = '9px sans-serif'; ctx.fillStyle = '#475569'; ctx.textAlign = 'left'
    ctx.fillText(`${loops.length} polygons  ×${zoom.toFixed(1)}`, 8, 14)
    ctx.fillStyle = '#334155'
    loops.slice(0, 5).forEach((l, i) => ctx.fillText(`[${i}] ${l.layer}  ${l.area.toFixed(1)}m²`, 8, 26 + i * 11))
  }, [segments, loops, getView, zoom, hoveredIdx, selectedSiteIdx, selectedBldgIdx, selectMode, measureMode, measureDone, measurePtsCnt, W, H])

  const drawRef = useRef<() => void>(() => {})
  useEffect(() => { drawRef.current = draw }, [draw])
  useEffect(() => { draw() }, [draw])

  // ── Wheel zoom ──
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top; const PAD = 32
    const zoomOld = zoomRef.current; const factor = Math.pow(2, -e.deltaY * 0.003)
    const zoomNew = clamp(zoomOld * factor, 0.05, 500); const ratio = zoomNew / zoomOld
    const { H: curH } = whRef.current
    panRef.current = {
      x: mx - PAD - (mx - PAD - panRef.current.x) * ratio,
      y: my - (curH - PAD) + (curH - PAD - my + panRef.current.y) * ratio,
    }
    zoomRef.current = zoomNew; drawRef.current(); setZoom(zoomNew)
  }, [])
  useEffect(() => {
    const el = containerRef.current; if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  // ── Mouse + Keyboard 이벤트 ──
  useEffect(() => {
    const el = containerRef.current; if (!el) return

    const scrToWorld = (sx: number, sy: number): [number, number] => {
      const b = bboxRef.current; if (!b) return [sx, sy]
      const [minX, minY, maxX, maxY] = b
      const { W: cW, H: cH } = whRef.current; const PAD = 32
      const baseSc = Math.min((cW - PAD * 2) / (maxX - minX || 1), (cH - PAD * 2) / (maxY - minY || 1))
      const sc = baseSc * zoomRef.current
      return [(sx - PAD - panRef.current.x) / sc + minX, (cH - PAD - sy + panRef.current.y) / sc + minY]
    }
    const doHitTest = (sx: number, sy: number): number => {
      const b = bboxRef.current; if (!b) return -1
      const [minX, minY, maxX, maxY] = b
      const { W: cW, H: cH } = whRef.current; const PAD = 32
      const baseSc = Math.min((cW - PAD * 2) / (maxX - minX || 1), (cH - PAD * 2) / (maxY - minY || 1))
      const sc = baseSc * zoomRef.current
      const [wx, wy] = [(sx - PAD - panRef.current.x) / sc + minX, (cH - PAD - sy + panRef.current.y) / sc + minY]
      const loops = loopsRef.current; const et = 10 / sc
      let ei = -1, ed = et
      for (let i = 0; i < loops.length; i++) { const d = minEdgeDist(wx, wy, loops[i].pts); if (d < ed) { ed = d; ei = i } }
      if (ei >= 0) return ei
      let si = -1, sa = Infinity
      for (let i = 0; i < loops.length; i++) {
        if (pointInPolygon(wx, wy, loops[i].pts) && loops[i].area < sa) { sa = loops[i].area; si = i }
      }
      return si
    }

    // 더블클릭 감지용 (mouseup 기준)
    let lastUpMs = 0

    // 측정 cursor 업데이트 헬퍼
    const updateMeasureCursor = (clientX: number, clientY: number) => {
      const canvas = canvasRef.current; if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const [wx, wy] = scrToWorld(clientX - rect.left, clientY - rect.top)
      const sc = getScaleRef.current()
      const snap = findSnap(wx, wy, segmentsRef.current, loopsRef.current, sc)
      measureCursorRef.current = snap ?? [wx, wy]
      measureSnapRef.current = snap !== null
    }

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      // 측정 모드 포함 모든 경우: drag 감지 시작
      isDragging.current = true; dragMoved.current = false
      lastPos.current = { x: e.clientX, y: e.clientY }
    }
    const onMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const dx = e.clientX - lastPos.current.x, dy = e.clientY - lastPos.current.y
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true
        panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy }
        lastPos.current = { x: e.clientX, y: e.clientY }
        // 측정 모드이면 cursor도 pan에 맞춰 갱신
        if (measureModeRef.current && !measureDoneRef.current) updateMeasureCursor(e.clientX, e.clientY)
        drawRef.current(); return
      }
      // 비드래그 이동
      if (measureModeRef.current && !measureDoneRef.current) {
        updateMeasureCursor(e.clientX, e.clientY)
        drawRef.current(); return
      }
      if (!selectModeRef.current) return
      const canvas = canvasRef.current; if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const idx = doHitTest(e.clientX - rect.left, e.clientY - rect.top)
      setHoveredIdx(idx >= 0 ? idx : null)
    }
    const onUp = (e: MouseEvent) => {
      if (!isDragging.current) return
      isDragging.current = false

      if (measureModeRef.current) {
        if (dragMoved.current) return   // 드래그 pan만 → 점 찍지 않음

        // mouseup 기준 더블클릭 감지
        const canvas = canvasRef.current; if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const [wx, wy] = scrToWorld(e.clientX - rect.left, e.clientY - rect.top)
        const sc = getScaleRef.current()
        const snap = findSnap(wx, wy, segmentsRef.current, loopsRef.current, sc)
        const pt: [number, number] = snap ?? [wx, wy]

        const now = Date.now()
        const isDouble = now - lastUpMs < 300
        lastUpMs = now

        if (measureDoneRef.current) {
          // 완료 상태 → 초기화 후 새 시작점
          measurePtsRef.current = [pt]
          measureDoneRef.current = false; measureCursorRef.current = null; measureSnapRef.current = snap !== null
          setMeasureDone(false); setMeasurePtsCnt(1); drawRef.current(); return
        }

        if (isDouble && measurePtsRef.current.length > 0) {
          // 더블클릭: 직전 단일클릭으로 추가된 점 제거 후 완료
          measurePtsRef.current = measurePtsRef.current.slice(0, -1)
          measureCursorRef.current = null; measureDoneRef.current = true
          setMeasureDone(true); setMeasurePtsCnt(measurePtsRef.current.length); drawRef.current(); return
        }

        // 단일 클릭: 점 추가
        measurePtsRef.current = [...measurePtsRef.current, pt]
        measureSnapRef.current = snap !== null
        setMeasurePtsCnt(measurePtsRef.current.length); drawRef.current(); return
      }

      if (!dragMoved.current && selectModeRef.current) {
        const canvas = canvasRef.current; if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const idx = doHitTest(e.clientX - rect.left, e.clientY - rect.top)
        if (idx >= 0) {
          const loop = loopsRef.current[idx]
          if (selectModeRef.current === 'site') { setSelectedSiteIdx(idx); onSiteSelectRef.current?.(loop) }
          else { setSelectedBldgIdx(idx); onBldgSelectRef.current?.(loop) }
        }
      }
    }
    const onLeave = () => {
      if (measureModeRef.current) { measureCursorRef.current = null; drawRef.current(); return }
      setHoveredIdx(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (!measureModeRef.current) return
      if (e.key === 'Escape') {
        measurePtsRef.current = []; measureCursorRef.current = null
        measureSnapRef.current = false; measureDoneRef.current = false
        setMeasureDone(false); setMeasurePtsCnt(0); drawRef.current()
      }
    }

    el.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    el.addEventListener('mouseleave', onLeave)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      el.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // ── 스마트 맞춤 ──
  const resetView = useCallback(() => {
    const { W: curW, H: curH } = whRef.current; const PAD = 32
    const smart = getSmartBbox(segmentsRef.current, loopsRef.current); const b = bboxRef.current
    if (!smart || !b) { setZoom(1); panRef.current = { x: 0, y: 0 }; forceRender(n => n + 1); return }
    const [bx0, by0, bx1, by1] = b
    const baseSc = Math.min((curW - PAD * 2) / (bx1 - bx0 || 1), (curH - PAD * 2) / (by1 - by0 || 1))
    const [sx0, sy0, sx1, sy1] = smart
    const fitZoom = clamp(
      Math.min((curW - PAD * 2) / (sx1 - sx0 || 1) / baseSc, (curH - PAD * 2) / (sy1 - sy0 || 1) / baseSc) * 0.92,
      0.05, 500
    )
    const sc = baseSc * fitZoom
    panRef.current = { x: curW / 2 - PAD - ((sx0 + sx1) / 2 - bx0) * sc, y: curH / 2 - (curH - PAD) + ((sy0 + sy1) / 2 - by0) * sc }
    zoomRef.current = fitZoom; setZoom(fitZoom); forceRender(n => n + 1)
  }, [])

  const cursorStyle = measureMode ? 'crosshair'
    : selectMode ? (hoveredIdx !== null ? 'pointer' : 'crosshair') : 'grab'

  // 안내 문구
  const measureHint = measureDone
    ? `총 ${measurePtsCnt - 1}구간 측정 완료 — 클릭으로 새 측정 · ESC 초기화`
    : measurePtsCnt === 0
      ? '시작점을 클릭하세요 (코너에 자동 스냅)'
      : `${measurePtsCnt}점 — 계속 클릭해 선을 이어가세요 · 더블클릭 완료 · ESC 초기화`

  return (
    <div className="flex flex-col bg-[#1A202C]" style={{ width: W }}>
      {/* 컨트롤 바 */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-700 gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setSelectMode(m => m === 'site' ? null : 'site'); setHoveredIdx(null); setMeasureMode(false) }}
            className={`h-6 px-2 rounded text-[10px] font-medium transition-colors ${selectMode === 'site' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >대지경계 선택</button>
          <button
            onClick={() => { setSelectMode(m => m === 'bldg' ? null : 'bldg'); setHoveredIdx(null); setMeasureMode(false) }}
            className={`h-6 px-2 rounded text-[10px] font-medium transition-colors ${selectMode === 'bldg' ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >건물외곽 선택</button>
          <button
            onClick={() => {
              const next = !measureMode
              setMeasureMode(next)
              if (next) { setSelectMode(null); setHoveredIdx(null) }
              else { resetMeasure(); drawRef.current() }
            }}
            className={`h-6 px-2 rounded text-[10px] font-medium transition-colors ${measureMode ? 'bg-cyan-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >거리 측정</button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => clamp(z / 1.25, 0.05, 500))}
            className="w-6 h-6 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm flex items-center justify-center">−</button>
          <button onClick={resetView}
            className="h-6 px-1.5 rounded bg-slate-700 text-[10px] text-slate-300 hover:bg-slate-600 font-mono min-w-[38px] text-center">맞춤</button>
          <button onClick={() => setZoom(z => clamp(z * 1.25, 0.05, 500))}
            className="w-6 h-6 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm flex items-center justify-center">+</button>
        </div>
      </div>

      {/* 모드 안내 */}
      {selectMode && (
        <div className={`px-3 py-1 text-[10px] text-center ${selectMode === 'site' ? 'bg-red-900/40 text-red-200' : 'bg-yellow-900/40 text-yellow-200'}`}>
          {selectMode === 'site' ? '대지경계선으로 사용할 폴리곤을 클릭하세요' : '건물외곽선으로 사용할 폴리곤을 클릭하세요'}
        </div>
      )}
      {measureMode && (
        <div className="px-3 py-1 text-[10px] text-center bg-cyan-900/40 text-cyan-200">{measureHint}</div>
      )}

      {/* 캔버스 */}
      <div ref={containerRef} style={{ width: W, height: H, cursor: cursorStyle, userSelect: 'none' }}>
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
