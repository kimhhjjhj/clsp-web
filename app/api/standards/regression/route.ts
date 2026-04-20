// F18. 자사 회귀식 — 조회 / 재학습
import { NextRequest, NextResponse } from 'next/server'
import { retrainRegression, loadRegression } from '@/lib/engine/internal-regression'

// GET /api/standards/regression?type=공동주택
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'all'
  const data = await loadRegression(type)
  if (!data) return NextResponse.json({ error: `No regression for type=${type}` }, { status: 404 })
  return NextResponse.json(data)
}

// POST /api/standards/regression/retrain — body: { type?: string }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { type?: string }
  const type = body.type ?? 'all'
  const result = await retrainRegression(type)
  if (!result) {
    return NextResponse.json({
      error: '재학습 실패 — actualDuration 보유 프로젝트가 2개 미만입니다',
      type,
    }, { status: 400 })
  }
  return NextResponse.json(result)
}
