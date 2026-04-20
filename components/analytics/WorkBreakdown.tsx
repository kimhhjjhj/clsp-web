'use client'

import { useEffect, useState } from 'react'
import { MapPin, Hammer, Loader2, AlertTriangle, Box } from 'lucide-react'

interface LocationItem {
  location: string
  days: number
  manDays: number
  mentions: number
  firstDate: string
  lastDate: string
  durationDays: number
}

interface PartItem {
  part: string
  days: number
  manDays: number
  mentions: number
  firstDate: string
  lastDate: string
  durationDays: number
}

interface WorkTypeItem {
  workType: string
  days: number
  manDays: number
  mentions: number
  firstDate: string
  lastDate: string
  durationDays: number
  relatedTrades: { trade: string; count: number }[]
}

interface MatrixItem {
  location: string
  workType: string
  days: number
}

interface PartMatrixItem {
  part: string
  workType: string
  days: number
}

interface Response {
  locations: LocationItem[]
  parts: PartItem[]
  workTypes: WorkTypeItem[]
  matrix: MatrixItem[]
  partMatrix: PartMatrixItem[]
  unclassifiedCount: number
  totalItemCount: number
}

export default function WorkBreakdown({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'location' | 'part' | 'workType' | 'matrix'>('location')
  const [matrixMode, setMatrixMode] = useState<'location' | 'part'>('location')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/projects/${projectId}/analytics/work-breakdown`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [projectId])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={24} />
      </div>
    )
  }
  if (!data || data.totalItemCount === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
        분석할 작업 텍스트가 없습니다. 일보에 "금일 작업내용"을 작성하세요.
      </div>
    )
  }

  const classified = data.totalItemCount - data.unclassifiedCount
  const classifyRate = Math.round((classified / data.totalItemCount) * 100)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">부위·작업별 분해</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            일보 "금일 작업내용" 텍스트에서 자동 추출 · 위치/작업종류별 집계
          </p>
        </div>
        <div className="text-right text-xs">
          <div className="text-gray-500">
            분류 <b className="text-emerald-600">{classifyRate}%</b>
          </div>
          <div className="text-[10px] text-gray-400">
            {classified}/{data.totalItemCount}개 항목
          </div>
        </div>
      </div>

      {data.unclassifiedCount > data.totalItemCount * 0.3 && (
        <div className="mb-4 flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <AlertTriangle size={12} />
          미분류가 많습니다. 정확도를 높이려면 LLM 기반 분류(B안)로 보강할 수 있어요.
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 mb-4 border-b border-gray-100 flex-wrap">
        {(
          [
            { id: 'location' as const, label: '위치별', icon: <MapPin size={12} /> },
            { id: 'part' as const, label: '부위별', icon: <Box size={12} /> },
            { id: 'workType' as const, label: '작업종류별', icon: <Hammer size={12} /> },
            { id: 'matrix' as const, label: '매트릭스', icon: null },
          ]
        ).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'location' && <LocationTable items={data.locations} />}
      {tab === 'part' && <PartTable items={data.parts} />}
      {tab === 'workType' && <WorkTypeTable items={data.workTypes} />}
      {tab === 'matrix' && (
        <>
          <div className="flex gap-1 mb-3">
            <button
              onClick={() => setMatrixMode('location')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded border ${
                matrixMode === 'location'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              위치 × 작업
            </button>
            <button
              onClick={() => setMatrixMode('part')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded border ${
                matrixMode === 'part'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              부위 × 작업
            </button>
          </div>
          {matrixMode === 'location'
            ? <MatrixHeatmap items={data.matrix} />
            : <PartMatrixHeatmap items={data.partMatrix} />}
        </>
      )}
    </div>
  )
}

function LocationTable({ items }: { items: LocationItem[] }) {
  if (items.length === 0) return <Empty />
  const maxMD = Math.max(...items.map(i => i.manDays), 1)
  const sorted = [...items].sort((a, b) => compareLocation(a.location, b.location))
  return (
    <div className="overflow-x-auto thin-scroll">
      <table className="w-full text-xs">
        <thead className="text-gray-400 border-b border-gray-100 sticky top-0 z-10 bg-white">
          <tr>
            <th className="text-left py-2 font-semibold">위치 <span className="font-normal text-gray-300">(층순)</span></th>
            <th className="text-right py-2 font-semibold">활동일</th>
            <th className="text-right py-2 font-semibold">추정 인일</th>
            <th className="text-left py-2 font-semibold pl-4">기간</th>
            <th className="w-40"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map(i => (
            <tr key={i.location} className="hover:bg-gray-50">
              <td className="py-2">
                <span className="inline-flex items-center gap-1.5 text-gray-800 font-medium">
                  <MapPin size={10} className="text-blue-500" />
                  {i.location}
                </span>
              </td>
              <td className="py-2 text-right font-mono text-gray-700">{i.days}일</td>
              <td className="py-2 text-right font-mono font-semibold text-blue-700">
                {i.manDays.toLocaleString()}
              </td>
              <td className="py-2 text-gray-500 pl-4">
                {i.firstDate} ~ {i.lastDate}
                <span className="text-gray-300 ml-2">({i.durationDays}d)</span>
              </td>
              <td className="py-2 pl-2">
                <div className="bg-gray-100 rounded h-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded"
                    style={{ width: `${(i.manDays / maxMD) * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PartTable({ items }: { items: PartItem[] }) {
  if (items.length === 0) return <Empty />
  const maxMD = Math.max(...items.map(i => i.manDays), 1)
  return (
    <div className="overflow-x-auto thin-scroll">
      <table className="w-full text-xs">
        <thead className="text-gray-400 border-b border-gray-100 sticky top-0 z-10 bg-white">
          <tr>
            <th className="text-left py-2 font-semibold">부위</th>
            <th className="text-right py-2 font-semibold">활동일</th>
            <th className="text-right py-2 font-semibold">추정 인일</th>
            <th className="text-left py-2 font-semibold pl-4">기간</th>
            <th className="w-40"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map(i => (
            <tr key={i.part} className="hover:bg-gray-50">
              <td className="py-2">
                <span className="inline-flex items-center gap-1.5 text-gray-800 font-medium">
                  <Box size={10} className="text-purple-500" />
                  {i.part}
                </span>
              </td>
              <td className="py-2 text-right font-mono text-gray-700">{i.days}일</td>
              <td className="py-2 text-right font-mono font-semibold text-purple-700">
                {i.manDays.toLocaleString()}
              </td>
              <td className="py-2 text-gray-500 pl-4">
                {i.firstDate} ~ {i.lastDate}
                <span className="text-gray-300 ml-2">({i.durationDays}d)</span>
              </td>
              <td className="py-2 pl-2">
                <div className="bg-gray-100 rounded h-2 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded"
                    style={{ width: `${(i.manDays / maxMD) * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WorkTypeTable({ items }: { items: WorkTypeItem[] }) {
  if (items.length === 0) return <Empty />
  const maxMD = Math.max(...items.map(i => i.manDays), 1)
  return (
    <div className="space-y-2">
      {items.map(i => (
        <div key={i.workType} className="border border-gray-100 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Hammer size={14} className="text-orange-500" />
              <span className="text-sm font-bold text-gray-900">{i.workType}</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-mono font-bold text-blue-700">
                {i.manDays.toLocaleString()} <span className="text-[10px] text-gray-400">인일</span>
              </div>
              <div className="text-[10px] text-gray-400">
                {i.days}일 활동 · {i.firstDate}~{i.lastDate} ({i.durationDays}d)
              </div>
            </div>
          </div>
          <div className="bg-gray-100 rounded h-1.5 overflow-hidden mb-2">
            <div
              className="h-full bg-orange-500 rounded"
              style={{ width: `${(i.manDays / maxMD) * 100}%` }}
            />
          </div>
          {i.relatedTrades.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] text-gray-400">연관 공종:</span>
              {i.relatedTrades.map(rt => (
                <span
                  key={rt.trade}
                  className="text-[10px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded"
                >
                  {rt.trade} {rt.count}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function MatrixHeatmap({ items }: { items: MatrixItem[] }) {
  if (items.length === 0) return <Empty />
  // 위치 정렬: 지하층(B5F→B1F) → PIT → 지상층(1F→NF) → 지붕/옥상 → 구역명 → 부위명
  const locations = Array.from(new Set(items.map(i => i.location))).sort(compareLocation)
  const workTypes = Array.from(new Set(items.map(i => i.workType))).sort()
  const lookup = new Map(items.map(i => [`${i.location}|${i.workType}`, i.days]))
  const max = Math.max(...items.map(i => i.days), 1)

  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] border-collapse">
        <thead>
          <tr>
            <th
              className="sticky left-0 bg-white border-b border-gray-200"
              style={{ height: 90 }}
            ></th>
            {workTypes.map(w => (
              <th
                key={w}
                className="px-1 text-gray-600 font-semibold whitespace-nowrap border-b border-gray-200"
                style={{ height: 90, verticalAlign: 'bottom', minWidth: 28 }}
              >
                <div
                  style={{
                    transform: 'rotate(-55deg)',
                    transformOrigin: 'left bottom',
                    whiteSpace: 'nowrap',
                    display: 'inline-block',
                    marginLeft: 12,
                    marginBottom: 4,
                  }}
                >
                  {w}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {locations.map(loc => (
            <tr key={loc}>
              <td className="sticky left-0 bg-white px-2 py-1 text-gray-800 font-semibold border-r border-gray-100">
                {loc}
              </td>
              {workTypes.map(w => {
                const days = lookup.get(`${loc}|${w}`) ?? 0
                const intensity = days / max
                const bg =
                  days === 0
                    ? '#f8fafc'
                    : `rgba(37, 99, 235, ${Math.max(0.15, intensity)})`
                const color = intensity > 0.5 ? 'white' : '#1f2937'
                return (
                  <td
                    key={w}
                    className="text-center px-1 py-1 font-mono"
                    style={{ background: bg, color, minWidth: 36 }}
                    title={`${loc} × ${w}: ${days}일`}
                  >
                    {days > 0 ? days : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PartMatrixHeatmap({ items }: { items: PartMatrixItem[] }) {
  if (items.length === 0) return <Empty />
  const parts = Array.from(new Set(items.map(i => i.part))).sort()
  const workTypes = Array.from(new Set(items.map(i => i.workType))).sort()
  const lookup = new Map(items.map(i => [`${i.part}|${i.workType}`, i.days]))
  const max = Math.max(...items.map(i => i.days), 1)

  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white border-b border-gray-200" style={{ height: 90 }}></th>
            {workTypes.map(w => (
              <th
                key={w}
                className="px-1 text-gray-600 font-semibold whitespace-nowrap border-b border-gray-200"
                style={{ height: 90, verticalAlign: 'bottom', minWidth: 28 }}
              >
                <div
                  style={{
                    transform: 'rotate(-55deg)',
                    transformOrigin: 'left bottom',
                    whiteSpace: 'nowrap',
                    display: 'inline-block',
                    marginLeft: 12,
                    marginBottom: 4,
                  }}
                >
                  {w}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parts.map(p => (
            <tr key={p}>
              <td className="sticky left-0 bg-white px-2 py-1 text-gray-800 font-semibold border-r border-gray-100">
                {p}
              </td>
              {workTypes.map(w => {
                const days = lookup.get(`${p}|${w}`) ?? 0
                const intensity = days / max
                const bg = days === 0 ? '#f8fafc' : `rgba(147, 51, 234, ${Math.max(0.15, intensity)})`
                const color = intensity > 0.5 ? 'white' : '#1f2937'
                return (
                  <td
                    key={w}
                    className="text-center px-1 py-1 font-mono"
                    style={{ background: bg, color, minWidth: 36 }}
                    title={`${p} × ${w}: ${days}일`}
                  >
                    {days > 0 ? days : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Empty() {
  return <div className="text-center py-6 text-xs text-gray-400">데이터 없음</div>
}

// 위치 정렬 비교: 최하층 → 상부층 → 구역 → 부위
function compareLocation(a: string, b: string): number {
  const ka = locKey(a)
  const kb = locKey(b)
  if (ka.group !== kb.group) return ka.group - kb.group
  if (typeof ka.order === 'number' && typeof kb.order === 'number') {
    return ka.order - kb.order
  }
  return String(ka.order).localeCompare(String(kb.order))
}

function locKey(loc: string): { group: number; order: number | string } {
  // 그룹 1: 층 (지하 → 지상 → 최상부)
  const b = loc.match(/^B(\d+)F$/)
  if (b) return { group: 1, order: -Number(b[1]) * 10 } // B5F=-50, B1F=-10 (최하층 먼저)
  if (loc === 'PIT' || loc === 'PIT층') return { group: 1, order: -5 }
  const f = loc.match(/^(\d+)F$/)
  if (f) return { group: 1, order: Number(f[1]) }
  if (loc === '지붕층' || loc === '관리층') return { group: 1, order: 900 }
  if (loc === '옥상' || loc === '옥탑' || loc === '지붕') return { group: 1, order: 1000 }

  // 그룹 2: 구역 (스튜디오/동/사무동/공용부)
  const studioMatch = loc.match(/^스튜디오\s*(\d+)(?:-(\d+))?/)
  if (studioMatch) {
    const main = Number(studioMatch[1])
    const sub = studioMatch[2] ? Number(studioMatch[2]) : 0
    return { group: 2, order: main * 100 + sub }
  }
  const dong = loc.match(/^(\d+)동$/)
  if (dong) return { group: 2, order: Number(dong[1]) }
  if (loc === '사무동' || loc === '공용부') return { group: 2, order: loc }

  // 그룹 3: 부위/기타 (외벽/기둥/기초/슬래브 등)
  return { group: 3, order: loc }
}
