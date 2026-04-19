import { NextRequest, NextResponse } from 'next/server'
import { parsePajuExcel } from '@/lib/excel-import/paju-parser'
import { parseSangbongExcel } from '@/lib/excel-import/sangbong-parser'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }
  const format = String(form.get('format') ?? 'paju')
  const fileName = (file as File).name ?? 'upload.xlsx'
  const buf = await file.arrayBuffer()

  try {
    if (format === 'paju') {
      return NextResponse.json(parsePajuExcel(buf, fileName))
    }
    if (format === 'sangbong') {
      return NextResponse.json(parseSangbongExcel(buf, fileName))
    }
    return NextResponse.json({ error: `지원하지 않는 포맷: ${format}` }, { status: 400 })
  } catch (e) {
    return NextResponse.json(
      { error: '파싱 실패: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    )
  }
}
