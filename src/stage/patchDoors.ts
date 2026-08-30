import { DEMOS } from '../state/demoStore'

// THE DOORS ON THE MEMBRANE PATCH — one row, in its own container, bottom
// left of the canvas (user, 2026-08-28).
//
// ── Why they are no longer pinned to structures ───────────────────────────
//
// They were, briefly: the bilayer door on a bare stretch of wall, the channel
// door on a channel, the charge door on the cytoplasm side. Derived from the
// protein layout so they could not drift. It was the right idea and it looked
// wrong — four markers scattered over a picture read as clutter on the
// picture rather than as a set of things you can do with it. Judged by the
// user, who is the one who can judge it.
//
// ── And why that dissolved the split ─────────────────────────────────────
//
// Two of the six used to live in the column instead, because they are not
// PLACES: equilibrium potential is about a balance and the spike train is
// about time, so a magnifier stuck on the wall for either would have been
// pointing at nothing. That reasoning was entirely about being pinned. A row
// in a corner points at nothing by design — it is a shelf of instruments, not
// a set of labels — so the distinction stopped doing any work the moment the
// pins went, and all six are together again.
//
// The order is the course's: the wall, what crosses it, its charge, a door in
// it, the balance across it, and what a run of them looks like in time.

export interface PatchDoor {
  /** The drawer this opens. */
  id:
    | 'lipid'
    | 'permea'
    | 'capacitor'
    | 'channel'
    | 'gating'
    | 'patch'
    | 'balance'
    | 'train'
  icon: string
  /** Named for the adult; the icon is for the kid. Kept SHORT, because six of
   *  them share one row — the full name is in the contents and in `title`. */
  label: string
  /** The full name, for the tooltip and for a screen reader. */
  full: string
}

const ORDER: { id: PatchDoor['id']; label: string }[] = [
  { id: 'lipid', label: 'Bilayer' },
  { id: 'permea', label: 'What crosses' },
  { id: 'capacitor', label: 'Charge' },
  { id: 'channel', label: 'Channel' },
  { id: 'gating', label: 'Channel types' },
  { id: 'patch', label: 'How we know' },
  { id: 'balance', label: 'Balance' },
  { id: 'train', label: 'Spikes' },
]

/** Every door on the patch, in the order the course meets them. Icons and
 *  full names come from the exhibit registry rather than being retyped, so a
 *  door and its drawer cannot come to disagree about what it is called. */
export function patchDoors(): PatchDoor[] {
  return ORDER.map(({ id, label }) => {
    const demo = DEMOS.find((d) => d.id === id)
    return {
      id,
      label,
      icon: demo?.icon ?? '🔍',
      full: demo?.name ?? label,
    }
  })
}
