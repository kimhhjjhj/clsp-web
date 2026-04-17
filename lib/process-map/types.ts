// ═══════════════════════════════════════════════════════════
// 프로세스맵 타입 — 프리콘 협력사 스윔레인 보드
// 실제 현장에서 포스트잇으로 하던 Pull Planning의 디지털 버전
// ═══════════════════════════════════════════════════════════

export interface ProcessMapLane {
  id: string         // uuid or cuid
  name: string       // 협력사명 또는 공종명 (예: "골조 - 동양", "전기 - 금강전기")
  color: string      // hex
  order: number
}

export type CardShape = 'task' | 'decision' | 'milestone' | 'start' | 'end' | 'note'

export interface CardComment {
  id: string
  author: string       // 발언자 (예: "박소장/새한기업", "최과장/금강전기")
  text: string
  createdAt: string    // ISO
}

export interface ProcessMapCard {
  id: string
  laneId: string
  title: string           // 작업명 (예: "1F 철근 배근")
  startDay: number        // 프로젝트 시작일로부터 N일 (0-based, 타임라인용)
  duration: number        // 일수 (>=1, 타임라인용)
  baselineTaskId?: string // BaselineTask.id (연동 시)
  note?: string
  status?: 'planned' | 'in_progress' | 'done' | 'blocked'
  // 플로우 뷰 전용 (자유 캔버스)
  x?: number              // 캔버스 x좌표 (px)
  y?: number              // 캔버스 y좌표 (px)
  shape?: CardShape       // 기본 'task'
  w?: number              // 폭 (기본 160)
  h?: number              // 높이 (기본 56)
  // 회의 기록 — 협력사별 발언/코멘트 적층
  comments?: CardComment[]
  assignee?: string       // 주 담당자 ("회사/성명")
}

export interface ProcessMapLink {
  id: string
  fromCardId: string
  toCardId: string
  type: 'FS' | 'SS' | 'FF' | 'SF'  // 선후행 유형
  lag?: number                      // 지연일
}

// 플로우 뷰 전용 - 여러 카드를 묶는 시각적 박스 (Phase/Zone 등)
export interface ProcessMapGroup {
  id: string
  label: string        // "1단계", "B구역" 등
  color: string        // hex (반투명 배경으로 사용)
  x: number
  y: number
  w: number
  h: number
}

export interface ProcessMap {
  lanes: ProcessMapLane[]
  cards: ProcessMapCard[]
  links: ProcessMapLink[]
  groups?: ProcessMapGroup[]
  updatedAt?: string
}

export const EMPTY_MAP: ProcessMap = {
  lanes: [],
  cards: [],
  links: [],
  groups: [],
}

export const LINK_TYPE_LABEL: Record<ProcessMapLink['type'], string> = {
  FS: '종료-시작',
  SS: '시작-시작',
  FF: '종료-종료',
  SF: '시작-종료',
}

// ── 기본 레인 프리셋 (새 보드 생성 시) ─────────────────────
export const DEFAULT_LANES: Omit<ProcessMapLane, 'id'>[] = [
  { name: '토목',       color: '#ca8a04', order: 0 },
  { name: '골조',       color: '#2563eb', order: 1 },
  { name: '철골',       color: '#7c3aed', order: 2 },
  { name: '전기·통신',  color: '#16a34a', order: 3 },
  { name: '기계·설비',  color: '#0891b2', order: 4 },
  { name: '소방',       color: '#dc2626', order: 5 },
  { name: '마감',       color: '#059669', order: 6 },
  { name: '외장·조경',  color: '#9333ea', order: 7 },
]

// cuid-like id generator (클라이언트용)
export function genId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}
