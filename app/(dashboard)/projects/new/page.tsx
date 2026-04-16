'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, Building2, Layers, Settings2, MapPin,
  Info, Cpu, Upload, Search, Loader2,
  Drill,
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
  wtBottom: string; waBottom: string; raBottom: string
  excDepth: string; waterLevel: string
  mode: 'cp' | 'full'
}

interface BoreholeResult {
  id: string
  distance_m: number
  lat: number
  lng: number
  depth: number | null
  addr: string
  wt: number | null
  wtr: number | null
  rk: number | null
  wt_display: string
  wtr_display: string
  rk_display: string
  layers: { soil_type: string; depth_from: number; depth_to: number }[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INITIAL: FormData = {
  name: '', client: '', contractor: '', location: '',
  type: '공동주택', startDate: '',
  ground: '', basement: '0', lowrise: '0', hasTransfer: false,
  siteArea: '', bldgArea: '', sitePerim: '', bldgPerim: '',
  groundCond: '보통',
  wtBottom: '', waBottom: '', raBottom: '', excDepth: '', waterLevel: '',
  mode: 'cp',
}

const STEPS = [
  { id: 1, label: '기본 정보',    icon: Info },
  { id: 2, label: '건물 규모',    icon: Building2 },
  { id: 3, label: '지반정보',     icon: Drill },
  { id: 4, label: '산정 설정',    icon: Settings2 },
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
    setIsDxfLoading(true)
    setDxfError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/cad-parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setDxfError(data.error ?? 'DXF 파싱 실패')
      } else {
        let applied = false
        if (data.site_area > 0) { set('siteArea', String(Math.round(data.site_area * 100) / 100)); applied = true }
        if (data.bldg_area > 0) { set('bldgArea', String(Math.round(data.bldg_area * 100) / 100)); applied = true }
        if (data.site_perim > 0) set('sitePerim', String(Math.round(data.site_perim * 100) / 100))
        if (data.bldg_perim > 0) set('bldgPerim', String(Math.round(data.bldg_perim * 100) / 100))
        if (data.segments?.length > 0) {
          setDxfData({ segments: data.segments, loops: data.loops ?? [], highlightLayers: data.highlightLayers ?? [], bbox: data.bbox ?? null })
          setRightTab('dxf')
        }
        if (!applied && data.debug) {
          setDxfError(`면적을 인식하지 못했습니다. [${data.debug}]`)
        } else {
          setDxfError('')
        }
      }
    } catch {
      setDxfError('파일 처리 중 오류 발생')
    } finally {
      setIsDxfLoading(false)
      if (dxfInputRef.current) dxfInputRef.current.value = ''
    }
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
        setBhError(data.error ?? '시추공 데이터 로드 실패')
      } else {
        setBoreholes(data)
      }
    } catch {
      setBhError('네트워크 오류')
    } finally {
      setIsLoadingBH(false)
    }
  }

  function applyBorehole(bh: BoreholeResult) {
    const wt = bh.wt ?? extractSoilDepth(bh.layers, 'wt')
    const wa = bh.wtr ?? extractSoilDepth(bh.layers, 'wa')
    const ra = bh.rk ?? extractSoilDepth(bh.layers, 'ra')
    if (wt && wt > 0) set('wtBottom', String(wt))
    if (wa && wa > 0) set('waBottom', String(wa))
    if (ra && ra > 0) set('raBottom', String(ra))
  }

  function applyAverage(bhs: BoreholeResult[]) {
    // 값이 있는 시추공만 포함하여 평균 계산 (Python: 표에 보이는 후보의 평균 WT/WA 적용)
    const wtVals = bhs.map(b => b.wt  ?? extractSoilDepth(b.layers, 'wt')).filter(v => v && v > 0) as number[]
    const waVals = bhs.map(b => b.wtr ?? extractSoilDepth(b.layers, 'wa')).filter(v => v && v > 0) as number[]
    const rkVals = bhs.map(b => b.rk  ?? extractSoilDepth(b.layers, 'ra')).filter(v => v && v > 0) as number[]

    const avg = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : null

    const wtAvg = avg(wtVals)
    const waAvg = avg(waVals)
    const rkAvg = avg(rkVals)

    if (wtAvg) set('wtBottom', wtAvg.toFixed(1))
    if (waAvg) set('waBottom', waAvg.toFixed(1))
    if (rkAvg) set('raBottom', rkAvg.toFixed(1))
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
        raBottom: form.raBottom ? Number(form.raBottom) : undefined,
        excDepth: form.excDepth ? Number(form.excDepth) : undefined,
        waterLevel: form.waterLevel ? Number(form.waterLevel) : undefined,
        mode: form.mode,
      }),
    })
    if (!res.ok) { setError('저장에 실패했습니다.'); setSaving(false); return }
    const project = await res.json()
    router.push(`/projects/${project.id}`)
  }

  // ── Diagram props ─────────────────────────────────────────────────────────

  const bNum = Number(form.basement) || 0
  const excInput = Number(form.excDepth) || 0
  // 굴착깊이 미입력 시 자동계산: 지하층수 * 4m + 1m(기초두께)
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
    raBottom: Number(form.raBottom) || 0,
    excDepth: effectiveExc,
    isAutoExc,
  }

  // ── Map panel ─────────────────────────────────────────────────────────────

  // OpenStreetMap iframe embed — 무료, API 키 불필요, 정상 지도 표시
  const mapPanel = coords ? (
    <iframe
      src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.008},${coords.lat - 0.005},${coords.lng + 0.008},${coords.lat + 0.005}&layer=mapnik&marker=${coords.lat},${coords.lng}`}
      className="w-full h-full border-0"
      title="현장 위치 지도"
      loading="lazy"
    />
  ) : (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 relative"
      style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='%23fff'/%3E%3C/svg%3E")` }} />
      <div className="relative flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <MapPin size={18} className="text-white/60" />
        </div>
        <p className="text-xs font-medium text-white/70 text-center px-4">
          {form.location ? `"${form.location}" 검색 중...` : '주소를 입력하고\n주소 검색 버튼을 눌러주세요'}
        </p>
        {geocodeError && (
          <p className="text-[11px] text-red-400 text-center px-4">{geocodeError}</p>
        )}
      </div>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col" style={{ background: '#f1f5f9' }}>

      {/* ── 상단 헤더 바 ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        {/* 브레드크럼 + 타이틀 */}
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-700 transition-colors whitespace-nowrap">대시보드</Link>
          <ChevronRight size={11} className="text-gray-300 flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-800 whitespace-nowrap">새 프로젝트 생성</span>
        </div>

        {/* 스텝 인디케이터 — 가운데 */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => {
              const done    = step > s.id
              const current = step === s.id
              const Icon    = s.icon
              return (
                <div key={s.id} className="flex items-center">
                  <div className="flex items-center gap-2 px-2">
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0',
                      done    ? 'border-[#2563eb] bg-[#2563eb] text-white' : '',
                      current ? 'border-[#2563eb] bg-white text-[#2563eb]' : '',
                      !done && !current ? 'border-gray-200 bg-gray-100 text-gray-400' : '',
                    )}>
                      <Icon size={13} />
                    </div>
                    <span className={cn(
                      'text-xs font-medium whitespace-nowrap hidden sm:block',
                      current ? 'text-gray-900' : done ? 'text-[#2563eb]' : 'text-gray-400',
                    )}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn('w-8 h-0.5 mx-1', step > s.id ? 'bg-[#2563eb]' : 'bg-gray-200')} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 액션 버튼 — 오른쪽 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button type="button" onClick={() => router.back()}
            className="h-8 px-3 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors">
            취소
          </button>
          {step > 1 && (
            <button type="button" onClick={() => setStep(s => s - 1)}
              className="h-8 px-3 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
              ← 이전
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button type="button" onClick={() => canNext() && setStep(s => s + 1)}
              disabled={!canNext()}
              className={cn(
                'h-8 px-4 rounded-lg text-xs font-semibold transition-colors',
                canNext()
                  ? 'bg-[#2563eb] text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              )}>
              {step === 1 ? '건물 규모 입력 →' : step === 2 ? '지반정보 →' : step === 3 ? '산정 설정 →' : '다음 →'}
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="h-8 px-4 rounded-lg bg-[#2563eb] text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? '생성 중...' : '프로젝트 생성'}
            </button>
          )}
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className="flex-1 overflow-auto">
        <div className="h-full grid grid-cols-[1fr_420px]">

          {/* ── 왼쪽: 폼 ── */}
          <div className="overflow-auto p-6 space-y-0">

            {/* STEP 1: 기본 정보 */}
            {step === 1 && (
              <div className="space-y-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                  <div className="w-6 h-6 rounded-full bg-[#2563eb] flex items-center justify-center text-white text-[10px] font-bold">1</div>
                  <h2 className="text-sm font-semibold text-gray-900">기본 정보</h2>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    프로젝트명 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name" placeholder="예) 강남 힐스테이트 1단지"
                    value={form.name} onChange={e => set('name', e.target.value)}
                    className="h-10 border-gray-200 focus:border-[#2563eb]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="client" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">발주처</Label>
                    <Input id="client" placeholder="발주처명 입력" value={form.client} onChange={e => set('client', e.target.value)} className="border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contractor" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">시공사</Label>
                    <Input id="contractor" placeholder="시공사명 입력" value={form.contractor} onChange={e => set('contractor', e.target.value)} className="border-gray-200" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="location" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">현장 위치</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="location" placeholder="주소 입력"
                        className="pl-8 border-gray-200"
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
                        'flex items-center gap-1.5 h-10 px-3 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap',
                        form.location.trim()
                          ? 'border-[#2563eb] text-[#2563eb] hover:bg-blue-50'
                          : 'border-gray-200 text-gray-300 cursor-not-allowed'
                      )}
                    >
                      {isLoadingMap ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                      주소 검색
                    </button>
                  </div>
                  {coords && (
                    <p className="text-xs text-green-600 mt-1">
                      위치 확인: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    </p>
                  )}
                  {geocodeError && (
                    <p className="text-xs text-red-500 mt-1">{geocodeError}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">건물 유형</Label>
                    <Select value={form.type} onValueChange={v => v && set('type', v)}>
                      <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="공동주택">공동주택</SelectItem>
                        <SelectItem value="오피스텔">오피스텔</SelectItem>
                        <SelectItem value="주상복합">주상복합</SelectItem>
                        <SelectItem value="기타">기타</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="startDate" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">착공 예정일</Label>
                    <Input id="startDate" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className="border-gray-200" />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: 건물 규모 */}
            {step === 2 && (
              <div className="space-y-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-[#2563eb]" />
                    <h2 className="text-sm font-semibold text-gray-900">건물 규모 입력</h2>
                  </div>
                  {/* DXF 업로드 */}
                  <div className="flex items-center gap-2">
                    <input
                      ref={dxfInputRef}
                      type="file"
                      accept=".dxf"
                      className="hidden"
                      onChange={handleDxfUpload}
                    />
                    <button
                      type="button"
                      onClick={() => dxfInputRef.current?.click()}
                      disabled={isDxfLoading}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-[#2563eb] hover:text-[#2563eb] transition-colors"
                    >
                      {isDxfLoading
                        ? <Loader2 size={11} className="animate-spin" />
                        : <Upload size={11} />
                      }
                      DXF 파일 업로드
                    </button>
                  </div>
                </div>

                {dxfError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2 text-xs">{dxfError}</div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ground" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">지상 층수 <span className="text-red-500">*</span></Label>
                    <Input id="ground" type="number" min={1} placeholder="예) 25" value={form.ground} onChange={e => set('ground', e.target.value)} className="border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="basement" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">지하 층수</Label>
                    <Input id="basement" type="number" min={0} placeholder="예) 2" value={form.basement} onChange={e => set('basement', e.target.value)} className="border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="siteArea" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">대지면적 (m²)</Label>
                    <Input id="siteArea" type="number" min={0} placeholder="0.00" value={form.siteArea} onChange={e => set('siteArea', e.target.value)} className="border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bldgArea" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">연면적 (m²)</Label>
                    <Input id="bldgArea" type="number" min={0} placeholder="0.00" value={form.bldgArea} onChange={e => set('bldgArea', e.target.value)} className="border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sitePerim" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">대지 둘레 (m)</Label>
                    <Input id="sitePerim" type="number" min={0} value={form.sitePerim} onChange={e => set('sitePerim', e.target.value)} className="border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bldgPerim" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">건물 둘레 (m)</Label>
                    <Input id="bldgPerim" type="number" min={0} value={form.bldgPerim} onChange={e => set('bldgPerim', e.target.value)} className="border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lowrise" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">저층부 층수</Label>
                    <Input id="lowrise" type="number" min={0} value={form.lowrise} onChange={e => set('lowrise', e.target.value)} className="border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">지반조건</Label>
                    <Select value={form.groundCond} onValueChange={v => v && set('groundCond', v)}>
                      <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="양호">양호</SelectItem>
                        <SelectItem value="보통">보통</SelectItem>
                        <SelectItem value="불량">불량</SelectItem>
                        <SelectItem value="암반">암반</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">이층구조 (전이층)</p>
                    <p className="text-xs text-gray-400">저층부~고층부 구조 전환층 적용</p>
                  </div>
                  <button type="button" onClick={() => set('hasTransfer', !form.hasTransfer)}
                    className={cn('relative w-11 h-6 rounded-full transition-colors', form.hasTransfer ? 'bg-[#2563eb]' : 'bg-gray-200')}>
                    <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', form.hasTransfer ? 'translate-x-5' : '')} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: 지반정보 */}
            {step === 3 && (
              <div className="space-y-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <Drill size={16} className="text-[#2563eb]" />
                  <h2 className="text-sm font-semibold text-gray-900">지반 / 굴착 정보</h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="waterLevel" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">지하수위 (m)</Label>
                    <Input id="waterLevel" type="number" min={0} step={0.1} placeholder="예) 3.5" value={form.waterLevel} onChange={e => set('waterLevel', e.target.value)} className="border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="excDepth" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">굴착 깊이 (m)</Label>
                      {isAutoExc && (
                        <span className="text-[10px] font-semibold text-orange-500">
                          자동: {autoExcDepth}m ({bNum}층×4m+1m)
                        </span>
                      )}
                    </div>
                    <Input id="excDepth" type="number" min={0} step={0.1}
                      placeholder={isAutoExc ? `자동계산 ${autoExcDepth}m` : '예) 10.5'}
                      value={form.excDepth}
                      onChange={e => set('excDepth', e.target.value)}
                      className={cn('border-gray-200', isAutoExc && 'border-orange-200 bg-orange-50/40')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wtBottom" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">풍화토 하단 (m)</Label>
                    <Input id="wtBottom" type="number" min={0} step={0.1} placeholder="예) 5.5" value={form.wtBottom} onChange={e => set('wtBottom', e.target.value)} className="border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="waBottom" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">풍화암 하단 (m)</Label>
                    <Input id="waBottom" type="number" min={0} step={0.1} placeholder="예) 12.0" value={form.waBottom} onChange={e => set('waBottom', e.target.value)} className="border-gray-200" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="raBottom" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">연암 하단 (m)</Label>
                    <Input id="raBottom" type="number" min={0} step={0.1} placeholder="예) 20.0" value={form.raBottom} onChange={e => set('raBottom', e.target.value)} className="border-gray-200" />
                  </div>
                </div>

                <Separator />

                {/* 인근 시추공 불러오기 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">인근 시추공 불러오기</p>
                      <p className="text-xs text-gray-400">
                        {coords
                          ? `위치: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                          : '1단계에서 주소를 검색하면 활성화됩니다.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLoadBoreholes}
                      disabled={isLoadingBH || !coords}
                      className={cn(
                        'flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap',
                        coords
                          ? 'border-[#2563eb] text-[#2563eb] hover:bg-blue-50'
                          : 'border-gray-200 text-gray-300 cursor-not-allowed'
                      )}
                    >
                      {isLoadingBH ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
                      시추공 검색
                    </button>
                  </div>

                  {bhError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2 text-xs">{bhError}</div>
                  )}

                  {boreholes.length > 0 && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
                      <table className="w-full text-xs min-w-[600px]">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-2 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">시추공코드</th>
                            <th className="px-2 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">거리(m)</th>
                            <th className="px-2 py-2 text-right font-semibold text-[#92610a] whitespace-nowrap">풍화토 하단</th>
                            <th className="px-2 py-2 text-right font-semibold text-[#6b5a3e] whitespace-nowrap">풍화암 하단</th>
                            <th className="px-2 py-2 text-right font-semibold text-[#4a5568] whitespace-nowrap">연암 상단</th>
                            <th className="px-2 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">시추심도</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-600">주소(지번)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {boreholes.slice(0, 12).map((bh, i) => (
                            <tr
                              key={bh.id}
                              onClick={() => applyBorehole(bh)}
                              className={cn(
                                'border-b border-gray-100 cursor-pointer transition-colors hover:bg-blue-50',
                                i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                              )}
                              title="클릭하면 풍화토/풍화암/연암 깊이가 자동 입력됩니다"
                            >
                              <td className="px-2 py-2 font-mono text-[11px] text-gray-700 whitespace-nowrap">{bh.id}</td>
                              <td className="px-2 py-2 text-right text-gray-600 whitespace-nowrap">{bh.distance_m.toLocaleString()}</td>
                              <td className="px-2 py-2 text-right font-medium text-[#92610a] whitespace-nowrap">{bh.wt_display ?? '-'}</td>
                              <td className="px-2 py-2 text-right font-medium text-[#6b5a3e] whitespace-nowrap">{bh.wtr_display ?? '-'}</td>
                              <td className="px-2 py-2 text-right font-medium text-[#4a5568] whitespace-nowrap">{bh.rk_display ?? '-'}</td>
                              <td className="px-2 py-2 text-right text-gray-500 whitespace-nowrap">{bh.depth != null ? `${bh.depth}m` : '-'}</td>
                              <td className="px-2 py-2 text-gray-500 text-[10px] max-w-[160px] truncate">{bh.addr || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-3 py-2 bg-blue-50 border-t border-gray-200 flex items-center gap-2">
                        <span className="text-[10px] text-blue-600">행 클릭 → 해당 시추공 값 적용</span>
                        <span className="text-gray-300 text-[10px]">|</span>
                        <button
                          type="button"
                          onClick={() => applyAverage(boreholes)}
                          className="flex items-center gap-1 h-6 px-2 rounded border border-[#2563eb] text-[10px] font-semibold text-[#2563eb] bg-white hover:bg-blue-50 transition-colors"
                        >
                          평균값 적용
                        </button>
                        <span className="ml-auto text-[10px] text-gray-400">{boreholes.length}개 시추공 발견</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: 산정 설정 */}
            {step === 4 && (
              <div className="space-y-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <Cpu size={16} className="text-[#2563eb]" />
                  <h2 className="text-sm font-semibold text-gray-900">공기산정 설정</h2>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">WBS 생성 모드</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => set('mode', 'cp')}
                      className={cn('flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-all',
                        form.mode === 'cp' ? 'border-[#2563eb] bg-blue-50' : 'border-gray-200 hover:border-gray-300')}>
                      <span className="text-sm font-semibold text-gray-900">개략공기 (CP)</span>
                      <span className="text-xs text-gray-400">20개 집계 공종, 빠른 계산</span>
                    </button>
                    <button type="button" onClick={() => set('mode', 'full')}
                      className={cn('flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-all',
                        form.mode === 'full' ? 'border-[#2563eb] bg-blue-50' : 'border-gray-200 hover:border-gray-300')}>
                      <span className="text-sm font-semibold text-gray-900">상세공기 (층별)</span>
                      <span className="text-xs text-gray-400">층별 마감·설비 전개, 상세 분석</span>
                    </button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">입력 확인</p>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm border border-gray-100">
                    <div className="flex justify-between"><span className="text-gray-400">프로젝트명</span><span className="font-medium text-gray-900">{form.name}</span></div>
                    {form.client && <div className="flex justify-between"><span className="text-gray-400">발주처</span><span className="text-gray-700">{form.client}</span></div>}
                    {form.location && <div className="flex justify-between"><span className="text-gray-400">위치</span><span className="text-gray-700 text-right max-w-[200px]">{form.location}</span></div>}
                    <div className="flex justify-between"><span className="text-gray-400">규모</span><span className="text-gray-700">지상 {form.ground}F / 지하 {form.basement}F</span></div>
                    {form.siteArea && <div className="flex justify-between"><span className="text-gray-400">대지면적</span><span className="text-gray-700">{form.siteArea} m²</span></div>}
                    {form.excDepth && <div className="flex justify-between"><span className="text-gray-400">굴착깊이</span><span className="text-gray-700">{form.excDepth} m</span></div>}
                    {form.wtBottom && <div className="flex justify-between"><span className="text-gray-400">풍화토 하단</span><span className="text-gray-700">{form.wtBottom} m</span></div>}
                    {form.waBottom && <div className="flex justify-between"><span className="text-gray-400">풍화암 하단</span><span className="text-gray-700">{form.waBottom} m</span></div>}
                    {form.startDate && <div className="flex justify-between"><span className="text-gray-400">착공일</span><span className="text-gray-700">{form.startDate}</span></div>}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm">{error}</div>
            )}
          </div>

          {/* ── 오른쪽 패널 — 고정 사이드바처럼 전체 높이 ── */}
          <div className="border-l border-gray-200 bg-white flex flex-col overflow-hidden">

            {/* 지도 — 항상 220px 고정 */}
            <div className="flex-shrink-0 relative overflow-hidden border-b border-gray-200" style={{ height: '220px' }}>
              {mapPanel}
              {/* 좌표 오버레이 */}
              {coords && (
                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-md px-2 py-1 shadow-sm">
                  <MapPin size={10} className="text-green-500 flex-shrink-0" />
                  <span className="text-[10px] text-gray-600 truncate flex-1">{form.location}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 font-mono">
                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </span>
                </div>
              )}
            </div>

            {/* 미리보기 탭 */}
            <div className="flex-shrink-0 border-b border-gray-200 flex flex-col">
              {/* 탭 헤더 */}
              <div className="flex border-b border-gray-200 bg-gray-50">
                <button
                  onClick={() => setRightTab('section')}
                  className={cn(
                    'flex-1 py-2 text-[11px] font-semibold transition-colors',
                    rightTab === 'section'
                      ? 'text-[#2563eb] border-b-2 border-[#2563eb] bg-white'
                      : 'text-gray-500 hover:text-gray-700'
                  )}>
                  단면도
                </button>
                <button
                  onClick={() => setRightTab('dxf')}
                  className={cn(
                    'flex-1 py-2 text-[11px] font-semibold transition-colors',
                    rightTab === 'dxf'
                      ? 'text-[#2563eb] border-b-2 border-[#2563eb] bg-white'
                      : 'text-gray-500 hover:text-gray-700'
                  )}>
                  도면 미리보기
                  {dxfData && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-green-500 align-middle" />}
                </button>
              </div>

              {/* 탭 내용 */}
              {rightTab === 'section' && (
                <BuildingDiagram {...diagramProps} />
              )}
              {rightTab === 'dxf' && (
                dxfData
                  ? <DxfPreview segments={dxfData.segments} loops={dxfData.loops} highlightLayers={dxfData.highlightLayers} bbox={dxfData.bbox} />
                  : <div className="flex flex-col items-center justify-center gap-3 bg-[#1A202C]" style={{ height: 436 }}>
                      <svg width={40} height={40} viewBox="0 0 40 40" fill="none">
                        <rect x={6} y={4} width={28} height={32} rx={2} stroke="#334155" strokeWidth={1.5} />
                        <line x1={11} y1={13} x2={29} y2={13} stroke="#334155" strokeWidth={1.2} />
                        <line x1={11} y1={18} x2={29} y2={18} stroke="#334155" strokeWidth={1.2} />
                        <line x1={11} y1={23} x2={22} y2={23} stroke="#334155" strokeWidth={1.2} />
                      </svg>
                      <p className="text-[11px] text-slate-500 text-center px-4">
                        DXF 파일을 업로드하면<br />도면이 여기에 표시됩니다
                      </p>
                    </div>
              )}
            </div>

            {/* 엔진 상태 + 안내 */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {/* 엔진 상태 칩 */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: '#1e293b' }}>
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', canNext() ? 'bg-green-400 animate-pulse' : 'bg-slate-600')} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">자동 공기산정 엔진</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {canNext() ? 'STEP ' + step + ' 입력 완료 — 다음 단계로 진행하세요' : '필수 항목을 입력하면 활성화됩니다'}
                  </p>
                </div>
              </div>

              {/* 단계별 안내 */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-1">
                <p className="text-[10px] font-semibold text-[#2563eb] uppercase tracking-wider">STEP {step} / {TOTAL_STEPS}</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {step === 1 && '프로젝트명은 필수입니다. 주소 검색으로 현장 위치를 지도에서 확인하세요.'}
                  {step === 2 && 'DXF 파일을 업로드하면 대지면적과 둘레를 자동으로 입력할 수 있습니다.'}
                  {step === 3 && '인근 시추공을 불러와 행을 클릭하면 풍화토/풍화암/연암 깊이가 자동 입력됩니다.'}
                  {step === 4 && 'CP 모드는 20개 집계 공종으로 빠른 계산, Full 모드는 층별 상세 분석입니다.'}
                </p>
              </div>

              {/* 입력 요약 (Step 4에서) */}
              {step === 4 && (
                <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">입력 요약</p>
                  {[
                    ['프로젝트명', form.name],
                    ['위치', form.location],
                    ['규모', form.ground ? `지상 ${form.ground}F / 지하 ${form.basement}F` : ''],
                    ['대지면적', form.siteArea ? `${form.siteArea} m²` : ''],
                    ['굴착깊이', form.excDepth ? `${form.excDepth} m` : ''],
                    ['풍화토 하단', form.wtBottom ? `${form.wtBottom} m` : ''],
                    ['착공일', form.startDate],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-gray-400">{k}</span>
                      <span className="text-gray-700 font-medium text-right max-w-[160px] truncate">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
