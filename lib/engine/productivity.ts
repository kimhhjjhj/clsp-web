/**
 * 생산성 조정 엔진
 * claude1.py ProductivityPage 포팅
 *
 * 각 태스크에 multiplier(50%~200%)를 적용:
 *   adjusted_duration = original_duration / multiplier
 *   - 생산성 기반: adjusted_productivity = original * multiplier
 *   - 표준일수 기반: adjusted_stdDays = original / multiplier
 */
import type { WBSTask, CPMSummary } from '@/lib/types'
import { calculateCPM } from './cpm'

export interface ProductivityAdjustment {
  taskId: string
  multiplier: number  // 0.5 ~ 2.0 (1.0 = 변동 없음)
}

export interface ProductivityResult {
  originalDuration: number
  adjustedDuration: number
  difference: number       // adjusted - original (음수 = 단축)
  modifiedCount: number
  originalTasks: { id: string; name: string; category: string; duration: number; isCritical: boolean }[]
  adjustedTasks: { id: string; name: string; category: string; duration: number; isCritical: boolean }[]
  adjustedCPM: CPMSummary
}

export function adjustProductivity(
  tasks: WBSTask[],
  adjustments: ProductivityAdjustment[],
): ProductivityResult {
  // 원본 CPM
  const originalCPM = calculateCPM(tasks)

  // adjustment map
  const adjMap = new Map<string, number>()
  for (const a of adjustments) {
    if (Math.abs(a.multiplier - 1.0) > 0.001) adjMap.set(a.taskId, a.multiplier)
  }

  // 생산성 적용
  const adjustedTasks: WBSTask[] = tasks.map(t => {
    const mult = adjMap.get(t.id) ?? 1.0
    if (mult === 1.0) return { ...t }
    return {
      ...t,
      duration: Math.max(1, Math.round((t.duration / mult) * 10) / 10),
    }
  })

  const adjustedCPM = calculateCPM(adjustedTasks)

  const origMap = new Map(originalCPM.tasks.map(t => [t.taskId, t]))
  const adjCpmMap = new Map(adjustedCPM.tasks.map(t => [t.taskId, t]))

  return {
    originalDuration: originalCPM.totalDuration,
    adjustedDuration: adjustedCPM.totalDuration,
    difference: adjustedCPM.totalDuration - originalCPM.totalDuration,
    modifiedCount: adjMap.size,
    originalTasks: tasks.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      duration: t.duration,
      isCritical: origMap.get(t.id)?.isCritical ?? false,
    })),
    adjustedTasks: adjustedTasks.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      duration: t.duration,
      isCritical: adjCpmMap.get(t.id)?.isCritical ?? false,
    })),
    adjustedCPM,
  }
}
