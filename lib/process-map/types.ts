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
}

export interface ProcessMapLink {
  id: string
  fromCardId: string
  toCardId: string
  type: 'FS' | 'SS' | 'FF' | 'SF'  // 선후행 유형
  lag?: number                      // 지연일
}

export interface ProcessMap {
  lanes: ProcessMapLane[]
  cards: ProcessMapCard[]
  links: ProcessMapLink[]
  updatedAt?: string
}

export const EMPTY_MAP: ProcessMap = {
  lanes: [],
  cards: [],
  links: [],
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
