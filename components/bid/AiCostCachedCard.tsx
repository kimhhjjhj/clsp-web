'use client'

// ═══════════════════════════════════════════════════════════
// AI 공사비 추정 — DB 캐시 표시 카드 (런타임 API 호출 0건)
//
// 관리자가 /projects/[id]/edit 에서 입력한 aiCostEstimate 를
// 읽어 표시만 한다. Claude API 호출·하드코딩 공식 fallback 일체 없음.
//
// 값이 없으면 "관리자 입력 필요" 안내 + /edit 페이지 링크.
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { DollarSign, AlertCircle, ExternalLink, Info, Sparkles } from 'lucide-react'
import type { AiCostEstimateData } from '@/lib/types/ai-cost'

interface Props {
  projectId?: string | null
  estimate: AiCostEstimateData | null | undefined
  /** 연면적 (평당 단가 검증용) */
  bldgArea?: number
}

const CONF_LABEL = { high: '높음', medium: '보통', low: '낮음' }

function fmt억(manwon: number): string {
  const 억 = manwon / 10000
  if (억 >= 100) return 억.toFixed(0)
  if (억 >= 10) return 억.toFixed(1)
  return 억.toFixed(2)
}

/** CPM 임계경로 상 태스크들을 카테고리별로 묶어 공사비 대비용 표 생성 */
function buildTradeBreakdown(trades: AiCostEstimateData['trades'], total: number) {
  if (!trades || trades.length === 0) return null
  const rows = trades
    .filter(t => t.amount > 0)
    .map(t => ({
      ...t,
      pct: t.pctOfTotal != null ? t.pctOfTotal : (total > 0 ? Math.round((t.amount / total) * 100) : 0),
    }))
    .sort((a, b) => b.amount - a.amount)
  const sum = rows.reduce((s, r) => s + r.amount, 0)
  return { rows, sum }
}

export default function AiCostCachedCard({ projectId, estimate, bldgArea }: Props) {
  // ─── 추정 없음 ─────────────────────────────────────────
  if (!estimate || !estimate.totalAmount || estimate.totalAmount <= 0) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-5">
        <div className="flex items-start gap-2 mb-2">
          <AlertCircle size={16} className="text-slate-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-700">AI 공사비 추정 미입력</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              아직 관리자가 Claude Opus 추정을 입력하지 않았습니다.
              <br />
              <strong>의사결정은 WBS·CPM 기반 실물량 집계를 기준</strong>으로 하세요.
            </p>
            {projectId && (
              <Link
                href={`/projects/${projectId}/edit`}
                className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-700 hover:text-emerald-900 font-semibold underline"
              >
                <ExternalLink size={11} />
                /edit 에서 AI 추정 입력
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── 추정 있음 ─────────────────────────────────────────
  const 억 = fmt억(estimate.totalAmount)
  const minAmount = estimate.rangeMin ? fmt억(estimate.rangeMin) : null
  const maxAmount = estimate.rangeMax ? fmt억(estimate.rangeMax) : null
  const bd = buildTradeBreakdown(estimate.trades, estimate.totalAmount)

  // 평당 단가 역산 (연면적 제공 시)
  const 평 = bldgArea ? bldgArea / 3.3058 : null
  const 역산단가 = 평 && 평 > 0 ? Math.round(estimate.totalAmount / 평) : null

  return (
    <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-xl p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Sparkles size={16} />
        <span className="text-xs font-bold uppercase tracking-wider opacity-90">
          AI 공사비 추정
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/15 border border-white/20">
          신뢰도 {CONF_LABEL[estimate.confidence] ?? '—'}
        </span>
        <span className="text-[10px] opacity-70 ml-auto">
          {estimate.estimator} · {estimate.estimatedAt}
        </span>
      </div>

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-3xl sm:text-4xl font-bold font-mono leading-none tabular-nums">
            {억}
            <span className="text-base font-normal opacity-70 ml-1.5">억원</span>
            <span className="text-sm font-normal opacity-60 ml-2">
              ({estimate.totalAmount.toLocaleString()}만원)
            </span>
          </p>
          {(minAmount != null || maxAmount != null) && (
            <p className="text-xs opacity-80 mt-1.5">
              범위 {minAmount ?? '—'}~{maxAmount ?? '—'}억원
            </p>
          )}
          {estimate.unitPrice && estimate.unitPrice > 0 && (
            <p className="text-xs opacity-70 mt-1">
              <DollarSign size={11} className="inline mr-1" />
              평당 {estimate.unitPrice.toLocaleString()}만원
              {역산단가 && Math.abs(역산단가 - estimate.unitPrice) / estimate.unitPrice > 0.1 && (
                <span className="opacity-60 ml-1">(역산 {역산단가.toLocaleString()}만원)</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* ↓ 상세보기 — 공종별 breakdown · 종합 근거 */}
      <details className="mt-4 group">
        <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 transition-colors">
          <span className="text-xs font-bold tracking-wide">
            상세보기 — 공종별 breakdown · 종합 근거
          </span>
          <span className="text-xs opacity-70 group-open:rotate-180 transition-transform">▾</span>
        </summary>

      {/* 공종별 breakdown */}
      {bd && bd.rows.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-2">
            공종별 공사비 분해
          </div>
          <div className="overflow-hidden rounded bg-white/5 border border-white/10">
            <table className="w-full text-[11px]">
              <thead className="bg-white/10 text-white/80">
                <tr>
                  <th className="text-left px-2 py-1.5 font-semibold">공종</th>
                  <th className="text-left px-2 py-1.5 font-semibold">근거 메모</th>
                  <th className="text-right px-2 py-1.5 font-semibold w-20">금액(만원)</th>
                  <th className="text-right px-2 py-1.5 font-semibold w-14">비중</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {bd.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5 font-medium whitespace-nowrap">{r.category}</td>
                    <td className="px-2 py-1.5 opacity-80">{r.note ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums">{r.amount.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums opacity-70">{r.pct}%</td>
                  </tr>
                ))}
                <tr className="bg-white/10 font-bold">
                  <td className="px-2 py-1.5" colSpan={2}>
                    합계
                    {Math.abs(bd.sum - estimate.totalAmount) / estimate.totalAmount > 0.03 && (
                      <span className="text-[9px] text-amber-300 ml-1">⚠️ 총액과 3% 이상 차이</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">{bd.sum.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right opacity-70">
                    {estimate.totalAmount > 0 ? Math.round((bd.sum / estimate.totalAmount) * 100) : 0}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 종합 근거 */}
      {estimate.rationale && (
        <div className="mt-4 pt-4 border-t border-white/15">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-2">
            종합 추정 근거
          </div>
          <p className="text-[11px] opacity-80 leading-relaxed whitespace-pre-wrap bg-white/5 rounded p-2 border border-white/10">
            {estimate.rationale}
          </p>
        </div>
      )}
      </details>
      {/* ↑ 상세보기 details 닫기 */}

      {projectId && (
        <div className="mt-3 text-right">
          <Link
            href={`/projects/${projectId}/edit`}
            className="inline-flex items-center gap-1 text-[11px] opacity-70 hover:opacity-100"
          >
            <ExternalLink size={10} />
            추정 수정
          </Link>
        </div>
      )}
    </div>
  )
}
