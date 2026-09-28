import { create } from 'zustand'
import { MV_MAX, MV_MIN, MV_REST } from '../core/receptors'

// D07's state: the drawer, the membrane potential the child sets, and a beat.
//
// ⚠ THE MODEL ITSELF LIVES IN A REF in the bench (this app's rule: per-frame
// values are refs, only semantically meaningful things go through Zustand).
// The VOLTAGE is the exception that proves it — it is not a per-frame value at
// all but a setting the child makes and the whole exhibit is about, and the
// slider and the readout both have to re-render when it moves.

interface ReceptorUiState {
  open: boolean
  /** The membrane potential, mV. */
  mv: number
  beat: number
  openBench: () => void
  closeBench: () => void
  setMv: (mv: number) => void
  tick: () => void
}

export const useReceptorStore = create<ReceptorUiState>((set) => ({
  open: false,
  mv: MV_REST,
  beat: 0,
  openBench: () => set({ open: true, mv: MV_REST, beat: 0 }),
  closeBench: () => set({ open: false }),
  setMv: (mv) => set({ mv: Math.max(MV_MIN, Math.min(MV_MAX, mv)) }),
  tick: () => set((s) => ({ beat: s.beat + 1 })),
}))
