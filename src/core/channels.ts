import type { TeachingPara } from './neuron'
import type { IonKind } from './ions'

// Ion channels (N13–N15). One shape of description covers all of them, and the
// differences that matter are data: what opens it, what it lets through, and how
// fast. A channel is never a manual switch — something has to open it.

export type ChannelId = 'leak-k' | 'voltage-na' | 'voltage-k' | 'ligand'

/** What makes a channel open. */
export type Gating = 'always' | 'voltage' | 'ligand'

export type GateState = 'open' | 'closed'

export interface ChannelType {
  id: ChannelId
  name: string
  /** Short label for the canvas. */
  short: string
  gating: Gating
  /** One line naming what opens it — the thing that separates the types. */
  opensWhen: string
  /** Ions it lets through. Each travels whichever way its own gradient points;
   *  a channel is a hole, it does not choose a direction. */
  passes: IonKind[]
  /** How fast ions cross when it is open, relative to a leak channel. */
  conductance: number
  widthNm: number
  facts: TeachingPara[]
}

/** Depolarization at which the voltage-gated channels open, on the same 0–1
 *  scale the hillock meter uses. */
export const OPEN_ABOVE = 0.5

/** How far open a voltage-gated channel has to be to be drawn open, as a
 *  fraction of its OWN widest.
 *
 *  This was an absolute conductance at first — half of what one leak channel
 *  passes — and that was wrong in a way that mattered. Potassium opens far wider
 *  than a leak channel, so it crossed an absolute threshold at four per cent of
 *  its own maximum: it counted as "open" before the spike had even reached its
 *  peak, which made nonsense of the one lesson the whole staging exists to teach.
 *  One drawn channel stands for a population, so "open" means that population is
 *  carrying something worth seeing. */
export const OPEN_FRACTION = 0.25

/** How long one puff of neurotransmitter keeps a ligand-gated channel open. */
export const TRANSMITTER_MS = 2600

export const CHANNELS: Record<ChannelId, ChannelType> = {
  'leak-k': {
    id: 'leak-k',
    name: 'Potassium leak channel',
    short: 'K⁺ leak',
    gating: 'always',
    opensWhen: 'Never shuts — it has no gate at all.',
    passes: ['k'],
    conductance: 1,
    widthNm: 5,
    facts: [
      {
        icon: '🕳️',
        text: 'The simplest kind: a hole with no gate. Potassium wanders out through it all day long, and this steady dribble is most of what sets the resting voltage.',
      },
    ],
  },
  'voltage-na': {
    id: 'voltage-na',
    name: 'Voltage-gated sodium channel',
    short: 'Na⁺ voltage-gated',
    gating: 'voltage',
    opensWhen: 'Snaps open the moment the membrane depolarizes.',
    passes: ['na'],
    conductance: 4,
    widthNm: 5,
    facts: [
      {
        icon: '⚡',
        text: 'This one has a voltage sensor — the little positive marks on its wall. They feel the electrical field across the membrane, and when the inside becomes less negative they move, and the gate springs open.',
      },
      {
        icon: '🌊',
        text: 'When it opens, sodium pours in: it is crowded outside, scarce inside, and now there is a door. This is the rush that makes an action potential shoot upward.',
      },
      {
        icon: '⏱️',
        text: 'It is fast. That speed is why the upstroke of a nerve signal takes less than a millisecond.',
      },
    ],
  },
  'voltage-k': {
    id: 'voltage-k',
    name: 'Voltage-gated potassium channel',
    short: 'K⁺ voltage-gated',
    gating: 'voltage',
    opensWhen: 'Opens on depolarization too — but late, a beat after sodium.',
    passes: ['k'],
    conductance: 2,
    widthNm: 5,
    facts: [
      {
        icon: '🐌',
        text: 'It has a voltage sensor as well, and answers the same signal as the sodium channel — but slowly. Watch: sodium opens at once, and this one only follows a moment later.',
      },
      {
        icon: '🔁',
        text: 'That lateness is not a flaw, it is the point. By the time potassium starts pouring out, sodium has already rushed in — so the exit undoes the entry and the voltage swings back down.',
      },
      {
        icon: '📈',
        text: 'One channel fast, one channel late: that is enough to turn a nudge into a spike that rises and falls. It is the whole shape of an action potential in two proteins.',
      },
    ],
  },
  ligand: {
    id: 'ligand',
    name: 'Ligand-gated channel',
    short: 'chemical-gated',
    gating: 'ligand',
    opensWhen: 'Opens when a chemical messenger lands in its cup.',
    passes: ['na'],
    conductance: 3,
    widthNm: 6,
    facts: [
      {
        icon: '🥄',
        text: 'This one ignores voltage completely. It has a cup on the outside, shaped to fit one particular messenger molecule, and it opens only when that molecule drops in.',
      },
      {
        icon: '🤝',
        text: 'This is how one neuron talks to the next: the messenger arrives from another cell, lands here, and the door opens. A chemical signal becomes an electrical one at this exact spot.',
      },
      {
        icon: '⏳',
        text: 'It stays open only while the messenger is held. Once it drifts off, the gate shuts again.',
      },
      {
        icon: '🧩',
        text: 'The one drawn here is a stand-in for a whole family. Real chemical-gated channels have names — AMPA, GABA-A, nicotinic — and each fits its own messenger and passes its own ions. They crowd where messages actually land: at the synapses.',
      },
    ],
  },
}

export const CHANNEL_IDS: ChannelId[] = ['leak-k', 'voltage-na', 'voltage-k', 'ligand']

/** The ions an action potential is actually about: whatever the voltage-gated
 *  channels carry. Derived rather than listed, so if a voltage-gated calcium
 *  channel is ever added, calcium comes into focus during a spike without anyone
 *  having to remember a second list somewhere. */
export const SPIKE_IONS: IonKind[] = [
  ...new Set(
    CHANNEL_IDS.filter((id) => CHANNELS[id].gating === 'voltage').flatMap(
      (id) => CHANNELS[id].passes,
    ),
  ),
]

/** Everything a gate needs to know about the world around it. */
export interface GateEnv {
  /** How far open the two voltage-gated doors are right now, each as a fraction
   *  of its own widest — null when the membrane is at rest and both are shut.
   *  The action potential owns this timing: there is no separate "hold it
   *  depolarized" state any more, because a real membrane cannot be held there. */
  ap: { na: number; k: number } | null
  /** Is a messenger sitting in the binding cup? */
  transmitter: boolean
}

/** Whether a channel is open. Each type answers a different question, which is
 *  the point of N13: channels are not switches with one rule. */
export function gateOf(channel: ChannelType, env: GateEnv): GateState {
  switch (channel.gating) {
    case 'always':
      return 'open'
    case 'voltage': {
      // Not "is the membrane depolarized" but "how wide is this particular
      // door" — the sodium door opens at once and shuts itself again, the
      // potassium one answers late and lingers. Both come from the spike's own
      // conductance envelopes, so what is drawn open is exactly what the
      // voltage was worked out from.
      if (!env.ap) return 'closed'
      const open = channel.id === 'voltage-na' ? env.ap.na : env.ap.k
      return open > OPEN_FRACTION ? 'open' : 'closed'
    }
    case 'ligand':
      return env.transmitter ? 'open' : 'closed'
  }
}

/** Plain-words state, for the panel. */
export function gateNote(channel: ChannelType, state: GateState): string {
  if (channel.gating === 'always') return 'always open'
  return state === 'open' ? 'open' : 'shut'
}

export const CHANNEL_OVERVIEW: TeachingPara[] = [
  {
    icon: '🚪',
    text: 'Every one of these is a doorway through the oily middle — the only way a charged ion ever crosses. But they are not all the same door, and none of them is a switch you flip: each one answers to something.',
  },
  {
    icon: '🔑',
    text: 'One is always open. Two watch the voltage, and one of those two is deliberately slow. One waits for a chemical messenger and ignores voltage entirely. Different gates, different rules — that is what lets a neuron do anything at all.',
  },
  {
    icon: '🎯',
    text: 'They are also picky about who gets through. A sodium channel passes sodium and turns potassium away, and the other way round — which is why opening one channel or the other has completely opposite effects.',
  },
]
