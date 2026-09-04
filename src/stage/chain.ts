import {
  amplitudeAtHillock,
  reachesThreshold,
  rippleAmplitude,
} from '../core/integration'
import { ARBOR_MAX_LEN, AXON_POLYLINE, clamp01, pathLength } from './layout'

// The causal chain, as a pure function of elapsed time. Every signal on the
// stage comes from here, which is what keeps signals from appearing out of
// nowhere: nothing moves unless an input neuron was fired, and the axon can
// only carry an action potential AFTER the summed input crossed threshold at
// the hillock.
//
// Durations are pedagogical choreography (spec: "Animations must be long
// enough to reveal causality"), not biological timing — a real chain like
// this takes a few milliseconds, which is stated in the info panel.

export const PRESYN_AP_MS = 900
/** Chemical hand-off: transmitter crossing plus receptor opening. Real
 *  synaptic delay is ~0.5–1 ms; drawn slowly so the gap is visible. */
export const SYNAPTIC_DELAY_MS = 420
export const DENDRITE_MS = 1500
export const SUM_HOLD_MS = 600
export const AXON_AP_MS = 1700
export const TERMINAL_MS = 1000
export const POSTSYN_MS = 1200
export const FIZZLE_MS = 1100

/** ⚠ THE ARBOR IS INVADED, NOT SWITCHED ON (corrections 2026-09-04: "the
 *  whole thing lights up at once… not consistent with the rest of the
 *  neuron"). The spike actively propagates into the terminal arborization,
 *  forking at each branch point, reaching the near boutons first — an arbor
 *  lighting as a unit is the axon misconception replayed at the last fork.
 *  The leg's duration is MEASURED, not chosen: the wave keeps the axon leg's
 *  own pace (pixels per screen-millisecond) through the forks, so the journey
 *  does not change speed where the cable branches. Choreography like every
 *  duration here — a real arbor is invaded in tens of microseconds. */
export const ARBOR_MS =
  Math.round((AXON_AP_MS * ARBOR_MAX_LEN) / pathLength(AXON_POLYLINE) / 10) * 10

const T_RELEASE = PRESYN_AP_MS
const T_RIPPLE = T_RELEASE + SYNAPTIC_DELAY_MS
const T_ARRIVE = T_RIPPLE + DENDRITE_MS
const T_DECIDE = T_ARRIVE + SUM_HOLD_MS
const T_AXON_END = T_DECIDE + AXON_AP_MS
const T_ARBOR_END = T_AXON_END + ARBOR_MS
const T_TERMINAL_END = T_ARBOR_END + TERMINAL_MS
const T_POST_END = T_TERMINAL_END + POSTSYN_MS

export const FIRING_RUN_MS = T_POST_END
export const FIZZLED_RUN_MS = T_DECIDE + FIZZLE_MS

export type ChainPhase =
  | 'idle'
  | 'input-fires'
  | 'crossing'
  | 'dendrite'
  | 'summing'
  | 'fizzled'
  | 'axon'
  | 'terminal'
  | 'target'
  | 'done'

export interface ChainState {
  phase: ChainPhase
  /** Whether this run crosses threshold at all. */
  fires: boolean
  /** Progress of the action potential along each input neuron's axon. */
  presynAP: number | null
  /** Flash at an input neuron's soma as it fires. */
  presynFlash: number
  /** Transmitter crossing the incoming cleft, 0 → 1. */
  crossing: number | null
  /** Ripple position on our dendrite, 0 at the synapse → 1 at the soma. */
  ripple: number | null
  /** That ripple's amplitude right now (decays as it travels). */
  rippleStrength: number
  /** Summed depolarization at the hillock, on the same 0–1 scale. */
  hillockLevel: number
  /** Flash when the hillock launches an action potential. */
  hillockFlash: number
  /** Our action potential along our axon — null unless threshold was met. */
  axonHead: number | null
  /** The action potential arriving in the terminal arbor, 0→1.
   *
   *  Its own signal, separate from the release that follows, because they are two
   *  events and the gap between them is a lesson: the spike gets there, and THEN
   *  calcium and vesicles do something about it. Without this the axon's glow
   *  reached the last branch point and simply stopped, and the boutons sat dark
   *  until a release glow appeared half a second later — the arrival, which is the
   *  whole point of the journey, was the one moment not drawn. */
  terminalAP: number
  /** The wave's front through the arbor: distance travelled as a fraction of
   *  the LONGEST terminal route (read per route with layout's terminalReach).
   *  Null until the wave enters the arbor; 1 once every bouton is reached. */
  terminalHead: number | null
  /** Vesicles drifting to the membrane in our boutons. */
  terminalDrift: number
  /** Release glow at our boutons. */
  terminalRelease: number
  /** Transmitter crossing the outgoing cleft. */
  outgoingCrossing: number | null
  /** Ripple on the target neuron's dendrite. */
  targetRipple: number | null
  /** Flash at the target neuron's soma (small — one input is not enough). */
  targetFlash: number
}

export const IDLE: ChainState = {
  phase: 'idle',
  fires: false,
  presynAP: null,
  presynFlash: 0,
  crossing: null,
  ripple: null,
  rippleStrength: 0,
  hillockLevel: 0,
  hillockFlash: 0,
  axonHead: null,
  terminalAP: 0,
  terminalHead: null,
  terminalDrift: 0,
  terminalRelease: 0,
  outgoingCrossing: null,
  targetRipple: null,
  targetFlash: 0,
}

const bell = (p: number): number => Math.sin(Math.PI * clamp01(p))

/** State of a run in which `inputCount` input neurons fired together, `ms`
 *  after the click. */
export function chainStateAt(ms: number, inputCount: number): ChainState {
  if (inputCount <= 0) return IDLE
  const fires = reachesThreshold(inputCount)
  const peak = amplitudeAtHillock(inputCount)
  const s: ChainState = { ...IDLE, fires }

  if (ms < T_RELEASE) {
    // The input neurons fire: their own action potentials run to their boutons.
    s.phase = 'input-fires'
    s.presynAP = clamp01(ms / PRESYN_AP_MS)
    s.presynFlash = 1 - clamp01(ms / 420)
    return s
  }

  if (ms < T_RIPPLE) {
    // Chemical hand-off across the gap.
    s.phase = 'crossing'
    s.crossing = clamp01((ms - T_RELEASE) / SYNAPTIC_DELAY_MS)
    return s
  }

  if (ms < T_ARRIVE) {
    // A graded ripple spreads inward, fading as it goes, and the running
    // total at the hillock climbs as it approaches.
    const p = clamp01((ms - T_RIPPLE) / DENDRITE_MS)
    s.phase = 'dendrite'
    s.ripple = p
    s.rippleStrength = rippleAmplitude(p)
    s.hillockLevel = peak * p
    return s
  }

  if (ms < T_DECIDE) {
    // The total sits at the hillock and is tested against threshold.
    s.phase = 'summing'
    s.hillockLevel = peak
    return s
  }

  if (!fires) {
    // Below threshold: the depolarization leaks away and nothing is sent.
    const p = clamp01((ms - T_DECIDE) / FIZZLE_MS)
    s.phase = p >= 1 ? 'done' : 'fizzled'
    s.hillockLevel = peak * (1 - p)
    return s
  }

  if (ms < T_AXON_END) {
    // Threshold crossed: an action potential is born AT THE HILLOCK and
    // travels at constant amplitude.
    const p = clamp01((ms - T_DECIDE) / AXON_AP_MS)
    s.phase = 'axon'
    s.hillockLevel = peak
    s.hillockFlash = 1 - clamp01(p / 0.18)
    s.axonHead = p
    return s
  }

  if (ms < T_ARBOR_END) {
    // The spike INVADES the arbor: one wave at the axon's own pace, forking
    // at the branch points, near boutons first (per-route coverage is
    // layout's terminalReach) — it takes over at the tip the moment the axon
    // head lands there, so the journey never blinks.
    const p = clamp01((ms - T_AXON_END) / ARBOR_MS)
    s.phase = 'terminal'
    s.hillockLevel = peak
    s.terminalHead = p
    s.terminalAP = 1
    return s
  }

  if (ms < T_TERMINAL_END) {
    // Arrived at every bouton: vesicles move to the membrane and release.
    const p = clamp01((ms - T_ARBOR_END) / TERMINAL_MS)
    s.phase = 'terminal'
    s.hillockLevel = peak * (1 - p)
    s.terminalHead = 1
    // Still lit on arrival, fading as the release takes over — so the two read as
    // cause and consequence rather than as one glow doing both jobs.
    s.terminalAP = 1 - clamp01(p / 0.5)
    s.terminalDrift = clamp01(p / 0.55)
    s.terminalRelease = p > 0.45 ? bell((p - 0.45) / 0.55) : 0
    s.outgoingCrossing = p > 0.6 ? clamp01((p - 0.6) / 0.4) : null
    return s
  }

  if (ms < T_POST_END) {
    // The target neuron gets one small ripple — not enough on its own.
    const p = clamp01((ms - T_TERMINAL_END) / POSTSYN_MS)
    s.phase = 'target'
    s.terminalDrift = 1 - clamp01((p - 0.5) / 0.5)
    s.targetRipple = clamp01(p / 0.75)
    s.targetFlash = p > 0.7 ? bell((p - 0.7) / 0.3) * 0.6 : 0
    return s
  }

  s.phase = 'done'
  return s
}

/** How long a run with this many inputs lasts. */
export function runDuration(inputCount: number): number {
  return reachesThreshold(inputCount) ? FIRING_RUN_MS : FIZZLED_RUN_MS
}
