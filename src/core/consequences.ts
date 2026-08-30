import { IONS, gradientFrom, type IonKind, type Side } from './ions'
import type { IonCounts } from '../state/ionStore'
import { STIMULI, isOverThreshold, type StimulusId } from './scenarios'
import { thresholdStimulus } from './spikeModel'
import {
  apPeakMv,
  apRestMv,
  apVmAt,
  apTroughMv,
  potassiumLagMs,
  spikeCost,
} from './actionPotential'
import { nernstMv } from './voltage'

// X01, the pattern the whole app is built around: change one thing, and be told
// what followed. Every consequence is worked out from the state before and
// after, never written down as a fixed answer — so it cannot claim something the
// simulation did not actually do.

export type ChangeEvent =
  | { kind: 'ion'; ion: IonKind; side: Side }
  | { kind: 'ions-reset' }
  | { kind: 'pump'; on: boolean }
  | { kind: 'leaks'; on: boolean }
  | { kind: 'action-potential'; stimulus: StimulusId }
  | { kind: 'transmitter' }

export interface Snapshot {
  counts: IonCounts
  /** Where the voltage is headed given what is open, mV. */
  vm: number
  /** Whether the potassium leaks are open — a spike run with them shut is a
   *  different spike, so the consequence has to know. */
  leaksOn: boolean
}

export interface Consequence {
  /** What the kid just did. */
  what: string
  /** What it did to the membrane immediately. */
  immediate: string
  /** What follows from that — the part worth learning. */
  downstream: string
}

/** Proper minus sign, to match every other number in the app. */
const mv = (value: number): string => {
  const rounded = Math.round(value)
  if (rounded > 0) return `+${rounded} mV`
  if (rounded < 0) return `−${Math.abs(rounded)} mV`
  return '0 mV'
}

/** How the voltage moved, in plain words. */
function voltageMove(before: number, after: number): string {
  const change = after - before
  if (Math.abs(change) < 1.5) {
    return `The voltage barely moved: ${mv(before)} → ${mv(after)}.`
  }
  return `The voltage ${change > 0 ? 'climbed' : 'fell'} from ${mv(before)} to ${mv(after)}.`
}

function ionConsequence(
  ion: IonKind,
  side: Side,
  before: Snapshot,
  after: Snapshot,
): Consequence {
  const species = IONS[ion]
  const from = before.counts[ion][side]
  const to = after.counts[ion][side]
  const direction = gradientFrom(after.counts[ion].outside, after.counts[ion].inside)
  const eBefore = nernstMv(ion, before.counts)
  const eAfter = nernstMv(ion, after.counts)

  const shape =
    direction === 'balanced'
      ? `${species.name} is now spread evenly, so it has no gradient left at all.`
      : `${species.name} is now crowded ${direction === 'inward' ? 'outside' : 'inside'}, so it would move ${direction === 'inward' ? 'in' : 'out'} through an open door.`

  return {
    what: `You changed ${species.name} ${side} the cell: ${from} → ${to}.`,
    immediate: shape,
    downstream: `Its own preferred voltage moved from ${mv(eBefore)} to ${mv(
      eAfter,
    )}. ${voltageMove(before.vm, after.vm)}`,
  }
}

/** What a whole spike did — worked out from the model that draws it, so the
 *  wording cannot promise a spike the membrane did not actually manage. */
function spikeConsequence(after: Snapshot, id: StimulusId): Consequence {
  const { counts, leaksOn } = after
  const push = STIMULI[id]
  const rest = apRestMv(counts, leaksOn)
  const peak = apPeakMv(counts, leaksOn, push.amplitude)
  const trough = apTroughMv(counts, leaksOn, push.amplitude)
  const cost = spikeCost(counts, leaksOn, push.amplitude)
  // One decimal: the real lag is well under a millisecond, and rounding it to a
  // whole number turned 0.7 into 1 — the same event the banner quotes as 0.7.
  const lag = potassiumLagMs(counts, leaksOn, push.amplitude).toFixed(1)

  // A push that does not reach threshold: the honest and much less obvious half
  // of the all-or-nothing law. Something DID happen — the membrane depolarized
  // and leaked back — and nothing was sent.
  if (!isOverThreshold(id, counts, leaksOn)) {
    return {
      what: `You pushed the membrane with ${push.amplitude} µA/cm².`,
      immediate: `It climbed from ${mv(rest)} to ${mv(
        peak,
      )}, then simply leaked back down. No spike.`,
      downstream: `That is not a small spike — it is NO spike. The sodium doors never got enough of a head start to take over. A push has to carry the membrane to about ${mv(
        thresholdMv(counts, leaksOn),
      )} before they do, and once it does, the size of the push stops mattering: every spike is the same size. All or nothing.`,
    }
  }

  // A spike is not guaranteed, and the test is whether it gets PAST zero.
  // Flatten sodium's gradient and the doors still drag the voltage upward —
  // toward sodium's new balance point, which is now zero — so there is real
  // depolarization but no overshoot, and no spike. Saying so is only possible
  // because the number comes from the same equation the picture does.
  if (peak < 0) {
    return {
      what: 'You fired an action potential.',
      immediate: `The doors opened on time and the voltage climbed from ${mv(
        rest,
      )} to ${mv(peak)} — and stopped short of zero.`,
      downstream:
        'That is a depolarization, but it is not a spike. An action potential overshoots into positive, and it can only do that because sodium is genuinely crowded outside: opening the doors lets the voltage run toward wherever sodium is content, and with the gradient flattened that is zero. Put sodium back and fire again.',
    }
  }

  return {
    what: 'You fired an action potential.',
    immediate: `Sodium doors flew open and the inside shot from ${mv(rest)} up to ${mv(
      peak,
    )}. The potassium doors answered ${lag} ms later and dragged it back down past resting, to ${mv(
      trough,
    )}, before it settled.`,
    downstream: `Now look at the ion bars — they did not move. The entire spike carried ${cost.naMM.toFixed(
      3,
    )} mM of sodium in and ${cost.kMM.toFixed(
      3,
    )} mM of potassium out, and one ball on those bars is a whole 1 mM. It would take about ${Math.round(
      cost.spikesPerBall,
    )} spikes in a row to shift a single ball. The gradients are the battery; a spike is one sip.`,
  }
}

export function consequenceOf(
  event: ChangeEvent,
  before: Snapshot,
  after: Snapshot,
): Consequence {
  switch (event.kind) {
    case 'ion':
      return ionConsequence(event.ion, event.side, before, after)

    case 'ions-reset':
      return {
        what: 'You put every ion back to its real concentration.',
        immediate: 'The gradients a living cell actually keeps are back.',
        downstream: voltageMove(before.vm, after.vm),
      }

    case 'pump':
      return event.on
        ? {
            what: 'You started the pump again.',
            immediate: 'It is carrying sodium out and potassium in once more.',
            downstream: `${voltageMove(
              before.vm,
              after.vm,
            )} The pump’s job is keeping the gradients topped up, not making the voltage.`,
          }
        : {
            what: 'You stopped the pump.',
            immediate: 'Nothing is refilling the gradients now.',
            downstream: `${voltageMove(
              before.vm,
              after.vm,
            )} That is the point: the pump is not what makes the voltage. Over minutes the gradients would run down and then it would collapse — but not in the next few seconds.`,
          }

    case 'leaks':
      return event.on
        ? {
            what: 'You reopened the potassium leak channels.',
            immediate: 'Potassium can slip out of the cell again.',
            downstream: `${voltageMove(
              before.vm,
              after.vm,
            )} Nothing about the piles of ions changed — only what is able to cross.`,
          }
        : {
            what: 'You shut the potassium leak channels.',
            immediate: 'Potassium has no way through the membrane any more.',
            downstream: `${voltageMove(
              before.vm,
              after.vm,
            )} Look at the ion sliders: the gradients are untouched. The voltage came from potassium being ABLE to cross, not from the pile being there.`,
          }

    case 'action-potential':
      return spikeConsequence(after, event.stimulus)

    case 'transmitter':
      return {
        what: 'You released a chemical messenger.',
        immediate:
          'It landed in the cup on the ligand-gated channel and the gate opened — with no change in voltage needed.',
        downstream: `Sodium is trickling in and ${voltageMove(
          before.vm,
          after.vm,
        ).toLowerCase()} A small nudge upward like this is what one neuron does to the next; enough of them together is what fires it.`,
      }
  }
}

/** The voltage a push has to reach before the sodium doors take over. Read off
 *  the model — the highest a just-too-small push manages — rather than named as a
 *  constant, because it moves with the gradients like everything else. */
function thresholdMv(counts: IonCounts, leaksOn: boolean): number {
  const at = thresholdStimulus(counts, leaksOn)
  if (!Number.isFinite(at)) return 0
  let best = -Infinity
  for (let i = 0; i <= 80; i++) {
    best = Math.max(best, apVmAt(i / 80, counts, leaksOn, at * 0.98))
  }
  return best
}
