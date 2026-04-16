'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderKanban, Clock, HardHat, Truck,
  CheckSquare, Archive, Plus, Bell, Settings, ChevronRight,
  Building2, Search,
} from 'lucide-react'

// ── Sidebar nav items ──────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/',             label: 'All Projects',      icon: LayoutDashboard },
  { href: '/schedules',    label: 'Active Schedules',  icon: Clock },
  { href: '/pre-con',      label: 'Pre-Construction',  icon: HardHat },
  { href: '/logistics',    label: 'Site Logistics',    icon: Truck },
  { href: '/closeout',     label: 'Closeout',          icon: CheckSquare },
  { href: '/archive',      label: 'Archive',           icon: Archive },
]

// ── Top nav links ──────────────────────────────────────────────────────
const TOP_NAV = [
  { href: '/',          label: 'Dashboard' },
  { href: '/projects',  label: 'Projects'  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // active detection helpers
  const isDash    = pathname === '/'
  const isProject = pathname.startsWith('/projects')

  return (
    <div className="flex flex-col h-full">

      {/* ── TOP NAVIGATION BAR ──────────────────────── */}
      <header className="flex-shrink-0 h-14 border-b border-border/60 bg-background/95 backdrop-blur-sm flex items-center gap-0 px-0 z-30">

        {/* Brand — same width as sidebar */}
        <div className="w-60 flex-shrink-0 flex items-center gap-3 px-5 h-full border-r border-border/60">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Building2 size={14} className="text-primary-foreground" />
          </div>
          <div className="leading-none">
            <div className="text-sm font-bold tracking-tight">QuickPlan</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">CLSP Management</div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex items-center h-full px-6 gap-1">
          {TOP_NAV.map(({ href, label }) => {
            const active = href === '/' ? isDash : isProject
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 h-full flex items-center text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3 px-5">
          {/* Search */}
          <div className="hidden lg:flex items-center gap-2 h-8 px-3 rounded-lg bg-muted/50 border border-border/60 text-sm text-muted-foreground w-52">
            <Search size={13} />
            <span className="text-xs">프로젝트 검색...</span>
          </div>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Bell size={16} />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Settings size={16} />
          </button>
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-semibold text-primary">
            K
          </div>
        </div>
      </header>

      {/* ── BODY ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR ─────────────────────────────────── */}
        <aside className="w-60 flex-shrink-0 bg-[hsl(var(--background))] border-r border-border/60 flex flex-col">

          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* New Project button */}
          <div className="px-3 pb-4 pt-2 border-t border-border/60">
            <Link
              href="/projects/new"
              className="flex items-center justify-center gap-2 w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors no-underline"
            >
              <Plus size={15} />
              New Project
            </Link>
          </div>
        </aside>

        {/* ── MAIN CONTENT ──────────────────────────────── */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
