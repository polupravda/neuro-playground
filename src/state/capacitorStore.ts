import { create } from 'zustand'
import { REST_MV } from '../core/capacitor'

// D12's semantic state: the drawer, and where the DIAL is set. The membrane's
// actual voltage lags behind the dial and lives in the view's refs — it is a
// per-frame value, and the lag is the lesson.

interface CapacitorState {
  open: boolean
  /** What the child has asked for, mV. */
  dialMv: number
  openBench: () => void
  closeBench: () => void
  setDial: (mv: number) => void
  reset: () => void
}

export const useCapacitorStore = create<CapacitorState>((set) => ({
  open: false,
  dialMv: REST_MV,
  openBench: () => set({ open: true }),
  closeBench: () => set({ open: false }),
  setDial: (dialMv) => set({ dialMv }),
  reset: () => set({ dialMv: REST_MV }),
}))
