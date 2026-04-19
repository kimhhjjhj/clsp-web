// 부록 2 — 공종별 작업제한 기상조건 (국토부 가이드라인 p.14, 28~36)
// 산업안전보건기준 + 건설기준 반영

export interface ClimateLimits {
  rainMm?: number        // 일강수량 기준 (mm 이상이면 작업 불가)
  hotExtreme?: boolean   // 혹서기 체감온도 33℃ 이상 적용 여부
  coldBelowZero?: boolean // 동절기 최저/최고기온 0℃ 이하 적용 여부
  snowCm?: number        // 신적설 기준 (cm 이상 불가)
  windMS?: number        // 최대순간풍속 m/s (이상 불가)
  dustBad?: boolean      // 미세먼지(PM2.5) 나쁨 등급 이상 불가
}

/** 공종별 적용 기준 (가이드라인 p.14 표 + 부록 2 전체) */
export const CLIMATE_RULES: Record<string, ClimateLimits> = {
  // 옥외 공사 (토공·가시설·포장 등)
  '토공사':       { rainMm: 3,  hotExtreme: true,  coldBelowZero: true, snowCm: 5, windMS: 15 },
  '가시설공사':   { rainMm: 3,  hotExtreme: true,  coldBelowZero: true, snowCm: 5, windMS: 15 },
  '포장공사':     { rainMm: 3,  hotExtreme: true,  coldBelowZero: true, snowCm: 5, windMS: 15 },
  '옹벽공사':     { rainMm: 3,  hotExtreme: true,  coldBelowZero: true, snowCm: 5, windMS: 15 },
  // 구조물 공사 (콘크리트 타설) — 미세먼지까지 적용
  '철근콘크리트': { rainMm: 3,  hotExtreme: true,  coldBelowZero: true, snowCm: 5, windMS: 15, dustBad: true },
  '콘크리트타설': { rainMm: 3,  hotExtreme: true,  coldBelowZero: true, snowCm: 5, windMS: 15, dustBad: true },
  '철골공사':     { rainMm: 3,  hotExtreme: true,  coldBelowZero: true, snowCm: 5, windMS: 15 },
  // 터널·옥내 공사 — 강우·바람 영향 적음, 기온 위주
  '터널공사':     { hotExtreme: true, coldBelowZero: true, dustBad: true },
  '옥내공사':     { hotExtreme: true, coldBelowZero: true },
  '마감공사':     { hotExtreme: true, coldBelowZero: true },
  // 양중 장비 (타워크레인·호이스트) — 바람 민감
  '타워크레인':   { windMS: 10 }, // 10m/s 초과 설치·해체 중지, 15m/s 초과 운행 제한
  '호이스트':     { windMS: 15 },
}

/** 공종 키워드가 포함된 규칙 조회 (fuzzy) */
export function climateRulesFor(taskCategory: string): ClimateLimits | null {
  for (const [k, v] of Object.entries(CLIMATE_RULES)) {
    if (taskCategory.includes(k) || k.includes(taskCategory)) return v
  }
  return null
}
