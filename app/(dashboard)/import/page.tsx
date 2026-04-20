'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ChevronRight,
  Calendar, Users, Building2, Loader2, ArrowLeft, FileText, ClipboardList, MessageSquare,
  Package, Truck, Layers,
} from 'lucide-react'
import type { PajuParseResult, SiteData } from '@/lib/excel-import/paju-parser'
import type { SangbongParseResult } from '@/lib/excel-import/sangbong-parser'
import PageHeader from '@/components/common/PageHeader'
import MobileNotice from '@/components/common/MobileNotice'

type Format = 'paju' | 'sangbong'
interface Project { id: string; name: string }
interface SiteTarget {
  siteLabel: '1' | '2'
  mode: 'create' | 'existing'
  projectId?: string
  projectName: string
}
interface SingleTarget {
  mode: 'create' | 'existing'
  projectId?: string
  projectName: string
}

export default function ImportPage() {
  const router = useRouter()
  const [format, setFormat] = useState<Format>('paju')
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [committing, setCommitting] = useState(false)

  // 파주 결과
  const [pajuResult, setPajuResult] = useState<PajuParseResult | null>(null)
  const [pajuTargets, setPajuTargets] = useState<SiteTarget[]>([])
  const [pajuCommitted, setPajuCommitted] = useState<{
    results: { siteLabel: string; projectId: string; projectName: string; created: number; skipped: number }[]
  } | null>(null)

  // 상봉동 결과
  const [sangbongResult, setSangbongResult] = useState<SangbongParseResult | null>(null)
  const [sangbongTarget, setSangbongTarget] = useState<SingleTarget>({
    mode: 'create',
    projectName: '',
  })
  const [sangbongCommitted, setSangbongCommitted] = useState<{
    projectId: string
    projectName: string
    created: number
    updated: number
    totalDays: number
  } | null>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => setProjects(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  function resetAll() {
    setPajuResult(null)
    setPajuTargets([])
    setPajuCommitted(null)
    setSangbongResult(null)
    setSangbongTarget({ mode: 'create', projectName: '' })
    setSangbongCommitted(null)
    setFile(null)
    setError(null)
  }

  async function handleUpload() {
    if (!file) return
    setParsing(true)
    setError(null)
    setPajuResult(null)
    setSangbongResult(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('format', format)
    const res = await fetch('/api/projects/import/excel', { method: 'POST', body: fd })
    setParsing(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? '업로드 실패')
      return
    }
    const json = await res.json()
    if (format === 'paju') {
      const r = json as PajuParseResult
      setPajuResult(r)
      setPajuTargets(
        r.sites.map(s => ({
          siteLabel: s.siteLabel,
          mode: 'create',
          projectName: `${r.projectNameGuess} SITE ${s.siteLabel}`,
        })),
      )
    } else {
      const r = json as SangbongParseResult
      setSangbongResult(r)
      setSangbongTarget({ mode: 'create', projectName: r.projectNameGuess })
    }
  }

  async function handleCommitPaju() {
    if (!pajuResult) return
    setCommitting(true)
    setError(null)
    const res = await fetch('/api/projects/import/excel/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parseResult: pajuResult, targets: pajuTargets }),
    })
    setCommitting(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? '저장 실패')
      return
    }
    setPajuCommitted(await res.json())
  }

  async function handleCommitSangbong() {
    if (!sangbongResult) return
    setCommitting(true)
    setError(null)
    const res = await fetch('/api/projects/import/excel/commit-sangbong', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parseResult: sangbongResult, target: sangbongTarget }),
    })
    setCommitting(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? '저장 실패')
      return
    }
    setSangbongCommitted(await res.json())
  }

  function updatePajuTarget(label: '1' | '2', patch: Partial<SiteTarget>) {
    setPajuTargets(prev => prev.map(t => (t.siteLabel === label ? { ...t, ...patch } : t)))
  }

  const committed = pajuCommitted || sangbongCommitted
  const hasResult = !!(pajuResult || sangbongResult)

  return (
    <div className="min-h-full bg-gray-50">
      <PageHeader
        icon={Upload}
        title="엑셀 일보 임포트"
        subtitle="파주/상봉 포맷을 자동 파싱 → DailyReport 대량 생성"
        accent="pink"
      />

      <MobileNotice
        feature="엑셀 일괄 임포트는 파일 업로드·매핑 확인이 필요해 데스크톱 권장합니다."
        dismissKey="import"
      />

      <div className="px-4 sm:px-6 py-6 max-w-5xl">
        {/* 커밋 완료 */}
        {pajuCommitted && (
          <div className="bg-white border border-emerald-200 rounded-2xl p-6 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={24} className="text-emerald-500" />
              <h2 className="text-lg font-bold text-gray-900">임포트 완료 (파주 포맷)</h2>
            </div>
            <div className="space-y-2">
              {pajuCommitted.results.map(r => (
                <div key={r.siteLabel} className="flex items-center justify-between bg-emerald-50 rounded-lg px-4 py-3">
                  <div>
                    <span className="text-xs font-bold text-emerald-700">SITE {r.siteLabel}</span>
                    <Link href={`/projects/${r.projectId}`} className="ml-2 text-sm font-semibold text-gray-900 hover:text-emerald-700">
                      {r.projectName} →
                    </Link>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-mono font-bold text-emerald-700">{r.created}건</span> 신규 ·{' '}
                    <span className="font-mono">{r.skipped}건</span> 업데이트
                  </div>
                </div>
              ))}
            </div>
            <BottomActions onReset={resetAll} onHome={() => router.push('/')} />
          </div>
        )}

        {sangbongCommitted && (
          <div className="bg-white border border-emerald-200 rounded-2xl p-6 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={24} className="text-emerald-500" />
              <h2 className="text-lg font-bold text-gray-900">임포트 완료 (상봉동 포맷)</h2>
            </div>
            <div className="bg-emerald-50 rounded-lg px-4 py-3 flex items-center justify-between">
              <Link href={`/projects/${sangbongCommitted.projectId}`} className="text-sm font-semibold text-gray-900 hover:text-emerald-700">
                {sangbongCommitted.projectName} →
              </Link>
              <div className="text-sm text-gray-600">
                <span className="font-mono font-bold text-emerald-700">{sangbongCommitted.created}건</span> 신규 ·{' '}
                <span className="font-mono">{sangbongCommitted.updated}건</span> 업데이트 ({sangbongCommitted.totalDays}일)
              </div>
            </div>
            <BottomActions onReset={resetAll} onHome={() => router.push('/')} />
          </div>
        )}

        {/* 업로드 단계 */}
        {!committed && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">1. 엑셀 포맷 선택</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <FormatCard
                selected={format === 'paju'}
                onClick={() => { setFormat('paju'); resetAll() }}
                title="파주 스튜디오형 (갑지+데이터시트)"
                subtitle="탭이 많고 투입인원/자재/장비가 별도 시트로 분리"
                desc="SITE 1, SITE 2 각 데이터 시트에서 추출 → 두 개 프로젝트 생성"
              />
              <FormatCard
                selected={format === 'sangbong'}
                onClick={() => { setFormat('sangbong'); resetAll() }}
                title="상봉동형 (누적형)"
                subtitle="한 시트에 100행짜리 일보 블록이 세로로 반복"
                desc="공사일보 블록을 자동 감지 → 단일 프로젝트 생성"
              />
            </div>

            <h2 className="text-base font-bold text-gray-900 mb-4">2. 엑셀 파일 업로드</h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="w-full sm:flex-1 border-2 border-dashed border-gray-200 rounded-xl p-4 sm:p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <div className="flex items-center gap-3 min-w-0">
                  <FileSpreadsheet size={28} className="text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-700 truncate">
                      {file ? file.name : '파일 선택 (.xlsx, .xls)'}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '최대 30MB'}
                    </div>
                  </div>
                </div>
              </label>
              <button
                onClick={handleUpload}
                disabled={!file || parsing}
                className="w-full sm:w-auto h-11 sm:h-auto px-5 sm:py-3 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {parsing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {parsing ? '파싱 중...' : '업로드 & 파싱'}
              </button>
            </div>
            {error && (
              <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertTriangle size={14} /> {error}
              </div>
            )}
          </div>
        )}

        {/* 파주 결과 */}
        {pajuResult && !pajuCommitted && (
          <PajuResultPanel
            result={pajuResult}
            targets={pajuTargets}
            projects={projects}
            onUpdate={updatePajuTarget}
            onCommit={handleCommitPaju}
            onCancel={resetAll}
            committing={committing}
            error={error}
          />
        )}

        {/* 상봉동 결과 */}
        {sangbongResult && !sangbongCommitted && (
          <SangbongResultPanel
            result={sangbongResult}
            target={sangbongTarget}
            projects={projects}
            onChange={setSangbongTarget}
            onCommit={handleCommitSangbong}
            onCancel={resetAll}
            committing={committing}
            error={error}
          />
        )}
      </div>
    </div>
  )
}

// ─── 포맷 선택 카드 ──────────────────────
function FormatCard({
  selected,
  onClick,
  title,
  subtitle,
  desc,
}: {
  selected: boolean
  onClick: () => void
  title: string
  subtitle: string
  desc: string
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-xl border-2 transition-colors ${
        selected ? 'border-blue-500 bg-blue-50/60' : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="flex items-start gap-2">
        <Layers size={16} className={selected ? 'text-blue-600' : 'text-gray-400'} />
        <div>
          <div className={`text-sm font-bold ${selected ? 'text-blue-700' : 'text-gray-900'}`}>
            {title}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">{subtitle}</div>
          <div className="text-[10px] text-gray-400 mt-1.5">{desc}</div>
        </div>
      </div>
    </button>
  )
}

// ─── 파주 결과 패널 ──────────────────────
function PajuResultPanel({
  result,
  targets,
  projects,
  onUpdate,
  onCommit,
  onCancel,
  committing,
  error,
}: {
  result: PajuParseResult
  targets: SiteTarget[]
  projects: Project[]
  onUpdate: (label: '1' | '2', patch: Partial<SiteTarget>) => void
  onCommit: () => void
  onCancel: () => void
  committing: boolean
  error: string | null
}) {
  return (
    <>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-5">
        <h2 className="text-base font-bold text-gray-900 mb-1">3. 파싱 결과 프리뷰</h2>
        <p className="text-xs text-gray-500 mb-4">
          추정 프로젝트명: <b>{result.projectNameGuess}</b> · 일기 {result.weather.length}건
        </p>
        {result.warnings.length > 0 && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            <div className="text-xs font-semibold text-orange-700 mb-1">경고</div>
            <ul className="text-xs text-orange-600 space-y-0.5">
              {result.warnings.map((w, i) => <li key={i}>· {w}</li>)}
            </ul>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {result.sites.map(site => <SitePreviewCard key={site.siteLabel} site={site} />)}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-5">
        <h2 className="text-base font-bold text-gray-900 mb-1">4. 프로젝트 매핑</h2>
        <p className="text-xs text-gray-500 mb-4">SITE별로 새 프로젝트 생성 또는 기존 프로젝트에 병합</p>
        <div className="space-y-3">
          {targets.map(t => (
            <div key={t.siteLabel} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                  SITE {t.siteLabel}
                </span>
              </div>
              <div className="flex gap-2 mb-3">
                <TargetModeButton active={t.mode === 'create'} onClick={() => onUpdate(t.siteLabel, { mode: 'create' })} label="새 프로젝트 생성" />
                <TargetModeButton active={t.mode === 'existing'} onClick={() => onUpdate(t.siteLabel, { mode: 'existing' })} label="기존 프로젝트에 병합" />
              </div>
              {t.mode === 'create' ? (
                <input
                  value={t.projectName}
                  onChange={e => onUpdate(t.siteLabel, { projectName: e.target.value })}
                  placeholder="프로젝트명"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              ) : (
                <select
                  value={t.projectId ?? ''}
                  onChange={e => onUpdate(t.siteLabel, { projectId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">프로젝트 선택...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>

      <CommitButtons
        onCancel={onCancel}
        onCommit={onCommit}
        committing={committing}
        disabled={targets.some(t => (t.mode === 'create' ? !t.projectName : !t.projectId))}
        error={error}
      />
    </>
  )
}

function SitePreviewCard({ site }: { site: SiteData }) {
  const totalManpower = site.manpower.reduce((s, d) => s + d.totalCount, 0)
  const activeTrades = new Set<string>()
  site.manpower.forEach(d => d.entries.forEach(e => activeTrades.add(e.trade)))
  const workDoneDays = Object.keys(site.workDone).length
  const workPlanDays = Object.keys(site.workPlan).length
  const notesDays = Object.keys(site.notes).length
  const materialDays = Object.keys(site.materials).length
  const equipmentDays = Object.keys(site.equipment).length
  const materialTotal = Object.values(site.materials).reduce((s, arr) => s + arr.length, 0)
  const equipmentTotal = Object.values(site.equipment).reduce((s, arr) => s + arr.length, 0)
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/40">
      <div className="flex items-center gap-2 mb-3">
        <Building2 size={16} className="text-blue-600" />
        <h3 className="text-sm font-bold text-gray-900">SITE {site.siteLabel}</h3>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar size={12} />
          <span>{site.dateRange ? `${site.dateRange.start} ~ ${site.dateRange.end}` : '날짜 없음'}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Users size={12} />
          <span>투입 <b className="font-mono">{site.totalDays}</b>일 · 누적 <b className="font-mono">{totalManpower.toLocaleString()}</b>명 · {activeTrades.size}개 공종</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <FileText size={12} /><span>금일 작업 <b className="font-mono">{workDoneDays}</b>일</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <ClipboardList size={12} /><span>명일 계획 <b className="font-mono">{workPlanDays}</b>일</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <MessageSquare size={12} /><span>특기사항 <b className="font-mono">{notesDays}</b>일</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Package size={12} /><span>자재 <b className="font-mono">{materialDays}</b>일 · <b className="font-mono">{materialTotal}</b>건</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Truck size={12} /><span>장비 <b className="font-mono">{equipmentDays}</b>일 · <b className="font-mono">{equipmentTotal}</b>건</span>
        </div>
      </div>
    </div>
  )
}

// ─── 상봉동 결과 패널 ──────────────────────
function SangbongResultPanel({
  result,
  target,
  projects,
  onChange,
  onCommit,
  onCancel,
  committing,
  error,
}: {
  result: SangbongParseResult
  target: SingleTarget
  projects: Project[]
  onChange: (t: SingleTarget) => void
  onCommit: () => void
  onCancel: () => void
  committing: boolean
  error: string | null
}) {
  const totalManpower = result.days.reduce(
    (s, d) => s + d.manpower.reduce((s2, m) => s2 + m.today, 0),
    0,
  )
  const activeTrades = new Set<string>()
  const activeCompanies = new Set<string>()
  result.days.forEach(d => d.manpower.forEach(m => {
    activeTrades.add(m.trade)
    if (m.company) activeCompanies.add(m.company)
  }))
  const workDoneDays = result.days.filter(d => d.workToday.length > 0).length
  const workPlanDays = result.days.filter(d => d.workTomorrow.length > 0).length
  const notesDays = result.days.filter(d => d.notes.length > 0).length

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-5">
        <h2 className="text-base font-bold text-gray-900 mb-1">3. 파싱 결과 프리뷰</h2>
        <p className="text-xs text-gray-500 mb-4">
          추정 프로젝트명: <b>{result.projectNameGuess}</b> · 총 {result.totalBlocks}개 블록 감지
        </p>
        {result.warnings.length > 0 && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            <div className="text-xs font-semibold text-orange-700 mb-1">경고</div>
            <ul className="text-xs text-orange-600 space-y-0.5">
              {result.warnings.map((w, i) => <li key={i}>· {w}</li>)}
            </ul>
          </div>
        )}

        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/40">
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900">단일 프로젝트 데이터</h3>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar size={12} />
              <span>{result.dateRange ? `${result.dateRange.start} ~ ${result.dateRange.end}` : '날짜 없음'} · <b className="font-mono">{result.days.length}</b>일</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Users size={12} />
              <span>누적 <b className="font-mono">{totalManpower.toLocaleString()}</b>명 · {activeTrades.size}개 공종 · <b>{activeCompanies.size}</b>개 업체</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <FileText size={12} /><span>금일 작업 <b className="font-mono">{workDoneDays}</b>일</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <ClipboardList size={12} /><span>명일 계획 <b className="font-mono">{workPlanDays}</b>일</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <MessageSquare size={12} /><span>특기사항 <b className="font-mono">{notesDays}</b>일</span>
            </div>
          </div>

          {/* 최근 3일 샘플 */}
          {result.days.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-blue-600">
                최근 3일 투입 샘플
              </summary>
              <div className="mt-2 space-y-1 text-xs bg-white border border-gray-200 rounded-lg p-2 max-h-48 overflow-y-auto">
                {result.days.slice(-3).reverse().map((d, i) => (
                  <div key={i} className="border-b border-gray-100 last:border-0 pb-1 last:pb-0">
                    <div className="font-mono font-semibold text-gray-700">
                      {d.date} {d.weather ?? ''} · {d.manpower.filter(m => m.today > 0).length}개 업체 · 금일 총 {d.manpower.reduce((s, m) => s + m.today, 0)}명
                    </div>
                    <div className="text-gray-500 text-[10px] mt-0.5">
                      {d.manpower.filter(m => m.today > 0).slice(0, 5).map(m => `${m.trade}:${m.today}`).join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-5">
        <h2 className="text-base font-bold text-gray-900 mb-1">4. 프로젝트 매핑</h2>
        <p className="text-xs text-gray-500 mb-4">새 프로젝트 생성 또는 기존 프로젝트에 병합</p>
        <div className="border border-gray-200 rounded-xl p-4">
          <div className="flex gap-2 mb-3">
            <TargetModeButton active={target.mode === 'create'} onClick={() => onChange({ ...target, mode: 'create' })} label="새 프로젝트 생성" />
            <TargetModeButton active={target.mode === 'existing'} onClick={() => onChange({ ...target, mode: 'existing' })} label="기존 프로젝트에 병합" />
          </div>
          {target.mode === 'create' ? (
            <input
              value={target.projectName}
              onChange={e => onChange({ ...target, projectName: e.target.value })}
              placeholder="프로젝트명"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          ) : (
            <select
              value={target.projectId ?? ''}
              onChange={e => onChange({ ...target, projectId: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">프로젝트 선택...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <CommitButtons
        onCancel={onCancel}
        onCommit={onCommit}
        committing={committing}
        disabled={target.mode === 'create' ? !target.projectName : !target.projectId}
        error={error}
      />
    </>
  )
}

// ─── 공용 ──────────────────────
function TargetModeButton({
  active, onClick, label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
        active ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
}

function CommitButtons({
  onCancel, onCommit, committing, disabled, error,
}: {
  onCancel: () => void
  onCommit: () => void
  committing: boolean
  disabled: boolean
  error: string | null
}) {
  return (
    <>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          취소
        </button>
        <button
          onClick={onCommit}
          disabled={committing || disabled}
          className="px-5 py-2.5 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {committing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {committing ? '저장 중...' : 'DB에 저장'}
        </button>
      </div>
      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}
    </>
  )
}

function BottomActions({ onReset, onHome }: { onReset: () => void; onHome: () => void }) {
  return (
    <div className="mt-5 flex gap-2">
      <button
        onClick={onReset}
        className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
      >
        다른 파일 임포트
      </button>
      <button
        onClick={onHome}
        className="px-4 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800"
      >
        프로젝트 목록으로
      </button>
    </div>
  )
}
