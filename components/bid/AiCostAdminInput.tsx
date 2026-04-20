'use client'

// ═══════════════════════════════════════════════════════════
// AI 공사비 추정 — 관리자 입력 폼
//
// 관리자가 Claude Opus 4.7 대화 세션에서 추정 결과를 받아
// 이 폼에 입력하면 Project.aiCostEstimate 에 저장됨.
// 일반 사용자는 /bid 에서 캐시 값을 보기만 함 (API 호출 비용 0).
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { Plus, Trash2, Info, DollarSign, Copy as CopyIcon, Check } from 'lucide-react'
import type { AiCostEstimateData, AiCostTrade } from '@/lib/types/ai-cost'

const EMPTY_TRADE: AiCostTrade = { category: '', amount: 0, note: '' }

const EMPTY_DATA: AiCostEstimateData = {
  totalAmount: 0,
  unitPrice: undefined,
  rangeMin: undefined,
  rangeMax: undefined,
  confidence: 'medium',
  estimator: 'Claude Opus 4.7',
  estimatedAt: new Date().toISOString().slice(0, 10),
  trades: [{ ...EMPTY_TRADE }],
  rationale: '',
}

interface Props {
  value: AiCostEstimateData | null
  onChange: (v: AiCostEstimateData | null) => void
}

export default function AiCostAdminInput({ value, onChange }: Props) {
  const [data, setData] = useState<AiCostEstimateData>(value ?? EMPTY_DATA)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (value) setData(value)
  }, [value])

  function update<K extends keyof AiCostEstimateData>(k: K, v: AiCostEstimateData[K]) {
    const next = { ...data, [k]: v }
    setData(next)
    onChange(next)
  }

  function updateTrade(i: number, patch: Partial<AiCostTrade>) {
    const next = { ...data, trades: data.trades.map((t, idx) => idx === i ? { ...t, ...patch } : t) }
    setData(next); onChange(next)
  }

  function addTrade() {
    const next = { ...data, trades: [...data.trades, { ...EMPTY_TRADE }] }
    setData(next); onChange(next)
  }

  function removeTrade(i: number) {
    const next = { ...data, trades: data.trades.filter((_, idx) => idx !== i) }
    setData(next); onChange(next)
  }

  function applyPaste() {
    setPasteError(null)
    try {
      const parsed = JSON.parse(pasteText) as AiCostEstimateData
      if (typeof parsed.totalAmount !== 'number') throw new Error('totalAmount 누락')
      if (!Array.isArray(parsed.trades)) throw new Error('trades 누락')
      setData(parsed); onChange(parsed)
      setPasteMode(false); setPasteText('')
    } catch (e) {
      setPasteError(e instanceof Error ? e.message : 'JSON 파싱 실패')
    }
  }

  async function copyPromptTemplate() {
    const template = `Claude Opus 4.7에게 공사비 추정 요청 템플릿:

아래 프로젝트 데이터 기반으로 총 공사비를 추정해주세요.
2025~2026년 한국 건설 시세 기준, 공종별 breakdown 포함.

프로젝트:
- 유형: [공동주택/오피스텔/...]
- 지상 [N]층 / 지하 [N]층 / 저층부 [N]층
- 연면적 [N]㎡ / 건축면적 [N]㎡
- 전이층: [있음/없음]
- 풍화암 바닥 [N]m
- 공법: [bottom_up/semi_top_down/full_top_down/up_up]
- PRD 앵커: [N]공
- 위치: [주소]

답변은 반드시 아래 JSON 형태로 (금액 단위: 만원):
{
  "totalAmount": 28036000,
  "unitPrice": 5200,
  "rangeMin": 26500000,
  "rangeMax": 29500000,
  "confidence": "medium",
  "estimator": "Claude Opus 4.7",
  "estimatedAt": "${new Date().toISOString().slice(0, 10)}",
  "trades": [
    { "category": "토공사", "amount": 850000, "note": "풍화암 16.8m 기준 단가" },
    { "category": "흙막이", "amount": 1200000, "note": "CIP + 캠빔" },
    { "category": "철근콘크리트", "amount": 9500000, "note": "..." },
    ...
  ],
  "rationale": "종합 추정 근거 텍스트 (3~5줄)"
}`
    await navigator.clipboard.writeText(template)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function clearAll() {
    if (!confirm('입력된 AI 공사비 추정을 모두 삭제하시겠습니까?')) return
    setData(EMPTY_DATA); onChange(null)
  }

  const 억 = data.totalAmount > 0 ? (data.totalAmount / 10000).toFixed(1) : '0'

  return (
    <div className="bg-white border border-emerald-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200 flex items-start gap-2">
        <DollarSign size={16} className="text-emerald-600 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900">AI 공사비 추정 (관리자 입력)</h3>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Claude Opus 4.7 세션에서 받은 추정 결과를 여기에 입력. 사용자는 /bid 에서 이 값을 보게 됩니다.
            런타임 Claude API 호출 0건 → 비용 0원.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyPromptTemplate}
            className="h-7 px-2 rounded border border-emerald-300 bg-white hover:bg-emerald-50 text-[11px] text-emerald-700 inline-flex items-center gap-1"
            title="Claude에게 보낼 프롬프트 템플릿 복사"
          >
            {copied ? <Check size={11} /> : <CopyIcon size={11} />}
            {copied ? '복사됨' : '프롬프트 복사'}
          </button>
          <button
            type="button"
            onClick={() => setPasteMode(v => !v)}
            className="h-7 px-2 rounded border border-emerald-300 bg-white hover:bg-emerald-50 text-[11px] text-emerald-700"
          >
            {pasteMode ? '폼 편집' : 'JSON 붙여넣기'}
          </button>
        </div>
      </div>

      {pasteMode ? (
        <div className="p-4 space-y-2">
          <p className="text-[11px] text-slate-600">
            Claude 답변의 JSON을 그대로 붙여넣으세요. 파싱 성공 시 폼에 자동 채워집니다.
          </p>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            rows={12}
            placeholder={`{\n  "totalAmount": 28036000,\n  "confidence": "medium",\n  ...\n}`}
            className="w-full p-2 text-xs font-mono border border-slate-200 rounded"
          />
          {pasteError && <p className="text-xs text-red-600">파싱 실패: {pasteError}</p>}
          <button
            type="button"
            onClick={applyPaste}
            disabled={!pasteText.trim()}
            className="h-8 px-3 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
          >
            JSON 적용
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* 상단 — 핵심 수치 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">총 공사비 (만원)</label>
              <input
                type="number" min={0}
                value={data.totalAmount || ''}
                onChange={e => update('totalAmount', Number(e.target.value) || 0)}
                className="w-full h-9 px-2 text-sm border border-slate-200 rounded focus:border-emerald-500 focus:outline-none"
              />
              {data.totalAmount > 0 && (
                <p className="text-[10px] text-slate-500 mt-0.5">약 {억}억원</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">평당 단가 (만원)</label>
              <input
                type="number" min={0}
                value={data.unitPrice ?? ''}
                onChange={e => update('unitPrice', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full h-9 px-2 text-sm border border-slate-200 rounded focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">범위 최소 (만원)</label>
              <input
                type="number" min={0}
                value={data.rangeMin ?? ''}
                onChange={e => update('rangeMin', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full h-9 px-2 text-sm border border-slate-200 rounded focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">범위 최대 (만원)</label>
              <input
                type="number" min={0}
                value={data.rangeMax ?? ''}
                onChange={e => update('rangeMax', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full h-9 px-2 text-sm border border-slate-200 rounded focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">신뢰도</label>
              <select
                value={data.confidence}
                onChange={e => update('confidence', e.target.value as 'low' | 'medium' | 'high')}
                className="w-full h-9 px-2 text-sm border border-slate-200 rounded bg-white"
              >
                <option value="high">높음</option>
                <option value="medium">보통</option>
                <option value="low">낮음</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">추정자</label>
              <input
                type="text"
                value={data.estimator}
                onChange={e => update('estimator', e.target.value)}
                className="w-full h-9 px-2 text-sm border border-slate-200 rounded"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">추정 일시</label>
              <input
                type="date"
                value={data.estimatedAt}
                onChange={e => update('estimatedAt', e.target.value)}
                className="w-full h-9 px-2 text-sm border border-slate-200 rounded"
              />
            </div>
          </div>

          {/* 공종별 breakdown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                <Info size={11} />
                공종별 breakdown (합계가 총 공사비와 일치하도록)
              </label>
              <button
                type="button"
                onClick={addTrade}
                className="h-7 px-2 rounded border border-slate-200 hover:bg-slate-50 text-[11px] text-slate-600 inline-flex items-center gap-1"
              >
                <Plus size={11} /> 공종 추가
              </button>
            </div>
            <div className="space-y-2">
              {data.trades.map((t, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start bg-slate-50 border border-slate-200 rounded-lg p-2">
                  <input
                    type="text"
                    placeholder="공종명 (예: 철근콘크리트)"
                    value={t.category}
                    onChange={e => updateTrade(i, { category: e.target.value })}
                    className="col-span-3 h-8 px-2 text-xs border border-slate-200 rounded bg-white"
                  />
                  <input
                    type="number" min={0}
                    placeholder="금액 (만원)"
                    value={t.amount || ''}
                    onChange={e => updateTrade(i, { amount: Number(e.target.value) || 0 })}
                    className="col-span-2 h-8 px-2 text-xs font-mono border border-slate-200 rounded bg-white"
                  />
                  <input
                    type="text"
                    placeholder="근거 메모 (단가·산출식)"
                    value={t.note ?? ''}
                    onChange={e => updateTrade(i, { note: e.target.value })}
                    className="col-span-6 h-8 px-2 text-xs border border-slate-200 rounded bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeTrade(i)}
                    className="col-span-1 h-8 text-slate-400 hover:text-red-500 flex items-center justify-center"
                    title="공종 삭제"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            {data.trades.length > 0 && (
              <p className="text-[10px] text-slate-500 mt-1 font-mono tabular-nums">
                합계: {data.trades.reduce((s, t) => s + (t.amount || 0), 0).toLocaleString()}만원
                {data.totalAmount > 0 && (
                  <span className={Math.abs(data.trades.reduce((s, t) => s + (t.amount || 0), 0) - data.totalAmount) / data.totalAmount > 0.03 ? ' text-amber-600 font-semibold' : ' text-slate-400'}>
                    {' '}/ 총 {data.totalAmount.toLocaleString()}만원
                    {Math.abs(data.trades.reduce((s, t) => s + (t.amount || 0), 0) - data.totalAmount) / data.totalAmount > 0.03 && ' ⚠️ 3% 이상 차이'}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* 종합 근거 */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">종합 추정 근거</label>
            <textarea
              value={data.rationale}
              onChange={e => update('rationale', e.target.value)}
              rows={4}
              placeholder="Claude 답변의 rationale 텍스트를 여기에 붙여넣기 (3~5줄)"
              className="w-full p-2 text-sm border border-slate-200 rounded focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* 하단: 삭제 */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={clearAll}
              className="h-7 px-2 text-[11px] text-red-600 hover:bg-red-50 rounded"
            >
              전체 삭제 (AI 추정 없음 상태로)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
