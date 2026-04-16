import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const year   = searchParams.get('year')   ? Number(searchParams.get('year'))   : undefined
  const weekNo = searchParams.get('weekNo') ? Number(searchParams.get('weekNo')) : undefined

  const items = await prisma.weeklyProgress.findMany({
    where: { projectId: id, ...(year ? { year } : {}), ...(weekNo ? { weekNo } : {}) },
    orderBy: [{ year: 'asc' }, { weekNo: 'asc' }],
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()

  // upsert: 같은 주차+태스크면 업데이트
  const rows: { taskName: string; category?: string; plannedRate: number; actualRate: number }[] = body.rows ?? []
  const year   = Number(body.year)
  const weekNo = Number(body.weekNo)

  // 해당 주차 삭제 후 재삽입
  await prisma.weeklyProgress.deleteMany({ where: { projectId: id, year, weekNo } })
  if (rows.length > 0) {
    await prisma.weeklyProgress.createMany({
      data: rows.map(r => ({
        projectId:   id,
        year,
        weekNo,
        taskName:    r.taskName,
        category:    r.category ?? null,
        plannedRate: r.plannedRate,
        actualRate:  r.actualRate,
      })),
    })
  }

  const saved = await prisma.weeklyProgress.findMany({ where: { projectId: id, year, weekNo } })
  return NextResponse.json(saved)
}
