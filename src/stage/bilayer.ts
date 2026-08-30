import { LIPID_HEAD_NM, LIPID_SPACING_NM, MEMBRANE_THICKNESS_NM } from '../core/membrane'

// The membrane, drawn the one way this app draws membranes.
//
// This used to live inside the balance bench, which was the second place a
// bilayer had been drawn and the second set of numbers for how big a lipid head
// is. There is now a third place — the stretch of axon, N19 — and three
// independent drawings of the same molecule is how a visual language quietly
// stops being one. So the lipids and the gated channel moved here, unchanged,
// and both views call the same code.
//
// The whole-neuron canvas is deliberately NOT a caller. Out there the membrane
// is drawn at the scene's own honest scale — a fortieth of a pixel, resolving
// into real lipids only past ×500 — and it derives its sizes from
// core/membrane.ts. This module is the SCHEMATIC bilayer, for views that are
// diagrams rather than magnifications, and the two must not be confused.

/** Half the bilayer, px. The one size chosen here rather than derived: it is
 *  what "5 nm" is worth in this drawing, and every other length follows from
 *  it and from a real measurement. */
export const HALF_MEM = 14.2

/** What one nanometre is worth in this drawing. */
const PX_NM = (2 * HALF_MEM) / MEMBRANE_THICKNESS_NM

// Proportions checked against a fluid phosphatidylcholine bilayer, 2026-08-28,
// after the user's eye said the heads were too big and the tails too short.
// They were, badly: the head took 73% of a leaflet where a real one takes
// ~38%, the visible tails ran 0.37 head-widths where the hydrocarbon core is
// 1.6× the headgroup, and the molecules stood 18.9 Å apart where a real
// leaflet packs them at ~8 Å. Every length below is now derived from a
// measured number in core/membrane.ts, so it cannot drift again by eye.

/** Radius of one phospholipid head, px — half the app's declared 1 nm head. */
export const HEAD_R = (LIPID_HEAD_NM / 2) * PX_NM
/** Centre-to-centre spacing along a leaflet, px, from the area per lipid. */
export const HEAD_GAP = LIPID_SPACING_NM * PX_NM
/** How far the tails reach into the oily middle: the rest of the leaflet. */
export const TAIL_LEN = HALF_MEM - HEAD_R

export const LIPID_HEAD_LIGHT = '#f1f5f9'
export const LIPID_HEAD_MID = '#cbd5e1'
export const LIPID_HEAD_DARK = '#7c8899'
export const LIPID_TAIL_LIGHT = '#8b98ab'
export const LIPID_TAIL_DARK = '#4a5567'
export const OILY_CORE = 'rgba(148, 163, 184, 0.1)'
export const CHANNEL_MID = '#9a8b6a'
export const CHANNEL_DARK = '#5f5540'
export const PORE = 'rgba(2, 6, 23, 0.6)'

/** Half-width of a channel protein, px. */
export const CHANNEL_HALF = 21

/** What one screen pixel is worth, in nanometres, at this drawing's proportions.
 *
 *  Derived from the one length in it that is a real measurement: a bilayer is
 *  about 5 nm thick, everywhere, in every cell. Any view using these lipids can
 *  therefore say what it is showing and by how much it has magnified it, instead
 *  of drawing a membrane at whatever size looked right and saying nothing. */
export const PX_PER_NM = (2 * HALF_MEM) / MEMBRANE_THICKNESS_NM

/** Read a colour this app uses into r, g, b, a. Hex or rgb()/rgba().
 *
 *  It used to read hex ONLY, by slicing characters and calling parseInt on them,
 *  and handed anything else back as `rgb(NaN, NaN, NaN)`. That was survivable for
 *  as long as the result only ever became a `fillStyle`, because an unparseable
 *  fillStyle is silently ignored — so a wrong colour was a wrong colour and nothing
 *  more. The first time such a string reached `addColorStop` it THREW, which took
 *  down the whole scene function, which took down the Konva animation with it: a
 *  frozen camera, a blank view and a dead button, from one bad colour parse.
 *
 *  Silent NaN is the real fault, not the throw. It parses properly now, and a test
 *  pins that it can never return NaN. */
function readColour(c: string): [number, number, number, number] {
  const hex = c.trim()
  if (hex.startsWith('#')) {
    const body = hex.slice(1)
    const wide = body.length >= 6
    const part = (i: number) =>
      wide
        ? parseInt(body.slice(i * 2, i * 2 + 2), 16)
        : parseInt(body[i] + body[i], 16)
    return [part(0), part(1), part(2), 1]
  }
  const nums = hex.match(/-?[\d.]+/g)
  if (!nums || nums.length < 3) return [0, 0, 0, 1]
  return [
    Number(nums[0]),
    Number(nums[1]),
    Number(nums[2]),
    nums.length > 3 ? Number(nums[3]) : 1,
  ]
}

/** Blend two colours — how a channel gets tinted with the species it passes without
 *  ceasing to look like protein. Accepts hex or rgb()/rgba(); alpha blends too. */
export function mix(a: string, b: string, t: number): string {
  const from = readColour(a)
  const to = readColour(b)
  const at = (i: number) => from[i] + (to[i] - from[i]) * t
  const ch = (i: number) => {
    const v = Math.round(at(i))
    return Number.isFinite(v) ? Math.max(0, Math.min(255, v)) : 0
  }
  const alpha = Number.isFinite(at(3)) ? Math.max(0, Math.min(1, at(3))) : 1
  return `rgba(${ch(0)}, ${ch(1)}, ${ch(2)}, ${alpha})`
}

export interface LipidRun {
  /** Where the middle of the membrane sits. */
  midY: number
  /** The stretch to fill, in px. */
  from: number
  to: number
  /** Stretches to leave alone, because something else is sitting there. */
  gaps?: ReadonlyArray<readonly [number, number]>
  /** How far the membrane's middle wanders from `midY` at this x, and how steeply.
   *
   *  A real membrane is a liquid draped over whatever is under it, and it is never
   *  a ruled line. Every view in this app that draws a membrane along a PATH gets
   *  that for free; the ones that draw a horizontal run had it dead straight, which
   *  reads as manufactured next to the axon's own wandering wall. */
  waveAt?: (x: number) => number
  /** Slope of that wave, dy/dx, so each molecule stands square to the surface
   *  rather than bolt upright on a slope. */
  slopeAt?: (x: number) => number
  /** Sideways shove on the molecule at this x, px — how the wall OPENS to let
   *  something through.
   *
   *  Bowing the midline (`waveAt`) was tried first and reads as the opposite of
   *  what it means: standing each molecule square to a dented surface tilts the
   *  neighbours TOWARD each other, so the wall appears to close over the
   *  traveller rather than part for it (2026-08-28). Pushing molecules apart
   *  along the membrane is what "making room" actually looks like. */
  pushAt?: (x: number) => number
}

// ── The one phospholipid this app draws ────────────────────────────────────
//
// Every proportion below is a fraction of the HEAD's radius, so the same
// molecule can be drawn at a bench's comfortable size and at the scene's
// honest, magnification-derived size and still be recognisably the same
// creature. Unified 2026-08-28: the whole-neuron scene had grown its own
// version with curved tails, a wider splay and a different gap at the middle,
// and two drawings of one molecule is how a visual language stops being one.
// The bench drawing (the phospholipid-bilayer drawer) is the source of truth.

/** Where the tails start, measured from the head's centre toward the core. */
const TAIL_START = 0.6
/** Sideways offset of a tail, at its start and at its tip. */
const SPLAY_START = 0.163
const SPLAY_TIP = 0.327
/** Tail thickness. */
const TAIL_WIDTH = 0.288
/** How far one tail's kink bends it sideways (0 = a straight, saturated tail). */
export const KINK_BEND = 0.31

/** The seam at the middle: how far short of the midplane a tail tip stops.
 *
 *  Checked against the physics rather than chosen (2026-08-28): the two
 *  leaflets' tails MEET in the middle — there is no empty channel down there —
 *  but the terminal methyls are the most disordered, lowest-density part of
 *  the whole wall, and an electron-density profile of a real bilayer shows a
 *  distinct TROUGH exactly at the midplane. So the honest picture is tips that
 *  very nearly touch, leaving a faint seam the oily core shows through: not a
 *  gap you could pass anything through, and not a crossing overlap either. The
 *  drawing used to overshoot the midplane by a fifth of a head radius, which
 *  read as the two layers stitching into each other. */
export const MID_SEAM = 0.15

export interface LipidGeom {
  /** Radius of the head. */
  headR: number
  /** Half the membrane's thickness — the head's centre sits headR inside it. */
  halfMem: number
  /** Kink one tail (a cis double bond). Off by default; detail that resolves
   *  with magnification. */
  kinked?: boolean
}

export interface LipidPaint {
  head: CanvasGradient | string
  tail: CanvasGradient | string
}

/** Build one leaflet's shading once, in a frame whose origin is the middle of
 *  the membrane and where `out` points away from the core. Callers that draw
 *  hundreds of molecules a frame build this once and move the context. */
export function leafletPaint(
  ctx: CanvasRenderingContext2D,
  geom: LipidGeom,
  out: -1 | 1,
): LipidPaint {
  const { headR, halfMem } = geom
  const headY = out * (halfMem - headR)
  const head = ctx.createRadialGradient(
    -headR * 0.4,
    headY - out * headR * 0.4,
    0,
    0,
    headY,
    headR,
  )
  head.addColorStop(0, LIPID_HEAD_LIGHT)
  head.addColorStop(0.55, LIPID_HEAD_MID)
  head.addColorStop(1, LIPID_HEAD_DARK)
  const tail = ctx.createLinearGradient(0, headY, 0, out * headR * MID_SEAM)
  tail.addColorStop(0, LIPID_TAIL_LIGHT)
  tail.addColorStop(1, LIPID_TAIL_DARK)
  return { head, tail }
}

/** One phospholipid at the ORIGIN of a frame whose +y·out points away from the
 *  oily core: a shaded head facing the water, two tails splaying inward and
 *  stopping just short of the midplane. */
export function drawLipidAt(
  ctx: CanvasRenderingContext2D,
  out: -1 | 1,
  geom: LipidGeom,
  paint: LipidPaint,
): void {
  const { headR, halfMem } = geom
  const kink = geom.kinked ? headR * KINK_BEND : 0
  const headY = out * (halfMem - headR)
  const y0 = headY - out * headR * TAIL_START
  const y1 = out * headR * MID_SEAM

  ctx.fillStyle = paint.head
  ctx.beginPath()
  ctx.arc(0, headY, headR, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = paint.tail
  ctx.lineWidth = headR * TAIL_WIDTH
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const leg of [-1, 1] as const) {
    const x0 = leg * headR * SPLAY_START
    const x1 = leg * headR * SPLAY_TIP
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    if (kink > 0 && leg > 0) {
      // The unsaturated tail: a bend partway down that it cannot straighten.
      ctx.lineTo(x0 + (x1 - x0) * 0.55 + kink * leg, y0 + (y1 - y0) * 0.55)
      ctx.lineTo(x1 + kink * 1.6 * leg, y1)
    } else {
      ctx.lineTo(x1, y1)
    }
    ctx.stroke()
  }
}

/** ONE phospholipid of the bench-sized bilayer, at (x, midY) on the `side`
 *  leaflet. A thin wrapper over the shared molecule so the benches keep their
 *  call signature. */
export function drawLipid(
  ctx: CanvasRenderingContext2D,
  x: number,
  midY: number,
  side: -1 | 1,
  jitter = 0,
  kink = 0,
): void {
  const geom: LipidGeom = { headR: HEAD_R, halfMem: HALF_MEM, kinked: kink > 0 }
  ctx.save()
  ctx.translate(x + jitter, midY)
  drawLipidAt(ctx, side === -1 ? -1 : 1, geom, leafletPaint(ctx, geom, side === -1 ? -1 : 1))
  ctx.restore()
}

/** The bare stretches of membrane between whatever is embedded in it. */
function segmentsOf(run: LipidRun): Array<[number, number]> {
  const gaps = [...(run.gaps ?? [])].sort((a, b) => a[0] - b[0])
  const out: Array<[number, number]> = []
  let cursor = run.from
  for (const [a, b] of gaps) {
    if (a > cursor) out.push([cursor, Math.min(a, run.to)])
    cursor = Math.max(cursor, b)
  }
  if (cursor < run.to) out.push([cursor, run.to])
  return out
}

/** A run of bilayer: the oily middle, then two leaflets of heads and tails.
 *
 *  Lipids are interrupted by what sits among them and never drawn over it — a
 *  protein is IN the membrane, displacing lipids, not painted on top of it.
 *
 *  Each bare stretch is filled EDGE TO EDGE rather than stepped along at a fixed
 *  spacing from the left. Stepping left a gap of up to a whole lipid's width
 *  wherever a protein happened to fall, which read as a moat around it — and a
 *  channel with a hole in the membrane either side of it is a picture of a leak.
 *  Lipids pack right up against a protein, so the drawing does too: the spacing
 *  inside each stretch flexes by a few per cent to make the ends come out even. */
export function drawLipids(ctx: CanvasRenderingContext2D, run: LipidRun): void {
  const { midY, from, to } = run
  const wave = run.waveAt ?? (() => 0)
  const slope = run.slopeAt ?? (() => 0)

  // A genuinely different chemical environment, and the reason a charged ion
  // needs a door at all. Follows the wave when there is one, so the oily middle
  // does not sit in a straight band under a curved row of heads.
  ctx.fillStyle = OILY_CORE
  if (!run.waveAt) {
    ctx.fillRect(from, midY - TAIL_LEN, to - from, TAIL_LEN * 2)
  } else {
    ctx.beginPath()
    const STEP = 6
    ctx.moveTo(from, midY + wave(from) - TAIL_LEN)
    for (let x = from; x <= to; x += STEP) ctx.lineTo(x, midY + wave(x) - TAIL_LEN)
    ctx.lineTo(to, midY + wave(to) - TAIL_LEN)
    ctx.lineTo(to, midY + wave(to) + TAIL_LEN)
    for (let x = to; x >= from; x -= STEP) ctx.lineTo(x, midY + wave(x) + TAIL_LEN)
    ctx.closePath()
    ctx.fill()
  }

  for (const [a, b] of segmentsOf(run)) {
    const span = b - a
    if (span < HEAD_R) continue
    const count = Math.max(1, Math.round(span / HEAD_GAP))
    const spacing = span / count
    for (let i = 0; i < count; i++) {
      const slot = a + spacing * (i + 0.5)
      // Where this molecule actually stands: its slot, shoved aside by
      // whatever is passing through.
      const x = slot + (run.pushAt?.(slot) ?? 0)
      // A little irregularity, deterministic: a perfectly even row reads as a
      // manufactured grid, and a bilayer is a liquid.
      const jitter = (Math.sin(x * 0.7) + Math.sin(x * 1.9)) * 0.5
      // Stand each molecule square to the surface it is in. A bilayer on a slope
      // whose lipids all point straight up is a row of pins, not a membrane.
      //
      // Skipped entirely on a flat run, which is most of them: no transform, and
      // the drawing is byte-for-byte what it was before waves existed.
      const dy = wave(x)
      const tilt = Math.atan(slope(x))
      const bent = dy !== 0 || tilt !== 0
      if (bent) {
        ctx.save()
        ctx.translate(x, midY + dy)
        ctx.rotate(tilt)
        ctx.translate(-x, -midY)
      }
      for (const side of [-1, 1] as const) {
        drawLipid(ctx, x, midY, side, jitter)
      }
      if (bent) ctx.restore()
    }
  }
}

export interface GatedChannel {
  cx: number
  midY: number
  /** How far open, 0→1. A fraction rather than a flag, because a voltage-gated
   *  door spends most of a spike part-way. */
  open: number
  /** The protein's own colours, already tinted with what it passes. */
  mid: string
  dark: string
  /** Full-strength species colour for the lit rim and the selectivity filter. */
  species: string
  halfWidth?: number
  /** The ball-and-chain that hangs off a voltage-gated sodium channel into the
   *  cytoplasm — the piece that swings up and plugs its own pore, which is what
   *  INACTIVATION is. Off by default: only some channels have one, and drawing
   *  it on all of them would be a lie about the rest. */
  /** How far the protein reaches either side of the middle. Defaults to the
   *  bilayer's own half-thickness; smaller where the membrane is drawn as a band
   *  rather than as molecules, so the door still straddles its own wall. */
  halfHeight?: number
}

/** One channel protein straddling the bilayer, with a pore that flares open.
 *
 *  Always drawn, however shut it is: a closed channel has not gone anywhere, and
 *  a membrane that loses its doors when they shut teaches that permeability is
 *  about how many channels there are rather than what they are doing. */
export function drawGatedChannel(ctx: CanvasRenderingContext2D, c: GatedChannel): void {
  const half = c.halfWidth ?? CHANNEL_HALF
  const reach = c.halfHeight ?? HALF_MEM
  const { cx, midY, open } = c
  const lit = open > 0.02
  const overhang = 4 * (reach / HALF_MEM)
  const top = midY - reach - overhang
  const bottom = midY + reach + overhang

  // ── THE SILHOUETTE ────────────────────────────────────────────────────────
  //
  // TWO FACING SUBUNITS with a real gap between them, not one body with a slot
  // cut in it (user, 2026-08-28, against a reference figure: "the shapes are
  // not even close"). They were right, and the difference is not cosmetic — a
  // channel IS several separate protein subunits standing in a ring, and the
  // gap between them IS the way through. A single outline with a hole in it
  // draws a channel as a bead with a hole drilled in it.
  //
  // Each subunit is lobed the way the figure's are: wide at both mouths,
  // pinched at the waist where the membrane's greasy middle squeezes it, with
  // rounded caps. The rounding is done by stroking the same path in the same
  // paint with a round join — cheaper than building fillets, and it gives the
  // soft blob edge the figure has.
  const poreWaist = half * (0.07 + 0.2 * open)
  const poreMouth = poreWaist * 1.9 + half * 0.04
  const outerWaist = half * 0.78
  const round = Math.max(1, half * 0.16)

  const bodyGrad = ctx.createLinearGradient(cx - half, 0, cx + half, 0)
  bodyGrad.addColorStop(0, c.dark)
  bodyGrad.addColorStop(0.38, c.mid)
  bodyGrad.addColorStop(1, c.dark)

  for (const side of [-1, 1] as const) {
    ctx.beginPath()
    // Down the OUTER edge: out at the top mouth, in at the waist, out again.
    ctx.moveTo(cx + side * (half - round), top + round)
    ctx.bezierCurveTo(
      cx + side * half,
      top + reach * 0.5,
      cx + side * outerWaist,
      midY - reach * 0.25,
      cx + side * outerWaist,
      midY,
    )
    ctx.bezierCurveTo(
      cx + side * outerWaist,
      midY + reach * 0.25,
      cx + side * half,
      bottom - reach * 0.5,
      cx + side * (half - round),
      bottom - round,
    )
    // Across the intracellular cap.
    ctx.lineTo(cx + side * (poreMouth + round), bottom - round)
    // Up the PORE edge: the funnel, wide at both mouths and narrow at the
    // waist, which is where a selectivity filter actually sits.
    ctx.bezierCurveTo(
      cx + side * poreMouth,
      midY + reach * 0.55,
      cx + side * poreWaist,
      midY + reach * 0.3,
      cx + side * poreWaist,
      midY,
    )
    ctx.bezierCurveTo(
      cx + side * poreWaist,
      midY - reach * 0.3,
      cx + side * poreMouth,
      midY - reach * 0.55,
      cx + side * (poreMouth + round),
      top + round,
    )
    ctx.closePath()
    ctx.fillStyle = bodyGrad
    ctx.strokeStyle = bodyGrad
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = round * 2
    ctx.stroke()
    ctx.fill()
    // The lit rim, when it is passing something.
    if (lit) {
      ctx.strokeStyle = c.species
      ctx.lineWidth = 1 + 0.8 * open
      ctx.stroke()
    }
  }

  // ⚠ THE GATE FLAP AND THE VOLTAGE SENSOR USED TO BE DRAWN HERE, and both
  // are gone (2026-08-29). The voltage-gated channel is a TRACED drawing now
  // — see `voltageChannel.ts` — with its own flap and its own inactivation
  // ball, so a second, invented pair on the generic gate had no user left.
  // Dead options on a shared drawing are worse than dead code: the next
  // caller reaches for them.

  // ⚠ THE BINDING SOCKET USED TO BE CUT HERE, and it is gone (2026-08-29).
  // The ligand-gated channel is a traced drawing now with a socket of its
  // own, cut into a subunit that SLIDES — so the socket has to move with it,
  // which a notch on the generic gate could not do. Dead options on a shared
  // drawing are worse than dead code: the next caller reaches for them.

  const mouth = poreMouth
  // The selectivity filter, at full species strength: the narrowest ring of the
  // pore, and the part that actually does the choosing.
  if (lit) {
    ctx.strokeStyle = c.species
    ctx.lineWidth = 2 * Math.min(1, reach / HALF_MEM)
    ctx.lineCap = 'round'
    for (const side of [-1, 1] as const) {
      ctx.beginPath()
      ctx.moveTo(cx + side * mouth * 0.85, midY - (3 * reach) / HALF_MEM)
      ctx.lineTo(cx + side * mouth * 0.85, midY + (3 * reach) / HALF_MEM)
      ctx.stroke()
    }
  }
}
