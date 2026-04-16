/**
 * PDF 보고서 생성 엔진 (클라이언트사이드)
 * jsPDF + jspdf-autotable 사용
 * claude1.py ReportPage 포팅
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CPMSummary } from '@/lib/types'

interface ReportInput {
  project: {
    name: string
    client?: string
    location?: string
    ground: number
    basement: number
    bldgArea?: number
    startDate?: string
  }
  cpm: CPMSummary
  mode: 'cp' | 'full'
  monteCarlo?: {
    original: number; mean: number; p80: number; p95: number; stdDev: number; iterations: number
  }
}

export function generateReport(input: ReportInput): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, H = 297
  const ML = 20, MR = 20, MT = 25
  const CW = W - ML - MR

  // ── 한글 지원을 위해 기본 폰트 사용 (Helvetica) ──
  // 실제 한글은 Unicode escape 없이도 jsPDF 2.x에서 기본 지원

  // ═══════════════════════════════════════════════════
  //  1. 표지
  // ═══════════════════════════════════════════════════
  doc.setFillColor(30, 41, 59) // #1e293b
  doc.rect(0, 0, W, H, 'F')

  // 상단 accent line
  doc.setFillColor(37, 99, 235) // #2563eb
  doc.rect(0, 0, W, 4, 'F')

  // 로고 영역
  doc.setFillColor(37, 99, 235)
  doc.roundedRect(ML, 50, 36, 36, 4, 4, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.text('QP', ML + 18, 72, { align: 'center' })

  // 제목
  doc.setFontSize(28)
  doc.setTextColor(255, 255, 255)
  doc.text('Construction Lifecycle', ML, 110)
  doc.text('Scheduling Platform', ML, 125)

  doc.setFontSize(14)
  doc.setTextColor(148, 163, 184)
  doc.text('CLSP Report', ML, 140)

  // 프로젝트 정보
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text(input.project.name, ML, 175)

  doc.setFontSize(10)
  doc.setTextColor(148, 163, 184)
  let infoY = 185
  if (input.project.client) { doc.text(`Client: ${input.project.client}`, ML, infoY); infoY += 7 }
  if (input.project.location) { doc.text(`Location: ${input.project.location}`, ML, infoY); infoY += 7 }
  doc.text(`Scale: G${input.project.ground}F / B${input.project.basement}F`, ML, infoY); infoY += 7
  if (input.project.bldgArea) { doc.text(`Area: ${input.project.bldgArea.toLocaleString()} m2`, ML, infoY); infoY += 7 }
  doc.text(`Mode: ${input.mode === 'full' ? 'Full (Floor-by-floor)' : 'CP (Simplified)'}`, ML, infoY)

  // 하단
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(`Generated: ${new Date().toLocaleDateString('ko-KR')}`, ML, H - 25)
  doc.text('TONGYANG E&C', ML, H - 18)

  // 총 공기 강조
  doc.setFillColor(37, 99, 235)
  doc.roundedRect(W - MR - 60, H - 50, 60, 30, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.text('Total Duration', W - MR - 30, H - 40, { align: 'center' })
  doc.setFontSize(18)
  doc.text(`${input.cpm.totalDuration} days`, W - MR - 30, H - 28, { align: 'center' })

  // ═══════════════════════════════════════════════════
  //  2. 결과 요약 페이지
  // ═══════════════════════════════════════════════════
  doc.addPage()
  drawHeader(doc, 'Results Summary', ML, MT, CW)

  // KPI 박스
  const kpis = [
    { label: 'Total Duration', value: `${input.cpm.totalDuration} days` },
    { label: 'Task Count', value: `${input.cpm.tasks.length}` },
    { label: 'Critical Tasks', value: `${input.cpm.criticalPath.length}` },
    { label: 'Mode', value: input.mode === 'full' ? 'Full' : 'CP' },
  ]
  const kpiW = CW / 4
  kpis.forEach((k, i) => {
    const x = ML + i * kpiW
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(x + 1, MT + 12, kpiW - 3, 22, 2, 2, 'F')
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(k.label, x + kpiW / 2, MT + 19, { align: 'center' })
    doc.setFontSize(13)
    doc.setTextColor(15, 23, 42)
    doc.text(k.value, x + kpiW / 2, MT + 30, { align: 'center' })
  })

  // 공종별 요약 테이블
  const byCategory = groupBy(input.cpm.tasks, t => t.category)
  const catRows = Object.entries(byCategory).map(([cat, tasks]) => {
    const totalDur = tasks.reduce((s, t) => s + t.duration, 0)
    const critCount = tasks.filter(t => t.isCritical).length
    return [cat, `${tasks.length}`, `${Math.round(totalDur)} days`, `${critCount}`]
  })

  autoTable(doc, {
    startY: MT + 42,
    margin: { left: ML, right: MR },
    head: [['Category', 'Tasks', 'Total Duration', 'Critical']],
    body: catRows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  // ═══════════════════════════════════════════════════
  //  3. WBS 상세 테이블
  // ═══════════════════════════════════════════════════
  doc.addPage()
  drawHeader(doc, 'WBS Task List', ML, MT, CW)

  const wbsRows = input.cpm.tasks.map(t => [
    t.wbsCode ?? '',
    t.name,
    t.category,
    `${t.duration}`,
    `${t.ES}`,
    `${t.EF}`,
    `${t.TF}`,
    t.isCritical ? 'CP' : '',
  ])

  autoTable(doc, {
    startY: MT + 12,
    margin: { left: ML, right: MR },
    head: [['WBS', 'Task', 'Category', 'Dur', 'ES', 'EF', 'TF', 'CP']],
    body: wbsRows,
    styles: { fontSize: 6.5, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 50 },
      2: { cellWidth: 22 },
      3: { cellWidth: 12, halign: 'right' },
      4: { cellWidth: 12, halign: 'right' },
      5: { cellWidth: 12, halign: 'right' },
      6: { cellWidth: 12, halign: 'right' },
      7: { cellWidth: 10, halign: 'center' },
    },
    didParseCell(data) {
      // Critical path highlight
      if (data.section === 'body' && data.row.raw && (data.row.raw as string[])[7] === 'CP') {
        data.cell.styles.textColor = [234, 88, 12]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // ═══════════════════════════════════════════════════
  //  4. 크리티컬 패스
  // ═══════════════════════════════════════════════════
  doc.addPage()
  drawHeader(doc, 'Critical Path Analysis', ML, MT, CW)

  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(`Critical Path: ${input.cpm.criticalPath.length} tasks, Total ${input.cpm.totalDuration} days`, ML, MT + 15)

  const cpRows = input.cpm.tasks
    .filter(t => t.isCritical)
    .map(t => [t.wbsCode ?? '', t.name, t.category, `${t.duration}`, `${t.ES}`, `${t.EF}`])

  autoTable(doc, {
    startY: MT + 22,
    margin: { left: ML, right: MR },
    head: [['WBS', 'Task', 'Category', 'Duration', 'ES', 'EF']],
    body: cpRows,
    styles: { fontSize: 7, cellPadding: 2.5 },
    headStyles: { fillColor: [234, 88, 12], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 247, 237] },
  })

  // ═══════════════════════════════════════════════════
  //  5. 몬테카를로 결과 (있는 경우)
  // ═══════════════════════════════════════════════════
  if (input.monteCarlo) {
    doc.addPage()
    drawHeader(doc, 'Monte Carlo Simulation', ML, MT, CW)

    const mc = input.monteCarlo
    const mcData = [
      ['Iterations', `${mc.iterations}`],
      ['Original CPM Duration', `${mc.original} days`],
      ['Mean Duration', `${mc.mean} days`],
      ['P80 Duration', `${mc.p80} days`],
      ['P95 Duration (Recommended)', `${mc.p95} days`],
      ['Std. Deviation', `${mc.stdDev} days`],
      ['CV (%)', `${((mc.stdDev / mc.mean) * 100).toFixed(1)}%`],
    ]

    autoTable(doc, {
      startY: MT + 12,
      margin: { left: ML, right: MR },
      head: [['Metric', 'Value']],
      body: mcData,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' } },
    })

    // 해석 텍스트
    const iy = (doc as any).lastAutoTable?.finalY + 15 || MT + 100
    doc.setFontSize(8)
    doc.setTextColor(71, 85, 105)
    const lines = [
      `* P95 ${mc.p95} days is recommended as the safe project duration.`,
      `* The simulation shows the project duration varies by +/- ${mc.stdDev} days.`,
      `* Risk Level: CV ${((mc.stdDev / mc.mean) * 100).toFixed(1)}% — ${(mc.stdDev / mc.mean) * 100 < 10 ? 'Low Risk' : 'Moderate Risk'}`,
    ]
    lines.forEach((l, i) => doc.text(l, ML, iy + i * 6))
  }

  // ── 페이지 번호 ──
  const pageCount = doc.getNumberOfPages()
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(`${i} / ${pageCount}`, W / 2, H - 10, { align: 'center' })
    doc.text('CLSP Report — TONGYANG E&C', ML, H - 10)
  }

  return doc
}

function drawHeader(doc: jsPDF, title: string, ml: number, mt: number, cw: number) {
  doc.setFillColor(37, 99, 235)
  doc.rect(ml, mt, cw, 1, 'F')
  doc.setFontSize(14)
  doc.setTextColor(15, 23, 42)
  doc.text(title, ml, mt + 9)
}

function groupBy<T>(arr: T[], fn: (t: T) => string): Record<string, T[]> {
  const map: Record<string, T[]> = {}
  for (const item of arr) {
    const key = fn(item)
    if (!map[key]) map[key] = []
    map[key].push(item)
  }
  return map
}
