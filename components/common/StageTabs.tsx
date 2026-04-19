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
    <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-[rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-0.5 overflow-x-auto px-3 pt-1.5 pb-[9px] -mx-px">
        {tabs.map(t => {
          const active = t.id === current
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleChange(t.id)}
              title={t.hint}
              className={`u-tab ${active ? 'u-tab-active' : ''}`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge != null && t.badge !== '' && t.badge !== 0 && (
                <span className={`text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded ${
                  active
                    ? 'bg-slate-900/5 text-slate-900'
                    : 'bg-slate-100 text-slate-500'
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
    <div className="flex gap-2.5 overflow-x-auto px-4 sm:px-6 py-3 bg-white border-b border-[rgba(15,23,42,0.06)]">
      {children}
    </div>
  )
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '15, 23, 42'
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  if ([r, g, b].some(n => Number.isNaN(n))) return '15, 23, 42'
  return `${r}, ${g}, ${b}`
}

export function SummaryStat({
  label, value, sub, accent,
}: { label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  const rgb = accent ? hexToRgb(accent) : '15, 23, 42'
  return (
    <div
      className="relative flex-shrink-0 min-w-[128px] sm:min-w-[148px] px-3.5 py-2.5 rounded-[10px] bg-white overflow-hidden"
      style={{
        border: `1px solid rgba(${rgb}, 0.18)`,
        boxShadow: `0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 16px -10px rgba(${rgb}, 0.22)`,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-10 pointer-events-none"
        style={{ background: `linear-gradient(180deg, rgba(${rgb}, 0.06) 0%, transparent 100%)` }}
      />
      <div className="relative u-stat-label">{label}</div>
      <div className="relative text-[18px] font-semibold text-slate-900 leading-none mt-2 tracking-[-0.02em] tabular-nums">{value}</div>
      {sub && <div className="relative text-[11px] text-slate-500 mt-1.5 truncate">{sub}</div>}
    </div>
  )
}
