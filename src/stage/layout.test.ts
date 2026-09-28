import { describe, expect, it } from 'vitest'
import { AXON_DIAMETER_UM, MEMBRANE_THICKNESS_UM, SOMA_DIAMETER_UM } from '../core/membrane'
import {
  ASTRO_INK,
  ASTROCYTES,
  AXON_POLYLINE,
  MAP_ASTROCYTES,
  NEURON_MAP_BOX,
  OUTGOING,
  astroShape,
  astroNucleus,
  AXON_SIGNAL_T,
  AXON_SIGNAL_TURN,
  AXON_VIEW_SCALE,
  AXON_W,
  mapShowsAstrocytes,
  ARRIVE_DECADES,
  BILAYER_SCALE,
  arrivalAt,
  arrivalSpan,
  SYNAPSE_VIEW_SCALE,
  DENDRITE_SEGS,
  LIPID_PX,
  MEMBRANE_PX,
  MEMBRANE_ZOOM,
  PX_PER_UM,
  SOMA_R,
  STAGE_H,
  STAGE_W,
  TERMINALS,
  TUBE_SCALE,
  ZOOM_TARGETS,
  cameraDuration,
  isOwnView,
  pathLength,
  MARKER_R,
  MAX_PATCH_TILT,
  patchTurnAngle,
  polylinePoint,
  wallSample,
  type Pt,
  litTrunks,
  INPUTS,
  SYNAPSE_TRUNKS,
  AXON_END,
  BOUTON_R,
  CLEFT,
  DENDRITE_TRUNKS,
  OUTPUT,
  SOMA,
  SOMA_OUTLINE,
  DENDRITE_MEMBRANE_T,
  trunkHalfWidthAt,
  tubeHalfWidthOf,
  ARBOR_TAIL_PX,
  arborFronts,
  DENDRITE_ASTROCYTES,
  SPINE_HEAD_R,
  spineHead,
  partialPath,
  terminalArrival,
  terminalReach,
} from './layout'

// The drawing files' own source, seen exactly as the build sees it — the same
// device `__offline.test.ts` uses to make a claim ABOUT the code checkable.
const SOURCES = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const MARGIN = 8

describe('the scene has one honest scale', () => {
  it('derives pixels-per-micrometre from the soma', () => {
    expect(PX_PER_UM).toBeCloseTo((2 * SOMA_R) / SOMA_DIAMETER_UM)
    expect(2 * SOMA_R).toBeCloseTo(SOMA_DIAMETER_UM * PX_PER_UM)
  })

  it('draws the axon at its real width relative to the soma', () => {
    expect(AXON_W).toBeCloseTo(AXON_DIAMETER_UM * PX_PER_UM)
    expect(AXON_W).toBeLessThan(SOMA_R)
  })

  it('makes the membrane far too thin to see at fit zoom', () => {
    expect(MEMBRANE_PX).toBeCloseTo(MEMBRANE_THICKNESS_UM * PX_PER_UM)
    expect(MEMBRANE_PX).toBeLessThan(0.1)
  })
})

describe('membrane magnification', () => {
  it('renders the bilayer at a comfortable size, not a hairline or a wall', () => {
    const onScreen = MEMBRANE_PX * MEMBRANE_ZOOM
    expect(onScreen).toBeGreaterThan(30)
    expect(onScreen).toBeLessThan(80)
  })

  it('renders a lipid head big enough to make out', () => {
    expect(LIPID_PX * MEMBRANE_ZOOM).toBeGreaterThan(6)
  })

  it('is past the magnification where lipids start being drawn', () => {
    expect(MEMBRANE_ZOOM).toBeGreaterThan(BILAYER_SCALE)
    expect(BILAYER_SCALE).toBeGreaterThan(TUBE_SCALE)
  })

  it('leaves the axon far wider than the canvas, so one wall fills the view', () => {
    expect(AXON_W * MEMBRANE_ZOOM).toBeGreaterThan(STAGE_H)
  })
})

describe('zoom targets', () => {
  it('gives every target a label, a promise and a roadmap note', () => {
    expect(ZOOM_TARGETS.length).toBeGreaterThanOrEqual(5)
    for (const target of ZOOM_TARGETS) {
      expect(target.label.length).toBeGreaterThan(0)
      expect(target.promise.length).toBeGreaterThan(20)
      expect(target.roadmap.length).toBeGreaterThan(0)
      expect(target.scale).toBeGreaterThan(1)
    }
  })

  it('keeps every target inside the scene', () => {
    for (const target of ZOOM_TARGETS) {
      expect(target.center.x).toBeGreaterThan(0)
      expect(target.center.x).toBeLessThan(STAGE_W)
      expect(target.center.y).toBeGreaterThan(0)
      expect(target.center.y).toBeLessThan(STAGE_H)
    }
  })

  it('centres the membrane targets ON a wall, half the process away from its centreline', () => {
    // ⚠ EVERY framed target, not just the axon (2026-09-04). This test used to
    // check the axon alone, and that is exactly how the dendrite patch came to
    // be cut with the wrong half-width: the branch TAPERS, the frame was still
    // using the soma-end width, and the camera arrived 1104 screen pixels off
    // its own membrane — an empty view with no lipids in it.
    const cases: { id: string; centre: Pt[]; half: number }[] = [
      { id: 'axon-membrane', centre: AXON_POLYLINE, half: AXON_W / 2 },
      {
        id: 'dendrite-membrane',
        // ⚠ The TUBE's width, not the tapered ribbon's (21c-8): at membrane
        // zoom the branch is drawn by drawProcessTube at the stroke's max.
        centre: DENDRITE_TRUNKS[1].path,
        half: tubeHalfWidthOf(DENDRITE_TRUNKS[1]),
      },
    ]
    // Every framed target is covered by one of these cases.
    expect(
      ZOOM_TARGETS.filter((t) => t.frame)
        .map((t) => t.id)
        .sort(),
    ).toEqual(cases.map((c) => c.id).sort())
    for (const c of cases) {
      const target = ZOOM_TARGETS.find((t) => t.id === c.id)!
      let nearest = Infinity
      for (let i = 0; i <= 4000; i++) {
        const p = polylinePoint(c.centre, i / 4000)
        nearest = Math.min(nearest, Math.hypot(p.x - target.center.x, p.y - target.center.y))
      }
      expect(nearest, c.id).toBeCloseTo(c.half, 2)
    }
  })

  it('A1 (21c-8): the patch is cut with the width the ZOOMED drawing puts there', () => {
    // ⚠ The 2026-09-04 version of this guard pinned the TAPERED width — the
    // right rule measured against the wrong register. At the membrane zoom the
    // branch is drawn by drawProcessTube at the stroke's constant MAX width,
    // and cutting the frame from the ribbon put the camera 1288 screen px off
    // the drawn wall: the same empty-water view, back again (user, 2026-09-06:
    // "'dendrite membrane' zoomed view is missing lipids").
    const trunk = DENDRITE_TRUNKS[1]
    const half = tubeHalfWidthOf(trunk)
    // The tube's width is the stroke's max — the soma end, on this trunk.
    expect(half).toBeCloseTo(Math.max(...trunk.segs.map((sg) => sg.w)) / 2, 9)
    // …and it is NOT the tapered width, which is measurably thinner here and
    // was the 1288 px miss.
    expect(half).toBeGreaterThan(trunkHalfWidthAt(trunk, DENDRITE_MEMBRANE_T) + 0.1)
    // THE CLAIM ITSELF: the camera's centre sits ON the tube-drawn wall, to a
    // small fraction of a scene pixel — at ×2300 even 0.05 px is 100 on screen.
    const target = ZOOM_TARGETS.find((t) => t.id === 'dendrite-membrane')!
    let nearest = Infinity
    for (let i = 0; i <= 8000; i++) {
      for (const side of [1, -1] as const) {
        const w = wallSample(trunk.path, half, side, i / 8000)
        nearest = Math.min(
          nearest,
          Math.hypot(w.at.x - target.center.x, w.at.y - target.center.y),
        )
      }
    }
    expect(nearest, 'the camera is off the drawn wall').toBeLessThan(0.05)
  })

  it('only claims built content where the view is actually built', () => {
    // `content` is shown INSTEAD of the promise, so carrying it is a claim that
    // there is something behind the marker. ⚠ The spine carries it (21c-46):
    // its view is built and, unlike the synapse, it has no panel of its own.
    const built = ZOOM_TARGETS.filter((t) => t.content).map((t) => t.id)
    expect(built).toEqual(['dendrite-membrane', 'axon-membrane', 'spine'])
  })

  it('gives every target its own id', () => {
    expect(new Set(ZOOM_TARGETS.map((t) => t.id)).size).toBe(ZOOM_TARGETS.length)
  })

  it('A3: puts BOTH axon markers on the axon, clear of each other', () => {
    // The whole reason they are markers rather than words in a list: "which
    // part of a neuron is this?" is a question a ring in the right place
    // answers and the word "axon" does not.
    //
    // ⚠ There are two now (user, 2026-08-31: "add another entry point:
    // magnifying glass on the 'big neuron'"). Passive spread sits further down
    // the same cable than conduction, so the child gets two doors they can
    // tell apart rather than one door with a menu behind it.
    const onAxon = ZOOM_TARGETS.filter((t) => t.presents === 'axon')
    expect(onAxon.map((t) => t.id)).toEqual(['axon-signal', 'axon-passive'])
    for (const target of onAxon) {
      let nearest = Infinity
      for (let i = 0; i <= 200; i++) {
        const p = polylinePoint(AXON_POLYLINE, i / 200)
        nearest = Math.min(nearest, Math.hypot(p.x - target.center.x, p.y - target.center.y))
      }
      expect(nearest).toBeLessThan(1)
    }
    // ⚠ NO TWO MARKERS MAY OVERLAP, on the axon or anywhere else — two doors
    // drawn on top of each other are one door you cannot aim at. Measured
    // against the marker's own radius rather than a chosen gap.
    for (const a of ZOOM_TARGETS) {
      for (const b of ZOOM_TARGETS) {
        if (a === b) continue
        expect(Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y)).toBeGreaterThan(
          MARKER_R * 2 + 8,
        )
      }
    }
  })

  it('magnifies the axon enough for it to be a tube, and derives how much', () => {
    // Not a number anybody chose: whatever it takes to draw this axon's own
    // 1.4 µm at a readable width. Well past the magnification at which a process
    // stops reading as a line.
    expect(AXON_VIEW_SCALE).toBeGreaterThan(TUBE_SCALE)
    expect(AXON_W * AXON_VIEW_SCALE).toBeGreaterThan(60)
    expect(AXON_W * AXON_VIEW_SCALE).toBeLessThan(120)
  })

  it('turns the camera exactly enough to bring that stretch of axon level', () => {
    // A ruler in millimetres and a graph against distance both have to be square
    // to the screen, and the axon they belong to has to be square to them.
    const a = polylinePoint(AXON_POLYLINE, AXON_SIGNAL_T - 0.01)
    const b = polylinePoint(AXON_POLYLINE, AXON_SIGNAL_T + 0.01)
    const slope = Math.atan2(b.y - a.y, b.x - a.x)
    expect(slope + AXON_SIGNAL_TURN).toBeCloseTo(0, 2)
  })

  it('never gives the propagation marker a membrane frame', () => {
    // A frame means "this is a patch of wall": the charge field, the lipids and
    // the ion crowds all key off it, and the side panels use it to decide what to
    // show. This view is its own thing and says so its own way.
    for (const target of ZOOM_TARGETS) {
      if (target.presents) expect(target.frame).toBeUndefined()
    }
  })

  it('N2: the synapse view is home across BOTH its places — no blink between them', () => {
    // ⚠ arrivalAt is a single-scale band; midway between the synapse (×V) and
    // its active zone (×4V) it read 0 and the view blinked out mid-dive.
    const lo = SYNAPSE_VIEW_SCALE
    const hi = SYNAPSE_VIEW_SCALE * 4
    expect(arrivalSpan(lo, lo, hi)).toBe(1)
    expect(arrivalSpan(lo * 2, lo, hi)).toBe(1)
    expect(arrivalSpan(hi, lo, hi)).toBe(1)
    expect(arrivalSpan(1, lo, hi)).toBe(0)
    expect(arrivalSpan(hi * 100, lo, hi)).toBe(0)
    // And the ramps outside are the app's own arrival ramp.
    expect(arrivalSpan(lo / 2, lo, hi)).toBeCloseTo(arrivalAt(lo / 2, lo), 9)
  })

  it('knows which targets put up a view of their own', () => {
    const own = ZOOM_TARGETS.filter(isOwnView).map((t) => t.id)
    // An "own view" is one that replaces the scene rather than magnifying it.
    // ⚠ The synapse came OFF this list when its molecular view was deleted for
    // redesign, and is back on it (2026-08-31, milestone 4 step 20) now the
    // redesign is built from the user's own bouton drawing.
    expect(own).toEqual([
      'dendrite-membrane',
      'axon-membrane',
      'axon-signal',
      'axon-passive',
      'outgoing-synapse',
      // The same view, four times deeper — the active zone is a PLACE
      // (user, 2026-09-01: "the same demo, but at the image's scale").
      'active-zone',
      // ⚠ S13 — the first synapse place on the FAR side of the gap, and a view
      // of its own because the picture is not the terminal's any more.
      'spine',
    ])
  })
})

describe('wallSample', () => {
  const straight = [
    { x: 0, y: 100 },
    { x: 200, y: 100 },
  ]

  it('offsets to either side by exactly the half-width', () => {
    expect(wallSample(straight, 10, 1, 0.5).at.y).toBeCloseTo(110)
    expect(wallSample(straight, 10, -1, 0.5).at.y).toBeCloseTo(90)
  })

  it('always points inward, back toward the centreline', () => {
    expect(wallSample(straight, 10, 1, 0.5).inward.y).toBeCloseTo(-1)
    expect(wallSample(straight, 10, -1, 0.5).inward.y).toBeCloseTo(1)
  })

  it('returns a unit tangent along the path', () => {
    const w = wallSample(straight, 10, 1, 0.5)
    expect(Math.hypot(w.tangent.x, w.tangent.y)).toBeCloseTo(1)
    expect(w.tangent.x).toBeCloseTo(1)
  })
})

describe('cameraDuration', () => {
  it('takes longer the more orders of magnitude are crossed', () => {
    const hop = cameraDuration(1, 7)
    const plunge = cameraDuration(1, MEMBRANE_ZOOM)
    expect(plunge).toBeGreaterThan(hop)
    expect(hop).toBeGreaterThan(600)
    expect(plunge).toBeLessThanOrEqual(3000)
  })

  it('is symmetric — zooming out costs what zooming in did', () => {
    expect(cameraDuration(1, 400)).toBeCloseTo(cameraDuration(400, 1))
  })
})

describe('neuron geometry stays on the stage', () => {
  it('keeps every dendrite segment inside the canvas', () => {
    for (const s of DENDRITE_SEGS) {
      for (const p of [
        { x: s.x1, y: s.y1 },
        { x: s.x2, y: s.y2 },
      ]) {
        expect(p.x).toBeGreaterThan(MARGIN)
        expect(p.x).toBeLessThan(STAGE_W - MARGIN)
        expect(p.y).toBeGreaterThan(MARGIN)
        expect(p.y).toBeLessThan(STAGE_H - MARGIN)
      }
    }
  })

  it('keeps the axon and terminal boutons inside the canvas', () => {
    for (const p of [...AXON_POLYLINE, ...TERMINALS.map((t) => t.end)]) {
      expect(p.x).toBeGreaterThan(MARGIN)
      expect(p.x).toBeLessThan(STAGE_W - MARGIN)
      expect(p.y).toBeGreaterThan(MARGIN)
      expect(p.y).toBeLessThan(STAGE_H - MARGIN)
    }
  })
})

describe('pathLength', () => {
  it('measures a polyline by its segments', () => {
    expect(
      pathLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 3, y: 14 },
      ]),
    ).toBeCloseTo(15)
  })
})

describe('facing the membrane (the camera turn)', () => {
  const framed = ZOOM_TARGETS.filter((t) => t.frame)

  /** Where a direction drawn in the patch frame ends up on screen, once the
   *  renderer's rotation-and-maybe-flip and the camera's counter-turn are both
   *  applied. This mirrors `enterPatch`; if the two ever disagree, the membrane
   *  stops being level and the tests below say so. */
  function onScreen(frame: (typeof framed)[number]['frame'], local: Pt): Pt {
    const f = frame!
    const theta = Math.atan2(f.tangent.y, f.tangent.x)
    const localY = { x: -f.tangent.y, y: f.tangent.x }
    const flipped = f.inward.x * localY.x + f.inward.y * localY.y < 0
    const v = flipped ? { x: local.x, y: -local.y } : local
    const a = theta + patchTurnAngle(f)
    return {
      x: Math.cos(a) * v.x - Math.sin(a) * v.y,
      y: Math.sin(a) * v.x + Math.cos(a) * v.y,
    }
  }

  it('has a membrane patch to turn towards', () => {
    expect(framed.length).toBeGreaterThan(1)
  })

  /** The membrane's slope on screen, radians in (−90°, 90°]. */
  function slope(frame: (typeof framed)[number]['frame']): number {
    const along = onScreen(frame, { x: 1, y: 0 })
    return Math.atan(along.y / Math.abs(along.x))
  }

  it('keeps every membrane within the tilt a plus sign survives', () => {
    // One of these sits on a dendrite trunk at 132°, and at that angle the ion
    // crowd's rectangle no longer matches the screen so the corners empty out —
    // and a "+" charge mark reads as a multiplication sign.
    for (const target of framed) {
      expect(Math.abs(slope(target.frame))).toBeLessThanOrEqual(MAX_PATCH_TILT + 1e-9)
    }
  })

  it('leaves a patch that was already gentle exactly as it was', () => {
    // The tilt is capped, not removed: the point of keeping it is that arriving
    // somewhere slanted says you have come to a place, not to a diagram.
    const gentle = framed.find((t) => Math.abs(patchTurnAngle(t.frame!)) < 1e-9)
    expect(gentle).toBeDefined()
    expect(Math.abs(slope(gentle!.frame))).toBeGreaterThan(0)
  })

  it('still tilts the steep one, rather than flattening it', () => {
    const steep = framed.find((t) => Math.abs(patchTurnAngle(t.frame!)) > 0.1)
    expect(steep).toBeDefined()
    expect(Math.abs(slope(steep!.frame))).toBeCloseTo(MAX_PATCH_TILT, 6)
  })

  it('puts the cytoplasm BELOW the membrane, every time', () => {
    // The half-turn a mirrored frame needs is the whole reason this is not just
    // minus the tangent angle: get it wrong and the cell is upside down.
    for (const target of framed) {
      const inward = onScreen(target.frame, { x: 0, y: 1 })
      expect(inward.y).toBeGreaterThan(Math.cos(MAX_PATCH_TILT) - 1e-9)
    }
  })

  it('leaves everything that is not a membrane patch unturned', () => {
    for (const target of ZOOM_TARGETS) {
      if (target.frame) continue
      expect(target.scale).toBeLessThan(MEMBRANE_ZOOM)
    }
  })
})

describe('handing the scene over to a view of its own', () => {
  /** Where the camera is part-way through a flight. Scale interpolates
   *  geometrically in the stage, so this is the real path, not an approximation. */
  const at = (from: number, to: number, t: number) => from * Math.pow(to / from, t)

  it('is fully arrived only AT the view’s own magnification', () => {
    expect(arrivalAt(AXON_VIEW_SCALE, AXON_VIEW_SCALE)).toBe(1)
    expect(arrivalAt(160, 160)).toBe(1)
  })

  it('measures the approach from BOTH sides', () => {
    // The bug this pins. The old test was a ratio to the view's own scale, which
    // saturates when you come at it from a HIGHER magnification — so flying out of
    // a membrane patch towards the axon, it read "arrived" for the whole journey
    // and the axon was painted over a camera still at ×2300.
    const above = arrivalAt(AXON_VIEW_SCALE * 4, AXON_VIEW_SCALE)
    const below = arrivalAt(AXON_VIEW_SCALE / 4, AXON_VIEW_SCALE)
    expect(above).toBe(0)
    expect(below).toBe(0)
    // and symmetric: the same factor either way is the same fraction arrived
    expect(arrivalAt(AXON_VIEW_SCALE * 1.5, AXON_VIEW_SCALE)).toBeCloseTo(
      arrivalAt(AXON_VIEW_SCALE / 1.5, AXON_VIEW_SCALE),
      6,
    )
  })

  it('keeps the shrinking membrane on screen for most of the way out', () => {
    // What the child should see leaving a patch for the axon: the wall they were
    // looking at gets smaller, then the axon's SECOND wall comes into view, and
    // only then does the propagation view take over. Each stage is checked here
    // against the scale thresholds the scene actually draws by.
    const seen = (t: number) => at(MEMBRANE_ZOOM, AXON_VIEW_SCALE, t)
    // early: still a bilayer, and the axon view is nowhere. (Probe moved
    // 0.3 → 0.2 with the traced neuron, 2026-09-04: the solved scale raised
    // PX_PER_UM, so the patch→axon flight spans fewer decades and the
    // bilayer phase now ends at 28% of the way out — measured, not chosen.)
    expect(seen(0.2)).toBeGreaterThan(BILAYER_SCALE)
    expect(arrivalAt(seen(0.2), AXON_VIEW_SCALE)).toBe(0)
    // middle: a tube, so both walls are on screen — and STILL no axon view
    expect(seen(0.6)).toBeLessThan(BILAYER_SCALE)
    expect(seen(0.6)).toBeGreaterThan(TUBE_SCALE)
    expect(arrivalAt(seen(0.6), AXON_VIEW_SCALE)).toBe(0)
    // and it only hands over near the end
    expect(arrivalAt(seen(0.95), AXON_VIEW_SCALE)).toBeGreaterThan(0.5)
  })

  it('hands over within a factor of two, in or out', () => {
    // ARRIVE_DECADES is the whole ramp, and 0.3 decades is a factor of two — which
    // is exactly the ramp the axon view used back when it only ever had to worry
    // about being zoomed into.
    expect(10 ** ARRIVE_DECADES).toBeCloseTo(2, 1)
  })
})

describe('which dendrites light', () => {
  it('lights ONE branch when one input fires', () => {
    // The bug (user, 2026-08-28): the miniature lit every synapse-bearing
    // trunk whenever anything fired, so choosing one input flashed all three
    // dendrites — the axon rule's misconception, one structure earlier, and a
    // contradiction of the control the child had just used.
    expect(litTrunks([0])).toHaveLength(1)
    expect(litTrunks([0, 1])).toHaveLength(2)
    expect(litTrunks([0, 1, 2])).toHaveLength(SYNAPSE_TRUNKS.length)
  })

  it('lights the branch that input actually contacts', () => {
    for (const [i, input] of INPUTS.entries()) {
      expect(litTrunks([i])).toEqual([input.trunk])
    }
  })

  it('lights the whole fan when there is no run to ask about', () => {
    // A dendrite zoom is about a patch of membrane, not about a choice.
    expect(litTrunks(null)).toEqual([...SYNAPSE_TRUNKS])
  })

  it('lights nothing when nothing fired', () => {
    expect(litTrunks([])).toEqual([])
  })

  it('ignores an input index that does not exist', () => {
    expect(litTrunks([99])).toEqual([])
  })
})

describe('the astrocytes on the map (21b-1b)', () => {
  it('A3 (21c-1): ONE cell, on the RIGHT of the outgoing synapse, reaching its mouth', () => {
    const s = {
      x: (OUTGOING.bouton.x + OUTGOING.tip.x) / 2,
      y: (OUTGOING.bouton.y + OUTGOING.tip.y) / 2,
    }
    // ⚠ Supersedes "two cells flank" (21b-1b). The user reversed the
    // two-finger ruling on 2026-09-04 — "place one astrocyte on the right" —
    // and a marker's job is to say WHAT IS ON SCREEN, so the map may not keep
    // a cell the scene no longer draws.
    expect(ASTROCYTES.length).toBe(1)
    expect(Math.sign(ASTROCYTES[0].soma.x - s.x)).toBe(1)
    for (const a of ASTROCYTES) {
      const d = Math.hypot(a.soma.x - s.x, a.soma.y - s.y)
      // A separate neighbouring cell: off the synapse, but of its neighbourhood.
      expect(d).toBeGreaterThan(60)
      expect(d).toBeLessThan(160)
      // Its process ends AT the synapse — the finger the zoom magnifies —
      // on its own side.
      expect(Math.hypot(a.reach.x - s.x, a.reach.y - s.y)).toBeLessThan(16)
      expect(Math.sign(a.reach.x - s.x)).toBe(Math.sign(a.soma.x - s.x))
    }
  })

  it('A3 (21c-1b): map, big neuron and demo all put the cell on the PRESYNAPTIC side', () => {
    // User, 2026-09-05: "map astrocyte, same as 'whole picture' astrocyte, are
    // located below the synapse. Demo one — above. Align on either of the
    // views, for consistency." Aligned on the demo, whose placement was the
    // measured one — a body below the synapse throws the cell's processes
    // across the postsynaptic spine.
    const s = {
      x: (OUTGOING.bouton.x + OUTGOING.tip.x) / 2,
      y: (OUTGOING.bouton.y + OUTGOING.tip.y) / 2,
    }
    // Which way IS presynaptic in this view? Asked of the geometry, not
    // assumed: the side the bouton is on.
    const pre = Math.sign(OUTGOING.bouton.y - s.y)
    expect(pre).toBe(-1)
    for (const a of [...ASTROCYTES, ...MAP_ASTROCYTES]) {
      expect(Math.sign(a.soma.y - s.y)).toBe(pre)
      // …and the reach still lands at the synapse, from that side.
      expect(Math.hypot(a.reach.x - s.x, a.reach.y - s.y)).toBeLessThan(16)
      expect(Math.sign(a.reach.y - s.y)).toBe(pre)
    }
  })

  it('A1 (21c-1c): the astrocyte wears ONE ink, and it stays CLEAR OF THE CHARGE COLOURS', () => {
    // ⚠ The bug this exists for (user, 2026-09-05, after seeing pink in the
    // app): "the pink tint of astrocytes conflicts with red & blue charge
    // color-coding. Bring back the previous color, for all views." The palette
    // reserves red `#ef4444` for POSITIVE charge and sky `#0ea5e9` for
    // negative; a cell wash near either of them reads as charge.
    const rgb = ASTRO_INK.split(',').map((n) => Number(n.trim()))
    expect(rgb.length).toBe(3)
    for (const c of rgb) expect(Number.isFinite(c) && c >= 0 && c <= 255).toBe(true)
    const [r, g, b] = rgb
    // GREEN-dominant: a hue no charge mark uses.
    expect(g).toBeGreaterThan(r)
    expect(g).toBeGreaterThan(b)
    // …and far from both reserved charge inks, in plain channel distance.
    const far = (cr: number, cg: number, cb: number) =>
      Math.hypot(r - cr, g - cg, b - cb)
    expect(far(239, 68, 68), 'clear of + charge red').toBeGreaterThan(120)
    expect(far(14, 165, 233), 'clear of − charge sky').toBeGreaterThan(120)
  })

  it('A1 (21c-1c): every view reads that one constant — no literal copies left', () => {
    // The ink used to be a literal repeated in six places across four files,
    // which is how a colour code drifts. Each drawing site now asks for it.
    for (const rel of [
      './drawScene.ts',
      './synapseScene.ts',
      '../ui/NeuronMapPanel.tsx',
    ]) {
      const src = SOURCES[rel]
      expect(src, rel).toBeTruthy()
      expect(src, rel).toContain('ASTRO_INK')
      expect(src, rel).not.toContain('134, 184, 158')
    }
  })

  it('the miniature shows them only where the story needs them', () => {
    expect(mapShowsAstrocytes('outgoing-synapse')).toBe(true)
    expect(mapShowsAstrocytes('active-zone')).toBe(true)
    expect(mapShowsAstrocytes('membrane')).toBe(false)
    expect(mapShowsAstrocytes('axon-signal')).toBe(false)
    expect(mapShowsAstrocytes(null)).toBe(false)
  })
})

describe('the astrocyte glyph (traced from astrocyte.svg, re-created 2026-09-04)', () => {
  // Guards A1 of the re-creation: the handover's own geometry, not an
  // approximation of it.
  it('is the SVG own six-point star whose reach ends exactly at the fingertip', () => {
    for (const a of ASTROCYTES) {
      const shape = astroShape(a)
      // The soma is the traced STAR: six contiguous groups of far-out
      // samples (the SVG has six points, not the first pass's five), with
      // concave valleys well inside between them.
      const far = shape.soma.map((p) => Math.hypot(p.x - a.soma.x, p.y - a.soma.y) > a.r * 0.85)
      let groups = 0
      for (let i = 0; i < far.length; i++) {
        if (far[i] && !far[(i + far.length - 1) % far.length]) groups++
      }
      expect(groups).toBe(6)
      // Measured off the trace: tips scale to r exactly, valleys sit at
      // 0.60 r — a star with concave valleys, not a blob and not a burst.
      const dists = shape.soma.map((p) => Math.hypot(p.x - a.soma.x, p.y - a.soma.y))
      expect(Math.max(...dists)).toBeGreaterThan(a.r * 0.95)
      expect(Math.min(...dists)).toBeGreaterThan(a.r * 0.5)
      expect(Math.min(...dists)).toBeLessThan(a.r * 0.65)
      // Six arms, each with its one side-branch — the handover's paired
      // grammar, twelve polylines.
      expect(shape.processes.length).toBe(12)
      // And the reach process lands EXACTLY on the fingertip — the visual
      // link the whole glyph exists for.
      const reachMain = shape.processes[0]
      const tip = reachMain[reachMain.length - 1]
      expect(tip.x).toBeCloseTo(a.reach.x, 6)
      expect(tip.y).toBeCloseTo(a.reach.y, 6)
      // The reach STARTS at the soma (its star point), so the stretched arm
      // still belongs to its cell.
      const root = reachMain[0]
      expect(Math.hypot(root.x - a.soma.x, root.y - a.soma.y)).toBeLessThan(a.r * 1.1)
      // The side-branch rides the reach's own stretch: it stays within the
      // arm's span instead of dangling at the unstretched scale.
      const branch = shape.processes[1]
      for (const p of branch) {
        const t =
          ((p.x - root.x) * (a.reach.x - root.x) + (p.y - root.y) * (a.reach.y - root.y)) /
          ((a.reach.x - root.x) ** 2 + (a.reach.y - root.y) ** 2)
        expect(t).toBeGreaterThan(0)
        expect(t).toBeLessThan(1)
      }
    }
  })

  it("the map's cells sit ON the sheet — a star the kid cannot see teaches nothing", () => {
    // ONE cell since 21c-1 — the map says what is on screen.
    expect(MAP_ASTROCYTES.length).toBe(1)
    expect(MAP_ASTROCYTES[0].soma.x).toBeGreaterThan(OUTGOING.bouton.x)
    const box = NEURON_MAP_BOX
    for (const a of MAP_ASTROCYTES) {
      // The body (soma and most of each arm) inside the map's box.
      expect(a.soma.x - a.r).toBeGreaterThan(box.minX)
      expect(a.soma.x + a.r).toBeLessThan(box.minX + box.width)
      expect(a.soma.y - a.r).toBeGreaterThan(box.minY)
      expect(a.soma.y + a.r).toBeLessThan(box.minY + box.height)
      // Still reaching at the synapse, on its own side.
      const s = {
        x: (OUTGOING.bouton.x + OUTGOING.tip.x) / 2,
        y: (OUTGOING.bouton.y + OUTGOING.tip.y) / 2,
      }
      expect(Math.hypot(a.reach.x - s.x, a.reach.y - s.y)).toBeLessThan(16)
      expect(Math.sign(a.reach.x - s.x)).toBe(Math.sign(a.soma.x - s.x))
    }
  })
})

describe('the neuron as traced from neuron (1).svg (re-drawn 2026-09-04)', () => {
  const distToOutline = (p: Pt) =>
    Math.min(...SOMA_OUTLINE.map((q) => Math.hypot(q.x - p.x, q.y - p.y)))

  it('A2: the soma is the traced star, its axon rooted on the drawn hillock cone', () => {
    const rs = SOMA_OUTLINE.map((p) => Math.hypot(p.x - SOMA.x, p.y - SOMA.y))
    // A star with concave valleys, not a circle — measured off the trace:
    // the cone reaches ~1.5 r, the deepest valley sits at ~0.63 r.
    expect(Math.max(...rs)).toBeGreaterThan(SOMA_R * 1.3)
    expect(Math.min(...rs)).toBeLessThan(SOMA_R * 0.75)
    // And the axon leaves FROM the outline, where the trace draws its cone.
    expect(distToOutline(AXON_POLYLINE[0])).toBeLessThan(6)
  })

  it('A2: seven terminals, each reached along the traced arbor, never by a chord', () => {
    expect(TERMINALS.length).toBe(7)
    for (const t of TERMINALS) {
      // The route starts at the axon's tip…
      expect(Math.hypot(t.path[0].x - AXON_END.x, t.path[0].y - AXON_END.y)).toBeLessThan(1)
      // …ends on the bouton's centre…
      const last = t.path[t.path.length - 1]
      expect(Math.hypot(last.x - t.end.x, last.y - t.end.y)).toBeLessThan(1)
      // …and is continuous: no step longer than a couple of boutons, so the
      // chained joins (the sketch's own gaps) really were bridged.
      for (let i = 1; i < t.path.length; i++) {
        expect(
          Math.hypot(t.path[i].x - t.path[i - 1].x, t.path[i].y - t.path[i - 1].y),
        ).toBeLessThan(BOUTON_R * 2.2)
      }
      // The teardrop outline rings its own centre.
      for (const p of t.outline) {
        expect(Math.hypot(p.x - t.end.x, p.y - t.end.y)).toBeLessThan(BOUTON_R * 2)
      }
    }
  })

  it('A2: all eleven trunks root on the soma and run their paths soma → tip', () => {
    expect(DENDRITE_TRUNKS.length).toBe(11)
    for (const t of DENDRITE_TRUNKS) {
      const root = t.path[0]
      const tip = t.path[t.path.length - 1]
      // Rooted: within the sketch's own detachment gap (< 4 units, scaled).
      expect(distToOutline(root)).toBeLessThan(14)
      // soma → tip, the direction every ripple renderer relies on.
      expect(Math.hypot(tip.x - SOMA.x, tip.y - SOMA.y)).toBeGreaterThan(
        Math.hypot(root.x - SOMA.x, root.y - SOMA.y),
      )
    }
  })

  it('A5: each input gets its own trunk, tips facing the inputs, top to bottom', () => {
    expect(new Set(SYNAPSE_TRUNKS).size).toBe(3)
    const tips = SYNAPSE_TRUNKS.map((i) => {
      const p = DENDRITE_TRUNKS[i].path
      return p[p.length - 1]
    })
    for (const tip of tips) expect(tip.x).toBeLessThan(SOMA.x - SOMA_R)
    // Top row's trunk above the middle's above the bottom's.
    expect(tips[0].y).toBeLessThan(tips[1].y)
    expect(tips[1].y).toBeLessThan(tips[2].y)
  })

  it('A5: the outgoing synapse sits on the bouton nearest the target', () => {
    const d = (ti: number) =>
      Math.hypot(TERMINALS[ti].end.x - OUTPUT.soma.x, TERMINALS[ti].end.y - OUTPUT.soma.y)
    const outgoing = OUTPUT.dendrites[1].fromTerminal
    for (let ti = 0; ti < TERMINALS.length; ti++) {
      expect(d(outgoing)).toBeLessThanOrEqual(d(ti) + 1e-9)
    }
    // Three stubs, three different boutons, top to bottom so they never cross.
    const picked = OUTPUT.dendrites.map((s) => s.fromTerminal)
    expect(new Set(picked).size).toBe(3)
  })
})

describe('the arbor wave (corrections 2026-09-04: invaded, not switched on)', () => {
  // Guards A1/A2: the per-route coverage is the DECISION the renderers ask.
  it('covers near routes first and every route by the end', () => {
    const lens = TERMINALS.map((t) => pathLength(t.path))
    const shortest = lens.indexOf(Math.min(...lens))
    const longest = lens.indexOf(Math.max(...lens))
    // The moment the shortest route finishes (measured off the lengths, not
    // guessed): that route is done, the longest is still travelling — and
    // still short of its own arrival window.
    const mid = Math.min(...lens) / Math.max(...lens)
    expect(terminalReach(mid, shortest)).toBeCloseTo(1, 9)
    expect(terminalReach(mid, longest)).toBeLessThan(0.8)
    // No wave, no light; full head, every route covered.
    for (let ti = 0; ti < TERMINALS.length; ti++) {
      expect(terminalReach(null, ti)).toBe(0)
      expect(terminalReach(1, ti)).toBe(1)
    }
    // The bouton lights only at the end of ITS route.
    expect(terminalArrival(mid, longest)).toBe(0)
    expect(terminalArrival(1, longest)).toBeCloseTo(1, 9)
  })

  it('partialPath hands back exactly the covered prefix', () => {
    const path = TERMINALS[0].path
    expect(partialPath(path, 1)).toEqual(path)
    const half = partialPath(path, 0.5)
    expect(half[0]).toEqual(path[0])
    expect(pathLength(half)).toBeCloseTo(pathLength(path) * 0.5, 6)
    expect(partialPath(path, 0).length).toBe(2)
    expect(pathLength(partialPath(path, 0))).toBeCloseTo(0, 9)
  })
})

describe('the neighbours are whole neurons (corrections 2026-09-04)', () => {
  // A1: "neighbour neurons... look like astrocytes". What tells a neuron from
  // an astrocyte is POLARITY — an astrocyte's processes radiate evenly, a
  // neuron's dendrites are all on one side and its axon leaves the other.
  const centroid = (pts: Pt[]) => ({
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  })

  it('A1: every input is a whole cell, and a POLARIZED one', () => {
    for (const input of INPUTS) {
      // The whole traced fan, not three token stubs.
      expect(input.fan.length).toBe(17)
      expect(input.outline.length).toBeGreaterThan(20)
      // Its dendrites sit on the far side from the cell it talks to: the
      // fan's centre of mass and its target are on OPPOSITE sides of the
      // soma. A radially even glyph (the astrocyte's) scores ~0 here.
      const away = {
        x: centroid(input.fan.flat()).x - input.soma.x,
        y: centroid(input.fan.flat()).y - input.soma.y,
      }
      const toSite = {
        x: input.site.x - input.soma.x,
        y: input.site.y - input.soma.y,
      }
      const along =
        (away.x * toSite.x + away.y * toSite.y) /
        (Math.hypot(away.x, away.y) * Math.hypot(toSite.x, toSite.y))
      expect(along).toBeLessThan(-0.4)
      // And it has an arbor: this axon contacts other cells too.
      expect(input.otherBoutons.length).toBe(TERMINALS.length - 1)
      expect(input.branches.length).toBeGreaterThan(0)
    }
  })

  it('A1: an input axon runs soma → its own bouton, ending exactly on it', () => {
    for (const input of INPUTS) {
      const start = input.axon[0]
      const end = input.axon[input.axon.length - 1]
      // Leaves its own soma…
      expect(Math.hypot(start.x - input.soma.x, start.y - input.soma.y)).toBeLessThan(
        input.somaR * 2,
      )
      // …and lands on the cleft it is drawn to reach.
      expect(end.x).toBeCloseTo(input.bouton.x, 6)
      expect(end.y).toBeCloseTo(input.bouton.y, 6)
      // Continuous, so the travelling spike never jumps.
      for (let i = 1; i < input.axon.length; i++) {
        expect(
          Math.hypot(
            input.axon[i].x - input.axon[i - 1].x,
            input.axon[i].y - input.axon[i - 1].y,
          ),
        ).toBeLessThan(input.somaR)
      }
    }
  })

  it('A1: the target is a whole cell whose dendrites land exactly on our boutons', () => {
    expect(OUTPUT.fan.length).toBeGreaterThan(8)
    expect(OUTPUT.outline.length).toBeGreaterThan(20)
    for (const d of OUTPUT.dendrites) {
      const tip = d.path[d.path.length - 1]
      expect(tip.x).toBeCloseTo(d.to.x, 6)
      expect(tip.y).toBeCloseTo(d.to.y, 6)
      // Rooted on its own soma, reaching back toward us.
      expect(Math.hypot(d.path[0].x - OUTPUT.soma.x, d.path[0].y - OUTPUT.soma.y)).toBeLessThan(
        OUTPUT.somaR * 2.4,
      )
      // It stands UNDER the arbor now, so its dendrites reach UP.
      expect(tip.y).toBeLessThan(OUTPUT.soma.y)
    }
    // Its axon projects onward, off the bottom edge — polarity again.
    expect(Math.max(...OUTPUT.axon.map((p) => p.y))).toBeGreaterThan(STAGE_H)
  })

  it('A3: a spine head is centred ON its dendrite tip, aligned with nothing else', () => {
    // The misalignment (user, 2026-09-04) was an offset along the line to the
    // PARTNER's bouton — a direction the dendrite knows nothing about. Seated
    // on the tip it cannot be out of line: this pins the seat itself.
    for (const input of INPUTS) {
      const path = DENDRITE_TRUNKS[input.trunk].path
      const tip = path[path.length - 1]
      const { head, neck } = spineHead(path)
      expect(head.x).toBeCloseTo(tip.x, 9)
      expect(head.y).toBeCloseTo(tip.y, 9)
      // The clearance is made by placing the BOUTON, which is free to move:
      // the two membranes still show a real gap between them.
      const toBouton = Math.hypot(head.x - input.bouton.x, head.y - input.bouton.y)
      expect(toBouton - SPINE_HEAD_R - BOUTON_R * 0.85).toBeGreaterThan(2)
      // The head is a head and the neck is a neck: the neck runs inward,
      // back along the dendrite, not out into the gap.
      expect(Math.hypot(neck.x - input.bouton.x, neck.y - input.bouton.y)).toBeGreaterThan(
        toBouton,
      )
      // And the neck really is on the dendrite, not floating beside it.
      const near = Math.min(...path.map((p) => Math.hypot(p.x - neck.x, p.y - neck.y)))
      expect(near).toBeLessThan(SPINE_HEAD_R)
    }
  })

  it('A3: the target\u2019s spines are seated the same way', () => {
    for (const d of OUTPUT.dendrites) {
      const { head } = spineHead(d.path)
      expect(head.x).toBeCloseTo(d.to.x, 9)
      expect(head.y).toBeCloseTo(d.to.y, 9)
      const gap =
        Math.hypot(
          head.x - TERMINALS[d.fromTerminal].end.x,
          head.y - TERMINALS[d.fromTerminal].end.y,
        ) -
        SPINE_HEAD_R -
        BOUTON_R
      expect(gap).toBeGreaterThan(2)
    }
  })
})

describe('the arbor signal and the glia around it (corrections 2026-09-04)', () => {
  it('A1: one front leaves the axon and BECOMES many at the forks', () => {
    // Seven routes share their first stretches, so seven signals would stack
    // into a flare on the shared limb. Deduping is what makes the picture a
    // spike forking rather than a lamp brightening.
    expect(arborFronts(null).length).toBe(0)
    expect(arborFronts(0).length).toBe(0)
    const counts = Array.from({ length: 40 }, (_, i) => arborFronts((i + 0.5) / 40).length)
    // It starts as ONE dot…
    expect(counts[0]).toBe(1)
    // …and at some point there are several travelling at once.
    expect(Math.max(...counts)).toBeGreaterThan(2)
    // Never more than one per route, and never a stack of coincident dots.
    for (const n of counts) expect(n).toBeLessThanOrEqual(TERMINALS.length)
    for (let i = 0; i < 40; i++) {
      const at = arborFronts((i + 0.5) / 40).map((f) => polylinePoint(TERMINALS[f.ti].path, f.t))
      for (let a = 0; a < at.length; a++) {
        for (let b = a + 1; b < at.length; b++) {
          expect(Math.hypot(at[a].x - at[b].x, at[a].y - at[b].y)).toBeGreaterThan(1)
        }
      }
    }
    // Arrived routes drop out — the bouton's own glow takes over.
    expect(arborFronts(1).length).toBe(0)
  })

  it('A1: the arbor tail is the axon’s own, so one journey keeps one speed', () => {
    expect(ARBOR_TAIL_PX).toBeCloseTo(0.11 * pathLength(AXON_POLYLINE), 6)
    // A real tail on every route, never longer than the route it is on.
    for (const t of TERMINALS) {
      expect(ARBOR_TAIL_PX / pathLength(t.path)).toBeLessThan(1)
      expect(ARBOR_TAIL_PX / pathLength(t.path)).toBeGreaterThan(0.05)
    }
  })

  it('A2: astrocytes sit among the dendrites — clear of them, and touching one', () => {
    expect(DENDRITE_ASTROCYTES.length).toBeGreaterThanOrEqual(3)
    const pts = DENDRITE_SEGS.flatMap((s) => [
      { x: s.x1, y: s.y1 },
      { x: s.x2, y: s.y2 },
    ])
    for (const a of DENDRITE_ASTROCYTES) {
      const near = Math.min(...pts.map((p) => Math.hypot(p.x - a.soma.x, p.y - a.soma.y)))
      // In a gap, not on top of a branch…
      expect(near).toBeGreaterThan(a.r)
      // …but plainly among them, not off in empty canvas.
      expect(near).toBeLessThan(a.r * 2.2)
      // Its body is on the sheet.
      expect(a.soma.x - a.r).toBeGreaterThan(0)
      expect(a.soma.x + a.r).toBeLessThan(STAGE_W)
      expect(a.soma.y - a.r).toBeGreaterThan(0)
      expect(a.soma.y + a.r).toBeLessThan(STAGE_H)
      // Clear of the cell body and of every door the child can click.
      expect(Math.hypot(a.soma.x - SOMA.x, a.soma.y - SOMA.y)).toBeGreaterThan(SOMA_R + a.r)
      for (const z of ZOOM_TARGETS) {
        expect(Math.hypot(z.center.x - a.soma.x, z.center.y - a.soma.y)).toBeGreaterThan(a.r)
      }
      // Its reach ENDS on a dendrite: that contact is what it is for.
      const reachOff = Math.min(...pts.map((p) => Math.hypot(p.x - a.reach.x, p.y - a.reach.y)))
      expect(reachOff).toBeLessThan(1)
      // And the glyph really lands there.
      const shape = astroShape(a)
      const tip = shape.processes[0][shape.processes[0].length - 1]
      expect(tip.x).toBeCloseTo(a.reach.x, 6)
      expect(tip.y).toBeCloseTo(a.reach.y, 6)
    }
    // They do not pile onto each other.
    for (const a of DENDRITE_ASTROCYTES) {
      for (const b of DENDRITE_ASTROCYTES) {
        if (a === b) continue
        expect(Math.hypot(a.soma.x - b.soma.x, a.soma.y - b.soma.y)).toBeGreaterThan(a.r * 2)
      }
    }
  })
})

describe('the synapse stands the way the release view draws it (2026-09-04)', () => {
  // A3: "the vesicle release view is horizontally aligned, whereas the acting
  // connection on the whole neuron view is vertical". The scene now stands
  // that way, so the camera has nothing left to rotate.
  it('A3: the cleft lies ACROSS, with the target under the terminal', () => {
    // The axis is vertical to within a pixel — not "roughly downward".
    expect(Math.abs(OUTGOING.tip.x - OUTGOING.bouton.x)).toBeLessThan(1)
    expect(OUTGOING.tip.y - OUTGOING.bouton.y).toBeCloseTo(CLEFT + BOUTON_R, 6)
    // And the cell that receives it stands under the arbor, not beside it.
    expect(OUTPUT.soma.y).toBeGreaterThan(Math.max(...TERMINALS.map((t) => t.end.y)))
    expect(OUTPUT.soma.y + OUTPUT.somaR).toBeLessThan(STAGE_H)
  })

  it('A3: neither synapse framing turns the camera any more', () => {
    for (const id of ['outgoing-synapse', 'active-zone']) {
      const t = ZOOM_TARGETS.find((z) => z.id === id)!
      expect(t.turn ?? 0, id).toBeCloseTo(0, 9)
    }
  })

  it('A3: the target listens to the arbor’s LOWEST endings, left to right', () => {
    const listened = OUTPUT.dendrites.map((d) => d.fromTerminal)
    const lowestThree = TERMINALS.map((t, ti) => ({ ti, y: t.end.y }))
      .sort((a, b) => b.y - a.y)
      .slice(0, 3)
      .map((e) => e.ti)
    expect([...listened].sort()).toEqual([...lowestThree].sort())
    // Index 1 is the app-wide literal for the outgoing synapse, and it is the
    // one the target actually stands nearest.
    const d = (ti: number) =>
      Math.hypot(TERMINALS[ti].end.x - OUTPUT.soma.x, TERMINALS[ti].end.y - OUTPUT.soma.y)
    for (const ti of listened) expect(d(listened[1])).toBeLessThanOrEqual(d(ti) + 1e-9)
    // Its dendrites are stretched, not redrawn: none is wildly out of scale
    // with the cell it belongs to.
    for (const stub of OUTPUT.dendrites) {
      expect(pathLength(stub.path)).toBeLessThan(OUTPUT.somaR * 5)
    }
  })

  it('A3: the postsynaptic cell is ON the miniature’s sheet', () => {
    // It is an actor in this demo, so the map has to have room for it.
    const b = NEURON_MAP_BOX
    expect(OUTPUT.soma.x).toBeGreaterThan(b.minX)
    expect(OUTPUT.soma.x).toBeLessThan(b.minX + b.width)
    expect(OUTPUT.soma.y).toBeGreaterThan(b.minY)
    expect(OUTPUT.soma.y).toBeLessThan(b.minY + b.height)
    for (const stub of OUTPUT.dendrites) {
      expect(stub.to.y).toBeGreaterThan(b.minY)
      expect(stub.to.y).toBeLessThan(b.minY + b.height)
    }
  })
})

describe('every cell body carries a nucleus (2026-09-04)', () => {
  // A4: "draw nucleus in astrocytes too". One decision, asked by the canvas
  // and by the miniature, so the two cannot drift.
  it('A4: an astrocyte’s nucleus sits at its centre, inside even the valleys', () => {
    for (const a of [...ASTROCYTES, ...DENDRITE_ASTROCYTES, ...MAP_ASTROCYTES]) {
      const n = astroNucleus(a)
      expect(n.at).toEqual(a.soma)
      // A nucleus, not a filled soma: a real proportion of the body.
      expect(n.r).toBeGreaterThan(a.r * 0.15)
      expect(n.r).toBeLessThan(a.r * 0.45)
      // ⚠ It must fit inside the star's VALLEYS, not merely inside its
      // points — the body is only ~0.6 r where the outline dips, and a
      // nucleus poking out through a valley is not inside the cell.
      const soma = astroShape(a).soma
      const valley = Math.min(...soma.map((p) => Math.hypot(p.x - a.soma.x, p.y - a.soma.y)))
      expect(n.r).toBeLessThan(valley)
    }
  })
})
