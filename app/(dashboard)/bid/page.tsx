'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardCheck, Building2, Ruler, Layers, Play, Save, TrendingUp,
  Calendar, Users, DollarSign, AlertTriangle, Loader2, ArrowRight,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { useToast } from '@/components/common/Toast'
import BenchmarkPanel from '@/components/common/BenchmarkPanel'

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
  monthlyFinCost: string
}

interface EstimateResult {
  cpm: { totalDuration: number; taskCount: number; criticalPathCount: number }
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

const INITIAL: BidInput = {
  name: '', type: '공동주택',
  ground: '20', basement: '2', lowrise: '0', hasTransfer: false,
  bldgArea: '30000', buildingArea: '1500', siteArea: '6000',
  sitePerim: '300', bldgPerim: '220',
  wtBottom: '3', waBottom: '6',
  monthlyFinCost: '5000',
}

export default function BidPage() {
  const router = useRouter()
  const toast = useToast()
  const [input, setInput] = useState<BidInput>(INITIAL)
  const [result, setResult] = useState<EstimateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  function set<K extends keyof BidInput>(key: K, v: string) {
    setInput(p => ({ ...p, [key]: v }))
  }

  async function estimate() {
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
  }

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

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={ClipboardCheck}
        title="사업 초기 검토"
        subtitle="기본 정보만으로 개략공기·인력·공사비 산정 · 저장 없이 반복 시뮬 → 확정 시 프로젝트 생성"
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

                {/* 핵심 KPI */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Kpi icon={<Calendar size={14} className="text-blue-600" />} bg="bg-blue-50"
                    label="총 공기" value={`${result.cpm.totalDuration}`} unit="일"
                    sub={`약 ${Math.round(result.cpm.totalDuration / 30)}개월`} />
                  <Kpi icon={<Users size={14} className="text-orange-600" />} bg="bg-orange-50"
                    label="피크 투입" value={`${result.resourcePlan.peak.count}`} unit="명"
                    sub={`${result.resourcePlan.peak.day + 1}일차`} />
                  <Kpi icon={<TrendingUp size={14} className="text-purple-600" />} bg="bg-purple-50"
                    label="일평균 투입" value={`${result.resourcePlan.avgDaily}`} unit="명"
                    sub={`누적 ${result.resourcePlan.totalManDays.toLocaleString()}인일`} />
                  <Kpi icon={<DollarSign size={14} className="text-emerald-600" />} bg="bg-emerald-50"
                    label="개략 원가" value={fmtKRW(result.estimate.totalEstimateKRW)} unit="원"
                    sub={`노무비 ${Math.round(result.estimate.laborCostKRW / 100000000).toLocaleString()}억 포함`} />
                </div>

                {/* 월별 자원 */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                    <Users size={14} /> 월별 필요 인력
                  </h3>
                  {result.resourcePlan.monthlyTotals.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">시작일이 없어 월별 집계 생략 — 저장 후 시작일 입력 시 표시</p>
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

                {/* 지연 시나리오 */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-500" /> 지연 민감도 (추가 원가)
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

                {/* CP 공종 */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                    <ArrowRight size={14} className="text-orange-500" /> Critical Path
                  </h3>
                  <p className="text-xs text-gray-600 mb-2">
                    전체 {result.cpm.taskCount}개 공종 중 <strong className="text-orange-600">{result.cpm.criticalPathCount}개</strong>가 Critical Path. 이 공종들 지연 시 전체 공기 연장.
                  </p>
                  {result.resourcePlan.uncoveredTasks.length > 0 && (
                    <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 rounded p-2">
                      <strong>회사 실적 없는 공종:</strong> {result.resourcePlan.uncoveredTasks.join(', ')}
                      <br />
                      <span className="text-amber-600">인원 추정에서 제외됨. 일보 임포트로 데이터 확보 권장.</span>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[11px] text-blue-900">
                  <strong>개략 원가 계산 방법</strong>: 회사 실적 기반 평균 투입 인원 × 공기 × 일단가(27만원) + 자재·경비(노무비의 1.4배 가정).
                  실제 견적은 공종별 단가표와 자재 견적을 적용해야 하며, 본 수치는 <strong>사업성 판단용 ±15% 개략</strong>입니다.
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
