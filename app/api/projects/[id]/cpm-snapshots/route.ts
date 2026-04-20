// ═══════════════════════════════════════════════════════════
// F1. CPM Intelligence Timeline — 스냅샷 목록/생성 API
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWBS } from '@/lib/engine/wbs'
import { calculateCPM } from '@/lib/engine/cpm'
import { saveCpmSnapshot, type SnapshotTrigger } from '@/lib/engine/cpm-snapshot'

/** GET /api/projects/:id/cpm-snapshots?since=YYYY-MM-DD&limit=N */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params
  const { searchParams } = new URL(req.url)
  const since = searchParams.get('since')
  const limit = Number(searchParams.get('limit') || 50)

  const where: { projectId: string; capturedAt?: { gte: Date } } = { projectId }
  if (since) {
    const d = new Date(since)
    if (!isNaN(d.getTime())) where.capturedAt = { gte: d }
  }

  const rows = await prisma.cpmSnapshot.findMany({
    where,
    orderBy: { capturedAt: 'desc' },
    take: limit,
    select: {
      id: true, capturedAt: true, totalDuration: true, triggerEvent: true,
      triggerRef: true, note: true, criticalTaskIds: true,
    },
  })
  return NextResponse.json({
    snapshots: rows.map(r => ({
      ...r,
      criticalCount: Array.isArray(r.criticalTaskIds) ? r.criticalTaskIds.length : 0,
    })),
  })
}

/** POST /api/projects/:id/cpm-snapshots — 현재 프로젝트 상태로 스냅샷 생성 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params
  const body = await req.json().catch(() => ({})) as {
    trigger?: SnapshotTrigger
    triggerRef?: string
    note?: string
  }

  // 프로젝트 로드 + generateWBS 입력 재구성
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { tasks: { orderBy: { id: 'asc' } } },
  })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // DB Task가 이미 저장돼 있으면 그걸로 CPM 계산
  if (project.tasks.length === 0) {
    return NextResponse.json({ error: 'No tasks to snapshot' }, { status: 400 })
  }

  const wbsTasks = project.tasks.map(t => ({
    id: t.id,
    wbsCode: t.wbsCode ?? undefined,
    name: t.name,
    category: t.category ?? '미분류',
    subcategory: t.subcategory ?? undefined,
    unit: t.unit ?? undefined,
    quantity: t.quantity ?? undefined,
    productivity: t.productivity ?? undefined,
    stdDays: t.stdDays ?? undefined,
    duration: t.duration,
    predecessors: t.predecessors ? String(t.predecessors).split(',').map(s => s.trim()).filter(Boolean) : [],
  }))

  const cpm = calculateCPM(wbsTasks)
  const id = await saveCpmSnapshot({
    projectId,
    totalDuration: cpm.totalDuration,
    tasks: cpm.tasks,
    trigger: body.trigger ?? 'manual',
    triggerRef: body.triggerRef,
    note: body.note,
  })

  if (!id) return NextResponse.json({ error: 'Snapshot save failed' }, { status: 500 })
  return NextResponse.json({
    id,
    totalDuration: cpm.totalDuration,
    criticalCount: cpm.tasks.filter(t => t.isCritical).length,
    taskCount: cpm.tasks.length,
  })
}

// generateWBS는 현재 Route에서는 사용하지 않지만, 추후 'fresh from ProjectInput' 모드 추가 시 사용.
void generateWBS
