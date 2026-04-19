'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ClipboardCheck, Building2, Ruler, Layers, Play, Save, TrendingUp,
  Calendar, Users, DollarSign, AlertTriangle, Loader2, ArrowRight,
  BarChart3, ChevronRight, Search, Drill, Check,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { useToast } from '@/components/common/Toast'
import BenchmarkPanel from '@/components/common/BenchmarkPanel'
import AiCostEstimate from '@/components/bid/AiCostEstimate'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CPMResult } from '@/lib/types'

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
}

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
type SubTab = 'wbs' | 'summary' | 'critical' | 'gantt' | 'resource' | 'standards'

const INITIAL: BidInput = {
  name: '', type: '공동주택', location: '',
  ground: '20', basement: '2', lowrise: '0', hasTransfer: false,
  bldgArea: '30000', buildingArea: '1500', siteArea: '6000',
  sitePerim: '300', bldgPerim: '220',
  wtBottom: '3', waBottom: '6',
  startDate: '',
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
  const searchParams = useSearchParams()
  const initialTab = (searchParams?.get('tab') as TopTab) === 'schedule' ? 'schedule' : 'cost'
  const toast = useToast()
  const [input, setInput] = useState<BidInput>(INITIAL)
  const [result, setResult] = useState<EstimateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // AI 공사비 추정 결과 (저장 시 함께 전송)
  const [aiEstimate, setAiEstimate] = useState<unknown | null>(null)

  // 회사 과거 프로젝트 벤치마크 (CPM 결과 나오면 자동 로드)
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null)

  // 공종 단위 벤치마크 (과거 Task 집계)
  const [taskDeviations, setTaskDeviations] = useState<TaskBenchDeviation[]>([])

  // 기존 프로젝트 로드 지원 (?projectId=xxx) — 저장된 adjustments를 재편집
  const editingProjectId = searchParams?.get('projectId') ?? null
  const [loadedAdjustments, setLoadedAdjustments] = useState<Array<[string, number]> | null>(null)
  const [loadingProject, setLoadingProject] = useState(false)

  // 편집 모드 진입 시 ProjectContext에도 '현재 프로젝트'로 등록 (상단 Switcher가 반영)
  const { selectProject } = useProjectContext()
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
        try { window.localStorage.removeItem('productivity:bid-draft:cp') } catch { /* ignore */ }
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
        accent="violet"
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 좌측: 입력 폼 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden lg:sticky lg:top-4">
              {/* 폼 헤더 */}
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center gap-2">
                <Building2 size={15} className="text-gray-600" />
                <h3 className="text-sm font-bold text-gray-900">입력 정보</h3>
                <span className="ml-auto text-[10px] text-gray-400">저장 전 반복 시뮬</span>
              </div>

              <div className="divide-y divide-gray-100">
                {/* ── 섹션 1: 기본 정보 (프로젝트명 · 주소 · 착공일) ── */}
                <Section color="#2563eb" label="기본 정보">
                  <Field label="프로젝트명" hint="저장할 때 사용 · 생략 가능">
                    <input value={input.name} onChange={e => set('name', e.target.value)} placeholder="예: 강남 ◯◯ 신축공사"
                      className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                  </Field>

                  <Field label="공사 주소" hint="검색 → 좌표 확보 → 지층 섹션에서 시추공 자동 로드">
                    <div className="flex gap-2">
                      <input
                        value={input.location}
                        onChange={e => set('location', e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleGeocode() } }}
                        placeholder="예: 서울시 강남구 역삼동 737"
                        className="flex-1 h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                      className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                  </Field>
                </Section>

                {/* ── 섹션 2: 건물 유형 · 규모 ── */}
                <Section color="#16a34a" label="건물 유형 · 규모" icon={<Layers size={12} />}>
                  <Field label="건물 유형" required>
                    <select value={input.type} onChange={e => set('type', e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
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

                {/* ── 섹션 3: 지층 정보 ── */}
                <Section color="#a16207" label="지층 정보" icon={<Drill size={12} />}>
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
              </div>

              {/* 액션 버튼 — 하단 고정 영역 */}
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 space-y-2">
                <button
                  onClick={() => estimate()}
                  disabled={loading}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={14} />}
                  {loading ? '계산 중...' : '개략 견적 산출'}
                </button>

                {result && (
                  <button
                    onClick={saveAsProject}
                    disabled={saving}
                    className="w-full h-10 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
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
                        onResult={setAiEstimate}
                      />

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
                        {(() => {
                          const cp = assessCriticalPath(result.cpm.tasks, result.cpm.totalDuration)
                          const color = CP_LEVEL_COLORS[cp.level]
                          const pct = Math.round(cp.ratio * 100)
                          return (
                            <div className="mb-3">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${color.bg} ${color.text}`}>
                                  <span className={`w-1 h-1 rounded-full ${color.dot}`} />
                                  CP 집중도 · {cp.label}
                                </span>
                                <span className="text-xs text-gray-600">
                                  <strong className="font-mono" style={{ color: color.hex }}>{pct}%</strong>
                                  <span className="text-gray-400 mx-1">·</span>
                                  <span className="text-gray-500">{cp.cpDays}일 / {cp.totalDuration}일</span>
                                </span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, background: color.hex }}
                                />
                              </div>
                              <p className="text-[11px] text-gray-500 mt-1.5">{cp.reason}</p>
                            </div>
                          )
                        })()}
                        <p className="text-xs text-gray-600 mb-2">
                          전체 {result.cpm.taskCount}개 공종 중 <strong className="text-orange-600">{result.cpm.criticalPathCount}개</strong>가 Critical Path.
                          <button onClick={() => { setTopTab('schedule'); setSubTab('critical'); router.replace('/bid?tab=schedule', { scroll: false }) }} className="ml-2 text-[11px] text-blue-600 hover:underline">상세 →</button>
                        </p>
                        {result.resourcePlan.uncoveredTasks.length > 0 && (
                          <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 rounded p-2">
                            <strong>회사 실적 없는 공종:</strong> {result.resourcePlan.uncoveredTasks.join(', ')}
                            <br />
                            <span className="text-amber-600">인원 추정에서 제외됨. 일보 임포트로 데이터 확보 권장.</span>
                          </div>
                        )}
                      </div>

                      {/* 회사 과거 프로젝트 벤치마크 비교 */}
                      {benchmark && (
                        <div className="border-t border-gray-100 pt-5">
                          <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                            <BarChart3 size={14} className="text-orange-500" /> 회사 실적 벤치마크
                          </h3>
                          {(() => {
                            const color = BENCHMARK_COLORS[benchmark.level]
                            return (
                              <div className={`rounded-lg border ${color.border} ${color.bg} p-3`}>
                                <div className={`text-xs font-bold ${color.text} mb-1`}>
                                  {benchmark.label}
                                </div>
                                <div className="text-[11px] text-gray-600 leading-relaxed">
                                  {benchmark.detail}
                                </div>
                                {benchmark.samples.length > 0 && benchmark.level !== 'insufficient' && (
                                  <details className="mt-2">
                                    <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-700">
                                      비교 표본 {benchmark.sampleCount}개 ▾
                                    </summary>
                                    <ul className="mt-1.5 space-y-0.5 text-[10px] text-gray-600 font-mono">
                                      {benchmark.samples.map((s, i) => (
                                        <li key={i} className="flex justify-between">
                                          <span className="truncate max-w-[140px]">{s.name}</span>
                                          <span className="text-gray-400">
                                            {s.totalFloors}층 · {s.duration}일 · <strong>{s.daysPerFloor}일/층</strong>
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      {/* 공종 단위 벤치마크 편차 — 과거 프로젝트 Task 대비 */}
                      {taskDeviations.length > 0 && deviantOnly(taskDeviations).length > 0 && (() => {
                        const taskIdByName = new Map(result.cpm.tasks.map(t => [t.name, t.taskId]))
                        return (
                        <div className="border-t border-gray-100 pt-5">
                          <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                            <TrendingUp size={14} className="text-indigo-500" /> 공종별 벤치마크 편차
                            {multipliers.size > 0 && (
                              <button onClick={resetMults} className="ml-auto text-[10px] text-gray-500 hover:text-gray-900 font-normal">조정 초기화</button>
                            )}
                          </h3>
                          <ul className="space-y-1.5">
                            {deviantOnly(taskDeviations).slice(0, 5).map(d => {
                              const isLong = d.level === 'long'
                              const color = isLong
                                ? 'border-red-200 bg-red-50 text-red-900'
                                : 'border-sky-200 bg-sky-50 text-sky-900'
                              const sign = d.deviationPercent >= 0 ? '+' : ''
                              const tid = taskIdByName.get(d.name)
                              const currentMult = tid ? (multipliers.get(tid) ?? 1.0) : 1.0
                              return (
                                <li key={d.name} className={`rounded-lg border ${color} p-2`}>
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-xs font-semibold truncate">{d.name}</span>
                                    <span className="font-mono text-[11px] whitespace-nowrap">
                                      {d.current}일 <span className="opacity-60">vs</span> 평균 {d.avg}일
                                      <span className="ml-1 font-bold">({sign}{d.deviationPercent.toFixed(0)}%)</span>
                                    </span>
                                  </div>
                                  <p className="text-[10px] opacity-70 mt-0.5">
                                    과거 {d.projects}개 프로젝트 범위 {d.min}~{d.max}일
                                  </p>
                                  {tid && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {[0.75, 1.0, 1.25, 1.5, 2.0].map(m => (
                                        <button
                                          key={m}
                                          onClick={() => setMult(tid, m)}
                                          className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                                            Math.abs(currentMult - m) < 0.001
                                              ? 'bg-gray-900 text-white border-gray-900'
                                              : 'bg-white border-gray-300 text-gray-700 hover:border-gray-500'
                                          }`}
                                        >{m}×</button>
                                      ))}
                                    </div>
                                  )}
                                </li>
                              )
                            })}
                            {deviantOnly(taskDeviations).length > 5 && (
                              <li className="text-[10px] text-gray-500 text-center">
                                +{deviantOnly(taskDeviations).length - 5}개 더
                              </li>
                            )}
                          </ul>
                        </div>
                        )
                      })()}

                      {/* 비정상 공종 요약 — z-score + dominance */}
                      {(() => {
                        const abnormals = detectAbnormal(
                          result.cpm.tasks.map(t => ({ name: t.name, category: t.category, duration: t.duration })),
                          result.cpm.totalDuration,
                        )
                        if (abnormals.length === 0) return null
                        const taskIdByName = new Map(result.cpm.tasks.map(t => [t.name, t.taskId]))
                        return (
                          <div className="border-t border-gray-100 pt-5">
                            <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                              <AlertTriangle size={14} className="text-amber-500" /> 비정상 공종 {abnormals.length}개
                            </h3>
                            <ul className="space-y-1.5">
                              {abnormals.slice(0, 5).map(a => {
                                const tid = taskIdByName.get(a.name)
                                const currentMult = tid ? (multipliers.get(tid) ?? 1.0) : 1.0
                                return (
                                <li key={a.name} className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-xs font-semibold text-amber-900 truncate">{a.name}</span>
                                    <span className="font-mono text-[11px] text-amber-700 whitespace-nowrap">
                                      {a.duration}일 · {Math.round(a.shareOfTotal * 100)}%
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-amber-700 mt-0.5">{a.message}</p>
                                  {tid && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {[0.75, 1.0, 1.25, 1.5, 2.0].map(m => (
                                        <button
                                          key={m}
                                          onClick={() => setMult(tid, m)}
                                          className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                                            Math.abs(currentMult - m) < 0.001
                                              ? 'bg-gray-900 text-white border-gray-900'
                                              : 'bg-white border-amber-300 text-amber-800 hover:border-amber-500'
                                          }`}
                                        >{m}×</button>
                                      ))}
                                    </div>
                                  )}
                                </li>
                              )})}
                              {abnormals.length > 5 && (
                                <li className="text-[10px] text-gray-500 text-center">
                                  +{abnormals.length - 5}개 더 (WBS 표에서 ⚠️ 아이콘 확인)
                                </li>
                              )}
                            </ul>
                          </div>
                        )
                      })()}

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

function Section({
  color, label, icon, hint, children,
}: {
  color: string
  label: string
  icon?: React.ReactNode
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-1 h-4 rounded-full" style={{ background: color }} />
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em] flex items-center gap-1">
          {icon}{label}
        </h4>
        {hint && <span className="text-[10px] text-gray-400 ml-auto">{hint}</span>}
      </div>
      {children}
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
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
          {label}
          {required && <span className="text-blue-500">*</span>}
        </label>
        {unit && <span className="text-[10px] text-gray-400 font-mono">{unit}</span>}
      </div>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1 leading-tight">{hint}</p>}
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
      className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-mono text-right tabular-nums focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow"
    />
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
