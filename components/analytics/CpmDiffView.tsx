'use client'

// ═══════════════════════════════════════════════════════════
// F1. CPM 스냅샷 diff 시각화
// ═══════════════════════════════════════════════════════════

import { TrendingUp, TrendingDown, Plus, Minus, AlertTriangle } from 'lucide-react'

export interface SnapshotDiff {
  from: { id: string; capturedAt: string; totalDuration: number }
  to:   { id: string; capturedAt: string; totalDuration: number }
  durationDelta: number
  addedCritical:   { taskId: string; name: string }[]
  removedCritical: { taskId: string; name: string }[]
  shiftedTasks: {
    taskId: string; name: string
    oldES: number; newES: number; deltaES: number
    oldDuration: number; newDuration: number; deltaDuration: number
  }[]
  addedTasks:   { taskId: string; name: string }[]
  removedTasks: { taskId: string; name: string }[]
}

export default function CpmDiffView({ diff }: { diff: SnapshotDiff }) {
  const d = diff.durationDelta
  const isInc = d > 0
  const isDec = d < 0
  const fmtDate = (iso: string) => new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="space-y-3">
      {/* 총공기 변동 요약 */}
      <div className={`rounded-xl p-4 border ${
        isInc ? 'bg-red-50 border-red-200' : isDec ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 mb-1">
              {fmtDate(diff.from.capturedAt)} <span className="mx-1">→</span> {fmtDate(diff.to.capturedAt)}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl font-bold tabular-nums text-slate-900">
                {Math.round(diff.from.totalDuration / 30)}
                <span className="text-sm text-slate-400 ml-1">개월</span>
                <span className="text-[11px] text-slate-400 ml-1">({diff.from.totalDuration}일)</span>
              </span>
              <span className="text-slate-400">→</span>
              <span className="text-2xl font-bold tabular-nums text-slate-900">
                {Math.round(diff.to.totalDuration / 30)}
                <span className="text-sm text-slate-400 ml-1">개월</span>
                <span className="text-[11px] text-slate-400 ml-1">({diff.to.totalDuration}일)</span>
              </span>
            </div>
          </div>
          <div className={`text-right ${isInc ? 'text-red-600' : isDec ? 'text-emerald-600' : 'text-slate-500'}`}>
            {isInc && <TrendingUp size={24} className="ml-auto" />}
            {isDec && <TrendingDown size={24} className="ml-auto" />}
            <div className="text-2xl font-bold tabular-nums">
              {d > 0 ? `+${d}` : d}
              <span className="text-sm font-normal ml-1">일</span>
            </div>
          </div>
        </div>
      </div>

      {/* 크리티컬 패스 변동 */}
      {(diff.addedCritical.length > 0 || diff.removedCritical.length > 0) && (
        <div className="rounded-xl bg-white border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-orange-500" />
            <h4 className="text-sm font-semibold text-slate-800">크리티컬 패스 변동</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {diff.addedCritical.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-red-600 mb-1 flex items-center gap-1">
                  <Plus size={11} /> 새로 CP에 진입 ({diff.addedCritical.length})
                </div>
                <ul className="text-xs text-slate-700 space-y-0.5">
                  {diff.addedCritical.map(t => (
                    <li key={t.taskId} className="pl-3 border-l-2 border-red-300">{t.name}</li>
                  ))}
                </ul>
              </div>
            )}
            {diff.removedCritical.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-emerald-600 mb-1 flex items-center gap-1">
                  <Minus size={11} /> CP에서 빠짐 ({diff.removedCritical.length})
                </div>
                <ul className="text-xs text-slate-700 space-y-0.5">
                  {diff.removedCritical.map(t => (
                    <li key={t.taskId} className="pl-3 border-l-2 border-emerald-300">{t.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 이동한 공종 TOP 20 */}
      {diff.shiftedTasks.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-800">
            이동·변경된 공종 TOP 20 <span className="text-xs font-normal text-slate-400">(총 {diff.shiftedTasks.length}개)</span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-[10px] text-slate-500 uppercase">
                <th className="text-left px-3 py-2">공종</th>
                <th className="text-right px-2 py-2">ES 변화</th>
                <th className="text-right px-2 py-2">기간 변화</th>
              </tr>
            </thead>
            <tbody>
              {diff.shiftedTasks.slice(0, 20).map(t => (
                <tr key={t.taskId} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 text-slate-700">{t.name}</td>
                  <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${
                    t.deltaES > 0 ? 'text-red-600' : t.deltaES < 0 ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {t.oldES.toFixed(0)} → {t.newES.toFixed(0)}
                    <span className="ml-1">({t.deltaES > 0 ? '+' : ''}{t.deltaES.toFixed(1)})</span>
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${
                    t.deltaDuration > 0 ? 'text-red-600' : t.deltaDuration < 0 ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {t.oldDuration.toFixed(0)} → {t.newDuration.toFixed(0)}
                    <span className="ml-1">({t.deltaDuration > 0 ? '+' : ''}{t.deltaDuration.toFixed(1)})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 추가·제거 공종 */}
      {(diff.addedTasks.length > 0 || diff.removedTasks.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {diff.addedTasks.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="font-semibold text-blue-600 mb-1 flex items-center gap-1">
                <Plus size={11} /> 추가된 공종 ({diff.addedTasks.length})
              </div>
              <ul className="space-y-0.5 text-slate-700 max-h-40 overflow-y-auto">
                {diff.addedTasks.map(t => <li key={t.taskId}>{t.name}</li>)}
              </ul>
            </div>
          )}
          {diff.removedTasks.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Minus size={11} /> 제거된 공종 ({diff.removedTasks.length})
              </div>
              <ul className="space-y-0.5 text-slate-700 max-h-40 overflow-y-auto">
                {diff.removedTasks.map(t => <li key={t.taskId}>{t.name}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
