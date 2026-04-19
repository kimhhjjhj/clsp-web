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
              background: `
                radial-gradient(600px 400px at 100% 0%, rgba(99, 102, 241, 0.12), transparent 60%),
                linear-gradient(180deg, #0b1020 0%, #0f172a 40%, #0b1020 100%)
              `,
            }}>
              <Suspense fallback={null}>
                <Sidebar onClose={() => setMobileSidebarOpen(false)} />
              </Suspense>
            </aside>

            {/* 본문 */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 상단 네비 */}
              <header className="h-16 bg-white border-b border-slate-200 flex items-center px-3 sm:px-6 gap-3 sm:gap-5 flex-shrink-0">
                {/* 모바일 햄버거 */}
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="lg:hidden p-2 -ml-1 rounded-md hover:bg-slate-100 text-slate-600"
                  aria-label="메뉴 열기"
                >
                  <Menu size={20} />
                </button>

                <Image src="/tongyang-logo.png" alt="TONGYANG" height={32} width={150} className="hidden sm:block object-contain h-8 w-auto flex-shrink-0" />

                <div className="h-7 w-px bg-slate-200 mx-1 hidden sm:block" />
                <ProjectSwitcher />

                {/* 중앙 검색 — flex로 가운데 정렬 */}
                <div className="flex-1 flex justify-center">
                  <TopBarSearch />
                </div>

                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <MobileSearchButton />
                  <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />
                  <button className="flex items-center gap-2 h-9 pl-1 pr-2 sm:pr-3 rounded-full hover:bg-slate-100 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xs font-bold shadow-sm ring-2 ring-white">K</div>
                    <span className="text-sm font-medium text-slate-700 hidden lg:block">관리자</span>
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
