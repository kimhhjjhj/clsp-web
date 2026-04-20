// ═══════════════════════════════════════════════════════════
// F1. CPM Intelligence Timeline — 두 스냅샷 간 diff API
// GET /api/projects/:id/cpm-snapshots/diff?from=<id>&to=<id>
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { diffSnapshots } from '@/lib/engine/cpm-snapshot'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  if (!from || !to) {
    return NextResponse.json({ error: 'from, to query params required' }, { status: 400 })
  }
  const diff = await diffSnapshots(from, to)
  if (!diff) return NextResponse.json({ error: 'Snapshot(s) not found' }, { status: 404 })
  return NextResponse.json(diff)
}
