'use client'

// 유형별 특화 필드 에디터
// - project.type 에 따라 다른 필드 세트 표시
// - 데이터센터: Tier·랙·MW·냉방방식·발전기
// - 공동주택: 세대수·타입·주차대수
// - 오피스텔: 실수·주차대수
// - 그 외 type에는 아무것도 표시 안 함 (기존 동작 유지)

import { DatabaseZap, Building2 } from 'lucide-react'

// ── 데이터센터 ────────────────────────────────────────────
export interface DataCenterSpec {
  tier?: 1 | 2 | 3 | 4       // Uptime Institute Tier
  rackCount?: number         // 랙 수
  mwCapacity?: number        // IT 전력용량 (MW)
  cooling?: 'AIR' | 'DX' | 'CHILLER' | 'LIQUID' | 'MIXED'
  generatorCount?: number    // 비상 발전기 수
  upsMinutes?: number        // UPS 백업 시간 (분)
  pue?: number               // 목표 PUE
  buildingCount?: number     // 건물 동 수
}

export interface ApartmentSpec {
  unitCount?: number         // 세대 수
  types?: string             // 타입 구성 (예: "59A-84B-115C")
  parking?: number           // 주차 대수
}

export interface OfficetelSpec {
  roomCount?: number         // 실 수
  parking?: number
}

export interface IndustrySpecific {
  dataCenter?: DataCenterSpec
  apartment?: ApartmentSpec
  officetel?: OfficetelSpec
}

interface Props {
  type?: string
  value: IndustrySpecific
  onChange: (next: IndustrySpecific) => void
}

export default function IndustrySpecificFields({ type, value, onChange }: Props) {
  if (type === '데이터센터') {
    const dc = value.dataCenter ?? {}
    const set = (patch: Partial<DataCenterSpec>) => onChange({ ...value, dataCenter: { ...dc, ...patch } })
    return (
      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-indigo-900">
          <DatabaseZap size={14} />
          <h4 className="text-xs font-bold">데이터센터 특화 정보</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <F label="Tier 등급">
            <select value={dc.tier ?? ''} onChange={e => set({ tier: e.target.value ? Number(e.target.value) as 1|2|3|4 : undefined })}
              className="w-full h-9 px-2 bg-white border border-indigo-200 rounded text-sm">
              <option value="">—</option>
              <option value="1">Tier 1</option>
              <option value="2">Tier 2</option>
              <option value="3">Tier 3</option>
              <option value="4">Tier 4</option>
            </select>
          </F>
          <F label="IT 전력 (MW)">
            <input type="number" step="0.1" value={dc.mwCapacity ?? ''} onChange={e => set({ mwCapacity: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full h-9 px-2 bg-white border border-indigo-200 rounded text-sm font-mono" />
          </F>
          <F label="랙 수">
            <input type="number" value={dc.rackCount ?? ''} onChange={e => set({ rackCount: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full h-9 px-2 bg-white border border-indigo-200 rounded text-sm font-mono" />
          </F>
          <F label="건물 동 수">
            <input type="number" value={dc.buildingCount ?? ''} onChange={e => set({ buildingCount: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full h-9 px-2 bg-white border border-indigo-200 rounded text-sm font-mono" />
          </F>
          <F label="냉방 방식">
            <select value={dc.cooling ?? ''} onChange={e => set({ cooling: (e.target.value || undefined) as any })}
              className="w-full h-9 px-2 bg-white border border-indigo-200 rounded text-sm">
              <option value="">—</option>
              <option value="AIR">공랭(AIR)</option>
              <option value="DX">DX 직팽</option>
              <option value="CHILLER">칠러</option>
              <option value="LIQUID">액침(Liquid)</option>
              <option value="MIXED">혼합</option>
            </select>
          </F>
          <F label="비상발전기 수">
            <input type="number" value={dc.generatorCount ?? ''} onChange={e => set({ generatorCount: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full h-9 px-2 bg-white border border-indigo-200 rounded text-sm font-mono" />
          </F>
          <F label="UPS 백업 (분)">
            <input type="number" value={dc.upsMinutes ?? ''} onChange={e => set({ upsMinutes: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full h-9 px-2 bg-white border border-indigo-200 rounded text-sm font-mono" />
          </F>
          <F label="목표 PUE">
            <input type="number" step="0.01" value={dc.pue ?? ''} onChange={e => set({ pue: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full h-9 px-2 bg-white border border-indigo-200 rounded text-sm font-mono" placeholder="1.40" />
          </F>
        </div>
        <p className="text-[10px] text-indigo-700">
          ※ 데이터센터는 MEP 비중이 일반 건축 대비 2~3배. 견적·공기 산정 시 가중치 별도 적용 예정.
        </p>
      </div>
    )
  }

  if (type === '공동주택') {
    const ap = value.apartment ?? {}
    const set = (patch: Partial<ApartmentSpec>) => onChange({ ...value, apartment: { ...ap, ...patch } })
    return (
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-blue-900">
          <Building2 size={14} />
          <h4 className="text-xs font-bold">공동주택 특화 정보</h4>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <F label="총 세대수">
            <input type="number" value={ap.unitCount ?? ''} onChange={e => set({ unitCount: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full h-9 px-2 bg-white border border-blue-200 rounded text-sm font-mono" />
          </F>
          <F label="타입 구성">
            <input value={ap.types ?? ''} onChange={e => set({ types: e.target.value })}
              placeholder="59A · 84B · 115C"
              className="w-full h-9 px-2 bg-white border border-blue-200 rounded text-sm" />
          </F>
          <F label="주차대수">
            <input type="number" value={ap.parking ?? ''} onChange={e => set({ parking: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full h-9 px-2 bg-white border border-blue-200 rounded text-sm font-mono" />
          </F>
        </div>
      </div>
    )
  }

  if (type === '오피스텔') {
    const ot = value.officetel ?? {}
    const set = (patch: Partial<OfficetelSpec>) => onChange({ ...value, officetel: { ...ot, ...patch } })
    return (
      <div className="bg-teal-50 border border-teal-100 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-teal-900">
          <Building2 size={14} />
          <h4 className="text-xs font-bold">오피스텔 특화 정보</h4>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="총 실수">
            <input type="number" value={ot.roomCount ?? ''} onChange={e => set({ roomCount: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full h-9 px-2 bg-white border border-teal-200 rounded text-sm font-mono" />
          </F>
          <F label="주차대수">
            <input type="number" value={ot.parking ?? ''} onChange={e => set({ parking: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full h-9 px-2 bg-white border border-teal-200 rounded text-sm font-mono" />
          </F>
        </div>
      </div>
    )
  }

  return null
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-gray-600 block mb-1">{label}</label>
      {children}
    </div>
  )
}

// 디스플레이용 요약 (프로젝트 상세 페이지 등에서 표시)
export function IndustrySpecificSummary({ type, value }: { type?: string; value?: IndustrySpecific }) {
  if (!value || !type) return null
  if (type === '데이터센터' && value.dataCenter) {
    const d = value.dataCenter
    const parts: string[] = []
    if (d.tier) parts.push(`Tier ${d.tier}`)
    if (d.mwCapacity) parts.push(`${d.mwCapacity}MW`)
    if (d.rackCount) parts.push(`${d.rackCount}랙`)
    if (d.cooling) parts.push(d.cooling)
    if (d.buildingCount) parts.push(`${d.buildingCount}동`)
    if (parts.length === 0) return null
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
        <DatabaseZap size={10} /> {parts.join(' · ')}
      </span>
    )
  }
  if (type === '공동주택' && value.apartment) {
    const a = value.apartment
    const parts: string[] = []
    if (a.unitCount) parts.push(`${a.unitCount}세대`)
    if (a.types) parts.push(a.types)
    if (a.parking) parts.push(`주차 ${a.parking}`)
    if (parts.length === 0) return null
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
        <Building2 size={10} /> {parts.join(' · ')}
      </span>
    )
  }
  return null
}
