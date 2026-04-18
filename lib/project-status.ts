// ═══════════════════════════════════════════════════════════
// 프로젝트 상태 자동 판정
// - 일보 최근 입력일·착공일·일보 수를 종합해서 5단계 분류
// - 사용자가 수동 플래그를 관리하지 않아도 자동으로 분류
// ═══════════════════════════════════════════════════════════

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'archived'

interface ProjectLike {
  startDate?: string | null
  latestReportDate?: string | null
  _count?: { dailyReports?: number }
  lastCpmDuration?: number | null
}

export interface StatusInfo {
  key: ProjectStatus
  label: string
  color: string          // hex
  bg: string             // tailwind class
  border: string
  text: string
  dot: string
  order: number          // 탭 표시 순서
}

export const STATUS_META: Record<ProjectStatus, StatusInfo> = {
  active: {
    key: 'active',
    label: '진행중',
    color: '#16a34a',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    order: 1,
  },
  paused: {
    key: 'paused',
    label: '일시중단',
    color: '#f59e0b',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    order: 2,
  },
  planning: {
    key: 'planning',
    label: '계획중',
    color: '#2563eb',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    order: 3,
  },
  completed: {
    key: 'completed',
    label: '준공',
    color: '#64748b',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    text: 'text-slate-700',
    dot: 'bg-slate-500',
    order: 4,
  },
  archived: {
    key: 'archived',
    label: '보관',
    color: '#94a3b8',
    bg: 'bg-gray-100',
    border: 'border-gray-200',
    text: 'text-gray-600',
    dot: 'bg-gray-400',
    order: 5,
  },
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86400000)
}

/**
 * 규칙 (2026-04 현재):
 * - 일보 0건 + 착공일 미입력/미래     → 계획중
 * - 일보 0건 + 착공일 과거            → 계획중 (데이터 준비 전)
 * - 일보 있음 + 최근 일보 ≤ 30일      → 진행중
 * - 일보 있음 + 최근 일보 31~90일     → 일시중단
 * - 일보 있음 + 최근 일보 > 90일      → 준공
 */
export function getProjectStatus(p: ProjectLike, now: Date = new Date()): ProjectStatus {
  const reportCount = p._count?.dailyReports ?? 0
  const latest = p.latestReportDate ? new Date(p.latestReportDate) : null

  if (reportCount === 0 || !latest || Number.isNaN(latest.getTime())) {
    return 'planning'
  }

  const gap = daysBetween(latest, now)
  if (gap <= 30) return 'active'
  if (gap <= 90) return 'paused'
  return 'completed'
}

export function getStatusInfo(p: ProjectLike, now?: Date): StatusInfo {
  return STATUS_META[getProjectStatus(p, now)]
}

/** "3일 전" / "2개월 전" 등 상대 시간 */
export function formatRelative(dateStr: string | null | undefined, now: Date = new Date()): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '—'
  const days = daysBetween(d, now)
  if (days < 0) return `${Math.abs(days)}일 후`
  if (days === 0) return '오늘'
  if (days < 7) return `${days}일 전`
  if (days < 30) return `${Math.floor(days / 7)}주 전`
  if (days < 365) return `${Math.floor(days / 30)}개월 전`
  return `${Math.floor(days / 365)}년 전`
}
