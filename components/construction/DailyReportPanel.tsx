'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, CalendarDays, Cloud, Thermometer, Users, FileText, Search, X,
  Image as ImageIcon, Upload,
} from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'

interface ManpowerRow {
  trade: string
  company: string
  today: number
  yesterday?: number
}
interface EquipmentRow { name: string; spec: string; today: number; yesterday?: number }
interface MaterialRow { name: string; spec: string; today: number; prev?: number; design?: number }
interface WorkSection { building: string[]; mep: string[] }

interface DailyReport {
  id: string
  date: string
  weather: string | null
  temperature: number | null
  tempMin: number | null
  tempMax: number | null
  workers: Record<string, number> | null
  manpower: ManpowerRow[] | null
  equipment: string | null
  equipmentList: EquipmentRow[] | null
  materialList: MaterialRow[] | null
  workToday: WorkSection | null
  workTomorrow: WorkSection | null
  content: string | null
  notes: string | null
  photos: { url: string; caption?: string; trade?: string; uploadedAt: string }[] | null
}

export default function DailyReportPanel({
  projectId,
  onSaved,
  filterMonth,
  selectedDate,
  onSelectDate,
}: {
  projectId: string
  onSaved?: () => void
  filterMonth?: string
  selectedDate?: string | null
  onSelectDate?: (date: string | null) => void
}) {
  const [reports, setReports] = useState<DailyReport[]>([])
  const [selected, setSelected] = useState<DailyReport | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/daily-reports`)
    if (res.ok) setReports(await res.json())
  }

  useEffect(() => { load() }, [projectId])

  // 외부 selectedDate 변경 시 자동 선택 + 스크롤
  useEffect(() => {
    if (!selectedDate) {
      setSelected(null)
      return
    }
    const found = reports.find(r => r.date === selectedDate)
    if (found) {
      setSelected(found)
      setTimeout(() => {
        const el = listRef.current?.querySelector<HTMLDivElement>(`[data-date="${selectedDate}"]`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    }
  }, [selectedDate, reports])

  const q = searchQuery.trim().toLowerCase()
  const searchActive = q.length > 0
  const visibleReports = searchActive
    ? reports.filter(r => {
        if (r.date.toLowerCase().includes(q)) return true
        const todayItems = [
          ...(r.workToday?.building ?? []),
          ...(r.workToday?.mep ?? []),
        ]
        const tomorrowItems = [
          ...(r.workTomorrow?.building ?? []),
          ...(r.workTomorrow?.mep ?? []),
        ]
        const all = [
          ...todayItems,
          ...tomorrowItems,
          r.notes ?? '',
          r.content ?? '',
        ].join(' ').toLowerCase()
        return all.includes(q)
      })
    : filterMonth
    ? reports.filter(r => r.date.startsWith(filterMonth))
    : reports

  async function del(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/projects/${projectId}/daily-reports/${id}`, { method: 'DELETE' })
    if (selected?.id === id) setSelected(null)
    load()
    onSaved?.()
  }

  const totalWorkers = (r: DailyReport) => {
    if (r.manpower?.length) return r.manpower.reduce((s, m) => s + (m.today || 0), 0)
    return r.workers
      ? Object.values(r.workers as Record<string, number>).reduce((s, v) => s + v, 0)
      : 0
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 500 }}>
      {/* 왼쪽: 목록 */}
      <div className="w-full lg:w-72 flex-shrink-0 space-y-2">
        <Link
          href={`/projects/${projectId}/daily-reports/new`}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#2563eb] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8]"
        >
          <Plus size={14} /> 일보 작성
        </Link>
        {/* 검색창 */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="날짜·작업내용 검색 (예: 2023-12, 타설)"
            className="w-full pl-7 pr-7 py-2 border border-gray-200 rounded-lg text-xs focus:border-blue-400 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {searchActive ? (
          <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs">
            <span className="text-amber-700 font-semibold">
              검색 결과 {visibleReports.length}건
            </span>
            <span className="text-amber-400">전체 {reports.length}건</span>
          </div>
        ) : (
          filterMonth && (
            <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs">
              <span className="text-blue-700 font-semibold">
                {filterMonth.replace('-', '년 ')}월 · {visibleReports.length}건
              </span>
              <span className="text-blue-400">전체 {reports.length}건</span>
            </div>
          )
        )}
        <div ref={listRef} className="bg-white border border-gray-200 rounded-xl overflow-hidden max-h-[540px] overflow-y-auto">
          {reports.length === 0 && (
            <EmptyState
              compact
              icon={FileText}
              title="작성된 일보가 없습니다"
              description="매일 현장 작업을 기록하면 공종별 투입·자재·생산성이 자동 분석됩니다."
              actions={[
                { label: '첫 일보 작성', href: `/projects/${projectId}/daily-reports/new`, icon: <Plus size={12} />, variant: 'primary' },
                { label: '엑셀 임포트', href: '/import', icon: <Upload size={12} />, variant: 'secondary' },
              ]}
            />
          )}
          {reports.length > 0 && visibleReports.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm">
              이 달에는 일보가 없습니다.
            </p>
          )}
          {visibleReports.map(r => (
            <div
              key={r.id}
              data-date={r.date}
              onClick={() => {
                setSelected(r)
                onSelectDate?.(r.date)
              }}
              className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${
                selected?.id === r.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">{r.date}</span>
                <div className="flex gap-1">
                  <Link
                    href={`/projects/${projectId}/daily-reports/${r.id}`}
                    onClick={e => e.stopPropagation()}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Pencil size={11} />
                  </Link>
                  <button
                    onClick={e => { e.stopPropagation(); del(r.id) }}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                <span>{r.weather || '—'}</span>
                {r.tempMin != null && r.tempMax != null ? (
                  <span>{r.tempMin}°/{r.tempMax}°</span>
                ) : r.temperature != null ? (
                  <span>{r.temperature}°C</span>
                ) : null}
                <span>투입 {totalWorkers(r)}명</span>
                {Array.isArray(r.photos) && r.photos.length > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-blue-500">
                    <ImageIcon size={10} />{r.photos.length}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 오른쪽: 상세 */}
      <div className="flex-1 min-w-0">
        {!selected && (
          <div className="flex items-center justify-center h-full bg-white border border-gray-200 rounded-xl text-gray-400">
            <div className="text-center">
              <CalendarDays size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm">왼쪽에서 일보를 선택하거나 새로 작성하세요.</p>
            </div>
          </div>
        )}

        {selected && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <CalendarDays size={16} className="text-[#2563eb]" />
                {selected.date} 공사일보
              </h4>
              <Link
                href={`/projects/${projectId}/daily-reports/${selected.id}`}
                className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
              >
                <Pencil size={12} /> 수정
              </Link>
            </div>

            {/* 기상 / 총인원 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoCard icon={<Cloud size={16} className="text-blue-400" />} label="날씨" value={selected.weather || '—'} />
              <InfoCard
                icon={<Thermometer size={16} className="text-orange-400" />}
                label="기온"
                value={
                  selected.tempMin != null && selected.tempMax != null
                    ? `${selected.tempMin}° / ${selected.tempMax}°C`
                    : selected.temperature != null
                    ? `${selected.temperature}°C`
                    : '—'
                }
              />
              <InfoCard
                icon={<Users size={16} className="text-green-400" />}
                label="총 투입인원"
                value={`${totalWorkers(selected)}명`}
              />
            </div>

            {/* 금일 / 명일 작업 */}
            {(selected.workToday || selected.workTomorrow) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <WorkSectionView label="금일 작업" section={selected.workToday} />
                <WorkSectionView label="명일 작업" section={selected.workTomorrow} />
              </div>
            )}

            {/* 업체별 투입인원 표 */}
            {selected.manpower && selected.manpower.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">업체별 투입인원</p>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr className="text-xs text-gray-500">
                        <th className="text-left px-3 py-1.5 font-semibold">공종</th>
                        <th className="text-left px-3 py-1.5 font-semibold">업체</th>
                        <th className="text-right px-3 py-1.5 font-semibold">금일</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selected.manpower
                        .filter(m => m.today > 0)
                        .map((m, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5">{m.trade}</td>
                            <td className="px-3 py-1.5 text-gray-500">{m.company || '—'}</td>
                            <td className="px-3 py-1.5 text-right font-mono font-semibold text-blue-700">
                              {m.today}명
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 공종별 투입 (구버전 workers 호환) */}
            {!selected.manpower?.length && selected.workers && Object.keys(selected.workers).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">공종별 투입인원</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selected.workers as Record<string, number>)
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => (
                      <span
                        key={k}
                        className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-lg font-semibold"
                      >
                        {k} {v}명
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* 장비 */}
            {selected.equipmentList && selected.equipmentList.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">장비 투입</p>
                <div className="flex flex-wrap gap-2">
                  {selected.equipmentList
                    .filter(e => e.today > 0)
                    .map((e, i) => (
                      <span
                        key={i}
                        className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-lg"
                      >
                        {e.name}
                        {e.spec && ` (${e.spec})`} · {e.today}대
                      </span>
                    ))}
                </div>
              </div>
            )}
            {!selected.equipmentList?.length && selected.equipment && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">장비</p>
                <p className="text-sm text-gray-700">{selected.equipment}</p>
              </div>
            )}

            {/* 자재 */}
            {selected.materialList && selected.materialList.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">자재 투입</p>
                <div className="flex flex-wrap gap-2">
                  {selected.materialList
                    .filter(m => m.today > 0)
                    .map((m, i) => (
                      <span
                        key={i}
                        className="bg-emerald-50 text-emerald-700 text-xs px-2 py-1 rounded-lg"
                      >
                        {m.name}
                        {m.spec && ` (${m.spec})`} · {m.today}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* 구버전 content 호환 */}
            {selected.content && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">작업내용</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                  {selected.content}
                </p>
              </div>
            )}

            {/* 현장 사진 */}
            {Array.isArray(selected.photos) && selected.photos.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                  <ImageIcon size={11} /> 현장 사진 ({selected.photos.length}장)
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {selected.photos.map(p => (
                    <a
                      key={p.url}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative bg-gray-100 rounded-lg overflow-hidden aspect-square"
                      title={p.caption || p.trade || ''}
                    >
                      <img src={p.url} alt={p.caption ?? ''} loading="lazy" className="w-full h-full object-cover" />
                      {(p.trade || p.caption) && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 text-[9px] text-white truncate">
                          {p.trade && <span className="font-semibold mr-1">[{p.trade}]</span>}{p.caption}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 특기사항 */}
            {selected.notes && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">특기사항</p>
                <p className="text-sm text-orange-700 bg-orange-50 rounded-lg p-3 whitespace-pre-wrap">
                  {selected.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
      {icon}
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="font-semibold text-gray-800 text-sm">{value}</p>
      </div>
    </div>
  )
}

function WorkSectionView({
  label,
  section,
}: {
  label: string
  section: WorkSection | null
}) {
  const hasItems =
    section && (section.building.length > 0 || section.mep.length > 0)
  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
      <p className="text-xs font-semibold text-gray-500 mb-2">{label}</p>
      {!hasItems ? (
        <p className="text-xs text-gray-300">—</p>
      ) : (
        <>
          {section!.building.length > 0 && (
            <div className="mb-2">
              <span className="text-[10px] font-bold text-blue-700">▷ 건축</span>
              <ul className="text-xs text-gray-700 ml-2 mt-1 space-y-0.5">
                {section!.building.map((item, i) => (
                  <li key={i}>· {item}</li>
                ))}
              </ul>
            </div>
          )}
          {section!.mep.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-emerald-700">▷ 기계·설비</span>
              <ul className="text-xs text-gray-700 ml-2 mt-1 space-y-0.5">
                {section!.mep.map((item, i) => (
                  <li key={i}>· {item}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
