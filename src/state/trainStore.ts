import { create } from 'zustand'

// Whether the spike-train bench is open, and the two numbers worth telling React
// about.
//
// Nothing else from the bench lives here. The membrane state, the trace and the
// press marks all change many times a second and stay in a ref inside the
// component, exactly as the architecture notes require — a store write per frame
// would re-render the whole left column sixty times a second to move a line by a
// pixel. The tallies change a few times a minute and are what the words read.

interface TrainState {
  open: boolean
  /** Presses and spikes since the bench was opened. */
  presses: number
  spikes: number
  openTrain: () => void
  closeTrain: () => void
  tally: (presses: number, spikes: number) => void
}

export const useTrainStore = create<TrainState>((set) => ({
  open: false,
  presses: 0,
  spikes: 0,
  openTrain: () => set({ open: true, presses: 0, spikes: 0 }),
  closeTrain: () => set({ open: false }),
  tally: (presses, spikes) =>
    // Guarded: called every frame, and an unconditional set would defeat the
    // point of keeping the trace out of the store in the first place.
    set((s) => (s.presses === presses && s.spikes === spikes ? s : { presses, spikes })),
}))
