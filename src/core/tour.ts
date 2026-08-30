import { FRONTIER, type TeachingPara } from './neuron'
import type { IonCounts } from '../state/ionStore'
import { FIRE_STIMULUS, trajectory, sampleAt } from './spikeModel'
import { sampleFibre, type FibreRun } from './fibre'

// C05 — trace one signal through every scale it exists at.
//
// The spec calls this the app's "signature interaction": *one causal chain links
// molecular to circuit scales*. Everything it needs was already built and was
// being shown as three unrelated exhibits — a patch of membrane with doors, a
// stretch of axon with a wave, a whole cell with a chain running across it. A
// child could visit all three and never learn the thing that matters most, which
// is that they are the SAME EVENT seen at three magnifications.
//
// ----------------------------------------------- the claim, and why it is true
//
// This is not a story told over the top of three animations. It is a fact about
// the model, and `scaleAgreement` measures it rather than asserting it: the same
// gradients, the same push and the same Hodgkin–Huxley equations drive all three,
// so the spike at one patch and the spike at any compartment of the axon come out
// the same to within half a millivolt.
//
// The small difference is not noise and is worth naming: a patch in the middle of
// a cable loses a little current sideways to its neighbours, which a patch on its
// own does not. That is also, exactly, what makes the wave travel. So the discre-
// pancy between the two scales IS the mechanism connecting them.
//
// ------------------------------------------------------------ which way to walk
//
// Outwards: membrane → axon → whole cell, which is the spec's own order and the
// opposite of how the app is explored. Every other route through this app zooms
// IN, because zooming in is how you answer "what is really happening". That
// question has been answered by the time a child gets here. The one left over is
// "what was all that FOR", and it is answered by pulling out — the doors you
// watched opening are the doors that make a foot move.
//
// -------------------------------------------------------- where it stops, honestly
//
// At the whole cell, which does reach the next neuron — the chain animation ends
// on the target cell responding. The near side of the gap is built too, at the
// outgoing terminal, so the last stop points at it. What is NOT built is the far
// side: the receptors, and what the next cell does about what it catches. The last
// stop says exactly that rather than gesturing at a gap and hoping. An app that has
// spent four milestones refusing to assert unmeasured numbers should not finish on
// a promise dressed as a demonstration.
//
// This paragraph is CHECKED by a test, and it has already been wrong once: it said
// the whole synapse was unbuilt, and stayed saying it for the length of time it
// took to build one. A claim about what the app contains is exactly the kind that
// rots quietly.

export interface TourStop {
  id: string
  /** Zoom target to fly to, or null for the whole scene. */
  zoom: string | null
  /** What this stop is called, in the child's terms. */
  title: string
  /** One line under the title: what to watch for. */
  watch: string
}

export const TOUR_STOPS: TourStop[] = [
  {
    id: 'patch',
    zoom: 'axon-membrane',
    title: 'One patch of membrane',
    watch: 'Doors open, ions cross, the voltage swings and comes back.',
  },
  {
    id: 'axon',
    zoom: 'axon-signal',
    title: 'The whole axon',
    watch: 'That same swing, happening at one patch after another down the cable.',
  },
  {
    id: 'cell',
    zoom: null,
    title: 'The whole neuron',
    watch: 'And that cable is this cell, carrying one signal from an input to the next neuron.',
  },
]

export interface Agreement {
  /** Peak of a spike on one patch, mV. */
  patchPeakMv: number
  /** Peak at a compartment of the axon, mV. */
  fibrePeakMv: number
  /** How far apart they are, mV. */
  gapMv: number
  /** How long each spends above zero, ms — the app's own definition of a spike. */
  patchWidthMs: number
  fibreWidthMs: number
  restMv: number
}

/** How closely the two scales agree, measured on the runs actually on screen.
 *
 *  Takes the fibre run rather than building one, so this compares the very axon
 *  the child is looking at with the very patch they are looking at. A version that
 *  made its own fibre could report agreement between two things nobody was
 *  being shown. */
export function scaleAgreement(
  counts: IonCounts,
  leaksOn: boolean,
  fibre: FibreRun,
  atP = 0.5,
): Agreement {
  const patch = trajectory(counts, leaksOn, FIRE_STIMULUS)
  const window = fibre.t[fibre.t.length - 1] ?? 0

  let fibrePeak = -Infinity
  for (let i = 0; i < fibre.t.length; i++) {
    fibrePeak = Math.max(fibrePeak, sampleFibre(fibre, 'vm', i / (fibre.t.length - 1), atP))
  }

  // How long above zero, which is what this app calls a spike everywhere.
  const spanOf = (read: (u: number) => number, ms: number): number => {
    let first = -1
    let last = -1
    for (let i = 0; i <= 600; i++) {
      const u = i / 600
      if (read(u) > 0) {
        if (first < 0) first = u
        last = u
      }
    }
    return first < 0 ? 0 : (last - first) * ms
  }

  return {
    patchPeakMv: patch.peak,
    fibrePeakMv: fibrePeak,
    gapMv: Math.abs(patch.peak - fibrePeak),
    patchWidthMs: spanOf((u) => sampleAt(patch, 'vm', u), patch.windowMs),
    fibreWidthMs: spanOf((u) => sampleFibre(fibre, 'vm', u, atP), window),
    restMv: patch.rest,
  }
}

/** What each stop has to say, built from what the model does. */
export function tourFacts(stop: TourStop, agree: Agreement | null): TeachingPara[] {
  if (stop.id === 'patch') {
    return [
      {
        icon: '🔬',
        text: 'Start at the smallest scale the event exists at: one patch of membrane, a few millionths of a millimetre across. Sodium’s doors open, sodium falls inward, the inside goes briefly positive — then potassium leaves and it comes back. That is the whole action potential. There is nothing smaller to look at.',
      },
      {
        icon: '🎯',
        text: 'Here the push comes from us, straight into the membrane, the way a scientist would do it with an electrode. In a living cell the push comes from the neuron’s own inputs — which is what the last stop shows. The spike is the same either way; only what pressed it differs.',
      },
    ]
  }

  if (stop.id === 'axon') {
    return [
      {
        icon: '🌊',
        text: 'Now pull back. That single patch was one of thousands along this cable, and each one does exactly what you just watched — then wakes its neighbour, which does it too. Nothing travels the length of the axon. The event is rebuilt, from scratch, over and over.',
      },
      agree
        ? {
            icon: '📐',
            text: `And it really is the same event, not a story told over two pictures. A spike on the patch on its own peaks at ${agree.patchPeakMv.toFixed(
              1,
            )} mV and stays above zero for ${agree.patchWidthMs.toFixed(
              2,
            )} ms; a patch in the middle of this axon peaks at ${agree.fibrePeakMv.toFixed(
              1,
            )} mV and stays above zero for ${agree.fibreWidthMs.toFixed(
              2,
            )} ms. Same equations, same membrane, same answer.`,
          }
        : {
            icon: '📐',
            text: 'Same equations, same membrane, same answer — the two scales are one model.',
          },
      agree
        ? {
            icon: '🔗',
            text: `The ${agree.gapMv.toFixed(
              1,
            )} mV they differ by is not sloppiness, and it is the most interesting number here. A patch in a cable loses a little current sideways, to its neighbours; a patch on its own has no neighbours to lose it to. That leak is exactly what wakes the next patch up. The gap between the two scales IS the thing that joins them.`,
          }
        : {
            icon: '🔗',
            text: 'A patch in a cable loses a little current sideways to its neighbours — which is precisely what wakes the next patch up.',
          },
    ]
  }

  return [
    {
      icon: '🧠',
      text: 'And that cable is this cell. An input neuron fires, a ripple spreads in along a dendrite and fades as it goes, the soma adds up what arrives — and if it is enough, the axon does what you have just watched it do, all the way to the endings, where it speaks to the next cell.',
    },
    {
      icon: '🪜',
      text: 'Three pictures, three magnifications, one event. A door opening on a patch too small to see is the same thing as a message arriving at another neuron. That is the whole idea, and it is the reason any of the rest of it matters.',
    },
    {
      icon: '🚧',
      text: `Where it stops. This neuron reaches the next one — the chain you have just followed is real all the way to its endings. What is NOT built yet is ${FRONTIER}. So the story ends at the moment the signal arrives at the end of the wire.`,
    },
  ]
}
