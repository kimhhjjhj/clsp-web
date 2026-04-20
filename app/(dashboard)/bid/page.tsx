'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ClipboardCheck, Building2, Ruler, Layers, Play, Save, TrendingUp,
  Calendar, Users, DollarSign, AlertTriangle, Loader2, ArrowRight,
  BarChart3, ChevronRight, Search, Drill, Check, FileText, Info,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { useToast } from '@/components/common/Toast'
import BenchmarkPanel from '@/components/common/BenchmarkPanel'
import AiCostEstimate, { type AiResult } from '@/components/bid/AiCostEstimate'
import AiScheduleEstimate, { type AiScheduleResult } from '@/components/bid/AiScheduleEstimate'
import {
  computeGuidelineSchedule, computeGuidelineSchedulePrecise, compareWithCpm,
  computeGuidelineRegression, guidelineBenchmark, type Region,
} from '@/lib/engine/guideline'
import { assessCriticalPath, CP_LEVEL_COLORS } from '@/lib/engine/cp-assessment'
import { computeBenchmark, BENCHMARK_COLORS, type BenchmarkResult, type BenchmarkSample } from '@/lib/engine/benchmark'
import { detectAbnormal } from '@/lib/engine/abnormal-detection'
import { compareTaskBenchmarks, deviantOnly, type TaskStat, type TaskBenchDeviation } from '@/lib/engine/task-benchmark'
import { useMultiplierStore } from '@/lib/hooks/useMultiplierStore'
import { useProjectContext } from '@/lib/project-context/ProjectContext'
import WBSTable, { type WBSTableHandle, type CompanyStandardSummary } from '@/components/wbs/WBSTable'
import { GanttChart, type GanttViewMode } from '@/components/gantt/GanttChart'
import ResourcePlanPanel from '@/components/analysis/ResourcePlanPanel'
import CompanyStandardsPanel from '@/components/analysis/CompanyStandardsPanel'
import MethodComparisonPanel from '@/components/bid/MethodComparisonPanel'
import SimilarProjectsPanel from '@/components/bid/SimilarProjectsPanel'
import AiScheduleCachedCard from '@/components/bid/AiScheduleCachedCard'
import type { AiScheduleEstimateData } from '@/lib/types/ai-schedule'
import { ValueExplainDialog, buildGuidelineExplain, buildRegressionExplain, buildBenchmarkExplain } from '@/components/bid/ValueExplainDialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CPMResult } from '@/lib/types'

type ConstructionMethod = 'bottom_up' | 'semi_top_down' | 'full_top_down' | 'up_up'

interface BidInput {
  name: string
  type: string
  location: string
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
  constructionMethod: ConstructionMethod
  prdCount: string
}

const CONSTRUCTION_METHODS: { value: ConstructionMethod; label: string; desc: string }[] = [
  { value: 'bottom_up',     label: 'Bottom-up (재래식)',   desc: '흙막이→터파기→기초→지하→지상 순차' },
  { value: 'semi_top_down', label: 'Semi Top-down (CWS)',  desc: '상부 Top-down + 하부 Bottom-up 폐합 (상봉동 기준)' },
  { value: 'full_top_down', label: 'Full Top-down',         desc: '지하 전체 위→아래로, 기초는 마지막' },
  { value: 'up_up',         label: 'Up-Up',                  desc: '기초 후 지하·지상 동시 상향' },
]

interface BoreholeResult {
  id: string
  distance_m: number
  lat: number
  lng: number
  depth: number | null
  addr: string
  wt: number | null
  wtr: number | null
  wt_display: string
  wtr_display: string
  layers: { soil_type: string; depth_from: number; depth_to: number }[]
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
}

type TopTab = 'cost' | 'schedule'
type SubTab = 'wbs' | 'summary' | 'critical' | 'method' | 'gantt' | 'resource' | 'standards'

const INITIAL: BidInput = {
  name: '', type: '공동주택', location: '',
  ground: '20', basement: '2', lowrise: '0', hasTransfer: false,
  bldgArea: '30000', buildingArea: '1500', siteArea: '6000',
  sitePerim: '300', bldgPerim: '220',
  wtBottom: '3', waBottom: '6',
  startDate: '',
  constructionMethod: 'bottom_up',
  prdCount: '',
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

export default function BidPageRoute() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">불러오는 중…</div>}>
      <BidPage />
    </Suspense>
  )
}

function BidPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = (searchParams?.get('tab') as TopTab) === 'schedule' ? 'schedule' : 'cost'
  const toast = useToast()
  const [input, setInput] = useState<BidInput>(INITIAL)
  const [result, setResult] = useState<EstimateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // AI 공사비 추정 결과 (저장 시 함께 전송)
  const [aiEstimate, setAiEstimate] = useState<unknown | null>(null)

  // AI 공기 추정 결과 (공기 탭용 — 저장은 localStorage만)
  const [aiSchedule, setAiSchedule] = useState<AiScheduleResult | null>(null)

  // 회사 과거 프로젝트 벤치마크 (CPM 결과 나오면 자동 로드)
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null)

  // 공종 단위 벤치마크 (과거 Task 집계)
  const [taskDeviations, setTaskDeviations] = useState<TaskBenchDeviation[]>([])

  // 기존 프로젝트 로드 지원 (?projectId=xxx) — 저장된 adjustments를 재편집
  const editingProjectId = searchParams?.get('projectId') ?? null
  const [loadedAdjustments, setLoadedAdjustments] = useState<Array<[string, number]> | null>(null)
  const [loadingProject, setLoadingProject] = useState(false)

  // 편집 모드 진입 시 ProjectContext에도 '현재 프로젝트'로 등록 (상단 Switcher가 반영)
  const { selectProject, currentProjectId } = useProjectContext()
  // 유사 프로젝트 필터링용 — URL projectId 없어도 선택된 프로젝트는 본인 제외
  const selfProjectId = editingProjectId ?? currentProjectId ?? undefined
  useEffect(() => {
    if (editingProjectId) selectProject(editingProjectId)
  }, [editingProjectId, selectProject])

  // 공종별 생산성 조정
  // - 신규 견적: key='bid-draft' (localStorage만)
  // - 기존 프로젝트 편집: key='project:{id}' + DB 시드 (최초 로드)
  const storeKey = editingProjectId ?? 'bid-draft'
  const { multipliers, setMult, resetAll: resetMults } = useMultiplierStore(storeKey, 'cp', loadedAdjustments)

  // 기존 프로젝트 로드 (최초 1회)
  useEffect(() => {
    if (!editingProjectId) return
    let cancelled = false
    setLoadingProject(true)
    fetch(`/api/projects/${editingProjectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(p => {
        if (cancelled || !p) return
        setInput({
          name: p.name ?? '',
          type: p.type ?? '공동주택',
          location: p.location ?? '',
          ground: String(p.ground ?? 0),
          basement: String(p.basement ?? 0),
          lowrise: String(p.lowrise ?? 0),
          hasTransfer: !!p.hasTransfer,
          bldgArea: p.bldgArea != null ? String(p.bldgArea) : '',
          buildingArea: p.buildingArea != null ? String(p.buildingArea) : '',
          siteArea: p.siteArea != null ? String(p.siteArea) : '',
          sitePerim: p.sitePerim != null ? String(p.sitePerim) : '',
          bldgPerim: p.bldgPerim != null ? String(p.bldgPerim) : '',
          wtBottom: p.wtBottom != null ? String(p.wtBottom) : '',
          waBottom: p.waBottom != null ? String(p.waBottom) : '',
          startDate: p.startDate ?? '',
          constructionMethod: (p.constructionMethod as ConstructionMethod) ?? 'bottom_up',
          prdCount: p.prdCount != null ? String(p.prdCount) : '',
        })
        if (Array.isArray(p.productivityAdjustments)) {
          const seed = p.productivityAdjustments
            .filter((a: unknown): a is { taskId: string; multiplier: number } =>
              typeof (a as any)?.taskId === 'string' && typeof (a as any)?.multiplier === 'number')
            .map((a: { taskId: string; multiplier: number }) => [a.taskId, a.multiplier] as [string, number])
          setLoadedAdjustments(seed)
        }
        // AI 공사비 추정도 복원 — 업데이트 시 덮어쓰지 않도록
        if (p.aiCostEstimate && typeof p.aiCostEstimate === 'object') {
          setAiEstimate(p.aiCostEstimate)
        }
        // AI 공기 추론 (관리자 큐레이션 값) 복원
        if (p.aiScheduleEstimate && typeof p.aiScheduleEstimate === 'object') {
          setAiSchedule(p.aiScheduleEstimate as unknown as AiScheduleResult)
        } else {
          setAiSchedule(null)
        }
        toast.success('프로젝트 로드됨', p.name ?? '')
      })
      .catch(() => toast.error('프로젝트 로드 실패'))
      .finally(() => { if (!cancelled) setLoadingProject(false) })
    return () => { cancelled = true }
  }, [editingProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!result) { setBenchmark(null); setTaskDeviations([]); return }
    let cancelled = false
    ;(async () => {
      try {
        const qs = input.type ? `?type=${encodeURIComponent(input.type)}` : ''
        const [projRes, taskRes] = await Promise.all([
          fetch('/api/projects'),
          fetch(`/api/benchmark/tasks${qs}`),
        ])
        if (projRes.ok) {
          const projects = await projRes.json() as Array<{
            name: string; type: string | null; ground: number | null;
            basement: number | null; lowrise: number | null; lastCpmDuration: number | null;
          }>
          const samples: BenchmarkSample[] = projects
            .filter(p => p.lastCpmDuration && p.lastCpmDuration > 0)
            .map(p => ({
              name: p.name, type: p.type,
              ground: p.ground, basement: p.basement, lowrise: p.lowrise,
              duration: p.lastCpmDuration!,
            }))
          const b = computeBenchmark(
            {
              type: input.type || null,
              ground: Number(input.ground) || 0,
              basement: Number(input.basement) || 0,
              lowrise: Number(input.lowrise) || 0,
              currentDuration: result.cpm.totalDuration,
            },
            samples,
          )
          if (!cancelled) setBenchmark(b)
        }
        if (taskRes.ok) {
          const { stats } = await taskRes.json() as { stats: TaskStat[] }
          const devs = compareTaskBenchmarks(
            result.cpm.tasks.map(t => ({ name: t.name, duration: t.duration })),
            stats,
          )
          if (!cancelled) setTaskDeviations(devs)
        }
      } catch {
        /* 네트워크 에러 무시 — 뱃지 숨김 */
      }
    })()
    return () => { cancelled = true }
  }, [result, input.type, input.ground, input.basement, input.lowrise])

  // 결과 뷰 탭
  const [topTab, setTopTab] = useState<TopTab>(initialTab)

  // URL 파라미터 변경 시 탭 동기화 (사이드바에서 공사비/공기 클릭했을 때)
  useEffect(() => {
    const t = searchParams?.get('tab')
    if (t === 'schedule' || t === 'cost') setTopTab(t)
  }, [searchParams])
  const [subTab, setSubTab] = useState<SubTab>('wbs')
  const [ganttView, setGanttView] = useState<GanttViewMode>('week')
  const [standards, setStandards] = useState<CompanyStandardSummary[]>([])
  const wbsTableRef = useRef<WBSTableHandle>(null)

  // 위치·지반 로드
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState('')
  const [boreholes, setBoreholes] = useState<BoreholeResult[]>([])
  const [loadingBH, setLoadingBH] = useState(false)
  const [bhError, setBhError] = useState('')

  async function handleGeocode() {
    if (!input.location.trim()) return
    setGeocoding(true)
    setGeocodeError('')
    setCoords(null)
    setBoreholes([])
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(input.location)}`)
      const data = await res.json()
      if (!res.ok) setGeocodeError(data.error ?? '주소 검색 실패')
      else setCoords({ lat: data.lat, lng: data.lng })
    } catch { setGeocodeError('네트워크 오류') }
    finally { setGeocoding(false) }
  }

  async function handleLoadBoreholes() {
    if (!coords) { setBhError('먼저 주소를 검색하세요'); return }
    setLoadingBH(true); setBhError('')
    try {
      const res = await fetch('/api/ground-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: coords.lat, lng: coords.lng }),
      })
      const data = await res.json()
      if (!res.ok) { setBhError(data.error ?? '시추공 검색 실패'); return }
      const list: BoreholeResult[] = data ?? []
      setBoreholes(list)
      if (list.length === 0) { setBhError('500m 반경 내 시추공 데이터가 없습니다'); return }
      // 평균 자동 적용
      const wtVals = list.map(b => b.wt).filter((v): v is number => v != null && v > 0)
      const waVals = list.map(b => b.wtr).filter((v): v is number => v != null && v > 0)
      if (wtVals.length) set('wtBottom', (wtVals.reduce((a, b) => a + b, 0) / wtVals.length).toFixed(1))
      if (waVals.length) set('waBottom', (waVals.reduce((a, b) => a + b, 0) / waVals.length).toFixed(1))
      toast.success(`${list.length}개 시추공 평균값 적용`, `풍화토·풍화암 자동 입력`)
    } catch { setBhError('네트워크 오류') }
    finally { setLoadingBH(false) }
  }

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

  const estimate = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const adjustments = Array.from(multipliers.entries()).map(([taskId, multiplier]) => ({ taskId, multiplier }))
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
          constructionMethod: input.constructionMethod,
          prdCount: Number(input.prdCount) || undefined,
          adjustments,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '계산 실패')
      setResult(data)
      if (!silent) toast.success('견적 산출 완료', `총공기 ${data.cpm.totalDuration}일 · 피크 ${data.resourcePlan.peak.count}명`)
    } catch (e: any) {
      if (!silent) toast.error('계산 실패', e.message)
    } finally { if (!silent) setLoading(false) }
  }, [input, toast, multipliers])

  // 조정값 변경 시 디바운스 재계산 (결과가 이미 있을 때만)
  const multKey = useMemo(() => {
    return Array.from(multipliers.entries()).map(([k, v]) => `${k}:${v}`).sort().join('|')
  }, [multipliers])
  useEffect(() => {
    if (!result) return
    const t = setTimeout(() => estimate(true), 400)
    return () => clearTimeout(t)
  }, [multKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveAsProject() {
    if (!result) return
    if (!input.name.trim()) { toast.warning('프로젝트명을 입력하세요'); return }
    setSaving(true)
    try {
      const isUpdate = !!editingProjectId
      const res = await fetch(isUpdate ? `/api/projects/${editingProjectId}` : '/api/projects', {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.name,
          type: input.type,
          location: input.location || null,
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
          constructionMethod: input.constructionMethod,
          prdCount: Number(input.prdCount) || null,
          aiCostEstimate: aiEstimate
            ? { ...aiEstimate, estimatedAt: new Date().toISOString() }
            : null,
          // 항상 배열로 전송 (빈 배열 = 명시적 초기화 → DB에서도 반영)
          productivityAdjustments: Array.from(multipliers.entries()).map(([taskId, multiplier]) => ({ taskId, multiplier })),
          // 조정 결과 총공기는 PUT/POST 모두 갱신 (UI와 DB 일치)
          lastCpmDuration: result?.cpm.totalDuration,
          // 신규 생성 시에만 CPM Task 시드 포함 (업데이트 시 기존 Task 보존)
          ...(!isUpdate && result ? {
            tasks: result.cpm.tasks.map(t => ({
              name: t.name,
              category: t.category,
              subcategory: t.subcategory ?? null,
              unit: t.unit ?? null,
              quantity: t.quantity ?? null,
              productivity: t.productivity ?? null,
              stdDays: t.stdDays ?? null,
              duration: t.duration,
              wbsCode: t.wbsCode ?? null,
            })),
          } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      // 신규 저장 시에만 bid-draft 정리 (PUT은 프로젝트 키 유지 → 이어 편집 가능)
      if (!isUpdate) {
        try {
          window.localStorage.removeItem('productivity:bid-draft:cp')
          window.localStorage.removeItem('ai-cost-estimate:bid-draft')
        } catch { /* ignore */ }
      }
      toast.success(isUpdate ? '프로젝트 업데이트됨' : '프로젝트로 저장됨', input.name)
      if (!isUpdate) router.push(`/projects/${data.id}`)
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

  const SUB_TABS: { id: SubTab; label: string; badge?: string }[] = [
    { id: 'method',    label: '공법 비교', badge: 'NEW' },
    { id: 'wbs',       label: 'WBS' },
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
        accent="violet"
      />

      <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto lg:overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:h-full">
          {/* 좌측: 입력 폼 — 독립 스크롤 */}
          <div className="lg:col-span-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <div className="space-y-3">
                {/* ── 섹션 1: 기본 정보 (프로젝트명 · 주소 · 착공일) ── */}
                <Section color="#2563eb" rgb="37, 99, 235" label="기본 정보" icon={<FileText size={14} />} hint="저장 전 반복 시뮬">
                  <Field label="프로젝트명" hint="저장할 때 사용 · 생략 가능">
                    <input value={input.name} onChange={e => set('name', e.target.value)} placeholder="예: 강남 ◯◯ 신축공사"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all" />
                  </Field>

                  <Field label="공사 주소" hint="검색 → 좌표 확보 → 지층 섹션에서 시추공 자동 로드">
                    <div className="flex gap-2">
                      <input
                        value={input.location}
                        onChange={e => set('location', e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleGeocode() } }}
                        placeholder="예: 서울시 강남구 역삼동 737"
                        className="flex-1 h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={handleGeocode}
                        disabled={geocoding || !input.location.trim()}
                        className="h-10 px-3 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0"
                      >
                        {geocoding ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                        검색
                      </button>
                    </div>
                  </Field>

                  {geocodeError && (
                    <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1.5">{geocodeError}</p>
                  )}
                  {coords && (
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-800">
                      <Check size={12} />
                      <span className="font-mono">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
                      <span className="ml-auto text-[10px] text-emerald-600">좌표 확보</span>
                    </div>
                  )}

                  <Field label="착공 예정일" hint="월별 인력 집계 활성 · 선택">
                    <input type="date" value={input.startDate} onChange={e => set('startDate', e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all" />
                  </Field>
                </Section>

                {/* ── 섹션 2: 건물 유형 · 규모 ── */}
                <Section color="#16a34a" rgb="22, 163, 74" label="건물 유형 · 규모" icon={<Layers size={14} />}>
                  <Field label="건물 유형" required>
                    <select value={input.type} onChange={e => set('type', e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all">
                      <option>공동주택</option>
                      <option>오피스텔</option>
                      <option>업무시설</option>
                      <option>데이터센터</option>
                      <option>스튜디오</option>
                      <option>기타</option>
                    </select>
                  </Field>

                  <div className="grid grid-cols-3 gap-2">
                    <Field label="지상" unit="층" required>
                      <NumInput value={input.ground} onChange={v => set('ground', v)} />
                    </Field>
                    <Field label="지하" unit="층">
                      <NumInput value={input.basement} onChange={v => set('basement', v)} />
                    </Field>
                    <Field label="저층부" unit="층">
                      <NumInput value={input.lowrise} onChange={v => set('lowrise', v)} />
                    </Field>
                  </div>

                  <label className={`flex items-center gap-2 px-3 h-10 rounded-lg border cursor-pointer transition-colors ${
                    input.hasTransfer
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}>
                    <input type="checkbox" checked={input.hasTransfer}
                      onChange={e => setInput(p => ({ ...p, hasTransfer: e.target.checked }))}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-400" />
                    <span className="text-xs font-medium">전이층(Transfer Slab) 포함</span>
                  </label>

                  {/* 면적 3칸 한 줄 */}
                  <div className="pt-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Ruler size={11} /> 면적
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="대지면적" unit="㎡">
                        <NumInput value={input.siteArea} onChange={v => set('siteArea', v)} />
                      </Field>
                      <Field label="건축면적" unit="㎡" required>
                        <NumInput value={input.buildingArea} onChange={v => set('buildingArea', v)} />
                      </Field>
                      <Field label="연면적" unit="㎡" required>
                        <NumInput value={input.bldgArea} onChange={v => set('bldgArea', v)} />
                      </Field>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">건축=1층 footprint · 연=전층 합</p>
                  </div>

                  {/* 둘레 2칸 한 줄 */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">둘레</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="대지둘레" unit="m">
                        <NumInput value={input.sitePerim} onChange={v => set('sitePerim', v)} />
                      </Field>
                      <Field label="건물둘레" unit="m">
                        <NumInput value={input.bldgPerim} onChange={v => set('bldgPerim', v)} />
                      </Field>
                    </div>
                  </div>
                </Section>

                {/* ── 섹션 3: 공법 시퀀스 ── */}
                <Section color="#7c3aed" rgb="139, 92, 246" label="공법 시퀀스" icon={<Layers size={14} />}>
                  <Field label="기초 구조 공법" hint="선택한 공법에 따라 WBS 공종 세트와 선후행이 자동 전환됩니다">
                    <select
                      value={input.constructionMethod}
                      onChange={e => set('constructionMethod', e.target.value as ConstructionMethod)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white"
                    >
                      {CONSTRUCTION_METHODS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </Field>
                  <p className="text-[10px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                    {CONSTRUCTION_METHODS.find(m => m.value === input.constructionMethod)?.desc}
                  </p>
                  {(input.constructionMethod === 'semi_top_down' || input.constructionMethod === 'full_top_down') && (
                    <Field label="PRD 앵커 공수" unit="공" hint="CIP 이후 천공 앵커 수. 1~1.5공/일 + 장비조립/해체 각 5일">
                      <NumInput value={input.prdCount} onChange={v => set('prdCount', v)} />
                    </Field>
                  )}
                </Section>

                {/* ── 섹션 4: 지층 정보 ── */}
                <Section color="#d97706" rgb="217, 119, 6" label="지층 정보" icon={<Drill size={14} />}>
                  <button
                    type="button"
                    onClick={handleLoadBoreholes}
                    disabled={!coords || loadingBH}
                    className={`w-full h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      coords
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    } disabled:opacity-60`}
                  >
                    {loadingBH ? <Loader2 size={13} className="animate-spin" /> : <Drill size={13} />}
                    {coords ? '근처 시추공 자동 로드 (500m)' : '주소 검색 후 활성화됩니다'}
                  </button>

                  {bhError && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">{bhError}</p>}
                  {boreholes.length > 0 && (
                    <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded px-2.5 py-2">
                      <div className="flex items-center gap-1.5">
                        <Check size={11} className="text-amber-600" />
                        <strong>{boreholes.length}개 시추공 평균값 적용됨</strong>
                      </div>
                      <p className="text-[10px] text-amber-700 mt-0.5">아래 입력란 자동 채움 · 수동으로 덮어쓸 수 있음</p>
                    </div>
                  )}

                  {Number(input.basement) > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="풍화토 바닥" unit="m">
                        <NumInput value={input.wtBottom} onChange={v => set('wtBottom', v)} step="0.1" />
                      </Field>
                      <Field label="풍화암 바닥" unit="m">
                        <NumInput value={input.waBottom} onChange={v => set('waBottom', v)} step="0.1" />
                      </Field>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400">지하 층수 1 이상일 때 풍화토·풍화암 입력칸이 표시됩니다.</p>
                  )}
                </Section>

              {/* 액션 버튼 — 별도 카드 */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                <button
                  onClick={() => estimate()}
                  disabled={loading}
                  className="u-btn u-btn-primary u-btn-lg w-full"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={13} />}
                  {loading ? '계산 중...' : '개략 견적 산출'}
                </button>

                {result && (
                  <button
                    onClick={saveAsProject}
                    disabled={saving}
                    className="u-btn u-btn-secondary w-full"
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {editingProjectId ? '프로젝트 업데이트' : '프로젝트로 저장'}
                  </button>
                )}
                {editingProjectId && (
                  <div className="text-[10px] text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1 text-center">
                    {loadingProject ? '프로젝트 불러오는 중...' : '기존 프로젝트 편집 중'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 우측: 결과 — 독립 스크롤 */}
          <div className="lg:col-span-2 lg:min-h-0 lg:overflow-y-auto lg:pr-1 space-y-5">
            {!result ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <ClipboardCheck size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">좌측 정보 입력 후 <strong>개략 견적 산출</strong>을 누르세요</p>
                <p className="text-[11px] text-gray-400 mt-1">데이터는 저장되지 않고, 저장 버튼을 누를 때만 프로젝트가 생성됩니다</p>
              </div>
            ) : (
              <>
                {/* 최상단 대탭: 공사비 / 공기 */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex border-b border-gray-200">
                    <TopTabBtn
                      icon={<DollarSign size={14} />}
                      label="공사비"
                      active={topTab === 'cost'}
                      onClick={() => { setTopTab('cost'); router.replace('/bid?tab=cost', { scroll: false }) }}
                    />
                    <TopTabBtn
                      icon={<BarChart3 size={14} />}
                      label="공기"
                      active={topTab === 'schedule'}
                      onClick={() => { setTopTab('schedule'); router.replace('/bid?tab=schedule', { scroll: false }) }}
                    />
                  </div>

                  {topTab === 'cost' && (
                    <div className="p-5">
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
                        storageKey={storeKey}
                        initialResult={aiEstimate as AiResult | null}
                        onResult={setAiEstimate}
                      />
                    </div>
                  )}

                  {topTab === 'schedule' && (
                    <div>
                      {/* 🎯 공기 요약 — CPM 기반 실제 산정값 (메인 수치) */}
                      <div className="p-5 border-b border-gray-100">
                        <div
                          className="rounded-xl p-5 text-white"
                          style={{
                            background: 'linear-gradient(135deg, #2563eb 0%, #0891b2 100%)',
                            boxShadow: '0 10px 30px -12px rgba(37, 99, 235, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <Calendar size={16} className="opacity-90" />
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-90">
                              공기 요약 · Schedule Estimate
                            </h3>
                          </div>
                          <div className="flex items-end justify-between flex-wrap gap-5">
                            <div>
                              <p className="text-3xl sm:text-4xl font-bold font-mono leading-none tabular-nums">
                                {Math.round(result.cpm.totalDuration / 30)}
                                <span className="text-base font-normal opacity-70 ml-1.5">개월</span>
                                <span className="text-sm font-normal opacity-60 ml-2">
                                  ({result.cpm.totalDuration.toLocaleString()}일)
                                </span>
                              </p>
                              <p className="text-[11px] opacity-80 mt-2">
                                {input.startDate && completionDate() && (
                                  <>
                                    착공 {input.startDate}
                                    <span className="mx-1 opacity-60">→</span>
                                    준공 <span className="font-semibold">{completionDate()}</span>
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-5">
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-70">총 공종</p>
                                <p className="text-2xl font-bold font-mono mt-1 tabular-nums leading-none">
                                  {result.cpm.taskCount}
                                  <span className="text-[11px] font-normal opacity-70 ml-0.5">개</span>
                                </p>
                              </div>
                              <div className="w-px h-10 bg-white/20" />
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-70">크리티컬 패스</p>
                                <p className="text-2xl font-bold font-mono mt-1 tabular-nums leading-none">
                                  {result.cpm.criticalPathCount}
                                  <span className="text-[11px] font-normal opacity-70 ml-0.5">
                                    개 · {Math.round((result.cpm.criticalPathCount / Math.max(1, result.cpm.taskCount)) * 100)}%
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 공기 서브탭 */}
                      <div className="flex items-center gap-1 px-4 pt-3 border-b border-gray-200 bg-gray-50 overflow-x-auto">
                        {SUB_TABS.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSubTab(t.id)}
                            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
                              subTab === t.id
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-800'
                            }`}
                          >
                            {t.label}
                            {t.badge && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-600 text-white leading-none">
                                {t.badge}
                              </span>
                            )}
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
                                  {Math.round(result.cpm.totalDuration / 30)}
                                  <span className="text-sm font-normal text-gray-400 ml-1">개월</span>
                                  <span className="text-xs font-normal text-gray-400 ml-1.5">
                                    ({result.cpm.totalDuration.toLocaleString()}일)
                                  </span>
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {completionDate() ? `준공 예정 ${completionDate()}` : ''}
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

                      {/* 공법 비교 — Top-down vs Bottom-up */}
                      {subTab === 'method' && (
                        <MethodComparisonPanel input={{
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
                          prdCount: Number(input.prdCount) || undefined,
                        }} />
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

                      {/* 🎯 AI 공기 추론 (관리자 큐레이션) — DB 캐시 값 표시. 런타임 API 호출 0건 */}
                      <div className="p-5 border-t border-gray-100">
                        <AiScheduleCachedCard
                          projectId={editingProjectId}
                          estimate={aiSchedule as unknown as AiScheduleEstimateData | null}
                          currentCpmDuration={result?.cpm.totalDuration}
                          startDate={input.startDate}
                          ground={Number(input.ground) || undefined}
                          bldgArea={Number(input.bldgArea) || undefined}
                          type={input.type}
                          cpmTasks={result?.cpm.tasks}
                        />
                      </div>

                      {/* 국토부 2026 적정 공사기간 가이드라인 참고값 */}
                      {(() => {
                        const baseInput = {
                          type: input.type,
                          ground: Number(input.ground) || 0,
                          basement: Number(input.basement) || 0,
                          lowrise: Number(input.lowrise) || 0,
                          hasTransfer: input.hasTransfer,
                          bldgArea: Number(input.bldgArea) || undefined,
                        }
                        // 착공일 있으면 정밀 모드
                        const gl = input.startDate
                          ? computeGuidelineSchedulePrecise({ ...baseInput, startDate: input.startDate, region: '서울' as Region })
                          : computeGuidelineSchedule(baseInput)
                        const cmp = compareWithCpm(result.cpm.totalDuration, gl.total)
                        const reg = computeGuidelineRegression(input.type || '공동주택', baseInput.bldgArea)
                        const bench = guidelineBenchmark(baseInput.ground)
                        // 참고 지표 편차 검증 — CPM 대비 ±20% 초과 시 경고
                        const regDevPct = reg.days != null && reg.days > 0
                          ? Math.round(((result.cpm.totalDuration - reg.days) / reg.days) * 100)
                          : null
                        const regAlert = regDevPct != null && Math.abs(regDevPct) > 20
                        const benchInBand = result.cpm.totalDuration >= bench.typicalDays[0]
                          && result.cpm.totalDuration <= bench.typicalDays[1]
                        const benchAlert = !benchInBand
                        return (
                          <div className="mx-5 mb-5 relative overflow-hidden rounded-xl bg-white" style={{
                            border: `1px solid ${cmp.color}33`,
                            boxShadow: `0 1px 2px rgba(15,23,42,0.04), 0 4px 14px -8px ${cmp.color}40`,
                          }}>
                            <span aria-hidden className="absolute inset-x-0 top-0 h-10 pointer-events-none"
                              style={{ background: `linear-gradient(180deg, ${cmp.color}0F, transparent)` }} />
                            <div className="relative px-4 py-3">
                              {/* ── 헤더 바 ─────────────────────────── */}
                              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: cmp.color }}>
                                  국토부 2026 가이드라인 참고
                                </span>
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {gl.mode === 'precise' ? '정밀' : '간이'}
                                </span>
                                <span className="text-[10px] text-slate-400 ml-auto">부록 1·2·3·5</span>
                              </div>

                              {/* ── 메인 비교 — 가이드라인 vs CPM ──────── */}
                              <div className="flex items-baseline flex-wrap gap-x-4 gap-y-1">
                                <ValueExplainDialog
                                  data={buildGuidelineExplain({
                                    totalDays: gl.total,
                                    prep: gl.preparationDays,
                                    cp: gl.criticalWorkDays,
                                    nonWork: gl.nonWorkDays,
                                    cleanup: gl.cleanupDays,
                                    mode: gl.mode,
                                    monthlyNonWorkRows: gl.monthlyNonWork,
                                  })}
                                  triggerClassName="inline-flex items-baseline gap-1 hover:underline decoration-dotted underline-offset-4"
                                >
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">가이드라인</span>
                                  <span className="font-bold font-mono tabular-nums text-lg" style={{ color: cmp.color }}>
                                    {Math.round(gl.total / 30)}개월
                                  </span>
                                  <span className="font-mono tabular-nums text-xs" style={{ color: cmp.color, opacity: 0.7 }}>
                                    ({gl.total.toLocaleString()}일)
                                  </span>
                                  <Info size={11} style={{ color: cmp.color, opacity: 0.5 }} />
                                </ValueExplainDialog>

                                <span className="text-slate-300 text-xs select-none">vs</span>

                                <div className="inline-flex items-baseline gap-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">CPM</span>
                                  <span className="font-bold font-mono tabular-nums text-lg text-slate-900">
                                    {Math.round(result.cpm.totalDuration / 30)}개월
                                  </span>
                                  <span className="font-mono tabular-nums text-xs text-slate-500">
                                    ({result.cpm.totalDuration.toLocaleString()}일)
                                  </span>
                                </div>

                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                  style={{ background: `${cmp.color}18`, color: cmp.color }}
                                >
                                  {cmp.label}
                                </span>
                              </div>

                              {/* ── 구성 내역 ──────────────────────────── */}
                              <p className="text-[11px] text-slate-400 mt-2 font-mono tabular-nums">
                                준비 {gl.preparationDays} + CP {gl.criticalWorkDays} + 비작업 {gl.nonWorkDays} + 정리 {gl.cleanupDays}
                              </p>

                              {/* ── 보조 지표 칩 (편차 20% 초과 시 amber 경고) ─── */}
                              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mr-0.5">
                                  참고 지표
                                </span>
                                {reg.days != null && (
                                  <ValueExplainDialog
                                    data={buildRegressionExplain({
                                      days: reg.days,
                                      formula: reg.formula ?? '',
                                      facility: input.type || '공동주택',
                                      variable: '연면적',
                                      variableValue: Number(input.bldgArea) || 0,
                                      inRange: reg.inRange,
                                    })}
                                    triggerClassName={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                                      regAlert
                                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    {regAlert && <AlertTriangle size={11} className="text-amber-600" />}
                                    <span>회귀식</span>
                                    <span className="font-mono tabular-nums font-semibold">
                                      {Math.round(reg.days / 30)}개월 ({reg.days}일)
                                    </span>
                                    {regDevPct != null && (
                                      <span className={`text-[10px] font-mono tabular-nums font-bold ${regAlert ? 'text-amber-700' : 'text-slate-500'}`}>
                                        CPM {regDevPct >= 0 ? '+' : ''}{regDevPct}%
                                      </span>
                                    )}
                                    {!reg.inRange && (
                                      <span className="text-[9px] text-amber-700 font-bold uppercase">범위외</span>
                                    )}
                                    <Info size={10} className={regAlert ? 'text-amber-500' : 'text-slate-400'} />
                                  </ValueExplainDialog>
                                )}
                                <ValueExplainDialog
                                  data={buildBenchmarkExplain({
                                    floorRange: bench.floorRange,
                                    typicalDaysMin: bench.typicalDays[0],
                                    typicalDaysMax: bench.typicalDays[1],
                                    ground: baseInput.ground,
                                  })}
                                  triggerClassName={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                                    benchAlert
                                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {benchAlert && <AlertTriangle size={11} className="text-amber-600" />}
                                  <span>권장밴드 {bench.floorRange}</span>
                                  <span className="font-mono tabular-nums font-semibold">
                                    {Math.round(bench.typicalDays[0] / 30)}~{Math.round(bench.typicalDays[1] / 30)}개월
                                  </span>
                                  <span className={`text-[10px] font-bold ${benchAlert ? 'text-amber-700' : 'text-emerald-700'}`}>
                                    {benchInBand ? '밴드 내' : result.cpm.totalDuration < bench.typicalDays[0] ? '밴드 아래' : '밴드 위'}
                                  </span>
                                  <Info size={10} className={benchAlert ? 'text-amber-500' : 'text-slate-400'} />
                                </ValueExplainDialog>
                                {(regAlert || benchAlert) && (
                                  <span className="text-[10px] text-amber-700 font-semibold ml-1">
                                    ⚠️ 편차 크니 재검토 권장
                                  </span>
                                )}
                              </div>

                              <details className="mt-3 pt-2 border-t border-slate-100">
                                <summary className="text-[11px] text-slate-500 hover:text-slate-900 cursor-pointer">산정 내역·월별 비작업일 ▾</summary>
                                <div className="mt-2 text-[11px] text-slate-600 leading-relaxed space-y-2 pl-3 border-l-2 border-slate-200">
                                  <div>
                                    <p className="font-bold text-slate-700 mb-1">CP 공종별 일수</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                                      {gl.phases.map(ph => (
                                        <div key={ph.name} className="font-mono">
                                          <span className="text-slate-400">{ph.name}</span> <span className="font-bold text-slate-800">{ph.days}일</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  {gl.monthlyNonWork && gl.monthlyNonWork.length > 0 && (
                                    <div>
                                      <p className="font-bold text-slate-700 mb-1">월별 비작업일 (정밀 모드 · 서울 철콘 기준)</p>
                                      <div className="overflow-x-auto">
                                        <table className="text-[10px] font-mono w-full">
                                          <thead className="bg-slate-50">
                                            <tr>
                                              <th className="text-left px-1.5 py-0.5">월</th>
                                              <th className="text-right px-1.5 py-0.5">법정</th>
                                              <th className="text-right px-1.5 py-0.5">기상</th>
                                              <th className="text-right px-1.5 py-0.5">중복</th>
                                              <th className="text-right px-1.5 py-0.5">적용</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {gl.monthlyNonWork.map(m => (
                                              <tr key={m.ym} className="border-t border-slate-100">
                                                <td className="px-1.5 py-0.5 text-slate-600">{m.ym}</td>
                                                <td className="px-1.5 py-0.5 text-right">{m.legal}</td>
                                                <td className="px-1.5 py-0.5 text-right">{m.climate}</td>
                                                <td className="px-1.5 py-0.5 text-right text-slate-400">-{m.overlap}</td>
                                                <td className="px-1.5 py-0.5 text-right font-bold text-slate-900">{m.applied}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                  <ul className="list-disc ml-4 text-slate-500">
                                    {gl.notes.map((n, i) => <li key={i}>{n}</li>)}
                                  </ul>
                                </div>
                              </details>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 📊 유사 프로젝트 기반 추천 — 데이터 기반 보조 참조 */}
                      <div className="p-5 border-t border-gray-100">
                        <SimilarProjectsPanel
                          input={{
                            type: input.type || undefined,
                            ground: Number(input.ground) || undefined,
                            basement: Number(input.basement) || undefined,
                            lowrise: Number(input.lowrise) || undefined,
                            bldgArea: Number(input.bldgArea) || undefined,
                            buildingArea: Number(input.buildingArea) || undefined,
                            siteArea: Number(input.siteArea) || undefined,
                            hasTransfer: input.hasTransfer,
                            constructionMethod: input.constructionMethod,
                            wtBottom: Number(input.wtBottom) || undefined,
                            waBottom: Number(input.waBottom) || undefined,
                            location: input.location || undefined,
                            excludeProjectId: selfProjectId,
                          }}
                          currentCpmDuration={result?.cpm.totalDuration}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 유사 프로젝트 벤치마크 — 참고용, 맨 아래 배치 */}
                <BenchmarkPanel
                  query={{
                    type: input.type,
                    ground: Number(input.ground) || undefined,
                    basement: Number(input.basement) || undefined,
                    bldgArea: Number(input.bldgArea) || undefined,
                  }}
                  limit={5}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({
  color, rgb, label, icon, hint, children,
}: {
  color: string
  /** rgba 합성용 'R, G, B' — 없으면 tint 못 만듦 */
  rgb?: string
  label: string
  icon?: React.ReactNode
  hint?: string
  children: React.ReactNode
}) {
  const tintRgb = rgb ?? '148, 163, 184'
  return (
    <div
      className="relative bg-white rounded-xl overflow-hidden"
      style={{
        border: '1px solid rgba(15, 23, 42, 0.06)',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
      }}
    >
      {/* 상단 얕은 컬러 워시 — 섹션별 포인트 */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-16 pointer-events-none"
        style={{ background: `linear-gradient(180deg, rgba(${tintRgb}, 0.05) 0%, transparent 100%)` }}
      />
      <div className="relative px-5 pt-4 pb-3 flex items-center gap-2.5">
        <span
          className="flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0"
          style={{
            background: `rgba(${tintRgb}, 0.13)`,
            color,
            border: `1px solid rgba(${tintRgb}, 0.2)`,
          }}
        >
          {icon ?? <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
        </span>
        <h4 className="text-[14px] font-bold text-slate-900 tracking-[-0.01em]">{label}</h4>
        {hint && <span className="ml-auto text-[10px] text-slate-400">{hint}</span>}
      </div>
      <div className="relative px-5 pb-5 space-y-3">
        {children}
      </div>
    </div>
  )
}

function Field({
  label, children, unit, hint, required, className,
}: {
  label: string
  children: React.ReactNode
  unit?: string
  hint?: string
  required?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[12px] font-semibold text-slate-800 flex items-center gap-1">
          {label}
          {required && <span className="text-blue-500">*</span>}
        </label>
        {unit && <span className="text-[10px] text-slate-400 font-mono">{unit}</span>}
      </div>
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-1 leading-tight">{hint}</p>}
    </div>
  )
}

function NumInput({
  value, onChange, step,
}: {
  value: string
  onChange: (v: string) => void
  step?: string
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={e => e.target.select()}
      step={step}
      className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono text-right tabular-nums placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
    />
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
