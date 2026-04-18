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

const ACCENT: Record<AccentKey, { bg: string; text: string; ring: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    ring: 'ring-blue-100/60' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100/60' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-600',  ring: 'ring-orange-100/60' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  ring: 'ring-violet-100/60' },
  slate:   { bg: 'bg-slate-100',  text: 'text-slate-700',   ring: 'ring-slate-200/60' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   ring: 'ring-amber-100/60' },
  pink:    { bg: 'bg-pink-50',    text: 'text-pink-600',    ring: 'ring-pink-100/60' },
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

  return (
    <div className={`bg-white/95 backdrop-blur-sm border-b border-gray-200 ${stickyTop ? 'sticky top-0 z-20' : ''}`}>
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {iconNode && (
            <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${a.bg} ${a.text} flex-shrink-0 ring-1 ${a.ring} shadow-sm`}>
              {iconNode}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-gray-500 truncate mt-0.5">{subtitle}</p>
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
        <div className="px-4 sm:px-6 border-t border-gray-100 overflow-x-auto">
          {tabs}
        </div>
      )}
    </div>
  )
}
