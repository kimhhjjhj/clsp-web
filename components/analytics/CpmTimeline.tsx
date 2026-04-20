'use client'

// ═══════════════════════════════════════════════════════════
// F1. CPM Intelligence Timeline
//   스냅샷 히스토리 + 두 스냅샷 선택 시 diff 표시
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, useMemo } from 'react'
import { Clock, GitBranch, Loader2, AlertCircle, ChevronRight, ArrowLeftRight } from 'lucide-react'
import CpmDiffView, { type SnapshotDiff } from './CpmDiffView'
import CommentThread from '@/components/collab/CommentThread'

interface Snapshot {
  id: string
  capturedAt: string
  totalDuration: number
  triggerEvent: string
  triggerRef?: string | null
  note?: string | null
  criticalCount: number
}

const TRIGGER_LABEL: Record<string, string> = {
  'manual': '수동 재계산',
  'daily-report': '일보 등록',
  'wbs-edit': 'WBS 편집',
  'initial': '최초 계산',
  'bid-estimate': '개략 견적',
}

const TRIGGER_COLOR: Record<string, string> = {
  'manual': 'bg-blue-100 text-blue-700 border-blue-200',
  'daily-report': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'wbs-edit': 'bg-purple-100 text-purple-700 border-purple-200',
  'initial': 'bg-slate-100 text-slate-700 border-slate-200',
  'bid-estimate': 'bg-amber-100 text-amber-700 border-amber-200',
}

export default function CpmTimeline({ projectId }: { projectId: string }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snapshotting, setSnapshotting] = useState(false)
  // diff 선택
  const [selFrom, setSelFrom] = useState<string | null>(null)
  const [selTo, setSelTo]     = useState<string | null>(null)
  const [diff, setDiff]       = useState<SnapshotDiff | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  async function reload() {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/projects/${projectId}/cpm-snapshots`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const json = await r.json()
      setSnapshots(json.snapshots ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '스냅샷 로드 실패')
    } finally { setLoading(false) }
  }

  useEffect(() => { reload() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId])

  async function createSnapshot() {
    setSnapshotting(true); setError(null)
    try {
      const r = await fetch(`/api/projects/${projectId}/cpm-snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${r.status}`)
      }
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '스냅샷 생성 실패')
    } finally { setSnapshotting(false) }
  }

  async function loadDiff() {
    if (!selFrom || !selTo || selFrom === selTo) return
    setDiffLoading(true); setDiff(null)
    try {
      const r = await fetch(`/api/projects/${projectId}/cpm-snapshots/diff?from=${selFrom}&to=${selTo}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const json = await r.json()
      setDiff(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'diff 로드 실패')
    } finally { setDiffLoading(false) }
  }

  useEffect(() => {
    if (selFrom && selTo && selFrom !== selTo) loadDiff()
    else setDiff(null)
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [selFrom, selTo])

  const sortedDesc = useMemo(() => [...snapshots].sort((a, b) =>
    new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()), [snapshots])

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch size={16} className="text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-800">CPM 스냅샷 타임라인</h3>
          <span className="text-[11px] text-slate-400">총 {snapshots.length}건</span>
        </div>
        <button
          onClick={createSnapshot}
          disabled={snapshotting || loading}
          className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1"
        >
          {snapshotting ? <Loader2 size={12} className="animate-spin" /> : <Clock size={12} />}
          현재 상태 스냅샷
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* 타임라인 */}
      {loading ? (
        <div className="p-6 text-center text-xs text-slate-400">
          <Loader2 size={14} className="animate-spin mx-auto mb-2" />
          스냅샷 히스토리 로드 중...
        </div>
      ) : sortedDesc.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
          아직 저장된 스냅샷이 없습니다. &ldquo;현재 상태 스냅샷&rdquo;을 눌러 기준점을 만드세요.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-xs text-slate-500">
                <th className="text-left px-3 py-2 font-semibold w-10">From</th>
                <th className="text-left px-3 py-2 font-semibold w-10">To</th>
                <th className="text-left px-3 py-2 font-semibold">일시</th>
                <th className="text-left px-3 py-2 font-semibold">트리거</th>
                <th className="text-right px-3 py-2 font-semibold">총공기</th>
                <th className="text-center px-3 py-2 font-semibold">CP</th>
                <th className="text-left px-3 py-2 font-semibold">메모</th>
              </tr>
            </thead>
            <tbody>
              {sortedDesc.map((s, i) => {
                const prev = sortedDesc[i + 1]
                const delta = prev ? s.totalDuration - prev.totalDuration : null
                const trig = TRIGGER_LABEL[s.triggerEvent] ?? s.triggerEvent
                const color = TRIGGER_COLOR[s.triggerEvent] ?? 'bg-slate-100 text-slate-700 border-slate-200'
                return (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2 text-center">
                      <input
                        type="radio"
                        name="diff-from"
                        checked={selFrom === s.id}
                        onChange={() => setSelFrom(s.id)}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="radio"
                        name="diff-to"
                        checked={selTo === s.id}
                        onChange={() => setSelTo(s.id)}
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap font-mono">
                      {new Date(s.capturedAt).toLocaleString('ko-KR', {
                        year: '2-digit', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${color}`}>
                        {trig}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-mono">
                      <span className="font-bold text-slate-800">{s.totalDuration}</span>
                      <span className="text-xs text-slate-400 ml-1">일</span>
                      {delta !== null && delta !== 0 && (
                        <span className={`text-[10px] font-semibold ml-1.5 ${
                          delta > 0 ? 'text-red-600' : 'text-emerald-600'
                        }`}>
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-orange-600 font-mono">
                      {s.criticalCount}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[180px]">
                      {s.note ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Diff 컨트롤 */}
      {sortedDesc.length >= 2 && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ArrowLeftRight size={13} />
          두 스냅샷의 From/To 라디오를 선택하면 아래에 변동 내역이 표시됩니다.
          {selFrom && selTo && selFrom === selTo && (
            <span className="text-amber-600 font-semibold">(From과 To가 같습니다)</span>
          )}
          {selFrom && !selTo && <span className="text-slate-400">To를 선택하세요 <ChevronRight size={12} className="inline" /></span>}
        </div>
      )}

      {/* Diff 결과 */}
      {diffLoading && (
        <div className="p-6 text-center text-xs text-slate-400">
          <Loader2 size={14} className="animate-spin mx-auto mb-2" /> 변동 분석 중...
        </div>
      )}
      {diff && !diffLoading && (
        <>
          <CpmDiffView diff={diff} />
          {/* 이 diff에 대한 협업 토론 */}
          <CommentThread
            entityType="cpm-diff"
            entityId={`${diff.from.id}_${diff.to.id}`}
            title="이 변동에 대한 의견"
          />
        </>
      )}
    </div>
  )
}
