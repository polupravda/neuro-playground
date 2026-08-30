import { describe, expect, it } from 'vitest'
import {
  somaAreaCm2,
  somaVolumeL,
  somaCapacitanceF,
  chargesFor,
  potassiumInside,
  oneInHowMany,
  capacitorRightNow,
  capacitorHonesty,
  CAPACITOR_FACTS,
  fmtBig,
  crowdComparison,
  REST_MV,
} from './capacitor'
import { SOMA_DIAMETER_UM } from './membrane'
import { IONS } from './ions'

describe('the derivation', () => {
  it('gets a 20 µm cell right: ~13 pF and hundreds of billions of potassium ions', () => {
    // Sphere of the app's own declared diameter, in the app's own units.
    expect(somaAreaCm2()).toBeCloseTo(1.257e-5, 8)
    expect(somaVolumeL()).toBeCloseTo(4.19e-12, 14)
    const pF = somaCapacitanceF() * 1e12
    expect(pF).toBeGreaterThan(10)
    expect(pF).toBeLessThan(16)
    expect(potassiumInside()).toBeGreaterThan(3e11)
    expect(potassiumInside()).toBeLessThan(4e11)
  })

  it('needs only millions of charges for a resting voltage — one ion in tens of thousands', () => {
    const q = chargesFor(REST_MV)
    expect(q).toBeGreaterThan(4e6)
    expect(q).toBeLessThan(7e6)
    const ratio = oneInHowMany(REST_MV)
    expect(ratio).toBeGreaterThan(40_000)
    expect(ratio).toBeLessThan(90_000)
  })

  it('is proportional: twice the voltage, twice the charge; zero at zero', () => {
    expect(chargesFor(-40) / chargesFor(-20)).toBeCloseTo(2, 6)
    expect(chargesFor(0)).toBe(0)
    // Sign does not change how much is held, only which face holds what.
    expect(chargesFor(50)).toBeCloseTo(chargesFor(-50), 6)
    expect(oneInHowMany(0)).toBe(Infinity)
  })

  it('follows the app’s own geometry, not a typed-in number', () => {
    // A result that does not change when the input changes is a broken
    // parameter: the area, and therefore the charge, must track the soma.
    const area = somaAreaCm2()
    expect(area).toBeCloseTo(4 * Math.PI * ((SOMA_DIAMETER_UM / 2) * 1e-4) ** 2, 12)
    // And the crowd must track the potassium concentration the app declares.
    expect(potassiumInside()).toBeCloseTo(
      (IONS.k.insideMM / 1000) * somaVolumeL() * 6.022e23,
      -6,
    )
  })
})

describe('the words', () => {
  it('reads the ratio off the model, and never prints one at zero volts', () => {
    const resting = capacitorRightNow(REST_MV, false).map((p) => p.text).join(' ')
    expect(resting).toContain(fmtBig(oneInHowMany(REST_MV)))
    // The two raw counts are READINGS ON THE PICTURE (28b), so the column must
    // not repeat them — it carries what they mean instead.
    expect(resting).not.toContain(fmtBig(chargesFor(REST_MV)))
    expect(resting).not.toContain(fmtBig(potassiumInside()))
    const zero = capacitorRightNow(0, false).map((p) => p.text).join(' ')
    expect(zero).not.toMatch(/Infinity|NaN/)
    expect(zero).toMatch(/zero/i)
  })

  it('narrates the lag only while it is happening', () => {
    expect(capacitorRightNow(REST_MV, true).map((p) => p.text).join(' ')).toMatch(/takes a moment/)
    expect(capacitorRightNow(REST_MV, false).map((p) => p.text).join(' ')).not.toMatch(
      /takes a moment/,
    )
  })

  it('keeps the electrical names out of the child-facing text', () => {
    // "Charge and count only" (user ruling): capacitance, farads and Q = C·V
    // belong to the honesty note, where the adult reading aloud finds them.
    const kid = [...CAPACITOR_FACTS, ...capacitorRightNow(REST_MV, true)]
      .map((p) => p.text)
      .join(' ')
    expect(kid).not.toMatch(/capacitan|farad|Q = C/i)
    const grown = capacitorHonesty().map((p) => p.text).join(' ')
    expect(grown).toMatch(/CAPACITANCE/)
    expect(grown).toMatch(/Q = C × V/)
    expect(grown).toMatch(/picofarads/)
  })

  it('declares what a mark stands for, and that the crowd is counted as potassium', () => {
    const text = capacitorHonesty().map((p) => p.text).join(' ')
    expect(text).toMatch(/stands for a crowd/)
    expect(text).toMatch(/potassium/)
    expect(text).toMatch(/320 ms/)
  })
})

describe('the everyday comparison', () => {
  it('picks a crowd a child knows, and CHANGES with the dial', () => {
    // The ratio in figures means nothing to a kid; the comparison is chosen by
    // whichever everyday crowd is nearest in powers of ten, so it is derived
    // rather than decorative — and a different voltage gives a different one.
    expect(crowdComparison(oneInHowMany(REST_MV))).toMatch(/stadium/)
    expect(crowdComparison(oneInHowMany(-8))).not.toBe(
      crowdComparison(oneInHowMany(REST_MV)),
    )
    // Never a comparison where there is no ratio.
    expect(crowdComparison(Infinity)).toBe('')
    expect(crowdComparison(0)).toBe('')
  })

  it('reaches the child through the words, not through raw digits alone', () => {
    const text = capacitorRightNow(REST_MV, false).map((p) => p.text).join(' ')
    expect(text).toContain(crowdComparison(oneInHowMany(REST_MV)))
    // The two FACES are explained, because the picture's own label says
    // "face" and a kid has no idea what that means otherwise.
    expect(text).toMatch(/FACES are the wall's two surfaces/)
  })
})
