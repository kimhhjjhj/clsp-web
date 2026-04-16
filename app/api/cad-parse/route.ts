import { NextRequest, NextResponse } from 'next/server'
import { parseDxf } from '@/lib/engine/dxf-parser'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
    }

    const text = await (file as File).text()
    if (!text.trim()) {
      return NextResponse.json({ error: '파일 내용이 비어있습니다.' }, { status: 400 })
    }

    const result = parseDxf(text)

    return NextResponse.json({
      site_area:       result.site_area,
      bldg_area:       result.bldg_area,
      site_perim:      result.site_perim,
      bldg_perim:      result.bldg_perim,
      segments:        result.segments,
      loops:           result.loops,
      highlightLayers: result.highlightLayers,
      bbox:            result.bbox,
      debug:           result.debug,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: '파싱 실패', details: String(err?.message ?? err) },
      { status: 422 }
    )
  }
}
