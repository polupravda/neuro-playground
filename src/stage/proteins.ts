import { PUMP_K_IN, PUMP_NA_OUT, PUMP_WIDTH_NM, type ProteinKind } from '../core/proteins'
import { CHANNELS, type ChannelId, type ChannelType } from '../core/channels'
import { type IonKind, type Side } from '../core/ions'
import { flowOf, flowStrength } from '../core/driving'
import type { IonCounts } from '../state/ionStore'
import { MEMBRANE_PX, PX_PER_UM, ZOOM_TARGETS, type Pt, type WallSample } from './layout'
import { clamp01 } from './layout'
import { ionRadius } from './ions'

// Proteins embedded in a membrane patch, and the pump's cycle as a pure
// function of time — so the stoichiometry a kid can count on screen is the same
// thing the tests check.

const nmToScene = (nm: number): number => (nm / 1000) * PX_PER_UM

export const PUMP_HALF = nmToScene(PUMP_WIDTH_NM) / 2

// How far a protein reaches from the middle of the membrane. These are the ONE
// definition of its extent: the body outline, the pore's mouths and the point at
// which a carried ion is clear of the protein all derive from them. Letting the
// pore stop short of the body left the pump looking blocked on the cytoplasmic
// side, where its head bulges past the end of the barrel.
export const PROTEIN_OUT = MEMBRANE_PX * 0.55
export const PROTEIN_BARREL_IN = MEMBRANE_PX * 0.55
/** The pump's cytoplasmic head bulges this much further in than the barrel. */
export const PUMP_HEAD = MEMBRANE_PX * 0.45

/** Distance from the middle of the membrane to a protein's innermost surface —
 *  where its pore has to open, and past which an ion is out of it. */
export function proteinIn(kind: ProteinKind): number {
  return PROTEIN_BARREL_IN + (kind === 'pump' ? PUMP_HEAD : 0)
}

export interface ProteinInstance {
  kind: ProteinKind
  /** Which channel this is, for anything that is not the pump. One component
   *  serves every channel type; the differences are all data (N13). */
  channel: ChannelType | null
  /** The patch this protein sits in. */
  frame: WallSample
  /** Offset along the membrane from the patch's centre, scene px. */
  along: number
  /** Absolute scene position of its centre, on the membrane midline. */
  at: Pt
  /** Half-width along the membrane, scene px. */
  half: number
  /** Stagger, so channels do not all pass an ion at the same instant. */
  phase: number
}

/** Where the proteins sit, as fractions of the half-width of a patch. A patch
 *  this small — under a tenth of a micrometre — really would hold only a
 *  handful, though a real membrane is crowded with protein overall. */
const LAYOUT: Array<{ channel: ChannelId | null; at: number; phase: number }> = [
  { channel: 'leak-k', at: -0.86, phase: 0.15 },
  { channel: 'voltage-na', at: -0.44, phase: 0.4 },
  { channel: null, at: -0.02, phase: 0 },
  { channel: 'voltage-k', at: 0.42, phase: 0.7 },
  { channel: 'ligand', at: 0.84, phase: 0.25 },
]

/** Every protein in every membrane patch, placed once. */
/** The space a protein takes up, per side of the membrane: how far along the
 *  membrane it sits, its half-width, and how far it reaches out of the bilayer on
 *  that side. The ion crowd is kept out of these — a protein is solid matter, and
 *  an ion drawn inside one is not merely untidy: on the pump it lands among the
 *  ions being carried, and "count them: three out, two in" is the whole lesson
 *  that protein exists to teach. */
export interface ProteinFootprint {
  along: number
  half: number
  reach: number
}

export function proteinFootprints(side: Side): ProteinFootprint[] {
  return membraneProteins().map((protein) => ({
    along: protein.along,
    half: protein.half,
    // The pump reaches further into the cell than out of it.
    reach: side === 'inside' ? proteinIn(protein.kind) : PROTEIN_OUT,
  }))
}

export function membraneProteins(): ProteinInstance[] {
  const out: ProteinInstance[] = []
  for (const target of ZOOM_TARGETS) {
    const frame = target.frame
    if (!frame) continue
    const halfSpan = 0.16
    for (const spec of LAYOUT) {
      const along = spec.at * halfSpan
      const channel = spec.channel ? CHANNELS[spec.channel] : null
      out.push({
        kind: channel ? 'channel' : 'pump',
        channel,
        frame,
        along,
        at: {
          x: frame.at.x + frame.tangent.x * along,
          y: frame.at.y + frame.tangent.y * along,
        },
        half: channel ? nmToScene(channel.widthNm) / 2 : PUMP_HALF,
        phase: spec.phase,
      })
    }
  }
  return out
}

// --------------------------------------------------------------- pump cycle

export type PumpPhase = 'load-na' | 'spend-atp' | 'release-na' | 'load-k' | 'reset' | 'release-k'

const PHASES: Array<{ phase: PumpPhase; ms: number }> = [
  { phase: 'load-na', ms: 1400 },
  { phase: 'spend-atp', ms: 900 },
  { phase: 'release-na', ms: 1300 },
  { phase: 'load-k', ms: 1200 },
  { phase: 'reset', ms: 800 },
  { phase: 'release-k', ms: 1400 },
]

export const PUMP_CYCLE_MS = PHASES.reduce((sum, p) => sum + p.ms, 0)

/** How far out into the crowd a transported ion comes from, in u units. An ion
 *  has to arrive OUT OF the crowd and leave INTO it: appearing at the channel
 *  mouth and vanishing past it is an ion out of nowhere, which is the same
 *  misconception as a signal with no cause. */
export const CROWD_REACH = 3.2

export interface CarriedIon {
  kind: IonKind
  /** Opacity: an ion fades in and out while deep in the crowd, far from the
   *  channel, where one more or one fewer cannot be told apart. */
  alpha: number
  /** −1 = clear of the protein outside the cell, +1 = clear of it inside.
   *
   *  There is deliberately no sideways component: a pore is barely wider than a
   *  single ion, so anything offset across the channel travels through solid
   *  protein instead. Ions that need telling apart are spaced ALONG the channel,
   *  queueing one behind another. */
  u: number
}

export interface PumpState {
  phase: PumpPhase
  /** 0→1 within the current phase. */
  t: number
  carried: CarriedIon[]
  /** Which mouth is open. */
  openTo: 'inside' | 'outside' | 'closed'
  /** Brightness of the ATP spark, 0 when no energy is being spent. */
  atpFlash: number
}

/** Spacing between queued ions, along the channel. */
const QUEUE_GAP = 0.17

/** A queue of ions filing through the channel: spaced along it, the one nearest
 *  the exit leading. `dir` says which way counts as forward, which matters for
 *  the holds, where `from` and `to` are the same and the queue has to keep the
 *  order the previous move left it in. */
function queue(
  kind: IonKind,
  count: number,
  t: number,
  from: number,
  to: number,
  dir = Math.sign(to - from) || 1,
  alpha = 1,
): CarriedIon[] {
  const lead = 0.12
  return Array.from({ length: count }, (_, i) => {
    const rank = i - (count - 1) / 2
    const start = (i / Math.max(1, count - 1)) * lead
    const local = clamp01((t - start) / (1 - lead))
    return { kind, alpha, u: from - rank * QUEUE_GAP * dir + (to - from) * local }
  })
}

/** The pump's state `ms` into its cycle. Deliberately a pure function of the
 *  clock: the counting a kid does on screen is the counting the tests do. */
export function pumpStateAt(ms: number): PumpState {
  const cycle = ((ms % PUMP_CYCLE_MS) + PUMP_CYCLE_MS) % PUMP_CYCLE_MS
  let start = 0
  for (const step of PHASES) {
    if (cycle < start + step.ms) {
      const t = (cycle - start) / step.ms
      switch (step.phase) {
        case 'load-na':
          // Three sodium leave the cytoplasm and settle in the cavity.
          return {
            phase: step.phase,
            t,
            carried: queue('na', PUMP_NA_OUT, t, CROWD_REACH, -0.05, -1, clamp01(t / 0.15)),
            openTo: 'inside',
            atpFlash: 0,
          }
        case 'spend-atp':
          // Mouths shut, ATP is spent, the protein changes shape.
          return {
            phase: step.phase,
            t,
            // Occluded: held in the middle of the protein, both gates shut.
            carried: queue('na', PUMP_NA_OUT, 0, -0.05, -0.05, -1),
            openTo: 'closed',
            atpFlash: Math.sin(Math.PI * t),
          }
        case 'release-na':
          return {
            phase: step.phase,
            t,
            carried: queue('na', PUMP_NA_OUT, t, -0.05, -CROWD_REACH, -1, clamp01((1 - t) / 0.2)),
            openTo: 'outside',
            atpFlash: 0,
          }
        case 'load-k':
          // Two potassium come in from outside.
          return {
            phase: step.phase,
            t,
            carried: queue('k', PUMP_K_IN, t, -CROWD_REACH, 0.05, 1, clamp01(t / 0.15)),
            openTo: 'outside',
            atpFlash: 0,
          }
        case 'reset':
          return {
            phase: step.phase,
            t,
            carried: queue('k', PUMP_K_IN, 0, 0.05, 0.05, 1),
            openTo: 'closed',
            atpFlash: 0,
          }
        case 'release-k':
          return {
            phase: step.phase,
            t,
            carried: queue('k', PUMP_K_IN, t, 0.05, CROWD_REACH, 1, clamp01((1 - t) / 0.2)),
            openTo: 'inside',
            atpFlash: 0,
          }
      }
    }
    start += step.ms
  }
  return { phase: 'load-na', t: 0, carried: [], openTo: 'inside', atpFlash: 0 }
}

// ------------------------------------------------------------ leak channels

export const LEAK_CYCLE_MS = 2600

/** Ions crossing an OPEN channel right now, or none between crossings.
 *
 *  Direction comes from the gradient the kid has actually set up, never from the
 *  channel: a channel is a hole, and holes do no pushing. Flatten a gradient and
 *  its ion stops moving even through a wide-open door. Conductance sets the
 *  rate, so a fast channel visibly streams where the leak dribbles. */
export function channelIonsAt(
  channel: ChannelType,
  phase: number,
  ms: number,
  counts: IonCounts,
  vm: number,
): CarriedIon[] {
  const out: CarriedIon[] = []
  const active = 0.8
  channel.passes.forEach((ion, i) => {
    // Which way, and how hard, from the DRIVING FORCE — crowding and voltage
    // together — rather than from the crowding alone. It matters most exactly
    // where it used to be wrong: at the top of a spike the membrane is within a
    // couple of millivolts of sodium's own voltage, so sodium has stopped, and
    // the picture used to show it still pouring in.
    const direction = flowOf(ion, counts, vm)
    if (direction === 'none') return
    // And how fast: a channel visibly slows as the voltage approaches the point
    // where its ion stops caring, which is the reversal potential made visible.
    const push = Math.max(0.08, flowStrength(ion, counts, vm))
    const period = LEAK_CYCLE_MS / (channel.conductance * push)
    const cycle = (((ms / period + phase + i * 0.37) % 1) + 1) % 1
    // The gap in the cycle falls where the ion is already invisible, out among
    // the others — so a channel's rate still shows as how often it is crossed,
    // without anything blinking into existence beside it.
    if (cycle > active) return
    const from = direction === 'in' ? -1 : 1
    out.push({ kind: ion, ...transit(cycle / active, from) })
  })
  return out
}

/** One ion's whole journey: out of the crowd, through the pore, into the crowd
 *  on the far side. The crossing gets a slow quarter of the trip, because that
 *  is the part worth watching. */
function transit(progress: number, from: number): { u: number; alpha: number } {
  const near = 1.15
  const approach = 0.38
  const cross = 0.24
  let u: number
  if (progress < approach) {
    const p = progress / approach
    u = from * (CROWD_REACH - (CROWD_REACH - near) * p)
  } else if (progress < approach + cross) {
    const p = (progress - approach) / cross
    u = from * near * (1 - 2 * p)
  } else {
    const p = (progress - approach - cross) / (1 - approach - cross)
    u = -from * (near + (CROWD_REACH - near) * p)
  }
  // Fade only while far out among the other ions.
  return { u, alpha: Math.min(1, progress / 0.12, (1 - progress) / 0.12) }
}

/** Depth from the middle of the membrane for a carried ion, scene px. At u = ±1
 *  the ion is clear of the protein's own surface — asymmetric, because the pump
 *  reaches further into the cell than out of it. */
export function carriedDepth(u: number, ion: IonKind, protein: ProteinKind): number {
  const clear = ionRadius(ion) * 1.6
  return u < 0 ? u * (PROTEIN_OUT + clear) : u * (proteinIn(protein) + clear)
}
