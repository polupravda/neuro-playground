import type { TeachingPara } from './neuron'

// The two proteins that hold the resting membrane together (N11, N12): the
// sodium-potassium pump, which spends energy to move ions AGAINST their
// gradients, and the potassium leak channel, which simply lets potassium
// follow its gradient out.
//
// Keeping them clearly different is the point of this step: one is a machine
// that costs ATP, the other an open hole that costs nothing.

export type ProteinKind = 'pump' | 'channel'

/** Sodium carried out of the cell per pump cycle. */
export const PUMP_NA_OUT = 3
/** Potassium carried in per pump cycle. */
export const PUMP_K_IN = 2

/** Width of the pump where it crosses the membrane, nm. Its cytoplasmic head
 *  bulges further in than that. */
export const PUMP_WIDTH_NM = 6
/** Width of a potassium leak channel where it crosses the membrane, nm. */
export const LEAK_WIDTH_NM = 5

/** Net charge the pump moves out of the cell per cycle. Three positives out
 *  against two in leaves +1 leaving, so the pump makes the inside very slightly
 *  more negative all by itself — a real but small effect. */
export function pumpNetChargeOut(): number {
  return PUMP_NA_OUT - PUMP_K_IN
}

export const PUMP_FACTS: TeachingPara[] = [
  {
    icon: '⚙️',
    text: 'This is the sodium-potassium pump. It is a machine, not a hole: it grabs ions, changes shape, and puts them down on the other side.',
  },
  {
    icon: '🔢',
    text: `Count each cycle: ${PUMP_NA_OUT} sodium go OUT, then ${PUMP_K_IN} potassium come IN. Always those numbers, always those directions.`,
  },
  {
    icon: '🔋',
    text: 'It pushes both ions the wrong way — uphill, against their gradients — and that costs energy. The flash each cycle is a molecule of ATP being spent. A third of everything you eat goes to pumps like this one.',
  },
  {
    icon: '⚡',
    text: `Because ${PUMP_NA_OUT} positives leave for every ${PUMP_K_IN} that arrive, each cycle takes a tiny bit of positive charge out of the cell. That nudges the inside more negative — though only by a few millivolts, so it is not where most of the voltage comes from.`,
  },
]

export const LEAK_FACTS: TeachingPara[] = [
  {
    icon: '🕳️',
    text: 'This is a potassium leak channel — a hole that is simply always open. No energy, no cycle, no grabbing: potassium just wanders through whenever it happens to arrive.',
  },
  {
    icon: '⬆️',
    text: 'It only leaks one way in practice, because potassium is crowded inside and scarce outside. The channel does not push it — the gradient does.',
  },
  {
    icon: '🔑',
    text: 'It is picky: potassium fits and passes, sodium mostly does not. A membrane that leaks one ion far more easily than another is called selectively permeable, and that selectivity is the main reason the resting voltage sits where it does.',
  },
  {
    icon: '⚖️',
    text: 'At rest the pump and the leaks exactly cancel out — everything the leaks let go, the pump puts back. That is why the two piles of ions stay the same size while both are busy.',
  },
]

/** Why turning either one off matters (N11/N12 toggles). */
export function offNote(kind: ProteinKind): string {
  return kind === 'pump'
    ? 'With the pump stopped, nothing is refilling the gradients. They would run down and the cell would go flat — over minutes, not seconds, which is why the piles here do not visibly shrink.'
    : 'With the leaks shut, potassium has no way through the membrane at all. The gradient stays put, but the membrane is no longer selectively permeable — and the resting voltage depends on exactly that.'
}
