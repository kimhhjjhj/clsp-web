'use client'

// ═══════════════════════════════════════════════════════════
// AI 공기 추론 — 관리자 입력 폼
//
// 관리자가 Claude Opus 4.7 대화 세션에서 추론 결과를 받아
// 이 폼에 입력하면 Project.aiScheduleEstimate 에 저장됨.
// 일반 사용자는 /bid 에서 캐시 값을 보기만 함 (API 호출 비용 0).
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { Plus, Trash2, Info, Sparkles, Copy as CopyIcon, Check } from 'lucide-react'
import type { AiScheduleEstimateData, AiScheduleFactor } from '@/lib/types/ai-schedule'

const EMPTY_FACTOR: AiScheduleFactor = { label: '', days: '', note: '' }

const EMPTY_DATA: AiScheduleEstimateData = {
  totalDuration: 0,
  rangeMin: undefined,
  rangeMax: undefined,
  confidence: 'medium',
  estimator: 'Claude Opus 4.7',
  estimatedAt: new Date().toISOString().slice(0, 10),
  factors: [{ ...EMPTY_FACTOR }],
  rationale: '',
}

interface Props {
  value: AiScheduleEstimateData | null
  onChange: (v: AiScheduleEstimateData | null) => void
}

export default function AiScheduleAdminInput({ value, onChange }: Props) {
  const [data, setData] = useState<AiScheduleEstimateData>(value ?? EMPTY_DATA)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (value) setData(value)
  }, [value])

  function update<K extends keyof AiScheduleEstimateData>(k: K, v: AiScheduleEstimateData[K]) {
    const next = { ...data, [k]: v }
    setData(next)
    onChange(next)
  }

  function updateFactor(i: number, patch: Partial<AiScheduleFactor>) {
    const next = { ...data, factors: data.factors.map((f, idx) => idx === i ? { ...f, ...patch } : f) }
    setData(next); onChange(next)
  }

  function addFactor() {
    const next = { ...data, factors: [...data.factors, { ...EMPTY_FACTOR }] }
    setData(next); onChange(next)
  }

  function removeFactor(i: number) {
    const next = { ...data, factors: data.factors.filter((_, idx) => idx !== i) }
    setData(next); onChange(next)
  }

  function applyPaste() {
    setPasteError(null)
    try {
      const parsed = JSON.parse(pasteText) as AiScheduleEstimateData
      if (typeof parsed.totalDuration !== 'number') throw new Error('totalDuration 누락')
      if (!Array.isArray(parsed.factors)) throw new Error('factors 누락')
      setData(parsed); onChange(parsed)
      setPasteMode(false); setPasteText('')
    } catch (e) {
      setPasteError(e instanceof Error ? e.message : 'JSON 파싱 실패')
    }
  }

  async function copyPromptTemplate() {
    const template = `Claude Opus 4.7에게 공기 추론 요청 템플릿:

아래 프로젝트 데이터 기반으로 공사 기간을 추론해주세요.
건설 실무 지식 기반, 업계 밴드·공법 특성·지반 조건 모두 반영.

프로젝트:
- 유형: [공동주택/오피스텔/...]
- 지상 [N]층 / 지하 [N]층 / 저층부 [N]층
- 연면적 [N]㎡ / 건축면적 [N]㎡
- 전이층: [있음/없음]
- 풍화암 바닥 [N]m
- 공법: [bottom_up/semi_top_down/full_top_down/up_up]
- PRD 앵커: [N]공
- 착공 예정일: [YYYY-MM-DD]
- 위치: [주소]

답변은 반드시 아래 JSON 형태로:
{
  "totalDuration": 880,
  "rangeMin": 860,
  "rangeMax": 920,
  "confidence": "medium",
  "estimator": "Claude Opus 4.7",
  "estimatedAt": "${new Date().toISOString().slice(0, 10)}",
  "factors": [
    { "label": "...", "days": "900~1000", "note": "..." },
    ...
  ],
  "rationale": "종합 추정 근거 텍스트 (3~5줄)"
}`
    await navigator.clipboard.writeText(template)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function clearAll() {
    if (!confirm('입력된 AI 공기 추론을 모두 삭제하시겠습니까?')) return
    setData(EMPTY_DATA); onChange(null)
  }

  const months = data.totalDuration > 0 ? Math.round(data.totalDuration / 30) : 0

  return (
    <div className="bg-white border border-purple-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-200 flex items-start gap-2">
        <Sparkles size={16} className="text-purple-600 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900">AI 공기 추론 (관리자 입력)</h3>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Claude Opus 4.7 세션에서 받은 추론 결과를 여기에 입력. 사용자는 /bid 에서 이 값을 보게 됩니다.
            런타임 Claude API 호출 0건 → 비용 0원.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyPromptTemplate}
            className="h-7 px-2 rounded border border-purple-300 bg-white hover:bg-purple-50 text-[11px] text-purple-700 inline-flex items-center gap-1"
            title="Claude에게 보낼 프롬프트 템플릿 복사"
          >
            {copied ? <Check size={11} /> : <CopyIcon size={11} />}
            {copied ? '복사됨' : '프롬프트 복사'}
          </button>
          <button
            type="button"
            onClick={() => setPasteMode(v => !v)}
            className="h-7 px-2 rounded border border-purple-300 bg-white hover:bg-purple-50 text-[11px] text-purple-700"
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
            placeholder={`{\n  "totalDuration": 880,\n  "confidence": "medium",\n  ...\n}`}
            className="w-full p-2 text-xs font-mono border border-slate-200 rounded"
          />
          {pasteError && <p className="text-xs text-red-600">파싱 실패: {pasteError}</p>}
          <button
            type="button"
            onClick={applyPaste}
            disabled={!pasteText.trim()}
            className="h-8 px-3 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold disabled:opacity-50"
          >
            JSON 적용
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* 상단 — 핵심 수치 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">중앙 공기 (일)</label>
              <input
                type="number" min={0}
                value={data.totalDuration || ''}
                onChange={e => update('totalDuration', Number(e.target.value) || 0)}
                className="w-full h-9 px-2 text-sm border border-slate-200 rounded focus:border-purple-500 focus:outline-none"
              />
              {months > 0 && (
                <p className="text-[10px] text-slate-500 mt-0.5">약 {months}개월</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">범위 최소 (일)</label>
              <input
                type="number" min={0}
                value={data.rangeMin ?? ''}
                onChange={e => update('rangeMin', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full h-9 px-2 text-sm border border-slate-200 rounded focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">범위 최대 (일)</label>
              <input
                type="number" min={0}
                value={data.rangeMax ?? ''}
                onChange={e => update('rangeMax', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full h-9 px-2 text-sm border border-slate-200 rounded focus:border-purple-500 focus:outline-none"
              />
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
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

          {/* 요소별 기여 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                <Info size={11} />
                요소별 공기 기여 분해
              </label>
              <button
                type="button"
                onClick={addFactor}
                className="h-7 px-2 rounded border border-slate-200 hover:bg-slate-50 text-[11px] text-slate-600 inline-flex items-center gap-1"
              >
                <Plus size={11} /> 요소 추가
              </button>
            </div>
            <div className="space-y-2">
              {data.factors.map((f, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start bg-slate-50 border border-slate-200 rounded-lg p-2">
                  <input
                    type="text"
                    placeholder="요소명 (예: 공동주택 20층 기본)"
                    value={f.label}
                    onChange={e => updateFactor(i, { label: e.target.value })}
                    className="col-span-4 h-8 px-2 text-xs border border-slate-200 rounded bg-white"
                  />
                  <input
                    type="text"
                    placeholder="일수 (예: 900~1000, -80~-120)"
                    value={f.days}
                    onChange={e => updateFactor(i, { days: e.target.value })}
                    className="col-span-2 h-8 px-2 text-xs font-mono border border-slate-200 rounded bg-white"
                  />
                  <input
                    type="text"
                    placeholder="근거 메모"
                    value={f.note ?? ''}
                    onChange={e => updateFactor(i, { note: e.target.value })}
                    className="col-span-5 h-8 px-2 text-xs border border-slate-200 rounded bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeFactor(i)}
                    className="col-span-1 h-8 text-slate-400 hover:text-red-500 flex items-center justify-center"
                    title="요소 삭제"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 종합 근거 */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">종합 추정 근거</label>
            <textarea
              value={data.rationale}
              onChange={e => update('rationale', e.target.value)}
              rows={4}
              placeholder="Claude 답변의 rationale 텍스트를 여기에 붙여넣기 (3~5줄)"
              className="w-full p-2 text-sm border border-slate-200 rounded focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* 하단: 삭제 */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={clearAll}
              className="h-7 px-2 text-[11px] text-red-600 hover:bg-red-50 rounded"
            >
              전체 삭제 (AI 추론 없음 상태로)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
