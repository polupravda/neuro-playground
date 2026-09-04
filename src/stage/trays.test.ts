import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  TRAY,
  TRAY_H,
  TRAY_LINE,
  TRAY_R,
  TRAY_W,
  TRAY_Y,
  RS_W,
  drawResting,
} from './restingScene'
import { REAL_WALL, restingMvOf } from '../core/resting'
import {
  containers,
  drawPermea,
  PERMEA_SCALE,
  PERMEA_TRAY_R,
  PERMEA_TRAY_LINE,
} from './permeaScene'

// ⚠ ONE TRAY, TWO BENCHES (user, 2026-08-30: "align buckets appearance with
// those seen in the 'membrane permeability' demo. Currently shape, height,
// outline, margin are wrong" — and "place the molecules sitting on the
// buckets").
//
// The two benches had drawn their trays differently for a round: the resting
// one's were a different size with a fixed gap round a centred cluster, and
// they disagreed about whether the thing on offer sat IN the tray or ON its
// rim. The user saw both and chose one for both, so this file is the guard
// that they cannot drift apart again.

// ACTION LIST REFERENCES (the working agreement, 2026-08-30):
//   • 2026-08-30 "improve their buckets… place the channels overlapping with
//     the top border" — guarded by "sits what is on offer ON the rim".
//   • 2026-08-30 "align buckets appearance with those seen in the 'membrane
//     permeability' demo. Currently shape, height, outline, margin are wrong"
//     — guarded by "is the same box, to the pixel" and "spreads them the same
//     way".
//   • 2026-08-30 "place the molecules 'sitting' on the buckets" (permeability)
//     — the second half of the rim test.

describe('the two benches share one tray', () => {
  it('is the same box, to the pixel', () => {
    const permea = containers()[0]
    // The permeability bench works in its own logical units and draws at
    // PERMEA_SCALE; the resting bench works in CSS pixels. Compared where they
    // are actually seen — on the screen.
    expect(permea.w * PERMEA_SCALE).toBeCloseTo(TRAY_W, 6)
    expect(permea.h * PERMEA_SCALE).toBeCloseTo(TRAY_H, 6)
  })

  it('is the same SHAPE, which is what width and height do not tell you', () => {
    // ⚠ THIS TEST'S ABSENCE IS WHY THE BUCKETS WERE WRONG TWICE (user,
    // 2026-08-30: "buckets look incorrect, they should look identical").
    //
    // The sizes matched all along. What did not was the corner radius and the
    // rim: the permeability bench draws inside a ×4 context, so its literal
    // `roundRect(…, 6)` and `lineWidth = 1` land as **24 px and 4 px** on
    // screen — and a 24 px radius on a 26 px box is clamped by canvas to half
    // the height, making a PILL. Copying its raw numbers gave a
    // gently-rounded rectangle with a hairline, and a test on width and height
    // could not see the difference.
    expect(TRAY_R).toBe(TRAY_H / 2)
    expect(TRAY_LINE).toBe(PERMEA_TRAY_LINE * PERMEA_SCALE)
    // The reference's own radius, once clamped and scaled, is this same pill.
    expect(Math.min(PERMEA_TRAY_R, containers()[0].h / 2) * PERMEA_SCALE).toBeCloseTo(TRAY_R, 6)
  })

  it('spreads them the same way — evenly across the width', () => {
    // `containers()` centres each tray in its own slot of the full width. A
    // fixed gap round a centred cluster was the margin that read as wrong.
    const slot = RS_W / TRAY.length
    for (const [i, t] of TRAY.entries()) {
      expect(t.x).toBeCloseTo(slot * (i + 0.5), 6)
    }
    // Which is symmetric, so the row is still centred as a whole.
    const xs = TRAY.map((t) => t.x)
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(RS_W / 2, 6)
  })

  it('keeps every tray inside the canvas with room for its rim', () => {
    for (const t of TRAY) {
      expect(t.x - TRAY_W / 2).toBeGreaterThan(0)
      expect(t.x + TRAY_W / 2).toBeLessThan(RS_W)
    }
    expect(TRAY_Y + TRAY_H / 2).toBeLessThan(RS_W)
  })

  it('sits what is on offer ON the rim, in both benches', () => {
    // The resting bench's side of it — the permeability bench's is checked by
    // its own suite, and both now draw at the tray's TOP edge rather than its
    // middle.
    // ⚠ A FIRST VERSION OF THIS ASSERTED `c.y < c.y + c.h / 2`, which is true
    // of every tray ever drawn and tested nothing at all. Measured off the
    // actual drawing instead, the way the resting bench's is.
    const tank = strictCanvas()
    drawPermea(tank.ctx, [], true)
    for (const c of containers()) {
      // ⚠ IN DEVICE COORDINATES. `drawPermea` works in the bench's own logical
      // units inside a context scaled by PERMEA_SCALE, and `strictCanvas`
      // records path points through the current transform — so `containers()`
      // and the recorded ink are in two different spaces until this conversion.
      // Without it the window found nothing and the test read `Infinity`.
      const cx = c.cx * PERMEA_SCALE
      const top = c.y * PERMEA_SCALE
      const w = c.w * PERMEA_SCALE
      const h = c.h * PERMEA_SCALE
      // ⚠ CONFINED TO THE TRAY'S OWN BAND. A window of ±2 tray-heights caught
      // the SPEAKER GLYPH for the tray's name, which sits just below the box
      // and is drawn from lines — nine of its points against the sample's two,
      // so it dragged the mean 33 px down and the test failed whatever the
      // sample did.
      const near = tank.points.filter(
        (p) =>
          Math.abs(p.x - cx) < w / 2 - 2 && p.y > top - h && p.y < top + h - 2,
      )
      expect(near.length).toBeGreaterThan(0)
      // ⚠ MEASURED AS THE SAMPLE'S CENTRE, not its topmost ink. `strictCanvas`
      // records an `arc` by its CENTRE, not its extent — and this molecule is
      // drawn from arcs — so "highest ink" came out at exactly the tray's top
      // edge whether the sample sat on the rim or inside the box, and the test
      // failed both ways. Where its atoms are CENTRED does discriminate: on
      // the rim they cluster at the top edge, inside they cluster half a tray
      // lower.
      const middle = near.reduce((sum, p) => sum + p.y, 0) / near.length
      expect(Math.abs(middle - top)).toBeLessThan(h * 0.4)
    }

    const c = strictCanvas()
    drawResting(c.ctx, REAL_WALL, restingMvOf(REAL_WALL), 1200, null)
    const rim = TRAY_Y - TRAY_H / 2
    for (const t of TRAY) {
      const near = c.points.filter(
        (p) => Math.abs(p.x - t.x) < TRAY_W / 2 - 2 && Math.abs(p.y - TRAY_Y) < 60,
      )
      expect(Math.min(...near.map((p) => p.y))).toBeLessThan(rim)
    }
  })
})
