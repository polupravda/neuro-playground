import { describe, expect, it } from 'vitest'
import {
  GAMMA_PS,
  TAU_OPEN_MS,
  CHANNELS_IN_CELL,
  PATCH_WINDOW_MS,
  STEPS_MV,
  reversalMv,
  unitaryPa,
  openProbability,
  meanClosedMs,
  dwells,
  openAt,
  ionsInFlight,
  FLIGHT_MS,
  ionsPerSecond,
  PATCH_PARTS,
  PATCH_HONESTY,
  patchRightNow,
} from './patchClamp'

describe('one channel', () => {
  it('sits against the potassium voltage the CELL says, not a typed-in one', () => {
    // Derived from the concentrations, like every other voltage in this app.
    expect(reversalMv()).toBeLessThan(-80)
    expect(reversalMv()).toBeGreaterThan(-100)
    // And at that voltage the current is nothing, by definition.
    expect(unitaryPa(reversalMv())).toBeCloseTo(0, 9)
  })

  it('opens MORE OFTEN with depolarisation, and never wider', () => {
    // THE lesson of the exhibit. Voltage moves the open probability; the step
    // height is set by the driving force and the conductance, and one open
    // channel is one open channel.
    const [rest, mid, high] = STEPS_MV
    expect(openProbability(rest)).toBeLessThan(0.05)
    expect(openProbability(mid)).toBeGreaterThan(openProbability(rest))
    expect(openProbability(high)).toBeGreaterThan(openProbability(mid))
    expect(openProbability(high)).toBeGreaterThan(0.8)
    // The unitary step does grow — but only because the DRIVING FORCE grows,
    // and far less than the open probability does. A test that let the two
    // change by the same factor would not be pinning the distinction.
    const poFactor = openProbability(high) / openProbability(mid)
    const stepFactor = unitaryPa(high) / unitaryPa(mid)
    expect(stepFactor).toBeLessThan(2)
    expect(poFactor).toBeGreaterThan(stepFactor)
  })

  it('gets its shut time from the open time and Po, with nothing invented', () => {
    for (const vm of STEPS_MV) {
      const po = openProbability(vm)
      const tc = meanClosedMs(vm)
      expect(TAU_OPEN_MS / (TAU_OPEN_MS + tc)).toBeCloseTo(po, 2)
    }
  })

  it('is always in exactly one state, with no gaps in the record', () => {
    for (const vm of STEPS_MV) {
      const record = dwells(0, vm)
      expect(record.length).toBeGreaterThan(0)
      for (let i = 1; i < record.length; i++) {
        expect(record[i].fromMs).toBeCloseTo(record[i - 1].toMs, 9)
        expect(record[i].open).toBe(!record[i - 1].open)
      }
      expect(record[record.length - 1].toMs).toBeGreaterThanOrEqual(PATCH_WINDOW_MS)
      expect(record[0].fromMs).toBeLessThanOrEqual(0)
    }
  })

  it('is SEEDED — the same record every time, so pausing does not reshuffle', () => {
    const a = dwells(3, 0).map((d) => d.fromMs)
    const b = dwells(3, 0).map((d) => d.fromMs)
    expect(a).toEqual(b)
    // …and different channels are genuinely different.
    expect(dwells(4, 0).map((d) => d.fromMs)).not.toEqual(a)
  })

  it('flickers little at rest and a lot when pushed', () => {
    const [rest, , high] = STEPS_MV
    let atRest = 0
    let atHigh = 0
    for (let ms = 0; ms < PATCH_WINDOW_MS; ms += 1) {
      if (openAt(0, rest, ms)) atRest++
      if (openAt(0, high, ms)) atHigh++
    }
    expect(atRest).toBeLessThan(atHigh)
    expect(atHigh / PATCH_WINDOW_MS).toBeGreaterThan(0.5)
  })
})

describe('the ions going through', () => {
  it('only lets ions through while the door is OPEN', () => {
    // The picture and the record are the same fact seen twice, and this is
    // the invariant that says so: every ion in flight LEFT THE PORE at a
    // moment when the door was open. (Checking "is the door open now" instead
    // would be wrong — an ion drawn part way up the pipette left up to a
    // flight-time ago, and the door may have shut behind it. It should have.)
    for (const vm of STEPS_MV) {
      for (let now = 0; now < PATCH_WINDOW_MS; now += 3) {
        for (const ion of ionsInFlight(vm, now)) {
          const left = now - ion.progress * FLIGHT_MS
          expect(openAt(0, vm, left)).toBe(true)
        }
      }
    }
  })

  it('sends more through at a voltage that is open more of the time', () => {
    let low = 0
    let high = 0
    for (let now = 0; now < PATCH_WINDOW_MS; now += 5) {
      low += ionsInFlight(STEPS_MV[0], now).length
      high += ionsInFlight(STEPS_MV[2], now).length
    }
    expect(high).toBeGreaterThan(low)
  })

  it('never leaves an ion half-drawn outside its flight', () => {
    for (const vm of STEPS_MV) {
      for (const now of [0, 77, 199, PATCH_WINDOW_MS]) {
        for (const ion of ionsInFlight(vm, now)) {
          expect(ion.progress).toBeGreaterThanOrEqual(0)
          expect(ion.progress).toBeLessThanOrEqual(1)
          expect(Number.isFinite(ion.seed)).toBe(true)
        }
      }
    }
  })

  it('is seeded — the same moment always draws the same ions', () => {
    expect(ionsInFlight(0, 123)).toEqual(ionsInFlight(0, 123))
  })

  it('says how much traffic it is leaving out', () => {
    // A drawn ion stands for millions. The honesty note has to be able to
    // quote the real number, so the real number has to be computed.
    expect(ionsPerSecond(STEPS_MV[2])).toBeGreaterThan(1e6)
    expect(ionsPerSecond(STEPS_MV[2])).toBeGreaterThan(ionsPerSecond(STEPS_MV[0]))
  })
})

describe('what it says', () => {
  it('teaches the two things only this exhibit can show', () => {
    const said = PATCH_PARTS.map((p) => p.text).join(' ')
    expect(said).toMatch(/same size|height of the steps/i)
    expect(said).toMatch(/how much of the time|how often/i)
    // The "thousands of these add up to the smooth curve" idea survives as a
    // sentence now that the summed trace is gone — a sentence is the honest
    // form for a claim nothing on screen draws.
    expect(said).toContain(CHANNELS_IN_CELL.toLocaleString('en-US'))
  })

  it('declares what is calibrated and what is simplified', () => {
    const honesty = PATCH_HONESTY.map((p) => p.text).join(' ')
    expect(honesty).toMatch(/CALIBRATED/)
    expect(honesty).toMatch(/SEEDED/)
    expect(honesty).toMatch(/SIMPLIFIED/)
    expect(honesty).toContain(String(GAMMA_PS))
  })

  it('says something different at each voltage', () => {
    const said = (vm: number) =>
      patchRightNow(vm)
        .map((p) => p.text)
        .join(' ')
    expect(said(STEPS_MV[0])).not.toBe(said(STEPS_MV[2]))
  })
})
