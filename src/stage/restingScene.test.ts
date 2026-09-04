import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  RS_W,
  RS_H,
  RESET_BOX,
  TRAY,
  TRAY_H,
  TRAY_W,
  TRAY_Y,
  labelSpeakerAt,
  resetBoxAt,
  chipAt,
  doorAt,
  doorsAt,
  drawResting,
  markAt,
  overWall,
  restingLabels,
} from './restingScene'
import {
  EMPTY_WALL,
  MAX_DOORS,
  REAL_WALL,
  contentAt,
  restingMvOf,
  tugEnds,
  type Doors,
} from '../core/resting'
import { REST_MV } from '../core/capacitor'
import { spokenTermAt } from './spokenLabels'

const WALLS: Doors[] = [EMPTY_WALL, REAL_WALL, { k: 4, cl: 0, na: 0 }, { k: 1, cl: 0, na: 3 }]

describe('the resting bench draws its own answer', () => {
  it('draws every wall with real colours and finite numbers', () => {
    for (const w of WALLS) {
      const c = strictCanvas()
      drawResting(c.ctx, w, restingMvOf(w), 1200, null)
      expect(c.calls.length).toBeGreaterThan(40)
    }
    // Including with something under the finger.
    const c = strictCanvas()
    drawResting(c.ctx, REAL_WALL, REST_MV, 900, { kind: 'na', x: 300, y: 250 })
    expect(c.calls.length).toBeGreaterThan(40)
  })

  it('puts one door in the wall for every door in the model', () => {
    // ⚠ The doors ARE the exhibit: the count on screen has to be the count the
    // equation weighed, or the picture describes a different membrane.
    for (const w of WALLS) {
      const built = doorsAt(w)
      expect(built.length).toBe(Math.min(MAX_DOORS, w.k + w.na))
      expect(built.filter((d) => d.kind === 'k').length).toBe(Math.min(MAX_DOORS, w.k))
    }
  })

  it('keeps every door inside the panel and never stacks them', () => {
    for (const w of [...WALLS, { k: MAX_DOORS, cl: 0, na: 0 }]) {
      const xs = doorsAt(w).map((d) => d.x).sort((a, b) => a - b)
      for (const x of xs) {
        expect(x).toBeGreaterThan(0)
        expect(x).toBeLessThan(RS_W)
      }
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(14)
    }
  })

  it('gives every voter an end on the scale — chloride included', () => {
    // ⚠ Chloride had a share on the board and nothing to explain it (user,
    // 2026-08-30). It is a mark on the scale now, between the other two.
    const ends = tugEnds()
    expect(markAt(ends.from)).toBeLessThan(markAt(contentAt('cl')))
    expect(markAt(contentAt('cl'))).toBeLessThan(markAt(ends.to))
  })

  it('marks a real cell, so the state words have something to mean', () => {
    // Every reading is "compared with a real cell", so a real cell has to be
    // ON the scale or the comparison is invisible.
    const real = markAt(REST_MV)
    expect(real).toBeGreaterThan(markAt(tugEnds().from))
    expect(real).toBeLessThan(markAt(tugEnds().to))
    expect(markAt(restingMvOf(REAL_WALL))).toBeCloseTo(real, 0)
  })

  it('moves the needle when the wall changes, and the right way', () => {
    expect(markAt(restingMvOf({ k: 4, cl: 0, na: 0 }))).toBeLessThan(markAt(restingMvOf(REAL_WALL)))
    expect(markAt(restingMvOf({ k: 1, cl: 0, na: 3 }))).toBeGreaterThan(markAt(restingMvOf(REAL_WALL)))
  })

  it('asks the drawing where things are, so a finger and the picture agree', () => {
    // The hit tests are the drawing's own, not a second copy of the layout —
    // two private copies of a position is how a control drifts off its target.
    // A tray chip answers where it is drawn, and nowhere near the top.
    for (const chip of TRAY) {
      expect(chipAt(chip.x, TRAY_Y)).toBe(chip.kind)
      expect(chipAt(chip.x, 10)).toBeNull()
    }
    // A door in the wall can be picked up where it is drawn, and each hit is
    // the door that is actually there.
    const wall = { k: 2, cl: 0, na: 1 }
    for (const [i, d] of doorsAt(wall).entries()) {
      expect(doorAt(wall, d.x, wallCentre())).toBe(i)
    }
    // And a gap between two doors picks up neither.
    const [a, b] = doorsAt(wall)
    expect(doorAt(wall, (a.x + b.x) / 2, wallCentre())).toBeNull()
  })

  it('only plugs a door in when it is dropped ON the wall', () => {
    expect(overWall(wallCentre())).toBe(true)
    expect(overWall(0)).toBe(false)
    expect(overWall(RS_H)).toBe(false)
  })

  it('names the two sides where a finger can reach them', () => {
    const labels = restingLabels()
    expect(labels.length).toBeGreaterThan(0)
    for (const l of labels) {
      expect(spokenTermAt(labels, l.x + l.w / 2, l.y + l.h / 2)).toBeTruthy()
      expect(l.x).toBeGreaterThanOrEqual(0)
      expect(l.y).toBeGreaterThanOrEqual(0)
      expect(l.y + l.h).toBeLessThanOrEqual(RS_H)
    }
  })

  it('redraws identically for the same wall and clock', () => {
    // A pure function of (state, clock) — nothing accumulating between frames.
    const a = strictCanvas()
    const b = strictCanvas()
    drawResting(a.ctx, REAL_WALL, -72, 900, null)
    drawResting(b.ctx, REAL_WALL, -72, 900, null)
    expect(a.points).toEqual(b.points)
  })
})

/** The middle of the wall — found by asking `overWall` where its band is, so
 *  the test cannot hold a private copy of a layout number that later moves. */
function wallCentre(): number {
  const ys: number[] = []
  for (let y = 0; y <= RS_H; y += 1) if (overWall(y)) ys.push(y)
  if (ys.length === 0) throw new Error('no wall found')
  return (ys[0] + ys[ys.length - 1]) / 2
}

describe('the controls sit where a finger expects them', () => {
  it('centres the trays on the canvas', () => {
    // ⚠ They used to start at a fixed left margin with a sentence of
    // instructions filling the space beside them; with the sentence gone that
    // left the row hanging off one side (user, 2026-08-30).
    const xs = TRAY.map((t) => t.x)
    const middle = (Math.min(...xs) + Math.max(...xs)) / 2
    expect(middle).toBeCloseTo(RS_W / 2, 6)
    for (const x of xs) {
      expect(x).toBeGreaterThan(0)
      expect(x).toBeLessThan(RS_W)
    }
  })

  it('puts the reset on the canvas, and not on top of anything else', () => {
    // ⚠ It is the APP'S reset now, in the corner every canvas reset lives in
    // (user, 2026-08-30) — not a private box in this bench's own corner.
    const mid = { x: RESET_BOX.x + RESET_BOX.w / 2, y: RESET_BOX.y + RESET_BOX.h / 2 }
    expect(resetBoxAt(mid.x, mid.y)).toBe(true)
    // ...and nowhere near the reading's speaker, the trays, or the wall.
    expect(resetBoxAt(RS_W / 2, mid.y)).toBe(false)
    expect(labelSpeakerAt(mid.x, mid.y)).toBe(false)
    for (const t of TRAY) expect(resetBoxAt(t.x, TRAY_Y)).toBe(false)
    expect(chipAt(mid.x, mid.y)).toBeNull()
  })

  it('fills the drawer, with nothing under it to leave room for', () => {
    // ⚠ The canvas stretches to the bottom of the page (user, 2026-08-30);
    // everything that used to sit in a row beneath it is on the picture now.
    expect(RS_H).toBeGreaterThan(600)
  })

  it('perches each door on its tray\'s rim, not inside it', () => {
    // ⚠ "Overlapping with the top border of the bucket… as if it would be
    // sitting slightly on the top of it" (user, 2026-08-30). The bucket reads
    // as holding a supply, with the next one ready to be picked off the top.
    const c = strictCanvas()
    drawResting(c.ctx, REAL_WALL, restingMvOf(REAL_WALL), 1200, null)
    const rim = TRAY_Y - TRAY_H / 2
    for (const t of TRAY) {
      // ⚠ WINDOWED IN Y as well as X. A first version filtered on x alone and
      // caught the membrane's own lipids, which run the whole width of the
      // canvas — so it measured from the wall down and passed whatever the
      // tray did.
      const near = c.points.filter(
        (p) => Math.abs(p.x - t.x) < TRAY_W / 2 - 2 && Math.abs(p.y - TRAY_Y) < 60,
      )
      const top = Math.min(...near.map((p) => p.y))
      // The door's highest ink is ABOVE the rim: it is sitting on the bucket,
      // not in it.
      expect(top).toBeLessThan(rim)
      // And not floating clear of it either — it still overlaps.
      expect(top).toBeGreaterThan(rim - TRAY_H)
    }
  })

  it('centres each tray\'s spoken name under the tray itself', () => {
    // ⚠ A spoken label's ink runs from 18 px LEFT of its anchor — the speaker
    // glyph — to the end of the word, so anchoring at the tray's centre put
    // the pair noticeably right of it (user: "align each bucket with the
    // voicing button vertically").
    const named = restingLabels().filter((l) => ['potassium', 'chloride', 'sodium'].includes(l.term))
    expect(named.length).toBe(TRAY.length)
    for (const l of named) {
      const middle = l.x + l.w / 2
      const tray = TRAY.map((t) => t.x).sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))[0]
      expect(Math.abs(middle - tray)).toBeLessThan(6)
    }
  })

  it('draws no share bar at all', () => {
    // ⚠ REMOVED COMPLETELY (user, 2026-08-30: "it's clear from the picture how
    // many of which channels are present. We don't need a duplication"). The
    // doors in the wall ARE each ion's weight in the equation, in the same
    // colours — a bar of the same lengths beside them was the canvas repeating
    // itself.
    const c = strictCanvas()
    drawResting(c.ctx, { k: 3, cl: 1, na: 2 }, restingMvOf(REAL_WALL), 1200, null)
    const written = c.texts.join(' | ')
    expect(written).not.toMatch(/who gets a say/i)
    expect(written).not.toMatch(/paler/i)
    expect(written).not.toMatch(/%/)
  })

  it('writes no instructions and no percentages on the canvas', () => {
    // ⚠ The canvas carries names and readings on a scale, and nothing else
    // (user, 2026-08-30: "remove 'drag a door…', remove percentage
    // indicator"). The bar's LENGTH is the weight in the equation — a number
    // printed on it says the same thing again in a form needing arithmetic.
    const c = strictCanvas()
    drawResting(c.ctx, REAL_WALL, restingMvOf(REAL_WALL), 1200, null)
    const written = c.texts.join(' | ')
    expect(written).not.toMatch(/drag/i)
    expect(written).not.toMatch(/%/)
  })
})
