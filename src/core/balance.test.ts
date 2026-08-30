import { describe, expect, it } from 'vitest'
import { ION_KINDS, IONS, particlesFor, type IonKind } from './ions'
import type { IonCounts } from '../state/ionStore'
import { FLOW_DEADBAND, flowOf } from './driving'
import { COUNT_FLOOR } from './voltage'
import {
  allSettled,
  balanceMv,
  calciumNote,
  chamberAt,
  equilibriumSplit,
  pushesOn,
  settle,
} from './balance'

const real: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

describe('the two pushes an ion feels', () => {
  it('cancels exactly at that ion’s own voltage — which IS the lesson', () => {
    for (const ion of ION_KINDS) {
      const at = balanceMv(ion, real)
      const { crowd, charge, net } = pushesOn(ion, real, at)
      expect(net).toBeCloseTo(0, 6)
      // Not both zero: they are equal and opposite, which is a different and
      // much more interesting thing than nothing pushing.
      expect(crowd).toBeCloseTo(-charge, 6)
      expect(Math.abs(crowd)).toBeGreaterThan(1)
    }
  })

  it('points the same way the ion actually moves', () => {
    // THE test of this file, and the one the first attempt did not have. Both
    // pushes were inverted, so a negative interior was drawn REPELLING sodium —
    // and a test that only checked the two pushes summed to the driving-force
    // FORMULA passed happily, because the formula was inverted too. Check the
    // direction against what moves.
    for (const ion of ION_KINDS) {
      for (const vm of [-90, -72, -40, -20, 0, 40, 70]) {
        const { net } = pushesOn(ion, real, vm)
        const flow = flowOf(ion, real, vm)
        if (flow === 'none') continue
        expect(net > 0 ? 'in' : 'out').toBe(flow)
      }
    }
  })

  it('has a negative interior pulling sodium IN and pushing chloride OUT', () => {
    // Spelled out, because this is the pair the sign error got backwards.
    expect(pushesOn('na', real, -72).charge).toBeGreaterThan(0)
    expect(pushesOn('cl', real, -72).charge).toBeLessThan(0)
  })

  it('has crowding send an ion away from where it is crowded', () => {
    // Sodium is crowded outside, so its crowd push is inward; potassium is
    // crowded inside, so its crowd push is outward.
    expect(pushesOn('na', real, 0).crowd).toBeGreaterThan(0)
    expect(pushesOn('k', real, 0).crowd).toBeLessThan(0)
  })

  it('leaves potassium very nearly balanced at the resting voltage', () => {
    // The resting-potential hook: the bench opens here, and potassium is almost
    // already content, which is where the resting voltage comes from.
    const { net } = pushesOn('k', real, -72)
    expect(Math.abs(net)).toBeLessThan(20)
  })

  it('flips both pushes for chloride, because its charge is negative', () => {
    // Chloride is crowded OUTSIDE like sodium, yet is pushed the other way by
    // the same voltage. Getting this wrong would reverse the whole column.
    const cl = pushesOn('cl', real, -40)
    const na = pushesOn('na', real, -40)
    expect(IONS.cl.charge).toBeLessThan(0)
    expect(Math.sign(cl.charge)).toBe(-Math.sign(na.charge))
  })

  it('balances calcium at half the voltage its ratio alone would suggest', () => {
    // Valence: charge 2 means the same crowding is held by half the pull.
    const ratio = real.ca.outside / COUNT_FLOOR
    const singleCharged = 26.7 * Math.log(ratio)
    expect(balanceMv('ca', real)).toBeCloseTo(singleCharged / 2, 1)
  })
})

describe('hunting for the balance point', () => {
  const hunt = (ion: IonKind, vm: number, open = true) =>
    chamberAt(ion, real, vm, open)

  it('is only solved with the door OPEN — a claim has to be tested', () => {
    const at = balanceMv('k', real)
    expect(hunt('k', at, true).solved).toBe(true)
    expect(hunt('k', at, false).solved).toBe(false)
  })

  it('shows traffic BOTH ways at balance, not stillness', () => {
    // Equilibrium is equal streams crossing, not nothing happening. Drawing
    // stillness would teach the misconception this flag exists to prevent.
    const solved = hunt('k', balanceMv('k', real))
    expect(solved.twoWay).toBe(true)
    expect(solved.flow).toBe('none')
  })

  it('says which way to move the battery when it is off', () => {
    const below = hunt('k', balanceMv('k', real) - 30)
    const above = hunt('k', balanceMv('k', real) + 30)
    expect(below.offBy).toBeLessThan(0)
    expect(above.offBy).toBeGreaterThan(0)
  })

  it('reverses the flow as the voltage crosses the balance point', () => {
    const at = balanceMv('k', real)
    expect(hunt('k', at - 30).flow).not.toBe(hunt('k', at + 30).flow)
  })

  it('pushes harder the further off the mark it is', () => {
    const at = balanceMv('na', real)
    expect(hunt('na', at - 100).strength).toBeGreaterThan(hunt('na', at - 20).strength)
  })

  it('moves the target when the crowding is changed', () => {
    // The hunt is not for a fixed number: steepen the gradient and the voltage
    // needed to hold it still moves, which is the Nernst equation being felt.
    const steeper: IonCounts = { ...real, k: { outside: 2, inside: 140 } }
    expect(balanceMv('k', steeper)).toBeLessThan(balanceMv('k', real))
  })

  it('closes the flow entirely while the channel is shut', () => {
    const shut = hunt('na', 0, false)
    expect(shut.flow).toBe('none')
    expect(shut.strength).toBe(0)
  })
})

describe('letting them settle', () => {
  const total = (c: IonCounts, ion: IonKind) => c[ion].outside + c[ion].inside

  it('never creates or destroys an ion', () => {
    // The whole point of the rebuild: balls are conserved objects. Anything
    // appearing or vanishing is the bug this replaced.
    for (const ion of ION_KINDS) {
      let counts = { ...real }
      const before = total(counts, ion)
      for (let i = 0; i < 400; i++) {
        counts = { ...counts, [ion]: settle(ion, counts, 0, 33) }
        expect(total(counts, ion)).toBeCloseTo(before, 6)
      }
    }
  })

  it('arrives at the split where that ion is content, and stays', () => {
    for (const ion of ION_KINDS) {
      let counts = { ...real }
      for (let i = 0; i < 900; i++) counts = { ...counts, [ion]: settle(ion, counts, -20, 33) }
      // Settled means the ion's own voltage now IS the battery's.
      expect(balanceMv(ion, counts)).toBeCloseTo(-20, 1)
      // And it stops there rather than wobbling around it.
      const settled = { ...counts[ion] }
      counts = { ...counts, [ion]: settle(ion, counts, -20, 33) }
      expect(counts[ion].inside).toBeCloseTo(settled.inside, 4)
    }
  })

  it('moves more when the battery is set further from where the ion started', () => {
    // The relationship the exhibit is really teaching: how much crosses is a
    // measure of how far off the setting was.
    const crossed = (vm: number) => {
      const t = total(real, 'k')
      return Math.abs(equilibriumSplit('k', t, vm).inside - real.k.inside)
    }
    expect(crossed(0)).toBeGreaterThan(crossed(-72) * 5)
  })

  it('barely moves potassium at the resting voltage', () => {
    // The hook: the bench opens where a real membrane sits, and potassium is
    // nearly content already — less than one drawn ball has to cross.
    const t = total(real, 'k')
    const moved = Math.abs(equilibriumSplit('k', t, -72).inside - real.k.inside)
    expect(moved).toBeLessThan(10)
  })

  it('honours the charge: chloride settles the other way from potassium', () => {
    const t = total(real, 'cl')
    // Both are crowded on opposite sides to begin with, and a negative interior
    // sends them opposite ways.
    expect(equilibriumSplit('cl', t, -80).inside).toBeLessThan(
      equilibriumSplit('cl', t, 0).inside,
    )
    expect(equilibriumSplit('k', total(real, 'k'), -80).inside).toBeGreaterThan(
      equilibriumSplit('k', total(real, 'k'), 0).inside,
    )
  })

  it('reports when there is nothing left to flow', () => {
    expect(allSettled(['k'], real, balanceMv('k', real))).toBe(true)
    expect(allSettled(['k'], real, 0)).toBe(false)
    // And with the ions free to move, EVERY door can settle at one voltage —
    // which is the ending: a membrane left alone drains to equilibrium.
    let counts = { ...real }
    for (let i = 0; i < 4000; i++) {
      for (const ion of ION_KINDS) counts = { ...counts, [ion]: settle(ion, counts, -30, 33) }
    }
    expect(allSettled(ION_KINDS, counts, -30)).toBe(true)
  })
})

describe('owning up to calcium', () => {
  it('quotes both the drawn number and the real one, and why they differ', () => {
    const note = calciumNote(real)
    expect(note).toContain(String(Math.round(balanceMv('ca', real))))
    expect(note).toMatch(/130/)
    expect(note).toMatch(/ten-thousandth/)
  })
})

describe('the deadband is a knife edge, not a shrug', () => {
  it('is small enough that balance has to be found, not stumbled into', () => {
    expect(FLOW_DEADBAND).toBeLessThan(3)
  })
})
