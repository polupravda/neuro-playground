import { CHANNELS } from './channels'
import { IONS, type IonKind } from './ions'
import { SOMA_DIAMETER_UM } from './membrane'
import { BACKGROUND, membraneVoltageFrom, nernstMv } from './voltage'
import type { IonCounts } from '../state/ionStore'

// The spike, integrated rather than described (N18).
//
// Milestone 3 opened with the two conductances written down as envelopes in
// time. That gave an honest SHAPE — the voltage was still read off the
// chord-conductance equation — but it could not give threshold, because
// threshold is not a shape. It is what happens when sodium entry starts
// outrunning potassium exit, so a little more depolarization opens a little more
// sodium, which depolarizes further. Feedback. An envelope in time cannot
// produce it, and a threshold typed in as a constant would be exactly the kind
// of asserted number this app refuses everywhere else.
//
// So the gates now answer to the VOLTAGE and the voltage answers to the gates:
//
//   dV/dt = −( I_Na + I_K + I_leak − I_stimulus ) / C
//
// with Hodgkin and Huxley's m³h and n⁴, in their units (mV, ms, mS/cm²,
// µF/cm²). The timing is then a consequence of the constants rather than
// something fitted: a spike takes about two milliseconds because a membrane
// carries about a microfarad per square centimetre.
//
// One thing had to be preserved. The whole of N17 — pause, scrub, the trace
// drawn before anything is fired — rests on a spike being a POSITION rather than
// an accumulated state, and an integrator is nothing but accumulated state. The
// resolution is that the integration happens ONCE, into a table indexed by
// position, and everything downstream keeps reading that table as a pure
// function. Memoised, not scripted: the numbers come out of the equations every
// time the gradients change.

/** Specific membrane capacitance, µF/cm². The same for essentially every cell:
 *  a 5 nm layer of fat is a 5 nm layer of fat. */
export const C_M = 1

/** Peak conductances, mS/cm² — Hodgkin and Huxley's own values. */
export const G_NA_MAX = 120
export const G_K_MAX = 36
/** The resting leak, mS/cm². What the membrane passes with no gate open. */
export const G_LEAK = 0.3

/** How wide each voltage-gated door can possibly get, in leak-channel units.
 *
 *  "How far open is this door" is measured against THIS, not against how far it
 *  happened to open on a particular run. The difference matters as soon as a run
 *  that does not fire exists: during a small nudge the potassium conductance
 *  reaches two leak-channels' worth, which is almost nothing — but it was most of
 *  that run's own maximum, so the channel was drawn wide open in a demonstration
 *  whose whole point is that nothing happened. */
export const G_NA_CEILING = G_NA_MAX / G_LEAK
export const G_K_CEILING = G_K_MAX / G_LEAK

/** Faraday's constant, C/mol. */
const FARADAY = 96485
/** Volume-to-area ratio of the cell body, cm — r/3 for a sphere, and the soma is
 *  20 µm across everywhere else in the app. */
const VOLUME_PER_AREA = ((SOMA_DIAMETER_UM / 2) * 1e-4) / 3

/** How long the model is run for, ms of real time. Long enough for the spike and
 *  for the undershoot to come most of the way back — potassium's gate is slow to
 *  shut, so the tail is long. */
export const SPIKE_MS = 20

/** How long the stimulus lasts, ms. A brief nudge, as an arriving synaptic
 *  current is: long enough to charge the membrane, too short to hold it there. */
export const STIMULUS_MS = 0.6

/** Integration step, ms. Small enough that halving it changes nothing visible —
 *  asserted in the tests, because an unstable integrator can look plausible. */
export const DT = 0.002

/** Samples kept, evenly spaced across SPIKE_MS. */
const SAMPLES = 240

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x))

// Gate steady states and time constants. Sodium's opening gate is fast, its
// closing gate slow, and potassium's opening gate slower still — that ordering,
// and nothing else, is what makes a spike rise and fall.
export const mInf = (v: number): number => sigmoid((v + 40) / 7)
export const hInf = (v: number): number => sigmoid(-(v + 62) / 6)
export const nInf = (v: number): number => sigmoid((v + 53) / 12)
export const tauM = 0.12
export const tauH = (v: number): number => 1 + 6 * sigmoid(-(v + 40) / 8)
export const tauN = (v: number): number => 2 + 3 * sigmoid(-(v + 40) / 10)

export interface Trajectory {
  /** Membrane voltage at each sample, mV. */
  vm: number[]
  /** The two voltage-gated conductances, in units of ONE potassium leak channel
   *  — the unit the rest of the app measures permeability in. */
  gNa: number[]
  gK: number[]
  /** Sodium gained inside and potassium lost, cumulative, mM. */
  naIn: number[]
  kOut: number[]
  /** Where it started and ended up, mV. */
  rest: number
  peak: number
  trough: number
  /** Widest each gate got, in leak-channel units — so "how far open is this
   *  door" can be asked as a fraction of its own maximum. */
  gNaMax: number
  gKMax: number
  /** Positions, 0→1, of the highest and lowest voltage. */
  uPeak: number
  uTrough: number
  /** Whether it overshot zero. An action potential does; a nudge does not. */
  fired: boolean
  /** How long this run covers, ms. Twenty for a single spike, longer when a
   *  second push has to fit — so nothing downstream may assume SPIKE_MS. */
  windowMs: number
}

/** Resting voltage from the chord-conductance equation — the same one Milestone 2
 *  derives the resting potential with, so the two cannot disagree. The leak in
 *  this model pulls towards it. */
function chordRest(counts: IonCounts, leaksOn: boolean): number {
  const g = {
    na: BACKGROUND.na ?? 0,
    k: leaksOn ? CHANNELS['leak-k'].conductance : 0,
    cl: BACKGROUND.cl ?? 0,
    ca: 0,
  }
  return membraneVoltageFrom(counts, g)
}

// A note on where the spike STARTS, because getting this wrong would have
// contradicted a lesson two milestones old.
//
// The obvious choice is the model's own relaxed steady state. Do that and
// blocking the potassium leaks no longer sends the voltage UP to −41 mV, as
// Milestone 2's checkpoint A demonstrates: it climbs, the delayed rectifier
// notices −41 mV and opens, and the membrane is dragged back to −88. That is real
// physics — it is what delayed rectification means — but it is a different lesson
// from the one the resting-potential step teaches, and having the app quote two
// different resting voltages would be worse than either.
//
// So the integration starts where the chord-conductance equation says the
// membrane sits, and the leak pulls towards the same place. At real gradients the
// two agree to about a millivolt, because the voltage-gated potassium gate is
// genuinely almost shut at −72 mV. The resting lessons keep their authority, and
// the spike is still integrated from there.

export interface RestingFrame {
  /** Where the membrane sits before anything is done to it, mV. */
  rest: number
  /** Where the leak pulls towards, mV — see below. */
  leakTarget: number
  eNa: number
  eK: number
}

/** Where an integration starts, and what the leak aims at. Shared with the cable
 *  model (N19): every compartment of an axon has to begin at the same resting
 *  voltage one patch does, or the two views would quote different numbers for
 *  the same membrane. */
export function restingFrame(counts: IonCounts, leaksOn: boolean): RestingFrame {
  const eNa = nernstMv('na', counts)
  const eK = nernstMv('k', counts)
  const rest = chordRest(counts, leaksOn)
  // Where the leak pulls towards. NOT the resting voltage itself: at rest a
  // whisper of both voltage-gated conductances is open, and if the leak aimed at
  // the resting voltage those would drag the membrane a millivolt and a half
  // below it — so the trace would end lower than it started and the last step's
  // "back to resting" would be a lie. Solving for the target that makes the
  // resting voltage a true equilibrium of this model fixes that, and the offset
  // stands for what the model leaves out: the pump's small electrogenic pull, and
  // every channel not drawn here.
  const leakTarget =
    rest +
    (G_NA_MAX * mInf(rest) ** 3 * hInf(rest) * (rest - eNa) +
      G_K_MAX * nInf(rest) ** 4 * (rest - eK)) /
      G_LEAK
  return { rest, leakTarget, eNa, eK }
}

/** A second push, some time after the first — the paired-pulse experiment N22 is
 *  built on. Null for the ordinary single spike. */
export interface SecondPush {
  /** When it arrives, ms after the first. */
  atMs: number
  /** How hard, µA/cm². */
  amplitude: number
}

/** How long the model runs for when there is a second push, ms. Long enough to
 *  hold both spikes and the tail of the later one however far out it lands. */
export const PAIRED_MS = 45

/** Run the model once. `stimulus` is the injected current during the first
 *  STIMULUS_MS, in µA/cm².
 *
 *  `again` adds a second push later in the same run, and nothing else changes:
 *  the gates carry on from wherever the first spike left them, which is the entire
 *  mechanism of the refractory period. Sodium's h gate is still shut, potassium's
 *  n gate is still open, and whether a second spike happens is decided by those
 *  two facts rather than by any rule written for the occasion. */
export function integrate(
  counts: IonCounts,
  leaksOn: boolean,
  stimulus: number,
  again: SecondPush | null = null,
): Trajectory {
  const { eNa, eK, rest, leakTarget } = restingFrame(counts, leaksOn)
  let v = rest
  let m = mInf(v)
  let h = hInf(v)
  let n = nInf(v)
  // Charge carried by each ion, C/cm², accumulated as we go.
  let qNa = 0
  let qK = 0

  // How long this run covers. A paired run needs room for both spikes and the
  // tail of the later one; everything downstream reads it off the trajectory
  // rather than assuming, so a position still means the same fraction of
  // whatever run it belongs to.
  const windowMs = again ? PAIRED_MS : SPIKE_MS
  const every = Math.max(1, Math.round(windowMs / DT / SAMPLES))
  const traj: Trajectory = {
    vm: [],
    gNa: [],
    gK: [],
    naIn: [],
    kOut: [],
    rest,
    peak: rest,
    trough: rest,
    gNaMax: 0,
    gKMax: 0,
    uPeak: 0,
    uTrough: 0,
    fired: false,
    windowMs,
  }

  const steps = Math.round(windowMs / DT)
  for (let i = 0; i <= steps; i++) {
    const t = i * DT
    const gNa = G_NA_MAX * m * m * m * h
    const gK = G_K_MAX * n * n * n * n

    if (i % every === 0) {
      traj.vm.push(v)
      // Reported in leak-channel units, which is what the drawing and the
      // conductance shares are expressed in.
      traj.gNa.push(gNa / G_LEAK)
      traj.gK.push(gK / G_LEAK)
      traj.naIn.push(mM(qNa))
      traj.kOut.push(mM(qK))
    }
    if (v > traj.peak) {
      traj.peak = v
      traj.uPeak = t / windowMs
    }
    if (v < traj.trough) {
      traj.trough = v
      traj.uTrough = t / windowMs
    }
    traj.gNaMax = Math.max(traj.gNaMax, gNa / G_LEAK)
    traj.gKMax = Math.max(traj.gKMax, gK / G_LEAK)

    const iNa = gNa * (v - eNa)
    const iK = gK * (v - eK)
    const iLeak = G_LEAK * (v - leakTarget)
    const iStim =
      (t < STIMULUS_MS ? stimulus : 0) +
      (again && t >= again.atMs && t < again.atMs + STIMULUS_MS ? again.amplitude : 0)
    // µA/cm² × ms ÷ 1000 = mC/cm²... kept in C/cm² directly.
    if (iNa < 0) qNa += -iNa * DT * 1e-9
    if (iK > 0) qK += iK * DT * 1e-9

    v += ((-(iNa + iK + iLeak) + iStim) / C_M) * DT
    m += ((mInf(v) - m) / tauM) * DT
    h += ((hInf(v) - h) / tauH(v)) * DT
    n += ((nInf(v) - n) / tauN(v)) * DT
  }

  // What counts as a spike: overshooting zero, which is the definition the app
  // states in words elsewhere. The second clause is for one degenerate case —
  // with every gradient flattened the membrane rests AT zero, so the faintest
  // wobble crossed it and read as a spike.
  //
  // A regeneration test was tried instead (did the voltage keep climbing after
  // the push stopped?) and abandoned: a large enough stimulus reaches the peak
  // DURING the pulse, so the test failed at high amplitudes and made
  // `thresholdStimulus` non-monotonic, which broke its bisection.
  traj.fired = traj.peak > 0 && traj.peak > rest + 40
  return traj
}

/** Charge per unit area, C/cm², as a concentration change inside the cell, mM. */
function mM(coulomb: number): number {
  return (coulomb / FARADAY / VOLUME_PER_AREA) * 1e6
}

/** What the fire button injects, µA/cm². About twice threshold at real
 *  gradients — and FIXED, deliberately: flatten sodium's gradient and threshold
 *  rises past it, so the spike fails for a reason rather than because the app
 *  quietly turned the stimulus up to keep it working. */
export const FIRE_STIMULUS = 60

/** Smallest stimulus that produces a spike, µA/cm² — found by bisection on the
 *  model, so THRESHOLD IS MEASURED. It moves when the gradients move, which is
 *  the whole point of being able to change them. */
export function thresholdStimulus(counts: IonCounts, leaksOn: boolean): number {
  let low = 0
  let high = 200
  if (!integrate(counts, leaksOn, high).fired) return Infinity
  for (let i = 0; i < 22; i++) {
    const mid = (low + high) / 2
    if (integrate(counts, leaksOn, mid).fired) high = mid
    else low = mid
  }
  return high
}

// One trajectory is a few thousand steps of arithmetic, and the drawing wants it
// sixty times a second. Cached on everything it depends on — and ONLY on things
// it depends on, so a stale spike is impossible.
const cache = new Map<string, Trajectory>()

function key(
  counts: IonCounts,
  leaksOn: boolean,
  stimulus: number,
  again: SecondPush | null,
): string {
  let k = `${leaksOn ? 1 : 0}|${stimulus.toFixed(3)}|${
    again ? `${again.atMs.toFixed(3)},${again.amplitude.toFixed(3)}` : '-'
  }`
  for (const kind of Object.keys(counts) as IonKind[]) {
    k += `|${counts[kind].outside},${counts[kind].inside}`
  }
  return k
}

export function trajectory(
  counts: IonCounts,
  leaksOn: boolean,
  stimulus: number,
  again: SecondPush | null = null,
): Trajectory {
  const k = key(counts, leaksOn, stimulus, again)
  const hit = cache.get(k)
  if (hit) return hit
  const run = integrate(counts, leaksOn, stimulus, again)
  // A handful of entries is all the app ever needs; this only guards against a
  // slider being dragged through hundreds of values.
  if (cache.size > 64) cache.clear()
  cache.set(k, run)
  return run
}

/** Read a trajectory at a position 0→1, interpolating between samples. */
export function sampleAt<K extends 'vm' | 'gNa' | 'gK' | 'naIn' | 'kOut'>(
  traj: Trajectory,
  field: K,
  u: number,
): number {
  const series = traj[field]
  const x = Math.max(0, Math.min(1, u)) * (series.length - 1)
  const i = Math.floor(x)
  const j = Math.min(series.length - 1, i + 1)
  return series[i] + (series[j] - series[i]) * (x - i)
}

export { IONS }
