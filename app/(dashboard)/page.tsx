'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Building2, Clock, ChevronRight, Trash2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">프로젝트 목록</h1>
          <p className="text-sm text-muted-foreground mt-1">공동주택 개략공기 산정 프로젝트를 관리합니다</p>
        </div>
        <Link href="/projects/new" className={cn(buttonVariants(), 'no-underline')}>
          <Plus size={16} className="mr-2" />
          새 프로젝트
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">전체 프로젝트</p>
            <p className="text-2xl font-bold">{projects.length}<span className="text-sm font-normal text-muted-foreground ml-1">개</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">평균 연면적</p>
            <p className="text-2xl font-bold">
              {projects.length
                ? Math.round(projects.reduce((s, p) => s + (p.bldgArea ?? 0), 0) / projects.length).toLocaleString()
                : '—'}
              <span className="text-sm font-normal text-muted-foreground ml-1">m²</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">평균 규모</p>
            <p className="text-2xl font-bold">
              {projects.length ? Math.round(projects.reduce((s, p) => s + p.ground, 0) / projects.length) : '—'}
              <span className="text-sm font-normal text-muted-foreground ml-1">층</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator className="mb-6" />

      {/* 프로젝트 목록 */}
      {loading ? (
        <div className="text-center text-muted-foreground py-20">불러오는 중...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <Building2 className="mx-auto text-muted-foreground/30 mb-4" size={48} />
          <p className="text-muted-foreground mb-4">아직 프로젝트가 없습니다</p>
          <Link href="/projects/new" className={cn(buttonVariants(), 'no-underline')}>
            <Plus size={16} className="mr-2" />
            첫 프로젝트 만들기
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(project => (
            <Card key={project.id} className="group hover:border-border/80 transition-colors">
              <CardContent className="pt-0 pb-0">
                <div className="flex items-center gap-4 py-4">
                  {/* 아이콘 */}
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 size={20} className="text-primary" />
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{project.name}</h3>
                      {project.type && <Badge variant="secondary" className="text-[11px]">{project.type}</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {project.location && <span>{project.location}</span>}
                      <span>지상 {project.ground}F / 지하 {project.basement}F</span>
                      {project.bldgArea && <span>연면적 {project.bldgArea.toLocaleString()}m²</span>}
                    </div>
                  </div>

                  {/* 태스크 수 */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock size={13} />
                    <span>{project._count.tasks}개 공종</span>
                  </div>

                  {/* 날짜 */}
                  <div className="text-xs text-muted-foreground hidden md:block">
                    {new Date(project.createdAt).toLocaleDateString('ko-KR')}
                  </div>

                  {/* 삭제 */}
                  <button
                    onClick={e => { e.preventDefault(); deleteProject(project.id, project.name) }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 size={15} />
                  </button>

                  {/* 이동 */}
                  <Link href={`/projects/${project.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}>
                    공기산정 <ChevronRight size={14} className="ml-1" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
