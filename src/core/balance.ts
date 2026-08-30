import { IONS, type IonKind } from './ions'
import { RT_OVER_F_MV, nernstMv } from './voltage'
import { FLOW_DEADBAND, drivingMv, flowOf, flowStrength, type Flow } from './driving'
import type { IonCounts } from '../state/ionStore'

// The Nernst voltage, as a thing you can hunt for (demo ②).
//
// This is the one idea the membrane topic exists to teach and the app has so far
// only ASSERTED: an ion is pushed by two things at once — its crowding, which
// sends it down its gradient, and the charge on the membrane, which pulls or
// repels it — and its Nernst voltage is nothing more than the voltage at which
// those two cancel.
//
// Nothing new is computed here. The engine is `core/driving.ts`, and this module
// is the part that splits one driving force back into the TWO pushes it is made
// of, so they can be drawn arguing with each other. Which is the whole exhibit.

/** The two pushes on one ion, as signed numbers in millivolts.
 *
 *  Sign convention, one place: POSITIVE means the push sends the ion INWARD.
 *  That makes the two arrows directly comparable on screen, which is the only
 *  thing the drawing needs of them. */
export interface Pushes {
  /** From the crowding alone — where the ion would go with no charge at all.
   *  This is the Nernst voltage carried over: it is exactly the electrical pull
   *  that would be needed to hold this gradient still. */
  crowd: number
  /** From the charge on the membrane alone. */
  charge: number
  /** What is left when they are put together: the driving force. Zero at
   *  balance, which is the point of the exercise. */
  net: number
}

export function pushesOn(ion: IonKind, counts: IonCounts, vm: number): Pushes {
  const e = nernstMv(ion, counts)
  const { charge } = IONS[ion]
  // net = (E − V)·charge, split in two. Positive is INWARD, which has to agree
  // with `flowOf` — and did not, on the first attempt: both terms were inverted,
  // so the arrows showed a negative interior REPELLING sodium. The sum still
  // matched the arithmetic of the driving force, which is why the first test
  // passed and the picture was still wrong. A test has to check the DIRECTION
  // against what actually moves, not that two formulas agree.
  const crowd = e * charge
  const chargePush = -vm * charge
  return { crowd, charge: chargePush, net: crowd + chargePush }
}

/** The voltage at which this ion's two pushes cancel — its Nernst voltage. Named
 *  separately because this is the number the kid is hunting for. */
export function balanceMv(ion: IonKind, counts: IonCounts): number {
  return nernstMv(ion, counts)
}

/** How the hunt is going. */
export interface Chamber {
  ion: IonKind
  open: boolean
  /** Where this ion would be content, mV. */
  balance: number
  /** How far off, mV — signed, so the panel can say which way to move. */
  offBy: number
  pushes: Pushes
  /** Which way ions are crossing. 'none' means BALANCED, which does not mean
   *  still: see `twoWay`. */
  flow: Flow
  /** How fast, 0→1. */
  strength: number
  /** True when the door is open and the pushes cancel — the thing being hunted.
   *  Only ever true with the channel OPEN: balance behind a shut door is an
   *  untested claim and earns nothing. */
  solved: boolean
  /** At balance the traffic does not stop, it evens out — equal streams both
   *  ways. Drawn instead of stillness, because stillness teaches that
   *  equilibrium means nothing is happening. */
  twoWay: boolean
}

export function chamberAt(
  ion: IonKind,
  counts: IonCounts,
  vm: number,
  open: boolean,
): Chamber {
  const balance = balanceMv(ion, counts)
  const flow = open ? flowOf(ion, counts, vm) : 'none'
  const balanced = Math.abs(drivingMv(ion, counts, vm)) < FLOW_DEADBAND
  return {
    ion,
    open,
    balance,
    offBy: vm - balance,
    pushes: pushesOn(ion, counts, vm),
    flow,
    strength: open ? flowStrength(ion, counts, vm) : 0,
    solved: open && balanced,
    twoWay: open && balanced,
  }
}

// ------------------------------------------------------- letting them settle
//
// With a door open, the ions do not wait to be told: they redistribute until
// that ion's own voltage matches the battery. Which is the same Nernst relation
// the rest of the exhibit uses, solved for the other unknown — the kid sets a
// voltage and the crowd arranges itself to satisfy it, instead of hunting for a
// number.
//
// This is honest here for a reason that would NOT hold on a neuron: the bench is
// two chambers with a membrane between them, so both sides are finite and both
// change. A cell has a whole body of fluid outside it, and a pump working to keep
// the piles where they are, which is why concentrations are held still
// everywhere else in this app.

/** Where a species ends up, given how much of it there is altogether and what
 *  the battery is holding the membrane at.
 *
 *  Solved exactly rather than approached, so the settling can be driven toward it
 *  without ever overshooting and wobbling: out/in = exp(zV/RT·F) at equilibrium,
 *  and out + in never changes because ions are not created or destroyed. */
export function equilibriumSplit(
  ion: IonKind,
  total: number,
  vm: number,
): { outside: number; inside: number } {
  const { charge } = IONS[ion]
  const ratio = Math.exp((charge * vm) / RT_OVER_F_MV)
  const inside = total / (1 + ratio)
  return { outside: total - inside, inside }
}

/** How fast a species redistributes, mM per second, at full driving force. Slow
 *  enough to watch a ball cross, fast enough that a far-off battery settles in a
 *  few seconds. */
export const SETTLE_MM_PER_S = 95

/** One step of settling. Conserves the total exactly, moves toward equilibrium at
 *  a rate set by how far off it is, and never passes it. */
export function settle(
  ion: IonKind,
  counts: IonCounts,
  vm: number,
  dtMs: number,
): { outside: number; inside: number } {
  const here = counts[ion]
  const total = here.outside + here.inside
  const target = equilibriumSplit(ion, total, vm)
  const gap = target.inside - here.inside
  if (Math.abs(gap) < 1e-4) return target
  // A floor on the rate, as the channel traffic already uses: flux really is
  // proportional to the driving force, so an exact approach is asymptotic and
  // would never arrive — and "arrives and stops" is what the exhibit is for.
  const push = Math.max(0.12, flowStrength(ion, counts, vm))
  const step = SETTLE_MM_PER_S * (dtMs / 1000) * push
  // Never past the answer: overshooting would make equilibrium a thing the
  // picture wobbles around instead of arrives at.
  const moved = Math.min(step, Math.abs(gap)) * Math.sign(gap)
  return { outside: here.outside - moved, inside: here.inside + moved }
}

/** Whether every open door has finished settling — nothing left to flow.
 *
 *  This replaced a question about whether one voltage could please every ion at
 *  once. It could not, while the concentrations were frozen, and that impossibility
 *  used to be the ending. Once the ions are allowed to move, every one of them CAN
 *  reach its own balance, and the ending improves: a membrane left alone drains to
 *  equilibrium, and a cell at equilibrium is a dead cell. What a real neuron does
 *  is stay away from here, and pay to do it. */
export function allSettled(ions: IonKind[], counts: IonCounts, vm: number): boolean {
  return ions.every((ion) => Math.abs(drivingMv(ion, counts, vm)) < FLOW_DEADBAND)
}

/** Calcium cannot be drawn honestly at one ball per mM: the real inside
 *  concentration is about a ten-thousandth of a ball. Stated rather than hidden,
 *  and the scarcity is itself the lesson — it is why calcium entry is such a
 *  sharp trigger at a synapse. */
export const CALCIUM_REAL_BALANCE_MV = 130

export function calciumNote(counts: IonCounts): string {
  return `Calcium is the one number here that is not real. Inside a cell there is so little of it — about a ten-thousandth of one ball — that these bars cannot draw it, so this chamber balances at about ${Math.round(
    balanceMv('ca', counts),
  )} mV instead of the true ${CALCIUM_REAL_BALANCE_MV} mV or so. That emptiness is worth remembering: it is exactly why letting a little calcium in is such a sharp signal.`
}
