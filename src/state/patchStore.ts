import { create } from 'zustand'
import { REST_MV } from '../core/capacitor'

// D13's semantic state: the drawer and the voltage the patch is held at. The flickering itself is a pure function of
// (channel, voltage, time) and lives in `core/patchClamp.ts`, so nothing
// per-frame is here.

interface PatchState {
  open: boolean
  vm: number
  openBench: () => void
  closeBench: () => void
  setVm: (vm: number) => void
}

export const usePatchStore = create<PatchState>((set) => ({
  open: false,
  vm: REST_MV,
  openBench: () => set({ open: true }),
  closeBench: () => set({ open: false }),
  setVm: (vm) => set({ vm }),
}))
