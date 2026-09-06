import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { HALF_MEM, HEAD_GAP, drawLipids, lipidJiggle, paveMembrane } from './bilayer'
import { CAP_SCALE, CAP_WALL_Y, drawCapacitor } from './capacitorScene'
import { WALL_Y as GATE_WALL_Y, drawFamilyPanel } from './gatingScene'
import { CH_SCALE, WALL_Y as CH_WALL_Y, drawSide } from './channelScene'
import { drawSnare2, snareGeometry } from './snareScene'

// 21c-7 — JIGGLY LIPIDS, the default bilayer. The lipid lab's thermal jiggle
// reached the shared paver in 21c-6; this round it reaches `drawLipids`, which
// is what the six bench views draw their walls with — and each LEAFLET moves on
// its own beat, because two lipids facing each other across the oily middle are
// neighbours, not a molecule.

describe('jiggly lipids — the shared bilayer moves', () => {
  it('A1 (21c-7): a drawLipids wall MOVES with the clock, and stands still without one', () => {
    const at = (ms?: number) => {
      const c = strictCanvas()
      drawLipids(c.ctx, { midY: 100, from: 0, to: 220, ...(ms === undefined ? {} : { ms }) })
      return c.points
    }
    // No clock: byte-for-byte what every caller written before the clock drew.
    const a0 = at()
    const b0 = at()
    expect(a0).toEqual(b0)
    // With a clock: the same population, somewhere slightly else each moment.
    const a = at(0)
    const b = at(900)
    expect(a.length).toBe(b.length)
    let moved = 0
    for (const [i, p] of a.entries()) {
      if (Math.hypot(p.x - b[i].x, p.y - b[i].y) > 0.3) moved++
    }
    expect(moved, 'the wall stands still under a running clock').toBeGreaterThan(a.length * 0.5)
  })

  it('A4 (21c-7): the two leaflets of one slot move INDEPENDENTLY', () => {
    // ⚠ (user: "lipids move individually, not in bond with an opponent".) One
    // jiggle applied to the pair moved a head and the head facing it as one
    // RIGID object — and a rigid object keeps its internal distances, however
    // it translates and rotates. So the claim is asked as the thing that
    // separates rigid from liquid: the DISTANCE between the two leaflets'
    // centres must change with the clock. (An earlier version compared the two
    // sides' average drifts, and a rigid ROTATION also makes those differ — the
    // bonded break sailed through it.)
    // ⚠ Bucketed by DRAW ORDER, not by which side of the midline a mark lands
    // on: a rigid rotation swings tail marks across the midline, so a
    // current-y bucketing sees the gap change even when the pair is bonded —
    // which is exactly how the bonded break sailed through the first version.
    // One slot draws leaflet −1 first, then leaflet +1, each the same number
    // of marks: the stream's first half IS the outer leaflet.
    const gap = (draw: (ctx: CanvasRenderingContext2D) => void) => {
      const c = strictCanvas()
      draw(c.ctx)
      const pts = c.points
      expect(pts.length % 2).toBe(0)
      const mean = (arr: { x: number; y: number }[]) => ({
        x: arr.reduce((s, p) => s + p.x, 0) / arr.length,
        y: arr.reduce((s, p) => s + p.y, 0) / arr.length,
      })
      const o = mean(pts.slice(0, pts.length / 2))
      const i = mean(pts.slice(pts.length / 2))
      return Math.hypot(o.x - i.x, o.y - i.y)
    }
    // ⚠ ONE SLOT, sized off the app's own spacing — `to: 8` happened to hold
    // TWO molecules, so the halves compared were neighbours, not the pair, and
    // the bonded break sailed through: neighbours are on different beats even
    // when their own leaflets are bonded. Measured: 20 marks at `to: 8`, 10 at
    // one slot.
    const oneSlot = { midY: 100, from: 0, to: HEAD_GAP * 1.2 }
    const gaps = [0, 700, 1400, 2100].map((ms) =>
      gap((ctx) => drawLipids(ctx, { ...oneSlot, ms })),
    )
    const spread = Math.max(...gaps) - Math.min(...gaps)
    // ⚠ Measured: independent leaflets breathe the gap by 0.095 px over these
    // four moments; a bonded pair by 1.4e-14 — floating-point dust. The line
    // sits between the two real values, not at a round number.
    expect(spread, 'the two leaflets still move as one molecule').toBeGreaterThan(0.03)
  })

  it('A4 (21c-7): the PAVER’s two leaflets part company too', () => {
    // The same rigid-vs-liquid question, put to the paver: the distance
    // between the leaflets' centres must change with the clock.
    const gap = (ms: number) => {
      const c = strictCanvas()
      paveMembrane(
        c.ctx,
        [{ at: { x: 50, y: 50 }, tangent: { x: 1, y: 0 }, inward: { x: 0, y: 1 } }],
        { geom: { headR: 4, halfMem: HALF_MEM }, first: 0, taperOver: 0, ms },
      )
      // Bucketed by draw order, for the same reason as above.
      const pts = c.points
      expect(pts.length % 2).toBe(0)
      const mean = (arr: { x: number; y: number }[]) => ({
        x: arr.reduce((s, p) => s + p.x, 0) / arr.length,
        y: arr.reduce((s, p) => s + p.y, 0) / arr.length,
      })
      const o = mean(pts.slice(0, pts.length / 2))
      const i = mean(pts.slice(pts.length / 2))
      return Math.hypot(o.x - i.x, o.y - i.y)
    }
    const gaps = [0, 700, 1400, 2100].map(gap)
    // Same measured separation as above: real motion ~0.1 px, a bonded pair
    // gives dust.
    expect(
      Math.max(...gaps) - Math.min(...gaps),
      'the paver still moves the pair as one',
    ).toBeGreaterThan(0.03)
  })

  it('A1 (21c-7): the bench views really hand the paver their clock', () => {
    // ⚠ Measured END TO END on three of the six views — one per call shape
    // (plain px, local coordinates, a scaled context) — not read off the
    // source: a scene that computes ms and never passes it would satisfy a
    // grep. The other three (permeability, patch, resting) thread the same
    // parameter through the same function; their fixtures are heavy and the
    // mechanism is this one.
    // ⚠ Counted INSIDE THE MEMBRANE'S OWN BAND. "Did anything move?" let a
    // break through: the capacitor's charge marks ride the same clock, so a
    // wall that had dropped its clock still counted as moving. Only marks
    // within a band around each view's own wall line are counted.
    const wallMoved = (
      draw: (ctx: CanvasRenderingContext2D, ms: number) => void,
      wallY: number,
      band: number,
    ) => {
      const at = (ms: number) => {
        const c = strictCanvas()
        draw(c.ctx, ms)
        return c.points.filter((p) => Math.abs(p.y - wallY) < band)
      }
      const a = at(0)
      const b = at(900)
      expect(a.length, 'no marks in the wall band at all').toBeGreaterThan(20)
      if (a.length !== b.length) return true
      let n = 0
      for (const [i, p] of a.entries()) {
        if (Math.hypot(p.x - b[i].x, p.y - b[i].y) > 0.3) n++
      }
      return n > 10
    }
    expect(
      wallMoved((ctx, ms) => drawCapacitor(ctx, -70, ms, false), CAP_WALL_Y * CAP_SCALE, 40),
      'the capacitor wall stands still',
    ).toBe(true)
    expect(
      wallMoved((ctx, ms) => drawFamilyPanel(ctx, 'leak', null, ms), GATE_WALL_Y, 60),
      'the gating wall stands still',
    ).toBe(true)
    // ⚠ AND THE RULE'S OTHER HALF (21c-8, user: "restore static lipids in 'ion
    // channel structure'. Change the rule…"): a view whose resting picture is a
    // STILL keeps still lipids — the channel-structure wall must NOT move —
    // while a view whose bilayer is the ACTOR (the SNARE bench: fusion and
    // retrieval happen TO the membrane) jiggles even parked on a still.
    expect(
      wallMoved((ctx, ms) => drawSide(ctx, null, ms, false), CH_WALL_Y * CH_SCALE, 90),
      'the channel wall moves under a still view',
    ).toBe(false)
    expect(
      wallMoved((ctx, ms) => drawSnare2(ctx, { u: 0.05, ms }), snareGeometry().wallY, 40),
      'the snare wall stands still',
    ).toBe(true)
  })

  it('A4 (21c-7): the phase belongs to the SLOT, not the pushed x', () => {
    // ⚠ `pushAt` moves a molecule every frame while a wall parts; an identity
    // that rides the pushed x re-rolls the phase as it moves — a shimmer, not a
    // jostle. Asked as the invariant that separates the two: the DRIFT between
    // two moments must be the same whether the molecule is pushed or not,
    // because the push moves the anchor and the jiggle must not notice.
    const drift = (push: number) => {
      const at = (ms: number) => {
        const c = strictCanvas()
        drawLipids(c.ctx, { midY: 100, from: 0, to: HEAD_GAP * 1.2, ms, pushAt: () => push })
        return c.points
      }
      const a = at(0)
      const b = at(700)
      expect(a.length).toBe(b.length)
      return a.map((p, i) => ({ dx: b[i].x - p.x, dy: b[i].y - p.y }))
    }
    const still = drift(0)
    const pushed = drift(7)
    expect(still.length).toBe(pushed.length)
    for (const [i, d] of still.entries()) {
      expect(
        Math.hypot(d.dx - pushed[i].dx, d.dy - pushed[i].dy),
        'the phase re-rolls when the wall parts',
      ).toBeLessThan(0.01)
    }
  })

  it('A4 (21c-7): the jiggle is deterministic — same clock, same picture', () => {
    // Seeded, never Math.random: a guard can walk it, and a paused frame is
    // still. The identity is the slot, so the phase never re-rolls mid-run.
    expect(lipidJiggle(7, 1234, false)).toEqual(lipidJiggle(7, 1234, false))
    const a = strictCanvas()
    drawLipids(a.ctx, { midY: 100, from: 0, to: 220, ms: 555 })
    const b = strictCanvas()
    drawLipids(b.ctx, { midY: 100, from: 0, to: 220, ms: 555 })
    expect(a.points).toEqual(b.points)
  })
})
