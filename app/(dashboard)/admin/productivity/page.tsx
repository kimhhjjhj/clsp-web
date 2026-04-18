'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ShieldCheck, CheckCircle2, XCircle, Edit3, Loader2, ArrowLeft, TrendingUp,
  AlertCircle, Archive, Inbox,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'

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

export default function AdminProductivityPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [standards, setStandards] = useState<Standard[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editNote, setEditNote] = useState('')

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

  const visible = filter === 'all' ? proposals : proposals.filter(p => p.status === filter)
  const counts = {
    pending: proposals.filter(p => p.status === 'pending').length,
    approved: proposals.filter(p => p.status === 'approved').length,
    rejected: proposals.filter(p => p.status === 'rejected').length,
  }

  return (
    <div className="min-h-full bg-gray-50">
      <PageHeader
        icon={ShieldCheck}
        title="실적 지표 · 관리자 승인"
        subtitle="프로젝트 실적에서 추출된 자원계획(일평균 투입)과 생산성(인일/물량)을 검토 → 회사 표준 DB에 반영"
      />

      <div className="px-4 sm:px-6 py-6 max-w-7xl">
        {/* 회사 표준 요약 — 두 카테고리 구분 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
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
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
            해당 상태의 제안이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(p => (
              <div
                key={p.id}
                className="bg-white border border-gray-200 rounded-xl p-4"
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
