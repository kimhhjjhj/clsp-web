'use client'

// ═══════════════════════════════════════════════════════════
// Project Switcher — 상단바에 항상 노출되는 현재 프로젝트 표시·전환
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { FolderKanban, ChevronDown, Search, Plus, X, Building2, ClipboardCheck, Eye, Check } from 'lucide-react'
import { useProjectContext } from '@/lib/project-context/ProjectContext'

export default function ProjectSwitcher() {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const { currentProject, projects, recentIds, selectProject, clearProject } = useProjectContext()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 사업 초기 검토 모드 감지 (舊 입찰·견적)
  const isBidMode = pathname.startsWith('/bid')

  // 바깥 클릭 닫기
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // 열릴 때 검색창 포커스
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.type && p.type.toLowerCase().includes(q))
    )
  }, [projects, query])

  const recentProjects = useMemo(() => {
    return recentIds
      .map(id => projects.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .slice(0, 3)
  }, [recentIds, projects])

  // 현재 단계 추정 (프로젝트 상세 /projects/[id]/stage/N)
  const stageMatch = pathname.match(/\/projects\/[^/]+\/stage\/(\d)/)
  const currentStage = stageMatch ? Number(stageMatch[1]) : null
  const stageInfo: Record<number, { label: string; color: string }> = {
    1: { label: '개략공기', color: '#2563eb' },
    2: { label: '프리콘', color: '#16a34a' },
    3: { label: '시공', color: '#ea580c' },
    4: { label: '분석', color: '#7c3aed' },
  }

  function choose(id: string) {
    setOpen(false)
    setQuery('')
    selectProject(id)
  }

  function handleClear() {
    setOpen(false)
    setQuery('')
    clearProject()
    if (pathname.startsWith('/projects/')) {
      router.push('/projects')
    }
  }

  // 사업 초기 검토 모드 버튼: 클릭해도 드롭다운 열림 (다른 프로젝트 전환 가능하게)
  const triggerLabel = isBidMode
    ? { icon: <ClipboardCheck size={13} className="text-amber-500" />, text: '사업 초기 검토', sub: '저장 전 시뮬 중', color: 'text-amber-700 bg-amber-50 border-amber-200' }
    : currentProject
    ? {
        icon: <FolderKanban size={13} style={{ color: currentStage ? stageInfo[currentStage]?.color : '#2563eb' }} />,
        text: currentProject.name,
        sub: currentStage ? `${currentStage}·${stageInfo[currentStage]?.label}` : '프로젝트 선택됨',
        color: 'text-gray-900 bg-white border-gray-200 hover:border-gray-300',
      }
    : {
        icon: <FolderKanban size={13} className="text-gray-400" />,
        text: '프로젝트 선택',
        sub: '전사 뷰',
        color: 'text-gray-500 bg-gray-50 border-gray-200 hover:border-gray-300',
      }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`h-9 px-3 rounded-lg border flex items-center gap-2 text-sm font-semibold transition-colors max-w-[260px] ${triggerLabel.color}`}
      >
        {triggerLabel.icon}
        <span className="flex-1 min-w-0 text-left">
          <span className="block truncate leading-tight">{triggerLabel.text}</span>
          <span className="block text-[10px] text-gray-500 font-normal leading-tight mt-0.5 truncate">
            {triggerLabel.sub}
          </span>
        </span>
        <ChevronDown size={13} className={`text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* 검색 */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="프로젝트 검색..."
                className="w-full pl-7 pr-7 h-8 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-500"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-700">
                  <X size={10} />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-auto thin-scroll">
            {/* 최근 */}
            {!query && recentProjects.length > 0 && (
              <div>
                <div className="px-3 pt-2 pb-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">최근</div>
                {recentProjects.map(p => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    selected={currentProject?.id === p.id}
                    onClick={() => choose(p.id)}
                  />
                ))}
              </div>
            )}

            {/* 전체 */}
            <div>
              <div className="px-3 pt-2 pb-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>전체 ({filtered.length})</span>
              </div>
              {filtered.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">
                  {query ? '검색 결과 없음' : '등록된 프로젝트 없음'}
                </div>
              ) : (
                filtered.map(p => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    selected={currentProject?.id === p.id}
                    onClick={() => choose(p.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* 액션 */}
          <div className="border-t border-gray-100 p-1.5 space-y-0.5">
            <Link
              href="/projects/new"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 h-8 px-2 rounded hover:bg-blue-50 text-xs font-semibold text-blue-700 no-underline"
            >
              <Plus size={12} />
              새 프로젝트 만들기
            </Link>
            {currentProject && !isBidMode && (
              <button
                onClick={handleClear}
                className="w-full flex items-center gap-2 h-8 px-2 rounded hover:bg-gray-50 text-xs text-gray-600"
              >
                <Eye size={12} />
                프로젝트 해제 (전사 뷰로)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectRow({
  project: p, selected, onClick,
}: {
  project: { id: string; name: string; type?: string; lastCpmDuration?: number; ground?: number; _count?: { tasks?: number; dailyReports?: number } }
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
        selected ? 'bg-blue-50' : ''
      }`}
    >
      <div className="w-8 h-8 rounded-md bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white flex-shrink-0">
        <Building2 size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{p.name}</p>
        <p className="text-[10px] text-gray-500 truncate mt-0.5">
          {p.type ? `${p.type} · ` : ''}
          {p.ground !== undefined ? `${p.ground}층 · ` : ''}
          {p._count?.dailyReports !== undefined ? `일보 ${p._count.dailyReports}건` : ''}
        </p>
      </div>
      {selected && <Check size={13} className="text-blue-600 flex-shrink-0" />}
    </button>
  )
}
