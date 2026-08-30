import type { TeachingPara } from './neuron'

// The cell membrane (N07), and the real sizes that make the zoom honest.
// The drawing derives its scale from these numbers rather than the other way
// round, so the teaching text can never drift away from the geometry.

/** Diameter of the focus neuron's soma. Typical mammalian neuron cell body. */
export const SOMA_DIAMETER_UM = 20
/** Diameter of the axon. Realistic for a thin unmyelinated axon. */
export const AXON_DIAMETER_UM = 1.4
/** Thickness of a lipid bilayer, roughly 5 nm across all cell membranes. */
export const MEMBRANE_THICKNESS_NM = 5
/** Width of one phospholipid head group, about 1 nm. */
export const LIPID_HEAD_NM = 1

/** Centre-to-centre spacing of neighbouring lipids in a leaflet, nm.
 *
 *  From the measured area per lipid in a fluid phosphatidylcholine bilayer,
 *  ~0.65 nm²: √0.65 ≈ 0.81 nm. Heads therefore sit shoulder to shoulder —
 *  the spacing is slightly LESS than a head is wide, which is why a real
 *  membrane has no persistent gaps between molecules. */
export const LIPID_SPACING_NM = 0.81

export const MEMBRANE_THICKNESS_UM = MEMBRANE_THICKNESS_NM / 1000

/** How many times thinner the membrane is than the axon it wraps. */
export function membraneVsAxon(): number {
  return AXON_DIAMETER_UM / MEMBRANE_THICKNESS_UM
}

/** How many times thinner the membrane is than the soma. */
export function membraneVsSoma(): number {
  return SOMA_DIAMETER_UM / MEMBRANE_THICKNESS_UM
}

/** What the kid is looking at once the membrane fills the view. */
export const MEMBRANE_FACTS: TeachingPara[] = [
  {
    icon: '🧱',
    text: 'This is the cell membrane — the neuron’s skin. It is built from two layers of fatty molecules, tails pointing at each other in the middle and round heads facing the water on both sides.',
  },
  {
    icon: '💧',
    text: 'The middle is oily, and water hates oil. That is what makes this a barrier: charged particles like sodium and potassium cannot swim through it. They can only cross where a special protein lets them.',
  },
  {
    icon: '🌊',
    text: 'The little gaps you can see between the molecules are real — but nothing stays still here. The lipids drift and jostle past each other like people in a crowd, so every gap opens and closes again in an instant. This layer is a liquid, not a wall of bricks.',
  },
  {
    icon: '🫧',
    text: 'Small molecules with no charge — oxygen, carbon dioxide — slip in, dissolve in the oil and come out the other side. So the membrane is not sealed shut.',
  },
  {
    icon: '⚡',
    text: 'Sodium and potassium still cannot get through, and not because they are too big: it is their charge. A charged particle cannot enter the oily middle at all, however much room there is. That is exactly why they need a protein doorway — and those get built next.',
  },
  {
    icon: '⚖️',
    text: 'So the membrane keeps two different worlds apart — the fluid outside the cell and the cytoplasm inside — each with its own mix of ions. That difference is the battery every nerve signal runs on.',
  },
  {
    icon: '🚧',
    text: 'The proteins that let ions through — channels and pumps — get built into this membrane in the next milestone. Right now it is a plain, sealed wall.',
  },
]

/** Stated wherever the membrane is on screen, with the real numbers. */
export function membraneScaleNote(magnification: number): string {
  return `The membrane is about ${MEMBRANE_THICKNESS_NM} nanometres thick — roughly ${Math.round(
    membraneVsAxon(),
  )} times thinner than this axon, and ${Math.round(
    membraneVsSoma(),
  )} times thinner than the soma. That is why it takes about ×${Math.round(
    magnification,
  )} magnification before you can see it at all.`
}
