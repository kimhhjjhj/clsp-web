'use client'

import React, { useEffect, useRef, useState } from 'react'
import RiskPanel from '@/components/precon/RiskPanel'
import AccelerationPanel from '@/components/precon/AccelerationPanel'
import BaselineImportPanel from '@/components/precon/BaselineImportPanel'

interface RO {
  id: string
  type: string
  impactDays: number | null
  probability: number
}

interface Props {
  projectId: string
}

export default function Stage2Page({ projectId }: Props) {
  const [risks, setRisks] = useState<RO[]>([])
  const heatmapRef = useRef<HTMLCanvasElement>(null)

  function loadRisks() {
    fetch(`/api/projects/${projectId}/risks`)
      .then(r => r.json())
      .then((data: RO[]) => setRisks(data))
      .catch(() => {})
  }

  useEffect(() => { loadRisks() }, [projectId])

  // 히트맵 Canvas 그리기
  useEffect(() => {
    const canvas = heatmapRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const PAD = { left: 40, right: 10, top: 10, bottom: 30 }
    const chartW = W - PAD.left - PAD.right
    const chartH = H - PAD.top - PAD.bottom

    ctx.clearRect(0, 0, W, H)

    // 5x5 배경 그라데이션 그리드
    const COLS = 5
    const ROWS = 5
    const cellW = chartW / COLS
    const cellH = chartH / ROWS

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const risk = ((col + 1) / COLS) * ((ROWS - row) / ROWS)
        let r = 0, g = 0, b = 0
        if (risk < 0.3) { r = 100; g = 200; b = 100 }
        else if (risk < 0.6) { r = 240; g = 200; b = 50 }
        else { r = 230; g = 80; b = 70 }
        ctx.fillStyle = `rgba(${r},${g},${b},0.3)`
        ctx.fillRect(PAD.left + col * cellW, PAD.top + row * cellH, cellW, cellH)
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'
        ctx.strokeRect(PAD.left + col * cellW, PAD.top + row * cellH, cellW, cellH)
      }
    }

    // 축 레이블
    ctx.fillStyle = '#64748b'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    for (let i = 0; i <= COLS; i++) {
      ctx.fillText(`${i * 20}%`, PAD.left + i * cellW, H - 8)
    }
    ctx.textAlign = 'right'
    const maxImpact = 30
    for (let i = 0; i <= ROWS; i++) {
      ctx.fillText(`${maxImpact - i * (maxImpact / ROWS)}일`, PAD.left - 4, PAD.top + i * cellH + 4)
    }

    // 각 R&O 점 표시
    risks.forEach(item => {
      const x = PAD.left + (item.probability / 100) * chartW
      const y = PAD.top + ((maxImpact - Math.min(item.impactDays ?? 0, maxImpact)) / maxImpact) * chartH
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fillStyle = item.type === 'risk' ? 'rgba(220,38,38,0.8)' : 'rgba(22,163,74,0.8)'
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 1.5
      ctx.stroke()
    })
  }, [risks])

  // 노출지수 계산
  const riskItems = risks.filter(r => r.type === 'risk')
  const opItems = risks.filter(r => r.type === 'opportunity')
  const exposureIndex = riskItems.reduce((sum, r) => sum + (r.probability / 100) * (r.impactDays ?? 0), 0)

  return (
    <div className="overflow-auto h-full bg-gray-50">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* 섹션 1: R&O 매트릭스 */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-green-600 rounded-full inline-block" />
            리스크 & 기회 (R&O) 매트릭스
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <RiskPanel projectId={projectId} onUpdate={loadRisks} />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">확률-영향 히트맵</h3>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                    리스크 ({riskItems.length})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-green-600 inline-block" />
                    기회 ({opItems.length})
                  </span>
                </div>
              </div>
              <canvas
                ref={heatmapRef}
                width={380}
                height={260}
                className="w-full rounded-lg"
              />
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">노출지수 (Risk Exposure)</span>
                  <span className="font-bold text-orange-600">{exposureIndex.toFixed(1)}일</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Σ(확률/100 × 영향일수) — 리스크 발생 시 예상 공기 지연
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 섹션 2: 공기단축 시나리오 */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-600 rounded-full inline-block" />
            공기단축 시나리오
          </h2>
          <AccelerationPanel projectId={projectId} cpmResult={null} />
        </div>

        {/* 섹션 3: MSP 베이스라인 */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-purple-600 rounded-full inline-block" />
            MSP 베이스라인 임포트
          </h2>
          <BaselineImportPanel projectId={projectId} />
        </div>

      </div>
    </div>
  )
}
