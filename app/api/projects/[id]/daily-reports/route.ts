import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordObservation } from '@/lib/engine/productivity-variance'

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
      projectId:     id,
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

  // F4. 생산성 관측값 기록 (best-effort, 실패해도 응답에 영향 없음)
  const workers = body.workers as Record<string, number> | undefined
  if (workers && body.date) {
    for (const [trade, count] of Object.entries(workers)) {
      if (typeof count === 'number' && count > 0) {
        await recordObservation({
          projectId: id,
          dailyReportId: item.id,
          trade,
          date: String(body.date),
          manDays: count,
          unit: 'man/day',
        })
      }
    }
  }

  return NextResponse.json(item, { status: 201 })
}
