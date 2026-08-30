import { describe, expect, it } from 'vitest'
import { VM_MAX, VM_MIN } from '../core/voltage'
import { ION_KINDS, IONS, particlesFor } from '../core/ions'
import type { IonCounts } from '../state/ionStore'
import { TRAIN_WINDOW_MS } from '../core/spikeTrain'
import {
  GUTTER,
  guideMv,
  insetBox,
  electrodeHit,
  electrodeHitAt,
  litPoints,
  traceColour,
  trainGeometry,
  xAtMs,
  yAtMv,
} from './trainGraph'
import { NEURON_MAP_BOX, ZOOM_TARGETS, regionOfZoom, regionPoints } from './layout'

const real: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

const geo = trainGeometry(600, 240)

describe('the graph face', () => {
  it('leaves room for its own labels', () => {
    expect(geo.left).toBe(GUTTER)
    expect(geo.right).toBeLessThan(600)
    expect(geo.marksY).toBeGreaterThan(geo.bottom)
    expect(geo.marksY).toBeLessThan(240)
  })

  it('puts NOW at the right edge and one window ago at the left', () => {
    expect(xAtMs(geo, 100, 100)).toBeCloseTo(geo.right)
    expect(xAtMs(geo, 100, 100 - TRAIN_WINDOW_MS)).toBeCloseTo(geo.left)
  })

  it('runs time forwards and voltage upwards', () => {
    expect(xAtMs(geo, 100, 90)).toBeLessThan(xAtMs(geo, 100, 95))
    expect(yAtMv(geo, 40)).toBeLessThan(yAtMv(geo, -70))
  })

  it('keeps the line inside the box at any voltage', () => {
    for (const mv of [VM_MIN - 500, VM_MIN, 0, VM_MAX, VM_MAX + 500]) {
      expect(yAtMv(geo, mv)).toBeGreaterThanOrEqual(geo.top - 0.01)
      expect(yAtMv(geo, mv)).toBeLessThanOrEqual(geo.bottom + 0.01)
    }
  })

  it('draws the zero line, because crossing it is what this app calls a spike', () => {
    expect(guideMv(-72).map((g) => g.key)).toContain('zero')
  })

  it('colours the trace by the app’s own three states', () => {
    // Grey at rest, red above it, blue below — the same reading as the colour
    // field over the cytoplasm on the canvas, through the same function.
    const rest = -72
    const at = (mv: number) => traceColour(mv, rest, real).match(/\d+/g)!.map(Number)
    const [r0, g0, b0] = at(rest)
    expect(Math.abs(r0 - g0)).toBeLessThan(20)
    expect(Math.abs(g0 - b0)).toBeLessThan(30)
    const up = at(30)
    expect(up[0]).toBeGreaterThan(up[2])
    const down = at(-90)
    expect(down[2]).toBeGreaterThan(down[0])
  })
})

describe('the cell in the corner', () => {
  it('fits inside its own panel at any shape of it', () => {
    // Its own panel rather than a corner of the graph: every spike SCROLLS, and
    // three seconds after being drawn it passes through the corner an inset would
    // have occupied.
    for (const [w, h] of [[140, 64], [80, 60], [200, 40], [60, 200], [4, 4]]) {
      const box = insetBox(w, h)
      expect(box.x).toBeGreaterThanOrEqual(-0.01)
      expect(box.y).toBeGreaterThanOrEqual(-0.01)
      expect(box.x + box.w).toBeLessThanOrEqual(w + 0.01)
      expect(box.y + box.h).toBeLessThanOrEqual(h + 0.01)
    }
  })

  it('keeps the cell’s own shape', () => {
    const box = insetBox(140, 64)
    expect(box.w / box.h).toBeCloseTo(NEURON_MAP_BOX.width / NEURON_MAP_BOX.height, 5)
  })

  it('never lets the ring fall outside the picture, wherever the camera is', () => {
    // The same guarantee the column's map gives, and for the same reason: a "you
    // are here" mark drawn off the edge of the map is worse than none.
    for (const target of ZOOM_TARGETS) {
      expect(target.center.x).toBeGreaterThanOrEqual(NEURON_MAP_BOX.minX)
      expect(target.center.x).toBeLessThanOrEqual(NEURON_MAP_BOX.minX + NEURON_MAP_BOX.width)
      expect(target.center.y).toBeGreaterThanOrEqual(NEURON_MAP_BOX.minY)
      expect(target.center.y).toBeLessThanOrEqual(NEURON_MAP_BOX.minY + NEURON_MAP_BOX.height)
    }
  })

  it('has somewhere to put a glow for every region a patch can be', () => {
    for (const id of [...ZOOM_TARGETS.map((t) => t.id), null]) {
      const region = regionOfZoom(id)
      if (region) expect(regionPoints(region).length).toBeGreaterThan(0)
    }
    // And the membrane patches — the only places the bench is reachable from —
    // must all name a region, or the inset would draw a cell that never lights.
    expect(regionOfZoom('axon-membrane')).toBe('axon')
    expect(regionOfZoom('dendrite-membrane')).toBe('dendrites')
  })
})

describe('the clamped spot', () => {
  it('always lights, wherever the electrode is', () => {
    // The bug (user, 2026-08-28): the electrode is drawn at the zoom target's
    // own point and the glow was drawn at regionPoints(), which are different
    // places. For the dendrites the numbers are exact and damning — the clamp
    // sits on TRUNK 1 at t = 0.3, and the lit set was trunks 2, 3 and 4 at
    // t = 0.45. The electrode's own branch was the one branch guaranteed to
    // stay dark while every other one lit up.
    const clamp = { x: 0.21, y: 0.34 }
    for (const region of ['dendrites', 'soma', 'hillock', 'axon', 'terminals'] as const) {
      const spots = litPoints(region, clamp)
      expect(spots[0]).toEqual(clamp)
      expect(spots.length).toBeGreaterThanOrEqual(regionPoints(region).length)
    }
  })

  it('lights on its own where the zoom is not a firing region', () => {
    // A synapse zoom has no region, and the clamped spot still has to light:
    // the trace beside it is a recording of THAT spot.
    const clamp = { x: 0.4, y: 0.6 }
    expect(litPoints(null, clamp)).toEqual([clamp])
  })

  it('does not draw the same spot twice', () => {
    const [only] = regionPoints('soma')
    const spots = litPoints('soma', only)
    expect(spots).toHaveLength(1)
  })

  it('lights the region alone when nothing is clamped', () => {
    expect(litPoints('axon', null)).toEqual(regionPoints('axon'))
    expect(litPoints(null, null)).toEqual([])
  })
})

describe('the electrode is a door', () => {
  it('has a hit box on the probe, only where there is a probe', () => {
    const box = insetBox(300, 136)
    expect(electrodeHit(box, null)).toBeNull()
    const at = { x: 0.3, y: 0.4 }
    const h = electrodeHit(box, at)
    expect(h).not.toBeNull()
    expect(h!.w).toBeGreaterThan(12)
    expect(h!.h).toBeGreaterThan(12)
    // The tip and the shaft's far end are both inside it.
    expect(electrodeHitAt(box, at, h!.x + h!.w / 2, h!.y + h!.h / 2)).toBe(true)
    // …and somewhere else on the cell is not.
    expect(electrodeHitAt(box, at, h!.x - 40, h!.y + h!.h + 40)).toBe(false)
  })
})
