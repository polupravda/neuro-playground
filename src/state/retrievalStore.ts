import { create } from 'zustand'
import { RETRIEVALS, type RetrievalId } from '../core/retrieval'

// S14's state: the drawer, which panels have been asked to (re)start, and which
// are playing.
//
// ⚠ NO `u` HERE (21c-5). Three panels each advancing a position would be three
// store writes a frame, and a position is a per-frame value: it lives in a ref
// in the bench, by this app's own rule. What the store owns is the SEMANTIC
// state — a run was asked for (a counter, so pressing start on a finished panel
// starts it over) and whether each panel is PLAYING (21c-11, user: "allow to
// pause animation. Turn pressed button into 'pause' mode") — which the buttons
// have to render from, so it cannot be a ref.

type PerRoute<T> = Record<RetrievalId, T>

const each = <T,>(v: T): PerRoute<T> =>
  RETRIEVALS.reduce((acc, r) => {
    acc[r.id] = v
    return acc
  }, {} as PerRoute<T>)

interface RetrievalState {
  open: boolean
  /** Bumped when a panel is asked to START OVER. */
  nonce: PerRoute<number>
  /** Whether each panel's clock is running. */
  playing: PerRoute<boolean>
  openBench: () => void
  closeBench: () => void
  /** Start this panel from the top. */
  start: (id: RetrievalId) => void
  /** Freeze this panel where it is. */
  pause: (id: RetrievalId) => void
  /** Let a paused panel carry on from where it froze. */
  resume: (id: RetrievalId) => void
  /** A run has reached its end — the bench reports it so the button can say
   *  "run again" rather than "pause" over a finished picture. */
  finished: (id: RetrievalId) => void
  /** ⚠ ALL THREE FROM ONE PRESS, on one clock: the comparison is the exhibit,
   *  and three runs started at three different moments cannot be compared. */
  startAll: () => void
  pauseAll: () => void
  resumeAll: () => void
}

export const useRetrievalStore = create<RetrievalState>((set) => ({
  open: false,
  nonce: each(0),
  playing: each(false),
  // ⚠ Opening does not start anything — the same ruling the SNARE drawer
  // follows: the drawer opens on its still, and running belongs to a button.
  openBench: () => set({ open: true, nonce: each(0), playing: each(false) }),
  closeBench: () => set({ open: false, playing: each(false) }),
  start: (id) =>
    set((s) => ({
      nonce: { ...s.nonce, [id]: s.nonce[id] + 1 },
      playing: { ...s.playing, [id]: true },
    })),
  pause: (id) => set((s) => ({ playing: { ...s.playing, [id]: false } })),
  resume: (id) => set((s) => ({ playing: { ...s.playing, [id]: true } })),
  finished: (id) => set((s) => ({ playing: { ...s.playing, [id]: false } })),
  startAll: () =>
    set((s) => {
      const nonce = { ...s.nonce }
      for (const r of RETRIEVALS) nonce[r.id] = s.nonce[r.id] + 1
      return { nonce, playing: each(true) }
    }),
  pauseAll: () => set({ playing: each(false) }),
  resumeAll: () => set({ playing: each(true) }),
}))
