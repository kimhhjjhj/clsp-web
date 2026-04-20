// /bid 전용 스켈레톤 — 좌(입력폼) · 우(결과) 2컬럼 구조 모사
import { SkeletonCard, SkeletonHero, SkeletonLine } from '@/components/common/LoadingSkeleton'

export default function Loading() {
  return (
    <div className="flex-1 p-4 sm:p-6 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 좌측 입력 폼 */}
        <div className="lg:col-span-1 space-y-4">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>

        {/* 우측 결과 */}
        <div className="lg:col-span-2 space-y-5">
          {/* 탭 placeholder */}
          <div className="flex gap-2">
            <SkeletonLine w="w-24" h="h-9" />
            <SkeletonLine w="w-24" h="h-9" />
          </div>
          <SkeletonHero />
          <SkeletonCard lines={6} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    </div>
  )
}
