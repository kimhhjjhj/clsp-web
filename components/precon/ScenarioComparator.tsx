'use client'

// ═══════════════════════════════════════════════════════════
// F8. Scenario Comparator
//   공법·생산성 multiplier·가속 조합을 시나리오로 저장하고
//   최대 5개까지 병렬 비교. 기준 시나리오 대비 델타 표시.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, Star, RefreshCw, Copy, ArrowRight } from 'lucide-react'
import CommentThread from '@/components/collab/CommentThread'

interface Scenario {
  id: string
  name: string
  params: {
    method?: string
    multipliers?: { taskId: string; mult: number }[]
    accelerations?: { taskId: string; days: number }[]
    startDate?: string
  }
  result: {
    totalDuration: number
    taskCount: number
    criticalCount: number
    computedAt: string
  }
  baseline: boolean
  createdAt: string
}

const METHOD_LABEL: Record<string, string> = {
  'bottom_up': 'Bottom-up (순타)',
  'semi_top_down': 'Semi Top-down (역타)',
  'full_top_down': 'Full Top-down',
  'up_up': 'Up-Up',
}

export default function ScenarioComparator({ projectId }: { projectId: string }) {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMethod, setNewMethod] = useState<string>('')

  async function load() {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/projects/${projectId}/scenarios`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      setScenarios(j.scenarios ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId])

  async function createScenario() {
    setCreating(true); setError(null)
    try {
      const body = {
        name: newName || undefined,
        params: {
          method: newMethod || undefined,
        },
        baseline: scenarios.length === 0,  // 첫 시나리오는 기준으로
      }
      const r = await fetch(`/api/projects/${projectId}/scenarios`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${r.status}`)
      }
      setNewName(''); setNewMethod('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성 실패')
    } finally { setCreating(false) }
  }

  async function remove(id: string) {
    if (!confirm('이 시나리오를 삭제하시겠습니까?')) return
    await fetch(`/api/projects/${projectId}/scenarios/${id}`, { method: 'DELETE' })
    await load()
  }

  // 최대 5개까지 나란히 표시
  const visible = scenarios.slice(0, 5)
  const baseline = scenarios.find(s => s.baseline) ?? scenarios[scenarios.length - 1]
  const baseDur = baseline?.result.totalDuration

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Copy size={16} className="text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-800">시나리오 비교 (최대 5개)</h3>
          <span className="text-[11px] text-slate-400">공법·multiplier·가속 조합을 나란히</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="h-8 px-2 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-600 inline-flex items-center gap-1"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      {/* 새 시나리오 생성 폼 */}
      {scenarios.length < 5 && (
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-xs font-semibold text-slate-700 mb-2">새 시나리오 평가</div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="시나리오 이름 (예: Top-down 기본)"
              className="h-8 px-2 text-xs border border-slate-200 rounded flex-1 min-w-[200px]"
            />
            <select
              value={newMethod}
              onChange={e => setNewMethod(e.target.value)}
              className="h-8 px-2 text-xs border border-slate-200 rounded"
            >
              <option value="">공법 (프로젝트 기본)</option>
              <option value="bottom_up">Bottom-up</option>
              <option value="semi_top_down">Semi Top-down</option>
              <option value="full_top_down">Full Top-down</option>
              <option value="up_up">Up-Up</option>
            </select>
            <button
              onClick={createScenario}
              disabled={creating}
              className="h-8 px-3 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
            >
              {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              평가·저장
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            ※ 현재 프로젝트의 속성을 그대로 쓰되, 공법(메서드)만 바꿔서 공기 차이를 계산.
            multiplier/가속은 향후 /bid에서 조정 후 &ldquo;스냅샷 → 시나리오 저장&rdquo; 흐름 예정.
          </p>
        </div>
      )}

      {/* 카드 그리드 — 최대 5개 */}
      {loading ? (
        <div className="p-6 text-center text-xs text-slate-400">
          <Loader2 size={14} className="animate-spin mx-auto mb-2" /> 시나리오 로드 중...
        </div>
      ) : visible.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
          저장된 시나리오 없음. 위 폼에서 첫 시나리오를 만드세요 (기준으로 지정됩니다).
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {visible.map(s => {
            const delta = baseDur != null && !s.baseline ? s.result.totalDuration - baseDur : null
            const deltaPct = baseDur != null && baseDur > 0 && !s.baseline
              ? Math.round(((s.result.totalDuration - baseDur) / baseDur) * 1000) / 10
              : null
            return (
              <div key={s.id} className={`rounded-xl border p-3 bg-white ${
                s.baseline ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1">
                    {s.baseline && <Star size={12} className="text-amber-500 fill-amber-500" />}
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${
                      s.baseline ? 'text-amber-700' : 'text-slate-500'
                    }`}>
                      {s.baseline ? '기준' : '시나리오'}
                    </span>
                  </div>
                  <button
                    onClick={() => remove(s.id)}
                    className="text-slate-300 hover:text-red-500"
                    title="삭제"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1 truncate" title={s.name}>{s.name}</h4>
                <div className="text-[11px] text-slate-500 mb-2">
                  {s.params.method ? METHOD_LABEL[s.params.method] : '프로젝트 기본 공법'}
                </div>
                <div className="flex items-end gap-2 mb-2 flex-wrap">
                  <span className="text-2xl font-bold text-slate-900 tabular-nums">
                    {Math.round(s.result.totalDuration / 30)}
                  </span>
                  <span className="text-xs text-slate-500 mb-1">개월</span>
                  <span className="text-[10px] text-slate-400 mb-1">
                    ({s.result.totalDuration}일)
                  </span>
                  {delta !== null && delta !== 0 && (
                    <span className={`text-xs font-semibold ml-auto mb-1 ${
                      delta < 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {delta > 0 ? '+' : ''}{delta}일
                      {deltaPct != null && ` (${deltaPct > 0 ? '+' : ''}${deltaPct}%)`}
                    </span>
                  )}
                </div>
                <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-500 space-y-0.5">
                  <div className="flex justify-between">
                    <span>공종</span>
                    <span className="font-mono tabular-nums text-slate-700">{s.result.taskCount}개</span>
                  </div>
                  <div className="flex justify-between">
                    <span>크리티컬</span>
                    <span className="font-mono tabular-nums text-orange-600">{s.result.criticalCount}개</span>
                  </div>
                  {(s.params.multipliers?.length ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span>multiplier</span>
                      <span className="font-mono tabular-nums">{s.params.multipliers!.length}건</span>
                    </div>
                  )}
                  {(s.params.accelerations?.length ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span>가속</span>
                      <span className="font-mono tabular-nums">{s.params.accelerations!.length}건</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 비교 테이블 */}
      {visible.length >= 2 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-800">
            병렬 비교표
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">지표</th>
                  {visible.map(s => (
                    <th key={s.id} className="text-right px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">
                      {s.baseline && '⭐ '}{s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500">공법</td>
                  {visible.map(s => (
                    <td key={s.id} className="px-3 py-2 text-right">
                      {s.params.method ? METHOD_LABEL[s.params.method] : '기본'}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500">총공기</td>
                  {visible.map(s => (
                    <td key={s.id} className="px-3 py-2 text-right font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                      {Math.round(s.result.totalDuration / 30)}개월
                      <span className="text-[10px] font-normal text-slate-400 ml-1">({s.result.totalDuration}일)</span>
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500">공기 델타</td>
                  {visible.map(s => {
                    const d = baseDur != null && !s.baseline ? s.result.totalDuration - baseDur : null
                    return (
                      <td key={s.id} className={`px-3 py-2 text-right font-mono font-semibold tabular-nums ${
                        d === null ? 'text-amber-600' : d < 0 ? 'text-emerald-600' : d > 0 ? 'text-red-600' : 'text-slate-400'
                      }`}>
                        {d === null ? '기준' : d > 0 ? `+${d}` : d}
                      </td>
                    )
                  })}
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500">크리티컬</td>
                  {visible.map(s => (
                    <td key={s.id} className="px-3 py-2 text-right font-mono text-orange-600 tabular-nums">
                      {s.result.criticalCount}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 시나리오 비교에 대한 협업 토론 */}
      {visible.length > 0 && (
        <CommentThread
          entityType="scenario-comparison"
          entityId={projectId}
          title="시나리오 선택 논의"
        />
      )}
    </div>
  )
}

void ArrowRight
