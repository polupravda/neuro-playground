import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  chargeBadgeAt,
  drawIonCharge,
  badgeMinR,
  BADGE_FRACTION,
  BADGE_MIN,
  BADGE_MAX,
  BADGE_MIN_SCREEN_PX,
} from './particleStyle'
import { ION_R, CAP_SCALE } from './capacitorScene'

// One property, one drawing. The app used to show an ion's charge three
// different ways; this pins the single one it uses now.

describe("an ion's charge badge", () => {
  it('hovers just off the top-right shoulder, close in', () => {
    const r = 4
    const at = chargeBadgeAt(100, 100, r)
    expect(at.x).toBeGreaterThan(100)
    expect(at.y).toBeLessThan(100)
    // Close: the badge's centre sits within half a body-radius of the ball's
    // edge, not floating away from it (the permeability bench's old plus was
    // more than two radii out).
    // The disc overlaps the ball's shoulder rather than floating away from it
    // (the permeability bench's old plus sat more than two radii out).
    const centreGap = Math.hypot(at.x - 100, at.y - 100)
    expect(centreGap).toBeLessThan(r * 1.3)
    expect(at.r).toBeGreaterThan(0)
  })

  it('scales with the ion it belongs to', () => {
    const small = chargeBadgeAt(0, 0, 2)
    const big = chargeBadgeAt(0, 0, 8)
    expect(Math.hypot(big.x, big.y)).toBeGreaterThan(Math.hypot(small.x, small.y))
    expect(big.arm).toBeGreaterThan(small.arm)
  })

  it('is a filled disc with a cross for +, a bar for −, nothing for neutral', () => {
    const drawn = (charge: number) => {
      const c = strictCanvas()
      drawIonCharge(c.ctx, 50, 50, 4, charge)
      return { moves: c.calls.filter((k) => k === 'moveTo').length, discs: c.calls.filter((k) => k === 'arc').length }
    }
    // The atomic charge-playground badge: one coloured disc, a white glyph
    // inside it — two strokes for a plus, one for a minus.
    expect(drawn(1)).toEqual({ moves: 2, discs: 1 })
    expect(drawn(-1)).toEqual({ moves: 1, discs: 1 })
    expect(drawn(0)).toEqual({ moves: 0, discs: 0 })
  })

  it('paints the disc in the charge inks, never a body colour', () => {
    for (const [q, ink] of [[1, '#ef4444'], [-1, '#0ea5e9']] as const) {
      const c = strictCanvas()
      drawIonCharge(c.ctx, 10, 10, 4, q)
      // The last fill set is the disc's; white belongs to the glyph stroke.
      expect(c.ctx.fillStyle).toBe(ink)
      expect(c.ctx.strokeStyle).toBe('#ffffff')
    }
  })

  it('is proportional at EVERY size — no pixel floors, because callers scale', () => {
    // The bug this pins: absolute floors ("at least 2 px wide") inside a
    // membrane patch scaled by ×3100 drew strokes wider than the screen, and
    // the whole app went solid red. Nothing may be constant here.
    const tiny = 0.001
    const at = chargeBadgeAt(0, 0, tiny)
    expect(at.arm).toBeLessThan(tiny)
    expect(at.r).toBeLessThan(tiny)
    expect(Math.hypot(at.x, at.y)).toBeLessThan(tiny * 2)
    const c = strictCanvas()
    drawIonCharge(c.ctx, 0, 0, tiny, 1)
    expect(c.ctx.lineWidth).toBeLessThan(tiny)
  })

  it('survives a strict canvas at crowd sizes', () => {
    for (const r of [1.5, 2.4, 3.4, 8]) {
      for (const q of [1, -1, 2]) {
        const c = strictCanvas()
        drawIonCharge(c.ctx, 20, 20, r, q)
        expect(c.calls).toContain('stroke')
      }
    }
  })
})

describe('the badge size rule', () => {
  it('is a fraction of the ball, the same fraction at every size', () => {
    const small = chargeBadgeAt(0, 0, 3)
    const big = chargeBadgeAt(0, 0, 30)
    expect(small.r / 3).toBeCloseTo(big.r / 30, 10)
    expect(small.r / 3).toBeCloseTo(BADGE_FRACTION, 10)
  })

  it('clamps a view’s nudge between MIN and MAX', () => {
    // A view may nudge the fraction — never past the bounds, because below MIN
    // the glyph stops being legible and above MAX the badge outshouts the ion.
    expect(chargeBadgeAt(0, 0, 10, 0.01).r).toBeCloseTo(10 * BADGE_MIN, 10)
    expect(chargeBadgeAt(0, 0, 10, 9).r).toBeCloseTo(10 * BADGE_MAX, 10)
    expect(BADGE_MIN).toBeLessThan(BADGE_FRACTION)
    expect(BADGE_FRACTION).toBeLessThan(BADGE_MAX)
  })

  it('states its bounds as fractions, never as pixels', () => {
    // The bounds must survive a context magnified by thousands: a pixel floor
    // there is a badge wider than the screen.
    const tiny = chargeBadgeAt(0, 0, 0.001, 0.01)
    expect(tiny.r).toBeLessThan(0.001)
  })
})

describe('the badge floor', () => {
  it('is the charge bench’s own badge — the reference size (user, 2026-08-28)', () => {
    // If the charge bench ever redraws its ions at a different size, this
    // tells us the floor has drifted from the thing that defines it.
    const benchBadgeCss = ION_R * BADGE_FRACTION * CAP_SCALE
    expect(benchBadgeCss).toBeCloseTo(BADGE_MIN_SCREEN_PX, 1)
  })

  it('converts to the caller’s own units — never applied as raw pixels', () => {
    expect(badgeMinR(2)).toBeCloseTo(BADGE_MIN_SCREEN_PX / 2, 10)
    // Inside a patch magnified ×1000, the same apparent size is a thousandth
    // of the units — which is the whole reason the helper does not own it.
    expect(badgeMinR(1000)).toBeCloseTo(BADGE_MIN_SCREEN_PX / 1000, 10)
  })

  it('lifts a badge that would otherwise be too small to read', () => {
    // Big enough that the "never bigger than its ion" cap is not what bites.
    const small = 5
    const floored = chargeBadgeAt(0, 0, small, BADGE_FRACTION, badgeMinR(1))
    expect(floored.r).toBeGreaterThan(small * BADGE_FRACTION)
    expect(floored.r).toBeCloseTo(BADGE_MIN_SCREEN_PX, 10)
  })

  it('never lets the floor grow a badge bigger than its own ion', () => {
    const tiny = 0.5
    const at = chargeBadgeAt(0, 0, tiny, BADGE_FRACTION, 99)
    expect(at.r).toBeLessThanOrEqual(tiny)
  })
})
