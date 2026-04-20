'use client'

// ═══════════════════════════════════════════════════════════
// 공용 풀스크린 훅·버튼
// 사용: const { fullscreen, toggle } = useFullscreen()
//       <div className={fullscreenClass(fullscreen)}>…
//       <FullscreenToggle fullscreen={fullscreen} onToggle={toggle} />
// Esc로 해제. body 스크롤 잠금.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'

export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (!fullscreen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [fullscreen])

  return { fullscreen, setFullscreen, toggle: () => setFullscreen(v => !v) }
}

/** 컨테이너에 붙일 classname — 풀스크린이면 fixed inset-0 등으로 확장
 *  주의: 호출부 wrapper에 `relative` 같은 position 유틸이 함께 붙어 있을 때
 *  Tailwind 생성 순서상 `.relative`가 `.fixed`보다 뒤라 `.relative`가 이김.
 *  이를 회피하기 위해 `!important` 변형자(`!fixed`, `!inset-0`)를 사용. */
export function fullscreenClass(fullscreen: boolean, baseBg = 'bg-slate-50') {
  return fullscreen
    ? `!fixed !inset-0 !z-50 ${baseBg} !overflow-auto p-3 sm:p-5`
    : ''
}

export function FullscreenToggle({
  fullscreen, onToggle, className, size = 14,
}: {
  fullscreen: boolean
  onToggle: () => void
  className?: string
  size?: number
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={fullscreen ? '전체화면 해제 (Esc)' : '전체화면'}
      aria-label={fullscreen ? '전체화면 해제' : '전체화면'}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white/90 backdrop-blur text-slate-600 hover:text-slate-900 hover:bg-white hover:border-slate-300 transition-colors ${className ?? ''}`}
    >
      {fullscreen ? <Minimize2 size={size} /> : <Maximize2 size={size} />}
    </button>
  )
}
