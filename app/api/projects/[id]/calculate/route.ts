import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWBS } from '@/lib/engine/wbs'
import { generateWBSFull } from '@/lib/engine/wbs-full'
import { calculateCPM } from '@/lib/engine/cpm'
import type { ProjectInput } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // mode: 'cp'(개략) | 'full'(상세층별) — request body에서 읽음
  let mode: 'cp' | 'full' = 'cp'
  try {
    const body = await req.json()
    if (body?.mode === 'full') mode = 'full'
  } catch {
    // body 없으면 cp 기본값
  }

  const input: ProjectInput = {
    name:        project.name,
    ground:      project.ground     ?? 0,
    basement:    project.basement   ?? 0,
    lowrise:     project.lowrise    ?? 0,
    hasTransfer: project.hasTransfer,
    sitePerim:   project.sitePerim  ?? undefined,
    bldgPerim:   project.bldgPerim  ?? undefined,
    siteArea:     project.siteArea     ?? undefined,
    bldgArea:     project.bldgArea     ?? undefined,
    buildingArea: project.buildingArea ?? undefined,
    wtBottom:     project.wtBottom     ?? undefined,
    waBottom:     project.waBottom     ?? undefined,
    mode,
  }

  const wbsTasks = mode === 'full' ? generateWBSFull(input) : generateWBS(input)

  // 기존 태스크 삭제 후 새로 저장
  await prisma.task.deleteMany({ where: { projectId: id } })
  await prisma.task.createMany({
    data: wbsTasks.map(t => ({
      projectId:    id,
      wbsCode:      t.wbsCode,
      name:         t.name,
      category:     t.category,
      duration:     t.duration,
      predecessors: t.predecessors.join(','),
    })),
  })

  const cpmResult = calculateCPM(wbsTasks)

  // 총 공기를 프로젝트에 저장 (Stage Hub 상태 표시용)
  await prisma.project.update({
    where: { id },
    data: { lastCpmDuration: cpmResult.totalDuration },
  })

  return NextResponse.json(cpmResult)
}
