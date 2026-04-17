'use client'

import { useMemo } from 'react'
import { GitCompare, ArrowRight, Info } from 'lucide-react'
import type { CPMSummary } from '@/lib/types'

interface BTask {
  id: string
  name: string
  duration: number
  start: string | null
  finish: string | null
  level: number
}

interface Props {
  cpmResult: CPMSummary | null
  baseline: BTask[]
}

export default function BaselineCompare({ cpmResult, baseline }: Props) {
  const analysis = useMemo(() => {
    if (!cpmResult || baseline.length === 0) return null

    const baseTotal = Math.max(...baseline.map(t => t.duration))
    const baseSum = baseline.reduce((s, t) => s + t.duration, 0)
    const cpmTotal = cpmResult.totalDuration

    // CPM 카테고리별 총 duration
    const cpmByCategory = new Map<string, number>()
    for (const t of cpmResult.tasks) {
      cpmByCategory.set(t.category, (cpmByCategory.get(t.category) ?? 0) + t.duration)
    }

    // Baseline 상위 레벨 태스크만 대표로 사용 (level 0-1)
    const baseTop = baseline.filter(t => t.level <= 1)

    return {
      baseTotal,
      baseSum,
      cpmTotal,
      delta: cpmTotal - baseTotal,
      cpmByCategory: [...cpmByCategory.entries()].sort((a, b) => b[1] - a[1]),
      baseTop,
    }
  }, [cpmResult, baseline])

  if (!cpmResult || baseline.length === 0) return null
  if (!analysis) return null

  const { baseTotal, cpmTotal, delta } = analysis
  const deltaColor = delta > 0 ? 'text-red-600' : delta < 0 ? 'text-green-600' : 'text-gray-500'
  const deltaBg = delta > 0 ? 'bg-red-50 border-red-200' : delta < 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
        <GitCompare size={14} className="text-purple-600" />
        베이스라인 vs 현재 CPM 비교
      </h3>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-[10px] font-semibold text-purple-700 uppercase">베이스라인 (MSP)</p>
          <p className="text-2xl font-bold text-purple-900 mt-1">{baseTotal}일</p>
          <p className="text-[10px] text-purple-500 mt-0.5">{baseline.length}개 태스크</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-[10px] font-semibold text-blue-700 uppercase">현재 CPM</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{cpmTotal}일</p>
          <p className="text-[10px] text-blue-500 mt-0.5">{cpmResult.tasks.length}개 공종</p>
        </div>
        <div className={`border rounded-xl p-4 ${deltaBg}`}>
          <p className="text-[10px] font-semibold text-gray-500 uppercase">차이</p>
          <p className={`text-2xl font-bold mt-1 flex items-center gap-1 ${deltaColor}`}>
            {delta > 0 ? '+' : ''}{delta}일
          </p>
          <p className={`text-[10px] mt-0.5 ${deltaColor}`}>
            {delta > 0 ? '현재가 더 긺' : delta < 0 ? '현재가 더 짧음' : '동일'}
          </p>
        </div>
      </div>

      {/* 해석 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[11px] text-gray-600 flex items-start gap-1.5">
        <Info size={11} className="text-gray-400 mt-0.5 flex-shrink-0" />
        <p className="leading-relaxed">
          베이스라인은 외부(MSP) 공정표, 현재 CPM은 회사 모델 기반 재계산 결과입니다.
          차이가 크면 가정이나 공종 범위 설정을 재검토하세요.
          {Math.abs(delta) / Math.max(baseTotal, 1) > 0.15 && (
            <span className="ml-1 font-semibold text-orange-700">
              편차 {Math.round(Math.abs(delta) / baseTotal * 100)}% — 검토 필요
            </span>
          )}
        </p>
      </div>

      {/* 시각적 바 비교 */}
      <div className="mt-4 space-y-3">
        <BarRow label="베이스라인" value={baseTotal} max={Math.max(baseTotal, cpmTotal)} color="#a855f7" />
        <BarRow label="현재 CPM"  value={cpmTotal}  max={Math.max(baseTotal, cpmTotal)} color="#2563eb" />
      </div>
    </div>
  )
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-gray-600 mb-1">
        <span className="font-semibold">{label}</span>
        <span className="font-mono">{value}일</span>
      </div>
      <div className="h-4 bg-gray-100 rounded-md overflow-hidden">
        <div className="h-full rounded-md" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
    </div>
  )
}
