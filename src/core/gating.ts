import type { TeachingPara } from './neuron'
import { REST_MV } from './capacitor'
import { dwellsFor, measuredPo, type Dwell } from './patchClamp'

// D04 — THE GATING FAMILIES. What actually opens a door.
//
// The app has been drawing gated channels since milestone 1 and saying
// "voltage-gated" and "ligand-gated" as if the words explained themselves.
// They do not. This bench puts three doors side by side, gives each one its
// own cause, and lets a child find the thing that is easy to say and hard to
// believe: EACH DOOR LISTENS FOR ITS OWN THING AND IGNORES THE OTHERS. Push
// the voltage and only one of the three answers. Squirt messenger and a
// different one does. That is what "gated" means, and no single channel can
// show it.
//
// Every family is the same two-state door underneath — shut, open, shut,
// open, at random — with the same flicker generator the patch clamp uses.
// What differs is only WHAT SETS THE ODDS, which is the honest shape of the
// biology: gating changes how often, never how wide.

export type FamilyId = 'leak' | 'voltage' | 'ligand' | 'mechanical'

export interface Family {
  id: FamilyId
  icon: string
  /** ⚠ THE ION IT PASSES, not the family it belongs to.
   *
   *  A first cut gave each family its own colour so the four could be told
   *  apart — which broke this app's own standing rule that every channel is
   *  tinted with the SPECIES it passes, and quietly taught that colour means
   *  "kind of gate". The reference figure the user supplied does the same
   *  thing the rule does: its channels are coloured by ion, so its two sodium
   *  channels share a colour and are told apart by their CAUSE. That is the
   *  honest code, and it is the one already in the app. */
  tint: 'k' | 'na' | 'cl' | 'ca'
  /** Named for the adult; the icon and the cause are for the kid. */
  name: string
  /** What opens it, in a child's words. */
  opensWhen: string
  /** The settings the child can hold, low to high. */
  steps: { label: string; value: number }[]
  /** The unit the setting is in, for the reading. */
  unit: string
  /** How long one opening lasts, ms. */
  tauOpenMs: number
}

/** Voltage-gated: a Boltzmann in the membrane voltage. Half-open at +10 mV
 *  with a 12 mV slope — a delayed rectifier's numbers, the same ones the patch
 *  clamp uses, because it is the same channel. */
export const V_HALF_MV = 10
export const V_SLOPE_MV = 12

/** Ligand-gated: a Hill curve in the messenger's concentration. Half-open at
 *  50 µM with a Hill coefficient of 2 — a nicotinic receptor's numbers, and
 *  the 2 is not decoration: it takes TWO messenger molecules to open one of
 *  those, which is why the curve is S-shaped rather than a slow climb. */
export const EC50_UM = 50
export const HILL_N = 2

/** Mechanically-gated: a Boltzmann in how hard the membrane is being pulled.
 *  Half-open around 30 mmHg, which is a Piezo channel's ballpark. */
export const P_HALF_MMHG = 30
export const P_SLOPE_MMHG = 8

export const FAMILIES: Family[] = [
  {
    // The contrast case, and the reason "gated" means anything: a door with
    // no gate at all. It answers nothing because it is never shut.
    id: 'leak',
    icon: '🕳️',
    // A potassium leak — the one the resting potential is mostly made of.
    tint: 'k',
    name: 'Leak channel',
    opensWhen: 'never — it has no gate, so it is always open',
    steps: [{ label: 'always open', value: 1 }],
    unit: '',
    tauOpenMs: 400,
  },
  {
    id: 'voltage',
    icon: '⚡',
    // Sodium, like the figure's voltage-gated channel and like the spike.
    tint: 'na',
    name: 'Voltage-gated',
    opensWhen: 'the charge across the wall changes',
    steps: [
      { label: 'resting', value: REST_MV },
      { label: 'a push', value: 0 },
      { label: 'a big push', value: 40 },
    ],
    unit: 'mV',
    tauOpenMs: 5,
  },
  {
    id: 'ligand',
    icon: '🥄',
    // Also sodium — and it SHARES the voltage-gated channel's colour on
    // purpose. Two doors that pass the same ion look the same; what tells
    // them apart is what opens them, which is the exhibit's whole point.
    tint: 'na',
    name: 'Ligand-gated',
    opensWhen: 'a messenger molecule lands on it',
    steps: [
      { label: 'none', value: 0 },
      { label: 'a little', value: 30 },
      { label: 'a lot', value: 200 },
    ],
    unit: 'µM',
    tauOpenMs: 4,
  },
  {
    id: 'mechanical',
    icon: '👆',
    // A stretch-activated cation channel; calcium is the one that matters
    // downstream, so it wears calcium's colour.
    tint: 'ca',
    name: 'Mechanically-gated',
    opensWhen: 'the wall itself is pushed or stretched',
    steps: [
      { label: 'still', value: 0 },
      { label: 'a squeeze', value: 26 },
      { label: 'a hard squeeze', value: 55 },
    ],
    unit: 'mmHg',
    tauOpenMs: 6,
  },
]

export const familyOf = (id: FamilyId): Family =>
  FAMILIES.find((f) => f.id === id) ?? FAMILIES[0]

/** HOW MUCH OF THE TIME this family's door is open at this setting.
 *
 *  Three different laws, one shape of answer — which is the point: whatever
 *  opens a door, what it changes is the ODDS. */
export function openProbabilityOf(id: FamilyId, at: number): number {
  // A door with no gate is open, and no dial anywhere changes that. It is the
  // control the other three are read against.
  if (id === 'leak') return 1
  if (id === 'voltage') return 1 / (1 + Math.exp((V_HALF_MV - at) / V_SLOPE_MV))
  if (id === 'ligand') {
    const c = Math.max(0, at)
    return c ** HILL_N / (EC50_UM ** HILL_N + c ** HILL_N)
  }
  return 1 / (1 + Math.exp((P_HALF_MMHG - at) / P_SLOPE_MMHG))
}

/** ⚠ AND THE OTHER CAUSES DO NOTHING.
 *
 *  A door answers its own cause and nothing else. This is not a simplification
 *  — it is the definition of the word "gated", and it is the one thing the
 *  bench exists to make watchable. A test pins it, because it would be very
 *  easy to write a bench where every lane quietly responded to every dial. */
export function respondsTo(id: FamilyId, cause: FamilyId): boolean {
  return id === cause
}

export const GATING_WINDOW_MS = 400

/** One family's record at one setting. Seeded per family so the three lanes
 *  are not the same flicker three times over. */
export function familyRecord(id: FamilyId, at: number): Dwell[] {
  const seed = FAMILIES.findIndex((f) => f.id === id) * 97 + 11
  return dwellsFor(seed, openProbabilityOf(id, at), familyOf(id).tauOpenMs, GATING_WINDOW_MS)
}

/** What the bar reads: measured off the record, never the model's number. */
export function familyMeasuredPo(id: FamilyId, at: number): number {
  return measuredPo(familyRecord(id, at), GATING_WINDOW_MS)
}

/** How much of the time it has been open SO FAR — the bar's own reading, and
 *  the reason the bar fills rather than appearing. At the end of the window it
 *  is `familyMeasuredPo`, by construction. */
export function poUpTo(record: Dwell[], ms: number): number {
  if (ms <= 0) return 0
  let open = 0
  for (const d of record) {
    if (!d.open || d.fromMs >= ms) continue
    open += Math.min(ms, d.toMs) - Math.max(0, d.fromMs)
  }
  return Math.max(0, Math.min(1, open / ms))
}

/** Is this door open at this moment? */
export function familyOpenAt(id: FamilyId, at: number, ms: number): boolean {
  for (const d of familyRecord(id, at)) {
    if (ms >= d.fromMs && ms < d.toMs) return d.open
  }
  return false
}

/** A point on a family's own curve — one completed run, remembered. */
export interface Point {
  at: number
  po: number
}

/** The range a family's curve is plotted across, so a dot lands somewhere
 *  meaningful. Derived from its own steps rather than typed in. */
export function curveRange(id: FamilyId): [number, number] {
  const values = familyOf(id).steps.map((s) => s.value)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  // A family with one setting — the leak, which has no dial — has no range.
  // Give it a nominal one rather than dividing by zero.
  if (hi === lo) return [lo - 1, lo + 1]
  const pad = (hi - lo) * 0.15
  return [lo - pad, hi + pad]
}

/** The family's own law, sampled for drawing — the curve the dots should land
 *  on if the measuring is honest. */
export function curveOf(id: FamilyId, samples = 48): { at: number; po: number }[] {
  const [lo, hi] = curveRange(id)
  return Array.from({ length: samples }, (_, i) => {
    const at = lo + ((hi - lo) * i) / (samples - 1)
    return { at, po: openProbabilityOf(id, at) }
  })
}

/** Is this a door with a gate at all? The leak is the control case, and the
 *  bench has to treat it as one rather than as a fourth dial. */
export const isGated = (id: FamilyId): boolean => id !== 'leak'

/** The setting a family sits at when its cause is NOT being applied, and when
 *  it is. A poke moves it from one to the other. */
export const restingAt = (id: FamilyId): number => familyOf(id).steps[0].value
export const pokedAt = (id: FamilyId): number =>
  familyOf(id).steps[familyOf(id).steps.length - 1].value

/** ONE POKE, in legs — the cause arriving, landing, doing its work, and
 *  leaving. The gate is not a switch wired to a button: something has to come
 *  and DO something to it, and a child should watch that happen (user,
 *  2026-08-28). */
export const POKE_MS = 3600

export interface Poke {
  /** 0→1 across the whole poke. */
  t: number
  /** The cause on its way in. */
  approach: number
  /** The cause in contact with the door — bound, flashed, pressed. */
  contact: number
  /** How much of the cause is being applied right now, 0→1. */
  strength: number
  /** True once the cause has gone again. */
  done: boolean
}

/** How open the gate is at a moment of the poke, 0→1 — and it is a MECHANISM,
 *  not odds (user, 2026-08-28: "no need to display open probability, only demo
 *  mechanics"). Signal applied, channel opens, stays open a while, closes, and
 *  can be applied again.
 *
 *  The flicker and the percentage belong to the patch clamp, which is the
 *  exhibit about how often. This one is about what happens. */
export function gateOpennessAt(poke: Poke): number {
  const t = poke.t
  if (t < 0.28) return 0
  if (t < 0.38) return (t - 0.28) / 0.1
  if (t < 0.74) return 1
  if (t < 0.86) return 1 - (t - 0.74) / 0.12
  return 0
}

// ⚠ `sensorUpAt` USED TO LIVE HERE, and it is gone (2026-08-29).
//
// It animated a ball-on-a-stalk being pushed by the field, on the reading that
// the ball in a reference figure was the S4 voltage SENSOR. The user's traced
// drawing settles it the other way: in the third state the ball has moved INTO
// THE PORE, and a sensor does not plug the channel it senses for. It is an
// inactivation ball, `ballInAt` moves it, and the cause is drawn as the charge
// itself flipping across the wall.

/** How far the INACTIVATION BALL has swung from hanging to seated, 0→1 — the
 *  THIRD state the user's traced drawing shows: closed, open, inactive.
 *
 *  It arrives WHILE THE DOOR IS STILL OPEN, which is what makes it the thing
 *  that stops the channel rather than a decoration that follows the door, and
 *  it leaves again before the next go. */
export function ballInAt(poke: Poke): number {
  const t = poke.t
  if (t < 0.56) return 0
  if (t < 0.7) return (t - 0.56) / 0.14
  if (t < 0.86) return 1
  if (t < 0.96) return 1 - (t - 0.86) / 0.1
  return 0
}

export function pokeAt(sinceMs: number | null): Poke {
  if (sinceMs === null) {
    return { t: 0, approach: 0, contact: 0, strength: 0, done: true }
  }
  const t = Math.max(0, Math.min(1, sinceMs / POKE_MS))
  // Coming in → landing → holding → leaving. Most of the window is the
  // HOLDING, because that is the part with something to watch.
  if (t < 0.18) return { t, approach: t / 0.18, contact: 0, strength: 0, done: false }
  if (t < 0.3) {
    const c = (t - 0.18) / 0.12
    return { t, approach: 1, contact: c, strength: c, done: false }
  }
  if (t < 0.82) return { t, approach: 1, contact: 1, strength: 1, done: false }
  const g = (t - 0.82) / 0.18
  return { t, approach: 1 - g, contact: 1 - g, strength: 1 - g, done: t >= 1 }
}

/** What setting the door is effectively at, part way through a poke. */
/** How present the bound messenger is, 0→1 — and it STAYS SEATED for as long
 *  as the door is open (user, 2026-08-28: "the ion should fit into the puzzle
 *  hole and stay there"). It arrives, drops into its socket, sits there while
 *  the channel conducts, and leaves only once the door has shut behind it.
 *  A ligand that faded out mid-run would be saying the door stays open with
 *  nothing holding it. */
export function boundAt(poke: Poke): number {
  const t = poke.t
  if (t < 0.06) return 0
  if (t < 0.26) return (t - 0.06) / 0.2
  if (t < 0.88) return 1
  return Math.max(0, 1 - (t - 0.88) / 0.12)
}

export function settingDuring(id: FamilyId, poke: Poke): number {
  const lo = restingAt(id)
  const hi = pokedAt(id)
  return lo + (hi - lo) * poke.strength
}


export const GATING_PARTS: TeachingPara[] = [
  {
    icon: '🚪',
    text: 'Four doors in a wall, and they look almost the same. What makes them different is not the hole — it is what they LISTEN FOR.',
  },
  {
    icon: '🕳️',
    text: 'Start with the odd one out: the LEAK. It has no gate at all. Nothing opens it because it was never shut, and ions trickle through it all day long. It is the reason the word "gated" means anything — the other three are doors WITH a lock, and this one is a doorway.',
  },
  {
    icon: '⚡',
    text: `The first one watches the charge across the wall. Flip the charge and its flap swings out of the way — this is the door the nerve spike is made of. Then watch what happens NEXT: a little ball on a chain swings up and plugs the hole from underneath, while the charge is still flipped. The door shuts itself. That is called INACTIVATION, and it is why a nerve fires a quick spike instead of staying on.`,
  },
  {
    icon: '🥄',
    text: `The second one waits to be TOUCHED by a messenger molecule. No messenger, no opening, however hard you push the voltage. And watch HOW it opens — there is no flap and no ball here: the pieces of the door itself lean apart and leave a gap. That is what a messenger landing on it does to its shape. This is the door a synapse uses.`,
  },
  {
    icon: '👆',
    text: `The third one feels the wall itself being pushed or stretched — about ${P_HALF_MMHG} of squeeze to get it half open. These are the doors in your fingertips and in your ears. Touch and hearing are, in the end, doors like this being pushed.`,
  },
  {
    icon: '🙉',
    text: 'Now the thing worth finding out for yourself: press ONE button and watch the other doors. Nothing. Each one answers its own cause and is completely deaf to the others. That is the whole of the word "gated".',
  },
  {
    icon: '📏',
    text: 'And look at what a cause does NOT change: how WIDE the door goes. An opening is an opening. What a cause changes is how OFTEN it happens — which is why the bar under each door gets longer, never taller.',
  },
]

/** What each door is doing, in mechanics rather than percentages. */
export function gatingRightNow(busy: Record<FamilyId, boolean>): TeachingPara[] {
  return FAMILIES.map((f) => ({
    icon: f.icon,
    text: !isGated(f.id)
      ? `${f.name}: open, as always. Nothing opens it because nothing ever shut it.`
      : busy[f.id]
        ? `${f.name}: its cause has arrived — the door is opening, and it will hold open for a moment and then shut again by itself.`
        : `${f.name}: shut, and waiting. It opens when ${f.opensWhen}, and for nothing else.`,
  }))
}

export const GATING_HONESTY: TeachingPara[] = [
  {
    icon: '🧮',
    text: `CALIBRATED: the three laws are the real ones — a Boltzmann in voltage (half open at ${V_HALF_MV} mV), a Hill curve in messenger with ${HILL_N} molecules needed (half open at ${EC50_UM} µM, a nicotinic receptor's figure), and a Boltzmann in membrane push (half open near ${P_HALF_MMHG} mmHg, a Piezo channel's ballpark). The percentage under each door is MEASURED off its record, not read from the law — which is why it wobbles a little away from the curve, exactly as a real measurement does.`,
  },
  {
    icon: '🎲',
    text: 'SEEDED: the flickering is random but repeatable, so the same setting always gives the same record and a paused picture stays put. A real channel never repeats itself.',
  },
  {
    icon: '✂️',
    text: 'SIMPLIFIED: a real voltage-gated channel also has a VOLTAGE SENSOR — a charged piece that feels the field and swings the gate — and this drawing does not show one, so neither do we; what you see instead is the charge itself flipping across the wall, which is what that sensor would be answering to. A real channel also has more shut states than one to pass through. And the deafness is not quite absolute in life: stretch almost anything hard enough and it does something. Almost absolute is close enough to be worth learning as a rule.',
  },
]
