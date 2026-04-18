import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWBS } from '@/lib/engine/wbs'
import { generateWBSFull } from '@/lib/engine/wbs-full'
import { adjustProductivity, type ProductivityAdjustment } from '@/lib/engine/productivity'
import type { ProjectInput } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let adjustments: ProductivityAdjustment[] = []
    let mode: 'cp' | 'full' = 'cp'

    try {
      const body = await req.json()
      if (body.adjustments) adjustments = body.adjustments
      if (body.mode === 'full') mode = 'full'
    } catch { /* defaults */ }

    const input: ProjectInput = {
      name: project.name,
      ground: project.ground ?? 0,
      basement: project.basement ?? 0,
      lowrise: project.lowrise ?? 0,
      hasTransfer: project.hasTransfer,
      sitePerim: project.sitePerim ?? undefined,
      bldgPerim: project.bldgPerim ?? undefined,
      siteArea: project.siteArea ?? undefined,
      bldgArea: project.bldgArea ?? undefined,
      buildingArea: project.buildingArea ?? undefined,
      wtBottom: project.wtBottom ?? undefined,
      waBottom: project.waBottom ?? undefined,
      mode,
    }

    const tasks = mode === 'full' ? generateWBSFull(input) : generateWBS(input)
    const result = adjustProductivity(tasks, adjustments)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[POST /api/projects/productivity]', err)
    return NextResponse.json({ error: err?.message ?? '계산 실패' }, { status: 500 })
  }
}
