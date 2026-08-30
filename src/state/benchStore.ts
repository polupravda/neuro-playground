import { create } from 'zustand'
import {
  ION_KINDS,
  IONS,
  MAX_PARTICLES,
  particlesFor,
  type IonKind,
} from '../core/ions'
import type { IonCounts } from './ionStore'
import { settle } from '../core/balance'

// The balance bench (demo ②). Its own state, deliberately.
//
// Every other demo shares the cell: flatten sodium in one and the spike in
// another fails, which is the point. The bench is different in kind — it is four
// separate patches wired to a battery, a thought experiment about membranes
// rather than a view of this neuron — and it says so, in a drawer, with the scene
// still visible underneath. So its concentrations are its own. Fiddling on a lab
// bench must not reach into the cell it is teaching you about.

function realValues(): IonCounts {
  return ION_KINDS.reduce((acc, kind) => {
    acc[kind] = {
      outside: particlesFor(IONS[kind].outsideMM),
      inside: particlesFor(IONS[kind].insideMM),
    }
    return acc
  }, {} as IonCounts)
}

const allShut = (): Record<IonKind, boolean> =>
  ION_KINDS.reduce(
    (acc, kind) => {
      acc[kind] = false
      return acc
    },
    {} as Record<IonKind, boolean>,
  )

interface BenchState {
  open: boolean
  counts: IonCounts
  /** What the battery is holding every chamber at, mV. */
  vm: number
  /** Which chambers have their channel open. */
  channels: Record<IonKind, boolean>
  /** Chambers the kid has balanced with the door open, so a win stays won. */
  solved: Record<IonKind, boolean>
  openBench: () => void
  closeBench: () => void
  setVm: (mv: number) => void
  toggleChannel: (kind: IonKind) => void
  setCount: (kind: IonKind, side: 'outside' | 'inside', value: number) => void
  /** Let every open door settle for one frame. Conserves each species exactly:
   *  ions move from one side to the other, they are not made or unmade. */
  settleOpen: (dtMs: number) => void
  reset: () => void
  markSolved: (kind: IonKind) => void
}

/** Where the bench starts: real concentrations, the battery at the resting
 *  potential, and every channel shut. Potassium first is the natural reveal — at
 *  rest it is very nearly balanced already, which is the resting potential's
 *  whole explanation. */
export const BENCH_START_MV = -72

export const useBenchStore = create<BenchState>((set) => ({
  open: false,
  counts: realValues(),
  vm: BENCH_START_MV,
  channels: allShut(),
  solved: allShut(),
  openBench: () => set({ open: true }),
  closeBench: () => set({ open: false }),
  setVm: (vm) => set({ vm: Math.round(vm) }),
  toggleChannel: (kind) =>
    set((s) => ({ channels: { ...s.channels, [kind]: !s.channels[kind] } })),
  setCount: (kind, side, value) =>
    set((s) => {
      const next = Math.min(MAX_PARTICLES, Math.max(0, Math.round(value)))
      if (next === s.counts[kind][side]) return s
      return { counts: { ...s.counts, [kind]: { ...s.counts[kind], [side]: next } } }
    }),
  settleOpen: (dtMs) =>
    set((s) => {
      const next = { ...s.counts }
      let moved = false
      for (const kind of ION_KINDS) {
        if (!s.channels[kind]) continue
        const after = settle(kind, s.counts, s.vm, dtMs)
        if (Math.abs(after.inside - s.counts[kind].inside) < 1e-6) continue
        next[kind] = after
        moved = true
      }
      return moved ? { counts: next } : s
    }),
  reset: () =>
    set({ counts: realValues(), vm: BENCH_START_MV, channels: allShut(), solved: allShut() }),
  markSolved: (kind) => set((s) => ({ solved: { ...s.solved, [kind]: true } })),
}))
