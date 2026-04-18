'use client'

// ═══════════════════════════════════════════════════════════
// 사이드바 '현재 프로젝트' 섹션
// - 프로젝트 선택됐을 때만 표시
// - 4단계 직접 이동 링크 + 각 단계 진행 상태 배지
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3, ShieldCheck, HardHat, TrendingUp, Settings, CheckCircle2, Circle, Clock,
} from 'lucide-react'
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

const STAGES: {
  urlN: number      // URL stage/N (DB·링크 호환 유지)
  displayN: number  // 사용자에게 보이는 순서 (1부터)
  label: string
  icon: typeof BarChart3
  color: string
  bg: string
}[] = [
  // 개략공기는 '사업 초기 검토'(/bid)로 이전 → 저장 후 단계는 1~3으로 자연스럽게 표시
  // URL은 기존 2/3/4 유지 (북마크 · 기존 링크 호환)
  { urlN: 2, displayN: 1, label: '프리콘',     icon: ShieldCheck, color: '#16a34a', bg: 'bg-emerald-500' },
  { urlN: 3, displayN: 2, label: '시공 관리',  icon: HardHat,    color: '#ea580c', bg: 'bg-orange-500' },
  { urlN: 4, displayN: 3, label: '분석·준공',  icon: TrendingUp, color: '#7c3aed', bg: 'bg-purple-500' },
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

  return (
    <div className="mt-3">
      {/* 프로젝트 헤더 */}
      <div className="px-2 pb-1 flex items-center gap-1.5">
        <span className="w-1 h-3 bg-blue-500 rounded-full flex-shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
          현재 프로젝트
        </span>
      </div>

      <Link
        href={`/projects/${project.id}`}
        onClick={onNavigate}
        className={`mx-2 mb-1 px-2 py-1.5 flex items-start gap-2 rounded-md no-underline transition-colors ${
          pathname === `/projects/${project.id}` ? 'bg-white/10 text-white' : 'text-slate-200 hover:bg-white/[0.06]'
        }`}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate">{project.name}</p>
          {(() => {
            const lc = getProjectStatus({
              latestReportDate: status?.stage3.lastReportDate ?? null,
              _count: { dailyReports: status?.stage3.dailyReportCount ?? 0 },
            })
            const info = STATUS_META[lc]
            return (
              <span className="inline-flex items-center gap-1 mt-0.5">
                <span className={`w-1 h-1 rounded-full ${info.dot}`} />
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                  {info.label}
                </span>
              </span>
            )
          })()}
        </div>
      </Link>

      {/* 3단계 (표시 1~3, URL은 2~4) */}
      <div className="space-y-0.5">
        {STAGES.map(st => {
          const s = computeState(status, st.urlN)
          const isActive = activeStage === st.urlN
          return (
            <Link
              key={st.urlN}
              href={`/projects/${project.id}/stage/${st.urlN}`}
              onClick={onNavigate}
              className={`group flex items-center gap-2 mx-2 px-2 h-9 rounded-lg text-[13px] transition-colors no-underline ${
                isActive
                  ? 'text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
              style={isActive ? { background: st.color } : undefined}
            >
              <span
                className={`flex items-center justify-center w-5 h-5 rounded flex-shrink-0 text-[10px] font-bold ${
                  isActive ? 'bg-white/25 text-white' : 'bg-white/[0.08]'
                }`}
                style={!isActive ? { color: st.color } : undefined}
              >
                {st.displayN}
              </span>
              <span className="flex-1 truncate">{st.label}</span>
              <StageBadge state={s} active={isActive} />
            </Link>
          )
        })}
      </div>

      {/* 프로젝트 설정 */}
      <Link
        href={`/projects/${project.id}/edit`}
        onClick={onNavigate}
        className="mt-0.5 mx-2 flex items-center gap-2 px-2 h-8 rounded-md text-[11px] text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] transition-colors no-underline"
      >
        <Settings size={11} />
        프로젝트 설정
      </Link>
    </div>
  )
}

function StageBadge({ state, active }: { state: State; active: boolean }) {
  if (state === 'done') {
    return (
      <span className="flex items-center gap-0.5 text-[9px] font-bold flex-shrink-0"
        style={{ color: active ? 'rgba(255,255,255,0.85)' : '#10b981' }}>
        <CheckCircle2 size={10} />
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span className="flex items-center gap-0.5 text-[9px] font-bold flex-shrink-0 animate-pulse"
        style={{ color: active ? 'rgba(255,255,255,0.9)' : '#f59e0b' }}>
        <Clock size={10} />
      </span>
    )
  }
  return (
    <span className="flex items-center flex-shrink-0" style={{ color: active ? 'rgba(255,255,255,0.4)' : '#475569' }}>
      <Circle size={8} />
    </span>
  )
}
