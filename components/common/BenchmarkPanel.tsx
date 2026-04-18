'use client'

// 유사 프로젝트 벤치마크 — /bid, /projects/new, 프로젝트 상세에서 재사용 가능
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, TrendingUp, Users, Calendar, ChevronRight, Loader2, Target } from 'lucide-react'

export interface BenchmarkQuery {
  type?: string
  ground?: number
  basement?: number
  bldgArea?: number
}

interface BenchmarkResult {
  id: string
  name: string
  type?: string
  ground: number
  basement: number
  bldgArea?: number
  lastCpmDuration?: number
  totalManDays: number
  reportCount: number
  similarityScore: number
  topTrades: { trade: string; manDays: number }[]
}

interface Aggregate {
  count: number
  avgDuration: number
  avgManDays: number
  avgArea: number
}

interface Props {
  query: BenchmarkQuery
  /** 최소 유사도 점수 (기본 20) */
  minScore?: number
  /** limit (기본 5) */
  limit?: number
  compact?: boolean
}

export default function BenchmarkPanel({ query, limit = 5, compact }: Props) {
  const [results, setResults] = useState<BenchmarkResult[]>([])
  const [aggregate, setAggregate] = useState<Aggregate | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.type && query.ground === undefined && query.bldgArea === undefined) {
      setResults([])
      setAggregate(null)
      return
    }
    setLoading(true)
    const params = new URLSearchParams()
    if (query.type) params.set('type', query.type)
    if (query.ground !== undefined) params.set('ground', String(query.ground))
    if (query.basement !== undefined) params.set('basement', String(query.basement))
    if (query.bldgArea !== undefined) params.set('bldgArea', String(query.bldgArea))
    params.set('limit', String(limit))
    fetch(`/api/benchmark?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        setResults(data.results ?? [])
        setAggregate(data.aggregate ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [query.type, query.ground, query.basement, query.bldgArea, limit])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-2 text-xs text-gray-500">
        <Loader2 size={12} className="animate-spin" /> 유사 프로젝트 탐색 중...
      </div>
    )
  }

  if (results.length === 0) {
    return null
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-bold text-gray-900 flex items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
          <Target size={14} className="text-blue-600" /> 유사 과거 프로젝트 벤치마크
        </h3>
        <span className="text-[10px] text-gray-400">{results.length}건</span>
      </div>

      {/* 집계 */}
      {aggregate && aggregate.count >= 2 && (
        <div className="mb-3 bg-blue-50 border border-blue-100 rounded-lg p-3 grid grid-cols-3 gap-2">
          <div>
            <p className="text-[9px] text-blue-700 font-bold uppercase tracking-wider">평균 공기</p>
            <p className="text-sm font-bold text-blue-900 font-mono">{aggregate.avgDuration}일</p>
          </div>
          <div>
            <p className="text-[9px] text-blue-700 font-bold uppercase tracking-wider">평균 투입</p>
            <p className="text-sm font-bold text-blue-900 font-mono">{aggregate.avgManDays.toLocaleString()}인일</p>
          </div>
          <div>
            <p className="text-[9px] text-blue-700 font-bold uppercase tracking-wider">평균 연면적</p>
            <p className="text-sm font-bold text-blue-900 font-mono">{aggregate.avgArea.toLocaleString()}㎡</p>
          </div>
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        {results.map(r => (
          <li key={r.id} className="py-2">
            <Link href={`/projects/${r.id}`} className="flex items-center gap-3 group no-underline">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white flex-shrink-0">
                <Building2 size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-gray-900 truncate group-hover:text-blue-700">{r.name}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    r.similarityScore >= 80 ? 'bg-emerald-100 text-emerald-700' :
                    r.similarityScore >= 60 ? 'bg-blue-100 text-blue-700' :
                    r.similarityScore >= 40 ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>{r.similarityScore}%</span>
                </div>
                <p className="text-[10px] text-gray-500 truncate mt-0.5">
                  {r.type ? `${r.type} · ` : ''}
                  {r.ground}F{r.basement > 0 ? `/B${r.basement}F` : ''}
                  {r.bldgArea ? ` · ${r.bldgArea.toLocaleString()}㎡` : ''}
                  {r.reportCount > 0 ? ` · 일보 ${r.reportCount}건` : ''}
                </p>
              </div>
              <div className="text-right text-[10px] flex-shrink-0 hidden sm:block">
                {r.lastCpmDuration ? (
                  <div className="text-blue-700 font-mono font-bold">{r.lastCpmDuration}일</div>
                ) : null}
                {r.totalManDays > 0 && (
                  <div className="text-gray-500 font-mono">{r.totalManDays.toLocaleString()}인일</div>
                )}
              </div>
              <ChevronRight size={12} className="text-gray-300 group-hover:text-blue-600 flex-shrink-0" />
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-[10px] text-gray-400 mt-2 text-center">
        유형 · 층수 · 연면적 기반 유사도 자동 계산
      </p>
    </div>
  )
}
