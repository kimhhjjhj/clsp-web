import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY ?? '704157b7143915835e8d64a77b644213'

export interface BoreholeResult {
  id: string
  distance_m: number
  lat: number
  lng: number
  depth: number | null
  addr: string
  wtr: number | null
  rk: number | null
  wtr_display: string
  rk_display: string
  layers: { soil_type: string; depth_from: number; depth_to: number }[]
}

// ── 좌표 변환 ────────────────────────────────────────────────
function latLngToTM(lat: number, lng: number): [number, number] {
  return [
    (lng - 127.0) * 88528 + 200000,
    (lat - 38.0) * 110941 + 600000,
  ]
}
function tmToLatLng(x: number, y: number): [number, number] {
  return [
    (y - 600000) / 110941 + 38.0,
    (x - 200000) / 88528 + 127.0,
  ]
}

// ── CSV 한 줄 파싱 ─────────────────────────────────────────
function parseLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { q = !q }
    else if (c === ',' && !q) { out.push(cur.trim()); cur = '' }
    else { cur += c }
  }
  out.push(cur.trim())
  return out
}

// ── EUC-KR CSV decode + 줄바꿈 정규화 (\r\n / \r / \n → \n) ──
function decodeEucKr(filePath: string): string {
  const buf = fs.readFileSync(filePath)
  let text: string
  try { text = new TextDecoder('euc-kr').decode(buf) }
  catch { text = buf.toString('latin1') }
  // CR-only, CRLF, LF 모두 LF로 통일
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

// ── Kakao 역지오코딩 (비동기) ──────────────────────────────
async function coordToAddr(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}&input_coord=WGS84`
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return '-'
    const d = await res.json()
    const doc = d?.documents?.[0]
    return doc?.address?.address_name || doc?.road_address?.address_name || '-'
  } catch { return '-' }
}

// ── Python _is_soil_like 포팅 ──────────────────────────────
function isSoilLike(nm: string): boolean {
  const s = nm.replace(/\s/g, '')
  if (!s) return false
  if (['풍화암','연암','경암','암반','보통암','경질암'].some(k => s.includes(k))) return false
  if (s.includes('토')) return true
  return ['매립','전답','사질','점토','실트','모래','자갈','충적','퇴적','붕적'].some(k => s.includes(k))
}

// ── 메인 핸들러 ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { lat: number; lng: number }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: '잘못된 요청' }, { status: 400 }) }

  const { lat, lng } = body
  if (typeof lat !== 'number' || typeof lng !== 'number')
    return NextResponse.json({ error: 'lat, lng 필요' }, { status: 400 })

  const dir = path.join(process.cwd(), 'public', 'data')
  const bhPath = path.join(dir, 'boreholes.csv')
  const lyPath = path.join(dir, 'layers.csv')

  if (!fs.existsSync(bhPath)) {
    return NextResponse.json(makeMock(lat, lng))
  }

  try {
    // ── 1. boreholes.csv 파싱 → 12개 최근접 ─────────────
    const bhText  = decodeEucKr(bhPath)
    const bhLines = bhText.split(/\r?\n/).filter(l => l.trim())
    const bhHdr   = parseLine(bhLines[0])

    const ci = (names: string[]) => {
      for (const n of names) {
        const i = bhHdr.findIndex(h => h.includes(n))
        if (i >= 0) return i
      }
      return -1
    }
    const idCol  = Math.max(0, ci(['시추공코드','시추공번호']))
    const xCol   = Math.max(6, ci(['X좌표','TM_X']))
    const yCol   = Math.max(7, ci(['Y좌표','TM_Y']))
    const dpCol  = Math.max(2, ci(['시추심도','심도']))

    const [qx, qy] = latLngToTM(lat, lng)

    const nearest: { id: string; dist: number; lat: number; lng: number; depth: number | null }[] = []

    for (let i = 1; i < bhLines.length; i++) {
      const row = parseLine(bhLines[i])
      const id  = row[idCol]?.trim()
      const x   = parseFloat(row[xCol] ?? '')
      const y   = parseFloat(row[yCol] ?? '')
      if (!id || isNaN(x) || isNaN(y)) continue

      const dist = Math.hypot(qx - x, qy - y)
      const depth = parseFloat(row[dpCol] ?? '')

      if (nearest.length < 12) {
        nearest.push({ id, dist, ...tmToLatLngObj(x, y), depth: isNaN(depth) ? null : depth })
        if (nearest.length === 12) nearest.sort((a, b) => a.dist - b.dist)
      } else if (dist < nearest[11].dist) {
        nearest[11] = { id, dist, ...tmToLatLngObj(x, y), depth: isNaN(depth) ? null : depth }
        nearest.sort((a, b) => a.dist - b.dist)
      }
    }

    if (nearest.length === 0) return NextResponse.json(makeMock(lat, lng))

    // ── 2. layers.csv — 타깃 ID만 빠르게 추출 ───────────
    // 181MB 파일을 전부 파싱하지 않고, 해당 시추공코드 포함 줄만 처리
    const layerMap: Map<string, { nm: string; start: number; end: number }[]> = new Map()

    if (fs.existsSync(lyPath)) {
      const targetIds = new Set(nearest.map(b => b.id))
      const lyText    = decodeEucKr(lyPath)

      // 헤더 파싱
      const firstNl = lyText.indexOf('\n')
      const lyHdr   = parseLine(lyText.slice(0, firstNl))
      const lBhCol  = Math.max(1, findIn(lyHdr, ['시추공코드','시추공번호']))
      const lStCol  = Math.max(2, findIn(lyHdr, ['지층시작심도','시작심도']))
      const lEnCol  = Math.max(3, findIn(lyHdr, ['지층종료심도','종료심도']))
      const lNmCol  = Math.max(6, findIn(lyHdr, ['토목용지층명','지층명']))

      // 줄 단위 스캔 — target ID 포함 줄만 파싱
      let pos = firstNl + 1
      while (pos < lyText.length) {
        const nl = lyText.indexOf('\n', pos)
        const end = nl < 0 ? lyText.length : nl
        const line = lyText.slice(pos, end)
        pos = end + 1

        // 빠른 필터: 이 줄에 타깃 ID가 포함되어 있는지 먼저 확인
        let hit = false
        for (const tid of targetIds) {
          if (line.includes(tid)) { hit = true; break }
        }
        if (!hit) continue

        // 본격 파싱
        const row  = parseLine(line)
        const bhId = row[lBhCol]?.trim()
        if (!bhId || !targetIds.has(bhId)) continue

        const st = parseFloat(row[lStCol] ?? '')
        const en = parseFloat(row[lEnCol] ?? '')
        const nm = row[lNmCol]?.trim() ?? ''
        if (isNaN(en)) continue

        if (!layerMap.has(bhId)) layerMap.set(bhId, [])
        layerMap.get(bhId)!.push({ nm, start: isNaN(st) ? 0 : st, end: en })
      }
    }

    // ── 3. 역지오코딩 병렬 ───────────────────────────────
    const addrs = await Promise.all(nearest.map(b => coordToAddr(b.lat, b.lng)))

    // ── 4. 결과 조합 (Python 로직) ────────────────────────
    const results: BoreholeResult[] = nearest.map((bh, i) => {
      const raw = (layerMap.get(bh.id) ?? []).sort((a, b) => a.end - b.end)

      let wtr: number | null = null
      let rk: number | null = null
      let prev = 0
      const layers: BoreholeResult['layers'] = []

      for (const l of raw) {
        layers.push({ soil_type: l.nm || '미상', depth_from: l.start, depth_to: l.end })
        if (l.nm.includes('풍화암'))  { if (wtr === null || l.end > wtr) wtr = l.end }
        if ((l.nm.includes('연암') || l.nm.includes('경암')) && rk === null) rk = prev
        prev = l.end
      }

      return {
        id: bh.id,
        distance_m: Math.round(bh.dist),
        lat: bh.lat,
        lng: bh.lng,
        depth: bh.depth,
        addr: addrs[i],
        wtr, rk,
        wtr_display: wtr != null ? `${wtr.toFixed(1)}m` : '-',
        rk_display:  rk  != null ? `${rk.toFixed(1)}m`  : '-',
        layers,
      }
    })

    return NextResponse.json(results)
  } catch (err: any) {
    console.error('[ground-info]', err?.message ?? err)
    return NextResponse.json(makeMock(lat, lng))
  }
}

// ── 유틸 ──────────────────────────────────────────────────
function tmToLatLngObj(x: number, y: number) {
  const [lat, lng] = tmToLatLng(x, y)
  return { lat, lng }
}
function findIn(hdr: string[], names: string[]): number {
  for (const n of names) {
    const i = hdr.findIndex(h => h.includes(n))
    if (i >= 0) return i
  }
  return -1
}

function makeMock(lat: number, lng: number): BoreholeResult[] {
  return [
    {
      id: 'BH-MOCK-001', distance_m: 45, lat: lat + 0.0003, lng: lng + 0.0003,
      depth: 20, addr: '(CSV 파일 없음 - 목업 데이터)',
      wtr: 12.0, rk: 12.0,
      wtr_display: '12.0m', rk_display: '12.0m',
      layers: [
        { soil_type: '풍화토', depth_from: 0, depth_to: 5.5 },
        { soil_type: '풍화암', depth_from: 5.5, depth_to: 12.0 },
        { soil_type: '연암', depth_from: 12.0, depth_to: 20.0 },
      ],
    },
  ]
}
