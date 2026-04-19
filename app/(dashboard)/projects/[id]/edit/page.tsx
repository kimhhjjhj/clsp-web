'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import DxfUpload from '@/components/precon/DxfUpload'
import IndustrySpecificFields, { type IndustrySpecific } from '@/components/common/IndustrySpecificFields'
import PageHeader from '@/components/common/PageHeader'

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
  buildingArea: string
  sitePerim: string
  bldgPerim: string
  wtBottom: string
  waBottom: string
}

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [form, setForm] = useState<FormData | null>(null)
  const [industrySpecific, setIndustrySpecific] = useState<IndustrySpecific>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(p => {
        setForm({
          name: p.name ?? '',
          client: p.client ?? '',
          contractor: p.contractor ?? '',
          location: p.location ?? '',
          type: p.type ?? '공동주택',
          startDate: p.startDate ?? '',
          ground: String(p.ground ?? ''),
          basement: String(p.basement ?? 0),
          lowrise: String(p.lowrise ?? 0),
          hasTransfer: p.hasTransfer ?? false,
          siteArea: p.siteArea != null ? String(p.siteArea) : '',
          bldgArea: p.bldgArea != null ? String(p.bldgArea) : '',
          buildingArea: p.buildingArea != null ? String(p.buildingArea) : '',
          sitePerim: p.sitePerim != null ? String(p.sitePerim) : '',
          bldgPerim: p.bldgPerim != null ? String(p.bldgPerim) : '',
          wtBottom: p.wtBottom != null ? String(p.wtBottom) : '',
          waBottom: p.waBottom != null ? String(p.waBottom) : '',
        })
        setIndustrySpecific((p.industrySpecific as IndustrySpecific | null) ?? {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  function set(field: keyof FormData, value: string | boolean) {
    setForm(prev => prev ? { ...prev, [field]: value } : prev)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setError('')

    if (!form.name.trim()) { setError('프로젝트명을 입력해주세요.'); return }
    if (!form.ground || Number(form.ground) < 1) { setError('지상 층수를 입력해주세요.'); return }

    setSaving(true)
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
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
        siteArea: form.siteArea ? Number(form.siteArea) : null,
        bldgArea: form.bldgArea ? Number(form.bldgArea) : null,
        buildingArea: form.buildingArea ? Number(form.buildingArea) : null,
        sitePerim: form.sitePerim ? Number(form.sitePerim) : null,
        bldgPerim: form.bldgPerim ? Number(form.bldgPerim) : null,
        wtBottom: form.wtBottom ? Number(form.wtBottom) : null,
        waBottom: form.waBottom ? Number(form.waBottom) : null,
        industrySpecific: Object.keys(industrySpecific).length > 0 ? industrySpecific : null,
      }),
    })

    if (!res.ok) {
      setError('저장에 실패했습니다. 다시 시도해주세요.')
      setSaving(false)
      return
    }

    router.push(`/projects/${id}`)
  }

  if (loading) return (
    <div className="flex flex-col h-full">
      <PageHeader icon={Pencil} title="프로젝트 수정" subtitle="불러오는 중…" accent="emerald" />
      <div className="p-6 text-sm text-muted-foreground">불러오는 중...</div>
    </div>
  )
  if (!form) return (
    <div className="flex flex-col h-full">
      <PageHeader icon={Pencil} title="프로젝트 수정" subtitle="찾을 수 없음" accent="emerald" />
      <div className="p-6 text-sm text-muted-foreground">프로젝트를 찾을 수 없습니다.</div>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={Pencil}
        title="프로젝트 수정"
        subtitle={form.name}
        accent="emerald"
        actions={
          <Link
            href={`/projects/${id}`}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={12} /> 프로젝트로
          </Link>
        }
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* 프로젝트 기본 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">프로젝트 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">프로젝트명 <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                placeholder="예) 강남구 OO아파트 신축공사"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="client">발주처</Label>
                <Input id="client" placeholder="예) OO건설" value={form.client} onChange={e => set('client', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contractor">시공사</Label>
                <Input id="contractor" placeholder="예) (주)OO건설" value={form.contractor} onChange={e => set('contractor', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">공사위치</Label>
                <Input id="location" placeholder="예) 서울시 강남구" value={form.location} onChange={e => set('location', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>건물 유형</Label>
                <Select value={form.type} onValueChange={v => v && set('type', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="공동주택">공동주택</SelectItem>
                    <SelectItem value="오피스텔">오피스텔</SelectItem>
                    <SelectItem value="주상복합">주상복합</SelectItem>
                    <SelectItem value="기타">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="startDate">착공 예정일</Label>
                <Input id="startDate" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 건물 규모 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">건물 규모</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ground">지상 층수 <span className="text-destructive">*</span></Label>
                <Input id="ground" type="number" min={1} value={form.ground} onChange={e => set('ground', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="basement">지하 층수</Label>
                <Input id="basement" type="number" min={0} value={form.basement} onChange={e => set('basement', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lowrise">저층부 층수</Label>
                <Input id="lowrise" type="number" min={0} value={form.lowrise} onChange={e => set('lowrise', e.target.value)} />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">전이층 (Transfer Slab)</p>
                <p className="text-xs text-muted-foreground">저층부와 고층부 사이 구조 전환층</p>
              </div>
              <button
                type="button"
                onClick={() => set('hasTransfer', !form.hasTransfer)}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.hasTransfer ? 'bg-primary' : 'bg-input'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.hasTransfer ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 유형별 특화 필드 */}
        {['데이터센터', '공동주택', '오피스텔'].includes(form.type) && (
          <IndustrySpecificFields
            type={form.type}
            value={industrySpecific}
            onChange={setIndustrySpecific}
          />
        )}

        {/* 면적 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">면적 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="siteArea">대지면적 (m²)</Label>
                <Input id="siteArea" type="number" min={0} value={form.siteArea} onChange={e => set('siteArea', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="buildingArea">건축면적 (m²) <span className="text-xs text-muted-foreground font-normal">1층 footprint</span></Label>
                <Input id="buildingArea" type="number" min={0} value={form.buildingArea} onChange={e => set('buildingArea', e.target.value)} placeholder="미입력 시 연면적÷층수 추정" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bldgArea">연면적 (m²) <span className="text-xs text-muted-foreground font-normal">전 층 합계</span></Label>
                <Input id="bldgArea" type="number" min={0} value={form.bldgArea} onChange={e => set('bldgArea', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sitePerim">대지 둘레 (m)</Label>
                <Input id="sitePerim" type="number" min={0} value={form.sitePerim} onChange={e => set('sitePerim', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bldgPerim">건물 둘레 (m)</Label>
                <Input id="bldgPerim" type="number" min={0} value={form.bldgPerim} onChange={e => set('bldgPerim', e.target.value)} />
              </div>
            </div>
            <Separator />
            <div>
              <Label className="mb-2 block">DXF 도면으로 면적·둘레 자동 갱신</Label>
              <DxfUpload
                onApply={v => {
                  set('siteArea', String(v.siteArea))
                  set('bldgArea', String(v.bldgArea))
                  set('sitePerim', String(v.sitePerim))
                  set('bldgPerim', String(v.bldgPerim))
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* 지하 조건 */}
        {Number(form.basement) > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                지하 조건
                <Badge variant="secondary">지하 {form.basement}층</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="wtBottom">풍화토 바닥 (m) <span className="text-xs text-muted-foreground font-normal">지표~풍화토 하단</span></Label>
                  <Input id="wtBottom" type="number" min={0} step={0.1} value={form.wtBottom} onChange={e => set('wtBottom', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="waBottom">풍화암 바닥 (m) <span className="text-xs text-muted-foreground font-normal">지표~풍화암 하단</span></Label>
                  <Input id="waBottom" type="number" min={0} step={0.1} value={form.waBottom} onChange={e => set('waBottom', e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? '저장 중...' : '변경사항 저장'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push(`/projects/${id}`)}>
            취소
          </Button>
        </div>
        </form>
      </div>
    </div>
  )
}
