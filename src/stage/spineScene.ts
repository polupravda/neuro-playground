import { STAGE_H, STAGE_W } from './layout'
import {
  CLEFT_PX,
  CLOCK_LEGS,
  activeZone,
  MEM_PX,
  NECK_SIDE,
  SYNAPSE_SCREEN_MS,
  SYN_H,
  SYN_W,
  drawSynapse,
  faceAt,
  neckClimbPath,
  spineReceptorSeats,
  surfaceX,
  type SynapseGeometry,
  synapseGeometry,
  wallAt,
  type SynapseView,
} from './synapseScene'
import { spineReach, type SpineState } from '../core/spine'
import { drawAnswerMeter } from './answerMeter'
import type { SynapseRun } from '../core/synapse'
import type { CleftRun } from '../core/cleft'
import { sodiumCast } from './synapseCast'

// S13 — THE RECEIVING SPINE.
//
// ⚠ THIS MODULE DRAWS NOTHING. It is a CAMERA (user, 2026-09-12: "no, do not
// invent the view. use existing drawing").
//
// An earlier version imported the round trip's glyphs and composed its own
// picture out of them — its own geometry, its own walls, its own release, its
// own traffic. Reusing the pieces is not reusing the drawing: the composition
// IS the drawing, and a second composition of one synapse is a second drawing
// of it however many helpers it borrows.
//
// So this is the round trip's own `drawSynapse`, at the round trip's own
// geometry, seen through a transform that frames the spine. What differs
// between the two views is the CAMERA and the `spine` flag that adds this
// view's own machinery and leaves out the terminal's — and nothing else.
//
// It is still a view OF ITS OWN rather than a framing of the synapse (the
// user's 2026-09-11 ruling: "it represents a different neuron and a different
// concept"): its own zoom target, its own layer, its own model, its own doors.
// A separate view is about what the child is being shown; one drawing is about
// what the app believes a synapse looks like. The two are not in conflict.

/** How much of the frame below the chrome the spine head is to fill. The
 *  requirement, used as the input the magnification is solved from. */
/** ⚠ ZOOMED IN SO THREE QUARTERS OF THE OLD WIDTH IS IN FRAME (user,
 *  2026-09-12: "zoom in, so that 3 / 4 of current width is in the view") — so
 *  the magnification goes up by four thirds, and the head's share of the height
 *  follows it. Written as the old share TIMES the zoom, rather than as the
 *  product typed out, so the change is legible and reversible. */
export const SPINE_ZOOM = 4 / 3
export const SPINE_SHARE = 0.62 * SPINE_ZOOM

/** ⚠ THE GUTTER THE CLIMBING RECEPTOR'S PATH IS GIVEN on the framed side. */
export const SPINE_LEFT_MARGIN = 44

/** ⚠ THE TIMELINE'S OWN HEIGHT, counted off its markup rather than guessed:
 *  `top-3` (12) + `p-1.5` (6) + `h-[38px]` + `p-1.5` (6) — and, since
 *  2026-09-13, the action row that flows under it: `mt-2` (8) + `h-[38px]`,
 *  because the ⚡/▶ plate moved up here from the foot to match the synapse
 *  view's own layout. More chrome is paid for in magnification; see
 *  `solveSpineTop`. */
export const SPINE_CHROME_PX = 62 + 8 + 38
/** …and the clear air under it. */
export const SPINE_CHROME_GAP = 10

/** ⚠ THE TIMELINE'S ROOM — SOLVED, not chosen (user, 2026-09-13: "add timeline,
 *  shift the whole view down, so the timeline does not cover vesicle release").
 *
 *  The constant was 104, which was room for the MEMBRANE and nothing else. A
 *  docked vesicle is not on the wall, it is above it: MEASURED at the old
 *  framing the middle one's top sat at y = −69, sixty-nine pixels off the top of
 *  the picture, and everything of it that was on screen was behind the bar.
 *
 *  So the requirement is the vesicle's, and the number falls out of it. The
 *  catch is that the two are coupled — pushing the wall down shrinks the
 *  picture, which shrinks the vesicle — so it is solved rather than nudged:
 *
 *      TOP − rise·k(TOP) = CHROME + GAP,  k(TOP) = SHARE·(H − TOP) / 2·ry
 *
 *  ⚠ AND THE MAGNIFICATION IS WHAT PAYS. `SPINE_SHARE` is untouched: the head
 *  still fills the share of the frame it was asked to. There is simply less
 *  frame, so `k` falls with it — you cannot have more chrome and the same
 *  absolute zoom, and this is which of the two gives. */
/** Never more of the frame than this, whatever the solve asks for. */
export const SPINE_TOP_CAP = 0.45

/** ⚠ WHICH BUBBLES THE ROOM IS BOUGHT FOR — the ones over the middle of the
 *  active zone, which are the ones this run actually opens.
 *
 *  ⚠ NOT ALL OF THEM. The bouton's floor is a curve and it rises steeply past
 *  the zone's ends: the outermost docked bubble stands 166px above the wall
 *  against the middle one's 56, and buying clearance for it walked the whole
 *  picture down past the cap without converging. ⚠ AND NOT `≤ 0.5` EITHER —
 *  the slots either side of the middle sit at EXACTLY half the active zone, so
 *  that bound excluded them by a rounding error and the room came out 30px
 *  short. The guard asks the run which bubbles fuse, so the two cannot drift. */
export const SPINE_WATCHED = 0.75

export function solveSpineTop(height = STAGE_H): number {
  const g = synapseGeometry(SYN_W, SYN_H)
  // ⚠ MEASURED AGAINST THE WALL THE CAMERA IS ANCHORED TO. Against each
  // bubble's OWN wall the number ignores the bouton's slope, and the answer
  // came out 69px too small.
  const anchor = wallAt(g, g.head.cx)
  const rise = Math.max(
    ...activeZone(g)
      .docked.filter((d) => Math.abs(d.x - g.head.cx) < g.activeHalf * SPINE_WATCHED)
      .map((d) => anchor - (d.y - d.r)),
  )
  const a = (SPINE_SHARE * rise) / (2 * g.head.ry)
  const solved = (SPINE_CHROME_PX + SPINE_CHROME_GAP + a * height) / (1 + a)
  return Math.min(height * SPINE_TOP_CAP, solved)
}
export const SPINE_TOP = solveSpineTop()


/** ⚠ THE CAMERA, SOLVED FROM THREE REQUIREMENTS — not chosen.
 *
 *  The head must fill `SPINE_SHARE` of the frame below the chrome, which fixes
 *  the magnification; the presynaptic wall must land at `SPINE_TOP`, which
 *  fixes where the picture sits vertically; and — the third, new one (user,
 *  2026-09-13: "let's shift camera so that the left side of the spine is in
 *  view. So we can follow the membrane and channel's path") — the whole of the
 *  route a delivered receptor takes along the wall must be ON SCREEN.
 *
 *  ⚠ SO THE FRAME IS NO LONGER CENTRED, and it cannot be. Measured at this
 *  magnification the head spans 1567px of a 1060px stage: BOTH flanks were off
 *  the picture, and the receptor climbing the left one rounded the cap's
 *  underside 253px outside the frame. One flank can be watched or neither.
 *  This one watches the left, and the right one is simply out of shot — which
 *  is what a camera does, and needs no apology in the drawing.
 *
 *  All three are read off the round trip's own geometry, so if that picture
 *  changes this camera follows it. */
const CAMERA_CACHE = new Map<string, { k: number; dx: number; dy: number }>()

export function spineCamera(
  _width = STAGE_W,
  height = STAGE_H,
): { k: number; dx: number; dy: number } {
  // ⚠ MEMOISED: solving it now walks the climb's route, and this is asked once
  // per frame by the draw and again by everything that measures the framing.
  const key = `${_width},${height}`
  const hit = CAMERA_CACHE.get(key)
  if (hit) return hit
  const g = synapseGeometry(SYN_W, SYN_H)
  const k = (SPINE_SHARE * (height - SPINE_TOP)) / (2 * g.head.ry)
  const wall = wallAt(g, g.head.cx)
  // ⚠ ASKED OF THE PATH ITSELF, never of a number that happens to match it: the
  // route is `neckClimbPath`'s, so a change to the outline moves the camera
  // with it instead of quietly pushing the journey off the edge again.
  const path = neckClimbPath(g, NECK_SIDE, surfaceX(g, NECK_SIDE), SYN_H)
  // …and the protein standing in that wall sticks out of it, so the gutter is
  // measured to the OUTSIDE of the receptor, not to the membrane's centreline.
  const outermost = Math.min(...path.map((p) => p.x)) - MEM_PX * 2.6
  const cam = {
    k,
    dx: SPINE_LEFT_MARGIN - outermost * k,
    // …and the presynaptic wall to just under the chrome.
    dy: SPINE_TOP - wall * k,
  }
  CAMERA_CACHE.set(key, cam)
  return cam
}

// ── THIS VIEW'S OWN CLOCK ───────────────────────────────────────────────────
//
// ⚠ THE ANIMATION STARTS AT THE RELEASE (user, 2026-09-13: "This view starts
// with NT release (all release preceding actions are not present in the
// animation)"). The round trip's run is sixty model milliseconds and it earns
// every one of them — the spike arriving, the calcium doors, the sensors, then
// the long glutamate–glutamine loop home through the astrocyte. NONE of that is
// this view's subject, and two pieces of it are not even drawn here: the
// calcium doors were taken out on 2026-09-12 and the astrocyte with them.
//
// A clock that plays stretches of a run whose actors are absent is a clock
// spending screen time on an empty stage. So this view keeps the window from
// the first vesicle opening to the gap being cleared, and the shares INSIDE it
// are the round trip's own — every leg keeps the absolute screen time it was
// tuned to, exactly as `CLOCK_WEIGHT` does for the run itself.

/** The first vesicle opens. Before it: the spike and the calcium — not here. */
export const SPINE_FROM_MS = 2.56
/** The gap is cleared. After it: the loop home, which needs the astrocyte this
 *  view does not draw — and ink for a journey whose destination is off the page
 *  is a journey nobody can follow. */
export const SPINE_TO_MS = 30

/** The round trip's own legs, those inside this view's window. */
export const SPINE_LEGS = CLOCK_LEGS.filter(
  (l) => l.from >= SPINE_FROM_MS / 60 - 1e-9 && l.to <= SPINE_TO_MS / 60 + 1e-9,
)
const SPINE_WEIGHT = SPINE_LEGS.reduce((sum, l) => sum + l.share, 0)

/** How long this view's release takes on screen — the kept legs' own time,
 *  never a number of its own. */
export const SPINE_SCREEN_MS = Math.round(SYNAPSE_SCREEN_MS * SPINE_WEIGHT)

/** ⚠ WHERE THE DRAWN SYNAPSE SITS, and it is no longer the middle of the active
 *  zone (user, 2026-09-13: "Move them to the left along the membrane, so that
 *  they appear centered in relation to the screen").
 *
 *  ⚠ AND THIS IS A REAL COST, said plainly. The camera cannot do it: MEASURED,
 *  the head is wider than the stage, so a frame holding the left flank cannot
 *  also centre the zone's middle — the two are 337px apart and no offset gives
 *  both. What moves instead is the DENSITY, to a place on the face that lands
 *  in the middle of the picture.
 *
 *  ⚠ IT MAY NOT LEAVE THE ACTIVE ZONE. A postsynaptic density opposite no
 *  release site is not a synapse, so the answer is clamped to the zone and the
 *  guard asks for that. Inside it, an off-centre density is ordinary anatomy:
 *  the zone is a stretch of apposed membrane, not a point. */
/** ⚠ THIS VIEW'S GEOMETRY — the round trip's, carrying the receptors this
 *  framing actually draws, so everything keyed to a receptor (the transmitter's
 *  fates, the seat windows, the sodium, the timeline's dated moments) is keyed
 *  to the ones on the page. `drawSynapse` builds the same thing from `spine`
 *  and `densityX`; this is how anything OUTSIDE the drawing asks for it. */
export function spineGeometry(
  ampa: number,
  width = STAGE_W,
  height = STAGE_H,
): SynapseGeometry {
  const g = synapseGeometry(SYN_W, SYN_H)
  const seats = spineReceptorSeats(g, ampa, spineDensityX(width, height))
  // ⚠ AND THE LAST SEAT IS THE SLOW ONE — the NMDA, whose glutamate stays put.
  // `drawSynapse` composes the same thing from `spine` and `densityX`; if these
  // two ever disagree the cast and the picture are keyed to different rows.
  return { ...g, seats, slowSeat: seats.length - 1 }
}

export function spineDensityX(width = STAGE_W, height = STAGE_H): number {
  const g = synapseGeometry(SYN_W, SYN_H)
  const { k, dx } = spineCamera(width, height)
  const want = (width / 2 - dx) / k
  const edge = g.activeHalf * 0.55
  return Math.max(g.head.cx - edge, Math.min(g.head.cx + edge, want))
}

/** ⚠ WHEN THE DRAWN SODIUM GETS INSIDE, in screen ms from the run's start —
 *  MEASURED off the cast, never typed, so it follows the clock and the legs.
 *  This is the lag the receiving cell's own model is given, so its answer plays
 *  when its cause is on the page. See `spineFire`. */
export function spineNaLagMs(run: SynapseRun, cleft: CleftRun, ampa: number): number {
  const g = spineGeometry(ampa)
  // ⚠ "INSIDE" IS BELOW THE WALL, not the cast's own `where` tag. That tag turns
  // over only once an ion has finished SETTLING, a millisecond and a half after
  // it is visibly through the membrane — measured, tagged at 15.3 model ms
  // against a crossing at 14.4. The child's answer is "when did it get in", and
  // getting in is crossing the wall.
  const inside = (u: number) =>
    sodiumCast(g, run, cleft, spineClock(u) * run.windowMs, 0).some(
      (d) => d.y > faceAt(g, d.x) + MEM_PX,
    )
  // ⚠ FOUND BY BISECTION, not by a scan (21c-69, user: "redness still is
  // happening too late. Expected start: 15.1 ms"). A 240-step sweep steps 63ms
  // of screen at a time, which is a quarter of a model millisecond where this
  // falls — so the answer came back as the first SAMPLE after the crossing
  // rather than the crossing, and landed at 15.35 against a true 15.1. The
  // user's eye was reading the moment more precisely than the probe was.
  let lo = 0
  let hi = 1
  for (let i = 0; i <= 60; i++) {
    const u = i / 60
    if (inside(u)) {
      hi = u
      break
    }
    lo = u
  }
  if (!inside(hi)) return 0
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (inside(mid)) hi = mid
    else lo = mid
  }
  return hi * SPINE_SCREEN_MS
}

/** Screen position 0→1 ← the run's MODEL position: the inverse of `spineClock`,
 *  for placing the timeline's event dots on this view's own bar. */
export function spineScreenOfModel(modelU: number): number {
  const m = Math.max(SPINE_FROM_MS / 60, Math.min(SPINE_TO_MS / 60, modelU))
  let acc = 0
  for (const leg of SPINE_LEGS) {
    if (m <= leg.to) {
      const t = Math.max(0, Math.min(1, (m - leg.from) / Math.max(1e-9, leg.to - leg.from)))
      return Math.max(0, Math.min(1, (acc + t * leg.share) / SPINE_WEIGHT))
    }
    acc += leg.share
  }
  return 1
}

/** Screen position 0→1 → the run's MODEL position, over this view's window
 *  only. The same shape as `synapseClock`, over fewer legs. */
export function spineClock(screenU: number): number {
  let at = Math.max(0, Math.min(1, screenU)) * SPINE_WEIGHT
  for (const [i, leg] of SPINE_LEGS.entries()) {
    if (at <= leg.share || i === SPINE_LEGS.length - 1) {
      const t = Math.max(0, Math.min(1, at / Math.max(1e-9, leg.share)))
      return leg.from + (leg.to - leg.from) * t
    }
    at -= leg.share
  }
  return SPINE_TO_MS / 60
}

/** Where the two membranes land on screen, so a guard can ask. */
export function spineLanding(width = STAGE_W, height = STAGE_H) {
  const g = synapseGeometry(SYN_W, SYN_H)
  const { k, dx, dy } = spineCamera(width, height)
  const face = faceAt(g, g.head.cx)
  return {
    k,
    wallY: dy + wallAt(g, g.head.cx) * k,
    faceY: dy + face * k,
    headBottomY: dy + (face + 2 * g.head.ry) * k,
    shaftTopY: dy + g.shaftTop * k,
    headLeftX: dx + (g.head.cx - g.head.rx) * k,
    headRightX: dx + (g.head.cx + g.head.rx) * k,
    cleftPx: CLEFT_PX * k,
  }
}

export interface SpineView extends Omit<SynapseView, 'width' | 'height' | 'spine'> {
  spine: SpineState
  /** ⚠ HOW FAR THE TERMINAL HAS RESTOCKED — handed down, because the story
   *  knows and the drawing must not guess. */
  restock?: number | null
  /** ⚠ THE MARK THE FIRST MESSAGE LEFT — where act one's answer reached, so act
   *  six's can be seen to go past it. Absent until there is something to
   *  compare against. */
  mark?: number | null
  width?: number
  height?: number
}

/** The round trip's picture, framed on the spine. */
export function drawSpine(ctx: CanvasRenderingContext2D, v: SpineView): void {
  const fade = v.fade ?? 1
  if (fade <= 0.002) return
  const width = v.width ?? STAGE_W
  const height = v.height ?? STAGE_H
  const { k, dx, dy } = spineCamera(width, height)
  ctx.save()
  ctx.translate(dx, dy)
  ctx.scale(k, k)
  drawSynapse(ctx, {
    ...v,
    width: SYN_W,
    height: SYN_H,
    // ⚠ WHERE THIS FRAMING PUTS ITS SYNAPSE — handed DOWN, because it is solved
    // from the camera and the camera lives here. The drawing must not work it
    // out for itself or there would be two answers.
    densityX: spineDensityX(width, height),
    // ⚠ THE CHROME DISSOLVES, as it does on the dive to the active zone: labels
    // and captions drawn at this magnification would be giant, and the wall's
    // backing band has to give way to its molecules.
    chrome: 0,
    spine: v.spine,
  })
  ctx.restore()
  // ⚠ OUTSIDE THE CAMERA, deliberately: the meter is an instrument, not a thing
  // in the cell, so it must not grow with the magnification.
  drawAnswerMeter(ctx, spineReach(v.spine), v.mark, width, height, fade)
}
