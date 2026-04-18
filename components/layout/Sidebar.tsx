'use client'

// ═══════════════════════════════════════════════════════════
// 사이드바 — 접이식 2+3 구조
//  [전역] 대시보드·프로젝트
//  [사업 초기 검토]  ▼ 공사비·공기
//  [현재 프로젝트]   ▼ 프리콘·시공·분석
//  [DB]              ▼ 분석·생산성·R&O·협력사
//  [관리]            ▼ 임포트·승인·설정
//
// 각 섹션은 토글 가능. 상태는 localStorage에 기억.
// 현재 페이지가 섹션 내부면 자동 펼침(최초 1회).
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard, FolderKanban, ClipboardCheck, BarChart3, Database, ShieldAlert, Users2,
  Upload, ShieldCheck, Settings, X, DollarSign, ChevronRight, Layers,
} from 'lucide-react'
import { useProjectContext } from '@/lib/project-context/ProjectContext'
import CurrentProjectSection from './CurrentProjectSection'

interface NavItem { href: string; label: string; icon: typeof LayoutDashboard }

const GLOBAL_ITEMS: NavItem[] = [
  { href: '/',         label: '대시보드',        icon: LayoutDashboard },
  { href: '/projects', label: '프로젝트',        icon: FolderKanban },
]

const BID_ITEM: NavItem = { href: '/bid', label: '사업 초기 검토', icon: ClipboardCheck }
const BID_SUB: { tab: string; label: string; icon: typeof DollarSign }[] = [
  { tab: 'cost',     label: '공사비',   icon: DollarSign },
  { tab: 'schedule', label: '공기',     icon: BarChart3 },
]

const DB_ITEMS: NavItem[] = [
  { href: '/analytics', label: '분석',      icon: BarChart3 },
  { href: '/standards', label: '생산성 DB', icon: Database },
  { href: '/risks',     label: 'R&O',      icon: ShieldAlert },
  { href: '/companies', label: '협력사',    icon: Users2 },
]

const ADMIN_ITEMS: NavItem[] = [
  { href: '/import',             label: '엑셀 일괄 임포트', icon: Upload },
  { href: '/admin/productivity', label: '관리자 승인',      icon: ShieldCheck },
]

// localStorage 토글 상태 유지
function useToggle(key: string, initial: boolean): [boolean, (v?: boolean) => void] {
  const [open, setOpen] = useState<boolean>(initial)
  // 최초 1회 localStorage 복원
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`sidebar:${key}`)
      if (raw !== null) setOpen(raw === '1')
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const toggle = useCallback((v?: boolean) => {
    setOpen(prev => {
      const next = typeof v === 'boolean' ? v : !prev
      try { localStorage.setItem(`sidebar:${key}`, next ? '1' : '0') } catch {}
      return next
    })
  }, [key])
  return [open, toggle]
}

interface Props {
  onClose: () => void
}

export default function Sidebar({ onClose }: Props) {
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const activeBidTab = searchParams?.get('tab') ?? 'cost'
  const isBid = pathname.startsWith('/bid')
  const isProjectDetail = /^\/projects\/[^/]+/.test(pathname) && !pathname.startsWith('/projects/new')
  const isDbArea = DB_ITEMS.some(i => pathname.startsWith(i.href))
  const isAdminArea = ADMIN_ITEMS.some(i => pathname.startsWith(i.href))
  const { currentProject } = useProjectContext()

  const [bidOpen, setBidOpen] = useToggle('bid', false)
  const [projectOpen, setProjectOpen] = useToggle('project', true)
  const [dbOpen, setDbOpen] = useToggle('db', true)
  const [adminOpen, setAdminOpen] = useToggle('admin', false)

  // 현재 경로가 섹션 내부면 자동 펼침 (사용자가 수동으로 접은 상태는 존중)
  useEffect(() => { if (isBid && !bidOpen) setBidOpen(true) }, [isBid]) // eslint-disable-line
  useEffect(() => { if (isProjectDetail && !projectOpen) setProjectOpen(true) }, [isProjectDetail]) // eslint-disable-line
  useEffect(() => { if (isDbArea && !dbOpen) setDbOpen(true) }, [isDbArea]) // eslint-disable-line
  useEffect(() => { if (isAdminArea && !adminOpen) setAdminOpen(true) }, [isAdminArea]) // eslint-disable-line

  return (
    <>
      {/* 로고 — CLSP 브랜드 */}
      <div className="flex items-start justify-between px-5 py-5 border-b border-white/10 flex-shrink-0">
        <Link href="/" onClick={onClose} className="flex items-center gap-3 no-underline group">
          {/* 로고 아이콘 — 계층 쌓인 블록 느낌 */}
          <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-900/40 ring-1 ring-white/10 group-hover:shadow-blue-800/60 group-hover:scale-105 transition-all">
            <Layers size={20} className="text-white drop-shadow-sm" strokeWidth={2.5} />
            {/* 빛나는 하이라이트 */}
            <span className="absolute top-0.5 left-0.5 right-0.5 h-1/2 rounded-t-xl bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-white tracking-tight leading-none">CLSP</h1>
            <p className="text-[9px] text-slate-400 uppercase tracking-[0.14em] font-semibold leading-tight mt-1.5">
              Construction<br />Lifecycle Suite
            </p>
          </div>
        </Link>
        <button
          onClick={onClose}
          className="lg:hidden p-1 -mr-1 text-slate-400 hover:text-white"
          aria-label="메뉴 닫기"
        ><X size={16} /></button>
      </div>

      {/* 본문 — 스크롤 */}
      <nav className="sidebar-scroll flex-1 px-2 py-3 overflow-y-auto overscroll-contain">
        {/* 전역 메뉴 (항상 표시) */}
        <NavGroup>
          {GLOBAL_ITEMS.map(item => (
            <SidebarLink
              key={item.href}
              item={item}
              active={item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)}
              onNavigate={onClose}
            />
          ))}

          {/* 사업 초기 검토 — 토글 서브메뉴 */}
          <CollapsibleItem
            item={BID_ITEM}
            active={isBid}
            open={bidOpen}
            onToggle={() => setBidOpen()}
            onNavigate={onClose}
          />
          {bidOpen && (
            <div className="ml-3 pl-3 border-l border-white/[0.08] space-y-0.5 mt-0.5 mb-1">
              {BID_SUB.map(sub => {
                const subActive = isBid && activeBidTab === sub.tab
                const Icon = sub.icon
                return (
                  <Link
                    key={sub.tab}
                    href={`/bid?tab=${sub.tab}`}
                    onClick={onClose}
                    className={`flex items-center gap-2 px-2 h-8 rounded-md text-xs transition-colors no-underline ${
                      subActive
                        ? 'bg-white/[0.08] text-white font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon size={12} className="flex-shrink-0" />
                    <span className="flex-1 truncate">{sub.label}</span>
                    {subActive && <span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />}
                  </Link>
                )
              })}
            </div>
          )}
        </NavGroup>

        {/* 현재 프로젝트 섹션 — 토글 */}
        {currentProject && (
          <Section
            label="현재 프로젝트"
            open={projectOpen}
            onToggle={() => setProjectOpen()}
            accent="#3b82f6"
          >
            <CurrentProjectSection project={currentProject} onNavigate={onClose} />
          </Section>
        )}

        {/* DB — 토글 */}
        <Section label="DB" open={dbOpen} onToggle={() => setDbOpen()}>
          <NavGroup>
            {DB_ITEMS.map(item => (
              <SidebarLink
                key={item.href}
                item={item}
                active={pathname.startsWith(item.href)}
                onNavigate={onClose}
              />
            ))}
          </NavGroup>
        </Section>

        {/* 관리 — 토글 */}
        <Section label="관리" open={adminOpen} onToggle={() => setAdminOpen()}>
          <NavGroup>
            {ADMIN_ITEMS.map(item => (
              <SidebarLink
                key={item.href}
                item={item}
                active={pathname.startsWith(item.href)}
                onNavigate={onClose}
              />
            ))}
            <button
              type="button"
              className="w-full flex items-center gap-2.5 px-2 h-9 rounded-lg text-[13px] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
            >
              <Settings size={15} className="flex-shrink-0" />
              <span className="flex-1 text-left">설정</span>
            </button>
          </NavGroup>
        </Section>
      </nav>
    </>
  )
}

function NavGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-0.5">{children}</div>
}

function SidebarLink({
  item, active, onNavigate,
}: {
  item: NavItem
  active: boolean
  onNavigate: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 px-2 h-9 rounded-lg transition-colors no-underline ${
        active
          ? 'bg-blue-600 text-white font-semibold shadow-sm'
          : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
      }`}
    >
      <Icon size={15} className="flex-shrink-0" />
      <span className="flex-1 text-[13px] leading-none truncate">{item.label}</span>
      {active && <span className="w-1 h-4 bg-white/60 rounded-full flex-shrink-0" />}
    </Link>
  )
}

// 사업 초기 검토처럼 '클릭=이동' + '토글 버튼'이 필요한 아이템
function CollapsibleItem({
  item, active, open, onToggle, onNavigate,
}: {
  item: NavItem
  active: boolean
  open: boolean
  onToggle: () => void
  onNavigate: () => void
}) {
  const Icon = item.icon
  return (
    <div
      className={`flex items-center gap-1 h-9 rounded-lg transition-colors overflow-hidden ${
        active
          ? 'bg-blue-600 text-white font-semibold shadow-sm'
          : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
      }`}
    >
      <Link
        href={item.href}
        onClick={onNavigate}
        className="flex items-center gap-2.5 pl-2 pr-1 h-full flex-1 min-w-0 no-underline"
      >
        <Icon size={15} className="flex-shrink-0" />
        <span className="flex-1 text-[13px] leading-none truncate">{item.label}</span>
      </Link>
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? '접기' : '펼치기'}
        className={`h-full px-2 flex items-center justify-center transition-colors ${
          active ? 'hover:bg-white/10' : 'hover:bg-white/[0.04]'
        }`}
      >
        <ChevronRight
          size={13}
          className={`transition-transform ${open ? 'rotate-90' : ''} ${active ? 'text-white/80' : 'text-slate-500'}`}
        />
      </button>
    </div>
  )
}

// DB · 관리 · 현재프로젝트 섹션 헤더 (접기 가능)
function Section({
  label, open, onToggle, accent, children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  accent?: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-4 pt-3 border-t border-white/[0.06]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-2 pb-1 group"
      >
        {accent && <span className="w-1 h-3 rounded-full flex-shrink-0" style={{ background: accent }} />}
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] group-hover:text-slate-400 transition-colors">
          {label}
        </span>
        <ChevronRight
          size={11}
          className={`ml-auto text-slate-600 group-hover:text-slate-400 transition-all ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && <div className="mt-0.5">{children}</div>}
    </div>
  )
}
