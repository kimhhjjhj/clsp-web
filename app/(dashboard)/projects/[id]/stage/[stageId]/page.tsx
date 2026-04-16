'use client'

import React, { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Stage1Page from '@/components/stages/Stage1Page'
import Stage2Page from '@/components/stages/Stage2Page'
import Stage3Page from '@/components/stages/Stage3Page'
import Stage4Page from '@/components/stages/Stage4Page'

interface Project {
  id: string
  name: string
  client?: string
  location?: string
  ground?: number
  basement?: number
  bldgArea?: number
  startDate?: string
}

const STAGE_LABELS: Record<string, string> = {
  '1': '1단계 · 개략공기 검토',
  '2': '2단계 · 프리콘',
  '3': '3단계 · 시공 관리',
  '4': '4단계 · 분석 & 준공',
}

const STAGE_COLORS: Record<string, string> = {
  '1': '#2563eb',
  '2': '#16a34a',
  '3': '#ea580c',
  '4': '#7c3aed',
}

export default function StagePage({
  params,
}: {
  params: Promise<{ id: string; stageId: string }>
}) {
  const { id, stageId } = use(params)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(data => { setProject(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const prevStage = String(Number(stageId) - 1)
  const nextStage = String(Number(stageId) + 1)
  const hasPrev = Number(stageId) > 1
  const hasNext = Number(stageId) < 4
  const color = STAGE_COLORS[stageId] ?? '#64748b'

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div
        className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: `${color} transparent transparent transparent` }}
      />
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 상단 네비게이션 바 */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white"
      >
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${id}`}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ChevronLeft size={15} />
            {project?.name ?? '프로젝트'}
          </Link>
          <span className="text-gray-300">|</span>
          <span
            className="text-sm font-semibold"
            style={{ color }}
          >
            {STAGE_LABELS[stageId] ?? `${stageId}단계`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasPrev && (
            <Link
              href={`/projects/${id}/stage/${prevStage}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
            >
              <ChevronLeft size={12} />
              이전 단계
            </Link>
          )}
          {hasNext && (
            <Link
              href={`/projects/${id}/stage/${nextStage}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-opacity hover:opacity-80"
              style={{ background: color }}
            >
              다음 단계
              <ChevronRight size={12} />
            </Link>
          )}
        </div>
      </div>

      {/* 단계별 콘텐츠 */}
      <div className="flex-1 overflow-hidden">
        {stageId === '1' && <Stage1Page projectId={id} project={project} />}
        {stageId === '2' && <Stage2Page projectId={id} />}
        {stageId === '3' && <Stage3Page projectId={id} />}
        {stageId === '4' && <Stage4Page projectId={id} projectName={project?.name} />}
        {!['1','2','3','4'].includes(stageId) && (
          <div className="flex items-center justify-center h-full text-gray-400">
            존재하지 않는 단계입니다.
          </div>
        )}
      </div>
    </div>
  )
}
