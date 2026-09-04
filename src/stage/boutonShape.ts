import { boundsOf, flattenPath, parsePath, tracePath, type Seg } from './svgPath'

// THE SYNAPSE'S ANATOMY — traced from the user's drawing (2026-08-31), and one
// deliberate alteration.
//
// See docs/05-visual-language.md → *Spec: S12* for the reconciliation. In
// short: the bouton is the reference's own outline, kept whole — stalk, bulb,
// both sides and its bottom — which the user ruled in preference to this
// document's earlier "fades out at the frame" composition. The terminal is a
// real object with a real boundary, so drawing all of it invents nothing.
//
// ⚠ THE LOWER SHAPE IS ALTERED, on science. The reference's second path dips
// AWAY beneath the terminal and rises on either side of it. Glutamate — leg 1's
// transmitter — synapses onto dendritic SPINES (Gray's type I; it is the
// inhibitory GABAergic contacts that land on shafts and somata), and the app's
// own plan already depends on that: S13 has "Ca²⁺ enters the spine" and P04 has
// the spine enlarging with LTP. So the reference's wavy surface becomes the
// dendritic SHAFT, and a spine rises out of it to meet the bouton. Nothing of
// the reference is thrown away: its wander is the shaft's own uneven profile.

/** The bouton, exactly as drawn: a stalk from the top and a bulb below it. */
const BOUTON_PATH =
  'm53.62 0.29l-0.12 22.84c0 0-0.14 3.37-5.02 8.04-4.89 4.67-7.04 7.81-4.74 11.26 2.31 3.45 8.03 7.89 19.67 7.24 11.64-0.65 16.44-6.28 16.92-10.71 0.48-4.43-1.94-8.29-5.44-9.7-3.5-1.4-7.2-2.82-7.56-5.99-0.36-3.16-0.82-23.27-0.82-23.27z'

/** The lower surface, as drawn — kept for its wander, used as the shaft. */
const SHAFT_PATH =
  'm23 61.04c0 0 4.13-20.3 12.3-16.66 8.18 3.64 8.37 9.52 27.66 9.67 19.29 0.14 15.59-9.72 23.56-11.57 7.96-1.86 15.42 19.52 15.42 19.52z'

export const BOUTON_SEGS: Seg[] = parsePath(BOUTON_PATH)
export const SHAFT_SEGS: Seg[] = parsePath(SHAFT_PATH)

/** The reference's own coordinate box, measured rather than typed. */
export const BOUTON_BOX = boundsOf(BOUTON_SEGS)
export const SHAFT_BOX = boundsOf(SHAFT_SEGS)

/** ⚠ WHERE THE STALK STOPS AND THE BULB BEGINS, in the reference's own units.
 *  Measured off the traced path — the outline turns outward at y = 23.13 on the
 *  left and 23.27 on the right — never typed from the eye, so a re-trace carries
 *  this with it. */
export const NECK_END = 23.2

/** The bulb's own box: the active end, which is what the exhibit is about. */
export const BULB_BOX = {
  y: NECK_END,
  h: BOUTON_BOX.y + BOUTON_BOX.h - NECK_END,
}

/** Where the bouton's membrane is lowest — the point the cleft is measured
 *  from, and where the spine must come up to meet it. Read off the traced
 *  path, so it cannot drift from the outline. */
export const BOUTON_FOOT = (() => {
  let best = { x: 0, y: -Infinity }
  for (const s of BOUTON_SEGS) {
    if (s.kind === 'close') continue
    if (s.y > best.y) best = { x: s.x, y: s.y }
  }
  return best
})()

/** How the reference's coordinates land on a canvas. One transform for both
 *  paths — they are one drawing, and scaling them apart would pull the cleft
 *  open or shut. */
export interface BoutonFit {
  /** Reference units → pixels. */
  k: number
  /** Where reference (0, 0) lands. */
  ox: number
  oy: number
}

/** ⚠ HOW MUCH NECK IS LEFT ON SCREEN (user, 2026-08-31: "shorten the 'neck',
 *  make the active area larger").
 *
 *  The reference gives the stalk 46% of the bouton's own height, and at the
 *  first fitting that was 182 px of empty tube above a 214 px bulb — nearly as
 *  much frame spent on the wire as on the thing the exhibit is about. It is
 *  CROPPED rather than squashed: the axon genuinely continues up out of the
 *  frame, so cutting it there is honest, where compressing the traced outline
 *  would be redrawing the user's own shape. */
export const NECK_PX = 44

/** What the layout below the bouton needs, so the fit can be SOLVED rather than
 *  guessed at. `fixed` is pixels that do not scale (the exaggerated cleft, the
 *  shaft's share of the frame); `perUnit` is pixels that scale with the drawing,
 *  per unit of `k`. The scene owns those numbers and hands them over. */
export interface BelowBudget {
  fixed: number
  perUnit: number
}

/** Fit the bouton so that the ACTIVE END is as large as the frame allows.
 *
 *  ⚠ SOLVED, NOT CHOSEN (2026-08-31). The first version took a share of the
 *  height for the WHOLE shape, so the neck's 46% came straight off the bulb —
 *  and "make the active area twice as large" then had no answer, because
 *  whatever the bulb gained the spine head lost. Now the caller declares what it
 *  needs below the foot and the scale is whatever makes the rest fit, so
 *  shortening the neck really does buy the active area, which is what was asked
 *  for.
 *
 *  ⚠ And it is a budget rather than a wish: at the reference's proportions a
 *  literal 2× on BOTH structures cannot fit 660 px of frame, so what the scale
 *  reaches is measured and declared rather than asserted. */
export function fitBouton(width: number, height: number, below?: BelowBudget): BoutonFit {
  const need = below ?? { fixed: 0, perUnit: 0 }
  // height = NECK_PX + BULB_BOX.h·k + fixed + perUnit·k
  const byHeight = (height - NECK_PX - need.fixed) / (BULB_BOX.h + need.perUnit)
  const byWidth = (width * 0.86) / BOUTON_BOX.w
  const k = Math.max(1, Math.min(byHeight, byWidth))
  return {
    k,
    ox: width / 2 - (BOUTON_BOX.x + BOUTON_BOX.w / 2) * k,
    // The neck is cut off at the top edge with `NECK_PX` of it showing.
    oy: NECK_PX - NECK_END * k,
  }
}

export const place = (f: BoutonFit, x: number, y: number) => ({
  x: f.ox + x * f.k,
  y: f.oy + y * f.k,
})

/** Trace the bouton's outline onto a context, in canvas pixels. */
export function boutonPath(ctx: CanvasRenderingContext2D, f: BoutonFit): void {
  ctx.beginPath()
  tracePath(ctx, BOUTON_SEGS, (x, y) => place(f, x, y))
  ctx.closePath()
}

// The dendritic shaft's own drawing is GONE (2026-09-01): the wide view shows
// our bouton on the TIP of the target's dendrite branch, so the close-up draws
// that same object — spine head, neck, and a trunk leaving through the bottom
// of the frame toward the soma. `SHAFT_SEGS`/`SHAFT_BOX` stay: the reference
// trace is part of the record, and the reconciliation that retired it is in
// docs/04-roadmap.md (steps 20l–20r).

// ───────────────────────────────────────────────── ASKING THE OUTLINE THINGS

/** The bouton's silhouette as a polyline, in the reference's own units. */
const BOUTON_POLY = flattenPath(BOUTON_SEGS, 40)

/** ⚠ WHERE THE BOUTON'S FLOOR IS AT THIS x, in canvas pixels.
 *
 *  The bug this exists for (user, 2026-09-01: "the opening vesicles are
 *  currently placed outside of the presynaptic bouton"): the active zone was
 *  laid along a straight line at the outline's LOWEST point, while the foot of
 *  a bouton is a curve. Measured, the outer vesicles of the row were 47 and 88
 *  px below the wall — outside the cell, floating in the cleft.
 *
 *  So the row is placed ON the outline instead. Returns null where the shape has
 *  no floor at that x, so a caller cannot silently put something in mid-air. */
export function boutonFloorAt(f: BoutonFit, x: number): number | null {
  const rx = (x - f.ox) / f.k
  let best: number | null = null
  for (let i = 1; i < BOUTON_POLY.length; i++) {
    const a = BOUTON_POLY[i - 1]
    const b = BOUTON_POLY[i]
    if (a.x === b.x) continue
    const lo = Math.min(a.x, b.x)
    const hi = Math.max(a.x, b.x)
    if (rx < lo || rx > hi) continue
    const t = (rx - a.x) / (b.x - a.x)
    const y = a.y + (b.y - a.y) * t
    if (best === null || y > best) best = y
  }
  return best === null ? null : f.oy + best * f.k
}

/** The widest run of x either side of the foot over which the floor really
 *  exists — so an active zone can never be asked to sit off the end of the
 *  bouton. */
export function floorSpan(f: BoutonFit): { from: number; to: number } {
  return {
    from: f.ox + BOUTON_BOX.x * f.k,
    to: f.ox + (BOUTON_BOX.x + BOUTON_BOX.w) * f.k,
  }
}

