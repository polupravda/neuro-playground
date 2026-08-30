import type { IonCounts } from '../state/ionStore'
import { FIRE_STIMULUS } from './spikeModel'
import {
  C_M,
  DT,
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

// N18 + N22, as one instrument: a membrane you can poke whenever you like, with a
// line that answers every poke.
//
// ------------------------------------------------------------------ why at all
//
// Both of the exhibits this replaces failed the same way, and it took a child's-
// eye look to see it. The weak stimulus on the membrane patch drew NOTHING —
// correctly, that is the lesson — but the patch's whole vocabulary is doors
// opening and crowds moving, so "not enough" and "broken" looked identical. And
// the paired-pulse control asked for two runs to be compared from memory, with a
// slider whose milliseconds a child has no feel for, on a view that only ever
// draws one instant.
//
// A trace fixes both, because a trace is a picture of a SEQUENCE. A flat stretch
// after a press is drawn in the same ink as a spike. Two presses are on one axis
// at the same time. The refractory period stops being a number in a caption and
// becomes the shape of the line: press, press again too soon, and the second
// press visibly does nothing.
//
// ------------------------------------------------------------ what makes it work
//
// The same integration, one step at a time. `integrate` in spikeModel runs the
// whole spike into a table because everything on the canvas is a pure function of
// a position — that is what makes pause and scrub possible there. Here the pushes
// arrive whenever a child presses, so there is no whole run to tabulate in
// advance, and the state has to be carried forward.
//
// It carries forward the SAME four numbers with the SAME rate constants imported
// from the same module. That matters more than it looks: the refractory period is
// not implemented here at all. Nothing in this file knows what a refractory period
// is. Sodium's h gate is simply still shut when the second push lands, because it
// is the same h gate that shut at the top of the first spike, and it reopens on
// its own schedule. Delete every mention of refractoriness from the app and this
// bench would still refuse the second push.

/** Model milliseconds visible on the graph at once. Wide enough to hold half a
 *  dozen spikes and every refractory window between them. */
export const TRAIN_WINDOW_MS = 45

/** Real milliseconds per model millisecond.
 *
 *  Not a decoration — it is what makes the experiment PERFORMABLE. The absolute
 *  refractory period is about 2.6 model ms, and no child can aim a button press
 *  to a thousandth of a second. Stretched by 200 it becomes about half a second,
 *  which is exactly the interval between a deliberate double-tap and two separate
 *  presses. The stretch is the same order the spike on the canvas already uses, so
 *  the two views feel like the same slow motion. */
export const TRAIN_SLOWDOWN = 200

/** How often the trace keeps a point, in model ms. DT is 0.002, so integrating a
 *  full window means twenty-odd thousand steps — far more than a few hundred
 *  pixels of graph can show. */
export const TRAIN_SAMPLE_MS = 0.05

/** How long after a press we still call a spike that press's doing, ms. A spike
 *  takes about half a millisecond to get off the ground; anything later than this
 *  was not caused by this push. */
export const ATTRIBUTE_MS = 4

export interface TrainSample {
  /** Model ms since the bench opened. */
  t: number
  v: number
}

export interface TrainPush {
  /** Bumped per press, so React can key them. */
  id: number
  /** Model ms since the bench opened. */
  atMs: number
  amplitude: number
  /** What the label under the graph should read. */
  label: string
  /** Whether a spike followed. Null while it is still too early to say. */
  fired: boolean | null
}

export interface TrainState {
  /** Model ms since the bench opened. */
  tMs: number
  v: number
  m: number
  h: number
  n: number
  eNa: number
  eK: number
  rest: number
  leakTarget: number
  /** Points on the trace, oldest first, trimmed to the window. */
  samples: TrainSample[]
  /** Presses, oldest first, trimmed to the window. */
  pushes: TrainPush[]
  /** Where spikes crossed zero on the way up, model ms — the shaded recovery
   *  windows hang off these. Trimmed to the window. */
  spikesAt: number[]
  /** Every press and every spike since the bench opened, for the tally. Not
   *  trimmed: a running total that shrank as the graph scrolled would be a lie. */
  presses: number
  spikes: number
  /** Pending injected current, model ms until it stops. */
  pushLeftMs: number
  pushAmplitude: number
  nextId: number
  /** Carried between advances: a fraction of a step's worth of time, so slowing
   *  the clock down never quietly changes the physics. */
  debtMs: number
  /** Whether v was above zero at the last step, for edge detection. */
  wasOver: boolean
  /** Model ms of the last sample kept, so sampling stays evenly spaced. */
  lastSampleMs: number
}

/** A membrane at rest, with nothing on the graph yet. */
export function trainStart(counts: IonCounts, leaksOn: boolean): TrainState {
  const { rest, leakTarget, eNa, eK } = restingFrame(counts, leaksOn)
  return {
    tMs: 0,
    v: rest,
    m: mInf(rest),
    h: hInf(rest),
    n: nInf(rest),
    eNa,
    eK,
    rest,
    leakTarget,
    samples: [{ t: 0, v: rest }],
    pushes: [],
    spikesAt: [],
    presses: 0,
    spikes: 0,
    pushLeftMs: 0,
    pushAmplitude: 0,
    nextId: 1,
    debtMs: 0,
    wasOver: rest > 0,
    lastSampleMs: 0,
  }
}

/** Press a button. The push starts NOW and lasts STIMULUS_MS, exactly as it does
 *  on the canvas — the same pulse, so the two views cannot mean different things
 *  by "a push of 60".
 *
 *  A press that lands while a pulse is still running is IGNORED, and that is a
 *  fact about the button rather than about the membrane. One press delivers one
 *  fixed pulse, the way a real stimulator works.
 *
 *  Getting this wrong was instructive. The first version let a press restart the
 *  pulse, so holding the weak button down stretched 0.6 ms of current into as much
 *  as you liked — and a weak current held on for long enough fires ANY cell, since
 *  20 µA/cm² against a 0.3 mS/cm² leak settles some 60 mV above rest. Perfectly
 *  real physics, arrived at by accident, and it made a button labelled "not enough"
 *  fire the cell whenever a child drummed on it.
 *
 *  What is NOT suppressed is summation between separate pulses. Weak pushes a
 *  millisecond apart do add up and can fire the membrane, because its time constant
 *  is about 3 ms and the second push lands on top of what the first left behind.
 *  That is temporal summation, it is the same effect this app teaches in its first
 *  milestone with two inputs firing together, and hiding it to protect the phrase
 *  "the weak one never works" would be teaching a tidier cell than the real one.
 *  The describer says so instead.
 *
 *  Returns whether the press was taken. */
/** How long the electrode's flash lasts, model ms. The bench runs slowed
 *  200×, so this is about a fifth of a second on screen: long enough to be
 *  seen as the CAUSE of what the graph then does, short enough to be an
 *  event rather than a state the cell sits in. */
export const STIM_FLASH_MS = 1.2

/** The electrode's flash after a press: how hard it pushed, 0→1, fading out.
 *
 *  What this bench actually computes is a current injected into ONE patch —
 *  the way a real electrode does it — so an electrode is what it draws. A
 *  first version lit the DENDRITES instead, which reads better but depicts
 *  synaptic input the model never integrates; the picture and the model must
 *  not disagree (user, 2026-08-28). The dendrites get their turn when
 *  whole-cell summation arrives, with a model behind them.
 *
 *  Null when nothing has been pressed lately. */
export function stimFlash(state: TrainState): { strength: number } | null {
  const last = state.pushes[state.pushes.length - 1]
  if (!last) return null
  const age = state.tMs - last.atMs
  if (age < 0 || age > STIM_FLASH_MS) return null
  const strength = Math.max(0.25, Math.min(1, last.amplitude / FIRE_STIMULUS))
  return { strength: strength * (1 - age / STIM_FLASH_MS) }
}

export function pressPush(state: TrainState, amplitude: number, label: string): boolean {
  if (state.pushLeftMs > 0) return false
  state.pushLeftMs = STIMULUS_MS
  state.pushAmplitude = amplitude
  state.presses += 1
  state.pushes.push({
    id: state.nextId++,
    atMs: state.tMs,
    amplitude,
    label,
    fired: null,
  })
  return true
}

/** The most real time one frame may be worth, ms. A backgrounded tab hands back a
 *  gap of seconds, and integrating all of it at once would run a minute of
 *  membrane between two frames. Applied by the CALLER, which is the only place
 *  that knows about real time — an earlier version clamped inside `trainAdvance`,
 *  where the argument is model ms, so it silently refused to advance by more than
 *  a third of a millisecond and every gap in the experiment came out the same. */
export const MAX_FRAME_MS = 60

/** Carry the membrane forward by `byMs` of MODEL time.
 *
 *  Mutates in place. This is a per-frame value in the sense the architecture notes
 *  mean: it lives in a ref and drives a canvas, and no part of it goes through the
 *  store except the tallies, which change a few times a minute. */
export function trainAdvance(state: TrainState, byMs: number): void {
  const want = byMs + state.debtMs
  const steps = Math.floor(want / DT)
  state.debtMs = want - steps * DT

  for (let i = 0; i < steps; i++) {
    const gNa = G_NA_MAX * state.m * state.m * state.m * state.h
    const gK = G_K_MAX * state.n * state.n * state.n * state.n
    const iNa = gNa * (state.v - state.eNa)
    const iK = gK * (state.v - state.eK)
    const iLeak = G_LEAK * (state.v - state.leakTarget)
    const iStim = state.pushLeftMs > 0 ? state.pushAmplitude : 0

    state.v += ((-(iNa + iK + iLeak) + iStim) / C_M) * DT
    state.m += ((mInf(state.v) - state.m) / tauM) * DT
    state.h += ((hInf(state.v) - state.h) / tauH(state.v)) * DT
    state.n += ((nInf(state.v) - state.n) / tauN(state.v)) * DT
    state.tMs += DT
    if (state.pushLeftMs > 0) state.pushLeftMs -= DT

    // A spike is an overshoot past zero, which is the definition the rest of the
    // app states in words and `integrate` tests for. Rising edge only: coming back
    // down through zero is the same spike ending.
    const over = state.v > 0
    if (over && !state.wasOver) {
      state.spikesAt.push(state.tMs)
      state.spikes += 1
      // Blame the most recent press, if one was recent enough to be to blame.
      for (let j = state.pushes.length - 1; j >= 0; j--) {
        if (state.tMs - state.pushes[j].atMs > ATTRIBUTE_MS) break
        if (state.pushes[j].fired === null) {
          state.pushes[j].fired = true
          break
        }
      }
    }
    state.wasOver = over

    if (state.tMs - state.lastSampleMs >= TRAIN_SAMPLE_MS) {
      state.samples.push({ t: state.tMs, v: state.v })
      state.lastSampleMs = state.tMs
    }
  }

  // A press that has waited longer than a spike takes to start did not cause one.
  for (const push of state.pushes) {
    if (push.fired === null && state.tMs - push.atMs > ATTRIBUTE_MS) push.fired = false
  }

  // Everything older than the window has scrolled off the left edge. One sample
  // beyond it is kept so the line still reaches the edge instead of stopping short.
  const from = state.tMs - TRAIN_WINDOW_MS
  let drop = 0
  while (drop + 1 < state.samples.length && state.samples[drop + 1].t < from) drop++
  if (drop > 0) state.samples.splice(0, drop)
  while (state.pushes.length > 0 && state.pushes[0].atMs < from) state.pushes.shift()
  while (state.spikesAt.length > 0 && state.spikesAt[0] < from) state.spikesAt.shift()
}

/** Model ms since the last spike, or null if there has not been one on screen. */
export function sinceSpikeMs(state: TrainState): number | null {
  const last = state.spikesAt[state.spikesAt.length - 1]
  return last === undefined ? null : state.tMs - last
}

export type Recovery = 'rested' | 'absolute' | 'relative'

/** Which recovery window a given MOMENT fell in.
 *
 *  A moment, not "now" — that distinction is the whole usefulness of the function.
 *  The question the describer needs answered is where the last PRESS landed, and
 *  by the time there is anything to say about it the membrane has usually moved on
 *  and recovered. Asking about the present tense got this exactly backwards: every
 *  refused push was reported as having happened on a rested membrane. */
export function recoveryAt(
  state: TrainState,
  atMs: number,
  absoluteMs: number,
  relativeMs: number,
): Recovery {
  let last: number | null = null
  for (const spike of state.spikesAt) if (spike < atMs) last = spike
  if (last === null) return 'rested'
  const since = atMs - last
  if (since < absoluteMs) return 'absolute'
  if (since < relativeMs) return 'relative'
  return 'rested'
}

/** Where the membrane is at this instant. */
export function recoveryNow(
  state: TrainState,
  absoluteMs: number,
  relativeMs: number,
): Recovery {
  return recoveryAt(state, state.tMs, absoluteMs, relativeMs)
}

/** The live half of the bench's describer: what just happened, in the terms the
 *  graph is drawing it in.
 *
 *  Read off the state rather than off the button that was pressed. "You pressed
 *  hard" is a fact about the child; "nothing happened, and here is why" is a fact
 *  about the membrane, and only the second one teaches. */
export function trainNarration(
  state: TrainState,
  absoluteMs: number,
  relativeMs: number,
): { icon: string; text: string }[] {
  const last = state.pushes[state.pushes.length - 1]
  const where = last
    ? recoveryAt(state, last.atMs, absoluteMs, relativeMs)
    : recoveryNow(state, absoluteMs, relativeMs)
  const out: { icon: string; text: string }[] = []

  if (state.presses === 0) {
    out.push({
      icon: '📈',
      text: 'The line is the voltage across one patch of membrane, drawn as it happens — newest at the right, sliding left as time goes by. Flat, because nothing is being done to it. Press one of the buttons and watch what the line does.',
    })
    out.push({
      icon: '🔌',
      text: 'Look at the little cell: the thin probe touching it is an ELECTRODE — a scientist\u2019s wire, not part of the neuron. Nothing here fires by itself; every press is that wire pushing a pulse of current into this one patch, and the flash on it is your press arriving. Real neurons are pushed by other neurons instead, at their dendrites, which is what the whole-cell view shows.',
    })
    return out
  }

  if (last && last.fired === true) {
    out.push({
      icon: '⚡',
      text: 'That push worked: the line shot up past zero and came back down. That spike is an action potential, and it is the same one the membrane view draws door by door.',
    })
  } else if (last && last.fired === false) {
    out.push(
      where === 'absolute'
        ? {
            icon: '⛔',
            text: `Nothing — and nothing was possible. That push landed inside the red band, less than ${absoluteMs.toFixed(
              1,
            )} thousandths of a second after the last spike. In there the membrane cannot be fired at all, however hard you press. Try the hard push inside the red band and it will fail too.`,
          }
        : where === 'relative'
          ? {
              icon: '⚠️',
              text: `Nothing — but not because it was impossible. That push landed in the orange band, where a spike can still be had, just not for the usual price. Press the HARD one here instead and watch: it gets through, and the spike it makes is a smaller one.`,
            }
          : {
              icon: '🚫',
              text: 'Nothing, and the membrane was fully rested — so that push was simply not big enough on its own. That is what a threshold is. Now try pressing the weak one several times fast: on its own it does nothing, but pushes that land close together add up, and enough of them WILL fire the cell.',
            },
    )
  } else if (last) {
    out.push({ icon: '⏳', text: 'Just pushed — watch the line.' })
  }

  out.push({
    icon: '🔢',
    text: `${state.presses} ${state.presses === 1 ? 'press' : 'presses'} so far, ${
      state.spikes
    } ${state.spikes === 1 ? 'spike' : 'spikes'}. They are not the same number, and the gap between them is the whole point of this bench.`,
  })
  return out
}
