'use client'

import { useMemo } from 'react'
import { Activity, ShieldAlert, TrendingUp, Zap, Calendar } from 'lucide-react'
import type { CPMSummary } from '@/lib/types'

interface Risk {
  id: string
  type: string       // 'risk' | 'opportunity'
  category: string
  impactType: string  // 'schedule' | 'cost'
  impactDays: number | null
  probability: number
  status: string
}

interface Accel {
  id: string
  category: string
  days: number
  method: string
}

interface Props {
  projectId: string
  cpmResult: CPMSummary | null
  risks: Risk[]
  accelerations: Accel[]
  startDate?: string
}

export default function ScenarioDashboard({ cpmResult, risks, accelerations, startDate }: Props) {
  const scenarios = useMemo(() => {
    if (!cpmResult) return null

    const baseDuration = cpmResult.totalDuration

    // 활성 리스크만 집계 (closed 제외)
    const activeRisks = risks.filter(r => r.status !== 'closed' && r.impactType === 'schedule')
    const scheduleRisks = activeRisks.filter(r => r.type === 'risk')
    const scheduleOpps = activeRisks.filter(r => r.type === 'opportunity')

    // 기대값 (확률 가중) — 현실 시나리오
    const expectedRiskDays = scheduleRisks.reduce(
      (s, r) => s + ((r.probability / 100) * (r.impactDays ?? 0)), 0,
    )
    const expectedOppDays = scheduleOpps.reduce(
      (s, r) => s + ((r.probability / 100) * (r.impactDays ?? 0)), 0,
    )

    // 최악 시나리오 (모든 리스크 발생, 기회 없음)
    const worstRiskDays = scheduleRisks.reduce((s, r) => s + (r.impactDays ?? 0), 0)

    // 최선 시나리오 (리스크 없음, 모든 기회 + 단축공법 적용)
    const bestOppDays = scheduleOpps.reduce((s, r) => s + (r.impactDays ?? 0), 0)

    // Acceleration — CP 공종에 매칭되는 단축 공법
    const cpTasks = cpmResult.tasks.filter(t => t.isCritical)
    const applicableAccel: { method: string; days: number; task: string }[] = []
    for (const task of cpTasks) {
      const match = accelerations.find(
        a => a.category === task.category || task.name.includes(a.category),
      )
      if (match) applicableAccel.push({ method: match.method, days: match.days, task: task.name })
    }
    const accelDays = applicableAccel.reduce((s, x) => s + x.days, 0)

    return {
      base: baseDuration,
      expected: Math.round(baseDuration + expectedRiskDays - expectedOppDays),
      worst: Math.round(baseDuration + worstRiskDays),
      best: Math.max(1, Math.round(baseDuration - bestOppDays - accelDays)),
      expectedRiskDays: Math.round(expectedRiskDays * 10) / 10,
      expectedOppDays: Math.round(expectedOppDays * 10) / 10,
      worstRiskDays,
      bestOppDays,
      accelDays,
      applicableAccel,
      scheduleRiskCount: scheduleRisks.length,
      scheduleOppCount: scheduleOpps.length,
    }
  }, [cpmResult, risks, accelerations])

  function offsetDate(days: number): string | null {
    if (!startDate) return null
    const d = new Date(startDate)
    d.setDate(d.getDate() + days)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  if (!cpmResult || !scenarios) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
        <Activity size={20} className="mx-auto mb-2 text-gray-300" />
        1단계 CPM 계산 후 시나리오 비교를 볼 수 있습니다.
      </div>
    )
  }

  const { base, expected, worst, best } = scenarios
  const deltaExpected = expected - base
  const maxSpan = Math.max(worst, expected, base, 1)

  return (
    <div className="bg-gradient-to-br from-slate-50 to-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Activity size={14} className="text-blue-600" />
          공기 시나리오 비교
        </h3>
        <span className="text-[10px] text-gray-400">
          리스크·기회·단축공법을 반영한 4가지 시나리오
        </span>
      </div>

      {/* 4가지 시나리오 카드 — 모바일은 가로 스크롤, md 이상은 4등분 */}
      <div className="flex gap-3 mb-5 overflow-x-auto pb-2 -mx-1 px-1 md:grid md:grid-cols-4 md:overflow-visible md:pb-0 md:mx-0 md:px-0 snap-x snap-mandatory">
        <ScenarioCard
          label="기본 계획"
          value={base}
          endDate={offsetDate(base)}
          icon={<Calendar size={11} className="text-gray-500" />}
          barColor="#64748b"
          barRatio={base / maxSpan}
          sub="1단계 CPM 결과"
        />
        <ScenarioCard
          label="예상 (확률 가중)"
          value={expected}
          endDate={offsetDate(expected)}
          icon={<TrendingUp size={11} className="text-blue-500" />}
          barColor="#2563eb"
          barRatio={expected / maxSpan}
          delta={deltaExpected}
          sub={`리스크 +${scenarios.expectedRiskDays}일 · 기회 -${scenarios.expectedOppDays}일`}
          highlight
        />
        <ScenarioCard
          label="최악 (리스크 전체 발생)"
          value={worst}
          endDate={offsetDate(worst)}
          icon={<ShieldAlert size={11} className="text-red-500" />}
          barColor="#dc2626"
          barRatio={worst / maxSpan}
          delta={worst - base}
          sub={`${scenarios.scheduleRiskCount}건 × 영향일수 합산`}
        />
        <ScenarioCard
          label="최선 (단축 + 기회)"
          value={best}
          endDate={offsetDate(best)}
          icon={<Zap size={11} className="text-green-500" />}
          barColor="#16a34a"
          barRatio={best / maxSpan}
          delta={best - base}
          sub={`기회 -${scenarios.bestOppDays}일 · 단축 -${scenarios.accelDays}일`}
        />
      </div>

      {/* 단축공법 내역 */}
      {scenarios.applicableAccel.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-green-800 mb-1.5 flex items-center gap-1">
            <Zap size={11} /> 크리티컬 패스에 적용 가능한 단축공법
          </p>
          <div className="flex flex-wrap gap-1.5">
            {scenarios.applicableAccel.slice(0, 8).map((a, i) => (
              <span key={i} className="text-[11px] bg-white border border-green-200 text-green-700 px-2 py-0.5 rounded">
                {a.task} · {a.method} <span className="font-mono font-semibold">-{a.days}일</span>
              </span>
            ))}
            {scenarios.applicableAccel.length > 8 && (
              <span className="text-[11px] text-green-600">+{scenarios.applicableAccel.length - 8}건</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ScenarioCard({
  label, value, endDate, icon, barColor, barRatio, delta, sub, highlight,
}: {
  label: string
  value: number
  endDate: string | null
  icon: React.ReactNode
  barColor: string
  barRatio: number
  delta?: number
  sub?: string
  highlight?: boolean
}) {
  return (
    <div className={`flex-shrink-0 w-[180px] md:w-auto snap-start border rounded-xl p-3 ${
      highlight ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900 tabular-nums">{value}</span>
        <span className="text-xs text-gray-400">일</span>
        {delta !== undefined && delta !== 0 && (
          <span className={`ml-1 text-[10px] font-semibold ${delta > 0 ? 'text-red-600' : 'text-green-600'}`}>
            ({delta > 0 ? '+' : ''}{delta})
          </span>
        )}
      </div>
      {endDate && <p className="text-[10px] text-gray-500 mt-0.5 whitespace-nowrap">~ {endDate}</p>}
      {/* 상대 길이 바 */}
      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(5, barRatio * 100)}%`, background: barColor }} />
      </div>
      {sub && <p className="text-[10px] text-gray-400 mt-1.5 leading-tight truncate" title={sub}>{sub}</p>}
    </div>
  )
}
