import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  CONTROL_ROW,
  LEAK_REACH,
  LK_H,
  RULER_Y,
  rulerTicks,
  LK_W,
  SPAN_UM,
  doorsAt,
  drawLeaky,
  lanes,
  leakyLabels,
  nodePlaces,
  sleeveSpans,
  xOnLane,
} from './leakyScene'
import {
  BARE_WALL,
  WRAPPED_WALL,
  holeExposed,
  lambdaUm,
  sparkAt,
  survivesAt,
} from '../core/leaky'
import {
  DOOR_HALF_HEIGHT,
  OUTSIDE_H,
  SHEATH_GAP,
  ribbonGeometry,
  wallY,
} from './axonRibbon'
import { AXON_VIEW_SCALE, AXON_W } from './layout'
import { spokenTermAt } from './spokenLabels'

const SOURCES = import.meta.glob('./*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// ACTION LIST 2026-08-30:
//   A1 — "make signals race. The signal moves across the pipe and sparkle
//        'leaks' through the holes."
//   A2 — "there's no situation when K⁺ channels are absent… I would rather let
//        them race, with no option of adding channels."

describe('D05 draws its own answer', () => {
  it('draws before a race, during one and at the end without complaint', () => {
    for (const u of [null, 0, 0.4, 1]) {
      const c = strictCanvas()
      drawLeaky(c.ctx, u, 1200)
      expect(c.calls.length).toBeGreaterThan(40)
    }
  })

  it('A2: shows the same holes on BOTH pipes, always', () => {
    // ⚠ There is no state with no holes. A wall with none drawn still had a
    // perfectly leaky membrane underneath, so the picture was offering
    // something neither the model nor a cell has.
    expect(doorsAt().length).toBeGreaterThan(4)
    for (const lane of lanes()) {
      for (const place of doorsAt()) {
        const x = xOnLane(lane.geo, place * SPAN_UM)
        expect(x).toBeGreaterThan(0)
        expect(x).toBeLessThan(LK_W)
      }
    }
  })

  it('A2: makes every node one of the holes, so a gap cannot miss one', () => {
    // ⚠ THE STRUCTURAL FIX, and the one that actually prevents the bug. While
    // `holeExposed` asked "is this hole NEAR a node", the answer depended on a
    // tolerance that had drifted three and a half times wider than the gap the
    // sheath draws. Deriving the nodes FROM the holes removes the question:
    // a gap is cut around a hole, so it cannot be cut anywhere else.
    const holes = doorsAt()
    for (const node of nodePlaces()) {
      expect(holes).toContain(node)
    }
    expect(nodePlaces().length).toBeGreaterThan(1)
    expect(nodePlaces().length).toBeLessThan(holes.length)
  })

  it('A2: puts every bare hole INSIDE a sleeve gap, not merely near one', () => {
    // ⚠ THE BUG THIS REPLACES (user, 2026-08-31: "channels on the myelinated
    // axon are misplaced: they are at myelin, not at the nodes of Ranvier").
    //
    // `holeExposed` asked whether a hole was WITHIN a tolerance of a node, and
    // the tolerance was 0.056 of the fibre while the drawn gap is 0.0156 —
    // three and a half times too generous. Four holes counted as exposed and,
    // measured, NOT ONE was inside a gap: every one was drawn on a sleeve.
    //
    // Measured against the gap the sheath actually cuts, so a tolerance can
    // never drift away from the drawing again.
    const geo = lanes()[1].geo
    const gapFrac = SHEATH_GAP / (geo.right - geo.left)
    for (const place of doorsAt()) {
      if (!holeExposed(WRAPPED_WALL, place)) continue
      const nearest = Math.min(...nodePlaces().map((n) => Math.abs(n - place)))
      expect(nearest).toBeLessThan(gapFrac / 2)
    }
  })


  it('A2: covers most holes on the wrapped pipe and leaves the nodes bare', () => {
    const exposed = doorsAt().filter((p) => holeExposed(WRAPPED_WALL, p))
    const covered = doorsAt().filter((p) => !holeExposed(WRAPPED_WALL, p))
    expect(exposed.length).toBeGreaterThan(0)
    expect(covered.length).toBeGreaterThan(exposed.length)
    // And nothing is covered on the bare one.
    expect(doorsAt().every((p) => holeExposed(BARE_WALL, p))).toBe(true)
  })

  it('A1: draws more once a race is running than before one', () => {
    // The sparks and the pulse are the difference; before a race the pipes are
    // quiet.
    const idle = strictCanvas()
    drawLeaky(idle.ctx, null, 1200)
    const racing = strictCanvas()
    drawLeaky(racing.ctx, 0.6, 1200)
    expect(racing.calls.length).toBeGreaterThan(idle.calls.length)
  })

  it('keeps λ ON the picture for both pipes', () => {
    for (const lane of lanes()) {
      expect(lambdaUm(lane.wall)).toBeLessThan(SPAN_UM)
      const x = xOnLane(lane.geo, lambdaUm(lane.wall))
      expect(x).toBeGreaterThan(0)
      expect(x).toBeLessThan(LK_W)
    }
  })

  it('shows BOTH pipes at once — bare above, wrapped below', () => {
    const [bare, wrapped] = lanes()
    expect(bare.wall.myelin).toBe(false)
    expect(wrapped.wall.myelin).toBe(true)
    expect(bare.geo.tubeMid).toBeLessThan(wrapped.geo.tubeMid)
    expect(lambdaUm(wrapped.wall)).toBeGreaterThan(lambdaUm(bare.wall))
  })

  it('draws the axon views\' OWN pipe, not a second one', () => {
    // A wobbling outline is many small segments, two rounded ends and a clip;
    // a schematic tube is four corners.
    const c = strictCanvas()
    drawLeaky(c.ctx, null, 1200)
    expect(c.calls.filter((k) => k === 'lineTo').length).toBeGreaterThan(60)
    expect(c.calls.filter((k) => k === 'quadraticCurveTo').length).toBeGreaterThan(2)
    expect(c.calls).toContain('clip')
  })

  it('A3: takes the door size from the axon views rather than keeping its own', () => {
    const src = SOURCES['./leakyScene.ts']
    expect(src).toBeTruthy()
    expect(src).toMatch(/DOOR_HALF_HEIGHT/)
    expect(src).not.toMatch(/const DOOR_HALF_HEIGHT\s*=/)
    expect(DOOR_HALF_HEIGHT).toBeGreaterThan(0)
  })

  it('sits its holes ON the wobbling wall', () => {
    const c = strictCanvas()
    drawLeaky(c.ctx, null, 1200)
    const lane = lanes()[0]
    const x = xOnLane(lane.geo, doorsAt()[0] * SPAN_UM)
    const near = c.points.filter((p) => Math.abs(p.x - x) < DOOR_HALF_HEIGHT * 3)
    const onWall = near.filter(
      (p) =>
        Math.min(
          Math.abs(p.y - wallY(lane.geo, p.x, -1)),
          Math.abs(p.y - wallY(lane.geo, p.x, 1)),
        ) < DOOR_HALF_HEIGHT * 2.4,
    )
    expect(onWall.length).toBeGreaterThan(0)
  })

  it('A1: leaves every pipe room for its escaping charge, top and bottom', () => {
    // ⚠ "Give bigger margin on top and bottom of both axons" (user,
    // 2026-08-31). MEASURED against the flash rather than a chosen number: a
    // burst reaches FLASH_REACH at full brightness, and a pipe with less room
    // than that has its own light clipped.
    const [bare, wrapped] = lanes()
    // ⚠ Below the control pill, not merely inside the canvas: the buttons float
    // over the top of the stage now (user, 2026-08-31: "buttons should be
    // placed on the canvas"), and a pipe under them is a pipe you cannot see.
    expect(bare.geo.tubeMid - bare.geo.tubeHalf - CONTROL_ROW).toBeGreaterThanOrEqual(
      LEAK_REACH,
    )
    expect(LK_H - (wrapped.geo.tubeMid + wrapped.geo.tubeHalf)).toBeGreaterThanOrEqual(LEAK_REACH)
    // ⚠ AND THE GAP BETWEEN THEM, which is the one that actually clips. The
    // outer margins are satisfied by the canvas simply being tall — shrinking
    // the lane margin just moves the block's outer space around and this test
    // passed with the margin cut to 10. Two facing pipes need a flash's reach
    // EACH.
    const between =
      wrapped.geo.tubeMid - wrapped.geo.tubeHalf - (bare.geo.tubeMid + bare.geo.tubeHalf)
    expect(between).toBeGreaterThanOrEqual(LEAK_REACH * 2)
    // And the two pipes are symmetric about the middle OF WHAT IS THEIRS —
    // the stage less the control pill's row at the top and the ruler's floor at
    // the bottom (2026-08-31). The race's own layout builds lanes UP from its
    // ruler, which left 331 px above the top pipe against 121 below; centring
    // in the leftover is what fixes that.
    const above = bare.geo.tubeMid - bare.geo.tubeHalf - CONTROL_ROW
    const below = RULER_Y - 8 - (wrapped.geo.tubeMid + wrapped.geo.tubeHalf)
    expect(Math.abs(above - below)).toBeLessThan(2)
    // And nothing overlaps the ruler.
    expect(below).toBeGreaterThan(0)
  })

  it('A2: never wears the STATIONARY flash that means "rebuilt here"', () => {
    // ⚠ TWO CORRECTIONS, and they pull in opposite directions until you see
    // which part of the mark carried the wrong meaning.
    //
    // First (2026-08-31): "it displays a flash, which symbolizes signal across
    // the app, which is not what we try to describe." The offending thing was
    // the axon views' node burst — a bright mark SITTING on the wall — which
    // the race uses to say the signal has been REBUILT there.
    //
    // Then (also 2026-08-31): "a better relation visually between the signal
    // and the leaking signal… it's not clear why the signal is fading out
    // while ions are leaving." Drawn as purple potassium, the leak and the
    // signal were two unrelated pictures.
    //
    // What escapes IS the signal, so it leaves wearing the signal's light —
    // and what makes it unmistakable is that it MOVES AWAY. The forbidden
    // thing was never the colour; it was the stationary burst.
    const src = SOURCES['./leakyScene.ts']
    expect(src).not.toMatch(/drawFlash\(/)
    expect(src).toMatch(/flowAt\(/)
    // And the signal itself is the axon views' own, at their size.
    expect(src).toMatch(/signalAura\(/)
  })

  it('A2: sends the escaping charge AWAY from the wall', () => {
    // A burst sits still; a leak has to go somewhere. Measured on the ink the
    // race adds: it reaches outward, past the wall, into the bath.
    const idle = strictCanvas()
    drawLeaky(idle.ctx, null, 1200)
    const racing = strictCanvas()
    drawLeaky(racing.ctx, 0.3, 1200)
    const key = (p: { x: number; y: number }) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`
    const before = new Set(idle.points.map(key))
    const added = racing.points.filter((p) => !before.has(key(p)))
    expect(added.length).toBeGreaterThan(0)

    // Something the race added sits WELL outside a wall — an ion on its way
    // out, which a stationary burst would never produce.
    const lane = lanes()[0]
    const outward = added.filter((p) => {
      const d = Math.min(
        Math.abs(p.y - wallY(lane.geo, p.x, -1)),
        Math.abs(p.y - wallY(lane.geo, p.x, 1)),
      )
      return d > DOOR_HALF_HEIGHT * 3
    })
    expect(outward.length).toBeGreaterThan(0)
  })

  it('A2: keeps a flash visible all the way along the bare fibre', () => {
    // ⚠ It was multiplied by how much of the push survives, which is 1% by
    // mid-fibre — so every hole past the first was invisible. Stretched, and
    // declared. The ORDER must survive the stretch: each hole still dimmer
    // than the one before.
    const early = sparkAt(BARE_WALL, 0.1, 0.1)
    const mid = sparkAt(BARE_WALL, 0.5, 0.5)
    const late = sparkAt(BARE_WALL, 0.9, 0.9)
    expect(early).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(late)
    // And the middle of the fibre is still worth looking at.
    expect(mid).toBeGreaterThan(0.1)
  })

  it('A1: ties the leak to the signal — same light, and the blob shrinks', () => {
    // ⚠ THE RELATION IS THE LESSON (user, 2026-08-31: "for a kid, it's not
    // clear why the signal is fading out while ions are leaving the cell").
    //
    // Two things have to be one fact: how bright the travelling signal is, and
    // how hard the holes behind it are leaking. Both read off `survivesAt`, so
    // a hole cannot leak hard where the signal is already faint, and the signal
    // cannot stay bright where it has been leaking.
    const early = survivesAt(BARE_WALL, 0.15 * SPAN_UM)
    const late = survivesAt(BARE_WALL, 0.85 * SPAN_UM)
    expect(early).toBeGreaterThan(late)
    // The leak follows it, in the same order.
    expect(sparkAt(BARE_WALL, 0.15, 0.15)).toBeGreaterThan(sparkAt(BARE_WALL, 0.85, 0.85))
    // And the wrapped pipe keeps BOTH up: a bright signal all the way, and
    // nodes that are still leaking when the bare pipe has nothing left.
    expect(survivesAt(WRAPPED_WALL, 0.85 * SPAN_UM)).toBeGreaterThan(early)
  })

  it('A1: draws the signal at the size the axon views draw one', () => {
    // "We display a very bright signal, as you see it in 'Axonal conduction
    // and myelin'." This bench had its own, at less than half the radius — a
    // dimmer thing wearing the same colour, which is how a visual language
    // stops being one.
    const src = SOURCES['./leakyScene.ts']
    expect(src).toMatch(/signalAura\(ctx, geo/)
  })

  it('A1: shows no standing light anywhere while nothing is running', () => {
    // ⚠ Each pipe wore a pulsing glow at its left end whether or not a signal
    // was on its way (user, 2026-08-31: "at the start, there are static yellow
    // lights. Remove them") — and this app has just settled that a bright
    // thing SITTING STILL means "the signal is here", which at an idle inlet
    // is untrue.
    //
    // Measured as glows, since that is what a light IS here: `softGlow` builds
    // a radial gradient, and at rest there should not be one on the canvas.
    const idle = strictCanvas()
    drawLeaky(idle.ctx, null, 1200)
    expect(idle.calls.filter((c) => c === 'createRadialGradient')).toHaveLength(0)
    // And a running one certainly has some, or this passes for the wrong
    // reason.
    const racing = strictCanvas()
    drawLeaky(racing.ctx, 0.3, 1200)
    expect(racing.calls.filter((c) => c === 'createRadialGradient').length).toBeGreaterThan(0)
  })

  it('A2: lays the holes down BEFORE the sleeves, so a sleeve covers them', () => {
    // ⚠ "On myelinated axons, there are ghost channels 'under' myelin layers"
    // (user, 2026-08-31). They were not under anything: they were drawn AFTER
    // the sheath at 28% opacity, painted on top of the myelin — which is
    // precisely what a ghost is.
    //
    // Order is the fix, not deletion. A sleeve occludes them the way a real
    // sheath occludes a real channel: nothing hovering, no alpha trick, and
    // the anatomy still true — a covered channel is still there, it simply
    // cannot be seen or leak.
    const src = SOURCES['./leakyScene.ts']
    const doors = src.indexOf('for (const place of doorsAt())')
    const sheath = src.indexOf('drawSheathBands(ctx, geo, sleeveSpans())')
    expect(doors).toBeGreaterThan(0)
    expect(sheath).toBeGreaterThan(doors)
    // And no faded ghost left behind.
    expect(src).not.toMatch(/globalAlpha = open \? 1 : /)
  })

  it('sleeves and gaps tile the whole fibre', () => {
    const spans = sleeveSpans()
    expect(spans[0][0]).toBe(0)
    expect(spans[spans.length - 1][1]).toBe(1)
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i][0]).toBeCloseTo(spans[i - 1][1], 9)
    }
    expect(nodePlaces().length).toBe(spans.length - 1)
  })


  it('names what a child cannot be expected to know, inside the canvas', () => {
    for (const l of leakyLabels()) {
      expect(spokenTermAt(leakyLabels(), l.x + l.w / 2, l.y + l.h / 2)).toBeTruthy()
      expect(l.x).toBeGreaterThanOrEqual(0)
      expect(l.y).toBeGreaterThanOrEqual(0)
    }
  })

  it('redraws identically for the same moment and clock', () => {
    const a = strictCanvas()
    const b = strictCanvas()
    drawLeaky(a.ctx, 0.5, 900)
    drawLeaky(b.ctx, 0.5, 900)
    expect(a.points).toEqual(b.points)
  })

  // ─────────────────────────────────────────────────────────── 2026-08-31 list
  // The user's eight action points, numbered as they were sent, so a test says
  // which request it is standing guard over.



  it('A5: "length constant" is off the axon and above the λ', () => {
    // ⚠ "'Length constant' label is placed on the axon body. Place it outside
    // of the axon, above the gamma letter."
    const [bare] = lanes()
    const [label] = leakyLabels()
    const lambdaText = bare.geo.tubeMid - bare.geo.tubeHalf - OUTSIDE_H - 6
    // Clear of the tube — its whole box, not just its baseline.
    expect(label.y + label.h).toBeLessThan(bare.geo.tubeMid - bare.geo.tubeHalf)
    // And above the λ reading rather than beside or below it.
    expect(label.ay).toBeLessThan(lambdaText)
    // Over the mark, not floating at the left margin: the word's middle sits
    // within a few px of the dashed line.
    const mid = label.x + label.w / 2
    expect(Math.abs(mid - xOnLane(bare.geo, lambdaUm(bare.wall)))).toBeLessThan(12)
  })

  it('A6: the pipe is the axon views\' own axon, to the pixel', () => {
    // ⚠ "The axons look much slimmer and myelin areas are larger… unify (use
    // thicker)." Measured against the race's own geometry rather than a number
    // typed twice: if the axon view changes its fibre, this follows it.
    const race = ribbonGeometry(LK_W, LK_H, AXON_W * AXON_VIEW_SCALE)
    for (const lane of lanes()) expect(lane.geo.tubeHalf).toBe(race.tubeHalf)
    expect(lanes()[0].geo.tubeHalf).toBeGreaterThan(40)
  })


  it('A2/A4: a ruler on the floor, so λ is a mark at a readable distance', () => {
    // ⚠ "Use the layout seen on 'Axonal conduction and myelin' view", and the
    // half of A4 that was real: λ WAS in the right place — measured, the bare
    // fibre keeps 1/e of its push there — but with no scale under it, the mark
    // sat at a place with no name.
    const ticks = rulerTicks()
    expect(ticks[0].label).toBe('0 mm')
    expect(ticks[ticks.length - 1].label).toBe(`${SPAN_UM / 1000} mm`)
    // The marks are where they say they are.
    const geo = lanes()[0].geo
    for (const t of ticks) {
      const um = Number(t.label.replace(' mm', '')) * 1000
      expect(t.x).toBeCloseTo(xOnLane(geo, um), 6)
    }
    // Below both pipes, and on the canvas.
    expect(RULER_Y).toBeGreaterThan(lanes()[1].geo.tubeMid + lanes()[1].geo.tubeHalf)
    expect(RULER_Y).toBeLessThan(LK_H)
    const { ctx, texts } = strictCanvas()
    drawLeaky(ctx, null, 0)
    expect(texts).toContain('1.5 mm')
  })


  it('A1: paints nothing brighter than the fade it was handed', () => {
    // ⚠ THE GHOST-AXON BUG, in its general form (user, 2026-08-31: "I can see
    // a ghost axon behind the visualisation, on both 'passive spread' and
    // 'Axonal conduction and myelin'").
    //
    // Canvas `globalAlpha` is SET, not multiplied, so any drawing that assigns
    // its own wipes whatever a caller put there. That is how a faded-out
    // neuron went on standing behind the view that replaced it — and this view
    // had three of the same assignments, which would have made it pop in at
    // full strength instead of arriving.
    //
    // The question a list of method names cannot answer, asked directly.
    for (const fade of [0.05, 0.3, 1]) {
      const c = strictCanvas()
      drawLeaky(c.ctx, 0.5, 1000, fade)
      expect(c.alphas.length).toBeGreaterThan(50)
      expect(c.alphas.filter((a) => a > fade + 1e-9)).toEqual([])
    }
    // And a view that has not arrived paints nothing at all.
    const none = strictCanvas()
    drawLeaky(none.ctx, 0.5, 1000, 0)
    expect(none.alphas).toEqual([])
  })

})
