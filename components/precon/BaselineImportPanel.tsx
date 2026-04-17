'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, Trash2, Save, BarChart3 } from 'lucide-react'

interface BTask {
  id: string; mspId: string | null; wbsCode: string | null; name: string
  duration: number; start: string | null; finish: string | null
  predecessors: string | null; level: number
}

interface Props { projectId: string; onUpdate?: () => void }

export default function BaselineImportPanel({ projectId, onUpdate }: Props) {
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
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = ev => {
      const buf = ev.target?.result as ArrayBuffer

      // 인코딩 순서대로 시도: UTF-8 → EUC-KR → CP949
      const encodings = ['utf-8', 'euc-kr', 'ks_c_5601-1987']
      let parsed: Omit<BTask, 'id'>[] = []

      for (const enc of encodings) {
        try {
          const text = new TextDecoder(enc).decode(buf)
          parsed = parseCSV(text)
          if (parsed.length > 0) break
        } catch { continue }
      }

      if (parsed.length === 0) {
        alert('파싱 실패: 인식된 작업이 없습니다.\nCSV 컬럼에 "작업이름"(또는 name), "기간"(또는 duration) 이 있는지 확인해주세요.')
      } else {
        setPreview(parsed)
        setSaved(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function saveBaseline() {
    const res = await fetch(`/api/projects/${projectId}/baseline`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: preview }),
    })
    if (res.ok) { const d = await res.json(); setTasks(d); setPreview([]); setSaved(true); onUpdate?.() }
  }

  async function clearBaseline() {
    if (!confirm('베이스라인을 삭제하시겠습니까?')) return
    await fetch(`/api/projects/${projectId}/baseline`, { method: 'DELETE' })
    setTasks([]); setSaved(false); onUpdate?.()
  }

  const displayTasks = preview.length > 0 ? preview : tasks

  // ── CPM 계산: 선행작업 → ES(시작) ──────────────────────────
  // MS Project 선행작업 포맷: "1", "2,3", "17FS", "17FS+3", "17SS" 등
  function parsePredIds(preds: string | null): { id: string; lag: number }[] {
    if (!preds) return []
    return preds.split(/[,;]/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => {
        // "17FS+3" → id="17", lag=3 / "17SS-2" → id="17", lag=-2
        const m = p.match(/^(\d+)(?:FS|SS|FF|SF)?([+-]\d+)?$/i)
        if (m) return { id: m[1], lag: parseInt(m[2] || '0', 10) }
        // fallback: 숫자만 추출
        const num = p.match(/\d+/)
        return num ? { id: num[0], lag: 0 } : { id: '', lag: 0 }
      })
      .filter(x => x.id)
  }

  // mspId 또는 순번(1-based) 둘 다 매칭
  const idIndex = new Map<string, number>()
  displayTasks.forEach((t, i) => {
    idIndex.set(String(i + 1), i)
    if (t.mspId) idIndex.set(t.mspId, i)
  })

  // Forward pass — ES, EF 계산 (순환 방지 위해 topo 반복)
  const ES = new Array(displayTasks.length).fill(0)
  const EF = new Array(displayTasks.length).fill(0)
  for (let iter = 0; iter < displayTasks.length + 2; iter++) {
    let changed = false
    displayTasks.forEach((t, i) => {
      const preds = parsePredIds(t.predecessors)
      let es = 0
      for (const p of preds) {
        const pi = idIndex.get(p.id)
        if (pi != null && pi < displayTasks.length) {
          es = Math.max(es, EF[pi] + p.lag)
        }
      }
      if (es !== ES[i]) { ES[i] = es; changed = true }
      EF[i] = ES[i] + t.duration
    })
    if (!changed) break
  }
  const projectDur = Math.max(...EF, 1)

  // ── 간트 Canvas 렌더 ──────────────────────────────────────
  const drawGantt = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || displayTasks.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ROW = 26, LW = 240, HDR = 48, PR = 20
    // 자동 px/day — 화면폭 900 기준
    const chartW = 900 - LW - PR
    const pxPerDay = Math.max(1.5, Math.min(10, chartW / projectDur))
    const contentW = pxPerDay * projectDur
    const W = LW + contentW + PR
    const H = HDR + displayTasks.length * ROW + 20
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H)

    // ── 헤더(시간축) ──────────────────────────
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(LW, 0, contentW, HDR)
    // 월 구분 (30일 단위)
    const monthStep = projectDur > 500 ? 90 : projectDur > 200 ? 30 : projectDur > 60 ? 14 : 7
    ctx.font = '10px sans-serif'; ctx.textAlign = 'center'
    for (let d = 0; d <= projectDur; d += monthStep) {
      const x = LW + d * pxPerDay
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      ctx.fillStyle = '#64748b'
      ctx.fillText(`D+${d}`, x, HDR - 20)
      // 주 단위 표시
      ctx.fillStyle = '#94a3b8'
      ctx.font = '9px sans-serif'
      const weeks = Math.round(d / 7)
      if (projectDur <= 500) ctx.fillText(`${weeks}주차`, x, HDR - 6)
      ctx.font = '10px sans-serif'
    }
    // 헤더 하단 경계
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, HDR); ctx.lineTo(W, HDR); ctx.stroke()

    // ── 행 배경 (홀짝) ─────────────────────────
    displayTasks.forEach((_t, i) => {
      const y = HDR + i * ROW
      if (i % 2 === 1) {
        ctx.fillStyle = '#fafafa'
        ctx.fillRect(0, y, W, ROW)
      }
    })

    // ── 작업 바 ─────────────────────────
    displayTasks.forEach((t, i) => {
      const y = HDR + i * ROW
      const es = ES[i], dur = t.duration

      // 라벨
      ctx.fillStyle = '#1e293b'
      ctx.font = `${t.level > 0 ? '10.5' : '11.5'}px sans-serif`
      ctx.textAlign = 'right'
      const indent = '  '.repeat(t.level || 0)
      const raw = indent + t.name
      const label = raw.length > 28 ? raw.slice(0, 27) + '…' : raw
      ctx.fillText(label, LW - 8, y + 17)

      // 바 (마일스톤이면 다이아몬드)
      const x = LW + es * pxPerDay
      const bw = Math.max(3, dur * pxPerDay)
      const isMilestone = dur <= 0.5

      if (isMilestone) {
        ctx.fillStyle = '#8b5cf6'
        ctx.beginPath()
        ctx.moveTo(x, y + 13)
        ctx.lineTo(x + 6, y + 7)
        ctx.lineTo(x + 12, y + 13)
        ctx.lineTo(x + 6, y + 19)
        ctx.closePath()
        ctx.fill()
      } else {
        // 상위(요약) 작업이면 진한 색
        const isSummary = t.level === 0 && dur > projectDur * 0.4
        ctx.fillStyle = isSummary ? '#1e40af' : '#3b82f6'
        ctx.beginPath()
        ctx.roundRect(x, y + 6, bw, 14, 3)
        ctx.fill()

        // 기간 라벨 (바 오른쪽)
        ctx.font = '9.5px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillStyle = '#475569'
        ctx.fillText(`${dur}일`, x + bw + 4, y + 17)
      }

      // 행 구분선
      ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(0, y + ROW); ctx.lineTo(W, y + ROW); ctx.stroke()
    })

    // ── 의존성 화살표 ─────────────────────────
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 0.8
    ctx.fillStyle = '#94a3b8'
    displayTasks.forEach((t, i) => {
      const preds = parsePredIds(t.predecessors)
      for (const p of preds) {
        const pi = idIndex.get(p.id)
        if (pi == null || pi >= displayTasks.length) continue
        const fromX = LW + EF[pi] * pxPerDay
        const fromY = HDR + pi * ROW + 13
        const toX   = LW + ES[i] * pxPerDay
        const toY   = HDR + i * ROW + 13

        // L자 꺾임 경로
        ctx.beginPath()
        ctx.moveTo(fromX, fromY)
        ctx.lineTo(fromX + 4, fromY)
        ctx.lineTo(fromX + 4, toY)
        ctx.lineTo(toX - 2, toY)
        ctx.stroke()

        // 화살촉
        ctx.beginPath()
        ctx.moveTo(toX - 2, toY)
        ctx.lineTo(toX - 6, toY - 3)
        ctx.lineTo(toX - 6, toY + 3)
        ctx.closePath()
        ctx.fill()
      }
    })

    // ── 좌측 라벨 영역 경계선 ─────────────────────────
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(LW, 0); ctx.lineTo(LW, H); ctx.stroke()
  }, [displayTasks, ES, EF, idIndex, projectDur])

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
          <div className="overflow-auto max-h-[560px] border border-gray-100 rounded-lg">
            <canvas ref={canvasRef} />
          </div>
          <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm bg-[#3b82f6] inline-block" />일반 작업
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm bg-[#1e40af] inline-block" />요약 작업
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rotate-45 bg-[#8b5cf6] inline-block" />마일스톤
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-px bg-gray-400" />→ 의존관계
            </div>
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
                  {['ID','WBS','작업명','기간','ES','EF','시작','완료','선행'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayTasks.map((t, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-xs text-gray-400 font-mono">{t.mspId || i+1}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-400 font-mono">{t.wbsCode || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-900" style={{ paddingLeft: `${12 + (t.level || 0) * 14}px` }}>{t.name}</td>
                    <td className="px-3 py-1.5 text-blue-700 font-mono font-semibold">{t.duration}일</td>
                    <td className="px-3 py-1.5 text-xs font-mono text-gray-500">D+{ES[i] ?? 0}</td>
                    <td className="px-3 py-1.5 text-xs font-mono text-gray-500">D+{EF[i] ?? 0}</td>
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
