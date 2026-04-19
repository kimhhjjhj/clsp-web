// ═══════════════════════════════════════════════════════════
// CP_DB 공종별 프로젝트 실적 분석 API — 키워드 기반 기간 추출
//
// 방식:
//   1) 프로젝트의 모든 일보에서 workToday/workTomorrow/content 텍스트 합침
//   2) 각 일보 텍스트에 CP_DB 공종 키워드(CPDB_KEYWORDS)가 등장하는지 검사
//   3) 공종이 언급된 날짜들 중 min = 시작일, max = 종료일
//   4) 실제 기간 = 종료일 - 시작일 + 1 (일 단위)
//      활동일수 = 실제 언급된 날짜의 개수 (연속 아닐 수 있음)
//   5) 물량은 일보에서 뽑을 수 없으므로 null (관리자 수동 입력 필요)
//
// 기존 trade 기반 방식은 중복 카운트 문제로 폐기.
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CP_DB, computeQuantities, calcDuration } from '@/lib/engine/wbs'
import { CPDB_RULES, findMatchDetails, rulesSummary } from '@/lib/engine/wbs-keyword-map'
import type { ProjectInput } from '@/lib/types'

interface WorkItem { text?: string; title?: string; [k: string]: unknown }

function extractDailyText(report: {
  content: string | null
  notes: string | null
  workToday: unknown
  workTomorrow: unknown
}): string {
  const parts: string[] = []
  if (report.content && typeof report.content === 'string') parts.push(report.content)
  if (report.notes && typeof report.notes === 'string') parts.push(report.notes)
  for (const field of [report.workToday, report.workTomorrow]) {
    if (Array.isArray(field)) {
      for (const item of field) {
        if (typeof item === 'string') parts.push(item)
        else if (item && typeof item === 'object') {
          const w = item as WorkItem
          if (typeof w.text === 'string') parts.push(w.text)
          if (typeof w.title === 'string') parts.push(w.title)
        }
      }
    } else if (typeof field === 'string') {
      parts.push(field)
    }
  }
  return parts.join('\n')
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso)
  const b = new Date(toIso)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const reports = await prisma.dailyReport.findMany({
    where: { projectId },
    select: { date: true, content: true, notes: true, workToday: true, workTomorrow: true, manpower: true },
    orderBy: { date: 'asc' },
  })

  // 1) 프로젝트 규모 → 계획 물량 (참고용)
  const input: ProjectInput = {
    name: project.name,
    type: project.type ?? '공동주택',
    ground: project.ground ?? 0,
    basement: project.basement ?? 0,
    lowrise: project.lowrise ?? 0,
    hasTransfer: project.hasTransfer,
    bldgArea:     project.bldgArea     ?? undefined,
    buildingArea: project.buildingArea ?? undefined,
    siteArea:     project.siteArea     ?? undefined,
    sitePerim:    project.sitePerim    ?? undefined,
    bldgPerim:    project.bldgPerim    ?? undefined,
    wtBottom:     project.wtBottom     ?? undefined,
    waBottom:     project.waBottom     ?? undefined,
    mode: 'cp',
  }
  const qtys = computeQuantities(input)

  // 2) 일보 텍스트를 미리 추출
  const reportTexts = reports.map(r => ({ date: r.date, text: extractDailyText(r), manpower: r.manpower }))

  // 3) CP_DB 각 공종마다 텍스트 매칭 (절 단위 + AND 규칙 조합) + 증거 수집
  const rows = CP_DB.map(row => {
    const rules = CPDB_RULES[row.name] ?? []
    const keywords = rulesSummary(row.name) // display용 'A+B' 형태
    const matchedDates: string[] = []
    const evidencesAll: { date: string; clause: string; rule: string }[] = []
    for (const rt of reportTexts) {
      if (!rt.text) continue
      const details = findMatchDetails(rt.text, row.name)
      if (details.length === 0) continue
      matchedDates.push(rt.date)
      for (const d of details) {
        evidencesAll.push({
          date: rt.date,
          clause: d.clause.length > 120 ? d.clause.slice(0, 120) + '…' : d.clause,
          rule: d.rule.join('+'),
        })
      }
    }
    void rules
    // 증거 샘플: 처음 3개 + 마지막 3개 (중복 제거)
    const evidenceSample = [
      ...evidencesAll.slice(0, 3),
      ...(evidencesAll.length > 6 ? evidencesAll.slice(-3) : evidencesAll.slice(3)),
    ].filter((e, i, arr) => arr.findIndex(x => x.date === e.date && x.clause === e.clause && x.rule === e.rule) === i)
    // 첫/마지막 등장일
    const sorted = [...matchedDates].sort()
    const firstDate = sorted[0] ?? null
    const lastDate = sorted.at(-1) ?? null
    const spanDays = firstDate && lastDate ? daysBetween(firstDate, lastDate) : 0
    const activeDays = new Set(matchedDates).size

    // 계획 값
    const plannedQty = qtys[row.name] ?? 0
    const applicable = plannedQty > 0 || ['전체', '개소', '대', '주'].includes(row.unit)
    const effectiveQty = plannedQty > 0 ? plannedQty : (applicable ? 1 : 0)
    const plannedDays = effectiveQty > 0 ? calcDuration(row, effectiveQty) : 0

    // 편차: 계획 기간 vs 실제 span
    const deviationDays = spanDays > 0 && plannedDays > 0
      ? Math.round((spanDays - plannedDays) * 10) / 10
      : null
    const deviationPct = spanDays > 0 && plannedDays > 0
      ? Math.round(((spanDays - plannedDays) / plannedDays) * 1000) / 10
      : null

    return {
      wbsCode: row.wbsCode ?? null,
      category: row.category,
      sub: row.sub,
      name: row.name,
      unit: row.unit,
      cpdbProd: row.prod,
      cpdbStdDays: row.stdDays,
      keywords,
      plannedQty: effectiveQty,
      plannedDays: Math.round(plannedDays * 10) / 10,
      firstDate,
      lastDate,
      spanDays,
      activeDays,
      deviationDays,
      deviationPct,
      hasKeywords: rules.length > 0,
      hasObservation: matchedDates.length > 0,
      applicable,
      evidenceTotal: evidencesAll.length,
      evidences: evidenceSample,
    }
  })

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      type: project.type,
      ground: project.ground,
      basement: project.basement,
      startDate: project.startDate,
    },
    totalReports: reports.length,
    firstDate: reports[0]?.date ?? null,
    lastDate: reports.at(-1)?.date ?? null,
    rows,
  })
}
