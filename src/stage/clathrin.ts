// CLATHRIN AND DYNAMIN — one drawing each, shared by every view that shows
// retrieval (21c-10, illustration handover of 2026-09-06, reconciled in
// docs/05-visual-language.md).
//
// ⚠ ONE OWNER. The endocytosis panels and the SNARE bench both show a clathrin
// coat, and until this module they showed two different objects: triskelion-ish
// arcs in one, plain studs in the other. A child who has met the coat in one
// view must meet the same coat in the other — and a correction to the drawing
// must reach both — so the shapes live here and the scenes only place them.

export const CLATHRIN_INK = '#22d3ee'
/** The light chain: the same family, lighter — this app's grammar for two
 *  parts of one protein. NOT the handover's orange, which is spoken for twice
 *  (rab, SNAT). */
export const CLATHRIN_LIGHT = '#a5f3fc'

/** ⚠ Dynamin's own ink. The bar it replaces wore `#c026d3`, which is NSF's
 *  fuchsia exactly — two different machines in one colour. The handover draws
 *  dynamin navy; navy is unreadable on this dark ground, and blue-400 is the
 *  nearest free hue (sky is the calcium pump's, indigo is EAAT's). */
export const DYNAMIN_INK = '#60a5fa'

/** How many turns the coil makes round the neck — the handover draws four. */
export const DYNAMIN_TURNS = 4

export interface Pt {
  x: number
  y: number
}

/** ⚠ THE TRISKELION'S LEGS — the decision, pure, so a guard can ask it without
 *  a canvas. Three legs from one hub, each bent at a knee, all curling the
 *  SAME way round (the pinwheel chirality panel A draws). `r` is the leg's
 *  reach from the hub; `rot` turns the whole pinwheel. Each leg is returned as
 *  hub → knee → foot. */
export function triskelionLegs(r: number, rot = 0): [Pt, Pt, Pt][] {
  const legs: [Pt, Pt, Pt][] = []
  for (let i = 0; i < 3; i++) {
    const a = rot + (i / 3) * Math.PI * 2
    // The knee sits out along the leg's own direction; the foot swings a fixed
    // step ANTICLOCKWISE past it — the same sign for every leg, which is what
    // makes it a pinwheel rather than a star.
    const knee = { x: Math.cos(a) * r * 0.55, y: Math.sin(a) * r * 0.55 }
    const foot = {
      x: Math.cos(a + 0.85) * r,
      y: Math.sin(a + 0.85) * r,
    }
    legs.push([{ x: 0, y: 0 }, knee, foot])
  }
  return legs
}

/** ⚠ WHERE A PIECE SITS IN THE LANDING ORDER (21c-14, user: "let it fly into
 *  the scene and 'stick' to the membrane, and build up a circle, by adding
 *  elements at the membrane side").
 *
 *  0 is the apex of the coated dome, 1 is the rim where the coat meets the
 *  membrane. A lattice nucleates and then EXTENDS toward its edge, so the apex
 *  lands first and every later piece is added on the membrane side of the ones
 *  already there — which is both what the user asked to see and what a growing
 *  coated pit does. `k` runs along the arc, `n` pieces in all. */
export function coatOrder(k: number, n: number): number {
  return Math.abs((k + 0.5) / n - 0.5) * 2
}

/** ⚠ HOW FAR THROUGH ITS FLIGHT a piece of that order is, given how much coat
 *  there is: 0 = still off-scene, 1 = stuck to the membrane.
 *
 *  ⚠ IT IS A JOURNEY, NEVER AN OPACITY. The coat used to be an alpha ramp per
 *  piece — pinwheels swelling out of nothing and, on the way out, going
 *  see-through where they stood (user: "clathrin currently fades in and becomes
 *  transparent occasionally"). A protein arrives from the cytosol and binds;
 *  it does not condense out of the air. Every piece is drawn at full strength
 *  or not at all, and this number moves it. */
export const COAT_SPREAD = 0.72

/** ⚠ BOTH LEGS RUN ON THE RUN'S OWN CLOCK, not on the coat's coverage
 *  (21c-15, user: "more smooth movements (no jerky breaks)… elements fly in,
 *  and slowly build themselves into the structure, when a free space occurs").
 *
 *  They used to be driven by `clathrinPullAt` — the ratchet — which starts each
 *  pull fast and stops dead. A piece halfway through its flight was already
 *  being dragged toward its seat at the ratchet's speed, so the two legs fought
 *  and the piece lurched: measured, 13.4 px in one frame. Both legs are eased
 *  windows in u now, so every piece has zero speed at the start and end of each
 *  leg, and no leg can yank another.
 *
 *  "When a free space occurs" is the STAGGER: a piece's settle window opens
 *  where its own place in the arc comes up, apex first, each later one on the
 *  membrane side of those already there. The ratchet still drives the bud and
 *  the lattice's gap — the snap the exhibit is about — and a piece that has
 *  taken its seat rides the lattice, as part of it should. */
export const COAT_APPROACH_U = 0.11
export const COAT_SETTLE_U = 0.1
/** How long before its space opens a piece sets off, so it is always WAITING
 *  rather than still arriving when its turn comes. */
const COAT_LEAD_U = 0.03

const smooth = (q: number): number => q * q * (3 - 2 * q)

/** When, in the run's own u, this piece's place in the arc comes up. */
export function coatSettleFrom(order: number, from: number, span: number): number {
  return from + order * span * COAT_SPREAD
}

/** How far a piece has flown in: 0 = off-frame, 1 = waiting beside its place. */
export function coatFlyAt(order: number, t: number, from: number, span: number): number {
  const startU = coatSettleFrom(order, from, span) - COAT_APPROACH_U - COAT_LEAD_U
  return smooth(Math.max(0, Math.min(1, (t - startU) / COAT_APPROACH_U)))
}

/** How far a piece has settled into its seat: 0 = still waiting, 1 = stuck. */
export function coatSettleAt(order: number, t: number, from: number, span: number): number {
  const startU = coatSettleFrom(order, from, span)
  return smooth(Math.max(0, Math.min(1, (t - startU) / COAT_SETTLE_U)))
}

/** One triskelion, drawn: heavy chains as bent strokes, the light chain as a
 *  shorter, thinner, lighter stroke lying along each leg's inner half — the
 *  handover's panel A, in this app's two-tone grammar. */
export function drawTriskelion(
  ctx: CanvasRenderingContext2D,
  at: Pt,
  r: number,
  rot = 0,
  alpha = 1,
): void {
  if (alpha <= 0.01) return
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.translate(at.x, at.y)
  ctx.lineCap = 'round'
  const legs = triskelionLegs(r, rot)
  // Heavy chains first…
  ctx.strokeStyle = CLATHRIN_INK
  ctx.lineWidth = Math.max(1.4, r * 0.22)
  for (const [hub, knee, foot] of legs) {
    ctx.beginPath()
    ctx.moveTo(hub.x, hub.y)
    ctx.quadraticCurveTo(knee.x, knee.y, foot.x, foot.y)
    ctx.stroke()
  }
  // …then the light chain along each inner half.
  ctx.strokeStyle = CLATHRIN_LIGHT
  ctx.lineWidth = Math.max(0.8, r * 0.1)
  for (const [hub, knee] of legs) {
    ctx.beginPath()
    ctx.moveTo(hub.x * 0.15 + knee.x * 0.85, hub.y * 0.15 + knee.y * 0.85)
    ctx.lineTo(hub.x + (knee.x - hub.x) * 0.25, hub.y + (knee.y - hub.y) * 0.25)
    ctx.stroke()
  }
  ctx.restore()
}

/** ⚠ DYNAMIN, AS THE HANDOVER DRAWS IT: a coil of turns wrapped round the
 *  NECK — between the bud and the wall — squeezing as it constricts. Each turn
 *  is one shallow ellipse arc; `squeeze` (0→1) narrows the coil, which is the
 *  work it does. */
/** ⚠ HOW WIDE THE COIL IS at this squeeze — the decision, pure, because the
 *  squeeze IS the work dynamin does and a guard has to be able to ask it
 *  without a canvas (the test stand-in records no ellipse vertices). */
export function dynaminRx(halfW: number, squeeze: number): number {
  return Math.max(2, halfW * (1 - 0.55 * squeeze) + 3)
}

export function drawDynamin(
  ctx: CanvasRenderingContext2D,
  neck: Pt,
  /** Half-width of the neck the coil wraps. */
  halfW: number,
  /** How tall the wrapped stretch is. */
  height: number,
  squeeze: number,
  alpha = 1,
): void {
  if (alpha <= 0.01) return
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.strokeStyle = DYNAMIN_INK
  ctx.lineWidth = Math.max(1.4, height * 0.14)
  ctx.lineCap = 'round'
  const rx = dynaminRx(halfW, squeeze)
  const step = height / (DYNAMIN_TURNS + 0.5)
  for (let t = 0; t < DYNAMIN_TURNS; t++) {
    const y = neck.y - height / 2 + step * (t + 0.75)
    ctx.beginPath()
    // A shallow front arc per turn — a spring seen from the side.
    ctx.ellipse(neck.x, y, rx, step * 0.42, 0, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
  }
  ctx.restore()
}
