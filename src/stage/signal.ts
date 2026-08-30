// The yellow flash: this app's one way of saying "a signal is here".
//
// It was defined inside drawScene, which was fine while the whole-neuron canvas
// was the only place a signal appeared. It is now used by the stretch of axon and
// by the little map of the cell as well, and three private copies of a colour is
// how a visual language stops being one.
//
// What it means, precisely: ACTIVITY — a signal passing through this piece of
// membrane. It is not the charge ramp and must not be used as one. The red/blue
// ramp answers "how far from rest is this membrane"; the yellow answers "is the
// signal here". A view can want both, and the axon does.

/** The signal's glow. */
export const SIGNAL_RGB = '250, 204, 21'
/** Its bright middle. */
export const SIGNAL_CORE = '#fffbeb'

export function softGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: string,
  alpha: number,
): void {
  if (alpha <= 0 || r <= 0) return
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(${rgb}, ${alpha})`)
  g.addColorStop(0.45, `rgba(${rgb}, ${alpha * 0.35})`)
  g.addColorStop(1, `rgba(${rgb}, 0)`)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}
