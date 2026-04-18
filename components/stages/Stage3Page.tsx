'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import WeeklyProgressPanel from '@/components/construction/WeeklyProgressPanel'
import DailyReportPanel from '@/components/construction/DailyReportPanel'

interface WeeklyRecord {
  year: number
  weekNo: number
  taskName: string
  category: string | null
  plannedRate: number
  actualRate: number
}

interface DailyRecord {
  id: string
  date: string
  workers: Record<string, number> | null
}

interface Props {
  projectId: string
}

export default function Stage3Page({ projectId }: Props) {
  const [weeklies, setWeeklies] = useState<WeeklyRecord[]>([])
  const [dailies, setDailies] = useState<DailyRecord[]>([])
  const gaugeRef = useRef<HTMLCanvasElement>(null)

  function loadData() {
    Promise.all([
      fetch(`/api/projects/${projectId}/weekly-progress`).then(r => r.json()).catch(() => []),
      fetch(`/api/projects/${projectId}/daily-reports`).then(r => r.json()).catch(() => []),
    ]).then(([w, d]) => {
      setWeeklies(Array.isArray(w) ? w : [])
      setDailies(Array.isArray(d) ? d : [])
    })
  }

  useEffect(() => { loadData() }, [projectId])

  // 최신 실적률 계산
  const latestWeekKey = weeklies.length > 0
    ? `${Math.max(...weeklies.map(w => w.year))}-${Math.max(...weeklies.filter(w => w.year === Math.max(...weeklies.map(ww => ww.year))).map(w => w.weekNo))}`
    : null
  const latestWeekRecords = latestWeekKey
    ? weeklies.filter(w => `${w.year}-${w.weekNo}` === latestWeekKey)
    : []
  const latestActualRate = latestWeekRecords.length > 0
    ? latestWeekRecords.reduce((sum, r) => sum + r.actualRate, 0) / latestWeekRecords.length
    : 0
  const latestPlannedRate = latestWeekRecords.length > 0
    ? latestWeekRecords.reduce((sum, r) => sum + r.plannedRate, 0) / latestWeekRecords.length
    : 0

  // 총 투입인원 (최신 일보)
  const latestDaily = dailies.sort((a, b) => b.date.localeCompare(a.date))[0]
  const totalWorkers = latestDaily?.workers
    ? Object.values(latestDaily.workers).reduce((s, v) => s + (v || 0), 0)
    : 0

  const lastReportDate = latestDaily?.date ?? null

  // 오늘 날짜
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  // 반원형 게이지 그리기
  useEffect(() => {
    const canvas = gaugeRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H - 10
    const R = Math.min(W, H * 2) / 2 - 8

    ctx.clearRect(0, 0, W, H)

    // 배경 호 (회색)
    ctx.beginPath()
    ctx.arc(cx, cy, R, Math.PI, 0)
    ctx.lineWidth = 14
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineCap = 'round'
    ctx.stroke()

    // 계획 호 (연한 파랑)
    const plannedAngle = Math.PI * (latestPlannedRate / 100)
    ctx.beginPath()
    ctx.arc(cx, cy, R, Math.PI, Math.PI + plannedAngle)
    ctx.lineWidth = 14
    ctx.strokeStyle = '#bfdbfe'
    ctx.stroke()

    // 실적 호 (진한 파랑)
    const actualAngle = Math.PI * (latestActualRate / 100)
    ctx.beginPath()
    ctx.arc(cx, cy, R, Math.PI, Math.PI + actualAngle)
    ctx.lineWidth = 10
    ctx.strokeStyle = '#2563eb'
    ctx.stroke()

    // 수치 텍스트
    ctx.fillStyle = '#1e293b'
    ctx.font = `bold 20px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`${Math.round(latestActualRate)}%`, cx, cy - 12)
    ctx.font = '10px sans-serif'
    ctx.fillStyle = '#64748b'
    ctx.fillText('실적률', cx, cy + 4)
  }, [latestActualRate, latestPlannedRate])

  // 달력: 사용자 탐색용 월 상태
  const now = new Date()
  const [calendarDate, setCalendarDate] = useState<Date>(() => {
    // 초기값: 데이터가 있는 가장 최근 월 (없으면 오늘)
    return new Date()
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // 일보 데이터 로드 완료 후 가장 최근 일보의 월로 자동 이동
  useEffect(() => {
    if (dailies.length > 0 && calendarDate.getTime() === now.getTime()) {
      const latest = dailies.sort((a, b) => b.date.localeCompare(a.date))[0]
      if (latest?.date) {
        const [y, m] = latest.date.split('-')
        setCalendarDate(new Date(Number(y), Number(m) - 1, 1))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailies.length])

  const year = calendarDate.getFullYear()
  const month = calendarDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const reportDates = new Set(dailies.map(d => d.date))

  function shiftMonth(delta: number) {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  return (
    <div className="h-full overflow-auto p-4 sm:p-6 space-y-4">
      {/* 상단 대시보드 카드 — 떠있는 엘리베이티드 스타일 */}
      <div className="card-elevated px-6 py-5">
        <div className="flex items-center gap-8 flex-wrap">
          {/* 오늘 날짜 */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">오늘</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{today}</p>
          </div>

          <div className="h-10 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent" />

          {/* 반원형 게이지 */}
          <div className="flex items-end gap-3">
            <canvas ref={gaugeRef} width={120} height={70} />
            <div className="pb-2 text-xs text-gray-500 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded bg-blue-600 inline-block" />
                실적 {Math.round(latestActualRate)}%
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded bg-blue-200 inline-block" />
                계획 {Math.round(latestPlannedRate)}%
              </div>
            </div>
          </div>

          <div className="h-10 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent" />

          {/* 투입인원 */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">투입인원</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              {totalWorkers}
              <span className="text-sm font-normal text-gray-400 ml-1">명</span>
            </p>
            <p className="text-[10px] text-gray-400">최신 일보 기준</p>
          </div>

          <div className="h-10 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent" />

          {/* 지연 경보 */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">공정 편차</p>
            {latestActualRate === 0 && latestPlannedRate === 0 ? (
              <p className="text-sm text-gray-400 mt-0.5">데이터 없음</p>
            ) : (
              <p className={`text-lg font-bold mt-0.5 ${
                latestActualRate >= latestPlannedRate ? 'text-green-600' : 'text-red-500'
              }`}>
                {latestActualRate >= latestPlannedRate
                  ? `+${(latestActualRate - latestPlannedRate).toFixed(1)}%`
                  : `${(latestActualRate - latestPlannedRate).toFixed(1)}%`
                }
              </p>
            )}
          </div>

          {lastReportDate && (
            <>
              <div className="h-10 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent" />
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">마지막 일보</p>
                <p className="text-sm font-semibold text-gray-700 mt-0.5">{lastReportDate}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 하단 2열 — 카드 분리 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 좌: 주간실적 */}
        <div className="card-elevated p-5">
          <WeeklyProgressPanel projectId={projectId} cpmResult={null} onSaved={loadData} />
        </div>

        {/* 우: 달력 미니뷰 + 일일작업일보 */}
        <div className="space-y-4">
          {/* 달력 미니뷰 */}
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                {year}년 {month + 1}월 일보 현황
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => shiftMonth(-1)}
                  className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                  title="이전 달"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => {
                    setCalendarDate(new Date())
                    setSelectedDate(null)
                  }}
                  className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                  title="오늘"
                >
                  <CalendarDays size={13} />
                </button>
                <button
                  onClick={() => shiftMonth(1)}
                  className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                  title="다음 달"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {['일','월','화','수','목','금','토'].map(d => (
                <div key={d} className="text-[10px] text-gray-400 py-1">{d}</div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const hasReport = reportDates.has(dateStr)
                const isToday =
                  year === now.getFullYear() &&
                  month === now.getMonth() &&
                  day === now.getDate()
                const isSelected = selectedDate === dateStr
                return (
                  <button
                    key={day}
                    onClick={() => hasReport && setSelectedDate(dateStr)}
                    disabled={!hasReport}
                    className={`relative py-1.5 text-xs rounded transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold'
                        : hasReport
                        ? 'text-gray-700 hover:bg-blue-50 cursor-pointer'
                        : isToday
                        ? 'bg-blue-50 font-bold text-blue-700'
                        : 'text-gray-400 cursor-default'
                    }`}
                  >
                    {day}
                    {hasReport && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-600 block" />
                    )}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">
              파란 날짜 클릭 → 해당 일보 선택
            </p>
          </div>

          {/* 작업일보 패널 */}
          <DailyReportPanel
            projectId={projectId}
            onSaved={loadData}
            filterMonth={monthKey}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>
      </div>
    </div>
  )
}
