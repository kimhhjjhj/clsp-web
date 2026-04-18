'use client'

// ═══════════════════════════════════════════════════════════
// 사이드바 '진행 단계' 섹션 — Linear 스타일 플랫 리스트
// 타임라인 dot·체크 제거. 들여쓰기 + 좌측 indent line.
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
  const onEdit = pathname === `/projects/${project.id}/edit`

  const lifecycle = getProjectStatus({
    latestReportDate: status?.stage3.lastReportDate ?? null,
    _count: { dailyReports: status?.stage3.dailyReportCount ?? 0 },
  })
  const info = STATUS_META[lifecycle]

  return (
    <div>
      {/* 프로젝트 이름 — 섹션 리더 */}
      <Link
        href={`/projects/${project.id}`}
        onClick={onNavigate}
        className={`relative flex items-center gap-2 mx-2 px-2.5 h-8 rounded-md no-underline transition-colors ${
          onOverview
            ? 'bg-white/[0.08] text-white'
            : 'text-slate-200 hover:bg-white/[0.04]'
        }`}
      >
        {onOverview && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-400 rounded-r-full" />
        )}
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${info.dot}`} />
        <span className={`flex-1 truncate text-[13px] ${onOverview ? 'font-semibold' : 'font-medium'}`}>
          {project.name}
        </span>
      </Link>

      {/* 단계 리스트 — 좌측 indent line */}
      <div className="relative mx-2 mt-0.5 pl-[18px]">
        <div className="absolute left-[10px] top-1 bottom-1 w-px bg-white/[0.08]" aria-hidden />
        <div className="space-y-px">
          {STAGES.map(st => {
            const s = computeState(status, st.urlN)
            const isActive = activeStage === st.urlN
            return (
              <Link
                key={st.urlN}
                href={`/projects/${project.id}/stage/${st.urlN}`}
                onClick={onNavigate}
                className={`relative flex items-center gap-2 px-2 h-7 rounded-md text-[12px] no-underline transition-colors ${
                  isActive
                    ? 'bg-white/[0.08] text-white font-medium'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                }`}
              >
                <span className="flex-1 truncate">{st.label}</span>
                {s === 'done' && (
                  <Check size={11} strokeWidth={2.5} className="text-slate-300 flex-shrink-0" />
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* 설정 */}
      <Link
        href={`/projects/${project.id}/edit`}
        onClick={onNavigate}
        className={`relative flex items-center gap-2 mx-2 mt-0.5 px-2.5 h-7 rounded-md text-[12px] no-underline transition-colors ${
          onEdit
            ? 'bg-white/[0.08] text-white font-medium'
            : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'
        }`}
      >
        {onEdit && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-400 rounded-r-full" />
        )}
        <Settings size={11} strokeWidth={1.75} className="flex-shrink-0" />
        <span className="flex-1 truncate">프로젝트 설정</span>
      </Link>
    </div>
  )
}
