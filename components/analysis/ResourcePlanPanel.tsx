'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Users, TrendingUp, Calendar, AlertTriangle, BarChart3, Info } from 'lucide-react'
import type { CPMResult } from '@/lib/types'
import { buildResourcePlan, type StandardLookup } from '@/lib/engine/resource-plan'
import { WBS_TRADE_MAP } from '@/lib/engine/wbs-trade-map'
import { FullscreenToggle, fullscreenClass, useFullscreen } from '@/components/common/Fullscreen'

interface Props {
  cpmTasks: CPMResult[] | null
  startDate?: string
  standards: StandardLookup[]
}

export default function ResourcePlanPanel({ cpmTasks, startDate, standards }: Props) {
  const { fullscreen, toggle: toggleFullscreen } = useFullscreen()
  const plan = useMemo(() => {
    if (!cpmTasks || cpmTasks.length === 0) return null
    return buildResourcePlan(cpmTasks, standards, startDate)
  }, [cpmTasks, standards, startDate])

  if (!cpmTasks || cpmTasks.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
        <Users size={24} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm">WBS/CPM 계산을 먼저 실행해주세요</p>
      </div>
    )
  }
  if (!plan) return null

  // 미커버 공종 비율
  const uncoveredRatio = cpmTasks.length > 0
    ? Math.round((plan.uncoveredTasks.length / cpmTasks.length) * 100)
    : 0

  return (
    <div className={`relative space-y-5 ${fullscreenClass(fullscreen)}`}>
      <div className="absolute top-2 right-2 z-30">
        <FullscreenToggle fullscreen={fullscreen} onToggle={toggleFullscreen} />
      </div>
      {/* 안내 */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-xs text-purple-900 flex items-start gap-2">
        <Info size={14} className="text-purple-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold mb-1">자원 계획 — 회사 실적 기반 추정</p>
          <p className="text-purple-700 leading-relaxed">
            각 WBS 공종 수행 기간 동안 회사 과거 실적의 평균 투입 인원이 매일 투입된다고 가정하여
            일별·공종별 필요 인력을 산출합니다. 확정치가 아닌 과거 데이터 기반 <strong>추정</strong>이며,
            회사 실적 DB에 관련 공종 표준이 없는 WBS는 집계에서 제외됩니다.
          </p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        <KPI
          label="총 공기"
          value={`${plan.totalDuration}일`}
          sub={plan.startDate ? `시작 ${plan.startDate}` : '시작일 미지정'}
          icon={<Calendar size={12} className="text-blue-500" />}
        />
        <KPI
          label="피크 투입"
          value={`${plan.peak.count}명`}
          sub={plan.peak.date ?? `${plan.peak.day + 1}일차`}
          icon={<TrendingUp size={12} className="text-orange-500" />}
          strong="text-orange-700"
        />
        <KPI
          label="일평균 투입"
          value={`${plan.avgDaily}명`}
          sub={`누적 ${plan.totalManDays.toLocaleString()} 인일`}
          icon={<Users size={12} className="text-purple-500" />}
        />
        <KPI
          label="커버리지"
          value={`${100 - uncoveredRatio}%`}
          sub={plan.uncoveredTasks.length > 0
            ? `${plan.uncoveredTasks.length}개 공종 표준 없음`
            : '전 공종 커버'}
          icon={<AlertTriangle size={12} className={uncoveredRatio > 0 ? 'text-amber-500' : 'text-green-500'} />}
          strong={uncoveredRatio > 0 ? 'text-amber-700' : 'text-green-700'}
        />
      </div>

      {/* 일일 투입 인원 곡선 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <BarChart3 size={14} className="text-purple-500" />
          일별 투입 인원 곡선
        </h3>
        <DailyCurve plan={plan} />
      </div>

      {/* 월별 집계 */}
      {plan.monthlyTotals.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-900">월별 필요 인력</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">월</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">총 인일</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">활동일수</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">일평균</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">상대 규모</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const maxM = Math.max(...plan.monthlyTotals.map(m => m.total), 1)
                return plan.monthlyTotals.map(m => (
                  <tr key={m.month}>
                    <td className="px-4 py-2 text-gray-900 font-mono">{m.month}</td>
                    <td className="text-right px-4 py-2 font-mono">{m.total.toLocaleString()}</td>
                    <td className="text-right px-4 py-2 text-xs text-gray-500">{m.activeDays}일</td>
                    <td className="text-right px-4 py-2 font-mono text-sm">
                      {m.activeDays > 0 ? Math.round((m.total / m.activeDays) * 10) / 10 : 0}명
                    </td>
                    <td className="px-4 py-2">
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full bg-purple-500" style={{ width: `${(m.total / maxM) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* 피크 시점 공종 내역 */}
      {plan.peak.count > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-orange-50">
            <h3 className="text-sm font-bold text-orange-900">
              피크 시점 구성 ({plan.peak.date ?? `${plan.peak.day + 1}일차`} · {plan.peak.count}명)
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">공종 (trade)</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">인원</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">유발 WBS 공종</th>
              </tr>
            </thead>
            <tbody>
              {plan.days[plan.peak.day]?.trades.map(t => (
                <tr key={t.trade}>
                  <td className="px-4 py-2 text-gray-900">
                    {t.trade}
                    {!t.approved && (
                      <span className="ml-1.5 text-[9px] bg-amber-100 text-amber-700 px-1 rounded">대기</span>
                    )}
                  </td>
                  <td className="text-right px-4 py-2 font-mono font-semibold">{t.workers}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{t.taskNames.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 커버 못한 공종 안내 */}
      {plan.uncoveredTasks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
          <p className="font-semibold text-amber-900 mb-2 flex items-center gap-1.5">
            <AlertTriangle size={13} /> 회사 실적 없는 공종 ({plan.uncoveredTasks.length}개)
          </p>
          <p className="text-xs text-amber-800 mb-2">
            아래 공종은 회사 실적 DB에 관련 trade 표준이 없어 인원 추정에서 제외되었습니다.
            admin/productivity에서 승인하면 자동 반영됩니다.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {plan.uncoveredTasks.map(name => (
              <span key={name} className="text-[11px] bg-white border border-amber-200 text-amber-800 px-2 py-0.5 rounded">
                {name}
                {WBS_TRADE_MAP[name]?.length ? (
                  <span className="text-amber-400 ml-1">· 매핑: {WBS_TRADE_MAP[name].slice(0, 2).join('/')}</span>
                ) : (
                  <span className="text-amber-400 ml-1">· 매핑없음</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function KPI({
  label, value, sub, icon, strong,
}: {
  label: string; value: string; sub?: string; icon?: React.ReactNode; strong?: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase">
        {icon}{label}
      </div>
      <p className={`text-xl font-bold mt-1 ${strong ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5 truncate" title={sub}>{sub}</p>}
    </div>
  )
}

// ── 일별 투입 인원 curve (Canvas) ────────────────────────────
function DailyCurve({ plan }: { plan: ReturnType<typeof buildResourcePlan> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.clientWidth || 800
    const H = 240
    const PAD_L = 48
    const PAD_R = 16
    const PAD_T = 16
    const PAD_B = 36
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, W, H)

    const days = plan.days
    const n = days.length
    if (n === 0) return

    const maxY = Math.max(...days.map(d => d.total), 1)
    const plotW = W - PAD_L - PAD_R
    const plotH = H - PAD_T - PAD_B
    const xStep = plotW / Math.max(1, n - 1)
    const toX = (i: number) => PAD_L + i * xStep
    const toY = (v: number) => PAD_T + plotH * (1 - v / maxY)

    // 그리드
    ctx.strokeStyle = '#f1f5f9'
    ctx.lineWidth = 1
    for (let g = 0; g <= 4; g++) {
      const y = PAD_T + (plotH * g) / 4
      ctx.beginPath()
      ctx.moveTo(PAD_L, y)
      ctx.lineTo(W - PAD_R, y)
      ctx.stroke()
      ctx.fillStyle = '#94a3b8'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      const vLabel = Math.round((maxY * (4 - g)) / 4)
      ctx.fillText(String(vLabel), PAD_L - 6, y + 3)
    }

    // 영역 fill
    const grad = ctx.createLinearGradient(0, PAD_T, 0, H - PAD_B)
    grad.addColorStop(0, 'rgba(124,58,237,0.4)')
    grad.addColorStop(1, 'rgba(124,58,237,0.02)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(toX(0), H - PAD_B)
    for (let i = 0; i < n; i++) ctx.lineTo(toX(i), toY(days[i].total))
    ctx.lineTo(toX(n - 1), H - PAD_B)
    ctx.closePath()
    ctx.fill()

    // 라인
    ctx.strokeStyle = '#7c3aed'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const x = toX(i)
      const y = toY(days[i].total)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // 피크 마커
    ctx.fillStyle = '#ea580c'
    ctx.beginPath()
    ctx.arc(toX(plan.peak.day), toY(plan.peak.count), 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()

    // 피크 라벨
    ctx.fillStyle = '#ea580c'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    const pt = toX(plan.peak.day)
    const pv = toY(plan.peak.count)
    ctx.fillText(`피크 ${plan.peak.count}명`, pt, Math.max(14, pv - 8))

    // x축 라벨 (5~7개 정도)
    const labelCount = Math.min(7, n)
    ctx.fillStyle = '#64748b'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    for (let k = 0; k < labelCount; k++) {
      const i = Math.round(((n - 1) * k) / Math.max(1, labelCount - 1))
      const label = days[i].date ?? `D+${days[i].day}`
      ctx.fillText(label.slice(-5) === '01' || k === 0 || k === labelCount - 1 ? label : label.slice(-5), toX(i), H - PAD_B + 14)
    }

    // hover 라인
    if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < n) {
      const x = toX(hoverIdx)
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(x, PAD_T)
      ctx.lineTo(x, H - PAD_B)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = '#1e293b'
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      const p = days[hoverIdx]
      const y = toY(p.total)
      ctx.beginPath()
      ctx.arc(x, y, 3.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }, [plan, hoverIdx])

  const days = plan.days

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={e => {
          const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
          const x = e.clientX - rect.left
          const plotLeft = 48
          const plotW = rect.width - 48 - 16
          const pct = Math.max(0, Math.min(1, (x - plotLeft) / plotW))
          const idx = Math.round(pct * (days.length - 1))
          setHoverIdx(idx)
        }}
        onMouseLeave={() => setHoverIdx(null)}
      />
      {hoverIdx !== null && days[hoverIdx] && (
        <div className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-gray-700">
              {days[hoverIdx].date ?? `${days[hoverIdx].day + 1}일차`}
            </span>
            <span className="text-purple-700 font-mono font-bold">
              총 {days[hoverIdx].total}명 · {days[hoverIdx].activeTaskCount}개 공종 진행
            </span>
          </div>
          {days[hoverIdx].trades.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {days[hoverIdx].trades.slice(0, 8).map(t => (
                <span key={t.trade} className="bg-white border border-gray-200 text-[10px] px-1.5 py-0.5 rounded">
                  {t.trade} <span className="font-mono text-purple-700">{t.workers}</span>
                </span>
              ))}
              {days[hoverIdx].trades.length > 8 && (
                <span className="text-[10px] text-gray-400">+{days[hoverIdx].trades.length - 8}개</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
