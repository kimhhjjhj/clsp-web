import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string; did: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { did } = await params
  const item = await prisma.dailyReport.findUnique({ where: { id: did } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { did } = await params
  const body = await req.json()
  const item = await prisma.dailyReport.update({
    where: { id: did },
    data: {
      date:          body.date,
      weather:       body.weather ?? null,
      temperature:   body.temperature != null ? Number(body.temperature) : null,
      tempMin:       body.tempMin != null ? Number(body.tempMin) : null,
      tempMax:       body.tempMax != null ? Number(body.tempMax) : null,
      workers:       body.workers ?? null,
      manpower:      body.manpower ?? null,
      equipment:     body.equipment ?? null,
      equipmentList: body.equipmentList ?? null,
      materialList:  body.materialList ?? null,
      workToday:     body.workToday ?? null,
      workTomorrow:  body.workTomorrow ?? null,
      signers:       body.signers ?? null,
      content:       body.content ?? null,
      notes:         body.notes ?? null,
      photos:        body.photos ?? null,
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { did } = await params
  await prisma.dailyReport.delete({ where: { id: did } })
  return NextResponse.json({ ok: true })
}
