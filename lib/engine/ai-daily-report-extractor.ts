// ═══════════════════════════════════════════════════════════
// G7. AI 일보 자동 구조화
//   자유 서술 텍스트 → JSON (날씨·인력·자재·작업·이슈)
//   현장 담당자의 입력 부담 제거, 본사는 구조화된 데이터로 수신.
// ═══════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

const apiKey = process.env.ANTHROPIC_API_KEY
const client = apiKey ? new Anthropic({ apiKey }) : null

const MODEL = 'claude-opus-4-5'  // 조직 기본, 실패 시 환경변수로 override 가능
const OVERRIDE = process.env.CLAUDE_MODEL || MODEL

export interface ExtractedManpower { trade: string; today: number; note?: string }
export interface ExtractedEquipment { name: string; count: number }
export interface ExtractedMaterial { name: string; quantity?: number; unit?: string }
export interface ExtractedWork { trade: string; location?: string; description: string }
export interface ExtractedIssue { severity: 'low' | 'med' | 'high'; description: string }

export interface DailyReportExtraction {
  date?: string
  weather?: string
  tempMin?: number
  tempMax?: number
  manpower: ExtractedManpower[]
  equipmentList: ExtractedEquipment[]
  materialList: ExtractedMaterial[]
  workToday: ExtractedWork[]
  workTomorrow: ExtractedWork[]
  issues: ExtractedIssue[]
  confidence: number  // 0~1, 텍스트의 정보 충분도
}

const SYSTEM_PROMPT = `당신은 한국 건설현장 일보 구조화 전문가입니다.
사용자가 자유 서술한 일보 텍스트를 JSON 구조로 변환하세요.

추출 규칙:
- trade: 한국 건설공사 표준 공종명 사용 (철근공사, 거푸집공사, 콘크리트공사,
  조적공사, 미장공사, 타일공사, 방수공사, 전기공사, 기계설비공사, 조경공사 등)
- today: 해당 공종의 해당일 투입 인원 수 (정수)
- weather: "맑음" | "흐림" | "비" | "눈" | "폭우" | "태풍" | "안개" 중 하나
- tempMin, tempMax: 섭씨, 숫자만 (언급 없으면 생략)
- issues.severity: 생명안전/공기영향 큰 건=high, 중간 지연=med, 경미=low
- equipmentList: 장비명 + 대수
- materialList: 자재명 + 수량 + 단위 (단위 불명확 시 생략)
- 애매한 값은 null 또는 배열 요소 생략 (추측 금지)
- confidence: 입력 텍스트의 정보 충분도 (0.0 ~ 1.0)

반드시 유효한 JSON 객체로만 답변. 설명문·마크다운 금지.
출력 형식 예시:
{
  "weather": "비", "tempMin": 15, "tempMax": 22,
  "manpower": [{"trade": "철근공사", "today": 8}],
  "equipmentList": [], "materialList": [],
  "workToday": [{"trade": "철근공사", "location": "2층", "description": "배근 진행"}],
  "workTomorrow": [],
  "issues": [{"severity": "med", "description": "우천으로 타설 연기"}],
  "confidence": 0.75
}`

/** 자유 서술 → 구조화 JSON. 로그 기록은 best-effort. */
export async function extractDailyReport(opts: {
  entityId: string
  content: string
}): Promise<{ ok: true; data: DailyReportExtraction } | { ok: false; error: string }> {
  if (!client) {
    return { ok: false, error: 'ANTHROPIC_API_KEY 미설정' }
  }
  try {
    const response = await client.messages.create({
      model: OVERRIDE,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: opts.content }],
    })
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('응답에 JSON 없음')
    const parsed = JSON.parse(jsonMatch[0]) as DailyReportExtraction

    // 기본 필드 보정
    parsed.manpower      = Array.isArray(parsed.manpower)      ? parsed.manpower      : []
    parsed.equipmentList = Array.isArray(parsed.equipmentList) ? parsed.equipmentList : []
    parsed.materialList  = Array.isArray(parsed.materialList)  ? parsed.materialList  : []
    parsed.workToday     = Array.isArray(parsed.workToday)     ? parsed.workToday     : []
    parsed.workTomorrow  = Array.isArray(parsed.workTomorrow)  ? parsed.workTomorrow  : []
    parsed.issues        = Array.isArray(parsed.issues)        ? parsed.issues        : []
    parsed.confidence    = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5

    // best-effort 로깅
    await prisma.aiExtractionLog.create({
      data: {
        entityType: 'daily-report',
        entityId: opts.entityId,
        input: opts.content.slice(0, 10000),
        output: parsed as object,
        model: OVERRIDE,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        // Claude Opus 4.6: $15/M input, $75/M output (근사)
        costUsd: (response.usage.input_tokens * 0.000015 +
                  response.usage.output_tokens * 0.000075),
        success: true,
      },
    }).catch(() => {})

    return { ok: true, data: parsed }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    await prisma.aiExtractionLog.create({
      data: {
        entityType: 'daily-report', entityId: opts.entityId,
        input: opts.content.slice(0, 10000), output: {},
        model: OVERRIDE, promptTokens: 0, completionTokens: 0,
        success: false, errorMessage: err,
      },
    }).catch(() => {})
    return { ok: false, error: err }
  }
}
