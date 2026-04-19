'use client'

import React, { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck, TrendingUp, Pencil, CheckCircle2, ArrowRight, HardHat,
  Calendar, AlertTriangle, Activity, Building2, ClipboardCheck,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { Skeleton } from '@/components/common/Skeleton'
import BenchmarkPanel from '@/components/common/BenchmarkPanel'
import { IndustrySpecificSummary, type IndustrySpecific } from '@/components/common/IndustrySpecificFields'
import CpAlertBanner from '@/components/common/CpAlertBanner'
import { getProjectStatus, STATUS_META, formatRelative } from '@/lib/project-status'

interface AiCostEstimate {
  summary?: {
    grandTotalKRW: number
    directCostKRW: number
    pricePerSqmKRW: number
    pricePerPyongKRW: number
  }
  estimatedAt?: string
  model?: string
}

interface Project {
  id: string
  name: string
  client?: string
  contractor?: string
  location?: string
  type?: string
  ground?: number
  basement?: number
  bldgArea?: number
  siteArea?: number
  startDate?: string
  industrySpecific?: IndustrySpecific | null
  aiCostEstimate?: AiCostEstimate | null
  productivityAdjustments?: Array<{ taskId: string; multiplier: number }> | null
  lastCpmDuration?: number | null
}

interface StageStatus {
  stage1: { hasCpm: boolean; totalDuration: number | null; taskCount: number }
  stage2: { riskCount: number; opportunityCount: number; hasBaseline: boolean; baselineTaskCount: number }
  stage3: { latestRate: number | null; plannedRate: number | null; lastReportDate: string | null; dailyReportCount: number; latestWeek: string | null }
  stage4: { weeklyReportCount: number }
}

interface StageCardRow {
  label: string
  value: string
  highlight?: boolean
  danger?: boolean
  muted?: boolean
}

function fmtKRWBillion(n: number): string {
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}조`
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만`
  return n.toLocaleString()
}

function addDays(iso: string | undefined, days: number | null | undefined): string | null {
  if (!iso || days == null) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + Math.round(days))
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function daysUntil(dateStr: string): string {
  const target = new Date(dateStr.replace(/\./g, '-'))
  const now = new Date()
  const diff = Math.ceil((target.getTime() - now.getTime()) / 86400000)
  if (diff < 0) return `D+${Math.abs(diff)}`
  return `D-${diff}`
}

export default function StageHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [status, setStatus] = useState<StageStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then(r => r.json()),
      fetch(`/api/projects/${id}/stage-status`).then(r => r.json()),
    ])
      .then(([proj, stat]) => {
        setProject(proj)
        setStatus(stat)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex flex-col h-full">
      <PageHeader icon={Building2} title="프로젝트…" subtitle="불러오는 중" />
      <div className="p-6 space-y-4">
        <Skeleton className="h-4 w-1/2" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-44" />)}
        </div>
      </div>
    </div>
  )
  if (!project) return (
    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
      프로젝트를 찾을 수 없습니다.
    </div>
  )

  // 라이프사이클 상태 — 준공이면 모든 단계 완료로 간주
  const lifecycle = getProjectStatus({
    latestReportDate: status?.stage3.lastReportDate ?? null,
    _count: { dailyReports: status?.stage3.dailyReportCount ?? 0 },
  })
  const isCompleted = lifecycle === 'completed'

  // 1단계(개략공기)는 사업 초기 검토(/bid)로 이전 — 프로젝트 진입 시점엔 이미 완료된 것으로 간주
  const stage2Done = isCompleted || (status?.stage2.riskCount ?? 0) > 0 || (status?.stage2.hasBaseline ?? false)
  const stage3Done = isCompleted || (status?.stage3.latestRate !== null && status?.stage3.latestRate !== undefined)
  const stage4Done = isCompleted || (status?.stage4.weeklyReportCount ?? 0) > 0

  const latestRate = status?.stage3.latestRate ?? 0
  const plannedRate = status?.stage3.plannedRate ?? 0
  const variance = latestRate - plannedRate
  const totalDuration = status?.stage1.totalDuration ?? 0
  const finishDate = addDays(project.startDate, totalDuration)
  const riskCount = status?.stage2.riskCount ?? 0
  const opportunityCount = status?.stage2.opportunityCount ?? 0

  const cards: {
    stageId: number
    phaseLabel: string
    color: string
    bg: string
    icon: React.ReactNode
    title: string
    subtitle: string
    rows: StageCardRow[]
    progress: number
    done: boolean
  }[] = [
    {
      stageId: 2,
      phaseLabel: 'STAGE 01',
      color: '#16a34a',
      bg: '#f0fdf4',
      icon: <ShieldCheck size={22} color={stage2Done ? '#16a34a' : '#94a3b8'} />,
      title: '1단계 · 프리콘',
      subtitle: '리스크 · 시나리오 · 프로세스맵',
      rows: [
        { label: '리스크 / 기회', value: `R&O ${riskCount}건`, highlight: riskCount > 0 },
        {
          label: '베이스라인',
          value: status?.stage2.hasBaseline ? '등록됨' : '미등록',
          highlight: status?.stage2.hasBaseline,
          danger: !status?.stage2.hasBaseline,
        },
      ],
      progress: stage2Done ? (status?.stage2.hasBaseline && riskCount > 0 ? 100 : 50) : 0,
      done: stage2Done,
    },
    {
      stageId: 3,
      phaseLabel: 'STAGE 02',
      color: '#ea580c',
      bg: '#fff7ed',
      icon: <HardHat size={22} color={stage3Done ? '#ea580c' : '#94a3b8'} />,
      title: '2단계 · 시공 관리',
      subtitle: '일보 · 엑셀 임포트 · 사진',
      rows: [
        {
          label: '최근 업데이트',
          value: status?.stage3.latestWeek ?? '데이터 없음',
          highlight: !!status?.stage3.latestWeek,
          muted: !status?.stage3.latestWeek,
        },
        { label: '작업일보', value: `${status?.stage3.dailyReportCount ?? 0}건` },
      ],
      progress: stage3Done ? Math.min(100, Math.round(latestRate)) : 0,
      done: stage3Done,
    },
    {
      stageId: 4,
      phaseLabel: 'STAGE 03',
      color: '#7c3aed',
      bg: '#faf5ff',
      icon: <TrendingUp size={22} color={stage4Done ? '#7c3aed' : '#94a3b8'} />,
      title: '3단계 · 분석 & 준공',
      subtitle: '공종·위치 분석 · Lessons Learned',
      rows: [
        { label: '주간 보고서', value: `${status?.stage4.weeklyReportCount ?? 0}주차` },
        { label: '준공 예정', value: finishDate ?? '—', muted: !finishDate },
      ],
      progress: stage4Done ? Math.min(100, (status?.stage4.weeklyReportCount ?? 0) * 10) : 0,
      done: stage4Done,
    },
  ]

  const projectSubtitle = [
    project.client,
    project.location,
    project.ground !== undefined ? `지상 ${project.ground}층${project.basement ? ` · 지하 ${project.basement}층` : ''}` : null,
    project.bldgArea ? `연면적 ${project.bldgArea.toLocaleString()}㎡` : null,
  ].filter(Boolean).join(' · ')

  const currentPhase = stage3Done ? '시공 진행 중' : stage2Done ? '프리콘 단계' : '초기 검토 완료'
  const phaseColor = stage3Done ? '#16a34a' : stage2Done ? '#ea580c' : '#2563eb'

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={Building2}
        title={project.name}
        subtitle={projectSubtitle}
        actions={
          <div className="flex items-center gap-1.5">
            <Link
              href={`/bid?projectId=${id}`}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-white/15 bg-white/5 text-xs font-semibold text-slate-200 hover:bg-white/10"
              title="사업 초기 검토에서 개략공기·조정값 다시 편집"
            >
              <ClipboardCheck size={12} /> 개략공기 재검토
            </Link>
            <Link
              href={`/projects/${id}/edit`}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-white/15 bg-white/5 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              <Pencil size={12} /> 수정
            </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
        {/* CP 공종 조기 경보 (alert 있을 때만 렌더) */}
        <CpAlertBanner projectId={id} />

        {/* 상태 배너 — 라이프사이클 상태 + 현재 진행 단계 통합 */}
        {(() => {
          const lcInfo = STATUS_META[lifecycle]
          return (
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* 라이프사이클 상태 (전체 프로젝트 상태) */}
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider text-white"
                    style={{ background: lcInfo.color + 'cc' }}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full bg-white ${lifecycle === 'active' ? 'animate-pulse' : ''}`} />
                    {lcInfo.label}
                  </div>
                  {/* 현재 작업 단계 (라이프사이클 내부) */}
                  {lifecycle === 'active' && (
                    <span className="text-[11px] text-slate-300">
                      <span className="text-slate-500 mr-1">단계</span>
                      <span className="font-semibold text-white">{currentPhase}</span>
                    </span>
                  )}
                  {status?.stage3.lastReportDate && (
                    <span className="text-[11px] text-slate-400">
                      <span className="text-slate-500 mr-1">마지막 일보</span>
                      <span className="font-semibold text-slate-200">{formatRelative(status.stage3.lastReportDate)}</span>
                    </span>
                  )}
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-300">{project.type || '건축 공사'}</span>
                  <IndustrySpecificSummary type={project.type} value={project.industrySpecific ?? undefined} />
                  {Array.isArray(project.productivityAdjustments) && project.productivityAdjustments.length > 0 && (
                    <Link
                      href={`/bid?projectId=${id}`}
                      title="저장된 공종 조정값 · 클릭 시 /bid에서 편집"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-200 border border-amber-400/30 hover:bg-amber-500/30 no-underline"
                    >
                      생산성 조정 {project.productivityAdjustments.length}건
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-5 text-xs text-slate-300">
                  {project.startDate && (
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-slate-400" />
                      착공 {project.startDate}
                    </span>
                  )}
                  {finishDate && (
                    <span className="flex items-center gap-1.5">
                      <span className="text-slate-500">→</span>
                      준공 <span className="text-white font-semibold">{finishDate}</span>
                      <span className={`font-bold font-mono ml-1 ${lifecycle === 'completed' ? 'text-slate-400' : 'text-emerald-400'}`}>
                        {daysUntil(finishDate)}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* 4단계 카드 (2x2) + 우측 요약 */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* 스테이지 카드 */}
          <div className="xl:col-span-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cards.map(card => (
                <div
                  key={card.stageId}
                  className="card-elevated relative p-5 cursor-pointer group hover:-translate-y-0.5"
                  style={{ borderLeftColor: card.color, borderLeftWidth: 4 }}
                  onClick={() => router.push(`/projects/${id}/stage/${card.stageId}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: card.bg }}>
                      {card.icon}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {card.done && <CheckCircle2 size={14} color={card.color} />}
                      <span
                        className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                        style={{ color: card.color, background: card.bg }}
                      >
                        {card.phaseLabel}
                      </span>
                    </div>
                  </div>

                  <h2 className="text-[15px] font-bold text-gray-900 leading-tight">{card.title}</h2>
                  <p className="text-xs text-gray-400 mb-4 mt-0.5">{card.subtitle}</p>

                  <div className="space-y-2 mb-4">
                    {card.rows.map((row, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{row.label}</span>
                        <span
                          className="font-semibold"
                          style={{
                            color: row.danger ? '#dc2626'
                              : row.muted ? '#94a3b8'
                              : row.highlight ? card.color
                              : '#0f172a',
                          }}
                        >
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${card.progress}%`, background: card.color }}
                    />
                  </div>

                  <ArrowRight
                    size={14}
                    className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: card.color }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 우측 요약 */}
          <div className="xl:col-span-4 space-y-4">
            {/* 핵심 지표 3종 */}
            <div className="grid grid-cols-3 gap-2">
              <MetricTile
                label="총 공기"
                value={totalDuration > 0 ? totalDuration : '—'}
                unit={totalDuration > 0 ? '일' : ''}
                accent="#2563eb"
              />
              <MetricTile
                label="연면적"
                value={project.bldgArea ? project.bldgArea.toLocaleString() : '—'}
                unit={project.bldgArea ? '㎡' : ''}
                accent="#ea580c"
              />
              <MetricTile
                label="지상 층수"
                value={project.ground ?? '—'}
                unit="층"
                accent="#16a34a"
              />
            </div>

            {/* AI 공사비 추정 — 초기 검토 시 저장된 경우 */}
            {project.aiCostEstimate?.summary && (
              <div className="card-elevated p-4 bg-gradient-to-br from-violet-50/60 to-blue-50/40">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">
                    🤖 사업 초기 검토 · AI 추정 공사비
                  </span>
                </div>
                <p className="text-2xl font-bold text-violet-900 font-mono tracking-tight leading-none">
                  {fmtKRWBillion(project.aiCostEstimate.summary.grandTotalKRW)}
                </p>
                <p className="text-[11px] text-violet-700 mt-1.5">
                  평당 {Math.round((project.aiCostEstimate.summary.pricePerPyongKRW ?? 0) / 10000).toLocaleString()}만원
                  {' · '}
                  ㎡당 {Math.round((project.aiCostEstimate.summary.pricePerSqmKRW ?? 0) / 1000)}천원
                </p>
                {project.aiCostEstimate.estimatedAt && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(project.aiCostEstimate.estimatedAt).toLocaleDateString('ko-KR')} 추정
                  </p>
                )}
              </div>
            )}

            {/* 상세 정보 */}
            <div className="card-elevated overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">프로젝트 개요</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Project Metrics</p>
                </div>
                <Link
                  href={`/projects/${id}/edit`}
                  className="text-[10px] text-gray-400 hover:text-blue-600 font-semibold no-underline"
                >
                  수정 →
                </Link>
              </div>
              <dl className="divide-y divide-gray-100">
                <DetailRow label="발주처" value={project.client} />
                <DetailRow label="시공사" value={project.contractor} />
                <DetailRow label="공사 위치" value={project.location} />
                <DetailRow label="대지면적" value={project.siteArea ? `${project.siteArea.toLocaleString()} ㎡` : undefined} />
                <DetailRow
                  label="층수"
                  value={project.ground !== undefined ? `지상 ${project.ground}층${project.basement ? ` / 지하 ${project.basement}층` : ''}` : undefined}
                />
                <DetailRow label="착공일" value={project.startDate} />
                <DetailRow label="준공 예정일" value={finishDate ?? undefined} emphasized={!!finishDate} />
              </dl>
              <div className="p-3 border-t border-gray-100 bg-gradient-to-br from-gray-50 to-white">
                <button
                  onClick={() => router.push(`/projects/${id}/stage/4`)}
                  className="w-full h-9 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5"
                >
                  <TrendingUp size={12} /> 분석 & 준공 리포트
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 유사 프로젝트 벤치마크 */}
        <BenchmarkPanel
          query={{
            type: project.type,
            ground: project.ground,
            basement: project.basement,
            bldgArea: project.bldgArea,
          }}
          limit={5}
        />

        {/* 하단 3개 KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard
            icon={<Activity size={16} color="#2563eb" />}
            iconBg="bg-blue-50"
            label="공정 진행률 (계획 대비)"
            value={stage3Done ? `${latestRate.toFixed(1)}%` : '—'}
            extra={stage3Done ? (
              <span className={`text-xs font-semibold ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                ({variance >= 0 ? '+' : ''}{variance.toFixed(1)}%)
              </span>
            ) : null}
            footer={stage3Done ? `계획 ${plannedRate.toFixed(1)}% / 실적 ${latestRate.toFixed(1)}%` : '3단계에서 주간 실적 입력'}
          />
          <SummaryCard
            icon={<Calendar size={16} color="#7c3aed" />}
            iconBg="bg-purple-50"
            label="준공까지 남은 기간"
            value={finishDate ? daysUntil(finishDate) : '—'}
            footer={finishDate ? `준공 예정일 ${finishDate}` : '1단계 CPM 실행 후 계산'}
          />
          <SummaryCard
            icon={<AlertTriangle size={16} color="#ea580c" />}
            iconBg="bg-orange-50"
            label="리스크 & 기회"
            value={`${riskCount + opportunityCount}건`}
            footer={`리스크 ${riskCount}건 · 기회 ${opportunityCount}건`}
          />
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, emphasized }: { label: string; value?: string; emphasized?: boolean }) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 text-sm">
      <dt className="text-gray-500 text-xs">{label}</dt>
      <dd className={`font-semibold text-right ${emphasized ? 'text-blue-700' : value ? 'text-gray-900' : 'text-gray-300'}`}>
        {value || '—'}
      </dd>
    </div>
  )
}

function MetricTile({
  label, value, unit, accent,
}: { label: string; value: string | number; unit?: string; accent: string }) {
  return (
    <div className="relative bg-white rounded-xl border border-gray-200 p-3 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-1 leading-none">
        {value}
        {unit && <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}

function SummaryCard({
  icon, iconBg, label, value, extra, footer,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
  extra?: React.ReactNode
  footer: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-md ${iconBg} flex items-center justify-center`}>{icon}</div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {extra}
      </div>
      <div className="text-[11px] text-gray-400 mt-1">{footer}</div>
    </div>
  )
}
