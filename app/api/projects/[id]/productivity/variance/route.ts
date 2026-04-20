// F4. 공종별 편차 요약 조회
import { NextRequest, NextResponse } from 'next/server'
import { summarizeVariance } from '@/lib/engine/productivity-variance'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? '30d'
  const match = /^(\d+)d$/.exec(period)
  const days = match ? Number(match[1]) : 30

  const summary = await summarizeVariance({ projectId, days })
  return NextResponse.json({ summary, period: `${days}d` })
}
