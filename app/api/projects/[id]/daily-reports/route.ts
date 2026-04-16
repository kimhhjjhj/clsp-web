import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params
  const items = await prisma.dailyReport.findMany({
    where: { projectId: id },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const item = await prisma.dailyReport.create({
    data: {
      projectId:   id,
      date:        body.date,
      weather:     body.weather     ?? null,
      temperature: body.temperature != null ? Number(body.temperature) : null,
      workers:     body.workers     ?? null,
      equipment:   body.equipment   ?? null,
      content:     body.content     ?? null,
      notes:       body.notes       ?? null,
      photos:      body.photos      ?? null,
    },
  })
  return NextResponse.json(item, { status: 201 })
}
