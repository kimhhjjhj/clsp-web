// G1-lite. 이름 기반 경량 Comment API
// 인증 없이 자유 입력 이름 + 역할 드롭다운. 본격 G0 인증 도입 시 User FK 로 마이그레이션.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/comments?entityType=...&entityId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')
  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entityType, entityId required' }, { status: 400 })
  }
  const rows = await prisma.comment.findMany({
    where: { entityType, entityId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  return NextResponse.json({ comments: rows })
}

// POST /api/comments
// body: { entityType, entityId, authorName, authorRole?, body, parentId?, attachments? }
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    entityType?: string
    entityId?: string
    authorName?: string
    authorRole?: 'field' | 'hq' | 'guest'
    body?: string
    parentId?: string
    attachments?: unknown
  }

  if (!body.entityType || !body.entityId || !body.authorName?.trim() || !body.body?.trim()) {
    return NextResponse.json({
      error: 'entityType, entityId, authorName, body 필수',
    }, { status: 400 })
  }

  const row = await prisma.comment.create({
    data: {
      entityType: body.entityType,
      entityId: body.entityId,
      authorName: body.authorName.trim().slice(0, 80),
      authorRole: body.authorRole ?? 'field',
      body: body.body.trim().slice(0, 4000),
      parentId: body.parentId ?? null,
      attachments: (body.attachments as object | undefined) ?? undefined,
    },
  })
  return NextResponse.json(row, { status: 201 })
}
