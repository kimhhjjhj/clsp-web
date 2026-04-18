'use client'

// ═══════════════════════════════════════════════════════════
// PageHeader — 모든 페이지 상단 표준 헤더
// - 제목 + 부제 + 우측 액션 + 하단 탭(선택)
// - 페이지별 accent 색상으로 개성 + 일관성 동시에
// ═══════════════════════════════════════════════════════════

import { createElement, isValidElement, type ComponentType } from 'react'

type AccentKey = 'blue' | 'emerald' | 'orange' | 'violet' | 'slate' | 'amber' | 'pink'

interface Props {
  // LucideIcon 타입(컴포넌트 또는 forwardRef 객체) 또는 이미 만들어진 JSX 모두 허용
  icon?: ComponentType<{ size?: number; className?: string }> | React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
  tabs?: React.ReactNode
  stickyTop?: boolean
  /** 아이콘 박스 컬러 테마 (페이지별 개성) */
  accent?: AccentKey
}

// 다크 헤더 전용 accent — 아이콘 박스 배경·글자 색
const ACCENT: Record<AccentKey, { bg: string; text: string; ring: string }> = {
  blue:    { bg: 'bg-blue-500/20',    text: 'text-blue-300',    ring: 'ring-blue-400/30' },
  emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', ring: 'ring-emerald-400/30' },
  orange:  { bg: 'bg-orange-500/20',  text: 'text-orange-300',  ring: 'ring-orange-400/30' },
  violet:  { bg: 'bg-violet-500/20',  text: 'text-violet-300',  ring: 'ring-violet-400/30' },
  slate:   { bg: 'bg-slate-500/20',   text: 'text-slate-200',   ring: 'ring-slate-400/30' },
  amber:   { bg: 'bg-amber-500/20',   text: 'text-amber-300',   ring: 'ring-amber-400/30' },
  pink:    { bg: 'bg-pink-500/20',    text: 'text-pink-300',    ring: 'ring-pink-400/30' },
}

function renderIcon(icon: Props['icon']): React.ReactNode {
  if (!icon) return null
  if (isValidElement(icon)) return icon
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in (icon as object))) {
    return createElement(icon as ComponentType<{ size?: number }>, { size: 18 })
  }
  return icon as React.ReactNode
}

export default function PageHeader({ icon, title, subtitle, actions, tabs, stickyTop = true, accent = 'blue' }: Props) {
  const iconNode = renderIcon(icon)
  const a = ACCENT[accent]
  // JSX로 직접 넘긴 아이콘(예: stage 페이지의 solid 숫자 배지)은
  // accent 래퍼로 이중 감싸지 않고 그대로 렌더
  const isCustomNode = isValidElement(icon)

  return (
    <div
      className={`border-b border-slate-700/50 ${stickyTop ? 'sticky top-0 z-20' : ''}`}
      style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}
    >
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {iconNode && (
            isCustomNode ? (
              <div className="flex-shrink-0">{iconNode}</div>
            ) : (
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${a.bg} ${a.text} flex-shrink-0 ring-1 ${a.ring}`}>
                {iconNode}
              </div>
            )
          )}
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-white truncate tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
      {tabs && (
        <div className="px-4 sm:px-6 border-t border-slate-700/50 overflow-x-auto">
          {tabs}
        </div>
      )}
    </div>
  )
}
