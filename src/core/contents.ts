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
// ⚠ IT LISTS WHAT IS PLANNED AS WELL AS WHAT EXISTS (user, 2026-08-31: "based
// on the feature specs, fill in the app menu sub-items. Make them inactive. I
// need a better visual overview of what's planned").
//
// This reverses a rule of this file's own, and the reasoning that rule carried
// is kept rather than thrown away. It said: "a menu of greyed-out promises
// teaches that the app is mostly empty, and it would be a second place where a
// claim about what the app contains could rot". Both halves are answered:
//
//   • **Mostly empty.** A planned row is visibly a different kind of thing —
//     dim, not clickable, tagged `planned` — so the menu says "this is coming",
//     which is a different message from "this is here and broken". The user
//     asked for the overview and that is a product decision, not a science one.
//   • **A claim that could rot.** A planned row makes NO claim about what the
//     app contains; it claims what the SPEC contains. The one claim about what
//     exists is still `FRONTIER`, still interpolated, and a test now pins the
//     two apart: nothing may be listed as planned that is also reachable, and
//     every planned row must be missing a destination rather than merely
//     disabled in the markup.
//
// Rows here are subject to change, as the plan is (the user said so). They are
// sourced from `docs/01-feature-spec.md`, whose IDs each row carries.

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
    | 'resting'
    | 'leaky'
    | 'channel'
    | 'filter'
    | 'patch'
    | 'gating'
    | 'scales'
    | 'snare'
    | 'reuptake'
    | null
  then?: 'race'
}

export interface Entry {
  id: string
  /** The feature-spec ID this row comes from — N23, D06, C01… Present on the
   *  planned rows so a row and its spec entry can be checked against each
   *  other by eye; the built ones predate the convention. */
  spec?: string
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
  /** Where the row goes — `null` for a planned row, which goes nowhere. It is
   *  null rather than a disabled flag on purpose: a planned row must be
   *  UNABLE to navigate, not merely discouraged from it. */
  to: Destination | null
  /** True where the course does not name this, and the app added it. */
  extra?: boolean
  /** Named in the spec, not built. Rendered like a real row and inert. */
  planned?: true
}

/** A row that goes somewhere. Narrower than `Entry` so every reader of
 *  `ENTRIES` still gets a destination it does not have to null-check — the
 *  planned rows live in their own list, and only the two places that render or
 *  navigate see the union. */
export type BuiltEntry = Entry & { to: Destination }

/** A planned row, from the feature spec. Short-hand because there are many of
 *  them and every one has the same two dead fields. */
const soon = (
  spec: string,
  part: PartId,
  lecture: number,
  icon: string,
  title: string,
  asks: string,
): Entry => ({
  id: `soon-${spec.toLowerCase()}`,
  spec,
  part,
  lecture,
  icon,
  title,
  asks,
  to: null,
  planned: true,
})

/** Everything the spec names and the app has not built. Ordered within each
 *  Part by the lecture it belongs to, exactly like the built rows, so a Part
 *  reads as one list rather than as two. */
export const PLANNED: Entry[] = [
  // ── Part I — Cellular Foundations
  soon(
    'D14',
    'I',
    2,
    '🧰',
    'Membrane constructor',
    'Can I build my own membrane and see what it can do?',
  ),

  // ── Part II — Ion Channels & Electrical Signalling
  soon(
    'X03',
    'II',
    6,
    '🚫',
    'Channel blockers',
    'What happens to the spark if I block one kind of door?',
  ),
  soon(
    'N23',
    'II',
    7,
    '🌿',
    'Dendritic spikes',
    'Can a dendrite make a spark of its own?',
  ),

  // ── Part III — Synaptic Communication
  soon(
    'S13',
    'III',
    9,
    '🎯',
    'The synapse: receptors to the hillock',
    'What does the next neuron feel, and where does that feeling go?',
  ),
  soon(
    'D07',
    'III',
    9,
    '🔩',
    'AMPA & NMDA receptors, close up',
    'What do the catchers look like, and why does one need TWO things at once?',
  ),
  soon(
    'D08',
    'III',
    9,
    '⏱️',
    'Receptor kinetics bench',
    'Why is one catcher fast and the other slow?',
  ),
  soon(
    'S14',
    'III',
    10,
    '🧹',
    'The synapse: clearance & recycling',
    'Who cleans the gap up afterwards, and where do the bubbles come from?',
  ),
  soon('D11', 'III', 10, '🖼️', 'Synapse gallery', 'Are all synapses the same shape?'),

  // ── Part IV — Neurotransmitters & Modulation
  soon(
    'D09',
    'IV',
    11,
    '⚖️',
    'Glutamate & GABA, side by side',
    'Why does one chemical excite and the other calm — when they are almost the same molecule?',
  ),
  soon(
    'M05',
    'IV',
    11,
    '🧪',
    'Acetylcholine & the nicotinic receptor',
    'What tells a muscle to move?',
  ),
  soon(
    'M04',
    'IV',
    12,
    '🌀',
    'Dopamine & the slow receptors',
    'What does a chemical do when it does NOT open a door?',
  ),
  soon(
    'M07',
    'IV',
    12,
    '🔗',
    'Second-messenger cascade',
    'How does one molecule outside change a whole cell inside?',
  ),
  soon(
    'D10',
    'IV',
    12,
    '💊',
    'Benzodiazepine bench',
    'How can a drug make a door open more often without opening it itself?',
  ),
  soon(
    'M06',
    'IV',
    13,
    '🎚️',
    'Neuromodulation across a network',
    'Can one chemical change the mood of a whole crowd of neurons?',
  ),

  // ── Part V — Plasticity & Learning
  soon(
    'P03',
    'V',
    14,
    '🔁',
    'Post-tetanic potentiation',
    'Why is the next signal bigger just after a burst?',
  ),
  soon(
    'P04',
    'V',
    14,
    '📈',
    'Long-term potentiation',
    'How does a connection get stronger and STAY stronger?',
  ),
  soon(
    'P05',
    'V',
    15,
    '📉',
    'Long-term depression',
    'How does a connection get weaker again?',
  ),
  soon(
    'P02',
    'V',
    15,
    '🎓',
    'Learning by repetition',
    'What actually changes in a brain when you practise something?',
  ),

  // ── Part VI — Neural Circuits
  soon(
    'C01',
    'VI',
    16,
    '🔌',
    'Two neurons connected',
    'What happens when one neuron talks to another?',
  ),
  soon(
    'C02',
    'VI',
    16,
    '⛓️',
    'A chain of neurons',
    'How does a message get passed along a line?',
  ),
  soon(
    'C03',
    'VI',
    17,
    '🛑',
    'Inhibition in a circuit',
    'How does one neuron tell another to be QUIET?',
  ),
  soon(
    'C04',
    'VI',
    17,
    '♻️',
    'A feedback loop',
    'What happens when a signal comes back round to where it started?',
  ),
  soon('C06', 'VI', 18, '🎮', 'Circuit challenge', 'Can I make neuron B fire?'),

  // ── Part VII — Brain Systems
  soon(
    'B01',
    'VII',
    19,
    '🧠',
    'The whole brain',
    'Where in a head does all of this happen?',
  ),
  soon('B02', 'VII', 19, '🗺️', 'Brain regions', 'Which bit does which job?'),
  soon(
    'B06',
    'VII',
    20,
    '🦵',
    'The reflex arc',
    'Why does your leg kick before you have decided to?',
  ),
  soon(
    'B04',
    'VII',
    20,
    '👂',
    'A sensory pathway',
    'How does a touch on your hand get to your brain?',
  ),
  soon('B05', 'VII', 21, '🏃', 'A motor pathway', 'How does a thought get to your foot?'),
  soon(
    'B07',
    'VII',
    21,
    '🐁',
    'Brains compared',
    'Is a mouse brain just a small human one?',
  ),
]

export const ENTRIES: BuiltEntry[] = [
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
  // ⚠ TYPES, THEN STRUCTURE, THEN THE FILTER (user, 2026-08-30: "place 'ion
  // channel types' and 'ion channel structure' one after the other").
  //
  // They were separated by the filter close-up, which is the deepest of the
  // three and belongs last. This is also the order the app already drills in:
  // the types bench's magnifier opens the structure, and the structure's
  // magnifier opens the filter. Rows within one lecture keep the order they
  // are written in, so this list IS the order on screen.
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
    // ⚠ RENAMED (user, 2026-08-30: "rename 'RMP', as now it demos more").
    // The row used to name one state, and the exhibit behind it now covers all
    // three — build a wall of sodium doors and there is nothing resting about
    // the answer. A menu names the PLACE, and the place is the question.
    title: 'What sets the membrane voltage',
    icon: '🪑',
    asks: 'Why is a cell already charged up before anything happens?',
    // ⚠ It had no view of its own (user, 2026-08-30: "'Action Potential' and
    // 'Resting membrane potential' display the same view"). Both landed on a
    // bare membrane patch, and a menu row whose destination is another row's
    // picture is the duplicate this file already removed once.
    to: { zoom: 'dendrite-membrane', drawer: 'resting' },
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
  // ⚠ TWO ROWS MERGED INTO ONE (user, 2026-08-30: "'Axonal conduction' and
  // 'Myelin &…' open the same view, combine in one").
  //
  // They landed on the same camera with the same drawer; all that separated
  // them was that one started the race on arrival. That is not two places, and
  // a menu names places — the same reasoning that removed "Change one thing"
  // above. The merged row keeps the race, because the race IS the comparison:
  // arriving at a bare fibre and a wrapped one side by side without running
  // them is arriving at the question with the answer withheld.
  {
    id: 'leaky',
    part: 'II',
    lecture: 7,
    // ⚠ RENAMED (user, 2026-08-30: "we've agreed to use more precise terms.
    // 'How far a signal can reach' is not the one"). Every other row in this
    // list names the thing itself — "Equilibrium potential", "Patch clamp
    // recording", "Membrane charge & capacitance" — and a menu that mixes
    // named concepts with descriptions of them teaches that some of these have
    // names and some do not. This one is passive (electrotonic) spread, and
    // the quantity is the length constant.
    title: 'Passive spread & the length constant',
    icon: '🫗',
    asks: 'Why does a voltage fade as it spreads — and what does myelin change?',
    // ⚠ A PLACE NOW, NOT A DRAWER (user, 2026-08-31). The row used to fly to
    // the membrane patch and open a drawer over it, which said the exhibit was
    // a thought about the axon. It is a stretch of the axon, and the menu is an
    // index into the world — so it flies to the axon's second marker and stops.
    to: { zoom: 'axon-passive', drawer: null },
  },
  {
    id: 'synapse',
    part: 'III',
    lecture: 8,
    title: 'The synapse: arrival to binding',
    icon: '📨',
    asks: 'What happens in the gap the instant a signal arrives?',
    // A PLACE — the outgoing terminal, drawn from the user's own bouton.
    to: { zoom: 'outgoing-synapse', drawer: null },
  },
  {
    id: 'snare',
    part: 'III',
    lecture: 8,
    title: 'Vesicles & the SNARE machinery',
    icon: '🫧',
    asks: 'How does a bubble of chemical get out of the cell?',
    // A DRAWER, triggered from the view it deepens: the magnifier beside the
    // active zone on the synapse scene is its other door.
    to: { zoom: 'outgoing-synapse', drawer: 'snare' },
  },
  {
    id: 'reuptake',
    spec: 'D17',
    part: 'III',
    lecture: 12,
    title: 'Where the transmitter goes',
    icon: '♻️',
    asks: 'The gap is full of transmitter — who clears it up, and where does it go?',
    to: { zoom: 'outgoing-synapse', drawer: 'reuptake' },
  },
  {
    id: 'propagation',
    part: 'II',
    lecture: 7,
    title: 'Axonal conduction & myelin',
    icon: '🌊',
    asks: 'How does the spark get all the way along — and why is a wrapped nerve faster?',
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

/** Every row in a Part, built and planned together, in course order.
 *
 *  ⚠ ONE LIST, NOT TWO. The user asked for the planned rows to "look as similar
 *  to active chapters as the plan allows" — so they are sorted in among the
 *  built ones by the lecture they belong to rather than swept into a block at
 *  the bottom, which would read as a different menu. What separates them is how
 *  they LOOK and that they cannot be pressed. */
export const entriesIn = (part: PartId): Entry[] =>
  [...ENTRIES, ...PLANNED]
    .filter((e) => e.part === part)
    .sort((a, b) => a.lecture - b.lecture)

/** Just the rows that go somewhere. */
export const builtIn = (part: PartId): Entry[] =>
  entriesIn(part).filter((e) => !e.planned)

/** What a Part with nothing built in it says. ONE claim about what the app
 *  contains, interpolated from the one place that claim is allowed to live. */
export function notBuiltYet(): string {
  return `Not built yet. The app reaches as far as ${FRONTIER_SHORT} — everything past that is still being made.`
}

/** Every entry a child can actually reach, in course order. */
export const inCourseOrder = (): Entry[] => PARTS.flatMap((p) => builtIn(p.id))
