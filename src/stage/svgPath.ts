// A SMALL SVG PATH WALKER — enough to draw a traced shape, and no more.
//
// Some of this app's silhouettes are traced from a drawing rather than
// reasoned out from measurements: a leak channel's outline is a shape somebody
// drew from a structure, and re-deriving it by eye would be a worse copy of a
// better source. Those arrive as SVG path data, so something has to turn path
// data into canvas calls.
//
// Deliberately NOT a general SVG library. It handles exactly the commands the
// traced paths use — M/m, L/l, H/h, V/v, C/c, Q/q, Z/z — and throws on
// anything else rather than silently drawing the wrong shape, which is the
// failure mode that matters: a path that quietly loses a curve looks almost
// right.
//
// The throw has already earned itself: the ligand channel's flap turned out to
// contain a `q`, and the loud failure took a minute to find and fix
// (2026-08-29). Silently skipping it would have left a flap with a notch
// missing that nobody would have thought to look for.
//
// It is a pure function of the string, so a test can walk it without a canvas.

export type Seg =
  | { kind: 'move'; x: number; y: number }
  | { kind: 'line'; x: number; y: number }
  | { kind: 'curve'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { kind: 'quad'; x1: number; y1: number; x: number; y: number }
  | { kind: 'close' }

const NUMBER = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi

/** Every number in a run of path data, in order. Handles the shorthand that
 *  makes path data hard to split by eye: `-56.63-6.31` is two numbers, and the
 *  minus sign is the separator. */
export function numbersIn(run: string): number[] {
  return (run.match(NUMBER) ?? []).map(Number)
}

/** Path data → segments, in absolute coordinates. */
export function parsePath(d: string): Seg[] {
  const out: Seg[] = []
  // Split into [command letter, its numbers] pairs.
  const parts = d.match(/[a-zA-Z][^a-zA-Z]*/g) ?? []
  let x = 0
  let y = 0
  // Where the current subpath began, so `z` returns there — and so a `m`
  // after a `z` is relative to the right point.
  let startX = 0
  let startY = 0

  for (const part of parts) {
    const cmd = part[0]
    const n = numbersIn(part.slice(1))
    const rel = cmd === cmd.toLowerCase()
    const at = (i: number) => (rel ? x + n[i] : n[i])
    const atY = (i: number) => (rel ? y + n[i] : n[i])

    switch (cmd.toUpperCase()) {
      case 'M': {
        for (let i = 0; i + 1 < n.length; i += 2) {
          const nx = rel ? x + n[i] : n[i]
          const ny = rel ? y + n[i + 1] : n[i + 1]
          x = nx
          y = ny
          // Only the FIRST pair of a move is a move; the rest are lines, which
          // is the one piece of shorthand it would be easy to get wrong.
          out.push(i === 0 ? { kind: 'move', x, y } : { kind: 'line', x, y })
          if (i === 0) {
            startX = x
            startY = y
          }
        }
        break
      }
      case 'L': {
        for (let i = 0; i + 1 < n.length; i += 2) {
          x = rel ? x + n[i] : n[i]
          y = rel ? y + n[i + 1] : n[i + 1]
          out.push({ kind: 'line', x, y })
        }
        break
      }
      case 'H': {
        for (const v of n) {
          x = rel ? x + v : v
          out.push({ kind: 'line', x, y })
        }
        break
      }
      case 'V': {
        for (const v of n) {
          y = rel ? y + v : v
          out.push({ kind: 'line', x, y })
        }
        break
      }
      case 'C': {
        for (let i = 0; i + 5 < n.length; i += 6) {
          const seg = {
            kind: 'curve' as const,
            x1: rel ? x + n[i] : n[i],
            y1: rel ? y + n[i + 1] : n[i + 1],
            x2: rel ? x + n[i + 2] : n[i + 2],
            y2: rel ? y + n[i + 3] : n[i + 3],
            x: rel ? x + n[i + 4] : n[i + 4],
            y: rel ? y + n[i + 5] : n[i + 5],
          }
          x = seg.x
          y = seg.y
          out.push(seg)
        }
        break
      }
      case 'Q': {
        for (let i = 0; i + 3 < n.length; i += 4) {
          const seg = {
            kind: 'quad' as const,
            x1: rel ? x + n[i] : n[i],
            y1: rel ? y + n[i + 1] : n[i + 1],
            x: rel ? x + n[i + 2] : n[i + 2],
            y: rel ? y + n[i + 3] : n[i + 3],
          }
          x = seg.x
          y = seg.y
          out.push(seg)
        }
        break
      }
      case 'Z': {
        out.push({ kind: 'close' })
        x = startX
        y = startY
        break
      }
      default:
        // Better a loud failure than a shape that is quietly not the shape.
        throw new Error(`svgPath: unsupported command "${cmd}"`)
    }
    void at
    void atY
  }
  return out
}

/** The box a set of segments occupies — control points included, which is a
 *  slight over-estimate for curves and exactly what is wanted for fitting: a
 *  shape scaled to its control hull never overflows its frame. */
export function boundsOf(segs: Seg[]): { x: number; y: number; w: number; h: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const see = (px: number, py: number) => {
    minX = Math.min(minX, px)
    minY = Math.min(minY, py)
    maxX = Math.max(maxX, px)
    maxY = Math.max(maxY, py)
  }
  for (const s of segs) {
    if (s.kind === 'close') continue
    see(s.x, s.y)
    if (s.kind === 'curve') {
      see(s.x1, s.y1)
      see(s.x2, s.y2)
    }
    if (s.kind === 'quad') see(s.x1, s.y1)
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** Trace segments onto a context, mapped by a linear fit. `map` takes a point
 *  in the path's own coordinates and returns one in the canvas's. */
export function tracePath(
  ctx: CanvasRenderingContext2D,
  segs: Seg[],
  map: (x: number, y: number) => { x: number; y: number },
): void {
  for (const s of segs) {
    if (s.kind === 'close') {
      ctx.closePath()
      continue
    }
    const p = map(s.x, s.y)
    if (s.kind === 'move') ctx.moveTo(p.x, p.y)
    else if (s.kind === 'line') ctx.lineTo(p.x, p.y)
    else if (s.kind === 'quad') {
      const c1 = map(s.x1, s.y1)
      ctx.quadraticCurveTo(c1.x, c1.y, p.x, p.y)
    } else {
      const c1 = map(s.x1, s.y1)
      const c2 = map(s.x2, s.y2)
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p.x, p.y)
    }
  }
}
