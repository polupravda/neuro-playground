import type { Destination } from '../core/contents'
import { useNeuronStore } from './neuronStore'
import { useAxonStore } from './axonStore'
import { useTourStore } from './tourStore'
import { useBenchStore } from './benchStore'
import { useTrainStore } from './trainStore'
import { useLipidStore } from './lipidStore'
import { usePermeaStore } from './permeaStore'
import { useCapacitorStore } from './capacitorStore'
import { useChannelStore } from './channelStore'
import { useRestingStore } from './restingStore'
import { useFilterStore } from './filterStore'
import { usePatchStore } from './patchStore'
import { useGatingStore } from './gatingStore'
import { useSnareStore } from './snareStore'

// TAKING SOMEONE SOMEWHERE, rather than showing them a page.
//
// The contents menu is an index into the world (see `core/contents.ts`): every
// route flies the camera to the place first and opens the exhibit when it gets
// there. That is what keeps "spatial navigation, not pages" true with a table
// of contents in the app — the menu is a shortcut ALONG the spatial route, not
// a way around it. A child who arrives at the patch clamp by way of the
// dendrite has still been told where the patch clamp is.

/** How long the camera takes to arrive. The exhibit opens after it, so the
 *  trip is watched rather than skipped — and so a drawer does not slide over
 *  the flight it is supposed to be the destination of. */
export const TRAVEL_MS = 900

const OPENERS: Record<string, () => void> = {
  balance: () => useBenchStore.getState().openBench(),
  train: () => useTrainStore.getState().openTrain(),
  lipid: () => useLipidStore.getState().openLab(),
  permea: () => usePermeaStore.getState().openBench(),
  capacitor: () => useCapacitorStore.getState().openBench(),
  channel: () => useChannelStore.getState().openBench(),
  resting: () => useRestingStore.getState().openBench(),
  filter: () => useFilterStore.getState().openBench(),
  gating: () => useGatingStore.getState().openBench(),
  patch: () => usePatchStore.getState().openBench(),
  scales: () => useTourStore.getState().openBench(),
  snare: () => useSnareStore.getState().openBench(),
}

/** Everything a route does, as data — so a test can check the plan without
 *  running a camera or a timer. */
export interface Leg {
  kind: 'zoom-out' | 'zoom-to' | 'open' | 'race'
  arg?: string
}

/** The plan for a destination, in order. Pure: no stores, no clock. */
export function planFor(to: Destination, from: string | null): Leg[] {
  const legs: Leg[] = []
  if (to.zoom === null) {
    if (from !== null) legs.push({ kind: 'zoom-out' })
  } else if (to.zoom !== from) {
    legs.push({ kind: 'zoom-to', arg: to.zoom })
  }
  if (to.then === 'race') legs.push({ kind: 'race' })
  if (to.drawer) legs.push({ kind: 'open', arg: to.drawer })
  return legs
}

/** True when the route actually travels, and therefore has to wait for the
 *  camera before opening anything. Arriving somewhere you already are should
 *  not stall for a second on an empty flight. */
export const travels = (legs: Leg[]): boolean =>
  legs.some((l) => l.kind === 'zoom-to' || l.kind === 'zoom-out')

function run(leg: Leg): void {
  if (leg.kind === 'zoom-out') useNeuronStore.getState().zoomOut()
  else if (leg.kind === 'zoom-to' && leg.arg) useNeuronStore.getState().zoomTo(leg.arg)
  else if (leg.kind === 'race') useAxonStore.getState().setMode('race')
  else if (leg.kind === 'open' && leg.arg) OPENERS[leg.arg]?.()
}

/** Fly there, then open. Returns the timer so a caller can cancel it if the
 *  child changes their mind mid-flight. */
export function goTo(to: Destination): ReturnType<typeof setTimeout> | null {
  const legs = planFor(to, useNeuronStore.getState().zoom)
  const moves = legs.filter((l) => l.kind === 'zoom-to' || l.kind === 'zoom-out')
  const rest = legs.filter((l) => l.kind !== 'zoom-to' && l.kind !== 'zoom-out')
  for (const leg of moves) run(leg)
  if (rest.length === 0) return null
  if (!travels(legs)) {
    for (const leg of rest) run(leg)
    return null
  }
  return setTimeout(() => {
    for (const leg of rest) run(leg)
  }, TRAVEL_MS)
}
