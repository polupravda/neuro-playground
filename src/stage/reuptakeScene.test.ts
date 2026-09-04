import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { DOTS, dotAt, reuptakeStageAt } from '../core/reuptake'
import {
  FARE_AT,
  GLUTAMINE_INK,
  doorAt,
  dotPoint,
  dotWaypoints,
  drawReuptake,
  fareAt,
  neuronDoor,
  reuptakeGeometry,
  reuptakeLabels,
} from './reuptakeScene'
import {
  CLEFT_PX,
  TRANSMITTER_INK,
  astrocyteFinger,
  astrocyteHolds,
  synapseGeometry,
  wallAt,
} from './synapseScene'

const W = 1060
const H = 660
const g = reuptakeGeometry(W, H)
const sweep = (n = 241) => Array.from({ length: n }, (_, i) => i / (n - 1))

describe('D17 opens on the picture the child already knows', () => {
  // A2 (user, 2026-09-04): "not kids-friendly, is torn out of context… reuse
  // the visuals kid already knows". The rebuild's whole claim is that this is
  // the SAME synapse, not a new diagram — so that is what is guarded.
  it('A2: it is the synapse view’s own geometry, not a second one', () => {
    const syn = synapseGeometry(W, H)
    expect(g.syn.foot).toEqual(syn.foot)
    expect(g.syn.activeHalf).toBe(syn.activeHalf)
    expect(g.syn.head).toEqual(syn.head)
    expect(g.syn.shaftTop).toBe(syn.shaftTop)
  })

  it('A2: the astrocyte is at BOTH mouths of the gap, where the child met it', () => {
    expect(g.fingers.map((f) => f.side).sort()).toEqual([-1, 1])
    for (const f of g.fingers) {
      const own = astrocyteFinger(g.syn, f.side)
      expect(f.tip).toEqual(own.tip)
      // On the correct flank of the terminal, not floating.
      expect(Math.sign(f.tip.x - g.syn.foot.x)).toBe(f.side)
    }
  })

  it('A2: every transporter sits ON a finger — the thing it belongs to', () => {
    for (const f of g.fingers) {
      const finger = astrocyteFinger(g.syn, f.side)
      for (let i = 0; i < 3; i++) {
        expect(astrocyteHolds(finger, doorAt(g, f.side, i))).toBe(true)
      }
    }
    // And the minority door is on the TERMINAL's own wall, not in the gap.
    const nd = neuronDoor(g)
    expect(nd.y).toBeCloseTo(wallAt(g.syn, nd.x), 6)
  })

  it('A2: both enzymes are inside a cell, never in the gap', () => {
    // The astrocyte's, inside the finger the child can point at.
    expect(astrocyteHolds(astrocyteFinger(g.syn, 1), g.synthetase)).toBe(true)
    // The terminal's, above its wall — inside the neuron.
    expect(g.glutaminase.y).toBeLessThan(wallAt(g.syn, g.glutaminase.x))
    expect(g.stock.y).toBeLessThan(wallAt(g.syn, g.stock.x))
  })
})

describe('D17 — the journey, in a place the child can name', () => {
  it('A8: every molecule starts in the gap and ends in the terminal’s store', () => {
    const cleftY = wallAt(g.syn, g.syn.foot.x) + CLEFT_PX * 0.5
    for (const dot of DOTS) {
      const pts = dotWaypoints(g, dot)
      expect(pts[0].y).toBeCloseTo(cleftY, 6)
      expect(pts[pts.length - 1]).toEqual(g.stock)
    }
  })

  it('A8: the astrocyte’s route goes through a finger door and past its enzyme', () => {
    for (const dot of DOTS) {
      const pts = dotWaypoints(g, dot)
      if (dot.route === 'astrocyte') {
        const side = dot.id % 2 === 0 ? 1 : -1
        expect(pts[1]).toEqual(doorAt(g, side, dot.door))
        expect(pts).toContainEqual(g.synthetase)
      } else {
        expect(pts[1]).toEqual(neuronDoor(g))
        // The minor route never meets an enzyme: it is already the right
        // molecule.
        expect(pts).not.toContainEqual(g.synthetase)
        expect(pts).not.toContainEqual(g.glutaminase)
      }
    }
  })

  it('A8: nothing teleports — every dot moves in small steps all run', () => {
    const span = Math.hypot(W, H)
    for (const dot of DOTS) {
      const path = sweep().map((u) => dotPoint(g, dot, u))
      for (let i = 1; i < path.length; i++) {
        const step = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
        expect(step).toBeLessThan(span * 0.2)
      }
    }
  })

  it('A8: glutamine never appears IN THE GAP — the cleft holds transmitter only', () => {
    // A molecule that had changed kind while still in the gap would teach that
    // the transmitter converts on its own, with no cell and no enzyme.
    const wallY = wallAt(g.syn, g.syn.foot.x)
    const inCleft = (p: { x: number; y: number }) =>
      p.y > wallY &&
      p.y < wallY + CLEFT_PX * 1.2 &&
      Math.abs(p.x - g.syn.foot.x) < g.syn.activeHalf * 1.2
    for (const dot of DOTS) {
      for (const u of sweep()) {
        if (dotAt(dot, u).species !== 'glutamine') continue
        expect(inCleft(dotPoint(g, dot, u))).toBe(false)
      }
    }
  })

  it('A8: the gap really does start full of transmitter', () => {
    for (const dot of DOTS) expect(dotAt(dot, 0).species).toBe('glutamate')
  })

  it('A8: the fare is drawn ONCE, inside the catching leg', () => {
    expect(fareAt(0)).toBe(0)
    expect(fareAt(1)).toBe(0)
    expect(fareAt(FARE_AT)).toBeCloseTo(1, 6)
    expect(reuptakeStageAt(FARE_AT).stage.id).toBe('caught')
    const lit = sweep(801).filter((u) => fareAt(u) > 0.01).length
    expect(lit / 801).toBeLessThan(0.2)
  })

  it('A8: glutamine is NOT the transmitter’s ink — a change of kind must show', () => {
    expect(GLUTAMINE_INK.mid).not.toBe(TRANSMITTER_INK.mid)
    expect(GLUTAMINE_INK.light).not.toBe(TRANSMITTER_INK.light)
  })
})

describe('D17 draws, and says where you are', () => {
  it('A8: no unparseable colour and no non-finite number, at any moment', () => {
    for (const u of [0, 0.2, FARE_AT, 0.5, 0.8, 1]) {
      const c = strictCanvas()
      expect(() => drawReuptake(c.ctx, { width: W, height: H, u })).not.toThrow()
    }
  })

  it('A2: it names the astrocyte and BOTH neurons, at every moment', () => {
    // The rebuild's own reason for existing: "where is astrocyte? where is
    // neuron?" must be answered by the picture, not by the info block, and
    // not only at one point in the run.
    for (const u of [0, 0.3, 0.6, 1]) {
      const said = reuptakeLabels(g, u).map((l) => l.term)
      expect(said).toContain('astrocyte')
      expect(said).toContain('axon terminal')
      expect(said).toContain('dendritic spine')
    }
  })

  it('A2: every name is tied to something, and has a box to tap', () => {
    for (const u of [0.05, 0.3, 0.6, 0.95]) {
      const labels = reuptakeLabels(g, u)
      expect(labels.length).toBeGreaterThan(3)
      for (const l of labels) {
        expect(l.w).toBeGreaterThan(0)
        expect(l.h).toBeGreaterThan(0)
      }
    }
  })

  it('A8: the labels switch hides the names and leaves the picture', () => {
    const on = strictCanvas()
    drawReuptake(on.ctx, { width: W, height: H, u: 0.1, labelsOn: true })
    const off = strictCanvas()
    drawReuptake(off.ctx, { width: W, height: H, u: 0.1, labelsOn: false })
    expect(on.texts.length).toBeGreaterThan(0)
    expect(off.texts).toEqual([])
    expect(off.calls.length).toBeGreaterThan(on.calls.length * 0.5)
  })
})
