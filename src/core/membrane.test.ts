import { describe, expect, it } from 'vitest'
import {
  AXON_DIAMETER_UM,
  MEMBRANE_FACTS,
  MEMBRANE_THICKNESS_NM,
  MEMBRANE_THICKNESS_UM,
  SOMA_DIAMETER_UM,
  membraneScaleNote,
  membraneVsAxon,
  membraneVsSoma,
} from './membrane'

describe('membrane sizes are realistic', () => {
  it('uses textbook values', () => {
    expect(MEMBRANE_THICKNESS_NM).toBe(5)
    expect(MEMBRANE_THICKNESS_UM).toBeCloseTo(0.005)
    // A thin unmyelinated axon; real ones span roughly 0.2–2 µm.
    expect(AXON_DIAMETER_UM).toBeGreaterThan(0.2)
    expect(AXON_DIAMETER_UM).toBeLessThan(2)
    // Mammalian neuron cell bodies are roughly 10–30 µm across.
    expect(SOMA_DIAMETER_UM).toBeGreaterThanOrEqual(10)
    expect(SOMA_DIAMETER_UM).toBeLessThanOrEqual(30)
  })

  it('keeps the axon thinner than the soma', () => {
    expect(AXON_DIAMETER_UM).toBeLessThan(SOMA_DIAMETER_UM)
  })

  it('computes the thinness ratios the teaching text quotes', () => {
    expect(membraneVsAxon()).toBeCloseTo(280)
    expect(membraneVsSoma()).toBeCloseTo(4000)
    expect(membraneVsSoma()).toBeGreaterThan(membraneVsAxon())
  })
})

describe('membrane teaching text', () => {
  it('explains the bilayer as two layers with an oily middle', () => {
    const text = MEMBRANE_FACTS.map((p) => p.text.toLowerCase()).join(' ')
    expect(text).toContain('two layers')
    expect(text).toContain('oily')
  })

  it('says the barrier is why ions need a protein to cross (N13 setup)', () => {
    const text = MEMBRANE_FACTS.map((p) => p.text.toLowerCase()).join(' ')
    expect(text).toMatch(/cannot swim through/)
    expect(text).toMatch(/protein lets them/)
  })

  it('says the gaps are real but transient, because the layer is a liquid', () => {
    const text = MEMBRANE_FACTS.map((p) => p.text.toLowerCase()).join(' ')
    expect(text).toMatch(/gaps you can see/)
    expect(text).toMatch(/opens and closes/)
    expect(text).toMatch(/liquid, not a wall of bricks/)
  })

  it('admits small uncharged molecules cross, so "sealed" is never overclaimed', () => {
    const text = MEMBRANE_FACTS.map((p) => p.text.toLowerCase()).join(' ')
    expect(text).toMatch(/oxygen/)
    expect(text).toMatch(/not sealed shut/)
  })

  it('blames charge rather than size for stopping ions — the load-bearing point', () => {
    const text = MEMBRANE_FACTS.map((p) => p.text.toLowerCase()).join(' ')
    expect(text).toMatch(/not because they are too big/)
    expect(text).toMatch(/it is their charge/)
    expect(text).toMatch(/however much room there is/)
  })

  it('points at the protein doorway that the next milestone builds', () => {
    const text = MEMBRANE_FACTS.map((p) => p.text.toLowerCase()).join(' ')
    expect(text).toMatch(/protein doorway/)
    expect(text).toMatch(/built next/)
  })

  it('frames the membrane as separating two ionic worlds (N07 concept)', () => {
    const text = MEMBRANE_FACTS.map((p) => p.text.toLowerCase()).join(' ')
    expect(text).toContain('cytoplasm')
    expect(text).toMatch(/its own mix of ions/)
  })

  it('admits that channels and pumps are not built yet', () => {
    const text = MEMBRANE_FACTS.map((p) => p.text.toLowerCase()).join(' ')
    expect(text).toMatch(/next milestone/)
  })

  it('quotes the magnification it was given in the scale note', () => {
    expect(membraneScaleNote(2400)).toContain('×2400')
    expect(membraneScaleNote(2400)).toContain('5 nanometres')
    expect(membraneScaleNote(2400)).toContain('280 times thinner')
  })
})
