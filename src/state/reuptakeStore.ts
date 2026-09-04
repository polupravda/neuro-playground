import { create } from 'zustand'

// D17's state: the drawer, and where the cycle has got to.
//
// A drawer and not a place, by the app's own criterion: a place is a part of
// the neuron, and this is not a part of the neuron — it is one journey taken
// out and slowed down. It is opened from the view it deepens (the synapse),
// beside D06, never from a global menu, which is what keeps the child's map
// spatial. Same shape as `snareStore` deliberately: two sibling drawers on one
// shelf should not have two different ideas of what "playing" means.

interface ReuptakeState {
  open: boolean
  /** Position through the cycle, 0→1. */
  u: number
  playing: boolean
  openBench: () => void
  closeBench: () => void
  play: () => void
  pause: () => void
  scrubTo: (u: number) => void
  reset: () => void
}

export const useReuptakeStore = create<ReuptakeState>((set) => ({
  open: false,
  u: 0,
  playing: false,
  // Opening does not start it: the drawer opens on the labelled still — the
  // gap full of transmitter, which is the picture D06's release ends on — and
  // the run belongs to the ▶ button.
  openBench: () => set({ open: true, u: 0, playing: false }),
  closeBench: () => set({ open: false, playing: false }),
  play: () => set((s) => ({ playing: true, u: s.u >= 1 ? 0 : s.u })),
  pause: () => set({ playing: false }),
  scrubTo: (u) => set({ u: Math.max(0, Math.min(1, u)), playing: false }),
  reset: () => set({ u: 0, playing: false }),
}))
