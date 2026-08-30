// The canonical teaching neuron (N01–N06): its parts, what each one does,
// and — per the F01 honesty rule — what this drawing simplifies.
//
// Content lives here (framework-free, unit-testable) so the scientific and
// pedagogical claims can be checked without a browser.

export type NeuronPartId = 'soma' | 'dendrites' | 'axon' | 'terminals'

export interface TeachingPara {
  icon: string
  text: string
}

export interface NeuronPart {
  id: NeuronPartId
  name: string
  /** Icon chosen for the part's FUNCTION, not its shape (N02: structure
   *  relates to function). */
  icon: string
  /** One-liner for the parts list. */
  role: string
  /** Which way signals move in this part. */
  flow: string
  explanation: TeachingPara[]
  /** What this representation leaves out or exaggerates. */
  simplification: string
}

export const NEURON_PARTS: NeuronPart[] = [
  {
    id: 'dendrites',
    name: 'Dendrites',
    icon: '👂',
    role: 'Listen to other neurons',
    flow: 'Signals travel inward, from the synapses toward the soma.',
    explanation: [
      {
        icon: '👂',
        text: 'Dendrites are the branchy arms that receive messages from other neurons. Every ripple you see here was started by an input neuron — dendrites never make signals of their own.',
      },
      {
        icon: '📉',
        text: 'A ripple is graded: a big message makes a big ripple, a small one a small ripple — and it fades as it spreads inward. Watch one shrink on its way to the soma.',
      },
      {
        icon: '🔢',
        text: 'Because ripples fade, a synapse far out on a branch has less say than one close to the soma. Real neurons listen to thousands of synapses at once; three are drawn here.',
      },
    ],
    simplification:
      'Real dendritic trees are far bushier, and real dendrites carry ion channels of their own. Here they are simple passive cables, and all three synapses are treated as equally far from the soma.',
  },
  {
    id: 'soma',
    name: 'Soma',
    icon: '➕',
    role: 'Adds up everything it hears',
    flow: 'Ripples from every dendrite converge here.',
    explanation: [
      {
        icon: '➕',
        text: 'The soma is the cell body. Ripples arriving from all the dendrites overlap and add up here — nudges toward firing and nudges away from it, mixed together.',
      },
      {
        icon: '📍',
        text: 'The spot where the axon leaves the soma is the axon hillock, and that is where the total gets tested. Enough depolarization there and the hillock launches an action potential; not enough and the ripples simply fade away.',
      },
      {
        icon: '🧬',
        text: 'The dark blob inside is the nucleus, holding the cell’s DNA. It keeps the neuron alive and supplied, but it takes no part in the signalling.',
      },
    ],
    simplification:
      'Adding up inputs is not a choice the cell makes — it is electricity: currents from many synapses simply sum in the membrane. The 0–100 % meter is a teaching scale, not millivolts; real numbers arrive with the membrane-potential milestone.',
  },
  {
    id: 'axon',
    name: 'Axon',
    icon: '⚡',
    role: 'Sends the signal far and fast',
    flow: 'One signal travels outward, from the hillock to the terminals.',
    explanation: [
      {
        icon: '📍',
        text: 'An action potential always starts at the axon hillock, right where the axon leaves the soma — never partway along the cable, and never on its own. Something upstream has to push the hillock past threshold first.',
      },
      {
        icon: '🔁',
        text: 'Nothing runs down the cable. The signal is rebuilt over and over: each patch of membrane wakes up its neighbour, which wakes up its neighbour — like a line of falling dominoes.',
      },
      {
        icon: '📏',
        text: 'Unlike a dendrite ripple, it does not fade. It arrives at the far end exactly as strong as it started: all-or-nothing, the same every time.',
      },
      {
        icon: '🤝',
        text: 'This is the electrical half of the story. Handing the message to the NEXT cell is a separate, chemical step, and it happens at the terminals.',
      },
    ],
    simplification:
      'The travelling glow is still a preview: what actually moves is a wave of ion channels opening and closing. Real axons are hundreds to thousands of times longer than this one, relative to the soma.',
  },
  {
    id: 'terminals',
    name: 'Axon terminals',
    icon: '📣',
    role: 'Pass the message on',
    flow: 'Here the electrical signal becomes a chemical one.',
    explanation: [
      {
        icon: '📣',
        text: 'The axon ends in a spray of little swellings called boutons — the talking end of the neuron.',
      },
      {
        icon: '🫧',
        text: 'Inside each bouton sit tiny bubbles called vesicles, filled with chemical messengers. When the action potential arrives, vesicles move to the membrane and spill their messengers into the gap.',
      },
      {
        icon: '➡️',
        text: 'The messengers cross the gap and make a fresh ripple in the target neuron’s dendrite — one small ripple, which on its own is not enough to fire it. The target needs its own crowd of inputs, exactly like this neuron did.',
      },
    ],
    simplification:
      'A real bouton holds hundreds of vesicles and needs calcium to release them; that trigger is built in the synapse milestone. Only three, hugely oversized, are drawn here.',
  },
]

/** Shown when nothing is selected. Frames the scene as a slice of a network,
 *  never as a neuron alone. */
export const NEURON_OVERVIEW: TeachingPara[] = [
  {
    icon: '🔭',
    text: 'A tiny slice of a network: three input neurons on the left, our neuron in the middle, and its target on the right. Their branches run off the edges of the picture, because the network keeps going.',
  },
  {
    icon: '🖱️',
    text: 'Click an input neuron to make it fire, and follow what happens next. Click any part of the middle neuron instead to learn what that part does.',
  },
  {
    icon: '🔎',
    text: 'The dashed rings mark places we can zoom into — each one is where an upcoming topic lives.',
  },
  {
    icon: '💡',
    text: 'This is one classic neuron shape, drawn for learning. Real neurons come in wildly different shapes and sizes: some have almost no dendrites, some have enormous bushy ones, and axons range from a fraction of a millimetre to over a metre long.',
  },
]

/** Why the neighbours are on stage at all. */
export const NETWORK_CONTEXT: TeachingPara[] = [
  {
    icon: '🤝',
    text: 'A neuron on its own does nothing. Its whole job is to listen to other cells, add up what they say, and pass something on — so its neighbours belong in the picture.',
  },
  {
    icon: '🔢',
    text: 'A real neuron receives thousands of synapses from hundreds of different cells, and contacts many targets in turn. Three inputs and one target keep it countable.',
  },
]

export function neuronPart(id: NeuronPartId): NeuronPart {
  const part = NEURON_PARTS.find((p) => p.id === id)
  if (!part) throw new Error(`Unknown neuron part: ${id}`)
  return part
}

/** Every sentence of teaching text in this module, for guardrail checks. */
export function allTeachingText(): string[] {
  return [
    ...NEURON_OVERVIEW.map((p) => p.text),
    ...NETWORK_CONTEXT.map((p) => p.text),
    ...NEURON_PARTS.flatMap((p) => [
      p.role,
      p.flow,
      p.simplification,
      ...p.explanation.map((e) => e.text),
    ]),
  ]
}


// ------------------------------------------------------- where the app stops
//
// One sentence, in one place, naming what this app does NOT yet contain.
//
// It is here because that claim has now gone stale three times. Each describer that
// reaches the edge of what is built used to carry its own wording, so every time
// something landed — the terminal, then the far side of the gap — two or three
// separate paragraphs quietly became false, and stayed false until someone noticed.
// Tests can pin that a sentence mentions the frontier; they cannot know whether it
// is true. The only fix that works is for there to be ONE sentence to update.
//
// When the next piece lands, change this and nothing else.

/** What the app does not yet do, in the child's own terms. */
export const FRONTIER =
  'how this neuron talks to the next one across the gap — the calcium, the little packets of chemical, and the receptors that catch them'

/** A short name for it, for a sentence that needs one. */
export const FRONTIER_SHORT = 'the gap between two neurons'
