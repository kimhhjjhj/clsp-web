'use client'

// ═══════════════════════════════════════════════════════════
// F3. Delay Root-Cause Attribution UI
//   지연 원인별 stacked bar + 공종별 상위 지연 리스트
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, AlertTriangle, CloudRain, Users, Package, Pencil, Link2, Zap, HelpCircle } from 'lucide-react'
import CommentThread from '@/components/collab/CommentThread'

interface Snapshot {
  id: string; capturedAt: string; totalDuration: number; triggerEvent: string
  criticalCount: number
}

interface Attribution {
  projectId: string
  periodFrom: string
  periodTo: string
  totalDelayDays: number
  byCause: Record<string, number>
  byTask: {
    taskId: string; taskName: string; delayDays: number
    causes: { cause: string; days: number }[]
  }[]
  persisted: number
}

const CAUSE_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  weather:        { label: '기상',       color: '#60a5fa', icon: CloudRain },
  manpower:       { label: '자원·인력',  color: '#f97316', icon: Users },
  material:       { label: '자재',       color: '#a78bfa', icon: Package },
  'design-change':{ label: '설계 변경',  color: '#f59e0b', icon: Pencil },
  constraint:     { label: '제약',       color: '#ec4899', icon: Link2 },
  productivity:   { label: '생산성',     color: '#10b981', icon: Zap },
  unknown:        { label: '기타',       color: '#94a3b8', icon: HelpCircle },
}

export default function DelayCauseChart({ projectId }: { projectId: string }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [fromId, setFromId] = useState<string>('')
  const [toId, setToId] = useState<string>('')
  const [result, setResult] = useState<Attribution | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/cpm-snapshots?limit=50`)
      .then(r => r.json()).then(j => {
        const list: Snapshot[] = j.snapshots ?? []
        setSnapshots(list)
        if (list.length >= 2) {
          setFromId(list[list.length - 1].id) // 가장 오래된
          setToId(list[0].id)                 // 가장 최근
        }
      })
      .catch(() => setError('스냅샷 로드 실패'))
  }, [projectId])

  async function rebuild() {
    if (!fromId || !toId || fromId === toId) { setError('서로 다른 From/To 스냅샷을 선택하세요'); return }
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/projects/${projectId}/delay-attributions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromSnapshotId: fromId, toSnapshotId: toId, persist: true }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${r.status}`)
      }
      setResult(await r.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : '계산 실패')
    } finally { setLoading(false) }
  }

  // stacked bar용 총합
  const total = result ? Object.values(result.byCause).reduce((s, v) => s + v, 0) : 0

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-orange-500" />
          <h3 className="text-sm font-semibold text-slate-800">지연 원인 자동 귀속</h3>
          <span className="text-[11px] text-slate-400">CPM 스냅샷 2개 간 변동을 원인별 분해</span>
        </div>
      </div>

      {/* 스냅샷 선택 */}
      {snapshots.length < 2 ? (
        <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
          분석하려면 CPM 스냅샷이 최소 2개 필요합니다. &ldquo;CPM 타임라인&rdquo; 탭에서 스냅샷을 만드세요.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">From</span>
            <select value={fromId} onChange={e => setFromId(e.target.value)}
              className="h-8 px-2 text-xs border border-slate-200 rounded max-w-xs">
              {snapshots.map(s => (
                <option key={s.id} value={s.id}>
                  {new Date(s.capturedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {' · '}{s.totalDuration}일
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">To</span>
            <select value={toId} onChange={e => setToId(e.target.value)}
              className="h-8 px-2 text-xs border border-slate-200 rounded max-w-xs">
              {snapshots.map(s => (
                <option key={s.id} value={s.id}>
                  {new Date(s.capturedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {' · '}{s.totalDuration}일
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={rebuild}
            disabled={loading || !fromId || !toId || fromId === toId}
            className="h-8 px-3 rounded bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            재계산
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      {result && (
        <>
          {/* 총합 + stacked bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-slate-500 mb-0.5">
                  {result.periodFrom} → {result.periodTo}
                </div>
                <div className="text-2xl font-bold text-slate-900 tabular-nums">
                  {result.totalDelayDays} <span className="text-sm font-normal text-slate-500">일 지연</span>
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                공종 {result.byTask.length}개 · 레코드 {result.persisted}건 저장됨
              </div>
            </div>
            {total > 0 && (
              <>
                <div className="w-full h-6 rounded-full overflow-hidden flex bg-slate-100 mb-3">
                  {Object.entries(result.byCause).filter(([, v]) => v > 0).map(([cause, days]) => {
                    const meta = CAUSE_META[cause] ?? CAUSE_META.unknown
                    const pct = (days / total) * 100
                    return (
                      <div key={cause}
                        className="h-full transition-all flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ width: `${pct}%`, background: meta.color }}
                        title={`${meta.label}: ${days.toFixed(1)}일 (${pct.toFixed(0)}%)`}
                      >
                        {pct >= 8 && <span>{meta.label}</span>}
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.byCause).filter(([, v]) => v > 0).map(([cause, days]) => {
                    const meta = CAUSE_META[cause] ?? CAUSE_META.unknown
                    const Icon = meta.icon
                    return (
                      <div key={cause} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs"
                        style={{ borderColor: meta.color + '40', background: meta.color + '10' }}>
                        <Icon size={12} style={{ color: meta.color }} />
                        <span className="font-semibold text-slate-700">{meta.label}</span>
                        <span className="font-mono font-bold tabular-nums" style={{ color: meta.color }}>
                          {days.toFixed(1)}일
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* 공종별 지연 TOP */}
          {result.byTask.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-800">
                공종별 지연 TOP {Math.min(20, result.byTask.length)}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-xs text-slate-500">
                    <th className="text-left px-3 py-2 font-semibold">공종</th>
                    <th className="text-right px-3 py-2 font-semibold">지연</th>
                    <th className="text-left px-3 py-2 font-semibold">원인 분해</th>
                  </tr>
                </thead>
                <tbody>
                  {result.byTask.slice(0, 20).map(t => (
                    <tr key={t.taskId} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-800">{t.taskName}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-orange-600 tabular-nums">
                        +{t.delayDays}일
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {t.causes.map((c, i) => {
                            const meta = CAUSE_META[c.cause] ?? CAUSE_META.unknown
                            return (
                              <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                style={{ background: meta.color + '15', color: meta.color }}>
                                {meta.label} {c.days.toFixed(1)}
                              </span>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            ※ 원인 귀속은 규칙 기반 휴리스틱: 생산성 flagged 매칭 → 50% 할당, 기상 민감 공종 + 비작업일 → 일당 0.5일 할당, 나머지는 &ldquo;기타&rdquo;.
            향후 TaskConstraint/자재/설계변경 이벤트 연결 후 정밀도 향상 예정.
          </p>
          {/* 이 귀속 결과에 대한 협업 토론 */}
          <CommentThread
            entityType="delay-attribution"
            entityId={`${result.projectId}_${result.periodFrom}_${result.periodTo}`}
            title="이 지연 분석에 대한 의견"
          />
        </>
      )}
    </div>
  )
}
