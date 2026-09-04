import { SIGNAL_RGB } from './signal'
import { DENDRITE_SEGS, DENDRITE_STROKES, strokeWidthAt } from './layout'
import { describe, expect, it } from 'vitest'
import { outgoingDetailAt, markerStyle } from './drawScene'

describe('the whole-cell scene', () => {
  it('M1: the outgoing synapse DISSOLVES between representations — never both on screen', () => {
    // The blob-and-line stand-ins are gone before the demo's own anatomy
    // arrives; at ×1 only the stand-ins, at the demo's scale only the anatomy.
    expect(outgoingDetailAt(1)).toEqual({ standIn: 1, anatomy: 0 })
    expect(outgoingDetailAt(400).standIn).toBe(0)
    expect(outgoingDetailAt(400).anatomy).toBe(1)
    for (let i = 0; i <= 300; i++) {
      const zoom = Math.pow(10, (i / 300) * 3)
      const d = outgoingDetailAt(zoom)
      expect(
        d.standIn > 0.01 && d.anatomy > 0.01,
        `both visible at ×${zoom.toFixed(1)}`,
      ).toBe(false)
      // And each ramp is a dissolve, not a switch: values stay in [0, 1].
      expect(d.standIn).toBeGreaterThanOrEqual(0)
      expect(d.standIn).toBeLessThanOrEqual(1)
      expect(d.anatomy).toBeGreaterThanOrEqual(0)
      expect(d.anatomy).toBeLessThanOrEqual(1)
    }
  })
})

describe('a zoom marker is findable at rest (corrections 2026-09-04)', () => {
  // A1/A2: "magnifying glass areas are not visible on the big neuron, as
  // things got more cluttered. Make the hover state into active state, but
  // without labels. On hover add yellow glow and labels."
  const rest = markerStyle(false)
  const hot = markerStyle(true)

  it('A1: resting carries the prominence hover used to — ring and icon at full', () => {
    expect(rest.ringAlpha).toBe(1)
    expect(rest.iconAlpha).toBe(1)
    // As strong as the hovered one: hover is not how you find a door.
    expect(rest.ringAlpha).toBe(hot.ringAlpha)
    expect(rest.iconAlpha).toBe(hot.iconAlpha)
  })

  it('A1: resting carries NO label', () => {
    expect(rest.label).toBe(false)
    expect(hot.label).toBe(true)
  })

  it('A2/A3: navigation is yellow in BOTH states; the glow is hover’s alone', () => {
    // ⚠ Yellow was briefly reserved for hover. The user's call (2026-09-04,
    // "make nav dashed circles yellow") unified it instead: the miniature's
    // "you are here" ring was already amber, so one yellow dashed circle now
    // means one thing on both pictures. Hover is told apart by the glow and
    // the name, which is a difference you can see without a comparison.
    expect(rest.ink).toBe(SIGNAL_RGB)
    expect(hot.ink).toBe(SIGNAL_RGB)
    expect(rest.glow).toBe(0)
    expect(hot.glow).toBeGreaterThan(0)
  })

  it('A1: it survives clutter by DARKENING what is behind it, in both states', () => {
    // Brightness alone cannot win against a bright scene; the backing disc is
    // what makes the marker findable over a dendrite, a bouton or a glial body.
    expect(rest.backing).toBeGreaterThan(0.4)
    expect(hot.backing).toBeGreaterThan(0.4)
  })
})

describe('the dendrite fan is drawn branch by branch, not join by join', () => {
  // A1 (user, 2026-09-04): "dendrites of the main neuron have visible dots on
  // the places where its pieces collide."
  it('A1: there are whole branches to draw, far fewer than the segments', () => {
    // The dots came from drawing the fan segment by segment under the fan's
    // own globalAlpha: two round caps overlap at every join, so the join
    // painted 1 − (1 − α)² instead of α. A branch is one mark now.
    expect(DENDRITE_STROKES.length).toBe(17)
    expect(DENDRITE_SEGS.length).toBeGreaterThan(150)
    // Which is the size of the problem: this many joins were being lit.
    expect(DENDRITE_SEGS.length - DENDRITE_STROKES.length).toBeGreaterThan(140)
  })

  it('A1: the segments are BUILT from the strokes, so the two cannot drift', () => {
    // A hit region, a ripple's route and a miniature's line all still want
    // segments. They are derived, not maintained beside the strokes.
    const fromStrokes = DENDRITE_STROKES.reduce((n, st) => n + st.pts.length - 1, 0)
    expect(DENDRITE_SEGS.length).toBe(fromStrokes)
    for (const st of DENDRITE_STROKES) {
      const own = DENDRITE_SEGS.filter(
        (sg) => sg.trunk === st.trunk && sg.depth === st.depth,
      )
      // Every point of the stroke shows up as a segment endpoint.
      expect(own.some((sg) => sg.x1 === st.pts[0].x && sg.y1 === st.pts[0].y)).toBe(true)
    }
  })

  it('A1: the ribbon really tapers, and agrees with the segments’ widths', () => {
    for (const st of DENDRITE_STROKES) {
      expect(strokeWidthAt(st, 0)).toBeCloseTo(st.w0, 9)
      expect(strokeWidthAt(st, 1)).toBeCloseTo(st.w1, 9)
      // Trunks thin toward the tip; twigs are already thin all the way.
      if (st.depth === 0) expect(st.w1).toBeLessThan(st.w0)
    }
  })
})
