import { describe, expect, it } from 'vitest'
import { outgoingDetailAt } from './drawScene'

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
