import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EMPTY_MAP, type ProcessMap } from '@/lib/process-map/types'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    select: { processMap: true, startDate: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const map = (project.processMap as ProcessMap | null) ?? EMPTY_MAP
  return NextResponse.json({ ...map, startDate: project.startDate })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = (await req.json()) as ProcessMap

  // 최소 검증: 배열 3종 확인
  if (!Array.isArray(body.lanes) || !Array.isArray(body.cards) || !Array.isArray(body.links)) {
    return NextResponse.json({ error: '형식 오류' }, { status: 400 })
  }

  const data: ProcessMap = {
    lanes: body.lanes,
    cards: body.cards,
    links: body.links,
    updatedAt: new Date().toISOString(),
  }

  await prisma.project.update({
    where: { id },
    data: { processMap: data as unknown as object },
  })

  return NextResponse.json({ ok: true, updatedAt: data.updatedAt })
}
