import { FRONTIER_SHORT } from './neuron'

// THE CONTENTS — the app's second door onto everything it can show.
//
// Why it exists (user, 2026-08-28): "we have entry points which can only be
// discovered by accident". True, and getting truer with every exhibit. The
// magnifier on the filter and the probe on the little neuron are good doors,
// but a door nobody knows about is a door nobody opens.
//
// ⚠ AND IT DOES NOT REPEAL "SPATIAL NAVIGATION, NOT PAGES".
//
// The rule says other views are reached by zooming into a place on the neuron,
// so they never feel like separate apps. A table of contents looks exactly like
// the pages that rule forbids — so this one is not a page switcher. Picking an
// entry FLIES THE CAMERA TO THE PLACE FIRST and opens the exhibit when it
// arrives (ruled with the user, 2026-08-28). The menu is an index into the
// world, not a way around it: every route still teaches where on a neuron the
// thing happens, and every exhibit still has its own door out there on the
// canvas. Two entry points, one destination, one geography.
//
// The structure is the user's lecture course, Parts I–VII, ENRICHED: several
// things this app teaches are not lecture headings (the whole cell as a place,
// the guided signal trace, the change-one-thing experiment), and they are
// folded into the Part they belong to rather than left out because a syllabus
// did not name them.
//
// What it lists is what EXISTS. A menu of greyed-out promises teaches that the
// app is mostly empty, and it would be a second place where a claim about what
// the app contains could rot — see the FRONTIER rule. So unbuilt Parts carry a
// single line that interpolates `FRONTIER_SHORT` and nothing else.

export type PartId = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII'

export interface Part {
  id: PartId
  /** The course's own heading, addressed to the adult reading aloud. */
  title: string
  /** One line a child can be read, saying what this part is about. */
  gist: string
}

export const PARTS: Part[] = [
  {
    id: 'I',
    title: 'Cellular Foundations',
    gist: 'What a cell is wrapped in, and why that wrapping can hold a charge.',
  },
  {
    id: 'II',
    title: 'Ion Channels & Electrical Signalling',
    gist: 'The doors in the wall, how we know they are there, and the spark they make.',
  },
  {
    id: 'III',
    title: 'Synaptic Communication',
    gist: 'How one neuron says something to the next one across a gap.',
  },
  {
    id: 'IV',
    title: 'Neurotransmitters & Modulation',
    gist: 'The different chemicals a neuron can speak with, and how they change the mood of a whole network.',
  },
  {
    id: 'V',
    title: 'Plasticity & Learning',
    gist: 'How a connection gets stronger or weaker — which is what learning is made of.',
  },
  {
    id: 'VI',
    title: 'Neural Circuits',
    gist: 'What happens when many neurons are wired together.',
  },
  {
    id: 'VII',
    title: 'Brain Systems',
    gist: 'From a crowd of cells to seeing, wanting and remembering.',
  },
]

/** Where an entry lands. `zoom` is a zoom-target id or null for the whole
 *  cell; `drawer` is a drawer exhibit or null for "just be there". `then` is
 *  the odd one out — a named side effect for the two entries that are a MODE
 *  rather than a place. */
export interface Destination {
  zoom: string | null
  drawer:
    | 'balance'
    | 'train'
    | 'lipid'
    | 'permea'
    | 'capacitor'
    | 'channel'
    | 'filter'
    | 'patch'
    | 'gating'
    | 'scales'
    | null
  then?: 'race'
}

export interface Entry {
  id: string
  part: PartId
  /** The lecture this belongs to, where the course names one. Entries the
   *  course does not name carry the lecture they sit closest to, so the
   *  ordering still follows the syllabus. */
  lecture: number
  /** Named for the concept, addressed to the adult (Who reads what). */
  title: string
  /** For the kid, who does not read the title. */
  icon: string
  /** The question this answers, in a child's words — read aloud, or shown as
   *  the row's second line. */
  asks: string
  to: Destination
  /** True where the course does not name this, and the app added it. */
  extra?: boolean
}

export const ENTRIES: Entry[] = [
  // ── Part I ───────────────────────────────────────────────────────────────
  {
    id: 'whole-cell',
    part: 'I',
    lecture: 1,
    title: 'The neuron, whole',
    icon: '🧠',
    asks: 'What does one of these actually look like, and which end is which?',
    to: { zoom: null, drawer: null },
    extra: true,
  },
  {
    id: 'lipid',
    part: 'I',
    lecture: 1,
    title: 'The phospholipid bilayer',
    icon: '🫧',
    asks: 'What is the wall made of, and what holds it together with no glue?',
    to: { zoom: 'dendrite-membrane', drawer: 'lipid' },
  },
  {
    id: 'permea',
    part: 'I',
    lecture: 1,
    title: 'Membrane permeability',
    icon: '🫗',
    asks: 'What gets through a bare wall, and what decides?',
    to: { zoom: 'dendrite-membrane', drawer: 'permea' },
  },
  {
    id: 'capacitor',
    part: 'I',
    lecture: 2,
    title: 'Membrane charge & capacitance',
    icon: '🧲',
    asks: 'How few ions does it take to make the voltage?',
    to: { zoom: 'dendrite-membrane', drawer: 'capacitor' },
  },

  // ── Part II ──────────────────────────────────────────────────────────────
  {
    id: 'channel',
    part: 'II',
    lecture: 3,
    title: 'Ion channel structure',
    icon: '🚪',
    asks: 'What is a door in the wall built out of?',
    to: { zoom: 'dendrite-membrane', drawer: 'channel' },
  },
  {
    id: 'filter',
    part: 'II',
    lecture: 3,
    title: 'Inside the selectivity filter',
    icon: '⚛️',
    asks: 'Why does the small ion get turned away and the big one let through?',
    to: { zoom: 'dendrite-membrane', drawer: 'filter' },
  },
  {
    id: 'gating',
    part: 'II',
    lecture: 3,
    title: 'Ion channel types',
    icon: '🎛️',
    asks: 'What actually makes a door in the wall open?',
    to: { zoom: 'dendrite-membrane', drawer: 'gating' },
  },
  {
    id: 'patch',
    part: 'II',
    lecture: 4,
    title: 'Patch clamp recording',
    icon: '🔬',
    asks: 'How does anybody know any of this is true?',
    to: { zoom: 'dendrite-membrane', drawer: 'patch' },
  },
  {
    id: 'resting',
    part: 'II',
    lecture: 5,
    title: 'Resting membrane potential',
    icon: '🔋',
    asks: 'Why is a cell already charged up before anything happens?',
    to: { zoom: 'dendrite-membrane', drawer: null },
  },
  // "Change one thing" (X01) had a row of its own here and was removed: its
  // destination was character for character the resting-potential row's, so
  // the menu offered two ways to do exactly the same thing (caught by the
  // no-duplicate-destinations test, 2026-08-28). It is not a view — it is
  // what you DO once you are at a patch, with the steppers that are already
  // there. A menu names places, not gestures.
  {
    id: 'balance',
    part: 'II',
    lecture: 5,
    title: 'Equilibrium potential',
    icon: '⚖️',
    asks: 'Where does an ion stop caring about its own crowd?',
    to: { zoom: 'dendrite-membrane', drawer: 'balance' },
  },
  {
    id: 'action-potential',
    part: 'II',
    lecture: 6,
    title: 'The action potential',
    icon: '⚡',
    asks: 'What happens, step by step, when a nerve fires?',
    to: { zoom: 'axon-membrane', drawer: null },
  },
  {
    id: 'train',
    part: 'II',
    lecture: 6,
    title: 'Spike trains & the refractory period',
    icon: '📈',
    asks: 'What if I press it again straight away?',
    to: { zoom: 'axon-membrane', drawer: 'train' },
  },
  {
    id: 'propagation',
    part: 'II',
    lecture: 7,
    title: 'Axonal conduction',
    icon: '🌊',
    asks: 'How does the spark get all the way to the other end?',
    to: { zoom: 'axon-signal', drawer: null },
  },
  {
    id: 'myelin',
    part: 'II',
    lecture: 7,
    title: 'Myelin & saltatory conduction',
    icon: '🏁',
    asks: 'Why is a wrapped nerve so much faster than a bare one?',
    to: { zoom: 'axon-signal', drawer: null, then: 'race' },
  },
  {
    id: 'tour',
    part: 'II',
    lecture: 7,
    title: 'Trace one signal',
    icon: '🔦',
    asks: 'Can I follow ONE signal the whole way, without losing it?',
    to: { zoom: null, drawer: 'scales' },
    extra: true,
  },
]

export const entriesIn = (part: PartId): Entry[] =>
  ENTRIES.filter((e) => e.part === part).sort((a, b) => a.lecture - b.lecture)

/** What a Part with nothing built in it says. ONE claim about what the app
 *  contains, interpolated from the one place that claim is allowed to live. */
export function notBuiltYet(): string {
  return `Not built yet. The app reaches as far as ${FRONTIER_SHORT} — everything past that is still being made.`
}

/** Every entry a child can actually reach, in course order. */
export const inCourseOrder = (): Entry[] =>
  PARTS.flatMap((p) => entriesIn(p.id))
