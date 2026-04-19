// ═══════════════════════════════════════════════════════════
// AI 공기 추정 API
// - mode=preset : 룰 기반 즉시 응답 (API 키 불필요)
// - mode=auto   : ANTHROPIC_API_KEY 있으면 Claude API, 없으면 preset fallback
// 동일한 JSON 스키마 반환:
//   { totalDuration, phases[], formula, notes[], byType, confidence }
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { computeSchedulePreset, type SchedulePresetInput } from '@/lib/engine/schedule-preset'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') ?? 'auto'
  const body = (await req.json()) as SchedulePresetInput

  // 1) preset: 항상 먼저 계산 — fallback·baseline 겸용
  const preset = computeSchedulePreset(body)

  if (mode === 'preset') {
    return NextResponse.json(preset)
  }

  // 2) auto: API 키 있으면 Claude에 넘겨 정밀 추정, 없으면 preset 반환
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ...preset, notes: [...preset.notes, 'ANTHROPIC_API_KEY 미설정 → 프리셋 결과로 응답'] })
  }

  try {
    const client = new Anthropic({ apiKey })
    const prompt = buildPrompt(body, preset.totalDuration)
    const res = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.content.filter(c => c.type === 'text').map(c => (c as { text: string }).text).join('\n')
    const json = extractJson(text)
    if (!json) return NextResponse.json({ ...preset, notes: [...preset.notes, 'AI 응답 파싱 실패 → 프리셋으로 대체'] })
    return NextResponse.json({
      ...json,
      model: res.model,
      usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens },
    })
  } catch (e) {
    return NextResponse.json({
      ...preset,
      notes: [...preset.notes, `AI 호출 실패: ${(e as Error).message} → 프리셋으로 대체`],
    })
  }
}

function buildPrompt(input: SchedulePresetInput, presetDays: number): string {
  return `당신은 한국 건설업계 30년차 공정관리자입니다. 아래 프로젝트의 합리적인 총공기와 단계 분포를 추정하세요.

프로젝트:
- 유형: ${input.type ?? '기타'}
- 지상 ${input.ground ?? 0}층 / 지하 ${input.basement ?? 0}층${input.lowrise ? ` / 저층부 ${input.lowrise}층` : ''}
- 연면적: ${input.bldgArea?.toLocaleString() ?? '—'} ㎡
- 건축면적: ${input.buildingArea?.toLocaleString() ?? '—'} ㎡
- 대지: ${input.siteArea?.toLocaleString() ?? '—'} ㎡
- 전이층(Transfer Slab): ${input.hasTransfer ? '포함' : '없음'}
- 풍화암 바닥 ${input.waBottom ?? '—'}m

참고로 회사 룰 프리셋은 ${presetDays}일을 제시했습니다.

2026년 한국 건축공사 실무 관례와 공동주택 표준 공기 데이터를 반영해서
합리적인 총공기(일)와 5단계 분포(가설·토공·골조·외부마감·MEP준공)를 산출하세요.

결과는 반드시 아래 JSON 스키마로만 응답하세요 (설명 없이 JSON만):
{
  "totalDuration": 778,
  "byType": "공동주택",
  "confidence": "high",
  "phases": [
    { "name": "가설·착공 준비", "days": 39, "ratio": 0.05, "startDay": 0, "endDay": 39, "note": "..." },
    { "name": "토공·기초",      "days": 117, "ratio": 0.15, "startDay": 39, "endDay": 156, "note": "..." },
    { "name": "골조공사",       "days": 233, "ratio": 0.30, "startDay": 156, "endDay": 389, "note": "..." },
    { "name": "외부·마감",      "days": 311, "ratio": 0.40, "startDay": 389, "endDay": 700, "note": "..." },
    { "name": "MEP·준공",       "days": 78, "ratio": 0.10, "startDay": 700, "endDay": 778, "note": "..." }
  ],
  "formula": "주요 산출 근거 한 줄",
  "notes": ["가정 1", "가정 2", "한계 1"]
}`
}

function extractJson<T = unknown>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) as T } catch { return null }
}
