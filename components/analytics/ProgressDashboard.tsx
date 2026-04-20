'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { TrendingUp, BarChart3, Users, FileDown } from 'lucide-react'
import type { CPMSummary } from '@/lib/types'
import { generateWeeklyReport } from '@/lib/engine/report-pdf'

interface WeeklyRecord {
  year: number; weekNo: number; taskName: string; category: string | null
  plannedRate: number; actualRate: number
}

interface Props {
  projectId: string
  projectName?: string
  cpmResult: CPMSummary | null
}

interface DailyRecord {
  date: string; workers: Record<string, number> | null
}

export default function ProgressDashboard({ projectId, projectName, cpmResult }: Props) {
  const [history, setHistory]     = useState<WeeklyRecord[]>([])
  const [dailies, setDailies]     = useState<DailyRecord[]>([])
  const [issues, setIssues]       = useState('')
  const [nextPlan, setNextPlan]   = useState('')
  const sCurveRef    = useRef<HTMLCanvasElement>(null)
  const deviationRef = useRef<HTMLCanvasElement>(null)
  const workerRef    = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/weekly-progress`).then(r => r.json()).then(setHistory)
    fetch(`/api/projects/${projectId}/daily-reports`).then(r => r.json()).then((d: DailyRecord[]) => setDailies(d))
  }, [projectId])

  // 주차별 집계
  const weekMap = new Map<string, { planned: number[]; actual: number[] }>()
  for (const item of history) {
    const key = `${item.year}-${String(item.weekNo).padStart(2,'0')}`
    if (!weekMap.has(key)) weekMap.set(key, { planned: [], actual: [] })
    weekMap.get(key)!.planned.push(item.plannedRate)
    weekMap.get(key)!.actual.push(item.actualRate)
  }
  const weeks = Array.from(weekMap.entries()).sort(([a],[b]) => a.localeCompare(b))
  const avgPlanned = weeks.map(([,v]) => v.planned.reduce((s,n) => s+n,0) / Math.max(1,v.planned.length))
  const avgActual  = weeks.map(([,v]) => v.actual.reduce((s,n)  => s+n,0) / Math.max(1,v.actual.length))
  const deviation  = avgPlanned.map((p,i) => avgActual[i] - p)

  // S-Curve
  const drawSCurve = useCallback(() => {
    const canvas = sCurveRef.current
    if (!canvas || weeks.length === 0) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const W = 680, H = 220, PL = 40, PR = 20, PT = 15, PB = 35
    const dpr = window.devicePixelRatio || 1
    canvas.width = W*dpr; canvas.height = H*dpr; canvas.style.height = `${H}px`
    ctx.scale(dpr,dpr); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H)
    const cw = W-PL-PR, ch = H-PT-PB, n = weeks.length

    for (let i=0;i<=4;i++) {
      const y = PT+(ch/4)*i
      ctx.strokeStyle='#f1f5f9'; ctx.lineWidth=0.5
      ctx.beginPath(); ctx.moveTo(PL,y); ctx.lineTo(PL+cw,y); ctx.stroke()
      ctx.fillStyle='#94a3b8'; ctx.font='9px sans-serif'; ctx.textAlign='right'
      ctx.fillText(`${100-i*25}%`, PL-4, y+3)
    }

    const drawLine = (data: number[], color: string, dash: number[]) => {
      if (!data.length) return
      ctx.strokeStyle=color; ctx.lineWidth=2; ctx.setLineDash(dash)
      ctx.beginPath()
      data.forEach((v,i) => {
        const x = PL+(i/Math.max(1,n-1))*cw, y = PT+ch-(v/100)*ch
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y)
      })
      ctx.stroke(); ctx.setLineDash([])
      data.forEach((v,i) => {
        ctx.fillStyle=color
        ctx.beginPath(); ctx.arc(PL+(i/Math.max(1,n-1))*cw, PT+ch-(v/100)*ch, 3,0,Math.PI*2); ctx.fill()
      })
    }

    drawLine(avgPlanned,'#3b82f6',[5,3])
    drawLine(avgActual,'#22c55e',[])

    ctx.fillStyle='#64748b'; ctx.font='9px sans-serif'; ctx.textAlign='center'
    weeks.forEach(([key],i) => {
      ctx.fillText(key, PL+(i/Math.max(1,n-1))*cw, H-PB+14)
    })

    // 범례
    ctx.setLineDash([5,3]); ctx.strokeStyle='#3b82f6'; ctx.lineWidth=2
    ctx.beginPath(); ctx.moveTo(PL,H-6); ctx.lineTo(PL+20,H-6); ctx.stroke()
    ctx.setLineDash([]); ctx.fillStyle='#3b82f6'; ctx.font='10px sans-serif'; ctx.textAlign='left'
    ctx.fillText('계획', PL+24, H-3)
    ctx.strokeStyle='#22c55e'; ctx.beginPath(); ctx.moveTo(PL+70,H-6); ctx.lineTo(PL+90,H-6); ctx.stroke()
    ctx.fillStyle='#22c55e'; ctx.fillText('실적', PL+94, H-3)
  }, [weeks, avgPlanned, avgActual])

  // 편차 히스토그램
  const drawDeviation = useCallback(() => {
    const canvas = deviationRef.current
    if (!canvas || deviation.length === 0) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const W = 680, H = 180, PL = 40, PR = 20, PT = 15, PB = 35
    const dpr = window.devicePixelRatio || 1
    canvas.width = W*dpr; canvas.height = H*dpr; canvas.style.height = `${H}px`
    ctx.scale(dpr,dpr); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H)
    const cw = W-PL-PR, ch = H-PT-PB, n = deviation.length
    const barW = cw/n*0.7
    const maxAbs = Math.max(...deviation.map(Math.abs), 1)

    deviation.forEach((v,i) => {
      const x = PL+(i/n)*cw+(cw/n-barW)/2
      const barH = (Math.abs(v)/maxAbs)*(ch/2)
      const yMid = PT+ch/2
      ctx.fillStyle = v >= 0 ? '#22c55e' : '#ef4444'
      ctx.fillRect(x, v>=0 ? yMid-barH : yMid, barW, barH)
    })

    // 중심선
    ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1
    ctx.beginPath(); ctx.moveTo(PL,PT+ch/2); ctx.lineTo(PL+cw,PT+ch/2); ctx.stroke()

    ctx.fillStyle='#64748b'; ctx.font='9px sans-serif'; ctx.textAlign='center'
    weeks.forEach(([key],i) => {
      ctx.fillText(key, PL+(i/n)*cw+cw/n/2, H-PB+14)
    })
    ctx.textAlign='right'; ctx.fillText(`+${maxAbs.toFixed(0)}%`,PL-4,PT+5)
    ctx.fillText(`-${maxAbs.toFixed(0)}%`,PL-4,PT+ch-5)
  }, [deviation, weeks])

  // 투입인원 추이 차트
  const drawWorker = useCallback(() => {
    const canvas = workerRef.current
    if (!canvas || dailies.length === 0) return
    const ctx = canvas.getContext('2d')!
    if (!ctx) return
    const sorted = [...dailies].sort((a,b) => a.date.localeCompare(b.date))
    const totals = sorted.map(d => d.workers ? Object.values(d.workers).reduce((s,v) => s+v, 0) : 0)
    const W = 680, H = 160, PL = 40, PR = 20, PT = 15, PB = 35
    const dpr = window.devicePixelRatio || 1
    canvas.width = W*dpr; canvas.height = H*dpr; canvas.style.height = `${H}px`
    ctx.scale(dpr,dpr); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H)
    const cw = W-PL-PR, ch = H-PT-PB, n = sorted.length
    const maxV = Math.max(...totals, 1)
    const barW = (cw / n) * 0.7

    totals.forEach((v, i) => {
      const x = PL + (i / n) * cw + (cw/n - barW)/2
      const bh = (v / maxV) * ch
      ctx.fillStyle = '#3b82f6'
      ctx.beginPath(); ctx.roundRect(x, PT + ch - bh, barW, bh, 2); ctx.fill()
    })

    for (let g = 0; g <= 4; g++) {
      const y = PT + (ch/4)*g
      ctx.strokeStyle='#f1f5f9'; ctx.lineWidth=0.5
      ctx.beginPath(); ctx.moveTo(PL,y); ctx.lineTo(PL+cw,y); ctx.stroke()
      ctx.fillStyle='#94a3b8'; ctx.font='9px sans-serif'; ctx.textAlign='right'
      ctx.fillText(String(Math.round((maxV/4)*(4-g))), PL-4, y+3)
    }

    ctx.fillStyle='#64748b'; ctx.font='8px sans-serif'; ctx.textAlign='center'
    const step = Math.max(1, Math.floor(n / 8))
    sorted.forEach((d, i) => {
      if (i % step === 0) ctx.fillText(d.date.slice(5), PL+(i/n)*cw+cw/n/2, H-PB+13)
    })
  }, [dailies])

  useEffect(() => { drawSCurve(); drawDeviation(); drawWorker() }, [drawSCurve, drawDeviation, drawWorker])

  function downloadReport(year: number, weekNo: number) {
    const rows = history.filter(h => h.year === year && h.weekNo === weekNo)
      .map(h => ({ taskName: h.taskName, category: h.category ?? '', plannedRate: h.plannedRate, actualRate: h.actualRate }))
    if (rows.length === 0) { alert('해당 주차 데이터가 없습니다.'); return }
    const doc = generateWeeklyReport({
      project: { name: projectName ?? '프로젝트', },
      year, weekNo, rows,
      allHistory: history.map(h => ({ ...h, category: h.category ?? '' })),
      issues: issues || undefined,
      nextPlan: nextPlan || undefined,
    })
    doc.save(`주간보고서_${year}년_${weekNo}주차.pdf`)
  }

  // 공종별 실적 생산성 비교
  const catStats = new Map<string, { planned: number; actual: number; count: number }>()
  for (const item of history) {
    const cat = item.category ?? item.taskName
    if (!catStats.has(cat)) catStats.set(cat, { planned: 0, actual: 0, count: 0 })
    const s = catStats.get(cat)!
    s.planned += item.plannedRate; s.actual += item.actualRate; s.count++
  }
  const catList = Array.from(catStats.entries()).map(([cat, s]) => ({
    cat, planned: s.planned/s.count, actual: s.actual/s.count,
    diff: (s.actual-s.planned)/s.count,
  })).sort((a,b) => a.diff - b.diff)

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <BarChart3 size={32} className="mb-3 text-gray-200" />
        <p className="text-sm">3단계 주간 실적 데이터가 없습니다.</p>
        <p className="text-xs mt-1">주간 실적공정 탭에서 데이터를 입력하면 여기에 분석이 표시됩니다.</p>
      </div>
    )
  }

  const latestDeviation = deviation[deviation.length - 1] ?? 0
  const totalWeeks = weeks.length

  // 주차 목록 (고유)
  const weekList = Array.from(new Map(history.map(h => [`${h.year}-${h.weekNo}`, { year: h.year, weekNo: h.weekNo }])).values())
    .sort((a,b) => a.year !== b.year ? a.year - b.year : a.weekNo - b.weekNo)
  const latestWeek = weekList[weekList.length - 1]

  return (
    <div className="space-y-5">
      {/* 주간보고서 생성 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <FileDown size={15} className="text-[#2563eb]" /> 주간보고서 자동생성 (PDF)
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-gray-500">주요 이슈</label>
            <textarea rows={2} value={issues} onChange={e => setIssues(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              placeholder="이번 주 주요 이슈 및 특이사항" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">차주 계획</label>
            <textarea rows={2} value={nextPlan} onChange={e => setNextPlan(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              placeholder="다음 주 주요 작업 계획" />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {weekList.map(w => (
            <button key={`${w.year}-${w.weekNo}`}
              onClick={() => downloadReport(w.year, w.weekNo)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-blue-300">
              <FileDown size={12} className="text-[#2563eb]" />
              {w.year}년 {w.weekNo}주차
            </button>
          ))}
          {latestWeek && (
            <button onClick={() => downloadReport(latestWeek.year, latestWeek.weekNo)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2563eb] text-white rounded-lg text-xs font-semibold hover:bg-[#1d4ed8]">
              <FileDown size={13} /> 최신 주차 다운로드
            </button>
          )}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase">누적 주차</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalWeeks}주</p>
        </div>
        <div className={`border rounded-xl p-4 ${latestDeviation >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs font-semibold text-gray-400 uppercase">최신 편차</p>
          <p className={`text-2xl font-bold mt-1 ${latestDeviation >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {latestDeviation >= 0 ? '+' : ''}{latestDeviation.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase">최신 실적률</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{(avgActual[avgActual.length-1] ?? 0).toFixed(1)}%</p>
        </div>
      </div>

      {/* S-Curve */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <TrendingUp size={15} className="text-[#2563eb]" /> S-Curve 공정률 추이
        </h3>
        <canvas ref={sCurveRef} style={{ width: 680, maxWidth: '100%' }} />
      </div>

      {/* 편차 히스토그램 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <BarChart3 size={15} className="text-[#2563eb]" /> 주차별 계획-실적 편차
        </h3>
        <canvas ref={deviationRef} style={{ width: 680, maxWidth: '100%' }} />
      </div>

      {/* 투입인원 추이 */}
      {dailies.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Users size={15} className="text-[#2563eb]" /> 일별 투입인원 추이
          </h3>
          <canvas ref={workerRef} style={{ width: 680, maxWidth: '100%' }} />
        </div>
      )}

      {/* 공종별 실적 분석 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Users size={15} className="text-[#2563eb]" /> 공종별 실적 분석
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {['공종','평균 계획률(%)','평균 실적률(%)','편차','상태'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catList.map(row => (
              <tr key={row.cat} className={row.diff < -10 ? 'bg-red-50' : row.diff < -5 ? 'bg-orange-50' : 'hover:bg-gray-50'}>
                <td className="px-4 py-2 font-medium text-gray-900">{row.cat}</td>
                <td className="px-4 py-2 font-mono text-blue-700">{row.planned.toFixed(1)}%</td>
                <td className="px-4 py-2 font-mono text-green-700">{row.actual.toFixed(1)}%</td>
                <td className={`px-4 py-2 font-mono font-bold ${row.diff < -5 ? 'text-red-600' : row.diff >= 0 ? 'text-green-600' : 'text-orange-500'}`}>
                  {row.diff >= 0 ? '+' : ''}{row.diff.toFixed(1)}%
                </td>
                <td className="px-4 py-2">
                  {row.diff < -10 ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">심각지연</span>
                  : row.diff < -5  ? <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">지연</span>
                  : row.diff >= 0  ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">정상</span>
                  : <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">양호</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
