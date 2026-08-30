import type { TeachingPara } from './neuron'
import { IONS, ION_KINDS, type IonKind } from './ions'
import type { ChannelType } from './channels'
import type { IonCounts } from '../state/ionStore'

// The voltage across the membrane (N10), worked out from what is actually in
// the membrane rather than asserted.
//
// Two real equations, both at a level a child can follow the shape of:
//   • Nernst — the voltage at which one ion would be content, given its gradient.
//   • the chord-conductance equation — the membrane settles at the average of
//     those, weighted by how easily each ion can actually cross.
// Which is why permeability, not the pump, is what sets the resting voltage.

/** RT/F at body temperature, in millivolts. */
export const RT_OVER_F_MV = 26.7

/** Voltage at which this ion's gradient would be balanced, in mV — the voltage
 *  the membrane would sit at if this ion were the only one able to cross. */
/** Smallest count the equation will look at, in mM. A side emptied to zero gives
 *  an infinite voltage, so there has to be a floor — but it was half a BALL, and
 *  that turned out to be far too coarse in two ways. It put calcium's balance
 *  point at +19 mV when the real figure is around +130, purely because the floor
 *  was doing the arithmetic; and on the balance bench it stopped calcium ever
 *  reaching equilibrium at all, because equilibrium sat below the floor. A
 *  twentieth of a ball is still a guard against infinity and is nowhere near any
 *  answer the app actually shows. */
export const COUNT_FLOOR = 0.05

export function nernstMv(ion: IonKind, counts: IonCounts): number {
  const { charge } = IONS[ion]
  const outside = Math.max(COUNT_FLOOR, counts[ion].outside)
  const inside = Math.max(COUNT_FLOOR, counts[ion].inside)
  return (RT_OVER_F_MV / charge) * Math.log(outside / inside)
}

/** Permeability the resting membrane has to ions whose channels are not drawn
 *  here. Real membranes leak a little of everything, and without this the cell
 *  would sit exactly at the potassium voltage instead of a few millivolts above
 *  it. Relative to one open potassium leak channel. */
export const BACKGROUND: Partial<Record<IonKind, number>> = { na: 0.1, cl: 0.45 }

/** How easily each ion can cross right now: the background, plus every channel
 *  currently open. */
export function conductances(open: ChannelType[]): Record<IonKind, number> {
  const g = { na: 0, k: 0, cl: 0, ca: 0 }
  for (const ion of ION_KINDS) g[ion] = BACKGROUND[ion] ?? 0
  for (const channel of open) {
    for (const ion of channel.passes) g[ion] += channel.conductance
  }
  return g
}

/** Where the membrane voltage settles, in mV: the weighted average of every
 *  ion's own voltage, weighted by how easily it can cross.
 *
 *  Note what is NOT an argument here — the pump. It builds the gradients this
 *  works from, but it does not appear in the equation, which is exactly the
 *  point of checkpoint A. */
export function membraneVoltageMv(counts: IonCounts, open: ChannelType[]): number {
  return membraneVoltageFrom(counts, conductances(open))
}

/** The same equation, given the conductances directly. The action potential
 *  works this way round: it describes how wide the doors are at each moment and
 *  reads the voltage off them, rather than drawing a spike and claiming it. */
export function membraneVoltageFrom(
  counts: IonCounts,
  g: Record<IonKind, number>,
): number {
  let weighted = 0
  let total = 0
  for (const ion of ION_KINDS) {
    if (g[ion] <= 0) continue
    weighted += g[ion] * nernstMv(ion, counts)
    total += g[ion]
  }
  return total === 0 ? 0 : weighted / total
}

/** Top and bottom of the meter's scale, mV. A little headroom above sodium's
 *  own voltage, so its mark reads as a mark rather than as the edge. */
export const VM_MAX = 75
export const VM_MIN = -95

/** How quickly the membrane voltage catches up with a change, ms. A real
 *  membrane has a time constant for the same reason: it takes a moment to move
 *  charge on and off it. */
export const VM_SETTLE_MS = 320

export const VOLTAGE_FACTS: TeachingPara[] = [
  {
    icon: '🔋',
    text: 'The meter reads the voltage across this membrane. At rest it sits near −70 millivolts, meaning the inside of the cell is negative compared with the outside. Every neuron in your body is holding this charge right now.',
  },
  {
    icon: '⚖️',
    text: 'Where it comes from: potassium is crowded inside and can leak out, and each potassium that leaves takes a positive charge with it, leaving the inside more negative. The voltage stops falling when the growing negativity pulls potassium back as fast as the gradient pushes it out.',
  },
  {
    icon: '🚪',
    text: 'So the voltage depends on what can CROSS, not just on what is piled up. Shut the leak channels and watch the meter climb: with potassium unable to move, the gradient is still there but the voltage largely is not. That is what selective permeability means.',
  },
  {
    icon: '⚙️',
    text: 'The pump is not what makes the voltage. Switch it off and the meter barely moves — its job is building the gradients the voltage is drawn from, and those take minutes to run down. Gradients are the batteries; the leak channel is the wire.',
  },
  {
    icon: '➕',
    text: 'The little plus and minus marks hugging the membrane are the charge itself. Only a vanishingly thin skin of ions along each face is involved — which is why the two piles never visibly change while the voltage swings about.',
  },
  {
    icon: '🎯',
    text: 'Each ion has a voltage it would be content at: about −90 mV for potassium, about +60 mV for sodium. The membrane sits at the average of those, pulled hardest by whichever ion is finding it easiest to cross. Open the sodium channels and watch which way it is dragged.',
  },
]
