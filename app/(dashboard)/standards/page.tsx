'use client'

// ═══════════════════════════════════════════════════════════
// 표준 공정 DB — 개략 공기 산정에 실제 쓰이는 기준 DB
//
// 목적: 신규 프로젝트 계획 시 "이 규모면 각 공종이 며칠 걸리는가"를
// 표준 공정 DB(CP_DB) 기반으로 바로 읽을 수 있게 한다.
//
// 데이터 소스: lib/engine/wbs.ts의 CP_DB — 대분류/중분류/작업명/단위/
// 생산성(단위/일) 또는 표준일수(일/층) 구조. CPM이 실제로 쓰는 값.
// ═══════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Database, Building2, Calendar, ExternalLink, Info, Layers, Ruler, AlertTriangle,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { FullscreenToggle, fullscreenClass, useFullscreen } from '@/components/common/Fullscreen'
import { CP_DB, computeQuantities, calcDuration, getWorkRate, type DBRow } from '@/lib/engine/wbs'
import type { ProjectInput } from '@/lib/types'
import RegressionCompare from '@/components/standards/RegressionCompare'

interface PlanSize {
  type: string
  ground: number
  basement: number
  lowrise: number
  hasTransfer: boolean
  bldgArea: number
  buildingArea: number
  siteArea: number
  sitePerim: number
  bldgPerim: number
  wtBottom: number
  waBottom: number
}

const INITIAL_PLAN: PlanSize = {
  type: '공동주택',
  ground: 20, basement: 2, lowrise: 0, hasTransfer: false,
  bldgArea: 30000, buildingArea: 1500, siteArea: 6000,
  sitePerim: 300, bldgPerim: 220,
  wtBottom: 3, waBottom: 6,
}

const CATEGORY_META: Record<string, { rgb: string; color: string; label: string; note: string }> = {
  '공사준비': { rgb: '100, 116, 139', color: '#64748b', label: '공사준비', note: '가설울타리·사무실·전기/용수·부지정지' },
  '토목공사': { rgb: '234, 88, 12',   color: '#ea580c', label: '토목공사', note: '흙막이·차수·토공사 (터파기)' },
  '골조공사': { rgb: '37, 99, 235',   color: '#2563eb', label: '골조공사', note: '기초·지하·지상층·전이층' },
  '마감공사': { rgb: '16, 185, 129',  color: '#059669', label: '마감공사', note: '내·외부·세대 마감' },
}

const CATEGORY_ORDER = ['공사준비', '토목공사', '골조공사', '마감공사']

function fmtNum(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '—'
  const v = Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals)
  return v.toLocaleString()
}

export default function StandardsPage() {
  const [plan, setPlan] = useState<PlanSize>(INITIAL_PLAN)
  const { fullscreen, toggle: toggleFullscreen } = useFullscreen()

  // 계획 규모 기반 물량 자동 산정
  const projectInput: ProjectInput = {
    name: '표준DB 시뮬',
    type: plan.type,
    ground: plan.ground,
    basement: plan.basement,
    lowrise: plan.lowrise,
    hasTransfer: plan.hasTransfer,
    bldgArea: plan.bldgArea,
    buildingArea: plan.buildingArea,
    siteArea: plan.siteArea,
    sitePerim: plan.sitePerim,
    bldgPerim: plan.bldgPerim,
    wtBottom: plan.wtBottom,
    waBottom: plan.waBottom,
    mode: 'cp',
  }
  const qtys = useMemo(() => computeQuantities(projectInput), [plan]) // eslint-disable-line

  // 각 공종에 계산값 덧붙임
  const enriched = useMemo(() => {
    return CP_DB.map(row => {
      const qty = qtys[row.name] ?? 0
      const applicable = qty > 0 || ['전체', '개소', '대', '주'].includes(row.unit)
      const effectiveQty = qty > 0 ? qty : (applicable ? 1 : 0)
      const dur = effectiveQty > 0 ? calcDuration(row, effectiveQty) : 0
      return {
        ...row,
        qty: effectiveQty,
        dur,
        applicable: dur > 0,
        workRate: getWorkRate(row.category),
      }
    })
  }, [qtys])

  // 대분류별 그룹
  const grouped = useMemo(() => {
    const g: Record<string, typeof enriched> = {}
    for (const cat of CATEGORY_ORDER) g[cat] = []
    for (const e of enriched) (g[e.category] ??= []).push(e)
    return g
  }, [enriched])

  // 총 예상 기간 (단순 합 — 실제 CPM은 병렬로 줄어들지만 대략 상한 기준)
  const totalDuration = enriched.filter(e => e.applicable).reduce((s, e) => s + e.dur, 0)
  const activeCount = enriched.filter(e => e.applicable).length

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={Database}
        title="표준 공정 DB"
        subtitle="개략 공기 산정에 직접 사용되는 공종별 생산성·단위·기간 — 계획 규모를 입력하면 예상 기간이 바로 계산됩니다"
        accent="blue"
        actions={
          <Link
            href="/admin/productivity"
            className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-lg bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100"
          >
            <ExternalLink size={13} /> <span className="hidden sm:inline">관리자 승인</span><span className="sm:hidden">승인</span>
          </Link>
        }
      />

      <div className={`flex-1 overflow-auto p-4 sm:p-6 space-y-5 ${fullscreenClass(fullscreen)}`}>
        {fullscreen && (
          <div className="absolute top-2 right-2 z-30">
            <FullscreenToggle fullscreen={fullscreen} onToggle={toggleFullscreen} />
          </div>
        )}

        {/* 계획 규모 시뮬레이터 */}
        <section
          className="relative rounded-xl overflow-hidden bg-white p-4 sm:p-5"
          style={{
            border: '1px solid rgba(37, 99, 235, 0.2)',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 18px -10px rgba(37, 99, 235, 0.22)',
          }}
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-16 pointer-events-none"
            style={{ background: 'linear-gradient(180deg, rgba(37, 99, 235, 0.07) 0%, transparent 100%)' }} />

          <div className="relative flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}>
                <Building2 size={16} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-[-0.01em]">계획 규모</h3>
                <p className="text-[11px] text-slate-500">각 공종의 물량·기간이 이 값을 기준으로 자동 계산됩니다</p>
              </div>
            </div>
            {!fullscreen && (
              <FullscreenToggle fullscreen={fullscreen} onToggle={toggleFullscreen} />
            )}
            <button
              onClick={() => setPlan(INITIAL_PLAN)}
              className="text-[11px] text-slate-500 hover:text-slate-900 font-medium px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50"
            >초기화</button>
          </div>

          <div className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Input label="유형"     value={plan.type}     onChange={v => setPlan(p => ({ ...p, type: String(v) }))} type="select" options={['공동주택','오피스텔','업무시설','데이터센터','기타']} />
            <Input label="지상"     value={plan.ground}   onChange={v => setPlan(p => ({ ...p, ground: Number(v) || 0 }))}   unit="층" />
            <Input label="지하"     value={plan.basement} onChange={v => setPlan(p => ({ ...p, basement: Number(v) || 0 }))} unit="층" />
            <Input label="저층부"   value={plan.lowrise}  onChange={v => setPlan(p => ({ ...p, lowrise: Number(v) || 0 }))}  unit="층" />
            <Input label="연면적"   value={plan.bldgArea}     onChange={v => setPlan(p => ({ ...p, bldgArea: Number(v) || 0 }))}     unit="㎡" />
            <Input label="건축면적" value={plan.buildingArea} onChange={v => setPlan(p => ({ ...p, buildingArea: Number(v) || 0 }))} unit="㎡" />
            <Input label="대지면적" value={plan.siteArea}     onChange={v => setPlan(p => ({ ...p, siteArea: Number(v) || 0 }))}     unit="㎡" />
            <Input label="대지둘레" value={plan.sitePerim}    onChange={v => setPlan(p => ({ ...p, sitePerim: Number(v) || 0 }))}    unit="m" />
            <Input label="건물둘레" value={plan.bldgPerim}    onChange={v => setPlan(p => ({ ...p, bldgPerim: Number(v) || 0 }))}    unit="m" />
            <Input label="풍화토"   value={plan.wtBottom}     onChange={v => setPlan(p => ({ ...p, wtBottom: Number(v) || 0 }))}     unit="m" />
            <Input label="풍화암"   value={plan.waBottom}     onChange={v => setPlan(p => ({ ...p, waBottom: Number(v) || 0 }))}     unit="m" />
            <label className="flex items-center gap-2 px-3 h-10 rounded-md border border-slate-300 bg-slate-50 text-[11px] cursor-pointer hover:bg-white">
              <input type="checkbox" checked={plan.hasTransfer} onChange={e => setPlan(p => ({ ...p, hasTransfer: e.target.checked }))} />
              <span className="font-semibold">전이층 포함</span>
            </label>
          </div>
        </section>

        {/* 요약 */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="DB 공종 수" value={CP_DB.length} unit="종" accent="#2563eb" rgb="37, 99, 235" icon={<Database size={14} />} />
          <Stat label="적용 공종" value={activeCount} unit="종" accent="#059669" rgb="16, 185, 129" icon={<Layers size={14} />} />
          <Stat label="누적 공기 상한" value={Math.round(totalDuration * 10) / 10} unit="일" accent="#ea580c" rgb="234, 88, 12" icon={<Calendar size={14} />}
            note="각 공종 기간 단순 합 (CPM 병렬 반영 전)" />
          <Stat label="개략 개월" value={(totalDuration / 30).toFixed(1)} unit="개월" accent="#7c3aed" rgb="139, 92, 246" icon={<Ruler size={14} />} />
        </section>

        {/* 대분류별 공종 테이블 */}
        {CATEGORY_ORDER.map(cat => {
          const meta = CATEGORY_META[cat]
          const rows = grouped[cat] ?? []
          if (rows.length === 0) return null
          const catDur = rows.filter(r => r.applicable).reduce((s, r) => s + r.dur, 0)
          const applyCount = rows.filter(r => r.applicable).length
          return (
            <section
              key={cat}
              className="relative rounded-xl overflow-hidden bg-white"
              style={{
                border: `1px solid rgba(${meta.rgb}, 0.22)`,
                boxShadow: `0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 18px -10px rgba(${meta.rgb}, 0.22)`,
              }}
            >
              <span aria-hidden className="absolute inset-x-0 top-0 h-20 pointer-events-none"
                style={{ background: `linear-gradient(180deg, rgba(${meta.rgb}, 0.07) 0%, transparent 100%)` }} />
              <div className="relative flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
                <span className="flex items-center justify-center w-9 h-9 rounded-xl"
                  style={{ background: `rgba(${meta.rgb}, 0.12)`, color: meta.color }}>
                  <Database size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 tracking-[-0.01em]">{meta.label}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">{meta.note}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">소계</p>
                  <p className="text-sm font-bold text-slate-900 tabular-nums">
                    {applyCount}종 · <span style={{ color: meta.color }}>{Math.round(catDur * 10) / 10}일</span>
                  </p>
                </div>
              </div>
              <div className="relative overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="bg-slate-50/70 border-b border-slate-100">
                    <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">
                      <th className="text-left px-4 py-2 w-[70px]">WBS</th>
                      <th className="text-left px-3 py-2 w-[90px]">중분류</th>
                      <th className="text-left px-3 py-2">작업명</th>
                      <th className="text-center px-2 py-2 w-[48px]">단위</th>
                      <th className="text-right px-2 py-2 w-[100px]">
                        생산성
                        <span className="block text-[9px] font-normal text-slate-400 normal-case">단위/일</span>
                      </th>
                      <th className="text-right px-2 py-2 w-[90px]">
                        표준일수
                        <span className="block text-[9px] font-normal text-slate-400 normal-case">일/단위</span>
                      </th>
                      <th className="text-center px-2 py-2 w-[60px]">가동률</th>
                      <th className="text-right px-3 py-2 w-[110px]">
                        내 물량
                        <span className="block text-[9px] font-normal text-slate-400 normal-case">계획 규모 기준</span>
                      </th>
                      <th className="text-right px-3 py-2 w-[90px]">
                        예상 기간
                        <span className="block text-[9px] font-normal text-slate-400 normal-case">일</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(r => (
                      <tr key={r.wbsCode ?? r.name}
                        className={r.applicable ? 'hover:bg-slate-50/60' : 'opacity-50'}
                        title={!r.applicable ? '계획 규모 기준 이 공종은 적용되지 않습니다' : undefined}
                      >
                        <td className="px-4 py-2 font-mono text-[10px] text-slate-400">{r.wbsCode ?? ''}</td>
                        <td className="px-3 py-2 text-slate-600">{r.sub}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{r.name}</td>
                        <td className="px-2 py-2 text-center text-slate-500 font-mono">{r.unit}</td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums">
                          {r.prod != null ? <span className="text-slate-900">{r.prod}</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums">
                          {r.stdDays != null ? <span className="text-slate-900">{r.stdDays}</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-2 py-2 text-center text-[11px] text-slate-500 font-mono tabular-nums">
                          {r.workRate != null ? `${Math.round(r.workRate * 100)}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {r.applicable ? (
                            <>
                              <span className="text-slate-900 font-semibold">{fmtNum(r.qty, r.qty < 10 ? 1 : 0)}</span>
                              <span className="text-[10px] text-slate-400 ml-0.5">{r.unit}</span>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">
                              <AlertTriangle size={10} /> 미적용
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {r.applicable ? (
                            <span className="text-base font-bold tracking-[-0.01em]" style={{ color: meta.color }}>
                              {Math.round(r.dur * 10) / 10}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}

        {/* 설명 */}
        <section className="rounded-xl p-4 text-xs text-slate-600 leading-relaxed bg-white border border-slate-200">
          <p className="font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
            <Info size={13} className="text-blue-500" /> 이 DB가 어떻게 쓰이나요?
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li><strong>사업 초기 검토(/bid)</strong>에서 WBS를 자동 생성할 때 이 CP_DB가 표준값으로 사용됩니다.</li>
            <li>산정식: <span className="font-mono bg-slate-100 px-1 rounded">기간 = 물량 ÷ 생산성 ÷ 가동률</span> 또는 <span className="font-mono bg-slate-100 px-1 rounded">기간 = 물량 × 표준일수 ÷ 가동률</span></li>
            <li>가동률: 공사준비·토목 66.6% · 골조 63.2% · 마감은 raw 값 그대로.</li>
            <li>관리자 승인 후의 회사 실적 표준은 CPM에서 이 기본값을 덮어씁니다 — <Link href="/admin/productivity" className="text-blue-600 hover:underline">관리자 승인</Link>.</li>
          </ul>
        </section>

        {/* F18. 자사 회귀식 재학습 */}
        <section
          className="relative rounded-xl overflow-hidden bg-white p-4 sm:p-5"
          style={{
            border: '1px solid rgba(79, 70, 229, 0.2)',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 18px -10px rgba(79, 70, 229, 0.22)',
          }}
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-16 pointer-events-none"
            style={{ background: 'linear-gradient(180deg, rgba(79, 70, 229, 0.06) 0%, transparent 100%)' }} />
          <div className="relative">
            <RegressionCompare />
          </div>
        </section>
      </div>
    </div>
  )
}

function Input({
  label, unit, value, onChange, type = 'number', options,
}: {
  label: string
  unit?: string
  value: string | number
  onChange: (v: string | number) => void
  type?: 'number' | 'select'
  options?: string[]
}) {
  if (type === 'select') {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">{label}</span>
        <select
          value={String(value)}
          onChange={e => onChange(e.target.value)}
          className="h-10 px-2.5 bg-slate-50 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white"
        >
          {options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    )
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] flex items-center justify-between">
        {label}
        {unit && <span className="text-[9px] font-mono text-slate-400 normal-case">{unit}</span>}
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={String(value)}
        onChange={e => onChange(e.target.value)}
        onFocus={e => e.target.select()}
        className="h-10 px-2.5 bg-slate-50 border border-slate-300 rounded-md text-sm text-right font-mono tabular-nums focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white"
      />
    </label>
  )
}

function Stat({
  label, value, unit, accent, rgb, icon, note,
}: {
  label: string
  value: number | string
  unit: string
  accent: string
  rgb: string
  icon: React.ReactNode
  note?: string
}) {
  return (
    <div
      className="relative rounded-xl overflow-hidden bg-white p-4"
      style={{
        border: `1px solid rgba(${rgb}, 0.18)`,
        boxShadow: `0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 16px -10px rgba(${rgb}, 0.22)`,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-14 pointer-events-none"
        style={{ background: `linear-gradient(180deg, rgba(${rgb}, 0.06) 0%, transparent 100%)` }}
      />
      <div className="relative flex items-center gap-2 mb-2">
        <span className="flex items-center justify-center w-6 h-6 rounded-md" style={{ background: `rgba(${rgb}, 0.12)`, color: accent }}>
          {icon}
        </span>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>{label}</p>
      </div>
      <p className="relative text-2xl font-bold text-slate-900 leading-none tabular-nums tracking-[-0.02em]">
        {value}
        <span className="text-xs font-medium text-slate-400 ml-1">{unit}</span>
      </p>
      {note && <p className="relative text-[10px] text-slate-400 mt-2 leading-tight">{note}</p>}
    </div>
  )
}
