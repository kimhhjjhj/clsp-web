// AI 개략 공사비 추정 API
// - CPM이 이미 계산한 공종별 물량을 바탕으로
// - Claude가 한국 건설 시세(2025년 기준)로 공종별 단가·합계 추정
// - tool_use로 구조화된 JSON 응답 강제
//
// 사전조건: .env.local 에 ANTHROPIC_API_KEY=sk-ant-... 설정 필요

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

interface TaskBrief {
  name: string
  category: string
  quantity?: number
  unit?: string
  duration: number
}

interface Body {
  type?: string            // 공동주택 / 오피스텔 / 데이터센터 / ...
  ground?: number
  basement?: number
  bldgArea?: number        // 연면적
  buildingArea?: number    // 건축면적(1층 footprint)
  siteArea?: number
  totalDuration: number    // CPM 총공기
  tasks: TaskBrief[]       // CPM 공종 리스트 (물량 포함)
}

const MODEL = 'claude-sonnet-4-6'  // 가성비. 필요 시 opus-4-7로 업그레이드

// ───────────────────────────────────────────────
// Tool schema — Claude가 반드시 이 형태로 응답
// ───────────────────────────────────────────────
const SUBMIT_ESTIMATE_TOOL: Anthropic.Tool = {
  name: 'submit_estimate',
  description: '공종별 아이템 단가 추정 결과와 공사비 breakdown을 제출',
  input_schema: {
    type: 'object',
    properties: {
      trades: {
        type: 'array',
        description: '공종 대분류별 아이템 리스트',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string', description: '공종 대분류 (토공사/골조공사/마감공사/설비공사/전기공사/부대공사 등)' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: '아이템명 (예: 철근 콘크리트 m³, 거푸집 m², 단열재 등)' },
                  qty: { type: 'number', description: '물량' },
                  unit: { type: 'string', description: '단위 (㎥, ton, ㎡ 등)' },
                  unitPriceKRW: { type: 'number', description: '단가 (원)' },
                  subtotalKRW: { type: 'number', description: '소계 = qty × unitPriceKRW' },
                },
                required: ['name', 'qty', 'unit', 'unitPriceKRW', 'subtotalKRW'],
              },
            },
            categorySubtotalKRW: { type: 'number', description: '이 공종 소계 (원)' },
          },
          required: ['category', 'items', 'categorySubtotalKRW'],
        },
      },
      summary: {
        type: 'object',
        properties: {
          directCostKRW:      { type: 'number', description: '직접공사비 (공종 소계 합)' },
          indirectCostKRW:    { type: 'number', description: '간접공사비 (현장관리비 등, 보통 직접비의 10%)' },
          generalAdminKRW:    { type: 'number', description: '일반관리비 (보통 5.5%)' },
          profitKRW:          { type: 'number', description: '이윤 (보통 10%)' },
          vatKRW:             { type: 'number', description: '부가세 (10%)' },
          grandTotalKRW:      { type: 'number', description: '총 공사비 (부가세 포함)' },
          pricePerSqmKRW:     { type: 'number', description: '연면적 단위 단가 (원/㎡)' },
          pricePerPyongKRW:   { type: 'number', description: '연면적 평당 단가 (원/평)' },
        },
        required: [
          'directCostKRW','indirectCostKRW','generalAdminKRW','profitKRW',
          'vatKRW','grandTotalKRW','pricePerSqmKRW','pricePerPyongKRW',
        ],
      },
      notes: { type: 'string', description: '주요 가정·근거·한계 (한글, 3~5줄)' },
    },
    required: ['trades', 'summary', 'notes'],
  },
}

// ───────────────────────────────────────────────
// 시스템 프롬프트
// ───────────────────────────────────────────────
const SYSTEM_PROMPT = `당신은 한국 건설업계 30년 경력 적산사이며, 개략 공사비 추정에 특화되어 있습니다.

주어진 프로젝트 규모와 WBS 공종별 물량을 바탕으로, 2025년 한국 건설 시세로 공종별 세부 아이템 단가를 추정하세요.

기준:
- 2025년 3분기 기준 건설업 시중노임단가 + 자재비 + 경비
- 표준품셈 및 업계 관행 원가 계산법
- 공종별 단위·단가는 실제 현장 견적 관행 (철근 톤당, 콘크리트 m³당, 거푸집 m²당, 마감 ㎡당 등)
- 간접공사비 10%, 일반관리비 5.5%, 이윤 10%, 부가세 10% 적용

건물 유형별 조정:
- 공동주택: 마감 비중 40%, 골조 25%, 설비 20%, 토공·기타 15%
- 오피스텔: 공동주택 대비 마감 ↑, 설비 ↑
- 데이터센터: 설비·전기 비중 50%+, 골조 보강 단가 20% ↑
- 업무시설(오피스): 골조·커튼월·MEP

출력은 반드시 submit_estimate 툴을 호출하여 JSON으로 제출하세요.
물량이 있는 공종은 세부 아이템 단가를 구체적으로, 규모만 주어진 공종(예: 마감공사 1식)은 연면적·유형 기반으로 주요 아이템을 풀어서 breakdown.`

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local에 키를 추가하고 dev 서버를 재시작하세요.' },
      { status: 500 }
    )
  }

  let body: Body
  try { body = await req.json() as Body }
  catch { return NextResponse.json({ error: '잘못된 요청 본문' }, { status: 400 }) }

  if (!body.tasks || body.tasks.length === 0) {
    return NextResponse.json({ error: 'CPM 공종 리스트가 필요합니다' }, { status: 400 })
  }

  // 사용자 프롬프트 구성
  const tasksText = body.tasks.map(t =>
    `- ${t.category} > ${t.name}: ${t.quantity ?? '—'} ${t.unit ?? ''} / 기간 ${t.duration}일`
  ).join('\n')

  const userPrompt = `프로젝트 정보:
- 유형: ${body.type ?? '공동주택'}
- 지상 ${body.ground ?? 0}층 / 지하 ${body.basement ?? 0}층
- 연면적: ${body.bldgArea?.toLocaleString() ?? '미입력'} ㎡
- 건축면적(1층): ${body.buildingArea?.toLocaleString() ?? '미입력'} ㎡
- 대지면적: ${body.siteArea?.toLocaleString() ?? '미입력'} ㎡
- 총 공기: ${body.totalDuration}일 (약 ${Math.round(body.totalDuration / 30)}개월)

CPM이 계산한 공종별 물량:
${tasksText}

위 물량 데이터를 그대로 활용하고(재산정하지 말고), 각 공종에 세부 아이템 단가를 입혀 공사비 breakdown을 만드세요.
물량이 "—"이거나 너무 뭉쳐있는 공종(예: 마감공사 1식)은 연면적과 유형을 바탕으로 주요 아이템을 합리적으로 풀어서 단가를 산출하세요.`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: [SUBMIT_ESTIMATE_TOOL],
      tool_choice: { type: 'tool', name: 'submit_estimate' },
      messages: [{ role: 'user', content: userPrompt }],
    })

    // tool_use block 추출
    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_estimate'
    )
    if (!toolUse) {
      return NextResponse.json(
        { error: 'AI 응답에 submit_estimate tool 호출이 없습니다', raw: response.content },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ...toolUse.input as object,
      model: MODEL,
      usage: response.usage,
    })
  } catch (err: any) {
    console.error('[ai-estimate]', err)
    return NextResponse.json(
      { error: err?.message ?? 'AI 호출 실패', type: err?.type },
      { status: 500 }
    )
  }
}
