import { describe, expect, it } from 'vitest'
import { activeIndex, chipCenter, chipWidth, glideAt, glideDuration, labelRows } from './timelineMath'
import { STEP_NAMES, apBar, apSteps } from '../core/apSteps'
import { AP_MS } from '../core/actionPotential'
import { ION_KINDS, IONS, particlesFor } from '../core/ions'
import type { IonCounts } from '../state/ionStore'

// The timeline tool (user, 2026-09-01). Point letters cite the ACTION LIST of
// the round that built it: A2 is "pressing a label or dot REWINDS — never a
// teleport", A1 the bar itself with its staggered names.

describe('the timeline tool — the glide (A2)', () => {
  it('a glide passes through intermediate positions — no frame ever jumps (A2)', () => {
    // Rewind across most of the bar, sampled at frame rate: every step small,
    // every step in the same direction, both ends exact.
    const from = 0.9
    const to = 0.1
    const d = glideDuration(from, to)
    let prev = glideAt(from, to, 0)
    expect(prev).toBeCloseTo(from, 9)
    for (let t = 16; t <= d + 16; t += 16) {
      const u = glideAt(from, to, t)
      expect(u).toBeLessThanOrEqual(prev + 1e-9) // backwards means backwards
      // A teleport is one frame crossing a big share of the bar.
      expect(Math.abs(u - prev)).toBeLessThan(0.05)
      prev = u
    }
    expect(glideAt(from, to, d)).toBeCloseTo(to, 9)
  })

  it('a forward press glides the same way, and further means longer (A2)', () => {
    expect(glideAt(0.2, 0.8, glideDuration(0.2, 0.8))).toBeCloseTo(0.8, 9)
    expect(glideDuration(0, 1)).toBeGreaterThan(glideDuration(0, 0.2))
    // The floor: even a short hop reads as motion, not a snap.
    expect(glideDuration(0.5, 0.52)).toBeGreaterThanOrEqual(300)
  })
})

describe('the timeline tool — the bar (A1)', () => {
  const points = [{ u: 0 }, { u: 0.05 }, { u: 0.5 }, { u: 0.95 }, { u: 1 }]

  it('the reached event is the last one at or behind the position (A1)', () => {
    expect(activeIndex(points, -0.01)).toBe(-1) // short of the first: none lit
    expect(activeIndex(points, 0)).toBe(0)
    expect(activeIndex(points, 0.4)).toBe(1)
    expect(activeIndex(points, 1)).toBe(4)
  })

  it('names that would collide drop to a lower row; names with room stay up (A1)', () => {
    const widths = [80, 80, 80, 80, 80]
    const rows = labelRows(points, 500, widths)
    // 0 and 0.05 are 25 px apart on a 500 px bar — the second must drop.
    expect(rows[0]).toBe(0)
    expect(rows[1]).toBe(1)
    // 0.5 is 225 px clear of everything — back on the top row.
    expect(rows[2]).toBe(0)
    // 0.95 and 1 collide again.
    expect(rows[3]).toBe(0)
    expect(rows[4]).toBe(1)
    // Spread points never stagger at all.
    expect(labelRows([{ u: 0 }, { u: 0.5 }, { u: 1 }], 500, [80, 80, 80])).toEqual([0, 0, 0])
  })

  it("the AP's own clustered moments never overlap — three rows where needed (2026-09-02)", () => {
    // The complaint's own fixture: the spike's five middle moments sit within
    // a fifth of the MODEL window — placed through the dwell-weighted bar
    // (`apBar`), as the transport places them, then row-solved exactly as the
    // component does, measuring every same-row pair for collision by the
    // chips' own estimated widths.
    const real = ION_KINDS.reduce((acc, kind) => {
      acc[kind] = {
        outside: particlesFor(IONS[kind].outsideMM),
        inside: particlesFor(IONS[kind].insideMM),
      }
      return acc
    }, {} as IonCounts)
    const steps = apSteps(real)
    const bar = apBar(steps, AP_MS)
    const pts = steps.map((s) => ({ u: bar.ofU(s.at), label: STEP_NAMES[s.key] }))
    for (const widthPx of [700, 1000, 1400]) {
      const widths = pts.map((p) => chipWidth(p.label))
      const rows = labelRows(pts, widthPx, widths)
      expect(Math.max(...rows)).toBeLessThanOrEqual(2)
      const lastEnd = [-Infinity, -Infinity, -Infinity]
      for (const [i, p] of pts.entries()) {
        // The DRAWN position — clamped at the ends, like the component draws it.
        const left = chipCenter(p.u, widthPx, widths[i]) - widths[i] / 2
        expect(
          left,
          `width ${widthPx}: "${pts[i].label}" collides on row ${rows[i]}`,
        ).toBeGreaterThanOrEqual(lastEnd[rows[i]] + 6)
        lastEnd[rows[i]] = left + widths[i]
      }
    }
  })
})

describe('edge chips stay inside the bar (2026-09-02)', () => {
  it('a chip at u=0 or u=1 slides inward instead of hanging over the ends', () => {
    // Centred at the ends they overlapped the pill border and the timer.
    const w = 100
    expect(chipCenter(0, 800, w) - w / 2).toBeGreaterThanOrEqual(0)
    expect(chipCenter(1, 800, w) + w / 2).toBeLessThanOrEqual(800)
    // A mid-bar chip stays exactly on its dot.
    expect(chipCenter(0.5, 800, w)).toBe(400)
    // And the dot's own x remains within the shifted chip's span, so the
    // connector line still lands on its chip.
    expect(chipCenter(0, 800, w) - w / 2).toBeLessThanOrEqual(0)
    expect(chipCenter(1, 800, w) + w / 2).toBeGreaterThanOrEqual(800)
  })
})
