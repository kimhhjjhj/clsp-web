'use client'

import { useEffect, useState, useMemo } from 'react'
import { Database, CheckCircle2, Clock, Building2, TrendingUp, Filter } from 'lucide-react'
import { WBS_TRADE_MAP } from '@/lib/engine/wbs-trade-map'

interface Standard {
  id: string
  trade: string
  unit: string
  value: number
  sampleCount: number
  lastUpdated: string
}

interface Candidate {
  trade: string
  unit: string
  avgValue: number
  proposalCount: number
  totalSamples: number
  projectCount: number
}

interface CpmTask {
  taskId: string
  name: string
  category: string
  duration: number
  isCritical: boolean
}

interface Props {
  cpmTasks: CpmTask[] | null
}

export default function CompanyStandardsPanel({ cpmTasks }: Props) {
  const [standards, setStandards] = useState<Standard[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [unitFilter, setUnitFilter] = useState<'all' | 'man/day' | 'mandays/ton' | 'mandays/m3'>('all')

  useEffect(() => {
    setLoading(true)
    fetch('/api/company-standards?includeProposals=1')
      .then(r => r.json())
      .then(data => {
        setStandards(data.standards ?? [])
        setCandidates(data.candidates ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // trade+unit → { approved?, candidate? }
  const merged = useMemo(() => {
    const m = new Map<string, { trade: string; unit: string; approved?: Standard; candidate?: Candidate }>()
    for (const s of standards) {
      m.set(`${s.trade}|${s.unit}`, { trade: s.trade, unit: s.unit, approved: s })
    }
    for (const c of candidates) {
      const key = `${c.trade}|${c.unit}`
      const cur = m.get(key) ?? { trade: c.trade, unit: c.unit }
      cur.candidate = c
      m.set(key, cur)
    }
    const arr = Array.from(m.values())
    if (unitFilter !== 'all') return arr.filter(x => x.unit === unitFilter)
    return arr
  }, [standards, candidates, unitFilter])

  // 이 CPM에서 사용되는 trade 집합 (WBS_TRADE_MAP을 통해 역추적)
  const usedTrades = useMemo(() => {
    if (!cpmTasks) return new Set<string>()
    const set = new Set<string>()
    for (const t of cpmTasks) {
      const trades = WBS_TRADE_MAP[t.name] ?? []
      for (const tr of trades) set.add(tr)
    }
    return set
  }, [cpmTasks])

  const unitLabel = (unit: string) =>
    unit === 'man/day' ? '일평균 투입(명/일)'
    : unit === 'mandays/ton' ? '생산성(인일/톤)'
    : unit === 'mandays/m3' ? '생산성(인일/m³)'
    : unit

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">회사 표준 데이터를 불러오는 중...</p>
      </div>
    )
  }

  const approvedCount = standards.length
  const pendingCount = candidates.length - standards.length

  return (
    <div className="space-y-5">
      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase">
            <CheckCircle2 size={12} className="text-green-500" /> 승인된 표준
          </div>
          <p className="text-xl font-bold text-gray-900 mt-1">{approvedCount}개</p>
          <p className="text-[10px] text-gray-400 mt-0.5">CPM 참고값으로 확정됨</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase">
            <Clock size={12} className="text-amber-500" /> 승인 대기
          </div>
          <p className="text-xl font-bold text-gray-900 mt-1">{Math.max(0, pendingCount)}개</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            <a href="/admin/productivity" className="text-blue-600 hover:underline">관리자 페이지에서 승인</a>
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase">
            <Building2 size={12} className="text-blue-500" /> 현재 CPM 관련 공종
          </div>
          <p className="text-xl font-bold text-gray-900 mt-1">{usedTrades.size}개</p>
          <p className="text-[10px] text-gray-400 mt-0.5">WBS에서 사용되는 trade</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase">
            <TrendingUp size={12} className="text-purple-500" /> 총 활동일
          </div>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {candidates.reduce((s, c) => s + c.totalSamples, 0)}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">누적 샘플 수</p>
        </div>
      </div>

      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-900 flex items-start gap-2">
        <Database size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold mb-1">회사 실적 기반 생산성 표준</p>
          <p className="text-blue-700 leading-relaxed">
            과거 프로젝트 일보에서 자동 계산된 공종별 일평균 투입 인원과 생산성입니다.
            이 값은 새 프로젝트의 CPM 공기 산정 시 참고 자료로 활용되며,
            <span className="mx-1 font-semibold">승인된 값</span>만 공식 표준이 됩니다.
            현재 CPM에서 사용되는 공종은 <strong>주황색 배경</strong>으로 표시됩니다.
          </p>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-gray-400" />
        <span className="text-xs text-gray-500">단위:</span>
        {(['all', 'man/day', 'mandays/ton', 'mandays/m3'] as const).map(u => (
          <button
            key={u}
            onClick={() => setUnitFilter(u)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              unitFilter === u
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {u === 'all' ? '전체' : unitLabel(u)}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{merged.length}개 표시</span>
      </div>

      {/* 표준 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-10">상태</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">공종 (trade)</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">단위</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 w-28">승인 표준</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 w-28">제안 평균</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 w-20">프로젝트</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 w-24">총 샘플</th>
            </tr>
          </thead>
          <tbody>
            {merged.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-8 text-sm">
                  해당 단위의 데이터가 없습니다.
                </td>
              </tr>
            )}
            {merged.map(row => {
              const isUsed = usedTrades.has(row.trade)
              const approved = row.approved
              const cand = row.candidate
              return (
                <tr
                  key={`${row.trade}|${row.unit}`}
                  className={isUsed ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-gray-50'}
                >
                  <td className="px-4 py-2">
                    {approved ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                        <CheckCircle2 size={10} />승인
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        <Clock size={10} />대기
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {row.trade}
                    {isUsed && (
                      <span className="ml-1.5 text-[9px] bg-orange-500 text-white px-1 rounded">CPM 사용중</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">{unitLabel(row.unit)}</td>
                  <td className="text-right px-4 py-2 font-mono text-sm">
                    {approved ? (
                      <span className="font-bold text-green-700">{approved.value}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="text-right px-4 py-2 font-mono text-sm">
                    {cand ? (
                      <span className={approved ? 'text-gray-400' : 'text-amber-700 font-semibold'}>
                        {cand.avgValue}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="text-right px-4 py-2 text-xs text-gray-500">
                    {cand?.projectCount ?? (approved ? 1 : 0)}
                  </td>
                  <td className="text-right px-4 py-2 text-xs text-gray-500">
                    {cand?.totalSamples ?? approved?.sampleCount ?? 0}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* CPM 공종 → 관련 trade 매핑 표 */}
      {cpmTasks && cpmTasks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-900">WBS 공종 ↔ 회사 실적 매핑</h3>
            <p className="text-xs text-gray-500 mt-0.5">현재 CPM 공종이 회사 실적 DB의 어떤 trade와 연관되는지</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-t border-gray-100">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">WBS 공종</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">대분류</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 w-24">공기(일)</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">관련 trade</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 w-28">평균 투입(명/일)</th>
              </tr>
            </thead>
            <tbody>
              {cpmTasks.map(t => {
                const trades = WBS_TRADE_MAP[t.name] ?? []
                // 관련 trade 중 man/day 값 평균
                const manDayVals: number[] = []
                for (const tr of trades) {
                  const key = `${tr}|man/day`
                  const apr = standards.find(s => `${s.trade}|${s.unit}` === key)
                  const cnd = candidates.find(c => `${c.trade}|${c.unit}` === key)
                  if (apr) manDayVals.push(apr.value)
                  else if (cnd) manDayVals.push(cnd.avgValue)
                }
                const avgManDay = manDayVals.length
                  ? Math.round((manDayVals.reduce((a, b) => a + b, 0) / manDayVals.length) * 10) / 10
                  : null
                return (
                  <tr key={t.taskId} className={t.isCritical ? 'bg-orange-50' : ''}>
                    <td className="px-4 py-2 text-gray-900">
                      {t.name}
                      {t.isCritical && <span className="ml-1 text-[9px] bg-orange-500 text-white px-1 rounded">CP</span>}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{t.category}</td>
                    <td className="text-right px-4 py-2 font-mono text-xs text-gray-600">{t.duration}</td>
                    <td className="px-4 py-2">
                      {trades.length === 0 ? (
                        <span className="text-xs text-gray-400">매핑 없음</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {trades.map(tr => {
                            const hasStd = standards.some(s => s.trade === tr)
                            const hasCand = candidates.some(c => c.trade === tr)
                            return (
                              <span
                                key={tr}
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  hasStd
                                    ? 'bg-green-100 text-green-700'
                                    : hasCand
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-400'
                                }`}
                              >
                                {tr}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </td>
                    <td className="text-right px-4 py-2 font-mono text-sm">
                      {avgManDay !== null ? (
                        <span className="font-semibold text-blue-700">{avgManDay}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
