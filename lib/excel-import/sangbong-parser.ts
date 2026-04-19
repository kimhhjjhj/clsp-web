// 상봉동 누적형 일보 파서
// 구조: 한 시트에 약 100행짜리 일보 블록이 세로로 반복 누적
// 블록 구분자: 첫 셀에 "공사일보" 타이틀

import * as XLSX from 'xlsx'
import type { ManpowerEntry, WeatherRow } from './paju-parser'

export interface SangbongDayData {
  date: string
  dayOfWeek?: string
  weather: string | null
  tempMin: number | null
  tempMax: number | null
  manpower: {
    trade: string
    company: string
    yesterday: number
    today: number
    total: number
  }[]
  materials: { name: string; spec: string; today: number; prev: number; total: number; design?: number }[]
  equipment: { name: string; spec: string; today: number; yesterday: number; total: number }[]
  workToday: string[]
  workTomorrow: string[]
  notes: string[]
}

export interface SangbongParseResult {
  format: 'sangbong'
  fileName: string
  projectNameGuess: string
  days: SangbongDayData[]
  dateRange: { start: string; end: string } | null
  totalBlocks: number
  warnings: string[]
}

function normStr(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  return String(v).trim()
}

function noSpace(v: unknown): string {
  return normStr(v).replace(/\s+/g, '')
}

function toISODate(v: unknown): string | null {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    // 엑셀 수식 누적 오차 보정: 22시 이후면 다음날로 반올림
    // (=F_prev+1 수식이 수백번 반복되면서 23:59:08 식으로 밀림)
    const d = new Date(v.getTime())
    if (d.getHours() >= 22) {
      d.setDate(d.getDate() + 1)
      d.setHours(0, 0, 0, 0)
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  if (typeof v === 'number') {
    // 시리얼 숫자 + 시간 부분 반올림
    const rounded = Math.round(v)
    const d = XLSX.SSF.parse_date_code(rounded)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  return null
}

function parseTemp(v: unknown): number | null {
  const s = normStr(v)
  if (!s) return null
  const m = s.match(/(-?\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : null
}

// 블록 시작 행 찾기
function findBlockStarts(data: unknown[][]): number[] {
  const starts: number[] = []
  for (let r = 0; r < data.length; r++) {
    const row = data[r]
    if (!row) continue
    for (let c = 0; c < Math.min(row.length, 3); c++) {
      if (noSpace(row[c]) === '공사일보') {
        starts.push(r)
        break
      }
    }
  }
  return starts
}

// 한 블록 안에서 특정 키워드가 있는 행 찾기 (컬럼 A)
function findRowInBlock(
  data: unknown[][],
  start: number,
  end: number,
  keyword: string,
): number {
  for (let r = start; r < end; r++) {
    if (noSpace(data[r]?.[0]) === keyword) return r
  }
  return -1
}

function parseBlock(data: unknown[][], start: number, end: number): SangbongDayData | null {
  // 날짜 감지: 블록 내에서 셀이 Date 타입인 첫 값 사용
  let date: string | null = null
  let weather: string | null = null
  let tempMin: number | null = null
  let tempMax: number | null = null

  for (let r = start; r < Math.min(start + 6, end); r++) {
    const row = data[r]
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      const iso = toISODate(row[c])
      if (iso && !date) {
        date = iso
      }
    }
    // 기상 정보: 행 안에서 "맑음/흐림/비/눈" + 숫자+℃ 패턴 찾기
    if (!weather) {
      for (let c = 0; c < row.length; c++) {
        const s = normStr(row[c])
        if (/^(맑음|흐림|비|눈|구름많음|구름|강풍)/.test(s)) {
          weather = s
        }
      }
    }
    for (let c = 0; c < row.length; c++) {
      const s = normStr(row[c])
      const m = s.match(/(-?\d+(?:\.\d+)?)℃/)
      if (m) {
        const n = Number(m[1])
        if (tempMin == null) tempMin = n
        else if (n !== tempMin && tempMax == null) tempMax = n
      }
    }
  }

  if (!date) return null

  // min/max 정렬
  if (tempMin != null && tempMax != null && tempMin > tempMax) {
    ;[tempMin, tempMax] = [tempMax, tempMin]
  }

  // 섹션 경계 찾기
  const workTodayRow = findRowInBlock(data, start, end, '금일작업내용')
  const workTomorrowRow = findRowInBlock(data, start, end, '명일작업내용')
  const notesRow = findRowInBlock(data, start, end, '특기사항')
  let materialRow = -1
  let equipmentRow = -1
  for (let r = start; r < end; r++) {
    const s = noSpace(data[r]?.[0])
    if (materialRow < 0 && s.startsWith('자재투입현황')) materialRow = r
    if (equipmentRow < 0 && s.startsWith('장비투입현황')) equipmentRow = r
  }

  // 업체별 투입인원 헤더 찾기 (컬럼 I에 "공종", L에 "업체명")
  let manpowerHeaderRow = -1
  for (let r = start; r < end; r++) {
    if (noSpace(data[r]?.[8]) === '공종' && noSpace(data[r]?.[11]) === '업체명') {
      manpowerHeaderRow = r
      break
    }
  }

  // 총계 행 찾기 (I열에 "총계")
  let totalRow = -1
  for (let r = (manpowerHeaderRow > 0 ? manpowerHeaderRow : start); r < end; r++) {
    if (noSpace(data[r]?.[8]) === '총계') {
      totalRow = r
      break
    }
  }

  // 업체별 투입인원 파싱 (I, J, L, M, N, O)
  const manpower: SangbongDayData['manpower'] = []
  let lastBigCat = ''
  let lastSubTrade = ''
  let lastCompany = ''
  if (manpowerHeaderRow > 0) {
    const mpEnd = totalRow > 0 ? totalRow : manpowerHeaderRow + 50
    for (let r = manpowerHeaderRow + 1; r < mpEnd; r++) {
      const row = data[r]
      if (!row) continue
      const bigCat = normStr(row[8])   // I (대분류)
      const subTrade = normStr(row[9]) // J (세부 공종)
      const company = normStr(row[11]) // L (업체명)
      const yest = Number(row[12] ?? 0) // M
      const today = Number(row[13] ?? 0) // N
      const total = Number(row[14] ?? 0) // O

      if (bigCat) lastBigCat = bigCat
      if (subTrade) lastSubTrade = subTrade
      if (company) lastCompany = company

      // 세부공종이나 대분류 중 하나는 있어야 행 유효
      const trade = subTrade || lastSubTrade || bigCat || lastBigCat
      if (!trade) continue
      if (!Number.isFinite(today) && !Number.isFinite(total)) continue
      // 금일/누계 둘 다 0이면 skip (의미없음)
      if (today === 0 && total === 0 && yest === 0) continue

      manpower.push({
        trade,
        company: company || lastCompany,
        yesterday: Number.isFinite(yest) ? yest : 0,
        today: Number.isFinite(today) ? today : 0,
        total: Number.isFinite(total) ? total : 0,
      })
    }
  }

  // 금일/명일/특기사항 텍스트 수집 (A, E 컬럼, 섹션 범위 내)
  function collectTexts(sectionStart: number, sectionEnd: number): string[] {
    if (sectionStart < 0) return []
    const texts: string[] = []
    for (let r = sectionStart + 1; r < sectionEnd; r++) {
      const row = data[r]
      if (!row) continue
      for (const col of [0, 4]) {
        const s = normStr(row[col])
        if (!s) continue
        if (/^(공\s*사\s*일\s*보|금\s*일\s*작\s*업|명\s*일\s*작\s*업|특\s*기\s*사\s*항|총\s*계|공\s*종|자재\s*투입|장비\s*투입|토공\s*작업)/.test(s.replace(/\s+/g, ' '))) continue
        if (s.length < 2) continue
        texts.push(s)
      }
    }
    // 중복 제거
    return Array.from(new Set(texts))
  }

  const workTodayEnd = workTomorrowRow > 0 ? workTomorrowRow : (notesRow > 0 ? notesRow : end)
  const workTomorrowEnd = notesRow > 0 ? notesRow : end
  const notesEnd = materialRow > 0 ? materialRow : (equipmentRow > 0 ? equipmentRow : end)

  const workToday = workTodayRow > 0 ? collectTexts(workTodayRow, workTodayEnd) : []
  const workTomorrow = workTomorrowRow > 0 ? collectTexts(workTomorrowRow, workTomorrowEnd) : []
  const notes = notesRow > 0 ? collectTexts(notesRow, notesEnd) : []

  // 자재 파싱 (좌측: A=품명, B=규격, C=설계, D=전회, E=금회, F=누계 / 우측: H,I,K,L,M,N)
  const materials: SangbongDayData['materials'] = []
  if (materialRow > 0) {
    const matEnd = equipmentRow > 0 ? equipmentRow : Math.min(materialRow + 20, end)
    let lastLeftName = ''
    let lastRightName = ''
    for (let r = materialRow + 2; r < matEnd; r++) {
      const row = data[r]
      if (!row) continue
      // 좌측 세트
      const lName = normStr(row[0])
      const lSpec = normStr(row[1])
      const lToday = Number(row[4] ?? 0)
      const lPrev = Number(row[3] ?? 0)
      const lTotal = Number(row[5] ?? 0)
      const lDesign = Number(row[2] ?? 0)
      if (lName) lastLeftName = lName
      const effLeft = lName || lastLeftName
      if (effLeft && !/^(소\s*계|총\s*계)$/.test(effLeft) && (lToday > 0 || lTotal > 0 || lPrev > 0)) {
        materials.push({
          name: effLeft,
          spec: lSpec,
          today: Number.isFinite(lToday) ? lToday : 0,
          prev: Number.isFinite(lPrev) ? lPrev : 0,
          total: Number.isFinite(lTotal) ? lTotal : 0,
          design: Number.isFinite(lDesign) && lDesign > 0 ? lDesign : undefined,
        })
      }
      // 우측 세트 (H=7, I=8, K=10, L=11, M=12, N=13)
      const rName = normStr(row[7])
      const rSpec = normStr(row[8])
      const rDesign = Number(row[10] ?? 0)
      const rPrev = Number(row[11] ?? 0)
      const rToday = Number(row[12] ?? 0)
      const rTotal = Number(row[13] ?? 0)
      if (rName) lastRightName = rName
      const effRight = rName || lastRightName
      if (effRight && !/^(소\s*계|총\s*계)$/.test(effRight) && (rToday > 0 || rTotal > 0 || rPrev > 0)) {
        materials.push({
          name: effRight,
          spec: rSpec,
          today: Number.isFinite(rToday) ? rToday : 0,
          prev: Number.isFinite(rPrev) ? rPrev : 0,
          total: Number.isFinite(rTotal) ? rTotal : 0,
          design: Number.isFinite(rDesign) && rDesign > 0 ? rDesign : undefined,
        })
      }
    }
  }

  // 장비 파싱 (좌측: A=장비명, C=규격, E=전일, F=금일, G=누계 / 우측: H,K,M,N,O)
  const equipment: SangbongDayData['equipment'] = []
  if (equipmentRow > 0) {
    const eqEnd = Math.min(equipmentRow + 30, end)
    for (let r = equipmentRow + 2; r < eqEnd; r++) {
      const row = data[r]
      if (!row) continue
      // 좌측
      const lName = normStr(row[0])
      const lSpec = normStr(row[2])
      const lYest = Number(row[4] ?? 0)
      const lToday = Number(row[5] ?? 0)
      const lTotal = Number(row[6] ?? 0)
      if (lName && !/^(소\s*계|총\s*계|장비|장 비)/.test(lName) && (lToday > 0 || lTotal > 0)) {
        equipment.push({
          name: lName,
          spec: lSpec,
          yesterday: Number.isFinite(lYest) ? lYest : 0,
          today: Number.isFinite(lToday) ? lToday : 0,
          total: Number.isFinite(lTotal) ? lTotal : 0,
        })
      }
      // 우측 (H=7, K=10, M=12, N=13, O=14)
      const rName = normStr(row[7])
      const rSpec = normStr(row[10])
      const rYest = Number(row[12] ?? 0)
      const rToday = Number(row[13] ?? 0)
      const rTotal = Number(row[14] ?? 0)
      if (rName && !/^(소\s*계|총\s*계|장비|장 비)/.test(rName) && (rToday > 0 || rTotal > 0)) {
        equipment.push({
          name: rName,
          spec: rSpec,
          yesterday: Number.isFinite(rYest) ? rYest : 0,
          today: Number.isFinite(rToday) ? rToday : 0,
          total: Number.isFinite(rTotal) ? rTotal : 0,
        })
      }
    }
  }

  return {
    date,
    weather,
    tempMin,
    tempMax,
    manpower,
    materials,
    equipment,
    workToday,
    workTomorrow,
    notes,
  }
}

function guessProjectName(wb: XLSX.WorkBook): string {
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
  for (const row of data.slice(0, 10)) {
    for (const cell of row) {
      const s = normStr(cell)
      if (s.includes('공사') && !s.includes('공사일보') && s.length < 50) {
        // "▣ 고양 지축 B-7BL 기업형 임대주택 신축공사" → 앞 기호 제거
        return s.replace(/^[▣▶▷◇◆■□●○·\s]+/, '').trim()
      }
    }
  }
  return '임포트된 프로젝트'
}

export function parseSangbongExcel(
  buffer: ArrayBuffer,
  fileName: string,
): SangbongParseResult {
  const wb = XLSX.read(buffer, { cellDates: true, type: 'array' })
  const warnings: string[] = []
  const daysMap = new Map<string, SangbongDayData>()
  let totalBlocks = 0

  // 모든 시트를 순회하며 "공사일보" 블록이 있는 시트만 처리
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
      blankrows: true,
    })
    const starts = findBlockStarts(data)
    if (starts.length === 0) continue

    totalBlocks += starts.length

    for (let i = 0; i < starts.length; i++) {
      const blockStart = starts[i]
      const blockEnd = starts[i + 1] ?? Math.min(blockStart + 200, data.length)
      const parsed = parseBlock(data, blockStart, blockEnd)
      if (!parsed) continue
      // 같은 날짜 중복 시, manpower가 더 많은 것 선택
      const existing = daysMap.get(parsed.date)
      if (!existing || parsed.manpower.length > existing.manpower.length) {
        daysMap.set(parsed.date, parsed)
      }
    }
  }

  if (totalBlocks === 0) {
    warnings.push('"공사일보" 타이틀을 찾을 수 없습니다. 상봉동 포맷이 맞나요?')
  }

  const days = Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  const dateRange = days.length > 0
    ? { start: days[0].date, end: days[days.length - 1].date }
    : null

  return {
    format: 'sangbong',
    fileName,
    projectNameGuess: guessProjectName(wb),
    days,
    dateRange,
    totalBlocks,
    warnings,
  }
}
