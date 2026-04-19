'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Play, FileDown, ChevronDown, ChevronUp, BarChart3, AlertTriangle, ChevronRight } from 'lucide-react'
import type { CPMSummary, CPMResult } from '@/lib/types'
import { generateReport } from '@/lib/engine/report-pdf'
import WBSTable, { type WBSTableHandle, type CompanyStandardSummary } from '@/components/wbs/WBSTable'
import { GanttChart, type GanttViewMode } from '@/components/gantt/GanttChart'
import MonteCarloPanel from '@/components/analysis/MonteCarloPanel'
import ProductivityPanel from '@/components/analysis/ProductivityPanel'
import CompanyStandardsPanel from '@/components/analysis/CompanyStandardsPanel'
import ResourcePlanPanel from '@/components/analysis/ResourcePlanPanel'
import EmptyState from '@/components/common/EmptyState'
import { Skeleton, SkeletonKpiGrid, SkeletonTable } from '@/components/common/Skeleton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Project {
  id: string
  name: string
  client?: string
  location?: string
  ground?: number
  basement?: number
  bldgArea?: number
  startDate?: string
  productivityAdjustments?: Array<{ taskId: string; multiplier: number }> | null
}

interface Props {
  projectId: string
  project: Project | null
}

type WBSMode = 'cp' | 'full'
type ActivePanel = 'wbs' | 'gantt' | 'montecarlo' | 'productivity' | 'standards' | 'resource' | 'critical' | 'summary'

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

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item)
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

export default function Stage1Page({ projectId, project }: Props) {
  const [cpmResult, setCpmResult] = useState<CPMSummary | null>(null)
  const [currentMode, setCurrentMode] = useState<WBSMode>('cp')
  const [selectedMode, setSelectedMode] = useState<WBSMode>('cp')
  const [calculating, setCalculating] = useState(false)
  const [activePanel, setActivePanel] = useState<ActivePanel>('wbs')
  const [ganttView, setGanttView] = useState<GanttViewMode>('week')
  const [mcResult, setMcResult] = useState<{
    original: number; mean: number; p80: number; p95: number; stdDev: number; iterations: number
  } | null>(null)
  const [showMcPanel, setShowMcPanel] = useState(false)
  const [showProdPanel, setShowProdPanel] = useState(false)
  const [standards, setStandards] = useState<CompanyStandardSummary[]>([])
  const wbsTableRef = useRef<WBSTableHandle>(null)

  // 회사 실적 표준 로드 (WBS 컬럼에 평균 투입 인원 표시용)
  useEffect(() => {
    fetch('/api/company-standards?includeProposals=1')
      .then(r => r.json())
      .then(data => {
        const summaries: CompanyStandardSummary[] = []
        for (const s of data.standards ?? []) {
          summaries.push({ trade: s.trade, unit: s.unit, value: s.value, approved: true, sampleCount: s.sampleCount })
        }
        for (const c of data.candidates ?? []) {
          // 승인된 게 없는 것만 후보로 추가
          if (summaries.some(x => x.trade === c.trade && x.unit === c.unit)) continue
          summaries.push({ trade: c.trade, unit: c.unit, value: c.avgValue, approved: false, sampleCount: c.totalSamples })
        }
        setStandards(summaries)
      })
      .catch(() => {})
  }, [])

  async function calculate() {
    setCalculating(true)
    const res = await fetch(`/api/projects/${projectId}/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: selectedMode }),
    })
    if (res.ok) {
      const data = await res.json()
      setCpmResult(data)
      setCurrentMode(selectedMode)
    }
    setCalculating(false)
  }

  function downloadPdf() {
    if (!project || !cpmResult) return
    const doc = generateReport({
      project: {
        name: project.name,
        client: project.client,
        location: project.location,
        ground: project.ground ?? 0,
        basement: project.basement ?? 0,
        bldgArea: project.bldgArea,
        startDate: project.startDate,
      },
      cpm: cpmResult,
      mode: currentMode,
      monteCarlo: mcResult ?? undefined,
    })
    doc.save(`CLSP_${project.name.replace(/\s+/g, '_')}_Report.pdf`)
  }

  function fmtProductivity(task: CPMResult): string {
    if (task.productivity) return `생산성 ${task.productivity} ${task.unit ?? ''}/일`
    if (task.stdDays) return `${task.stdDays}일/${task.unit ?? '층'}`
    return ''
  }

  const byCategory = cpmResult ? groupBy(cpmResult.tasks, t => t.category) : null
  const startDate = project?.startDate ? new Date(project.startDate) : null

  function completionDate() {
    if (!startDate || !cpmResult) return null
    const d = new Date(startDate)
    d.setDate(d.getDate() + cpmResult.totalDuration)
    return d.toLocaleDateString('ko-KR')
  }

  const PANEL_TABS: { id: ActivePanel; label: string }[] = [
    { id: 'wbs', label: 'WBS 공정표' },
    { id: 'summary', label: 'CPM 결과' },
    { id: 'critical', label: '크리티컬 패스' },
    { id: 'gantt', label: '공정표(Gantt)' },
    { id: 'montecarlo', label: '몬테카를로' },
    { id: 'productivity', label: '생산성 조정' },
    { id: 'resource', label: '자원 계획' },
    { id: 'standards', label: '회사 실적 표준' },
  ]

  return (
    <div className="flex h-full overflow-hidden">
      {/* 좌측 고정 패널 */}
      <div className="w-72 flex-shrink-0 bg-slate-900 text-white flex flex-col overflow-y-auto">
        <div className="p-5 space-y-5 flex-1">
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              WBS 모드
            </h3>
            <div className="flex rounded-lg overflow-hidden border border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedMode('cp')}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  selectedMode === 'cp'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                간략 (CP)
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('full')}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  selectedMode === 'full'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                상세 (Full)
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
              {selectedMode === 'cp'
                ? '20개 집계 공종 기반 CPM 계산'
                : '마감·설비 층별 전개 상세 CPM'}
            </p>
          </div>

          {/* CPM 계산 버튼 */}
          <button
            type="button"
            onClick={calculate}
            disabled={calculating}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {calculating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                계산 중...
              </>
            ) : (
              <>
                <Play size={14} />
                CPM 계산 실행
              </>
            )}
          </button>

          {/* CPM 결과 요약 */}
          {cpmResult && (
            <div className="space-y-2">
              <div className="bg-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">총 공기</span>
                  <span className="text-lg font-bold text-blue-400">{cpmResult.totalDuration}일</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">총 공종</span>
                  <span className="text-sm font-semibold text-slate-200">{cpmResult.tasks.length}개</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">크리티컬 패스</span>
                  <span className="text-sm font-semibold text-orange-400">
                    {cpmResult.tasks.filter(t => t.isCritical).length}개 공종
                  </span>
                </div>
                {completionDate() && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">예상 준공</span>
                    <span className="text-xs text-slate-300">{completionDate()}</span>
                  </div>
                )}
              </div>

              {/* 몬테카를로 설정 패널 */}
              <div className="border border-slate-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMcPanel(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  <span>몬테카를로 시뮬레이션</span>
                  {showMcPanel ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                {showMcPanel && (
                  <div className="px-4 pb-3 text-xs text-slate-400">
                    우측 패널에서 실행하세요.
                  </div>
                )}
              </div>

              {/* 생산성 조정 패널 */}
              <div className="border border-slate-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowProdPanel(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  <span>생산성 조정</span>
                  {showProdPanel ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                {showProdPanel && (
                  <div className="px-4 pb-3 text-xs text-slate-400">
                    우측 패널에서 조정하세요.
                  </div>
                )}
              </div>

              {/* PDF 다운로드 */}
              <button
                type="button"
                onClick={downloadPdf}
                className="w-full py-2.5 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <FileDown size={13} />
                보고서 PDF 다운로드
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 우측 스크롤 영역 */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {!cpmResult && !calculating && (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={BarChart3}
              title="아직 CPM이 계산되지 않았습니다"
              description="좌측 패널에서 모드(간략/상세)를 고르고 'CPM 계산 실행'을 누르세요. WBS가 자동 생성되고 크리티컬 패스·간트·몬테카를로·자원계획이 차례로 활성화됩니다."
              actions={[
                { label: 'CPM 계산 실행', onClick: calculate, icon: <Play size={14} />, variant: 'primary' },
              ]}
            />
          </div>
        )}

        {calculating && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              WBS 자동 생성 및 CPM 계산 중...
            </div>
            <SkeletonKpiGrid count={3} />
            <Skeleton className="h-6 w-1/4" />
            <SkeletonTable rows={8} cols={6} />
          </div>
        )}

        {cpmResult && (
          <div className="flex flex-col h-full">
            {/* 탭 */}
            <div className="flex-shrink-0 flex items-center gap-1 px-6 pt-4 pb-0 border-b border-gray-200 bg-white">
              {PANEL_TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePanel(tab.id)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    activePanel === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 탭 콘텐츠 */}
            <div className="flex-1 overflow-auto">
              {/* WBS */}
              {activePanel === 'wbs' && byCategory && (
                <div className="p-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>WBS 공정 목록 <span className="text-xs font-normal text-gray-400">({cpmResult.tasks.length}개 공종)</span></span>
                        <div className="flex gap-2 text-xs">
                          <button onClick={() => wbsTableRef.current?.expandAll()} className="text-gray-400 hover:text-gray-700">전체 펼치기</button>
                          <span className="text-gray-300">|</span>
                          <button onClick={() => wbsTableRef.current?.collapseAll()} className="text-gray-400 hover:text-gray-700">전체 접기</button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <WBSTable
                        ref={wbsTableRef}
                        byCategory={byCategory}
                        fmtProductivity={fmtProductivity}
                        categoryColors={Object.fromEntries(
                          Object.keys(byCategory).map(cat => [cat, CATEGORY_COLORS_HEX[cat] ?? '#94a3b8'])
                        )}
                        standards={standards}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* CPM 결과 요약 */}
              {activePanel === 'summary' && (
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="border-blue-200 bg-blue-50">
                      <CardContent className="pt-6">
                        <p className="text-xs text-gray-500 mb-1">총 공사 기간</p>
                        <p className="text-3xl font-bold text-blue-700">
                          {cpmResult.totalDuration}
                          <span className="text-sm font-normal text-gray-400 ml-1">일</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {completionDate() ? `준공 예정 ${completionDate()}` : `약 ${Math.round(cpmResult.totalDuration / 30)}개월`}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-xs text-gray-500 mb-1">총 공종 수</p>
                        <p className="text-3xl font-bold">
                          {cpmResult.tasks.length}
                          <span className="text-sm font-normal text-gray-400 ml-1">개</span>
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-xs text-gray-500 mb-1">크리티컬 패스</p>
                        <p className="text-3xl font-bold text-orange-500">
                          {cpmResult.tasks.filter(t => t.isCritical).length}
                          <span className="text-sm font-normal text-gray-400 ml-1">개 공종</span>
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
                            const maxDur = Math.max(...tasks.map(t => t.EF))
                            const colorHex = CATEGORY_COLORS_HEX[cat] ?? '#94a3b8'
                            return (
                              <div key={cat} className="flex items-center gap-3">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorHex }} />
                                <span className="text-sm w-24 flex-shrink-0">{cat}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full" style={{
                                    width: `${(maxDur / cpmResult.totalDuration) * 100}%`,
                                    background: colorHex,
                                  }} />
                                </div>
                                <span className="text-xs text-gray-400 w-14 text-right">{tasks.length}개</span>
                                {critCount > 0 && (
                                  <Badge className="bg-orange-500 text-white border-0 text-[10px] px-1.5 py-0">CP {critCount}</Badge>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* 크리티컬 패스 */}
              {activePanel === 'critical' && (
                <div className="p-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle size={15} className="text-orange-500" />
                        크리티컬 패스 (Critical Path)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-500">
                        여유시간(Total Float)이 0일인 공종. 하나라도 지연 시 전체 공기가 늘어납니다.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {cpmResult.criticalPath.map((name, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            {i > 0 && <ChevronRight size={12} className="text-gray-400" />}
                            <Badge className="bg-orange-500 text-white border-0 text-xs">{name}</Badge>
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
                            <TableRow key={task.taskId} className="bg-orange-50">
                              <TableCell>
                                <div className="font-medium text-orange-600 text-sm">{task.name}</div>
                                {task.wbsCode && <div className="text-[10px] text-gray-400 font-mono">{task.wbsCode}</div>}
                              </TableCell>
                              <TableCell className="text-right text-xs text-gray-400">{task.unit ?? '—'}</TableCell>
                              <TableCell className="text-right font-mono font-medium">{task.duration}</TableCell>
                              <TableCell className="text-right font-mono text-xs text-gray-400">{task.ES}</TableCell>
                              <TableCell className="text-right font-mono text-xs text-gray-400">{task.EF}</TableCell>
                              <TableCell className="text-right font-mono font-bold text-orange-500">0</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Gantt */}
              {activePanel === 'gantt' && (
                <div className="flex flex-col h-full">
                  <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-blue-700 inline-block" />일반 공종
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />
                        <span className="text-orange-500 font-medium">크리티컬 패스</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                      {(['day', 'week', 'month'] as GanttViewMode[]).map(v => (
                        <button key={v} onClick={() => setGanttView(v)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${ganttView === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}>
                          {v === 'day' ? 'Day' : v === 'week' ? 'Week' : 'Month'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden p-4">
                    <GanttChart
                      tasks={cpmResult.tasks}
                      totalDuration={cpmResult.totalDuration}
                      startDate={project?.startDate}
                      viewMode={ganttView}
                    />
                  </div>
                </div>
              )}

              {/* 몬테카를로 */}
              {activePanel === 'montecarlo' && (
                <div className="p-6">
                  <MonteCarloPanel
                    projectId={projectId}
                    mode={currentMode}
                    hasCpmResult={!!cpmResult}
                    onResult={setMcResult}
                  />
                </div>
              )}

              {/* 자원 계획 */}
              {activePanel === 'resource' && (
                <div className="p-6">
                  <ResourcePlanPanel
                    cpmTasks={cpmResult?.tasks ?? null}
                    startDate={project?.startDate}
                    standards={standards}
                  />
                </div>
              )}

              {/* 회사 실적 표준 */}
              {activePanel === 'standards' && (
                <div className="p-6">
                  <CompanyStandardsPanel
                    cpmTasks={cpmResult ? cpmResult.tasks.map(t => ({
                      taskId: t.taskId,
                      name: t.name,
                      category: t.category,
                      duration: t.duration,
                      isCritical: t.isCritical,
                    })) : null}
                  />
                </div>
              )}

              {/* 생산성 조정 */}
              {activePanel === 'productivity' && (
                <div className="p-6">
                  <ProductivityPanel
                    projectId={projectId}
                    mode={currentMode}
                    cpmTasks={cpmResult ? cpmResult.tasks.map(t => ({
                      taskId: t.taskId,
                      name: t.name,
                      category: t.category,
                      duration: t.duration,
                      isCritical: t.isCritical,
                    })) : null}
                    initialAdjustments={project?.productivityAdjustments ?? null}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
