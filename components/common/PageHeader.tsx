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
const ACCENT: Record<AccentKey, { text: string; rgb: string }> = {
  blue:    { text: 'text-blue-300',    rgb: '59, 130, 246' },
  emerald: { text: 'text-emerald-300', rgb: '16, 185, 129' },
  orange:  { text: 'text-orange-300',  rgb: '234, 88, 12' },
  violet:  { text: 'text-violet-300',  rgb: '139, 92, 246' },
  slate:   { text: 'text-slate-200',   rgb: '148, 163, 184' },
  amber:   { text: 'text-amber-300',   rgb: '245, 158, 11' },
  pink:    { text: 'text-pink-300',    rgb: '236, 72, 153' },
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
      className={`relative border-b border-slate-800/60 ${stickyTop ? 'sticky top-0 z-20' : ''}`}
      style={{
        background: 'linear-gradient(180deg, #0f172a 0%, #0b1220 100%)',
        boxShadow: '0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 6px 20px -12px rgba(0, 0, 0, 0.45)',
      }}
    >
      {/* 좌상단 accent 워시 — 다크 톤에 은은한 컬러 글로우 */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 640px 240px at 12% -20%, rgba(${a.rgb}, 0.18), transparent 60%)` }}
      />
      <div className="relative flex items-center justify-between px-4 sm:px-6 py-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {iconNode && (
            isCustomNode ? (
              <div className="flex-shrink-0">{iconNode}</div>
            ) : (
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-xl ${a.text} flex-shrink-0`}
                style={{
                  background: `rgba(${a.rgb}, 0.14)`,
                  border: `1px solid rgba(${a.rgb}, 0.28)`,
                  boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 4px 12px -4px rgba(${a.rgb}, 0.28)`,
                }}
              >
                {iconNode}
              </div>
            )
          )}
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-white truncate tracking-[-0.01em]">{title}</h1>
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="relative z-10 flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
      {tabs && (
        <div className="relative px-4 sm:px-6 border-t border-slate-800/60 overflow-x-auto thin-scroll">
          {tabs}
        </div>
      )}
    </div>
  )
}
