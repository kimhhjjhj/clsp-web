'use client'

// ═══════════════════════════════════════════════════════════
// 협력사 — 누가 어떤 공종을 얼마나 해봤나
// - 일수·참여 프로젝트 중심 (인일은 보조)
// - 좌: 리스트, 우: 상세 프로필
// ═══════════════════════════════════════════════════════════

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Users2, Search, X, Building2, Calendar, Wrench, Download, ChevronRight,
  Briefcase, Activity,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { Skeleton } from '@/components/common/Skeleton'

interface TradeRow { trade: string; manDays: number; days: number }
interface ProjectRow { id: string; name: string; manDays: number; days: number }

interface CompanyRow {
  company: string
  trades: TradeRow[]
  projects: ProjectRow[]
  totalManDays: number
  activeDays: number
  avgDaily: number
  firstDate: string
  lastDate: string
}

export default function CompaniesPageRoute() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">불러오는 중…</div>}>
      <CompaniesPage />
    </Suspense>
  )
}

function CompaniesPage() {
  const searchParams = useSearchParams()
  const initialQ = searchParams?.get('q') ?? ''

  const [rows, setRows] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState(initialQ)
  const [selected, setSelected] = useState<CompanyRow | null>(null)

  useEffect(() => {
    fetch('/api/companies')
      .then(r => r.json())
      .then(data => {
        const companies: CompanyRow[] = data.companies ?? []
        setRows(companies)
        // 쿼리 파라미터로 들어온 공종이 있으면 첫 번째 협력사 자동 선택
        if (initialQ && companies.length > 0) {
          const match = companies.find(c =>
            c.trades.some(t => t.trade.toLowerCase().includes(initialQ.toLowerCase()))
          )
          if (match) setSelected(match)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [initialQ])

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
    const header = '협력사,주력공종,총활동일,참여프로젝트수,하루평균,최초투입,최근투입'
    const lines = filtered.map(r => [
      r.company,
      r.trades[0]?.trade ?? '',
      r.activeDays,
      r.projects.length,
      r.avgDaily,
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
        subtitle="일보에서 자동 추출된 거래 이력 · 공종별 투입 실적 · 참여 프로젝트"
        accent="slate"
        actions={
          <button
            onClick={downloadCsv}
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} /> CSV
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon={<Users2 size={16} className="text-blue-600" />} bg="bg-blue-50" label="거래 협력사" value={totals.companies} unit="개" />
          <Stat icon={<Briefcase size={16} className="text-emerald-600" />} bg="bg-emerald-50" label="참여 프로젝트" value={totals.projects} unit="개" />
          <Stat icon={<Wrench size={16} className="text-orange-600" />} bg="bg-orange-50" label="취급 공종" value={totals.tradesDistinct} unit="종" />
          <Stat icon={<Activity size={16} className="text-violet-600" />} bg="bg-violet-50" label="총 투입" value={totals.manDays.toLocaleString()} unit="인일" />
        </div>

        {/* 검색 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="협력사·공종 검색 (예: 철근, 형틀)"
              className="w-full pl-9 pr-8 h-10 bg-white border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

        {/* 리스트 + 상세 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 목록 */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="card-elevated">
                <EmptyState
                  icon={Users2}
                  title={rows.length === 0 ? '집계된 협력사가 없습니다' : '검색 결과가 없습니다'}
                  description={rows.length === 0
                    ? '일보에 투입 인원(공종·회사·인원)을 기록하면 자동으로 여기에 집계됩니다.'
                    : '다른 검색어를 시도해보세요.'}
                  actions={rows.length === 0 ? [
                    { label: '엑셀 임포트', href: '/import', variant: 'primary' },
                  ] : [
                    { label: '검색 초기화', onClick: () => setQuery(''), variant: 'secondary' },
                  ]}
                />
              </div>
            ) : (
              <div className="card-elevated divide-y divide-gray-100 overflow-hidden">
                {filtered.map(r => (
                  <CompanyRow
                    key={r.company}
                    company={r}
                    selected={selected?.company === r.company}
                    onClick={() => setSelected(selected?.company === r.company ? null : r)}
                    highlightTrade={query.trim() || null}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 상세 */}
          <div className="lg:col-span-1">
            {selected ? (
              <CompanyDetail company={selected} onClose={() => setSelected(null)} />
            ) : (
              <div className="card-elevated p-5 text-center text-sm text-gray-500 sticky top-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Users2 size={20} className="text-slate-500" />
                </div>
                <p className="font-semibold text-gray-700">협력사를 선택하세요</p>
                <p className="text-xs text-gray-400 mt-1">
                  좌측 목록에서 클릭하면<br />상세 프로필이 여기에 표시됩니다
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────
// 협력사 리스트 행
// ────────────────────────────────────────────────
function CompanyRow({
  company: r, selected, onClick, highlightTrade,
}: {
  company: CompanyRow
  selected: boolean
  onClick: () => void
  highlightTrade: string | null
}) {
  const mainTrade = r.trades[0]
  const relatedTrade = highlightTrade
    ? r.trades.find(t => t.trade.toLowerCase().includes(highlightTrade.toLowerCase()))
    : null

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 hover:bg-blue-50/40 transition-colors flex items-center gap-3 ${
        selected ? 'bg-blue-50/60' : ''
      }`}
    >
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
        {r.company.slice(0, 2)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{r.company}</p>
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-500">
          <Wrench size={10} />
          <span>
            {relatedTrade && <span className="text-blue-700 font-semibold">{relatedTrade.trade}</span>}
            {relatedTrade && mainTrade && mainTrade.trade !== relatedTrade.trade && ' · '}
            {(!relatedTrade || mainTrade.trade !== relatedTrade.trade) && <>주력 {mainTrade?.trade ?? '—'}</>}
            {r.trades.length > 1 && <span className="text-gray-400"> 외 {r.trades.length - 1}종</span>}
          </span>
        </div>
      </div>
      <div className="text-right text-xs whitespace-nowrap hidden sm:block">
        <div className="font-bold text-gray-900 font-mono">
          {r.activeDays}<span className="text-[10px] text-gray-400 font-normal ml-0.5">일</span>
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5">{r.projects.length}개 현장</div>
      </div>
      <ChevronRight size={14} className={`text-gray-300 flex-shrink-0 transition-transform ${selected ? 'rotate-90' : ''}`} />
    </button>
  )
}

// ────────────────────────────────────────────────
// 협력사 상세 프로필
// ────────────────────────────────────────────────
function CompanyDetail({ company: r, onClose }: { company: CompanyRow; onClose: () => void }) {
  const periodDays = Math.max(1, Math.floor(
    (new Date(r.lastDate).getTime() - new Date(r.firstDate).getTime()) / 86400000
  ))
  const periodText = periodDays > 365
    ? `${Math.floor(periodDays / 365)}년 ${Math.floor((periodDays % 365) / 30)}개월`
    : periodDays > 30
      ? `${Math.floor(periodDays / 30)}개월`
      : `${periodDays}일`
  const maxTradeDays = Math.max(...r.trades.map(t => t.days), 1)

  return (
    <div className="card-elevated overflow-hidden sticky top-4">
      {/* 헤더 */}
      <div className="p-5 border-b border-gray-100 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 p-1"
          aria-label="닫기"
        >
          <X size={14} />
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow-md">
            {r.company.slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base truncate">{r.company}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {r.firstDate} ~ {r.lastDate} · {periodText} 거래
            </p>
          </div>
        </div>

        {/* 핵심 3지표 */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <MiniMetric label="활동일" value={r.activeDays} unit="일" color="text-blue-700 bg-blue-50" />
          <MiniMetric label="프로젝트" value={r.projects.length} unit="개" color="text-emerald-700 bg-emerald-50" />
          <MiniMetric label="하루평균" value={r.avgDaily} unit="명" color="text-orange-700 bg-orange-50" />
        </div>
      </div>

      {/* 주력 공종 TOP 5 */}
      <div className="p-5 border-b border-gray-100">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Wrench size={11} /> 주력 공종
        </h4>
        <div className="space-y-2">
          {r.trades.slice(0, 5).map((t) => {
            const ratio = (t.days / maxTradeDays) * 100
            return (
              <div key={t.trade}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-gray-800 truncate">{t.trade}</span>
                  <span className="text-gray-500 font-mono whitespace-nowrap ml-2">
                    {t.days}일
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full"
                    style={{ width: `${ratio}%` }}
                  />
                </div>
              </div>
            )
          })}
          {r.trades.length > 5 && (
            <p className="text-[10px] text-gray-400 text-center pt-1">외 {r.trades.length - 5}종</p>
          )}
        </div>
      </div>

      {/* 참여 프로젝트 */}
      <div className="p-5">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Briefcase size={11} /> 참여 프로젝트 ({r.projects.length})
        </h4>
        <div className="space-y-1.5">
          {r.projects.map(p => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-blue-50 transition-colors text-xs no-underline group"
            >
              <Building2 size={11} className="text-gray-400 flex-shrink-0" />
              <span className="flex-1 truncate text-gray-800 group-hover:text-blue-700">{p.name}</span>
              <span className="text-[10px] text-gray-400 font-mono">{p.days}일</span>
              <ChevronRight size={10} className="text-gray-300 group-hover:text-blue-600" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function MiniMetric({
  label, value, unit, color,
}: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className={`rounded-lg px-2.5 py-2 ${color}`}>
      <p className="text-[9px] font-semibold opacity-70 mb-0.5">{label}</p>
      <p className="text-base font-bold font-mono leading-none">
        {value}
        <span className="text-[10px] font-normal opacity-60 ml-0.5">{unit}</span>
      </p>
    </div>
  )
}

function Stat({
  label, value, unit, icon, bg,
}: { label: string; value: number | string; unit: string; icon: React.ReactNode; bg: string }) {
  return (
    <div className="card-elevated relative p-5 overflow-hidden">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg} ring-1 ring-inset ring-black/5`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900 tracking-tight leading-none">
        {value}
        <span className="text-base font-medium text-slate-400 ml-1.5">{unit}</span>
      </p>
    </div>
  )
}
