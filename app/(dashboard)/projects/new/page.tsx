'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, Building2, Layers, Settings2,
  MapPin, Info, Cpu, X, ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface FormData {
  name: string; client: string; contractor: string
  location: string; type: string; startDate: string
  ground: string; basement: string; lowrise: string
  hasTransfer: boolean
  siteArea: string; bldgArea: string; sitePerim: string; bldgPerim: string
  wtBottom: string; waBottom: string
  mode: 'cp' | 'full'
}

const INITIAL: FormData = {
  name: '', client: '', contractor: '', location: '',
  type: '공동주택', startDate: '',
  ground: '', basement: '0', lowrise: '0', hasTransfer: false,
  siteArea: '', bldgArea: '', sitePerim: '', bldgPerim: '',
  wtBottom: '', waBottom: '',
  mode: 'cp',
}

const STEPS = [
  { id: 1, label: 'Basic Info',            icon: Info },
  { id: 2, label: 'Building Scale',        icon: Building2 },
  { id: 3, label: 'Calculation Settings',  icon: Settings2 },
]

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep]   = useState(1)
  const [form, setForm]   = useState<FormData>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: keyof FormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function canNext(): boolean {
    if (step === 1) return !!form.name.trim()
    if (step === 2) return !!form.ground && Number(form.ground) >= 1
    return true
  }

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
      }),
    })
    if (!res.ok) { setError('저장에 실패했습니다.'); setSaving(false); return }
    const project = await res.json()
    router.push(`/projects/${project.id}`)
  }

  return (
    <div className="min-h-full bg-background flex flex-col">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-8 pt-6 pb-4">
        <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight size={12} />
        <span className="text-foreground">Create New Project</span>
      </div>

      {/* ── Title ── */}
      <div className="px-8 pb-6">
        <h1 className="text-2xl font-bold">Create New Project</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define the structural parameters and logistics for your upcoming construction lifecycle.
        </p>
      </div>

      {/* ── Step progress ── */}
      <div className="px-8 pb-8">
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => {
            const done    = step > s.id
            const current = step === s.id
            const Icon    = s.icon
            return (
              <div key={s.id} className="flex items-center gap-0 flex-1">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                    done    ? 'bg-primary border-primary text-primary-foreground'
                    : current ? 'bg-background border-primary text-primary'
                    : 'bg-muted border-border text-muted-foreground',
                  )}>
                    <Icon size={16} />
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium uppercase tracking-wider whitespace-nowrap',
                    current ? 'text-foreground' : 'text-muted-foreground',
                  )}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 mb-5 mx-2',
                    step > s.id ? 'bg-primary' : 'bg-border',
                  )} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Main form area ── */}
      <div className="flex-1 px-8 pb-8">
        <div className="grid grid-cols-[1fr_340px] gap-6 max-w-5xl">

          {/* Left: form */}
          <div className="space-y-6">

            {/* ── STEP 1: Basic Info ── */}
            {step === 1 && (
              <div className="space-y-5 bg-card border border-border rounded-xl p-6">
                <h2 className="text-sm font-semibold">Project Information</h2>

                <div className="space-y-1.5">
                  <Label htmlFor="name">
                    PROJECT NAME <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name" placeholder="e.g. Skyline Residency"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="client">CLIENT</Label>
                    <Input
                      id="client" placeholder="Enter developer name"
                      value={form.client} onChange={e => set('client', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contractor">CONTRACTOR</Label>
                    <Input
                      id="contractor" placeholder="Enter contractor name"
                      value={form.contractor} onChange={e => set('contractor', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="location">LOCATION</Label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="location" placeholder="Search address..."
                      className="pl-8"
                      value={form.location} onChange={e => set('location', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>BUILDING TYPE</Label>
                    <Select value={form.type} onValueChange={v => v && set('type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="공동주택">공동주택</SelectItem>
                        <SelectItem value="오피스텔">오피스텔</SelectItem>
                        <SelectItem value="주상복합">주상복합</SelectItem>
                        <SelectItem value="기타">기타</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="startDate">START DATE</Label>
                    <Input
                      id="startDate" type="date"
                      value={form.startDate} onChange={e => set('startDate', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2: Building Scale ── */}
            {step === 2 && (
              <div className="space-y-5 bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-primary" />
                  <h2 className="text-sm font-semibold">Dimensional Parameters</h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ground">GROUND FLOORS <span className="text-destructive">*</span></Label>
                    <Input
                      id="ground" type="number" min={1} placeholder="12"
                      value={form.ground} onChange={e => set('ground', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="basement">BASEMENTS</Label>
                    <Input
                      id="basement" type="number" min={0} placeholder="2"
                      value={form.basement} onChange={e => set('basement', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="siteArea">SITE AREA (m²)</Label>
                    <Input
                      id="siteArea" type="number" min={0} placeholder="0.00"
                      value={form.siteArea} onChange={e => set('siteArea', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bldgArea">BLDG AREA (m²)</Label>
                    <Input
                      id="bldgArea" type="number" min={0} placeholder="0.00"
                      value={form.bldgArea} onChange={e => set('bldgArea', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sitePerim">SITE PERIMETER (m)</Label>
                    <Input
                      id="sitePerim" type="number" min={0}
                      value={form.sitePerim} onChange={e => set('sitePerim', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bldgPerim">BLDG PERIMETER (m)</Label>
                    <Input
                      id="bldgPerim" type="number" min={0}
                      value={form.bldgPerim} onChange={e => set('bldgPerim', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lowrise">LOW-RISE FLOORS</Label>
                    <Input
                      id="lowrise" type="number" min={0}
                      value={form.lowrise} onChange={e => set('lowrise', e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Transfer slab toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Transfer Slab</p>
                    <p className="text-xs text-muted-foreground">저층부~고층부 구조 전환층</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => set('hasTransfer', !form.hasTransfer)}
                    className={cn(
                      'relative w-11 h-6 rounded-full transition-colors',
                      form.hasTransfer ? 'bg-primary' : 'bg-input',
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                      form.hasTransfer ? 'translate-x-5' : '',
                    )} />
                  </button>
                </div>

                {/* Underground conditions */}
                {Number(form.basement) > 0 && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-sm font-medium">Underground Conditions</p>
                        <Badge variant="secondary">B{form.basement}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="wtBottom">지하수위 깊이 (m)</Label>
                          <Input
                            id="wtBottom" type="number" min={0} step={0.1}
                            value={form.wtBottom} onChange={e => set('wtBottom', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="waBottom">풍화암 깊이 (m)</Label>
                          <Input
                            id="waBottom" type="number" min={0} step={0.1}
                            value={form.waBottom} onChange={e => set('waBottom', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── STEP 3: Calculation Settings ── */}
            {step === 3 && (
              <div className="space-y-5 bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-2">
                  <Cpu size={16} className="text-primary" />
                  <h2 className="text-sm font-semibold">Calculation Settings</h2>
                </div>

                <div className="space-y-3">
                  <Label>WBS 생성 모드</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => set('mode', 'cp')}
                      className={cn(
                        'flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-all',
                        form.mode === 'cp'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-border/80',
                      )}
                    >
                      <span className="text-sm font-semibold">개략공기 (CP)</span>
                      <span className="text-xs text-muted-foreground">20개 집계 공종, 빠른 계산</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => set('mode', 'full')}
                      className={cn(
                        'flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-all',
                        form.mode === 'full'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-border/80',
                      )}
                    >
                      <span className="text-sm font-semibold">상세공기 (층별)</span>
                      <span className="text-xs text-muted-foreground">층별 마감·설비 전개, 상세 분석</span>
                    </button>
                  </div>
                </div>

                <Separator />

                {/* Summary review */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Review</p>
                  <div className="bg-muted/40 rounded-lg p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Project</span><span className="font-medium">{form.name}</span></div>
                    {form.client && <div className="flex justify-between"><span className="text-muted-foreground">Client</span><span>{form.client}</span></div>}
                    {form.location && <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span>{form.location}</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Scale</span><span>지상 {form.ground}F / 지하 {form.basement}F</span></div>
                    {form.startDate && <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{form.startDate}</span></div>}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Right: info panel */}
          <div className="space-y-4">
            {/* Decorative map card */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="h-44 bg-gradient-to-br from-slate-800 to-slate-900 relative flex items-center justify-center">
                <div className="absolute inset-0 opacity-20" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-rule='evenodd'%3E%3Ccircle cx='1' cy='1' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
                }} />
                <div className="relative flex items-center gap-2 bg-background/90 backdrop-blur-sm rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg">
                  <MapPin size={14} className="text-primary" />
                  Interactive Site Map
                </div>
              </div>
              <div className="px-4 py-3 text-xs text-muted-foreground italic">
                "Accurate site dimensions ensure optimal crane placement and material flow scheduling."
              </div>
            </div>

            {/* Engine status card */}
            <div className="rounded-xl border border-border bg-slate-900 dark:bg-slate-900 p-4 space-y-2">
              <p className="text-sm font-semibold text-white">Automated Estimation</p>
              <p className="text-xs text-slate-400">
                Fill in the dimensional parameters to let our AI engine predict your baseline schedule milestones.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className={cn(
                  'w-2 h-2 rounded-full',
                  canNext() ? 'bg-green-400 animate-pulse' : 'bg-slate-600',
                )} />
                <span className="text-xs font-mono font-medium text-slate-300 uppercase tracking-wider">
                  {canNext() ? 'ENGINE READY' : 'AWAITING INPUT'}
                </span>
              </div>
            </div>

            {/* Progress hint */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step {step} of 3</p>
              {step === 1 && (
                <p className="text-xs text-muted-foreground">프로젝트명, 발주처, 위치 등 기본 정보를 입력하세요.</p>
              )}
              {step === 2 && (
                <p className="text-xs text-muted-foreground">건물 규모와 대지 정보를 입력하면 WBS 물량이 자동으로 산정됩니다.</p>
              )}
              {step === 3 && (
                <p className="text-xs text-muted-foreground">공기산정 모드를 선택하고 프로젝트를 생성하세요.</p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Bottom action bar ── */}
      <div className="flex-shrink-0 sticky bottom-0 border-t border-border bg-background/95 backdrop-blur-sm px-8 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={14} />Cancel
        </button>

        <div className="flex items-center gap-3">
          {step > 1 && (
            <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)}>
              ← Back
            </Button>
          )}

          {step < 3 ? (
            <Button
              size="sm"
              disabled={!canNext()}
              onClick={() => setStep(s => s + 1)}
              className="gap-2"
            >
              {step === 1 ? 'Proceed to Scale' : 'Proceed to Settings'}
              <ArrowRight size={14} />
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={saving || !canNext()}
              onClick={handleSubmit}
              className="gap-2"
            >
              {saving ? '생성 중...' : '프로젝트 생성 및 공기산정 시작'}
              <ArrowRight size={14} />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
