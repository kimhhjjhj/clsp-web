'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar, Cloud, Sun, CloudRain, Copy, Save, Users, Wrench, Package,
  ChevronRight, Plus, X, Check, FileText, ArrowLeft, Search, HardHat,
  Image as ImageIcon, Sparkles, Loader2,
} from 'lucide-react'
import PhotoUpload, { type Photo } from './PhotoUpload'
import { useAutoSaveDraft } from '@/lib/hooks/useAutoSaveDraft'
import DraftRestoreBanner from '@/components/common/DraftRestoreBanner'
import { useToast } from '@/components/common/Toast'

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
  // 사용자 정의 공종 (골조·토목·전기·통신·소방·가설 등) — 하위호환 위해 옵션
  custom?: Array<{ name: string; items: string[] }>
}

// 작업내용 프리셋 공종 (한 번 클릭으로 추가)
export const CUSTOM_TRADE_PRESETS = [
  '골조', '토목', '전기', '통신', '소방', '마감', '조경', '가설', '철골',
] as const

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
  const toast = useToast()

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
      toast.warning('복제할 이전 일보가 없습니다')
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
    if (!data.date) { toast.warning('날짜를 입력하세요'); return }
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
      toast.error('일보 저장 실패', '초안은 자동 보관됩니다. 네트워크 확인 후 재시도하세요.')
      return
    }
    clearDraft()
    setDirty(false)
    toast.success(isEdit ? '일보 수정됨' : '일보 작성됨', `${data.date} · 총 ${totalToday}명 투입`)
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
    <div className="min-h-full bg-gray-50 overflow-x-hidden max-w-full">
      {/* 상단 바 — 모바일: 2단 stack · 데스크톱: 1줄 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        {/* Row 1: 뒤로·제목·저장 */}
        <div className="px-4 sm:px-8 pt-3 pb-2 flex items-center gap-3">
          <button
            onClick={() => router.push(`/projects/${projectId}/stage/3`)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
            aria-label="뒤로가기"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-gray-400 font-medium leading-tight">공사일보</div>
            <h1 className="text-base font-bold text-gray-900 leading-tight truncate">
              {isEdit ? '일보 수정' : '일일 작업일보 작성'}
            </h1>
          </div>
          {!isEdit && (
            <button
              onClick={copyYesterday}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Copy size={12} /> 어제 복제
            </button>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 h-10 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 flex-shrink-0"
          >
            <Save size={14} /> {saving ? '저장중' : '저장'}
          </button>
        </div>

        {/* Row 2: 요약 칩 (모바일은 가로 스크롤 없이 flex-wrap) */}
        <div className="px-4 sm:px-8 pb-2 flex items-center gap-2 flex-wrap">
          <SummaryChip icon={<Calendar size={13} />} label={data.date || '—'} />
          <SummaryChip
            icon={<Cloud size={13} />}
            label={`${data.weather ?? '—'} ${data.tempMin ?? '—'}°/${data.tempMax ?? '—'}°`}
          />
          <SummaryChip
            icon={<Users size={13} />}
            label={`${totalToday}명 · ${activeCompanies}업체`}
            highlight
          />
        </div>

        {/* 스텝 — 모바일에선 아이콘+번호만, sm 이상에서 이름까지 */}
        <div className="px-3 sm:px-8 pb-2 flex items-center gap-0.5 overflow-x-auto thin-scroll">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = step === s.id
            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 h-10 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                  aria-label={s.name}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  <span className={`text-[11px] font-bold tracking-wider ${active ? 'text-blue-400' : 'text-gray-400'}`}>
                    {String(s.id).padStart(2, '0')}
                  </span>
                  <span className="hidden sm:inline whitespace-nowrap">{s.name}</span>
                </button>
                {i < STEPS.length - 1 && <ChevronRight size={12} className="text-gray-300 flex-shrink-0 hidden sm:block" />}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* 본문 */}
      <div className="px-4 sm:px-8 py-4 sm:py-6 max-w-6xl">
        {/* G7. AI 자동 구조화 — 자유 서술 → 각 필드 자동 채움 */}
        <AiExtractSection
          reportId={reportId}
          onApply={(ext) => {
            setData(d => ({
              ...d,
              weather: (ext.weather as string | undefined) ?? d.weather,
              tempMin: typeof ext.tempMin === 'number' ? ext.tempMin : d.tempMin,
              tempMax: typeof ext.tempMax === 'number' ? ext.tempMax : d.tempMax,
              manpower: Array.isArray(ext.manpower) && ext.manpower.length
                ? (ext.manpower as Array<{trade: string; today: number}>).map(m => ({
                    trade: m.trade, company: '', today: m.today,
                  }))
                : d.manpower,
              equipmentList: Array.isArray(ext.equipmentList) && ext.equipmentList.length
                ? (ext.equipmentList as Array<{name: string; count: number}>).map(e => ({
                    name: e.name, spec: '', today: e.count,
                  }))
                : d.equipmentList,
              materialList: Array.isArray(ext.materialList) && ext.materialList.length
                ? (ext.materialList as Array<{name: string; quantity?: number; unit?: string}>).map(m => ({
                    name: m.name, spec: m.unit ?? '', today: m.quantity ?? 0,
                  }))
                : d.materialList,
            }))
            setDirty(true)
            toast.success('AI 추출 결과를 각 필드에 적용했습니다', '검토 후 저장해주세요')
          }}
        />

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

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 gap-3">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex-1 sm:flex-none h-11 sm:h-10 px-5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-xs sm:text-sm text-gray-400 font-mono tabular-nums flex-shrink-0">
            {step} / {STEPS.length}
          </span>
          {step < STEPS.length ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex-1 sm:flex-none h-11 sm:h-10 px-5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              다음
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 sm:flex-none h-11 sm:h-10 px-5 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            inputMode="decimal"
            value={data.tempMin ?? ''}
            onChange={e => upd('tempMin', e.target.value === '' ? null : Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </Field>
        <Field label="최고기온 (°C)">
          <input
            type="number"
            inputMode="decimal"
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

  // custom 배열 조작 헬퍼
  function updCustomItems(which: 'workToday' | 'workTomorrow', idx: number, items: string[]) {
    const list = (data[which].custom ?? []).slice()
    list[idx] = { ...list[idx], items }
    upd(which, { ...data[which], custom: list })
  }
  function removeCustom(which: 'workToday' | 'workTomorrow', idx: number) {
    const list = (data[which].custom ?? []).filter((_, i) => i !== idx)
    upd(which, { ...data[which], custom: list })
  }
  function addCustom(which: 'workToday' | 'workTomorrow', name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    const list = data[which].custom ?? []
    if (list.some(c => c.name === trimmed)) return  // 중복 방지
    upd(which, { ...data[which], custom: [...list, { name: trimmed, items: [] }] })
  }

  return (
    <>
      <Section title="금일 작업내용" desc="공종별로 항목을 추가하세요. '+공종 추가'로 필요한 공종을 늘릴 수 있습니다.">
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
        {(data.workToday.custom ?? []).map((c, i) => (
          <WorkCategory
            key={`${c.name}-${i}`}
            category={c.name}
            items={c.items}
            onChange={items => updCustomItems('workToday', i, items)}
            onRemove={() => removeCustom('workToday', i)}
          />
        ))}
        <AddCustomTrade
          presets={CUSTOM_TRADE_PRESETS}
          existing={(data.workToday.custom ?? []).map(c => c.name)}
          onAdd={n => addCustom('workToday', n)}
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
        {(data.workTomorrow.custom ?? []).map((c, i) => (
          <WorkCategory
            key={`${c.name}-${i}`}
            category={c.name}
            items={c.items}
            onChange={items => updCustomItems('workTomorrow', i, items)}
            onRemove={() => removeCustom('workTomorrow', i)}
          />
        ))}
        <AddCustomTrade
          presets={CUSTOM_TRADE_PRESETS}
          existing={(data.workTomorrow.custom ?? []).map(c => c.name)}
          onAdd={n => addCustom('workTomorrow', n)}
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
  onRemove,
}: {
  category: string
  items: string[]
  onChange: (items: string[]) => void
  onRemove?: () => void  // 사용자 정의 공종일 때만 제공
}) {
  const [input, setInput] = useState('')
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
          ▷ {category}
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            title="이 공종 제거"
            className="text-[10px] text-gray-400 hover:text-red-500 px-1"
          >삭제</button>
        )}
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

// 사용자 정의 공종 추가 UI — 프리셋 버튼 + 자유 입력
function AddCustomTrade({
  presets,
  existing,
  onAdd,
}: {
  presets: readonly string[]
  existing: string[]
  onAdd: (name: string) => void
}) {
  const [input, setInput] = useState('')
  const used = new Set(existing)
  const available = presets.filter(p => !used.has(p))
  return (
    <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
      <p className="text-[11px] text-gray-500 mb-1.5 font-semibold">+ 공종 추가</p>
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {available.map(p => (
            <button
              key={p}
              onClick={() => onAdd(p)}
              className="text-[11px] px-2 py-1 rounded-md border border-gray-200 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-700"
            >+ {p}</button>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-center">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && input.trim()) { onAdd(input.trim()); setInput('') }
          }}
          placeholder="직접 입력 (예: 방수)"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        />
        <button
          onClick={() => { if (input.trim()) { onAdd(input.trim()); setInput('') } }}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 font-semibold border border-blue-200 rounded-lg hover:bg-blue-50"
        >
          <Plus size={12} /> 추가
        </button>
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
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
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
            inputMode="decimal"
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
            inputMode="decimal"
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
            inputMode="decimal"
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
            inputMode="decimal"
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

// ═══════════════════════════════════════════════════════════
// G7. AI 자동 구조화 섹션
// ═══════════════════════════════════════════════════════════
function AiExtractSection({
  reportId,
  onApply,
}: {
  reportId?: string
  onApply: (ext: Record<string, unknown>) => void
}) {
  const [open, setOpen] = useState(true)
  const [text, setText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setExtracting(true); setError(null); setResult(null)
    try {
      const r = await fetch('/api/ai/extract-daily-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, content: text }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${r.status}`)
      }
      setResult(await r.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 추출 실패')
    } finally { setExtracting(false) }
  }

  const conf = typeof result?.confidence === 'number' ? result.confidence as number : 0
  const confPct = Math.round(conf * 100)
  const confColor = confPct >= 70 ? 'text-emerald-600' : confPct >= 40 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/30"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-600" />
          <span className="text-sm font-bold text-slate-900">AI 자동 구조화</span>
          <span className="text-[11px] text-slate-500">자유 서술 → 기상·인력·자재·작업·이슈 자동 추출</span>
        </div>
        <ChevronRight size={14} className={`text-slate-500 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            placeholder={"예: 오늘 오전 비와서 2층 타설 연기. 철근반 8명 배근 계속 진행. 거푸집 3명 해체 작업. 레미콘 15루베 내일 09시 도착 예정. 안전사고 없음."}
            className="w-full p-2.5 text-sm border border-slate-200 rounded bg-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">
              10자 이상 입력 후 분석 → 구조화된 필드로 자동 채움
            </span>
            <button
              type="button"
              onClick={run}
              disabled={extracting || text.trim().length < 10}
              className="ml-auto h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50 hover:bg-indigo-700"
            >
              {extracting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {extracting ? '분석 중...' : 'AI 추출'}
            </button>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {error}
            </div>
          )}

          {result && (
            <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-700">추출 완료</span>
                  <span className={`font-mono font-bold ${confColor}`}>
                    신뢰도 {confPct}%
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onApply(result)}
                  className="h-7 px-2.5 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Check size={11} /> 필드에 적용
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-slate-50 rounded px-2 py-1">
                  <div className="text-slate-400 text-[10px]">날씨</div>
                  <div className="font-semibold text-slate-800">{String(result.weather ?? '—')}</div>
                </div>
                <div className="bg-slate-50 rounded px-2 py-1">
                  <div className="text-slate-400 text-[10px]">기온</div>
                  <div className="font-semibold text-slate-800">
                    {result.tempMin != null ? `${result.tempMin}~${result.tempMax ?? '—'}°C` : '—'}
                  </div>
                </div>
                <div className="bg-slate-50 rounded px-2 py-1">
                  <div className="text-slate-400 text-[10px]">인력</div>
                  <div className="font-semibold text-slate-800">
                    {Array.isArray(result.manpower) ? `${result.manpower.length}공종` : '—'}
                  </div>
                </div>
                <div className="bg-slate-50 rounded px-2 py-1">
                  <div className="text-slate-400 text-[10px]">이슈</div>
                  <div className="font-semibold text-slate-800">
                    {Array.isArray(result.issues) ? `${result.issues.length}건` : '—'}
                  </div>
                </div>
              </div>
              {Array.isArray(result.issues) && result.issues.length > 0 && (
                <ul className="text-xs text-slate-600 space-y-0.5 pt-1 border-t border-slate-100">
                  {(result.issues as Array<{severity: string; description: string}>).map((iss, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                        iss.severity === 'high' ? 'bg-red-500' :
                        iss.severity === 'med' ? 'bg-amber-500' : 'bg-slate-400'
                      }`} />
                      <span>{iss.description}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

