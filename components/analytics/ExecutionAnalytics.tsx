'use client'

import { useEffect, useState } from 'react'
import {
  Calendar, Users, HardHat, TrendingUp, Cloud, CalendarDays,
  Package, Truck, Loader2, ShieldCheck, Send, FileText, Upload, PenLine,
} from 'lucide-react'
import Link from 'next/link'
import WorkBreakdown from './WorkBreakdown'
import EmptyState from '@/components/common/EmptyState'

interface Overall {
  projectStart: string
  projectEnd: string
  totalDays: number
  activeDays: number
  totalManDays: number
  tradeCount: number
  avgPerActiveDay: number
}

interface TradeSummary {
  trade: string
  totalManDays: number
  activeDays: number
  firstDate: string
  lastDate: string
  peakCount: number
  peakDate: string
  durationDays: number
}

interface MonthlyTrend {
  month: string
  totalWorkers: number
  activeDays: number
  avgPerDay: number
}

interface DowPattern {
  dow: string
  totalWorkers: number
  allDays: number
  activeDays: number
  days: number
  avg: number
  activeAvg: number
  utilizationRate: number
}

interface WeatherImpact {
  weather: string
  totalWorkers: number
  days: number
  avg: number
}

interface MaterialSummary {
  name: string
  spec: string
  unit: string
  totalQuantity: number
  days: number
}

interface EquipmentSummary {
  name: string
  spec: string
  totalCount: number
  days: number
}

interface AnalyticsResponse {
  overall: Overall | null
  tradeSummary: TradeSummary[]
  monthlyTrend: MonthlyTrend[]
  dowPattern: DowPattern[]
  weatherImpact: WeatherImpact[]
  materialSummary: MaterialSummary[]
  equipmentSummary: EquipmentSummary[]
}

export default function ExecutionAnalytics({ projectId }: { projectId: string }) {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [proposing, setProposing] = useState(false)
  const [proposeResult, setProposeResult] = useState<string | null>(null)

  async function submitProposal() {
    setProposing(true)
    setProposeResult(null)
    const res = await fetch(`/api/projects/${projectId}/productivity/propose`, {
      method: 'POST',
    })
    setProposing(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setProposeResult('❌ ' + (j.error ?? '제안 생성 실패'))
      return
    }
    const j = await res.json()
    setProposeResult(`✅ ${j.count}개 제안 생성됨. 관리자 승인 대기중.`)
  }

  useEffect(() => {
    setLoading(true)
    fetch(`/api/projects/${projectId}/analytics`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-blue-600" size={24} />
      </div>
    )
  }
  if (!data?.overall) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <EmptyState
          icon={FileText}
          title="아직 분석할 일보 데이터가 없습니다"
          description="일보를 쌓으면 공종·위치·생산성·월별 트렌드를 자동 분석해 보여줍니다. 과거 엑셀 일보가 있다면 한 번에 임포트도 가능합니다."
          actions={[
            { label: '일보 작성', href: `/projects/${projectId}/daily-reports/new`, icon: <PenLine size={14} />, variant: 'primary' },
            { label: '엑셀 임포트', href: '/import', icon: <Upload size={14} />, variant: 'secondary' },
          ]}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">실적 분석</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            일보 데이터 기반 공종별 생산성 · 준공공정표 · 패턴 분석
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={submitProposal}
            disabled={proposing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {proposing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {proposing ? '분석 중...' : '회사 표준으로 제안'}
          </button>
          <Link
            href="/admin/productivity"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50"
          >
            <ShieldCheck size={12} />
            승인 관리
          </Link>
        </div>
      </div>
      {proposeResult && (
        <div
          className={`text-xs px-3 py-2 rounded-lg ${
            proposeResult.startsWith('✅')
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {proposeResult}
        </div>
      )}

      {/* KPI 4개 */}
      <div className="grid grid-cols-4 gap-3">
        <Kpi
          icon={<Calendar size={16} className="text-blue-500" />}
          label="총 공기"
          value={`${data.overall.totalDays}일`}
          sub={`${data.overall.projectStart} ~ ${data.overall.projectEnd}`}
        />
        <Kpi
          icon={<Users size={16} className="text-emerald-500" />}
          label="총 투입 인일"
          value={`${data.overall.totalManDays.toLocaleString()}인일`}
          sub={`${data.overall.activeDays}일 활동`}
        />
        <Kpi
          icon={<HardHat size={16} className="text-orange-500" />}
          label="활동 공종"
          value={`${data.overall.tradeCount}개`}
          sub="투입 기록 있음"
        />
        <Kpi
          icon={<TrendingUp size={16} className="text-purple-500" />}
          label="일 평균 인원"
          value={`${data.overall.avgPerActiveDay}명`}
          sub="활동일 기준"
        />
      </div>

      {/* 공종별 투입 인일 (수평 막대) */}
      <Section title="공종별 투입 인일" subtitle="상위 15개 · 누적 인일">
        <TradeBarChart items={data.tradeSummary.slice(0, 15)} />
      </Section>

      {/* 준공공정표 (간트) */}
      <Section title="준공공정표" subtitle="각 공종의 실제 첫 투입일 ~ 마지막 투입일">
        <GanttChart items={data.tradeSummary} overall={data.overall} />
      </Section>

      {/* 부위·작업별 분해 (텍스트 파싱) */}
      <WorkBreakdown projectId={projectId} />

      <div className="grid grid-cols-2 gap-4">
        {/* 월별 추이 */}
        <Section title="월별 투입 인원 추이" subtitle="누적 투입 인원 / 활동일수">
          <MonthlyLineChart items={data.monthlyTrend} />
        </Section>

        {/* 요일별 */}
        <Section title="요일별 평균 투입" subtitle="요일별 활동일 평균">
          <DowBarChart items={data.dowPattern} />
        </Section>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 날씨별 */}
        <Section title="날씨별 투입 영향" subtitle="날씨에 따른 평균 인원">
          <WeatherBarChart items={data.weatherImpact} />
        </Section>

        {/* 자재 상위 */}
        <Section title="자재 누적 투입량 TOP 10" subtitle="전체 기간 합계">
          <MaterialTable items={data.materialSummary.slice(0, 10)} />
        </Section>
      </div>

      {/* 장비 */}
      <Section title="장비 가동 요약" subtitle="장비별 누적 가동일수 · 총 가동대수">
        <EquipmentTable items={data.equipmentSummary.slice(0, 15)} />
      </Section>
    </div>
  )
}

// ─── 공용 ───────────────────────────
function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <div className="text-xl font-bold text-gray-900 mb-0.5">{value}</div>
      <div className="text-[10px] text-gray-400">{sub}</div>
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── 공종별 수평 막대 ──────────────────
function TradeBarChart({ items }: { items: TradeSummary[] }) {
  if (items.length === 0) return <Empty />
  const max = Math.max(...items.map(i => i.totalManDays))
  return (
    <div className="space-y-1.5">
      {items.map(it => (
        <div key={it.trade} className="flex items-center gap-2 text-xs">
          <div className="w-24 flex-shrink-0 text-gray-700 font-medium truncate">
            {it.trade}
          </div>
          <div className="flex-1 bg-gray-100 rounded-md h-5 relative overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-md"
              style={{ width: `${(it.totalManDays / max) * 100}%` }}
            />
            <span className="absolute left-2 top-0 h-full flex items-center text-white font-mono font-semibold text-[10px] mix-blend-difference">
              {it.totalManDays.toLocaleString()}인일
            </span>
          </div>
          <div className="w-16 text-right text-gray-400 font-mono">{it.activeDays}일</div>
        </div>
      ))}
    </div>
  )
}

// ─── 준공공정표 (간트) ──────────────────
function GanttChart({
  items,
  overall,
}: {
  items: TradeSummary[]
  overall: Overall
}) {
  if (items.length === 0) return <Empty />
  const start = new Date(overall.projectStart).getTime()
  const end = new Date(overall.projectEnd).getTime()
  const totalMs = end - start || 1

  // 월 눈금
  const months: { label: string; pct: number }[] = []
  const cursor = new Date(overall.projectStart)
  cursor.setDate(1)
  while (cursor.getTime() <= end) {
    const pct = ((cursor.getTime() - start) / totalMs) * 100
    months.push({
      label: `${cursor.getFullYear().toString().slice(2)}.${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      pct: Math.max(0, pct),
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* 월 타임라인 */}
        <div className="flex items-end h-6 relative border-b border-gray-200 mb-2 ml-32">
          {months.map((m, i) => (
            <div
              key={i}
              className="absolute text-[10px] text-gray-400 font-mono"
              style={{ left: `${m.pct}%` }}
            >
              <div className="w-px h-2 bg-gray-300" />
              <span className="ml-0.5">{m.label}</span>
            </div>
          ))}
        </div>

        {/* 공종 Bar들 */}
        <div className="space-y-1">
          {items.map(it => {
            const itemStart = new Date(it.firstDate).getTime()
            const itemEnd = new Date(it.lastDate).getTime()
            const left = ((itemStart - start) / totalMs) * 100
            const width = Math.max(0.5, ((itemEnd - itemStart) / totalMs) * 100)
            return (
              <div key={it.trade} className="flex items-center gap-2 h-5">
                <div className="w-32 flex-shrink-0 text-[11px] text-gray-700 truncate">
                  {it.trade}
                </div>
                <div className="flex-1 bg-gray-50 rounded h-full relative">
                  <div
                    className="absolute top-0 h-full rounded bg-gradient-to-r from-emerald-500 to-emerald-400 flex items-center justify-end pr-1"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${it.firstDate} ~ ${it.lastDate} (${it.durationDays}일)`}
                  >
                    <span className="text-[9px] font-mono text-white font-semibold">
                      {it.durationDays}d
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── 월별 라인 ──────────────────
function MonthlyLineChart({ items }: { items: MonthlyTrend[] }) {
  if (items.length === 0) return <Empty />
  const max = Math.max(...items.map(m => m.totalWorkers))
  return (
    <div className="relative h-40 flex items-end gap-0.5">
      {items.map((m, i) => {
        const h = (m.totalWorkers / max) * 100
        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-1 min-w-0"
            title={`${m.month}: ${m.totalWorkers}명 · ${m.activeDays}일`}
          >
            <div className="w-full relative flex flex-col justify-end" style={{ height: '90%' }}>
              <div
                className="bg-gradient-to-t from-blue-500 to-blue-300 rounded-t"
                style={{ height: `${h}%` }}
              />
            </div>
            <div className="text-[9px] text-gray-400 font-mono truncate w-full text-center">
              {m.month.slice(5)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── 요일별 ──────────────────
function DowBarChart({ items }: { items: DowPattern[] }) {
  if (items.length === 0) return <Empty />
  const max = Math.max(...items.map(d => d.avg), 1)
  return (
    <div>
      <div className="grid grid-cols-7 gap-2">
        {items.map(d => {
          const h = (d.avg / max) * 100
          const isWeekend = d.dow === '토' || d.dow === '일'
          return (
            <div key={d.dow} className="flex flex-col items-center gap-1">
              <div className="w-full h-28 flex flex-col justify-end">
                <div
                  className={`rounded-t ${isWeekend ? 'bg-orange-400' : 'bg-blue-500'}`}
                  style={{ height: `${Math.max(2, h)}%` }}
                />
              </div>
              <div className="text-[11px] font-mono text-gray-700 font-semibold">
                {d.avg}
              </div>
              <div className="text-[9px] text-gray-400">명/일</div>
              <div className={`text-[10px] font-semibold ${isWeekend ? 'text-orange-600' : 'text-gray-600'}`}>
                {d.dow}
              </div>
              <div className="text-[9px] text-gray-400">
                가동 {d.utilizationRate}%
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 text-[10px] text-gray-400 text-center">
        평균은 <b>해당 요일 전체 일수 기준</b> (휴무일 포함) · 가동률 = 투입있는 날 비율
      </div>
    </div>
  )
}

// ─── 날씨별 ──────────────────
function WeatherBarChart({ items }: { items: WeatherImpact[] }) {
  if (items.length === 0) return <Empty />
  const max = Math.max(...items.map(w => w.avg))
  return (
    <div className="space-y-2">
      {items.map(w => (
        <div key={w.weather} className="flex items-center gap-2 text-xs">
          <div className="w-16 flex items-center gap-1.5 text-gray-700 font-medium">
            <Cloud size={11} className="text-gray-400" />
            {w.weather}
          </div>
          <div className="flex-1 bg-gray-100 rounded h-5 relative overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-sky-300 rounded"
              style={{ width: `${(w.avg / max) * 100}%` }}
            />
            <span className="absolute left-2 top-0 h-full flex items-center text-white font-mono font-semibold text-[10px]">
              평균 {w.avg}명
            </span>
          </div>
          <div className="w-12 text-right text-gray-400 font-mono">{w.days}일</div>
        </div>
      ))}
    </div>
  )
}

// ─── 자재 테이블 ──────────────────
function MaterialTable({ items }: { items: MaterialSummary[] }) {
  if (items.length === 0) return <Empty />
  return (
    <div className="space-y-1 text-xs">
      {items.map((m, i) => (
        <div
          key={i}
          className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0"
        >
          <Package size={11} className="text-gray-400" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-gray-800">{m.name}</span>
            {m.spec && <span className="text-gray-400 ml-1">{m.spec}</span>}
          </div>
          <div className="text-right font-mono">
            <div className="font-semibold text-blue-700">
              {m.totalQuantity.toLocaleString()}
              {m.unit && <span className="text-gray-400 ml-0.5">{m.unit}</span>}
            </div>
            <div className="text-[9px] text-gray-400">{m.days}일</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 장비 테이블 ──────────────────
function EquipmentTable({ items }: { items: EquipmentSummary[] }) {
  if (items.length === 0) return <Empty />
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((e, i) => (
        <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2.5 text-xs">
          <Truck size={14} className="text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-800 truncate">{e.name}</div>
            {e.spec && <div className="text-[10px] text-gray-400">{e.spec}</div>}
          </div>
          <div className="text-right">
            <div className="font-mono font-semibold text-emerald-700">{e.days}일</div>
            <div className="text-[9px] text-gray-400">총 {e.totalCount}대</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Empty() {
  return (
    <div className="text-center py-6 text-xs text-gray-400">데이터 없음</div>
  )
}
