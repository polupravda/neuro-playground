// The timeline tool's arithmetic, kept out of the component so it can be
// tested: where a glide is at a given instant, which event the run has
// reached, and which of two label rows a chip sits on.
//
// ⚠ REWIND, NEVER TELEPORT (user, 2026-09-01): pressing an event's label or
// dot must carry the run THROUGH the intermediate states to that moment, in
// either direction. The glide below is that motion — a pure function of its
// own elapsed time, so the component's rAF loop owns the clock and the store
// only ever sees a continuous sequence of positions.

/** One event on the bar: a name at a screen position. `note` is the sentence,
 *  which goes in `title=` — a chip carries a name, not an explanation. */
export interface TimelinePoint {
  id: string
  label: string
  /** Screen position 0→1 — the transport's own u, not model time. */
  u: number
  note?: string
}

/** How long a glide takes, real ms. A floor so a short hop still reads as
 *  motion, plus a distance term so crossing the whole bar visibly travels —
 *  but never so long the press feels ignored. */
export function glideDuration(from: number, to: number): number {
  return 350 + 1100 * Math.abs(to - from)
}

/** Where a glide is at `elapsedMs` — ease-in-out between the ends, so the run
 *  leaves gently and arrives gently instead of snapping at either end. */
export function glideAt(from: number, to: number, elapsedMs: number): number {
  const t = Math.max(0, Math.min(1, elapsedMs / glideDuration(from, to)))
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  return from + (to - from) * e
}

/** Which event the run has reached — the LAST point at or behind the position,
 *  or −1 while the run is still short of the first one. The tolerance lets a
 *  glide that lands on a point light it despite floating-point dust. */
export function activeIndex(points: { u: number }[], value: number): number {
  let found = -1
  for (const [i, p] of points.entries()) if (value >= p.u - 1e-6) found = i
  return found
}

/** A chip's rendered width, px, estimated from its label: the 🔊 (12) plus
 *  paddings and gaps (~14) plus ~5.4 px per character of 10 px text. An
 *  estimate is enough — the row solver only needs to know when two chips
 *  would truly collide. */
export function chipWidth(label: string): number {
  return 26 + label.length * 5.4
}

/** Where a chip's CENTRE sits, px: on its dot, except at the bar's ends,
 *  where a centred chip would hang half outside — into the pill's border on
 *  the left, the timer on the right (user, 2026-09-02). Edge chips slide
 *  inward just enough to stay whole; the connector line still drops at the
 *  dot's own x, which stays within the shifted chip's span. */
export function chipCenter(u: number, widthPx: number, chipW: number): number {
  return Math.min(Math.max(u * widthPx, chipW / 2), widthPx - chipW / 2)
}

/** Which label row each chip sits on — up to `maxRows` (user, 2026-09-02:
 *  "do not allow labels to overlap; if needed place them in 3 rows"). Chips
 *  are centred on their dots; each takes the FIRST row where its real left
 *  edge clears the previous chip on that row by a small gutter, judged from
 *  the chips' own estimated widths rather than a fixed guess. Only when every
 *  row is blocked does it take the roomiest — overlap is then as small as
 *  the rows allow. Points must arrive in increasing u. */
export function labelRows(
  points: { u: number }[],
  widthPx: number,
  chipWidths: number[],
  maxRows = 3,
): number[] {
  const lastEnd: number[] = Array.from({ length: maxRows }, () => -Infinity)
  return points.map((p, i) => {
    const w = chipWidths[i] ?? 60
    // The CLAMPED position — the one the chip is actually drawn at.
    const left = chipCenter(p.u, widthPx, w) - w / 2
    let row = -1
    for (let r = 0; r < maxRows; r++) {
      if (left >= lastEnd[r] + 6) {
        row = r
        break
      }
    }
    if (row < 0) {
      row = 0
      for (let r = 1; r < maxRows; r++) if (lastEnd[r] < lastEnd[row]) row = r
    }
    lastEnd[row] = left + w
    return row
  })
}
