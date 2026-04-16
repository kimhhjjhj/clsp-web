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

export interface DxfResult {
  site_area: number
  bldg_area: number
  site_perim: number
  bldg_perim: number
  segments: DxfSegment[]
  loops: DxfLoop[]            // [0]=SITE, [1]=건물외곽
  highlightLayers: string[]   // 프리뷰에서 강조할 레이어명
  bbox: [number, number, number, number] | null
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

function centroid(pts: [number, number][]): [number, number] {
  let sx = 0, sy = 0
  for (const [x, y] of pts) { sx += x; sy += y }
  return [sx / pts.length, sy / pts.length]
}

function isClosed(pts: [number, number][], flags: number): boolean {
  if (flags & 1) return true
  if (pts.length >= 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 500) return true
  return false
}

function ptInBbox(x: number, y: number, bb: [number, number, number, number], margin = 500): boolean {
  return x >= bb[0] - margin && x <= bb[2] + margin && y >= bb[1] - margin && y <= bb[3] + margin
}

function segInBbox(s: DxfSegment, bb: [number, number, number, number]): boolean {
  return ptInBbox(s.x1, s.y1, bb) && ptInBbox(s.x2, s.y2, bb)
}

// ── DXF text parsing ────────────────────────────────────────

interface RawEntity {
  type: string; layer: string; pts: [number, number][]; flags: number
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
    if (code === '0' && (val === 'LWPOLYLINE' || val === 'POLYLINE' || val === 'LINE')) {
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

// ── CON outline reconstruction (claude1.py _build_con_outline) ──

function buildConOutline(
  conLines: DxfSegment[],
  siteBbox: [number, number, number, number] | null,
): { pts: [number, number][]; area: number; perim: number } | null {
  // 1) filter to lines inside site bbox
  let lines = conLines
  if (siteBbox) lines = lines.filter(s => segInBbox(s, siteBbox))
  if (lines.length === 0) return null

  // 2) select long lines (>= 10m = 10000 raw units)
  const lenOf = (s: DxfSegment) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1)
  let longLines = lines.filter(s => lenOf(s) >= 10000)
  if (longLines.length < 2) longLines = lines.filter(s => lenOf(s) >= 5000)
  if (longLines.length < 2) return null

  // 3) snap to 500 grid
  const snap = (v: number) => Math.round(v / 500) * 500

  // 4) group into H/V
  const hLines: { y: number; x1: number; x2: number }[] = []
  const vLines: { x: number; y1: number; y2: number }[] = []

  for (const s of longLines) {
    const sx1 = snap(s.x1), sy1 = snap(s.y1), sx2 = snap(s.x2), sy2 = snap(s.y2)
    if (sy1 === sy2) {
      hLines.push({ y: sy1, x1: Math.min(sx1, sx2), x2: Math.max(sx1, sx2) })
    } else if (sx1 === sx2) {
      vLines.push({ x: sx1, y1: Math.min(sy1, sy2), y2: Math.max(sy1, sy2) })
    }
  }

  if (hLines.length < 2 || vLines.length < 1) return null

  // 5) find extents
  const allX = [...hLines.flatMap(h => [h.x1, h.x2]), ...vLines.map(v => v.x)]
  const allY = [...vLines.flatMap(v => [v.y1, v.y2]), ...hLines.map(h => h.y)]
  const minX = Math.min(...allX), maxX = Math.max(...allX)
  const minY = Math.min(...allY), maxY = Math.max(...allY)

  const spanX = maxX - minX, spanY = maxY - minY
  if (spanX < 15000 || spanY < 10000) return null  // too small

  // 6) try L-shape detection
  const rightVLines = vLines.filter(v => v.x > minX + spanX * 0.4).sort((a, b) => b.x - a.x)
  let pts: [number, number][]

  // check for kink (L-shape)
  let lShape = false
  if (rightVLines.length >= 1) {
    const rv = rightVLines[0]
    if (rv.y2 < maxY - 2000) { // doesn't reach top → L-shape
      const midV = vLines.filter(v => v.x > minX + spanX * 0.2 && v.x < maxX - spanX * 0.2)
      if (midV.length > 0) {
        const mv = midV.reduce((a, b) => (b.y2 - b.y1) > (a.y2 - a.y1) ? b : a)
        // 6-point L
        pts = [
          [minX, minY], [maxX, minY], [maxX, rv.y2],
          [mv.x, rv.y2], [mv.x, maxY], [minX, maxY],
        ]
        lShape = true
      }
    }
  }

  if (!lShape) {
    // simple rectangle
    pts = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]
  }

  const area = shoelaceArea(pts!)
  if (area < 1e6) return null
  return { pts: pts!, area, perim: polyPerim(pts!, true) }
}

// ── unit factor ─────────────────────────────────────────────

function getUnitFactor(maxCoord: number): number {
  if (maxCoord > 10000) return 0.001   // mm → m
  if (maxCoord > 100) return 0.01      // cm → m
  return 1.0
}

// ═══════════════════════════════════════════════════════════════
//  메인 파서
// ═══════════════════════════════════════════════════════════════

export function parseDxf(rawText: string): DxfResult {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const entities = parseEntities(text.split('\n'))

  const allSegs: DxfSegment[] = []
  const sitePolys: { pts: [number, number][]; area: number; perim: number }[] = []
  const conLines: DxfSegment[] = []
  const defPolys: { pts: [number, number][]; area: number; perim: number }[] = []
  let maxCoord = 0
  const seenSite = new Set<string>()

  for (const ent of entities) {
    const { pts, layer, flags, type } = ent
    const lu = layer.toUpperCase().trim()

    for (const [x, y] of pts) {
      if (Math.abs(x) > maxCoord) maxCoord = Math.abs(x)
      if (Math.abs(y) > maxCoord) maxCoord = Math.abs(y)
    }

    // segments
    for (let k = 0; k < pts.length - 1; k++) {
      const seg: DxfSegment = { x1: pts[k][0], y1: pts[k][1], x2: pts[k + 1][0], y2: pts[k + 1][1], layer }
      allSegs.push(seg)
      if (lu === 'CON' && type === 'LINE') conLines.push(seg)
    }
    const closed = isClosed(pts, flags)
    if (closed && pts.length >= 2) {
      allSegs.push({ x1: pts[pts.length - 1][0], y1: pts[pts.length - 1][1], x2: pts[0][0], y2: pts[0][1], layer })
    }

    // classify
    if (pts.length >= 3) {
      const area = shoelaceArea(pts)
      const perim = polyPerim(pts, true)

      if (lu === 'SITE' && area > 1e8) {
        const key = pts.slice(0, 3).map(([x, y]) => `${Math.round(x / 100) * 100},${Math.round(y / 100) * 100}`).join('|')
        if (!seenSite.has(key)) { seenSite.add(key); sitePolys.push({ pts, area, perim }) }
      }
      if (lu === 'DEF' && closed && area > 1e8) {
        defPolys.push({ pts, area, perim })
      }
    }
  }

  const uf = getUnitFactor(maxCoord)

  // ── SITE 선택 (CON 중심점에 가장 가까운 SITE) ──
  let siteLoop: { pts: [number, number][]; area: number; perim: number } | null = null

  if (sitePolys.length > 0) {
    if (conLines.length > 0) {
      // CON centroid
      const conPts: [number, number][] = conLines.flatMap(s => [[s.x1, s.y1] as [number, number], [s.x2, s.y2] as [number, number]])
      const [cx, cy] = centroid(conPts)
      siteLoop = sitePolys.reduce((best, sp) => {
        const [sx, sy] = centroid(sp.pts)
        const d = Math.hypot(sx - cx, sy - cy)
        const [bx, by] = centroid(best.pts)
        return d < Math.hypot(bx - cx, by - cy) ? sp : best
      })
    } else {
      siteLoop = sitePolys.reduce((a, b) => b.area > a.area ? b : a)
    }
  }

  // ── SITE bbox → 세그먼트 필터링 ──
  let siteBbox: [number, number, number, number] | null = null
  if (siteLoop) {
    const xs = siteLoop.pts.map(p => p[0]), ys = siteLoop.pts.map(p => p[1])
    siteBbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  }

  // ── CON_outline 구축 ──
  let bldgOutline = buildConOutline(conLines, siteBbox)

  // fallback → DEF largest
  if (!bldgOutline && defPolys.length > 0) {
    defPolys.sort((a, b) => b.area - a.area)
    bldgOutline = defPolys[0]
  }

  // ── fallback (SITE/CON 둘 다 없을 때) — 가장 큰 폴리곤 2개 ──
  if (!siteLoop && !bldgOutline) {
    const allPolys: { pts: [number, number][]; area: number; perim: number; layer: string }[] = []
    for (const ent of entities) {
      if (ent.pts.length >= 3 && isClosed(ent.pts, ent.flags)) {
        const area = shoelaceArea(ent.pts)
        if (area > 1e7) allPolys.push({ pts: ent.pts, area, perim: polyPerim(ent.pts), layer: ent.layer })
      }
    }
    allPolys.sort((a, b) => b.area - a.area)
    if (allPolys.length >= 1) siteLoop = allPolys[0]
    if (allPolys.length >= 2) bldgOutline = allPolys[1]
  }

  // ── 세그먼트 필터 (SITE bbox 내부만) ──
  let filteredSegs: DxfSegment[] = allSegs
  if (siteBbox) {
    filteredSegs = allSegs.filter(s => segInBbox(s, siteBbox!))
  }

  // CON_outline 세그먼트 주입
  const highlightLayers: string[] = []
  if (siteLoop) highlightLayers.push('SITE')

  if (bldgOutline) {
    const op = bldgOutline.pts
    for (let k = 0; k < op.length; k++) {
      const [x1, y1] = op[k], [x2, y2] = op[(k + 1) % op.length]
      filteredSegs.push({ x1, y1, x2, y2, layer: 'CON_outline' })
    }
    highlightLayers.push('CON_outline')
  }

  // bbox (in raw units)
  let bbox: [number, number, number, number] | null = null
  if (filteredSegs.length > 0) {
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity
    for (const s of filteredSegs) {
      if (s.x1 < mnx) mnx = s.x1; if (s.x2 < mnx) mnx = s.x2
      if (s.y1 < mny) mny = s.y1; if (s.y2 < mny) mny = s.y2
      if (s.x1 > mxx) mxx = s.x1; if (s.x2 > mxx) mxx = s.x2
      if (s.y1 > mxy) mxy = s.y1; if (s.y2 > mxy) mxy = s.y2
    }
    bbox = [mnx * uf, mny * uf, mxx * uf, mxy * uf]
  }

  // output loops
  const loops: DxfLoop[] = []
  if (siteLoop) loops.push({ layer: 'SITE', pts: siteLoop.pts.map(([x, y]) => [x * uf, y * uf] as [number, number]), area: siteLoop.area * uf * uf, perim: siteLoop.perim * uf })
  if (bldgOutline) loops.push({ layer: 'CON_outline', pts: bldgOutline.pts.map(([x, y]) => [x * uf, y * uf] as [number, number]), area: bldgOutline.area * uf * uf, perim: bldgOutline.perim * uf })

  // convert segments to m
  const segsM = filteredSegs.map(s => ({ x1: s.x1 * uf, y1: s.y1 * uf, x2: s.x2 * uf, y2: s.y2 * uf, layer: s.layer }))

  const layerNames = [...new Set(entities.map(e => e.layer))].join(', ')

  return {
    site_area: siteLoop ? siteLoop.area * uf * uf : 0,
    bldg_area: bldgOutline ? bldgOutline.area * uf * uf : 0,
    site_perim: siteLoop ? siteLoop.perim * uf : 0,
    bldg_perim: bldgOutline ? bldgOutline.perim * uf : 0,
    segments: segsM,
    loops,
    highlightLayers,
    bbox,
    debug: `entities=${entities.length} segs=${segsM.length} conLines=${conLines.length} layers=[${layerNames}] uf=${uf}`,
  }
}
