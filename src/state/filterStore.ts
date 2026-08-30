import { create } from 'zustand'
import type { LaneKind } from '../stage/filterScene'

// D15's semantic state. A run's progress is a pure function of the clock, so
// nothing per-frame lives here — only whether the drawer is open, when each
// lane started, and whether a lane has ever been watched (which is what
// decides if the account of it is on screen).
//
// The two lanes run INDEPENDENTLY now (user, 2026-08-28: three buttons —
// potassium, sodium, both). Watching one at a time is a fair way to use this
// view, and "both at once" is then just the two buttons pressed together.

type Started = Record<LaneKind, number | null>

interface FilterState {
  open: boolean
  startedMs: Started
  /** Which lanes have been run at least once. */
  ran: Record<LaneKind, boolean>
  openBench: () => void
  closeBench: () => void
  start: (nowMs: number, lanes: readonly LaneKind[]) => void
  finish: (lane: LaneKind) => void
}

const NONE: Started = { k: null, na: null }

export const useFilterStore = create<FilterState>((set) => ({
  open: false,
  startedMs: { ...NONE },
  ran: { k: false, na: false },
  openBench: () => set({ open: true }),
  closeBench: () => set({ open: false, startedMs: { ...NONE } }),
  start: (nowMs, lanes) =>
    set((s) => {
      const startedMs = { ...s.startedMs }
      const ran = { ...s.ran }
      for (const lane of lanes) {
        startedMs[lane] = nowMs
        ran[lane] = true
      }
      return { startedMs, ran }
    }),
  finish: (lane) =>
    set((s) =>
      s.startedMs[lane] === null ? s : { startedMs: { ...s.startedMs, [lane]: null } },
    ),
}))
