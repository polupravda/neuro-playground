import { create } from 'zustand'
import { MAX_DOORS, REAL_WALL, type DoorKind, type Doors } from '../core/resting'

// D16's semantic state, and nothing else: the drawer, and what the child has
// built into the wall. The voltage is NOT here — it is a pure function of the
// doors (`restingMvOf`), and the eased value the needle is drawn at is a
// per-frame number living in a ref in the bench.

interface RestingState {
  open: boolean
  doors: Doors
  openBench: () => void
  closeBench: () => void
  add: (kind: DoorKind) => void
  remove: (kind: DoorKind) => void
  reset: () => void
}

const clamp = (d: Doors): Doors => {
  // The wall has room for a picture, not for a crowd — and a door that cannot
  // fit must not be silently counted in the equation either, or the bar would
  // weigh doors the child cannot see.
  const out: Doors = { k: Math.max(0, d.k), cl: Math.max(0, d.cl), na: Math.max(0, d.na) }
  let room = MAX_DOORS
  for (const kind of ['k', 'cl', 'na'] as const) {
    out[kind] = Math.min(out[kind], Math.max(0, room))
    room -= out[kind]
  }
  return out
}

export const useRestingStore = create<RestingState>((set) => ({
  open: false,
  doors: { ...REAL_WALL },
  openBench: () => set({ open: true }),
  closeBench: () => set({ open: false }),
  add: (kind) => set((s) => ({ doors: clamp({ ...s.doors, [kind]: s.doors[kind] + 1 }) })),
  remove: (kind) => set((s) => ({ doors: clamp({ ...s.doors, [kind]: s.doors[kind] - 1 }) })),
  // Every transport in this app that can reach an end has a control that says
  // start over; a wall you have taken apart needs one just as much.
  reset: () => set({ doors: { ...REAL_WALL } }),
}))
