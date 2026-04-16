import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWBS } from '@/lib/engine/wbs'
import { calculateCPM } from '@/lib/engine/cpm'
import type { ProjectInput } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 프로젝트 정보로 WBS 자동 생성
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
    wtBottom: project.wtBottom ?? undefined,
    waBottom: project.waBottom ?? undefined,
  }

  const wbsTasks = generateWBS(input)

  // 기존 태스크 삭제 후 새로 저장
  await prisma.task.deleteMany({ where: { projectId: id } })
  await prisma.task.createMany({
    data: wbsTasks.map(t => ({
      projectId: id,
      wbsCode: t.wbsCode,
      name: t.name,
      category: t.category,
      duration: t.duration,
      predecessors: t.predecessors.join(','),
    })),
  })

  // CPM 계산
  const cpmResult = calculateCPM(wbsTasks)

  return NextResponse.json(cpmResult)
}
