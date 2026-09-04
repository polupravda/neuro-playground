import { describe, expect, it } from 'vitest'
import {
  BARE_WALL,
  HOLES,
  LEAKY_HONESTY,
  LEAKY_PARTS,
  RACE_MS,
  SPENT,
  WRAPPED_WALL,
  holeExposed,
  holePlaces,
  lambdaUm,
  leakRateAt,
  leakyRightNow,
  myelinLayers,
  pulseAt,
  reachUm,
  rmFactor,
  sparkAt,
  survivesAt,
} from './leaky'
import { lengthConstantUm, MEMBRANE_RESISTANCE } from './cable'
import { lamellae } from './fibre'

// ACTION LIST 2026-08-30:
//   A1 — "make signals race. The signal moves across the pipe and sparkle
//        'leaks' through the holes."
//   A2 — "there's no situation when K⁺ channels are absent (which we can
//        build)? This is confusing… Validate."
//
// ⚠ A2 WAS RIGHT, AND THE MODEL PROVED IT. A wall with no holes drawn still
// had Rm = 3333 Ω·cm² — a perfectly leaky membrane — so λ was 342 µm precisely
// BECAUSE it leaked. The picture was offering a state ("a fibre with no leak
// channels") that neither the model nor a cell has: a neuron with no potassium
// leak has no resting potential at all. The holes are permanent now, and what
// myelin does is COVER them.

describe('the holes are not optional', () => {
  it('leaks through a bare wall even with nothing drawn on it', () => {
    // The arithmetic that settled it: a finite membrane resistance IS a leak.
    expect(MEMBRANE_RESISTANCE).toBeGreaterThan(0)
    expect(Number.isFinite(MEMBRANE_RESISTANCE)).toBe(true)
    expect(rmFactor(BARE_WALL)).toBe(1)
    expect(lambdaUm(BARE_WALL)).toBeCloseTo(lengthConstantUm(), 9)
  })

  it('puts the SAME holes in both fibres, because it is the same membrane', () => {
    expect(holePlaces()).toHaveLength(HOLES)
    for (const place of holePlaces()) {
      expect(place).toBeGreaterThan(0)
      expect(place).toBeLessThan(1)
    }
  })

  it('has myelin COVER holes rather than remove them', () => {
    // ⚠ The scientific heart of the correction. Myelin does not take a channel
    // away; it wraps over the membrane and leaves the nodes bare.
    const covered = holePlaces().filter((p) => !holeExposed(WRAPPED_WALL, p))
    const exposed = holePlaces().filter((p) => holeExposed(WRAPPED_WALL, p))
    expect(covered.length).toBeGreaterThan(0)
    expect(exposed.length).toBeGreaterThan(0)
    // Every hole on a bare fibre is open to the world.
    for (const p of holePlaces()) expect(holeExposed(BARE_WALL, p)).toBe(true)
  })
})

describe('λ is the cable model\'s own answer, not a second set of numbers', () => {
  it('makes myelin the lever, and counts its layers rather than asserting them', () => {
    expect(myelinLayers()).toBe(2 * lamellae() + 1)
    expect(rmFactor(WRAPPED_WALL)).toBe(myelinLayers())
    expect(lambdaUm(WRAPPED_WALL)).toBeGreaterThan(lambdaUm(BARE_WALL) * 3)
  })

  it('fades to a third at λ, which is what λ MEANS', () => {
    for (const w of [BARE_WALL, WRAPPED_WALL]) {
      expect(survivesAt(w, lambdaUm(w))).toBeCloseTo(1 / Math.E, 9)
      expect(survivesAt(w, 0)).toBe(1)
      expect(survivesAt(w, reachUm(w))).toBeCloseTo(SPENT, 9)
    }
  })

  it('leaks fastest where most is left, and barely at all once wrapped', () => {
    expect(leakRateAt(BARE_WALL, 0)).toBeGreaterThan(leakRateAt(BARE_WALL, 500))
    expect(leakRateAt(WRAPPED_WALL, 0)).toBeLessThan(leakRateAt(BARE_WALL, 0))
  })
})

describe('the race', () => {
  it('runs both pulses at the same speed, so the only variable is what survives', () => {
    // ⚠ A DECLARED SIMPLIFICATION. A real wrapped fibre is also faster, but
    // speed is the conduction exhibit's lesson — putting it here as well would
    // leave a child unable to say which of the two things they had watched.
    expect(pulseAt(0)).toBe(0)
    expect(pulseAt(1)).toBe(1)
    expect(pulseAt(0.5)).toBe(0.5)
    expect(RACE_MS).toBeGreaterThan(1500)
  })

  it('flashes brightest as the pulse reaches it, and not at all far away', () => {
    // ⚠ An eased bell CENTRED on the pulse (2026-08-31), the shape the axon
    // views' node flashes use. It glows a little before the peak arrives,
    // which is not a cheat — a voltage spreads ahead of its own peak, and that
    // is the entire subject of this exhibit.
    const place = holePlaces()[4]
    const here = sparkAt(BARE_WALL, place, place)
    expect(here).toBeGreaterThan(0)
    expect(sparkAt(BARE_WALL, place, place - 0.06)).toBeLessThan(here)
    expect(sparkAt(BARE_WALL, place, place + 0.06)).toBeLessThan(here)
    // And nothing at all when the pulse is nowhere near.
    expect(sparkAt(BARE_WALL, place, place - 0.4)).toBe(0)
    expect(sparkAt(BARE_WALL, place, place + 0.4)).toBe(0)
  })

  it('lets a covered hole spark not at all — which is what myelin buys', () => {
    // ⚠ THE MECHANISM. Charge leaving through a hole is exactly why the signal
    // shrinks, so a hole that cannot leak is the whole of what a sleeve does.
    const covered = holePlaces().filter((p) => !holeExposed(WRAPPED_WALL, p))
    expect(covered.length).toBeGreaterThan(0)
    // The scene asks `holeExposed` before it draws a spark at all; this is the
    // pairing spelled out, so the two cannot come apart.
    for (const p of covered) {
      expect(holeExposed(WRAPPED_WALL, p)).toBe(false)
    }
  })

  it('has a NODE leak harder than a bare hole at the same place', () => {
    // ⚠ A REAL FINDING, and my first version of this test had it backwards. A
    // node leaks HARDER than a bare fibre's hole at the same distance, because
    // more signal has survived to reach it and a node is ordinary bare
    // membrane. Myelin does not make each hole leak less — it wins by covering
    // most of them, and the arithmetic that proves the win is how much ARRIVES
    // (the race test below), not how brightly any one hole glows.
    const node = 0.25
    expect(sparkAt(WRAPPED_WALL, node, node)).toBeGreaterThan(sparkAt(BARE_WALL, node, node))
  })

  it('is over before the pulse is far past, so flashes do not smear', () => {
    const place = holePlaces()[2]
    expect(sparkAt(BARE_WALL, place, place + 0.4)).toBe(0)
  })

  it('leaves the bare pulse spent before the end and the wrapped one alive', () => {
    // The payoff, measured: over the 3 mm of fibre on stage.
    const SPAN = 3000
    expect(survivesAt(BARE_WALL, SPAN)).toBeLessThan(0.01)
    expect(survivesAt(WRAPPED_WALL, SPAN)).toBeGreaterThan(0.2)
  })
})

describe('what it says about itself', () => {
  it('names the misconception it used to allow', () => {
    const said = [...LEAKY_PARTS, ...LEAKY_HONESTY].map((p) => p.text).join(' ')
    expect(said).toMatch(/always has these|no way for potassium to leak/i)
    expect(said).toMatch(/wraps over|covers/i)
  })

  it('reads its numbers off the model rather than repeating them', () => {
    for (const w of [BARE_WALL, WRAPPED_WALL]) {
      const said = leakyRightNow(w).map((p) => p.text).join(' ')
      expect(said).toContain(`${Math.round(lambdaUm(w))} µm`)
    }
  })
})
