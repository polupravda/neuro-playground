import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  PC_W,
  PC_H,
  PC_BUDGET,
  PC_CONTROLS_H,
  RIG_H,
  STRIP_H,
  TRACE_X,
  TRACE_W,
  xAtMs,
  drawPatch,
  patchLabels,
} from './patchScene'
import { spokenTermAt } from './spokenLabels'
import { PATCH_WINDOW_MS, STEPS_MV } from '../core/patchClamp'

describe('the recording strip', () => {
  it('puts the window on the paper, left to right, and clamps outside it', () => {
    expect(xAtMs(0)).toBeCloseTo(TRACE_X, 6)
    expect(xAtMs(PATCH_WINDOW_MS)).toBeCloseTo(TRACE_X + TRACE_W, 6)
    expect(xAtMs(-50)).toBeCloseTo(TRACE_X, 6)
    expect(xAtMs(PATCH_WINDOW_MS * 3)).toBeCloseTo(TRACE_X + TRACE_W, 6)
  })

  it('gives the RIG the room and the strip a corner', () => {
    // The apparatus is what a child watches; the trace is the grown-up's way
    // of reading the same thing, so it is kept and kept small (user,
    // 2026-08-28).
    expect(RIG_H).toBeGreaterThan(STRIP_H * 3)
    expect(RIG_H + STRIP_H).toBeLessThanOrEqual(PC_H)
  })

  it('fits the control row and the canvas in the height it has', () => {
    const CHROME = 12 + 4 * 2 + 2
    expect(PC_CONTROLS_H + PC_H + CHROME).toBeLessThanOrEqual(PC_BUDGET)
  })
})

describe('the drawing', () => {
  it('draws at every voltage and every moment, with real colours', () => {
    for (const vm of STEPS_MV) {
      for (const now of [0, 90, 210, PATCH_WINDOW_MS - 1]) {
        const c = strictCanvas()
        drawPatch(c.ctx, vm, now)
        expect(c.calls.length).toBeGreaterThan(40)
      }
    }
  })

  it('draws MORE at a voltage that opens the door more often', () => {
    // The ions only exist while the door is open, so a busier voltage is
    // literally a busier picture. If this ever stopped being true, the ions
    // would have come loose from the record they are supposed to match.
    const busy = (vm: number) => {
      let total = 0
      for (let now = 0; now < PATCH_WINDOW_MS; now += 20) {
        const c = strictCanvas()
        drawPatch(c.ctx, vm, now)
        total += c.calls.length
      }
      return total
    }
    expect(busy(STEPS_MV[2])).toBeGreaterThan(busy(STEPS_MV[0]))
  })

  it('names the apparatus, inside the canvas and tappable', () => {
    const labels = patchLabels()
    expect(labels.map((l) => l.term)).toContain('patch pipette')
    for (const l of labels) {
      expect(spokenTermAt(labels, l.x + l.w / 2, l.y + l.h / 2)).toBeTruthy()
      expect(l.x).toBeGreaterThanOrEqual(0)
      expect(l.x + l.w).toBeLessThanOrEqual(PC_W)
      expect(l.y).toBeGreaterThanOrEqual(0)
      expect(l.y + l.h).toBeLessThanOrEqual(PC_H)
    }
  })
})
