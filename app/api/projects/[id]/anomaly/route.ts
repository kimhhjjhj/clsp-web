// G8. Multi-signal Anomaly — 조회 / 재탐지
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { detectTaskAnomalies, persistAnomalies } from '@/lib/engine/multi-anomaly'

// GET /api/projects/[id]/anomaly — 미해결 공종 목록
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params
  const rows = await prisma.anomalySignal.findMany({
    where: { projectId, kind: 'task', resolvedAt: null },
    orderBy: [{ score: 'desc' }],
    take: 30,
  })
  return NextResponse.json({ anomalies: rows })
}

// POST /api/projects/[id]/anomaly — 재탐지 실행
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params
  const results = await detectTaskAnomalies(projectId)
  await persistAnomalies(projectId, results)
  return NextResponse.json({
    detectedCount: results.length,
    highCount: results.filter(r => r.severity === 'high').length,
    medCount: results.filter(r => r.severity === 'med').length,
    lowCount: results.filter(r => r.severity === 'low').length,
  })
}
