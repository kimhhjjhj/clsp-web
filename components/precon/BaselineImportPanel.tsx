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

  function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i+1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        result.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    result.push(cur.trim())
    return result
  }

  function parseCSV(text: string): Omit<BTask, 'id'>[] {
    // BOM 제거, 줄바꿈 정규화
    const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = clean.split('\n').filter(l => l.trim())
    if (lines.length < 2) return []

    const header = parseCSVLine(lines[0]).map(h => h.toLowerCase())
    console.log('[CSV Header]', header)  // 개발 확인용

    const find = (row: string[], ...keys: string[]) => {
      for (const k of keys) {
        const i = header.findIndex(h => h === k || h.includes(k))
        if (i >= 0) return (row[i] ?? '').trim()
      }
      return ''
    }

    const results: Omit<BTask, 'id'>[] = []
    for (let li = 1; li < lines.length; li++) {
      const row = parseCSVLine(lines[li])
      // 이름 컬럼 — MS Project 한글/영문 모두 대응
      const name = find(row,
        '작업 이름', '작업이름', '이름', 'task name', 'name', '태스크 이름', '태스크이름',
        'task_name', 'taskname', 'task'
      )
      if (!name) continue

      const durRaw = find(row, '기간', 'duration', '소요기간', 'dur')
      // "5 days", "5d", "5 일", "5" 등 처리
      const durNum = parseFloat(durRaw.replace(/[^0-9.]/g, '')) || 1

      const mspId  = find(row, 'id', '번호', 'no', '순번') || String(li)
      const wbs    = find(row, 'wbs', 'wbs 코드', 'wbs코드')
      const start  = find(row, '시작', '시작일', 'start', 'start date')
      const finish = find(row, '완료', '완료일', 'finish', 'end', 'end date', 'finish date')
      const preds  = find(row, '선행 작업', '선행작업', '선행', 'predecessors', 'pred', 'depends on')

      // 개요 작업(들여쓰기) 감지
      const nameRaw = lines[li].includes('"') ? name : name
      const level   = nameRaw.match(/^(\s+)/) ? Math.floor(nameRaw.match(/^(\s+)/)![1].length / 2) : 0

      results.push({ mspId, wbsCode: wbs || null, name: name.trim(), duration: durNum,
        start: start || null, finish: finish || null, predecessors: preds || null, level })
    }
    console.log('[CSV Parsed]', results.length, '건')
    return results
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      // EUC-KR 깨진 경우 latin1로 재시도
      const parsed = parseCSV(text)
      if (parsed.length === 0) {
        // 인코딩 문제일 수 있어서 latin1로 재시도
        const r2 = new FileReader()
        r2.onload = ev2 => {
          const t2 = ev2.target?.result as string
          const p2 = parseCSV(t2)
          if (p2.length > 0) { setPreview(p2); setSaved(false) }
          else alert('파싱 실패: CSV 헤더를 인식하지 못했습니다.\n브라우저 콘솔(F12)에서 [CSV Header] 로그를 확인 후 알려주세요.')
        }
        r2.readAsText(file, 'latin1')
      } else {
        setPreview(parsed)
        setSaved(false)
      }
    }
    reader.readAsText(file, 'utf-8')
    // 같은 파일 재업로드 가능하도록 초기화
    e.target.value = ''
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
