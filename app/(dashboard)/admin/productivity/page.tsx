'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ShieldCheck, CheckCircle2, XCircle, Edit3, Loader2, TrendingUp,
  AlertCircle, Archive, Inbox, Building2, Database, Filter,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import MobileNotice from '@/components/common/MobileNotice'

interface Proposal {
  id: string
  projectId: string | null
  trade: string
  value: number
  unit: string
  sampleSize: number
  source: any
  status: 'pending' | 'approved' | 'rejected'
  reviewerNote: string | null
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
  project: { id: string; name: string } | null
}

interface Standard {
  id: string
  trade: string
  unit: string
  value: number
  sampleCount: number
  lastUpdated: string
}

interface CpdbRow {
  wbsCode: string | null
  category: string
  sub: string
  name: string
  unit: string
  cpdbProd: number | null
  cpdbStdDays: number | null
  keywords: string[]
  plannedQty: number
  plannedDays: number
  firstDate: string | null
  lastDate: string | null
  spanDays: number
  activeDays: number
  deviationDays: number | null
  deviationPct: number | null
  hasKeywords: boolean
  hasObservation: boolean
  applicable: boolean
  evidenceTotal: number
  evidences: { date: string; clause: string; rule: string }[]
}

interface ByProjectResponse {
  project: { id: string; name: string; type: string | null; ground: number | null; basement: number | null; startDate: string | null }
  totalReports: number
  firstDate: string | null
  lastDate: string | null
  rows: CpdbRow[]
}

const CPDB_CATEGORIES = ['공사준비', '토목공사', '골조공사', '마감공사']
const CATEGORY_COLORS: Record<string, { rgb: string; color: string }> = {
  '공사준비': { rgb: '100, 116, 139', color: '#64748b' },
  '토목공사': { rgb: '234, 88, 12',   color: '#ea580c' },
  '골조공사': { rgb: '37, 99, 235',   color: '#2563eb' },
  '마감공사': { rgb: '16, 185, 129',  color: '#059669' },
}

export default function AdminProductivityPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [standards, setStandards] = useState<Standard[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editNote, setEditNote] = useState('')

  // CP_DB 공종별 실적 분석
  const [cpdbProjectId, setCpdbProjectId] = useState<string>('')
  const [cpdbData, setCpdbData] = useState<ByProjectResponse | null>(null)
  const [cpdbLoading, setCpdbLoading] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // 전체 프로젝트 목록 (CP_DB 실적 + 제안 필터 공용)
  const [allProjects, setAllProjects] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.ok ? r.json() : [])
      .then((list: Array<{ id: string; name: string }>) => {
        setAllProjects(list.map(p => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name, 'ko')))
      })
      .catch(() => {})
  }, [])

  // 제안에 등장한 프로젝트 목록 (필터용 — 실제 제안 있는 프로젝트만 좁혀볼 수 있게)
  const projectsInProposals = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of proposals) {
      if (p.project) map.set(p.project.id, p.project.name)
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [proposals])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/productivity')
    const data = await res.json()
    setProposals(data.proposals ?? [])
    setStandards(data.standards ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function act(id: string, action: 'approve' | 'reject' | 'update' | 'delete') {
    if (action === 'delete') {
      if (!confirm('제안을 삭제하시겠습니까?')) return
      await fetch(`/api/admin/productivity/${id}`, { method: 'DELETE' })
      load()
      return
    }
    const body: any = { action, reviewerNote: editNote || undefined }
    if (editValue && editingId === id) body.value = Number(editValue)
    await fetch(`/api/admin/productivity/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setEditingId(null)
    setEditValue('')
    setEditNote('')
    load()
  }

  const filteredByProject = projectFilter === 'all'
    ? proposals
    : projectFilter === 'none'
      ? proposals.filter(p => p.project === null)
      : proposals.filter(p => p.project?.id === projectFilter)
  const visible = filter === 'all' ? filteredByProject : filteredByProject.filter(p => p.status === filter)
  const counts = {
    pending: filteredByProject.filter(p => p.status === 'pending').length,
    approved: filteredByProject.filter(p => p.status === 'approved').length,
    rejected: filteredByProject.filter(p => p.status === 'rejected').length,
  }

  // CP_DB 실적: 프로젝트 선택 시 API 호출
  useEffect(() => {
    if (!cpdbProjectId) { setCpdbData(null); return }
    let cancelled = false
    setCpdbLoading(true)
    fetch(`/api/admin/productivity/by-project?projectId=${cpdbProjectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setCpdbData(d) })
      .catch(() => { if (!cancelled) setCpdbData(null) })
      .finally(() => { if (!cancelled) setCpdbLoading(false) })
    return () => { cancelled = true }
  }, [cpdbProjectId])

  return (
    <div className="min-h-full bg-gray-50">
      <PageHeader
        icon={ShieldCheck}
        title="실적 지표 · 관리자 승인"
        subtitle="프로젝트 실적에서 추출된 자원계획(일평균 투입)과 생산성(인일/물량)을 검토 → 회사 표준 DB에 반영"
        accent="amber"
      />

      <MobileNotice
        feature="관리자 승인은 다수 제안을 비교 검토하는 화면이라 데스크톱 권장합니다."
        dismissKey="admin-productivity"
      />

      <div className="px-4 sm:px-6 py-6 max-w-7xl">
        {/* 회사 표준 요약 — 두 카테고리 구분 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <StandardGroup
            title="자원 계획 (일평균 투입 인원)"
            subtitle="공종별 평균 투입 규모 · CPM 인원 계획에 사용"
            items={standards.filter(s => s.unit === 'man/day')}
            colorClass="text-blue-700"
            borderClass="border-blue-100 bg-blue-50/30"
          />
          <StandardGroup
            title="생산성 (단위 물량당 소요 인일)"
            subtitle="자재 1단위 처리에 드는 인일 · CPM duration 계산에 사용"
            items={standards.filter(s => s.unit !== 'man/day')}
            colorClass="text-emerald-700"
            borderClass="border-emerald-100 bg-emerald-50/30"
          />
        </div>

        {/* CP_DB 공종별 실적 분석 — 프로젝트 선택 시 */}
        <section
          className="relative rounded-xl overflow-hidden bg-white mb-6"
          style={{
            border: '1px solid rgba(37, 99, 235, 0.2)',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 18px -10px rgba(37, 99, 235, 0.22)',
          }}
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-16 pointer-events-none"
            style={{ background: 'linear-gradient(180deg, rgba(37, 99, 235, 0.07) 0%, transparent 100%)' }} />
          <div className="relative flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-wrap">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}>
              <Database size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 tracking-[-0.01em]">CP_DB 공종별 실적 분석</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">선택한 프로젝트의 일보에서 각 공종의 실제 투입 인일·활동일을 CP_DB 기준과 비교합니다</p>
            </div>
            <label className="inline-flex items-center gap-2 px-3 h-10 rounded-lg bg-blue-50 border border-blue-200">
              <Building2 size={14} className="text-blue-600" />
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-[0.12em]">프로젝트</span>
              <select
                value={cpdbProjectId}
                onChange={e => setCpdbProjectId(e.target.value)}
                className="h-7 px-2 bg-white border border-blue-300 rounded-md text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 min-w-[180px]"
              >
                <option value="">— 프로젝트 선택 —</option>
                {allProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          </div>

          {cpdbLoading ? (
            <div className="p-8 flex items-center justify-center"><Loader2 size={18} className="animate-spin text-blue-500" /></div>
          ) : !cpdbData ? (
            <div className="p-6 text-center text-[12px] text-slate-500">
              {cpdbProjectId
                ? '데이터 로드 실패'
                : '프로젝트를 선택하면 해당 현장의 일보에서 계산한 공종별 실제 생산성이 여기 표시됩니다'}
            </div>
          ) : (
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                <span><strong className="text-slate-900">{cpdbData.project.name}</strong></span>
                <span>· 지상 {cpdbData.project.ground ?? 0}층 · 지하 {cpdbData.project.basement ?? 0}층</span>
                <span>· 일보 {cpdbData.totalReports}건</span>
                {cpdbData.firstDate && cpdbData.lastDate && (
                  <span>· 기록 {cpdbData.firstDate} ~ {cpdbData.lastDate}</span>
                )}
              </div>

              {CPDB_CATEGORIES.map(cat => {
                const rows = cpdbData.rows.filter(r => r.category === cat && r.hasKeywords)
                if (rows.length === 0) return null
                const meta = CATEGORY_COLORS[cat]
                return (
                  <div key={cat} className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                      <span className="w-1.5 h-4 rounded-full" style={{ background: meta.color }} />
                      <span className="text-[11px] font-bold text-slate-700">{cat}</span>
                      <span className="text-[10px] text-slate-400">{rows.length}종</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.1em] bg-white border-b border-slate-100">
                            <th className="text-left px-3 py-1.5">작업명</th>
                            <th className="text-center px-2 py-1.5 w-12">단위</th>
                            <th className="text-left px-2 py-1.5">검색 키워드</th>
                            <th className="text-right px-2 py-1.5 w-[90px]">첫 등장</th>
                            <th className="text-right px-2 py-1.5 w-[90px]">마지막 등장</th>
                            <th className="text-right px-2 py-1.5 w-20">실제 기간</th>
                            <th className="text-right px-2 py-1.5 w-20">언급일수</th>
                            <th className="text-right px-2 py-1.5 w-20">계획 기간</th>
                            <th className="text-right px-2 py-1.5 w-20">편차</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {rows.map(r => {
                            const devColor = r.deviationPct == null
                              ? 'text-slate-400'
                              : r.deviationPct > 10  ? 'text-red-600'
                              : r.deviationPct < -10 ? 'text-emerald-600'
                              : 'text-slate-500'
                            const expanded = expandedRow === r.name
                            const canExpand = r.hasObservation && r.evidences.length > 0
                            return (
                              <>
                                <tr
                                  key={r.name}
                                  className={`${r.hasObservation ? 'hover:bg-slate-50/50 cursor-pointer' : 'opacity-50'} ${expanded ? 'bg-slate-50' : ''}`}
                                  onClick={() => canExpand && setExpandedRow(expanded ? null : r.name)}
                                >
                                  <td className="px-3 py-1.5 font-semibold text-slate-900 flex items-center gap-1.5">
                                    {canExpand && <span className="text-slate-400 text-[9px]">{expanded ? '▼' : '▶'}</span>}
                                    {r.name}
                                    {r.evidenceTotal > 0 && (
                                      <span className="text-[9px] text-slate-400 font-normal">{r.evidenceTotal}건</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1.5 text-center text-slate-500 font-mono">{r.unit}</td>
                                  <td className="px-2 py-1.5 text-[10px] text-slate-500 font-mono truncate max-w-[180px]" title={r.keywords.join(', ')}>
                                    {r.keywords.slice(0, 3).join(', ')}{r.keywords.length > 3 ? ` +${r.keywords.length - 3}` : ''}
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-700">
                                    {r.firstDate ?? '—'}
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-700">
                                    {r.lastDate ?? '—'}
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-900 font-bold" style={{ color: r.spanDays > 0 ? meta.color : undefined }}>
                                    {r.spanDays > 0 ? `${r.spanDays}일` : '—'}
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-500">
                                    {r.activeDays > 0 ? `${r.activeDays}회` : '—'}
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-500">
                                    {r.plannedDays > 0 ? `${r.plannedDays}일` : '—'}
                                  </td>
                                  <td className={`px-2 py-1.5 text-right font-mono tabular-nums font-bold ${devColor}`}>
                                    {r.deviationPct != null
                                      ? `${r.deviationPct > 0 ? '+' : ''}${r.deviationPct}%`
                                      : '—'}
                                  </td>
                                </tr>
                                {expanded && r.evidences.length > 0 && (
                                  <tr className="bg-slate-50">
                                    <td colSpan={9} className="px-4 py-3">
                                      <div className="space-y-1.5">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                          매칭 증거 ({r.evidences.length}건 표시 / 전체 {r.evidenceTotal}건)
                                        </p>
                                        <ul className="space-y-1">
                                          {r.evidences.map((e, i) => (
                                            <li key={i} className="flex items-start gap-2 text-[11px]">
                                              <span className="font-mono tabular-nums text-slate-500 w-[80px] flex-shrink-0">{e.date}</span>
                                              <span className="inline-block px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-mono text-[10px] flex-shrink-0">{e.rule}</span>
                                              <span className="text-slate-700 flex-1 min-w-0 break-words">{e.clause}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}

              {/* 키워드 없는 공종 */}
              {(() => {
                const unmapped = cpdbData.rows.filter(r => !r.hasKeywords)
                if (unmapped.length === 0) return null
                return (
                  <details className="mt-1">
                    <summary className="text-[11px] text-slate-500 cursor-pointer hover:text-slate-900">
                      텍스트 키워드가 없는 공종 {unmapped.length}종 ▾
                    </summary>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      {unmapped.map(u => u.name).join(', ')}
                      <br />
                      <span className="text-slate-400">→ <code className="font-mono text-[10px] bg-slate-100 px-1 rounded">lib/engine/wbs-keyword-map.ts</code>에 해당 공종의 일보 텍스트 키워드 추가 필요</span>
                    </p>
                  </details>
                )
              })()}

              {/* 물량 입력 안내 */}
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
                <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-900 leading-relaxed">
                  <strong>기간만 자동 추출됩니다.</strong> 생산성(단위당 인일)을 얻으려면 공종별 <strong>실적 물량</strong>을 관리자가 수동 입력해야 합니다.
                  일보에는 시공 물량이 기록되지 않기 때문입니다 — 다음 업데이트에서 공종별 물량 입력 UI가 추가됩니다.
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 프로젝트 필터 + 탭 */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <label className="inline-flex items-center gap-2 text-[11px] text-slate-600">
            <Filter size={12} className="text-slate-400" />
            <span className="font-semibold uppercase tracking-[0.1em] text-slate-500">프로젝트</span>
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="h-8 px-2 bg-white border border-slate-300 rounded-md text-[12px] focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="all">전체 프로젝트</option>
              <option value="none">프로젝트 미지정</option>
              {projectsInProposals.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          {projectFilter !== 'all' && (
            <button
              onClick={() => setProjectFilter('all')}
              className="text-[10px] text-slate-500 hover:text-slate-900 font-medium"
            >지우기</button>
          )}
          <span className="text-[11px] text-slate-400 ml-auto">{filteredByProject.length}건</span>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mb-4">
          {[
            { id: 'pending' as const, label: '승인 대기', icon: <Inbox size={12} />, count: counts.pending },
            { id: 'approved' as const, label: '승인됨', icon: <CheckCircle2 size={12} />, count: counts.approved },
            { id: 'rejected' as const, label: '거부됨', icon: <XCircle size={12} />, count: counts.rejected },
            { id: 'all' as const, label: '전체', icon: <Archive size={12} />, count: proposals.length },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                filter === t.id
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t.icon}
              {t.label}
              <span
                className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  filter === t.id ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-emerald-600" />
          </div>
        ) : visible.length === 0 ? (
          <div className="card-elevated p-8 text-center text-gray-400 text-sm">
            해당 상태의 제안이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(p => (
              <div
                key={p.id}
                className="card-elevated p-4"
              >
                <div className="flex items-start gap-4">
                  {/* 좌측 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{p.trade}</span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                          categoryLabel(p.unit).color
                        }`}
                      >
                        {categoryLabel(p.unit).name}
                      </span>
                      <StatusBadge status={p.status} />
                      {p.project && (
                        <Link
                          href={`/projects/${p.project.id}`}
                          className="text-[11px] text-blue-600 hover:underline"
                        >
                          {p.project.name}
                        </Link>
                      )}
                    </div>

                    <div className="flex items-baseline gap-3 mb-2">
                      {editingId === p.id ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="w-32 text-xl font-mono font-bold border border-blue-300 rounded px-2 py-0.5 text-blue-700"
                          autoFocus
                        />
                      ) : (
                        <span className="text-xl font-mono font-bold text-blue-700">
                          {p.value}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">{unitLabel(p.unit)}</span>
                      <span className="text-[10px] text-gray-400">
                        · 샘플 {p.sampleSize}개
                      </span>
                    </div>

                    {/* 계산 근거 */}
                    <div className="text-[11px] text-gray-500 bg-gray-50 rounded px-2 py-1.5">
                      {p.source && (
                        <>
                          {p.source.totalManDays !== undefined && (
                            <span>총 {Math.round(p.source.totalManDays)}인일</span>
                          )}
                          {p.source.activeDays !== undefined && (
                            <span> · 활동일 {p.source.activeDays}일</span>
                          )}
                          {p.source.totalMaterial !== undefined && (
                            <span> · {p.source.matName} {p.source.totalMaterial.toLocaleString()}</span>
                          )}
                          {p.source.firstDate && (
                            <span className="text-gray-400">
                              {' '}({p.source.firstDate} ~ {p.source.lastDate})
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {p.reviewerNote && (
                      <div className="text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1">
                        💬 {p.reviewerNote}
                      </div>
                    )}

                    {editingId === p.id && (
                      <input
                        value={editNote}
                        onChange={e => setEditNote(e.target.value)}
                        placeholder="검토 메모 (선택)"
                        className="w-full mt-2 text-xs border border-gray-200 rounded px-2 py-1"
                      />
                    )}
                  </div>

                  {/* 우측 액션 */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {p.status === 'pending' && (
                      <>
                        {editingId === p.id ? (
                          <>
                            <button
                              onClick={() => act(p.id, 'approve')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                            >
                              <CheckCircle2 size={12} /> 승인
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setEditValue(''); setEditNote('') }}
                              className="px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => act(p.id, 'approve')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                              title="값 그대로 승인"
                            >
                              <CheckCircle2 size={12} /> 승인
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(p.id)
                                setEditValue(String(p.value))
                                setEditNote(p.reviewerNote ?? '')
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="값 수정"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => {
                                const note = prompt('거부 사유 (선택):')
                                if (note !== null) {
                                  setEditNote(note)
                                  setTimeout(() => act(p.id, 'reject'), 0)
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                            >
                              <XCircle size={12} /> 거부
                            </button>
                          </>
                        )}
                      </>
                    )}
                    {p.status !== 'pending' && (
                      <span className="text-[11px] text-gray-400">
                        {p.approvedBy}
                        {p.approvedAt && ` · ${new Date(p.approvedAt).toLocaleDateString('ko-KR')}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 안내 */}
        <div className="mt-6 text-[11px] text-gray-400 bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-2">
          <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
          <div>
            <b>승인 시 회사 표준 생산성에 가중평균 반영됩니다.</b> 이미 같은 공종·단위에 값이 있으면
            샘플 수로 평균 갱신. 값이 현장 평균과 크게 다르면 <b>수정 후 승인</b>하거나 거부하세요.
          </div>
        </div>
      </div>
    </div>
  )
}

function StandardGroup({
  title,
  subtitle,
  items,
  colorClass,
  borderClass,
}: {
  title: string
  subtitle: string
  items: Standard[]
  colorClass: string
  borderClass: string
}) {
  return (
    <div className={`bg-white rounded-2xl border p-5 ${borderClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-xs text-gray-400">{items.length}건</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 py-3">아직 승인된 표준값이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map(s => (
            <div key={s.id} className="bg-white rounded-lg p-3 border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-800 truncate">{s.trade}</span>
                <span className="text-[10px] text-gray-400">샘플 {s.sampleCount}</span>
              </div>
              <div className={`text-base font-mono font-bold ${colorClass}`}>
                {s.value}
                <span className="text-[10px] text-gray-400 font-normal ml-1">
                  {s.unit === 'man/day' ? '명/일' : s.unit === 'mandays/ton' ? '인일/톤' : s.unit === 'mandays/m3' ? '인일/㎥' : s.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
    status === 'rejected' ? 'bg-red-100 text-red-700' :
    'bg-amber-100 text-amber-700'
  const label =
    status === 'approved' ? '승인' :
    status === 'rejected' ? '거부' :
    '대기'
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>
      {label}
    </span>
  )
}

function unitLabel(unit: string): string {
  if (unit === 'man/day') return '명/일'
  if (unit === 'mandays/ton') return '인일/톤'
  if (unit === 'mandays/m3') return '인일/㎥'
  return unit
}

function categoryLabel(unit: string): { name: string; color: string } {
  if (unit === 'man/day') {
    return { name: '자원 계획 (일평균 투입 인원)', color: 'text-blue-700 bg-blue-50 border-blue-100' }
  }
  return { name: '생산성 (단위 물량당 소요 인일)', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' }
}
