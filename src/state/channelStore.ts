import { create } from 'zustand'
import type { TryKind } from '../stage/channelScene'

// D03's semantic state: the drawer, and which ion is being tried at the
// filter right now. The attempt's own progress is a pure function of the
// clock (`tryPoseAt`), so nothing per-frame lives here.

interface ChannelState {
  open: boolean
  /** The attempt in progress: which ion, and when it started. */
  tried: { kind: TryKind; startedMs: number } | null
  /** What the last attempt showed — STICKY.
   *
   *  The account of what just happened used to live and die with the
   *  animation: the ion finished its journey and the words describing it
   *  vanished at the same instant, which is exactly when a child starts
   *  reading (user, 2026-08-28). This is the sibling app's "What just
   *  happened" rule — a story stays until the next event overwrites it, or a
   *  deliberate reset clears it. */
  said: TryKind | null
  openBench: () => void
  closeBench: () => void
  tryIon: (kind: TryKind, nowMs: number) => void
  /** The run is over; the picture stops, the words stay. */
  finishTry: () => void
  clearTry: () => void
}

export const useChannelStore = create<ChannelState>((set) => ({
  open: false,
  tried: null,
  said: null,
  openBench: () => set({ open: true }),
  closeBench: () => set({ open: false, tried: null }),
  tryIon: (kind, startedMs) => set({ tried: { kind, startedMs }, said: kind }),
  finishTry: () => set({ tried: null }),
  clearTry: () => set({ tried: null, said: null }),
}))
