import { GLOSSY_COLORS, chargeRamp, drawGlossyIon } from './particleStyle'
import {
  CHANNEL_DARK,
  CHANNEL_HALF,
  CHANNEL_MID,
  HALF_MEM,
  LIPID_HEAD_DARK,
  LIPID_HEAD_MID,
  OILY_CORE,
  PX_PER_NM,
  drawGatedChannel,
  drawLipids,
  mix,
} from './bilayer'
import { polarizationT } from '../core/actionPotential'
import { SIGNAL_CORE, SIGNAL_RGB, softGlow } from './signal'
import { VM_MAX, VM_MIN, nernstMv } from '../core/voltage'
import {
  fibreFront,
  fibrePeak,
  myelinFor,
  sampleFibre,
  type FibreOptions,
  type FibreRun,
} from '../core/fibre'
import type { IonCounts } from '../state/ionStore'

// A stretch of axon, drawn as itself (N19) — on the canvas, at its own zoom.
//
// Every stripe of this axon is a patch of membrane with its own voltage, its own
// doors and its own place in its own spike, read out of the cable model. There is
// no sprite, no comet and no travelling anything: if the drawing loop drew the
// stripes in a random order the picture would be identical, which is the test
// that matters. What sweeps along is the pattern a hundred patches happen to make
// between them.
//
// ------------------------------------------------------- the one scale change
//
// The camera really does fly here, and what it arrives at is really this axon:
// its THICKNESS is drawn at the camera's own honest scale, the same 1.4 µm the
// whole scene is built on, which is why the tube is 86 px across and not a
// number somebody liked.
//
// Its LENGTH is not, and cannot be. A spike takes about two milliseconds and
// travels at about half a metre a second, so the lit stretch of axon is a
// millimetre or two long — and the axon drawn on the main stage is 93 µm from end
// to end, a quarter of one length constant, crossed in a tenth of a millisecond.
// Magnifying it does not help: a camera changes magnification, not the specimen.
//
// So the length axis is SQUASHED, by a factor this module derives and states
// (`lengthSquash`), and the ruler underneath is in real millimetres. Thickness
// true, length compressed, both said out loud — the way a cross-section of a
// valley is drawn. The amber tick near the left of the ruler is the whole of the
// axon from the main stage, at the ruler's own scale, which is what makes the
// squash something you can see rather than something you are told.
//
// The molecules are in the magnifier: a small ring on the membrane and a big lens
// showing that spot enlarged, drawn with the shared bilayer (stage/bilayer.ts) so
// it is the same membrane a child has already been inside. Millimetres on the
// ruler and nanometres in the lens, in one picture, is the point rather than a
// caveat.

/** How many stripes the axon is drawn in. Not the number the model uses — that
 *  is set by the physics (a fifth of a length constant) and is far finer. This is
 *  set by what a person can count, and the two are deliberately independent: the
 *  drawing samples the model, so nobody is tempted to coarsen the physics to fit
 *  the pixels. */
export const PATCHES = 24

/** How long a stretch of axon this view shows, µm.
 *
 *  The view's own constant rather than the model's, because the drawing has to lay
 *  out a ruler before it has a run to draw — and because both fibres it can show,
 *  bare and sheathed, must be the same length or the comparison between them means
 *  nothing. A test holds the runs to it. */
export const VIEW_LENGTH_UM = 6000

/** How long the run is, ms of model time. Long enough that the bare fibre spends
 *  about half of it crossing, which leaves the sheathed one crossing in a tenth —
 *  and that contrast is the point rather than an inconvenience. */
export const VIEW_MS = 20

/** How long the run takes on screen, ms.
 *
 *  Three times slower than the membrane patch's spike, and the same for both
 *  fibres — which is the part that matters. Slowing only the sheathed one would
 *  have made it watchable by taking away the very thing it is there to show.
 *
 *  Why it needed slowing at all: the sheathed fibre crosses six millimetres in
 *  1.9 ms of model time against the bare one's 9.5, so at the patch view's pace it
 *  was over in four tenths of a second, with forty-three nodes firing inside it.
 *  At this pace that is a second and a bit — still plainly the quick one, and now
 *  quick enough to watch rather than quick enough to miss. */
export const PLAY_MS = 12600

/** Extra slow-motion for the sheathed fibre, on top of the shared rate.
 *
 *  A deliberate break from one rate for both fibres, and the reasoning has moved,
 *  so it is written down. One rate is what makes the two ANIMATIONS comparable —
 *  but nobody compares animations by eye against a stopwatch; the comparison this
 *  view makes is carried by the measured speeds in the describer, and by N21's
 *  race when it is built. What the single-fibre animation has to do is be
 *  WATCHABLE, and at the shared rate the sheathed fibre fired its forty-three
 *  nodes in about a second — a demonstration of exactly the thing the view exists
 *  to show, over too fast to see.
 *
 *  So the sheathed run is stretched a further 2.2×, and the on-screen clock stays
 *  honest: it shows model milliseconds, which now simply pass more slowly. The
 *  crossing still LOOKS quicker than the bare fibre's (2.6 s against 6.1), so the
 *  qualitative story survives; the exact ratio is the describer's job. */
export const MYELIN_SLOWDOWN = 2.2

/** How much faster the clock runs through the recovery tail — the stretch after
 *  every patch has fired, when the story is over and only the undershoot is
 *  draining away. The drama plays at full slow-motion; the tidying-up is skimmed.
 *  The on-screen clock stays honest either way: it shows model milliseconds,
 *  which simply pass more quickly once nothing is left to fire. */
export const TAIL_HASTE = 5

/** How long a run takes on screen, ms: the shared rate, times the run's own
 *  trimmed window, times the sheathed fibre's extra slow-motion. */
export function screenDurationMs(run: FibreRun): number {
  const window = run.t[run.t.length - 1] ?? VIEW_MS
  return PLAY_MS * (window / VIEW_MS) * (run.myelinated ? MYELIN_SLOWDOWN : 1)
}

/** How much axon one stripe stands for, µm. */
export const PATCH_UM = VIEW_LENGTH_UM / PATCHES

/** The fibre this view runs on, bare or sheathed.
 *
 *  One place, so that everything drawing or describing this view is looking at the
 *  same run — and so that the two states differ in NOTHING except the sheath. Same
 *  length, same window, same push, same gradients: if they differed in anything
 *  else the speeds could not be compared, which is the whole of N21.
 *
 *  The grid and the step are the coarsest that still converge — a quarter of a
 *  second of arithmetic rather than a whole one, checked in the tests. */
/** Internode length of the fibre THIS VIEW runs, µm — 3.6× the real 140.
 *
 *  A deliberate exaggeration, decided when the honest anatomy proved unwatchable:
 *  43 nodes fire 45 µs apart, which on screen is a 63 ms flicker per node — a
 *  strobe no eye can parse, at sleeves 21 px long. Stretching the internodes to
 *  500 µm gives 12 nodes, 81 px sleeves, and a hop every ~270 ms of screen time:
 *  point-to-point propagation you can actually follow.
 *
 *  What keeps it honest is that the exaggeration is IN THE MODEL, not painted on:
 *  the run really has 12 nodes, the physics really crosses those internodes, and
 *  the speed quoted is measured on the fibre drawn. It costs something real and
 *  reportable — ×4.2 over bare instead of the true anatomy's ×5.1, because
 *  overstretched internodes conduct WORSE, which is itself the reason real fibres
 *  sit near 100 diameters — and the describer confesses the spacing. */
export const VIEW_INTERNODE_UM = 500

/** How often a pair of doors is drawn along a BARE axon, µm.
 *
 *  Close together, all the way down, because that is what a bare axon is: channels
 *  the whole length of it, every patch rebuilding the signal for the next. The
 *  spacing is the drawing's, not the biology's — real channels are far too small
 *  and too many to draw — but "everywhere" is the honest impression and it is the
 *  one that matters.
 *
 *  This spacing IS the feature, and getting it wrong once is what makes that worth
 *  writing down. An earlier pass spread these out to sit exactly where the sheathed
 *  fibre has nodes, so both pictures showed doors half a millimetre apart — and
 *  with the same distance from channel to channel in both, there is no reason left
 *  for myelin to exist. What myelin changes is HOW FAR APART the rebuilding
 *  happens: continuous on a bare axon, once an internode on a sheathed one. */
export const DOOR_SPACING_UM = 250

export function viewFibre(myelin: boolean, race = false): FibreOptions {
  return {
    lengthUm: VIEW_LENGTH_UM,
    // The race gives both fibres the SAME window and no trimming, because two
    // runs trimmed to their own finishing times would land on different clocks —
    // and one clock is the whole of N21. Long enough for the bare fibre to
    // finish, which means the sheathed one is home in a fifth of it.
    msTotal: race ? RACE_MS : VIEW_MS,
    trim: race ? false : undefined,
    dxUm: 40,
    dtMs: 0.004,
    stimWidthUm: 400,
    myelin: myelin ? { ...myelinFor(), internodeUm: VIEW_INTERNODE_UM } : null,
  }
}

/** How long the race runs, ms of model time.
 *
 *  Not merely long enough for the bare fibre to ARRIVE — long enough for it to
 *  recover. At 14 ms it was home at 9.7 and the animation then froze on a far end
 *  still a dozen millivolts under its resting voltage, so the race ended with one
 *  axon apparently stuck blue. Same mistake the single-fibre view made and had
 *  fixed; it came back here because the race sets its own window.
 *
 *  The dead time this would add is not added: the clock hurries once BOTH fibres
 *  are home — see `raceTailStartU`. */
export const RACE_MS = 24

/** Where the race stops being a race, as a fraction of the run: a moment after the
 *  LAST fibre has arrived.
 *
 *  Both, not either. The single-fibre view hurries its recovery tail and the race
 *  deliberately does not, because skipping the tidying-up for one fibre while the
 *  other is still running would be skipping part of the race. Once both are home
 *  there is no race left to distort, and what is left is two axons repolarising —
 *  worth seeing happen, not worth sitting through in real proportions. */
export function raceTailStartU(runs: readonly FibreRun[]): number {
  const window = runs[0].t[runs[0].t.length - 1] ?? RACE_MS
  let last = 0
  for (const run of runs) {
    const at = run.crossedAt[run.crossedAt.length - 1]
    if (Number.isFinite(at)) last = Math.max(last, at)
    else return 1
  }
  return Math.min(1, (last + 1.5) / window)
}

/** The race runs at ONE rate for both fibres, and no slow-motion for either.
 *
 *  That is the opposite of what the single-fibre view does, and deliberately:
 *  there, MYELIN_SLOWDOWN exists so a sheathed run can be watched at all. Here,
 *  slowing one fibre and not the other would be forging the result, and slowing
 *  both would only make the same race longer. The sheathed axon arrives at about
 *  1.5 s and the bare one at 6 — which is the demonstration, at the model's own
 *  proportions. */
export function raceDurationMs(): number {
  return PLAY_MS * (RACE_MS / VIEW_MS)
}

/** The same layout with the axon somewhere else — for the race, which stacks two.
 *
 *  Every tube-drawing function reads the axon's position out of the geometry and
 *  nothing else, so handing them a shifted copy draws a second axon with no
 *  special cases and, more to the point, no second implementation that could drift
 *  away from the first. */
export function atMid(geo: RibbonGeometry, tubeMid: number): RibbonGeometry {
  return {
    ...geo,
    tubeMid,
    tubeTop: tubeMid - geo.tubeHalf,
    tubeBottom: tubeMid + geo.tubeHalf,
  }
}

/** How far the world outside the cell is drawn, px. */
const OUTSIDE_H = 24
// Narrow gutters, because nothing is written in them any more. Every word this
// view had to say has moved into the describer beside the canvas — the bench
// settled that principle and this view had drifted from it: one place to read,
// one place to touch. What is left on the canvas is the instrument itself, and
// the only text on it is a scale that cannot be anywhere else.
//
// The clipping is what forced the issue. Right-aligned labels in an 84 px gutter
// ran off the left edge, and widening the gutter to fit them would have been
// paying for the wrong thing twice: less axon on screen, and a caption competing
// with the panel that already said it better.
const PAD_L = 30
const PAD_R = 30
/** Height of the voltage-against-distance graph, px. */
const PLOT_H = 104
/** Graph to ruler, ruler to its labels, and labels to the bottom edge, px. */
const RULER_GAP = 40
const LABEL_DROP = 15
const FLOOR = 10
/** The strip at the top of the canvas the transport controls sit in. */
const CHROME = 76
/** Everything that has to fit under the axon, px. */
const BELOW = OUTSIDE_H + 24 + PLOT_H + RULER_GAP + LABEL_DROP + FLOOR

export interface RibbonGeometry {
  left: number
  right: number
  /** The middle of the axon, and half its true drawn thickness. */
  tubeMid: number
  tubeHalf: number
  /** The envelope the wobbling tube stays inside. */
  tubeTop: number
  tubeBottom: number
  /** The voltage-against-distance plot. */
  plotTop: number
  plotBottom: number
  rulerY: number
  /** The magnifier's lens. */
  lensR: number
  lensCy: number
}

/** Laid out from the BOTTOM up.
 *
 *  The graph and the ruler take exactly the room they need and sit on the floor
 *  of the canvas; the axon sits directly above them; and the magnifier takes
 *  everything left between the axon and the strip the controls occupy, which is
 *  most of the height and is why the lens is the big thing on screen.
 *
 *  Anchoring downwards rather than centring the axon costs one small thing worth
 *  writing down: the scene's own axon, which the camera flies to, is centred on
 *  the stage, so during the hand-over the tube fading in sits a little below the
 *  tube fading out. The scene is nearly gone by then — its layer's opacity is
 *  tied to the same fade — so it reads as the axon settling rather than as two
 *  axons. Filling the canvas is worth that.
 *
 *  The only quantity here that is not ours to choose is the axon's THICKNESS: the
 *  camera's honest scale sets it, and everything else is arranged around it. */
export function ribbonGeometry(
  width: number,
  height: number,
  axonPx: number,
): RibbonGeometry {
  const tubeHalf = Math.max(14, axonPx / 2)
  // Never so low that the magnifier has nowhere to go, however short the stage.
  const minBottom = CHROME + 88 + 14 + OUTSIDE_H + tubeHalf * 2
  const tubeBottom = Math.max(minBottom, height - BELOW)
  const tubeMid = tubeBottom - tubeHalf
  const tubeTop = tubeMid - tubeHalf
  const plotTop = tubeBottom + OUTSIDE_H + 24
  const plotBottom = Math.max(
    plotTop + 30,
    Math.min(plotTop + PLOT_H, height - RULER_GAP - LABEL_DROP - FLOOR),
  )
  // What is left between the controls and the axon, with the lens centred in it.
  const ceiling = CHROME
  const floorY = tubeTop - OUTSIDE_H - 14
  return {
    left: PAD_L,
    right: Math.max(PAD_L + 160, width - PAD_R),
    tubeMid,
    tubeHalf,
    tubeTop,
    tubeBottom,
    plotTop,
    plotBottom,
    rulerY: plotBottom + RULER_GAP,
    lensR: Math.max(44, Math.min(140, (floorY - ceiling) / 2)),
    lensCy: (ceiling + floorY) / 2,
  }
}

/** Where one stripe sits, in µm along the axon. They tile the cable exactly:
 *  no gaps to fall down and no overlaps to double-count. */
export function patchSpanUm(i: number): [number, number] {
  return [i * PATCH_UM, (i + 1) * PATCH_UM]
}

/** Middle of a stripe, as a fraction along the cable. */
export const patchCentre = (i: number): number => (i + 0.5) / PATCHES

/** Fraction 0→1 along the cable of a distance in µm. */
export const alongCable = (um: number): number => um / VIEW_LENGTH_UM

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)

/** Screen x of a distance along the axon. */
export function xAt(geo: RibbonGeometry, p: number): number {
  return lerp(geo.left, geo.right, clamp(p, 0, 1))
}

/** Which stripe a click at this screen x lands on. */
export function patchAtX(geo: RibbonGeometry, x: number): number {
  const p = (x - geo.left) / (geo.right - geo.left)
  return clamp(Math.floor(p * PATCHES), 0, PATCHES - 1)
}

/** Screen y of a voltage on the plot. */
export function plotY(geo: RibbonGeometry, mv: number): number {
  const t = (mv - VM_MIN) / (VM_MAX - VM_MIN)
  return lerp(geo.plotBottom, geo.plotTop, clamp(t, 0, 1))
}

/** Whole-millimetre marks along the ruler. */
export function millimetreTicks(): number[] {
  const out: number[] = []
  for (let mm = 0; mm * 1000 <= VIEW_LENGTH_UM + 1; mm++) out.push(mm * 1000)
  return out
}

/** How much the length axis is squashed, given how thick the axon is drawn.
 *
 *  A single number, and a derived one: the ratio of how many micrometres a pixel
 *  is worth ALONG the axon to how many it is worth ACROSS it. Thickness is the
 *  honest one, so this is exactly how much longer the axon really is than it
 *  looks. */
export function lengthSquash(geo: RibbonGeometry, axonUm: number): number {
  const umPerPxAlong = VIEW_LENGTH_UM / (geo.right - geo.left)
  const umPerPxAcross = axonUm / (geo.tubeHalf * 2)
  return umPerPxAlong / umPerPxAcross
}

/** How much membrane the lens shows, in nanometres — derived from the shared
 *  bilayer's own proportions rather than chosen, so the caption cannot drift away
 *  from the drawing. */
export function lensNm(geo: RibbonGeometry): number {
  return (geo.lensR * 2) / PX_PER_NM
}

/** How many times bigger the lens draws a nanometre than the axon beside it
 *  does.
 *
 *  Relative to THIS DRAWING, not to life. Magnification against real life would
 *  depend on how big a pixel happens to be on the screen it is read on, which is
 *  not a fact about the picture; the ratio between two things drawn on the same
 *  screen is. */
export function lensMagnification(geo: RibbonGeometry): number {
  const nmPerPx = (VIEW_LENGTH_UM * 1000) / (geo.right - geo.left)
  return nmPerPx * PX_PER_NM
}

/** How far from rest one point along the axon is, −1 → +1.
 *
 *  The same measure the membrane patch tints its cytoplasm with, so red means the
 *  same thing in every view that uses it — and it is exported for exactly that
 *  reason: the little map of the whole neuron beside the canvas reads its colours
 *  through this function too, so "in sync" is structural rather than a pair of
 *  drawings that happen to agree today. */
export function patchHeat(
  run: FibreRun,
  u: number,
  p: number,
  counts: IonCounts,
): number {
  return polarizationT(
    sampleFibre(run, 'vm', u, p),
    run.rest,
    nernstMv('na', counts),
    nernstMv('k', counts),
  )
}

/** How brightly the signal shows at one point along the axon, 0→1.
 *
 *  Exported for the same reason `patchHeat` is: the little map of the whole cell
 *  lights up through this too, so the flash on the canvas and the flash on the
 *  map cannot come to mean different things. Above zero it lights, brightest at
 *  the peak, dark once it has fallen back — a per-place brightness, never a
 *  position, which is what keeps a sweeping yellow blob from being a travelling
 *  object in disguise. */
export function patchSignal(run: FibreRun, u: number, p: number): number {
  const top = fibrePeak(run)
  if (top <= 0) return 0
  const vm = sampleFibre(run, 'vm', u, p)
  // Overshooting zero is what this app calls a spike everywhere else, and it is
  // the same line here.
  return vm <= 0 ? 0 : Math.min(1, vm / top)
}

/** Radius of the little ring on the membrane, px — the spot the lens is showing.
 *
 *  Tied to the lens rather than fixed, so the two read as a pair: a small circle
 *  and a big one, the second being the first enlarged, which is a shape anyone can
 *  read without being told.
 *
 *  It is NOT to scale, and cannot be. See `spotTruePx`. */
export function spotRadius(geo: RibbonGeometry): number {
  return clamp(geo.lensR * 0.16, 14, OUTSIDE_H + geo.tubeHalf * 0.4)
}

/** How wide the spot the lens shows really is on the axon below, px.
 *
 *  About a hundred and fiftieth of a pixel. That is the honest size of the ring,
 *  and it is why the ring is not drawn at it: a marker you cannot see does not mark
 *  anything. The exaggeration is stated in the describer rather than left to be
 *  worked out, which is the same bargain the synaptic cleft has had since the first
 *  milestone. */
export function spotTruePx(geo: RibbonGeometry): number {
  return (geo.lensR * 2) / lensMagnification(geo)
}

/** Where everything sits in the race, worked out rather than guessed at.
 *
 *  Fixed fractions of the height put the clock under the toolbar and left a bank of
 *  empty canvas under the lower axon. This measures the block the race needs — two
 *  axons with their outside bands, a gap between them, and the shared ruler — and
 *  centres it in what is left below the controls, so the space above and below
 *  comes out the same at any height. */
export function raceLayout(geo: RibbonGeometry, tubeHalf: number) {
  const lane = tubeHalf * 2 + OUTSIDE_H * 2
  const BETWEEN = 40
  const TO_RULER = 46
  // Built UP from the ruler, which sits where the single-fibre views put theirs —
  // on the floor of the canvas. Centring the block instead left the race's ruler
  // floating in the middle of the page while every other mode's rested on the
  // bottom, and switching modes moved the one thing that should not move.
  const lane2Top = geo.rulerY - TO_RULER - lane
  const lane1Top = lane2Top - BETWEEN - lane
  return {
    clockY: CHROME + 34,
    lane1: lane1Top + OUTSIDE_H + tubeHalf,
    lane2: lane2Top + OUTSIDE_H + tubeHalf,
    rulerY: geo.rulerY,
  }
}

export interface RaceView {
  width: number
  height: number
  axonPx: number
  axonUm: number
  /** Both fibres, on one clock: bare first. */
  runs: readonly [FibreRun, FibreRun]
  u: number
  counts: IonCounts
  fade: number
}

/** Both axons at once, over the same distance, from the same push, against one
 *  clock (N21).
 *
 *  The single-fibre view can say "about five times quicker" in words and put the
 *  measured number in the panel. This says it by making the viewer wait: the
 *  sheathed axon is home while the bare one is a third of the way along, and
 *  nobody has to be told what that means.
 *
 *  No lens and no voltage graph here. There is no room for them beside two axons,
 *  and they belong to looking at ONE fibre closely — which is what the other two
 *  modes are for. What this mode owes instead is a clock, a finish line, and two
 *  labels. */
export function drawRace(ctx: CanvasRenderingContext2D, view: RaceView): void {
  const base = ribbonGeometry(view.width, view.height, view.axonPx)
  const plan = raceLayout(base, base.tubeHalf)
  const lanes = [plan.lane1, plan.lane2]
  const { runs, u, counts } = view
  const nowMs = u * (runs[0].t[runs[0].t.length - 1] ?? RACE_MS)

  ctx.clearRect(0, 0, view.width, view.height)
  ctx.save()
  ctx.globalAlpha = clamp(view.fade, 0, 1)
  ctx.font = FONT
  ctx.textBaseline = 'middle'

  const eNa = nernstMv('na', counts)
  const eK = nernstMv('k', counts)

  runs.forEach((run, lane) => {
    const geo = atMid(base, lanes[lane])
    const heat = (p: number) =>
      polarizationT(sampleFibre(run, 'vm', u, p), run.rest, eNa, eK)

    drawOutside(ctx, geo)
    drawSignal(ctx, geo, run, u)
    drawTube(ctx, geo, heat)
    drawDoors(ctx, geo, run, u)
    drawSheath(ctx, geo, run)
    drawNodeFlashes(ctx, geo, run, u)

    // No label on the lane, and no arrival caption. Which axon is which is
    // visible — one is beaded with sleeves and the other is not — and the times
    // are in the describer, where a number can be a sentence. The rest of this
    // app took its words off the canvas some steps ago; the race was written
    // before that and had not caught up.
  })

  drawFinishLine(ctx, base, lanes[0] - 70, lanes[1] + 70)
  drawRaceClock(ctx, base, nowMs, plan.clockY)
  // The shared ruler, once, under both lanes: same millimetres for each, which is
  // what "same distance" means. No amber tick here — the drawn axon's length is a
  // point about scale, and this mode is about time.
  drawRuler(ctx, { ...base, rulerY: plan.rulerY }, { drawnAxonUm: 0 } as RibbonView, true)
  ctx.restore()
}

/** The finish, straight through both lanes — so "same distance" is something you
 *  can see rather than something a caption claims. */
function drawFinishLine(
  ctx: CanvasRenderingContext2D,
  geo: RibbonGeometry,
  from: number,
  to: number,
): void {
  const x = geo.right
  ctx.beginPath()
  ctx.setLineDash([5, 5])
  ctx.moveTo(x, from)
  ctx.lineTo(x, to)
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.45)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.setLineDash([])
  // No "finish" caption. A dashed line straight through both lanes at the same x
  // says the distance is equal; a word next to it would only be repeating that.
}

/** The clock, in milliseconds of the real event. */
function drawRaceClock(
  ctx: CanvasRenderingContext2D,
  geo: RibbonGeometry,
  nowMs: number,
  y: number,
): void {
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(241, 245, 249, 0.9)'
  ctx.font = '600 22px ui-sans-serif, system-ui, sans-serif'
  // The clock stays: it is a reading off a scale, like the millimetres on the
  // ruler, not a caption explaining the picture. Its sentence has gone to the
  // describer with everything else.
  ctx.fillText(`${nowMs.toFixed(1)} ms`, geo.left, y)
  ctx.font = FONT
}

export interface RibbonView {
  width: number
  height: number
  /** How thick this axon is drawn at the camera's honest scale, px. */
  axonPx: number
  /** The axon's real width, µm — for the squash factor. */
  axonUm: number
  run: FibreRun
  /** 0→1 through the run. */
  u: number
  counts: IonCounts
  /** Which stripe the magnifier is on. */
  patch: number
  /** How long the axon on the main stage is, µm. */
  drawnAxonUm: number
  /** 0→1 as the view takes over from the scene behind it. */
  fade: number
}

const FONT = '500 11px ui-sans-serif, system-ui, sans-serif'
const LABEL = 'rgba(148, 163, 184, 0.9)'
const FAINT = 'rgba(148, 163, 184, 0.45)'
const PICKED = 'rgba(251, 191, 36, 0.95)'

/** How much charge one drawn ion stands for, C/cm².
 *
 *  A DRAWING rate, and it has to be admitted as one: a real spike moves millions
 *  of sodium ions through a square micrometre of membrane, so no honest number of
 *  balls can be put on a screen. This is set so that a spike at real gradients
 *  sends about seven through each pore — enough to read as a stream rather than as
 *  three balls being ferried back and forth.
 *
 *  What IS honest is everything relative. Half the charge is half the crossings,
 *  so a run that fails visibly puts fewer ions through than one that fires, and
 *  the rate they move at through the run is the shape of the current itself. */
const Q_PER_ION = 1.9e-7

// ------------------------------------------------------------ the wobbly tube
//
// A real axon is not a rectangle. It meanders, it thickens and thins, and it is
// beaded with varicosities — so this one does too. The wobble is deterministic
// (a sum of three sines of x, no clock and no randomness), which matters for more
// than tidiness: a tube that shimmered would be a tube that looked alive in a way
// nothing about it is, and the drawing has to be a pure function of the model for
// the same-inputs-same-picture test to mean anything.
//
// It is kept INSIDE the honest envelope: the meander and the thickening together
// never exceed the axon's true half-width, so the tube's widest point is still
// its real width and no part of the picture is fatter than the biology.

const swell = (x: number): number =>
  Math.sin(x * 0.0089 + 2.2) * 0.55 + Math.sin(x * 0.031 + 0.4) * 0.3 + Math.sin(x * 0.071) * 0.15

const meander = (x: number): number =>
  Math.sin(x * 0.0117 + 4.1) * 0.6 + Math.sin(x * 0.043 + 1.1) * 0.4

/** Middle of the tube at this x. */
const tubeAxis = (geo: RibbonGeometry, x: number): number =>
  geo.tubeMid + meander(x) * geo.tubeHalf * 0.04

/** Half the tube's thickness at this x — at most its true half-width. */
const tubeSwell = (geo: RibbonGeometry, x: number): number =>
  geo.tubeHalf * (0.86 + 0.1 * swell(x))

/** Screen y of one wall at this x. `side` −1 is the upper wall. */
export function wallY(geo: RibbonGeometry, x: number, side: 1 | -1): number {
  return tubeAxis(geo, x) + side * tubeSwell(geo, x)
}

/** The two walls as polylines, left to right. */
function walls(geo: RibbonGeometry): { top: number[][]; bottom: number[][] } {
  const top: number[][] = []
  const bottom: number[][] = []
  const step = 6
  for (let x = geo.left; x <= geo.right + step; x += step) {
    const cx = Math.min(x, geo.right)
    top.push([cx, wallY(geo, cx, -1)])
    bottom.push([cx, wallY(geo, cx, 1)])
  }
  return { top, bottom }
}

export function drawRibbon(ctx: CanvasRenderingContext2D, view: RibbonView): void {
  const geo = ribbonGeometry(view.width, view.height, view.axonPx)
  const { run, u, counts } = view
  const patch = clamp(Math.round(view.patch), 0, PATCHES - 1)

  ctx.clearRect(0, 0, view.width, view.height)
  ctx.save()
  ctx.globalAlpha = clamp(view.fade, 0, 1)
  ctx.font = FONT
  ctx.textBaseline = 'middle'

  const heat = (p: number): number => patchHeat(run, u, p, counts)

  drawOutside(ctx, geo)
  // Before the axon, not over it. The tube is painted on an opaque base, so what
  // survives of this is the halo standing out around the cable — which is what an
  // aura should be. Drawn on top it washed over the red, and two colours mixed
  // into an orange smear is two readings lost rather than one gained.
  drawSignal(ctx, geo, run, u)
  drawTube(ctx, geo, heat)
  drawDoors(ctx, geo, run, u)
  drawSheath(ctx, geo, run)
  // On TOP of all of it, and for a reason worth remembering: they were behind it.
  // The aura was moved behind the tube so it would stop washing out the red, the
  // flashes were written as a variant of the aura, and so they inherited a place
  // underneath an opaque body — drawn faithfully, every frame, and invisible.
  drawNodeFlashes(ctx, geo, run, u)
  drawMagnifier(ctx, geo, run, u, patch, heat)
  drawPlot(ctx, geo, run, u)
  drawRuler(ctx, geo, view)
  drawFront(ctx, geo, run, u)
  ctx.restore()
}

/** The world outside the axon — and it is NOT tinted.
 *
 *  It carried the charge colour the other way round for a while, on the reasoning
 *  that charge is separated rather than created. True, and still the wrong
 *  picture: the outside is the REFERENCE. A membrane voltage of −72 mV does not
 *  mean the fluid outside is positive, it means the outside is zero by definition
 *  and the inside is 72 below it. Colouring it states two facts where there is
 *  one, and invites "which is it, then?" about a quantity that only has one side.
 *  The balance bench settled this the same way and for the same reason; this view
 *  had quietly gone its own way. */
function drawOutside(ctx: CanvasRenderingContext2D, geo: RibbonGeometry): void {
  const bath = 'rgba(100, 116, 139, 0.07)'
  ctx.fillStyle = bath
  ctx.fillRect(geo.left, geo.tubeTop - OUTSIDE_H, geo.right - geo.left, OUTSIDE_H + geo.tubeHalf)
  ctx.fillRect(geo.left, geo.tubeMid, geo.right - geo.left, geo.tubeHalf + OUTSIDE_H)
}

/** The axon: an opaque body inside its wobbling outline, one stripe of colour per
 *  drawn patch, and a membrane down each wall. Both ends are rounded rather than
 *  running off the frame, because the model's ends are sealed and a tube that
 *  vanished off the edge would promise axon the model does not have. */
function drawTube(
  ctx: CanvasRenderingContext2D,
  geo: RibbonGeometry,
  heat: (p: number) => number,
): void {
  const { top, bottom } = walls(geo)

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(top[0][0], top[0][1])
  for (const [x, y] of top) ctx.lineTo(x, y)
  // Round the far end, back along the underside, round the near end.
  ctx.quadraticCurveTo(
    geo.right + geo.tubeHalf * 0.55,
    geo.tubeMid,
    bottom[bottom.length - 1][0],
    bottom[bottom.length - 1][1],
  )
  for (let i = bottom.length - 1; i >= 0; i--) ctx.lineTo(bottom[i][0], bottom[i][1])
  ctx.quadraticCurveTo(geo.left - geo.tubeHalf * 0.55, geo.tubeMid, top[0][0], top[0][1])
  ctx.closePath()
  ctx.clip()

  // Something opaque under the tints, so the outside's colour cannot show
  // through the cytoplasm and read as a second charge.
  ctx.fillStyle = 'rgba(9, 11, 16, 0.97)'
  ctx.fillRect(geo.left - 60, geo.tubeTop - 40, geo.right - geo.left + 120, geo.tubeHalf * 2 + 80)

  for (let i = 0; i < PATCHES; i++) {
    const [a, b] = patchSpanUm(i)
    const x0 = xAt(geo, alongCable(a))
    const x1 = xAt(geo, alongCable(b))
    const t = heat(patchCentre(i))
    ctx.fillStyle = `rgba(${chargeRamp(t)}, ${0.24 + 0.74 * Math.abs(t)})`
    ctx.fillRect(x0, geo.tubeTop - 30, x1 - x0 + 0.8, geo.tubeHalf * 2 + 60)
    // A hairline between stripes: they are separate patches, and the picture
    // should not let them melt into one continuous thing.
    ctx.fillStyle = 'rgba(15, 23, 42, 0.3)'
    ctx.fillRect(x1 - 0.5, geo.tubeTop - 30, 1, geo.tubeHalf * 2 + 60)
  }
  ctx.restore()

  for (const wall of [top, bottom]) membrane(ctx, wall)

}

/** The membrane along one wall. Not lipids: at this length a phospholipid head is
 *  a millionth of a pixel, and drawing molecules here would put them 80 µm apart.
 *  It is drawn as the band it looks like from this far away — the oily middle
 *  between two paler faces, in the bilayer's own palette, so it is recognisably
 *  the same membrane, just too far off to see the molecules. Which is what the
 *  magnifier is for. */
function membrane(ctx: CanvasRenderingContext2D, wall: number[][]): void {
  const trace = () => {
    ctx.beginPath()
    ctx.moveTo(wall[0][0], wall[0][1])
    for (const [x, y] of wall) ctx.lineTo(x, y)
  }
  ctx.lineCap = 'round'
  trace()
  ctx.strokeStyle = LIPID_HEAD_DARK
  ctx.lineWidth = 6.6
  ctx.stroke()
  trace()
  ctx.strokeStyle = LIPID_HEAD_MID
  ctx.lineWidth = 5.2
  ctx.stroke()
  trace()
  ctx.strokeStyle = OILY_CORE
  ctx.lineWidth = 2.4
  ctx.stroke()
}

/** The yellow flash — the app's one way of saying "the signal is here" — laid
 *  over the stripes that are spiking at this moment.
 *
 *  It is worth being exact about what this is, because a yellow blob sweeping
 *  along a cable is the very picture this milestone exists to dismantle. It is not
 *  a thing being drawn at a position. It is a per-stripe brightness, computed from
 *  that stripe's own voltage: above zero it lights, brightest at its peak, dark
 *  again once it has fallen back. The stripes light in turn, and a run of
 *  neighbouring stripes each doing that is what a sweep looks like. Draw the
 *  stripes in a random order and the picture is unchanged.
 *
 *  Two colours doing two jobs, on purpose. The red/blue ramp under it answers
 *  "how far from rest is this membrane", which is why a recovering stretch reads
 *  blue; the yellow answers "is the signal here", which is what the whole-neuron
 *  view has always meant by yellow. The flash sits at the crest, so it arrives
 *  just where the blue tail behind it begins. */
function drawSignal(
  ctx: CanvasRenderingContext2D,
  geo: RibbonGeometry,
  run: FibreRun,
  u: number,
): void {
  // The bare axon keeps a soft aura as well as its sparks, and the difference is
  // the lesson: on bare membrane the activity really IS continuous — every patch
  // between the drawn sites is rebuilding too — whereas under a sleeve nothing
  // happens at all. So one fibre glows along its whole lit stretch and the other
  // is dark between its nodes. Dimmed, so the sparks read over it.
  if (run.myelinated) return
  for (let i = 0; i < PATCHES; i++) {
    const p = patchCentre(i)
    const lit = patchSignal(run, u, p)
    if (lit <= 0) continue
    const x = xAt(geo, p)
    softGlow(ctx, x, geo.tubeMid, geo.tubeHalf * 5, SIGNAL_RGB, 0.4 * lit * lit)
  }
}

/** On a sheathed fibre the light goes on at the NODES, one after another, and
 *  nowhere in between. This is the demonstration.
 *
 *  And it is driven by a different reading from the bare axon's aura, on purpose.
 *  Out there the yellow follows the VOLTAGE, because on bare axon every patch
 *  regenerates and voltage is a fair marker of where the signal is being made.
 *  Under a sheath that would be misleading: the voltage swings nearly as far
 *  between the nodes as at them — the internode is a good cable — so a
 *  voltage-driven glow would light the sleeves and there would be nothing to see.
 *
 *  So the flash follows the SODIUM DOORS. It marks where the spike is being
 *  rebuilt, which is the one thing that happens only at nodes, and it is what the
 *  spec asks this feature to show. The sleeves stay dark not because nothing is
 *  happening in them but because nothing is being MADE there, and the describer
 *  says exactly that rather than leaving the darkness to be misread. */
function drawNodeFlashes(
  ctx: CanvasRenderingContext2D,
  geo: RibbonGeometry,
  run: FibreRun,
  u: number,
): void {
  const nowMs = Math.max(0, Math.min(1, u)) * (run.t[run.t.length - 1] ?? 0)
  const places = doorPlaces(run)
  if (places.length < 2) return

  // One brief spark wherever the signal is REBUILT, on both fibres — and drawing
  // them by the same rule in both is the point. Bare axon: two dozen of them, all
  // the way down, because every patch of it has to remake the signal for the next.
  // Myelinated: twelve, only at the nodes, with nothing between. Same distance
  // covered, half the rebuilds, and it gets there in a third of the time.
  //
  // A spark is an event marker on when that place fired, not a reading of a door
  // that happens to be open — a door stays open far longer than the step to the
  // next site, so an openness-driven glow smears a dozen of them into a band. The
  // pulse is sized just under the interval between one firing and the next, so a
  // spark is always over before its neighbour begins.
  //
  // Still a pure function of u: a bell over (now − firedAt), with no clock of its
  // own, so scrubbing backwards replays it exactly.
  const firedAt = places.map((p) => {
    const x = p * VIEW_LENGTH_UM
    let best = Infinity
    let gap = Infinity
    run.parts.forEach((part, i) => {
      const d = Math.abs(part.x - x)
      if (d < gap && Number.isFinite(run.crossedAt[i])) {
        gap = d
        best = run.crossedAt[i]
      }
    })
    return best
  })
  const steps = firedAt
    .slice(1)
    .map((at, i) => at - firedAt[i])
    .filter((d) => d > 0 && Number.isFinite(d))
    .sort((a, b) => a - b)
  if (steps.length === 0) return
  const pulseMs = (steps[Math.floor(steps.length / 2)] ?? 0.05) * 0.85

  places.forEach((p, i) => {
    const at = firedAt[i]
    if (!Number.isFinite(at)) return
    const phase = (nowMs - at) / pulseMs
    if (phase < 0 || phase > 1) return
    // An eased bell: swells in, peaks, dies away.
    const lit = Math.sin(Math.PI * phase) ** 2
    const x = xAt(geo, p)
    for (const side of [-1, 1] as const) {
      const y = wallY(geo, x, side)
      softGlow(ctx, x, y, 26 + 38 * lit, SIGNAL_RGB, 0.95 * lit)
      ctx.fillStyle = SIGNAL_CORE
      ctx.globalAlpha = lit
      ctx.beginPath()
      ctx.arc(x, y, 2.8 + 4.8 * lit, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  })
}

// ----------------------------------------------------------------- the sheath

const SHEATH_LIGHT = 'rgba(233, 226, 208, 0.92)'
const SHEATH_MID = 'rgba(198, 186, 158, 0.9)'
const SHEATH_DARK = 'rgba(120, 110, 88, 0.85)'

/** Myelin, where there is any: fat wrapped round the axon in lengths, with a bare
 *  gap at every node.
 *
 *  Two things about this drawing are exaggerated, and both have to be, so both are
 *  said out loud in the describer. A node is 1 µm against a 140 µm internode — a
 *  seventh of a pixel here — so the gaps are drawn wide enough to see. And the
 *  sheath is drawn as a thickening of the wall rather than at its true bulk, which
 *  would make the axon inside it disappear.
 *
 *  What is NOT exaggerated is how many there are: the internode length comes from
 *  the model, which takes it from the axon's own diameter, so the beads you count
 *  are the beads the physics used. */
/** How far the sheath stands off the axon's wall, px. Comfortably inside the band
 *  drawn for the world outside the cell, because that is where it belongs — around
 *  the axon, in the space outside it — and low enough that the axon it is wrapped
 *  around is still the thing you look at. */
export const SHEATH_THICK = (geo: RibbonGeometry): number => geo.tubeHalf * 0.28

/** Radius of a sleeve's rounded corners, px. */
const SHEATH_CORNER = 5

/** How thick the sheath is at a point on its own sleeve, px.
 *
 *  A rounded rectangle: flat along the top, with the two top corners turned by a
 *  small radius, and the ends dropping to the axon. Two wrong shapes preceded it,
 *  and the difference between them is worth keeping.
 *
 *  First a sine curve to a power, which tapers the whole way along — every sleeve
 *  a spindle and the row a line of spikes. Then a linear plateau, flat in the
 *  middle but chamfered over an eighth of its length at each end, which is a
 *  trapezium and looked like one. Neither has flat corners you could put a finger
 *  on.
 *
 *  This one is the shape a wrapped sleeve actually presents: uniform wraps along
 *  its length, the ends squared off where the lamellae stop, with the corners
 *  rounded because nothing biological has a right angle in it. */
function sheathHeight(fromEndPx: number, sleevePx: number, full: number): number {
  const corner = Math.min(SHEATH_CORNER, full, sleevePx / 2)
  if (fromEndPx >= corner) return full
  const inset = corner - Math.max(0, fromEndPx)
  return full - corner + Math.sqrt(Math.max(0, corner * corner - inset * inset))
}


/** The outer edge of the sheath at a point, `t` being how far along its own sleeve
 *  that point is, 0→1.
 *
 *  Exported so the anatomy can be asserted rather than eyeballed. Myelin is another
 *  cell wrapped ROUND the axon: it belongs between the axon's own membrane and the
 *  outside world, and never in the cytoplasm. The first version of this drawing put
 *  it inside — a sign error, invisible in the arithmetic and obvious the moment a
 *  person looked at it — so there is now a test. */
export function sheathOuterY(
  geo: RibbonGeometry,
  x: number,
  side: 1 | -1,
  fromEndPx: number,
  sleevePx: number,
): number {
  return wallY(geo, x, side) + side * sheathHeight(fromEndPx, sleevePx, SHEATH_THICK(geo))
}

function drawSheath(
  ctx: CanvasRenderingContext2D,
  geo: RibbonGeometry,
  run: FibreRun,
): void {
  if (!run.myelinated) return
  /** How wide a node gap is drawn, px.
   *
   *  Wide enough to hold what belongs in it: the node's pair of doors, which are
   *  the reason to look at a node at all. A true gap at this scale is a sixth of
   *  a pixel, so this is exaggerated whatever is chosen; the choice is between a
   *  gap too small to contain its own channels and one that shows them.
   *
   *  It went 5 → 2.5 chasing honesty and is now 15, which is a reversal worth
   *  stating. The earlier passes had nothing to fit in the gap, because the
   *  nodes' two doors were merged into a single mark — a leftover from when 43
   *  nodes sat 23 px apart. With 12 nodes and a proper pair at each, the gap has
   *  contents, and a gap that cannot contain its own contents is the worse lie.
   *  The describer owns up to the number. */
  const GAP = 15
  const wraps: Array<[number, number]> = []
  let from: number | null = null
  for (const part of run.parts) {
    const left = (part.x - part.lengthUm / 2) / VIEW_LENGTH_UM
    const right = (part.x + part.lengthUm / 2) / VIEW_LENGTH_UM
    if (part.excitable) {
      if (from !== null) wraps.push([from, left])
      from = null
    } else if (from === null) {
      from = left
    } else if (right >= 1) {
      wraps.push([from, right])
      from = null
    }
  }
  if (from !== null) wraps.push([from, 1])

  for (const [a, b] of wraps) {
    const x0 = xAt(geo, a) + GAP / 2
    const x1 = xAt(geo, b) - GAP / 2
    if (x1 - x0 < 1) continue
    for (const side of [-1, 1] as const) {
      // OUTSIDE the wall. Myelin is another cell wrapped round the axon, so it
      // sits between the axon's own membrane and the world — never inside the
      // cytoplasm, which is where this was drawn at first and where nothing but
      // axoplasm belongs.
      const out = (x: number) =>
        sheathOuterY(geo, x, side, Math.min(x - x0, x1 - x), x1 - x0)
      const midX = (x0 + x1) / 2
      const atWall = wallY(geo, midX, side)
      const g = ctx.createLinearGradient(0, atWall, 0, atWall + side * SHEATH_THICK(geo))
      g.addColorStop(0, SHEATH_MID)
      g.addColorStop(0.45, SHEATH_LIGHT)
      g.addColorStop(1, SHEATH_DARK)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(x0, wallY(geo, x0, side))
      for (let x = x0; x <= x1; x += 3) ctx.lineTo(x, wallY(geo, x, side))
      ctx.lineTo(x1, wallY(geo, x1, side))
      for (let x = x1; x >= x0; x -= 3) ctx.lineTo(x, out(x))
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = SHEATH_DARK
      ctx.lineWidth = 0.7
      ctx.stroke()
    }
  }
}

/** A sodium door and a potassium door on each wall of every stripe, open by
 *  exactly as much as that patch's gates are open.
 *
 *  This is where the lesson lives. The doors ahead of the wave are shut, the ones
 *  under it are wide open, and the ones behind it are shut again with potassium's
 *  still trailing — three different states on one screen at one instant, which no
 *  single travelling object could ever have. ONE of each per stripe, where a real
 *  stripe holds millions; the panel says so rather than leaving it to be
 *  assumed. */
function drawDoors(
  ctx: CanvasRenderingContext2D,
  geo: RibbonGeometry,
  run: FibreRun,
  u: number,
): void {
  const places = doorPlaces(run)
  // A node's pair is tighter and smaller than a bare axon's, so the few places that
  // do have channels read as CROWDED with them — which they are: a thousand-odd
  // per square micrometre against a hundred on bare membrane.
  const apart = run.myelinated ? 4 : 9
  const wide = run.myelinated ? 3.4 : 4.6
  for (const [n, p] of places.entries()) {
    // A bare axon's channels are not on a grid: they sit where they happen to
    // sit. Nodes are, so theirs do not budge.
    const spread = run.myelinated ? apart : apart * (0.55 + 0.75 * Math.abs(scatter(n + 91)))
    const na = Math.min(1, sampleFibre(run, 'naOpen', u, p))
    const k = Math.min(1, sampleFibre(run, 'kOpen', u, p))
    const cx = xAt(geo, p)
    for (const side of [-1, 1] as const) {
      miniDoor(ctx, cx - spread, wallY(geo, cx - spread, side), na, 'na', side, wide)
      miniDoor(ctx, cx + spread, wallY(geo, cx + spread, side), k, 'k', side, wide)
    }
  }
}

/** Deterministic scatter, −1 → +1. The same trick the bilayer's lipids use, and
 *  for the same reason: a perfectly even row reads as something manufactured, and
 *  neither a membrane nor the proteins in it are laid out on a grid. */
function scatter(i: number): number {
  const x = Math.sin(i * 127.1) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

/** Where along the axon the signal gets rebuilt, as fractions 0→1 — the door
 *  positions, and therefore the spark positions, because they are the same places.
 *
 *  On a myelinated fibre: the nodes, where the model put them, evenly spaced
 *  because internode length really is tightly regulated — and nowhere else.
 *
 *  On a bare axon: all the way down, and UNEVENLY. That irregularity is real,
 *  not decoration. Sodium channels in bare membrane sit essentially at random,
 *  scattered at whatever density the cell maintains, while a node's are held in an
 *  ordered array by a protein scaffold. So the honest contrast is not merely many
 *  against few: it is a random scatter against an organised cluster. */
export function doorPlaces(run: FibreRun): number[] {
  if (run.myelinated) {
    return run.parts
      .filter((part) => part.excitable)
      .map((part) => part.x / VIEW_LENGTH_UM)
  }
  const out: number[] = []
  for (let i = 0; ; i++) {
    const base = (i + 0.5) * DOOR_SPACING_UM
    if (base >= VIEW_LENGTH_UM) break
    const at = base + scatter(i) * DOOR_SPACING_UM * 0.36
    out.push(clamp(at / VIEW_LENGTH_UM, 0, 1))
  }
  return out.sort((a, b) => a - b)
}

/** The same protein the lens and the bench draw, at the size this scale allows:
 *  same silhouette, same palette, same pore that flares. */
function miniDoor(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  open: number,
  species: 'na' | 'k',
  side: 1 | -1,
  halfWidth = 4.6,
): void {
  const colour = GLOSSY_COLORS[species]
  drawGatedChannel(ctx, {
    cx,
    midY: y,
    open,
    mid: mix(CHANNEL_MID, colour.mid, 0.38),
    dark: mix(CHANNEL_DARK, colour.dark, 0.34),
    species: colour.mid,
    halfWidth,
    halfHeight: 4.2,
  })
  // Which way this ion is going while the door is open. An arrow, not a
  // particle: what crosses here is a current, and a drawn ball would be a claim
  // about one ion's path the model does not make.
  if (open <= 0.12) return
  const dir = species === 'na' ? -side : side
  const tip = y + dir * 12
  ctx.beginPath()
  ctx.moveTo(cx - 3, tip - dir * 3.5)
  ctx.lineTo(cx, tip)
  ctx.lineTo(cx + 3, tip - dir * 3.5)
  ctx.strokeStyle = colour.mid
  ctx.globalAlpha *= Math.min(1, open * 1.6)
  ctx.lineWidth = 1.6
  ctx.stroke()
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- the magnifier

/** Two circles: a small one sitting on the membrane, and a big one showing that
 *  spot enlarged until its molecules are visible.
 *
 *  A magnifying glass, in other words, which is a shape a child already knows how
 *  to read — and it makes the relationship between the two scales spatial rather
 *  than something to be worked out from two captions. The lens is drawn with
 *  stage/bilayer.ts, the same lipids and the same gated channel the balance bench
 *  uses, so this is not a picture resembling a membrane: it is the app's
 *  membrane. */
/** The node nearest a place, as a fraction along the fibre. */
export function nearestNode(run: FibreRun, p: number): number {
  let best = p
  let gap = Infinity
  for (const part of run.parts) {
    if (!part.excitable) continue
    const at = part.x / VIEW_LENGTH_UM
    const d = Math.abs(at - p)
    if (d < gap) {
      gap = d
      best = at
    }
  }
  return best
}

function drawMagnifier(
  ctx: CanvasRenderingContext2D,
  geo: RibbonGeometry,
  run: FibreRun,
  u: number,
  patch: number,
  heat: (p: number) => number,
): void {
  // On a myelinated fibre the glass goes to the nearest NODE rather than to the
  // middle of the stripe you clicked.
  //
  // Not a convenience. A node is 1 µm of a 141 µm repeat, so a stripe centre lands
  // on one about once in a hundred and forty tries — left free, the glass would
  // show sheathed membrane every time and a child could never once look at the
  // place where everything happens. What is under the sheath is said in words
  // instead: no voltage-gated channels at all, which is the point of it.
  const p = run.myelinated ? nearestNode(run, patchCentre(patch)) : patchCentre(patch)
  const spotX = xAt(geo, p)
  const spotY = wallY(geo, spotX, -1)
  const spotR = spotRadius(geo)
  const r = geo.lensR
  const cx = clamp(spotX, geo.left + r, geo.right - r)
  const cy = geo.lensCy
  const t = heat(p)

  // The cone between the two circles, drawn first so both rims sit over it.
  const dx = cx - spotX
  const dy = cy - spotY
  const d = Math.hypot(dx, dy) || 1
  const px = -dy / d
  const py = dx / d
  ctx.beginPath()
  ctx.moveTo(spotX + px * spotR, spotY + py * spotR)
  ctx.lineTo(cx + px * r, cy + py * r)
  ctx.moveTo(spotX - px * spotR, spotY - py * spotR)
  ctx.lineTo(cx - px * r, cy - py * r)
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)'
  ctx.lineWidth = 2.6
  ctx.setLineDash([7, 6])
  ctx.stroke()
  ctx.setLineDash([])

  // -------------------------------------------------------------- the lens
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()

  ctx.fillStyle = 'rgba(9, 11, 16, 0.98)'
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  ctx.fillStyle = 'rgba(100, 116, 139, 0.09)'
  ctx.fillRect(cx - r, cy - r, r * 2, r - HALF_MEM)
  ctx.fillStyle = `rgba(${chargeRamp(t)}, ${0.1 + 0.45 * Math.abs(t)})`
  ctx.fillRect(cx - r, cy + HALF_MEM, r * 2, r - HALF_MEM)

  // On a myelinated fibre the ring sits on a node, so the lens shows a node: the
  // doors crowded into the middle, and the ends of the two sleeves closing in from
  // either edge — which is what the small circle is sitting between. On a bare
  // axon the doors sit apart, as they do along the membrane.
  const spread = run.myelinated ? 0.2 : 0.42
  const naX = cx - r * spread
  const kX = cx + r * spread
  drawLipids(ctx, {
    midY: cy,
    from: cx - r,
    to: cx + r,
    gaps: [
      [naX - CHANNEL_HALF, naX + CHANNEL_HALF],
      [kX - CHANNEL_HALF, kX + CHANNEL_HALF],
    ],
  })
  if (run.myelinated) drawLensSleeves(ctx, cx, cy, r)

  const na = Math.min(1, sampleFibre(run, 'naOpen', u, p))
  const k = Math.min(1, sampleFibre(run, 'kOpen', u, p))
  for (const [dx0, open, kind] of [
    [naX, na, 'na'],
    [kX, k, 'k'],
  ] as Array<[number, number, 'na' | 'k']>) {
    const colour = GLOSSY_COLORS[kind]
    drawGatedChannel(ctx, {
      cx: dx0,
      midY: cy,
      open,
      mid: mix(CHANNEL_MID, colour.mid, 0.38),
      dark: mix(CHANNEL_DARK, colour.dark, 0.34),
      species: colour.mid,
    })
    drawTraffic(ctx, run, u, p, dx0, cy, open, kind)
  }

  // Where each species is crowded: sodium outside, potassium inside. The
  // gradient the whole spike spends, drawn rather than asserted.
  for (let i = 0; i < 8; i++) {
    const along = ((i * 37) % 100) / 100
    drawGlossyIon(ctx, 'na', cx - r + along * r * 2, cy - HALF_MEM - 12 - ((i * 29) % 3) * 11, 3.2, 0.8)
    drawGlossyIon(ctx, 'k', cx + r - along * r * 2, cy + HALF_MEM + 12 + ((i * 31) % 3) * 11, 3.2, 0.8)
  }
  ctx.restore()

  // The two rims. There was a curved highlight in here as well, meant to read as
  // glass — it read as a white arc lying across the membrane, belonging to nothing
  // in the picture. Everything inside this circle has to be the membrane or
  // something in it.
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = PICKED
  ctx.lineWidth = 3
  ctx.stroke()

  // A washed area as well as a rim: the ring is saying "this piece of membrane",
  // and a bare outline reads as a dot to look at rather than as a region taken.
  ctx.beginPath()
  ctx.arc(spotX, spotY, spotR, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(251, 191, 36, 0.1)'
  ctx.fill()
  ctx.strokeStyle = PICKED
  ctx.lineWidth = 2.6
  ctx.stroke()

  // No caption above the lens. Two lines of small print pressed between the
  // controls and the glass fought both of them, and everything they said — how
  // wide a spot this is, how much bigger it is drawn, where along the axon it
  // sits — is in the panel beside the canvas, in sentences, where a number of
  // that kind is actually readable.
}

/** Ions crossing, through a pore that is open, at the rate charge is actually
 *  crossing.
 *
 *  The position of every ion in the pore is `carried` — how much of this run's
 *  charge has gone through by now — and nothing else. Not a clock. That
 *  distinction is the whole value of drawing them: they set off when the door
 *  opens, they crowd through fastest at the moment the current is biggest, they
 *  stop dead the instant it shuts, and they never drift backwards through a
 *  membrane. A stream timed by a clock would do none of that.
 *
 *  `carried` is a share of this run rather than an amount, so the traffic shows
 *  the SHAPE of a current and not its size. The door is what keeps that honest:
 *  ions are only drawn through a pore that is actually open, so a run where
 *  nothing fires has no traffic at all rather than a trickle standing in for a
 *  spike. */
function drawTraffic(
  ctx: CanvasRenderingContext2D,
  run: FibreRun,
  u: number,
  p: number,
  cx: number,
  midY: number,
  open: number,
  kind: 'na' | 'k',
): void {
  if (open <= 0.05) return
  // Sodium falls in, potassium leaves. Both journeys start and end among the
  // crowd of their own species, so an ion is one of that pile setting off rather
  // than something appearing out of the water.
  const inward = kind === 'na'
  const reach = HALF_MEM + 34
  const from = midY + (inward ? -reach : reach)
  const to = midY + (inward ? reach : -reach)
  const done = sampleFibre(run, kind === 'na' ? 'naQ' : 'kQ', u, p)

  const IN_FLIGHT = 3
  for (let i = 0; i < IN_FLIGHT; i++) {
    const phase = (done / Q_PER_ION + i / IN_FLIGHT) % 1
    drawGlossyIon(
      ctx,
      kind,
      cx,
      from + (to - from) * phase,
      3.4,
      Math.min(1, open * 2.4),
    )
  }

  // Which way, for anyone who has paused. A moving queue shows its own direction;
  // a stopped one does not, and this view can be stopped anywhere.
  const dir = inward ? 1 : -1
  const tip = midY + dir * (HALF_MEM + 22)
  ctx.beginPath()
  ctx.moveTo(cx - 4, tip - dir * 4)
  ctx.lineTo(cx, tip)
  ctx.lineTo(cx + 4, tip - dir * 4)
  ctx.strokeStyle = GLOSSY_COLORS[kind].mid
  ctx.globalAlpha = Math.min(1, open * 2)
  ctx.lineWidth = 1.8
  ctx.stroke()
  ctx.globalAlpha = 1
}

/** The ends of the two sleeves, closing in from the lens's edges.
 *
 *  Each lamella runs in from the edge, then DIVES to the membrane and ends in a
 *  loop sitting on it — which is what the wraps really do at a paranode: the
 *  outermost lamella touches down nearest the node, the innermost farthest away,
 *  a row of loops on the axolemma. Drawn that way, the outer contour stays at
 *  full height and then turns down at the end — the same blunt rounded-corner
 *  silhouette as the sleeves outside the lens, and no accident: the shape of a
 *  sleeve's end IS its outermost wrap turning down.
 *
 *  The first version ended each lamella in mid-air where it stopped, which made
 *  the sleeve end an overhanging wedge — angles pointing outward, disagreeing
 *  with the axon's own barrels a centimetre away, and wrong: a wrap does not
 *  stop, it comes down and closes.
 *
 *  Still schematic in scale, and owned as such in the describer: a real node is a
 *  micrometre wide — twenty of these lenses — so the sleeve ends are pulled into
 *  frame to show what the ring sits between. */
function drawLensSleeves(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  const LAYERS = 5
  const STEP_Y = 3.2
  // ABOVE the membrane only, because above is where the outside of the cell is in
  // this lens and myelin is wrapped round the axon from outside. Below is
  // cytoplasm, and nothing but axoplasm belongs there.
  //
  // It was drawn on both sides, which put half the wraps inside the cell. The
  // mistake was copied in from the ribbon, where the axon is a tube seen from the
  // side and each of its two walls has sheath outside it — but the lens is one
  // patch of ONE wall, with outside above it and cytoplasm below, so there is only
  // one side for a sheath to be on.
  for (const edge of [-1, 1] as const) {
    // Innermost first, outermost last, so each dive is drawn over the wraps
    // beneath it — the way the outermost loop really crosses the others.
    for (let i = 0; i < LAYERS; i++) {
      // The INNERMOST wrap (i = 0) reaches closest to the node, and each one
      // outside it stops a little further back. That order is what makes a sheath
      // THIN towards a node instead of overhanging it: near the gap only the inner
      // layers are left, hugging the axon.
      //
      // It was the other way round here, which had the outer layers running on
      // past the inner ones — a shell standing off the axon with nothing beneath
      // it. The staircase pointed the wrong way.
      const reach = r * (0.34 + i * 0.07)
      const runY = cy - (HALF_MEM + 2 + i * STEP_Y)
      const downY = cy - (HALF_MEM + 1.6)
      const from = cx + edge * r
      const endX = cx + edge * reach
      const turnX = cx + edge * (reach + 6)
      ctx.strokeStyle = i % 2 === 0 ? SHEATH_LIGHT : SHEATH_MID
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(from, runY)
      ctx.lineTo(turnX, runY)
      // The dive: down across the wraps beneath, to the membrane.
      ctx.quadraticCurveTo(endX, runY, endX, downY)
      ctx.stroke()
      // The loop where it closes on the axolemma.
      ctx.fillStyle = SHEATH_DARK
      ctx.beginPath()
      ctx.arc(endX, downY, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/** Voltage against distance, at this instant. Not against time — that graph
 *  already exists at the membrane patch, and the whole point here is the other
 *  axis. */
function drawPlot(
  ctx: CanvasRenderingContext2D,
  geo: RibbonGeometry,
  run: FibreRun,
  u: number,
): void {
  const samples = 240
  const pts: Array<[number, number]> = []
  for (let i = 0; i <= samples; i++) {
    const p = i / samples
    pts.push([xAt(geo, p), plotY(geo, sampleFibre(run, 'vm', u, p))])
  }

  const restY = plotY(geo, run.rest)
  const zeroY = plotY(geo, 0)

  for (const [y, text, dash] of [
    [restY, `rest ${run.rest.toFixed(0)} mV`, [3, 3]],
    [zeroY, '0 mV', [2, 5]],
  ] as Array<[number, string, number[]]>) {
    ctx.beginPath()
    ctx.setLineDash(dash)
    ctx.moveTo(geo.left, y)
    ctx.lineTo(geo.right, y)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.setLineDash([])
    // Inside the plot, sitting on its own line. These two are the only words left
    // on the canvas apart from the ruler, and they stay because they are not
    // labels for the picture — they are the values of two specific heights on a
    // graph, and a graph whose axis has no numbers is a shape.
    ctx.fillStyle = FAINT
    ctx.textAlign = 'left'
    ctx.fillText(text, geo.left + 6, y - 8)
  }

  // Filled to the resting line and coloured by which side of it we are on, so
  // the blue tail behind the wave is as visible as the red crest.
  for (const sign of [1, -1] as const) {
    ctx.beginPath()
    ctx.moveTo(pts[0][0], restY)
    for (const [px, py] of pts) {
      ctx.lineTo(px, sign > 0 ? Math.min(py, restY) : Math.max(py, restY))
    }
    ctx.lineTo(pts[pts.length - 1][0], restY)
    ctx.closePath()
    ctx.fillStyle = `rgba(${chargeRamp(sign)}, 0.18)`
    ctx.fill()
  }

  ctx.beginPath()
  for (const [i, [px, py]] of pts.entries()) {
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.9)'
  ctx.lineWidth = 2
  ctx.stroke()

}

/** Millimetres of real axon — and, on the same scale, the whole axon drawn on the
 *  main stage. That tick is the honest half of this whole view. */
function drawRuler(
  ctx: CanvasRenderingContext2D,
  geo: RibbonGeometry,
  view: RibbonView,
  bare = false,
): void {
  const y = geo.rulerY
  ctx.beginPath()
  ctx.moveTo(geo.left, y)
  ctx.lineTo(geo.right, y)
  ctx.strokeStyle = FAINT
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.textAlign = 'center'
  for (const um of millimetreTicks()) {
    const x = xAt(geo, alongCable(um))
    ctx.beginPath()
    ctx.moveTo(x, y - 4)
    ctx.lineTo(x, y + 4)
    ctx.strokeStyle = FAINT
    ctx.stroke()
    ctx.fillStyle = LABEL
    ctx.fillText(`${um / 1000} mm`, x, y + 15)
  }

  if (bare) return
  const drawnX = xAt(geo, alongCable(view.drawnAxonUm))
  ctx.beginPath()
  ctx.moveTo(geo.left, y - 13)
  ctx.lineTo(drawnX, y - 13)
  ctx.strokeStyle = PICKED
  ctx.lineWidth = 4
  ctx.stroke()
}

/** Where the furthest patch to have crossed zero is. A read-out, not the
 *  drawing: nothing on this axon is positioned from it. */
function drawFront(
  ctx: CanvasRenderingContext2D,
  geo: RibbonGeometry,
  run: FibreRun,
  u: number,
): void {
  const front = fibreFront(run, u)
  if (front === null) return
  const x = xAt(geo, front)
  ctx.beginPath()
  ctx.setLineDash([4, 4])
  ctx.moveTo(x, geo.tubeTop - OUTSIDE_H)
  ctx.lineTo(x, geo.plotBottom)
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.5)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.setLineDash([])
}

