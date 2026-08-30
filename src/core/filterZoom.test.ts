import { describe, expect, it } from 'vitest'
import {
  HYDRATION_KJ,
  R_GAS,
  BODY_K,
  selectivityKJ,
  paybackKJ,
  paysItsWay,
  shortfallFraction,
  FILTER_ZOOM_PARTS,
  FILTER_ZOOM_HONESTY,
  filterLedger,
} from './filterZoom'
import { SELECTIVITY, filterVerdict } from './channelStructure'

describe('the ledger', () => {
  it('makes the SMALLER ion the expensive one', () => {
    // The whole exhibit turns on this being the right way round: sodium is
    // smaller, so it holds its water harder, so undressing it costs more.
    expect(Math.abs(HYDRATION_KJ.na)).toBeGreaterThan(Math.abs(HYDRATION_KJ.k))
  })

  it('DERIVES the shortfall from the selectivity, never asserts it', () => {
    // RT·ln S, and nothing else. Measure, never assert.
    expect(selectivityKJ()).toBeCloseTo((R_GAS * BODY_K * Math.log(SELECTIVITY)) / 1000, 6)
    // A result that does not change when the input changes is a broken
    // parameter, so: change the input.
    expect(selectivityKJ(SELECTIVITY * 10)).toBeGreaterThan(selectivityKJ())
    expect(selectivityKJ(1)).toBeCloseTo(0, 9)
  })

  it('lands where the channel bench lands, by a different route', () => {
    // Two independent accounts of the same fact — one from fit, one from the
    // energy ledger — and they must agree.
    for (const kind of ['na', 'k'] as const) {
      expect(paysItsWay(kind)).toBe(filterVerdict(kind) === 'through')
    }
  })

  it('leaves sodium short by exactly the selectivity, and no more', () => {
    const cost = Math.abs(HYDRATION_KJ.na)
    expect(cost - paybackKJ('na')).toBeCloseTo(selectivityKJ(), 9)
    expect(paybackKJ('k')).toBeCloseTo(Math.abs(HYDRATION_KJ.k), 9)
  })

  it('keeps the shortfall a NOTCH — which is the point', () => {
    // A few per cent of the cost buys a thousandfold. If this ever grew into
    // a big fraction the bars would stop being surprising and the exhibit
    // would be teaching the wrong shape.
    expect(shortfallFraction()).toBeGreaterThan(0.01)
    expect(shortfallFraction()).toBeLessThan(0.1)
  })
})

describe('what it says', () => {
  it('never claims a number it did not work out', () => {
    const said = [...FILTER_ZOOM_PARTS, ...FILTER_ZOOM_HONESTY, ...filterLedger()]
      .map((p) => p.text)
      .join(' ')
    expect(said).toContain(String(Math.abs(HYDRATION_KJ.na)))
    expect(said).toContain(String(Math.abs(HYDRATION_KJ.k)))
    expect(said).toContain(String(Math.round(selectivityKJ())))
  })

  it('declares the exaggerations and says which numbers are real', () => {
    const honesty = FILTER_ZOOM_HONESTY.map((p) => p.text).join(' ')
    expect(honesty).toMatch(/CALIBRATED/)
    expect(honesty).toMatch(/SIMPLIFIED/)
    expect(honesty).toMatch(/SLOWED DOWN/)
  })

  it('gives each ion a verdict that matches its ledger', () => {
    const [k, na] = filterLedger()
    expect(k.icon).toBe('✅')
    expect(na.icon).toBe('❌')
    expect(na.text).toMatch(/short/i)
  })
})
