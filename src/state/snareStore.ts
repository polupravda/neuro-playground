import { create } from 'zustand'

// D06's state: the drawer, and where the cycle has got to.
//
// This one IS a drawer — unlike passive spread, which moved out to be a place.
// The criterion holds: a place is a part of the neuron, and this is not a part
// of the neuron, it is one event on one vesicle taken out and slowed down. It
// is triggered from the view it deepens (the synapse), never from a global
// menu, which is what keeps the child's map spatial.

interface SnareState {
  open: boolean
  /** Position through the cycle, 0→1. */
  u: number
  playing: boolean
  /** ⚠ THE LABELS SWITCH (user, 2026-09-04): off = the run never pauses at
   *  the labelled checkpoints and no label is drawn anywhere — rest and end
   *  stills included. */
  labelsOn: boolean
  openBench: () => void
  closeBench: () => void
  play: () => void
  pause: () => void
  scrubTo: (u: number) => void
  reset: () => void
  toggleLabels: () => void
}

export const useSnareStore = create<SnareState>((set) => ({
  open: false,
  u: 0,
  playing: false,
  labelsOn: true,
  // ⚠ Opening does NOT start it (user, 2026-09-02: "start animation on button
  // click only"). The drawer opens on the labelled still — callouts tying
  // each name to its part — and the run belongs to the ▶ button. (Supersedes
  // the 2026-08-31 auto-start; the callouts are what made the still picture
  // worth arriving on.)
  openBench: () => set({ open: true, u: 0, playing: false }),
  closeBench: () => set({ open: false, playing: false }),
  play: () => set((s) => ({ playing: true, u: s.u >= 1 ? 0 : s.u })),
  pause: () => set({ playing: false }),
  scrubTo: (u) => set({ u: Math.max(0, Math.min(1, u)), playing: false }),
  reset: () => set({ u: 0, playing: false }),
  toggleLabels: () => set((s) => ({ labelsOn: !s.labelsOn })),
}))
