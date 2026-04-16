// ═══════════════════════════════════════════════════════════════
//  DXF 파서 — claude1.py _extract_dxf_geometry_ezdxf 포팅
//  SITE 레이어 → 대지경계, CON LINE → 건축외곽 재구성
// ═══════════════════════════════════════════════════════════════

export interface DxfSegment {
  x1: number; y1: number; x2: number; y2: number
  layer: string
}

export interface DxfLoop {
  layer: string
  pts: [number, number][]
  area: number
  perim: number
}

export interface DesignInfo {
  projectName?: string
  location?: string
  floors?: number
  area?: number
  perimeter?: number
  notes?: string[]
}

export interface DxfResult {
  site_area: number
  bldg_area: number
  site_perim: number
  bldg_perim: number
  segments: DxfSegment[]
  loops: DxfLoop[]            // [0]=SITE, [1]=건물외곽
  highlightLayers: string[]   // 프리뷰에서 강조할 레이어명
  bbox: [number, number, number, number] | null
  designInfo?: DesignInfo
  debug?: string
}

// ── math ────────────────────────────────────────────────────

function shoelaceArea(pts: [number, number][]): number {
  const n = pts.length; if (n < 3) return 0; let s = 0
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n]
    s += x1 * y2 - x2 * y1
  }
  return Math.abs(s) / 2
}

function polyPerim(pts: [number, number][], closed = true): number {
  const n = pts.length; if (n < 2) return 0
  const lim = closed ? n : n - 1; let p = 0
  for (let i = 0; i < lim; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n]
    p += Math.hypot(x2 - x1, y2 - y1)
  }
  return p
}

function isClosed(pts: [number, number][], flags: number): boolean {
  if (flags & 1) return true
  if (pts.length >= 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 500) return true
  return false
}

// ── DXF text parsing ────────────────────────────────────────

interface RawEntity {
  type: string; layer: string; pts: [number, number][]; flags: number; text?: string
}

function parseEntities(lines: string[]): RawEntity[] {
  const entities: RawEntity[] = []
  let secStart = -1, secEnd = lines.length
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].trim() === '2' && lines[i + 1].trim() === 'ENTITIES') secStart = i + 2
    if (secStart !== -1 && lines[i].trim() === '0' && lines[i + 1].trim() === 'ENDSEC') { secEnd = i; break }
  }
  if (secStart === -1) secStart = 0

  let i = secStart
  while (i < secEnd - 1) {
    const code = lines[i]?.trim(), val = lines[i + 1]?.trim() ?? ''

    // ── TEXT/MTEXT ──
    if (code === '0' && (val === 'TEXT' || val === 'MTEXT')) {
      const etype = val; let layer = '', text = ''; let x: number | null = null, y: number | null = null
      i += 2
      const textParts: string[] = []
      while (i < secEnd - 1) {
        const c = lines[i]?.trim(), v = lines[i + 1]?.trim() ?? ''
        if (c === '0') break
        if (c === '8') layer = v
        if (c === '1' || c === '3') textParts.push(v)
        if (c === '10') x = parseFloat(v)
        else if (c === '20') y = parseFloat(v)
        i += 2
      }
      text = textParts.join(' ')
      if (text.trim() && x !== null && y !== null) {
        entities.push({ type: etype, layer, pts: [[x, y]], flags: 0, text })
      }
    }
    // ── LWPOLYLINE / POLYLINE / LINE ──
    else if (code === '0' && (val === 'LWPOLYLINE' || val === 'POLYLINE' || val === 'LINE')) {
      const etype = val; let layer = '', flags = 0; const pts: [number, number][] = []; let cx: number | null = null
      i += 2
      if (etype === 'POLYLINE') {
        // POLYLINE header
        while (i < secEnd - 1) {
          const c = lines[i]?.trim(), v = lines[i + 1]?.trim() ?? ''
          if (c === '0') break
          if (c === '8') layer = v
          if (c === '70') { try { flags = parseInt(v) } catch (_e) { /* ignore */ } }
          i += 2
        }
        // VERTEX sub-entities
        while (i < secEnd - 1) {
          const c = lines[i]?.trim(), v = lines[i + 1]?.trim() ?? ''
          if (c === '0' && v === 'VERTEX') {
            i += 2; let vx: number | null = null, vy: number | null = null
            while (i < secEnd - 1) {
              const vc = lines[i]?.trim(), vv = lines[i + 1]?.trim() ?? ''
              if (vc === '0') break
              if (vc === '10') vx = parseFloat(vv)
              else if (vc === '20') vy = parseFloat(vv)
              i += 2
            }
            if (vx !== null && vy !== null) pts.push([vx, vy])
          } else if (c === '0' && v === 'SEQEND') { i += 2; break }
          else if (c === '0') break
          else i += 2
        }
      } else {
        // LWPOLYLINE / LINE
        while (i < secEnd - 1) {
          const c = lines[i]?.trim(), v = lines[i + 1]?.trim() ?? ''
          if (c === '0') break
          if (c === '8') layer = v
          else if (c === '70') { try { flags = parseInt(v) } catch (_e) { /* ignore */ } }
          else if (c === '10') cx = parseFloat(v)
          else if (c === '20') { if (cx !== null) { pts.push([cx, parseFloat(v)]); cx = null } }
          else if (c === '11') cx = parseFloat(v)
          else if (c === '21') { if (cx !== null) { pts.push([cx, parseFloat(v)]); cx = null } }
          i += 2
        }
      }
      if (pts.length >= 2) entities.push({ type: etype, layer, pts, flags })
    } else i += 2
  }
  return entities
}

// ── 설계개요 추출 ──────────────────────────────────

function extractDesignInfo(textEntities: RawEntity[]): DesignInfo | undefined {
  if (textEntities.length === 0) return undefined

  const allText = textEntities.map(e => e.text || '').join('\n')
  const info: DesignInfo = {}
  const notes: string[] = []

  // 프로젝트명 / 건물명
  let match = allText.match(/(?:프로젝트|건(?:물)?명|건명|Project|Building)[\s：:]*([^\n]*)/)
  if (match && match[1]) info.projectName = match[1].trim()

  // 위치 / 주소
  match = allText.match(/(?:위치|주소|Location|Address)[\s：:]*([^\n]*)/)
  if (match && match[1]) info.location = match[1].trim()

  // 지상층수 / 층수
  match = allText.match(/(?:지상|지상층)[수층]*[\s：:]*(\d+)/)
  if (match && match[1]) info.floors = parseInt(match[1], 10)

  // 대지/연면적
  match = allText.match(/(?:대지|연)?면적[\s：:]*(\d+[.,]?\d*)/)
  if (match && match[1]) {
    const areaStr = match[1].replace(',', '.')
    const area = parseFloat(areaStr)
    if (!isNaN(area)) info.area = area
  }

  // m² 또는 ㎡ 단위 추출
  if (!info.area) {
    match = allText.match(/(\d+[.,]?\d*)\s*(?:m²|㎡|m2)/)
    if (match && match[1]) {
      const areaStr = match[1].replace(',', '.')
      const area = parseFloat(areaStr)
      if (!isNaN(area)) info.area = area
    }
  }

  // 둘레
  match = allText.match(/(?:둘레|perimeter)[\s：:]*(\d+[.,]?\d*)/)
  if (match && match[1]) {
    const perimStr = match[1].replace(',', '.')
    const perim = parseFloat(perimStr)
    if (!isNaN(perim)) info.perimeter = perim
  }

  // 기타 정보 수집
  for (const text of allText.split('\n')) {
    const t = text.trim()
    if (t.length > 0 && t.length < 100 && !info.projectName?.includes(t) && !info.location?.includes(t)) {
      notes.push(t)
    }
  }

  if (notes.length > 0) info.notes = notes

  return Object.keys(info).length > 0 ? info : undefined
}

// ── unit factor ─────────────────────────────────────────────

function getUnitFactor(maxCoord: number): number {
  if (maxCoord > 10000) return 0.001   // mm → m
  if (maxCoord > 100) return 0.01      // cm → m
  return 1.0
}

// ── 독립 선분들에서 닫힌 루프 재구성 ──────────────────────
// greedy chain: 끝점끼리 이어 붙여 닫히면 루프로 인식.
// 단순 폐합 폴리곤(건물외곽 등)에 효과적.

function findLineLoops(segsM: DxfSegment[]): DxfLoop[] {
  if (segsM.length < 3) return []

  const TOL2 = 0.1 * 0.1   // 10cm²  (거리 제곱 비교용)
  const d2 = (ax: number, ay: number, bx: number, by: number) =>
    (ax - bx) ** 2 + (ay - by) ** 2

  const segs = segsM.map(s => ({ ...s, used: false }))
  const loops: DxfLoop[] = []

  for (let si = 0; si < segs.length; si++) {
    if (segs[si].used) continue

    const chain: [number, number][] = [
      [segs[si].x1, segs[si].y1],
      [segs[si].x2, segs[si].y2],
    ]
    segs[si].used = true

    for (let iter = 0; iter < segs.length; iter++) {
      const [lx, ly] = chain[chain.length - 1]
      const [fx, fy] = chain[0]

      // 허용오차 내 모든 후보 수집
      const cands: { j: number; flip: boolean; nx: number; ny: number }[] = []
      for (let j = 0; j < segs.length; j++) {
        if (segs[j].used) continue
        if (d2(lx, ly, segs[j].x1, segs[j].y1) < TOL2) cands.push({ j, flip: false, nx: segs[j].x2, ny: segs[j].y2 })
        else if (d2(lx, ly, segs[j].x2, segs[j].y2) < TOL2) cands.push({ j, flip: true,  nx: segs[j].x1, ny: segs[j].y1 })
      }
      if (cands.length === 0) break

      // 분기점: 현재 진행 방향과 가장 일직선(최소 꺾임)인 선분 우선,
      //         그 다음 더 긴 선분 우선 (짧은 코너 마감선 회피)
      let bestJ = cands[0].j, bestFlip = cands[0].flip
      let nx = cands[0].nx, ny = cands[0].ny
      if (cands.length > 1 && chain.length >= 2) {
        const [px, py] = chain[chain.length - 2]
        const curAngle = Math.atan2(ly - py, lx - px)
        let bestScore = -Infinity
        for (const c of cands) {
          const outAngle = Math.atan2(c.ny - ly, c.nx - lx)
          let da = Math.abs(outAngle - curAngle)
          if (da > Math.PI) da = 2 * Math.PI - da  // 0~π로 정규화 (꺾임 각도)
          const segLen = Math.sqrt(d2(lx, ly, c.nx, c.ny))
          const score = -da * 10 + Math.log1p(segLen)  // 꺾임 최소 + 긴 선 선호
          if (score > bestScore) { bestScore = score; bestJ = c.j; bestFlip = c.flip; nx = c.nx; ny = c.ny }
        }
      } else {
        nx = cands[0].nx; ny = cands[0].ny
      }
      segs[bestJ].used = true

      // 닫힘 확인
      if (chain.length >= 3 && d2(nx, ny, fx, fy) < TOL2) {
        const area = shoelaceArea(chain)
        const perim = polyPerim(chain, true)
        // 얇은 띠 형태 제거 (벽 두께 루프): compactness = 4π·A/P² < 0.04
        const compactness = (4 * Math.PI * area) / (perim * perim)
        if (area >= 1 && compactness >= 0.04) {
          loops.push({
            layer: segs[si].layer,
            pts: [...chain],
            area,
            perim,
          })
        }
        break
      }

      chain.push([nx, ny])
    }
  }

  return loops
}

// ═══════════════════════════════════════════════════════════════
//  메인 파서 — 모든 닫힌 폴리곤 반환 (사용자가 직접 선택)
// ═══════════════════════════════════════════════════════════════

export function parseDxf(rawText: string): DxfResult {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const entities = parseEntities(text.split('\n'))

  const allSegs: DxfSegment[] = []
  const lineSegs: DxfSegment[] = []   // LINE 엔티티만 (greedy chain 전용)
  const textEntities: RawEntity[] = []
  let maxCoord = 0

  for (const ent of entities) {
    const { pts, layer, flags, type } = ent

    if (type === 'TEXT' || type === 'MTEXT') {
      textEntities.push(ent)
      continue
    }

    for (const [x, y] of pts) {
      if (Math.abs(x) > maxCoord) maxCoord = Math.abs(x)
      if (Math.abs(y) > maxCoord) maxCoord = Math.abs(y)
    }

    for (let k = 0; k < pts.length - 1; k++) {
      const seg = { x1: pts[k][0], y1: pts[k][1], x2: pts[k + 1][0], y2: pts[k + 1][1], layer }
      allSegs.push(seg)
      if (type === 'LINE') lineSegs.push(seg)
    }
    if (isClosed(pts, flags) && pts.length >= 2) {
      allSegs.push({ x1: pts[pts.length - 1][0], y1: pts[pts.length - 1][1], x2: pts[0][0], y2: pts[0][1], layer })
    }
  }

  const uf = getUnitFactor(maxCoord)

  // ── 모든 닫힌 폴리곤 수집 (면적 1m² 이상) ──
  const seenKey = new Set<string>()
  const loops: DxfLoop[] = []

  for (const ent of entities) {
    const { pts, layer, flags, type } = ent
    if (type === 'TEXT' || type === 'MTEXT') continue
    if (pts.length < 3 || !isClosed(pts, flags)) continue

    const rawArea = shoelaceArea(pts)
    if (rawArea * uf * uf < 1) continue  // 1m² 미만 무시

    // 중복 제거 (첫 3점 좌표 기반)
    const key = pts.slice(0, 3).map(([x, y]) => `${Math.round(x / 100) * 100},${Math.round(y / 100) * 100}`).join('|')
    if (seenKey.has(key)) continue
    seenKey.add(key)

    loops.push({
      layer,
      pts: pts.map(([x, y]) => [x * uf, y * uf] as [number, number]),
      area: rawArea * uf * uf,
      perim: polyPerim(pts, true) * uf,
    })
  }

  // ── 세그먼트 → m 변환 (전체 반환, 필터링 없음) ──
  const segsM = allSegs.map(s => ({ x1: s.x1 * uf, y1: s.y1 * uf, x2: s.x2 * uf, y2: s.y2 * uf, layer: s.layer }))

  // ── 독립 LINE 선분들로 만들어진 닫힌 루프 추가 ──
  const lineSegsM = lineSegs.map(s => ({ x1: s.x1 * uf, y1: s.y1 * uf, x2: s.x2 * uf, y2: s.y2 * uf, layer: s.layer }))
  const lineLoops = findLineLoops(lineSegsM)
  for (const ll of lineLoops) {
    // 기존 폴리라인 루프와 중복 체크 (centroid 기반)
    const cx = ll.pts.reduce((s, [x]) => s + x, 0) / ll.pts.length
    const cy = ll.pts.reduce((s, [, y]) => s + y, 0) / ll.pts.length
    const dup = loops.some(l => {
      const lx = l.pts.reduce((s, [x]) => s + x, 0) / l.pts.length
      const ly = l.pts.reduce((s, [, y]) => s + y, 0) / l.pts.length
      return Math.hypot(lx - cx, ly - cy) < 0.5 && Math.abs(l.area - ll.area) / Math.max(l.area, 1) < 0.05
    })
    if (!dup) loops.push(ll)
  }

  // 면적 큰 순서로 정렬
  loops.sort((a, b) => b.area - a.area)

  // bbox
  let bbox: [number, number, number, number] | null = null
  if (segsM.length > 0) {
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity
    for (const s of segsM) {
      if (s.x1 < mnx) mnx = s.x1; if (s.x2 < mnx) mnx = s.x2
      if (s.y1 < mny) mny = s.y1; if (s.y2 < mny) mny = s.y2
      if (s.x1 > mxx) mxx = s.x1; if (s.x2 > mxx) mxx = s.x2
      if (s.y1 > mxy) mxy = s.y1; if (s.y2 > mxy) mxy = s.y2
    }
    bbox = [mnx, mny, mxx, mxy]
  }

  const layerNames = [...new Set(entities.map(e => e.layer))].join(', ')
  const designInfo = extractDesignInfo(textEntities)

  return {
    site_area: 0,
    bldg_area: 0,
    site_perim: 0,
    bldg_perim: 0,
    segments: segsM,
    loops,
    highlightLayers: [],
    bbox,
    designInfo,
    debug: `entities=${entities.length} segs=${segsM.length} polys=${loops.length} layers=[${layerNames}] uf=${uf}`,
  }
}
