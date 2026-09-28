import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  HEAD_R,
  HEAD_GAP,
  TAIL_LEN,
  HALF_MEM,
  MID_SEAM,
  PX_PER_NM,
  lipidJiggle,
  paveMembrane,
} from './bilayer'
import { LIPID_HEAD_NM, LIPID_SPACING_NM, MEMBRANE_THICKNESS_NM } from '../core/membrane'

// The phospholipid's proportions, pinned to the measured bilayer they came
// from. They were once chosen by eye and were badly out — the head took 73% of
// a leaflet where a real one takes ~38%, and the molecules stood two and a
// half times too far apart. Numbers here are for a fluid phosphatidylcholine
// bilayer: hydrocarbon core ~14.6 Å per leaflet, headgroup region ~9 Å, area
// per lipid ~65 Å².

describe('the phospholipid, against the real thing', () => {
  it('spends most of a leaflet on TAILS, as a real one does', () => {
    const headShare = (2 * HEAD_R) / HALF_MEM
    // Real: 9 Å of 23.6 Å ≈ 38%.
    expect(headShare).toBeGreaterThan(0.3)
    expect(headShare).toBeLessThan(0.45)
    // And the tails are the longer half, by roughly the measured ratio (1.6:1).
    expect(TAIL_LEN / (2 * HEAD_R)).toBeGreaterThan(1.2)
  })

  it('packs its molecules shoulder to shoulder, at the measured spacing', () => {
    // Spacing slightly LESS than a head is wide — which is why a real membrane
    // has no persistent gaps between molecules.
    expect(HEAD_GAP).toBeLessThan(2 * HEAD_R)
    expect(HEAD_GAP).toBeGreaterThan(2 * HEAD_R * 0.7)
    expect(HEAD_GAP / PX_PER_NM).toBeCloseTo(LIPID_SPACING_NM, 6)
  })

  it('derives every length from a declared measurement, not from taste', () => {
    expect(2 * HALF_MEM).toBeCloseTo(MEMBRANE_THICKNESS_NM * PX_PER_NM, 6)
    expect(2 * HEAD_R).toBeCloseTo(LIPID_HEAD_NM * PX_PER_NM, 6)
    expect(HEAD_R + TAIL_LEN).toBeCloseTo(HALF_MEM, 6)
  })

  it('leaves a seam at the midplane — neither an overlap nor a passable gap', () => {
    // The leaflets meet, but the terminal methyls are the least ordered,
    // lowest-density part of the wall: a real electron-density profile has a
    // trough exactly there.
    expect(MID_SEAM).toBeGreaterThan(0)
    const seamPx = 2 * MID_SEAM * HEAD_R
    expect(seamPx).toBeLessThan(HALF_MEM * 0.1)
  })
})

// ⚠ THE `drawGatedChannel` TESTS WENT WITH THE DRAWING (2026-08-30).
//
// They pinned a generic lobed silhouette that no longer exists: every caller
// now draws the protein it actually means, and each of those has its own
// tests. Keeping these would have been a suite defending a shape nothing
// renders — which is worse than no test, because it reads as coverage.

import { ZONE_LIPID } from './synapseScene'
import { POOL_LIPID } from './poolsScene'

/** The furthest a packed head is pushed across its wall, over a long run. */
const reach = (headR: number): number => {
  let w = 0
  for (let k = 0; k < 600; k++) {
    for (let ms = 0; ms < 6000; ms += 137) {
      const j = lipidJiggle(k, ms, false, headR)
      w = Math.max(w, Math.hypot(j.dx, j.dy))
    }
  }
  return w
}

describe('the bilayer’s thermal jiggle', () => {
  it('A1 (21c-38): a molecule wanders by a FRACTION OF ITSELF, not by a pixel count', () => {
    // ⚠ THE FAULT (user: "lipids are grouped, overlapping on z-direction").
    // The amplitude was an absolute 0.9px, tuned by eye in the lipid lab where a
    // head is 2.84px across the radius — 0.32 head radii, which reads as a
    // liquid. The synapse view paves with the same molecule at a third the size,
    // where 0.9px is 0.9 head radii: heads climbing over each other.
    //
    // These drawings are used at magnifications thousands apart, so a part's
    // size is a fraction of what it belongs to — the lesson the charge badges
    // cost once already.
    const lab = reach(HEAD_R) / HEAD_R
    const synapse = reach(ZONE_LIPID.headR) / ZONE_LIPID.headR
    const pools = reach(POOL_LIPID.headR) / POOL_LIPID.headR
    for (const [name, got] of [['synapse', synapse], ['pools', pools]] as const) {
      expect(
        got,
        `${name} wanders ${got.toFixed(2)} head radii against the lipid lab's ${lab.toFixed(2)}`,
      ).toBeCloseTo(lab, 6)
    }
    // …and it really does move: a guard on equality alone would pass on zero.
    expect(lab, 'nothing jiggles at all').toBeGreaterThan(0.2)
    expect(lab, 'the wall is boiling').toBeLessThan(0.6)
  })

  it('A1: the lipid lab itself is untouched by the change', () => {
    // The fractions were calibrated to leave the view they were tuned in
    // byte-identical — so the fix cannot have quietly restyled D01.
    for (const free of [false, true]) {
      for (const [i, ms] of [[0, 0], [7, 900], [31, 2500]] as const) {
        const now = lipidJiggle(i, ms, free, HEAD_R)
        const before = { a: free ? 1.2 : 0.9, p: i * 2.399 }
        expect(now.dx).toBeCloseTo(before.a * Math.sin(ms * 0.0016 + before.p), 9)
        expect(now.dy).toBeCloseTo(before.a * Math.sin(ms * 0.0013 + before.p * 1.7), 9)
      }
    }
  })

  it('A1: a free lipid still tumbles more than a packed one', () => {
    expect(reach(HEAD_R) > 0).toBe(true)
    const free = (() => {
      let w = 0
      for (let k = 0; k < 600; k++) {
        for (let ms = 0; ms < 6000; ms += 137) {
          const j = lipidJiggle(k, ms, true, HEAD_R)
          w = Math.max(w, Math.hypot(j.dx, j.dy))
        }
      }
      return w
    })()
    expect(free, 'a free lipid is no livelier than one in a wall')
      .toBeGreaterThan(reach(HEAD_R) * 1.2)
  })
})

describe('and the paver hands its own molecule’s size down', () => {
  /** How far the drawn heads scatter across a straight wall, in head radii. */
  const scatterOf = (geom: { headR: number; halfMem: number }): number => {
    const samples = Array.from({ length: 60 }, (_, i) => ({
      at: { x: i * geom.headR * 2, y: 500 },
      tangent: { x: 1, y: 0 },
      inward: { x: 0, y: 1 },
    }))
    let lo = Infinity
    let hi = -Infinity
    for (const ms of [0, 400, 1100, 2300]) {
      const c = strictCanvas()
      paveMembrane(c.ctx, samples, { geom, first: 0, ms, taperOver: 0 })
      // the OUTER leaflet's ink only, so the two rows are not read as spread
      for (const p of c.points.filter((q) => q.y < 500 - geom.halfMem * 0.5)) {
        lo = Math.min(lo, p.y)
        hi = Math.max(hi, p.y)
      }
    }
    return (hi - lo) / geom.headR
  }

  it('A1 (21c-38): the DRAWN scatter is the same fraction at every scale', () => {
    // ⚠ Guarding `lipidJiggle` alone was not enough — a first version passed
    // with the paver no longer handing `geom.headR` down at all, because the
    // guard never went through the paver. This measures the ink.
    const big = scatterOf({ headR: HEAD_R, halfMem: HALF_MEM })
    const small = scatterOf({ headR: HEAD_R / 3, halfMem: HALF_MEM / 3 })
    expect(big, 'nothing was drawn').toBeGreaterThan(0)
    expect(
      small,
      `a third-size molecule scatters ${small.toFixed(2)} head radii against ${big.toFixed(2)}`,
    ).toBeCloseTo(big, 2)
  })
})

describe('a paved wall stays PACKED, however lively it looks', () => {
  /** The worst gap that ever opens between two neighbouring heads. */
  const worstGap = (headR: number, halfMem: number, pitch: number): number => {
    const geom = { headR, halfMem }
    const samples = Array.from({ length: 70 }, (_, i) => ({
      at: { x: 100 + i * pitch, y: 400 },
      tangent: { x: 1, y: 0 },
      inward: { x: 0, y: 1 },
    }))
    let worst = -Infinity
    for (const ms of [0, 350, 900, 1700, 2600, 4100]) {
      const c = strictCanvas()
      paveMembrane(c.ctx, samples, { geom, first: 0, ms, taperOver: 0 })
      const xs = c.points
        .filter((p) => p.y < 400 - halfMem * 0.4 && p.y > 400 - halfMem * 1.6)
        .map((p) => p.x)
        .sort((a, b) => a - b)
      for (let i = 1; i < xs.length; i++) {
        const d = xs[i] - xs[i - 1]
        if (d > 0.01 && d < pitch * 4) worst = Math.max(worst, d - 2 * headR)
      }
    }
    return worst
  }

  it('A2 (21c-42): the heads NEVER part — a bilayer conserves its area per lipid', () => {
    // ⚠ (user, 2026-09-12: "make the layer more dense, so that the gaps between
    // lipid heads are not so big".) The packing already had them OVERLAPPING by
    // 0.38 — and the wander still pulled 10 pairs in 1195 apart, by up to 0.286.
    //
    // A fluid bilayer's molecules slide PAST each other; they do not
    // decompress. So the sliding is bounded by the packing's own slack, and the
    // row can never open however lively it looks.
    const gap = worstGap(ZONE_LIPID.headR, ZONE_LIPID.halfMem, 1.62)
    expect(gap, `the widest gap between heads is ${gap.toFixed(3)}`).toBeLessThanOrEqual(0)
  })

  it('A2: …at a loose packing too, where there is no slack to spend', () => {
    // A wall packed at more than a head's width apart has no slack at all, so
    // it gets no SLIDING — the honest answer, not a limitation.
    //
    // ⚠ The allowance is not slop: a lipid also TURNS on the spot, and a head
    // sits off the molecule's centre, so a rotation moves it a little along the
    // wall as well. Measured at 0.124 against a nominal 0.115 — a fortieth of a
    // head. Unbounded sliding puts it at 1.636, so the bound still bites.
    const headR = POOL_LIPID.headR
    const nominal = headR * 2.05 - 2 * headR
    const gap = worstGap(headR, POOL_LIPID.halfMem, headR * 2.05)
    expect(gap, `a loose wall opened ${gap.toFixed(3)} against a nominal ${nominal.toFixed(3)}`)
      .toBeLessThanOrEqual(nominal + headR * 0.15)
  })

  it('A2: and they still BOB across the wall — the fix is not a freeze', () => {
    const geom = { headR: ZONE_LIPID.headR, halfMem: ZONE_LIPID.halfMem }
    const samples = Array.from({ length: 40 }, (_, i) => ({
      at: { x: 100 + i * 1.62, y: 400 },
      tangent: { x: 1, y: 0 },
      inward: { x: 0, y: 1 },
    }))
    let lo = Infinity
    let hi = -Infinity
    for (const ms of [0, 400, 1100, 2300]) {
      const c = strictCanvas()
      paveMembrane(c.ctx, samples, { geom, first: 0, ms, taperOver: 0 })
      for (const p of c.points.filter((q) => q.y < 400 - geom.halfMem * 0.4)) {
        lo = Math.min(lo, p.y)
        hi = Math.max(hi, p.y)
      }
    }
    expect(hi - lo, 'the wall went rigid').toBeGreaterThan(geom.headR)
  })
})
