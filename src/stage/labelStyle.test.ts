import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  CONNECTOR_INK,
  LABEL_INK,
  LABEL_PLATE,
  LABEL_PX,
  drawConnector,
  drawName,
  drawSpoken,
  labelFont,
  named,
  spoken,
  spokenTermAt,
} from './spokenLabels'
import { LABELS, ZOOM_TARGETS, sceneTermSpeaks } from './layout'
import { sceneSpokenTermAt } from './drawScene'
import { drawCapacitor } from './capacitorScene'
import { drawPatch } from './patchScene'

// A5 (user, 2026-09-04): "unify labels across the app. Source of truth:
// vesicle view." These guard the DECISION — one plate, one font, one ink, one
// leader idiom — rather than counting marks on a canvas.

describe('the app has ONE label style', () => {
  it('A5: a spoken name and a silent name are the same plate, font and ink', () => {
    const a = strictCanvas()
    drawSpoken(a.ctx, spoken('vesicle', 100, 100))
    const b = strictCanvas()
    drawName(b.ctx, named('vesicle', 100, 100))

    for (const c of [a, b]) {
      expect(c.styles).toContain(LABEL_PLATE)
      expect(c.styles).toContain(LABEL_INK)
      expect(c.calls).toContain('roundRect')
      expect(c.texts).toEqual(['vesicle'])
    }
    // The ONLY difference is the F04 glyph — voice is per term, so a name
    // that has not been given a voice must still look like every other name.
    expect(a.calls).toContain('arc')
    expect(b.calls).not.toContain('arc')
  })

  it('A5: the plate is never outlined — a name is not a button', () => {
    const c = strictCanvas()
    drawName(c.ctx, named('cleft', 40, 40))
    // The plate is filled and never stroked: a rim makes the word read as a
    // control, and the speaker glyph beside it is the control.
    expect(c.calls.filter((k) => k === 'stroke')).toEqual([])
  })

  it('A5: the font is the app’s one label font, at the app’s one size', () => {
    expect(labelFont()).toBe(`${LABEL_PX}px system-ui, sans-serif`)
    expect(labelFont(13)).toBe('13px system-ui, sans-serif')
  })

  it('A5: a silent name is not padded for a speaker glyph it does not have', () => {
    // `spoken()` reserves 18 px in front of the word for the glyph. A name
    // with no glyph must not inherit that, or it sits off-centre on its plate.
    const s = spoken('gate', 100, 100)
    const n = named('gate', 100, 100)
    expect(s.x).toBeLessThan(n.x)
    expect(s.w).toBeGreaterThan(n.w)
    // Both are still comfortably tappable where the word is.
    expect(spokenTermAt([n], 102, 96)).toBe('gate')
  })
})

describe('one leader idiom', () => {
  it('A5: a leader runs from the label’s BOX CENTRE to the thing it names', () => {
    const c = strictCanvas()
    const l = { x: 10, y: 20, w: 40, h: 30 }
    drawConnector(c.ctx, l, { x: 200, y: 300 })
    expect(c.styles).toContain(CONNECTOR_INK)
    // Box centre, not the ink's edge — views used to start it at the edge,
    // which reads as a different gesture on the same canvas.
    expect(c.points[0]).toEqual({ x: 30, y: 35 })
    expect(c.points[1]).toEqual({ x: 200, y: 300 })
  })
})

describe('the 🏷 switch hides NAMES and never readings', () => {
  // A graph without its axis is not a simpler graph: a reading on a scale is
  // not a name, and the switch must leave it alone.
  it('A5: the capacitor keeps its magnification and its counts with labels off', () => {
    const on = strictCanvas()
    drawCapacitor(on.ctx, -70, 0, true)
    const off = strictCanvas()
    drawCapacitor(off.ctx, -70, 0, false)

    const readings = (t: string[]) => t.filter((s) => s.startsWith('×'))
    expect(readings(on.texts).length).toBeGreaterThan(0)
    expect(readings(off.texts)).toEqual(readings(on.texts))
    // …but the names are gone.
    expect(off.texts.length).toBeLessThan(on.texts.length)
  })

  it('A5: the patch clamp keeps its axis ticks with labels off', () => {
    const on = strictCanvas()
    drawPatch(on.ctx, -70, 0, true)
    const off = strictCanvas()
    drawPatch(off.ctx, -70, 0, false)
    const ticks = (t: string[]) => t.filter((s) => s.includes('mV') || s.includes('ms'))
    expect(ticks(on.texts).length).toBeGreaterThan(0)
    expect(ticks(off.texts)).toEqual(ticks(on.texts))
    expect(off.texts.length).toBeLessThan(on.texts.length)
  })
})

describe('voice on the scene’s part names (2026-09-04)', () => {
  // A2: "add voice on the labels, which name neuron parts (not navigation)."
  it('A2: every name that names a PART of the cell speaks', () => {
    // The four the whole-neuron scene carries. Voice is per term, on request,
    // so this list is the request — not "every label on the canvas".
    expect(LABELS.map((l) => l.text).sort()).toEqual(
      ['axon', 'axon terminals', 'dendrites', 'soma'].sort(),
    )
    for (const l of LABELS) {
      expect(['dendrites', 'soma', 'axon', 'terminals']).toContain(l.part)
    }
  })

  it('A2: every part name passes the one predicate the scene asks', () => {
    for (const l of LABELS) expect(sceneTermSpeaks(l.text)).toBe(true)
  })

  it('A2: navigation does NOT speak — a marker names a door, not a part', () => {
    // A zoom target's label is the name of somewhere to go. Giving it a
    // speaker would teach that "Passive spread" is a part of a neuron. Both
    // producers ask THIS, so a marker cannot acquire a voice by accident.
    for (const t of ZOOM_TARGETS) expect(sceneTermSpeaks(t.label)).toBe(false)
    const navNames = ZOOM_TARGETS.map((t) => t.label)
    for (const l of LABELS) expect(navNames).not.toContain(l.text)
  })

  it('A2: nothing is spoken where nothing was drawn', () => {
    // The stage hit-tests the frame's own record, so before a frame exists
    // there is no target to hit — and a stray tap says nothing.
    expect(sceneSpokenTermAt(0, 0)).toBeNull()
    expect(sceneSpokenTermAt(-999, -999)).toBeNull()
  })
})
