'use client'

// ═══════════════════════════════════════════════════════════
// ValueExplainDialog — 참고 수치의 세부 산정 과정을 설명하는 모달
//
// 각 참고값(국토부 공식·회귀식·권장밴드·AI 프리셋·유사프로젝트 추천)마다
// 다음 섹션으로 일관된 설명 제공:
//   1. 한 줄 정의
//   2. 데이터 출처
//   3. 계산 공식/과정
//   4. 사용된 입력값 + 값
//   5. 한계·주의사항
//   6. 의사결정 시 어떻게 쓰는가
// ═══════════════════════════════════════════════════════════

import { useState, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Info, BookOpen, Calculator, Database, AlertTriangle, Lightbulb } from 'lucide-react'

export interface ExplainSection {
  /** 섹션 제목 */
  title: string
  /** 아이콘 (선택) */
  icon?: ReactNode
  /** 본문 — 텍스트 / JSX */
  content: ReactNode
  /** 강조 색상 (border) */
  tone?: 'blue' | 'emerald' | 'amber' | 'slate' | 'red'
}

export interface ExplainData {
  /** 모달 제목 (예: "국토부 2026 공식 산정") */
  title: string
  /** 메인 수치 (예: "1,059일 (35개월)") */
  mainValue: string
  /** 메인 수치 아래 1줄 설명 */
  subtitle?: string
  /** 섹션 목록 */
  sections: ExplainSection[]
}

/** 트리거 엘리먼트를 children 으로 감싸서 클릭 시 모달 열림 */
export function ValueExplainDialog({
  data,
  children,
  triggerClassName,
}: {
  data: ExplainData
  children: ReactNode
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={triggerClassName ?? 'inline-flex items-center gap-1 hover:underline cursor-pointer'}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Info size={16} className="text-blue-600" />
            {data.title}
          </DialogTitle>
        </DialogHeader>

        {/* 메인 수치 카드 */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 my-2">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">산정 결과</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{data.mainValue}</div>
          {data.subtitle && (
            <p className="text-xs text-slate-600 mt-1.5">{data.subtitle}</p>
          )}
        </div>

        {/* 섹션들 */}
        <div className="space-y-3 mt-2">
          {data.sections.map((s, i) => {
            const toneMap: Record<NonNullable<ExplainSection['tone']>, string> = {
              blue:    'border-blue-200 bg-blue-50/40',
              emerald: 'border-emerald-200 bg-emerald-50/40',
              amber:   'border-amber-200 bg-amber-50/40',
              red:     'border-red-200 bg-red-50/40',
              slate:   'border-slate-200 bg-slate-50/40',
            }
            const toneCls = s.tone ? toneMap[s.tone] : 'border-slate-200 bg-white'
            return (
              <div key={i} className={`rounded-lg border ${toneCls} p-3`}>
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
                  {s.icon}
                  {s.title}
                </h4>
                <div className="text-[13px] text-slate-700 leading-relaxed">
                  {s.content}
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// 프리셋 설명 빌더 — 자주 쓰는 참고값 5종의 ExplainData 팩토리
// ═══════════════════════════════════════════════════════════

/** 국토부 공식 산정 */
export function buildGuidelineExplain(params: {
  totalDays: number
  prep: number
  cp: number
  nonWork: number
  cleanup: number
  mode: 'precise' | 'simple'
  monthlyNonWorkRows?: { ym: string; legal: number; climate: number; overlap: number; applied: number }[]
}): ExplainData {
  const m = Math.round(params.totalDays / 30)
  return {
    title: '국토부 2026 적정 공사기간 공식 산정',
    mainValue: `${m}개월 (${params.totalDays.toLocaleString()}일)`,
    subtitle: `국토교통부 ${params.mode === 'precise' ? '정밀' : '간이'} 모드 · 부록 1·2·3·5 기반`,
    sections: [
      {
        title: '무엇인가',
        icon: <BookOpen size={12} />,
        tone: 'blue',
        content: (
          <>
            <strong>공공 건설공사의 공사기간 산정 가이드라인 (국토부 2026)</strong>에서 정한 법정 참조값.
            관급공사 입찰 시 발주처가 이 공식을 근거로 공기를 판단.
          </>
        ),
      },
      {
        title: '계산식',
        icon: <Calculator size={12} />,
        tone: 'slate',
        content: (
          <div className="space-y-1.5">
            <div className="font-mono text-xs bg-white border border-slate-200 rounded px-2 py-1.5">
              공기 = 준비 + CP 작업 + 비작업일 + 정리
              <br />
              = <strong className="text-blue-700">{params.prep}</strong>
              {' + '}
              <strong className="text-emerald-700">{params.cp}</strong>
              {' + '}
              <strong className="text-amber-700">{params.nonWork}</strong>
              {' + '}
              <strong className="text-slate-700">{params.cleanup}</strong>
              {' = '}
              <strong className="text-slate-900">{params.totalDays.toLocaleString()}</strong>일
            </div>
            <ul className="text-xs text-slate-600 space-y-0.5 mt-1.5">
              <li>• <strong>준비 {params.prep}일</strong>: 현장 개설·가설·민원 (부록 1 공종별 표)</li>
              <li>• <strong>CP 작업 {params.cp}일</strong>: 크리티컬 경로 순수 작업 일수 (부록 4 공종별 1일 작업량)</li>
              <li>• <strong>비작업일 {params.nonWork}일</strong>: 법정공휴일·기상(우기/혹서/폭우)·파업·인허가 등 (부록 1·2·3)</li>
              <li>• <strong>정리 {params.cleanup}일</strong>: 준공 전 정리·시운전·검사 (일반 1개월)</li>
            </ul>
          </div>
        ),
      },
      ...(params.monthlyNonWorkRows && params.monthlyNonWorkRows.length > 0 ? [{
        title: '월별 비작업일 누적 (정밀 모드)',
        icon: <Database size={12} />,
        tone: 'amber' as const,
        content: (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-left px-1.5 py-0.5">월</th>
                  <th className="text-right px-1.5 py-0.5">법정</th>
                  <th className="text-right px-1.5 py-0.5">기상</th>
                  <th className="text-right px-1.5 py-0.5">중복</th>
                  <th className="text-right px-1.5 py-0.5">적용</th>
                </tr>
              </thead>
              <tbody>
                {params.monthlyNonWorkRows.slice(0, 12).map(m => (
                  <tr key={m.ym} className="border-t border-slate-100">
                    <td className="px-1.5 py-0.5 text-slate-600">{m.ym}</td>
                    <td className="px-1.5 py-0.5 text-right">{m.legal}</td>
                    <td className="px-1.5 py-0.5 text-right">{m.climate}</td>
                    <td className="px-1.5 py-0.5 text-right text-slate-400">-{m.overlap}</td>
                    <td className="px-1.5 py-0.5 text-right font-bold text-slate-900">{m.applied}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {params.monthlyNonWorkRows.length > 12 && (
              <p className="text-[10px] text-slate-400 mt-1">... + {params.monthlyNonWorkRows.length - 12}개월 추가</p>
            )}
          </div>
        ),
      }] : []),
      {
        title: '한계·주의',
        icon: <AlertTriangle size={12} />,
        tone: 'amber',
        content: (
          <ul className="space-y-0.5 text-xs">
            <li>• <strong>법정 보수 기준</strong>이라 실무 민간 시공 대비 20~30% 길게 나옴</li>
            <li>• 비작업일에 최악 가정 누적 (실제론 이만큼 안 쉬는 경우 많음)</li>
            <li>• 지역·현장 특수 조건은 미반영</li>
          </ul>
        ),
      },
      {
        title: '의사결정 활용',
        icon: <Lightbulb size={12} />,
        tone: 'emerald',
        content: (
          <ul className="space-y-0.5 text-xs">
            <li>• <strong>관급 공사 입찰</strong> 시 필수 참조</li>
            <li>• 민간도 &ldquo;법정 대비 몇 % 단축 시공 중&rdquo; 측정 기준으로 사용</li>
            <li>• CPM이 이 값의 ±20% 이내면 <strong>정상 범위</strong>로 판정</li>
          </ul>
        ),
      },
    ],
  }
}

/** 회귀식 (연면적 단변수) */
export function buildRegressionExplain(params: {
  days: number
  formula: string
  facility: string
  variable: string  // "연면적" 등
  variableValue: number
  inRange: boolean
  range?: { min: number; max: number; unit: string }
}): ExplainData {
  const m = Math.round(params.days / 30)
  return {
    title: `${params.facility} 회귀식 (국토부 부록 5)`,
    mainValue: `${m}개월 (${params.days.toLocaleString()}일)`,
    subtitle: '과거 준공 실적 통계 회귀 · 연면적 단일 변수',
    sections: [
      {
        title: '무엇인가',
        icon: <BookOpen size={12} />,
        tone: 'blue',
        content: (
          <>
            &ldquo;전국 과거 준공 {params.facility} 프로젝트들의 {params.variable}과 실제 공기의 <strong>통계적 평균 곡선</strong>&rdquo;.
            국토부 가이드라인 부록 5에 제공.
          </>
        ),
      },
      {
        title: '공식',
        icon: <Calculator size={12} />,
        tone: 'slate',
        content: (
          <div className="space-y-1.5">
            <div className="font-mono text-xs bg-white border border-slate-200 rounded px-2 py-1.5">
              {params.formula}
            </div>
            <div className="text-xs text-slate-600">
              입력 <strong>{params.variable} = {params.variableValue.toLocaleString()}</strong> →
              출력 <strong>{params.days.toLocaleString()}일</strong>
            </div>
          </div>
        ),
      },
      {
        title: '한계·주의 ⚠️',
        icon: <AlertTriangle size={12} />,
        tone: 'red',
        content: (
          <ul className="space-y-0.5 text-xs">
            <li>• <strong>{params.variable} 단일 변수만 고려</strong> — 층수·동수·지하 깊이·지반 조건 무시</li>
            <li>
              • 예: 같은 17,360㎡이어도 <strong>1동 30층 고층</strong>은 900일+,
              <strong> 5동 12층 중층</strong>은 600~700일로 <strong>크게 다름</strong>.
              이 식은 동일한 <strong>{params.days.toLocaleString()}일</strong>을 반환.
            </li>
            {params.range && (
              <li>
                • 적용 범위: {params.range.min.toLocaleString()} ~ {params.range.max.toLocaleString()} {params.range.unit}
                {' '}{params.inRange ? <span className="text-emerald-600">(범위 내)</span> : <span className="text-red-600">(범위 밖 — 결과 신뢰도 낮음)</span>}
              </li>
            )}
          </ul>
        ),
      },
      {
        title: '의사결정 활용',
        icon: <Lightbulb size={12} />,
        tone: 'emerald',
        content: (
          <>
            <strong>개략 감잡기</strong> 용도만. 최종 의사결정엔 부적합.
            CPM 또는 유사 프로젝트 추천을 <strong>주 기준</strong>으로 쓰고 이 값은 참고.
          </>
        ),
      },
    ],
  }
}

/** 국토부 권장 공기 밴드 */
export function buildBenchmarkExplain(params: {
  floorRange: string        // "고층(16~25F)"
  typicalDaysMin: number
  typicalDaysMax: number
  ground: number
}): ExplainData {
  const mMin = Math.round(params.typicalDaysMin / 30)
  const mMax = Math.round(params.typicalDaysMax / 30)
  return {
    title: '국토부 권장 공기 밴드 (실무가이드 공동주택)',
    mainValue: `${mMin}~${mMax}개월 (${params.typicalDaysMin}~${params.typicalDaysMax}일)`,
    subtitle: `현재 프로젝트 지상 ${params.ground}층 → ${params.floorRange} 구간`,
    sections: [
      {
        title: '무엇인가',
        icon: <BookOpen size={12} />,
        tone: 'blue',
        content: (
          <>
            국토부 2026 가이드라인 <strong>p.129 공동주택 실무가이드</strong>에서 제시한 층수별 권장 공기 범위.
            <strong>실적 통계 분포가 아닌 "실무 권장 범위"</strong>.
          </>
        ),
      },
      {
        title: '전체 층수 밴드표',
        icon: <Database size={12} />,
        tone: 'slate',
        content: (
          <table className="w-full text-xs font-mono">
            <thead className="text-[10px] text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="text-left px-2 py-1">층수 구간</th>
                <th className="text-right px-2 py-1">권장 공기</th>
              </tr>
            </thead>
            <tbody>
              <tr className={`border-t border-slate-100 ${params.floorRange.includes('저층') ? 'bg-blue-50' : ''}`}>
                <td className="px-2 py-1">저층 (1~5F)</td>
                <td className="px-2 py-1 text-right">12~18개월 (360~540일)</td>
              </tr>
              <tr className={`border-t border-slate-100 ${params.floorRange.includes('중층') ? 'bg-blue-50' : ''}`}>
                <td className="px-2 py-1">중층 (6~15F)</td>
                <td className="px-2 py-1 text-right">18~26개월 (540~780일)</td>
              </tr>
              <tr className={`border-t border-slate-100 ${params.floorRange.includes('고층') ? 'bg-blue-50' : ''}`}>
                <td className="px-2 py-1">고층 (16~25F)</td>
                <td className="px-2 py-1 text-right">24~32개월 (720~960일)</td>
              </tr>
              <tr className={`border-t border-slate-100 ${params.floorRange.includes('초고층') ? 'bg-blue-50' : ''}`}>
                <td className="px-2 py-1">초고층 (26F~)</td>
                <td className="px-2 py-1 text-right">30~42개월 (900~1,260일)</td>
              </tr>
            </tbody>
          </table>
        ),
      },
      {
        title: '한계·주의',
        icon: <AlertTriangle size={12} />,
        tone: 'amber',
        content: (
          <ul className="space-y-0.5 text-xs">
            <li>• <strong>실적 분포 아님</strong> — 국토부의 &ldquo;이 정도가 적정&rdquo; 권고치</li>
            <li>• 층수만 반영 — 연면적·지반·공법 차이 무시</li>
            <li>• CPM이 밴드 <strong>밖</strong>이면 비정상적이거나 특수 조건</li>
          </ul>
        ),
      },
      {
        title: '의사결정 활용',
        icon: <Lightbulb size={12} />,
        tone: 'emerald',
        content: (
          <>
            <strong>CPM sanity check</strong>: CPM 결과가 이 밴드 안이면 정상 범위.
            밴드 밖이면 재검토 필요 — 너무 빠르면 생산성 과대 추정, 너무 느리면 보수적 CP_DB 점검.
          </>
        ),
      },
    ],
  }
}

/** AI 프리셋 */
export function buildAiPresetExplain(params: {
  days: number
  formula: string
  confidence: string
  type: string
}): ExplainData {
  const m = Math.round(params.days / 30)
  return {
    title: '⚠️ AI 프리셋 (참고용 · 휴리스틱 공식)',
    mainValue: `${m}개월 (${params.days.toLocaleString()}일)`,
    subtitle: `${params.type} · 신뢰도 ${params.confidence}`,
    sections: [
      {
        title: '무엇인가 (⚠️ 오해 소지)',
        icon: <BookOpen size={12} />,
        tone: 'red',
        content: (
          <>
            이름은 &ldquo;AI&rdquo;지만 <strong>실제로는 AI 학습 결과가 아니라 하드코딩된 선형 공식</strong>입니다.
            유형별 계수(base·연면적·층수·지하 등)를 가중합해 산출.
          </>
        ),
      },
      {
        title: '계산 공식',
        icon: <Calculator size={12} />,
        tone: 'slate',
        content: (
          <div className="font-mono text-xs bg-white border border-slate-200 rounded px-2 py-1.5 whitespace-pre-wrap break-words">
            {params.formula}
          </div>
        ),
      },
      {
        title: '한계·주의 ⚠️',
        icon: <AlertTriangle size={12} />,
        tone: 'red',
        content: (
          <ul className="space-y-0.5 text-xs">
            <li>• <strong>계수 근거 불투명</strong> — 어디서 나온 수치인지 코드에 기록 없음</li>
            <li>• <strong>외부 변수 0건 반영</strong> — 민원·악천후·설계변경 미고려 (국토부 공식은 비작업일 30~40% 반영)</li>
            <li>• <strong>계수 간 시너지 무시</strong> — 전이층 + 고층 조합 등 비선형 증가 미반영</li>
            <li>• <strong>학습 데이터 0건</strong> — 과거 실적으로 검증되지 않음</li>
          </ul>
        ),
      },
      {
        title: '의사결정 활용',
        icon: <Lightbulb size={12} />,
        tone: 'emerald',
        content: (
          <>
            <strong>빠른 감잡기용</strong>으로만. 최종 의사결정은 <strong>CPM</strong>, 검증은
            <strong> 유사 프로젝트 추천</strong>. AI 프리셋은 참고값 중 <strong>신뢰도 최하위</strong>.
            향후 F18 자사 회귀식으로 대체 예정.
          </>
        ),
      },
    ],
  }
}
