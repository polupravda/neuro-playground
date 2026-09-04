import { drawLeakChannel, leakHalfWidth } from './leakChannel'

/** How wide the gap in this bench's wall is — ASKED OF THE DRAWING that stands
 *  in it (2026-08-30). A shared constant cut it eight pixels too wide either
 *  side and left bare lipid-free stripes beside the protein. */
export const CHANNEL_HALF = leakHalfWidth(HALF_MEM) * 1.06
import { IONS, ION_KINDS, type IonKind } from '../core/ions'
import { GLOSSY_COLORS, chargeWash, ionGradient, polarityT } from './particleStyle'
import type { Flow } from '../core/driving'
import {
  CHANNEL_DARK,
  CHANNEL_MID,
  HALF_MEM,
  drawLipids,
  mix,
} from './bilayer'

// One chamber of the balance bench, drawn properly.
//
// The first version was coloured dots and grey bars, and it looked like a slide
// rather than a membrane. This draws the same thing the neuron view draws — a
// phospholipid bilayer with heads and tails, a channel tinted with the species it
// passes and a selectivity filter at full strength, glossy ions — so a child who
// has been inside the axon recognises where they are.
//
// Balls are CONSERVED. There is a fixed set of them in each chamber; opening a
// door lets some cross, and the two piles change because ions moved from one to
// the other. Nothing is created, nothing is destroyed, and nothing fades in
// anywhere — which is the third attempt at this and the only one that actually
// keeps the promise. The earlier versions animated extra ions in from off-frame,
// and then animated crowd members that faded at the reset; both read as ions from
// thin air, because they were.
//
// A crossing is therefore not decoration. When the count of balls on a side drops
// by one, THAT ball is the one making the journey, and the picture and the numbers
// are the same fact.


/** The charge ramp's neutral, as an `r, g, b` string — the colour that means no
 *  charge at all. The compartment tints are built from it so that "no colour" and
 *  "no voltage" are the same thing on screen. */
const CHARGE_NEUTRAL_RGB = '100, 116, 139'

/** Most marks on one face, on one side of the channel, at the ends of the
 *  battery's range. */
const MAX_MARKS_PER_SIDE = 6

/** Full deflection of the dial, mV — what a full row of marks means. */
const MARKS_FULL_MV = 95

const NEGATIVE_MARK = 'rgba(125, 211, 252, 0.92)'
const POSITIVE_MARK = 'rgba(248, 113, 113, 0.92)'

/** The field's own colour — deliberately NOT one of the charge colours. Red and
 *  sky mean "this much charge, of this sign"; a field is neither, it is what the
 *  separated charge DOES, so it gets a neutral of its own and cannot be misread
 *  as a third pile of ions. */

/** How many marks fit, given the voltage: shared so a row of charge and the
 *  arrows it makes are always built from the same number. */
export function marksPerSide(vm: number): number {
  const reach = Math.min(MARKS_FULL_MV, Math.abs(vm)) / MARKS_FULL_MV
  return Math.round(MAX_MARKS_PER_SIDE * reach)
}

/** The two stretches of membrane either side of the channel. The pore is a hole
 *  in the wall: no charge sits over it and no field crosses it, so nothing is
 *  drawn there. Laying each half out on its own also keeps a row symmetrical down
 *  to a single mark, which is what the first millivolts off zero look like. */
function faceSpans(w: number, pad: number): readonly (readonly [number, number])[] {
  return [
    [5, w / 2 - CHANNEL_HALF - pad],
    [w / 2 + CHANNEL_HALF + pad, w - 5],
  ] as const
}

/** Evenly spread across a stretch, so a growing row grows DENSER rather than
 *  longer — a row that crept along the membrane would read as a bar chart and say
 *  nothing true about where charge sits. */
function spread(from: number, to: number, i: number, n: number): number {
  return from + ((i + 0.5) / n) * (to - from)
}

/** The charge the voltage IS: ± marks hugging the two faces of the membrane.
 *
 *  This is the answer to "what does the dial actually DO", for someone who cannot
 *  yet read −70. Three things are readable without a single number:
 *
 *    • HOW MUCH — the count. Not the opacity: a count is something you watch
 *      change one mark at a time while you drag, where a fade is something you
 *      only notice by comparing against a memory of a moment ago. It is also the
 *      honest encoding rather than a convenient one — a membrane is a capacitor,
 *      Q = C·V, so twice the voltage really is twice the charge held apart. The
 *      row is proportional, and that proportionality is the physics.
 *    • WHICH WAY — the side the minuses are on. Inside for a negative interior,
 *      outside for a reversed one.
 *    • THE CROSSING — at zero the rows are empty, and past it they come back
 *      SWAPPED. The one event in the whole sweep of the dial that cannot be
 *      missed, and it is exactly the event that matters.
 *
 *  Note what this does NOT touch: the balls. The charge is a vanishing skin of
 *  ions against the faces, and the crowds are the concentrations, which stay put.
 *  A dial that visibly moved the piles would teach that voltage and concentration
 *  are the same quantity, which is the misunderstanding this whole bench exists to
 *  take apart. So the marks live ON the faces and nowhere else. */
function drawFaceCharge(
  ctx: CanvasRenderingContext2D,
  w: number,
  midY: number,
  vm: number,
): void {
  const perSide = marksPerSide(vm)
  if (perSide === 0) return
  const insideNegative = vm < 0
  const offset = HALF_MEM + 5.5
  const arm = 2.9

  const spans = faceSpans(w, arm + 2)

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = 1.9
  for (const [from, to] of spans) {
    if (to - from < arm * 2) continue
    for (let i = 0; i < perSide; i++) {
      const x = spread(from, to, i, perSide)
      for (const side of [-1, 1] as const) {
        // side −1 is the outside face, +1 the cytoplasm.
        const negative = side === 1 ? insideNegative : !insideNegative
        ctx.strokeStyle = negative ? NEGATIVE_MARK : POSITIVE_MARK
        const y = midY + side * offset
        ctx.beginPath()
        ctx.moveTo(x - arm, y)
        ctx.lineTo(x + arm, y)
        // A minus is one stroke, a plus is two. Never a coloured dot: the colour
        // is a reminder, the glyph is the fact, and one of them survives being
        // colour-blind.
        if (!negative) {
          ctx.moveTo(x, y - arm)
          ctx.lineTo(x, y + arm)
        }
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

/** Which way the field pushes a POSITIVE ion: +1 toward the cytoplasm, which is
 *  the side drawn below, and −1 out toward the bath.
 *
 *  A negative interior pulls a cation IN. Exported so this is checked against
 *  `flowOf` rather than eyeballed — the same inversion has been made twice in this
 *  codebase already (see `pushesOn`), and both times the arithmetic still added up
 *  while the picture showed a negative interior repelling sodium. */
export function fieldDirection(vm: number): 1 | -1 {
  return vm < 0 ? 1 : -1
}

// The field used to be drawn too — grey arrows inside the wall, one per pair of
// marks. Removed 2026-08-27, on the user's read of the picture: the arrows were
// the same grey, the same vertical direction and the same length as the lipid
// tails around them, so they read as unexplained dashes rather than as force —
// and the charge already speaks twice here, through the ± marks on the faces and
// the polarity tint over the cytoplasm. The direction the field pushes a positive
// ion is still stated by `fieldDirection` in the describer, and shown for real by
// every crossing.

/** Deterministic scatter: a crowd position is a pure function of its own index,
 *  so nothing reshuffles when a count changes. */
function slot(seed: number, w: number, h: number, top: number): { x: number; y: number } {
  const a = Math.sin(seed * 12.9898) * 43758.5453
  const b = Math.sin(seed * 78.233) * 12345.6789
  return {
    x: 8 + (a - Math.floor(a)) * (w - 16),
    y: top + 6 + (b - Math.floor(b)) * (h - 12),
  }
}

/** Ion radius in bench pixels. The RATIOS between species are the real hydrated
 *  ones; the absolute size is the bench's own, since a chamber is a diagram at
 *  its own magnification rather than a window on the scene. */
export function radiusOf(kind: IonKind, w: number): number {
  const largest = Math.max(...ION_KINDS.map((k) => IONS[k].hydratedNm))
  return Math.max(2.6, w / 82) * (IONS[kind].hydratedNm / largest)
}

/** EACH SIDE HAS ITS OWN INDEX SPACE (2026-08-28).
 *
 *  Balls used to share one: index i was outside if `i < outsideBalls` and
 *  inside otherwise. That was coherent while the set was a fixed sixty split
 *  by ratio — but once one ball became a fixed amount, adding ions to the
 *  OUTSIDE raised `outsideBalls` and re-labelled which balls were inside. Two
 *  balls that had been sitting in the cytoplasm jumped out through the wall,
 *  and two more appeared inside from nowhere, for a change the child had made
 *  to the outside only. Conservation, broken on screen, by a numbering
 *  scheme.
 *
 *  Now a side's rank is all a ball needs: outside rank k always sits in the
 *  same place whatever the inside is doing, and vice versa. */
export function ballSlot(
  rank: number,
  outsideNow: boolean,
  w: number,
  outH: number,
  outTop: number,
  inH: number,
  inTop: number,
): { x: number; y: number } {
  return outsideNow
    ? slot(rank * 13 + 3, w, outH, outTop)
    : slot(rank * 13 + 3 + 500, w, inH, inTop)
}

/** A ball caught mid-journey — one that really did change sides. Where it
 *  left from and where it is going, in the two sides' own ranks. */
export interface Crossing {
  /** Its rank on the side it LEFT. */
  fromRank: number
  /** Its rank on the side it is ARRIVING at. */
  toRank: number
  inward: boolean
  startedMs: number
}

/** How long one crossing takes, in ms: a stronger push makes a quicker trip.
 *  `strength` runs 0→1. */
export function crossingMs(strength: number): number {
  return 1600 - 1050 * Math.min(1, Math.max(0, strength))
}

/** The longest any crossing can last, so finished ones can be swept up. */
export const CROSSING_MAX_MS = 1600

export interface ChamberView {
  kind: IonKind
  outside: number
  inside: number
  open: boolean
  flow: Flow
  twoWay: boolean
  strength: number
  vm: number
  crossings: Crossing[]
  timeMs: number
  width: number
  height: number
}

/** HOW MUCH ONE BALL IS WORTH, in millimolar. Fixed.
 *
 *  This used to be a share of whatever happened to be in the chamber — sixty
 *  balls always, split by ratio — and that is a scale that silently rescales
 *  itself. Empty the inside and drop the outside to a trace and the trace was
 *  still drawn as sixty balls, a chamber apparently full of the stuff, because
 *  a ratio of "all of it outside" is the same ratio whether there is a lot or
 *  almost none (user, 2026-08-28).
 *
 *  It also broke the exhibit's own promise. The comment above `ballsOf` said
 *  "one ball is a share of the total, so moving a ball moves a real amount of
 *  the stuff" — but the share changed with the total, so a ball meant one
 *  thing at one setting of the sliders and another at the next, and two
 *  chambers side by side could not be compared at all. A quantity drawn as a
 *  count must have a FIXED value per item, or it is not a count.
 *
 *  Five millimolar a ball: a full chamber (150 mM, the ceiling) is thirty
 *  balls, both sides full is sixty — the density the view was tuned at — and
 *  one press of the stepper (10 mM) moves two balls, which is a visible
 *  change without being a lurch. */
export const PER_BALL_MM = 5

/** The most balls one side will draw, so a chamber cannot be packed solid. */
const MAX_SIDE_BALLS = 40

/** Anything that is THERE gets at least one ball, even a trace worth less
 *  than a ball. Rounding a trace to nothing would say the chamber is empty
 *  when it is not, and this app does not make things vanish. Nothing is the
 *  only thing worth no balls. */
const ballsFor = (mm: number): number => {
  if (mm <= 0) return 0
  return Math.min(MAX_SIDE_BALLS, Math.max(1, Math.round(mm / PER_BALL_MM)))
}

/** How many balls a chamber draws, and which side each is on.
 *
 *  The piles ARE the balls: one ball is a fixed amount of the stuff, so moving
 *  a ball moves a real amount and the height of a pile means the same thing in
 *  every chamber and at every setting. */
export function ballsOf(outside: number, inside: number): {
  total: number
  outsideBalls: number
  insideBalls: number
  perBall: number
} {
  const outsideBalls = ballsFor(outside)
  const insideBalls = ballsFor(inside)
  return {
    // No ions, no balls — and now that follows from the arithmetic rather
    // than needing a special case, because nothing is worth zero balls except
    // nothing.
    total: outsideBalls + insideBalls,
    outsideBalls,
    insideBalls,
    perBall: PER_BALL_MM,
  }
}

/** One traveller's whole journey, in five plain stages.
 *
 *  Not the scene's `transit`, deliberately: that one has an ion EMERGE from deep
 *  in an anonymous crowd, which is the right answer when the crowd is hundreds
 *  deep. Here you can count the balls, so the ion has to leave a real place and
 *  arrive at a real place — its slot on one side, its slot on the other — and
 *  funnel through the pore in between. Nothing fades. */
/** Slow at the ends, quicker in the middle: an ion drifting out of a crowd picks
 *  up speed as the opening pulls it in. */
function ease(t: number): number {
  return t * t * (3 - 2 * t)
}

function journey(
  p: number,
  src: { x: number; y: number },
  dst: { x: number; y: number },
  firstMouth: { x: number; y: number },
  secondMouth: { x: number; y: number },
): { x: number; y: number } {
  const lerp = (u: { x: number; y: number }, v: { x: number; y: number }, t: number) => ({
    x: u.x + (v.x - u.x) * t,
    y: u.y + (v.y - u.y) * t,
  })
  // The mouths are given IN THE ORDER THEY ARE PASSED THROUGH. They used to be
  // named outer and inner with a direction flag choosing which came first, and
  // that flag ALSO swapped source for destination — so an outward crossing set
  // off from the far side, dived to the inner mouth, came back out, and finished
  // where it should have started.
  //
  // No fading anywhere: a ball leaves a real place and arrives at a real place,
  // so there is nothing to hide.
  // Most of the trip is the APPROACH. Every path ends at the same mouth, so a
  // handful of balls converging is what reads as a crowd pouring through an
  // opening; if the crossing itself took most of the time, they would look like
  // separate events queueing politely instead.
  if (p < 0.5) return lerp(src, firstMouth, ease(p / 0.5))
  if (p < 0.68) return lerp(firstMouth, secondMouth, (p - 0.5) / 0.18)
  return lerp(secondMouth, dst, ease((p - 0.68) / 0.32))
}

export function drawChamber(ctx: CanvasRenderingContext2D, view: ChamberView): void {
  const { kind, width: w, height: h, open, timeMs } = view
  const midY = h / 2
  const outTop = 0
  const outH = midY - HALF_MEM
  const inTop = midY + HALF_MEM
  const inH = h - inTop
  const species = GLOSSY_COLORS[kind]
  const ghosts = ION_KINDS.filter((other) => other !== kind)
  const r = radiusOf(kind, w)

  ctx.clearRect(0, 0, w, h)

  // Water. The two sides are told apart by LIGHTNESS of a single neutral grey,
  // never by hue — and the grey is the charge ramp's own neutral, so an uncharged
  // membrane genuinely looks uncharged.
  //
  // It used to be slate-900 inside against near-black outside, which is a navy:
  // the inside read as permanently blue, blue is this app's colour for a negative
  // interior, and so the cytoplasm claimed a negative charge at every setting of
  // the dial — including +75 mV, where it is the opposite. Hue is spoken for
  // here; only lightness is free.
  ctx.fillStyle = 'rgba(9, 11, 16, 0.92)'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = `rgba(${CHARGE_NEUTRAL_RGB}, 0.05)`
  ctx.fillRect(0, 0, w, outH)
  ctx.fillStyle = `rgba(${CHARGE_NEUTRAL_RGB}, 0.13)`
  ctx.fillRect(0, inTop, w, inH)

  // The charge the battery is imposing, as a colour over the cytoplasm — the same
  // language the neuron view uses. It reads far stronger than it used to, because
  // it is no longer arguing with a navy base; the ± marks on the faces carry the
  // amount, and this carries the direction over the whole compartment.
  //
  // The inside, and only the inside: a voltage across a membrane is the inside
  // measured against the outside, so the inside is what the number is about.
  // Strongest against the membrane and fading away from it, because the charge
  // that a voltage IS sits in a thin skin there rather than filling the cell.
  const t = polarityT(view.vm)
  if (Math.abs(t) > 0.01) {
    // Fades in from nothing at the membrane edge — see `chargeWash`.
    ctx.fillStyle = chargeWash(ctx, inTop, h, t)
    ctx.fillRect(0, inTop, w, inH)
  }

  // The other three species: present, blurred, not the story. Without them a
  // chamber would suggest a compartment of one pure ion.
  // Soft-edged with a gradient rather than a canvas blur filter: `ctx.filter` is
  // extremely expensive, and thirty filtered arcs per chamber per frame pegged the
  // CPU hard enough to stall the page entirely.
  ctx.save()
  ghosts.forEach((ghost, g) => {
    for (let i = 0; i < 5; i++) {
      for (const [top, height] of [
        [outTop, outH],
        [inTop, inH],
      ] as const) {
        const at = slot(g * 37 + i * 11 + 211, w, height, top)
        const rg = radiusOf(ghost, w) * 1.6
        const grad = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, rg)
        grad.addColorStop(0, 'rgba(100, 116, 139, 0.42)')
        grad.addColorStop(0.55, 'rgba(100, 116, 139, 0.22)')
        grad.addColorStop(1, 'rgba(100, 116, 139, 0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(at.x, at.y, rg, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  })
  ctx.restore()

  // The balls. A fixed set, split between the two sides by how much of the stuff
  // is on each — so when a ball crosses, the piles change because it moved.
  const { outsideBalls, insideBalls } = ballsOf(view.outside, view.inside)
  // A ball on its way over is drawn by the crossing loop, not here, or it
  // would be in two places at once.
  const arriving = {
    out: new Set(view.crossings.filter((c) => !c.inward).map((c) => c.toRank)),
    in: new Set(view.crossings.filter((c) => c.inward).map((c) => c.toRank)),
  }
  // A gradient is defined about the origin and painted through whatever transform
  // is in force, so one of them serves every ball.
  const paint = ionGradient(ctx, kind, r)
  const ball = (i: number, outsideNow: boolean) => {
    if ((outsideNow ? arriving.out : arriving.in).has(i)) return
    const at = ballSlot(i, outsideNow, w, outH, outTop, inH, inTop)
    // Jostling, never still — but never far, either. The wiggle stays well inside
    // the margin its side is laid out with, so no amount of it can carry a ball
    // through the membrane. Motion without transport is exactly the point.
    const t = timeMs / 1000
    const swing = r * 0.7
    const x =
      at.x +
      Math.sin(t * (1.4 + (i % 5) * 0.19) + i) * swing +
      Math.sin(t * (3.1 + (i % 3) * 0.4) + i * 2.2) * swing * 0.5
    const y =
      at.y +
      Math.sin(t * (1.7 + (i % 7) * 0.16) + i * 1.7) * swing +
      Math.sin(t * (3.7 - (i % 4) * 0.3) + i) * swing * 0.5
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = paint
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  for (let i = 0; i < outsideBalls; i++) ball(i, true)
  for (let i = 0; i < insideBalls; i++) ball(i, false)

  // ------------------------------------------------------------- the bilayer
  const tint = {
    mid: mix(CHANNEL_MID, species.mid, 0.38),
    dark: mix(CHANNEL_DARK, species.dark, 0.34),
  }
  const gapFrom = w / 2 - CHANNEL_HALF
  const gapTo = w / 2 + CHANNEL_HALF

  // ⚠ THE WALL IS ONLY CUT WHERE THERE IS SOMETHING IN IT (2026-08-30). The
  // gap used to be cut whether or not the door was open, which left a hole in
  // the bilayer with nothing standing in it — the same fault the gating bench
  // had.
  drawLipids(ctx, { midY, from: 0, to: w, gaps: [[gapFrom, gapTo]] })

  // ------------------------------------------------------------- the channel
  //
  // ⚠ A LEAK CHANNEL, AND ONLY WHEN THIS ION HAS ONE (user, 2026-08-30, who
  // asked for the newest drawings everywhere and for pushback on mistakes).
  //
  // This bench has no CAUSE. Its door is toggled by hand, and the app's own
  // standing rule is that no button opens a channel directly — so the door was
  // never really a gate. What the toggle actually varies is whether the
  // membrane is PERMEABLE to this ion, which is exactly the variable an
  // equilibrium-potential experiment turns, and a channel that is simply a way
  // through is a leak channel. Drawing it with a gated silhouette that swings
  // open at a button press was teaching a gating mechanism this bench does not
  // have and cannot show a cause for.
  //
  // ⚠ AND IT IS ALWAYS DRAWN (user, 2026-08-30: "'Equilibrium potential' is
  // now missing channels, fix"). A previous round drew it only while the door
  // was open, on the reasoning that what this bench really varies is whether
  // the membrane is PERMEABLE to the ion — which is true of the physics and
  // wrong on the screen: a chamber with nothing in its wall reads as a chamber
  // that has lost its channel, not as one that never had a way through. The
  // wall is cut and the protein stands in it whatever the door is doing, and
  // what open and shut change is the TRAFFIC, which is the thing the child is
  // being asked to watch anyway.
  const cx = w / 2
  drawLeakChannel(ctx, {
    cx,
    midY,
    species: species.mid,
    speciesDark: species.dark,
  })
  void tint

  // -------------------------------------------------------- the charge itself
  drawFaceCharge(ctx, w, midY, view.vm)

  // ------------------------------------------------------------- the traffic
  if (!open) return
  const mouthOut = { x: cx, y: midY - HALF_MEM - 3 }
  const mouthIn = { x: cx, y: midY + HALF_MEM + 3 }
  const drawBall = (at: { x: number; y: number }) => {
    ctx.save()
    ctx.translate(at.x, at.y)
    ctx.fillStyle = paint
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Balls actually on their way over, each one a ball whose side really changed.
  for (const c of view.crossings) {
    const p = Math.min(1, (timeMs - c.startedMs) / crossingMs(view.strength))
    const src = ballSlot(c.fromRank, !c.inward, w, outH, outTop, inH, inTop)
    const dst = ballSlot(c.toRank, c.inward, w, outH, outTop, inH, inTop)
    drawBall(
      c.inward
        ? journey(p, src, dst, mouthOut, mouthIn)
        : journey(p, src, dst, mouthIn, mouthOut),
    )
  }

  // Nothing crosses once it has settled, and that is not a simplification — it is
  // what the picture's own units say. One ball here stands for a couple of
  // millimolar, and at equilibrium the NET movement is zero, so no ball has any
  // business changing sides. Individual ions really do keep swapping, but far too
  // few of them to shift a single ball: below the resolution of the drawing, like
  // the sodium a spike moves.
  //
  // Two earlier attempts got this wrong in opposite directions. One drew a pair of
  // extra balls cycling, which spawned them. The next made a real ball round-trip
  // through the pore, which conserved everything and looked like a ball bouncing
  // off the membrane — a stranger idea than either of the ones it was trying to
  // convey. The crowd jostles instead: motion, no transport.
}
