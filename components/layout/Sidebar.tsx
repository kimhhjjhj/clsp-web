'use client'

// ═══════════════════════════════════════════════════════════
// 사이드바 — 2층 구조
// 1) 전역 메뉴: 대시보드·프로젝트·입찰견적
// 2) 현재 프로젝트 (선택 시만): 4단계 + 상태 배지
// 3) 전사 자산: 분석·생산성DB·R&O·협력사
// 4) 관리: 엑셀임포트·관리자·설정
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderKanban, Calculator, BarChart3, Database, ShieldAlert, Users2,
  Upload, ShieldCheck, Settings, X,
} from 'lucide-react'
import { useProjectContext } from '@/lib/project-context/ProjectContext'
import CurrentProjectSection from './CurrentProjectSection'

interface NavItem { href: string; label: string; icon: typeof LayoutDashboard }

const GLOBAL_ITEMS: NavItem[] = [
  { href: '/',         label: '대시보드',   icon: LayoutDashboard },
  { href: '/projects', label: '프로젝트',   icon: FolderKanban },
  { href: '/bid',      label: '입찰·견적',  icon: Calculator },
]

const ASSET_ITEMS: NavItem[] = [
  { href: '/analytics', label: '분석',      icon: BarChart3 },
  { href: '/standards', label: '생산성 DB', icon: Database },
  { href: '/risks',     label: 'R&O',      icon: ShieldAlert },
  { href: '/companies', label: '협력사',    icon: Users2 },
]

const ADMIN_ITEMS: NavItem[] = [
  { href: '/import',             label: '엑셀 일괄 임포트', icon: Upload },
  { href: '/admin/productivity', label: '관리자 승인',      icon: ShieldCheck },
]

interface Props {
  onClose: () => void
}

export default function Sidebar({ onClose }: Props) {
  const pathname = usePathname() ?? ''
  const { currentProject } = useProjectContext()

  return (
    <>
      {/* 로고 */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-white/10 flex-shrink-0">
        <Link href="/" onClick={onClose} className="flex items-baseline gap-1.5 no-underline">
          <h1 className="text-base font-extrabold tracking-tight text-white leading-none">
            Quick<span className="text-[#3b82f6]">Plan</span>
          </h1>
          <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em]">CLSP</span>
        </Link>
        <button
          onClick={onClose}
          className="lg:hidden p-1 -mr-1 text-slate-400 hover:text-white"
          aria-label="메뉴 닫기"
        ><X size={16} /></button>
      </div>

      {/* 본문 — 스크롤 */}
      <nav className="sidebar-scroll flex-1 px-2 py-3 overflow-y-auto">
        {/* 전역 메뉴 */}
        <NavGroup>
          {GLOBAL_ITEMS.map(item => (
            <SidebarLink
              key={item.href}
              item={item}
              active={item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)}
              onNavigate={onClose}
            />
          ))}
        </NavGroup>

        {/* 현재 프로젝트 섹션 */}
        {currentProject && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <CurrentProjectSection project={currentProject} onNavigate={onClose} />
          </div>
        )}

        {/* 전사 자산 */}
        <div className="mt-4 pt-3 border-t border-white/[0.06]">
          <p className="px-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">
            전사 자산
          </p>
          <NavGroup>
            {ASSET_ITEMS.map(item => (
              <SidebarLink
                key={item.href}
                item={item}
                active={pathname.startsWith(item.href)}
                onNavigate={onClose}
              />
            ))}
          </NavGroup>
        </div>

        {/* 관리 */}
        <div className="mt-4 pt-3 border-t border-white/[0.06]">
          <p className="px-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">
            관리
          </p>
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
        </div>
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
