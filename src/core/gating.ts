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
  /** The whole sentence, where "Opens when …" cannot be completed sensibly.
   *
   *  ⚠ The leak read "Opens when never — it has no gate, so it is always
   *  open", which is a sentence a child has to unpick backwards before it says
   *  anything (user, 2026-08-30). A phrase written to slot into a template is
   *  not the same thing as a phrase that reads. When the template fights the
   *  meaning, replace the sentence, do not contort the phrase. */
  opensLine?: string
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
 *  10 µM with a Hill coefficient of 2 — a GABA-A receptor's numbers, and the 2
 *  is not decoration: that receptor has TWO messenger binding sites and needs
 *  both, which is why the curve is S-shaped rather than a slow climb.
 *
 *  ⚠ The exemplar CHANGED (2026-08-30), and the numbers changed with it. It
 *  used to be a nicotinic receptor at 50 µM. See the family's `tint` for why —
 *  and note that swapping the exemplar without swapping its calibrated figures
 *  would have left the app quoting one receptor's numbers under another
 *  receptor's name. */
export const EC50_UM = 10
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
    opensLine: 'Always open. There is no gate on it to shut.',
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
    // ⚠ CHLORIDE, and that is a change of EXEMPLAR, not a change of rule
    // (user, 2026-08-30: "ligand- and voltage-gated currently have the same
    // color, make different… unless absolutely necessary for consistency").
    //
    // It used to be a sodium receptor, which made it yellow — the same yellow
    // as the voltage-gated door beside it AND the same yellow as the ion
    // arriving to open it, so three different things on one panel were one
    // colour. The rule that put them there (colour means SPECIES, never
    // category) is right and stays. What was wrong was the CHOICE of
    // exemplar: "ligand-gated" is a family, not a channel, and its members
    // pass different ions. This panel is now a GABA-A receptor — the
    // commonest inhibitory ligand-gated channel there is — and a GABA-A
    // receptor really does pass chloride. So it is green because of what goes
    // through it, exactly like every other channel in this app.
    tint: 'cl',
    name: 'Ligand-gated',
    opensWhen: 'a messenger molecule lands on it',
    steps: [
      { label: 'none', value: 0 },
      { label: 'a little', value: 6 },
      { label: 'a lot', value: 60 },
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
// ⚠ SLOWED, twice now (user, 2026-08-30: "make all channel demos slower").
// A run has to hold FIVE separate events in the voltage case — flash,
// depolarisation, sensor, flap, ball — and each of them needs to be seen to
// happen before the next begins, with a real gap between. Six seconds is not
// generosity: at 3.6 s the pauses that make the chain a chain were shorter
// than the eye takes to notice something has stopped.
export const POKE_MS = 6000

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
  // ⚠ IT WAITS FOR THE SENSOR (2026-08-30). The gate used to start moving at
  // 0.28, which overlapped the sensor's own travel and let the two read as one
  // event — "the charge opens the door". They are two events with a cause
  // between them, and the pause is what makes the chain legible.
  if (t < 0.4) return 0
  if (t < 0.5) return (t - 0.4) / 0.1
  if (t < 0.76) return 1
  if (t < 0.86) return 1 - (t - 0.76) / 0.1
  return 0
}

/** How far the VOLTAGE SENSOR has been shoved outward, 0→1.
 *
 *  ⚠ THIS IS THE ONLY CHARGE-DRIVEN STEP, and the app was missing it (user,
 *  2026-08-30: "it's not clear what makes the 'ball' get pulled into the
 *  hole"). The honest answer to that question is that NOTHING pulls the ball.
 *  The chain is:
 *
 *    the inside goes positive
 *      → the S4 helix, which carries positive charge, is REPELLED outward
 *      → its movement drags the activation gate open
 *      → and only then does the ball have anywhere to land
 *
 *  A real Nav channel's inactivation ball is the hydrophobic IFM motif on the
 *  III–IV linker. It is not dragged in by the field; its receptor site is
 *  buried until the gate opens and only then becomes available. Inactivation
 *  borrows its whole voltage dependence from activation. Drawing the ball as
 *  charge-pulled would teach a mechanism that does not exist — and would also
 *  leave the child with no answer to why it waits.
 *
 *  It goes out with the charge and comes back with it, because it is the thing
 *  the charge is actually acting on. */
export function sensorOutAt(poke: Poke): number {
  const t = poke.t
  if (t < 0.24) return 0
  if (t < 0.34) return (t - 0.24) / 0.1
  if (t < 0.84) return 1
  if (t < 0.94) return 1 - (t - 0.84) / 0.1
  return 0
}

/** Whether the ball has anywhere to land yet, 0→1 — the seat inside the pore's
 *  mouth, which EXISTS ONLY WHILE THE GATE IS OPEN. Drawn, so that the reason
 *  the ball waits is on the screen rather than in a paragraph. */
export function seatOpenAt(poke: Poke): number {
  return Math.max(0, Math.min(1, (gateOpennessAt(poke) - 0.35) / 0.3))
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
/** How far a STRETCH-gated door is open, 0→1.
 *
 *  ⚠ IT OPENS WITH THE PUSH (user, 2026-08-30: "remove pause in
 *  'Mechanically-gated' channel demo. Push and open should look as cause and
 *  consequence"). It used to share `gateOpennessAt` with the other two, which
 *  holds a deliberate pause before the door moves — and that pause is right
 *  for them: the voltage-gated door waits on its sensor, and the ligand-gated
 *  one waits for a messenger to finish landing. **This door waits for
 *  nothing.** The tension in the bent sheet pulls the subunits apart, and the
 *  bending IS the opening. A gap between them invented a middle step that does
 *  not exist and left the finger looking as if it had missed.
 *
 *  It begins while the finger is still coming down, so the two overlap rather
 *  than queue: push and open, one movement. */
export function stretchOpenAt(poke: Poke): number {
  const t = poke.t
  if (t < 0.13) return 0
  if (t < 0.23) return (t - 0.13) / 0.1
  if (t < 0.84) return 1
  if (t < 0.94) return 1 - (t - 0.84) / 0.1
  return 0
}

export function ballInAt(poke: Poke): number {
  const t = poke.t
  if (t < 0.6) return 0
  if (t < 0.7) return (t - 0.6) / 0.1
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
  //
  // ⚠ THE CAUSE ARRIVES AND THE MEMBRANE ANSWERS AT ONCE (user, 2026-08-30:
  // "flash — depolarization (consequent, no pause)"). These two share one
  // ramp on purpose: the flash IS the depolarisation arriving, and a gap
  // between them would invent a delay that does not exist. Every pause in this
  // run is between a cause and its CONSEQUENCE, never inside one event.
  if (t < 0.1) return { t, approach: t / 0.1, contact: 0, strength: 0, done: false }
  if (t < 0.18) {
    const c = (t - 0.1) / 0.08
    return { t, approach: 1, contact: c, strength: c, done: false }
  }
  if (t < 0.84) return { t, approach: 1, contact: 1, strength: 1, done: false }
  const g = (t - 0.84) / 0.16
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
  // ⚠ Its approach is SLOW (user, 2026-08-30: "ion in ligand-gated should
  // move slower"). It used to cover the whole distance in the first third of
  // its rise and then sit waiting; it now travels for as long as it is
  // arriving, and lands just before the door answers.
  if (t < 0.08) return 0
  if (t < 0.34) return (t - 0.08) / 0.26
  if (t < 0.88) return 1
  return Math.max(0, 1 - (t - 0.88) / 0.12)
}

/** When the bound messenger reads as LOCKED IN, 0→1 — the white collar drawn
 *  round it once it has settled.
 *
 *  ⚠ IT WAITS A BEAT AFTER THE LANDING (user, 2026-08-30: "make it appear
 *  after the ion settled on the channel, with a pause"). Drawn the instant the
 *  ion arrived, the collar was part of the arriving — one event, and the
 *  landing and the catching read as the same thing. Held back, they become two:
 *  the ion comes to rest, nothing happens for a moment, and THEN the receptor
 *  closes on it. That pause is the same length as every other pause in this
 *  run, because it is the same kind of thing: a cause and its consequence.
 *
 *  It lands with the door opening, which is the point — the collar and the
 *  gap appearing together say the binding is what did it. */
export function ligandLockedAt(poke: Poke): number {
  const t = poke.t
  if (t < 0.42) return 0
  if (t < 0.48) return (t - 0.42) / 0.06
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
    text: `The first one watches the charge across the wall, and it opens in a CHAIN of three steps — watch for them in order. One: the inside flashes positive. Two: a little piece of the door called the SENSOR is covered in plus charges, so the positive inside SHOVES IT OUT — two pluses push each other apart, and that is the only step the charge itself does. Three: the sensor dragging outward pulls the flap open. This is the door the nerve spike is made of.`,
  },
  {
    icon: '⛔',
    text: `Now watch what happens NEXT, and watch it carefully, because it answers a question you might already be asking. A little ball on a chain swings up and plugs the hole from underneath, and the door shuts itself while the charge is STILL flipped. So what pulls the ball in? Nothing does. There is nowhere for the ball to sit until the flap has opened — the seat only appears once the door is open, which is why the ball always waits its turn. It lights up when it is ready. That is called INACTIVATION, and it is why a nerve fires a quick spike instead of staying on.`,
  },
  {
    icon: '🥄',
    text: `The second one waits to be TOUCHED by a messenger molecule. No messenger, no opening, however hard you push the voltage. And watch HOW it opens — there is no flap and no ball here: the pieces of the door itself lean apart and leave a gap. That is what a messenger landing on it does to its shape. This is the door a synapse uses.`,
  },
  {
    icon: '🟢',
    text: `Notice that this one is GREEN while the spike's door is yellow. That is not a code for "different kind of door" — in this app a channel is always painted the colour of what goes THROUGH it. This one is a GABA-A receptor, and it lets chloride through, so it is chloride green. The messenger that opens it is the odd one out on the whole screen: it is not an ion at all, it is a molecule, so it is not painted like one.`,
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
    text: `CALIBRATED: the three laws are the real ones — a Boltzmann in voltage (half open at ${V_HALF_MV} mV), a Hill curve in messenger with ${HILL_N} molecules needed (half open at ${EC50_UM} µM, a GABA-A receptor's figure), and a Boltzmann in membrane push (half open near ${P_HALF_MMHG} mmHg, a Piezo channel's ballpark). The percentage under each door is MEASURED off its record, not read from the law — which is why it wobbles a little away from the curve, exactly as a real measurement does.`,
  },
  {
    icon: '⛓️',
    text: 'THE BALL IS NOT PULLED IN. It would be easier to draw it being dragged into the pore by the flipped charge, and that is not what happens: the ball is a greasy little knot of protein with no useful charge on it, and its landing site is buried until the gate opens. Inactivation borrows all of its timing from the opening it follows. The order on the screen — charge, then sensor, then flap, then ball — is the real order, and the ball waiting is the real reason it waits.',
  },
  {
    icon: '🎨',
    text: 'NOT DRAWN TO ONE SCALE OF EXEMPLAR: each panel is one real channel standing for a whole family. The spike door is a Nav channel, the messenger door a GABA-A receptor, the push door a Piezo channel, the leak a K2P. Another member of the same family can pass a different ion and would be painted a different colour here — which is the point of painting by ion rather than by family.',
  },
  {
    icon: '🔋',
    text: 'EVERY MEMBRANE IS CHARGED, all the time — all four of these walls, not just the one with the ± marks on it. The marks are drawn on the voltage-gated panel alone because that is the only door the charge means anything TO. The other three sit in exactly the same charged wall and take no notice of it whatsoever, which is the point: a cause is only a cause for the door that listens for it.',
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
