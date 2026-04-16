import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { parseDxf } from '@/lib/engine/dxf-parser'
import { join } from 'path'

function convertDwgToDxf(dwgBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonPath = process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3')
    const scriptPath = join(process.cwd(), 'scripts', 'dwg2dxf.py')

    const proc = spawn(pythonPath, [scriptPath])
    let dxfOutput = ''
    let errorOutput = ''

    proc.stdout!.on('data', (data) => {
      dxfOutput += data.toString()
    })

    proc.stderr!.on('data', (data) => {
      errorOutput += data.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python 변환 실패: ${errorOutput}`))
      } else {
        resolve(dxfOutput)
      }
    })

    // stdin으로 binary 데이터 전송
    const base64 = dwgBuffer.toString('base64')
    proc.stdin!.write(base64)
    proc.stdin!.end()
  })
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
    }

    const fileName = (file as File).name.toLowerCase()
    const isDwg = fileName.endsWith('.dwg')

    let dxfText: string

    if (isDwg) {
      // DWG → DXF 변환
      const buffer = Buffer.from(await (file as File).arrayBuffer())
      dxfText = await convertDwgToDxf(buffer)
    } else {
      // DXF 직접 파싱
      dxfText = await (file as File).text()
    }

    if (!dxfText.trim()) {
      return NextResponse.json({ error: '파일 내용이 비어있습니다.' }, { status: 400 })
    }

    const result = parseDxf(dxfText)

    return NextResponse.json({
      site_area:       result.site_area,
      bldg_area:       result.bldg_area,
      site_perim:      result.site_perim,
      bldg_perim:      result.bldg_perim,
      segments:        result.segments,
      loops:           result.loops,
      highlightLayers: result.highlightLayers,
      bbox:            result.bbox,
      designInfo:      result.designInfo,
      debug:           result.debug,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: '파싱 실패', details: String(err?.message ?? err) },
      { status: 422 }
    )
  }
}
