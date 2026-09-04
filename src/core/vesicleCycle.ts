import { HILL_N } from './synapse'
import type { TeachingPara } from './neuron'

// D06 — THE VESICLE LIFE CYCLE AND THE SNARE MACHINERY.
//
// The synapse scene (S12) shows a vesicle fusing in about a frame and a half,
// at a magnification where the machinery doing it is a few pixels. This is that
// half-frame, opened out: one vesicle, one patch of terminal wall, and the
// proteins that pull them together.
//
// ⚠ THE MODEL HERE IS A SEQUENCE, NOT A SIMULATION, and says so. Fusion is not
// integrated from rate constants the way the terminal's calcium is — SNARE
// zippering energetics are an active research question, not a settled set of
// numbers this app could honestly integrate. What IS settled is the ORDER, the
// cast, and the fact that the trigger takes four calcium ions. So this file
// owns the order and the proportions, and the info block says plainly which
// parts are measured (the calcium co-operativity, from the same Hill exponent
// the scene uses) and which are drawn to a plausible schedule.

export type StageId =
  | 'approach'
  | 'tether'
  | 'dock'
  | 'prime'
  | 'trigger'
  | 'zipper'
  | 'pore'
  | 'collapse'
  | 'retrieve'
  | 'recycle'
  | 'refill'
  | 'load'

export interface Stage {
  id: StageId
  /** For the adult. */
  title: string
  /** For the kid — what to watch for. */
  watch: string
  /** ⚠ THE LEG'S SHARE OF THE SCREEN CLOCK, not of real time.
   *
   *  "A run's clock follows the interest, not the model's even time." The
   *  payload here is the trigger and the zipper — the two seconds a child has
   *  to see four calcium ions land and the coils pull two membranes together —
   *  so those legs get most of the window and the housekeeping legs get less.
   *  Slow the LEG, never the item: nothing inside a leg changes speed. */
  share: number
  /** ⚠ A STILL BEAT at the end of the leg (user, 2026-09-03: "add gaps
   *  between important events"): this fraction of the leg's span is a hold —
   *  the leg's action completes in the first (1 − hold) of its window and the
   *  picture then rests, so each event can land before the next begins.
   *  `through` compresses its ramp accordingly. */
  hold?: number
}

export const STAGES: Stage[] = [
  {
    // ⚠ The cycle now OPENS UPSTREAM (user, 2026-09-03: start with an undocked
    // vesicle at the top, and draw the machinery that catches it). The old
    // first frame — already tethered — skipped the question a child actually
    // asks: how did the wall know to keep THIS bubble?
    id: 'approach',
    title: 'Approaching',
    watch: 'A full bubble drifts down from the crowd, wearing a lit badge — a Rab holding GTP.',
    share: 0.07,
  },
  {
    id: 'tether',
    title: 'Tethered',
    watch: 'A long tether from the wall has caught the badge. Held near the wall, not touching yet.',
    share: 0.04,
  },
  {
    id: 'dock',
    title: 'Docked',
    watch: 'Munc13 opens syntaxin, the three SNAREs find each other — and the badge goes dark.',
    share: 0.06,
    hold: 0.25,
  },
  {
    id: 'prime',
    title: 'Primed',
    watch: 'The SNAREs wind together — halfway, then they stop. Complexin clamps the rope; the tether lets go.',
    share: 0.09,
    hold: 0.25,
  },
  {
    id: 'trigger',
    title: 'Calcium arrives',
    watch: `Watch the sensor fill up. It takes ${HILL_N} — three is not enough.`,
    share: 0.16,
    hold: 0.22,
  },
  {
    id: 'zipper',
    title: 'The zip closes',
    watch: 'The winding finishes, and finishing it drags the two walls into each other.',
    share: 0.11,
    hold: 0.2,
  },
  {
    id: 'pore',
    title: 'A hole opens',
    watch: 'The two walls become one wall, with a hole through it. The cargo goes out.',
    share: 0.08,
    hold: 0.15,
  },
  {
    id: 'collapse',
    title: 'Flattened out',
    watch: 'The bubble opens all the way and becomes part of the wall. The used rope stays in it, set aside.',
    share: 0.06,
  },
  {
    id: 'retrieve',
    title: 'Taken back',
    // ⚠ Share raised 0.07 → 0.09 (2026-09-02): retrieval is now the fusion
    // sweep run BACKWARDS at the same spot, and the reversal deserves the
    // same pace budget the sink gets — slow the leg, never the item.
    // (Trimmed to 0.08 on 2026-09-03 to pay for the approach leg; kept at
    // 0.08 when the recycle leg arrived — the sweep's continuity needs it.)
    watch: 'A coat of clathrin studs the wall and curves it back into a bubble — the same material, pinched off again.',
    share: 0.08,
  },
  {
    // ⚠ THE READINESS PIPELINE ON STAGE (user, 2026-09-03: "display how the
    // vesicle gets ready to be reused, until it gets pumped with NTs").
    id: 'recycle',
    title: 'Taken apart',
    watch: 'NSF lands on the used rope and prises it apart. The coat is shed; every protein walks back to its post.',
    share: 0.07,
    hold: 0.2,
  },
  {
    id: 'refill',
    // ⚠ IT RETURNS EMPTY (user, 2026-09-03: "return empty"). Refilling takes
    // tens of seconds — re-acidification, then the transmitter pumps — and
    // happens up in the crowd, off-stage. The on-screen lift showing the
    // cargo fading back in was the compressed version, and it taught the
    // wrong order.
    title: 'Back to the crowd',
    // ⚠ Grew 0.06 → 0.08 with a hold (user, 2026-09-04: "slow down animation
    // after 'taken apart', add pauses between events") — the tail legs get
    // real screen time and a beat each.
    watch: 'Still EMPTY, it lifts away carrying its parts. A proton pump makes it sour inside — the battery the transmitter pumps will need.',
    share: 0.08,
    hold: 0.2,
  },
  {
    // ⚠ THE EXCHANGE, ON STAGE (user, 2026-09-04: "extend demo to also
    // display protons to neurotransmitter exchange… start frame is identical
    // to closing frame"). Supersedes 20az's "returns empty and stays empty":
    // that was right while refilling was off-stage; the refill trade is now
    // shown, up in the crowd, and the loop closes exactly where it opened.
    id: 'load',
    title: 'Refilled',
    watch: 'The transporter trades sour for sweet: protons out, transmitter in. Full again — exactly where this began.',
    share: 0.1,
    hold: 0.2,
  },
]

/** Where each stage begins and ends in the run, 0→1. Derived from the shares
 *  rather than typed, so the two can never disagree. */
export const STAGE_SPANS: { id: StageId; from: number; to: number; hold: number }[] = (() => {
  const total = STAGES.reduce((sum, s) => sum + s.share, 0)
  let at = 0
  return STAGES.map((s) => {
    const from = at
    at += s.share / total
    return { id: s.id, from, to: at, hold: s.hold ?? 0 }
  })
})()

/** Which stage a position is in, and how far through that stage it is. */
export function stageAt(u: number): { stage: Stage; local: number; index: number } {
  const t = Math.max(0, Math.min(1, u))
  for (const [i, span] of STAGE_SPANS.entries()) {
    if (t < span.to || i === STAGE_SPANS.length - 1) {
      const width = Math.max(1e-9, span.to - span.from)
      return { stage: STAGES[i], local: Math.max(0, Math.min(1, (t - span.from) / width)), index: i }
    }
  }
  return { stage: STAGES[0], local: 0, index: 0 }
}

/** A value that ramps 0→1 across one stage and holds either side of it.
 *  A stage with a `hold` completes its ramp in the FIRST (1 − hold) of its
 *  window and sits at 1 for the rest — the still beat after the event. */
export function through(u: number, id: StageId): number {
  const span = STAGE_SPANS.find((s) => s.id === id)
  if (!span) return 0
  if (u <= span.from) return 0
  if (u >= span.to) return 1
  return Math.min(1, (u - span.from) / ((span.to - span.from) * (1 - span.hold)))
}

/** The u at which `through(u, id)` reaches `f` — the inverse ramp, so a flight
 *  scheduled to land at a model moment (an ion at its site) cannot drift from
 *  the moment the model fills it when a stage carries a hold. */
export function uAtThrough(id: StageId, f: number): number {
  const span = STAGE_SPANS.find((s) => s.id === id)
  if (!span) return 0
  const clamped = Math.max(0, Math.min(1, f))
  return span.from + (span.to - span.from) * (1 - span.hold) * clamped
}

/** How far down the approach the vesicle is, 0 = up in the crowd, 1 = at the
 *  tethered height. Eased at both ends, so it drifts rather than shunts. */
export function descentAt(u: number): number {
  const t = through(u, 'approach')
  return t * t * (3 - 2 * t)
}

/** How lit the Rab's GTP badge is: 1 = carrying GTP ("I am full and ready"),
 *  0 = spent (GDP). It is spent across docking — the moment the SNAREs have
 *  taken over, the tether's evidence is no longer needed. */
export function gtpAt(u: number): number {
  // Spent at docking; RE-ARMED across the load leg (2026-09-04) — the
  // re-arming used to be declared off-stage, and the closing frame now IS the
  // off-stage place (up in the crowd), so the badge relights on screen.
  return Math.max(1 - through(u, 'dock'), through(u, 'load'))
}

/** How firmly the tether holds the Rab, 0→1. It rises to meet the bubble over
 *  the whole approach — reaching the shoulder exactly as the descent ends —
 *  holds through tethering and docking, and lets go across priming: the
 *  hand-over from tether to SNAREs, as a number. (Reaching over the WHOLE leg,
 *  not its second half: the shorter window made the tip the fastest thing on
 *  screen, and the continuity walk caught it.) */
export function tetherHoldAt(u: number): number {
  const t = through(u, 'approach')
  const reach = t * t * (3 - 2 * t)
  return reach * (1 - through(u, 'prime'))
}

/** How far the spent Rab has left the vesicle, 0 = still riding it, 1 = gone.
 *  It is extracted across priming, once its badge is dark — and RETURNS
 *  across the load leg, re-armed, so the closing frame carries the same lit
 *  badge the opening one did. */
export function rabGoneAt(u: number): number {
  return through(u, 'prime') * (1 - through(u, 'load'))
}

/** How open syntaxin is: 0 = folded shut under its minder (Munc18), 1 = opened
 *  by Munc13 and joined to its partners. It opens across docking — which is
 *  the same moment the three separate strands become one loose complex. */
export function syntaxinOpenAt(u: number): number {
  const t = through(u, 'dock')
  return t * t * (3 - 2 * t)
}

/** How much of the zip's own stage the release takes: the sensor's swing off
 *  the rope and the complexin clamp popping off share this one number, so the
 *  two hands are seen to open TOGETHER. */
export const CLAMP_OFF = 0.35

/** How far complexin's arrival has run, 0→1: it comes in over priming's last
 *  quarter. Owned here so the model's presence (`clampAt`) and the scene's
 *  flight path read the SAME window. */
export function clampArriveAt(u: number): number {
  return Math.max(0, Math.min(1, (through(u, 'prime') - 0.75) / 0.25))
}

/** How present the complexin clamp is, 0→1: it arrives over priming's last
 *  quarter, lies across the half-wound rope through the whole calcium count,
 *  and is flicked off over the zip's first strokes. */
export function clampAt(u: number): number {
  const off = Math.min(1, through(u, 'zipper') / CLAMP_OFF)
  return clampArriveAt(u) * (1 - off)
}

/** How far the SNARE complex has wound up, 0→1.
 *
 *  ⚠ IT STOPS AT HALF AND WAITS. That pause is the whole mechanism: priming
 *  gets the complex half-zippered and it is held there — energy stored, nothing
 *  released — until calcium says go. A complex that wound smoothly from nought
 *  to one would be a picture of fusion with no trigger in it. */
export const PRIMED_ZIP = 0.5

export function zipAt(u: number): number {
  const primed = through(u, 'prime') * PRIMED_ZIP
  const fired = through(u, 'zipper') * (1 - PRIMED_ZIP)
  // ⚠ The rope UNWINDS only when NSF takes it apart (the recycle leg) — a
  // spent cis-rope loosening on its own during retrieval was the wrong cause.
  const back = through(u, 'recycle')
  return Math.max(0, primed + fired - back * (primed + fired))
}

/** How far NSF's taking-apart of the spent rope has run, 0→1 (eased): the
 *  rope stays a rope until the machine lands on it. */
export function disassembleAt(u: number): number {
  const t = through(u, 'recycle')
  return t * t * (3 - 2 * t)
}

/** How present the clathrin coat is on the reforming bud, 0→1: it assembles
 *  across retrieval — the coat is what CURVES the wall into a bubble — and is
 *  shed across the taking-apart, once the bubble is free. */
export function coatAt(u: number): number {
  return through(u, 'retrieve') * (1 - disassembleAt(u))
}

/** How many of the sensor's calcium sites are filled — a COUNT, because the
 *  point is that three is not enough.
 *
 *  The exponent is the scene's own `HILL_N` (Dodge–Rahamimoff's fourth power),
 *  not a number typed again here: the sensor in this drawer must be the sensor
 *  the synapse draws. */
export function sitesFilled(u: number): number {
  const filling = through(u, 'trigger')
  const emptying = through(u, 'collapse')
  const held = Math.round(filling * HILL_N)
  return Math.max(0, held - Math.round(emptying * HILL_N))
}

/** How far the sink has run before the membranes actually TOUCH: the first
 *  `SINK_TOUCH` of `poreAt` is the approach to contact — the bubble is still
 *  sealed. Owned here (one copy) and read by the scene's sink geometry, the
 *  cargo, and the exit schedule, so they can never disagree about the moment
 *  a mouth exists. */
export const SINK_TOUCH = 0.15

/** Where `poreAt` saturates during the pore stage (the collapse takes it the
 *  rest of the way to 1). */
export const PORE_MAX = 0.45

/** How wide the fusion pore is, 0 = shut, 1 = fully collapsed into the wall. */
export function poreAt(u: number): number {
  return Math.max(through(u, 'pore') * PORE_MAX, through(u, 'collapse'))
}

/** How far the MOUTH has opened, 0 = the membranes have not fused yet (no
 *  molecule may cross anything), 1 = the release window is over. ⚠ This, not
 *  the raw pore ramp, is what cargo may leave on (user, 2026-09-03: "NTs
 *  start leaving the vesicle too early — visually fly through the membrane"):
 *  the ramp's first `SINK_TOUCH` is the approach to contact, and an exit
 *  scheduled there crossed an intact bilayer. */
export function mouthOpenAt(u: number): number {
  return Math.max(0, Math.min(1, (poreAt(u) - SINK_TOUCH) / (PORE_MAX - SINK_TOUCH)))
}

/** The u at which `mouthOpenAt` reaches `f` — the exit schedule's inverse, so
 *  molecule i can be booked to leave exactly when the mouth is (i+½)/N open. */
export function uAtMouthOpen(f: number): number {
  const c = Math.max(0, Math.min(1, f))
  return uAtThrough('pore', (SINK_TOUCH + (PORE_MAX - SINK_TOUCH) * c) / PORE_MAX)
}

/** How far the vesicle has been pulled onto the wall, 0 = free, 1 = touching.
 *  Docking brings it up; the zip drags it the last of the way. */
export function pressedAt(u: number): number {
  const docked = through(u, 'dock')
  const pulled = through(u, 'zipper')
  return Math.max(0, Math.min(1, docked * 0.7 + pulled * 0.3))
}

/** How many transmitter molecules the drawer follows, each with an identity.
 *  Owned here so the honesty text and the drawing can never disagree. */
export const NT_COUNT = 22

/** How full of transmitter the vesicle is, 0→1. It empties through the pore
 *  and LEAVES THE PICTURE EMPTY (user, 2026-09-03): the retrieved bubble is
 *  bare membrane, and the slow refilling — re-acidification, then the pumps —
 *  happens up in the crowd, off-stage. The bubble that arrives full at the
 *  start of a run was filled there, between cycles. */
/** How far the refill TRADE has run, 0→1: the load leg's first half belongs
 *  to the transporter arriving and the protons leaving; the filling itself
 *  runs over the second half. Owned here so the cargo ledger and the scene's
 *  door schedule read ONE ramp — a dot may not enter before the door exists
 *  (user, 2026-09-04: "NTs enter the vesicle through membrane"). */
export function loadFillAt(u: number): number {
  return Math.max(0, Math.min(1, (through(u, 'load') - 0.5) / 0.5))
}

/** The u at which `loadFillAt` reaches `f` — the trade schedule's inverse, so
 *  molecule i can be booked to seat exactly when the ledger says the bag is
 *  (i+½)/N full again. */
export function uAtLoadFill(f: number): number {
  const c = Math.max(0, Math.min(1, f))
  return uAtThrough('load', 0.5 + 0.5 * c)
}

export function cargoAt(u: number): number {
  // Emptying is keyed to the MOUTH, not the raw ramp: the bag stays full for
  // the whole approach to contact, because nothing can leave a sealed bag.
  // And it FILLS AGAIN across the trade (2026-09-04, superseding "stays
  // empty"): the transporter's exchange is on stage now, so the run ends
  // full — the closing frame is the opening frame.
  return Math.min(1, Math.max(0, 1 - mouthOpenAt(u)) + loadFillAt(u))
}

/** How much of a NEW vesicle has been pinched back off the wall, 0→1. */
export function retrievedAt(u: number): number {
  return through(u, 'retrieve')
}

export const SNARE_PARTS: TeachingPara[] = [
  {
    icon: '🫧',
    text: 'A vesicle is a little sphere of membrane — the same two layers of fat as the wall it is parked against, curved round on itself. That is why this can work at all: two bilayers can join and become one bilayer. A bubble made of anything else could not open into a wall.',
  },
  {
    icon: '🏷️',
    text: 'Before any of that, the vesicle has to be CAUGHT. It wears a badge: a small protein called Rab, holding a molecule of GTP — chemistry for "I am full and ready". A long tether standing on the wall recognises the lit badge and holds the bubble near the wall. Once the SNAREs have taken over, Rab spends its GTP, the badge goes dark, and the tether lets go — one badge, one catch, so the wall only keeps vesicles that are ready.',
  },
  {
    icon: '🧵',
    text: 'Three proteins do the pulling, and they are on both sides. One of them, synaptobrevin, is stuck in the VESICLE — that is the v-SNARE. The other two, syntaxin and SNAP-25, are stuck in the TERMINAL wall — the t-SNARE. They find each other and wind together into a rope — and winding a rope between two things pulls those two things together.',
  },
  {
    icon: '🔓',
    text: 'The wall does not leave its SNAREs lying about ready. Syntaxin starts FOLDED SHUT, held closed by a minder called Munc18 — so ropes cannot start forming just anywhere. At the landing site, Munc13 opens syntaxin up and hands it to its partners. That is why fusion happens exactly where the cell wants it and nowhere else.',
  },
  {
    icon: '⏸️',
    text: 'The rope only winds HALFWAY, and then it stops. That is priming, and it is the cleverest part: the energy is loaded and held, like a drawn bow. Nothing has happened yet, and everything is ready to happen in under a millisecond.',
  },
  {
    icon: '🗜️',
    text: 'Two hands hold the drawn bow. Complexin is a clamp lying across the half-wound rope, and synaptotagmin grips it too while it counts calcium. When the fourth ion lands, both hands open at once — which is how release can be so fast: nothing new has to be built, two holds simply let go.',
  },
  {
    icon: '🧿',
    text: `The thing holding it back is synaptotagmin, and it is a calcium sensor with ${HILL_N} places for calcium to sit. Fill ${HILL_N} of them and it stops holding and starts helping. Three is not enough — which is why a small amount of calcium does nothing at all and a little more does everything.`,
  },
  {
    icon: '🕳️',
    text: 'When the rope finishes winding it drags the two walls into each other until they merge, and a hole opens where they joined. The transmitter goes out through the hole. Nothing was carried across anything — the bag simply became part of the wall and opened.',
  },
  {
    icon: '🪢',
    text: 'After fusion the rope is not destroyed — but now all three proteins sit in the SAME wall, lying flat where the membranes flowed together. Another machine, NSF, spends energy to prise the rope apart so all three can be used again: watch it land on the flat rope and split it, and each strand walk back to its post — synaptobrevin onto the new bubble, syntaxin and SNAP-25 to their stands, ready for the next round.',
  },
  {
    icon: '🧺',
    text: 'The wall does not pinch off a bubble by itself. A coat of clathrin — the pale studs — assembles on the wall and CURVES it into a bud, and the moment the bubble is free the coat is shed and taken back. It is a shape-making tool, used and returned every round.',
  },
  {
    icon: '🔋',
    text: `Before the bubble can be refilled it must be made SOUR inside: a proton pump burns fuel to push H⁺ in — the small red balls — and that acid is the battery. Then the TRANSPORTER spends it: for transmitter to come in, protons must go out, one trade at a time, up in the crowd. Three protons and ${NT_COUNT} transmitter dots stand for an exchange that runs thousands of times. Both machines live in the bubble's wall all along; they are drawn only while they work.`,
  },
  {
    icon: '♻️',
    text: 'And then it is taken back. The wall pinches off a new bubble and sends it back to the crowd EMPTY — refilling is slow work, tens of seconds of trading, and it happens up there between turns. You watch that trade close the loop: the run ends exactly where it began, with a full bubble wearing a lit badge. A terminal firing all day would run out of membrane in minutes otherwise.',
  },
]

export const SNARE_HONESTY: TeachingPara[] = [
  {
    icon: '🧪',
    text: `MEASURED: the ${HILL_N} calcium sites. That is the same number the terminal next door uses, and it is not a guess — it comes from how steeply release depends on calcium, which is one of the most reproduced measurements in the field.`,
  },
  {
    icon: '✏️',
    text: 'NOT MEASURED: the pace. How long each step takes, and exactly how the rope winds, are still being worked out — so what you are watching is the ORDER and the CAST, drawn to a plausible schedule. The order is settled science; the stopwatch is not. The recycling end is squeezed hardest: uncoating, the proteins sorting themselves home, the souring and the refill trade take seconds to minutes each, drawn here in a few breaths.',
  },
  {
    icon: '✏️',
    text: 'The tether is drawn as an arm; in a real terminal it is a small family of proteins (Rab effectors — RIM among them), and the arm here stands for all of them. Rab really does spend a GTP when its work is done — that chemistry is settled — but exactly WHEN in this sequence it spends it is still being worked out; here it is drawn at docking.',
  },
  {
    icon: '💍',
    text: 'TWO of everything are drawn, one each side of the bubble. That is a slice through a RING: the real machinery stands in a circle around the landing site, so it pulls the bubble straight down and the hole opens in the middle. How many of each protein the ring really holds is not settled — estimates for the SNARE ropes run from one to six and more — so this picture commits only to "more than one, arranged around".',
  },
  {
    icon: '🔍',
    text: `And it is enormously magnified. A vesicle is about 40 nanometres across — you could line up a thousand of them across a hair. Here it fills the screen — and the ${NT_COUNT} dots of cargo stand for the few THOUSAND transmitter molecules a real vesicle holds. Once released they drift out of this frame; collecting them again is other machinery's job, outside this picture.`,
  },
]
