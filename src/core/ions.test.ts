import { describe, expect, it } from 'vitest'
import {
  ION_FACTS,
  IONS,
  ION_KINDS,
  MAX_PARTICLES,
  PARTICLE_STEP,
  chargeTag,
  chemicalGradientDirection,
  gradientFrom,
  gradientNote,
  particlesFor,
} from './ions'

describe('ion dataset', () => {
  it('contains the four V1 ions', () => {
    expect(ION_KINDS).toHaveLength(4)
    expect(ION_KINDS.map((k) => IONS[k].symbol)).toEqual(['Na⁺', 'K⁺', 'Cl⁻', 'Ca²⁺'])
  })

  it('has correct charge signs (checkpoint A)', () => {
    expect(IONS.na.charge).toBe(1)
    expect(IONS.k.charge).toBe(1)
    expect(IONS.cl.charge).toBe(-1)
    expect(IONS.ca.charge).toBe(2)
  })

  it('has physically positive concentrations on both sides', () => {
    for (const kind of ION_KINDS) {
      expect(IONS[kind].insideMM).toBeGreaterThan(0)
      expect(IONS[kind].outsideMM).toBeGreaterThan(0)
    }
  })

  it('keeps every hydrated ion bigger than its bare self but smaller than a nanometre', () => {
    for (const kind of ION_KINDS) {
      expect(IONS[kind].hydratedNm).toBeGreaterThan(IONS[kind].bareNm)
      expect(IONS[kind].hydratedNm).toBeLessThan(1)
    }
  })

  it('keeps hydrated sodium bigger than hydrated potassium, though the bare atom is smaller', () => {
    expect(IONS.na.bareNm).toBeLessThan(IONS.k.bareNm)
    expect(IONS.na.hydratedNm).toBeGreaterThan(IONS.k.hydratedNm)
  })
})

describe('chemicalGradientDirection', () => {
  it('pushes Na⁺, Cl⁻ and Ca²⁺ inward, K⁺ outward', () => {
    expect(chemicalGradientDirection('na')).toBe('inward')
    expect(chemicalGradientDirection('cl')).toBe('inward')
    expect(chemicalGradientDirection('ca')).toBe('inward')
    expect(chemicalGradientDirection('k')).toBe('outward')
  })
})

describe('gradientFrom (whatever the kid has set up)', () => {
  it('follows the counts, not the textbook', () => {
    expect(gradientFrom(9, 2)).toBe('inward')
    expect(gradientFrom(2, 9)).toBe('outward')
    expect(gradientFrom(4, 4)).toBe('balanced')
  })

  it('reports balanced at zero, so an emptied side is not called a gradient', () => {
    expect(gradientFrom(0, 0)).toBe('balanced')
  })
})

describe('particlesFor', () => {
  it('draws one ball per millimolar, so the piles are the real numbers', () => {
    expect(particlesFor(IONS.na.outsideMM)).toBe(145)
    expect(particlesFor(IONS.na.insideMM)).toBe(15)
    expect(particlesFor(IONS.k.insideMM)).toBe(140)
    expect(particlesFor(IONS.k.outsideMM)).toBe(5)
    expect(particlesFor(IONS.cl.outsideMM)).toBe(110)
    expect(particlesFor(IONS.cl.insideMM)).toBe(10)
  })

  it('keeps a stepper press worth seeing but not overwhelming', () => {
    expect(PARTICLE_STEP).toBeGreaterThan(1)
    expect(PARTICLE_STEP).toBeLessThan(MAX_PARTICLES / 5)
  })

  it('keeps every side of every gradient pointing the real way', () => {
    for (const kind of ION_KINDS) {
      const outside = particlesFor(IONS[kind].outsideMM)
      const inside = particlesFor(IONS[kind].insideMM)
      expect(gradientFrom(outside, inside)).toBe(chemicalGradientDirection(kind))
    }
  })

  it('shows a small but real presence rather than nothing', () => {
    expect(particlesFor(0.6)).toBe(1)
    expect(particlesFor(0.5)).toBe(1)
  })

  it('shows nothing only when there is almost nothing — calcium inside', () => {
    expect(particlesFor(IONS.ca.insideMM)).toBe(0)
    expect(particlesFor(IONS.ca.outsideMM)).toBe(2)
  })

  it('never exceeds the ceiling', () => {
    expect(particlesFor(10_000)).toBe(MAX_PARTICLES)
  })
})

describe('chargeTag', () => {
  it('renders kid-readable tags', () => {
    expect(chargeTag('na')).toBe('+')
    expect(chargeTag('k')).toBe('+')
    expect(chargeTag('cl')).toBe('−')
    expect(chargeTag('ca')).toBe('2+')
  })
})

describe('gradientNote', () => {
  it('names the crowded side and which way the ion would rush', () => {
    expect(gradientNote('na')).toMatch(/more outside than inside/)
    expect(gradientNote('na')).toMatch(/rush in/)
    expect(gradientNote('k')).toMatch(/more inside than outside/)
    expect(gradientNote('k')).toMatch(/rush out/)
  })

  it('treats calcium as the special case instead of quoting a silly ratio', () => {
    expect(gradientNote('ca')).toMatch(/almost none inside/)
    expect(gradientNote('ca')).not.toMatch(/20000/)
  })
})

describe('ion teaching text', () => {
  const text = ION_FACTS.map((p) => p.text.toLowerCase()).join(' ')

  it('calls the lopsidedness stored energy', () => {
    expect(text).toMatch(/gradient/)
    expect(text).toMatch(/stored energy/)
  })

  it('says nothing crosses yet, and why', () => {
    expect(text).toMatch(/nothing is crossing/)
    expect(text).toMatch(/no doorways/)
  })

  it('admits the balls stand for crowds while the sizes are honest', () => {
    expect(text).toMatch(/stands for an enormous crowd/)
    expect(text).toMatch(/real proportions/)
    expect(text).toMatch(/smaller than a lipid head/)
  })

  it('explains that the water shell is what blocks the oily middle', () => {
    expect(text).toMatch(/shell of water/)
    expect(text).toMatch(/oily middle/)
  })
})
