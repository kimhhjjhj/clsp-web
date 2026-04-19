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

// 2026 라이트 헤더 — 아이콘 박스 그라데이션 배경
const ACCENT: Record<AccentKey, { bg: string; text: string; ring: string; glow: string }> = {
  blue:    { bg: 'bg-gradient-to-br from-blue-400 to-indigo-500',    text: 'text-white', ring: 'ring-blue-500/10',    glow: 'shadow-[0_4px_14px_-4px_rgba(59,130,246,0.6)]' },
  emerald: { bg: 'bg-gradient-to-br from-emerald-400 to-teal-500',   text: 'text-white', ring: 'ring-emerald-500/10', glow: 'shadow-[0_4px_14px_-4px_rgba(16,185,129,0.6)]' },
  orange:  { bg: 'bg-gradient-to-br from-orange-400 to-rose-500',    text: 'text-white', ring: 'ring-orange-500/10',  glow: 'shadow-[0_4px_14px_-4px_rgba(249,115,22,0.6)]' },
  violet:  { bg: 'bg-gradient-to-br from-violet-400 to-fuchsia-500', text: 'text-white', ring: 'ring-violet-500/10',  glow: 'shadow-[0_4px_14px_-4px_rgba(139,92,246,0.6)]' },
  slate:   { bg: 'bg-gradient-to-br from-slate-500 to-slate-700',    text: 'text-white', ring: 'ring-slate-500/10',   glow: 'shadow-[0_4px_14px_-4px_rgba(100,116,139,0.5)]' },
  amber:   { bg: 'bg-gradient-to-br from-amber-400 to-orange-500',   text: 'text-white', ring: 'ring-amber-500/10',   glow: 'shadow-[0_4px_14px_-4px_rgba(245,158,11,0.6)]' },
  pink:    { bg: 'bg-gradient-to-br from-pink-400 to-rose-500',      text: 'text-white', ring: 'ring-pink-500/10',    glow: 'shadow-[0_4px_14px_-4px_rgba(236,72,153,0.6)]' },
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
      className={`${stickyTop ? 'sticky top-0 z-20' : ''} border-b border-slate-200/60`}
      style={{
        background: `
          linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%)
        `,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {iconNode && (
            isCustomNode ? (
              <div className="flex-shrink-0">{iconNode}</div>
            ) : (
              <div className={`flex items-center justify-center w-11 h-11 rounded-2xl ${a.bg} ${a.text} flex-shrink-0 ring-1 ${a.ring} ${a.glow}`}>
                {iconNode}
              </div>
            )
          )}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 truncate tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5 font-medium">{subtitle}</p>
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
        <div className="px-4 sm:px-6 border-t border-slate-200/60 overflow-x-auto">
          {tabs}
        </div>
      )}
    </div>
  )
}
