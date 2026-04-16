'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Loader2, SlidersHorizontal, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react'

interface ProductivityResult {
  originalDuration: number
  adjustedDuration: number
  difference: number
  modifiedCount: number
  originalTasks: TaskInfo[]
  adjustedTasks: TaskInfo[]
}

interface TaskInfo {
  id: string; name: string; category: string; duration: number; isCritical: boolean
}

interface Props {
  projectId: string
  mode: 'cp' | 'full'
  cpmTasks: { taskId: string; name: string; category: string; duration: number; isCritical: boolean }[] | null
}

const CATEGORY_COLORS: Record<string, string> = {
  '공사준비': '#64748b', '토목공사': '#ca8a04', '골조공사': '#2563eb',
  '마감공사': '#059669', '설비공사': '#0891b2', '전기공사': '#7c3aed',
  '외부공사': '#16a34a', '부대공사': '#dc2626',
}

export default function ProductivityPanel({ projectId, mode, cpmTasks }: Props) {
  const [multipliers, setMultipliers] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ProductivityResult | null>(null)

  function setMult(taskId: string, value: number) {
    setMultipliers(prev => {
      const next = new Map(prev)
      if (Math.abs(value - 1.0) < 0.001) next.delete(taskId)
      else next.set(taskId, value)
      return next
    })
  }

  function resetAll() {
    setMultipliers(new Map())
    setResult(null)
  }

  async function run() {
    if (!cpmTasks) return
    setLoading(true)
    try {
      const adjustments = Array.from(multipliers.entries()).map(([taskId, multiplier]) => ({ taskId, multiplier }))
      const res = await fetch(`/api/projects/${projectId}/productivity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustments, mode }),
      })
      if (res.ok) setResult(await res.json())
    } finally { setLoading(false) }
  }

  if (!cpmTasks || cpmTasks.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
        <SlidersHorizontal size={24} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm">WBS/CPM 계산을 먼저 실행해주세요</p>
      </div>
    )
  }

  const modCount = multipliers.size

  return (
    <div className="space-y-5">
      {/* 슬라이더 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-[#2563eb]" />
            태스크별 생산성 조정
            {modCount > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{modCount}개 수정</span>}
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={resetAll}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200">
              <RotateCcw size={11} /> 초기화
            </button>
            <button onClick={run} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2563eb] text-white rounded-lg text-xs font-semibold hover:bg-[#1d4ed8] disabled:opacity-50">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              적용 & 재계산
            </button>
          </div>
        </div>
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">공종</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">태스크</th>
                <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 w-20">원본(일)</th>
                <th className="text-center px-2 py-2 text-xs font-semibold text-gray-500 w-56">생산성 배율</th>
                <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 w-20">조정(일)</th>
              </tr>
            </thead>
            <tbody>
              {cpmTasks.map(t => {
                const mult = multipliers.get(t.taskId) ?? 1.0
                const adjDur = Math.max(1, Math.round((t.duration / mult) * 10) / 10)
                const changed = Math.abs(mult - 1.0) > 0.001
                return (
                  <tr key={t.taskId} className={changed ? 'bg-blue-50/50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: CATEGORY_COLORS[t.category] ?? '#94a3b8' }} />
                      <span className="text-xs text-gray-500">{t.category}</span>
                    </td>
                    <td className="px-4 py-1.5 text-gray-900">
                      {t.name}
                      {t.isCritical && <span className="ml-1.5 text-[9px] bg-orange-100 text-orange-700 px-1 rounded">CP</span>}
                    </td>
                    <td className="text-center px-4 py-1.5 text-gray-600 font-mono text-xs">{t.duration}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 w-6">50%</span>
                        <input type="range" min={50} max={200} step={5} value={Math.round(mult * 100)}
                          onChange={e => setMult(t.taskId, Number(e.target.value) / 100)}
                          className="flex-1 h-1.5 accent-[#2563eb]" />
                        <span className="text-[10px] text-gray-400 w-8">200%</span>
                        <span className={`text-xs font-mono w-10 text-right ${changed ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                          {Math.round(mult * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className={`text-center px-4 py-1.5 font-mono text-xs ${changed ? (adjDur < t.duration ? 'text-green-600 font-bold' : 'text-red-600 font-bold') : 'text-gray-400'}`}>
                      {adjDur}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 비교 결과 */}
      {result && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">원본 공기</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{result.originalDuration}일</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">조정 후 공기</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{result.adjustedDuration}일</p>
            </div>
            <div className={`border rounded-xl p-4 ${result.difference < 0 ? 'bg-green-50 border-green-200' : result.difference > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase">차이</p>
              <p className={`text-xl font-bold mt-1 flex items-center gap-1 ${result.difference < 0 ? 'text-green-600' : result.difference > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {result.difference < 0 ? <TrendingDown size={18} /> : result.difference > 0 ? <TrendingUp size={18} /> : null}
                {result.difference > 0 ? '+' : ''}{result.difference}일
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">수정 태스크</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{result.modifiedCount}개</p>
            </div>
          </div>

          {/* 비교 바 차트 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">원본 vs 조정 비교</h3>
            <CompareChart original={result.originalTasks} adjusted={result.adjustedTasks} />
          </div>
        </>
      )}
    </div>
  )
}

// ── 비교 바 차트 ────────────────────────────────────────────

function CompareChart({ original, adjusted }: { original: TaskInfo[]; adjusted: TaskInfo[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maxDur = Math.max(...original.map(t => t.duration), ...adjusted.map(t => t.duration), 1)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const n = original.length
    const ROW_H = 38
    const LW = 180, PR = 20
    const W = 800, H = Math.max(200, n * ROW_H + 30)
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr
    canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)

    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
    const barW = W - LW - PR

    for (let i = 0; i < n; i++) {
      const y = i * ROW_H + 10
      const orig = original[i], adj = adjusted[i]
      const origW = (orig.duration / maxDur) * barW
      const adjW = (adj.duration / maxDur) * barW

      // label
      ctx.fillStyle = '#374151'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right'
      const label = orig.name.length > 18 ? orig.name.slice(0, 17) + '…' : orig.name
      ctx.fillText(label, LW - 8, y + 12)

      // original bar
      ctx.fillStyle = orig.isCritical ? '#8B1A1A' : '#1E4D8C'
      ctx.fillRect(LW, y, origW, 14)

      // adjusted bar
      const adjColor = adj.duration < orig.duration ? '#1D9E75' : adj.duration > orig.duration ? '#E24B4A' : '#185FA5'
      ctx.fillStyle = adjColor
      ctx.fillRect(LW, y + 16, adjW, 14)

      // duration text
      ctx.font = '9px sans-serif'; ctx.textAlign = 'left'
      ctx.fillStyle = '#64748b'
      ctx.fillText(`${orig.duration}일`, LW + origW + 4, y + 11)
      ctx.fillStyle = adjColor
      ctx.fillText(`${adj.duration}일`, LW + adjW + 4, y + 27)

      // separator
      ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(0, y + ROW_H - 2); ctx.lineTo(W, y + ROW_H - 2); ctx.stroke()
    }

    // legend
    const ly = H - 20
    ctx.font = '10px sans-serif'; ctx.textAlign = 'left'
    ctx.fillStyle = '#1E4D8C'; ctx.fillRect(LW, ly, 12, 10)
    ctx.fillStyle = '#64748b'; ctx.fillText('원본', LW + 16, ly + 9)
    ctx.fillStyle = '#1D9E75'; ctx.fillRect(LW + 60, ly, 12, 10)
    ctx.fillStyle = '#64748b'; ctx.fillText('단축', LW + 76, ly + 9)
    ctx.fillStyle = '#E24B4A'; ctx.fillRect(LW + 120, ly, 12, 10)
    ctx.fillStyle = '#64748b'; ctx.fillText('증가', LW + 136, ly + 9)
  }, [original, adjusted, maxDur])

  useEffect(() => { draw() }, [draw])

  return <canvas ref={canvasRef} style={{ width: 800, maxWidth: '100%' }} />
}
