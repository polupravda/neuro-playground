import { create } from 'zustand'

// D18's state: the drawer, and the tick that makes the two terminals re-render.
//
// ⚠ THE MODEL ITSELF LIVES IN A REF in the bench, not here (this app's rule:
// per-frame values are refs, only semantically meaningful things go through
// Zustand). What the store owns is the drawer being open, and a `beat` the
// bench bumps a few times a second so the info column can say what is
// happening without the pools' every millisecond passing through React.

interface PoolsUiState {
  open: boolean
  /** Bumped by the bench so anything reading the pools re-renders. */
  beat: number
  openBench: () => void
  closeBench: () => void
  tick: () => void
}

export const usePoolsStore = create<PoolsUiState>((set) => ({
  open: false,
  beat: 0,
  openBench: () => set({ open: true, beat: 0 }),
  closeBench: () => set({ open: false }),
  tick: () => set((s) => ({ beat: s.beat + 1 })),
}))
