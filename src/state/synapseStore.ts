import { create } from 'zustand'

// S12's semantic state, and it is almost nothing: where the run has got to, and
// whether it is playing.
//
// ⚠ THE SAME SHAPE AS `axonStore`, deliberately. Both views are one run watched
// with a play/pause and a scrubber, and giving this one a different shape — a
// start time on the frame clock, say — would have been a second pattern for the
// same thing, and a second place for the position to be wrong.
//
// Whether the view is SHOWING is not in here: that is which zoom target the
// camera is on, which the neuron store already knows. Two places holding the
// same fact is two places to disagree.
//
// The event is a POSITION rather than an elapsed time, so it can be stopped
// anywhere and dragged back and forth, and every part of the picture — the
// calcium gate, the vesicles, the transmitter, the receptors — follows to that
// moment because each is a pure function of it.

interface SynapseState {
  /** Position through the run, 0→1, or null at rest. */
  u: number | null
  playing: boolean
  fire: () => void
  pause: () => void
  resume: () => void
  scrubTo: (u: number) => void
  reset: () => void
}

export const useSynapseStore = create<SynapseState>((set) => ({
  u: null,
  playing: false,
  fire: () => set({ u: 0, playing: true }),
  pause: () => set({ playing: false }),
  // Restarting from the end rather than resuming past it: a run held at its
  // finish has nothing left to play.
  resume: () => set((s) => ({ playing: true, u: (s.u ?? 0) >= 1 ? 0 : s.u })),
  // Dragging while at rest is allowed and lands you inside the run, paused.
  scrubTo: (u) => set({ u: Math.max(0, Math.min(1, u)), playing: false }),
  reset: () => set({ u: null, playing: false }),
}))
