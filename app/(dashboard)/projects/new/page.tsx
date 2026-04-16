'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ChevronRight } from 'lucide-react'

interface FormData {
  name: string
  client: string
  contractor: string
  location: string
  type: string
  startDate: string
  ground: string
  basement: string
  lowrise: string
  hasTransfer: boolean
  siteArea: string
  bldgArea: string
  sitePerim: string
  bldgPerim: string
  wtBottom: string
  waBottom: string
}

const INITIAL: FormData = {
  name: '',
  client: '',
  contractor: '',
  location: '',
  type: '공동주택',
  startDate: '',
  ground: '',
  basement: '',
  lowrise: '0',
  hasTransfer: false,
  siteArea: '',
  bldgArea: '',
  sitePerim: '',
  bldgPerim: '',
  wtBottom: '',
  waBottom: '',
}

export default function NewProjectPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: keyof FormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) { setError('프로젝트명을 입력해주세요.'); return }
    if (!form.ground || Number(form.ground) < 1) { setError('지상 층수를 입력해주세요.'); return }

    setSaving(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        client: form.client || undefined,
        contractor: form.contractor || undefined,
        location: form.location || undefined,
        type: form.type || undefined,
        startDate: form.startDate || undefined,
        ground: Number(form.ground),
        basement: Number(form.basement) || 0,
        lowrise: Number(form.lowrise) || 0,
        hasTransfer: form.hasTransfer,
        siteArea: form.siteArea ? Number(form.siteArea) : undefined,
        bldgArea: form.bldgArea ? Number(form.bldgArea) : undefined,
        sitePerim: form.sitePerim ? Number(form.sitePerim) : undefined,
        bldgPerim: form.bldgPerim ? Number(form.bldgPerim) : undefined,
        wtBottom: form.wtBottom ? Number(form.wtBottom) : undefined,
        waBottom: form.waBottom ? Number(form.waBottom) : undefined,
      }),
    })

    if (!res.ok) {
      setError('저장에 실패했습니다. 다시 시도해주세요.')
      setSaving(false)
      return
    }

    const project = await res.json()
    router.push(`/projects/${project.id}`)
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* 헤더 */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <span>대시보드</span>
        <ChevronRight size={14} />
        <span className="text-white">새 프로젝트</span>
      </div>
      <h1 className="text-2xl font-bold text-white mb-1">새 프로젝트</h1>
      <p className="text-sm text-gray-500 mb-8">기본 정보를 입력하면 WBS와 CPM이 자동으로 생성됩니다</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 프로젝트 기본 정보 */}
        <Section title="프로젝트 정보">
          <div className="grid grid-cols-2 gap-4">
            <Field label="프로젝트명 *" span={2}>
              <input
                type="text"
                placeholder="예) 강남구 OO아파트 신축공사"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="발주처">
              <input type="text" placeholder="예) OO건설" value={form.client} onChange={e => set('client', e.target.value)} className={inputCls} />
            </Field>
            <Field label="시공사">
              <input type="text" placeholder="예) (주)OO건설" value={form.contractor} onChange={e => set('contractor', e.target.value)} className={inputCls} />
            </Field>
            <Field label="공사위치">
              <input type="text" placeholder="예) 서울시 강남구" value={form.location} onChange={e => set('location', e.target.value)} className={inputCls} />
            </Field>
            <Field label="건물 유형">
              <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls}>
                <option>공동주택</option>
                <option>오피스텔</option>
                <option>주상복합</option>
                <option>기타</option>
              </select>
            </Field>
            <Field label="착공 예정일">
              <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* 건물 규모 */}
        <Section title="건물 규모">
          <div className="grid grid-cols-3 gap-4">
            <Field label="지상 층수 *">
              <input type="number" min={1} placeholder="예) 25" value={form.ground} onChange={e => set('ground', e.target.value)} className={inputCls} />
            </Field>
            <Field label="지하 층수">
              <input type="number" min={0} placeholder="예) 3" value={form.basement} onChange={e => set('basement', e.target.value)} className={inputCls} />
            </Field>
            <Field label="저층부 층수">
              <input type="number" min={0} placeholder="예) 2" value={form.lowrise} onChange={e => set('lowrise', e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => set('hasTransfer', !form.hasTransfer)}
                className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${
                  form.hasTransfer ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${form.hasTransfer ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm text-gray-300">전이층 (Transfer Slab) 있음</span>
            </label>
          </div>
        </Section>

        {/* 면적 정보 */}
        <Section title="면적 정보">
          <div className="grid grid-cols-2 gap-4">
            <Field label="대지면적 (m²)">
              <input type="number" min={0} placeholder="예) 5000" value={form.siteArea} onChange={e => set('siteArea', e.target.value)} className={inputCls} />
            </Field>
            <Field label="연면적 (m²)">
              <input type="number" min={0} placeholder="예) 25000" value={form.bldgArea} onChange={e => set('bldgArea', e.target.value)} className={inputCls} />
            </Field>
            <Field label="대지 둘레 (m)">
              <input type="number" min={0} placeholder="예) 300" value={form.sitePerim} onChange={e => set('sitePerim', e.target.value)} className={inputCls} />
            </Field>
            <Field label="건물 둘레 (m)">
              <input type="number" min={0} placeholder="예) 200" value={form.bldgPerim} onChange={e => set('bldgPerim', e.target.value)} className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* 지하/지층 조건 (지하 있을 때만 의미있음) */}
        {Number(form.basement) > 0 && (
          <Section title="지하 조건">
            <div className="grid grid-cols-2 gap-4">
              <Field label="지하수위 깊이 (m)">
                <input type="number" min={0} step={0.1} placeholder="예) 5.0" value={form.wtBottom} onChange={e => set('wtBottom', e.target.value)} className={inputCls} />
              </Field>
              <Field label="흙막이 깊이 (m)">
                <input type="number" min={0} step={0.1} placeholder="예) 12.5" value={form.waBottom} onChange={e => set('waBottom', e.target.value)} className={inputCls} />
              </Field>
            </div>
          </Section>
        )}

        {/* 에러 */}
        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* 제출 */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <Building2 size={16} />
            {saving ? 'WBS 생성 중...' : '프로젝트 생성 및 공기산정 시작'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  )
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function Field({
  label,
  span,
  children,
}: {
  label: string
  span?: number
  children: React.ReactNode
}) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
