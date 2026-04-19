import * as XLSX from 'xlsx'

export interface ManpowerEntry {
  trade: string
  count: number
}

export interface ManpowerRow {
  date: string
  dayOfWeek: string
  entries: ManpowerEntry[]
  totalCount: number
}

export interface WeatherRow {
  date: string
  dayOfWeek: string
  weather: string | null
  tempMin: number | null
  tempMax: number | null
  raw: string
}

export interface MaterialEntry {
  name: string
  spec: string
  unit?: string
  quantity: number
  vendor?: string
  workName?: string
}

export interface EquipmentEntry {
  name: string
  spec: string
  count: number
  total?: number
  workName?: string
}

export interface SiteData {
  siteLabel: '1' | '2'
  manpower: ManpowerRow[]
  workDone: Record<string, string[]>
  workPlan: Record<string, string[]>
  notes: Record<string, string[]>
  materials: Record<string, MaterialEntry[]>
  equipment: Record<string, EquipmentEntry[]>
  totalDays: number
  dateRange: { start: string; end: string } | null
  trades: string[]
}

export interface PajuParseResult {
  format: 'paju'
  fileName: string
  projectNameGuess: string
  weather: WeatherRow[]
  sites: SiteData[]
  warnings: string[]
}

function toISODate(v: unknown): string | null {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    // 엑셀 수식 누적 오차 보정: 22시 이후면 다음날로 반올림
    const d = new Date(v.getTime())
    if (d.getHours() >= 22) {
      d.setDate(d.getDate() + 1)
      d.setHours(0, 0, 0, 0)
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  if (typeof v === 'number') {
    const rounded = Math.round(v)
    const d = XLSX.SSF.parse_date_code(rounded)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  return null
}

function parseWeatherCell(cell: unknown): {
  weather: string | null
  tempMin: number | null
  tempMax: number | null
} {
  if (cell == null) return { weather: null, tempMin: null, tempMax: null }
  const s = String(cell).trim()
  if (!s) return { weather: null, tempMin: null, tempMax: null }

  const match = s.match(/^(.+?)\s*\(\s*(-?\d+(?:\.\d+)?)\s*℃?\s*\/\s*(-?\d+(?:\.\d+)?)\s*℃?\s*\)/)
  if (match) {
    return {
      weather: match[1].trim(),
      tempMin: Number(match[2]),
      tempMax: Number(match[3]),
    }
  }
  return { weather: s, tempMin: null, tempMax: null }
}

function parseManpowerSheet(ws: XLSX.WorkSheet, siteLabel: '1' | '2'): SiteData {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false })

  const headerRow = data[1] ?? []
  const trades: { col: number; trade: string }[] = []
  for (let c = 2; c < headerRow.length; c++) {
    const v = String(headerRow[c] ?? '').trim().replace(/\s+/g, ' ')
    if (!v || v === '요일' || v === '비고') continue
    trades.push({ col: c, trade: v })
  }

  const manpower: ManpowerRow[] = []
  let firstDate: string | null = null
  let lastDate: string | null = null

  for (let r = 2; r < data.length; r++) {
    const row = data[r]
    const iso = toISODate(row[0])
    if (!iso) continue
    const dow = String(row[1] ?? '').trim()

    const entries: ManpowerEntry[] = []
    let totalCount = 0
    for (const { col, trade } of trades) {
      const raw = row[col]
      if (raw === '' || raw == null) continue
      const n = Number(raw)
      if (!Number.isFinite(n) || n === 0) continue
      entries.push({ trade, count: n })
      totalCount += n
    }

    manpower.push({ date: iso, dayOfWeek: dow, entries, totalCount })
    if (!firstDate || iso < firstDate) firstDate = iso
    if (!lastDate || iso > lastDate) lastDate = iso
  }

  return {
    siteLabel,
    manpower,
    workDone: {},
    workPlan: {},
    notes: {},
    materials: {},
    equipment: {},
    totalDays: manpower.length,
    dateRange: firstDate && lastDate ? { start: firstDate, end: lastDate } : null,
    trades: trades.map(t => t.trade),
  }
}

// 가로로 블록 나열된 시트(자재반입/장비투입)를 파싱.
// R3의 sub-header(품명/규격... or 장비명/규격...)에서 "품명"/"장비명" 위치를 찾아 블록 경계 정함.
function parseBlockedSheet<T>(
  ws: XLSX.WorkSheet,
  opts: {
    nameField: '품명' | '장비명'
    fieldMap: Record<string, keyof T | null>
    quantityFields: string[]
    buildEntry: (fields: Record<string, string | number>) => T | null
  },
): Record<string, T[]> {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false })

  // sub-header가 있는 행 찾기 (C열 이후에 nameField가 나오는 행)
  let subHeaderRow = -1
  for (let r = 0; r < Math.min(8, data.length); r++) {
    const row = data[r]
    for (let c = 2; c < row.length; c++) {
      if (String(row[c] ?? '').trim() === opts.nameField) {
        subHeaderRow = r
        break
      }
    }
    if (subHeaderRow >= 0) break
  }
  if (subHeaderRow < 0) return {}

  const headerRow = data[subHeaderRow]
  // 각 블록의 시작 컬럼 찾기
  const blockStarts: number[] = []
  for (let c = 2; c < headerRow.length; c++) {
    if (String(headerRow[c] ?? '').trim() === opts.nameField) {
      blockStarts.push(c)
    }
  }

  // 각 블록의 필드 맵: { 품명: colA, 규격: colB, ... }
  const blocks = blockStarts.map((start, idx) => {
    const end = blockStarts[idx + 1] ?? Math.min(start + 8, headerRow.length)
    const fields: Record<string, number> = {}
    for (let c = start; c < end; c++) {
      const key = String(headerRow[c] ?? '').trim()
      if (key) fields[key] = c
    }
    return { start, end, fields }
  })

  const out: Record<string, T[]> = {}
  const dataStart = subHeaderRow + 1

  for (let r = dataStart; r < data.length; r++) {
    const row = data[r]
    const iso = toISODate(row[0])
    if (!iso) continue

    const entries: T[] = []
    for (const block of blocks) {
      const fields: Record<string, string | number> = {}
      for (const [key, col] of Object.entries(block.fields)) {
        const val = row[col]
        if (val === '' || val == null) continue
        if (opts.quantityFields.includes(key)) {
          const n = Number(val)
          if (Number.isFinite(n)) fields[key] = n
        } else {
          fields[key] = String(val).trim()
        }
      }
      if (Object.keys(fields).length === 0) continue
      const entry = opts.buildEntry(fields)
      if (entry) entries.push(entry)
    }

    if (entries.length > 0) out[iso] = entries
  }

  return out
}

function parseMaterialSheet(ws: XLSX.WorkSheet): Record<string, MaterialEntry[]> {
  return parseBlockedSheet<MaterialEntry>(ws, {
    nameField: '품명',
    fieldMap: {},
    quantityFields: ['수량', '반입', '누계', '잔량', '실행'],
    buildEntry: (f) => {
      const name = String(f['품명'] ?? '').trim()
      if (!name) return null
      const quantity = Number(f['수량'] ?? f['반입'] ?? 0)
      if (!Number.isFinite(quantity) || quantity === 0) return null
      return {
        name,
        spec: String(f['규격'] ?? '').trim(),
        unit: f['단위'] ? String(f['단위']).trim() : undefined,
        quantity,
        vendor: f['업체명'] ? String(f['업체명']).trim() : undefined,
        workName: f['작업명'] ? String(f['작업명']).trim() : undefined,
      }
    },
  })
}

function parseEquipmentSheet(ws: XLSX.WorkSheet): Record<string, EquipmentEntry[]> {
  return parseBlockedSheet<EquipmentEntry>(ws, {
    nameField: '장비명',
    fieldMap: {},
    quantityFields: ['가동대수', '누계'],
    buildEntry: (f) => {
      const name = String(f['장비명'] ?? '').trim()
      if (!name) return null
      const count = Number(f['가동대수'] ?? 0)
      if (!Number.isFinite(count) || count === 0) return null
      const spec = String(f['규격'] ?? f['규겨'] ?? '').trim()
      return {
        name,
        spec,
        count,
        total: f['누계'] != null ? Number(f['누계']) : undefined,
        workName: f['작업사항'] ? String(f['작업사항']).trim() : undefined,
      }
    },
  })
}

function parseItemsSheet(ws: XLSX.WorkSheet): Record<string, string[]> {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false })
  // B열이 "요일"인 헤더 행 찾아서 그 다음부터 데이터 시작
  let startRow = 0
  for (let r = 0; r < Math.min(5, data.length); r++) {
    if (String(data[r][1] ?? '').trim() === '요일') {
      startRow = r + 1
      break
    }
  }
  const out: Record<string, string[]> = {}
  for (let r = startRow; r < data.length; r++) {
    const row = data[r]
    const iso = toISODate(row[0])
    if (!iso) continue
    const items: string[] = []
    for (let c = 2; c < row.length; c++) {
      const s = String(row[c] ?? '').trim()
      if (!s) continue
      if (/^Rev\./.test(s)) continue
      items.push(s)
    }
    if (items.length > 0) out[iso] = items
  }
  return out
}

function parseWeatherSheet(ws: XLSX.WorkSheet): WeatherRow[] {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false })
  const out: WeatherRow[] = []
  for (let r = 0; r < data.length; r++) {
    const row = data[r]
    const iso = toISODate(row[0])
    if (!iso) continue
    const dow = String(row[1] ?? '').trim()
    const raw = String(row[2] ?? '').trim()
    const { weather, tempMin, tempMax } = parseWeatherCell(raw)
    out.push({ date: iso, dayOfWeek: dow, weather, tempMin, tempMax, raw })
  }
  return out
}

function guessProjectName(wb: XLSX.WorkBook): string {
  const firstSheet = wb.SheetNames[0]
  const ws = wb.Sheets[firstSheet]
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
  for (const row of data.slice(0, 10)) {
    for (const cell of row) {
      const s = String(cell ?? '').trim()
      if (s.includes('공사') && s.length < 40) {
        // "파주 스튜디오 SITE1 신축공사" → "파주 스튜디오 신축공사"
        return s.replace(/\s*SITE\s*\d+\s*/gi, ' ').replace(/\s+/g, ' ').trim()
      }
    }
  }
  return '임포트된 프로젝트'
}

export function parsePajuExcel(buffer: ArrayBuffer, fileName: string): PajuParseResult {
  const wb = XLSX.read(buffer, { cellDates: true, type: 'array' })
  const warnings: string[] = []

  const sites: SiteData[] = []
  for (const label of ['1', '2'] as const) {
    const mpSheet = wb.Sheets[`투입인원${label}`]
    if (!mpSheet) {
      warnings.push(`'투입인원${label}' 시트가 없음 — SITE ${label} 스킵`)
      continue
    }
    const siteBase = parseManpowerSheet(mpSheet, label)

    const wdSheet = wb.Sheets[`작업사항${label}`]
    const wpSheet = wb.Sheets[`작업계획${label}`]
    const nSheet = wb.Sheets[`특기사항${label}`]
    const matSheet = wb.Sheets[`자재반입${label}`]
    const eqSheet = wb.Sheets[`장비투입${label}`]
    if (!wdSheet) warnings.push(`'작업사항${label}' 시트 없음 — 금일 작업 빈값`)
    if (!wpSheet) warnings.push(`'작업계획${label}' 시트 없음 — 명일 계획 빈값`)
    if (!nSheet) warnings.push(`'특기사항${label}' 시트 없음 — 특기사항 빈값`)
    if (!matSheet) warnings.push(`'자재반입${label}' 시트 없음 — 자재 빈값`)
    if (!eqSheet) warnings.push(`'장비투입${label}' 시트 없음 — 장비 빈값`)

    sites.push({
      ...siteBase,
      workDone: wdSheet ? parseItemsSheet(wdSheet) : {},
      workPlan: wpSheet ? parseItemsSheet(wpSheet) : {},
      notes: nSheet ? parseItemsSheet(nSheet) : {},
      materials: matSheet ? parseMaterialSheet(matSheet) : {},
      equipment: eqSheet ? parseEquipmentSheet(eqSheet) : {},
    })
  }

  const weatherWs = wb.Sheets['일기']
  const weather = weatherWs ? parseWeatherSheet(weatherWs) : []
  if (!weatherWs) warnings.push("'일기' 시트가 없음 — 날씨 데이터 없이 임포트")

  return {
    format: 'paju',
    fileName,
    projectNameGuess: guessProjectName(wb),
    weather,
    sites,
    warnings,
  }
}
