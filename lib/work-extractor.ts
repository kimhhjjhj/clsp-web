// 자연어 작업내용 텍스트에서 위치·작업종류 태그 추출 (정규식 기반)
// 파주 스튜디오 등 실제 건설 현장 일보 500+ 샘플 분석 후 튜닝된 사전
// 예: "스튜디오1-1 지중보 콘크리트 타설" → { locations: ['스튜디오 1-1', '지중보'], workTypes: ['콘크리트'] }

export interface ExtractResult {
  locations: string[]  // 위치 (동·층·구역 등 공간)
  parts: string[]      // 건축 부위 (벽체/슬래브/기둥 등 작업 대상)
  workTypes: string[]  // 작업종류 (철근/콘크리트/도장 등)
  rawText: string
}

// 작업종류 사전 (순서 = 매칭 우선순위 높은 것부터)
const WORK_TYPE_KEYWORDS: { key: string; patterns: string[] }[] = [
  // ── 골조 ──
  { key: '철근', patterns: ['철근배근', '철근 배근', '배근', '철근가공', '철근 가공', '철근'] },
  { key: '형틀', patterns: ['형틀조립', '형틀 조립', '거푸집', '형틀'] },
  { key: '콘크리트', patterns: ['콘크리트 타설', '콘크리트타설', '콘크리트', '레미콘', '타설'] },
  { key: '해체', patterns: ['해체정리', '해체 정리', '해체', '철거', '탈형'] },
  { key: '철골', patterns: ['철골조립', '철골 조립', '내화도장', '브레싱', '앵커', '철골'] },
  { key: '데크', patterns: ['데크 플레이트', '데크플레이트', '데크'] },
  { key: '먹매김', patterns: ['먹매김', '먹메김', '먹줄'] },
  { key: '슬리브', patterns: ['슬리브'] },
  // ── 마감 건축 ──
  { key: '조적', patterns: ['조적', '블록', '벽돌'] },
  { key: '미장', patterns: ['기계미장', '미장'] },
  { key: '방수', patterns: ['TPO방수', 'TPO 방수', '침투성방수', '침투성 방수', '방수턱', '방수'] },
  { key: '타일', patterns: ['타일'] },
  { key: '석재', patterns: ['석재', '대리석'] },
  { key: '도장', patterns: ['내화도장', '도장', '페인트'] },
  { key: '도배', patterns: ['도배'] },
  { key: '창호', patterns: ['창호 프레임', '창호프레임', '커튼월 프레임', '커튼월', '창호', 'PL창', '유리'] },
  { key: '외벽판넬', patterns: ['외벽 판넬', '외벽판넬', '판넬 설치', '판넬'] },
  { key: 'AL쉬트', patterns: ['AL쉬트', 'AL 쉬트', '알루미늄쉬트'] },
  { key: '단열재', patterns: ['단열재', '단열', '우레탄 단열'] },
  { key: '석고보드', patterns: ['석고보드', '석고 보드'] },
  { key: '경량벽체', patterns: ['경량벽체', '경량 벽체', '스터드', '경량칸막이'] },
  { key: '내장', patterns: ['내장', '하지틀', '하지 틀', '금속 하지'] },
  { key: '마루', patterns: ['마루'] },
  { key: '천장', patterns: ['천장'] },
  { key: '코킹', patterns: ['코킹', '실란트'] },
  // ── 설비/전기/통신 ──
  { key: '소화배관', patterns: ['소화배관', '소화 배관', '소방배관'] },
  { key: '위생배관', patterns: ['위생배관', '위생 배관', '우수 배관', '오수 배관', '오배수', '급수'] },
  { key: '전열배관', patterns: ['전열배관', '전열 배관', '매입배관', '매입 배관'] },
  { key: '덕트', patterns: ['덕트', '공조덕트'] },
  { key: '배관', patterns: ['지중배관', '배관', '시수', '수관'] },
  { key: '케이블포설', patterns: ['케이블 포설', '케이블포설', '입선', '간선 포설', '포설', '후렉시블'] },
  { key: '케이블트레이', patterns: ['케이블 트레이', '케이블트레이', '트레이'] },
  { key: '전기배선', patterns: ['전기 배선', '전기배선', '접지', '분전함', '통신'] },
  { key: 'EHP', patterns: ['EHP', '에어컨', '냉난방'] },
  { key: '엘리베이터', patterns: ['엘리베이터', 'E/V', '승강기'] },
  { key: '가구', patterns: ['가구', '싱크대'] },
  // ── 토목/외부 ──
  { key: '터파기', patterns: ['터파기'] },
  { key: '토공', patterns: ['토공정리', '뒤채움', '되메우기', '사토', '성토', '집토', '토공'] },
  { key: '골재포설', patterns: ['골재 포설', '골재포설', '보조기층', '다짐'] },
  { key: '맨홀', patterns: ['맨홀', '흉관', '흄관', '집수정', '빗물받이', '연결관'] },
  { key: '옹벽', patterns: ['옹벽 기초', '보강토 옹벽', '옹벽'] },
  { key: '측구', patterns: ['측구', '경계석', '수로관'] },
  { key: '지반개량', patterns: ['지반개량', 'S.C.F', 'SCF'] },
  { key: '조경', patterns: ['조경'] },
  { key: '포장', patterns: ['포장', '아스팔트'] },
  // ── 가설/공통 ──
  { key: '가설', patterns: [
    '가설전기', '가설울타리', '가설사무실', '가설설비', '호이스트',
    '타워크레인', '투광등', '세륜기', '안전시설물', 'RPP',
  ] },
  { key: '자재반입', patterns: ['자재 반입', '자재반입', '자재 양중', '양중', '자재 하역', '하역'] },
  { key: '청소정리', patterns: ['청소', '정리 정돈', '정리정돈', '자재 정리', '폐기물', '잔손보기'] },
  { key: '양생', patterns: ['양수', '양수관리'] },
  // ── 일반 시공 동사(약한 신호, 마지막에) ──
  { key: '취부', patterns: ['취부'] },
  { key: '매립', patterns: ['매립'] },
  { key: '설치', patterns: ['설치'] },
  { key: '조립', patterns: ['조립'] },
]

// 위치 태그 정규식
interface LocationPattern {
  regex: RegExp
  build: (m: RegExpExecArray) => string
}

const LOCATION_PATTERNS: LocationPattern[] = [
  // 파주 스튜디오 특화: "스튜디오 1-2", "스튜디오1-1", "스튜디오동 1" 등
  { regex: /스튜디오\s*(?:동\s*)?(\d)\s*-\s*(\d)/g, build: m => `스튜디오 ${m[1]}-${m[2]}` },
  { regex: /스튜디오\s*(?:동\s*)?(\d)(?!-|\d)/g, build: m => `스튜디오 ${m[1]}` },
  // 일반 아파트 빌딩: "101동", "102동"
  { regex: /(\d{1,3})\s*동(?!기)(?!\s*[-\d])/g, build: m => `${m[1]}동` },
  // 구역/구분: 사무동, 공용부
  { regex: /사무동/g, build: () => '사무동' },
  { regex: /공용부/g, build: () => '공용부' },
  // 층 표기 (한국어/영어 혼용)
  { regex: /지하\s*(\d{1,2})\s*층/g, build: m => `B${m[1]}F` },
  { regex: /지상\s*(\d{1,2})\s*층/g, build: m => `${m[1]}F` },
  { regex: /\bB(\d{1,2})F\b/gi, build: m => `B${m[1]}F` },
  { regex: /(?<![A-Za-z])(\d{1,2})\s*F(?![a-z])/g, build: m => `${m[1]}F` },
  { regex: /(?<!\d)(\d{1,2})\s*층(?!계)/g, build: m => `${m[1]}F` },
  // 특수 부위/층
  {
    regex: /(PIT층|PIT|지붕층|지붕|옥상|옥탑|관리층|피트|전실|필로티)/g,
    build: m => m[1].toUpperCase().startsWith('PIT') ? 'PIT' : m[1],
  },
  // 외부/외장 구역
  {
    regex: /(기초|S\.O\.G|SOG|주차장|성토부|옹벽구간|지중배관|배면부|정면부|옥외|노상)/g,
    build: m => m[1],
  },
]

// 건축 부위 (작업 대상) — 위치와 별개
const PART_KEYWORDS: { key: string; patterns: string[] }[] = [
  { key: '경량벽체', patterns: ['경량벽체', '경량 벽체', '경량칸막이'] },
  { key: '외벽', patterns: ['외벽'] },
  { key: '내벽', patterns: ['내벽'] },
  { key: '벽체', patterns: ['벽체'] },
  { key: '슬래브', patterns: ['슬래브'] },
  { key: '지중보', patterns: ['지중보'] },
  { key: '바닥', patterns: ['바닥'] },
  { key: '기둥', patterns: ['기둥'] },
  { key: '화장실', patterns: ['화장실'] },
  { key: '천장', patterns: ['천장', '천정'] },
  { key: '파라펫', patterns: ['파라펫'] },
  { key: '홈통', patterns: ['홈통'] },
  { key: '엘리베이터실', patterns: ['엘리베이터실', 'E/V실'] },
  { key: '계단실', patterns: ['계단실'] },
  { key: '전기실', patterns: ['전기실'] },
  { key: '기계실', patterns: ['기계실'] },
  { key: '세대', patterns: ['세대 내부', '세대벽체', '세대'] },
  { key: '경비실', patterns: ['경비실'] },
]

export function extractFromText(text: string): ExtractResult {
  if (!text || !text.trim()) {
    return { locations: [], parts: [], workTypes: [], rawText: '' }
  }

  // 위치 추출
  const locationSet = new Set<string>()
  for (const pat of LOCATION_PATTERNS) {
    pat.regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = pat.regex.exec(text)) !== null) {
      const tag = pat.build(m).trim()
      if (tag) locationSet.add(tag)
    }
  }

  // 부위 추출
  const partSet = new Set<string>()
  for (const p of PART_KEYWORDS) {
    for (const kw of p.patterns) {
      if (text.includes(kw)) {
        partSet.add(p.key)
        break
      }
    }
  }

  // 작업종류 추출
  const workTypeSet = new Set<string>()
  for (const wt of WORK_TYPE_KEYWORDS) {
    for (const p of wt.patterns) {
      if (text.includes(p)) {
        workTypeSet.add(wt.key)
        break
      }
    }
  }

  return {
    locations: Array.from(locationSet).sort(locationSort),
    parts: Array.from(partSet),
    workTypes: Array.from(workTypeSet),
    rawText: text,
  }
}

function locationSort(a: string, b: string): number {
  const na = parseInt(a.match(/\d+/)?.[0] ?? '9999', 10)
  const nb = parseInt(b.match(/\d+/)?.[0] ?? '9999', 10)
  if (na !== nb) return na - nb
  return a.localeCompare(b)
}

export function extractFromItems(items: string[]): ExtractResult[] {
  return items.map(extractFromText)
}
