'use client'

// ═══════════════════════════════════════════════════════════
// MobileNotice — 데스크톱 권장 페이지(CPM Gantt, 프로세스맵,
// 엑셀 임포트 등)에서 모바일 화면일 때만 표시되는 배너.
// md(≥768px) 이상에서는 숨김.
// ═══════════════════════════════════════════════════════════

import { Monitor, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Props {
  /** 어떤 기능이라 데스크톱 권장인지 한 줄 설명 */
  feature: string
  /** 추가 설명 (선택) */
  hint?: string
  /** 로컬스토리지 키. 닫힘 상태 세션 기억용. 생략하면 매번 표시 */
  dismissKey?: string
}

export default function MobileNotice({ feature, hint, dismissKey }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (dismissKey) {
      try {
        if (sessionStorage.getItem(`mobileNotice:${dismissKey}`) === '1') {
          setDismissed(true)
        }
      } catch {}
    }
  }, [dismissKey])

  if (!mounted || dismissed) return null

  function handleDismiss() {
    setDismissed(true)
    if (dismissKey) {
      try { sessionStorage.setItem(`mobileNotice:${dismissKey}`, '1') } catch {}
    }
  }

  return (
    <div className="md:hidden mx-3 mt-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3">
      <Monitor size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-xs text-amber-900 leading-relaxed">
        <p className="font-semibold">데스크톱에서 보는 걸 권장</p>
        <p className="mt-0.5 text-amber-800">{feature}</p>
        {hint && <p className="mt-1 text-[11px] text-amber-700">{hint}</p>}
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 -mt-1 -mr-1 text-amber-600 hover:text-amber-900"
        aria-label="배너 닫기"
      >
        <X size={14} />
      </button>
    </div>
  )
}
