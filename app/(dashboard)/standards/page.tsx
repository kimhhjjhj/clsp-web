'use client'

// ═══════════════════════════════════════════════════════════
// 생산성 DB — 공종별 실전 벤치마크
// - '인일' 같은 엔지니어링 단위 대신 '평균 며칠', '하루 몇 명'
//   같은 현장 친화적 표현
// - 검색 + 정렬 + 카드 그리드
// - 공종 클릭 시 상세 패널 (협력사, 프로젝트)
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Database, Search, X, SortAsc, Users, Calendar, Building2,
  Download, ExternalLink, ChevronRight, TrendingUp, CheckCircle2, Clock, Inbox,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { Skeleton } from '@/components/common/Skeleton'

interface MonthlyPoint { month: string; manDays: number }
interface TradeInsight {
  trade: string
  category: string
  totalManDays: number
  activeDays: number
  companies: number
  projectCount: number
  avgDaily: number
  avgDaysPerProject: number
  mandaysPerSqm?: number | null
  mandaysPerFloor?: number | null
  daysPerFloor?: number | null
  monthlyTrend?: MonthlyPoint[]
}

const CATEGORIES = ['전체', '골조', '토목', '마감', '설비', '전기·통신', '가설·관리', '외부·조경', '기타'] as const
type CategoryFilter = typeof CATEGORIES[number]

const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  '골조':      { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  '토목':      { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  '마감':      { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  '설비':      { bg: 'bg-cyan-50',    text: 'text-cyan-700',    dot: 'bg-cyan-500' },
  '전기·통신':  { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  '가설·관리':  { bg: 'bg-slate-100',  text: 'text-slate-700',   dot: 'bg-slate-500' },
  '외부·조경':  { bg: 'bg-lime-50',    text: 'text-lime-700',    dot: 'bg-lime-500' },
  '기타':      { bg: 'bg-gray-100',   text: 'text-gray-600',    dot: 'bg-gray-400' },
}

interface ApiResponse {
  overall: {
    projectCount: number
    totalReports: number
    totalManDays: number
    uniqueTrades: number
    uniqueCompanies: number
  }
  topTrades: TradeInsight[]
}

type SortKey = 'frequency' | 'duration' | 'intensity' | 'name' | 'perFloor' | 'perSqm'

export default function StandardsPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('frequency')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('전체')
  const [selected, setSelected] = useState<TradeInsight | null>(null)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const trades = data?.topTrades ?? []

  // 카테고리별 개수 (필터 버튼에 표시)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { '전체': trades.length }
    for (const c of CATEGORIES) if (c !== '전체') counts[c] = 0
    for (const t of trades) counts[t.category] = (counts[t.category] ?? 0) + 1
    return counts
  }, [trades])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = trades.filter(t => {
      if (categoryFilter !== '전체' && t.category !== categoryFilter) return false
      if (q && !t.trade.toLowerCase().includes(q)) return false
      return true
    })
    return rows.sort((a, b) => {
      if (sortKey === 'name') return a.trade.localeCompare(b.trade, 'ko')
      if (sortKey === 'duration') return b.avgDaysPerProject - a.avgDaysPerProject
      if (sortKey === 'intensity') return b.avgDaily - a.avgDaily
      if (sortKey === 'perFloor') return (b.mandaysPerFloor ?? 0) - (a.mandaysPerFloor ?? 0)
      if (sortKey === 'perSqm') return (b.mandaysPerSqm ?? 0) - (a.mandaysPerSqm ?? 0)
      return b.totalManDays - a.totalManDays
    })
  }, [trades, query, sortKey, categoryFilter])

  function downloadCsv() {
    const header = '공종명,평균기간(일/프로젝트),하루평균투입(명),층당인일,층당활동일수,㎡당인일,참여프로젝트수,협력사수,총기록일'
    const lines = filtered.map(t => [
      t.trade, t.avgDaysPerProject, t.avgDaily,
      t.mandaysPerFloor ?? '', t.daysPerFloor ?? '', t.mandaysPerSqm ?? '',
      t.projectCount, t.companies, t.activeDays,
    ].join(','))
    const csv = '\ufeff' + [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `productivity-db-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={Database}
        title="생산성 DB"
        subtitle="공종별 실전 벤치마크 — 우리 회사 현장 데이터에서 뽑은 평균 기간·투입 규모"
        accent="blue"
        actions={
          <>
            <button
              onClick={downloadCsv}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/15 bg-white/5 text-sm font-semibold text-slate-200 hover:bg-white/10"
            >
              <Download size={14} /> CSV
            </button>
            <Link
              href="/admin/productivity"
              className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-lg bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100"
            >
              <ExternalLink size={13} /> <span className="hidden sm:inline">관리자 승인</span><span className="sm:hidden">승인</span>
            </Link>
          </>
        }
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat
            label="축적된 공종"
            value={data?.overall.uniqueTrades ?? 0}
            unit="종"
            icon={<TrendingUp size={16} className="text-blue-600" />}
            bg="bg-blue-50"
          />
          <Stat
            label="참여 프로젝트"
            value={data?.overall.projectCount ?? 0}
            unit="개"
            icon={<Building2 size={16} className="text-emerald-600" />}
            bg="bg-emerald-50"
          />
          <Stat
            label="현장 기록일"
            value={(data?.overall.totalReports ?? 0).toLocaleString()}
            unit="일"
            icon={<Calendar size={16} className="text-orange-600" />}
            bg="bg-orange-50"
          />
          <Stat
            label="거래 협력사"
            value={data?.overall.uniqueCompanies ?? 0}
            unit="개"
            icon={<Users size={16} className="text-violet-600" />}
            bg="bg-violet-50"
          />
        </div>

        {/* 카테고리 필터 탭 */}
        <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
          {CATEGORIES.map(c => {
            const active = categoryFilter === c
            const color = c === '전체' ? null : CATEGORY_COLORS[c]
            const count = categoryCounts[c] ?? 0
            return (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {color && <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />}
                {c}
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  active ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
                }`}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* 검색·정렬 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="공종명 검색 (예: 철근, 형틀, 창호)"
              className="w-full pl-9 pr-8 h-10 bg-white border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="inline-flex items-center gap-1 text-xs text-gray-500 ml-auto">
            <SortAsc size={12} className="text-gray-400" />
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              className="h-9 px-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="frequency">많이 수행된 순</option>
              <option value="duration">평균 기간 긴 순</option>
              <option value="intensity">투입 많은 순</option>
              <option value="perFloor">층당 인일 많은 순</option>
              <option value="perSqm">㎡당 인일 많은 순</option>
              <option value="name">이름순</option>
            </select>
          </div>
          <span className="text-xs text-gray-500 hidden sm:block">{filtered.length}종</span>
        </div>

        {/* 공종 카드 그리드 + 상세 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="card-elevated">
                <EmptyState
                  icon={Inbox}
                  title={trades.length === 0 ? '아직 축적된 공종 데이터가 없습니다' : '검색 결과가 없습니다'}
                  description={trades.length === 0
                    ? '프로젝트에 일보를 쌓으면 자동으로 공종별 벤치마크가 생성됩니다.'
                    : `"${query}"에 해당하는 공종이 없습니다. 다른 키워드로 검색해보세요.`}
                  actions={trades.length === 0 ? [
                    { label: '엑셀 일보 임포트', href: '/import', variant: 'primary' },
                  ] : [
                    { label: '검색 초기화', onClick: () => setQuery(''), variant: 'secondary' },
                  ]}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filtered.map(t => (
                  <TradeCard
                    key={t.trade}
                    trade={t}
                    selected={selected?.trade === t.trade}
                    onClick={() => setSelected(selected?.trade === t.trade ? null : t)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 우측 상세 패널 */}
          <div className="lg:col-span-1">
            {selected ? (
              <TradeDetail trade={selected} onClose={() => setSelected(null)} />
            ) : (
              <div className="card-elevated p-5 text-center text-sm text-gray-500 sticky top-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-violet-50 border border-blue-100/50 flex items-center justify-center mx-auto mb-3">
                  <Database size={20} className="text-blue-500" />
                </div>
                <p className="font-semibold text-gray-700">공종을 선택하세요</p>
                <p className="text-xs text-gray-400 mt-1">
                  카드를 클릭하면 해당 공종의<br />협력사·프로젝트 이력이 여기에 표시됩니다
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 설명 */}
        <div className="card-elevated p-4 text-xs text-gray-600 leading-relaxed">
          <p className="font-semibold text-gray-900 mb-1">💡 이 데이터는 어떻게 만들어지나요?</p>
          <p>
            모든 프로젝트의 <strong>공사 일보(투입 인원)</strong>에서 공종·협력사·투입 규모를 자동 집계합니다.
            프로젝트가 늘어날수록 더 정확한 벤치마크가 됩니다.
            신규 프로젝트의 CPM 산정 시 <strong>회사 표준</strong>으로 참조되며,
            관리자 승인을 거쳐 <Link href="/admin/productivity" className="text-blue-600 hover:underline">승인된 표준</Link>은 고정값으로 사용됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────
// 공종 카드 — 평균 기간·투입 규모 한눈에
// ────────────────────────────────────────────────
function TradeCard({
  trade: t, selected, onClick,
}: { trade: TradeInsight; selected: boolean; onClick: () => void }) {
  const color = CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS['기타']
  return (
    <button
      onClick={onClick}
      className={`card-elevated text-left p-4 transition-all ${selected ? 'ring-2 ring-blue-500' : 'hover:-translate-y-0.5'}`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${color.bg} ${color.text}`}>
          <span className={`w-1 h-1 rounded-full ${color.dot}`} />
          {t.category}
        </span>
        <span className="text-[10px] font-semibold text-gray-400 ml-auto">
          {t.projectCount}개 현장
        </span>
      </div>
      <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 mb-3">{t.trade}</h3>

      {/* 핵심 지표 2개 */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-blue-50/60 rounded-lg px-2.5 py-2">
          <p className="text-[10px] text-blue-700 font-semibold mb-0.5">평균 기간</p>
          <p className="text-lg font-bold text-blue-900 font-mono leading-none">
            {t.avgDaysPerProject}
            <span className="text-xs font-normal text-blue-500 ml-0.5">일</span>
          </p>
        </div>
        <div className="bg-emerald-50/60 rounded-lg px-2.5 py-2">
          <p className="text-[10px] text-emerald-700 font-semibold mb-0.5">하루 평균</p>
          <p className="text-lg font-bold text-emerald-900 font-mono leading-none">
            {t.avgDaily}
            <span className="text-xs font-normal text-emerald-500 ml-0.5">명</span>
          </p>
        </div>
      </div>

      {/* 실무 생산성 지표 — 층수·면적 기반 (참여 프로젝트 분모 합 기준 가중평균) */}
      {(t.mandaysPerFloor != null || t.mandaysPerSqm != null) && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          {t.mandaysPerFloor != null && (
            <div className="bg-amber-50/60 rounded-lg px-2.5 py-2">
              <p className="text-[10px] text-amber-700 font-semibold mb-0.5">층당 인일</p>
              <p className="text-lg font-bold text-amber-900 font-mono leading-none">
                {t.mandaysPerFloor}
                <span className="text-xs font-normal text-amber-500 ml-0.5">인일/층</span>
              </p>
            </div>
          )}
          {t.mandaysPerSqm != null && (
            <div className="bg-violet-50/60 rounded-lg px-2.5 py-2">
              <p className="text-[10px] text-violet-700 font-semibold mb-0.5">㎡당 인일</p>
              <p className="text-lg font-bold text-violet-900 font-mono leading-none">
                {t.mandaysPerSqm}
                <span className="text-xs font-normal text-violet-500 ml-0.5">인일/㎡</span>
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-100">
        <span className="flex items-center gap-1">
          <Users size={10} /> {t.companies}개 협력사
        </span>
        <span className="flex items-center gap-1 text-gray-400">
          <Calendar size={10} /> 누적 {t.activeDays}일
        </span>
      </div>
    </button>
  )
}

// ────────────────────────────────────────────────
// 공종 상세 패널
// ────────────────────────────────────────────────
function TradeDetail({ trade: t, onClose }: { trade: TradeInsight; onClose: () => void }) {
  return (
    <div className="card-elevated p-5 sticky top-4">
      <div className="flex items-start justify-between gap-2 mb-4">
        <h3 className="font-bold text-gray-900 text-base leading-tight flex-1">{t.trade}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 p-1 -mt-1 -mr-1"
          aria-label="닫기"
        >
          <X size={14} />
        </button>
      </div>

      {/* 핵심 지표 */}
      <div className="space-y-3 mb-5">
        <BigMetric label="프로젝트당 평균 기간" value={t.avgDaysPerProject} unit="일" color="text-blue-700" />
        <BigMetric label="하루 평균 투입 인원" value={t.avgDaily} unit="명" color="text-emerald-700" />
        {t.mandaysPerFloor != null && (
          <BigMetric label="층당 인일 (가중 평균)" value={t.mandaysPerFloor} unit="인일/층" color="text-amber-700" />
        )}
        {t.daysPerFloor != null && (
          <BigMetric label="층당 활동일수" value={t.daysPerFloor} unit="일/층" color="text-orange-700" />
        )}
        {t.mandaysPerSqm != null && (
          <BigMetric label="㎡당 인일" value={t.mandaysPerSqm} unit="인일/㎡" color="text-violet-700" />
        )}
      </div>

      {/* 세부 카운트 */}
      <dl className="grid grid-cols-2 gap-3 text-xs border-t border-gray-100 pt-4">
        <div>
          <dt className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">참여 프로젝트</dt>
          <dd className="font-bold text-gray-900 font-mono">{t.projectCount}개</dd>
        </div>
        <div>
          <dt className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">거래 협력사</dt>
          <dd className="font-bold text-gray-900 font-mono">{t.companies}개</dd>
        </div>
        <div>
          <dt className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">전사 누적 기록</dt>
          <dd className="font-bold text-gray-900 font-mono">{t.activeDays}일</dd>
        </div>
        <div>
          <dt className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">누적 투입</dt>
          <dd className="font-bold text-gray-900 font-mono">{t.totalManDays.toLocaleString()}<span className="text-[9px] text-gray-400 ml-0.5">인일</span></dd>
        </div>
      </dl>

      {/* 월별 트렌드 (데이터 2개월 이상일 때만) */}
      {t.monthlyTrend && t.monthlyTrend.length >= 2 && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
            월별 투입 추이
          </h4>
          <MonthlyTrendBars trend={t.monthlyTrend} />
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col gap-2">
        <Link
          href={`/analytics`}
          className="flex items-center justify-between text-xs text-blue-600 hover:bg-blue-50 rounded-md px-2 py-1.5 transition-colors no-underline"
        >
          <span>전사 분석에서 보기</span>
          <ChevronRight size={12} />
        </Link>
        <Link
          href={`/companies?q=${encodeURIComponent(t.trade)}`}
          className="flex items-center justify-between text-xs text-blue-600 hover:bg-blue-50 rounded-md px-2 py-1.5 transition-colors no-underline"
        >
          <span>이 공종 담당 협력사 찾기</span>
          <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  )
}

// 월별 막대 그래프 — 짧은 sparkline 스타일
function MonthlyTrendBars({ trend }: { trend: MonthlyPoint[] }) {
  const max = Math.max(...trend.map(p => p.manDays), 1)
  // 최대 24개월만 표시 (너무 길면 좁아짐)
  const visible = trend.length > 24 ? trend.slice(-24) : trend
  return (
    <div>
      <div className="flex items-end gap-[2px] h-16 bg-gray-50/50 rounded px-1.5 py-1">
        {visible.map(p => {
          const h = Math.max(4, (p.manDays / max) * 100)
          return (
            <div
              key={p.month}
              className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-sm min-w-[3px]"
              style={{ height: `${h}%` }}
              title={`${p.month} · ${p.manDays.toLocaleString()} 인일`}
            />
          )
        })}
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[9px] text-gray-400 font-mono">
        <span>{visible[0]?.month}</span>
        <span>{visible.length}개월 · 최대 {Math.round(max).toLocaleString()} 인일</span>
        <span>{visible[visible.length - 1]?.month}</span>
      </div>
    </div>
  )
}

function BigMetric({
  label, value, unit, color,
}: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="flex items-end justify-between gap-2 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xl font-bold font-mono ${color}`}>
        {value}
        <span className="text-xs font-normal text-gray-400 ml-1">{unit}</span>
      </span>
    </div>
  )
}

function Stat({
  label, value, unit, icon, bg,
}: { label: string; value: number | string; unit: string; icon: React.ReactNode; bg: string }) {
  const rgbMap: Record<string, string> = {
    'bg-blue-50': '37, 99, 235',
    'bg-emerald-50': '16, 185, 129',
    'bg-amber-50': '245, 158, 11',
    'bg-orange-50': '234, 88, 12',
    'bg-violet-50': '139, 92, 246',
    'bg-red-50': '225, 29, 72',
    'bg-slate-50': '15, 23, 42',
    'bg-indigo-50': '99, 102, 241',
    'bg-purple-50': '139, 92, 246',
  }
  const rgb = rgbMap[bg] ?? '15, 23, 42'
  return (
    <div
      className="relative rounded-xl overflow-hidden bg-white p-5"
      style={{
        border: `1px solid rgba(${rgb}, 0.18)`,
        boxShadow: `0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 16px -10px rgba(${rgb}, 0.22)`,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-14 pointer-events-none"
        style={{ background: `linear-gradient(180deg, rgba(${rgb}, 0.06) 0%, transparent 100%)` }}
      />
      <div className="relative flex items-start justify-between gap-2 mb-3">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg}`}>
          {icon}
        </div>
      </div>
      <p className="relative text-3xl font-bold text-slate-900 tracking-[-0.02em] leading-none tabular-nums">
        {value}
        <span className="text-base font-medium text-slate-400 ml-1.5">{unit}</span>
      </p>
    </div>
  )
}
