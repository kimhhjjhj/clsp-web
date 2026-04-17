'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar, Cloud, Sun, CloudRain, Copy, Save, Users, Wrench, Package,
  ChevronRight, Plus, X, Check, FileText, ArrowLeft, Search, HardHat,
  Image as ImageIcon,
} from 'lucide-react'
import PhotoUpload, { type Photo } from './PhotoUpload'
import { useAutoSaveDraft } from '@/lib/hooks/useAutoSaveDraft'
import DraftRestoreBanner from '@/components/common/DraftRestoreBanner'

export interface DailyReportData {
  id?: string
  date: string
  weather: string | null
  tempMin: number | null
  tempMax: number | null
  manpower: ManpowerRow[]
  equipmentList: EquipmentRow[]
  materialList: MaterialRow[]
  workToday: WorkSection
  workTomorrow: WorkSection
  notes: string | null
  signers: Signers | null
  photos?: Photo[]
}

export interface ManpowerRow {
  trade: string
  company: string
  yesterday?: number
  today: number
}

export interface EquipmentRow {
  name: string
  spec: string
  yesterday?: number
  today: number
}

export interface MaterialRow {
  name: string
  spec: string
  design?: number
  prev?: number
  today: number
}

export interface WorkSection {
  building: string[]
  mep: string[]
}

export interface Signers {
  site_manager?: boolean
  construction?: boolean
  supervisor?: boolean
}

const STEPS = [
  { id: 1, name: '기본정보', icon: Calendar },
  { id: 2, name: '작업내용', icon: FileText },
  { id: 3, name: '투입인원', icon: Users },
  { id: 4, name: '자재·장비', icon: Wrench },
  { id: 5, name: '현장 사진', icon: ImageIcon },
]

export const EMPTY_DATA: DailyReportData = {
  date: new Date().toISOString().slice(0, 10),
  weather: '맑음',
  tempMin: null,
  tempMax: null,
  manpower: [],
  equipmentList: [],
  materialList: [],
  workToday: { building: [], mep: [] },
  workTomorrow: { building: [], mep: [] },
  notes: null,
  signers: {},
  photos: [],
}

interface Props {
  projectId: string
  reportId?: string
  initialData?: DailyReportData
}

export default function DailyReportForm({ projectId, reportId, initialData }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<DailyReportData>(initialData ?? EMPTY_DATA)
  const [saving, setSaving] = useState(false)
  const [showZero, setShowZero] = useState(false)
  const [search, setSearch] = useState('')
  const [dirty, setDirty] = useState(false)
  const isEdit = !!reportId

  // 자동 저장 초안 — 신규: projectId+date, 편집: projectId+reportId
  const draftKey = isEdit ? `dr-draft:${projectId}:${reportId}` : `dr-draft-new:${projectId}:${data.date}`
  const { hasDraft, draftEnvelope, lastSavedAt, clearDraft, applyDraft } = useAutoSaveDraft<DailyReportData>({
    key: draftKey,
    data,
    enabled: dirty,
    isMeaningful: d => d.manpower.length > 0 || (d.workToday.building.length + d.workToday.mep.length) > 0 || !!d.notes,
  })

  const totalToday = data.manpower.reduce((s, c) => s + (c.today || 0), 0)
  const activeCompanies = data.manpower.filter(c => (c.today || 0) > 0).length

  async function copyYesterday() {
    const res = await fetch(`/api/projects/${projectId}/daily-reports`)
    const list: any[] = res.ok ? await res.json() : []
    const latest = list.find(r => r.date < data.date) ?? list[0]
    if (!latest) {
      alert('복제할 이전 일보가 없습니다.')
      return
    }
    setData(prev => ({
      ...prev,
      weather: latest.weather ?? prev.weather,
      tempMin: latest.tempMin ?? prev.tempMin,
      tempMax: latest.tempMax ?? prev.tempMax,
      manpower: (latest.manpower ?? []).map((m: ManpowerRow) => ({
        ...m,
        yesterday: m.today,
        today: 0,
      })),
      equipmentList: (latest.equipmentList ?? []).map((e: EquipmentRow) => ({
        ...e,
        yesterday: e.today,
        today: 0,
      })),
      materialList: (latest.materialList ?? []).map((m: MaterialRow) => ({
        ...m,
        prev: (m.prev ?? 0) + (m.today ?? 0),
        today: 0,
      })),
      workToday: latest.workToday ?? prev.workToday,
      workTomorrow: latest.workTomorrow ?? prev.workTomorrow,
    }))
  }

  async function save() {
    if (!data.date) return alert('날짜를 입력하세요.')
    setSaving(true)
    const body = {
      date: data.date,
      weather: data.weather,
      tempMin: data.tempMin,
      tempMax: data.tempMax,
      manpower: data.manpower,
      equipmentList: data.equipmentList,
      materialList: data.materialList,
      workToday: data.workToday,
      workTomorrow: data.workTomorrow,
      signers: data.signers,
      notes: data.notes,
      photos: data.photos ?? [],
      workers: data.manpower.reduce<Record<string, number>>((acc, m) => {
        if (m.today > 0) acc[m.trade] = (acc[m.trade] ?? 0) + m.today
        return acc
      }, {}),
    }
    const url = isEdit
      ? `/api/projects/${projectId}/daily-reports/${reportId}`
      : `/api/projects/${projectId}/daily-reports`
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      alert('저장 실패 — 초안은 자동 보관되어 있습니다. 네트워크 확인 후 재시도하세요.')
      return
    }
    clearDraft()
    setDirty(false)
    router.push(`/projects/${projectId}/stage/3`)
  }

  function upd<K extends keyof DailyReportData>(key: K, val: DailyReportData[K]) {
    setData(p => ({ ...p, [key]: val }))
  }

  // 데이터 변경 시 dirty 자동 감지 (첫 렌더 제외)
  const firstRenderRef = React.useRef(true)
  useEffect(() => {
    if (firstRenderRef.current) { firstRenderRef.current = false; return }
    setDirty(true)
  }, [data])

  const visibleManpower = data.manpower.filter(c => {
    if (!showZero && !c.today && c.today !== 0) return false
    if (search && !c.trade.includes(search) && !c.company.includes(search)) return false
    return true
  })

  return (
    <div className="min-h-full bg-gray-50">
      {/* 상단 바 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/projects/${projectId}/stage/3`)}
              className="p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="text-xs text-gray-400 font-medium">공사일보</div>
              <h1 className="text-base font-bold text-gray-900">
                {isEdit ? '일보 수정' : '일일 작업일보 작성'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <SummaryChip icon={<Calendar size={14} />} label={data.date || '—'} />
            <SummaryChip
              icon={<Cloud size={14} />}
              label={`${data.weather ?? '—'} · ${data.tempMin ?? '—'}°/${data.tempMax ?? '—'}°`}
            />
            <SummaryChip
              icon={<Users size={14} />}
              label={`총 ${totalToday}명 · ${activeCompanies}개 업체`}
              highlight
            />
            {!isEdit && (
              <button
                onClick={copyYesterday}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Copy size={12} /> 어제 일보 복제
              </button>
            )}
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              <Save size={12} /> {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        {/* 스텝 */}
        <div className="px-8 pb-2 flex items-center gap-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = step === s.id
            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={14} />
                  <span className="text-[11px] font-bold tracking-wider text-gray-400">
                    {String(s.id).padStart(2, '0')}
                  </span>
                  {s.name}
                </button>
                {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-300" />}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* 본문 */}
      <div className="px-8 py-6 max-w-6xl">
        {/* 초안 복원 배너 */}
        {hasDraft && draftEnvelope && (
          <div className="mb-4">
            <DraftRestoreBanner
              savedAt={draftEnvelope.savedAt}
              label="일보 변경"
              onRestore={() => applyDraft(d => { setData(d); setDirty(true) })}
              onDiscard={() => clearDraft()}
            />
          </div>
        )}

        {step === 1 && (
          <BasicInfoStep data={data} upd={upd} />
        )}
        {step === 2 && (
          <WorkStep data={data} upd={upd} />
        )}
        {step === 3 && (
          <ManpowerStep
            data={data}
            upd={upd}
            showZero={showZero}
            setShowZero={setShowZero}
            search={search}
            setSearch={setSearch}
            visible={visibleManpower}
          />
        )}
        {step === 4 && <EquipMatStep data={data} upd={upd} />}
        {step === 5 && (
          <PhotoStep
            projectId={projectId}
            reportId={reportId}
            photos={data.photos ?? []}
            onChange={photos => upd('photos', photos)}
          />
        )}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-sm text-gray-400">
            {step} / {STEPS.length}
          </span>
          {step < STEPS.length ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              다음
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장하고 닫기'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── 공용 UI ───────────────────────────
function SummaryChip({
  icon,
  label,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  highlight?: boolean
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
        highlight ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'
      }`}
    >
      {icon}
      {label}
    </div>
  )
}

function Section({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
      {children}
    </div>
  )
}

// ─────────────────────────── 스텝 1: 기본정보 ───────────────────────────
function BasicInfoStep({
  data,
  upd,
}: {
  data: DailyReportData
  upd: <K extends keyof DailyReportData>(k: K, v: DailyReportData[K]) => void
}) {
  return (
    <Section title="기본 정보" desc="날짜와 기상 조건. 이 값들은 상단 요약바에 실시간 반영됩니다.">
      <div className="grid grid-cols-4 gap-4">
        <Field label="작성일">
          <input
            type="date"
            value={data.date}
            onChange={e => upd('date', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </Field>
        <Field label="날씨">
          <div className="flex gap-1">
            {(['맑음', '흐림', '비'] as const).map(w => (
              <button
                key={w}
                onClick={() => upd('weather', w)}
                className={`flex-1 px-2 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  data.weather === w
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {w === '맑음' && <Sun size={14} className="inline mr-1" />}
                {w === '흐림' && <Cloud size={14} className="inline mr-1" />}
                {w === '비' && <CloudRain size={14} className="inline mr-1" />}
                {w}
              </button>
            ))}
          </div>
        </Field>
        <Field label="최저기온 (°C)">
          <input
            type="number"
            value={data.tempMin ?? ''}
            onChange={e => upd('tempMin', e.target.value === '' ? null : Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </Field>
        <Field label="최고기온 (°C)">
          <input
            type="number"
            value={data.tempMax ?? ''}
            onChange={e => upd('tempMax', e.target.value === '' ? null : Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </Field>
      </div>
    </Section>
  )
}

// ─────────────────────────── 스텝 2: 작업내용 ───────────────────────────
function WorkStep({
  data,
  upd,
}: {
  data: DailyReportData
  upd: <K extends keyof DailyReportData>(k: K, v: DailyReportData[K]) => void
}) {
  function updWork(which: 'workToday' | 'workTomorrow', cat: 'building' | 'mep', items: string[]) {
    upd(which, { ...data[which], [cat]: items })
  }

  return (
    <>
      <Section title="금일 작업내용" desc="공종별로 항목을 추가하세요.">
        <WorkCategory
          category="건축"
          items={data.workToday.building}
          onChange={items => updWork('workToday', 'building', items)}
        />
        <WorkCategory
          category="기계·소방설비"
          items={data.workToday.mep}
          onChange={items => updWork('workToday', 'mep', items)}
        />
      </Section>

      <Section title="명일 작업내용" desc="내일 예정 작업을 공종별로 작성.">
        <WorkCategory
          category="건축"
          items={data.workTomorrow.building}
          onChange={items => updWork('workTomorrow', 'building', items)}
        />
        <WorkCategory
          category="기계·소방설비"
          items={data.workTomorrow.mep}
          onChange={items => updWork('workTomorrow', 'mep', items)}
        />
      </Section>

      <Section title="특기사항" desc="안전·품질·민원 등 현장 이슈.">
        <textarea
          rows={3}
          value={data.notes ?? ''}
          onChange={e => upd('notes', e.target.value)}
          placeholder="예) 14:00 지하 1층 B구역 누수 발생 — 방수업체 긴급 투입 예정"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
        />
      </Section>
    </>
  )
}

function WorkCategory({
  category,
  items,
  onChange,
}: {
  category: string
  items: string[]
  onChange: (items: string[]) => void
}) {
  const [input, setInput] = useState('')
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
          ▷ {category}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700"
          >
            <span className="text-gray-300">—</span>
            <span className="flex-1">{item}</span>
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-gray-300 hover:text-red-500"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <div className="flex gap-2 items-center">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && input.trim()) {
                onChange([...items, input.trim()])
                setInput('')
              }
            }}
            placeholder="항목 입력 후 Enter"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => {
              if (input.trim()) {
                onChange([...items, input.trim()])
                setInput('')
              }
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 font-semibold border border-blue-200 rounded-lg hover:bg-blue-50"
          >
            <Plus size={12} /> 추가
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── 스텝 3: 투입인원 ───────────────────────────
function ManpowerStep({
  data,
  upd,
  showZero,
  setShowZero,
  search,
  setSearch,
  visible,
}: {
  data: DailyReportData
  upd: <K extends keyof DailyReportData>(k: K, v: DailyReportData[K]) => void
  showZero: boolean
  setShowZero: (v: boolean) => void
  search: string
  setSearch: (v: string) => void
  visible: ManpowerRow[]
}) {
  const [addTrade, setAddTrade] = useState('')
  const [addCompany, setAddCompany] = useState('')

  function updRow(i: number, patch: Partial<ManpowerRow>) {
    upd(
      'manpower',
      data.manpower.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    )
  }
  function removeRow(i: number) {
    upd('manpower', data.manpower.filter((_, idx) => idx !== i))
  }
  function addRow() {
    if (!addTrade.trim()) return
    upd('manpower', [
      ...data.manpower,
      { trade: addTrade.trim(), company: addCompany.trim(), today: 0, yesterday: 0 },
    ])
    setAddTrade('')
    setAddCompany('')
  }

  const totalYest = data.manpower.reduce((s, c) => s + (c.yesterday || 0), 0)
  const totalToday = data.manpower.reduce((s, c) => s + (c.today || 0), 0)
  const totalSum = totalYest + totalToday

  return (
    <Section
      title="업체별 투입인원"
      desc="0명 업체는 기본 숨김. 전일은 이전 일보에서 자동 세팅. 금일만 입력."
    >
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex-1 max-w-sm relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="공종 또는 업체명 검색..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" checked={showZero} onChange={e => setShowZero(e.target.checked)} />
          0명 업체 표시
        </label>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-xs text-gray-500">
              <th className="text-left px-4 py-2 font-semibold">공종</th>
              <th className="text-left px-4 py-2 font-semibold">업체명</th>
              <th className="text-right px-4 py-2 font-semibold text-gray-400">전일</th>
              <th className="text-right px-4 py-2 font-semibold bg-blue-50 text-blue-700">
                금일 <span className="font-normal">(입력)</span>
              </th>
              <th className="text-right px-4 py-2 font-semibold text-gray-400">누계 (자동)</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400 text-sm">
                  아래에서 업체를 추가하세요
                </td>
              </tr>
            )}
            {visible.map((c) => {
              const idx = data.manpower.indexOf(c)
              return (
                <tr
                  key={idx}
                  className={`hover:bg-blue-50/30 ${c.today > 0 ? 'bg-blue-50/20' : ''}`}
                >
                  <td className="px-4 py-2.5 font-medium text-gray-800">{c.trade}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.company || '-'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400 font-mono">
                    {(c.yesterday ?? 0).toLocaleString()}
                  </td>
                  <td className="px-1 py-1 bg-blue-50/30">
                    <input
                      type="number"
                      value={c.today || ''}
                      placeholder="0"
                      onChange={e => updRow(idx, { today: Number(e.target.value) || 0 })}
                      className="w-full text-right font-mono text-blue-900 font-semibold bg-transparent border border-transparent hover:border-blue-300 focus:border-blue-500 focus:bg-white rounded px-2 py-1.5 outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                    {((c.yesterday ?? 0) + c.today).toLocaleString()}
                  </td>
                  <td className="px-2">
                    <button
                      onClick={() => removeRow(idx)}
                      className="p-1 text-gray-300 hover:text-red-500"
                    >
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {data.manpower.length > 0 && (
            <tfoot className="bg-gray-900 text-white">
              <tr>
                <td className="px-4 py-2.5 font-bold" colSpan={2}>합계</td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-300">
                  {totalYest.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-bold text-blue-300">
                  {totalToday.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-bold">
                  {totalSum.toLocaleString()}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 추가 행 */}
      <div className="flex gap-2 items-center bg-gray-50 rounded-xl p-3">
        <input
          value={addTrade}
          onChange={e => setAddTrade(e.target.value)}
          placeholder="공종 (예: 철근)"
          className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        />
        <input
          value={addCompany}
          onChange={e => setAddCompany(e.target.value)}
          placeholder="업체명 (선택)"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        />
        <button
          onClick={addRow}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={12} /> 업체 추가
        </button>
      </div>
    </Section>
  )
}

// ─────────────────────────── 스텝 4: 자재·장비 ───────────────────────────
function EquipMatStep({
  data,
  upd,
}: {
  data: DailyReportData
  upd: <K extends keyof DailyReportData>(k: K, v: DailyReportData[K]) => void
}) {
  const [eqName, setEqName] = useState('')
  const [eqSpec, setEqSpec] = useState('')
  const [matName, setMatName] = useState('')
  const [matSpec, setMatSpec] = useState('')
  const [matDesign, setMatDesign] = useState('')

  function updEq(i: number, patch: Partial<EquipmentRow>) {
    upd('equipmentList', data.equipmentList.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function rmEq(i: number) {
    upd('equipmentList', data.equipmentList.filter((_, idx) => idx !== i))
  }
  function addEq() {
    if (!eqName.trim()) return
    upd('equipmentList', [
      ...data.equipmentList,
      { name: eqName.trim(), spec: eqSpec.trim(), today: 0, yesterday: 0 },
    ])
    setEqName('')
    setEqSpec('')
  }

  function updMat(i: number, patch: Partial<MaterialRow>) {
    upd('materialList', data.materialList.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function rmMat(i: number) {
    upd('materialList', data.materialList.filter((_, idx) => idx !== i))
  }
  function addMat() {
    if (!matName.trim()) return
    upd('materialList', [
      ...data.materialList,
      {
        name: matName.trim(),
        spec: matSpec.trim(),
        design: matDesign ? Number(matDesign) : undefined,
        prev: 0,
        today: 0,
      },
    ])
    setMatName('')
    setMatSpec('')
    setMatDesign('')
  }

  return (
    <>
      <Section title="장비 투입현황" desc="금일 투입량만 입력. 전일은 자동.">
        {data.equipmentList.length === 0 && (
          <div className="text-center py-6 text-gray-400 text-sm">
            장비가 없습니다. 아래에서 추가하세요.
          </div>
        )}
        {data.equipmentList.map((e, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-800">{e.name}</div>
              <div className="text-xs text-gray-400">{e.spec || '—'}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-400">전일</div>
              <div className="text-sm font-mono text-gray-500">{e.yesterday ?? 0}</div>
            </div>
            <div className="text-right w-20">
              <div className="text-[10px] text-blue-600 font-semibold">금일</div>
              <input
                type="number"
                value={e.today || ''}
                onChange={ev => updEq(i, { today: Number(ev.target.value) || 0 })}
                placeholder="0"
                className="w-full text-right font-mono text-sm font-semibold text-blue-900 border border-blue-200 rounded-md px-2 py-1 bg-blue-50/30"
              />
            </div>
            <div className="text-right w-20">
              <div className="text-[10px] text-gray-400">누계</div>
              <div className="text-sm font-mono text-gray-700">{(e.yesterday ?? 0) + e.today}</div>
            </div>
            <button onClick={() => rmEq(i)} className="text-gray-300 hover:text-red-500 p-1">
              <X size={14} />
            </button>
          </div>
        ))}

        <div className="flex gap-2 mt-3 bg-gray-50 rounded-xl p-3">
          <input
            value={eqName}
            onChange={e => setEqName(e.target.value)}
            placeholder="장비명 (예: 타워크레인)"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <input
            value={eqSpec}
            onChange={e => setEqSpec(e.target.value)}
            placeholder="규격 (선택)"
            className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <button
            onClick={addEq}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={12} /> 장비 추가
          </button>
        </div>
      </Section>

      <Section title="자재 투입현황" desc="규격별로 금회 투입량만. 누계·잔량은 자동.">
        {data.materialList.length === 0 && (
          <div className="text-center py-6 text-gray-400 text-sm">
            자재가 없습니다. 아래에서 추가하세요.
          </div>
        )}
        {data.materialList.map((m, i) => {
          const total = (m.prev ?? 0) + m.today
          const remain = (m.design ?? 0) - total
          const pct = m.design ? Math.min(100, Math.round((total / m.design) * 100)) : 0
          return (
            <div key={i} className="py-3 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-800">
                    {m.name} <span className="text-gray-400 font-normal">· {m.spec || '—'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-400">설계량</div>
                  <div className="text-sm font-mono text-gray-700">
                    {m.design ? m.design.toLocaleString() : '—'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-400">전회</div>
                  <div className="text-sm font-mono text-gray-500">
                    {(m.prev ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="text-right w-24">
                  <div className="text-[10px] text-blue-600 font-semibold">금회</div>
                  <input
                    type="number"
                    value={m.today || ''}
                    onChange={ev => updMat(i, { today: Number(ev.target.value) || 0 })}
                    placeholder="0"
                    className="w-full text-right font-mono text-sm font-semibold text-blue-900 border border-blue-200 rounded-md px-2 py-1 bg-blue-50/30"
                  />
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-400">잔량</div>
                  <div className="text-sm font-mono text-emerald-600 font-semibold">
                    {m.design ? remain.toLocaleString() : '—'}
                  </div>
                </div>
                <button onClick={() => rmMat(i)} className="text-gray-300 hover:text-red-500 p-1">
                  <X size={14} />
                </button>
              </div>
              {m.design ? (
                <>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 text-right">진행률 {pct}%</div>
                </>
              ) : null}
            </div>
          )
        })}

        <div className="flex gap-2 mt-3 bg-gray-50 rounded-xl p-3">
          <input
            value={matName}
            onChange={e => setMatName(e.target.value)}
            placeholder="자재명 (예: 레미콘)"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <input
            value={matSpec}
            onChange={e => setMatSpec(e.target.value)}
            placeholder="규격 (예: 25-21-150)"
            className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <input
            value={matDesign}
            onChange={e => setMatDesign(e.target.value)}
            placeholder="설계량 (선택)"
            type="number"
            className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <button
            onClick={addMat}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={12} /> 자재 추가
          </button>
        </div>
      </Section>
    </>
  )
}

// ── 사진 스텝 ────────────────────────────────────────────────
function PhotoStep({
  projectId,
  reportId,
  photos,
  onChange,
}: {
  projectId: string
  reportId?: string
  photos: Photo[]
  onChange: (photos: Photo[]) => void
}) {
  if (!reportId) {
    return (
      <Section title="현장 사진" desc="사진은 일보 저장 후 업로드 가능합니다.">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">일보를 먼저 저장하세요</p>
          <p className="text-xs text-amber-700 leading-relaxed">
            사진은 일보 ID가 있어야 업로드할 수 있습니다. 1~4단계 입력 완료 후 저장 버튼을 눌러
            일보를 생성한 뒤, 다시 들어와 이 탭에서 사진을 추가해주세요.
          </p>
        </div>
      </Section>
    )
  }
  return (
    <Section title="현장 사진" desc={`현장 사진을 업로드하고 공종·설명 태깅. 현재 ${photos.length}장.`}>
      <PhotoUpload
        projectId={projectId}
        reportId={reportId}
        photos={photos}
        onChange={onChange}
      />
    </Section>
  )
}
