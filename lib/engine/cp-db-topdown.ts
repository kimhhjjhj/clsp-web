// ═══════════════════════════════════════════════════════════
// CP_DB — Semi Top-down (CWS) 공법용
// 상봉동 현장 시퀀스 기반 (2026-04 사용자 컨펌)
//
// 구조:
//   Step 0  공통 선행 바닥  :  1F 바닥 → B1F 바닥 (분기점)
//   분기 A  지상 라인       :  B1F 수직 → 1~3F 저층부 → 전이매트 → PIT (이후 대기)
//   분기 B  지하 라인       :  B2F 바닥 → B3F 바닥 → B4F 터파기+기초(MAT)
//                             → B4 수직 → B3 수직 → B2 수직 (지하 폐합)
//   Step 3  지상 본체       :  4F~20F 기준층 → 옥탑 2개층  (PIT ∧ B2 수직 후)
//   마감                    :  공동주택마감
//
// PRD는 가동률 미적용 (raw). 나머지는 기본 가동률(공사준비·흙막이 0.666 /
// 골조 0.632 / 마감 raw) 따름.
// ═══════════════════════════════════════════════════════════

import type { DBRow } from './wbs'

export const CP_DB_TOPDOWN: DBRow[] = [
  // ── 공사준비 ──
  { category: '공사준비', sub: '공통가설', name: '가설울타리',       unit: 'm',   prod: 115,  stdDays: null, wbsCode: 'T.1.1' },
  { category: '공사준비', sub: '공통가설', name: '가설사무실',       unit: '개소', prod: 8,    stdDays: null, wbsCode: 'T.1.2' },
  { category: '공사준비', sub: '공통가설', name: '가설 전기/용수',   unit: '전체', prod: null, stdDays: 5,   wbsCode: 'T.1.3' },
  { category: '공사준비', sub: '공통가설', name: '부지정지',         unit: 'm2',  prod: 1000, stdDays: null, wbsCode: 'T.1.4' },

  // ── 흙막이 (CWS 영구벽체) ──
  { category: '흙막이',   sub: 'CWS',     name: 'CIP(철근망)',      unit: 'm',   prod: 100,  stdDays: null, wbsCode: 'E.1.1' },
  { category: '흙막이',   sub: 'CWS',     name: 'CIP(H-BEAM)',      unit: 'm',   prod: 70,   stdDays: null, wbsCode: 'E.1.2' },
  { category: '흙막이',   sub: '공통',    name: '캠빔 설치',        unit: 'm',   prod: 30,   stdDays: null, wbsCode: 'E.2.1' },

  // ── PRD (가동률 미적용 raw) ──
  { category: 'PRD',      sub: '앵커',    name: 'PRD 장비조립',     unit: '전체', prod: null, stdDays: 5,   wbsCode: 'P.1.1' },
  { category: 'PRD',      sub: '앵커',    name: 'PRD 천공',         unit: '공',  prod: 1.25, stdDays: null, wbsCode: 'P.1.2' },
  { category: 'PRD',      sub: '앵커',    name: 'PRD 장비해체',     unit: '전체', prod: null, stdDays: 5,   wbsCode: 'P.1.3' },

  // ── Step 0 · 공통 선행 바닥 ──
  { category: '역타',     sub: 'Step0',   name: '1F 바닥 타설',     unit: '전체', prod: null, stdDays: 30,  wbsCode: 'TD.0.1' },
  { category: '역타',     sub: 'Step0',   name: 'B1F 바닥 타설',    unit: '전체', prod: null, stdDays: 25,  wbsCode: 'TD.0.2' },

  // ── 분기 B · 지하 라인 ──
  { category: '역타',     sub: '분기B',   name: 'B2F 터파기+바닥',       unit: '전체', prod: null, stdDays: 30,  wbsCode: 'TD.B.1' },
  { category: '역타',     sub: '분기B',   name: 'B3F 터파기+바닥',       unit: '전체', prod: null, stdDays: 30,  wbsCode: 'TD.B.2' },
  { category: '역타',     sub: '분기B',   name: 'B4F 터파기+기초(MAT)',  unit: '전체', prod: null, stdDays: 40,  wbsCode: 'TD.B.3' },
  { category: '역타',     sub: '분기B',   name: 'B4F 수직재',            unit: '전체', prod: null, stdDays: 20,  wbsCode: 'TD.B.4' },
  { category: '역타',     sub: '분기B',   name: 'B3F 수직재',            unit: '전체', prod: null, stdDays: 20,  wbsCode: 'TD.B.5' },
  { category: '역타',     sub: '분기B',   name: 'B2F 수직재',            unit: '전체', prod: null, stdDays: 20,  wbsCode: 'TD.B.6' },

  // ── 분기 A · 지상 라인 ──
  { category: '역타',     sub: '분기A',   name: 'B1F 수직재',            unit: '전체', prod: null, stdDays: 20,  wbsCode: 'TD.A.1' },
  { category: '역타',     sub: '분기A',   name: '1~3F 저층부',           unit: '층',  prod: null, stdDays: 15,  wbsCode: 'TD.A.2' },
  { category: '역타',     sub: '분기A',   name: '전이매트',              unit: '전체', prod: null, stdDays: 35,  wbsCode: 'TD.A.3' },
  { category: '역타',     sub: '분기A',   name: 'PIT층',                unit: '전체', prod: null, stdDays: 20,  wbsCode: 'TD.A.4' },

  // ── Step 3 · 지상 본체 (폐합 후) ──
  { category: '골조공사', sub: '기준층',  name: '4F~20F 기준층',         unit: '층',  prod: null, stdDays: 7,   wbsCode: 'TD.3.1' },
  { category: '골조공사', sub: '최상층',  name: '옥탑 2개층',            unit: '층',  prod: null, stdDays: 10,  wbsCode: 'TD.3.2' },

  // ── 마감 ──
  { category: '마감공사', sub: '공동주택', name: '공동주택마감',         unit: '전체', prod: null, stdDays: 210, wbsCode: 'F.1.1' },
]

/**
 * Top-down 물량 산정 — computeQuantities의 Top-down 버전.
 * 지상/지하 층별 전체 단위는 해당 층이 존재할 때만 1, 아니면 0.
 *
 * 상봉동 기준:
 *  - ground 20, basement 4, lowrise 3, hasTransfer true
 *  - 1~3F 저층부 = lowrise (3)
 *  - 4F~20F 기준층 = ground - lowrise - 2 (옥탑 제외)  (ex: 20-3-2=15)
 *    ※ 현재 프로젝트 모델에 '옥탑층 수'가 없어 일단 고정 2 가정.
 *  - 옥탑 2개층 = 고정 2 (모델 추가되면 대체)
 */
export function computeQuantitiesTopDown(p: {
  ground?: number
  basement?: number
  lowrise?: number
  hasTransfer?: boolean
  bldgArea?: number
  buildingArea?: number
  siteArea?: number
  sitePerim?: number
  bldgPerim?: number
  wtBottom?: number
  waBottom?: number
  prdCount?: number
}): Record<string, number> {
  const ground   = p.ground   ?? 0
  const basement = p.basement ?? 0
  const lowrise  = p.lowrise  ?? 0
  const hasTr    = !!p.hasTransfer
  const sitePerim = p.sitePerim ?? 0
  const bldgPerim = p.bldgPerim ?? 0
  const bldgArea  = p.bldgArea  ?? 0
  const siteArea  = p.siteArea  ?? 0
  const wtBot     = p.wtBottom  ?? 0
  const waBot     = p.waBottom  ?? 0

  // 건축면적 추정
  const totalFloors = ground + basement
  const estFromBldg = bldgArea > 0 && totalFloors > 0 ? bldgArea / totalFloors : 0
  const estFromSite = siteArea > 0 ? siteArea * 0.5 : 0
  const buildingArea = p.buildingArea && p.buildingArea > 0
    ? p.buildingArea
    : estFromBldg > 0 ? estFromBldg : estFromSite

  // CIP 물량 (Bottom-up과 동일한 공식 — CWS이므로 외벽까지 영구 사용)
  const cipCnt      = bldgPerim > 0 ? Math.floor(bldgPerim / 0.5) : 0
  const cipRebarCnt = Math.floor(cipCnt * 2 / 3)
  const cipHbeamCnt = cipCnt - cipRebarCnt
  const totalExc    = basement > 0 ? basement * 3.5 + 1.0 : 0
  const cipRebarLen = cipRebarCnt * (wtBot + 1)
  const cipHbeamLen = cipHbeamCnt * (totalExc + 2)
  const cambeamLen  = Math.floor(bldgPerim)

  // 층별 현황 — 상봉동 기준 4F~20F 기준층, 옥탑 고정 2
  const ROOF_FLOORS = 2
  const stdFloors = Math.max(0, ground - lowrise - ROOF_FLOORS)
  const roofFloors = ground > lowrise + ROOF_FLOORS ? ROOF_FLOORS : Math.max(0, ground - lowrise)

  // 지하 분기 B 존재 조건
  const hasB2 = basement >= 2
  const hasB3 = basement >= 3
  const hasB4 = basement >= 4

  return {
    // 공사준비
    '가설울타리':       sitePerim,
    '가설사무실':       8,
    '가설 전기/용수':   1,
    '부지정지':         buildingArea,
    // 흙막이
    'CIP(철근망)':      cipRebarLen,
    'CIP(H-BEAM)':      cipHbeamLen,
    '캠빔 설치':        cambeamLen,
    // PRD
    'PRD 장비조립':     1,
    'PRD 천공':         p.prdCount ?? 0,
    'PRD 장비해체':     1,
    // Step 0
    '1F 바닥 타설':     1,
    'B1F 바닥 타설':    basement > 0 ? 1 : 0,
    // 분기 B
    'B2F 터파기+바닥':           hasB2 ? 1 : 0,
    'B3F 터파기+바닥':           hasB3 ? 1 : 0,
    'B4F 터파기+기초(MAT)':      hasB4 ? 1 : (basement > 0 ? 1 : 0),  // 최저층은 기초 포함
    'B4F 수직재':                hasB4 ? 1 : 0,
    'B3F 수직재':                hasB3 ? 1 : 0,
    'B2F 수직재':                hasB2 ? 1 : 0,
    // 분기 A
    'B1F 수직재':                basement > 0 ? 1 : 0,
    '1~3F 저층부':               lowrise > 0 ? lowrise : Math.min(3, ground),
    '전이매트':                  hasTr ? 1 : 0,
    'PIT층':                     hasTr ? 1 : 0,   // 전이층 있을 때 PIT 포함
    // Step 3
    '4F~20F 기준층':             stdFloors,
    '옥탑 2개층':                roofFloors,
    // 마감
    '공동주택마감':              1,
  }
}

/**
 * CP_DB_TOPDOWN 공종 선후행 맵 (작업명 기반)
 * 빈 배열 = 선행 없음 (공사 시작점 or 공사준비 단계 첫 공종은 prev 순차로 fallback)
 * 공사준비·흙막이·PRD는 명시하지 않으면 prev → next 순차 연결 (fallback)
 *
 * 핵심: Top-down 골조 분기/병합 구조
 *   1F 바닥 → B1F 바닥 (공통)
 *   B1F 바닥 ─┬─ 분기 A : B1F 수직 → 1~3F → 전이매트 → PIT ─┐
 *             └─ 분기 B : B2·B3 바닥 → 기초 → B4·B3·B2 수직─┤
 *                                                           └→ 4F~20F → 옥탑 → 마감
 */
export const CP_DB_TOPDOWN_DEPS: Record<string, string[]> = {
  // Step 0 공통
  '1F 바닥 타설':     ['PRD 장비해체'],          // PRD 완료 후 역타 시작
  'B1F 바닥 타설':    ['1F 바닥 타설'],

  // 분기 A — 지상 라인
  'B1F 수직재':       ['B1F 바닥 타설'],
  '1~3F 저층부':      ['B1F 수직재'],
  '전이매트':         ['1~3F 저층부'],
  'PIT층':            ['전이매트'],

  // 분기 B — 지하 라인 (병렬 시작)
  'B2F 터파기+바닥':           ['B1F 바닥 타설'],
  'B3F 터파기+바닥':           ['B2F 터파기+바닥'],
  'B4F 터파기+기초(MAT)':      ['B3F 터파기+바닥'],
  'B4F 수직재':                ['B4F 터파기+기초(MAT)'],
  'B3F 수직재':                ['B4F 수직재'],
  'B2F 수직재':                ['B3F 수직재'],

  // 병합 — PIT(분기 A 끝) ∧ B2F 수직재(분기 B 폐합) 둘 다 완료 후
  '4F~20F 기준층':    ['PIT층', 'B2F 수직재'],
  '옥탑 2개층':       ['4F~20F 기준층'],
  '공동주택마감':     ['옥탑 2개층'],
}

/** Top-down 가동률 — PRD는 raw */
export function getWorkRateTopDown(category: string): number | null {
  if (category === 'PRD') return null   // raw (가동률 미적용)
  if (category === '공사준비') return 0.666
  if (category === '흙막이')   return 0.666
  if (category === '역타')     return 0.632   // 골조와 동일 적용
  if (category === '골조공사') return 0.632
  if (category === '마감공사') return null
  return 1.0
}
