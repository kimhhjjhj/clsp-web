'use client'

// ═══════════════════════════════════════════════════════════
// 로딩 스켈레톤 — 레이아웃 그대로의 회색 자리표시자
// 스피너 대신 사용하면 체감 속도 ↑ · CLS 0
// ═══════════════════════════════════════════════════════════

import type { CSSProperties } from 'react'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

export function Skeleton({ className = '', style, rounded = 'md' }: SkeletonProps) {
  const r = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  }[rounded]
  return <div className={`animate-pulse bg-gray-200 ${r} ${className}`} style={style} />
}

// ── 조합 프리셋 ─────────────────────────────────────

// 텍스트 라인 N줄
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-4/6' : 'w-full'}`} />
      ))}
    </div>
  )
}

// 카드 (아바타 + 제목 + 서브)
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-10 h-10" rounded="lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  )
}

// 테이블 (헤더 + N행)
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

// KPI 카드 그리드 (N개)
export function SkeletonKpiGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-2 w-1/3" />
        </div>
      ))}
    </div>
  )
}

// 일보·카드 리스트 (N개 행)
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex items-center gap-3">
          <Skeleton className="w-8 h-8" rounded="lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}
