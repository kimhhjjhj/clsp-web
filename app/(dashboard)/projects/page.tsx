'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  FolderKanban, Plus, Upload, Search, X, Building2, MapPin, Calendar, Users,
  ChevronRight, Layers, Trash2,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { SkeletonCard } from '@/components/common/Skeleton'
import { useToast } from '@/components/common/Toast'

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
  createdAt: string
  _count: { tasks: number; dailyReports?: number }
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter(p => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.client?.toLowerCase().includes(q) ?? false) ||
        (p.location?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [projects, query, typeFilter])

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={FolderKanban}
        title="프로젝트"
        subtitle={`${projects.length}개 프로젝트 · 통합 공정 관리`}
        actions={
          <>
            <Link
              href="/import"
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
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

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {/* 검색·필터 */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="프로젝트명·발주처·위치로 검색"
              className="w-full pl-9 pr-8 h-9 bg-white border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-500"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700">
                <X size={12} />
              </button>
            )}
          </div>
          {types.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setTypeFilter('all')}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  typeFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >전체</button>
              {types.map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                    typeFilter === t ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >{t}</button>
              ))}
            </div>
          )}
          <span className="ml-auto text-xs text-gray-500 hidden sm:block">
            {filtered.length !== projects.length && `${filtered.length}개 필터됨`}
          </span>
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
              description={`"${query}"에 해당하는 프로젝트가 없습니다. 다른 키워드로 검색하거나 필터를 해제해보세요.`}
              actions={[
                { label: '검색 초기화', onClick: () => { setQuery(''); setTypeFilter('all') }, variant: 'secondary' },
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
  )
}

function ProjectCard({ project: p, onDelete }: { project: Project; onDelete: (id: string, name: string) => void }) {
  const startDate = p.startDate ? new Date(p.startDate).toLocaleDateString('ko-KR') : null
  return (
    <div className="group bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all overflow-hidden flex flex-col">
      <Link href={`/projects/${p.id}`} className="block p-4 flex-1 no-underline">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white shadow-sm flex-shrink-0">
            <Building2 size={16} />
          </div>
          {p.type && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              {p.type}
            </span>
          )}
        </div>
        <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 mb-1 group-hover:text-blue-700">
          {p.name}
        </h3>
        {p.client && (
          <p className="text-xs text-gray-500 mb-3">{p.client}</p>
        )}
        <div className="space-y-1.5 text-xs text-gray-600">
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
            <span>지상 {p.ground}층{p.basement > 0 ? ` · 지하 ${p.basement}층` : ''}{p.bldgArea ? ` · ${p.bldgArea.toLocaleString()}m²` : ''}</span>
          </div>
        </div>
      </Link>
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span><strong className="text-gray-700">{p._count.tasks}</strong> 공종</span>
          {typeof p._count.dailyReports === 'number' && (
            <span><strong className="text-gray-700">{p._count.dailyReports}</strong> 일보</span>
          )}
          {p.lastCpmDuration && (
            <span><strong className="text-blue-700">{p.lastCpmDuration}</strong>일</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.preventDefault(); onDelete(p.id, p.name) }}
            className="p-1 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
            title="프로젝트 삭제"
          ><Trash2 size={12} /></button>
          <Link href={`/projects/${p.id}`} className="text-[10px] text-blue-600 font-semibold no-underline hover:underline flex items-center gap-0.5">
            열기 <ChevronRight size={10} />
          </Link>
        </div>
      </div>
    </div>
  )
}
