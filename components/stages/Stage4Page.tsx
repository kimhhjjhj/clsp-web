'use client'

import React, { useState } from 'react'
import ProgressDashboard from '@/components/analytics/ProgressDashboard'
import ExecutionAnalytics from '@/components/analytics/ExecutionAnalytics'

interface Props {
  projectId: string
  projectName?: string
}

const TABS = [
  { id: 'analytics', label: '실적 분석' },
  { id: 'progress', label: '주간 보고 · S-Curve' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function Stage4Page({ projectId, projectName }: Props) {
  const [tab, setTab] = useState<TabId>('analytics')

  return (
    <div className="h-full overflow-auto">
      {/* 탭 헤더 — 반투명 + 구분선 강조 */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-slate-200 px-6 pt-1">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-3 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? 'text-violet-700'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-violet-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="p-5">
        {tab === 'analytics' && <ExecutionAnalytics projectId={projectId} />}
        {tab === 'progress' && (
          <ProgressDashboard
            projectId={projectId}
            projectName={projectName}
            cpmResult={null}
          />
        )}
      </div>
    </div>
  )
}
