'use client'

import { Clock, RotateCcw, X } from 'lucide-react'

interface Props {
  savedAt: string           // ISO
  onRestore: () => void
  onDiscard: () => void
  label?: string            // "프로세스맵" / "일보" 등
}

function fmtRelative(iso: string): string {
  try {
    const d = new Date(iso)
    const diff = (Date.now() - d.getTime()) / 1000
    if (diff < 60) return `${Math.round(diff)}초 전`
    if (diff < 3600) return `${Math.round(diff / 60)}분 전`
    if (diff < 86400) return `${Math.round(diff / 3600)}시간 전`
    return d.toLocaleString('ko-KR')
  } catch { return iso }
}

export default function DraftRestoreBanner({ savedAt, onRestore, onDiscard, label = '변경' }: Props) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 text-amber-900">
        <Clock size={14} className="text-amber-600" />
        <span>
          <strong>저장되지 않은 {label}</strong>이 감지됐습니다
          <span className="text-amber-700 text-xs ml-2">({fmtRelative(savedAt)} 자동 보관)</span>
        </span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onRestore}
          className="inline-flex items-center gap-1 px-3 py-1 bg-amber-600 text-white text-xs font-semibold rounded hover:bg-amber-700"
        >
          <RotateCcw size={11} /> 복원
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex items-center gap-1 px-2 py-1 text-amber-700 hover:bg-amber-100 rounded text-xs"
          title="저장된 초안 폐기"
        >
          <X size={12} /> 폐기
        </button>
      </div>
    </div>
  )
}
