'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Search, Menu } from 'lucide-react'
import { ToastProvider } from '@/components/common/Toast'
import { CommandPaletteProvider, useCommandPalette } from '@/components/common/CommandPalette'
import GlobalShortcuts from '@/components/common/GlobalShortcuts'
import Breadcrumb from '@/components/common/Breadcrumb'
import { ProjectProvider } from '@/lib/project-context/ProjectContext'
import ProjectSwitcher from '@/components/common/ProjectSwitcher'
import Sidebar from '@/components/layout/Sidebar'

function TopBarSearch() {
  const palette = useCommandPalette()
  return (
    <button
      onClick={() => palette.open()}
      className="hidden lg:flex items-center gap-2 h-8 px-3 rounded-full bg-gray-50 border border-gray-200/80 w-56 hover:border-gray-300 transition-colors cursor-pointer text-left"
      title="⌘K · /  검색  ·  ?  단축키 도움말"
    >
      <Search size={13} className="text-gray-400" />
      <span className="text-xs text-gray-400 flex-1 truncate">검색 · 프로젝트 / 일보 / 공종...</span>
      <span className="text-[10px] text-gray-300 font-mono border border-gray-200 rounded px-1 bg-white">⌘K</span>
    </button>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <ToastProvider>
      <ProjectProvider>
        <CommandPaletteProvider>
          <GlobalShortcuts />
          <div className="flex h-full relative" style={{ background: '#d9dfe8' }}>
            {/* 모바일 사이드바 오버레이 */}
            {mobileSidebarOpen && (
              <div
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setMobileSidebarOpen(false)}
              />
            )}

            {/* 사이드바 */}
            <aside className={`
              w-60 flex-shrink-0 flex flex-col text-white
              fixed lg:static inset-y-0 left-0 z-50
              transition-transform duration-200 shadow-xl shadow-black/20
              ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `} style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #172133 100%)' }}>
              <Sidebar onClose={() => setMobileSidebarOpen(false)} />
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
              <main className="flex-1 overflow-auto" style={{ background: '#d9dfe8' }}>
                {children}
              </main>
            </div>
          </div>
        </CommandPaletteProvider>
      </ProjectProvider>
    </ToastProvider>
  )
}
