'use client'

// ═══════════════════════════════════════════════════════════
// G8. Multi-signal Anomaly — 프로젝트 상단 배너
//   F1·F4 데이터가 쌓인 프로젝트에 바로 "고위험 공종 N건" 표시.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, X, Loader2 } from 'lucide-react'

interface Signal {
  source: string
  value: number
  weight: number
  contribution: number
  detail?: string
}

interface Anomaly {
  id: string
  subjectId: string
  subjectName: string
  score: number
  severity: 'low' | 'med' | 'high'
  signals: Signal[]
  detectedAt: string
}

const SEVERITY_COLOR = {
  high: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', dot: 'bg-red-500' },
  med:  { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', dot: 'bg-amber-500' },
  low:  { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400' },
}

export default function AnomalyBanner({ projectId }: { projectId: string }) {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/projects/${projectId}/anomaly`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      setAnomalies(j.anomalies ?? [])
    } catch {
      setAnomalies([])
    } finally { setLoading(false) }
  }, [projectId])

  const recompute = useCallback(async () => {
    setRecomputing(true)
    try {
      await fetch(`/api/projects/${projectId}/anomaly`, { method: 'POST' })
      await load()
    } finally { setRecomputing(false) }
  }, [projectId, load])

  useEffect(() => { load() }, [load])

  if (dismissed) return null
  if (loading) return null
  if (anomalies.length === 0) return null

  const high = anomalies.filter(a => a.severity === 'high')
  const med  = anomalies.filter(a => a.severity === 'med')
  const low  = anomalies.filter(a => a.severity === 'low')

  const topSeverity: 'low' | 'med' | 'high' =
    high.length > 0 ? 'high' : med.length > 0 ? 'med' : 'low'
  const style = SEVERITY_COLOR[topSeverity]

  const visible = expanded ? anomalies : anomalies.slice(0, 5)

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} overflow-hidden mb-3`}>
      {/* 헤더 */}
      <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <AlertTriangle size={14} className={style.text} />
        <span className="text-sm font-bold text-slate-900">
          주의 공종 <span className={`tabular-nums ${style.text}`}>{anomalies.length}</span>건
        </span>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
          {high.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              고위험 <strong className="text-red-700 tabular-nums">{high.length}</strong>
            </span>
          )}
          {med.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              중위험 <strong className="text-amber-700 tabular-nums">{med.length}</strong>
            </span>
          )}
          {low.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              저위험 <strong className="text-slate-600 tabular-nums">{low.length}</strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={recompute}
            disabled={recomputing}
            title="재탐지 (최근 스냅샷·관측 기반 재계산)"
            className="p-1 rounded hover:bg-white/50 text-slate-500 hover:text-slate-800 disabled:opacity-50"
          >
            {recomputing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1 rounded hover:bg-white/50 text-slate-500 hover:text-slate-800"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            onClick={() => setDismissed(true)}
            title="이 세션에서 숨기기"
            className="p-1 rounded hover:bg-white/50 text-slate-400 hover:text-slate-700"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* 리스트 */}
      <div className="border-t border-slate-200/60 bg-white">
        <ul className="divide-y divide-slate-100">
          {visible.map(a => {
            const sev = SEVERITY_COLOR[a.severity]
            return (
              <li key={a.id} className="px-4 py-2 flex items-start gap-2">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${sev.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 truncate">{a.subjectName}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${sev.border} ${sev.text} ${sev.bg}`}>
                      {a.severity === 'high' ? '고위험' : a.severity === 'med' ? '중위험' : '저위험'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap gap-x-2">
                    {a.signals.slice(0, 4).map((s, i) => (
                      s.detail && (
                        <span key={i} className="inline-flex items-center gap-0.5">
                          <span className="text-slate-400">·</span> {s.detail}
                        </span>
                      )
                    ))}
                  </div>
                </div>
                <span className="font-mono font-bold tabular-nums text-slate-700 text-sm">
                  {a.score}
                </span>
              </li>
            )
          })}
        </ul>
        {anomalies.length > 5 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full py-1.5 text-[11px] text-slate-500 hover:text-slate-800 bg-slate-50 border-t border-slate-100"
          >
            + {anomalies.length - 5}개 더 보기
          </button>
        )}
      </div>
    </div>
  )
}
