import { create } from 'zustand'

// D05's semantic state, and it is almost nothing: when the current race
// started.
//
// ⚠ NO `open` ANY MORE (user, 2026-08-31): D05 is a place on the cell, so
// whether it is on screen is the CAMERA's business, not a flag of its own. A
// second source of truth for "is this showing" is how a view ends up drawn
// behind a camera that has flown somewhere else.
//
// ⚠ THE WALL IS NO LONGER SOMETHING THE CHILD BUILDS (user, 2026-08-30:
// "there's no situation when K⁺ channels are absent… I would rather let them
// race, with no option of adding channels").
//
// They were right and the model agreed: a wall with no holes drawn still had a
// perfectly leaky membrane underneath, so the picture offered a state neither
// the model nor a cell has. Both fibres now wear the same permanent holes, and
// the one thing to do is send a signal down them.

interface LeakyState {
  /** When the current race began, or null between races. */
  startedMs: number | null
  race: (nowMs: number) => void
  reset: () => void
}

export const useLeakyStore = create<LeakyState>((set) => ({
  startedMs: null,
  race: (nowMs) => set({ startedMs: nowMs }),
  reset: () => set({ startedMs: null }),
}))
