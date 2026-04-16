'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, Building2, Layers, Settings2, MapPin,
  Info, Cpu, Upload, Search, Loader2, Check,
  Drill, ArrowLeft, ArrowRight, Sparkles,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import BuildingDiagram from '@/components/diagram/BuildingDiagram'
import DxfPreview from '@/components/diagram/DxfPreview'

// ── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  name: string; client: string; contractor: string
  location: string; type: string; startDate: string
  ground: string; basement: string; lowrise: string
  hasTransfer: boolean
  siteArea: string; bldgArea: string; sitePerim: string; bldgPerim: string
  groundCond: string
  // 지반정보 step
  wtBottom: string; waBottom: string
  excDepth: string
  mode: 'cp' | 'full'
}

interface BoreholeResult {
  id: string
  distance_m: number
  lat: number
  lng: number
  depth: number | null
  addr: string
  wt: number | null       // 풍화토 하단
  wtr: number | null      // 풍화암 하단
  wt_display: string
  wtr_display: string
  layers: { soil_type: string; depth_from: number; depth_to: number }[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INITIAL: FormData = {
  name: '', client: '', contractor: '', location: '',
  type: '공동주택', startDate: '',
  ground: '', basement: '0', lowrise: '0', hasTransfer: false,
  siteArea: '', bldgArea: '', sitePerim: '', bldgPerim: '',
  groundCond: '보통',
  wtBottom: '', waBottom: '', excDepth: '',
  mode: 'cp',
}

const STEPS = [
  { id: 1, label: '기본 정보',    icon: Info,      desc: '프로젝트 개요' },
  { id: 2, label: '건물 규모',    icon: Building2,  desc: '층수 · 면적' },
  { id: 3, label: '지반정보',     icon: Drill,      desc: '토질 · 굴착' },
  { id: 4, label: '산정 설정',    icon: Settings2,  desc: '모드 선택' },
]

const TOTAL_STEPS = STEPS.length

// Helper to extract dominant soil depth from borehole layers
function extractSoilDepth(layers: BoreholeResult['layers'], type: string): number {
  for (const layer of layers) {
    const t = layer.soil_type
    if (type === 'wt' && (t.includes('풍화토') || t.includes('표토') || t.includes('매립'))) {
      return layer.depth_to
    }
    if (type === 'wa' && (t.includes('풍화암'))) {
      return layer.depth_to
    }
    if (type === 'ra' && (t.includes('연암') || t.includes('경암'))) {
      return layer.depth_to
    }
  }
  return 0
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep]     = useState(1)
  const [form, setForm]     = useState<FormData>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Map & geocoding state
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [isLoadingMap, setIsLoadingMap] = useState(false)
  const [geocodeError, setGeocodeError] = useState('')

  // Borehole state
  const [boreholes, setBoreholes] = useState<BoreholeResult[]>([])
  const [isLoadingBH, setIsLoadingBH] = useState(false)
  const [bhError, setBhError] = useState('')

  // DXF state
  const [isDxfLoading, setIsDxfLoading] = useState(false)
  const [dxfError, setDxfError] = useState('')
  const [dxfData, setDxfData] = useState<{
    segments: { x1: number; y1: number; x2: number; y2: number; layer: string }[]
    loops: { layer: string; pts: [number, number][]; area: number; perim: number }[]
    highlightLayers: string[]
    bbox: [number, number, number, number] | null
  } | null>(null)
  const [rightTab, setRightTab] = useState<'section' | 'dxf'>('section')
  const dxfInputRef = useRef<HTMLInputElement>(null)

  // Resizable right panel
  const [panelWidth, setPanelWidth] = useState(480)
  const isDragging = useRef(false)
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    const startX = e.clientX
    const startW = panelWidth
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const delta = startX - ev.clientX
      const newW = Math.min(700, Math.max(360, startW + delta))
      setPanelWidth(newW)
    }
    const onUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelWidth])

  function set(field: keyof FormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function canNext(): boolean {
    if (step === 1) return !!form.name.trim()
    if (step === 2) return !!form.ground && Number(form.ground) >= 1
    return true
  }

  // ── Geocode ──────────────────────────────────────────────────────────────

  async function handleGeocode() {
    if (!form.location.trim()) return
    setIsLoadingMap(true)
    setGeocodeError('')
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(form.location)}`)
      const data = await res.json()
      if (!res.ok) {
        setGeocodeError(data.error ?? '주소 검색 실패')
      } else {
        setCoords({ lat: data.lat, lng: data.lng })
      }
    } catch {
      setGeocodeError('네트워크 오류')
    } finally {
      setIsLoadingMap(false)
    }
  }

  // ── DXF Upload ───────────────────────────────────────────────────────────

  async function handleDxfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.name.toLowerCase().endsWith('.dwg')) {
      setDxfError('DWG 형식은 지원되지 않습니다. AutoCAD 또는 LibreCAD에서 "다른 이름으로 저장 → DXF"로 내보낸 후 업로드하세요.')
      if (dxfInputRef.current) dxfInputRef.current.value = ''
      return
    }
    setIsDxfLoading(true)
    setDxfError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/cad-parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setDxfError(data.details ?? data.error ?? '파싱 실패')
      } else {
        // 설계개요 자동입력 (면적/둘레는 폴리곤 직접 선택으로 입력)
        if (data.designInfo) {
          if (data.designInfo.projectName) set('name', data.designInfo.projectName)
          if (data.designInfo.location) set('location', data.designInfo.location)
          if (data.designInfo.floors) set('ground', data.designInfo.floors.toString())
        }

        if (data.segments?.length > 0 || data.loops?.length > 0) {
          setDxfData({ segments: data.segments ?? [], loops: data.loops ?? [], highlightLayers: [], bbox: data.bbox ?? null })
          setRightTab('dxf')
          setDxfError(data.loops?.length > 0
            ? `${data.loops.length}개 폴리곤 인식됨 — 대지경계/건물외곽 선택 버튼으로 폴리곤을 클릭하세요`
            : '폴리곤을 인식하지 못했습니다.')
        } else {
          setDxfError(`도면 요소를 인식하지 못했습니다. [${data.debug ?? ''}]`)
        }
      }
    } catch {
      setDxfError('파일 처리 중 오류 발생')
    } finally {
      setIsDxfLoading(false)
      if (dxfInputRef.current) dxfInputRef.current.value = ''
    }
  }

  function handlePolygonSelect(type: 'site' | 'bldg', loop: { area: number; perim: number }) {
    if (type === 'site') {
      set('siteArea', String(Math.round(loop.area * 100) / 100))
      set('sitePerim', String(Math.round(loop.perim * 100) / 100))
    } else {
      set('bldgArea', String(Math.round(loop.area * 100) / 100))
      set('bldgPerim', String(Math.round(loop.perim * 100) / 100))
    }
    setDxfError('')
  }

  // ── Ground Info ───────────────────────────────────────────────────────────

  async function handleLoadBoreholes() {
    if (!coords) {
      setBhError('먼저 주소를 검색하여 위치를 지정하세요.')
      return
    }
    setIsLoadingBH(true)
    setBhError('')
    try {
      const res = await fetch('/api/ground-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: coords.lat, lng: coords.lng }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBhError(data.error ?? '시추공 검색 실패')
      } else {
        setBoreholes(data ?? [])
        if (!data?.length) setBhError('500m 반경 내 시추공 데이터가 없습니다.')
      }
    } catch {
      setBhError('네트워크 오류')
    } finally {
      setIsLoadingBH(false)
    }
  }

  function applyBorehole(bh: BoreholeResult) {
    if (bh.wt != null) set('wtBottom', String(bh.wt))
    if (bh.wtr != null) set('waBottom', String(bh.wtr))
  }

  function applyAverage(list: BoreholeResult[]) {
    const wtVals = list.map(b => b.wt).filter((v): v is number => v != null && v > 0)
    const waVals = list.map(b => b.wtr).filter((v): v is number => v != null && v > 0)

    const avg = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : null

    const wtAvg = avg(wtVals)
    const waAvg = avg(waVals)

    if (wtAvg) set('wtBottom', wtAvg.toFixed(1))
    if (waAvg) set('waBottom', waAvg.toFixed(1))
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setError('')
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
        excDepth: form.excDepth ? Number(form.excDepth) : undefined,
        mode: form.mode,
      }),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      setError(`저장에 실패했습니다. ${errData?.error ?? ''}`)
      setSaving(false)
      return
    }
    const project = await res.json()
    router.push(`/projects/${project.id}`)
  }

  // ── Diagram props ─────────────────────────────────────────────────────────

  const bNum = Number(form.basement) || 0
  const excInput = Number(form.excDepth) || 0
  const autoExcDepth = bNum > 0 ? bNum * 4 + 1 : 0
  const effectiveExc = excInput > 0 ? excInput : autoExcDepth
  const isAutoExc = excInput === 0 && bNum > 0

  const diagramProps = {
    ground: Number(form.ground) || 0,
    basement: bNum,
    lowrise: Number(form.lowrise) || 0,
    hasTransfer: form.hasTransfer,
    wtBottom: Number(form.wtBottom) || 0,
    waBottom: Number(form.waBottom) || 0,
    excDepth: effectiveExc,
    isAutoExc,
  }

  // ── Map panel ─────────────────────────────────────────────────────────────

  const mapPanel = coords ? (
    <iframe
      src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.008},${coords.lat - 0.005},${coords.lng + 0.008},${coords.lat + 0.005}&layer=mapnik&marker=${coords.lat},${coords.lng}`}
      className="w-full h-full border-0"
      title="현장 위치 지도"
      loading="lazy"
    />
  ) : (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 relative"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='%23fff'/%3E%3C/svg%3E")` }} />
      <div className="relative flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.07] flex items-center justify-center backdrop-blur-sm border border-white/[0.05]">
          <MapPin size={20} className="text-white/40" />
        </div>
        <p className="text-[11px] text-white/50 text-center px-4 leading-relaxed">
          주소를 입력하고 검색하면<br />지도가 표시됩니다
        </p>
      </div>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-[#f8fafc]">

      {/* ── 상단 헤더 ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-0 flex items-center h-14">

        {/* 왼쪽: 뒤로가기 + 타이틀 */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2563eb] to-[#7c3aed] flex items-center justify-center">
              <Sparkles size={13} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 leading-tight">새 프로젝트</h1>
              <p className="text-[10px] text-gray-400 leading-tight">공기산정 기본정보 입력</p>
            </div>
          </div>
        </div>

        {/* 가운데: 스텝 인디케이터 */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => {
              const done    = step > s.id
              const current = step === s.id
              const Icon    = s.icon
              return (
                <div key={s.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={cn(
                      'group flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all',
                      current ? 'bg-[#2563eb]/[0.08]' : 'hover:bg-gray-50',
                    )}
                  >
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
                      done    ? 'bg-[#2563eb] text-white shadow-sm shadow-blue-500/20' : '',
                      current ? 'bg-[#2563eb] text-white shadow-sm shadow-blue-500/20' : '',
                      !done && !current ? 'bg-gray-100 text-gray-400 group-hover:bg-gray-200' : '',
                    )}>
                      {done ? <Check size={13} strokeWidth={2.5} /> : <Icon size={13} />}
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className={cn(
                        'text-[11px] font-semibold leading-tight',
                        current ? 'text-[#2563eb]' : done ? 'text-gray-700' : 'text-gray-400',
                      )}>{s.label}</p>
                      <p className={cn(
                        'text-[9px] leading-tight',
                        current ? 'text-[#2563eb]/60' : 'text-gray-300',
                      )}>{s.desc}</p>
                    </div>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={cn(
                      'w-8 h-[2px] mx-0.5 rounded-full transition-colors',
                      step > s.id ? 'bg-[#2563eb]' : 'bg-gray-200',
                    )} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 오른쪽: 액션 버튼 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {step > 1 && (
            <button type="button" onClick={() => setStep(s => s - 1)}
              className="h-9 px-3 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-1.5">
              <ArrowLeft size={12} />이전
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button type="button" onClick={() => canNext() && setStep(s => s + 1)}
              disabled={!canNext()}
              className={cn(
                'h-9 px-4 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5',
                canNext()
                  ? 'bg-[#2563eb] text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20 hover:shadow-md hover:shadow-blue-500/30'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              )}>
              다음<ArrowRight size={12} />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="h-9 px-5 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#7c3aed] text-white text-xs font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center gap-1.5">
              <Sparkles size={12} />
              {saving ? '생성 중...' : '프로젝트 생성'}
            </button>
          )}
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className="flex-1 overflow-auto">
        <div className="h-full flex">

          {/* ── 왼쪽: 컨텍스트 + 폼 ── */}
          <div className="flex-1 overflow-auto px-8 py-6 min-w-0">
            <div className="max-w-5xl mx-auto grid grid-cols-[260px_1fr] gap-6">

              {/* ── 왼쪽 사이드: 컨텍스트 패널 (sticky) ── */}
              <div className="space-y-4 self-start sticky top-6">
                {/* 진행률 */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm space-y-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">진행률</p>
                  <div className="relative w-full h-2 rounded-full bg-gray-100">
                    <div
                      className="absolute left-0 top-0 h-2 rounded-full bg-gradient-to-r from-[#2563eb] to-[#7c3aed] transition-all duration-500"
                      style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">{step} / {TOTAL_STEPS} 단계 완료</p>
                </div>

                {/* 스텝 리스트 */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-sm space-y-1">
                  {STEPS.map(s => {
                    const done    = step > s.id
                    const current = step === s.id
                    const Icon    = s.icon
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStep(s.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all',
                          current ? 'bg-[#2563eb]/[0.08]' : 'hover:bg-gray-50',
                        )}
                      >
                        <div className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all',
                          done    ? 'bg-[#2563eb] text-white' : '',
                          current ? 'bg-[#2563eb] text-white' : '',
                          !done && !current ? 'bg-gray-100 text-gray-400' : '',
                        )}>
                          {done ? <Check size={12} strokeWidth={3} /> : <Icon size={12} />}
                        </div>
                        <div>
                          <p className={cn(
                            'text-xs font-semibold leading-tight',
                            current ? 'text-[#2563eb]' : done ? 'text-gray-700' : 'text-gray-400',
                          )}>{s.label}</p>
                          <p className="text-[10px] text-gray-300">{s.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* 실시간 입력 현황 */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">입력 현황</p>
                  <div className="space-y-2">
                    {[
                      { label: '프로젝트명', filled: !!form.name.trim(), value: form.name },
                      { label: '현장 위치', filled: !!coords, value: form.location || '미입력' },
                      { label: '지상 층수', filled: !!form.ground, value: form.ground ? `${form.ground}F` : '미입력' },
                      { label: '지하 층수', filled: !!form.basement && form.basement !== '0', value: form.basement ? `B${form.basement}` : '없음' },
                      { label: '대지면적', filled: !!form.siteArea, value: form.siteArea ? `${Number(form.siteArea).toLocaleString()}m²` : '미입력' },
                      { label: '연면적', filled: !!form.bldgArea, value: form.bldgArea ? `${Number(form.bldgArea).toLocaleString()}m²` : '미입력' },
                      { label: '풍화토', filled: !!form.wtBottom, value: form.wtBottom ? `${form.wtBottom}m` : '미입력' },
                      { label: '풍화암', filled: !!form.waBottom, value: form.waBottom ? `${form.waBottom}m` : '미입력' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2 text-xs">
                        <div className={cn(
                          'w-1.5 h-1.5 rounded-full flex-shrink-0',
                          item.filled ? 'bg-green-500' : 'bg-gray-200',
                        )} />
                        <span className="text-gray-400 w-16 flex-shrink-0">{item.label}</span>
                        <span className={cn(
                          'truncate',
                          item.filled ? 'text-gray-700 font-medium' : 'text-gray-300',
                        )}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">입력 완성도</span>
                      <span className="font-bold text-[#2563eb]">
                        {Math.round(([form.name, coords, form.ground, form.siteArea, form.bldgArea, form.wtBottom].filter(Boolean).length / 6) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* 팁 */}
                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-2">
                  <p className="text-[10px] font-bold text-[#2563eb] uppercase tracking-wider">💡 TIP</p>
                  <p className="text-xs text-blue-600/70 leading-relaxed">
                    {step === 1 && '주소를 검색하면 인근 시추공 데이터를 자동으로 불러올 수 있어요.'}
                    {step === 2 && 'DXF 도면 파일을 업로드하면 대지면적과 건물둘레가 자동 입력됩니다.'}
                    {step === 3 && '시추공 행을 클릭하면 풍화토/풍화암/연암 데이터가 자동 입력돼요.'}
                    {step === 4 && '개략(CP) 모드로 빠르게 산정 후, 상세 모드로 재계산할 수 있습니다.'}
                  </p>
                </div>
              </div>

              {/* ── 오른쪽: 폼 본체 ── */}
              <div className="space-y-6 min-w-0">

            {/* STEP 1: 기본 정보 */}
            {step === 1 && (
              <div className="space-y-6">
                {/* 섹션 헤더 */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Info size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">기본 정보</h2>
                    <p className="text-xs text-gray-400">프로젝트 개요 정보를 입력해주세요</p>
                  </div>
                </div>

                {/* 프로젝트명 */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-semibold text-gray-500">
                      프로젝트명 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name" placeholder="예) 강남 힐스테이트 1단지"
                      value={form.name} onChange={e => set('name', e.target.value)}
                      className="h-11 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#2563eb] text-sm transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="client" className="text-xs font-semibold text-gray-500">발주처</Label>
                      <Input id="client" placeholder="발주처명" value={form.client} onChange={e => set('client', e.target.value)}
                        className="h-10 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#2563eb] text-sm transition-colors" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contractor" className="text-xs font-semibold text-gray-500">시공사</Label>
                      <Input id="contractor" placeholder="시공사명" value={form.contractor} onChange={e => set('contractor', e.target.value)}
                        className="h-10 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#2563eb] text-sm transition-colors" />
                    </div>
                  </div>
                </div>

                {/* 현장 위치 */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm space-y-4">
                  <Label className="text-xs font-semibold text-gray-500">현장 위치</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="location" placeholder="주소를 입력하세요"
                        className="pl-9 h-10 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#2563eb] text-sm transition-colors"
                        value={form.location}
                        onChange={e => set('location', e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleGeocode()}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleGeocode}
                      disabled={isLoadingMap || !form.location.trim()}
                      className={cn(
                        'flex items-center gap-1.5 h-10 px-4 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                        form.location.trim()
                          ? 'bg-[#2563eb] text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20'
                          : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      )}
                    >
                      {isLoadingMap ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                      검색
                    </button>
                  </div>
                  {coords && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200/60">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs text-green-700 font-medium">위치 확인됨</span>
                      <span className="text-[10px] text-green-500 font-mono ml-auto">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
                    </div>
                  )}
                  {geocodeError && (
                    <p className="text-xs text-red-500">{geocodeError}</p>
                  )}
                </div>

                {/* 건물 유형 & 착공일 */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-500">건물 유형</Label>
                      <Select value={form.type} onValueChange={v => v && set('type', v)}>
                        <SelectTrigger className="h-10 rounded-xl border-gray-200 bg-gray-50/50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="공동주택">공동주택</SelectItem>
                          <SelectItem value="오피스텔">오피스텔</SelectItem>
                          <SelectItem value="주상복합">주상복합</SelectItem>
                          <SelectItem value="기타">기타</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="startDate" className="text-xs font-semibold text-gray-500">착공 예정일</Label>
                      <Input id="startDate" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)}
                        className="h-10 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#2563eb] text-sm transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: 건물 규모 */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                      <Building2 size={18} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900">건물 규모</h2>
                      <p className="text-xs text-gray-400">층수와 면적 정보를 입력하세요</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                      <input ref={dxfInputRef} type="file" accept=".dxf" className="hidden" onChange={handleDxfUpload} />
                      <button
                        type="button"
                        onClick={() => dxfInputRef.current?.click()}
                        disabled={isDxfLoading}
                        className="flex items-center gap-2 h-9 px-4 rounded-xl border-2 border-dashed border-gray-300 text-xs font-medium text-gray-500 hover:border-[#2563eb] hover:text-[#2563eb] hover:bg-blue-50/50 transition-all"
                      >
                        {isDxfLoading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        도면 업로드 (DXF)
                      </button>
                  </div>
                </div>

                {dxfError && (
                  <div className={`rounded-xl px-4 py-3 text-xs border ${dxfError.includes('폴리곤 인식됨') ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-red-50 border-red-200 text-red-600'}`}>{dxfError}</div>
                )}

                {/* 층수 */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm space-y-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">층수 정보</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ground" className="text-xs font-semibold text-gray-500">지상 층수 <span className="text-red-500">*</span></Label>
                      <Input id="ground" type="number" min={1} value={form.ground} onChange={e => set('ground', e.target.value)} onFocus={e => e.target.select()}
                        className="h-11 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#2563eb] text-sm font-semibold text-center transition-colors" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="basement" className="text-xs font-semibold text-gray-500">지하 층수</Label>
                      <Input id="basement" type="number" min={0} placeholder="2" value={form.basement} onChange={e => set('basement', e.target.value)} onFocus={e => e.target.select()}
                        className="h-11 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#2563eb] text-sm font-semibold text-center transition-colors" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lowrise" className="text-xs font-semibold text-gray-500">저층부</Label>
                      <Input id="lowrise" type="number" min={0} placeholder="0" value={form.lowrise} onChange={e => set('lowrise', e.target.value)} onFocus={e => e.target.select()}
                        className="h-11 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#2563eb] text-sm font-semibold text-center transition-colors" />
                    </div>
                  </div>
                </div>

                {/* 면적 */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm space-y-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">면적 · 둘레</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="siteArea" className="text-xs font-semibold text-gray-500">대지면적 (m²)</Label>
                      <Input id="siteArea" type="number" min={0} placeholder="0.00" value={form.siteArea} onChange={e => set('siteArea', e.target.value)}
                        className="h-10 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#2563eb] text-sm transition-colors" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bldgArea" className="text-xs font-semibold text-gray-500">연면적 (m²)</Label>
                      <Input id="bldgArea" type="number" min={0} placeholder="0.00" value={form.bldgArea} onChange={e => set('bldgArea', e.target.value)}
                        className="h-10 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#2563eb] text-sm transition-colors" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sitePerim" className="text-xs font-semibold text-gray-500">대지 둘레 (m)</Label>
                      <Input id="sitePerim" type="number" min={0} value={form.sitePerim} onChange={e => set('sitePerim', e.target.value)}
                        className="h-10 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#2563eb] text-sm transition-colors" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bldgPerim" className="text-xs font-semibold text-gray-500">건물 둘레 (m)</Label>
                      <Input id="bldgPerim" type="number" min={0} value={form.bldgPerim} onChange={e => set('bldgPerim', e.target.value)}
                        className="h-10 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#2563eb] text-sm transition-colors" />
                    </div>
                  </div>
                </div>

                {/* 기타 설정 */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2 flex-1">
                      <Label className="text-xs font-semibold text-gray-500">지반조건</Label>
                      <Select value={form.groundCond} onValueChange={v => v && set('groundCond', v)}>
                        <SelectTrigger className="h-10 rounded-xl border-gray-200 bg-gray-50/50 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="양호">양호</SelectItem>
                          <SelectItem value="보통">보통</SelectItem>
                          <SelectItem value="불량">불량</SelectItem>
                          <SelectItem value="암반">암반</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator className="bg-gray-100" />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">전이층 (Transfer)</p>
                      <p className="text-xs text-gray-400">저층부↔고층부 구조 전환층 적용</p>
                    </div>
                    <button type="button" onClick={() => set('hasTransfer', !form.hasTransfer)}
                      className={cn('relative w-12 h-7 rounded-full transition-all', form.hasTransfer ? 'bg-[#2563eb] shadow-sm shadow-blue-500/20' : 'bg-gray-200')}>
                      <span className={cn('absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform', form.hasTransfer ? 'translate-x-5' : '')} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: 지반정보 */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <Drill size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">지반 / 굴착 정보</h2>
                    <p className="text-xs text-gray-400">토질 분포와 굴착 깊이를 입력하세요</p>
                  </div>
                </div>

                {/* 지반 수치 */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm space-y-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">굴착 · 지하수</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="excDepth" className="text-xs font-semibold text-gray-500">굴착 깊이 (m)</Label>
                        {isAutoExc && (
                          <span className="text-[10px] font-semibold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                            자동 {autoExcDepth}m
                          </span>
                        )}
                      </div>
                      <Input id="excDepth" type="number" min={0} step={0.1}
                        placeholder={isAutoExc ? `자동 ${autoExcDepth}m` : '예) 10.5'}
                        value={form.excDepth}
                        onChange={e => set('excDepth', e.target.value)}
                        onFocus={e => e.target.select()}
                        className={cn('h-10 rounded-xl text-sm transition-colors',
                          isAutoExc ? 'border-orange-200 bg-orange-50/40' : 'border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#2563eb]'
                        )} />
                    </div>
                  </div>
                </div>

                {/* 토질 분포 */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm space-y-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">토질 분포 심도</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="wtBottom" className="text-xs font-semibold text-amber-700">풍화토 하단 (m)</Label>
                      <Input id="wtBottom" type="number" min={0} step={0.1} placeholder="5.5" value={form.wtBottom} onChange={e => set('wtBottom', e.target.value)} onFocus={e => e.target.select()}
                        className="h-10 rounded-xl border-amber-200 bg-amber-50/30 focus:bg-white focus:border-amber-500 text-sm transition-colors" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="waBottom" className="text-xs font-semibold text-yellow-800">풍화암 하단 (m)</Label>
                      <Input id="waBottom" type="number" min={0} step={0.1} placeholder="12.0" value={form.waBottom} onChange={e => set('waBottom', e.target.value)} onFocus={e => e.target.select()}
                        className="h-10 rounded-xl border-yellow-200 bg-yellow-50/30 focus:bg-white focus:border-yellow-600 text-sm transition-colors" />
                    </div>
                  </div>
                </div>

                {/* 시추공 */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">인근 시추공 불러오기</p>
                      <p className="text-xs text-gray-400">
                        {coords
                          ? `📍 ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} 반경 500m`
                          : '1단계에서 주소를 검색하면 활성화됩니다'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLoadBoreholes}
                      disabled={isLoadingBH || !coords}
                      className={cn(
                        'flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                        coords
                          ? 'bg-[#2563eb] text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20'
                          : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      )}
                    >
                      {isLoadingBH ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                      시추공 검색
                    </button>
                  </div>

                  {bhError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-2.5 text-xs">{bhError}</div>
                  )}

                  {boreholes.length > 0 && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
                      <table className="w-full text-xs min-w-[600px]">
                        <thead>
                          <tr className="bg-gray-50/80 border-b border-gray-200">
                            <th className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">시추공</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">거리</th>

                            <th className="px-3 py-2.5 text-right font-semibold text-amber-700 whitespace-nowrap">풍화토 하단</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-yellow-800 whitespace-nowrap">풍화암 하단</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">심도</th>
                            <th className="px-3 py-2.5 text-left font-semibold text-gray-500">주소</th>
                          </tr>
                        </thead>
                        <tbody>
                          {boreholes.slice(0, 12).map((bh, i) => (
                            <tr
                              key={bh.id}
                              onClick={() => applyBorehole(bh)}
                              className={cn(
                                'border-b border-gray-100 cursor-pointer transition-colors hover:bg-blue-50/60',
                                i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                              )}
                              title="클릭하면 자동 입력"
                            >
                              <td className="px-3 py-2 font-mono text-[11px] text-gray-700 whitespace-nowrap">{bh.id}</td>
                              <td className="px-3 py-2 text-right text-gray-500">{bh.distance_m.toLocaleString()}m</td>

                              <td className="px-3 py-2 text-right font-medium text-amber-700">{bh.wt_display ?? '-'}</td>
                              <td className="px-3 py-2 text-right font-medium text-yellow-800">{bh.wtr_display ?? '-'}</td>
                              <td className="px-3 py-2 text-right text-gray-400">{bh.depth != null ? `${bh.depth}m` : '-'}</td>
                              <td className="px-3 py-2 text-gray-400 text-[10px] max-w-[140px] truncate">{bh.addr || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-3 py-2.5 bg-blue-50/60 border-t border-gray-200 flex items-center gap-2">
                        <span className="text-[10px] text-blue-600 font-medium">행 클릭 → 값 적용</span>
                        <span className="text-gray-300">|</span>
                        <button type="button" onClick={() => applyAverage(boreholes)}
                          className="flex items-center gap-1 h-6 px-2.5 rounded-lg border border-[#2563eb] text-[10px] font-bold text-[#2563eb] bg-white hover:bg-blue-50 transition-colors">
                          평균값 적용
                        </button>
                        <span className="ml-auto text-[10px] text-gray-400">{boreholes.length}개 발견</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: 산정 설정 */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Cpu size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">공기산정 설정</h2>
                    <p className="text-xs text-gray-400">WBS 생성 모드를 선택하세요</p>
                  </div>
                </div>

                {/* 모드 선택 */}
                <div className="grid grid-cols-2 gap-4">
                  <button type="button" onClick={() => set('mode', 'cp')}
                    className={cn(
                      'relative flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-left transition-all',
                      form.mode === 'cp'
                        ? 'border-[#2563eb] bg-blue-50/50 shadow-lg shadow-blue-500/10'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    )}>
                    {form.mode === 'cp' && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#2563eb] flex items-center justify-center">
                        <Check size={11} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Sparkles size={18} className="text-[#2563eb]" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-900">개략공기 (CP)</span>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">20개 집계 공종 기반<br/>빠른 공기 산정</p>
                    </div>
                  </button>
                  <button type="button" onClick={() => set('mode', 'full')}
                    className={cn(
                      'relative flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-left transition-all',
                      form.mode === 'full'
                        ? 'border-[#2563eb] bg-blue-50/50 shadow-lg shadow-blue-500/10'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    )}>
                    {form.mode === 'full' && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#2563eb] flex items-center justify-center">
                        <Check size={11} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                      <Layers size={18} className="text-violet-600" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-900">상세공기 (층별)</span>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">층별 마감·설비 전개<br/>상세 분석 모드</p>
                    </div>
                  </button>
                </div>

                {/* 최종 확인 */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">입력 요약</p>
                  <div className="space-y-2.5">
                    {[
                      ['프로젝트명', form.name, '📋'],
                      ['위치', form.location, '📍'],
                      ['규모', form.ground ? `지상 ${form.ground}F / 지하 ${form.basement}F` : '', '🏢'],
                      ['대지면적', form.siteArea ? `${Number(form.siteArea).toLocaleString()} m²` : '', '📐'],
                      ['연면적', form.bldgArea ? `${Number(form.bldgArea).toLocaleString()} m²` : '', '📏'],
                      ['굴착깊이', form.excDepth ? `${form.excDepth} m` : (isAutoExc ? `자동 ${autoExcDepth}m` : ''), '⛏️'],
                      ['풍화토', form.wtBottom ? `${form.wtBottom} m` : '', '🟤'],
                      ['풍화암', form.waBottom ? `${form.waBottom} m` : '', '🪨'],
                      ['착공일', form.startDate, '📅'],
                    ].filter(([, v]) => v).map(([k, v, emoji]) => (
                      <div key={k} className="flex items-center gap-2 text-sm">
                        <span className="text-base w-6 text-center">{emoji}</span>
                        <span className="text-gray-400 w-20 flex-shrink-0">{k}</span>
                        <span className="text-gray-800 font-medium truncate">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>
            )}

              </div>{/* end form body */}
            </div>{/* end grid [260px_1fr] */}
          </div>

          {/* ── 리사이즈 핸들 ── */}
          <div
            onMouseDown={handleResizeStart}
            className="w-1.5 flex-shrink-0 cursor-col-resize group relative hover:bg-[#2563eb]/10 transition-colors"
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] rounded-full bg-gray-200 group-hover:bg-[#2563eb]/40 transition-colors" />
          </div>

          {/* ── 오른쪽 패널 ── */}
          <div className="bg-white flex flex-col overflow-hidden flex-shrink-0" style={{ width: panelWidth }}>

            {/* 지도 */}
            <div className="flex-shrink-0 relative overflow-hidden border-b border-gray-100" style={{ height: '220px' }}>
              {mapPanel}
              {coords && (
                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-sm border border-white/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-[10px] text-gray-600 truncate flex-1">{form.location}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 font-mono">
                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </span>
                </div>
              )}
            </div>

            {/* 미리보기 탭 */}
            <div className="flex-shrink-0 border-b border-gray-100 flex flex-col">
              <div className="flex bg-gray-50/50 p-1 m-3 rounded-xl gap-1">
                <button
                  onClick={() => setRightTab('section')}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all',
                    rightTab === 'section'
                      ? 'text-[#2563eb] bg-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  )}>
                  단면도
                </button>
                <button
                  onClick={() => setRightTab('dxf')}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1',
                    rightTab === 'dxf'
                      ? 'text-[#2563eb] bg-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  )}>
                  도면 미리보기
                  {dxfData && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                </button>
              </div>

              {rightTab === 'section' && (
                <BuildingDiagram {...diagramProps} />
              )}
              {rightTab === 'dxf' && (
                dxfData
                  ? <DxfPreview
                      segments={dxfData.segments}
                      loops={dxfData.loops}
                      highlightLayers={dxfData.highlightLayers}
                      bbox={dxfData.bbox}
                      onSiteSelect={(loop) => handlePolygonSelect('site', loop)}
                      onBldgSelect={(loop) => handlePolygonSelect('bldg', loop)}
                      width={panelWidth}
                    />
                  : <div className="flex flex-col items-center justify-center gap-3 bg-[#0f172a]" style={{ height: Math.round(panelWidth * 0.88) }}>
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.05] flex items-center justify-center border border-white/[0.05]">
                        <Upload size={20} className="text-white/20" />
                      </div>
                      <p className="text-[11px] text-slate-500 text-center px-4 leading-relaxed">
                        DXF 파일을 업로드하면<br />도면이 여기에 표시됩니다
                      </p>
                    </div>
              )}
            </div>

            {/* 안내 영역 */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {/* 엔진 상태 */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
                <div className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
                  canNext() ? 'bg-green-500/20' : 'bg-white/5'
                )}>
                  <Cpu size={14} className={canNext() ? 'text-green-400' : 'text-slate-600'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">자동 공기산정 엔진</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {canNext() ? `Step ${step} 입력 완료` : '필수 항목을 입력하세요'}
                  </p>
                </div>
                <span className={cn(
                  'w-2.5 h-2.5 rounded-full flex-shrink-0',
                  canNext() ? 'bg-green-400 animate-pulse' : 'bg-slate-700',
                )} />
              </div>

              {/* 단계 안내 */}
              <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-[#2563eb] bg-blue-50 px-2 py-0.5 rounded-full">STEP {step}/{TOTAL_STEPS}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {step === 1 && '프로젝트명은 필수입니다. 주소 검색으로 현장 위치를 지도에서 확인하세요.'}
                  {step === 2 && 'DXF 파일을 업로드하면 대지면적과 둘레를 자동으로 입력할 수 있습니다.'}
                  {step === 3 && '인근 시추공을 불러와 행을 클릭하면 토질 깊이가 자동 입력됩니다.'}
                  {step === 4 && 'CP 모드는 빠른 계산, Full 모드는 층별 상세 분석입니다.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
