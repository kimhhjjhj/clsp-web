'use client'

// ═══════════════════════════════════════════════════════════
// 유사 프로젝트 기반 공기 추천 패널
//
// 휴리스틱(AI 프리셋·회귀식) 대신 실제 DB 프로젝트 데이터 기반
// 신호. CPM 계산 전에 프로젝트 속성만으로 "유사한 과거 프로젝트들의
// 공기"를 보여줌.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Database, Loader2, AlertTriangle, CheckCircle2, TrendingUp,
  Building2, Calendar, Layers, ExternalLink, RefreshCw,
} from 'lucide-react'
import { formatDuration, splitDurationDisplay, daysToMonths } from '@/lib/utils/format-duration'

export interface SimilarityInput {
  type?: string
  ground?: number
  basement?: number
  lowrise?: number
  bldgArea?: number
  buildingArea?: number
  siteArea?: number
  hasTransfer?: boolean
  constructionMethod?: string | null
  wtBottom?: number
  waBottom?: number
  location?: string
  excludeProjectId?: string
}

interface SimilarProjectMatch {
  id: string
  name: string
  client?: string | null
  type?: string | null
  ground?: number | null
  basement?: number | null
  bldgArea?: number | null
  constructionMethod?: string | null
  hasTransfer: boolean
  location?: string | null
  startDate?: string | null
  actualCompletionDate?: string | null
  actualDuration?: number | null
  lastCpmDuration?: number | null
  similarity: number
  similarityBreakdown: {
    type: number
    area: number
    ground: number
    basement: number
    method: number
    transfer: number
    location: number
  }
  durationSource: 'actual' | 'cpm' | null
  durationUsed: number | null
}

interface DurationRecommendation {
  count: number
  mean: number
  median: number
  min: number
  max: number
  std: number
  confidence: 'low' | 'medium' | 'high'
  actualSampleCount: number
  cpmSampleCount: number
  reasons: string[]
}

interface Response {
  matches: SimilarProjectMatch[]
  recommendation: DurationRecommendation | null
  dataAvailable: boolean
  fallbackMessage: string | null
}

const METHOD_LABEL: Record<string, string> = {
  'bottom_up': '순타',
  'semi_top_down': 'Semi TD',
  'full_top_down': 'Full TD',
  'up_up': 'Up-Up',
}

export default function SimilarProjectsPanel({
  input,
  currentCpmDuration,
}: {
  input: SimilarityInput
  currentCpmDuration?: number  // 현재 프로젝트 CPM값 — 상대 위치 표시용
}) {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/bid/similar-projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setData(await r.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패')
    } finally { setLoading(false) }
  }

  const inputKey = JSON.stringify({
    type: input.type, ground: input.ground, basement: input.basement,
    bldgArea: input.bldgArea, method: input.constructionMethod,
  })
  useEffect(() => {
    if (input.type && (input.ground || input.basement || input.bldgArea)) {
      run()
    }
  }, [inputKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const conf = data?.recommendation?.confidence
  const confMeta = {
    high:   { label: '높음', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' },
    medium: { label: '중간', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-300' },
    low:    { label: '낮음', color: 'text-slate-600',   bg: 'bg-slate-50',   border: 'border-slate-300' },
  }
  const confStyle = conf ? confMeta[conf] : confMeta.low

  // CPM과의 편차 (있을 때)
  const cpmDeviation = useMemo(() => {
    if (!currentCpmDuration || !data?.recommendation) return null
    const r = data.recommendation
    const diff = currentCpmDuration - r.mean
    const pct = r.mean > 0 ? (diff / r.mean) * 100 : 0
    return { diff, pct }
  }, [currentCpmDuration, data?.recommendation])

  return (
    <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 flex items-center gap-2">
        <Database size={16} className="text-blue-600" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900">유사 프로젝트 기반 추천</h3>
          <p className="text-[11px] text-slate-500">휴리스틱 공식이 아닌 실제 DB 샘플 기반 · 데이터 축적 시 정확도 향상</p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="h-7 px-2 rounded border border-blue-200 bg-white hover:bg-blue-50 text-xs text-blue-700 inline-flex items-center gap-1"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          재검색
        </button>
      </div>

      {/* 본문 */}
      <div className="p-4 space-y-3">
        {loading && !data && (
          <div className="py-6 text-center text-xs text-slate-400">
            <Loader2 size={14} className="animate-spin mx-auto mb-2" />
            유사 프로젝트 검색 중...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* fallback: 샘플 0건 */}
        {data && data.matches.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-5 text-center">
            <AlertTriangle size={18} className="mx-auto mb-2 text-amber-500" />
            <p className="text-sm font-semibold text-slate-700 mb-1">유사 프로젝트 없음</p>
            <p className="text-xs text-slate-500">
              {data.fallbackMessage}<br />
              현재는 CPM 결과를 주 기준으로 판단하세요.
            </p>
          </div>
        )}

        {/* 추천값 */}
        {data?.recommendation && (
          <div className={`rounded-lg border ${confStyle.border} ${confStyle.bg} p-4`}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                  유사 프로젝트 기반 추천 공기
                </div>
                {(() => {
                  const d = splitDurationDisplay(data.recommendation.mean)
                  return (
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-slate-900 tabular-nums">
                        {d.main}
                      </span>
                      <span className="text-sm text-slate-500">{d.unit}</span>
                      {d.sub && <span className="text-xs text-slate-400">({d.sub})</span>}
                      <span className="text-xs text-slate-400 ml-2">
                        ± {data.recommendation.std}일
                      </span>
                    </div>
                  )
                })()}
                <div className="text-[11px] text-slate-500 mt-1">
                  중위 {formatDuration(data.recommendation.median)} · 범위 {formatDuration(data.recommendation.min)} ~ {formatDuration(data.recommendation.max)}
                </div>
              </div>
              <div className={`text-right ${confStyle.color}`}>
                {conf === 'high' && <CheckCircle2 size={20} className="ml-auto mb-1" />}
                {conf === 'medium' && <TrendingUp size={20} className="ml-auto mb-1" />}
                {conf === 'low' && <AlertTriangle size={20} className="ml-auto mb-1" />}
                <div className={`text-[11px] font-bold px-2 py-0.5 rounded ${confStyle.bg} ${confStyle.color} border ${confStyle.border}`}>
                  신뢰도 {confStyle.label}
                </div>
              </div>
            </div>

            {/* 편차 표시 (CPM과) */}
            {cpmDeviation && (
              <div className="bg-white/60 rounded border border-slate-200 px-3 py-2 mb-2">
                <div className="text-[11px] text-slate-500 mb-0.5">현재 CPM vs 유사 프로젝트 추천 편차</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-800 tabular-nums">
                    {formatDuration(currentCpmDuration)}
                  </span>
                  <span className="text-slate-400">vs</span>
                  <span className="text-sm font-bold text-slate-800 tabular-nums">
                    {formatDuration(data.recommendation.mean)}
                  </span>
                  <span className={`text-xs font-semibold tabular-nums ml-auto ${
                    Math.abs(cpmDeviation.pct) <= 15 ? 'text-emerald-600' :
                    Math.abs(cpmDeviation.pct) <= 30 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {cpmDeviation.diff > 0 ? '+' : ''}{cpmDeviation.diff}일
                    ({cpmDeviation.pct > 0 ? '+' : ''}{cpmDeviation.pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {Math.abs(cpmDeviation.pct) <= 15 ? '✓ 정상 범위 (±15%)' :
                   Math.abs(cpmDeviation.pct) <= 30 ? '⚠️ 재검토 권장 (15~30%)' :
                   '⚠️ 유의한 편차 (30% 초과) — CPM 또는 데이터 재검토 필요'}
                </div>
              </div>
            )}

            {/* 근거 */}
            <ul className="text-[11px] text-slate-600 space-y-0.5">
              {data.recommendation.reasons.map((r, i) => (
                <li key={i}>· {r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 유사 프로젝트 카드 목록 */}
        {data && data.matches.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
              참조 프로젝트 TOP {Math.min(5, data.matches.length)}
            </div>
            <div className="space-y-2">
              {data.matches.slice(0, 5).map(m => {
                const simPct = Math.round(m.similarity * 100)
                return (
                  <div key={m.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0 flex-1">
                        <Link href={`/projects/${m.id}`} className="font-semibold text-slate-800 hover:text-blue-700 truncate flex items-center gap-1">
                          <Building2 size={11} className="flex-shrink-0" />
                          {m.name}
                          <ExternalLink size={10} className="text-slate-300" />
                        </Link>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                          {m.type && <span>{m.type}</span>}
                          <span className="inline-flex items-center gap-0.5">
                            <Layers size={9} /> 지상 {m.ground ?? '—'}F / 지하 {m.basement ?? '—'}F
                          </span>
                          <span>연면적 {m.bldgArea?.toLocaleString() ?? '—'}㎡</span>
                          {m.constructionMethod && (
                            <span className="px-1 bg-purple-100 text-purple-700 rounded">
                              {METHOD_LABEL[m.constructionMethod] ?? m.constructionMethod}
                            </span>
                          )}
                          {m.hasTransfer && <span className="px-1 bg-orange-100 text-orange-700 rounded">전이층</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          simPct >= 80 ? 'bg-emerald-100 text-emerald-700' :
                          simPct >= 60 ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          유사도 {simPct}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1 border-t border-slate-200/70">
                      <div className="flex items-center gap-1">
                        <Calendar size={10} className="text-slate-400" />
                        <span className="text-[10px] text-slate-500">공기</span>
                        <span className="font-mono font-bold text-slate-800 tabular-nums">
                          {formatDuration(m.durationUsed)}
                        </span>
                        {m.durationSource === 'actual' && (
                          <span className="text-[9px] font-bold px-1 rounded bg-emerald-600 text-white">실적</span>
                        )}
                        {m.durationSource === 'cpm' && (
                          <span className="text-[9px] font-bold px-1 rounded bg-blue-500 text-white">CPM</span>
                        )}
                      </div>
                      {m.startDate && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          착공 {m.startDate}
                        </span>
                      )}
                      {m.actualCompletionDate && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          → 준공 {m.actualCompletionDate}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {data.matches.length > 5 && (
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                + {data.matches.length - 5}개 더 (최대 10개까지 비교)
              </p>
            )}
          </div>
        )}
      </div>

      {/* 푸터: 한계 고지 */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500">
        ※ <strong>데이터 기반 참조값</strong> — 휴리스틱 공식(AI 프리셋·회귀식)보다 신뢰도 높지만,
        여전히 대리지표입니다. <strong>최종 의사결정은 CPM 결과</strong>를 기준으로 하되, 본 추천과 크게 어긋나면 재검토하세요.
        데이터가 누적되면 F18 자사 회귀식으로 자동 승격 예정.
      </div>
    </div>
  )
}
