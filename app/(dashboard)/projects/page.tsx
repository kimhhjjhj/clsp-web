'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  FolderKanban, Plus, Upload, Search, X, Building2, MapPin, Calendar,
  ChevronRight, Layers, Trash2, SortAsc, Clock, CheckCircle2,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { SkeletonCard } from '@/components/common/Skeleton'
import { useToast } from '@/components/common/Toast'
import { getProjectStatus, STATUS_META, formatRelative, type ProjectStatus } from '@/lib/project-status'

interface Project {
  id: string
  name: string
  client?: string
  contractor?: string
  location?: string
  type?: string
  startDate?: string
  ground: number
  basement: number
  bldgArea?: number
  lastCpmDuration?: number
  latestReportDate?: string | null
  createdAt: string
  _count: { tasks: number; dailyReports?: number }
}

type SortKey = 'recent' | 'name' | 'startDate'
type StatusFilter = 'all' | ProjectStatus
type GroupKey = 'status' | 'type' | 'client' | 'none'

export default function ProjectsPageRoute() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">불러오는 중…</div>}>
      <ProjectsPage />
    </Suspense>
  )
}

function ProjectsPage() {
  const searchParams = useSearchParams()
  const initialStatus = (searchParams?.get('status') as StatusFilter) ?? 'all'

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    ['all', 'active', 'paused', 'planning', 'completed', 'archived'].includes(initialStatus)
      ? initialStatus
      : 'all'
  )
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [groupBy, setGroupBy] = useState<GroupKey>('status')
  const toast = useToast()

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: Project[]) => { setProjects(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function deleteProject(id: string, name: string) {
    if (!confirm(`"${name}" 프로젝트를 정말 삭제하시겠습니까?\n일보·CPM·제안 데이터가 함께 제거됩니다.`)) return
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setProjects(prev => prev.filter(p => p.id !== id))
      toast.success('프로젝트 삭제됨', name)
    } else {
      toast.error('삭제 실패')
    }
  }

  const types = useMemo(() => {
    const set = new Set<string>()
    for (const p of projects) if (p.type) set.add(p.type)
    return Array.from(set)
  }, [projects])

  // 상태별 개수
  const statusCounts = useMemo(() => {
    const counts: Record<ProjectStatus | 'all', number> = {
      all: projects.length, active: 0, paused: 0, planning: 0, completed: 0, archived: 0,
    }
    for (const p of projects) counts[getProjectStatus(p)]++
    return counts
  }, [projects])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = projects.filter(p => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false
      if (statusFilter !== 'all' && getProjectStatus(p) !== statusFilter) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.client?.toLowerCase().includes(q) ?? false) ||
        (p.contractor?.toLowerCase().includes(q) ?? false) ||
        (p.location?.toLowerCase().includes(q) ?? false) ||
        (p.type?.toLowerCase().includes(q) ?? false)
      )
    })
    // 정렬
    return rows.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'ko')
      if (sortKey === 'startDate') {
        const da = a.startDate ? new Date(a.startDate).getTime() : 0
        const db = b.startDate ? new Date(b.startDate).getTime() : 0
        return db - da
      }
      // 최근 활동 (latestReportDate desc, null은 뒤)
      const da = a.latestReportDate ? new Date(a.latestReportDate).getTime() : 0
      const db = b.latestReportDate ? new Date(b.latestReportDate).getTime() : 0
      return db - da
    })
  }, [projects, query, typeFilter, statusFilter, sortKey])

  // ── 그룹화: 섹션 헤더 + 카드 묶음 ─────────────────────────
  // statusFilter가 특정 상태면 status로 그룹화해도 단일 섹션뿐이라 무의미 → type으로 자동 전환
  const effectiveGroup: GroupKey = useMemo(() => {
    if (groupBy === 'status' && statusFilter !== 'all') return 'type'
    return groupBy
  }, [groupBy, statusFilter])

  const STATUS_ORDER: ProjectStatus[] = ['active', 'paused', 'planning', 'completed', 'archived']

  const grouped = useMemo(() => {
    if (effectiveGroup === 'none') {
      return [{ key: 'all', label: '', items: filtered, color: '#94a3b8' }]
    }
    const map = new Map<string, { key: string; label: string; items: Project[]; color: string; meta?: string }>()
    for (const p of filtered) {
      let key = '', label = '', color = '#94a3b8', meta: string | undefined
      if (effectiveGroup === 'status') {
        const st = getProjectStatus(p)
        key = st
        label = STATUS_META[st].label
        color = STATUS_META[st].color
      } else if (effectiveGroup === 'type') {
        key = p.type || '__unset__'
        label = p.type || '유형 미지정'
      } else {
        key = p.client || '__unset__'
        label = p.client || '발주처 미지정'
      }
      const cur = map.get(key)
      if (cur) cur.items.push(p)
      else map.set(key, { key, label, items: [p], color, meta })
    }
    const arr = Array.from(map.values())
    // 정렬: status는 고정 순, 나머지는 count desc
    if (effectiveGroup === 'status') {
      arr.sort((a, b) => STATUS_ORDER.indexOf(a.key as ProjectStatus) - STATUS_ORDER.indexOf(b.key as ProjectStatus))
    } else {
      arr.sort((a, b) => b.items.length - a.items.length)
    }
    return arr
  }, [filtered, effectiveGroup])

  const STATUS_TABS: { key: StatusFilter; label: string; dot?: string }[] = [
    { key: 'all',        label: '전체' },
    { key: 'active',     label: '진행중',   dot: STATUS_META.active.dot },
    { key: 'paused',     label: '일시중단', dot: STATUS_META.paused.dot },
    { key: 'planning',   label: '계획중',   dot: STATUS_META.planning.dot },
    { key: 'completed',  label: '준공',     dot: STATUS_META.completed.dot },
  ]

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={FolderKanban}
        title="프로젝트"
        subtitle={`${projects.length}개 프로젝트 · 진행 ${statusCounts.active} · 준공 ${statusCounts.completed}`}
        accent="emerald"
        actions={
          <>
            <Link
              href="/import"
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/15 bg-white/5 text-sm font-semibold text-slate-200 hover:bg-white/10"
            >
              <Upload size={14} /> 엑셀 임포트
            </Link>
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
            >
              <Plus size={14} /><span className="hidden sm:inline">새 프로젝트</span><span className="sm:hidden">추가</span>
            </Link>
          </>
        }
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
        {/* 상태 탭 — segmented control 스타일 */}
        <div className="flex items-center gap-0.5 p-0.5 bg-[rgba(15,23,42,0.04)] border border-[rgba(15,23,42,0.06)] rounded-[10px] overflow-x-auto w-fit">
          {STATUS_TABS.map(t => {
            const active = statusFilter === t.key
            const count = statusCounts[t.key]
            return (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12.5px] font-medium whitespace-nowrap transition-all ${
                  active
                    ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)] font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t.dot && <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />}
                {t.label}
                <span className={`text-[10px] font-medium tabular-nums ${
                  active ? 'text-slate-400' : 'text-slate-400'
                }`}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* 검색 + 유형 필터 + 정렬 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="프로젝트명·발주처·시공사·위치·유형 검색"
              className="w-full pl-9 pr-8 h-9 bg-white border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700">
                <X size={12} />
              </button>
            )}
          </div>

          {types.length > 0 && (
            <div className="inline-flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
              <button
                onClick={() => setTypeFilter('all')}
                className={`h-7 px-2.5 rounded text-[11px] font-semibold transition-colors ${
                  typeFilter === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >전체 유형</button>
              {types.map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`h-7 px-2.5 rounded text-[11px] font-semibold transition-colors ${
                    typeFilter === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >{t}</button>
              ))}
            </div>
          )}

          <div className="inline-flex items-center gap-2 text-xs text-gray-500 ml-auto">
            {/* 그룹 기준 */}
            <div className="inline-flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
              <span className="text-[10px] text-gray-400 font-semibold px-1.5">그룹</span>
              {([
                { k: 'status', l: '상태' },
                { k: 'type',   l: '유형' },
                { k: 'client', l: '발주처' },
                { k: 'none',   l: '없음' },
              ] as { k: GroupKey; l: string }[]).map(opt => (
                <button
                  key={opt.k}
                  onClick={() => setGroupBy(opt.k)}
                  className={`h-7 px-2.5 rounded text-[11px] font-semibold transition-colors ${
                    groupBy === opt.k ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >{opt.l}</button>
              ))}
            </div>

            {/* 정렬 */}
            <SortAsc size={12} className="text-gray-400" />
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              className="h-8 px-2 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="recent">최근 활동순</option>
              <option value="startDate">착공일 최신순</option>
              <option value="name">이름순</option>
            </select>
          </div>
        </div>

        {/* 콘텐츠 */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200">
            <EmptyState
              icon={FolderKanban}
              title="아직 등록된 프로젝트가 없습니다"
              description="신규 프로젝트를 만들어 개략공기 산정부터 시작하거나 과거 엑셀 일보를 일괄 임포트해 데이터 자산화를 시작하세요."
              actions={[
                { label: '첫 프로젝트 만들기', href: '/projects/new', icon: <Plus size={14} />, variant: 'primary' },
                { label: '엑셀 임포트', href: '/import', icon: <Upload size={14} />, variant: 'secondary' },
              ]}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200">
            <EmptyState
              icon={Search}
              title="검색 결과가 없습니다"
              description="조건을 변경하거나 필터를 해제해보세요."
              actions={[
                { label: '조건 초기화', onClick: () => { setQuery(''); setTypeFilter('all'); setStatusFilter('all') }, variant: 'secondary' },
              ]}
            />
          </div>
        ) : effectiveGroup === 'none' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => <ProjectCard key={p.id} project={p} onDelete={deleteProject} />)}
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(group => (
              <section key={group.key}>
                {/* 섹션 헤더 */}
                <div className="py-2 mb-3 flex items-center gap-2.5 border-b border-slate-300/40">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: group.color }}
                  />
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">{group.label}</h3>
                  <span className="text-[11px] font-mono font-semibold text-slate-500 bg-white/60 rounded px-1.5 py-0.5">
                    {group.items.length}
                  </span>
                  <div className="flex-1 h-px bg-slate-300/40" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.items.map(p => <ProjectCard key={p.id} project={p} onDelete={deleteProject} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ project: p, onDelete }: { project: Project; onDelete: (id: string, name: string) => void }) {
  const startDate = p.startDate ? new Date(p.startDate).toLocaleDateString('ko-KR') : null
  const status = getProjectStatus(p)
  const info = STATUS_META[status]
  const isCompleted = status === 'completed'
  // 상태 색 hex → rgba 분해 (간단한 매핑)
  const rgbMap: Record<typeof status, string> = {
    active:    '16, 185, 129',
    paused:    '245, 158, 11',
    planning:  '37, 99, 235',
    completed: '100, 116, 139',
    archived:  '148, 163, 184',
  }
  const rgb = rgbMap[status]

  return (
    <div
      className={`group relative overflow-hidden flex flex-col rounded-xl bg-white transition-all duration-200 ${
        isCompleted ? 'opacity-90 hover:opacity-100' : 'hover:-translate-y-0.5'
      }`}
      style={{
        border: `1px solid rgba(${rgb}, 0.2)`,
        boxShadow: `0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 18px -10px rgba(${rgb}, 0.22)`,
      }}
    >
      {/* 상단 컬러 워시 — 상태 시각화 */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-20 pointer-events-none"
        style={{ background: `linear-gradient(180deg, rgba(${rgb}, 0.07) 0%, transparent 100%)` }}
      />

      {/* 진행중: 우상단 pulse 도트 */}
      {status === 'active' && (
        <span className="absolute top-3 right-3 flex h-2 w-2 z-10">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      )}

      <Link href={`/projects/${p.id}`} className="relative block p-4 flex-1 no-underline">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${info.color}, ${info.color}dd)` }}>
              <Building2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${info.bg} ${info.text} border ${info.border}`}>
                  <span className={`w-1 h-1 rounded-full ${info.dot}`} />
                  {info.label}
                </span>
                {p.type && (
                  <span className="text-[10px] font-medium text-gray-500">{p.type}</span>
                )}
              </div>
              <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 group-hover:text-blue-700 transition-colors">
                {p.name}
              </h3>
            </div>
          </div>
        </div>

        {p.client && (
          <p className="text-[11px] text-gray-500 mb-2.5 -mt-1">{p.client}</p>
        )}

        <div className="space-y-1 text-xs text-gray-600">
          {p.location && (
            <div className="flex items-center gap-1.5">
              <MapPin size={11} className="text-gray-400 flex-shrink-0" />
              <span className="truncate">{p.location}</span>
            </div>
          )}
          {startDate && (
            <div className="flex items-center gap-1.5">
              <Calendar size={11} className="text-gray-400 flex-shrink-0" />
              <span>착공 {startDate}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Layers size={11} className="text-gray-400 flex-shrink-0" />
            <span>지상 {p.ground}층{p.basement > 0 ? ` · 지하 ${p.basement}층` : ''}{p.bldgArea ? ` · ${p.bldgArea.toLocaleString()} ㎡` : ''}</span>
          </div>
          {p.latestReportDate && (
            <div className="flex items-center gap-1.5">
              {status === 'active' ? (
                <Clock size={11} className="text-emerald-500 flex-shrink-0" />
              ) : status === 'completed' ? (
                <CheckCircle2 size={11} className="text-slate-400 flex-shrink-0" />
              ) : (
                <Clock size={11} className="text-gray-400 flex-shrink-0" />
              )}
              <span className={status === 'active' ? 'text-emerald-700 font-medium' : 'text-gray-500'}>
                마지막 일보 {formatRelative(p.latestReportDate)}
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="relative border-t border-slate-100 bg-slate-50/60 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span><strong className="text-gray-700 font-mono">{p._count.tasks}</strong> 공종</span>
          {typeof p._count.dailyReports === 'number' && p._count.dailyReports > 0 && (
            <span><strong className="text-gray-700 font-mono">{p._count.dailyReports}</strong> 일보</span>
          )}
          {p.lastCpmDuration && (
            <span title={`${p.lastCpmDuration}일`}>
              <strong className="text-blue-700 font-mono">{Math.round(p.lastCpmDuration / 30)}</strong>개월
              <span className="text-gray-400 ml-0.5">({p.lastCpmDuration}일)</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={e => { e.preventDefault(); onDelete(p.id, p.name) }}
            className="p-1 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
            title="프로젝트 삭제"
          ><Trash2 size={12} /></button>
          <Link
            href={`/bid?projectId=${p.id}`}
            className="text-[10px] text-gray-500 font-semibold no-underline hover:text-gray-900 px-1"
            title="개략공기·조정값을 /bid에서 다시 편집"
          >재검토</Link>
          <Link href={`/projects/${p.id}`} className="text-[10px] text-blue-600 font-semibold no-underline hover:underline flex items-center gap-0.5">
            열기 <ChevronRight size={10} />
          </Link>
        </div>
      </div>
    </div>
  )
}
