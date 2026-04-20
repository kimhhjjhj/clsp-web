// ═══════════════════════════════════════════════════════════
// F18. Internal Regression Calibration
//   준공 프로젝트 실적(actualDuration vs bldgArea)로 선형 회귀
//   y = slope*x + intercept 를 재학습하여 국토부 회귀와 비교.
//
// 국토부 회귀는 guideline-data/regression.ts 에 정의되어 있으며 불변.
// 이 모듈은 "자사 곡선"을 산출하고 overlay 용도로 제공.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

export interface LinearCoefficients {
  slope: number
  intercept: number
}

export interface RegressionTrainResult {
  projectType: string
  sampleSize: number
  coefficients: LinearCoefficients
  rSquared: number
  predict: (area: number) => number
}

function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number; r2: number } {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 }
  const meanX = points.reduce((s, p) => s + p.x, 0) / n
  const meanY = points.reduce((s, p) => s + p.y, 0) / n
  let num = 0, den = 0
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY)
    den += (p.x - meanX) ** 2
  }
  if (den === 0) return { slope: 0, intercept: meanY, r2: 0 }
  const slope = num / den
  const intercept = meanY - slope * meanX
  // R^2
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0)
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0)
  const r2 = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0
  return { slope, intercept, r2 }
}

/** 실적 있는 프로젝트로 회귀 재학습. type='all'이면 전 유형. */
export async function retrainRegression(projectType: string): Promise<RegressionTrainResult | null> {
  const where: { actualDuration: { not: null }; bldgArea: { not: null }; type?: string } = {
    actualDuration: { not: null },
    bldgArea: { not: null },
  }
  if (projectType !== 'all') where.type = projectType

  const rows = await prisma.project.findMany({
    where,
    select: { id: true, type: true, bldgArea: true, actualDuration: true },
  })
  const points = rows
    .filter(r => r.bldgArea! > 0 && r.actualDuration! > 0)
    .map(r => ({ x: r.bldgArea as number, y: r.actualDuration as number }))

  if (points.length < 2) return null

  const { slope, intercept, r2 } = linearRegression(points)

  // DB 저장 (이전 동일 유형 기록 삭제)
  await prisma.internalRegression.deleteMany({ where: { projectType } })
  await prisma.internalRegression.create({
    data: {
      projectType,
      coefficients: { slope, intercept },
      sampleSize: points.length,
      rSquared: Math.round(r2 * 1000) / 1000,
    },
  })

  return {
    projectType,
    sampleSize: points.length,
    coefficients: { slope, intercept },
    rSquared: Math.round(r2 * 1000) / 1000,
    predict: (area: number) => slope * area + intercept,
  }
}

/** 저장된 회귀식 조회 + 예측 샘플. */
export async function loadRegression(projectType: string): Promise<{
  projectType: string
  coefficients: LinearCoefficients
  sampleSize: number
  rSquared: number
  trainedAt: string
  curveSamples: { x: number; y: number }[]
} | null> {
  const row = await prisma.internalRegression.findFirst({
    where: { projectType },
    orderBy: { trainedAt: 'desc' },
  })
  if (!row) return null
  const c = row.coefficients as unknown as LinearCoefficients
  // 곡선 샘플 점 (5000~100000㎡ 범위에서 10개)
  const samples = Array.from({ length: 10 }, (_, i) => {
    const x = 5000 + i * (95000 / 9)
    return { x: Math.round(x), y: Math.round(c.slope * x + c.intercept) }
  })
  return {
    projectType: row.projectType,
    coefficients: c,
    sampleSize: row.sampleSize,
    rSquared: row.rSquared,
    trainedAt: row.trainedAt.toISOString(),
    curveSamples: samples,
  }
}
