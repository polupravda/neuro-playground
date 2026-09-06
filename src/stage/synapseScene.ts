import { ASTRO_INK, STAGE_H, STAGE_W } from './layout'
import {
  ASTRO_SVG_SEGS,
  astroContains,
  outsideOn,
  outwardOn,
  tangentOn,
  placeAstro,
  type AstroPlacement,
} from './astrocyteShape'
import { flattenPath, flattenSubpaths, tracePath } from './svgPath'
import {
  EAAT_GLYPH,
  SNAT_GLYPH,
  PMCA_GLYPH,
  VGLUT_GLYPH,
  poreSeat,
  drawChannelGlyph,
  drawMovingGlyph,
  type ChannelGlyph,
} from './channelShapes'
import {
  BULB_BOX,
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
  CA_EXTRUDE_FROM_MS,
  caPumpStateAt,
  fillerStateAt,
  restOfIon,
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
import { spoken, drawSpoken, type SpokenLabel } from './spokenLabels'

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
// → the loop's own legs, 2026-09-05: the run grew by exactly the weight they
// added (`CLOCK_WEIGHT`, declared with the legs), so every leg before them
// keeps the absolute screen time it was tuned to and only the new stages cost
// anything.
export let SYNAPSE_SCREEN_MS = 22000

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
    to: 30 / 60,
    share: 0.081,
    what: 'clearing up: calcium buffered, the bath settles',
  },
  // ⚠ THE LOOP'S OWN LEGS (21c-2). The glutamate–glutamine cycle used to have
  // no screen time at all — the tail leg carried 24.5→60 ms at 0.081 of the
  // clock, so the whole round trip would have flickered past. Each stage now
  // has a leg of its own, and the run GREW to pay for them rather than the
  // earlier legs being compressed: `SYNAPSE_SCREEN_MS` is scaled by the same
  // factor the shares are normalised by, so every leg before this one keeps
  // the absolute screen time it was tuned to. Measured in the guards.
  //
  // ⚠ AND THE TIMESCALE IS DECLARED, not smuggled: uptake really is
  // milliseconds while the glutamine round trip is seconds to minutes. One
  // screen clock cannot be honest about both, so this stretch is choreography
  // and the info block says so.
  { from: 30 / 60, to: 36 / 60, share: 0.1, what: 'caught: the astrocyte takes it in' },
  {
    from: 36 / 60,
    to: 41 / 60,
    share: 0.09,
    what: 'converted: glutamate becomes glutamine',
  },
  { from: 41 / 60, to: 48 / 60, share: 0.1, what: 'shipped home across the gap' },
  { from: 48 / 60, to: 53 / 60, share: 0.08, what: 'converted back to glutamate' },
  // ⚠ THE FILLING LEG PAYS FOR ITS OWN QUEUE (21c-3l). Each bubble's VGLUT now
  // carries one ball at a time, four beats to a turn — and at 0.12 a turn was
  // 0.30 s, so a beat was five frames and the cycle read as a flicker. The
  // share is what the leg is WORTH in screen time; the run grows to pay for it
  // rather than the earlier legs being squeezed (`SYNAPSE_SCREEN_MS` is scaled
  // by the same weight), so every leg before this keeps the time it was tuned
  // to. Measured after: a turn is ~0.5 s, in the same country as the calcium
  // pump's ~0.7 s.
  {
    from: 53 / 60,
    to: 1,
    share: 0.2,
    what: 'stocked, and the vesicles fill from the pool',
  },
]

/** ⚠ THE SHARES ARE WEIGHTS, NORMALISED — so a leg can be added without
 *  re-tuning every other number by hand, and so the run's LENGTH pays for new
 *  legs instead of the old ones being squeezed. */
export const CLOCK_WEIGHT = CLOCK_LEGS.reduce((sum, l) => sum + l.share, 0)
for (const leg of CLOCK_LEGS) leg.share /= CLOCK_WEIGHT
SYNAPSE_SCREEN_MS = Math.round(SYNAPSE_SCREEN_MS * CLOCK_WEIGHT)

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
  // ⚠ THE END IS THE END. The shares are weights that are normalised, so they
  // sum to 1 only to within floating-point dust — and accumulating them across
  // every leg left the last model moment at 0.9999999999999998, which is a dot
  // that never quite reaches the end of the bar. `synapseClock` already treats
  // its own last step this way.
  if (m >= 1) return 1
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
/** ⚠ WHEN THE LOOP'S STAGES ACTUALLY HAPPEN, walked off the transmitters once
 *  (21c-3m). Each answer is the first frame at which the picture shows the
 *  thing — a ball inside the astrocyte, a ball that has changed kind, a ball
 *  back in a bubble — rather than the constant the cast schedules it with.
 *
 *  One pass, seven answers, at half a model millisecond: fine enough for a dot
 *  on a bar and cheap enough to run once per run.
 *
 *  ⚠ "Back in a bubble" has to mean back: fourteen of the balls never left one,
 *  so the ones that DID are tracked and only their return counts. */
function loopMoments(
  g: SynapseGeometry,
  run: SynapseRun,
  cleft: CleftRun,
): {
  caught: number | null
  converted: number | null
  shipped: number | null
  back: number | null
  stocked: number | null
  filling: number | null
} {
  const first = new Map<string, number>()
  const mark = (k: string, ms: number) => {
    if (!first.has(k)) first.set(k, ms)
  }
  const left = new Set<number>()
  for (let ms = 1; ms <= run.windowMs; ms += 0.5) {
    const dots = transmitterCast(g, run, cleft, ms, 0)
    for (const [i, d] of dots.entries()) {
      if (d.where !== 'vesicle') left.add(i)
      const kind = d.glutamine ?? 0
      if (d.where === 'glia') mark('caught', ms)
      if (d.where === 'glia' && kind > 0.5) mark('converted', ms)
      if (d.where === 'shipping') mark('shipped', ms)
      if (d.where === 'terminal' && kind < 0.5) mark('back', ms)
      if (d.where === 'stock') mark('stocked', ms)
      if (d.where === 'vesicle' && left.has(i)) mark('filling', ms)
    }
  }
  const at = (k: string) => first.get(k) ?? null
  return {
    caught: at('caught'),
    converted: at('converted'),
    shipped: at('shipped'),
    back: at('back'),
    stocked: at('stocked'),
    filling: at('filling'),
  }
}

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
  const loop = loopMoments(g, run, cleft)
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
    loop.caught === null
      ? null
      : {
          id: 'caught',
          label: 'caught',
          ms: loop.caught,
          // ⚠ Measured at 17.5 ms — BEFORE the clearing dot, and before the
          // leg the clock names 'caught'. The first ball really is taken in
          // while the gap is still emptying; the leg is where the bulk of it
          // happens. Dated off the picture, like every other dot here.
          note: 'The astrocyte takes the first transmitter in through its EAAT',
        },
    {
      id: 'clearing',
      label: 'clearing',
      ms: 24.5,
      note: 'Calcium is buffered away and the bath settles',
    },
    // ⚠ THE LOOP'S OWN MOMENTS (21c-3m, user: "update timeline with new
    // events"). More than half the run is the glutamate–glutamine cycle and the
    // bar carried no dot past 24.5 ms — the whole second half of the exhibit was
    // undated. Every one of these is READ OFF THE CAST by `loopMoments`, not
    // copied from the constants that schedule it: a dot that agrees with the
    // schedule but not with the picture is what this file's rule about dating
    // events off the run exists to prevent.
    //
    // ⚠ AND THE TIMESCALE IS DECLARED on each of them. Uptake really is
    // milliseconds; the glutamine round trip is seconds to minutes. One screen
    // clock cannot be honest about both, so these ms are choreography and every
    // note says so.
    {
      id: 'calcium-out',
      label: 'calcium out',
      ms: CA_EXTRUDE_FROM_MS,
      note: 'The calcium pumps start: one ion at a time, ATP spent, back out to the gap',
    },
    loop.converted === null
      ? null
      : {
          id: 'converted',
          label: 'glutamine',
          ms: loop.converted,
          note: 'Glutamine synthetase: inside the astrocyte the transmitter flashes and changes kind',
        },
    loop.shipped === null
      ? null
      : {
          id: 'shipped',
          label: 'shipped',
          ms: loop.shipped,
          note: 'Out of the astrocyte and across to the terminal (choreographed: this leg is seconds to minutes)',
        },
    loop.back === null
      ? null
      : {
          id: 'glutamate-again',
          label: 'glutamate',
          ms: loop.back,
          note: 'Glutaminase, inside the terminal: the second flash, and it is transmitter once more',
        },
    loop.stocked === null
      ? null
      : {
          id: 'stocked',
          label: 'the pool',
          ms: loop.stocked,
          note: 'It joins the terminal\u2019s standing pool of glutamate',
        },
    loop.filling === null
      ? null
      : {
          id: 'filling',
          label: 'refilled',
          ms: loop.filling,
          note: 'VGLUT carries the first one back into a rebuilt vesicle, one molecule at a time',
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
/** ⚠ GLUTAMINE'S OWN INK — orange `#fb923c`, chosen by the user from three
 *  candidates and reconciled in 05 before anything was drawn. Its rivals and
 *  why they lost, so this is not re-argued: a PALE TEAL would have said "the
 *  same carbon coming home, changed", which is the true biology — but at dot
 *  size it reads as FADED glutamate, and "this one is running out" is the one
 *  thing it must not say. A ROSE separates best from teal and was refused
 *  because red is + charge. */
export const GLUTAMINE_INK = { light: '#fed7aa', mid: '#fb923c', dark: '#c2410c' }

export const SNARE_STRANDS = ['#f0abfc', '#7dd3fc', '#bef264'] as const

/** ⚠ WHERE THE COMPLEX SITS ON ITS VESICLE, and how long it is along the wall —
 *  ONE decision, shared by D06 and by the scene's miniature (moved here from
 *  `snareScene` on 2026-09-05 so there cannot be two answers).
 *
 *  `SNARE_ANCHOR_A` is the ring angle the v-SNARE's molecule sits at, 1.1 rad
 *  off horizontal — far enough round that the mirrored pair reads as a section
 *  through a ring rather than a tangle. `SNARE_CIS_LEN` is the complex's length
 *  ALONG the wall, in radii.
 *
 *  ⚠ Together they make the rope lie roughly PARALLEL TO THE MEMBRANE (user,
 *  2026-09-05: "adjust snare to be parallel to the membrane and look visually
 *  tied to it"). The scene's miniature used to run a near-vertical rope from
 *  the vesicle's underside straight down to the wall — 0.08 r across against
 *  0.18 r down — which is not what a zippered four-helix bundle looks like and
 *  is not what D06 draws either. At these numbers the run is 0.356 r along the
 *  wall against about 0.11 r down: about 17° off the membrane, the same angle
 *  in both presentations. */
export const SNARE_ANCHOR_A = 1.1
export const SNARE_CIS_LEN = 0.356
const TRANSMITTER_R = 3.2

/** Two `#rrggbb` inks, mixed — so a conversion can be watched happening rather
 *  than switching between frames. Returns a real `#rrggbb`, which is what the
 *  strict test canvas insists on. */
function blendHex(a: string, b: string, t: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  const at = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t)
  const hex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  return `#${hex(at(0))}${hex(at(1))}${hex(at(2))}`
}

/** Every transmitter particle on this canvas goes through here — cargo in the
 *  bubbles and cloud in the gap — so they cannot drift apart. */
export function transmitterDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  /** ⚠ 0 = glutamate, 1 = glutamine, and the fractions between are the
   *  conversion happening on screen (21c-2). The CHANGE OF KIND is the whole
   *  point of the loop's middle, and identity is kept through it: the same
   *  ball, a different molecule — never a ball that vanishes and another that
   *  appears. */
  glutamine = 0,
): void {
  const q = Math.max(0, Math.min(1, glutamine))
  const mix = (a: string, b: string) => (q <= 0 ? a : q >= 1 ? b : blendHex(a, b, q))
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r)
  grad.addColorStop(0, mix(TRANSMITTER_INK.light, GLUTAMINE_INK.light))
  grad.addColorStop(0.55, mix(TRANSMITTER_INK.mid, GLUTAMINE_INK.mid))
  grad.addColorStop(1, mix(TRANSMITTER_INK.dark, GLUTAMINE_INK.dark))
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
  /** The frame this geometry was solved into. */
  width: number
  height: number
  /** ⚠ THE ASTROCYTE'S OWN ROOM, px — the right-hand strip the third cell
   *  claims, which the synapse is NOT solved into (21c-1). Kept on the
   *  geometry so every part that has to stay clear of the astrocyte asks the
   *  same number instead of re-deriving it. */
  astroRoom: number
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

/** ⚠ THE ASTROCYTE'S SHARE OF THE FRAME'S WIDTH (user, 2026-09-04: "move the
 *  whole canvas to the left and place one astrocyte on the right", budget
 *  ruled "about a third, as the screenshot").
 *
 *  ⚠ A BUDGET, NOT A NUDGE (03 → *A layout is SOLVED from a budget*). The
 *  synapse is not translated: the bouton is FITTED into the room that is left
 *  once the astrocyte has taken its strip, so everything solved from the fit —
 *  the active zone, the vesicles, the spine, the cleft — follows without a
 *  single hand-placed offset. What the solve reaches is measured in the tests,
 *  never asserted here. */
export const ASTRO_SHARE = 1 / 3

/** ⚠ THE ROOM IS SOLVED, AND IT CAN BE OVERRULED BY THE OLDER RULE.
 *
 *  Measured when the strip was first taken (21c-1): handing a third of the
 *  width away makes the bouton WIDTH-limited on tall frames, and a
 *  width-limited bouton is too short to put its foot two thirds down — the
 *  user's own 2026-09-01 rule ("the presynaptic bouton occupies two thirds of
 *  the vertical space"). Pushing it down with an offset was rejected: the neck
 *  is cut off at the top edge, so an offset would float the cell below a gap.
 *
 *  So the astrocyte asks for a third and is given whatever is left once the
 *  bouton has the width it needs to satisfy the older rule. A budget that
 *  yields to a standing rule, and the tests measure what it actually got at
 *  every plausible size rather than trusting the fraction. */
export function astroRoomFor(width = SYN_W, height = SYN_H): number {
  // Floor, not round: the share is a CEILING the guards check against, and a
  // rounded-up room would breach it by a pixel at some widths.
  const wanted = Math.floor(width * ASTRO_SHARE)
  // The scale height alone would give, and the width that scale needs — the
  // same two expressions `fitBouton` chooses between, asked here directly.
  const byHeight = (height - NECK_PX - height * (1 - BOUTON_SHARE)) / BULB_BOX.h
  const needs = (BOUTON_BOX.w * byHeight) / 0.86
  return Math.max(0, Math.min(wanted, Math.round(width - needs)))
}

/** ⚠ ONE geometry for the drawing AND the hit tests AND the tests. */
export function synapseGeometry(width = SYN_W, height = SYN_H): SynapseGeometry {
  const astroRoom = astroRoomFor(width, height)
  // ⚠ SOLVED so the FOOT lands two thirds down. The bouton's own height above
  // the foot is `NECK_PX + BULB_BOX.h·k`, so the scale is whatever makes that
  // reach the two-thirds line — the picture is pushed down by growing into the
  // room rather than by being nudged with an offset.
  //
  // ⚠ …and into the WIDTH THAT IS LEFT, which is how the neuron moves left:
  // `fitBouton` centres the bouton in the width it is given, so handing it the
  // synapse's own room puts the cell where it belongs and leaves the strip on
  // the right genuinely empty for the third cell.
  const fit = fitBouton(width - astroRoom, height, {
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
    width,
    height,
    astroRoom,
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

/** ⚠ EXPORTED (21c-4c). The clearance drawer shows retrieval three ways, and
 *  every one of them needs THIS bubble — not a circle that looks like it. A
 *  second private copy of a vesicle is a second copy of every correction ever
 *  made to this one. */
export function vesicle(
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
export function drawPocket(
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
    // ⚠ THE TEAR FOLLOWS THE SAME AGE TOO — a third pass, found by extracting
    // `fusedAgeAt`. Left on the forward age the wall's hole would open and
    // close out of step with the bubble coming home through it.
    const shape = fusedShape(g, d.x, fusedAgeAt(ms, gone), d.r)
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
/** ⚠ WHERE THE 'vesicle' NAME CAN STAND, measured (21c-1). Its box is 77 px
 *  wide and the bath left of the bouton's floor is 87 at the shipping size, so
 *  the anchor is solved from where the floor really starts — asked of the
 *  outline, never assumed — and clamped so the box stays on the page. */
export function vesicleLabelAx(g: SynapseGeometry): number {
  let floorLeft = g.width
  for (let x = 0; x < g.width; x += 2) {
    if (boutonFloorAt(g.fit, x) !== null) {
      floorLeft = x
      break
    }
  }
  // `spoken`'s left-aligned box runs [ax − 26, ax + 6.2·chars + 8].
  const rightOfBox = 6.2 * 'vesicle'.length + 8
  return Math.max(30, floorLeft - 6 - rightOfBox)
}

/** ⚠ WHERE THE 'synaptic cleft' NAME FITS — walked, not chosen (21c-3c). Its
 *  box has to clear the astrocyte, both neurons and the button shelf, and each
 *  new silhouette moves the only free water about. Returns an anchor for
 *  `spoken`, which hangs its box from [ax − 26, ax + 6.2·chars + 8]. */
/** ⚠ WHERE A NAME CAN STAND — walked, not chosen (21c-3d). Shared by the two
 *  labels whose water the astrocyte keeps taking: each new silhouette, and now
 *  each new SCALE, moves what is free. Returns an anchor for `spoken`, whose
 *  box hangs from [ax − 26, ax + 6.2·chars + 8]. */
function labelSeat(
  g: SynapseGeometry,
  term: string,
  spots: [number, number][],
): [number, number] {
  const cell = astrocyteCell(g)
  const w = 6.2 * term.length + 34
  const h = 32
  const clear = (ax: number, ay: number) => {
    for (const cx of [ax - 26, ax - 26 + w]) {
      for (const cy of [ay - 20, ay - 20 + h]) {
        if (cx < 4 || cx > g.width - 4 || cy < 4 || cy > g.height - 4) return false
        if (astroCellHolds(cell, { x: cx, y: cy })) return false
        if (boutonHolds(g, { x: cx, y: cy })) return false
        if (cx < 560 && cy > g.height - 130) return false
        const floor = boutonFloorAt(g.fit, cx)
        if (floor !== null && cy < floor - 2) return false
        if (Math.abs(cx - g.head.cx) < g.head.rx && cy > faceAt(g, cx)) return false
      }
    }
    return true
  }
  for (const [ax, ay] of spots) if (clear(ax, ay)) return [ax, ay]
  return spots[spots.length - 1]
}

/** Where the 'astrocyte' name can stand, and what it points at. */
export function astroLabelAt(g: SynapseGeometry): {
  at: [number, number]
  to: { x: number; y: number }
} {
  const cell = astrocyteCell(g)
  const spots: [number, number][] = []
  for (const y of [40, 70, 110, 150]) {
    for (const x of [g.width - 150, g.width - 260, g.width - 380, 620, 520]) {
      spots.push([x, y])
    }
  }
  const at = labelSeat(g, 'astrocyte', spots)
  // It points at the nearest bit of the cell to wherever it ended up, so the
  // connector is short whichever seat was free.
  let to = cell.onPage
  let best = Infinity
  for (const q of cell.placement.rings.flat()) {
    if (q.x < 0 || q.x > g.width || q.y < 0 || q.y > g.height) continue
    const d = Math.hypot(q.x - at[0], q.y - at[1])
    if (d < best) {
      best = d
      to = q
    }
  }
  return { at, to }
}

export function cleftLabelAt(g: SynapseGeometry): [number, number] {
  const cell = astrocyteCell(g)
  const w = 6.2 * 'synaptic cleft'.length + 34
  const h = 32
  const clear = (ax: number, ay: number) => {
    const box = { x: ax - 26, y: ay - 20 }
    for (const cx of [box.x, box.x + w]) {
      for (const cy of [box.y, box.y + h]) {
        if (cx < 4 || cx > g.width - 4 || cy < 4 || cy > g.height - 4) return false
        if (astroCellHolds(cell, { x: cx, y: cy })) return false
        if (boutonHolds(g, { x: cx, y: cy })) return false
        if (cx < 560 && cy > g.height - 130) return false
        const floor = boutonFloorAt(g.fit, cx)
        if (floor !== null && cy < floor - 2) return false
        if (Math.abs(cx - g.head.cx) < g.head.rx && cy > faceAt(g, cx)) return false
      }
    }
    return true
  }
  const gapY = g.foot.y + CLEFT_PX
  for (const dy of [155, 120, 190, 90, 220]) {
    for (const dx of [160, 200, 250, 120, 300, 90]) {
      const ax = g.foot.x + g.activeHalf + dx
      if (clear(ax, gapY + dy)) return [ax, gapY + dy]
    }
  }
  return [g.foot.x + g.activeHalf + 160, gapY + 155]
}

export function synapseCallouts(
  g: SynapseGeometry,
): { label: SpokenLabel; to: { x: number; y: number } }[] {
  const d0 = activeZone(g).docked[0]
  const edgeX = g.foot.x + g.activeHalf
  const gapMid = wallAt(g, edgeX) + CLEFT_PX * 0.5
  return [
    {
      // ⚠ SOLVED OFF THE BULB'S OWN FLOOR, not off the active zone (21c-1).
      // With the synapse fitted into two thirds of the frame the left bath is
      // thin — the old constant offset put this box 55 px OFF the page — so the
      // name is seated against where the bouton's floor actually begins, and
      // the answer is measured, not assumed. Room left at 1060×660: 87 px, and
      // the box is 77 wide, so this is very nearly the only place it fits.
      label: spoken('vesicle', vesicleLabelAx(g), g.foot.y - vesicleR(g) * 5.2),
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
      // ⚠ SOLVED, not seated (21c-3c). It had been placed in the open bath to
      // the lower right — which is where the second astrocyte handover's arms
      // now are. Candidates are walked and the first clear of the cell, both
      // neurons and the shelf is taken, so the next silhouette cannot land on
      // it either.
      label: spoken('synaptic cleft', ...cleftLabelAt(g), 'left'),
      to: { x: edgeX - 20, y: gapMid },
    },
    {
      // ⚠ ON THE VISIBLE INK (21c-1a). The body sits off the top-right corner
      // by design, so the name cannot point at the soma — it would point off
      // the page. It aims at the mean of the cell's on-page ink instead, with
      // the box below-left of it in open water.
      // ⚠ SOLVED (21c-3d): the cell is drawn smaller now so that its shape can
      // be recognised, which means MORE of it is on the page — and the seat
      // that used to be open bath is inside it.
      label: spoken('astrocyte', ...astroLabelAt(g).at, 'left'),
      to: astroLabelAt(g).to,
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
  ctx.fillStyle = fadeStops(ASTRO_INK, 0.12, 0)
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

/** ⚠ IS THIS POINT INSIDE THE BOUTON? The bouton's own traced outline, asked
 *  as a polygon — not "above the floor", which is what a first version of the
 *  astrocyte's overlap guard used and which is WRONG at the bulb's flanks: at
 *  the outline's extreme right the floor and the roof nearly meet, so a point
 *  beside the cell counted as a point over it (measured: 228 px of phantom
 *  overlap). The floor helper answers "where is the wall under this x"; only
 *  the closed outline answers "is this inside". */
const BOUTON_RING_CACHE = new WeakMap<BoutonFit, { x: number; y: number }[]>()

/** The bouton's outline in canvas pixels — one flattening, cached, shared by
 *  the hit test and by everything that has to sit ON the membrane. */
export function boutonRing(g: SynapseGeometry): { x: number; y: number }[] {
  let ring = BOUTON_RING_CACHE.get(g.fit)
  if (!ring) {
    ring = flattenPath(BOUTON_SEGS, 12).map((p) => place(g.fit, p.x, p.y))
    BOUTON_RING_CACHE.set(g.fit, ring)
  }
  return ring
}

export function boutonHolds(g: SynapseGeometry, q: { x: number; y: number }): boolean {
  const ring = boutonRing(g)
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (a.y > q.y !== b.y > q.y) {
      const t = (q.y - a.y) / (b.y - a.y || 1e-12)
      if (q.x < a.x + t * (b.x - a.x)) inside = !inside
    }
  }
  return inside
}

// ── the astrocyte on the right (21c-1, re-drawn 21c-1a) ─────────────────────
//
// ⚠ ONE CELL, NOT TWO FINGERS (user, 2026-09-04: "instead of displaying two
// astrocyte fingers, move the whole canvas to the left and place one astrocyte
// on the right, in a view which makes clear that this is an astrocyte").
// Reverses the two-finger ruling, which had already needed one correction of
// its own (21b-1a: the fingers read as a second postsynaptic specialization).
// It is also the better anatomy — a real astrocyte's coverage of a synapse is
// partial and asymmetric, roughly half the perimeter and often one side.
//
// ⚠ AND ONE OUTLINE, NOT TWELVE (user, 2026-09-05: "the reason why I suggested
// you svg is that you could trace the outline to avoid part overlayed. The
// seams are too obvious. Re-draw"). The first pass built the cell from the
// app's star glyph and stroked each process as its own tube; every junction
// showed one tube's membrane crossing the inside of another. N stroked shapes
// have N outlines and a cell has ONE, so the silhouette is now the handover's
// own traced path (`astrocyteShape.ts`), filled once and stroked once. There
// is no interior edge left to see.

/** ⚠ WHERE THE BODY GOES, in the astrocyte's own room — measured, not chosen.
 *
 *  Off the frame's TOP-RIGHT corner, which is the screenshot's composition and
 *  the only placement that keeps the cell off both neurons: the bouton lies up
 *  and to the left of the synapse, so a body level with the cleft throws arms
 *  across it, and a body above the corner fans them DOWN-left, into the gap.
 *  ⚠ BROUGHT BACK ONTO THE PAGE (user, 2026-09-05: "the astrocyte body should
 *  be a bit more visible"). It could be, because the overlap test that pushed
 *  it off the corner in the first place was WRONG: it asked "is this point
 *  above the bouton's floor", which at the bulb's extreme flanks says yes for
 *  points BESIDE the cell — 228 px of phantom overlap. Asked properly, with
 *  `boutonHolds` on the closed outline, the body can sit at the frame's right
 *  edge with nothing inside either neuron. Measured at 1060×660: the body's
 *  own on-page share goes 14% → 36%, the whole cell 14% → 32%, and the count
 *  of outline points inside the bouton or the spine stays ZERO. Dropping it
 *  further, level with the cleft, really does cross them (25 in the bouton,
 *  117 in the spine) — so the rule that put it high is real, just not as
 *  strict as the broken measurement made it look. */
// ⚠ RE-SOLVED FOR THE SECOND HANDOVER (21c-3c). Its arms fan more widely than
// the first file's, so the placement that suited that one put processes across
// the neurons. Swept at both plausible frame sizes: this is the seat that keeps
// ZERO cell ink on either neuron at 1060×660 and 1440×1080, with 36% / 45% of
// the (already cropped) cell on the page.
const ASTRO_SOMA_OUT = 0.25
const ASTRO_SOMA_RISE = 0.6

/** The scales the solve walks, smallest first, and the lifts it may pair with
 *  each — two degrees of freedom, because shrinking along the body's own line
 *  brings the cell closer in, and that is the move that swings a process over
 *  the bouton. */
const ASTRO_TRIALS = [0.55, 0.62, 0.7, 0.78, 0.86, 0.94]
const ASTRO_LIFTS = [0, -0.18, -0.34, 0.14]

export interface AstroCell {
  /** The body's centre — off the page, by design. */
  soma: { x: number; y: number }
  /** Where the cell's reaching process ends: the cleft's own mouth. */
  reach: { x: number; y: number }
  /** The traced silhouette, placed. */
  placement: AstroPlacement
  /** The transporter ticks on the reaching tip — the only doors the collected
   *  balls may cross this membrane at. */
  ticks: { x: number; y: number }[]
  /** ⚠ WHERE A BALL WAITS BEFORE EACH DOOR, index-matched to `ticks`. Solved
   *  once per cell (21c-3h): walked out from the door until the point AND the
   *  whole line to it from the cleft's mouth are clear of the cell, so the
   *  approach cannot clip a process on its way in. It was being solved per ball
   *  per frame, which timed the continuity walk out. */
  holds: { x: number; y: number }[]
  /** Seeded resting spots, every one of them MEASURED to be inside the traced
   *  outline — so a caught ball cannot come to rest outside the cell. */
  pockets: { x: number; y: number }[]
  /** Which of `ASTRO_TRIALS` the solve settled on. */
  fit: number
  /** ⚠ Whether a cell 15% smaller would ALSO have satisfied every criterion —
   *  the claim "as small as the channels allow", made checkable. False is the
   *  correct answer; the guard asks for it. */
  smallerFits: boolean
  /** ⚠ A point ON THE VISIBLE PART of the cell — the mean of its on-page ink.
   *  The body is off the corner by design, so a name pointing at `soma` would
   *  point off the page; this is what the callout aims at instead. */
  onPage: { x: number; y: number }
}

/** ⚠ SOLVED FROM THE ROOM, never placed by eye. The body is put off the
 *  top-right corner and one of the cell's OWN arm tips is carried onto the
 *  gap's mouth by a similarity — a rotation and a scale, which cannot bend the
 *  outline, so the shape on screen is the shape in the file. */
/** ⚠ MEMOISED PER GEOMETRY, like the active zone's own cache. The traced
 *  silhouette is 4,400 points and the pockets are measured against it; the
 *  cast asks for this cell once per ball per frame, and computing it there
 *  timed the run out. The geometry is the identity of the answer, so the cache
 *  is keyed on it and cannot go stale. */
const ASTRO_CACHE = new WeakMap<SynapseGeometry, AstroCell>()

export function astrocyteCell(g: SynapseGeometry): AstroCell {
  const hit = ASTRO_CACHE.get(g)
  if (hit) return hit
  const built = buildAstrocyteCell(g)
  ASTRO_CACHE.set(g, built)
  return built
}

function buildAstrocyteCell(g: SynapseGeometry): AstroCell {
  const edgeX = g.foot.x + g.activeHalf
  const mouth = { x: edgeX + 18, y: wallAt(g, edgeX) + CLEFT_PX * 0.5 }
  const far = {
    x: g.width + g.astroRoom * ASTRO_SOMA_OUT,
    y: mouth.y - g.astroRoom * ASTRO_SOMA_RISE,
  }
  // ⚠ THE SMALLEST CELL THE CHANNELS STILL FIT IN (21c-3d, user: "astrocyte is
  // now scaled up too much, child can not recognise its shape. Scale down as
  // much as possible without breaking channels visualisation").
  //
  // The scale is not a constant to tune — it is the answer to a question the
  // drawing can be asked. Walking the body in along its own direction shrinks
  // the whole cell, and the trials run from small to large so the FIRST one
  // that fits wins.
  //
  // Three things bound it. ⚠ MEASURED, the binding two are the FRAME and the
  // NEURONS: the file's straight crop edges are its own boundary and not the
  // world's, so they have to stay out of shot, and a smaller cell sits closer
  // in, which is the move that swings a process over the bouton. The DOOR
  // requirement — a channel stands `CHANNEL_SPAN` across the wall, so its
  // process must be wider than that — is kept and checked, but at these sizes
  // it never binds: removing it changes nothing, which was verified by removing
  // it. Said plainly because the first version of this comment claimed the door
  // was the limit, and it is not.
  const dir = Math.atan2(far.y - mouth.y, far.x - mouth.x)
  const reachFar = Math.hypot(far.x - mouth.x, far.y - mouth.y)
  const need = CHANNEL_SPAN * 1.35
  // ⚠ TWO DEGREES OF FREEDOM, not one. Shrinking straight down the body's own
  // line brings the cell closer in, which is exactly the move that swings a
  // process over the bouton — so at every size the body may also be lifted a
  // little, and the pair is searched together. Measured before this: the
  // shrink was blocked by overlap at every scale and the cell stayed big.
  const trial = (f: number, lift: number) => {
    const a = dir + lift
    const at = {
      x: mouth.x + Math.cos(a) * reachFar * f,
      y: mouth.y + Math.sin(a) * reachFar * f,
    }
    return { soma: at, placement: placeAstro(at, mouth) }
  }
  const doorRoom = (pl: AstroPlacement) => {
    let worst = Infinity
    for (const d of [16, 44]) {
      const want = { x: mouth.x + Math.cos(dir) * d, y: mouth.y + Math.sin(dir) * d }
      let door = pl.rings[0][0]
      let bd = Infinity
      for (const ring of pl.rings) {
        for (const q of ring) {
          const dd = Math.hypot(q.x - want.x, q.y - want.y)
          if (dd < bd) {
            bd = dd
            door = q
          }
        }
      }
      let best = 0
      for (let ang = 0; ang < Math.PI; ang += Math.PI / 16) {
        let run = 0
        for (let o = 2; o < 140; o += 2) {
          const q = { x: door.x + Math.cos(ang) * o, y: door.y + Math.sin(ang) * o }
          if (astroContains(pl, q)) run = o
          else break
        }
        best = Math.max(best, run)
      }
      worst = Math.min(worst, best)
    }
    return worst
  }
  // ⚠ …and it must still be clear of both neurons. A smaller cell sits closer
  // in, so shrinking it is exactly the move that can put a process across the
  // bouton — measured, at (614, 185). Every criterion the full-size placement
  // had to meet, each trial has to meet too.
  const clearOfCells = (pl: AstroPlacement) => {
    for (const q of pl.rings.flat()) {
      if (q.x < 0 || q.x > g.width || q.y < 0 || q.y > g.height) continue
      if (boutonHolds(g, q)) return false
      if (q.x > g.head.cx - g.head.rx && q.x < g.head.cx + g.head.rx && q.y > faceAt(g, q.x)) {
        return false
      }
    }
    return true
  }
  // ⚠ AND THE FILE'S CROP EDGES MUST STAY OUT OF SHOT. `astrocyte-thick.svg` is
  // a quarter of a cell with straight cut edges along its top and right; those
  // are the FILE's boundary, not the world's, so if they come into frame the
  // picture has invented a surface. The placed shape therefore has to overflow
  // the frame on both of those sides.
  const offPage = (pl: AstroPlacement) => {
    const pts = pl.rings.flat()
    return (
      Math.max(...pts.map((q) => q.x)) > g.width + 40 && Math.min(...pts.map((q) => q.y)) < -20
    )
  }
  // ⚠ ONE PREDICATE, asked by the solver and by the guard alike — so "as small
  // as the channels allow" is a claim that can be checked rather than asserted.
  const fits = (pl: AstroPlacement) =>
    offPage(pl) && doorRoom(pl) >= need && clearOfCells(pl)
  let chosen = trial(1, 0)
  let fit = 1
  let found = false
  for (const f of ASTRO_TRIALS) {
    for (const lift of ASTRO_LIFTS) {
      const t = trial(f, lift)
      if (!fits(t.placement)) continue
      chosen = t
      fit = f
      found = true
      break
    }
    if (found) break
  }
  const soma = chosen.soma
  const placement = chosen.placement
  const smallerFits = fits(trial(fit * 0.85, 0).placement)
  // ⚠ THE TICKS ARE POINTS OF THE OUTLINE, not points along a line back from
  // the tip (fixed 21c-2). Stepped back along the straight line to the body
  // they fell OUTSIDE the wavy process — measured — and a door outside the
  // membrane is exactly how a ball comes to cross the wall instead of the
  // hole. Asked of the silhouette, they are always in the wall.
  const th = Math.atan2(soma.y - mouth.y, soma.x - mouth.x)
  // ⚠ A DOOR HAS TO BE REACHABLE FROM THE GAP (21c-3h). Chosen only for being
  // near the wanted spot, an intake door can sit where the straight line from
  // the cleft's mouth to anywhere outside it crosses the BOUTON — and then the
  // ball swims through the terminal on its way to the glia, which is what was
  // measured (in at (616, 324), out at (635, 260)). No holding point can rescue
  // a door like that, so reachability is part of choosing it, exactly as it is
  // for the exit door.
  const approachOf = (q: { x: number; y: number }) => {
    for (let by = 22; by <= 96; by += 8) {
      const cand = outsideOn(placement, q, by)
      if (astroContains(placement, cand) || boutonHolds(g, cand)) continue
      let clean = true
      for (let k = 1; k < 16 && clean; k++) {
        const m = {
          x: mouth.x + (cand.x - mouth.x) * (k / 16),
          y: mouth.y + (cand.y - mouth.y) * (k / 16),
        }
        if (astroContains(placement, m) || boutonHolds(g, m)) clean = false
      }
      if (clean) return cand
    }
    return null
  }
  const near = (want: { x: number; y: number }, skip: { x: number; y: number }[]) => {
    const sorted = placement.rings
      .flat()
      .filter((q) => !skip.some((sp) => Math.hypot(q.x - sp.x, q.y - sp.y) < 14))
      .sort(
        (a, b) =>
          Math.hypot(a.x - want.x, a.y - want.y) - Math.hypot(b.x - want.x, b.y - want.y),
      )
    for (const q of sorted.slice(0, 400)) {
      if (approachOf(q)) return q
    }
    return sorted[0] ?? mouth
  }
  const wantAt = (d: number) => ({
    x: mouth.x + Math.cos(th) * d,
    y: mouth.y + Math.sin(th) * d,
  })
  // ⚠ AND THEN PUSHED OUT ONTO THE DRAWN BOUNDARY (21c-3a). The trace is the
  // fattened process's CENTRELINE, so a door left on it sits in the middle of
  // the cytoplasm; `outwardOn` carries it to the wall the child can see.
  const t0 = outwardOn(placement, near(wantAt(16), []))
  const ticks = [t0, outwardOn(placement, near(wantAt(44), [t0]))]
  // ⚠ THE POCKETS ARE MEASURED, NOT TRUSTED. Walking in from the tip toward the
  // body and trying a few offsets either side, every candidate is put to
  // `astroContains` and only the ones really inside the traced outline are
  // kept. A wavy process cannot be approximated by the straight line to its
  // body, so asking the shape is the only honest way to stay inside it.
  const reachLen = Math.hypot(soma.x - mouth.x, soma.y - mouth.y)
  const nx = -Math.sin(th)
  const ny = Math.cos(th)
  // ⚠ WITH A MARGIN, not merely inside (21c-1b). A resting ball wears the
  // scene's thermal wobble — about ±2 px — so a pocket that only just clears
  // the outline lets the ball breathe straight through the membrane, which is
  // how a caught ball came to be measured outside the cell at (646, 363). Each
  // candidate must survive a probe at ±`margin` in both axes; the margin is
  // relaxed only if the process at hand is genuinely too thin to hold one.
  const gather = (margin: number, want = WANT_ROOM): { x: number; y: number }[] => {
    const found: { x: number; y: number }[] = []
    for (let i = 1; i <= 90 && found.length < 40; i++) {
      const d = (i / 90) * reachLen * 0.55
      const base = wantAt(d)
      // ⚠ CENTRED IN THE PROCESS, not merely inside it (21c-3h, user: "the
      // gathering on the top of the finger touching the membrane. Expected
      // there should be in the center of the finger"). The walk is along the
      // straight line from the mouth toward the body, and a process CURVES away
      // from that line — so the first offset that happened to be inside was
      // usually the one nearest the wall it curved toward. Each candidate is
      // now walked out to both walls and put at the midpoint between them.
      for (const off of [0, 6, -6, 12, -12, 18, -18]) {
        const seed = { x: base.x + nx * off, y: base.y + ny * off }
        if (seed.x < 0 || seed.x > g.width || seed.y < 0 || seed.y > g.height) continue
        if (!astroContains(placement, seed)) continue
        let up = 0
        for (let o = 1; o < 90; o += 1) {
          if (astroContains(placement, { x: seed.x + nx * o, y: seed.y + ny * o })) up = o
          else break
        }
        let down = 0
        for (let o = 1; o < 90; o += 1) {
          if (astroContains(placement, { x: seed.x - nx * o, y: seed.y - ny * o })) down = o
          else break
        }
        const mid = (up - down) / 2
        const q = { x: seed.x + nx * mid, y: seed.y + ny * mid }
        const clear =
          astroContains(placement, q) &&
          astroContains(placement, { x: q.x + margin, y: q.y }) &&
          astroContains(placement, { x: q.x - margin, y: q.y }) &&
          astroContains(placement, { x: q.x, y: q.y + margin }) &&
          astroContains(placement, { x: q.x, y: q.y - margin })
        // ⚠ AND IT MUST HAVE ROOM ROUND IT (21c-3h). Centred is not the same as
        // roomy: on a narrow stretch the midpoint is still only a few pixels
        // from both walls, and a ball is 3.2 px in the radius. Candidates that
        // cannot clear a ball's width in every direction are passed over, so
        // the resting spots land where the process is wide.
        if (clear && hasRoom(placement, q, want)) {
          found.push(q)
          break
        }
      }
    }
    return found
  }
  // ⚠ AND THE CHAIN BETWEEN THEM MUST BE INSIDE TOO (21c-2). Each pocket being
  // inside is not enough: consecutive pockets sit at different offsets across a
  // wavy process, so the straight segment joining two of them can leave the
  // cell and come back — measured, as a ball crossing the outline 82 px from
  // any door. A pocket is kept only if the whole segment from the last kept one
  // stays inside, which makes the chain a path a ball can travel without ever
  // leaving the cytoplasm.
  const chained = (raw: { x: number; y: number }[]) => {
    const kept: { x: number; y: number }[] = []
    for (const q of raw) {
      const last = kept[kept.length - 1]
      if (last) {
        let ok = true
        for (let t = 1; t < 12 && ok; t++) {
          const m = {
            x: last.x + (q.x - last.x) * (t / 12),
            y: last.y + (q.y - last.y) * (t / 12),
          }
          if (!astroContains(placement, m)) ok = false
        }
        if (!ok) continue
      }
      kept.push(q)
    }
    return kept
  }
  // ⚠ AND NOT UNDER A DRAWN CHANNEL (21c-3g, user: "when they are inside the
  // finger, they overlap the channels"). A door is a protein standing across
  // the wall and reaching `CHANNEL_SPAN` into the cytoplasm; a resting spot
  // inside that footprint puts a ball on top of it. The pockets are gathered
  // along the process without knowing where the doors are, so they are filtered
  // by them afterwards.
  const doorsOf = [...ticks]
  const clearOfDoors = (raw: { x: number; y: number }[]) =>
    raw.filter((q) => !doorsOf.some((t) => Math.hypot(q.x - t.x, q.y - t.y) < CHANNEL_SPAN * 0.85))
  let pockets = chained(clearOfDoors(gather(4)))
  if (pockets.length < 6) pockets = chained(clearOfDoors(gather(4, WANT_ROOM * 0.6)))
  if (pockets.length < 8) pockets = chained(clearOfDoors(gather(2.5)))
  if (pockets.length < 8) pockets = chained(clearOfDoors(gather(1)))
  if (pockets.length < 4) pockets = chained(gather(1))
  const seen = placement.rings
    .flat()
    .filter((q) => q.x >= 0 && q.x <= g.width && q.y >= 0 && q.y <= g.height)
  const onPage = seen.length
    ? {
        x: seen.reduce((t, q) => t + q.x, 0) / seen.length,
        y: seen.reduce((t, q) => t + q.y, 0) / seen.length,
      }
    : mouth
  // ⚠ CLEAR OF BOTH CELLS, not just this one (21c-3h). Walking the holding
  // point further out to dodge the astrocyte walked it straight through the
  // BOUTON instead — measured, ball 18 passing into the terminal at (616, 324)
  // on its way to a glial door and out again at (635, 260). A guard that names
  // one cell moves the fault to the other, and so does a solve.
  const holds = ticks.map((t) => approachOf(t) ?? outsideOn(placement, t, 26))
  return { soma, reach: mouth, placement, ticks, holds, pockets, onPage, fit, smallerFits }
}

/** Whether a resting ball fits here with `want` px of clearance all round. */
function hasRoom(pl: AstroPlacement, q: { x: number; y: number }, want: number): boolean {
  // ⚠ A YES/NO, not a measurement. Measuring the exact clearance in every
  // direction ran a million containment tests per cell and timed the suite out;
  // what the gather actually needs is whether a ball fits, so it asks that and
  // gives up on the first direction that says no.
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    for (let o = 3; o <= want; o += 3) {
      if (!astroContains(pl, { x: q.x + dx * o, y: q.y + dy * o })) return false
    }
  }
  return true
}

/** ⚠ How much room a resting ball wants, px: its own radius and a little. */
const WANT_ROOM = 9

/** ⚠ A POINT JUST INSIDE A DOOR, on the pore's own axis (21c-3g, user: "the
 *  path crosses the sides of the channels"). A ball that arrives at the door
 *  and then heads straight for its resting pocket leaves the barrel sideways —
 *  through a subunit, not through the opening. Stepping in along the same line
 *  it came in on carries it clear of the protein before it turns. */
export function insideDoor(
  c: AstroCell,
  door: { x: number; y: number },
  by = CHANNEL_SPAN * 0.75,
): { x: number; y: number } {
  const out = outsideOn(c.placement, door, by)
  return { x: door.x - (out.x - door.x), y: door.y - (out.y - door.y) }
}

/** Whether a point lies INSIDE the cell — the DECISION the collected balls are
 *  guarded by, asked of the traced outline itself. */
export function astroCellHolds(c: AstroCell, p: { x: number; y: number }): boolean {
  return astroContains(c.placement, p)
}

/** A resting spot INSIDE the cell, seeded per ball — chosen from the measured
 *  pockets, so it cannot land outside the membrane the ball entered. */
export function astroCellRest(
  c: AstroCell,
  h1: number,
  h2: number,
): { x: number; y: number } {
  if (!c.pockets.length) return c.reach
  // ⚠ ON THE CHAIN, BETWEEN ADJACENT POCKETS (21c-3a). It used to average two
  // pockets picked by two separate seeds — and the midpoint of two arbitrary
  // points on a wavy process is not on the process at all. That is where the
  // resting balls that appeared to cross the membrane were coming from: they
  // were resting outside it. Only the segment between NEIGHBOURS is guaranteed
  // inside — that is exactly what the chain check established — so the resting
  // spot is a point along one of those segments.
  const span = c.pockets.length - 1
  if (span <= 0) return c.pockets[0]
  const at = Math.min(span - 1e-9, (0.1 + h1 * 0.8) * span)
  const i = Math.floor(at)
  const f = at - i
  const a = c.pockets[i]
  const b = c.pockets[i + 1]
  // A small nudge along the same segment, so two balls on one segment do not
  // sit on top of each other — still on the segment, so still inside.
  const g2 = Math.min(1, Math.max(0, f + (h2 - 0.5) * 0.25))
  return { x: a.x + (b.x - a.x) * g2, y: a.y + (b.y - a.y) * g2 }
}

/** ⚠ THE ASTROCYTE'S MEMBRANE BAND, in one place so the drawing and the guard
 *  cannot disagree about it (21c-3a).
 *
 *  The bug it comes from: the first fattening laid the bands down as W+MEM,
 *  W+0.42·MEM, W−1.4·MEM, which makes the OILY CORE three times thicker than
 *  the leaflet — so a process came out a solid dark rod instead of a wall with
 *  cytoplasm inside it (user: "they do not look hollow"). A thin leaflet, a
 *  thinner core just inside it, and all the rest cytoplasm, as every other
 *  membrane in this frame is drawn. */
export const ASTRO_BAND = { leaf: MEM_PX * 0.55, core: MEM_PX * 0.3 }

/** ⚠ THE ASTROCYTE IS DRAWN IN ONE INK (21c-3b, user: "the inner outline looks
 *  like there's bilayer inside a cell. Also, the outline color has to be
 *  unified with the body color. Currently it looks layered with different
 *  colors").
 *
 *  Reverses the 2026-09-05 "pave it — membrane bands on the outline" ruling,
 *  and for a reason that only appeared once the cell was fattened: the slate
 *  LEAFLET/CORE bands are right on a wall seen edge-on, but wrapped round a fat
 *  process they read as a SECOND MEMBRANE running inside the cell. The wall and
 *  the cytoplasm are now the same hue at two strengths — one cell, one colour,
 *  a darker edge and a lighter middle — which is what a cell drawn at a
 *  magnification where its bilayer is not resolvable should look like.
 *  (03 → *Level of detail cuts BOTH ways*: draw less than the app owns when
 *  the detail would mislead.) */
export const ASTRO_EDGE_ALPHA = 0.62
export const ASTRO_BODY_ALPHA = 0.2

/** ⚠ THE THIRD CELL, TRACED ONCE AND PAVED LIKE EVERY OTHER CELL IN THE FRAME.
 *
 *  The handover is a solid silhouette; the bouton and the spine beside it are
 *  membranes, and an astrocyte drawn as a filled blob would be the only object
 *  on screen without one — which quietly says it is a different kind of thing,
 *  not a different cell. So the ONE traced path is filled with the glial wash
 *  and then stroked twice, outer leaflet and oily core, exactly as the walls
 *  are. One path means one membrane: no junction, no seam.
 *
 *  ⚠ The fade lives in the gradients, never in `globalAlpha` — this view shares
 *  a Konva layer, and a drawing that assigns alpha wipes its caller's
 *  (03 → *A fade must be a property of the surface*). */
/** ⚠ THE ASTROCYTE'S OWN BILAYER (21c-4b, user: "give astrocytes bilayer").
 *
 *  It had a wall — a leaflet band and a core band stroked round its traced
 *  boundary — while every other membrane in this frame is PAVED with the app's
 *  own phospholipids at this depth. Two materials for one thing: the bouton's
 *  wall was made of molecules and the astrocyte's was made of paint.
 *
 *  So its outline is walked at the lipids' own spacing and handed to the very
 *  paver the bouton, the spine and the vesicles use. ⚠ MEMOISED, and clipped to
 *  the frame: the traced cell is long, and molecules off the page cost the same
 *  as molecules on it.
 *
 *  ⚠ The inward side is decided ONCE PER RING by asking the cell's own
 *  `astroContains`, not per molecule: the trace is two closed rings and their
 *  winding is whatever the illustrator drew, so a normal taken on faith comes
 *  out inside-out on one of them — and a bilayer laid inside-out is a wall with
 *  its heads in the oil. */
const ASTRO_LIPIDS = new WeakMap<SynapseGeometry, WallPoint[]>()

export function astroLipids(g: SynapseGeometry): WallPoint[] {
  const hit = ASTRO_LIPIDS.get(g)
  if (hit) return hit
  const c = astrocyteCell(g)
  const step = ZONE_LIPID.headR * 2 * 1.25
  const reach = g.activeHalf * 1.1
  const near = (x: number, y: number) =>
    c.ticks.some((t) => Math.hypot(t.x - x, t.y - y) < reach)
  const out: WallPoint[] = []
  for (const ring of flattenSubpaths(ASTRO_SVG_SEGS, 10)) {
    const pts = ring.map((p) => c.placement.map(p.x, p.y))
    if (pts.length < 3) continue
    // Which way is in, asked once of the shape itself.
    let sign = 1
    for (const [i, p] of pts.entries()) {
      const q = pts[(i + 1) % pts.length]
      const tx = q.x - p.x
      const ty = q.y - p.y
      const n = Math.hypot(tx, ty)
      if (n < 1e-6) continue
      const probe = { x: p.x - (ty / n) * 3, y: p.y + (tx / n) * 3 }
      sign = astroContains(c.placement, probe) ? 1 : -1
      break
    }
    let carry = 0
    for (const [i, p] of pts.entries()) {
      const q = pts[(i + 1) % pts.length]
      const tx = q.x - p.x
      const ty = q.y - p.y
      const len = Math.hypot(tx, ty)
      if (len < 1e-9) continue
      let at = step - carry
      while (at <= len) {
        const f = at / len
        const x = p.x + tx * f
        const y = p.y + ty * f
        // ⚠ THE STRETCH THE EXHIBIT IS ABOUT, not the whole cell — the very
        // budget the bouton's own wall is paved on (`membraneLipids` paves
        // `activeHalf × 1.25`, not the whole bulb). Measured: the whole
        // outline is 2,563 molecules and takes a frame from 3,800 canvas calls
        // to 74,816. Round the doors it is a tenth of that, and it is the part
        // the child is looking at.
        if (x > -20 && x < g.width + 20 && y > -20 && y < g.height + 20 && near(x, y)) {
          out.push({
            at: { x, y },
            tangent: { x: tx / len, y: ty / len },
            inward: { x: (-ty / len) * sign, y: (tx / len) * sign },
          })
        }
        at += step
      }
      carry = (carry + len) % step
    }
  }
  ASTRO_LIPIDS.set(g, out)
  return out
}

export function drawAstrocyte(
  ctx: CanvasRenderingContext2D,
  g: SynapseGeometry,
  /** ⚠ How resolved the picture is — 1 when the camera has dived to the zone.
   *  Its molecules appear on the SAME gate the bouton's and the spine's do:
   *  level of detail dissolves, and it must dissolve for every wall at once or
   *  one cell is made of molecules while its neighbour is made of paint. */
  depth = 0,
  /** The thermal clock, shared with every other wall in the frame (21c-8). */
  clockMs = 0,
): void {
  const c = astrocyteCell(g)
  const trace = () => {
    ctx.beginPath()
    tracePath(ctx, ASTRO_SVG_SEGS, (x, y) => c.placement.map(x, y))
    ctx.closePath()
  }
  // ⚠ THE BODY STAYS VISIBLE (21c-3f, user: "astrocyte fades out on the right
  // side, make its body visible"). The fade was written when the cell's body
  // was off the corner and only its arms were on the page — dissolving toward
  // the soma then meant dissolving toward nothing. The cell has since been
  // scaled down so its SHAPE can be recognised, which brought the body into
  // frame, and the same gradient now rubs out the very thing it was scaled down
  // to show. It fades only across the last stretch before the frame's edge,
  // where the cell really is leaving the picture.
  const edge = { x: g.width + 40, y: c.soma.y }
  const fade = (rgb: string, near: number) => {
    const grad = ctx.createLinearGradient(c.reach.x, c.reach.y, edge.x, edge.y)
    grad.addColorStop(0, `rgba(${rgb}, ${near})`)
    grad.addColorStop(0.88, `rgba(${rgb}, ${near})`)
    grad.addColorStop(1, `rgba(${rgb}, 0)`)
    return grad
  }
  // ⚠ THE CELL IS DRAWN FATTER THAN ITS TRACE (21c-3, user: "the fingers look
  // much thicker so that it's easier to visualize glutamate going through the
  // finger"). A dilation IS a wide stroke, so the drawing gets it for free:
  // the outline is stroked at twice the dilation in the leaflet's ink, then
  // narrower in the core's, then narrower again in the cytoplasm's — the same
  // three bands every wall in this frame wears, laid around the same star.
  // Nothing about the silhouette changes; it is the same shape, thicker.
  // ⚠ AND IT MUST READ HOLLOW (21c-3a, user: "astrocyte redraw looks good, but
  // now they do not look hollow, fix it"). The first fattening laid the bands
  // down as W+MEM, W+0.42·MEM, W−1.4·MEM — which makes the OILY CORE three
  // times thicker than the leaflet, so a process came out a solid dark rod
  // instead of a wall with cytoplasm inside it. The bands are now proportioned
  // the way every other membrane in this frame is: a thin leaflet, a thinner
  // core just inside it, and all the rest cytoplasm.
  // ⚠ THE TRACE IS THE BOUNDARY NOW, not a centreline (21c-3c). The second
  // handover is drawn already thick, so the cell is what a traced cell should
  // be: FILLED with its cytoplasm and STROKED once round its edge. The
  // dilation — and the layered strokes that stood in for a fat body — are
  // gone with the first handover they were invented for.
  //
  // One ink, two strengths: the wall is the same green as the cytoplasm, only
  // stronger, so the edge reads as this cell's edge and not as a membrane
  // wrapped round the inside of it (the 21c-3b ruling, unchanged).
  // ⚠ AND IT HAS A MEMBRANE (21c-3d, user: "give astrocyte membrane"). The
  // 21c-3b ruling — one ink, no bands — was about the FIRST handover, where the
  // trace was a fat process's CENTRELINE and a band wrapped round it read as a
  // bilayer running inside the cell. That is no longer the situation: the
  // second handover's trace is the cell's real boundary, so a band laid on it
  // is a wall in exactly the place the bouton's and the spine's are. It is the
  // same LEAFLET/CORE the rest of the frame wears, over the cell's own
  // cytoplasm — one biology, one drawing.
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  trace()
  ctx.fillStyle = fade(ASTRO_INK, ASTRO_BODY_ALPHA)
  ctx.fill()
  trace()
  ctx.strokeStyle = fade('203, 213, 225', 0.85)
  ctx.lineWidth = MEM_PX
  ctx.stroke()
  trace()
  ctx.strokeStyle = fade('71, 85, 105', 0.7)
  ctx.lineWidth = MEM_PX * 0.42
  ctx.stroke()
  // ⚠ …AND THE WALL IS MADE OF MOLECULES (21c-4b). The bands above are the
  // membrane's body; these are what it is MADE OF, from the same paver every
  // other wall in this frame uses. Drawn ON the bands, so the material reads
  // and the silhouette is unchanged.
  if (depth > 0.05) {
    ctx.save()
    ctx.globalAlpha *= depth
    paveMembrane(ctx, astroLipids(g), { geom: ZONE_LIPID, first: 700, taperOver: 0, ms: clockMs })
    ctx.restore()
  }
  // The transporter channels, the pump family's indigo — set across the
  // membrane at the reaching tip, drawn by the one transporter drawing so the
  // astrocyte's doors and the neurons' cannot differ.
  // ⚠ EACH SQUARE TO THE MEMBRANE IT IS IN (21c-3b). One angle for all of them
  // — the line from the body to the cleft — is right for the arm that runs
  // along it and wrong everywhere else, which is why the far one came out lying
  // flat across a wall that is not flat there.
  for (const t of c.ticks) {
    drawTransporter(ctx, t, tangentOn(c.placement, t), CHANNEL_INK.eaat, EAAT_GLYPH)
  }
  ctx.restore()
}

/** ⚠ HOW FAR THE SPENT SLOT HAS COME BACK, 0 → 1 (21c-2). Endocytosis and
 *  NSF, at this register: one number, so the bubble's return, the spent
 *  complex's disassembly and the fresh rope's arrival cannot disagree.
 *
 *  ⚠ Placed in the loop's own legs on purpose — the bubble is whole again
 *  BEFORE the returning glutamine reaches the stock, because that is the
 *  order the biology runs in: a vesicle is re-used in tens of seconds while
 *  the glutamine round trip takes minutes, so the terminal is never waiting
 *  on a particular molecule to come home. Declared, and squeezed. */
export const RETRIEVE_FROM_MS = 41
export const RETRIEVE_TO_MS = 53

export function vesicleRestore(ms: number): number {
  if (ms <= RETRIEVE_FROM_MS) return 0
  return Math.min(1, (ms - RETRIEVE_FROM_MS) / (RETRIEVE_TO_MS - RETRIEVE_FROM_MS))
}

/** ⚠ RETRIEVAL IS EXOCYTOSIS RUN BACKWARDS — the SAME function, with its age
 *  counting down (user, 2026-09-05: "vesicle restore should be a process,
 *  opposite to exocytosis. Just revert the process, do not re-invent").
 *
 *  The first pass invented a second shape machine: a dimple that grew, pinched
 *  off at a made-up 60%, and travelled to the slot. Two private copies of one
 *  process, and they could only ever drift apart. There is nothing to invent —
 *  `fusedShape` already carries the whole schedule from docked bubble to flat
 *  wall, so the way back is that schedule with the clock reversed. Every stage
 *  the child watched going out is the stage they watch coming back, in the
 *  opposite order and drawn by the same code: the flat wall dimples, the omega
 *  reappears with its feet on the bouton's own outline, the pore narrows, the
 *  bubble lifts off its dock.
 *
 *  Returns the age to hand `fusedShape`, or null before retrieval begins. */
/** ⚠ THE ONE AGE A FUSED SLOT IS DRAWN AT, forward or backward — extracted the
 *  moment a second pass was found asking for its own (21c-2b).
 *
 *  The bug: the OUTLINE pass had been moved onto the reversed age while the
 *  LIPID pass still computed `ms - gone`, so on the way home the circle came
 *  back and its own molecules stayed lying flat in the wall — exactly what the
 *  user saw ("the bilayer should follow the circle shapes and not stay in
 *  place"). Two passes, two ages, one drawing: the classic second private copy.
 *  Every call to `fusedShape` in the scene now goes through here, and a guard
 *  holds that. */
export function fusedAgeAt(ms: number, fusedAtMs: number): number {
  return retrievalAge(ms) ?? ms - fusedAtMs
}

export function retrievalAge(ms: number): number | null {
  if (ms < RETRIEVE_FROM_MS) return null
  const back = vesicleRestore(ms)
  // The far end of the outward schedule — the moment the bubble has just
  // become wall — walked back to age zero, which is the docked vesicle.
  const end = FLATTEN_FROM_MS + FLATTEN_MS
  return end * (1 - back)
}

/** ⚠ THE DOORS THE GLUTAMINE ROUND TRIP GOES THROUGH, and the stock it feeds
 *  (21c-2, user: "implement the reuptake logic, vesicle restore, snare
 *  restore, glutamate conversion, glutamate travel to the neuron — add a
 *  transporter to its membrane, if scientifically correct").
 *
 *  ⚠ IT IS SCIENTIFICALLY CORRECT, and each door is a real protein family:
 *   • EAAT (GLT-1/GLAST) on the astrocyte takes the glutamate IN — 3 Na⁺ and
 *     1 H⁺ ride in with it, 1 K⁺ steps out, paid for by the pump's gradient.
 *   • SNAT3/SNAT5 (system N) on the astrocyte lets the GLUTAMINE out.
 *   • SNAT1/SNAT2 (system A) on the presynaptic terminal takes it in — this
 *     is the transporter the user asked whether to draw, and the answer is
 *     yes, the neuron genuinely has one for this.
 *   • VGLUT loads the remade glutamate into the vesicle, on the proton
 *     gradient a V-ATPase keeps.
 *
 *  ⚠ AND NOTHING CROSSES A MEMBRANE ANYWHERE ELSE (user, 2026-09-05:
 *  "neurotransmitter balls should enter through the hole, not through
 *  membrane, as it currently does"). Every crossing in the cast is routed
 *  through one of these points, so a door is not decoration — it is the only
 *  gap in the wall. */
export interface LoopDoors {
  /** On the astrocyte's reaching process: glutamate in. */
  eaat: { x: number; y: number }[]
  /** On the astrocyte, facing the terminal: glutamine out. */
  snatOut: { x: number; y: number }
  /** On the presynaptic wall, astrocyte side: glutamine in. */
  snatIn: { x: number; y: number }
  /** ⚠ AND ONE ON THE FAR SIDE (21c-3, user: "display a channel also on the
   *  left of the presynaptic bouton"). The transmitter that leaves by the left
   *  mouth is collected by an astrocyte this frame does not show — there is one
   *  at every synapse — and comes home through the terminal's own left-hand
   *  door. A terminal's SNAT transporters are distributed over its membrane, so
   *  two doors is anatomy, not an accommodation. */
  snatInLeft: { x: number; y: number }
  /** ⚠ The spine's own EAAT — kept in the geometry but NO LONGER DRAWN
   *  (21c-3b): no drawn ball takes that route any more, and a door nothing ever
   *  uses is a promise the picture does not keep. See `NEURON_UPTAKE_FRAC`. */
  spineEaat: { x: number; y: number }
  /** ⚠ THE CALCIUM PUMPS on the presynaptic wall (21c-3, user: "implement the
   *  process of Ca getting back to synaptic cleft"). Real proteins, and the
   *  reason a terminal's calcium falls back to rest between spikes: the
   *  plasma-membrane Ca-ATPase (PMCA) spends ATP to push it out, and the
   *  sodium–calcium exchanger (NCX) trades it against the sodium gradient the
   *  pump keeps — the same stored work the astrocyte's EAAT spends. Without
   *  them the calcium that came in would still be inside on the last frame,
   *  and the demo could not end on the frame it started on. */
  caPumps: { x: number; y: number }[]
  /** ⚠ THE POCKET THE ASTROCYTE'S EXIT DOOR IS APPROACHED FROM (21c-3a) —
   *  solved ONCE here rather than verified per ball per frame, which timed the
   *  continuity walk out. The pockets run along the process's centreline and
   *  the door sits on its wall, so the last hop has to be chosen, not assumed:
   *  this is the pocket nearest the door from which the whole hop stays inside
   *  the cell. */
  exitVia: { x: number; y: number }
  /** ⚠ WHERE A BALL WAITS BEFORE EACH TERMINAL DOOR, index 0 = right, 1 = left
   *  (21c-3h). Solved the same way the astrocyte's approaches are: walked out
   *  until the point AND the line to it are clear of the bouton, so an approach
   *  cannot clip the cell's flank and enter 17 px from the door it is aiming
   *  for. */
  snatHolds: { x: number; y: number }[]
  /** ⚠ THE WAY OUT FOR EACH PUMP — the bouton's own skirt, walked in whichever
   *  direction is CLEAR (21c-3c). Taking the shorter way round sent the
   *  right-hand pump's ions through the astrocyte, which is only a shorter
   *  route if you do not mind what is in the way. Solved once per geometry,
   *  because it is the same path for every ion on every frame. */
  caSkirt: { x: number; y: number }[][]
  /** The terminal's standing pool of glutamate, which the vesicles fill from. */
  stock: { x: number; y: number; r: number }
}

/** ⚠ MEMOISED PER GEOMETRY, like the astrocyte and the active zone. Each call
 *  scans the astrocyte's 4,400-point outline and the bouton's ring to place the
 *  doors; the cast asks for them once per ball per frame, and computing them
 *  there timed the guards out. */
const DOORS_CACHE = new WeakMap<SynapseGeometry, LoopDoors>()

/** ⚠ A HOLDING POINT JUST OUTSIDE A DOOR ON THE BOUTON (21c-3a). A ball coming
 *  home from off the page flies a straight line to its door — and once the
 *  doors moved up the flanks, clear of the SNARE machinery, that line began
 *  cutting through the bouton's lower flank on the way: measured, a ball
 *  crossing the wall 97 px from any door. So the last stretch is made
 *  perpendicular to the membrane — the ball comes to a point straight out from
 *  its door and then goes in through it, which is what entering through a hole
 *  looks like anyway. */
/** ⚠ HOW FAR OUT THE BOUTON REACHES ON EACH SIDE — so anything travelling round
 *  the outside of the terminal can be routed clear of it rather than through
 *  it (21c-3b). Measured off the traced outline, not guessed. */
/** ⚠ A SKIRT ROUND THE BOUTON — its own outline, pushed outward (21c-3c, user:
 *  "correct its path to follow the shape of the presynaptic bouton, on some
 *  distance").
 *
 *  A calcium ion put out through a pump high on a flank has to get down to the
 *  cleft. Straight lines do not work: one cuts through the terminal, and the
 *  two-leg detour that replaced it went wide enough to cross the SPINE and the
 *  astrocyte instead. Following the cell's own shape at a fixed distance is the
 *  only route that is short, obviously outside, and clear of everything else —
 *  and it reads as what it is, an ion swimming along the outside of the cell.
 *
 *  Cached: it is the same polyline for every ion on every frame. */
const SKIRT_CACHE = new WeakMap<BoutonFit, { x: number; y: number }[]>()

export function boutonSkirt(g: SynapseGeometry, pad = 26): { x: number; y: number }[] {
  const hit = SKIRT_CACHE.get(g.fit)
  if (hit) return hit
  const ring = boutonRing(g)
  const out = ring.map((p, i) => {
    const a = ring[(i - 3 + ring.length) % ring.length]
    const b = ring[(i + 3) % ring.length]
    const tx = b.x - a.x
    const ty = b.y - a.y
    const len = Math.hypot(tx, ty) || 1
    const nx = -ty / len
    const ny = tx / len
    // Outward is whichever side of the tangent is not inside the cell.
    const probe = { x: p.x + nx * 3, y: p.y + ny * 3 }
    const sign = boutonHolds(g, probe) ? -1 : 1
    return { x: p.x + nx * sign * pad, y: p.y + ny * sign * pad }
  })
  SKIRT_CACHE.set(g.fit, out)
  return out
}

export function boutonFlank(g: SynapseGeometry, side: 1 | -1, pad = 26): number {
  const xs = boutonRing(g).map((p) => p.x)
  return side > 0 ? Math.max(...xs) + pad : Math.min(...xs) - pad
}

export function outsideDoor(
  g: SynapseGeometry,
  door: { x: number; y: number },
  by = 60,
): { x: number; y: number } {
  // ⚠ LEVEL WITH THE DOOR, and out to its own side. An outward-normal approach
  // was not enough: a ball coming from below still crossed the flank on its way
  // up to the holding point. At the door's OWN HEIGHT the door is the first
  // piece of outline anything coming from that side can meet — the flank is
  // above and below it, not beside it — so the last stretch cannot clip.
  const side = door.x >= g.foot.x ? 1 : -1
  return { x: door.x + side * by, y: door.y }
}

export function loopDoors(g: SynapseGeometry): LoopDoors {
  const hit = DOORS_CACHE.get(g)
  if (hit) return hit
  const built = buildLoopDoors(g)
  DOORS_CACHE.set(g, built)
  return built
}

function buildLoopDoors(g: SynapseGeometry): LoopDoors {
  const cell = astrocyteCell(g)
  // ⚠ THE TERMINAL'S DOOR IS ASKED OF THE BOUTON'S OUTLINE. Placed by
  // arithmetic at `activeHalf × 1.25` it landed at x = 646 — twelve pixels
  // PAST the bulb's right edge, where `wallAt` is only extrapolating and
  // there is no membrane at all. Measured, and fixed by asking the shape.
  const ring = boutonRing(g)
  const onRing = (want: { x: number; y: number }) => {
    let best = ring[0]
    let bestD = Infinity
    for (const q of ring) {
      const d = Math.hypot(q.x - want.x, q.y - want.y)
      if (d < bestD) {
        bestD = d
        best = q
      }
    }
    return best
  }
  // ⚠ HIGH ON THE FLANKS, CLEAR OF THE ACTIVE ZONE (21c-3a, user: "reuptake
  // channels overlap with snare. Place them higher, where there's more free
  // membrane space"). Placed 40 px above the foot they sat among the docked
  // vesicles' ropes and knobs — the busiest stretch of membrane in the picture,
  // and the one stretch that is already spoken for. The bouton's flanks above
  // the zone are bare, so that is where the doors go; `onRing` still puts them
  // ON the outline, so nothing about crossing-at-a-door changes.
  //
  // ⚠ SOLVED, not placed: the machinery it has to clear is drawn, so the
  // clearance can be measured. Candidates are walked UP the bouton's own
  // outline from the foot and the first one far enough from every rope, knob
  // and bubble is taken — and the ones already taken are avoided too, so two
  // doors never land on each other.
  const busy = activeZone(g).docked.flatMap((v) => [
    { x: v.x, y: v.y },
    ...snareMini(g, v).knobs,
    ...snareMini(g, v).ropes.flatMap((rp) => [rp.from, rp.to]),
  ])
  const taken: { x: number; y: number }[] = []
  const freeOnRing = (side: 1 | -1, wantRise: number, clear: number) => {
    let best = onRing({ x: g.foot.x + side * g.activeHalf, y: wallAt(g, g.foot.x) })
    let bestScore = -Infinity
    for (let rise = wantRise; rise <= wantRise + 190; rise += 6) {
      const p = onRing({
        x: g.foot.x + side * g.activeHalf * 1.3,
        y: wallAt(g, g.foot.x) - rise,
      })
      const room = Math.min(
        ...busy.map((q) => Math.hypot(q.x - p.x, q.y - p.y)),
        ...taken.map((q) => Math.hypot(q.x - p.x, q.y - p.y)),
        Infinity,
      )
      if (room >= clear) {
        taken.push(p)
        return p
      }
      if (room > bestScore) {
        bestScore = room
        best = p
      }
    }
    taken.push(best)
    return best
  }
  const snatIn = freeOnRing(1, 120, 46)
  const snatInLeft = freeOnRing(-1, 120, 46)
  // ⚠ THE ASTROCYTE'S DOOR IS ASKED OF ITS OUTLINE, not offset along a
  // direction. Placed by arithmetic it can land inside the cytoplasm or out in
  // the bath, and then a ball "leaving through it" is really leaving through
  // the wall — the exact fault the user reported. So it is the point of the
  // traced silhouette, on the page, nearest the terminal's own door: a real
  // hole in a real membrane, facing home.
  //
  // ⚠ And kept CLEAR OF THE EAAT TICKS: unconstrained, the nearest point to
  // the terminal is the reaching tip itself, where glutamate came in — the
  // ball would leave through the very hole it entered by. Two doors at one
  // place need to be two places (03), so this one is held a marker's width
  // away from both.
  // ⚠ THE DOOR AND ITS APPROACH ARE SOLVED TOGETHER (21c-3a). Choosing the
  // boundary point nearest the terminal and then hunting for a pocket to reach
  // it from puts the door where the cell cannot get to it: measured, the exit
  // sat on a neighbouring arm 52 px across a gap, and the hop to it spent two
  // model milliseconds outside the cell — a ball leaving through the wall,
  // which is the one thing the doors exist to prevent. A door the inside cannot
  // reach is not a door, so reachability is part of choosing it.
  const clean = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    for (let t = 1; t < 14; t++) {
      const m = { x: a.x + (b.x - a.x) * (t / 14), y: a.y + (b.y - a.y) * (t / 14) }
      if (!astroContains(cell.placement, m)) return false
    }
    return true
  }
  let snatOut = outwardOn(cell.placement, cell.reach)
  let exitVia = cell.pockets[cell.pockets.length - 1] ?? cell.reach
  let bestD = Infinity
  for (const ring of cell.placement.rings) {
    for (let i = 0; i < ring.length; i += 6) {
      const q = ring[i]
      if (q.x < 0 || q.x > g.width || q.y < 0 || q.y > g.height) continue
      if (cell.ticks.some((t) => Math.hypot(q.x - t.x, q.y - t.y) < 26)) continue
      const d = Math.hypot(q.x - snatIn.x, q.y - snatIn.y)
      if (d >= bestD) continue
      const door = outwardOn(cell.placement, q)
      // Reachable from inside: some resting pocket has a clean hop to it.
      const via = [...cell.pockets]
        .sort(
          (a, b) =>
            Math.hypot(a.x - door.x, a.y - door.y) - Math.hypot(b.x - door.x, b.y - door.y),
        )
        .slice(0, 6)
        .find((pk) => clean(pk, door))
      if (!via) continue
      bestD = d
      snatOut = door
      exitVia = via
    }
  }
  // The calcium pumps take the next free stretch on each flank, avoiding the
  // doors already claimed.
  // ⚠ BOTH CALCIUM PUMPS ON THE FAR FLANK, away from the astrocyte (21c-3c).
  // A pump high on the RIGHT sits exactly where the glial arms reach in, so the
  // ions it puts out had to swim through them to get anywhere — and no choice
  // of route round the cell fixes a door that opens into another cell. Pumps
  // are distributed over a terminal's whole membrane, so drawing this pair on
  // the side that is not occluded is a composition choice, not a claim.
  const caPumpRight = freeOnRing(-1, 58, 44)
  const caPumpLeft = freeOnRing(-1, 150, 44)
  // The route each calcium pump's ions take round the outside of the cell.
  const skirt = boutonSkirt(g)
  const nearestSkirt = (q: { x: number; y: number }) => {
    let bi = 0
    let bd = Infinity
    for (const [i, sp] of skirt.entries()) {
      const d = Math.hypot(sp.x - q.x, sp.y - q.y)
      if (d < bd) {
        bd = d
        bi = i
      }
    }
    return bi
  }
  const mouthIdx = nearestSkirt({ x: g.foot.x, y: wallAt(g, g.foot.x) })
  const caSkirt = [caPumpRight, caPumpLeft].map((pump) => {
    const from = nearestSkirt(pump)
    const n = skirt.length
    const walk = (step: 1 | -1) => {
      const legs = step === 1 ? (mouthIdx - from + n) % n : (from - mouthIdx + n) % n
      const path: { x: number; y: number }[] = []
      for (let k = 1; k <= legs; k++) path.push(skirt[(from + step * k + n) % n])
      return path
    }
    const clean = (path: { x: number; y: number }[]) =>
      !path.some((q) => astroContains(cell.placement, q))
    const fwd = walk(1)
    const back = walk(-1)
    if (clean(fwd) && (!clean(back) || fwd.length <= back.length)) return fwd
    if (clean(back)) return back
    return fwd.length <= back.length ? fwd : back
  })
  const snatHolds = [snatIn, snatInLeft].map((door) => {
    let best = outsideDoor(g, door, 60)
    for (let by = 60; by <= 220; by += 20) {
      const cand = outsideDoor(g, door, by)
      let clean = !boutonHolds(g, cand)
      for (let k = 1; k < 16 && clean; k++) {
        const m = {
          x: door.x + (cand.x - door.x) * (k / 16),
          y: door.y + (cand.y - door.y) * (k / 16),
        }
        if (boutonHolds(g, m)) clean = false
      }
      if (clean) return cand
      best = cand
    }
    return best
  })
  const spineX = g.foot.x + g.activeHalf * 1.35
  return {
    eaat: cell.ticks,
    snatOut,
    snatIn,
    snatInLeft,
    snatHolds,
    exitVia,
    spineEaat: { x: spineX, y: faceAt(g, spineX) },
    // The calcium pumps go up the flanks too, and inboard of the glutamine
    // doors so the two families do not crowd each other.
    // The calcium pumps take the next free stretch on the same flank — solved
    // the same way and avoiding the doors already claimed, so they clear the
    // ropes and each other. Measured at 1060×660: every door is 60–114 px from
    // the nearest rope, knob or bubble.
    caPumps: [caPumpRight, caPumpLeft],
    caSkirt,
    // ⚠ THE STOCK IS A PLACE, NOT A HAND-OFF. A vesicle does not wait for the
    // glutamate it released: VGLUT fills it from the terminal's standing
    // cytosolic pool, and the returning glutamine tops that pool up. Drawing
    // the returning ball straight into a vesicle would teach a relay; this
    // pool is what makes it a budget. Seated high in the terminal, clear of
    // the active zone's machinery.
    // ⚠ ON THE WAY, not high in the cell (21c-2c). Seated at 168 px above the
    // wall it made every returning ball climb deep into the terminal and then
    // turn back down to the active zone — the dogleg the user reported. It now
    // sits between the entry door and the docked row, so the whole way home is
    // one drift toward the vesicles, and the caption that used to occupy this
    // air has been removed.
    stock: { x: g.foot.x + g.activeHalf * 0.3, y: wallAt(g, g.foot.x) - 125, r: 30 },
  }
}

/** ⚠ THE DOORS, DRAWN — because the cast routes every crossing through them,
 *  and a door the child cannot see makes the balls look like they are going
 *  through the wall. The pump family's indigo, at tick size: this register
 *  draws transporters as marks in the membrane, not as barrels.
 *
 *  Each tick is set ACROSS its own membrane, at the membrane's own angle
 *  there, so it reads as a hole through the wall rather than a dash beside
 *  it. */
/** ⚠ A CHANNEL HAS A HOLE IN IT (user, 2026-09-05: "the channels on the
 *  astrocytes and on presynaptic neuron do not look like channels. They look
 *  like lines").
 *
 *  They were one filled bar set across the membrane, which at this size is a
 *  dash. A transporter is now drawn the way this app draws every door: TWO
 *  posts spanning the membrane with a BORE between them, the bore left open so
 *  the wall's own darkness shows through it. That is the whole difference
 *  between a mark on a wall and a way through it — and the balls are routed
 *  through the bore's centre, so what the picture shows is what the cast does.
 *
 *  ⚠ ONE drawing, asked for by the astrocyte's own doors and the neurons'
 *  alike, so a transporter cannot wear two shapes at one magnification. */
// ⚠ WIDE ENOUGH FOR A BALL TO GO THROUGH (21c-3b, user: "make NTs enter the
// channels through the opening"). A transmitter ball is 6.4 px across; a 5 px
// bore meant the ball was always wider than the hole it was passing through,
// which reads as going through the protein rather than through its pore.
export const TRANSPORTER_BORE = 8

/** ⚠ HOW WIDE EVERY DRAWN PORE IS, px — the one number that decides how big a
 *  channel is drawn (21c-3c). Set from the thing that has to pass through it: a
 *  transmitter ball is 6.4 px across, so the opening is a little wider than
 *  that and every glyph is scaled until its own pore matches. */
export const CHANNEL_PORE = 7.6

/** How tall a channel stands across the wall, px — one height for every family,
 *  so two doors in one membrane are the same size. ⚠ Declared exaggeration: a
 *  channel is drawn several times the membrane's own drawn thickness, the same
 *  licence the transmitter balls take. */
export const CHANNEL_SPAN = MEM_PX * 4.6

/** ⚠ EVERY DOOR HAS ITS OWN COLOUR (21c-3b, user: "color-code channels (on
 *  astrocytes, transporters etc.)"). They were all one indigo, so the picture
 *  said "transporter" but never said WHICH — and the loop's whole story is that
 *  four different proteins do four different jobs. Hues chosen clear of the
 *  cast already on this canvas: teal is transmitter, orange glutamine, green
 *  the astrocyte, red/sky the charges, yellow sodium, violet potassium.
 *
 *  ⚠ Each is named for the protein family it draws, not for where it sits, so
 *  the same family can never wear two colours at two places. */
export const CHANNEL_INK = {
  /** EAAT (GLT-1/GLAST) — glutamate IN to the astrocyte. */
  eaat: { wall: '#6366f1', mouth: '#a5b4fc' },
  /** SNAT3/5 — glutamine OUT of the astrocyte. */
  snatOut: { wall: '#f59e0b', mouth: '#fcd34d' },
  /** SNAT1/2 — glutamine IN to the terminal. */
  snatIn: { wall: '#d97706', mouth: '#fbbf24' },
  /** PMCA / NCX — calcium OUT of the terminal. */
  caPump: { wall: '#0ea5e9', mouth: '#7dd3fc' },
  /** ⚠ VGLUT — glutamate INTO a vesicle, on the vesicle's own membrane. Purple,
   *  and NOT the teal it was first given: `#0f766e` is `TRANSMITTER_INK.dark`
   *  exactly, so the protein was painting itself in its own cargo's colour —
   *  caught by the guard that counts transmitter ink to prove no ball is
   *  minted. Checked clear of K⁺'s violet, which is a light ion body against
   *  this dark protein, and of the SNARE's fuchsia. */
  vglut: { wall: '#7e22ce', mouth: '#d8b4fe' },
} as const

/** ⚠ SHAPED LIKE A CHANNEL, not like a gate (21c-3b, user: "change their shapes
 *  to resemble more ion channels").
 *
 *  Two subunits leaning together into a WAISTED pore, wide at both mouths and
 *  narrow in the middle — which is what a channel looks like in every textbook
 *  and, more to the point, what makes the opening read as a way through rather
 *  than as a slot. The mouths are drawn in the family's lighter tone so the
 *  funnel is visible at this size, and the bore is left as a real hole. */
export function drawTransporter(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number },
  angle: number,
  ink: { wall: string; mouth: string } = CHANNEL_INK.eaat,
  glyph: ChannelGlyph = EAAT_GLYPH,
): void {
  // ⚠ THE HANDOVER'S OWN SHAPE (21c-3c). The hand-rolled waisted pore is gone:
  // the user supplied EAAT.svg and snat.svg, and a traced protein is a protein
  // rather than an approximation of one. Fitted across the membrane at a
  // multiple of its thickness, so a channel is visibly a thing that SPANS a
  // wall rather than a mark on it.
  drawChannelGlyph(ctx, glyph, p, angle, ink, CHANNEL_SPAN)
}

/** ⚠ WHERE VGLUT SITS ON A VESICLE (21c-3e). On the bubble's own membrane, on
 *  the side that faces the terminal's standing pool — which is where the
 *  glutamate it loads comes from, so the door is on the way in rather than
 *  somewhere the cargo has to go round to. Returns the point and the tangent
 *  of the vesicle's wall there, so the protein stands ACROSS that membrane the
 *  same way every other door stands across its own. */
export function vglutAt(
  g: SynapseGeometry,
  d: { x: number; y: number; r: number },
): { at: { x: number; y: number }; angle: number } {
  const { stock } = loopDoors(g)
  const a = Math.atan2(stock.y - d.y, stock.x - d.x)
  return {
    at: { x: d.x + Math.cos(a) * d.r, y: d.y + Math.sin(a) * d.r },
    angle: a + Math.PI / 2,
  }
}






/** ⚠ WHERE A CALCIUM PUMP'S ATP SITE SITS, and which way the pump faces — one
 *  decision, asked by the drawing and by the guard alike (21c-3j).
 *
 *  The user asked whether ATP binds outside the cell as displayed. It did:
 *  measured, both hexagons sat in the bath. The nucleotide-binding domain of
 *  every P-type ATPase is CYTOPLASMIC — that is what makes it a pump the cell
 *  can drive — so the side is solved from the bouton's own outline, and the
 *  glyph is turned with it so its ATP lobe points the same way. */
export function caAtpAt(
  g: SynapseGeometry,
  pump: { x: number; y: number },
): { at: { x: number; y: number }; angle: number; sense: 1 | -1 } {
  const ring = boutonRing(g)
  let at = 0
  let best = Infinity
  for (const [i, q] of ring.entries()) {
    const d = Math.hypot(q.x - pump.x, q.y - pump.y)
    if (d < best) {
      best = d
      at = i
    }
  }
  const a0 = ring[(at - 4 + ring.length) % ring.length]
  const b0 = ring[(at + 4) % ring.length]
  const a = Math.atan2(b0.y - a0.y, b0.x - a0.x)
  const step = (turn: number) => ({
    x: pump.x - Math.sin(a + turn) * CHANNEL_SPAN * 0.95,
    y: pump.y + Math.cos(a + turn) * CHANNEL_SPAN * 0.95,
  })
  const inside = boutonHolds(g, step(0))
  return {
    at: step(inside ? 0 : Math.PI),
    angle: a + (inside ? 0 : Math.PI),
    sense: inside ? 1 : -1,
  }
}

/** ⚠ WHERE THE CALCIUM SITS WHILE IT IS BEING CARRIED (21c-3l, user: "calcium
 *  ion should be positioned not in the middle of the channel, but closer to the
 *  entrance there where you see a visual curved shaped, circle shaped slot").
 *
 *  It was sitting at the door's own point — the middle of the wall — where the
 *  handover draws the protein at its narrowest, so the ball read as jammed in
 *  the neck rather than held in a site. `poreSeat` finds the chamber on the
 *  trace; this puts it into the scene along the very axis the ATP already uses,
 *  so the seat, the fuel and the pump's facing cannot come to disagree. */
const CA_SEAT_CACHE = new WeakMap<object, { x: number; y: number }>()

export function caSeatAt(
  g: SynapseGeometry,
  pump: { x: number; y: number },
): { x: number; y: number } {
  // ⚠ MEMOISED on the pump's own object, which `loopDoors` hands out once per
  // geometry. Every ion asks for its seat every frame, and the answer costs a
  // walk of the bouton's whole ring.
  const had = CA_SEAT_CACHE.get(pump)
  if (had) return had
  const cyto = caAtpAt(g, pump)
  const dx = cyto.at.x - pump.x
  const dy = cyto.at.y - pump.y
  const n = Math.hypot(dx, dy) || 1
  // The cargo comes from the cytoplasm, which is the glyph's +y — the side its
  // ATP tail hangs on.
  const d = poreSeat(PMCA_GLYPH, 1) * (CHANNEL_SPAN / PMCA_GLYPH.wallH)
  const seat = { x: pump.x + (dx / n) * d, y: pump.y + (dy / n) * d }
  CA_SEAT_CACHE.set(pump, seat)
  return seat
}

/** ⚠ How big VGLUT stands on a vesicle. Smaller than a wall channel because the
 *  bubble it sits on is smaller than the terminal — named once so the drawing
 *  and the seat cannot be fitted to different sizes. */
export const VGLUT_SPAN = CHANNEL_SPAN * 0.8

/** ⚠ WHERE THE GLUTAMATE SITS INSIDE VGLUT (21c-3l) — the same decision as the
 *  calcium pump's, asked of VGLUT's own trace. Its glyph faces the other way:
 *  the door's angle stands the protein across the bubble's wall with the glyph's
 *  +y pointing into the LUMEN, and the cargo arrives from the cytoplasm, so the
 *  seat is on the −y side and the ball waits just outside the bubble. */
export function vglutSeatAt(
  g: SynapseGeometry,
  d: { x: number; y: number; r: number },
): { x: number; y: number } {
  const v = vglutAt(g, d)
  const lx = d.x - v.at.x
  const ly = d.y - v.at.y
  const n = Math.hypot(lx, ly) || 1
  const k = poreSeat(VGLUT_GLYPH, -1) * (VGLUT_SPAN / VGLUT_GLYPH.wallH)
  return { x: v.at.x + (lx / n) * k, y: v.at.y + (ly / n) * k }
}

export function drawLoopDoors(
  ctx: CanvasRenderingContext2D,
  g: SynapseGeometry,
  ms = 0,
  run?: SynapseRun,
): void {
  const doors = loopDoors(g)
  // ⚠ SQUARE TO ITS OWN MEMBRANE, asked of the outline at the door's own place
  // (21c-3b). `wallAt`'s slope is the FLOOR's slope, which is level on the
  // flanks where these doors now sit — so every one of them came out lying flat
  // across a near-vertical wall. The bouton's ring gives the real tangent.
  const ring = boutonRing(g)
  const wallAngle = (p: { x: number; y: number }) => {
    let at = 0
    let best = Infinity
    for (const [i, q] of ring.entries()) {
      const d = Math.hypot(q.x - p.x, q.y - p.y)
      if (d < best) {
        best = d
        at = i
      }
    }
    const a = ring[(at - 4 + ring.length) % ring.length]
    const b = ring[(at + 4) % ring.length]
    return Math.atan2(b.y - a.y, b.x - a.x)
  }
  const tick = (
    p: { x: number; y: number },
    angle: number,
    ink: { wall: string; mouth: string },
    glyph = EAAT_GLYPH,
  ) => drawTransporter(ctx, p, angle, ink, glyph)
  // The terminal's glutamine doors wear SNAT's own shape; the calcium pumps
  // wear EAAT's for now — ⚠ they have no glyph of their own yet, which is
  // recorded in `channelShapes.ts` and asked for.
  tick(doors.snatIn, wallAngle(doors.snatIn), CHANNEL_INK.snatIn, SNAT_GLYPH)
  tick(doors.snatInLeft, wallAngle(doors.snatInLeft), CHANNEL_INK.snatIn, SNAT_GLYPH)
  // ⚠ The pumps are PMCA's own traced shape, and they MOVE: the gates swing
  // about the hinge while the calcium is crossing, and the ATP hexagon in the
  // slot below the membrane is spent as they do it.
  // ⚠ THE ATP SITE IS CYTOPLASMIC, and it was drawn OUTSIDE (21c-3j, user:
  // "does ATP bind in the outside of the cell, as we've displayed?"). It did:
  // measured, both hexagons sat outside the terminal. The nucleotide-binding
  // domain of every P-type ATPase is on the INSIDE — that is what makes it a
  // pump the cell can drive — so a hexagon in the bath is a straightforward
  // error, not a simplification.
  //
  // Both the glyph's own tail (which is the ATP lobe in the handover) and the
  // hexagon are now put on whichever side the bouton's outline says is inside.
  // ⚠ EACH PUMP DRAWN FROM THE ION THAT IS IN IT (21c-3k). One global stroke
  // moved every pump at once for a crowd of ions; the state now comes from the
  // queue, so the gates and the hexagon show what THIS pump's current ion is
  // doing — and the machine cannot disagree with its cargo, because both read
  // one schedule.
  for (const [k, p] of doors.caPumps.entries()) {
    const seat = caAtpAt(g, p)
    const st = run
      ? caPumpStateAt(g, (i) => restOfIon(g, run, i), ms, k)
      : { open: 0, atp: 0, flash: 0 }
    drawMovingGlyph(
      ctx,
      PMCA_GLYPH,
      p,
      seat.angle,
      CHANNEL_INK.caPump,
      CHANNEL_SPAN,
      st.open * seat.sense,
      { at: seat.at, left: st.atp },
    )
    // The binding flash — the moment the fuel is caught, marked as an event the
    // way the transmitter's change of kind is.
    if (st.flash > 0.02) {
      const rr = CHANNEL_SPAN * (0.5 + st.flash * 0.5)
      const glow = ctx.createRadialGradient(seat.at.x, seat.at.y, 1, seat.at.x, seat.at.y, rr)
      glow.addColorStop(0, `rgba(253, 224, 71, ${0.7 * st.flash})`)
      glow.addColorStop(1, 'rgba(253, 224, 71, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(seat.at.x, seat.at.y, rr, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // The astrocyte's outward door, square to the astrocyte's own outline there.
  const cell = astrocyteCell(g)
  tick(doors.snatOut, tangentOn(cell.placement, doors.snatOut), CHANNEL_INK.snatOut, SNAT_GLYPH)
}

/** ⚠ THE STANDING POOL the vesicles fill from — the thing that makes the loop
 *  a BUDGET rather than a relay. Drawn as a soft pocket of cytoplasm, not a
 *  container with a wall: it is a concentration in the terminal, not an
 *  organelle, and drawing it with a membrane would invent a compartment that
 *  does not exist. */
export function drawStock(ctx: CanvasRenderingContext2D, g: SynapseGeometry): void {
  const { stock } = loopDoors(g)
  ctx.save()
  const grad = ctx.createRadialGradient(stock.x, stock.y, 1, stock.x, stock.y, stock.r * 1.6)
  grad.addColorStop(0, `rgba(45, 212, 191, 0.16)`)
  grad.addColorStop(1, 'rgba(45, 212, 191, 0)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(stock.x, stock.y, stock.r * 1.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** ⚠ THE 'active zone' CAPTION IS GONE (user, 2026-09-05: "remove 'active
 *  zone' label, it's self-explanatory"). It had already been moved twice — off
 *  the vesicles it was covering, then aside off the machinery it was covering —
 *  and a name that has to keep being moved out of the way of the thing it names
 *  is a name the picture was already giving for free. The row of docked bubbles
 *  against the wall IS the active zone; the info block still says the words. */

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
  // Each knob sits on the wall AT ITS OWN x — on the sloped outer slots a
  // knob hung off the slot-centre's height crossed the membrane.
  const knobAt = (x: number) => ({ x, y: wallAt(g, x) - MEM_PX - d.r * 0.28 })
  // ⚠ TWO ropes since 2026-09-04 (user: "add another snare complex to each
  // vesicle, to stay consistent between presentations") — the mirrored pair,
  // a section through the ring, matching D06 at every register.
  // ⚠ AS IT WAS (user, 2026-09-05: "restore what snare looked before. now they
  // look broken"). A round earlier the bundle was laid flat in the gap, on the
  // argument that a 10 nm rod in a few-nm gap has to lie down. On the picture
  // it read as broken, and the user's eye is the authority on the picture — so
  // the rope stands between the vesicle and the wall again, exactly as it did.
  const rope = (sd: 1 | -1) => {
    // ⚠ The foot sits on the wall AT ITS OWN x — the same correction the knobs
    // above already carry. Hung off the SLOT CENTRE's height it floated up to
    // 13 px off the membrane on the sloped outer slots, which is the one part
    // of the old drawing that really was broken. The rope's standing angle is
    // untouched.
    const fx = d.x + sd * d.r * 0.4
    return {
      from: { x: fx, y: wallAt(g, fx) - MEM_PX * 0.6 },
      to: { x: d.x + sd * d.r * 0.32, y: d.y + d.r * 0.82 },
    }
  }
  return {
    ropes: [rope(1), rope(-1)],
    knobs: [knobAt(d.x - d.r * 1.05), knobAt(d.x + d.r * 1.05)],
  }
}

/** ⚠ THE COMPLEX DOES NOT VANISH WHEN THE VESICLE FUSES (user, 2026-09-05:
 *  "they should not disappear after exocytosis").
 *
 *  It used to: a fused slot skipped the machinery altogether, on the old note
 *  that the rope "has done its work and become part of the merged wall". That
 *  is half true and it drew the wrong half. After fusion the trans-complex
 *  becomes a CIS-complex — all four helices now in the one membrane, lying
 *  flat in it — and it stays there until NSF and α-SNAP prise it apart, which
 *  is precisely what D06 spends its last leg showing. So the fused site keeps
 *  its pair, lying IN the wall along the wall's own tangent.
 *
 *  Length and seat come from the same two constants D06 uses, so the spent
 *  complex is the same object in both presentations. */
export function snareCis(
  g: SynapseGeometry,
  d: { x: number; y: number; r: number },
): { ropes: { from: { x: number; y: number }; to: { x: number; y: number } }[] } {
  const lie = (sd: 1 | -1) => {
    const inner = d.x + sd * d.r * (Math.cos(SNARE_ANCHOR_A) + 0.55)
    const outer = inner + sd * d.r * SNARE_CIS_LEN
    return {
      from: { x: inner, y: wallAt(g, inner) - MEM_PX * 0.35 },
      to: { x: outer, y: wallAt(g, outer) - MEM_PX * 0.35 },
    }
  }
  return { ropes: [lie(1), lie(-1)] }
}

/** The spent complex at a fused slot: the same three strands, lying in the
 *  wall. Dimmer than a working rope — it is finished, not holding anything. */
function drawSnareCis(
  ctx: CanvasRenderingContext2D,
  g: SynapseGeometry,
  d: { x: number; y: number; r: number },
): void {
  const { ropes } = snareCis(g, d)
  ctx.save()
  ctx.lineWidth = 1.3
  ctx.lineCap = 'round'
  ctx.globalAlpha *= 0.75
  for (const rope of ropes) {
    const dx = rope.to.x - rope.from.x
    const dy = rope.to.y - rope.from.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    for (const [i, colour] of SNARE_STRANDS.entries()) {
      ctx.strokeStyle = colour
      ctx.beginPath()
      // Flatter waves than the standing rope: a zipped bundle at rest.
      const phase = (i / SNARE_STRANDS.length) * Math.PI * 2
      for (let k = 0; k <= 10; k++) {
        const t = k / 10
        const off = Math.sin(t * Math.PI * 3 + phase) * 1.1
        const x = rope.from.x + dx * t + nx * off
        const y = rope.from.y + dy * t + ny * off
        if (k === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }
  ctx.restore()
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
export const ZONE_LIPID: LipidGeom = { headR: 0.6, halfMem: 3.0 }

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
  /** ⚠ ONE DOCKED SITE THIS SCENE MUST NOT DRAW (21c-4c). The clearance drawer
   *  plays retrieval three ways over a still of this scene, and two of those
   *  ways are things this scene cannot do — a bubble that never collapses, and
   *  a dent far bigger than a bubble. It takes one site over and draws it
   *  itself, out of THIS file's own vesicle; the scene has to leave that site
   *  empty or there are two versions of one bubble on screen. */
  skipDocked?: number
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

  // ── the astrocyte (21c-1): the third cell, ONE of it, on the right, in the
  // room the synapse was not solved into — the collector the escaping
  // transmitter travels to. Behind both neurons in the pile; the active-zone
  // camera crops it away, which is the agreed close-up treatment.
  drawAstrocyte(ctx, g, 1 - chrome, jig)

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
  // ⚠ THE FILLERS ARE DRAWN LAST (21c-3l, user: "place them above the membrane.
  // Currently they are behind in the newly created vesicles view"). VGLUT was
  // painted while its bubble was being built, so the vesicle's own body — and
  // then the lipid pass over every bubble — went straight over the top of it.
  // A protein IN a membrane is drawn ON it. Collected here, flushed below the
  // cast so a ball threading the pore still shows on top.
  const fillers: { at: { x: number; y: number }; angle: number; open: number; alpha: number }[] =
    []
  for (const [vi, d] of zone.docked.entries()) {
    // ⚠ The one site a drawer has taken over (21c-4c) is left alone entirely —
    // its bubble, its rope and its filler are that drawer's to draw.
    if (v.skipDocked === vi) continue
    const r = d.r
    const gone = u === null ? null : (v.run.vesicles[d.index]?.fusedAtMs ?? null)
    if (gone !== null && ms >= gone) {
      // ⚠ FUSED, and drawn as what fusion IS. `fusedShape` sinks the circle
      // through the wall on the declared schedule; the moment it crosses the
      // outline, what is drawn is the OMEGA: an arc whose two feet stand ON
      // the bouton's own curve (`pocketAt`), over a tear whose edges are those
      // same two feet — one continuous wall with a pocket in it, then, slowly,
      // no pocket at all.
      // ⚠ ONE AGE, forward or backward. Retrieval hands `fusedShape` a
      // COUNTING-DOWN age, so the pocket, the omega, the tear and the clip
      // below are the very same drawing playing in reverse — there is no
      // second code path for the way home.
      const rewind = retrievalAge(ms)
      const shape = fusedShape(g, d.x, fusedAgeAt(ms, gone), d.r)
      if (rewind !== null) {
        // The spent complex is taken apart as the membrane comes back in, and
        // the working rope returns once the bubble is off the wall again.
        const back = vesicleRestore(ms)
        ctx.save()
        ctx.globalAlpha *= 1 - back
        drawSnareCis(ctx, g, d)
        ctx.restore()
        if (shape && shape.cy + shape.r < wallAt(g, d.x)) {
          ctx.save()
          ctx.globalAlpha *= Math.min(1, back * 1.6)
          drawSnareMini(ctx, g, { x: d.x, y: shape.cy, r: shape.r })
          // ⚠ …AND ITS FILLER (21c-3f, user: "recreated vesicles have no pump,
          // add"). A rebuilt bubble had its rope back but no VGLUT — and these
          // are precisely the vesicles the loop then fills, so the ones the
          // child watches being filled were the ones with nothing to fill them
          // through.
          const rv = vglutAt(g, { x: d.x, y: shape.cy, r: shape.r })
          fillers.push({
            at: rv.at,
            angle: rv.angle,
            open: -fillerStateAt(g, v.run, ms, vi).open,
            alpha: Math.min(1, back * 1.6),
          })
          ctx.restore()
        }
        if (!shape) continue
        const pocket = pocketAt(g, d.x, shape.cy, shape.r)
        if (pocket) {
          drawPocket(ctx, g, shape, pocket)
        } else {
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
        continue
      }
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
      // ⚠ …and its SNARE complex is still there (user, 2026-09-05: "they
      // should not disappear after exocytosis"). Spent, lying flat in the
      // merged wall as a cis-complex, waiting for NSF — D06's last leg, at
      // this register.
      drawSnareCis(ctx, g, d)
      // Its cargo is part of the transmitter CAST now — drawn below with the
      // rest of the population, each ball on its own trajectory.
      continue
    }
    vesicle(ctx, d.x, d.y, r, 1)
    // The machinery holding it there — rope and calcium knobs, so the pink
    // ions settling beside it visibly bind to SOMETHING.
    drawSnareMini(ctx, g, d)
    // ⚠ …and the door its glutamate goes in by (21c-3e). VGLUT was the one
    // protein in this loop that was never drawn at all: the refilling balls
    // simply appeared inside the bubble. It stands across the vesicle's own
    // membrane on the side facing the pool, and its gates swing while the
    // filling is happening.
    {
      const vg = vglutAt(g, { x: d.x, y: d.y, r })
      fillers.push({
        at: vg.at,
        angle: vg.angle,
        // ⚠ MIRRORED, and at ONE place (21c-3f/21c-3l). VGLUT stands on the
        // bubble the other way up from a wall channel: the end of its glyph
        // that faces the lumen is the end a wall channel points at the outside.
        // `fillerStateAt` speaks the pump's own language — −1 open to where the
        // cargo comes from — and the flip into the drawing's happens here.
        open: -fillerStateAt(g, v.run, ms, vi).open,
        alpha: 1,
      })
    }
  }

  // ── the membrane's own molecules, resolved at the zone's depth — walls,
  // face, and every intact bubble as a ring of the same material.
  const depth = 1 - chrome
  if (depth > 0.05) {
    ctx.save()
    ctx.globalAlpha *= depth
    // ⚠ Rule 2 (21c-8): at this depth the membranes are actors — vesicles fuse
    // into this wall and are pinched back out of it — so the crowd jostles on
    // the view's own thermal clock.
    paveMembrane(ctx, membraneLipids(g, tears), {
      geom: ZONE_LIPID,
      first: 0,
      taperOver: 3,
      ms: jig,
    })
    for (const [vi, d] of zone.docked.entries()) {
      if (v.skipDocked === vi) continue
      const gone = u === null ? null : (v.run.vesicles[d.index]?.fusedAtMs ?? null)
      if (gone !== null && ms >= gone) {
        // Fusing: the standing omega keeps its molecules; the submerged part
        // has become wall (whose own rows part at the tear).
        //
        // ⚠ AND THE SAME AGE THE OUTLINE USES (21c-2b, user: "the bilayer
        // should follow the circle shapes and not stay in place"). This pass
        // still asked for the FORWARD age while the outline had already been
        // put on the reversed one, so during retrieval the circle came home and
        // its own lipids stayed lying in the wall. One age, both passes.
        const shape = fusedShape(g, d.x, fusedAgeAt(ms, gone), d.r)
        if (!shape) continue
        const pocket = pocketAt(g, d.x, shape.cy, shape.r)
        if (!pocket) {
          paveMembrane(ctx, vesicleLipids(d.x, shape.cy, shape.r), {
            geom: ZONE_LIPID,
            first: 500,
            taperOver: 0,
            ms: jig,
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
          { geom: ZONE_LIPID, first: 500, taperOver: 0, ms: jig },
        )
        continue
      }
      paveMembrane(ctx, vesicleLipids(d.x, d.y, d.r), {
        geom: ZONE_LIPID,
        first: 500,
        taperOver: 0,
        ms: jig,
      })
    }
    for (const [i, p] of reservePool(g).entries()) {
      paveMembrane(ctx, vesicleLipids(p.x, p.y, vesicleR(g) * vesicleScale(i + 40)), {
        geom: ZONE_LIPID,
        first: 500,
        taperOver: 0,
        ms: jig,
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

  // ── the fillers, ON their membranes (21c-3l): after the bubbles' own bodies
  // and after the lipid pass, so nothing is painted over them.
  for (const f of fillers) {
    ctx.save()
    ctx.globalAlpha *= f.alpha
    drawMovingGlyph(ctx, VGLUT_GLYPH, f.at, f.angle, CHANNEL_INK.vglut, VGLUT_SPAN, f.open)
    ctx.restore()
  }

  // ── the loop's furniture (21c-2): the standing pool the vesicles fill from,
  // and the doors every crossing goes through. Under the cast, so a ball
  // threading a door is drawn on top of it.
  drawStock(ctx, g)
  drawLoopDoors(ctx, g, ms, v.run)

  // ── THE CAST: every loose ball in the picture, with identity — present
  // from the first frame, moving only by travel, fading never. See
  // `synapseCast` for the ruling this implements.
  ctx.save()
  ctx.globalAlpha *= CAST_ALPHA
  for (const dot of transmitterCast(g, v.run, v.cleft, ms, jig)) {
    // The enzyme's flash, under the ball so the ball stays the object and the
    // flash stays an event happening to it. A gradient, never a canvas shadow.
    const f = dot.flash ?? 0
    if (f > 0.02) {
      const rr = TRANSMITTER_R * (2.6 + f * 2.2)
      const glow = ctx.createRadialGradient(dot.x, dot.y, TRANSMITTER_R * 0.4, dot.x, dot.y, rr)
      glow.addColorStop(0, `rgba(253, 224, 71, ${0.75 * f})`)
      glow.addColorStop(1, 'rgba(253, 224, 71, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(dot.x, dot.y, rr, 0, Math.PI * 2)
      ctx.fill()
    }
    transmitterDot(ctx, dot.x, dot.y, TRANSMITTER_R, dot.glutamine ?? 0)
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
