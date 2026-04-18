'use client'

// ═══════════════════════════════════════════════════════════
// AI 개략 공사비 추정 패널
// - CPM 결과(공종별 물량)를 Claude에 보내 단가·breakdown 받음
// - 물량 × 단가 방식 (정석). AI는 단가만 추정
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { Sparkles, Loader2, ChevronDown, ChevronUp, AlertCircle, Info } from 'lucide-react'
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
      // 기본으로 모든 카테고리 펼침
      setExpandedCat(new Set((data.trades as Trade[]).map(t => t.category)))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [props])

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
        <button
          onClick={run}
          className="inline-flex items-center gap-1.5 h-10 px-5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold"
        >
          <Sparkles size={14} /> AI로 공사비 추정
        </button>
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 text-left">
            <AlertCircle size={12} className="inline mr-1" /> {error}
          </div>
        )}
      </div>
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
