'use client'

import { use } from 'react'
import DailyReportForm from '@/components/construction/DailyReportForm'

export default function NewDailyReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <DailyReportForm projectId={id} />
}
