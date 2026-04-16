'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Activity, HardHat, Plus, Bell, Settings,
  Search, LayoutGrid,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/',         label: '대시보드',   icon: HardHat },
  { href: '/projects', label: '프로젝트',   icon: Activity },
]

const TOP_TABS = [
  { href: '/',         label: '대시보드' },
  { href: '/projects', label: '프로젝트' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full" style={{ background: '#fafafa' }}>

      {/* 사이드바 */}
      <aside className="w-56 flex-shrink-0 flex flex-col text-white" style={{ background: '#1e293b' }}>
        <div className="px-4 py-5 border-b border-white/10">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Project Lifecycle</p>
          <p className="text-[11px] text-slate-300">통합 공정관리</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors no-underline ${
                  active ? 'bg-[#2563eb] text-white font-medium' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={15} className="flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 pb-3 border-t border-white/10 pt-3">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
            <Settings size={14} />설정
          </button>
        </div>

        <div className="px-3 pb-4 pt-2">
          <Link href="/projects/new"
            className="flex items-center justify-center gap-2 w-full h-9 rounded-md text-white text-sm font-medium transition-colors no-underline"
            style={{ background: '#2563eb' }}
          >
            <Plus size={15} />새 프로젝트 생성
          </Link>
        </div>
      </aside>

      {/* 본문 */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* 상단 네비 */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-6 flex-shrink-0">
          <Image src="/tongyang-logo.png" alt="TONGYANG" height={28} width={140} className="object-contain h-7 w-auto" />

          <nav className="flex items-center h-full gap-1 ml-4">
            {TOP_TABS.map(({ href, label }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
              return (
                <Link key={href} href={href}
                  className={`px-4 h-full flex items-center text-sm font-medium border-b-2 transition-colors no-underline ${
                    active ? 'border-[#2563eb] text-[#2563eb]' : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 h-8 px-3 rounded-lg bg-gray-100 border border-gray-200 w-44">
              <Search size={13} className="text-gray-400" />
              <span className="text-xs text-gray-400">프로젝트 검색...</span>
            </div>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"><Bell size={16} /></button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"><Settings size={16} /></button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"><LayoutGrid size={16} /></button>
            <div className="w-8 h-8 rounded-full bg-[#2563eb] flex items-center justify-center text-white text-xs font-bold">K</div>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-auto" style={{ background: '#fafafa' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
