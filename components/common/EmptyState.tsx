'use client'

// ═══════════════════════════════════════════════════════════
// 빈 상태(Empty State) 컴포넌트
// - 데이터 0개일 때 화면 중앙에 안내 + CTA 버튼
// - "다음에 뭐 해야 하지?" 혼란 해소
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

export interface EmptyStateAction {
  label: string
  href?: string             // 링크면 href
  onClick?: () => void      // 버튼이면 onClick
  variant?: 'primary' | 'secondary'
  icon?: React.ReactNode
}

interface Props {
  icon: LucideIcon | React.ReactNode
  title: string
  description?: string
  actions?: EmptyStateAction[]
  compact?: boolean         // 작은 사이즈 (패널 내부)
}

export default function EmptyState({ icon: IconOrElement, title, description, actions, compact }: Props) {
  const pad = compact ? 'py-8' : 'py-16'
  const iconWrap = compact
    ? 'w-12 h-12 bg-gray-100 text-gray-400'
    : 'w-16 h-16 bg-blue-50 text-blue-400'
  const iconSize = compact ? 22 : 28
  const icon = typeof IconOrElement === 'function'
    ? (() => {
        const Comp = IconOrElement as LucideIcon
        return <Comp size={iconSize} />
      })()
    : (IconOrElement as React.ReactNode)

  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 ${pad}`}>
      <div className={`flex items-center justify-center rounded-2xl mb-4 ${iconWrap}`}>
        {icon}
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
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            const content = (
              <span className="inline-flex items-center gap-1.5">
                {a.icon}{a.label}
              </span>
            )
            const common = `${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} rounded-lg font-semibold transition-colors ${cls}`
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
