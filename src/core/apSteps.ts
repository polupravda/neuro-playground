import {
  apFired,
  apVmAt,
  kOpenFraction,
  naOpenFraction,
  potassiumLagMs,
} from './actionPotential'
import { OPEN_FRACTION } from './channels'
import type { IonCounts } from '../state/ionStore'

// The spike, told as a handful of numbered moments (N16/N18).
//
// Why this exists: watched as one smooth three-second sweep, the single most
// important fact — that potassium's door opens LATE, after sodium's — goes by
// too fast to see. A child cannot catch it, and it is the reason a spike is a
// spike rather than a step.
//
// So playback pauses on each moment. Every boundary below is MEASURED off the
// model rather than typed in: the step called "potassium opens at last" happens
// at the u where `gKAt` actually crosses the threshold the picture uses. The
// caption cannot drift away from the drawing, and the lag it quotes is the lag
// the animation shows.

export type ApStepKey =
  | 'ready'
  // A push that does not reach threshold has its own, much shorter story. It
  // cannot borrow the spike's: with nothing ever opening, "the sodium door flies
  // open" would sit at the very end of the run.
  | 'fizzle-rise'
  | 'fizzle-back'
  | 'na-opens'
  | 'peak'
  // Sodium shuts itself BEFORE potassium is properly open — measured, and worth
  // the order it puts the story in: sodium's stop is self-inflicted, not
  // something potassium did to it.
  | 'falling'
  | 'k-opens'
  | 'undershoot'
  | 'back'

export interface ApStep {
  key: ApStepKey
  /** Where in the spike this moment is, 0→1. */
  at: number
  /** Short heading, for the banner. */
  title: string
  /** The one thing to look at. */
  watch: string
  /** How long to hold here before moving on, ms of real time. */
  dwellMs: number
}

/** First position at which a gate is open enough to be drawn open. */
function opensAt(g: (u: number) => number): number {
  for (let i = 0; i <= 1000; i++) {
    const u = i / 1000
    if (g(u) > OPEN_FRACTION) return u
  }
  return 1
}

/** First position AFTER `from` at which it has shut again. */
function shutsAt(g: (u: number) => number, from: number): number {
  for (let i = Math.round(from * 1000); i <= 1000; i++) {
    const u = i / 1000
    if (g(u) <= OPEN_FRACTION) return u
  }
  return 1
}

function extremeAt(
  counts: IonCounts,
  leaksOn: boolean,
  high: boolean,
  stimulus?: number,
): number {
  let best = high ? -Infinity : Infinity
  let at = 0
  for (let i = 0; i <= 1000; i++) {
    const u = i / 1000
    const vm = apVmAt(u, counts, leaksOn, stimulus)
    if (high ? vm > best : vm < best) {
      best = vm
      at = u
    }
  }
  return at
}

/** The four instants that matter, as positions through the spike. Exported so
 *  the drawing can flash a gate at the moment it changes rather than watching for
 *  a change frame by frame — which would not survive scrubbing backwards.
 *
 *  A function of the gradients now, not a constant: the spike is integrated from
 *  them, so when they change these move. */
export function gateMoments(
  counts: IonCounts,
  leaksOn = true,
  stimulus?: number,
) {
  const na = (u: number) => naOpenFraction(u, counts, leaksOn, stimulus)
  const k = (u: number) => kOpenFraction(u, counts, leaksOn, stimulus)
  return {
    naOpens: opensAt(na),
    kOpens: opensAt(k),
    naShuts: shutsAt(na, opensAt(na)),
    kShuts: shutsAt(k, opensAt(k)),
  }
}

/** How long playback holds on each moment, ms of real time. Kept as a table so
 *  the total is available without needing the ion counts — one of the teaching
 *  notes has to say how long the whole demonstration runs. */
const DWELLS: Record<ApStepKey, number> = {
  ready: 1400,
  'fizzle-rise': 2600,
  'fizzle-back': 1800,
  'na-opens': 2200,
  peak: 2000,
  falling: 1800,
  // The longest hold in the sequence, on the moment the whole thing is about.
  'k-opens': 2600,
  undershoot: 2000,
  // Held like any other moment, and then the spike is simply over: the membrane
  // is back where it started and the button offers another. This used to be 0,
  // which meant the last beat flashed past unread while playback stopped dead at
  // the end waiting to be dismissed.
  back: 1800,
}

/** The moments of a run that fires, in the order the model does them. */
const SPIKE_KEYS: ApStepKey[] = [
  'ready',
  'na-opens',
  'peak',
  'falling',
  'k-opens',
  'undershoot',
  'back',
]

/** How long the pauses add up to for a SPIKE — the run the teaching note about
 *  "how long the whole demonstration takes" is describing. Summing every dwell in
 *  the table would count the fizzle's as well, which belong to a different and
 *  shorter story. */
export const DWELL_TOTAL_MS = SPIKE_KEYS.reduce((sum, key) => sum + DWELLS[key], 0)

/** The moments of one spike, in order. */
export function apSteps(
  counts: IonCounts,
  leaksOn = true,
  stimulus?: number,
): ApStep[] {
  if (!apFired(counts, leaksOn, stimulus)) return fizzleSteps(counts, leaksOn, stimulus)
  const moments = gateMoments(counts, leaksOn, stimulus)
  const naOpen = moments.naOpens
  const kOpen = moments.kOpens
  const naShut = moments.naShuts
  const peak = extremeAt(counts, leaksOn, true, stimulus)
  const trough = extremeAt(counts, leaksOn, false, stimulus)
  const lag = potassiumLagMs(counts, leaksOn, stimulus).toFixed(1)

  return [
    {
      key: 'ready',
      at: 0,
      title: 'Resting, and nothing is happening',
      watch: 'Both voltage-gated doors are shut. Only the plain leak is open.',
      dwellMs: DWELLS['ready'],
    },
    {
      key: 'na-opens',
      at: naOpen,
      title: 'The SODIUM door flies open',
      watch: 'Only the gold one. Look at the violet potassium door — still shut.',
      dwellMs: DWELLS['na-opens'],
    },
    {
      key: 'peak',
      at: peak,
      title: 'Sodium has rushed in — the top of the spike',
      watch: 'The inside has gone POSITIVE. Potassium is still shut, even now.',
      dwellMs: DWELLS['peak'],
    },
    {
      key: 'falling',
      at: naShut,
      title: 'The sodium door shuts ITSELF',
      watch: 'Nobody closed it. It does that on its own, while the membrane is still depolarized.',
      dwellMs: DWELLS['falling'],
    },
    {
      key: 'k-opens',
      at: kOpen,
      title: `Now the POTASSIUM door opens — ${lag} ms late`,
      watch: 'Same signal as sodium, answered slowly. That lateness is the whole trick.',
      dwellMs: DWELLS['k-opens'],
    },
    {
      key: 'undershoot',
      at: trough,
      title: 'Overshot: more negative than it started',
      watch: 'The slow potassium door is slow to shut, too. Hence the dip.',
      dwellMs: DWELLS['undershoot'],
    },
    {
      key: 'back',
      at: 1,
      title: 'Back to resting',
      watch: 'Nothing pushed it back. With only the leak open, this is where it sits.',
      dwellMs: DWELLS['back'],
    },
  ]
}

/** What to watch when the push was not enough. Three moments, and the middle one
 *  is the point: something happened, and it was not a small spike. */
function fizzleSteps(counts: IonCounts, leaksOn: boolean, stimulus?: number): ApStep[] {
  const peak = extremeAt(counts, leaksOn, true, stimulus)
  return [
    {
      key: 'ready',
      at: 0,
      title: 'Resting, and nothing is happening',
      watch: 'Both voltage-gated doors are shut. Only the plain leak is open.',
      dwellMs: DWELLS.ready,
    },
    {
      key: 'fizzle-rise',
      at: peak,
      title: 'It lifted a little — and that is all',
      watch: 'Look at the doors: not one of them opened. The push was not enough.',
      dwellMs: DWELLS['fizzle-rise'],
    },
    {
      key: 'fizzle-back',
      at: 1,
      title: 'And it simply leaked back down',
      watch: 'No spike. Not a small one — none. Try the bigger push.',
      dwellMs: DWELLS['fizzle-back'],
    },
  ]
}

/** Which moment we are in — the last one reached. */
export function stepAt(steps: ApStep[], u: number): ApStep {
  let found = steps[0]
  for (const step of steps) if (u >= step.at) found = step
  return found
}

/** The step crossed by moving from `from` to `to`, if any. Strictly after
 *  `from`, so a step already being held at does not fire twice — which also
 *  means the FIRST step is never "crossed", and its pause has to be applied when
 *  the spike starts. */
export function stepCrossed(steps: ApStep[], from: number, to: number): ApStep | null {
  for (const step of steps) {
    if (step.at > from && step.at <= to && step.dwellMs > 0) return step
  }
  return null
}

/** One tick of playback. Where the position goes, how long is left to hold, and
 *  whether the spike has just finished.
 *
 *  Pure, and in `core/` rather than in the animation loop, for a reason worth
 *  recording: a headless browser reports a frame delta of zero, so playback never
 *  advances in a screenshot and NONE of this can be checked by looking at one. It
 *  is sequencing logic, and sequencing logic has to be testable without a screen.
 *
 *  `dwellLeft` counts down in real milliseconds. When it runs out on the final
 *  moment the spike is over — there is no end state to dismiss. */
export interface Tick {
  u: number
  dwellLeft: number
  over: boolean
}

export function advance(
  steps: ApStep[],
  u: number,
  dwellLeft: number,
  dtMs: number,
  apMs: number,
): Tick {
  if (dwellLeft > 0) {
    const left = dwellLeft - dtMs
    return { u, dwellLeft: left, over: left <= 0 && u >= 1 }
  }
  const next = Math.min(1, u + dtMs / apMs)
  const beat = stepCrossed(steps, u, next)
  if (beat) return { u: beat.at, dwellLeft: beat.dwellMs, over: false }
  if (next >= 1) return { u: next, dwellLeft: steps[steps.length - 1].dwellMs, over: false }
  return { u: next, dwellLeft: 0, over: false }
}

/** How long a whole run takes, ms: the movement plus every pause. */
export function runLengthMs(apMs: number): number {
  return apMs + DWELL_TOTAL_MS
}

/** Whether a gate has JUST changed state — used to flash the channel at the
 *  moment it happens, since a state that is merely different is much harder to
 *  notice than a change you watched.
 *
 *  One-sided on purpose. A window centred on the change fires BEFORE it, which
 *  pre-announces the event: at the top of the spike the potassium channel was
 *  glowing while its own caption said it was still shut. A flash may only ever
 *  report something that has already happened. */
export function justChanged(u: number, at: number): number {
  const window = 0.05
  const since = u - at
  if (since < 0 || since > window) return 0
  return 1 - since / window
}

