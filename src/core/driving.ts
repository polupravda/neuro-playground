import { IONS, type IonKind } from './ions'
import { nernstMv } from './voltage'
import type { IonCounts } from '../state/ionStore'

// Which way an ion actually moves, and how hard it is pushed (N09/N18).
//
// The app used to answer this from the concentration gradient alone: crowded
// outside means it comes in. That is half the truth and the missing half is the
// one worth teaching. An ion crossing a membrane is pushed by TWO things — its
// own crowding and the voltage — and they can cancel exactly. The voltage where
// they do is that ion's Nernst voltage, and at that voltage the ion does not move
// at all even through a wide-open channel.
//
// Getting this wrong was visible: at the top of a spike the membrane sits within
// a couple of millivolts of sodium's own voltage, so sodium has all but stopped —
// and the picture showed it still pouring in, which makes the peak look like the
// moment of most inflow when it is the moment inflow ends.

/** How far the membrane is from where this ion would be content, mV.
 *
 *  This IS the driving force: the whole push on the ion, crowding and voltage
 *  together, because the Nernst voltage already contains the crowding. */
export function drivingMv(ion: IonKind, counts: IonCounts, vm: number): number {
  return vm - nernstMv(ion, counts)
}

export type Flow = 'in' | 'out' | 'none'

/** How near the reversal point counts as "not moving", mV. Small, because the
 *  point of the reversal potential is that it is a knife edge. */
export const FLOW_DEADBAND = 1.5

/** Which way this ion moves through an open channel right now.
 *
 *  Note the charge. A current is a flow of POSITIVE charge, so for a positive ion
 *  the two point the same way and for chloride they point opposite ways: at a
 *  voltage above its own, chloride moves IN while the current it carries flows
 *  out. */
export function flowOf(ion: IonKind, counts: IonCounts, vm: number): Flow {
  const drive = drivingMv(ion, counts, vm)
  if (Math.abs(drive) < FLOW_DEADBAND) return 'none'
  return drive * IONS[ion].charge < 0 ? 'in' : 'out'
}

/** How hard, 0→1, on a scale where a full swing of the membrane is 1. Used to
 *  set how fast ions cross, so a channel visibly slows as the voltage approaches
 *  the point where that ion stops caring. */
export function flowStrength(ion: IonKind, counts: IonCounts, vm: number): number {
  return Math.min(1, Math.abs(drivingMv(ion, counts, vm)) / 120)
}

/** Plain words for the driving force on one ion. */
export function flowNote(ion: IonKind, counts: IonCounts, vm: number): string {
  const drive = drivingMv(ion, counts, vm)
  const e = nernstMv(ion, counts)
  const flow = flowOf(ion, counts, vm)
  const name = IONS[ion].name
  if (flow === 'none') {
    return `Nothing. The membrane is sitting at ${mv(
      e,
    )}, which is exactly the voltage ${name} is content at — so even a wide-open door moves none of it.`
  }
  const hard =
    Math.abs(drive) > 80 ? 'very hard' : Math.abs(drive) > 30 ? 'hard' : 'gently'
  return `${flow === 'in' ? 'Inward' : 'Outward'}, ${hard}. ${
    name[0].toUpperCase() + name.slice(1)
  } is content at ${mv(e)} and the membrane is at ${mv(
    e + drive,
  )}, so it is pushed ${flow === 'in' ? 'in' : 'out'}.`
}

const mv = (v: number): string => {
  const r = Math.round(v)
  return r < 0 ? `−${Math.abs(r)} mV` : `+${r} mV`
}
