'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderKanban, Plus, Bell, Settings,
  Search, LayoutGrid, BarChart3, FileText, ChevronRight,
} from 'lucide-react'
import { ToastProvider } from '@/components/common/Toast'
import { CommandPaletteProvider, useCommandPalette } from '@/components/common/CommandPalette'
import Breadcrumb from '@/components/common/Breadcrumb'

const NAV_ITEMS = [
  { href: '/',         label: '대시보드',     icon: LayoutDashboard, desc: '전체 현황' },
  { href: '/projects', label: '프로젝트',     icon: FolderKanban,    desc: '공정 관리' },
  { href: '#',         label: '보고서',       icon: FileText,        desc: '문서 출력',  disabled: true },
  { href: '#',         label: '분석',         icon: BarChart3,       desc: '데이터 환류', disabled: true },
]

const TOP_TABS = [
  { href: '/',         label: '대시보드', icon: LayoutDashboard },
  { href: '/projects', label: '프로젝트', icon: FolderKanban },
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

  return (
    <ToastProvider>
    <CommandPaletteProvider>
    <div className="flex h-full" style={{ background: '#fafafa' }}>

      {/* 사이드바 */}
      <aside className="w-56 flex-shrink-0 flex flex-col text-white" style={{ background: '#1e293b' }}>
        <Link href="/" className="block px-5 py-6 border-b border-white/10 no-underline group">
          <h1 className="text-lg font-extrabold tracking-tight text-white leading-tight">
            Quick<span className="text-[#3b82f6]">Plan</span>
          </h1>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.15em] mt-1">Construction Lifecycle</p>
          <p className="text-[11px] text-slate-500 mt-0.5">통합 공정관리 플랫폼</p>
        </Link>

        <p className="px-5 pt-5 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">메뉴</p>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon, desc, disabled }) => {
            const active = !disabled && (href === '/' ? pathname === '/' : pathname.startsWith(href))
            return (
              <Link key={label} href={href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all no-underline ${
                  disabled
                    ? 'opacity-30 pointer-events-none'
                    : active
                      ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-lg shadow-blue-500/20 font-medium'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.07]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  active ? 'bg-white/20' : 'bg-white/[0.05] group-hover:bg-white/10'
                }`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium leading-tight">{label}</div>
                  <div className={`text-[10px] leading-tight mt-0.5 ${active ? 'text-white/60' : 'text-slate-600'}`}>{desc}</div>
                </div>
                {active && <ChevronRight size={14} className="text-white/40 flex-shrink-0" />}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 pb-3 border-t border-white/[0.06] pt-3 space-y-2">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-colors">
            <Settings size={14} />설정
          </button>
          <Link href="/projects/new"
            className="flex items-center justify-center gap-2 w-full h-10 rounded-xl text-white text-sm font-semibold transition-all no-underline bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={15} />새 프로젝트
          </Link>
        </div>
      </aside>

      {/* 본문 */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* 상단 네비 */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center px-6 gap-4 flex-shrink-0">
          <Image src="/tongyang-logo.png" alt="TONGYANG" height={28} width={140} className="object-contain h-7 w-auto" />

          <div className="w-px h-6 bg-gray-200 mx-1" />

          <nav className="flex items-center h-full gap-0.5 ml-1">
            {TOP_TABS.map(({ href, label, icon: Icon }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
              return (
                <Link key={href} href={href}
                  className={`relative px-4 h-full flex items-center gap-2 text-[13px] font-medium transition-colors no-underline ${
                    active ? 'text-[#1e293b]' : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  <Icon size={14} className={active ? 'text-[#2563eb]' : ''} />
                  {label}
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-full bg-gradient-to-r from-[#2563eb] to-[#3b82f6]" />
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <TopBarSearch />
            <button className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors relative">
              <Bell size={15} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2563eb] ring-2 ring-white" />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"><LayoutGrid size={15} /></button>
            <div className="w-px h-5 bg-gray-200 mx-1" />
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
