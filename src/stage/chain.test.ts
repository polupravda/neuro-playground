import { describe, expect, it } from 'vitest'
import { THRESHOLD } from '../core/integration'
import {
  ARBOR_MS,
  FIRING_RUN_MS,
  FIZZLED_RUN_MS,
  chainStateAt,
  runDuration,
} from './chain'

/** Dense sampling of a whole run. */
const sweep = (inputs: number, until = FIRING_RUN_MS + 400) =>
  Array.from({ length: 401 }, (_, i) => {
    const ms = (i / 400) * until
    return { ms, s: chainStateAt(ms, inputs) }
  })

describe('nothing happens without an input', () => {
  it('stays idle for zero inputs at every moment', () => {
    for (const { s } of sweep(0)) {
      expect(s.phase).toBe('idle')
      expect(s.axonHead).toBeNull()
      expect(s.ripple).toBeNull()
      expect(s.hillockLevel).toBe(0)
    }
  })
})

describe('the action potential is always caused (the core guardrail)', () => {
  it('never puts a signal on the axon before threshold is reached', () => {
    for (const inputs of [1, 2, 3]) {
      for (const { s } of sweep(inputs)) {
        if (s.axonHead !== null) {
          expect(s.hillockLevel).toBeGreaterThanOrEqual(THRESHOLD)
        }
      }
    }
  })

  it('never fires the axon at all when the input is subthreshold', () => {
    for (const { s } of sweep(1)) {
      expect(s.axonHead).toBeNull()
      expect(s.terminalRelease).toBe(0)
      expect(s.targetRipple).toBeNull()
    }
  })

  it('starts every action potential at the hillock end of the axon', () => {
    const heads = sweep(3)
      .map(({ s }) => s.axonHead)
      .filter((h): h is number => h !== null)
    expect(Math.min(...heads)).toBeLessThan(0.05)
  })

  it('lights the terminal arbor as the spike reaches it, before any release', () => {
    // The arrival is the point of the journey, and it used to be the one moment
    // not drawn: the axon's glow stopped at the last branch point and the boutons
    // stayed dark until a release glow appeared half a second later. Two events,
    // and the gap between them is a lesson — the spike gets there, and THEN
    // calcium and vesicles do something about it.
    const frames = sweep(3)
    const lit = frames.filter(({ s }) => s.terminalAP > 0.5)
    expect(lit.length).toBeGreaterThan(0)
    const firstLit = lit[0].ms
    const firstRelease = frames.find(({ s }) => s.terminalRelease > 0)?.ms ?? Infinity
    expect(firstLit).toBeLessThan(firstRelease)
  })

  it('never lights the arbor on a run that does not fire', () => {
    for (const { s } of sweep(1)) {
      expect(s.terminalAP).toBe(0)
      expect(s.terminalHead).toBeNull()
    }
  })

  // Guards A1 of the corrections round (2026-09-04): "the whole thing lights
  // up at once" — the arbor must be INVADED over its own leg, walked here.
  it('A1: invades the arbor as a travelling wave, not a flash', () => {
    const inTransit = sweep(3).filter(
      ({ s }) => s.terminalHead !== null && s.terminalHead > 0 && s.terminalHead < 1,
    )
    // Many sampled moments mid-journey — the flash this replaces had none.
    expect(inTransit.length).toBeGreaterThan(10)
    // The wave only ever advances.
    const heads = inTransit.map(({ s }) => s.terminalHead!)
    for (let i = 1; i < heads.length; i++) {
      expect(heads[i]).toBeGreaterThanOrEqual(heads[i - 1])
    }
    // And it is a real leg of the journey, not a token.
    expect(ARBOR_MS).toBeGreaterThan(200)
  })

  it('A1: reaches every bouton before anything is released', () => {
    const frames = sweep(3)
    const fullAt = frames.find(({ s }) => s.terminalHead === 1)!.ms
    const releaseAt = frames.find(({ s }) => s.terminalRelease > 0)?.ms ?? -1
    expect(releaseAt).toBeGreaterThan(fullAt)
  })

  it('flashes the hillock as the action potential is launched', () => {
    const flashes = sweep(3).filter(({ s }) => s.hillockFlash > 0)
    expect(flashes.length).toBeGreaterThan(0)
    for (const { s } of flashes) expect(s.axonHead).not.toBeNull()
  })
})

describe('causal ordering of a firing run', () => {
  const first = (predicate: (s: ReturnType<typeof chainStateAt>) => boolean) => {
    const hit = sweep(3).find(({ s }) => predicate(s))
    expect(hit).toBeDefined()
    return hit!.ms
  }

  it('runs input AP → crossing → dendrite ripple → summing → axon → release → target', () => {
    const tPresyn = first((s) => s.presynAP !== null)
    const tCrossing = first((s) => s.crossing !== null)
    const tRipple = first((s) => s.ripple !== null)
    const tSumming = first((s) => s.phase === 'summing')
    const tAxon = first((s) => s.axonHead !== null)
    const tRelease = first((s) => s.terminalRelease > 0)
    const tTarget = first((s) => s.targetRipple !== null)

    expect(tPresyn).toBeLessThan(tCrossing)
    expect(tCrossing).toBeLessThan(tRipple)
    expect(tRipple).toBeLessThan(tSumming)
    expect(tSumming).toBeLessThan(tAxon)
    expect(tAxon).toBeLessThan(tRelease)
    expect(tRelease).toBeLessThan(tTarget)
  })

  it('moves no vesicle before the action potential has arrived', () => {
    for (const { s } of sweep(3)) {
      if (s.terminalDrift > 0) {
        expect(['terminal', 'target']).toContain(s.phase)
      }
    }
  })

  it('never releases into the outgoing cleft before vesicles have drifted', () => {
    for (const { s } of sweep(3)) {
      if (s.outgoingCrossing !== null) expect(s.terminalDrift).toBeGreaterThan(0)
    }
  })
})

describe('graded vs all-or-nothing', () => {
  it('decays the dendritic ripple as it travels inward', () => {
    const samples = sweep(3).filter(({ s }) => s.ripple !== null)
    const early = samples
      .filter(({ s }) => s.ripple! < 0.15)
      .map(({ s }) => s.rippleStrength)
    const late = samples
      .filter(({ s }) => s.ripple! > 0.85)
      .map(({ s }) => s.rippleStrength)
    expect(Math.min(...early)).toBeGreaterThan(Math.max(...late))
  })

  it('builds the hillock total up as the ripple approaches', () => {
    const samples = sweep(3).filter(({ s }) => s.phase === 'dendrite')
    const levels = samples.map(({ s }) => s.hillockLevel)
    expect(levels[0]).toBeLessThan(levels[levels.length - 1])
  })

  it('sums more inputs to a higher total', () => {
    const at = (inputs: number) => chainStateAt(2700, inputs).hillockLevel
    expect(at(1)).toBeLessThan(at(2))
    expect(at(2)).toBeLessThan(at(3))
  })
})

describe('a subthreshold run ends by fading, not by vanishing', () => {
  it('passes through a fizzled phase where the total drains away', () => {
    const fizzling = sweep(1, FIZZLED_RUN_MS).filter(({ s }) => s.phase === 'fizzled')
    expect(fizzling.length).toBeGreaterThan(0)
    const levels = fizzling.map(({ s }) => s.hillockLevel)
    expect(levels[0]).toBeGreaterThan(levels[levels.length - 1])
    expect(levels[levels.length - 1]).toBeLessThan(levels[0])
  })

  it('finishes sooner than a firing run', () => {
    expect(runDuration(1)).toBe(FIZZLED_RUN_MS)
    expect(runDuration(2)).toBe(FIRING_RUN_MS)
    expect(FIZZLED_RUN_MS).toBeLessThan(FIRING_RUN_MS)
  })

  it('ends in the done phase with nothing left moving', () => {
    const end = chainStateAt(FIZZLED_RUN_MS + 10, 1)
    expect(end.phase).toBe('done')
    expect(end.axonHead).toBeNull()
    expect(end.hillockLevel).toBeCloseTo(0)
  })
})

describe('a firing run finishes cleanly', () => {
  it('ends in the done phase with nothing left moving', () => {
    const end = chainStateAt(FIRING_RUN_MS + 10, 3)
    expect(end.phase).toBe('done')
    expect(end.axonHead).toBeNull()
    expect(end.targetRipple).toBeNull()
  })
})
