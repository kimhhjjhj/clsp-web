'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ShieldAlert, TrendingUp, Search, X, Filter, Download,
  AlertTriangle, CheckCircle2, Clock, Building2, ChevronRight,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { SkeletonList } from '@/components/common/Skeleton'

interface RiskItem {
  id: string
  projectId: string
  projectName: string
  projectType?: string | null
  type: string           // 'risk' | 'opportunity'
  category: string
  content: string
  impactType: string
  impactDays: number | null
  impactCost: number | null
  probability: number
  response?: string | null
  owner?: string | null
  status: string
  createdAt: string
}

interface CategorySummary {
  category: string
  count: number
  riskCount: number
  oppCount: number
  avgImpactDays: number
}

const STATUS_LABEL: Record<string, string> = { identified: '식별', reviewing: '검토중', closed: '완료' }
const STATUS_COLOR: Record<string, string> = {
  identified: 'bg-orange-100 text-orange-700',
  reviewing: 'bg-blue-100 text-blue-700',
  closed: 'bg-emerald-100 text-emerald-700',
}

export default function RisksLibraryPage() {
  const [items, setItems] = useState<RiskItem[]>([])
  const [summary, setSummary] = useState<CategorySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'risk' | 'opportunity'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [projectTypeFilter, setProjectTypeFilter] = useState<string>('all')

  useEffect(() => {
    const params = new URLSearchParams()
    if (typeFilter !== 'all') params.set('type', typeFilter)
    fetch(`/api/risks-library?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        setItems(data.items ?? [])
        setSummary(data.categorySummary ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [typeFilter])

  const projectTypes = useMemo(() => {
    const s = new Set<string>()
    for (const i of items) if (i.projectType) s.add(i.projectType)
    return Array.from(s)
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(i => {
      if (categoryFilter !== 'all' && i.category !== categoryFilter) return false
      if (projectTypeFilter !== 'all' && i.projectType !== projectTypeFilter) return false
      if (!q) return true
      return (
        i.content.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.response?.toLowerCase().includes(q) ||
        i.projectName.toLowerCase().includes(q)
      )
    })
  }, [items, query, categoryFilter, projectTypeFilter])

  const stats = {
    total: items.length,
    risks: items.filter(i => i.type === 'risk').length,
    opps: items.filter(i => i.type === 'opportunity').length,
    avgImpact: items.length > 0
      ? Math.round((items.reduce((s, i) => s + (i.impactDays ?? 0), 0) / items.length) * 10) / 10
      : 0,
  }

  function downloadCsv() {
    const header = '프로젝트,유형,공종,내용,영향일수,확률,대응방안,상태'
    const lines = filtered.map(i => [
      i.projectName, i.type === 'risk' ? '리스크' : '기회',
      i.category, `"${(i.content ?? '').replace(/"/g, '""')}"`,
      i.impactDays ?? '', i.probability,
      `"${(i.response ?? '').replace(/"/g, '""')}"`,
      STATUS_LABEL[i.status] ?? i.status,
    ].join(','))
    const csv = '\ufeff' + [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `risks-library-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={ShieldAlert}
        title="R&O 라이브러리"
        subtitle="모든 프로젝트에서 축적된 리스크·기회 카드 · 신규 프로젝트 착수 시 참고"
        accent="amber"
        actions={
          <button
            onClick={downloadCsv}
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Download size={14} /> CSV
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon={<ShieldAlert size={14} className="text-red-600" />} bg="bg-red-50" label="전체" value={stats.total} unit="건" />
          <Stat icon={<AlertTriangle size={14} className="text-orange-600" />} bg="bg-orange-50" label="리스크" value={stats.risks} unit="건" />
          <Stat icon={<TrendingUp size={14} className="text-emerald-600" />} bg="bg-emerald-50" label="기회" value={stats.opps} unit="건" />
          <Stat icon={<Clock size={14} className="text-blue-600" />} bg="bg-blue-50" label="평균 영향" value={stats.avgImpact} unit="일" />
        </div>

        {/* 카테고리 요약 */}
        {summary.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">공종별 집계</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {summary.map(s => (
                <button
                  key={s.category}
                  onClick={() => setCategoryFilter(s.category === categoryFilter ? 'all' : s.category)}
                  className={`text-left rounded-lg px-3 py-2 border transition-colors ${
                    categoryFilter === s.category
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                  }`}
                >
                  <p className="text-xs font-bold text-gray-900 truncate">{s.category}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-600 mt-0.5">
                    <span className="text-red-600">⚠ {s.riskCount}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-emerald-600">▲ {s.oppCount}</span>
                    {s.avgImpactDays > 0 && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-500 font-mono">±{s.avgImpactDays}일</span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 검색·필터 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="내용·대응방안·프로젝트명 검색"
              className="w-full pl-9 pr-8 h-9 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="inline-flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
            {(['all', 'risk', 'opportunity'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`h-7 px-3 rounded text-xs font-semibold transition-colors ${
                  typeFilter === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >{t === 'all' ? '전체' : t === 'risk' ? '리스크' : '기회'}</button>
            ))}
          </div>

          {projectTypes.length > 0 && (
            <select
              value={projectTypeFilter}
              onChange={e => setProjectTypeFilter(e.target.value)}
              className="h-9 px-2 bg-white border border-gray-200 rounded-lg text-xs"
            >
              <option value="all">전체 유형</option>
              {projectTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}

          <span className="ml-auto text-xs text-gray-500 hidden sm:block">{filtered.length}건</span>
        </div>

        {/* 목록 */}
        {loading ? (
          <SkeletonList rows={6} />
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200">
            <EmptyState
              icon={ShieldAlert}
              title={items.length === 0 ? '등록된 R&O가 없습니다' : '조건에 맞는 결과가 없습니다'}
              description={items.length === 0
                ? '프로젝트 2단계 프리콘에서 리스크·기회를 등록하면 여기 전사 라이브러리에 축적됩니다.'
                : '검색어나 필터를 변경해보세요.'}
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {filtered.map(i => (
              <div key={i.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        i.type === 'risk' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {i.type === 'risk' ? '리스크' : '기회'}
                      </span>
                      <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{i.category}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_COLOR[i.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[i.status] ?? i.status}
                      </span>
                      {i.impactDays !== null && (
                        <span className="text-[10px] text-gray-500 font-mono">
                          {i.type === 'risk' ? '+' : '-'}{i.impactDays}일 · {i.probability}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 font-semibold">{i.content}</p>
                    {i.response && (
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="text-gray-400 font-semibold">대응: </span>
                        {i.response}
                      </p>
                    )}
                    <Link
                      href={`/projects/${i.projectId}`}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline no-underline mt-1.5"
                    >
                      <Building2 size={10} />
                      {i.projectName}
                      {i.projectType && <span className="text-gray-400">· {i.projectType}</span>}
                      <ChevronRight size={10} />
                    </Link>
                  </div>
                  {i.owner && (
                    <div className="text-[10px] text-gray-500 flex-shrink-0 hidden sm:block">
                      {i.owner}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
          <strong>활용 팁</strong>: 신규 프로젝트의 프리콘 착수 시 이 라이브러리를 검색 → 과거 유사 공종·유형에서 반복되는
          리스크를 미리 식별하고 대응방안까지 참고할 수 있습니다.
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon, bg, label, value, unit,
}: { icon: React.ReactNode; bg: string; label: string; value: number | string; unit: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <div className={`w-7 h-7 rounded-md ${bg} flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900">
        {value}<span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </p>
    </div>
  )
}
