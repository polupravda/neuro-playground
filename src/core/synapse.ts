import type { IonCounts } from '../state/ionStore'
import { FRONTIER_SHORT, type TeachingPara } from './neuron'
import { RT_OVER_F_MV } from './voltage'
import { IONS, MM_PER_PARTICLE } from './ions'
import { DT, FIRE_STIMULUS, sampleAt, trajectory } from './spikeModel'

// S01–S03 — the presynaptic terminal, the calcium trigger, and the vesicle.
//
// This is where the signal stops being electrical. Everything before it has been
// one membrane doing arithmetic with its own gradients; from here on a cell has to
// SAY something to another cell, and the way it does that is by throwing a
// chemical across a gap. The spec is emphatic that the calcium step must not be
// skipped, and it is right: without it, "an action potential arrives and the cell
// releases a transmitter" is a rule with no mechanism, exactly the kind of thing
// this app refuses everywhere else.
//
// -------------------------------------------------------------- what is derived
//
// Nothing here is a script. The chain is:
//
//   the SAME spike the rest of the app draws
//     → a voltage-gated calcium channel, opening on that voltage
//     → calcium entering, against a gradient of forty thousand to one
//     → the concentration inside the terminal rising
//     → the chance of a vesicle fusing, as the FOURTH POWER of that concentration
//     → vesicles fusing, at times that fall out of the hazard rather than a cue.
//
// The fourth power is Dodge and Rahamimoff's (1967), and it is the reason a
// synapse is a switch rather than a dimmer: doubling calcium multiplies release by
// sixteen. It is also why calcium is worth a whole feature of its own.
//
// ------------------------------------------------- one finding worth waiting for
//
// The calcium channel is deliberately SLOW compared with sodium's — a few tenths
// of a millisecond rather than a hundredth — and it opens at a more depolarized
// voltage. Neither number was chosen to produce an effect; both are what these
// channels are like. The effect is measured in `synapseFacts` and it is the good
// one: most of the calcium arrives on the way DOWN from the spike, not at the top
// of it. The channels are still opening while the voltage is already falling, and
// a falling voltage is a bigger pull on calcium than the peak is, because at the
// peak the inside is nearly positive enough to push calcium back out.

/** Diameter of a presynaptic bouton, µm. Small — which is the point: the same
 *  number of ions entering a smaller box makes a bigger concentration change, and
 *  that is why a terminal can use calcium as a signal at all. */
export const BOUTON_DIAMETER_UM = 1

/** Calcium permeability of the terminal when its doors are fully open, cm/s.
 *
 *  A PERMEABILITY rather than a conductance, and this is not pedantry — it was a
 *  bug. Sodium and potassium are carried on the ohmic form Hodgkin and Huxley used,
 *  `g·(V − E)`, which is a good approximation when a gradient is ten-to-one and
 *  the current-voltage curve is nearly straight. Calcium's gradient is twenty
 *  THOUSAND to one, and that curve is not remotely straight: almost every ion
 *  crossing comes from outside, so the current follows the outside concentration
 *  almost proportionally, while the Nernst voltage in the ohmic form only follows
 *  its LOGARITHM.
 *
 *  What that cost, concretely: quartering the calcium outside the cell — the
 *  classic experiment, the one the fourth power was discovered with — changed the
 *  calcium current by thirteen per cent, so the terminal went on releasing as if
 *  nothing had happened. A test caught it.
 *
 *  Goldman, Hodgkin and Katz's constant-field equation is the standard treatment
 *  for exactly this case, and it is what is used below. Sodium and potassium keep
 *  the ohmic form, which is correct for them and is what the rest of the app is
 *  built on. */
export const P_CA = 3.46e-4

/** Half-activation voltage, mV. Around −20, which is well above where sodium's
 *  gate opens — so these doors stay shut through everything except a real spike.
 *  A terminal that leaked calcium at rest would be releasing transmitter at rest. */
export const CA_HALF_MV = -20
/** How sharply activation turns on with voltage, mV per e-fold. */
export const CA_SLOPE_MV = 9
/** How fast the calcium gate follows the voltage, ms.
 *
 *  Voltage-dependent, and it has to be. A single constant made the gate as slow to
 *  SHUT as it was to open, which reported every scrap of the calcium arriving after
 *  the spike had peaked — an overstatement of a real effect. These channels open in
 *  a few tenths of a millisecond when depolarized and shut faster than that when the
 *  voltage drops away. Slow next to sodium's 0.12 ms either way, which is the fact
 *  that matters. */
export const tauCa = (v: number): number => 0.12 + 0.42 * sigmoid((v + 10) / 12)

/** How much of the calcium that enters stays FREE, as one part in this many.
 *
 *  Terminals are packed with proteins that grab calcium the moment it arrives, and
 *  only around one ion in fifty is left free to be sensed. Leaving this out is not
 *  a small simplification: without it one action potential appeared to raise free
 *  calcium to 25 µM, which is fifty times what is measured in a small bouton. */
export const BUFFER_RATIO = 50

/** How fast the terminal clears calcium again, ms. Pumps and buffers, lumped into
 *  one exponential — an honest simplification, and named as one. */
export const CA_CLEAR_MS = 30

/** Dodge and Rahamimoff's exponent: release goes as the FOURTH power of calcium.
 *  Four calcium ions have to be caught by the sensor before a vesicle will go. */
export const HILL_N = 4
/** How much local calcium one microamp of calcium current makes at the mouth of a
 *  channel, µM per µA/cm².
 *
 *  This is the fix to a mistake worth keeping on the record. The sensor was being
 *  fed the terminal's AVERAGE calcium, which is what the picture draws — and the
 *  average stays high for tens of milliseconds after the channels have shut, so
 *  every vesicle in the pool went off, every time, long after the spike. Release
 *  is not like that: it happens within about a millisecond and then stops dead.
 *
 *  The reason is geometry. A vesicle's calcium sensor sits a few tens of nanometres
 *  from a channel, and calcium diffuses that far in microseconds — so what the
 *  sensor sees is not the average at all, it is a steep local spike that exists
 *  only WHILE current is flowing and collapses the moment it stops. Modelling the
 *  local signal as proportional to the current is the standard treatment, and it is
 *  what puts release back into the millisecond where it belongs.
 *
 *  Both numbers are kept and both are shown: the average is what fills the
 *  terminal, the local one is what pulls the trigger. */
export const LOCAL_PER_UA = 0.13

/** Calcium the sensor needs to be half as likely as it can be to let a vesicle go,
 *  µM — of the LOCAL concentration, which is why it is tens rather than fractions.
 *
 *  This is calibrated, not derived, and it is the only number here that is: it is
 *  set so one action potential releases about the fraction of the docked pool that
 *  is measured at a small central synapse. The SHAPE of the curve is Dodge and
 *  Rahamimoff's and is not adjustable; where its knee sits depends on which sensor
 *  protein a terminal happens to use, and this model has no sensor, only a curve.
 *  Said out loud rather than buried. */
export const HILL_K_UM = 15

/** How many vesicles are docked and ready. A real active zone holds a handful. */
export const POOL = 5
/** Peak fusion rate per vesicle, per ms, when the sensor is saturated. */
export const FUSE_RATE = 0.42

/** How long the terminal is watched for, ms. Long enough for the calcium to come
 *  back down, which takes far longer than the spike that let it in. */
export const SYNAPSE_MS = 60
const SAMPLES = 360

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x))

const FARADAY = 96485
/** Volume-to-area ratio of the bouton, cm — r/3 for a sphere. */
const VOLUME_PER_AREA = ((BOUTON_DIAMETER_UM / 2) * 1e-4) / 3

/** Calcium's own concentrations, mM.
 *
 *  Outside comes from the pile a child can move on the membrane view — which is
 *  the point, because dropping outside calcium is the classic way to show the
 *  fourth power, and it works here. Inside does NOT, and cannot: the drawn piles
 *  are one ball per millimole, and free calcium inside a cell is 0.0001 mM. It is
 *  ten thousand times smaller than the smallest thing that scheme can draw, so the
 *  drawn count reads zero and a Nernst voltage taken from it comes out at 49 mV
 *  instead of the real 130-odd. The real figure is used, and the describer says
 *  which of the two numbers on this page is not a drawn one. */
export function calciumMM(counts: IonCounts): { outside: number; inside: number } {
  return {
    outside: Math.max(0.001, counts.ca.outside * MM_PER_PARTICLE),
    inside: IONS.ca.insideMM,
  }
}

/** Calcium's Nernst voltage, mV. Divalent, so RT/F is halved. */
export function eCaMv(counts: IonCounts): number {
  const { outside, inside } = calciumMM(counts)
  return (RT_OVER_F_MV / IONS.ca.charge) * Math.log(outside / inside)
}

/** How far open the calcium gate wants to be at this voltage, 0→1. */
export const caInf = (v: number): number => sigmoid((v - CA_HALF_MV) / CA_SLOPE_MV)

/** Calcium current through a fully open membrane at this voltage, µA/cm² —
 *  Goldman, Hodgkin and Katz's constant-field equation. Negative is inward, as
 *  everywhere else in this app.
 *
 *  See P_CA for why this is not `g·(V − E)`. In short: nearly every calcium ion
 *  that crosses came from outside, so the current follows how much is out there
 *  almost in proportion — which the ohmic form cannot express. */
export function ghkCa(vMv: number, outsideMM: number, insideMM: number): number {
  const z = IONS.ca.charge
  const xi = (z * vMv) / RT_OVER_F_MV
  // The removable singularity at zero volts, where the fraction is 0/0 and the
  // limit is 1. Without this the current spikes to nonsense as the spike crosses
  // zero — which is exactly where the calcium is coming in.
  const shape = Math.abs(xi) < 1e-6 ? 1 : xi / (1 - Math.exp(-xi))
  // mM → mol/cm³.
  const inside = insideMM * 1e-6
  const outside = outsideMM * 1e-6
  const amps = P_CA * z * FARADAY * shape * (inside - outside * Math.exp(-xi))
  return amps * 1e6
}

export interface Vesicle {
  index: number
  /** Model ms at which it fused, or null if it did not go this time. */
  fusedAtMs: number | null
}

export interface SynapseRun {
  /** Sample times, ms. */
  t: number[]
  /** The arriving spike — the SAME trajectory the membrane view draws. */
  vm: number[]
  /** How far open the calcium gate is, 0→1. */
  open: number[]
  /** Calcium current, µA/cm². Negative is inward, as everywhere else here. */
  ica: number[]
  /** Free calcium averaged over the terminal, µM — what fills the bouton. */
  caUm: number[]
  /** Free calcium at the mouth of an open channel, µM — what the sensor sees. */
  caLocalUm: number[]
  /** Chance per millisecond that a given docked vesicle goes, 0→1. */
  rate: number[]
  vesicles: Vesicle[]
  restUm: number
  peakCaUm: number
  peakLocalUm: number
  peakOpen: number
  /** When the spike peaked, and when calcium peaked. Not the same moment. */
  vmPeakMs: number
  caPeakMs: number
  /** Fraction of the calcium that came in AFTER the voltage peak. */
  onTheWayDown: number
  /** How far open the calcium gate is at the very top of the spike, 0→1 — the
   *  blunter and more checkable version of the same fact. */
  openAtVmPeak: number
  /** When the calcium CURRENT peaked, ms. Later than the voltage, earlier than the
   *  concentration: the three are three different moments and that is the lesson. */
  icaPeakMs: number
  eCaMv: number
  windowMs: number
}

/** A deterministic number in [0,1) for vesicle `i`.
 *
 *  Release is genuinely probabilistic — that is quantal transmission, one of the
 *  most important facts about a synapse, and a terminal that fired all five
 *  vesicles every time would be teaching the opposite. But this app's whole
 *  architecture rests on a run being a pure function of its inputs, so a call to
 *  Math.random would break pausing, scrubbing and memoisation at once.
 *
 *  A hash gives both: the same run always plays the same way, and the five
 *  vesicles behave like five independent draws. */
function draw(i: number): number {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ 0x85ebca6b
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35)
  h ^= h >>> 13
  return ((h >>> 0) % 100000) / 100000
}

/** Run the terminal once, driven by the spike arriving at it. */
export function integrateSynapse(counts: IonCounts, leaksOn: boolean): SynapseRun {
  const spike = trajectory(counts, leaksOn, FIRE_STIMULUS)
  const eCa = eCaMv(counts)
  const { outside: caOutMM, inside: caInMM } = calciumMM(counts)
  const restUm = caInMM * 1000

  // The voltage at the terminal, in ms since the spike started. Past the spike's
  // own window the membrane is back at rest — measured, not assumed: the trace has
  // returned to within a couple of millivolts by then.
  const vmAt = (ms: number): number =>
    ms >= spike.windowMs ? spike.rest : sampleAt(spike, 'vm', ms / spike.windowMs)

  let m = caInf(spike.rest)
  let ca = restUm
  // Hazard accumulated per vesicle: a vesicle goes when the integrated fusion
  // rate passes the number it drew. That is an inhomogeneous Poisson process,
  // which is what release actually is — not a cue fired at a chosen moment.
  let hazard = 0
  const vesicles: Vesicle[] = Array.from({ length: POOL }, (_, index) => ({
    index,
    fusedAtMs: null,
  }))
  const thresholds = vesicles.map((v) => -Math.log(1 - draw(v.index)))

  const run: SynapseRun = {
    t: [],
    vm: [],
    open: [],
    ica: [],
    caUm: [],
    caLocalUm: [],
    rate: [],
    vesicles,
    restUm,
    peakCaUm: restUm,
    peakLocalUm: restUm,
    peakOpen: 0,
    vmPeakMs: spike.uPeak * spike.windowMs,
    caPeakMs: 0,
    onTheWayDown: 0,
    openAtVmPeak: 0,
    icaPeakMs: 0,
    eCaMv: eCa,
    windowMs: SYNAPSE_MS,
  }

  const steps = Math.round(SYNAPSE_MS / DT)
  const every = Math.max(1, Math.round(steps / SAMPLES))
  let carriedBefore = 0
  let carriedTotal = 0
  let peakIca = 0

  for (let i = 0; i <= steps; i++) {
    const ms = i * DT
    const v = vmAt(ms)
    const open = m * m
    const ica = open * ghkCa(v, caOutMM, caInMM)
    // The sensor: four calcium ions, so a Hill function of order four. Below the
    // knee almost nothing happens; above it, almost everything.
    // What the sensor actually sees: a local spike that exists only while current
    // is flowing. Not the average — see LOCAL_PER_UA.
    const local = restUm + LOCAL_PER_UA * Math.max(0, -ica)
    const grip = local ** HILL_N / (local ** HILL_N + HILL_K_UM ** HILL_N)
    const rate = FUSE_RATE * grip

    if (i % every === 0) {
      run.t.push(ms)
      run.vm.push(v)
      run.open.push(open)
      run.ica.push(ica)
      run.caUm.push(ca)
      run.caLocalUm.push(local)
      run.rate.push(rate)
    }
    if (ca > run.peakCaUm) {
      run.peakCaUm = ca
      run.caPeakMs = ms
    }
    run.peakOpen = Math.max(run.peakOpen, open)
    run.peakLocalUm = Math.max(run.peakLocalUm, local)
    if (ms <= run.vmPeakMs) run.openAtVmPeak = open
    if (ica < peakIca) {
      peakIca = ica
      run.icaPeakMs = ms
    }

    // Charge carried in, and how much of it arrived after the voltage peaked.
    if (ica < 0) {
      const q = -ica * DT * 1e-9
      carriedTotal += q
      if (ms <= run.vmPeakMs) carriedBefore += q
    }

    hazard += rate * DT
    for (let k = 0; k < vesicles.length; k++) {
      if (vesicles[k].fusedAtMs === null && hazard >= thresholds[k]) {
        vesicles[k].fusedAtMs = ms
      }
    }

    // Calcium in, and calcium cleared. Divalent, so two charges per ion.
    // Calcium in, and calcium cleared. Divalent, so two charges per ion — and
    // only one part in BUFFER_RATIO of what arrives is left free.
    const influx =
      ica < 0
        ? ((-ica * DT * 1e-9) / (2 * FARADAY * VOLUME_PER_AREA)) * 1e9 / BUFFER_RATIO
        : 0
    ca += influx - ((ca - restUm) / CA_CLEAR_MS) * DT
    m += ((caInf(v) - m) / tauCa(v)) * DT
  }

  run.onTheWayDown = carriedTotal > 0 ? 1 - carriedBefore / carriedTotal : 0
  return run
}

const cache = new Map<string, SynapseRun>()

/** Memoised on what it depends on, like every other run in this app. */
export function synapseRun(counts: IonCounts, leaksOn: boolean): SynapseRun {
  const key = `${leaksOn}|${counts.na.inside},${counts.na.outside},${counts.k.inside},${counts.k.outside},${counts.ca.inside},${counts.ca.outside}`
  const hit = cache.get(key)
  if (hit) return hit
  const run = integrateSynapse(counts, leaksOn)
  if (cache.size > 24) cache.clear()
  cache.set(key, run)
  return run
}

/** Read a series at a position 0→1 through the run. */
export function sampleSynapse(
  run: SynapseRun,
  field: 'vm' | 'open' | 'ica' | 'caUm' | 'caLocalUm' | 'rate',
  u: number,
): number {
  const series = run[field]
  const x = Math.max(0, Math.min(1, u)) * (series.length - 1)
  const i = Math.floor(x)
  const j = Math.min(series.length - 1, i + 1)
  return series[i] + (series[j] - series[i]) * (x - i)
}

/** How many vesicles have gone by this point in the run. */
export function releasedBy(run: SynapseRun, ms: number): number {
  return run.vesicles.filter((v) => v.fusedAtMs !== null && v.fusedAtMs <= ms).length
}

/** The teaching notes, built from what the model did. */
export function synapseFacts(run: SynapseRun, counts: IonCounts): TeachingPara[] {
  const ratio = counts.ca.outside / Math.max(1e-9, counts.ca.inside)
  const went = run.vesicles.filter((v) => v.fusedAtMs !== null).length
  const first = run.vesicles.reduce<number | null>(
    (best, v) => (v.fusedAtMs === null ? best : best === null ? v.fusedAtMs : Math.min(best, v.fusedAtMs)),
    null,
  )
  return [
    {
      icon: '🔚',
      text: 'This is the end of the wire. Everything so far has been one cell doing electricity to itself — but the next cell is a separate cell, with its own membrane, and electricity cannot jump the gap. So the signal gets translated into a chemical, thrown across, and translated back.',
    },
    {
      icon: '📍',
      text: 'Look at where the doors are. The calcium channels are in the SAME piece of membrane the vesicles are parked on, right in among them — a patch called the active zone. That is not tidiness. It is the whole design: what the vesicles are waiting for has to be sensed within a few tens of nanometres of where it comes in, because it never gets any further than that before being mopped up.',
    },
    {
      icon: '🫧',
      text: 'And look at what a vesicle is MADE of. It is not a bag of some other stuff — it is a little sphere of the same membrane, the same two layers of fat curved round on themselves. That is the only reason it can do what it does: two bilayers can join and become one bilayer. A bubble made of anything else could not open into the wall.',
    },
    {
      icon: '🤝',
      text: `Each vesicle is held against the wall by proteins, and one of them is the sensor: the thing that is actually waiting. Watch the little circles on it fill up as calcium arrives — it takes ${HILL_N} of them before it will let go. Three is not enough. That is the fourth power, and it is happening on the picture rather than in a caption.`,
    },
    {
      icon: '🚪',
      text: `The spike arrives and opens a door you have not met yet: a calcium channel. It is voltage-gated like sodium's, but it opens at a higher voltage — around ${CA_HALF_MV} mV — so it stays shut through everything except a real action potential. A terminal that leaked calcium at rest would be talking when it had nothing to say.`,
    },
    {
      icon: '🌊',
      text: `And when it opens, calcium pours in, because there is about ${Math.round(
        ratio,
      ).toLocaleString()} times more of it outside than in. That is a far steeper hill than sodium's ten-to-one. Its Nernst voltage is ${run.eCaMv.toFixed(
        0,
      )} mV — the inside would have to get that positive before calcium stopped wanting to come in, and it never does.`,
    },
    {
      icon: '⏱️',
      text: `Watch WHEN it arrives, because it is not when you would guess. At the very top of the spike — ${run.vmPeakMs.toFixed(
        2,
      )} ms — calcium's door is only ${Math.round(
        run.openAtVmPeak * 100,
      )}% open. The flow does not peak until ${run.icaPeakMs.toFixed(
        2,
      )} ms, by which time the voltage is already falling. Calcium's door is several times slower than sodium's, so it is still opening as the spike comes down — and the pull on calcium is actually WEAKEST at the top, because up there the inside has gone nearly positive enough to push calcium back out.`,
    },
    {
      icon: '4️⃣',
      text: `Inside, calcium goes from ${run.restUm.toFixed(2)} µM at rest to about ${run.peakCaUm.toFixed(
        1,
      )} µM — but the sensor that fires a vesicle has to catch FOUR calcium ions before it will let go. That fourth power is what makes a synapse a switch rather than a dimmer: twice as much calcium is sixteen times the release.`,
    },
    {
      icon: '💧',
      text:
        went === 0
          ? 'This time no vesicle went at all. That is not a fault: release is a matter of chance, and a synapse quite often says nothing when an action potential arrives.'
          : `${went} of the ${POOL} docked vesicles fused this time, the first at ${first!.toFixed(
              2,
            )} ms. Not all five — release is a matter of CHANCE, one vesicle at a time. That is why a transmitter arrives in packets of a fixed size rather than as a smooth trickle, and it is how vesicles were discovered before anyone could see one.`,
    },
    {
      icon: '🚧',
      text: `These paragraphs are the model's, not a view's: ${FRONTIER_SHORT} has no picture at the moment. The numbers above are measured and tested; what is still to build is the drawing of them.`,
    },
  ]
}
