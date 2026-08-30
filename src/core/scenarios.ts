import { FIRE_STIMULUS, thresholdStimulus } from './spikeModel'
import type { IonCounts } from '../state/ionStore'

// N18, as named things to watch rather than a dial to hunt with (the user's call,
// and the right one: a child cannot interpret where the interesting boundary of a
// slider was).
//
// ------------------------------------------------------- where these are pressed
//
// Both pushes were once buttons over the membrane patch, side by side. The weak
// one has been taken off that row, and the reason is worth keeping: on the patch,
// a push that does nothing LOOKS like a button that does nothing. The whole scene
// is built to show a spike — doors, crowds, spotlight — and when the answer is
// "no spike", every one of those instruments has nothing to say, so the child is
// left staring at a still picture with no way to tell "not enough" from "broken".
//
// A graph does not have that problem. A flat line after a press is a RESULT, drawn
// in the same ink as a spike, on the same axis, with the press marked underneath
// it. So both pushes now live on the bench in `SpikeTrainBench`, where the trace
// answers every press whether or not the membrane does — and the patch keeps the
// one button whose story it can actually tell.
//
// The two amplitudes are FIXED, in µA/cm², not scaled to whatever the threshold
// currently is. That is the whole honesty of the exhibit. Scaled, "the one that
// fires" would keep firing however the gradients were wrecked, and the app would
// be quietly turning the stimulus up to protect its own story. Fixed, the outcome
// is the mechanism's to decide:
//
//   • at real gradients threshold is about 29, so 20 fizzles and 60 fires;
//   • flatten sodium and threshold climbs past both — neither fires;
//   • block the potassium leaks and threshold falls to about 17, so BOTH fire.
//     Which is worth meeting: it is what leak channels are for.

export type StimulusId = 'nudge' | 'spike' | 'hard'

export interface Stimulus {
  id: StimulusId
  /** µA/cm², injected for the first STIMULUS_MS. */
  amplitude: number
  /** What the button says, in the terms the biology uses.
   *
   *  These were "a small zap" and "a big zap" for a while, on the grounds that
   *  the SIZE of the lightning was doing the explaining and "action potential"
   *  was a term nobody had met. That trade is off: a child who has been through
   *  the membrane patch has met it, and a playground word for a real thing has to
   *  be unlearned later. The proper name is the one worth learning, and the bolt
   *  beside it still carries the size at a glance.
   *
   *  It does not promise an outcome it cannot keep, either — and that is the
   *  point rather than a loophole. Press "fire an action potential" with sodium's
   *  gradient flattened and nothing happens, which is the lesson: the spike is
   *  the membrane's to produce, not the button's. */
  label: string
  /** Font size for the bolt, px. This is the control's real label. */
  bolt: number
  /** What it is, in a few words. */
  note: string
}

export const STIMULI: Record<StimulusId, Stimulus> = {
  nudge: {
    id: 'nudge',
    amplitude: 20,
    label: 'Weak push',
    bolt: 15,
    note: 'A little push — not enough, at these concentrations.',
  },
  spike: {
    id: 'spike',
    amplitude: FIRE_STIMULUS,
    label: 'Fire an action potential',
    bolt: 26,
    note: 'A bigger push, over the line.',
  },
  hard: {
    id: 'hard',
    amplitude: 200,
    label: 'Hard push',
    bolt: 26,
    note: 'Much more than it takes — enough to get through sooner after a spike.',
  },
}

// Why there is a third one, and why it is 200.
//
// It exists to make the RELATIVE refractory period visible, and measurement chose
// the number. Fired on a rested membrane every amplitude gives much the same
// spike, so a third button would be pointless there. Fired soon after a spike they
// separate sharply — this is what the model does, gap across, peak of the second
// spike in mV, "—" for no spike at all:
//
//     gap →     3 ms    4 ms    5 ms    6 ms    8 ms   10 ms
//     20  µA/cm²   —       —       —       —       —       —
//     60  µA/cm²   —       —       —       —       —     +58
//     200 µA/cm²   —       —     +34     +53     +61     +63
//     400 µA/cm²   —     +21     +48     +60     +67     +68
//
// Three things a child can find in that table by pressing buttons: nothing works
// in the first few milliseconds however hard you push (absolute); after that a
// hard push works when an ordinary one still does not (relative); and the spike
// you buy that way is a smaller one. 200 sits where the middle row is widest —
// 400 would fire nearly as early as the absolute period ends and blur the two
// ideas together.

/** The pushes offered on the spike-train bench, weakest first.
 *
 *  This was `STIMULUS_IDS` and it was the membrane patch's button row. It is the
 *  bench's button row now — see the note above. */
export const BENCH_PUSHES: StimulusId[] = ['nudge', 'spike', 'hard']

/** Whether this push is over the line, given what the membrane holds. Measured,
 *  so it changes when the gradients do — a nudge that fizzles normally will fire
 *  a cell whose leak channels are blocked. */
export function isOverThreshold(
  id: StimulusId,
  counts: IonCounts,
  leaksOn: boolean,
): boolean {
  return STIMULI[id].amplitude >= thresholdStimulus(counts, leaksOn)
}
