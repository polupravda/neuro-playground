import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  CLEFT_NOTE,
  SYNAPSE_SCREEN_MS,
  SYN_H,
  SYN_W,
  CLEFT_PX,
  LUMEN,
  OUTSIDE,
  astrocyteFinger,
  astrocyteHolds,
  synapseCallouts,
  SCALE_NOTES,
  activeZone,
  CLOCK_LEGS,
  CARGO_DRAIN_MS,
  FLATTEN_FROM_MS,
  FLATTEN_MS,
  PORE_OPEN_MS,
  TRANSMITTER_INK,
  transmitterDot,
  synapseAuras,
  spineTint,
  arrivalFlash,
  FLASH_FADE_SCREEN_MS,
  neckTop,
  spineAuraTop,
  ionSoup,
  activeZoneLabelAt,
  snareMini,
  membraneLipids,
  FLASH_R,
  SYNAPSE_END_HOLD_MS,
  SOUP_NOTE,
  POST_FLASH_MS,
  departingFlash,
  cargoIn,
  dockedY,
  faceAt,
  fusedShape,
  mergeBand,
  pocketAt,
  synapseClock,
  screenOfModel,
  synapseEvents,
  nudgeLaunchMs,
  tearsAt,
  wallAt,
  vesicleR,
  drawSynapse,
  receptorSites,
  reservePool,
  synapseGeometry,
  synapseLabels,
} from './synapseScene'
import {
  CAST_ALPHA,
  CA_N,
  DISPERSE_MS,
  EMERGE_STAGGER_MS,
  EMERGE_TRAVEL_MS,
  calciumCast,
  sodiumCast,
  transmitterCast,
  receptorSeatWindow,
  receptorOpenWindow,
  RELEASE_HOLD_MS,
  BIND_HOLD_MS,
  NA_PAUSE_MS,
  NA_APPROACH_MS,
  NA_CROSS_MS,
  NA_SETTLE_MS,
  GLOW_FADE_MS,
  NT_DEPART_LEAD_MS,
  OPEN_EASE_MS,
  ntSeatAt,
  receptorOpenFrac,
  bindPulses,
} from './synapseCast'
import {
  BOUTON_BOX,
  BOUTON_FOOT,
  NECK_END,
  NECK_PX,
  SHAFT_BOX,
  place,
} from './boutonShape'
import { POOL, SYNAPSE_MS, synapseRun } from '../core/synapse'
import { GLOSSY_COLORS } from './particleStyle'
import { mix } from './bilayer'
import { CLEFT_NM, SPINE_TAU_MS, cleftRun, sampleCleft } from '../core/cleft'
import { ION_KINDS, IONS, particlesFor } from '../core/ions'
import type { IonCounts } from '../state/ionStore'
import { spokenTermAt } from './spokenLabels'
import { boutonFloorAt } from './boutonShape'
import { OUTGOING, ZOOM_TARGETS } from './layout'

/** The app's own declared concentrations — the same helper the model's tests
 *  use, so the view is exercised against the run a child actually sees. */
const REAL = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

const run = synapseRun(REAL, true)
const cleft = cleftRun(run)

describe('S12 — the synapse, leg 1', () => {
  it("A3: traces the user's own bouton, whole, with its stalk at the top edge", () => {
    // ⚠ "Use presynaptic-bouton.svg as base" and "the handover wins — draw the
    // whole bouton" (user, 2026-08-31). The reference outline is 39.37 × 50.32
    // in its own units; if that changes, the drawing is not the drawing given.
    expect(BOUTON_BOX.w).toBeCloseTo(39.37, 2)
    expect(BOUTON_BOX.h).toBeCloseTo(50.32, 2)
    const g = synapseGeometry()
    const fit = g.fit
    // ⚠ THE NECK IS CROPPED, not squashed (user, 2026-08-31: "shorten the
    // 'neck'"). The reference gives the stalk 46% of the bouton's own height;
    // only `NECK_PX` of it is on the page, and the rest runs off the top —
    // which is honest, because the axon really does continue up out of frame.
    // The outline itself is untouched: it is the user's own shape.
    expect(place(fit, BOUTON_BOX.x, NECK_END).y).toBeCloseTo(NECK_PX, 6)
    expect(place(fit, BOUTON_BOX.x, BOUTON_BOX.y).y).toBeLessThan(0)
    // And the neck really is a sliver of the picture now, not a third of it.
    expect(NECK_PX / SYN_H).toBeLessThan(0.1)
    // And the whole of it is on the page — that is the ruling.
    const foot = place(fit, BOUTON_FOOT.x, BOUTON_FOOT.y)
    expect(foot.y).toBeLessThan(SYN_H)
    expect(place(fit, BOUTON_BOX.x, 0).x).toBeGreaterThan(0)
    expect(place(fit, BOUTON_BOX.x + BOUTON_BOX.w, 0).x).toBeLessThan(SYN_W)
  })

  it("A3: puts a SPINE under the terminal, apposed to the bouton's own wall", () => {
    // ⚠ The one alteration, and it is a science correction. The reference's
    // lower shape dips AWAY beneath the bouton. Glutamate synapses land on
    // dendritic spines (Gray's type I), and the app's own plan depends on it —
    // S13 has "Ca²⁺ enters the spine", P04 has the spine enlarging.
    const g = synapseGeometry()
    expect(g.head.cx).toBeCloseTo(g.foot.x, 6)
    // ⚠ THE TWO MEMBRANES ARE APPOSED — the postsynaptic face follows the
    // bouton's own wall one cleft below it, so the gap is the same width all
    // the way across. It used to be an ellipse hung off the foot's height,
    // which is how the cleft came apart at the ends.
    for (let i = -10; i <= 10; i++) {
      const x = g.foot.x + (i / 10) * g.activeHalf
      expect(faceAt(g, x) - wallAt(g, x), `x=${x.toFixed(0)}`).toBeCloseTo(CLEFT_PX, 6)
    }
    // Outside the zone the face falls away rather than running on for ever —
    // measured against its own edge, because the bulb's flank out there rises
    // steeply and the wall is no longer the reference.
    expect(faceAt(g, g.foot.x + g.head.rx)).toBeGreaterThan(
      faceAt(g, g.foot.x + g.activeHalf) + g.head.ry * 0.9,
    )
    // And the shaft is below the spine, running off the frame.
    expect(g.shaftTop).toBeGreaterThan(faceAt(g, g.head.cx))
    expect(SHAFT_BOX.w).toBeGreaterThan(0)
  })

  it('A3: interleaves calcium doors with the docked vesicles', () => {
    // ⚠ The reference figure has no calcium channels at all, and a vesicle
    // fusing beside none of them was step 19b's error. They are in the SAME
    // membrane the vesicles are parked on — that is the active zone, and it is
    // the whole design.
    const g = synapseGeometry()
    const { docked, doors } = activeZone(g)
    expect(docked.length).toBe(POOL)
    expect(doors.length).toBe(POOL - 1)
    // Every door falls strictly between two vesicles.
    const xs = docked.map((d) => d.x).sort((a, b) => a - b)
    for (const [i, door] of doors.entries()) {
      expect(door.x).toBeGreaterThan(xs[i])
      expect(door.x).toBeLessThan(xs[i + 1])
    }
    // The doors are IN the wall; the vesicles are inside it.
    for (const d of docked) expect(d.y).toBeLessThan(g.foot.y)
  })

  it('A3: the reserve pool is seeded and count-independent', () => {
    // Adding one vesicle must not make the others walk.
    const g = synapseGeometry()
    const five = reservePool(g, 5)
    const nine = reservePool(g, 9)
    expect(nine.slice(0, 5)).toEqual(five)
    // Inside the terminal, above the active zone.
    for (const p of nine) expect(p.y).toBeLessThan(g.foot.y)
  })

  it('A3: every receptor sits ON the postsynaptic membrane, opposite the zone', () => {
    const g = synapseGeometry()
    for (const s of receptorSites(g)) {
      // IN the membrane, not on a line near it.
      expect(s.y).toBeCloseTo(faceAt(g, s.x), 6)
      // ⚠ OPPOSITE THE RELEASE SITE. A postsynaptic density sits across from
      // the active zone — that is what makes a synapse a synapse rather than
      // two membranes that happen to be near each other.
      expect(Math.abs(s.x - g.foot.x)).toBeLessThanOrEqual(g.activeHalf)
    }
  })

  it('A3: draws at every moment of the run without a NaN or a bad colour', () => {
    for (let i = 0; i <= 24; i++) {
      const c = strictCanvas()
      expect(() => drawSynapse(c.ctx, { run, cleft, u: i / 24 })).not.toThrow()
      expect(c.calls.length).toBeGreaterThan(200)
    }
    const rest = strictCanvas()
    expect(() => drawSynapse(rest.ctx, { run, cleft, u: null })).not.toThrow()
  })

  it('A3: paints nothing brighter than the fade it was handed', () => {
    // The ghost-axon rule, applied to the new view before it can go wrong:
    // canvas alpha is set, not multiplied, so a drawing that assigns its own
    // wipes the caller's arrival gate.
    for (const fade of [0.05, 0.4, 1]) {
      const c = strictCanvas()
      drawSynapse(c.ctx, { run, cleft, u: 0.4, fade })
      expect(c.alphas.length).toBeGreaterThan(50)
      expect(c.alphas.filter((a) => a > fade + 1e-9)).toEqual([])
    }
    const none = strictCanvas()
    drawSynapse(none.ctx, { run, cleft, u: 0.4, fade: 0 })
    expect(none.alphas).toEqual([])
  })

  it('A3+J: the gap fills in a blink, both sides at once — never a journey', () => {
    // ⚠ The crossing is ~0.61 µs against a ~2.7 ms release delay. The cast
    // may animate RELEASE (a millisecond-scale event), but the spread itself
    // is a declared blink: no ball takes longer than DISPERSE_MS to reach its
    // standing place.
    const g = synapseGeometry()
    const fusions = run.vesicles
      .map((v) => v.fusedAtMs)
      .filter((m): m is number => m !== null)
    const settled =
      Math.max(...fusions) + EMERGE_STAGGER_MS + EMERGE_TRAVEL_MS + DISPERSE_MS + 0.05
    const out = transmitterCast(g, run, cleft, settled).filter(
      (d) => d.where === 'gap' || d.where === 'seat',
    )
    expect(out.length).toBeGreaterThan(10)
    // Both sides of the release site at once…
    expect(Math.min(...out.map((p) => p.x))).toBeLessThan(g.foot.x)
    expect(Math.max(...out.map((p) => p.x))).toBeGreaterThan(g.foot.x)
    // …and every loose ball inside the two walls at its own x.
    for (const p of out.filter((d) => d.where === 'gap')) {
      expect(p.y, `x=${p.x.toFixed(0)}`).toBeGreaterThan(wallAt(g, p.x))
      expect(p.y, `x=${p.x.toFixed(0)}`).toBeLessThan(faceAt(g, p.x))
    }
    expect(DISPERSE_MS).toBeLessThan(0.25)
  })

  it('A3: names what a child cannot be expected to know, and only names', () => {
    const g = synapseGeometry()
    for (const l of synapseLabels(g)) {
      expect(l.term.split(' ').length).toBeLessThanOrEqual(3)
      expect(l.term).not.toMatch(/[.!?]/)
      // Every label is hit-testable where it is drawn.
      expect(spokenTermAt(synapseLabels(g), l.x + l.w / 2, l.y + l.h / 2)).toBe(l.term)
    }
  })

  it('A3: declares the two exaggerations beside their real numbers', () => {
    // "Declare every exaggeration beside the real number."
    expect(CLEFT_NOTE).toContain(String(CLEFT_NM))
    expect(CLEFT_NOTE).toMatch(/nm/)
    // The clock says how much it is stretched, and by a number that is derived.
    expect(SYNAPSE_SCREEN_MS / SYNAPSE_MS).toBeGreaterThan(50)
    expect(SYNAPSE_SCREEN_MS / SYNAPSE_MS).toBeLessThan(400)
  })

  it('A3: is a PLACE the camera reaches WITHOUT turning', () => {
    // ⚠ It used to turn a quarter: the synapse lay along the scene's x axis
    // while the drawing puts the cleft across the middle, and the camera made
    // up the difference. The scene now STANDS that way — terminal above,
    // target under it (user, 2026-09-04) — so there is nothing left to
    // correct, and the two pictures agree BEFORE the flight rather than
    // because of it. A turn here now would rotate the world away from the
    // view it lands on.
    const t = ZOOM_TARGETS.find((z) => z.id === 'outgoing-synapse')!
    expect(t.presents).toBe('synapse')
    expect(t.turn ?? 0).toBeCloseTo(0, 6)
    expect(t.frame).toBeUndefined()
    // And the scene's own synapse really does stand vertically: the target is
    // UNDER the bouton, not beside it.
    expect(Math.abs(OUTGOING.tip.x - OUTGOING.bouton.x)).toBeLessThan(1)
    expect(OUTGOING.tip.y).toBeGreaterThan(OUTGOING.bouton.y)
  })

  // ───────────────────────────────────────────── the redraw of 2026-08-31
  // "Shorten the neck, make the active area 2× larger, exocytosis should
  // visually tear the membrane, vesicles as circles with the lumen in the
  // extracellular colour, and the outline drops where it overlaps the wall."

  it('A2: the active zone is measured off the BULB, and nearly doubled', () => {
    const g = synapseGeometry()
    // ⚠ Tied to the terminal, not to the canvas. It used to be
    // `max(40, width * 0.085)`, which is why giving the bouton more room left
    // the active zone exactly the same size — the fault behind the request.
    const bulbHalf = (BOUTON_BOX.w / 2) * g.fit.k
    expect(g.activeHalf / bulbHalf).toBeCloseTo(0.72, 6)
    // Doubling the frame doubles it; the old version would have grown by the
    // canvas's width alone.
    const big = synapseGeometry(SYN_W * 2, SYN_H * 2)
    expect(big.activeHalf / g.activeHalf).toBeGreaterThan(1.8)
    // Measured against what it was before this round (90 px at 1060×660).
    const was = 90
    expect(synapseGeometry(1060, 660).activeHalf / was).toBeGreaterThan(2)
  })

  it('A1+A2: everything still fits the frame, at every plausible size', () => {
    // The scale is SOLVED from a budget, so this is the claim that the budget
    // is the real one: nothing may run off the bottom.
    for (const [w, h] of [
      [1060, 620],
      [1060, 660],
      [1280, 800],
      [1440, 1080],
    ] as const) {
      const g = synapseGeometry(w, h)
      expect(g.shaftTop, `${w}×${h}`).toBeLessThan(h)
      expect(g.foot.y, `${w}×${h}`).toBeGreaterThan(NECK_PX)
      // ⚠ AND THE BOUTON TAKES TWO THIRDS (user, 2026-09-01: "push the whole
      // image down so that presynaptic bouton occupies two thirds of the
      // vertical space and the postsynaptic specialization one third").
      expect(g.foot.y / h, `${w}×${h}`).toBeGreaterThan(0.6)
      expect(g.foot.y / h, `${w}×${h}`).toBeLessThan(0.72)
      // And the face never overlaps the terminal.
      expect(faceAt(g, g.head.cx)).toBeGreaterThan(wallAt(g, g.head.cx))
    }
  })

  it('A2: the postsynaptic face is broad and shallow, and wider than the zone', () => {
    // Which is what an apposed face is, and also what makes the active area
    // affordable: anything twice as wide that is also twice as tall does not
    // fit, and the frame has width to spare and no height at all.
    const g = synapseGeometry()
    expect(g.head.rx).toBeGreaterThan(g.head.ry)
    expect(g.head.rx).toBeGreaterThan(g.activeHalf)
  })

  it('A3: fusion TEARS the wall — nothing before, a widening gap after', () => {
    const g = synapseGeometry()
    const first = run.vesicles
      .map((v) => v.fusedAtMs)
      .filter((m): m is number => m !== null)
      .sort((a, b) => a - b)[0]
    expect(first).toBeDefined()
    // An intact wall until the moment it goes.
    expect(tearsAt(g, run, first - 0.01)).toEqual([])
    expect(tearsAt(g, run, first)).toHaveLength(1)
    expect(tearsAt(g, run, first)[0].half).toBe(0)
    // Then it opens, and keeps opening — sampled INSIDE the pore-opening
    // window, because the fusion now finishes fast (flat by ~age 3.6, before
    // the first binding) instead of holding a frozen pocket for most of the
    // run.
    const early = tearsAt(g, run, first + 0.4)[0].half
    const late = tearsAt(g, run, first + 1.0)[0].half
    expect(early).toBeGreaterThan(0)
    expect(late).toBeGreaterThan(early)
    // ⚠ EVERY tear is AT the vesicle that made it, and there is one per fused
    // vesicle. Sampled at 3.2 ms: all three fusions (2.59–2.78) have gone and
    // none has flattened yet (earliest heal ≈ 6.2).
    const docked = activeZone(g).docked
    const late8 = tearsAt(g, run, 3.2)
    const goneBy8 = run.vesicles.filter((v) => v.fusedAtMs !== null && v.fusedAtMs <= 3.2)
    expect(late8).toHaveLength(goneBy8.length)
    for (const t of late8) {
      const owner = docked.find((d) => Math.abs(d.x - t.x) < 1e-9)
      expect(owner).toBeDefined()
      expect(run.vesicles[owner!.index].fusedAtMs).not.toBeNull()
      // Never wider than the vesicle that opened it.
      expect(t.half).toBeLessThan(vesicleR(g) * 2)
    }
  })

  it("A4: a vesicle's lumen IS the extracellular ink, not a match for it", () => {
    // ⚠ This reverses a ruling of 2026-08-27 ("a vesicle is a bilayer ring")
    // at the user's request, and the reason it is not a step backwards is the
    // topology: a lumen is outside the cell, folded in. So the guard is
    // identity, not similarity — two constants that happened to agree would be
    // two things that could stop agreeing.
    expect(LUMEN).toBe(OUTSIDE)
    const c = strictCanvas()
    drawSynapse(c.ctx, { run, cleft, u: null })
    // Painted, and more than once: the bath, and every vesicle in the pool.
    expect(c.styles.filter((s) => s === LUMEN).length).toBeGreaterThan(
      reservePool(synapseGeometry()).length,
    )
  })

  it('A5+A4(2): the outline is dropped ONLY while sinking through the wall — closed at rest', () => {
    const g = synapseGeometry()
    // ⚠ AT THE VESICLE'S OWN x. The band used to be one strip at the foot's
    // height, so at the ends of the row it was nowhere near the wall.
    for (const d of activeZone(g).docked) {
      const band = mergeBand(g, d.x)
      const wall = wallAt(g, d.x)
      expect(band.top).toBeLessThan(wall)
      expect(band.bottom).toBeGreaterThan(wall)
      expect((band.top + band.bottom) / 2).toBeCloseTo(wall, 6)
    }
    // ⚠ AT REST A DOCKED VESICLE IS CLOSED (user, 2026-09-01: "make docked
    // vesicles' membrane closed — currently has a gap"). No reversal of the
    // 2026-08-31 ruling: that spoke of the area that OVERLAPS the membrane
    // WHILE MOVING, and since `dockedY` a resting vesicle overlaps nothing.
    const rest = strictCanvas()
    drawSynapse(rest.ctx, { run, cleft, u: null })
    // Exactly the two interior-aura clips (bouton, spine-with-trunk) — no
    // vesicle outline is clipped at rest.
    expect(rest.calls.filter((k) => k === 'clip').length).toBe(2)
    // While a fused vesicle is sinking THROUGH the wall — after fusion, before
    // the mouth has opened — the ruling applies and the outline is dropped.
    const first = run.vesicles
      .map((v) => v.fusedAtMs)
      .filter((m): m is number => m !== null)
      .sort((a, b) => a - b)[0]
    // ⚠ The outline-skip engages only once the sinking circle TOUCHES the
    // membrane band — sampled inside that window (touch at ~+0.02 ms, mouth
    // through at ~+0.16 ms).
    const sinking = strictCanvas()
    drawSynapse(sinking.ctx, { run, cleft, u: (first + 0.05) / run.windowMs })
    // The rest-state clips plus exactly one for the sinking vesicle.
    expect(sinking.calls.filter((k) => k === 'clip').length).toBe(3)
  })

  it('A4: declares the vesicle exaggeration beside the real proportion', () => {
    // Real: ~40 nm against a ~1 µm terminal, so four per cent of it.
    const g = synapseGeometry()
    const bulbW = BOUTON_BOX.w * g.fit.k
    const trueR = bulbW * 0.02
    const drawn = vesicleR(g)
    expect(drawn / trueR).toBeGreaterThan(1)
    expect(drawn / trueR).toBeLessThan(4)
    expect(SCALE_NOTES.join(' ')).toMatch(/40 nm|40 nanometre/i)
  })

  // ─────────────────────────────────────── the corrections of 2026-09-01
  // "The animation looks broken." Five points, each measured before it was
  // fixed and pinned here afterwards.

  it('B2: NOTHING that lives in the terminal is drawn outside it', () => {
    // ⚠ THE BUG, in its general form. The active zone was a straight row at the
    // bouton's LOWEST point while the foot of a bouton is a curve — measured,
    // the outer vesicles of the row sat 47 and 88 px below the wall, floating
    // in the cleft. So the claim is not "the middle one is inside": it is that
    // every vesicle, docked or in reserve, is wholly within the membrane at its
    // own x.
    const g = synapseGeometry()
    const r = vesicleR(g)
    for (const d of activeZone(g).docked) {
      expect(d.y + r, `docked at ${d.x.toFixed(0)}`).toBeLessThanOrEqual(
        wallAt(g, d.x) + 1e-6,
      )
    }
    for (const p of reservePool(g)) {
      expect(p.y + r, `pool at ${p.x.toFixed(0)}`).toBeLessThanOrEqual(
        wallAt(g, p.x) + 1e-6,
      )
    }
    // And the calcium doors are IN the wall, not near it.
    for (const d of activeZone(g).doors) expect(d.y).toBeCloseTo(wallAt(g, d.x), 6)
    // The wall really is a curve, so this is not passing by accident.
    const ys = activeZone(g).docked.map((d) => wallAt(g, d.x))
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(20)
  })

  it('B3+B5: the clock gives the payload the screen, without changing any pace', () => {
    // ⚠ WHY "no neurotransmitters are visibly released" was once true AND the
    // model right: the transmitter occupies the gap for a few ms of a 60 ms
    // window. On a linear clock that is a blink however slow the whole thing
    // is; the legs give it the screen. Measured on the cast itself.
    const g = synapseGeometry()
    const seen = (map: (u: number) => number) => {
      let n = 0
      for (let i = 0; i <= 600; i++) {
        const msAt = map(i / 600) * SYNAPSE_MS
        const inGap = transmitterCast(g, run, cleft, msAt).filter(
          (d) => d.where === 'gap',
        ).length
        // ≥11: the release FLOOD, just above the TEN that linger in the
        // cleft awaiting reuptake — every pair is let go before its door
        // shuts now, so all ten captured balls end up lingering.
        if (inGap >= 11) n++
      }
      return n / 601
    }
    const linear = seen((u) => u)
    const legged = seen(synapseClock)
    // Measured: the ≥9-ball flood occupies ~3.1 ms of the 60 ms window — 5%
    // of a linear clock, ~17% of the legged one.
    // The constant-speed, direction-spread release now occupies a real slice
    // of MODEL time too (~11% of the window), so the legs' advantage is
    // smaller than when the payload was a 4.6% blink — but it must remain an
    // advantage.
    expect(linear).toBeLessThan(0.2)
    expect(legged).toBeGreaterThan(0.2)
    expect(legged / linear).toBeGreaterThan(1.4)

    // ⚠ SLOW THE LEG, NEVER THE ITEM. Inside a leg the map is linear, so no
    // ball ever moves at a speed the model did not give it. Walked, not
    // asserted.
    for (const leg of CLOCK_LEGS) {
      const at = (f: number) => synapseClock(legStart(leg) + leg.share * f)
      const first = at(0.5) - at(0.25)
      const second = at(0.75) - at(0.5)
      expect(second).toBeCloseTo(first, 9)
    }
    // The clock covers the whole run, once, in order.
    expect(synapseClock(0)).toBe(0)
    expect(synapseClock(1)).toBe(1)
    for (let i = 1; i <= 200; i++) {
      expect(synapseClock(i / 200)).toBeGreaterThanOrEqual(synapseClock((i - 1) / 200))
    }
    expect(CLOCK_LEGS.reduce((sum, l) => sum + l.share, 0)).toBeCloseTo(1, 9)
    // And it is slower than it was.
    expect(SYNAPSE_SCREEN_MS).toBeGreaterThan(12000)
  })

  it("B4: a vesicle carries visible cargo, in the transmitter's own ink", () => {
    // ⚠ "Neurotransmitters are not visible inside the vesicles" (user). A
    // vesicle drawn empty is a bag of nothing, and what it carries is the whole
    // point of the object.
    const g = synapseGeometry()
    const r = vesicleR(g)
    const cargo = cargoIn(100, 100, r)
    expect(cargo.length).toBeGreaterThan(4)
    // Every particle is inside the bubble AND clear of its wall, so none of
    // them straddles the membrane.
    for (const p of cargo) {
      expect(Math.hypot(p.x - 100, p.y - 100)).toBeLessThan(r - 5)
    }
    // Seeded and count-independent: filling one vesicle differently from the
    // next would make them look like different objects.
    expect(cargoIn(100, 100, r, 4)).toEqual(cargo.slice(0, 4))
    // And it really is drawn, at rest, before anything has happened. The dot
    // is a gradient now, so the ink is counted at its stops.
    const c = strictCanvas()
    drawSynapse(c.ctx, { run, cleft, u: null })
    const dots = c.styles.filter((st) => st === TRANSMITTER_INK.dark).length
    expect(dots).toBeGreaterThanOrEqual(
      reservePool(g).length + activeZone(g).docked.length,
    )
  })

  // ─────────────────────────────── the omega rework of 2026-09-01 (round 2)
  // "The cut on the vesicles does not repeat the curve of the presynaptic
  // bouton... it looks unrelated. Reconsider the animation so that the
  // activated vesicles visually merge with the membrane." ACTION LIST:
  // A1 the merge follows the bouton's own curve (true omega, flattening away),
  // A2 the opening precedes the cloud it explains.

  it("A1: the omega's feet stand ON the bouton's own curve, at different heights where it slopes", () => {
    // Pure geometry, asked at the OUTERMOST slot — where the wall slopes and a
    // horizontal cut was most wrong.
    const g = synapseGeometry()
    const d = activeZone(g).docked[0]
    const r = vesicleR(g) * 1.15
    const cy = wallAt(g, d.x) - r * 0.55
    const p = pocketAt(g, d.x, cy, r)
    expect(p).not.toBeNull()
    for (const [x, y] of [
      [p!.xL, p!.yL],
      [p!.xR, p!.yR],
    ] as const) {
      // Each foot is on the wall AND on the circle — the cut repeats the curve.
      expect(Math.abs(wallAt(g, x) - y)).toBeLessThan(0.6)
      expect(Math.abs(Math.hypot(x - d.x, y - cy) - r)).toBeLessThan(0.6)
    }
    // The wall really slopes here, so the two feet land at DIFFERENT heights —
    // exactly what the horizontal band got wrong.
    expect(Math.abs(p!.yL - p!.yR)).toBeGreaterThan(1)
  })

  it("A1: the tear runs exactly between the omega's feet — torn wall and arc cannot disagree", () => {
    const g = synapseGeometry()
    const first = run.vesicles
      .map((v) => v.fusedAtMs)
      .filter((m): m is number => m !== null)
      .sort((a, b) => a - b)[0]
    const ms = first + PORE_OPEN_MS + 1
    const d = activeZone(g).docked.find(
      (d) =>
        run.vesicles[d.index].fusedAtMs !== null &&
        run.vesicles[d.index].fusedAtMs! <= first,
    )!
    const shape = fusedShape(g, d.x, ms - run.vesicles[d.index].fusedAtMs!, d.r)!
    const p = pocketAt(g, d.x, shape.cy, shape.r)!
    const tear = tearsAt(g, run, ms).find((t) => Math.abs(t.x - d.x) < 1e-9)!
    expect(tear.xL).toBeCloseTo(p.xL, 6)
    expect(tear.xR).toBeCloseTo(p.xR, 6)
    expect(tear.half).toBeCloseTo((p.xR - p.xL) / 2, 6)
  })

  it('A1: a docked circle clears the outline EVERYWHERE, not just under its centre', () => {
    // The bug the rework surfaced: on the sloped slots a centre placed
    // r + MEM_PX above the wall at its own x was already through the outline
    // SIDEWAYS — a 10 px "tear" at the instant of fusion, before anything
    // had opened.
    const g = synapseGeometry()
    for (const d of activeZone(g).docked) {
      // Each slot is solved for ITS OWN radius — the sizes differ now.
      for (let i = 0; i <= 40; i++) {
        const x = d.x - d.r * 1.5 + (3 * d.r * i) / 40
        expect(
          Math.hypot(x - d.x, wallAt(g, x) - d.y),
          `slot ${d.index}, x=${x.toFixed(0)}`,
        ).toBeGreaterThan(d.r + 1.2)
      }
      expect(d.y).toBeCloseTo(dockedY(g, d.x, d.r), 6)
      // And the spread is the real one: ±10%, never more.
      expect(d.r / vesicleR(g)).toBeGreaterThanOrEqual(0.9 - 1e-9)
      expect(d.r / vesicleR(g)).toBeLessThanOrEqual(1.1 + 1e-9)
    }
  })

  it('A1: the pocket flattens into the wall, and the tear heals — nothing left by the end', () => {
    const g = synapseGeometry()
    const fused = run.vesicles
      .map((v) => v.fusedAtMs)
      .filter((m): m is number => m !== null)
    expect(fused.length).toBeGreaterThan(0)
    // The run is long enough to watch the last one finish.
    expect(Math.max(...fused) + FLATTEN_FROM_MS + FLATTEN_MS).toBeLessThan(SYNAPSE_MS)
    // The pocket's height above the wall shrinks monotonically to nothing.
    const d = activeZone(g).docked.find((d) => run.vesicles[d.index].fusedAtMs !== null)!
    const wall = wallAt(g, d.x)
    let prev = Infinity
    for (let k = 0; k <= 10; k++) {
      const age = FLATTEN_FROM_MS + (FLATTEN_MS * k) / 10
      const s = fusedShape(g, d.x, age)
      if (k === 10) {
        expect(s).toBeNull()
        break
      }
      expect(s).not.toBeNull()
      const proud = wall - (s!.cy - s!.r)
      expect(proud, `age ${age.toFixed(1)}`).toBeLessThan(prev)
      prev = proud
    }
    // And at the end of the run the wall is whole again: no tears anywhere.
    expect(tearsAt(g, run, SYNAPSE_MS)).toEqual([])
  })

  it('A2: the mouth opens WITH the release — cause on screen no later than effect', () => {
    const g = synapseGeometry()
    // Walk the legged clock for the first moment any ball is out in the gap.
    let outMs: number | null = null
    for (let i = 0; i <= 4000; i++) {
      const msAt = synapseClock(i / 4000) * SYNAPSE_MS
      if (transmitterCast(g, run, cleft, msAt).some((d) => d.where === 'gap')) {
        outMs = msAt
        break
      }
    }
    expect(outMs).not.toBeNull()
    // Within a blink of the first ball leaving, the wall is visibly torn...
    const soon = tearsAt(g, run, outMs! + 0.25)
    expect(soon.length).toBeGreaterThan(0)
    expect(Math.max(...soon.map((t) => t.half))).toBeGreaterThan(0)
    // ...and there is a moment with balls out in the gap AND a mouth fully
    // open — cause and effect on screen together.
    let together = false
    for (let i = 0; i <= 4000 && !together; i++) {
      const msAt = synapseClock(i / 4000) * SYNAPSE_MS
      const gapCount = transmitterCast(g, run, cleft, msAt).filter(
        (d) => d.where === 'gap',
      ).length
      if (gapCount < 5) continue
      together = tearsAt(g, run, msAt).some((t) => t.half > vesicleR(g) * 0.7)
    }
    expect(together, 'a moment with balls out AND the mouth fully open').toBe(true)
    // The cargo model still drains on its declared clock.
    const d = activeZone(g).docked.find((d) => run.vesicles[d.index].fusedAtMs !== null)!
    expect(fusedShape(g, d.x, 0)!.cargo).toBe(1)
    expect(fusedShape(g, d.x, CARGO_DRAIN_MS)!.cargo).toBe(0)
  })

  it('B3+J: what comes out is what was in — the ball count NEVER changes', () => {
    // ⚠ CONSERVATION, now a measurable fact: the same transmitter balls at
    // every moment of the run — in bubbles, in the gap, on seats, in the
    // bath. Nothing minted, nothing destroyed.
    const g = synapseGeometry()
    const total = activeZone(g).docked.length * 7
    for (let i = 0; i <= 24; i++) {
      const cast = transmitterCast(g, run, cleft, (i / 24) * SYNAPSE_MS)
      expect(cast.length, `at ${((i / 24) * SYNAPSE_MS).toFixed(0)}ms`).toBe(total)
    }
    // And the drawn ink agrees: exactly as many teal dots mid-release as at
    // rest — released transmitter MOVED, it was not minted.
    const ink = (u: number | null) => {
      const c = strictCanvas()
      drawSynapse(c.ctx, { run, cleft, u })
      return c.styles.filter((st) => st === TRANSMITTER_INK.dark).length
    }
    expect(ink(0.06)).toBe(ink(null))
  })

  it('C1: the middle vesicle releases too — three of five, a curated draw of the same chance', () => {
    // ⚠ The SEED is curated and declared (core/synapse.ts): the release
    // probability still comes from the calibrated rate (p ≈ 0.17/vesicle);
    // which draw of that chance plays is chosen so the middle slot goes.
    const fused = run.vesicles.filter((v) => v.fusedAtMs !== null).map((v) => v.index)
    expect(fused).toContain(Math.floor(POOL / 2))
    expect(fused.length).toBe(3)
    expect(fused.length).toBeLessThan(POOL)
    // ⚠ AND THEY ARE NEIGHBOURS (user, 2026-09-01: "place the active ones
    // closer to each other"): the fusing trio is a contiguous cluster.
    const sorted = [...fused].sort((a, b) => a - b)
    expect(sorted[sorted.length - 1] - sorted[0]).toBe(sorted.length - 1)
  })

  it("C2: a vesicle wears the wall's own band — leaflet ink WITH the oily core", () => {
    // "Make vesicles outline look the same as membrane": same material, same
    // two strokes. At rest every bubble (9 pool + 5 docked) lays a core stroke
    // of its own on top of the three membrane bands'.
    const g = synapseGeometry()
    const c = strictCanvas()
    drawSynapse(c.ctx, { run, cleft, u: null })
    const cores = c.styles.filter((s) => s === 'rgba(71, 85, 105, 0.75)').length
    expect(cores).toBeGreaterThanOrEqual(
      reservePool(g).length + activeZone(g).docked.length + 2,
    )
  })

  it('C3: one transmitter ink, teal, shaded — and never the ion gloss', () => {
    // Teal is nobody's ion colour (Na⁺ gold, K⁺ violet, Cl⁻ green, Ca²⁺ pink),
    // and the dot is a plain shaded gradient: light centre, dark rim, no glow
    // halo — the 2026-08-30 ruling is why it must not wear the ions' grammar.
    for (const k of Object.keys(GLOSSY_COLORS) as (keyof typeof GLOSSY_COLORS)[]) {
      expect(TRANSMITTER_INK.mid).not.toBe(GLOSSY_COLORS[k].mid)
    }
    // The dot itself: exactly one gradient, its three declared stops, no glow.
    const c = strictCanvas()
    transmitterDot(c.ctx, 50, 50, 3)
    expect(c.calls.filter((k) => k === 'createRadialGradient').length).toBe(1)
    expect(c.styles).toEqual([
      TRANSMITTER_INK.light,
      TRANSMITTER_INK.mid,
      TRANSMITTER_INK.dark,
    ])
  })

  it('C5: the spike-arrival membrane repaint is drawn UNDER the doors, never over them', () => {
    // ⚠ "At the start of the animation, Ca channels get covered by the bouton
    // membrane" (user, 2026-09-01). The hot repaint used to be painted last.
    // Counted as membrane-band ink laid BEFORE the first door stroke: the hot
    // moment must show exactly one more band than the cold one — the repaint —
    // and it must be under the doors for that count to grow.
    //
    // ⚠ The anchor is the door's white-lit species stroke, an ink ONLY the
    // channel drawing mixes — the raw ca.mid stopped working the day the ion
    // soup put a calcium ion's gradient stops on screen before anything else.
    const door = mix(GLOSSY_COLORS.ca.mid, '#ffffff', 0.4)
    const bandsBeforeDoors = (u: number | null): number => {
      const c = strictCanvas()
      drawSynapse(c.ctx, { run, cleft, u })
      const at = c.styles.indexOf(door)
      expect(at).toBeGreaterThan(0)
      return c.styles.slice(0, at).filter((s) => s === 'rgba(71, 85, 105, 0.75)').length
    }
    // ms 0.8: just past the spike's peak, vm well above −40 — the repaint is on.
    const hot = bandsBeforeDoors(0.8 / run.windowMs)
    // ms 30: long at rest — no repaint.
    const cold = bandsBeforeDoors(0.5)
    expect(hot).toBe(cold + 1)
  })

  // ─────────────────────────────── the corrections of 2026-09-01 (round 4)
  // "Released neurotransmitters disappear — they should stay and bind. The
  // middle vesicle does not move. Calcium should stay next to the docked
  // vesicles. The postsynaptic specialization is nonsymmetrical — redraw it."

  it('D1+J: caught balls sit in the mouths and STAY after the gap has emptied', () => {
    const g = synapseGeometry()
    // Sampled after every capture has settled — the two balls of a pair
    // land at different moments now that travel is slower.
    const midMs = cleft.peakOpenAtMs + 5
    const seated = transmitterCast(g, run, cleft, midMs).filter((d) => d.where === 'seat')
    expect(seated.length).toBeGreaterThan(2)
    expect(seated.length % 2).toBe(0)
    for (const m of seated) {
      const site = receptorSites(g).reduce((a, b) =>
        Math.abs(a.x - m.x) < Math.abs(b.x - m.x) ? a : b,
      )
      // In the mouth, on the cleft side of that receptor's own membrane.
      expect(m.y).toBeLessThan(faceAt(g, site.x))
      expect(m.y).toBeGreaterThan(faceAt(g, site.x) - 40)
    }
    // ⚠ THE SCIENCE SPLIT, amended twice (user, 2026-09-01: "stay in the
    // synaptic cleft for future reuptake"; then "white glow disappears, NTs
    // fly away, channel closes"): EVERY pair is now let go before its own
    // door shuts, so by the end NOTHING is still plugged — the gap holds
    // every captured ball, lingering for the transporters that work beyond
    // this window. The bulk clearance still departs.
    const end = transmitterCast(g, run, cleft, SYNAPSE_MS - 0.01)
    expect(end.filter((d) => d.where === 'seat').length).toBe(0)
    const boundReceptors = receptorSites(g).filter((_, r) => {
      const mine = (r + 0.5) / receptorSites(g).length
      return cleft.bound.some((b) => b > mine)
    }).length
    expect(boundReceptors).toBeGreaterThan(0)
    expect(end.filter((d) => d.where === 'gap').length).toBe(boundReceptors * 2)
    expect(sampleCleft(cleft, 'mM', 1)).toBeLessThan(0.002)
  })

  it("H2+J: cargo leaves ONLY through its own vesicle's mouth", () => {
    const g = synapseGeometry()
    const docked = activeZone(g).docked
    // Precompute frames across the release window, then follow each emitted
    // ball to its FIRST moment outside the bubble: it must be at its own
    // vesicle's mouth, not anywhere else on the wall.
    const frames: { x: number; y: number; where: string }[][] = []
    for (let s = 0; s <= 600; s++)
      frames.push(transmitterCast(g, run, cleft, 2 + (s / 600) * 3))
    for (let i = 0; i < docked.length * 7; i++) {
      const v = Math.floor(i / 7)
      if (run.vesicles[docked[v].index].fusedAtMs === null) continue
      const firstOut = frames.map((f) => f[i]).find((b) => b.where !== 'vesicle')
      expect(firstOut, `ball ${i} emerges`).toBeDefined()
      expect(Math.abs(firstOut!.x - docked[v].x), `ball ${i}`).toBeLessThan(
        vesicleR(g) * 1.6,
      )
    }
  })

  it('H5: the nudge leaves for the soma — travelling, SHRINKING and DIMMING off the canvas', () => {
    const g = synapseGeometry()
    // Nothing before the EPSP has its swing, nothing once it has left.
    expect(departingFlash(g, run, cleft, 0)).toBeNull()
    expect(departingFlash(g, run, cleft, SYNAPSE_MS)).toBeNull()
    // Find the launch on the model's own series.
    let t0 = -1
    for (let msAt = 0; msAt <= 20 && t0 < 0; msAt += 0.05) {
      if (departingFlash(g, run, cleft, msAt) !== null) t0 = msAt
    }
    expect(t0).toBeGreaterThan(cleft.peakOpenAtMs)
    const early = departingFlash(g, run, cleft, t0 + 0.2)!
    const late = departingFlash(g, run, cleft, t0 + POST_FLASH_MS * 0.9)!
    // ⚠ Ignites IN the cell (user, 2026-09-02: "a flash in the postsynaptic
    // cell, after Na ions enter"): inside the spine head, on canvas — below
    // the cleft, never in it — before running down and off the frame.
    expect(early.y).toBeGreaterThan(faceAt(g, g.head.cx))
    expect(early.y).toBeLessThan(SYN_H)
    // Travels down...
    expect(late.y).toBeGreaterThan(early.y)
    // ...reaching past the frame's bottom edge by the end of its run...
    expect(late.y).toBeGreaterThan(SYN_H * 0.9)
    // ...and DECAYS as it goes — the decrement is what makes it an EPSP.
    expect(late.alpha).toBeLessThan(early.alpha * 0.5)
    expect(late.r).toBeLessThan(early.r)
    expect(early.alpha).toBeLessThan(1)
  })

  it('D2: the middle vesicle fuses LAST, on camera, and its sink is a real motion', () => {
    const mid = Math.floor(POOL / 2)
    const midMs = run.vesicles[mid].fusedAtMs!
    expect(midMs).toBeDefined()
    // ⚠ It "did not move" because it moved FIRST, before the cloud gave the
    // eye a reason to be on the zone. Last now, with the gap already carrying
    // most of a packet when it goes.
    for (const v of run.vesicles) {
      if (v.fusedAtMs !== null) expect(midMs).toBeGreaterThanOrEqual(v.fusedAtMs)
    }
    expect(sampleCleft(cleft, 'mM', midMs / run.windowMs)).toBeGreaterThan(
      cleft.peakMM * 0.3,
    )
    // And the sink itself travels well over half a radius.
    const g = synapseGeometry()
    const d = activeZone(g).docked[mid]
    const openShape = fusedShape(g, d.x, PORE_OPEN_MS, d.r)!
    // Docked touches the wall now, so the sink is the mouth opening itself:
    // about half this vesicle's own radius.
    expect(openShape.cy - d.y).toBeGreaterThan(d.r * 0.45)
  })

  it('D3+J: fourteen calcium balls — waiting, entering on the real charge, then buffered deeper', () => {
    const g = synapseGeometry()
    // All present and waiting in the gap at frame one.
    const start = calciumCast(g, run, 0)
    expect(start.length).toBe(CA_N)
    for (const ion of start) {
      expect(ion.where).toBe('cleft')
      expect(ion.y).toBeGreaterThan(wallAt(g, ion.x))
      expect(ion.y).toBeLessThan(faceAt(g, ion.x))
    }
    // A crowd at the zone soon after the calcium peak; fewer by the end — the
    // terminal's own ~30 ms clearance — but buffered DEEPER inside, never
    // dimmed away, and the TOTAL never changes.
    const atPeak = calciumCast(g, run, run.caPeakMs + 2)
    expect(atPeak.length).toBe(CA_N)
    const zonePeak = atPeak.filter((d) => d.where === 'zone').length
    expect(zonePeak).toBeGreaterThan(7)
    const end = calciumCast(g, run, SYNAPSE_MS)
    expect(end.length).toBe(CA_N)
    const zoneEnd = end.filter((d) => d.where === 'zone').length
    expect(zoneEnd).toBeGreaterThan(0)
    expect(zoneEnd).toBeLessThan(zonePeak)
    expect(end.filter((d) => d.where === 'deep').length).toBe(CA_N - zoneEnd)
    // Buffered means grabbed NEARBY — a short slip off the knob, still in
    // the zone's vicinity, never carried across the terminal.
    for (const ion of end.filter((d) => d.where === 'deep')) {
      expect(ion.y).toBeLessThan(wallAt(g, ion.x) - vesicleR(g) * 0.7)
      expect(ion.y).toBeGreaterThan(wallAt(g, ion.x) - vesicleR(g) * 3.2)
      expect(Math.abs(ion.x - g.foot.x)).toBeLessThan(g.activeHalf + vesicleR(g) * 3)
    }
  })

  it("D4: the head's shoulders drop monotonically and congruently — no humps, no lopsided slab", () => {
    // ⚠ THE FAULT: beyond the zone the face kept tracking the bouton's wall,
    // which curves steeply UP there — so each shoulder rose into its own hump
    // before falling. Beyond the zone the membranes are not apposed, so the
    // face lets go: each side drops from its own edge on one shared curve.
    const g = synapseGeometry()
    const over = g.head.rx - g.activeHalf
    const baseL = faceAt(g, g.head.cx - g.activeHalf)
    const baseR = faceAt(g, g.head.cx + g.activeHalf)
    let prevL = -Infinity
    let prevR = -Infinity
    for (let k = 0; k <= 20; k++) {
      const off = g.activeHalf + (over * k) / 20
      const yL = faceAt(g, g.head.cx - off)
      const yR = faceAt(g, g.head.cx + off)
      // Monotone: only ever dropping away from the cleft.
      expect(yL, `left ${k}`).toBeGreaterThanOrEqual(prevL - 1e-9)
      expect(yR, `right ${k}`).toBeGreaterThanOrEqual(prevR - 1e-9)
      prevL = yL
      prevR = yR
      // Congruent: the same drop below each side's own base.
      expect(yL - baseL, `drop ${k}`).toBeCloseTo(yR - baseR, 6)
    }
    // And the head is a head now, not a slab four and a half times wider than
    // it is tall.
    expect(g.head.rx / g.head.ry).toBeLessThan(3.5)
  })

  // ─────────────────────────────── the storyboard round of 2026-09-01 (round 5)
  // "Flash on arrival, red depolarization tint, calcium at the docked
  // vesicles, transmitter spreading and floating away, receptors opening,
  // ions entering, the spine depolarizing and passing it on." Built on the
  // app's own charge ramp, with the two science corrections in E1 and E3.

  it("E1: the bouton's aura really goes RED at the spike; the spine's NEVER does", () => {
    // ⚠ The pushback, pinned: a spike overshoots past zero — red on the charge
    // ramp — while an EPSP is graded and stays negative for ever. If the
    // spine's aura ever reads positive, something is drawing a spike where
    // none happens.
    const atRest = synapseAuras(run, cleft, null)
    expect(atRest.pre).toBeLessThan(0)
    expect(atRest.post).toBeLessThan(0)
    const atPeak = synapseAuras(run, cleft, run.vmPeakMs / run.windowMs)
    expect(atPeak.pre).toBeGreaterThan(0)
    for (let i = 0; i <= 100; i++) {
      expect(synapseAuras(run, cleft, i / 100).post, `u=${i / 100}`).toBeLessThan(0)
    }
    // ⚠ The spine's drawn TINT is relative to rest — red = depolarized — and
    // paced by the DRAWN ions (user, 2026-09-02: "the sodium didn't even
    // penetrate the cell, but the yellow aura is already there"). Zero until
    // the first drawn ion enters its pore…
    const g2 = synapseGeometry()
    let firstEnter = Infinity
    let lastDone = -Infinity
    for (let r = 0; r < receptorSites(g2).length; r++) {
      const ow = receptorOpenWindow(g2, run, cleft, r)
      if (ow === null) continue
      for (let k = 0; k < 2; k++) {
        const enter = ow.openAt + NA_PAUSE_MS + k * 0.8 + NA_APPROACH_MS
        firstEnter = Math.min(firstEnter, enter)
        lastDone = Math.max(lastDone, enter + NA_CROSS_MS + NA_SETTLE_MS)
      }
    }
    for (let msAt = 0; msAt < firstEnter - 0.01; msAt += 0.25) {
      expect(spineTint(g2, run, cleft, msAt), `ms=${msAt}`).toBe(0)
    }
    // …full once every drawn ion has settled…
    expect(spineTint(g2, run, cleft, lastDone)).toBeCloseTo(1, 6)
    // …then cools on the membrane's own clock (τ), and never goes blue —
    // nothing hyperpolarizes at an AMPA synapse.
    const cooled = spineTint(g2, run, cleft, lastDone + SPINE_TAU_MS)
    expect(cooled).toBeGreaterThan(0.2)
    expect(cooled).toBeLessThan(0.45)
    for (let i = 0; i <= 100; i++) {
      expect(spineTint(g2, run, cleft, (i / 100) * SYNAPSE_MS)).toBeGreaterThanOrEqual(0)
    }
  })

  it('E2+J: each sodium ball WAITS above its receptor, crosses when it opens, and stays', () => {
    const g = synapseGeometry()
    const sites = receptorSites(g)
    // All present from frame one, waiting in the gap's own interior.
    const atRest = sodiumCast(g, run, cleft, 0)
    expect(atRest.length).toBe(sites.length * 2)
    for (const ion of atRest) {
      expect(ion.where).toBe('cleft')
      expect(ion.y).toBeLessThan(faceAt(g, ion.x))
      expect(ion.y).toBeGreaterThan(wallAt(g, ion.x))
    }
    // By the end, the pairs of every receptor that OPENED are in the spine —
    // and a receptor that never opened keeps its pair waiting, which is the
    // honest picture of a shut door.
    const end = sodiumCast(g, run, cleft, SYNAPSE_MS)
    const opened = sites.filter(
      (_, r) => cleft.peakOpen > (r + 0.5) / sites.length,
    ).length
    expect(opened).toBeGreaterThan(0)
    expect(opened).toBeLessThan(sites.length)
    expect(end.filter((d) => d.where === 'spine').length).toBe(opened * 2)
    expect(end.filter((d) => d.where === 'cleft').length).toBe(
      (sites.length - opened) * 2,
    )
    for (const ion of end.filter((d) => d.where === 'spine')) {
      expect(ion.y).toBeGreaterThan(faceAt(g, ion.x))
    }
  })

  it('21b-1a: the fingers reach for the CLEFT, clear of both neurons — not a second postsynaptic lobe', () => {
    // The complaint (2026-09-04): the fingers sat level with the spine's
    // shoulders and read as a second postsynaptic specialization. They now
    // hover at the gap's own height, and no membrane point of either neuron
    // lies inside them.
    const g = synapseGeometry()
    for (const side of [1, -1] as const) {
      const f = astrocyteFinger(g, side)
      // At the cleft's height, beyond the zone's mouth.
      const edgeX = g.foot.x + side * g.activeHalf
      expect(Math.abs(f.tip.y - (wallAt(g, edgeX) + CLEFT_PX * 0.5))).toBeLessThan(1)
      expect(Math.abs(f.tip.x - g.foot.x)).toBeGreaterThan(g.activeHalf + f.rTip + 20)
      // The spine's face, sampled across its whole width, stays outside.
      for (let i = 0; i <= 60; i++) {
        const x = g.head.cx - g.head.rx + (i / 60) * 2 * g.head.rx
        expect(astrocyteHolds(f, { x, y: faceAt(g, x) }), `face at ${x.toFixed(0)}`).toBe(
          false,
        )
      }
      // And the bouton's own floor, wherever it exists.
      for (let i = 0; i <= 80; i++) {
        const x = g.foot.x - 450 + (i / 80) * 900
        const floor = boutonFloorAt(g.fit, x)
        if (floor === null) continue
        expect(astrocyteHolds(f, { x, y: floor }), `wall at ${x.toFixed(0)}`).toBe(false)
      }
    }
  })

  it('21b-1b: every scene name is tied to its part, from measured open water', () => {
    const g = synapseGeometry()
    const cos = synapseCallouts(g)
    expect(cos.map((c) => c.label.term).sort()).toEqual(
      ['astrocyte', 'dendritic spine', 'synaptic cleft', 'vesicle'].sort(),
    )
    const fins = [astrocyteFinger(g, 1), astrocyteFinger(g, -1)]
    for (const co of cos) {
      // A connector must LEAVE its box — a zero-length line points at nothing.
      const cxl = co.label.x + co.label.w / 2
      const cyl = co.label.y + co.label.h / 2
      expect(Math.hypot(co.to.x - cxl, co.to.y - cyl), co.label.term).toBeGreaterThan(20)
      // The box sits in the frame and in open water: outside both fingers,
      // off the bouton's body, off the spine.
      const corners = [
        { x: co.label.x, y: co.label.y },
        { x: co.label.x + co.label.w, y: co.label.y },
        { x: co.label.x, y: co.label.y + co.label.h },
        { x: co.label.x + co.label.w, y: co.label.y + co.label.h },
      ]
      for (const p of corners) {
        expect(p.x, co.label.term).toBeGreaterThanOrEqual(0)
        expect(p.x, co.label.term).toBeLessThan(SYN_W)
        expect(p.y, co.label.term).toBeGreaterThan(0)
        expect(p.y, co.label.term).toBeLessThan(SYN_H)
        for (const f of fins) {
          expect(astrocyteHolds(f, p), `${co.label.term} on a finger`).toBe(false)
        }
        const floor = boutonFloorAt(g.fit, p.x)
        if (floor !== null) {
          expect(p.y, `${co.label.term} on the bouton`).toBeGreaterThan(floor - 2)
        }
        // ⚠ And clear of the bottom-left SHELF (user, 2026-09-04: "bottom
        // left label is covered by buttons container"): the D06/D17 button
        // plate owns that corner of the screen — a generous reserve covering
        // the buttons laid side by side or stacked.
        expect(p.x < 560 && p.y > SYN_H - 130, `${co.label.term} under the shelf`).toBe(
          false,
        )
      }
      // And no two labels overlap: each centre hits its OWN box.
      expect(
        spokenTermAt(
          cos.map((c) => c.label),
          cxl,
          cyl,
        ),
      ).toBe(co.label.term)
    }
  })

  it('E3+J (21b-1): clearance is COLLECTION — the escapees are taken up, most by the astrocyte', () => {
    // Supersedes "rest in the bath" (2026-09-04): an escaping ball's journey
    // now ENDS somewhere — inside a glial finger, in through a transporter
    // tick, or (the declared minor route) inside the spine.
    const g = synapseGeometry()
    const first = cleft.firstFusionMs!
    expect(
      transmitterCast(g, run, cleft, first - 0.1).filter(
        (d) => d.where === 'glia' || d.where === 'spine' || d.where === 'bath',
      ).length,
    ).toBe(0)
    const end = transmitterCast(g, run, cleft, SYNAPSE_MS - 0.01)
    const glia = end.filter((d) => d.where === 'glia')
    const spineUp = end.filter((d) => d.where === 'spine')
    expect(glia.length + spineUp.length).toBeGreaterThan(5)
    // Most by the astrocyte — the declared split for glutamate (measured
    // with these seeds: 10 glial to 1 neuronal) — and the minor route is
    // really shown, not just declared.
    expect(glia.length).toBeGreaterThanOrEqual((glia.length + spineUp.length) * 0.7)
    expect(spineUp.length).toBeGreaterThanOrEqual(1)
    // And every collected ball really is INSIDE a finger — held by the
    // capsule's own decision, on one side or the other.
    for (const b of glia) {
      expect(
        ([1, -1] as const).some((s) => astrocyteHolds(astrocyteFinger(g, s), b)),
        `ball at ${b.x.toFixed(0)},${b.y.toFixed(0)}`,
      ).toBe(true)
    }
    // 'bath' is a travelling phase now, not a place to end up.
    expect(end.filter((d) => d.where === 'bath').length).toBe(0)
    // ⚠ THE BOOKS BALANCE: unfused bubbles keep their cargo, and every
    // emitted ball is accounted for — seated, lingering in the gap, or
    // collected. Never gone.
    const fusedCount = run.vesicles.filter((v) => v.fusedAtMs !== null).length
    expect(end.filter((d) => d.where === 'vesicle').length).toBe(
      (activeZone(g).docked.length - fusedCount) * 7,
    )
    expect(
      glia.length +
        spineUp.length +
        end.filter((d) => d.where === 'seat').length +
        end.filter((d) => d.where === 'gap').length,
    ).toBe(fusedCount * 7)
  })

  it("E4+J: a resting zone ball sits at a vesicle's FEET, outside every lumen", () => {
    const g = synapseGeometry()
    const r = vesicleR(g)
    // Sampled at the run's end, RESTING only: an ion the buffers are already
    // carrying away (still 'zone' mid-transit) has left its knob by travel.
    const zone = calciumCast(g, run, SYNAPSE_MS).filter(
      (d) => d.where === 'zone' && d.y > wallAt(g, d.x) - vesicleR(g) * 1.2,
    )
    expect(zone.length).toBeGreaterThan(0)
    for (const ion of zone) {
      const docked = activeZone(g).docked
      const nearest = docked.reduce((a, b) =>
        Math.hypot(a.x - ion.x, a.y - ion.y) < Math.hypot(b.x - ion.x, b.y - ion.y)
          ? a
          : b,
      )
      // Anchored to a slot, never over a lumen, inside the wall.
      expect(Math.abs(ion.x - nearest.x)).toBeLessThan(r * 2)
      for (const d of docked) {
        expect(Math.hypot(ion.x - d.x, ion.y - d.y)).toBeGreaterThan(d.r * 0.9)
      }
      expect(ion.y).toBeLessThan(wallAt(g, ion.x))
    }
  })

  it('F1: the spike ARRIVES — a flash entering at the top edge and running down the stalk', () => {
    const g = synapseGeometry()
    // The stalk's top is on the canvas's top edge, inside the bouton's span.
    const top = neckTop(g)
    expect(top.y).toBe(0)
    expect(top.x).toBeGreaterThan(g.fit.ox + BOUTON_BOX.x * g.fit.k)
    expect(top.x).toBeLessThan(g.fit.ox + (BOUTON_BOX.x + BOUTON_BOX.w) * g.fit.k)
    // Nothing at rest, nothing after the spike has passed.
    expect(arrivalFlash(g, run, 0)).toBeNull()
    expect(arrivalFlash(g, run, 30)).toBeNull()
    // While the terminal charges, the knot exists, stays on the stalk's own
    // x, and MOVES DOWN with time — an arrival, not a lamp. The moment it
    // first shows is asked of the run, not guessed.
    let t0 = -1
    for (let msAt = 0; msAt <= run.vmPeakMs; msAt += 0.02) {
      if (arrivalFlash(g, run, msAt) !== null) {
        t0 = msAt
        break
      }
    }
    expect(t0).toBeGreaterThanOrEqual(0)
    expect(t0).toBeLessThan(run.vmPeakMs)
    const early = arrivalFlash(g, run, t0)!
    const late = arrivalFlash(g, run, run.vmPeakMs)!
    expect(early).not.toBeNull()
    expect(late).not.toBeNull()
    expect(early.x).toBe(top.x)
    expect(late.y).toBeGreaterThan(early.y)
    expect(early.alpha).toBeGreaterThan(0)
    expect(late.alpha).toBeLessThanOrEqual(1)
  })

  it('F2: the chain has BEATS — legs that hold the picture still between events', () => {
    // A beat is a leg whose model span is a fraction of a millisecond given
    // real screen time: the pause the user asked for, built as the limit case
    // of "slow the leg, never the item".
    const beats = CLOCK_LEGS.filter(
      (l) => (l.to - l.from) * SYNAPSE_MS <= 0.2 && l.share >= 0.03,
    )
    expect(beats.length).toBeGreaterThanOrEqual(3)
    // And they sit between the events, not inside one: no fusion happens
    // during a beat.
    for (const beat of beats) {
      for (const v of run.vesicles) {
        if (v.fusedAtMs === null) continue
        const inBeat =
          v.fusedAtMs > beat.from * SYNAPSE_MS && v.fusedAtMs < beat.to * SYNAPSE_MS
        expect(inBeat, `fusion at ${v.fusedAtMs} in beat ${beat.what}`).toBe(false)
      }
    }
  })

  it("F3: the spine's aura starts above EVERY point of the face — no straight edge inside", () => {
    // ⚠ The "linear cut": a gradient that began at the face's centre height
    // clamped to zero alpha above that line, so the aura stopped along a ruler
    // edge wherever the curved face rose past it. The wash must begin above
    // the whole face, leaving the clip — the shape itself — as its only
    // boundary.
    const g = synapseGeometry()
    const top = spineAuraTop(g)
    for (let i = 0; i <= 40; i++) {
      const x = g.head.cx - g.head.rx + (2 * g.head.rx * i) / 40
      expect(top, `x=${x.toFixed(0)}`).toBeLessThanOrEqual(faceAt(g, x) + 3)
    }
  })

  // ─────────────────────────────── the soup round of 2026-09-01 (round 7)
  // "Calcium should pass through the channels, not teleport. A big bright
  // flash. No reset button — the run resets itself. Ion soup in all three
  // spaces, so ions come from somewhere and stay somewhere."

  it('G1+J: every calcium ball CROSSES the wall in order — below it, through it, above it', () => {
    const g = synapseGeometry()
    // Follow three balls through the entry window and require the sequence —
    // the same ball, below the wall, then in it, then above it.
    const frames: { x: number; y: number }[][] = []
    for (let s = 0; s <= 500; s++) frames.push(calciumCast(g, run, (s / 500) * 10))
    for (const i of [0, 5, 9]) {
      let seenBelow = false
      let seenInWall = false
      let seenAbove = false
      for (const f of frames) {
        const p = f[i]
        const wall = wallAt(g, p.x)
        if (!seenBelow && p.y > wall + 6) seenBelow = true
        if (seenBelow && !seenInWall && Math.abs(p.y - wall) <= 6) seenInWall = true
        if (seenInWall && !seenAbove && p.y < wall - 6) seenAbove = true
      }
      expect(seenBelow, `ball ${i} starts below the wall`).toBe(true)
      expect(seenInWall, `ball ${i} passes through the wall`).toBe(true)
      expect(seenAbove, `ball ${i} arrives above the wall`).toBe(true)
    }
  })

  it('G2: the arrival flash is a JOLT — big against the stalk it runs down', () => {
    expect(FLASH_R).toBeGreaterThanOrEqual(100)
    const g = synapseGeometry()
    const flash = arrivalFlash(g, run, run.vmPeakMs)!
    expect(flash.r).toBe(FLASH_R)
    // Wider than the stalk itself: an event, not a status light.
    expect(FLASH_R).toBeGreaterThan(NECK_PX)
  })

  it('G3: the soup carries the right asymmetries, each ion in its own compartment', () => {
    const g = synapseGeometry()
    const soup = ionSoup(g)
    const count = (where: string, kind: string) =>
      soup.filter((s) => s.where === where && s.kind === kind).length
    // Potassium-rich inside BOTH cells; sodium/chloride-rich outside.
    expect(count('pre', 'k')).toBeGreaterThan(count('pre', 'na') * 3)
    expect(count('post', 'k')).toBeGreaterThan(count('post', 'na'))
    expect(count('out', 'na')).toBeGreaterThan(count('out', 'k') * 2)
    expect(count('out', 'cl')).toBeGreaterThan(count('out', 'k'))
    // ⚠ No soup calcium, and no soup sodium in the cleft: the balls with
    // journeys to make belong to the CASTS — one population per substance,
    // never two.
    expect(count('out', 'ca')).toBe(0)
    expect(count('pre', 'ca')).toBe(0)
    // Containment: pre ions inside the terminal's wall, post ions below the
    // face, at their own x.
    for (const s of soup) {
      if (s.where === 'pre') {
        expect(s.y, `pre ion at ${s.x.toFixed(0)}`).toBeLessThan(wallAt(g, s.x) - 5)
      }
      if (s.where === 'post') {
        expect(s.y, `post ion at ${s.x.toFixed(0)}`).toBeGreaterThan(faceAt(g, s.x))
      }
    }
    // Deterministic: the same soup every frame.
    expect(ionSoup(g)).toEqual(soup)
  })

  it('G4: the run resets itself, on a declared hold — and the soup declares itself too', () => {
    // Long enough to read the ending, short enough to feel like a reset.
    expect(SYNAPSE_END_HOLD_MS).toBeGreaterThanOrEqual(1000)
    expect(SYNAPSE_END_HOLD_MS).toBeLessThanOrEqual(4000)
    expect(SCALE_NOTES).toContain(SOUP_NOTE)
    expect(SOUP_NOTE).toMatch(/145 mM/)
  })

  // ─────────────────────────────── the continuity round of 2026-09-01 (round 9)
  // "Entering ions look half transparent, as if born inside the channels; no
  // neurotransmitters should materialize in the cleft — the ones which leave
  // the vesicles are the ones that bind."

  it('J1: NOTHING teleports, NOTHING fades — every ball is continuous across the watched run', () => {
    // ⚠ THE RULING (user, 2026-09-01): every ion and every transmitter ball
    // has identity — visible from frame one, one continuous trajectory, no
    // fades, no births, no jumps. Walked in SCREEN time, where a teleport
    // would actually be seen.
    const g = synapseGeometry()
    const N = 1200
    let prev: { x: number; y: number }[][] | null = null
    for (let s = 0; s <= N; s++) {
      const msAt = synapseClock(s / N) * SYNAPSE_MS
      const frames = [
        transmitterCast(g, run, cleft, msAt),
        calciumCast(g, run, msAt),
        sodiumCast(g, run, cleft, msAt),
      ].map((cast) => cast.map((d) => ({ x: d.x, y: d.y })))
      // Fixed populations, at every single moment.
      expect(frames[0].length).toBe(activeZone(g).docked.length * 7)
      expect(frames[1].length).toBe(CA_N)
      expect(frames[2].length).toBe(receptorSites(g).length * 2)
      if (prev) {
        for (const [ci, cast] of frames.entries()) {
          for (const [i, p] of cast.entries()) {
            const q = prev[ci][i]
            const jump = Math.hypot(p.x - q.x, p.y - q.y)
            if (jump > 45) {
              throw new Error(
                `cast ${ci} ball ${i} jumped ${jump.toFixed(0)}px at ${msAt.toFixed(2)}ms`,
              )
            }
          }
        }
      }
      prev = frames
    }
    // And none of them can fade: the whole cast is drawn at one constant
    // alpha, always.
    expect(CAST_ALPHA).toBeGreaterThanOrEqual(0.9)
  })

  it("K1: the trigger is SEATED before the triggered — calcium at each fusing vesicle's feet first", () => {
    // ⚠ (user, 2026-09-01: "vesicles should only start merging when calcium
    // ions are bound at the SNARE"). Fusion IS calcium seated at the vesicle,
    // so the drawn schedule must land ions at each fusing slot's feet BEFORE
    // its fusion instant — the charge they carry genuinely came in first.
    const g = synapseGeometry()
    for (const [v, d] of activeZone(g).docked.entries()) {
      const tf = run.vesicles[d.index].fusedAtMs
      if (tf === null) continue
      const near = calciumCast(g, run, tf - 0.05).filter(
        (ion) => ion.where === 'zone' && Math.abs(ion.x - d.x) < d.r * 2.2,
      )
      expect(near.length, `vesicle ${v} fusing at ${tf.toFixed(2)}ms`).toBeGreaterThan(0)
    }
  })

  it('N1: the active-zone caption sits beside its zone, clear of every bubble', () => {
    // ⚠ (user, 2026-09-01: "adjust labels places"). The caption used to hang
    // centred over the docked row; when docking became touching-contact the
    // text landed ON the vesicles.
    const g = synapseGeometry()
    const l = activeZoneLabelAt(g)
    for (const d of activeZone(g).docked) {
      expect(Math.hypot(l.x - d.x, l.y - d.y), `slot ${d.index}`).toBeGreaterThan(
        d.r + 12,
      )
    }
    for (const p of reservePool(g)) {
      expect(Math.hypot(l.x - p.x, l.y - p.y)).toBeGreaterThan(vesicleR(g) * 1.1 + 12)
    }
    // Outside the zone's end, above the membrane it names.
    expect(l.x).toBeGreaterThan(g.foot.x + g.activeHalf)
    expect(l.y).toBeLessThan(wallAt(g, g.foot.x + g.activeHalf))
  })

  it('O1: the SNARE is drawn, and the calcium rests ON its knobs', () => {
    // ⚠ (user, 2026-09-01: "without it, Ca ions bind to nothing"). Each
    // docked vesicle carries knobs at its base; every calcium ball that ends
    // the run resting in the zone sits within a vesicle-radius of one.
    const g = synapseGeometry()
    for (const d of activeZone(g).docked) {
      const m = snareMini(g, d)
      expect(m.knobs.length).toBe(2)
      for (const knob of m.knobs) {
        const off = Math.abs(knob.x - d.x)
        expect(off).toBeGreaterThan(d.r * 0.9)
        expect(off).toBeLessThan(d.r * 1.3)
        expect(knob.y).toBeLessThan(wallAt(g, knob.x))
        expect(knob.y).toBeGreaterThan(wallAt(g, knob.x) - 5 - d.r * 0.7)
      }
    }
    // Resting AT the wall — an ion the buffers are already carrying away
    // (still 'zone' mid-transit) is exempt: it has left its knob by travel.
    const resting = calciumCast(g, run, SYNAPSE_MS).filter(
      (i) => i.where === 'zone' && i.y > wallAt(g, i.x) - vesicleR(g) * 1.2,
    )
    expect(resting.length).toBeGreaterThan(0)
    const knobs = activeZone(g).docked.flatMap((d) => snareMini(g, d).knobs)
    for (const ion of resting) {
      const nearest = Math.min(...knobs.map((k) => Math.hypot(k.x - ion.x, k.y - ion.y)))
      expect(nearest, `ion at ${ion.x.toFixed(0)}`).toBeLessThan(vesicleR(g))
    }
  })

  it("O2: at the zone's depth the membrane is molecules — on the walls, never in a tear", () => {
    const g = synapseGeometry()
    const first = run.vesicles
      .map((v) => v.fusedAtMs)
      .filter((m): m is number => m !== null)
      .sort((a, b) => a - b)[0]
    const tears = tearsAt(g, run, first + 2)
    const pts = membraneLipids(g, tears)
    expect(pts.length).toBeGreaterThan(60)
    for (const p of pts) {
      const onWall = Math.abs(p.at.y - wallAt(g, p.at.x)) < 0.5
      const onFace = Math.abs(p.at.y - faceAt(g, p.at.x)) < 0.5
      expect(onWall || onFace, `at ${p.at.x.toFixed(0)}`).toBe(true)
      if (onWall) {
        for (const t of tears) {
          expect(
            p.at.x < t.xL - 2 || p.at.x > t.xR + 2,
            `in tear at ${p.at.x.toFixed(0)}`,
          ).toBe(true)
        }
      }
    }
  })

  it('Q1: a receptor never shows open before its pair is SEATED, and holds a beat after', () => {
    // ⚠ (user, 2026-09-01: "postsynaptic channels open before neurotransmitters
    // got bound"). The drawn channel states are gated on the same seat window
    // the cast animates; here the window is held against the cast itself.
    const g = synapseGeometry()
    const sites = receptorSites(g)
    let checked = 0
    for (let r = 0; r < sites.length; r++) {
      const win = receptorSeatWindow(g, run, cleft, r)
      if (win.seatedAt === null) continue
      checked++
      expect(win.seatedAt).toBeGreaterThan(cleft.firstFusionMs!)
      if (win.releasedAt !== null) {
        expect(win.releasedAt - win.seatedAt).toBeGreaterThan(RELEASE_HOLD_MS * 0.4)
      }
      // The cast agrees: just after seatedAt the pair is on its seats; a
      // moment before, it is not yet complete.
      const seatXs = [sites[r].x - 3.6, sites[r].x + 3.6]
      const seatedNear = (msAt: number) =>
        transmitterCast(g, run, cleft, msAt).filter(
          (d) => d.where === 'seat' && seatXs.some((x) => Math.abs(d.x - x) < 2.5),
        ).length
      expect(seatedNear(win.seatedAt + 0.05), `receptor ${r} after`).toBe(2)
      expect(seatedNear(win.seatedAt - 0.3), `receptor ${r} before`).toBeLessThan(2)
    }
    expect(checked).toBeGreaterThan(2)
  })

  it('R1: the postsynaptic chain runs in order — seat, hold, open, pause, ions, pause, flash', () => {
    const g = synapseGeometry()
    const sites = receptorSites(g)
    let firstArrival: number | null = null
    let checked = 0
    for (let r = 0; r < sites.length; r++) {
      const ow = receptorOpenWindow(g, run, cleft, r)
      const win = receptorSeatWindow(g, run, cleft, r)
      if (ow === null) continue
      checked++
      // Open exactly one declared hold after the pair seated.
      expect(ow.openAt).toBeCloseTo(win.seatedAt! + BIND_HOLD_MS, 9)
      // No sodium of this receptor leaves the cleft before its pause ends.
      const before = sodiumCast(g, run, cleft, ow.openAt + NA_PAUSE_MS - 0.05)
      expect(before[r * 2].where, `receptor ${r}`).toBe('cleft')
      expect(before[r * 2 + 1].where, `receptor ${r}`).toBe('cleft')
      const arrive =
        ow.openAt + NA_PAUSE_MS + 0.35 + NA_APPROACH_MS + NA_CROSS_MS + NA_SETTLE_MS
      firstArrival = firstArrival === null ? arrive : Math.min(firstArrival, arrive)
    }
    expect(checked).toBeGreaterThan(2)
    // The flash launches only after the first pair has flowed in, plus a beat.
    let t0 = -1
    for (let msAt = 0; msAt <= 30 && t0 < 0; msAt += 0.05) {
      if (departingFlash(g, run, cleft, msAt) !== null) t0 = msAt
    }
    expect(t0).toBeGreaterThan(firstArrival!)
  })

  it('R2: a calcium ball rests ON its knob for over a second of screen time before its vesicle goes', () => {
    const g = synapseGeometry()
    const screenMsBetween = (m1: number, m2: number) => {
      let share = 0
      for (const leg of CLOCK_LEGS) {
        const a = Math.max(m1 / SYNAPSE_MS, leg.from)
        const b = Math.min(m2 / SYNAPSE_MS, leg.to)
        if (b > a) share += ((b - a) / (leg.to - leg.from)) * leg.share
      }
      return share * SYNAPSE_SCREEN_MS
    }
    let checked = 0
    for (const d of activeZone(g).docked) {
      const tf = run.vesicles[d.index].fusedAtMs
      if (tf === null) continue
      checked++
      const knobs = snareMini(g, d).knobs
      let restAt: number | null = null
      for (let msAt = 0; msAt <= tf && restAt === null; msAt += 0.05) {
        const seatedHere = calciumCast(g, run, msAt).some((ion) =>
          knobs.some((k) => Math.hypot(ion.x - k.x, ion.y - k.y) < 8),
        )
        if (seatedHere) restAt = msAt
      }
      expect(restAt, `slot ${d.index}`).not.toBeNull()
      expect(screenMsBetween(restAt!, tf), `slot ${d.index}`).toBeGreaterThan(900)
    }
    expect(checked).toBe(3)
  })

  it("C6: the spine's flanks are curves, not corner lines", () => {
    // The sides used to be a straight diagonal plus a vertical hop — two
    // corners per side. Each flank is one cubic now, so drawing the spine at
    // rest lays bezier calls (fill + the band's two traced strokes).
    const c = strictCanvas()
    drawSynapse(c.ctx, { run, cleft, u: null })
    expect(c.calls.filter((k) => k === 'bezierCurveTo').length).toBeGreaterThanOrEqual(6)
  })
})

/** Where a leg begins on the SCREEN's own scale — the sum of the shares before
 *  it. Kept here rather than exported: it is a fact about the table, and a test
 *  that recomputes it is a test that would notice the table changing shape. */
function legStart(leg: (typeof CLOCK_LEGS)[number]): number {
  let at = 0
  for (const l of CLOCK_LEGS) {
    if (l === leg) return at
    at += l.share
  }
  return at
}

// ── The timeline tool (user, 2026-09-01). Point letters cite that round's
// ACTION LIST: A2 "rewind, never teleport" needs the inverse clock to be a
// true inverse, A5 puts the dots on S12's bar at the run's OWN moments.

describe('the timeline tool — S12 events on the bar', () => {
  it('screenOfModel is the true inverse of the legged clock (A2, A5)', () => {
    for (let i = 0; i <= 200; i++) {
      const u = i / 200
      expect(screenOfModel(synapseClock(u))).toBeCloseTo(u, 5)
    }
    // A dot cannot leave the bar however wrong its moment is.
    expect(screenOfModel(-0.2)).toBe(0)
    expect(screenOfModel(1.4)).toBe(1)
  })

  it('the run yields every event, dated in order, inside the window (A5)', () => {
    const events = synapseEvents(run, cleft)
    // ⚠ OBVIOUS events only (user, 2026-09-01: "what is 'the nudge'? Nothing
    // significant seems to be happening") — the below-the-edge EPSP flash is
    // not a dot; the visible ion flow is.
    expect(events.map((e) => e.id)).toEqual([
      'spike',
      'calcium',
      'fusion',
      'binding',
      'opens',
      'sodium-in',
      'clearing',
    ])
    for (const [i, e] of events.entries()) {
      expect(e.ms).toBeGreaterThan(0)
      expect(e.ms).toBeLessThanOrEqual(SYNAPSE_MS)
      if (i > 0) expect(e.ms).toBeGreaterThan(events[i - 1].ms)
      // Chip grammar: a name, not a sentence.
      expect(e.label.length).toBeGreaterThan(0)
      expect(e.label).not.toMatch(/[.!]/)
      expect(e.note.length).toBeGreaterThan(0)
    }
  })

  it('the fusion dot sits on the run’s own first fusion (A5)', () => {
    const events = synapseEvents(run, cleft)
    const first = run.vesicles.reduce(
      (best: number | null, v) =>
        v.fusedAtMs === null
          ? best
          : best === null
            ? v.fusedAtMs
            : Math.min(best, v.fusedAtMs),
      null,
    )
    expect(events.find((e) => e.id === 'fusion')?.ms).toBe(first)
  })

  it('the departing flash obeys its one shared launch time', () => {
    const g = synapseGeometry()
    const launch = nudgeLaunchMs(g, run, cleft)
    expect(launch).not.toBeNull()
    const at = launch as number
    // Dark just before, lit just after.
    expect(departingFlash(g, run, cleft, at - 0.01)).toBeNull()
    expect(departingFlash(g, run, cleft, at + 0.05)).not.toBeNull()
  })
})

// ── Stillness, the kept aura, the reflection pauses, and seats that fit
// (user, 2026-09-01). Point letters cite that round's ACTION LIST.

describe('bound ions and the reflection pauses', () => {
  const g = synapseGeometry()
  const sites = receptorSites(g)
  /** The first receptor whose gate opens — the chain the eye follows. */
  const first = (() => {
    let best: { r: number; openAt: number; closeAt: number } | null = null
    for (let r = 0; r < sites.length; r++) {
      const ow = receptorOpenWindow(g, run, cleft, r)
      if (ow && (best === null || ow.openAt < best.openAt)) best = { r, ...ow }
    }
    return best!
  })()
  const screenMsAt = (modelMs: number) =>
    screenOfModel(modelMs / run.windowMs) * SYNAPSE_SCREEN_MS

  it('a seated sodium ion does not budge, a waiting one still jiggles (A1)', () => {
    const seatedAt =
      first.openAt + NA_PAUSE_MS + NA_APPROACH_MS + NA_CROSS_MS + NA_SETTLE_MS + 0.3
    const idx = first.r * 2 // k = 0 of the first-opening receptor
    const a = sodiumCast(g, run, cleft, seatedAt, 100)[idx]
    const b = sodiumCast(g, run, cleft, seatedAt, 900)[idx]
    expect(a.x).toBe(b.x)
    expect(a.y).toBe(b.y)
    // The same ion while still WAITING in the cleft keeps its thermal jiggle.
    const w1 = sodiumCast(g, run, cleft, 1, 100)[idx]
    const w2 = sodiumCast(g, run, cleft, 1, 900)[idx]
    expect(Math.hypot(w1.x - w2.x, w1.y - w2.y)).toBeGreaterThan(0.1)
  })

  it('a calcium ion on its knob is still; free and buffered ions follow their rules (A1)', () => {
    // Ion 0 is deadline-clamped to be seated before the first fusion.
    const firstFusion = run.vesicles.reduce(
      (m: number | null, v) =>
        v.fusedAtMs === null ? m : m === null ? v.fusedAtMs : Math.min(m, v.fusedAtMs),
      null,
    ) as number
    const a = calciumCast(g, run, firstFusion - 0.1, 100)[0]
    const b = calciumCast(g, run, firstFusion - 0.1, 900)[0]
    expect(a.x).toBe(b.x)
    expect(a.y).toBe(b.y)
    // Waiting in the cleft at the start: jiggling.
    const w1 = calciumCast(g, run, 0.05, 100)[0]
    const w2 = calciumCast(g, run, 0.05, 900)[0]
    expect(Math.hypot(w1.x - w2.x, w1.y - w2.y)).toBeGreaterThan(0.1)
    // Buffered at the end: bound to a protein, so still again.
    const e1 = calciumCast(g, run, SYNAPSE_MS, 100)[0]
    const e2 = calciumCast(g, run, SYNAPSE_MS, 900)[0]
    expect(e1.x).toBe(e2.x)
    expect(e1.y).toBe(e2.y)
  })

  it('the transmitter glow holds while plugged and dies before anything moves; sodium NEVER glows (A2)', () => {
    const rel = receptorSeatWindow(g, run, cleft, first.r).releasedAt as number
    // Release is scheduled off the door itself: this lead before its close.
    expect(rel).toBeCloseTo(first.closeAt - NT_DEPART_LEAD_MS, 9)
    const arrive =
      first.openAt + NA_PAUSE_MS + NA_APPROACH_MS + NA_CROSS_MS + NA_SETTLE_MS
    const during = (arrive + (rel - GLOW_FADE_MS)) / 2
    // The transmitter's aura at full, ON the tracked seat.
    const seat = ntSeatAt(g, first.r, 0, receptorOpenFrac(g, run, cleft, first.r, during))
    const ntHeld = bindPulses(g, run, cleft, during).find(
      (p) => Math.hypot(p.x - seat.x, p.y - seat.y) < 0.5,
    )
    expect(ntHeld?.a).toBe(1)
    // Mid-fade: dimming, still there.
    const fading = bindPulses(g, run, cleft, rel - GLOW_FADE_MS / 2).find(
      (q) =>
        Math.hypot(
          q.x - ntSeatAt(g, first.r, 0, 1).x,
          q.y - ntSeatAt(g, first.r, 0, 1).y,
        ) < 0.5,
    )
    expect(fading).toBeDefined()
    expect(fading!.a).toBeGreaterThan(0)
    expect(fading!.a).toBeLessThan(1)
    // Gone by the departure instant — the glow dies before anything flies.
    for (const q of bindPulses(g, run, cleft, rel + 0.01)) {
      expect(Math.hypot(q.x - seat.x, q.y - seat.y)).toBeGreaterThan(12)
    }
    // ⚠ AND SODIUM NEVER GLOWS (user, 2026-09-02: "Na ions should not get
    // white aura after they penetrated the postsynaptic cell") — an ion that
    // has crossed is not BOUND to anything. No pulse ever sits on a settled
    // sodium ion, at any moment of the run.
    for (const ms of [arrive + 0.1, during, first.closeAt - 0.1, first.closeAt + 2]) {
      const na = sodiumCast(g, run, cleft, ms, 500).filter((d) => d.where === 'spine')
      for (const p of bindPulses(g, run, cleft, ms)) {
        for (const ion of na) {
          expect(Math.hypot(p.x - ion.x, p.y - ion.y)).toBeGreaterThan(3)
        }
      }
    }
  })

  it('the plugged pair rides the mouth apart, stays till release, flies BEFORE the door shuts (A2)', () => {
    // The seat itself travels with the subunit.
    const shut = ntSeatAt(g, first.r, 0, 0)
    const parted = ntSeatAt(g, first.r, 0, 1)
    // The drawn socket's own slide is under 2 px at this channel size — the
    // guard checks the seat MOVES and the ball tracks it, not the amplitude.
    expect(Math.abs(parted.x - shut.x)).toBeGreaterThan(1)
    // While the channel eases open, a cast ball sits EXACTLY on the moving
    // seat — and its mirrored partner on the other subunit.
    const midOpen = first.openAt + OPEN_EASE_MS / 2
    const want0 = ntSeatAt(
      g,
      first.r,
      0,
      receptorOpenFrac(g, run, cleft, first.r, midOpen),
    )
    const want1 = ntSeatAt(
      g,
      first.r,
      1,
      receptorOpenFrac(g, run, cleft, first.r, midOpen),
    )
    const seatsNow = transmitterCast(g, run, cleft, midOpen, 0).filter(
      (d) => d.where === 'seat',
    )
    for (const want of [want0, want1]) {
      expect(
        seatsNow.some((d) => Math.hypot(d.x - want.x, d.y - want.y) < 1e-6),
        'a plugged ball must sit exactly on the tracked seat',
      ).toBe(true)
    }
    // Still plugged while the ions flow and the pause holds…
    const rel = receptorSeatWindow(g, run, cleft, first.r).releasedAt as number
    const late = transmitterCast(g, run, cleft, rel - 0.05, 0).filter(
      (d) => d.where === 'seat',
    )
    expect(late.length).toBeGreaterThanOrEqual(2)
    // …and off the seat once released, while the door is STILL open.
    expect(rel).toBeLessThan(first.closeAt)
    const flown = transmitterCast(g, run, cleft, (rel + first.closeAt) / 2, 0)
    const nearSeat = flown.filter(
      (d) => d.where === 'seat' && Math.abs(d.x - receptorSites(g)[first.r].x) < 12,
    )
    expect(nearSeat.length).toBe(0)
    expect(
      receptorOpenFrac(g, run, cleft, first.r, (rel + first.closeAt) / 2),
    ).toBeGreaterThan(0.5)
  })

  it('glow-off, departure and close land as readable beats, in order (A2, A4)', () => {
    const rel = receptorSeatWindow(g, run, cleft, first.r).releasedAt as number
    const lastSettled =
      first.openAt + NA_PAUSE_MS + 0.8 + NA_APPROACH_MS + NA_CROSS_MS + NA_SETTLE_MS
    const glowOffStart = rel - GLOW_FADE_MS
    expect(glowOffStart).toBeGreaterThan(lastSettled)
    expect(first.closeAt).toBeGreaterThan(rel)
    // "1 s pause, channel stays open" — walked on the SCREEN clock.
    expect(screenMsAt(glowOffStart) - screenMsAt(lastSettled)).toBeGreaterThan(700)
    // Departure → close is its own beat, not a blink.
    expect(screenMsAt(first.closeAt) - screenMsAt(rel)).toBeGreaterThan(250)
  })

  it('walks the clock: ~1 s between opening and flow, and ~1 s of reflection before the nudge and the close (A3, A4)', () => {
    // Opening → the first ion moves.
    expect(
      screenMsAt(first.openAt + NA_PAUSE_MS) - screenMsAt(first.openAt),
    ).toBeGreaterThan(700)
    // Last ion of the first chain settled → its door closes.
    const lastSettled =
      first.openAt + NA_PAUSE_MS + 0.8 + NA_APPROACH_MS + NA_CROSS_MS + NA_SETTLE_MS
    expect(first.closeAt).toBeGreaterThan(lastSettled)
    expect(screenMsAt(first.closeAt) - screenMsAt(lastSettled)).toBeGreaterThan(700)
    // First ion settled → the nudge departs.
    const firstSettled =
      first.openAt + NA_PAUSE_MS + NA_APPROACH_MS + NA_CROSS_MS + NA_SETTLE_MS
    const launch = nudgeLaunchMs(g, run, cleft) as number
    expect(launch).toBeGreaterThan(firstSettled)
    expect(screenMsAt(launch) - screenMsAt(firstSettled)).toBeGreaterThan(700)
  })

  it('every knob seats exactly one calcium ion, dead centre; surplus ions never pretend (A5)', () => {
    const docked = activeZone(g).docked
    const knobs = docked.flatMap((d) => snareMini(g, d).knobs)
    expect(knobs.length).toBe(docked.length * 2)
    for (let i = 0; i < docked.length * 2; i++) {
      const knob = snareMini(g, docked[i % docked.length]).knobs[
        Math.floor(i / docked.length) % 2
      ]
      let seated = false
      for (let ms = 0; ms <= SYNAPSE_MS; ms += 0.2) {
        const dot = calciumCast(g, run, ms, 0)[i]
        if (Math.hypot(dot.x - knob.x, dot.y - knob.y) < 1e-6) {
          seated = true
          break
        }
      }
      expect(seated, `bound ion ${i} must rest exactly on its knob`).toBe(true)
    }
    // The four surplus ions stay free — never on ANY knob.
    for (let i = docked.length * 2; i < CA_N; i++) {
      for (let ms = 0; ms <= SYNAPSE_MS; ms += 0.2) {
        const dot = calciumCast(g, run, ms, 0)[i]
        for (const k of knobs)
          expect(Math.hypot(dot.x - k.x, dot.y - k.y)).toBeGreaterThan(2)
      }
    }
  })
})

describe('the fusion finishes before the binding (2026-09-02)', () => {
  it('flows straight from drain into merge — no frozen middle — and every pocket is flat before the first seat', () => {
    // No dead zone in the schedule: flattening begins the instant the cargo
    // has drained (the old gap between the two froze the shape at ~5.2 ms).
    expect(FLATTEN_FROM_MS).toBeLessThanOrEqual(CARGO_DRAIN_MS)
    const g = synapseGeometry()
    let firstSeat: number | null = null
    for (let r = 0; r < receptorSites(g).length; r++) {
      const sw = receptorSeatWindow(g, run, cleft, r)
      if (sw.seatedAt !== null && (firstSeat === null || sw.seatedAt < firstSeat))
        firstSeat = sw.seatedAt
    }
    expect(firstSeat).not.toBeNull()
    for (const d of activeZone(g).docked) {
      const tf = run.vesicles[d.index]?.fusedAtMs ?? null
      if (tf === null) continue
      // At the moment the first pair seats, this pocket is already one smooth
      // wall — fuse → release → bind, in that order on screen.
      expect(fusedShape(g, d.x, (firstSeat as number) - tf, d.r)).toBeNull()
    }
  })
})

describe('the arrival afterglow (2026-09-02)', () => {
  it('dies on the SCREEN clock — no slow leg can stretch it into a hang', () => {
    // "The yellow ball keeps hanging on the top of the page for multiple
    // seconds": 10 MODEL ms of afterglow spanned ~13 real seconds in the slow
    // early legs. The fade is a screen event, so it is walked on the screen
    // clock: half-bright at half its life, gone at the end of it.
    // ⚠ The BUDGET is the point, so it is pinned absolutely — a guard that
    // only sampled at fractions of the constant passed at any length (caught
    // by breaking it: 13 s slipped through).
    expect(FLASH_FADE_SCREEN_MS).toBeLessThanOrEqual(2500)
    const g = synapseGeometry()
    const peakU = screenOfModel(run.vmPeakMs / run.windowMs)
    const msAtScreen = (screenMs: number) =>
      synapseClock(peakU + screenMs / SYNAPSE_SCREEN_MS) * run.windowMs
    const mid = arrivalFlash(g, run, msAtScreen(FLASH_FADE_SCREEN_MS * 0.5))
    expect(mid).not.toBeNull()
    expect(mid!.alpha).toBeCloseTo(0.5, 1)
    expect(arrivalFlash(g, run, msAtScreen(FLASH_FADE_SCREEN_MS + 60))).toBeNull()
  })
})
