// D07 — AMPA AND NMDA: TWO RECEPTORS IN THE SAME MEMBRANE.
//
// The far side of the gap has been a pair of markers since the synapse view
// was built: two glyphs whose job was to say "this is where the receiving cell
// is". D18 made that gap concrete — to show whether a message got through, the
// far side needed a dial bolted on top of it, because the receptors themselves
// could not say anything. This is the first postsynaptic MECHANISM.
//
// One claim, and everything here serves it:
//
//   ⚠ GLUTAMATE IS NOT ENOUGH FOR NMDA. Both receptors catch the same
//     transmitter and both pull their pores open. AMPA then passes ions. NMDA
//     does not — because a magnesium ion is sitting in its throat, and only the
//     VOLTAGE can take it out. So NMDA answers to two things at once, which is
//     what makes it the cell's coincidence detector.
//
// ⚠ THE USER'S DIRECTIONS FOR THIS STEP (2026-09-11): "create side-by-side
// comparison with corresponding layout. emphasize thiming, that NMDA is slow,
// voltage dependency, make Mg block animated, with pauses between actions,
// color-code negative potential, when Mg blocks." The side-by-side was ruled
// over a proposed single shared membrane — recorded in 04 so the reasoning is
// not lost, but the layout is the user's call and this is it.

/** The two ionotropic glutamate receptors this exhibit compares. */
export type ReceptorKind = 'ampa' | 'nmda'
export const RECEPTOR_KINDS: ReceptorKind[] = ['ampa', 'nmda']

// ── the real numbers, so every drawn one can be held against them ───────────
//
// Measured values from the literature, at body temperature:
//
//   AMPA   10–90% rise ~0.4 ms      decay τ ~2 ms
//   NMDA   10–90% rise ~10 ms       decay τ ~60 ms  (NR2A-containing; NR2B is
//                                                    slower still, ~250 ms)
//
// So NMDA is about 25x slower to open and about 30x slower to shut.
export const REAL = {
  ampa: { riseMs: 0.4, decayMs: 2 },
  nmda: { riseMs: 10, decayMs: 60 },
} as const

/** ⚠ HOW MUCH SLOWER NMDA IS DRAWN. The real factor is ~30; drawn at this,
 *  because 30x an AMPA run a child can sit through is most of a minute. It is
 *  the one number in the timing that is not the cell's, and the info block
 *  names it beside the real one. Everything else is derived from it. */
export const SLOW = 5

// ── the run, as legs ────────────────────────────────────────────────────────
//
// ⚠ PAUSES BETWEEN ACTIONS (user, 2026-09-11). Each thing the receptor does is
// followed by a HOLD in which nothing moves, so a child can see what just
// happened before the next thing happens to it. The holds are the exhibit's
// metronome, not the protein's kinetics — so they are the SAME in both panels
// and are NOT multiplied by SLOW. Multiplying them would have made NMDA look
// slow because the exhibit waited longer, which is not the claim.

export type Stage =
  | 'rest'
  | 'arriving'
  | 'seated'
  | 'closing-on-it'
  | 'held'
  | 'opening'
  | 'flowing'
  | 'shutting'

export interface Leg {
  stage: Stage
  ms: number
  /** Whether this leg is the RECEPTOR's own speed (and so scales with SLOW),
   *  or the exhibit's (a hold, or the trip across the cleft, which belongs to
   *  the gap and is identical for both). */
  ownSpeed: boolean
}

/** AMPA's legs, in screen milliseconds. NMDA's are these with every `ownSpeed`
 *  leg multiplied by SLOW — so the two runs can never drift apart by an edit
 *  to one of them. */
const BASE: Leg[] = [
  { stage: 'arriving', ms: 460, ownSpeed: false },
  { stage: 'seated', ms: 200, ownSpeed: false },
  { stage: 'closing-on-it', ms: 180, ownSpeed: true },
  { stage: 'held', ms: 200, ownSpeed: false },
  { stage: 'opening', ms: 200, ownSpeed: true },
  { stage: 'flowing', ms: 460, ownSpeed: true },
  { stage: 'shutting', ms: 280, ownSpeed: true },
]

export const legsOf = (kind: ReceptorKind): Leg[] =>
  BASE.map((l) => ({ ...l, ms: l.ownSpeed && kind === 'nmda' ? l.ms * SLOW : l.ms }))

export const runMs = (kind: ReceptorKind): number =>
  legsOf(kind).reduce((t, l) => t + l.ms, 0)

/** How long the pore is OPEN — from the moment it starts pulling apart to the
 *  moment it is shut again. The number the two panels' bars compare. */
export function openMs(kind: ReceptorKind): number {
  return legsOf(kind)
    .filter((l) => l.stage === 'opening' || l.stage === 'flowing' || l.stage === 'shutting')
    .reduce((t, l) => t + l.ms, 0)
}

/** When in the run the pore starts pulling apart. */
function openStart(kind: ReceptorKind): number {
  let t = 0
  for (const leg of legsOf(kind)) {
    if (leg.stage === 'opening') return t
    t += leg.ms
  }
  return t
}

/** ⚠ HOW LONG THE PORE HAS BEEN OPEN SO FAR — the bar under each panel, and
 *  the reason it is in the model rather than the drawing: it must HOLD after
 *  the run ends. A bar that resets leaves the child nothing to compare, and
 *  comparing the two lengths is what the bars are for. Takes the RAW elapsed
 *  time, not the run-clamped one, so it can still answer after the run. */
export function openedMs(kind: ReceptorKind, rawElapsed: number | null): number {
  if (rawElapsed === null) return 0
  return Math.max(0, Math.min(openMs(kind), rawElapsed - openStart(kind)))
}

/** Both bars are drawn against the SAME scale — the longer of the two runs —
 *  so a bar five times longer is a door open five times longer, with no
 *  arithmetic asked of the child. */
export const BAR_SCALE_MS = (): number => Math.max(...RECEPTOR_KINDS.map(openMs))

/** Which leg this receptor is on, and how far through it. */
export function stageAt(kind: ReceptorKind, elapsed: number | null): { stage: Stage; p: number } {
  if (elapsed === null || elapsed < 0) return { stage: 'rest', p: 0 }
  let t = elapsed
  for (const leg of legsOf(kind)) {
    if (t < leg.ms) return { stage: leg.stage, p: leg.ms <= 0 ? 1 : t / leg.ms }
    t -= leg.ms
  }
  return { stage: 'rest', p: 0 }
}

/** How far the subunits have come apart, 0…1 — a pure function of the leg. */
export function openAt(kind: ReceptorKind, elapsed: number | null): number {
  const { stage, p } = stageAt(kind, elapsed)
  if (stage === 'opening') return p
  if (stage === 'flowing') return 1
  if (stage === 'shutting') return 1 - p
  return 0
}

/** How far the binding socket has closed on the transmitter, 0…1. Once shut it
 *  STAYS shut for as long as the pore is open — the socket closing is what
 *  holds the pore open, so releasing it early would draw a pore held open by
 *  nothing. */
export function boundAt(kind: ReceptorKind, elapsed: number | null): number {
  const { stage, p } = stageAt(kind, elapsed)
  if (stage === 'closing-on-it') return p
  if (stage === 'held' || stage === 'opening' || stage === 'flowing') return 1
  if (stage === 'shutting') return 1 - p
  return 0
}

/** Where the transmitter is on its way across the gap, 0 = just released,
 *  1 = in the socket. It STAYS in the socket while the socket holds it. */
export function arrivalAt(kind: ReceptorKind, elapsed: number | null): number {
  const { stage, p } = stageAt(kind, elapsed)
  if (stage === 'rest') return 0
  if (stage === 'arriving') return p
  if (stage === 'shutting') return 1
  return 1
}

/** Whether the transmitter has let go and drifted off. */
export function releasedAt(kind: ReceptorKind, elapsed: number | null): number {
  const { stage, p } = stageAt(kind, elapsed)
  return stage === 'shutting' ? p : 0
}

// ── the magnesium block ─────────────────────────────────────────────────────
//
// ⚠ THE RIGHT CONSTITUTIVE LAW, NOT THE FAMILIAR ONE. The block is not a
// switch at some voltage; it is an equilibrium, and Woodhull's treatment of a
// charged blocker binding partway down the electric field gives a logistic in
// the membrane potential. Writing it as a threshold would have thrown away the
// very thing the exhibit is about — that this is a matter of DEGREE, which is
// why the plug can be seen riding up and down the throat as the child drags.

/** Extracellular magnesium, mM — the standard physiological figure. */
export const MG_MM = 1
/** RT/F at body temperature (310 K), mV. */
const RT_OVER_F = 26.7
/** How far down the electric field the magnesium sits — Woodhull's δ, measured
 *  at 0.8–0.9 for NMDA, which is why the block is so steeply voltage-sensitive:
 *  the ion feels most of the membrane's field. */
export const MG_DELTA = 0.83
/** The slope of the block, mV per e-fold: RT / (z δ F), with z = 2. */
export const MG_SLOPE_MV = RT_OVER_F / (2 * MG_DELTA)
/** The membrane potential at which half the channels are blocked, at 1 mM
 *  magnesium — measured around −20 mV, and that is the number the exhibit's
 *  whole shape hangs on. */
export const MG_HALF_MV = -17

/** The fraction of open NMDA channels magnesium is sitting in, at a given
 *  membrane potential. 1 = every one blocked, 0 = none. */
export function mgBlock(mv: number): number {
  return 1 / (1 + Math.exp((mv - MG_HALF_MV) / MG_SLOPE_MV))
}

/** ⚠ HOW LONG THE PLUG TAKES TO MOVE. A real magnesium block equilibrates in
 *  well under a millisecond and flickers; this is a journey a child has to be
 *  able to follow, so the plug walks its throat over this. Being a change of
 *  PLACE it is EASED, not stepped — and the easing is written as a per-frame
 *  exponential so it cannot depend on the framerate. */
export const PLUG_TAU_MS = 260

/** How long one blocked-or-clear spell lasts, ms. */
export const BLOCK_WINDOW_MS = 900
/** The share of a spell spent moving between in and out; the rest is a hold, so
 *  each state can be read before the next one happens. */
export const BLOCK_MOVE = 0.22

/** ⚠ HOW DEEP THE MAGNESIUM SITS IN THE THROAT, 0…1 — 1 fully seated and
 *  blocking, 0 lifted clear above the mouth.
 *
 *  ⚠ AND THIS REVERSES 21c-35, at the user's word (2026-09-13: "Do not demo
 *  probability of Mg block, either keep closed or open. Lift or deepen
 *  depending on the voltage"; and for the spine, "Keep Mg block floating above
 *  the channel, do not demo probability, keep open").
 *
 *  21c-35 ruled the opposite: the fraction was spent on how much of the TIME
 *  the stone was in, "never on how far down it hovers", because a single drawn
 *  stone has only its own time to spend and a real block does flicker far
 *  faster than an eye can follow. That is true, and it cost the exhibit the one
 *  reading it exists for: a channel whose stone flickers never looks OPEN. The
 *  report was "NMDA open state is easy to miss", and the flicker was why.
 *
 *  So the fraction is spent on DEPTH now. It is a declared simplification and
 *  the info blocks say so: what the child sees is where the block SITS at this
 *  voltage, which is the thing the dial is for, rather than a coin the app
 *  tosses thirty times a second.
 *
 *  ⚠ IT IS MONOTONE IN THE BLOCK, which is the whole point — turn the voltage
 *  up and the stone rises, turn it down and it deepens, with nothing in
 *  between to read as chance.
 *
 *  ⚠ IT LIVES HERE, not in a scene, because TWO views draw this receptor — the
 *  comparison drawer and the spine — and one protein gets one drawing across
 *  registers. */
export function stoneDepth(plug: number): number {
  return Math.max(0, Math.min(1, plug))
}

// ── the membrane potential the child sets ───────────────────────────────────

export const MV_MIN = -90
export const MV_MAX = 20
export const MV_REST = -70

// ── the state ───────────────────────────────────────────────────────────────

export interface ReceptorsState {
  /** Screen milliseconds since the bench opened. */
  now: number
  /** When the glutamate was released, or null if nothing has been sent. ONE
   *  clock for both panels: the same puff reaches both receptors, so any
   *  difference the child sees belongs to the receptors. */
  firedAt: number | null
  /** The membrane potential, mV — the child's slider, and the only thing in
   *  here they can change continuously. */
  mv: number
  /** How deep the magnesium sits in NMDA's throat, 0 = gone, 1 = right down
   *  in it. Eased toward `mgBlock(mv)`, never set to it. */
  plug: number
}

export const receptorsStart = (): ReceptorsState => ({
  now: 0,
  firedAt: null,
  mv: MV_REST,
  plug: mgBlock(MV_REST),
})

/** Time since the puff, unclamped — null only if nothing has been sent yet.
 *  What the holding bar reads; everything else uses `elapsedFor`. */
export const rawElapsed = (s: ReceptorsState): number | null =>
  s.firedAt === null ? null : s.now - s.firedAt

/** How long this receptor has been running, or null if it is at rest. */
export function elapsedFor(s: ReceptorsState, kind: ReceptorKind): number | null {
  if (s.firedAt === null) return null
  const t = s.now - s.firedAt
  return t >= 0 && t < runMs(kind) ? t : null
}

/** Whether anything is still happening — the button is deaf while it is. */
export const running = (s: ReceptorsState): boolean =>
  RECEPTOR_KINDS.some((k) => elapsedFor(s, k) !== null)

export function receptorsStep(s: ReceptorsState, dt: number): void {
  s.now += dt
  // ⚠ FRAMERATE-INDEPENDENT EASING. `1 - exp(-dt/tau)` is the same journey at
  // 30 fps and at 120; a fixed fraction per frame is not, and a teleport that
  // scales with the frame is the bug this app has already paid for once.
  const k = 1 - Math.exp(-Math.max(0, dt) / PLUG_TAU_MS)
  s.plug += (mgBlock(s.mv) - s.plug) * k
}

/** One puff of glutamate, reaching both receptors at once. Deaf while a run is
 *  still going, so a child hammering the button cannot leave half a run on
 *  screen — and so the pauses stay pauses. */
export function receptorsFire(s: ReceptorsState): void {
  if (running(s)) return
  s.firedAt = s.now
}

export function receptorsSetMv(s: ReceptorsState, mv: number): void {
  s.mv = Math.max(MV_MIN, Math.min(MV_MAX, mv))
}

// ── what each receptor is doing, as one word ────────────────────────────────

export type Reading = 'shut' | 'open' | 'blocked'

/** ⚠ THE READING A CHILD ACTUALLY GOES BY, and it is a THIRD word, not the
 *  absence of the second. "Open" and "blocked" are different states of the
 *  same protein and the exhibit dies if they look alike: a pore standing wide
 *  open with nothing coming through is the single frame this whole bench
 *  exists to put on screen. */
export function readingAt(s: ReceptorsState, kind: ReceptorKind): Reading {
  const open = openAt(kind, elapsedFor(s, kind))
  if (open < 0.5) return 'shut'
  if (kind === 'nmda' && s.plug > 0.5) return 'blocked'
  return 'open'
}

/** How freely ions are getting through, 0…1 — the pore's openness, times what
 *  the magnesium leaves of it.
 *
 *  ⚠ CONDUCTANCE ONLY, NOT CURRENT. The DRIVING FORCE is deliberately not in
 *  here: a real AMPA current shrinks as the membrane depolarises, because it
 *  is heading for its reversal potential near 0 mV, and drawing that would
 *  have AMPA fading out over exactly the range where NMDA wakes up. Both
 *  things are true and both belong on an I–V curve, which is D08's bench. This
 *  exhibit makes ONE claim — the block — and the info block says plainly which
 *  half of Ohm's law is missing. */
export function flowAt(s: ReceptorsState, kind: ReceptorKind): number {
  const open = openAt(kind, elapsedFor(s, kind))
  return kind === 'nmda' ? open * (1 - s.plug) : open
}

// ── the words ───────────────────────────────────────────────────────────────

export const RECEPTORS: Record<
  ReceptorKind,
  { symbol: string; term: string; name: string; icon: string; caption: string }
> = {
  ampa: {
    symbol: 'AMPA',
    term: 'the AMPA receptor',
    name: 'AMPA receptor',
    icon: '⚡',
    caption: 'Catches the chemical and opens at once. Nothing is in its way.',
  },
  nmda: {
    symbol: 'NMDA',
    term: 'the NMDA receptor',
    name: 'NMDA receptor',
    icon: '🪨',
    caption: 'Catches the same chemical, opens slowly — and a magnesium sits in the way.',
  },
}

export const RECEPTOR_PARTS: { icon: string; text: string }[] = [
  {
    icon: '🧲',
    text: 'Both of these sit in the receiving cell’s wall, under the gap, and both catch the SAME chemical. Send some and watch: the chemical lands in a socket, the socket closes on it, and that closing is what pulls the door open. Nothing pushes the door; it is dragged open by the catch.',
  },
  {
    icon: '🐢',
    text: `The two doors are not the same speed. AMPA snaps open and is shut again while NMDA is still opening — and NMDA then stays open long after AMPA has finished. Watch the bars under them: they measure the same thing, so a bar ${SLOW} times longer is a door open ${SLOW} times longer.`,
  },
  {
    icon: '🪨',
    text: 'NMDA has a stone in its throat: a magnesium ion. It is not stuck there — it is HELD there, because the inside of a resting cell is negative and magnesium carries two positive charges. So at rest NMDA can be wide open and still pass nothing at all.',
  },
  {
    icon: '🎚️',
    text: 'Drag the voltage and watch the magnesium climb out. That is the whole trick: NMDA needs the chemical AND a cell that is already excited. It is the part of the synapse that can tell whether two things happened at the same time.',
  },
]

export const RECEPTOR_HONESTY: { icon: string; text: string }[] = [
  {
    icon: '🎚️',
    text: 'The dial goes further than a synapse can. There is a dashed mark on it: that is the least negative one synapse can make itself, working alone, and even there the stone is still in the throat more than half the time. Everything to the right of the mark is you doing what other synapses firing at the same moment — or the cell’s own spike running back out into the dendrite — would have to do. Turn it there and the stone really does come out; that is not a different drawing of the stone, it is the same one at a voltage a single synapse never reaches. The dendritic spine view is the same rule with the dial taken away.',
  },
  {
    icon: '⏱️',
    text: `Really NMDA is about 30 times slower than AMPA to shut (about ${REAL.nmda.decayMs} ms against about ${REAL.ampa.decayMs} ms). Here it is drawn ${SLOW} times slower, because 30 times an AMPA run you can sit through is most of a minute. Everything else about the timing follows from that one number.`,
  },
  {
    icon: '🐌',
    text: `Both are drawn hundreds of times slower than they happen. A real AMPA receptor opens in about ${REAL.ampa.riseMs} ms — a four-thousandth of the time the picture takes over it — and the pauses between the steps are the exhibit’s, so you can see each one. A real receptor does not pause.`,
  },
  {
    icon: '🔢',
    text: `The magnesium is drawn as ONE stone, and how deep it sits is how much of the real block there is at that voltage: at rest about ${Math.round(mgBlock(MV_REST) * 100)} channels in a hundred are plugged, and at ${MG_HALF_MV} mV about half. So the stone sliding up the throat is a real curve, measured the way it really is — magnesium sitting part of the way down the membrane’s electric field — not a door opening at some number.`,
  },
  {
    icon: '🎲',
    text: 'And that share is spent on HOW MANY of the little balls get through, not on how far each one gets. A block of nine in ten does not mean every ion crawls a tenth of the way in — it means nine are turned back at the stone and the tenth goes all the way. So each ball takes its chance afresh every time it comes down, which is why a blocked channel still lets the odd one slip past: a real block flickers, and it is never quite total.',
  },
  {
    icon: '⚖️',
    text: 'What is NOT drawn: how hard the ions are pushed. A real AMPA current gets weaker as the cell depolarises, because there is less left pushing sodium in — so over the range where the magnesium leaves, AMPA is quietly fading. Both are true; this bench draws only the door and the stone, and the other half belongs on a current graph.',
  },
  {
    icon: '🧬',
    text: 'A real receptor of either kind is FOUR subunits round the pore; the drawing shows the two you would see from the side, and the one behind them. NMDA also needs a second small molecule (glycine, or D-serine) present before glutamate can work at all — left out here, because it is always around and never the thing that decides.',
  },
]
