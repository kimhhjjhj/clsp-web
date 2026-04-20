'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Save, AlertTriangle, TrendingUp } from 'lucide-react'
import type { CPMSummary } from '@/lib/types'

interface ProgressRow {
  taskName: string; category: string; plannedRate: number; actualRate: number
}

interface WeekRecord {
  year: number; weekNo: number
  rows: ProgressRow[]
}

interface Props {
  projectId: string
  cpmResult: CPMSummary | null
  onSaved?: () => void
}

function getISOWeek(d: Date): { year: number; week: number } {
  const date = new Date(d.getTime())
  date.setHours(0,0,0,0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  return {
    year: date.getFullYear(),
    week: 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7),
  }
}

export default function WeeklyProgressPanel({ projectId, cpmResult, onSaved }: Props) {
  const now = getISOWeek(new Date())
  const [year, setYear]     = useState(now.year)
  const [weekNo, setWeekNo] = useState(now.week)
  const [rows, setRows]     = useState<ProgressRow[]>([])
  const [history, setHistory] = useState<WeekRecord[]>([])
  const [loading, setLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 태스크 목록을 CPM에서 초기화
  useEffect(() => {
    if (!cpmResult) return
    const cats = Array.from(new Set(cpmResult.tasks.map(t => t.category)))
    setRows(cats.map(cat => ({ taskName: cat, category: cat, plannedRate: 0, actualRate: 0 })))
  }, [cpmResult])

  // 해당 주차 로드
  useEffect(() => {
    fetch(`/api/projects/${projectId}/weekly-progress?year=${year}&weekNo=${weekNo}`)
      .then(r => r.json()).then((d: { taskName: string; category: string | null; plannedRate: number; actualRate: number }[]) => {
        if (d.length > 0) {
          setRows(d.map(r => ({ taskName: r.taskName, category: r.category ?? '', plannedRate: r.plannedRate, actualRate: r.actualRate })))
        }
      })
  }, [projectId, year, weekNo])

  // 전체 이력 로드
  useEffect(() => {
    fetch(`/api/projects/${projectId}/weekly-progress`)
      .then(r => r.json()).then((d: { year: number; weekNo: number; taskName: string; category: string | null; plannedRate: number; actualRate: number }[]) => {
        const map = new Map<string, WeekRecord>()
        for (const item of d) {
          const key = `${item.year}-${item.weekNo}`
          if (!map.has(key)) map.set(key, { year: item.year, weekNo: item.weekNo, rows: [] })
          map.get(key)!.rows.push({ taskName: item.taskName, category: item.category ?? '', plannedRate: item.plannedRate, actualRate: item.actualRate })
        }
        setHistory(Array.from(map.values()).sort((a,b) => a.year !== b.year ? a.year - b.year : a.weekNo - b.weekNo))
      })
  }, [projectId, loading])

  async function save() {
    setLoading(true)
    await fetch(`/api/projects/${projectId}/weekly-progress`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, weekNo, rows }),
    })
    setLoading(false)
    onSaved?.()
  }

  // S-Curve 그리기
  const drawSCurve = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || history.length === 0) return
    const ctx = canvas.getContext('2d')!
    if (!ctx) return

    const W = 700, H = 260
    const PL = 40, PR = 20, PT = 20, PB = 40
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H)

    const cw = W - PL - PR, ch = H - PT - PB
    const n = history.length

    // 주차별 평균 공정률 계산
    const planned = history.map(h => h.rows.reduce((s,r) => s + r.plannedRate, 0) / Math.max(1, h.rows.length))
    const actual  = history.map(h => h.rows.reduce((s,r) => s + r.actualRate,  0) / Math.max(1, h.rows.length))

    // 격자
    ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = PT + (ch / 4) * i
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + cw, y); ctx.stroke()
      ctx.fillStyle = '#94a3b8'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right'
      ctx.fillText(`${100 - i * 25}%`, PL - 4, y + 3)
    }

    function drawLine(data: number[], color: string, dash: number[]) {
      if (data.length === 0) return
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dash)
      ctx.beginPath()
      data.forEach((v, i) => {
        const x = PL + (i / Math.max(1, n - 1)) * cw
        const y = PT + ch - (v / 100) * ch
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.setLineDash([])
      // 점
      data.forEach((v, i) => {
        const x = PL + (i / Math.max(1, n - 1)) * cw
        const y = PT + ch - (v / 100) * ch
        ctx.fillStyle = color
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill()
      })
    }

    drawLine(planned, '#3b82f6', [5, 3])
    drawLine(actual,  '#22c55e', [])

    // x축 라벨
    ctx.fillStyle = '#64748b'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'
    history.forEach((h, i) => {
      const x = PL + (i / Math.max(1, n - 1)) * cw
      ctx.fillText(`${h.year}W${h.weekNo}`, x, H - PB + 14)
    })

    // 범례
    ctx.setLineDash([5,3]); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(PL, H - 10); ctx.lineTo(PL + 20, H - 10); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#3b82f6'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left'
    ctx.fillText('계획', PL + 24, H - 7)
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(PL + 70, H - 10); ctx.lineTo(PL + 90, H - 10); ctx.stroke()
    ctx.fillStyle = '#22c55e'; ctx.fillText('실적', PL + 94, H - 7)
  }, [history])

  useEffect(() => { drawSCurve() }, [drawSCurve])

  const delayed = rows.filter(r => r.actualRate - r.plannedRate < -5)

  return (
    <div className="space-y-4">
      {/* 주차 선택 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase">연도</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
            {[now.year - 1, now.year, now.year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase">주차</label>
          <select value={weekNo} onChange={e => setWeekNo(Number(e.target.value))}
            className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
            {Array.from({ length: 52 }, (_, i) => i + 1).map(w => (
              <option key={w} value={w}>{w}주차</option>
            ))}
          </select>
        </div>
        <div className="ml-auto">
          <button onClick={save} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2563eb] text-white rounded-lg text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50">
            <Save size={14} /> 저장
          </button>
        </div>
      </div>

      {/* 지연 경보 */}
      {delayed.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            공정 지연 경보: {delayed.map(r => r.taskName).join(', ')} — 계획 대비 -5% 초과 지연
          </p>
        </div>
      )}

      {/* 입력 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">{year}년 {weekNo}주차 공정률 입력</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {['공종','계획 공정률(%)','실적 공정률(%)','편차'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const diff = row.actualRate - row.plannedRate
              return (
                <tr key={i} className={diff < -5 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-2 font-medium text-gray-800">{row.taskName}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <input type="range" min={0} max={100} step={1} value={row.plannedRate}
                        onChange={e => setRows(prev => prev.map((r,j) => j === i ? { ...r, plannedRate: Number(e.target.value) } : r))}
                        className="w-32 accent-[#3b82f6]" />
                      <span className="text-sm font-mono text-blue-700 w-10">{row.plannedRate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <input type="range" min={0} max={100} step={1} value={row.actualRate}
                        onChange={e => setRows(prev => prev.map((r,j) => j === i ? { ...r, actualRate: Number(e.target.value) } : r))}
                        className="w-32 accent-[#22c55e]" />
                      <span className="text-sm font-mono text-green-700 w-10">{row.actualRate}%</span>
                    </div>
                  </td>
                  <td className={`px-4 py-2 font-mono font-bold text-sm ${diff < -5 ? 'text-red-600' : diff >= 0 ? 'text-green-600' : 'text-orange-500'}`}>
                    {diff >= 0 ? '+' : ''}{diff.toFixed(0)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* S-Curve */}
      {history.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp size={15} className="text-[#2563eb]" /> S-Curve (계획 vs 실적)
          </h3>
          <canvas ref={canvasRef} style={{ width: 700, maxWidth: '100%' }} />
        </div>
      )}
    </div>
  )
}
