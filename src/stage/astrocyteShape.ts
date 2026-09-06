import { boundsOf, flattenSubpaths, parsePath, type Seg } from './svgPath'

// THE ASTROCYTE'S SILHOUETTE, TRACED (21c-1a).
//
// ⚠ WHY A TRACE AND NOT TWELVE TUBES (user, 2026-09-05: "the reason why I
// suggested you svg is that you could trace the outline to avoid part
// overlayed. The seams are too obvious. Re-draw").
//
// The first pass built the cell from the app's star glyph and stroked each
// process as its own tube. Every place two processes met — and every place one
// met the soma — one tube's membrane crossed the inside of another, and the
// seam showed. It is not a tuning problem: N stroked shapes have N outlines,
// and a cell has ONE. So the whole silhouette is now a single traced path,
// filled once and stroked once, and there is no interior edge to see.
//
// ⚠ SECOND HANDOVER, 2026-09-05: ~/Downloads/astrocyte-thick.svg replaces
// blue-astrocyte-9214b4f5.svg ("astrocyte still looks bad. Trace
// astrocyte-thick.svg instead"). One closed path, stroke-only, viewBox
// 145.1 × 179.6 — and it is drawn ALREADY THICK and ALREADY CROPPED: the
// processes are fat enough to watch a ball travel down without any dilation,
// and the file's own straight edges are the crop, so the quarter-of-a-cell
// composition is in the drawing rather than imposed on it. `ASTRO_FATTEN` is
// therefore 0: the traced outline IS the cell's boundary now, not a
// centreline, which also puts the doors back on a real membrane by
// construction. The first handover's dilation is retired with it. Reconciled in
// docs/05-visual-language.md before drawing: the SHAPE is adopted whole, the
// INK is not (glial green, because the file's navy would read as the neurons'
// own slate cytoplasm), and the cell is paved as a membrane rather than
// filled flat, like every other cell in the frame.

/** The handover's path data, verbatim — the record, so the trace can always be
 *  checked against the file it came from. */
export const ASTRO_SVG_D =
  'm87.22 62.36' +
  'c0 0-18.99 3.06-26.54 4.43-7.54 1.38-9.68 2.84-12.94 0.8-3.26-2.04-3.85-11.29-9.82-18.55-5.96-7.26-10.42-11.72-14.6-10.71-4.19 1.01-4.68 4.24-2.5 6.22 2.19 1.98 8.1 4.61 9.66 8.6 1.57 3.99 4.57 11.54 4.57 11.54 0 0-9.54-3.75-16.88-3.75-7.33 0-16.16 0.05-18.17 0.46-2.01 0.41-3.61 2.3-3.44 3.75 0.18 1.44 0.98 3.25 2.66 3.22 1.68-0.03 12.37 0.7 12.37 0.7 0 0-3.56 3.21-4.86 4.63-1.3 1.43-1.22 2.86-0.54 3.86 0.68 0.99 2.58 2.71 4.27 1.73 1.69-0.98 10.56-6.38 12.54-6.7 1.98-0.32 4.08-1.51 8.04 0.31 3.95 1.83 12.2 6.22 19.39 5.68 7.19-0.53 20.14-1.95 20.14-1.95 0 0-6.45 11.49-10.61 15.33-4.16 3.83-7.06 4.9-9.62 5.31-2.55 0.41-11 0.69-12.59 1.28-1.59 0.59-3.01 2.16-2.77 3.8 0.23 1.63 0.84 3 2.89 3.08 2.05 0.08 11.22 1.36 14.99 0.05 3.76-1.3 12.87-3.8 18.94-12.69 6.08-8.89 12.01-17.46 16.06-18.01 4.06-0.54 6.63 0 8.94 2.18 2.31 2.18 7.77 10.37 7.18 17.57-0.59 7.2-0.17 12.06-2.63 16.19-2.46 4.12-8.84 8.05-12.62 9.54-3.79 1.5-9.84 4.22-11.63 5.51-1.79 1.3-6.73 5.04-6.73 5.04 0 0-8.34-0.17-12.56-0.39-4.22-0.22-7.06-1.66-9.02-1.19-1.95 0.47-2.36 0.97-2.91 2.04-0.55 1.07-0.05 4.5 2.26 5.27 2.3 0.76 9.26 3.56 9.26 3.56 0 0-6.66 4.46-12.05 7.78-5.39 3.32-14.96 5.02-16.59 5.9-1.62 0.87-1.66 3.45-1.66 3.45 0 0 0.16 3.02 3.77 3.06 3.62 0.03 15.62-3.5 15.62-3.5 0 0-1.71 8.74-1.63 13.26 0.09 4.52 1.87 9.92 2.54 11.46 0.66 1.54 3.23 3.79 5.33 2.46 2.1-1.33 2.03-4.09 1.85-6.41-0.18-2.32-2.28-10.55-0.75-14.84 1.54-4.28 4.75-11.7 12.23-16.79 7.48-5.09 16.75-10.66 16.75-10.66 0 0-4.42 12.35-0.52 23.53 3.91 11.18 6.27 10.02 6.27 15.43 0 5.41-1.02 11.51-0.33 13.67 0.69 2.16 0.97 2.23 2.53 3.1 1.57 0.87 4.46-0.34 4.99-2.96 0.53-2.63 1.62-11.55 1.62-13.89 0-2.35-1.97-8.36-3.48-12.63-1.51-4.27-4.76-16.56-0.97-21.97 3.79-5.41 7.05-13.01 15-13.68 7.94-0.67 9.92 0.64 11.91 8.25 1.98 7.61 2.99 14.02 1.66 20.03-1.32 6.01-0.36 9.66-0.36 14.32 0 4.66-2.56 15.81-5.9 17.87-3.34 2.06-13.85 10.79-13.85 10.79 0 0-3.95 2.39-1.73 4.92 2.22 2.53 9.39 0.94 12.76-2.34 3.37-3.28 9.84-8.34 9.84-8.34 0 0 1.19 11.41 4.33 15.58 3.15 4.17 9 12.51 12.04 10.53 3.04-1.99 3.98-3.5 1.99-5.51-1.99-2.01-6.75-8.94-8.14-16.96-1.38-8.03-2.46-16.77-1.8-21.18 0.66-4.41 1.73-13.81 1.73-13.81' +
  'v-97.59z'

export const ASTRO_SVG_SEGS: Seg[] = parsePath(ASTRO_SVG_D)
export const ASTRO_SVG_BOX = boundsOf(ASTRO_SVG_SEGS)

/** The silhouette's closed rings, in the file's own coordinates. Two of them:
 *  the cell, and one small island the illustration carries. */
export const ASTRO_SVG_RINGS = flattenSubpaths(ASTRO_SVG_SEGS, 14)

export interface Pt {
  x: number
  y: number
}

/** ⚠ THE BODY'S CENTRE, ASKED OF THE SHAPE — the area centroid of the largest
 *  ring, which for a star with a fat middle lands in the soma. Never the
 *  bounding box's centre: the arms are not symmetric, and the box's centre
 *  drifts off the body toward whichever side reaches furthest. */
export const ASTRO_SVG_CENTRE: Pt = (() => {
  const ring = [...ASTRO_SVG_RINGS].sort((a, b) => b.length - a.length)[0]
  let a2 = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % ring.length]
    const cross = p.x * q.y - q.x * p.y
    a2 += cross
    cx += (p.x + q.x) * cross
    cy += (p.y + q.y) * cross
  }
  if (Math.abs(a2) < 1e-9) {
    return { x: ASTRO_SVG_BOX.x + ASTRO_SVG_BOX.w / 2, y: ASTRO_SVG_BOX.y + ASTRO_SVG_BOX.h / 2 }
  }
  return { x: cx / (3 * a2), y: cy / (3 * a2) }
})()

/** ⚠ THE ARM TIPS, ASKED OF THE SHAPE TOO: outline points that are further
 *  from the body's centre than their neighbours for a good stretch either
 *  side. A process ends in a point, so a local maximum of that distance IS a
 *  tip, and the drawing never has to be told where its arms are. */
export const ASTRO_SVG_TIPS: Pt[] = (() => {
  const ring = [...ASTRO_SVG_RINGS].sort((a, b) => b.length - a.length)[0]
  const d = ring.map((p) => Math.hypot(p.x - ASTRO_SVG_CENTRE.x, p.y - ASTRO_SVG_CENTRE.y))
  // ⚠ The window is a fraction of the OUTLINE, not a pixel count: a first pass
  // with a fixed window of 14 points found 58 "tips" on a 4,344-point ring —
  // every wobble in the trace counted as an arm. An arm occupies a real share
  // of the perimeter, so the window is measured in that.
  const span = Math.max(20, Math.round(ring.length / 45))
  const peaks: Pt[] = []
  for (let i = 0; i < ring.length; i++) {
    let peak = true
    for (let k = 1; k <= span && peak; k++) {
      if (d[(i - k + ring.length * 2) % ring.length] > d[i]) peak = false
      if (d[(i + k) % ring.length] > d[i]) peak = false
    }
    // Only real arms — a nick in the body is not a process.
    if (peak && d[i] > ASTRO_SVG_BOX.w * 0.25) peaks.push(ring[i])
  }
  // Two samples either side of one point are one tip, not two.
  const tips: Pt[] = []
  for (const p of peaks) {
    if (!tips.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < ASTRO_SVG_BOX.w * 0.08)) {
      tips.push(p)
    }
  }
  return tips
})()

/** ⚠ THE FATTENING, in the FILE'S OWN units so it scales with the cell instead
 *  of being a pixel constant that means something different at every frame
 *  size. Measured at the shipping size in the guards. */
export const ASTRO_FATTEN = 0

/** Whether a point is within `d` of the outline — the distance half of the
 *  dilated cell's hit test, kept beside the ray cast so there is one answer to
 *  "is this inside the astrocyte". */
function nearRing(p: AstroPlacement, q: Pt, d: number): boolean {
  // ⚠ THROUGH A GRID, because this is asked tens of thousands of times. Walking
  // all 4,400 segments per query was affordable while the answer was a ray cast
  // alone; adding a distance walk to it timed four unrelated tests out. The
  // segments are bucketed once per placement, and a query looks only at the
  // buckets it could possibly be near.
  const d2 = d * d
  const cell = p.grid.cell
  const gx = Math.floor(q.x / cell)
  const gy = Math.floor(q.y / cell)
  const reach = Math.ceil(d / cell)
  for (let ix = gx - reach; ix <= gx + reach; ix++) {
    for (let iy = gy - reach; iy <= gy + reach; iy++) {
      const bucket = p.grid.at.get(`${ix},${iy}`)
      if (!bucket) continue
      for (const [a, b] of bucket) {
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len2 = dx * dx + dy * dy || 1
        const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / len2))
        const ex = q.x - (a.x + dx * t)
        const ey = q.y - (a.y + dy * t)
        if (ex * ex + ey * ey <= d2) return true
      }
    }
  }
  return false
}

export interface AstroPlacement {
  /** file coordinates → canvas pixels. */
  map: (x: number, y: number) => Pt
  /** The transform's parts, so a test can ask what the solve reached. */
  k: number
  rot: number
  soma: Pt
  /** The tip that was carried onto `reach`, in canvas pixels. */
  reachTip: Pt
  /** Every closed ring of the silhouette, in canvas pixels. */
  rings: Pt[][]
  /** The placed shape's bounding box, for cheap rejection. */
  box: { x: number; y: number; w: number; h: number }
  /** The outline's segments bucketed by position, so "is this near the wall?"
   *  does not have to walk the whole shape. */
  grid: { cell: number; at: Map<string, [Pt, Pt][]> }
  /** ⚠ HOW FAR THE CELL IS FATTENED BEYOND ITS TRACED OUTLINE, px (21c-3).
   *  The handover's processes are hairlines at this scale — the user: "the
   *  fingers look much thicker so that it's easier to visualize glutamate
   *  going through the finger. At this point, the fingers are too thin."
   *
   *  Rather than redraw the silhouette (which would lose the star it is), the
   *  cell is DILATED: every point of the outline is treated as the centre of a
   *  disc of this radius, so the body grows a little and a hairline process
   *  grows into a tube of `2 × dilate`. The star's shape is untouched — this
   *  is the same shape, drawn fatter — and the drawing gets it for free by
   *  stroking the traced path, which is exactly what a stroke IS. */
  dilate: number
}

/** ⚠ A SIMILARITY, NOT A DEFORMATION. The cell is placed by rotating and
 *  scaling the WHOLE silhouette so that its body lands where the layout wants
 *  it and one of its own arm tips lands on the cleft's mouth. Two point
 *  correspondences determine a similarity exactly, and a similarity cannot
 *  bend the outline — so the shape on screen is the shape in the file, and no
 *  arm has to be stretched into place (which is what would put a kink where a
 *  process meets the body).
 *
 *  The arm carried onto the mouth is the one already pointing most nearly the
 *  right way, so the rotation stays small and the cell keeps its own posture. */
export function placeAstro(soma: Pt, reach: Pt): AstroPlacement {
  const c = ASTRO_SVG_CENTRE
  const want = Math.atan2(reach.y - soma.y, reach.x - soma.x)
  // ⚠ THE LONGEST ARM THAT POINTS THE RIGHT WAY, not simply the nearest-angled
  // one (21c-3c). The scale is set by the arm that reaches the cleft — so
  // choosing a stub because it happens to point well blows the whole cell up to
  // make that stub long enough. Among the arms aimed within 40° of the target,
  // the longest wins; only if none is, does the nearest angle decide.
  const armOf = (t: Pt) => Math.hypot(t.x - c.x, t.y - c.y)
  const offBy = (t: Pt) => {
    const a = Math.atan2(t.y - c.y, t.x - c.x)
    return Math.abs(((a - want + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
  }
  const aimed = ASTRO_SVG_TIPS.filter((t) => offBy(t) < 0.7)
  let tip = ASTRO_SVG_TIPS[0] ?? { x: ASTRO_SVG_BOX.x, y: c.y }
  if (aimed.length) {
    tip = aimed.reduce((a, b) => (armOf(a) >= armOf(b) ? a : b))
  } else {
    let best = Infinity
    for (const t of ASTRO_SVG_TIPS) {
      if (offBy(t) < best) {
        best = offBy(t)
        tip = t
      }
    }
  }
  const armLen = Math.hypot(tip.x - c.x, tip.y - c.y) || 1
  const k = Math.hypot(reach.x - soma.x, reach.y - soma.y) / armLen
  const rot = want - Math.atan2(tip.y - c.y, tip.x - c.x)
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const map = (x: number, y: number): Pt => ({
    x: soma.x + ((x - c.x) * cos - (y - c.y) * sin) * k,
    y: soma.y + ((x - c.x) * sin + (y - c.y) * cos) * k,
  })
  const rings = ASTRO_SVG_RINGS.map((r) => r.map((p) => map(p.x, p.y)))
  // A hairline process should end up a tube a transmitter ball can be seen
  // travelling down, so the dilation is measured in ball radii, not chosen.
  const dilate = k * ASTRO_FATTEN
  const xs = rings.flat().map((p) => p.x)
  const ys = rings.flat().map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return {
    map,
    k,
    rot,
    soma,
    reachTip: map(tip.x, tip.y),
    rings,
    grid: buildGrid(rings, Math.max(6, dilate * 2)),
    box: { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY },
    dilate,
  }
}

/** ⚠ IS THIS POINT INSIDE THE CELL? Even-odd ray casting over every ring, so
 *  the island counts as the drawing counts it. This is the DECISION the caught
 *  transmitter is guarded by — one function, asked by the drawing and by the
 *  tests alike. */
/** ⚠ A POINT ON THE CELL'S DRAWN BOUNDARY, from a point on its traced path
 *  (21c-3a). The dilation makes the trace the CENTRELINE of a fat process, so
 *  a door placed on the trace sits in the middle of the cytoplasm rather than
 *  in the wall — which is both wrong to look at and wrong for the crossing
 *  guard, which measured a ball entering 28 px from any door.
 *
 *  The outward direction is found, not assumed: take the local tangent, try
 *  both normals, and keep whichever lands OUTSIDE the traced polygon. */
/** The outline's local tangent angle at the nearest point to `q` — so a door
 *  drawn on this cell can be set ACROSS its own membrane wherever it sits
 *  (21c-3b, user: "on the astrocyte, the last channel is positioned
 *  horizontally, which is wrong"). Every door had been given one angle, taken
 *  from the line between the body and the cleft, which is right for the arm
 *  that runs along it and wrong for every other place. */
export function tangentOn(p: AstroPlacement, q: Pt): number {
  const { ring, at } = nearestOn(p, q)
  const a = ring[(at - 3 + ring.length) % ring.length]
  const b = ring[(at + 3) % ring.length]
  return Math.atan2(b.y - a.y, b.x - a.x)
}

function nearestOn(p: AstroPlacement, q: Pt): { ring: Pt[]; at: number } {
  let ring = p.rings[0]
  let at = 0
  let best = Infinity
  for (const r of p.rings) {
    for (const [i, k] of r.entries()) {
      const d = Math.hypot(k.x - q.x, k.y - q.y)
      if (d < best) {
        best = d
        ring = r
        at = i
      }
    }
  }
  return { ring, at }
}

/** ⚠ A HOLDING POINT JUST OUTSIDE A DOOR ON THE ASTROCYTE (21c-3f, user:
 *  "adjust NTs astrocyte enter path. Currently: enters via membrane"). A ball
 *  flying a straight line from the gap's mouth to a transporter meets the
 *  cell's outline wherever that line happens to cross it, which on a wavy
 *  process is not the door. Coming to a point straight out from the door and
 *  then going in through it is both the fix and what entering through a hole
 *  looks like. */
export function outsideOn(p: AstroPlacement, q: Pt, by: number): Pt {
  const { ring, at } = nearestOn(p, q)
  const a = ring[(at - 3 + ring.length) % ring.length]
  const b = ring[(at + 3) % ring.length]
  const tx = b.x - a.x
  const ty = b.y - a.y
  const len = Math.hypot(tx, ty) || 1
  const nx = -ty / len
  const ny = tx / len
  const probe = { x: q.x + nx * 3, y: q.y + ny * 3 }
  const sign = astroContains(p, probe) ? -1 : 1
  // ⚠ AND IT MUST REALLY BE OUTSIDE (21c-3h, user, at 25 ms: "crossing
  // membrane"). Stepping a fixed distance along the normal can land INSIDE a
  // neighbouring lobe of a branched cell — and then the ball entered the
  // astrocyte at the holding point instead of at the pore, which is a ball
  // going through the wall 15 px from the door it was aiming for. The step is
  // walked out until the shape agrees it is outside.
  for (let d = by; d <= by * 3; d += 4) {
    const out = { x: q.x + nx * sign * d, y: q.y + ny * sign * d }
    if (!astroContains(p, out)) return out
  }
  return { x: q.x + nx * sign * by, y: q.y + ny * sign * by }
}

export function outwardOn(p: AstroPlacement, q: Pt): Pt {
  const { ring, at } = nearestOn(p, q)
  const a = ring[(at - 3 + ring.length) % ring.length]
  const b = ring[(at + 3) % ring.length]
  const tx = b.x - a.x
  const ty = b.y - a.y
  const len = Math.hypot(tx, ty) || 1
  const nx = -ty / len
  const ny = tx / len
  const probe = { x: ring[at].x + nx * 2, y: ring[at].y + ny * 2 }
  const sign = insideTrace(p, probe) ? -1 : 1
  return {
    x: ring[at].x + nx * sign * p.dilate,
    y: ring[at].y + ny * sign * p.dilate,
  }
}

/** Ray cast against the TRACED rings only — no dilation. The half of the hit
 *  test that answers "which side of the drawn line is this". */
function insideTrace(p: AstroPlacement, q: Pt): boolean {
  let inside = false
  for (const ring of p.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i]
      const b = ring[j]
      if (a.y > q.y !== b.y > q.y) {
        const t = (q.y - a.y) / (b.y - a.y || 1e-12)
        if (q.x < a.x + t * (b.x - a.x)) inside = !inside
      }
    }
  }
  return inside
}

function buildGrid(rings: Pt[][], cell: number): { cell: number; at: Map<string, [Pt, Pt][]> } {
  const at = new Map<string, [Pt, Pt][]>()
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1]
      const b = ring[i]
      const x0 = Math.floor(Math.min(a.x, b.x) / cell)
      const x1 = Math.floor(Math.max(a.x, b.x) / cell)
      const y0 = Math.floor(Math.min(a.y, b.y) / cell)
      const y1 = Math.floor(Math.max(a.y, b.y) / cell)
      for (let ix = x0; ix <= x1; ix++) {
        for (let iy = y0; iy <= y1; iy++) {
          const key = `${ix},${iy}`
          const list = at.get(key)
          if (list) list.push([a, b])
          else at.set(key, [[a, b]])
        }
      }
    }
  }
  return { cell, at }
}

export function astroContains(p: AstroPlacement, q: Pt): boolean {
  // A bounding-box rejection first: most questions asked of this shape are
  // about points nowhere near it, and a ray cast over 4,400 edges to answer
  // "no" is the difference between a run that finishes and one that does not.
  if (q.x < p.box.x - p.dilate || q.x > p.box.x + p.box.w + p.dilate) return false
  if (q.y < p.box.y - p.dilate || q.y > p.box.y + p.box.h + p.dilate) return false
  // ⚠ INSIDE THE FATTENED CELL, which is what is drawn (21c-3): within the
  // traced outline, OR within the dilation of it. Asked in that order because
  // the ray cast is cheap to fail and the distance walk is not.
  if (p.dilate > 0 && nearRing(p, q, p.dilate)) return true
  let inside = false
  for (const ring of p.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i]
      const b = ring[j]
      if (a.y > q.y !== b.y > q.y) {
        const t = (q.y - a.y) / (b.y - a.y || 1e-12)
        if (q.x < a.x + t * (b.x - a.x)) inside = !inside
      }
    }
  }
  return inside
}
