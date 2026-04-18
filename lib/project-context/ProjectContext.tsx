'use client'

// ═══════════════════════════════════════════════════════════
// ProjectContext — 전역 "현재 선택된 프로젝트" 상태
//
// Source of truth 우선순위:
// 1) URL이 /projects/[id]/* → 해당 id 우선 (깊은 링크 보존)
// 2) localStorage 'clsp:currentProjectId' → 복원
// 3) null (전사 뷰)
//
// localStorage 저장만 사이드 이펙트, URL은 건드리지 않음.
// ═══════════════════════════════════════════════════════════

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export interface ProjectLite {
  id: string
  name: string
  type?: string
  lastCpmDuration?: number
  ground?: number
  basement?: number
  _count?: { tasks?: number; dailyReports?: number }
}

interface ProjectContextValue {
  currentProject: ProjectLite | null
  currentProjectId: string | null
  projects: ProjectLite[]          // 전체 목록 (Switcher 드롭다운용)
  recentIds: string[]               // 최근 전환 이력 (최대 5개)
  loading: boolean
  selectProject: (id: string) => void
  clearProject: () => void
  refresh: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

const LS_CURRENT = 'clsp:currentProjectId'
const LS_RECENT = 'clsp:recentProjectIds'
const MAX_RECENT = 5

function readLS(key: string): string | null {
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem(key) } catch { return null }
}
function writeLS(key: string, value: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {}
}

// URL에서 project id 추출 (/projects/<id> 또는 /projects/<id>/...)
function extractProjectIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/projects\/([^/]+)(?:\/|$)/)
  if (!m) return null
  const id = m[1]
  // 'new' 같은 서브 경로는 프로젝트 id가 아님
  if (id === 'new') return null
  return id
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/'
  const router = useRouter()

  const [projects, setProjects] = useState<ProjectLite[]>([])
  const [loading, setLoading] = useState(true)
  const [fallbackId, setFallbackId] = useState<string | null>(null) // URL 기반이 아닐 때 사용
  const [recentIds, setRecentIds] = useState<string[]>([])

  // 초기 로드: projects + localStorage
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data: ProjectLite[] = await res.json()
        setProjects(data)
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    setFallbackId(readLS(LS_CURRENT))
    try {
      const raw = readLS(LS_RECENT)
      if (raw) setRecentIds(JSON.parse(raw))
    } catch {}
  }, [refresh])

  // URL 기반 id가 우선, 없으면 fallback
  const urlId = extractProjectIdFromPath(pathname)
  const currentProjectId = urlId ?? fallbackId
  const currentProject = useMemo(() => {
    if (!currentProjectId) return null
    return projects.find(p => p.id === currentProjectId) ?? null
  }, [currentProjectId, projects])

  // URL 기반 id 변경 시 localStorage 갱신 + recent 이력 추가
  useEffect(() => {
    if (!urlId) return
    writeLS(LS_CURRENT, urlId)
    setFallbackId(urlId)
    setRecentIds(prev => {
      const next = [urlId, ...prev.filter(x => x !== urlId)].slice(0, MAX_RECENT)
      writeLS(LS_RECENT, JSON.stringify(next))
      return next
    })
  }, [urlId])

  const selectProject = useCallback((id: string) => {
    writeLS(LS_CURRENT, id)
    setFallbackId(id)
    setRecentIds(prev => {
      const next = [id, ...prev.filter(x => x !== id)].slice(0, MAX_RECENT)
      writeLS(LS_RECENT, JSON.stringify(next))
      return next
    })
    // URL이 이미 /projects/[다른id]/... 패턴이면 같은 stage 유지하고 id만 교체
    const m = pathname.match(/^\/projects\/([^/]+)(.*)$/)
    if (m && m[1] !== id && m[1] !== 'new') {
      router.push(`/projects/${id}${m[2]}`)
    } else if (!pathname.startsWith('/projects/')) {
      // 전사 페이지에 있으면 프로젝트 상세로 이동
      router.push(`/projects/${id}`)
    }
    // 이미 맞는 프로젝트면 아무 것도 안 함
  }, [pathname, router])

  const clearProject = useCallback(() => {
    writeLS(LS_CURRENT, null)
    setFallbackId(null)
  }, [])

  const value: ProjectContextValue = {
    currentProject,
    currentProjectId,
    projects,
    recentIds,
    loading,
    selectProject,
    clearProject,
    refresh,
  }

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) {
    // Provider 없을 때 no-op (SSR·테스트 안전)
    return {
      currentProject: null,
      currentProjectId: null,
      projects: [],
      recentIds: [],
      loading: false,
      selectProject: () => {},
      clearProject: () => {},
      refresh: async () => {},
    }
  }
  return ctx
}
