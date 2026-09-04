import { describe, expect, it } from 'vitest'
import { cargoOf } from './drawScene'
import { membraneProteins, pumpStateAt, roomFor } from './proteins'
import { restingCounts } from '../core/ions'

// ACTION LIST 2026-08-30:
//   A1 — "remove the 1-3 balls animation. Let channels open and close with no
//        flow." Step one of debugging the action-potential view together: done,
//        and it confirmed the code path.
//   A2 — the flow put back, in THIS file's view, using the app's one flow model.
//
// ⚠ AND THIS FILE EXISTS BECAUSE THE PREVIOUS THREE ATTEMPTS FIXED THE WRONG
// SCREEN. `drawRibbon` — the axon lens, where all that work went — only runs at
// the `axon-signal` camera. The action-potential row goes to `axon-membrane`,
// which `drawScene` draws, and its ions come from `cargoOf` below. Every guard
// written for the lens was green the whole time and none of them was watching
// the view being reported.
//
// So this one is on `cargoOf` itself: the function `drawProtein` actually
// calls.

const CHANNELS_IN_WALL = membraneProteins().filter((p) => p.kind === 'channel')
const PUMPS_IN_WALL = membraneProteins().filter((p) => p.kind === 'pump')

const counts = restingCounts()
/** Mid-spike, where sodium is being driven hard. */
const flow = (timeMs: number, vm = -20) => ({ timeMs, counts, vm })

describe('A2: the action-potential view carries a real current', () => {
  it('carries NOTHING through a shut door — a hole does no pushing', () => {
    for (const protein of CHANNELS_IN_WALL) {
      expect(cargoOf(protein, 'closed', null, flow(1000))).toEqual([])
    }
  })

  it('carries a CROWD through an open one, not one or two balls', () => {
    // ⚠ THE WHOLE POINT, and the thing three previous rounds failed to change
    // because they were editing a view this row does not open (user,
    // 2026-08-30: "1-3 balls"). Counted off `cargoOf`, the function
    // `drawProtein` actually calls when drawing `axon-membrane`.
    const na = CHANNELS_IN_WALL.find((p) => p.channel?.id === 'voltage-na')!
    let most = 0
    for (let ms = 0; ms < 3000; ms += 25) {
      most = Math.max(most, cargoOf(na, 'open', null, flow(ms)).length)
    }
    expect(most).toBeGreaterThan(8)
    expect(most).toBeLessThanOrEqual(roomFor('na'))
  })

  it('keeps a leak thin, so the spike door still stands out', () => {
    const leak = CHANNELS_IN_WALL.find((p) => p.channel?.id === 'leak-k')!
    const na = CHANNELS_IN_WALL.find((p) => p.channel?.id === 'voltage-na')!
    const most = (p: typeof leak, vm: number) => {
      let n = 0
      for (let ms = 0; ms < 3000; ms += 25) {
        n = Math.max(n, cargoOf(p, 'open', null, { timeMs: ms, counts, vm }).length)
      }
      return n
    }
    expect(most(leak, -72)).toBeGreaterThan(0)
    expect(most(leak, -72)).toBeLessThan(most(na, -20))
  })

  it('never leaves the door open with nothing crossing', () => {
    // A stream that stopped between balls would be back to counting
    // individuals, which is what was wrong in the first place.
    const na = CHANNELS_IN_WALL.find((p) => p.channel?.id === 'voltage-na')!
    for (let ms = 0; ms < 2000; ms += 25) {
      expect(cargoOf(na, 'open', null, flow(ms)).length).toBeGreaterThan(0)
    }
  })

  it('slides rather than reshuffling as the clock advances', () => {
    const na = CHANNELS_IN_WALL.find((p) => p.channel?.id === 'voltage-na')!
    const at = (ms: number) =>
      cargoOf(na, 'open', null, flow(ms)).map((i) => i.u).sort((a, b) => a - b)
    const a = at(1200)
    const b = at(1216)
    expect(a.length).toBe(b.length)
    for (const [i, u] of a.entries()) expect(Math.abs(b[i] - u)).toBeLessThan(0.6)
  })

  it('still lets the PUMP carry, which was never what was reported', () => {
    expect(PUMPS_IN_WALL.length).toBeGreaterThan(0)
    // Somewhere in its cycle the pump is holding something; if it never were,
    // this test would pass for the wrong reason.
    let everCarried = 0
    for (let ms = 0; ms < 6000; ms += 50) {
      const pump = pumpStateAt(ms)
      for (const protein of PUMPS_IN_WALL) {
        everCarried += cargoOf(protein, 'closed', pump).length
      }
    }
    expect(everCarried).toBeGreaterThan(0)
  })

  it('is the SCENE\'s decision, not the lens\'s', () => {
    // A guard that can be satisfied without touching the code path the user is
    // looking at is not a guard for what the user is looking at. `cargoOf` is
    // exported from `drawScene` — the module that draws `axon-membrane` — and
    // that is the whole point of this test's existence.
    expect(typeof cargoOf).toBe('function')
  })
})
