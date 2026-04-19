// ═══════════════════════════════════════════════════════════
// R&O 첨부파일 (도면·사진·PDF) 로컬 스토리지
//
// 저장 위치: <repo>/data/uploads/rno/<rid>/<safeName>
// 스키마: RiskOpportunity.attachments Json? = [{ name, size, type, uploadedAt, url }]
// - url: /api/uploads/rno/<rid>/<safeName>
// ═══════════════════════════════════════════════════════════
import path from 'path'

export interface AttachmentMeta {
  name: string       // 실제 파일명 (사용자에게 보여줄 이름)
  size: number       // bytes
  type: string       // MIME
  uploadedAt: string // ISO
  url: string        // GET 경로 (/api/uploads/rno/<rid>/<name>)
}

export const UPLOAD_ROOT = path.join(process.cwd(), 'data', 'uploads', 'rno')
export const MAX_BYTES = 30 * 1024 * 1024  // 30MB/파일
export const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf',
  'image/vnd.dwg', 'application/acad', 'application/x-acad', 'application/autocad_dwg',  // DWG
  'application/octet-stream',  // 일부 브라우저가 DWG을 이걸로 보냄
]

// 경로 탈출 방지 — 슬래시·백슬래시·상위 디렉토리 문자 제거
export function safeFileName(raw: string): string {
  const base = path.basename(raw)
  return base.replace(/[\\/:*?"<>|]/g, '_').trim() || 'file'
}

// 같은 디렉토리에 동일 이름 있으면 뒤에 (1),(2)...
export function uniqueName(existing: string[], desired: string): string {
  if (!existing.includes(desired)) return desired
  const ext = path.extname(desired)
  const stem = desired.slice(0, desired.length - ext.length)
  for (let i = 1; i < 1000; i++) {
    const cand = `${stem} (${i})${ext}`
    if (!existing.includes(cand)) return cand
  }
  return `${stem} (${Date.now()})${ext}`
}
