import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { SangbongParseResult } from '@/lib/excel-import/sangbong-parser'

export const runtime = 'nodejs'
export const maxDuration = 120

interface CommitBody {
  parseResult: SangbongParseResult
  target: {
    mode: 'create' | 'existing'
    projectId?: string
    projectName?: string
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CommitBody
  const { parseResult, target } = body
  if (!parseResult || !target) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  let projectId: string
  let projectName: string
  if (target.mode === 'create') {
    if (!target.projectName?.trim()) {
      return NextResponse.json({ error: '프로젝트명 필요' }, { status: 400 })
    }
    const created = await prisma.project.create({
      data: {
        name: target.projectName.trim(),
        startDate: parseResult.dateRange?.start ?? null,
      },
    })
    projectId = created.id
    projectName = created.name
  } else {
    if (!target.projectId) {
      return NextResponse.json({ error: 'projectId 필요' }, { status: 400 })
    }
    const existing = await prisma.project.findUnique({ where: { id: target.projectId } })
    if (!existing) {
      return NextResponse.json({ error: '프로젝트 없음' }, { status: 404 })
    }
    projectId = existing.id
    projectName = existing.name
  }

  let created = 0
  let updated = 0

  for (const day of parseResult.days) {
    const existing = await prisma.dailyReport.findFirst({
      where: { projectId, date: day.date },
      select: { id: true },
    })

    const manpowerJson = day.manpower
      .filter(m => m.today > 0)
      .map(m => ({
        trade: m.trade,
        company: m.company,
        today: m.today,
        yesterday: m.yesterday,
      }))
    const workersJson = manpowerJson.reduce<Record<string, number>>((acc, m) => {
      acc[m.trade] = (acc[m.trade] ?? 0) + m.today
      return acc
    }, {})
    const workTodayJson =
      day.workToday.length > 0 ? { building: day.workToday, mep: [] } : undefined
    const workTomorrowJson =
      day.workTomorrow.length > 0 ? { building: day.workTomorrow, mep: [] } : undefined
    const notesText = day.notes.length > 0 ? day.notes.join('\n') : undefined
    const materialListJson = day.materials && day.materials.length > 0
      ? day.materials.filter(m => m.today > 0).map(m => ({
          name: m.name,
          spec: m.spec,
          today: m.today,
          prev: m.prev,
          total: m.total,
          design: m.design,
        }))
      : undefined
    const equipmentListJson = day.equipment && day.equipment.length > 0
      ? day.equipment.filter(e => e.today > 0).map(e => ({
          name: e.name,
          spec: e.spec,
          today: e.today,
          yesterday: e.yesterday,
          total: e.total,
        }))
      : undefined

    if (existing) {
      await prisma.dailyReport.update({
        where: { id: existing.id },
        data: {
          weather: day.weather ?? undefined,
          tempMin: day.tempMin ?? undefined,
          tempMax: day.tempMax ?? undefined,
          manpower: manpowerJson.length > 0 ? manpowerJson : undefined,
          workers: Object.keys(workersJson).length > 0 ? workersJson : undefined,
          ...(workTodayJson && { workToday: workTodayJson }),
          ...(workTomorrowJson && { workTomorrow: workTomorrowJson }),
          ...(notesText != null && { notes: notesText }),
          ...(materialListJson && materialListJson.length > 0 && { materialList: materialListJson }),
          ...(equipmentListJson && equipmentListJson.length > 0 && { equipmentList: equipmentListJson }),
        },
      })
      updated++
    } else {
      await prisma.dailyReport.create({
        data: {
          projectId,
          date: day.date,
          weather: day.weather,
          tempMin: day.tempMin,
          tempMax: day.tempMax,
          manpower: manpowerJson.length > 0 ? manpowerJson : undefined,
          workers: Object.keys(workersJson).length > 0 ? workersJson : undefined,
          workToday: workTodayJson,
          workTomorrow: workTomorrowJson,
          notes: notesText,
          materialList: materialListJson && materialListJson.length > 0 ? materialListJson : undefined,
          equipmentList: equipmentListJson && equipmentListJson.length > 0 ? equipmentListJson : undefined,
        },
      })
      created++
    }
  }

  return NextResponse.json({
    ok: true,
    projectId,
    projectName,
    created,
    updated,
    totalDays: parseResult.days.length,
  })
}
