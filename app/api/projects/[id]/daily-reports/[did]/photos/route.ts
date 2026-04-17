import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

type Params = { params: Promise<{ id: string; did: string }> }

export interface Photo {
  url: string
  caption?: string
  trade?: string
  uploadedAt: string
}

const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads', 'daily-reports')
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// POST — multipart/form-data 로 파일 업로드
export async function POST(req: NextRequest, { params }: Params) {
  const { id, did } = await params

  const report = await prisma.dailyReport.findUnique({ where: { id: did } })
  if (!report || report.projectId !== id) {
    return NextResponse.json({ error: '일보 없음' }, { status: 404 })
  }

  const formData = await req.formData()
  const files = formData.getAll('files') as File[]
  if (files.length === 0) {
    return NextResponse.json({ error: '파일 없음' }, { status: 400 })
  }

  const dir = path.join(UPLOAD_ROOT, id, did)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  const saved: Photo[] = []
  for (const file of files) {
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: `지원 안 되는 형식: ${file.type}` }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `파일 초과 (10MB): ${file.name}` }, { status: 400 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    const ext = path.extname(file.name) || `.${file.type.split('/')[1]}`
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
    await writeFile(path.join(dir, safeName), buf)
    saved.push({
      url: `/uploads/daily-reports/${id}/${did}/${safeName}`,
      uploadedAt: new Date().toISOString(),
    })
  }

  const current = (report.photos as Photo[] | null) ?? []
  const next = [...current, ...saved]
  await prisma.dailyReport.update({
    where: { id: did },
    data: { photos: next as unknown as object },
  })

  return NextResponse.json({ photos: next, added: saved.length })
}

// DELETE — body { url } 로 특정 사진 삭제
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, did } = await params
  const { url } = await req.json() as { url: string }
  if (!url) return NextResponse.json({ error: 'url 필요' }, { status: 400 })

  const report = await prisma.dailyReport.findUnique({ where: { id: did } })
  if (!report || report.projectId !== id) {
    return NextResponse.json({ error: '일보 없음' }, { status: 404 })
  }

  const current = (report.photos as Photo[] | null) ?? []
  const next = current.filter(p => p.url !== url)

  // 파일시스템 삭제 (실패해도 DB 업데이트는 진행)
  if (url.startsWith('/uploads/')) {
    const fullPath = path.join(process.cwd(), 'public', url.replace(/^\//, ''))
    try { await unlink(fullPath) } catch {}
  }

  await prisma.dailyReport.update({
    where: { id: did },
    data: { photos: next as unknown as object },
  })

  return NextResponse.json({ photos: next, removed: true })
}

// PATCH — caption/trade 메타데이터만 수정 { url, caption?, trade? }
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, did } = await params
  const body = await req.json() as { url: string; caption?: string; trade?: string }
  if (!body.url) return NextResponse.json({ error: 'url 필요' }, { status: 400 })

  const report = await prisma.dailyReport.findUnique({ where: { id: did } })
  if (!report || report.projectId !== id) {
    return NextResponse.json({ error: '일보 없음' }, { status: 404 })
  }

  const current = (report.photos as Photo[] | null) ?? []
  const next = current.map(p => p.url === body.url
    ? { ...p, caption: body.caption ?? p.caption, trade: body.trade ?? p.trade }
    : p,
  )
  await prisma.dailyReport.update({
    where: { id: did },
    data: { photos: next as unknown as object },
  })

  return NextResponse.json({ photos: next })
}
