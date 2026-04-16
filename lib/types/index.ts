// 프로젝트 기본 정보
export interface ProjectInput {
  name: string
  client?: string
  contractor?: string
  location?: string
  type?: string
  startDate?: string
  ground: number       // 지상 층수
  basement: number     // 지하 층수
  lowrise: number      // 저층부 층수
  hasTransfer: boolean // 전이층 여부
  sitePerim?: number   // 대지 둘레 (m)
  bldgPerim?: number   // 건물 둘레 (m)
  siteArea?: number    // 대지 면적 (m²)
  bldgArea?: number    // 연면적 (m²)
  wtBottom?: number    // 지하수위 깊이 (m)
  waBottom?: number    // 흙막이 깊이 (m)
  mode?: 'cp' | 'full' // WBS 생성 모드: 개략(CP) / 상세(Full)
}

// WBS 태스크
export interface WBSTask {
  id: string
  wbsCode?: string
  name: string
  category: string
  subcategory?: string
  unit?: string
  quantity?: number
  productivity?: string
  stdDays?: string
  duration: number
  predecessors: string[] // task id 목록
  note?: string
}

// CPM 계산 결과
export interface CPMResult {
  taskId: string
  name: string
  category: string
  subcategory?: string
  wbsCode?: string
  unit?: string
  quantity?: number
  productivity?: string
  stdDays?: string
  duration: number
  ES: number  // Early Start
  EF: number  // Early Finish
  LS: number  // Late Start
  LF: number  // Late Finish
  TF: number  // Total Float
  FF: number  // Free Float
  isCritical: boolean
  predecessors: string[]  // 선행 task 이름 목록
  successors: string[]    // 후행 task 이름 목록
}

export interface CPMSummary {
  totalDuration: number
  criticalPath: string[]
  tasks: CPMResult[]
}
