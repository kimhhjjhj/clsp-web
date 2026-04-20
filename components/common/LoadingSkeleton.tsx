// 공통 스켈레톤 primitives — Next.js loading.tsx 용
// 페이지 코드 다운로드·SSR 중 흰 화면 대신 표시됨

export function SkeletonLine({ w = 'w-full', h = 'h-3' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} rounded bg-slate-200/70 animate-pulse`} />
}

export function SkeletonCard({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 space-y-3 ${className}`}>
      <SkeletonLine w="w-1/3" h="h-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} w={i === lines - 1 ? 'w-2/3' : 'w-full'} />
      ))}
    </div>
  )
}

export function SkeletonHero() {
  return (
    <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 p-6 space-y-3 animate-pulse">
      <div className="h-3 w-32 rounded bg-white/20" />
      <div className="h-10 w-48 rounded bg-white/30" />
      <div className="h-3 w-64 rounded bg-white/15" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 animate-pulse">
      <div className="h-4 w-4 rounded bg-slate-200/70" />
      <div className="h-3 flex-1 rounded bg-slate-200/70" />
      <div className="h-3 w-20 rounded bg-slate-200/70" />
    </div>
  )
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
