import { create } from 'zustand'
import type { StimulusId } from '../core/scenarios'

// The propagation view (N19), reached by flying the camera to a marker on the
// axon, and holding nothing but a position.
//
// Same bargain as the spike: the cable is integrated once and everything on
// screen is a pure function of where we are in it, so pausing is not a special
// case and scrubbing backwards is free. Nothing here accumulates.
//
// Note what this store does NOT hold: the gradients. Unlike the balance bench,
// which is a thought experiment about membranes in general and rightly keeps its
// own concentrations, this IS this cell's axon. Flatten sodium at the patch and
// the wave here must fail, or the app would be telling two stories about one
// membrane.

// The push is always at the hillock end, and there is no control for moving it.
//
// A mid-axon stimulus was offered for a while, because it is a lovely argument —
// the spike leaves in BOTH directions at once, which nothing that travels can do.
// It is also not something a neuron ever does to itself. Action potentials start
// at the axon initial segment, where the sodium-channel density is tens of times
// the soma's; a spike beginning halfway along an axon is an electrode, a nerve
// stimulator, or an injured nerve firing ectopically. Worth knowing, and worth
// building one day with the words to go with it — but not worth a toggle here,
// where every other control is something the cell does.
//
// The model has kept the ability (`stimAtUm`), and the test that a mid-cable push
// leaves symmetrically in both directions still runs. The physics is not the part
// that was cut.

/** Which stripe the magnified callout is showing, by default. Not the first:
 *  the stripe under the electrode is firing before the wave is a wave, so it
 *  teaches the spike rather than the propagation. A stripe most of the way along
 *  spends most of the run WAITING, with its doors shut and nothing happening to
 *  it, and then gets woken by its neighbour — which is the whole idea. */
export const DEFAULT_PATCH = 17

/** How long the lead-in takes on screen, ms — an input firing, its ripple
 *  spreading in along a dendrite, the soma adding up what arrives, the hillock
 *  letting go and the spike setting off toward the ring.
 *
 *  Choreography, and the same kind the whole-neuron view uses: a real ripple takes
 *  a few milliseconds and this takes a couple of seconds. What it buys is that the
 *  spike on the canvas has a CAUSE on screen — something reached the axon and set
 *  it off — rather than beginning because a button was pressed.
 *
 *  Lengthened from 1.5 s when the dendrite ripple was given its second job: being
 *  visibly SLOW. Most of the extra time goes to the crawl along the dendrite, so
 *  the axon's sprint reads as a sprint against something. */
export const LEAD_MS = 2400

/** Which axon the view is showing.
 *
 *  `race` is N21 and is a different KIND of thing from the other two: not one
 *  fibre with or without a sheath, but both at once over the same distance from
 *  one push, so that "myelin is faster" stops being a sentence and becomes
 *  something that happens in front of you. */
export type AxonMode = 'bare' | 'myelin' | 'race'

interface AxonState {
  /** How far through the LEAD-IN, 0→1, before the axon itself fires. Null when
   *  nothing has been pressed. Reaching 1 is what starts `u`. */
  lead: number | null
  /** How far through the run, 0→1. Null until the lead-in has arrived.
   *
   *  Whether the view is SHOWING is not in here: that is which zoom target the
   *  camera is on, which the neuron store already knows. Two places holding the
   *  same fact is two places to disagree. */
  u: number | null
  playing: boolean
  stimulus: StimulusId
  /** Which stripe of the ribbon the callout magnifies. */
  patch: number
  /** Which axon is on show (N20), or both at once against a clock (N21). */
  mode: AxonMode
  fire: (stimulus: StimulusId) => void
  pause: () => void
  resume: () => void
  scrubTo: (u: number) => void
  stop: () => void
  setPatch: (patch: number) => void
  setMode: (mode: AxonMode) => void
}

export const useAxonStore = create<AxonState>((set) => ({
  lead: null,
  u: null,
  playing: false,
  stimulus: 'spike',
  patch: DEFAULT_PATCH,
  mode: 'bare',
  fire: (stimulus) => set({ lead: 0, u: null, playing: true, stimulus }),
  pause: () => set({ playing: false }),
  resume: () => set({ playing: true }),
  // Dragging goes straight to the spike: the lead-in is a way IN to the run, not
  // part of the thing being measured, and nobody scrubbing wants to land in it.
  scrubTo: (u) => set({ lead: 1, u: Math.max(0, Math.min(1, u)), playing: false }),
  stop: () => set({ lead: null, u: null, playing: false }),
  // Choosing a stripe does NOT touch the run. Looking somewhere else is not a
  // different experiment, and a wave that restarted every time you pointed at it
  // would be unwatchable.
  setPatch: (patch) => set({ patch }),
  // Choosing a fibre rather than flipping one: picking the state you are already
  // in does nothing, which is what a two-way switch has to do — a toggle would
  // have thrown away a run for a press that changed nothing.
  //
  // Changing it DOES start over, because wrapping or unwrapping an axon is a
  // different axon and the wave cannot carry on at a speed the fibre no longer
  // has.
  setMode: (mode) =>
    set((s) => (s.mode === mode ? s : { mode, lead: null, u: null, playing: false })),
}))
