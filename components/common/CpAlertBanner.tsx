'use client'

// CP 공종 조기 경보 배너 — 프로젝트 상세 페이지 상단에 배치
// /api/projects/:id/cp-alert 호출 후 alert 있을 때만 렌더

import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Zap, Clock, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface Alert {
  taskName: string
  taskCategory: string
  plannedStart: string | null
  plannedFinish: string | null
  daysPastStart: number
  daysPastFinish: number
  severity: 'high' | 'medium' | 'low'
  message: string
  relatedTrades: string[]
  observedManDays: number
}

interface Summary {
  hasStartDate: boolean
  projectStart?: string
  daysSinceStart?: number
  cpTaskCount?: number
  alertCount?: number
  highSeverityCount?: number
}

interface Props {
  projectId: string
}

const SEVERITY_STYLE: Record<Alert['severity'], { bg: string; border: string; badge: string; label: string }> = {
  high:   { bg: 'bg-red-50',   border: 'border-red-300',   badge: 'bg-red-600 text-white',    label: '심각' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-300', badge: 'bg-amber-500 text-white',  label: '주의' },
  low:    { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-500 text-white', label: '경미' },
}

export default function CpAlertBanner({ projectId }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/cp-alert`)
      .then(r => r.json())
      .then(data => {
        setAlerts(data.alerts ?? [])
        setSummary(data.summary ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [projectId])

  if (loading || !summary || alerts.length === 0) return null

  const high = alerts.filter(a => a.severity === 'high').length
  const medium = alerts.filter(a => a.severity === 'medium').length
  const low = alerts.filter(a => a.severity === 'low').length
  const topSeverity: Alert['severity'] = high > 0 ? 'high' : medium > 0 ? 'medium' : 'low'
  const st = SEVERITY_STYLE[topSeverity]

  return (
    <div className={`rounded-xl border ${st.border} ${st.bg} overflow-hidden`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] transition-colors"
      >
        <Zap size={16} className="text-orange-600 flex-shrink-0" />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-bold text-gray-900">
            Critical Path 공종 지연 알림 — <span className="text-red-600">{alerts.length}건</span>
          </p>
          <p className="text-[11px] text-gray-600 mt-0.5">
            {high > 0 && <span className="text-red-700 font-semibold">심각 {high}건</span>}
            {high > 0 && (medium > 0 || low > 0) && ' · '}
            {medium > 0 && <span className="text-amber-700 font-semibold">주의 {medium}건</span>}
            {medium > 0 && low > 0 && ' · '}
            {low > 0 && <span className="text-yellow-700">경미 {low}건</span>}
            <span className="text-gray-400"> · 착공 {summary.daysSinceStart}일차</span>
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${st.badge}`}>
          {st.label}
        </span>
        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-black/5 divide-y divide-black/5 max-h-96 overflow-auto">
          {alerts.map((a, i) => {
            const style = SEVERITY_STYLE[a.severity]
            return (
              <div key={i} className={`px-4 py-2.5 ${style.bg}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={13} className={
                    a.severity === 'high' ? 'text-red-600' :
                    a.severity === 'medium' ? 'text-amber-600' : 'text-yellow-600'
                  } />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{a.taskName}</span>
                      <span className="text-[10px] text-gray-500 bg-white/60 px-1.5 py-0.5 rounded">{a.taskCategory}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.badge}`}>{style.label}</span>
                    </div>
                    <p className="text-xs text-gray-700 mt-1">{a.message}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
                      {a.plannedStart && <span>시작 <strong className="text-gray-700">{a.plannedStart}</strong></span>}
                      {a.plannedFinish && (
                        <>
                          <ArrowRight size={9} />
                          <span>종료 <strong className="text-gray-700">{a.plannedFinish}</strong></span>
                        </>
                      )}
                      {a.observedManDays > 0 && (
                        <span className="text-blue-700 font-mono font-bold">{a.observedManDays} 인일 투입</span>
                      )}
                    </div>
                    {a.relatedTrades.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {a.relatedTrades.slice(0, 5).map(tr => (
                          <span key={tr} className="text-[9px] bg-white/80 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">{tr}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          <div className="px-4 py-2.5 bg-white/50 text-center">
            <Link
              href={`/projects/${projectId}/stage/1`}
              className="text-xs text-blue-600 font-semibold hover:underline no-underline inline-flex items-center gap-1"
            >
              1단계 CPM 재계산 · 만회 대책 검토 <ArrowRight size={10} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
