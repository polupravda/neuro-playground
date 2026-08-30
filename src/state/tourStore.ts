import { create } from 'zustand'
import { TOUR_STOPS } from '../core/tour'

// ONE SIGNAL, THREE SIZES (C05) — the exhibit's state, and nothing else.
//
// It has had three shapes. First a guided tour's position along a route, with
// next, back and auto-advance. Then a switch on the main canvas. Both were a
// REMOTE CONTROL for the scene, which is why neither could be an exhibit
// without covering the thing it was controlling. It is a drawer now that
// draws its own three views (user, 2026-08-28), so what it holds is simply:
// is it open, which size are we looking at, and where has the run got to.
//
// The run's clock is a POSITION, 0→1, the same way every other run in this app
// is — so it can be paused, scrubbed and read at any moment, and all three
// pictures are the same number seen three ways.

interface TourState {
  open: boolean
  /** Index into TOUR_STOPS: which size is on show. */
  which: number
  /** Where the run has got to, 0→1, or null at rest. */
  u: number | null
  playing: boolean
  openBench: () => void
  closeBench: () => void
  show: (which: number) => void
  fire: () => void
  scrubTo: (u: number) => void
  pause: () => void
  resume: () => void
  step: (du: number) => void
  /** Opening from the contents starts at the smallest size and lets the child
   *  climb, which is the order the course meets them in. */
  start: () => void
}

export const useTourStore = create<TourState>((set, get) => ({
  open: false,
  which: 0,
  u: null,
  playing: false,
  openBench: () => set({ open: true }),
  closeBench: () => set({ open: false }),
  // Switching size does NOT restart the run: the whole claim of this exhibit
  // is that the three pictures are one event, so stepping between them must
  // keep the clock where it was.
  show: (which) => set({ which: Math.max(0, Math.min(TOUR_STOPS.length - 1, which)) }),
  fire: () => set({ u: 0, playing: true }),
  scrubTo: (u) => set({ u: Math.max(0, Math.min(1, u)), playing: false }),
  pause: () => set({ playing: false }),
  resume: () => set({ playing: true }),
  step: (du) => {
    const { u, playing } = get()
    if (u === null || !playing) return
    const next = u + du
    if (next >= 1) set({ u: 1, playing: false })
    else set({ u: next })
  },
  start: () => set({ open: true, which: 0 }),
}))
