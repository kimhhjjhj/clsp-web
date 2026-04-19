import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { PajuParseResult, ManpowerRow, WeatherRow } from '@/lib/excel-import/paju-parser'

export const runtime = 'nodejs'
export const maxDuration = 60

interface SiteTarget {
  siteLabel: '1' | '2'
  mode: 'create' | 'existing'
  projectId?: string
  projectName?: string
}

interface CommitBody {
  parseResult: PajuParseResult
  targets: SiteTarget[]
}

function mapWeather(weather: WeatherRow[]): Map<string, WeatherRow> {
  return new Map(weather.map(w => [w.date, w]))
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CommitBody
  const { parseResult, targets } = body
  if (!parseResult || !Array.isArray(targets)) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const weatherMap = mapWeather(parseResult.weather)
  const results: {
    siteLabel: string
    projectId: string
    projectName: string
    created: number
    skipped: number
  }[] = []

  for (const target of targets) {
    const site = parseResult.sites.find(s => s.siteLabel === target.siteLabel)
    if (!site) continue

    let projectId: string
    let projectName: string
    if (target.mode === 'create') {
      if (!target.projectName?.trim()) {
        return NextResponse.json(
          { error: `SITE ${target.siteLabel}: 프로젝트명이 비어있음` },
          { status: 400 },
        )
      }
      const created = await prisma.project.create({
        data: {
          name: target.projectName.trim(),
          startDate: site.dateRange?.start ?? null,
        },
      })
      projectId = created.id
      projectName = created.name
    } else {
      if (!target.projectId) {
        return NextResponse.json(
          { error: `SITE ${target.siteLabel}: projectId 필요` },
          { status: 400 },
        )
      }
      const existing = await prisma.project.findUnique({ where: { id: target.projectId } })
      if (!existing) {
        return NextResponse.json(
          { error: `프로젝트 없음: ${target.projectId}` },
          { status: 404 },
        )
      }
      projectId = existing.id
      projectName = existing.name
    }

    let created = 0
    let updated = 0

    // 각 사이트의 모든 날짜를 집계
    const allDates = new Set<string>()
    site.manpower.forEach(m => allDates.add(m.date))
    Object.keys(site.workDone).forEach(d => allDates.add(d))
    Object.keys(site.workPlan).forEach(d => allDates.add(d))
    Object.keys(site.notes).forEach(d => allDates.add(d))
    Object.keys(site.materials).forEach(d => allDates.add(d))
    Object.keys(site.equipment).forEach(d => allDates.add(d))

    const manpowerByDate = new Map(site.manpower.map(m => [m.date, m]))

    for (const date of allDates) {
      const mp = manpowerByDate.get(date)
      const w = weatherMap.get(date)
      const workDone = site.workDone[date]
      const workPlan = site.workPlan[date]
      const notesArr = site.notes[date]
      const materials = site.materials[date]
      const equipment = site.equipment[date]

      const manpowerJson = mp?.entries.map(e => ({
        trade: e.trade,
        company: '',
        today: e.count,
      }))
      const workersJson = mp?.entries.reduce<Record<string, number>>((acc, e) => {
        acc[e.trade] = (acc[e.trade] ?? 0) + e.count
        return acc
      }, {})
      const workTodayJson = workDone
        ? { building: workDone, mep: [] }
        : undefined
      const workTomorrowJson = workPlan
        ? { building: workPlan, mep: [] }
        : undefined
      const notesText = notesArr?.join('\n') ?? undefined
      const materialListJson = materials
        ? materials.map(m => ({
            name: m.name,
            spec: m.spec,
            today: m.quantity,
            unit: m.unit,
            vendor: m.vendor,
            workName: m.workName,
          }))
        : undefined
      const equipmentListJson = equipment
        ? equipment.map(e => ({
            name: e.name,
            spec: e.spec,
            today: e.count,
            total: e.total,
            workName: e.workName,
          }))
        : undefined

      const existing = await prisma.dailyReport.findFirst({
        where: { projectId, date },
        select: { id: true },
      })

      if (existing) {
        await prisma.dailyReport.update({
          where: { id: existing.id },
          data: {
            ...(w?.weather != null && { weather: w.weather }),
            ...(w?.tempMin != null && { tempMin: w.tempMin }),
            ...(w?.tempMax != null && { tempMax: w.tempMax }),
            ...(manpowerJson && { manpower: manpowerJson }),
            ...(workersJson && { workers: workersJson }),
            ...(workTodayJson && { workToday: workTodayJson }),
            ...(workTomorrowJson && { workTomorrow: workTomorrowJson }),
            ...(notesText != null && { notes: notesText }),
            ...(materialListJson && { materialList: materialListJson }),
            ...(equipmentListJson && { equipmentList: equipmentListJson }),
          },
        })
        updated++
      } else {
        await prisma.dailyReport.create({
          data: {
            projectId,
            date,
            weather: w?.weather ?? null,
            tempMin: w?.tempMin ?? null,
            tempMax: w?.tempMax ?? null,
            // Prisma JSON 필드는 raw null 거부 → undefined 로 스킵 (DB 기본 NULL)
            manpower: manpowerJson ?? undefined,
            workers: workersJson ?? undefined,
            workToday: workTodayJson ?? undefined,
            workTomorrow: workTomorrowJson ?? undefined,
            notes: notesText ?? null,
            materialList: materialListJson ?? undefined,
            equipmentList: equipmentListJson ?? undefined,
          },
        })
        created++
      }
    }

    results.push({
      siteLabel: target.siteLabel,
      projectId,
      projectName,
      created,
      skipped: updated,
    })
  }

  return NextResponse.json({ ok: true, results })
}
