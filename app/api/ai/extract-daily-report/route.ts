// G7. POST /api/ai/extract-daily-report
// body: { reportId, content }
// content(자유 서술) → 구조화 JSON, DailyReport.aiExtraction 에 프리뷰 저장

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractDailyReport } from '@/lib/engine/ai-daily-report-extractor'

export async function POST(req: NextRequest) {
  const body = await req.json() as { reportId?: string; content?: string }
  if (!body.content || body.content.trim().length < 10) {
    return NextResponse.json({ error: 'content (≥ 10자) 필수' }, { status: 400 })
  }

  const result = await extractDailyReport({
    entityId: body.reportId ?? 'ephemeral',
    content: body.content,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  // reportId가 있으면 프리뷰 저장 (신규 작성 중이면 생략)
  if (body.reportId) {
    await prisma.dailyReport.update({
      where: { id: body.reportId },
      data: {
        aiExtraction: result.data as object,
        aiExtractionConfidence: result.data.confidence ?? null,
        aiExtractedAt: new Date(),
      },
    }).catch(() => {})
  }

  return NextResponse.json(result.data)
}
