import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { RNO_EXPORT_HEADER, rnoRowToExcelArray, type RnoRow } from '@/lib/rno-excel'

type Params = { params: Promise<{ id: string }> }

// GET /api/projects/:id/rno/export
// → 프로젝트의 R&O를 카테고리별 시트로 분할한 XLSX 파일 다운로드
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const items = await prisma.riskOpportunity.findMany({
    where: { projectId: id },
    orderBy: [{ category: 'asc' }, { code: 'asc' }, { rev: 'asc' }],
  })

  // 카테고리별 그룹
  const byCategory = new Map<string, typeof items>()
  for (const r of items) {
    const cat = r.category || '기타'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(r)
  }

  const wb = XLSX.utils.book_new()

  // 요약 시트 (맨 앞)
  const summaryRows: (string | number)[][] = [
    [`■ ${project.name} R&O LIST`, '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '(단위:백만원)'],
    ['공종', '건수', '제안금액합', '확정금액합', '확정건수', '진행건수', '미반영건수', '재검토건수'],
  ]
  let totalCount = 0, totalProp = 0, totalConf = 0
  for (const [cat, rows] of byCategory) {
    const propSum = rows.reduce((s, r) => s + (r.proposedCost ?? 0), 0)
    const confSum = rows.reduce((s, r) => s + (r.confirmedCost ?? 0), 0)
    const counts = {
      '확정': rows.filter(r => r.progress === '확정').length,
      '진행': rows.filter(r => r.progress === '진행').length,
      '미반영': rows.filter(r => r.progress === '미반영').length,
      '재검토': rows.filter(r => r.progress === '재검토').length,
    }
    summaryRows.push([cat, rows.length, Math.round(propSum * 10) / 10, Math.round(confSum * 10) / 10,
      counts['확정'], counts['진행'], counts['미반영'], counts['재검토']])
    totalCount += rows.length
    totalProp += propSum
    totalConf += confSum
  }
  summaryRows.push(['합계', totalCount, Math.round(totalProp * 10) / 10, Math.round(totalConf * 10) / 10, '', '', '', ''])

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows)
  summaryWs['!cols'] = [
    { wch: 16 }, { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, summaryWs, '집계')

  // 카테고리별 시트
  for (const [cat, rows] of byCategory) {
    const propSum = rows.reduce((s, r) => s + (r.proposedCost ?? 0), 0)
    const confSum = rows.reduce((s, r) => s + (r.confirmedCost ?? 0), 0)
    const propCnt = rows.filter(r => r.proposedCost != null).length
    const confCnt = rows.filter(r => r.confirmedCost != null).length

    const aoa: (string | number | null)[][] = [
      [`■ ${cat} R&O LIST`, '', '', '', '', '', '', '제안금액', Math.round(propSum * 10) / 10, '확정금액', Math.round(confSum * 10) / 10],
      ['', '', '', '', '', '', '', '제안건수', propCnt, '확정건수', confCnt],
      ['', '', '', '', '', '', '', '', '', '', '(단위:백만원)'],
      RNO_EXPORT_HEADER,
    ]
    for (const r of rows) {
      const rno: RnoRow = {
        code: r.code, rev: r.rev, subCategory: r.subCategory, proposer: r.proposer,
        proposedAt: r.proposedAt, content: r.content,
        proposedCost: r.proposedCost, confirmedCost: r.confirmedCost,
        progress: r.progress, confirmedAt: r.confirmedAt, expectedAt: r.expectedAt,
        designApplied: r.designApplied, note: r.note,
      }
      aoa.push(rnoRowToExcelArray(rno))
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [
      { wch: 10 }, { wch: 5 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 48 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 24 },
    ]
    // 시트명 31자 제한 — 한글 OK
    const sheetName = `${cat}R&O`.slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fileName = `[${project.name}] R&O_${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}
