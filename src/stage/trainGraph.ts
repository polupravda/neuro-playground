import { VM_MAX, VM_MIN, nernstMv } from '../core/voltage'
import { polarizationT } from '../core/actionPotential'
import { TRAIN_WINDOW_MS, type TrainPush, type TrainSample } from '../core/spikeTrain'
import type { IonCounts } from '../state/ionStore'
import {
  AXON_END,
  AXON_POLYLINE,
  BOUTON_R,
  DENDRITE_SEGS,
  MAP_ASPECT,
  NEURON_MAP_BOX,
  SOMA,
  SOMA_R,
  TERMINALS,
  regionPoints,
  type NeuronRegion,
} from './layout'
import { SIGNAL_RGB, softGlow } from './signal'
import { drawMagnifier } from './channelScene'

// The oscilloscope face for the spike-train bench.
//
// Geometry is exported and tested separately from the painting, the way the axon
// ribbon does it: what a millisecond and a millivolt land on is arithmetic worth
// pinning down, and a canvas call log is a poor place to check arithmetic.
//
// The trace runs newest-at-the-right and scrolls, like every heart monitor a
// child has ever seen on television. It was worth resisting the oscilloscope's
// own convention of wrapping and overwriting: a line that jumps back to the left
// edge and paints over itself is unreadable unless you already know what it is
// doing, and this bench is for someone who does not.

/** Room for the millivolt labels down the left. */
export const GUTTER = 42
/** Room under the axis for the press marks. */
export const MARKS_H = 34
export const PAD_TOP = 12

export interface TrainGeometry {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
  marksY: number
}

export function trainGeometry(width: number, height: number): TrainGeometry {
  const left = GUTTER
  const right = width - 10
  const top = PAD_TOP
  const bottom = height - MARKS_H
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    marksY: bottom + 15,
  }
}

/** Where a model millisecond lands, given the moment showing at the right edge.
 *  Times older than the window fall left of `geo.left`; callers clip. */
export function xAtMs(geo: TrainGeometry, nowMs: number, t: number): number {
  return geo.right - ((nowMs - t) / TRAIN_WINDOW_MS) * geo.width
}

/** Where a millivolt lands. Clamped, because a graph whose line leaves the box is
 *  worse than one that flattens against the top: the spike overshoots to about
 *  +40 and the scale runs to VM_MAX, so this only ever bites on absurd counts. */
export function yAtMv(geo: TrainGeometry, mv: number): number {
  const f = (Math.max(VM_MIN, Math.min(VM_MAX, mv)) - VM_MIN) / (VM_MAX - VM_MIN)
  return geo.bottom - f * geo.height
}

/** The millivolt lines worth drawing across the face. Zero is not decoration —
 *  overshooting it is what this app means by "a spike" everywhere, including in
 *  the model's own test, so it is the line that says whether one happened. */
export function guideMv(rest: number): { mv: number; label: string; key: string }[] {
  return [
    { mv: 0, label: '0 mV', key: 'zero' },
    { mv: rest, label: `${Math.round(rest)} mV`, key: 'rest' },
  ]
}

export interface TrainView {
  width: number
  height: number
  nowMs: number
  rest: number
  samples: readonly TrainSample[]
  pushes: readonly TrainPush[]
  spikesAt: readonly number[]
  /** Measured on this membrane, ms after a spike. */
  absoluteMs: number
  relativeMs: number
  /** Whether to shade the recovery windows at all. Off until a first spike has
   *  been seen, so the face is not covered in bands nobody has earned yet. */
  showBands: boolean
  counts: IonCounts
}

/** The trace's colour at a voltage: the app's own three states, in the app's own
 *  three colours — grey at rest, red above it, blue below.
 *
 *  Read through `polarizationT`, which is the same function the cytoplasm's colour
 *  field uses on the canvas. A child who has learned "red means the inside has
 *  gone positive" from the big picture reads the line here without being told
 *  again, and the two cannot drift apart, because there is one ramp. */
export function traceColour(mv: number, rest: number, counts: IonCounts): string {
  const t = polarizationT(mv, rest, nernstMv('na', counts), nernstMv('k', counts))
  const a = Math.min(1, Math.abs(t))
  const to = t > 0 ? [252, 165, 165] : [125, 211, 252]
  const grey = [148, 163, 184]
  const c = grey.map((g, i) => Math.round(g + (to[i] - g) * a))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

const INK = 'rgba(148, 163, 184, 0.8)'
const FAINT = 'rgba(148, 163, 184, 0.28)'
const FONT = '11px ui-sans-serif, system-ui, sans-serif'

export function drawTrain(ctx: CanvasRenderingContext2D, view: TrainView): void {
  const geo = trainGeometry(view.width, view.height)
  ctx.clearRect(0, 0, view.width, view.height)

  // ---- the recovery windows, first, so everything else sits on top of them
  if (view.showBands) {
    for (const at of view.spikesAt) {
      // Absolute first and wider band second, so the pair reads as one shape
      // getting lighter rather than two unrelated stripes.
      band(ctx, geo, view.nowMs, at, at + view.relativeMs, 'rgba(251, 146, 60, 0.10)')
      band(ctx, geo, view.nowMs, at, at + view.absoluteMs, 'rgba(248, 113, 113, 0.17)')
    }
  }

  // ---- guide lines
  ctx.font = FONT
  ctx.textBaseline = 'middle'
  for (const line of guideMv(view.rest)) {
    const y = yAtMv(geo, line.mv)
    ctx.beginPath()
    ctx.setLineDash(line.key === 'zero' ? [] : [3, 4])
    ctx.moveTo(geo.left, y)
    ctx.lineTo(geo.right, y)
    ctx.strokeStyle = line.key === 'zero' ? 'rgba(148, 163, 184, 0.45)' : FAINT
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.setLineDash([])
    ctx.textAlign = 'right'
    ctx.fillStyle = INK
    ctx.fillText(line.label, geo.left - 6, y)
  }

  // ---- the axis the marks hang from
  ctx.beginPath()
  ctx.moveTo(geo.left, geo.bottom)
  ctx.lineTo(geo.right, geo.bottom)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'
  ctx.stroke()

  // ---- the trace, in the same red/blue the membrane is drawn in everywhere else,
  // so a child reading "blue means under, red means over" on the canvas reads the
  // same thing here. Segment by segment: one gradient stroke could not change
  // colour along its own length.
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (let i = 1; i < view.samples.length; i++) {
    const a = view.samples[i - 1]
    const b = view.samples[i]
    const x1 = xAtMs(geo, view.nowMs, a.t)
    const x2 = xAtMs(geo, view.nowMs, b.t)
    if (x2 < geo.left) continue
    ctx.beginPath()
    ctx.moveTo(Math.max(geo.left, x1), yAtMv(geo, a.v))
    ctx.lineTo(x2, yAtMv(geo, b.v))
    ctx.strokeStyle = traceColour((a.v + b.v) / 2, view.rest, view.counts)
    ctx.stroke()
  }

  // ---- the presses, under the axis, each one keyed to what it did
  ctx.textAlign = 'center'
  for (const push of view.pushes) {
    const x = xAtMs(geo, view.nowMs, push.atMs)
    if (x < geo.left) continue
    ctx.beginPath()
    ctx.setLineDash([2, 3])
    ctx.moveTo(x, geo.top)
    ctx.lineTo(x, geo.bottom)
    ctx.strokeStyle =
      push.fired === true ? 'rgba(252, 211, 77, 0.45)' : 'rgba(148, 163, 184, 0.25)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.setLineDash([])
    // The outcome, in a word, right under the press that caused it. A tick and a
    // cross would need a key; "spike" and "nothing" do not.
    ctx.fillStyle =
      push.fired === true ? 'rgba(252, 211, 77, 0.95)' : 'rgba(148, 163, 184, 0.75)'
    ctx.font = `600 ${push.fired === true ? 11 : 10}px ui-sans-serif, system-ui, sans-serif`
    ctx.fillText(push.fired === null ? '·' : push.fired ? 'spike' : 'nothing', x, geo.marksY)
  }

}

/** One shaded stretch of time, clipped to the face. */
function band(
  ctx: CanvasRenderingContext2D,
  geo: TrainGeometry,
  nowMs: number,
  fromMs: number,
  toMs: number,
  fill: string,
): void {
  const x1 = Math.max(geo.left, xAtMs(geo, nowMs, fromMs))
  const x2 = Math.min(geo.right, xAtMs(geo, nowMs, toMs))
  if (x2 <= x1) return
  ctx.fillStyle = fill
  ctx.fillRect(x1, geo.top, x2 - x1, geo.height)
}

// ------------------------------------------------------------- the cell, inset
//
// A small neuron in the corner of the graph, lighting when the patch fires.
//
// On the CANVAS rather than as an SVG panel beside it, and that is not a stylistic
// choice. Its brightness is a per-frame value — it tracks the membrane voltage as
// it climbs and falls — and per-frame values do not go through React in this app.
// Painted here it is one more call inside the loop that was drawing anyway.
//
// It answers what the drawer covers up. The permanent map at the top of the column
// is behind the bench while the bench is open, so the child loses the one thing
// telling them which patch of which cell this trace belongs to. This puts it back,
// with the same geometry and the same dashed ring, and adds the thing the trace
// cannot say by itself: that the line going up IS the cell firing.

/** Breathing room inside the inset's own panel, px. */
export const INSET_PAD = 4

export interface InsetBox {
  x: number
  y: number
  w: number
  h: number
}

/** The inset's box inside a canvas of its own, given that canvas's size.
 *
 *  Its own canvas, and that is the second answer to the question. The first put it
 *  in the top-left of the graph face, which is empty most of the time — resting
 *  voltage is −72 mV on a scale running to +75, so the trace lives low. But a
 *  spike peaks near +40 and every spike SCROLLS: three seconds after it is drawn it
 *  passes straight through that corner, and an opaque inset would hide it. A
 *  panel of its own occludes nothing and costs a few pixels of a control bar that
 *  had spare room. */
export function insetBox(width: number, height: number): InsetBox {
  const w = Math.max(0, Math.min(width - INSET_PAD * 2, (height - INSET_PAD * 2) * MAP_ASPECT))
  const h = w / MAP_ASPECT
  return { x: (width - w) / 2, y: (height - h) / 2, w, h }
}

/** Scene coordinates → inset coordinates. */
function place(box: InsetBox, p: { x: number; y: number }): { x: number; y: number } {
  const k = box.w / NEURON_MAP_BOX.width
  return {
    x: box.x + (p.x - NEURON_MAP_BOX.minX) * k,
    y: box.y + (p.y - NEURON_MAP_BOX.minY) * k,
  }
}

/** The whole cell, small, with one region lit.
 *
 *  Drawn from the same geometry the big canvas and the column's map are drawn from
 *  — see NEURON_MAP_BOX — so this cannot slowly stop being a picture of that
 *  neuron. */
/** The electrode's push, 0→1, fading — see `stimFlash`. */
export interface StimFlash {
  strength: number
}

/** WHICH SPOTS LIGHT when the trace goes over the top.
 *
 *  ⚠ The clamped spot has to be one of them, and it was not (user, 2026-08-28:
 *  "the patch clamp is on the dendrite, which is correct — but when I fire an
 *  action potential the respective dendrite is not firing").
 *
 *  The two sets were computed independently and never met. The electrode is
 *  drawn at the ZOOM TARGET's own point; the glow was drawn at
 *  `regionPoints(region)`, which for the dendrites is the middle of each
 *  synapse trunk. Those are different places on different branches, so the
 *  cell lit up everywhere except the one spot the child is watching — the spot
 *  the current goes into and the spot the trace on the right is a recording
 *  OF. A picture that lights everywhere but the place being measured says the
 *  measurement is happening somewhere else.
 *
 *  So the clamped point goes first, and it is the same point the electrode
 *  touches, because it is literally the same value. */
export function litPoints(
  region: NeuronRegion | null,
  clampedAt: { x: number; y: number } | null,
): { x: number; y: number }[] {
  const rest = region ? regionPoints(region) : []
  if (!clampedAt) return rest
  const same = (p: { x: number; y: number }) =>
    Math.abs(p.x - clampedAt.x) < 1e-6 && Math.abs(p.y - clampedAt.y) < 1e-6
  return [clampedAt, ...rest.filter((p) => !same(p))]
}

/** The electrode's own hit box in the inset, so tapping it opens the patch
 *  clamp (D13). The probe has been sitting on this little neuron unexplained
 *  since the bench was built; a child who wonders what it is should be able
 *  to touch it and find out — spatial navigation, not a row in a list. */
/** The probe's magnifier, and therefore the size of its hit box. */
export const PROBE_MAG_R = 9

export function electrodeHit(
  box: InsetBox,
  ringAt: { x: number; y: number } | null,
): { x: number; y: number; w: number; h: number } | null {
  if (!ringAt) return null
  const tip = place(box, ringAt)
  const len = Math.max(14, box.w * 0.16)
  const from = { x: tip.x + len * 0.72, y: tip.y - len }
  const pad = 9
  return {
    x: Math.min(from.x, tip.x) - pad,
    y: Math.min(from.y, tip.y) - pad,
    w: Math.abs(from.x - tip.x) + pad * 2,
    h: Math.abs(from.y - tip.y) + pad * 2,
  }
}

export function electrodeHitAt(
  box: InsetBox,
  ringAt: { x: number; y: number } | null,
  x: number,
  y: number,
): boolean {
  const h = electrodeHit(box, ringAt)
  return !!h && x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h
}

export function drawNeuronInset(
  ctx: CanvasRenderingContext2D,
  box: InsetBox,
  region: NeuronRegion | null,
  lit: number,
  ringAt: { x: number; y: number } | null,
  stim: StimFlash | null = null,
): void {
  const k = box.w / NEURON_MAP_BOX.width
  ctx.save()

  // The panel's own border and background are CSS on the element — the drawing
  // does not repeat them. Clipped all the same: a dendrite reaching past the edge
  // should be cut off cleanly rather than drawn over the rounded corner.
  ctx.beginPath()
  ctx.rect(box.x - INSET_PAD, box.y - INSET_PAD, box.w + INSET_PAD * 2, box.h + INSET_PAD * 2)
  ctx.clip()

  // The cell at rest, in the grey it wears everywhere else.
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.38)'
  ctx.lineCap = 'round'
  for (const seg of DENDRITE_SEGS) {
    const a = place(box, { x: seg.x1, y: seg.y1 })
    const b = place(box, { x: seg.x2, y: seg.y2 })
    ctx.beginPath()
    ctx.lineWidth = Math.max(0.6, seg.w * k * 0.9)
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.lineWidth = Math.max(1.2, 12 * k)
  const head = place(box, AXON_POLYLINE[0])
  ctx.moveTo(head.x, head.y)
  for (const p of AXON_POLYLINE.slice(1)) {
    const q = place(box, p)
    ctx.lineTo(q.x, q.y)
  }
  ctx.stroke()
  const end = place(box, AXON_END)
  for (const t of TERMINALS) {
    const tip = place(box, t.end)
    ctx.beginPath()
    ctx.lineWidth = Math.max(0.8, 5 * k)
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(tip.x, tip.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(tip.x, tip.y, Math.max(1, BOUTON_R * k), 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(148, 163, 184, 0.38)'
    ctx.fill()
  }
  const soma = place(box, SOMA)
  ctx.beginPath()
  ctx.arc(soma.x, soma.y, SOMA_R * k, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(148, 163, 184, 0.28)'
  ctx.fill()

  // THE CAUSE, drawn as what it really is (2026-08-28). A cell whose patch
  // lights with nothing having happened teaches that neurons fire by
  // themselves — the misconception milestone 1 exists to dismantle. But what
  // pushes this membrane is not a synapse, it is a current injected into one
  // spot, so the honest cause to draw is the ELECTRODE doing the injecting:
  // apparatus, plainly not part of the cell, which the describer names and
  // the patch-clamp exhibit (D13) will one day explain.
  //
  // Quiet on purpose: a thin probe and a flash, so the neuron stays the
  // subject of its own picture.
  if (ringAt) {
    const tip = place(box, ringAt)
    const len = Math.max(14, box.w * 0.16)
    const from = { x: tip.x + len * 0.72, y: tip.y - len }
    ctx.strokeStyle = stim
      ? `rgba(${SIGNAL_RGB}, ${0.35 + 0.65 * stim.strength})`
      : 'rgba(148, 163, 184, 0.45)'
    ctx.lineWidth = Math.max(1.2, box.w * 0.012)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(tip.x + 2, tip.y - 3)
    ctx.stroke()
    if (stim && stim.strength > 0.02) {
      softGlow(ctx, tip.x + 2, tip.y - 3, 5 + 12 * stim.strength, SIGNAL_RGB, stim.strength * 0.9)
    }
    // The magnifier that opens the patch clamp — THE SAME ONE the channel
    // view wears (2026-08-28). It was a bare lens here and a rounded box
    // there, so the app's two "there is more of this to see" doors did not
    // look like the same kind of thing. A child learns an affordance once or
    // not at all.
    drawMagnifier(ctx, from.x + 3, from.y - 1, PROBE_MAG_R)
  }

  // And the signal, in the yellow that means one thing everywhere in this app.
  // The CLAMPED SPOT is first in the list and drawn a shade brighter: it is
  // where the current goes in and where the trace beside this picture is
  // recorded, so it cannot be the one place that stays dark.
  const spots = litPoints(region, ringAt)
  if (lit > 0.02) {
    for (const [i, at] of spots.entries()) {
      const p = place(box, at)
      const here = ringAt && i === 0
      softGlow(
        ctx,
        p.x,
        p.y,
        (here ? 9 : 7) + (here ? 20 : 16) * lit,
        SIGNAL_RGB,
        Math.min(1, lit) * (here ? 1 : 0.85),
      )
    }
  }

  // You are here — the same dashed ring the column's map uses.
  if (ringAt) {
    const p = place(box, ringAt)
    ctx.beginPath()
    ctx.setLineDash([3, 2.5])
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.restore()
}
