// 부록 1 — 2026~2035 법정공휴일 월별 (국토부 가이드라인 p.17)
// 관공서의 공휴일에 관한 규정 + 대체공휴일 반영

/** [년도][월(0-11)] → 월간 법정공휴일 수 */
export const LEGAL_HOLIDAYS: Record<number, number[]> = {
  2026: [5, 7, 6, 4, 7, 5, 4, 7, 7, 7, 5, 5],   // 연 69일
  2027: [6, 7, 5, 4, 7, 4, 4, 6, 7, 8, 4, 6],   // 연 68일
  2028: [9, 4, 5, 5, 6, 5, 5, 5, 4, 10, 4, 6],  // 연 68일
  2029: [5, 7, 5, 5, 7, 5, 5, 5, 8, 6, 4, 6],   // 연 68일
  2030: [5, 7, 6, 4, 6, 6, 4, 5, 8, 6, 4, 6],   // 연 67일
  2031: [8, 4, 7, 4, 6, 6, 4, 6, 5, 8, 5, 5],   // 연 68일
  2032: [5, 8, 5, 4, 7, 4, 4, 6, 7, 8, 4, 6],   // 연 68일
  2033: [7, 6, 5, 4, 7, 5, 5, 5, 7, 7, 4, 5],   // 연 67일
  2034: [5, 7, 5, 5, 6, 5, 5, 5, 7, 7, 4, 6],   // 연 67일
  2035: [5, 7, 5, 5, 7, 5, 5, 5, 8, 6, 4, 6],   // 연 68일
}

/** 특정 연도·월의 법정공휴일 수 반환. 범위 밖이면 평균 68/12 = 5.67 근사. */
export function legalHolidays(year: number, month0: number): number {
  const yr = LEGAL_HOLIDAYS[year]
  if (yr && yr[month0] != null) return yr[month0]
  return 5.67
}

/** 연간 법정공휴일 합계 (2026~2035 범위 밖은 68일 기본) */
export function legalHolidaysPerYear(year: number): number {
  const yr = LEGAL_HOLIDAYS[year]
  if (!yr) return 68
  return yr.reduce((s, v) => s + v, 0)
}
