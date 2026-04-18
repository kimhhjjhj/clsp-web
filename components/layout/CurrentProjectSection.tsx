'use client'

// ═══════════════════════════════════════════════════════════
// 사이드바 '진행 단계' 섹션 — 미니멀 타임라인
// - 단계별 색 사용 안 함 (알록달록 X)
// - 상태(done/active/pending)만 단일 톤으로 구분
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

const STAGES: { urlN: number; label: string }[] = [
  { urlN: 2, label: '프리콘' },
  { urlN: 3, label: '시공 관리' },
  { urlN: 4, label: '분석·준공' },
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

  return (
    <div className="mx-2">
      {/* 프로젝트 요약 — 이름 + 상태 텍스트만 */}
      <Link
        href={`/projects/${project.id}`}
        onClick={onNavigate}
        className={`block rounded-lg px-3 py-2 mb-1.5 no-underline transition-colors ${
          onOverview
            ? 'bg-white/10'
            : 'hover:bg-white/[0.05]'
        }`}
      >
        <p className="text-[13px] font-semibold truncate text-white leading-tight">
          {project.name}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
          <span className={`w-1 h-1 rounded-full ${info.dot}`} />
          {info.label}
        </p>
      </Link>

      {/* 타임라인 — 단색 dot */}
      <div className="relative py-0.5">
        {/* 연결선 */}
        <div className="absolute left-[15px] top-5 bottom-5 w-px bg-white/[0.08]" aria-hidden />

        <div className="space-y-0">
          {STAGES.map(st => {
            const s = computeState(status, st.urlN)
            const isActive = activeStage === st.urlN
            return (
              <Link
                key={st.urlN}
                href={`/projects/${project.id}/stage/${st.urlN}`}
                onClick={onNavigate}
                className={`relative flex items-center gap-3 pl-1 pr-2 h-9 rounded-md text-[13px] no-underline transition-colors ${
                  isActive
                    ? 'bg-white/[0.08] text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <TimelineDot state={s} active={isActive} />
                <span className="flex-1 truncate">{st.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* 설정 */}
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
// Dot — 단일 톤, 상태만 구분
//  done    — 채움 + 체크
//  active  — 채움 (현재 보고 있는 단계)
//  pending — 빈 원
// ──────────────────────────────────────────────────
function TimelineDot({ state, active }: { state: State; active: boolean }) {
  const baseRing = 'ring-[3px] ring-slate-900'
  if (state === 'done') {
    return (
      <span className={`relative flex items-center justify-center w-[14px] h-[14px] rounded-full flex-shrink-0 bg-white/70 ${baseRing}`}>
        <Check size={8} className="text-slate-900" strokeWidth={3.5} />
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span className={`w-[14px] h-[14px] rounded-full flex-shrink-0 ${baseRing} bg-white`} />
    )
  }
  return (
    <span className={`w-[14px] h-[14px] rounded-full flex-shrink-0 border border-slate-600 ${baseRing} ${active ? 'bg-slate-600' : 'bg-transparent'}`} />
  )
}
