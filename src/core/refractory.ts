import type { IonCounts } from '../state/ionStore'
import type { TeachingPara } from './neuron'
import {
  FIRE_STIMULUS,
  PAIRED_MS,
  STIMULUS_MS,
  thresholdStimulus,
  trajectory,
  type SecondPush,
} from './spikeModel'

// The refractory period (N22), measured rather than asserted.
//
// Nothing in this file adds a rule. The mechanism was already in the model and
// has been since Milestone 3 opened: sodium's h gate shuts during a spike and
// takes milliseconds to open again, and potassium's n gate stays open for
// milliseconds after. Push the membrane again while those two are still true and
// the sodium current it can raise is smaller and the potassium current fighting it
// is bigger. That is the whole of it.
//
// So the two refractory periods are not constants to be looked up. They are
// FOUND, by firing twice at different gaps and asking what happened:
//
//   • ABSOLUTE — the stretch where no push, however hard, produces a spike.
//     Bounded by bisection on the gap, using a stimulus far above threshold.
//   • RELATIVE — the stretch after that where an ordinary push fails but a
//     stronger one works. Ends when the ordinary push works again.
//
// Which means they move when the membrane does. Block the potassium leaks and
// they change; flatten sodium and there is no first spike to be refractory after.

/** A push big enough to settle the question of whether the membrane CAN fire —
 *  far above threshold, so a failure is the membrane's refusal rather than a
 *  feeble stimulus. Ten times the ordinary one. */
export const STRONG_STIMULUS = FIRE_STIMULUS * 10

/** What happened to a second push arriving this long after the first. */
export interface SecondSpike {
  /** Did it produce a spike of its own? */
  fired: boolean
  /** How high that second spike reached, mV. */
  peakMv: number
  /** As a fraction of the first spike's height above rest, 0→1. A second spike
   *  during the relative period is a smaller spike, and this is how much. */
  ofFirst: number
}

const gap = (atMs: number, amplitude: number): SecondPush => ({ atMs, amplitude })

/** Fire twice, and measure what the SECOND push did — by DIFFERENCE.
 *
 *  This is the part that has to be got right, and a first attempt got it wrong in
 *  a way worth recording. It asked for the highest voltage after the second push
 *  landed, which at a 1 ms gap is the top of the FIRST spike: the membrane was
 *  still on its way up, the measurement reported a fine second spike, and the
 *  absolute refractory period came out as zero. The tail of one event read as
 *  another event.
 *
 *  So the run is compared against the same run WITHOUT the second push — the same
 *  gates, the same window, the same sample grid, differing in nothing but the push
 *  — and a second spike is a departure from what the membrane was going to do
 *  anyway. The two clauses are the ones the model already uses for "fired"
 *  everywhere else: it overshoots zero, and it swings at least 40 mV further than
 *  it otherwise would have.
 */
export function secondSpike(
  counts: IonCounts,
  leaksOn: boolean,
  delayMs: number,
  amplitude: number = FIRE_STIMULUS,
): SecondSpike {
  const push = gap(delayMs, amplitude)
  const paired = trajectory(counts, leaksOn, FIRE_STIMULUS, push)
  // The comparison run: identical in every way, including its window and sampling,
  // because it is also a paired run — with a second push of nothing.
  const alone = trajectory(counts, leaksOn, FIRE_STIMULUS, gap(delayMs, 0))
  const first = trajectory(counts, leaksOn, FIRE_STIMULUS)

  const last = paired.vm.length - 1
  const from = Math.floor(((delayMs + STIMULUS_MS * 0.5) / paired.windowMs) * last)
  let peak = -Infinity
  let owed = 0
  for (let i = Math.max(0, from); i <= last; i++) {
    peak = Math.max(peak, paired.vm[i])
    owed = Math.max(owed, paired.vm[i] - alone.vm[i])
  }
  const firstSwing = first.peak - first.rest
  return {
    fired: peak > 0 && owed > 40,
    peakMv: peak,
    ofFirst: firstSwing > 0 ? Math.max(0, (peak - paired.rest) / firstSwing) : 0,
  }
}

/** The longest gap at which even a very strong push still fails, ms.
 *
 *  Bisected on the model. Below this the membrane cannot be fired at all, however
 *  hard it is pushed — sodium's doors are latched shut, and current does not
 *  unlatch a latch. */
export function absoluteRefractoryMs(counts: IonCounts, leaksOn = true): number {
  if (!trajectory(counts, leaksOn, FIRE_STIMULUS).fired) return 0
  let no = STIMULUS_MS
  let yes = PAIRED_MS - 10
  if (secondSpike(counts, leaksOn, no, STRONG_STIMULUS).fired) return 0
  if (!secondSpike(counts, leaksOn, yes, STRONG_STIMULUS).fired) return yes
  for (let i = 0; i < 18; i++) {
    const mid = (no + yes) / 2
    if (secondSpike(counts, leaksOn, mid, STRONG_STIMULUS).fired) yes = mid
    else no = mid
  }
  return no
}

/** The gap at which an ORDINARY push works again, ms — the end of the relative
 *  refractory period. Between this and the absolute one the membrane can be fired,
 *  but only by more than it usually takes. */
export function relativeRefractoryMs(counts: IonCounts, leaksOn = true): number {
  if (!trajectory(counts, leaksOn, FIRE_STIMULUS).fired) return 0
  let no = STIMULUS_MS
  let yes = PAIRED_MS - 10
  if (!secondSpike(counts, leaksOn, yes, FIRE_STIMULUS).fired) return yes
  for (let i = 0; i < 18; i++) {
    const mid = (no + yes) / 2
    if (secondSpike(counts, leaksOn, mid, FIRE_STIMULUS).fired) yes = mid
    else no = mid
  }
  return yes
}

/** How much harder the membrane has to be pushed at this gap, as a multiple of
 *  its ordinary threshold. Infinity inside the absolute period, where no push
 *  works, and 1 once it has recovered. */
export function pushNeededAt(counts: IonCounts, leaksOn: boolean, delayMs: number): number {
  const rested = thresholdStimulus(counts, leaksOn)
  if (!Number.isFinite(rested) || rested <= 0) return Infinity
  if (!secondSpike(counts, leaksOn, delayMs, STRONG_STIMULUS).fired) return Infinity
  let no = 0
  let yes = STRONG_STIMULUS
  for (let i = 0; i < 16; i++) {
    const mid = (no + yes) / 2
    if (secondSpike(counts, leaksOn, delayMs, mid).fired) yes = mid
    else no = mid
  }
  return yes / rested
}

/** The teaching notes, built from what the model did. */
export function refractoryFacts(counts: IonCounts, leaksOn = true): TeachingPara[] {
  const absolute = absoluteRefractoryMs(counts, leaksOn)
  const relative = relativeRefractoryMs(counts, leaksOn)
  if (absolute <= 0) {
    return [
      {
        icon: '🚫',
        text: 'There is no first spike on this membrane, so there is nothing for it to be recovering from. Put sodium’s gradient back and try again.',
      },
    ]
  }
  return [
    {
      icon: '⛔',
      text: `Push it again straight away and nothing happens — not a small spike, nothing. For about the first ${absolute.toFixed(
        1,
      )} thousandths of a second after a spike this membrane cannot be fired at all, however hard you push. That stretch is called the ABSOLUTE refractory period.`,
    },
    {
      icon: '🔒',
      text: 'And the reason is a door, not a rule. Sodium’s channels have a second gate that swings shut at the top of a spike and is slow to reopen. While it is shut the door cannot be opened by anything — current does not unlatch a latch. Nothing in this model was written to make that happen; it falls out of the gate that was already there.',
    },
    {
      icon: '⚠️',
      text: `Wait a little longer and a spike becomes possible again, but it costs more: an ordinary push still fails until about ${relative.toFixed(
        1,
      )} ms, and a stronger one gets through sooner. That in-between stretch is the RELATIVE refractory period — possible, but only for a bigger push, and the spike you get is smaller.`,
    },
    {
      icon: '🌊',
      text: 'Two things are working against you there. Some sodium doors are still latched, so there are fewer to open — and potassium’s doors are still open from last time, pulling the other way. The membrane is being pushed uphill while somebody holds the door.',
    },
    {
      icon: '⏭️',
      text: 'Which is why a neuron has a top speed. It cannot fire faster than it can recover, and that sets a ceiling on how many spikes a second it can send — one of the few hard limits in a nervous system.',
    },
  ]
}
