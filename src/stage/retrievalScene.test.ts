import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  PANEL_H,
  PANEL_MS,
  PANEL_W,
  bubblesAt,
  cargoAt,
  CARGO_N,
  coatAt,
  collarAt,
  drawPanel,
  panelGeometry,
  endosomeR,
  wallOpenAt,
} from './retrievalScene'
import { RETRIEVALS } from '../core/retrieval'
import { wallPoints, wallShiftFor } from './snareScene'
import { lipidJiggle } from './bilayer'
import { jiggle } from './lipidLabScene'

// ⚠ THE PANEL'S OWN SIZE, not a made-up one — a guard that frames a shape at a
// size the app never draws proves nothing about the app (21c-5a).
const W = PANEL_W
const H = PANEL_H

describe('S14 — synaptic vesicle endocytosis, three panels', () => {
  it('A3: draws every mechanism at every moment without a NaN or a bad colour', () => {
    for (const r of RETRIEVALS) {
      for (let i = 0; i <= 24; i++) {
        const c = strictCanvas()
        expect(() =>
          drawPanel(c.ctx, { route: r.id, u: i / 24, width: W, height: H }),
        ).not.toThrow()
        expect(c.calls.length).toBeGreaterThan(100)
      }
    }
  }, 20000)

  it('A6 (21c-5): nothing is lettered on a panel', () => {
    // ⚠ (user: "no additional labels or explanations on the canvas. Put all this
    // to info block".) The mechanism's name is above its panel, where it can be
    // pressed and heard; a canvas that has to be read is a canvas a child skips.
    for (const r of RETRIEVALS) {
      for (const u of [0, 0.3, 0.6, 1]) {
        const c = strictCanvas()
        drawPanel(c.ctx, { route: r.id, u, width: W, height: H })
        expect(c.texts, `${r.id} letters on its canvas`).toEqual([])
      }
    }
  })

  it('A3 (21c-5): kiss-and-run NEVER opens up — the whole disagreement', () => {
    // ⚠ `omegaRing` unrolls whatever has passed the wall ALONG it, so "the
    // vesicle opens into the wall" is exactly "its centre reaches the wall".
    // Kiss-and-run's claim is that it never does, and that is checkable.
    const g = panelGeometry(W, H)
    for (let k = 0; k <= 200; k++) {
      const [b] = bubblesAt(g, 'kiss', k / 200)
      expect(b.cy, `kiss reached the wall at u=${(k / 200).toFixed(2)}`).toBeLessThan(
        g.wallY,
      )
      expect(b.r).toBeCloseTo(g.r, 6)
    }
    // …and the other two DO go right in: their centre passes the wall.
    for (const id of ['clathrin', 'ultrafast'] as const) {
      let deepest = -Infinity
      for (let k = 0; k <= 200; k++) {
        for (const b of bubblesAt(g, id, k / 200)) deepest = Math.max(deepest, b.cy)
      }
      expect(deepest, `${id} never opened up`).toBeGreaterThan(g.wallY)
    }
  })

  it('A3 (21c-5): every mechanism starts docked and ends with a vesicle free', () => {
    // ⚠ The thing the three have in common: the wall gives back what it took.
    // However different the middle is, the end is a vesicle clear of the wall.
    const g = panelGeometry(W, H)
    for (const r of RETRIEVALS) {
      const start = bubblesAt(g, r.id, 0)
      expect(start.length).toBe(1)
      // It comes in from the crowd above, not from inside the wall.
      expect(start[0].cy).toBeLessThan(g.wallY - g.r)
      const end = bubblesAt(g, r.id, 1)
      expect(end.length, `${r.id} ends with nothing`).toBeGreaterThan(0)
      // ⚠ BACK IN THE CROWD, not merely pinched off the wall. Asked of the
      // scene's OWN crowd height rather than a number: a bud still sitting on
      // the membrane has not been retrieved, it has been budded. Measured — a
      // version that dropped the last lift left it a third of a radius clear
      // and satisfied "off the wall".
      // ⚠ Against each bubble's OWN radius (21c-11): the endosome's thirds are
      // bigger than a docked vesicle, so "at the crowd line" is its own centre
      // one own-radius above it, not one g.r.
      const free = end.filter((b) => b.cy <= g.highY + b.r + 1)
      expect(free.length, `${r.id} never gets back to the crowd`).toBeGreaterThan(0)
    }
  })

  it('A3 (21c-5): nothing sails off its own panel', () => {
    // ⚠ These are small frames and the ultrafast blob is deliberately large.
    // Measured before this guard existed: at r × 1.9 with a full lift its
    // centre ended at y = −21 in a 300 px panel — the thing the exhibit is
    // about, off the top of its own picture.
    const g = panelGeometry(W, H)
    for (const r of RETRIEVALS) {
      for (let k = 0; k <= 100; k++) {
        for (const b of bubblesAt(g, r.id, k / 100)) {
          expect(b.cy - b.r, `${r.id} left the top at u=${k / 100}`).toBeGreaterThan(-8)
          expect(b.cx - b.r, `${r.id} left the left edge`).toBeGreaterThan(-8)
          expect(b.cx + b.r, `${r.id} left the right edge`).toBeLessThan(W + 8)
        }
      }
    }
  })

  it('A3 (21c-5): the basket and the collar belong to ONE mechanism, in order', () => {
    // ⚠ A clathrin basket on kiss-and-run would be the exhibit contradicting its
    // own point. And the ORDER is the biology: the basket goes on, the collar
    // squeezes while it is still on, and only then is the basket stripped.
    for (let k = 0; k <= 100; k++) {
      const u = k / 100
      expect(coatAt('kiss', u)).toBe(0)
      expect(coatAt('ultrafast', u)).toBe(0)
      expect(collarAt('kiss', u)).toBe(0)
      expect(collarAt('ultrafast', u)).toBe(0)
    }
    expect(coatAt('clathrin', 0.3)).toBe(0)
    // ⚠ The coat BUILDS now (21c-10) — a gradual landing of triskelions, not a
    // snap to full — and the bud's depth is derived from the same build, so the
    // ramp is the sucking-in itself. Fully on before the collar squeezes.
    expect(coatAt('clathrin', 0.5)).toBeGreaterThan(0.2)
    expect(coatAt('clathrin', 0.5)).toBeLessThan(0.8)
    expect(coatAt('clathrin', 0.67)).toBe(1)
    // The collar squeezes while the basket is on…
    let squeezed = 0
    for (let k = 0; k <= 100; k++) {
      const u = k / 100
      if (collarAt('clathrin', u) > 0.2) {
        squeezed++
        expect(coatAt('clathrin', u), 'the collar squeezes a bare bud').toBeGreaterThan(0.8)
      }
    }
    expect(squeezed, 'the collar never squeezes').toBeGreaterThan(3)
    // …and the basket comes off last.
    expect(coatAt('clathrin', 1)).toBe(0)
    expect(collarAt('clathrin', 1)).toBe(0)
  })

  it('A3 (21c-11): the endosome is sized from the PANEL, offset to the frame’s edge', () => {
    // ⚠ (user: "make 'large vesicle' larger, so it takes almost all div width,
    // before it splits".) It was r × 1.55; a bulk endosome is several vesicles'
    // worth of membrane in one piece, so it now takes what the frame can give.
    // "Beside the active zone" survives as far as the frame allows: pushed as
    // far right as its own size permits, never past the panel.
    const g = panelGeometry(W, H)
    expect(endosomeR(g), 'the endosome is not panel-sized').toBeGreaterThan(
      (g.right - g.left) * 0.35,
    )
    expect(endosomeR(g)).toBeGreaterThan(g.r * 2.5)
    const late = bubblesAt(g, 'ultrafast', 0.68)
    const big = late.reduce((a, b) => (b.r > a.r ? b : a))
    expect(big.r).toBeCloseTo(endosomeR(g), 4)
    // Right of the zone, and flush with the room the frame has left.
    expect(big.cx).toBeGreaterThan(g.cx)
    expect(big.cx + big.r).toBeLessThanOrEqual(g.right + 1)
    // …and small vesicles bud off it by the end.
    expect(bubblesAt(g, 'ultrafast', 1).length).toBeGreaterThan(1)
  })

  it('A3 (21c-5): a panel is a piece of WALL and a vesicle — nothing else', () => {
    // ⚠ (user: "the picture is too busy".) The version before this drew the
    // whole synapse — spine, astrocyte, cleft, four other vesicles, every ion in
    // the bath — around the one thing being compared. A panel's ink is the wall
    // and the vesicle, and a wall of molecules is a few hundred marks, not
    // thousands.
    const c = strictCanvas()
    drawPanel(c.ctx, { route: 'clathrin', u: 0.5, width: W, height: H })
    expect(c.calls.length).toBeGreaterThan(200)
    expect(c.calls.length, 'a whole scene crept back into the panel').toBeLessThan(3000)
  })

  it('A5 (21c-6): the wall OPENS as the vesicle merges — it does not stay solid', () => {
    // ⚠ (user: "cell membrane remains solid during animation. Expected: it
    // visually opens up".) The panel paved its wall at shift 0, so a vesicle
    // merged into a membrane that never parted — the one thing a merge is not.
    const g = panelGeometry(W, H)
    // Nothing merging: the wall is whole.
    expect(wallShiftFor(g, g.wallY - g.r * 2, g.r)).toBe(0)
    // Half merged: the crowd has to make room, and the room is real.
    const shift = wallShiftFor(g, g.wallY - g.r * 0.2, g.r)
    expect(shift, 'the wall makes no room at all').toBeGreaterThan(g.r * 0.5)
    // …and the paved wall really parts THERE, around the vesicle, not at the
    // frame's middle: the widest gap between neighbouring molecules straddles
    // the place the vesicle is going in.
    const about = g.cx + g.r * 2
    const xs = wallPoints(g, shift, about).map((w) => w.at.x)
    let widest = 0
    let at = 0
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] - xs[i - 1] > widest) {
        widest = xs[i] - xs[i - 1]
        at = (xs[i] + xs[i - 1]) / 2
      }
    }
    expect(widest, 'the wall never parts').toBeGreaterThan(shift)
    expect(Math.abs(at - about), 'the wall parts where nothing is happening').toBeLessThan(
      g.r,
    )
    // ⚠ AND THE PANEL ACTUALLY USES IT. The checks above ask the helper; this
    // asks the PICTURE — a version that computed the shift and then paved at
    // zero passed everything else. Measured on the wall's own molecules: the
    // widest gap along the wall line is far wider while a vesicle is merging
    // than while none is.
    // ⚠ NOT measured as an empty gap: the opening is FILLED, by the vesicle's
    // own molecules unrolling into it — which is the whole point of `omegaRing`
    // and of material conservation. What moves is the WALL's own crowd, pushed
    // outwards past the ends of its span. Nothing is out there at shift zero.
    const pushed = (u: number) => {
      const c = strictCanvas()
      drawPanel(c.ctx, { route: 'clathrin', u, width: W, height: H, ms: 0 })
      return c.points.filter(
        (p) => Math.abs(p.y - g.wallY) < 12 && (p.x < g.left - 4 || p.x > g.right + 4),
      ).length
    }
    expect(pushed(0.02), 'the wall is already shoved aside at rest').toBe(0)
    expect(pushed(0.38), 'the drawn wall never opens').toBeGreaterThan(4)

    // ⚠ AND KISS-AND-RUN PARTS IT FAR LESS. Not "not at all" — measured, its
    // own mouth does move the crowd aside by about a quarter of a radius, and
    // it should: a fusion pore IS a hole in the wall. The claim that separates
    // the mechanisms is how MUCH: a collapse opens it several times wider.
    const most = (id: 'kiss' | 'clathrin') => {
      let m = 0
      for (let k = 0; k <= 200; k++) {
        for (const b of bubblesAt(g, id, k / 200)) m = Math.max(m, wallShiftFor(g, b.cy, b.r))
      }
      return m
    }
    expect(most('kiss'), 'kiss-and-run never even makes a mouth').toBeGreaterThan(1)
    // Measured: a full collapse parts the wall 109.5 px, kiss-and-run 17.
    expect(most('kiss'), 'kiss-and-run tears the wall open like a collapse').toBeLessThan(
      most('clathrin') * 0.25,
    )
  })

  it('A6 (21c-6): the lipids are UNEVEN and they JIGGLE', () => {
    // ⚠ (user: "make lipids jiggle and make them uneven. Copy from 'The
    // phospholipid bilayer'".) The wall was paved with the default jitter and
    // no clock, so it stood perfectly still — a bilayer is a liquid crowd, not
    // a parked one.
    const a = strictCanvas()
    drawPanel(a.ctx, { route: 'kiss', u: 0.5, width: W, height: H, ms: 0 })
    const b = strictCanvas()
    drawPanel(b.ctx, { route: 'kiss', u: 0.5, width: W, height: H, ms: 900 })
    expect(a.points.length).toBe(b.points.length)
    let moved = 0
    for (const [i, p] of a.points.entries()) {
      if (Math.hypot(p.x - b.points[i].x, p.y - b.points[i].y) > 0.3) moved++
    }
    expect(moved, 'nothing in the wall moves with the clock').toBeGreaterThan(
      a.points.length * 0.5,
    )
    // ⚠ ONE OWNER, asked as an identity. Comparing the two functions' VALUES
    // could never fail — they are the same function — which is a guard that
    // agrees with itself. What can actually go wrong is somebody writing a
    // second copy in the lab again, and this says so.
    expect(jiggle, 'the lab has its own copy of the jiggle again').toBe(lipidJiggle)
  })

  it('A2 (21c-8): no lipid is left floating in the middle of the opening', () => {
    // ⚠ (user: "1 lipid remains in the center of opening".) `Math.sign(0)` is
    // 0, so the slot exactly at the opening's centre was shoved nowhere.
    // Asked of the decision: with the wall parted by `shift` about a point, no
    // molecule stands within the opening's own half-width of that point —
    // including one that starts exactly ON it.
    const g = panelGeometry(W, H)
    const about = (g.left + g.right) / 2
    const shift = 40
    for (const w of wallPoints(g, shift, about)) {
      expect(
        Math.abs(w.at.x - about),
        `a molecule is stranded at ${w.at.x.toFixed(1)}`,
      ).toBeGreaterThanOrEqual(shift * 0.9)
    }
    // …and the exact-centre case SPECIFICALLY — the broken case is a slot at
    // distance zero, and whether the real grid puts one there depends on
    // parity, so a fixture is built whose middle slot lands on `about` by
    // construction: a run exactly two slot-spacings wide, measured off the
    // wall's own unparted grid rather than off a constant that may drift.
    const grid = wallPoints(g, 0, about).map((w) => w.at.x)
    const spacing = grid[1] - grid[0]
    const gDot = { ...g, left: about - spacing, right: about + spacing }
    const dot = wallPoints(gDot, 0, about).map((w) => w.at.x)
    expect(
      dot.some((x) => Math.abs(x - about) < 1e-6),
      'the fixture has no centre slot at all',
    ).toBe(true)
    for (const w of wallPoints(gDot, shift, about)) {
      expect(
        Math.abs(w.at.x - about),
        'the centre molecule is stranded in the mouth',
      ).toBeGreaterThanOrEqual(shift * 0.9)
    }
  })

  it('A2 (21c-7): a panel paints ONE wash — the cleft — and nothing else', () => {
    // ⚠ (user: "change background color, unless strictly necessary for
    // animation effect".) The panel used to fill its whole canvas and then wash
    // the WRONG side. The snare bench paints exactly one rect — OUTSIDE, below
    // the wall — and that one is necessary: the lumen is painted in the same
    // ink, which is what makes fusion read as seamless. Everything above the
    // wall is the container's own ground.
    for (const r of RETRIEVALS) {
      const c = strictCanvas()
      drawPanel(c.ctx, { route: r.id, u: 0.5, width: W, height: H, ms: 0 })
      const rects = c.inks.filter((k) => k.op === 'fillRect')
      expect(rects.length, `${r.id} paints ${rects.length} washes`).toBe(1)
    }
  })

  it('A3 (21c-8): the endosome RESOLVES into its buds — no membrane is minted', () => {
    // ⚠ (user: "the end total amount of lipids should be preserved after
    // split".) A lipid count is a circumference is a radius, so the claim is
    // one sum: from the moment the gulp is free of the wall to the end of the
    // run, Σr over every bubble in the panel never grows. (The old drawing
    // kept the endosome at full size AND added two vesicles — membrane from
    // nowhere.)
    const g = panelGeometry(W, H)
    let started: number | null = null
    for (let k = 0; k <= 300; k++) {
      const u = 0.66 + (k / 300) * 0.34
      const bs = bubblesAt(g, 'ultrafast', u)
      // Only once everything is clear of the wall — while merging, lipids
      // trade with the wall, which is the omegaRing's story, not this one.
      if (bs.some((b) => b.cy + b.r > g.wallY)) continue
      const sum = bs.reduce((s2, b) => s2 + b.r, 0)
      if (started === null) started = sum
      expect(sum, `membrane minted at u=${u.toFixed(2)}`).toBeLessThanOrEqual(started + 0.01)
      expect(sum, `membrane destroyed at u=${u.toFixed(2)}`).toBeGreaterThan(started * 0.95)
    }
    expect(started, 'the gulp never came free').not.toBeNull()
    // …and it really does SPLIT: more than one bubble at the end, none of them
    // the endosome's own size.
    const end = bubblesAt(g, 'ultrafast', 1)
    expect(end.length).toBeGreaterThan(1)
    const R0 = 1.55 * g.r
    for (const b of end) expect(b.r).toBeLessThan(R0 * 0.75)
  })

  it('A3 (21c-8): a bud GROWS ON the endosome’s surface before it leaves', () => {
    // ⚠ (user: "small vesicles out of big one animation should look more
    // realistic".) Budding is a bump on the parent's surface, not a vesicle
    // materialising beside it: while a bud is small, its rim touches the
    // endosome's rim — centre distance ≈ R_endo + r_bud.
    const g = panelGeometry(W, H)
    let attachedSeen = 0
    for (let k = 0; k <= 200; k++) {
      const u = 0.78 + (k / 200) * 0.1
      const bs = bubblesAt(g, 'ultrafast', u)
      if (bs.length < 2) continue
      const endo = bs.reduce((a, b) => (b.r > a.r ? b : a))
      for (const b of bs) {
        if (b === endo || b.r < 1) continue
        const d = Math.hypot(b.cx - endo.cx, b.cy - endo.cy)
        if (Math.abs(d - (endo.r + b.r)) < 1.5) attachedSeen++
      }
    }
    expect(attachedSeen, 'no bud is ever seen growing on the surface').toBeGreaterThan(10)
  })

  it('A4 (21c-8): the transmitter is released, and every ball leaves the frame', () => {
    // ⚠ (user: "display neurotransmitter release. The NT balls then drift away
    // from the screen".) Exocytosis without cargo is a bubble docking for no
    // reason. Every route starts with all its cargo inside the vesicle, ends
    // with all of it off the frame — by travel, never a fade — and it leaves
    // DOWNWARD, because the outside is below the wall in this register.
    const g = panelGeometry(W, H)
    for (const r of RETRIEVALS) {
      const start = cargoAt(g, r.id, 0)
      expect(start.length).toBe(CARGO_N)
      const bubble = bubblesAt(g, r.id, 0)[0]
      for (const c of start) {
        expect(c.free).toBe(false)
        expect(
          Math.hypot(c.x - bubble.cx, c.y - bubble.cy),
          `${r.id}: cargo outside its vesicle at rest`,
        ).toBeLessThan(bubble.r)
      }
      const end = cargoAt(g, r.id, 1)
      for (const c of end) {
        expect(c.free, `${r.id}: a ball never released`).toBe(true)
        expect(c.y, `${r.id}: a ball still on screen`).toBeGreaterThan(H + 4)
      }
      // …and no ball is loose before the mouth exists: kiss-and-run's pore
      // opens in its second stage, the collapses as they flatten.
      for (const c of cargoAt(g, r.id, 0.1)) expect(c.free).toBe(false)
    }
    // Kiss-and-run releases SINGLE FILE through a pore barely wider than one
    // ball: at its mouth, released balls share the pore's own x.
    const during = cargoAt(g, 'kiss', 0.35)
    const justOut = during.filter((c) => c.free && c.y < g.wallY + 14)
    for (const c of justOut) {
      expect(Math.abs(c.x - bubblesAt(g, 'kiss', 0.35)[0].cx)).toBeLessThan(4)
    }
  })

  it('A1 (21c-9): the bilayer never TWITCHES — the wall moves, it does not jump', () => {
    // ⚠ (user: "'ultrafast endocytosis': bilayer twitches after exocytosis".)
    // The merged vesicle used to be culled from the model the instant it
    // finished merging, and the dent used to arrive already flat — so the
    // wall's parting snapped from ~110 px to 0 and back to ~170 in single
    // frames. Both are gone: a merged vesicle is ABSORBED (its radius runs to
    // nothing while its ring lies flat in the wall) and a pit GROWS from
    // nothing.
    //
    // Asked as what an eye actually sees: how far does any molecule of the
    // wall move between two REAL frames? Measured at 60 fps over the panel's
    // own run — kiss 0.39 px, clathrin 2.85, ultrafast 4.87. A snap of the old
    // kind is 110 in one frame.
    const g = panelGeometry(W, H)
    const step = 1000 / 60 / PANEL_MS
    for (const r of RETRIEVALS) {
      const xs = (u: number) => {
        const o = wallOpenAt(g, r.id, u)
        return wallPoints(g, o.shift, o.about).map((w) => w.at.x)
      }
      let prev = xs(0)
      let worst = 0
      let at = 0
      for (let u = step; u <= 1; u += step) {
        const now = xs(u)
        for (const [i, x] of now.entries()) {
          const d = Math.abs(x - prev[i])
          if (d > worst) {
            worst = d
            at = u
          }
        }
        prev = now
      }
      expect(worst, `${r.id} twitches at u=${at.toFixed(2)}`).toBeLessThan(8)
    }
    // …and the opening itself is continuous, which is what makes that true:
    // nothing in `wallOpenAt` eases or clamps, so this is a property of the
    // model rather than of a filter laid over it.
    const gu = panelGeometry(W, H)
    let prevShift = wallOpenAt(gu, 'ultrafast', 0).shift
    for (let k = 1; k <= 2000; k++) {
      const now = wallOpenAt(gu, 'ultrafast', k / 2000).shift
      expect(
        Math.abs(now - prevShift),
        `the opening jumps at u=${(k / 2000).toFixed(3)}`,
      ).toBeLessThan(2)
      prevShift = now
    }
  })

  it('A3 (21c-9): the gulp resolves into THREE, and all three are still there', () => {
    // ⚠ (user: "large vesicle turns into 3, but only 2 remain on the last
    // frame. 1 disappears".) The buds were half the endosome each, so the
    // endosome was consumed to nothing and dropped out of the picture — a
    // vesicle that vanishes, which is exactly what the conservation rule
    // forbids. Thirds: two buds and the remnant.
    const g = panelGeometry(W, H)
    const end = bubblesAt(g, 'ultrafast', 1)
    expect(end.length, 'the gulp does not end as three').toBe(3)
    const big = endosomeR(g)
    for (const b of end) expect(b.r).toBeCloseTo(big / 3, 6)
    // Σr is exactly what was gulped — nothing minted, nothing lost.
    expect(end.reduce((s2, b) => s2 + b.r, 0)).toBeCloseTo(big, 6)
    // …and none of them is left sitting in the wall.
    for (const b of end) expect(b.cy + b.r).toBeLessThan(g.wallY)
    // The count never DROPS once the three exist: a vesicle may not vanish.
    let seenThree = false
    for (let k = 0; k <= 400; k++) {
      const n = bubblesAt(g, 'ultrafast', 0.8 + (k / 400) * 0.2).length
      if (n === 3) seenThree = true
      if (seenThree) expect(n, 'a vesicle disappeared').toBe(3)
    }
    expect(seenThree).toBe(true)
  })

  it('A2 (21c-9): a transmitter ball never teleports — it travels out', () => {
    // ⚠ (user: "NTs should be present in vesicles from the 1st frame. Currently
    // teleport".) A released ball used to jump from its seat inside the vesicle
    // straight to a point below the wall on the frame it was let go. It threads
    // the mouth now — a quadratic pinched at the opening, leaving in the very
    // direction it carries on in.
    const g = panelGeometry(W, H)
    const step = 1000 / 60 / PANEL_MS
    for (const r of RETRIEVALS) {
      // From the FIRST frame, every ball is inside its vesicle.
      const first = cargoAt(g, r.id, 0)
      expect(first.length).toBe(CARGO_N)
      const v0 = bubblesAt(g, r.id, 0)[0]
      for (const c of first) {
        expect(c.free).toBe(false)
        expect(Math.hypot(c.x - v0.cx, c.y - v0.cy)).toBeLessThan(v0.r)
      }
      // …and no ball ever moves more in one frame than the fastest thing in
      // the panel plausibly can. Measured: the worst step is the vesicle's own
      // arrival from the crowd, 2.4 px; a release teleport was hundreds.
      let prev = cargoAt(g, r.id, 0)
      let worst = 0
      let at = 0
      for (let u = step; u <= 1; u += step) {
        const now = cargoAt(g, r.id, u)
        for (const [i, c] of now.entries()) {
          const d = Math.hypot(c.x - prev[i].x, c.y - prev[i].y)
          if (d > worst) {
            worst = d
            at = u
          }
        }
        prev = now
      }
      expect(worst, `${r.id}: a ball teleports at u=${at.toFixed(2)}`).toBeLessThan(20)
    }
  })

  it('A4 (21c-5): the three are played at one length, so they can be compared', () => {
    // Their real times differ more than tenfold and are said in the info block;
    // the SHAPES are what is being compared, so the runs are the same length.
    expect(PANEL_MS).toBeGreaterThan(3000)
    const fastest = Math.min(...RETRIEVALS.map((r) => r.realS))
    const slowest = Math.max(...RETRIEVALS.map((r) => r.realS))
    expect(slowest / fastest).toBeGreaterThan(10)
  })
})
