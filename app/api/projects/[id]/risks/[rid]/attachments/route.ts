import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'
import {
  UPLOAD_ROOT, MAX_BYTES, ALLOWED_TYPES, safeFileName, uniqueName,
  type AttachmentMeta,
} from '@/lib/attachments'

type Params = { params: Promise<{ id: string; rid: string }> }

// POST — 파일 업로드 (multipart: file=<files>)
export async function POST(req: NextRequest, { params }: Params) {
  const { rid } = await params

  const ro = await prisma.riskOpportunity.findUnique({ where: { id: rid } })
  if (!ro) return NextResponse.json({ error: 'R&O not found' }, { status: 404 })

  const form = await req.formData()
  const files = form.getAll('file').filter((f): f is File => f instanceof File)
  if (files.length === 0) return NextResponse.json({ error: '파일 없음' }, { status: 400 })

  // 파일 크기·MIME 검증
  for (const f of files) {
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ error: `"${f.name}" 크기 초과 (최대 30MB)` }, { status: 400 })
    }
    // type 검증은 느슨 — 확장자로도 보정
    const ext = path.extname(f.name).toLowerCase()
    const typeOk = ALLOWED_TYPES.includes(f.type) ||
      ['.dwg', '.dxf', '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.heif'].includes(ext)
    if (!typeOk) {
      return NextResponse.json({ error: `"${f.name}" 형식 불허 (${f.type || ext})` }, { status: 400 })
    }
  }

  const dir = path.join(UPLOAD_ROOT, rid)
  await fs.mkdir(dir, { recursive: true })
  const existingAttachments = Array.isArray(ro.attachments) ? (ro.attachments as unknown as AttachmentMeta[]) : []
  const existingNames = existingAttachments.map(a => a.name)
  const newMetas: AttachmentMeta[] = []

  for (const f of files) {
    const safe = safeFileName(f.name)
    const finalName = uniqueName(existingNames, safe)
    existingNames.push(finalName)
    const buf = Buffer.from(await f.arrayBuffer())
    await fs.writeFile(path.join(dir, finalName), buf)
    newMetas.push({
      name: finalName,
      size: f.size,
      type: f.type || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
      url: `/api/uploads/rno/${rid}/${encodeURIComponent(finalName)}`,
    })
  }

  const allAttachments = [...existingAttachments, ...newMetas]
  await prisma.riskOpportunity.update({
    where: { id: rid },
    data: { attachments: allAttachments as unknown as object },
  })

  return NextResponse.json({ ok: true, added: newMetas, attachments: allAttachments })
}

// DELETE — 첨부 1개 삭제 (?name=<filename>)
export async function DELETE(req: NextRequest, { params }: Params) {
  const { rid } = await params
  const name = req.nextUrl.searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name 쿼리 필요' }, { status: 400 })
  const safe = safeFileName(name)

  const ro = await prisma.riskOpportunity.findUnique({ where: { id: rid } })
  if (!ro) return NextResponse.json({ error: 'R&O not found' }, { status: 404 })

  const current = Array.isArray(ro.attachments) ? (ro.attachments as unknown as AttachmentMeta[]) : []
  const next = current.filter(a => a.name !== safe)

  // 파일 삭제 (실패해도 메타는 제거)
  try { await fs.unlink(path.join(UPLOAD_ROOT, rid, safe)) } catch { /* ignore */ }

  await prisma.riskOpportunity.update({
    where: { id: rid },
    data: { attachments: next.length > 0 ? (next as unknown as object) : null as any },
  })
  return NextResponse.json({ ok: true, attachments: next })
}
