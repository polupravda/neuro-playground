import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  LABEL_FADE_U,
  LABEL_STOPS,
  LUMEN,
  OUTSIDE,
  SNARE_SCREEN_MS,
  SN_H,
  SN_W,
  clathrinAt,
  complexinAt,
  drawSnare2,
  fusedCentreY,
  lumenArc,
  munc13At,
  nsfAt,
  protonsAt,
  pumpAt,
  munc18At,
  rabAt,
  ropeEnds,
  sensorHead,
  sensorSites,
  snareCallouts,
  snareGeometry,
  snareLabels,
  snareStubs,
  tetherAt,
  transmitterAt,
  transporterAt,
  transporterSpot,
  vesicleCentre,
  vesicleRing,
  wallShift,
  calciumFlight,
  type NtDot,
} from './snareScene'
import {
  CLAMP_OFF,
  NT_COUNT,
  PRIMED_ZIP,
  STAGE_SPANS,
  cargoAt,
  poreAt,
  uAtMouthOpen,
  uAtThrough,
  zipAt,
} from '../core/vesicleCycle'
import { HILL_N } from '../core/synapse'
import { HEAD_R } from './bilayer'
import { spokenTermAt } from './spokenLabels'
import { DEMOS } from '../state/demoStore'

const at = (id: string) => {
  const s = STAGE_SPANS.find((x) => x.id === id)!
  return (s.from + s.to) / 2
}

describe('D06 — the SNARE drawer', () => {
  it('A3: draws every stage without a NaN or an unparseable colour', () => {
    for (let i = 0; i <= 40; i++) {
      const c = strictCanvas()
      expect(() => drawSnare2(c.ctx, { u: i / 40 })).not.toThrow()
      expect(c.calls.length).toBeGreaterThan(200)
    }
  })

  it('A3: the vesicle is a RING OF MEMBRANE, not a hollow circle', () => {
    // ⚠ "Vesicles are circles" was a reported fault once already: the material
    // is the point, and it is why fusion is possible at all. Drawn out of the
    // app's own bilayer paver, so a molecular vesicle here and a molecular
    // membrane on the neuron cannot become two different materials.
    // ⚠ ASKED OF THE VESICLE, not of the frame. The first version of this
    // counted arcs and strokes over the whole picture — and the TERMINAL'S wall
    // alone cleared the threshold, so swapping the vesicle for a bare circle
    // did not fail it.
    const g = snareGeometry()
    const ring = vesicleRing(g, at('tether'))
    // A hollow circle is one arc; a paved ring is dozens of molecules.
    expect(ring.length).toBeGreaterThan(20)
    // Every one of them sits on the vesicle's own circle, facing its middle.
    const c0 = vesicleCentre(g, at('tether'))
    for (const p of ring) {
      expect(Math.hypot(p.at.x - c0.x, p.at.y - c0.y)).toBeCloseTo(g.r, 6)
      // `inward` points at the centre — which is what makes the leaflets land
      // the right way round on a curved wall.
      const toCentre = Math.hypot(c0.x - p.at.x, c0.y - p.at.y)
      expect((p.inward.x * (c0.x - p.at.x) + p.inward.y * (c0.y - p.at.y)) / toCentre).toBeCloseTo(1, 6)
    }
    // ⚠ IDENTITY (user, 2026-09-01: "give identity to phospholipids, so they
    // merge with the membrane without teleporting"). The pore is no longer a
    // gap of DELETED molecules: the ring keeps every molecule at every stage —
    // the merged part lies UNROLLED along the wall, become wall.
    expect(vesicleRing(g, at('pore')).length).toBe(ring.length)
    const flatU = STAGE_SPANS.find((s) => s.id === 'retrieve')!.from
    const flat = vesicleRing(g, flatU)
    expect(flat.length).toBe(ring.length)
    for (const p of flat) {
      expect(Math.abs(p.at.y - g.wallY), `x=${p.at.x.toFixed(0)}`).toBeLessThan(1)
    }
    // ⚠ AND IT COMES BACK, AT THE SAME SPOT (user, 2026-09-02): retrieval is
    // the sweep run backwards on the same centre line, so by the end the same
    // ring is a closed circle again — and since the approach leg (2026-09-03)
    // it lifts all the way back UP to the crowd height the run opened at.
    const back = vesicleRing(g, 1)
    expect(back.length).toBe(ring.length)
    for (const p of back) {
      expect(Math.hypot(p.at.x - g.cx, p.at.y - g.highY)).toBeCloseTo(g.r, 4)
    }
  })

  it('K2: every phospholipid of the fusing ring travels — none deleted, none jumping', () => {
    // Fixed order, fixed count, bounded steps: molecule i can be followed from
    // free bubble to flat wall, and the unrolling is CONTINUOUS.
    const g = snareGeometry()
    const n = vesicleRing(g, 0).length
    let prev: { x: number; y: number }[] | null = null
    for (let s = 0; s <= 400; s++) {
      const ring = vesicleRing(g, s / 400)
      expect(ring.length).toBe(n)
      const pts = ring.map((p) => p.at)
      if (prev) {
        for (const [i, p] of pts.entries()) {
          const jump = Math.hypot(p.x - prev[i].x, p.y - prev[i].y)
          if (jump > 30) {
            throw new Error(`lipid ${i} jumped ${jump.toFixed(0)}px at u=${(s / 400).toFixed(3)}`)
          }
        }
      }
      prev = pts
    }
    // And exact material conservation: the unrolled arclength IS the ring's
    // own circumference, so the wall gains what the bubble was made of.
    const spanOnWall = (u: number) => {
      const onWall = vesicleRing(g, u).filter((p) => Math.abs(p.at.y - g.wallY) < 1)
      if (onWall.length === 0) return 0
      const xs = onWall.map((p) => p.at.x)
      return Math.max(...xs) - Math.min(...xs)
    }
    // Measured at the flat moment — the end of the collapse — because the
    // retrieval then takes the material back off the wall again.
    expect(spanOnWall(STAGE_SPANS.find((s) => s.id === 'retrieve')!.from)).toBeGreaterThan(
      Math.PI * g.r * 2 * 0.85,
    )
  })

  it('K3: the wall\'s own molecules are PUSHED ASIDE, never skipped', () => {
    // The fusing vesicle adds membrane; the original wall slides outward to
    // make the room, and no molecule of it is ever deleted.
    const g = snareGeometry()
    expect(wallShift(g, at('trigger'))).toBe(0)
    const early = wallShift(g, at('pore'))
    const flatU = STAGE_SPANS.find((s) => s.id === 'retrieve')!.from
    const late = wallShift(g, flatU)
    expect(early).toBeGreaterThan(0)
    expect(late).toBeGreaterThan(early)
    // Fully unrolled: chord (→0) plus half the circumference on each side.
    expect(late).toBeCloseTo(Math.PI * g.r, 0)
    // ⚠ AND THE RETRIEVAL TAKES IT BACK (user, 2026-09-02): the bubble
    // reforming pulls its material off the wall again, so the wall's own
    // molecules slide home — while the mouth is open, the shift is partway.
    expect(wallShift(g, at('retrieve'))).toBeGreaterThan(0)
    expect(wallShift(g, at('retrieve'))).toBeLessThan(late)
    expect(wallShift(g, 1)).toBe(0)
  })

  it('K4: each calcium ion FLOATS IN from beyond the frame, seats on ITS site, and floats out', () => {
    const g = snareGeometry()
    // Four ions, from the first frame — off-canvas, not absent.
    const start = calciumFlight(g, 0)
    expect(start.length).toBe(HILL_N)
    for (const ion of start) {
      expect(ion.x).toBeGreaterThan(SN_W)
      expect(ion.seated).toBe(false)
    }
    // When the sensor is full, every ion is seated exactly on its own site.
    const uFull = at('zipper')
    const seated = calciumFlight(g, uFull)
    const sites = sensorSites(g, uFull)
    for (const [i, ion] of seated.entries()) {
      expect(ion.seated).toBe(true)
      expect(ion.x).toBeCloseTo(sites[i].x, 6)
      expect(ion.y).toBeCloseTo(sites[i].y, 6)
    }
    // By the end they have floated out again — off-frame, by travel.
    for (const ion of calciumFlight(g, 1)) {
      expect(ion.seated).toBe(false)
      expect(ion.x).toBeGreaterThan(SN_W)
    }
    // And nothing jumps on the way: continuity, walked.
    let prev: { x: number; y: number }[] | null = null
    for (let s = 0; s <= 400; s++) {
      const ions = calciumFlight(g, s / 400)
      if (prev) {
        for (const [i, p] of ions.entries()) {
          const jump = Math.hypot(p.x - prev[i].x, p.y - prev[i].y)
          if (jump > 40) {
            throw new Error(`ca ${i} jumped ${jump.toFixed(0)}px at u=${(s / 400).toFixed(3)}`)
          }
        }
      }
      prev = ions
    }
  })

  it('A3: the vesicle is pulled onto the wall, and only by the machinery', () => {
    const g = snareGeometry()
    const free = vesicleCentre(g, 0).y
    const docked = vesicleCentre(g, at('prime')).y
    const pulled = vesicleCentre(g, STAGE_SPANS.find((s) => s.id === 'zipper')!.to).y
    expect(docked).toBeGreaterThan(free)
    // The last of the way is the ZIP's doing, not docking's — which is the
    // mechanism: winding a rope between two things pulls them together.
    expect(pulled).toBeGreaterThan(docked)
  })

  it('A3: four sites, filling one at a time, and never rearranging', () => {
    const g = snareGeometry()
    expect(sensorSites(g, 0).length).toBe(HILL_N)
    // ⚠ THEY DO NOT REARRANGE. The sites ride the sensor's HEAD — through the
    // grip, and through the release swing after the fourth ion lands. What
    // must not change is their arrangement about that head: a sensor whose
    // sites shuffled as they filled would be two things changing at once, and
    // a child could not tell which one is the count.
    const relative = (u: number) => {
      const h = sensorHead(g, u)
      return sensorSites(g, u).map((s) => [
        Number((s.x - h.x).toFixed(9)),
        Number((s.y - h.y).toFixed(9)),
      ])
    }
    expect(relative(at('zipper'))).toEqual(relative(at('trigger')))
    expect(relative(at('dock'))).toEqual(relative(at('trigger')))
    // And they really are carried along rather than pinned to the canvas.
    expect(sensorSites(g, at('zipper'))[0].y).not.toBeCloseTo(
      sensorSites(g, at('trigger'))[0].y,
      3,
    )
    expect(sensorSites(g, at('zipper')).every((s) => s.full)).toBe(true)
    expect(sensorSites(g, at('dock')).every((s) => !s.full)).toBe(true)
  })

  it('the sensor RIDES its vesicle down, GRIPS the rope while counting, and lets go on the fourth ion', () => {
    // The complaint (2026-09-02): "it's not clear how synaptotagmin affects
    // the SNARE complex to start pulling." The relation is contact: the head
    // grips the half-wound rope through priming and the whole calcium count,
    // and swings down to the wall only when the zip begins. Since the
    // approach leg (2026-09-03) there is a phase BEFORE the rope exists — the
    // sensor then rides its own vesicle's shoulder, because that is the
    // membrane it lives in.
    const g = snareGeometry()
    for (const u of [0, at('approach'), at('tether')]) {
      const c = vesicleCentre(g, u)
      const h = sensorHead(g, u)
      expect(Math.hypot(h.x - c.x, h.y - c.y)).toBeCloseTo(g.r * 1.18, 6)
    }
    const gripOf = (u: number) => {
      const ends = ropeEnds(g, u)
      const mid = { x: (ends.wall.x + ends.ves.x) / 2, y: (ends.wall.y + ends.ves.y) / 2 }
      const h = sensorHead(g, u)
      return Math.hypot(h.x - mid.x, h.y - mid.y)
    }
    // Holding: the head stays within its own radius of the rope's midpoint —
    // touching the thing it controls — through priming and the count.
    for (const u of [at('prime'), at('trigger')]) {
      expect(gripOf(u)).toBeLessThan(g.r * 0.35)
    }
    // Released: by mid-zipper it has left the rope and dropped to the wall.
    const zipEnd = STAGE_SPANS.find((s) => s.id === 'zipper')!.to
    const h = sensorHead(g, zipEnd)
    expect(gripOf(zipEnd)).toBeGreaterThan(g.r * 0.4)
    expect(g.wallY - h.y).toBeLessThan(g.r * 0.5)
  })

  it('the callouts tie each name to its part, at all four stills, and vanish while it runs', () => {
    const g = snareGeometry()
    // The four labelled stills (2026-09-04): the opening cast, the release
    // stop (the transient crew's one chance to be named), the recycling stop,
    // and the closing cast — Rab gone (re-armed off-stage), pump and protons
    // arrived.
    const expected: [number, string[]][] = [
      [
        0,
        ['Munc13', 'Munc18', 'Rab-GTP', 'synaptotagmin', 't-SNARE', 'tether', 'v-SNARE', 'vesicle'],
      ],
      [LABEL_STOPS[0], ['SNARE complex', 'calcium', 'complexin', 'transmitter']],
      [LABEL_STOPS[1], ['NSF', 'clathrin']],
      [LABEL_STOPS[2], ['transmitter', 'transporter', 'proton pump', 'protons']],
      // ⚠ The closing still IS the opening still (user, 2026-09-04): the same
      // eight names, Rab-GTP back among them, the working machines faded.
      [
        1,
        ['Munc13', 'Munc18', 'Rab-GTP', 'synaptotagmin', 't-SNARE', 'tether', 'v-SNARE', 'vesicle'],
      ],
    ]
    for (const [u, terms] of expected) {
      const cos = snareCallouts(g, u)
      expect(cos.map((c) => c.label.term).sort(), `u=${u}`).toEqual([...terms].sort())
      for (const co of cos) {
        // A connector must actually LEAVE its label box — a zero-length line
        // points at nothing.
        const cxl = co.label.x + co.label.w / 2
        const cyl = co.label.y + co.label.h / 2
        expect(Math.hypot(co.to.x - cxl, co.to.y - cyl), `${co.label.term} u=${u}`).toBeGreaterThan(
          20,
        )
        // And every label sits inside the frame, below the transport plate
        // that overlays the canvas top.
        expect(co.label.y, co.label.term).toBeGreaterThan(52)
        expect(co.label.y + co.label.h, co.label.term).toBeLessThan(SN_H)
        expect(co.label.x, co.label.term).toBeGreaterThanOrEqual(0)
        expect(co.label.x + co.label.w, co.label.term).toBeLessThan(SN_W)
        // Each label's centre hits ITS OWN box — no two labels overlap.
        expect(
          spokenTermAt(
            cos.map((c) => c.label),
            co.label.x + co.label.w / 2,
            co.label.y + co.label.h / 2,
          ),
          `overlap at u=${u}`,
        ).toBe(co.label.term)
      }
    }
    // Clickable at rest, at the end, and while a checkpoint HOLDS the run —
    // never while it is moving.
    expect(snareLabels(g, 0).length).toBe(8)
    expect(snareLabels(g, LABEL_FADE_U + 0.01).length).toBe(0)
    expect(snareLabels(g, LABEL_STOPS[0]).length).toBe(0)
    expect(snareLabels(g, LABEL_STOPS[0], true).length).toBe(4)
    expect(snareLabels(g, LABEL_STOPS[1], true).length).toBe(2)
    expect(snareLabels(g, LABEL_STOPS[2], true).length).toBe(4)
    expect(snareLabels(g, 1).length).toBe(8)
  })

  it('A1+A2: the frame holds the whole journey — wall low, vesicle starting high and undocked', () => {
    const g = snareGeometry()
    // A1: the wall is pushed to the frame's lower reaches (was 0.72 of the
    // height), so the top is free water to arrive through.
    expect(g.wallY / SN_H).toBeGreaterThan(0.8)
    // A2: the run opens with the vesicle wholly in the top half, at the crowd
    // height, and it drifts DOWN monotonically to the tethered height.
    const start = vesicleCentre(g, 0)
    expect(start.y).toBe(g.highY)
    expect(start.y + g.r).toBeLessThan(SN_H * 0.5)
    const approach = STAGE_SPANS.find((s) => s.id === 'approach')!
    let prev = start.y
    for (let i = 1; i <= 60; i++) {
      const y = vesicleCentre(g, approach.from + (approach.to - approach.from) * (i / 60)).y
      expect(y).toBeGreaterThanOrEqual(prev)
      prev = y
    }
    expect(prev).toBeCloseTo(g.freeY, 6)
  })

  it('A3: the tether reaches out, takes the Rab by its lit badge, and hands over', () => {
    const g = snareGeometry()
    // Idle at the start: the tip is down by the wall, nowhere near the bubble.
    const t0 = tetherAt(g, 0)
    expect(t0.hold).toBe(0)
    expect(g.wallY - t0.tip.y).toBeLessThan(g.r)
    // Holding: through the tether stage the tip IS the Rab's shoulder, and the
    // badge is lit — GTP, "I am full and ready".
    const uT = at('tether')
    const held = tetherAt(g, uT)
    const rab = rabAt(g, uT)
    expect(Math.hypot(held.tip.x - rab.x, held.tip.y - rab.y)).toBeLessThan(1)
    expect(rab.gtp).toBe(1)
    // Spent across docking, extracted across priming, released by its end.
    const primeEnd = STAGE_SPANS.find((s) => s.id === 'prime')!.to
    expect(rabAt(g, at('prime')).gtp).toBe(0)
    expect(rabAt(g, primeEnd).alpha).toBe(0)
    expect(tetherAt(g, primeEnd).hold).toBe(0)
    // And the catch is a TRAVEL, not a teleport: tip and Rab walked.
    let prevTip: { x: number; y: number } | null = null
    let prevRab: { x: number; y: number; alpha: number } | null = null
    for (let s = 0; s <= 400; s++) {
      const tip = tetherAt(g, s / 400).tip
      const r2 = rabAt(g, s / 400)
      if (prevTip) {
        const jump = Math.hypot(tip.x - prevTip.x, tip.y - prevTip.y)
        if (jump > 30) throw new Error(`tether tip jumped ${jump.toFixed(0)}px at u=${(s / 400).toFixed(3)}`)
      }
      if (prevRab && prevRab.alpha > 0.05 && r2.alpha > 0.05) {
        const jump = Math.hypot(r2.x - prevRab.x, r2.y - prevRab.y)
        if (jump > 30) throw new Error(`rab jumped ${jump.toFixed(0)}px at u=${(s / 400).toFixed(3)}`)
      }
      prevTip = tip
      prevRab = r2
    }
  })

  it('A3: three separate SNAREs before docking, one rope after — never both', () => {
    const g = snareGeometry()
    // The halves exist on their own sides from the first frame.
    expect(snareStubs(g, 0)).not.toBeNull()
    expect(snareStubs(g, at('tether'))).not.toBeNull()
    // Just before the join — which the dock leg's HOLD places at the end of
    // its ramp, not of its span — the three tips have converged on one
    // meeting point…
    const s = snareStubs(g, uAtThrough('dock', 1) - 1e-4)!
    expect(Math.hypot(s.vs.to.x - s.syx.to.x, s.vs.to.y - s.syx.to.y)).toBeLessThan(4)
    expect(Math.hypot(s.s25.to.x - s.syx.to.x, s.s25.to.y - s.syx.to.y)).toBeLessThan(4)
    // …and from the join on the stubs are gone — through the dock leg's still
    // beat and ever after: the rope owns the drawing, and the two
    // representations are never both on screen.
    expect(snareStubs(g, uAtThrough('dock', 1))).toBeNull()
    expect(snareStubs(g, STAGE_SPANS.find((x) => x.id === 'dock')!.to)).toBeNull()
    expect(snareStubs(g, at('prime'))).toBeNull()
  })

  it('A3: Munc18 clasps the folded syntaxin, and Munc13 stands up to open it', () => {
    const g = snareGeometry()
    // At rest the minder sits ON the folded tip — a hand on the thing it holds.
    const s0 = snareStubs(g, 0)!
    const m0 = munc18At(g, 0)
    expect(Math.hypot(m0.x - s0.syx.to.x, m0.y - s0.syx.to.y)).toBeLessThan(g.r * 0.05)
    expect(m0.alpha).toBe(1)
    // Docking: the arm rises to the tip, the minder is pushed aside…
    expect(munc13At(g, at('dock')).tip.y).toBeLessThan(munc13At(g, 0).tip.y - g.r * 0.1)
    expect(munc18At(g, at('dock')).x).toBeLessThan(m0.x)
    // …and both are gone once the rope is winding.
    expect(munc18At(g, STAGE_SPANS.find((x) => x.id === 'prime')!.to).alpha).toBe(0)
  })

  it('A3: complexin lies across the primed rope through the count, and is flicked off with the release', () => {
    const g = snareGeometry()
    // Not there while the rope is still assembling.
    expect(complexinAt(g, at('dock'))).toBeNull()
    // Seated through the count: full ink, on the rope.
    const uTrig = at('trigger')
    const c = complexinAt(g, uTrig)!
    expect(c.alpha).toBeCloseTo(1, 9)
    const ends = ropeEnds(g, uTrig)
    const mid = { x: (ends.wall.x + ends.ves.x) / 2, y: (ends.wall.y + ends.ves.y) / 2 }
    expect(Math.hypot(c.x - mid.x, c.y - mid.y)).toBeLessThan(g.r * 0.35)
    // Flicked off in the same window that frees the sensor (CLAMP_OFF): faded
    // out exactly when the two hands have opened.
    const zipSpan = STAGE_SPANS.find((x) => x.id === 'zipper')!
    const cOff = complexinAt(g, zipSpan.from + (zipSpan.to - zipSpan.from) * CLAMP_OFF)!
    expect(cOff.alpha).toBeCloseTo(0, 9)
  })

  it('A2 (2026-09-03): the lumen\'s mouth lies exactly ON the wall line — no gap, no double paint', () => {
    // The complaint: "a gap or an overlap is occurring between bg of vesicle
    // and outside the cell space." The chord closing the lumen wash was solved
    // on the RING's radius and drawn on the lumen's — off the wall line by up
    // to half a membrane, and still painting after the lumen had submerged.
    const g = snareGeometry()
    let sawOpen = 0
    let sawNone = 0
    for (let s = 0; s <= 800; s++) {
      // Walk the same centre the drawing uses; the decision under test is
      // lumenArc at that centre.
      const cy = fusedCentreY(g, s / 800)
      const lum = lumenArc(g, cy)
      if (lum === 'full') continue
      if (lum === 'none') {
        sawNone++
        // Truly submerged: 'none' may only be declared once the lumen's
        // centre is below the wall line (the old code smeared an arc here).
        expect(cy).toBeGreaterThan(g.wallY)
        continue
      }
      sawOpen++
      // Both arc endpoints sit exactly on the wall line — the chord IS the
      // wall, so lumen wash and outside wash meet edge to edge.
      const yEnd = cy + lum.rLum * Math.sin(lum.a)
      expect(yEnd).toBeCloseTo(g.wallY, 6)
    }
    // The walk really exercises both regimes.
    expect(sawOpen).toBeGreaterThan(10)
    expect(sawNone).toBeGreaterThan(10)
  })

  it('A4 (2026-09-03): the lumen is the OUTSIDE\'s own paint — one ink, seamless fusion', () => {
    // Not a hex that approximates the bath: the SAME string, so the two
    // regions composite identically over the same backdrop and the moment the
    // pore opens nothing has to change colour.
    expect(LUMEN).toBe(OUTSIDE)
  })

  it('A5 (2026-09-03): the rope rides its membranes — a flat cis-complex after fusion, never hanging', () => {
    const g = snareGeometry()
    // Docked: the vesicle end really is up on the bubble.
    const before = ropeEnds(g, at('prime'))
    expect(before.ves.y).toBeLessThan(g.wallY - 4)
    // Late in the collapse the whole rope lies IN the one wall…
    const col = STAGE_SPANS.find((s) => s.id === 'collapse')!
    const flat = ropeEnds(g, col.from + (col.to - col.from) * 0.9)
    expect(Math.abs(flat.ves.y - g.wallY)).toBeLessThan(1)
    expect(Math.abs(flat.wall.y - (g.wallY - 17))).toBeLessThan(4)
    // …has travelled OUTWARD with the membrane flow, not hung at the centre…
    expect(flat.ves.x).toBeGreaterThan(g.cx + g.r)
    // …and has not stretched: a complex is a complex whichever membrane it is
    // in. (The old drawing pinned the ves end where the bubble used to be.)
    const len = (e: { wall: { x: number; y: number }; ves: { x: number; y: number } }) =>
      Math.hypot(e.wall.x - e.ves.x, e.wall.y - e.ves.y)
    expect(len(flat)).toBeLessThan(g.r * 0.6)
    // And the end WALKS there — continuity over the whole run, both ends.
    let prev: { wall: { x: number; y: number }; ves: { x: number; y: number } } | null = null
    for (let s = 0; s <= 800; s++) {
      const e = ropeEnds(g, s / 800)
      if (prev) {
        for (const k of ['wall', 'ves'] as const) {
          const jump = Math.hypot(e[k].x - prev[k].x, e[k].y - prev[k].y)
          if (jump > 25) {
            throw new Error(`rope ${k} end jumped ${jump.toFixed(0)}px at u=${(s / 800).toFixed(3)}`)
          }
        }
      }
      prev = e
    }
  })

  it('A1 (2026-09-03): the left copy is the right copy REFLECTED — a section through the ring', () => {
    const g = snareGeometry()
    const mx = (x: number) => 2 * g.cx - x
    for (const u of [0, at('tether'), at('prime'), at('trigger'), at('zipper')]) {
      const e1 = ropeEnds(g, u)
      const e2 = ropeEnds(g, u, -1)
      expect(e2.wall.x).toBeCloseTo(mx(e1.wall.x), 9)
      expect(e2.wall.y).toBeCloseTo(e1.wall.y, 9)
      expect(e2.ves.x).toBeCloseTo(mx(e1.ves.x), 9)
      const h1 = sensorHead(g, u)
      const h2 = sensorHead(g, u, -1)
      expect(h2.x).toBeCloseTo(mx(h1.x), 9)
      expect(h2.y).toBeCloseTo(h1.y, 9)
      const t1 = tetherAt(g, u)
      const t2 = tetherAt(g, u, -1)
      expect(t2.tip.x).toBeCloseTo(mx(t1.tip.x), 9)
      expect(t2.base.x).toBeCloseTo(mx(t1.base.x), 9)
      const r1 = rabAt(g, u)
      const r2 = rabAt(g, u, -1)
      expect(r2.x).toBeCloseTo(mx(r1.x), 9)
      expect(r2.gtp).toBe(r1.gtp)
      expect(r2.alpha).toBe(r1.alpha)
    }
    // Its ions come from beyond the LEFT edge, and seat on the LEFT sensor.
    for (const ion of calciumFlight(g, 0, SN_W, -1)) {
      expect(ion.x).toBeLessThan(0)
    }
    const uFull = at('zipper')
    const sitesL = sensorSites(g, uFull, -1)
    for (const [i, ion] of calciumFlight(g, uFull, SN_W, -1).entries()) {
      expect(ion.seated).toBe(true)
      expect(ion.x).toBeCloseTo(sitesL[i].x, 6)
      expect(ion.y).toBeCloseTo(sitesL[i].y, 6)
    }
  })

  it('A1 (2026-09-03): the two copies keep CLEAR of the centre — rope and calcium sites no longer collide', () => {
    // The complaint: at ring angle ~87° the mirrored rope ends sat ±0.05 r
    // from the centre line, on top of each other, and the clamps and site
    // clusters tangled between them. Every piece of one copy's machinery now
    // stays at least 0.3 r clear of the centre; the mirror identity (guarded
    // above) doubles that into a ≥ 0.6 r channel between the copies.
    const g = snareGeometry()
    const margin = g.cx + g.r * 0.3
    for (const u of [0, at('dock'), at('prime'), at('trigger'), at('zipper')]) {
      const ends = ropeEnds(g, u)
      expect(ends.ves.x, `ves at ${u.toFixed(2)}`).toBeGreaterThan(margin)
      expect(ends.wall.x, `wall at ${u.toFixed(2)}`).toBeGreaterThan(margin)
      for (const s of sensorSites(g, u)) {
        expect(s.x - 6.5, `site at ${u.toFixed(2)}`).toBeGreaterThan(margin)
      }
      const cpx = complexinAt(g, u)
      if (cpx && cpx.alpha > 0.01) {
        expect(cpx.x - g.r * 0.17, `clamp at ${u.toFixed(2)}`).toBeGreaterThan(margin)
      }
      const stubs = snareStubs(g, u)
      if (stubs) {
        for (const [k, s] of Object.entries(stubs)) {
          expect(Math.min(s.from.x, s.to.x), `${k} at ${u.toFixed(2)}`).toBeGreaterThan(margin)
        }
      }
    }
  })

  it('A1 (2026-09-03): every transmitter molecule has an IDENTITY — it leaves by travel, never a crossfade', () => {
    const g = snareGeometry()
    // Generation 1 inside at the start, riding the bubble; generation 2 (the
    // refill trade's NEW molecules, 2026-09-04) staged off-frame in the crowd.
    const c0 = vesicleCentre(g, 0)
    const dots0 = transmitterAt(g, 0)
    expect(dots0.length).toBe(NT_COUNT * 2)
    for (const d of dots0.slice(0, NT_COUNT)) {
      expect(d.phase).toBe('inside')
      expect(Math.hypot(d.x - c0.x, d.y - c0.y)).toBeLessThan(g.r)
    }
    for (const d of dots0.slice(NT_COUNT)) {
      expect(d.phase).toBe('staged')
      expect(d.y).toBeLessThan(0)
    }
    // A fixed cast, walked for continuity: every molecule of BOTH generations
    // can be followed — no jump anywhere.
    let prev: NtDot[] | null = null
    for (let s = 0; s <= 800; s++) {
      const dots = transmitterAt(g, s / 800)
      expect(dots.length).toBe(NT_COUNT * 2)
      if (prev) {
        for (const [i, d] of dots.entries()) {
          const jump = Math.hypot(d.x - prev[i].x, d.y - prev[i].y)
          if (jump > 25) {
            throw new Error(`NT ${i} jumped ${jump.toFixed(0)}px at u=${(s / 800).toFixed(3)}`)
          }
        }
      }
      prev = dots
    }
    // And the picture's filling IS the model's: the number inside tracks
    // cargoAt, because both generations read the same ramps.
    const pore = STAGE_SPANS.find((x) => x.id === 'pore')!
    const load = STAGE_SPANS.find((x) => x.id === 'load')!
    for (const u of [
      0,
      at('trigger'),
      (pore.from + pore.to) / 2,
      at('collapse'),
      (load.from + load.to) / 2,
      1,
    ]) {
      const insideN = transmitterAt(g, u).filter((d) => d.phase === 'inside').length
      expect(Math.abs(insideN - cargoAt(u) * NT_COUNT), `u=${u.toFixed(2)}`).toBeLessThanOrEqual(1)
    }
  })

  it('A1 (2026-09-03): no molecule crosses anywhere but the OPEN mouth — never through intact membrane', () => {
    const g = snareGeometry()
    // Until the membranes have fused, every gen-1 molecule is still inside.
    const uFused = uAtMouthOpen(0)
    for (let i = 0; i <= 40; i++) {
      const dots = transmitterAt(g, uFused * (i / 40)).slice(0, NT_COUNT)
      expect(dots.every((d) => d.phase === 'inside')).toBe(true)
    }
    // And whenever a molecule is AT the wall line on its way out, the ring's
    // mouth is open wider there than the point it passes through — it goes
    // through the hole, not the wall.
    let crossingsSeen = 0
    for (let s = 0; s <= 1600; s++) {
      const u = s / 1600
      const dots = transmitterAt(g, u)
      const cy = fusedCentreY(g, u)
      const sinStar = (g.wallY - cy) / g.r
      for (const d of dots) {
        if (d.phase !== 'leaving' || Math.abs(d.y - g.wallY) > 8) continue
        crossingsSeen++
        expect(sinStar, `sealed ring at u=${u.toFixed(3)}`).toBeLessThan(1)
        const chordHalf = g.r * Math.cos(Math.asin(Math.max(-1, Math.min(1, sinStar))))
        expect(Math.abs(d.x - g.cx), `dot outside mouth at u=${u.toFixed(3)}`).toBeLessThan(
          chordHalf + 1,
        )
      }
    }
    // The walk really witnessed wall crossings.
    expect(crossingsSeen).toBeGreaterThan(10)
  })

  it('A2 (2026-09-04): the new load enters ONLY through the transporter — never through bare membrane', () => {
    // The complaint: "NTs enter the vesicle through membrane." Every gen-2
    // molecule now queues OUTSIDE the door and passes the membrane band only
    // at the transporter's own spot.
    const g = snareGeometry()
    let crossings = 0
    for (let s = 0; s <= 1600; s++) {
      const u = s / 1600
      const cy = fusedCentreY(g, u)
      const door = transporterSpot(g, u)
      for (const d of transmitterAt(g, u).slice(NT_COUNT)) {
        if (d.phase !== 'entering' && d.phase !== 'waiting') continue
        const dist = Math.hypot(d.x - g.cx, d.y - cy)
        if (Math.abs(dist - g.r) < 14) {
          crossings++
          // Tightened 0.6 r → 0.2 r (2026-09-04): the pass now THREADS the
          // barrel's bore, so a crossing is at the door itself — within the
          // barrel's own footprint — not merely near it.
          expect(
            Math.hypot(d.x - door.x, d.y - door.y),
            `off-door crossing at u=${u.toFixed(3)}`,
          ).toBeLessThan(g.r * 0.2)
        }
      }
    }
    // The walk really witnessed the traffic.
    expect(crossings).toBeGreaterThan(20)
  })

  it('A3+A4 (2026-09-04): the spent cargo is gone for good, and the NEW load fills the SAME seats', () => {
    const g = snareGeometry()
    const dots1 = transmitterAt(g, 1)
    // Generation 1: gone by travel — off the frame's sides or bottom.
    for (const d of dots1.slice(0, NT_COUNT)) {
      expect(d.phase).toBe('away')
      expect(d.x < 0 || d.x > SN_W || d.y > SN_H).toBe(true)
    }
    // Generation 2: all inside, dot-for-dot at the seats generation 1 held on
    // the opening frame — the closing frame IS the opening frame.
    const dots0 = transmitterAt(g, 0)
    for (const [i, d] of dots1.slice(NT_COUNT).entries()) {
      expect(d.phase).toBe('inside')
      expect(d.x).toBeCloseTo(dots0[i].x, 6)
      expect(d.y).toBeCloseTo(dots0[i].y, 6)
    }
    // Unfilled from the collapse until the trade begins — nothing re-enters
    // early.
    const colEnd = STAGE_SPANS.find((x) => x.id === 'collapse')!.to
    const loadFrom = STAGE_SPANS.find((x) => x.id === 'load')!.from
    for (let i = 0; i <= 40; i++) {
      const u = colEnd + (loadFrom - colEnd) * (i / 40)
      expect(transmitterAt(g, u).filter((d) => d.phase === 'inside').length).toBe(0)
    }
  })

  it('A1+A2 (reuse round): everything walks back to its post — the end still IS the start still', () => {
    const g = snareGeometry()
    // The strands: end state equals start state, because the walk-home's
    // destinations ARE the free-stub homes and the bubble is back at height.
    const s0 = snareStubs(g, 0)!
    const s1 = snareStubs(g, 1)!
    for (const k of ['vs', 'syx', 's25'] as const) {
      expect(s1[k].from.x, `${k}.from`).toBeCloseTo(s0[k].from.x, 6)
      expect(s1[k].from.y, `${k}.from`).toBeCloseTo(s0[k].from.y, 6)
      expect(s1[k].to.x, `${k}.to`).toBeCloseTo(s0[k].to.x, 6)
      expect(s1[k].to.y, `${k}.to`).toBeCloseTo(s0[k].to.y, 6)
    }
    // The sensor rides its shoulder again — the shoulder of the bubble that
    // actually LIFTED (fusedCentreY), which caught a real bug: ridden off
    // vesicleCentre it would have stayed parked at the wall while the bubble
    // rose. The minder has re-clasped the re-folded syntaxin.
    const c1 = { x: g.cx, y: fusedCentreY(g, 1) }
    const h1 = sensorHead(g, 1)
    expect(c1.y).toBeCloseTo(g.highY, 6)
    expect(Math.hypot(h1.x - c1.x, h1.y - c1.y)).toBeCloseTo(g.r * 1.18, 4)
    const m0 = munc18At(g, 0)
    const m1 = munc18At(g, 1)
    expect(m1.alpha).toBeCloseTo(1, 9)
    expect(m1.x).toBeCloseTo(m0.x, 6)
    expect(m1.y).toBeCloseTo(m0.y, 6)
    // And the Rab is back on its shoulder, badge lit (A4, 2026-09-04): the
    // re-arming was declared off-stage, and the closing frame IS off-stage —
    // up in the crowd — so it happens on screen and the frames match exactly.
    const r0 = rabAt(g, 0)
    const r1 = rabAt(g, 1)
    expect(r1.alpha).toBeCloseTo(1, 9)
    expect(r1.gtp).toBe(1)
    expect(r1.x).toBeCloseTo(r0.x, 6)
    expect(r1.y).toBeCloseTo(r0.y, 6)
    // The spent rope rides the returning material home with the retrieval
    // (2026-09-04, superseding the freeze): by the bud's completion its
    // v-SNARE end is back ON the bubble, at its own ring angle.
    const retEnd = STAGE_SPANS.find((x) => x.id === 'retrieve')!.to
    const ends = ropeEnds(g, retEnd)
    const cyBud = fusedCentreY(g, retEnd)
    expect(Math.hypot(ends.ves.x - g.cx, ends.ves.y - cyBud)).toBeCloseTo(g.r, 4)
    // And the walk home is a WALK: every strand continuous across it.
    const rec = STAGE_SPANS.find((x) => x.id === 'recycle')!
    let prev: ReturnType<typeof snareStubs> = null
    for (let s = 0; s <= 200; s++) {
      const st = snareStubs(g, rec.from + (1 - rec.from) * (s / 200))
      if (st && prev) {
        for (const k of ['vs', 'syx', 's25'] as const) {
          for (const e of ['from', 'to'] as const) {
            const jump = Math.hypot(st[k][e].x - prev[k][e].x, st[k][e].y - prev[k][e].y)
            if (jump > 25) throw new Error(`${k}.${e} jumped ${jump.toFixed(0)}px`)
          }
        }
      }
      prev = st
    }
  })

  it('A1 (2026-09-04): the helices and the binder FOLLOW the membrane at all times — bolted to their own lipid', () => {
    // The complaint: "Ca binder and snare helices do not follow membrane all
    // the time." The cap and the post-collapse freeze parked the rope while
    // the membrane streamed past and slid home beneath it. The claim now:
    // the rope's v-SNARE end stays within one lipid spacing of the SAME ring
    // molecule — by identity, not by proximity to whatever membrane happens
    // to be near — at every moment of the run.
    const g = snareGeometry()
    const spacing = HEAD_R * 1.15 * 2.05
    // The molecule it is bolted to: the ring index nearest the anchor at rest.
    const ring0 = vesicleRing(g, 0)
    const ves0 = ropeEnds(g, 0).ves
    let iStar = 0
    let best = Infinity
    for (const [i, p] of ring0.entries()) {
      const d = Math.hypot(p.at.x - ves0.x, p.at.y - ves0.y)
      if (d < best) {
        best = d
        iStar = i
      }
    }
    for (let s = 0; s <= 800; s++) {
      const u = s / 800
      const anchor = vesicleRing(g, u)[iStar].at
      const ves = ropeEnds(g, u).ves
      const d = Math.hypot(ves.x - anchor.x, ves.y - anchor.y)
      if (d > spacing * 1.5) {
        throw new Error(`rope left its lipid by ${d.toFixed(0)}px at u=${u.toFixed(3)}`)
      }
    }
    // And the binder rides the same patch: once swung down and until the
    // walk-home begins, the head keeps a CONSTANT offset from the rope — it
    // moves exactly as much as the membrane it sits in.
    const zipEnd = STAGE_SPANS.find((x) => x.id === 'zipper')!.to
    const recStart = STAGE_SPANS.find((x) => x.id === 'recycle')!.from
    const offsetAt = (u: number) => {
      const e = ropeEnds(g, u)
      return sensorHead(g, u).x - (e.wall.x + e.ves.x) / 2
    }
    const off0 = offsetAt(zipEnd)
    expect(off0).toBeCloseTo(g.r * 0.64, 4)
    for (let s = 0; s <= 100; s++) {
      expect(offsetAt(zipEnd + (recStart - zipEnd) * (s / 100))).toBeCloseTo(off0, 4)
    }
  })

  it('A5 (2026-09-03): wall proteins RIDE the membrane — pushed out with the flow, home with retrieval', () => {
    // "Make elements follow membrane when it moves, so they look anchored to
    // the place." The wall's lipids slide outward by wallShift as the fusing
    // bubble adds membrane; a protein standing in that wall must slide with
    // them, by the same rule.
    const g = snareGeometry()
    const base0 = tetherAt(g, 0).base
    const uMid = at('collapse')
    const shift = wallShift(g, uMid)
    expect(shift).toBeGreaterThan(g.r * 0.2)
    const baseMid = tetherAt(g, uMid).base
    // The tether's base is left of centre, so outward is FURTHER left.
    expect(baseMid.x).toBeCloseTo(base0.x - shift, 6)
    // And home again once retrieval has taken the material back.
    expect(tetherAt(g, 1).base.x).toBeCloseTo(base0.x, 6)
    // The mirrored copy rides outward the other way.
    expect(tetherAt(g, uMid, -1).base.x).toBeCloseTo(2 * g.cx - baseMid.x, 6)
  })

  it('A2 (reuse round): NSF lands on the spent rope, the coat is shed, the pump and protons arrive', () => {
    const g = snareGeometry()
    // NSF: off-duty outside the taking-apart; on the rope's middle during it.
    expect(nsfAt(g, at('retrieve'))).toBeNull()
    const uWork = at('recycle')
    const n = nsfAt(g, uWork)!
    const flat = ropeEnds(g, uWork)
    expect(n.alpha).toBeGreaterThan(0.5)
    expect(
      Math.hypot(n.x - (flat.ves.x + flat.wall.x) / 2, n.y - flat.ves.y),
    ).toBeLessThan(g.r * 0.45)
    expect(nsfAt(g, at('refill'))).toBeNull()
    // The coat: absent while primed; wrapping the standing bud when it is
    // pinched — every stud above the wall, on the cytosolic face — and gone
    // by the lift.
    expect(clathrinAt(g, at('prime')).length).toBe(0)
    const coat = clathrinAt(g, STAGE_SPANS.find((x) => x.id === 'retrieve')!.to - 1e-4)
    expect(coat.length).toBeGreaterThan(5)
    for (const stud of coat) expect(stud.y).toBeLessThan(g.wallY)
    expect(clathrinAt(g, at('refill')).length).toBe(0)
    // The pump: absent during the count, riding the bubble by the lift, with
    // every proton INSIDE at the load's start — soured, ready to trade.
    expect(pumpAt(g, at('trigger'))).toBeNull()
    const loadFrom = STAGE_SPANS.find((x) => x.id === 'load')!.from
    const p = pumpAt(g, loadFrom)!
    const cBub = { x: g.cx, y: fusedCentreY(g, loadFrom) }
    expect(Math.hypot(p.x - cBub.x, p.y - cBub.y)).toBeCloseTo(g.r, 4)
    expect(protonsAt(g, at('zipper')).length).toBe(0)
    const pr = protonsAt(g, loadFrom)
    expect(pr.length).toBeGreaterThan(0)
    for (const proton of pr) {
      expect(proton.inside).toBe(true)
      expect(Math.hypot(proton.x - cBub.x, proton.y - cBub.y)).toBeLessThan(g.r * 0.6)
    }
    // The TRADE (2026-09-04): mid-load the transporter is on the bubble and
    // protons are on their way OUT; by the end both machines have faded and
    // every proton has left through the top — the closing frame is clean.
    expect(transporterAt(g, loadFrom - 0.01)).toBeNull()
    const uMidLoad = at('load')
    const tr = transporterAt(g, uMidLoad)!
    expect(Math.hypot(tr.x - g.cx, tr.y - fusedCentreY(g, uMidLoad))).toBeCloseTo(g.r, 4)
    expect(pumpAt(g, 1)).toBeNull()
    expect(transporterAt(g, 1)).toBeNull()
    for (const proton of protonsAt(g, 1)) {
      expect(proton.inside).toBe(false)
      expect(proton.y).toBeLessThan(0)
    }
    // ⚠ At the EXCHANGE STOP itself a proton is still on stage to be named
    // (user, 2026-09-04: "I see no label for proton") — at least one inside,
    // and the labelled still carries the 'protons' name (asserted in the
    // callouts test) pointing at it.
    const stopC = LABEL_STOPS[2]
    expect(protonsAt(g, stopC).some((p) => p.inside)).toBe(true)
  })

  it('A3: nothing opens until the zip has finished, and the zip waits', () => {
    // The two claims the picture exists to make, read off the model the picture
    // draws rather than off the picture.
    expect(zipAt(at('trigger'))).toBeCloseTo(PRIMED_ZIP, 6)
    expect(poreAt(at('trigger'))).toBe(0)
    expect(poreAt(at('zipper'))).toBe(0)
    expect(poreAt(at('pore'))).toBeGreaterThan(0)
  })

  it('A3: names the parts, and only names them', () => {
    const g = snareGeometry()
    for (const u of [0, 0.5, 1]) {
      for (const l of snareLabels(g, u)) {
        expect(l.term.split(' ').length).toBeLessThanOrEqual(2)
        expect(l.term).not.toMatch(/[.!?]/)
        expect(spokenTermAt(snareLabels(g, u), l.x + l.w / 2, l.y + l.h / 2)).toBe(l.term)
      }
    }
  })

  it('A3: is a SYNAPSE drawer, opened from the synapse\'s own chrome', () => {
    // ⚠ The on-canvas magnifier was replaced at the user's direction
    // (2026-09-01) by the AP views' own shelf pattern: a labelled button,
    // bottom-left of BOTH synapse framings (see NeuronStage). What remains
    // pinnable here: the drawer's home is the synapse, so only that view's
    // chrome advertises it.
    const demo = DEMOS.find((d) => d.id === 'snare')!
    expect(demo.home).toBe('synapse')
    expect(demo.drawer).toBe(true)
    expect(demo.icon.length).toBeGreaterThan(0)
  })

  it('A3: fits its frame, and declares its own clock', () => {
    const g = snareGeometry()
    expect(g.wallY).toBeLessThan(SN_H)
    expect(vesicleCentre(g, 0).y - g.r).toBeGreaterThan(0)
    expect(g.right).toBeLessThanOrEqual(SN_W)
    // Slow enough that four calcium ions landing can be counted by eye.
    expect(SNARE_SCREEN_MS).toBeGreaterThan(6000)
  })
})
