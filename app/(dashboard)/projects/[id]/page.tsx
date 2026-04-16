'use client'

import React, { useEffect, useState, use, useRef } from 'react'
import Link from 'next/link'
import {
  Building2, ChevronRight, Play, AlertTriangle,
  ChevronDown, ChevronUp, Pencil, Layers, Grid3x3,
  CalendarDays, BarChart3, Dice5, SlidersHorizontal, FileDown,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GanttChart, type GanttViewMode } from '@/components/gantt/GanttChart'
import MonteCarloPanel from '@/components/analysis/MonteCarloPanel'
import ProductivityPanel from '@/components/analysis/ProductivityPanel'
import { generateReport } from '@/lib/engine/report-pdf'
import type { CPMSummary, CPMResult } from '@/lib/types'
import { getWorkRate } from '@/lib/engine/wbs'
import WBSTable, { type WBSTableHandle } from '@/components/wbs/WBSTable'
import RiskPanel from '@/components/precon/RiskPanel'
import AccelerationPanel from '@/components/precon/AccelerationPanel'
import BaselineImportPanel from '@/components/precon/BaselineImportPanel'
import WeeklyProgressPanel from '@/components/construction/WeeklyProgressPanel'
import DailyReportPanel from '@/components/construction/DailyReportPanel'
import ProgressDashboard from '@/components/analytics/ProgressDashboard'

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

const CATEGORY_COLORS_HEX: Record<string, string> = {
  '공사준비': '#64748b',
  '토목공사': '#ca8a04',
  '골조공사': '#2563eb',
  '마감공사': '#059669',
  '설비공사': '#0891b2',
  '전기공사': '#7c3aed',
  '외부공사': '#16a34a',
  '부대공사': '#dc2626',
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
  const wbsTableRef = useRef<WBSTableHandle>(null)
  const [ganttView, setGanttView]   = useState<GanttViewMode>('week')
  const [mcResult, setMcResult]     = useState<{ original: number; mean: number; p80: number; p95: number; stdDev: number; iterations: number } | null>(null)

  function downloadPdf() {
    if (!project || !cpmResult) return
    const doc = generateReport({
      project: {
        name: project.name,
        client: project.client,
        location: project.location,
        ground: project.ground,
        basement: project.basement,
        bldgArea: project.bldgArea,
        startDate: project.startDate,
      },
      cpm: cpmResult,
      mode: currentMode,
      monteCarlo: mcResult ?? undefined,
    })
    doc.save(`CLSP_${project.name.replace(/\s+/g, '_')}_Report.pdf`)
  }

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
      <div className="flex-shrink-0 px-8 pt-6 pb-4 border-b border-border bg-card">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
          <ChevronRight size={12} />
          <span className="text-foreground truncate">{project.name}</span>
        </div>

        {/* Project info + actions */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-clsp-navy/10 rounded-xl flex items-center justify-center border border-clsp-navy/20">
              <Building2 size={20} className="text-clsp-navy" />
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
                {cpmResult && <span className="text-clsp-navy font-medium">총 공기 {cpmResult.totalDuration}일</span>}
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

            {cpmResult && (
              <Button variant="outline" size="sm" onClick={downloadPdf}>
                <FileDown size={13} className="mr-1.5" />
                보고서 출력
              </Button>
            )}

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
            <div className="w-8 h-8 border-2 border-clsp-navy border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">WBS 자동 생성 및 CPM 계산 중...</p>
          </div>
        )}

        {/* Results */}
        {cpmResult && (
          <Tabs defaultValue="wbs" className="h-full flex flex-col">

            {/* Tab list */}
            <div className="flex-shrink-0 px-8 pt-4 border-b border-border/40">
              <TabsList className="h-9 flex-wrap">
                {/* 1단계 */}
                <TabsTrigger value="wbs" className="text-xs gap-1.5"><BarChart3 size={13} />WBS 공정표</TabsTrigger>
                <TabsTrigger value="summary" className="text-xs gap-1.5"><BarChart3 size={13} />CPM 결과</TabsTrigger>
                <TabsTrigger value="critical" className="text-xs">크리티컬 패스</TabsTrigger>
                <TabsTrigger value="gantt" className="text-xs gap-1.5"><CalendarDays size={13} />공정표 (Gantt)</TabsTrigger>
                <TabsTrigger value="montecarlo" className="text-xs gap-1.5"><Dice5 size={13} />몬테카를로</TabsTrigger>
                <TabsTrigger value="productivity" className="text-xs gap-1.5"><SlidersHorizontal size={13} />생산성 조정</TabsTrigger>
                {/* 2단계: 프리콘 */}
                <TabsTrigger value="risk" className="text-xs gap-1.5"><AlertTriangle size={13} />R&amp;O</TabsTrigger>
                <TabsTrigger value="acceleration" className="text-xs gap-1.5"><Layers size={13} />공기단축</TabsTrigger>
                <TabsTrigger value="baseline" className="text-xs gap-1.5"><Grid3x3 size={13} />베이스라인</TabsTrigger>
                {/* 3단계: 실시공 */}
                <TabsTrigger value="weekly" className="text-xs gap-1.5"><CalendarDays size={13} />주간실적</TabsTrigger>
                <TabsTrigger value="daily" className="text-xs gap-1.5"><Pencil size={13} />작업일보</TabsTrigger>
                {/* 4단계: 분석 */}
                <TabsTrigger value="analytics" className="text-xs gap-1.5"><BarChart3 size={13} />분석 대시보드</TabsTrigger>
              </TabsList>
            </div>

            {/* ── GANTT TAB ──────────────────────────────── */}
            <TabsContent value="gantt" className="flex-1 flex flex-col overflow-hidden mt-0 p-0">
              {/* Toolbar */}
              <div className="flex-shrink-0 flex items-center justify-between px-8 py-3 border-b border-border/40 bg-background">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-clsp-navy inline-block" />
                    일반 공종
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-clsp-orange inline-block" />
                    <span className="text-clsp-orange font-medium">크리티컬 패스</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-8 h-1.5 rounded bg-clsp-navy/20 inline-block" />
                    여유 시간
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
                  <Card className="border-clsp-navy/30 bg-clsp-navy/5">
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground mb-1">총 공사 기간</p>
                      <p className="text-3xl font-bold text-clsp-navy">
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
                      <p className="text-3xl font-bold text-clsp-orange">
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
                                <Badge className="bg-clsp-orange text-white border-0 text-[10px] px-1.5 py-0">CP {critCount}</Badge>
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
                          onClick={() => wbsTableRef.current?.expandAll()}
                          className="text-muted-foreground hover:text-foreground"
                        >전체 펼치기</button>
                        <span className="text-muted-foreground">|</span>
                        <button
                          onClick={() => wbsTableRef.current?.collapseAll()}
                          className="text-muted-foreground hover:text-foreground"
                        >전체 접기</button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {byCategory && (
                      <WBSTable
                        ref={wbsTableRef}
                        byCategory={byCategory}
                        fmtProductivity={fmtProductivity}
                        categoryColors={Object.fromEntries(
                          Object.keys(byCategory).map(cat => [cat, CATEGORY_COLORS_HEX[cat] ?? '#94a3b8'])
                        )}
                      />
                    )}
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
                      <AlertTriangle size={15} className="text-clsp-orange" />
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
                          <Badge className="bg-clsp-orange text-white border-0 text-xs">{name}</Badge>
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
                          <TableRow key={task.taskId} className="bg-clsp-orange/5">
                            <TableCell>
                              <div className="font-medium text-clsp-orange text-sm">{task.name}</div>
                              {task.wbsCode && (
                                <div className="text-[10px] text-muted-foreground font-mono">{task.wbsCode}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{task.unit ?? '—'}</TableCell>
                            <TableCell className="text-right font-mono font-medium">{task.duration}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">{task.ES}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">{task.EF}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-clsp-orange">0</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── MONTE CARLO TAB ──────────────────────── */}
            <TabsContent value="montecarlo" className="mt-0 overflow-auto">
              <div className="p-8">
                <MonteCarloPanel projectId={id} mode={currentMode} hasCpmResult={!!cpmResult} onResult={setMcResult} />
              </div>
            </TabsContent>

            {/* ── PRODUCTIVITY TAB ─────────────────────── */}
            <TabsContent value="productivity" className="mt-0 overflow-auto">
              <div className="p-8">
                <ProductivityPanel
                  projectId={id}
                  mode={currentMode}
                  cpmTasks={cpmResult ? cpmResult.tasks.map(t => ({
                    taskId: t.taskId,
                    name: t.name,
                    category: t.category,
                    duration: t.duration,
                    isCritical: t.isCritical,
                  })) : null}
                />
              </div>
            </TabsContent>

            {/* ── 2단계: R&O ──────────────────────────────── */}
            <TabsContent value="risk" className="mt-0 overflow-auto">
              <div className="p-6">
                <RiskPanel projectId={id} />
              </div>
            </TabsContent>

            {/* ── 2단계: 공기단축 ──────────────────────────── */}
            <TabsContent value="acceleration" className="mt-0 overflow-auto">
              <div className="p-6">
                <AccelerationPanel projectId={id} cpmResult={cpmResult} />
              </div>
            </TabsContent>

            {/* ── 2단계: 베이스라인 ─────────────────────────── */}
            <TabsContent value="baseline" className="mt-0 overflow-auto">
              <div className="p-6">
                <BaselineImportPanel projectId={id} />
              </div>
            </TabsContent>

            {/* ── 3단계: 주간실적 ──────────────────────────── */}
            <TabsContent value="weekly" className="mt-0 overflow-auto">
              <div className="p-6">
                <WeeklyProgressPanel projectId={id} cpmResult={cpmResult} />
              </div>
            </TabsContent>

            {/* ── 3단계: 작업일보 ──────────────────────────── */}
            <TabsContent value="daily" className="mt-0 overflow-auto">
              <div className="p-6">
                <DailyReportPanel projectId={id} />
              </div>
            </TabsContent>

            {/* ── 4단계: 분석 대시보드 ─────────────────────── */}
            <TabsContent value="analytics" className="mt-0 overflow-auto">
              <div className="p-6">
                <ProgressDashboard projectId={id} projectName={project?.name} cpmResult={cpmResult} />
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
