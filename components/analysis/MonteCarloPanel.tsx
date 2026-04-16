'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Loader2, BarChart3, TrendingUp, AlertTriangle, Info } from 'lucide-react'

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
  const [variance, setVariance] = useState(20)
  const [dist, setDist] = useState<Dist>('triangular')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MonteCarloResult | null>(null)

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

  return (
    <div className="space-y-6">
      {/* 설정 */}
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
              <option value={100}>100회</option>
              <option value={500}>500회</option>
              <option value={1000}>1,000회</option>
              <option value={3000}>3,000회</option>
              <option value={5000}>5,000회</option>
              <option value={10000}>10,000회</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">변동 범위</label>
            <div className="mt-1 flex items-center gap-2">
              <input type="range" min={1} max={50} value={variance} onChange={e => setVariance(Number(e.target.value))}
                className="flex-1" />
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
        <button onClick={run} disabled={loading || !hasCpmResult}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-[#2563eb] text-white rounded-lg text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {loading ? '시뮬레이션 실행 중...' : '시뮬레이션 실행'}
        </button>
        {!hasCpmResult && (
          <p className="mt-2 text-xs text-orange-600 flex items-center gap-1">
            <AlertTriangle size={12} /> WBS/CPM 계산을 먼저 실행해주세요
          </p>
        )}
      </div>

      {/* 결과 */}
      {result && (
        <>
          {/* KPI 카드 */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: '원본 공기', value: `${result.original}일`, sub: 'CPM 결과' },
              { label: '평균', value: `${result.mean}일`, sub: `중앙값 ${result.median}일` },
              { label: 'P80', value: `${result.p80}일`, sub: '80% 확률' },
              { label: 'P95', value: `${result.p95}일`, sub: '95% 확률 (권장)' },
              { label: '표준편차', value: `${result.stdDev}일`, sub: `CV ${cv.toFixed(1)}%` },
            ].map(k => (
              <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase">{k.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{k.value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* 히스토그램 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">공기 분포 히스토그램</h3>
            <Histogram data={result} />
          </div>

          {/* 해석 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Info size={14} className="text-[#2563eb]" />
              분석 해석
            </h3>
            <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
              <p>• 원본 CPM 공기 <strong>{result.original}일</strong> 대비 평균 시뮬레이션 공기 <strong>{result.mean}일</strong>
                ({result.mean > result.original ? '+' : ''}{(result.mean - result.original).toFixed(1)}일)</p>
              <p>• 변동계수(CV) = <strong>{cv.toFixed(1)}%</strong> → 리스크 수준: <span className={`font-bold ${riskColor}`}>{riskLevel}</span></p>
              <p>• P80 기준 공기: <strong>{result.p80}일</strong> (80% 확률로 이 이내 완공)</p>
              <p>• P95 기준 공기: <strong>{result.p95}일</strong> (95% 확률, 안전 마진 포함 권장치)</p>
              <p>• 범위: 최소 {result.min}일 ~ 최대 {result.max}일 (편차 {result.max - result.min}일)</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── 히스토그램 Canvas 컴포넌트 ──────────────────────────────

function Histogram({ data }: { data: MonteCarloResult }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 800, H = 300
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const PL = 55, PR = 20, PT = 20, PB = 40
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

      // color: below P95 = blue, above = red
      ctx.fillStyle = b.bin <= data.p95 ? '#3b82f6' : '#ef4444'
      ctx.fillRect(x, y, Math.max(1, barW - 1), bh)
    }

    // mean line (green dashed)
    const meanX = PL + ((data.mean - bins[0].bin) / (bins[bins.length - 1].bin - bins[0].bin || 1)) * cw
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2; ctx.setLineDash([5, 3])
    ctx.beginPath(); ctx.moveTo(meanX, PT); ctx.lineTo(meanX, PT + ch); ctx.stroke()
    ctx.setLineDash([])

    // P95 line (amber)
    const p95X = PL + ((data.p95 - bins[0].bin) / (bins[bins.length - 1].bin - bins[0].bin || 1)) * cw
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(p95X, PT); ctx.lineTo(p95X, PT + ch); ctx.stroke()

    // axes
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(PL, PT + ch); ctx.lineTo(PL + cw, PT + ch); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(PL, PT); ctx.lineTo(PL, PT + ch); ctx.stroke()

    // x labels
    ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'
    const step = Math.max(1, Math.floor(bins.length / 8))
    for (let i = 0; i < bins.length; i += step) {
      ctx.fillText(`${bins[i].bin}`, PL + i * barW + barW / 2, H - PB + 14)
    }
    ctx.fillText('일', W - PR, H - PB + 14)

    // y labels
    ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
      const v = Math.round((maxCount / 4) * i)
      const y = PT + ch - (ch / 4) * i
      ctx.fillText(`${v}`, PL - 6, y + 4)
    }

    // legend
    ctx.textAlign = 'left'; ctx.font = '11px sans-serif'
    ctx.fillStyle = '#22c55e'
    ctx.fillText(`▬ 평균 ${data.mean}일`, PL + 10, PT + 14)
    ctx.fillStyle = '#f59e0b'
    ctx.fillText(`▬ P95 ${data.p95}일`, PL + 140, PT + 14)
    ctx.fillStyle = '#3b82f6'; ctx.fillRect(PL + 270, PT + 6, 12, 10)
    ctx.fillStyle = '#64748b'; ctx.fillText('안전 구간', PL + 286, PT + 14)
    ctx.fillStyle = '#ef4444'; ctx.fillRect(PL + 360, PT + 6, 12, 10)
    ctx.fillStyle = '#64748b'; ctx.fillText('리스크 구간', PL + 376, PT + 14)
  }, [data])

  useEffect(() => { draw() }, [draw])

  return <canvas ref={canvasRef} style={{ width: 800, height: 300, maxWidth: '100%' }} />
}
