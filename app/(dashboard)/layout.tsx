'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderKanban, Plus, Bell, Settings,
  Search, LayoutGrid, BarChart3, FileText, ChevronRight, Menu, X,
  Upload, ShieldCheck, Database, Users2, Calculator, ShieldAlert,
} from 'lucide-react'
import { ToastProvider } from '@/components/common/Toast'
import { CommandPaletteProvider, useCommandPalette } from '@/components/common/CommandPalette'
import Breadcrumb from '@/components/common/Breadcrumb'
import { ProjectProvider } from '@/lib/project-context/ProjectContext'
import ProjectSwitcher from '@/components/common/ProjectSwitcher'

// 업무 라이프사이클 4단계 기반 네비게이션
interface NavItem { href: string; label: string; icon: typeof LayoutDashboard; desc?: string }
interface NavStage { stage?: number; label: string; color: string; items: NavItem[]; cta?: NavItem }

const NAV_STAGES: NavStage[] = [
  {
    stage: 1,
    label: '사업 검토',
    color: '#2563eb',      // blue
    items: [
      { href: '/bid', label: '입찰·견적', icon: Calculator, desc: '개략공기·원가 시뮬' },
    ],
  },
  {
    stage: 2,
    label: '프리콘',
    color: '#16a34a',      // green
    items: [
      { href: '/projects', label: '프로젝트', icon: FolderKanban, desc: '공정 계획·프로세스맵' },
    ],
    cta: { href: '/projects/new', label: '새 프로젝트', icon: Plus },
  },
  {
    stage: 3,
    label: '시공 관리',
    color: '#ea580c',      // orange
    items: [
      { href: '/import', label: '엑셀 임포트', icon: Upload, desc: '과거 일보 일괄 등록' },
    ],
  },
  {
    stage: 4,
    label: '준공·데이터 자산',
    color: '#7c3aed',      // purple
    items: [
      { href: '/analytics', label: '전사 분석',  icon: BarChart3,   desc: '누적 인사이트' },
      { href: '/standards', label: '생산성 DB', icon: Database,    desc: '공종별 표준' },
      { href: '/risks',     label: 'R&O',      icon: ShieldAlert, desc: '리스크 라이브러리' },
      { href: '/companies', label: '협력사',    icon: Users2,      desc: '거래 이력' },
    ],
  },
]

// 최상단 대시보드 (단계 소속 안 함)
const DASHBOARD_ITEM: NavItem = { href: '/', label: '대시보드', icon: LayoutDashboard }
// 하단 관리 영역 (단계 소속 안 함)
const ADMIN_ITEMS: NavItem[] = [
  { href: '/admin/productivity', label: '관리자', icon: ShieldCheck, desc: '생산성 승인' },
]

// 현재 pathname에 해당하는 단계 번호 찾기
function getActiveStage(pathname: string): number | null {
  for (const stage of NAV_STAGES) {
    for (const item of stage.items) {
      if (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)) return stage.stage ?? null
    }
  }
  // 프로젝트 상세 페이지 → /projects/[id]는 '프리콘(2)'으로 간주
  if (pathname.startsWith('/projects/')) return 2
  return null
}

function TopBarSearch() {
  const palette = useCommandPalette()
  return (
    <button
      onClick={() => palette.open()}
      className="hidden lg:flex items-center gap-2 h-8 px-3 rounded-full bg-gray-50 border border-gray-200/80 w-56 hover:border-gray-300 transition-colors cursor-pointer text-left"
    >
      <Search size={13} className="text-gray-400" />
      <span className="text-xs text-gray-400 flex-1 truncate">검색 · 프로젝트 / 일보 / 공종...</span>
      <span className="text-[10px] text-gray-300 font-mono border border-gray-200 rounded px-1 bg-white">⌘K</span>
    </button>
  )
}

function SidebarLink({
  item, active, activeColor, onNavigate,
}: {
  item: NavItem
  active: boolean
  activeColor: string
  onNavigate: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex items-center gap-2.5 px-2 h-9 rounded-lg transition-all no-underline ${
        active
          ? 'text-white font-semibold shadow-sm'
          : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
      }`}
      style={active ? { background: activeColor } : undefined}
    >
      <Icon size={15} className="flex-shrink-0" />
      <span className="flex-1 text-[13px] leading-none truncate">{item.label}</span>
      {active && <span className="w-1 h-4 bg-white/60 rounded-full flex-shrink-0" />}
    </Link>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const activeStage = getActiveStage(pathname)

  return (
    <ToastProvider>
    <ProjectProvider>
    <CommandPaletteProvider>
    <div className="flex h-full relative" style={{ background: '#fafafa' }}>

      {/* 모바일 사이드바 오버레이 */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* 사이드바 (lg 이상 고정, 이하는 슬라이드인) */}
      <aside className={`
        sidebar-nav w-56 flex-shrink-0 flex flex-col text-white
        fixed lg:static inset-y-0 left-0 z-50
        transition-transform duration-200
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} style={{ background: '#1e293b' }}>
        {/* 로고 영역 — 컴팩트 */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-white/10 flex-shrink-0">
          <Link href="/" onClick={() => setMobileSidebarOpen(false)} className="flex items-baseline gap-1.5 no-underline">
            <h1 className="text-base font-extrabold tracking-tight text-white leading-none">
              Quick<span className="text-[#3b82f6]">Plan</span>
            </h1>
            <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em]">CLSP</span>
          </Link>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden p-1 -mr-1 text-slate-400 hover:text-white"
            aria-label="메뉴 닫기"
          ><X size={16} /></button>
        </div>

        {/* 네비 — 4단계 구조 */}
        <nav className="sidebar-scroll flex-1 px-2 py-2 overflow-y-auto">
          {/* 대시보드 (최상단, 단계 무소속) */}
          <SidebarLink
            item={DASHBOARD_ITEM}
            active={pathname === '/'}
            activeColor="#3b82f6"
            onNavigate={() => setMobileSidebarOpen(false)}
          />

          {/* 4단계 그룹 */}
          {NAV_STAGES.map(stage => {
            const stageActive = activeStage === stage.stage
            return (
              <div key={stage.label} className="mt-3">
                {/* 그룹 헤더 */}
                <div className="flex items-center gap-2 px-2 pb-1">
                  <span
                    className="w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={{
                      background: stageActive ? stage.color : 'rgba(255,255,255,0.08)',
                      color: stageActive ? '#fff' : stage.color,
                    }}
                  >{stage.stage}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${
                    stageActive ? 'text-white' : 'text-slate-500'
                  }`}>
                    {stage.label}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {stage.items.map(item => {
                    const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                    return (
                      <SidebarLink
                        key={item.href}
                        item={item}
                        active={active}
                        activeColor={stage.color}
                        onNavigate={() => setMobileSidebarOpen(false)}
                      />
                    )
                  })}
                  {stage.cta && (
                    <Link
                      href={stage.cta.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      className="flex items-center gap-2 mx-2 mt-1 h-8 px-2 rounded-md text-[11px] font-semibold text-slate-300 border border-dashed border-white/15 hover:border-white/40 hover:bg-white/[0.04] hover:text-white transition-colors no-underline"
                    >
                      <Plus size={12} className="flex-shrink-0" />
                      {stage.cta.label}
                    </Link>
                  )}
                </div>
              </div>
            )
          })}

          {/* 관리 영역 */}
          <div className="mt-4 pt-3 border-t border-white/[0.06]">
            <p className="px-2 pb-1 text-[9px] font-bold text-slate-500 uppercase tracking-[0.12em]">관리</p>
            <div className="space-y-0.5">
              {ADMIN_ITEMS.map(item => {
                const active = pathname.startsWith(item.href)
                return (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    active={active}
                    activeColor="#64748b"
                    onNavigate={() => setMobileSidebarOpen(false)}
                  />
                )
              })}
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-2 h-9 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
              >
                <Settings size={15} className="flex-shrink-0" />
                <span className="flex-1 text-left text-[13px]">설정</span>
              </button>
            </div>
          </div>
        </nav>
      </aside>

      {/* 본문 */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* 상단 네비 */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center px-3 sm:px-6 gap-2 sm:gap-4 flex-shrink-0">
          {/* 모바일 햄버거 */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-md hover:bg-gray-100 text-gray-600"
            aria-label="메뉴 열기"
          >
            <Menu size={20} />
          </button>

          <Image src="/tongyang-logo.png" alt="TONGYANG" height={28} width={140} className="object-contain h-6 sm:h-7 w-auto flex-shrink-0" />

          <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block" />
          <ProjectSwitcher />

          <div className="ml-auto flex items-center gap-2">
            <TopBarSearch />
            <div className="w-px h-5 bg-gray-200 mx-1 hidden sm:block" />
            <button className="flex items-center gap-2 h-8 pl-1 pr-3 rounded-full hover:bg-gray-50 transition-colors">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2563eb] to-[#7c3aed] flex items-center justify-center text-white text-[11px] font-bold shadow-sm">K</div>
              <span className="text-xs font-medium text-gray-600 hidden lg:block">관리자</span>
            </button>
          </div>
        </header>

        {/* 브레드크럼 */}
        <Breadcrumb />

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-auto" style={{ background: '#fafafa' }}>
          {children}
        </main>
      </div>
    </div>
    </CommandPaletteProvider>
    </ProjectProvider>
    </ToastProvider>
  )
}
