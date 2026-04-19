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
        subtitle={`${projects.length}개 · 진행 ${statusCounts.active} · 준공 ${statusCounts.completed}`}
        accent="slate"
        actions={
          <>
            <Link href="/import" className="ds-btn ds-btn-secondary hidden sm:inline-flex">
              <Upload size={13} /> 임포트
            </Link>
            <Link href="/projects/new" className="ds-btn ds-btn-primary">
              <Plus size={13} /><span className="hidden sm:inline">새 프로젝트</span><span className="sm:hidden">추가</span>
            </Link>
          </>
        }
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 space-y-5">
          {/* 상태 탭 — 인라인 pill */}
          <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
            {STATUS_TABS.map(t => {
              const active = statusFilter === t.key
              const count = statusCounts[t.key]
              return (
                <button
                  key={t.key}
                  onClick={() => setStatusFilter(t.key)}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[var(--text-primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]'
                  }`}
                >
                  {t.dot && <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />}
                  {t.label}
                  <span className={`text-[10px] font-mono tabular-nums ${
                    active ? 'text-white/60' : 'text-[var(--text-tertiary)]'
                  }`}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* 검색 + 필터 */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="프로젝트·발주처·위치 검색"
                className="ds-input pl-9 pr-8"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
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

            <div className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] ml-auto">
              <SortAsc size={12} />
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="ds-input !h-8 !w-auto text-[12px] pr-7"
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
            <div className="ds-card">
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
            <div className="ds-card">
              <EmptyState
                icon={Search}
                title="검색 결과가 없습니다"
                description="조건을 변경하거나 필터를 해제해보세요."
                actions={[
                  { label: '조건 초기화', onClick: () => { setQuery(''); setTypeFilter('all'); setStatusFilter('all') }, variant: 'secondary' },
                ]}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(p => <ProjectCard key={p.id} project={p} onDelete={deleteProject} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProjectCard({ project: p, onDelete }: { project: Project; onDelete: (id: string, name: string) => void }) {
  const startDate = p.startDate ? new Date(p.startDate).toLocaleDateString('ko-KR') : null
  const status = getProjectStatus(p)
  const info = STATUS_META[status]
  const isCompleted = status === 'completed'

  return (
    <div className="group ds-card-elev relative flex flex-col overflow-hidden">
      <Link href={`/projects/${p.id}`} className="block p-5 flex-1 no-underline">
        <div className="flex items-center gap-2 mb-3">
          <span className={`ds-chip ${status === 'active' ? 'ds-chip-success' : status === 'paused' ? 'ds-chip-warning' : status === 'completed' ? 'ds-chip-neutral' : status === 'planning' ? 'ds-chip-info' : 'ds-chip-neutral'}`}>
            <span className={`ds-dot`} style={{ background: 'currentColor' }} />
            {info.label}
          </span>
          {p.type && (
            <span className="text-[11px] font-medium text-[var(--text-tertiary)]">{p.type}</span>
          )}
        </div>

        <h3 className="text-[15px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-2 group-hover:text-[var(--accent-brand)] transition-colors tracking-[-0.01em]">
          {p.name}
        </h3>
        {p.client && (
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">{p.client}</p>
        )}

        <div className="space-y-1.5 mt-4 text-[12px] text-[var(--text-secondary)]">
          {p.location && (
            <div className="flex items-center gap-1.5">
              <MapPin size={11} className="text-[var(--text-tertiary)]" />
              <span className="truncate">{p.location}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Layers size={11} className="text-[var(--text-tertiary)]" />
            <span className="tabular-nums">
              지상 {p.ground}층{p.basement > 0 ? ` · 지하 ${p.basement}층` : ''}{p.bldgArea ? ` · ${p.bldgArea.toLocaleString()}㎡` : ''}
            </span>
          </div>
          {p.latestReportDate && (
            <div className="flex items-center gap-1.5">
              <Clock size={11} className={status === 'active' ? 'text-[var(--success)]' : 'text-[var(--text-tertiary)]'} />
              <span className={status === 'active' ? 'text-[var(--success)] font-medium' : ''}>
                {formatRelative(p.latestReportDate)}
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="border-t border-[var(--border-subtle)] px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-tertiary)]">
          <span className="tabular-nums"><strong className="text-[var(--text-secondary)] font-semibold">{p._count.tasks}</strong> 공종</span>
          {typeof p._count.dailyReports === 'number' && p._count.dailyReports > 0 && (
            <span className="tabular-nums"><strong className="text-[var(--text-secondary)] font-semibold">{p._count.dailyReports}</strong> 일보</span>
          )}
          {p.lastCpmDuration && (
            <span className="tabular-nums"><strong className="text-[var(--accent-brand)] font-semibold">{p.lastCpmDuration}</strong>일</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.preventDefault(); onDelete(p.id, p.name) }}
            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-opacity"
            title="삭제"
          ><Trash2 size={12} /></button>
          <Link
            href={`/bid?projectId=${p.id}`}
            className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-1.5 no-underline"
          >재검토</Link>
          <Link href={`/projects/${p.id}`} className="text-[10px] text-blue-600 font-semibold no-underline hover:underline flex items-center gap-0.5">
            열기 <ChevronRight size={10} />
          </Link>
        </div>
      </div>
    </div>
  )
}
