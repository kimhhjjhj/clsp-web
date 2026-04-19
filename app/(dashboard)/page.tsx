'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Plus, Building2, LayoutGrid, TrendingUp, Upload,
  FolderKanban, FileText, ChevronRight, Activity,
  BarChart3, ArrowRight, ClipboardCheck, CheckCircle2, AlertCircle, Clock, PenLine,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { Skeleton, SkeletonList } from '@/components/common/Skeleton'
import { getProjectStatus, STATUS_META, formatRelative, type ProjectStatus } from '@/lib/project-status'
import StatusBadge from '@/components/common/StatusBadge'

interface Project {
  id: string
  name: string
  client?: string
  location?: string
  type?: string
  startDate?: string
  ground: number
  basement: number
  bldgArea?: number
  lastCpmDuration?: number
  latestReportDate?: string | null
  createdAt: string
  _count: { tasks: number; dailyReports?: number }
}

interface RecentReport {
  id: string
  date: string
  projectId: string
  project?: { name: string }
  workersTotal?: number
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: Project[]) => { setProjects(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const kpi = {
    projectCount: projects.length,
    totalReports: projects.reduce((s, p) => s + (p._count.dailyReports ?? 0), 0),
    totalTasks: projects.reduce((s, p) => s + p._count.tasks, 0),
    avgArea: projects.length ? Math.round(projects.reduce((s, p) => s + (p.bldgArea ?? 0), 0) / projects.length) : 0,
  }

  // 상태별 분류
  const statusGroups = useMemo(() => {
    const g: Record<ProjectStatus, Project[]> = {
      active: [], paused: [], planning: [], completed: [], archived: [],
    }
    for (const p of projects) g[getProjectStatus(p)].push(p)
    return g
  }, [projects])

  // 활발한 현장 — 진행중 + 일시중단 (최근 활동순)
  const activeProjects = useMemo(() => {
    return [...statusGroups.active, ...statusGroups.paused]
      .sort((a, b) => {
        const da = a.latestReportDate ? new Date(a.latestReportDate).getTime() : 0
        const db = b.latestReportDate ? new Date(b.latestReportDate).getTime() : 0
        return db - da
      })
      .slice(0, 4)
  }, [statusGroups])

  // 오늘 할 일 — 진행중 프로젝트 중 오늘/어제 일보 미작성
  const todayTasks = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    return statusGroups.active.filter(p => {
      if (!p.latestReportDate) return true
      const latest = new Date(p.latestReportDate)
      latest.setHours(0, 0, 0, 0)
      return latest < yesterday
    })
  }, [statusGroups])

  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4)

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={LayoutGrid}
        title="대시보드"
        subtitle="동양건설산업 · 통합 공정관리 플랫폼"
        accent="blue"
        actions={
          <>
            <Link
              href="/import"
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Upload size={14} /> 임포트
            </Link>
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
            >
              <Plus size={14} /><span className="hidden sm:inline">새 프로젝트</span><span className="sm:hidden">추가</span>
            </Link>
          </>
        }
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        {/* Hero — 오늘의 핵심 한 줄 */}
        {!loading && projects.length > 0 && (
          <section className="card-hero p-6 sm:p-8 relative">
            <div className="relative">
              <p className="text-[11px] font-bold text-blue-600 uppercase tracking-[0.2em] mb-2">
                {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
              </p>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h1 className="stat-value text-4xl sm:text-5xl font-black text-slate-900">
                  {statusGroups.active.length}<span className="text-2xl font-semibold text-slate-400">개</span>
                  <span className="text-slate-300 mx-3">·</span>
                  {kpi.totalReports.toLocaleString()}<span className="text-2xl font-semibold text-slate-400">일보</span>
                </h1>
              </div>
              <p className="text-sm text-slate-600 mt-3 font-medium">
                진행 중 현장 {statusGroups.active.length}곳, 누적 일보 {kpi.totalReports.toLocaleString()}건.
                {statusGroups.paused.length > 0 && ` 일시중단 ${statusGroups.paused.length}건 확인 필요.`}
              </p>
            </div>
          </section>
        )}

        {/* KPI — 상태 중심 */}
        <section>
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">전사 현황</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard loading={loading} icon={Activity} iconBg="bg-emerald-50" iconColor="text-emerald-600"
              label="진행중" value={statusGroups.active.length} unit="개"
              sub={statusGroups.paused.length > 0 ? `일시중단 ${statusGroups.paused.length}개 포함 주의` : '모두 정상 가동'}
              href="/projects?status=active"
              accent="#16a34a" />
            <KpiCard loading={loading} icon={ClipboardCheck} iconBg="bg-blue-50" iconColor="text-blue-600"
              label="계획중" value={statusGroups.planning.length} unit="개"
              sub="착공 전·검토 중"
              href="/projects?status=planning" />
            <KpiCard loading={loading} icon={CheckCircle2} iconBg="bg-slate-50" iconColor="text-slate-600"
              label="준공 자산" value={statusGroups.completed.length} unit="개"
              sub={`실적 ${kpi.totalReports.toLocaleString()}건 축적`}
              href="/projects?status=completed" />
            <KpiCard loading={loading} icon={FolderKanban} iconBg="bg-violet-50" iconColor="text-violet-600"
              label="전사 합계" value={kpi.projectCount} unit="개"
              sub={`공종 ${kpi.totalTasks} · 평균 ${kpi.avgArea ? kpi.avgArea.toLocaleString() + '㎡' : '—'}`}
              href="/projects" />
          </div>
        </section>

        {/* 오늘 할 일 — 진행중 프로젝트 중 이틀 이상 일보 없는 현장 */}
        {todayTasks.length > 0 && (
          <section>
            <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2 border-b border-blue-100">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <PenLine size={14} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-blue-900">오늘 할 일</h3>
                  <p className="text-[10px] text-blue-700">진행중 현장 중 최근 일보가 2일 이상 밀린 건</p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white">{todayTasks.length}</span>
              </div>
              <ul className="divide-y divide-blue-100/50">
                {todayTasks.slice(0, 5).map(p => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}/daily-reports/new`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-100/40 transition-colors no-underline group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                        <p className="text-[11px] text-blue-700 mt-0.5">
                          마지막 일보 {p.latestReportDate ? formatRelative(p.latestReportDate) : '없음'}
                        </p>
                      </div>
                      <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-0.5 opacity-60 group-hover:opacity-100">
                        일보 쓰기 <ChevronRight size={11} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {todayTasks.length > 5 && (
                <div className="px-4 py-2 border-t border-blue-100 text-[11px] text-blue-700 text-center">
                  외 {todayTasks.length - 5}개 · 프로젝트 목록에서 전체 확인
                </div>
              )}
            </div>
          </section>
        )}

        {/* 일시중단 경고 */}
        {statusGroups.paused.length > 0 && (
          <section>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={16} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-amber-900 mb-0.5">
                  {statusGroups.paused.length}개 프로젝트가 일시중단 상태
                </h3>
                <p className="text-xs text-amber-800">
                  최근 30~90일간 일보 입력이 없습니다. 실제 중단인지 확인 필요:
                  {' '}
                  {statusGroups.paused.slice(0, 3).map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && ', '}
                      <Link href={`/projects/${p.id}`} className="font-semibold text-amber-900 hover:underline">
                        {p.name}
                      </Link>
                    </span>
                  ))}
                  {statusGroups.paused.length > 3 && ` 외 ${statusGroups.paused.length - 3}개`}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 4단계 라이프사이클 스테퍼 */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            건설 프로젝트 라이프사이클
          </h2>
          <LifecycleStepper kpi={kpi} loading={loading} />
        </section>

        {/* 활발한 현장 + 바로가기 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 card-elevated overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">활발한 현장</h3>
                <span className="text-[10px] text-gray-400">최근 일보 순</span>
              </div>
              <Link href="/projects" className="text-xs text-blue-600 hover:underline no-underline flex items-center gap-0.5">
                전체 보기 <ChevronRight size={11} />
              </Link>
            </div>
            {loading ? (
              <div className="p-3"><SkeletonList rows={4} /></div>
            ) : activeProjects.length === 0 ? (
              <EmptyState
                compact
                icon={Activity}
                title={recentProjects.length === 0 ? "아직 프로젝트가 없습니다" : "현재 진행 중인 현장이 없습니다"}
                description={recentProjects.length === 0
                  ? "신규 프로젝트 또는 엑셀 임포트로 시작하세요"
                  : "준공 또는 계획 단계 프로젝트만 있습니다"}
                actions={[
                  recentProjects.length === 0
                    ? { label: '첫 프로젝트', href: '/projects/new', icon: <Plus size={12} />, variant: 'primary' as const }
                    : { label: '전체 프로젝트', href: '/projects', icon: <FolderKanban size={12} />, variant: 'secondary' as const }
                ]}
              />
            ) : (
              <ul className="divide-y divide-gray-100">
                {activeProjects.map(p => {
                  const info = STATUS_META[getProjectStatus(p)]
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/projects/${p.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors no-underline group"
                      >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${info.color}, ${info.color}dd)` }}>
                          <Building2 size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <StatusBadge project={p} size="xs" />
                            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-700">{p.name}</p>
                          </div>
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">
                            {[p.client, p.location, `${p.ground}층`].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="text-right text-[11px] hidden sm:block flex-shrink-0">
                          <div className="flex items-center gap-1 text-emerald-700 font-medium">
                            <Clock size={10} /> {formatRelative(p.latestReportDate)}
                          </div>
                          <div className="text-gray-400 mt-0.5 font-mono">
                            {p._count.dailyReports ?? 0}일보
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-600 flex-shrink-0" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* 바로가기 */}
          <div className="card-elevated p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">바로가기</h3>
            <div className="space-y-1.5">
              <QuickLink href="/projects/new" icon={<Plus size={14} />} label="새 프로젝트 만들기" color="blue" />
              <QuickLink href="/projects" icon={<FolderKanban size={14} />} label="전체 프로젝트 목록" />
              <QuickLink href="/import" icon={<Upload size={14} />} label="엑셀 일보 임포트" />
              <QuickLink href="/admin/productivity" icon={<TrendingUp size={14} />} label="관리자 · 생산성 승인" />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-[11px] text-gray-500 leading-relaxed">
              <kbd className="inline-flex items-center justify-center w-4 h-4 border border-gray-300 bg-white rounded text-[9px] font-mono">⌘</kbd>
              <span className="mx-0.5">+</span>
              <kbd className="inline-flex items-center justify-center w-4 h-4 border border-gray-300 bg-white rounded text-[9px] font-mono">K</kbd>
              <span className="ml-1.5">로 어디서든 전역 검색을 열 수 있습니다.</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function KpiCard({
  loading, icon: Icon, iconBg, iconColor, label, value, unit, sub, href, accent,
}: {
  loading: boolean
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  iconBg: string
  iconColor: string
  label: string
  value: number | string
  unit?: string
  sub?: string
  href?: string
  accent?: string
}) {
  const inner = (
    <div
      className={`card-modern relative p-5 ${href ? 'cursor-pointer' : ''}`}
      style={accent ? { color: accent } : undefined}
    >
      {accent && <span className="accent-dot" aria-hidden />}
      <div className="flex items-start justify-between gap-2 mb-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">{label}</p>
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center ${iconBg} ring-1 ring-inset ring-black/[0.04]`}
          style={{ boxShadow: accent ? `0 4px 20px -6px ${accent}40` : undefined }}
        >
          <Icon size={18} className={iconColor} strokeWidth={2} />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-10 w-1/2" />
      ) : (
        <p className="stat-value text-[42px] font-black text-slate-900">
          {value}
          {unit && <span className="text-xl font-medium text-slate-400 ml-1.5">{unit}</span>}
        </p>
      )}
      {sub && <p className="text-[11px] text-slate-500 mt-3 line-clamp-1 font-medium">{sub}</p>}
    </div>
  )
  return href ? <Link href={href} className="no-underline">{inner}</Link> : inner
}

interface KpiData {
  projectCount: number
  totalReports: number
  totalTasks: number
  avgArea: number
}

function LifecycleStepper({ kpi, loading }: { kpi: KpiData; loading: boolean }) {
  const stages = [
    {
      n: 1, label: '사업 검토', color: '#2563eb', bg: 'bg-blue-50', hoverBg: 'hover:bg-blue-100',
      icon: <ClipboardCheck size={14} className="text-blue-600" />,
      href: '/bid',
      kpi: { label: '개략 견적 도구', value: '시뮬', sub: '개요만으로 공기·원가 산출' },
      cta: '견적 열기',
    },
    {
      n: 2, label: '프리콘', color: '#16a34a', bg: 'bg-emerald-50', hoverBg: 'hover:bg-emerald-100',
      icon: <FolderKanban size={14} className="text-emerald-600" />,
      href: '/projects',
      kpi: { label: '프로젝트', value: kpi.projectCount, sub: `${kpi.totalTasks}개 공종 계획`, unit: '개' },
      cta: kpi.projectCount === 0 ? '첫 프로젝트 생성' : '프로젝트 목록',
    },
    {
      n: 3, label: '시공 관리', color: '#ea580c', bg: 'bg-orange-50', hoverBg: 'hover:bg-orange-100',
      icon: <FileText size={14} className="text-orange-600" />,
      href: '/import',
      kpi: { label: '누적 일보', value: kpi.totalReports.toLocaleString(), sub: '현장 실적 기록', unit: '건' },
      cta: kpi.totalReports === 0 ? '엑셀로 임포트' : '엑셀 임포트',
    },
    {
      n: 4, label: '준공·데이터', color: '#7c3aed', bg: 'bg-purple-50', hoverBg: 'hover:bg-purple-100',
      icon: <BarChart3 size={14} className="text-purple-600" />,
      href: '/analytics',
      kpi: { label: '데이터 자산', value: '분석', sub: '생산성 DB · R&O · 협력사' },
      cta: '전사 분석 보기',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 relative">
      {stages.map((s, i) => (
        <div key={s.n} className="relative">
          <Link
            href={s.href}
            className={`block bg-white border border-gray-200 rounded-xl p-4 no-underline hover:shadow-md hover:-translate-y-0.5 transition-all group h-full`}
            style={{ borderLeft: `4px solid ${s.color}` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className={`flex items-center justify-center w-7 h-7 rounded-md ${s.bg} text-[11px] font-bold`}
                style={{ color: s.color }}>
                {s.n}
              </span>
              <span className="text-xs font-bold text-gray-700">{s.label}</span>
              <ArrowRight size={12} className="ml-auto text-gray-300 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="flex items-start gap-2 mb-1">
              <div className={`w-6 h-6 rounded-md ${s.bg} flex items-center justify-center flex-shrink-0`}>{s.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{s.kpi.label}</p>
                {loading ? (
                  <Skeleton className="h-5 w-16 mt-0.5" />
                ) : (
                  <p className="text-lg font-bold text-gray-900 leading-none mt-0.5">
                    {s.kpi.value}
                    {s.kpi.unit && <span className="text-xs font-normal text-gray-400 ml-1">{s.kpi.unit}</span>}
                  </p>
                )}
              </div>
            </div>
            <p className="text-[11px] text-gray-500 mt-2 line-clamp-1">{s.kpi.sub}</p>

            <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-1 text-[11px] font-semibold" style={{ color: s.color }}>
              <span>{s.cta}</span>
              <ChevronRight size={11} />
            </div>
          </Link>

          {/* 단계 간 화살표 connector (lg 이상) */}
          {i < stages.length - 1 && (
            <div className="hidden lg:flex absolute top-1/2 -right-2 z-10 w-4 h-4 -translate-y-1/2 items-center justify-center">
              <ChevronRight size={14} className="text-gray-300" strokeWidth={2.5} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function QuickLink({ href, icon, label, color }: { href: string; icon: React.ReactNode; label: string; color?: 'blue' }) {
  const cls = color === 'blue'
    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
    : 'text-gray-700 hover:bg-gray-50'
  return (
    <Link href={href} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium no-underline transition-colors ${cls}`}>
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight size={13} className="text-gray-300" />
    </Link>
  )
}
