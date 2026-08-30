import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  CAP_W,
  CAP_H,
  CAP_WALL_Y,
  CAP_MIN_MV,
  CAP_MAX_MV,
  MAX_MARKS,
  BULK_IONS,
  marksFor,
  markXs,
  skinFaces,
  chargesPerMark,
  bulkAt,
  leanOf,
  meterT,
  drawCapacitor,
  capacitorLabels,
} from './capacitorScene'
import { chargesFor, REST_MV } from '../core/capacitor'
import { spokenTermAt } from './spokenLabels'
import { HALF_MEM } from './bilayer'

describe('the skin', () => {
  it('thickens with the voltage and vanishes at zero', () => {
    expect(marksFor(0)).toBe(0)
    expect(marksFor(-30)).toBeGreaterThan(0)
    expect(marksFor(-60)).toBeGreaterThan(marksFor(-30))
    expect(marksFor(CAP_MIN_MV)).toBe(MAX_MARKS)
    // Which face is which is a matter of sign, not of amount.
    expect(marksFor(50)).toBe(marksFor(-50))
  })

  it('spreads its marks across the whole face, inside the frame', () => {
    for (const mv of [-95, -72, -20, 40]) {
      const xs = markXs(mv)
      expect(xs).toHaveLength(marksFor(mv))
      for (const x of xs) {
        expect(x).toBeGreaterThan(0)
        expect(x).toBeLessThan(CAP_W)
      }
      for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
    }
  })

  it('marks the inside face only while it is negative — the ions ARE the plus skin', () => {
    // A negative inner face is charge this picture never draws, so it needs a
    // symbol. A positive one is the potassium crowd itself, already on screen:
    // marking it too put an abstract plus under a drawn plus, which read as a
    // plus being pulled onto a plus (2026-08-28).
    for (const mv of [CAP_MIN_MV, REST_MV, -5]) expect(skinFaces(mv)).toEqual([-1, 1])
    for (const mv of [5, 40, CAP_MAX_MV]) expect(skinFaces(mv)).toEqual([-1])
    // The outside face is never dropped: its crowd is not drawn at all.
    for (const mv of [CAP_MIN_MV, 0, CAP_MAX_MV]) expect(skinFaces(mv)).toContain(-1)
  })

  it('says how many real charges one mark stands for, and it is a crowd', () => {
    const per = chargesPerMark(REST_MV)
    expect(per).toBeGreaterThan(1000)
    expect(per * marksFor(REST_MV)).toBeCloseTo(chargesFor(REST_MV), 0)
    expect(chargesPerMark(0)).toBe(0)
  })
})

describe('the crowd', () => {
  it('keeps its COUNT at every voltage — none is created or destroyed', () => {
    for (const mv of [CAP_MIN_MV, REST_MV, 0, 30, CAP_MAX_MV]) {
      expect(bulkAt(0, mv)).toHaveLength(BULK_IONS)
    }
  })

  it('leans the right way: pushed off the wall when negative, pulled in when positive', () => {
    // The bug this pins: the crowd used to ignore the dial entirely, so the
    // exhibit had a control that changed nothing you could see. Potassium is
    // a cation, so the sign of the lean is physics, not decoration.
    const near = (mv: number) =>
      bulkAt(0, mv).filter((i) => i.y < CAP_WALL_Y + HALF_MEM + 40).length
    const pushed = near(CAP_MIN_MV)
    const resting = near(REST_MV)
    const flat = near(0)
    const pulled = near(CAP_MAX_MV)
    expect(pushed).toBeLessThan(flat)
    expect(resting).toBeLessThan(flat)
    expect(pulled).toBeGreaterThan(flat)
    // And it is a real difference, not a rounding wobble.
    expect(pulled - pushed).toBeGreaterThan(BULK_IONS * 0.1)
    expect(leanOf(CAP_MIN_MV)).toBeLessThan(0)
    expect(leanOf(CAP_MAX_MV)).toBeGreaterThan(0)
    expect(leanOf(0)).toBe(0)
  })

  it('never lets an ion into the wall or out of the cytoplasm, at any setting', () => {
    for (const mv of [CAP_MIN_MV, REST_MV, 0, 30, CAP_MAX_MV]) {
      for (const ion of bulkAt(1234, mv)) {
        expect(ion.y).toBeGreaterThan(CAP_WALL_Y + HALF_MEM)
        expect(ion.y).toBeLessThan(CAP_H)
        expect(ion.x).toBeGreaterThan(0)
        expect(ion.x).toBeLessThan(CAP_W)
      }
    }
  })

  it('keeps its order: leaning never makes two ions swap places', () => {
    const a = bulkAt(0, CAP_MIN_MV)
    const b = bulkAt(0, CAP_MAX_MV)
    for (let i = 0; i < BULK_IONS; i++) {
      for (let j = i + 1; j < BULK_IONS; j++) {
        // Tolerance covers the per-ion jiggle (±1.6 px each way), which is not
      // part of the ordering the warp is responsible for.
      if (a[i].y < a[j].y - 8) expect(b[i].y).toBeLessThan(b[j].y + 8)
      }
    }
  })
})

describe('the dial', () => {
  it('spans rest and both polarities, and the needle tracks it', () => {
    expect(CAP_MIN_MV).toBeLessThan(REST_MV)
    expect(CAP_MAX_MV).toBeGreaterThan(0)
    expect(meterT(CAP_MIN_MV)).toBeCloseTo(0, 6)
    expect(meterT(CAP_MAX_MV)).toBeCloseTo(1, 6)
    expect(meterT(REST_MV)).toBeGreaterThan(0)
    expect(meterT(REST_MV)).toBeLessThan(1)
  })
})

describe('the words on the picture', () => {
  it('names both faces and the crowd, and every name speaks', () => {
    // "Face" was a word the exhibit used and never showed (28b): the two
    // surfaces are now named where their own marks are, and the abstract
    // counter panel that stood beside the patch is gone.
    const terms = capacitorLabels().map((l) => l.term)
    expect(terms).toContain('outside face')
    expect(terms).toContain('inside face')
    expect(terms).toContain('potassium')
    for (const l of capacitorLabels()) {
      expect(spokenTermAt([l], l.x + 2, l.y + 2)).toBe(l.term)
    }
  })
})

describe('the drawing survives a strict canvas', () => {
  it('draws the patch at every setting without a bad colour or NaN', () => {
    for (const mv of [CAP_MIN_MV, REST_MV, 0, 30, CAP_MAX_MV]) {
      const c = strictCanvas()
      drawCapacitor(c.ctx, mv, 1234)
      expect(c.calls.filter((k) => k === 'arc').length).toBeGreaterThanOrEqual(BULK_IONS)
    }
  })

  it('speaks its names from where they are drawn', () => {
    for (const l of capacitorLabels()) {
      expect(spokenTermAt([l], l.x + 2, l.y + 2)).toBe(l.term)
    }
  })
})
