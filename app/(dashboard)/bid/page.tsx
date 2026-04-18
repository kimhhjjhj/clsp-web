'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardCheck, Building2, Ruler, Layers, Play, Save, TrendingUp,
  Calendar, Users, DollarSign, AlertTriangle, Loader2, ArrowRight,
  BarChart3, ChevronRight,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { useToast } from '@/components/common/Toast'
import BenchmarkPanel from '@/components/common/BenchmarkPanel'
import AiCostEstimate from '@/components/bid/AiCostEstimate'
import WBSTable, { type WBSTableHandle, type CompanyStandardSummary } from '@/components/wbs/WBSTable'
import { GanttChart, type GanttViewMode } from '@/components/gantt/GanttChart'
import ResourcePlanPanel from '@/components/analysis/ResourcePlanPanel'
import CompanyStandardsPanel from '@/components/analysis/CompanyStandardsPanel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CPMResult } from '@/lib/types'

interface BidInput {
  name: string
  type: string
  ground: string
  basement: string
  lowrise: string
  hasTransfer: boolean
  bldgArea: string
  buildingArea: string
  siteArea: string
  sitePerim: string
  bldgPerim: string
  wtBottom: string
  waBottom: string
  startDate: string
  monthlyFinCost: string
}

interface EstimateResult {
  cpm: {
    totalDuration: number
    taskCount: number
    criticalPathCount: number
    tasks: CPMResult[]
  }
  resourcePlan: {
    totalDuration: number
    peak: { day: number; count: number }
    avgDaily: number
    totalManDays: number
    monthlyTotals: { month: string; total: number; activeDays: number }[]
    uncoveredTasks: string[]
  }
  estimate: { laborCostKRW: number; totalEstimateKRW: number; dailyWage: number; laborRatio: number }
  delayScenarios: { weeks: number; additionalCostKRW: number }[]
}

type TopTab = 'cost' | 'schedule'
type SubTab = 'wbs' | 'summary' | 'critical' | 'gantt' | 'resource' | 'standards'

const INITIAL: BidInput = {
  name: '', type: '공동주택',
  ground: '20', basement: '2', lowrise: '0', hasTransfer: false,
  bldgArea: '30000', buildingArea: '1500', siteArea: '6000',
  sitePerim: '300', bldgPerim: '220',
  wtBottom: '3', waBottom: '6',
  startDate: '',
  monthlyFinCost: '5000',
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

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item)
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

export default function BidPage() {
  const router = useRouter()
  const toast = useToast()
  const [input, setInput] = useState<BidInput>(INITIAL)
  const [result, setResult] = useState<EstimateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // 결과 뷰 탭
  const [topTab, setTopTab] = useState<TopTab>('cost')
  const [subTab, setSubTab] = useState<SubTab>('wbs')
  const [ganttView, setGanttView] = useState<GanttViewMode>('week')
  const [standards, setStandards] = useState<CompanyStandardSummary[]>([])
  const wbsTableRef = useRef<WBSTableHandle>(null)

  function set<K extends keyof BidInput>(key: K, v: string) {
    setInput(p => ({ ...p, [key]: v }))
  }

  // 회사 실적 표준 로드 — WBS 컬럼의 평균 투입 인원 표시용
  useEffect(() => {
    fetch('/api/company-standards?includeProposals=1')
      .then(r => r.json())
      .then(data => {
        const summaries: CompanyStandardSummary[] = []
        for (const s of data.standards ?? []) {
          summaries.push({ trade: s.trade, unit: s.unit, value: s.value, approved: true, sampleCount: s.sampleCount })
        }
        for (const c of data.candidates ?? []) {
          if (summaries.some(x => x.trade === c.trade && x.unit === c.unit)) continue
          summaries.push({ trade: c.trade, unit: c.unit, value: c.avgValue, approved: false, sampleCount: c.totalSamples })
        }
        setStandards(summaries)
      })
      .catch(() => {})
  }, [])

  const estimate = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/bid/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.name || '임시 견적',
          ground: Number(input.ground) || 0,
          basement: Number(input.basement) || 0,
          lowrise: Number(input.lowrise) || 0,
          hasTransfer: input.hasTransfer,
          bldgArea: Number(input.bldgArea) || undefined,
          buildingArea: Number(input.buildingArea) || undefined,
          siteArea: Number(input.siteArea) || undefined,
          sitePerim: Number(input.sitePerim) || undefined,
          bldgPerim: Number(input.bldgPerim) || undefined,
          wtBottom: Number(input.wtBottom) || undefined,
          waBottom: Number(input.waBottom) || undefined,
          startDate: input.startDate || undefined,
          monthlyFinCost: Number(input.monthlyFinCost) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '계산 실패')
      setResult(data)
      toast.success('견적 산출 완료', `총공기 ${data.cpm.totalDuration}일 · 피크 ${data.resourcePlan.peak.count}명`)
    } catch (e: any) {
      toast.error('계산 실패', e.message)
    } finally { setLoading(false) }
  }, [input, toast])

  async function saveAsProject() {
    if (!result) return
    if (!input.name.trim()) { toast.warning('프로젝트명을 입력하세요'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.name,
          type: input.type,
          ground: Number(input.ground) || 0,
          basement: Number(input.basement) || 0,
          lowrise: Number(input.lowrise) || 0,
          hasTransfer: input.hasTransfer,
          bldgArea: Number(input.bldgArea) || null,
          buildingArea: Number(input.buildingArea) || null,
          siteArea: Number(input.siteArea) || null,
          sitePerim: Number(input.sitePerim) || null,
          bldgPerim: Number(input.bldgPerim) || null,
          wtBottom: Number(input.wtBottom) || null,
          waBottom: Number(input.waBottom) || null,
          startDate: input.startDate || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      toast.success('프로젝트로 저장됨', input.name)
      router.push(`/projects/${data.id}`)
    } catch (e: any) {
      toast.error('저장 실패', e.message)
    } finally { setSaving(false) }
  }

  const fmtKRW = (n: number) => {
    if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
    if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만`
    return n.toLocaleString()
  }

  const byCategory = useMemo(() => {
    if (!result?.cpm.tasks) return null
    return groupBy(result.cpm.tasks, t => t.category)
  }, [result])

  const fmtProductivity = useCallback((task: CPMResult): string => {
    if (task.productivity) return `생산성 ${task.productivity} ${task.unit ?? ''}/일`
    if (task.stdDays) return `${task.stdDays}일/${task.unit ?? '층'}`
    return ''
  }, [])

  const completionDate = useCallback((): string | null => {
    if (!input.startDate || !result) return null
    const d = new Date(input.startDate)
    if (Number.isNaN(d.getTime())) return null
    d.setDate(d.getDate() + result.cpm.totalDuration)
    return d.toLocaleDateString('ko-KR')
  }, [input.startDate, result])

  const criticalPathNames = useMemo(() => {
    if (!result?.cpm.tasks) return []
    return result.cpm.tasks.filter(t => t.isCritical).map(t => t.name)
  }, [result])

  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: 'wbs',       label: 'WBS 공정표' },
    { id: 'summary',   label: 'CPM 결과' },
    { id: 'critical',  label: '크리티컬 패스' },
    { id: 'gantt',     label: '공정표(Gantt)' },
    { id: 'resource',  label: '자원 계획' },
    { id: 'standards', label: '회사 실적 표준' },
  ]

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={ClipboardCheck}
        title="사업 초기 검토"
        subtitle="기본 정보만으로 개략 공기·공사비 산정 · 저장 없이 반복 시뮬 → 확정 시 프로젝트 생성"
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 좌측: 입력 폼 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 lg:sticky lg:top-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Building2 size={14} /> 프로젝트 개요
              </h3>

              <Field label="프로젝트명 (선택)">
                <input value={input.name} onChange={e => set('name', e.target.value)} placeholder="예: 강남 ◯◯ 신축공사"
                  className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="유형">
                  <select value={input.type} onChange={e => set('type', e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm">
                    <option>공동주택</option>
                    <option>오피스텔</option>
                    <option>업무시설</option>
                    <option>데이터센터</option>
                    <option>스튜디오</option>
                    <option>기타</option>
                  </select>
                </Field>
                <Field label="착공 예정일 (선택)" hint="공기 환산에 사용">
                  <input type="date" value={input.startDate} onChange={e => set('startDate', e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm" />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="지상 층수" icon={<Layers size={11} />}>
                  <input type="number" value={input.ground} onChange={e => set('ground', e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono" />
                </Field>
                <Field label="지하 층수">
                  <input type="number" value={input.basement} onChange={e => set('basement', e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono" />
                </Field>
                <Field label="저층부 층수" hint="없으면 0">
                  <input type="number" value={input.lowrise} onChange={e => set('lowrise', e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono" />
                </Field>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={input.hasTransfer}
                  onChange={e => setInput(p => ({ ...p, hasTransfer: e.target.checked }))}
                  className="rounded border-gray-300" />
                전이층(Transfer Slab) 있음
              </label>

              <div className="grid grid-cols-2 gap-3">
                <Field label="건축면적 (㎡)" icon={<Ruler size={11} />} hint="1층 바닥면적. 터파기 기준">
                  <input type="number" value={input.buildingArea} onChange={e => set('buildingArea', e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono" />
                </Field>
                <Field label="연면적 (㎡)" hint="전 층 바닥면적 합">
                  <input type="number" value={input.bldgArea} onChange={e => set('bldgArea', e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono" />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="대지면적 (㎡)">
                  <input type="number" value={input.siteArea} onChange={e => set('siteArea', e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono" />
                </Field>
                <Field label="대지둘레 (m)">
                  <input type="number" value={input.sitePerim} onChange={e => set('sitePerim', e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono" />
                </Field>
                <Field label="건물둘레 (m)">
                  <input type="number" value={input.bldgPerim} onChange={e => set('bldgPerim', e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="풍화토 바닥 (m)" hint="지표~풍화토 하단 깊이">
                  <input type="number" value={input.wtBottom} onChange={e => set('wtBottom', e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono" />
                </Field>
                <Field label="풍화암 바닥 (m)" hint="지표~풍화암 하단 깊이">
                  <input type="number" value={input.waBottom} onChange={e => set('waBottom', e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono" />
                </Field>
              </div>

              <Field label="월 금융·관리비 (만원)" hint="지연 시 추가 비용 계산용">
                <input type="number" value={input.monthlyFinCost} onChange={e => set('monthlyFinCost', e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono" />
              </Field>

              <button
                onClick={estimate}
                disabled={loading}
                className="w-full h-10 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {loading ? '계산 중...' : '개략 견적 산출'}
              </button>

              {result && (
                <button
                  onClick={saveAsProject}
                  disabled={saving}
                  className="w-full h-9 border border-gray-300 text-gray-700 bg-white rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  프로젝트로 저장
                </button>
              )}
            </div>
          </div>

          {/* 우측: 결과 */}
          <div className="lg:col-span-2 space-y-5">
            {!result ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <ClipboardCheck size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">좌측 정보 입력 후 <strong>개략 견적 산출</strong>을 누르세요</p>
                <p className="text-[11px] text-gray-400 mt-1">데이터는 저장되지 않고, 저장 버튼을 누를 때만 프로젝트가 생성됩니다</p>
              </div>
            ) : (
              <>
                {/* 유사 프로젝트 벤치마크 */}
                <BenchmarkPanel
                  query={{
                    type: input.type,
                    ground: Number(input.ground) || undefined,
                    basement: Number(input.basement) || undefined,
                    bldgArea: Number(input.bldgArea) || undefined,
                  }}
                  limit={5}
                />

                {/* 최상단 3KPI — 탭 공통 요약 (공사비는 AI 추정이 맡음) */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <Kpi icon={<Calendar size={14} className="text-blue-600" />} bg="bg-blue-50"
                    label="총 공기" value={`${result.cpm.totalDuration}`} unit="일"
                    sub={completionDate() ? `준공 ${completionDate()}` : `약 ${Math.round(result.cpm.totalDuration / 30)}개월`} />
                  <Kpi icon={<Users size={14} className="text-orange-600" />} bg="bg-orange-50"
                    label="피크 투입" value={`${result.resourcePlan.peak.count}`} unit="명"
                    sub={`${result.resourcePlan.peak.day + 1}일차`} />
                  <Kpi icon={<TrendingUp size={14} className="text-purple-600" />} bg="bg-purple-50"
                    label="일평균 투입" value={`${result.resourcePlan.avgDaily}`} unit="명"
                    sub={`누적 ${result.resourcePlan.totalManDays.toLocaleString()}인일`} />
                </div>

                {/* 최상단 대탭: 공사비 / 공기 */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex border-b border-gray-200">
                    <TopTabBtn
                      icon={<DollarSign size={14} />}
                      label="공사비"
                      active={topTab === 'cost'}
                      onClick={() => setTopTab('cost')}
                    />
                    <TopTabBtn
                      icon={<BarChart3 size={14} />}
                      label="공기"
                      active={topTab === 'schedule'}
                      onClick={() => setTopTab('schedule')}
                    />
                  </div>

                  {topTab === 'cost' && (
                    <div className="p-5 space-y-5">
                      {/* AI 개략 공사비 추정 — 물량 × 단가 방식 */}
                      <AiCostEstimate
                        type={input.type}
                        ground={Number(input.ground) || undefined}
                        basement={Number(input.basement) || undefined}
                        bldgArea={Number(input.bldgArea) || undefined}
                        buildingArea={Number(input.buildingArea) || undefined}
                        siteArea={Number(input.siteArea) || undefined}
                        totalDuration={result.cpm.totalDuration}
                        tasks={result.cpm.tasks}
                      />

                      {/* 지연 시나리오 */}
                      <div className="border-t border-gray-100 pt-5">
                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                          <AlertTriangle size={14} className="text-amber-500" /> 지연 민감도 (추가 금융·관리비)
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                          {result.delayScenarios.map(s => (
                            <div key={s.weeks} className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-center">
                              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">+{s.weeks}주 지연 시</p>
                              <p className="text-lg font-bold text-amber-900 mt-1 font-mono">+{fmtKRW(s.additionalCostKRW)}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">※ 월 금융·관리비 × 지연 기간 기준 · 손해 최소 추정</p>
                      </div>

                      {/* 월별 필요 인력 */}
                      <div className="border-t border-gray-100 pt-5">
                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                          <Users size={14} /> 월별 필요 인력
                        </h3>
                        {result.resourcePlan.monthlyTotals.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">
                            착공 예정일이 없어 월별 집계 생략 — 좌측 폼에 날짜 입력 후 재계산
                          </p>
                        ) : (
                          <ul className="space-y-1.5 max-h-64 overflow-auto">
                            {result.resourcePlan.monthlyTotals.map(m => {
                              const max = Math.max(...result.resourcePlan.monthlyTotals.map(x => x.total), 1)
                              const ratio = (m.total / max) * 100
                              return (
                                <li key={m.month} className="text-xs">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="font-mono text-gray-700">{m.month}</span>
                                    <span className="text-gray-500"><strong className="text-gray-900">{m.total.toLocaleString()}</strong> 인일 · {m.activeDays}일</span>
                                  </div>
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${ratio}%` }} />
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>

                      {/* CP 요약 */}
                      <div className="border-t border-gray-100 pt-5">
                        <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                          <ArrowRight size={14} className="text-orange-500" /> Critical Path 요약
                        </h3>
                        <p className="text-xs text-gray-600 mb-2">
                          전체 {result.cpm.taskCount}개 공종 중 <strong className="text-orange-600">{result.cpm.criticalPathCount}개</strong>가 Critical Path. 지연 시 공기 연장 직결.
                          <button onClick={() => { setTopTab('schedule'); setSubTab('critical') }} className="ml-2 text-[11px] text-blue-600 hover:underline">상세 →</button>
                        </p>
                        {result.resourcePlan.uncoveredTasks.length > 0 && (
                          <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 rounded p-2">
                            <strong>회사 실적 없는 공종:</strong> {result.resourcePlan.uncoveredTasks.join(', ')}
                            <br />
                            <span className="text-amber-600">인원 추정에서 제외됨. 일보 임포트로 데이터 확보 권장.</span>
                          </div>
                        )}
                      </div>

                      {/* 노무비 러프 참고 */}
                      <details className="border-t border-gray-100 pt-5">
                        <summary className="text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-800">
                          참고: 회사 실적 기반 노무비 러프 추정 (AI 없을 때 대체)
                        </summary>
                        <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-gray-500">총 투입 인일</span>
                            <span className="font-mono font-semibold text-gray-900">{result.resourcePlan.totalManDays.toLocaleString()} 인일</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">× 평균 일단가 27만원</span>
                            <span className="font-mono font-semibold text-gray-900">{fmtKRW(result.estimate.laborCostKRW)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">× 2.4 (자재·경비 1.4 포함)</span>
                            <span className="font-mono font-semibold text-gray-900">{fmtKRW(result.estimate.totalEstimateKRW)}</span>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-2">
                            ※ 이 방식은 일단가·자재비 비율이 고정이라 공종·유형별 차이를 반영 못 합니다. AI 추정 실패 시만 참고하세요.
                          </p>
                        </div>
                      </details>
                    </div>
                  )}

                  {topTab === 'schedule' && (
                    <div>
                      {/* 공기 서브탭 */}
                      <div className="flex items-center gap-1 px-4 pt-3 border-b border-gray-200 bg-gray-50 overflow-x-auto">
                        {SUB_TABS.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSubTab(t.id)}
                            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                              subTab === t.id
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-800'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {/* WBS 공정표 */}
                      {subTab === 'wbs' && byCategory && (
                        <div className="p-4">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-sm flex items-center justify-between">
                                <span>WBS 공정 목록 <span className="text-xs font-normal text-gray-400">({result.cpm.tasks.length}개 공종)</span></span>
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
                      {subTab === 'summary' && (
                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <Card className="border-blue-200 bg-blue-50">
                              <CardContent className="pt-6">
                                <p className="text-xs text-gray-500 mb-1">총 공사 기간</p>
                                <p className="text-3xl font-bold text-blue-700">
                                  {result.cpm.totalDuration}
                                  <span className="text-sm font-normal text-gray-400 ml-1">일</span>
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {completionDate() ? `준공 예정 ${completionDate()}` : `약 ${Math.round(result.cpm.totalDuration / 30)}개월`}
                                </p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="pt-6">
                                <p className="text-xs text-gray-500 mb-1">총 공종 수</p>
                                <p className="text-3xl font-bold">
                                  {result.cpm.taskCount}
                                  <span className="text-sm font-normal text-gray-400 ml-1">개</span>
                                </p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="pt-6">
                                <p className="text-xs text-gray-500 mb-1">크리티컬 패스</p>
                                <p className="text-3xl font-bold text-orange-500">
                                  {result.cpm.criticalPathCount}
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
                                            width: `${(maxDur / result.cpm.totalDuration) * 100}%`,
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
                      {subTab === 'critical' && (
                        <div className="p-4">
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
                                {criticalPathNames.map((name, i) => (
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
                                  {result.cpm.tasks.filter(t => t.isCritical).map(task => (
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
                      {subTab === 'gantt' && (
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
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
                          <div className="p-4" style={{ height: 520 }}>
                            <GanttChart
                              tasks={result.cpm.tasks}
                              totalDuration={result.cpm.totalDuration}
                              startDate={input.startDate || undefined}
                              viewMode={ganttView}
                            />
                          </div>
                        </div>
                      )}

                      {/* 자원 계획 */}
                      {subTab === 'resource' && (
                        <div className="p-4">
                          <ResourcePlanPanel
                            cpmTasks={result.cpm.tasks}
                            startDate={input.startDate || undefined}
                            standards={standards}
                          />
                        </div>
                      )}

                      {/* 회사 실적 표준 */}
                      {subTab === 'standards' && (
                        <div className="p-4">
                          <CompanyStandardsPanel
                            cpmTasks={result.cpm.tasks.map(t => ({
                              taskId: t.taskId,
                              name: t.name,
                              category: t.category,
                              duration: t.duration,
                              isCritical: t.isCritical,
                            }))}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <strong className="text-gray-600">몬테카를로·생산성 조정</strong>은 프로젝트로 저장 후 사용 가능합니다.
                  저장하면 이 계산 결과가 프로젝트 태스크로 고정되어 시뮬레이션·조정·비교가 가능해집니다.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, icon, hint }: { label: string; children: React.ReactNode; icon?: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-gray-500 flex items-center gap-1 mb-1">
        {icon}{label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function Kpi({
  icon, bg, label, value, unit, sub,
}: { icon: React.ReactNode; bg: string; label: string; value: string; unit: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <div className={`w-7 h-7 rounded-md ${bg} flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900">
        {value}<span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function TopTabBtn({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
        active
          ? 'border-blue-600 text-blue-700 bg-blue-50/40'
          : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
      }`}
    >
      {icon} {label}
    </button>
  )
}
