import type { TeachingPara } from './neuron'
import { SOMA_DIAMETER_UM } from './membrane'
import {
  FIRE_STIMULUS,
  G_K_CEILING,
  G_NA_CEILING,
  SPIKE_MS,
  sampleAt,
  trajectory,
  type Trajectory,
} from './spikeModel'
import { PUMP_K_IN, PUMP_NA_OUT } from './proteins'
import { BACKGROUND } from './voltage'
import type { IonCounts } from '../state/ionStore'
import { CHANNELS, CHANNEL_IDS, OPEN_FRACTION, type ChannelId } from './channels'

// The action potential (N16–N18), as a pure function of the clock.
//
// The voltage here is NOT scripted. What is described is the two conductances —
// how wide open the sodium and potassium doors are at each moment — and the
// voltage falls out of the same chord-conductance equation that gives the
// resting potential. Which means the spike is a CONSEQUENCE of two proteins
// with different timing, and if the kid flattens the sodium gradient the spike
// fails on its own, without anything special being written for that case.

/** How long the MOVEMENT takes on screen, ms — the pauses at each step are on
 *  top of this. Raised from 3000 when the speed control went: with no slow-motion
 *  button to reach for, the one default has to be calm enough on its own,
 *  particularly through the fast stretch where the voltage crosses zero. */
export const AP_MS = 4200

/** What it really takes, ms — the model's own window: about 2 ms for the spike
 *  and the rest for the undershoot to come back. Not a chosen number; it is how
 *  long the integration runs. */
export const AP_REAL_MS = SPIKE_MS

/** The spike these gradients produce, for the stimulus the fire button gives.
 *  Memoised inside `spikeModel`, so asking for it sixty times a second costs one
 *  integration and then nothing. */
function run(
  counts: IonCounts,
  leaksOn: boolean,
  stimulus = FIRE_STIMULUS,
): Trajectory {
  return trajectory(counts, leaksOn, stimulus)
}

/** How wide the voltage-gated sodium door is at this moment, in units of one
 *  potassium leak channel.
 *
 *  These used to be written down as functions of time. They are now read off the
 *  integration, which is the whole point of N18: the gate answers to the voltage,
 *  and the voltage answers to the gate. Neither is scripted, so threshold exists.
 *  They need the gradients because the spike depends on them — flatten sodium and
 *  there is no spike to read. */
export function gNaAt(
  u: number,
  counts: IonCounts,
  leaksOn = true,
  stimulus = FIRE_STIMULUS,
): number {
  return sampleAt(run(counts, leaksOn, stimulus), 'gNa', u)
}

export function gKAt(
  u: number,
  counts: IonCounts,
  leaksOn = true,
  stimulus = FIRE_STIMULUS,
): number {
  return sampleAt(run(counts, leaksOn, stimulus), 'gK', u)
}

/** How far open each door is, as a fraction of its OWN widest — which is what
 *  "open" has to be measured against; see OPEN_FRACTION. */
export function naOpenFraction(
  u: number,
  counts: IonCounts,
  leaksOn = true,
  stimulus = FIRE_STIMULUS,
): number {
  return sampleAt(run(counts, leaksOn, stimulus), 'gNa', u) / G_NA_CEILING
}

export function kOpenFraction(
  u: number,
  counts: IonCounts,
  leaksOn = true,
  stimulus = FIRE_STIMULUS,
): number {
  return sampleAt(run(counts, leaksOn, stimulus), 'gK', u) / G_K_CEILING
}

export type ApPhase = 'rising' | 'falling' | 'undershoot' | 'recovering' | 'done'

export interface ApState {
  /** 0→1 through the event. */
  u: number
  phase: ApPhase
  gNa: number
  gK: number
  /** The same two, each as a fraction of that door's own widest. */
  naOpen: number
  kOpen: number
  /** Membrane voltage right now, mV — derived, never asserted. */
  vm: number
  /** Sodium that has crossed inward so far this spike, mM. */
  naIn: number
  /** Potassium that has crossed outward so far this spike, mM. */
  kOut: number
}

/** Which phase of the spike a position is in — read off the trajectory's own
 *  turning points rather than from thresholds tuned to a particular waveform. If
 *  the gradients change and the peak moves, this moves with it. */
function phaseAt(
  u: number,
  counts: IonCounts,
  leaksOn: boolean,
  stimulus: number,
): ApPhase {
  if (u >= 1) return 'done'
  const t = run(counts, leaksOn, stimulus)
  if (u <= t.uPeak) return 'rising'
  if (u <= t.uTrough) return 'falling'
  // Three millivolts of the resting voltage counts as back: potassium's gate
  // shuts so slowly that the last millivolt takes several more milliseconds, and
  // "recovering" should describe that stretch rather than being squeezed out of
  // existence by it.
  return sampleAt(t, 'vm', u) < t.rest - 3 ? 'undershoot' : 'recovering'
}

// ------------------------------------------------- how much actually crosses
//
// Now simply the integral of the sodium current, in real units, spread through
// the cell's volume. The earlier version could not do that — its currents were in
// arbitrary units — so it worked backwards from Q = C·ΔV and multiplied by a
// measured overlap ratio. The ratio is still reported, because "sodium carries
// several times the bare minimum, because potassium is already leaving while
// sodium is still arriving" is worth being able to say. But it is now a
// CONSEQUENCE of the integration rather than a step in it.

/** Specific membrane capacitance, F/cm². */
const C_SPECIFIC = 1e-6
/** Faraday's constant, C/mol. */
const FARADAY = 96485
/** Volume-to-area ratio of the cell body, cm — r/3 for a sphere, and the soma is
 *  20 µm across everywhere else in the app. */
const VOLUME_PER_AREA = ((SOMA_DIAMETER_UM / 2) * 1e-4) / 3

export interface SpikeCost {
  /** Sodium the cell gains inside per spike, mM. */
  naMM: number
  /** Potassium it loses per spike, mM. */
  kMM: number
  /** How many spikes it would take to shift ONE drawn ball (1 mM). */
  spikesPerBall: number
  /** How many times more sodium arrived than the membrane strictly needed to
   *  reach its peak. */
  overlap: number
}

/** What one spike costs the gradients. */
export function spikeCost(
  counts: IonCounts,
  leaksOn = true,
  stimulus = FIRE_STIMULUS,
): SpikeCost {
  const t = run(counts, leaksOn, stimulus)
  const naMM = t.naIn[t.naIn.length - 1] ?? 0
  const kMM = t.kOut[t.kOut.length - 1] ?? 0
  // The bare capacitive minimum for the swing this spike actually made.
  const swingV = Math.abs(t.peak - t.rest) / 1000
  const minimumMM =
    ((C_SPECIFIC * swingV) / FARADAY / VOLUME_PER_AREA) * 1e6
  return {
    naMM,
    kMM,
    spikesPerBall: naMM > 0 ? 1 / naMM : Infinity,
    overlap: minimumMM > 0 ? naMM / minimumMM : 1,
  }
}

/** Whether this push produced a spike at all. */
export function apFired(
  counts: IonCounts,
  leaksOn = true,
  stimulus = FIRE_STIMULUS,
): boolean {
  return run(counts, leaksOn, stimulus).fired
}

/** Highest voltage the spike reaches, mV. */
export function apPeakMv(
  counts: IonCounts,
  leaksOn = true,
  stimulus = FIRE_STIMULUS,
): number {
  return run(counts, leaksOn, stimulus).peak
}

/** Lowest voltage the undershoot reaches, mV. */
export function apTroughMv(
  counts: IonCounts,
  leaksOn = true,
  stimulus = FIRE_STIMULUS,
): number {
  return run(counts, leaksOn, stimulus).trough
}

/** Voltage the membrane rests at, mV — the model's own steady state, which sits
 *  a millivolt or two below the chord equation's answer because a little
 *  potassium conductance is open even at rest. */
export function apRestMv(counts: IonCounts, leaksOn = true): number {
  // Independent of the stimulus: where the membrane sits before anything is done
  // to it.
  return run(counts, leaksOn).rest
}

/** The voltage at one moment of a spike, mV. */
export function apVmAt(
  u: number,
  counts: IonCounts,
  leaksOn = true,
  stimulus = FIRE_STIMULUS,
): number {
  return sampleAt(run(counts, leaksOn, stimulus), 'vm', u)
}

/** The whole trace, sampled evenly: what a spike WOULD do, given these
 *  gradients. Drawable before one is fired, and it changes shape the moment a
 *  gradient does — including collapsing to no spike at all. */
export function apTrace(
  counts: IonCounts,
  leaksOn = true,
  samples = 96,
  stimulus = FIRE_STIMULUS,
): number[] {
  const t = run(counts, leaksOn, stimulus)
  const out: number[] = []
  for (let i = 0; i <= samples; i++) out.push(sampleAt(t, 'vm', i / samples))
  return out
}

/** How far behind sodium the potassium door opens, in REAL milliseconds.
 *
 *  Real, not screen. This used to be scaled by AP_MS, so it reported the lag in
 *  animation time — the consequence panel said "the potassium doors answered
 *  276 ms later" while the banner three inches away said "0.7 ms late". Same
 *  event, two numbers, and the bigger one read as a fact about neurons. Anything
 *  quoted as a duration of the biology has to be in the biology's units. */
export function potassiumLagMs(
  counts: IonCounts,
  leaksOn = true,
  stimulus = FIRE_STIMULUS,
): number {
  const firstAbove = (f: (u: number) => number): number => {
    for (let i = 0; i <= 1000; i++) {
      const u = i / 1000
      if (f(u) > OPEN_FRACTION) return u
    }
    return 1
  }
  const na = firstAbove((u) => naOpenFraction(u, counts, leaksOn, stimulus))
  const k = firstAbove((u) => kOpenFraction(u, counts, leaksOn, stimulus))
  // Against the run's OWN length: a paired run is longer, so a position means a
  // different number of milliseconds in it.
  return (k - na) * run(counts, leaksOn, stimulus).windowMs
}

/** Everything about the membrane at one moment of a spike — every field a
 *  lookup into the one integration, which is what keeps pause and scrub free. */
export function apStateAt(
  ms: number,
  counts: IonCounts,
  leaksOn = true,
  stimulus = FIRE_STIMULUS,
): ApState {
  const u = Math.max(0, Math.min(1, ms / AP_MS))
  const t = run(counts, leaksOn, stimulus)
  return {
    u,
    phase: phaseAt(u, counts, leaksOn, stimulus),
    gNa: sampleAt(t, 'gNa', u),
    gK: sampleAt(t, 'gK', u),
    naOpen: sampleAt(t, 'gNa', u) / G_NA_CEILING,
    kOpen: sampleAt(t, 'gK', u) / G_K_CEILING,
    vm: sampleAt(t, 'vm', u),
    // Running totals now come straight out of the integrated currents, rather
    // than being a fixed total apportioned by a second pass.
    naIn: sampleAt(t, 'naIn', u),
    kOut: sampleAt(t, 'kOut', u),
  }
}

/** How much of everything crossing the membrane right now each channel accounts
 *  for, 0→1.
 *
 *  This is the honest form of "which protein is in charge at this moment": a
 *  share of the current, not a list of favourites. It has to be derived, because
 *  the answer changes THROUGH the spike — sodium's channel carries almost all of
 *  it at the peak, potassium's takes over on the way down, and the plain leak
 *  comes back into its own during the recovery, which is exactly the hand-over
 *  the narration describes.
 *
 *  The background permeabilities count in the total even though no drawn protein
 *  owns them; otherwise a membrane with every channel shut would report a share
 *  of 1 for whatever was left. */
export function channelShare(
  ap: ApState | null,
  leaksOn: boolean,
  transmitter = false,
): Record<ChannelId, number> {
  const g: Record<ChannelId, number> = {
    'leak-k': leaksOn ? CHANNELS['leak-k'].conductance : 0,
    'voltage-na': ap ? ap.gNa : 0,
    'voltage-k': ap ? ap.gK : 0,
    ligand: transmitter ? CHANNELS.ligand.conductance : 0,
  }
  let total = (BACKGROUND.na ?? 0) + (BACKGROUND.cl ?? 0)
  for (const id of CHANNEL_IDS) total += g[id]
  if (total <= 0) return g
  const share = {} as Record<ChannelId, number>
  for (const id of CHANNEL_IDS) share[id] = g[id] / total
  return share
}

/** Share of the current at which a protein is at full brightness. Above this it
 *  is plainly the one doing the work. */
export const SPOTLIGHT_FULL = 0.35

/** Faintest a protein is drawn while something else is carrying the current.
 *  Never zero: dimmed has to read as "not the story here", not as "gone". */
export const SPOTLIGHT_MIN = 0.32

/** How brightly to draw one protein, 0→1, given its share of the current. */
export function spotlight(share: number): number {
  return SPOTLIGHT_MIN + (1 - SPOTLIGHT_MIN) * Math.min(1, share / SPOTLIGHT_FULL)
}

/** What a protein looks like right now.
 *
 *  Four states rather than a fade, because fading alpha alone was not enough —
 *  a bronze shape at a third opacity still reads as bronze. `starring` gets a
 *  white halo and a lit outline, `drained` has the copper taken out of it as
 *  well as being fainter, and `ordinary` is the normal drawing.
 *
 *  Note `none`, which is not the same as full brightness however tempting it is
 *  to treat them alike: it means no spotlight is running at all, so nothing is
 *  highlighted AND nothing is dimmed. Conflating the two ringed every protein on
 *  the resting membrane at once. */
export type SpotlightState = 'none' | 'starring' | 'ordinary' | 'drained'

export function spotlightState(emphasis: number | null): SpotlightState {
  if (emphasis === null) return 'none'
  if (emphasis > 0.85) return 'starring'
  if (emphasis < 0.6) return 'drained'
  return 'ordinary'
}

/** How far the membrane has travelled from rest, as a single signed number
 *  −1 → +1, for the colour field over the cytoplasm.
 *
 *  Each direction is measured against how far it COULD go: toward sodium's own
 *  voltage going up, toward potassium's going down. That is not a fudge to make
 *  a small number look big — it is the honest question for this picture, which is
 *  "how far toward the ion now pulling hardest", and it happens to put the peak
 *  and the dip at similar strengths even though one is 110 mV from rest and the
 *  other 15. The exact millivolts are on the readout; this is the mood.
 *
 *  Continuous through zero, which is the point: a hue that flips sign at rest
 *  reads as a snap, and charge draining away should look like metal cooling. */
export function polarizationT(
  vm: number,
  rest: number,
  eNa: number,
  eK: number,
): number {
  const dev = vm - rest
  if (dev === 0) return 0
  const reach = dev > 0 ? eNa - rest : rest - eK
  if (reach <= 1) return dev > 0 ? 1 : -1
  const t = dev / reach
  // A gentle shaping so the field does not lurch out of neutral the instant the
  // voltage moves — sqrt, which this used to be, is at its steepest exactly at
  // rest, which is where smoothness matters most.
  return Math.sign(t) * Math.min(1, Math.abs(t)) ** 0.85
}

/** Plain-words note on what the running totals mean. Built from the derived
 *  numbers, so it cannot overstate them. */
export function spikeCostNote(cost: SpikeCost): TeachingPara[] {
  const balls = Math.round(cost.spikesPerBall)
  return [
    {
      icon: '🪙',
      text: `Watch the bars during the spike: they do not move. One action potential moves about ${cost.naMM.toFixed(
        3,
      )} mM of sodium — and one ball on those bars is a whole 1 mM. It would take roughly ${balls} spikes in a row to shift a single ball.`,
    },
    {
      icon: '🔋',
      text: 'That is why the voltage can swing 100 mV and back without the gradients running down. The gradients are a huge battery; a spike is a tiny sip. Only a vanishingly thin skin of ions right against the membrane ever moves.',
    },
    {
      icon: '⚙️',
      text: `And it is why the pump can keep up while working slowly: it has to replace ${cost.naMM.toFixed(
        3,
      )} mM per spike, not the whole 15 mM sitting inside.`,
    },
  ]
}

/** The teaching notes for a spike. Takes the total of the pauses, because one of
 *  them owns up to how long the demonstration takes — and a figure the app states
 *  about itself has to stay true. */
export function apFacts(pauseMs = 0): TeachingPara[] {
  return AP_FACTS_AT(pauseMs)
}

const AP_FACTS_AT = (pauseMs: number): TeachingPara[] => [
  {
    icon: '🚀',
    text: 'An action potential is not a thing that gets pushed along — it is this: sodium doors fly open, the voltage shoots up, potassium doors open late, and the voltage crashes back down past where it started.',
  },
  {
    icon: '⚡',
    text: 'Nothing here is drawn by hand. The two doors open and shut on their own schedules, and the voltage is worked out from them with the same equation that gives the resting voltage. The spike is what those two timings DO.',
  },
  {
    icon: '🔽',
    text: 'The dip at the end — below the resting voltage — is not a mistake. Potassium doors are slow to shut, so for a moment more potassium can leave than usual and the inside goes extra negative. That dip is why a neuron needs a breather before it can fire again.',
  },
  {
    icon: '🟢',
    text: 'Chloride is dimmed while this happens, but it has not gone anywhere — it is crossing the whole time, still pulling the average toward its own preferred voltage, and it is one of the reasons the peak stops short of where sodium alone would take it. Calcium is dim for a different reason: there is no doorway for it in this patch at all. Dimmed means "not the story here", never "absent".',
  },
  {
    icon: '⚙️',
    text: `The pump never stops through any of this — it is still carrying ${PUMP_NA_OUT} sodium out and ${PUMP_K_IN} potassium in the whole way through. But it takes no part in the spike: it is not in the equation at all. Switch it off and the spike is identical. Its job is the tidying up afterwards, and since one spike moves so little, it has all the time it needs.`,
  },
  {
    icon: '⏱️',
    text: `The real thing takes about 2 thousandths of a second, with the dip lasting a few more. The movement here is stretched to ${(
      AP_MS / 1000
    ).toFixed(0)} seconds — roughly ${Math.round(AP_MS / AP_REAL_MS).toLocaleString(
      'en-GB',
    )} times slower — and it stops at each step along the way, so the whole demonstration takes about ${Math.round(
      (AP_MS + pauseMs) / 1000,
    )} seconds.`,
  },
]

/** What the membrane's voltage means right now, in words.
 *
 *  It used to be painted on the canvas under the reading. It is here because the
 *  canvas is for the picture and the describer is for the words: a sentence on the
 *  canvas is a sentence in the one place on the page a child cannot scroll back to,
 *  and it competes with the very drawing it is talking about. The reading and its
 *  NAME stay out there — a number with no name is not a reading — and everything
 *  that explains them lives here. */
export function voltageNote(vm: number, rest: number): string {
  if (Math.abs(vm - rest) < 3) {
    return 'The membrane is resting: the inside is negative, as it always is when nothing is happening.'
  }
  if (vm > rest) {
    return vm > 0
      ? 'DEPOLARIZED, and past the line: the inside has actually gone POSITIVE. That is the top of an action potential, and it lasts about two thousandths of a second.'
      : 'DEPOLARIZED: less negative inside than usual, but not yet past zero.'
  }
  return 'HYPERPOLARIZED: MORE negative inside than resting. Potassium is still leaving after the spike, and it overshoots on the way back.'
}
