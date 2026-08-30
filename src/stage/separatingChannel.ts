import { boundsOf, parsePath, tracePath, type Seg } from './svgPath'
import { CHANNEL_DARK, CHANNEL_MID, HALF_MEM, mix } from './bilayer'

// A CHANNEL THAT OPENS BY ITS SUBUNITS COMING APART.
//
// Two of the traced drawings work this way — the ligand-gated one and the
// mechanically-gated one — with different silhouettes and the SAME motion:
// three subunits, the two in front separating by 8 units and the back one
// stretching by the same 8 to stay behind the gap they leave. Both numbers
// were measured off the drawings rather than chosen, and they agreed.
//
// So the motion lives here once and the drawings bring only their outlines. A
// third near-copy of this arithmetic would be a third thing to keep true, and
// the first one to drift would be the one nobody was looking at.
//
// ⚠ ONE DEPARTURE FROM BOTH DRAWINGS, deliberate. Each artist anchored the
// RIGHT subunit and moved the left one 8 units away. Animated literally, the
// whole protein appears to slide sideways across the membrane. The same 8
// units are split either side here, so the pore opens about its own axis; the
// end geometry is the drawing's, up to a rigid shift.

/** How far the two halves come apart, in the drawings' own units. MEASURED off
 *  the two states of each drawing, and the same in both. */
export const SEPARATION = 8

export interface SeparatingPaths {
  /** Back subunit first — it is painted under the two in front. */
  back: string
  left: string
  right: string
  /** Where a messenger binds, in the drawing's own coordinates, when shut.
   *  Omitted where the channel has no binding site. */
  seat?: { x: number; y: number; r: number }
}

export interface SeparatingChannel {
  cx: number
  midY: number
  halfHeight?: number
  species: string
  speciesDark: string
  /** 0 = subunits together, 1 = come apart. */
  open: number
  /** Whether to cut the binding socket into the extracellular mouth. */
  socket?: boolean
}

export interface Separating {
  draw: (ctx: CanvasRenderingContext2D, c: SeparatingChannel) => void
  /** How wide it is WHEN FULLY OPEN, so a caller can cut a gap in the bilayer
   *  that still fits once it has opened. */
  halfWidth: (halfHeight?: number) => number
  /** Where the binding site is in canvas coordinates — and it MOVES as the
   *  channel opens, because the socket is cut into a subunit that slides. */
  seat: (cx: number, midY: number, open: number, halfHeight?: number) => {
    x: number
    y: number
    r: number
  }
}

export function makeSeparating(paths: SeparatingPaths): Separating {
  const BACK: Seg[] = parsePath(paths.back)
  const LEFT: Seg[] = parsePath(paths.left)
  const RIGHT: Seg[] = parsePath(paths.right)
  const BACK_BOX = boundsOf(BACK)
  /** Its box when SHUT, which is what it is fitted by — fitting it by the open
   *  box would make it shrink as it opened. */
  const BOX = boundsOf([...BACK, ...LEFT, ...RIGHT])
  const fitScale = (halfHeight: number) => (2 * halfHeight * 1.12) / BOX.h

  const halfWidth = (halfHeight = HALF_MEM) =>
    ((BOX.w + SEPARATION) * fitScale(halfHeight)) / 2

  const seat = (cx: number, midY: number, open: number, halfHeight = HALF_MEM) => {
    const k = fitScale(halfHeight)
    const s = paths.seat ?? { x: 0, y: 0, r: 3.4 }
    const slide = -(SEPARATION / 2) * Math.max(0, Math.min(1, open))
    return {
      x: cx + (s.x + slide - (BOX.x + BOX.w / 2)) * k,
      y: midY + (s.y - (BOX.y + BOX.h / 2)) * k,
      r: s.r * k,
    }
  }

  const draw = (ctx: CanvasRenderingContext2D, c: SeparatingChannel) => {
    const reach = c.halfHeight ?? HALF_MEM
    const k = fitScale(reach)
    const open = Math.max(0, Math.min(1, c.open))
    const slide = (SEPARATION / 2) * open

    const at = (dx: number) => (x: number, y: number) => ({
      x: c.cx + (x + dx - (BOX.x + BOX.w / 2)) * k,
      y: c.midY + (y - (BOX.y + BOX.h / 2)) * k,
    })
    // The back subunit does not slide — it STRETCHES, by the same 8 units the
    // two in front leave between them, so the gap never shows through to
    // nothing. Scaled about its own middle, which is what splits the opening
    // evenly either side.
    const stretch = (BACK_BOX.w + SEPARATION * open) / BACK_BOX.w
    const backAt = (x: number, y: number) => {
      const mid = BACK_BOX.x + BACK_BOX.w / 2
      return at(0)(mid + (x - mid) * stretch, y)
    }

    const mid = mix(CHANNEL_MID, c.species, 0.55)
    const dark = mix(CHANNEL_DARK, c.speciesDark, 0.45)
    const paint = (back: boolean) => {
      const g = ctx.createLinearGradient(
        c.cx - (BOX.w + SEPARATION) * k * 0.5,
        0,
        c.cx + (BOX.w + SEPARATION) * k * 0.5,
        0,
      )
      g.addColorStop(0, back ? mix(dark, '#000000', 0.35) : dark)
      g.addColorStop(0.42, back ? mix(mid, '#000000', 0.4) : mid)
      g.addColorStop(1, back ? mix(dark, '#000000', 0.35) : dark)
      return g
    }

    for (const [segs, map, back] of [
      [BACK, backAt, true],
      [LEFT, at(-slide), false],
      [RIGHT, at(slide), false],
    ] as const) {
      ctx.beginPath()
      tracePath(ctx, segs, map)
      ctx.fillStyle = paint(back)
      ctx.fill()
      ctx.strokeStyle = back ? mix(dark, '#000000', 0.2) : c.species
      ctx.lineWidth = back ? 0.8 : 1.1
      ctx.lineJoin = 'round'
      ctx.stroke()
    }

    // The binding site, as a socket the messenger can be seen to FIT rather
    // than hover beside. It travels with the subunit it is cut into.
    if (c.socket && paths.seat) {
      const s = seat(c.cx, c.midY, open, reach)
      ctx.fillStyle = mix(dark, '#000000', 0.45)
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = mix(dark, '#000000', 0.2)
      ctx.lineWidth = 0.9
      ctx.stroke()
    }
  }

  return { draw, halfWidth, seat }
}
