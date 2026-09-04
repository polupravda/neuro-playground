import { create } from 'zustand'

// ⚠ ONE LABELS SWITCH FOR THE WHOLE APP (user, 2026-09-04: "unify labels
// across the app", answering for the 🏷 switch "everywhere").
//
// It was per-view — `snareStore.labelsOn` for the vesicle drawer and
// `synapseStore.labelsOn` for the synapse view — and putting a third, fourth
// and tenth copy beside them would have been ten places for one preference to
// drift. Whether a child wants names on the picture is a preference about the
// APP, not about whichever exhibit they happen to be standing in: turn them
// off at the synapse and they stay off in the channel drawer, which is what a
// preference means.
//
// This is not per-frame state — it changes when a thumb moves — so it belongs
// in a store rather than a ref (see 03 → Clocks and state).
interface LabelsState {
  /** Whether NAMES are drawn on the canvases. Readings on a scale are never
   *  hidden by it: a graph without its axis is not a simpler graph. */
  labelsOn: boolean
  toggleLabels: () => void
}

export const useLabelsStore = create<LabelsState>((set) => ({
  labelsOn: true,
  toggleLabels: () => set((s) => ({ labelsOn: !s.labelsOn })),
}))
