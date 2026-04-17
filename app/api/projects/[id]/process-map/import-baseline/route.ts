import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EMPTY_MAP, DEFAULT_LANES, genId, type ProcessMap, type ProcessMapCard, type ProcessMapLane } from '@/lib/process-map/types'

type Params = { params: Promise<{ id: string }> }

// 작업명 → 레인 매핑 힌트 (키워드 포함 시 해당 레인으로)
const NAME_TO_LANE: { pattern: RegExp; lane: string }[] = [
  { pattern: /토공|터파기|흙막이|SGR|CIP|H-BEAM|캠빔|장비조립|부지정지|가설울타리/, lane: '토목' },
  { pattern: /철근|형틀|거푸집|콘크리트|타설|골조|슬래브|기초|지하층|지상층|기준층|전이층|세팅층|최상층/, lane: '골조' },
  { pattern: /철골|데크|H빔|용접/, lane: '철골' },
  { pattern: /전기|통신|EHP|가설전기|케이블|배관.*전기/, lane: '전기·통신' },
  { pattern: /기계|설비|덕트|배관|공조|위생/, lane: '기계·설비' },
  { pattern: /소방/, lane: '소방' },
  { pattern: /내장|도장|타일|미장|방수|조적|유리|가구|석재|금속|견출|마감/, lane: '마감' },
  { pattern: /외장|외부판넬|커튼월|조경|준공청소/, lane: '외장·조경' },
]

function guessLane(taskName: string): string {
  for (const { pattern, lane } of NAME_TO_LANE) {
    if (pattern.test(taskName)) return lane
  }
  return '기타'
}

// ── 선행 작업 파싱 (MSP 형식: "5,7", "17FS+3", "17SS-2") ──
function parsePredIds(preds: string | null): { id: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number }[] {
  if (!preds) return []
  return preds.split(/[,;]/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const m = p.match(/^(\d+)(FS|SS|FF|SF)?([+-]\d+)?$/i)
      if (m) return { id: m[1], type: (m[2]?.toUpperCase() as any) || 'FS', lag: parseInt(m[3] || '0', 10) }
      const n = p.match(/\d+/)
      return n ? { id: n[0], type: 'FS' as const, lag: 0 } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
}

// MSP 날짜 → ES 계산 (없으면 선행관계로 Forward pass)
function computeStartDays(baseline: { id: string; mspId: string | null; duration: number; predecessors: string | null }[]): Map<string, number> {
  const idx = new Map<string, number>()
  baseline.forEach((t, i) => {
    idx.set(String(i + 1), i)
    if (t.mspId) idx.set(t.mspId, i)
  })
  const ES = new Array(baseline.length).fill(0)
  const EF = new Array(baseline.length).fill(0)
  for (let iter = 0; iter < baseline.length + 2; iter++) {
    let changed = false
    baseline.forEach((t, i) => {
      const preds = parsePredIds(t.predecessors)
      let es = 0
      for (const p of preds) {
        const pi = idx.get(p.id)
        if (pi != null) {
          const base = p.type === 'SS' ? ES[pi] : EF[pi]
          es = Math.max(es, base + p.lag)
        }
      }
      if (es !== ES[i]) { ES[i] = es; changed = true }
      EF[i] = ES[i] + t.duration
    })
    if (!changed) break
  }
  const result = new Map<string, number>()
  baseline.forEach((t, i) => result.set(t.id, ES[i]))
  return result
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    select: { processMap: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const baseline = await prisma.baselineTask.findMany({
    where: { projectId: id },
    orderBy: { id: 'asc' },
  })
  if (baseline.length === 0) {
    return NextResponse.json({ error: '베이스라인이 없습니다. MSP CSV를 먼저 업로드해주세요.' }, { status: 400 })
  }

  // ES 계산
  const startDays = computeStartDays(baseline.map(t => ({
    id: t.id, mspId: t.mspId, duration: t.duration, predecessors: t.predecessors,
  })))

  const current = (project.processMap as ProcessMap | null) ?? EMPTY_MAP

  // 레인: 이미 있는 건 재사용, 새 공종 발견 시 추가
  const laneByName = new Map<string, ProcessMapLane>()
  for (const l of current.lanes) laneByName.set(l.name, l)
  for (const preset of DEFAULT_LANES) {
    if (!laneByName.has(preset.name)) {
      laneByName.set(preset.name, { id: genId('lane'), ...preset })
    }
  }

  // 카드: 기존 baselineTaskId 매핑된 것과 새로운 것 병합
  const existingByBaseId = new Map<string, ProcessMapCard>()
  for (const c of current.cards) {
    if (c.baselineTaskId) existingByBaseId.set(c.baselineTaskId, c)
  }

  const newCards: ProcessMapCard[] = []
  let unmappedLaneNeeded = false
  for (const t of baseline) {
    if (t.duration <= 0) continue // 마일스톤은 건너뜀
    const laneName = guessLane(t.name)
    if (!laneByName.has(laneName)) {
      laneByName.set(laneName, { id: genId('lane'), name: laneName, color: '#64748b', order: 99 })
      if (laneName === '기타') unmappedLaneNeeded = true
    }
    const lane = laneByName.get(laneName)!
    const existing = existingByBaseId.get(t.id)
    newCards.push({
      id: existing?.id ?? genId('card'),
      laneId: existing?.laneId ?? lane.id,  // 기존 레인 유지 (사용자가 이동시킨 걸 존중)
      title: t.name,
      startDay: startDays.get(t.id) ?? 0,
      duration: t.duration,
      baselineTaskId: t.id,
      note: existing?.note,
      status: existing?.status,
    })
  }

  // 베이스라인과 연결 없는 수동 카드들도 보존
  const manualCards = current.cards.filter(c => !c.baselineTaskId)

  // Links: 베이스라인의 선행관계를 카드 간 링크로 변환
  const bIdToCardId = new Map<string, string>()
  for (const c of newCards) if (c.baselineTaskId) bIdToCardId.set(c.baselineTaskId, c.id)
  const mspIdToBId = new Map<string, string>()
  baseline.forEach((t, i) => {
    mspIdToBId.set(String(i + 1), t.id)
    if (t.mspId) mspIdToBId.set(t.mspId, t.id)
  })
  const links = [...current.links.filter(l => {
    // 기존 수동 링크 중 baseline 카드 관련이 아닌 것만 유지
    const fromCard = newCards.find(c => c.id === l.fromCardId)
    const toCard = newCards.find(c => c.id === l.toCardId)
    return !fromCard?.baselineTaskId && !toCard?.baselineTaskId
  })]
  for (const t of baseline) {
    const toCardId = bIdToCardId.get(t.id)
    if (!toCardId) continue
    const preds = parsePredIds(t.predecessors)
    for (const p of preds) {
      const fromBId = mspIdToBId.get(p.id)
      if (!fromBId) continue
      const fromCardId = bIdToCardId.get(fromBId)
      if (!fromCardId) continue
      links.push({
        id: genId('link'),
        fromCardId,
        toCardId,
        type: p.type,
        lag: p.lag,
      })
    }
  }

  const next: ProcessMap = {
    lanes: [...laneByName.values()].sort((a, b) => a.order - b.order),
    cards: [...newCards, ...manualCards],
    links,
    updatedAt: new Date().toISOString(),
  }

  await prisma.project.update({
    where: { id },
    data: { processMap: next as unknown as object },
  })

  return NextResponse.json({
    ok: true,
    imported: newCards.length,
    manual: manualCards.length,
    laneCount: next.lanes.length,
    unmapped: unmappedLaneNeeded,
  })
}
