import { create } from 'zustand'
import type { ChannelId } from '../core/channels'

// Which membrane proteins are working (N11/N12). Both start on: that is the
// resting state, where the pump exactly balances what the leaks let go.
interface MembraneState {
  pumpOn: boolean
  leaksOn: boolean
  /** Bumped on each puff of neurotransmitter, which opens the ligand-gated
   *  channel for a while (N15). */
  transmitterPulse: number
  /** Which piece of membrane machinery the kid is reading about. The list is
   *  navigation; the explanation and that protein's own control live together
   *  in the info panel. */
  selected: ProteinId | null
  togglePump: () => void
  toggleLeaks: () => void
  releaseTransmitter: () => void
  select: (id: ProteinId | null) => void
}

/** Everything embedded in the membrane that can be read about: the pump, plus
 *  every channel. */
export type ProteinId = 'pump' | ChannelId

export const useMembraneStore = create<MembraneState>((set) => ({
  pumpOn: true,
  leaksOn: true,
  transmitterPulse: 0,
  selected: null,
  togglePump: () => set((s) => ({ pumpOn: !s.pumpOn })),
  toggleLeaks: () => set((s) => ({ leaksOn: !s.leaksOn })),
  releaseTransmitter: () => set((s) => ({ transmitterPulse: s.transmitterPulse + 1 })),
  select: (id) => set((s) => ({ selected: s.selected === id ? null : id })),
}))
