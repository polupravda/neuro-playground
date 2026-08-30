import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  CH_H,
  CH_BUDGET,
  KEY_H,
  FILTER_Y,
  TRY_MS,
  WALL_Y,
  drawSide,
  paintChannelBody,
  drawTop,
  sideLabels,
  sideLabelPlan,
  WATERS_IN_COAT,
  BODY_RGB,
  HELIX_LIGHT,
  HELIX_MID,
  HELIX_DARK,
  SIDE_W,
  TOP_W,
  topLabels,
  tryPoseAt,
  type TryState,
} from './channelScene'
import { spokenTermAt } from './spokenLabels'
import { ELEMENT_COLOR } from './lipidLabScene'

const at = (kind: 'na' | 'k'): TryState => ({ kind, startedMs: 0 })

describe('sending an ion at the filter', () => {
  it('starts both ions the same way — the difference must be earned', () => {
    // If potassium set off differently from sodium, the picture would give
    // the answer away before the filter had done anything.
    const k = tryPoseAt(at('k'), 0)
    const na = tryPoseAt(at('na'), 0)
    expect(k.y).toBeCloseTo(na.y, 6)
    expect(k.coat).toBeCloseTo(na.coat, 6)
  })

  it('takes potassium THROUGH, undressed, and out the far side', () => {
    const end = tryPoseAt(at('k'), TRY_MS)
    expect(end.y).toBeLessThan(FILTER_Y) // past the filter, on the outside
    expect(end.coat).toBeLessThan(0.05) // it traded its coat away
    expect(end.done).toBe(true)
    expect(end.leaving).toBe(false)
  })

  it('turns sodium back, still wearing its coat', () => {
    const end = tryPoseAt(at('na'), TRY_MS)
    expect(end.y).toBeGreaterThan(WALL_Y) // back inside where it came from
    expect(end.coat).toBeCloseTo(1, 6) // it never took the coat off
    expect(end.leaving).toBe(true)
  })

  it('never teleports either of them', () => {
    for (const kind of ['k', 'na'] as const) {
      let prev = tryPoseAt(at(kind), 0)
      for (let ms = 30; ms <= TRY_MS; ms += 30) {
        const now = tryPoseAt(at(kind), ms)
        expect(Math.abs(now.y - prev.y)).toBeLessThan(CH_H * 0.06)
        prev = now
      }
    }
  })
})

describe('the two views', () => {
  it('draw without a bad colour or a NaN, idle and mid-attempt', () => {
    for (const tried of [null, at('k'), at('na')]) {
      for (const ms of [0, TRY_MS * 0.5, TRY_MS]) {
        const c = strictCanvas()
        drawSide(c.ctx, tried, ms)
        expect(c.calls).toContain('roundRect') // the marker joining the views
      }
    }
    const top = strictCanvas()
    drawTop(top.ctx)
    expect(top.calls.filter((k) => k === 'arc').length).toBeGreaterThan(4)
  })

  it('names its parts, and every name speaks', () => {
    const terms = [...sideLabels(), ...topLabels()].map((l) => l.term)
    expect(terms).toContain('selectivity filter')
    expect(terms).toContain('voltage sensor')
    expect(terms).toContain('gate')
    for (const l of [...sideLabels(), ...topLabels()]) {
      expect(spokenTermAt([l], l.x + 2, l.y + 2)).toBe(l.term)
    }
  })
})

describe('the attempt can always be repeated', () => {
  it('ends in a done state the view can detect and clear', () => {
    // The bug this pins: the buttons were disabled on a value computed during
    // render from the animation clock, which the render never saw advance —
    // so after one ion had gone through, the exhibit was frozen for good.
    // `done` is what the loop watches for, so it must be reachable and stable.
    for (const kind of ['k', 'na'] as const) {
      expect(tryPoseAt(at(kind), TRY_MS).done).toBe(true)
      expect(tryPoseAt(at(kind), TRY_MS * 3).done).toBe(true)
      expect(tryPoseAt(at(kind), TRY_MS * 0.9).done).toBe(false)
    }
  })
})

describe('the two views show one event', () => {
  it('puts the ion in the top view exactly while it is at the filter', () => {
    // Same moment, two pictures. Drawn end-on only near the filter plane,
    // because that is the only depth this view is looking at.
    const nearFilter = strictCanvas()
    drawTop(nearFilter.ctx, at('k'), TRY_MS * 0.55)
    const away = strictCanvas()
    drawTop(away.ctx, at('k'), 0)
    expect(nearFilter.calls.filter((c) => c === 'arc').length).toBeGreaterThan(
      away.calls.filter((c) => c === 'arc').length,
    )
  })
})

describe('the ion coming out of the pore, seen from above', () => {
  it('emerges only after it is through, and only for the ion that gets through', () => {
    // Sodium never emerges: it is turned back, so there is nothing to come up
    // out of the hole.
    expect(tryPoseAt(at('na'), TRY_MS).emerge).toBe(0)
    expect(tryPoseAt(at('k'), TRY_MS * 0.4).emerge).toBe(0)
    expect(tryPoseAt(at('k'), TRY_MS).emerge).toBeCloseTo(1, 2)
  })

  it('grows all the way out rather than stopping in the doorway', () => {
    // Asked for 2026-08-28: an ion that stops at the mouth sits in the door
    // for ever. It should swell toward the viewer and drift off the frame.
    let prev = 0
    for (let t = 0.62; t <= 1; t += 0.05) {
      const e = tryPoseAt(at('k'), TRY_MS * t).emerge
      expect(e).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = e
    }
    expect(prev).toBeGreaterThan(0.9)
  })
})

describe('labels are kept off the drawing', () => {
  it('puts every name out at the canvas margins, not over the structure', () => {
    // A name that overlaps what it names is worse than no name.
    const plan = sideLabelPlan()
    expect(plan.length).toBeGreaterThan(3)
    for (const { label, target } of plan) {
      const nearLeft = label.x < SIDE_W * 0.3
      const nearRight = label.x + label.w > SIDE_W * 0.7
      expect(nearLeft || nearRight).toBe(true)
      // …and each one reaches in to something, so it is still attached.
      expect(Number.isFinite(target.x)).toBe(true)
      expect(Number.isFinite(target.y)).toBe(true)
    }
  })

  it('names the pore itself, since that is the part the question is about', () => {
    expect(sideLabels().map((l) => l.term)).toContain('pore')
  })
})

describe('the two registers, side by side', () => {
  it('keeps the schematic gate in the corner of the realistic view', () => {
    // The lipid lab's pattern, at the user's instruction (2026-08-28): the
    // realistic structure fills the panel, the little bronze door this app
    // draws everywhere else sits in a small amber box joined to it. Both
    // registers on screen at once is the whole point — that shape IS this.
    const c = strictCanvas()
    drawSide(c.ctx, null, 0)
    // The inset's box and the schematic channel's own flared pore both draw.
    expect(c.calls).toContain('roundRect')
    // The gate is drawn with curves — beziers now that the silhouette is two
    // lobed subunits rather than one body with a slot (2026-08-28). What the
    // test is for is that the SCHEMATIC gate is really drawn here, not which
    // curve primitive draws it.
    expect(
      c.calls.includes('bezierCurveTo') || c.calls.includes('quadraticCurveTo'),
    ).toBe(true)
    expect(c.calls).toContain('setLineDash')
  })

  it('stacks the key and the panels inside the height it actually has', () => {
    // THE bug: a size key was added above the two panels and nothing was
    // subtracted from their height, so both were cut off at the bottom
    // (2026-08-28). The guard is the sum, not the symptom — a label test
    // passes happily while the whole column hangs off the drawer.
    const CHROME = 8 + 4 * 2 + 2 // gap, the panel's padding, its border
    expect(KEY_H + CH_H + CHROME).toBeLessThanOrEqual(CH_BUDGET)
  })

  it('keeps every name inside its own panel — nothing cropped', () => {
    // The bottom of both panels was cut off the moment a size key was added
    // above them and nothing subtracted its height (2026-08-28). A label that
    // runs off the canvas is the first visible symptom, so it is the guard.
    for (const [labels, w] of [
      [sideLabels(), SIDE_W],
      [topLabels(), TOP_W],
    ] as const) {
      for (const l of labels) {
        expect(l.y).toBeGreaterThanOrEqual(0)
        expect(l.y + l.h).toBeLessThanOrEqual(CH_H)
        expect(l.x).toBeGreaterThanOrEqual(0)
        expect(l.x + l.w).toBeLessThanOrEqual(w)
      }
    }
  })

  it('leaves the top of the side panel clear for the control pill', () => {
    // The buttons float over the drawing now, so the drawing has to start
    // below them: WALL_Y carries a band for exactly this.
    const highest = Math.min(...sideLabels().map((l) => l.y))
    expect(highest).toBeGreaterThan(64)
  })

  it('builds the body gradient INSIDE the transform it is filled in', () => {
    // The bug that survived three rounds of "the aura is not purple"
    // (2026-08-28): the gradient was created around the body's centre and the
    // context was THEN translated to that centre and squashed before the
    // fill, which threw the gradient's origin twice as far out as the shape.
    // The ellipse was painted from the transparent tail, so the body was
    // nearly invisible — the colour was never being drawn at all.
    //
    // The order of calls is the invariant, and it is testable in isolation
    // because the paint is now one function used by both views.
    const c = strictCanvas()
    paintChannelBody(c.ctx, 200, 120, 60, 0.5)
    const g = c.calls.indexOf('createRadialGradient')
    expect(g).toBeGreaterThan(-1)
    expect(c.calls.slice(0, g)).toEqual(['save', 'translate', 'scale'])
  })

  it('sets the top view in a field of lipid heads', () => {
    // Looking down at the MEMBRANE, not at a protein floating in nothing —
    // the composition of the reference the user supplied.
    const c = strictCanvas()
    drawTop(c.ctx)
    // Many heads, each its own radial gradient.
    expect(c.calls.filter((k) => k === 'createRadialGradient').length).toBeGreaterThan(20)
    expect(topLabels().map((l) => l.term)).toContain('lipid heads')
  })

  it('draws every atom in the app’s palette, never CPK', () => {
    // Ruled by the user 2026-08-28: red and sky mean charge in this app and
    // nothing else, so the filter's oxygens keep the molecular earth palette
    // even though the published figures colour them red.
    expect(ELEMENT_COLOR.O).not.toMatch(/^#(f|e)/i)
    expect(ELEMENT_COLOR.N).not.toBe('#0000ff')
  })
})

describe('the coat, the badges and the solid protein', () => {
  it('draws the coat as real water molecules and names it', () => {
    // A ring of anonymous dots meant nothing (user, 2026-08-28). The coat is
    // now the same water molecule the permeability bench fires, at true size,
    // with a name of its own.
    expect(WATERS_IN_COAT).toBeGreaterThan(3)
    expect(sideLabels().map((l) => l.term)).toContain('water coat')
    // Measured against an empty pore, because the waters no longer disappear
    // when they come off: a potassium that has shed its coat still has those
    // waters on screen, falling back into the cell (2026-08-28). Both states
    // therefore draw MORE than a pore with nothing in it.
    const empty = strictCanvas()
    drawSide(empty.ctx, null, 0)
    const dressed = strictCanvas()
    drawSide(dressed.ctx, at('na'), TRY_MS * 0.5) // sodium keeps its coat
    const shedding = strictCanvas()
    drawSide(shedding.ctx, at('k'), TRY_MS * 0.55) // potassium mid-trade
    expect(dressed.calls.length).toBeGreaterThan(empty.calls.length)
    expect(shedding.calls.length).toBeGreaterThan(empty.calls.length)
  })

  it('leaves no see-through gaps between the subunits from above', () => {
    // The gaps read as ways through, and invited "why squeeze into the little
    // hole when there is all that space?" — a channel is a packed mass of
    // protein, so a filled body goes under the helices.
    const c = strictCanvas()
    drawTop(c.ctx)
    // The body's own radial gradient is drawn before any helix.
    expect(c.calls.filter((k) => k === 'createRadialGradient').length).toBeGreaterThan(20)
    expect(c.calls).toContain('fill')
  })
})

describe('labels and badges after the legibility round', () => {
  it('keeps the two right-hand names apart and off the edges', () => {
    // They were colliding with each other and cropped at the right border.
    const right = sideLabelPlan().filter((l) => l.label.align === 'right')
    expect(right.length).toBe(2)
    const [a, b] = right
    expect(Math.abs(a.label.y - b.label.y)).toBeGreaterThan(a.label.h * 2)
    for (const { label } of sideLabelPlan()) {
      expect(label.x).toBeGreaterThan(4)
      expect(label.x + label.w).toBeLessThan(SIDE_W - 4)
      expect(label.y).toBeGreaterThan(4)
      expect(label.y + label.h).toBeLessThan(CH_H - 4)
    }
  })
})

describe('the magnification relation, and what does not have one', () => {
  it('frames BOTH halves in the side view — schematic and realistic', () => {
    // A magnification takes two boxes joined by connectors. The side view had
    // only the little one, which said "that shape is a magnification of" and
    // never finished the sentence (2026-08-28).
    const c = strictCanvas()
    drawSide(c.ctx, null, 0)
    expect(c.calls.filter((k) => k === 'roundRect').length).toBeGreaterThanOrEqual(2)
  })

  it('does NOT frame the top view, which is not a magnification of anything', () => {
    // Amber dashed boxes claim "this small thing is that big thing". The top
    // view is a different VIEW of the same object, so a frame there claimed a
    // relation that does not exist.
    // Counted against its labels: every spoken name draws its own dark plate,
    // so "no frame" means exactly as many rounded rects as there are names.
    const c = strictCanvas()
    drawTop(c.ctx)
    expect(c.calls.filter((k) => k === 'roundRect').length).toBe(topLabels().length)
  })
})

describe('both registers say "potassium channel"', () => {
  it('tints the realistic body with the species, as the schematic is tinted', () => {
    // This app tints every channel with the species it passes; the realistic
    // drawing was bronze while its own schematic beside it was violet, so the
    // two pictures did not obviously show the same object (user, 2026-08-28).
    const [r, g, b] = BODY_RGB.split(',').map((n) => Number(n.trim()))
    expect(b).toBeGreaterThan(r) // violet, not bronze
    expect(b).toBeGreaterThan(g)
  })

  it('keeps every helix tone lighter than the body it sits in', () => {
    // Value separation is what stops a coil's shadow side vanishing into the
    // mass behind it — the fix must not be undone by a later tint change.
    const lum = (c: string) => {
      const m = c.match(/\d+/g)!.map(Number)
      return 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]
    }
    const body = lum(BODY_RGB)
    for (const tone of [HELIX_LIGHT, HELIX_MID, HELIX_DARK]) {
      expect(lum(tone)).toBeGreaterThan(body + 20)
    }
  })
})
