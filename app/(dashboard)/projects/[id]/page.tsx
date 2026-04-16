'use client'

import React, { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BarChart3, ShieldCheck, TrendingUp, Pencil, CheckCircle2, ArrowRight, HardHat,
  ChevronLeft,
} from 'lucide-react'

interface Project {
  id: string
  name: string
  client?: string
  location?: string
  type?: string
  ground?: number
  basement?: number
  bldgArea?: number
  startDate?: string
}

interface StageStatus {
  stage1: { hasCpm: boolean; totalDuration: number | null }
  stage2: { riskCount: number; hasBaseline: boolean }
  stage3: { latestRate: number | null; lastReportDate: string | null }
  stage4: { weeklyReportCount: number }
}

export default function StageHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [status, setStatus] = useState<StageStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then(r => r.json()),
      fetch(`/api/projects/${id}/stage-status`).then(r => r.json()),
    ])
      .then(([proj, stat]) => {
        setProject(proj)
        setStatus(stat)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!project) return (
    <div className="flex items-center justify-center h-full text-gray-400">
      프로젝트를 찾을 수 없습니다.
    </div>
  )

  const stage1Done = status?.stage1.hasCpm ?? false
  const stage2Done = (status?.stage2.riskCount ?? 0) > 0 || (status?.stage2.hasBaseline ?? false)
  const stage3Done = status?.stage3.latestRate !== null
  const stage4Done = (status?.stage4.weeklyReportCount ?? 0) > 0

  const cards = [
    {
      stageId: 1,
      color: '#2563eb',
      bg: '#eff6ff',
      borderColor: stage1Done ? '#2563eb' : '#e2e8f0',
      icon: <BarChart3 size={28} color={stage1Done ? '#2563eb' : '#94a3b8'} />,
      title: '1단계 · 개략공기 검토',
      badge: stage1Done
        ? `총공기 ${Math.round(status?.stage1.totalDuration ?? 0)}일 · CPM 완료`
        : '미시작',
      badgeColor: stage1Done ? '#2563eb' : '#94a3b8',
      badgeBg: stage1Done ? '#dbeafe' : '#f1f5f9',
      desc: 'WBS 자동생성, CPM, 간트차트, 몬테카를로 시뮬레이션',
      done: stage1Done,
    },
    {
      stageId: 2,
      color: '#16a34a',
      bg: '#f0fdf4',
      borderColor: stage2Done ? '#16a34a' : '#e2e8f0',
      icon: <ShieldCheck size={28} color={stage2Done ? '#16a34a' : '#94a3b8'} />,
      title: '2단계 · 프리콘 (Pre-Construction)',
      badge: status
        ? `R&O ${status.stage2.riskCount}건 · 베이스라인 ${status.stage2.hasBaseline ? '저장됨' : '미등록'}`
        : '미시작',
      badgeColor: stage2Done ? '#16a34a' : '#94a3b8',
      badgeBg: stage2Done ? '#dcfce7' : '#f1f5f9',
      desc: '리스크&기회 관리, 공기단축 시나리오, MSP 베이스라인',
      done: stage2Done,
    },
    {
      stageId: 3,
      color: '#ea580c',
      bg: '#fff7ed',
      borderColor: stage3Done ? '#ea580c' : '#e2e8f0',
      icon: <HardHat size={28} color={stage3Done ? '#ea580c' : '#94a3b8'} />,
      title: '3단계 · 시공 관리',
      badge: status?.stage3.latestRate !== null && status?.stage3.latestRate !== undefined
        ? `최신 실적률 ${Math.round(status.stage3.latestRate)}% · 마지막 일보 ${status.stage3.lastReportDate ?? '없음'}`
        : '데이터 없음',
      badgeColor: stage3Done ? '#ea580c' : '#94a3b8',
      badgeBg: stage3Done ? '#ffedd5' : '#f1f5f9',
      desc: '주간 실적공정 입력, 일일 작업일보, S-Curve',
      done: stage3Done,
    },
    {
      stageId: 4,
      color: '#7c3aed',
      bg: '#faf5ff',
      borderColor: stage4Done ? '#7c3aed' : '#e2e8f0',
      icon: <TrendingUp size={28} color={stage4Done ? '#7c3aed' : '#94a3b8'} />,
      title: '4단계 · 분석 & 준공',
      badge: `주간보고서 ${status?.stage4.weeklyReportCount ?? 0}주차 데이터`,
      badgeColor: stage4Done ? '#7c3aed' : '#94a3b8',
      badgeBg: stage4Done ? '#ede9fe' : '#f1f5f9',
      desc: '공정률 분석, 편차 히스토그램, 주간보고서 PDF',
      done: stage4Done,
    },
  ]

  return (
    <div className="min-h-full bg-gray-50">
      {/* 상단 헤더 */}
      <div style={{ background: '#0f172a' }} className="px-8 pt-5 pb-6">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={15} />
            프로젝트 목록
          </Link>
        </div>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">{project.name}</h1>
            <div className="flex items-center gap-3 text-sm text-slate-400 flex-wrap">
              {project.client && <span>{project.client}</span>}
              {project.location && (
                <>
                  <span className="text-slate-600">·</span>
                  <span>{project.location}</span>
                </>
              )}
              {(project.ground !== undefined || project.basement !== undefined) && (
                <>
                  <span className="text-slate-600">·</span>
                  <span>
                    지상 {project.ground ?? 0}F / 지하 {project.basement ?? 0}F
                  </span>
                </>
              )}
              {project.bldgArea && (
                <>
                  <span className="text-slate-600">·</span>
                  <span>연면적 {project.bldgArea.toLocaleString()}m²</span>
                </>
              )}
            </div>
          </div>
          <Link
            href={`/projects/${id}/edit`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 border border-slate-600 rounded-lg hover:border-slate-400 hover:text-white transition-colors"
          >
            <Pencil size={13} />
            프로젝트 수정
          </Link>
        </div>
      </div>

      {/* 단계 카드 그리드 */}
      <div className="px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {cards.map((card) => (
            <div
              key={card.stageId}
              className="relative bg-white rounded-2xl p-6 shadow-sm cursor-pointer group transition-all hover:shadow-md"
              style={{
                border: `2px solid ${card.borderColor}`,
              }}
              onClick={() => router.push(`/projects/${id}/stage/${card.stageId}`)}
            >
              {/* 완료 체크 아이콘 */}
              {card.done && (
                <div className="absolute top-4 right-4">
                  <CheckCircle2 size={20} color={card.color} />
                </div>
              )}

              {/* 아이콘 + 배지 */}
              <div className="flex items-start gap-4 mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: card.bg }}
                >
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ color: card.badgeColor, background: card.badgeBg }}
                    >
                      {card.badge}
                    </span>
                  </div>
                </div>
              </div>

              {/* 제목 + 설명 */}
              <h2 className="text-base font-bold text-gray-900 mb-1.5">{card.title}</h2>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">{card.desc}</p>

              {/* 시작하기 버튼 */}
              <div
                className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors group-hover:gap-2.5"
                style={{ color: card.color }}
              >
                시작하기
                <ArrowRight size={14} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
