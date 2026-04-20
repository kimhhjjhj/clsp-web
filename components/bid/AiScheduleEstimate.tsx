'use client'

// ═══════════════════════════════════════════════════════════
// AI 공기 추정 패널
// - 유형·규모 기반 룰 프리셋 (즉시) + Claude API (키 있을 때) + 수동 붙여넣기
// - UX는 AiCostEstimate와 대칭: 보라→블루 → 여긴 블루→시안
// - storageKey / initialResult prop으로 localStorage persist & 부모 복원 지원
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Sparkles, Loader2, AlertCircle, Info, ClipboardPaste, Copy, Check, Calendar } from 'lucide-react'

export interface SchedulePhase {
  name: string
  days: number
  ratio: number
  startDay: number
  endDay: number
  note?: string
}

export interface AiScheduleResult {
  totalDuration: number
  byType: string
  confidence?: 'low' | 'medium' | 'high'
  phases: SchedulePhase[]
  formula?: string
  notes?: string[]
  model?: string
  usage?: { input_tokens: number; output_tokens: number }
}

interface Props {
  type?: string
  ground?: number
  basement?: number
  lowrise?: number
  hasTransfer?: boolean
  bldgArea?: number
  buildingArea?: number
  siteArea?: number
  wtBottom?: number
  waBottom?: number
  startDate?: string
  /** 추정 완료 시 부모에 결과 전달 */
  onResult?: (result: AiScheduleResult | null) => void
  storageKey?: string
  initialResult?: AiScheduleResult | null
}

const PHASE_COLORS: Record<string, string> = {
  '가설·착공 준비': '#64748b',
  '토공·기초':      '#ca8a04',
  '골조공사':       '#2563eb',
  '외부·마감':      '#059669',
  'MEP·준공':       '#7c3aed',
}

function addDays(startIso: string | undefined, days: number): string | null {
  if (!startIso) return null
  const d = new Date(startIso)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + Math.round(days))
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function AiScheduleEstimate(props: Props) {
  const [result, setResult] = useState<AiScheduleResult | null>(() => {
    if (props.storageKey && typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(`ai-schedule-estimate:${props.storageKey}`)
        if (raw) return JSON.parse(raw) as AiScheduleResult
      } catch { /* ignore */ }
    }
    return props.initialResult ?? null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [manualJson, setManualJson] = useState('')
  const [manualErr, setManualErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!props.storageKey || typeof window === 'undefined') return
    try {
      if (result) window.localStorage.setItem(`ai-schedule-estimate:${props.storageKey}`, JSON.stringify(result))
      else window.localStorage.removeItem(`ai-schedule-estimate:${props.storageKey}`)
    } catch { /* ignore */ }
  }, [result, props.storageKey])

  useEffect(() => {
    if (!props.initialResult) return
    setResult(prev => prev ?? props.initialResult ?? null)
  }, [props.initialResult])

  const run = useCallback(async (mode: 'auto' | 'preset' = 'preset') => {
    setLoading(true)
    setError(null)
    try {
      const qs = mode === 'preset' ? '?mode=preset' : '?mode=auto'
      const res = await fetch(`/api/bid/ai-schedule${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: props.type,
          ground: props.ground,
          basement: props.basement,
          lowrise: props.lowrise,
          hasTransfer: props.hasTransfer,
          bldgArea: props.bldgArea,
          buildingArea: props.buildingArea,
          siteArea: props.siteArea,
          wtBottom: props.wtBottom,
          waBottom: props.waBottom,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '공기 추정 실패')
      setResult(data)
      props.onResult?.(data)
    } catch (e) {
      setError((e as Error).message)
      props.onResult?.(null)
    } finally {
      setLoading(false)
    }
  }, [props])

  function applyManual() {
    setManualErr(null)
    try {
      const parsed = JSON.parse(manualJson.trim()) as AiScheduleResult
      if (!parsed.totalDuration || !Array.isArray(parsed.phases)) {
        setManualErr('형식 오류: totalDuration + phases 배열이 필요합니다')
        return
      }
      setResult(parsed)
      setShowManual(false)
      setManualJson('')
      props.onResult?.(parsed)
    } catch (e) {
      setManualErr(`JSON 파싱 실패: ${(e as Error).message}`)
    }
  }

  function buildPrompt() {
    return `한국 건축 공정관리자 입장에서 ${props.type ?? '기타'} 지상 ${props.ground ?? 0}층/지하 ${props.basement ?? 0}층, 연면적 ${props.bldgArea?.toLocaleString() ?? '—'}㎡ 프로젝트의 합리적 총공기(일)와 5단계 분포(가설·토공·골조·외부마감·MEP준공)를 JSON으로 추정: { "totalDuration": N, "byType": "...", "confidence": "low|medium|high", "phases": [{"name","days","ratio","startDay","endDay","note"}], "formula": "...", "notes": [...] }`
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(buildPrompt())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  // 초기 입력 상태
  if (!result && !loading) {
    return (
      <>
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-6 text-center">
          <div className="w-12 h-12 mx-auto bg-white rounded-xl flex items-center justify-center mb-3 shadow-sm">
            <Calendar size={22} className="text-blue-600" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">AI 공기 추정</h3>
          <p className="text-xs text-gray-600 leading-relaxed mb-4 max-w-md mx-auto">
            유형·층수·면적·지반 조건으로 <strong>합리적인 총공기</strong>와
            <strong> 5단계 분포</strong>를 산출합니다.
            <br />
            <span className="text-gray-500">(회사 과거 실적 기반 룰 · CPM 계산 전에도 즉시 사용 가능)</span>
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => run('preset')}
              className="inline-flex items-center gap-1.5 h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
              title="2026년 회사 실적 룰 기반 — API 키 없어도 바로 동작"
            >
              <Sparkles size={14} /> 프리셋으로 추정
            </button>
            <button
              onClick={() => run('auto')}
              className="inline-flex items-center gap-1.5 h-10 px-4 bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-lg text-sm font-semibold"
              title="ANTHROPIC_API_KEY 설정 시 Claude API로 정밀 추정"
            >
              <Sparkles size={14} /> AI API
            </button>
            <button
              onClick={() => setShowManual(true)}
              className="inline-flex items-center gap-1.5 h-10 px-4 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-semibold"
              title="외부 AI로 받은 JSON 붙여넣기"
            >
              <ClipboardPaste size={14} /> 붙여넣기
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-3">
            프리셋: 즉시 / 유형별 계수 · AI API: 키 필요 · 붙여넣기: 외부 AI 결과
          </p>
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 text-left">
              <AlertCircle size={12} className="inline mr-1" /> {error}
            </div>
          )}
        </div>

        {showManual && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-auto"
            onClick={() => setShowManual(false)}>
            <div onClick={e => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-4 flex flex-col max-h-[calc(100vh-2rem)]">
              <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
                <div>
                  <h3 className="text-base font-bold text-gray-900">외부 AI 공기 추정 붙여넣기</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Claude.ai · ChatGPT 등에서 받은 JSON을 그대로 붙여넣으세요</p>
                </div>
                <button onClick={() => setShowManual(false)} className="text-gray-400 hover:text-gray-900 p-1">✕</button>
              </div>
              <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] text-gray-500 font-semibold">
                      ① 이 프롬프트를 복사해서 Claude.ai 에 붙여넣으세요
                    </label>
                    <button onClick={copyPrompt}
                      className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800">
                      {copied ? <><Check size={11} /> 복사됨</> : <><Copy size={11} /> 프롬프트 복사</>}
                    </button>
                  </div>
                  <pre className="text-[10px] bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-40 overflow-auto font-mono text-gray-700 whitespace-pre-wrap">
{buildPrompt()}
                  </pre>
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5">
                    ② AI가 응답한 JSON 전체를 여기에 붙여넣으세요
                  </label>
                  <textarea
                    value={manualJson}
                    onChange={e => setManualJson(e.target.value)}
                    rows={12}
                    placeholder='{"totalDuration":..., "phases":[...], "notes":[...]}'
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  {manualErr && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
                      <AlertCircle size={12} className="inline mr-1" /> {manualErr}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                <button onClick={() => setShowManual(false)}
                  className="text-sm text-gray-600 px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-100">
                  취소
                </button>
                <button onClick={applyManual} disabled={!manualJson.trim()}
                  className="text-sm font-semibold px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">
                  적용
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <Loader2 size={24} className="mx-auto animate-spin text-blue-600 mb-3" />
        <p className="text-sm text-gray-500">AI가 유형·규모 기반 공기를 추정하는 중...</p>
        <p className="text-[11px] text-gray-400 mt-1">프리셋은 즉시 · API는 약 10~20초</p>
      </div>
    )
  }

  if (!result) return null

  const { totalDuration, phases, formula, notes, byType, confidence } = result
  const finishDate = addDays(props.startDate, totalDuration)
  const months = Math.round(totalDuration / 30)
  const confLabel = confidence === 'high' ? '높음' : confidence === 'medium' ? '보통' : '낮음'

  return (
    <div className="space-y-4">
      {/* ⚠️ 참고용 안내 배너 — 이 값은 휴리스틱 공식 산출물 */}
      <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 flex items-start gap-2">
        <span className="text-amber-600 text-base leading-none mt-0.5">⚠️</span>
        <div className="text-[11px] text-amber-900 leading-relaxed">
          <strong>참고용 (휴리스틱 공식)</strong> — 이 수치는 연면적·층수 등 소수 변수로 계산한 <strong>개략 추정</strong>입니다.
          계수 근거가 불투명하고 외부 변수(민원·악천후·설계변경)를 반영하지 않아 <strong>실제와 큰 편차</strong>가 있을 수 있습니다.
          <br />
          <strong>실제 의사결정은 CPM 결과 또는 상단의 &ldquo;유사 프로젝트 기반 추천&rdquo;을 기준</strong>으로 하세요.
        </div>
      </div>

      {/* 최상단 요약 — 색상 낮춰서 주요 수치 아님을 시각적으로 표현 */}
      <div className="bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-xl p-5 opacity-90">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} />
          <span className="text-xs font-bold uppercase tracking-wider opacity-80">AI 프리셋 (참고용)</span>
          {confidence && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/15 border border-white/20">
              신뢰도 {confLabel}
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-3xl sm:text-4xl font-bold font-mono leading-none tabular-nums">
              {months}
              <span className="text-base font-normal opacity-70 ml-1.5">개월</span>
              <span className="text-sm font-normal opacity-60 ml-2">({totalDuration.toLocaleString()}일)</span>
            </p>
            <p className="text-xs opacity-80 mt-1.5">
              {byType}
              {props.startDate && finishDate && (
                <>
                  <span className="mx-1.5 opacity-60">·</span>
                  착공 {props.startDate}
                  <span className="mx-1 opacity-60">→</span>
                  준공 <span className="font-semibold">{finishDate}</span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={() => run('preset')}
            disabled={loading}
            className="text-xs border border-white/40 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            재추정
          </button>
        </div>
      </div>

      {/* 5단계 stacked bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h4 className="text-sm font-bold text-gray-900 mb-3">단계별 분포</h4>
        <div className="flex h-8 rounded-lg overflow-hidden border border-gray-200">
          {phases.map(ph => (
            <div
              key={ph.name}
              title={`${ph.name} · ${ph.days}일`}
              className="relative flex items-center justify-center text-[10px] font-bold text-white"
              style={{
                width: `${(ph.days / Math.max(1, totalDuration)) * 100}%`,
                background: PHASE_COLORS[ph.name] ?? '#94a3b8',
              }}
            >
              {ph.days / totalDuration > 0.08 && <span className="truncate px-1">{ph.days}d</span>}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
          {phases.map(ph => {
            const startDate = addDays(props.startDate, ph.startDay)
            const endDate = addDays(props.startDate, ph.endDay)
            return (
              <div key={ph.name} className="text-[11px]">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PHASE_COLORS[ph.name] ?? '#94a3b8' }} />
                  <span className="font-semibold text-gray-900 truncate">{ph.name}</span>
                </div>
                <p className="font-mono text-gray-500">
                  {ph.days}일 <span className="text-gray-400">({Math.round(ph.ratio * 100)}%)</span>
                </p>
                {startDate && endDate && (
                  <p className="text-[10px] text-gray-400 font-mono">{startDate} ~ {endDate}</p>
                )}
                {ph.note && <p className="text-[10px] text-gray-500 mt-0.5">{ph.note}</p>}
              </div>
            )
          })}
        </div>
      </div>

      {/* 산출 근거 + 한계 */}
      {(formula || (notes && notes.length > 0)) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 leading-relaxed flex-1 min-w-0">
              {formula && (
                <p className="font-semibold mb-1.5 break-words">산출 근거: <span className="font-mono font-normal text-[11px]">{formula}</span></p>
              )}
              {notes && notes.length > 0 && (
                <ul className="list-disc ml-4 space-y-0.5 text-[11px] text-blue-800">
                  {notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {result.model && (
        <p className="text-[10px] text-gray-400 text-center">
          Model: {result.model} {result.usage ? `· in ${result.usage.input_tokens} / out ${result.usage.output_tokens} tok` : ''}
        </p>
      )}
    </div>
  )
}
