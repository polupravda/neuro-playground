import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  SC_H,
  SC_BUDGET,
  SC_CONTROLS_H,
  SC_STAGE_W,
  SC_STAGE_H,
  SCALES,
  drawScale,
  scaleBits,
  scaleLabels,
} from './scalesScene'
import { spokenTermAt } from './spokenLabels'
import { TOUR_STOPS } from '../core/tour'
import { trajectory, FIRE_STIMULUS } from '../core/spikeModel'
import { fibreRun } from '../core/fibre'
import { viewFibre } from './axonRibbon'
import { restingCounts } from '../core/ions'
import { STAGE_W, STAGE_H } from './layout'
import { apTrace, apRestMv } from '../core/actionPotential'

const counts = restingCounts()
const data = scaleBits(
  counts,
  true,
  true,
  trajectory(counts, true, FIRE_STIMULUS),
  fibreRun(counts, true, FIRE_STIMULUS, viewFibre(false)),
  apTrace(counts, true, 96, FIRE_STIMULUS),
  apRestMv(counts, true),
)

describe('one signal, three sizes', () => {
  it('has exactly the three the course names', () => {
    expect(SCALES).toHaveLength(TOUR_STOPS.length)
    expect(SCALES.map((s) => s.id)).toEqual(TOUR_STOPS.map((s) => s.id))
  })

  it('draws every size at rest and at every moment of a run', () => {
    for (const scale of SCALES) {
      for (const u of [null, 0, 0.3, 0.6, 1]) {
        const c = strictCanvas()
        drawScale(c.ctx, scale.i, data, u)
        expect(c.calls.length).toBeGreaterThan(20)
      }
    }
  })

  it('changes what it draws as the run goes on', () => {
    // If a size drew the same thing at every moment it would not be showing a
    // signal at all — which is the one thing this exhibit claims to do.
    for (const scale of SCALES) {
      const at = (u: number) => {
        const c = strictCanvas()
        drawScale(c.ctx, scale.i, data, u)
        return c.calls.length
      }
      const counts3 = [at(0.05), at(0.4), at(0.8)]
      expect(new Set(counts3).size).toBeGreaterThan(1)
    }
  })

  it('names what a child cannot be expected to know, inside the canvas', () => {
    for (const scale of SCALES) {
      const labels = scaleLabels(scale.i)
      for (const l of labels) {
        expect(spokenTermAt(labels, l.x + l.w / 2, l.y + l.h / 2)).toBeTruthy()
        expect(l.x).toBeGreaterThanOrEqual(0)
        expect(l.x + l.w).toBeLessThanOrEqual(SC_STAGE_W)
        expect(l.y).toBeGreaterThanOrEqual(0)
        expect(l.y + l.h).toBeLessThanOrEqual(SC_STAGE_H)
      }
    }
  })

  it('fits the control row and the canvas in the height it has', () => {
    const CHROME = 12 + 4 * 2 + 2
    expect(SC_CONTROLS_H + SC_H + CHROME).toBeLessThanOrEqual(SC_BUDGET)
  })
})

describe('it uses the app\'s own pictures', () => {
  it('is drawn at the SCENE\'s size, so each view is that view', () => {
    // ⚠ The first version hand-composed a membrane and used the little map
    // for the whole cell — two fresh drawings of things the app already draws
    // (user, 2026-08-28). It goes through `drawScene` at the real cameras
    // now, which only works if the canvas is the scene's own size.
    expect(SC_STAGE_W).toBe(STAGE_W)
    expect(SC_STAGE_H).toBe(STAGE_H)
  })

  it('adds no names of its own — the scene names its own parts', () => {
    for (const scale of SCALES) expect(scaleLabels(scale.i)).toEqual([])
  })
})
