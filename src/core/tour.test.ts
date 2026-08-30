import { describe, expect, it } from 'vitest'
import { ION_KINDS, IONS, particlesFor } from './ions'
import type { IonCounts } from '../state/ionStore'
import { FIRE_STIMULUS } from './spikeModel'
import { fibreRun } from './fibre'
import { viewFibre } from '../stage/axonRibbon'
import { ZOOM_TARGETS } from '../stage/layout'
import { TOUR_STOPS, scaleAgreement, tourFacts
} from './tour'
import { FRONTIER } from './neuron'

const real: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

const fibre = fibreRun(real, true, FIRE_STIMULUS, viewFibre(false))

describe('the route', () => {
  it('goes to places that exist and that the camera can reach', () => {
    for (const stop of TOUR_STOPS) {
      if (stop.zoom === null) continue
      expect(ZOOM_TARGETS.some((t) => t.id === stop.zoom), stop.id).toBe(true)
    }
  })

  it('walks outwards, smallest first', () => {
    // The spec's own order, and the opposite of how the app is explored. Every
    // other route zooms IN to answer "what is really happening"; this one pulls
    // out to answer "what was all that for".
    const scaleOf = (id: string | null) =>
      ZOOM_TARGETS.find((t) => t.id === id)?.scale ?? 1
    const scales = TOUR_STOPS.map((s) => scaleOf(s.zoom))
    for (let i = 1; i < scales.length; i++) expect(scales[i]).toBeLessThan(scales[i - 1])
  })

  it('ends on the whole cell, which is where the signal ends', () => {
    expect(TOUR_STOPS[TOUR_STOPS.length - 1].zoom).toBeNull()
  })
})

describe('the claim the tour is built on', () => {
  const agree = scaleAgreement(real, true, fibre)

  it('finds the SAME spike at both scales', () => {
    // This is the whole of C05 as a fact rather than a story: one patch on its own
    // and one patch in the middle of an axon are the same equations on the same
    // membrane, so they must give the same answer. If this ever fails, the tour is
    // telling a child something untrue and should be pulled, not re-worded.
    expect(agree.gapMv).toBeLessThan(2)
    expect(agree.patchWidthMs).toBeGreaterThan(0.5)
    expect(Math.abs(agree.patchWidthMs - agree.fibreWidthMs)).toBeLessThan(0.2)
  })

  it('does not report them as IDENTICAL, because they are not', () => {
    // The small difference is the interesting part and the describer names it: a
    // patch in a cable loses current sideways to its neighbours, which is exactly
    // what wakes the next patch. Rounding it away would delete the mechanism that
    // joins the two scales.
    expect(agree.gapMv).toBeGreaterThan(0)
    expect(agree.fibrePeakMv).toBeLessThan(agree.patchPeakMv)
  })

  it('quotes its measurements rather than asserting numbers', () => {
    const text = tourFacts(TOUR_STOPS[1], agree)
      .map((p) => p.text)
      .join(' ')
    expect(text).toContain(agree.patchPeakMv.toFixed(1))
    expect(text).toContain(agree.fibrePeakMv.toFixed(1))
    expect(text).toContain(agree.gapMv.toFixed(1))
  })

  it('still has something to say when there is nothing to measure', () => {
    for (const stop of TOUR_STOPS) {
      expect(tourFacts(stop, null).length).toBeGreaterThan(0)
      for (const para of tourFacts(stop, null)) expect(para.text.length).toBeGreaterThan(20)
    }
  })

  it('admits what is not built yet', () => {
    // An app that has spent four milestones refusing to assert unmeasured numbers
    // must not finish on a promise dressed as a demonstration.
    const last = tourFacts(TOUR_STOPS[TOUR_STOPS.length - 1], agree)
      .map((p) => p.text)
      .join(' ')
    // Pinned against the ONE place that says where the app stops. It used to carry
    // its own wording and went stale three times — when the terminal landed, when
    // the far side of the gap landed, and when both were removed again. A test
    // cannot know whether such a sentence is true; it can only make sure there is a
    // single sentence to keep true.
    expect(last).toMatch(/not built/i)
    expect(last).toContain(FRONTIER)
  })
})

describe('the three sizes, as a switch', () => {
  it('still covers one signal at three sizes, smallest first', () => {
    // The destinations were never the problem — only the corridor shape was.
    expect(TOUR_STOPS).toHaveLength(3)
    expect(TOUR_STOPS[0].zoom).toBe('axon-membrane')
    expect(TOUR_STOPS[1].zoom).toBe('axon-signal')
    expect(TOUR_STOPS[2].zoom).toBeNull()
  })
})
