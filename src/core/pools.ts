// D18 — THE VESICLE POOLS, AND WHAT A STRONG SIGNAL COSTS.
//
// ⚠ REBUILT MUCH SIMPLER ON 2026-09-07 (user: "we need to make the picture less
// busy and more quantifiable for a human eye, in particular for a kid… the goal
// is not to demonstrate numbers, it is to make the message clear: we've used
// them all, no signal can be done for a while").
//
// Five bubbles now, not thirteen: three parked at the wall and two in storage
// behind them. And each one stands for a LARGE GROUP of real vesicles, which
// is what makes the picture countable — see `RELEASE_PER_SPIKE` for the one
// place that changes the science, and why leaving it alone would have been the
// dishonest choice.
//
// ⚠ ONE TERMINAL, AND THE CHILD IS THE EXPERIMENT (2026-09-08).
//
// It was two terminals side by side, one fed a single message per tap and the
// other a burst. The user's own testing killed that: "kids would press the fire
// button continuously. This means this behavior might eliminate the need of
// sending five signals consequently on the right side because that's what the
// kid already does."
//
// They were right, and the consequence is bigger than dropping the burst. If
// the child hammers, the CHILD IS THE TRAIN — so a stimulus difference between
// two panels is not merely redundant, it is invisible: a child cannot see that
// one panel is doing something their own finger is not. Two panels were
// answering a question nobody could ask.
//
// So: one terminal, full width, and the child's own tapping is the variable.
// Tap gently and every message gets through for ever; hammer and it runs out
// after as many taps as there are bubbles to count. Same synapse, different
// rate — which is exactly how the experiment is done for real.

import { SINK_TOUCH } from './vesicleCycle'

/** Which pool a vesicle is in.
 *
 *  ⚠ TWO, NOT THREE (2026-09-07). The real division is readily-releasable /
 *  recycling / reserve, and the exhibit drew all three. With five bubbles on
 *  screen that distinction costs more than it gives: what a child needs is
 *  "ready NOW" against "not ready yet", and merging the back two loses nothing
 *  they can use. Declared as a simplification in the info block. */
export type PoolId =
  /** Parked and primed at the wall — it can go on the next message. */
  | 'docked'
  /** Waiting behind, and not available until it has taken a parking space. */
  | 'storage'
  /** Spent: merged into the wall, and away being made ready again. */
  | 'out'

export interface Vesicle {
  id: number
  pool: PoolId
  /** How long it has been in this pool, ms. */
  t: number
  /** ⚠ WHICH PARKING SPACE IT IS IN, and — once it has gone — which one it went
   *  FROM. A fusion has to happen at the space the bubble was actually parked
   *  in: two going at once open the wall in two places, and a wall that parts
   *  in the middle while bubbles merge left and right is a wall parting where
   *  nothing is happening. −1 when it is not at the wall. */
  slot: number
  /** Its place in storage. A bubble keeps the place it holds; a departure
   *  leaves an empty one, and the next arrival takes the lowest empty. */
  rank: number
  /** ⚠ HOW FULL OF TRANSMITTER IT IS, 0→1 (2026-09-08, user: "let's
   *  symbolically fill recovered vesicles with NTs").
   *
   *  A retrieved bubble comes back EMPTY and is refilled — by VGLUT, on the
   *  proton gradient, which the vesicles-and-SNARE bench draws molecule by
   *  molecule. This is that same event at a coarser register, and it is the
   *  step that made the loop a loop: without it a spent bubble reappeared fully
   *  stocked, as if the terminal got its transmitter for nothing. */
  fill: number
}

/** ⚠ HOW MANY OF EACH — and what one of them MEANS.
 *
 *  Three parked, two in storage (user, 2026-09-07). A real terminal keeps a
 *  couple of hundred bubbles, so each one drawn here stands for a large group
 *  of them: these five are the whole pool in the neighbourhood of this patch of
 *  wall, quantised into five countable lumps.
 *
 *  ⚠ AND THAT QUANTISATION IS WHY THE RELEASE RULE HAD TO CHANGE — see
 *  `RELEASE_PER_SPIKE`. */
export const DOCKED_SLOTS = 3
export const STORAGE_N = 2
export const TOTAL_VESICLES = DOCKED_SLOTS + STORAGE_N

/** ⚠ HOW MUCH ONE MESSAGE SPENDS: one parked bubble, every time.
 *
 *  ⚠ THIS REPLACED A COIN FLIP, and the change is a correction rather than a
 *  simplification. Release probability is a property of an INDIVIDUAL vesicle —
 *  a few tenths at a typical central synapse — and the old model gave every
 *  parked bubble its own chance at it. That was right when a bubble was a
 *  bubble. It became wrong the moment one bubble came to stand for hundreds:
 *  average a coin flip over a large group and the released FRACTION stops being
 *  random, which is exactly why two identical taps used to give different
 *  answers and the picture could not be counted.
 *
 *  So a message spends a fixed share of what is parked. Raised with the user
 *  2026-09-07 as a science/logic violation; they chose the clearest cause-and-
 *  effect chain, which is also the honest one at this scale. */
export const RELEASE_PER_SPIKE = 1

/** ⚠ HOW MANY TRANSMITTER MOLECULES A BUBBLE CARRIES, drawn. A declared stand-in
 *  of the same kind as the counts: a real glutamate vesicle holds a couple of
 *  thousand. What must be true — and is — is that the cargo is IN the bubble
 *  from its first frame and leaves through the mouth when the bubble opens,
 *  never appearing out of nowhere in the gap. */
export const NT_PER_VESICLE = 5

/** ⚠ HOW LONG ONE FUSION TAKES ON SCREEN, ms. The drawing of it is the SNARE
 *  bench's own — `fusedCentreFor` and `omegaRing`, one fusion in the app — but
 *  the SCHEDULE is this exhibit's. A real fusion takes about a millisecond;
 *  fourteen hundred of them is the most stretched thing on the screen, and the
 *  info block says so.
 *
 *  ⚠ SHORTENED FROM 3000 (2026-09-07). It has to be comfortably shorter than
 *  the gap between two deliberate presses, so a child tapping at their own pace
 *  sees each merge begin and end rather than watching them pile up; and it has
 *  to be shorter than the terminal's own refractory would allow a train to be,
 *  or hammering draws nothing but overlap. The bubbles are twice the size they
 *  were, which buys back much of what the shorter merge costs. */
export const FUSE_MS = 800

/** ⚠ HOW LONG A RELEASED BUBBLE'S CARGO IS ON SCREEN, ms — long enough for the
 *  last ball to empty out, cross the gap and be taken up on the far side. It
 *  does NOT have to outlast the fusion: the bubble goes on merging into the
 *  wall for a while after it is empty, which is what really happens. */
export const CARGO_MS = 1000

/** ⚠ WHEN A PARKING SPACE IS FREE AGAIN, as a fraction of the fusion.
 *
 *  Not 1. A real fusion clears its site in about a millisecond; the seconds
 *  this exhibit spends on one are demonstration, and holding the space for all
 *  of them is an artifact of the DRAWING. What the picture needs is only that a
 *  fresh bubble is not painted on top of one still standing proud of the wall,
 *  and the criterion is "a remnant smaller than a molecule" rather than zero.
 *
 *  ⚠ IT MOVED WITH THE BUBBLE'S SIZE (0.92 → 0.94 on 2026-09-08). The remnant
 *  is a fraction of the bubble's radius, so when one panel became full width
 *  and the bubbles grew from 51 px to 62.5 the same fraction left 2.7 px proud
 *  against a 2.29 px lipid head. A scene guard measures it rather than trusting
 *  this number, which is how the drift was caught. */
export const SITE_CLEAR_P = 0.94

/** ⚠ THE FLASH'S FLIGHT, ms — DERIVED, not chosen. The message sweeps down the
 *  terminal and has to LAND exactly as the bubble it triggers touches the wall,
 *  or the wall opens before the message arrives. Contact is `SINK_TOUCH` of the
 *  way through a fusion, so the flight is that same fraction of `FUSE_MS`.
 *
 *  ⚠ AND EVERY FLASH IS THE SAME SIZE. A strong signal is MORE messages, never
 *  a bigger one — action potentials are all-or-none, which the spike-train
 *  bench already teaches. Put to the user 2026-09-06 against their own
 *  suggestion of a big flash for a big message; they chose the honest one. */
export const FLASH_MS = Math.round(SINK_TOUCH * FUSE_MS)

/** ⚠ HOW LONG A SPACE TAKES TO FILL FROM STORAGE, ms. Docking and priming is
 *  hundreds of milliseconds in life, and this is drawn honestly. It is the fast
 *  step — the one a strong signal outruns. */
export const REDOCK_MS = 620

/** ⚠ AND HOW LONG A SPENT BUBBLE TAKES TO COME BACK, ms — retrieval and
 *  refilling, the slow one. Really tens of seconds; compressed hard so a child
 *  does not have to wait, and the info block says so. It must outlast the
 *  fusion, or a bubble would rejoin the crowd while still merging into the
 *  wall. What is honest is the ORDER: coming back is many times slower than
 *  parking, which is the whole reason a terminal can run out.
 *
 *  ⚠ AND IT SETS WHERE THE LINE BETWEEN GENTLE AND HARD FALLS. Five bubbles
 *  coming back over this long is a ceiling of about one message a second: tap
 *  slower than that and the terminal keeps up for ever, tap faster and it runs
 *  down. That threshold is the whole experiment now that the child is the one
 *  running it, so it is set where a deliberate press stays comfortably on the
 *  safe side and hammering is comfortably past it. Still a heavy compression of
 *  the tens of seconds retrieval really takes. */
export const RECOVER_MS = 4200

/** ⚠ HOW LONG A RETRIEVED BUBBLE STAYS EMPTY BEFORE IT STARTS TO FILL, ms
 *  (2026-09-08, user: "vesicle look to be born with NTs in. Let them appear
 *  after certain time after vesicle birth").
 *
 *  Filling used to begin on the frame a bubble arrived, so the first ball was
 *  already a third of the way in before a child could see the bubble was empty
 *  — it read as arriving stocked. It now comes back, travels to its place, and
 *  sits there visibly empty for long enough to be noticed before anything
 *  appears in it. The glide takes about a second, so this is timed to let the
 *  bubble arrive and settle first. */
export const FILL_DELAY_MS = 600

/** ⚠ AND HOW LONG THE FILLING ITSELF TAKES, ms.
 *
 *  ⚠ THE TWO TOGETHER NOW OUTLAST `REDOCK_MS`, which they did not before, so a
 *  returning bubble waits on its transmitter rather than on the parking clock:
 *  refilling has become the slow step of coming back. That is honest — a
 *  vesicle with nothing in it is not releasable however well parked — and it
 *  costs the exhibit's tuning very little, because it lengthens only the tail
 *  of a recovery that is already the slow part. The sustainable rate is guarded
 *  either way. */
export const FILL_MS = 400

/** ⚠ THE TERMINAL'S OWN REFRACTORY, ms — the shortest gap it will allow between
 *  two of its messages, however fast the button is pressed.
 *
 *  It is real: an axon cannot fire again immediately after firing, and this is
 *  that. It is also what keeps the child's wrist from becoming the whole model.
 *  Hammering asks more often; the terminal answers at its own top speed of
 *  about four a second, which is fast enough to run it dry in a couple of
 *  seconds and slow enough that a deliberate press is never swallowed. */
export const TAP_REST_MS = 250

/** ⚠ WHAT A TAP OWES THE TERMINAL, given what it is already owed.
 *
 *  It used to ADD, with no ceiling, so twenty impatient clicks bought a hundred
 *  messages and the terminal went on answering a conversation the child had
 *  finished (user, 2026-09-07). A tap can never leave more owed than one tap's
 *  worth. */
export const tapQueue = (queued: number, owe: number): number =>
  Math.min(queued + owe, owe)



export interface PoolsState {
  ves: Vesicle[]
  /** Message times, newest last, ms on the state's own clock. */
  spikes: number[]
  /** The state's own clock, ms since it started. */
  now: number
  /** How many bubbles the last message managed to send, and when. */
  lastRelease: { n: number; at: number } | null
  /** Every release so far, newest last: the record the thinning is judged by. */
  history: number[]
}

export function poolsStart(): PoolsState {
  const ves: Vesicle[] = []
  let id = 0
  // A rested terminal opens with everything stocked.
  for (let i = 0; i < DOCKED_SLOTS; i++)
    ves.push({ id: id++, pool: 'docked', t: 0, slot: i, rank: i, fill: 1 })
  for (let i = 0; i < STORAGE_N; i++)
    ves.push({ id: id++, pool: 'storage', t: 0, slot: -1, rank: i, fill: 1 })
  return { ves, spikes: [], now: 0, lastRelease: null, history: [] }
}

export const countIn = (s: PoolsState, pool: PoolId): number =>
  s.ves.filter((v) => v.pool === pool).length

/** ⚠ THE LOWEST PLACE NOBODY IS STANDING IN. A bubble keeps its place for as
 *  long as it holds it, a departure leaves an EMPTY place, and the next arrival
 *  takes the lowest empty one. Only the bubble that is actually going somewhere
 *  moves — and the holes left behind are the reading: how many have gone is
 *  something a child can count. */
export function lowestFreeRank(s: PoolsState, pool: PoolId): number {
  const taken = new Set(s.ves.filter((v) => v.pool === pool).map((v) => v.rank))
  let i = 0
  while (taken.has(i)) i++
  return i
}

/** ⚠ THE BUBBLES CAUGHT IN THE ACT — the ones that have gone but are still
 *  merging into the wall, with how far through each is (0→1) and the space it
 *  is merging at. */
export function fusingAt(s: PoolsState): { v: Vesicle; p: number; slot: number }[] {
  const out: { v: Vesicle; p: number; slot: number }[] = []
  for (const v of s.ves) {
    if (v.pool !== 'out' || v.t >= FUSE_MS) continue
    out.push({ v, p: Math.max(0, Math.min(1, v.t / FUSE_MS)), slot: v.slot })
  }
  return out
}

/** ⚠ THE MESSAGES STILL ON THEIR WAY DOWN — one per message in flight, 0 = just
 *  fired at the top, 1 = landed at the wall. */
export function flashesAt(s: PoolsState): number[] {
  const out: number[] = []
  for (const at of s.spikes) {
    const p = (s.now - at) / FLASH_MS
    if (p >= 0 && p <= 1) out.push(p)
  }
  return out
}

/** ⚠ ONE MESSAGE. It spends `RELEASE_PER_SPIKE` of whatever is parked — and
 *  nothing at all when the row is empty, which is the exhibit's whole point:
 *  running out is not a rule applied to the terminal, it is what happens when
 *  there is nothing left to spend. */
export function poolsSpike(s: PoolsState): number {
  const parked = s.ves
    .filter((v) => v.pool === 'docked')
    .sort((a, b) => a.slot - b.slot)
  const n = Math.min(RELEASE_PER_SPIKE, parked.length)
  for (let i = 0; i < n; i++) {
    parked[i].pool = 'out'
    parked[i].t = 0
    // It keeps its slot: the fusion happens where the bubble was parked.
  }
  s.spikes.push(s.now)
  s.lastRelease = { n, at: s.now }
  s.history.push(n)
  return n
}

/** Time passing: spent bubbles come back to storage, and storage takes any
 *  parking space that has come free.
 *
 *  ⚠ IT TAKES THE TIME IT IS GIVEN. This used to clamp dt itself, and a guard
 *  caught it: a model that quietly swallows time cannot be walked by a test.
 *  The frame clamp belongs to the caller, and the bench has it. */
export function poolsStep(s: PoolsState, dtMs: number): void {
  const dt = Math.max(0, dtMs)
  s.now += dt
  for (const v of s.ves) v.t += dt
  // Refilling: a bubble that is back in the terminal sits empty for a moment,
  // and then fills up.
  for (const v of s.ves) {
    if (v.pool === 'out' || v.fill >= 1) continue
    if (v.t < FILL_DELAY_MS) continue
    v.fill = Math.min(1, v.fill + dt / FILL_MS)
  }

  // Spent bubbles are retrieved and refilled — they rejoin storage.
  for (const v of s.ves) {
    if (v.pool === 'out' && v.t >= RECOVER_MS) {
      v.pool = 'storage'
      v.t = 0
      v.slot = -1
      v.rank = lowestFreeRank(s, 'storage')
      // ⚠ IT COMES BACK EMPTY. The membrane has been retrieved; the transmitter
      // has not — that is pumped in afterwards, and the child watches it happen.
      v.fill = 0
    }
  }

  // ⚠ A SPACE IS A PLACE, not a count — and it is not free while a bubble is
  // still merging out of it, or a new one would be drawn on top of one that is
  // half-flattened into the membrane.
  const taken = new Set<number>()
  for (const v of s.ves) {
    if (v.pool === 'docked') taken.add(v.slot)
    if (v.pool === 'out' && v.t < FUSE_MS * SITE_CLEAR_P) taken.add(v.slot)
  }
  const spare: number[] = []
  for (let i = 0; i < DOCKED_SLOTS; i++) if (!taken.has(i)) spare.push(i)
  if (spare.length === 0) return

  const queue = s.ves.filter((v) => v.pool === 'storage').sort((a, b) => b.t - a.t)
  for (const v of queue) {
    const slot = spare.shift()
    if (slot === undefined) break
    // ⚠ AND AN EMPTY BUBBLE CANNOT BE PARKED. Since 21c-28 this really does
    // hold a bubble up — filling now outlasts the parking clock — which is the
    // honest order: a vesicle with nothing in it is not releasable however well
    // parked it is.
    if (v.t < REDOCK_MS || v.fill < 1) {
      spare.unshift(slot)
      continue
    }
    v.pool = 'docked'
    v.slot = slot
    v.rank = slot
    v.t = 0
  }
}

// ── the words ───────────────────────────────────────────────────────────────

export const POOLS_PARTS: { icon: string; text: string }[] = [
  {
    icon: '⚡',
    text: 'Tap the lightning to send a message down the terminal. Tap it as often as you like — that is the whole experiment, and YOU are running it.',
  },
  {
    icon: '🫧',
    text: `Count the bubbles first. ${DOCKED_SLOTS} are parked at the wall, ready to go, and ${STORAGE_N} more wait in storage behind them. Every message sends exactly one parked bubble — so ${TOTAL_VESICLES} bubbles means ${TOTAL_VESICLES} messages before there is nothing left.`,
  },
  {
    icon: '💥',
    text: 'When a message reaches the bottom, a parked bubble merges into the wall — its skin joins the wall’s skin, a mouth opens, and the chemical inside spills into the gap and crosses to the next cell.',
  },
  {
    icon: '⏱️',
    text: 'The dial in the corner is the next cell’s answer. Below the line the needle is grey — something arrived, but not enough. Past the line it turns YELLOW and sparkles: the message was heard. A message that found no bubbles left does not move the needle at all.',
  },
  {
    icon: '🐢',
    text: 'Now tap SLOWLY — about one press a second. Every single message gets through, and it can go on for ever: bubbles come back as fast as you spend them.',
  },
  {
    icon: '🔥',
    text: `Now HAMMER it as fast as you can. Watch the parked row empty, then storage empty, and then — after about ${TOTAL_VESICLES} presses — the messages keep arriving and NOTHING happens. No bubble goes. Nothing crosses. The dial stays grey. You have spent everything it had.`,
  },
  {
    icon: '🔁',
    text: 'Stop and wait. The bubbles come back one by one — and watch closely: each one arrives EMPTY and stays empty for a moment while it travels to its place. Then its little balls of chemical appear inside it, one after another, until it is full. Only THEN can it park at the wall and be sent. Refilling is the slowest part of coming back.',
  },
  {
    icon: '🔬',
    text: 'The two shapes set into the bottom membrane are glutamate receptors — doors that open when the chemical lands on them. The little balls drifting in the gap are sodium and calcium, the things those doors let through.',
  },
]

export const POOLS_HONESTY: { icon: string; text: string }[] = [
  {
    icon: '🔢',
    text: `A real terminal keeps a couple of hundred bubbles, and it never runs completely dry — there is always a little left. Here ${TOTAL_VESICLES} are drawn, and each ONE stands for a big crowd of real ones. So "the last bubble has gone" really means "this patch of wall has spent what it had nearby", not "the synapse is dead".`,
  },
  {
    icon: '⏱️',
    text: `Parking a bubble takes a fraction of a second and that is drawn honestly (${REDOCK_MS} ms). Getting a spent one all the way back really takes tens of seconds; here it takes ${(RECOVER_MS / 1000).toFixed(1)} s so you do not have to wait — but it is still several times slower than parking, which is the part that matters.`,
  },
  {
    icon: '🐢',
    text: `Merging into the wall is drawn slowly on purpose — ${(FUSE_MS / 1000).toFixed(1)} seconds, so you can watch it happen. A real one takes about a THOUSANDTH of a second. And however fast you press, the terminal will not fire two messages closer than ${TAP_REST_MS} ms apart: a real axon cannot either, and that is called its refractory period.`,
  },
  {
    icon: '🏭',
    text: `Refilling a bubble is drawn as its chemical simply appearing inside, after it has sat empty for a moment. Really a pump in the bubble's own skin hauls the transmitter in one molecule at a time, on a gradient the cell pays for — the vesicles-and-SNARE bench shows that pump doing it. Here the balls stand for thousands of molecules, so what you see is the amount going up, which is the honest way to draw a concentration.`,
  },
  {
    icon: '🎯',
    text: 'Every message sends exactly one parked bubble — no luck involved. A single real vesicle either goes or does not, with a chance of a few tenths; but each bubble here stands for hundreds, and when you average hundreds of coin flips the answer stops being lucky and becomes a steady share. Drawing it as a dice roll would have been the less honest choice.',
  },
]
