import { create } from 'zustand'
import type { NeuronPartId } from '../core/neuron'
import type { ChainPhase } from '../stage/chain'

// Only semantically meaningful values live here. Per-frame animation progress
// stays in refs inside the stage; React is informed via change-signatures
// (a run id, a phase name) rather than per-frame updates.

export interface Run {
  /** Which input neurons fired together. */
  inputs: number[]
  /** Bumped on every new run so the stage restarts its clock. */
  id: number
}

interface NeuronState {
  /** Anatomy selection (N02) — independent of what the signal is doing. */
  selected: NeuronPartId | null
  run: Run | null
  /** Where the current run has got to, for the live narration. */
  phase: ChainPhase
  /** Id of the zoom target the camera is on, or null for the whole scene. */
  zoom: string | null
  selectPart: (part: NeuronPartId) => void
  clearSelection: () => void
  fire: (inputs: number[]) => void
  setPhase: (phase: ChainPhase) => void
  zoomTo: (id: string) => void
  zoomOut: () => void
}

export const useNeuronStore = create<NeuronState>((set, get) => ({
  selected: null,
  run: null,
  phase: 'idle',
  zoom: null,
  selectPart: (part) =>
    set((s) => ({ selected: s.selected === part ? null : part })),
  clearSelection: () => set({ selected: null }),
  fire: (inputs) => {
    if (inputs.length === 0) return
    const id = (get().run?.id ?? 0) + 1
    // Selecting a part dims the rest of the scene, which would hide the run.
    set({ run: { inputs, id }, phase: 'input-fires', selected: null })
  },
  setPhase: (phase) => set({ phase }),
  zoomTo: (id) => set({ zoom: id }),
  zoomOut: () => set({ zoom: null }),
}))
