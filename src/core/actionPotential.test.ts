import { describe, expect, it } from 'vitest'
import { ION_KINDS, IONS, particlesFor } from './ions'
import type { IonCounts } from '../state/ionStore'
import { CHANNEL_IDS, OPEN_FRACTION } from './channels'
import { VM_MAX, VM_MIN, nernstMv } from './voltage'
import {
  apFacts,
  AP_MS,
  apPeakMv,
  apRestMv,
  apStateAt,
  apTroughMv,
  gKAt,
  gNaAt,
  potassiumLagMs,
  SPOTLIGHT_MIN,
  apTrace,
  apVmAt,
  kOpenFraction,
  naOpenFraction,
  polarizationT,
  channelShare,
  spotlight,
  spotlightState,
  spikeCost,
  spikeCostNote,
} from './actionPotential'

const real: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

const at = (u: number) => apStateAt(u * AP_MS, real)

describe('the two doors, and nothing else', () => {
  it('has both essentially shut at the start and the end', () => {
    // Not exactly zero any more, and that is the model being honest: a real
    // membrane at rest has a whisper of both conductances open, which is part of
    // why it rests a millivolt or two below the chord equation's answer.
    expect(naOpenFraction(0, real)).toBeLessThan(0.01)
    expect(kOpenFraction(0, real)).toBeLessThan(OPEN_FRACTION)
    expect(naOpenFraction(1, real)).toBeLessThan(0.01)
    expect(kOpenFraction(1, real)).toBeLessThan(OPEN_FRACTION)
  })

  it('opens sodium before potassium', () => {
    expect(potassiumLagMs(real)).toBeGreaterThan(0)
  })

  it('measures "open" against each door’s own FULL WIDTH', () => {
    // Two bugs this guards. An absolute conductance threshold counted potassium
    // open at 4 % of its own maximum, which reversed the sequence. And measuring
    // against a RUN's maximum drew the potassium channel wide open during a small
    // nudge, because two leak-channels' worth was most of what that run reached —
    // in a demonstration whose point is that nothing happened.
    expect(naOpenFraction(0, real)).toBeLessThan(0.01)
    expect(kOpenFraction(0, real)).toBeLessThan(0.01)
    const peakOf = (f: (u: number) => number) =>
      Math.max(...Array.from({ length: 201 }, (_, i) => f(i / 200)))
    for (const f of [
      (u: number) => naOpenFraction(u, real),
      (u: number) => kOpenFraction(u, real),
    ]) {
      // A real spike opens each door a good way, and never all the way: not every
      // channel of a type is open at once.
      expect(peakOf(f)).toBeGreaterThan(0.3)
      expect(peakOf(f)).toBeLessThan(1)
    }
  })

  it('shuts sodium again while the membrane is still depolarized', () => {
    // Inactivation, not repolarization: sodium is already gone by the time the
    // voltage comes back down.
    const closing = at(0.15)
    expect(closing.naOpen).toBeLessThan(OPEN_FRACTION)
    expect(closing.kOpen).toBeGreaterThan(OPEN_FRACTION)
  })

  it('opens sodium far wider than potassium', () => {
    let na = 0
    let k = 0
    for (let i = 0; i <= 100; i++) {
      na = Math.max(na, gNaAt(i / 100, real))
      k = Math.max(k, gKAt(i / 100, real))
    }
    expect(na).toBeGreaterThan(k * 1.5)
  })
})

describe('the shape of the spike is a consequence, not a drawing', () => {
  it('starts and ends at the resting voltage', () => {
    const rest = apRestMv(real)
    expect(rest).toBeCloseTo(-72, 0)
    expect(at(0).vm).toBeCloseTo(rest, 1)
    expect(at(1).vm).toBeCloseTo(rest, 0)
  })

  it('overshoots zero on the way up', () => {
    expect(apPeakMv(real)).toBeGreaterThan(0)
  })

  it('never passes the voltage sodium is content at', () => {
    // The membrane is an average of the two, so it cannot outrun either.
    expect(apPeakMv(real)).toBeLessThan(nernstMv('na', real))
  })

  it('undershoots past rest, but not past potassium’s own voltage', () => {
    const trough = apTroughMv(real)
    expect(trough).toBeLessThan(apRestMv(real))
    expect(trough).toBeGreaterThan(nernstMv('k', real))
  })

  it('rises then falls — one peak, in that order', () => {
    expect(at(0.1).vm).toBeGreaterThan(at(0).vm)
    expect(at(0.3).vm).toBeLessThan(at(0.1).vm)
    expect(at(0.4).vm).toBeLessThan(apRestMv(real))
    expect(at(0.9).vm).toBeGreaterThan(at(0.4).vm)
  })

  it('names its phases in order', () => {
    expect(at(0.03).phase).toBe('rising')
    expect(at(0.12).phase).toBe('falling')
    expect(at(0.4).phase).toBe('undershoot')
    expect(at(0.9).phase).toBe('recovering')
    expect(at(1).phase).toBe('done')
  })
})

describe('a flattened gradient breaks the spike on its own', () => {
  const flat: IonCounts = { ...real, na: { outside: 80, inside: 80 } }

  it('still depolarizes — toward where sodium is now content', () => {
    const peak = apPeakMv(flat)
    expect(peak).toBeGreaterThan(apRestMv(flat))
    expect(peak).toBeLessThan(0)
  })

  it('needs no special case: the same equation simply gives a smaller answer', () => {
    expect(apPeakMv(flat)).toBeLessThan(apPeakMv(real))
  })

  it('loses the spike entirely if potassium is what is flattened', () => {
    const flatK: IonCounts = { ...real, k: { outside: 70, inside: 70 } }
    // Nothing left to pull it back down hard, so the undershoot goes.
    expect(apTroughMv(flatK)).toBeGreaterThan(apTroughMv(real))
  })
})

describe('what one spike costs the gradients (N17)', () => {
  const cost = spikeCost(real)

  it('moves a tiny fraction of one drawn ball', () => {
    // One ball is 1 mM. This is the number the whole "the bars do not move"
    // lesson rests on, so it is asserted rather than trusted.
    expect(cost.naMM).toBeGreaterThan(0)
    expect(cost.naMM).toBeLessThan(0.05)
    expect(cost.spikesPerBall).toBeGreaterThan(20)
  })

  it('moves potassium out on the same order as sodium in', () => {
    expect(cost.kMM).toBeGreaterThan(cost.naMM * 0.3)
    expect(cost.kMM).toBeLessThan(cost.naMM * 3)
  })

  it('carries more sodium than the bare capacitive minimum', () => {
    // Because potassium is already leaving while sodium is still arriving.
    expect(cost.overlap).toBeGreaterThan(1)
  })

  it('accumulates the totals through the spike, ending at the full cost', () => {
    expect(at(0).naIn).toBe(0)
    expect(at(0.15).naIn).toBeGreaterThan(0)
    expect(at(0.15).naIn).toBeLessThan(cost.naMM)
    expect(at(1).naIn).toBeCloseTo(cost.naMM, 5)
    expect(at(1).kOut).toBeCloseTo(cost.kMM, 5)
  })

  it('brings sodium IN and potassium OUT, never the reverse', () => {
    for (let i = 1; i <= 10; i++) {
      const now = at(i / 10)
      const before = at((i - 1) / 10)
      expect(now.naIn).toBeGreaterThanOrEqual(before.naIn)
      expect(now.kOut).toBeGreaterThanOrEqual(before.kOut)
    }
  })
})

describe('the trace can be drawn before the spike is fired (N17)', () => {
  it('samples the same curve the spike itself follows', () => {
    const trace = apTrace(real, true, 40)
    expect(trace).toHaveLength(41)
    for (let i = 0; i <= 40; i++) {
      expect(trace[i]).toBeCloseTo(apVmAt(i / 40, real), 6)
    }
  })

  it('starts and ends at rest, with the peak near the front', () => {
    const trace = apTrace(real)
    expect(trace[0]).toBeCloseTo(apRestMv(real), 6)
    expect(trace[trace.length - 1]).toBeCloseTo(apVmAt(1, real), 6)
    const peakAt = trace.indexOf(Math.max(...trace)) / (trace.length - 1)
    expect(peakAt).toBeLessThan(0.25)
  })

  it('reshapes when a gradient is dragged — which is why it can be shown early', () => {
    const flat: IonCounts = { ...real, na: { outside: 80, inside: 80 } }
    expect(Math.max(...apTrace(flat))).toBeLessThan(Math.max(...apTrace(real)))
  })

  it('fits inside the meter’s scale, so both instruments share one axis', () => {
    for (const mv of apTrace(real)) {
      expect(mv).toBeGreaterThan(VM_MIN)
      expect(mv).toBeLessThan(VM_MAX)
    }
  })
})

describe('a spike is a position, not an elapsed time (N17)', () => {
  it('gives the same reading for the same position, every time', () => {
    // This is what makes pause and scrub possible at all: there is no
    // accumulated state to rewind, only a number to set.
    expect(apStateAt(0.42 * AP_MS, real)).toEqual(apStateAt(0.42 * AP_MS, real))
  })

  it('can be read backwards as happily as forwards', () => {
    const forward = [0.2, 0.5, 0.8].map((u) => apStateAt(u * AP_MS, real).vm)
    const backward = [0.8, 0.5, 0.2].map((u) => apStateAt(u * AP_MS, real).vm)
    expect(backward).toEqual([...forward].reverse())
  })
})

describe('which protein is doing the work, moment by moment', () => {
  const shareAt = (u: number) => channelShare(at(u), true)

  it('gives sodium’s channel almost all of it at the peak', () => {
    const s = shareAt(0.05)
    expect(s['voltage-na']).toBeGreaterThan(0.8)
    expect(s['voltage-k']).toBeLessThan(0.2)
  })

  it('hands over to potassium’s channel on the way down', () => {
    const s = shareAt(0.2)
    expect(s['voltage-k']).toBeGreaterThan(0.8)
    expect(s['voltage-na']).toBeLessThan(0.05)
  })

  it('hands back to the plain leak by the end of the recovery', () => {
    const s = shareAt(0.9)
    expect(s['leak-k']).toBeGreaterThan(s['voltage-k'])
  })

  it('tells "no spotlight" apart from "fully lit"', () => {
    // Not a pedantic distinction: treating them alike highlighted all five
    // proteins on the resting membrane at once.
    expect(spotlightState(null)).toBe('none')
    expect(spotlightState(1)).toBe('starring')
  })

  it('sorts a share into a look', () => {
    const at = (u: number, id: 'voltage-na' | 'voltage-k' | 'leak-k') =>
      spotlightState(spotlight(shareAt(u)[id]))
    // At the peak sodium's channel is carrying nearly all of it and potassium's
    // almost none; by the time the voltage is coming down they have swapped; and
    // during the long recovery the plain leak is back in charge.
    expect(at(0.05, 'voltage-na')).toBe('starring')
    expect(at(0.05, 'voltage-k')).toBe('drained')
    expect(at(0.2, 'voltage-k')).toBe('starring')
    expect(at(0.9, 'leak-k')).toBe('starring')
  })

  it('has a middle state, so the change is not all-or-nothing', () => {
    // Somewhere on the leak's way back to being in charge it is neither lit nor
    // drained. Scanned rather than pinned to a position, because the position
    // moves whenever the model does.
    const looks = Array.from({ length: 101 }, (_, i) =>
      spotlightState(spotlight(shareAt(i / 100)['leak-k'])),
    )
    expect(looks).toContain('ordinary')
  })

  it('never dims a protein to nothing — dim is not absent', () => {
    for (const u of [0, 0.1, 0.3, 0.6, 0.9, 1]) {
      const s = shareAt(u)
      for (const id of CHANNEL_IDS) {
        expect(spotlight(s[id])).toBeGreaterThanOrEqual(SPOTLIGHT_MIN)
        expect(spotlight(s[id])).toBeGreaterThan(0)
      }
    }
  })

  it('counts the background permeabilities, so shares never total one falsely', () => {
    // Every channel shut: what is left must not claim to be all of the current.
    const shut = channelShare(null, false)
    expect(CHANNEL_IDS.reduce((sum, id) => sum + shut[id], 0)).toBe(0)
    const idle = channelShare(null, true)
    expect(idle['leak-k']).toBeLessThan(1)
  })

  it('leaves the leak channel plainly involved — it is not a bystander', () => {
    // The push-back this rule exists for: turn the leak off and the membrane
    // does not even start in the same place, so a fixed dim on it would lie.
    expect(apRestMv(real, false)).toBeGreaterThan(apRestMv(real, true) + 25)
    expect(shareAt(0)['leak-k']).toBeGreaterThan(0.5)
  })
})

describe('the colour field over the cytoplasm', () => {
  const eNa = nernstMv('na', real)
  const eK = nernstMv('k', real)
  const rest = apRestMv(real)
  const tAt = (vm: number) => polarizationT(vm, rest, eNa, eK)

  it('is zero at rest and signed the way the voltage moved', () => {
    expect(tAt(rest)).toBe(0)
    expect(tAt(rest + 20)).toBeGreaterThan(0)
    expect(tAt(rest - 10)).toBeLessThan(0)
  })

  it('is CONTINUOUS through rest — the whole point of the change', () => {
    // A hue that flips sign at rest reads as a snap. Either side of rest the
    // value has to approach zero, so the colour approaches the neutral middle.
    expect(Math.abs(tAt(rest + 0.05))).toBeLessThan(0.02)
    expect(Math.abs(tAt(rest - 0.05))).toBeLessThan(0.02)
  })

  it('rises monotonically in both directions, up to each limit', () => {
    // Each direction has its own reach — 133 mV up to sodium's voltage, only 17
    // down to potassium's — and past its limit the value holds at the end rather
    // than carrying on.
    for (let d = 1; d < Math.round(eNa - rest); d++) {
      expect(tAt(rest + d)).toBeGreaterThan(tAt(rest + d - 1))
    }
    for (let d = 1; d < Math.round(rest - eK); d++) {
      expect(tAt(rest - d)).toBeLessThan(tAt(rest - d + 1))
    }
  })

  it('measures each direction against how far it COULD go', () => {
    // At sodium's own voltage it is fully warm; at potassium's, fully cold.
    expect(tAt(eNa)).toBeCloseTo(1, 5)
    expect(tAt(eK)).toBeCloseTo(-1, 5)
  })

  it('brings the peak and the dip out at comparable strength', () => {
    // 110 mV up and 15 mV down, but each is most of the way to its own limit —
    // which is why the undershoot is visible at all.
    expect(Math.abs(tAt(apPeakMv(real)))).toBeGreaterThan(0.6)
    expect(Math.abs(tAt(apTroughMv(real)))).toBeGreaterThan(0.6)
  })

  it('never runs past the ends', () => {
    expect(tAt(eNa + 500)).toBeLessThanOrEqual(1)
    expect(tAt(eK - 500)).toBeGreaterThanOrEqual(-1)
  })
})

describe('the words match the numbers', () => {
  it('quotes the derived cost rather than a written-down one', () => {
    const cost = spikeCost(real)
    const text = spikeCostNote(cost)
      .map((p) => p.text)
      .join(' ')
    expect(text).toContain(cost.naMM.toFixed(3))
    expect(text).toContain(String(Math.round(cost.spikesPerBall)))
  })

  it('owns up to how much the movement is slowed', () => {
    expect(apFacts().map((p) => p.text).join(' ')).toMatch(/210 times slower/)
  })

  it('counts the pauses into how long the demonstration takes', () => {
    // A figure the app quotes about itself has to stay true, and the pauses are
    // most of the running time — the movement is 4 s, the whole thing about 16.
    const text = apFacts(12000).map((p) => p.text).join(' ')
    expect(text).toMatch(/stretched to 4 seconds/)
    expect(text).toMatch(/whole demonstration takes about 16 seconds/)
  })

  it('explains the undershoot instead of hiding it', () => {
    const text = apFacts().map((p) => p.text).join(' ')
    expect(text).toMatch(/not a mistake/)
  })
})
