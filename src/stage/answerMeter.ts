import { STAGE_H, STAGE_W } from './layout'
import { TINT_SHAPE } from '../core/spine'
import { chargeSpan } from './particleStyle'

// ⚠ THIS IS AN INSTRUMENT, AND IT LIVES APART FROM THE CAMERA (21c-71).
// `spineScene.ts` draws NOTHING — it frames the round trip's picture, and a
// guard reads its source to keep it that way. The meter has to be painted by
// somebody, and painting it there would have made that guard fail for a real
// reason: a module that composes a camera and also lays paths is no longer only
// a camera. So the paths live here, and the camera calls one function.

// ── the answer meter ────────────────────────────────────────────────────────
//
// ⚠ WHY A SCALE AND NOT A SENTENCE (21c-71). The story's whole payoff is that
// the LAST message is bigger than the FIRST, and the two are fifty-three
// seconds apart. A colour the child cannot still see cannot be compared with
// one they are looking at, so the comparison needs something that STAYS: the
// first message's peak, left on the scale as a line for the last one to pass.
//
// The canvas may carry names and READINGS ON A SCALE, which is what this is —
// no words, and the bar wears the head's own ink so what it reads is never in
// question.

/** How tall the meter is, as a share of the frame. */
export const METER_H = 0.34
export const METER_W = 9
export const METER_X = 14

export function meterBox(_width = STAGE_W, height = STAGE_H) {
  const h = height * METER_H
  return { x: METER_X, y: (height - h) / 2, w: METER_W, h }
}

/** ⚠ WHERE A READING LANDS ON THE METER — the one call, so the bar, the mark
 *  and any guard cannot hold three answers. */
export function meterY(reading: number, width = STAGE_W, height = STAGE_H): number {
  const b = meterBox(width, height)
  return b.y + b.h * (1 - Math.max(0, Math.min(1, reading)))
}

export function drawAnswerMeter(
  ctx: CanvasRenderingContext2D,
  reading: number,
  mark: number | null | undefined,
  width: number,
  height: number,
  fade = 1,
): void {
  if (fade <= 0.002) return
  const b = meterBox(width, height)
  const r = METER_W / 2
  ctx.save()
  // ⚠ MULTIPLIED, never assigned — the view's arrival rides on this, and an
  // instrument that ignores it is two marks still on screen after the picture
  // behind them has gone.
  ctx.globalAlpha *= fade
  ctx.beginPath()
  roundedBar(ctx, b.x, b.y, b.w, b.h, r)
  ctx.fillStyle = 'rgba(148, 163, 184, 0.18)'
  ctx.fill()
  // …filled to the reading, in the head's own ink
  const top = meterY(reading, width, height)
  if (b.y + b.h - top > 0.5) {
    ctx.save()
    ctx.beginPath()
    roundedBar(ctx, b.x, b.y, b.w, b.h, r)
    ctx.clip()
    ctx.fillStyle = `rgb(${chargeSpan(Math.max(0, Math.min(1, reading)) ** SPINE_METER_SHAPE)})`
    // ⚠ A PATH, NOT A `fillRect` — *ink a guard cannot see is a claim you
    // cannot make*, and a filled rectangle lays no vertices for one to measure.
    ctx.beginPath()
    ctx.moveTo(b.x, top)
    ctx.lineTo(b.x + b.w, top)
    ctx.lineTo(b.x + b.w, b.y + b.h)
    ctx.lineTo(b.x, b.y + b.h)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  // ⚠ AND THE MARK IS DRAWN WIDER THAN THE BAR, so it reads as a line ACROSS
  // the scale rather than as part of the filling.
  if (mark !== null && mark !== undefined) {
    const my = meterY(mark, width, height)
    ctx.beginPath()
    ctx.moveTo(b.x - 4, my)
    ctx.lineTo(b.x + b.w + 4, my)
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.92)'
    ctx.stroke()
  }
  ctx.restore()
}

/** ⚠ THE METER WEARS THE HEAD'S OWN INK, so the two cannot be read as separate
 *  quantities — and it therefore shares the head's shaping. */
const SPINE_METER_SHAPE = TINT_SHAPE

function roundedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
