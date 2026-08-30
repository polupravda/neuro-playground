import { create } from 'zustand'
import type { TravellerId } from '../core/permeability'

// The permeability bench's SEMANTIC state. The motes themselves — positions,
// velocities, crossings — live in the view's refs (the balance chambers'
// precedent); here is only what the words and the controls need to know.

interface PermeaState {
  open: boolean
  /** Whether the aquaporin is plugged into the wall. */
  aquaporin: boolean
  /** The last substance fired — the describer narrates its verdict. */
  lastShot: TravellerId | null
  /** Bumped by ↺ Reset; the view empties its motes when it changes. */
  resetSeq: number
  openBench: () => void
  closeBench: () => void
  toggleAquaporin: () => void
  shot: (sp: TravellerId) => void
  reset: () => void
}

export const usePermeaStore = create<PermeaState>((set) => ({
  open: false,
  aquaporin: false,
  lastShot: null,
  resetSeq: 0,
  openBench: () => set({ open: true }),
  closeBench: () => set({ open: false }),
  toggleAquaporin: () => set((s) => ({ aquaporin: !s.aquaporin })),
  shot: (sp) => set({ lastShot: sp }),
  reset: () => set((s) => ({ resetSeq: s.resetSeq + 1, lastShot: null })),
}))
