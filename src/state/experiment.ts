import { CHANNELS, CHANNEL_IDS, gateOf } from '../core/channels'
import { useApStore } from './apStore'
import type { StimulusId } from '../core/scenarios'
import { membraneVoltageMv } from '../core/voltage'
import {
  consequenceOf,
  type ChangeEvent,
  type Consequence,
  type Snapshot,
} from '../core/consequences'
import type { IonKind, Side } from '../core/ions'
import { create } from 'zustand'
import { useIonStore } from './ionStore'
import { useMembraneStore } from './membraneStore'

// X01: every change goes through here, so the app can always say what the
// change did. One place takes a snapshot, applies the change, snapshots again,
// and works out the consequence — which is why no caller can forget to.

interface ChangeState {
  last: Consequence | null
  /** Bumped per change, so the panel can tell a repeat from a no-op. */
  count: number
}

export const useChangeStore = create<ChangeState>(() => ({ last: null, count: 0 }))

/** Channels open right now — the gates as they actually are. The voltage-gated
 *  pair answer to a running spike, which is a moment rather than a state, so a
 *  change is judged against the resting membrane. */
function openChannels(): (typeof CHANNELS)[keyof typeof CHANNELS][] {
  const { leaksOn, transmitterPulse } = useMembraneStore.getState()
  const live = useApStore.getState().live
  const env = {
    ap: live && { na: live.naOpen, k: live.kOpen },
    transmitter: transmitterPulse > 0,
  }
  return CHANNEL_IDS.map((id) => CHANNELS[id]).filter(
    (channel) =>
      (channel.gating !== 'always' || leaksOn) && gateOf(channel, env) === 'open',
  )
}

function snapshot(): Snapshot {
  const { counts } = useIonStore.getState()
  const { leaksOn } = useMembraneStore.getState()
  return { counts, leaksOn, vm: membraneVoltageMv(counts, openChannels()) }
}

/** Apply a change and record what followed from it. */
export function applyChange(event: ChangeEvent, mutate: () => void): void {
  const before = snapshot()
  mutate()
  const after = snapshot()
  useChangeStore.setState((s) => ({
    last: consequenceOf(event, before, after),
    count: s.count + 1,
  }))
}

// The actions the panels call. Each is a change plus its mutation, together.

export function setIonCount(ion: IonKind, side: Side, value: number): void {
  const current = useIonStore.getState().counts[ion][side]
  if (Math.round(value) === current) return
  applyChange({ kind: 'ion', ion, side }, () =>
    useIonStore.getState().setCount(ion, side, value),
  )
}

export function resetIons(): void {
  applyChange({ kind: 'ions-reset' }, () => useIonStore.getState().reset())
}

export function togglePump(): void {
  const on = !useMembraneStore.getState().pumpOn
  applyChange({ kind: 'pump', on }, () => useMembraneStore.getState().togglePump())
}

export function toggleLeaks(): void {
  const on = !useMembraneStore.getState().leaksOn
  applyChange({ kind: 'leaks', on }, () => useMembraneStore.getState().toggleLeaks())
}

/** Fire one spike. There is no "hold it depolarized" any more: a real membrane
 *  cannot be held there, and the spike is the honest version of that control. */
export function fireActionPotential(stimulus: StimulusId = 'spike'): void {
  applyChange({ kind: 'action-potential', stimulus }, () =>
    useApStore.getState().fire(stimulus),
  )
}

// Moving about inside a spike is not a change to the membrane — it is a change to
// where we are looking — so these deliberately do NOT go through applyChange.
// Scrubbing back and forth should not fill the panel with consequences.

export const pauseAp = (): void => useApStore.getState().pause()
export const resumeAp = (): void => useApStore.getState().resume()
export const scrubAp = (u: number): void => useApStore.getState().scrubTo(u)
export const toggleSpotlight = (): void => useApStore.getState().toggleSpotlight()

export function releaseTransmitter(): void {
  applyChange({ kind: 'transmitter' }, () =>
    useMembraneStore.getState().releaseTransmitter(),
  )
}
