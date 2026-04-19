// 2026 적정 공사기간 가이드라인 PDF 텍스트 추출
import fs from 'fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

const file = 'samples/2026년_적정_공사기간_확보를_위한_가이드라인.pdf'
const data = new Uint8Array(fs.readFileSync(file))
const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true })
const pdf = await loadingTask.promise
console.log(`Total pages: ${pdf.numPages}`)

// 페이지별 텍스트 extract
const outLines = []
for (let p = 1; p <= pdf.numPages; p++) {
  const page = await pdf.getPage(p)
  const content = await page.getTextContent()
  const strs = content.items.map(i => i.str).filter(Boolean)
  const text = strs.join(' ').replace(/\s+/g, ' ').trim()
  outLines.push(`\n\n===== Page ${p} =====`)
  outLines.push(text)
}
fs.writeFileSync('samples/guideline-text.txt', outLines.join('\n'), 'utf8')
console.log('Saved samples/guideline-text.txt')
