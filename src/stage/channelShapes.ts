import { boundsOf, flattenPath, parsePath, tracePath, type Seg } from './svgPath'

// THE CHANNEL GLYPHS, TRACED (21c-3c).
//
// ⚠ Handovers: ~/Downloads/EAAT.svg and ~/Downloads/snat.svg (user,
// 2026-09-05: "re-draw channels and transporters based on snat.svg and
// EAAT.svg"). Both are stroke-only outlines of three closed shapes — two
// subunits and the piece between them — in ~33 × 37 boxes, drawn as a protein
// standing ACROSS a membrane.
//
// ⚠ Adopted as SHAPES, not as ink, exactly as the astrocyte handovers were: the
// files are black outlines, and this app's channels carry a colour CODE that
// says which protein family a door belongs to (21c-3b). So each glyph is traced
// and then painted in its family's own two tones — the subunits in the wall
// colour, the pore left as a hole in the outside's own ink.
//
// ⚠ WHAT IS STILL MISSING, and asked for: the CALCIUM PUMP / EXCHANGER (PMCA or
// NCX) on the presynaptic wall has no glyph of its own and is drawn with the
// EAAT's for now, which is honest only about its being a transporter. VGLUT —
// the vesicle filler — is not drawn as a protein at all yet.

export interface ChannelGlyph {
  /** The subunits, in the family's wall colour. */
  parts: Seg[][]
  /** The traced box, so the glyph can be fitted to a membrane's thickness. */
  box: { x: number; y: number; w: number; h: number }
  /** ⚠ THE HEIGHT THAT SPANS THE WALL — the LEFT GATE's own height, not the
   *  whole box (21c-3e). PMCA carries its ATP site on a tail hanging below the
   *  membrane, which is anatomically right and makes the box half as tall
   *  again; fitting the box to the wall shrank the gates until its pore was
   *  3.9 px, narrower than a ball. What has to match the membrane is the part
   *  that is IN the membrane. */
  wallH: number
  /** Half the pore's width at its narrowest, in the file's own units — what a
   *  ball has to fit through, so the guard can ask whether one does. */
  bore: number
}

/** ⚠ THE TWO SUBUNITS MAY BE MOVED APART, and it is declared when they are
 *  (21c-3c). A transmitter ball is 6.4 px across and has to pass through the
 *  opening — the user's standing requirement — and `snat.svg` draws its staves
 *  close enough together that, at any size the scene can afford, the ball would
 *  be wider than the gap. Scaling the whole protein up until the gap fits makes
 *  SNAT twice EAAT's size for no reason but its file's proportions; opening its
 *  own gap by a few units keeps both proteins the same size on the wall. The
 *  SHAPE of each subunit is untouched — only the distance between them. */
const glyph = (ds: string[], spread = 0): ChannelGlyph => {
  const parts = ds.map(parsePath).map((segs, i) =>
    spread === 0 || i > 1
      ? segs
      : segs.map((seg) => {
          const dx = i === 0 ? -spread : spread
          if (seg.kind === 'close') return seg
          if (seg.kind === 'curve') {
            return { ...seg, x: seg.x + dx, x1: seg.x1 + dx, x2: seg.x2 + dx }
          }
          if (seg.kind === 'quad') return { ...seg, x: seg.x + dx, x1: seg.x1 + dx }
          return { ...seg, x: seg.x + dx }
        }),
  )
  const all = parts.flat()
  const box = boundsOf(all)
  // ⚠ The bore is MEASURED off the trace, not declared: the narrowest gap
  // between the two subunits, found by walking their flattened outlines at the
  // glyph's own middle. A number typed here would drift from the drawing the
  // first time a file changed.
  const mid = box.y + box.h / 2
  const near = (segs: Seg[]) =>
    flattenPath(segs, 10).filter((p) => Math.abs(p.y - mid) < box.h * 0.12)
  const left = near(parts[0])
  const right = near(parts[1])
  let gap = box.w
  for (const a of left) {
    for (const b of right) {
      gap = Math.min(gap, Math.abs(b.x - a.x))
    }
  }
  return { parts, box, wallH: boundsOf(parts[0]).h, bore: gap }
}

export const EAAT_GLYPH: ChannelGlyph = glyph([
  'm55.83 13.8' +
  'c0 0 2.31-1.13 3.72 1.14 1.41 2.28 4.73 9.79 4.38 16.7-0.36 6.9-3.28 14.81-4.5 16.1-1.23 1.28-3.18 3.21-4.24 1.23-1.06-1.98 0.19-5.06 0.19-5.06 0 0 3.44-8.62 3.46-12.02 0.01-3.39-3.99-14.5-3.99-14.5 0 0-0.63-2.18 0.98-3.59' +
  'z'
,
  'm84.95 13.8' +
  'c0 0-2.3-1.13-3.73 1.14-1.43 2.28-4.82 9.79-4.52 16.7 0.29 6.9 3.14 14.81 4.36 16.1 1.21 1.28 3.15 3.21 4.22 1.23 1.08-1.98-0.14-5.06-0.14-5.06 0 0-3.37-8.62-3.36-12.02 0.02-3.39 4.12-14.5 4.12-14.5 0 0 0.65-2.18-0.95-3.59' +
  'z'
,
  'm59.67 14.96c0 0 6.09 1.42 10.47 1.16 4.38-0.25 10.97-1.06 10.97-1.06v0.05' +
  'c-1.48 2.47-4.7 9.78-4.41 16.53 0.29 6.9 3.14 14.81 4.36 16.1q0.06 0.06 0.12 0.12' +
  'c-1.15-0.2-6.14-1-11.1-0.92-4.9 0.08-9.56 0.7-10.72 0.86q0.03-0.03 0.07-0.06' +
  'c1.22-1.29 4.14-9.2 4.5-16.1 0.34-6.73-2.8-14.03-4.26-16.51z'])

export const SNAT_GLYPH: ChannelGlyph = glyph(
  [
  'm60.5 50' +
  'c-3.59 0-6.5-8.27-6.5-18.5 0-10.23 2.91-18.5 6.5-18.5 3.59 0 6.5 8.27 6.5 18.5 0 10.23-2.91 18.5-6.5 18.5' +
  'z'
,
  'm80.5 50' +
  'c-3.59 0-6.5-8.27-6.5-18.5 0-10.23 2.91-18.5 6.5-18.5 3.59 0 6.5 8.27 6.5 18.5 0 10.23-2.91 18.5-6.5 18.5' +
  'z'
,
  'm70 50' +
  'c-2.25 0-4.36-0.95-6.16-2.62 1.89-3.22 3.16-9.12 3.16-15.88 0-6.76-1.27-12.66-3.16-15.88 1.8-1.67 3.91-2.62 6.16-2.62 2.53 0 4.88 1.2 6.81 3.26-1.7 3.33-2.81 8.91-2.81 15.24 0 6.33 1.11 11.91 2.81 15.24-1.93 2.06-4.28 3.26-6.81 3.26' +
  'z'  ],
  // Measured: +2.7 units each way takes the pore from 7.0 to 12.4 file units,
  // which at the shared wall height is a little over a ball's width.
  2.7,
)

/** ⚠ ONE DRAWING FOR EVERY CHANNEL, whichever glyph it wears. The traced shape
 *  is fitted ACROSS the membrane — its own height becomes the wall's thickness
 *  times `span` — set at the door's point and turned to the membrane's own
 *  tangent there. The subunits are filled in the family's wall tone and outlined
 *  in its lighter one, so the opening between them reads as a way through. */
export function drawChannelGlyph(
  ctx: CanvasRenderingContext2D,
  g: ChannelGlyph,
  at: { x: number; y: number },
  angle: number,
  ink: { wall: string; mouth: string },
  wallSpan: number,
): void {
  // ⚠ FITTED BY ITS PORE, not by its height (21c-3c). The user's standing
  // requirement is that a transmitter ball goes THROUGH the opening, and the
  // two handovers have very different pores for their size — fitted to a
  // common height, EAAT's came out 7 px across and SNAT's 4, against a ball
  // 6.4 px wide. Scaling each so its own pore admits a ball means the two
  // proteins are drawn at different sizes, which is honest: they are different
  // proteins. ⚠ Declared exaggeration: at this fit a channel stands several
  // times the membrane's own drawn thickness, the same licence the balls take.
  const k = wallSpan / g.wallH
  const cx = g.box.x + g.box.w / 2
  const gate = boundsOf(g.parts[0])
  const cy = gate.y + gate.h / 2
  ctx.save()
  ctx.translate(at.x, at.y)
  ctx.rotate(angle)
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(0.8, g.wallH * k * 0.055)
  ctx.fillStyle = ink.wall
  ctx.strokeStyle = ink.mouth
  for (const part of g.parts) {
    ctx.beginPath()
    tracePath(ctx, part, (x, y) => ({ x: (x - cx) * k, y: (y - cy) * k }))
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

export const PMCA_GLYPH: ChannelGlyph = glyph([
    'm25.31 0l-4.85 25.08' +
    'c0 0-4.35-0.63-5.68 5.15-1.33 5.78 4.91 6.31 4.91 6.31 0 0-0.73 3.56-3.9 4.1-3.16 0.54-13.15-0.08-13.15-0.08 0 0-3.59-1.47-3.12-5.26 0.48-3.78 2.97-3.1 5.22-4.77 2.26-1.68 5.23-6.38 6.23-9.15 0.99-2.77 1.81-14.76 4.81-17.19 3-2.42 6.22-4.02 9.53-4.19' +
    'z',
    'm35.7 4.19' +
    'c3 2.43 3.81 14.42 4.81 17.19 1 2.77 3.97 7.47 6.22 9.15 2.26 1.67 4.75 0.99 5.23 4.77 0.3 2.43-1.07 3.9-2.09 4.65' +
    'v15.6h-2.57' +
    'c1.02 1.55 2.39 4.03 2.27 5.98-0.18 3.09-1.34 5.97-3.17 6.97-1.83 0.99-4.2 3.61-7.14 3.61-2.93 0-6.52-1.6-6.16-2.46 0.36-0.86 4.7 0.56 4.7 0.56' +
    'l4.1-2.36 0.14-5.96-3.99-2.87-2.29-0.05-1.04 0.67 3.96-4.09h-2.15v-14.81' +
    'q-0.48-0.04-0.84-0.1' +
    'c-3.17-0.54-3.9-4.1-3.9-4.1 0 0 6.24-0.53 4.91-6.31-1.33-5.78-5.68-5.15-5.68-5.15' +
    'l-4.85-25.08c3.31 0.17 6.53 1.77 9.53 4.19z',
    'm36.53 4.07v36.22h-20.98v-36.22' +
    'c0 0 4.18-4.03 10.23-3.97 6.04 0.07 10.75 3.97 10.75 3.97z'
])

export const VGLUT_GLYPH: ChannelGlyph = glyph([
    'm2.84 3.63' +
    'c1.27-0.59 9.75-3.67 11.77-3.63 2.02 0.04 5.92 0.43 6.38 2.84 0.46 2.42-2.43 6.5-3.27 9.14-0.83 2.63-1.77 5.96-0.83 7.56 0.95 1.6 2.6 2.77 2.6 2.77' +
    'l-1.22 17.5' +
    'c0 0-2.86 4.44-1.7 8.8 1.16 4.35 3.25 3.53 2.55 6.3-0.71 2.78-1.74 6.26-4.34 6.3-2.59 0.05-12.45-2.71-13.49-4.56-1.05-1.85-1.49-3.16 0.5-9.57 2-6.41 0.71-14.95 0.61-20.67-0.11-5.71-2.94-18.16-2.31-19.97 0.63-1.8 1.49-2.22 2.75-2.81' +
    'z',
    'm49.16 3.63' +
    'c-1.27-0.59-9.75-3.67-11.77-3.63-2.02 0.04-5.92 0.43-6.38 2.84-0.46 2.42 2.43 6.5 3.27 9.14 0.83 2.63 1.77 5.96 0.83 7.56-0.95 1.6-2.6 2.77-2.6 2.77' +
    'l1.22 17.5' +
    'c0 0 2.86 4.44 1.7 8.8-1.16 4.35-3.25 3.53-2.55 6.3 0.71 2.78 1.74 6.26 4.34 6.3 2.59 0.05 12.45-2.71 13.49-4.56 1.05-1.85 1.49-3.16-0.5-9.57-2-6.41-0.71-14.95-0.61-20.67 0.11-5.71 2.94-18.16 2.31-19.97-0.63-1.8-1.49-2.22-2.75-2.81' +
    'z',
    'm26.13 43.31' +
    'c-6.31 0-11.41-5.1-11.41-11.41 0-6.31 5.1-11.4 11.41-11.4 6.3 0 11.4 5.09 11.4 11.4 0 6.31-5.1 11.41-11.4 11.41' +
    'z'
])

export interface Pt {
  x: number
  y: number
}

/** ⚠ THE CLEAR WIDTH BETWEEN THE TWO GATES at a given height, in the file's own
 *  units — measured by crossing each gate's outline with a horizontal ray, so a
 *  straight edge counts the same as a curved one. (The earlier version sampled
 *  flattened POINTS, and a long straight edge has none between its ends: VGLUT
 *  read as having no gate at all for a third of its height.) */
export function poreGapAt(g: ChannelGlyph, y: number): number {
  const cross = (pts: Pt[], pick: (xs: number[]) => number): number | null => {
    const xs: number[] = []
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      if (a.y === b.y) continue
      if ((a.y - y) * (b.y - y) > 0) continue
      xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x))
    }
    return xs.length ? pick(xs) : null
  }
  const l = cross(flattenPath(g.parts[0], 16), (xs) => Math.max(...xs))
  const r = cross(flattenPath(g.parts[1], 16), (xs) => Math.min(...xs))
  if (l === null || r === null) return 0
  return Math.max(0, r - l)
}

/** ⚠ WHERE THE CARGO SITS INSIDE THE CHANNEL (21c-3l, user: "calcium ion should
 *  be positioned not in the middle of the channel, but closer to the entrance
 *  there where you see a visual curved shaped, circle shaped slot").
 *
 *  It was sitting at the glyph's own origin — the middle of the wall — which is
 *  the narrowest part of the picture and reads as a ball stuck in the neck. The
 *  handovers both draw a CHAMBER: a rounded pocket where the two gates bulge
 *  apart. This finds it rather than declaring it, so it moves if the file does:
 *  walking from the wall's middle out toward the side the cargo enters by, the
 *  first bulge — a row wider than the rows either side of it — is the seat.
 *
 *  `side` is which way the cargo comes from in the GLYPH's own coordinates:
 *  +1 is the direction the ATP tail hangs (cytoplasm, for PMCA on the terminal
 *  wall), −1 the other. Returns a local y, measured from the gates' centre.
 *
 *  If the gates make no chamber, the pore piece's own centre is the answer —
 *  which is exactly right for VGLUT, whose middle piece IS a circle. */
const SEAT_CACHE = new WeakMap<ChannelGlyph, Map<number, number>>()

export function poreSeat(g: ChannelGlyph, side: 1 | -1): number {
  // ⚠ MEMOISED. It is a pure function of the trace, and the cast asks for it on
  // every ball of every frame — measured, walking the outline forty times a
  // ball timed the suite out.
  let hit = SEAT_CACHE.get(g)
  if (!hit) {
    hit = new Map()
    SEAT_CACHE.set(g, hit)
  }
  const had = hit.get(side)
  if (had !== undefined) return had
  const found = solveSeat(g, side)
  hit.set(side, found)
  return found
}

function solveSeat(g: ChannelGlyph, side: 1 | -1): number {
  const gate = boundsOf(g.parts[0])
  const cy = gate.y + gate.h / 2
  const step = 0.5
  const rows: number[] = []
  for (let k = 0; k * step <= gate.h / 2; k++) rows.push(poreGapAt(g, cy + side * k * step))
  for (let i = 1; i + 1 < rows.length; i++) {
    if (rows[i] > rows[i - 1] && rows[i] >= rows[i + 1] && rows[i] > 0) {
      return side * i * step
    }
  }
  const pore = boundsOf(g.parts.slice(2).flat())
  return pore.y + pore.h / 2 - cy
}

/** ⚠ WHERE THE GATES SWING FROM (21c-3e, user: "rotates both 'gates' around a
 *  point in the center of left-hand gate, on its right border. Same for VGlut
 *  physics of rotation").
 *
 *  Both gates turn about ONE point — the right edge of the LEFT gate, at its
 *  own vertical middle — so the pair opens like a jaw rather than each leaf
 *  turning on its own hinge. Read off the trace, so it moves with the file. */
const hingeOf = (g: ChannelGlyph): Pt => {
  const b = boundsOf(g.parts[0])
  return { x: b.x + b.w, y: b.y + b.h / 2 }
}

/** ⚠ A CHANNEL THAT MOVES.  0 → 1 swings the two gates about the hinge;
 *  the middle piece does not move, because it is the pore they open around. */
/** ⚠ WHAT ORDER THE PIECES ARE PAINTED IN (21c-3f, user: "the rectangle is
 *  back, should go under the gates layers"). The parts come out of the file in
 *  its own order, which puts the middle piece LAST — on top of the gates,
 *  reading as a rectangle laid across them. It is the thing they open around,
 *  so it belongs underneath.
 *
 *  A named decision rather than a line inside the drawing, so a test can ask
 *  for it: parts 0 and 1 are the gates, everything else is the pore. */
export function partOrder(g: ChannelGlyph): number[] {
  const idx = [...g.parts.keys()]
  return [...idx.filter((i) => i >= 2), ...idx.filter((i) => i < 2)]
}

export function drawMovingGlyph(
  ctx: CanvasRenderingContext2D,
  g: ChannelGlyph,
  at: Pt,
  angle: number,
  ink: { wall: string; mouth: string },
  wallSpan: number,
  open: number,
  /** For PMCA: where its ATP sits, and how much of it is left. */
  atp?: { at: Pt; left: number },
): void {
  const k = wallSpan / g.wallH
  const cx = g.box.x + g.box.w / 2
  const gate = boundsOf(g.parts[0])
  const cy = gate.y + gate.h / 2
  const hinge = hingeOf(g)
  // ⚠ THE SWING IS SIGNED BOTH WAYS (21c-3l). It was clamped to [0, 1], so
  // "open to the side the cargo comes from" — the whole first half of a
  // transporter's cycle, and the documented meaning of a negative `open` —
  // was drawn identically to shut. A transporter that only ever opens one way
  // is a door. Now −1 opens the far end of the pore, +1 the near one.
  const swing = SWING_RAD * Math.max(-1, Math.min(1, open))
  ctx.save()
  ctx.translate(at.x, at.y)
  ctx.rotate(angle)
  ctx.scale(k, k)
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(0.8 / k, g.wallH * 0.055)
  ctx.fillStyle = ink.wall
  ctx.strokeStyle = ink.mouth
  // ⚠ THE PORE GOES UNDER THE GATES (21c-3f, user: "the rectangle is back,
  // should go under the gates layers"). The parts are drawn in the file's own
  // order, which puts the middle piece LAST — so it sat on top of the gates and
  // read as a rectangle laid across them. It is the thing they open around, so
  // it belongs underneath.
  const order = partOrder(g)
  for (const i of order) {
    const part = g.parts[i]
    ctx.save()
    // The two gates turn; anything else is the pore and stays put.
    if (i < 2) {
      ctx.translate(hinge.x - cx, hinge.y - cy)
      ctx.rotate(i === 0 ? -swing : swing)
      ctx.translate(cx - hinge.x, cy - hinge.y)
    }
    ctx.beginPath()
    tracePath(ctx, part, (x, y) => ({ x: x - cx, y: y - cy }))
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
  // ⚠ SMALL ENOUGH TO SIT IN ITS SLOT (21c-3k, user: "make ATP smaller, so that
  // it fits into a slot on the channel"). At three tenths of the wall it was
  // wider than the lobe it is supposed to bind in.
  if (atp && atp.left > 0.01) drawAtp(ctx, atp.at, wallSpan * ATP_OF_SPAN, atp.left)
}

/** ⚠ ONE TRANSPORT CYCLE, SHARED (21c-3o). Phase 0→1 across a turn, in →
 *  signed openness, out: −1 open to the side the cargo comes from, 0 shut
 *  around it, +1 open to where it goes.
 *
 *  It lives here because the SAME PROTEIN runs it in two views. The synapse's
 *  vesicles carry VGLUT at a register where the membrane is 5 px thick, and the
 *  SNARE bench carries VGLUT at a register where the bilayer is drawn molecule
 *  by molecule — one biology, one drawing, and one cycle. A second private copy
 *  of these four beats is a second copy of every correction made to them.
 *
 *  ⚠ The drawing's own mirroring is NOT here: which way round a glyph stands on
 *  its membrane is the caller's business, and both callers flip the sign at the
 *  one place they draw. */
export const TURN_IN = 0.3
export const TURN_SHUT = 0.2
export const TURN_FLIP = 0.2
export const TURN_OUT = 1 - TURN_IN - TURN_SHUT - TURN_FLIP

export function transportOpen(phase: number): number {
  const p = Math.max(0, Math.min(1, phase))
  if (p < TURN_IN) return -1
  if (p < TURN_IN + TURN_SHUT) return (p - TURN_IN) / TURN_SHUT - 1
  if (p < TURN_IN + TURN_SHUT + TURN_FLIP) return (p - TURN_IN - TURN_SHUT) / TURN_FLIP
  return 1
}

/** ⚠ HOW FAR THE GATES SWING at full open, radians. Enough to read as a jaw
 *  working, not so far that the protein comes apart. */
export const SWING_RAD = 0.34

/** ⚠ HOW BIG THE ATP IS, as a share of the wall's own span (21c-3k, user: "make
 *  ATP smaller, so that it fits into a slot on the channel"). At 0.3 it was
 *  wider than the lobe it is supposed to bind in. Guarded against the slot the
 *  handover actually draws, so it cannot drift back. */
export const ATP_OF_SPAN = 0.16

/** ⚠ THE SLOT'S OWN WIDTH, in the glyph's units — the part of PMCA that hangs
 *  BELOW the membrane, which is where its ATP site is. Measured off the trace
 *  so the fit is a fact about the drawing rather than an eyeball. */
export function slotWidth(g: ChannelGlyph): number {
  const gate = boundsOf(g.parts[0])
  const below = g.parts
    .flatMap((part) => flattenPath(part, 10))
    .filter((p) => p.y > gate.y + gate.h)
  if (below.length < 2) return 0
  const xs = below.map((p) => p.x)
  return Math.max(...xs) - Math.min(...xs)
}

/** ⚠ ATP AS A HEXAGON (user: "draw it as a hexagon") — the app has no other
 *  hexagon, so the shape itself says "this is the fuel", and it fades as the
 *  pump spends it. Amber, the energy colour the app already uses for the
 *  pump's stored work. */
export function drawAtp(
  ctx: CanvasRenderingContext2D,
  at: Pt,
  r: number,
  left: number,
): void {
  ctx.save()
  ctx.globalAlpha *= Math.max(0, Math.min(1, left))
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2
    const x = at.x + Math.cos(a) * r
    const y = at.y + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = '#fbbf24'
  ctx.fill()
  ctx.strokeStyle = '#b45309'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}
