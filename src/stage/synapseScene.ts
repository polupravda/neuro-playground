import { STAGE_H, STAGE_W } from './layout'
import {
  BOUTON_BOX,
  BOUTON_FOOT,
  BOUTON_SEGS,
  NECK_PX,
  boutonFloorAt,
  boutonPath,
  fitBouton,
  place,
  type BoutonFit,
} from './boutonShape'
import { GLOSSY_COLORS, chargeWash, drawGlossyIon, polarityT } from './particleStyle'
import { SIGNAL_RGB, softGlow } from './signal'
import { drawLigandChannel } from './ligandChannel'

import { drawVoltageChannel } from './voltageChannel'
import {
  CLEFT_NM,
  SPINE_REST_MV,
  SPINE_TAU_MS,
  sampleCleft,
  type CleftRun,
} from '../core/cleft'
import {
  CAST_ALPHA,
  NA_APPROACH_MS,
  NA_CROSS_MS,
  NA_PAUSE_MS,
  NA_PER_RECEPTOR,
  NA_SETTLE_MS,
  bindPulses,
  calciumCast,
  receptorOpenFrac,
  receptorOpenWindow,
  receptorSeatWindow,
  sodiumCast,
  transmitterCast,
} from './synapseCast'
import { paveMembrane, type LipidGeom, type WallPoint } from './bilayer'
import { POOL, sampleSynapse, type SynapseRun } from '../core/synapse'
import { spoken, drawSpoken, drawName, named, type SpokenLabel } from './spokenLabels'

// S12 LEG 1 — THE SYNAPSE, ARRIVAL TO BINDING.
//
// The drawing spec, with its reconciliation of the user's bouton handover, is
// in docs/05-visual-language.md → *Spec: S12*. Two things from it matter most
// while reading this file:
//
//   • THE WHOLE BOUTON IS ON THE PAGE (user's ruling, 2026-08-31), stalk and
//     all, rather than the cleft close-up this document used to specify. The
//     terminal is a real object with a real boundary; the axon above it and the
//     dendrite below it are what leave the frame.
//   • ⚠ NO LIPID MOLECULES HERE. At this magnification the bouton is ~1 µm
//     drawn ~440 px, so the membrane is 5 nm ≈ 2 px and a phospholipid head is
//     a third of a pixel. Drawing molecules would be drawing something nobody
//     could resolve — the app's own "level of detail dissolves" rule pointing
//     the other way for once. The membrane is a two-leaflet BAND here; the
//     molecules belong in D06, where one vesicle fills the frame.
//
// Every moving thing reads a model value. `core/synapse.ts` owns the terminal
// (the arriving spike, the calcium gate, the calcium the sensor sees, which
// vesicles went) and `core/cleft.ts` owns the gap (transmitter, bound, open).
// Nothing in here decides anything.

/** ⚠ HOW LONG THE RUN TAKES ON SCREEN (user, 2026-09-01: "slow down the
 *  animation"). Declared in the info block beside the real 60 ms, the same way
 *  every other clock in this app declares itself. */
// 15 s → 20 s (user, 2026-09-01: "increase general time duration") — the
// postsynaptic chain earned a leg of its own and the clearing still needs a
// watchable tail. → 22 s (same day, "give users time to reflect"): the chain
// grew glow-off → departure → close beats, and they must not be paid for by
// compressing everything else.
export const SYNAPSE_SCREEN_MS = 22000

/** ⚠ HOW LONG THE FINISHED RUN STAYS ON SCREEN before putting itself back to
 *  rest (user, 2026-09-01: "remove reset button — after the animation is
 *  over, the state should be reset to new"). With the auto-reset the transport
 *  can no longer strand at an end, so the start-over control the pacing rule
 *  demands is the fire button itself, which the reset hands back. The hold
 *  exists because clearing at the very instant the run ends would wipe the
 *  last thing it teaches off the screen. */
export const SYNAPSE_END_HOLD_MS = 2200

/** ⚠ THE RUN'S CLOCK FOLLOWS THE INTEREST, NOT THE MODEL'S EVEN TIME.
 *
 *  This is why "no neurotransmitters are visibly released" (user, 2026-09-01)
 *  was true and the model was right anyway. MEASURED: transmitter is in the gap
 *  for 0.87 ms of a 60 ms window — 4.6% of the run, from u = 0.045 to u = 0.090.
 *  On a linear clock that is a blink however long the whole thing takes, and
 *  making the whole thing slower makes the empty 91% slower too.
 *
 *  So the window is split into legs and the payload gets most of the screen.
 *  ⚠ SLOW THE LEG, NEVER THE ITEM: inside a leg nothing changes pace, so no
 *  vesicle ever moves at a speed the model did not give it.
 *
 *  `from`/`to` are positions in the MODEL's run; `share` is the fraction of
 *  screen time that stretch is given. */
/** ⚠ THE CHAIN HAS BEATS (user, 2026-09-01: "a visually logical clear chain
 *  of what happens after what — a small pause between events"). The real
 *  events overlap on sub-millisecond couplings — THAT is the physics and the
 *  model keeps it — but the clock can hold its breath between them: a "beat"
 *  is a leg whose model span is a fraction of a millisecond given real screen
 *  time, so the picture stands still after each cause and before its effect.
 *  Slow the leg, never the item — a beat is the limit case of that rule.
 *
 *  The event windows are read off the seeded run (fusions at 2.59–2.75 ms,
 *  cloud 2.6–5.9 ms, EPSP peak 7.3 ms); if the model's times drift, the beats
 *  drift off their marks, and the cloud-share guard below is what notices. */
export const CLOCK_LEGS: { from: number; to: number; share: number; what: string }[] = [
  { from: 0, to: 0.4 / 60, share: 0.025, what: 'at rest' },
  // ⚠ A FLASH IS FAST (user, 2026-09-01): the spike's leg was 13% and the
  // arrival crawled; the freed screen time went to the beat after it, so the
  // jolt is quick and the red it leaves behind is what gets dwelt on.
  {
    from: 0.4 / 60,
    to: 1.6 / 60,
    share: 0.05,
    what: 'the spike arrives — the terminal goes red',
  },
  {
    from: 1.6 / 60,
    to: 1.75 / 60,
    share: 0.06,
    what: 'a beat: depolarized, doors about to answer',
  },
  {
    from: 1.75 / 60,
    to: 2.45 / 60,
    share: 0.13,
    what: 'the doors open; calcium finds the sensors',
  },
  {
    from: 2.45 / 60,
    to: 2.56 / 60,
    share: 0.045,
    what: 'a beat: calcium seated, nothing moved yet',
  },
  {
    from: 2.56 / 60,
    to: 2.9 / 60,
    share: 0.12,
    what: 'exocytosis — three vesicles open',
  },
  { from: 2.9 / 60, to: 3.0 / 60, share: 0.035, what: 'a beat: the gap is full' },
  {
    from: 3.0 / 60,
    to: 5.5 / 60,
    share: 0.14,
    what: 'the gap: spreading, escaping, binding',
  },
  { from: 5.5 / 60, to: 9 / 60, share: 0.12, what: 'the spine answers' },
  // ⚠ THE CHAIN'S OWN LEG (user, 2026-09-01: "at 9.6 ms Na rushes; at ~10 the
  // animation speeds up"): opens, pauses, sodium and the flash used to fall
  // off the cliff into the compressed tail. Now they have the screen.
  // Stretched 18 → 24.5 (user, 2026-09-01: "give users time to reflect", then
  // "glow disappears, NTs fly away, channel closes") so the reflection
  // pauses, the nudge's launch (~17.7 ms), the glow-offs, the departures and
  // the doors' closings (up to ~24 ms) ALL play at this leg's ~0.28 s/ms
  // instead of falling off the boundary into the compressed tail.
  {
    from: 9 / 60,
    to: 24.5 / 60,
    share: 0.194,
    what: 'gates open, sodium flows, the nudge departs',
  },
  {
    from: 24.5 / 60,
    to: 1,
    share: 0.081,
    what: 'clearing up: calcium buffered, the bath settles',
  },
]

/** Screen position 0→1 → the model's own position 0→1. The last leg absorbs
 *  the shares' floating-point dust, so u = 1 maps to exactly 1 however many
 *  legs the table grows. */
export function synapseClock(screenU: number): number {
  let at = Math.max(0, Math.min(1, screenU))
  if (at >= 1 - 1e-12) return CLOCK_LEGS[CLOCK_LEGS.length - 1].to
  for (const [i, leg] of CLOCK_LEGS.entries()) {
    if (at <= leg.share || i === CLOCK_LEGS.length - 1) {
      const t = Math.min(1, at / Math.max(1e-9, leg.share))
      return leg.from + (leg.to - leg.from) * t
    }
    at -= leg.share
  }
  return 1
}

/** Screen position 0→1 ← model position 0→1: the inverse of `synapseClock`,
 *  for placing the timeline tool's event dots on the transport's own bar.
 *  Every leg has a real model span and a real share, so the map inverts
 *  cleanly; clamped at both ends. */
export function screenOfModel(modelU: number): number {
  const m = Math.max(0, Math.min(1, modelU))
  let acc = 0
  for (const leg of CLOCK_LEGS) {
    if (m <= leg.to) {
      const t = Math.max(
        0,
        Math.min(1, (m - leg.from) / Math.max(1e-9, leg.to - leg.from)),
      )
      return Math.max(0, Math.min(1, acc + t * leg.share))
    }
    acc += leg.share
  }
  return 1
}

/** The run's main events for the timeline tool (user, 2026-09-01), in MODEL
 *  ms. Everything the model can date is READ OFF the run — fusion, binding,
 *  opening, the departing nudge — so a dot cannot drift off the moment the
 *  picture shows; only the stage-setting anchors (arrival, the doors,
 *  clearing) sit on the clock legs' own boundaries. A weak run simply drops
 *  the events that never happen, rather than offering dots that lead nowhere. */
export function synapseEvents(
  run: SynapseRun,
  cleft: CleftRun,
): { id: string; label: string; ms: number; note: string }[] {
  const g = synapseGeometry()
  const sites = receptorSites(g)
  let fusion: number | null = null
  for (const v of run.vesicles)
    if (v.fusedAtMs !== null && (fusion === null || v.fusedAtMs < fusion))
      fusion = v.fusedAtMs
  let seated: number | null = null
  let opens: number | null = null
  for (let r = 0; r < sites.length; r++) {
    const sw = receptorSeatWindow(g, run, cleft, r)
    if (sw && sw.seatedAt !== null && (seated === null || sw.seatedAt < seated))
      seated = sw.seatedAt
    const ow = receptorOpenWindow(g, run, cleft, r)
    if (ow && (opens === null || ow.openAt < opens)) opens = ow.openAt
  }
  const all: ({ id: string; label: string; ms: number; note: string } | null)[] = [
    {
      id: 'spike',
      label: 'the spike',
      ms: 0.4,
      note: 'The action potential arrives — the terminal goes red',
    },
    {
      id: 'calcium',
      label: 'calcium in',
      ms: 1.75,
      note: 'The voltage-gated doors open and calcium finds the sensors',
    },
    fusion === null
      ? null
      : {
          id: 'fusion',
          label: 'fusion',
          ms: fusion,
          note: 'The first vesicle opens into the gap',
        },
    seated === null
      ? null
      : {
          id: 'binding',
          label: 'binding',
          ms: seated,
          note: 'Transmitter seats on the first receptor',
        },
    opens === null
      ? null
      : {
          id: 'opens',
          label: 'gates open',
          ms: opens,
          note: 'The first ligand-gated channel opens; sodium flows',
        },
    // ⚠ OBVIOUS EVENTS ONLY (user, 2026-09-01: "what is 'the nudge'? Nothing
    // significant seems to be happening"): the departing EPSP is drawn below
    // the bottom edge on purpose, so its dot pointed at almost nothing. The
    // ion flow is the visible event — the first gold pair crossing its pore.
    opens === null
      ? null
      : {
          id: 'sodium-in',
          label: 'sodium in',
          ms: opens + NA_PAUSE_MS,
          note: 'The first pair of sodium ions flows through its channel',
        },
    {
      id: 'clearing',
      label: 'clearing',
      ms: 24.5,
      note: 'Calcium is buffered away and the bath settles',
    },
  ]
  return all.filter(
    (e): e is { id: string; label: string; ms: number; note: string } => e !== null,
  )
}

export const SYN_W = STAGE_W
export const SYN_H = STAGE_H

/** ⚠ THE ACTIVE ZONE, as a share of the bulb's own half-width (user,
 *  2026-08-31: "make the active area larger, 2x larger"). It was a share of the
 *  CANVAS — `max(40, width * 0.085)` — which is why it stayed the same size
 *  however much room the bouton got. Tied to the bulb, it grows with it. */
const ACTIVE_OF_BULB = 0.72

/** ⚠ WHERE THE BOUTON'S FOOT SITS IN THE FRAME (user, 2026-09-01: "push the
 *  whole image down so that presynaptic bouton occupies two thirds of the
 *  vertical space and the postsynaptic specialization one third"). */
const BOUTON_SHARE = 2 / 3

/** How tall the postsynaptic face is, out of the third below the foot. The
 *  shaft takes the rest and runs off the bottom edge, which it really does.
 *  Deepened 0.5 → 0.6 in the redraw of 2026-09-01: at 0.5 the head was a slab
 *  four and a half times wider than tall. */
const FACE_OF_BELOW = 0.6

/** How far the postsynaptic face reaches past the active zone before rounding
 *  off. A postsynaptic density is a little wider than the zone it faces —
 *  narrowed 0.34 → 0.22 in the same redraw, for the same reason. */
const FACE_OVER = 0.22

/** ⚠ THE SPINE'S NECK. A neck is a neck, not a pedestal. */
const SPINE_NECK = 0.4

/** ⚠ THE CLEFT IS EXAGGERATED, and the info block says so beside the real 20 nm
 *  (`CLEFT_NM`). Drawn true at this zoom it would be 2 px, and what crosses it
 *  is the subject of the exhibit. */
// Widened 26 → 34 (user, 2026-09-01): the calcium channels' tethered ball
// hung into the postsynaptic membrane. Still declared beside the real 20 nm.
export const CLEFT_PX = 34

/** The membrane's drawn thickness. One number for every membrane in this
 *  picture — presynaptic, spine and shaft are the same material. */
export const MEM_PX = 5

/** The bath. ⚠ OPAQUE, deliberately: it used to be a translucent wash over the
 *  page, which meant "the same colour as the extracellular space" was a thing
 *  you could only check by eye, because what you saw was a blend of two layers.
 *  One flat ink makes it a fact instead. */
export const OUTSIDE = '#11192b'

/** ⚠ THE VESICLE'S LUMEN IS THE BATH — not a colour chosen to match it, THE
 *  SAME CONSTANT (user, 2026-08-31: "inner color same as extracellular
 *  space"). A vesicle's lumen is topologically outside the cell, which is the
 *  whole reason exocytosis works: nothing is carried through a wall, a pocket
 *  of outside that was folded in is unfolded again. Two constants that happened
 *  to agree would be two things that could stop agreeing. */
export const LUMEN = OUTSIDE
export const CYTOPLASM = 'rgba(148, 163, 184, 0.10)'
const LEAFLET = '#cbd5e1'
const CORE = 'rgba(71, 85, 105, 0.75)'
const INK = 'rgba(148, 163, 184, 0.85)'
/** ⚠ THE TRANSMITTER'S OWN INK — one ink wherever the stuff is: in the bubble,
 *  in the gap, on a receptor. The same stuff came out of the same bag; two
 *  colours would say otherwise.
 *
 *  TEAL, which no ion wears (Na⁺ gold, K⁺ violet, Cl⁻ green, Ca²⁺ pink) — and
 *  SHADED, not ion-glossy: lighter centre, darker rim, no highlight sparkle
 *  and no glow halo, because "a single glossy ball IS what this app means by
 *  'ion', whatever colour it is painted" (ruling of 2026-08-30, gating bench).
 *  The dots are too small for the bench's bonded-atoms treatment, so the
 *  difference of kind is carried by the missing gloss grammar instead.
 *  Replaces flat white (user, 2026-09-01: "other color than white, add
 *  gradient"). */
export const TRANSMITTER_INK = { light: '#99f6e4', mid: '#2dd4bf', dark: '#0f766e' }

/** The SNARE rope's three strand colours — synaptobrevin, syntaxin, SNAP-25.
 *  Owned ONCE: D06's big rope, its pre-docking stubs and the snareMini on the
 *  docked vesicles all read these, so the same protein can never wear two
 *  colours at two magnifications. */
export const SNARE_STRANDS = ['#f0abfc', '#7dd3fc', '#bef264'] as const
const TRANSMITTER_R = 3.2

/** Every transmitter particle on this canvas goes through here — cargo in the
 *  bubbles and cloud in the gap — so they cannot drift apart. */
export function transmitterDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): void {
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r)
  grad.addColorStop(0, TRANSMITTER_INK.light)
  grad.addColorStop(0.55, TRANSMITTER_INK.mid)
  grad.addColorStop(1, TRANSMITTER_INK.dark)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

export interface SynapseGeometry {
  fit: BoutonFit
  /** The lowest point of the bouton's membrane. */
  foot: { x: number; y: number }
  /** The postsynaptic face. ⚠ NOT AN ELLIPSE ANY MORE: its top FOLLOWS the
   *  bouton's own floor, one cleft below, so the two membranes are apposed the
   *  way two real ones are and the gap is the same width all the way across.
   *  `rx` is its half-width, `ry` how far it drops before the neck. */
  head: { cx: number; rx: number; ry: number }
  /** Where the shaft's own surface is drawn from. */
  shaftTop: number
  /** Half-width of the active zone, px — the patch of the bouton's foot where
   *  vesicles dock and the calcium doors sit. */
  activeHalf: number
}

/** ⚠ THE PRESYNAPTIC WALL AT THIS x — the bouton's own outline, never a line
 *  through its lowest point.
 *
 *  The bug this exists for (user, 2026-09-01: "the opening vesicles are placed
 *  outside of the presynaptic bouton"): the active zone was a straight row at
 *  the foot's height, and the foot of a bouton is a curve. Measured, the outer
 *  vesicles sat 47 and 88 px BELOW the wall — outside the cell, in the cleft.
 *
 *  Everything that lives on the wall reads this: docked vesicles, the calcium
 *  doors, the cleft's ceiling, the tear. */
export function wallAt(g: SynapseGeometry, x: number): number {
  return boutonFloorAt(g.fit, x) ?? g.foot.y
}

/** The postsynaptic membrane at this x: one cleft below the presynaptic one
 *  across the active zone, then rounding away to the neck outside it.
 *
 *  ⚠ BEYOND THE ZONE THE FACE LETS GO OF THE BOUTON (user, 2026-09-01: "the
 *  postsynaptic specialization looks very nonsymmetrical and completely weird
 *  shape"). It used to keep tracking `wallAt(x) + drop` past the zone's edge —
 *  and past the edge the bouton curves steeply UP, so the shoulders rose into
 *  humps before falling, a different hump each side. Apposition is a fact
 *  about the synapse — the ACTIVE zone — not about the whole neighbourhood:
 *  outside it each shoulder drops from its own edge's height on one shared
 *  quarter-ellipse, so the two sides are congruent by construction. */
export function faceAt(g: SynapseGeometry, x: number): number {
  const off = Math.abs(x - g.head.cx)
  if (off <= g.activeHalf) return wallAt(g, x) + CLEFT_PX
  const edgeX = g.head.cx + Math.sign(x - g.head.cx) * g.activeHalf
  const base = wallAt(g, edgeX) + CLEFT_PX
  const over = Math.max(1e-6, g.head.rx - g.activeHalf)
  const t = Math.min(1, (off - g.activeHalf) / over)
  return base + g.head.ry * (1 - Math.sqrt(Math.max(0, 1 - t * t)))
}

/** ⚠ ONE geometry for the drawing AND the hit tests AND the tests. */
export function synapseGeometry(width = SYN_W, height = SYN_H): SynapseGeometry {
  // ⚠ SOLVED so the FOOT lands two thirds down. The bouton's own height above
  // the foot is `NECK_PX + BULB_BOX.h·k`, so the scale is whatever makes that
  // reach the two-thirds line — the picture is pushed down by growing into the
  // room rather than by being nudged with an offset.
  const fit = fitBouton(width, height, {
    fixed: height * (1 - BOUTON_SHARE),
    perUnit: 0,
  })
  const foot = place(fit, BOUTON_FOOT.x, BOUTON_FOOT.y)
  const below = height - foot.y
  const bulbHalf = (BOUTON_BOX.w / 2) * fit.k
  const activeHalf = bulbHalf * ACTIVE_OF_BULB
  const ry = Math.max(24, (below * FACE_OF_BELOW - CLEFT_PX) / (1 + SPINE_NECK))
  const head = { cx: foot.x, rx: activeHalf * (1 + FACE_OVER), ry }
  return {
    fit,
    foot,
    head,
    shaftTop: foot.y + CLEFT_PX + ry * (1 + SPINE_NECK),
    activeHalf,
  }
}

/** Where the docked vesicles and the calcium doors sit along the active zone,
 *  interleaved — ⚠ the reference figure had no calcium channels at all, and a
 *  vesicle fusing beside none of them was step 19b's error. Deterministic, and
 *  independent of how many have gone. */
const ZONE_CACHE = new WeakMap<
  SynapseGeometry,
  {
    docked: { x: number; y: number; index: number; r: number }[]
    doors: { x: number; y: number }[]
  }
>()

export function activeZone(g: SynapseGeometry): {
  docked: { x: number; y: number; index: number; r: number }[]
  doors: { x: number; y: number }[]
} {
  // ⚠ MEMOISED PER GEOMETRY (2026-09-01): the cast asks for the zone on every
  // ball of every frame, and each answer costs five bisections against the
  // traced outline. Pure in `g`, so the cache cannot go stale.
  const hit = ZONE_CACHE.get(g)
  if (hit) return hit
  const docked: { x: number; y: number; index: number; r: number }[] = []
  const doors: { x: number; y: number }[] = []
  const slots = POOL as number
  for (let i = 0; i < slots; i++) {
    // POOL slots across the zone, with a door in each gap between them.
    const t = slots === 1 ? 0.5 : i / (slots - 1)
    const x = g.foot.x + (t - 0.5) * 2 * g.activeHalf
    // ⚠ ON THE WALL AT ITS OWN x, not on a line through the foot (user,
    // 2026-09-01: "the opening vesicles are placed outside of the presynaptic
    // bouton"). Measured before the fix: the outer two sat 47 and 88 px below
    // the membrane — in the cleft, outside the cell. And clear of the CURVE,
    // not just of the point below — see `dockedY`.
    const r = vesicleR(g) * vesicleScale(i)
    docked.push({ x, y: dockedY(g, x, r), index: i, r })
    if (i < slots - 1) {
      const tm = (i + 0.5) / (slots - 1)
      const dx = g.foot.x + (tm - 0.5) * 2 * g.activeHalf
      doors.push({ x: dx, y: wallAt(g, dx) })
    }
  }
  const zone = { docked, doors }
  ZONE_CACHE.set(g, zone)
  return zone
}

/** ⚠ THE VESICLE, SIZED OFF THE BOUTON and exaggerated by a declared factor.
 *
 *  Real: a vesicle is ~40 nm across against the terminal's ~1 µm — four per
 *  cent of it, so a true one here would be about 8 px across. Drawn at
 *  `VESICLE_EXAGGERATION` times that, because five of them docking, fusing and
 *  tearing the wall open is the subject of the picture and eight pixels cannot
 *  carry it. Said beside the real number in the info block.
 *
 *  It was a fixed 11 px, which meant that making the active zone twice as wide
 *  made the vesicles on it look half the size. */
const VESICLE_EXAGGERATION = 2.2

export function vesicleR(g: SynapseGeometry): number {
  return BOUTON_BOX.w * g.fit.k * 0.02 * VESICLE_EXAGGERATION
}

/** ⚠ EACH VESICLE ITS OWN SIZE (user, 2026-09-01: "make vesicles different
 *  size, more realistic") — and the spread is the REAL one: synaptic vesicles
 *  are famously uniform, about ±10% in diameter, so the seeded factor stays
 *  inside that. A bigger spread would be less realistic, not more. */
export function vesicleScale(i: number): number {
  const h = Math.sin(i * 57.3 + 4.1) * 43758.5453
  return 0.9 + (h - Math.floor(h)) * 0.2
}

/** The reserve pool, seeded and count-independent: adding one must not make the
 *  others walk. Placed inside the bulb, above the active zone. */
export function reservePool(g: SynapseGeometry, n = 9): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  const r = vesicleR(g)
  for (let i = 0; i < n; i++) {
    const h = Math.sin(i * 91.7 + 3.1) * 43758.5453
    const j = h - Math.floor(h)
    const h2 = Math.sin(i * 47.3 + 11.9) * 24634.6345
    const j2 = h2 - Math.floor(h2)
    const row = Math.floor(i / 3)
    const col = i % 3
    const x = g.foot.x + (col - 1) * g.activeHalf * 0.6 + (j - 0.5) * g.activeHalf * 0.34
    out.push({
      // Above the WALL at their own x — the pool hung off the foot's height
      // too, so its outer columns floated outside the bouton in the same way.
      x,
      y: wallAt(g, x) - r * 3.4 - row * r * 2.6 + (j2 - 0.5) * r,
    })
  }
  return out
}

/** ⚠ A VESICLE IS A CIRCLE WHOSE INSIDE IS THE OUTSIDE (user, 2026-08-31:
 *  "visualize vesicles as circles, with inner color same as extracellular
 *  space").
 *
 *  This reverses a ruling of 2026-08-27 ("clean hollow-circle vesicles →
 *  overridden: a vesicle is a bilayer ring, the material is the point"), and the
 *  user asked to try it. It is worth recording WHY it is not a step backwards:
 *
 *  **A vesicle's lumen is topologically outside the cell.** That is the whole
 *  reason exocytosis works — nothing is carried through a wall, a pocket of
 *  outside that was folded into the cell is simply unfolded again. Painting the
 *  lumen in the bath's own colour says that, and it makes the tear read
 *  correctly: when the two membranes open, the lumen does not BECOME continuous
 *  with the outside, it turns out it always was.
 *
 *  And what the old rule protected — "the material is the point, two bilayers
 *  can join and become one" — is now carried by the outline VANISHING where the
 *  two walls meet (`skipBand`), which says *same material* more directly than a
 *  ring did. The molecular ring is still what D06 draws, where it is
 *  resolvable. */
/** One closed subpath following `wallY` across [from, to], `pad` px either
 *  side of it — the strip of picture the wall's ink occupies THERE, on the
 *  outline's own curve. Shared by the tear punch and the vesicle's
 *  outline-skip, so the two can never disagree about where the wall is. */
function wallStrip(
  ctx: CanvasRenderingContext2D,
  from: number,
  to: number,
  wallY: (x: number) => number,
  pad: number,
): void {
  const steps = 14
  ctx.moveTo(from, wallY(from) - pad)
  for (let i = 1; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps
    ctx.lineTo(x, wallY(x) - pad)
  }
  for (let i = steps; i >= 0; i--) {
    const x = from + ((to - from) * i) / steps
    ctx.lineTo(x, wallY(x) + pad)
  }
  ctx.closePath()
}

function vesicle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha = 1,
  /** The stretch of MEMBRANE the outline must not be drawn on — following the
   *  wall's own curve, never a horizontal band (user, 2026-09-01: "the cut on
   *  the vesicles does not repeat the curve of the presynaptic bouton"). */
  skip?: { from: number; to: number; wallY: (x: number) => number; pad: number },
): void {
  ctx.save()
  ctx.globalAlpha *= alpha
  // The lumen: the bath's own colour, because that is what it is.
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = LUMEN
  ctx.fill()

  if (skip) {
    // ⚠ THE OUTLINE STOPS WHERE THE WALLS MEET (user: "its area that overlaps
    // with the membrane while moving, loses outline"). Clipped rather than
    // erased: this view shares a Konva layer, and a shape that wipes pixels
    // erases its neighbours rather than tidying up after itself. Even-odd:
    // everything EXCEPT the wall's own strip.
    ctx.beginPath()
    ctx.rect(0, 0, SYN_W * 2, SYN_H * 2)
    wallStrip(ctx, skip.from, skip.to, skip.wallY, skip.pad)
    ctx.clip('evenodd')
  }
  // ⚠ THE WALL'S OWN TWO STROKES, not a plain line (user, 2026-09-01: "make
  // vesicles outline look the same as membrane"). A vesicle is the same two
  // leaflets curved round on themselves — the whole reason it can fuse — so it
  // wears the same band: leaflet ink with the oily core through it.
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.strokeStyle = LEAFLET
  ctx.lineWidth = MEM_PX
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.strokeStyle = CORE
  ctx.lineWidth = MEM_PX * 0.42
  ctx.stroke()
  ctx.restore()
}

/** ⚠ THE OMEGA FIGURE — a fused vesicle drawn as part of the wall it joined.
 *
 *  The arc runs from the RIGHT foot over the top to the LEFT foot, and both
 *  feet are points ON the bouton's traced outline (`pocketAt`) — the same two
 *  points the tear in the membrane stops at. So the wall's ink runs into the
 *  pocket's ink without a joint, which is the picture's claim: two membranes
 *  that have become ONE membrane, with a pocket in it.
 *
 *  The lumen is closed along the wall's own curve and overshot a hair below
 *  it, so through the open mouth it is continuous with the bath — which it
 *  topologically is, and always was. */
function drawPocket(
  ctx: CanvasRenderingContext2D,
  g: SynapseGeometry,
  s: FusedShape,
  p: { xL: number; yL: number; xR: number; yR: number },
): void {
  const aL = Math.atan2(p.yL - s.cy, p.xL - s.x)
  const aR = Math.atan2(p.yR - s.cy, p.xR - s.x)
  ctx.save()
  // The lumen: the pocket's inside is the bath's own ink, because that is
  // what it is.
  ctx.beginPath()
  // Anticlockwise from the right foot passes over the TOP of the circle —
  // the pocket is the part of the bubble still standing proud of the wall.
  ctx.arc(s.x, s.cy, s.r, aR, aL, true)
  const steps = 12
  for (let i = 0; i <= steps; i++) {
    const x = p.xL + ((p.xR - p.xL) * i) / steps
    ctx.lineTo(x, wallAt(g, x) + MEM_PX)
  }
  ctx.closePath()
  ctx.fillStyle = LUMEN
  ctx.fill()
  // The membrane: the ARC ONLY — never a full circle, and in BOTH of the
  // wall's own strokes, because after fusion this is not a vesicle near a
  // wall, it IS the wall.
  ctx.beginPath()
  ctx.arc(s.x, s.cy, s.r, aR, aL, true)
  ctx.strokeStyle = LEAFLET
  ctx.lineWidth = MEM_PX
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(s.x, s.cy, s.r, aR, aL, true)
  ctx.strokeStyle = CORE
  ctx.lineWidth = MEM_PX * 0.42
  ctx.stroke()
  ctx.restore()
}

/** ⚠ WHAT IS IN THE BUBBLE (user, 2026-09-01: "neurotransmitters are not
 *  visible inside the vesicles"). A vesicle drawn empty is a bag of nothing,
 *  and what it is carrying is the whole point of the object — the same
 *  particles that turn up in the gap a moment later, in the same ink, so a
 *  child can see that what came out is what was in.
 *
 *  Seeded and count-independent, and a named decision so a test can reach it. */
export function cargoIn(
  cx: number,
  cy: number,
  r: number,
  n = 7,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    const h = Math.sin(i * 61.9 + 2.7) * 43758.5453
    const j = h - Math.floor(h)
    const h2 = Math.sin(i * 29.3 + 7.1) * 24634.6345
    const j2 = h2 - Math.floor(h2)
    const a = j * Math.PI * 2
    // √ so they fill the disc evenly rather than crowding the middle, and kept
    // clear of the wall so none of them straddles it.
    const rr = Math.sqrt(j2) * Math.max(0, r - MEM_PX * 1.6)
    out.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr })
  }
  return out
}

function drawCargo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  alpha = 1,
): void {
  if (alpha <= 0.02) return
  ctx.save()
  ctx.globalAlpha *= alpha
  for (const p of cargoIn(cx, cy, r)) {
    transmitterDot(ctx, p.x, p.y, TRANSMITTER_R)
  }
  ctx.restore()
}

// ─────────────────────────────────────────────── THE FUSION, AS A SCHEDULE
//
// ⚠ THE DRAWING'S OWN NUMBERS, declared as such. The model says WHEN each
// vesicle went and puts its whole dose in the gap AT that instant
// (`core/cleft.ts`: "each vesicle's dose arrives all at once"); how the
// membrane looks doing it is below the model's time step. The one ordering
// constraint is the model's, though, and it is why these replaced a single
// `FUSE_MS = 9` (user, 2026-09-01: the vesicles went on "slowly merging" long
// after the transmitter had come and gone): THE MOUTH MUST BE OPEN NO LATER
// THAN THE CLOUD IT EXPLAINS. Cause on screen before effect.

/** Model ms for the vesicle to sink onto the wall and the mouth to open. */
export const PORE_OPEN_MS = 1.1
/** Model ms over which the cargo drains out — roughly the transmitter's own
 *  stay in the gap, so the bubble empties while the cloud is there. */
export const CARGO_DRAIN_MS = 2.6
/** When the open pocket starts flattening into the wall, model ms after
 *  fusion — the instant the cargo has drained, so the pocket flows STRAIGHT
 *  from emptying into merging (user, 2026-09-02: "vesicle fusion pauses in
 *  the middle, at 5.2 ms" — the old schedule froze the shape between the
 *  drain's end and a flatten that began 3.4 ms later). */
export const FLATTEN_FROM_MS = CARGO_DRAIN_MS
/** And how long the flattening takes. Chosen so the LAST fusing vesicle
 *  (≈2.78 ms) is one smooth wall again before the first transmitter seats
 *  (≈6.5 ms) — fuse → release → bind reads as a strict sequence (user,
 *  2026-09-02: "finish fuse before neurotransmitter binding"). ⚠ Declared
 *  drawing exaggeration: real full-collapse takes tens of ms; the model's
 *  dose timing is untouched. */
export const FLATTEN_MS = 1.0

/** How high the open pocket's centre sits above the wall, as a share of its
 *  radius. 0 would be a half-dome; 0.4 sinks well past halfway-visible with a
 *  mouth about 0.92 r wide — deepened from 0.55 (user, 2026-09-01: "the
 *  vesicle in the middle does not move") so the sink is a MOTION, not a
 *  nudge. */
const OPEN_DEPTH = 0.4

export interface FusedShape {
  /** The slot's x — the circle's centre never walks sideways. */
  x: number
  /** Where the circle's centre is now. It sinks THROUGH the wall: above it
   *  while docked, `OPEN_DEPTH·r` above while open, a full radius below once
   *  flattened — at which point nothing of it is left to draw. */
  cy: number
  r: number
  /** How much cargo is still inside, 0→1. */
  cargo: number
}

/** ⚠ WHERE A DOCKED VESICLE'S CENTRE SITS: high enough that the WHOLE circle
 *  clears the outline by a membrane's thickness — not just the point directly
 *  below it. On the sloped parts of the foot a centre placed `r + MEM_PX`
 *  above the wall at its own x still crossed the outline SIDEWAYS — found the
 *  day the omega rework made the traced curve the reference: a "tear" of
 *  10 px existed at the very instant of fusion, because the docked circle was
 *  already through the wall. Solved against the curve by bisection, like
 *  everything else that lives on it. */
const DOCK_CACHE = new WeakMap<SynapseGeometry, Map<number, number>>()

export function dockedY(g: SynapseGeometry, x: number, r: number): number {
  let byX = DOCK_CACHE.get(g)
  if (!byX) {
    byX = new Map()
    DOCK_CACHE.set(g, byX)
  }
  const key = x + r * 1e5
  const cached = byX.get(key)
  if (cached !== undefined) return cached
  // ⚠ HELD JUST OFF THE WALL (user, 2026-09-01: touching "even slightly
  // overlapping" was the question, and the answer is the PRIMED state: the
  // half-zippered SNAREs hold a docked vesicle a few nanometres off the
  // membrane — which is also what lets the rope's pull be SEEN). A small
  // drawn gap, spanned by the rope.
  const clear = r + MEM_PX * 1.6
  const minDist = (cy: number): number => {
    let best = Infinity
    const span = r * 1.6
    for (let i = 0; i <= 24; i++) {
      const px = x - span + (2 * span * i) / 24
      const d = Math.hypot(px - x, wallAt(g, px) - cy)
      if (d < best) best = d
    }
    return best
  }
  let lo = wallAt(g, x) - clear
  if (minDist(lo) >= clear - 1e-6) {
    byX.set(key, lo)
    return lo
  }
  let hi = lo - r * 2
  for (let k = 0; k < 26; k++) {
    const mid = (lo + hi) / 2
    if (minDist(mid) >= clear) hi = mid
    else lo = mid
  }
  byX.set(key, hi)
  return hi
}

/** ⚠ THE FUSED VESICLE'S SHAPE AT THIS AGE — a named decision so a test can
 *  walk the whole schedule. Null once it has flattened into the wall entirely:
 *  from then on there is nothing to draw and no tear, because the bubble IS
 *  the wall now, which is what "the bubble becomes part of the wall" means. */
export function fusedShape(
  g: SynapseGeometry,
  x: number,
  ageMs: number,
  r0 = vesicleR(g),
): FusedShape | null {
  const flat = (ageMs - FLATTEN_FROM_MS) / FLATTEN_MS
  if (flat >= 1) return null
  const wall = wallAt(g, x)
  // √-eased: the model's dose is in the gap AT the fusion instant, so the
  // mouth must be open by the first drawn moment after it — a leisurely
  // linear slide kept the wall intact while the cloud was already out.
  const open = Math.sqrt(Math.max(0, Math.min(1, ageMs / PORE_OPEN_MS)))
  const f = Math.max(0, flat)
  const r = r0 * (1 + 0.25 * open + 0.25 * f)
  const cyDock = dockedY(g, x, r0)
  const cyOpen = wall - OPEN_DEPTH * r
  const cy = f > 0 ? cyOpen + (wall + r - cyOpen) * f : cyDock + (cyOpen - cyDock) * open
  return { x, cy, r, cargo: Math.max(0, 1 - ageMs / CARGO_DRAIN_MS) }
}

/** ⚠ WHERE THE FUSED CIRCLE CROSSES THE BOUTON'S OWN WALL — the two feet of
 *  the omega, each ON the outline (user, 2026-09-01: "the cut on the vesicles
 *  does not repeat the curve of the presynaptic bouton"). The old drawing cut
 *  the outline along a HORIZONTAL band, so on the curved parts of the foot the
 *  cut and the membrane disagreed and the merge looked unrelated.
 *
 *  Found on the traced outline itself — bracketed by scan, tightened by
 *  bisection — never solved against a flat line. Null while the circle does
 *  not reach the wall (still sinking, or gone). */
export function pocketAt(
  g: SynapseGeometry,
  cx: number,
  cy: number,
  r: number,
): { xL: number; yL: number; xR: number; yR: number } | null {
  const inside = (x: number): boolean => {
    const dx = x - cx
    const dy = wallAt(g, x) - cy
    return dx * dx + dy * dy < r * r
  }
  const N = 48
  const at = (i: number) => cx - r + (2 * r * i) / N
  let iIn = -1
  for (let i = 0; i <= N; i++) {
    if (inside(at(i))) {
      iIn = i
      break
    }
  }
  if (iIn < 0) return null
  let jIn = iIn
  for (let j = N; j >= iIn; j--) {
    if (inside(at(j))) {
      jIn = j
      break
    }
  }
  const refine = (out: number, inn: number): number => {
    let a = out
    let b = inn
    for (let k = 0; k < 28; k++) {
      const mid = (a + b) / 2
      if (inside(mid)) b = mid
      else a = mid
    }
    return (a + b) / 2
  }
  const xL = iIn === 0 ? at(0) : refine(at(iIn - 1), at(iIn))
  const xR = jIn === N ? at(N) : refine(at(jIn + 1), at(jIn))
  return { xL, yL: wallAt(g, xL), xR, yR: wallAt(g, xR) }
}

/** The strip in which a docked vesicle's outline is NOT drawn — the thickness
 *  of the wall it is touching.
 *
 *  ⚠ "Its area that overlaps with the membrane while moving, loses outline"
 *  (user, 2026-08-31). A named decision so a test can reach it, and so the
 *  drawing and any hit test can never disagree about where the two walls have
 *  become one. */
export function mergeBand(
  g: SynapseGeometry,
  x: number,
): { top: number; bottom: number } {
  const y = wallAt(g, x)
  return { top: y - MEM_PX * 1.6, bottom: y + MEM_PX * 1.6 }
}

/** Where the terminal's wall is torn open, and how wide, at this moment.
 *
 *  ⚠ A NAMED DECISION so a test can reach it. "Exocytosis should visually TEAR
 *  the membrane" (user, 2026-08-31) — and a tear is a real gap in a real wall,
 *  not a vesicle drawn on top of an intact line. */
export interface Tear {
  /** The slot the tear belongs to — the vesicle's own x. */
  x: number
  y: number
  /** Half the mouth's width. */
  half: number
  /** ⚠ The mouth's own ends, ON the outline — where the wall's ink stops and
   *  the pocket's arc takes over. The punch in the membrane uses these, so the
   *  torn edge and the arc's feet CANNOT disagree. */
  xL: number
  xR: number
}

export function tearsAt(g: SynapseGeometry, run: SynapseRun, ms: number): Tear[] {
  const out: Tear[] = []
  for (const d of activeZone(g).docked) {
    const gone = run.vesicles[d.index]?.fusedAtMs
    if (gone === null || gone === undefined || ms < gone) continue
    const shape = fusedShape(g, d.x, ms - gone, d.r)
    // ⚠ FLATTENED: the wall is one line again, so there is NO tear any more —
    // a terminal whose wall stayed torn for the rest of the run was the old
    // picture's other lie.
    if (!shape) continue
    const pocket = pocketAt(g, d.x, shape.cy, shape.r)
    // Fused this instant, circle not through the wall yet: a tear of width 0 —
    // nothing at the instant of fusion.
    if (!pocket) {
      out.push({ x: d.x, y: wallAt(g, d.x), half: 0, xL: d.x, xR: d.x })
      continue
    }
    out.push({
      x: d.x,
      y: wallAt(g, d.x),
      half: (pocket.xR - pocket.xL) / 2,
      xL: pocket.xL,
      xR: pocket.xR,
    })
  }
  return out
}

/** A wall, drawn as two leaflets with the oily middle between them — the
 *  membrane at a magnification where molecules are not resolvable.
 *
 *  `tears` are places where there is no wall any more. Clipped OUT rather than
 *  painted over: this view shares a Konva layer, so a shape that erases pixels
 *  erases its neighbours. */
export function membraneBand(
  ctx: CanvasRenderingContext2D,
  trace: () => void,
  tears?: Tear[],
  /** The wall's own height at an x — so a tear's punch FOLLOWS the curve it is
   *  torn in, edge to edge, rather than being a level rectangle near it. */
  wallY?: (x: number) => number,
): void {
  ctx.save()
  if (tears && tears.some((t) => t.xR > t.xL)) {
    // ⚠ THE CONTEXT'S OWN PATH, not a `Path2D`. `Path2D` does not exist in
    // every environment this drawing has to run in — the tests caught it on the
    // first run — and `beginPath` + `clip('evenodd')` is the same thing
    // everywhere. A hole is the outer rectangle with the tears punched out of
    // it, which is what the even-odd rule is for.
    ctx.beginPath()
    ctx.rect(0, 0, SYN_W * 2, SYN_H * 2)
    for (const t of tears) {
      if (t.xR <= t.xL) continue
      // ⚠ The hole runs from one foot of the pocket's arc to the other, along
      // the wall's own curve — so the torn ends of the wall are exactly where
      // the arc lands, and the two read as one continuous ink.
      wallStrip(ctx, t.xL, t.xR, wallY ?? (() => t.y), MEM_PX * 2.5)
    }
    ctx.clip('evenodd')
  }
  trace()
  ctx.strokeStyle = LEAFLET
  ctx.lineWidth = MEM_PX
  ctx.lineJoin = 'round'
  ctx.stroke()
  trace()
  ctx.strokeStyle = CORE
  ctx.lineWidth = MEM_PX * 0.42
  ctx.stroke()
  ctx.restore()
}

/** The spine: a neck out of the shaft and a mushroom head facing the terminal.
 *  ⚠ This is the alteration to the handover — see `boutonShape` for why a
 *  glutamate synapse must land on a spine. */
export function spinePath(
  ctx: CanvasRenderingContext2D,
  g: SynapseGeometry,
  _width: number,
  /** Closed for fills and clips; OPEN for the membrane's stroke — stroking
   *  the closed path inked its closing edge (user, 2026-09-01). */
  closed = true,
  height = SYN_H,
): void {
  // ⚠ THE SHAPE IS THE WIDE VIEW'S SHAPE, CLOSER (user, 2026-09-01: "the
  // shape is wrong in comparison to the area in the big-neuron view"). Out
  // there, our bouton synapses onto the TIP of the target's dendrite branch,
  // which runs down toward the target's soma — so here the postsynaptic side
  // is that same object magnified: spine head at the cleft, a narrow neck,
  // and the dendrite WIDENING DOWNWARD out of the frame toward the soma. The
  // horizontal cross-frame shaft the wide view never showed is gone — and
  // with it, everything the bottom-of-canvas saga was about.
  const { head } = g
  const root = g.shaftTop
  // ⚠ THE FACE IS TRACED FROM `faceAt`, so the membrane the receptors sit in is
  // literally the membrane the cleft is measured to. It used to be an ellipse
  // near the bouton's lowest point, which is how the apposition came apart.
  const left = head.cx - head.rx
  const right = head.cx + head.rx
  const steps = 60
  ctx.beginPath()
  // ⚠ A NECK, NOT A PEDESTAL. Narrow against the head it carries — which is
  // what a real spine neck is, and why a spine is a compartment of its own.
  const neck = head.rx * 0.2
  // ⚠ SMOOTH FLANKS, NOT DIAGONALS (user, 2026-09-01: "the postsynaptic
  // specialization looks misshaped and has angles"). The sides used to be a
  // straight line from the neck to a point below the face's end and a vertical
  // hop up to it — two corners per side. Each flank is now one cubic: it
  // leaves the neck VERTICALLY (first control point straight above the start)
  // and arrives at the face's end VERTICALLY (second control point straight
  // below it), which is also the face curve's own tangent there — so neck,
  // flank and face meet without a corner anywhere. A membrane is a liquid.
  const bulge = head.ry * 0.6
  const yL = faceAt(g, left)
  const yR = faceAt(g, right)
  const trunkHalf = head.rx * 0.55
  const bottom = height + 40
  // Up the left wall: from the trunk's off-canvas base, narrowing into the
  // neck, then flaring into the head — every joint a smooth cubic.
  ctx.moveTo(head.cx - trunkHalf, bottom)
  ctx.bezierCurveTo(
    head.cx - neck * 1.05,
    bottom - (bottom - root) * 0.55,
    head.cx - neck,
    root + (bottom - root) * 0.25,
    head.cx - neck,
    root,
  )
  ctx.bezierCurveTo(head.cx - neck, yL + bulge, left, yL + bulge, left, yL)
  for (let i = 0; i <= steps; i++) {
    const x = left + ((right - left) * i) / steps
    ctx.lineTo(x, faceAt(g, x))
  }
  ctx.bezierCurveTo(right, yR + bulge, head.cx + neck, yR + bulge, head.cx + neck, root)
  // And down the right wall, widening away toward the soma.
  ctx.bezierCurveTo(
    head.cx + neck,
    root + (bottom - root) * 0.25,
    head.cx + neck * 1.05,
    bottom - (bottom - root) * 0.55,
    head.cx + trunkHalf,
    bottom,
  )
  if (closed) ctx.closePath()
}

/** Where the receptors sit on the spine head, facing the cleft. Spacing
 *  jittered — evenly ruled receptors are a diagram, not a membrane. */
export function receptorSites(g: SynapseGeometry, n = 5): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  // ⚠ ACROSS THE ACTIVE ZONE, not across the whole face: a postsynaptic density
  // sits opposite the release site, which is what makes a synapse a synapse
  // rather than two membranes that happen to be near each other.
  const spread = g.activeHalf * 0.82
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1)
    const h = Math.sin(i * 73.3 + 5.7) * 43758.5453
    const j = h - Math.floor(h)
    const x = g.head.cx + (t - 0.5) * 2 * spread + (j - 0.5) * spread * 0.18
    // ON the face's own curve, so they sit IN the membrane rather than on a
    // line drawn near it.
    out.push({ x, y: faceAt(g, x) })
  }
  return out
}

// The magnifier doors are GONE (user, 2026-09-01): the way into D06 is the
// bottom-left shelf button and the way between the two framings is the
// top-right scale switch — the AP views' own chrome patterns, HTML over the
// stage (see NeuronStage).

/** ⚠ EACH NAME TIED TO ITS PART (user, 2026-09-04: "labels on whole synapse
 *  framing are misplaced — add connector lines between labels and objects
 *  they define"): D06's callout grammar, brought to the scene. Every label
 *  sits in measured open bath and points at the thing it names. */
export function synapseCallouts(
  g: SynapseGeometry,
): { label: SpokenLabel; to: { x: number; y: number } }[] {
  const fin = astrocyteFinger(g, 1)
  const d0 = activeZone(g).docked[0]
  const edgeX = g.foot.x + g.activeHalf
  const gapMid = wallAt(g, edgeX) + CLEFT_PX * 0.5
  return [
    {
      // Far enough left that the whole box clears the bulb's flank (its old
      // spot put a corner ON the bouton — the misplacement complaint).
      label: spoken(
        'vesicle',
        g.foot.x - g.activeHalf - 235,
        g.foot.y - vesicleR(g) * 5.2,
      ),
      to: { x: d0.x - d0.r * 0.7, y: d0.y - d0.r * 0.5 },
    },
    {
      // ⚠ BOTTOM-RIGHT, not bottom-left (user, 2026-09-04: "bottom left label
      // is covered by buttons container") — the shelf plate owns that corner.
      // Measured clear of the right finger and above the cleft label's box,
      // pointing at the face's right flank.
      label: spoken(
        'dendritic spine',
        g.head.cx + g.head.rx + 15,
        faceAt(g, g.head.cx) + 115,
        'left',
      ),
      to: {
        x: g.head.cx + g.head.rx * 0.55,
        y: faceAt(g, g.head.cx + g.head.rx * 0.55) + 10,
      },
    },
    {
      // Moved off the spine's shoulder (it sat ON the postsynaptic face) to
      // the open bath below the right finger, pointing into the gap's mouth.
      label: spoken('synaptic cleft', edgeX + 160, g.foot.y + CLEFT_PX + 155, 'left'),
      to: { x: edgeX - 20, y: gapMid },
    },
    {
      // Above the right finger's tip, in the measured-empty bath beyond the
      // bulb's flank.
      label: spoken('astrocyte', fin.tip.x + 46, fin.tip.y - 44, 'left'),
      to: { x: fin.tip.x + 8, y: fin.tip.y - 8 },
    },
  ]
}

export function synapseLabels(g: SynapseGeometry): SpokenLabel[] {
  return synapseCallouts(g).map((c) => c.label)
}

// ── the astrocyte's fingers (21b-1) ─────────────────────────────────────────
//
// ⚠ THE THIRD CELL (user, 2026-09-04: reuptake at three registers — this is
// register one, "who and where"). A glial finger at EACH flank of the cleft,
// at the scene's own band register: the bath pocket the escaped transmitter
// already rested in IS the finger's interior now, entered through transporter
// ticks — the cloud's decay, attributed. The active-zone framing simply crops
// the fingers away (same scene, closer camera), which is the agreed close-up
// treatment: the drain shows, the cell lives at the rim, off that frame.

export interface AstroFinger {
  side: 1 | -1
  tip: { x: number; y: number }
  base: { x: number; y: number }
  rTip: number
  rBase: number
  /** The transporter ticks on the tip's synapse-facing cap — the only doors
   *  the collected balls may cross the glial membrane at. */
  ticks: { x: number; y: number }[]
}

export function astrocyteFinger(g: SynapseGeometry, side: 1 | -1): AstroFinger {
  // ⚠ AT THE CLEFT'S MOUTH, not beside the spine's head (user, 2026-09-04:
  // the fingers sat level with the spine's shoulders and read as a second
  // postsynaptic specialization — "place it slightly further away or more
  // towards synaptic cleft"). The tip now hovers at the GAP's own height,
  // reaching for the mouth it drains, clear of both neurons' silhouettes.
  const edgeX = g.foot.x + side * g.activeHalf
  const tipY = wallAt(g, edgeX) + CLEFT_PX * 0.5
  const tip = { x: g.foot.x + side * (g.activeHalf + 105), y: tipY }
  // The body runs outward and gently down, off the page — the cell continues
  // beyond the frame and is faded out toward it, never cut by an invented
  // edge.
  const base = { x: g.foot.x + side * (g.activeHalf + 330), y: tipY + 95 }
  const rTip = 36
  const rBase = 78
  const ticks = [
    { x: tip.x - side * rTip * 0.95, y: tip.y - rTip * 0.2 },
    { x: tip.x - side * rTip * 0.8, y: tip.y + rTip * 0.48 },
  ]
  return { side, tip, base, rTip, rBase, ticks }
}

/** Whether a point lies inside the finger — the DECISION the collected balls
 *  are guarded by (a capsule test on the finger's own centreline). */
export function astrocyteHolds(f: AstroFinger, p: { x: number; y: number }): boolean {
  const dx = f.base.x - f.tip.x
  const dy = f.base.y - f.tip.y
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((p.x - f.tip.x) * dx + (p.y - f.tip.y) * dy) / len2))
  const cx = f.tip.x + dx * t
  const cy = f.tip.y + dy * t
  const r = f.rTip + (f.rBase - f.rTip) * t
  return Math.hypot(p.x - cx, p.y - cy) <= r
}

/** A resting spot INSIDE the finger, seeded per ball — solved from the
 *  capsule itself, so it cannot land outside it. */
export function astroRest(
  f: AstroFinger,
  h1: number,
  h2: number,
): { x: number; y: number } {
  const t = 0.12 + h1 * 0.55
  const cx = f.tip.x + (f.base.x - f.tip.x) * t
  const cy = f.tip.y + (f.base.y - f.tip.y) * t
  const r = (f.rTip + (f.rBase - f.rTip) * t) * 0.6
  const a = h2 * Math.PI * 2
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
}

// The glial cytoplasm's tint (134,184,158 — the neurons' wash, greened a
// step) and its membrane band (the wall's own LEAFLET/CORE families) are all
// carried inside the fade gradients below, so the third cell reads as a cell
// and vanishes toward the frame edge without an invented boundary.
/** ⚠ THE THIRD CELL'S FINGER, drawn ONCE for the whole app (exported
 *  2026-09-04 for D17). The reuptake drawer shows the SAME synapse this view
 *  shows, so it asks this function for the fingers rather than drawing a
 *  second set — one biology, one drawing. If they ever diverge, a child would
 *  meet two different astrocytes at one synapse. */
export function drawAstroFinger(
  ctx: CanvasRenderingContext2D,
  g: SynapseGeometry,
  side: 1 | -1,
): void {
  const f = astrocyteFinger(g, side)
  const th = Math.atan2(f.base.y - f.tip.y, f.base.x - f.tip.x)
  const n = { x: -Math.sin(th), y: Math.cos(th) }
  const capsule = () => {
    ctx.beginPath()
    ctx.arc(f.tip.x, f.tip.y, f.rTip, th + Math.PI / 2, th - Math.PI / 2)
    ctx.lineTo(f.base.x - n.x * f.rBase, f.base.y - n.y * f.rBase)
    ctx.arc(f.base.x, f.base.y, f.rBase, th - Math.PI / 2, th + Math.PI / 2)
    ctx.closePath()
  }
  // The cell fades toward the frame's edge: the gradient carries the fade so
  // no invented boundary is ever drawn (globalAlpha stays multiplied-only).
  const fadeStops = (rgb: string, near: number, far: number) => {
    const grad = ctx.createLinearGradient(f.tip.x, f.tip.y, f.base.x, f.base.y)
    grad.addColorStop(0, `rgba(${rgb}, ${near})`)
    grad.addColorStop(0.55, `rgba(${rgb}, ${near})`)
    grad.addColorStop(1, `rgba(${rgb}, ${far})`)
    return grad
  }
  ctx.save()
  capsule()
  ctx.fillStyle = fadeStops('134, 184, 158', 0.1, 0)
  ctx.fill()
  capsule()
  ctx.strokeStyle = fadeStops('203, 213, 225', 0.9, 0)
  ctx.lineWidth = MEM_PX
  ctx.stroke()
  capsule()
  ctx.strokeStyle = fadeStops('71, 85, 105', 0.75, 0)
  ctx.lineWidth = MEM_PX * 0.42
  ctx.stroke()
  // The transporter ticks: the pump family's indigo (D06's own transporter
  // colour, at this register a tick rather than a barrel), each set across
  // the membrane at its point.
  for (const t of f.ticks) {
    const a = Math.atan2(t.y - f.tip.y, t.x - f.tip.x)
    ctx.save()
    ctx.translate(t.x, t.y)
    ctx.rotate(a)
    ctx.fillStyle = '#6366f1'
    ctx.beginPath()
    ctx.roundRect(-MEM_PX * 1.3, -2.6, MEM_PX * 2.6, 5.2, 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
}

/** ⚠ WHERE THE 'active zone' CAPTION SITS (user, 2026-09-01: "adjust labels
 *  places"). It used to hang centred over the docked row — and when docking
 *  became touching-contact the text landed ON the vesicles. It now sits just
 *  OUTSIDE the zone's right end, hugging the membrane it names, left-aligned
 *  in a stack with 'synaptic cleft' below the wall. A named decision so a
 *  test can hold it clear of every bubble. */
export function activeZoneLabelAt(g: SynapseGeometry): { x: number; y: number } {
  const edgeX = g.foot.x + g.activeHalf
  return { x: edgeX + 26, y: wallAt(g, edgeX) - 14 }
}

/** ⚠ THE MACHINERY IS ON THE PICTURE (user, 2026-09-01: "we need to display
 *  the SNARE complex — without it, Ca ions bind to nothing"). Each docked
 *  vesicle carries a miniature of D06's own cast: the three-strand rope
 *  between its base and the wall, and a synaptotagmin knob on each side —
 *  placed exactly where the calcium cast's ions come to rest, so what they
 *  bind to is DRAWN. It disassembles with fusion: a fused vesicle's rope has
 *  done its work and become part of the merged wall. */
export function snareMini(
  g: SynapseGeometry,
  d: { x: number; y: number; r: number },
): {
  ropes: { from: { x: number; y: number }; to: { x: number; y: number } }[]
  knobs: { x: number; y: number }[]
} {
  const wall = wallAt(g, d.x)
  // Each knob sits on the wall AT ITS OWN x — on the sloped outer slots a
  // knob hung off the slot-centre's height crossed the membrane.
  const knobAt = (x: number) => ({ x, y: wallAt(g, x) - MEM_PX - d.r * 0.28 })
  // ⚠ TWO ropes since 2026-09-04 (user: "add another snare complex to each
  // vesicle, to stay consistent between presentations") — the mirrored pair,
  // a section through the ring, matching D06 at every register.
  const rope = (sd: 1 | -1) => ({
    from: { x: d.x + sd * d.r * 0.4, y: wall - MEM_PX * 0.6 },
    to: { x: d.x + sd * d.r * 0.32, y: d.y + d.r * 0.82 },
  })
  return {
    ropes: [rope(1), rope(-1)],
    knobs: [knobAt(d.x - d.r * 1.05), knobAt(d.x + d.r * 1.05)],
  }
}

function drawSnareMini(
  ctx: CanvasRenderingContext2D,
  g: SynapseGeometry,
  d: { x: number; y: number; r: number },
): void {
  const m = snareMini(g, d)
  // The ropes: the same three strands, in D06's own strand colours.
  const strands = SNARE_STRANDS
  ctx.save()
  ctx.lineWidth = 1.4
  ctx.lineCap = 'round'
  for (const rope of m.ropes) {
    const dx = rope.to.x - rope.from.x
    const dy = rope.to.y - rope.from.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    for (const [i, colour] of strands.entries()) {
      ctx.strokeStyle = colour
      ctx.beginPath()
      const phase = (i / strands.length) * Math.PI * 2
      for (let k = 0; k <= 10; k++) {
        const t = k / 10
        const off = Math.sin(t * Math.PI * 4.4 + phase) * 1.8
        const x = rope.from.x + dx * t + nx * off
        const y = rope.from.y + dy * t + ny * off
        if (k === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }
  // Synaptotagmin: the knobs the calcium seats against — D06's sensor grammar.
  for (const knob of m.knobs) {
    ctx.beginPath()
    ctx.arc(knob.x, knob.y, 2.6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
    ctx.fill()
    ctx.strokeStyle = GLOSSY_COLORS.ca.dark
    ctx.lineWidth = 1.2
    ctx.stroke()
  }
  ctx.restore()
}

/** ⚠ THE MEMBRANE RESOLVES INTO ITS MOLECULES AT THE ZONE'S DEPTH (user,
 *  2026-09-01: "make the bilayer look like made out of phospholipids"). At
 *  the synapse's own magnification a lipid head is a third of a pixel and the
 *  band is the honest drawing; four times closer, the heads are drawn — by
 *  the app's ONE membrane paver — dissolving in exactly as the chrome
 *  dissolves out. Tears are skipped: a torn wall has no molecules left there
 *  to show. */
export function membraneLipids(g: SynapseGeometry, tears: Tear[]): WallPoint[] {
  const pts: WallPoint[] = []
  const span = g.activeHalf * 1.25
  const step = ZONE_LIPID.headR * 2 * 1.25
  const doors = activeZone(g).doors
  const sites = receptorSites(g)
  for (let x = g.foot.x - span; x <= g.foot.x + span; x += step) {
    // ⚠ No molecule under a protein (user, 2026-09-01: "they should not
    // overlap with channels") — a channel REPLACES the lipids it displaced.
    const underDoor = doors.some((d) => Math.abs(x - d.x) < 9)
    const underSite = sites.some((r) => Math.abs(x - r.x) < 10)
    if (!underDoor && !tears.some((t) => x > t.xL - 3 && x < t.xR + 3)) {
      pts.push({
        at: { x, y: wallAt(g, x) },
        tangent: { x: 1, y: 0 },
        inward: { x: 0, y: -1 },
      })
    }
    if (!underSite && Math.abs(x - g.head.cx) <= g.head.rx * 0.98) {
      pts.push({
        at: { x, y: faceAt(g, x) },
        tangent: { x: 1, y: 0 },
        inward: { x: 0, y: 1 },
      })
    }
  }
  return pts
}

/** ⚠ A VESICLE IS THE SAME TWO LEAFLETS CURVED ROUND (user, 2026-09-01:
 *  "vesicles should be made out of phospholipids as well") — at the zone's
 *  depth its outline resolves into a ring of the same molecules, paved by the
 *  same paver. */
export function vesicleLipids(
  cx: number,
  cy: number,
  r: number,
  /** Keep only the arc between these angles (anticlockwise over the top) —
   *  the FUSING vesicle's standing omega keeps its molecules too (user,
   *  2026-09-01: "display phospholipids also during the fusing animation");
   *  the submerged rest have become wall. */
  arc?: { aR: number; aL: number },
): WallPoint[] {
  const n = Math.max(10, Math.round((2 * Math.PI * r) / (ZONE_LIPID.headR * 2.4)))
  const pts: WallPoint[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    if (arc) {
      // The standing arc runs from aR anticlockwise over the top to aL:
      // keep angles NOT in the submerged interval (aR → aL clockwise).
      if (a > arc.aR && a < arc.aL) continue
    }
    pts.push({
      at: { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r },
      tangent: { x: -Math.sin(a), y: Math.cos(a) },
      inward: { x: -Math.cos(a), y: -Math.sin(a) },
    })
  }
  return pts
}

/** The molecule the depth-lipids are drawn as — small against D06's, right
 *  for the zone's ×4. */
// The bilayer bench's own proportions (HALF_MEM/HEAD_R = 5), scaled down —
// small heads, LONG tails, two clearly separate leaflets.
// ~2× down again (user, 2026-09-01: heads stuck out of the contour) — the
// bilayer now fits INSIDE the drawn band's thickness.
const ZONE_LIPID: LipidGeom = { headR: 0.6, halfMem: 3.0 }

/** Where the axon enters the frame: the stalk's top edge, measured off the
 *  traced outline's own top corners — never typed from the eye. */
export function neckTop(g: SynapseGeometry): { x: number; y: number } {
  let lo = Infinity
  let hi = -Infinity
  for (const s of BOUTON_SEGS) {
    if (s.kind === 'close') continue
    if (s.y < 2) {
      lo = Math.min(lo, s.x)
      hi = Math.max(hi, s.x)
    }
  }
  const mid = place(g.fit, (lo + hi) / 2, 0)
  return { x: mid.x, y: Math.max(0, mid.y) }
}

/** ⚠ WHERE THE SPIKE COMES FROM (user, 2026-09-01: "I want to see the action
 *  potential coming, as a yellow flash on the top of the presynaptic axon").
 *  A bright knot that enters at the frame's top edge and runs down the stalk
 *  as the terminal charges — the same conduction the wider views draw patch by
 *  patch, arriving here. Its brightness is the same `hot` the wall's own
 *  highlight reads, so the flash and the depolarization can never disagree
 *  about when the spike is happening. */
/** The flash's halo radius, px. ⚠ BIG ON PURPOSE (user, 2026-09-01: "large
 *  and bright, as if a big electric current just flashed") — an arrival is an
 *  event, not a status light. */
export const FLASH_R = 150

/** ⚠ The flash's afterglow, in SCREEN ms (user, 2026-09-02: "the yellow ball
 *  keeps hanging on the top of the page for multiple seconds"). The previous
 *  round sized it in MODEL ms — 10 — but the clock CRAWLS through the early
 *  legs, so 10 model ms there is ~13 real seconds, while the postsynaptic
 *  flash's same 10 model ms play in a fast leg and last ~2 s. A clock belongs
 *  to the event it is timing: the fade is a screen event, so it is defined on
 *  the screen clock — sized to read like the postsynaptic flash — and no leg
 *  can stretch it. (Still a pure function of position, via `screenOfModel`,
 *  so scrubbing replays it faithfully.) */
export const FLASH_FADE_SCREEN_MS = 1800

export function arrivalFlash(
  g: SynapseGeometry,
  run: SynapseRun,
  ms: number,
): { x: number; y: number; alpha: number; r: number } | null {
  const vm = sampleSynapse(run, 'vm', ms / run.windowMs)
  const hot = Math.min(1, (vm + 40) / 80)
  const sinceMs =
    (screenOfModel(ms / run.windowMs) - screenOfModel(run.vmPeakMs / run.windowMs)) *
    SYNAPSE_SCREEN_MS
  const dying =
    ms > run.vmPeakMs && sinceMs < FLASH_FADE_SCREEN_MS
      ? 1 - sinceMs / FLASH_FADE_SCREEN_MS
      : 0
  const alpha = Math.max(ms <= run.vmPeakMs ? hot : 0, dying)
  if (alpha <= 0.02) return null
  const p = Math.min(1, ms / Math.max(0.2, run.vmPeakMs))
  const top = neckTop(g)
  return { x: top.x, y: top.y + p * (NECK_PX + 26), alpha, r: FLASH_R }
}

export type SoupIon = {
  kind: 'na' | 'k' | 'cl' | 'ca'
  x: number
  y: number
  where: 'out' | 'pre' | 'post'
}

/** ⚠ THE ION SOUP (user, 2026-09-01: "display ion soup in both pre- and
 *  postsynaptic and extracellular space"). Loose ions in every compartment,
 *  carrying the app's own asymmetries: potassium-rich inside BOTH cells,
 *  sodium- and chloride-rich outside, a little calcium waiting in the gap for
 *  the doors to open. So nothing enters from nowhere: the calcium the doors
 *  admit was visible in the cleft, and the sodium the receptors admit joins a
 *  crowd that was already there.
 *
 *  ⚠ THE COUNTS ARE A MOOD, NOT A CENSUS, and the note beside the other
 *  exaggerations says so: drawn true (Na⁺ outside 145 mM) the bath would be
 *  solid ink. The RATIOS between compartments are what the handful carries.
 *
 *  ⚠ The cleft's own calcium and sodium are NOT in here: those balls belong
 *  to the casts (`synapseCast`), because they are the ones with journeys to
 *  make — one population per substance, never two. */
export function ionSoup(g: SynapseGeometry): SoupIon[] {
  const out: SoupIon[] = []
  const r = vesicleR(g)
  const jitter = (i: number, salt: number) => {
    const h = Math.sin(i * 73.9 + salt) * 43758.5453
    return h - Math.floor(h)
  }
  // ── outside: the bath either side of the bulb, and the cleft itself.
  const OUT: SoupIon['kind'][] = [
    'na',
    'na',
    'na',
    'cl',
    'cl',
    'na',
    'cl',
    'k',
    'na',
    'cl',
  ]
  const leftEdge = g.fit.ox + BOUTON_BOX.x * g.fit.k
  const rightEdge = g.fit.ox + (BOUTON_BOX.x + BOUTON_BOX.w) * g.fit.k
  for (const [i, kind] of OUT.entries()) {
    const side = i % 2 === 0 ? -1 : 1
    const j = jitter(i, 1.7)
    const j2 = jitter(i, 8.3)
    const x = side < 0 ? leftEdge - 30 - j * (leftEdge - 46) : rightEdge + 30 + j * 80
    out.push({ kind, x, y: 30 + j2 * (g.foot.y - 40), where: 'out' })
  }
  // The gap: a little chloride passing through. The calcium waiting for the
  // doors and the sodium waiting above the receptors are cast members, not
  // soup — they have journeys to make.
  const CLEFT: SoupIon['kind'][] = ['cl', 'cl']
  for (const [i, kind] of CLEFT.entries()) {
    const j = jitter(i, 3.9)
    const j2 = jitter(i, 12.7)
    const x = g.foot.x + (j - 0.5) * 2 * g.activeHalf * 1.15
    const top = wallAt(g, x) + MEM_PX + 4
    const bottom = faceAt(g, x) - MEM_PX - 4
    out.push({ kind, x, y: top + (bottom - top) * (0.25 + j2 * 0.5), where: 'out' })
  }
  // ── the terminal: potassium-rich, above the vesicle crowd.
  const PRE: SoupIon['kind'][] = ['k', 'k', 'k', 'k', 'na', 'k', 'cl', 'k', 'k']
  for (const [i, kind] of PRE.entries()) {
    const j = jitter(i, 5.1)
    const j2 = jitter(i, 15.9)
    const x = g.foot.x + (j - 0.5) * 2 * g.activeHalf * 0.9
    out.push({ kind, x, y: wallAt(g, x) - MEM_PX - r * (3.8 + j2 * 4.6), where: 'pre' })
  }
  // ── the spine: potassium-rich too. The sodium the receptors let in is the
  // cast's — the same balls that waited in the cleft.
  const POST: SoupIon['kind'][] = ['k', 'k', 'k', 'na', 'k', 'k']
  for (const [i, kind] of POST.entries()) {
    const j = jitter(i, 7.7)
    const j2 = jitter(i, 19.1)
    const x = g.head.cx + (j - 0.5) * 2 * g.head.rx * 0.55
    out.push({
      kind,
      x,
      y: faceAt(g, x) + MEM_PX * 2.6 + j2 * g.head.ry * 0.7,
      where: 'post',
    })
  }
  return out
}

/** How long the departing nudge takes to leave the frame, model ms — cable
 *  spread toward the soma really is millisecond-scale, so unlike a crossing
 *  this is a journey the physics permits. 10 (user, 2026-09-02: "make it a
 *  short flash (10 ms)"). */
export const POST_FLASH_MS = 10

/** ⚠ THE NUDGE LEAVES FOR THE SOMA — the arrival's grammar, the opposite
 *  truth (user chose: "travels but decays"). A gold knot exits the spine,
 *  runs down the dendrite and off the canvas, SHRINKING AND DIMMING as it
 *  goes: the decrement is what makes it an EPSP and not a spike, so it must
 *  never leave at full brightness. Launch is read off the model's own
 *  `vmPost` series. */
/** When the departing nudge launches, model ms — or null on a run whose
 *  channels never open. ⚠ AFTER THE IONS (user, 2026-09-01: "ions flow in →
 *  short pause → postsynaptic flash"): the launch waits for the FIRST sodium
 *  pair to have crossed and settled, plus a beat — the flash is the
 *  consequence of the current, and follows it on screen. ONE copy of this
 *  arithmetic, shared by the drawing and the timeline's event dot. */
export function nudgeLaunchMs(
  g: SynapseGeometry,
  run: SynapseRun,
  cleft: CleftRun,
): number | null {
  let launch: number | null = null
  const sites = receptorSites(g)
  for (let r = 0; r < sites.length; r++) {
    const ow = receptorOpenWindow(g, run, cleft, r)
    if (ow === null) continue
    const arrived =
      ow.openAt + NA_PAUSE_MS + 0.35 + NA_APPROACH_MS + NA_CROSS_MS + NA_SETTLE_MS
    launch = launch === null ? arrived : Math.min(launch, arrived)
  }
  // ⚠ THE SECOND REFLECTION PAUSE (user, 2026-09-01: "…and before the signal
  // leaves — give users time to reflect"): ~3.5 model ms at the chain leg's
  // ~0.28 s/ms is the chosen ~1 s of screen stillness between the ions
  // settling and the nudge's departure.
  return launch === null ? null : launch + 3.5
}

export function departingFlash(
  g: SynapseGeometry,
  run: SynapseRun,
  cleft: CleftRun,
  ms: number,
  height = SYN_H,
): { x: number; y: number; alpha: number; r: number } | null {
  const swing = cleft.peakPostMv - SPINE_REST_MV
  if (swing <= 1e-6) return null
  const launch = nudgeLaunchMs(g, run, cleft)
  if (launch === null) return null
  if (ms <= launch) return null
  const q = (ms - launch) / POST_FLASH_MS
  if (q >= 1) return null
  // ⚠ IN THE CELL, then gone below (user, 2026-09-02: "create a flash in the
  // postsynaptic cell, after Na ions enter, to symbolize signal
  // propagation"). It ignites INSIDE the spine head — where the ions that
  // caused it just settled — and runs down the neck and trunk off the bottom
  // edge. This supersedes the below-the-frame start of 2026-09-01, whose real
  // target was "never in the synaptic cleft": the flash still never touches
  // the cleft, and still SHRINKS AND DIMS as it travels — the decrement is
  // what makes it an EPSP and not a spike.
  const y0 = faceAt(g, g.head.cx) + g.head.ry * 0.7
  const y1 = height + 80
  return {
    x: g.head.cx,
    y: y0 + (y1 - y0) * q,
    alpha: 0.9 * (1 - q),
    r: FLASH_R * (0.9 - 0.45 * q),
  }
}

/** ⚠ THE SPINE'S AURA STARTS ABOVE EVERY POINT OF THE FACE (user, 2026-09-01:
 *  "the postsynaptic aura has a linear cut — should look contained in the
 *  shape"). The wash's gradient used to begin at the face's CENTRE height,
 *  and a linear gradient clamps to its first stop — alpha zero — above that
 *  line, so wherever the curved face rose past the centre's level the aura
 *  stopped along a ruler-straight edge. Starting above the face's highest
 *  point leaves the aura bounded by the clip path alone: the shape itself. */
export function spineAuraTop(g: SynapseGeometry): number {
  let top = Infinity
  for (let i = 0; i <= 24; i++) {
    const x = g.head.cx - g.head.rx + (2 * g.head.rx * i) / 24
    top = Math.min(top, faceAt(g, x))
  }
  return top + MEM_PX * 0.5
}

/** ⚠ THE TWO INTERIOR AURAS — one named decision, on the app's own charge
 *  ramp (`chargeWash`: blue = inside negative, red = inside positive — the
 *  same red the voltage-gated bench wears, which is the precedent the user
 *  pointed to).
 *
 *  `pre` is the terminal's voltage: it really overshoots past zero at the
 *  spike, so the bouton genuinely turns RED and comes back. `post` is the
 *  spine's EPSP: it climbs from −70 toward −58 and NEVER goes positive, so
 *  the spine warms toward neutral and never reaches red — a spike against a
 *  graded potential, which is the lesson. `epsp` is the swing normalised to
 *  its own peak, for the gold signal-glow that says "current arriving". */
export function synapseAuras(
  run: SynapseRun,
  cleft: CleftRun,
  u: number | null,
): { pre: number; post: number } {
  const vmPre = u === null ? run.vm[0] : sampleSynapse(run, 'vm', u)
  const vmPost = u === null ? SPINE_REST_MV : sampleCleft(cleft, 'vmPost', u)
  return {
    pre: polarityT(vmPre),
    // Kept as the PINNED MODEL FACT even though the drawing no longer paints
    // it directly: the spine's absolute polarity stays negative for ever,
    // which is why the red tint below must be declared as relative-to-rest.
    post: polarityT(vmPost),
  }
}

/** ⚠ THE SPINE'S BACKGROUND TINT (user, 2026-09-02: "replace [the yellow
 *  aura] with red or blue colour-coding to symbolise hyper- and
 *  depolarization postsynaptically") — on the app's own charge ramp, but
 *  RELATIVE TO REST: positive (red) = depolarized from −70, negative (blue)
 *  = hyperpolarized. Declared: the spine's absolute voltage never goes
 *  positive (−70 → −58, a graded EPSP, never a spike — `synapseAuras.post`
 *  pins that), so red here means "pushed off rest", not "inside positive".
 *  Blue never shows in THIS run — an AMPA synapse only depolarizes; the blue
 *  half of the scale waits for an inhibitory synapse.
 *
 *  ⚠ PACED BY THE DRAWN IONS, not the model's early vmPost (user, 2026-09-02:
 *  "the sodium didn't even penetrate the cell, but the yellow aura is already
 *  there"): the model's EPSP rises at ~5.5 ms, but the drawn chain is a
 *  slowed curation whose ions cross at ~10–17 ms — cause must be on screen no
 *  later than effect, so the tint rises WITH each drawn ion's crossing and
 *  decays on the model's own membrane clock (`SPINE_TAU_MS`) after the last
 *  one settles. Pace curated, size normalised to the run's own peak. */
export function spineTint(
  g: SynapseGeometry,
  run: SynapseRun,
  cleft: CleftRun,
  ms: number,
): number {
  const sites = receptorSites(g)
  let sum = 0
  let n = 0
  let last: number | null = null
  for (let r = 0; r < sites.length; r++) {
    const ow = receptorOpenWindow(g, run, cleft, r)
    if (ow === null) continue
    for (let k = 0; k < NA_PER_RECEPTOR; k++) {
      const enter = ow.openAt + NA_PAUSE_MS + k * 0.8 + NA_APPROACH_MS
      sum += Math.max(0, Math.min(1, (ms - enter) / (NA_CROSS_MS + NA_SETTLE_MS)))
      n++
      const done = enter + NA_CROSS_MS + NA_SETTLE_MS
      last = last === null ? done : Math.max(last, done)
    }
  }
  if (n === 0 || last === null) return 0
  const decay = ms > last ? Math.exp(-(ms - last) / SPINE_TAU_MS) : 1
  return (sum / n) * decay
}

export interface SynapseView {
  run: SynapseRun
  cleft: CleftRun
  /** Position through the run, 0→1, or null at rest. */
  u: number | null
  /** How far this view has arrived. */
  fade?: number
  /** ⚠ The ambient THERMAL clock (user, 2026-09-01: "make them jiggle all the
   *  time"). Thermal motion never pauses, so the jiggle must not ride the
   *  model clock — which crawls in the slow legs, freezes in the beats and
   *  races in the tail. The caller advances this on real screen time; when
   *  absent, the run's own ms stands in (tests stay deterministic). */
  jiggle?: number
  /** How much of the view's CHROME shows — labels, captions, magnifier
   *  doors. It dissolves on the dive to the active-zone place, where words
   *  and doors would be giant; the anatomy underneath keeps running. */
  chrome?: number
  /** The labels switch (2026-09-04): false = the callouts are not drawn at
   *  all, whatever the chrome. Defaults to on. */
  labelsOn?: boolean
  width?: number
  height?: number
}

export function drawSynapse(ctx: CanvasRenderingContext2D, v: SynapseView): void {
  const fade = v.fade ?? 1
  if (fade <= 0.002) return
  const width = v.width ?? SYN_W
  const height = v.height ?? SYN_H
  const g = synapseGeometry(width, height)
  const u = v.u
  const ms = u === null ? 0 : u * v.run.windowMs

  ctx.save()
  // ⚠ MULTIPLIED, never assigned: the view's arrival rides on this.
  ctx.globalAlpha *= fade

  // The bath everything sits in.
  ctx.fillStyle = OUTSIDE
  ctx.fillRect(0, 0, width, height)

  const auras = synapseAuras(v.run, v.cleft, u)
  const chrome = v.chrome ?? 1

  // ── the ion soup, one seeded set for the whole frame. A gentle thermal
  // wobble on the model's own clock — during a beat the whole picture holds
  // its breath, soup included.
  const soup = ionSoup(g)
  const jig = v.jiggle ?? ms
  const drawSoup = (where: SoupIon['where']) => {
    for (const [i, s] of soup.entries()) {
      if (s.where !== where) continue
      drawGlossyIon(
        ctx,
        s.kind,
        s.x + Math.sin(jig * 0.7 + i * 2.399) * 1.6,
        s.y + Math.cos(jig * 0.5 + i * 1.171) * 1.4,
        2.7,
        0.55,
      )
    }
  }
  drawSoup('out')

  // ── the astrocyte's fingers (21b-1): the third cell, one at each flank of
  // the cleft — the collectors the escaping transmitter travels to. Behind
  // both neurons in the pile; the active-zone camera crops them away.
  drawAstroFinger(ctx, g, 1)
  drawAstroFinger(ctx, g, -1)

  // ── the postsynaptic side, bottom of the pile: the target's dendrite tip,
  // spine head to trunk, leaving through the bottom toward its soma.
  ctx.fillStyle = CYTOPLASM
  spinePath(ctx, g, width, true, height)
  ctx.fill()
  // The spine's own aura, on the app's charge ramp: it warms toward neutral
  // with the EPSP and NEVER reaches red — the inside never goes positive,
  // which is what makes this a graded potential and not a spike. The gold is
  // the signal grammar: current arriving, head-bright, faint by the shaft.
  ctx.save()
  spinePath(ctx, g, width, true, height)
  ctx.clip()
  // From above the face's HIGHEST point — see `spineAuraTop` for the straight
  // edge this kills. The clip is what contains it, and the clip is the shape.
  const auraTop = spineAuraTop(g)
  // ⚠ RED/BLUE, NEVER GOLD (user, 2026-09-02): the gold "current arriving"
  // glows that used to sit here lit up before any drawn ion had crossed —
  // they followed the model's early vmPost. The tint below is paced by the
  // drawn ions themselves (see `spineTint`), so the spine only reddens as
  // sodium actually enters, and cools on the membrane's own clock.
  const tint = u === null ? 0 : spineTint(g, v.run, v.cleft, ms)
  ctx.fillStyle = chargeWash(ctx, auraTop, height + 40, tint, 0.32)
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
  drawSoup('post')
  // The membrane strokes the OPEN outline — head, neck and trunk walls; its
  // base is off-canvas, because the dendrite continues toward its soma.
  membraneBand(ctx, () => spinePath(ctx, g, width, false, height))

  // ── the receptors, in the spine head's own membrane

  for (const [i, site] of receptorSites(g).entries()) {
    ctx.save()
    ctx.translate(site.x, site.y)
    // ⚠ NO ROTATION (user, 2026-09-01: "ligand-gated channels are upside
    // down"). The traced channel's binding seat is on its extracellular mouth
    // at local −y — already toward the cleft above this face. The old
    // rotate(π), left over from a flipped composition, put the seat INSIDE
    // the spine.
    // Each receptor is either open or not — a population read as individuals.
    // ⚠ AND NEVER OPEN BEFORE ITS TRANSMITTER IS SEATED (user, 2026-09-01:
    // "postsynaptic channels open before neurotransmitters got bound"): the
    // drawn states are gated on the same seat window the cast animates, so
    // cause is on screen before effect, receptor by receptor.
    const win = receptorSeatWindow(g, v.run, v.cleft, i)
    const seatedNow =
      u !== null &&
      win.seatedAt !== null &&
      ms >= win.seatedAt &&
      (win.releasedAt === null || ms < win.releasedAt)
    // ⚠ EASED, both ways (user, 2026-09-01: the plugged pair "visually
    // follows the channel moving as it opens") — the same fraction the cast's
    // seated transmitter reads, so ball and socket cannot part company.
    const openFrac = u === null ? 0 : receptorOpenFrac(g, v.run, v.cleft, i, ms)
    drawLigandChannel(ctx, {
      cx: 0,
      midY: 0,
      halfHeight: MEM_PX * 2.6,
      open: openFrac,
      species: GLOSSY_COLORS.na.mid,
      speciesDark: GLOSSY_COLORS.na.dark,
      socket: seatedNow,
    })
    ctx.restore()
  }
  // The transmitter, the calcium and the sodium are drawn LATER, as casts —
  // every ball with identity, over the machinery it moves between.

  // ── the terminal. ⚠ ITS WALL IS TORN where a vesicle has opened into it.
  const tears = u === null ? [] : tearsAt(g, v.run, ms)
  ctx.fillStyle = CYTOPLASM
  boutonPath(ctx, g.fit)
  ctx.fill()
  // The terminal's charge aura, strongest against the active zone's wall. The
  // spike really does overshoot past zero, so this one genuinely goes RED and
  // comes back — the depolarization the user asked to see, in the same ramp
  // the voltage-gated bench wears.
  ctx.save()
  boutonPath(ctx, g.fit)
  ctx.clip()
  ctx.fillStyle = chargeWash(ctx, g.foot.y - MEM_PX, 0, auras.pre, 0.34)
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
  drawSoup('pre')
  membraneBand(
    ctx,
    () => boutonPath(ctx, g.fit),
    tears,
    (x) => wallAt(g, x),
  )

  // ── the spike arriving down the stalk, in the app's own signal yellow.
  // ⚠ DRAWN HERE, with the wall — before the doors, the vesicles and the
  // calcium (user, 2026-09-01: "at the start of the animation, Ca channels get
  // covered by the bouton membrane"). It is a repaint of the membrane, so it
  // draws when the membrane draws; painted last it sat ON TOP of every channel
  // in the wall. And it honours the same tears, for the same reason.
  const vm = u === null ? null : sampleSynapse(v.run, 'vm', u)
  if (vm !== null && vm > -40) {
    const hot = Math.min(1, (vm + 40) / 80)
    softGlow(
      ctx,
      g.foot.x,
      g.foot.y - g.activeHalf * 2.4,
      90 * hot,
      SIGNAL_RGB,
      0.35 * hot,
    )
    ctx.save()
    ctx.globalAlpha *= hot
    membraneBand(
      ctx,
      () => boutonPath(ctx, g.fit),
      tears,
      (x) => wallAt(g, x),
    )
    ctx.restore()
  }

  // ── the reserve pool, each bubble its own (realistically uniform) size
  for (const [i, p] of reservePool(g).entries()) {
    const pr = vesicleR(g) * vesicleScale(i + 40)
    vesicle(ctx, p.x, p.y, pr)
    drawCargo(ctx, p.x, p.y, pr)
  }

  // ── the active zone: doors and docked vesicles, interleaved
  const zone = activeZone(g)
  const gate = u === null ? 0 : sampleSynapse(v.run, 'open', u)
  for (const d of zone.doors) {
    ctx.save()
    ctx.translate(d.x, d.y)
    drawVoltageChannel(ctx, {
      cx: 0,
      midY: 0,
      halfHeight: MEM_PX * 2.6,
      open: gate,
      // ⚠ NO INACTIVATION BALL HERE. The presynaptic calcium channel is not the
      // axon's sodium channel: what shuts it is the membrane repolarising, not
      // a plug falling into its mouth. Drawing one would teach a mechanism this
      // channel does not have.
      plug: 0,
      sensor: gate,
      species: GLOSSY_COLORS.ca.mid,
      speciesDark: GLOSSY_COLORS.ca.dark,
    })
    ctx.restore()
  }
  // ⚠ A DOCKED VESICLE IS CLOSED (user, 2026-09-01: "make docked vesicles'
  // membrane closed — currently has a gap"). This does not reverse the ruling
  // of 2026-08-31 — "its area that OVERLAPS with the membrane WHILE MOVING
  // loses outline" — because since `dockedY` a resting vesicle clears the wall
  // and overlaps nothing; the outline-skip now applies exactly where the
  // ruling says: while a fusing vesicle is sinking THROUGH the wall.
  for (const d of zone.docked) {
    const r = d.r
    const gone = u === null ? null : (v.run.vesicles[d.index]?.fusedAtMs ?? null)
    if (gone !== null && ms >= gone) {
      // ⚠ FUSED, and drawn as what fusion IS. `fusedShape` sinks the circle
      // through the wall on the declared schedule; the moment it crosses the
      // outline, what is drawn is the OMEGA: an arc whose two feet stand ON
      // the bouton's own curve (`pocketAt`), over a tear whose edges are those
      // same two feet — one continuous wall with a pocket in it, then, slowly,
      // no pocket at all.
      const shape = fusedShape(g, d.x, ms - gone, d.r)
      // Fully flattened: the bubble IS the wall now. Nothing to draw.
      if (!shape) continue
      const pocket = pocketAt(g, d.x, shape.cy, shape.r)
      if (pocket) {
        drawPocket(ctx, g, shape, pocket)
      } else {
        // Still sinking. ⚠ The outline stays WHOLE until the circle actually
        // reaches the membrane band (user, 2026-09-01: "the vesicle membrane
        // visually breaks before fusing — a ghost outline overlaps it"):
        // clipping it against the wall's strip from the first frame cut the
        // bottom arc while the bubble was still clear of the wall.
        const touching = shape.cy + shape.r >= wallAt(g, d.x) - MEM_PX * 1.1
        vesicle(
          ctx,
          d.x,
          shape.cy,
          shape.r,
          1,
          touching
            ? {
                from: d.x - shape.r * 1.4,
                to: d.x + shape.r * 1.4,
                wallY: (x: number) => wallAt(g, x),
                pad: MEM_PX * 0.8,
              }
            : undefined,
        )
      }
      // Its cargo is part of the transmitter CAST now — drawn below with the
      // rest of the population, each ball on its own trajectory.
      continue
    }
    vesicle(ctx, d.x, d.y, r, 1)
    // The machinery holding it there — rope and calcium knobs, so the pink
    // ions settling beside it visibly bind to SOMETHING.
    drawSnareMini(ctx, g, d)
  }

  // ── the membrane's own molecules, resolved at the zone's depth — walls,
  // face, and every intact bubble as a ring of the same material.
  const depth = 1 - chrome
  if (depth > 0.05) {
    ctx.save()
    ctx.globalAlpha *= depth
    paveMembrane(ctx, membraneLipids(g, tears), {
      geom: ZONE_LIPID,
      first: 0,
      taperOver: 3,
    })
    for (const d of zone.docked) {
      const gone = u === null ? null : (v.run.vesicles[d.index]?.fusedAtMs ?? null)
      if (gone !== null && ms >= gone) {
        // Fusing: the standing omega keeps its molecules; the submerged part
        // has become wall (whose own rows part at the tear).
        const shape = fusedShape(g, d.x, ms - gone, d.r)
        if (!shape) continue
        const pocket = pocketAt(g, d.x, shape.cy, shape.r)
        if (!pocket) {
          paveMembrane(ctx, vesicleLipids(d.x, shape.cy, shape.r), {
            geom: ZONE_LIPID,
            first: 500,
            taperOver: 0,
          })
          continue
        }
        const aR = Math.atan2(pocket.yR - shape.cy, pocket.xR - d.x)
        const aL = Math.atan2(pocket.yL - shape.cy, pocket.xL - d.x)
        paveMembrane(
          ctx,
          vesicleLipids(d.x, shape.cy, shape.r, {
            aR,
            aL: aL < aR ? aL + Math.PI * 2 : aL,
          }),
          { geom: ZONE_LIPID, first: 500, taperOver: 0 },
        )
        continue
      }
      paveMembrane(ctx, vesicleLipids(d.x, d.y, d.r), {
        geom: ZONE_LIPID,
        first: 500,
        taperOver: 0,
      })
    }
    for (const [i, p] of reservePool(g).entries()) {
      paveMembrane(ctx, vesicleLipids(p.x, p.y, vesicleR(g) * vesicleScale(i + 40)), {
        geom: ZONE_LIPID,
        first: 500,
        taperOver: 0,
      })
    }
    ctx.restore()
  }

  // ── the doors glow while current flows; the ions themselves are the cast.
  const local = u === null ? 0 : sampleSynapse(v.run, 'caLocalUm', u)
  if (local > v.run.restUm * 1.2) {
    const lit = Math.min(1, local / Math.max(1e-6, v.run.peakLocalUm))
    for (const d of zone.doors) {
      softGlow(
        ctx,
        d.x,
        d.y - MEM_PX * 2,
        10 + 26 * lit,
        GLOSSY_COLORS.ca.glow,
        0.5 * lit,
      )
    }
  }

  // ── THE CAST: every loose ball in the picture, with identity — present
  // from the first frame, moving only by travel, fading never. See
  // `synapseCast` for the ruling this implements.
  ctx.save()
  ctx.globalAlpha *= CAST_ALPHA
  for (const dot of transmitterCast(g, v.run, v.cleft, ms, jig)) {
    transmitterDot(ctx, dot.x, dot.y, TRANSMITTER_R)
  }
  ctx.restore()
  for (const ion of calciumCast(g, v.run, ms, jig)) {
    drawGlossyIon(ctx, 'ca', ion.x, ion.y, 3.2, CAST_ALPHA)
  }
  for (const ion of sodiumCast(g, v.run, v.cleft, ms, jig)) {
    drawGlossyIon(ctx, 'na', ion.x, ion.y, 3, CAST_ALPHA)
  }
  // The snap of binding — the ligand bench's own white aura, at the instant
  // an ion or a ball seats.
  for (const pulse of bindPulses(g, v.run, v.cleft, ms)) {
    softGlow(ctx, pulse.x, pulse.y, 16, '255, 255, 255', 0.75 * pulse.a)
  }

  // ⚠ THE TWO TRAVELLING FLASHES ARE PAINTED LAST OF ALL THE PHYSICS (user,
  // 2026-09-01: "the postsynaptic flash highlights the inner dark fill of
  // fusing vesicles"). Drawn earlier, their glow was OVERPAINTED by the
  // pockets' opaque lumen fill, which cut dark holes in the light. Last,
  // the glow washes bath and lumen alike — and they are the same ink, so
  // they now LOOK the same, which is the topology's own claim.
  const flash = u === null ? null : arrivalFlash(g, v.run, ms)
  if (flash) {
    softGlow(ctx, flash.x, flash.y, flash.r, SIGNAL_RGB, 0.55 * flash.alpha)
    softGlow(ctx, flash.x, flash.y, flash.r * 0.42, SIGNAL_RGB, 0.95 * flash.alpha)
  }
  const leaving = u === null ? null : departingFlash(g, v.run, v.cleft, ms, height)
  if (leaving) {
    softGlow(ctx, leaving.x, leaving.y, leaving.r, SIGNAL_RGB, 0.5 * leaving.alpha)
    softGlow(ctx, leaving.x, leaving.y, leaving.r * 0.42, SIGNAL_RGB, 0.9 * leaving.alpha)
  }

  if (chrome > 0.02) {
    ctx.save()
    ctx.globalAlpha *= chrome
    // ⚠ No magnifiers here any more (user, 2026-09-01): the way deeper is
    // the scale switch top-right, and the way into D06 is the shelf button
    // bottom-left — the AP views' own patterns, HTML chrome over the stage.
    // Each name tied to its part by a connector (2026-09-04), the D06 way —
    // unless the labels switch is off.
    //
    // ⚠ 'active zone' USED TO BE DRAWN OUTSIDE THIS GUARD, as a bare 12px
    // fillText with no plate and no leader (found 2026-09-04): a name that
    // the labels switch could not hide, sitting beside three names it could.
    // It is a name like the others now.
    if (v.labelsOn !== false) {
      for (const co of synapseCallouts(g)) {
        ctx.strokeStyle = INK
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(co.label.x + co.label.w / 2, co.label.y + co.label.h / 2)
        ctx.lineTo(co.to.x, co.to.y)
        ctx.stroke()
        drawSpoken(ctx, co.label)
      }
      const azl = activeZoneLabelAt(g)
      drawName(ctx, named('active zone', azl.x, azl.y))
    }
    ctx.restore()
  }
  ctx.restore()
}

/** The exaggerations, said out loud beside the real numbers — the app never
 *  quietly redraws a distance. */
export const CLEFT_NOTE = `Drawn ${CLEFT_PX} px across; a real cleft is ${CLEFT_NM} nm — about a thousandth of the bouton's width. Widened here so that what crosses it can be seen at all. Even the fill-up puff is slowed about a hundredfold: the real crossing takes well under a microsecond, which is the point.`

export const VESICLE_NOTE = `The bubbles are drawn ${VESICLE_EXAGGERATION.toFixed(1)}× too big as well, with the ±10% size spread real vesicles have. A real synaptic vesicle is about 40 nm across against a terminal of roughly a micrometre — four per cent of it — and five of them docking, opening and tearing the wall is what this picture is about.`

export const SOUP_NOTE =
  'The loose ions are a mood, not a census: drawn true, sodium alone at 145 mM would make the bath solid ink. What the handful carries is the RATIOS — potassium-rich inside both cells, sodium and chloride outside, a trace of calcium waiting in the gap.'

export const CAPTURE_NOTE =
  'The caught share is exaggerated too: a real packet is ~4,000 molecules and a postsynaptic density holds fewer than a couple of hundred binding sites, so only a few per cent are ever caught — the rest genuinely diffuses away, into the arms of the astrocyte transporters that ring every synapse, just outside this frame. With twenty-one drawn balls, ten are caught so that catching is visible at all.'

export const SCALE_NOTES = [CLEFT_NOTE, VESICLE_NOTE, SOUP_NOTE, CAPTURE_NOTE]
