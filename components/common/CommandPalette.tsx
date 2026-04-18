'use client'

// ═══════════════════════════════════════════════════════════
// Command Palette — Cmd+K / Ctrl+K 로 호출하는 전역 검색
// - 프로젝트·일보·공종·제안 통합 검색 (/api/search)
// - 빠른 명령 (신규 프로젝트 / 일보 작성 / 관리자 등)
// - 키보드 ↑↓ Enter Esc 지원
// ═══════════════════════════════════════════════════════════

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Search, FolderKanban, FileText, Wrench, TrendingUp,
  Plus, Upload, ShieldCheck, Home, Loader2, CornerDownLeft, X,
} from 'lucide-react'

interface SearchResult {
  kind: 'project' | 'report' | 'task' | 'proposal'
  id: string
  title: string
  subtitle?: string
  href: string
}

interface QuickAction {
  kind: 'action'
  id: string
  title: string
  subtitle?: string
  href: string
  icon: React.ReactNode
  keywords?: string[]
}

type PaletteItem = SearchResult | QuickAction

const QUICK_ACTIONS: QuickAction[] = [
  { kind: 'action', id: 'a:home', title: '대시보드로 이동', href: '/', icon: <Home size={14} />, keywords: ['home', 'dashboard'] },
  { kind: 'action', id: 'a:new-project', title: '새 프로젝트 만들기', subtitle: '1단계 개략공기 산정 시작', href: '/projects/new', icon: <Plus size={14} />, keywords: ['project', 'new', '신규', '프로젝트'] },
  { kind: 'action', id: 'a:import', title: '엑셀 일보 임포트', subtitle: '파주/상봉 포맷 지원', href: '/import', icon: <Upload size={14} />, keywords: ['excel', 'import', '임포트', '엑셀'] },
  { kind: 'action', id: 'a:admin', title: '관리자 · 생산성 승인', subtitle: '제안 검토 → 회사 표준 반영', href: '/admin/productivity', icon: <ShieldCheck size={14} />, keywords: ['admin', '관리자', '승인', '생산성'] },
]

function kindIcon(kind: SearchResult['kind']) {
  switch (kind) {
    case 'project': return <FolderKanban size={14} className="text-blue-500" />
    case 'report': return <FileText size={14} className="text-emerald-500" />
    case 'task': return <Wrench size={14} className="text-purple-500" />
    case 'proposal': return <TrendingUp size={14} className="text-orange-500" />
  }
}
function kindLabel(kind: SearchResult['kind']): string {
  return { project: '프로젝트', report: '일보', task: '공종', proposal: '생산성 제안' }[kind]
}

// ── Context ─────────────────────────────────────
interface CommandPaletteContextValue {
  open: () => void
  close: () => void
  toggle: () => void
}
const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

export function useCommandPalette(): CommandPaletteContextValue {
  return useContext(CommandPaletteContext) ?? { open: () => {}, close: () => {}, toggle: () => {} }
}

// ── Provider + Dialog ──────────────────────────
export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(v => !v), [])

  // 전역 단축키 Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      const target = e.target as HTMLElement
      const isEditable = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault()
        toggle()
      } else if (key === 'escape' && isOpen) {
        close()
      } else if (key === '/' && !isEditable && !isOpen) {
        e.preventDefault()
        open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, close, open, isOpen])

  return (
    <CommandPaletteContext.Provider value={{ open, close, toggle }}>
      {children}
      {isOpen && <CommandPaletteDialog onClose={close} />}
    </CommandPaletteContext.Provider>
  )
}

// ── Dialog ─────────────────────────────────────
function CommandPaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // 검색 (debounce)
  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data.results ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 180)
    return () => clearTimeout(t)
  }, [query])

  // 필터링된 퀵액션 (키워드 매치)
  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return QUICK_ACTIONS
    return QUICK_ACTIONS.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.subtitle?.toLowerCase().includes(q) ||
      a.keywords?.some(k => k.toLowerCase().includes(q)),
    )
  }, [query])

  const items: PaletteItem[] = useMemo(() => {
    return [...filteredActions, ...results]
  }, [filteredActions, results])

  useEffect(() => { setActiveIdx(0) }, [items.length])

  // 키보드 네비
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const picked = items[activeIdx]
        if (picked) {
          router.push(picked.href)
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, activeIdx, router, onClose])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-start justify-center pt-[15vh] px-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200"
        onClick={e => e.stopPropagation()}
      >
        {/* 검색창 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="검색 · 프로젝트/일보/공종/제안 · 빠른 명령..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
          />
          {loading && <Loader2 size={12} className="animate-spin text-gray-400 flex-shrink-0" />}
          <button onClick={onClose} className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100">
            <X size={14} />
          </button>
        </div>

        {/* 결과 */}
        <div className="max-h-[60vh] overflow-auto">
          {items.length === 0 && !loading && (
            <div className="py-10 text-center text-xs text-gray-400">
              {query ? '일치하는 결과가 없습니다' : '검색어를 입력하거나 ↑↓로 명령을 선택하세요'}
            </div>
          )}
          {/* 퀵액션 그룹 */}
          {filteredActions.length > 0 && (
            <div>
              {!query && (
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  빠른 명령
                </div>
              )}
              {filteredActions.map((a, i) => {
                const idx = i
                return (
                  <Row
                    key={a.id}
                    active={activeIdx === idx}
                    onClick={() => { router.push(a.href); onClose() }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    icon={a.icon}
                    badge="명령"
                    title={a.title}
                    subtitle={a.subtitle}
                  />
                )
              })}
            </div>
          )}
          {/* 검색 결과 */}
          {results.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-t border-gray-50 mt-1">
                검색 결과
              </div>
              {results.map((r, i) => {
                const idx = filteredActions.length + i
                return (
                  <Row
                    key={`${r.kind}-${r.id}`}
                    active={activeIdx === idx}
                    onClick={() => { router.push(r.href); onClose() }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    icon={kindIcon(r.kind)}
                    badge={kindLabel(r.kind)}
                    title={r.title}
                    subtitle={r.subtitle}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* 하단 힌트 */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50 text-[10px] text-gray-400">
          <div className="flex items-center gap-3">
            <span><Kbd>↑</Kbd><Kbd>↓</Kbd> 이동</span>
            <span><Kbd>Enter</Kbd> 실행</span>
            <span><Kbd>Esc</Kbd> 닫기</span>
          </div>
          <div>
            <Kbd>⌘</Kbd><Kbd>K</Kbd> / <Kbd>/</Kbd>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Row({
  active, onClick, onMouseEnter, icon, badge, title, subtitle,
}: {
  active: boolean
  onClick: () => void
  onMouseEnter: () => void
  icon: React.ReactNode
  badge: string
  title: string
  subtitle?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
        active ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      <span className="flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-900 truncate">{title}</div>
        {subtitle && <div className="text-[11px] text-gray-500 truncate mt-0.5">{subtitle}</div>}
      </div>
      <span className="flex-shrink-0 text-[9px] text-gray-400 uppercase tracking-wider">{badge}</span>
      {active && <CornerDownLeft size={11} className="flex-shrink-0 text-blue-500" />}
    </button>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 border border-gray-300 bg-white rounded text-[9px] font-mono font-semibold text-gray-600 mx-0.5">
      {children}
    </kbd>
  )
}
