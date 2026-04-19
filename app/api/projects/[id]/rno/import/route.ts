import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { parseRnoWorkbook } from '@/lib/rno-excel'

type Params = { params: Promise<{ id: string }> }

// POST /api/projects/:id/rno/import
//   - multipart/form-data: file=<xlsx>
//   - body.replace=1 → 기존 R&O 삭제 후 임포트 (기본 false = code+rev 병합)
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file')
  const replace = form.get('replace') === '1'
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '파일이 없습니다 (file 필드 필요)' }, { status: 400 })
  }

  let wb
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    wb = XLSX.read(buf, { type: 'buffer' })
  } catch {
    return NextResponse.json({ error: '엑셀 파일을 읽을 수 없습니다' }, { status: 400 })
  }

  const rows2DBySheet: Record<string, unknown[][]> = {}
  for (const name of wb.SheetNames) {
    rows2DBySheet[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1, defval: '', blankrows: false,
    }) as unknown[][]
  }

  const parsed = parseRnoWorkbook(rows2DBySheet)
  if (parsed.length === 0) {
    return NextResponse.json({
      error: 'R&O 시트를 찾을 수 없습니다',
      hint: '시트명이 "토목R&O", "철콘R&O" 등이어야 인식됩니다',
    }, { status: 400 })
  }

  // replace 모드: 기존 R&O 전체 삭제
  if (replace) {
    await prisma.riskOpportunity.deleteMany({ where: { projectId: id } })
  }

  // 기존 code+rev 맵 (병합 모드용)
  const existing = await prisma.riskOpportunity.findMany({
    where: { projectId: id, code: { not: null } },
    select: { id: true, code: true, rev: true },
  })
  const existingMap = new Map<string, string>()  // "CV-001|0" → id
  for (const e of existing) {
    existingMap.set(`${e.code}|${e.rev ?? 0}`, e.id)
  }

  let created = 0, updated = 0
  const sheetSummary: Array<{ category: string; count: number; created: number; updated: number; proposedSum: number; confirmedSum: number }> = []

  for (const sheet of parsed) {
    let c = 0, u = 0
    for (const r of sheet.rows) {
      const key = `${r.code}|${r.rev ?? 0}`
      const existingId = existingMap.get(key)
      const data = {
        type: 'opportunity' as const,
        category: sheet.category,
        content: r.content,
        impactType: 'cost',
        impactCost: r.confirmedCost != null ? r.confirmedCost * 100 : (r.proposedCost != null ? r.proposedCost * 100 : null),  // 백만→만원
        probability: r.progress === '확정' ? 100 : r.progress === '미반영' ? 0 : 50,
        status: r.progress === '확정' ? 'closed' : r.progress === '미반영' ? 'closed' : 'reviewing',
        code: r.code,
        rev: r.rev,
        subCategory: r.subCategory,
        proposer: r.proposer,
        proposedAt: r.proposedAt,
        proposedCost: r.proposedCost,
        confirmedCost: r.confirmedCost,
        progress: r.progress,
        confirmedAt: r.confirmedAt,
        expectedAt: r.expectedAt,
        designApplied: r.designApplied,
        note: r.note,
      }
      if (existingId) {
        await prisma.riskOpportunity.update({ where: { id: existingId }, data })
        u++
      } else {
        await prisma.riskOpportunity.create({ data: { projectId: id, ...data } })
        c++
      }
    }
    created += c
    updated += u
    sheetSummary.push({
      category: sheet.category,
      count: sheet.rows.length,
      created: c, updated: u,
      proposedSum: sheet.summary.proposedSum,
      confirmedSum: sheet.summary.confirmedSum,
    })
  }

  return NextResponse.json({
    ok: true,
    project: project.name,
    mode: replace ? 'replace' : 'merge',
    totalRows: parsed.reduce((s, p) => s + p.rows.length, 0),
    created, updated,
    sheets: sheetSummary,
  })
}
