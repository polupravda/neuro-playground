import type { TeachingPara } from './neuron'

// The four signalling ions of V1 (N08). Concentrations are standard mammalian
// teaching values in mM; sizes are real hydrated diameters in nm. On-canvas
// particle COUNTS are pedagogical — each ball stands for a crowd — but the
// proportions between the two sides, and the sizes of the balls, are honest.
export type IonKind = 'na' | 'k' | 'cl' | 'ca'
export type Side = 'outside' | 'inside'

export interface IonSpecies {
  kind: IonKind
  symbol: string
  name: string
  /** Elementary charge units. */
  charge: number
  /** Typical intracellular concentration, mM. */
  insideMM: number
  /** Typical extracellular concentration, mM. */
  outsideMM: number
  /** Diameter with its shell of water, nm — the size it actually travels at. */
  hydratedNm: number
  /** Diameter of the bare ion, nm. */
  bareNm: number
}

export const IONS: Record<IonKind, IonSpecies> = {
  na: {
    kind: 'na',
    symbol: 'Na⁺',
    name: 'sodium',
    charge: 1,
    insideMM: 15,
    outsideMM: 145,
    hydratedNm: 0.72,
    bareNm: 0.2,
  },
  k: {
    kind: 'k',
    symbol: 'K⁺',
    name: 'potassium',
    charge: 1,
    insideMM: 140,
    outsideMM: 5,
    hydratedNm: 0.66,
    bareNm: 0.28,
  },
  cl: {
    kind: 'cl',
    symbol: 'Cl⁻',
    name: 'chloride',
    charge: -1,
    insideMM: 10,
    outsideMM: 110,
    hydratedNm: 0.66,
    bareNm: 0.36,
  },
  // Free intracellular Ca²⁺ is ~100 nM — four orders of magnitude below
  // outside, which is exactly why Ca²⁺ entry is such a sharp trigger (S02).
  ca: {
    kind: 'ca',
    symbol: 'Ca²⁺',
    name: 'calcium',
    charge: 2,
    insideMM: 0.0001,
    outsideMM: 2,
    hydratedNm: 0.82,
    bareNm: 0.2,
  },
}

export const ION_KINDS: IonKind[] = ['na', 'k', 'cl', 'ca']

/** Millimolar represented by one drawn ion — one for one, so the piles ARE the
 *  real concentrations and the lopsidedness needs no interpreting. */
export const MM_PER_PARTICLE = 1
/** Ceiling on drawn ions per species per side. */
export const MAX_PARTICLES = 150
/** How much one press of a stepper moves a pile. A single ion is invisible in a
 *  crowd this size; ten is a change you can see. */
export const PARTICLE_STEP = 10

/** How many balls to draw for a concentration. Linear, so the lopsidedness
 *  between the two sides is exactly true; floored at one so a tiny but real
 *  presence does not read as "none"; and zero only when there is genuinely
 *  almost nothing, as with calcium inside. */
export function particlesFor(mM: number): number {
  if (mM < 0.5) return 0
  return Math.min(MAX_PARTICLES, Math.max(1, Math.round(mM / MM_PER_PARTICLE)))
}

/** Which way the CHEMICAL gradient alone pushes this ion when a pathway
 *  opens (N09). The electrical driving force is a later, separate concept —
 *  do not fold it in here. */
export function chemicalGradientDirection(kind: IonKind): 'inward' | 'outward' {
  const ion = IONS[kind]
  return ion.outsideMM > ion.insideMM ? 'inward' : 'outward'
}

/** Same question for whatever the kid has currently set up, in drawn balls. */
export function gradientFrom(
  outside: number,
  inside: number,
): 'inward' | 'outward' | 'balanced' {
  if (outside === inside) return 'balanced'
  return outside > inside ? 'inward' : 'outward'
}

/** "+", "2+", "−" — kid-readable charge tag for badges and labels. */
export function chargeTag(kind: IonKind): string {
  const q = IONS[kind].charge
  const sign = q > 0 ? '+' : '−'
  return Math.abs(q) === 1 ? sign : `${Math.abs(q)}${sign}`
}

/** Plain-words description of the pile-up a kid can see. */
export function gradientNote(kind: IonKind): string {
  const ion = IONS[kind]
  const inward = chemicalGradientDirection(kind) === 'inward'
  const ratio = Math.round(
    inward ? ion.outsideMM / ion.insideMM : ion.insideMM / ion.outsideMM,
  )
  const many = inward ? 'outside' : 'inside'
  const few = inward ? 'inside' : 'outside'
  if (ion.kind === 'ca') {
    return `${ion.name}: crowded ${many}, almost none ${few} at all — the steepest gradient in the cell.`
  }
  return `${ion.name}: about ${ratio} times more ${many} than ${few}, so it would rush ${
    inward ? 'in' : 'out'
  } if a door opened.`
}

export const ION_FACTS: TeachingPara[] = [
  {
    icon: '⚛️',
    text: 'These balls are ions — atoms carrying an electric charge. Sodium (Na⁺) and potassium (K⁺) are the pair that nerve signals are built from; chloride (Cl⁻) and calcium (Ca²⁺) have their own jobs later.',
  },
  {
    icon: '⚖️',
    text: 'Look at the two sides and the point is obvious: sodium is piled up OUTSIDE, potassium INSIDE. That lopsidedness is a gradient, and it is stored energy — water held behind a dam.',
  },
  {
    icon: '🚧',
    text: 'Nothing is crossing, because there is nothing to cross through: this membrane has no doorways in it yet. Pumps and channels come next, and then this stored energy can become a signal.',
  },
  {
    icon: '🔢',
    text: 'There is one ball for each unit of concentration, so the two piles have exactly the real proportions — but every single ball still stands for an enormous crowd of actual ions. Their SIZE is honest too: an ion really is smaller than a lipid head.',
  },
  {
    icon: '💧',
    text: 'Each ion drags a shell of water with it, which is what makes it too big and too charged to melt into the oily middle. Oddly, sodium is the smaller atom but the bigger traveller, because it holds its water more tightly than potassium does.',
  },
]

/** The cell's resting concentrations as a counts table — the shape everything
 *  that computes a voltage wants. Lives here rather than inside the store so
 *  that core code can reach it without importing state, and so there is only
 *  ONE of it (2026-08-28: the patch clamp needed the potassium voltage and the
 *  only copy was private to `ionStore`). */
export function restingCounts(): Record<IonKind, { outside: number; inside: number }> {
  return ION_KINDS.reduce(
    (acc, kind) => {
      acc[kind] = {
        outside: particlesFor(IONS[kind].outsideMM),
        inside: particlesFor(IONS[kind].insideMM),
      }
      return acc
    },
    {} as Record<IonKind, { outside: number; inside: number }>,
  )
}
