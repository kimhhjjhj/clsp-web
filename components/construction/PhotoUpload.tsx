'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Loader2, Edit3, Trash2 } from 'lucide-react'

export interface Photo {
  url: string
  caption?: string
  trade?: string
  uploadedAt: string
}

interface Props {
  projectId: string
  reportId: string
  photos: Photo[]
  onChange: (photos: Photo[]) => void
  readOnly?: boolean
}

export default function PhotoUpload({ projectId, reportId, photos, onChange, readOnly }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Photo | null>(null)
  const [editingUrl, setEditingUrl] = useState<string | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [editTrade, setEditTrade] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!files || (files as FileList).length === 0) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      for (const f of Array.from(files)) fd.append('files', f)
      const res = await fetch(`/api/projects/${projectId}/daily-reports/${reportId}/photos`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '업로드 실패')
      onChange(data.photos)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }, [projectId, reportId, onChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (readOnly) return
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }, [handleFiles, readOnly])

  async function removePhoto(url: string) {
    if (!confirm('이 사진을 삭제할까요?')) return
    const res = await fetch(`/api/projects/${projectId}/daily-reports/${reportId}/photos`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const data = await res.json()
    if (res.ok) onChange(data.photos)
  }

  function startEdit(p: Photo) {
    setEditingUrl(p.url)
    setEditCaption(p.caption ?? '')
    setEditTrade(p.trade ?? '')
  }

  async function saveEdit() {
    if (!editingUrl) return
    const res = await fetch(`/api/projects/${projectId}/daily-reports/${reportId}/photos`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: editingUrl, caption: editCaption, trade: editTrade }),
    })
    const data = await res.json()
    if (res.ok) {
      onChange(data.photos)
      setEditingUrl(null)
    }
  }

  return (
    <div className="space-y-3">
      {/* 드래그앤드롭 + 버튼 */}
      {!readOnly && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" /> 업로드 중...
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Upload size={15} className="text-gray-400" />
              <span>사진을 드래그하거나 클릭해서 업로드 (JPG/PNG/WebP, 최대 10MB)</span>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }}
          />
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠ {error}</div>
      )}

      {/* 썸네일 그리드 */}
      {photos.length === 0 ? (
        !readOnly ? null : (
          <div className="text-xs text-gray-400 text-center py-4 flex items-center justify-center gap-1.5">
            <ImageIcon size={13} /> 첨부된 사진 없음
          </div>
        )
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {photos.map(p => (
            <div key={p.url} className="relative group bg-gray-100 rounded-lg overflow-hidden aspect-square">
              <img
                src={p.url}
                alt={p.caption ?? ''}
                loading="lazy"
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setPreview(p)}
              />
              {(p.caption || p.trade) && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-[10px] text-white truncate">
                  {p.trade && <span className="font-semibold mr-1">[{p.trade}]</span>}
                  {p.caption}
                </div>
              )}
              {!readOnly && (
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="bg-white/90 hover:bg-white rounded p-1"
                    title="메타데이터 편집"
                  ><Edit3 size={10} className="text-gray-700" /></button>
                  <button
                    type="button"
                    onClick={() => removePhoto(p.url)}
                    className="bg-white/90 hover:bg-white rounded p-1"
                    title="삭제"
                  ><Trash2 size={10} className="text-red-600" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 미리보기 모달 */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img src={preview.url} alt={preview.caption ?? ''} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            {(preview.caption || preview.trade) && (
              <div className="mt-2 text-center text-white text-sm">
                {preview.trade && <span className="font-semibold mr-2">[{preview.trade}]</span>}
                {preview.caption}
              </div>
            )}
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="absolute top-2 right-2 bg-white/20 hover:bg-white/40 rounded-full p-2"
            ><X size={16} className="text-white" /></button>
          </div>
        </div>
      )}

      {/* 편집 모달 */}
      {editingUrl && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setEditingUrl(null)}
        >
          <div
            className="bg-white rounded-xl p-5 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold mb-3">사진 정보 편집</h3>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500 font-semibold">공종(선택)</label>
                <input
                  value={editTrade}
                  onChange={e => setEditTrade(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="예) 철근, 콘크리트, 방수"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold">설명(선택)</label>
                <input
                  value={editCaption}
                  onChange={e => setEditCaption(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="예) 1F 바닥 배근 완료"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={() => setEditingUrl(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >취소</button>
              <button
                type="button"
                onClick={saveEdit}
                className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
