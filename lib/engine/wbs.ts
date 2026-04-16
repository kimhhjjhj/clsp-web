import type { ProjectInput, WBSTask } from '@/lib/types'

let _seq = 0
function nextId() {
  return `t${++_seq}`
}

/**
 * 공동주택 표준 WBS 자동 생성
 * 파이썬 EXE의 generate_default_tasks_and_schedule() 로직 기반
 */
export function generateWBS(p: ProjectInput): WBSTask[] {
  _seq = 0
  const tasks: WBSTask[] = []

  const totalFloors = p.ground + p.basement
  const bldgArea = p.bldgArea ?? 0
  const siteArea = p.siteArea ?? 0
  const bldgPerim = p.bldgPerim ?? Math.sqrt(bldgArea) * 4

  // ──────────────────────────────────────────────────────────────────
  // 1. 가설공사
  // ──────────────────────────────────────────────────────────────────
  const t01 = id()
  const t02 = id()
  const t03 = id()

  tasks.push(
    task(t01, '01', '가설공사', '현장사무소 설치', roundDays(7), []),
    task(t02, '02', '가설공사', '가설울타리 및 게이트', roundDays(bldgPerim / 30), [t01]),
    task(t03, '03', '가설공사', '타워크레인 설치', roundDays(14), [t02]),
  )

  // ──────────────────────────────────────────────────────────────────
  // 2. 토공사 (지하 있을 때)
  // ──────────────────────────────────────────────────────────────────
  let lastEarth = t02
  if (p.basement > 0) {
    const depth = p.waBottom ?? p.basement * 3.5
    const excavVol = siteArea * depth * 0.8
    const t10 = id()
    const t11 = id()
    const t12 = id()

    tasks.push(
      task(t10, '10', '토공사', '흙막이 공사', roundDays(depth * 5 + 10), [t02]),
      task(t11, '11', '토공사', '굴토 (터파기)', roundDays(excavVol / 500), [t10]),
      task(t12, '12', '토공사', '잔토처리 및 성토', roundDays((excavVol / 500) * 0.3), [t11]),
    )
    lastEarth = t12
  }

  // ──────────────────────────────────────────────────────────────────
  // 3. 기초공사
  // ──────────────────────────────────────────────────────────────────
  const floorArea = bldgArea / (totalFloors || 1)
  const t20 = id()
  const t21 = id()
  const t22 = id()

  tasks.push(
    task(t20, '20', '기초공사', '기초 거푸집 조립', roundDays(floorArea / 80), [lastEarth]),
    task(t21, '21', '기초공사', '기초 철근 조립', roundDays(floorArea / 60), [t20]),
    task(t22, '22', '기초공사', '기초 콘크리트 타설 및 양생', roundDays(floorArea / 100 + 14), [t21]),
  )

  // ──────────────────────────────────────────────────────────────────
  // 4. 지하 골조 (지하가 있을 때)
  // ──────────────────────────────────────────────────────────────────
  let lastUnderground = t22
  if (p.basement > 0) {
    let prevLayer = t22
    for (let b = p.basement; b >= 1; b--) {
      const ta = id()
      const tb = id()
      const tc = id()
      tasks.push(
        task(ta, `B${b}a`, '지하골조', `B${b}F 거푸집 조립`, roundDays(floorArea / 70), [prevLayer]),
        task(tb, `B${b}b`, '지하골조', `B${b}F 철근 조립`, roundDays(floorArea / 50), [ta]),
        task(tc, `B${b}c`, '지하골조', `B${b}F 콘크리트 타설`, roundDays(floorArea / 90 + 7), [tb]),
      )
      prevLayer = tc
    }
    lastUnderground = prevLayer
  }

  // ──────────────────────────────────────────────────────────────────
  // 5. 지상 골조 (타입 옵션에 따라 다름)
  // ──────────────────────────────────────────────────────────────────
  // 저층부 (podium)
  let lastPodium = lastUnderground
  if (p.lowrise > 0) {
    const t30 = id()
    const t31 = id()
    const t32 = id()
    tasks.push(
      task(t30, '30', '저층부골조', `1~${p.lowrise}F 거푸집`, roundDays((floorArea * p.lowrise) / 60), [lastUnderground]),
      task(t31, '31', '저층부골조', `1~${p.lowrise}F 철근`, roundDays((floorArea * p.lowrise) / 45), [t30]),
      task(t32, '32', '저층부골조', `1~${p.lowrise}F 콘크리트`, roundDays((floorArea * p.lowrise) / 80 + 7), [t31]),
    )
    lastPodium = t32
  }

  // 전이층
  let lastTransfer = lastPodium
  if (p.hasTransfer) {
    const t35 = id()
    const t36 = id()
    tasks.push(
      task(t35, '35', '전이층', '전이층 거푸집/철근', roundDays(floorArea / 30), [lastPodium]),
      task(t36, '36', '전이층', '전이층 콘크리트 타설 및 양생', roundDays(floorArea / 50 + 21), [t35]),
    )
    lastTransfer = t36
  }

  // 지상 고층부 (5개 층씩 묶음)
  const hiFloors = p.ground - p.lowrise
  let lastFrame = lastTransfer
  if (hiFloors > 0) {
    const batchSize = 5
    const batches = Math.ceil(hiFloors / batchSize)
    let prevBatch = lastTransfer
    let startFloor = p.lowrise + 1

    for (let i = 0; i < batches; i++) {
      const endFloor = Math.min(startFloor + batchSize - 1, p.ground)
      const floors = endFloor - startFloor + 1
      const ta = id()
      const tb = id()
      const tc = id()
      tasks.push(
        task(ta, `${startFloor}Fa`, '지상골조', `${startFloor}~${endFloor}F 거푸집`, roundDays((floorArea * floors) / 60), [prevBatch]),
        task(tb, `${startFloor}Fb`, '지상골조', `${startFloor}~${endFloor}F 철근`, roundDays((floorArea * floors) / 45), [ta]),
        task(tc, `${startFloor}Fc`, '지상골조', `${startFloor}~${endFloor}F 콘크리트`, roundDays((floorArea * floors) / 80 + 7), [tb]),
      )
      prevBatch = tc
      startFloor = endFloor + 1
    }
    lastFrame = prevBatch
  }

  // ──────────────────────────────────────────────────────────────────
  // 6. 지붕/옥탑
  // ──────────────────────────────────────────────────────────────────
  const t50 = id()
  tasks.push(
    task(t50, '50', '지붕/옥탑', '지붕층 골조 및 방수', roundDays(21), [lastFrame]),
  )

  // ──────────────────────────────────────────────────────────────────
  // 7. 외부 마감 (골조 완료 후 시작, 병렬 진행 가능)
  // ──────────────────────────────────────────────────────────────────
  const t60 = id()
  const t61 = id()
  const t62 = id()
  tasks.push(
    task(t60, '60', '외부마감', '외부 단열 및 창호 설치', roundDays((bldgPerim * p.ground * 3) / 200), [lastFrame]),
    task(t61, '61', '외부마감', '외벽 마감 (석재/타일/도장)', roundDays((bldgPerim * p.ground * 3) / 150), [t60]),
    task(t62, '62', '외부마감', '옥외 설비 배관', roundDays(14), [t50]),
  )

  // ──────────────────────────────────────────────────────────────────
  // 8. 내부 마감 (세대당 공정)
  // ──────────────────────────────────────────────────────────────────
  const t70 = id()
  const t71 = id()
  const t72 = id()
  const t73 = id()
  tasks.push(
    task(t70, '70', '내부마감', '세대 내부 단열/방수', roundDays(bldgArea / 300), [lastFrame]),
    task(t71, '71', '내부마감', '설비/전기/소방 배관', roundDays(bldgArea / 200), [t70]),
    task(t72, '72', '내부마감', '내부 미장 및 타일', roundDays(bldgArea / 250), [t71]),
    task(t73, '73', '내부마감', '도배, 바닥재, 도장', roundDays(bldgArea / 300), [t72]),
  )

  // ──────────────────────────────────────────────────────────────────
  // 9. 설비 및 기계 (병렬)
  // ──────────────────────────────────────────────────────────────────
  const t80 = id()
  const t81 = id()
  tasks.push(
    task(t80, '80', '설비공사', '승강기 설치', roundDays(30), [lastFrame]),
    task(t81, '81', '설비공사', '전기/통신/소방 마감', roundDays(bldgArea / 200), [t73]),
  )

  // ──────────────────────────────────────────────────────────────────
  // 10. 준공
  // ──────────────────────────────────────────────────────────────────
  const t90 = id()
  const t91 = id()
  tasks.push(
    task(t90, '90', '준공', '외부 조경 및 부대시설', roundDays(21), [t61, t62]),
    task(t91, '91', '준공', '준공검사 및 인수인계', roundDays(14), [t73, t80, t81, t90]),
  )

  return tasks
}

// ── 헬퍼 함수 ─────────────────────────────────────────────────────────
function id() {
  return nextId()
}

function roundDays(d: number): number {
  return Math.max(1, Math.round(d))
}

function task(
  taskId: string,
  wbsCode: string,
  category: string,
  name: string,
  duration: number,
  predecessors: string[],
): WBSTask {
  return { id: taskId, wbsCode, name, category, duration, predecessors }
}
