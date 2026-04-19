'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Loader2, Play } from 'lucide-react'
import RiskPanel from '@/components/precon/RiskPanel'
import AccelerationPanel from '@/components/precon/AccelerationPanel'
import BaselineImportPanel from '@/components/precon/BaselineImportPanel'
import ScenarioDashboard from '@/components/precon/ScenarioDashboard'
import BaselineCompare from '@/components/precon/BaselineCompare'
import ProcessMapBoard from '@/components/precon/ProcessMapBoard'
import { SkeletonKpiGrid } from '@/components/common/Skeleton'
import type { CPMSummary } from '@/lib/types'

interface RO {
  id: string
  type: string
  category: string
  impactType: string
  impactDays: number | null
  probability: number
  status: string
}

interface Accel {
  id: string
  category: string
  method: string
  days: number
}

interface BTask {
  id: string
  name: string
  duration: number
  start: string | null
  finish: string | null
  level: number
}

interface ProjectInfo {
  startDate?: string
}

interface Props {
  projectId: string
}

export default function Stage2Page({ projectId }: Props) {
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [risks, setRisks] = useState<RO[]>([])
  const [accelerations, setAccelerations] = useState<Accel[]>([])
  const [baseline, setBaseline] = useState<BTask[]>([])
  const [cpmResult, setCpmResult] = useState<CPMSummary | null>(null)
  const [calculating, setCalculating] = useState(false)

  const loadRisks = useCallback(() => {
    fetch(`/api/projects/${projectId}/risks`)
      .then(r => r.json())
      .then((data: RO[]) => setRisks(data))
      .catch(() => {})
  }, [projectId])

  const loadAccelerations = useCallback(() => {
    fetch(`/api/projects/${projectId}/accelerations`)
      .then(r => r.json())
      .then((data: Accel[]) => setAccelerations(data))
      .catch(() => {})
  }, [projectId])

  const loadBaseline = useCallback(() => {
    fetch(`/api/projects/${projectId}/baseline`)
      .then(r => r.json())
      .then((data: BTask[]) => setBaseline(data))
      .catch(() => {})
  }, [projectId])

  const runCpm = useCallback(async () => {
    setCalculating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'cp' }),
      })
      if (res.ok) setCpmResult(await res.json())
    } finally {
      setCalculating(false)
    }
  }, [projectId])

  // 프로젝트 기본정보 + 리스크/단축/베이스라인/CPM 병렬 로드
  useEffect(() => {
    fetch(`/api/projects/${projectId}`).then(r => r.json()).then(setProject).catch(() => {})
    loadRisks()
    loadAccelerations()
    loadBaseline()
    runCpm()
  }, [projectId, loadRisks, loadAccelerations, loadBaseline, runCpm])

  return (
    <div className="overflow-auto h-full">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* ── 시나리오 대시보드 (최상단) ─────────────────────── */}
        <div>
          {!cpmResult && !calculating && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                2단계 시나리오 비교를 보려면 CPM을 먼저 계산하세요 (1단계 WBS 사용).
              </p>
              <button
                onClick={runCpm}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                <Play size={13} /> CPM 계산 실행
              </button>
            </div>
          )}
          {calculating && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 size={12} className="animate-spin text-blue-600" />
                CPM 계산 중...
              </div>
              <SkeletonKpiGrid count={4} />
            </div>
          )}
          {cpmResult && (
            <ScenarioDashboard
              projectId={projectId}
              cpmResult={cpmResult}
              risks={risks}
              accelerations={accelerations}
              startDate={project?.startDate}
            />
          )}
        </div>

        {/* 섹션 1: R&O — 풀폭 실무 테이블 */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-green-600 rounded-full inline-block" />
            리스크 & 기회 (R&O)
          </h2>
          <RiskPanel projectId={projectId} onUpdate={loadRisks} />
        </div>

        {/* 섹션 2: 공기단축 시나리오 — CPM 연동 활성화 */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-600 rounded-full inline-block" />
            공기단축 시나리오
            {cpmResult && (
              <span className="text-xs font-normal text-gray-400 ml-2">
                · CP 공종 {cpmResult.tasks.filter(t => t.isCritical).length}개와 자동 매칭
              </span>
            )}
          </h2>
          <AccelerationPanel projectId={projectId} cpmResult={cpmResult} />
        </div>

        {/* 섹션 3: 베이스라인 비교 — baseline + CPM 둘 다 있을 때만 */}
        {baseline.length > 0 && cpmResult && (
          <div>
            <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-purple-600 rounded-full inline-block" />
              베이스라인 vs 현재 CPM
            </h2>
            <BaselineCompare cpmResult={cpmResult} baseline={baseline} />
          </div>
        )}

        {/* 섹션 4: 프로세스맵 (협력사 스윔레인 + 포스트잇 보드) */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-orange-500 rounded-full inline-block" />
            프로세스맵 (협력사 Pull Planning)
            <span className="text-xs font-normal text-gray-400 ml-2">
              · 협력사별 레인, 드래그로 순서·기간 조정, 카드 간 선후행 연결
            </span>
          </h2>
          <ProcessMapBoard projectId={projectId} startDate={project?.startDate} />
        </div>

        {/* 섹션 5: MSP 베이스라인 임포트 */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-purple-600 rounded-full inline-block" />
            MSP 베이스라인 임포트
          </h2>
          <BaselineImportPanel projectId={projectId} onUpdate={loadBaseline} />
        </div>

      </div>
    </div>
  )
}
