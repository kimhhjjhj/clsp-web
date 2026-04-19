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

// 사업 초기 검토 내부 서브탭 (공사비·공기)
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
        {/* 전역 상단 3버튼 — 홈·기획·운영, 통일된 포인트 스타일 */}
        <AccentNavButton
          href="/"
          label="대시보드"
          kicker="Home"
          icon={LayoutDashboard}
          accent="blue"
          active={pathname === '/'}
          onNavigate={onClose}
        />

        <AccentNavButton
          href="/bid"
          label="사업 초기 검토"
          kicker="Bid · Plan"
          icon={ClipboardCheck}
          accent="violet"
          active={isBid}
          onNavigate={onClose}
          expandable
          expanded={bidOpen}
          onToggle={() => setBidOpen()}
        />
        {bidOpen && (
          <div
            className="relative mx-2 -mt-1 mb-3 rounded-lg overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.05) 40%, transparent 100%)',
              border: '1px solid rgba(139, 92, 246, 0.18)',
              boxShadow: '0 4px 16px -4px rgba(139, 92, 246, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
            }}
          >
            <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-violet-400 via-indigo-400 to-violet-500" />
            <div className="py-1.5 space-y-px">
              {BID_SUB.map(sub => {
                const subActive = isBid && activeBidTab === sub.tab
                const Icon = sub.icon
                return (
                  <Link
                    key={sub.tab}
                    href={`/bid?tab=${sub.tab}`}
                    onClick={onClose}
                    className={`mx-1.5 flex items-center gap-2 pl-2.5 pr-2 h-8 rounded-md text-[12px] transition-colors no-underline ${
                      subActive
                        ? 'text-white font-semibold bg-white/[0.06]'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]'
                    }`}
                  >
                    <Icon size={12} strokeWidth={1.75} className={`flex-shrink-0 ${subActive ? 'text-violet-300' : ''}`} />
                    <span className="flex-1 truncate">{sub.label}</span>
                    {subActive && <span className="w-1 h-1 rounded-full bg-violet-300 flex-shrink-0" />}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        <AccentNavButton
          href="/projects"
          label="프로젝트"
          kicker="Projects"
          icon={FolderKanban}
          accent="emerald"
          active={pathname.startsWith('/projects')}
          onNavigate={onClose}
        />

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

// 상단 포인트 버튼 — 대시보드·사업초기검토·프로젝트 3개를 통일된 스타일로
type AccentColor = 'blue' | 'violet' | 'emerald'

const ACCENT_STYLE: Record<AccentColor, {
  grad: string       // active: 솔리드 그라데이션
  tint: string       // idle: 은은한 틴트
  borderActive: string
  borderIdle: string
  shadowActive: string
  shadowHover: string
  iconIdle: string   // 비활성 아이콘 색
  kickerIdle: string // 비활성 부제 색 (hover 포함)
  kickerActive: string
}> = {
  blue: {
    grad: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    tint: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(99, 102, 241, 0.08))',
    borderActive: 'rgba(255, 255, 255, 0.15)',
    borderIdle: 'rgba(59, 130, 246, 0.18)',
    shadowActive: 'shadow-lg shadow-blue-900/30',
    shadowHover: 'hover:shadow-md hover:shadow-blue-900/20',
    iconIdle: 'text-blue-200',
    kickerIdle: 'text-slate-400 group-hover:text-blue-200',
    kickerActive: 'text-blue-100/80',
  },
  violet: {
    grad: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
    tint: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(99, 102, 241, 0.08))',
    borderActive: 'rgba(255, 255, 255, 0.15)',
    borderIdle: 'rgba(139, 92, 246, 0.18)',
    shadowActive: 'shadow-lg shadow-violet-900/30',
    shadowHover: 'hover:shadow-md hover:shadow-violet-900/20',
    iconIdle: 'text-violet-200',
    kickerIdle: 'text-slate-400 group-hover:text-violet-200',
    kickerActive: 'text-violet-100/80',
  },
  emerald: {
    grad: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
    tint: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(20, 184, 166, 0.08))',
    borderActive: 'rgba(255, 255, 255, 0.15)',
    borderIdle: 'rgba(16, 185, 129, 0.18)',
    shadowActive: 'shadow-lg shadow-emerald-900/30',
    shadowHover: 'hover:shadow-md hover:shadow-emerald-900/20',
    iconIdle: 'text-emerald-200',
    kickerIdle: 'text-slate-400 group-hover:text-emerald-200',
    kickerActive: 'text-emerald-100/80',
  },
}

function AccentNavButton({
  href, label, kicker, icon: Icon, accent, active, onNavigate,
  expandable, expanded, onToggle,
}: {
  href: string
  label: string
  kicker: string
  icon: typeof LayoutDashboard
  accent: AccentColor
  active: boolean
  onNavigate: () => void
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
}) {
  const a = ACCENT_STYLE[accent]
  return (
    <div
      className={`relative flex items-center rounded-xl overflow-hidden mb-2 transition-all ${
        active ? a.shadowActive : a.shadowHover
      }`}
      style={{
        background: active ? a.grad : a.tint,
        border: `1px solid ${active ? a.borderActive : a.borderIdle}`,
      }}
    >
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={`group flex items-center gap-3 flex-1 min-w-0 px-3 h-11 no-underline ${expandable ? 'pr-1' : ''}`}
      >
        <span
          className={`flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 transition-colors ${
            active ? 'bg-white/15' : 'bg-white/[0.06] group-hover:bg-white/10'
          }`}
        >
          <Icon size={15} strokeWidth={2} className={active ? 'text-white' : a.iconIdle} />
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block text-[13px] font-bold leading-none tracking-[-0.01em] ${
            active ? 'text-white' : 'text-slate-100 group-hover:text-white'
          }`}>
            {label}
          </span>
          <span className={`block text-[9.5px] uppercase tracking-[0.14em] font-semibold mt-1 ${
            active ? a.kickerActive : a.kickerIdle
          }`}>
            {kicker}
          </span>
        </span>
        {!expandable && (
          <ChevronRight size={13} className={`flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${
            active ? 'text-white/70' : 'text-slate-500'
          }`} />
        )}
      </Link>
      {expandable && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? '접기' : '펼치기'}
          className={`h-11 px-3 flex items-center justify-center transition-colors border-l ${
            active
              ? 'border-white/15 hover:bg-white/10 text-white/80'
              : 'border-white/[0.06] hover:bg-white/[0.05] text-slate-400 hover:text-slate-100'
          }`}
        >
          <ChevronRight
            size={13}
            className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </button>
      )}
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
