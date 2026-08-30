// How inputs add up, and when that is enough to fire (N18, S07, S08).
//
// These are PEDAGOGICAL units on a 0–1 scale, not millivolts: real values
// arrive with the membrane-potential milestone. What matters here is the
// structure of the rule — inputs sum, dendritic spread weakens them, and the
// axon hillock fires only above a threshold.

/** Amplitude one synapse produces at the synapse itself. */
export const INPUT_AMPLITUDE = 0.5

/** Fraction of a graded ripple that survives the trip to the soma. Real
 *  electrotonic decay depends on distance and membrane properties; here every
 *  synapse is treated as equally distant (documented simplification). */
export const DENDRITIC_TRANSMISSION = 0.5

/** Depolarization the axon hillock needs before it launches an action
 *  potential. */
export const THRESHOLD = 0.45

/** Summed depolarization arriving at the hillock from `inputs` synapses
 *  firing together (spatial summation). */
export function amplitudeAtHillock(inputs: number): number {
  if (inputs <= 0) return 0
  return inputs * INPUT_AMPLITUDE * DENDRITIC_TRANSMISSION
}

/** Amplitude a single ripple still has once it has travelled `progress` of
 *  the way from its synapse to the soma (0 = at the synapse, 1 = arrived). */
export function rippleAmplitude(progress: number): number {
  const p = progress < 0 ? 0 : progress > 1 ? 1 : progress
  return INPUT_AMPLITUDE * (1 - (1 - DENDRITIC_TRANSMISSION) * p)
}

export function reachesThreshold(inputs: number): boolean {
  return amplitudeAtHillock(inputs) >= THRESHOLD
}

/** Fewest simultaneous inputs that can fire the neuron — the number the kid
 *  is meant to discover. */
export function inputsNeededToFire(available: number): number {
  for (let n = 1; n <= available; n++) if (reachesThreshold(n)) return n
  return available + 1
}
