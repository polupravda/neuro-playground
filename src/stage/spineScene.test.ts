import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { ASTRO_INK, SPINE_VIEW_SCALE, STAGE_H, STAGE_W, ZOOM_TARGETS, arrivalAt } from './layout'
import {
  SPINE_CHROME_PX,
  SPINE_TOP_CAP,
  solveSpineTop,
  spineScreenOfModel,
  SPINE_FROM_MS,
  SPINE_LEGS,
  SPINE_SCREEN_MS,
  SPINE_SHARE,
  SPINE_TO_MS,
  SPINE_TOP,
  drawSpine,
  spineCamera,
  spineClock,
  spineDensityX,
  spineGeometry,
  spineNaLagMs,
  spineLanding,
} from './spineScene'
import { ligandHalfWidth } from './ligandChannel'
import { GLOSSY_COLORS, SPAN_NEUTRAL, chargeSpan } from './particleStyle'
import {
  bindPulses,
  calciumCast,
  receptorSeatWindow,
  sodiumCast,
  transmitterCast,
} from './synapseCast'

import {
  CLEFT_PX,
  MEM_PX,
  NECK_N,
  STORE_N,
  STORE_RECEPTOR_H,
  SYN_H,
  SYN_W,
  ZONE_LIPID,
  ZONE_SPACING,
  activeZone,
  drawSynapse,
  faceAt,
  membraneLipids,
  neckSeats,
  receptorSites,
  spineHeadInk,
  inkApart,
  spineReceptorSeats,
  spineWalls,
  headSpanAt,
  castSeats,
  carrierTurn,
  storeR,
  storeSeats,
  CLOCK_LEGS,
  CHANNEL_INK,
  SYNAPSE_SCREEN_MS,
  screenOfModel,
  snareMini,
  SNARE_STRANDS,
  tearsAt,
  SURFACE_N,
  wallQueueX,
  neckClimbPath,
  NECK_SIDE,
  synapseGeometry,
  LUMEN_RGB,
  CARRIER_FLIP,
} from './synapseScene'
import { buildSpineStory, naPhase } from './spineStory'
import { SPINE_REST_MV, cleftRun } from '../core/cleft'
import { mgBlock } from '../core/receptors'
import { synapseRun } from '../core/synapse'
import { restingCounts } from '../core/ions'
import {
  AMPA_AT_REST,
  TAP_REST_MS,
  spineFire,
  spineStart,
  spineStep,
  spineCharge,
  TIME_FACTOR,
  ONE_MESSAGE_REACH,
  TINT_SHAPE,
  TINT_MARGIN,
  NMDA_DECAY_MS,
  spineHeadAlpha,
  SPINE_HONESTY,
  seatedInTwenty,
  SPINE_CEILING_MV,
  spineReach,
  spineWash,
  NMDA_RISE_MS,
  nmdaOpen,
  nmdaLive,
  deliveryAt,
  DELIVER_MS,
  DELIVER_FUSE_AT,
  DELIVER_MERGE_SHARE,
  nmdaWaiting,
  type SpineState,
} from '../core/spine'

const SOURCES = import.meta.glob('./*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>
const STAGE = import.meta.glob('./NeuronStage.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const run = synapseRun(restingCounts() as never, true)
const cleft = cleftRun(run)

const burst = (n: number, watch: number, gap = TAP_REST_MS + 10): SpineState => {
  const s = spineStart()
  let fired = 0
  for (let t = 0; t < watch; t += 16) {
    if (fired < n && s.now >= fired * gap) {
      spineFire(s)
      fired++
    }
    spineStep(s, 16)
  }
  return s
}

const paint = (spine: SpineState | null, u: number | null = 0.5) => {
  const c = strictCanvas()
  if (spine) drawSpine(c.ctx, { run, cleft, u, spine })
  else drawSynapse(c.ctx, { run, cleft, u })
  return c
}

describe('S13 — the spine view is a CAMERA, not a second drawing', () => {
  it('A1 (21c-48): the module draws NOTHING — it frames the existing picture', () => {
    // ⚠ (user, 2026-09-12: "no, do not invent the view. use existing drawing".)
    // An earlier version imported the round trip's glyphs and composed its own
    // picture out of them — its own geometry, walls, release, traffic. Reusing
    // the PIECES is not reusing the drawing: the composition IS the drawing.
    const src = SOURCES['./spineScene.ts']
    expect(src, 'the module did not load').toBeTruthy()
    expect(src, 'it does not call the existing drawing at all').toContain('drawSynapse(')
    for (const own of [
      'paveMembrane',
      'drawLigandChannel',
      'drawGlossyIon',
      'ctx.arc(',
      'ctx.fill(',
      'ctx.stroke(',
      'createRadialGradient',
      'spinePath',
      'vesicle(',
    ]) {
      expect(src, `the spine view draws its own ${own}`).not.toContain(own)
    }
  })

  it('A2/A3 (21c-48): the camera is SOLVED from the two requirements', () => {
    const L = spineLanding()
    // ⚠ AND THE ROOM IS ASKED FOR INDEPENDENTLY, not against `SPINE_TOP` itself
    // — a first version compared the landing to that constant and was circular:
    // move the constant and the camera follows it, so the guard passed with the
    // wall sitting behind the chrome. This is the view's OWN top plate, counted
    // off its markup: `top-3` (12) + `p-1.5` (6) + `h-[38px]` + `p-1.5` (6).
    const CHROME_BOTTOM = 12 + 6 + 38 + 6
    expect(L.wallY, `the wall lands at ${L.wallY.toFixed(0)}, under the chrome`)
      .toBeGreaterThanOrEqual(CHROME_BOTTOM)
    // ⚠ ASKED AGAINST THE SUBJECT, not against a flat fraction (21c-63). Every
    // control this view gains costs the picture room, and a bound that is
    // simply raised each time measures nothing. The claim is that the SPINE is
    // still the bigger half of its own view.
    expect(
      STAGE_H - L.faceY,
      `the terminal and its chrome have ${L.wallY.toFixed(0)}px, the spine ` +
        `${(STAGE_H - L.faceY).toFixed(0)}`,
    ).toBeGreaterThan(L.wallY)
    expect(L.wallY, `the wall lands at ${L.wallY.toFixed(0)}`).toBeCloseTo(SPINE_TOP, 6)
    // ⚠ AND THE ROOM IS FOR THE VESICLES, not for the membrane (user,
    // 2026-09-13: "shift the whole view down, so the timeline does not cover
    // vesicle release"). A docked bubble is not ON the wall, it is above it:
    // measured at the old framing the middle one's top sat 69px OFF the top of
    // the picture and everything of it on screen was behind the bar. This is
    // the claim the number is solved from, asked where the child reads it.
    const gg = synapseGeometry(SYN_W, SYN_H)
    const { k, dx, dy } = spineCamera()
    // ⚠ ASKED OF THE RUN, not of the same band the solve uses — "the bubbles
    // that open" is the claim, and a guard that re-applied the solve's own
    // filter would agree with it by construction. This is what caught the
    // rounding error that excluded the slots at exactly half the zone.
    const watched = activeZone(gg).docked.filter(
      (d) => run.vesicles[d.index]?.fusedAtMs !== null,
    )
    expect(watched.length, 'no vesicle opens at all').toBeGreaterThan(2)
    for (const d of watched) {
      const top = dy + (d.y - d.r) * k
      expect(top, `a docked vesicle's top is at ${top.toFixed(0)}, under the timeline`)
        .toBeGreaterThan(SPINE_CHROME_PX)
      expect(dx + d.x * k, 'a watched vesicle is off the side of the picture')
        .toBeGreaterThan(0)
      expect(dx + d.x * k).toBeLessThan(STAGE_W)
    }
    // …one cleft above the face, at this magnification.
    expect(L.faceY - L.wallY, 'the gap is not one cleft').toBeCloseTo(L.cleftPx, 6)
    // …and the head fills the share it was asked for.
    const share = (L.headBottomY - L.faceY) / (STAGE_H - SPINE_TOP)
    expect(share, `the head fills ${(share * 100).toFixed(0)}%`).toBeCloseTo(SPINE_SHARE, 6)
    expect(spineCamera().k, 'the camera does not magnify at all').toBeGreaterThan(1)
  })

  it('A2 (21c-48): the ENTIRE spine is in frame — head, neck and dendrite', () => {
    const L = spineLanding()
    expect(L.faceY, 'the face is under the chrome').toBeGreaterThan(SPINE_TOP)
    // ⚠ NOT `headBottomY` — that is the head ELLIPSE's nominal bottom, and the
    // drawn silhouette has already narrowed into the neck well above it. A
    // guard on it was failing at a picture that is correct: the dendrite is
    // MEANT to leave the frame, and does, below a neck that is in it.
    expect(L.shaftTopY, 'there is no head above the neck').toBeGreaterThan(L.faceY)
    expect(L.shaftTopY, 'the neck starts below the frame').toBeLessThan(STAGE_H)
    expect(STAGE_H - L.shaftTopY, 'there is no dendrite under the neck')
      .toBeGreaterThan(60)
    // …and the head's widest point — its real bottom, as drawn — is in frame.
    expect((L.faceY + L.headBottomY) / 2, 'the head’s widest part is off the foot')
      .toBeLessThan(STAGE_H)
    // ⚠ AND IT IS NO LONGER CENTRED — it is FRAMED ON THE LEFT FLANK (user,
    // 2026-09-13: "let's shift camera so that the left side of the spine is in
    // view. So we can follow the membrane and channel's path"). This guard used
    // to require the head's two edges to straddle the middle of the stage, and
    // that requirement is what kept the receptor's whole journey off the
    // picture: the head is 1567px wide at this magnification, so centring it
    // puts BOTH flanks outside a 1060px frame.
    expect(L.headRightX - L.headLeftX, 'the head is a sliver')
      .toBeGreaterThan(STAGE_W * 0.4)
    expect(L.headLeftX, 'the left flank is off the picture again')
      .toBeGreaterThan(0)
    expect(L.headLeftX, 'the whole head fits — this camera is not framing a flank at all')
      .toBeLessThan(STAGE_W * 0.2)
    // ⚠ AND THE RECEPTORS ARE A PACKED CLUSTER, not spread to the edges (user,
    // 2026-09-12: "too much of inactive area is in the view. place receptors
    // closer to each other, to the center"). Measured before: one AMPA and one
    // NMDA stood 1003px apart on a 1060px stage — at opposite edges.
    // ⚠ ASKED OF THE ONE FUNCTION THE DRAWING USES, not recomputed here — a
    // first version reproduced the formula and passed while the drawing had
    // stopped calling it at all.
    const g = synapseGeometry(SYN_W, SYN_H)
    for (const ampa of [1, 3]) {
      const xs = spineReceptorSeats(g, ampa).map((p) => p.x)
      const span = (Math.max(...xs) - Math.min(...xs)) * L.k
      expect(span, `${ampa + 1} receptors span ${span.toFixed(0)}px of a ${STAGE_W}px stage`)
        .toBeLessThan(STAGE_W * 0.35)
      expect(span, `${ampa + 1} receptors are piled on each other`)
        .toBeGreaterThan(ligandHalfWidth(MEM_PX * 2.6, 1) * ampa * L.k)
    }
    // ⚠ AND THE WORKING PART OF THE PICTURE FILLS ITS SHARE OF THE FRAME —
    // which is what "too much of inactive area" actually asks for, and the only
    // claim about the ZOOM that is not circular. A guard on the head's share of
    // the HEIGHT compares the camera against its own constant and moves with it.
    // ⚠ AND THE ZOOM IS ASKED AS A LEGIBILITY CLAIM, not as a share that drifts
    // with the chrome (21c-59). Room for the timeline and the vesicles under it
    // took `SPINE_TOP` from 104 to 242 and the magnification is what paid for
    // it — `SPINE_SHARE` is untouched, so the head still fills the share of the
    // frame it was asked to; there is simply less frame, and 3.10x became
    // 2.33x. A share threshold would just have been lowered to match. How wide
    // a RECEPTOR comes out is the thing the child actually has to read.
    const wide = ligandHalfWidth(MEM_PX * 2.6, 1) * 2 * L.k
    expect(wide, `a receptor is only ${wide.toFixed(0)}px wide`).toBeGreaterThan(40)
    const workingXs = spineReceptorSeats(g, 3, spineDensityX()).map((p) => p.x)
    const working = ((Math.max(...workingXs) - Math.min(...workingXs)) * L.k) / STAGE_W
    expect(working, `the synapse itself is only ${(working * 100).toFixed(0)}% of the frame`)
      .toBeGreaterThan(0.15)
    expect(working, 'the density has spread across the whole picture').toBeLessThan(0.35)
  })

  it('A1 (21c-49): the DRAWN receptors really are the packed cluster', () => {
    // ⚠ MEASURED ON THE INK, at the places the OLD spread put them. A guard on
    // the seats function alone passes while the drawing ignores it. A receptor
    // is a `drawLigandChannel` standing across the wall, so it lays ink further
    // from the face than the lipids do — count that band at the old outer seats.
    const g = synapseGeometry(SYN_W, SYN_H)
    const outer = [-1, 1].map((side) => ({
      x: g.head.cx + side * g.activeHalf * 0.82,
      y: faceAt(g, g.head.cx + side * g.activeHalf * 0.82),
    }))
    const proteinInk = (c: ReturnType<typeof strictCanvas>, at: { x: number; y: number }[]) =>
      c.points.filter((p) =>
        at.some((q) => {
          const dy = Math.abs(p.y - q.y)
          return Math.abs(p.x - q.x) < MEM_PX * 2 && dy > MEM_PX * 1.6 && dy < MEM_PX * 4
        }),
      ).length

    const spread = strictCanvas()
    drawSynapse(spread.ctx, { run, cleft, u: 0.5 })
    expect(proteinInk(spread, outer), 'the round trip has no receptors out there to compare with')
      .toBeGreaterThan(10)

    const packed = strictCanvas()
    drawSynapse(packed.ctx, { run, cleft, u: 0.5, spine: burst(1, 400) })
    expect(
      proteinInk(packed, outer),
      `${proteinInk(packed, outer)} marks still stand at the old outer seats`,
    ).toBeLessThan(proteinInk(spread, outer) * 0.34)
    // …and there IS a receptor near the middle instead.
    const middle = [{ x: g.head.cx, y: faceAt(g, g.head.cx) }]
    expect(proteinInk(packed, middle), 'nothing is drawn at the centre')
      .toBeGreaterThan(10)
  })

  it('A1 (21c-50): BOTH stores of AMPA are drawn, and both are in frame', () => {
    // ⚠ (user, 2026-09-12: "illustrate both storages in the current view".)
    // They are two STAGES of one supply: carriers inside the head that fuse
    // with the wall, and receptors already IN the wall beside the density that
    // diffuse in. The delivery runs through both, which is the honest order.
    const g = synapseGeometry(SYN_W, SYN_H)
    const { k, dx, dy } = spineCamera()
    const px = (x: number) => dx + x * k
    const py = (y: number) => dy + y * k
    const onScreen = (x: number, y: number) =>
      px(x) > 8 && px(x) < STAGE_W - 8 && py(y) > 8 && py(y) < STAGE_H - 8

    // ⚠ NO STANDING POOL ANY MORE (user, 2026-09-13: "Remove 2 additional").
    // Two receptors used to stand permanently in the wall beside the density,
    // and with the climbers added that was four proteins on the face before
    // anything had happened — while the view's first sentence is "there is one
    // AMPA and one NMDA here". The supply outside the synapse is the two coming
    // up the flank, which SHOW the arriving instead of asserting it.
    expect(SURFACE_N, 'the standing pool is back').toBe(0)
    const dx0 = spineDensityX()
    const cluster = spineReceptorSeats(g, 3, dx0).map((p) => p.x)
    const clusterEdge = Math.min(...cluster)
    // ⚠ AND NOTHING IN THE QUEUE STANDS ON ANYTHING ELSE — the fusion point and
    // the two catches share one stretch of wall, and they are three separate
    // drawings of one line.
    const queue = [0, 1, 2].map((i) => wallQueueX(g, i, dx0))
    for (const [i, q] of queue.entries()) {
      expect(q, `queue slot ${i} has wandered into the density`).toBeLessThan(clusterEdge)
      expect(onScreen(q, faceAt(g, q)), `slot ${i} is off screen`).toBe(true)
    }
    for (let i = 1; i < queue.length; i++) {
      expect(Math.abs(queue[i] - queue[i - 1]), `slots ${i - 1} and ${i} are one protein`)
        .toBeGreaterThanOrEqual(ligandHalfWidth(MEM_PX * 2.6, 0) * 2)
    }

    // The intracellular store: inside the head, under the density, and visible.
    const face = faceAt(g, g.head.cx)
    const store = storeSeats(g, STORE_N)
    expect(store.length, 'the store is empty before anything happened').toBe(STORE_N)
    for (const seat of store) {
      expect(onScreen(seat.x, seat.y), 'a waiting carrier is off screen').toBe(true)
      expect(seat.y, 'a carrier is drawn outside the cell').toBeGreaterThan(face)
      expect(seat.y, 'a carrier is below the neck').toBeLessThan(g.shaftTop)
    }
    // ⚠ DEEP IN THE HEAD, not tucked under the density (user, 2026-09-13:
    // "Place circles with AMPAs deeper in spine, further away from the top").
    // Measured before: they sat 0.62 of the head's half-height below the face,
    // in the top third of it, reading as part of the synapse above them.
    for (const seat of store) {
      const depth = (seat.y - face) / (2 * g.head.ry)
      expect(depth, `a carrier sits ${(depth * 100).toFixed(0)}% down the head`)
        .toBeGreaterThan(0.4)
    }
    // …and FURTHER APART than a carrier is wide, in BOTH directions (user:
    // "Place 2 stored AMPAs further apart. 1 may go further along the
    // membrane") — two that differ only in x are a diagram of two carriers.
    expect(Math.abs(store[0].x - store[1].x), 'the two carriers are stacked')
      .toBeGreaterThan(storeR() * 3)
    expect(Math.abs(store[0].y - store[1].y), 'the two carriers sit at one depth')
      .toBeGreaterThan(storeR())

    // ⚠ AND THE STORE EMPTIES. A source that never runs down is not a source.
    expect(storeSeats(g, STORE_N - 2).length, 'delivering took nothing from the store')
      .toBe(STORE_N - 2)
  })

  it('A1 (21c-50): the carrier fuses IN FRAME, where the surface pool stands', () => {
    // ⚠ MEASURED, AND IT WAS NOT. The old fusion shoulder sat at `rx x 0.82` —
    // ±207 of the head's centre, against a visible half-width of ±171 at this
    // camera. Every carrier was fusing off the side of the picture.
    const g = synapseGeometry(SYN_W, SYN_H)
    const { k, dx } = spineCamera()
    // ⚠ IT FUSES AT THE FAR END OF THE QUEUE, and in frame — slot 0.
    const x = wallQueueX(g, 0, spineDensityX())
    expect(dx + x * k, 'the carrier fuses off the left of the picture').toBeGreaterThan(8)
    expect(dx + x * k, 'the carrier fuses off the right of the picture')
      .toBeLessThan(STAGE_W - 8)
    // …and OUTSIDE the density, which is the science: a receptor is put into the
    // wall beside the synapse and has to find its own way in.
    const seats = spineReceptorSeats(g, 1, spineDensityX()).map((p) => p.x)
    expect(x, 'the carrier fuses straight into the synapse').toBeLessThan(Math.min(...seats))
  })

  it('A2 (21c-51): two carriers, receptors at the WALL’s size, rings of bilayer', () => {
    // ⚠ (user, 2026-09-12: "Display just two, make them as big as those in the
    // membrane, make the circles made out of Lipids. If this is scientifically
    // the case".) It is: a recycling endosome is a membrane compartment, and a
    // receptor is the same protein wherever it is — so fewer and bigger, which
    // is this app's own rule the moment a thing must show what it is made of.
    expect(STORE_N, 'the store is not two carriers').toBe(2)
    expect(STORE_RECEPTOR_H, 'a carried receptor is a different size from a wall one')
      .toBeCloseTo(MEM_PX * 2.6, 9)
    // Big enough for a bilayer to BE a bilayer: its ring must hold more than a
    // few molecules at this view's packing.
    const round = (2 * Math.PI * storeR()) / ZONE_SPACING
    expect(round, `only ${round.toFixed(0)} molecules would fit round a carrier`)
      .toBeGreaterThan(12)

    // …and the ring really is paved. Measured on the ink at the carrier's own
    // radius, which nothing else in the picture occupies.
    const g = synapseGeometry(SYN_W, SYN_H)
    const seat = storeSeats(g, STORE_N)[0]
    const c = strictCanvas()
    drawSynapse(c.ctx, { run, cleft, u: 0.5, chrome: 0, spine: burst(1, 400) })
    // ⚠ THE LOWER HALF OF THE RING ONLY. A first version counted the whole
    // ring and could not fail: the receptor perched on the carrier's TOP lays
    // its marks at exactly that radius, so the guard was counting the protein
    // and calling it a bilayer. Below the carrier's middle there is nothing but
    // its own wall.
    const onRing = c.points.filter((p) => {
      const d = Math.hypot(p.x - seat.x, p.y - seat.y)
      return p.y > seat.y + storeR() * 0.2 && Math.abs(d - storeR()) < ZONE_LIPID.halfMem * 1.4
    }).length
    expect(onRing, `${onRing} marks lie on a carrier's lower wall — it is not lipids`)
      .toBeGreaterThan(20)
  })

  it('A1 (21c-51): receptors come up the NECK — and they WANDER, never pulled', () => {
    // ⚠ SCIENTIFICALLY CHECKED BEFORE BUILDING (user: "Would it be
    // scientifically correct…?"). Yes: AMPA receptors are put into the membrane
    // at extrasynaptic sites including the shaft and the spine's neck, and they
    // reach the density by DIFFUSING in the plane of the membrane — the neck is
    // a real diffusion barrier.
    //
    // ⚠ BUT NOT "PULLED". Nothing attracts them; they wander and are CAUGHT at
    // the scaffold (01 → D07). A monotone climb would draw a force that does
    // not exist, so this requires the path to slip backwards.
    const g = synapseGeometry(SYN_W, SYN_H)
    const { k, dx, dy } = spineCamera()
    const px = (x: number) => dx + x * k
    const py = (y: number) => dy + y * k

    expect(NECK_N, 'nothing is coming up the neck').toBeGreaterThan(1)
    // It starts IN the neck, below the head…
    for (const seat of neckSeats(g, 0, 0)) {
      expect(seat.y, 'the climb starts above the neck').toBeGreaterThan(g.shaftTop)
      expect(py(seat.y), 'the climb starts off the bottom of the frame')
        .toBeLessThan(STAGE_H - 8)
      expect(px(seat.x)).toBeGreaterThan(8)
      expect(px(seat.x)).toBeLessThan(STAGE_W - 8)
    }
    // …and ends caught in the wall beside the density, each in its OWN slot of
    // the queue — asked of `wallQueueX`, the one place that lays that line out.
    for (const [i, seat] of neckSeats(g, 1, 0).entries()) {
      expect(seat.x, 'it does not arrive at its slot in the wall')
        .toBeCloseTo(wallQueueX(g, 1 + i, g.head.cx), 6)
      expect(seat.y, 'it arrives somewhere other than the membrane')
        .toBeCloseTo(faceAt(g, seat.x), 6)
    }
    // ⚠ AND THE ROUTE IS THE MEMBRANE'S (user, 2026-09-13: "we can follow the
    // membrane and channel's path"). It used to interpolate straight from the
    // neck's half-width to the pool, which at this camera ran through the
    // CYTOPLASM — measured, the halfway point was 544px inside the wall it was
    // supposed to be in. Every step of the climb must sit on the drawn outline.
    const walls = spineWalls(g, SYN_H)
    const onWall = (q: { x: number; y: number }) => {
      let best = Infinity
      for (const w of walls) {
        for (let t = 0; t <= 200; t++) {
          const u = t / 200
          const v = 1 - u
          const cx =
            v * v * v * w.p0.x + 3 * v * v * u * w.c1.x + 3 * v * u * u * w.c2.x + u * u * u * w.p1.x
          const cy =
            v * v * v * w.p0.y + 3 * v * v * u * w.c1.y + 3 * v * u * u * w.c2.y + u * u * u * w.p1.y
          best = Math.min(best, Math.hypot(cx - q.x, cy - q.y))
        }
      }
      return Math.min(best, Math.abs(q.y - faceAt(g, q.x)))
    }
    // ⚠ ASKED OF `neckSeats`, which is what the DRAWING places receptors with —
    // a guard on `neckClimbPath` alone measures a route the seats are free to
    // stop calling, and a break that put the straight diagonal back inside
    // `neckSeats` sailed through exactly that version of this guard.
    const strays: string[] = []
    for (let i = 0; i <= 30; i++) {
      for (const q of neckSeats(g, i / 30, i * 260)) {
        if (onWall(q) > 2.5) strays.push(`${q.x.toFixed(0)},${q.y.toFixed(0)}`)
      }
    }
    expect(strays.length, `the climb leaves the membrane at ${strays.slice(0, 4).join(' ')}`)
      .toBe(0)
    // ⚠ AND IT SLIPS BACKWARDS ON THE WAY. This is the whole scientific point:
    // a path that only ever rises is a path something is dragging.
    let back = 0
    const last = [Infinity, Infinity]
    for (let i = 0; i <= 40; i++) {
      neckSeats(g, i / 40, i * 260).forEach((sq, j) => {
        if (sq.y > last[j] + 0.01) back++
        last[j] = sq.y
      })
    }
    expect(back, 'the climb never slips — it is being pulled, not diffusing')
      .toBeGreaterThan(2)
    // …without ever going backwards so far it undoes the journey.
    expect(back, 'it wanders so much it never arrives').toBeLessThan(24)
  })

  it('A1 (21c-52): every hole in the wall has a protein standing in it', () => {
    // ⚠ (user, 2026-09-12: "remove gaps on the membrane".) The paver leaves a
    // molecule out where a protein stands — and it worked that out from the
    // ROUND TRIP's receptor spread and its calcium doors, neither of which this
    // framing draws. So it was cutting holes where nothing stood.
    const g = synapseGeometry(SYN_W, SYN_H)
    const sites = [
      ...spineReceptorSeats(g, 1, spineDensityX()),
    ]
    const pts = membraneLipids(g, [], { sites, doors: [] })
    const xs = pts
      .filter((p) => Math.abs(p.at.y - faceAt(g, p.at.x)) < 0.5)
      .map((p) => p.at.x)
      .sort((a, b) => a - b)
    expect(xs.length, 'the face was not paved at all').toBeGreaterThan(100)
    const half = ligandHalfWidth(MEM_PX * 2.6, 1)
    const orphans: number[] = []
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] - xs[i - 1] <= ZONE_SPACING * 2.5) continue
      const mid = (xs[i] + xs[i - 1]) / 2
      if (!sites.some((r) => Math.abs(r.x - mid) < half * 1.4)) orphans.push(Math.round(mid))
    }
    expect(orphans, `gaps with nothing in them at x = ${orphans.join(', ')}`).toEqual([])
  })

  it('A3 (21c-52): the flanks and the neck are paved, on the OUTLINE’s own curves', () => {
    // ⚠ (user: "Add phospholipid bilayer also on the leg of the dendritic
    // spine".) A membrane is a membrane. And the paving samples `spineWalls`,
    // the very cubics the outline traces, so the two cannot become two
    // descriptions of one shape — which is exactly what they had become: the
    // outline flared down to the trunk while the paver laid straight verticals.
    const g = synapseGeometry(SYN_W, SYN_H)
    const pts = membraneLipids(g, [], { sites: [], doors: [] })
    const onSides = pts.filter(
      (p) => Math.abs(p.at.y - faceAt(g, p.at.x)) >= 0.5 && p.at.y > g.foot.y,
    )
    expect(onSides.length, 'the spine’s side walls have no molecules at all')
      .toBeGreaterThan(120)
    // Both flanks AND both neck walls, not just one side.
    for (const side of [-1, 1] as const) {
      const n = onSides.filter((p) => Math.sign(p.at.x - g.head.cx) === side).length
      expect(n, `the ${side < 0 ? 'left' : 'right'} wall is bare`).toBeGreaterThan(40)
    }
    // …and some of them are down in the neck, not only on the shoulders.
    expect(onSides.filter((p) => p.at.y > g.shaftTop).length, 'the neck itself is bare')
      .toBeGreaterThan(20)
    expect(spineWalls(g)).toHaveLength(4)
  })

  it('A4/A5 (21c-52): the stored channels are TURNED, and not a mirror pair', () => {
    // ⚠ (user: "Rotate the stored channels" / "Make stored channels look
    // slightly misaligned. Currently, they are too symmetric".) A protein in a
    // vesicle's wall stands along the radius wherever it happens to sit — the
    // same grammar as VGLUT on a synaptic vesicle — and two free-floating
    // compartments do not line up.
    const g = synapseGeometry(SYN_W, SYN_H)
    const seats = storeSeats(g, STORE_N)
    expect(seats).toHaveLength(2)
    expect(seats.some((p) => Math.abs(p.turn) > 0.05), 'no carrier is turned at all').toBe(true)
    for (const p of seats) {
      expect(Math.abs(p.turn), 'a carrier is turned so far its receptor points inward')
        .toBeLessThan(Math.PI / 2)
    }
    expect(seats[0].turn, 'the two carriers are turned identically').not.toBeCloseTo(
      seats[1].turn,
      3,
    )
    expect(seats[0].y, 'the two carriers sit on one line').not.toBeCloseTo(seats[1].y, 3)
  })

  it('A1 (21c-53): the neck’s channels lie ACROSS the wall, and turn with it', () => {
    // ⚠ (user, 2026-09-13: "stored channels (on the dendrite neck) shoulb be
    // rotated 90 deg".) A protein spans its membrane. The neck's wall is
    // vertical, so down there a receptor lies on its side — and it eases
    // upright as it arrives on the face, because the wall turns through that
    // quarter. The protein is not rotating; the membrane is.
    const g = synapseGeometry(SYN_W, SYN_H)
    for (const seat of neckSeats(g, 0, 0)) {
      expect(Math.abs(seat.turn), `a receptor in the neck is upright (${seat.turn})`)
        .toBeGreaterThan(Math.PI / 2 - 0.15)
      // ⚠ AND FACING OUT OF THE CELL (user, 2026-09-13). This used to assert
      // `sign === -side`, which encoded the bug rather than the rule: every
      // climbing receptor was inside out, offering its extracellular mouth to
      // the cytoplasm. The claim is about the DIRECTION the binding face ends
      // up pointing, so that is what is measured — the glyph's seat is at local
      // −y, and a turn θ sends it to (sin θ, −cos θ).
      const face = { x: Math.sin(seat.turn), y: -Math.cos(seat.turn) }
      expect(face.x, `a receptor on the ${seat.side < 0 ? 'left' : 'right'} wall binds inward`)
        .toBeCloseTo(seat.side, 1)
    }
    for (const seat of neckSeats(g, 1, 0)) {
      // ⚠ AGAINST THE FACE'S OWN SLOPE, not against zero. The face is a shallow
      // CUP — it is moulded to a round terminal — so "upright" there is the
      // membrane's normal, which is tilted about 13°; a guard on |turn| < 0.05
      // was asking the protein to ignore the wall it is in.
      const h = 1.5
      const slope = Math.atan2(faceAt(g, seat.x + h) - faceAt(g, seat.x - h), 2 * h)
      expect(seat.turn, 'it does not lie flat in the face it has arrived in')
        .toBeCloseTo(slope, 1)
    }
    // ⚠ AND THE BINDING FACE POINTS OUT OF THE CELL AT EVERY STEP — the whole
    // claim, over the whole journey, instead of at two ends and one midpoint.
    // Rounding the cap's underside the outside is DOWNWARD, which is why the
    // eased quarter this replaced could never have been right in the middle.
    const climb = neckClimbPath(g, NECK_SIDE)
    const inside = { x: g.head.cx, y: faceAt(g, g.head.cx) + g.head.ry }
    for (const q of climb) {
      const dir = { x: Math.sin(q.turn), y: -Math.cos(q.turn) }
      const out = { x: q.x - inside.x, y: q.y - inside.y }
      const len = Math.hypot(out.x, out.y) || 1
      expect(
        (dir.x * out.x + dir.y * out.y) / len,
        `a receptor at ${q.x.toFixed(0)},${q.y.toFixed(0)} binds INTO the cell`,
      ).toBeGreaterThan(0)
    }
    // …and it really does swing through the far side on the way: under the cap
    // the membrane faces down, which a quarter-turn model cannot produce.
    expect(Math.max(...climb.map((q) => Math.abs(q.turn))), 'the climb never rounds the cap')
      .toBeGreaterThan(Math.PI * 0.8)
  })

  it('A1 (21c-55): a carried receptor binds into the LUMEN, not the cytoplasm', () => {
    // ⚠ THE TOPOLOGY, and the whole reason a flip is needed. A recycling
    // endosome is made by the membrane folding IN, so the face that was
    // extracellular becomes the face looking into the bubble. A receptor riding
    // inside one offers its binding mouth to the LUMEN — which IS "outside the
    // cell", folded in — and not to the cytoplasm around it.
    //
    // The glyph is placed by stepping out along its own −y to the ring, which
    // leaves that mouth pointing away from the centre; `CARRIER_FLIP` puts it
    // back. Composed here the way the drawing composes it.
    expect(CARRIER_FLIP).toBeCloseTo(Math.PI, 9)
    const g = synapseGeometry(SYN_W, SYN_H)
    for (const seat of storeSeats(g, STORE_N)) {
      // rotate(turn) → translate(0, −r) → rotate(π); the seat at local −y ends
      // up pointing back down the radius, at the carrier's centre.
      const th = seat.turn + CARRIER_FLIP
      const face = { x: Math.sin(th), y: -Math.cos(th) }
      // the outward radius the glyph was stepped along
      const out = { x: Math.sin(seat.turn), y: -Math.cos(seat.turn) }
      const dot = face.x * out.x + face.y * out.y
      expect(dot, 'a carried receptor binds outward, into the cytoplasm').toBeLessThan(-0.9)
    }
    // ⚠ AND THE DRAWING APPLIES IT. The arithmetic above passes on a constant
    // nobody uses — a break that removed the rotate from the canvas and left
    // `CARRIER_FLIP` at π sailed through it. Both carriers must turn: the one
    // waiting in the store and the one on its way to the wall.
    const src = SOURCES['./synapseScene.ts']
    // ⚠ BOTH CARRIERS, and the travelling one COMPOSES it now (21c-62): its
    // rotation eases from `from.turn + CARRIER_FLIP` to nothing across the
    // merge, which is the flip resolving itself as the bubble opens into the
    // wall — not a second way of not applying it.
    const applied =
      src.split('ctx.rotate(CARRIER_FLIP)').length -
      1 +
      (src.split('ctx.rotate(carrierTurn(').length - 1)
    expect(applied, 'the flip is declared but never applied to a carrier')
      .toBeGreaterThanOrEqual(2)
  })

  it('A2 (21c-53): the wall meets its proteins — no gap, and no overlap', () => {
    // ⚠ TWO FAULTS, OPPOSITE WAYS ROUND (user, 2026-09-13: "close membrane gaps
    // around channels… Stored channels aread have no gap in the membrane,
    // create gaps"). The face's holes were cut to the OPEN half-width, leaving
    // bare wall round every receptor that was shut; and the side walls had no
    // holes at all, so the climbing receptors were drawn straight over the
    // molecules.
    const g = synapseGeometry(SYN_W, SYN_H)
    // ⚠ MID-CLIMB, not finished. A first version used a completed burst, where
    // `camk` is 1 and the climbers have ARRIVED on the face — and there the
    // face's own holes already cover them, so the guard passed with the side
    // walls making no room at all. They have to be caught in the wall that
    // needed teaching.
    const spine = { ...burst(8, 16000), camk: 0.2 }
    const neck = neckSeats(g, spine.camk, 0)
    for (const q of neck) {
      // On a SIDE wall — flank or neck, either is one of `spineWalls`' cubics.
      // (Not "below the neck's top": by 0.4 of the climb they are on the flank,
      // which is the same wall and the same paving.)
      expect(q.y, 'the fixture has already reached the face').toBeGreaterThan(
        faceAt(g, g.head.cx) + g.head.ry * 0.9,
      )
    }
    const standing = {
      sites: [
        ...spineReceptorSeats(g, spine.ampa, spineDensityX()),
        ],
      doors: [] as { x: number }[],
      onWalls: neck.map((q) => ({ x: q.x, y: q.y })),
    }
    const pts = membraneLipids(g, [], standing)
    const shut = ligandHalfWidth(MEM_PX * 2.6, 0)

    // …no bare wall round a face receptor beyond the packing's own step.
    const xs = pts
      .filter((p) => Math.abs(p.at.y - faceAt(g, p.at.x)) < 0.5)
      .map((p) => p.at.x)
      .sort((a, b) => a - b)
    const at = standing.sites[0].x
    const lo = Math.max(...xs.filter((x) => x < at))
    const hi = Math.min(...xs.filter((x) => x > at))
    const bare = (hi - lo) / 2 - shut
    expect(bare, `${bare.toFixed(2)}px of bare wall each side of a receptor`)
      .toBeLessThan(ZONE_SPACING)

    // …and no molecule standing where a climbing receptor is.
    const clash = pts.filter((p) =>
      neck.some((q) => Math.hypot(q.x - p.at.x, q.y - p.at.y) < shut),
    ).length
    expect(clash, `${clash} molecules drawn underneath a receptor in the neck`).toBe(0)
    // …while the wall itself is still there, either side of it.
    const near = pts.filter((p) =>
      neck.some((q) => Math.hypot(q.x - p.at.x, q.y - p.at.y) < shut * 3),
    ).length
    expect(near, 'the hole swallowed the whole wall').toBeGreaterThan(4)
  })

  it('A3 (21c-54): the spine’s edge is a FADE, not a cut', () => {
    // ⚠ MISREAD ONCE (user, 2026-09-13: "I didn't mean gradient in the
    // background itself. What I meant is that the edge behind the bilayer looks
    // like a cut. There is a distinct line which should be gone"). 21c-53 built
    // an inner GLOW, which answered a question that had not been asked.
    //
    // The fault: everything inside the spine's clip — the cytoplasm AND the
    // charge wash on top of it — stopped dead at the outline. Measured at rest
    // that step is rgb(39, 60, 67), a hard bright line round the whole spine,
    // three times the one a vesicle's rim used to show, with the bilayer drawn
    // on top of it.
    //
    // The cure is the vesicles' (21c-45): fade the inside back to the bath over
    // the wall's own thickness. Measured on the strokes actually laid down —
    // they all cover the outline itself, so their alphas compose there.
    const c = strictCanvas()
    drawSynapse(c.ctx, { run, cleft, u: 0.5, chrome: 0, spine: burst(1, 400) })
    const rim = c.inks
      .filter((i) => i.op === 'stroke' && i.stroke.startsWith(`rgba(${LUMEN_RGB}`))
      .map((i) => Number(i.stroke.match(/,\s*([\d.]+)\)$/)?.[1] ?? 0))
    expect(rim.length, 'the spine’s edge is not faded at all').toBeGreaterThan(3)
    let keep = 1
    for (const a of rim) keep *= 1 - a
    expect(
      1 - keep,
      `at the outline the inside is only ${((1 - keep) * 100).toFixed(0)}% faded back to the bath`,
    ).toBeGreaterThan(0.85)
    // …and it must not be a hard band either: no single stroke does it alone.
    expect(Math.max(...rim), 'one opaque stroke — that is a cut of its own')
      .toBeLessThan(0.75)
    expect(Math.min(...rim), 'a stroke that paints nothing').toBeGreaterThan(0)
  })

  it('A4 (21c-48): no calcium doors and no astrocyte on the receiving side', () => {
    // ⚠ (user: "Remove Ca channels, as NT release should be displayed without
    // unrelated details".) Measured by DIFFERENCE: the only thing changed
    // between the two renders is the flag, so everything that disappears
    // belongs to it.
    // ⚠ MEASURED AT THE DOORS' OWN PLACES, not on a total mark count — a first
    // version compared how much each render drew, and the spine framing ADDS
    // things (an NMDA, its stone, two cascade proteins), so restoring the doors
    // left the totals still pointing the right way and the guard passed.
    //
    // A calcium door is a `drawVoltageChannel` standing across the wall, so it
    // lays ink FURTHER from the wall line than the lipids do. Count that band
    // at each door's own x.
    const g = synapseGeometry(SYN_W, SYN_H)
    const doors = activeZone(g).doors
    expect(doors.length, 'there are no doors to remove').toBeGreaterThan(1)
    const atDoors = (c: ReturnType<typeof strictCanvas>) =>
      c.points.filter((p) =>
        doors.some((d) => {
          const dy = Math.abs(p.y - d.y)
          return Math.abs(p.x - d.x) < MEM_PX * 2 && dy > MEM_PX * 1.6 && dy < MEM_PX * 4
        }),
      ).length

    const withDoors = paint(null)
    const spine = burst(1, 400)
    const c = strictCanvas()
    drawSynapse(c.ctx, { run, cleft, u: 0.5, spine })
    expect(c.points.length, 'the spine framing drew nothing').toBeGreaterThan(300)
    expect(atDoors(withDoors), 'no door ink found to compare against')
      .toBeGreaterThan(20)
    expect(
      atDoors(c),
      `${atDoors(c)} marks still stand at the calcium doors' places`,
    ).toBeLessThan(atDoors(withDoors) * 0.34)

    // …and the astrocyte's own ink is gone with it.
    const astro = (x: ReturnType<typeof strictCanvas>) =>
      x.styles.filter((y) => y.includes(ASTRO_INK)).length
    expect(astro(withDoors), 'the astrocyte was not drawn to begin with').toBeGreaterThan(0)
    expect(astro(c), 'the astrocyte is still on the receiving side').toBe(0)
  })

  it('A5/A6 (21c-48): AMPA and NMDA on the face, growing one to three', () => {
    const g = synapseGeometry(SYN_W, SYN_H)
    // One NMDA seat plus the AMPA the model has: the last of `ampa + 1`.
    for (const n of [AMPA_AT_REST, 3]) {
      const sites = receptorSites(g, n + 1)
      expect(sites, `no seats for ${n} AMPA`).toHaveLength(n + 1)
      for (const site of sites) {
        expect(Math.abs(site.x - g.head.cx), 'a receptor is off the head')
          .toBeLessThan(g.head.rx)
      }
    }
    expect(burst(8, 20000).ampa, 'a fast burst did not potentiate').toBe(3)
    expect(burst(7, 20000).ampa, 'seven taps potentiated it').toBe(AMPA_AT_REST)
    expect(burst(8, 20000, 900).ampa, 'a slow burst potentiated it').toBe(AMPA_AT_REST)
  })

  it('the round trip is UNTOUCHED when no spine state is handed in', () => {
    const a = paint(null)
    const b = paint(null)
    expect(b.points.length).toBe(a.points.length)
    expect(a.points.length, 'the round trip drew nothing').toBeGreaterThan(500)
  })

  it('draws in every state, and honours its fade', () => {
    for (const [n, watch] of [[0, 64], [1, 400], [8, 9000], [8, 30000]] as const) {
      const s = burst(n, watch)
      for (const u of [null, 0.2, 0.6, 0.95]) {
        expect(() => {
          const c = strictCanvas()
          drawSpine(c.ctx, { run, cleft, u, spine: s })
        }, `${n} taps, u=${u}`).not.toThrow()
      }
    }
    const c = strictCanvas()
    drawSpine(c.ctx, { run, cleft, u: 0.5, spine: burst(8, 9000), fade: 0.4 })
    const over = c.alphas.filter((a) => a > 0.4001)
    expect(c.alphas.length).toBeGreaterThan(200)
    expect(over.length, `${over.length} marks painted through the fade`).toBe(0)
  })

  it('CLEFT_PX is the gap both views measure to', () => {
    expect(CLEFT_PX).toBeGreaterThan(0)
    expect(spineLanding().cleftPx).toBeCloseTo(CLEFT_PX * spineCamera().k, 9)
  })
})

describe('S13 — the view starts at the RELEASE (21c-57)', () => {
  it('A1: the clock opens on exocytosis — nothing that leads UP to it is played', () => {
    // ⚠ (user, 2026-09-13: "This view starts with NT release (all release
    // preceding actions are not present in the animation)".)
    //
    // The round trip's run is sixty model milliseconds and earns every one of
    // them; this view's subject is the last third. Two of the stretches it drops
    // have no actors on this side of the gap at all — the calcium doors were
    // taken out on 2026-09-12 and the astrocyte with them — so playing them here
    // is screen time on an empty stage.
    expect(spineClock(0) * 60, 'the view opens before the vesicles do')
      .toBeCloseTo(SPINE_FROM_MS, 6)
    expect(spineClock(1) * 60, 'the view runs on past the gap clearing')
      .toBeCloseTo(SPINE_TO_MS, 6)
    // …and the two things it must NOT reach.
    const zone = CLOCK_LEGS.find((l) => l.what.includes('doors open'))!
    expect(spineClock(0) * 60, 'the calcium doors are still played here')
      .toBeGreaterThanOrEqual(zone.to * 60)
    const loop = CLOCK_LEGS.find((l) => l.what.includes('astrocyte'))!
    expect(spineClock(1) * 60, 'the loop home is still played — and the astrocyte is not drawn')
      .toBeLessThanOrEqual(loop.from * 60)
    // …and it walks forward, once, over every leg it kept.
    let last = -1
    for (let i = 0; i <= 400; i++) {
      const m = spineClock(i / 400)
      expect(m, 'the clock goes backwards').toBeGreaterThanOrEqual(last)
      last = m
    }
    expect(SPINE_LEGS.length, 'the window kept no legs at all').toBeGreaterThan(3)
  })

  it('A1: …and the sweep is the kept legs’ OWN screen time, not a new number', () => {
    // ⚠ SLOW THE LEG, NEVER THE ITEM, and the corollary: dropping legs must not
    // stretch the ones that remain. `SPINE_SCREEN_MS` is the round trip's own
    // time for exactly the stretches this view keeps — so the release plays
    // here at the pace it was tuned to there, and the two views cannot drift.
    const kept = SPINE_LEGS.reduce((sum, l) => sum + l.share, 0)
    expect(SPINE_SCREEN_MS, 'the spine invented a duration of its own')
      .toBe(Math.round(SYNAPSE_SCREEN_MS * kept))
    expect(SPINE_SCREEN_MS, 'the window is the whole run after all')
      .toBeLessThan(SYNAPSE_SCREEN_MS * 0.6)
    // …and the STAGE walks the STORY at ITS length (21c-71). One message is no
    // longer the run: thirteen of them are, and `SPINE_SCREEN_MS` is what ONE
    // of them is worth. Advancing `u` at a single message's length would play
    // the whole story in the time act one alone should take.
    const src = STAGE['./NeuronStage.tsx']
    expect(src, 'the stage did not load').toBeTruthy()
    expect(src, 'the spine layer is still clocked by one message')
      .toContain('storyRelease(story, screenMs)')
    expect(src, 'the run is still advanced at one message’s length')
      .toContain('spineRef.current.story.ms')
    expect(src, 'the story is never built').toContain('buildSpineStory(synRun, synCleft)')
  })

  it('A1: the release itself is DRAWN inside that window — it is not just clipped', () => {
    // ⚠ A WINDOW IS A CLAIM ABOUT WHAT IS IN IT. Measured on the ink: the wall
    // must tear (a vesicle opening), the gap must fill with transmitter, and
    // sodium must end up inside the spine — all between u = 0 and u = 1 here.
    const g = synapseGeometry(SYN_W, SYN_H)
    const spine = burst(1, 400)
    let torn = 0
    let inGap = 0
    let inSpine = 0
    for (let i = 0; i <= 24; i++) {
      const ms = spineClock(i / 24) * run.windowMs
      torn = Math.max(torn, tearsAt(g, run, ms).length)
      inGap = Math.max(
        inGap,
        transmitterCast(g, run, cleft, ms, 0).filter((d: { where: string }) => d.where === 'gap')
          .length,
      )
      inSpine = Math.max(
        inSpine,
        sodiumCast(g, run, cleft, ms, 0).filter((d: { where: string }) => d.where === 'spine')
          .length,
      )
    }
    expect(torn, 'no vesicle opens anywhere in this view’s window').toBeGreaterThan(0)
    expect(inGap, 'no transmitter ever crosses the gap').toBeGreaterThan(20)
    expect(inSpine, 'no sodium ever gets into the spine').toBeGreaterThan(0)
    // …and the first frame is already the release, not a wait.
    const c = strictCanvas()
    drawSpine(c.ctx, { run, cleft, u: spineClock(0.08), spine })
    expect(c.points.length, 'the view’s opening frame draws nothing').toBeGreaterThan(300)
  })

  it('A1: no pink calcium circles on the receiving side', () => {
    // ⚠ (user, 2026-09-13: "remove pink circles for Ca".) These are the
    // TERMINAL's calcium — the ions that made the bubble merge, let in by doors
    // this framing stopped drawing. Measured by DIFFERENCE at the cast's own
    // places, never on a total: the spine framing ADDS calcium-coloured ink of
    // its own (the magnesium, calmodulin, CaMKII), so a count of pink marks
    // would be green with every last cast ion still on screen.
    const g = synapseGeometry(SYN_W, SYN_H)
    const ms = spineClock(0.1) * run.windowMs
    const ions = calciumCast(g, run, ms, 0)
    expect(ions.length, 'there was no calcium cast to remove').toBeGreaterThan(4)
    const atIons = (c: ReturnType<typeof strictCanvas>) =>
      c.points.filter((p) =>
        ions.some((i: { x: number; y: number }) => Math.hypot(i.x - p.x, i.y - p.y) < 4),
      ).length

    const round = strictCanvas()
    drawSynapse(round.ctx, { run, cleft, u: ms / run.windowMs })
    const spine = strictCanvas()
    drawSynapse(spine.ctx, { run, cleft, u: ms / run.windowMs, spine: burst(1, 400) })
    expect(atIons(round), 'no calcium ink found to compare against').toBeGreaterThan(8)
    expect(
      atIons(spine),
      `${atIons(spine)} marks still stand where the terminal’s calcium was`,
    ).toBeLessThan(atIons(round) * 0.25)
  })

  it('A2: one AMPA and one NMDA stand at the synapse when it opens', () => {
    // ⚠ (user, 2026-09-13: "At the start, we have 1 AMPA & 1 NMDA".) Measured on
    // the DRAWN density, not on the model's count — the seats function returns
    // `ampa + 1` and the drawing takes the last of them for NMDA, and either
    // half of that arrangement can be got wrong on its own.
    const g = synapseGeometry(SYN_W, SYN_H)
    expect(AMPA_AT_REST, 'the synapse does not start with one AMPA').toBe(1)
    const seats = spineReceptorSeats(g, AMPA_AT_REST)
    expect(seats.length, 'the density is not one AMPA and one NMDA').toBe(2)

    // …and BOTH are actually standing in the face. A protein spans the wall, so
    // it lays ink further from the membrane line than the lipids do — the same
    // band the calcium-doors guard counts.
    const c = strictCanvas()
    drawSynapse(c.ctx, { run, cleft, u: null, spine: spineStart() })
    const band = (x: number) =>
      c.points.filter((p) => {
        const dy = Math.abs(p.y - faceAt(g, x))
        return Math.abs(p.x - x) < MEM_PX * 2 && dy > MEM_PX * 1.6 && dy < MEM_PX * 4
      }).length
    for (const [i, seat] of seats.entries()) {
      expect(band(seat.x), `seat ${i} of the density is empty`).toBeGreaterThan(8)
    }
    // ⚠ AND NOT A THIRD. The near miss is the seat a potentiated synapse would
    // have: it must be bare until the cascade has actually delivered one.
    const grown = spineReceptorSeats(g, 3)
    const spare = grown.find((q) => seats.every((r) => Math.abs(r.x - q.x) > MEM_PX * 4))!
    expect(spare, 'three AMPA sit exactly where one does — no near miss to test').toBeTruthy()
    expect(band(spare.x), 'a receptor is already standing where the third one goes').toBe(0)

    // ⚠ AND THE TWO ARE DIFFERENT RECEPTORS, measured by DIFFERENCE — one more
    // AMPA must add SODIUM's ink and none of calcium's, which is only true if
    // exactly one seat in the density is the calcium-coloured one.
    const inks = (ampa: number) => {
      const x = strictCanvas()
      drawSynapse(x.ctx, { run, cleft, u: null, spine: { ...spineStart(), ampa } })
      return {
        na: x.styles.filter((y) => y === GLOSSY_COLORS.na.mid).length,
        ca: x.styles.filter((y) => y === GLOSSY_COLORS.ca.mid).length,
      }
    }
    const one = inks(AMPA_AT_REST)
    const two = inks(AMPA_AT_REST + 1)
    expect(one.ca, 'nothing in the density wears calcium’s ink — where is NMDA?')
      .toBeGreaterThan(0)
    expect(two.na, 'a second AMPA added no sodium ink').toBeGreaterThan(one.na)
    expect(two.ca, 'adding an AMPA added calcium ink — the receptors share a colour')
      .toBe(one.ca)
  })
})

describe('S13 — the spine’s membrane is ONE bilayer (21c-58)', () => {
  // ⚠ (user, 2026-09-13: "adjust bilayer orientation on the left side of the
  // spine, by connecting the membrane 2 parts".)
  //
  // The face and the flanks were paved by two different rules. The flanks were
  // walked along the outline's own cubics, by arc length, with the tangent they
  // actually have. The face was laid by a loop over X, a molecule every `step`
  // of x, every one of them standing STRAIGHT DOWN — which is nearly true
  // across the active zone, where the face is nearly flat, and wrong at the
  // shoulder, where it falls away on a quarter-ellipse at about 45°.
  //
  // MEASURED before: the flank's last molecule sat at (134, 503) and the face's
  // first at (140, 468) — 35px apart on a 1.62px pitch, a 108px hole at the
  // spine's magnification, with the two halves meeting at a right angle.
  const g = synapseGeometry(SYN_W, SYN_H)
  const lipids = () => membraneLipids(g, [], { sites: [], doors: [] })
  const onSpine = () => lipids().filter((p) => p.at.y > faceAt(g, g.head.cx) - 1)

  it('A1: the face and the flank MEET — no hole where the two parts join', () => {
    const pts = onSpine()
    expect(pts.length, 'the spine was not paved at all').toBeGreaterThan(200)
    // The one place they have to meet is the head's own edge, which is where
    // `spineWalls` ends and where the face's walk now starts.
    const edge = { x: g.head.cx - g.head.rx, y: faceAt(g, g.head.cx - g.head.rx) }
    expect(spineWalls(g, SYN_H)[1].p1.y, 'the outline and the face do not even touch')
      .toBeCloseTo(edge.y, 6)
    // ⚠ ASKED ACROSS THE SEAM, not around the point. A first version took the
    // two molecules nearest the head's edge and found them both on the FLANK —
    // so a face that stopped 5px short of the edge still passed. The claim is
    // about the two PARTS reaching each other, so each part is asked for its
    // own nearest molecule and the gap between those is the measurement.
    const near = (from: typeof pts) =>
      from
        .map((p) => ({ p, d: Math.hypot(p.at.x - edge.x, p.at.y - edge.y) }))
        .sort((a, b) => a.d - b.d)[0].p
    const onFace = pts.filter((p) => Math.abs(p.at.y - faceAt(g, p.at.x)) < 0.5)
    const onWall = pts.filter((p) => Math.abs(p.at.y - faceAt(g, p.at.x)) >= 0.5)
    expect(onFace.length, 'the face is bare').toBeGreaterThan(50)
    expect(onWall.length, 'the flanks are bare').toBeGreaterThan(50)
    const a = near(onFace)
    const b = near(onWall)
    const seam = Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y)
    expect(
      seam,
      `the face stops at ${a.at.x.toFixed(0)},${a.at.y.toFixed(0)} and the flank at ` +
        `${b.at.x.toFixed(0)},${b.at.y.toFixed(0)} — ${seam.toFixed(1)}px of bare wall between them`,
    ).toBeLessThan(ZONE_SPACING * 2.5)

    // …and nowhere else on the spine either: every molecule has a neighbour
    // within a few of the packing's own steps.
    let worst = 0
    let where = ''
    for (const p of pts) {
      let best = Infinity
      for (const q of pts) {
        if (q === p) continue
        best = Math.min(best, Math.hypot(q.at.x - p.at.x, q.at.y - p.at.y))
      }
      if (best > worst) {
        worst = best
        where = `${p.at.x.toFixed(0)},${p.at.y.toFixed(0)}`
      }
    }
    expect(worst, `a ${worst.toFixed(1)}px hole in the spine’s wall at ${where}`)
      .toBeLessThan(ZONE_SPACING * 2.5)
  })

  it('A1: …and the orientation runs THROUGH the join, it does not turn a corner', () => {
    // Walk the left shoulder from low in the flank up onto the face and require
    // the inward direction to change smoothly. The old pair of rules produced a
    // step of about 90° at the join; the packing's own step cannot produce more
    // than a few degrees between neighbours.
    const near = onSpine()
      .filter((p) => p.at.x < g.head.cx - g.head.rx * 0.9)
      .sort((a, b) => b.at.y - a.at.y)
    expect(near.length, 'the shoulder is bare').toBeGreaterThan(20)
    let jump = 0
    let at = ''
    for (let i = 1; i < near.length; i++) {
      const a = near[i - 1].inward
      const b = near[i].inward
      const d = Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y))
      if (d > jump) {
        jump = d
        at = `${near[i].at.x.toFixed(0)},${near[i].at.y.toFixed(0)}`
      }
    }
    expect((jump * 180) / Math.PI, `the bilayer turns ${((jump * 180) / Math.PI).toFixed(0)}° at ${at}`)
      .toBeLessThan(12)
  })

  it('A1: every molecule stands ACROSS the wall it is in, shoulder included', () => {
    // ⚠ THE NEAR MISS IS "STRAIGHT DOWN". The old face rule handed every
    // molecule `inward = (0, 1)` whatever the wall was doing, and on the flat
    // part of the face that is correct — so a guard that only asked about
    // perpendicularity, or only looked at the middle, passed on the bug.
    const pts = onSpine()
    for (const p of pts) {
      const dot = p.tangent.x * p.inward.x + p.tangent.y * p.inward.y
      expect(Math.abs(dot), 'a molecule lies along its wall instead of across it')
        .toBeLessThan(1e-9)
      // …and it points INTO the cell, never out of it.
      const toward = {
        x: g.head.cx - p.at.x,
        y: faceAt(g, g.head.cx) + g.head.ry - p.at.y,
      }
      expect(
        p.inward.x * toward.x + p.inward.y * toward.y,
        `a molecule at ${p.at.x.toFixed(0)},${p.at.y.toFixed(0)} is inside out`,
      ).toBeGreaterThan(0)
    }
    // …and on the shoulder that is emphatically NOT straight down: the face
    // there runs at about 45°, so its molecules must lean with it.
    const shoulder = pts.filter(
      (p) =>
        Math.abs(p.at.y - faceAt(g, p.at.x)) < 0.5 &&
        Math.abs(p.at.x - g.head.cx) > g.head.rx * 0.94,
    )
    expect(shoulder.length, 'the shoulder of the face is not paved').toBeGreaterThan(8)
    const lean = Math.max(
      ...shoulder.map((p) => Math.abs(Math.atan2(p.inward.x, p.inward.y))),
    )
    expect((lean * 180) / Math.PI, 'the shoulder’s molecules still stand straight down')
      .toBeGreaterThan(30)
  })
})

describe('S13 — the timeline, and where the synapse sits (21c-59)', () => {
  const g = synapseGeometry(SYN_W, SYN_H)

  it('A1: the view has a timeline, on ITS clock, and the wiring says so', () => {
    // ⚠ (user, 2026-09-13: "add timeline".) The dots have to be placed by THIS
    // view's clock: its window is 45% of the run's, so an event placed by the
    // round trip's `screenOfModel` would sit at less than half the bar it
    // belongs to — measured, "the gap is full" would show at 0.13 instead of
    // 0.29. And events outside the window must be dropped, not clamped: a dot
    // pinned to an end claims a moment this view never plays.
    const mid = (SPINE_FROM_MS + SPINE_TO_MS) / 2 / 60
    expect(spineScreenOfModel(spineClock(0.37)), 'the clock and its inverse disagree')
      .toBeCloseTo(0.37, 6)
    expect(spineScreenOfModel(mid)).toBeGreaterThan(0)
    expect(spineScreenOfModel(mid)).toBeLessThan(1)
    expect(spineScreenOfModel(SPINE_FROM_MS / 60)).toBeCloseTo(0, 6)
    expect(spineScreenOfModel(SPINE_TO_MS / 60)).toBeCloseTo(1, 6)
    // …and it really is a different answer from the round trip's.
    expect(Math.abs(spineScreenOfModel(mid) - screenOfModel(mid)), 'the two bars agree — one of them is wrong')
      .toBeGreaterThan(0.1)

    const src = STAGE['./NeuronStage.tsx']
    expect(src, 'the spine has no transport bar').toContain('points={spinePoints}')
    // ⚠ AND THE BAR CARRIES CHAPTERS NOW (21c-71). It was dated in one
    // message's own events, which was right while one message WAS the run.
    // Thirteen of them share it now, and a bar dated inside the first would be
    // a bar about the first quarter of itself.
    expect(src, 'the bar is not dated off the story’s acts').toContain('spineStory.acts.map')
    expect(src, 'the timer still reads one message’s model clock')
      .toContain('(synShownU * spineStory.ms) / 1000')

    // ⚠ THE SODIUM'S DATING SURVIVES, in the place that now needs it: every
    // message's model pulse is due when ITS OWN drawn sodium is through the
    // wall, so no answer in the story plays before its cause. Asked as
    // ARITHMETIC on the story rather than as a string in the wiring.
    const story = buildSpineStory(run, cleft)
    const na = naPhase(run, cleft)
    for (const m of story.messages) {
      expect(m.phase, `a message shows only ${m.phase.toFixed(2)} of the window — its sodium never lands`)
        .toBeGreaterThan(na)
      const drawnAt = m.at + m.ms * (na / m.phase)
      expect(m.fireAt, 'a message is told at a different moment from its drawn sodium')
        .toBeCloseTo(drawnAt, 6)
    }
    // …and the lag really is most of a message, so this is not a distinction
    // without a difference.
    expect(na, `the sodium lands ${(na * 100).toFixed(0)}% into a message`).toBeGreaterThan(0.5)
  })

  it('A1: …and the room it needs is bought for the VESICLES, not the wall', () => {
    // The old constant was 104 — room for the membrane. A docked bubble stands
    // above it, and at that framing the middle one's top was 69px off the top
    // of the picture with the rest of it behind the bar.
    expect(SPINE_TOP, 'the room did not grow at all').toBeGreaterThan(150)
    expect(SPINE_TOP, 'the terminal has taken the picture over')
      .toBeLessThan(STAGE_H * SPINE_TOP_CAP)
    // ⚠ AND IT IS SOLVED, not typed: changing the frame's height must move it.
    expect(solveSpineTop(STAGE_H + 200), 'the room is a constant in disguise')
      .toBeGreaterThan(SPINE_TOP + 20)
  })

  it('A3: the synapse lands in the middle of the picture, and stays a synapse', () => {
    // ⚠ (user, 2026-09-13: "Move them to the left along the membrane, so that
    // they appear centered in relation to the screen".) The camera cannot do
    // it — the head is wider than the stage, so a frame holding the left flank
    // cannot also centre the zone's middle. The DENSITY moves instead.
    const { k, dx } = spineCamera()
    const seats = spineReceptorSeats(g, AMPA_AT_REST, spineDensityX()).map((p) => dx + p.x * k)
    const middle = (Math.min(...seats) + Math.max(...seats)) / 2
    expect(middle, `the synapse sits at ${middle.toFixed(0)} of a ${STAGE_W}px stage`)
      .toBeGreaterThan(STAGE_W * 0.42)
    expect(middle).toBeLessThan(STAGE_W * 0.58)
    // ⚠ AND IT IS STILL OPPOSITE A RELEASE SITE. A density facing no active zone
    // is not a synapse, so the move is clamped — and the clamp is the claim.
    expect(spineDensityX(), 'the density has slid off the active zone')
      .toBeGreaterThan(g.head.cx - g.activeHalf)
    expect(spineDensityX()).toBeLessThan(g.head.cx + g.activeHalf)
    // …and it really did MOVE, or this whole thing is decoration.
    expect(Math.abs(spineDensityX() - g.head.cx), 'the density never moved')
      .toBeGreaterThan(g.activeHalf * 0.1)
  })

  it('A2: no calcium sensor and no calcium snap on the receiving side', () => {
    // ⚠ (user, 2026-09-13: "remove Ca binding purple circles, together with
    // sparkle on binding. Start with NT release directly".) The knobs are
    // synaptotagmin — the CALCIUM SENSOR — and this framing draws neither the
    // doors that admit the calcium nor the calcium itself.
    //
    // Measured by DIFFERENCE at the knobs' own places, never on a total: the
    // spine framing adds calcium-coloured ink of its own.
    const zone = activeZone(g)
    const knobs = zone.docked.flatMap((d) => snareMini(g, d).knobs)
    expect(knobs.length, 'there are no sensors to remove').toBeGreaterThan(4)
    const atKnobs = (c: ReturnType<typeof strictCanvas>) =>
      c.arcs.filter(
        (a) => a.r < MEM_PX && knobs.some((q) => Math.hypot(q.x - a.x, q.y - a.y) < 2),
      ).length
    const round = strictCanvas()
    drawSynapse(round.ctx, { run, cleft, u: 0.06 })
    const spine = strictCanvas()
    drawSynapse(spine.ctx, { run, cleft, u: 0.06, spine: burst(1, 400) })
    expect(atKnobs(round), 'no sensor ink found to compare against').toBeGreaterThan(4)
    expect(atKnobs(spine), `${atKnobs(spine)} sensors still stand on the vesicles`).toBe(0)

    // …and the snap that marks calcium seating on them goes with them.
    //
    // ⚠ MEASURED ON THE DRAWING, not on `bindPulses`. A first version asked the
    // function with the flag off and was green while the SCENE went on passing
    // the flag on — a break that restored the drawing's argument sailed
    // straight through it. And the snaps are not merely clipped away by the
    // clock: measured, they run from 2.45 to 6.12 ms and the view's window
    // opens at 2.56, so most of them fall inside it.
    const snapAt = (() => {
      for (let i = 0; i <= 400; i++) {
        const u = i / 400
        const ms = spineClock(u) * run.windowMs
        const hit = bindPulses(g, run, cleft, ms, true).filter((q) =>
          knobs.some((n) => Math.hypot(n.x - q.x, n.y - q.y) < 2),
        )
        if (hit.length) return { u, ms, at: hit[0] }
      }
      return null
    })()
    expect(snapAt, 'no calcium snap falls inside this view’s window — nothing to remove')
      .not.toBeNull()
    const glowAt = (c: ReturnType<typeof strictCanvas>) =>
      c.arcs.filter(
        (a) => a.r > MEM_PX * 2 && Math.hypot(a.x - snapAt!.at.x, a.y - snapAt!.at.y) < 3,
      ).length
    const rr = strictCanvas()
    drawSynapse(rr.ctx, { run, cleft, u: snapAt!.ms / run.windowMs })
    const ss = strictCanvas()
    drawSynapse(ss.ctx, { run, cleft, u: snapAt!.ms / run.windowMs, spine: burst(1, 400) })
    expect(glowAt(rr), 'no snap was drawn to compare against').toBeGreaterThan(0)
    expect(glowAt(ss), 'the calcium’s snap still flashes on the receiving side').toBe(0)

    // …while the TRANSMITTER's own binding flash — the event this view IS about
    // — is untouched.
    let kept = 0
    for (let i = 0; i <= 80; i++) {
      const ms = spineClock(i / 80) * run.windowMs
      kept += bindPulses(g, run, cleft, ms, false).length
    }
    expect(kept, 'removing the calcium snap took the transmitter’s with it')
      .toBeGreaterThan(0)
  })

  it('A4/A5: the carriers wait DEEP in the head, and apart', () => {
    // ⚠ (user, 2026-09-13: "Place 2 stored AMPAs further apart. 1 may go further
    // along the membrane" and "Place circles with AMPAs deeper in spine,
    // further away from the top".) Measured before: both sat 0.62 of the head's
    // half-height under the face — in its top third, reading as part of the
    // density above them — and they differed only in x.
    const seats = storeSeats(g, STORE_N, spineDensityX())
    const face = faceAt(g, g.head.cx)
    const depth = seats.map((q) => (q.y - face) / (2 * g.head.ry))
    expect(Math.min(...depth), `the shallower carrier is ${(Math.min(...depth) * 100).toFixed(0)}% down`)
      .toBeGreaterThan(0.4)
    expect(Math.max(...depth), 'a carrier has sunk out of the head').toBeLessThan(0.95)
    expect(Math.abs(seats[0].y - seats[1].y), 'the two carriers sit at one depth')
      .toBeGreaterThan(storeR())
    expect(Math.abs(seats[0].x - seats[1].x), 'the two carriers are stacked')
      .toBeGreaterThan(storeR() * 3)
    // ⚠ AND INSIDE THE CELL AT THAT DEPTH, which "below the face" does NOT
    // establish: the head narrows toward the neck, and pushing the pair deeper
    // and further apart put the left one 5px THROUGH the wall — a membrane
    // compartment drawn outside the membrane. Asked of the outline's own span.
    const { k, dx, dy } = spineCamera()
    for (const q of seats) {
      const span = headSpanAt(g, q.y)
      expect(span, 'a carrier is below the spine altogether').not.toBeNull()
      expect(q.x - storeR(), `a carrier at ${q.x.toFixed(0)} is through the left wall`)
        .toBeGreaterThan(span!.lo)
      expect(q.x + storeR(), 'a carrier is through the right wall').toBeLessThan(span!.hi)
      expect(dx + q.x * k).toBeGreaterThan(storeR() * k)
      expect(dx + q.x * k).toBeLessThan(STAGE_W - storeR() * k)
      expect(dy + q.y * k).toBeLessThan(STAGE_H - storeR() * k)
      expect(q.y, 'a carrier is outside the cell').toBeGreaterThan(face)
    }
  })
})

describe('S13 — the transmitter binds THE RECEPTORS THAT ARE THERE (21c-60)', () => {
  // ⚠ (user, 2026-09-13: "NT bind the wrong place. Expected: bind receptors".)
  //
  // Everything with an opinion about a receptor — who catches which ball, when
  // a channel may show itself bound, where sodium crosses, when the departing
  // flash launches — worked it out from `receptorSites(g)`, the ROUND TRIP's
  // five seats. This view draws two, tightly clustered, at a centre of its own.
  //
  // MEASURED before: a seated ball could be 535px from the nearest drawn
  // receptor, spread over twelve columns, one of them off the side of the
  // stage. After: 15px, inside a receptor's own mouth.
  const base = synapseGeometry(SYN_W, SYN_H)
  const g = spineGeometry(AMPA_AT_REST)

  it('A1: a seated ball is at a DRAWN receptor’s mouth, never at a phantom one', () => {
    const seats = spineReceptorSeats(base, AMPA_AT_REST, spineDensityX())
    const half = ligandHalfWidth(MEM_PX * 2.6, 1)
    let seen = 0
    let worst = 0
    for (let i = 0; i <= 120; i++) {
      const ms = spineClock(i / 120) * run.windowMs
      for (const d of transmitterCast(g, run, cleft, ms, 0)) {
        if (d.where !== 'seat') continue
        seen++
        worst = Math.max(worst, Math.min(...seats.map((q) => Math.abs(q.x - d.x))))
      }
    }
    expect(seen, 'nothing ever binds at all').toBeGreaterThan(20)
    expect(worst, `a ball seats ${worst.toFixed(0)}px from the nearest receptor`)
      .toBeLessThan(half)

    // ⚠ AND THE ROUND TRIP'S ROW REALLY WOULD HAVE BEEN WRONG — without this
    // the guard could be green on a view whose two rows happen to coincide.
    let wrong = 0
    for (let i = 0; i <= 120; i++) {
      const ms = spineClock(i / 120) * run.windowMs
      for (const d of transmitterCast(base, run, cleft, ms, 0)) {
        if (d.where !== 'seat') continue
        wrong = Math.max(wrong, Math.min(...seats.map((q) => Math.abs(q.x - d.x))))
      }
    }
    expect(wrong, 'the two rows agree — there was nothing to fix').toBeGreaterThan(half * 4)
  })

  it('A1: …and sodium crosses at a receptor too, not through bare wall', () => {
    const seats = spineReceptorSeats(base, AMPA_AT_REST, spineDensityX())
    const half = ligandHalfWidth(MEM_PX * 2.6, 1)
    let seen = 0
    let worst = 0
    for (let i = 0; i <= 120; i++) {
      const ms = spineClock(i / 120) * run.windowMs
      for (const d of sodiumCast(g, run, cleft, ms, 0)) {
        if (d.where !== 'spine') continue
        seen++
        worst = Math.max(worst, Math.min(...seats.map((q) => Math.abs(q.x - d.x))))
      }
    }
    expect(seen, 'no sodium ever gets in').toBeGreaterThan(4)
    // Once inside it settles and wanders, so the claim is about the MOUTH it
    // came through: nothing may be further from a receptor than the spread the
    // settle is allowed.
    expect(worst, `sodium ends up ${worst.toFixed(0)}px from any receptor`)
      .toBeLessThan(half * 3)
  })

  it('A1: and the DRAWING is what carries the row — not just the cast', () => {
    // ⚠ A CAST TEST PASSES ON A DRAWING THAT NEVER HANDS ITS ROW OVER (21c-56's
    // rule). `drawSynapse` builds the geometry itself, so the claim is measured
    // on what it paints: transmitter ink at the drawn receptors' mouths, and
    // none at the round trip's outer seats, which have no receptor in them.
    const seats = spineReceptorSeats(base, AMPA_AT_REST, spineDensityX())
    const phantom = castSeats(base).filter(
      (q) => Math.min(...seats.map((r) => Math.abs(r.x - q.x))) > MEM_PX * 8,
    )
    expect(phantom.length, 'the two rows overlap — no phantom seat to test')
      .toBeGreaterThan(2)
    // the moment the first ball is seated at this framing
    const at = (() => {
      for (let i = 0; i <= 200; i++) {
        const ms = spineClock(i / 200) * run.windowMs
        if (transmitterCast(g, run, cleft, ms, 0).some((d) => d.where === 'seat')) return ms
      }
      return null
    })()
    expect(at, 'nothing is ever seated inside this view’s window').not.toBeNull()

    // ⚠ BY DIFFERENCE, because the gap is FULL of wandering balls and some of
    // them are always near some x. The two renders are the same run at the same
    // moment with the same thermal clock, so the wanderers are identical in
    // both and what differs is exactly who is SEATED.
    const paintAt = (spine: SpineState | null) => {
      const c = strictCanvas()
      drawSynapse(c.ctx, { run, cleft, u: at! / run.windowMs, jiggle: 0, spine })
      return c
    }
    const round = paintAt(null)
    const mine = paintAt(burst(1, 400))
    const near = (c: ReturnType<typeof strictCanvas>, xs: { x: number; y: number }[]) =>
      c.arcs.filter(
        (a) =>
          a.r < MEM_PX &&
          xs.some((q) => Math.abs(a.x - q.x) < MEM_PX * 3 && Math.abs(a.y - q.y) < MEM_PX * 4),
      ).length
    expect(near(round, phantom), 'nothing seats at the round trip’s row even there')
      .toBeGreaterThan(0)
    expect(
      near(mine, phantom),
      `${near(mine, phantom)} balls are drawn at bare membrane against ` +
        `${near(round, phantom)} at the round trip’s own receptors`,
    ).toBeLessThan(near(round, phantom))
    // ⚠ AND NOT THE MIRROR CLAIM. "More ink at the drawn seats" was tried and is
    // not measurable here: the gap is crowded enough that wanderers swamp the
    // one or two balls the difference is about. Where a ball CAN only be a
    // seated ball is at the phantom seats, and that is what is asked.
  })

  it('A1: the NMDA waits for ITS OWN glutamate before it shows itself bound', () => {
    // ⚠ IT DID NOT. `socket` read `nmdaOpen`, which is a function of the TAP —
    // so the pink receptor showed itself bound seconds before any transmitter
    // was drawn reaching it, which is exactly the fault the gold ones were
    // fixed for on 2026-09-01. How far it OPENS is still the spine's model:
    // NMDA is slow, and that is the lesson.
    const src = SOURCES['./synapseScene.ts']
    expect(src, 'the NMDA still shows itself bound off the tap')
      .not.toContain('socket: nmdaOpen(sp) > 0.05')
    expect(src, 'the NMDA does not read the cast’s own seat window')
      .toContain('socket: nmdaSeated')
    // …and the window it reads is the LAST seat — its own place in the row.
    expect(src).toContain('receptorSeatWindow(g, v.run, v.cleft, spineSeats.length - 1)')
    // …while its opening is still the model's.
    expect(src).toContain('open: Math.min(1, nmdaOpen(sp))')
  })
})

describe('S13 — no transmitter pump on the receiving side (21c-61)', () => {
  it('A1: VGLUT is gone from the vesicles here, and still on the round trip', () => {
    // ⚠ (user, 2026-09-13: "remove NT pumps from vesicles".) VGLUT is the door
    // the transmitter goes IN by, and the filling is the last leg of a loop this
    // framing's clock does not play — the window shuts at 30ms and the vesicles
    // refill from 53. A pump with nothing to pump is the same fault as the
    // calcium sensor with nothing to sense.
    const ink = (spine: SpineState | null) => {
      const c = strictCanvas()
      drawSynapse(c.ctx, { run, cleft, u: 0.1, jiggle: 0, spine, densityX: spineDensityX() })
      return c.styles.filter((y) => y === CHANNEL_INK.vglut.wall).length
    }
    expect(ink(null), 'the round trip draws no VGLUT to compare against').toBeGreaterThan(0)
    expect(ink(burst(1, 400)), 'the transmitter pumps are still on the receiving side')
      .toBe(0)
  })
})

describe('S13 — the ions that get past the stone are DRAWN (21c-61)', () => {
  const g = synapseGeometry(SYN_W, SYN_H)

  /** Run the spine's model to a moment where `pick` is true, or null. */
  const until = (pick: (s: SpineState) => boolean, taps = 8, gap = 220) => {
    const s = spineStart()
    let fired = 0
    for (let t = 0; t < 14000; t += 8) {
      if (fired < taps && s.now >= fired * gap) {
        spineFire(s)
        fired++
      }
      spineStep(s, 8)
      if (pick(s)) return s
    }
    return null
  }

  it('A3: an ion in the pore is INK, at the NMDA’s own seat', () => {
    // ⚠ MEASURED BY DIFFERENCE at the pore's mouth: the same frame with and
    // without the ion, so what differs is the ion. A count of marks near a
    // receptor is a count of the receptor.
    const withIon = until((s) => s.ions.some((i) => i.t > 0.2 && i.t < 0.8))
    expect(withIon, 'no ion is ever in the pore').not.toBeNull()
    const seat = spineReceptorSeats(g, withIon!.ampa, spineDensityX()).slice(-1)[0]
    const paint = (sp: SpineState) => {
      const c = strictCanvas()
      // ⚠ WITH THE FRAMING'S OWN DENSITY. Without it the drawing puts the
      // synapse back at the release site and the guard measures bare membrane.
      drawSynapse(c.ctx, { run, cleft, u: 0.5, jiggle: 0, spine: sp, densityX: spineDensityX() })
      return c.arcs.filter(
        (a) => a.r < MEM_PX && Math.hypot(a.x - seat.x, a.y - seat.y) < MEM_PX * 4,
      ).length
    }
    const empty: SpineState = { ...withIon!, ions: [] }
    expect(paint(withIon!), 'the ion in the pore is not drawn').toBeGreaterThan(paint(empty))
  })

  it('A3: the calcium goes to CALMODULIN, the sodium does not', () => {
    // ⚠ A calcium ion that drifted off into the cytoplasm would leave the
    // cascade beside it unexplained: the pink ones are what the next thing
    // responds to, so their journey has to END there.
    const src = SOURCES['./synapseScene.ts']
    expect(src, 'the ions do not travel anywhere').toContain('for (const ion of sp.ions)')
    expect(src, 'calcium does not head for calmodulin').toContain('? calmodulin')
    // …measured on the ink: at the end of a calcium's journey there is a mark at
    // calmodulin that is not there without it.
    // ⚠ AT THE END OF THE JOURNEY, not most of the way along it. The travel is
    // EASED, so at t = 1.65 the ion is 72% of the way and a guard on the last
    // few pixels reads bare cytoplasm.
    const arriving = until((s) => s.ions.some((i) => i.kind === 'ca' && i.t > 1.9 && i.t < 1.99))
    expect(arriving, 'no calcium ever completes its journey').not.toBeNull()
    const cy = faceAt(g, g.head.cx) + g.head.ry * 0.95
    const cr = g.head.ry * 0.2
    const at = { x: spineDensityX() - cr * 1.35, y: cy }
    const paint = (sp: SpineState) => {
      const c = strictCanvas()
      // ⚠ WITH THE FRAMING'S OWN DENSITY. Without it the drawing puts the
      // synapse back at the release site and the guard measures bare membrane.
      drawSynapse(c.ctx, { run, cleft, u: 0.5, jiggle: 0, spine: sp, densityX: spineDensityX() })
      return c.arcs.filter(
        (a) => a.r < MEM_PX && Math.hypot(a.x - at.x, a.y - at.y) < cr * 0.5,
      ).length
    }
    const only = { ...arriving!, ions: arriving!.ions.filter((i) => i.kind === 'ca') }
    expect(paint(only), 'nothing arrives at calmodulin').toBeGreaterThan(
      paint({ ...only, ions: [] }),
    )
  })

  it('A3: a queue waits at the MOUTH while the stone is down', () => {
    const waiting = until((s) => nmdaWaiting(s) > 0)
    expect(waiting, 'nothing ever waits at the mouth').not.toBeNull()
    const seat = spineReceptorSeats(g, waiting!.ampa, spineDensityX()).slice(-1)[0]
    const paint = (sp: SpineState) => {
      const c = strictCanvas()
      // ⚠ WITH THE FRAMING'S OWN DENSITY. Without it the drawing puts the
      // synapse back at the release site and the guard measures bare membrane.
      drawSynapse(c.ctx, { run, cleft, u: 0.5, jiggle: 0, spine: sp, densityX: spineDensityX() })
      // ABOVE the membrane — in the cleft, where a queue at a mouth is.
      return c.arcs.filter(
        (a) =>
          a.r < MEM_PX &&
          Math.abs(a.x - seat.x) < MEM_PX * 3 &&
          a.y < seat.y - MEM_PX * 3 &&
          a.y > seat.y - MEM_PX * 9,
      ).length
    }
    const none: SpineState = { ...waiting!, queued: 0, flowed: 0, sent: 0 }
    expect(paint(waiting!), 'nothing is drawn queueing').toBeGreaterThan(paint(none))
  })
})

describe('S13 — the carrier MERGES, and the catcher turns as it does (21c-62)', () => {
  const g = synapseGeometry(SYN_W, SYN_H)

  it('A2: the journey has a merge between the float and the slide', () => {
    // ⚠ (user's flow: "floats towards membrane and merges with it, leaving
    // receptor put".) It used to reach the wall and VANISH, with a receptor
    // appearing in its place — so the one moment the topology note is about was
    // never on screen.
    const at = (u: number) => deliveryAt({ id: 0, t: u * DELIVER_MS })
    expect(DELIVER_MERGE_SHARE, 'there is no merge').toBeGreaterThan(0.05)
    const mergeFrom = DELIVER_FUSE_AT - DELIVER_MERGE_SHARE
    // the float finishes where the merge starts…
    expect(at(mergeFrom).fused).toBeCloseTo(1, 6)
    expect(at(mergeFrom).merge).toBeCloseTo(0, 6)
    // …the merge finishes where the slide starts…
    expect(at(DELIVER_FUSE_AT).merge).toBeCloseTo(1, 6)
    expect(at(DELIVER_FUSE_AT).slid).toBeCloseTo(0, 6)
    // …and the MIDDLE of it is a real state, not a boundary.
    const mid = at(mergeFrom + DELIVER_MERGE_SHARE / 2)
    expect(mid.merge).toBeGreaterThan(0.3)
    expect(mid.merge).toBeLessThan(0.7)
    expect(mid.slid, 'it is already sliding before it has finished merging').toBe(0)
  })

  it('A2: the ring shrinks away and the catcher ends UPRIGHT in the wall', () => {
    // Measured on the ink at the two ends of the merge: a big ring of bilayer
    // at the start, none of it at the end, and the receptor's own mark moved
    // from out on the ring to the membrane line.
    // ⚠ AND WHICH WAY IT FACES IS A DECISION, not ink — nothing a guard can
    // count on a canvas tells you which way a protein points, and a break that
    // left the catcher riding upside-down into the wall was invisible to the
    // ink test below.
    for (const seat of storeSeats(g, STORE_N, spineDensityX())) {
      const riding = carrierTurn(seat.turn, 0)
      const face = { x: Math.sin(riding), y: -Math.cos(riding) }
      const out = { x: Math.sin(seat.turn), y: -Math.cos(seat.turn) }
      expect(
        face.x * out.x + face.y * out.y,
        'a riding catcher faces out of its bubble, into the cytoplasm',
      ).toBeLessThan(-0.9)
      // …and merged, it faces OUT of the cell: straight up, out of the face.
      expect(carrierTurn(seat.turn, 1), 'a merged catcher is not upright in the wall')
        .toBeCloseTo(0, 9)
      // …through a middle that is neither.
      const half = Math.abs(carrierTurn(seat.turn, 0.5))
      expect(half).toBeGreaterThan(0.1)
      expect(half).toBeLessThan(Math.abs(riding) - 0.1)
    }

    const shoulder = wallQueueX(g, 0, spineDensityX())
    const wallY = faceAt(g, shoulder)
    const paint = (u: number) => {
      const s = spineStart()
      s.ampa = AMPA_AT_REST
      s.deliveries = [{ id: 0, t: u * DELIVER_MS }]
      const c = strictCanvas()
      drawSynapse(c.ctx, { run, cleft, u: 0.5, jiggle: 0, spine: s, densityX: spineDensityX() })
      return c
    }
    const mergeFrom = DELIVER_FUSE_AT - DELIVER_MERGE_SHARE
    const ringOf = (c: ReturnType<typeof strictCanvas>) =>
      c.arcs.filter(
        (a) => a.r > storeR() * 0.4 && Math.hypot(a.x - shoulder, a.y - wallY) < storeR() * 3,
      ).length
    const start = paint(mergeFrom + 0.01)
    const end = paint(DELIVER_FUSE_AT - 0.005)
    expect(ringOf(start), 'no carrier is drawn arriving at the wall').toBeGreaterThan(0)
    expect(ringOf(end), 'the carrier is still a bubble when the merge is over').toBe(0)
    // …and the receptor has come IN to the wall line.
    const near = (c: ReturnType<typeof strictCanvas>, d: number) =>
      c.points.filter((p) => Math.hypot(p.x - shoulder, p.y - wallY) < d).length
    expect(near(end, MEM_PX * 4), 'nothing is left standing in the wall')
      .toBeGreaterThan(near(start, MEM_PX * 4))
  })
})

describe('S13 — the controls, the SNARE, the ligand and the tint (21c-63)', () => {
  it('A1: ONE action button, a restart beside it, and NO message on either', () => {
    // ⚠ (user, 2026-09-13: "no need of two action buttons. Remove send a
    // message. Keep play".) That ruling was made when ▶ ALSO sent a message —
    // the two buttons were "send" and "play", both acting on the cell, and one
    // of them was redundant furniture.
    //
    // ⚠ IT IS A TRANSPORT NOW (21c-71), and the ruling is kept where it bites:
    // there is still exactly ONE button that acts on the run, and no button
    // sends a message at all, because the STORY sends them. Beside it is a
    // restart, which is not a second action — *every transport that can reach
    // an end needs a control that says start over* — and this run needs one
    // twice over, because the cell it drives has LEARNED by the end.
    const src = STAGE['./NeuronStage.tsx']
    const plate = src.slice(src.indexOf('⚠ ▶ IS A TRANSPORT NOW'))
    expect(plate, 'the spine’s action plate is gone').toBeTruthy()
    const row = plate.slice(0, plate.indexOf('</div>'))
    expect(row.split('<button').length - 1, 'the spine grew a second ACTION button')
      .toBe(1)
    // ⚠ AND THE RESTART IS THE APP'S ONE RESET, never a sixth hand-drawn ↺
    // (user, 2026-08-30: "adjust 'reset' button across the app").
    expect(row, 'the restart is not the app’s own reset control').toContain('<ResetButton')
    // ⚠ NO BUTTON SENDS A MESSAGE. One that did would quietly change the
    // experiment the story is running — and it is the experiment, not the
    // child's finger, that this view now teaches with.
    expect(row, 'a button still fires the terminal by hand')
      .not.toContain('spineFire(spineRef.current.state')
    expect(row, 'the button does not start the run').toContain('.fire()')
    // ⚠ AND A PAUSE IS RIGHT HERE NOW, where 21c-63 was right to forbid it. It
    // was forbidden because every press sent a message, so pausing cost the
    // burst. The burst is scripted; pausing costs nothing and is what a
    // fifty-three second story needs.
    expect(row, 'a story this long cannot be stopped').toContain('.pause()')
    expect(row, 'there is no way to start over').toContain('.reset()')
    // …and restarting must put the CELL back, not only the transport.
    expect(row, 'the restart replays into a synapse that already learned')
      .toContain('spineRef.current.state = spineStart()')
    // ⚠ AND THE ROOM IS PAID FOR. A row added under the bar and not counted
    // into the chrome is a row drawn over the vesicles.
    expect(SPINE_CHROME_PX, 'the action row is not counted into the chrome')
      .toBeGreaterThanOrEqual(62 + 38)
  })

  it('A2: no SNARE on the receiving side', () => {
    // ⚠ (user, 2026-09-13: "remove snare".) The SNARE is the machine that pulls
    // the two membranes together, and this framing's window opens after it has
    // done its work — its calcium sensor went for the same reason in 21c-59.
    const ink = (spine: SpineState | null) => {
      const c = strictCanvas()
      drawSynapse(c.ctx, { run, cleft, u: 0.12, jiggle: 0, spine, densityX: spineDensityX() })
      // ⚠ NOT ALL THREE STRANDS. `#7dd3fc` is the app's sky, and the spine's own
      // cold aura wears it — measured, two marks in a frame with no rope in it
      // at all. A colour claim has to be made on ink only the thing being
      // measured lays down.
      const own = (SNARE_STRANDS as readonly string[]).filter((y) => y !== '#7dd3fc')
      return c.styles.filter((y) => own.includes(y)).length
    }
    expect(ink(null), 'the round trip draws no rope to compare against').toBeGreaterThan(0)
    expect(ink(burst(1, 400)), 'the rope is still on the receiving side').toBe(0)
  })

  it('A3: the NMDA keeps its glutamate — it does not lose it before it opens', () => {
    // ⚠ (user, 2026-09-13: "glutamate is gone from NMDA before it gets
    // activated, which is wrong. Why did you make this decision?" — it was not
    // a decision. Every seat released its ligand on AMPA's schedule, about a
    // millisecond; NMDA's stays bound for hundreds, and that slow unbinding is
    // the whole reason NMDA is the slow one.)
    const geom = spineGeometry(AMPA_AT_REST)
    const last = (geom.seats ?? []).length - 1
    expect(geom.slowSeat, 'no seat is marked slow').toBe(last)
    const slow = receptorSeatWindow(geom, run, cleft, last)
    expect(slow.seatedAt, 'the NMDA never gets a ligand at all').not.toBeNull()
    expect(slow.releasedAt, 'the NMDA still loses its glutamate').toBeNull()
    // …and the fast ones still let go, or nothing has been distinguished.
    const fast = receptorSeatWindow(geom, run, cleft, 0)
    expect(fast.releasedAt, 'every seat now holds its ligand for ever').not.toBeNull()
    // ⚠ AND IT IS STILL THERE WHEN THE RECEPTOR IS OPEN. NMDA rises over
    // hundreds of screen-milliseconds; the ligand must outlast that.
    const s = spineStart()
    for (let t = 0; t < 900; t += 16) {
      if (t === 0) spineFire(s)
      spineStep(s, 16)
    }
    expect(nmdaOpen(s), 'the fixture is not past NMDA’s rise').toBeGreaterThan(0.5)
    const ms = spineClock(1) * run.windowMs
    expect(
      slow.releasedAt === null || slow.releasedAt > ms,
      'the ligand leaves before this view’s window is even over',
    ).toBe(true)
  })

  it('A4/A5: sodium in REDDENS the head, and three receptors redden it more', () => {
    // ⚠ (user, 2026-09-13: "Na entering the cell should depolarize it, give red
    // tint".) Measured on absolute polarity the aura ran from −0.77 to −0.30 —
    // blue to slightly-less-blue — because a spine head's voltage never goes
    // positive. The tint reads the DEPARTURE FROM REST now, stretched over the
    // range this synapse can actually reach, and the millivolts stay in the
    // info block.
    const peak = (ampa: number, taps: number) => {
      const s = spineStart()
      let fired = 0
      let best = -1
      for (let t = 0; t < 6000; t += 16) {
        if (fired < taps && s.now >= fired * 220) {
          spineFire(s)
          fired++
        }
        s.ampa = ampa
        spineStep(s, 16)
        best = Math.max(best, spineCharge(s))
      }
      return best
    }
    // ⚠ NOW 0 → 1 ALONG A COLD-TO-HOT SPAN (21c-65), not a signed polarity: the
    // head is never neutral, so the app's ramp — whose whole subject is how far
    // from neutral a compartment is — spent this view's entire working range in
    // its grey middle. Same two inks, one stop skipped.
    expect(spineCharge(spineStart()), 'the head is not cold at rest').toBe(0)
    // ⚠ ONE MESSAGE MUST LAND ON THE WARM SIDE OF THE INK (21c-70, user: "the
    // postsynaptic spine is supposed to get red background … the moment sodium
    // ions enter the cell via AMPA channel. But this does not happen"). This
    // asked only for "more than 0.2", which the old shape met — at 0.381, where
    // the ink is `rgb(129, 160, 197)`, a pale BLUE. A reading below the ramp's
    // own cool/warm crossing cannot be described as reddening, so the crossing
    // is what it is asked against, not a number of this test's own.
    expect(peak(AMPA_AT_REST, 1), 'one message leaves the head on the COOL side')
      .toBeGreaterThan(SPAN_NEUTRAL)
    expect(peak(3, 8), 'a burst through three receptors never reaches red')
      .toBeGreaterThan(0.9)
    // ⚠ AND THE PAYOFF: the SAME single message is redder with three catchers
    // than with one. That is what "the signal looks stronger" has to mean.
    //
    // ⚠ ASKED OF THE COMPOSITE, NOT OF THE HUE. The size of the event is carried
    // by the wash's STRENGTH now, because the sky→red ink has not the range to
    // carry both readings at once — the proof is in `spineWash`. MEASURED, the
    // two land 20.0 apart on the ink the child sees; pinned under that.
    const inkAt = (ampa: number, taps: number) => {
      const s = spineStart()
      s.ampa = ampa
      let fired = 0
      let best = 0
      let bestS = s
      for (let t = 0; t < 9000; t += 16) {
        if (fired < taps && s.now >= fired * (TAP_REST_MS + 10)) { spineFire(s); fired++ }
        s.ampa = ampa
        spineStep(s, 16)
        if (spineReach(s) > best) {
          best = spineReach(s)
          bestS = { ...s, pulses: [...s.pulses], ions: [...s.ions], deliveries: [...s.deliveries] }
        }
      }
      return spineHeadInk(bestS)
    }
    const oneCatcher = inkAt(AMPA_AT_REST, 1)
    const threeCatchers = inkAt(3, 1)
    expect(
      inkApart(threeCatchers, oneCatcher),
      `one catcher paints ${oneCatcher.map(Math.round).join(',')} against three at ${threeCatchers.map(Math.round).join(',')}`,
    ).toBeGreaterThan(15)
    // …and three catchers are the WARMER of the two, not merely the different.
    expect(threeCatchers[0] - oneCatcher[0], 'three catchers are no redder, only other')
      .toBeGreaterThan(12)
    // …and the wash never fades out on the way: measured at alpha 0.000 on
    // every run before this, exactly as the cell passed through neutral.
    expect(spineWash(spineStart()), 'the head has no wash at rest').toBeGreaterThan(0.4)
    expect(Math.min(spineWash(spineStart()), spineWash({ ...spineStart(), ampa: 3 })))
      .toBeGreaterThan(0.4)
    // …and it is the DRAWING's number, not one this test invented.
    expect(SOURCES['./synapseScene.ts'], 'the aura does not read it')
      .toContain('? spineCharge(v.spine)')
  })
})

describe('S13 — the pink receptor LIGHTS when it conducts (21c-64)', () => {
  const g = synapseGeometry(SYN_W, SYN_H)

  it('A1: a glow at the NMDA while it is passing, and none while it is only bound', () => {
    // ⚠ MEASURED BY DIFFERENCE at the receptor's own place, between two spines
    // that differ ONLY in whether the throat is clear. Everything else in the
    // frame — the run, the clock, the seats — is identical, so what changes is
    // the glow.
    const seat = spineReceptorSeats(g, AMPA_AT_REST, spineDensityX()).slice(-1)[0]
    const lit = (sp: SpineState) => {
      const c = strictCanvas()
      drawSynapse(c.ctx, { run, cleft, u: 0.5, jiggle: 0, spine: sp, densityX: spineDensityX() })
      // ⚠ ITS SIZE, not a count. The glow grows with how much is going through,
      // so a barely-conducting receptor has one too — a count is 1 either way,
      // and the claim is about how much.
      const rs = c.arcs
        .filter((a) => a.r > MEM_PX * 2 && Math.hypot(a.x - seat.x, a.y - seat.y) < MEM_PX)
        .map((a) => a.r)
      return rs.length ? Math.max(...rs) : 0
    }
    // bound but blocked: one message at rest.
    // ⚠ THE WAIT IS THE RECEPTOR'S OWN RISE, not a typed 700 (which was that
    // rise at the old `TIME_FACTOR`). A fixture pinned to a constant it does not
    // name stops landing where it meant to the moment the pacing moves: at 140
    // this one sat half-way up NMDA's climb and the ligand check failed.
    const bound = (() => {
      const s = spineStart()
      spineFire(s)
      for (let t = 0; t < NMDA_RISE_MS; t += 8) spineStep(s, 8)
      return s
    })()
    expect(nmdaOpen(bound), 'the fixture has no ligand on the NMDA at all')
      .toBeGreaterThan(0.3)
    expect(nmdaLive(bound), 'the fixture is already conducting').toBeLessThan(0.12)

    // …and the same spine with the throat clear.
    const live: SpineState = { ...bound, plug: 0.05 }
    expect(nmdaLive(live), 'the fixture is not conducting').toBeGreaterThan(0.5)

    expect(lit(bound), 'a bound receptor has no mark at all').toBeGreaterThan(0)
    expect(
      lit(live),
      `conducting: ${lit(live).toFixed(0)}px of glow against ${lit(bound).toFixed(0)} merely bound`,
    ).toBeGreaterThan(lit(bound) * 1.8)
  })

  it('A1: the glow is UNDER the protein, never over it', () => {
    // The app's own rule: the protein stays the object and the glow stays an
    // event happening to it.
    const src = SOURCES['./synapseScene.ts']
    const glowAt = src.indexOf('const live = nmdaLive(sp)')
    const glyphAt = src.indexOf('open: Math.min(1, nmdaOpen(sp))')
    expect(glowAt, 'the conduction glow is not drawn at all').toBeGreaterThan(0)
    expect(glowAt, 'the glow is painted over the receptor').toBeLessThan(glyphAt)
  })
})

describe('S13 — the head is WASHED, evenly, in the colour it has earned (21c-66)', () => {
  const hotState = () => {
    const s = spineStart()
    s.ampa = 3
    let fired = 0
    let best = { c: -1, s: spineStart() }
    for (let t = 0; t < 9000; t += 16) {
      if (fired < 8 && s.now >= fired * 220) {
        spineFire(s)
        fired++
      }
      s.ampa = 3
      spineStep(s, 16)
      if (spineCharge(s) > best.c) best = { c: spineCharge(s), s: { ...s, ions: [...s.ions] } }
    }
    return best
  }

  const headFill = (sp: SpineState) => {
    const c = strictCanvas()
    drawSynapse(c.ctx, { run, cleft, u: 0.5, jiggle: 0, spine: sp, densityX: spineDensityX() })
    const want = chargeSpan(spineCharge(sp))
    return c.styles
      .filter((y) => y.startsWith(`rgba(${want},`))
      .map((y) => Number(y.match(/,\s*([\d.]+)\)$/)?.[1] ?? 0))
  }

  it('A1: the wash reaches the HEAD — it is not spent above the face', () => {
    // ⚠ (user, 2026-09-13: "bg of the dendritic does not get red at
    // depolarization".) The ink was right all along: `rgba(247, 113, 113, 0.42)`
    // was laid on every hot frame. WHERE was the bug — the gradient ran from
    // `auraTop` to the foot of the whole picture, and at this framing its
    // strongest stop fell at y = 409, ABOVE the head's face at 465, inside the
    // cleft the clip then throws away. What reached the head was the tail: 0.30
    // at the top and 0.09 at the bottom, fading out where the child is looking.
    const hot = hotState()
    expect(hot.c, 'the fixture never reddens').toBeGreaterThan(0.9)
    const laid = headFill(hot.s)
    expect(laid.length, 'the head is not washed at all').toBeGreaterThan(0)
    // ⚠ ONE STOP, AT FULL STRENGTH. A gradient lays several, and the ones that
    // land in the head are the weak ones — the break that restores it puts a
    // second stop at under half the first, which is exactly the fault.
    expect(laid.length, `the head is washed in ${laid.length} steps, so it fades`).toBe(1)
    expect(laid[0], `the head's red is only ${(laid[0] * 100).toFixed(0)}% opaque`)
      .toBeGreaterThan(0.45)
  })

  it('A1: …and it is cold at rest, hot at the top, with the same one stop', () => {
    const cold = headFill(spineStart())
    expect(cold.length, 'the head is not washed at rest').toBe(1)
    expect(cold[0], 'the head has no colour at rest at all').toBeGreaterThan(0.2)
    const hot = headFill(hotState().s)
    expect(hot[0], 'a red head is no more painted than a resting one')
      .toBeGreaterThan(cold[0] * 1.6)
  })
})

describe('S13 — the head warms WHEN the sodium lands (21c-67)', () => {
  const lag = spineNaLagMs(run, cleft, AMPA_AT_REST)
  const g = spineGeometry(AMPA_AT_REST)
  // ⚠ BELOW THE WALL, not the cast's `where` tag (21c-69). That tag turns over
  // only once an ion has finished SETTLING — measured, 15.3 model ms against a
  // crossing at 14.4 — and the child's question is when it got IN.
  const inside = (screenMs: number) =>
    sodiumCast(g, run, cleft, spineClock(screenMs / SPINE_SCREEN_MS) * run.windowMs, 0).filter(
      (d) => d.y > faceAt(g, d.x) + MEM_PX,
    ).length

  it('A1: the two clocks agree — the answer is not played before its cause', () => {
    // ⚠ (user, 2026-09-13: "bg is blue after Na ions pnentrated".) The model and
    // the picture were running on clocks nobody had put beside each other.
    // MEASURED before: the head's colour peaked 1.0s after the tap and was back
    // to zero by 8s, while the drawn sodium did not get inside until 10.9s — so
    // the effect played, and then its cause was drawn. This is the round trip's
    // own 2026-09-02 ruling ("the sodium didn't even penetrate the cell, but
    // the yellow aura is already there") arriving at the other view.
    expect(lag, 'the sodium is inside from the first frame — nothing to pace')
      .toBeGreaterThan(1000)
    expect(inside(lag - 500), 'sodium is already inside before the stated lag').toBe(0)
    expect(inside(lag + 60), 'no sodium is inside at the stated lag').toBeGreaterThan(0)
    // ⚠ AND THE ANCHOR IS WHERE THE CHILD READS IT (user, 2026-09-13: "redness
    // still is happening too late. Expected start: 15.1 ms"). Measured: the ion
    // is through the wall at 14.6 model ms and the cast does not tag it 'spine'
    // until 15.3, so the tag was putting the answer three quarters of a
    // millisecond late. The head now warms as the ion crosses.
    const asModelMs = spineClock(lag / SPINE_SCREEN_MS) * run.windowMs
    expect(asModelMs, `the head warms at ${asModelMs.toFixed(2)} model ms`).toBeLessThan(15.1)
    expect(asModelMs, 'the head warms before the sodium is anywhere near the wall')
      .toBeGreaterThan(13)

    const peakAt = (taps: number, gap: number, ampa: number) => {
      const s = spineStart()
      s.ampa = ampa
      let fired = 0
      let peak = -1
      let at = 0
      for (let t = 0; t <= 16000; t += 50) {
        if (fired < taps && t >= fired * gap) {
          spineFire(s, Math.max(0, lag - t))
          fired++
        }
        s.ampa = ampa
        spineStep(s, 50)
        if (spineCharge(s) > peak) {
          peak = spineCharge(s)
          at = t
        }
      }
      return { peak, at }
    }
    // one message: the head is at its warmest when the sodium is on the page.
    const one = peakAt(1, 0, AMPA_AT_REST)
    expect(Math.abs(one.at - lag), `the head peaks at ${one.at}ms, the sodium lands at ${lag.toFixed(0)}`)
      .toBeLessThan(1200)
    // ⚠ WITHIN A BEAT OF THE PEAK, not at the exact sample. The charge peaks the
    // instant the pulses start and the ion is crossing the wall over the next
    // few frames; a guard on one 50ms sample is measuring the sampling.
    expect(inside(one.at + 150), 'no sodium is drawn inside when the head is warmest')
      .toBeGreaterThan(0)
    // …and a burst, tapped at a hand's rate, peaks there too and reaches red.
    const many = peakAt(8, 400, 3)
    expect(many.peak, 'a burst does not redden the head').toBeGreaterThan(0.9)
    expect(Math.abs(many.at - lag), 'a burst peaks nowhere near the sodium')
      .toBeLessThan(1200)
    expect(inside(many.at + 150), 'no sodium is drawn inside at a burst’s peak')
      .toBeGreaterThan(0)
  })

  it('A2: the cell’s model is stepped by the RUN’s clock, so the scrubber moves it', () => {
    // ⚠ (user, 2026-09-13: "when I'm dragging the timeline, the background
    // change does not occur".) The receiving cell's model was stepped by wall
    // time whatever the transport was doing — so scrubbing moved the PICTURE
    // and left the voltage, the magnesium, the cascade and the ions running on
    // a clock of their own, and the head's colour, which is the one reading the
    // scrubber exists for, did not follow it at all.
    const src = STAGE['./NeuronStage.tsx']
    const step = src.slice(src.indexOf('if (spineRef.current.at) {'), src.indexOf('if (spineRef.current.at) {') + 2600)
    expect(step, 'the spine is not stepped at all').toBeTruthy()
    expect(step, 'the model is still stepped by wall time whatever the transport does')
      .not.toContain('spineStep(spineRef.current.state, Math.min(100, frame.timeDiff))')
    // ⚠ AND THE STORY'S CLOCK IS NOT THE SCREEN'S (21c-71): it has legs, so the
    // model's position is ASKED of the story rather than scaled from `u`.
    expect(step, 'the model does not read the run’s own position')
      .toContain('syn.u * story.ms')
    expect(step, 'the model is stepped in screen time, ignoring the story’s legs')
      .toContain('storyModelMs(story, to) - storyModelMs(story, from)')
    // ⚠ AND IT REWINDS NOW (21c-73). It used to HOLD, which was right while the
    // child's finger was the input — nothing can un-tap a message. The story
    // sends them, so the input is a SCHEDULE and a schedule replays exactly.
    expect(step, 'dragging backwards leaves the cell where it was')
      .toContain('if (target < sp.walkedTo)')
    expect(step, 'the model is stepped by the frame rate rather than the story')
      .toContain('sp.walkedTo + STORY_STEP_MS <= target')
  })

})

describe('S13 — the stone is DRAWN in the throat at rest (21c-68)', () => {
  it('A1: at rest the magnesium is below the mouth, not hanging above it', () => {
    // ⚠ GUARDED ON THE INK, because the model was never wrong. `spineStone`
    // says 1.0 at rest — fully seated — and the DRAWING multiplied it by how
    // open the gate is, so with no glutamate anywhere near it the stone was
    // painted at the top of its travel, out in the cleft. A break that restored
    // that multiplication moved no number any guard was asking about.
    const g = synapseGeometry(SYN_W, SYN_H)
    const seat = spineReceptorSeats(g, AMPA_AT_REST, spineDensityX()).slice(-1)[0]
    const mgY = (sp: SpineState) => {
      const c = strictCanvas()
      drawSynapse(c.ctx, { run, cleft, u: 0.5, jiggle: 0, spine: sp, densityX: spineDensityX() })
      const near = c.arcs.filter(
        (a) => Math.abs(a.x - seat.x) < 1 && a.r > MEM_PX * 0.8 && a.r < MEM_PX * 1.5,
      )
      expect(near.length, 'no magnesium is drawn at the NMDA at all').toBeGreaterThan(0)
      return Math.max(...near.map((a) => a.y))
    }
    // at rest: in the throat, below the membrane line.
    expect(
      mgY(spineStart()) - seat.y,
      'the magnesium hangs above the channel at rest — the pore reads as clear',
    ).toBeGreaterThan(0)

    // …and it really can be drawn high, or this measures nothing: a spine
    // whose throat has been pushed clear puts it at the top of its travel.
    // ⚠ ASKED OF THE DEPTH NOW (21c-74). It used to be asked of a committed
    // clear WINDOW, which is gone with the spells — the stone is where the
    // block says, lifted out of the way while something is going through.
    const clear: SpineState = { ...spineStart(), clear: 1 }
    expect(mgY(clear) - seat.y, 'the stone never leaves the throat at all — no travel to see')
      .toBeLessThan(0)
    // …and at the voltage a burst reaches it is visibly higher than at rest,
    // which is the reading the whole reversal was for.
    const warm: SpineState = { ...spineStart(), plug: 0.38 }
    expect(mgY(warm), 'the stone does not lift as the cell warms')
      .toBeLessThan(mgY(spineStart()))
  })
})

describe('the spine view actually RUNS', () => {
  it('A1 (21c-56): the picture moves as the run plays — it is not a still', () => {
    // ⚠ (user, 2026-09-13: "send message button click does not initiate any
    // process. The only thing I see is the movement of MG block".) The spine
    // view IS the round trip's drawing, and everything in that drawing which
    // moves — the bubble merging, the transmitter crossing, the receptors
    // opening, the ions — is clocked by the synapse RUN. Only the magnesium and
    // the aura come from the spine's own model, which is exactly what was still
    // moving. The run was never advanced at this framing.
    const spine = burst(1, 300)
    const sig = (u: number | null) => {
      const c = strictCanvas()
      drawSpine(c.ctx, { run, cleft, u, spine })
      return c.points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join('|')
    }
    const shots = [null, 0.15, 0.4, 0.7, 1].map(sig)
    expect(new Set(shots).size, 'the picture is the same at every point of the run')
      .toBe(shots.length)
  })
})

describe('every view of its own is actually WIRED to appear', () => {
  it('A1 (21c-56): …and the spine’s tap starts the run the drawing needs', () => {
    // ⚠ THE SAME CLASS OF FAULT AS 21c-47: everything drawable was guarded and
    // green, and the view did nothing, because the wiring that drives it was
    // missing. A drawing test cannot see a clock that never ticks.
    const src = STAGE['./NeuronStage.tsx']
    expect(src, 'the stage source did not load').toBeTruthy()
    // ⚠ THE STORY DRIVES BOTH MODELS NOW (21c-71) — the run that animates the
    // picture, and the receiving cell, from one cursor. The button only starts
    // the run; if it did not, the whole story would be a still.
    const plate = src.slice(src.indexOf('⚠ ▶ IS A TRANSPORT NOW'))
    expect(
      plate.slice(0, 1400),
      'the spine’s button never starts the run that animates it',
    ).toContain('st.fire()')
    // ⚠ AND THE CELL IS TOLD FROM THE STORY'S SCHEDULE, on the SCREEN cursor,
    // because a message's answer is due when its drawn sodium is on the page.
    expect(src, 'the story never sends its messages to the cell')
      .toContain('spineFire(sp.state, 0)')
    expect(src, 'the messages are not sent from the story’s own schedule')
      .toContain('story.messages[sp.sent].fireAt <= to')
    // …and the run is allowed to advance, and to survive, at this framing
    expect(src, 'the run never advances at the spine').toContain('syn.at || spineRef.current.at')
    expect(src, 'arriving at the spine resets the run out from under the drawing')
      .toContain('!atSynapse && !atSpine')
  })

  it('A1 (21c-47): each view’s fade is declared, DRIVEN, and consumed', () => {
    // ⚠ THE BUG THIS EXISTS FOR (user: "currently, 'the spine' is empty
    // canvas"). `spineFadeRef` was declared and read, and the one line that
    // raises it toward 1 was lost. The fade stayed at 0, the Shape returned
    // before drawing, and NOTHING FAILED — every drawing guard calls the scene
    // directly, so none of them exercises the wiring that asks it to paint.
    const src = STAGE['./NeuronStage.tsx']
    expect(src, 'the stage source did not load').toBeTruthy()
    for (const view of ['axon', 'passive', 'synapse', 'spine']) {
      expect(src, `${view}: no fade ref`).toContain(`${view}FadeRef = useRef(0)`)
      expect(src, `${view}: its fade is never driven — the view can never appear`)
        .toContain(`${view}FadeRef.current +=`)
      expect(src, `${view}: its fade is never turned into what is shown`)
        .toContain(`${view}ShownRef.current =`)
      expect(src, `${view}: its layer is never handed to the animation`)
        .toContain(`${view}LayerRef.current,`)
    }
  })

  it('A1 (21c-47): and the spine is SHOWN at its own magnification', () => {
    const target = ZOOM_TARGETS.find((t) => t.id === 'spine')
    expect(target, 'there is no spine target').toBeTruthy()
    expect(target!.scale).toBeCloseTo(SPINE_VIEW_SCALE, 9)
    expect(arrivalAt(target!.scale, SPINE_VIEW_SCALE), 'the view never fully arrives')
      .toBeCloseTo(1, 9)
    expect(target!.presents, 'it is not a view of its own').toBe('spine')
  })
})

describe('21c-70 — the head reddens when the sodium is in, and for long enough to see', () => {
  // A1: "postsynaptic spine is supposed to get red background inside the spine
  // as a symbol of depolarization. This should happen the moment sodium ions
  // enter the cell via AMPA channel. But this does not happen" (2026-09-13).
  //
  // Three faults, all measured, and none of them where the report pointed. The
  // tint DID fire, at the right moment. What failed was the ink it fired into,
  // how long it lasted, and — underneath both — that the spine's own clock was
  // never put beside the clock of the picture it is painted on.

  const lag = spineNaLagMs(run, cleft, AMPA_AT_REST)

  /** The head's reading through one message, on the run's own clock. */
  const walk = () => {
    const s = spineStart()
    spineFire(s, lag)
    const frames: { t: number; tint: number; ink: [number, number, number] }[] = []
    for (let t = 0; t <= SPINE_SCREEN_MS; t += 16) {
      spineStep(s, 16)
      frames.push({ t, tint: spineCharge(s), ink: spineHeadInk(s) })
    }
    return frames
  }

  it('A1: the spine model runs on the PICTURE’s clock, not one of its own', () => {
    // ⚠ THE FAULT UNDER THE OTHER TWO. This model's unit IS the screen
    // millisecond — `NeuronStage` steps it by `u × SPINE_SCREEN_MS` — so the
    // receptors have to be widened to the rate the drawing plays at, or the
    // cell answers before its own cause finishes arriving.
    const h = 20
    const rateAt = (screenMs: number) =>
      (2 * h) /
      ((spineClock((screenMs + h) / SPINE_SCREEN_MS) -
        spineClock((screenMs - h) / SPINE_SCREEN_MS)) *
        60)
    const pace = rateAt(lag)
    // MEASURED: 275 screen-ms per real-ms at the leg where the sodium lands. If
    // the legs are ever re-timed this is what notices.
    expect(pace, `the picture plays at ${pace.toFixed(0)} screen-ms per real-ms`)
      .toBeGreaterThan(240)
    expect(TIME_FACTOR, 'the model runs SLOWER than the picture it is painted on')
      .toBeLessThanOrEqual(pace)
    // ⚠ AND THIS IS WHY THE PICTURE'S FULL PACE CANNOT BE PAID. At 275 the
    // receptor would stay open 16 500 ms — longer than the run — so every tap
    // would overlap every other and "it is not how many, it is how close
    // together" would stop being true. The receptor must close inside the run.
    expect(NMDA_DECAY_MS, `NMDA stays open ${NMDA_DECAY_MS}ms of a ${SPINE_SCREEN_MS}ms run`)
      .toBeLessThan(SPINE_SCREEN_MS * 0.75)
  })

  it('A1: the head is COOL until the sodium is through the wall, then warm', () => {
    const frames = walk()
    const at = (ms: number) => frames.find((f) => f.t >= ms)!
    // Cause before effect: nothing has warmed while the sodium is still crossing.
    expect(at(lag - 400).tint, 'the head warmed before the sodium was inside')
      .toBeLessThan(SPAN_NEUTRAL)
    // …and it is unmistakably warm shortly after it lands.
    const warm = frames.find((f) => f.tint > SPAN_NEUTRAL)
    expect(warm, 'the head never reaches the warm side of the ink at all').toBeDefined()
    expect(warm!.t - lag, `the head warms ${(warm!.t - lag).toFixed(0)}ms after the sodium is in`)
      .toBeLessThan(600)
  })

  it('A1: …and it STAYS warm long enough to be read, then cools', () => {
    const frames = walk()
    const warm = frames.filter((f) => f.tint > SPAN_NEUTRAL)
    const hold = warm[warm.length - 1].t - warm[0].t
    // ⚠ MEASURED AS A SHARE OF THE RUN, not as a count of milliseconds — a leg
    // growing must not quietly loosen this.
    // MEASURED: warm for 1.66 s of a 15.2 s run, 11% of it.
    expect(hold / SPINE_SCREEN_MS, `the head is warm for ${(hold / 1000).toFixed(2)}s of the run`)
      .toBeGreaterThan(0.09)
    // …and the CHANGE is legible for longer than it is strictly warm, which is
    // what the child actually watches: the head leaves rest, holds, and returns.
    // MEASURED: 4.50 s, 30% of the run, against 1.26 s before this was fixed.
    const rest = spineHeadInk(spineStart())
    const changed = frames.filter((f) => inkApart(f.ink, rest) > 20)
    const seen = changed[changed.length - 1].t - changed[0].t
    expect(seen / SPINE_SCREEN_MS, `the head reads changed for ${(seen / 1000).toFixed(2)}s of the run`)
      .toBeGreaterThan(0.22)
    // …and it is an EVENT, not a new resting state: it cools again before the end.
    expect(frames[frames.length - 1].tint, 'the head never cools down again')
      .toBeLessThan(SPAN_NEUTRAL)
  })

  it('A1: one message paints WARM ink, not pale blue', () => {
    const frames = walk()
    const rest = spineHeadInk(spineStart())
    const hot = frames.reduce((a, b) => (b.tint > a.tint ? b : a))
    // ⚠ THE ACTUAL FAULT. The reading peaked at 0.381 of the ramp, where the ink
    // is `rgb(129, 160, 197)` — a pale BLUE, colder in red than the cytoplasm it
    // sat on. Asked where the child reads it: the composite, against rest.
    expect(hot.ink[0], `one message paints ${hot.ink.map(Math.round).join(',')}`)
      .toBeGreaterThan(rest[0] + 25)
    expect(hot.ink[2], 'the head got BLUER, not warmer').toBeLessThan(rest[2])
    expect(inkApart(hot.ink, rest), 'one message is indistinguishable from rest')
      .toBeGreaterThan(30)
  })

  it('A1: the ink is placed by SOLVING, not by a chosen exponent', () => {
    // The requirement, restated as arithmetic: one message lands exactly the
    // declared margin past the ink's own cool/warm crossing.
    expect(ONE_MESSAGE_REACH ** TINT_SHAPE, 'the shape does not solve its own requirement')
      .toBeCloseTo(SPAN_NEUTRAL + TINT_MARGIN, 9)
    // …and the measured constant it is solved from is still what one message does.
    const s = spineStart()
    spineFire(s)
    let best = 0
    for (let t = 0; t < 9000; t += 16) {
      spineStep(s, 16)
      best = Math.max(best, spineReach(s))
    }
    expect(best, `one message reaches ${best.toFixed(4)}, the constant says ${ONE_MESSAGE_REACH}`)
      .toBeCloseTo(ONE_MESSAGE_REACH, 2)
    expect(TINT_MARGIN, 'the margin has been tuned to nothing').toBeGreaterThan(0.05)
  })

  it('A1: the two channels are INDEPENDENT — hue says whether, alpha says how much', () => {
    // ⚠ `spineWash` used to be `0.5 + 0.5 × spineCharge`: one number painted
    // twice. Split, because the ink has not the range to carry both readings —
    // so the guard is that they no longer move together.
    const at = (ampa: number, taps: number) => {
      const s = spineStart()
      s.ampa = ampa
      let fired = 0
      let best = 0
      let bestS = s
      for (let t = 0; t < 9000; t += 16) {
        if (fired < taps && s.now >= fired * (TAP_REST_MS + 10)) { spineFire(s); fired++ }
        s.ampa = ampa
        spineStep(s, 16)
        if (spineReach(s) > best) {
          best = spineReach(s)
          bestS = { ...s, pulses: [...s.pulses], ions: [...s.ions], deliveries: [...s.deliveries] }
        }
      }
      return bestS
    }
    const one = at(AMPA_AT_REST, 1)
    const burst = at(3, 8)
    // The hue saturates early — that is the point of it, and why it cannot also
    // carry the size — while the strength keeps climbing well past it.
    const hueGain = spineCharge(burst) / spineCharge(one)
    const alphaGain = spineHeadAlpha(burst) / spineHeadAlpha(one)
    expect(hueGain, 'the hue has not saturated, so it is still carrying the size')
      .toBeLessThan(1.5)
    expect(alphaGain / hueGain, 'the strength merely redraws the hue')
      .toBeGreaterThan(1.15)
    // …and the wash is never painted at nothing, at rest or anywhere on the way.
    expect(spineWash(spineStart()), 'the head has no wash at rest').toBeGreaterThan(0.4)
  })

  it('A1: the drawing actually CONSUMES both channels', () => {
    // A drawing that is never called fails nothing: the aura must ask for the
    // hue AND for the strength, by name.
    expect(SOURCES['./synapseScene.ts'], 'the aura does not read the hue')
      .toContain('? spineCharge(v.spine)')
    expect(SOURCES['./synapseScene.ts'], 'the aura does not read the strength')
      .toContain('spineHeadAlpha(v.spine)')
  })
})

describe('21c-70 — the info block’s numbers come from the model', () => {
  it('A1: the twentieths the child is read are the ones mgBlock actually says', () => {
    // ⚠ THIS PROSE ROTTED TWICE. "About eleven times out of twenty" was measured
    // against a ceiling of −16.4 mV, and the pacing re-derivation moved the
    // ceiling to −9.3 while the sentence went on saying eleven. Then 21c-74
    // changed what the number MEANS — the stone spends the block on depth now,
    // not on time — so "times out of twenty" became a claim about a drawing
    // that no longer exists.
    const stone = SPINE_HONESTY.find((h) => h.text.includes('twentieths of the way down'))
    expect(stone, 'the stone’s honesty note has gone').toBeDefined()
    expect(stone!.text, 'the resting reading is not the one mgBlock gives')
      .toContain(`about ${seatedInTwenty(SPINE_REST_MV)} twentieths of the way down the throat`)
    expect(stone!.text, 'the ceiling reading is not the one mgBlock gives')
      .toContain(`lifting to about ${seatedInTwenty(SPINE_CEILING_MV)} twentieths at the reddest`)
    // …and the two readings are genuinely different, so the sentence has a point.
    expect(seatedInTwenty(SPINE_REST_MV)).not.toBe(seatedInTwenty(SPINE_CEILING_MV))
    expect(mgBlock(SPINE_REST_MV) - mgBlock(SPINE_CEILING_MV), 'the lift is not a lift')
      .toBeGreaterThan(0.3)
    // …and "never all the way out" is still true at the ceiling.
    expect(mgBlock(SPINE_CEILING_MV), 'the stone DOES come all the way out').toBeGreaterThan(0.25)
  })

  it('A1: the pacing note says the pace the model is actually run at', () => {
    const pace = SPINE_HONESTY.find((h) => h.text.includes('times slower'))
    expect(pace!.text).toContain(`about ${TIME_FACTOR} times slower`)
  })
})
