'use client'

// ═══════════════════════════════════════════════════════════
// AI 개략 공사비 추정 패널
// - CPM 결과(공종별 물량)를 Claude에 보내 단가·breakdown 받음
// - 물량 × 단가 방식 (정석). AI는 단가만 추정
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { Sparkles, Loader2, ChevronDown, ChevronUp, AlertCircle, Info, ClipboardPaste, Copy, Check } from 'lucide-react'
import type { CPMResult } from '@/lib/types'

interface Item {
  name: string
  qty: number
  unit: string
  unitPriceKRW: number
  subtotalKRW: number
}

interface Trade {
  category: string
  items: Item[]
  categorySubtotalKRW: number
}

interface Summary {
  directCostKRW: number
  indirectCostKRW: number
  generalAdminKRW: number
  profitKRW: number
  vatKRW: number
  grandTotalKRW: number
  pricePerSqmKRW: number
  pricePerPyongKRW: number
}

interface AiResult {
  trades: Trade[]
  summary: Summary
  notes: string
  model?: string
  usage?: { input_tokens: number; output_tokens: number }
}

interface Props {
  type?: string
  ground?: number
  basement?: number
  bldgArea?: number
  buildingArea?: number
  siteArea?: number
  totalDuration: number
  tasks: CPMResult[]
  /** 추정 완료 시 부모에 결과 전달 (프로젝트 저장에 포함) */
  onResult?: (result: AiResult | null) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  '공사준비': '#64748b',
  '토목공사': '#ca8a04',
  '골조공사': '#2563eb',
  '마감공사': '#059669',
  '설비공사': '#0891b2',
  '전기공사': '#7c3aed',
  '외부공사': '#16a34a',
  '부대공사': '#dc2626',
}

function fmtKRW(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만`
  return n.toLocaleString()
}

export default function AiCostEstimate(props: Props) {
  const [result, setResult] = useState<AiResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedCat, setExpandedCat] = useState<Set<string>>(new Set())
  // 수동 붙여넣기 모드
  const [showManual, setShowManual] = useState(false)
  const [manualJson, setManualJson] = useState('')
  const [manualErr, setManualErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/bid/ai-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: props.type,
          ground: props.ground,
          basement: props.basement,
          bldgArea: props.bldgArea,
          buildingArea: props.buildingArea,
          siteArea: props.siteArea,
          totalDuration: props.totalDuration,
          tasks: props.tasks.map(t => ({
            name: t.name,
            category: t.category,
            quantity: t.quantity,
            unit: t.unit,
            duration: t.duration,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI 호출 실패')
      setResult(data)
      setExpandedCat(new Set((data.trades as Trade[]).map(t => t.category)))
      props.onResult?.(data)
    } catch (e: any) {
      setError(e.message)
      props.onResult?.(null)
    } finally {
      setLoading(false)
    }
  }, [props])

  // 수동 JSON 파싱 & 저장
  function applyManual() {
    setManualErr(null)
    try {
      const parsed = JSON.parse(manualJson.trim()) as AiResult
      if (!parsed.summary?.grandTotalKRW || !Array.isArray(parsed.trades)) {
        setManualErr("형식 오류: summary.grandTotalKRW 와 trades 배열이 필요합니다")
        return
      }
      if (!parsed.notes) parsed.notes = '수동 입력 (외부 AI 생성)'
      setResult(parsed)
      setExpandedCat(new Set(parsed.trades.map(t => t.category)))
      setShowManual(false)
      setManualJson('')
      props.onResult?.(parsed)
    } catch (e: unknown) {
      setManualErr(`JSON 파싱 실패: ${(e as Error).message}`)
    }
  }

  // Claude.ai 에 붙여넣을 프롬프트 생성 (현재 프로젝트 정보 포함)
  function buildPrompt() {
    const tasksLine = props.tasks.map(t =>
      `- ${t.category} > ${t.name}: ${t.quantity ?? '—'} ${t.unit ?? ''} / 기간 ${t.duration}일`
    ).join('\n')
    return `당신은 한국 건설업계 30년차 적산사입니다. 아래 프로젝트의 개략 공사비를 추정하세요.

프로젝트:
- 유형: ${props.type ?? '공동주택'}
- 지상 ${props.ground ?? 0}층 / 지하 ${props.basement ?? 0}층
- 연면적: ${props.bldgArea?.toLocaleString() ?? '—'} ㎡
- 건축면적: ${props.buildingArea?.toLocaleString() ?? '—'} ㎡
- 대지: ${props.siteArea?.toLocaleString() ?? '—'} ㎡
- 총공기: ${props.totalDuration}일

CPM 공종별 물량:
${tasksLine}

2025년 한국 건설시세(시중노임단가·표준품셈)로 공종별 아이템 단가를 산출하세요.
간접비 10%, 일반관리비 5.5%, 이윤 10%, 부가세 10% 기본 적용.

결과는 반드시 아래 JSON 스키마로만 응답하세요 (설명 없이 JSON만):
{
  "trades": [{
    "category": "골조공사",
    "items": [{"name":"철근 콘크리트","qty":1000,"unit":"㎥","unitPriceKRW":380000,"subtotalKRW":380000000}],
    "categorySubtotalKRW": 380000000
  }],
  "summary": {
    "directCostKRW": 0, "indirectCostKRW": 0, "generalAdminKRW": 0,
    "profitKRW": 0, "vatKRW": 0, "grandTotalKRW": 0,
    "pricePerSqmKRW": 0, "pricePerPyongKRW": 0
  },
  "notes": "주요 가정·근거 3-5줄"
}`
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(buildPrompt())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  function toggleCat(cat: string) {
    setExpandedCat(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  if (!result && !loading) {
    return (
      <>
        <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-200 rounded-xl p-6 text-center">
          <div className="w-12 h-12 mx-auto bg-white rounded-xl flex items-center justify-center mb-3 shadow-sm">
            <Sparkles size={22} className="text-violet-600" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">AI 개략 공사비 추정</h3>
          <p className="text-xs text-gray-600 leading-relaxed mb-4 max-w-md mx-auto">
            CPM이 계산한 <strong>공종별 물량</strong>에 Claude가 2025년 한국 건설 시세로
            <strong> 단가</strong>를 입혀 공종별 세부 아이템·합계를 산출합니다.
            <br />
            <span className="text-gray-500">(물량×단가 방식 · 직접공사비 + 간접비 + 관리비 + 이윤 + 부가세)</span>
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={run}
              className="inline-flex items-center gap-1.5 h-10 px-5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold"
            >
              <Sparkles size={14} /> AI로 자동 추정
            </button>
            <button
              onClick={() => setShowManual(true)}
              className="inline-flex items-center gap-1.5 h-10 px-5 bg-white border border-violet-300 text-violet-700 hover:bg-violet-50 rounded-lg text-sm font-semibold"
              title="API 키 없이 외부 AI(Claude.ai 등)로 받은 JSON 붙여넣기"
            >
              <ClipboardPaste size={14} /> 수동 붙여넣기
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-3">
            ANTHROPIC_API_KEY 미설정 시 자동 추정 실패 → 수동 모드 이용
          </p>
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 text-left">
              <AlertCircle size={12} className="inline mr-1" /> {error}
            </div>
          )}
        </div>

        {/* 수동 붙여넣기 모달 */}
        {showManual && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-auto"
            onClick={() => setShowManual(false)}>
            <div onClick={e => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-4 flex flex-col max-h-[calc(100vh-2rem)]">
              <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
                <div>
                  <h3 className="text-base font-bold text-gray-900">외부 AI 결과 붙여넣기</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Claude.ai · ChatGPT 등에서 받은 JSON을 그대로 붙여넣으세요</p>
                </div>
                <button onClick={() => setShowManual(false)} className="text-gray-400 hover:text-gray-900 p-1">✕</button>
              </div>
              <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
                {/* 1단계: 프롬프트 복사 */}
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

                {/* 2단계: 응답 붙여넣기 */}
                <div>
                  <label className="text-[11px] text-gray-500 font-semibold block mb-1.5">
                    ② AI가 응답한 JSON 전체를 여기에 붙여넣으세요
                  </label>
                  <textarea
                    value={manualJson}
                    onChange={e => setManualJson(e.target.value)}
                    rows={12}
                    placeholder='{"trades":[...], "summary":{"grandTotalKRW":..., ...}, "notes":"..."}'
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
                  className="text-sm font-semibold px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40">
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
        <Loader2 size={24} className="mx-auto animate-spin text-violet-600 mb-3" />
        <p className="text-sm text-gray-500">AI가 공종별 단가·합계를 산출하는 중...</p>
        <p className="text-[11px] text-gray-400 mt-1">약 10~20초 소요</p>
      </div>
    )
  }

  if (!result) return null

  const { trades, summary, notes } = result

  return (
    <div className="space-y-4">
      {/* 최상단 요약 */}
      <div className="bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} />
          <span className="text-xs font-bold uppercase tracking-wider opacity-80">AI 추정 공사비</span>
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-3xl sm:text-4xl font-bold font-mono">{fmtKRW(summary.grandTotalKRW)}<span className="text-base font-normal opacity-70 ml-1">원</span></p>
            <p className="text-xs opacity-80 mt-1">부가세 포함 · 연면적 {fmtKRW(summary.pricePerSqmKRW)}원/㎡ · 평당 {fmtKRW(summary.pricePerPyongKRW)}원</p>
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="text-xs border border-white/40 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            재추정
          </button>
        </div>
      </div>

      {/* Breakdown 4단 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BreakdownCard label="직접공사비" value={summary.directCostKRW} color="bg-blue-50 text-blue-700" />
        <BreakdownCard label="간접공사비" value={summary.indirectCostKRW} color="bg-emerald-50 text-emerald-700" />
        <BreakdownCard label="관리비·이윤" value={summary.generalAdminKRW + summary.profitKRW} color="bg-amber-50 text-amber-700" />
        <BreakdownCard label="부가세 10%" value={summary.vatKRW} color="bg-slate-50 text-slate-700" />
      </div>

      {/* 공종별 아이템 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">공종별 세부 아이템</h3>
          <button
            onClick={() => setExpandedCat(expandedCat.size === trades.length ? new Set() : new Set(trades.map(t => t.category)))}
            className="text-[11px] text-gray-400 hover:text-gray-700"
          >
            {expandedCat.size === trades.length ? '전체 접기' : '전체 펼치기'}
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {trades.map(trade => {
            const expanded = expandedCat.has(trade.category)
            const ratio = (trade.categorySubtotalKRW / summary.directCostKRW) * 100
            return (
              <div key={trade.category}>
                <button
                  type="button"
                  onClick={() => toggleCat(trade.category)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-left"
                >
                  <span className="w-1.5 h-5 rounded-sm flex-shrink-0" style={{ background: CATEGORY_COLORS[trade.category] ?? '#94a3b8' }} />
                  <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{trade.category}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{trade.items.length}개 아이템</span>
                  <div className="flex-1 min-w-[60px] bg-gray-100 rounded-full h-1.5 mx-2">
                    <div className="h-1.5 rounded-full" style={{ width: `${ratio}%`, background: CATEGORY_COLORS[trade.category] ?? '#94a3b8' }} />
                  </div>
                  <span className="text-xs text-gray-500 w-14 text-right font-mono">{ratio.toFixed(1)}%</span>
                  <span className="text-sm font-bold font-mono text-gray-900 w-20 text-right">{fmtKRW(trade.categorySubtotalKRW)}</span>
                  {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </button>
                {expanded && (
                  <div className="px-5 pb-3 pt-1">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          <th className="text-left py-1.5 pr-2">아이템</th>
                          <th className="text-right py-1.5 pr-2 w-20">물량</th>
                          <th className="text-right py-1.5 pr-2 w-24">단가</th>
                          <th className="text-right py-1.5 w-24">소계</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {trade.items.map((it, i) => (
                          <tr key={i}>
                            <td className="py-1.5 pr-2 text-gray-700">{it.name}</td>
                            <td className="py-1.5 pr-2 text-right font-mono text-gray-500">{it.qty.toLocaleString()} {it.unit}</td>
                            <td className="py-1.5 pr-2 text-right font-mono text-gray-700">{it.unitPriceKRW.toLocaleString()}</td>
                            <td className="py-1.5 text-right font-mono font-semibold text-gray-900">{fmtKRW(it.subtotalKRW)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
          <span className="font-bold text-gray-900">직접공사비 합계</span>
          <span className="font-bold text-lg font-mono text-gray-900">{summary.directCostKRW.toLocaleString()}원</span>
        </div>
      </div>

      {/* 가정·한계 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Info size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 leading-relaxed whitespace-pre-wrap">
            <p className="font-semibold mb-1">AI 추정 가정·한계</p>
            {notes}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        Model: {result.model ?? 'claude-sonnet'} · {result.usage ? `in ${result.usage.input_tokens} / out ${result.usage.output_tokens} tok` : ''}
      </p>
    </div>
  )
}

function BreakdownCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${color.split(' ')[1]}`}>{fmtKRW(value)}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{value.toLocaleString()}원</p>
    </div>
  )
}
