'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, ChevronRight, Play, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import type { CPMSummary, CPMResult } from '@/lib/types'

interface Project {
  id: string
  name: string
  client?: string
  location?: string
  type?: string
  ground: number
  basement: number
  bldgArea?: number
  startDate?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  '가설공사': 'bg-gray-600',
  '토공사': 'bg-yellow-700',
  '기초공사': 'bg-orange-700',
  '지하골조': 'bg-purple-700',
  '저층부골조': 'bg-indigo-700',
  '전이층': 'bg-pink-700',
  '지상골조': 'bg-blue-700',
  '지붕/옥탑': 'bg-teal-700',
  '외부마감': 'bg-green-700',
  '내부마감': 'bg-emerald-700',
  '설비공사': 'bg-cyan-700',
  '준공': 'bg-red-700',
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [cpmResult, setCpmResult] = useState<CPMSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(data => {
        setProject(data)
        setLoading(false)
      })
      .catch(() => { setLoading(false) })
  }, [id])

  async function calculate() {
    setCalculating(true)
    const res = await fetch(`/api/projects/${id}/calculate`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setCpmResult(data)
    }
    setCalculating(false)
  }

  function toggleCategory(cat: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  if (loading) return <div className="p-8 text-gray-500">불러오는 중...</div>
  if (!project) return <div className="p-8 text-gray-500">프로젝트를 찾을 수 없습니다.</div>

  // CPM 결과를 카테고리별로 그룹화
  const byCategory = cpmResult
    ? groupBy(cpmResult.tasks, t => t.category)
    : null

  // 날짜 계산 (착공일 기준)
  const startDate = project.startDate ? new Date(project.startDate) : null

  function addDays(date: Date, days: number) {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d.toLocaleDateString('ko-KR')
  }

  return (
    <div className="p-8">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition-colors">대시보드</Link>
        <ChevronRight size={14} />
        <span className="text-white truncate">{project.name}</span>
      </div>

      {/* 프로젝트 헤더 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center">
              <Building2 size={24} className="text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{project.name}</h1>
                {project.type && (
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                    {project.type}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                {project.location && <span>{project.location}</span>}
                <span>지상 {project.ground}F / 지하 {project.basement}F</span>
                {project.bldgArea && <span>연면적 {project.bldgArea.toLocaleString()}m²</span>}
              </div>
            </div>
          </div>

          <button
            onClick={calculate}
            disabled={calculating}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors flex-shrink-0"
          >
            <Play size={15} />
            {calculating ? 'WBS 생성 및 CPM 계산 중...' : 'WBS 생성 및 공기산정'}
          </button>
        </div>
      </div>

      {/* CPM 결과가 없을 때 */}
      {!cpmResult && !calculating && (
        <div className="text-center py-16 text-gray-600">
          <Clock size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-gray-500 mb-2">아직 공기산정이 실행되지 않았습니다</p>
          <p className="text-sm text-gray-600">위의 &apos;WBS 생성 및 공기산정&apos; 버튼을 눌러주세요</p>
        </div>
      )}

      {calculating && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-400">WBS 자동 생성 및 CPM 계산 중...</p>
        </div>
      )}

      {/* CPM 결과 */}
      {cpmResult && (
        <div className="space-y-6">
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard
              label="총 공사 기간"
              value={cpmResult.totalDuration.toString()}
              unit="일"
              sub={
                startDate
                  ? `착공 ${project.startDate} → 준공 ${addDays(startDate, cpmResult.totalDuration)}`
                  : `${Math.round(cpmResult.totalDuration / 30)}개월 소요`
              }
              highlight
            />
            <SummaryCard
              label="총 공종 수"
              value={cpmResult.tasks.length.toString()}
              unit="개"
              sub="WBS 자동 생성"
            />
            <SummaryCard
              label="크리티컬 패스"
              value={cpmResult.tasks.filter(t => t.isCritical).length.toString()}
              unit="개 공종"
              sub="여유시간 0일"
            />
          </div>

          {/* 크리티컬 패스 경로 */}
          <div className="bg-gray-900 border border-red-900/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-400" />
              <h3 className="text-sm font-semibold text-red-300">크리티컬 패스 (Critical Path)</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cpmResult.criticalPath.map((name, i) => (
                <span key={i} className="text-xs bg-red-950 border border-red-900 text-red-300 px-2.5 py-1 rounded-full">
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* WBS / CPM 테이블 (카테고리별 접기/펼치기) */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">WBS 공정 목록</h3>
              <p className="text-xs text-gray-500 mt-0.5">카테고리를 클릭하면 상세 공종을 확인할 수 있습니다</p>
            </div>

            {/* 테이블 헤더 */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_60px] gap-x-3 px-5 py-2.5 text-xs text-gray-500 border-b border-gray-800 bg-gray-950">
              <span>공종명</span>
              <span className="text-right">기간(일)</span>
              <span className="text-right">ES</span>
              <span className="text-right">EF</span>
              <span className="text-right">LS</span>
              <span className="text-right">LF</span>
              <span className="text-right">TF</span>
              <span className="text-center">CP</span>
            </div>

            {byCategory && Object.entries(byCategory).map(([cat, tasks]) => {
              const expanded = expandedCategories.has(cat)
              const catColor = CATEGORY_COLORS[cat] ?? 'bg-gray-700'
              const criticalCount = tasks.filter(t => t.isCritical).length
              const totalDur = tasks.reduce((s, t) => s + t.duration, 0)

              return (
                <div key={cat}>
                  {/* 카테고리 헤더 (클릭으로 접기/펼치기) */}
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_60px] gap-x-3 px-5 py-3 text-sm hover:bg-gray-800/50 transition-colors border-b border-gray-800/50 text-left"
                  >
                    <span className="flex items-center gap-2 font-medium text-gray-200">
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span className={`inline-block w-2 h-2 rounded-full ${catColor}`} />
                      {cat}
                      <span className="text-xs text-gray-600 font-normal">{tasks.length}개</span>
                    </span>
                    <span className="text-right text-gray-500 text-xs">{totalDur}</span>
                    <span /><span /><span /><span />
                    <span className="text-right text-xs text-gray-600">
                      {criticalCount > 0 && <span className="text-red-400">CP {criticalCount}</span>}
                    </span>
                    <span />
                  </button>

                  {/* 태스크 목록 */}
                  {expanded && tasks.map(task => (
                    <TaskRow key={task.taskId} task={task} />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function TaskRow({ task }: { task: CPMResult }) {
  return (
    <div
      className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_60px] gap-x-3 px-5 py-2.5 text-xs border-b border-gray-800/30 ${
        task.isCritical ? 'bg-red-950/20 text-red-200' : 'text-gray-400'
      }`}
    >
      <span className="pl-6 truncate">{task.name}</span>
      <span className="text-right font-mono">{task.duration}</span>
      <span className="text-right font-mono">{task.ES}</span>
      <span className="text-right font-mono">{task.EF}</span>
      <span className="text-right font-mono">{task.LS}</span>
      <span className="text-right font-mono">{task.LF}</span>
      <span className={`text-right font-mono ${task.TF === 0 ? 'text-red-400 font-bold' : ''}`}>
        {task.TF}
      </span>
      <span className="text-center">
        {task.isCritical && <span className="text-red-400 font-bold">★</span>}
      </span>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  unit,
  sub,
  highlight,
}: {
  label: string
  value: string
  unit: string
  sub: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-xl p-5 border ${highlight ? 'bg-blue-900/20 border-blue-800' : 'bg-gray-900 border-gray-800'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${highlight ? 'text-blue-300' : 'text-white'}`}>
        {value}
        <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
      </p>
      <p className="text-xs text-gray-600 mt-1">{sub}</p>
    </div>
  )
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item)
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {} as Record<string, T[]>)
}
