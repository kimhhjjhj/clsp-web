'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Plus, Building2, LayoutGrid, TrendingUp, Upload,
  FolderKanban, ChevronRight, Activity,
  AlertCircle, Clock, PenLine,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { SkeletonList } from '@/components/common/Skeleton'
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
        subtitle="(주)동양 건설부문 · 통합 공정관리 플랫폼"
        accent="blue"
        actions={
          <>
            <Link
              href="/import"
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/15 bg-white/5 text-sm font-semibold text-slate-200 hover:bg-white/10"
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
        {/* 오늘 할 일 — 진행중 프로젝트 중 이틀 이상 일보 없는 현장 */}
        {todayTasks.length > 0 && (
          <section>
            <div
              className="relative rounded-xl overflow-hidden bg-white"
              style={{
                border: '1px solid rgba(37, 99, 235, 0.2)',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 20px -10px rgba(37, 99, 235, 0.25)',
              }}
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-20 pointer-events-none"
                style={{ background: 'linear-gradient(180deg, rgba(37, 99, 235, 0.07) 0%, transparent 100%)' }}
              />
              <div className="relative px-4 py-3 flex items-center gap-2 border-b border-slate-100">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}
                >
                  <PenLine size={15} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-900 tracking-[-0.01em]">오늘 할 일</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">진행중 현장 중 최근 일보가 2일 이상 밀린 건</p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white">{todayTasks.length}</span>
              </div>
              <ul className="relative divide-y divide-slate-100">
                {todayTasks.slice(0, 5).map(p => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}/daily-reports/new`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/40 transition-colors no-underline group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          마지막 일보 {p.latestReportDate ? formatRelative(p.latestReportDate) : '없음'}
                        </p>
                      </div>
                      <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-0.5 opacity-70 group-hover:opacity-100">
                        일보 쓰기 <ChevronRight size={11} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {todayTasks.length > 5 && (
                <div className="relative px-4 py-2 border-t border-slate-100 text-[11px] text-slate-500 text-center">
                  외 {todayTasks.length - 5}개 · 프로젝트 목록에서 전체 확인
                </div>
              )}
            </div>
          </section>
        )}

        {/* 일시중단 경고 */}
        {statusGroups.paused.length > 0 && (
          <section>
            <div
              className="relative rounded-xl overflow-hidden bg-white p-4 flex items-start gap-3"
              style={{
                border: '1px solid rgba(245, 158, 11, 0.24)',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 20px -10px rgba(245, 158, 11, 0.3)',
              }}
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-20 pointer-events-none"
                style={{ background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, transparent 100%)' }}
              />
              <div
                className="relative w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(245, 158, 11, 0.14)', color: '#d97706' }}
              >
                <AlertCircle size={16} />
              </div>
              <div className="relative flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 mb-0.5 tracking-[-0.01em]">
                  {statusGroups.paused.length}개 프로젝트가 일시중단 상태
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  최근 30~90일간 일보 입력이 없습니다. 실제 중단인지 확인 필요:
                  {' '}
                  {statusGroups.paused.slice(0, 3).map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && ', '}
                      <Link href={`/projects/${p.id}`} className="font-semibold text-amber-700 hover:underline">
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

        {/* 활발한 현장 + 바로가기 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div
            className="relative lg:col-span-2 rounded-xl overflow-hidden bg-white"
            style={{
              border: '1px solid rgba(16, 185, 129, 0.2)',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 20px -10px rgba(16, 185, 129, 0.22)',
            }}
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-20 pointer-events-none"
              style={{ background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.06) 0%, transparent 100%)' }}
            />
            <div className="relative flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex items-center justify-center w-7 h-7 rounded-lg"
                  style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}
                >
                  <Activity size={13} />
                </span>
                <h3 className="text-sm font-bold text-slate-900 tracking-[-0.01em]">활발한 현장</h3>
                <span className="text-[10px] text-slate-400">최근 일보 순</span>
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
              <ul className="relative divide-y divide-slate-100">
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
          <div
            className="relative rounded-xl overflow-hidden bg-white p-5"
            style={{
              border: '1px solid rgba(139, 92, 246, 0.2)',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 20px -10px rgba(139, 92, 246, 0.22)',
            }}
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-20 pointer-events-none"
              style={{ background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.06) 0%, transparent 100%)' }}
            />
            <div className="relative flex items-center gap-2 mb-3">
              <span
                className="flex items-center justify-center w-7 h-7 rounded-lg"
                style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed' }}
              >
                <ChevronRight size={13} />
              </span>
              <h3 className="text-sm font-bold text-slate-900 tracking-[-0.01em]">바로가기</h3>
            </div>
            <div className="relative space-y-1.5">
              <QuickLink href="/projects/new" icon={<Plus size={14} />} label="새 프로젝트 만들기" color="blue" />
              <QuickLink href="/projects" icon={<FolderKanban size={14} />} label="전체 프로젝트 목록" />
              <QuickLink href="/import" icon={<Upload size={14} />} label="엑셀 일보 임포트" />
              <QuickLink href="/admin/productivity" icon={<TrendingUp size={14} />} label="관리자 · 생산성 승인" />
            </div>
            <div className="relative mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
              <kbd className="inline-flex items-center justify-center w-4 h-4 border border-slate-300 bg-white rounded text-[9px] font-mono">⌘</kbd>
              <span className="mx-0.5">+</span>
              <kbd className="inline-flex items-center justify-center w-4 h-4 border border-slate-300 bg-white rounded text-[9px] font-mono">K</kbd>
              <span className="ml-1.5">로 어디서든 전역 검색을 열 수 있습니다.</span>
            </div>
          </div>
        </section>
      </div>
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
