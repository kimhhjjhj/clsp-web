'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, Trash2, Save, BarChart3 } from 'lucide-react'

interface BTask {
  id: string; mspId: string | null; wbsCode: string | null; name: string
  duration: number; start: string | null; finish: string | null
  predecessors: string | null; level: number
}

interface Props { projectId: string }

export default function BaselineImportPanel({ projectId }: Props) {
  const [tasks, setTasks] = useState<BTask[]>([])
  const [preview, setPreview] = useState<Omit<BTask, 'id'>[]>([])
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/baseline`)
    if (res.ok) { const d = await res.json(); setTasks(d); setSaved(d.length > 0) }
  }

  useEffect(() => { load() }, [projectId])

  function parseCSV(text: string): Omit<BTask, 'id'>[] {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return []
    const header = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())

    const col = (row: string[], keys: string[]) => {
      for (const k of keys) {
        const i = header.findIndex(h => h.includes(k))
        if (i >= 0) return (row[i] ?? '').trim().replace(/"/g, '')
      }
      return ''
    }

    return lines.slice(1).map(line => {
      const row = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) ?? line.split(',')
      const name = col(row, ['작업이름', '이름', 'name', 'task name'])
      if (!name) return null
      const durStr = col(row, ['기간', 'duration'])
      const durNum = parseFloat(durStr.replace(/[^0-9.]/g, '')) || 1
      return {
        mspId:        col(row, ['id']) || null,
        wbsCode:      col(row, ['wbs']) || null,
        name,
        duration:     durNum,
        start:        col(row, ['시작', 'start']) || null,
        finish:       col(row, ['완료', 'finish']) || null,
        predecessors: col(row, ['선행', 'predecessors', 'pred']) || null,
        level:        0,
      }
    }).filter(Boolean) as Omit<BTask, 'id'>[]
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setPreview(parseCSV(text))
      setSaved(false)
    }
    reader.readAsText(file, 'utf-8')
  }

  async function saveBaseline() {
    const res = await fetch(`/api/projects/${projectId}/baseline`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: preview }),
    })
    if (res.ok) { const d = await res.json(); setTasks(d); setPreview([]); setSaved(true) }
  }

  async function clearBaseline() {
    if (!confirm('베이스라인을 삭제하시겠습니까?')) return
    await fetch(`/api/projects/${projectId}/baseline`, { method: 'DELETE' })
    setTasks([]); setSaved(false)
  }

  const displayTasks = preview.length > 0 ? preview : tasks

  // 간단한 간트 Canvas 렌더
  const drawGantt = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || displayTasks.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ROW = 28, LW = 220, PR = 10
    const W = 900, H = Math.max(200, displayTasks.length * ROW + 40)
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H)

    const maxDur = Math.max(...displayTasks.map(t => t.duration), 1)
    const barW = W - LW - PR

    displayTasks.forEach((t, i) => {
      const y = i * ROW + 8
      ctx.fillStyle = '#374151'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right'
      const label = t.name.length > 22 ? t.name.slice(0, 21) + '…' : t.name
      ctx.fillText(label, LW - 6, y + 14)

      const bw = (t.duration / maxDur) * barW
      ctx.fillStyle = '#3b82f6'
      ctx.beginPath()
      ctx.roundRect(LW, y + 2, Math.max(4, bw), 18, 3)
      ctx.fill()

      ctx.font = '9px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#64748b'
      ctx.fillText(`${t.duration}일`, LW + Math.max(4, bw) + 4, y + 14)

      ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(0, y + ROW); ctx.lineTo(W, y + ROW); ctx.stroke()
    })
  }, [displayTasks])

  useEffect(() => { drawGantt() }, [drawGantt])

  return (
    <div className="space-y-4">
      {/* 업로드 영역 */}
      <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-blue-300 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}>
        <Upload size={24} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm font-semibold text-gray-600">MS Project CSV 파일 업로드</p>
        <p className="text-xs text-gray-400 mt-1">컬럼: ID, WBS, 작업이름, 기간, 시작, 완료, 선행작업</p>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={onFile} />
      </div>

      {/* 액션 버튼 */}
      {(preview.length > 0 || tasks.length > 0) && (
        <div className="flex items-center gap-3">
          {preview.length > 0 && (
            <button onClick={saveBaseline}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2563eb] text-white rounded-lg text-sm font-semibold hover:bg-[#1d4ed8]">
              <Save size={14} /> 베이스라인 저장 ({preview.length}건)
            </button>
          )}
          {tasks.length > 0 && (
            <button onClick={clearBaseline}
              className="flex items-center gap-1.5 px-4 py-2 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50">
              <Trash2 size={14} /> 삭제
            </button>
          )}
          {saved && <span className="text-xs text-green-600 font-semibold">✓ 베이스라인 저장됨 ({tasks.length}건)</span>}
        </div>
      )}

      {/* 간트차트 */}
      {displayTasks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <BarChart3 size={15} className="text-[#2563eb]" />
            베이스라인 공정표 ({displayTasks.length}개 태스크)
            {preview.length > 0 && <span className="text-xs text-orange-600 font-normal">— 미저장 미리보기</span>}
          </h3>
          <div className="overflow-auto max-h-[500px]">
            <canvas ref={canvasRef} style={{ width: 900, maxWidth: '100%' }} />
          </div>
        </div>
      )}

      {/* 태스크 목록 */}
      {displayTasks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 border-b border-gray-100">
                <tr>
                  {['ID','WBS','작업명','기간','시작','완료','선행'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayTasks.map((t, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-xs text-gray-400 font-mono">{t.mspId || i+1}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-400 font-mono">{t.wbsCode || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-900">{t.name}</td>
                    <td className="px-3 py-1.5 text-blue-700 font-mono font-semibold">{t.duration}일</td>
                    <td className="px-3 py-1.5 text-gray-500 text-xs">{t.start || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-500 text-xs">{t.finish || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-400 text-xs">{t.predecessors || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
