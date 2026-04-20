'use client'

// ═══════════════════════════════════════════════════════════
// F4. Productivity Variance Dashboard
//   회사 표준(CompanyStandardProductivity) 대비 일보 관측치 편차 TOP N
//   |z| ≥ 2.0 이 30일 내 3회 이상이면 자동 제안 생성 버튼 노출
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import {
  AlertTriangle, TrendingUp, TrendingDown, Zap, Loader2, RefreshCw,
  ChevronDown, ChevronUp, Plus,
} from 'lucide-react'

interface VarianceRow {
  trade: string
  unit: string
  observationCount: number
  avgObserved: number
  companyStandard: number | null
  avgZScore: number
  maxAbsZScore: number
  flaggedCount: number
  lastObservedAt: string
}

export default function ProductivityVariancePanel({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<VarianceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState<number>(30)
  const [expanded, setExpanded] = useState(false)
  const [proposing, setProposing] = useState(false)
  const [proposeResult, setProposeResult] = useState<{ created: number; skipped: number } | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/projects/${projectId}/productivity/variance?period=${days}d`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const json = await r.json()
      setRows(json.summary ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패')
    } finally { setLoading(false) }
  }

  async function autoPropose() {
    setProposing(true); setProposeResult(null)
    try {
      const r = await fetch(`/api/projects/${projectId}/productivity/auto-propose`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const json = await r.json()
      setProposeResult(json)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '자동 제안 실패')
    } finally { setProposing(false) }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId, days])

  const top = rows.slice(0, expanded ? rows.length : 5)

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-800">생산성 편차 대시보드</h3>
          <span className="text-[11px] text-slate-400">회사 표준 대비 |z-score|</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="h-8 px-2 bg-white border border-slate-200 rounded text-xs"
          >
            <option value={7}>최근 7일</option>
            <option value={30}>최근 30일</option>
            <option value={90}>최근 90일</option>
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="h-8 px-2 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-600 inline-flex items-center gap-1"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 새로고침
          </button>
          <button
            onClick={autoPropose}
            disabled={proposing || rows.length === 0}
            className="h-8 px-3 rounded bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
          >
            {proposing ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            자동 제안 생성
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {proposeResult && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          <strong className="font-semibold">자동 제안 결과:</strong> {proposeResult.created}건 생성 · {proposeResult.skipped}건 스킵
          <span className="ml-1 text-amber-600">(승인 대기 상태로 `/admin/productivity`에서 검토)</span>
        </div>
      )}

      {/* 요약 통계 */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="관측 공종" value={rows.length} unit="종" color="blue" />
          <StatCard label="표준 매칭" value={rows.filter(r => r.companyStandard !== null).length} unit="종" color="emerald" />
          <StatCard label="Flagged" value={rows.filter(r => r.maxAbsZScore >= 1.5).length} unit="건" color="amber" />
          <StatCard label="|z| ≥ 2.0" value={rows.filter(r => r.maxAbsZScore >= 2.0).length} unit="건" color="red" />
        </div>
      )}

      {/* TOP 5 표 */}
      {loading ? (
        <div className="p-6 text-center text-xs text-slate-400">
          <Loader2 size={14} className="animate-spin mx-auto mb-2" />
          편차 데이터 분석 중...
        </div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
          최근 {days}일 내 관측 데이터 없음. 일보를 입력하면 자동으로 편차가 집계됩니다.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-800 flex items-center justify-between">
            <span>편차 TOP {expanded ? rows.length : Math.min(5, rows.length)}</span>
            {rows.length > 5 && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5"
              >
                {expanded ? '접기' : `전체 ${rows.length}개 보기`}
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-xs text-slate-500">
                <th className="text-left px-3 py-2 font-semibold">공종</th>
                <th className="text-right px-3 py-2 font-semibold">표준</th>
                <th className="text-right px-3 py-2 font-semibold">관측 평균</th>
                <th className="text-right px-3 py-2 font-semibold">|z| 최대</th>
                <th className="text-center px-3 py-2 font-semibold">경향</th>
                <th className="text-right px-3 py-2 font-semibold">관측수</th>
                <th className="text-left px-3 py-2 font-semibold">최근</th>
              </tr>
            </thead>
            <tbody>
              {top.map(r => {
                const hi = r.maxAbsZScore >= 2.0
                const mid = !hi && r.maxAbsZScore >= 1.5
                const trending = r.avgZScore
                return (
                  <tr key={r.trade + r.unit} className={`border-t border-slate-100 ${
                    hi ? 'bg-red-50/40' : mid ? 'bg-amber-50/30' : ''
                  }`}>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {r.trade}
                      <span className="text-[10px] text-slate-400 ml-1.5">{r.unit}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600 font-mono">
                      {r.companyStandard != null ? r.companyStandard.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-800 font-mono font-semibold">
                      {r.avgObserved.toFixed(1)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${
                      hi ? 'text-red-600' : mid ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                      {r.maxAbsZScore.toFixed(2)}
                      {hi && <AlertTriangle size={10} className="inline ml-1" />}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {trending > 0.5 ? (
                        <TrendingUp size={14} className="inline text-red-500" />
                      ) : trending < -0.5 ? (
                        <TrendingDown size={14} className="inline text-emerald-500" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500 font-mono text-xs">
                      {r.observationCount}
                      {r.flaggedCount > 0 && (
                        <span className="text-red-600 ml-1">({r.flaggedCount}⚠)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 font-mono">
                      {r.lastObservedAt}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        ※ 표준편차는 회사 표준값의 30%로 근사 (실제 히스토리 축적 후 정식 표준편차로 개선 예정).
        |z| ≥ 2.0 가 {days}일 내 3회 이상 관측되면 &ldquo;자동 제안&rdquo; 버튼으로 ProductivityProposal 생성 → /admin/productivity 에서 검토.
      </p>
    </div>
  )
}

function StatCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: 'blue'|'emerald'|'amber'|'red' }) {
  const clr = {
    blue:    'border-blue-200 bg-blue-50/40 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50/40 text-emerald-700',
    amber:   'border-amber-200 bg-amber-50/40 text-amber-700',
    red:     'border-red-200 bg-red-50/40 text-red-700',
  }[color]
  return (
    <div className={`rounded-lg border px-3 py-2 ${clr}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-xl font-bold tabular-nums">
        {value} <span className="text-xs font-normal">{unit}</span>
      </div>
    </div>
  )
}
