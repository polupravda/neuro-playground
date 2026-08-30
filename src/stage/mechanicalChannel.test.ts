import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { HALF_MEM } from './bilayer'
import { drawMechanicalChannel, mechanicalHalfWidth } from './mechanicalChannel'
import { drawLigandChannel, ligandHalfWidth, SEPARATION } from './ligandChannel'
import { membraneBend, PANEL_W } from './gatingScene'

const base = {
  cx: 0,
  midY: 0,
  halfHeight: HALF_MEM,
  species: '#22d3ee',
  speciesDark: '#0e7490',
}

describe('the mechanically-gated channel, traced', () => {
  it('draws at every openness with real colours and finite numbers', () => {
    for (const open of [0, 0.25, 0.5, 0.75, 1]) {
      const c = strictCanvas()
      drawMechanicalChannel(c.ctx, { ...base, open })
      // Three subunits, each filled and stroked.
      expect(c.calls.filter((k) => k === 'fill').length).toBeGreaterThanOrEqual(3)
      expect(c.calls.filter((k) => k === 'stroke').length).toBeGreaterThanOrEqual(3)
    }
  })

  it('is WIDER open than shut, and by the separation the drawing measures', () => {
    // The whole mechanism, in one number: the subunits come apart. If this
    // ever reads zero the channel is opening by nothing at all.
    expect(mechanicalHalfWidth(HALF_MEM)).toBeGreaterThan(0)
    const k = (2 * HALF_MEM * 1.12) / 60.87
    expect(mechanicalHalfWidth(HALF_MEM) * 2).toBeGreaterThan(SEPARATION * k)
  })

  it('has NO binding socket — nothing lands on it', () => {
    // ⚠ What makes it mechanical is that no messenger and no charge opens it.
    // A socket drawn here would be the ligand-gated channel wearing a
    // different name. `socket: true` must therefore draw nothing extra.
    const plain = strictCanvas()
    const asked = strictCanvas()
    drawMechanicalChannel(plain.ctx, { ...base, open: 1 })
    drawMechanicalChannel(asked.ctx, { ...base, open: 1, socket: true })
    expect(asked.calls).toEqual(plain.calls)
  })

  it('is a DIFFERENT SILHOUETTE from the ligand-gated one', () => {
    // Both open by separating, and it would be easy for one to quietly become
    // a copy of the other. They are two drawings, and they must stay two.
    expect(mechanicalHalfWidth(HALF_MEM)).not.toBeCloseTo(ligandHalfWidth(HALF_MEM), 3)
    const mech = strictCanvas()
    const lig = strictCanvas()
    drawMechanicalChannel(mech.ctx, { ...base, open: 0 })
    drawLigandChannel(lig.ctx, { ...base, open: 0 })
    expect(mech.calls.length).not.toEqual(lig.calls.length)
  })

  it('moves smoothly — no teleport between one frame and the next', () => {
    // Positions are read off the pore's own edge: half its width, which is
    // what the separation moves.
    const at = (open: number) => {
      const c = strictCanvas()
      drawMechanicalChannel(c.ctx, { ...base, open })
      return c.points.map((p) => p.x)
    }
    let worst = 0
    let prev = at(0)
    for (let i = 1; i <= 20; i++) {
      const now = at(i / 20)
      expect(now.length).toBe(prev.length)
      for (const [j, x] of now.entries()) worst = Math.max(worst, Math.abs(x - prev[j]))
      prev = now
    }
    // A twentieth of the travel, with a little slack. A swap between two drawn
    // states would show up here as the whole travel in one step.
    expect(worst).toBeLessThan(1.2)
    expect(worst).toBeGreaterThan(0)
  })
})

describe('the push curves the wall', () => {
  it('sags most under the finger and not at all far from it', () => {
    const b = membraneBend(1)
    expect(b.at(0)).toBeCloseTo(b.dip, 6)
    expect(b.dip).toBeGreaterThan(0)
    // Away from the finger the wall is where it always was — which is what
    // makes it a BEND rather than the whole membrane going down in a lift.
    expect(b.at(400)).toBe(0)
    expect(b.at(-400)).toBe(0)
    // Monotone in between, either side.
    for (let x = 0; x < 200; x += 5) {
      expect(b.at(x + 5)).toBeLessThanOrEqual(b.at(x) + 1e-9)
      expect(b.at(-x - 5)).toBeLessThanOrEqual(b.at(-x) + 1e-9)
    }
  })

  it('is symmetric, and flat where it meets the undisturbed wall', () => {
    const b = membraneBend(0.7)
    for (const x of [3, 17, 44, 80, 130]) expect(b.at(x)).toBeCloseTo(b.at(-x), 9)
    // No crease at the join: the slope dies away as the sag does.
    expect(b.slope(0)).toBeCloseTo(0, 9)
    expect(Math.abs(b.slope(400))).toBe(0)
    expect(Math.abs(b.slope(PANEL_W * 0.42 - 0.1))).toBeLessThan(0.01)
  })

  it('gives a slope that really is the sag it is drawn from', () => {
    // ⚠ MEASURE, NEVER ASSERT. If `slope` drifted from `at`, every lipid would
    // stand at the wrong angle on a surface that looked right — the kind of
    // fault nobody finds by looking. So the slope is checked against the
    // curve's own difference quotient.
    const b = membraneBend(0.85)
    const h = 0.01
    for (const x of [-70, -40, -12, 0, 9, 33, 66]) {
      const numeric = (b.at(x + h) - b.at(x - h)) / (2 * h)
      expect(b.slope(x)).toBeCloseTo(numeric, 4)
    }
  })

  it('is SLIGHT — a stretch, not a fold', () => {
    // A membrane bent double is a rupture, and the exhibit is about a wall
    // that stretches and springs back. MEASURED across the whole bend rather
    // than sampled at a lucky x — the steepest point moves if the shape is
    // ever retuned, and a test that missed it would pass a fold.
    const b = membraneBend(1)
    expect(b.dip).toBeLessThan(HALF_MEM * 2.4)
    let steepest = 0
    for (let x = -200; x <= 200; x += 0.5) steepest = Math.max(steepest, Math.abs(b.slope(x)))
    // Under 1 in 2 — about 27°, a sag rather than a crease.
    expect(steepest).toBeLessThan(0.5)
    expect(steepest).toBeGreaterThan(0.05)
  })

  it('does nothing at all when nobody is pushing', () => {
    const b = membraneBend(0)
    expect(b.dip).toBe(0)
    for (const x of [-90, -10, 0, 25, 90, 400]) {
      expect(b.at(x)).toBe(0)
      expect(Math.abs(b.slope(x))).toBe(0)
    }
  })

  it('grows with the press, without a jump', () => {
    let prev = membraneBend(0).dip
    let worst = 0
    for (let i = 1; i <= 40; i++) {
      const now = membraneBend(i / 40).dip
      expect(now).toBeGreaterThanOrEqual(prev)
      worst = Math.max(worst, now - prev)
      prev = now
    }
    expect(worst).toBeLessThan(HALF_MEM * 2.4 * 0.06)
  })
})
