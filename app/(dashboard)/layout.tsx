'use client'

import { Suspense, useState } from 'react'
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
      className="hidden md:flex items-center gap-2.5 h-10 px-4 rounded-xl bg-slate-100/70 border border-slate-200/80 flex-1 max-w-md hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer text-left"
      title="⌘K · /  검색  ·  ?  단축키 도움말"
    >
      <Search size={15} className="text-slate-400 flex-shrink-0" strokeWidth={2.25} />
      <span className="text-sm text-slate-500 flex-1 truncate">프로젝트·일보·공종 검색...</span>
      <span className="text-[10px] text-slate-400 font-mono border border-slate-300 rounded px-1.5 py-0.5 bg-white flex-shrink-0">⌘K</span>
    </button>
  )
}

// 모바일 전용 검색 아이콘 (md 미만에서만 표시, 데스크톱 TopBarSearch와 병존)
function MobileSearchButton() {
  const palette = useCommandPalette()
  return (
    <button
      onClick={() => palette.open()}
      className="md:hidden p-2 rounded-md hover:bg-slate-100 text-slate-600 flex-shrink-0"
      aria-label="검색"
    >
      <Search size={18} />
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
          <div className="flex h-full relative app-canvas">
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
            `} style={{
              background: '#0A0A0A',
              borderRight: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <Suspense fallback={null}>
                <Sidebar onClose={() => setMobileSidebarOpen(false)} />
              </Suspense>
            </aside>

            {/* 본문 */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 상단 네비 */}
              <header className="h-[60px] bg-white/80 backdrop-blur border-b border-[var(--border-default)] flex items-center px-3 sm:px-5 gap-3 flex-shrink-0 relative z-10">
                {/* 모바일 햄버거 */}
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="lg:hidden p-1.5 -ml-1 rounded-md hover:bg-black/[0.04] text-[var(--text-secondary)]"
                  aria-label="메뉴 열기"
                >
                  <Menu size={18} />
                </button>

                <Image src="/tongyang-logo.png" alt="TONGYANG" height={28} width={120} className="hidden sm:block object-contain h-7 w-auto flex-shrink-0 opacity-75" />

                <div className="h-5 w-px bg-[var(--border-default)] mx-1 hidden sm:block" />
                <ProjectSwitcher />

                {/* 중앙 검색 */}
                <div className="flex-1 flex justify-center">
                  <TopBarSearch />
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <MobileSearchButton />
                  <button
                    className="flex items-center gap-2 h-8 pl-0.5 pr-2 rounded-md hover:bg-black/[0.04] transition-colors"
                    aria-label="계정"
                  >
                    <div className="w-7 h-7 rounded-md bg-[var(--text-primary)] flex items-center justify-center text-white text-[11px] font-semibold">K</div>
                    <span className="text-[13px] font-medium text-[var(--text-primary)] hidden lg:block">관리자</span>
                  </button>
                </div>
              </header>

              {/* 브레드크럼 */}
              <Breadcrumb />

              {/* 메인 콘텐츠 */}
              <main className="flex-1 overflow-auto app-main">
                {children}
              </main>
            </div>
          </div>
        </CommandPaletteProvider>
      </ProjectProvider>
    </ToastProvider>
  )
}
