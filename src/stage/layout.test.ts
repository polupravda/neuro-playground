import { describe, expect, it } from 'vitest'
import {
  AXON_DIAMETER_UM,
  MEMBRANE_THICKNESS_UM,
  SOMA_DIAMETER_UM,
} from '../core/membrane'
import {
  AXON_POLYLINE,
  AXON_SIGNAL_T,
  AXON_SIGNAL_TURN,
  AXON_VIEW_SCALE,
  AXON_W,
  ARRIVE_DECADES,
  BILAYER_SCALE,
  arrivalAt,
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
  MAX_PATCH_TILT,
  patchTurnAngle,
  polylinePoint,
  wallSample,
  type Pt,
  litTrunks,
  INPUTS,
  SYNAPSE_TRUNKS,
} from './layout'

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
    const target = ZOOM_TARGETS.find((t) => t.id === 'axon-membrane')!
    let nearest = Infinity
    for (let i = 0; i <= 200; i++) {
      const p = polylinePoint(AXON_POLYLINE, i / 200)
      nearest = Math.min(nearest, Math.hypot(p.x - target.center.x, p.y - target.center.y))
    }
    expect(nearest).toBeCloseTo(AXON_W / 2, 1)
  })

  it('only claims built content for the membrane targets', () => {
    const built = ZOOM_TARGETS.filter((t) => t.content).map((t) => t.id)
    expect(built).toEqual(['dendrite-membrane', 'axon-membrane'])
  })

  it('gives every target its own id', () => {
    expect(new Set(ZOOM_TARGETS.map((t) => t.id)).size).toBe(ZOOM_TARGETS.length)
  })

  it('puts the propagation marker ON the axon', () => {
    // The whole reason it is a marker rather than a word in a list: "which part
    // of a neuron is this?" is a question a ring in the right place answers and
    // the word "axon" does not.
    const signal = ZOOM_TARGETS.filter((t) => t.presents === 'axon')
    expect(signal.map((t) => t.id)).toEqual(['axon-signal'])
    let nearest = Infinity
    for (let i = 0; i <= 200; i++) {
      const p = polylinePoint(AXON_POLYLINE, i / 200)
      nearest = Math.min(nearest, Math.hypot(p.x - signal[0].center.x, p.y - signal[0].center.y))
    }
    expect(nearest).toBeLessThan(1)
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

  it('knows which targets put up a view of their own', () => {
    const own = ZOOM_TARGETS.filter(isOwnView).map((t) => t.id)
    // An "own view" is one that replaces the scene rather than magnifying it. The
    // synapse was on this list and has come off it again: its view was removed to be
    // redesigned, and it is a marker with a promise on it once more.
    expect(own).toEqual(['dendrite-membrane', 'axon-membrane', 'axon-signal'])
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
    const gentle = framed.find(
      (t) => Math.abs(patchTurnAngle(t.frame!)) < 1e-9,
    )
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
    // early: still a bilayer, and the axon view is nowhere
    expect(seen(0.3)).toBeGreaterThan(BILAYER_SCALE)
    expect(arrivalAt(seen(0.3), AXON_VIEW_SCALE)).toBe(0)
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
