import { describe, expect, it } from 'vitest'
import {
  DENDRITIC_TRANSMISSION,
  INPUT_AMPLITUDE,
  THRESHOLD,
  amplitudeAtHillock,
  inputsNeededToFire,
  reachesThreshold,
  rippleAmplitude,
} from './integration'

describe('spatial summation', () => {
  it('adds inputs together', () => {
    expect(amplitudeAtHillock(2)).toBeCloseTo(2 * amplitudeAtHillock(1))
    expect(amplitudeAtHillock(3)).toBeCloseTo(3 * amplitudeAtHillock(1))
  })

  it('produces nothing without input', () => {
    expect(amplitudeAtHillock(0)).toBe(0)
    expect(amplitudeAtHillock(-1)).toBe(0)
  })

  it('weakens every input on the way to the soma', () => {
    expect(amplitudeAtHillock(1)).toBeLessThan(INPUT_AMPLITUDE)
    expect(DENDRITIC_TRANSMISSION).toBeLessThan(1)
  })
})

describe('rippleAmplitude', () => {
  it('starts at full strength and decays monotonically inward', () => {
    expect(rippleAmplitude(0)).toBeCloseTo(INPUT_AMPLITUDE)
    let previous = rippleAmplitude(0)
    for (let i = 1; i <= 10; i++) {
      const value = rippleAmplitude(i / 10)
      expect(value).toBeLessThan(previous)
      previous = value
    }
  })

  it('arrives at exactly the amplitude summation uses', () => {
    expect(rippleAmplitude(1)).toBeCloseTo(amplitudeAtHillock(1))
  })

  it('clamps out-of-range progress', () => {
    expect(rippleAmplitude(-1)).toBeCloseTo(INPUT_AMPLITUDE)
    expect(rippleAmplitude(2)).toBeCloseTo(rippleAmplitude(1))
  })
})

describe('threshold (N18)', () => {
  it('is not reached by a single input — the neuron is not a wire', () => {
    expect(reachesThreshold(1)).toBe(false)
  })

  it('is reached when two or three inputs fire together', () => {
    expect(reachesThreshold(2)).toBe(true)
    expect(reachesThreshold(3)).toBe(true)
  })

  it('is all-or-none: crossing it does not depend on how far above it we are', () => {
    expect(amplitudeAtHillock(3)).toBeGreaterThan(amplitudeAtHillock(2))
    expect(reachesThreshold(3)).toBe(reachesThreshold(2))
  })

  it('reports the fewest inputs needed, for the discovery hint', () => {
    expect(inputsNeededToFire(3)).toBe(2)
    expect(inputsNeededToFire(1)).toBe(2)
  })

  it('keeps threshold below the maximum the dendrites can deliver', () => {
    expect(THRESHOLD).toBeLessThan(amplitudeAtHillock(3))
  })
})
