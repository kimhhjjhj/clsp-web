'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, ShieldAlert, TrendingUp, AlertTriangle, CheckCircle2, Clock, Upload, Download, Loader2, X, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

interface RO {
  id: string; type: string; category: string; content: string
  impactType: string; impactDays: number | null; impactCost: number | null
  probability: number; response: string | null; owner: string | null; status: string
  // 실무 R&O 필드 (엑셀 양식 호환)
  code?: string | null; rev?: number | null; subCategory?: string | null
  proposer?: string | null; proposedAt?: string | null
  proposedCost?: number | null; confirmedCost?: number | null
  progress?: string | null; confirmedAt?: string | null
  expectedAt?: string | null
  designApplied?: string | null; note?: string | null
  attachments?: Array<{ name: string; size: number; type: string; uploadedAt: string; url: string }> | null
}

const EMPTY: Omit<RO, 'id'> = {
  type: 'risk', category: '', content: '', impactType: 'schedule',
  impactDays: null, impactCost: null, probability: 50,
  response: '', owner: '', status: 'identified',
}

const STATUS_LABEL: Record<string, string> = { identified: '식별', reviewing: '검토중', closed: '완료' }
const STATUS_COLOR: Record<string, string> = {
  identified: '#f97316', reviewing: '#2563eb', closed: '#16a34a',
}

export default function RiskPanel({ projectId, onUpdate }: { projectId: string; onUpdate?: () => void }) {
  const [items, setItems] = useState<RO[]>([])
  const [form, setForm] = useState<Omit<RO, 'id'>>(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [sortType, setSortType] = useState<'all' | 'risk' | 'opportunity'>('all')
  // 필터
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [progressFilter, setProgressFilter] = useState<string>('all')
  // 정렬 — 컬럼 클릭 토글 (같은 컬럼 재클릭 시 방향 뒤집기)
  type SortKey = 'code' | 'category' | 'subCategory' | 'content' | 'proposedCost' | 'confirmedCost' | 'progress' | 'proposedAt'
  const [sortKey, setSortKey] = useState<SortKey>('code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  // 행 클릭 → 상세 모달
  const [detailItem, setDetailItem] = useState<RO | null>(null)

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/risks`)
    if (res.ok) setItems(await res.json())
  }

  useEffect(() => { load() }, [projectId])

  async function save() {
    if (!form.category || !form.content) return
    if (editId) {
      await fetch(`/api/projects/${projectId}/risks/${editId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
    } else {
      await fetch(`/api/projects/${projectId}/risks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
    }
    setForm(EMPTY); setEditId(null); setShowForm(false); load(); onUpdate?.()
  }

  async function del(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/projects/${projectId}/risks/${id}`, { method: 'DELETE' })
    load(); onUpdate?.()
  }

  function startEdit(item: RO) {
    setForm({ type: item.type, category: item.category, content: item.content, impactType: item.impactType,
      impactDays: item.impactDays, impactCost: item.impactCost, probability: item.probability,
      response: item.response ?? '', owner: item.owner ?? '', status: item.status })
    setEditId(item.id); setShowForm(true)
  }

  // 카테고리 옵션 목록 (현재 items 기반 자동 생성)
  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort()

  // 시계열 집계 — 월별 제안·확정 누적 (R&O proposedAt/confirmedAt 기준)
  const timeSeries = (() => {
    // 월 키 생성기
    const monthKey = (d: string | null | undefined) => d ? d.slice(0, 7) : null
    // 모든 월 수집
    const months = new Set<string>()
    for (const i of items) {
      const mp = monthKey(i.proposedAt); if (mp) months.add(mp)
      const mc = monthKey(i.confirmedAt); if (mc) months.add(mc)
    }
    if (months.size === 0) return null
    const sorted = Array.from(months).sort()
    // 월별 제안·확정 합산
    const proposedByMonth = new Map<string, number>()
    const confirmedByMonth = new Map<string, number>()
    for (const i of items) {
      const mp = monthKey(i.proposedAt)
      if (mp && i.proposedCost != null) proposedByMonth.set(mp, (proposedByMonth.get(mp) ?? 0) + i.proposedCost)
      const mc = monthKey(i.confirmedAt)
      if (mc && i.confirmedCost != null) confirmedByMonth.set(mc, (confirmedByMonth.get(mc) ?? 0) + i.confirmedCost)
    }
    // 누적 계산
    let propCum = 0, confCum = 0
    const points = sorted.map(m => {
      propCum += proposedByMonth.get(m) ?? 0
      confCum += confirmedByMonth.get(m) ?? 0
      return { month: m, proposed: propCum, confirmed: confCum, propMonth: proposedByMonth.get(m) ?? 0, confMonth: confirmedByMonth.get(m) ?? 0 }
    })
    return points
  })()

  // 공종별 집계 (그래프용) — 제안·확정 합 + 건수
  const byCategory = (() => {
    const m = new Map<string, { count: number; proposed: number; confirmed: number; confirmedCount: number }>()
    for (const i of items) {
      const k = i.category || '기타'
      const cur = m.get(k) ?? { count: 0, proposed: 0, confirmed: 0, confirmedCount: 0 }
      cur.count++
      cur.proposed += i.proposedCost ?? 0
      cur.confirmed += i.confirmedCost ?? 0
      if (i.progress === '확정') cur.confirmedCount++
      m.set(k, cur)
    }
    return Array.from(m.entries())
      .map(([name, v]) => ({ name, ...v, achievement: v.proposed !== 0 ? v.confirmed / v.proposed : 0 }))
      .sort((a, b) => Math.abs(b.proposed) - Math.abs(a.proposed))
  })()
  const maxAbs = Math.max(1, ...byCategory.map(c => Math.max(Math.abs(c.proposed), Math.abs(c.confirmed))))

  // 1) type 필터  2) 공종 필터  3) 진행현황 필터  4) 검색
  const preFiltered = items.filter(i => {
    if (sortType !== 'all' && i.type !== sortType) return false
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false
    if (progressFilter !== 'all' && (i.progress ?? '') !== progressFilter) return false
    if (query) {
      const q = query.toLowerCase()
      const hay = [i.code, i.content, i.subCategory, i.proposer, i.note].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  // 5) 정렬
  function valueOf(i: RO, key: typeof sortKey): string | number {
    switch (key) {
      case 'code':          return i.code ?? ''
      case 'category':      return i.category ?? ''
      case 'subCategory':   return i.subCategory ?? ''
      case 'content':       return i.content ?? ''
      case 'proposedCost':  return i.proposedCost ?? 0
      case 'confirmedCost': return i.confirmedCost ?? 0
      case 'progress':      return i.progress ?? ''
      case 'proposedAt':    return i.proposedAt ?? ''
    }
  }
  const filtered = [...preFiltered].sort((a, b) => {
    const va = valueOf(a, sortKey)
    const vb = valueOf(b, sortKey)
    let cmp = 0
    if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
    else cmp = String(va).localeCompare(String(vb), 'ko-KR', { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  const risks = items.filter(i => i.type === 'risk')
  const opps  = items.filter(i => i.type === 'opportunity')
  const riskDays = risks.reduce((s, i) => s + (i.impactDays ?? 0), 0)
  const oppDays  = opps.reduce((s, i)  => s + (i.impactDays ?? 0), 0)
  // R&O 실무 집계 (백만원)
  const proposedSum = items.reduce((s, i) => s + (i.proposedCost ?? 0), 0)
  const confirmedSum = items.reduce((s, i) => s + (i.confirmedCost ?? 0), 0)
  const confirmedCount = items.filter(i => i.progress === '확정').length
  const inProgressCount = items.filter(i => i.progress === '진행').length

  // 임포트 상태
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImport(file: File, replace: boolean) {
    setImporting(true)
    setImportMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (replace) fd.append('replace', '1')
      const res = await fetch(`/api/projects/${projectId}/rno/import`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? '임포트 실패')
      setImportMsg(`✅ ${data.totalRows}건 임포트 (생성 ${data.created} / 업데이트 ${data.updated})`)
      await load()
      onUpdate?.()
    } catch (e: unknown) {
      setImportMsg(`❌ ${(e as Error).message}`)
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleExport() {
    window.location.href = `/api/projects/${projectId}/rno/export`
  }

  return (
    <div className="space-y-4">
      {/* KPI 카드 — R&O 실무 중심 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1 text-blue-600"><TrendingUp size={16} /><span className="text-xs font-semibold text-gray-500">총 R&O</span></div>
          <p className="text-2xl font-bold text-gray-900">{items.length}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
          <p className="text-xs text-gray-400 mt-0.5">확정 {confirmedCount} · 진행 {inProgressCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1 text-emerald-600"><TrendingUp size={16} /><span className="text-xs font-semibold text-gray-500">제안 절감 합</span></div>
          <p className="text-2xl font-bold text-emerald-700">{Math.round(proposedSum).toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-1">백만</span></p>
          <p className="text-xs text-gray-400 mt-0.5">전 공종 누계</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1 text-blue-700"><CheckCircle2 size={16} /><span className="text-xs font-semibold text-gray-500">확정 절감 합</span></div>
          <p className="text-2xl font-bold text-blue-700">{Math.round(confirmedSum).toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-1">백만</span></p>
          <p className="text-xs text-gray-400 mt-0.5">제안 대비 {proposedSum !== 0 ? Math.round(confirmedSum / proposedSum * 100) : '-'}%</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1 text-orange-600"><AlertTriangle size={16} /><span className="text-xs font-semibold text-gray-500">레거시 리스크</span></div>
          <p className="text-2xl font-bold text-gray-900">{risks.length}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
          <p className="text-xs text-gray-400 mt-0.5">공기영향 +{riskDays.toFixed(1)}일</p>
        </div>
      </div>

      {/* 시계열 누적 차트 — 월별 제안·확정 진행 추이 */}
      {timeSeries && timeSeries.length > 0 && (
        <RnoTimeChart points={timeSeries} />
      )}

      {/* 공종별 절감 차트 — 엑셀 '3.공종별절감' 재현 */}
      {byCategory.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-bold text-gray-800">공종별 절감 현황</h3>
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-emerald-200" /> 제안</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-emerald-600" /> 확정</span>
              <span className="text-gray-400">(단위: 백만원)</span>
            </div>
          </div>
          <div className="space-y-1">
            {byCategory.map(c => {
              const propW = Math.min(100, (Math.abs(c.proposed) / maxAbs) * 100)
              const confW = Math.min(100, (Math.abs(c.confirmed) / maxAbs) * 100)
              const pct = Math.round(c.achievement * 100)
              return (
                <button
                  key={c.name}
                  onClick={() => setCategoryFilter(c.name === categoryFilter ? 'all' : c.name)}
                  className={`w-full grid grid-cols-[72px_1fr_90px] sm:grid-cols-[96px_1fr_110px] gap-2 items-center py-1 px-1 rounded text-left hover:bg-gray-50 ${categoryFilter === c.name ? 'bg-blue-50 ring-1 ring-blue-300' : ''}`}
                  title={`${c.name} · ${c.count}건 · 클릭하면 해당 공종으로 필터`}
                >
                  <span className="text-xs font-semibold text-gray-700 truncate">
                    {c.name}
                    <span className="text-[10px] text-gray-400 ml-1">{c.count}</span>
                  </span>
                  {/* 2단 막대: 회색 제안 위에 녹색 확정 */}
                  <div className="relative h-4 bg-gray-100 rounded-sm">
                    <div className="absolute inset-y-0 left-0 rounded-sm bg-emerald-200" style={{ width: `${propW}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-sm bg-emerald-600" style={{ width: `${confW}%` }} />
                  </div>
                  <div className="text-[10px] text-right text-gray-600 font-mono tabular-nums">
                    <div>
                      <span className="text-gray-700 font-semibold">{Math.round(c.confirmed).toLocaleString()}</span>
                      <span className="text-gray-400"> / {Math.round(c.proposed).toLocaleString()}</span>
                    </div>
                    <div className={pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-gray-400'}>
                      {c.proposed !== 0 ? `달성 ${pct}%` : '—'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-3">※ 공종 바 클릭 시 해당 공종만 필터됨 · 다시 클릭하면 해제</p>
        </div>
      )}

      {/* 1열: 검색 + type 탭 + 엑셀 버튼 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 검색창 */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="NO·내용·세부·제안사·비고 검색"
              className="w-56 sm:w-72 pl-7 pr-7 h-9 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-700">
                <X size={11} />
              </button>
            )}
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['all','risk','opportunity'] as const).map(t => (
              <button key={t} onClick={() => setSortType(t)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${sortType === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t === 'all' ? '전체' : t === 'risk' ? '리스크' : '기회'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 엑셀 임포트 — 실무 양식 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (!f) return
              const replace = confirm(`"${f.name}" 임포트\n\n[확인] 기존 R&O 전체 삭제 후 교체 (replace)\n[취소] code+rev 기준 병합 (merge)`)
              handleImport(f, replace)
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-xs font-semibold hover:border-gray-400 disabled:opacity-50"
            title="엑셀 파일(.xlsx)로 R&O 일괄 임포트"
          >
            {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            엑셀 임포트
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-xs font-semibold hover:border-gray-400"
            title="현재 R&O를 (주)동양 건설부문 양식 엑셀로 다운로드"
          >
            <Download size={12} /> 엑셀 익스포트
          </button>
          <button onClick={() => { setForm(EMPTY); setEditId(null); setShowForm(true) }}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2563eb] text-white rounded-lg text-sm font-semibold hover:bg-[#1d4ed8]">
            <Plus size={14} /> 항목 추가
          </button>
        </div>
      </div>
      {importMsg && (
        <div className={`text-xs rounded-lg p-2 border ${importMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {importMsg}
        </div>
      )}

      {/* 2열: 공종·진행현황 필터 + 활성 필터 리셋 */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-gray-400 font-semibold">필터</span>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="h-8 px-2 border border-gray-200 rounded-md bg-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">전체 공종</option>
          {categories.map(c => (<option key={c} value={c}>{c}</option>))}
        </select>
        <select
          value={progressFilter}
          onChange={e => setProgressFilter(e.target.value)}
          className="h-8 px-2 border border-gray-200 rounded-md bg-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">전체 진행</option>
          <option value="진행">진행</option>
          <option value="확정">확정</option>
          <option value="미반영">미반영</option>
          <option value="재검토">재검토</option>
          <option value="">미지정</option>
        </select>
        <span className="text-gray-400">
          {filtered.length}건 {filtered.length !== items.length && `/ 전체 ${items.length}건`}
        </span>
        {(query || categoryFilter !== 'all' || progressFilter !== 'all' || sortType !== 'all') && (
          <button
            onClick={() => { setQuery(''); setCategoryFilter('all'); setProgressFilter('all'); setSortType('all') }}
            className="text-gray-500 hover:text-gray-900 underline ml-auto"
          >필터 초기화</button>
        )}
      </div>

      {/* 폼 */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
          <h4 className="text-sm font-bold text-gray-800">{editId ? '항목 수정' : '새 항목 추가'}</h4>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-semibold">구분</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="risk">리스크</option>
                <option value="opportunity">기회</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">공종</label>
              <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="예) 골조공사" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">영향 유형</label>
              <select value={form.impactType} onChange={e => setForm(p => ({ ...p, impactType: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="schedule">공기</option>
                <option value="cost">원가</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">
                {form.impactType === 'schedule' ? '영향 일수' : '영향 금액(만원)'}
              </label>
              <input type="number"
                value={form.impactType === 'schedule' ? (form.impactDays ?? '') : (form.impactCost ?? '')}
                onChange={e => {
                  const v = e.target.value === '' ? null : Number(e.target.value)
                  setForm(p => form.impactType === 'schedule' ? { ...p, impactDays: v } : { ...p, impactCost: v })
                }}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-semibold">내용</label>
            <input value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="리스크/기회 내용을 입력하세요" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-semibold">확률 ({form.probability}%)</label>
              <input type="range" min={0} max={100} step={5} value={form.probability}
                onChange={e => setForm(p => ({ ...p, probability: Number(e.target.value) }))}
                className="mt-1 w-full accent-[#2563eb]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">담당자</label>
              <input value={form.owner ?? ''} onChange={e => setForm(p => ({ ...p, owner: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">상태</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="identified">식별</option>
                <option value="reviewing">검토중</option>
                <option value="closed">완료</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">대응방안</label>
              <input value={form.response ?? ''} onChange={e => setForm(p => ({ ...p, response: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setEditId(null) }}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={save}
              className="px-4 py-2 text-sm font-semibold bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8]">저장</button>
          </div>
        </div>
      )}

      {/* 테이블 — 엑셀 양식과 동일한 컬럼 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
            <tr>
              {([
                { label: 'NO',         key: 'code' as SortKey },
                { label: '공종',       key: 'category' as SortKey },
                { label: '세부',       key: 'subCategory' as SortKey },
                { label: '내용',       key: 'content' as SortKey },
                { label: '제안(백만)', key: 'proposedCost' as SortKey, numeric: true },
                { label: '확정(백만)', key: 'confirmedCost' as SortKey, numeric: true },
                { label: '진행',       key: 'progress' as SortKey },
                { label: '설계반영',   key: null },
                { label: '제안일',     key: 'proposedAt' as SortKey },
                { label: '담당자',     key: null },
                { label: '상태',       key: null },
                { label: '',           key: null },
              ] as const).map((h,i) => {
                const sortable = !!h.key
                const active = sortable && sortKey === h.key
                return (
                  <th key={i}
                    onClick={sortable ? () => toggleSort(h.key as SortKey) : undefined}
                    className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap select-none ${sortable ? 'cursor-pointer hover:text-gray-900' : ''} ${active ? 'text-gray-900' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {h.label}
                      {sortable && (
                        active
                          ? (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)
                          : <ArrowUpDown size={10} className="text-gray-300" />
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={12} className="text-center py-10 text-gray-400 text-sm">
                항목이 없습니다. 상단 &apos;엑셀 임포트&apos;로 실무 R&O 파일을 올리거나 &apos;항목 추가&apos;로 수동 입력하세요.
              </td></tr>
            )}
            {filtered.map(item => {
              const PROGRESS_COLOR: Record<string, string> = {
                '확정': 'bg-emerald-100 text-emerald-700',
                '진행': 'bg-blue-100 text-blue-700',
                '미반영': 'bg-gray-100 text-gray-500',
                '재검토': 'bg-amber-100 text-amber-700',
              }
              return (
              <tr
                key={item.id}
                onClick={() => setDetailItem(item)}
                className="border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer"
              >
                <td className="px-3 py-2 font-mono text-[11px] text-gray-700 whitespace-nowrap">
                  {item.code ?? <span className="text-gray-300">—</span>}
                  {item.rev != null && item.rev !== 0 && <span className="ml-1 text-blue-500">·r{item.rev}</span>}
                </td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.category}</td>
                <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{item.subCategory ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2 text-gray-900 max-w-[320px]">
                  <div className="truncate" title={item.content}>{item.content}</div>
                  {item.attachments && item.attachments.length > 0 && (
                    <div className="text-[10px] text-blue-600 mt-0.5">📎 첨부 {item.attachments.length}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-mono text-gray-700">
                  {item.proposedCost != null ? Math.round(item.proposedCost).toLocaleString() : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-mono font-semibold">
                  {item.confirmedCost != null ? <span className={item.confirmedCost < 0 ? 'text-emerald-700' : 'text-gray-700'}>{Math.round(item.confirmedCost).toLocaleString()}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {item.progress ? (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${PROGRESS_COLOR[item.progress] ?? 'bg-gray-100 text-gray-500'}`}>
                      {item.progress}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap text-gray-500">{item.designApplied ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{item.proposedAt ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">{item.proposer || item.owner || <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: STATUS_COLOR[item.status] + '20', color: STATUS_COLOR[item.status] }}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </td>
                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(item)} title="간단 편집" className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={13} /></button>
                    <button onClick={() => del(item.id)} title="삭제" className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* 상세 모달 */}
      {detailItem && (
        <RODetailModal
          item={detailItem}
          projectId={projectId}
          onClose={() => setDetailItem(null)}
          onSaved={async () => { await load(); onUpdate?.() }}
          onDeleted={async () => { setDetailItem(null); await load(); onUpdate?.() }}
        />
      )}
    </div>
  )
}

// ─────────────────────────── 시계열 차트 (경량 SVG) ───────────────────────────
interface TimePoint {
  month: string      // YYYY-MM
  proposed: number   // 제안 누적 (백만, 음수 정상)
  confirmed: number  // 확정 누적
  propMonth: number  // 해당 월 제안
  confMonth: number  // 해당 월 확정
}

function RnoTimeChart({ points }: { points: TimePoint[] }) {
  const [hover, setHover] = useState<number | null>(null)

  // 보정 — 1개월뿐이면 앞에 더미 0점 추가해 라인 보이게
  const data = points.length === 1
    ? [{ month: '시작', proposed: 0, confirmed: 0, propMonth: 0, confMonth: 0 }, ...points]
    : points

  const W = 720, H = 220
  const PAD = { l: 60, r: 20, t: 20, b: 36 }
  const chartW = W - PAD.l - PAD.r
  const chartH = H - PAD.t - PAD.b

  // Y: 음수 범위 — abs 최대값 기준 (절감은 음수로 저장됨)
  const absMax = Math.max(1, ...data.flatMap(p => [Math.abs(p.proposed), Math.abs(p.confirmed)]))
  // y(0) 상단, y(-absMax) 하단 (절감이 내려가는 느낌)
  const yOf = (v: number) => PAD.t + ((-v) / absMax) * chartH  // v가 음수면 positive y

  const xOf = (i: number) => PAD.l + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW)

  const pathProposed = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(p.proposed)}`).join(' ')
  const pathConfirmed = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(p.confirmed)}`).join(' ')
  const areaProposed = `${pathProposed} L ${xOf(data.length - 1)} ${PAD.t} L ${xOf(0)} ${PAD.t} Z`

  const yTicks = 4
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => -(absMax * i / yTicks))

  const last = data[data.length - 1]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800">절감 진행 추이</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">R&O 제안일·확정일 기준 · 월별 누적 (단위 백만원)</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-400" /> 제안 누적 {Math.round(last.proposed).toLocaleString()}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-700" /> 확정 누적 {Math.round(last.confirmed).toLocaleString()}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ minWidth: 480 }}
          className="block"
          onMouseLeave={() => setHover(null)}
        >
          {/* Y 그리드 */}
          {tickVals.map((v, i) => (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={yOf(v)} y2={yOf(v)} stroke="#f1f5f9" strokeWidth={1} />
              <text x={PAD.l - 6} y={yOf(v) + 3} fontSize={10} textAnchor="end" fill="#94a3b8">
                {Math.round(v).toLocaleString()}
              </text>
            </g>
          ))}

          {/* X 라벨 */}
          {data.map((p, i) => (
            <g key={i}>
              {/* 일부만 렌더 (겹침 방지) — 4개 이하는 전부, 이상은 샘플링 */}
              {(data.length <= 6 || i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) && (
                <text x={xOf(i)} y={H - PAD.b + 14} fontSize={10} textAnchor="middle" fill="#94a3b8">
                  {p.month}
                </text>
              )}
            </g>
          ))}

          {/* 제안 영역(연한) */}
          <path d={areaProposed} fill="#6ee7b7" fillOpacity="0.15" />
          {/* 제안 라인 */}
          <path d={pathProposed} fill="none" stroke="#34d399" strokeWidth={2} />
          {/* 확정 라인 */}
          <path d={pathConfirmed} fill="none" stroke="#047857" strokeWidth={2.5} />

          {/* 포인트 + 호버 영역 */}
          {data.map((p, i) => (
            <g key={`pt-${i}`}>
              <circle cx={xOf(i)} cy={yOf(p.proposed)} r={3} fill="#34d399" />
              <circle cx={xOf(i)} cy={yOf(p.confirmed)} r={3.5} fill="#047857" />
              <rect
                x={xOf(i) - 16}
                y={PAD.t}
                width={32}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                style={{ cursor: 'default' }}
              />
            </g>
          ))}

          {/* 호버 툴팁 */}
          {hover != null && data[hover] && (
            <g pointerEvents="none">
              <line x1={xOf(hover)} x2={xOf(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#cbd5e1" strokeDasharray="2 2" />
              {(() => {
                const p = data[hover]
                const tx = Math.min(W - 130, Math.max(PAD.l, xOf(hover) + 8))
                return (
                  <g transform={`translate(${tx}, ${PAD.t + 8})`}>
                    <rect width={128} height={60} rx={6} fill="#0f172a" fillOpacity={0.92} />
                    <text x={8} y={15} fontSize={10} fill="#e2e8f0" fontWeight={600}>{p.month}</text>
                    <text x={8} y={30} fontSize={10} fill="#6ee7b7">
                      제안 누적 {Math.round(p.proposed).toLocaleString()}
                    </text>
                    <text x={8} y={44} fontSize={10} fill="#34d399">
                      확정 누적 {Math.round(p.confirmed).toLocaleString()}
                    </text>
                    <text x={8} y={56} fontSize={9} fill="#94a3b8">
                      (월 +제안 {Math.round(p.propMonth)} / 확정 {Math.round(p.confMonth)})
                    </text>
                  </g>
                )
              })()}
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}

// ─────────────────────────── R&O 상세 모달 ───────────────────────────
function RODetailModal({
  item, projectId, onClose, onSaved, onDeleted,
}: {
  item: RO
  projectId: string
  onClose: () => void
  onSaved: () => void | Promise<void>
  onDeleted: () => void | Promise<void>
}) {
  const [draft, setDraft] = useState<RO>(item)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // item 바뀌면 draft 갱신
  useEffect(() => { setDraft(item); setDirty(false) }, [item.id])

  function set<K extends keyof RO>(k: K, v: RO[K]) {
    setDraft(p => ({ ...p, [k]: v }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/risks/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: draft.content,
          category: draft.category,
          subCategory: draft.subCategory ?? null,
          proposer: draft.proposer ?? null,
          proposedAt: draft.proposedAt ?? null,
          proposedCost: draft.proposedCost ?? null,
          confirmedCost: draft.confirmedCost ?? null,
          progress: draft.progress ?? null,
          confirmedAt: draft.confirmedAt ?? null,
          expectedAt: draft.expectedAt ?? null,
          designApplied: draft.designApplied ?? null,
          note: draft.note ?? null,
        }),
      })
      if (!res.ok) { alert('저장 실패'); return }
      await onSaved()
      setDirty(false)
    } finally { setSaving(false) }
  }

  async function del() {
    if (!confirm(`"${item.code ?? ''} ${item.content.slice(0, 30)}" 삭제하시겠습니까?`)) return
    await fetch(`/api/projects/${projectId}/risks/${item.id}`, { method: 'DELETE' })
    await onDeleted()
  }

  const PROGRESS_OPTS = ['진행', '확정', '미반영', '재검토']
  const DESIGN_OPTS = ['Yes', 'No', '-']

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-auto"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-4 flex flex-col max-h-[calc(100vh-2rem)]"
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {draft.code && (
                <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {draft.code}{draft.rev != null && draft.rev !== 0 ? ` · r${draft.rev}` : ''}
                </span>
              )}
              <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                {draft.category}{draft.subCategory ? ` · ${draft.subCategory}` : ''}
              </span>
              {draft.progress && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                  draft.progress === '확정' ? 'bg-emerald-100 text-emerald-700'
                  : draft.progress === '진행' ? 'bg-blue-100 text-blue-700'
                  : draft.progress === '미반영' ? 'bg-gray-100 text-gray-500'
                  : 'bg-amber-100 text-amber-700'
                }`}>{draft.progress}</span>
              )}
            </div>
            <h3 className="text-base font-bold text-gray-900 leading-tight">
              R&O 상세
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 p-1 -mr-1 -mt-1" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        {/* 본문 — 스크롤 */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {/* 내용 (메인) */}
          <div>
            <label className="text-[11px] text-gray-500 font-semibold mb-1 block">내용</label>
            <textarea
              value={draft.content}
              onChange={e => set('content', e.target.value)}
              rows={Math.min(Math.max(3, draft.content.split(/\n|\r/).length + 1), 10)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* 공종 2열 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="공종">
              <input value={draft.category} onChange={e => set('category', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="세부공종">
              <input value={draft.subCategory ?? ''} onChange={e => set('subCategory', e.target.value || null)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="예) 골조, 공조, 위생" />
            </Field>
          </div>

          {/* 금액 (백만원) */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="제안금액 (백만)">
              <input type="number" inputMode="decimal"
                value={draft.proposedCost ?? ''}
                onChange={e => set('proposedCost', e.target.value === '' ? null : Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-right" />
            </Field>
            <Field label="확정금액 (백만)">
              <input type="number" inputMode="decimal"
                value={draft.confirmedCost ?? ''}
                onChange={e => set('confirmedCost', e.target.value === '' ? null : Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-right" />
            </Field>
          </div>

          {/* 상태·설계 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="진행현황">
              <select value={draft.progress ?? ''} onChange={e => set('progress', e.target.value || null)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">—</option>
                {PROGRESS_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="설계반영">
              <select value={draft.designApplied ?? ''} onChange={e => set('designApplied', e.target.value || null)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">—</option>
                {DESIGN_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
          </div>

          {/* 날짜 */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="제안일자">
              <input type="date" value={draft.proposedAt ?? ''} onChange={e => set('proposedAt', e.target.value || null)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="확정일자">
              <input type="date" value={draft.confirmedAt ?? ''} onChange={e => set('confirmedAt', e.target.value || null)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="예정완료일">
              <input type="date" value={draft.expectedAt ?? ''} onChange={e => set('expectedAt', e.target.value || null)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </Field>
          </div>

          {/* 담당 */}
          <Field label="제안사 / 담당">
            <input value={draft.proposer ?? ''} onChange={e => set('proposer', e.target.value || null)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="예) 동양, 김현재" />
          </Field>

          {/* 비고 */}
          <Field label="비고">
            <textarea value={draft.note ?? ''} onChange={e => set('note', e.target.value || null)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="추가 메모 (선택)" />
          </Field>

          {/* 첨부파일 — 도면·사진·PDF */}
          <RODetailAttachments
            projectId={projectId}
            rid={item.id}
            attachments={draft.attachments ?? []}
            onChange={list => setDraft(p => ({ ...p, attachments: list }))}
          />
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button onClick={del} className="text-xs text-red-600 hover:text-red-800 px-3 py-2 font-semibold">
            <Trash2 size={12} className="inline mr-1" /> 삭제
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm text-gray-600 px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-100">
              닫기
            </button>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="text-sm font-semibold px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
            >
              {saving ? '저장 중...' : dirty ? '저장' : '변경 없음'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-gray-500 font-semibold mb-1 block">{label}</label>
      {children}
    </div>
  )
}

// ─────────────────────────── 첨부파일 업로드·미리보기 ───────────────────────────
type Attachment = NonNullable<RO['attachments']>[number]

function RODetailAttachments({
  projectId, rid, attachments, onChange,
}: {
  projectId: string
  rid: string
  attachments: Attachment[]
  onChange: (list: Attachment[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Attachment | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(files: FileList | File[]) {
    const arr = Array.from(files)
    if (arr.length === 0) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      for (const f of arr) fd.append('file', f)
      const res = await fetch(`/api/projects/${projectId}/risks/${rid}/attachments`, {
        method: 'POST', body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? '업로드 실패')
      onChange(data.attachments)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove(name: string) {
    if (!confirm(`"${name}" 삭제하시겠습니까?`)) return
    const res = await fetch(
      `/api/projects/${projectId}/risks/${rid}/attachments?name=${encodeURIComponent(name)}`,
      { method: 'DELETE' }
    )
    const data = await res.json()
    if (res.ok) onChange(data.attachments)
  }

  function isImage(a: Attachment) { return a.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(a.name) }
  function isPdf(a: Attachment) { return a.type === 'application/pdf' || /\.pdf$/i.test(a.name) }
  function iconFor(a: Attachment) {
    if (isImage(a)) return '🖼'
    if (isPdf(a)) return '📄'
    if (/\.(dwg|dxf)$/i.test(a.name)) return '📐'
    return '📎'
  }
  function fmtBytes(n: number) {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
    return `${(n / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="pt-2 border-t border-dashed border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] text-gray-500 font-semibold">
          첨부파일 {attachments.length > 0 && <span className="text-gray-400">({attachments.length})</span>}
        </label>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.dwg,.dxf"
          className="hidden"
          onChange={e => e.target.files && upload(e.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 disabled:opacity-40"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? '업로드 중...' : '파일 추가'}
        </button>
      </div>
      {error && (
        <div className="text-[11px] bg-red-50 text-red-700 border border-red-200 rounded p-2 mb-2">{error}</div>
      )}
      {attachments.length === 0 ? (
        <div
          onDragOver={e => { e.preventDefault() }}
          onDrop={e => { e.preventDefault(); if (e.dataTransfer.files) upload(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          className="text-center py-6 border border-dashed border-gray-300 rounded-lg text-[11px] text-gray-400 cursor-pointer hover:bg-gray-50"
        >
          도면·사진·PDF 드래그하거나 클릭
          <div className="text-[10px] text-gray-300 mt-0.5">이미지·PDF는 미리보기, DWG은 다운로드만</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {attachments.map(a => {
            const img = isImage(a)
            return (
              <div key={a.name} className="relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                <button
                  type="button"
                  onClick={() => isImage(a) || isPdf(a) ? setPreview(a) : window.open(a.url, '_blank')}
                  className="block w-full text-left"
                  title={a.name}
                >
                  <div className="aspect-[4/3] flex items-center justify-center bg-gray-100 overflow-hidden">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-3xl">{iconFor(a)}</div>
                    )}
                  </div>
                  <div className="p-1.5">
                    <div className="text-[11px] font-medium text-gray-800 truncate">{a.name}</div>
                    <div className="text-[9px] text-gray-400">{fmtBytes(a.size)}</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => remove(a.name)}
                  title="삭제"
                  className="absolute top-1 right-1 p-1 rounded-full bg-white/90 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                >
                  <X size={10} />
                </button>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="border border-dashed border-gray-300 rounded-lg text-[11px] text-gray-400 hover:bg-gray-50 flex items-center justify-center aspect-[4/3]"
          >
            <div className="flex flex-col items-center">
              <Upload size={14} />
              <span className="mt-1">추가</span>
            </div>
          </button>
        </div>
      )}

      {/* 미리보기 오버레이 */}
      {preview && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <button
            onClick={() => setPreview(null)}
            className="absolute top-3 right-3 text-white/80 hover:text-white bg-black/40 rounded-full p-2"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
          {isImage(preview) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.url} alt={preview.name}
              className="max-w-[92vw] max-h-[90vh] object-contain shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          ) : isPdf(preview) ? (
            <iframe
              src={preview.url}
              title={preview.name}
              className="bg-white rounded w-[min(95vw,900px)] h-[min(90vh,1100px)]"
              onClick={e => e.stopPropagation()}
            />
          ) : null}
          <a
            href={preview.url}
            download={preview.name}
            onClick={e => e.stopPropagation()}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white bg-black/50 px-3 py-1.5 rounded-full hover:bg-black/70 no-underline"
          >
            ⬇ 원본 다운로드 ({preview.name})
          </a>
        </div>
      )}
    </div>
  )
}
