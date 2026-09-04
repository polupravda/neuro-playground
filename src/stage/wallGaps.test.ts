import { describe, expect, it } from 'vitest'
import { HALF_MEM } from './bilayer'
import { leakHalfWidth } from './leakChannel'
import { voltageHalfWidth } from './voltageChannel'
import { ligandHalfWidth } from './ligandChannel'
import { mechanicalHalfWidth } from './mechanicalChannel'
import { CHANNEL_HALF } from './benchScene'
import { LENS_DOOR_HALF } from './axonRibbon'
import { wallGapAt, channelHalfWidthAt } from './gatingScene'

// ⚠ EVERY GAP CUT IN A BILAYER MUST BE THE WIDTH OF THE THING STANDING IN IT.
//
// A single shared constant — `CHANNEL_HALF = 21` — used to size every gap in
// the app, back when there was one generic channel drawing 21 half-wide. Each
// channel is now its own traced protein: the leak is 13.1, and the others
// differ again. The constant went on cutting holes eight pixels too wide either
// side in every bench that still used it, which the user saw as "visual gaps
// between channels and lipids" (2026-08-30).
//
// The constant is deleted and each view derives its gap from its own drawing.
// This file is the guard for ALL of them at once, because the mistake is not
// specific to any one bench — it is what happens whenever a layout number and a
// picture are allowed to be two different things.

const SNUG = 1.15

describe('a gap in the wall is the width of what stands in it', () => {
  it('fits the equilibrium bench\'s leak channel', () => {
    const drawn = leakHalfWidth(HALF_MEM)
    expect(CHANNEL_HALF).toBeGreaterThanOrEqual(drawn)
    expect(CHANNEL_HALF).toBeLessThan(drawn * SNUG)
  })

  it('fits the axon lens\'s voltage-gated doors', () => {
    const drawn = voltageHalfWidth(HALF_MEM)
    expect(LENS_DOOR_HALF).toBeGreaterThanOrEqual(drawn)
    expect(LENS_DOOR_HALF).toBeLessThan(drawn * SNUG)
  })

  it('fits every door on the gating bench, at the width it is SHUT', () => {
    // The two separating channels widen as they open; the gap is cut to their
    // shut width and the lipids are shoved aside as they grow.
    for (const id of ['leak', 'voltage', 'ligand', 'mechanical'] as const) {
      const shut = channelHalfWidthAt(id, 0)
      expect(wallGapAt(id)).toBeGreaterThanOrEqual(shut)
      expect(wallGapAt(id)).toBeLessThan(shut * SNUG)
    }
  })

  it('has no two traced proteins the same width, so no shared constant can fit', () => {
    // The reason a single number cannot come back: these are four different
    // proteins and they are four different widths.
    const widths = [
      leakHalfWidth(HALF_MEM),
      voltageHalfWidth(HALF_MEM),
      ligandHalfWidth(HALF_MEM, 0),
      mechanicalHalfWidth(HALF_MEM, 0),
    ]
    expect(new Set(widths.map((w) => w.toFixed(3))).size).toBe(widths.length)
  })
})
