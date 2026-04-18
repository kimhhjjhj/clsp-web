'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Plus, Building2, LayoutGrid, TrendingUp, Upload,
  FolderKanban, FileText, Clock, ChevronRight, Activity, Users,
  Calculator, BarChart3, ArrowRight,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { Skeleton, SkeletonList } from '@/components/common/Skeleton'

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

  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4)

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={LayoutGrid}
        title="대시보드"
        subtitle="동양건설산업 · 통합 공정관리 플랫폼"
        actions={
          <>
            <Link
              href="/import"
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
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
        {/* KPI 4종 */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">전사 현황</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard loading={loading} icon={FolderKanban} iconBg="bg-blue-50" iconColor="text-blue-600"
              label="프로젝트" value={kpi.projectCount} unit="개"
              href="/projects" />
            <KpiCard loading={loading} icon={FileText} iconBg="bg-emerald-50" iconColor="text-emerald-600"
              label="누적 일보" value={kpi.totalReports} unit="건"
              sub="현장 실적 데이터" />
            <KpiCard loading={loading} icon={Activity} iconBg="bg-purple-50" iconColor="text-purple-600"
              label="공종 데이터" value={kpi.totalTasks} unit="개"
              sub="WBS 누적" />
            <KpiCard loading={loading} icon={Building2} iconBg="bg-orange-50" iconColor="text-orange-600"
              label="평균 연면적" value={kpi.avgArea || '—'} unit={kpi.avgArea ? 'm²' : ''}
              sub="프로젝트 규모" />
          </div>
        </section>

        {/* 4단계 라이프사이클 스테퍼 */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            건설 프로젝트 라이프사이클
          </h2>
          <LifecycleStepper kpi={kpi} loading={loading} />
        </section>

        {/* 최근 프로젝트 + 바로가기 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">최근 프로젝트</h3>
              <Link href="/projects" className="text-xs text-blue-600 hover:underline no-underline flex items-center gap-0.5">
                전체 보기 <ChevronRight size={11} />
              </Link>
            </div>
            {loading ? (
              <div className="p-3"><SkeletonList rows={4} /></div>
            ) : recentProjects.length === 0 ? (
              <EmptyState
                compact
                icon={FolderKanban}
                title="아직 프로젝트가 없습니다"
                actions={[
                  { label: '첫 프로젝트 만들기', href: '/projects/new', icon: <Plus size={12} />, variant: 'primary' },
                ]}
              />
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentProjects.map(p => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors no-underline group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white flex-shrink-0">
                        <Building2 size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-700">{p.name}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {[p.client, p.location, `${p.ground}층`].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="text-right text-xs hidden sm:block">
                        {p.lastCpmDuration && (
                          <div className="text-blue-700 font-mono font-bold">{p.lastCpmDuration}일</div>
                        )}
                        <div className="text-gray-400">
                          {p._count.tasks}공종 · {p._count.dailyReports ?? 0}일보
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-600 flex-shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 바로가기 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
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
  loading, icon: Icon, iconBg, iconColor, label, value, unit, sub, href,
}: {
  loading: boolean
  icon: React.ComponentType<{ size?: number; className?: string }>
  iconBg: string
  iconColor: string
  label: string
  value: number | string
  unit?: string
  sub?: string
  href?: string
}) {
  const inner = (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 transition-all ${href ? 'hover:border-blue-300 hover:shadow-sm cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${iconBg}`}>
          <Icon size={13} className={iconColor} />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-1/2" />
      ) : (
        <p className="text-2xl font-bold text-gray-900">
          {value}
          {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
        </p>
      )}
      {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
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
      icon: <Calculator size={14} className="text-blue-600" />,
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
