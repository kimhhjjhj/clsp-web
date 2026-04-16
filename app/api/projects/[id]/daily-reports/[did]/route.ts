import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string; did: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { did } = await params
  const body = await req.json()
  const item = await prisma.dailyReport.update({
    where: { id: did },
    data: {
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
  return NextResponse.json(item)
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { did } = await params
  await prisma.dailyReport.delete({ where: { id: did } })
  return NextResponse.json({ ok: true })
}
