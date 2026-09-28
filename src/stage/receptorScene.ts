import { HALF_MEM, drawLipids } from './bilayer'
import { drawLigandChannel, ligandHalfWidth, ligandSeat } from './ligandChannel'
import {
  GLOSSY_COLORS,
  chargeWash,
  drawGlossyIon,
  drawIonCharge,
  polarityT,
} from './particleStyle'
import { TRANSMITTER_INK } from './synapseScene'
import { hash01 } from '../core/noise'
import {
  BAR_SCALE_MS,
  BLOCK_WINDOW_MS as CORE_BLOCK_WINDOW_MS,
  MG_DELTA,
  RECEPTORS,
  arrivalAt,
  boundAt,
  elapsedFor,
  openAt,
  openMs,
  openedMs,
  rawElapsed,
  readingAt,
  stoneDepth,
  type ReceptorKind,
  type ReceptorsState,
} from '../core/receptors'

// D07'S FACE — one receptor per panel, in the app's side-by-side comparison
// layout (user's ruling, 2026-09-11).
//
// ⚠ THE SAME PROTEIN IS DRAWN IN BOTH PANELS. That is not a shortcut, it is
// the exhibit: AMPA and NMDA really are two members of one family, built the
// same way and opened the same way, and everything that separates them here is
// a single stone in one of the two throats. Two different silhouettes would
// have said "two different machines", and the child would have had no reason
// to be surprised that one of them passes nothing.
//
// So the glyph is `drawLigandChannel` — the traced ligand-gated channel from
// the ion-channel bench, the app's ONE drawing of a receptor that opens by its
// subunits coming apart — at a bigger scale, and nothing else.

// ── the budget ──────────────────────────────────────────────────────────────

const VIEW_W = typeof window !== 'undefined' ? window.innerWidth : 1440
const VIEW_H = typeof window !== 'undefined' ? window.innerHeight : 860
const DRAWER_W = Math.min(VIEW_W, 1376)
/** The drawer's own chrome: `p-5` (40), the info column (256), its gap (24),
 *  and the column's scrollbar allowance (12) — counted off the markup, as
 *  every panel budget in this app is. */
export const CONTENT_W = Math.max(660, DRAWER_W - 40 - 256 - 24 - 12)
const CONTENT_H = Math.max(520, VIEW_H - 40 - 8)

/** `SideBySide`'s row gap between the two containers. */
export const ROW_GAP = 10
/** One container: border (2) + `p-2` (16) each side. */
export const PANEL_CHROME = 2 * 8 + 2 * 2
const PANEL_BORDER_PAD = 2 + 16
const PANEL_HEAD = 26
/** The fixed-height caption slot — sized for THREE lines at 11px/snug, because
 *  the panels narrow with the window and a height that fits exactly clips. */
export const CAPTION_H = 46
const PANEL_GAPS = 8 * 3
/** The empty action slot every panel keeps. ⚠ BOTH PANELS' ACTIONS ARE NULL,
 *  and that is the layout's own rule rather than an omission: the action slot
 *  is "the one thing to do to THIS panel", and there is nothing here that can
 *  be done to one receptor alone. The glutamate reaches both and the voltage is
 *  one membrane's, so both live on a shared bar under the row. */
const PANEL_FOOT = 38
/** The shared control bar under the row: one 38px row of chips plus its gap. */
export const CONTROL_BAR_H = 46

export const RECEPTOR_W = Math.floor((CONTENT_W - ROW_GAP) / 2 - PANEL_CHROME)
export const RECEPTOR_H = Math.round(
  CONTENT_H -
    CONTROL_BAR_H -
    PANEL_BORDER_PAD -
    PANEL_HEAD -
    CAPTION_H -
    PANEL_GAPS -
    PANEL_FOOT,
)

// ── the layout, solved from that budget ─────────────────────────────────────

export interface RGeom {
  w: number
  h: number
  /** The bar at the foot, and the drawing above it. */
  barY: number
  barH: number
  drawH: number
  /** The middle of the membrane, in screen px. */
  wallY: number
  /** Half the membrane's thickness, in screen px. */
  hm: number
  /** Screen px per drawing unit — the protein and the lipids are drawn in the
   *  bilayer's own units inside a scaled context. */
  scale: number
  /** Where the receptor stands. */
  cx: number
}

/** ⚠ THE MEMBRANE IS SIZED OFF THE PANEL, AND THE PROTEIN OFF THE MEMBRANE —
 *  never the other way round, and never off the canvas. The protein is fitted
 *  to `2 x halfHeight x 1.12` by the glyph itself, so choosing the membrane's
 *  thickness chooses the protein, which is the correct direction: a receptor's
 *  size is a fact about the wall it sits in. */
export const MEM_OF_PANEL = 0.15

export function receptorGeometry(w = RECEPTOR_W, h = RECEPTOR_H): RGeom {
  const barH = 20
  const barY = h - barH
  const drawH = barY - 10
  const hm = drawH * MEM_OF_PANEL
  return {
    w,
    h,
    barY,
    barH,
    drawH,
    // ⚠ THE MEMBRANE SITS BELOW THE MIDDLE. Three things need the room above
    // it and only one needs the room below: the transmitter crosses from up
    // there, the ions queue up there, and the magnesium is expelled up there.
    wallY: drawH * 0.54,
    hm,
    scale: hm / HALF_MEM,
    cx: w / 2,
  }
}

/** The outer (cleft-side) face of the membrane, and the inner one. */
export const outerFace = (g: RGeom): number => g.wallY - g.hm
export const innerFace = (g: RGeom): number => g.wallY + g.hm

/** Where the transmitter is on its way in, in screen coordinates — from the
 *  top of the cleft to the socket the protein actually offers it.
 *
 *  ⚠ THE SOCKET IS ASKED FOR, NEVER GUESSED. `ligandSeat` moves as the channel
 *  opens, because the socket is cut into a subunit that slides; a fixed
 *  landing point would have the transmitter drift off its own binding site the
 *  moment the pore opened. */
export function transmitterAt(
  g: RGeom,
  kind: ReceptorKind,
  s: ReceptorsState,
): { x: number; y: number; r: number; alpha: number } {
  const e = elapsedFor(s, kind)
  const open = openAt(kind, e)
  // ⚠ THE SEAT COMES BACK IN THE DRAWING'S UNITS. `ligandSeat` is handed the
  // canvas-space centre but the drawing-space `halfHeight`, so its offsets from
  // that centre are in drawing units and have to be scaled — the same rule as
  // every other helper used inside a magnified context.
  const seat = ligandSeat(g.cx, g.wallY, open, HALF_MEM)
  const at = {
    x: g.cx + (seat.x - g.cx) * g.scale,
    y: g.wallY + (seat.y - g.wallY) * g.scale,
    r: seat.r * g.scale,
  }
  const u = arrivalAt(kind, e)
  const from = { x: at.x, y: -g.hm * 0.6 }
  return {
    x: from.x + (at.x - from.x) * u,
    y: from.y + (at.y - from.y) * u,
    r: at.r * 0.78,
    // It fades as it lets go — the socket opening and the transmitter leaving
    // are one event, so they are drawn from one number.
    alpha: u <= 0 ? 0 : 1 - Math.max(0, 1 - boundAt(kind, e)) * (u >= 1 ? 1 : 0),
  }
}

/** How many ion-slots a panel runs, and how long one takes to cross. */
export const ION_SLOTS = 7
export const ION_MS = 900

/** ⚠ WHERE THE MAGNESIUM IS, and the number that places it is `MG_DELTA` — the
 *  fraction of the membrane's electric field the ion sits down in, measured at
 *  0.83 for NMDA. So the depth in the picture IS the physics, rather than a
 *  depth that looks about right beside a paragraph claiming the physics.
 *
 *  Three things move it, and they compose:
 *    · the pore's openness — there is no throat to sit in until there is one;
 *    · how blocked the channel is at this voltage, which is how deep it goes;
 *    · and as the block clears it rises past the mouth and out into the gap,
 *      which is the thing the child is being asked to watch. */
export function plugAt(g: RGeom, s: ReceptorsState, ms: number): { y: number; r: number } {
  // ⚠ IT LIFTS AND DEEPENS WITH THE VOLTAGE, and that is the whole exhibit
  // (user, 2026-09-13: "Do not demo probability of Mg block, either keep closed
  // or open. Lift or deepen depending on the voltage").
  //
  // It used to be a coin tossed every spell — in or out, at the block's own
  // odds. True to the physics and unreadable on a dial: turning the knob
  // changed how OFTEN the stone was in, which no eye can integrate, so the one
  // thing this drawer is for could not be seen. See `stoneDepth`.
  //
  // ⚠ AND IT NO LONGER READS THE GATE. `seated` was multiplied by how open the
  // channel is, so with no ligand anywhere near it the stone hung OUT of a shut
  // pore — the resting state drawn as "the throat is clear", which is backwards
  // and is the same fault the spine had fixed in 21c-68. The block is a
  // function of VOLTAGE alone; the gate is a different machine.
  //
  // ⚠ WHICH IS ALSO THE USER'S POINT (2026-09-13: "physically the NMDA channel
  // remains open all the time, it's Mg block that makes it closed"). The two
  // things this receptor does are drawn by two things: the pore says whether it
  // is open, the stone says whether anything can get through it.
  const seated = stoneIn(s, ms)
  const out = outerFace(g) - g.hm * 1.3
  const seat = outerFace(g) + 2 * g.hm * MG_DELTA
  return { y: out + (seat - out) * seated, r: g.hm * 0.2 }
}

/** ⚠ ONE STONE, ONE RULE. The spell logic lives in `core/receptors.ts`, because
 *  the SPINE view draws this same receptor and one protein gets one drawing
 *  across registers — a second copy here would be a second place for the stone
 *  and the ions to start drifting apart again. */
export const BLOCK_WINDOW_MS = CORE_BLOCK_WINDOW_MS
export const stoneIn = (s: ReceptorsState, _ms = 0): number => stoneDepth(s.plug)

/** Where one travelling ion is, and whether it is being turned back.
 *
 *  ⚠ THE FAILURE IS DRAWN, not left out. An ion that simply never appears says
 *  nothing — absence is not a mark. A blocked channel's ions come down, meet
 *  the stone, and go back up, and the two journeys are blended by how blocked
 *  the channel actually is, so the picture never lies about a partial block. */
export function ionAt(
  g: RGeom,
  kind: ReceptorKind,
  s: ReceptorsState,
  i: number,
  ms: number,
): {
  x: number
  y: number
  r: number
  alpha: number
  kind: 'na' | 'ca'
  passes: boolean
  atMouth: number
} {
  const phase = hash01(i, kind === 'nmda' ? 11 : 3)
  const clock = ms / ION_MS + phase
  const u = ((clock % 1) + 1) % 1
  /** Which crossing this is — a fresh decision each time round. */
  const cycle = Math.floor(clock)
  const startY = outerFace(g) - g.hm * 1.5
  // ⚠ ALL THE WAY OUT OF THE PICTURE (user, 2026-09-11: "let ions in nmda reach
  // the bottom edge of the canvas, same as in ampa case"). An ion that stops
  // short of the edge looks like an ion that ran out of somewhere to go.
  const endY = g.drawH
  const stop = plugAt(g, s, ms).y - g.hm * 0.26

  // ⚠ THE BLOCK CHOOSES WHICH IONS TURN BACK — it does not shorten all of them.
  //
  // It used to blend every ion's path between "through" and "bounce" by the
  // block fraction, which is what the user saw first: at a nearly-clear channel
  // every NMDA ion was still pulled a tenth of the way back and none of them
  // ever reached the bottom, so NMDA looked feeble rather than open.
  //
  // ⚠ AND IT ASKS THE STONE, NOT THE NUMBER (21c-35). The pass/bounce decision
  // used to be its own seeded coin against `s.plug` — a second, independent
  // rendering of the same fraction the stone was drawing its own way. Two
  // pictures of one number will disagree, and they did: at −15 mV the stone sat
  // over the entrance while half the ions sailed through it.
  //
  // So an ion now asks where the stone actually WAS at the moment it reached
  // the mouth. The two cannot contradict each other, because there is only one
  // of them.
  const startU = (outerFace(g) - startY) / (endY - startY)
  const atMouth = (cycle - phase + startU) * ION_MS
  // ⚠ THE FRACTION THAT PASSES IS THE FRACTION THE STONE LEAVES CLEAR (21c-74).
  //
  // This read `stoneIn(...) < 0.5` — a threshold, which was right while the
  // stone was a coin tossed over TIME: ions arriving at different moments met
  // it in different states, so across the cast the share that got through came
  // out at the block. The stone is a DEPTH now and gives every ion the same
  // answer, so a threshold made it all-or-nothing: MEASURED at −30 mV, 0% of
  // ions got in against a block that leaves 31% of the current flowing.
  //
  // *When one drawn thing stands for many, probabilities become FRACTIONS.* So
  // each ion takes a share of its own and passes if the stone leaves room for
  // it — the same one number, read as a proportion of the cast instead of a
  // proportion of the clock, and still asked of the stone so the two cannot
  // contradict each other.
  const passes = kind !== 'nmda' || hash01(i + cycle * 97, 13) >= stoneIn(s, atMouth)

  // Straight through…
  const through = startY + (endY - startY) * u
  // …or down to the stone and back, on a there-and-back-again in the same time.
  const tri = u < 0.5 ? u * 2 : 2 - u * 2
  const bounce = startY + (stop - startY) * tri
  const open = openAt(kind, elapsedFor(s, kind))
  // ⚠ THE TWO ENDINGS ARE NOT THE SAME ENDING. A traveller fades IN at the top
  // so it does not pop into being in the middle of the gap. What happens at the
  // other end depends on which journey it made:
  //
  //   · one that gets through leaves at the BOTTOM EDGE of the picture, and is
  //     solid the whole way — it has gone into the cell, and fading it out over
  //     the last few pixels was measured putting every ion at the edge below
  //     half alpha, which is the user's complaint back again in another form;
  //   · one that is turned back returns into the gap it came from and fades
  //     there, because it is joining a crowd rather than leaving the picture.
  const fadeIn = Math.min(1, u / 0.08)
  const edge = fadeIn * (passes ? 1 : Math.min(1, (1 - u) / 0.06))
  return {
    x: g.cx + (hash01(i, 7) - 0.5) * g.hm * 0.5,
    y: passes ? through : bounce,
    /** Which journey this one made — a caller that wants to ask about ions
     *  GOING IN must not be answered about ones on their way back out. */
    passes,
    /** WHEN it reached the mouth, in the same clock. The decision was taken
     *  then, and a guard has to be able to check it against the stone at that
     *  instant rather than at whatever moment it happens to be sampling. */
    atMouth,
    r: g.hm * 0.16,
    // Nothing is in transit through a shut pore.
    alpha: Math.max(0, Math.min(1, open * 2 - 0.6)) * edge,
    // ⚠ NMDA LETS CALCIUM IN AND AMPA MOSTLY DOES NOT — the one other real
    // difference between them, and the reason the whole coincidence trick
    // matters to the cell. Every third traveller on the NMDA side is calcium.
    kind: kind === 'nmda' && i % 3 === 0 ? 'ca' : 'na',
  }
}

/** How full this panel's bar is, 0…1, on the scale BOTH panels share. */
export function barFrac(kind: ReceptorKind, s: ReceptorsState): number {
  return openedMs(kind, rawElapsed(s)) / BAR_SCALE_MS()
}

/** Where the other panel's bar would end, as a fraction of this one's track —
 *  so each bar can carry a tick at the other's full length and the comparison
 *  needs no memory. */
export const barMark = (kind: ReceptorKind): number => openMs(kind) / BAR_SCALE_MS()

// ── the ink ─────────────────────────────────────────────────────────────────

/** ⚠ A CHANNEL WEARS ITS ION, IN EVERY VIEW (21c-34, and it is an old rule with
 *  its own guard file — `channelColour.test.ts`, from the user's 2026-08-30
 *  correction that the K⁺ channel did not look purple enough).
 *
 *  This bench broke it on the day it was built. AMPA was painted in the
 *  TRANSMITTER's teal — the colour of what it catches — and NMDA in magnesium's
 *  stone, the colour of what BLOCKS it. Neither is the ion it passes, and the
 *  round-trip view had had it right all along, drawing the same receptor in
 *  sodium's gold. The user asked whether the two should be made consistent; the
 *  answer is yes, and the fix runs this way.
 *
 *  AMPA wears SODIUM. NMDA wears CALCIUM — it passes sodium too, but calcium is
 *  the ion that makes it a different receptor and the whole reason the cell
 *  bothers with it. The magnesium keeps its stone, because it is the blocker
 *  and not the channel. */
const PANEL_INK: Record<ReceptorKind, string> = {
  ampa: GLOSSY_COLORS.na.mid,
  nmda: GLOSSY_COLORS.ca.mid,
}
const PANEL_DARK: Record<ReceptorKind, string> = {
  ampa: GLOSSY_COLORS.na.dark,
  nmda: GLOSSY_COLORS.ca.dark,
}

/** ⚠ THE WORD IS THE COLOUR OF WHAT CAUSES IT — draw what a thing is tied TO.
 *  'Blocked' is written in magnesium's own stone, so the word and the stone in
 *  the throat read as one fact; 'open' is written in the ion that is getting
 *  through, which is the receptor's own colour. */
export const readingInk = (reading: string, kind: ReceptorKind): string =>
  reading === 'blocked' ? GLOSSY_COLORS.mg.mid : reading === 'open' ? PANEL_INK[kind] : '#64748b'

// ── the drawing ─────────────────────────────────────────────────────────────

export interface ReceptorFrame {
  kind: ReceptorKind
  state: ReceptorsState
  width?: number
  height?: number
  ms: number
}

export function drawReceptor(ctx: CanvasRenderingContext2D, f: ReceptorFrame): void {
  const g = receptorGeometry(f.width ?? RECEPTOR_W, f.height ?? RECEPTOR_H)
  const { kind, state: s, ms } = f
  const e = elapsedFor(s, kind)
  const open = openAt(kind, e)

  ctx.clearRect(0, 0, g.w, g.h)

  // ⚠ A5 — THE NEGATIVE INSIDE IS COLOUR-CODED (user, 2026-09-11: "color-code
  // negative potential, when Mg blocks"), and with the app's OWN ramp rather
  // than a colour picked for this bench: `polarityT` and `chargeWash` are what
  // the resting bench, the patch bench and the capacitor already use, so a
  // child who has learnt that blue means "negative in here" anywhere else in
  // the app reads this without being taught twice.
  //
  // It is painted in BOTH panels, because it is one membrane potential and one
  // cell — the wash is the shared condition the two receptors are being
  // compared under, and putting it in only the NMDA panel would have made it
  // look like a property of NMDA.
  // ⚠ AND PAINTED AS A PATH, NOT AS `fillRect` — deliberately. A test stand-in
  // records path vertices; `fillRect` lays ink at coordinates nothing can see,
  // so a wash painted that way is a claim no guard can reach. Two of this
  // step's own guards were blind until it changed (21c-32).
  const t = polarityT(s.mv)
  ctx.fillStyle = chargeWash(ctx, innerFace(g) + 2, g.drawH, t, 0.55)
  ctx.beginPath()
  ctx.rect(0, innerFace(g) + 2, g.w, g.drawH - innerFace(g) - 2)
  ctx.fill()

  // The gap above — the outside, with the same ink, so the child can see where
  // the cell stops.
  ctx.fillStyle = 'rgba(148, 163, 184, 0.05)'
  ctx.beginPath()
  ctx.rect(0, 0, g.w, outerFace(g) - 2)
  ctx.fill()

  // ── the membrane and the protein, in the bilayer's own units ──────────────
  const half = ligandHalfWidth(HALF_MEM, open)
  ctx.save()
  ctx.translate(g.cx, g.wallY)
  ctx.scale(g.scale, g.scale)
  drawLipids(ctx, {
    midY: 0,
    from: -g.cx / g.scale,
    to: g.cx / g.scale,
    gaps: [[-half, half]],
    ms,
  })
  drawLigandChannel(ctx, {
    cx: 0,
    midY: 0,
    halfHeight: HALF_MEM,
    species: PANEL_INK[kind],
    speciesDark: PANEL_DARK[kind],
    open,
    socket: true,
  })
  ctx.restore()

  // ── the travellers ────────────────────────────────────────────────────────
  for (let i = 0; i < ION_SLOTS; i++) {
    const ion = ionAt(g, kind, s, i, ms)
    if (ion.alpha <= 0.01) continue
    drawGlossyIon(ctx, ion.kind, ion.x, ion.y, ion.r, ion.alpha)
    ctx.save()
    ctx.globalAlpha *= ion.alpha
    drawIonCharge(ctx, ion.x, ion.y, ion.r, ion.kind === 'ca' ? 2 : 1)
    ctx.restore()
  }

  // ── the magnesium ─────────────────────────────────────────────────────────
  if (kind === 'nmda') {
    const p = plugAt(g, s, ms)
    drawGlossyIon(ctx, 'mg', g.cx, p.y, p.r)
    drawIonCharge(ctx, g.cx, p.y, p.r, 2)
  }

  // ── the transmitter ───────────────────────────────────────────────────────
  const tr = transmitterAt(g, kind, s)
  if (tr.alpha > 0.01) {
    ctx.save()
    ctx.globalAlpha *= tr.alpha
    const grad = ctx.createRadialGradient(
      tr.x - tr.r * 0.35,
      tr.y - tr.r * 0.35,
      0,
      tr.x,
      tr.y,
      tr.r,
    )
    grad.addColorStop(0, TRANSMITTER_INK.light)
    grad.addColorStop(0.6, TRANSMITTER_INK.mid)
    grad.addColorStop(1, TRANSMITTER_INK.dark)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // ── the reading ───────────────────────────────────────────────────────────
  const reading = readingAt(s, kind)
  // ⚠ OUT OF THE IONS' WAY, not centred under the pore. The travellers now run
  // the full height of the panel down a narrow column on the axis, and a word
  // sitting in that column would be walked over every crossing.
  ctx.font = '600 15px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = readingInk(reading, kind)
  ctx.fillText(reading, 12, g.drawH - 16)

  // ── the bar ───────────────────────────────────────────────────────────────
  //
  // ⚠ A2 — HOW LONG IT WAS OPEN, on a scale both panels share, and it HOLDS
  // after the run so the two can be compared at leisure. The tick is the other
  // receptor's full length, so each panel carries the comparison on its own
  // and the child never has to remember a picture.
  const pad = 12
  const track = g.w - pad * 2
  const strip = (x: number, y: number, w: number, h: number, ink: string) => {
    ctx.fillStyle = ink
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.fill()
  }
  strip(pad, g.barY + 6, track, 8, 'rgba(148, 163, 184, 0.18)')
  strip(pad, g.barY + 6, track * barFrac(kind, s), 8, PANEL_INK[kind])
  const other: ReceptorKind = kind === 'ampa' ? 'nmda' : 'ampa'
  strip(pad + track * barMark(other) - 1, g.barY + 2, 2, 16, 'rgba(226, 232, 240, 0.5)')
}

export { RECEPTORS }
