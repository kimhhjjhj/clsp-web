// G7. POST /api/projects/[id]/daily-reports/[did]/apply-extraction
// 사용자가 프리뷰 검토 후 "적용" 누르면 AI 추출 결과를 실제 필드로 병합.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface Extraction {
  weather?: string
  tempMin?: number
  tempMax?: number
  manpower?: { trade: string; today: number; note?: string }[]
  equipmentList?: { name: string; count: number }[]
  materialList?: { name: string; quantity?: number; unit?: string }[]
  workToday?: { trade: string; location?: string; description: string }[]
  workTomorrow?: { trade: string; description: string }[]
  issues?: { severity: string; description: string }[]
  confidence?: number
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string; did: string }> }
) {
  const { did } = await context.params
  const dr = await prisma.dailyReport.findUnique({ where: { id: did } })
  if (!dr || !dr.aiExtraction) {
    return NextResponse.json({ error: '적용할 추출 결과가 없습니다' }, { status: 404 })
  }
  const ext = dr.aiExtraction as unknown as Extraction

  // workers: manpower 합산 (기존 POST 훅과 동일 로직)
  const workers = Array.isArray(ext.manpower)
    ? ext.manpower.reduce((acc, m) => {
        if (m.today > 0) acc[m.trade] = (acc[m.trade] ?? 0) + m.today
        return acc
      }, {} as Record<string, number>)
    : null

  await prisma.dailyReport.update({
    where: { id: did },
    data: {
      weather:       ext.weather       ?? dr.weather,
      tempMin:       ext.tempMin       ?? dr.tempMin,
      tempMax:       ext.tempMax       ?? dr.tempMax,
      manpower:      ext.manpower      ?? (dr.manpower ?? undefined),
      equipmentList: ext.equipmentList ?? (dr.equipmentList ?? undefined),
      materialList:  ext.materialList  ?? (dr.materialList ?? undefined),
      workToday:     ext.workToday     ?? (dr.workToday ?? undefined),
      workTomorrow:  ext.workTomorrow  ?? (dr.workTomorrow ?? undefined),
      workers:       workers ?? (dr.workers ?? undefined),
      aiReviewedAt:  new Date(),
    },
  })

  // AiExtractionLog 최근 기록에 accepted 마킹 (best-effort)
  await prisma.aiExtractionLog.updateMany({
    where: { entityType: 'daily-report', entityId: did, accepted: null },
    data: { accepted: true },
  }).catch(() => {})

  return NextResponse.json({ ok: true, applied: true })
}
