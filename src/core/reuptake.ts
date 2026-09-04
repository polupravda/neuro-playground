// D17 — where the transmitter goes: the glutamate–glutamine cycle, as a pure
// function of one number.
//
// ⚠ WHY AN ASTROCYTE AND NOT "THE TERMINAL SUCKS IT BACK" (the 2026-09-03
// pushback, and the reason this drawer exists at all). This app's synapse is
// glutamatergic, and glutamate is cleared overwhelmingly by ASTROCYTIC EAAT
// transporters — roughly four fifths of it in cortex — feeding the glutamine
// cycle. The tidy picture of a terminal recovering its own transmitter is
// true of GABA and the monoamines, and it is the thing most people carry
// around. So the star of this drawer is the THIRD cell.
//
// ⚠ WHAT IS DECLARED, not smuggled (03 → Scientific honesty rules):
//   • The split is a MODEL PARAMETER, not a drawing accident: `ASTROCYTE_SHARE`
//     below, and the tests read the same number the picture does.
//   • The stoichiometry is real and settled: an EAAT brings 3 Na⁺ and 1 H⁺ in
//     with each glutamate and lets 1 K⁺ out. The Na⁺ gradient that pays for it
//     is the pump's stored work — the membrane milestone's own story, arriving
//     here as the fuel for something else.
//   • The TIMESCALES are squeezed, and unevenly: uptake is milliseconds, the
//     glutamine round trip is seconds to minutes. One screen clock cannot be
//     honest about both, so it is choreography and says so.
//   • Dots and doors stand for thousands. A vesicle's worth of glutamate is
//     thousands of molecules and an astrocyte face carries thousands of EAATs.
//
// The model owes the drawing three things and no more: WHERE each dot is in
// its own journey, WHICH route it took, and WHAT KIND it currently is. The
// picture asks; it never decides.

import { clamp01 } from '../stage/layout'
import type { TeachingPara } from './neuron'

export type ReuptakeStageId =
  'released' | 'caught' | 'converted' | 'shipped' | 'restored' | 'stocked'

export interface ReuptakeStage {
  id: ReuptakeStageId
  /** For the adult. */
  title: string
  /** For the kid — what to watch for. */
  watch: string
  /** ⚠ THE LEG'S SHARE OF THE SCREEN CLOCK, not of real time (03 → *A run's
   *  clock follows the interest*). The payload here is the CATCH — the moment
   *  a dot threads a bore and the cleft empties — and the CONVERSION, where a
   *  molecule visibly becomes another kind. The freight legs get less. */
  share: number
  /** A still beat at the end of the leg, as a fraction of its span: the leg's
   *  action finishes in the first (1 − hold) and the picture then rests, so
   *  each event lands before the next begins. */
  hold?: number
}

export const REUPTAKE_STAGES: ReuptakeStage[] = [
  {
    id: 'released',
    title: 'Released',
    watch:
      'The gap is full of transmitter — the picture the release drawer ends on. Nothing is holding it there.',
    share: 0.14,
    hold: 0.25,
  },
  {
    id: 'caught',
    title: 'Caught',
    watch:
      'Doors on the astrocyte take almost all of it, one molecule at a time. One door on the neuron takes the rest.',
    share: 0.28,
    hold: 0.2,
  },
  {
    id: 'converted',
    title: 'Converted',
    watch:
      'Inside the astrocyte an enzyme changes each one into something else — watch the colour change. It is no longer a transmitter.',
    share: 0.18,
    hold: 0.25,
  },
  {
    id: 'shipped',
    title: 'Shipped home',
    watch: 'The changed molecules leave the astrocyte and cross to the terminal.',
    share: 0.16,
  },
  {
    id: 'restored',
    title: 'Converted back',
    watch:
      'Inside the terminal another enzyme turns them back into transmitter. The colour returns.',
    share: 0.14,
    hold: 0.25,
  },
  {
    id: 'stocked',
    title: 'Stocked',
    watch:
      'They join the terminal’s store, ready to be packed into the next vesicles. The loop is closed.',
    share: 0.1,
    hold: 0.3,
  },
]

/** ⚠ HOW MUCH OF THE CLEARANCE THE ASTROCYTE DOES — as the RANGE the
 *  literature actually gives, not a single tidy number.
 *
 *  Cortical glutamate uptake is roughly 80–90% astrocytic. A whole-molecule
 *  picture cannot hit an arbitrary point inside that: with seven dots the
 *  only splits available are 6:1 (86%) and 5:2 (71%). So the app declares the
 *  BAND, draws 6:1, and the test requires the drawn ratio to fall inside the
 *  band — which is the honest claim, and catches a redraw that wanders out of
 *  it. Aiming at a single 0.8 and rounding to 6 would have quietly asserted
 *  80% while drawing 86%. */
export const ASTROCYTE_SHARE_RANGE = { low: 0.8, high: 0.9 } as const

/** What the assignment aims at inside that band. */
export const ASTROCYTE_SHARE = 0.86

/** How many molecules make the journey. Enough that the split is countable
 *  (six to the astrocyte, one to the neuron) and few enough that a child can
 *  keep hold of one dot all the way round. */
export const DOT_COUNT = 7

/** The EAAT's fare, per glutamate carried in. Settled stoichiometry. */
export const EAAT_FARE = { naIn: 3, hIn: 1, kOut: 1 } as const

/** Which molecule this is right now. The whole point of the drawer is that
 *  this CHANGES and then changes back, without the dot ever being swapped for
 *  a different dot. */
export type Species = 'glutamate' | 'glutamine'

/** Where a dot goes in: the astrocyte does most of the work, the neuron a
 *  little. */
export type Route = 'astrocyte' | 'neuron'

export interface Dot {
  id: number
  route: Route
  /** Which door on that face it threads, 0-based. */
  door: number
  /** Its own place in the cleft before anything catches it, 0→1 across the
   *  gap, and its own drift phase — so the crowd is a crowd, not a queue. */
  lane: number
  phase: number
}

/** Seeded, never `Math.random` — the same crowd every run, so a child can
 *  watch the same dot twice and a test can name one. */
const hash = (i: number, salt: number): number => {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Doors drawn on each face. The astrocyte carries the workhorses; the neuron
 *  carries one, which is the honest picture of the minority route. */
export const ASTRO_DOORS = 3
export const NEURON_DOORS = 1

/** ⚠ WHO GOES WHERE — a named decision, so the declared split is the drawn
 *  split. The astrocyte's share is rounded to whole molecules and the rest go
 *  to the neuron; with seven dots and 0.8 that is six and one. */
export const DOTS: Dot[] = (() => {
  const toAstrocyte = Math.round(DOT_COUNT * ASTROCYTE_SHARE)
  return Array.from({ length: DOT_COUNT }, (_, id) => {
    const route: Route = id < toAstrocyte ? 'astrocyte' : 'neuron'
    return {
      id,
      route,
      door: route === 'astrocyte' ? id % ASTRO_DOORS : 0,
      lane: (id + 0.5) / DOT_COUNT,
      phase: hash(id, 1),
    }
  })
})()

/** How many dots each route actually takes — read by the tests and by the
 *  describer, so the words, the picture and the model cannot disagree. */
export function routeCounts(): Record<Route, number> {
  return DOTS.reduce(
    (acc, d) => {
      acc[d.route] += 1
      return acc
    },
    { astrocyte: 0, neuron: 0 } as Record<Route, number>,
  )
}

// ------------------------------------------------------------------ the clock

export const REUPTAKE_SPANS: {
  id: ReuptakeStageId
  from: number
  to: number
  hold: number
}[] = (() => {
  const total = REUPTAKE_STAGES.reduce((sum, st) => sum + st.share, 0)
  let at = 0
  return REUPTAKE_STAGES.map((st) => {
    const from = at
    at += st.share / total
    return { id: st.id, from, to: at, hold: st.hold ?? 0 }
  })
})()

/** Which stage `u` falls in, and how far through that stage it is. */
export function reuptakeStageAt(u: number): {
  stage: ReuptakeStage
  local: number
  index: number
} {
  const t = clamp01(u)
  for (let i = 0; i < REUPTAKE_SPANS.length; i++) {
    const span = REUPTAKE_SPANS[i]
    if (t < span.to || i === REUPTAKE_SPANS.length - 1) {
      const width = span.to - span.from || 1
      return {
        stage: REUPTAKE_STAGES[i],
        local: clamp01((t - span.from) / width),
        index: i,
      }
    }
  }
  return { stage: REUPTAKE_STAGES[0], local: 0, index: 0 }
}

/** How far a named leg has run, 0→1, with its still beat taken off the end:
 *  the action completes in the first (1 − hold) and the picture then rests. */
export function through(u: number, id: ReuptakeStageId): number {
  const span = REUPTAKE_SPANS.find((s) => s.id === id)!
  const width = (span.to - span.from) * (1 - span.hold) || 1
  return clamp01((clamp01(u) - span.from) / width)
}

/** The moment a named leg is `f` of the way through — what a label stop and a
 *  transport-bar diamond are placed at, so the bar and the run cannot drift. */
export function uAtThrough(id: ReuptakeStageId, f: number): number {
  const span = REUPTAKE_SPANS.find((s) => s.id === id)!
  return span.from + (span.to - span.from) * (1 - span.hold) * clamp01(f)
}

// ------------------------------------------------------- what a dot is doing

export interface DotState {
  /** 0 → 1 along its own journey: in the cleft, through its door, into the
   *  cell, converted, home, restored, stocked. The DRAWING turns this into a
   *  position; the model never knows where anything is on screen. */
  progress: number
  species: Species
  /** True while it is threading a bore — the moment the door is doing work. */
  crossing: boolean
  /** True once it has left the cleft: the gap empties as these accumulate. */
  taken: boolean
  /** True once it is back in the terminal's store. */
  stocked: boolean
}

/** ⚠ ONE CONTINUOUS PATH PER DOT. Every dot is the same dot from the first
 *  frame to the last — caught, converted, shipped, converted back, stocked.
 *  Nothing appears, disappears or is swapped for a fresh one, which is the
 *  conservation rule this drawer exists to demonstrate: the transmitter is
 *  not consumed, it is RECOVERED. */
export function dotAt(dot: Dot, u: number): DotState {
  const t = clamp01(u)
  // Each dot leaves on its own beat inside the catching leg, so seven
  // molecules do not thread seven doors in lockstep.
  const stagger = dot.phase * 0.45
  const caught = clamp01((through(t, 'caught') - stagger) / (1 - stagger || 1))
  const converted = through(t, 'converted')
  const shipped = through(t, 'shipped')
  const restored = through(t, 'restored')
  const stocked = through(t, 'stocked')

  // The neuronal route is SHORTER: what the terminal takes back is already
  // home, so it skips the conversion and the trip and joins the store early.
  // That is not a shortcut in the drawing, it is the biology of the minor
  // route, and the describer says so.
  const legs =
    dot.route === 'astrocyte'
      ? [caught, converted, shipped, restored, stocked]
      : [caught, stocked, stocked, stocked, stocked]

  const done = legs.reduce((sum, l) => sum + l, 0)
  const progress = clamp01(done / legs.length)

  // ⚠ IT IS GLUTAMINE ONLY BETWEEN THE TWO ENZYMES. Before the first it is
  // still transmitter; after the second it is transmitter again. The dot is
  // the same dot throughout — what changes is what it IS, which is the one
  // thing this drawer is for. The neuronal route never converts: what the
  // terminal takes back is already the right molecule.
  const species: Species =
    dot.route === 'astrocyte' && converted >= 1 && restored < 1
      ? 'glutamine'
      : 'glutamate'

  return {
    progress,
    species,
    crossing: caught > 0 && caught < 1,
    taken: caught >= 1,
    stocked: stocked >= 1,
  }
}

/** How much transmitter is still loose in the gap, 0→1. The reason the drawer
 *  exists: this must reach zero, and it must do so because something CARRIED
 *  it away rather than because it stopped being drawn. */
export function cleftLoad(u: number): number {
  const still = DOTS.filter((d) => !dotAt(d, u).taken).length
  return still / DOT_COUNT
}

/** Every dot accounted for at the end — the conservation the tests read. */
export function stockedCount(u: number): number {
  return DOTS.filter((d) => dotAt(d, u).stocked).length
}

// -------------------------------------------------------------------- words

/** What this drawer is, for the adult reading beside the child. */
export const REUPTAKE_PARTS: TeachingPara[] = [
  {
    icon: '♻️',
    text: 'The transmitter is not used up. Everything the terminal released is collected again and comes back — this is that journey, from the moment the gap is full to the moment the store is topped up.',
  },
  {
    icon: '⭐',
    text: 'The one doing most of the work is not a neuron. An ASTROCYTE — the third cell, the one that wraps around the join — carries most of the transmitter away through doors in its own wall.',
  },
  {
    // ⚠ THE CLAIM ABOVE IS ABOUT GLUTAMATE, and is FALSE of several other
    // transmitters (user, 2026-09-04). Left unqualified beside a synapse the
    // app never named, it reads as a fact about transmitters in general —
    // which is exactly the misconception the 2026-09-03 pushback was about,
    // arriving by the back door.
    icon: '🏷️',
    text: 'That is true of THIS chemical. The transmitter at this synapse is glutamate, and glutamate is the one the astrocyte mostly clears up. Synapses that use other chemicals do it differently — several of them the tidy way everyone expects, with the terminal taking its own messenger straight back. So this is not the rule for every synapse; it is the rule for the commonest one.',
  },
  {
    icon: '🚪',
    text: 'Those doors are transporters. A transporter is not a hole: it takes hold of one molecule and carries it through, one at a time, which is why the gap empties molecule by molecule rather than all at once.',
  },
  {
    icon: '🔄',
    text: 'Inside the astrocyte an enzyme changes the transmitter into something else — glutamine, drawn in orange — which is safe to send back. The terminal changes it back and stores it, ready for the next vesicles.',
  },
  {
    icon: '⚡',
    text: `Every catch is paid for. The door brings ${EAAT_FARE.naIn} sodium and ${EAAT_FARE.hIn} hydrogen in with each molecule and lets ${EAAT_FARE.kOut} potassium out — riding the sodium gradient the pump spent its life building. The pump's work, spent here on something else entirely.`,
  },
]

/** What is drawn true, and what is drawn convenient. */
export const REUPTAKE_HONESTY: TeachingPara[] = [
  {
    icon: '🧪',
    text: `MEASURED, AND ABOUT GLUTAMATE SPECIFICALLY: roughly ${Math.round(ASTROCYTE_SHARE_RANGE.low * 100)}–${Math.round(ASTROCYTE_SHARE_RANGE.high * 100)} per cent of glutamate is cleared by astrocytes in cortex, not by the neuron that released it. The picture draws ${routeCounts().astrocyte} of ${DOT_COUNT} going that way, which lands inside that band. The same number for a different transmitter would be a different number.`,
  },
  {
    icon: '🧪',
    text: `MEASURED: the fare. ${EAAT_FARE.naIn} Na⁺ and ${EAAT_FARE.hIn} H⁺ in, ${EAAT_FARE.kOut} K⁺ out, per molecule carried. That stoichiometry is settled.`,
  },
  {
    icon: '✏️',
    text: 'NOT MEASURED HERE: the stopwatch, and it is squeezed unevenly. Clearing the gap takes MILLISECONDS; the round trip through glutamine takes seconds to minutes. No single pace can be honest about both, so what you are watching is the ORDER, drawn to a plausible schedule.',
  },
  {
    icon: '⚖️',
    text: 'The minor route is drawn simply. The neuron’s own door here returns transmitter straight to the store; in a real terminal direct presynaptic recovery is small and debated, and most of what comes home does so the long way, as glutamine through the astrocyte. The picture shows the long way as the main way, which is the point.',
  },
  {
    icon: '🔍',
    text: `And it is enormously magnified, and enormously reduced in number. Each dot stands for thousands of molecules, and each door for thousands of transporters — a real astrocyte face is crowded with them. ${DOT_COUNT} dots and ${ASTRO_DOORS + NEURON_DOORS} doors are what a person can actually follow.`,
  },
]
