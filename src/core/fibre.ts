import { AXON_DIAMETER_UM } from './membrane'
import {
  AXIAL_RESISTIVITY,
  MEMBRANE_RESISTANCE,
  lengthConstantUm,
  type FibreReading,
} from './cable'
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
import type { IonCounts } from '../state/ionStore'
import type { IonKind } from './ions'
import type { TeachingPara } from './neuron'

// A nerve fibre, bare or myelinated (N20–N21).
//
// `cable.ts` models a bare axon on an even grid with an explicit step, and cannot
// be made to do myelin. The arithmetic is unforgiving and worth writing down,
// because it is the reason this file exists rather than a flag on the other one:
//
//   • A node of Ranvier is about 1 µm long, so the grid has to resolve 1 µm.
//   • An explicit step on the axial term needs dt < C / 2k, and k grows as 1/Δx².
//     At Δx = 1 µm that is 1.4 × 10⁻⁵ ms — already seven times smaller than the
//     step `cable.ts` uses.
//   • Myelin then divides the capacitance by the number of wraps, which divides
//     that limit again: about 6 × 10⁻⁷ ms, or 3,500 times smaller than the step
//     we take now. Twenty milliseconds of it is thirty-five million steps.
//
// So this model does two things differently, and both are the standard answers
// rather than inventions of ours:
//
//   1. A NON-UNIFORM grid. A node is one short compartment and an internode is a
//      handful of long ones, which is how a myelinated fibre is actually modelled
//      and cuts the compartment count by a factor of twenty against resolving
//      everything at 1 µm.
//   2. An IMPLICIT step for the axial current — backward Euler, solved as a
//      tridiagonal system. Unconditionally stable, so the step is set by how fast
//      the gates move rather than by how finely the axon is chopped. The gates
//      and the ionic currents stay explicit, at the same step `cable.ts` uses and
//      for the same reason: it is small enough that halving it changes nothing.
//
// Everything is in absolute units here (a compartment's area, its capacitance in
// µF, the axial resistance between neighbours in ohms) rather than per unit area,
// because with compartments of different lengths there is no common area to
// divide by. The physics is the same physics.

/** Length of a node of Ranvier, µm. About a thousandth of the internode it sits
 *  between, and it is where every voltage-gated sodium channel lives. */
export const NODE_UM = 1

/** How much more thickly a node of Ranvier is studded with voltage-gated sodium
 *  channels than bare axon membrane is.
 *
 *  Not a fudge and not optional. A node carries something like a thousand to two
 *  thousand sodium channels per square micrometre against roughly a hundred in an
 *  unmyelinated axon — the clustering IS half of what myelination is, and leaving
 *  it out is what a first attempt at this model did. With squid densities at the
 *  node the sheath still helped, but only about threefold, because each node had
 *  too few channels to drive the next one hard.
 *
 *  Set to the low end of the measured range, so the speed that comes out is a
 *  cautious answer rather than a flattering one. */
export const NODE_DENSITY = 12

/** How many compartments an internode is chopped into. Enough that the voltage
 *  along it is not one lump, few enough that the model stays cheap. */
const INTERNODE_PARTS = 6

/** Internode length, µm: about a hundred times the axon's diameter, which is the
 *  relationship real myelinated fibres keep across a wide range of sizes. */
export function internodeUm(diameterUm = AXON_DIAMETER_UM): number {
  return Math.round(100 * diameterUm)
}

/** How many wraps of membrane the sheath has.
 *
 *  From the g-ratio — the axon's diameter over the whole fibre's, which sits near
 *  0.65 in real nerve — and the thickness of one wrap, about 15 nm of compacted
 *  double membrane. A 1.4 µm axon comes out with a sheath a third of a micrometre
 *  thick, which is around two dozen turns.
 *
 *  It matters twice over, and in the same direction both times: the wraps are
 *  capacitors in series, so the capacitance divides by this, and resistors in
 *  series, so the leak divides by it too. */
export function lamellae(diameterUm = AXON_DIAMETER_UM): number {
  const G_RATIO = 0.65
  const WRAP_UM = 0.015
  return Math.max(1, Math.round((diameterUm / G_RATIO - diameterUm) / 2 / WRAP_UM))
}

export interface Compartment {
  /** Centre, µm from the stimulated end. */
  x: number
  lengthUm: number
  /** Whether this patch has voltage-gated channels in it. Bare axon: all of them.
   *  Myelinated: only the nodes. */
  excitable: boolean
  /** How much the sheath divides this patch's capacitance and leak. 1 where there
   *  is no sheath. */
  wraps: number
  /** How thickly this patch is studded with voltage-gated channels, relative to a
   *  bare axon's membrane. 1 everywhere except a node of Ranvier. */
  density: number
}

export interface FibreSpec {
  lengthUm: number
  /** Override the node's channel density, for the tests that check it matters. */
  nodeDensity?: number
  diameterUm?: number
  /** Null for a bare axon. */
  myelin?: { nodeUm: number; internodeUm: number; wraps: number } | null
  /** Compartment length on a bare axon, µm. */
  dxUm?: number
}

/** Standard myelin for an axon of this diameter — every number derived above. */
export function myelinFor(diameterUm = AXON_DIAMETER_UM) {
  return {
    nodeUm: NODE_UM,
    internodeUm: internodeUm(diameterUm),
    wraps: lamellae(diameterUm),
  }
}

/** Chop a fibre into compartments: an even row for a bare axon, and nodes
 *  separated by internodes for a myelinated one. It always begins with a node, so
 *  the push has somewhere excitable to land. */
export function compartments(spec: FibreSpec): Compartment[] {
  const out: Compartment[] = []
  let at = 0
  const push = (lengthUm: number, excitable: boolean, wraps: number, density = 1) => {
    out.push({ x: at + lengthUm / 2, lengthUm, excitable, wraps, density })
    at += lengthUm
  }
  if (!spec.myelin) {
    const dx = spec.dxUm ?? 20
    while (at < spec.lengthUm - 1e-9) push(Math.min(dx, spec.lengthUm - at), true, 1)
    return out
  }
  const { nodeUm, internodeUm: gap, wraps } = spec.myelin
  while (at < spec.lengthUm - 1e-9) {
    push(Math.min(nodeUm, spec.lengthUm - at), true, 1, spec.nodeDensity ?? NODE_DENSITY)
    for (let i = 0; i < INTERNODE_PARTS && at < spec.lengthUm - 1e-9; i++) {
      push(Math.min(gap / INTERNODE_PARTS, spec.lengthUm - at), false, wraps)
    }
  }
  return out
}

export interface FibreRun {
  parts: Compartment[]
  /** Voltage, [compartment][sample], mV. */
  vm: number[][]
  /** How far open each door is, [compartment][sample], 0→1 — m³h and n⁴
   *  themselves, so "how far open" is measured against THIS patch's own widest
   *  rather than against a bare axon's. A node carries a dozen times the channels
   *  and its door is still a door. */
  naOpen: number[][]
  kOpen: number[][]
  /** Charge each ion has carried across each patch so far, C/cm². Stays at zero
   *  under a sheath, where there are no voltage-gated channels to carry it. */
  naQ: number[][]
  kQ: number[][]
  t: number[]
  /** How long the fibre is, µm. */
  lengthUm: number
  rest: number
  peak: number[]
  crossedAt: number[]
  /** Conduction speed measured off `crossedAt`, m/s. Zero if nothing propagated. */
  speedMs: number
  reachedUm: number
  propagated: boolean
  /** Whether this fibre had a sheath. */
  myelinated: boolean
}

export interface Saltation {
  /** Spread of firing times WITHIN one internode, ms — how long the stretch
   *  between two nodes takes to go off, from end to end. */
  withinMs: number
  /** Step from one internode to the next, ms. */
  betweenMs: number
  /** How many times bigger the step is than the spread. Large means the fibre
   *  waits at the nodes and crosses the stretches between them almost for free,
   *  which is what saltatory conduction IS. Near 1 means an even crawl. */
  ratio: number
}

/** Whether conduction goes in steps or in a smooth run, measured — and the answer
 *  is worth the trouble, because it is not the one the cartoon gives.
 *
 *  "Saltatory" means leaping, and every textbook picture shows a spike hopping
 *  from node to node over dark internodes. This model says otherwise, and it is
 *  right to: the tread and the riser of the staircase come out about the same
 *  size, which is a smooth run, not a hop. Two reasons, both in the numbers:
 *
 *   • A sheathed stretch is 140 µm against a length constant of 1,700 µm, so a
 *     voltage put in at one node reaches the next almost undiminished and almost
 *     at once. There is nothing to leap over.
 *   • Most of the membrane capacitance is UNDER the sheath, not at the nodes —
 *     even divided by 25 wraps, an internode holds about six times a node's — so
 *     that is where most of the charging time goes.
 *
 *  What is genuinely nodal is REGENERATION: the internode passively carries a
 *  voltage that would otherwise fade, and only a node can rebuild it. That is the
 *  claim the spec's own guardrail asks for — "current spreads under myelin and APs
 *  regenerate at nodes" — and it is a different claim from hopping.
 *
 *  Note also what is deliberately NOT measured: voltage. Membrane under a sheath
 *  swings nearly as far as a node does, which caught out this file's first attempt
 *  at a test. The internode is a good cable and the axoplasm in it goes where its
 *  neighbours go. What the sheath holds back is CURRENT. */
export function saltation(run: FibreRun): Saltation {
  const groups = new Map<number, number[]>()
  let group = -1
  let sinceNode = 0
  run.parts.forEach((p, i) => {
    if (p.excitable && (group < 0 || sinceNode > 0)) {
      group += 1
      sinceNode = 0
    }
    if (!p.excitable) sinceNode += 1
    const at = run.crossedAt[i]
    if (at < Infinity) groups.set(group, [...(groups.get(group) ?? []), at])
  })
  const spans = [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, times]) => times)
    .filter((times) => times.length > 1)
  if (spans.length < 3) return { withinMs: 0, betweenMs: 0, ratio: 0 }

  const middle = spans.slice(1, -1)
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const withinMs = mean(middle.map((t) => Math.max(...t) - Math.min(...t)))
  const starts = middle.map((t) => Math.min(...t))
  const steps: number[] = []
  for (let i = 1; i < starts.length; i++) steps.push(starts[i] - starts[i - 1])
  const betweenMs = steps.length > 0 ? mean(steps) : 0
  return { withinMs, betweenMs, ratio: withinMs > 0 ? betweenMs / withinMs : 0 }
}

/** Solve a tridiagonal system in place — Thomas's algorithm, which is Gaussian
 *  elimination with everything that is zero left out. */
function tridiagonal(
  a: Float64Array,
  b: Float64Array,
  c: Float64Array,
  d: Float64Array,
  out: Float64Array,
): void {
  const n = d.length
  const cp = new Float64Array(n)
  const dp = new Float64Array(n)
  cp[0] = c[0] / b[0]
  dp[0] = d[0] / b[0]
  for (let i = 1; i < n; i++) {
    const m = b[i] - a[i] * cp[i - 1]
    cp[i] = c[i] / m
    dp[i] = (d[i] - a[i] * dp[i - 1]) / m
  }
  out[n - 1] = dp[n - 1]
  for (let i = n - 2; i >= 0; i--) out[i] = dp[i] - cp[i] * out[i + 1]
}

export interface FibreOptions extends FibreSpec {
  dtMs?: number
  msTotal?: number
  /** How much to keep after the last spike, ms. */
  tailMs?: number
  /** Cut the dead end off the run. TRUE by default, and false for the race: two
   *  fibres trimmed to their own finishing times would land on different clocks,
   *  and the whole of N21 is that they share one. */
  trim?: boolean
  /** How much of the near end the electrode covers, µm. */
  stimWidthUm?: number
}

const SAMPLES = 200

export function integrateFibre(
  counts: IonCounts,
  leaksOn: boolean,
  stimulus: number,
  opts: FibreOptions,
): FibreRun {
  const parts = compartments(opts)
  const n = parts.length
  const d = (opts.diameterUm ?? AXON_DIAMETER_UM) * 1e-4
  const dt = opts.dtMs ?? DT
  const msTotal = opts.msTotal ?? 8
  const stimWidth = opts.stimWidthUm ?? 40

  const { rest, leakTarget, eNa, eK } = restingFrame(counts, leaksOn)

  // What counts as having fired: an overshoot a quarter of the way from zero to
  // sodium's own voltage.
  //
  // Not simply "crossed zero", which is what this used to be and what nearly let a
  // dead fibre report a conduction speed. An electrode can drag a membrane up to
  // zero on its own, and with sodium's gradient flattened, zero is exactly where
  // sodium's pull ends — so under a sheath, where a voltage spreads well over a
  // millimetre, the electrode alone pushed distant membrane across the line and the
  // fit turned that into half a metre per second of nothing happening.
  // And when sodium has nowhere to fall — E_Na at or below zero — there is no
  // overshoot to be had at all, so nothing here is an action potential however far
  // an electrode pushes it.
  const fired = eNa * 0.25

  // Per compartment, in absolute units: area, capacitance, and the axial
  // resistance of its own length.
  const area = new Float64Array(n)
  const cap = new Float64Array(n)
  const rAxial = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const L = parts[i].lengthUm * 1e-4
    area[i] = Math.PI * d * L
    cap[i] = (C_M / parts[i].wraps) * area[i]
    rAxial[i] = (4 * AXIAL_RESISTIVITY * L) / (Math.PI * d * d)
  }
  // Between neighbours: two half-lengths of cytoplasm in series.
  const gAx = new Float64Array(n)
  for (let i = 0; i < n - 1; i++) gAx[i] = 2 / (rAxial[i] + rAxial[i + 1])

  const v = new Float64Array(n).fill(rest)
  const m = new Float64Array(n).fill(mInf(rest))
  const h = new Float64Array(n).fill(hInf(rest))
  const nG = new Float64Array(n).fill(nInf(rest))
  const a = new Float64Array(n)
  const b = new Float64Array(n)
  const c = new Float64Array(n)
  const rhs = new Float64Array(n)
  const next = new Float64Array(n)

  const qNa = new Float64Array(n)
  const qK = new Float64Array(n)
  const blank = () => Array.from({ length: n }, () => [] as number[])

  const run: FibreRun = {
    parts,
    vm: blank(),
    naOpen: blank(),
    kOpen: blank(),
    naQ: blank(),
    kQ: blank(),
    t: [],
    lengthUm: parts.reduce((a, part) => a + part.lengthUm, 0),
    rest,
    peak: Array.from({ length: n }, () => rest),
    crossedAt: Array.from({ length: n }, () => Infinity),
    speedMs: 0,
    reachedUm: 0,
    propagated: false,
    myelinated: Boolean(opts.myelin),
  }

  const steps = Math.round(msTotal / dt)
  const every = Math.max(1, Math.round(steps / SAMPLES))

  for (let s = 0; s <= steps; s++) {
    const time = s * dt
    const keep = s % every === 0
    if (keep) run.t.push(time)

    for (let i = 0; i < n; i++) {
      if (keep) {
        run.vm[i].push(v[i])
        run.naOpen[i].push(parts[i].excitable ? m[i] * m[i] * m[i] * h[i] : 0)
        run.kOpen[i].push(parts[i].excitable ? nG[i] ** 4 : 0)
        run.naQ[i].push(qNa[i])
        run.kQ[i].push(qK[i])
      }
      if (v[i] > run.peak[i]) run.peak[i] = v[i]
      if (fired > 0 && v[i] > fired && run.crossedAt[i] === Infinity) {
        run.crossedAt[i] = time
      }

      // The ionic current through this patch, µA/cm². A sheathed patch has no
      // voltage-gated channels at all and a leak divided by the wraps.
      const dens = parts[i].excitable ? parts[i].density : 0
      const gNa = dens * G_NA_MAX * m[i] * m[i] * m[i] * h[i]
      const gK = dens * G_K_MAX * nG[i] ** 4
      const gLeak = G_LEAK / parts[i].wraps
      const iStim =
        time < STIMULUS_MS && parts[i].x <= stimWidth ? stimulus : 0
      const iNa = gNa * (v[i] - eNa)
      const iK = gK * (v[i] - eK)
      // Only what crosses the right way counts: sodium falling in, potassium
      // leaving.
      if (iNa < 0) qNa[i] += -iNa * dt * 1e-9
      if (iK > 0) qK[i] += iK * dt * 1e-9
      const iIon = iNa + iK + gLeak * (v[i] - leakTarget) - iStim

      // Backward Euler on the axial term only: unconditionally stable, so the
      // step is set by the gates rather than by how finely the axon is chopped.
      const left = i > 0 ? 1000 * gAx[i - 1] : 0
      const right = i < n - 1 ? 1000 * gAx[i] : 0
      a[i] = -left
      c[i] = -right
      b[i] = cap[i] / dt + left + right
      rhs[i] = (cap[i] / dt) * v[i] - iIon * area[i]
    }

    tridiagonal(a, b, c, rhs, next)
    for (let i = 0; i < n; i++) {
      v[i] = next[i]
      const vi = v[i]
      m[i] += ((mInf(vi) - m[i]) / tauM) * dt
      h[i] += ((hInf(vi) - h[i]) / tauH(vi)) * dt
      nG[i] += ((nInf(vi) - nG[i]) / tauN(vi)) * dt
    }
  }

  measure(run)
  if (opts.trim !== false) trim(run, opts.tailMs ?? TAIL_MS)
  return run
}

/** How long to keep after the last patch has finished spiking, ms.
 *
 *  Long enough for the undershoot to visibly RECOVER, not merely start. It was
 *  3 ms, which ended every run 12 mV below rest — honest for that instant, but the
 *  animation then FREEZES on its last frame, and a picture that holds a deep-blue
 *  cytoplasm forever reads as "this is the axon's new state" rather than "this is
 *  a moment three milliseconds after a spike". Ten milliseconds brings the
 *  membrane back within a couple of millivolts of rest, so the run ends on an
 *  axon that is nearly itself again — with the last of the blue fading, which is
 *  the true story. The dead time this would add is not added: the clock
 *  fast-forwards once every patch has fired (see TAIL_HASTE). */
export const TAIL_MS = 10

/** Where the recovery tail begins, as a fraction of the run: just after the last
 *  patch to fire has fired. Used by the clock to fast-forward the ending. */
export function tailStartU(run: FibreRun): number {
  const window = run.t[run.t.length - 1] ?? 0
  if (window <= 0) return 1
  let last = 0
  for (const at of run.crossedAt) {
    if (Number.isFinite(at)) last = Math.max(last, at)
  }
  return Math.min(1, (last + 1.2) / window)
}

/** Cut the dead end off the run.
 *
 *  The window has to be generous, because how long a fibre takes to cross is not
 *  known until it has been crossed. But a sheathed fibre crosses six millimetres in
 *  a fifth of the time a bare one does, and then sits there recovering for fifteen
 *  milliseconds — so at a fixed window the sheathed run was seven eighths nothing
 *  happening, and the fibre that is supposed to feel quick felt like the slow one.
 *
 *  Trimmed to the last moment anything was still above zero, plus a tail. The RATE
 *  is untouched — both fibres still show the same milliseconds per second of
 *  screen time, which is the whole basis of comparing them — so what goes is only
 *  the part where nothing was left to see. */
function trim(run: FibreRun, tailMs: number): void {
  const samples = run.t.length
  if (samples < 4) return
  let lastLit = -1
  for (let j = 0; j < samples; j++) {
    for (let i = 0; i < run.parts.length; i++) {
      if (run.vm[i][j] > 0) {
        lastLit = j
        break
      }
    }
  }
  if (lastLit < 0) return
  const step = run.t[1] - run.t[0]
  const keep = Math.min(samples, lastLit + Math.ceil(tailMs / step) + 1)
  if (keep >= samples) return
  run.t.length = keep
  for (const field of ['vm', 'naOpen', 'kOpen', 'naQ', 'kQ'] as const) {
    for (const row of run[field]) row.length = keep
  }
}

/** Speed off the result, fitted over the middle of the fibre only: the stimulated
 *  end is still being pushed and the sealed far end piles charge up with nowhere
 *  to go, and neither is conduction. */
function measure(run: FibreRun): void {
  const n = run.parts.length
  let last = -1
  for (let i = 0; i < n; i++) if (run.crossedAt[i] < Infinity) last = i
  run.reachedUm = last < 0 ? 0 : run.parts[last].x
  run.propagated = last === n - 1

  const pts: Array<[number, number]> = []
  for (let i = Math.floor(n * 0.25); i <= Math.floor(n * 0.75); i++) {
    if (run.crossedAt[i] < Infinity) pts.push([run.crossedAt[i], run.parts[i].x])
  }
  if (pts.length < 3) return
  const mean = (f: (p: [number, number]) => number) =>
    pts.reduce((acc, p) => acc + f(p), 0) / pts.length
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
  run.speedMs = Math.max(0, num / den / 1000)
}

export type FibreField = 'vm' | 'naOpen' | 'kOpen' | 'naQ' | 'kQ'

/** Read the fibre at a moment and a place, both as fractions 0→1.
 *
 *  Interpolated in time between samples and in space between COMPARTMENT CENTRES,
 *  which on a myelinated fibre are unevenly spaced — a 1 µm node sits between
 *  23 µm stretches of sheath. Reading it by fraction rather than by index is what
 *  lets the drawing ask "what is going on four fifths of the way along" without
 *  knowing anything about how the axon was chopped up. */
export function sampleFibre(
  run: FibreRun,
  field: FibreField,
  u: number,
  p: number,
): number {
  const rows = run[field]
  const n = rows.length
  const samples = run.t.length
  if (n === 0 || samples === 0) return 0
  const ti = Math.max(0, Math.min(1, u)) * (samples - 1)
  const j0 = Math.floor(ti)
  const j1 = Math.min(samples - 1, j0 + 1)
  const ft = ti - j0
  const at = (i: number) => rows[i][j0] + (rows[i][j1] - rows[i][j0]) * ft

  const x = Math.max(0, Math.min(1, p)) * run.lengthUm
  if (x <= run.parts[0].x) return at(0)
  if (x >= run.parts[n - 1].x) return at(n - 1)
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (run.parts[mid].x <= x) lo = mid
    else hi = mid
  }
  const span = run.parts[hi].x - run.parts[lo].x
  const f = span > 0 ? (x - run.parts[lo].x) / span : 0
  return at(lo) + (at(hi) - at(lo)) * f
}

/** Which compartment covers this fraction along the fibre — for asking whether a
 *  place is a node or under sheath, which interpolation would only blur. */
export function partAt(run: FibreRun, p: number): Compartment {
  const x = Math.max(0, Math.min(1, p)) * run.lengthUm
  let at = 0
  for (const part of run.parts) {
    at += part.lengthUm
    if (x <= at) return part
  }
  return run.parts[run.parts.length - 1]
}

/** Furthest point to have fired by this moment, as a fraction along the fibre.
 *  Null before anything has. A read-out: nothing is drawn from it. */
export function fibreFront(run: FibreRun, u: number): number | null {
  const now = Math.max(0, Math.min(1, u)) * (run.t[run.t.length - 1] ?? 0)
  let furthest = -1
  for (let i = 0; i < run.parts.length; i++) {
    if (run.crossedAt[i] <= now) furthest = i
  }
  if (furthest < 0) return null
  return run.parts[furthest].x / run.lengthUm
}

/** The highest this fibre's voltage ever gets, mV — what "brightest" means. */
export function fibrePeak(run: FibreRun): number {
  return Math.max(...run.peak)
}

/** How much the spike shrinks between the quarter and three-quarter marks, as a
 *  fraction. An all-or-nothing signal does not fade, and this is how the claim
 *  gets checked rather than repeated — sheathed or bare. */
export function fibreDecrement(run: FibreRun): number {
  const n = run.parts.length
  const swing = (f: number) => run.peak[Math.floor(n * f)] - run.rest
  const near = swing(0.25)
  const far = swing(0.75)
  return near <= 0 ? 1 : (near - far) / near
}

/** The run as the teaching notes want it: a reading, not a trajectory. */
export function readingOfFibre(run: FibreRun): FibreReading {
  return {
    speedMs: run.speedMs,
    decrement: fibreDecrement(run),
    lengthUm: run.lengthUm,
    myelinated: run.myelinated,
  }
}

export interface FibreWave {
  ms: number
  frontUm: number | null
  activeUm: number
  refractoryUm: number
  untouchedUm: number
}

/** What the fibre is doing at one instant, in micrometres of membrane. Every
 *  sentence the panel says about the wave is built from this, so the words and the
 *  picture are reading the same numbers.
 *
 *  Lengths are summed from each compartment's own length, which matters here in a
 *  way it did not on an even grid: a node is 1 µm and a stretch of sheath is 23, so
 *  counting compartments would weigh a node the same as a stretch two dozen times
 *  its size. */
export function fibreWave(run: FibreRun, u: number): FibreWave {
  const last = run.t[run.t.length - 1] ?? 0
  const ms = Math.max(0, Math.min(1, u)) * last
  let active = 0
  let refractory = 0
  let untouched = 0
  let front: number | null = null
  run.parts.forEach((part, i) => {
    const v = sampleFibre(run, 'vm', u, part.x / run.lengthUm)
    if (v > 0) active += part.lengthUm
    // A twentieth of a millivolt of slack: floating-point noise at rest is not an
    // undershoot.
    else if (v < run.rest - 0.05) refractory += part.lengthUm
    if (run.crossedAt[i] <= ms) front = part.x
    else untouched += part.lengthUm
  })
  return { ms, frontUm: front, activeUm: active, refractoryUm: refractory, untouchedUm: untouched }
}

/** What the sheath is, and what it does — every number off the run in front of
 *  you, and the two exaggerations in the drawing owned up to.
 *
 *  `against` is the bare fibre's speed, so the comparison is between two runs that
 *  differ in nothing but the sheath. */
export function myelinFacts(run: FibreRun, against: number): TeachingPara[] {
  const nodes = run.parts.filter((p) => p.excitable).length
  // The spacing of the fibre IN FRONT OF YOU, read off the run — which may be an
  // exaggerated one — and the real spacing for this axon, for the confession.
  const gap = nodes > 0 ? Math.round(run.lengthUm / nodes - NODE_UM) : internodeUm()
  const realGap = internodeUm()
  const stretched = gap > realGap * 1.5
  const wraps = lamellae()
  const quicker = against > 0 ? run.speedMs / against : 0
  return [
    {
      icon: '🧈',
      text: `The pale sleeves are myelin: another cell wrapped round this axon about ${wraps} times over, like tape round a wire. And the tape is nothing exotic — it is that cell's own membrane, the same two-rows-of-heads bilayer you can see in the magnifying glass, wound round and round and squeezed dry. An extra-fatty recipe of it (about three quarters lipid, against half for an ordinary membrane), and ${wraps} layers of fat do two things: almost no charge can leak out through them, and it takes almost no charge to charge them up.`,
    },
    {
      icon: '⭕',
      text: `The sleeves do not join. There are ${nodes} bare gaps along this stretch, one every ${gap} µm, and they are called nodes of Ranvier. Every voltage-gated channel on the whole axon is crowded into them — under the sleeves there are none at all.`,
    },
    {
      icon: '📏',
      text: `Switch the sheath off and back on and watch the DOORS, because that is the whole of it. On the bare axon they run the entire length: every patch has to rebuild the signal for the next one, so every patch needs its own. With the sheath on they are gathered into the gaps, ${gap} µm apart, and the long stretches between have none — the signal is carried across those by spreading, and only rebuilt when it reaches the next gap. Rebuilding is the slow part. Doing it once every half-millimetre instead of continuously is why myelin is quicker.`,
    },
    {
      icon: '🏃',
      text:
        quicker > 1
          ? `Measured on these two runs, and nothing was changed but the sheath: ${run.speedMs.toFixed(
              1,
            )} metres per second against ${against.toFixed(
              2,
            )} bare — about ${quicker.toFixed(
              0,
            )} times quicker down the same axon, from the same push.`
          : 'Nothing propagated on this run, so there is no speed to compare.',
    },
    {
      icon: '✨',
      text: 'Watch where the light comes on: at the gaps, one after another, and never in between. That is not the picture being tidy — the light marks where sodium doors are open, and under a sleeve there are none to open. The voltage between the gaps swings nearly as far as it does at them; what does not happen there is the REBUILDING.',
    },
    {
      icon: '🌊',
      text: 'It does NOT hop from gap to gap, whatever the pictures in books show. Under a sleeve a voltage spreads almost instantly and almost undiminished — there is nothing there to leap over. What only happens at the gaps is the REBUILDING: the sleeved stretches pass a signal on that would otherwise fade, and a node makes it full-size again.',
    },
    stretched
      ? {
          icon: '📚',
          text: `One thing here is stretched on purpose, so the stepping can be watched: the sleeves. A real axon this thin has a node every ${realGap} µm — about ${Math.round(
            gap / realGap,
          )} times closer together than these — and stretching them costs real speed: overstretched internodes conduct worse, which is exactly why real fibres keep their sleeves near a hundred diameters long. The speed above was measured on the stretched fibre you are watching, not on the ideal one.`,
        }
      : {
          icon: '📚',
          text: `A book will draw three or four long sleeves with big gaps between them. This shows ${nodes}, because it is showing ${(
            run.lengthUm / 1000
          ).toFixed(
            0,
          )} millimetres of a real axon and a node really does come every ${gap} µm. The book is drawing a much shorter piece — and drawing the gaps enormous, when a real gap is a hundred and fortieth of a sleeve. Ours are drawn too wide as well, just far less so.`,
        },
    {
      icon: '✂️',
      text: `Two things here are drawn bigger than life, because otherwise you could not see them at all. A node is 1 µm against ${gap} µm of sleeve, which at this scale is a sixth of a pixel, so the gaps are drawn wide enough to notice. And the sleeve is drawn as a thickening of the wall rather than at its real bulk, which would hide the axon inside it. How MANY sleeves there are is not exaggerated: that comes from the axon's own width.`,
    },
  ]
}

/** Why myelin is worth having, told as a comparison of the two runs — and shown
 *  in BOTH states, because on a bare axon the question is "what would wrapping
 *  this do?" and the answer needs the same numbers.
 *
 *  Every figure is measured off the two fibres in front of you, which differ in
 *  nothing but the sheath. */
export function whyMyelinFacts(bare: FibreRun, sheathed: FibreRun): TeachingPara[] {
  const sites = (run: FibreRun) => run.parts.filter((p) => p.excitable).length
  const quicker = bare.speedMs > 0 ? sheathed.speedMs / bare.speedMs : 0
  const mm = sheathed.lengthUm / 1000
  const cross = (run: FibreRun) => (run.speedMs > 0 ? mm / run.speedMs : 0)
  return [
    {
      icon: '🔁',
      text: 'Rebuilding is the slow part. Opening sodium doors, letting the charge in, shutting them again — that takes most of a millisecond, and on a bare axon it has to happen at EVERY patch, all the way along. The spreading between patches is almost instant by comparison; it is the rebuilding that eats the time.',
    },
    {
      icon: '⏭️',
      text: `So the trick is to do it less often. Wrap the stretches in fat and the signal spreads across them without leaking away, and only has to be remade at the gaps. Over these ${mm.toFixed(
        0,
      )} millimetres the bare axon rebuilds it at every patch it has; the wrapped one gets away with ${sites(
        sheathed,
      )}.`,
    },
    {
      icon: '🏁',
      text:
        quicker > 1
          ? `The result, measured on these two runs: ${cross(bare).toFixed(
              1,
            )} ms to cross bare, ${cross(sheathed).toFixed(
              1,
            )} ms wrapped — about ${quicker.toFixed(
              0,
            )} times quicker, from the same push down the same axon.`
          : 'Nothing propagated on one of these runs, so there is no comparison to make.',
    },
    {
      icon: '💸',
      text: 'It is cheaper as well as quicker. Every rebuild spends sodium that the pump has to haul back out afterwards, so an axon that rebuilds a few times instead of thousands of times uses a fraction of the energy — and needs a fraction of the channels. That is why a nerve running down your leg is wrapped, and why losing the wrapping, as in multiple sclerosis, is so serious.',
    },
  ]
}

/** The race, in words (N21) — every figure read off the two runs on screen.
 *
 *  The spec's guardrail for this feature is "use relative speed, not misleading
 *  exact scale", and that is worth taking literally: the ratio is the thing to
 *  remember, the absolute milliseconds are this model's (squid gates at 6.3 °C,
 *  slow for both fibres), and a real nerve at body temperature is quicker than
 *  either. So the ratio leads, and the absolute times are given as what happened
 *  here rather than as what happens in you. */
export function raceFacts(bare: FibreRun, sheathed: FibreRun): TeachingPara[] {
  const mm = bare.lengthUm / 1000
  const at = (run: FibreRun) => run.crossedAt[run.crossedAt.length - 1]
  const bareMs = at(bare)
  const wrappedMs = at(sheathed)
  const ratio = wrappedMs > 0 ? bareMs / wrappedMs : 0
  return [
    {
      icon: '🏁',
      text: `Two axons, the same ${mm.toFixed(
        0,
      )} millimetres, one push, one clock. Everything about them is identical except that the lower one is wrapped — it is the one with the beads along it. Nothing on the picture is labelled, on purpose: the difference is meant to be visible. Watch the finish line rather than the sparks: the wrapped axon is home while the bare one is still a third of the way along.`,
    },
    {
      icon: '⏱️',
      text:
        ratio > 1
          ? `It arrives about ${ratio.toFixed(
              1,
            )} times sooner — and THAT is the number to keep. The clock reads ${wrappedMs.toFixed(
              1,
            )} ms against ${bareMs.toFixed(
              1,
            )} ms, but those are this model's milliseconds: it runs squid channels at 6.3 °C, which is slow for both fibres. A real nerve at body temperature beats both. The ratio survives the difference; the raw times do not.`
          : 'One of these did not propagate, so there is no race to time.',
    },
    {
      icon: '👀',
      text: 'Nothing is sped up or slowed down while the race is on. The single-axon views stretch time so a sheathed fibre can be watched at all; this one runs both at one rate, because slowing one and not the other would be putting a thumb on the race. Only after the second axon is home does the clock hurry, to get through both of them cooling off.',
    },
    {
      icon: '🧠',
      text: `Six millimetres is a fingernail's width. Scale it up: a nerve from your spine to your foot is a metre, and at these speeds the bare one would take over a second to get there while the wrapped one took a fraction. That is the difference between stepping off something sharp and thinking about it afterwards.`,
    },
  ]
}

const cache = new Map<string, FibreRun>()

export function fibreRun(
  counts: IonCounts,
  leaksOn: boolean,
  stimulus: number,
  opts: FibreOptions,
): FibreRun {
  const key = `${leaksOn ? 1 : 0}|${stimulus}|${JSON.stringify(opts)}|${(
    Object.keys(counts) as IonKind[]
  )
    .map((k) => `${counts[k].outside},${counts[k].inside}`)
    .join('|')}`
  const hit = cache.get(key)
  if (hit) return hit
  const run = integrateFibre(counts, leaksOn, stimulus, opts)
  if (cache.size > 8) cache.clear()
  cache.set(key, run)
  return run
}

/** Length constant of a SHEATHED stretch — the reason myelin works at all.
 *
 *  The sheath divides the leak by the number of wraps, and λ goes as the square
 *  root of the membrane resistance, so it grows by the square root of the wraps.
 *  Current from one node therefore reaches far enough to wake the next. */
export function myelinatedLengthConstantUm(
  diameterUm = AXON_DIAMETER_UM,
  wraps = lamellae(diameterUm),
): number {
  const d = diameterUm * 1e-4
  return Math.sqrt((d * MEMBRANE_RESISTANCE * wraps) / (4 * AXIAL_RESISTIVITY)) * 1e4
}

export { FIRE_STIMULUS, lengthConstantUm }
