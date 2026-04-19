// 새 추출기 검증 — work-samples.txt의 500개에 적용
import fs from 'node:fs'

// ts 파일은 못 쓰니까 로직 복제 (간소화 버전)
const WORK_TYPE_KEYWORDS = [
  { key: '철근', patterns: ['철근배근', '철근 배근', '배근', '철근가공', '철근 가공', '철근'] },
  { key: '형틀', patterns: ['형틀조립', '형틀 조립', '거푸집', '형틀'] },
  { key: '콘크리트', patterns: ['콘크리트 타설', '콘크리트타설', '콘크리트', '레미콘', '타설'] },
  { key: '해체', patterns: ['해체정리', '해체 정리', '해체', '철거', '탈형'] },
  { key: '철골', patterns: ['철골조립', '철골 조립', '내화도장', '브레싱', '앵커', '철골'] },
  { key: '데크', patterns: ['데크 플레이트', '데크플레이트', '데크'] },
  { key: '먹매김', patterns: ['먹매김', '먹메김', '먹줄'] },
  { key: '슬리브', patterns: ['슬리브'] },
  { key: '조적', patterns: ['조적', '블록', '벽돌'] },
  { key: '미장', patterns: ['기계미장', '미장'] },
  { key: '방수', patterns: ['TPO방수', 'TPO 방수', '침투성방수', '침투성 방수', '방수턱', '방수'] },
  { key: '타일', patterns: ['타일'] },
  { key: '석재', patterns: ['석재', '대리석'] },
  { key: '도장', patterns: ['내화도장', '도장', '페인트'] },
  { key: '창호', patterns: ['창호 프레임', '창호프레임', '커튼월 프레임', '커튼월', '창호', 'PL창', '유리'] },
  { key: '외벽판넬', patterns: ['외벽 판넬', '외벽판넬', '판넬 설치', '판넬'] },
  { key: 'AL쉬트', patterns: ['AL쉬트', 'AL 쉬트', '알루미늄쉬트'] },
  { key: '단열재', patterns: ['단열재', '단열', '우레탄 단열'] },
  { key: '석고보드', patterns: ['석고보드', '석고 보드'] },
  { key: '경량벽체', patterns: ['경량벽체', '경량 벽체', '스터드', '경량칸막이'] },
  { key: '내장', patterns: ['내장', '하지틀', '하지 틀', '금속 하지'] },
  { key: '코킹', patterns: ['코킹', '실란트'] },
  { key: '소화배관', patterns: ['소화배관', '소화 배관', '소방배관'] },
  { key: '위생배관', patterns: ['위생배관', '위생 배관', '우수 배관', '오수 배관', '오배수', '급수'] },
  { key: '전열배관', patterns: ['전열배관', '전열 배관', '매입배관', '매입 배관'] },
  { key: '덕트', patterns: ['덕트', '공조덕트'] },
  { key: '배관', patterns: ['지중배관', '배관', '시수', '수관'] },
  { key: '케이블포설', patterns: ['케이블 포설', '케이블포설', '입선', '간선 포설', '포설', '후렉시블'] },
  { key: '케이블트레이', patterns: ['케이블 트레이', '케이블트레이', '트레이'] },
  { key: '전기배선', patterns: ['전기 배선', '전기배선', '접지', '분전함', '통신'] },
  { key: '엘리베이터', patterns: ['엘리베이터', 'E/V', '승강기'] },
  { key: '터파기', patterns: ['터파기'] },
  { key: '토공', patterns: ['토공정리', '뒤채움', '되메우기', '사토', '성토', '집토', '토공'] },
  { key: '골재포설', patterns: ['골재 포설', '골재포설', '보조기층', '다짐'] },
  { key: '맨홀', patterns: ['맨홀', '흉관', '흄관', '집수정', '빗물받이', '연결관'] },
  { key: '옹벽', patterns: ['옹벽 기초', '보강토 옹벽', '옹벽'] },
  { key: '측구', patterns: ['측구', '경계석', '수로관'] },
  { key: '지반개량', patterns: ['지반개량', 'S.C.F', 'SCF'] },
  { key: '가설', patterns: ['가설전기', '가설울타리', '가설사무실', '가설설비', '호이스트', '타워크레인', '투광등', '세륜기', '안전시설물', 'RPP'] },
  { key: '자재반입', patterns: ['자재 반입', '자재반입', '자재 양중', '양중', '자재 하역', '하역'] },
  { key: '청소정리', patterns: ['청소', '정리 정돈', '정리정돈', '자재 정리', '폐기물', '잔손보기'] },
  { key: '양생', patterns: ['양수', '양수관리'] },
  { key: '취부', patterns: ['취부'] },
  { key: '매립', patterns: ['매립'] },
  { key: '설치', patterns: ['설치'] },
  { key: '조립', patterns: ['조립'] },
]

const LOCATION_PATTERNS = [
  { r: /스튜디오\s*(?:동\s*)?(\d)\s*-\s*(\d)/g, b: (m) => `스튜디오 ${m[1]}-${m[2]}` },
  { r: /스튜디오\s*(?:동\s*)?(\d)(?!-|\d)/g, b: (m) => `스튜디오 ${m[1]}` },
  { r: /(\d{1,3})\s*동(?!기)(?!\s*[-\d])/g, b: (m) => `${m[1]}동` },
  { r: /사무동/g, b: () => '사무동' },
  { r: /공용부/g, b: () => '공용부' },
  { r: /지하\s*(\d{1,2})\s*층/g, b: (m) => `B${m[1]}F` },
  { r: /지상\s*(\d{1,2})\s*층/g, b: (m) => `${m[1]}F` },
  { r: /\bB(\d{1,2})F\b/gi, b: (m) => `B${m[1]}F` },
  { r: /(?<![A-Za-z])(\d{1,2})\s*F(?![a-z])/g, b: (m) => `${m[1]}F` },
  { r: /(?<!\d)(\d{1,2})\s*층(?!계)/g, b: (m) => `${m[1]}F` },
  { r: /(PIT층|PIT|지붕층|지붕|옥상|옥탑|관리층|피트|전실|필로티)/g, b: (m) => m[1].toUpperCase().startsWith('PIT') ? 'PIT' : m[1] },
  { r: /(기초|S\.O\.G|SOG|주차장|성토부|옹벽구간|지중배관|배면부|정면부|옥외|노상)/g, b: (m) => m[1] },
  { r: /(외벽|내벽|슬래브|지중보|벽체|바닥|기둥|화장실|천장|파라펫|홈통|엘리베이터실|계단실|전기실|기계실)/g, b: (m) => m[1] },
]

function extract(text) {
  const locs = new Set()
  for (const p of LOCATION_PATTERNS) {
    p.r.lastIndex = 0
    let m
    while ((m = p.r.exec(text)) !== null) locs.add(p.b(m))
  }
  const wts = new Set()
  for (const w of WORK_TYPE_KEYWORDS) {
    for (const pat of w.patterns) {
      if (text.includes(pat)) { wts.add(w.key); break }
    }
  }
  return { locs: Array.from(locs), wts: Array.from(wts) }
}

const samples = fs.readFileSync('scripts/work-samples.txt', 'utf8').split('\n').filter(Boolean)
let hit = { l: 0, w: 0, both: 0 }
const failed = []
for (const s of samples) {
  const r = extract(s)
  if (r.locs.length) hit.l++
  if (r.wts.length) hit.w++
  if (r.locs.length && r.wts.length) hit.both++
  if (r.locs.length === 0 && r.wts.length === 0) failed.push(s)
}

console.log(`총 ${samples.length}건`)
console.log(`위치 검출: ${hit.l} (${Math.round(hit.l/samples.length*100)}%)`)
console.log(`작업 검출: ${hit.w} (${Math.round(hit.w/samples.length*100)}%)`)
console.log(`둘 다:    ${hit.both} (${Math.round(hit.both/samples.length*100)}%)`)
console.log(`미분류:   ${failed.length}`)
console.log('\n── 미분류 샘플 (처음 20개) ──')
for (const s of failed.slice(0, 20)) console.log('·', s)
