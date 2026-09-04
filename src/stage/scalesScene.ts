import type { IonCounts } from '../state/ionStore'
import type { FibreRun } from '../core/fibre'
import { ION_KINDS, type IonKind } from '../core/ions'
import { TOUR_STOPS } from '../core/tour'
import { sampleAt, type Trajectory } from '../core/spikeModel'
import { drawRibbon } from './axonRibbon'
import { drawScene } from './drawScene'
import { cameraFor, viewRect } from './camera'
import { chainStateAt, runDuration, IDLE } from './chain'
import { ionCloud, type IonInstance } from './ions'
import { membraneProteins, type ProteinInstance } from './proteins'
import { INPUTS, SCENE_INK_Y, STAGE_H, STAGE_W } from './layout'
import { AXON_W, AXON_VIEW_SCALE, DRAWN_AXON_UM } from './layout'
import { AXON_DIAMETER_UM } from '../core/membrane'
import { drawSpoken, type SpokenLabel } from './spokenLabels'

// ONE SIGNAL, THREE SIZES — as an exhibit that draws its own three views.
//
// This is the third shape this idea has had, and the reasoning is worth
// keeping. It began as a guided tour: a button in the column that marched a
// child through a patch, the whole axon and the whole cell, flying the main
// camera and pressing things on arrival. Then it became a switch on the main
// canvas, doing the same driving. Both had the same flaw underneath — the
// thing was a REMOTE CONTROL for the scene, so it could not be an exhibit
// without covering what it was controlling.
//
// So it stopped being a remote control. The drawer draws all three views
// ITSELF, from one clock, and never touches the main scene — which means the
// "a drawer covers the world" objection simply does not arise: there is
// nothing behind it that needs seeing (user, 2026-08-28).
//
// The three pictures are drawn with the app's own functions — the same
// lipids, the same gate, the same ribbon, the same little neuron every other
// view uses — so this is one biology at three magnifications rather than a
// fourth drawing of it.

const VIEW_W = typeof window !== 'undefined' ? window.innerWidth : 1440
const VIEW_H = typeof window !== 'undefined' ? window.innerHeight : 860
const DRAWER_W = Math.min(VIEW_W, 1376)
const CONTENT_W = Math.max(660, DRAWER_W - 40 - 256 - 24 - 12)
const CONTENT_H = Math.max(520, VIEW_H - 48 - 8)

export const SC_CONTROLS_H = 42 + 12
export const SC_W = Math.round(CONTENT_W - 20)
export const SC_H = Math.round(CONTENT_H - SC_CONTROLS_H - 22)
export const SC_BUDGET = CONTENT_H

/** ⚠ THE EXHIBIT FILLS THE WIDTH, and proves what it trimmed to do it
 *  (user, 2026-09-04: "stretch canvas to take all available space
 *  horizontally").
 *
 *  The exhibit draws the scene at its own size and is scaled by CSS. `STAGE_H`
 *  follows the browser WINDOW while this drawer's room does not, so on a tall
 *  screen the scene is the taller shape of the two, fitting by both sides
 *  becomes height-bound, and a band of the panel goes unused at the right.
 *
 *  ⚠ THE 2026-08-28 REPORT THIS MUST NOT REPEAT: fitting by width alone
 *  "cropped the bottom off". The fault was not the fitting — it was that
 *  nothing measured where the scene's ink ENDED, so the crop ate the cell. A
 *  tall window's extra height is MARGIN (see `SCENE_INK_Y`), so the width is
 *  filled by trimming that margin symmetrically, and only while the trim
 *  provably stays inside it. When it would not, the old both-sides fit is
 *  what happens — the picture stays whole and the slack comes back.
 *
 *  `cropScene` is how much scene is trimmed from EACH end, in scene units. */
/** ⚠ THE FIT, as a function of the two shapes — so it can be asked directly
 *  at rooms and scenes this machine does not happen to have (03 → *Ask the
 *  DECISION, not the ink*). The module-level `SC_FIT` is this, called once.
 *
 *  `ink` is the scene's own top and bottom (see `SCENE_INK_Y`): the trim may
 *  eat the margin outside it and nothing else. */
export function fitScene(
  roomW: number,
  roomH: number,
  sceneW: number,
  sceneH: number,
  ink: { min: number; max: number },
): { k: number; w: number; h: number; cropScene: number } {
  const kw = roomW / sceneW
  const kh = roomH / sceneH
  if (kw <= kh) {
    // Width already binds: the whole scene fits, nothing is trimmed.
    return { k: kw, w: Math.round(sceneW * kw), h: Math.round(sceneH * kw), cropScene: 0 }
  }
  const half = (sceneH - roomH / kw) / 2
  const marginTop = ink.min
  const marginBottom = sceneH - ink.max
  if (half <= marginTop && half <= marginBottom) {
    return { k: kw, w: Math.round(sceneW * kw), h: Math.round(roomH), cropScene: half }
  }
  // The trim would reach the picture. Keep the picture whole and give the
  // slack back — this is the 2026-08-28 behaviour, and it is the fallback,
  // not the rule.
  return { k: kh, w: Math.round(sceneW * kh), h: Math.round(sceneH * kh), cropScene: 0 }
}

export const SC_FIT = fitScene(SC_W, SC_H, STAGE_W, STAGE_H, SCENE_INK_Y)

/** The three sizes, in the order the course meets them. Names come from the
 *  one place they are written down. */
export const SCALES = TOUR_STOPS.map((s, i) => ({
  i,
  id: s.id,
  title: s.title,
  watch: s.watch,
}))
export type ScaleId = (typeof TOUR_STOPS)[number]['id']

/** The exhibit draws at the SCENE'S OWN SIZE and is scaled down by CSS, so
 *  every one of the three pictures is literally the picture that view draws —
 *  same camera arithmetic, same scene function, same ribbon. */
export const SC_STAGE_W = STAGE_W
export const SC_STAGE_H = STAGE_H

/** The canvas's own height in SCENE units — the room's shape at the scene's
 *  width, so CSS scaling never distorts. */
export const SC_CANVAS_H = Math.round(STAGE_H - SC_FIT.cropScene * 2)

/** The zoom target each size is a view of. Two of them are real places on the
 *  cell; the whole neuron is the camera pulled all the way out, which is the
 *  home screen. */
const AT: (string | null)[] = ['axon-membrane', 'axon-signal', null]

export interface ScaleBits {
  traj: Trajectory
  run: FibreRun
  counts: IonCounts
  leaksOn: boolean
  pumpOn: boolean
  ions: Record<'outside' | 'inside', IonInstance[]>
  proteins: ProteinInstance[]
  trace: number[]
  vmRest: number
}

/** The real scene, at one of its real cameras.
 *
 *  ⚠ NOTHING HERE IS A NEW PICTURE (user, 2026-08-28). The first version of
 *  this exhibit hand-composed a membrane out of lipids and gates, and used the
 *  little map for the whole cell — two fresh drawings of things the app
 *  already draws, which is exactly the fault "one biology, one drawing" names.
 *  It calls `drawScene` now, through the same `cameraFor`/`viewRect` the stage
 *  uses, so the close view IS the axon-membrane zoom and the wide view IS the
 *  home screen. */
function drawSceneAt(
  ctx: CanvasRenderingContext2D,
  which: number,
  bits: ScaleBits,
  u: number | null,
  timeMs: number,
): void {
  const camera = cameraFor(AT[which])
  const spiking = which === 0 && u !== null
  const vm = spiking ? sampleAt(bits.traj, 'vm', u) : bits.vmRest
  const gNa = spiking ? sampleAt(bits.traj, 'gNa', u) : 0
  const gK = spiking ? sampleAt(bits.traj, 'gK', u) : 0

  ctx.save()
  ctx.translate(SC_STAGE_W / 2, SC_STAGE_H / 2 + camera.drop)
  ctx.scale(camera.scale, camera.scale)
  ctx.rotate(-camera.angle)
  ctx.translate(-camera.center.x, -camera.center.y)
  drawScene(ctx, {
    selected: null,
    hovered: null,
    hoveredInput: null,
    hoveredMarker: null,
    // The whole cell's view shows the chain, so it needs the inputs that fired.
    firedInputs: which === 2 && u !== null ? INPUTS.map((i) => i.id) : [],
    chain:
      which === 2 && u !== null
        ? chainStateAt(u * runDuration(INPUTS.length), INPUTS.length)
        : IDLE,
    cameraScale: camera.scale,
    showMarkers: false,
    view: viewRect(camera),
    ions: bits.ions,
    highlighted: ALL_IN_COLOUR,
    proteins: bits.proteins,
    pumpOn: bits.pumpOn,
    leaksOn: bits.leaksOn,
    gateEnv: { ap: spiking ? { na: gNa, k: gK } : null, transmitter: false },
    counts: bits.counts,
    vm,
    apTrace: bits.trace,
    apU: spiking ? u : null,
    gateFlash: null,
    emphasis: null,
    vmRest: bits.vmRest,
    timeMs,
  })
  ctx.restore()
}

const ALL_IN_COLOUR = ION_KINDS.reduce(
  (acc, kind) => {
    acc[kind] = true
    return acc
  },
  {} as Record<IonKind, boolean>,
)

export function scaleLabels(_which: number): SpokenLabel[] {
  // The scene names its own parts, at every one of these cameras. A second set
  // of names laid over it would be the same fault as a second drawing.
  return []
}

/** THE WHOLE AXON — the same ribbon the propagation view draws. */
function drawAxonScale(
  ctx: CanvasRenderingContext2D,
  run: FibreRun,
  counts: IonCounts,
  u: number | null,
): void {
  drawRibbon(ctx, {
    width: SC_STAGE_W,
    height: SC_STAGE_H,
    axonPx: AXON_W * AXON_VIEW_SCALE,
    axonUm: AXON_DIAMETER_UM,
    run,
    u: u ?? 0,
    counts,
    patch: 0,
    drawnAxonUm: DRAWN_AXON_UM,
    fade: 1,
  })
}

export function drawScale(
  ctx: CanvasRenderingContext2D,
  which: number,
  bits: ScaleBits,
  u: number | null,
  timeMs = 0,
): void {
  // The axon keeps its own drawing — the ribbon IS a view of the scene at
  // that camera, and it is what the propagation view puts there. The other
  // two go through the scene function at their own cameras.
  if (which === 1) drawAxonScale(ctx, bits.run, bits.counts, u)
  else drawSceneAt(ctx, which, bits, u, timeMs)
  for (const l of scaleLabels(which)) drawSpoken(ctx, l)
}

/** Everything the exhibit needs that does not change from frame to frame,
 *  built from the same functions the stage builds it from. */
export function scaleBits(
  counts: IonCounts,
  leaksOn: boolean,
  pumpOn: boolean,
  traj: Trajectory,
  run: FibreRun,
  trace: number[],
  vmRest: number,
): ScaleBits {
  return {
    traj,
    run,
    counts,
    leaksOn,
    pumpOn,
    ions: { outside: ionCloud(counts, 'outside'), inside: ionCloud(counts, 'inside') },
    proteins: membraneProteins(),
    trace,
    vmRest,
  }
}
