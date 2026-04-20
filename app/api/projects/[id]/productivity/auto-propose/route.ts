// F4. 편차 누적 공종 → ProductivityProposal 자동 생성
import { NextRequest, NextResponse } from 'next/server'
import { autoProposalsFromVariance } from '@/lib/engine/productivity-variance'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params
  const body = await req.json().catch(() => ({})) as { days?: number }
  const result = await autoProposalsFromVariance({
    projectId,
    days: body.days ?? 30,
  })
  return NextResponse.json(result)
}
