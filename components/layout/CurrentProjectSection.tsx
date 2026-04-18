'use client'

// ═══════════════════════════════════════════════════════════
// 사이드바 '현재 프로젝트' — 타임라인 스타일
// - 프로젝트 선택됐을 때만 표시
// - 3단계를 수직 타임라인으로 (숫자 박스 X → dot + 연결선)
// - 상태별 dot 채움·크기·애니메이션으로 단계 진행도 표현
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, Check } from 'lucide-react'
import { getProjectStatus, STATUS_META } from '@/lib/project-status'

interface StageStatus {
  stage1: { hasCpm: boolean; totalDuration: number | null; taskCount: number }
  stage2: { riskCount: number; opportunityCount: number; hasBaseline: boolean; baselineTaskCount: number }
  stage3: { latestRate: number | null; dailyReportCount: number; lastReportDate?: string | null }
  stage4: { weeklyReportCount: number }
}

type State = 'done' | 'active' | 'pending'

interface ProjectLite {
  id: string
  name: string
  type?: string
}

// 단계별 정의 — URL은 기존 2/3/4 유지, 표시는 1~3 타임라인
const STAGES: { urlN: number; label: string; color: string }[] = [
  { urlN: 2, label: '프리콘',    color: '#10b981' }, // emerald-500
  { urlN: 3, label: '시공 관리', color: '#f97316' }, // orange-500
  { urlN: 4, label: '분석·준공', color: '#a855f7' }, // purple-500
]

function computeState(status: StageStatus | null, n: number): State {
  if (!status) return 'pending'
  if (n === 2) {
    const hasRisk = status.stage2.riskCount > 0 || status.stage2.opportunityCount > 0
    const hasBaseline = status.stage2.hasBaseline
    if (hasRisk && hasBaseline) return 'done'
    if (hasRisk || hasBaseline) return 'active'
    return 'pending'
  }
  if (n === 3) {
    const cnt = status.stage3.dailyReportCount
    if (cnt > 50) return 'done'
    if (cnt > 0) return 'active'
    return 'pending'
  }
  if (n === 4) {
    return status.stage4.weeklyReportCount > 0 ? 'done' : 'pending'
  }
  return 'pending'
}

interface Props {
  project: ProjectLite
  onNavigate?: () => void
}

export default function CurrentProjectSection({ project, onNavigate }: Props) {
  const pathname = usePathname() ?? ''
  const [status, setStatus] = useState<StageStatus | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${project.id}/stage-status`)
      .then(r => r.ok ? r.json() : null)
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [project.id])

  const activeStageMatch = pathname.match(/\/projects\/[^/]+\/stage\/(\d)/)
  const activeStage = activeStageMatch ? Number(activeStageMatch[1]) : null
  const onOverview = pathname === `/projects/${project.id}`

  const lifecycle = getProjectStatus({
    latestReportDate: status?.stage3.lastReportDate ?? null,
    _count: { dailyReports: status?.stage3.dailyReportCount ?? 0 },
  })
  const info = STATUS_META[lifecycle]

  // 진행도: done인 단계 / 전체
  const doneCount = STAGES.filter(s => computeState(status, s.urlN) === 'done').length
  const progressPct = Math.round((doneCount / STAGES.length) * 100)

  return (
    <div className="mx-2">
      {/* 프로젝트 요약 카드 */}
      <Link
        href={`/projects/${project.id}`}
        onClick={onNavigate}
        className={`block rounded-lg px-3 py-2.5 mb-2 no-underline transition-all ${
          onOverview
            ? 'bg-white/10 ring-1 ring-white/15'
            : 'bg-white/[0.04] hover:bg-white/[0.08]'
        }`}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
            style={{ background: info.color }}
          >
            {info.label}
          </span>
          <span className="text-[9px] text-slate-500 font-mono ml-auto">{progressPct}%</span>
        </div>
        <p className="text-[13px] font-bold truncate text-slate-100 leading-tight">
          {project.name}
        </p>
        {/* 가는 진행 바 */}
        <div className="mt-2 h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${STAGES[0].color}, ${STAGES[1].color}, ${STAGES[2].color})`,
            }}
          />
        </div>
      </Link>

      {/* 타임라인 — 단계별 dot + 수직 연결선 */}
      <div className="relative py-1">
        {/* 연결선 (dot들 뒤에) */}
        <div
          className="absolute left-[15px] top-4 bottom-4 w-px bg-gradient-to-b from-white/[0.12] via-white/[0.06] to-white/[0.12]"
          aria-hidden
        />

        <div className="space-y-0.5">
          {STAGES.map(st => {
            const s = computeState(status, st.urlN)
            const isActive = activeStage === st.urlN
            return (
              <Link
                key={st.urlN}
                href={`/projects/${project.id}/stage/${st.urlN}`}
                onClick={onNavigate}
                className={`relative flex items-center gap-3 pl-1 pr-2 h-9 rounded-lg text-[13px] no-underline transition-colors ${
                  isActive
                    ? 'bg-white/[0.08] text-white font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {/* Dot — 상태별 시각화 */}
                <TimelineDot state={s} color={st.color} active={isActive} />
                <span className="flex-1 truncate">{st.label}</span>
                {/* 활성 표시 */}
                {isActive && (
                  <span className="w-1 h-4 rounded-full" style={{ background: st.color }} />
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* 프로젝트 설정 */}
      <Link
        href={`/projects/${project.id}/edit`}
        onClick={onNavigate}
        className="mt-1 flex items-center gap-2 px-3 h-7 rounded-md text-[11px] text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] transition-colors no-underline"
      >
        <Settings size={11} />
        설정
      </Link>
    </div>
  )
}

// ──────────────────────────────────────────────────
// Dot: 단계 상태를 시각적으로 표현
//  done    — 채워진 원 + 체크 마크
//  active  — 링이 강조된 원 + pulse 애니메이션
//  pending — 빈 원 (테두리만)
// ──────────────────────────────────────────────────
function TimelineDot({ state, color, active }: { state: State; color: string; active: boolean }) {
  if (state === 'done') {
    return (
      <span
        className="relative flex items-center justify-center w-[14px] h-[14px] rounded-full flex-shrink-0 ring-[3px] ring-slate-900"
        style={{ background: color }}
      >
        <Check size={8} className="text-white" strokeWidth={3.5} />
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span className="relative w-[14px] h-[14px] flex items-center justify-center flex-shrink-0">
        {/* pulse */}
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: color, opacity: 0.4 }}
        />
        {/* core */}
        <span
          className="relative w-2.5 h-2.5 rounded-full ring-[3px] ring-slate-900"
          style={{ background: color, boxShadow: `0 0 8px ${color}99` }}
        />
      </span>
    )
  }
  // pending
  return (
    <span
      className={`w-[14px] h-[14px] rounded-full flex-shrink-0 border-2 ring-[3px] ring-slate-900 ${
        active ? 'border-slate-300' : 'border-slate-600'
      }`}
    />
  )
}
