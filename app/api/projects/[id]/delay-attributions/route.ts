// F3. 지연 원인 자동 귀속 — 조회 / 재계산
import { NextRequest, NextResponse } from 'next/server'
import { computeDelayAttribution, loadAttributions } from '@/lib/engine/delay-attribution'

// GET /api/projects/[id]/delay-attributions?groupBy=cause|task
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params
  const { searchParams } = new URL(req.url)
  const groupBy = (searchParams.get('groupBy') as 'cause' | 'task') ?? 'task'
  const data = await loadAttributions({ projectId, groupBy })
  return NextResponse.json(data)
}

// POST /api/projects/[id]/delay-attributions/rebuild
// body: { fromSnapshotId, toSnapshotId, persist? }
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params
  const body = await req.json().catch(() => ({})) as {
    fromSnapshotId?: string
    toSnapshotId?: string
    persist?: boolean
  }
  if (!body.fromSnapshotId || !body.toSnapshotId) {
    return NextResponse.json({ error: 'fromSnapshotId, toSnapshotId required' }, { status: 400 })
  }
  const result = await computeDelayAttribution({
    projectId,
    fromSnapshotId: body.fromSnapshotId,
    toSnapshotId: body.toSnapshotId,
    persist: body.persist ?? true,
  })
  if (!result) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
  return NextResponse.json(result)
}
