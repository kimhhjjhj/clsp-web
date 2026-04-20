'use client'

import { use, useEffect, useState } from 'react'
import DailyReportForm, { DailyReportData, EMPTY_DATA } from '@/components/construction/DailyReportForm'
import { Skeleton, SkeletonKpiGrid, SkeletonTable } from '@/components/common/Skeleton'
import CommentThread from '@/components/collab/CommentThread'

export default function EditDailyReportPage({
  params,
}: {
  params: Promise<{ id: string; did: string }>
}) {
  const { id, did } = use(params)
  const [data, setData] = useState<DailyReportData | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${id}/daily-reports/${did}`)
      .then(r => r.json())
      .then(r => {
        setData({
          ...EMPTY_DATA,
          id: r.id,
          date: r.date,
          weather: r.weather ?? '맑음',
          tempMin: r.tempMin ?? null,
          tempMax: r.tempMax ?? null,
          manpower: r.manpower ?? [],
          equipmentList: r.equipmentList ?? [],
          materialList: r.materialList ?? [],
          workToday: r.workToday ?? { building: [], mep: [] },
          workTomorrow: r.workTomorrow ?? { building: [], mep: [] },
          notes: r.notes ?? null,
          signers: r.signers ?? {},
          photos: r.photos ?? [],
        })
      })
  }, [id, did])

  if (!data) {
    return (
      <div className="p-6 space-y-4 max-w-6xl">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <SkeletonKpiGrid count={4} />
        <Skeleton className="h-5 w-1/4 mt-4" />
        <SkeletonTable rows={6} cols={5} />
      </div>
    )
  }

  return (
    <>
      <DailyReportForm projectId={id} reportId={did} initialData={data} />
      <div className="px-4 sm:px-8 py-4 max-w-6xl">
        <CommentThread entityType="daily-report" entityId={did} title="일보 토론" />
      </div>
    </>
  )
}
