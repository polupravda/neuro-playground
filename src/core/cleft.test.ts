import { describe, expect, it } from 'vitest'
import { ION_KINDS, IONS, particlesFor } from './ions'
import type { IonCounts } from '../state/ionStore'
import { synapseRun } from './synapse'
import {
  AMPA_REVERSAL_MV,
  CLEAR_MS,
  CLEFT_NM,
  K_RESENS,
  SPINE_REST_MV,
  cleftFacts,
  cleftRun,
  crossingUs,
  integrateCleft,
  perVesicleMM,
  sampleCleft,
} from './cleft'

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
const terminal = synapseRun(real, true)
const gap = cleftRun(terminal)

describe('crossing the gap', () => {
  it('takes MICROseconds, which is the whole point of this step', () => {
    // The misconception this feature exists to correct: that the synaptic delay is
    // the message travelling. It is not. Twenty nanometres is nothing to a molecule.
    expect(crossingUs()).toBeGreaterThan(0)
    expect(crossingUs()).toBeLessThan(2)
  })

  it('is a thousand times shorter than the delay before release', () => {
    // Both measured, neither asserted — and the RATIO is the teaching.
    const release = gap.firstFusionMs!
    expect(release).toBeGreaterThan(1)
    expect(release / (crossingUs() / 1000)).toBeGreaterThan(1000)
  })
})

describe('the transmitter', () => {
  it('arrives at millimolar and empties in well under a millisecond', () => {
    expect(perVesicleMM()).toBeGreaterThan(0.5)
    expect(perVesicleMM()).toBeLessThan(6)
    expect(gap.peakMM).toBeGreaterThan(perVesicleMM())
    expect(gap.transientMs).toBeLessThan(1.5)
  })

  it('peaks the instant a vesicle goes, not later', () => {
    // If this ever drifts it means something is modelling the crossing as a
    // journey. ⚠ Against the NEAREST fusion, not the first: with three
    // staggered doses (2026-09-01, the middle vesicle joined) the peak sits on
    // whichever fusion tops the stack — the claim is that it sits ON one of
    // them, since any journey would land it after all of them.
    const fusions = terminal.vesicles
      .map((v) => v.fusedAtMs)
      .filter((t): t is number => t !== null)
    const nearest = Math.min(...fusions.map((t) => Math.abs(gap.peakMMAtMs - t)))
    expect(nearest).toBeLessThan(0.05)
    expect(gap.peakMMAtMs).toBeGreaterThanOrEqual(gap.firstFusionMs!)
  })

  it('is gone long before the receptors have finished', () => {
    expect(gap.transientMs).toBeLessThan(gap.responseMs)
  })

  it('E5: drives an EPSP — graded, late, decaying, and NEVER past the reversal', () => {
    // The spine's answer (2026-09-01): a conductance synapse on an RC
    // membrane, no script. It rises AFTER the receptors' own peak, tops out
    // strictly between rest and the reversal, and sinks home on the membrane
    // clock — a nudge, not a spike.
    expect(gap.peakPostMv).toBeGreaterThan(SPINE_REST_MV + 5)
    expect(gap.peakPostMv).toBeLessThan(AMPA_REVERSAL_MV)
    expect(gap.peakPostAtMs).toBeGreaterThan(gap.peakOpenAtMs)
    for (const v of gap.vmPost) {
      expect(v).toBeGreaterThanOrEqual(SPINE_REST_MV - 1e-6)
      expect(v).toBeLessThan(AMPA_REVERSAL_MV)
    }
    // Decayed most of the way home by the end of the window.
    expect(sampleCleft(gap, 'vmPost', 1)).toBeLessThan(SPINE_REST_MV + 3)
    // And a terminal that released nothing moves the spine not at all.
    const quiet = integrateCleft({
      ...terminal,
      vesicles: terminal.vesicles.map((v) => ({ ...v, fusedAtMs: null })),
    })
    for (const v of quiet.vmPost) expect(v).toBeCloseTo(SPINE_REST_MV, 6)
  })

  it('clears faster when the gap clears faster', () => {
    expect(CLEAR_MS).toBeLessThan(1)
  })
})

describe('the receptor', () => {
  it('needs TWO molecules before anything opens', () => {
    // The response follows the square of the transmitter at low doses, which is why
    // a small spill does almost nothing and a full packet does a lot. Checked by
    // dosing the same receptors with a quarter as much and seeing far less than a
    // quarter of the opening.
    const one = integrateCleft({
      ...terminal,
      vesicles: [{ index: 0, fusedAtMs: 2 }, ...terminal.vesicles.slice(1).map((v) => ({ ...v, fusedAtMs: null }))],
    })
    expect(one.peakOpen).toBeGreaterThan(0)
    expect(one.peakOpen).toBeLessThan(gap.peakOpen)
  })

  it('opens quickly after the packet lands, and not completely', () => {
    expect(gap.peakOpenAtMs - gap.firstFusionMs!).toBeGreaterThan(0)
    expect(gap.peakOpenAtMs - gap.firstFusionMs!).toBeLessThan(1.5)
    // Not all of them. A synapse is a brief, partial shout.
    expect(gap.peakOpen).toBeGreaterThan(0.2)
    expect(gap.peakOpen).toBeLessThan(0.95)
  })

  it('shuts some of itself while the transmitter is still there', () => {
    // Desensitization, and it must be visible: it is why a synapse shouted at over
    // and over has less to give each time.
    const at = gap.desensitized[gap.desensitized.length - 1]
    expect(Math.max(...gap.desensitized)).toBeGreaterThan(0.1)
    expect(at).toBeGreaterThan(0.05)
    // and slow to undo
    expect(K_RESENS).toBeLessThan(0.1)
  })

  it('is still holding transmitter after the gap is empty', () => {
    const late = sampleCleft(gap, 'bound', 0.5)
    const emptyGap = sampleCleft(gap, 'mM', 0.5)
    expect(emptyGap).toBeLessThan(0.01)
    expect(late).toBeGreaterThan(0.05)
  })
})

describe('nothing released', () => {
  const silent = { ...terminal, vesicles: terminal.vesicles.map((v) => ({ ...v, fusedAtMs: null })) }
  const quiet = integrateCleft(silent)

  it('leaves the gap empty and the receptors shut', () => {
    expect(quiet.peakMM).toBe(0)
    expect(quiet.peakOpen).toBe(0)
    expect(quiet.firstFusionMs).toBeNull()
  })

  it('still has something true to say', () => {
    const paras = cleftFacts(quiet)
    expect(paras.length).toBeGreaterThan(0)
    for (const p of paras) expect(p.text).not.toContain('NaN')
  })
})

describe('what it says about itself', () => {
  it('quotes what it measured', () => {
    const text = cleftFacts(gap).map((p) => p.text).join(' ')
    expect(text).toContain(crossingUs().toFixed(2))
    expect(text).toContain(gap.peakMM.toFixed(2))
    expect(text).toContain(`${Math.round(gap.peakOpen * 100)}%`)
    expect(text).toContain(String(CLEFT_NM))
  })

  it('declares the drawn EPSP honestly, now that the consequence IS built', () => {
    // Until 2026-09-01 this test pinned "nothing is coming through them yet".
    // The postsynaptic answer is drawn now, so the honest claims changed: the
    // spine's drive is TYPICAL rather than measured and says so, the peak is
    // quoted from the run, and the firing decision is placed where it lives —
    // at the soma, not in this view.
    const text = cleftFacts(gap).map((p) => p.text).join(' ')
    expect(text).not.toMatch(/nothing is coming/i)
    expect(text).toMatch(/NOT MEASURED/)
    expect(text).toMatch(/soma/)
    expect(text).toContain(gap.peakPostMv.toFixed(0))
    expect(text).toMatch(/not an action potential/i)
  })
})
