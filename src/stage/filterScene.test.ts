import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  LANE_W,
  LANE_H,
  CONTROL_ROW_H,
  FZ_BUDGET,
  FZ_BUDGET_W,
  FZ_MAG,
  RUN_MS,
  LANE_KIND,
  lanePoseAt,
  gripGapNm,
  siteT,
  FZ_PX_PER_NM,
  INSET_MAG,
  INSET_R,
  runOver,
  drawLane,
  laneLabels,
  swapHappens,
} from './filterScene'
import { spokenTermAt } from './spokenLabels'
import { IONS } from '../core/ions'

describe('the two lanes', () => {
  it('runs both ions on ONE clock — the comparison is the exhibit', () => {
    for (const ms of [0, 500, RUN_MS * 0.4, RUN_MS * 0.8, RUN_MS]) {
      const k = lanePoseAt('k', ms)
      const na = lanePoseAt('na', ms)
      expect(Number.isFinite(k.t)).toBe(true)
      expect(Number.isFinite(na.t)).toBe(true)
    }
  })

  it('stops the working leg ON a rung, not between two of them', () => {
    // The pose used to end its work leg at a made-up 0.32, which on the real
    // geometry landed the ion halfway between the first and second sites —
    // gripped by nothing. It is asked of the geometry now.
    const held = lanePoseAt('k', RUN_MS * 0.61).t
    expect(held).toBeCloseTo(siteT(0), 2)
    expect(lanePoseAt('na', RUN_MS * 0.61).t).toBeCloseTo(siteT(0), 2)
  })

  it('takes potassium through and sends sodium back', () => {
    const k = lanePoseAt('k', RUN_MS)
    const na = lanePoseAt('na', RUN_MS)
    expect(k.t).toBeCloseTo(1, 3)
    expect(k.gone).toBeCloseTo(1, 3)
    // Sodium ends where it began: back in the water below, jacket back on.
    expect(na.t).toBeLessThan(0.1)
    expect(na.gone).toBe(0)
  })

  it('takes the coat off the ion the oxygens can REACH, and only that one', () => {
    // This test has now been the wrong way round twice, so here is the
    // mechanism it is guarding (2026-08-28).
    //
    // Taking the coat off is not something an ion does or refuses to do. It
    // is an EXCHANGE: a water leaves only when an oxygen arrives where that
    // water was. For potassium the oxygens arrive exactly there, so the coat
    // goes and the ion goes with it. For sodium — smaller — the same oxygens
    // close to the same place and stop short of its surface, so nothing worth
    // trading for ever arrives and the water stays on. Dressed, it cannot get
    // in, and it leaves dressed.
    const mid = RUN_MS * 0.62
    expect(lanePoseAt('k', mid).coat).toBeLessThan(0.1)
    expect(lanePoseAt('na', mid).coat).toBeGreaterThan(0.75)
    expect(lanePoseAt('na', RUN_MS).coat).toBeCloseTo(1, 2)
    // …and the difference is READ from the geometry, never decided twice.
    expect(swapHappens('k')).toBe(true)
    expect(swapHappens('na')).toBe(false)
  })

  it('closes the cage the SAME amount in both lanes — it is one filter', () => {
    // The difference must never be in what the protein does. Same reach,
    // same rungs; the ion is what differs.
    for (let ms = 0; ms <= RUN_MS * 0.62; ms += 100) {
      expect(lanePoseAt('na', ms).reach).toBeCloseTo(lanePoseAt('k', ms).reach, 9)
    }
  })

  it('leaves daylight round sodium and none round potassium', () => {
    // THE mechanism, as a number. The cage is built to touch potassium, so
    // its gap is zero; sodium is smaller, so a real distance is left, and
    // that distance is what the picture has to show.
    expect(gripGapNm('k')).toBeCloseTo(0, 6)
    expect(gripGapNm('na')).toBeGreaterThan(0.02)
    expect(gripGapNm('na')).toBeCloseTo((IONS.k.bareNm - IONS.na.bareNm) / 2, 9)
  })

  it('draws that daylight big enough to see — in the INSET', () => {
    // The panel now shows the whole passage, with the ion small enough to
    // read as something travelling through it (user, 2026-08-28: "I didn't
    // mean to scale things up"). At that scale the gap is seven pixels, so
    // the panel cannot be where the point is made. The inset is: the app's
    // two-frame magnification, once per lane, at four times the panel.
    expect(gripGapNm('na') * FZ_PX_PER_NM).toBeLessThan(12)
    expect(gripGapNm('na') * FZ_PX_PER_NM * INSET_MAG).toBeGreaterThan(24)
    // …and it is a real share of the frame, not a hairline in a big circle.
    const gapPx = gripGapNm('na') * FZ_PX_PER_NM * INSET_MAG
    expect(gapPx / (INSET_R * 2)).toBeGreaterThan(0.12)
  })

  it('gives the WORK most of the window, not the travelling', () => {
    // A run's clock follows the interest. The middle leg — jacket off, the
    // oxygens reaching — is the payload, so walk the clock and check it owns
    // the screen time.
    let working = 0
    for (let ms = 0; ms <= RUN_MS; ms += 10) {
      const p = lanePoseAt('k', ms)
      if (p.coat > 0.02 && p.coat < 0.98) working += 10
    }
    expect(working / RUN_MS).toBeGreaterThan(0.35)
  })

  it('ends', () => {
    expect(runOver(RUN_MS - 1)).toBe(false)
    expect(runOver(RUN_MS)).toBe(true)
  })

  it('clamps outside its window instead of running off', () => {
    for (const kind of LANE_KIND) {
      const late = lanePoseAt(kind, RUN_MS * 4)
      expect(late.t).toBeGreaterThanOrEqual(0)
      expect(late.t).toBeLessThanOrEqual(1)
      expect(lanePoseAt(kind, -500).t).toBe(0)
    }
  })
})

describe('the drawing', () => {
  it('draws at rest and at every moment of a run, with real colours', () => {
    for (const ms of [null, 0, RUN_MS * 0.3, RUN_MS * 0.7, RUN_MS]) {
      const c = strictCanvas()
      for (const kind of LANE_KIND) drawLane(c.ctx, kind, ms)
      expect(c.calls.length).toBeGreaterThan(50)
    }
  })

  it('names the things a child cannot be expected to know', () => {
    for (const kind of LANE_KIND) {
      const labels = laneLabels(kind)
      const terms = labels.map((l) => l.term)
      expect(terms).toContain('carbonyl oxygen')
      expect(terms).toContain('water coat')
      for (const l of labels) {
        expect(spokenTermAt(labels, l.x + l.w / 2, l.y + l.h / 2)).toBeTruthy()
        expect(l.x).toBeGreaterThanOrEqual(0)
        expect(l.x + l.w).toBeLessThanOrEqual(LANE_W)
        expect(l.y).toBeGreaterThanOrEqual(0)
        expect(l.y + l.h).toBeLessThanOrEqual(LANE_H)
      }
    }
  })

  it('declares its magnification rather than claiming a round number', () => {
    expect(FZ_MAG).toBeGreaterThan(1000)
    expect(Number.isFinite(FZ_MAG)).toBe(true)
  })
})

describe('the panel column fits what is stacked in it', () => {
  it('leaves room for the control row above the two panels', () => {
    // The same lesson the channel bench's size key taught: anything added
    // above a canvas has to be subtracted from its height, and the guard is
    // the SUM rather than the symptom (2026-08-28).
    const CHROME = 12 + 4 * 2 + 2
    expect(CONTROL_ROW_H + LANE_H + CHROME).toBeLessThanOrEqual(FZ_BUDGET)
  })

  it('fits two panels and their gap across the width', () => {
    expect(LANE_W * 2 + 16 + 20).toBeLessThanOrEqual(FZ_BUDGET_W)
  })
})
