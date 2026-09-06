// S14 — CLEARANCE & RECYCLING: the model behind the drawer.
//
// ⚠ WHAT THIS DRAWER OWNS, AFTER A CORRECTION (21c-4c, user 2026-09-06: "how
// different is this view from the big view? … If it's a copy, why recreate
// instead of zooming in the big view?").
//
// It began as five legs. Legs 1 and 2 — the gap emptying, and the wall's
// ledger — were built and then DELETED, because the user was right: measured,
// they drew the same scene through the same function, 1.6× in where the big
// view's own 🔍 active-zone place already goes 4× in, and gave that stretch
// 13.6 s of screen where the big view already gives it 19.4 s. A zoomed,
// faster, wordless copy of a place the app already has. This project's own rule
// names it — a drawer rebuilding the app's furniture is evidence it should be a
// place — and this is the SECOND time the trap has been fallen into here (D17,
// 2026-09-04).
//
// What is left is what the big view CANNOT do, because it needs a choice the
// child makes and a comparison one run cannot play:
//
//   • RETRIEVAL, three ways — kiss-and-run, clathrin-mediated, ultrafast.
//   • (planned) the pools, and what a train of spikes costs.
//
// The big view shows ONE of these — full collapse and a slow re-forming — and
// says nothing about the other two, nor about the fact that they are debated.

/** ⚠ HOW MANY MOLECULES ONE VESICLE HOLDS. Order of magnitude, and stated as
 *  one: estimates for a small central synapse run ~2,000–4,000. */
export const RELEASED_PER_VESICLE = 3000

/** ⚠ REAL SIZES, so what the wall owes is a fact and not a flourish. A small
 *  synaptic vesicle is about 40 nm across; a small central bouton about 1 µm. */
export const VESICLE_NM = 40
export const BOUTON_NM = 1000

const areaOf = (diameterNm: number): number => Math.PI * diameterNm * diameterNm

export const VESICLE_AREA_NM2 = areaOf(VESICLE_NM)
export const BOUTON_AREA_NM2 = areaOf(BOUTON_NM)

/** ⚠ WHAT ONE FUSION COSTS THE WALL, as a share of the terminal's own surface —
 *  measured from the two sizes, not typed: ~0.16%. Small, and that is the
 *  point, because a train of them is not. It is why retrieval exists at all,
 *  and every route below gives back exactly this much. */
export const ADDED_PER_FUSION = VESICLE_AREA_NM2 / BOUTON_AREA_NM2

/** How many fusions swell the wall by a tenth — solved, not asserted. */
export const FUSIONS_TO_TENTH = Math.ceil(0.1 / ADDED_PER_FUSION)

export type RetrievalId = 'kiss' | 'clathrin' | 'ultrafast'

export interface RetrievalStage {
  id: string
  title: string
  watch: string
  share: number
}

export interface Retrieval {
  id: RetrievalId
  /** The button's name. A name, not a sentence. */
  label: string
  /** The button's picture, for the child who does not read it. */
  icon: string
  /** ⚠ HOW LONG IT REALLY TAKES, seconds. The three differ by more than a
   *  tenfold, and that is the most interesting thing about them. */
  realS: number
  /** Whether the bubble ever flattens into the wall. */
  collapses: boolean
  what: string
  stages: RetrievalStage[]
}

/** ⚠ THE THREE ROUTES, AND THE DEBATE SHOWN (21c-4c). The feature spec's own
 *  note says "kiss-and-run vs full-collapse retrieval is debated; pick
 *  full-collapse and say so" — the SNARE bench picks it and says so. This is
 *  where the other two get drawn, because a debate a child is told about but
 *  never shown is a debate they cannot think about.
 *
 *  ⚠ The times are real, and are the honest kind of estimate: kiss-and-run on
 *  the order of a second; ultrafast endocytosis takes tens of milliseconds for
 *  the pit itself, with seconds more for its endosome to resolve; clathrin
 *  takes tens of seconds. Every one gives back exactly one vesicle's worth of
 *  membrane, which is the thing they have in common. */
export const RETRIEVALS: Retrieval[] = [
  {
    id: 'kiss',
    label: 'Kiss-and-run',
    icon: '💋',
    realS: 1,
    collapses: false,
    what: 'The bubble never opens up. It touches the wall, makes a hole barely wider than one molecule, lets its cargo out through it, shuts the hole again and leaves whole. Nothing has to be built and nothing has to be taken apart — which is why it is the quick one.',
    stages: [
      {
        id: 'touch',
        title: 'It touches',
        watch: 'The bubble meets the wall and stays round. Nothing flattens.',
        share: 0.2,
      },
      {
        id: 'pore',
        title: 'A tiny hole',
        watch: 'A hole opens — just wide enough for the chemical to slip out one at a time.',
        share: 0.3,
      },
      {
        id: 'shut',
        title: 'The hole shuts',
        watch: 'The hole closes again. The bubble kept its own skin the whole time.',
        share: 0.2,
      },
      {
        id: 'go',
        title: 'It leaves whole',
        watch: 'Off it goes, ready to be filled again. Nothing was taken apart.',
        share: 0.3,
      },
    ],
  },
  {
    id: 'clathrin',
    label: 'Clathrin-mediated endocytosis',
    icon: '🧺',
    realS: 15,
    collapses: true,
    what: 'The bubble opens right up and its skin becomes part of the wall. To get it back, a basket of protein called clathrin is built on the wall, a ring called dynamin squeezes the neck until it snaps, and then the basket is taken off again. Three things to build and one to take apart — which is why it is the slow one.',
    stages: [
      {
        id: 'flat',
        title: 'It flattens out',
        watch: 'The bubble opens right up. Its skin is part of the wall now.',
        share: 0.22,
      },
      {
        id: 'coat',
        title: 'A basket is built',
        watch: 'Clathrin gathers on the wall and curls it back into a bud.',
        share: 0.3,
      },
      {
        id: 'pinch',
        title: 'A ring squeezes',
        watch: 'Dynamin wraps the neck and snaps it. The bubble is free.',
        share: 0.26,
      },
      {
        id: 'strip',
        title: 'The basket comes off',
        watch: 'The basket is pulled apart and the bubble is a bubble again.',
        share: 0.22,
      },
    ],
  },
  {
    id: 'ultrafast',
    label: 'Ultrafast endocytosis',
    icon: '🌀',
    realS: 5,
    collapses: true,
    what: 'The bubble opens up, and beside the busy patch the wall simply dents inwards and swallows a big piece of itself — far bigger than one bubble. That happens in about a tenth of a second. New bubbles then bud off the swallowed blob inside the cell, which is the part that takes seconds.',
    stages: [
      {
        id: 'flat',
        title: 'It flattens out',
        watch: 'The bubble opens right up, the same as before.',
        share: 0.2,
      },
      {
        id: 'dent',
        title: 'The wall dents',
        watch: 'Just beside the busy patch the wall pushes inwards — a big dent, not a small one.',
        share: 0.28,
      },
      {
        id: 'gulp',
        title: 'A big gulp',
        watch: 'The dent pinches right off. One big blob, in a tenth of a second.',
        share: 0.24,
      },
      {
        id: 'bud',
        title: 'Bubbles bud off',
        watch: 'Small bubbles pinch off the blob inside the cell — that part takes seconds.',
        share: 0.28,
      },
    ],
  },
]

export const retrievalOf = (id: RetrievalId): Retrieval =>
  RETRIEVALS.find((r) => r.id === id) ?? RETRIEVALS[0]

/** Where each stage of a route begins and ends, 0→1 — derived from its shares
 *  so the two can never disagree. */
export function stageSpans(r: Retrieval): { id: string; from: number; to: number }[] {
  const total = r.stages.reduce((s, x) => s + x.share, 0)
  let at = 0
  return r.stages.map((s) => {
    const from = at
    at += s.share / total
    return { id: s.id, from, to: at }
  })
}

/** Which stage a position is in, and how far through it. */
export function retrievalStageAt(
  r: Retrieval,
  u: number,
): { stage: RetrievalStage; local: number; index: number } {
  const spans = stageSpans(r)
  const t = Math.max(0, Math.min(1, u))
  for (const [i, span] of spans.entries()) {
    if (t < span.to || i === spans.length - 1) {
      const w = Math.max(1e-9, span.to - span.from)
      return {
        stage: r.stages[i],
        local: Math.max(0, Math.min(1, (t - span.from) / w)),
        index: i,
      }
    }
  }
  return { stage: r.stages[0], local: 0, index: 0 }
}

// ── the words ───────────────────────────────────────────────────────────────

export const RETRIEVAL_PARTS: { icon: string; text: string }[] = [
  {
    icon: '🫧',
    text: 'Every bubble that opens hands its skin to the wall of the terminal. The wall would get bigger and bigger — so the terminal takes exactly that much skin back, and makes a new bubble out of it.',
  },
  {
    icon: '🔀',
    text: 'There is more than one way to do that, and scientists still argue about which one happens when. Press the buttons to watch each way. They all give back the same amount of skin — they just take very different amounts of time.',
  },
  {
    icon: '💋',
    text: 'Kiss-and-run is the quick one, about a second: the vesicle never opens up, so there is nothing to rebuild.',
  },
  {
    icon: '🧺',
    text: 'Clathrin-mediated endocytosis is the slow one, ten or twenty seconds: a clathrin basket has to be built, a dynamin ring has to squeeze, and then the basket has to come off again.',
  },
]

export const RETRIEVAL_HONESTY: { icon: string; text: string }[] = [
  {
    icon: '⚖️',
    text: 'Which route a synapse really uses, and when, is genuinely argued about. The vesicle bench next door shows the full-collapse one because it has to pick one; this is where the others get shown.',
  },
  {
    icon: '⏱️',
    text: `Each way is played at the same speed here so you can compare the shapes. In real life kiss-and-run takes about ${RETRIEVALS[0].realS} second, ultrafast endocytosis about ${RETRIEVALS[2].realS}, and clathrin-mediated endocytosis about ${RETRIEVALS[1].realS}.`,
  },
  {
    icon: '📐',
    text: `The sizes are real: a bubble about ${VESICLE_NM} nm across, a terminal about ${BOUTON_NM / 1000} µm. One bubble adds ${(ADDED_PER_FUSION * 100).toFixed(2)}% to the wall — about ${FUSIONS_TO_TENTH} of them would make it a tenth bigger.`,
  },
  {
    icon: '🔢',
    text: `A real bubble holds roughly ${RELEASED_PER_VESICLE.toLocaleString()} molecules. A handful of balls are drawn instead, because you cannot follow three thousand of anything.`,
  },
]
