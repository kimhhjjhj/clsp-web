'use client'

// ═══════════════════════════════════════════════════════════
// 공법 비교 패널 — Top-down (역타) vs Bottom-up (순타)
//
// 사용: /bid 페이지 공기 탭의 '공법비교' 서브탭
// 입력: 현재 프로젝트의 ProjectInput (상위에서 전달)
// 동작: POST /api/bid/compare-methods 로 양 공법 실제 공기 + 추천 점수 수신
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { ArrowRight, TrendingDown, AlertTriangle, Info, Loader2 } from 'lucide-react'
import type { ProjectInput } from '@/lib/types'
import type { MethodRecommendation } from '@/lib/engine/method-recommender'

interface CompareResult {
  recommendation: MethodRecommendation
  durations: {
    bottomUp: number
    topDown: number
    deltaDays: number
    deltaPct: number
    fasterMethod: 'top_down' | 'bottom_up' | 'neutral'
  }
  stats: {
    bottomUp: { taskCount: number; criticalCount: number }
    topDown:  { taskCount: number; criticalCount: number }
  }
  input: ProjectInput
}

export default function MethodComparisonPanel({ input }: { input: Partial<ProjectInput> }) {
  const [result, setResult]   = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function run() {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/bid/compare-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const json = await r.json()
      setResult(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : '비교 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { run() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  if (loading && !result) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> 공법별 개략 공기 계산 중…
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
        비교 실패: {error}
        <button onClick={run} className="ml-3 underline">다시 시도</button>
      </div>
    )
  }
  if (!result) return null

  const { recommendation: rec, durations: d, stats } = result
  const recMethod = rec.recommended
  const faster    = d.fasterMethod

  return (
    <div className="p-4 space-y-4">
      {/* ── 상단 권고 카드 ── */}
      <div className={`rounded-xl border px-5 py-4 ${
        recMethod === 'top_down'
          ? 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200'
          : recMethod === 'bottom_up'
            ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
            : 'bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200'
      }`}>
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              recMethod === 'top_down'   ? 'bg-purple-600 text-white' :
              recMethod === 'bottom_up'  ? 'bg-emerald-600 text-white' :
              'bg-slate-500 text-white'
            }`}>추천</span>
            <h3 className="text-lg font-bold text-slate-900">
              {recMethod === 'top_down'
                ? 'Top-down (역타)'
                : recMethod === 'bottom_up'
                  ? 'Bottom-up (순타)'
                  : '중립 — 추가 검토 필요'}
            </h3>
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="text-xs px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50"
          >
            {loading ? '…' : '다시 분석'}
          </button>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{rec.rationale}</p>
      </div>

      {/* ── 점수 + 공기 비교 ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Top-down */}
        <div className={`rounded-xl border p-4 ${
          recMethod === 'top_down' ? 'border-purple-300 bg-purple-50/40' : 'border-slate-200 bg-white'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-purple-700">TOP-DOWN · 역타</div>
            <div className="text-[10px] text-slate-400">지하·지상 동시</div>
          </div>
          <div className="text-3xl font-bold text-slate-900 tabular-nums">
            {d.topDown.toLocaleString()} <span className="text-sm font-normal text-slate-500">일</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            공종 {stats.topDown.taskCount}개 · CP {stats.topDown.criticalCount}개
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">추천 점수</span>
            <span className="text-lg font-bold text-purple-600 tabular-nums">{rec.scores.topDown}</span>
          </div>
        </div>

        {/* Bottom-up */}
        <div className={`rounded-xl border p-4 ${
          recMethod === 'bottom_up' ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-emerald-700">BOTTOM-UP · 순타</div>
            <div className="text-[10px] text-slate-400">지하 완료 후 지상</div>
          </div>
          <div className="text-3xl font-bold text-slate-900 tabular-nums">
            {d.bottomUp.toLocaleString()} <span className="text-sm font-normal text-slate-500">일</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            공종 {stats.bottomUp.taskCount}개 · CP {stats.bottomUp.criticalCount}개
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">추천 점수</span>
            <span className="text-lg font-bold text-emerald-600 tabular-nums">{rec.scores.bottomUp}</span>
          </div>
        </div>
      </div>

      {/* ── 공기 델타 바 ── */}
      {d.bottomUp > 0 && d.topDown > 0 && Math.abs(d.deltaDays) > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={14} className="text-blue-600" />
            <span className="text-sm font-semibold text-slate-800">공기 차이</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
              faster === 'top_down'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {faster === 'top_down' ? 'Top-down이 빠름' : 'Bottom-up이 빠름'}
            </span>
            <span className="text-sm font-bold text-slate-900 ml-auto tabular-nums">
              {Math.abs(d.deltaDays)}일 ({Math.abs(d.deltaPct)}%) 단축
            </span>
          </div>
          {/* 간이 바 */}
          <BarRow label="Bottom-up" days={d.bottomUp} max={Math.max(d.bottomUp, d.topDown)} color="#10b981" />
          <BarRow label="Top-down" days={d.topDown}  max={Math.max(d.bottomUp, d.topDown)} color="#8b5cf6" />
        </div>
      )}

      {/* ── 항목별 근거 표 ── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Info size={13} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">항목별 판단 근거</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="text-xs text-gray-500">
              <th className="text-left px-3 py-2 font-semibold">항목</th>
              <th className="text-left px-3 py-2 font-semibold">값</th>
              <th className="text-center px-2 py-2 font-semibold text-purple-600">TD</th>
              <th className="text-center px-2 py-2 font-semibold text-emerald-600">BU</th>
              <th className="text-left px-3 py-2 font-semibold">해석</th>
            </tr>
          </thead>
          <tbody>
            {rec.factors.map((f, i) => {
              const tdWin = f.topDown > f.bottomUp
              const buWin = f.bottomUp > f.topDown
              return (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{f.label}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{f.value ?? '—'}</td>
                  <td className={`px-2 py-2 text-center font-mono font-semibold ${tdWin ? 'text-purple-600' : 'text-slate-400'}`}>
                    {f.topDown > 0 ? `+${f.topDown}` : '·'}
                  </td>
                  <td className={`px-2 py-2 text-center font-mono font-semibold ${buWin ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {f.bottomUp > 0 ? `+${f.bottomUp}` : '·'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{f.note}</td>
                </tr>
              )
            })}
            {rec.factors.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400 text-sm">
                  프로젝트 속성 입력이 부족합니다. 지하층수·연면적·지반 정보를 채워 주세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── 비용·리스크 메모 ── */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <div className="font-semibold text-amber-800 mb-1 flex items-center gap-1">
            <ArrowRight size={12} /> 비용 경향
          </div>
          <p className="text-slate-700 leading-relaxed">{rec.costNote}</p>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3">
          <div className="font-semibold text-rose-800 mb-1 flex items-center gap-1">
            <AlertTriangle size={12} /> 리스크
          </div>
          <p className="text-slate-700 leading-relaxed">{rec.riskNote}</p>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        ※ 본 추천은 프로젝트 속성 기반 규칙 판정입니다. 실제 선정은 발주처 요구·현장조건·시공사 역량을
        종합해 검토하시기 바랍니다.
      </p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
function BarRow({ label, days, max, color }: { label: string; days: number; max: number; color: string }) {
  const w = max > 0 ? Math.max(4, (days / max) * 100) : 0
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-slate-500 w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden relative">
        <div className="h-full transition-all" style={{ width: `${w}%`, background: color }} />
      </div>
      <span className="text-xs font-mono font-semibold text-slate-700 w-20 text-right tabular-nums">
        {days.toLocaleString()}일
      </span>
    </div>
  )
}
