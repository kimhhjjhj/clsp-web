// 일보 작성 — 상단바 + 5스텝 탭 + 본문 카드
import { SkeletonCard, SkeletonLine } from '@/components/common/LoadingSkeleton'

export default function Loading() {
  return (
    <div className="min-h-full bg-gray-50">
      {/* 상단 바 placeholder */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-8 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-slate-200/70 animate-pulse" />
          <div className="flex-1 space-y-1">
            <SkeletonLine w="w-16" h="h-2.5" />
            <SkeletonLine w="w-40" h="h-4" />
          </div>
          <div className="h-10 w-20 rounded-lg bg-slate-200/70 animate-pulse" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-12 sm:w-24 rounded-lg bg-slate-200/70 animate-pulse" />
          ))}
        </div>
      </div>

      {/* 본문 */}
      <div className="px-4 sm:px-8 py-4 sm:py-6 max-w-6xl space-y-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
      </div>
    </div>
  )
}
