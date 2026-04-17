'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, FileCog, Loader2, Check, X } from 'lucide-react'

export interface DxfSegment {
  x1: number; y1: number; x2: number; y2: number
  layer: string
}

export interface DxfResult {
  site_area: number
  bldg_area: number
  site_perim: number
  bldg_perim: number
  segments: DxfSegment[]
  loops: { layer: string; pts: [number, number][]; area: number; perim: number }[]
  bbox: [number, number, number, number] | null
  highlightLayers: string[]
  designInfo?: {
    projectName?: string
    location?: string
    floors?: number
    notes?: string[]
  }
}

interface Props {
  onApply?: (values: { siteArea: number; bldgArea: number; sitePerim: number; bldgPerim: number }) => void
}

export default function DxfUpload({ onApply }: Props) {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<DxfResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    setResult(null)
    setApplied(false)
    setFileName(file.name)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/cad-parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '파싱 실패')
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }, [handleFile])

  // Canvas 렌더링
  useEffect(() => {
    if (!result) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.clientWidth || 600
    const H = 320
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(0, 0, W, H)

    if (!result.bbox || result.segments.length === 0) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('렌더링할 형상이 없습니다', W / 2, H / 2)
      return
    }

    const [minX, minY, maxX, maxY] = result.bbox
    const dx = maxX - minX, dy = maxY - minY
    const PAD = 20
    const scale = Math.min((W - PAD * 2) / (dx || 1), (H - PAD * 2) / (dy || 1))
    const ox = (W - dx * scale) / 2 - minX * scale
    // Y는 뒤집기 (Canvas y 아래→위 반전)
    const oy = (H + dy * scale) / 2 + minY * scale

    const toX = (x: number) => ox + x * scale
    const toY = (y: number) => oy - y * scale

    // 레이어별 색상
    const layerColor = (layer: string): string => {
      const l = layer.toLowerCase()
      if (l.includes('site')) return '#dc2626'
      if (l.includes('con') || l.includes('outline')) return '#2563eb'
      return '#94a3b8'
    }

    // 일반 segment
    ctx.lineWidth = 0.8
    for (const seg of result.segments) {
      const isHi = result.highlightLayers.includes(seg.layer)
      if (isHi) continue // 강조는 나중에 위에 그림
      ctx.strokeStyle = '#cbd5e1'
      ctx.beginPath()
      ctx.moveTo(toX(seg.x1), toY(seg.y1))
      ctx.lineTo(toX(seg.x2), toY(seg.y2))
      ctx.stroke()
    }
    // 강조 segment
    ctx.lineWidth = 2
    for (const seg of result.segments) {
      const isHi = result.highlightLayers.includes(seg.layer)
      if (!isHi) continue
      ctx.strokeStyle = layerColor(seg.layer)
      ctx.beginPath()
      ctx.moveTo(toX(seg.x1), toY(seg.y1))
      ctx.lineTo(toX(seg.x2), toY(seg.y2))
      ctx.stroke()
    }
    // 복원된 Loop (site/building)
    ctx.lineWidth = 1.2
    for (const loop of result.loops) {
      ctx.strokeStyle = layerColor(loop.layer)
      ctx.fillStyle = layerColor(loop.layer) + '15'
      ctx.beginPath()
      loop.pts.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(toX(x), toY(y))
        else ctx.lineTo(toX(x), toY(y))
      })
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }, [result])

  function apply() {
    if (!result || !onApply) return
    onApply({
      siteArea: Math.round(result.site_area * 100) / 100,
      bldgArea: Math.round(result.bldg_area * 100) / 100,
      sitePerim: Math.round(result.site_perim * 100) / 100,
      bldgPerim: Math.round(result.bldg_perim * 100) / 100,
    })
    setApplied(true)
  }

  return (
    <div className="space-y-3">
      {/* 업로드 영역 */}
      {!result && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" /> {fileName} 파싱 중...
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              <FileCog size={20} className="mx-auto mb-2 text-gray-400" />
              <p className="font-semibold">DXF 도면을 드래그하거나 클릭해 업로드</p>
              <p className="text-xs text-gray-400 mt-1">
                SITE/CON LINE 레이어를 자동 추출 — 대지·건물 면적·둘레 자동 계산 (최대 30MB)
              </p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".dxf"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }}
          />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
          ⚠ {error}
        </div>
      )}

      {result && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* 상단 바 */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <FileCog size={13} className="text-blue-600" />
              <span className="font-semibold">{fileName}</span>
              <span className="text-gray-400">· {result.segments.length.toLocaleString()} segment · {result.loops.length} loop</span>
            </div>
            <div className="flex gap-1.5">
              {onApply && (
                <button
                  type="button"
                  onClick={apply}
                  disabled={applied}
                  className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    applied
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {applied ? <><Check size={11} /> 적용됨</> : '이 값으로 프로젝트 적용'}
                </button>
              )}
              <button
                type="button"
                onClick={() => { setResult(null); setFileName(null); setApplied(false) }}
                className="p-1 text-gray-400 hover:text-red-600"
                title="초기화"
              ><X size={13} /></button>
            </div>
          </div>

          {/* 프리뷰 Canvas */}
          <canvas ref={canvasRef} style={{ width: '100%', display: 'block', background: '#fafafa' }} />

          {/* 물량 요약 */}
          <div className="grid grid-cols-4 gap-0 border-t border-gray-100">
            <Metric label="대지 면적" value={result.site_area} unit="m²" color="#dc2626" />
            <Metric label="대지 둘레" value={result.site_perim} unit="m" color="#dc2626" />
            <Metric label="건물 면적" value={result.bldg_area} unit="m²" color="#2563eb" />
            <Metric label="건물 둘레" value={result.bldg_perim} unit="m" color="#2563eb" />
          </div>

          {/* 디자인 정보 */}
          {result.designInfo && (result.designInfo.projectName || result.designInfo.floors || result.designInfo.location) && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-blue-50/30 text-xs text-blue-900 flex flex-wrap gap-3">
              {result.designInfo.projectName && <span><strong>프로젝트</strong>: {result.designInfo.projectName}</span>}
              {result.designInfo.location && <span><strong>위치</strong>: {result.designInfo.location}</span>}
              {result.designInfo.floors && <span><strong>층수</strong>: {result.designInfo.floors}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="px-4 py-3 border-r border-gray-100 last:border-r-0">
      <p className="text-[10px] font-semibold text-gray-400 uppercase">{label}</p>
      <p className="text-lg font-bold mt-0.5" style={{ color }}>
        {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        <span className="text-[10px] font-normal text-gray-400 ml-1">{unit}</span>
      </p>
    </div>
  )
}
