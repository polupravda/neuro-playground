import { AXIAL_RESISTIVITY, MEMBRANE_RESISTANCE, lengthConstantUm } from './cable'
import { AXON_DIAMETER_UM } from './membrane'
import { lamellae } from './fibre'
import type { TeachingPara } from './neuron'

// D05 — THE LEAKY PIPE. How far a signal reaches, and what decides.
//
// The one equation, and it is already in `cable.ts`:
//
//     λ = √(d · Rm / 4 · Ra)
//
// A voltage put in at one spot does not travel; it SPREADS, and it leaks away
// through the wall as it goes. How far it gets before it has faded to a third
// of itself is λ — set by a race between two resistances: how hard it is to
// push current ALONG the inside (Ra, salty water, a poor wire) against how
// hard it is for current to escape SIDEWAYS through the wall (Rm).
//
// ⚠ NOTHING HERE RE-DERIVES λ. The spec is explicit that this exhibit draws
// `core/cable.ts` and does not keep a second set of numbers, so every figure
// below is that function's answer scaled by what the child has done to the
// wall. λ goes as √Rm, so a wall four times leakier halves it.
//
// What the child changes is the WALL, never the number:
//   • add leak doors  → more ways out → Rm falls → λ shrinks
//   • wrap in myelin  → almost no way out → Rm soars → λ grows

/** ⚠ THE HOLES ARE NOT OPTIONAL, and the exhibit used to say they were (user,
 *  2026-08-30: "there's no situation when K⁺ channels are absent (which we can
 *  build)? This is confusing").
 *
 *  They were right, and the model proves it: a wall with no holes drawn still
 *  had Rm = 3333 Ω·cm², a perfectly leaky membrane — λ is 342 µm precisely
 *  BECAUSE it leaks. So the picture offered a state ("a fibre with no leak
 *  channels") that neither the model nor a cell has. Every membrane leaks; a
 *  neuron with no potassium leak has no resting potential at all.
 *
 *  So the holes are a permanent feature of the wall, the same holes in both
 *  fibres, and what myelin does is COVER them. That is also what myelin
 *  actually does: it does not remove a channel, it wraps insulation over the
 *  membrane and leaves gaps — the nodes — where the wall is still bare. */
export const HOLES = 9

/** Where the holes sit, as fractions along the fibre. */
export function holePlaces(): number[] {
  const out: number[] = []
  for (let i = 0; i < HOLES; i++) out.push((i + 0.5) / HOLES)
  return out
}

/** Which of those holes a node is left open at.
 *
 *  ⚠ A NODE IS A HOLE, not a place near one (user, 2026-08-31: "channels on
 *  the myelinated axon are misplaced: they are at myelin, not at the nodes of
 *  Ranvier"). The first version asked whether a hole was WITHIN a tolerance of
 *  a node, and the tolerance was 0.056 of the fibre while the drawn gap is
 *  0.0156 — three and a half times too generous. Four holes counted as exposed
 *  and, measured, not one of them was actually inside a gap: every one was
 *  drawn on a sleeve.
 *
 *  Choosing WHICH HOLES are nodes and deriving the sleeves from them removes
 *  the tolerance altogether: a gap cannot miss a hole it was cut around. */
const NODE_HOLES = [1, 3, 5, 7]

/** The nodes of Ranvier, as fractions along the fibre. */
export function nodePlaces(): number[] {
  const places = holePlaces()
  return NODE_HOLES.filter((i) => i < places.length).map((i) => places[i])
}

/** The stretches the sleeves cover — everything that is not a node. */
export function sleeveSpans(): Array<[number, number]> {
  const nodes = nodePlaces()
  const edges = [0, ...nodes, 1]
  const out: Array<[number, number]> = []
  for (let i = 1; i < edges.length; i++) out.push([edges[i - 1], edges[i]])
  return out
}

export interface Wall {
  myelin: boolean
}

export const BARE_WALL: Wall = { myelin: false }
export const WRAPPED_WALL: Wall = { myelin: true }

/** How many membrane layers a myelin sheath puts in the current's way: two per
 *  wrap, plus the axon's own. Resistances in series add, so this is the factor
 *  Rm is multiplied by — and the wrap count is `lamellae()`, derived from the
 *  g-ratio the app already declares rather than picked. */
export function myelinLayers(diameterUm = AXON_DIAMETER_UM): number {
  return 2 * lamellae(diameterUm) + 1
}

/** How many times this wall's resistance is the bare axon's. */
export function rmFactor(wall: Wall): number {
  return wall.myelin ? myelinLayers() : 1
}

/** The length constant of this wall, µm — `cable.ts`'s own answer, scaled.
 *  λ ∝ √Rm, which is why halving the resistance does not halve the reach. */
export function lambdaUm(wall: Wall): number {
  return lengthConstantUm() * Math.sqrt(rmFactor(wall))
}

/** What fraction of the injected voltage survives this far along, 0→1. The
 *  cable's own steady-state answer: an exponential with λ as its scale. */
export function survivesAt(wall: Wall, xUm: number): number {
  return Math.exp(-Math.max(0, xUm) / lambdaUm(wall))
}

/** How far the signal gets before it is too small to do anything — taken at a
 *  twentieth, which is about where a spike can no longer wake a neighbour. */
export const SPENT = 0.05
export function reachUm(wall: Wall): number {
  return lambdaUm(wall) * Math.log(1 / SPENT)
}

/** How much leaks out sideways per unit length here, relative to the bare
 *  wall's worst — what the escaping arrows are drawn from, so their number is
 *  the model's answer and not a mood. */
export function leakRateAt(wall: Wall, xUm: number): number {
  return survivesAt(wall, xUm) / rmFactor(wall)
}

/** How long one race takes, ms. */
export const RACE_MS = 4200

/** Where the pulse has got to, 0→1 along the fibre.
 *
 *  ⚠ BOTH PULSES TRAVEL AT THE SAME SPEED, and that is a declared
 *  simplification. A real wrapped fibre is also FASTER — a bigger λ and a
 *  smaller capacitance both shorten the delay — but speed is the conduction
 *  exhibit's lesson, and putting it here too would leave a child unable to say
 *  which of the two things they had just watched. Here the only difference
 *  between the fibres is how much SURVIVES. */
export function pulseAt(u: number): number {
  return Math.max(0, Math.min(1, u))
}

/** Is this hole still open to the world, or is it under a sleeve?
 *
 *  ⚠ EXACT, not within a tolerance — see `NODE_HOLES`. A node IS one of these
 *  holes, so the question is membership and nothing has to be measured. */
export function holeExposed(wall: Wall, place: number): boolean {
  if (!wall.myelin) return true
  return nodePlaces().includes(place)
}

/** How brightly this hole is leaking as the pulse goes by — the model's own
 *  answer, so the sparks are a reading and not a decoration. Zero where the
 *  pulse has not reached, and fading behind it as the charge drains away. */
export function sparkAt(wall: Wall, place: number, pulse: number): number {
  // Centred on the pulse, so a hole is brightest as the push reaches it —
  // and glows a little BEFORE, which is not a cheat: a voltage spreads ahead
  // of its own peak, which is the entire subject of this exhibit.
  const phase = (pulse - place) / SPARK_WIDTH + 0.5
  if (phase < 0 || phase > 1) return 0
  // ⚠ AN EASED BELL — the shape the axon views' own node flashes use: swells
  // in, peaks, dies away (user, 2026-08-31: "make leaking look like flashes
  // coming out… these look like tiny strings and are almost invisible").
  // A brightness that simply appears at full strength and fades reads as a
  // mark being switched on; a bell reads as something bursting out.
  const lit = Math.sin(Math.PI * phase) ** 2
  // ⚠ THE BRIGHTNESS IS EXAGGERATED, and the user asked for it ("I think it's
  // okay to exaggerate the whole thing a bit", 2026-08-31) — but the exact
  // amount is declared rather than eyeballed.
  //
  // A flash's size follows the voltage still there, because that is what sets
  // the current escaping. Straight, that made the bare fibre's holes invisible
  // past the first: by mid-fibre only 1% of the push survives, and 1% of a
  // glow is nothing. Raised to a power, the ORDER is untouched — every hole is
  // still dimmer than the one before it, and the wrapped fibre's nodes still
  // outshine the bare fibre's far end — while the whole range stays on screen.
  return Math.pow(survivesAt(wall, place * SPAN_FOR_SPARKS), SPARK_GAMMA) * lit
}

/** How hard the flash brightness is stretched. 1 would be the literal voltage;
 *  this is a declared exaggeration, and the honesty note says so. */
export const SPARK_GAMMA = 0.45

/** How much of the fibre a single flash lasts over. Wide enough that a flash
 *  is an event you can watch happen rather than one frame of brightness. */
const SPARK_WIDTH = 0.22

/** The stretch of fibre the sparks are measured over. Declared here rather than
 *  passed in, because it is the same fibre the scene draws. */
const SPAN_FOR_SPARKS = 3000

export const LEAKY_PARTS: TeachingPara[] = [
  {
    icon: '🫗',
    text: 'A nerve fibre is a leaky hose. Push a voltage in at one end and it does not travel down the pipe — it SPREADS, and it leaks out through the wall the whole way, so it is always fading.',
  },
  {
    icon: '🏁',
    text: 'Two things are racing. Getting along the INSIDE is hard: the inside of an axon is salty water, a wire about ten million times worse than copper. Getting out through the WALL is also hard: a membrane is fat, and charge hates crossing it. Whichever is easier decides how far the signal gets.',
  },
  {
    icon: '📏',
    text: 'That distance has a name — the length constant, λ. It is where the signal has faded to about a third. Mark it on the fibre and you can see immediately why a long nerve cannot simply let a voltage spread to the end: it would be gone long before it got there.',
  },
  {
    icon: '🕳️',
    text: 'Look at the holes. Both pipes have exactly the same ones, in the same places — because they are the same membrane. A nerve fibre ALWAYS has these; a cell with no way for potassium to leak out would have no resting voltage at all, and nothing to send.',
  },
  {
    icon: '🧈',
    text: 'So what does myelin change? It does not take a single hole away. It WRAPS OVER them — another cell wound round and round the pipe — leaving small bare gaps called nodes. Charge can only escape at a gap now, and every layer is one more wall to cross. That is the whole trick: it does not make the inside a better wire, it puts a coat over the holes.',
  },
  {
    icon: '🏁',
    text: 'Press 🏁 Race and watch both at once. The bright blob IS the signal, and every hole it passes throws a little of it OUT — the same light, leaving, gone into the water. Watch the blob get dimmer each time. That is the whole thing: the signal fades because pieces of it keep escaping. On the bare pipe so much gets out that nothing is left before the end; on the wrapped one it can only escape at the nodes, and it arrives.',
  },
]

export function leakyRightNow(wall: Wall): TeachingPara[] {
  const lambda = Math.round(lambdaUm(wall))
  const bare = Math.round(lambdaUm(BARE_WALL))
  const times = lambdaUm(wall) / lambdaUm(BARE_WALL)
  const how =
    Math.abs(times - 1) < 0.02
      ? 'the same as a bare fibre'
      : times > 1
        ? `${times.toFixed(1)}× a bare fibre's`
        : `${(1 / times).toFixed(1)}× SHORTER than a bare fibre's`
  return [
    {
      icon: '📏',
      text: `λ is ${lambda} µm — ${how} ${bare} µm. The signal is down to a third there, and all but gone by ${Math.round(reachUm(wall))} µm.`,
    },
    {
      icon: '⚖️',
      text: `This wall is ${rmFactor(wall).toFixed(2)}× as hard to leak through as a bare one${
        wall.myelin
          ? `, because myelin puts ${myelinLayers()} membranes in the way of every escaping charge`
          : ' — it is the bare membrane, holes and all'
      }. λ follows the square root of that.`,
    },
  ]
}

export const LEAKY_HONESTY: TeachingPara[] = [
  {
    icon: '🧮',
    text: `CALIBRATED: λ = √(d·Rm / 4·Ra) on this app's own numbers — ${AXIAL_RESISTIVITY} Ω·cm for the cytoplasm and ${Math.round(MEMBRANE_RESISTANCE)} Ω·cm² for the resting membrane. It is the same function the axon views use to decide how far a patch can wake its neighbours; nothing here keeps a second set of figures.`,
  },
  {
    icon: '🚪',
    text: `A TEACHING UNIT: one drawn door stands for a whole population, as the doors do everywhere in this app, and it is declared to make the wall half again as leaky. A single real channel is a vanishing part of a membrane's leak. What is honest is the direction and the law — more doors, less resistance, and λ falling as its square root.`,
  },
  {
    icon: '🧈',
    text: `MYELIN IS COUNTED, not asserted: ${lamellae()} wraps for this diameter, from the g-ratio the app declares, and two membranes per wrap in series — so ${myelinLayers()} walls to cross. That is why λ jumps so far.`,
  },
  {
    icon: '✨',
    text: `THE ESCAPING BITS WEAR THE SIGNAL'S OWN LIGHT, and that is a choice worth naming: what is actually leaving is potassium ions, and they are not made of light. What the colour reports is not which ion it is — the doors are drawn potassium-purple for that — but that this IS the signal, draining away. It is the same charge that was carrying it. EXAGGERATED too: how many come out follows how much of the push is still there, so the leak dies along the bare fibre exactly as the signal does, but the range is stretched (a power of ${SPARK_GAMMA}) or everything past the first hole would be invisible.`,
  },
  {
    icon: '⏱️',
    text: 'STEADY STATE: this is how far a voltage reaches once it has settled, which is what λ means. A real spike is also racing a clock, and the axon views are where that part lives. Here nothing is moving — the question is only how far, not how fast.',
  },
]
