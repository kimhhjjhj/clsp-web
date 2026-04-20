// ═══════════════════════════════════════════════════════════
// Top-down (역타) vs Bottom-up (순타) 공법 비교·추천
//
// 입력: ProjectInput 속성(지하층수, 연면적, 지반, 전이층 등)
// 출력: 항목별 가점, 총점, 추천 공법, 근거 텍스트
//
// ⚠️ generateWBS / calcDuration 은 변경하지 않음.
//    이 모듈은 '판단 로직'만 제공하며, 공기 수치는 별도로
//    서버에서 generateWBS 를 두 번 돌려 비교함.
// ═══════════════════════════════════════════════════════════

import type { ProjectInput } from '@/lib/types'

export type MethodKind = 'top_down' | 'bottom_up' | 'neutral'

export interface ScoreFactor {
  /** 판단 항목 (UI 라벨) */
  label: string
  /** Top-down 가점 */
  topDown: number
  /** Bottom-up 가점 */
  bottomUp: number
  /** 근거 설명 (한 줄) */
  note: string
  /** 원본 값 (디버그·표시용) */
  value?: string | number
}

export interface MethodRecommendation {
  scores: { topDown: number; bottomUp: number }
  factors: ScoreFactor[]
  recommended: MethodKind
  /** 추천 이유 요약 (1~2문장) */
  rationale: string
  /** 상대적 비용 경향 (정성적) */
  costNote: string
  /** 리스크 메모 */
  riskNote: string
}

// ──────────────────────────────────────────────────────────
// 규칙 기반 스코어링
// 국토부 2026 공기가이드라인 부록 6 (시공조건) + 일반적 엔지니어링 휴리스틱
// ──────────────────────────────────────────────────────────
export function recommendMethod(p: ProjectInput): MethodRecommendation {
  const factors: ScoreFactor[] = []
  const basement = p.basement ?? 0
  const ground = p.ground ?? 0
  const bldgArea = p.bldgArea ?? 0
  const siteArea = p.siteArea ?? 0
  const footprint = p.buildingArea ?? 0
  const wt = p.wtBottom ?? 0
  const wa = p.waBottom ?? 0

  // 1) 지하층수 — 역타의 가장 큰 결정 인자
  if (basement >= 5) {
    factors.push({
      label: '지하 층수', value: `${basement}층`,
      topDown: 6, bottomUp: 0,
      note: '지하 5층 이상 — 굴착·흙막이 리스크 · 공기 단축 측면 역타 강력 유리',
    })
  } else if (basement >= 3) {
    factors.push({
      label: '지하 층수', value: `${basement}층`,
      topDown: 4, bottomUp: 0,
      note: '지하 3~4층 — 지상부 동시 시공 시 공기 단축 효과 크게 발생',
    })
  } else if (basement === 2) {
    factors.push({
      label: '지하 층수', value: '2층',
      topDown: 1, bottomUp: 2,
      note: '지하 2층 — 역타 이점 경계, 순타가 비용 면에서 우위',
    })
  } else if (basement <= 1) {
    factors.push({
      label: '지하 층수', value: `${basement}층`,
      topDown: 0, bottomUp: 4,
      note: '지하 1층 이하 — 역타 투자 대비 이득 없음, 순타가 명확히 유리',
    })
  }

  // 2) 건물 규모 — 연면적 / 지상층
  if (bldgArea >= 50_000 || ground >= 25) {
    factors.push({
      label: '건물 규모', value: `연면적 ${bldgArea.toLocaleString()}㎡ · ${ground}F`,
      topDown: 3, bottomUp: 0,
      note: '대규모·고층 — 지상부 조기 착수가 전체 공기에 큰 영향',
    })
  } else if (bldgArea >= 20_000 || ground >= 15) {
    factors.push({
      label: '건물 규모', value: `연면적 ${bldgArea.toLocaleString()}㎡ · ${ground}F`,
      topDown: 2, bottomUp: 0,
      note: '중규모 — 역타 공기 단축 이점 존재',
    })
  } else if (bldgArea > 0 && bldgArea < 10_000) {
    factors.push({
      label: '건물 규모', value: `연면적 ${bldgArea.toLocaleString()}㎡`,
      topDown: 0, bottomUp: 2,
      note: '소규모 — 역타 투자 회수 어려움, 순타가 경제적',
    })
  }

  // 3) 대지 여유 — 대지면적 대비 건축면적
  if (siteArea > 0 && footprint > 0) {
    const coverage = footprint / siteArea
    if (coverage >= 0.7) {
      factors.push({
        label: '대지 여유', value: `건폐율 ${(coverage * 100).toFixed(0)}%`,
        topDown: 3, bottomUp: 0,
        note: '협소 부지 — 가설·흙막이 공간 부족, 역타의 대지 효율 이점',
      })
    } else if (coverage >= 0.5) {
      factors.push({
        label: '대지 여유', value: `건폐율 ${(coverage * 100).toFixed(0)}%`,
        topDown: 1, bottomUp: 1,
        note: '중간 여유 — 공법 선택은 다른 요인 지배',
      })
    } else {
      factors.push({
        label: '대지 여유', value: `건폐율 ${(coverage * 100).toFixed(0)}%`,
        topDown: 0, bottomUp: 2,
        note: '여유 부지 — 오픈 컷·순타 시공 용이',
      })
    }
  }

  // 4) 지반 — 풍화토·풍화암 깊이
  const subDepth = Math.max(wt, wa)
  if (subDepth >= 15) {
    factors.push({
      label: '굴착 심도', value: `풍화암 ${wa}m · 풍화토 ${wt}m`,
      topDown: 3, bottomUp: 0,
      note: '깊은 굴착 — 흙막이 변위·지하수 리스크 높음, 역타로 단계적 지보 유리',
    })
  } else if (subDepth >= 8) {
    factors.push({
      label: '굴착 심도', value: `${subDepth}m`,
      topDown: 1, bottomUp: 1,
      note: '중간 심도 — 지질조사 결과 따라 판단',
    })
  } else if (subDepth > 0 && subDepth < 6) {
    factors.push({
      label: '굴착 심도', value: `${subDepth}m`,
      topDown: 0, bottomUp: 2,
      note: '얕은 굴착 — 오픈 컷 순타가 단순·저렴',
    })
  }

  // 5) 전이층 — 구조 복잡성
  if (p.hasTransfer) {
    factors.push({
      label: '전이층', value: '있음',
      topDown: 1, bottomUp: 1,
      note: '전이층 존재 — 어느 공법이든 구조 복잡성 관리 필요',
    })
  }

  // 6) 저층부 — 포디움 있음 → 역타 시공성 ↑
  if ((p.lowrise ?? 0) >= 3) {
    factors.push({
      label: '포디움 구성', value: `저층부 ${p.lowrise}F`,
      topDown: 1, bottomUp: 0,
      note: '저층부 규모 있음 — 역타 지상 분기 시공 이점',
    })
  }

  // 7) PRD 사전 계획 — up_up 계획 있으면 역타 준비 이미 반영
  if ((p.prdCount ?? 0) > 0) {
    factors.push({
      label: 'PRD 계획', value: `${p.prdCount}공`,
      topDown: 1, bottomUp: 0,
      note: 'PRD 앵커 공수 기입됨 — 역타 체계 사전 설계 존재',
    })
  }

  // ── 합계 ──
  const scoreTop = factors.reduce((s, f) => s + f.topDown, 0)
  const scoreBot = factors.reduce((s, f) => s + f.bottomUp, 0)

  // 결정
  let recommended: MethodKind = 'neutral'
  const diff = scoreTop - scoreBot
  if (diff >= 3) recommended = 'top_down'
  else if (diff <= -3) recommended = 'bottom_up'

  // 이유 조립
  const topFactors = [...factors].sort((a, b) => (b.topDown - b.bottomUp) - (a.topDown - a.bottomUp))
  const leading = topFactors[0]
  let rationale: string
  if (recommended === 'top_down') {
    rationale = `Top-down(역타) 추천. ${leading?.note ?? ''} 지하부와 지상부를 동시 시공해 공기 단축 효과를 얻을 수 있습니다.`
  } else if (recommended === 'bottom_up') {
    const leadBot = [...factors].sort((a, b) => b.bottomUp - a.bottomUp)[0]
    rationale = `Bottom-up(순타) 추천. ${leadBot?.note ?? ''} 역타 전환의 비용·공정 리스크 대비 이점이 작습니다.`
  } else {
    rationale = '두 공법의 점수 차이가 크지 않습니다. 발주처 요구·예산·공기 우선순위에 따라 선택하시기를 권장합니다.'
  }

  // 비용·리스크 메모
  const costNote = recommended === 'top_down'
    ? '역타는 일반적으로 공사비가 순타 대비 8~15% 증가. 영구벽체 선시공·PRD 앵커·철골 슬래브 등이 원가 상승 요인.'
    : recommended === 'bottom_up'
      ? '순타는 공사비 측면에서 유리(업계 기본). 굴착·흙막이·되메우기 공정이 완료된 뒤 상부 구조를 시공.'
      : '비용: 순타 < 역타. 공기: 지하 규모 클수록 역타 우위. 입찰 조건에서 어느 쪽이 가산점인지 확인 필요.'

  const riskNote = recommended === 'top_down'
    ? '리스크: PRD 앵커 품질, 영구벽체 일체성, 슬래브 개구부 유지관리. 지반·계측관리 전문성 필요.'
    : recommended === 'bottom_up'
      ? '리스크: 굴착 중 흙막이 변위·주변 침하. 깊은 지하는 스트럿·어스앵커 시공성 재검토 필요.'
      : '양 공법 모두 시공 경험 보유 여부·협력사 역량이 결정적. 시공성 검토(constructability review) 권장.'

  return {
    scores: { topDown: scoreTop, bottomUp: scoreBot },
    factors,
    recommended,
    rationale,
    costNote,
    riskNote,
  }
}
