'use client'

// ═══════════════════════════════════════════════════════════
// AI 공기 추론 — DB 캐시 표시 카드 (런타임 API 호출 0건)
//
// 관리자가 /projects/[id]/edit 에서 입력한 aiScheduleEstimate 를
// 읽어 표시만 한다. Claude API 호출·하드코딩 공식 fallback 일체 없음.
//
// 값이 없으면 "관리자 입력 필요" 안내 + /edit 페이지 링크.
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { Sparkles, Calendar, AlertCircle, ExternalLink, Info } from 'lucide-react'
import type { AiScheduleEstimateData } from '@/lib/types/ai-schedule'
import { computeGuidelineRegression, guidelineBenchmark } from '@/lib/engine/guideline'

interface Props {
  projectId?: string | null
  estimate: AiScheduleEstimateData | null | undefined
  /** 현재 CPM 값 (비교용, 있으면 편차 표시) */
  currentCpmDuration?: number
  /** 착공일 (준공일 계산용) */
  startDate?: string
  /** 내부 크로스체크용 — 국토부 회귀식·업계 밴드 재계산 입력 */
  ground?: number
  bldgArea?: number
  type?: string
  /** 공기 구성 내역용 — CPM 결과 태스크 (임계경로 기반 카테고리별 합산) */
  cpmTasks?: Array<{
    name: string
    category?: string | null
    duration: number
    isCritical?: boolean
  }>
}

const CONF_LABEL = { high: '높음', medium: '보통', low: '낮음' }
const CONF_COLOR: Record<string, string> = {
  high:   'bg-emerald-100 text-emerald-700 border-emerald-300',
  medium: 'bg-blue-100    text-blue-700    border-blue-300',
  low:    'bg-amber-100   text-amber-700   border-amber-300',
}

function addDays(iso: string, days: number): string | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  d.setDate(d.getDate() + Math.round(days))
  return d.toLocaleDateString('ko-KR')
}

function pctDiff(a: number, b: number): string {
  if (!b) return '—'
  const pct = Math.round(((a - b) / b) * 100)
  return `${pct >= 0 ? '+' : ''}${pct}%`
}

/** CPM 임계경로 상 태스크들을 카테고리별로 묶어 공기 구성 내역 집계 */
function buildCpmBreakdown(cpmTasks: Props['cpmTasks']) {
  if (!cpmTasks || cpmTasks.length === 0) return null
  const critical = cpmTasks.filter(t => t.isCritical)
  if (critical.length === 0) return null
  const groups = new Map<string, { days: number; count: number; names: string[] }>()
  for (const t of critical) {
    const cat = (t.category || '기타').trim()
    const g = groups.get(cat) ?? { days: 0, count: 0, names: [] }
    g.days += Math.round(t.duration)
    g.count += 1
    if (g.names.length < 3) g.names.push(t.name)
    groups.set(cat, g)
  }
  const rows = Array.from(groups.entries())
    .map(([category, g]) => ({ category, ...g }))
    .sort((a, b) => b.days - a.days)
  const total = rows.reduce((s, r) => s + r.days, 0)
  return { rows, total }
}

export default function AiScheduleCachedCard({
  projectId, estimate, currentCpmDuration, startDate,
  ground, bldgArea, type, cpmTasks,
}: Props) {
  // ─── 추론 없음 ─────────────────────────────────────────
  if (!estimate || !estimate.totalDuration || estimate.totalDuration <= 0) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-5">
        <div className="flex items-start gap-2 mb-2">
          <AlertCircle size={16} className="text-slate-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-700">AI 공기 추론 미입력</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              아직 관리자가 Claude Opus 추론을 입력하지 않았습니다.
              <br />
              <strong>의사결정은 위 CPM 실제 산정값을 기준</strong>으로 하세요.
            </p>
            {projectId && (
              <Link
                href={`/projects/${projectId}/edit`}
                className="inline-flex items-center gap-1 mt-2 text-xs text-purple-700 hover:text-purple-900 font-semibold underline"
              >
                <ExternalLink size={11} />
                /edit 에서 AI 추론 입력
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── 추론 있음 ─────────────────────────────────────────
  const months = Math.round(estimate.totalDuration / 30)
  const minM = estimate.rangeMin ? Math.round(estimate.rangeMin / 30) : null
  const maxM = estimate.rangeMax ? Math.round(estimate.rangeMax / 30) : null
  const confColor = CONF_COLOR[estimate.confidence] ?? CONF_COLOR.medium
  const finishDate = startDate ? addDays(startDate, estimate.totalDuration) : null

  const cpmDelta = currentCpmDuration && currentCpmDuration > 0
    ? {
        days: currentCpmDuration - estimate.totalDuration,
        pct: Math.round(((currentCpmDuration - estimate.totalDuration) / estimate.totalDuration) * 100),
      }
    : null

  return (
    <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-xl p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Sparkles size={16} />
        <span className="text-xs font-bold uppercase tracking-wider opacity-90">
          AI 공기 추론
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/15 border border-white/20`}>
          신뢰도 {CONF_LABEL[estimate.confidence] ?? '—'}
        </span>
        <span className="text-[10px] opacity-70 ml-auto">
          {estimate.estimator} · {estimate.estimatedAt}
        </span>
      </div>

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-3xl sm:text-4xl font-bold font-mono leading-none tabular-nums">
            {months}
            <span className="text-base font-normal opacity-70 ml-1.5">개월</span>
            <span className="text-sm font-normal opacity-60 ml-2">
              ({estimate.totalDuration.toLocaleString()}일)
            </span>
          </p>
          {(minM != null || maxM != null) && (
            <p className="text-xs opacity-80 mt-1.5">
              범위 {minM ?? '—'}~{maxM ?? '—'}개월 ({estimate.rangeMin ?? '—'}~{estimate.rangeMax ?? '—'}일)
            </p>
          )}
          {startDate && finishDate && (
            <p className="text-xs opacity-70 mt-1">
              <Calendar size={11} className="inline mr-1" />
              착공 {startDate} → 준공 예상 {finishDate}
            </p>
          )}
        </div>

        {cpmDelta && (
          <div className="text-right text-xs opacity-90">
            <div className="opacity-70 mb-0.5">CPM 대비 편차</div>
            <div className="font-bold font-mono tabular-nums">
              {cpmDelta.days > 0 ? '+' : ''}{cpmDelta.days}일 ({cpmDelta.pct > 0 ? '+' : ''}{cpmDelta.pct}%)
            </div>
          </div>
        )}
      </div>

      {/* 요소별 분해 */}
      {estimate.factors && estimate.factors.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/15">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-2">
            요소별 공기 기여 분해
          </div>
          <div className="space-y-1">
            {estimate.factors.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs bg-white/10 rounded px-2 py-1.5">
                <span className="flex-1 font-medium">{f.label}</span>
                <span className="font-mono font-bold tabular-nums text-white whitespace-nowrap">
                  {f.days}일
                </span>
                {f.note && (
                  <span
                    title={f.note}
                    className="opacity-60 cursor-help"
                  >
                    <Info size={11} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 종합 근거 */}
      {estimate.rationale && (
        <details className="mt-3">
          <summary className="text-[11px] opacity-70 cursor-pointer hover:opacity-100">
            종합 추정 근거 ▾
          </summary>
          <p className="mt-2 text-[11px] opacity-80 leading-relaxed whitespace-pre-wrap bg-white/5 rounded p-2 border border-white/10">
            {estimate.rationale}
          </p>
        </details>
      )}

      {/* 공기 구성 내역 — CPM 임계경로 카테고리별 합 */}
      {(() => {
        const bd = buildCpmBreakdown(cpmTasks)
        if (!bd) return null
        return (
          <div className="mt-4 pt-4 border-t border-white/15">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-2">
              공기 구성 내역 — CPM 임계경로 기준 (이 값들이 쌓여 총 공기가 됩니다)
            </div>
            <div className="overflow-hidden rounded bg-white/5 border border-white/10">
              <table className="w-full text-[11px]">
                <thead className="bg-white/10 text-white/80">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-semibold">공종 카테고리</th>
                    <th className="text-left px-2 py-1.5 font-semibold">임계 태스크</th>
                    <th className="text-right px-2 py-1.5 font-semibold w-16">일수</th>
                    <th className="text-right px-2 py-1.5 font-semibold w-14">비중</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {bd.rows.map(r => (
                    <tr key={r.category}>
                      <td className="px-2 py-1.5 font-medium whitespace-nowrap">{r.category}</td>
                      <td className="px-2 py-1.5 opacity-80">
                        {r.names.join(', ')}
                        {r.count > r.names.length && (
                          <span className="opacity-60"> 외 {r.count - r.names.length}개</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums">{r.days.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums opacity-70">
                        {bd.total > 0 ? Math.round((r.days / bd.total) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-white/10 font-bold">
                    <td className="px-2 py-1.5" colSpan={2}>임계경로 합계 (CPM 총 공기)</td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums">{bd.total.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right opacity-70">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-[10px] opacity-60 leading-relaxed">
              CPM 임계경로 상 태스크만 집계. 병렬 분기(예: Top-down 지상·지하 동시)는 더 긴 쪽만 반영됨.
              국토부 가이드라인 준비기간(45일)·정리기간(30일)·비작업일수는 별도 카드(가이드라인 참고값) 참조.
            </p>
          </div>
        )
      })()}

      {/* 내부 크로스체크 — 국토부 회귀식·업계 밴드·CPM 과 AI 추론 병치 (접이식) */}
      {(() => {
        const ai = estimate.totalDuration
        const reg = bldgArea && bldgArea > 0
          ? computeGuidelineRegression(type ?? '공동주택', bldgArea)
          : null
        const bench = ground && ground > 0 ? guidelineBenchmark(ground) : null
        const cpm = currentCpmDuration && currentCpmDuration > 0 ? currentCpmDuration : null
        if (!reg?.days && !bench && !cpm) return null
        return (
          <details className="mt-4 pt-4 border-t border-white/15">
            <summary className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-2 cursor-pointer hover:opacity-100">
              내부 크로스체크 (회귀식·업계 밴드 대조) ▾
            </summary>
            <div className="mt-2">
            <div className="overflow-hidden rounded bg-white/5 border border-white/10">
              <table className="w-full text-[11px]">
                <thead className="bg-white/10 text-white/80">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-semibold">근거</th>
                    <th className="text-right px-2 py-1.5 font-semibold">공기(일)</th>
                    <th className="text-right px-2 py-1.5 font-semibold w-16">AI 대비</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  <tr>
                    <td className="px-2 py-1.5 font-medium">AI 추론 (본 카드)</td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums">{ai.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right opacity-50">—</td>
                  </tr>
                  {cpm && (
                    <tr>
                      <td className="px-2 py-1.5">
                        CPM 산정
                        <span className="ml-1 text-[9px] opacity-60">WBS 임계경로 기반</span>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">{cpm.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums opacity-80">{pctDiff(cpm, ai)}</td>
                    </tr>
                  )}
                  {reg?.days && reg.formula && (
                    <tr>
                      <td className="px-2 py-1.5">
                        국토부 회귀식
                        <span
                          className="ml-1 text-[9px] opacity-60 cursor-help"
                          title={`${reg.formula} · 적용범위 ${reg.inRange ? '내' : '밖'}`}
                        >
                          부록 5 {reg.inRange ? '' : '(범위외)'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">{reg.days.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums opacity-80">{pctDiff(reg.days, ai)}</td>
                    </tr>
                  )}
                  {bench && (
                    <tr>
                      <td className="px-2 py-1.5">
                        업계 밴드 {bench.floorRange}
                        <span className="ml-1 text-[9px] opacity-60">실무가이드 p.129</span>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                        {bench.typicalDays[0].toLocaleString()}~{bench.typicalDays[1].toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums opacity-80">
                        {ai < bench.typicalDays[0] ? '밴드 아래'
                          : ai > bench.typicalDays[1] ? '밴드 위'
                          : '밴드 내'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-[10px] opacity-60 leading-relaxed">
              AI 추론이 회귀식·업계 밴드와 크게 벗어나면 신뢰도 재검토 필요. CPM 과의 편차는 현장조건·공법 단축이 반영된 결과이므로 자연스러움.
            </p>
            </div>
          </details>
        )
      })()}

      {projectId && (
        <div className="mt-3 text-right">
          <Link
            href={`/projects/${projectId}/edit`}
            className="inline-flex items-center gap-1 text-[11px] opacity-70 hover:opacity-100"
          >
            <ExternalLink size={10} />
            추론 수정
          </Link>
        </div>
      )}
    </div>
  )
}
