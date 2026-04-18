'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Users2, Search, X, Building2, Calendar, Wrench, Activity, Download,
  ChevronRight,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { Skeleton } from '@/components/common/Skeleton'

interface CompanyRow {
  company: string
  trades: { trade: string; manDays: number }[]
  projects: { id: string; name: string }[]
  totalManDays: number
  activeDays: number
  avgDaily: number
  firstDate: string
  lastDate: string
}

export default function CompaniesPage() {
  const [rows, setRows] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<CompanyRow | null>(null)

  useEffect(() => {
    fetch('/api/companies')
      .then(r => r.json())
      .then(data => {
        setRows(data.companies ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.company.toLowerCase().includes(q) ||
      r.trades.some(t => t.trade.toLowerCase().includes(q))
    )
  }, [rows, query])

  const totals = useMemo(() => ({
    companies: rows.length,
    manDays: rows.reduce((s, r) => s + r.totalManDays, 0),
    projects: new Set(rows.flatMap(r => r.projects.map(p => p.id))).size,
    tradesDistinct: new Set(rows.flatMap(r => r.trades.map(t => t.trade))).size,
  }), [rows])

  function downloadCsv() {
    const header = '협력사,대표공종,총인일,활동일,일평균,참여프로젝트수,최초투입,최근투입'
    const lines = filtered.map(r => [
      r.company,
      r.trades[0]?.trade ?? '',
      r.totalManDays,
      r.activeDays,
      r.avgDaily,
      r.projects.length,
      r.firstDate,
      r.lastDate,
    ].join(','))
    const csv = '\ufeff' + [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `companies-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={Users2}
        title="협력사"
        subtitle="일보 데이터에서 자동 추출된 거래 이력 · 투입 공종 · 참여 프로젝트"
        accent="slate"
        actions={
          <button
            onClick={downloadCsv}
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Download size={14} /> CSV 내보내기
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
        {/* 요약 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon={<Users2 size={14} className="text-blue-600" />} bg="bg-blue-50" label="전체 협력사" value={totals.companies} unit="개" />
          <Stat icon={<Activity size={14} className="text-emerald-600" />} bg="bg-emerald-50" label="누적 인일" value={totals.manDays.toLocaleString()} unit="인일" />
          <Stat icon={<Building2 size={14} className="text-purple-600" />} bg="bg-purple-50" label="참여 프로젝트" value={totals.projects} unit="개" />
          <Stat icon={<Wrench size={14} className="text-orange-600" />} bg="bg-orange-50" label="취급 공종" value={totals.tradesDistinct} unit="종" />
        </div>

        {/* 검색 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="협력사 또는 공종 검색"
              className="w-full pl-9 pr-8 h-9 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700">
                <X size={12} />
              </button>
            )}
          </div>
          <span className="ml-auto text-xs text-gray-500 hidden sm:block">
            {filtered.length} / {rows.length}개
          </span>
        </div>

        {/* 본문 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 목록 */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200">
                <EmptyState
                  icon={Users2}
                  title={rows.length === 0 ? '집계된 협력사가 없습니다' : '조건에 맞는 협력사가 없습니다'}
                  description={rows.length === 0 ? '일보에 투입인원(공종·회사·인원)을 기록하면 자동으로 여기에 집계됩니다.' : '다른 검색어를 시도해보세요.'}
                />
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {filtered.map(r => (
                  <button
                    key={r.company}
                    onClick={() => setSelected(r)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                      selected?.company === r.company ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {r.company.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{r.company}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {r.trades.slice(0, 3).map(t => t.trade).join(' · ')}
                        {r.trades.length > 3 && ` +${r.trades.length - 3}`}
                      </p>
                    </div>
                    <div className="text-right text-xs whitespace-nowrap hidden sm:block">
                      <div className="font-mono font-bold text-blue-700">{r.totalManDays.toLocaleString()} 인일</div>
                      <div className="text-gray-400">{r.activeDays}일 · 평균 {r.avgDaily}명</div>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 상세 */}
          <div>
            {selected ? (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-4">
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white font-bold">
                      {selected.company.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{selected.company}</h3>
                      <p className="text-[11px] text-gray-500">{selected.trades[0]?.trade ?? ''} 외 {selected.trades.length - 1}공종</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MiniStat label="누적 인일" value={`${selected.totalManDays.toLocaleString()}`} />
                    <MiniStat label="활동일" value={`${selected.activeDays}일`} />
                    <MiniStat label="일평균" value={`${selected.avgDaily}명`} />
                    <MiniStat label="참여 프로젝트" value={`${selected.projects.length}개`} />
                  </div>
                </div>

                <div className="p-4 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">공종별 투입</p>
                  <ul className="space-y-1.5">
                    {selected.trades.slice(0, 10).map(t => {
                      const ratio = (t.manDays / selected.totalManDays) * 100
                      return (
                        <li key={t.trade} className="text-xs">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-gray-700">{t.trade}</span>
                            <span className="font-mono font-semibold text-gray-900">{t.manDays.toLocaleString()}</span>
                          </div>
                          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${ratio}%` }} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <div className="p-4 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">참여 프로젝트</p>
                  <ul className="space-y-1">
                    {selected.projects.map(p => (
                      <li key={p.id}>
                        <Link
                          href={`/projects/${p.id}`}
                          className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-blue-700 hover:underline no-underline"
                        >
                          <Building2 size={11} className="text-gray-400" />
                          <span className="truncate">{p.name}</span>
                          <ChevronRight size={10} className="text-gray-300" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 flex items-center gap-3 text-[11px] text-gray-500">
                  <Calendar size={11} className="text-gray-400" />
                  <span>첫 투입 {selected.firstDate}</span>
                  <span className="text-gray-300">→</span>
                  <span>최근 {selected.lastDate}</span>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center text-xs text-gray-400">
                좌측 목록에서 협력사를 선택하세요
              </div>
            )}
          </div>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
      <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-gray-900">{value}</p>
    </div>
  )
}
