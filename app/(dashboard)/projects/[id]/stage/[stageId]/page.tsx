'use client'

import React, { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react'
import Stage2Page from '@/components/stages/Stage2Page'
import Stage3Page from '@/components/stages/Stage3Page'
import Stage4Page from '@/components/stages/Stage4Page'
import Stage1Redirect from '@/components/stages/Stage1Redirect'
import PageHeader from '@/components/common/PageHeader'
import { Skeleton } from '@/components/common/Skeleton'
import MobileNotice from '@/components/common/MobileNotice'

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

// 표시용 단계 번호 (URL 2/3/4 → 사용자 1/2/3)
const STAGE_LABELS: Record<string, { label: string; desc: string; color: string; displayN: string }> = {
  '1': { label: '개략공기 (이전 링크)', desc: '사업 초기 검토로 이전됨',       color: '#2563eb', displayN: '·' },
  '2': { label: '1단계 · 프리콘',       desc: '시나리오 · 프로세스맵',         color: '#16a34a', displayN: '1' },
  '3': { label: '2단계 · 시공관리',     desc: '일보 · 엑셀 임포트 · 사진',    color: '#ea580c', displayN: '2' },
  '4': { label: '3단계 · 분석·준공',    desc: '공종·위치·생산성 분석',        color: '#7c3aed', displayN: '3' },
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

  // URL 2/3/4 구간 내에서만 이전/다음 이동 (1은 사업 초기 검토로 이전됨)
  const prevStage = String(Number(stageId) - 1)
  const nextStage = String(Number(stageId) + 1)
  const hasPrev = Number(stageId) > 2
  const hasNext = Number(stageId) < 4
  const stageInfo = STAGE_LABELS[stageId]

  const stageNav = (
    <div className="flex items-center gap-1 py-2 overflow-x-auto">
      {/* URL stage 2/3/4만 노출 (1은 사업 초기 검토로 이전됨) */}
      {['2', '3', '4'].map(s => {
        const info = STAGE_LABELS[s]
        const active = s === stageId
        return (
          <Link
            key={s}
            href={`/projects/${id}/stage/${s}`}
            className={`relative flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-bold no-underline transition-colors ${
              active ? '' : 'text-slate-400 hover:text-white hover:bg-white font-semibold'
            }`}
            style={active ? { color: info.color } : undefined}
          >
            <span className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: active ? info.color : '#475569' }}
              />
              {info.label}
            </span>
            {active && (
              <span
                className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                style={{ background: info.color }}
              />
            )}
          </Link>
        )
      })}
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg text-white font-bold"
            style={{ background: stageInfo?.color ?? '#64748b' }}
          >
            {stageInfo?.displayN ?? stageId}
          </div>
        }
        title={project ? project.name : '프로젝트…'}
        subtitle={stageInfo?.desc ?? '공정 단계'}
        actions={
          <>
            {hasPrev && (
              <Link
                href={`/projects/${id}/stage/${prevStage}`}
                className="hidden sm:inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ChevronLeft size={12} /> 이전
              </Link>
            )}
            {hasNext ? (
              <Link
                href={`/projects/${id}/stage/${nextStage}`}
                className="inline-flex items-center gap-1 h-9 px-3 sm:px-4 rounded-lg text-white text-xs font-semibold transition-opacity hover:opacity-90 shadow-md"
                style={{ background: stageInfo?.color ?? '#64748b' }}
              >
                <span className="hidden sm:inline">다음 단계</span>
                <span className="sm:hidden">다음</span>
                <ChevronRight size={12} />
              </Link>
            ) : (
              <Link
                href={`/projects/${id}`}
                className="inline-flex items-center gap-1 h-9 px-3 sm:px-4 rounded-lg bg-white text-slate-900 text-xs font-semibold hover:bg-slate-100"
              >
                프로젝트로
              </Link>
            )}
          </>
        }
        tabs={stageNav}
      />

      {/* 모바일 안내 — Stage2(프로세스맵)는 좌우 분할 보드라 데스크톱 권장 */}
      {stageId === '2' && (
        <MobileNotice
          feature="2단계 프로세스맵은 드래그·스윔레인 보드라 데스크톱 권장합니다."
          dismissKey="stage2"
        />
      )}

      {/* 단계별 콘텐츠 */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          </div>
        ) : (
          <>
            {stageId === '1' && <Stage1Redirect projectId={id} />}
            {stageId === '2' && <Stage2Page projectId={id} />}
            {stageId === '3' && <Stage3Page projectId={id} />}
            {stageId === '4' && <Stage4Page projectId={id} projectName={project?.name} />}
            {!['1', '2', '3', '4'].includes(stageId) && (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                존재하지 않는 단계입니다.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
