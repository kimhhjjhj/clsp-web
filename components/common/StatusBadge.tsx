'use client'

// ═══════════════════════════════════════════════════════════
// StatusBadge — 프로젝트 라이프사이클 상태 배지
// 크기·강조 변형 지원. 4곳 이상에서 재사용되던 인라인 JSX 대체.
// ═══════════════════════════════════════════════════════════

import { getProjectStatus, STATUS_META, type ProjectStatus } from '@/lib/project-status'

interface ProjectLike {
  latestReportDate?: string | null
  _count?: { dailyReports?: number }
}

type Size = 'xs' | 'sm' | 'md'
type Variant = 'soft' | 'solid' | 'outline'

interface Props {
  /** 프로젝트 객체 — 내부에서 getProjectStatus 호출 */
  project?: ProjectLike
  /** 직접 상태 지정 (project와 둘 중 하나) */
  status?: ProjectStatus
  size?: Size
  variant?: Variant
  /** 도트만 표시 (라벨 숨김) */
  dotOnly?: boolean
  className?: string
}

const SIZE: Record<Size, { padX: string; padY: string; text: string; dot: string; gap: string }> = {
  xs: { padX: 'px-1',    padY: 'py-0',   text: 'text-[9px]',  dot: 'w-1 h-1',       gap: 'gap-0.5' },
  sm: { padX: 'px-1.5',  padY: 'py-0.5', text: 'text-[10px]', dot: 'w-1 h-1',       gap: 'gap-1'   },
  md: { padX: 'px-2',    padY: 'py-0.5', text: 'text-[11px]', dot: 'w-1.5 h-1.5',   gap: 'gap-1.5' },
}

export default function StatusBadge({
  project, status, size = 'sm', variant = 'soft', dotOnly, className = '',
}: Props) {
  const key = status ?? (project ? getProjectStatus(project) : 'planning')
  const info = STATUS_META[key]
  const s = SIZE[size]

  const variantCls =
    variant === 'solid'
      ? `text-white font-bold` // solid는 색 직접 지정
      : variant === 'outline'
        ? `bg-transparent border ${info.border} ${info.text}`
        : `${info.bg} ${info.text}` // soft (기본)

  const style = variant === 'solid' ? { background: info.color } : undefined

  if (dotOnly) {
    return <span className={`inline-block rounded-full flex-shrink-0 ${s.dot} ${info.dot} ${className}`} title={info.label} />
  }

  return (
    <span
      className={`inline-flex items-center ${s.gap} ${s.padX} ${s.padY} rounded ${s.text} font-bold ${variantCls} ${className}`}
      style={style}
    >
      <span className={`rounded-full ${s.dot} ${variant === 'solid' ? 'bg-white' : info.dot}`} />
      {info.label}
    </span>
  )
}
