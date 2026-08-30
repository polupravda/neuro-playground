import { describe, expect, it } from 'vitest'
import { ION_KINDS, IONS, particlesFor } from './ions'
import type { IonCounts } from '../state/ionStore'
import {
  BUFFER_RATIO,
  CA_HALF_MV,
  HILL_N,
  POOL,
  caInf,
  eCaMv,
  integrateSynapse,
  releasedBy,
  synapseFacts,
  synapseRun,
  tauCa,
} from './synapse'
import { tauM } from './spikeModel'
import { FRONTIER_SHORT } from './neuron'

const counts = (over: Partial<Record<string, { outside: number; inside: number }>> = {}) =>
  ION_KINDS.reduce((acc, kind) => {
    acc[kind] = {
      outside: particlesFor(IONS[kind].outsideMM),
      inside: particlesFor(IONS[kind].insideMM),
      ...(over[kind] ?? {}),
    }
    return acc
  }, {} as IonCounts)

const real = counts()
const run = synapseRun(real, true)

describe('the calcium door', () => {
  it('stays shut at rest and opens only for a real spike', () => {
    // A terminal that leaked calcium at rest would be releasing transmitter at
    // rest. This gate opens well above where sodium's does, which is why it does
    // not — and it is the reason the calcium channel gets its own feature.
    expect(caInf(-72)).toBeLessThan(0.005)
    expect(caInf(-50)).toBeLessThan(0.05)
    expect(caInf(CA_HALF_MV)).toBeCloseTo(0.5, 5)
    expect(caInf(40)).toBeGreaterThan(0.99)
  })

  it('is slower than sodium’s at every voltage', () => {
    for (const v of [-90, -60, -20, 0, 40]) {
      expect(tauCa(v), `at ${v} mV`).toBeGreaterThan(tauM)
    }
  })

  it('shuts faster than it opens', () => {
    expect(tauCa(-80)).toBeLessThan(tauCa(30))
  })
})

describe('when the calcium actually arrives', () => {
  it('is barely open at the top of the spike', () => {
    // The finding this view exists for, and it was measured rather than arranged:
    // the door is slow, so at the very peak of the action potential it has hardly
    // started to open.
    expect(run.openAtVmPeak).toBeLessThan(0.35)
  })

  it('peaks in current AFTER the voltage, and in concentration after that', () => {
    // Three different moments, in order. A view that flashed everything at the
    // top of the spike would be teaching the opposite.
    expect(run.icaPeakMs).toBeGreaterThan(run.vmPeakMs)
    expect(run.caPeakMs).toBeGreaterThan(run.icaPeakMs)
  })

  it('brings most of its calcium in on the way down', () => {
    expect(run.onTheWayDown).toBeGreaterThan(0.8)
  })
})

describe('how much calcium, and where', () => {
  it('sits on a gradient far steeper than sodium’s', () => {
    expect(run.eCaMv).toBeGreaterThan(120)
    expect(run.eCaMv).toBeLessThan(145)
  })

  it('raises the terminal’s average only to a micromolar or two', () => {
    // Buffering is why. Without it one spike appeared to raise free calcium fifty
    // times too far, and a number that wrong would have made every downstream
    // claim on this page wrong with it.
    expect(run.peakCaUm).toBeGreaterThan(0.5)
    expect(run.peakCaUm).toBeLessThan(5)
    expect(BUFFER_RATIO).toBeGreaterThan(10)
  })

  it('but piles up far higher at the mouth of an open door', () => {
    // The sensor sits there, not in the average — which is what confines release
    // to about a millisecond instead of the tens the average stays high for.
    expect(run.peakLocalUm).toBeGreaterThan(run.peakCaUm * 8)
  })

  it('takes far longer to clear than the spike took to happen', () => {
    const late = run.caUm[run.caUm.length - 1]
    expect(late).toBeGreaterThan(run.restUm * 2)
    expect(late).toBeLessThan(run.peakCaUm)
  })
})

describe('release', () => {
  it('happens within a couple of milliseconds and then stops', () => {
    const times = run.vesicles.map((v) => v.fusedAtMs).filter((t): t is number => t !== null)
    expect(times.length).toBeGreaterThan(0)
    for (const t of times) {
      expect(t).toBeGreaterThan(run.vmPeakMs)
      expect(t).toBeLessThan(6)
    }
  })

  it('does not empty the whole pool — release is a matter of chance', () => {
    const went = run.vesicles.filter((v) => v.fusedAtMs !== null).length
    expect(went).toBeGreaterThan(0)
    expect(went).toBeLessThan(POOL)
  })

  it('plays the same way every time, so scrubbing works', () => {
    const again = integrateSynapse(real, true)
    expect(again.vesicles.map((v) => v.fusedAtMs)).toEqual(
      run.vesicles.map((v) => v.fusedAtMs),
    )
  })

  it('counts only what has already gone', () => {
    expect(releasedBy(run, 0)).toBe(0)
    expect(releasedBy(run, run.windowMs)).toBe(
      run.vesicles.filter((v) => v.fusedAtMs !== null).length,
    )
  })

  it('collapses when the calcium outside is taken away — the fourth power', () => {
    // The classic experiment, and it works here because the OUTSIDE pile is a real
    // drawn count. Dropping it to a quarter should cut release far more than
    // fourfold, which is the whole point of the exponent.
    const quarter = counts({ ca: { outside: particlesFor(0.5), inside: particlesFor(0.0001) } })
    const weak = synapseRun(quarter, true)
    const strong = run.vesicles.filter((v) => v.fusedAtMs !== null).length
    const few = weak.vesicles.filter((v) => v.fusedAtMs !== null).length
    expect(weak.eCaMv).toBeLessThan(run.eCaMv)
    expect(few).toBeLessThan(strong)
    expect(HILL_N).toBe(4)
  })
})

describe('what it says about itself', () => {
  it('quotes what it measured', () => {
    const text = synapseFacts(run, real)
      .map((p) => p.text)
      .join(' ')
    expect(text).toContain(run.eCaMv.toFixed(0))
    expect(text).toContain(run.peakCaUm.toFixed(1))
    expect(text).toContain(`${Math.round(run.openAtVmPeak * 100)}%`)
  })

  it('says what is not built yet', () => {
    const text = synapseFacts(run, real)
      .map((p) => p.text)
      .join(' ')
    // Pinned against the single source of truth — see FRONTIER in core/neuron.ts.
    expect(text).toMatch(/still to build|not built|no picture/i)
    expect(text).toContain(FRONTIER_SHORT)
  })

  it('has something true to say even when nothing was released', () => {
    const flat = counts({ ca: { outside: particlesFor(0.02), inside: particlesFor(0.0001) } })
    const quiet = synapseRun(flat, true)
    const paras = synapseFacts(quiet, flat)
    expect(paras.length).toBeGreaterThan(0)
    for (const para of paras) expect(para.text).not.toContain('NaN')
  })
})

describe('the Nernst voltage', () => {
  it('halves RT/F because calcium carries two charges', () => {
    // Getting this wrong would overstate calcium's gradient by a factor of two,
    // and nothing else on the page would look different.
    const doubled = counts({ ca: { outside: particlesFor(4), inside: particlesFor(0.0001) } })
    const base = eCaMv(real)
    expect(eCaMv(doubled) - base).toBeCloseTo((26.7 / 2) * Math.log(2), 1)
  })
})
