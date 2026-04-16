'use client'

import React from 'react'
import ProgressDashboard from '@/components/analytics/ProgressDashboard'

interface Props {
  projectId: string
  projectName?: string
}

export default function Stage4Page({ projectId, projectName }: Props) {
  return (
    <div className="h-full overflow-auto bg-gray-50">
      <ProgressDashboard
        projectId={projectId}
        projectName={projectName}
        cpmResult={null}
      />
    </div>
  )
}
