// G1-lite. 댓글 수정/삭제 — authorName 일치 확인 (soft identity)
// 인증이 없으므로 클라이언트 localStorage의 이름과 일치해야만 수정/삭제 허용.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const { authorName, body } = await req.json() as { authorName?: string; body?: string }
  const existing = await prisma.comment.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (existing.authorName !== authorName?.trim()) {
    return NextResponse.json({ error: '작성자만 수정할 수 있습니다' }, { status: 403 })
  }
  if (!body?.trim()) {
    return NextResponse.json({ error: 'body 필수' }, { status: 400 })
  }
  const row = await prisma.comment.update({
    where: { id },
    data: { body: body.trim().slice(0, 4000), editedAt: new Date() },
  })
  return NextResponse.json(row)
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const { searchParams } = new URL(req.url)
  const authorName = searchParams.get('authorName')?.trim()
  const existing = await prisma.comment.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (existing.authorName !== authorName) {
    return NextResponse.json({ error: '작성자만 삭제할 수 있습니다' }, { status: 403 })
  }
  await prisma.comment.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
