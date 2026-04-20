'use client'

import React, { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { BarChart3, TrendingUp, GitBranch, Zap } from 'lucide-react'
import ProgressDashboard from '@/components/analytics/ProgressDashboard'
import ExecutionAnalytics from '@/components/analytics/ExecutionAnalytics'
import CpmTimeline from '@/components/analytics/CpmTimeline'
import ProductivityVariancePanel from '@/components/analytics/ProductivityVariancePanel'
import { StageTabs, type StageTabDef } from '@/components/common/StageTabs'

interface Props {
  projectId: string
  projectName?: string
}

type TabId = 'analytics' | 'progress' | 'cpm-timeline' | 'prod-variance'

export default function Stage4Page(props: Props) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">불러오는 중…</div>}>
      <Inner {...props} />
    </Suspense>
  )
}

function Inner({ projectId, projectName }: Props) {
  const sp = useSearchParams()
  const initial = ((sp?.get('tab') as TabId) || 'analytics')
  const [tab, setTab] = useState<TabId>(initial)

  const tabs: StageTabDef<TabId>[] = [
    { id: 'analytics', label: '실적 분석', icon: <BarChart3 size={14} />, hint: '공종·월·요일·날씨별 집계' },
    { id: 'progress',  label: 'S-Curve',  icon: <TrendingUp size={14} />, hint: '주간 보고 + 진행 곡선' },
    { id: 'cpm-timeline', label: 'CPM 타임라인', icon: <GitBranch size={14} />, hint: '스냅샷 히스토리 + 변동 diff' },
    { id: 'prod-variance', label: '생산성 편차',  icon: <Zap size={14} />, hint: '회사 표준 대비 일보 관측 z-score' },
  ]

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <StageTabs tabs={tabs} current={tab} onChange={setTab} />
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          {tab === 'analytics' && <ExecutionAnalytics projectId={projectId} />}
          {tab === 'progress' && (
            <ProgressDashboard
              projectId={projectId}
              projectName={projectName}
              cpmResult={null}
            />
          )}
          {tab === 'cpm-timeline' && <CpmTimeline projectId={projectId} />}
          {tab === 'prod-variance' && <ProductivityVariancePanel projectId={projectId} />}
        </div>
      </div>
    </div>
  )
}
