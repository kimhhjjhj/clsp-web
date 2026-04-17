// ═══════════════════════════════════════════════════════════
// 자원 계획 생성: CPM 결과 + 회사 실적 → 일별·공종별 투입 인원
//
// 로직:
//   1) 각 WBS 공종에 대해 WBS_TRADE_MAP으로 관련 trade 목록 조회
//   2) 각 trade의 과거 평균 투입 인원(man/day)을 회사 표준에서 찾음
//   3) 공종 수행 기간(ES ~ EF) 동안 해당 인원이 매일 투입된다고 가정
//   4) 일자별로 전체 trade 투입 인원 합산
//
// 주의: 이 값은 "과거 실적 기반 추정"이지 확정치가 아님. UI에서 강조.
// ═══════════════════════════════════════════════════════════

import { WBS_TRADE_MAP } from './wbs-trade-map'
import type { CPMResult } from '@/lib/types'

export interface StandardLookup {
  trade: string
  unit: string
  value: number
  approved: boolean
  sampleCount?: number
}

export interface DailyTradeLoad {
  trade: string
  workers: number      // 가중평균 기반 추정 투입 인원
  taskNames: string[]  // 이 인원을 유발한 WBS 공종들
  approved: boolean    // 모든 근거 표준이 승인됐는지
}

export interface DailyResourcePoint {
  day: number                     // 프로젝트 시작 기준 N일 (0부터)
  date?: string                   // ISO 날짜 (startDate 주어진 경우)
  total: number                   // 총 투입 인원
  trades: DailyTradeLoad[]        // 공종별 내역
  activeTaskCount: number         // 이 날 진행 중인 WBS 공종 수
}

export interface ResourcePlan {
  startDate?: string
  totalDuration: number           // 전체 공기 (일)
  days: DailyResourcePoint[]
  peak: { day: number; date?: string; count: number }
  avgDaily: number                // 전체 평균 투입
  totalManDays: number            // 총 인일
  uncoveredTasks: string[]        // 회사 실적이 없어서 추정 못 한 WBS 공종
  monthlyTotals: { month: string; total: number; activeDays: number }[]
}

/** trade 별 단일 값 lookup (가중평균 계산용) */
function buildTradeStats(standards: StandardLookup[]): Map<string, { value: number; approved: boolean; samples: number }> {
  const m = new Map<string, { value: number; approved: boolean; samples: number }>()
  for (const s of standards) {
    if (s.unit !== 'man/day') continue
    const prev = m.get(s.trade)
    // 같은 trade에 승인/미승인이 모두 있으면 승인본 우선
    if (prev && prev.approved && !s.approved) continue
    m.set(s.trade, { value: s.value, approved: s.approved, samples: s.sampleCount ?? 1 })
  }
  return m
}

/** 하루 단위로 프로젝트 기간을 순회하며 투입 인원 계산 */
export function buildResourcePlan(
  tasks: CPMResult[],
  standards: StandardLookup[],
  startDate?: string,
): ResourcePlan {
  const stdMap = buildTradeStats(standards)

  // 전체 공기 = 가장 큰 EF
  const totalDuration = Math.ceil(Math.max(0, ...tasks.map(t => t.EF)))

  // 각 WBS 공종이 이 날짜에 활성인가?
  //   task.ES <= day < task.EF
  const days: DailyResourcePoint[] = []
  const baseDate = startDate ? new Date(startDate) : undefined
  const uncovered = new Set<string>()

  // 공종별 인원 미리 계산 (공종 이름 → { trade: workers }[])
  type TaskLoad = { trades: { trade: string; workers: number; approved: boolean }[]; missing: boolean }
  const taskLoadCache = new Map<string, TaskLoad>()
  for (const t of tasks) {
    if (taskLoadCache.has(t.name)) continue
    const related = WBS_TRADE_MAP[t.name] ?? []
    const tradeLoads: { trade: string; workers: number; approved: boolean }[] = []
    for (const tr of related) {
      const hit = stdMap.get(tr)
      if (hit && hit.value > 0) {
        tradeLoads.push({ trade: tr, workers: hit.value, approved: hit.approved })
      }
    }
    if (tradeLoads.length === 0 && related.length > 0) {
      uncovered.add(t.name)
    }
    taskLoadCache.set(t.name, { trades: tradeLoads, missing: tradeLoads.length === 0 })
  }

  // 공종 중복 trade 처리: 같은 날 여러 WBS가 동시 진행 중일 때,
  // 같은 trade가 여러 WBS에서 불려도 그대로 합산 (중복 투입으로 간주)
  let totalManDays = 0
  let peak = { day: 0, count: 0 }

  for (let d = 0; d < totalDuration; d++) {
    const active = tasks.filter(t => t.ES <= d && d < t.EF)
    const tradeAgg = new Map<string, DailyTradeLoad>()
    for (const t of active) {
      const load = taskLoadCache.get(t.name)
      if (!load) continue
      for (const tl of load.trades) {
        const cur = tradeAgg.get(tl.trade) ?? {
          trade: tl.trade,
          workers: 0,
          taskNames: [],
          approved: true,
        }
        cur.workers += tl.workers
        if (!cur.taskNames.includes(t.name)) cur.taskNames.push(t.name)
        if (!tl.approved) cur.approved = false
        tradeAgg.set(tl.trade, cur)
      }
    }
    const dayTrades = Array.from(tradeAgg.values()).sort((a, b) => b.workers - a.workers)
    const dayTotal = Math.round(dayTrades.reduce((s, x) => s + x.workers, 0) * 10) / 10
    totalManDays += dayTotal

    let date: string | undefined
    if (baseDate) {
      const dd = new Date(baseDate)
      dd.setDate(dd.getDate() + d)
      date = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`
    }

    if (dayTotal > peak.count) peak = { day: d, count: dayTotal }

    days.push({
      day: d,
      date,
      total: dayTotal,
      trades: dayTrades.map(t => ({ ...t, workers: Math.round(t.workers * 10) / 10 })),
      activeTaskCount: active.length,
    })
  }

  // 월별 집계 (date 있을 때만)
  const monthMap = new Map<string, { total: number; activeDays: number }>()
  for (const d of days) {
    if (!d.date) continue
    const m = d.date.slice(0, 7)
    const cur = monthMap.get(m) ?? { total: 0, activeDays: 0 }
    cur.total += d.total
    if (d.total > 0) cur.activeDays += 1
    monthMap.set(m, cur)
  }
  const monthlyTotals = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, total: Math.round(v.total * 10) / 10, activeDays: v.activeDays }))

  return {
    startDate,
    totalDuration,
    days,
    peak: {
      day: peak.day,
      date: days[peak.day]?.date,
      count: Math.round(peak.count * 10) / 10,
    },
    avgDaily: totalDuration > 0 ? Math.round((totalManDays / totalDuration) * 10) / 10 : 0,
    totalManDays: Math.round(totalManDays * 10) / 10,
    uncoveredTasks: Array.from(uncovered),
    monthlyTotals,
  }
}
