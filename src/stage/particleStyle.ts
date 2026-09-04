import type { IonKind } from '../core/ions'
import { mix } from './bilayer'

/** A small glossy sphere in an arbitrary base colour — the atoms of the lipid
 *  lab's molecule view and the permeability bench's travellers. One helper,
 *  because a second private copy of a shading formula is how a visual language
 *  quietly stops being one. */
export function glossySphere(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  base: string,
) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r)
  g.addColorStop(0, mix(base, '#ffffff', 0.5))
  g.addColorStop(0.6, base)
  g.addColorStop(1, mix(base, '#0b1016', 0.4))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

// The default look of every ion: a 3D-shaded glossy sphere (highlight → body
// → shadow) with a soft glow halo, as ONE extended radial gradient — no
// canvas shadows (too slow at crowd scale). Ported from the atomic
// playground's particleStyle.ts.
//
// SPECIES palette (proposal — see step-0 notes): red and sky stay RESERVED
// for charge sign (+ / −), inherited from the atomic playground's visual
// language, and amber stays reserved for force & explanation. Ion species
// therefore get gold/violet/green/pink BODIES; charge will be shown by glow
// and ± badges when ions become simulation objects (Milestone 2).

/** The species this palette can paint: the four signalling ions, plus the
 *  proton — not an `IonKind` (it carries no concentration model here), but a
 *  drawable species for D06's pump-and-trade. */
export type GlossyKind = IonKind | 'h'

export const GLOSSY_COLORS: Record<
  GlossyKind,
  { light: string; mid: string; dark: string; glow: string }
> = {
  na: { light: '#fef9c3', mid: '#facc15', dark: '#a16207', glow: '250, 204, 21' },
  k: { light: '#ede9fe', mid: '#a78bfa', dark: '#6d28d9', glow: '167, 139, 250' },
  cl: { light: '#dcfce7', mid: '#4ade80', dark: '#15803d', glow: '74, 222, 128' },
  // ⚠ THE ATOMIC PLAYGROUND'S OWN PROTON INK (its particleStyle.ts `protons`
  // entry), verbatim (user, 2026-09-04: "atomic-playground color-codes
  // protons in a different way — find out how, change"). Red = the + charge
  // colour both apps reserve, and a proton IS a bare + charge.
  h: { light: '#ffd4d0', mid: '#f87171', dark: '#dc2626', glow: '248, 113, 113' },
  ca: { light: '#fce7f3', mid: '#f472b6', dark: '#be185d', glow: '244, 114, 182' },
}

/** react-konva fill props for a glossy ion of body radius `radius`
 *  (the node's radius must be radius * 1.5 to include the halo). */
export function glossyFillProps(kind: IonKind, radius: number) {
  const c = GLOSSY_COLORS[kind]
  return {
    fillRadialGradientStartPoint: { x: -radius * 0.35, y: -radius * 0.35 },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndPoint: { x: 0, y: 0 },
    fillRadialGradientEndRadius: radius * 1.5,
    fillRadialGradientColorStops: [
      0,
      c.light,
      0.3,
      c.mid,
      0.6,
      c.dark,
      0.68,
      `rgba(${c.glow}, 0.45)`,
      1,
      `rgba(${c.glow}, 0)`,
    ],
  }
}

/** Colourless version, for a species the kid has toggled out of focus. It is
 *  still drawn — hiding ions outright would misrepresent what the cell holds —
 *  it just stops competing for attention. */
export const MUTED_ION = {
  light: '#7b8797',
  mid: '#5c6675',
  dark: '#3f4753',
  glow: '100, 116, 139',
}

// ⚠ A `TRANSMITTER` COLOUR USED TO LIVE HERE, and it is gone (2026-08-30).
//
// It was a spare orange for the gating bench's messenger, on the reasoning
// that a colour belonging to no species says "not one of the four". Too subtle
// to survive contact: a single glossy ball IS what this app means by "ion",
// whatever colour it is painted, so a spare colour just made a fifth ion — and
// it was read as the chloride the channel passes. The messenger is drawn from
// bonded ATOMS now, in the element colours the water molecules use, which is a
// difference of KIND rather than of shade.
/** A glossy fill centred on the ORIGIN, so one gradient serves a whole crowd:
 *  move the context per particle instead of rebuilding the gradient. Hundreds
 *  of ions per frame otherwise means hundreds of gradient objects. */
export function ionGradient(
  native: CanvasRenderingContext2D,
  kind: GlossyKind,
  radius: number,
  muted = false,
): CanvasGradient {
  const c = muted ? MUTED_ION : GLOSSY_COLORS[kind]
  const grad = native.createRadialGradient(-radius * 0.35, -radius * 0.35, 0, 0, 0, radius * 1.5)
  grad.addColorStop(0, c.light)
  grad.addColorStop(0.3, c.mid)
  grad.addColorStop(0.6, c.dark)
  grad.addColorStop(0.68, `rgba(${c.glow}, 0.45)`)
  grad.addColorStop(1, `rgba(${c.glow}, 0)`)
  return grad
}

/** Same look for raw-canvas scene functions (waves, crowds, release). */
export function drawGlossyIon(
  native: CanvasRenderingContext2D,
  kind: GlossyKind,
  x: number,
  y: number,
  radius: number,
  alpha = 1,
) {
  native.save()
  native.globalAlpha *= Math.max(0, alpha)
  native.translate(x, y)
  native.fillStyle = ionGradient(native, kind, radius)
  native.beginPath()
  native.arc(0, 0, radius * 1.5, 0, Math.PI * 2)
  native.fill()
  native.restore()
}

// ------------------------------------------------------- the charge colour ramp
//
// Cold sky for a negative interior, the membrane's own slate for neutral, warm
// red for a positive one — the same two ends as the ± marks on a membrane face,
// with a neutral middle so the crossing is a change of colour rather than a
// switch between two.
//
// Shared, because it is used by two exhibits that mean subtly different things by
// it and must at least LOOK like the same language. Over the neuron it shows how
// far the membrane is from resting, since a resting cell is already polarized and
// an absolute aura there would be permanently blue. On the bench there is no
// resting voltage to be relative to — a battery is imposing one — so it shows the
// polarity itself. The dial that sets that voltage is deliberately NOT tinted to
// match: a colour on the control reads as a promise about which way ions will
// move, and no single number can make that promise (see `flowOf`).

const CHARGE_COLD = [56, 189, 248]
const CHARGE_NEUTRAL = [100, 116, 139]
const CHARGE_HOT = [248, 113, 113]

/** The colour at a signed charge −1 → +1, as an `r, g, b` string. */
export function chargeRamp(t: number): string {
  const to = t >= 0 ? CHARGE_HOT : CHARGE_COLD
  const k = Math.min(1, Math.abs(t))
  const c = CHARGE_NEUTRAL.map((v, i) => Math.round(v + (to[i] - v) * k))
  return `${c[0]}, ${c[1]}, ${c[2]}`
}

/** As a hex-ish CSS colour, for chrome that cannot take an alpha separately. */
export function chargeColour(t: number): string {
  return `rgb(${chargeRamp(t)})`
}

/** How strongly a voltage reads on that ramp, −1 → +1.
 *
 *  Shaped rather than linear, and the shaping matters: a square root is steepest
 *  exactly at zero, which makes the field lurch out of neutral the instant the
 *  voltage moves. Nearer to linear keeps the crossing calm. */
export function polarityT(mv: number, full = 95): number {
  const t = Math.max(-1, Math.min(1, mv / full))
  return Math.sign(t) * Math.abs(t) ** 0.85
}

// ── How big a charge badge is ──────────────────────────────────────────────
//
// THE RULE (2026-08-28): a badge is a fixed FRACTION of the ball it belongs
// to, so the pair reads the same at every size and in every view. A view may
// nudge that fraction — a crowded crowd wants a smaller one, a lone ion in a
// drawer can carry a bigger one — but only between MIN and MAX, which are
// themselves fractions of the ball.
//
// The bounds are proportional rather than in pixels ON PURPOSE. These are
// drawn inside contexts magnified by thousands, where "never smaller than
// 3 px" means a badge wider than the screen (see the solid-red afternoon of
// 2026-08-28). Below MIN the glyph inside stops being legible; above MAX the
// badge starts competing with the ion for the eye.
export const BADGE_FRACTION = 0.46
export const BADGE_MIN = 0.34
export const BADGE_MAX = 0.6
/** How far out along the diagonal the badge's centre sits, in ball radii. */
const BADGE_OFFSET = 0.85

/** …and a badge may never LOOK smaller than this many screen pixels
 *  (2026-08-28, set by the user from the charge bench's own badge, which is
 *  the reference size everything else is held to).
 *
 *  This is a screen-space number, so the HELPER never applies it: a caller
 *  that knows its context's scale converts it with `badgeMinR` and passes the
 *  result in its own units. That is exactly the shape the scaled-context rule
 *  demands — no absolute pixel constant may be applied inside a transform the
 *  helper cannot see. */
export const BADGE_MIN_SCREEN_PX = 3.13

/** The floor in a caller's own units, given how many screen pixels one of its
 *  units is worth. */
export function badgeMinR(scale: number): number {
  return BADGE_MIN_SCREEN_PX / Math.max(1e-6, scale)
}

/** Below this on-screen body radius, an ion is too small to carry its own
 *  badge or name legibly (2026-08-28). A view drawing ions smaller than this
 *  must show a KEY instead — see `needsIonKey`. The number is the charge
 *  bench's own ion, which is the smallest anyone has judged readable. */
export const ION_LABEL_MIN_PX = 5

/** Does a crowd drawn at this on-screen body radius need a key? */
export function needsIonKey(bodyRadiusPx: number): boolean {
  return bodyRadiusPx < ION_LABEL_MIN_PX
}

/** Where an ion's charge badge sits: the top-right corner, at the atomic
 *  playground's own proportions (`ChargePlayground.drawIon`). Exported so
 *  hit-tests and tests use the same point the drawing does. */
export function chargeBadgeAt(
  x: number,
  y: number,
  bodyRadius: number,
  frac = BADGE_FRACTION,
  minR = 0,
) {
  // The floor wins over the fraction — that is what a floor is for — but a
  // badge may never grow past the ball itself, or it stops being a badge.
  const r = Math.min(
    bodyRadius,
    Math.max(bodyRadius * Math.min(BADGE_MAX, Math.max(BADGE_MIN, frac)), minR),
  )
  return {
    x: x + bodyRadius * BADGE_OFFSET,
    y: y - bodyRadius * BADGE_OFFSET,
    r,
    // The glyph fills the disc rather than floating inside it.
    arm: r * 0.55,
  }
}

/** THE way this app shows what charge an ion carries — the sibling app's
 *  charge-playground badge, ported: a small FILLED disc in the corner, red
 *  for + and sky for −, with a white glyph inside it.
 *
 *  One departure from the original, and it is not cosmetic: the glyph is drawn
 *  as vector strokes rather than `fillText`. This app draws ions inside
 *  contexts magnified by thousands, where a font size is either unreadably
 *  small or refused outright by the canvas (the same bug that once made every
 *  label vanish at ×2400). Everything here is proportional to the ion for the
 *  same reason — no pixel floors, ever.
 *
 *  It replaced three conventions that had grown up separately: a dark mark
 *  stamped inside the ion, a large plus floating well above it, and a hollow
 *  ring. One property, one drawing. */
export function drawIonCharge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bodyRadius: number,
  charge: number,
  frac = BADGE_FRACTION,
  minR = 0,
): void {
  if (charge === 0) return
  const at = chargeBadgeAt(x, y, bodyRadius, frac, minR)
  drawChargeDot(ctx, at.x, at.y, at.r, charge)
}

/** The badge on its own, centred where you put it and at the radius you ask
 *  for — the same disc and the same white glyph an ion wears.
 *
 *  Exported because charge turns up on things that are not ions: the positive
 *  marks on a channel's voltage sensor, the little negative the pore's oxygens
 *  turn inward. Those were drawn as bare strokes and were invisible at small
 *  sizes; a child should meet ONE picture of "this is a plus" (2026-08-28). */
export function drawChargeDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  charge: number,
): void {
  if (charge === 0 || r <= 0) return
  const arm = r * 0.55
  ctx.save()
  ctx.fillStyle = charge > 0 ? '#ef4444' : '#0ea5e9'
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = r * 0.32
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - arm, y)
  ctx.lineTo(x + arm, y)
  if (charge > 0) {
    ctx.moveTo(x, y - arm)
    ctx.lineTo(x, y + arm)
  }
  ctx.stroke()
  ctx.restore()
}

/** The cytoplasm's charge wash — the "charge aura", as one shared shape.
 *
 *  It ramps UP from nothing over the first sliver, peaks just inside the
 *  water, and fades away with depth. The ramp exists because a wash that
 *  starts at full strength exactly at the membrane cuts a hard line along the
 *  wall, and the eye reads that line as belonging to the wall rather than to
 *  the water beside it (reported 2026-08-28, across every view that has one).
 *  The peak stays near the membrane, which is where the charge really is; only
 *  the last few pixels against the wall are softened.
 *
 *  `fromY` must already be clear of the membrane's own thickness. */
export function chargeWash(
  ctx: CanvasRenderingContext2D,
  fromY: number,
  toY: number,
  t: number,
  peak = 0.5,
): CanvasGradient {
  const rgb = chargeRamp(t)
  const strength = Math.abs(t)
  const g = ctx.createLinearGradient(0, fromY, 0, toY)
  g.addColorStop(0, `rgba(${rgb}, 0)`)
  g.addColorStop(0.06, `rgba(${rgb}, ${peak * strength})`)
  g.addColorStop(0.45, `rgba(${rgb}, ${peak * 0.42 * strength})`)
  g.addColorStop(1, `rgba(${rgb}, 0)`)
  return g
}
