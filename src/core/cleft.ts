import type { TeachingPara } from './neuron'
import { DT } from './spikeModel'
import { SYNAPSE_MS, type SynapseRun } from './synapse'

// S04–S05 — the gap, and the far side of it.
//
// The terminal built in the previous step stops at the moment of release: packets
// are spilled into the cleft and go no further, because nothing was there to catch
// them. This is what catches them.
//
// ------------------------------------------------ the fact this view exists for
//
// A child watching the terminal has just seen a delay of about two milliseconds
// between the spike arriving and a vesicle going. The obvious explanation — and the
// wrong one — is that the chemical takes time to cross the gap. It does not.
// `crossingUs` works it out from the gap's own width and glutamate's own diffusion
// coefficient, and the answer is well under a microsecond: a thousandth of the
// delay. Diffusion over twenty nanometres is not slow. It is instant.
//
// So the synaptic delay is almost entirely the RELEASE step — calcium's slow doors,
// and the sensor waiting to catch four ions. The crossing is free. That is worth a
// whole feature, because "the message has to travel across the gap" is exactly the
// picture a child will otherwise build, and it survives everything else this app
// teaches unless something contradicts it.
//
// ------------------------------------------------------------- what is modelled
//
//   vesicles fusing (from the terminal's own run)
//     → transmitter in the cleft, as a concentration
//     → receptors binding it, TWO molecules before anything opens
//     → a gate opening
//     → and, quickly, desensitizing — shutting while the transmitter is still there.
//
// Every rate below is a real one for an AMPA-type receptor. Nothing is timed by
// hand, and the shape of the response is a consequence: it is brief because the
// transmitter goes almost at once and because the receptor stops answering even
// sooner.

/** How wide the gap is, nm. */
export const CLEFT_NM = 20

/** Glutamate's diffusion coefficient in the cleft, cm²/s. Slower than in free
 *  water — the gap is crowded with protein — and this is the usual figure for it. */
export const D_CM2_S = 3.3e-6

/** Molecules of transmitter in one vesicle. A vesicle is a fixed size and holds a
 *  fixed dose; that is what makes release QUANTAL and is how vesicles were inferred
 *  before anyone could see one. */
export const PER_VESICLE = 4000

/** Radius of the active zone the packet lands in, µm. */
export const ACTIVE_ZONE_R_UM = 0.2

/** How fast transmitter leaves the gap, ms.
 *
 *  Lumped: diffusion sideways out of the cleft, plus the pumps that drag it back
 *  in. An honest simplification, and named as one — the point being made here is
 *  that the transient is SHORT, and both processes make it short. */
export const CLEAR_MS = 0.35

// AMPA-type receptor rates. Concentrations in mM, times in ms.
/** Binding, per mM per ms. */
export const K_ON = 10
/** Unbinding, per ms. */
export const K_OFF = 4
/** Opening, per ms — fast, which is why this is the fast excitatory receptor. */
export const BETA = 10
/** Closing, per ms. */
export const ALPHA = 1
/** Into the desensitized state, per ms. */
export const K_DESENS = 1.6
/** And out of it — slow. This is the one rate that is not fast, and it is why a
 *  synapse pushed hard has less to give the second time. */
export const K_RESENS = 0.02

// ── the far side's answer: a GRADED potential, not a spike ──────────────────
//
// What the open gates do to the spine (user, 2026-09-01: "let the
// corresponding ions penetrate... it gets depolarized"). Sodium comes in
// through every open receptor and the spine's voltage climbs — but it is an
// EPSP: it never passes the receptors' own reversal, it decays on the
// membrane's clock, and nothing regenerates it. The "flash down the dendrite"
// the storyboard asked for would have drawn an action potential; whether one
// ever happens is decided at the soma, after summation, and is not this view's
// to claim.

/** The spine's resting voltage, mV. ⚠ DECLARED, not derived: this run has no
 *  postsynaptic ion counts to derive it from, so the app's standard −70 is
 *  used and said out loud. */
export const SPINE_REST_MV = -70
/** The spine's membrane time constant, ms — typical for a thin process, and
 *  the reason the EPSP outlives the transmitter a hundredfold. */
export const SPINE_TAU_MS = 12
/** Synaptic-to-leak conductance ratio with every receptor open — a strong
 *  local synapse. ⚠ TYPICAL, NOT MEASURED HERE: it sets how big the drawn
 *  EPSP is, and the facts below declare it. */
export const SPINE_G_RATIO = 1.5
/** The AMPA-type receptor's reversal, mV — the ceiling an EPSP can approach
 *  and never pass, because at 0 mV the pull on Na⁺ in equals the push on K⁺
 *  out through the same pore. */
export const AMPA_REVERSAL_MV = 0

const AVOGADRO = 6.022e23

/** How long a transmitter molecule takes to cross the gap, MICROseconds.
 *
 *  Einstein's relation, t = x²/2D, on the gap's real width. Nothing about this is
 *  fitted; it falls out of two measured numbers. */
export function crossingUs(): number {
  const x = CLEFT_NM * 1e-7 // cm
  return ((x * x) / (2 * D_CM2_S)) * 1e6
}

/** Concentration one vesicle's worth of transmitter makes in the gap, mM. */
export function perVesicleMM(): number {
  const r = ACTIVE_ZONE_R_UM * 1e-4 // cm
  const volumeL = Math.PI * r * r * (CLEFT_NM * 1e-7) * 1e-3
  return (PER_VESICLE / AVOGADRO / volumeL) * 1000
}

export interface CleftRun {
  t: number[]
  /** Transmitter in the gap, mM. */
  mM: number[]
  /** Receptors with at least one molecule stuck to them, 0→1. */
  bound: number[]
  /** Receptors actually open, 0→1. */
  open: number[]
  /** Receptors that have shut themselves while still holding transmitter, 0→1. */
  desensitized: number[]
  /** The spine's voltage, mV — the EPSP the open receptors drive. */
  vmPost: number[]
  /** Where the EPSP tops out, mV — always negative, which is the lesson. */
  peakPostMv: number
  peakPostAtMs: number
  peakMM: number
  peakMMAtMs: number
  peakOpen: number
  peakOpenAtMs: number
  /** Milliseconds the transmitter spends above a tenth of its peak. */
  transientMs: number
  /** Milliseconds the receptors spend above a tenth of their peak opening. */
  responseMs: number
  /** When the first vesicle went, ms — null if none did. */
  firstFusionMs: number | null
  windowMs: number
}

/** Run the gap, driven by the terminal's own vesicles. */
export function integrateCleft(terminal: SynapseRun): CleftRun {
  const dose = perVesicleMM()
  const fusions = terminal.vesicles
    .map((v) => v.fusedAtMs)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b)

  // Receptor states, as fractions of the population. Two binding steps before
  // anything can open — which is why the response follows the SQUARE of the
  // transmitter at low doses rather than tracking it.
  let c0 = 1
  let c1 = 0
  let c2 = 0
  let open = 0
  let des = 0
  let mM = 0
  let vPost = SPINE_REST_MV

  const run: CleftRun = {
    t: [],
    mM: [],
    bound: [],
    open: [],
    desensitized: [],
    vmPost: [],
    peakPostMv: SPINE_REST_MV,
    peakPostAtMs: 0,
    peakMM: 0,
    peakMMAtMs: 0,
    peakOpen: 0,
    peakOpenAtMs: 0,
    transientMs: 0,
    responseMs: 0,
    firstFusionMs: fusions[0] ?? null,
    windowMs: SYNAPSE_MS,
  }

  const steps = Math.round(SYNAPSE_MS / DT)
  const every = Math.max(1, Math.round(steps / 360))
  let next = 0
  const trace: Array<[number, number, number]> = []

  for (let i = 0; i <= steps; i++) {
    const ms = i * DT
    // Each vesicle's dose arrives all at once. It may as well: crossing the gap
    // takes well under a microsecond — see `crossingUs` — which is a five hundredth
    // of one integration step.
    while (next < fusions.length && fusions[next] <= ms) {
      mM += dose
      next++
    }

    if (i % every === 0) {
      run.t.push(ms)
      run.mM.push(mM)
      run.bound.push(c1 + c2 + open + des)
      run.open.push(open)
      run.desensitized.push(des)
      run.vmPost.push(vPost)
    }
    if (vPost > run.peakPostMv) {
      run.peakPostMv = vPost
      run.peakPostAtMs = ms
    }
    trace.push([ms, mM, open])
    if (mM > run.peakMM) {
      run.peakMM = mM
      run.peakMMAtMs = ms
    }
    if (open > run.peakOpen) {
      run.peakOpen = open
      run.peakOpenAtMs = ms
    }

    // Two sites, then a gate, then desensitization off the doubly-bound state.
    const b1 = 2 * K_ON * mM * c0 - K_OFF * c1
    const b2 = K_ON * mM * c1 - 2 * K_OFF * c2
    const o = BETA * c2 - ALPHA * open
    const d = K_DESENS * c2 - K_RESENS * des

    c0 += (-b1) * DT
    c1 += (b1 - b2) * DT
    c2 += (b2 - o - d) * DT
    open += o * DT
    des += d * DT
    mM -= (mM / CLEAR_MS) * DT
    // The spine: leak pulling back to rest, open receptors pulling toward
    // their reversal — a conductance synapse on an RC membrane. Nothing here
    // can pass AMPA_REVERSAL_MV, and nothing regenerates: the EPSP's shape is
    // a consequence, not a script.
    vPost +=
      ((SPINE_REST_MV - vPost + SPINE_G_RATIO * open * (AMPA_REVERSAL_MV - vPost)) /
        SPINE_TAU_MS) *
      DT
  }

  const spanAbove = (index: 1 | 2, peak: number): number => {
    const floor = peak * 0.1
    let first = -1
    let last = -1
    for (const row of trace) {
      if (row[index] >= floor && floor > 0) {
        if (first < 0) first = row[0]
        last = row[0]
      }
    }
    return first < 0 ? 0 : last - first
  }
  run.transientMs = spanAbove(1, run.peakMM)
  run.responseMs = spanAbove(2, run.peakOpen)
  return run
}

const cache = new Map<SynapseRun, CleftRun>()

/** Memoised on the terminal run it is driven by. */
export function cleftRun(terminal: SynapseRun): CleftRun {
  const hit = cache.get(terminal)
  if (hit) return hit
  const run = integrateCleft(terminal)
  if (cache.size > 12) cache.clear()
  cache.set(terminal, run)
  return run
}

/** Read a series at a position 0→1 through the run. */
export function sampleCleft(
  run: CleftRun,
  field: 'mM' | 'bound' | 'open' | 'desensitized' | 'vmPost',
  u: number,
): number {
  const series = run[field]
  const x = Math.max(0, Math.min(1, u)) * (series.length - 1)
  const i = Math.floor(x)
  const j = Math.min(series.length - 1, i + 1)
  return series[i] + (series[j] - series[i]) * (x - i)
}

/** The teaching notes, built from what the model did. */
export function cleftFacts(run: CleftRun): TeachingPara[] {
  const cross = crossingUs()
  if (run.firstFusionMs === null) {
    return [
      {
        icon: '🤫',
        text: 'Nothing was released this time, so there is nothing in the gap and the receptors on the far side have nothing to catch. A synapse that says nothing is a normal synapse — release is a matter of chance.',
      },
    ]
  }
  return [
    {
      icon: '🏃',
      text: `Here is the surprise. Crossing the gap takes about ${cross.toFixed(
        2,
      )} MICROseconds — a gap of ${CLEFT_NM} nanometres is nothing to a molecule, and diffusion over that distance is instant. The delay you watched at the terminal was about ${run.firstFusionMs.toFixed(
        1,
      )} thousandths of a second, which is a thousand times longer. So the wait is not the message travelling. It is the calcium doors opening and the sensor catching four ions.`,
    },
    {
      icon: '💨',
      text: `A packet lands and the gap goes from empty to about ${run.peakMM.toFixed(
        2,
      )} millimolar in an instant — and empties again almost as fast, staying above a tenth of that for only ${run.transientMs.toFixed(
        2,
      )} ms. Transmitter is not left lying about: it spreads sideways out of the gap and gets pumped back in. A synapse has to be able to say the next thing.`,
    },
    {
      icon: '🔑',
      text: `On the far side the receptor is a lock that takes TWO keys: two transmitter molecules have to be stuck to it before the gate will open at all. That is why a small amount of transmitter does almost nothing and a full packet does a lot — the response follows the square, not the amount.`,
    },
    {
      icon: '🚪',
      text: `At most ${Math.round(
        run.peakOpen * 100,
      )}% of the receptors are open at once, ${(run.peakOpenAtMs - run.firstFusionMs).toFixed(
        2,
      )} ms after the packet arrives, and they are open for only about ${run.responseMs.toFixed(
        2,
      )} ms. Not all of them, and not for long — which is the honest picture of a synapse: a brief, partial, noisy shout, repeated.`,
    },
    {
      icon: '😴',
      text: `And watch what shuts them. Look for a receptor that goes grey while the two teal molecules are STILL sitting in its mouth — it has stopped answering without letting go. That is called desensitizing. About ${Math.round(
        Math.max(...run.desensitized) * 100,
      )}% of them do it here, and it is slow to undo, so a synapse shouted at over and over has less to give each time.`,
    },
    {
      icon: '🌊',
      text: `And now something comes THROUGH them: sodium. Every open gate lets Na⁺ pour into the spine, and the inside climbs — from ${SPINE_REST_MV} mV up to about ${run.peakPostMv.toFixed(
        0,
      )} mV at ${run.peakPostAtMs.toFixed(
        1,
      )} ms, and then back down. Watch the colour inside the spine: it warms toward neutral and NEVER turns red, because the inside never goes positive. This is not an action potential — it is a graded nudge, and it fades on the membrane's own clock.`,
    },
    {
      icon: '📉',
      text: `That nudge cannot become a spike here. It tops out well below zero — the receptors' own reversal is ${AMPA_REVERSAL_MV} mV, a ceiling it only approaches — and it shrinks as it spreads down the neck into the dendrite. Whether the CELL fires is decided far away at the soma, after nudges like this one from thousands of synapses are added up.`,
    },
    {
      icon: '✏️',
      text: `NOT MEASURED: how hard this one synapse pushes. The spine's answer is drawn from typical numbers — a ${SPINE_TAU_MS} ms membrane clock and a synapse about ${SPINE_G_RATIO}× as strong as the spine's own leak — because this run has no postsynaptic ion counts to derive them from. The SHAPE is a consequence of those numbers, not a script.`,
    },
  ]
}
