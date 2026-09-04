import { describe, expect, it } from 'vitest'
import { STREAM_MAX, streamCount, channelIonsAt, roomFor } from './proteins'
import { poreBusyness, viewFibre } from './axonRibbon'
import { FLOW_IN_FLIGHT, flowAt, flowFade, flowSpread } from '../core/ionFlow'
import { fibreRun } from '../core/fibre'
import { FIRE_STIMULUS } from '../core/spikeModel'
import { CHANNELS } from '../core/channels'
import { restingCounts } from '../core/ions'

// ⚠ HOW MANY IONS ARE IN A PORE IS DECIDED IN ONE PLACE, and the reason this
// file exists is that it was decided in two.
//
// A single open sodium channel carries about 1.2 pA — 7.5 million ions a
// second, some 7,500 in one millisecond of opening — so a conducting pore is a
// current, not a trickle. The scene's channels were given that current, and the
// AXON LENS was not, because "ions crossing a channel" existed twice: once in
// `channelIonsAt` and once in the lens's own `drawTraffic`, which drew a
// hardcoded three. The lens is what the action-potential demo shows, so
// nothing the user could see had changed: "everything looks exactly as before"
// (2026-08-30).
//
// A second copy of a fixed bug is a bug that comes back. `streamCount` is the
// one rule now, and this is its guard.

/** Every source file in the stage, as text — Vite's own glob, so no node
 *  typings are needed. */
const SOURCES = import.meta.glob('./*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('nobody keeps a second count of their own', () => {
  // ⚠ A TEST ON THE RULE ALONE DOES NOT REACH A COPY THAT IGNORES IT. Putting
  // the lens back to `IN_FLIGHT = 3` left every test below green, because they
  // all measure `streamCount` and `channelIonsAt` — which is exactly how the
  // lens was missed in the first place. This one is structural, because the
  // failure is structural: somebody writing the number down again.
  it('lets no file set a stream length to a bare number', () => {
    const offenders: string[] = []
    expect(Object.keys(SOURCES).length).toBeGreaterThan(10)
    for (const [path, src] of Object.entries(SOURCES)) {
      if (path.endsWith('proteins.ts') || path.includes('.test.')) continue
      for (const [i, line] of src.split('\n').entries()) {
        const code = line.trim()
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) continue
        if (/IN_FLIGHT\s*=\s*\d/.test(code)) offenders.push(`${path}:${i + 1}  ${code}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('has the lens asking the shared rule', () => {
    const lens = SOURCES['./axonRibbon.ts']
    expect(lens).toBeTruthy()
    expect(lens).toContain('flowAt(')
  })
})

describe('one rule for how many ions are in a pore', () => {
  it('never shows an empty pore, and never a solid bar', () => {
    for (const drive of [0, 0.01, 0.5, 1, 4, 40, 1000]) {
      const n = streamCount(drive)
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(STREAM_MAX)
      expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('grows with the drive, so a fast channel outruns a slow one', () => {
    // ⚠ A result that does not change when the input changes is a broken
    // parameter — which is exactly what a hardcoded three was.
    let last = streamCount(0)
    let grew = 0
    for (const drive of [0.5, 1, 2, 3, 4]) {
      const n = streamCount(drive)
      expect(n).toBeGreaterThanOrEqual(last)
      if (n > last) grew++
      last = n
    }
    expect(grew).toBeGreaterThan(2)
  })

  it('reaches the cap for a wide-open sodium channel', () => {
    // The spike's own door, fully open and fully pushed: the busiest thing the
    // app draws, and the case the whole change was for.
    expect(streamCount(CHANNELS['voltage-na'].conductance)).toBe(STREAM_MAX)
    // And the resting leak stays a dribble, or the difference is lost.
    expect(streamCount(CHANNELS['leak-k'].conductance * 0.2)).toBe(1)
  })

  it('is what the membrane views actually use', () => {
    // ⚠ A2 (2026-08-30): the membrane views — the ones the action-potential
    // demo is drawn from — now run on `flowAt` like everything else. Counted
    // off the real function rather than compared with a constant.
    const counts = restingCounts()
    let most = 0
    for (let ms = 0; ms < 4000; ms += 20) {
      most = Math.max(most, channelIonsAt(CHANNELS['voltage-na'], 0, ms, counts, -72).length)
    }
    expect(most).toBeGreaterThan(5)
    expect(most).toBeLessThanOrEqual(roomFor('na'))
  })
})

describe('the busiest moment of a spike is drawn at the cap', () => {
  // ⚠ THE BUG THE USER FOUND TWICE OVER (2026-08-30: "1-3 ions pass through
  // the channels, as before"). The first rule multiplied a drive by a constant
  // and assumed a firing channel reaches openness 1. It does not: sodium's
  // conductance is m³h, and h is already falling as m rises, so a real spike
  // peaks near 0.52 — which came out as three balls at the busiest instant the
  // app ever draws.
  //
  // ⚠ AND NO TEST CAUGHT IT, because every one of them fed `streamCount` a
  // drive by hand instead of the drive a spike actually produces. This one
  // runs the model.
  const run = fibreRun(restingCounts(), true, FIRE_STIMULUS, viewFibre(false))
  const grid = run as unknown as { naOpen: number[][]; kOpen: number[][] }
  const peak = (g: number[][]) => g.reduce((most, row) => Math.max(most, ...row), 0)
  // ⚠ THROUGH THE LENS'S OWN FUNCTION, not a drive computed here. Four guards
  // for this were written by hand-feeding `streamCount`, and every one of them
  // passed with the real call site broken.
  // ⚠ THROUGH THE LENS'S OWN FUNCTION, not a drive computed here. Four guards
  // for this were written by hand-feeding the rule, and every one of them
  // passed with the real call site broken.
  const streamAt = (openness: number, kind: 'na' | 'k') =>
    flowAt(poreBusyness(run, openness, kind), 0.5).length

  it('never lets a real spike reach openness 1, which is why the old rule failed', () => {
    // Kept as a statement of the fact that broke it: h falls as m rises.
    expect(peak(grid.naOpen)).toBeGreaterThan(0.3)
    expect(peak(grid.naOpen)).toBeLessThan(0.8)
  })

  it('draws the sodium peak as a full current', () => {
    // ⚠ THE PATCH CLAMP'S OWN DENSITY (user, 2026-08-30: "replace it with a new
    // current view, which looks as the flow seen in 'Patch clamp recording'").
    // A handful of evenly spaced balls reads as a queue of individuals however
    // many there are; thirty-five fanning out and fading reads as a current.
    expect(streamAt(peak(grid.naOpen), 'na')).toBeGreaterThan(FLOW_IN_FLIGHT * 0.8)
  })

  it('keeps potassium visibly thinner, measured against the SAME busiest', () => {
    // Both are scaled by one reference rather than each by its own peak — or
    // both would run at full density and the contrast the spike is made of
    // would vanish.
    const k = streamAt(peak(grid.kOpen), 'k')
    expect(k).toBeGreaterThanOrEqual(1)
    expect(k).toBeLessThan(streamAt(peak(grid.naOpen), 'na') * 0.7)
  })

  it('thins as the door closes', () => {
    const wide = streamAt(peak(grid.naOpen), 'na')
    const barely = streamAt(peak(grid.naOpen) * 0.2, 'na')
    expect(barely).toBeLessThan(wide)
  })
})

describe('the flow itself, as the patch clamp draws it', () => {
  // ACTION LIST 2026-08-30 A1: "remove current ion flow implementation. Replace
  // it with a new current view, which looks as the flow seen in 'Patch clamp
  // recording'."
  it('puts a crowd in the air, not a handful', () => {
    expect(flowAt(1, 0.5).length).toBeGreaterThan(20)
    expect(flowAt(1, 0.5).length).toBeLessThanOrEqual(FLOW_IN_FLIGHT)
  })

  it('thins rather than stopping as the door closes', () => {
    let last = flowAt(1, 0.5).length
    for (const rate of [0.75, 0.5, 0.25, 0.1]) {
      const now = flowAt(rate, 0.5).length
      expect(now).toBeLessThanOrEqual(last)
      last = now
    }
    // Shut is shut: nothing crosses a closed door.
    expect(flowAt(0, 0.5)).toEqual([])
  })

  it('never teleports: every ion keeps its place as the clock advances', () => {
    // The queue slides forward; it does not reshuffle. Measured as the largest
    // jump any single ion makes over a small step of the clock.
    const step = 0.004
    const a = flowAt(1, 0.5)
    const b = flowAt(1, 0.5 + step)
    for (const ion of a) {
      const same = b.find((o) => o.seed === ion.seed)
      if (!same) continue
      expect(Math.abs(same.progress - ion.progress)).toBeLessThan(0.05)
    }
  })

  it('holds each ion\'s seed for its whole journey, so the plume never jitters', () => {
    const seen = flowAt(1, 0.5)[3]
    const later = flowAt(1, 0.52).find((o) => o.seed === seen.seed)
    expect(later).toBeTruthy()
    expect(later!.progress).toBeGreaterThan(seen.progress)
    // And its wander follows only its seed and how far it has come.
    expect(flowSpread(seen)).toBeCloseTo(Math.sin(seen.seed * 12.9898) * seen.progress, 9)
  })

  it('fans out and fades as it leaves the pore, and not before', () => {
    const atMouth = { seed: 7, progress: 0 }
    const away = { seed: 7, progress: 1 }
    // Nothing spreads INSIDE a pore barely wider than an ion.
    expect(flowSpread(atMouth)).toBe(0)
    expect(Math.abs(flowSpread(away))).toBeGreaterThan(0)
    expect(flowFade(atMouth)).toBe(1)
    expect(flowFade(away)).toBe(0)
  })

  it('survives a nonsense clock rather than drawing nonsense', () => {
    expect(flowAt(1, Number.NaN)).toEqual([])
    expect(flowAt(1, Number.POSITIVE_INFINITY)).toEqual([])
    for (const ion of flowAt(1, 12345.678)) {
      expect(Number.isFinite(ion.progress)).toBe(true)
      expect(ion.progress).toBeGreaterThanOrEqual(0)
      expect(ion.progress).toBeLessThanOrEqual(1)
    }
  })
})
