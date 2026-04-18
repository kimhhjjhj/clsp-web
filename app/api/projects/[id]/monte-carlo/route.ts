import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWBS } from '@/lib/engine/wbs'
import { generateWBSFull } from '@/lib/engine/wbs-full'
import { runMonteCarlo, type Distribution } from '@/lib/engine/monte-carlo'
import type { ProjectInput } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let iterations = 1000
  let variance = 0.20
  let distribution: Distribution = 'triangular'
  let mode: 'cp' | 'full' = 'cp'

  try {
    const body = await req.json()
    if (body.iterations) iterations = Math.min(10000, Math.max(100, Number(body.iterations)))
    if (body.variance) variance = Math.min(0.5, Math.max(0.01, Number(body.variance)))
    if (body.distribution) distribution = body.distribution
    if (body.mode === 'full') mode = 'full'
  } catch {
    // defaults
  }

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
  const result = runMonteCarlo(tasks, { iterations, variance, distribution })

  return NextResponse.json(result)
}
