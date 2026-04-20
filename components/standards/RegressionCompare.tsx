'use client'

// ═══════════════════════════════════════════════════════════
// F18. Internal Regression Calibration UI
//   국토부 2026 회귀식 vs 자사 실적 회귀식 overlay 비교
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Loader2, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { REGRESSION_FORMULAS } from '@/lib/engine/guideline-data/regression'

interface InternalReg {
  projectType: string
  coefficients: { slope: number; intercept: number }
  sampleSize: number
  rSquared: number
  trainedAt: string
  curveSamples: { x: number; y: number }[]
}

export default function RegressionCompare() {
  const [projectType, setProjectType] = useState<string>('공동주택')
  const [internal, setInternal] = useState<InternalReg | null>(null)
  const [loading, setLoading] = useState(false)
  const [training, setTraining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const govFormula = REGRESSION_FORMULAS[projectType] ?? null

  async function load() {
    setLoading(true); setError(null); setInternal(null)
    try {
      const r = await fetch(`/api/standards/regression?type=${encodeURIComponent(projectType)}`)
      if (r.status === 404) { setInternal(null); return }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setInternal(await r.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패')
    } finally { setLoading(false) }
  }

  async function retrain() {
    setTraining(true); setError(null)
    try {
      const r = await fetch('/api/standards/regression', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: projectType }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${r.status}`)
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '재학습 실패')
    } finally { setTraining(false) }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectType])

  // Overlay 차트 samples (5000~150000 범위에서 10개씩)
  const { govCurve, intCurve, xMax, yMax } = useMemo(() => {
    const gov = govFormula ? Array.from({ length: 20 }, (_, i) => {
      const x = govFormula.range.min + i * ((govFormula.range.max - govFormula.range.min) / 19)
      return { x: Math.round(x), y: Math.round(govFormula.compute(x)) }
    }) : []
    const int = internal?.curveSamples ?? []
    const xm = Math.max(...gov.map(p => p.x), ...int.map(p => p.x), 100000)
    const ym = Math.max(...gov.map(p => p.y), ...int.map(p => p.y), 1000)
    return { govCurve: gov, intCurve: int, xMax: xm, yMax: ym }
  }, [govFormula, internal])

  // SVG 좌표 변환
  const W = 600, H = 320, PAD_L = 50, PAD_B = 30, PAD_T = 10, PAD_R = 20
  const chartW = W - PAD_L - PAD_R, chartH = H - PAD_T - PAD_B
  const xScale = (x: number) => PAD_L + (x / xMax) * chartW
  const yScale = (y: number) => PAD_T + chartH - (y / yMax) * chartH

  const govPath = govCurve.length > 1
    ? 'M ' + govCurve.map(p => `${xScale(p.x)},${yScale(p.y)}`).join(' L ')
    : ''
  const intPath = intCurve.length > 1
    ? 'M ' + intCurve.map(p => `${xScale(p.x)},${yScale(p.y)}`).join(' L ')
    : ''

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-800">공기 회귀식 — 국토부 참조 vs 자사 실적</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={projectType}
            onChange={e => setProjectType(e.target.value)}
            className="h-8 px-2 text-xs border border-slate-200 rounded bg-white"
          >
            {Object.keys(REGRESSION_FORMULAS).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
            <option value="all">전체 유형 (all)</option>
          </select>
          <button
            onClick={retrain}
            disabled={training}
            className="h-8 px-3 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
          >
            {training ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            자사 실적 재학습
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 국토부 */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wide mb-1">국토부 2026 참조</div>
          <div className="text-sm font-semibold text-slate-800 mb-1">{projectType}</div>
          {govFormula ? (
            <>
              <div className="font-mono text-lg font-bold text-blue-700 mb-2">
                {govFormula.formulaLabel}
              </div>
              <div className="text-[11px] text-slate-500">
                적용범위: {govFormula.range.min.toLocaleString()} ~ {govFormula.range.max.toLocaleString()} {govFormula.unit}
              </div>
              {govFormula.note && (
                <div className="text-[10px] text-slate-400 mt-1 italic">※ {govFormula.note}</div>
              )}
            </>
          ) : (
            <div className="text-xs text-slate-500">
              이 유형에 대한 국토부 회귀식 없음 (all 선택 시에는 참조 커브 없음).
            </div>
          )}
        </div>

        {/* 자사 실적 */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">자사 실적 (Internal)</div>
          <div className="text-sm font-semibold text-slate-800 mb-1">
            {projectType} · {internal ? `n=${internal.sampleSize}` : '준공 실적 0건'}
          </div>
          {loading ? (
            <div className="text-xs text-slate-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> 로드 중...</div>
          ) : internal ? (
            <>
              <div className="font-mono text-lg font-bold text-emerald-700 mb-2">
                공기(일) = {internal.coefficients.slope.toFixed(5)} × 연면적 + {internal.coefficients.intercept.toFixed(0)}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-3">
                <span>R² = <strong className="tabular-nums text-slate-700">{internal.rSquared.toFixed(3)}</strong></span>
                <span>학습일 {new Date(internal.trainedAt).toLocaleString('ko-KR')}</span>
                {internal.rSquared >= 0.7
                  ? <span className="inline-flex items-center gap-0.5 text-emerald-700"><CheckCircle2 size={10} /> 적합</span>
                  : <span className="text-amber-600">R² 낮음 — 표본 확대 필요</span>}
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500">
              아직 자사 실적 회귀식 없음. 준공 프로젝트의 <code className="bg-white px-1 py-0.5 rounded">actualDuration</code>을
              입력한 뒤 &ldquo;자사 실적 재학습&rdquo;을 누르세요 (최소 2개 필요).
            </div>
          )}
        </div>
      </div>

      {/* SVG 오버레이 차트 */}
      {(govCurve.length > 0 || intCurve.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-700 mb-2">연면적 → 공기 곡선 비교</div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
            {/* 축 */}
            <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#cbd5e1" />
            <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="#cbd5e1" />
            {/* Y 눈금 */}
            {[0, 0.25, 0.5, 0.75, 1].map(frac => {
              const yv = Math.round(yMax * frac)
              const py = yScale(yv)
              return (
                <g key={frac}>
                  <line x1={PAD_L - 3} y1={py} x2={PAD_L} y2={py} stroke="#94a3b8" />
                  <text x={PAD_L - 6} y={py + 3} fontSize="10" textAnchor="end" fill="#64748b">{yv}일</text>
                  <line x1={PAD_L} y1={py} x2={W - PAD_R} y2={py} stroke="#e2e8f0" strokeDasharray="2,2" />
                </g>
              )
            })}
            {/* X 눈금 */}
            {[0, 0.25, 0.5, 0.75, 1].map(frac => {
              const xv = Math.round(xMax * frac)
              const px = xScale(xv)
              return (
                <g key={frac}>
                  <line x1={px} y1={H - PAD_B} x2={px} y2={H - PAD_B + 3} stroke="#94a3b8" />
                  <text x={px} y={H - PAD_B + 15} fontSize="10" textAnchor="middle" fill="#64748b">
                    {(xv / 1000).toFixed(0)}k㎡
                  </text>
                </g>
              )
            })}
            {/* 국토부 곡선 */}
            {govPath && <path d={govPath} fill="none" stroke="#2563eb" strokeWidth="2" />}
            {govCurve.map((p, i) => (
              <circle key={`g${i}`} cx={xScale(p.x)} cy={yScale(p.y)} r="2" fill="#2563eb" />
            ))}
            {/* 자사 곡선 */}
            {intPath && <path d={intPath} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="6,3" />}
            {intCurve.map((p, i) => (
              <circle key={`i${i}`} cx={xScale(p.x)} cy={yScale(p.y)} r="2" fill="#10b981" />
            ))}
            {/* 범례 */}
            <g transform={`translate(${W - PAD_R - 140}, ${PAD_T + 10})`}>
              <line x1={0} y1={0} x2={20} y2={0} stroke="#2563eb" strokeWidth="2" />
              <text x={24} y={3} fontSize="10" fill="#1e40af">국토부 2026</text>
              {internal && (
                <>
                  <line x1={0} y1={16} x2={20} y2={16} stroke="#10b981" strokeWidth="2" strokeDasharray="6,3" />
                  <text x={24} y={19} fontSize="10" fill="#065f46">자사 실적 (n={internal.sampleSize})</text>
                </>
              )}
            </g>
          </svg>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        ※ 자사 회귀식 학습을 위해 준공 프로젝트마다 <strong>Project.actualCompletionDate · actualDuration</strong>을
        기록하세요. 표본 n ≥ 20 + R² ≥ 0.7 일 때 개략 견적에서 자사 곡선을 기본값으로 활용 가능 (현재는 참조값).
      </p>
    </div>
  )
}
