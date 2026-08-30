import { describe, expect, it } from 'vitest'
import {
  FILTER_NM,
  FILTER_SITES,
  SELECTIVITY,
  SENSOR_CHARGES,
  SUBUNITS,
  CHANNEL_PARTS,
  CHANNEL_HONESTY,
  bareFits,
  bareNm,
  filterFacts,
  filterVerdict,
  hydratedFits,
  hydratedNm,
  HELICES,
  HELICES_IN_SECTION,
} from './channelStructure'
import { IONS } from './ions'

describe('the paradox the filter exists to teach', () => {
  it('has sodium SMALLER bare and BIGGER dressed — the app’s own numbers', () => {
    // This is the whole exhibit in two lines. If either ever flips, the
    // lesson is gone and the drawing would be arguing the opposite.
    expect(bareNm('na')).toBeLessThan(bareNm('k'))
    expect(hydratedNm('na')).toBeGreaterThan(hydratedNm('k'))
  })

  it('lets the BIGGER ion through, which no sieve could do', () => {
    expect(filterVerdict('k')).toBe('through')
    expect(filterVerdict('na')).toBe('turned-back')
    // …and the one that passes is the bigger of the two, bare or dressed as
    // it arrives.
    expect(bareNm(filterVerdict('k') === 'through' ? 'k' : 'na')).toBeGreaterThan(bareNm('na'))
  })

  it('fits BOTH bare ions and NEITHER coat — so size is not what decides', () => {
    expect(bareFits('na')).toBe(true)
    expect(bareFits('k')).toBe(true)
    expect(hydratedFits('na')).toBe(false)
    expect(hydratedFits('k')).toBe(false)
    // Both coats are more than twice the filter: taking the coat off is not
    // optional for either of them, which is why the payment is the test.
    expect(hydratedNm('na')).toBeGreaterThan(FILTER_NM * 2)
    expect(hydratedNm('k')).toBeGreaterThan(FILTER_NM * 2)
  })

  it('says the reason in words, and says it is a payment not a squeeze', () => {
    const text = filterFacts().map((f) => f.text).join(' ')
    expect(text).toContain(`${IONS.na.bareNm} nm`)
    expect(text).toContain(`${IONS.k.hydratedNm}`)
    expect(text).toMatch(/coat/)
    expect(text).toMatch(/TOO WIDE for sodium to be paid for, not too narrow/)
    expect(text).toContain(SELECTIVITY.toLocaleString('en-US'))
  })
})

describe('the structure', () => {
  it('is a ring of four, with a sensor that carries charges', () => {
    expect(SUBUNITS).toBe(4)
    expect(SENSOR_CHARGES).toBeGreaterThan(0)
    expect(FILTER_SITES).toBeGreaterThan(1)
    const text = CHANNEL_PARTS.map((p) => p.text).join(' ')
    expect(text).toMatch(/S4/)
    expect(text).toMatch(/POSITIVE charges/)
    // The gate decides whether the way is open; it never pushes.
    expect(text).toMatch(/Nothing pushes the ions/)
  })

  it('declares what the drawing smooths, and how it is known', () => {
    const text = CHANNEL_HONESTY.map((p) => p.text).join(' ')
    expect(text).toMatch(/the smoothness is not/)
    expect(text).toMatch(/slowed enormously/)
    expect(text).toMatch(/crystallised/)
  })
})

describe('nothing is lost when a coat comes off', () => {
  it('says where the water goes, and what the ion gets in exchange', () => {
    // Two complaints, one root (user, 2026-08-28): the waters were stripped
    // and vanished, and the words promised a trade the picture never showed.
    // Both are now in the drawing; the words must match it.
    const text = filterFacts().map((f) => f.text).join(' ')
    expect(text).toMatch(/oxygens sit exactly where potassium's water molecules sat/)
    expect(text).toMatch(/loses nothing/)
  })
})

describe('the cross-section shows what a cross-section shows', () => {
  it('counts THREE helices a side in the pore module, not two', () => {
    // The drawing had two, and the two were mislabelled besides (user,
    // 2026-08-28, against the textbook). The classic figure cuts through the
    // pore module: outer helix, pore helix, inner helix.
    expect(HELICES_IN_SECTION).toBe(3)
    expect(HELICES_IN_SECTION).toBeLessThan(HELICES)
  })

  it('teaches the pore helix and what its far end is for', () => {
    const said = CHANNEL_PARTS.map((p) => p.text).join(' ')
    expect(said).toMatch(/pore helix/i)
    // Its whole point: the end that does not cross the membrane points at the
    // middle, and that is why an ion can sit half way across a greasy wall.
    expect(said).toMatch(/negative/i)
    expect(said).toMatch(/middle/i)
  })

  it('declares which helices are NOT drawn', () => {
    const honesty = CHANNEL_HONESTY.map((p) => p.text).join(' ')
    expect(honesty).toMatch(/SIMPLIFIED/)
    expect(honesty).toMatch(/S1, S2 and S3 are not drawn/)
  })
})
