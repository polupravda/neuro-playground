import { create } from 'zustand'
import type { ApState } from '../core/actionPotential'
import type { ApStepKey } from '../core/apSteps'
import type { StimulusId } from '../core/scenarios'

// The action potential is fired from here and clocked by the stage (N16, N17).
// The store holds the POSITION through the spike and whether it is advancing;
// the shape itself lives in core/actionPotential.ts as a pure function of that
// position, which is what makes pausing and scrubbing possible at all — there is
// no accumulated state to rewind, only a number to set.

interface ApStore {
  /** How far through the spike, 0→1. Null when the membrane is at rest. */
  u: number | null
  /** Which push is being watched. The outcome is not stored — it is whatever the
   *  model does with this push and the gradients the cell happens to have. */
  stimulus: StimulusId
  /** Whether the position is advancing on its own. */
  playing: boolean
  /** Live reading at that position, published by the stage. */
  live: ApState | null
  /** Whether a running spike puts whatever is carrying it in the spotlight, and
   *  lets everything else fall back. Off shows the membrane as it always is. */
  spotlight: boolean
  /** Which numbered moment of the spike we are in, and whether playback is
   *  holding still on it. Published by the stage. */
  step: ApStepKey | null
  holding: boolean
  /** How brightly to draw each protein, keyed by channel id and 'pump'; null
   *  when nothing is singled out. Published by the stage in coarse steps, so a
   *  panel reading it re-renders when the brightness visibly changes rather than
   *  sixty times a second. NEVER derive this in a selector — building a fresh
   *  object per call defeats the equality check and spins the render loop. */
  emphasis: Record<string, number> | null
  fire: (stimulus: StimulusId) => void
  pause: () => void
  resume: () => void
  /** Drag the spike to a moment and hold it there. */
  scrubTo: (u: number) => void
  stop: () => void
  publish: (
    live: ApState | null,
    emphasis: Record<string, number> | null,
    step: ApStepKey | null,
    holding: boolean,
  ) => void
  toggleSpotlight: () => void
}

export const useApStore = create<ApStore>((set) => ({
  u: null,
  playing: false,
  stimulus: 'spike',
  live: null,
  spotlight: true,
  emphasis: null,
  step: null,
  holding: false,
  fire: (stimulus) => set({ u: 0, playing: true, stimulus }),
  pause: () => set({ playing: false }),
  resume: () => set({ playing: true }),
  scrubTo: (u) => set({ u: Math.max(0, Math.min(1, u)), playing: false }),
  stop: () =>
    set({ u: null, playing: false, live: null, emphasis: null, step: null, holding: false }),
  publish: (live, emphasis, step, holding) => set({ live, emphasis, step, holding }),
  toggleSpotlight: () => set((s) => ({ spotlight: !s.spotlight })),
}))
