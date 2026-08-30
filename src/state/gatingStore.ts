import { create } from 'zustand'
import { FAMILIES, POKE_MS, isGated, type FamilyId } from '../core/gating'

// D04's state: when each door was last poked, and nothing else.
//
// A poke is a MOMENT, not a setting. The cause arrives, does its work and
// leaves, and the picture is a pure function of how long ago that was — so
// there is no per-frame state here, and pausing a tab cannot leave a door
// stuck open.
//
// One clock per family on purpose. Each door listens for its own cause, so
// poking one must visibly leave the others alone; a single shared clock would
// have thrown that lesson away while looking tidier.

const NONE: Record<FamilyId, number | null> = FAMILIES.reduce(
  (acc, f) => {
    acc[f.id] = null
    return acc
  },
  {} as Record<FamilyId, number | null>,
)

interface GatingState {
  open: boolean
  /** When each family's cause was applied, in the animation clock's own ms. */
  since: Record<FamilyId, number | null>
  openBench: () => void
  closeBench: () => void
  poke: (id: FamilyId) => void
}

export const useGatingStore = create<GatingState>((set) => ({
  open: false,
  since: { ...NONE },
  openBench: () => set({ open: true }),
  closeBench: () => set({ open: false, since: { ...NONE } }),
  poke: (id) =>
    set((s) => ({ since: { ...s.since, [id]: performance.now() } })),
}))

/** Which doors have a cause acting on them right now, for the describer. */
export function busyNow(since: Record<FamilyId, number | null>): Record<FamilyId, boolean> {
  return FAMILIES.reduce(
    (acc, f) => {
      const began = since[f.id]
      acc[f.id] = isGated(f.id) && began !== null && performance.now() - began < POKE_MS
      return acc
    },
    {} as Record<FamilyId, boolean>,
  )
}
