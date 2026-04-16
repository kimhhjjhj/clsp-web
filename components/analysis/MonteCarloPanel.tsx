'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Loader2, BarChart3, TrendingUp, AlertTriangle, Info, ShieldCheck, TrendingDown } from 'lucide-react'

interface MonteCarloResult {
  durations: number[]
  original: number
  mean: number; median: number; stdDev: number
  min: number; max: number
  p10: number; p50: number; p80: number; p90: number; p95: number
  histogram: { bin: number; count: number }[]
}

type Dist = 'triangular' | 'normal' | 'uniform'

interface Props {
  projectId: string
  mode: 'cp' | 'full'
  hasCpmResult: boolean
  onResult?: (r: { original: number; mean: number; p80: number; p95: number; stdDev: number; iterations: number }) => void
}

export default function MonteCarloPanel({ projectId, mode, hasCpmResult, onResult }: Props) {
  const [iterations, setIterations] = useState(1000)
  const [variance,   setVariance]   = useState(20)
  const [dist,       setDist]       = useState<Dist>('triangular')
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState<MonteCarloResult | null>(null)

  async function run() {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/monte-carlo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iterations, variance: variance / 100, distribution: dist, mode }),
      })
      if (res.ok) {
        const data = await res.json()
        setResult(data)
        onResult?.({ original: data.original, mean: data.mean, p80: data.p80, p95: data.p95, stdDev: data.stdDev, iterations: data.durations?.length ?? iterations })
      }
    } finally { setLoading(false) }
  }

  const cv = result ? ((result.stdDev / result.mean) * 100) : 0
  const riskLevel = cv < 5 ? '낮음' : cv < 10 ? '보통' : cv < 15 ? '높음' : '매우 높음'
  const riskColor = cv < 5 ? 'text-green-600' : cv < 10 ? 'text-yellow-600' : cv < 15 ? 'text-orange-600' : 'text-red-600'
  const riskBg    = cv < 5 ? 'bg-green-50 border-green-200' : cv < 10 ? 'bg-yellow-50 border-yellow-200' : cv < 15 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'

  return (
    <div className="space-y-5">

      {/* ── 설정 ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-[#2563eb]" />
          시뮬레이션 설정
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">반복 횟수</label>
            <select value={iterations} onChange={e => setIterations(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
              {[100,500,1000,3000,5000,10000].map(n => <option key={n} value={n}>{n.toLocaleString()}회</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">변동 범위</label>
            <div className="mt-1 flex items-center gap-2">
              <input type="range" min={1} max={50} value={variance} onChange={e => setVariance(Number(e.target.value))} className="flex-1" />
              <span className="text-sm font-mono text-gray-700 w-12 text-right">±{variance}%</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">분포 유형</label>
            <select value={dist} onChange={e => setDist(e.target.value as Dist)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value="triangular">삼각 분포</option>
              <option value="normal">정규 분포</option>
              <option value="uniform">균일 분포</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={run} disabled={loading || !hasCpmResult}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#2563eb] text-white rounded-lg text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {loading ? '시뮬레이션 실행 중...' : '시뮬레이션 실행'}
          </button>
          {!hasCpmResult && (
            <p className="text-xs text-orange-600 flex items-center gap-1">
              <AlertTriangle size={12} /> WBS/CPM 계산을 먼저 실행해주세요
            </p>
          )}
        </div>
      </div>

      {/* ── 결과 ── */}
      {result && (
        <>
          {/* KPI 카드 */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: '원본 공기',  value: `${result.original}일`, sub: 'CPM 결과' },
              { label: '평균',       value: `${result.mean}일`,     sub: `중앙값 ${result.median}일` },
              { label: 'P80',        value: `${result.p80}일`,      sub: '80% 확률' },
              { label: 'P95',        value: `${result.p95}일`,      sub: '95% 확률 (권장)' },
              { label: '표준편차',   value: `${result.stdDev}일`,   sub: `CV ${cv.toFixed(1)}%` },
            ].map(k => (
              <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase">{k.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{k.value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* ── 히스토그램 + 분석 해석 (2컬럼) ── */}
          <div className="flex gap-4">

            {/* 왼쪽: 히스토그램 */}
            <div className="flex-1 bg-white border border-gray-200 rounded-xl p-5 min-w-0">
              {/* 제목 + 범례 (Canvas 밖) */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">공기 분포 히스토그램</h3>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 bg-green-500 inline-block" style={{ borderTop: '2px dashed #22c55e' }} />
                    <span className="text-gray-600">평균 <strong>{result.mean}일</strong></span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 bg-amber-500 inline-block" />
                    <span className="text-gray-600">P95 <strong>{result.p95}일</strong></span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
                    <span className="text-gray-500">안전 구간</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
                    <span className="text-gray-500">리스크 구간</span>
                  </span>
                </div>
              </div>
              <Histogram data={result} />
            </div>

            {/* 오른쪽: 분석 해석 */}
            <div className="w-72 flex-shrink-0 flex flex-col gap-3">

              {/* 리스크 수준 */}
              <div className={`border rounded-xl p-4 ${riskBg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={15} className={riskColor} />
                  <span className="text-xs font-bold text-gray-700">리스크 수준</span>
                </div>
                <p className={`text-2xl font-black ${riskColor}`}>{riskLevel}</p>
                <p className="text-[11px] text-gray-500 mt-1">변동계수 CV = {cv.toFixed(1)}%</p>
              </div>

              {/* 해석 내용 */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Info size={14} className="text-[#2563eb]" />
                  <span className="text-xs font-bold text-gray-700">분석 해석</span>
                </div>
                <div className="space-y-3 text-[12px] text-gray-700 leading-relaxed">
                  <div className="flex gap-2">
                    <span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                    <p>원본 CPM <strong className="text-gray-900">{result.original}일</strong> 대비 평균
                      <strong className={result.mean > result.original ? ' text-red-600' : ' text-green-600'}>
                        {' '}{result.mean > result.original ? '+' : ''}{(result.mean - result.original).toFixed(1)}일
                      </strong> 차이</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                    <p><strong>P80 {result.p80}일</strong> — 80% 확률로 이내 완공</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                    <p><strong>P95 {result.p95}일</strong> — 안전 마진 포함 권장 공기</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                    <p>편차 범위 {result.min}일 ~ {result.max}일<br />
                      <span className="text-gray-500">(최대 편차 {result.max - result.min}일)</span></p>
                  </div>
                  <div className={`mt-2 pt-3 border-t border-gray-100 text-[11px] ${riskColor} font-medium`}>
                    {cv < 5 && '✓ 공정 변동성이 매우 낮아 계획 공기 준수 가능성이 높습니다.'}
                    {cv >= 5  && cv < 10 && '⚠ 보통 수준의 변동성. P80 기준 공기 적용을 권장합니다.'}
                    {cv >= 10 && cv < 15 && '⚠ 변동성이 높습니다. P95 기준 공기와 리스크 관리 계획이 필요합니다.'}
                    {cv >= 15 && '⛔ 변동성이 매우 높습니다. 핵심 공정 재검토 및 완충 기간 확보가 필요합니다.'}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  )
}

// ── 히스토그램 Canvas (범례 없음) ─────────────────────────────
function Histogram({ data }: { data: MonteCarloResult }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 680, H = 280
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    canvas.style.width  = `${W}px`
    canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)

    const PL = 48, PR = 16, PT = 12, PB = 36
    const cw = W - PL - PR, ch = H - PT - PB
    const bins = data.histogram
    if (bins.length === 0) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    const maxCount = Math.max(...bins.map(b => b.count), 1)
    const barW = cw / bins.length

    // bars
    for (let i = 0; i < bins.length; i++) {
      const b = bins[i]
      const bh = (b.count / maxCount) * ch
      const x = PL + i * barW
      const y = PT + ch - bh
      ctx.fillStyle = b.bin <= data.p95 ? '#3b82f6' : '#ef4444'
      ctx.fillRect(x + 0.5, y, Math.max(1, barW - 1.5), bh)
    }

    // mean line (green dashed)
    const range = bins[bins.length - 1].bin - bins[0].bin || 1
    const meanX = PL + ((data.mean - bins[0].bin) / range) * cw
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2; ctx.setLineDash([5, 3])
    ctx.beginPath(); ctx.moveTo(meanX, PT); ctx.lineTo(meanX, PT + ch); ctx.stroke()
    ctx.setLineDash([])

    // P95 line (amber)
    const p95X = PL + ((data.p95 - bins[0].bin) / range) * cw
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(p95X, PT); ctx.lineTo(p95X, PT + ch); ctx.stroke()

    // axes
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(PL, PT + ch); ctx.lineTo(PL + cw, PT + ch); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(PL, PT); ctx.lineTo(PL, PT + ch); ctx.stroke()

    // y grid + labels
    ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
      const v = Math.round((maxCount / 4) * i)
      const y = PT + ch - (ch / 4) * i
      ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(PL + 1, y); ctx.lineTo(PL + cw, y); ctx.stroke()
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(`${v}`, PL - 6, y + 3)
    }

    // x labels
    ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'
    const step = Math.max(1, Math.floor(bins.length / 8))
    for (let i = 0; i < bins.length; i += step) {
      ctx.fillText(`${bins[i].bin}`, PL + i * barW + barW / 2, H - PB + 16)
    }
    ctx.textAlign = 'right'
    ctx.fillText('일', W - PR, H - PB + 16)
  }, [data])

  useEffect(() => { draw() }, [draw])

  return <canvas ref={canvasRef} style={{ maxWidth: '100%' }} />
}
