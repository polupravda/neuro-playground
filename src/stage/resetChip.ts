// ⚠ THE ONE RESET, drawn once (user, 2026-08-30: "adjust 'reset' button across
// the app. Source of truth: 'membrane permeability' view").
//
// Five benches had grown five reset buttons — an amber chip on a canvas, two
// grey text links reading "↺ start again", a big amber pill saying "↺ Back to
// rest", a tiny "↺ real" — each invented where it was needed. A control that
// does the same thing in every exhibit has to look the same in every exhibit,
// or the child learns each one separately.
//
// The permeability bench's is the source of truth, so its numbers and colours
// live here and it uses them like everyone else. Never copy this into a scene:
// a second private copy of a control is how five of them happened.

export const RESET_W = 92
export const RESET_H = 28
export const RESET_R = 9
export const RESET_LABEL = '↺ Reset'

export const RESET_FILL = 'rgba(245, 158, 11, 0.15)'
export const RESET_EDGE = 'rgba(245, 158, 11, 0.6)'
export const RESET_INK = '#fcd34d'

/** Where it sits on a canvas: the top-left corner, always, so a child never
 *  hunts for it. `inset` is for a scene whose corner is already spoken for. */
export function resetChipBox(inset = { x: 14, y: 12 }): {
  x: number
  y: number
  w: number
  h: number
} {
  return { x: inset.x, y: inset.y, w: RESET_W, h: RESET_H }
}

export function resetChipHit(x: number, y: number, box = resetChipBox()): boolean {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h
}

export function drawResetChip(
  ctx: CanvasRenderingContext2D,
  box = resetChipBox(),
): void {
  ctx.save()
  ctx.fillStyle = RESET_FILL
  ctx.strokeStyle = RESET_EDGE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(box.x, box.y, box.w, box.h, RESET_R)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = RESET_INK
  ctx.font = '12px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(RESET_LABEL, box.x + box.w / 2, box.y + 18)
  ctx.restore()
}
