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
  Upload, ShieldCheck, Settings, X, ChevronRight, Plus, Calculator, CalendarClock,
} from 'lucide-react'
import { useProjectContext } from '@/lib/project-context/ProjectContext'
import CurrentProjectSection from './CurrentProjectSection'
import ClspLogo from '@/components/brand/ClspLogo'

interface NavItem { href: string; label: string; icon: typeof LayoutDashboard }

// 전역 메뉴 순서: 대시보드 → 사업 초기 검토 → 프로젝트
// (기획·검토가 앞단, 저장된 프로젝트 운영이 뒤)
const DASH_ITEM: NavItem = { href: '/', label: '대시보드', icon: LayoutDashboard }
const PROJECTS_ITEM: NavItem = { href: '/projects', label: '프로젝트', icon: FolderKanban }
const BID_ITEM: NavItem = { href: '/bid', label: '사업 초기 검토', icon: ClipboardCheck }
const BID_SUB: { tab: string; label: string; icon: typeof Calculator }[] = [
  { tab: 'cost',     label: '공사비',   icon: Calculator },
  { tab: 'schedule', label: '공기',     icon: CalendarClock },
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
    <div className="flex flex-col h-full">
      {/* CLSP 브랜드 — 육각형 큐브 로고 + 워드마크 */}
      <div className="flex items-start justify-between px-5 py-5 border-b border-white/10 flex-shrink-0">
        <Link href="/" onClick={onClose} className="flex items-start gap-3 no-underline group select-none">
          <div
            className="relative flex-shrink-0 transition-transform duration-300 group-hover:rotate-[5deg] mt-0.5"
            style={{ filter: 'drop-shadow(0 6px 16px rgba(99, 102, 241, 0.32))' }}
          >
            <ClspLogo size={44} luminous />
          </div>
          <div className="flex flex-col">
            <h1
              className="relative text-[28px] font-black leading-none tracking-[-0.04em] bg-gradient-to-br from-white via-blue-50 to-indigo-200 bg-clip-text text-transparent"
              style={{ textShadow: '0 2px 14px rgba(99, 102, 241, 0.25)' }}
            >
              CLSP
            </h1>
            <p className="text-[8.5px] text-slate-400 uppercase tracking-[0.22em] font-semibold leading-[1.5] mt-2">
              Construction<br />Lifecycle&nbsp;Solution<br />Platform
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
        {/* 대시보드 — 포인트 홈 버튼 (다른 링크보다 도드라지게) */}
        <Link
          href="/"
          onClick={onClose}
          aria-current={pathname === '/' ? 'page' : undefined}
          className={`group relative flex items-center gap-3 px-3 h-11 rounded-xl no-underline overflow-hidden mb-3 transition-all ${
            pathname === '/' ? 'shadow-lg shadow-blue-900/30' : 'hover:shadow-md hover:shadow-blue-900/20'
          }`}
          style={{
            background: pathname === '/'
              ? 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(99, 102, 241, 0.08))',
            border: pathname === '/'
              ? '1px solid rgba(255, 255, 255, 0.15)'
              : '1px solid rgba(59, 130, 246, 0.18)',
          }}
        >
          <span
            className={`flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 transition-colors ${
              pathname === '/' ? 'bg-white/15' : 'bg-white/[0.06] group-hover:bg-white/10'
            }`}
          >
            <LayoutDashboard size={15} strokeWidth={2} className={pathname === '/' ? 'text-white' : 'text-blue-200'} />
          </span>
          <span className="flex-1 min-w-0">
            <span className={`block text-[13px] font-bold leading-none tracking-[-0.01em] ${
              pathname === '/' ? 'text-white' : 'text-slate-100 group-hover:text-white'
            }`}>
              대시보드
            </span>
            <span className={`block text-[9.5px] uppercase tracking-[0.14em] font-semibold mt-1 ${
              pathname === '/' ? 'text-blue-100/80' : 'text-slate-400 group-hover:text-blue-200'
            }`}>
              Home
            </span>
          </span>
          <ChevronRight size={13} className={`flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${
            pathname === '/' ? 'text-white/70' : 'text-slate-500'
          }`} />
        </Link>

        {/* 전역 메뉴 — 사업 초기 검토(토글) / 프로젝트 */}
        <NavGroup>
          {/* 사업 초기 검토 — 토글 서브메뉴 */}
          <CollapsibleItem
            item={BID_ITEM}
            active={isBid}
            open={bidOpen}
            onToggle={() => setBidOpen()}
            onNavigate={onClose}
          />
          {bidOpen && (
            <div className="ml-[18px] pl-3 border-l border-white/[0.06] space-y-px mt-0.5 mb-1">
              {BID_SUB.map(sub => {
                const subActive = isBid && activeBidTab === sub.tab
                const Icon = sub.icon
                return (
                  <Link
                    key={sub.tab}
                    href={`/bid?tab=${sub.tab}`}
                    onClick={onClose}
                    className={`flex items-center gap-2 px-2 h-7 rounded-md text-[12px] transition-colors no-underline ${
                      subActive
                        ? 'text-white font-medium'
                        : 'text-slate-500 hover:text-slate-200'
                    }`}
                  >
                    <Icon size={11} strokeWidth={1.75} className="flex-shrink-0" />
                    <span className="flex-1 truncate">{sub.label}</span>
                  </Link>
                )
              })}
            </div>
          )}

          <SidebarLink
            item={PROJECTS_ITEM}
            active={pathname.startsWith('/projects')}
            onNavigate={onClose}
          />
        </NavGroup>

        {/* 현재 프로젝트 섹션 — 포인트 강조 카드 */}
        {currentProject ? (
          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => setProjectOpen()}
              className="w-full flex items-center gap-1.5 px-2.5 py-1 mb-2 group"
            >
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-70" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400" />
                </span>
                <span className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.14em] group-hover:text-blue-200 transition-colors">
                  현재 프로젝트
                </span>
              </span>
              <ChevronRight
                size={11}
                className={`ml-auto text-slate-500 group-hover:text-slate-300 transition-all ${projectOpen ? 'rotate-90' : ''}`}
              />
            </button>
            {projectOpen && (
              <div
                className="relative mx-2 rounded-lg overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.05) 40%, transparent 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.18)',
                  boxShadow: '0 4px 16px -4px rgba(59, 130, 246, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                }}
              >
                {/* 좌측 accent bar */}
                <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-400 via-indigo-400 to-blue-500" />
                <div className="pt-1 pb-2">
                  <CurrentProjectSection project={currentProject} onNavigate={onClose} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <Section
            label="현재 프로젝트"
            open={projectOpen}
            onToggle={() => setProjectOpen()}
            accent="#64748b"
          >
            <div className="mx-2 mt-1 mb-1 p-3 rounded-lg border border-dashed border-white/10 bg-white/[0.02]">
              <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                프로젝트를 선택하면 <strong className="text-slate-200 font-semibold">프리콘·시공 관리·분석</strong> 메뉴가 여기에 나타납니다.
              </p>
              <Link
                href="/projects"
                onClick={onClose}
                className="inline-flex items-center gap-1 text-[11px] text-blue-300 hover:text-blue-200 font-medium no-underline"
              >
                프로젝트 목록 보기 <ChevronRight size={11} />
              </Link>
            </div>
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
              className="w-full flex items-center gap-2.5 px-3 h-9 rounded-md text-[13px] font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              <Settings size={14} strokeWidth={1.75} className="flex-shrink-0" />
              <span className="flex-1 text-left tracking-[-0.005em]">설정</span>
            </button>
          </NavGroup>
        </Section>
      </nav>

      {/* 하단 CTA — 새 프로젝트 */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-white/[0.06]">
        <Link
          href="/projects/new"
          onClick={onClose}
          className="group flex items-center justify-center gap-2 w-full h-10 rounded-lg text-white text-[13px] font-semibold shadow-lg shadow-orange-900/30 hover:shadow-orange-900/50 transition-all no-underline"
          style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
        >
          <Plus size={15} strokeWidth={2.5} />
          새 프로젝트
        </Link>
      </div>
    </div>
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
      className={`group relative flex items-center gap-2.5 px-3 h-9 rounded-md transition-colors duration-150 no-underline ${
        active
          ? 'text-white bg-white/[0.08]'
          : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      {active && (
        <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-blue-400 to-indigo-500" />
      )}
      <Icon size={14} strokeWidth={active ? 2 : 1.75} className={`flex-shrink-0 ${active ? 'text-blue-300' : ''}`} />
      <span className={`flex-1 text-[13px] leading-none truncate tracking-[-0.005em] ${active ? 'font-semibold' : 'font-medium'}`}>
        {item.label}
      </span>
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
      className={`relative flex items-center gap-0.5 h-9 rounded-md transition-colors duration-150 overflow-hidden ${
        active
          ? 'text-white bg-white/[0.08]'
          : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      {active && (
        <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-blue-400 to-indigo-500" />
      )}
      <Link
        href={item.href}
        onClick={onNavigate}
        className="flex items-center gap-2.5 pl-3 pr-1 h-full flex-1 min-w-0 no-underline"
      >
        <Icon size={14} strokeWidth={active ? 2 : 1.75} className={`flex-shrink-0 ${active ? 'text-blue-300' : ''}`} />
        <span className={`flex-1 text-[13px] leading-none truncate tracking-[-0.005em] ${active ? 'font-semibold' : 'font-medium'}`}>
          {item.label}
        </span>
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
    <div className="mt-5 pt-2 border-t border-white/[0.05]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-2.5 py-1 mb-0.5 group"
      >
        {accent && <span className="w-1 h-3 rounded-full flex-shrink-0" style={{ background: accent }} />}
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.12em] group-hover:text-slate-300 transition-colors">
          {label}
        </span>
        <ChevronRight
          size={11}
          className={`ml-auto text-slate-600 group-hover:text-slate-400 transition-all ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}
