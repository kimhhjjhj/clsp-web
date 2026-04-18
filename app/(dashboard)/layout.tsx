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

// 3개 그룹으로 정리
const NAV_GROUPS: { label: string; items: { href: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: '운영',
    items: [
      { href: '/',          label: '대시보드',  icon: LayoutDashboard },
      { href: '/projects',  label: '프로젝트',  icon: FolderKanban },
      { href: '/bid',       label: '입찰·견적', icon: Calculator },
    ],
  },
  {
    label: '데이터',
    items: [
      { href: '/analytics', label: '전사 분석',  icon: BarChart3 },
      { href: '/standards', label: '생산성 DB', icon: Database },
      { href: '/risks',     label: 'R&O',      icon: ShieldAlert },
      { href: '/companies', label: '협력사',    icon: Users2 },
    ],
  },
  {
    label: '도구',
    items: [
      { href: '/import',             label: '엑셀 임포트', icon: Upload },
      { href: '/admin/productivity', label: '관리자',     icon: ShieldCheck },
    ],
  },
]

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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <ToastProvider>
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

        {/* 신규 프로젝트 CTA — 상단 배치 */}
        <div className="px-3 pt-3 flex-shrink-0">
          <Link href="/projects/new"
            onClick={() => setMobileSidebarOpen(false)}
            className="flex items-center justify-center gap-1.5 w-full h-9 rounded-lg text-white text-xs font-semibold transition-all no-underline bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:shadow-md hover:shadow-blue-500/25 active:scale-[0.98]"
          >
            <Plus size={13} />새 프로젝트
          </Link>
        </div>

        {/* 네비 — 그룹 구분, 컴팩트 */}
        <nav className="sidebar-scroll flex-1 px-2 py-3 overflow-y-auto">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-3 pt-3 border-t border-white/[0.06]' : ''}>
              <p className="px-2 pb-1 text-[9px] font-bold text-slate-500 uppercase tracking-[0.12em]">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileSidebarOpen(false)}
                      className={`group flex items-center gap-2.5 px-2 h-9 rounded-lg text-sm transition-all no-underline ${
                        active
                          ? 'bg-blue-600/90 text-white font-semibold shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      <Icon size={15} className="flex-shrink-0" />
                      <span className="flex-1 text-[13px] leading-none">{label}</span>
                      {active && <span className="w-1 h-4 bg-white/60 rounded-full flex-shrink-0" />}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* 하단 설정 */}
        <div className="px-2 py-3 border-t border-white/[0.06] flex-shrink-0">
          <button className="w-full flex items-center gap-2.5 px-2 h-8 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-colors">
            <Settings size={13} />
            <span className="flex-1 text-left">설정</span>
          </button>
        </div>
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

          <Image src="/tongyang-logo.png" alt="TONGYANG" height={28} width={140} className="object-contain h-6 sm:h-7 w-auto" />

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
    </ToastProvider>
  )
}
