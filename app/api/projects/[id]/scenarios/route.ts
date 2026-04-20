// F8. Scenario Comparator — 목록 / 생성(평가)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWBS } from '@/lib/engine/wbs'
import { calculateCPM } from '@/lib/engine/cpm'
import type { ProjectInput } from '@/lib/types'

interface ScenarioParams {
  method?: ProjectInput['constructionMethod']
  multipliers?: { taskId: string; mult: number }[]
  accelerations?: { taskId: string; days: number }[]
  startDate?: string
  name?: string
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params
  const rows = await prisma.scenario.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ scenarios: rows })
}

// POST — params로 평가 실행 후 저장. body: { name, params: ScenarioParams, baseline? }
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params
  const body = await req.json() as {
    name?: string
    params?: ScenarioParams
    baseline?: boolean
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const p = body.params ?? {}
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
    prdCount: project.prdCount ?? undefined,
    constructionMethod: p.method ?? project.constructionMethod as ProjectInput['constructionMethod'],
    mode: 'cp',
  }

  // 1) WBS 생성
  const rawTasks = generateWBS(input)

  // 2) multiplier 적용 (기간 ÷ mult)
  const multMap = new Map((p.multipliers ?? []).map(m => [m.taskId, m.mult]))
  // 3) acceleration 적용 (기간 − days)
  const accMap = new Map((p.accelerations ?? []).map(a => [a.taskId, a.days]))

  const tasks = rawTasks.map(t => {
    let dur = t.duration
    const m = multMap.get(t.id)
    if (m && m > 0) dur = dur / m
    const a = accMap.get(t.id)
    if (a && a > 0) dur = Math.max(1, dur - a)
    return { ...t, duration: Math.max(1, Math.round(dur * 10) / 10) }
  })

  const cpm = calculateCPM(tasks)
  const result = {
    totalDuration: cpm.totalDuration,
    taskCount: cpm.tasks.length,
    criticalCount: cpm.tasks.filter(x => x.isCritical).length,
    computedAt: new Date().toISOString(),
  }

  const row = await prisma.scenario.create({
    data: {
      projectId,
      name: body.name ?? p.name ?? `시나리오 ${new Date().toLocaleString('ko-KR')}`,
      params: p as object,
      result,
      baseline: body.baseline ?? false,
    },
  })
  return NextResponse.json(row)
}
