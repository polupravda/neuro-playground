import { describe, expect, it } from 'vitest'
import { ION_KINDS, IONS, particlesFor } from './ions'
import type { IonCounts } from '../state/ionStore'
import { FIRE_STIMULUS, trajectory } from './spikeModel'
import {
  STRONG_STIMULUS,
  absoluteRefractoryMs,
  pushNeededAt,
  refractoryFacts,
  relativeRefractoryMs,
  secondSpike,
} from './refractory'

const real: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

const flatSodium: IonCounts = {
  ...real,
  na: { outside: real.na.inside, inside: real.na.inside },
}

const absolute = absoluteRefractoryMs(real)
const relative = relativeRefractoryMs(real)

describe('measuring a second spike', () => {
  it('does not mistake the tail of the first spike for a second one', () => {
    // The bug this is here for. Asking simply for the highest voltage after the
    // second push landed catches the top of the FIRST spike at a short gap — the
    // membrane was on its way up anyway — and the absolute refractory period comes
    // out as zero. A push of NOTHING must never look like a spike, at any gap.
    for (const gap of [0.8, 1, 1.5, 2, 3, 5, 10]) {
      expect(secondSpike(real, true, gap, 0).fired, `gap ${gap}`).toBe(false)
    }
  })

  it('measures the second push by what it added, not by what happened', () => {
    // A real second spike is a departure from what the membrane was going to do
    // on its own, so a well-separated pair must clear the bar comfortably.
    const late = secondSpike(real, true, 20, FIRE_STIMULUS)
    expect(late.fired).toBe(true)
    expect(late.peakMv).toBeGreaterThan(0)
  })
})

describe('the two refractory periods, found rather than looked up', () => {
  it('finds an absolute period, and a relative one after it', () => {
    expect(absolute).toBeGreaterThan(0.5)
    expect(relative).toBeGreaterThan(absolute)
    // Longer than a mammal's, and for the reason everything in this model is
    // slow: Hodgkin and Huxley's squid gates at 6.3 °C. The ORDER is the lesson.
    expect(absolute).toBeLessThan(10)
    expect(relative).toBeLessThan(20)
  })

  it('refuses every push inside the absolute period, however hard', () => {
    // "Absolute" means absolute: current does not unlatch a latch. If a big enough
    // push ever got through here, the word would be wrong.
    for (const f of [0.3, 0.6, 0.9]) {
      expect(secondSpike(real, true, absolute * f, STRONG_STIMULUS).fired).toBe(false)
    }
  })

  it('lets a strong push through in the relative period where an ordinary one fails', () => {
    // The definition of the relative period, and the thing that makes it a
    // separate idea rather than a softer edge of the same one.
    const mid = (absolute + relative) / 2
    expect(secondSpike(real, true, mid, STRONG_STIMULUS).fired).toBe(true)
    expect(secondSpike(real, true, mid, FIRE_STIMULUS).fired).toBe(false)
  })

  it('takes an ordinary push again once the relative period is over', () => {
    expect(secondSpike(real, true, relative + 1, FIRE_STIMULUS).fired).toBe(true)
  })

  it('asks less and less of the push as the membrane recovers', () => {
    // Not merely "eventually recovers" — recovery is gradual, which is what makes
    // the period RELATIVE. Monotone, and back to an ordinary threshold by the end.
    const gaps = [4, 5, 6, 8, 10, 14, 20]
    const needed = gaps.map((g) => pushNeededAt(real, true, g))
    for (let i = 1; i < needed.length; i++) {
      expect(needed[i], `gap ${gaps[i]}`).toBeLessThanOrEqual(needed[i - 1] + 0.05)
    }
    expect(needed[0]).toBeGreaterThan(2)
    expect(needed[needed.length - 1]).toBeLessThan(1.3)
  })

  it('gives a smaller spike in the relative period than a rested membrane does', () => {
    // Fewer sodium doors available and potassium still pulling the other way, so
    // what gets through is a lesser spike. All-or-nothing is a claim about a RESTED
    // membrane, and this is where that shows.
    const early = secondSpike(real, true, absolute + 0.5, STRONG_STIMULUS)
    const rested = secondSpike(real, true, 20, STRONG_STIMULUS)
    expect(early.ofFirst).toBeLessThan(rested.ofFirst * 0.9)
  })
})

describe('when there is no first spike', () => {
  it('reports no refractory period at all with sodium flattened', () => {
    // Nothing to recover from. The measurement must not invent a period for a
    // membrane that never fired.
    expect(trajectory(flatSodium, true, FIRE_STIMULUS).fired).toBe(false)
    expect(absoluteRefractoryMs(flatSodium)).toBe(0)
    expect(relativeRefractoryMs(flatSodium)).toBe(0)
    expect(refractoryFacts(flatSodium).join(' ')).toBeDefined()
  })
})

describe('what it says about itself (spec: absolute vs relative)', () => {
  const joined = refractoryFacts(real).map((f) => f.text).join(' ')

  it('names both periods and keeps them apart', () => {
    expect(joined).toContain('ABSOLUTE')
    expect(joined).toContain('RELATIVE')
    expect(joined).toContain(absolute.toFixed(1))
    expect(joined).toContain(relative.toFixed(1))
  })

  it('gives the mechanism as a door rather than as a rule', () => {
    expect(joined).toMatch(/second gate/)
    expect(joined).toMatch(/current does not unlatch a latch|does not unlatch/)
    expect(joined).toMatch(/nothing in this model was written/i)
  })

  it('says nothing about periods on a membrane that cannot fire', () => {
    const dead = refractoryFacts(flatSodium).map((f) => f.text).join(' ')
    expect(dead).toMatch(/no first spike/)
    expect(dead).not.toContain('ABSOLUTE')
  })
})
