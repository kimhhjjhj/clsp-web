'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  TrendingUp, Search, X, CheckCircle2, Clock, Filter, Download,
  BarChart3, Database, Building2, ExternalLink,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { SkeletonTable } from '@/components/common/Skeleton'

interface Standard {
  id: string
  trade: string
  unit: string
  value: number
  sampleCount: number
  lastUpdated: string
}

interface Candidate {
  trade: string
  unit: string
  avgValue: number
  proposalCount: number
  totalSamples: number
  projectCount: number
}

type UnitFilter = 'all' | 'man/day' | 'mandays/ton' | 'mandays/m3'
type StatusFilter = 'all' | 'approved' | 'pending'

const UNIT_LABEL: Record<string, string> = {
  'man/day': '일평균 투입(명/일)',
  'mandays/ton': '생산성(인일/톤)',
  'mandays/m3': '생산성(인일/m³)',
}

export default function StandardsPage() {
  const [standards, setStandards] = useState<Standard[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    fetch('/api/company-standards?includeProposals=1')
      .then(r => r.json())
      .then(data => {
        setStandards(data.standards ?? [])
        setCandidates(data.candidates ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // 승인 + 대기 통합 테이블
  const rows = useMemo(() => {
    const m = new Map<string, {
      trade: string
      unit: string
      approvedValue?: number
      approvedSample?: number
      approvedAt?: string
      candidateValue?: number
      candidateSamples?: number
      candidateProjects?: number
      status: 'approved' | 'pending'
    }>()
    for (const s of standards) {
      m.set(`${s.trade}|${s.unit}`, {
        trade: s.trade, unit: s.unit,
        approvedValue: s.value,
        approvedSample: s.sampleCount,
        approvedAt: s.lastUpdated,
        status: 'approved',
      })
    }
    for (const c of candidates) {
      const key = `${c.trade}|${c.unit}`
      const cur = m.get(key) ?? { trade: c.trade, unit: c.unit, status: 'pending' as const }
      cur.candidateValue = c.avgValue
      cur.candidateSamples = c.totalSamples
      cur.candidateProjects = c.projectCount
      if (cur.approvedValue === undefined) cur.status = 'pending'
      m.set(key, cur)
    }
    return Array.from(m.values())
  }, [standards, candidates])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => {
      if (unitFilter !== 'all' && r.unit !== unitFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (q && !r.trade.toLowerCase().includes(q)) return false
      return true
    }).sort((a, b) => {
      // 승인 먼저, 그 안에서 공종명순
      if (a.status !== b.status) return a.status === 'approved' ? -1 : 1
      return a.trade.localeCompare(b.trade, 'ko')
    })
  }, [rows, query, unitFilter, statusFilter])

  const stats = {
    approved: standards.length,
    pending: candidates.filter(c => !standards.some(s => s.trade === c.trade && s.unit === c.unit)).length,
    totalSamples: candidates.reduce((s, c) => s + c.totalSamples, 0),
    projects: Math.max(0, ...candidates.map(c => c.projectCount)),
  }

  function downloadCsv() {
    const header = '공종,단위,승인값,승인샘플,제안평균,총샘플,관여프로젝트수,상태'
    const rows = filtered.map(r => [
      r.trade, r.unit,
      r.approvedValue ?? '', r.approvedSample ?? '',
      r.candidateValue ?? '', r.candidateSamples ?? '',
      r.candidateProjects ?? '', r.status,
    ].join(','))
    const csv = '\ufeff' + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `company-standards-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={Database}
        title="생산성 DB"
        subtitle="과거 프로젝트 실적에서 축적된 공종별 평균 투입·생산성 표준"
        actions={
          <>
            <button
              onClick={downloadCsv}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Download size={14} /> CSV 내보내기
            </button>
            <Link
              href="/admin/productivity"
              className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
            >
              <ExternalLink size={13} /> <span className="hidden sm:inline">관리자 승인</span><span className="sm:hidden">승인</span>
            </Link>
          </>
        }
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="승인 표준" value={stats.approved} unit="종" icon={<CheckCircle2 size={14} className="text-emerald-600" />} bg="bg-emerald-50" />
          <Stat label="승인 대기" value={stats.pending} unit="종" icon={<Clock size={14} className="text-amber-600" />} bg="bg-amber-50" />
          <Stat label="누적 활동일" value={stats.totalSamples.toLocaleString()} unit="일" icon={<BarChart3 size={14} className="text-blue-600" />} bg="bg-blue-50" />
          <Stat label="기여 프로젝트" value={stats.projects} unit="개" icon={<Building2 size={14} className="text-purple-600" />} bg="bg-purple-50" />
        </div>

        {/* 검색·필터 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="공종명 검색 (예: 철근, 형틀, 내장)"
              className="w-full pl-9 pr-8 h-9 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="inline-flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
            {(['all', 'approved', 'pending'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`h-7 px-3 rounded text-xs font-semibold transition-colors ${
                  statusFilter === s ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >{s === 'all' ? '전체' : s === 'approved' ? '승인' : '대기'}</button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1.5 text-xs text-gray-500">
            <Filter size={12} className="text-gray-400" />
            <select
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value as UnitFilter)}
              className="h-9 px-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="all">모든 단위</option>
              <option value="man/day">일평균 투입 (명/일)</option>
              <option value="mandays/ton">생산성 (인일/톤)</option>
              <option value="mandays/m3">생산성 (인일/m³)</option>
            </select>
          </div>

          <span className="ml-auto text-xs text-gray-500 hidden sm:block">
            {filtered.length}종 표시
          </span>
        </div>

        {/* 테이블 */}
        {loading ? (
          <SkeletonTable rows={10} cols={6} />
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200">
            <EmptyState
              icon={Database}
              title={rows.length === 0 ? '아직 축적된 생산성 데이터가 없습니다' : '조건에 맞는 결과가 없습니다'}
              description={rows.length === 0 ? '프로젝트에 일보를 쌓고 제안→승인 과정을 거치면 자동으로 여기에 축적됩니다.' : '검색어나 필터를 변경해보세요.'}
              actions={rows.length === 0 ? [
                { label: '일보 임포트', href: '/import', variant: 'primary' },
              ] : [
                { label: '초기화', onClick: () => { setQuery(''); setUnitFilter('all'); setStatusFilter('all') }, variant: 'secondary' },
              ]}
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="text-left px-4 py-2.5">상태</th>
                    <th className="text-left px-4 py-2.5">공종</th>
                    <th className="text-left px-4 py-2.5">단위</th>
                    <th className="text-right px-4 py-2.5">승인 표준</th>
                    <th className="text-right px-4 py-2.5">제안 평균</th>
                    <th className="text-right px-4 py-2.5 hidden sm:table-cell">샘플</th>
                    <th className="text-right px-4 py-2.5 hidden lg:table-cell">프로젝트</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(r => (
                    <tr key={`${r.trade}|${r.unit}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {r.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                            <CheckCircle2 size={10} /> 승인
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                            <Clock size={10} /> 대기
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-gray-900">{r.trade}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{UNIT_LABEL[r.unit] ?? r.unit}</td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {r.approvedValue !== undefined ? (
                          <span className="font-bold text-emerald-700">{r.approvedValue}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {r.candidateValue !== undefined ? (
                          <span className={r.status === 'approved' ? 'text-gray-400' : 'text-amber-700 font-semibold'}>
                            {r.candidateValue}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-500 hidden sm:table-cell">
                        {(r.candidateSamples ?? r.approvedSample ?? 0).toLocaleString()}일
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-500 hidden lg:table-cell">
                        {r.candidateProjects ?? (r.approvedValue !== undefined ? 1 : 0)}개
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 하단 설명 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
          <p className="font-semibold mb-1">생산성 DB는 어떻게 만들어지나요?</p>
          <ol className="list-decimal list-inside space-y-0.5 text-blue-800">
            <li>프로젝트에 일보를 쌓음 (공종·회사·투입 인원·자재)</li>
            <li>4단계 분석에서 &apos;회사 표준으로 제안&apos; 버튼 → 제안(pending) 생성</li>
            <li>관리자가 검토·승인 → 가중평균으로 회사 표준(approved)에 누적</li>
            <li>신규 프로젝트 1단계 CPM에서 이 DB를 참고로 사용</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

function Stat({
  label, value, unit, icon, bg,
}: { label: string; value: number | string; unit: string; icon: React.ReactNode; bg: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <div className={`w-7 h-7 rounded-md ${bg} flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900">
        {value}<span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </p>
    </div>
  )
}
