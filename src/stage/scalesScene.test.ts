import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  SC_H,
  SC_W,
  SC_BUDGET,
  SC_CANVAS_H,
  SC_CONTROLS_H,
  SC_FIT,
  fitScene,
  SC_STAGE_W,
  SC_STAGE_H,
  SCALES,
  drawScale,
  scaleBits,
  scaleLabels,
} from './scalesScene'
import { SCENE_INK_Y } from './layout'
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

describe("it uses the app's own pictures", () => {
  it("is drawn at the SCENE's size, so each view is that view", () => {
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

describe('the exhibit fills its room without eating the picture (2026-09-04)', () => {
  // A2: "stretch canvas to take all available space horizontally" — against
  // the 2026-08-28 report that fitting by width "cropped the bottom off".
  // Both can be true at once only if the trim is measured.
  // ⚠ Asked at rooms and scenes this machine does not happen to have. The
  // module constant alone could not exercise the trim at all: in a test
  // environment the window is short, the scene is short, and width already
  // binds — so the branch that matters never ran.
  const ROOM = { w: 1024, h: 728 }
  const INK = { min: 110, max: 630 }

  it('A2: a scene TALLER than its room fills the width by trimming margin', () => {
    const tall = fitScene(ROOM.w, ROOM.h, 1060, 900, INK)
    expect(tall.w).toBe(ROOM.w)
    expect(tall.h).toBe(ROOM.h)
    expect(tall.cropScene).toBeGreaterThan(0)
    // …and the trim really is inside the margin, both ends.
    expect(tall.cropScene).toBeLessThanOrEqual(INK.min)
    expect(tall.cropScene).toBeLessThanOrEqual(900 - INK.max)
  })

  it('A2: when the trim would reach the picture, the picture wins', () => {
    // Ink that runs nearly edge to edge leaves no margin to take.
    const tight = fitScene(ROOM.w, ROOM.h, 1060, 900, { min: 4, max: 896 })
    expect(tight.cropScene).toBe(0)
    // The old both-sides fit: whole picture, slack at the right.
    expect(tight.w).toBeLessThan(ROOM.w)
    expect(tight.h).toBeLessThanOrEqual(ROOM.h)
  })

  it('A2: a scene that already fits the width is left alone', () => {
    const wide = fitScene(ROOM.w, ROOM.h, 1060, 660, INK)
    expect(wide.cropScene).toBe(0)
    expect(wide.w).toBe(ROOM.w)
  })

  it('A2: it uses the full width whenever it can', () => {
    if (SC_FIT.cropScene > 0 || SC_W / SC_STAGE_W <= SC_H / SC_STAGE_H) {
      expect(SC_FIT.w).toBe(SC_W)
    }
  })

  it('A2: whatever it trims is MARGIN — never the scene’s ink', () => {
    // The guard the 2026-08-28 crop did not have.
    expect(SC_FIT.cropScene).toBeGreaterThanOrEqual(0)
    expect(SC_FIT.cropScene).toBeLessThanOrEqual(SCENE_INK_Y.min)
    expect(SC_FIT.cropScene).toBeLessThanOrEqual(SC_STAGE_H - SCENE_INK_Y.max)
    // Every bit of the cell survives the trim, top and bottom.
    expect(SCENE_INK_Y.min).toBeGreaterThanOrEqual(SC_FIT.cropScene)
    expect(SCENE_INK_Y.max).toBeLessThanOrEqual(SC_STAGE_H - SC_FIT.cropScene)
  })

  it('A2: the canvas keeps the scene’s proportions — CSS never distorts it', () => {
    // Backing store and CSS box must describe the same shape, or the neuron
    // is drawn stretched.
    expect(SC_CANVAS_H).toBe(Math.round(SC_STAGE_H - SC_FIT.cropScene * 2))
    expect(SC_FIT.w / SC_STAGE_W).toBeCloseTo(SC_FIT.h / SC_CANVAS_H, 2)
  })

  it('A2: it never asks for more room than it has', () => {
    expect(SC_FIT.w).toBeLessThanOrEqual(SC_W)
    expect(SC_FIT.h).toBeLessThanOrEqual(SC_H)
  })
})
