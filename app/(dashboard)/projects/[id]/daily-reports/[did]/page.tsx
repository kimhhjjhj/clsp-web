'use client'

import { use, useEffect, useState } from 'react'
import DailyReportForm, { DailyReportData, EMPTY_DATA } from '@/components/construction/DailyReportForm'

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
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <DailyReportForm projectId={id} reportId={did} initialData={data} />
}
