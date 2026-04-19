'use client'

// ═══════════════════════════════════════════════════════════
// StageTabs — 단계 페이지 공통 탭 네비 + 요약 바 래퍼
//
// 원칙:
// - 한 화면에 섹션 전부 나열 금지 → 탭 하나씩 노출
// - 비활성 탭은 DOM에서 제거 (lazy)
// - URL ?tab= 유지, 새로고침·깊은 링크 OK
// - 상단 요약 바는 항상 sticky
// ═══════════════════════════════════════════════════════════

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { type ReactNode, useCallback } from 'react'

export interface StageTabDef<T extends string> {
  id: T
  label: string
  icon?: ReactNode
  badge?: number | string | null  // 우측 작은 숫자 (건수 등)
  hint?: string                   // tooltip / 보조 설명
}

interface Props<T extends string> {
  tabs: StageTabDef<T>[]
  current: T
  onChange: (next: T) => void
  queryKey?: string  // URL 쿼리 파라미터 이름 (기본 'tab')
}

export function StageTabs<T extends string>({
  tabs, current, onChange, queryKey = 'tab',
}: Props<T>) {
  const router = useRouter()
  const pathname = usePathname() ?? '/'
  const searchParams = useSearchParams()

  const handleChange = useCallback((id: T) => {
    onChange(id)
    const p = new URLSearchParams(searchParams?.toString() ?? '')
    p.set(queryKey, id)
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }, [onChange, router, pathname, queryKey, searchParams])

  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
      <div className="flex items-center gap-0.5 overflow-x-auto px-3 py-2 -mx-px">
        {tabs.map(t => {
          const active = t.id === current
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleChange(t.id)}
              title={t.hint}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-md whitespace-nowrap text-xs sm:text-sm font-semibold transition-colors ${
                active
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge != null && t.badge !== '' && t.badge !== 0 && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  active ? 'bg-white/20' : 'bg-gray-200 text-gray-600'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// 상단 요약 바 — 작은 숫자 카드를 한 줄로
export function SummaryStrip({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 sm:gap-3 overflow-x-auto px-4 sm:px-6 py-3 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
      {children}
    </div>
  )
}

export function SummaryStat({
  label, value, sub, accent,
}: { label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div
      className="flex-shrink-0 min-w-[110px] sm:min-w-[140px] px-3 py-2 border border-gray-200 bg-white rounded-lg relative"
      style={accent ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}
    >
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-base sm:text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</div>}
    </div>
  )
}
