// ═══════════════════════════════════════════════════════════
// 프로세스맵 타입 — 동양건설 공정관리 강의자료 기준
//
// 프로세스맵핑 = 설정된 마일스톤 기준으로 전문 협력사가 주도하여
// 공종별 작업/요청사항을 벽면에 부착하는 아날로그 협업 방식
//
// 핵심 원칙 (강의자료):
// - 레인 최상단: 시공사/마일스톤 (pinned)
// - 주공종: 토목/철골/골조/마감 + 조닝(구역) 확장
// - 시간축: 주 단위 기본 (주별 시작·끝 날짜 명기)
// - 카드 부착: "끝나는 날" 기준 (Pull Planning = 역산)
// - 협력사 주도: proposedBy 기록
// ═══════════════════════════════════════════════════════════

// ── 레인 ──────────────────────────────────────────────────
export type LaneKind =
  | 'contractor'    // 시공사/마일스톤 (최상단 고정)
  | 'trade'         // 주공종 (토목/철골/골조/마감)
  | 'support'       // 지원 (전기·통신·기계설비·안전·가설 등)

export interface ProcessMapLane {
  id: string
  name: string           // "시공사", "골조", "전기·통신" 등
  kind?: LaneKind        // 기본 'trade'
  ownerCompany?: string  // 담당 협력사 (예: "새한기업")
  ownerName?: string     // 담당자 (예: "박소장")
  zone?: string          // 조닝 (예: "A구역") — 같은 공종을 여러 구역으로 분할
  color: string          // hex
  order: number
  pinned?: boolean       // true면 최상단 고정 (contractor 레인 기본값)
}

// ── 카드 ──────────────────────────────────────────────────
export type CardKind =
  | 'task'        // 일반 작업
  | 'ask'         // 요청사항 (선행·자재·승인·정보 요청)
  | 'milestone'   // 마일스톤
  | 'decision'    // 결정 (예: 타설 가능?)
  | 'start' | 'end'
  | 'note'        // 회의 메모/벽면 포스트잇

export type AskType =
  | 'predecessor'  // 선행 작업 완료 요청
  | 'material'     // 자재 납품 요청
  | 'approval'     // 승인/검측 요청
  | 'info'         // 정보/도면 요청

export interface CardComment {
  id: string
  author: string       // 발언자 (예: "박소장/새한기업")
  text: string
  createdAt: string    // ISO
}

// ── 카드 상세 양식 (강의자료 노트 작성법 준수) ──────────

// 투입 인원 (공종별 인원수)
export interface CardWorker {
  trade: string      // 예: "철근"
  company?: string   // 예: "새한기업"
  count: number      // 인원수
}

// 투입 자재
export interface CardMaterial {
  name: string       // 예: "레미콘 25-21-150"
  qty?: number
  unit?: string      // m3, ton, 장 등
}

// 카드 단위 자원 계획
export interface CardResources {
  workers?: CardWorker[]      // 투입 인원
  equipment?: string[]        // 투입 장비 (문자열 배열, 예: ["굴착기 2대", "타워크레인"])
  materials?: CardMaterial[]  // 투입 자재
}

// 타 공종 요청사항 (강의자료 양식 상단)
export interface CardRequest {
  targetTrade?: string    // 해당 공종 (요청 대상 공종)
  location?: string       // 위치 (예: "B2F 코어")
  task?: string           // 요청작업
  zone?: string           // 요청 구간 (예: "A-1, A-2")
  date?: string           // 요청일정 (ISO 또는 자유)
}

export interface ProcessMapCard {
  id: string
  laneId: string
  title: string

  // 시간
  startDay: number         // 프로젝트 시작일 기준 D+N (일 단위 내부 저장, UI는 주 단위 표기 가능)
  duration: number         // 일수
  finishAnchor?: boolean   // true면 "끝나는 날" 기준으로 표시 (Pull Planning 원칙)

  // 종류
  kind?: CardKind          // 기본 'task'
  askType?: AskType        // kind === 'ask'일 때만
  requestTo?: string       // ask 대상 (예: "형틀/다원이앤씨")

  // 베이스라인 연동
  baselineTaskId?: string

  // 협업 메타
  proposedBy?: string      // 제안자 (예: "새한기업 박소장")
  proposedAt?: string      // 제안 시점 ISO
  assignee?: string        // 주 담당자

  // 상태·메모
  status?: 'planned' | 'in_progress' | 'done' | 'blocked'
  note?: string
  comments?: CardComment[]

  // ── 강의자료 노트 양식 ────────────────────────
  // 타 공종 요청사항 (카드 한 장에 붙이는 요청 섹션)
  request?: CardRequest

  // 작업 구간 (도면 그리드 영역 선택)
  workZones?: string[]       // 예: ["A-1","A-2","B-1"]
  location?: string          // 자유 텍스트 위치 (예: "B2F 바닥 1구간")

  // 작업사항 본문
  workContent?: string       // 작업내용 (상세)
  resources?: CardResources  // 투입 인원/장비/자재

  // 플로우 뷰 전용
  x?: number
  y?: number
  shape?: CardKind         // 하위호환 (기존 shape → kind로 마이그레이트)
  w?: number
  h?: number
}

// ── 링크 ──────────────────────────────────────────────────
export interface ProcessMapLink {
  id: string
  fromCardId: string
  toCardId: string
  type: 'FS' | 'SS' | 'FF' | 'SF'
  lag?: number
  isHandoff?: boolean      // 공종 간 인수인계 지점 (강조 표시)
}

// ── 그룹 / 조닝 ─────────────────────────────────────────
export interface ProcessMapGroup {
  id: string
  label: string
  color: string
  x: number; y: number
  w: number; h: number
}

export interface Zone {
  id: string
  name: string       // "A구역", "1호동" 등
  color: string
  order: number
}

// ── 전체 맵 ─────────────────────────────────────────────
export interface ProcessMapConfig {
  mode?: 'pull' | 'push'       // pull = 역산(마일스톤 고정 후), push = 전진
  timeUnit?: 'week' | 'day'    // 주 단위 기본
  startDate?: string           // 프로젝트 시작일 (project.startDate 미지정 시 보드에서 별도)
  targetMilestones?: string[]  // 1차 핵심 마일스톤 ID들
}

export interface ProcessMap {
  lanes: ProcessMapLane[]
  cards: ProcessMapCard[]
  links: ProcessMapLink[]
  groups?: ProcessMapGroup[]
  zones?: Zone[]
  config?: ProcessMapConfig
  updatedAt?: string
}

export const EMPTY_MAP: ProcessMap = {
  lanes: [],
  cards: [],
  links: [],
  groups: [],
  zones: [],
  config: { mode: 'pull', timeUnit: 'week' },
}

export const LINK_TYPE_LABEL: Record<ProcessMapLink['type'], string> = {
  FS: '종료-시작',
  SS: '시작-시작',
  FF: '종료-종료',
  SF: '시작-종료',
}

// ── 강의자료 기준 기본 레인 프리셋 ──────────────────────
// 최상단: 시공사/마일스톤 (contractor, pinned)
// 주공종: 토목 / 철골 / 골조 / 마감 (trade, 강의자료 지정)
// 지원: 전기·통신 / 기계·설비 / 소방 (support)
export const LECTURE_DEFAULT_LANES: Omit<ProcessMapLane, 'id'>[] = [
  { name: '시공사 / 마일스톤', kind: 'contractor', color: '#1e293b', order: 0, pinned: true, ownerCompany: '동양건설' },
  { name: '토목',       kind: 'trade',   color: '#ca8a04', order: 1 },
  { name: '철골',       kind: 'trade',   color: '#7c3aed', order: 2 },
  { name: '골조',       kind: 'trade',   color: '#2563eb', order: 3 },
  { name: '마감',       kind: 'trade',   color: '#059669', order: 4 },
  { name: '전기·통신',  kind: 'support', color: '#16a34a', order: 5 },
  { name: '기계·설비',  kind: 'support', color: '#0891b2', order: 6 },
  { name: '소방',       kind: 'support', color: '#dc2626', order: 7 },
  { name: '가설·안전',  kind: 'support', color: '#64748b', order: 8 },
]

// 구 프리셋은 호환용으로 유지
export const DEFAULT_LANES = LECTURE_DEFAULT_LANES

// ── ID 생성 ─────────────────────────────────────────────
export function genId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

// ── 구역 그리드 기본 (강의자료: A-D × 1-6) ─────────────
export const DEFAULT_ZONE_ROWS = ['A', 'B', 'C', 'D']
export const DEFAULT_ZONE_COLS = ['1', '2', '3', '4', '5', '6']

// ── 주 단위 헬퍼 ─────────────────────────────────────────
export interface WeekInfo {
  index: number       // W1, W2, ...
  startDay: number    // 프로젝트 시작일 기준
  endDay: number
  startDate?: string  // ISO (startDate 주어질 때)
  endDate?: string
  label: string       // "W3 (3/15~3/21)" 같은
}

export function buildWeekAxis(totalDays: number, startDate?: string): WeekInfo[] {
  const weeks: WeekInfo[] = []
  const baseDate = startDate ? new Date(startDate) : null
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7))
  for (let i = 0; i < totalWeeks; i++) {
    const startDay = i * 7
    const endDay = startDay + 7
    let startDateStr: string | undefined
    let endDateStr: string | undefined
    let label = `W${i + 1}`
    if (baseDate) {
      const s = new Date(baseDate)
      s.setDate(s.getDate() + startDay)
      const e = new Date(baseDate)
      e.setDate(e.getDate() + endDay - 1)
      const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
      startDateStr = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`
      endDateStr = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`
      label = `W${i + 1} (${fmt(s)}~${fmt(e)})`
    }
    weeks.push({ index: i + 1, startDay, endDay, startDate: startDateStr, endDate: endDateStr, label })
  }
  return weeks
}
