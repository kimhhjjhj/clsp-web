'use client'

import React, { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  Building2, ChevronRight, Play, AlertTriangle,
  ChevronDown, ChevronUp, Pencil, Layers, Grid3x3,
  CalendarDays, BarChart3,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GanttChart, type GanttViewMode } from '@/components/gantt/GanttChart'
import type { CPMSummary, CPMResult } from '@/lib/types'

interface Project {
  id: string
  name: string
  client?: string
  location?: string
  type?: string
  ground: number
  basement: number
  bldgArea?: number
  startDate?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  '공사준비': 'bg-slate-500',
  '토목공사': 'bg-yellow-600',
  '골조공사': 'bg-blue-600',
  '마감공사': 'bg-emerald-600',
  '설비공사': 'bg-cyan-600',
  '전기공사': 'bg-violet-600',
  '외부공사': 'bg-green-600',
  '부대공사': 'bg-red-600',
}

type WBSMode = 'cp' | 'full'

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [project, setProject]       = useState<Project | null>(null)
  const [cpmResult, setCpmResult]   = useState<CPMSummary | null>(null)
  const [currentMode, setCurrentMode] = useState<WBSMode>('cp')
  const [selectedMode, setSelectedMode] = useState<WBSMode>('cp')
  const [loading, setLoading]       = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())
  const [ganttView, setGanttView]   = useState<GanttViewMode>('week')

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(data => { setProject(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  async function calculate(mode: WBSMode) {
    setCalculating(true)
    const res = await fetch(`/api/projects/${id}/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
    if (res.ok) {
      setCpmResult(await res.json())
      setCurrentMode(mode)
    }
    setCalculating(false)
    setExpanded(new Set())
  }

  function toggleCat(cat: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  if (loading) return <div className="p-8 text-muted-foreground">불러오는 중...</div>
  if (!project) return <div className="p-8 text-muted-foreground">프로젝트를 찾을 수 없습니다.</div>

  const byCategory = cpmResult ? groupBy(cpmResult.tasks, t => t.category) : null
  const startDate  = project.startDate ? new Date(project.startDate) : null

  function completionDate() {
    if (!startDate || !cpmResult) return null
    const d = new Date(startDate)
    d.setDate(d.getDate() + cpmResult.totalDuration)
    return d.toLocaleDateString('ko-KR')
  }

  function fmtProductivity(task: CPMResult): string {
    if (task.productivity) return `생산성 ${task.productivity} ${task.unit ?? ''}/일`
    if (task.stdDays) return `${task.stdDays}일/${task.unit ?? '층'}`
    return ''
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header (fixed top) ─────────────────────── */}
      <div className="flex-shrink-0 px-8 pt-6 pb-4 border-b border-border/60 bg-background/95">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
          <ChevronRight size={12} />
          <span className="text-foreground truncate">{project.name}</span>
        </div>

        {/* Project info + actions */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
              <Building2 size={20} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold">{project.name}</h1>
                {project.type && <Badge variant="secondary" className="text-[10px]">{project.type}</Badge>}
                {cpmResult && (
                  <Badge variant={currentMode === 'full' ? 'default' : 'outline'} className="text-[10px]">
                    {currentMode === 'full' ? '상세공기' : '개략공기'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {project.location && <span>{project.location}</span>}
                <span>지상 {project.ground}F / 지하 {project.basement}F</span>
                {project.bldgArea && <span>연면적 {project.bldgArea.toLocaleString()}m²</span>}
                {cpmResult && <span className="text-primary font-medium">총 공기 {cpmResult.totalDuration}일</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/projects/${id}/edit`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'no-underline')}
            >
              <Pencil size={13} className="mr-1.5" />
              수정
            </Link>

            {/* Mode toggle */}
            <div className="flex items-center gap-0.5 bg-muted rounded-lg p-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedMode('cp')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                  selectedMode === 'cp'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Grid3x3 size={12} />개략 (CP)
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('full')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                  selectedMode === 'full'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Layers size={12} />상세 (층별)
              </button>
            </div>

            <Button size="sm" onClick={() => calculate(selectedMode)} disabled={calculating}>
              <Play size={13} className="mr-1.5" />
              {calculating ? '계산 중...' : 'WBS 생성 및 공기산정'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">

        {/* Empty state */}
        {!cpmResult && !calculating && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <BarChart3 size={48} className="opacity-20 mb-4" />
            <p className="mb-1 font-medium">아직 공기산정이 실행되지 않았습니다</p>
            <p className="text-sm opacity-60">개략공기(CP): 20개 집계 공종 | 상세공기(층별): 마감·설비 층별 전개</p>
          </div>
        )}

        {calculating && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">WBS 자동 생성 및 CPM 계산 중...</p>
          </div>
        )}

        {/* Results */}
        {cpmResult && (
          <Tabs defaultValue="gantt" className="h-full flex flex-col">

            {/* Tab list */}
            <div className="flex-shrink-0 px-8 pt-4 border-b border-border/40">
              <TabsList className="h-9">
                <TabsTrigger value="gantt" className="text-xs gap-1.5">
                  <CalendarDays size={13} />공정표 (Gantt)
                </TabsTrigger>
                <TabsTrigger value="summary" className="text-xs gap-1.5">
                  <BarChart3 size={13} />결과 요약
                </TabsTrigger>
                <TabsTrigger value="wbs" className="text-xs">WBS 공정표</TabsTrigger>
                <TabsTrigger value="critical" className="text-xs">크리티컬 패스</TabsTrigger>
              </TabsList>
            </div>

            {/* ── GANTT TAB ──────────────────────────────── */}
            <TabsContent value="gantt" className="flex-1 flex flex-col overflow-hidden mt-0 p-0">
              {/* Toolbar */}
              <div className="flex-shrink-0 flex items-center justify-between px-8 py-3 border-b border-border/40 bg-background">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" />
                    Standard
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />
                    Critical Path
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-8 h-1.5 rounded bg-blue-600/20 inline-block" />
                    Float
                  </div>
                </div>

                {/* View toggle */}
                <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                  {(['day', 'week', 'month'] as GanttViewMode[]).map(v => (
                    <button
                      key={v}
                      onClick={() => setGanttView(v)}
                      className={cn(
                        'px-3 py-1 rounded text-xs font-medium transition-colors capitalize',
                        ganttView === v
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {v === 'day' ? 'Day' : v === 'week' ? 'Week' : 'Month'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <div className="flex-1 overflow-hidden p-4">
                <GanttChart
                  tasks={cpmResult.tasks}
                  totalDuration={cpmResult.totalDuration}
                  startDate={project.startDate}
                  viewMode={ganttView}
                />
              </div>
            </TabsContent>

            {/* ── SUMMARY TAB ──────────────────────────────── */}
            <TabsContent value="summary" className="mt-0 overflow-auto">
              <div className="p-8 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground mb-1">총 공사 기간</p>
                      <p className="text-3xl font-bold text-primary">
                        {cpmResult.totalDuration}
                        <span className="text-sm font-normal text-muted-foreground ml-1">일</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {completionDate()
                          ? `착공 ${project.startDate} → 준공 ${completionDate()}`
                          : `약 ${Math.round(cpmResult.totalDuration / 30)}개월`}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground mb-1">총 공종 수</p>
                      <p className="text-3xl font-bold">
                        {cpmResult.tasks.length}
                        <span className="text-sm font-normal text-muted-foreground ml-1">개</span>
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground mb-1">크리티컬 패스</p>
                      <p className="text-3xl font-bold text-destructive">
                        {cpmResult.tasks.filter(t => t.isCritical).length}
                        <span className="text-sm font-normal text-muted-foreground ml-1">개 공종</span>
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {byCategory && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">공종별 현황</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(byCategory).map(([cat, tasks]) => {
                          const critCount = tasks.filter(t => t.isCritical).length
                          const maxDur    = Math.max(...tasks.map(t => t.EF))
                          const color     = CATEGORY_COLORS[cat] ?? 'bg-gray-600'
                          return (
                            <div key={cat} className="flex items-center gap-3">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
                              <span className="text-sm w-24 flex-shrink-0">{cat}</span>
                              <div className="flex-1 bg-muted rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${color}`}
                                  style={{ width: `${(maxDur / cpmResult.totalDuration) * 100}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-16 text-right">{tasks.length}개</span>
                              {critCount > 0 && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">CP {critCount}</Badge>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* ── WBS TAB ──────────────────────────────────── */}
            <TabsContent value="wbs" className="mt-0 overflow-auto">
              <div className="p-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>WBS 공정 목록 <span className="text-xs font-normal text-muted-foreground">({cpmResult.tasks.length}개 공종)</span></span>
                      <div className="flex gap-2 text-xs">
                        <button
                          onClick={() => setExpanded(new Set(cpmResult.tasks.map(t => t.category)))}
                          className="text-muted-foreground hover:text-foreground"
                        >전체 펼치기</button>
                        <span className="text-muted-foreground">|</span>
                        <button
                          onClick={() => setExpanded(new Set())}
                          className="text-muted-foreground hover:text-foreground"
                        >전체 접기</button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[280px]">공종명</TableHead>
                          <TableHead className="w-12 text-center text-xs">단위</TableHead>
                          <TableHead className="w-16 text-right text-xs">물량</TableHead>
                          <TableHead className="w-28 text-xs">생산성/소요기간</TableHead>
                          <TableHead className="text-right w-16">기간(일)</TableHead>
                          <TableHead className="text-right w-12 text-xs">ES</TableHead>
                          <TableHead className="text-right w-12 text-xs">EF</TableHead>
                          <TableHead className="text-right w-12 text-xs">LS</TableHead>
                          <TableHead className="text-right w-12 text-xs">LF</TableHead>
                          <TableHead className="text-right w-12 text-xs">TF</TableHead>
                          <TableHead className="text-center w-8">CP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {byCategory && Object.entries(byCategory).map(([cat, tasks]) => {
                          const isExpanded = expanded.has(cat)
                          const critCount  = tasks.filter(t => t.isCritical).length
                          const color      = CATEGORY_COLORS[cat] ?? 'bg-gray-600'
                          return (
                            <React.Fragment key={cat}>
                              <TableRow
                                className="cursor-pointer hover:bg-muted/50 bg-muted/20"
                                onClick={() => toggleCat(cat)}
                              >
                                <TableCell className="font-medium" colSpan={4}>
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                                    {cat}
                                    <span className="text-xs text-muted-foreground font-normal">({tasks.length}개)</span>
                                  </div>
                                </TableCell>
                                <TableCell /><TableCell /><TableCell /><TableCell /><TableCell />
                                <TableCell className="text-center">
                                  {critCount > 0 && <Badge variant="destructive" className="text-[10px] px-1">CP</Badge>}
                                </TableCell>
                              </TableRow>
                              {isExpanded && tasks.map(task => (
                                <TableRow key={task.taskId} className={task.isCritical ? 'bg-destructive/5' : ''}>
                                  <TableCell className="pl-10">
                                    <div className={task.isCritical ? 'text-destructive' : ''}>
                                      <div className="text-sm font-medium">{task.name}</div>
                                      {task.wbsCode && (
                                        <div className="text-[10px] text-muted-foreground font-mono">{task.wbsCode}</div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center text-xs text-muted-foreground">{task.unit ?? '—'}</TableCell>
                                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                    {task.quantity != null ? task.quantity.toLocaleString() : '—'}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{fmtProductivity(task)}</TableCell>
                                  <TableCell className="text-right font-mono text-sm font-medium">{task.duration}</TableCell>
                                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{task.ES}</TableCell>
                                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{task.EF}</TableCell>
                                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{task.LS}</TableCell>
                                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{task.LF}</TableCell>
                                  <TableCell className={`text-right font-mono text-sm font-bold ${task.TF === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                    {task.TF}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {task.isCritical && <span className="text-destructive">★</span>}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </React.Fragment>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── CRITICAL PATH TAB ──────────────────────── */}
            <TabsContent value="critical" className="mt-0 overflow-auto">
              <div className="p-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle size={15} className="text-destructive" />
                      크리티컬 패스 (Critical Path)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      여유시간(Total Float)이 0일인 공종. 하나라도 지연 시 전체 공기가 늘어납니다.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {cpmResult.criticalPath.map((name, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          {i > 0 && <ChevronRight size={12} className="text-muted-foreground" />}
                          <Badge variant="destructive" className="text-xs">{name}</Badge>
                        </div>
                      ))}
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>공종명</TableHead>
                          <TableHead className="text-right w-12 text-xs">단위</TableHead>
                          <TableHead className="text-right">기간(일)</TableHead>
                          <TableHead className="text-right text-xs">ES</TableHead>
                          <TableHead className="text-right text-xs">EF</TableHead>
                          <TableHead className="text-right text-xs">TF</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cpmResult.tasks.filter(t => t.isCritical).map(task => (
                          <TableRow key={task.taskId} className="bg-destructive/5">
                            <TableCell>
                              <div className="font-medium text-destructive text-sm">{task.name}</div>
                              {task.wbsCode && (
                                <div className="text-[10px] text-muted-foreground font-mono">{task.wbsCode}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{task.unit ?? '—'}</TableCell>
                            <TableCell className="text-right font-mono font-medium">{task.duration}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">{task.ES}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">{task.EF}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-destructive">0</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

          </Tabs>
        )}
      </div>
    </div>
  )
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item)
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {} as Record<string, T[]>)
}
