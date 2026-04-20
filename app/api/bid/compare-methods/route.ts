// ═══════════════════════════════════════════════════════════
// POST /api/bid/compare-methods
// 프로젝트 속성으로 Top-down / Bottom-up 양쪽 WBS+CPM 을 각각 돌려
// 실제 공기 차이 + 공법 추천 점수를 반환.
//
// 주의: generateWBS / calculateCPM 은 수정하지 않고, 호출 파라미터
// (constructionMethod) 만 바꿔서 두 번 실행.
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { generateWBS } from '@/lib/engine/wbs'
import { calculateCPM } from '@/lib/engine/cpm'
import { recommendMethod } from '@/lib/engine/method-recommender'
import type { ProjectInput } from '@/lib/types'

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<ProjectInput>

  const base: ProjectInput = {
    name: body.name ?? '공법 비교',
    ground: body.ground ?? 0,
    basement: body.basement ?? 0,
    lowrise: body.lowrise ?? 0,
    hasTransfer: body.hasTransfer ?? false,
    sitePerim: body.sitePerim,
    bldgPerim: body.bldgPerim,
    siteArea: body.siteArea,
    bldgArea: body.bldgArea,
    buildingArea: body.buildingArea,
    wtBottom: body.wtBottom,
    waBottom: body.waBottom,
    prdCount: body.prdCount,
    mode: 'cp',
    constructionMethod: null, // 아래에서 공법별로 오버라이드
  }

  // 공법별 공기 계산
  function calc(method: ProjectInput['constructionMethod']): {
    totalDuration: number
    taskCount: number
    criticalCount: number
  } {
    const input: ProjectInput = { ...base, constructionMethod: method }
    const tasks = generateWBS(input)
    if (tasks.length === 0) {
      return { totalDuration: 0, taskCount: 0, criticalCount: 0 }
    }
    const cpm = calculateCPM(tasks)
    return {
      totalDuration: cpm.totalDuration,
      taskCount: cpm.tasks.length,
      criticalCount: cpm.tasks.filter(t => t.isCritical).length,
    }
  }

  const bottomUp = calc('bottom_up')
  const topDown  = calc('semi_top_down')
  const rec      = recommendMethod(base)

  // 공기 델타
  const deltaDays = bottomUp.totalDuration - topDown.totalDuration
  const deltaPct = bottomUp.totalDuration > 0
    ? Math.round((deltaDays / bottomUp.totalDuration) * 1000) / 10
    : 0

  return NextResponse.json({
    recommendation: rec,
    durations: {
      bottomUp: bottomUp.totalDuration,
      topDown:  topDown.totalDuration,
      deltaDays,
      deltaPct,
      fasterMethod:
        deltaDays > 0 ? 'top_down'
        : deltaDays < 0 ? 'bottom_up'
        : 'neutral',
    },
    stats: {
      bottomUp: {
        taskCount: bottomUp.taskCount,
        criticalCount: bottomUp.criticalCount,
      },
      topDown: {
        taskCount: topDown.taskCount,
        criticalCount: topDown.criticalCount,
      },
    },
    input: base,
  })
}
