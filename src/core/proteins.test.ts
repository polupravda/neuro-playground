import { describe, expect, it } from 'vitest'
import {
  LEAK_FACTS,
  LEAK_WIDTH_NM,
  PUMP_FACTS,
  PUMP_K_IN,
  PUMP_NA_OUT,
  PUMP_WIDTH_NM,
  offNote,
  pumpNetChargeOut,
} from './proteins'
import { MEMBRANE_THICKNESS_NM } from './membrane'

describe('pump stoichiometry (checkpoint A)', () => {
  it('moves three sodium out and two potassium in', () => {
    expect(PUMP_NA_OUT).toBe(3)
    expect(PUMP_K_IN).toBe(2)
  })

  it('is electrogenic: one net positive charge leaves per cycle', () => {
    expect(pumpNetChargeOut()).toBe(1)
  })
})

describe('protein sizes', () => {
  it('makes both proteins wider than the membrane is thick', () => {
    expect(PUMP_WIDTH_NM).toBeGreaterThan(MEMBRANE_THICKNESS_NM)
    expect(LEAK_WIDTH_NM).toBeGreaterThanOrEqual(MEMBRANE_THICKNESS_NM)
  })

  it('makes the pump the bulkier of the two', () => {
    expect(PUMP_WIDTH_NM).toBeGreaterThan(LEAK_WIDTH_NM)
  })
})

describe('pump teaching text', () => {
  const text = PUMP_FACTS.map((p) => p.text.toLowerCase()).join(' ')

  it('quotes the stoichiometry it draws', () => {
    expect(text).toContain('3 sodium go out')
    expect(text).toContain('2 potassium come in')
  })

  it('says it costs energy and names ATP (active transport)', () => {
    expect(text).toContain('atp')
    expect(text).toMatch(/costs energy/)
    expect(text).toMatch(/against their gradients/)
  })

  it('calls it a machine rather than a hole — the active/passive distinction', () => {
    expect(text).toMatch(/a machine, not a hole/)
  })

  it('mentions the electrogenic nudge WITHOUT crediting it for the resting voltage', () => {
    expect(text).toMatch(/more negative/)
    expect(text).toMatch(/not where most of the voltage comes from/)
  })
})

describe('leak-channel teaching text', () => {
  const text = LEAK_FACTS.map((p) => p.text.toLowerCase()).join(' ')

  it('calls it always open and free', () => {
    expect(text).toMatch(/always open/)
    expect(text).toMatch(/no energy/)
  })

  it('credits the gradient rather than the channel for the movement', () => {
    expect(text).toMatch(/the channel does not push it — the gradient does/)
  })

  it('names selective permeability as the main source of the resting voltage', () => {
    expect(text).toContain('selectively permeable')
    expect(text).toMatch(/main reason the resting voltage/)
  })

  it('explains why the piles hold steady while both proteins work', () => {
    expect(text).toMatch(/exactly cancel/)
  })
})

describe('offNote', () => {
  it('is honest that stopping the pump takes minutes to show', () => {
    expect(offNote('pump')).toMatch(/minutes, not seconds/)
  })

  it('ties shutting the leaks to losing selective permeability', () => {
    expect(offNote('channel')).toMatch(/selectively permeable/)
  })
})
