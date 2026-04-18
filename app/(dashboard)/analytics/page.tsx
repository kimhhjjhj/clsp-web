'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3, TrendingUp, FolderKanban, Activity, Cloud, Calendar,
  Users2, Package, Wrench, ChevronRight,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { Skeleton, SkeletonKpiGrid, SkeletonList } from '@/components/common/Skeleton'
import EmptyState from '@/components/common/EmptyState'

interface Overall {
  projectCount: number
  totalReports: number
  totalManDays: number
  uniqueDates: number
  uniqueTrades: number
  uniqueCompanies: number
  avgDailyOverall: number
}
interface TradeRow { trade: string; totalManDays: number; activeDays: number; companies: number; avgDaily: number }
interface MonthRow { month: string; totalManDays: number; activeDays: number; avgDaily: number }
interface DowRow { dow: string; totalManDays: number; allDays: number; activeDays: number; avgAllDays: number; utilization: number }
interface WeatherRow { weather: string; totalManDays: number; days: number; avgDaily: number }
interface ProjectRow {
  id: string; name: string; type?: string; ground: number; basement: number; bldgArea?: number
  startDate?: string; lastCpmDuration?: number
  taskCount: number; reportCount: number; totalManDays: number; activeDays: number; tradeCount: number
}
interface MatRow { name: string; qty: number }
interface EqRow { name: string; count: number }

interface AnalyticsData {
  overall: Overall
  topTrades: TradeRow[]
  monthlyTrend: MonthRow[]
  dowPattern: DowRow[]
  weatherImpact: WeatherRow[]
  projectSummary: ProjectRow[]
  topMaterials: MatRow[]
  topEquipment: EqRow[]
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader icon={BarChart3} title="전사 분석" subtitle="모든 프로젝트 합산 현황" accent="violet" />
        <div className="p-4 sm:p-6 space-y-5">
          <SkeletonKpiGrid count={4} />
          <Skeleton className="h-5 w-1/4" />
          <SkeletonList rows={6} />
        </div>
      </div>
    )
  }

  if (!data || data.overall.totalReports === 0) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader icon={BarChart3} title="전사 분석" subtitle="모든 프로젝트 합산 현황" accent="violet" />
        <div className="p-6">
          <div className="bg-white rounded-xl border border-gray-200">
            <EmptyState
              icon={BarChart3}
              title="아직 분석할 데이터가 없습니다"
              description="프로젝트에 일보를 쌓으면 여기서 전사 단위로 공종·월·요일·날씨·자재 분석이 자동 생성됩니다."
              actions={[{ label: '엑셀 일보 임포트', href: '/import', variant: 'primary' }]}
            />
          </div>
        </div>
      </div>
    )
  }

  const { overall, topTrades, monthlyTrend, dowPattern, weatherImpact, projectSummary, topMaterials, topEquipment } = data
  const maxTrade = Math.max(...topTrades.map(t => t.totalManDays), 1)
  const maxMonth = Math.max(...monthlyTrend.map(m => m.totalManDays), 1)
  const maxDow = Math.max(...dowPattern.map(d => d.avgAllDays), 1)

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={BarChart3}
        title="전사 분석"
        subtitle={`${overall.projectCount}개 프로젝트 · ${overall.totalReports.toLocaleString()}건 일보 · ${overall.totalManDays.toLocaleString()} 인일`}
        accent="violet"
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
        {/* 최상단 KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={<FolderKanban size={14} className="text-blue-600" />} bg="bg-blue-50" label="프로젝트" value={overall.projectCount} unit="개" />
          <Kpi icon={<Activity size={14} className="text-emerald-600" />} bg="bg-emerald-50" label="누적 인일" value={overall.totalManDays.toLocaleString()} unit="인일" />
          <Kpi icon={<Users2 size={14} className="text-purple-600" />} bg="bg-purple-50" label="협력사" value={overall.uniqueCompanies} unit="개" />
          <Kpi icon={<TrendingUp size={14} className="text-orange-600" />} bg="bg-orange-50" label="공종" value={overall.uniqueTrades} unit="종" />
        </div>

        {/* 공종 랭킹 */}
        <Card title="공종별 누적 투입" subtitle={`상위 ${Math.min(20, topTrades.length)}종 · 인일 기준`}>
          <ul className="space-y-1.5">
            {topTrades.slice(0, 15).map(t => {
              const ratio = (t.totalManDays / maxTrade) * 100
              return (
                <li key={t.trade}>
                  <div className="flex items-center justify-between mb-0.5 text-xs">
                    <span className="font-semibold text-gray-900">{t.trade}</span>
                    <span className="text-gray-500">
                      <span className="font-mono text-blue-700 font-bold">{t.totalManDays.toLocaleString()}</span> 인일 · {t.activeDays}일 · 평균 <span className="font-semibold">{t.avgDaily}</span>명 · {t.companies}개 협력사
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full" style={{ width: `${ratio}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 월별 트렌드 */}
          <Card title="월별 투입 추이" subtitle="전사 합산 인일" icon={<Calendar size={14} className="text-gray-400" />}>
            <ul className="space-y-1.5">
              {monthlyTrend.map(m => {
                const ratio = (m.totalManDays / maxMonth) * 100
                return (
                  <li key={m.month} className="text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-mono text-gray-700">{m.month}</span>
                      <span className="text-gray-500">
                        <span className="font-bold text-gray-900 font-mono">{m.totalManDays.toLocaleString()}</span> · {m.activeDays}일
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${ratio}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>

          {/* 요일 패턴 */}
          <Card title="요일별 평균 투입" subtitle="전체 일보일 기준 · 가동률 포함" icon={<Activity size={14} className="text-gray-400" />}>
            <ul className="space-y-1.5">
              {dowPattern.map(d => {
                const ratio = (d.avgAllDays / maxDow) * 100
                const weekend = d.dow === '일' || d.dow === '토'
                return (
                  <li key={d.dow} className="text-xs flex items-center gap-2">
                    <span className={`w-6 text-center font-bold ${weekend ? 'text-red-500' : 'text-gray-700'}`}>{d.dow}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-md relative overflow-hidden">
                      <div className="h-full rounded-md" style={{ width: `${ratio}%`, background: weekend ? '#fca5a5' : '#93c5fd' }} />
                      <span className="absolute inset-0 flex items-center px-2 text-[10px] font-mono text-gray-900">
                        평균 {d.avgAllDays}명 · 가동률 {d.utilization}%
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>

          {/* 날씨 영향 */}
          {weatherImpact.length > 0 && (
            <Card title="날씨별 투입 분포" subtitle="인원 합산" icon={<Cloud size={14} className="text-gray-400" />}>
              <ul className="divide-y divide-gray-100">
                {weatherImpact.map(w => (
                  <li key={w.weather} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="font-semibold text-gray-900">{w.weather}</span>
                    <span className="text-gray-500">
                      {w.days}일 · <span className="font-mono text-gray-900 font-bold">{w.totalManDays.toLocaleString()}</span> · 평균 {w.avgDaily}명
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* 자재·장비 */}
          <Card title="자재·장비 Top" subtitle="누적 사용량" icon={<Package size={14} className="text-gray-400" />}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">자재</p>
                <ul className="space-y-1">
                  {topMaterials.length === 0 ? <li className="text-[11px] text-gray-400 italic">데이터 없음</li> :
                    topMaterials.map(m => (
                      <li key={m.name} className="flex items-center justify-between text-xs">
                        <span className="truncate text-gray-700">{m.name}</span>
                        <span className="font-mono font-semibold text-gray-900 ml-2 flex-shrink-0">{m.qty.toLocaleString()}</span>
                      </li>
                    ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Wrench size={10} /> 장비
                </p>
                <ul className="space-y-1">
                  {topEquipment.length === 0 ? <li className="text-[11px] text-gray-400 italic">데이터 없음</li> :
                    topEquipment.map(e => (
                      <li key={e.name} className="flex items-center justify-between text-xs">
                        <span className="truncate text-gray-700">{e.name}</span>
                        <span className="font-mono font-semibold text-gray-900 ml-2 flex-shrink-0">{e.count.toLocaleString()}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </Card>
        </div>

        {/* 프로젝트 요약 */}
        <Card title="프로젝트별 요약" subtitle="공기·일보·공종·투입 인원 비교" icon={<FolderKanban size={14} className="text-gray-400" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="text-left py-2 pr-3">프로젝트</th>
                  <th className="text-left py-2 pr-3 hidden sm:table-cell">유형</th>
                  <th className="text-right py-2 pr-3">규모</th>
                  <th className="text-right py-2 pr-3 hidden md:table-cell">공기</th>
                  <th className="text-right py-2 pr-3 hidden md:table-cell">일보</th>
                  <th className="text-right py-2 pr-3 hidden lg:table-cell">공종</th>
                  <th className="text-right py-2">누적 인일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projectSummary.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-2 pr-3">
                      <Link href={`/projects/${p.id}`} className="font-semibold text-gray-900 hover:text-blue-700 hover:underline no-underline flex items-center gap-1">
                        {p.name}
                        <ChevronRight size={10} className="text-gray-300" />
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-gray-500 hidden sm:table-cell">{p.type ?? '—'}</td>
                    <td className="py-2 pr-3 text-right font-mono text-gray-700">
                      {p.ground}F{p.basement ? `/B${p.basement}F` : ''}
                      {p.bldgArea && <span className="block text-[10px] text-gray-400">{p.bldgArea.toLocaleString()}㎡</span>}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono hidden md:table-cell">
                      {p.lastCpmDuration ? <span className="text-blue-700 font-bold">{p.lastCpmDuration}일</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono hidden md:table-cell">{p.reportCount}</td>
                    <td className="py-2 pr-3 text-right font-mono hidden lg:table-cell">{p.tradeCount}</td>
                    <td className="py-2 text-right font-mono font-bold text-emerald-700">
                      {p.totalManDays.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Kpi({
  icon, bg, label, value, unit,
}: { icon: React.ReactNode; bg: string; label: string; value: number | string; unit: string }) {
  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <div className={`w-7 h-7 rounded-md ${bg} flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900">
        {value}<span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </p>
    </div>
  )
}

function Card({
  title, subtitle, icon, children,
}: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card-elevated p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <div>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}
