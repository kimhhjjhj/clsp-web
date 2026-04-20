'use client'

import React, { useEffect, useMemo, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Loader2, Play, Gauge, ShieldAlert, Zap, GitCompareArrows, LayoutGrid, Copy,
} from 'lucide-react'
import RiskPanel from '@/components/precon/RiskPanel'
import AccelerationPanel from '@/components/precon/AccelerationPanel'
import BaselineImportPanel from '@/components/precon/BaselineImportPanel'
import ScenarioDashboard from '@/components/precon/ScenarioDashboard'
import ScenarioComparator from '@/components/precon/ScenarioComparator'
import BaselineCompare from '@/components/precon/BaselineCompare'
import ProcessMapBoard from '@/components/precon/ProcessMapBoard'
import { SkeletonKpiGrid } from '@/components/common/Skeleton'
import { StageTabs, SummaryStrip, SummaryStat, type StageTabDef } from '@/components/common/StageTabs'
import type { CPMSummary } from '@/lib/types'

interface RO {
  id: string
  type: string
  category: string
  impactType: string
  impactDays: number | null
  probability: number
  status: string
  proposedCost?: number | null
  confirmedCost?: number | null
  progress?: string | null
}

interface Accel {
  id: string
  category: string
  method: string
  days: number
}

interface BTask {
  id: string
  name: string
  duration: number
  start: string | null
  finish: string | null
  level: number
}

interface AiCostSummary {
  summary?: {
    grandTotalKRW?: number
    pricePerPyongKRW?: number
    pricePerSqmKRW?: number
  }
  trades?: Array<{ name: string; totalKRW: number }>
  estimatedAt?: string
}

interface ProjectInfo {
  startDate?: string
  bldgArea?: number | null
  aiCostEstimate?: AiCostSummary | null
}

interface Props {
  projectId: string
}

type TabId = 'overview' | 'rno' | 'scenario' | 'compare' | 'baseline' | 'processmap'

export default function Stage2Page({ projectId }: Props) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">불러오는 중…</div>}>
      <Stage2Inner projectId={projectId} />
    </Suspense>
  )
}

function Stage2Inner({ projectId }: Props) {
  const searchParams = useSearchParams()
  const initialTab = ((searchParams?.get('tab') as TabId) || 'overview')
  const [tab, setTab] = useState<TabId>(initialTab)

  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [risks, setRisks] = useState<RO[]>([])
  const [accelerations, setAccelerations] = useState<Accel[]>([])
  const [baseline, setBaseline] = useState<BTask[]>([])
  const [cpmResult, setCpmResult] = useState<CPMSummary | null>(null)
  const [calculating, setCalculating] = useState(false)

  const loadRisks = useCallback(() => {
    fetch(`/api/projects/${projectId}/risks`)
      .then(r => r.json())
      .then((data: RO[]) => setRisks(data))
      .catch(() => {})
  }, [projectId])

  const loadAccelerations = useCallback(() => {
    fetch(`/api/projects/${projectId}/accelerations`)
      .then(r => r.json())
      .then((data: Accel[]) => setAccelerations(data))
      .catch(() => {})
  }, [projectId])

  const loadBaseline = useCallback(() => {
    fetch(`/api/projects/${projectId}/baseline`)
      .then(r => r.json())
      .then((data: BTask[]) => setBaseline(data))
      .catch(() => {})
  }, [projectId])

  const runCpm = useCallback(async () => {
    setCalculating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'cp' }),
      })
      if (res.ok) setCpmResult(await res.json())
    } finally {
      setCalculating(false)
    }
  }, [projectId])

  // 프로젝트 기본정보 + 리스크/단축/베이스라인/CPM 병렬 로드
  useEffect(() => {
    fetch(`/api/projects/${projectId}`).then(r => r.json()).then(setProject).catch(() => {})
    loadRisks()
    loadAccelerations()
    loadBaseline()
    runCpm()
  }, [projectId, loadRisks, loadAccelerations, loadBaseline, runCpm])

  // 요약 바 수치 계산 (탭 전환 영향 없음)
  const summary = useMemo(() => {
    const roCount = risks.length
    const proposedSum = Math.round(risks.reduce((s, r) => s + (r.proposedCost ?? 0), 0))
    const confirmedSum = Math.round(risks.reduce((s, r) => s + (r.confirmedCost ?? 0), 0))
    const cpCount = cpmResult ? cpmResult.tasks.filter(t => t.isCritical).length : 0
    const totalDuration = cpmResult?.totalDuration ?? null
    const scenarioCount = accelerations.length
    const baselineOn = baseline.length > 0
    return { roCount, proposedSum, confirmedSum, cpCount, totalDuration, scenarioCount, baselineOn }
  }, [risks, cpmResult, accelerations, baseline])

  const tabs: StageTabDef<TabId>[] = [
    { id: 'overview',   label: '개요',         icon: <Gauge size={14} />, hint: 'CPM 결과 + 현재 상태 요약' },
    { id: 'rno',        label: 'R&O',         icon: <ShieldAlert size={14} />, badge: summary.roCount, hint: '리스크·기회 · 엑셀 연동' },
    { id: 'scenario',   label: '공기단축',     icon: <Zap size={14} />, badge: summary.scenarioCount, hint: 'CP 공종 단축 시나리오' },
    { id: 'compare',    label: '시나리오 비교', icon: <Copy size={14} />, hint: '공법·multiplier·가속 조합 5개 병렬 비교' },
    { id: 'baseline',   label: '베이스라인',   icon: <GitCompareArrows size={14} />, badge: summary.baselineOn ? '✓' : null, hint: 'MSP 기준 · 현재 CPM 비교' },
    { id: 'processmap', label: '프로세스맵',   icon: <LayoutGrid size={14} />, hint: '협력사 Pull Planning 보드' },
  ]

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 상단 요약 바 — 어느 탭이든 항상 보임 */}
      <SummaryStrip>
        <SummaryStat
          label="총 공기"
          value={summary.totalDuration != null ? `${summary.totalDuration}일` : '—'}
          sub={summary.cpCount > 0 ? `CP 공종 ${summary.cpCount}개` : 'CPM 미계산'}
          accent="#2563eb"
        />
        <SummaryStat
          label="R&O"
          value={`${summary.roCount}건`}
          sub={summary.roCount > 0 ? `확정 절감 ${summary.confirmedSum.toLocaleString()}백만` : '엑셀 임포트 가능'}
          accent="#16a34a"
        />
        <SummaryStat
          label="공기단축"
          value={`${summary.scenarioCount}건`}
          sub="시나리오"
          accent="#f97316"
        />
        <SummaryStat
          label="베이스라인"
          value={summary.baselineOn ? `${baseline.length}개 태스크` : '미등록'}
          sub={summary.baselineOn ? 'MSP 임포트 완료' : 'MSP 파일 필요'}
          accent="#7c3aed"
        />
      </SummaryStrip>

      {/* 탭 네비 — sticky */}
      <StageTabs tabs={tabs} current={tab} onChange={setTab} />

      {/* 본문 — 선택된 탭만 마운트 (lazy) */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          {tab === 'overview' && (
            <div className="space-y-4">
              {/* 공사비 요약 카드 — aiCostEstimate 있을 때만 */}
              {project?.aiCostEstimate?.summary && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">공사비 추정 (AI)</p>
                      <h3 className="text-sm font-bold text-gray-800 mt-0.5">초기 검토 기반 개략 공사비</h3>
                    </div>
                    <a
                      href={`/bid?projectId=${projectId}`}
                      className="text-[11px] text-blue-600 hover:underline no-underline font-semibold"
                    >개략공기 재검토 →</a>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                      <p className="text-[10px] text-blue-700 font-bold uppercase">총 공사비</p>
                      <p className="text-2xl font-bold text-blue-900 mt-1 font-mono">
                        {fmtKRW(project.aiCostEstimate.summary.grandTotalKRW)}
                        <span className="text-xs font-normal text-blue-500 ml-1">원</span>
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <p className="text-[10px] text-gray-500 font-bold uppercase">평당</p>
                      <p className="text-xl font-bold text-gray-800 mt-1 font-mono">
                        {project.aiCostEstimate.summary.pricePerPyongKRW
                          ? Math.round(project.aiCostEstimate.summary.pricePerPyongKRW / 10000).toLocaleString()
                          : '—'}
                        <span className="text-xs font-normal text-gray-400 ml-1">만원/평</span>
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <p className="text-[10px] text-gray-500 font-bold uppercase">㎡당</p>
                      <p className="text-xl font-bold text-gray-800 mt-1 font-mono">
                        {project.aiCostEstimate.summary.pricePerSqmKRW
                          ? Math.round(project.aiCostEstimate.summary.pricePerSqmKRW / 1000).toLocaleString()
                          : '—'}
                        <span className="text-xs font-normal text-gray-400 ml-1">천원/㎡</span>
                      </p>
                    </div>
                  </div>
                  {/* 공종별 상위 트레이드 */}
                  {Array.isArray(project.aiCostEstimate.trades) && project.aiCostEstimate.trades.length > 0 && (
                    <details className="mt-3">
                      <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-gray-800 font-semibold">
                        공종별 내역 ({project.aiCostEstimate.trades.length}종) ▾
                      </summary>
                      <div className="mt-2 space-y-1">
                        {[...project.aiCostEstimate.trades].sort((a, b) => b.totalKRW - a.totalKRW).slice(0, 10).map((t, i) => {
                          const max = Math.max(...project.aiCostEstimate!.trades!.map(x => x.totalKRW))
                          const pct = max > 0 ? (t.totalKRW / max) * 100 : 0
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[11px] text-gray-600 w-20 truncate">{t.name}</span>
                              <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                                <div className="h-full bg-blue-500/70" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[11px] text-gray-700 font-mono w-20 text-right">{fmtKRW(t.totalKRW)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </details>
                  )}
                  {project.aiCostEstimate.estimatedAt && (
                    <p className="text-[10px] text-gray-400 mt-3">
                      추정 시각: {new Date(project.aiCostEstimate.estimatedAt).toLocaleString('ko-KR')}
                    </p>
                  )}
                </div>
              )}
              {!project?.aiCostEstimate?.summary && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <strong>공사비 추정이 없습니다.</strong>
                    <span className="text-amber-700 ml-2 text-xs">개략공기 재검토 화면에서 AI 공사비 추정을 한 번 실행하면 여기에 표시됩니다.</span>
                  </div>
                  <a href={`/bid?projectId=${projectId}`} className="text-xs font-semibold text-amber-800 bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded no-underline">추정하러 가기 →</a>
                </div>
              )}

              {!cpmResult && !calculating && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    CPM을 먼저 계산하면 시나리오·베이스라인 비교가 활성화됩니다.
                  </p>
                  <button
                    onClick={runCpm}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                  >
                    <Play size={13} /> CPM 계산 실행
                  </button>
                </div>
              )}
              {calculating && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 size={12} className="animate-spin text-blue-600" />
                    CPM 계산 중...
                  </div>
                  <SkeletonKpiGrid count={4} />
                </div>
              )}
              {cpmResult && (
                <ScenarioDashboard
                  projectId={projectId}
                  cpmResult={cpmResult}
                  risks={risks}
                  accelerations={accelerations}
                  startDate={project?.startDate}
                />
              )}
            </div>
          )}

          {tab === 'rno' && (
            <RiskPanel projectId={projectId} onUpdate={loadRisks} />
          )}

          {tab === 'scenario' && (
            <>
              {!cpmResult ? (
                <EmptyGate
                  title="CPM 결과가 필요합니다"
                  desc="'개요' 탭에서 CPM을 먼저 계산하세요. 계산되면 CP 공종과 자동 매칭됩니다."
                  action={<button onClick={() => setTab('overview')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">개요로 이동</button>}
                />
              ) : (
                <AccelerationPanel projectId={projectId} cpmResult={cpmResult} />
              )}
            </>
          )}

          {tab === 'compare' && <ScenarioComparator projectId={projectId} />}

          {tab === 'baseline' && (
            <div className="space-y-4">
              <BaselineImportPanel projectId={projectId} onUpdate={loadBaseline} />
              {baseline.length > 0 && cpmResult && (
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">베이스라인 vs 현재 CPM</h3>
                  <BaselineCompare cpmResult={cpmResult} baseline={baseline} />
                </div>
              )}
              {!cpmResult && baseline.length > 0 && (
                <p className="text-xs text-gray-500">비교 그래프를 보려면 '개요' 탭에서 CPM 계산이 필요합니다.</p>
              )}
            </div>
          )}

          {tab === 'processmap' && (
            <ProcessMapBoard projectId={projectId} startDate={project?.startDate} />
          )}
        </div>
      </div>
    </div>
  )
}

function fmtKRW(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만`
  return n.toLocaleString()
}

function EmptyGate({ title, desc, action }: { title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
      <h3 className="text-base font-bold text-gray-800">{title}</h3>
      <p className="text-sm text-gray-500 mt-1.5">{desc}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
