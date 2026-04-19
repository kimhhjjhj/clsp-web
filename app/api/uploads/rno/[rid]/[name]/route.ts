import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { UPLOAD_ROOT, safeFileName } from '@/lib/attachments'

type Params = { params: Promise<{ rid: string; name: string }> }

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.heic': 'image/heic', '.heif': 'image/heif',
  '.pdf': 'application/pdf',
  '.dwg': 'image/vnd.dwg', '.dxf': 'application/dxf',
}

// GET — 파일 스트림 (inline)
export async function GET(req: NextRequest, { params }: Params) {
  const { rid, name } = await params
  const decoded = decodeURIComponent(name)
  const safe = safeFileName(decoded)
  if (!/^[A-Za-z0-9]{20,}$/.test(rid)) {
    return NextResponse.json({ error: 'Invalid rid' }, { status: 400 })
  }
  const filePath = path.join(UPLOAD_ROOT, rid, safe)
  try {
    const buf = await fs.readFile(filePath)
    const ext = path.extname(safe).toLowerCase()
    const type = MIME[ext] ?? 'application/octet-stream'
    // 이미지·PDF는 inline, 그 외는 attachment
    const inline = /^(image\/|application\/pdf)/.test(type)
    return new NextResponse(buf, {
      headers: {
        'Content-Type': type,
        'Content-Length': String(buf.byteLength),
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(safe)}`,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
