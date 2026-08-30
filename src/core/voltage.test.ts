import { describe, expect, it } from 'vitest'
import { CHANNELS } from './channels'
import { ION_KINDS, IONS, particlesFor } from './ions'
import type { IonCounts } from '../state/ionStore'
import {
  BACKGROUND,
  VOLTAGE_FACTS,
  VM_MAX,
  VM_MIN,
  conductances,
  membraneVoltageMv,
  nernstMv,
} from './voltage'

const real: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

const leak = [CHANNELS['leak-k']]
const naOpen = [CHANNELS['leak-k'], CHANNELS['voltage-na']]
const bothOpen = [CHANNELS['leak-k'], CHANNELS['voltage-na'], CHANNELS['voltage-k']]

describe('Nernst potentials come out at the textbook values', () => {
  it('puts potassium near −90 mV', () => {
    expect(nernstMv('k', real)).toBeGreaterThan(-95)
    expect(nernstMv('k', real)).toBeLessThan(-80)
  })

  it('puts sodium near +60 mV', () => {
    expect(nernstMv('na', real)).toBeGreaterThan(50)
    expect(nernstMv('na', real)).toBeLessThan(70)
  })

  it('puts chloride near −65 mV, negative because its charge is negative', () => {
    expect(nernstMv('cl', real)).toBeLessThan(-55)
    expect(nernstMv('cl', real)).toBeGreaterThan(-75)
  })

  it('is zero for an ion with no gradient left', () => {
    const flat: IonCounts = { ...real, k: { outside: 60, inside: 60 } }
    expect(nernstMv('k', flat)).toBeCloseTo(0)
  })

  it('reverses sign when a gradient is reversed', () => {
    const flipped: IonCounts = {
      ...real,
      k: { outside: real.k.inside, inside: real.k.outside },
    }
    expect(nernstMv('k', flipped)).toBeCloseTo(-nernstMv('k', real))
  })

  it('survives a side being emptied entirely, rather than going infinite', () => {
    const empty: IonCounts = { ...real, k: { outside: 0, inside: 0 } }
    expect(Number.isFinite(nernstMv('k', empty))).toBe(true)
  })
})

describe('the resting voltage', () => {
  it('settles near −70 mV with only the potassium leak open', () => {
    const vm = membraneVoltageMv(real, leak)
    expect(vm).toBeLessThan(-60)
    expect(vm).toBeGreaterThan(-80)
  })

  it('sits much closer to potassium’s voltage than to sodium’s', () => {
    const vm = membraneVoltageMv(real, leak)
    expect(Math.abs(vm - nernstMv('k', real))).toBeLessThan(
      Math.abs(vm - nernstMv('na', real)),
    )
  })

  it('stays inside the meter’s scale', () => {
    for (const open of [leak, naOpen, bothOpen, []]) {
      const vm = membraneVoltageMv(real, open)
      expect(vm).toBeGreaterThan(VM_MIN)
      expect(vm).toBeLessThan(VM_MAX)
    }
  })
})

describe('permeability is what sets the voltage (checkpoint A)', () => {
  it('collapses toward zero when potassium can no longer cross', () => {
    const shut = membraneVoltageMv(real, [])
    const open = membraneVoltageMv(real, leak)
    // The gradient is untouched; only the ability to cross changed.
    expect(shut).toBeGreaterThan(open + 20)
  })

  it('never takes the pump as an input at all', () => {
    // Structural: there is no pump argument, so the pump cannot be credited
    // with the resting voltage even by accident.
    expect(membraneVoltageMv.length).toBe(2)
  })

  it('swings positive when sodium channels open', () => {
    expect(membraneVoltageMv(real, naOpen)).toBeGreaterThan(0)
  })

  it('is dragged back down again once potassium channels open too', () => {
    expect(membraneVoltageMv(real, bothOpen)).toBeLessThan(
      membraneVoltageMv(real, naOpen),
    )
  })

  it('follows the gradients the kid sets, not fixed numbers', () => {
    const flattened: IonCounts = { ...real, k: { outside: 70, inside: 70 } }
    expect(membraneVoltageMv(flattened, leak)).toBeGreaterThan(
      membraneVoltageMv(real, leak) + 20,
    )
  })
})

describe('conductances', () => {
  it('always leaves a little background permeability', () => {
    const g = conductances([])
    expect(g.na).toBeCloseTo(BACKGROUND.na!)
    expect(g.k).toBe(0)
  })

  it('adds up every open channel that passes an ion', () => {
    const g = conductances(bothOpen)
    expect(g.k).toBeCloseTo(CHANNELS['leak-k'].conductance + CHANNELS['voltage-k'].conductance)
    expect(g.na).toBeCloseTo((BACKGROUND.na ?? 0) + CHANNELS['voltage-na'].conductance)
  })
})

describe('teaching text', () => {
  const text = VOLTAGE_FACTS.map((p) => p.text.toLowerCase()).join(' ')

  it('names selective permeability as the source, with the experiment to prove it', () => {
    expect(text).toMatch(/selective permeability/)
    expect(text).toMatch(/shut the leak channels and watch the meter climb/)
  })

  it('says outright that the pump does not make the voltage', () => {
    expect(text).toMatch(/the pump is not what makes the voltage/)
    expect(text).toMatch(/gradients are the batteries/)
  })

  it('explains that only a thin skin of charge is involved', () => {
    expect(text).toMatch(/thin skin of ions/)
    expect(text).toMatch(/never visibly change/)
  })

  it('quotes each ion’s own preferred voltage', () => {
    expect(text).toMatch(/−90 mv for potassium/)
    expect(text).toMatch(/\+60 mv for sodium/)
  })
})
