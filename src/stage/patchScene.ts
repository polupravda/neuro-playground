import {
  PATCH_WINDOW_MS,
  dwells,
  openAt,
  ionsInFlight,
  unitaryPa,
} from '../core/patchClamp'
import {
  CHANNEL_DARK,
  CHANNEL_MID,
  drawGatedChannel,
  drawLipids,
  HALF_MEM,
  mix,
  PX_PER_NM,
} from './bilayer'
import {
  GLOSSY_COLORS,
  chargeWash,
  drawGlossyIon,
  drawIonCharge,
  polarityT,
  badgeMinR,
} from './particleStyle'
import { IONS } from '../core/ions'
import { spoken, drawSpoken, type SpokenLabel } from './spokenLabels'

// D13 — the patch clamp. Two halves, and the whole point is that they are the
// same thing seen twice: on the left the apparatus, a glass tip sealed onto a
// scrap of wall with one channel in it; on the right what that scrap of wall
// actually says, in square steps.
//
// The trace is drawn from the model's own dwell records, never from a smoothed
// curve — including the whole-cell line, which is a genuine sum. An exhibit
// whose claim is "the smooth line is really thousands of blips" cannot draw
// the smooth line any other way.

const VIEW_W = typeof window !== 'undefined' ? window.innerWidth : 1440
const VIEW_H = typeof window !== 'undefined' ? window.innerHeight : 860
const DRAWER_W = Math.min(VIEW_W, 1376)
const CONTENT_W = Math.max(660, DRAWER_W - 40 - 256 - 24 - 12)
const CONTENT_H = Math.max(520, VIEW_H - 48 - 8)

/** The controls sit in their own row above, so the canvases are measured
 *  around it — the lesson the channel bench's size key taught. */
export const PC_CONTROLS_H = 42 + 12
export const PC_W = Math.round(CONTENT_W - 20)
export const PC_H = Math.round(CONTENT_H - PC_CONTROLS_H - 22)
export const PC_BUDGET = CONTENT_H

/** THE RIG IS THE VIEW; the recording is a strip under it.
 *
 *  The trace used to have most of the canvas and the apparatus a narrow
 *  column. It is the other way round now (user, 2026-08-28): what a child
 *  watches is a door opening and ions going through it, and the trace is the
 *  grown-up's way of reading the same thing — "for adults who help kids to
 *  interpret" — so it is kept, and kept small. */
export const STRIP_H = 96
export const RIG_H = PC_H - STRIP_H - 10
export const TRACE_X = 58
export const TRACE_W = PC_W - TRACE_X - 18

const LABEL = '#cbd5e1'
const GRID = 'rgba(148, 163, 184, 0.16)'
const GLASS = 'rgba(186, 230, 253, 0.35)'
const TRACE = '#fbbf24'

// ONE CHANNEL, DISPLAYED AND REPORTED (user, 2026-08-28).
//
// There were three modes here — one channel, four with their total, and all
// five thousand added up — and the sum was the exhibit's intended punchline.
// It went, and the reason is worth keeping: a summed trace is a graph about a
// graph, and it told a child nothing they could see. What is left is one door
// and one record of that door, which is what a patch clamp actually is.
//
// The "thousands of these add up to the smooth curve" idea survives as a
// sentence in the describer, where a sentence is the honest form for it, and
// can come back when there is a picture worth drawing for it.

/** Samples across the window. One per pixel-ish: fine enough that a half-
 *  millisecond flicker is a mark rather than nothing. */
export const SAMPLES = 600

export const xAtMs = (ms: number): number =>
  TRACE_X + (Math.max(0, Math.min(PATCH_WINDOW_MS, ms)) / PATCH_WINDOW_MS) * TRACE_W

export function patchLabels(): SpokenLabel[] {
  return [
    spoken('patch pipette', 36, 24),
    spoken('seal', PC_W - 36, RIG_H * 0.66 - 26, 'right'),
    spoken('potassium', 36, RIG_H - 18),
  ]
}

/** The apparatus, and the thing worth watching: a glass tip sealed onto a
 *  scrap of wall with one channel in it, the cell's own charge tint below,
 *  and — while the door is open — potassium going through it and up the
 *  pipette, which is exactly where a real recording collects it. */
function drawRig(ctx: CanvasRenderingContext2D, vm: number, now: number): void {
  const cx = PC_W / 2
  const wallY = RIG_H * 0.66
  const scale = 3.4
  const mouth = 54
  const open = openAt(0, vm, now)

  // The cell's charge, as a wash over the CYTOPLASM — the app's own device,
  // and the same one the membrane-charge drawer uses. It goes below the wall
  // and nowhere else: the pipette holds neutral salt water, and tinting that
  // would say its contents carry the cell's charge (2026-08-28).
  const t = polarityT(vm)
  if (Math.abs(t) > 0.01) {
    const from = wallY + HALF_MEM * scale
    ctx.fillStyle = chargeWash(ctx, from, RIG_H, t)
    ctx.fillRect(0, from, PC_W, RIG_H - from)
  }

  // The glass: two walls tapering to a mouth that cups the membrane.
  ctx.save()
  ctx.fillStyle = 'rgba(186, 230, 253, 0.06)'
  ctx.beginPath()
  ctx.moveTo(cx - mouth - 66, 4)
  ctx.lineTo(cx + mouth + 66, 4)
  ctx.lineTo(cx + mouth - 3, wallY - HALF_MEM * scale)
  ctx.lineTo(cx - mouth + 3, wallY - HALF_MEM * scale)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = GLASS
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const side of [-1, 1] as const) {
    ctx.beginPath()
    ctx.moveTo(cx + side * (mouth + 66), 4)
    ctx.lineTo(cx + side * mouth, wallY - HALF_MEM * scale - 12)
    ctx.quadraticCurveTo(
      cx + side * mouth,
      wallY - HALF_MEM * scale + 3,
      cx + side * (mouth - 7),
      wallY - HALF_MEM * scale + 4,
    )
    ctx.stroke()
  }
  ctx.restore()

  // The wall and the one channel in it — the app's own lipids and its own
  // gate, so this is recognisably the same object as everywhere else.
  ctx.save()
  ctx.translate(cx, wallY)
  ctx.scale(scale, scale)
  drawLipids(ctx, {
    midY: 0,
    from: -cx / scale,
    to: cx / scale,
    gaps: [[-1.2 * PX_PER_NM, 1.2 * PX_PER_NM]],
  })
  drawGatedChannel(ctx, {
    cx: 0,
    midY: 0,
    open: open ? 1 : 0,
    mid: mix(CHANNEL_MID, GLOSSY_COLORS.k.mid, 0.3),
    dark: mix(CHANNEL_DARK, GLOSSY_COLORS.k.dark, 0.25),
    species: GLOSSY_COLORS.k.mid,
  })
  ctx.restore()

  // THE IONS, going through and up the pipette. They only move while the door
  // is open, and they always go the same way — out of the cell — because at
  // every setting of this dial potassium is being pushed outward. The pipette
  // catching them is not a metaphor: that is where a real recording collects
  // the current.
  const ionR = 7
  const mouthY = wallY - HALF_MEM * scale
  for (const ion of ionsInFlight(vm, now)) {
    const p = ion.progress
    const y = wallY + HALF_MEM * scale - p * (wallY + HALF_MEM * scale - 6)
    // A little sideways wander once they are clear of the pore, seeded so it
    // never reshuffles.
    const spread = Math.max(0, (mouthY - y) / mouthY)
    const wobble = Math.sin(ion.seed * 12.9898) * mouth * 0.75 * spread
    ctx.save()
    ctx.globalAlpha = Math.max(0, 1 - Math.pow(p, 3))
    drawGlossyIon(ctx, 'k', cx + wobble, y, ionR)
    drawIonCharge(ctx, cx + wobble, y, ionR, IONS.k.charge, undefined, badgeMinR(1))
    ctx.restore()
  }

  // The reading, on the thing it is a reading of.
  ctx.fillStyle = open ? '#fbbf24' : 'rgba(148, 163, 184, 0.8)'
  ctx.font = '12px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(open ? 'open' : 'shut', cx, wallY + HALF_MEM * scale + 26)
}

/** The record, as square steps, in a strip under the rig. Straight from the
 *  dwell list, so an edge lands exactly where the model says the door moved —
 *  and a child can match an ion going through to a step on the paper. */
function drawStrip(ctx: CanvasRenderingContext2D, vm: number, now: number): void {
  const top = RIG_H + 12
  const openY = top + 22
  const shutY = top + STRIP_H - 34

  ctx.strokeStyle = GRID
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(TRACE_X, top + 10)
  ctx.lineTo(TRACE_X, shutY + 10)
  ctx.stroke()

  ctx.strokeStyle = TRACE
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'miter'
  ctx.beginPath()
  ctx.moveTo(xAtMs(0), shutY)
  for (const d of dwells(0, vm)) {
    if (d.toMs < 0 || d.fromMs > PATCH_WINDOW_MS) continue
    const y = d.open ? openY : shutY
    ctx.lineTo(xAtMs(Math.max(0, d.fromMs)), y)
    ctx.lineTo(xAtMs(Math.min(PATCH_WINDOW_MS, d.toMs)), y)
  }
  ctx.lineTo(xAtMs(PATCH_WINDOW_MS), shutY)
  ctx.stroke()

  // Where the rig has got to, so the two halves are one moment seen twice.
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(xAtMs(now), top + 10)
  ctx.lineTo(xAtMs(now), shutY + 10)
  ctx.stroke()

  ctx.fillStyle = 'rgba(148, 163, 184, 0.75)'
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`${unitaryPa(vm).toFixed(2)} pA`, TRACE_X - 6, openY + 3)
  ctx.fillText('0', TRACE_X - 6, shutY + 3)
  ctx.textAlign = 'left'
  ctx.fillStyle = LABEL
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillText(`${vm > 0 ? '+' : ''}${Math.round(vm)} mV`, TRACE_X + 4, shutY + 26)
  ctx.textAlign = 'right'
  ctx.fillText(`${PATCH_WINDOW_MS} ms`, TRACE_X + TRACE_W, shutY + 26)
}

export function drawPatch(ctx: CanvasRenderingContext2D, vm: number, now: number): void {
  drawRig(ctx, vm, now)
  drawStrip(ctx, vm, now)
  for (const l of patchLabels()) drawSpoken(ctx, l)
}
