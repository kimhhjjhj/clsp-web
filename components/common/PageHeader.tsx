'use client'

// ═══════════════════════════════════════════════════════════
// PageHeader — 모든 페이지 상단 표준 헤더
// - 제목 + 부제 + 우측 액션 + 하단 탭(선택)
// - 페이지 간 시각 일관성 확보
// ═══════════════════════════════════════════════════════════

import { createElement, isValidElement, type ComponentType } from 'react'

interface Props {
  // LucideIcon 타입(컴포넌트 또는 forwardRef 객체) 또는 이미 만들어진 JSX 모두 허용
  icon?: ComponentType<{ size?: number; className?: string }> | React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
  tabs?: React.ReactNode
  stickyTop?: boolean
}

function renderIcon(icon: Props['icon']): React.ReactNode {
  if (!icon) return null
  if (isValidElement(icon)) return icon
  // 컴포넌트 타입 (함수 or forwardRef 객체)
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in (icon as object))) {
    return createElement(icon as ComponentType<{ size?: number }>, { size: 18 })
  }
  return icon as React.ReactNode
}

export default function PageHeader({ icon, title, subtitle, actions, tabs, stickyTop = true }: Props) {
  const iconNode = renderIcon(icon)

  return (
    <div className={`bg-white border-b border-gray-200 ${stickyTop ? 'sticky top-0 z-20' : ''}`}>
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {iconNode && (
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
              {iconNode}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-gray-500 truncate hidden sm:block mt-0.5">{subtitle}</p>
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
