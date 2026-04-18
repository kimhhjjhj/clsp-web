'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Building2, ChevronRight, Trash2, LayoutGrid, TrendingUp, Upload } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  name: string
  client?: string
  location?: string
  type?: string
  ground: number
  basement: number
  bldgArea?: number
  createdAt: string
  _count: { tasks: number }
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => { setProjects(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function deleteProject(id: string, name: string) {
    if (!confirm(`"${name}" 프로젝트를 삭제하시겠습니까?`)) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  const avgFloors = projects.length
    ? Math.round(projects.reduce((s, p) => s + p.ground, 0) / projects.length)
    : 0
  const avgArea = projects.length
    ? Math.round(projects.reduce((s, p) => s + (p.bldgArea ?? 0), 0) / projects.length)
    : 0

  return (
    <div className="flex flex-col h-full">

      {/* 프로젝트 타이틀바 */}
      <div className="h-14 bg-card border-b border-border flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">전체 프로젝트</h2>
          <Badge variant="secondary" className="text-xs">{projects.length}개</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/import"
            className="inline-flex items-center gap-2 h-8 px-4 rounded-md border border-[#2563eb]/30 text-[#2563eb] text-sm font-medium hover:bg-[#2563eb]/5 transition-colors no-underline"
          >
            <Upload size={14} />
            엑셀 임포트
          </Link>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 h-8 px-4 rounded-md bg-[#2563eb] text-white text-sm font-medium hover:bg-[#2563eb]/90 transition-colors no-underline"
          >
            <Plus size={14} />
            새 프로젝트
          </Link>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-auto p-6">

        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-lg border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">전체 프로젝트</p>
              <div className="w-7 h-7 rounded-md bg-[#2563eb]/10 flex items-center justify-center">
                <LayoutGrid size={13} className="text-[#2563eb]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {projects.length}
              <span className="text-sm font-normal text-muted-foreground ml-1">개</span>
            </p>
          </div>

          <div className="bg-card rounded-lg border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">평균 연면적</p>
              <div className="w-7 h-7 rounded-md bg-orange-400/10 flex items-center justify-center">
                <TrendingUp size={13} className="text-orange-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {avgArea ? avgArea.toLocaleString() : '—'}
              <span className="text-sm font-normal text-muted-foreground ml-1">m²</span>
            </p>
          </div>

          <div className="bg-card rounded-lg border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">평균 규모</p>
              <div className="w-7 h-7 rounded-md bg-[#2563eb]/10 flex items-center justify-center">
                <Building2 size={13} className="text-[#2563eb]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {avgFloors || '—'}
              <span className="text-sm font-normal text-muted-foreground ml-1">층</span>
            </p>
          </div>
        </div>

        {/* 테이블 헤더 */}
        <div className="grid grid-cols-[40px_1fr_80px_100px_90px_110px_80px] gap-3 px-4 py-2.5 bg-muted/40 rounded-t-lg border border-border text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          <div />
          <div>프로젝트명</div>
          <div className="text-center">규모</div>
          <div className="text-center">연면적</div>
          <div className="text-center">공종 수</div>
          <div className="text-center">생성일</div>
          <div />
        </div>

        {/* 프로젝트 목록 */}
        {loading ? (
          <div className="text-center text-muted-foreground py-20 bg-card border border-t-0 border-border rounded-b-lg">
            불러오는 중...
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-card border border-t-0 border-border rounded-b-lg">
            <EmptyState
              icon={Building2}
              title="아직 등록된 프로젝트가 없습니다"
              description="신규 프로젝트를 만들어 개략공기 산정부터 시작하거나, 과거 엑셀 일보를 일괄 임포트해 데이터 자산화를 시작하세요."
              actions={[
                { label: '첫 프로젝트 만들기', href: '/projects/new', icon: <Plus size={14} />, variant: 'primary' },
                { label: '엑셀 일괄 임포트', href: '/import', icon: <Upload size={14} />, variant: 'secondary' },
              ]}
            />
          </div>
        ) : (
          <div className="bg-card border border-t-0 border-border rounded-b-lg divide-y divide-border">
            {projects.map(project => (
              <div
                key={project.id}
                className="group grid grid-cols-[40px_1fr_80px_100px_90px_110px_80px] gap-3 items-center px-4 py-3.5 hover:bg-muted/30 transition-colors"
              >
                {/* 아이콘 */}
                <div className="w-8 h-8 rounded-md bg-[#2563eb]/10 flex items-center justify-center flex-shrink-0">
                  <Building2 size={14} className="text-[#2563eb]" />
                </div>

                {/* 이름 */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{project.name}</span>
                    {project.type && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">{project.type}</Badge>
                    )}
                    {project._count.tasks > 0 && (
                      <span className="text-[10px] text-orange-400 font-semibold">CP</span>
                    )}
                  </div>
                  {(project.client || project.location) && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {[project.client, project.location].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                {/* 규모 */}
                <div className="text-center text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{project.ground}</span>F
                  {project.basement > 0 && <span className="text-[10px] ml-0.5">/ B{project.basement}</span>}
                </div>

                {/* 연면적 */}
                <div className="text-center text-xs text-muted-foreground">
                  {project.bldgArea ? (
                    <><span className="font-medium text-foreground">{project.bldgArea.toLocaleString()}</span> m²</>
                  ) : '—'}
                </div>

                {/* 공종 수 */}
                <div className="text-center">
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    project._count.tasks > 0
                      ? 'bg-[#2563eb]/10 text-[#2563eb]'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {project._count.tasks > 0 ? `${project._count.tasks}개` : '미산정'}
                  </span>
                </div>

                {/* 날짜 */}
                <div className="text-center text-[11px] text-muted-foreground">
                  {new Date(project.createdAt).toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' })}
                </div>

                {/* 액션 */}
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => deleteProject(project.id, project.name)}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                  <Link
                    href={`/projects/${project.id}`}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-[#2563eb] hover:bg-[#2563eb]/10 transition-colors no-underline"
                  >
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 푸터 범례 */}
      <footer className="h-10 bg-card border-t border-border flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[#2563eb]" />
            <span className="text-[11px] text-muted-foreground">일반 공종</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-orange-400" />
            <span className="text-[11px] text-orange-400 font-medium">크리티컬 패스</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-muted border border-border" />
            <span className="text-[11px] text-muted-foreground">미산정</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-[#2563eb]">CLSP SCHEDULER</span>
          <span>·</span>
          <span>공동주택 공기산정 플랫폼</span>
        </div>
      </footer>
    </div>
  )
}
