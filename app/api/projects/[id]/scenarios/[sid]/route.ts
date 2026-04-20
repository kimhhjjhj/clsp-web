// F8. Scenario 단건 삭제
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; sid: string }> }
) {
  const { sid } = await context.params
  try {
    await prisma.scenario.delete({ where: { id: sid } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
}
