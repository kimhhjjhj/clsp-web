// ═══════════════════════════════════════════════════════════
// F1. CPM Intelligence Timeline — 스냅샷 저장/조회/diff 유틸
//
// generateWBS / calculateCPM 엔진은 변경하지 않음.
// 이 모듈은 '결과 저장 + 두 스냅샷 간 비교' 만 담당.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { CPMResult } from '@/lib/types'

export type SnapshotTrigger = 'manual' | 'daily-report' | 'wbs-edit' | 'initial' | 'bid-estimate'

/** CPM 결과를 스냅샷 테이블에 저장. 실패해도 호출자에 예외 전파하지 않음 (best-effort). */
export async function saveCpmSnapshot(opts: {
  projectId: string
  totalDuration: number
  tasks: CPMResult[]
  trigger: SnapshotTrigger
  triggerRef?: string
  note?: string
}): Promise<string | null> {
  try {
    const critIds = opts.tasks.filter(t => t.isCritical).map(t => t.taskId)
    const taskSnap = opts.tasks.map(t => ({
      taskId: t.taskId,
      name: t.name,
      category: t.category,
      ES: t.ES,
      EF: t.EF,
      duration: t.duration,
      isCritical: t.isCritical,
    }))
    const row = await prisma.cpmSnapshot.create({
      data: {
        projectId: opts.projectId,
        totalDuration: Math.round(opts.totalDuration),
        criticalTaskIds: critIds,
        tasksSnapshot: taskSnap,
        triggerEvent: opts.trigger,
        triggerRef: opts.triggerRef,
        note: opts.note,
      },
      select: { id: true },
    })
    return row.id
  } catch (e) {
    console.warn('[cpm-snapshot] save failed:', (e as Error).message)
    return null
  }
}

export interface SnapshotDiff {
  from: { id: string; capturedAt: Date; totalDuration: number }
  to:   { id: string; capturedAt: Date; totalDuration: number }
  durationDelta: number            // to - from
  addedCritical:   { taskId: string; name: string }[]
  removedCritical: { taskId: string; name: string }[]
  shiftedTasks: {
    taskId: string; name: string
    oldES: number; newES: number; deltaES: number
    oldDuration: number; newDuration: number; deltaDuration: number
  }[]
  addedTasks:   { taskId: string; name: string }[]
  removedTasks: { taskId: string; name: string }[]
}

interface TaskSnap {
  taskId: string; name: string; category: string
  ES: number; EF: number; duration: number; isCritical: boolean
}

/** 두 스냅샷 간 diff. 변동 공종·크리티컬 변화·총공기 델타 계산. */
export async function diffSnapshots(fromId: string, toId: string): Promise<SnapshotDiff | null> {
  const [from, to] = await Promise.all([
    prisma.cpmSnapshot.findUnique({ where: { id: fromId } }),
    prisma.cpmSnapshot.findUnique({ where: { id: toId } }),
  ])
  if (!from || !to) return null

  const fromTasks = (from.tasksSnapshot as unknown as TaskSnap[]) ?? []
  const toTasks   = (to.tasksSnapshot   as unknown as TaskSnap[]) ?? []
  const fromMap = new Map(fromTasks.map(t => [t.taskId, t]))
  const toMap   = new Map(toTasks.map(t => [t.taskId, t]))
  const fromCrit = new Set(fromTasks.filter(t => t.isCritical).map(t => t.taskId))
  const toCrit   = new Set(toTasks.filter(t => t.isCritical).map(t => t.taskId))

  const addedCritical   = toTasks.filter(t => t.isCritical && !fromCrit.has(t.taskId))
                                 .map(t => ({ taskId: t.taskId, name: t.name }))
  const removedCritical = fromTasks.filter(t => t.isCritical && !toCrit.has(t.taskId))
                                   .map(t => ({ taskId: t.taskId, name: t.name }))
  const addedTasks   = toTasks.filter(t => !fromMap.has(t.taskId))
                              .map(t => ({ taskId: t.taskId, name: t.name }))
  const removedTasks = fromTasks.filter(t => !toMap.has(t.taskId))
                                .map(t => ({ taskId: t.taskId, name: t.name }))

  const shiftedTasks: SnapshotDiff['shiftedTasks'] = []
  for (const toT of toTasks) {
    const fromT = fromMap.get(toT.taskId)
    if (!fromT) continue
    const dES   = toT.ES - fromT.ES
    const dDur  = toT.duration - fromT.duration
    if (Math.abs(dES) > 0.05 || Math.abs(dDur) > 0.05) {
      shiftedTasks.push({
        taskId: toT.taskId, name: toT.name,
        oldES: fromT.ES, newES: toT.ES, deltaES: dES,
        oldDuration: fromT.duration, newDuration: toT.duration, deltaDuration: dDur,
      })
    }
  }
  shiftedTasks.sort((a, b) => Math.abs(b.deltaES) + Math.abs(b.deltaDuration) - (Math.abs(a.deltaES) + Math.abs(a.deltaDuration)))

  return {
    from: { id: from.id, capturedAt: from.capturedAt, totalDuration: from.totalDuration },
    to:   { id: to.id,   capturedAt: to.capturedAt,   totalDuration: to.totalDuration },
    durationDelta: to.totalDuration - from.totalDuration,
    addedCritical, removedCritical, addedTasks, removedTasks, shiftedTasks,
  }
}
