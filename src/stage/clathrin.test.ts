import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  CLATHRIN_INK,
  coatSettleAt,
  coatSettleFrom,
  coatFlyAt,
  coatOrder,
  dynaminRx,
  CLATHRIN_LIGHT,
  DYNAMIN_INK,
  DYNAMIN_TURNS,
  drawDynamin,
  drawTriskelion,
  triskelionLegs,
} from './clathrin'
import {
  PANEL_H,
  PANEL_MS,
  PANEL_W,
  bubblesAt,
  clathrinBuildAt,
  clathrinNeckAt,
  clathrinStubsAt,
  NECK_CUT,
  NECK_STUB_MS,
  clathrinPullAt,
  coatPiecesAt,
  coatAt,
  collarAt,
  drawPanel,
  panelGeometry,
  wallOpenAt,
} from './retrievalScene'
import { drawSnare2, snareDynaminAt, snareGeometry } from './snareScene'
import { STAGE_SPANS } from '../core/vesicleCycle'
import { ION_KINDS, IONS, particlesFor } from '../core/ions'
import type { IonCounts } from '../state/ionStore'
import { synapseRun } from '../core/synapse'
import { cleftRun } from '../core/cleft'

const counts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)
const run = synapseRun(counts, true)
const cleft = cleftRun(run)
void run
void cleft

const at = (id: string) => {
  const s = STAGE_SPANS.find((x) => x.id === id)!
  return (s.from + s.to) / 2
}

describe('21c-10 — clathrin & dynamin, one drawing across the app', () => {
  it('A1: a triskelion is THREE legs from one hub, bent, all curling one way', () => {
    // ⚠ The handover's panel A: a pinwheel, not a star and not a stud. Asked of
    // the geometry, not the ink.
    const legs = triskelionLegs(10, 0.3)
    expect(legs.length).toBe(3)
    for (const [hub, knee, foot] of legs) {
      expect(hub).toEqual({ x: 0, y: 0 })
      // BENT: the knee is measurably off the hub→foot chord.
      const chord = Math.hypot(foot.x, foot.y)
      const cross = knee.x * foot.y - knee.y * foot.x
      expect(Math.abs(cross) / chord, 'a leg is straight').toBeGreaterThan(1)
      // …and the same chirality on every leg: the foot swings the same way
      // past its knee, which is what makes a pinwheel.
      expect(Math.sign(knee.x * foot.y - knee.y * foot.x)).toBe(
        Math.sign(legs[0][1].x * legs[0][2].y - legs[0][1].y * legs[0][2].x),
      )
    }
    // Drawn: heavy chains in the coat's ink, light chains in the family's
    // lighter tone — never the handover's orange, which is rab's and SNAT's.
    const c = strictCanvas()
    drawTriskelion(c.ctx, { x: 50, y: 50 }, 10, 0, 1)
    expect(c.styles).toContain(CLATHRIN_INK)
    expect(c.styles).toContain(CLATHRIN_LIGHT)
  })

  it('A1: dynamin is a COIL of turns, in its OWN ink — not NSF’s', () => {
    // ⚠ The bar it replaces wore #c026d3, which is NSF's fuchsia exactly — two
    // machines, one colour. And the handover draws a spring, not a bar.
    expect(DYNAMIN_INK).not.toBe('#c026d3')
    expect(DYNAMIN_TURNS).toBeGreaterThanOrEqual(3)
    const c = strictCanvas()
    drawDynamin(c.ctx, { x: 60, y: 60 }, 12, 20, 0.5, 1)
    expect(c.styles).toContain(DYNAMIN_INK)
    expect(
      c.calls.filter((op) => op === 'ellipse').length,
      'the coil has no turns',
    ).toBeGreaterThanOrEqual(DYNAMIN_TURNS)
    // …and squeezing NARROWS it — that is the work it does. Asked of the
    // decision (`dynaminRx`), because the stand-in records no ellipse vertices.
    expect(dynaminRx(12, 1)).toBeLessThan(dynaminRx(12, 0) * 0.75)
  })

  it('A1 (21c-12): the coat PULLS, the membrane SNAPS after it, and bounces', () => {
    // ⚠ (user: "clathrin animates with pull up ease: it moves away with a
    // small gap → slows down → lipid ball 'snaps' towards it, bouncing".)
    // Two curves now: the coat leads, the membrane lags — and the claims are
    // the ratchet's own.
    const g = panelGeometry(PANEL_W, PANEL_H)
    const dock = g.wallY - g.r
    const flat = g.wallY + g.r
    let prevPull = 0
    let gapSeen = 0
    let rebounds = 0
    let prevBuild = 0
    for (let k = 0; k <= 400; k++) {
      const u = 0.38 + (k / 400) * 0.28
      const pull = clathrinPullAt(u)
      const build = clathrinBuildAt(u)
      // The coat LEADS — the membrane never overtakes the lattice pulling it —
      // and a ratchet never gives back.
      expect(pull, `the membrane overtook the coat at u=${u.toFixed(3)}`).toBeGreaterThanOrEqual(
        build - 1e-9,
      )
      expect(pull).toBeGreaterThanOrEqual(prevPull - 1e-12)
      prevPull = pull
      if (pull - build > 0.04) gapSeen++
      if (build < prevBuild - 1e-6) rebounds++
      prevBuild = build
      // …and the bud's drawn depth IS the membrane's curve, exactly.
      const b = bubblesAt(g, 'clathrin', u)[0]
      expect((flat - b.cy) / (flat - dock)).toBeCloseTo(build, 6)
      // The drawn coverage is the COAT's curve — the lattice the child counts
      // is the thing doing the pulling.
      expect(coatAt('clathrin', u)).toBeCloseTo(pull, 9)
    }
    // The gap really opens (the pull-away), and it really closes (both end
    // together)…
    expect(gapSeen, 'the coat never pulls away').toBeGreaterThan(20)
    expect(clathrinPullAt(0.66)).toBe(1)
    expect(clathrinBuildAt(0.66)).toBe(1)
    // …and the membrane REBOUNDS — at least one stretch where it moves back
    // down after hitting the lattice. (Not on the last pull: that rebound
    // dipped the bud's foot back through the wall — a measured 14 px twitch.)
    expect(rebounds, 'the membrane never bounces').toBeGreaterThan(3)
    // Stripping the basket must NOT push the freed bubble back into the wall.
    const end = bubblesAt(g, 'clathrin', 1)[0]
    expect(end.cy + end.r).toBeLessThan(g.wallY)
  })

  it('A1 (21c-12): the neck stands, narrows under the coil, and is CUT', () => {
    // ⚠ (user: "lipid ball creates a 'neck', which gets… tightened and cut by
    // dynamin".) Between the build and the cut the bud stands on a stalk: real
    // membrane, narrowing, gone at the cut — and the wall stays open exactly
    // neck-wide underneath it, because a crowd closed under a standing stalk is
    // a wall drawn through a membrane.
    const g = panelGeometry(PANEL_W, PANEL_H)
    expect(clathrinNeckAt(g, 0.5), 'a neck before the build is done').toBeNull()
    expect(clathrinNeckAt(g, 0.83), 'the neck survives the cut').toBeNull()
    const early = clathrinNeckAt(g, 0.68)
    const late = clathrinNeckAt(g, 0.8)
    expect(early).not.toBeNull()
    expect(late).not.toBeNull()
    expect(late!.baseHalf, 'the coil never tightens the neck').toBeLessThan(
      early!.baseHalf * 0.6,
    )
    expect(early!.topY, 'the neck has no height').toBeLessThan(g.wallY - 2)
    // The wall's opening tracks the neck while it stands…
    const open = wallOpenAt(g, 'clathrin', 0.75)
    const neck = clathrinNeckAt(g, 0.75)!
    expect(open.shift).toBeGreaterThanOrEqual(neck.baseHalf)
    // …and the coil squeezes over the same window the neck narrows in.
    expect(collarAt('clathrin', 0.75)).toBeGreaterThan(0.1)
    // ⚠ THE NECK IS TALL ENOUGH TO SEE (21c-13, user: "a more visible neck").
    // Its height is the bud's lift, and at 0.5r-late the stalk stood for barely
    // a beat. Once the pinch lift is done, the stalk spans most of a radius.
    const tall = clathrinNeckAt(g, 0.76)!
    expect(g.wallY - tall.topY, 'the neck is a sliver').toBeGreaterThan(g.r * 0.6)
    // ⚠ AND THE CUT HAS TWO ENDS: for a beat after it, the severed stubs recoil
    // — the lower toward the wall, the upper toward the freed bud — then gone.
    expect(clathrinStubsAt(g, 0.81), 'stubs before the cut').toBeNull()
    const s1 = clathrinStubsAt(g, 0.825)!
    const s2 = clathrinStubsAt(g, 0.85)!
    expect(s1).not.toBeNull()
    expect(s2).not.toBeNull()
    expect(s2.lowerTop, 'the lower stub never recoils').toBeGreaterThan(s1.lowerTop)
    expect(s2.upperBot, 'the upper stub never recoils').toBeLessThan(s1.upperBot)
    expect(s2.alpha).toBeLessThan(s1.alpha)
    expect(clathrinStubsAt(g, NECK_CUT + NECK_STUB_MS + 0.001), 'stubs that never die').toBeNull()
  })

  it('A1 (21c-14): the coat FLIES IN and sticks — it never fades', () => {
    // ⚠ (user: "clathrin currently fades in and becomes transparent
    // occasionally. Let it fly into the scene and 'stick' to the membrane".)
    // Every piece was an alpha ramp: pinwheels swelling out of nothing, and on
    // the way out going see-through where they stood. A protein arrives from
    // the cytosol and binds — it does not condense out of the air.
    const g = panelGeometry(PANEL_W, PANEL_H)
    // ⚠ THE CLAIM, ON THE INK: every mark the coat makes is at full strength,
    // at every moment of the run. Nothing else in this app can say a piece was
    // drawn as a ghost.
    for (let k = 0; k <= 60; k++) {
      const c = strictCanvas()
      drawPanel(c.ctx, { route: 'clathrin', u: k / 60, width: PANEL_W, height: PANEL_H, ms: 0 })
      c.inks.forEach((ink, i) => {
        if (ink.stroke !== CLATHRIN_INK && ink.stroke !== CLATHRIN_LIGHT) return
        expect(c.alphas[i], `a ghost triskelion at u=${(k / 60).toFixed(2)}`).toBeCloseTo(1, 6)
      })
    }
    // …and it really is a JOURNEY: a piece begins off the top of the frame and
    // ends on the bud's own face.
    let sawFlying = false
    for (let k = 0; k <= 200; k++) {
      for (const p of coatPiecesAt(g, 'clathrin', k / 200)) {
        if (p.landed < 0.35) sawFlying = true
      }
    }
    expect(sawFlying, 'no piece is ever caught in flight').toBe(true)
    // ⚠ IN FROM THE LEFT AND THE RIGHT (21c-15): a piece enters past the side
    // edge it belongs to, never over the top of the dome.
    let sawLeft = false
    let sawRight = false
    for (let k = 0; k <= 300; k++) {
      for (const p of coatPiecesAt(g, 'clathrin', k / 300)) {
        if (p.landed > 0.02) continue
        if (p.at.x <= g.left) sawLeft = true
        if (p.at.x >= g.right) sawRight = true
      }
    }
    expect(sawLeft, 'nothing ever enters from the left').toBe(true)
    expect(sawRight, 'nothing ever enters from the right').toBe(true)
  })

  it('A2 (21c-15): a piece on its way NEVER lurches — the two legs cannot fight', () => {
    // ⚠ (user: "more smooth movements (no jerky breaks)".) Both legs used to be
    // driven by the ratchet — `clathrinPullAt`, which starts each pull fast and
    // stops dead — so a piece halfway through its flight was already being
    // dragged toward its seat at the ratchet's speed. Measured then: 13.4 px in
    // one real frame. Both legs are eased windows in the RUN's clock now, with
    // zero speed at every end, and a piece is always WAITING before its space
    // opens. Measured after: 2.25.
    const g = panelGeometry(PANEL_W, PANEL_H)
    const step = 1000 / 60 / PANEL_MS
    let worst = 0
    let at = 0
    let prev = new Map<number, { x: number; y: number }>()
    for (let u = 0; u <= 1; u += step) {
      const now = new Map<number, { x: number; y: number }>()
      for (const p of coatPiecesAt(g, 'clathrin', u)) {
        // Only pieces still on their way: a SEATED piece rides the lattice, and
        // the lattice's snap is the thing this exhibit is about.
        if (p.landed < 0.99) now.set(p.k, { x: p.at.x, y: p.at.y })
      }
      for (const [k, p] of now) {
        const q = prev.get(k)
        if (!q) continue
        const d = Math.hypot(p.x - q.x, p.y - q.y)
        if (d > worst) {
          worst = d
          at = u
        }
      }
      prev = now
    }
    expect(worst, `a piece lurches at u=${at.toFixed(3)}`).toBeLessThan(4)
    // ⚠ AND IT WAITS: a piece finishes flying before its space opens, so the
    // approach and the settle never overlap — which is what made them fight.
    for (const k of [0, 3, 5, 8, 10]) {
      const order = coatOrder(k, 11)
      const opens = coatSettleFrom(order, 0.38, 0.28)
      expect(
        coatFlyAt(order, opens, 0.38, 0.28),
        `piece ${k} is still arriving when its space opens`,
      ).toBeCloseTo(1, 6)
    }
  })

  it('A1 (21c-14): the circle builds from the APEX toward the membrane', () => {
    // ⚠ (user: "build up a circle, by adding elements at the membrane side".)
    // A lattice nucleates and extends toward its edge, so each new piece is
    // added on the membrane side of the ones already there. Asked of the order
    // rule itself…
    expect(coatOrder(5, 11), 'the apex is not order 0').toBeCloseTo(0, 1)
    expect(coatOrder(0, 11)).toBeGreaterThan(0.8)
    expect(coatOrder(10, 11)).toBeGreaterThan(0.8)
    // The apex's space opens first; the rim's strictly later.
    expect(coatSettleFrom(0, 0.38, 0.28)).toBeLessThan(coatSettleFrom(1, 0.38, 0.28))
    expect(coatSettleAt(0, 0.42, 0.38, 0.28), 'the apex waits its turn').toBeGreaterThan(0)
    expect(coatSettleAt(1, 0.42, 0.38, 0.28), 'the rim settles before the apex').toBe(0)
    // …and of the picture: the coat's lowest piece — the one nearest the wall —
    // only ever appears after the highest one has.
    const g = panelGeometry(PANEL_W, PANEL_H)
    const lowestY = (u: number) => {
      const ps = coatPiecesAt(g, 'clathrin', u)
      return ps.length === 0 ? -Infinity : Math.max(...ps.map((p) => p.at.y))
    }
    let prevCount = 0
    let grew = 0
    for (let k = 0; k <= 200; k++) {
      const u = 0.38 + (k / 200) * 0.28
      const n = coatPiecesAt(g, 'clathrin', u).length
      // The circle only GROWS while the coat builds — a lattice does not
      // shed a piece to gain one.
      expect(n, `the coat lost a piece at u=${u.toFixed(3)}`).toBeGreaterThanOrEqual(prevCount)
      if (n > prevCount) grew++
      prevCount = n
    }
    expect(grew, 'the coat never grows piece by piece').toBeGreaterThan(2)
    // The last-landed piece sits lower — nearer the membrane — than the first.
    expect(lowestY(0.66)).toBeGreaterThan(lowestY(0.42))
  })

  it('A2: the SNARE bench wears the same coat and the same coil', () => {
    // ⚠ (user: "align coat representation between them".) One protein, one
    // drawing: at the bench's retrieval the coat's two chain inks and, late in
    // it, dynamin's blue are all on the canvas — and the old fuchsia bar ink
    // marks nothing there.
    const g = snareGeometry()
    const c = strictCanvas()
    drawSnare2(c.ctx, { u: at('retrieve') })
    expect(c.styles).toContain(CLATHRIN_INK)
    expect(c.styles).toContain(CLATHRIN_LIGHT)
    // Dynamin appears late in the retrieval, works the neck, and is gone once
    // the bubble is free.
    expect(snareDynaminAt(g, 0)).toBeNull()
    expect(snareDynaminAt(g, 1)).toBeNull()
    const span = STAGE_SPANS.find((x) => x.id === 'retrieve')!
    const late = span.from + (span.to - span.from) * 0.8
    const dyn = snareDynaminAt(g, late)
    expect(dyn, 'the bench has no dynamin at the pinch').not.toBeNull()
    expect(dyn!.y, 'the coil is not at the neck').toBeGreaterThan(g.highY)
    expect(dyn!.y).toBeLessThan(g.wallY)
    const cc = strictCanvas()
    drawSnare2(cc.ctx, { u: late })
    expect(cc.styles).toContain(DYNAMIN_INK)
    // …and the squeeze grows across its window.
    const early = snareDynaminAt(g, span.from + (span.to - span.from) * 0.6)
    expect(early).not.toBeNull()
    expect(dyn!.squeeze).toBeGreaterThan(early!.squeeze)
  })

  it('A2: the panel’s coil is dynamin’s blue — the fuchsia collision is gone', () => {
    const c = strictCanvas()
    // Mid-pinch for the clathrin panel.
    drawPanel(c.ctx, { route: 'clathrin', u: 0.75, width: PANEL_W, height: PANEL_H, ms: 0 })
    expect(c.styles).toContain(DYNAMIN_INK)
    expect(c.styles, 'the collar still wears NSF’s fuchsia').not.toContain('#c026d3')
    expect(c.styles).toContain(CLATHRIN_INK)
  })
})
