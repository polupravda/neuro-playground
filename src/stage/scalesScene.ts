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
import { INPUTS, STAGE_H, STAGE_W } from './layout'
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

/** ⚠ The drawn size, fitted to BOTH sides of the room it has (2026-08-28).
 *
 *  The exhibit draws at the scene's own size and is scaled by CSS. Scaling to
 *  the available WIDTH alone cropped the bottom off, because once the control
 *  row has taken its share the room left is taller-limited than wide-limited.
 *  Fit is the smaller of the two ratios, and the result is centred. */
export const SC_FIT = (() => {
  const k = Math.min(SC_W / STAGE_W, SC_H / STAGE_H)
  return { k, w: Math.round(STAGE_W * k), h: Math.round(STAGE_H * k) }
})()

/** The three sizes, in the order the course meets them. Names come from the
 *  one place they are written down. */
export const SCALES = TOUR_STOPS.map((s, i) => ({ i, id: s.id, title: s.title, watch: s.watch }))
export type ScaleId = (typeof TOUR_STOPS)[number]['id']

/** The exhibit draws at the SCENE'S OWN SIZE and is scaled down by CSS, so
 *  every one of the three pictures is literally the picture that view draws —
 *  same camera arithmetic, same scene function, same ribbon. */
export const SC_STAGE_W = STAGE_W
export const SC_STAGE_H = STAGE_H

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
    chain: which === 2 && u !== null ? chainStateAt(u * runDuration(INPUTS.length), INPUTS.length) : IDLE,
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
