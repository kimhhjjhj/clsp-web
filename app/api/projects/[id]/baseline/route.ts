import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params
  const tasks = await prisma.baselineTask.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(tasks)
}

// 전체 교체 (CSV import 시)
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const tasks: { mspId?: string; wbsCode?: string; name: string; duration: number; start?: string; finish?: string; predecessors?: string; level?: number }[] = body.tasks ?? []

  // 기존 데이터 삭제 후 재삽입
  await prisma.baselineTask.deleteMany({ where: { projectId: id } })
  if (tasks.length > 0) {
    await prisma.baselineTask.createMany({
      data: tasks.map(t => ({
        projectId:    id,
        mspId:        t.mspId        ?? null,
        wbsCode:      t.wbsCode      ?? null,
        name:         t.name,
        duration:     t.duration,
        start:        t.start        ?? null,
        finish:       t.finish       ?? null,
        predecessors: t.predecessors ?? null,
        level:        t.level        ?? 0,
      })),
    })
  }

  const saved = await prisma.baselineTask.findMany({ where: { projectId: id }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json(saved)
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params
  await prisma.baselineTask.deleteMany({ where: { projectId: id } })
  return NextResponse.json({ ok: true })
}
