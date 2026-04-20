// 모든 대시보드 route 의 공통 fallback — 개별 loading.tsx 가 없으면 이게 표시됨
import { SkeletonCard, SkeletonLine } from '@/components/common/LoadingSkeleton'

export default function Loading() {
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl">
      <div className="space-y-2">
        <SkeletonLine w="w-40" h="h-4" />
        <SkeletonLine w="w-64" h="h-7" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    </div>
  )
}
