import { ION_KINDS, restingCounts, type IonKind } from './ions'
import { BACKGROUND, membraneVoltageFrom, nernstMv } from './voltage'
import { REST_MV } from './capacitor'
import type { TeachingPara } from './neuron'

// D16 — WHERE THE RESTING POTENTIAL COMES FROM. Build the wall; read the answer.
//
// ⚠ WHY THIS EXHIBIT EXISTS, and why it is not the two next to it.
//
// The app already shows a single ion's equilibrium (⚖️) and the sliver of
// charge a voltage physically IS (⚡). Neither answers the question a child
// actually asks at rest: why THIS number, and why negative?
//
// The answer is a weighted average, and it is the one real equation here:
//
//     V = Σ gᵢ·Eᵢ / Σ gᵢ
//
// Every ion has a voltage it would be content at — its Nernst voltage — and
// the membrane settles at the average of those, weighted by HOW EASILY EACH
// CAN ACTUALLY CROSS. The resting potential is not a property of the membrane
// or of the pump. It is a vote, and the doors are the votes.
//
// ⚠ AND THAT IS WHY "no channels, ions attracted and repelled" WAS DECLINED
// (2026-08-30). Ions cannot cross a bare bilayer at all, and no arrangement of
// attraction across a wall produces a resting potential. Take the doors away
// and there is nothing to look at. The doors ARE the exhibit — which is also
// why the child now BUILDS the wall rather than picking a preset: the thing
// worth doing is the thing the exhibit is about (this is D14's grammar).

/** The wall the child has built: how many leak doors of each kind. */
/** The kinds of leak door the tray holds. Chloride is one of them now, so the
 *  ion that has a say without a door can be given one (user, 2026-08-30). */
export type DoorKind = 'k' | 'cl' | 'na'

export interface Doors {
  k: number
  cl: number
  na: number
}

/** One leak channel's worth of conductance — the unit `BACKGROUND` is already
 *  quoted relative to, so the two are on one scale by construction. */
export const DOOR_G = 1

/** How many doors fit in the wall before it stops being a picture. */
export const MAX_DOORS = 8

/** What a real neuron's patch has, near enough: one potassium door's worth of
 *  leak against the background. NOT a taste — it is the wall that lands the
 *  membrane on the resting voltage the rest of the app already commits to, and
 *  a test pins the two together. */
export const REAL_WALL: Doors = { k: 1, cl: 0, na: 0 }

export const EMPTY_WALL: Doors = { k: 0, cl: 0, na: 0 }

/** How easily each ion can cross this wall. The background is real membrane
 *  leak the app already commits to — every membrane leaks a little of
 *  everything — and it is what stops a resting cell sitting exactly on
 *  potassium's own voltage. */
export function conductancesOf(doors: Doors): Record<IonKind, number> {
  const g = {} as Record<IonKind, number>
  for (const ion of ION_KINDS) g[ion] = BACKGROUND[ion] ?? 0
  g.k += Math.max(0, doors.k) * DOOR_G
  g.cl += Math.max(0, doors.cl) * DOOR_G
  g.na += Math.max(0, doors.na) * DOOR_G
  return g
}

/** The voltage each ion would be content at, given the app's concentrations. */
export function contentAt(ion: IonKind): number {
  return nernstMv(ion, restingCounts())
}

/** Where this membrane settles — the weighted average, from the same function
 *  the spike is drawn from. MEASURED off the model, never asserted. */
export function restingMvOf(doors: Doors): number {
  return membraneVoltageFrom(restingCounts(), conductancesOf(doors))
}

/** Each ion's share of the vote, 0→1 — its weight in the average, which is the
 *  thing the picture has to show. */
export function shareOf(doors: Doors, ion: IonKind): number {
  const g = conductancesOf(doors)
  const total = ION_KINDS.reduce((sum, k) => sum + g[k], 0)
  return total === 0 ? 0 : g[ion] / total
}

/** The three ions with a say, in the order they sit on the scale. */
export const VOTERS: IonKind[] = ['k', 'cl', 'na']

/** How much of an ion's say comes from LEAK THE MEMBRANE HAS ANYWAY, with no
 *  door drawn for it, 0→1 of that ion's own share.
 *
 *  ⚠ THIS IS THE ANSWER TO "why is chloride in the sum when there is no
 *  chloride channel on the wall" (user, 2026-08-30). Every real membrane is a
 *  little bit permeable to everything, through channels too numerous and too
 *  varied to draw — and for chloride that background is large (0.45 of one
 *  door's worth against sodium's 0.1). So chloride can be most of the vote
 *  with nothing standing in the wall, which looks like a number from nowhere
 *  unless the picture says where it comes from. It is drawn: the part of each
 *  ion's bar that comes from background is paler than the part its doors
 *  earned, and there is now a chloride door in the tray so the child can give
 *  it a way through of its own and watch its share grow. */
export function backgroundPartOf(doors: Doors, ion: IonKind): number {
  const g = conductancesOf(doors)
  if (g[ion] <= 0) return 0
  return (BACKGROUND[ion] ?? 0) / g[ion]
}

/** The two ends of the scale, so what the needle moves between is the ions'
 *  own voltages rather than round numbers. */
export function tugEnds(): { from: number; to: number } {
  return { from: contentAt('k'), to: contentAt('na') }
}

/** Where a voltage sits between potassium's end and sodium's, 0→1. */
export function alongTug(mv: number): number {
  const { from, to } = tugEnds()
  return Math.max(0, Math.min(1, (mv - from) / (to - from)))
}

/** How far from a real neuron's resting voltage counts as "the same". */
export const SAME_MV = 6

export type StateWord = 'Hyperpolarised' | 'Resting' | 'Depolarised'

/** What to call where this membrane sits.
 *
 *  ⚠ ANCHORED TO A REAL NEURON, DELIBERATELY (2026-08-30). These words are
 *  defined RELATIVE TO A CELL'S OWN RESTING POTENTIAL and describe a cell that
 *  has been moved off it — so used bare here they would teach something false:
 *  a wall built with sodium doors is not a depolarised neuron, it is a
 *  different membrane RESTING at a different voltage. The child has changed
 *  what rest means, not pushed a cell off it.
 *
 *  The words stay, because they are the right words and the ones a lecture
 *  uses. What is added is what they are measured against. */
export function stateOf(doors: Doors): {
  word: StateWord
  mv: number
  fromReal: number
  line: string
} {
  const mv = restingMvOf(doors)
  const fromReal = mv - REST_MV
  const word: StateWord =
    Math.abs(fromReal) <= SAME_MV
      ? 'Resting'
      : fromReal < 0
        ? 'Hyperpolarised'
        : 'Depolarised'
  const at = `${mv > 0 ? '+' : '−'}${Math.abs(mv).toFixed(0)} mV`
  const line =
    word === 'Resting'
      ? `this membrane rests at ${at} — where a real cell sits`
      : `this membrane rests at ${at} — ${Math.abs(fromReal).toFixed(0)} mV ${
          fromReal < 0 ? 'below' : 'above'
        } a real cell`
  return { word, mv, fromReal, line }
}

export const RESTING_PARTS: TeachingPara[] = [
  {
    icon: '🪑',
    text: 'A cell that is doing nothing at all is still charged up — about seventy thousandths of a volt, inside negative. This is where that number comes from, and it is not the number that matters. It is WHY.',
  },
  {
    icon: '⚖️',
    text: 'Every ion has a voltage it would be happy at — the one where its crowd and the charge pull equally hard, which is the balance bench next door. Potassium would be happy a long way negative. Sodium would be happy a long way positive. Chloride, in between. They cannot all have their way.',
  },
  {
    icon: '🚪',
    text: 'So the membrane takes a VOTE, and the votes are DOORS. Every ion with a way through gets a say, and the more doors it has, the louder it is. A real cell is full of potassium doors and has almost none for sodium — so the answer comes out close to what potassium wanted.',
  },
  {
    icon: '👆',
    text: 'Build a wall and see. Drag doors in, drag them out again. Nothing else on this screen changes — same ions, same crowds, same wall. Only who has a way through, and the answer moves every time you change it.',
  },
  {
    icon: '🫗',
    text: 'Try taking EVERY potassium door out. The cell does not go to zero — it drifts to about forty below, because chloride is still quietly leaking through and now chloride is the loudest voice left. That is what chloride was doing all along.',
  },
  {
    icon: '🕳️',
    text: 'And that is the thing to notice about chloride: it has a say even with no chloride door in the wall. Every real membrane is slightly leaky to everything, through doors too many and too varied to draw — and for chloride that leak is big. On the bar at the bottom, the PALER part of each colour is leak like that, and the solid part is what the doors you placed earned. Put a chloride door in and watch its solid part grow.',
  },
  {
    icon: '🔌',
    text: 'And notice what is NOT here: no battery, and no pump. The pump built these crowds and it is not in the sum at all. What sets the resting voltage is which doors are open — nothing else.',
  },
]

export function restingRightNow(doors: Doors): TeachingPara[] {
  const st = stateOf(doors)
  const kShare = Math.round(shareOf(doors, 'k') * 100)
  const naShare = Math.round(shareOf(doors, 'na') * 100)
  const clShare = Math.round(shareOf(doors, 'cl') * 100)
  return [
    {
      icon: '🔋',
      text: `${st.word}: ${st.line}. Potassium would be happy at ${contentAt('k').toFixed(0)} mV, chloride at ${contentAt('cl').toFixed(0)} mV, sodium at +${contentAt('na').toFixed(0)} mV.`,
    },
    {
      icon: '🚪',
      text: `${doors.k} potassium door${doors.k === 1 ? '' : 's'}, ${doors.cl} chloride and ${doors.na} sodium in this wall. That gives potassium ${kShare}% of the vote, chloride ${clShare}% and sodium ${naShare}% — and the voltage is the average of what each one wanted, weighted exactly like that.`,
    },
  ]
}

export const RESTING_HONESTY: TeachingPara[] = [
  {
    icon: '🧮',
    text: `CALIBRATED: the happy voltages are Nernst's equation on the concentrations this app already declares, and the answer is the chord-conductance equation — the same one the action potential is drawn from. Nothing is typed in: change a concentration anywhere and these move.`,
  },
  {
    icon: '💧',
    text: `NOT DRAWN AS DOORS: every real membrane leaks a little of everything even where no channel is drawn, and that background leak is in the sum. It is why chloride has a say here without a door of its own, and why a resting cell sits a few millivolts above potassium's own voltage instead of exactly on it.`,
  },
  {
    icon: '🏷️',
    text: `THE WORDS ARE MEASURED AGAINST A REAL CELL. "Hyperpolarised" and "depolarised" describe a cell moved away from ITS OWN resting voltage — so strictly, a wall you have built with different doors is not a depolarised neuron, it is a different membrane resting somewhere else. That is why the label always says what it is comparing with.`,
  },
  {
    icon: '🚫',
    text: 'THE PUMP IS NOT IN THIS EQUATION, and that surprises most people. It built the crowds Nernst reads, so without it there would be nothing to average — but it does not appear in the sum, and switching it off does not move the resting voltage until the crowds themselves start to run down.',
  },
  {
    icon: '🔢',
    text: `THE DOOR COUNTS ARE THE APP'S OWN, not a measurement: one potassium door against the declared background lands the cell on the resting voltage the rest of the app commits to, and everything else is that wall with more doors. A real membrane is counted in thousands of channels per square micrometre.`,
  },
]
