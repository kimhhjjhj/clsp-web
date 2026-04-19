// 부록 4 — 공종별 1일 작업량 (국토부 가이드라인 p.26~27, 부록 4 p.95~117)
// 표준품셈 기반. 현장 여건에 따라 ±30% 변동 가능.
// 현재 CP_DB와 교차 참조용.

export interface DailyOutputEntry {
  name: string              // 공종·작업명
  unit: string              // 단위
  amount: number            // 1일 작업량
  note?: string             // 조건·가정
  category: string          // 대분류
}

export const DAILY_OUTPUT: DailyOutputEntry[] = [
  // ── 토공사 ──
  { category: '토공사', name: '터파기(풍화토)',     unit: 'm3', amount: 350,  note: '백호 0.8m³ 기준' },
  { category: '토공사', name: '터파기(풍화암)',     unit: 'm3', amount: 250,  note: '파워쇼벨+브레이커' },
  { category: '토공사', name: '터파기(연암)',       unit: 'm3', amount: 150,  note: '화약 발파 포함' },
  { category: '토공사', name: '터파기(경암)',       unit: 'm3', amount: 80,   note: '대형 브레이커·발파' },
  { category: '토공사', name: '되메우기·다짐',      unit: 'm3', amount: 400,  note: '진동롤러' },
  { category: '토공사', name: '성토·다짐',          unit: 'm3', amount: 500 },

  // ── 흙막이 ──
  { category: '흙막이',   name: 'CIP(철근망)',      unit: 'm',  amount: 100,  note: 'Φ500 기준' },
  { category: '흙막이',   name: 'CIP(H-BEAM)',      unit: 'm',  amount: 70 },
  { category: '흙막이',   name: '캠빔(웨일러)',     unit: 'm',  amount: 30 },
  { category: '흙막이',   name: '스트럿 가설',      unit: 'ton', amount: 5,   note: 'H-300 기준' },
  { category: '흙막이',   name: 'SGR 그라우팅',     unit: 'm',  amount: 300 },
  { category: '흙막이',   name: 'PRD 천공',         unit: '공', amount: 1.25, note: '1~1.5공/일 평균' },

  // ── 철근콘크리트 ──
  { category: '철근콘크리트', name: '철근 가공·조립',     unit: 'ton', amount: 12,   note: '일반 구조' },
  { category: '철근콘크리트', name: '형틀 조립',           unit: 'm2',  amount: 320,  note: '벽·슬래브' },
  { category: '철근콘크리트', name: '거푸집 해체',         unit: 'm2',  amount: 500 },
  { category: '철근콘크리트', name: '콘크리트 타설(펌프)', unit: 'm3',  amount: 930,  note: '경험치(p.27), 80m³/hr 펌프' },
  { category: '철근콘크리트', name: '콘크리트 타설(표준)', unit: 'm3',  amount: 104,  note: '표준품셈 단일 작업조' },
  { category: '철근콘크리트', name: '데크 플레이트 설치',  unit: 'm2',  amount: 440 },

  // ── 철골 ──
  { category: '철골공사', name: '철골 세우기',       unit: 'ton', amount: 50,   note: '80MT 크레인' },
  { category: '철골공사', name: '고력볼트 조립',     unit: '개',  amount: 500 },
  { category: '철골공사', name: '내화피복',          unit: 'm2',  amount: 150 },

  // ── 포장 ──
  { category: '포장공사', name: '린콘크리트 포설',   unit: 'm3',  amount: 550 },
  { category: '포장공사', name: '콘크리트 표층(1차로)', unit: 'm3', amount: 300 },
  { category: '포장공사', name: '콘크리트 표층(2차로)', unit: 'm3', amount: 700 },
  { category: '포장공사', name: '아스팔트 포장',       unit: 'ton', amount: 800 },

  // ── 마감 (일반 공동주택) ──
  { category: '마감공사', name: '조적(벽돌)',       unit: 'm2', amount: 25 },
  { category: '마감공사', name: '미장(기계)',       unit: 'm2', amount: 80 },
  { category: '마감공사', name: '방수(도막)',       unit: 'm2', amount: 100 },
  { category: '마감공사', name: '타일 붙임',        unit: 'm2', amount: 30,  note: '세면실·주방 타일' },
  { category: '마감공사', name: '도장(외벽)',       unit: 'm2', amount: 60 },
  { category: '마감공사', name: '도장(내벽)',       unit: 'm2', amount: 100 },
  { category: '마감공사', name: '도배',             unit: 'm2', amount: 80 },
  { category: '마감공사', name: '마루 시공',        unit: 'm2', amount: 50 },
  { category: '마감공사', name: '천장 마감',        unit: 'm2', amount: 40 },
  { category: '마감공사', name: '창호 설치(PL)',    unit: '개', amount: 10 },
  { category: '마감공사', name: '가구 설치(세대)',  unit: '세대', amount: 1.5 },

  // ── 기계·설비 ──
  { category: '설비공사', name: '위생 배관',        unit: 'm',  amount: 50 },
  { category: '설비공사', name: '급수·급탕 배관',   unit: 'm',  amount: 40 },
  { category: '설비공사', name: '오배수 배관',      unit: 'm',  amount: 45 },
  { category: '설비공사', name: '덕트 설치',        unit: 'm2', amount: 60 },
  { category: '설비공사', name: '자동제어',         unit: '점', amount: 15 },

  // ── 전기·통신 ──
  { category: '전기공사', name: '전선관 매입',      unit: 'm',  amount: 80 },
  { category: '전기공사', name: '케이블 포설',      unit: 'm',  amount: 300 },
  { category: '전기공사', name: '케이블 트레이',    unit: 'm',  amount: 50 },
  { category: '전기공사', name: '수변전설비',       unit: '식', amount: 0.1, note: '10일/식' },
  { category: '전기공사', name: '분전함 설치',      unit: '개', amount: 4 },
]

/** 공종·단위로 표준 1일 작업량 조회 (fuzzy 이름 매칭) */
export function findDailyOutput(taskName: string, unit?: string): DailyOutputEntry | null {
  const needle = taskName.toLowerCase().replace(/\s/g, '')
  for (const e of DAILY_OUTPUT) {
    const haystack = e.name.toLowerCase().replace(/\s/g, '')
    if ((haystack.includes(needle) || needle.includes(haystack)) && (!unit || e.unit === unit)) {
      return e
    }
  }
  return null
}

/** 대분류별 그룹 */
export function dailyOutputByCategory(category: string): DailyOutputEntry[] {
  return DAILY_OUTPUT.filter(e => e.category === category)
}
