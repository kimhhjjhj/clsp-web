'use client'

// ═══════════════════════════════════════════════════════════
// 빈 상태(Empty State) 컴포넌트
// - 데이터 0개일 때 화면 중앙에 안내 + CTA 버튼
// - "다음에 뭐 해야 하지?" 혼란 해소
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { createElement, isValidElement, type ComponentType } from 'react'

export interface EmptyStateAction {
  label: string
  href?: string             // 링크면 href
  onClick?: () => void      // 버튼이면 onClick
  variant?: 'primary' | 'secondary'
  icon?: React.ReactNode
}

interface Props {
  icon: ComponentType<{ size?: number; className?: string }> | React.ReactNode
  title: string
  description?: string
  actions?: EmptyStateAction[]
  compact?: boolean
}

function renderIcon(icon: Props['icon'], size: number): React.ReactNode {
  if (!icon) return null
  if (isValidElement(icon)) return icon
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in (icon as object))) {
    return createElement(icon as ComponentType<{ size?: number }>, { size })
  }
  return icon as React.ReactNode
}

export default function EmptyState({ icon: IconOrElement, title, description, actions, compact }: Props) {
  const pad = compact ? 'py-8' : 'py-16'
  const iconSize = compact ? 22 : 28
  const icon = renderIcon(IconOrElement, iconSize)

  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 ${pad}`}>
      {/* 아이콘 — 그라디언트 + 은은한 글로우 */}
      <div className="relative mb-4">
        {!compact && (
          <div
            className="absolute inset-0 blur-2xl opacity-30"
            style={{ background: 'radial-gradient(circle, #60a5fa 0%, transparent 70%)' }}
          />
        )}
        <div
          className={`relative flex items-center justify-center rounded-2xl ${
            compact
              ? 'w-12 h-12 bg-gray-100 text-gray-400'
              : 'w-16 h-16 bg-gradient-to-br from-blue-50 to-violet-50 text-blue-500 shadow-sm border border-blue-100/50'
          }`}
        >
          {icon}
        </div>
      </div>

      <h3 className={`font-bold text-gray-900 ${compact ? 'text-sm' : 'text-lg'}`}>{title}</h3>
      {description && (
        <p className={`text-gray-500 mt-1.5 max-w-md leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
          {description}
        </p>
      )}
      {actions && actions.length > 0 && (
        <div className={`flex items-center gap-2 flex-wrap justify-center ${compact ? 'mt-3' : 'mt-5'}`}>
          {actions.map((a, i) => {
            const isPrimary = (a.variant ?? 'primary') === 'primary'
            const cls = isPrimary
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md hover:-translate-y-0.5'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
            const content = (
              <span className="inline-flex items-center gap-1.5">
                {a.icon}{a.label}
              </span>
            )
            const common = `${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} rounded-lg font-semibold transition-all ${cls}`
            return a.href ? (
              <Link key={i} href={a.href} className={common}>{content}</Link>
            ) : (
              <button key={i} type="button" onClick={a.onClick} className={common}>{content}</button>
            )
          })}
        </div>
      )}
    </div>
  )
}
