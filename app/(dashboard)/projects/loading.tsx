// 프로젝트 목록 — 카드 grid 스켈레톤
import { SkeletonCard, SkeletonLine } from '@/components/common/LoadingSkeleton'

export default function Loading() {
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <SkeletonLine w="w-32" h="h-9" />
        <SkeletonLine w="w-24" h="h-9" />
        <SkeletonLine w="w-full sm:w-64" h="h-10" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} lines={3} />
        ))}
      </div>
    </div>
  )
}
