import { describe, expect, it } from 'vitest'
import { numbersIn, parsePath, boundsOf } from './svgPath'
import { LEAK_PATHS } from './leakChannel'
import { ballPathAt, GATE_SWING } from './voltageChannel'
import { SEPARATION, ligandHalfWidth, ligandSeat } from './ligandChannel'
import { HALF_MEM } from './bilayer'

describe('reading path data', () => {
  it('splits numbers the way path data actually writes them', () => {
    // The shorthand that is hard to split by eye: a minus sign IS the
    // separator, and there is no space.
    expect(numbersIn('-56.63-6.31')).toEqual([-56.63, -6.31])
    expect(numbersIn('4.44-0.01 11.59-3.03')).toEqual([4.44, -0.01, 11.59, -3.03])
    expect(numbersIn('0.05')).toEqual([0.05])
  })

  it('treats extra pairs after a move as LINES, not more moves', () => {
    // The one piece of shorthand it would be easy to get silently wrong.
    const segs = parsePath('M0 0 10 0 10 10z')
    expect(segs.map((s) => s.kind)).toEqual(['move', 'line', 'line', 'close'])
  })

  it('follows relative commands from where it actually is', () => {
    const segs = parsePath('m10 10 l5 0 v5 h-5 z')
    expect(segs[1]).toEqual({ kind: 'line', x: 15, y: 10 })
    expect(segs[2]).toEqual({ kind: 'line', x: 15, y: 15 })
    expect(segs[3]).toEqual({ kind: 'line', x: 10, y: 15 })
  })

  it('returns to the subpath start after a close', () => {
    const segs = parsePath('m10 10 l5 5 z l1 1')
    // The line after `z` starts from (10,10) again, not from (15,15).
    expect(segs[segs.length - 1]).toEqual({ kind: 'line', x: 11, y: 11 })
  })

  it('reads a curve as one segment with both control points', () => {
    const segs = parsePath('M0 0 c1 2 3 4 5 6')
    expect(segs[1]).toEqual({ kind: 'curve', x1: 1, y1: 2, x2: 3, y2: 4, x: 5, y: 6 })
  })

  it('THROWS on a command it does not know', () => {
    // A path that quietly loses a curve looks almost right, which is the worst
    // possible failure here.
    expect(() => parsePath('M0 0 A1 1 0 0 1 2 2')).toThrow(/unsupported/i)
  })
})

describe('the traced leak channel', () => {
  it('is three subunits — two in front and one seen between them', () => {
    expect(LEAK_PATHS).toHaveLength(3)
    for (const d of LEAK_PATHS) expect(parsePath(d).length).toBeGreaterThan(3)
  })

  it('sits in the box the drawing said it does', () => {
    // The source viewBox is -81,-12 by 52x65. If a path ever falls outside
    // that, the trace has been mangled rather than merely moved.
    const all = LEAK_PATHS.flatMap((d) => parsePath(d))
    const box = boundsOf(all)
    expect(box.x).toBeGreaterThan(-82)
    expect(box.x + box.w).toBeLessThan(-28)
    expect(box.h).toBeGreaterThan(50)
    expect(box.h).toBeLessThan(80)
  })

  it('has a middle piece that overlaps both outer ones', () => {
    // Which is what makes it read as a channel with its back wall showing
    // through the gaps, rather than as three separate posts.
    const [middle, left, right] = LEAK_PATHS.map((d) => boundsOf(parsePath(d)))
    expect(middle.x).toBeLessThan(left.x + left.w)
    expect(middle.x + middle.w).toBeGreaterThan(right.x)
  })
})

describe('the traced voltage-gated channel', () => {
  it('moves its parts instead of swapping drawings', () => {
    // ⚠ The source gives each moving part TWICE, in its end positions. Drawn
    // that way an animation would jump, and a cut teaches that the door
    // changes rather than that something moves it (user, 2026-08-29: "do not
    // teleport"). Both parts travel.
    //
    // The ball rides an arc: every step of the journey is a small step.
    let biggest = 0
    let last = ballPathAt(0)
    for (let t = 0.02; t <= 1; t += 0.02) {
      const now = ballPathAt(t)
      biggest = Math.max(biggest, Math.hypot(now.x - last.x, now.y - last.y))
      last = now
    }
    // The whole journey is about 37 units; no single fiftieth of it may be a
    // leap.
    expect(biggest).toBeLessThan(3)
  })

  it('starts where it hangs and ends where it seats', () => {
    // Both read off the drawing, not chosen.
    const hanging = ballPathAt(0)
    const seated = ballPathAt(1)
    expect(hanging.x).toBeCloseTo(-6, 1)
    expect(hanging.y).toBeCloseTo(78.1, 1)
    expect(seated.x).toBeCloseTo(14, 1)
    expect(seated.y).toBeCloseTo(47.1, 1)
    // Up and inward, which is what "into the mouth" means here.
    expect(seated.y).toBeLessThan(hanging.y)
    expect(seated.x).toBeGreaterThan(hanging.x)
  })

  it('swings the flap round, and by the angle the drawing shows', () => {
    // Measured off the two drawn positions: 168° closed, 102° open.
    expect((GATE_SWING * 180) / Math.PI).toBeCloseTo(-66, 0)
  })

  it('goes round the protein rather than through it', () => {
    // A straight line from hanging to seated would cut across the channel's
    // own foot. The arc bows out first.
    const mid = ballPathAt(0.5)
    const straight = { x: (-6 + 14) / 2, y: (78.1 + 47.1) / 2 }
    expect(mid.x).toBeGreaterThan(straight.x)
  })
})

describe('the traced ligand-gated channel', () => {
  it('opens by its SUBUNITS COMING APART, not by a flap or a plug', () => {
    // ⚠ A different mechanism from the voltage-gated channel beside it, and
    // that difference is why the bench has four panels at all (user,
    // 2026-08-29). Measured off the two drawn states: 8 units of separation.
    expect(SEPARATION).toBe(8)
    const shut = ligandHalfWidth(HALF_MEM)
    expect(shut).toBeGreaterThan(0)
  })

  it('moves its binding socket WITH the subunit it is cut into', () => {
    // A messenger that stayed put while its own site slid out from under it
    // would be the same fault as landing beside the hole.
    const shut = ligandSeat(0, 0, 0, HALF_MEM)
    const open = ligandSeat(0, 0, 1, HALF_MEM)
    expect(open.x).toBeLessThan(shut.x)
    expect(open.y).toBeCloseTo(shut.y, 6)
  })

  it('slides the socket smoothly, never in a jump', () => {
    let biggest = 0
    let last = ligandSeat(0, 0, 0, HALF_MEM).x
    for (let t = 0.02; t <= 1; t += 0.02) {
      const now = ligandSeat(0, 0, t, HALF_MEM).x
      biggest = Math.max(biggest, Math.abs(now - last))
      last = now
    }
    const total = Math.abs(ligandSeat(0, 0, 1, HALF_MEM).x - ligandSeat(0, 0, 0, HALF_MEM).x)
    expect(biggest).toBeLessThan(total / 10)
  })
})
