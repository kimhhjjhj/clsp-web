// 프로젝트 허브 — hero + 단계 카드 3개
import { SkeletonHero, SkeletonCard } from '@/components/common/LoadingSkeleton'

export default function Loading() {
  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl">
      <SkeletonHero />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    </div>
  )
}
