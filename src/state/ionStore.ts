import { create } from 'zustand'
import { SPIKE_IONS } from '../core/channels'
import {
  ION_KINDS,
  MAX_PARTICLES,
  restingCounts,
  type IonKind,
  type Side,
} from '../core/ions'

// How many ions of each kind are drawn on each side of the membrane (N09).
// These are the kid's to change — the whole point of the step is that the
// gradient is something you can flatten, steepen or reverse and see the
// consequence.

export type IonCounts = Record<IonKind, Record<Side, number>>

/** One copy of this, in `core/ions.ts`, where core code can reach it too. */
const realValues = (): IonCounts => restingCounts()

interface IonState {
  counts: IonCounts
  /** Species the kid has brought into focus. With NOTHING in focus every
   *  species is drawn in full colour — focusing is a spotlight you switch on,
   *  not a visibility switch you have to remember to switch back. Several can
   *  be in focus at once, which is how two species get compared. */
  focused: Record<IonKind, boolean>
  setCount: (kind: IonKind, side: Side, value: number) => void
  focus: (kind: IonKind) => void
  clearFocus: () => void
  reset: () => void
}

const noneFocused = (): Record<IonKind, boolean> =>
  ION_KINDS.reduce(
    (acc, kind) => {
      acc[kind] = false
      return acc
    },
    {} as Record<IonKind, boolean>,
  )

/** Whether a species should be drawn in full colour. One definition, used by
 *  both the canvas and the panel, so they cannot disagree about what is dim.
 *
 *  A species is never HIDDEN — the crowd has to stay honest about what the cell
 *  holds — and note the order of the two rules: the kid's own focus wins over the
 *  spike's. An event quietly rewriting a control someone set is indistinguishable
 *  from a bug, so the spike only decides the emphasis when nobody has said
 *  otherwise. Nothing is written to the store either way, so there is no setting
 *  to restore afterwards. */
export function inColour(
  focused: Record<IonKind, boolean>,
  kind: IonKind,
  spiking = false,
): boolean {
  if (ION_KINDS.some((k) => focused[k])) return focused[kind]
  // During a spike, the two ions that make it are the ones to watch.
  return !spiking || SPIKE_IONS.includes(kind)
}

export const useIonStore = create<IonState>((set) => ({
  counts: realValues(),
  focused: noneFocused(),
  setCount: (kind, side, value) =>
    set((s) => {
      const next = Math.min(MAX_PARTICLES, Math.max(0, Math.round(value)))
      // Returning the same state keeps the stage from relaying out the crowd
      // when a drag has not actually changed anything.
      if (next === s.counts[kind][side]) return s
      return { counts: { ...s.counts, [kind]: { ...s.counts[kind], [side]: next } } }
    }),
  focus: (kind) =>
    set((s) => ({ focused: { ...s.focused, [kind]: !s.focused[kind] } })),
  clearFocus: () => set({ focused: noneFocused() }),
  reset: () => set({ counts: realValues(), focused: noneFocused() }),
}))
