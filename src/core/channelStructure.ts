import { IONS } from './ions'
import type { TeachingPara } from './neuron'

// D03 — what a channel is actually built out of, and how a hole in a
// membrane can be pickier than a sieve could ever be.
//
// The channel anatomised is the VOLTAGE-GATED POTASSIUM channel, because it
// is the one that carries both of this exhibit's stories: the S4 voltage
// sensor (whose positive charges the schematic channel already wears as red
// marks) and the potassium selectivity filter, the best-solved structure of
// its kind in biology.
//
// Every number below is a measurement, and the two that matter most are
// already in this app's own ion table — which is where the paradox lives:
//
//   bare      Na⁺ 0.20 nm  <  K⁺ 0.28 nm     sodium is SMALLER
//   hydrated  Na⁺ 0.72 nm  >  K⁺ 0.66 nm     sodium is BIGGER
//
// A sieve would pass the smaller one. This filter passes the bigger one,
// about a thousand times more readily, and the reason is the second line: an
// ion arrives wearing water, and the filter only lets in an ion whose water
// it can replace exactly.

/** The four subunits of a potassium channel, arranged round the pore. */
export const SUBUNITS = 4

/** Transmembrane helices per subunit in a voltage-gated channel: S1–S6. */
export const HELICES = 6
/** How many of them a cross-section actually shows per subunit, and the
 *  reason the drawing was wrong until 2026-08-28: the classic textbook figure
 *  cuts through the pore module and you see THREE — the outer helix, the
 *  short pore helix behind it, and the inner helix lining the way through.
 *  We drew two, and had them mislabelled besides. */
export const HELICES_IN_SECTION = 3
/** The pore helix is not one of the six: it never crosses the membrane. It
 *  runs half way in from the outside and stops, and its far end points at the
 *  middle of the pore. */
export const PORE_HELIX = 'P'

/** Which of them is the voltage sensor. */
export const SENSOR_HELIX = 'S4'

/** Positive charges on one S4 helix — arginines, every third residue. */
export const SENSOR_CHARGES = 4

/** The narrowest part of the pore, nm: the selectivity filter. */
export const FILTER_NM = 0.3

/** Stacked ion-binding sites in the filter, each a cage of carbonyl oxygens. */
export const FILTER_SITES = 4

/** How much more readily this channel passes K⁺ than Na⁺ — measured, and the
 *  number the whole structure exists to produce. */
export const SELECTIVITY = 1000

export type Verdict = 'through' | 'turned-back'

/** What the filter does with an ion, and why — from the app's own radii.
 *
 *  The rule is not "is it small enough". It is: can the filter's own oxygens
 *  sit where this ion's water sat? They are spaced for potassium. Potassium
 *  therefore trades its water coat for the filter and slips through; sodium,
 *  which is smaller, cannot get close enough to those oxygens for them to pay
 *  for its coat — so it keeps the coat, and the coat does not fit. */
export function filterVerdict(kind: 'na' | 'k'): Verdict {
  return kind === 'k' ? 'through' : 'turned-back'
}

export function bareNm(kind: 'na' | 'k'): number {
  return IONS[kind].bareNm
}
export function hydratedNm(kind: 'na' | 'k'): number {
  return IONS[kind].hydratedNm
}

/** Does the BARE ion fit the filter? Both do — which is the point: fitting is
 *  not what decides. */
export function bareFits(kind: 'na' | 'k'): boolean {
  return bareNm(kind) <= FILTER_NM
}

/** Does the ion fit while still wearing its water? Neither does. */
export function hydratedFits(kind: 'na' | 'k'): boolean {
  return hydratedNm(kind) <= FILTER_NM
}

export const CHANNEL_PARTS: TeachingPara[] = [
  {
    icon: '4️⃣',
    text: `A channel is not a hole — it is a MACHINE, and this one is built of ${SUBUNITS} identical pieces standing in a ring, like four hands cupped together. Look down the pore in the second picture and you can count them. The gap they leave in the middle is the way through.`,
  },
  {
    icon: '🌀',
    text: `Each piece is a bundle of ${HELICES} coiled ribbons threaded through the membrane. One of them, ${SENSOR_HELIX}, carries ${SENSOR_CHARGES} POSITIVE charges of its own — those are the red marks the channels wear everywhere else in this app. Charges feel voltage, so when the membrane's voltage changes, ${SENSOR_HELIX} moves, and its moving is what opens the gate. That is the whole of "voltage-gated".`,
  },
  {
    icon: '🪃',
    text: `Cut the channel down the middle, the way the picture on the left does, and you see THREE ribbons on each side — not two. Furthest out is the ${SENSOR_HELIX} sensor. Then the outer helix. Then, tucked behind them, a SHORT one that does not go all the way through the wall at all: the pore helix. It runs half way in from the outside and stops, pointing its end at the middle of the channel. And that end is slightly negative — which is what makes the middle of a greasy wall a comfortable place for a positive ion to sit for a moment. Without it, no ion would ever park half way across.`,
  },
  {
    icon: '🧵',
    text: 'And the ribbons are not loose sticks — they are ONE STRING. Follow it with a finger: it climbs through the wall, loops over at the bottom, climbs again, and where it comes out at the top it turns round and dives back in. That dive is the PORE LOOP, and it is the selectivity filter. The pickiest part of the whole machine is just a fold in the string.',
  },
  {
    icon: '🚪',
    text: 'The gate itself is at the bottom, where the four pieces cross: shut, they pinch the passage closed; pulled apart, they let the queue through. Nothing pushes the ions — the gate only decides whether the way is open.',
  },
  {
    icon: '❓',
    text: `A fair question: if the sensor carries PLUS charges, and potassium is plus too, why is it not pushed away? Because those charges are not in the doorway. They sit out at the EDGES, in the four sensor parts, which are a different piece of the machine from the passage — look at the view from above and you can see the ring of them, well away from the middle. An ion travelling down the pore never goes near them.`,
  },
  {
    icon: '🧲',
    text: `And the passage itself does the opposite of pushing: it is lined with OXYGENS, and the face an oxygen turns inward carries a little bit of NEGATIVE charge. Those are the sky-blue marks along the way through. A positive ion is drawn IN by them — which is exactly what makes it worth taking its water coat off.`,
  },
  {
    icon: '🎯',
    text: `At the top is the SELECTIVITY FILTER, the narrowest stretch of all, barely ${FILTER_NM} nm across, with ${FILTER_SITES} places an ion can rest as it files through. Its walls are lined with oxygen atoms pointing inward — and the spacing of those oxygens is the entire trick.`,
  },
]

export function filterFacts(): TeachingPara[] {
  const na = IONS.na
  const k = IONS.k
  return [
    {
      icon: '💧',
      text: `In water no ion travels naked: each wears a COAT OF WATER MOLECULES — those are the little waters ringed around the ion in the picture, the same molecule you can fire at a bare wall in the permeability bench. And here is the surprise — sodium is the SMALLER ion (${na.bareNm} nm across against potassium's ${k.bareNm}), but it holds its water more tightly and ends up the BIGGER traveller (${na.hydratedNm} nm against ${k.hydratedNm}). A smaller charge packed into a smaller ball pulls harder on water.`,
    },
    {
      icon: '🔑',
      text: `Neither coat fits: the filter is ${FILTER_NM} nm and both coats are more than twice that. So an ion can only pass by taking the coat OFF, which costs energy — and the filter is what pays. Its oxygens sit exactly where potassium's water molecules sat, so potassium swaps one for the other and loses nothing.`,
    },
    {
      icon: '🚫',
      text: `Sodium cannot make that trade. It is smaller, so the filter's oxygens cannot close in far enough to replace its water — the payment falls short, the coat stays on, and the coat will not fit. The channel passes potassium about ${SELECTIVITY.toLocaleString('en-US')} times more readily than sodium, and it does it by being TOO WIDE for sodium to be paid for, not too narrow for sodium to enter.`,
    },
  ]
}

export const CHANNEL_HONESTY: TeachingPara[] = [
  {
    icon: '✂️',
    text: `SIMPLIFIED: a real subunit has ${HELICES} membrane-crossing helices plus the pore helix, and the cut-open picture draws four of them — the sensor, the outer helix, the pore helix and the inner one. The sensor drawn here stands in for the whole four-helix sensing bundle; S1, S2 and S3 are not drawn. Everything that IS drawn is where it really is.`,
  },
  {
    icon: '🎨',
    text: 'The four pieces are drawn as smooth shapes. A real one is a tangle of coiled ribbons folded into that shape — the outline here is honest, the smoothness is not.',
  },
  {
    icon: '📏',
    text: `Sizes are drawn to scale against the membrane: the filter really is about ${FILTER_NM} nm across in a wall 5 nm thick. The ions are drawn to the same ruler, so when a coat looks too big for the gap, it is too big.`,
  },
  {
    icon: '⏱️',
    text: 'The trip through is slowed enormously. A real potassium ion crosses in well under a millionth of a second, and a channel passes millions of them a second — a queue far too fast to watch.',
  },
  {
    icon: '🔬',
    text: 'And we know all this because these channels have been crystallised and photographed atom by atom. The shape here is a drawing of a real, measured structure, not a guess.',
  },
]
