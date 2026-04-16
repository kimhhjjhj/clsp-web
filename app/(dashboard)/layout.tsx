'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Clock, HardHat, Truck,
  CheckSquare, Archive, Plus, Bell, Settings, HelpCircle,
  Building2, Search, MessageSquare,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// ── Sidebar nav items ──────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/',           label: '전체 프로젝트',  icon: LayoutDashboard },
  { href: '/schedules',  label: '진행 공정표',    icon: Clock },
  { href: '/pre-con',    label: '착공 전 단계',   icon: HardHat },
  { href: '/logistics',  label: '현장 물류',      icon: Truck },
  { href: '/closeout',   label: '준공 처리',      icon: CheckSquare },
  { href: '/archive',    label: '아카이브',       icon: Archive },
]

// ── Top nav links ──────────────────────────────────────────────────────
const TOP_NAV = [
  { href: '/',         label: '대시보드' },
  { href: '/projects', label: '프로젝트' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isDash    = pathname === '/'
  const isProject = pathname.startsWith('/projects')

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── TOP NAVIGATION BAR ──────────────────────── */}
      <header className="flex-shrink-0 h-14 border-b border-border bg-card flex items-center gap-0 px-0 z-30">

        {/* Brand — same width as sidebar */}
        <div className="w-56 flex-shrink-0 flex items-center gap-3 px-4 h-full border-r border-border">
          <div className="w-8 h-8 rounded-lg bg-clsp-navy flex items-center justify-center flex-shrink-0">
            <Building2 size={15} className="text-white" />
          </div>
          <div className="leading-none">
            <div className="text-sm font-bold tracking-tight text-clsp-navy">CLSP</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">Scheduler</div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex items-center h-full px-4 gap-1">
          {TOP_NAV.map(({ href, label }) => {
            const active = href === '/' ? isDash : isProject
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 h-full flex items-center text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-clsp-navy text-clsp-navy'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2 px-4">
          {/* Search */}
          <div className="hidden lg:flex items-center gap-2 h-8 px-3 rounded-lg bg-muted/60 border border-border text-sm text-muted-foreground w-48">
            <Search size={13} />
            <span className="text-xs">프로젝트 검색...</span>
          </div>

          <button className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Bell size={16} />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Settings size={16} />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <HelpCircle size={16} />
          </button>

          {/* Avatar */}
          <Avatar className="w-8 h-8 border-2 border-clsp-orange cursor-pointer">
            <AvatarImage src="" />
            <AvatarFallback className="bg-clsp-navy text-white text-xs font-semibold">K</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* ── BODY ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR ─────────────────────────────────── */}
        <aside className="w-56 flex-shrink-0 bg-card border-r border-border flex flex-col">

          {/* Nav items */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                    active
                      ? 'bg-clsp-navy text-white font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* Bottom actions */}
          <div className="px-3 space-y-1 border-t border-border pt-3 pb-3">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
              <MessageSquare size={15} />
              팀 채팅
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
              <HelpCircle size={15} />
              고객지원
            </button>
          </div>

          {/* New Project button */}
          <div className="px-3 pb-4 pt-2">
            <Link
              href="/projects/new"
              className="flex items-center justify-center gap-2 w-full h-9 rounded-md bg-clsp-navy text-white text-sm font-medium hover:bg-clsp-navy/90 transition-colors no-underline"
            >
              <Plus size={15} />
              새 프로젝트
            </Link>
          </div>
        </aside>

        {/* ── MAIN CONTENT ──────────────────────────────── */}
        <main className="flex-1 overflow-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
