import { create } from 'zustand'
import {
  identitySlots,
  identityVesSlots,
  reinsertSlots,
  vesReinsertSlots,
  type LabPhase,
} from '../stage/lipidLabScene'

// The lipid lab's SEMANTIC state: whether the drawer is open, which phase the
// bench is in, and the clock moment the current transport began. Per-frame
// values (poses, the pointer, easings) never come through here — they are pure
// functions of this state and the clock, in stage/lipidLabScene.ts.
//
// The clock rule: `phaseStart` is stamped from the same rAF timebase the view
// draws with, passed in by the component — the run owns its start, and a
// re-render cannot restart it.

interface LipidState {
  open: boolean
  phase: LabPhase
  /** rAF-clock ms when the current transit began. */
  phaseStart: number
  /** Reseeded on every scatter, so each throw lands differently — but
   *  deterministically: the seed is the only randomness the lab has. */
  seed: number
  /** True while a molecule is held by the pointer — semantic because the
   *  describer narrates it. */
  holding: boolean
  /** Where each lipid sits in the wall — rearranged by drags, because a
   *  released molecule rejoins at the NEAREST place, not its old one. */
  slots: number[]
  /** The vesicle's arrangement — same rule, on a ring. */
  vesSlots: number[]
  openLab: () => void
  closeLab: () => void
  /** Tear the wall apart (only from the standing wall). */
  scatter: (now: number) => void
  /** Let the scattered crowd settle (only from the scatter). */
  settle: (now: number) => void
  /** A transit reached its end — called by the view's loop. */
  finishTransit: () => void
  setHolding: (holding: boolean) => void
  /** A drag ended at (x, ·): the lipid takes the wall slot nearest x. */
  reinsert: (i: number, x: number) => void
  /** A vesicle drag ended at (x, y): nearest place on the ring. */
  vesReinsert: (k: number, x: number, y: number) => void
}

export const useLipidStore = create<LipidState>((set) => ({
  open: false,
  // The lab opens on the standing wall: the question the drawer answers is
  // "what is this wall made of", so the wall is the first thing shown.
  phase: 'wall',
  phaseStart: 0,
  seed: 1,
  holding: false,
  slots: identitySlots(),
  vesSlots: identityVesSlots(),
  openLab: () => set({ open: true }),
  closeLab: () => set({ open: false, holding: false }),
  // The current slots stay through the scattering transit (its FROM poses are
  // the standing wall — resetting now would teleport lipids mid-frame)...
  scatter: (now) =>
    set((s) =>
      s.phase === 'wall'
        ? { phase: 'scattering', phaseStart: now, seed: s.seed + 1, holding: false }
        : {},
    ),
  settle: (now) =>
    set((s) => (s.phase === 'scattered' ? { phase: 'settling', phaseStart: now } : {})),
  // ...and reset to identity once the crowd is loose, when no drawing reads
  // them, so the next wall is a fresh arrangement.
  finishTransit: () =>
    set((s) =>
      s.phase === 'settling'
        ? { phase: 'wall' }
        : s.phase === 'scattering'
          ? { phase: 'scattered', slots: identitySlots(), vesSlots: identityVesSlots() }
          : {},
    ),
  setHolding: (holding) => set({ holding }),
  reinsert: (i, x) => set((s) => ({ slots: reinsertSlots(s.slots, i, x) })),
  vesReinsert: (k, x, y) => set((s) => ({ vesSlots: vesReinsertSlots(s.vesSlots, k, x, y) })),
}))
