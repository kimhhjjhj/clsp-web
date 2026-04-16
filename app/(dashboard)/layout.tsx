'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FolderOpen, Plus, Building2 } from 'lucide-react'

const navItems = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/projects/new', label: '새 프로젝트', icon: Plus },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full">
      {/* 사이드바 */}
      <aside className="w-60 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* 로고 */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-800">
          <Building2 className="text-blue-400" size={22} />
          <div>
            <div className="text-sm font-bold text-white leading-none">QuickPlan</div>
            <div className="text-[10px] text-gray-500 mt-0.5">공기산정 시스템</div>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}

          {/* 프로젝트 목록 */}
          <div className="pt-4">
            <div className="flex items-center gap-2 px-3 mb-2">
              <FolderOpen size={13} className="text-gray-600" />
              <span className="text-[11px] text-gray-600 uppercase tracking-wider font-medium">
                프로젝트
              </span>
            </div>
            <ProjectList currentPath={pathname} />
          </div>
        </nav>

        {/* 버전 */}
        <div className="px-5 py-3 border-t border-gray-800">
          <span className="text-[11px] text-gray-600">CLSP v1.0 MVP</span>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

// 사이드바용 프로젝트 목록 (클라이언트 컴포넌트)
function ProjectList({ currentPath }: { currentPath: string }) {
  // 간단한 구현 — 실제 목록은 대시보드 페이지에서 관리
  return (
    <div className="text-[12px] text-gray-600 px-3 py-1">
      대시보드에서 확인하세요
    </div>
  )
}
