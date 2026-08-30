import { boundsOf, parsePath, tracePath, type Seg } from './svgPath'
import { CHANNEL_DARK, CHANNEL_MID, HALF_MEM, mix } from './bilayer'

// THE LEAK CHANNEL, traced (user, 2026-08-29, who supplied the drawing).
//
// A leak channel does not look like a voltage-gated one, and drawing them with
// one silhouette was making the app say they are the same object with a
// different label. They are not: this one has no gate, no sensor and no
// binding site, and its shape shows it — three subunits standing shoulder to
// shoulder, the back one visible in the gaps between the two in front, with a
// way through that is simply always there.
//
// The outline is TRACED from the drawing rather than reasoned out by eye,
// because re-deriving somebody's structure drawing by eye is a worse copy of a
// better source. `svgPath` turns the path data into canvas calls, and it
// throws rather than skipping a command it does not know — a path that
// quietly loses a curve looks almost right, which is the failure that matters.

/** The three subunits, in the order they must be painted: the BACK one first,
 *  then the two in front of it. */
export const LEAK_PATHS = [
  // The back subunit, seen between the two in front.
  'm-56.63-6.31c4.44-0.01 11.59-3.03 11.59-3.03v0.05c-1.63 1.55-3.01 4.16-3.15 8.51-0.37 11.19-1.06 19.68-0.82 23.78 0.24 4.1 1.38 22.37 1.38 22.37 0 0 0.86 2.41 2.83 4.38-2.24-0.87-7.07-2.52-11.13-2.36-2.99 0.11-6.51 0.92-9.09 1.62 1.49-1.78 2.16-3.64 2.16-3.64 0 0 1.14-18.27 1.38-22.37 0.24-4.1-0.45-12.59-0.82-23.78-0.12-3.73-1.15-6.17-2.46-7.77 1.76 0.86 5.07 2.24 8.13 2.24z',
  // Front left.
  'm-72.2-11.6c0 0 8.53-0.38 8.9 10.82 0.37 11.19 1.06 19.68 0.82 23.78-0.24 4.1-1.38 22.37-1.38 22.37 0 0-2.63 7.34-9.15 6.86-6.52-0.48-8.93-6.67-7.77-12.3 1.17-5.63 2.07-12.56 1.89-20.28-0.17-7.73-1.79-16.88-1.68-21.62 0.1-4.73 1.86-9.77 8.37-9.63z',
  // Front right.
  'm-38.29-11.6c0 0-8.53-0.38-8.9 10.82-0.37 11.19-1.06 19.68-0.82 23.78 0.24 4.1 1.38 22.37 1.38 22.37 0 0 2.63 7.34 9.15 6.86 6.52-0.48 8.93-6.67 7.76-12.3-1.16-5.63-2.06-12.56-1.88-20.28 0.17-7.73 1.79-16.88 1.68-21.62-0.1-4.73-1.86-9.77-8.37-9.63z',
]

/** Parsed once. The paths never change, and re-parsing a string sixty times a
 *  second would be silly. */
const SEGS: Seg[][] = LEAK_PATHS.map(parsePath)
/** The box all three sit in, so the shape can be fitted to a wall rather than
 *  drawn at whatever size it happened to be traced at. */
const BOX = boundsOf(SEGS.flat())

export interface LeakChannel {
  cx: number
  midY: number
  /** How far it reaches either side of the middle. The traced shape is fitted
   *  to this, so it straddles whatever wall it is put in. */
  halfHeight?: number
  /** The species it passes, at full strength — the app's rule is that every
   *  channel is tinted with what goes through it. */
  species: string
  speciesDark: string
}

/** How wide the traced shape is at the height it is drawn at — so a caller can
 *  cut a gap in the bilayer that actually fits it. */
export function leakHalfWidth(halfHeight = HALF_MEM): number {
  const k = (2 * halfHeight * 1.12) / BOX.h
  return (BOX.w * k) / 2
}

export function drawLeakChannel(ctx: CanvasRenderingContext2D, c: LeakChannel): void {
  const reach = c.halfHeight ?? HALF_MEM
  // Fitted by HEIGHT: the shape has to straddle the wall, and its width is
  // then whatever the drawing says it is rather than something chosen.
  const k = (2 * reach * 1.12) / BOX.h
  const map = (x: number, y: number) => ({
    x: c.cx + (x - (BOX.x + BOX.w / 2)) * k,
    y: c.midY + (y - (BOX.y + BOX.h / 2)) * k,
  })

  const mid = mix(CHANNEL_MID, c.species, 0.55)
  const dark = mix(CHANNEL_DARK, c.speciesDark, 0.45)

  for (const [i, segs] of SEGS.entries()) {
    const back = i === 0
    ctx.beginPath()
    tracePath(ctx, segs, map)
    // The back subunit is DARKER, which is the whole reason it reads as being
    // behind the other two rather than as a third post standing in a row.
    const g = ctx.createLinearGradient(c.cx - BOX.w * k * 0.5, 0, c.cx + BOX.w * k * 0.5, 0)
    g.addColorStop(0, back ? mix(dark, '#000000', 0.35) : dark)
    g.addColorStop(0.42, back ? mix(mid, '#000000', 0.4) : mid)
    g.addColorStop(1, back ? mix(dark, '#000000', 0.35) : dark)
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = back ? mix(dark, '#000000', 0.2) : c.species
    ctx.lineWidth = back ? 0.8 : 1.1
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
}
