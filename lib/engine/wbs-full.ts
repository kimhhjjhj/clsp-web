import type { ProjectInput, WBSTask } from '@/lib/types'
import { computeQuantities, calcDuration, getWorkRate, DBRow } from './wbs'

// ═══════════════════════════════════════════════════════════
// Full 모드 — QuickPlan_생산성(전체).csv (39행)
// 파이썬 build_default_tasks() 포팅
// ═══════════════════════════════════════════════════════════

// 단일 공정 DB (single 전개방식)
const SINGLE_DB: DBRow[] = [
  { category: '공사준비', sub: '공통가설', name: '가설울타리',       unit: 'm',   prod: 115,  stdDays: null, wbsCode: 'T.1.1' },
  { category: '공사준비', sub: '공통가설', name: '가설사무실',       unit: '개소', prod: 8,    stdDays: null, wbsCode: 'T.1.2' },
  { category: '공사준비', sub: '공통가설', name: '가설 전기/용수',   unit: '전체', prod: null, stdDays: 5,   wbsCode: 'T.1.3' },
  { category: '공사준비', sub: '공통가설', name: '부지정지',         unit: 'm2',  prod: 1000, stdDays: null, wbsCode: 'T.1.4' },
  { category: '토목공사', sub: '흙막이공사', name: 'CIP(철근망)',    unit: 'm',   prod: 100,  stdDays: null, wbsCode: 'C.1.1' },
  { category: '토목공사', sub: '흙막이공사', name: 'CIP(H-BEAM)',   unit: 'm',   prod: 70,   stdDays: null, wbsCode: 'C.1.2' },
  { category: '토목공사', sub: '흙막이공사', name: '장비조립',       unit: '전체', prod: null, stdDays: 5,   wbsCode: 'C.1.3' },
  { category: '토목공사', sub: '흙막이공사', name: '캠빔 설치',      unit: 'm',   prod: 30,   stdDays: null, wbsCode: 'C.1.4' },
  { category: '토목공사', sub: '차수공사',   name: 'SGR공사',        unit: 'm',   prod: 300,  stdDays: null, wbsCode: 'C.2.1' },
  { category: '토목공사', sub: '토공사',     name: '터파기(풍화토)', unit: 'm3',  prod: 350,  stdDays: null, wbsCode: 'C.3.1' },
  { category: '토목공사', sub: '토공사',     name: '터파기(풍화암)', unit: 'm3',  prod: 250,  stdDays: null, wbsCode: 'C.3.2' },
  { category: '토목공사', sub: '토공사',     name: '터파기(연암)',   unit: 'm3',  prod: 150,  stdDays: null, wbsCode: 'C.3.3' },
  { category: '골조공사', sub: '골조공사',   name: '기초',           unit: '전체', prod: null, stdDays: 20,  wbsCode: 'A.1.1' },
  { category: '골조공사', sub: '골조공사',   name: '지하층',         unit: '층',  prod: null, stdDays: 25,  wbsCode: 'A.1.2' },
  // 외부공사 (단일 공정, Phase 2 구조 완료 후 배치)
  { category: '외부공사', sub: '부대토목',   name: '보차도경계석',   unit: 'm',   prod: 50,   stdDays: null, wbsCode: 'C.4.1' },
  { category: '외부공사', sub: '조경공사',   name: '포장공사(아스팔트)', unit: 'm2', prod: 800, stdDays: null, wbsCode: 'C.5.2' },
  { category: '부대공사', sub: '준공검사',   name: '입주자사전점검', unit: '전체', prod: null, stdDays: 10,  wbsCode: 'A.9.1' },
]

// 층별 골조 소요일수 (full 모드: 표준층 8일)
const FRAME_STD_DAYS: Record<string, number> = {
  low: 15,  // 저층부
  tr:  30,  // 전이층
  set: 20,  // 세팅층
  std: 8,   // 기준층(표준층)
  top: 10,  // 최상층
}

// 마감 사전 체인 (표준층 이상)
const FINISH_PRE: Array<{ name: string; sub: string; days: number }> = [
  { name: '세대벽돌쌓기',   sub: '조적공사', days: 10 },
  { name: '목창호 가틀',    sub: '창호공사', days: 4  },
  { name: '세대내벽미장',   sub: '미장공사', days: 10 },
  { name: '내장벽체',       sub: '내장공사', days: 7  },
  { name: '욕실방수',       sub: '방수공사', days: 5  },
  { name: '욕실타일붙임',   sub: '타일공사', days: 7  },
]

// 마감 사후 체인 (방통 다음)
const FINISH_POST: Array<{ name: string; sub: string; days: number }> = [
  { name: '내장천정',          sub: '천정공사', days: 6 },
  { name: '주방가구설치',      sub: '수납가구', days: 4 },
  { name: '내장몰딩/걸레받이', sub: '내장공사', days: 3 },
  { name: '천장/벽도배',       sub: '도배공사', days: 4 },
  { name: '마루',              sub: '바닥공사', days: 4 },
]

// ═══════════════════════════════════════════════════════════
// Full 모드 WBS 생성
// ═══════════════════════════════════════════════════════════
export function generateWBSFull(p: ProjectInput): WBSTask[] {
  const qtys   = computeQuantities(p)
  const ground  = p.ground  ?? 0
  const basement = p.basement ?? 0
  const lowrise  = p.lowrise  ?? 0
  const hasTr   = p.hasTransfer

  if (ground <= 0) return []

  // ── 층 분류 ────────────────────────────────────────────────
  const lowFloors: number[] = Array.from({ length: Math.min(lowrise, ground) }, (_, i) => i + 1)
  const transferFloor: number | null = hasTr ? lowrise + 1 : null
  const settingFloor: number = hasTr ? lowrise + 2 : lowrise + 1
  const stdStart = settingFloor + 1
  const numStd = Math.max(0, ground - lowrise - 1 - 1)  // -세팅 -최상
  const stdFloors: number[] = Array.from({ length: numStd }, (_, i) => stdStart + i)
  const topFloor = ground

  // 마감 적용 층 (세팅+기준+최상)
  const finishFloors: number[] = [
    ...(settingFloor <= ground ? [settingFloor] : []),
    ...stdFloors,
    ...(topFloor > settingFloor ? [topFloor] : []),
  ]

  const tasks: WBSTask[] = []
  let nextId = 1
  let prevId = ''

  function addTask(
    name: string,
    category: string,
    subcategory: string,
    unit: string,
    qty: number,
    row: Partial<DBRow> & { prod?: number | null; stdDays?: number | null },
    preds: string[],
    wbsCode?: string,
  ): string {
    const dur = calcDuration(
      { category, sub: subcategory, name, unit, prod: row.prod ?? null, stdDays: row.stdDays ?? null },
      qty,
    )
    if (dur <= 0) return prevId

    const tid = String(nextId++)
    tasks.push({
      id:           tid,
      wbsCode,
      name,
      category,
      subcategory,
      unit,
      quantity:     qty,
      productivity: row.prod != null ? String(row.prod) : undefined,
      stdDays:      row.stdDays != null ? String(row.stdDays) : undefined,
      duration:     Math.max(0.1, dur),
      predecessors: preds.filter(Boolean),
    })
    return tid
  }

  // ── Phase 1: 공사준비 + 토목 단일 공종 ─────────────────────
  const PRE_SINGLE = SINGLE_DB.slice(0, 14)  // 가설~지하층
  const POST_SINGLE = SINGLE_DB.slice(14)    // 외부공사~준공

  for (const row of PRE_SINGLE) {
    let qty = qtys[row.name] ?? 0
    if (qty <= 0 && row.unit === '층') qty = Math.max(1, basement)
    if (qty <= 0 && ['전체', '개소', '대', '주'].includes(row.unit)) qty = 1
    if (qty <= 0) continue

    // 지하층: basement 개수 × stdDays
    if (row.name === '지하층') {
      if (basement <= 0) continue
      prevId = addTask(
        row.name, row.category, row.sub, row.unit,
        basement, row, prevId ? [prevId] : [], row.wbsCode,
      )
      continue
    }

    prevId = addTask(row.name, row.category, row.sub, row.unit, qty, row, prevId ? [prevId] : [], row.wbsCode)
  }

  // ── Phase 2: 지상 층별 골조 ────────────────────────────────
  const frameFloorTask: Record<number, string> = {}
  const FRAME_RATE = getWorkRate('골조공사') ?? 0.632

  function frameType(f: number): keyof typeof FRAME_STD_DAYS {
    if (f === topFloor) return 'top'
    if (lowFloors.includes(f)) return 'low'
    if (transferFloor && f === transferFloor) return 'tr'
    if (f === settingFloor) return 'set'
    return 'std'
  }

  const typeLabel: Record<string, string> = {
    low: '저층부', tr: '전이층', set: '세팅층', std: '기준층', top: '최상층',
  }

  for (let f = 1; f <= ground; f++) {
    const ft = frameType(f)
    const stdD = FRAME_STD_DAYS[ft]
    const dur = Math.round((1 * stdD / FRAME_RATE) * 10) / 10

    const tid = String(nextId++)
    tasks.push({
      id:          tid,
      wbsCode:     `A.1.${f}`,
      name:        `골조 ${f}F (${typeLabel[ft]})`,
      category:    '골조공사',
      subcategory: '층별골조',
      unit:        '층',
      quantity:    1,
      stdDays:     String(stdD),
      duration:    Math.max(0.1, dur),
      predecessors: prevId ? [prevId] : [],
    })
    frameFloorTask[f] = tid
    prevId = tid
  }

  // ── Phase 3: 저층부 마감 (per low-rise floor) ──────────────
  const lowAnchor = lowFloors.length > 0
    ? (frameFloorTask[Math.max(...lowFloors)] ?? prevId)
    : prevId

  const lowriseSorted = [...lowFloors.filter(f => f !== 1), ...(lowFloors.includes(1) ? [1] : [])]
  let lowPrev = lowAnchor
  for (const fl of lowriseSorted) {
    const tid = String(nextId++)
    tasks.push({
      id:          tid,
      name:        `저층부마감 ${fl}F`,
      category:    '마감공사',
      subcategory: '저층부',
      unit:        '층',
      quantity:    1,
      stdDays:     '30',
      duration:    30,
      predecessors: [lowPrev],
    })
    lowPrev = tid
  }

  // ── Phase 4: 표준층 이상 마감 체인 (per finish floor) ───────
  const floorStageIds: Record<number, Record<string, string>> = {}

  for (const fl of finishFloors) {
    floorStageIds[fl] = {}
    // 마감 착수 앵커: 골조 min(fl+3, ground) 완료 후
    const anchorFloor = Math.min(fl + 3, ground)
    const anchor = frameFloorTask[anchorFloor] ?? prevId
    let prev = anchor

    for (const step of FINISH_PRE) {
      const tid = String(nextId++)
      tasks.push({
        id:          tid,
        name:        `${step.name} ${fl}F`,
        category:    '마감공사',
        subcategory: step.sub,
        unit:        '층',
        quantity:    1,
        stdDays:     String(step.days),
        duration:    step.days,  // 마감: rate=null → raw
        predecessors: [prev],
      })
      floorStageIds[fl][step.name] = tid
      prev = tid
    }
    // prev 여기서는 욕실타일붙임 tid
    floorStageIds[fl]['__pre_end'] = prev
  }

  // 방통 묶음 (5층 단위)
  const BATCH = 5
  for (let i = 0; i < finishFloors.length; i += BATCH) {
    const grp = finishFloors.slice(i, i + BATCH)
    const tilePreds = grp.map(fl => floorStageIds[fl]['욕실타일붙임']).filter(Boolean)
    if (tilePreds.length === 0) continue

    const label = grp.length > 1 ? `${grp[0]}F-${grp[grp.length - 1]}F` : `${grp[0]}F`
    const batchTid = String(nextId++)
    tasks.push({
      id:          batchTid,
      name:        `세대방통(묶음) ${label}`,
      category:    '마감공사',
      subcategory: '바닥공사',
      unit:        '층군',
      quantity:    grp.length,
      stdDays:     '3',
      duration:    3,
      predecessors: tilePreds,
    })

    for (const fl of grp) {
      let prev = batchTid
      for (const step of FINISH_POST) {
        const tid = String(nextId++)
        tasks.push({
          id:          tid,
          name:        `${step.name} ${fl}F`,
          category:    '마감공사',
          subcategory: step.sub,
          unit:        '층',
          quantity:    1,
          stdDays:     String(step.days),
          duration:    step.days,
          predecessors: [prev],
        })
        floorStageIds[fl][step.name] = tid
        prev = tid
      }
    }
  }

  // ── Phase 5: MEP (설비/전기) ────────────────────────────────
  for (const fl of finishFloors) {
    const anchorFloor = Math.min(fl + 3, ground)
    const anchor = frameFloorTask[anchorFloor] ?? prevId
    const brickTid = floorStageIds[fl]['세대벽돌쌓기']
    const wallTid  = floorStageIds[fl]['내장벽체']
    const dobaeTid = floorStageIds[fl]['천장/벽도배']

    // 세대내 각종 배관 (30일, 세대벽돌쌓기와 동일 앵커)
    const pipeTid = String(nextId++)
    tasks.push({
      id: pipeTid,
      name: `세대내 각종 배관 ${fl}F`,
      category: '설비공사', subcategory: '배관공사',
      unit: '층', quantity: 1, stdDays: '30', duration: 30,
      predecessors: [anchor],
    })

    // 스프링클러설치 (15일, 내장벽체 이후)
    if (wallTid) {
      const tid = String(nextId++)
      tasks.push({
        id: tid,
        name: `스프링클러설치 ${fl}F`,
        category: '설비공사', subcategory: '소방공사',
        unit: '층', quantity: 1, stdDays: '15', duration: 15,
        predecessors: [wallTid],
      })
    }

    // 세대내배선(입선) (30일, 세대벽돌쌓기 이후)
    let wiringTid = ''
    if (brickTid) {
      wiringTid = String(nextId++)
      tasks.push({
        id: wiringTid,
        name: `세대내배선(입선) ${fl}F`,
        category: '전기공사', subcategory: '배선공사',
        unit: '층', quantity: 1, stdDays: '30', duration: 30,
        predecessors: [brickTid],
      })
    }

    // 전등/전열기구설치 (5일, 천장/벽도배 이후)
    if (dobaeTid) {
      const tid = String(nextId++)
      tasks.push({
        id: tid,
        name: `전등/전열기구설치 ${fl}F`,
        category: '전기공사', subcategory: '기구설치',
        unit: '층', quantity: 1, stdDays: '5', duration: 5,
        predecessors: [dobaeTid],
      })
    }
  }

  // ── Phase 6: 외부공사 / 준공 ───────────────────────────────
  // 지상 골조 완료(topFloor) 이후 순차 연결
  let postPrev = frameFloorTask[topFloor] ?? prevId

  for (const row of POST_SINGLE) {
    let qty = qtys[row.name] ?? 0
    if (qty <= 0) {
      if (row.unit === 'm')      qty = p.sitePerim ?? 1
      else if (row.unit === 'm2') qty = p.siteArea  ?? 1
      else                        qty = 1
    }
    if (qty <= 0) qty = 1
    postPrev = addTask(row.name, row.category, row.sub, row.unit, qty, row, [postPrev], row.wbsCode)
  }

  return tasks
}
