import { AXON_DIAMETER_UM } from './membrane'
import type { TeachingPara } from './neuron'
import type { IonCounts } from '../state/ionStore'
import type { IonKind } from './ions'
import {
  C_M,
  DT,
  FIRE_STIMULUS,
  G_K_MAX,
  G_LEAK,
  G_NA_MAX,
  STIMULUS_MS,
  hInf,
  mInf,
  nInf,
  restingFrame,
  tauH,
  tauM,
  tauN,
} from './spikeModel'

// Propagation along the axon (N19), as a cable rather than as a journey.
//
// The whole milestone has been dismantling one misconception — that an action
// potential is a thing that gets pushed along a wire — so the model must not
// contain one. There is no travelling anything in this file. There are a hundred
// odd patches of membrane, each running exactly the physics one patch runs in
// spikeModel.ts, wired to their neighbours by nothing more exotic than the
// cytoplasm being a conductor:
//
//   C·dV/dt = −(I_Na + I_K + I_leak) + (d / 4·Ra)·∂²V/∂x²
//
// The last term is the only new idea. Depolarize one patch and current flows
// sideways into the patch next door, because charge spreads through a salty
// tube; that patch's own sodium doors notice, open, and the same thing happens
// again one patch further on. The wave is a CONSEQUENCE of a hundred local
// events, and it can be seen to be one: pause it anywhere and every patch is
// somewhere different in its own private spike.
//
// Two things fall out for free, and both are worth more than the picture:
//
//   • conduction speed is MEASURED off the result rather than typed in, which is
//     what the myelin comparison (N20–N21) will need;
//   • the spike cannot run backwards, because the patches behind it have their
//     sodium doors inactivated — which is the refractory period (N22) doing a
//     job rather than being asserted to exist.
//
// ------------------------------------------------------------------ on scale
//
// This is not, and cannot be, the axon drawn on the main stage. That one is
// about 93 µm long, which the neuron's own honesty note already owns up to —
// real axons are hundreds to thousands of times longer relative to the soma.
// 93 µm is a quarter of one length constant, and a spike crosses it in about a
// tenth of a millisecond: rendered truthfully, the whole drawn axon lights up at
// once, and there is nothing to see. Magnifying it does not help, because a
// camera changes magnification, not the specimen. So this view has its own
// stated scale — millimetres of real axon — and the drawn axon appears on its
// ruler as the tick it honestly is.

/** Resistivity of the cytoplasm, Ω·cm. The axon's inside is salty water with a
 *  lot of protein in it — a poor wire, roughly ten million times worse than
 *  copper, and that is the whole reason a neuron cannot simply let a voltage
 *  spread and must rebuild it instead. */
export const AXIAL_RESISTIVITY = 100

/** Resting membrane resistance, Ω·cm² — the leak, read the other way up. */
export const MEMBRANE_RESISTANCE = 1 / (G_LEAK * 1e-3)

/** How far a voltage spreads down a process before it has faded to a third of
 *  itself, µm. Not chosen: √(d·Rm / 4·Ra), from the process's own diameter, its
 *  own leak and the resistance of its own cytoplasm.
 *
 *  Everything about the size of this view follows from it. It takes a diameter
 *  because a dendrite is thinner than an axon and so spreads a voltage less far,
 *  and the little map of the whole cell needs to be able to say by how much. */
export function lengthConstantUm(diameterUm = AXON_DIAMETER_UM): number {
  const d = diameterUm * 1e-4
  return Math.sqrt((d * MEMBRANE_RESISTANCE) / (4 * AXIAL_RESISTIVITY)) * 1e4
}

/** How long a stretch of axon is on stage, µm.
 *
 *  Set by what has to be visible, and derived rather than picked: a patch's own
 *  spike lasts about two milliseconds, so at conduction speed the lit-up stretch
 *  is a couple of millimetres long. Show much less than four times that and the
 *  whole cable is lit at once and there is no wave; show much more and the wave
 *  is a dot. Eight millimetres of thin unmyelinated axon is an ordinary length —
 *  a pain fibre runs tens of centimetres. */
export const CABLE_LENGTH_UM = 6000

/** Length of one modelled patch, µm. A fifth of a length constant: fine enough
 *  that the curvature term is not made up by the grid, which the tests check by
 *  halving it and asking whether the speed moves. */
export const COMPARTMENT_UM = Math.round(lengthConstantUm() / 5)

/** How long the model is run for, ms of real time. The wave takes about ten to
 *  cross, and the rest is so that the far end can be watched falling back and
 *  dipping below rest rather than being cut off at its peak. */
export const CABLE_MS = 20

/** How much of the axon the stimulus is applied to, µm. An electrode touches a
 *  stretch of membrane, not a mathematical point, and it matters here: current
 *  put into one patch drains sideways into its neighbours, so the same push that
 *  fires an isolated patch may not fire a cable. That is a real fact about
 *  cables and the model is allowed to say it. Narrow the electrode to 200 µm and
 *  the same push still fires the sealed end, where the current can only drain one
 *  way, but no longer fires the middle, where it drains into both. */
export const STIM_WIDTH_UM = 400

/** Samples kept along the time axis. */
const SAMPLES = 200

// The five gate functions, tabulated.
//
// A cable is a hundred patches times ten thousand steps, and each step asks all
// five — five million exponentials for one run, which is most of the cost. They
// are read off a table on a twentieth-of-a-millivolt grid instead, interpolated
// linearly, which is a sixth of the price. This is an OPTIMISATION and nothing
// more: the table is built from the same functions spikeModel exports, over a
// range no membrane in this app can leave, and the tests check the two agree.
const GATE_LO = -140
const GATE_HI = 100
const GATE_STEP = 0.05
const GATE_N = Math.round((GATE_HI - GATE_LO) / GATE_STEP) + 1

function tabulate(f: (v: number) => number): Float64Array {
  const t = new Float64Array(GATE_N)
  for (let i = 0; i < GATE_N; i++) t[i] = f(GATE_LO + i * GATE_STEP)
  return t
}

const M_INF = tabulate(mInf)
const H_INF = tabulate(hInf)
const N_INF = tabulate(nInf)
const TAU_H = tabulate(tauH)
const TAU_N = tabulate(tauN)

function look(table: Float64Array, v: number): number {
  const x = (v - GATE_LO) / GATE_STEP
  const i = x < 0 ? 0 : x > GATE_N - 2 ? GATE_N - 2 : x | 0
  return table[i] + (table[i + 1] - table[i]) * (x - i)
}

/** The tabulated gates, exposed so the tests can hold them against the exact
 *  functions rather than trusting that a lookup is a lookup. */
export const tabulatedGates = {
  mInf: (v: number) => look(M_INF, v),
  hInf: (v: number) => look(H_INF, v),
  nInf: (v: number) => look(N_INF, v),
  tauH: (v: number) => look(TAU_H, v),
  tauN: (v: number) => look(TAU_N, v),
  range: [GATE_LO, GATE_HI] as const,
}

export interface CableTrajectory {
  /** Voltage, [patch][sample], mV. */
  vm: number[][]
  /** The two voltage-gated conductances, [patch][sample], in leak-channel units. */
  gNa: number[][]
  gK: number[][]
  /** How much charge each ion has carried across each patch so far, C/cm².
   *
   *  Charge, deliberately, and not a concentration. The single-patch model turns
   *  its charge into millimolar using the SOMA's volume-to-area ratio, which is
   *  the right thing there and the wrong thing here: an axon 1.4 µm across has a
   *  volume-to-area ratio fourteen times smaller, so the same charge is a far
   *  bigger concentration change. Rather than quietly quote a number computed for
   *  the wrong geometry, this stays as what was actually integrated. It is used
   *  as a ratio — how much has crossed compared with how much crosses in all —
   *  and a ratio does not care about the units. */
  naQ: number[][]
  kQ: number[][]
  /** The most either ion carries anywhere on the cable, C/cm². */
  naQMax: number
  kQMax: number
  /** Middle of each patch, µm from the stimulated end. */
  x: number[]
  /** Time at each sample, ms. */
  t: number[]
  /** Resting voltage every patch started from, mV. */
  rest: number
  /** Highest voltage each patch reached, mV. */
  peak: number[]
  /** When each patch first crossed zero, ms — Infinity where it never did. */
  crossedAt: number[]
  /** Conduction speed measured off `crossedAt`, m/s. Zero if nothing propagated. */
  speedMs: number
  /** How far the spike got, µm. */
  reachedUm: number
  /** Whether it reached the far end. */
  propagated: boolean
  /** Length of patch actually used, µm — the tests vary it. */
  dxUm: number
}

/** Axial coupling, µA/cm² per mV of curvature between neighbours. Derived from
 *  the tube's geometry and the cytoplasm's resistivity — a fatter axon or a
 *  better conductor couples harder, which is why fat axons are fast. */
export function axialCoupling(dxUm: number): number {
  const d = AXON_DIAMETER_UM * 1e-4
  const dx = dxUm * 1e-4
  return (1000 * d) / (4 * AXIAL_RESISTIVITY * dx * dx)
}

/** Largest integration step this grid is stable at, ms. Not decoration: an
 *  explicit step on a diffusive term blows up silently above C/2k, and a blown-up
 *  cable can look like a very fast axon. */
export function stableStep(dxUm: number): number {
  return C_M / (2 * axialCoupling(dxUm))
}

export interface CableOptions {
  lengthUm?: number
  dxUm?: number
  dtMs?: number
  msTotal?: number
  /** Where the push is applied, µm from the near end. Mid-cable is the
   *  demonstration that settles the argument: the spike leaves in BOTH
   *  directions, which nothing that travels can do. */
  stimAtUm?: number
  stimWidthUm?: number
}

/** Run the cable once. Everything downstream reads the table this returns, the
 *  same bargain the single-patch model makes: integrate once, then be a pure
 *  function of position — which is what keeps pause and scrub free. */
export function integrateCable(
  counts: IonCounts,
  leaksOn: boolean,
  stimulus: number,
  opts: CableOptions = {},
): CableTrajectory {
  const lengthUm = opts.lengthUm ?? CABLE_LENGTH_UM
  const dxUm = opts.dxUm ?? COMPARTMENT_UM
  const dt = opts.dtMs ?? DT
  const msTotal = opts.msTotal ?? CABLE_MS
  const stimAtUm = opts.stimAtUm ?? 0
  const stimWidthUm = opts.stimWidthUm ?? STIM_WIDTH_UM

  const n = Math.max(3, Math.round(lengthUm / dxUm))
  const { rest, leakTarget, eNa, eK } = restingFrame(counts, leaksOn)
  const k = axialCoupling(dxUm)

  const v = new Float64Array(n).fill(rest)
  const m = new Float64Array(n).fill(mInf(rest))
  const h = new Float64Array(n).fill(hInf(rest))
  const nGate = new Float64Array(n).fill(nInf(rest))
  const dv = new Float64Array(n)

  const x = Array.from({ length: n }, (_, i) => (i + 0.5) * dxUm)
  const stimulated = x.map(
    (px) => Math.abs(px - stimAtUm) <= stimWidthUm / 2 || (stimAtUm <= 0 && px <= stimWidthUm),
  )

  const qNa = new Float64Array(n)
  const qK = new Float64Array(n)

  const traj: CableTrajectory = {
    vm: Array.from({ length: n }, () => [] as number[]),
    gNa: Array.from({ length: n }, () => [] as number[]),
    gK: Array.from({ length: n }, () => [] as number[]),
    naQ: Array.from({ length: n }, () => [] as number[]),
    kQ: Array.from({ length: n }, () => [] as number[]),
    naQMax: 0,
    kQMax: 0,
    x,
    t: [],
    rest,
    peak: Array.from({ length: n }, () => rest),
    crossedAt: Array.from({ length: n }, () => Infinity),
    speedMs: 0,
    reachedUm: 0,
    propagated: false,
    dxUm,
  }

  const steps = Math.round(msTotal / dt)
  const every = Math.max(1, Math.round(steps / SAMPLES))

  for (let s = 0; s <= steps; s++) {
    const t = s * dt
    const keep = s % every === 0

    if (keep) traj.t.push(t)
    for (let i = 0; i < n; i++) {
      const gNa = G_NA_MAX * m[i] * m[i] * m[i] * h[i]
      const gK = G_K_MAX * nGate[i] ** 4
      if (keep) {
        traj.vm[i].push(v[i])
        // Leak-channel units, the same unit the patch view draws doors in.
        traj.gNa[i].push(gNa / G_LEAK)
        traj.gK[i].push(gK / G_LEAK)
        traj.naQ[i].push(qNa[i])
        traj.kQ[i].push(qK[i])
      }
      if (v[i] > traj.peak[i]) traj.peak[i] = v[i]
      if (v[i] > 0 && traj.crossedAt[i] === Infinity) traj.crossedAt[i] = t

      // Sealed ends: no current leaves the cut faces, so a missing neighbour is
      // treated as a copy of this patch. Anything else would quietly drain the
      // ends and make the model's own boundary look like a failure to propagate.
      const left = i === 0 ? v[0] : v[i - 1]
      const right = i === n - 1 ? v[n - 1] : v[i + 1]
      const iAxial = k * (left - 2 * v[i] + right)

      const iNa = gNa * (v[i] - eNa)
      const iK = gK * (v[i] - eK)
      const iLeak = G_LEAK * (v[i] - leakTarget)
      const iStim = t < STIMULUS_MS && stimulated[i] ? stimulus : 0
      // Only what crosses the RIGHT way counts: sodium falling in, potassium
      // leaving. A channel briefly carrying its ion backwards is real, and it is
      // not what "how much sodium has come in" means.
      if (iNa < 0) qNa[i] += -iNa * dt * 1e-9
      if (iK > 0) qK[i] += iK * dt * 1e-9

      dv[i] = ((-(iNa + iK + iLeak) + iStim + iAxial) / C_M) * dt
    }

    // Every patch steps on the same old voltages — updating in place would let
    // the wave outrun the physics by one patch per step, which reads as a
    // conduction speed and is really an artefact of the loop order.
    for (let i = 0; i < n; i++) {
      v[i] += dv[i]
      const vi = v[i]
      m[i] += ((look(M_INF, vi) - m[i]) / tauM) * dt
      h[i] += ((look(H_INF, vi) - h[i]) / look(TAU_H, vi)) * dt
      nGate[i] += ((look(N_INF, vi) - nGate[i]) / look(TAU_N, vi)) * dt
    }
  }

  for (let i = 0; i < n; i++) {
    traj.naQMax = Math.max(traj.naQMax, qNa[i])
    traj.kQMax = Math.max(traj.kQMax, qK[i])
  }
  measure(traj)
  return traj
}

/** Read the speed off the result, rather than putting one in.
 *
 *  Fitted over the middle of the cable only. Both ends lie: the stimulated end
 *  is still being pushed, and the far end is a sealed face where charge piles up
 *  with nowhere to go and fires the last patch early. Neither is conduction. */
function measure(traj: CableTrajectory): void {
  const n = traj.x.length
  const crossed = traj.crossedAt
  let last = -1
  for (let i = 0; i < n; i++) if (crossed[i] < Infinity) last = i
  traj.reachedUm = last < 0 ? 0 : traj.x[last]
  traj.propagated = last === n - 1

  const lo = Math.floor(n * 0.25)
  const hi = Math.floor(n * 0.75)
  const pts: Array<[number, number]> = []
  for (let i = lo; i <= hi; i++) {
    if (crossed[i] < Infinity) pts.push([crossed[i], traj.x[i]])
  }
  if (pts.length < 3) return
  const mean = (f: (p: [number, number]) => number) =>
    pts.reduce((a, p) => a + f(p), 0) / pts.length
  const tBar = mean((p) => p[0])
  const xBar = mean((p) => p[1])
  let num = 0
  let den = 0
  for (const [t, x] of pts) {
    num += (t - tBar) * (x - xBar)
    den += (t - tBar) ** 2
  }
  if (den <= 0) return
  // µm per ms is mm per second; metres per second is a thousand times smaller.
  traj.speedMs = Math.max(0, num / den / 1000)
}

// One cable is a million patch-steps of arithmetic — a tenth of a second, once,
// and then nothing. Cached on everything it depends on and only on that, so a
// stale wave is impossible.
const cache = new Map<string, CableTrajectory>()

function key(
  counts: IonCounts,
  leaksOn: boolean,
  stimulus: number,
  opts: CableOptions,
): string {
  let k = `${leaksOn ? 1 : 0}|${stimulus.toFixed(3)}|${opts.stimAtUm ?? 0}|${
    opts.lengthUm ?? CABLE_LENGTH_UM
  }|${opts.dxUm ?? COMPARTMENT_UM}|${opts.dtMs ?? DT}|${opts.msTotal ?? CABLE_MS}|${
    opts.stimWidthUm ?? STIM_WIDTH_UM
  }`
  for (const kind of Object.keys(counts) as IonKind[]) {
    k += `|${counts[kind].outside},${counts[kind].inside}`
  }
  return k
}

export function cableTrajectory(
  counts: IonCounts,
  leaksOn = true,
  stimulus = FIRE_STIMULUS,
  opts: CableOptions = {},
): CableTrajectory {
  const cacheKey = key(counts, leaksOn, stimulus, opts)
  const hit = cache.get(cacheKey)
  if (hit) return hit
  const run = integrateCable(counts, leaksOn, stimulus, opts)
  if (cache.size > 8) cache.clear()
  cache.set(cacheKey, run)
  return run
}

export type CableField = 'vm' | 'gNa' | 'gK' | 'naQ' | 'kQ'

/** Read the cable at a moment and a place, both as fractions 0→1. Bilinear
 *  between the stored patches and samples, so the drawing can use however many
 *  patches read well without the physics being pinned to a pixel count. */
export function sampleCable(
  traj: CableTrajectory,
  field: CableField,
  u: number,
  p: number,
): number {
  const rows = traj[field]
  const n = rows.length
  const samples = traj.t.length
  const xi = Math.max(0, Math.min(1, p)) * (n - 1)
  const ti = Math.max(0, Math.min(1, u)) * (samples - 1)
  const i0 = Math.floor(xi)
  const i1 = Math.min(n - 1, i0 + 1)
  const j0 = Math.floor(ti)
  const j1 = Math.min(samples - 1, j0 + 1)
  const fx = xi - i0
  const ft = ti - j0
  const a = rows[i0][j0] + (rows[i0][j1] - rows[i0][j0]) * ft
  const b = rows[i1][j0] + (rows[i1][j1] - rows[i1][j0]) * ft
  return a + (b - a) * fx
}

/** Where the front is at this moment, as a fraction along the cable — the
 *  furthest patch that has crossed zero. Null before anything has.
 *
 *  Reported for the ruler and the speed readout, NOT used to draw the wave. The
 *  wave is drawn patch by patch from the voltages; if this function vanished the
 *  picture would be unchanged. */
export function frontAt(traj: CableTrajectory, u: number): number | null {
  const now = Math.max(0, Math.min(1, u)) * (traj.t[traj.t.length - 1] ?? 0)
  let furthest = -1
  for (let i = 0; i < traj.x.length; i++) {
    if (traj.crossedAt[i] <= now) furthest = i
  }
  if (furthest < 0) return null
  return furthest / (traj.x.length - 1)
}

/** How much the spike shrinks between the quarter and three-quarter marks, as a
 *  fraction of its height there. An all-or-nothing signal does not fade, and this
 *  is how the claim gets checked rather than repeated. */
export function decrement(traj: CableTrajectory): number {
  const n = traj.x.length
  const near = traj.peak[Math.floor(n * 0.25)] - traj.rest
  const far = traj.peak[Math.floor(n * 0.75)] - traj.rest
  if (near <= 0) return 1
  return (near - far) / near
}

/** How long the drawn axon on the main stage is as a fraction of this view — the
 *  number that makes the scale break teachable rather than hidden. */
export function drawnAxonFraction(drawnUm: number): number {
  return drawnUm / CABLE_LENGTH_UM
}

export interface CableFacts {
  nothingMoves: TeachingPara
  saltyWater: TeachingPara
  whyMillimetres: TeachingPara
  measuredSpeed: TeachingPara
  whyMyelin: TeachingPara
  noFade: TeachingPara
  noGoingBack: TeachingPara
}

/** What the notes need to know about a run — and nothing else.
 *
 *  A plain reading rather than a trajectory, so that BOTH models can be described
 *  by the same words: the even-grid explicit one in this file, and the
 *  compartmental implicit one in fibre.ts that myelin needs. One set of sentences
 *  about conduction, however it was computed. */
export interface FibreReading {
  speedMs: number
  /** How much the spike shrinks between the quarter and three-quarter marks. */
  decrement: number
  lengthUm: number
  /** Whether this fibre had a sheath. */
  myelinated?: boolean
}

export function readingOf(traj: CableTrajectory): FibreReading {
  return {
    speedMs: traj.speedMs,
    decrement: decrement(traj),
    lengthUm: CABLE_LENGTH_UM,
    myelinated: false,
  }
}

/** The teaching notes, built from the numbers the model actually produced so
 *  they cannot overstate it.
 *
 *  Named rather than a bare list, because the panel groups them under headings
 *  and a heading that has drifted onto the wrong paragraph is a quiet way to
 *  teach the wrong thing. */
export function cableFacts(read: FibreReading, drawnAxonUm: number): CableFacts {
  const lambda = Math.round(lengthConstantUm())
  const speed = read.speedMs
  const crossMs = speed > 0 ? read.lengthUm / 1000 / speed : 0
  const fade = Math.round(read.decrement * 100)
  return {
    nothingMoves: {
      icon: '🁢',
      text: 'Nothing is moving along this axon. Every stripe is its own patch of membrane, running its own action potential from its own doors — the same spike you watched close up. What travels is the TURN: each patch, while it is depolarized, pushes charge sideways into the patch next door and starts it off.',
    },
    saltyWater: {
      icon: '🧂',
      text: `The push sideways works because the inside of an axon is salty water — a conductor, just a bad one. A voltage put in at one spot spreads about ${lambda} µm before it has faded to a third, so a patch can only wake its close neighbours. That is why the signal has to be rebuilt over and over instead of simply spreading to the end.`,
    },
    whyMillimetres: {
      icon: '📏',
      text: `That fading is also why this view is ${(read.lengthUm / 1000).toFixed(
        0,
      )} millimetres long. The axon drawn on the main stage is about ${Math.round(
        drawnAxonUm,
      )} µm — the small tick near the left of the ruler — and a spike crosses it in about a tenth of a millisecond. There would be nothing to watch: the whole thing would light up at once.`,
    },
    measuredSpeed: {
      icon: '⏱️',
      text:
        speed > 0
          ? `Measured off this run: about ${speed.toFixed(
              1,
            )} metres per second, so the wave takes roughly ${crossMs.toFixed(
              1,
            )} ms to cross. Nobody typed that in — it is the slope of when each patch crossed zero, and it changes when the axon does.`
          : 'Nothing propagated on this run, so there is no speed to report.',
    },
    // The obvious next question, and it has to be answered HERE. Anywhere this
    // app says "the whole axon fires at once" — the little map of the cell does —
    // a child is one step from concluding that axons have no delay, and therefore
    // that myelin is pointless. Both halves are needed in the same breath: over
    // this cell's 93 µm there is no delay worth seeing, and over the length of a
    // real nerve there is nothing BUT delay.
    whyMyelin: {
      icon: '🐌',
      text:
        speed > 0
          ? `Length is the whole story. Over the 93 µm of axon drawn on the main picture there is no delay worth seeing — a spike is done with the lot of it in a fraction of a millisecond. But nerves are not 93 µm long. At the speed this run measured, one reaching a metre down your leg would need about ${(
              1 / speed
            ).toFixed(
              1,
            )} seconds to get there, and you would fall over before you felt the floor. Making a thin bare axon like this one faster is what myelin is for, and it is the next thing to build here.`
          : 'Length is the whole story, and there is no speed on this run to work it out from.',
    },
    noFade: {
      icon: '🔒',
      text: `And it does not fade: the peak at the three-quarter mark is within ${Math.max(
        0,
        fade,
      )} % of the peak at the quarter mark. A ripple in a dendrite dies out, because nothing there rebuilds it. This is rebuilt at every step, so it arrives at full size — all-or-nothing, however far it goes.`,
    },
    noGoingBack: {
      icon: '↩️',
      text: 'Watch what is behind the wave: those patches are below their resting voltage and their sodium doors are latched shut. That is why nothing comes back the other way. The spike does not know which way is forwards — it simply cannot go where it has just been.',
    },
  }
}

/** Every note, in reading order — for the guardrail checks, which have to be
 *  able to sweep all of them without knowing what the panel does with each. */
export function cableFactList(
  read: FibreReading,
  drawnAxonUm: number,
): TeachingPara[] {
  const f = cableFacts(read, drawnAxonUm)
  return [
    f.nothingMoves,
    f.saltyWater,
    f.whyMillimetres,
    f.measuredSpeed,
    f.whyMyelin,
    f.noFade,
    f.noGoingBack,
  ]
}

/** Squid gates on a mammalian axon: the honesty note this view owes. */
export const CABLE_SIMPLIFICATION =
  'The doors here are Hodgkin and Huxley’s, measured in a squid at 6.3 °C, running on an axon a thousandth of a squid axon’s width. The speed that comes out is the right ballpark for a thin unmyelinated fibre — a fraction of a metre per second, slower than you walk — but it is a model’s answer, not a measurement of a real cell. The axon is also drawn straight and the same width everywhere, and both ends are sealed rather than carrying on.'

/** How much charge this ion has carried across this patch by now, C/cm².
 *
 *  An AMOUNT, deliberately, and not a share of the run. This is what a drawn ion
 *  in a pore is positioned by, and the difference matters: a share would have a
 *  feeble spike and a full one both finish at 1, so the same stream of ions would
 *  be drawn pouring through a membrane where hardly anything happened. An amount
 *  puts as many ions through the pore as there was current to put through it, and
 *  a run that fails shows a few creeping in and stopping — which is what a run
 *  that fails does.
 *
 *  A pore that moves ions because a clock is running is decoration. One that moves
 *  them by exactly this hurries at the peak of the current, stops dead when the
 *  door shuts, and never drifts backwards through a membrane. */
export function carried(
  traj: CableTrajectory,
  kind: 'na' | 'k',
  u: number,
  p: number,
): number {
  return sampleCable(traj, kind === 'na' ? 'naQ' : 'kQ', u, p)
}

export interface WaveReport {
  /** Where in the run we are, ms. */
  ms: number
  /** Furthest point to have crossed zero, µm — null before anything has. */
  frontUm: number | null
  /** How much of the axon is above zero at this instant, µm. */
  activeUm: number
  /** How much is below its own resting voltage — the tail that cannot fire
   *  again yet, µm. */
  refractoryUm: number
  /** How much has not been touched at all yet, µm. */
  untouchedUm: number
}

/** What the axon is doing at one instant, in micrometres of membrane.
 *
 *  Every sentence the panel says about the wave is built from this, so the words
 *  and the picture are reading the same numbers. "A stretch about two
 *  millimetres long is above zero" is a measurement here and a claim anywhere
 *  else. */
export function waveReport(traj: CableTrajectory, u: number): WaveReport {
  const last = traj.t[traj.t.length - 1] ?? 0
  const ms = Math.max(0, Math.min(1, u)) * last
  const n = traj.x.length
  const dx = traj.dxUm
  let active = 0
  let refractory = 0
  let untouched = 0
  let front: number | null = null
  for (let i = 0; i < n; i++) {
    const v = sampleCable(traj, 'vm', u, i / (n - 1))
    if (v > 0) active += dx
    // A twentieth of a millivolt of slack: floating-point noise at rest is not
    // an undershoot, and counting it as one would report a refractory tail on an
    // axon nothing has happened to.
    else if (v < traj.rest - 0.05) refractory += dx
    if (traj.crossedAt[i] <= ms) front = traj.x[i]
    if (traj.crossedAt[i] > ms) untouched += dx
  }
  return { ms, frontUm: front, activeUm: active, refractoryUm: refractory, untouchedUm: untouched }
}
