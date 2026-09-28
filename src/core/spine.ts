import { AMPA_REVERSAL_MV, SPINE_REST_MV } from './cleft'
import { PLUG_TAU_MS, mgBlock, stoneDepth } from './receptors'
import { SPAN_NEUTRAL, polarityT } from '../stage/particleStyle'

// S13 — THE RECEIVING SIDE: what one message does, and what a burst does.
//
// D07 taught the magnesium block with a KNOB. This is the same rule with the
// knob taken away: the only thing that depolarises this spine is its own AMPA
// receptors, and the only thing that works them is the child firing the
// terminal above. So the child's hand is the activity, and the cell does the
// rest.
//
// ⚠ WHAT THE ARITHMETIC SAID, AND THE ONE BEAT OF THE USER'S FLOW IT CHANGED
// (2026-09-11). The flow as specified was: one release → depolarisation → "Mg
// block is out" → calcium → CaMKII. The block does not come out. Worked
// through with the app's own EPSP and D07's own Woodhull curve:
//
//   · the voltage a synapse reaches is NOT a sum of its EPSPs. Conductance
//     adds; voltage saturates at the receptors' reversal — `rest + (E − rest) ·
//     g/(g+1)`, which is the honest law and which flattens hard. One release
//     reaches −58 mV; FIVE perfectly overlapping releases reach only −34.5.
//   · half the magnesium leaves at −17 mV. Getting there needs about fifteen
//     units of conductance — a burst no child will deliver, at one synapse.
//
// So "the stone comes out" is the wrong trigger, and it is the wrong BIOLOGY
// too: what sets plasticity off is not an unblocked channel, it is a THRESHOLD
// OF CALCIUM inside the spine. Each release lifts the stone a little, a little
// calcium gets past it, and the calcium ACCUMULATES. A burst crosses the line
// because it keeps the stone part-way up for long enough — helped by NMDA
// being slow, which is the first time that slowness has paid for itself.
//
// The user's narrative is untouched: weak first message, burst, calcium,
// CaMKII, two new receptors, stronger message. Only the trigger moved, from a
// binary event that cannot happen to a threshold that can.

// ── the real numbers ────────────────────────────────────────────────────────

/** An AMPA EPSP at a spine head: rise ~1 ms, decay tau ~10 ms. */
export const REAL_AMPA = { riseMs: 1, decayMs: 10 }
/** NMDA's, from D07 — about ten times slower to rise and six times to fall. */
export const REAL_NMDA = { riseMs: 10, decayMs: 60 }

/** ⚠ HOW MUCH SLOWER THAN LIFE THIS IS DRAWN, and it is ONE number so the two
 *  receptors keep their real ratio to each other. Everything below is a real
 *  millisecond count times this.
 *
 *  ⚠ AND IT IS THE PICTURE'S OWN PACE, MEASURED — not a number of its own
 *  (user, 2026-09-13: "postsynaptic spine is supposed to get red background …
 *  the moment sodium ions enter the cell via AMPA channel. But this does not
 *  happen").
 *
 *  This model's clock unit IS the screen millisecond: `NeuronStage` steps it by
 *  the run's own position (`u × SPINE_SCREEN_MS`), so one unit here is one
 *  millisecond of the drawing. At 70 the spine's electrical life therefore ran
 *  at 70× real time while the picture around it — the vesicle opening, the
 *  transmitter crossing, the sodium going through the wall — played at 275
 *  screen-ms per real-ms. MEASURED off `spineClock` at the leg where the sodium
 *  lands, and 275 either side of it.
 *
 *  The spine's voltage was thus running 3.9× faster than the sodium that causes
 *  it: MEASURED, the head's tint rose at 10.67 s and was gone by 11.94 — 1.3
 *  seconds of a 15.2 second run, which is a flash, not an event.
 *
 *  ⚠ AND THE PICTURE'S OWN 275 CANNOT BE PAID IN FULL. Matching it exactly would
 *  put NMDA's decay at 60 × 275 = 16 500 ms — LONGER THAN THE 15 180 ms RUN — so
 *  every tap in the window would overlap every other and tempo would stop
 *  meaning anything. MEASURED at 275, seven taps latched the cascade at every
 *  spacing from 220 ms to 1.5 s alike, which flatly contradicts what this view
 *  tells the child: "Tap slowly instead and nothing happens, however long you
 *  keep going. It is not how many messages — it is how close together they are."
 *
 *  So the factor is the most of the picture's pace the LESSON can afford, and
 *  that was found by walking it, not guessed:
 *
 *      70 → red holds 1.26 s   1/s: never     (today)
 *     100 → red holds 1.81 s   1/s: never
 *     140 → red holds 2.54 s   1/s: never     ← taken
 *     200 → red holds 3.62 s   1/s: 9 taps    (the lesson starts to go)
 *     275 → red holds 4.46 s   1/s: 7 taps    (the lesson is gone)
 *
 *  140 doubles the time the head stays warm and leaves every claim in the info
 *  block true. `spineScene.test.ts` re-measures both ends of that — the hold and
 *  the tempo line — so neither can be traded away silently.
 *
 *  ⚠ AND EVERYTHING DOWNSTREAM WAS RE-DERIVED FROM IT, not left behind — see
 *  `CA_HALF`. Widening the receptors without moving the threshold would have
 *  made a burst twice as easy, which is the claim the exhibit exists to make. */
export const TIME_FACTOR = 140

export const AMPA_RISE_MS = REAL_AMPA.riseMs * TIME_FACTOR
export const AMPA_DECAY_MS = REAL_AMPA.decayMs * TIME_FACTOR
export const NMDA_RISE_MS = REAL_NMDA.riseMs * TIME_FACTOR
export const NMDA_DECAY_MS = REAL_NMDA.decayMs * TIME_FACTOR

/** ⚠ ONE RECEPTOR'S PEAK CONDUCTANCE, in units where the leak is 1 — CALIBRATED,
 *  not chosen. It is set so that one release through one drawn receptor peaks
 *  at the voltage `core/cleft.ts` already computes for a single vesicle at this
 *  synapse (−58 mV), so the two models cannot drift apart and this view cannot
 *  quietly contradict the one it is reached from. */
export const G_UNIT = 0.2069

/** One drawn receptor stands for the whole synapse's worth of AMPA. A real
 *  postsynaptic density holds tens, and adding one here means adding a third of
 *  them — which is what the info block says. */
export const AMPA_AT_REST = 1
export const AMPA_DELIVERED = 2

/** How fast calcium leaves the spine again — pumps and buffers, lumped.
 *
 *  ⚠ WRITTEN AS A REAL TIME TIMES `TIME_FACTOR`, which is what it always was —
 *  so a pacing change carries it instead of leaving it behind. It was 1800 at a
 *  factor of 70, which is 25.7 real ms; it is 910 at 140, which is 6.5.
 *
 *  ⚠ AND IT IS HELD AT THE REAL VALUE, NOT THE SCREEN ONE, because clearance is
 *  a rate of the cell and not a pace of the drawing — a spine head's calcium
 *  decays with a tau measured around 12 ms at room temperature and a few ms at
 *  body temperature, so 6.5 sits inside the range and 25.7 sits at its cold
 *  end. Following the factor moved it toward the literature, not away.
 *
 *  ⚠ AND IT IS WHAT KEEPS THE TEMPO READING THE RIGHT WAY ROUND. MEASURED at a
 *  factor of 275, where clearance would have stretched to 7068 ms, the calcium
 *  barely cleared inside the run at all and the reading INVERTED — seven taps
 *  needed in quick succession and only six when spread a second apart, which
 *  teaches the opposite of what this view is for. */
export const REAL_CA_CLEAR_MS = 6.5
export const CA_CLEAR_MS = REAL_CA_CLEAR_MS * TIME_FACTOR

// ⚠ WHY THE TRIGGER IS A FOURTH POWER, AND NOT A LINE IN THE SAND.
//
// Counting calcium against a threshold was measured and thrown away: between a
// burst of four taps and one of eight, the calcium only went from 0.113 to
// 0.170 — a ratio of 1.5, with no clean line to draw between them. An exhibit
// whose whole claim is "a burst does what single messages cannot" cannot rest
// on a 1.5x difference, and moving the line by taste would have been picking
// the answer rather than finding it.
//
// The steepness is not missing from the biology, it was missing from the model.
// Calcium does not act on anything directly: it acts through CALMODULIN, which
// binds FOUR calcium ions — so activation goes roughly as the fourth power, and
// that same 1.5x becomes 5x. It is the same fourth-power sensor this app
// already uses at the other end of the gap, where synaptotagmin triggers
// release.
//
// And CaMKII is not merely switched on by it: it is pushed one way by
// calcium/calmodulin and the other by PHOSPHATASES, and only wins when the
// drive outruns them. That opposition is a real switch, it is why brief weak
// activity leaves no trace at all, and it is the same pair that runs backwards
// to make long-term depression (P05).

/** Calcium at which calmodulin is half occupied, in the influx's own units.
 *
 *  ⚠ RE-DERIVED WHEN `TIME_FACTOR` MOVED, not left behind — and the derivation
 *  is the threshold itself, held fixed. It was 0.14 at a factor of 70. Widening
 *  the receptors to 140 doubles what a given number of taps admits, so leaving
 *  this alone would have made the cascade fire on half as many.
 *
 *  ⚠ AND IT IS SOLVED BY BISECTING THE NEAR MISS, not by scaling. The line the
 *  exhibit draws is between SIX taps and SEVEN at the fastest a hand can go, and
 *  the value is bracketed by asking both: six must still fail and seven must
 *  still fire. MEASURED, the bracket is 0.1057 … 0.1193 and this sits in the
 *  middle of it, a 13% margin either side. Above the bracket the exhibit asks
 *  for eight taps; below it, five will do.
 *
 *  A total failure would be no taps at all, which proves nothing — so the guard
 *  in `spineScene.test.ts` pins the pair, not the presence. */
export const CA_HALF = 0.1123
/** Calmodulin's binding sites — the power the drive is raised to. */
export const CAM_SITES = 4
/** How hard the phosphatases push back. CaMKII only climbs while the
 *  calcium/calmodulin drive beats this. */
export const PHOSPHATASE = 0.36

/** How long CaMKII takes to light up once the line is crossed — a molecular
 *  rate, so it rides `TIME_FACTOR` with the receptors it is downstream of. */
export const REAL_CAMK_MS = 6
export const CAMK_MS = REAL_CAMK_MS * TIME_FACTOR
/** …and how long each new receptor takes to arrive and slide into place.
 *  ⚠ NOT ON THE MOLECULAR CLOCK, and deliberately. Receptor delivery really
 *  takes minutes; this number was never a kinetic, it is the pace at which a
 *  bubble can be WATCHED floating to the wall and merging with it. It is an
 *  artifact of the drawing, it is downstream of the latch, and it changes no
 *  threshold — so it is the one constant a pacing change does not spend. */
export const DELIVER_MS = 1500
/** Of that, the share spent travelling to the wall before it fuses; the rest is
 *  the receptor sliding along the membrane into its slot. */
export const DELIVER_FUSE_AT = 0.55
/** ⚠ AND THE LAST OF THE TRAVEL IS THE MERGE ITSELF (user, 2026-09-13's flow:
 *  "floats towards membrane and merges with it, leaving receptor put"). The
 *  carrier used to reach the wall and VANISH, with a receptor appearing in its
 *  place — so the one moment the topology note is about, the moment a
 *  lumen-facing catcher becomes an outward-facing one, was never on screen. */
export const DELIVER_MERGE_SHARE = 0.22

/** ⚠ THE LEAST NEGATIVE ONE SYNAPSE CAN MAKE ITSELF, mV — MEASURED, and the
 *  number that reconciles this view with the comparison drawer (user,
 *  2026-09-13: "'the block lifts, it never opens' … this is not what you have
 *  displayed in 'AMPA & NMDA receptors' drawer. Align across visualisations").
 *
 *  The two are not drawing the block differently: they share `mgBlock` and
 *  `stoneSeated`, and at any given voltage they agree exactly. What differs is
 *  the VOLTAGE EACH CAN REACH. The drawer has a knob that goes to +20 mV, where
 *  the block is 9% and the stone is out nine tenths of the time; a spine driven
 *  only by its own catchers tops out here, where it is still blocking over half
 *  the time.
 *
 *  So the drawer is not wrong — it is showing what happens IF the cell gets
 *  there, and how it gets there is the whole of S13. The alignment is to say so
 *  on the knob: past this mark, the child is turning it somewhere one synapse
 *  cannot take itself. */
export const SPINE_CEILING_MV = -9.3

/** The terminal's own refractory — nothing can arrive faster than this. */
export const TAP_REST_MS = 210

/** ⚠ HOW MANY MESSAGES IN QUICK SUCCESSION IT TAKES — the exhibit's threshold,
 *  and it lives HERE because three places make a claim about it: the story that
 *  sends them, the info block that says the number aloud, and the guard that
 *  pins seven failing against eight firing. *A claim about what the app
 *  contains rots* unless it is kept in exactly one place. */
export const BURST_N = 8

// ── what actually gets past the stone ────────────────────────────────────────
//
// ⚠ THE DRAWN IONS AND THE CALCIUM THAT DRIVES THE CASCADE ARE TWO READINGS OF
// ONE NUMBER. `nmdaFlow` is the whole of it: the calcium that accumulates is its
// integral, and the ions that cross are that same integral QUANTISED. So the
// picture cannot show a trickle while the model counts a flood — and nothing
// about the burst threshold had to be re-tuned to draw them, because the amount
// is computed exactly as it was.
//
// ⚠ AND THE STONE DECIDES EACH CROSSING BY THE RULE THE DRAWING USES.
// `nmdaFlow` carries `1 − plug`, which is the FRACTION of the time the pore is
// clear; `stoneSeated` is whether it is clear AT THIS INSTANT, and it is the
// same call the magnesium's own position is drawn from (D07's, shared). So a
// quantum that comes due while the stone is down WAITS — the ion queues at the
// mouth and slips through on the next lift, which is what the child sees.



/** How much accumulated flow one drawn ion stands for. ⚠ ONE DRAWN ION IS MANY:
 *  a real NMDA receptor passes thousands, and what is drawn is the RATE.
 *
 *  ⚠ AND THE QUANTUM IS AN AMOUNT OF REAL FLOW, so it rides `TIME_FACTOR` too.
 *  `flowed` integrates against the model's clock, so a wider receptor pushes
 *  proportionally more through it; a fixed quantum would simply have drawn twice
 *  as many ions for the same event. 55 at a factor of 70 is this per real ms. */
export const REAL_FLOW_PER_ION = 55 / 70
export const FLOW_PER_ION = REAL_FLOW_PER_ION * TIME_FACTOR
/** ⚠ ONE ION IN THIS MANY IS CALCIUM — and it is an EXAGGERATION, declared in
 *  the info block beside the others. Calcium really carries something like a
 *  tenth of NMDA's current; here it is a half.
 *
 *  ⚠ AND THE NUMBER IS SET BY THE ORDER OF EVENTS, not by taste. MEASURED at
 *  one-in-three, the first calcium got past the stone at 3.6 s and CaMKII had
 *  already latched at 2.8 s — the cascade lighting off a calcium the child
 *  never saw arrive, which is the very thing this step exists to fix. At
 *  one-in-two the first calcium is in at 1.3 s, CaMKII begins to climb at 1.7
 *  and latches at 2.8: cause on screen, then effect. */
export const NMDA_CA_EVERY = 2
/** ⚠ HOW MANY IONS ONE QUANTUM BUYS — a PAIR, because what this receptor has to
 *  say is that it passes BOTH. `nmdaKind` alternates, so a pair is one sodium
 *  then one calcium, through the pore one after the other. */
export const NMDA_PAIR = 2
/** ⚠ HOW LONG ONE ION TAKES TO GET THROUGH THE PORE — DERIVED from the stone's
 *  own spell, never typed. An ion may only cross while the throat is clear, so
 *  the crossing has to FIT INSIDE the clear hold: at 280ms against a 134ms hold
 *  the stone came back down on top of an ion that was still in the pore, which
 *  is precisely the inconsistency the comparison drawer was corrected for on
 *  2026-09-11 ("the Mg block falls back covering the entrance, yet the ions
 *  pass through"). Four fifths of the hold, so it is through and clear. */
export const NMDA_CROSS_MS = 1.5 * TIME_FACTOR
/** …and how long it then takes to reach where it is going inside. */
export const NMDA_SETTLE_MS = 520

/** ⚠ A SODIUM ION THROUGH AN AMPA RECEPTOR, WITH A NAME (21c-72, user: "Ions
 *  should not teleport either. Ideally, ions should have identity").
 *
 *  The sodium used to be `sodiumCast` — a pure function of the run's own
 *  millisecond, which is right for a view where the run plays once. The story
 *  plays thirteen messages through one drawing, and every time a message
 *  restarted, that function was asked for a position at 2.6 ms having just been
 *  asked for one at 17.9: MEASURED, the ions leapt 69 px, from settled deep
 *  inside the cell back out into the gap.
 *
 *  So on this framing the sodium is a LIST instead of a formula. Each ion is
 *  born, crosses, settles and is forgotten on its own clock, and nothing the
 *  picture does to its phase can move one backwards.
 *
 *  ⚠ AND IT IS QUANTISED FROM THE FLOW, never animated beside it — the same
 *  rule the calcium through NMDA already obeys. One drawn ion per
 *  `NA_FLOW_PER_ION` of conductance-time, so the count follows the model and
 *  needs no second tuning: more receptors open for longer means more ions, with
 *  nothing to keep in step by hand. */
/** How long one takes through the pore, and then to reach where it settles. */
export const AMPA_CROSS_MS = 1.5 * TIME_FACTOR
export const AMPA_SETTLE_MS = 4.5 * TIME_FACTOR

/** ⚠ WHERE A SODIUM ION IS IN ITS LIFE (21c-76, user: "let's improve the Na ions
 *  behavior. Give ions identity. Let them go through the channel when the
 *  channel opens. New ions should fade-in when no ions are left in the cleft.
 *  After they penetrated the postsynaptic cell, they should slowly fade out").
 *
 *  ⚠ THERE USED TO BE TWO POPULATIONS AND ONLY ONE OF THEM WAS ALIVE. The ions
 *  WAITING in the gap were `sodiumCast` asked at ms = 0 — a frozen still, so
 *  they jiggled and never went anywhere — and the ones crossing were a separate
 *  list that appeared at the mouth out of nothing. The child could watch a
 *  channel open, see ions standing above it, and see a DIFFERENT ion come
 *  through. One population now, with one life each:
 *
 *    arriving → waiting → crossing → inside → gone
 *
 *  which is also the order the sentence above asks for. */
export type NaStage = 'arriving' | 'waiting' | 'crossing' | 'inside'

export interface NaIon {
  id: number
  /** Which AMPA receptor it waits above and goes through — assigned at birth,
   *  so the ion that crosses is the one the child was already looking at. */
  seat: number
  stage: NaStage
  /** Milliseconds spent in the CURRENT stage. */
  t: number
}

/** How many wait above each receptor. ⚠ A COUNT FOR A COUNT: three receptors
 *  means three doors with their own queues, not one queue used three times.
 *
 *  ⚠ AND IT IS SOLVED AGAINST THE BURST, not chosen. The gap refills only when
 *  it is EMPTY, so a pool too small starves the exhibit exactly where demand is
 *  highest: MEASURED at two per seat, the burst act sent SIX ions against the
 *  spread act's nine — fewer sodium for eight messages close together than for
 *  three spread out, which is the claim this view exists to make, backwards.
 *  At three it is ten against nine, the right way round, and act six sends
 *  eleven against act one's three. */
export const NA_PER_SEAT = 3

/** How long a new one takes to fade in, how long one that has arrived sits
 *  before it starts to go, and how slowly it goes.
 *  ⚠ ALL ON `TIME_FACTOR`, so a pacing change carries them. */
export const NA_FADE_IN_MS = 1.5 * TIME_FACTOR // solved with NA_PER_SEAT, above
export const NA_DWELL_MS = 14 * TIME_FACTOR
export const NA_FADE_OUT_MS = 9 * TIME_FACTOR

/** How long an ion's whole life inside the cell lasts — the drift to where it
 *  settles, the dwell, and the fade. */
export const NA_INSIDE_MS = AMPA_SETTLE_MS + NA_DWELL_MS + NA_FADE_OUT_MS

/** ⚠ HOW SOLID ONE IS RIGHT NOW, 0…1 — the one call, so the drawing cannot
 *  invent a second fade. It rises as it arrives and falls only at the very end
 *  of its life inside; everywhere between, an ion is simply there. */
export function naAlpha(ion: NaIon): number {
  if (ion.stage === 'arriving') return Math.max(0, Math.min(1, ion.t / NA_FADE_IN_MS))
  if (ion.stage !== 'inside') return 1
  const since = ion.t - (AMPA_SETTLE_MS + NA_DWELL_MS)
  if (since <= 0) return 1
  return Math.max(0, 1 - since / NA_FADE_OUT_MS)
}

/** How far through its crossing it is, 0…1 — and how far through the drift to
 *  where it settles, once inside. */
export const naCrossing = (ion: NaIon): number =>
  ion.stage === 'crossing' ? Math.max(0, Math.min(1, ion.t / AMPA_CROSS_MS)) : ion.stage === 'inside' ? 1 : 0
export const naSettling = (ion: NaIon): number =>
  ion.stage === 'inside' ? Math.max(0, Math.min(1, ion.t / AMPA_SETTLE_MS)) : 0

/** How much accumulated AMPA conductance-time one drawn sodium ion stands for.
 *  ⚠ CALIBRATED so a single message through one receptor sends about as many as
 *  the cast used to draw for it, and it rides `TIME_FACTOR` so a pacing change
 *  does not quietly change the count. */
export const REAL_NA_FLOW_PER_ION = 4.1
/** How much of a quantum the FIRST ion waits for — see `spineStep`. */
export const NA_FIRST_SHARE = 0.15
export const NA_FLOW_PER_ION = REAL_NA_FLOW_PER_ION * TIME_FACTOR

export interface NmdaIon {
  id: number
  kind: 'na' | 'ca'
  /** 0…1 through the pore, then 1…2 crossing the head to where it settles. */
  t: number
}


/** ⚠ HOW DEEP THE STONE SITS IN THE THROAT, 0…1 — THE one call, so the drawn
 *  stone and the ions that may pass it cannot disagree. Both ask this.
 *
 *  ⚠ IT IS A DEPTH NOW, NOT A SPELL (21c-74, user: "Keep Mg block floating
 *  above the channel, do not demo probability, keep open"). The block used to
 *  be spent as a fraction of TIME — a coin tossed every spell — and a channel
 *  whose stone flickers never reads as OPEN, which is exactly what was
 *  reported. See `stoneDepth` for the reversal and what it costs.
 *
 *  The reading it gives: at rest the block is 96% and the stone is deep in the
 *  throat; at the reddest a burst can make this spine it is 38% and the stone
 *  has lifted clear of the mouth — visibly out of the way, and visibly still
 *  there, which is the claim this exhibit exists to make.
 *
 *  ⚠ AND A THROAT WITH AN ION IN IT IS NOT BLOCKED. The commitment says the
 *  obvious physical thing: the stone cannot be in the throat while something
 *  else is, so while an ion is crossing it is held clear. */
export const spineStone = (s: SpineState): number => stoneDepth(s.plug) * (1 - s.clear)

/** ⚠ HOW LONG THE STONE TAKES TO GET OUT OF THE WAY and to come back — a
 *  MOVEMENT, so the lift is something the eye follows rather than a state that
 *  switches. Short against a crossing, so it is clear before the ion arrives. */
export const STONE_MOVE_MS = NMDA_CROSS_MS * 0.35

/** ⚠ HOW FAR CLEAR THE STONE MUST BE BEFORE ANYTHING SETS OFF — so the lift is
 *  visibly the CAUSE of the crossing rather than something happening beside
 *  it, and so no ion is ever drawn inside a throat the stone is still in. */
export const STONE_OPEN_AT = 0.9



/** How many quanta are DUE but have not got past the stone — the queue at the
 *  mouth. Capped, because a queue is a reading and not a census. */
export const nmdaWaiting = (s: SpineState): number => Math.max(0, Math.min(3, s.queued))

/** Which kind the n-th ion through is. */
export const nmdaKind = (n: number): 'na' | 'ca' =>
  n % NMDA_CA_EVERY === NMDA_CA_EVERY - 1 ? 'ca' : 'na'

// ── the state ───────────────────────────────────────────────────────────────

export interface Delivery {
  id: number
  /** Milliseconds since it set off. */
  t: number
}

export interface SpineState {
  now: number
  /** When each release happened — the only thing the child puts in. */
  pulses: number[]
  /** How many AMPA receptors are at the synapse. */
  ampa: number
  /** How deep the magnesium sits in NMDA's throat, 0…1. */
  plug: number
  /** Calcium in the spine head, in threshold units. */
  ca: number
  /** How high the calcium has ever been — the trigger is a HIGH-WATER MARK, so
   *  that crossing the line once is enough and the cascade does not un-happen
   *  as the calcium is cleared away. */
  caPeak: number
  /** CaMKII, 0…1. Once up it stays up: this is the lasting change. */
  camk: number
  /** ∫ nmdaFlow dt — the whole of what gets past the stone. The calcium is
   *  this over a thousand; the drawn ions are this in lumps of
   *  `FLOW_PER_ION`. */
  flowed: number
  /** How many drawn ions have set off — so the next one's identity, and its
   *  kind, follow from the flow rather than from a clock of their own. */
  sent: number
  /** How far the stone has been pushed clear by an ion crossing, 0…1. */
  clear: number
  /** When a delivered receptor last finished sliding in — so CaMKII can answer
   *  for it. Null until one has. */
  landedAt: number | null
  /** How many are DUE but still waiting at the mouth — the queue a seated stone
   *  makes, and the other half of a pair while the first is still crossing. */
  queued: number
  /** ∫ (AMPA conductance × receptors) dt — what the sodium is quantised from. */
  naFlowed: number
  /** How many sodium ions have set off, so the next one's name follows. */
  naSent: number
  /** The next free name — ions come and go, so the count cannot supply it. */
  naNext: number
  /** The sodium on its way through the gold receptors, each with a name. */
  naIons: NaIon[]
  /** The ones on their way through and across. */
  ions: NmdaIon[]
  deliveries: Delivery[]
  /** Receptors already delivered, so the cascade fires once. */
  delivered: number
  readyAt: number
  nextId: number
}

export const spineStart = (): SpineState => ({
  now: 0,
  pulses: [],
  ampa: AMPA_AT_REST,
  plug: mgBlock(SPINE_REST_MV),
  ca: 0,
  caPeak: 0,
  camk: 0,
  flowed: 0,
  sent: 0,
  clear: 0,
  landedAt: null,
  queued: 0,
  naFlowed: 0,
  naSent: 0,
  naNext: 0,
  naIons: [],
  ions: [],
  deliveries: [],
  delivered: 0,
  readyAt: 0,
  nextId: 1,
})

// ── what one release does, as a shape ───────────────────────────────────────

/** A conductance that rises and falls — the difference of two exponentials,
 *  normalised to peak at 1. The standard shape, and the one that makes "rise"
 *  and "decay" mean what they say. */
export function waveform(t: number, riseMs: number, decayMs: number): number {
  if (t <= 0) return 0
  const peakAt = ((riseMs * decayMs) / (decayMs - riseMs)) * Math.log(decayMs / riseMs)
  const norm = Math.exp(-peakAt / decayMs) - Math.exp(-peakAt / riseMs)
  return (Math.exp(-t / decayMs) - Math.exp(-t / riseMs)) / norm
}

/** How open this synapse's AMPA receptors are right now, summed over every
 *  release still running, 0…1 per release. */
export function ampaOpen(s: SpineState): number {
  let g = 0
  for (const at of s.pulses) g += waveform(s.now - at, AMPA_RISE_MS, AMPA_DECAY_MS)
  return g
}

/** The same for NMDA — ten times slower to rise, six times slower to fall, so
 *  it is still open long after the AMPA response has gone. */
export function nmdaOpen(s: SpineState): number {
  let g = 0
  for (const at of s.pulses) g += waveform(s.now - at, NMDA_RISE_MS, NMDA_DECAY_MS)
  return g
}

/** ⚠ THE SPINE'S VOLTAGE, BY THE RIGHT LAW. Conductances add; voltages do NOT.
 *  A synapse cannot depolarise past the reversal of the receptors driving it,
 *  however many of them open — and that saturation is exactly why one synapse
 *  cannot unblock its own NMDA receptors, which is the lesson. Adding EPSPs in
 *  millivolts would have made the burst work far too easily and taught the
 *  opposite. */
export function spineMv(s: SpineState): number {
  const g = ampaOpen(s) * s.ampa * G_UNIT
  return SPINE_REST_MV + (AMPA_REVERSAL_MV - SPINE_REST_MV) * (g / (g + 1))
}

/** ⚠ HOW FAR FROM REST THE HEAD HAS BEEN PUSHED, on the app's charge ramp —
 *  and it reads the DEPARTURE FROM REST, not the absolute polarity (user,
 *  2026-09-13: "Na entering the cell should depolarize it, give red tint").
 *
 *  ⚠ THIS IS AN EXAGGERATION AND IT IS DECLARED. A spine head's absolute
 *  voltage never goes positive: MEASURED, one message through one receptor
 *  reaches −58 mV and a burst through three reaches −9.3, so on absolute
 *  polarity the aura runs from −0.77 to −0.13 — blue to slightly-less-blue, a
 *  change the eye cannot read as depolarisation at all. What the child needs to
 *  see is the difference a message makes, so the ramp is stretched over the
 *  range this synapse can actually reach. The millivolts stay in the info block.
 *
 *  `SPINE_TINT_FULL` is the reach a burst through three receptors gets to —
 *  MEASURED, not chosen — so full red means "as far as this synapse goes". */
export const SPINE_TINT_FULL = 0.867

export function spineReach(s: SpineState): number {
  const reach = (spineMv(s) - SPINE_REST_MV) / (AMPA_REVERSAL_MV - SPINE_REST_MV)
  return Math.max(0, Math.min(1, reach / SPINE_TINT_FULL))
}

/** ⚠ …AND THE SAME NUMBER ON THE APP'S RAMP, for anything that wants a signed
 *  polarity rather than a fraction. */
export function spineTintT(s: SpineState): number {
  const x = spineReach(s)
  // ⚠ AND THE FIRST HALF OF THE JOURNEY IS WORTH MORE THAN THE SECOND. The
  // app's ramp runs blue → SLATE → red, so a linear walk spends half its length
  // going from blue to grey, which reads as the colour draining away rather
  // than as the cell warming: measured, one message through one catcher landed
  // on rgb(144, 115, 131) — a mauve indistinguishable from the neutral slate.
  // The curve puts a single message into warm territory and keeps full red for
  // what a burst through three does.
  const rest = polarityT(SPINE_REST_MV)
  return rest + (1 - rest) * x ** 0.7
}

/** ⚠ THE PEAK ONE MESSAGE REACHES, on `spineReach` — MEASURED, by walking a
 *  single tap through `spineStep` at this view's own frame step. It is the
 *  smallest event the exhibit ever has to show, so it is the one the ink is
 *  placed against. Guarded in `spineScene.test.ts`, which re-measures it. */
export const ONE_MESSAGE_REACH = 0.1977

/** ⚠ HOW FAR PAST THE INK'S COOL/WARM CROSSING one message must land. A reading
 *  that lands ON the crossing is the failure being fixed — it is exactly the
 *  colourless middle. A tenth of the walk past it is unmistakably the warm side
 *  and still leaves three tenths of the ramp for the bursts above it. */
export const TINT_MARGIN = 0.11

/** ⚠ THE SHAPE OF THE HEAD'S COLOUR — SOLVED FROM THE INK, not chosen (user,
 *  2026-09-13: "postsynaptic spine is supposed to get red background inside the
 *  spine as a symbol of depolarization … But this does not happen").
 *
 *  The exponent used to be 0.7, and 0.7 was a guess at "the first half of the
 *  journey is worth more than the second". MEASURED, it put one message at
 *  0.381 of the ramp, where the ink is `rgb(129, 160, 197)` — a pale BLUE. The
 *  whole reading was below the crossing: even eight taps only reached 0.743,
 *  `rgb(199, 133, 148)`, a dusty mauve. Nothing this view could do was red,
 *  which is precisely what was reported.
 *
 *  ⚠ AND THE RAMP IS NOT FREE TO BE RE-DRAWN — see `SPAN_NEUTRAL`. Sky and red
 *  are the two inks charge sign is allowed; every saturated colour that could
 *  bow the path away from grey already belongs to an ion. So the ink stays and
 *  the READING moves along it, and the exponent is what the requirement solves
 *  to rather than a number anyone picked:
 *
 *      ONE_MESSAGE_REACH ** TINT_SHAPE === SPAN_NEUTRAL + TINT_MARGIN
 *
 *  Re-pick either ink, re-measure one message, or change the margin, and the
 *  exponent follows on its own. */
export const TINT_SHAPE = Math.log(SPAN_NEUTRAL + TINT_MARGIN) / Math.log(ONE_MESSAGE_REACH)

/** ⚠ HOW RED THE HEAD IS, 0 (cold, at rest) → 1 (as far as this synapse goes) —
 *  and this is the one the DRAWING uses, because the head's colour is a walk
 *  from cold to hot and never passes through neutral. See `chargeSpan`.
 *
 *  ⚠ AND ONE MESSAGE IS WARM WHILE A BURST IS RED — both readings, on one
 *  scale. Measured at this shape: one message lands at 0.70 of the walk
 *  (`rgb(190, 136, 154)`), three taps at 0.85, eight at 0.94
 *  (`rgb(237, 118, 121)`), and full red stays where it was — the ceiling a
 *  synapse reaches only once it has been given more receptors. */
export function spineCharge(s: SpineState): number {
  return spineReach(s) ** TINT_SHAPE
}

/** ⚠ HOW MUCH THERE IS TO READ — the OTHER half of the head's reading, and the
 *  half that carries the SIZE of the event (21c-70).
 *
 *  ⚠ IT MAY NOT FALL TO NOTHING as the cell passes through neutral, which is
 *  exactly when it is doing the thing the view is about — hence the floor.
 *
 *  ⚠ AND IT NO LONGER REDRAWS `spineCharge`. It was `0.5 + 0.5 × spineCharge`:
 *  the same number as the hue, painted twice, which is the app's own "One
 *  number, one picture — or they will disagree". Worse, it left the hue to carry
 *  BOTH readings at once, and the ink has not the range for both — PROVEN, not
 *  guessed:
 *
 *    · one message must land past the ink's cool/warm crossing (0.587), else
 *      the head never reads as depolarised at all, which is the report;
 *    · three catchers must be 0.2 redder than one on the same message;
 *    · three catchers must be 0.2 redder than one on a burst, and a burst
 *      through three must clear 0.9.
 *
 *  MEASURED, those four leave a slot 1.3 points wide — satisfiable only exactly
 *  on the boundary, with no margin. So the two readings are split across the two
 *  channels the wash already has: the HUE says whether the spine is depolarised,
 *  and this says by how much.
 *
 *  It reads `spineReach` — the honest fraction — and NOT the shaped hue, so the
 *  two channels cannot both be bent by one constant. */
export const SPINE_WASH_REST = 0.45

export function spineWash(s: SpineState): number {
  return SPINE_WASH_REST + (1 - SPINE_WASH_REST) * spineReach(s)
}

/** ⚠ THE ALPHA THE HEAD IS ACTUALLY PAINTED AT — the one call, so the guard and
 *  the drawing cannot hold two answers. `synapseScene` asks this rather than
 *  multiplying the peak by the wash itself. */
export const SPINE_WASH_PEAK = 0.5

export function spineHeadAlpha(s: SpineState): number {
  return SPINE_WASH_PEAK * spineWash(s)
}

/** ⚠ HOW MANY AMPA RECEPTORS THE ROW MUST MAKE ROOM FOR, as a CONTINUOUS number
 *  (21c-72, user: "Newly transported AMPAs are overlapped with membrane and do
 *  not get active at ion binding").
 *
 *  The row's width is a function of how many receptors are in it, so when
 *  `ampa` stepped 1 → 2 → 3 the whole density JUMPED: measured, the original
 *  catcher moved 26 px and the NMDA 31 px, in one frame, twice. *Two correct
 *  drawings of one object with nothing in between is a teleport* — and here
 *  both drawings were correct, which is why nothing caught it.
 *
 *  A receptor is not in the row when its carrier fuses; it is in the row when it
 *  has finished SLIDING in. So the count the row is solved from counts a sliding
 *  receptor as the fraction of the way it has come, and it is continuous across
 *  the instant `ampa` increments — at which point that delivery's `slid` is 1
 *  and it leaves the list, so the two changes cancel exactly. */
export function spineAmpaShown(s: SpineState): number {
  let n = s.ampa
  for (const d of s.deliveries) n += deliveryAt(d).slid
  return n
}

/** ⚠ THE TWO CONDITIONS THE PINK RECEPTOR NEEDS, ASKED ONCE (21c-74, user:
 *  "NMDA open state is easy to miss… That it is open after sufficient signal").
 *
 *  This receptor conducts only when BOTH are true, and until now the picture
 *  had nothing that said so: "holding the chemical" and "conducting" looked the
 *  same, and the one state the receptor exists to detect had no mark. *A
 *  coincidence needs a mark of its own.*
 *
 *  ⚠ ONE FUNCTION, because the pips, the lit throat and the glow are three
 *  drawings of it and three answers would disagree. The ligand half comes from
 *  the DRAWN seat window — the cast's, not the model's — so the pip cannot
 *  light before a transmitter is on the page.
 *
 *  `warm` is how far the stone has lifted: 0 while it is seated, 1 when the
 *  throat is clear. `open` is the coincidence itself. */
export function nmdaGate(s: SpineState, ligandSeated: boolean): {
  ligand: boolean
  warm: number
  open: number
} {
  const warm = 1 - spineStone(s)
  return { ligand: ligandSeated, warm, open: ligandSeated ? warm : 0 }
}

/** ⚠ HOW ACTIVATED THE PINK RECEPTOR IS, 0…1 — and "activated" is the
 *  COINCIDENCE, not either half of it (user, 2026-09-13: "display an NMDA
 *  receptor activation … the magnesium block lifts up, opens the channel").
 *
 *  A ligand-bound NMDA at rest is not doing anything: its gate is open and its
 *  throat is plugged. A depolarised spine with no glutamate is not doing
 *  anything either. It conducts only when BOTH are true, which is the whole
 *  reason this receptor is the one that detects coincidence — and until now the
 *  picture had no mark for it, so "bound" and "conducting" looked the same.
 *
 *  It is `nmdaFlow` by another name, given a name because the drawing asks a
 *  question of it that the number alone does not answer. */
export const nmdaLive = (s: SpineState): number => nmdaFlow(s)

/** How much of NMDA is actually passing — open, times what the stone leaves. */
export function nmdaFlow(s: SpineState): number {
  return Math.min(1, nmdaOpen(s)) * (1 - s.plug)
}

/** How hard calcium is driving CaMKII, 0…1 — calmodulin's four sites, as a
 *  Hill curve. The fourth power is what turns a burst that is only half as
 *  much calcium again into one that is five times the signal. */
export function camDrive(ca: number): number {
  const x = (Math.max(0, ca) / CA_HALF) ** CAM_SITES
  return x / (1 + x)
}

// ── the run ─────────────────────────────────────────────────────────────────

export function spineStep(s: SpineState, dt: number): void {
  s.now += dt
  // The magnesium follows the voltage, eased — the same journey, the same time
  // constant and the same curve as the drawer the child met it in.
  const k = 1 - Math.exp(-Math.max(0, dt) / PLUG_TAU_MS)
  s.plug += (mgBlock(spineMv(s)) - s.plug) * k

  // Calcium in through NMDA, out by the pumps.
  const flow = nmdaFlow(s)
  s.ca += (flow * dt) / 1000
  s.ca -= (s.ca * dt) / CA_CLEAR_MS
  s.ca = Math.max(0, s.ca)
  s.caPeak = Math.max(s.caPeak, s.ca)

  // ⚠ THE SAME FLOW, DRAWN, AND IT COMES IN PAIRS (21c-74, user: "alter both,
  // one goes after the other").
  //
  // NMDA passes sodium AND calcium, and it alternated one at a time — measured,
  // the order through the pore was already a perfect `na ca na ca`. Nobody
  // could see it: one ball at a time, seconds apart, is a stream of single
  // ions that happen to differ. A quantum now buys a PAIR, and the pore passes
  // them one after the other, so "this door lets both through" is the rhythm
  // rather than something to be inferred.
  //
  // ⚠ STILL ONE ION IN THE PORE AT A TIME (21c-61). Two at once is not a
  // channel; two in a row is a channel doing its job.
  s.flowed += flow * dt
  while (s.flowed >= (s.queued + s.sent + NMDA_PAIR) * FLOW_PER_ION) {
    s.queued += NMDA_PAIR
  }
  // ⚠ AND NOTHING GATES THE LAUNCH BUT THE PORE ITSELF (21c-74). A depth
  // threshold was tried and it stopped the exhibit dead: MEASURED, a burst
  // through one catcher only takes the block from 96% to 72%, so a stone that
  // had to be more than half out let NOTHING through, ever — no calcium, no
  // cascade, nothing to teach.
  //
  // The block is already in the flow: `nmdaFlow` carries `1 − plug`, so a
  // 72%-blocked channel accumulates its quanta at 28% of the rate and the drawn
  // ions come slowly all by themselves. *Draw a flow by quantising it.* A gate
  // on top of that was the block counted twice.
  // ⚠ AND THE STONE MOVES FIRST, THEN THE ION GOES. The lift is caused by the
  // queue, not by the crossing: a quantum comes due, the stone gets out of the
  // way, and only then does anything set off. Driven the other way round — the
  // stone lifting because an ion was already in the pore — the ion spent the
  // whole lift inside a throat that was still half blocked, which is the
  // 2026-09-11 correction ("the Mg block falls back covering the entrance, yet
  // the ions pass through") happening again while it eased.
  {
    const want = s.queued > 0 || s.ions.some((ion) => ion.t < 1) ? 1 : 0
    s.clear += (want - s.clear) * (1 - Math.exp(-Math.max(0, dt) / STONE_MOVE_MS))
  }
  if (s.queued > 0 && s.clear > STONE_OPEN_AT && !s.ions.some((ion) => ion.t < 1)) {
    s.ions.push({ id: s.sent, kind: nmdaKind(s.sent), t: 0 })
    s.sent += 1
    s.queued -= 1
  }
  for (const ion of s.ions) {
    ion.t += ion.t < 1 ? dt / NMDA_CROSS_MS : dt / NMDA_SETTLE_MS
  }
  s.ions = s.ions.filter((ion) => ion.t < 2)

  // ⚠ THE SODIUM, AS ONE POPULATION WITH ONE LIFE EACH (21c-76).
  //
  // There used to be two, and only one of them was alive: the ions WAITING in
  // the gap were `sodiumCast` asked at ms = 0 — a frozen still that jiggled and
  // never went anywhere — and the ones crossing were a separate list that
  // appeared at the mouth out of nothing. A child could watch a channel open,
  // see ions standing above it, and see a DIFFERENT ion come through.
  //
  //   arriving → waiting → crossing → inside → gone
  //
  // ⚠ AND THE FLOW STILL DECIDES WHEN. *Draw a flow by quantising it*: the
  // quantum picks a waiting ion rather than conjuring a new one, so the count
  // is the model's and the thing that moves is the thing that was there.
  for (const ion of s.naIons) ion.t += dt
  for (const ion of s.naIons) {
    if (ion.stage === 'arriving' && ion.t >= NA_FADE_IN_MS) {
      ion.stage = 'waiting'
      ion.t = 0
    } else if (ion.stage === 'crossing' && ion.t >= AMPA_CROSS_MS) {
      ion.stage = 'inside'
      ion.t = 0
    }
  }
  s.naIons = s.naIons.filter((ion) => !(ion.stage === 'inside' && ion.t >= NA_INSIDE_MS))

  s.naFlowed += ampaOpen(s) * s.ampa * dt
  // ⚠ THE FIRST ONE IS DUE EARLY, and only the first. A quantum is an amount of
  // flow, so a strict `(n + 1) × Q` puts the very first ion a whole quantum
  // after the gate opened — the channel would stand open with nothing going
  // through it, which is the one thing this receptor must never look like.
  // Shifting the whole series by a fraction of a quantum makes the first prompt
  // and leaves the SPACING of every later one exactly Q.
  const row = Math.max(1, Math.round(s.ampa))
  while (s.naFlowed >= (s.naSent + NA_FIRST_SHARE) * NA_FLOW_PER_ION) {
    // ⚠ THE ONE THAT WAS WAITING THERE GOES — and it goes through the receptor
    // it has been waiting above, so the child's eye follows one object rather
    // than losing it and finding another.
    const ready = s.naIons.find((ion) => ion.stage === 'waiting' && ion.seat < row)
    if (!ready) {
      // ⚠ AND THE FLOW DOES NOT BANK UP WHILE THE GAP IS EMPTY. Left to
      // accumulate, a whole batch would be fired the instant it faded in — the
      // queue paying out at once instead of one ion per quantum of current.
      s.naFlowed = Math.min(s.naFlowed, (s.naSent + NA_FIRST_SHARE) * NA_FLOW_PER_ION)
      break
    }
    ready.stage = 'crossing'
    ready.t = 0
    s.naSent += 1
  }

  // ⚠ AND THE GAP REFILLS WHEN IT IS EMPTY, not a trickle at a time (user:
  // "New ions should fade-in when no ions are left in the cleft"). A fresh row
  // fading in together reads as the bath supplying more; one appearing whenever
  // one leaves reads as a conveyor belt.
  if (!s.naIons.some((ion) => ion.stage === 'arriving' || ion.stage === 'waiting')) {
    for (let k = 0; k < NA_PER_SEAT * row; k++) {
      s.naIons.push({ id: s.naNext++, seat: k % row, stage: 'arriving', t: 0 })
    }
  }

  // ⚠ THE TRIGGER IS THE CALCIUM, through calmodulin, against the phosphatases —
  // not the stone coming out, which at one synapse never happens.
  if (s.camk < 1) {
    s.camk = Math.max(0, Math.min(1, s.camk + ((camDrive(s.ca) - PHOSPHATASE) * dt) / CAMK_MS))
    if (s.camk >= 1 && s.delivered === 0) {
      s.delivered = AMPA_DELIVERED
      for (let i = 0; i < AMPA_DELIVERED; i++) {
        // Staggered, so two vesicles do not arrive as one.
        // ⚠ AND EACH STARTS BEHIND A SIGNAL (21c-72, user: "I expected the 2
        // pink glyphs to do some work… They get color, but it's not visually
        // clear what is their role"). The carriers used to set off on the frame
        // CaMKII latched, so the switch and the errand happened at once and
        // neither caused the other on screen. The negative lead is the time the
        // word takes to get there — `deliveryAt` clamps it, so the carrier sits
        // still until it is told.
        s.deliveries.push({ id: s.nextId++, t: -SIGNAL_MS - i * (DELIVER_MS * 0.45) })
      }
    }
  }

  for (const d of s.deliveries) d.t += dt
  // ⚠ A RECEPTOR JOINS THE SYNAPSE WHEN IT HAS FINISHED SLIDING INTO IT, not
  // when its vesicle fuses — it is exocytosed BESIDE the synapse and has to
  // reach the slot before it can do anything (see 01 → D07: receptors are not
  // attracted through space; they diffuse in the plane and are caught).
  const arrived = s.deliveries.filter((d) => d.t >= DELIVER_MS).length
  if (arrived > 0) {
    s.ampa += arrived
    s.deliveries = s.deliveries.filter((d) => d.t < DELIVER_MS)
    // ⚠ AND THE SWITCH IS TOLD (21c-74). The errand had a beginning the child
    // could see and no end: a catcher arrived and nothing referred back to what
    // sent it. One short answering flick closes the loop at the far end.
    s.landedAt = s.now
  }

  // Releases that have finished are dropped, so the sums stay short.
  s.pulses = s.pulses.filter((at) => s.now - at < NMDA_DECAY_MS * 6)
}

/** One message from the terminal above.
 *
 *  ⚠ `delayMs` IS WHEN THE SODIUM WILL BE SEEN TO ARRIVE (21c-67, user: "bg is
 *  blue after Na ions penetrated").
 *
 *  This model and the picture were running on two clocks that had never been
 *  put beside each other. The EPSP starts at the tap and is over in a second or
 *  two — MEASURED, peak at 1.0 s and back to zero by 8. The drawn release runs
 *  on the run's own legged clock, and its sodium does not get inside until
 *  10.9 s. So by the time the child watched sodium enter the cell, the head had
 *  been fully blue again for three seconds: the effect played, and then its
 *  cause was drawn.
 *
 *  The app's own rule, from the round trip on 2026-09-02 ("the sodium didn't
 *  even penetrate the cell, but the yellow aura is already there"): the reading
 *  is paced by the DRAWN ions. Here that is one line — the pulse begins when
 *  the ions land, and the waveform returns zero until then. */
export function spineFire(s: SpineState, delayMs = 0): void {
  if (s.now < s.readyAt) return
  s.readyAt = s.now + TAP_REST_MS
  s.pulses.push(s.now + Math.max(0, delayMs))
}

/** ⚠ HOW LONG CaMKII'S WORD TAKES TO REACH THE STORE. A declared piece of
 *  choreography, not a measured rate: what really happens is that CaMKII
 *  phosphorylates trafficking machinery, over seconds to minutes, and nothing
 *  travels. What the child must be able to see is that the switch is the CAUSE
 *  of the errand — so the cause is given time to arrive before the effect
 *  starts. The info block says so. */
export const SIGNAL_MS = 420

/** How long CaMKII's answering flick lasts when a catcher lands. */
export const LANDED_MS = 520

/** How bright CaMKII's own pulse is right now, 0…1 — it beats once as each word
 *  leaves, and once more as each catcher arrives. ⚠ A COUNT FOR A COUNT: two
 *  carriers, two departures, two answers. */
export function camkPulse(s: SpineState): number {
  let lit = 0
  for (const d of s.deliveries) {
    const q = dispatchAt(d)
    if (q !== null) lit = Math.max(lit, 1 - Math.min(1, q * 3))
  }
  if (s.landedAt !== null) {
    lit = Math.max(lit, Math.max(0, 1 - (s.now - s.landedAt) / LANDED_MS))
  }
  return lit
}

/** How far CaMKII's word has got toward this carrier, 0→1 — or null when the
 *  carrier is already on its way and there is no word left to draw. */
export function dispatchAt(d: Delivery): number | null {
  if (d.t >= 0 || d.t < -SIGNAL_MS) return null
  return (d.t + SIGNAL_MS) / SIGNAL_MS
}

/** How far through its journey a delivery is, 0…1: how much of the float to the
 *  wall it has done, how far through the MERGE, and how far it has since slid. */
export function deliveryAt(d: Delivery): {
  u: number
  fused: number
  merge: number
  slid: number
} {
  const u = Math.max(0, Math.min(1, d.t / DELIVER_MS))
  const mergeFrom = DELIVER_FUSE_AT - DELIVER_MERGE_SHARE
  return {
    u,
    // the float ENDS where the merge begins — the carrier arrives, then opens.
    fused: Math.max(0, Math.min(1, u / mergeFrom)),
    merge: Math.max(0, Math.min(1, (u - mergeFrom) / DELIVER_MERGE_SHARE)),
    slid: Math.max(0, Math.min(1, (u - DELIVER_FUSE_AT) / (1 - DELIVER_FUSE_AT))),
  }
}

/** Whether the lasting change has happened — what the view's reading says. */
export const potentiated = (s: SpineState): boolean => s.ampa > AMPA_AT_REST

// ── the words ───────────────────────────────────────────────────────────────

export const SPINE_PARTS: { icon: string; text: string }[] = [
  {
    icon: '🌱',
    text: 'This is the far side of the gap — the little knob on a dendrite where one message lands. The terminal is the strip along the top; watch a bubble merge into it and the chemical come across. Everything below the gap belongs to the OTHER cell.',
  },
  {
    icon: '✨',
    text: 'The pink catcher lights up only when TWO things are true at once: it is holding the chemical, AND the inside has already been made less negative by the gold ones. Holding the chemical alone does nothing — the stone is in the way. Being less negative alone does nothing — there is no chemical. That is why this one catcher is the one that notices when a lot of messages arrive together, and why nothing lasting happens until they do.',
  },
  {
    icon: '🔌',
    text: 'Two kinds of catcher sit in the wall. The gold ones let sodium in the moment they catch the chemical. The pink one has a stone stuck in its throat, and catching the chemical is not enough to shift it.',
  },
  {
    icon: '🔴',
    text: 'Each message makes the inside a little less negative — watch the blue fade. One message barely moves it. The stone is held there BY the negative inside, so the only way to shift it is to make the cell less negative, and the only thing that can do that is more messages, close together.',
  },
  {
    icon: '🪨',
    text: `Then ${BURST_N} of them arrive in quick succession, and enough calcium slips past the stone to set something off: calmodulin lights, then CaMKII, and the spine sends for more catchers. Two arrive in little bubbles and slide into the busy patch. The very last message in the story is the SAME message as the first — watch it go much further up the bar on the left.`,
  },

  {
    icon: '🐢',
    text: 'Before that, the same kind of messages arrive SPREAD OUT — and nothing lasting happens, however many there are. Watch the head warm and go cold again each time. It is not how many messages, it is how close together they are. That is the whole trick, and it is how a synapse remembers.',
  },

]

/** ⚠ HOW FAR DOWN THE THROAT THE STONE SITS, in the twentieths the info block
 *  speaks in — DERIVED from the same `mgBlock` the picture draws it with, and
 *  spelled out because the child is read to, not shown digits.
 *
 *  ⚠ IT USED TO MEAN "how often", and now it means "how far down" (21c-74).
 *  The number is the same because the block is the same; what changed is what a
 *  single drawn stone spends it on.
 *
 *  ⚠ IT IS INTERPOLATED RATHER THAN TYPED because it ROTS. "Eleven times out of
 *  twenty" was written against a ceiling of −16.4 mV; the ceiling moved to −9.3
 *  when the pacing was re-derived (21c-70) and the prose went on saying eleven,
 *  which is a claim about the model that the model no longer made. */
const TWENTIETHS = [
  'no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty',
]
export const seatedInTwenty = (mv: number): string =>
  TWENTIETHS[Math.max(0, Math.min(20, Math.round(mgBlock(mv) * 20)))]

export const SPINE_HONESTY: { icon: string; text: string }[] = [
  {
    icon: '🪨',
    text: 'The stone is drawn sitting at a DEPTH, and that is a simplification we chose on purpose. A real magnesium block is not one stone resting somewhere — it flickers in and out of the throat far faster than an eye could follow, and what the numbers really mean is the SHARE of that time it spends in the way. Drawing the flicker is truer and it is unreadable: a channel whose stone is jittering never looks open, and whether it is open is the one thing this receptor is about. So the share is drawn as how far down it sits. The amount that gets through is unchanged, and so is everything the calcium does with it.',
  },
  {
    icon: '⏱️',
    text: `Everything here is drawn about ${TIME_FACTOR} times slower than it happens. A real response at a spine rises in a millisecond or so and is over in tens; the slow one, through the pink catcher, really does last several times longer, and that difference is drawn honestly.`,
  },
  {
    icon: '⚡',
    text: 'This view starts at the moment a bubble opens, and what CAUSED it is not here at all. A message arriving at the terminal opens calcium doors in its wall, calcium rushes in, and a sensor on the bubble catches it — no doors, no calcium and no sensor are drawn on this side of the gap, because this view is about what the message DOES when it lands. The vesicle-round-trip view shows the whole of it.',
  },
  {
    icon: '📉',
    text: `The stone never comes all the way out here, however many messages arrive — and that is true, not a limitation. What it does is LIFT, and you can see how far: it sits about ${seatedInTwenty(SPINE_REST_MV)} twentieths of the way down the throat when the cell is at rest, and lifting to about ${seatedInTwenty(SPINE_CEILING_MV)} twentieths at the reddest a burst through three catchers can make it. That is the lift, and it is enough — it is what lets the pink balls in. One synapse cannot do better: the voltage flattens off, because a synapse cannot push past what its own catchers are aiming at. In a real brain the help comes from OTHER synapses firing at the same moment, or from the cell’s own spike travelling back out into the dendrite. If you want to SEE the stone come out, the AMPA & NMDA drawer has a dial that goes where a synapse cannot take itself: there is a mark on it showing where this spine stops.`,
  },
  {
    icon: '📦',
    text: 'The new catchers come from two places, and both are drawn. Deep inside the head are little bubbles holding catchers in reserve — watch one rise and merge into the wall. And out in the wall itself, low down on the stalk, two more are already making their way up: in a real synapse those are often the first to arrive, because they only have to slide along rather than be delivered. So a bubble merging does not put a catcher into the synapse; it puts one into the wall NEXT to it, and the sliding does the rest.',
  },
  {
    icon: '🪜',
    text: 'Watch the two catchers low down on the stalk, on the side of the spine nearest you. They are in the wall already, and they make their way UP it toward the busy patch — but nothing is pulling them. They drift about in the wall the way everything in a membrane does, and they only stop when they reach the patch and something there holds on to them. That is how a synapse gets more catchers: not by fetching them, but by hanging on to the ones that wander past.',
  },
  {
    icon: '🔄',
    text: 'Look which way the catchers face. In the wall, the end that catches the chemical points OUT of the cell — it has to, because that is where the chemical is. But the ones riding inside a bubble face INWARDS, into the bubble. That is not a mistake: a bubble like this is made by a piece of the wall folding inward and pinching off, so the side that used to face out now faces into the bubble. Turn the bubble inside out and it is wall again, the right way round.',
  },
  {
    icon: '🗄️',
    text: 'Both stores are drawn much smaller than they are. A real spine keeps a far bigger reserve than four bubbles, and more of it sits further down in the dendrite below — out of this picture — than in the head itself. What is drawn is enough to show where they come from, not how many there are.',
  },
  {
    icon: '🧂',
    text: 'The pink balls getting past the stone are drawn far commoner than they are. The pink catcher is mostly a sodium channel — calcium is something like a tenth of what goes through it — but calcium is the only one with anywhere to go afterwards, so half the balls you see are pink. What is honest is the TRICKLE: with the stone in the way, a single message gets a ball or two through, and that is all.',
  },
  {
    icon: '🔢',
    text: `One drawn catcher stands for many — a real synapse holds tens of them — so "one becomes three" means the synapse roughly trebled its catchers, not that it went from one molecule to three. The stone is one drawn ion too, and how much of its TIME it spends in the throat is how much of the real block there is at that voltage.`,
  },
  {
    icon: '🧪',
    text: 'The chain from calcium to new catchers is drawn as two lights and a delivery. Really it is calmodulin (four calcium ions bind it), then CaMKII, then a long argument between that and the phosphatases pushing the other way — and the receptors are put into the wall beside the synapse and have to find their way in, which is the sliding you can watch.',
  },
]
