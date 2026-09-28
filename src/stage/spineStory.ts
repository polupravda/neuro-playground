import type { CleftRun } from '../core/cleft'
import type { SynapseRun } from '../core/synapse'
import {
  AMPA_AT_REST,
  AMPA_DELIVERED,
  BURST_N,
  TAP_REST_MS,
  spineFire,
  spineReach,
  spineStart,
  spineStep,
} from '../core/spine'
import { SPINE_SCREEN_MS, spineClock, spineNaLagMs } from './spineScene'

// S13's STORY — the whole lesson in ONE run.
//
// ⚠ WHY THIS EXISTS (user, 2026-09-13: "It's not clear for a kid what has to be
// done, so the kid played once. We need to pack everything in one animation").
//
// The exhibit's claim needs a BURST, and the burst was the child's to produce:
// press ⚡ eight times in quick succession and the cell potentiates. Two things
// were wrong with that, and the second is the worse one.
//
//   · nothing told the child to do it, so most of them pressed once and left;
//   · and even a child who did it right saw ONE drawn release. The model
//     counted eight messages; the picture had no notion of a second one
//     arriving later, so "close together" was never on screen at all.
//
// So the run tells the story itself, and the child's hand becomes an amplifier
// rather than a prerequisite. The app's own rule is what asks for this: *a
// comparison must survive the child — an input should TRIGGER a behaviour, not
// inject one, or the user's wrist becomes the dominant variable.* Driven at the
// "presses once" extreme, this exhibit taught nothing.
//
// ⚠ AND THE PACING UNLOCK WAS OFFERED AND DOES NOT SURVIVE THE ARITHMETIC.
// Scripting the messages frees `TIME_FACTOR` from the wrist, so 275 — the
// picture's own pace — looked affordable at last. It is not, for a new reason:
// act two must show the head WARMING AND COOLING between messages, so its
// spacing has to exceed the time the head stays warm — and that time scales
// with `TIME_FACTOR` exactly as the red's dwell does. At 275 the head is warm
// 4.5 s, so act two's three messages would need 16.5 s of screen. Raising the
// factor buys the dwell and spends it again on the act that must out-wait it.
// `TIME_FACTOR` stays at 140 and the chain derived from it is untouched.

// ── the clock ───────────────────────────────────────────────────────────────
//
// ⚠ THE STORY HAS LEGS, for the same reason the round trip does: *a run's clock
// follows the interest, not the model's even time.* Here it is not a saving, it
// is the only way the act works at all.
//
// The burst must be CLOSE TOGETHER for the model — 260 ms apart, or the calcium
// never stacks and the cascade never fires — and it must be SLOW ENOUGH TO
// WATCH for the child, because eight releases 260 ms apart is a blur in which
// no bubble is ever seen to open. That is one number pulling two ways, and a
// leg is what separates them: the model still gets its 260 ms gaps, and each of
// them is given 611 ms of screen.
//
// ⚠ DECLARED, not smuggled — this is choreography, and the info block says so.
// Slow the leg, never the item: inside a leg nothing changes pace.

/** How much screen time one model millisecond of the BURST is given. */
export const BURST_STRETCH = 3.0
/** …and of the cascade, for the same reason: the latch and the delivery are the
 *  payload of their acts, and the model runs through both in about two
 *  seconds. */
export const CASCADE_STRETCH = 2.1

/** ⚠ HOW MUCH OF THE RELEASE A REPEAT SHOWS. The first message and the last get
 *  the whole window; the ones between are messages the child has already
 *  watched in full, so they keep only the legs that are ACTING — the bubble
 *  opening, the transmitter crossing, the catchers binding, the sodium getting
 *  in — and drop the long clearing tail. *Reusing a picture means inheriting
 *  its clock; keep only the legs you can act.*
 *
 *  ⚠ IT MUST COVER THE SODIUM, or a repeat draws a cause with no effect — so it
 *  is solved against the measured landing rather than chosen. */
export const REPEAT_MARGIN = 0.08

/** ⚠ HOW FAR APART THE SPREAD MESSAGES ARE — SOLVED from two requirements, not
 *  picked.
 *
 *  · it must be long enough that the head visibly COOLS between them, which is
 *    the whole reading of this act — and "visibly" means back across the ink's
 *    own cool/warm crossing, not merely a little lower. MEASURED by walking the
 *    dips: 2400 → 0.53, 2800 → 0.50, **3200 → 0.47**, 5200 → 0.34, against a
 *    crossing at 0.587 and peaks of 0.70. All of them dip below it, so what
 *    decides is what the act COSTS: at 5200 this act ran 15.6 s, most of it
 *    watching nothing, which is the boring stretch a story cannot afford.
 *  · and it must never fire the cascade. MEASURED, at this `TIME_FACTOR` a
 *    train at 1000 ms never latches however long it runs, and none of the gaps
 *    above latched either — so the cooling is the binding requirement. */
export const SPREAD_GAP_MS = 3200
export const SPREAD_N = 3
/** How much of that gap is spent drawing, so the rest of it is visibly QUIET.
 *  ⚠ Stillness is what makes motion readable — at 0.8 the terminal released
 *  almost continuously and the act read as one long message. */
export const SPREAD_PLAY_SHARE = 0.55

/** ⚠ AND HOW CLOSE THE BURST'S ARE, in the MODEL's own ms — the terminal's own
 *  refractory plus room for a frame, which is not a detail: it is the act.
 *
 *  At `TAP_REST_MS + 10` the scripted burst did not fire the cascade at all.
 *  The schedule is exact but the firing is quantised to whatever frame the
 *  browser gives, so a 220 ms gap landed alternately at 224 and **208** — and
 *  208 is under the terminal's 210 ms refractory, so `spineFire` dropped those
 *  messages on the floor. MEASURED, three of eight went missing and the calcium
 *  peaked at 0.151 against a threshold it could not reach.
 *
 *  ⚠ AND IT FAILED SILENTLY, which is the part worth keeping. `spineFire`
 *  returns nothing, so a refused message is indistinguishable from one never
 *  sent. A guard counts what the model TOOK against what the story sent. */
export const BURST_GAP_MS = TAP_REST_MS + 50
/** ⚠ THE COUNT IS THE EXHIBIT'S THRESHOLD, and it is the MODEL's number — the
 *  info block says it aloud and `spine.test.ts` pins it either side: seven in
 *  quick succession must fail and eight must fire. Re-exported, not re-typed. */
export { BURST_N }

/** A beat after an act's last event, so a chapter CONTAINS the thing it names
 *  rather than ending on the frame it happens. */
export const ACT_BEAT_MS = 900

/** ⚠ HOW LONG THE TERMINAL TAKES TO RESTOCK, before each message after the
 *  first (21c-72, user: "New Vesicles should not teleport, but arrive from
 *  top").
 *
 *  A message ends with its vesicles FUSED — flattened into the wall, which is
 *  what fusion is. The next message needs them docked again, and the picture
 *  used to supply that by restarting: MEASURED, two of the three un-fused in a
 *  single frame, every message, thirteen times.
 *
 *  So the gap between messages is not empty any more. The picture HOLDS at the
 *  end of the message just played — wall smooth, gap cleared — and fresh
 *  vesicles come down from the reserve pool into the docking sites, which is
 *  where they really come from. Then the next message plays from a terminal
 *  that is visibly stocked.
 *
 *  ⚠ AND IT IS A SHARE OF THE GAP, NOT A FIXED TIME — capped at this. Written
 *  as a constant it was 900 ms against a burst step of 780, which gave the
 *  burst's messages a NEGATIVE play length: the release window closed before it
 *  opened, no message was ever active, and the guards caught it as a picture
 *  that never advanced. A terminal being hammered restocks between messages
 *  faster than one being tapped; that is what a share says and a constant
 *  cannot. */
export const RESTOCK_MS = 900
export const RESTOCK_SHARE = 0.42

/** How long the restock before a message gets, given the gap it has to fit in. */
export const restockMsFor = (gap: number): number =>
  Math.min(RESTOCK_MS, gap * RESTOCK_SHARE)

export interface StoryMessage {
  /** Screen ms at which this message's release starts being drawn. */
  at: number
  /** How long the terminal spends restocking just before it, screen ms. */
  restock: number
  /** How long it is drawn for, screen ms. */
  ms: number
  /** How much of `spineClock`'s window it shows, 0→1. */
  phase: number
  /** Screen ms at which the model is told — so its answer lands with the ink. */
  fireAt: number
}

export interface StoryAct {
  key: string
  /** What the child is being shown. It is the bar's chip, and it is read aloud. */
  what: string
  from: number
  to: number
  /** Model ms given to one screen ms through this act. */
  rate: number
}

export interface SpineStory {
  messages: StoryMessage[]
  acts: StoryAct[]
  /** The whole run, screen ms. */
  ms: number
  /** ⚠ THE MARK ACT ONE LEAVES BEHIND — the peak the spine reaches on a single
   *  message through one catcher, MEASURED by walking this very story rather
   *  than typed. Act six's job is to beat it, and the child's evidence that it
   *  did is that the bar goes past the line. */
  mark: number
  /** When act one is over, so the mark appears only once there is something to
   *  compare it against. */
  markFrom: number
}

/** Where in the FULL window the sodium gets inside, as a phase — so a repeat
 *  can be cut just past it, and a pulse timed to it. */
export const naPhase = (run: SynapseRun, cleft: CleftRun): number =>
  spineNaLagMs(run, cleft, AMPA_AT_REST) / SPINE_SCREEN_MS

/** Whether a message's release is actually being drawn right now. */
export function storyActive(story: SpineStory, screenMs: number): boolean {
  return story.messages.some((m) => screenMs >= m.at && screenMs < m.at + m.ms)
}

/** The model position the picture is at.
 *  ⚠ THE LATEST message wins, so a burst restarts the picture rather than
 *  queueing behind it.
 *  ⚠ AND BETWEEN MESSAGES IT HOLDS where the last one ended, rather than
 *  falling back to rest (21c-72). Rest is a terminal with three docked bubbles;
 *  a message ends with them fused into the wall. Falling back put them back
 *  instantly — see `RESTOCK_MS` for what fills the gap instead. */
export function storyRelease(story: SpineStory, screenMs: number): number | null {
  let phase: number | null = null
  for (const m of story.messages) {
    if (screenMs >= m.at && screenMs < m.at + m.ms) {
      phase = ((screenMs - m.at) / m.ms) * m.phase
    } else if (screenMs >= m.at + m.ms) {
      phase = m.phase
    }
  }
  if (phase === null) return null
  // ⚠ AND THE RESTOCK CARRIES THE PICTURE TO THE END OF THE WINDOW (21c-72).
  //
  // A repeat stops at `repeatPhase` — about 18 model ms — where the transmitter
  // is still sitting on the receptors. Holding there and then starting the next
  // message at phase 0 made those balls vanish and re-cross, which is the same
  // teleport as the vesicles' by another name.
  //
  // The window's END is where the gap is CLEARED: at 30 ms nothing is in the
  // cleft, the receptors are shut and the wall is smooth. That is the same
  // picture as its START, in everything except the docked bubbles — and the
  // bubbles are exactly what the restock is putting back. So the gap between
  // two messages walks the picture home, and the wrap to 0 changes nothing that
  // is on screen.
  const q = storyRestock(story, screenMs)
  if (q !== null) phase = phase + (1 - phase) * q
  return spineClock(phase)
}

/** ⚠ HOW FAR THE RESTOCK HAS GOT, 0→1, or null when nothing is coming down.
 *  The window sits in the gap BEFORE a message, so the terminal is stocked by
 *  the time that message's own release begins. */
export function storyRestock(story: SpineStory, screenMs: number): number | null {
  for (const m of story.messages) {
    if (m.restock <= 0) continue
    const from = m.at - m.restock
    if (screenMs >= from && screenMs < m.at) return (screenMs - from) / m.restock
  }
  return null
}

/** Which act a moment belongs to. */
export function storyAct(story: SpineStory, screenMs: number): StoryAct {
  for (const a of story.acts) if (screenMs < a.to) return a
  return story.acts[story.acts.length - 1]
}

/** ⚠ THE MODEL'S OWN CLOCK, read off the screen's — the ONE place the two are
 *  related, so the picture and the cell cannot drift apart. */
export function storyModelMs(story: SpineStory, screenMs: number): number {
  let model = 0
  for (const a of story.acts) {
    if (screenMs <= a.from) break
    model += (Math.min(screenMs, a.to) - a.from) * a.rate
  }
  return model
}

/** The frame the walk steps in — SCREEN time, the same as the stage gives it,
 *  so what a guard measures is what the child gets. ⚠ A guard that walks a run
 *  samples in screen time, never in a fixed count of model ms. */
export const STORY_STEP_MS = 16

/** ⚠ WALKING THE STORY'S OWN MODEL — the one place its events are found, so the
 *  chapters, the mark and the guards all read the same walk. */
export function walkStory(story: SpineStory): {
  latchAt: number | null
  deliveredAt: number | null
  actOnePeak: number
  sent: number
  taken: number
} {
  const s = spineStart()
  let next = 0
  let latchAt: number | null = null
  let deliveredAt: number | null = null
  let actOnePeak = 0
  let taken = 0
  let model = 0
  const actOneTo = story.acts[0].to
  for (let t = 0; t <= story.ms; t += STORY_STEP_MS) {
    while (next < story.messages.length && t >= story.messages[next].fireAt) {
      const before = s.pulses.length
      spineFire(s, 0)
      if (s.pulses.length > before) taken++
      next++
    }
    const was = model
    model = storyModelMs(story, t)
    spineStep(s, Math.max(0, model - was))
    if (t < actOneTo) actOnePeak = Math.max(actOnePeak, spineReach(s))
    if (latchAt === null && s.camk >= 1) latchAt = t
    if (deliveredAt === null && s.ampa >= AMPA_AT_REST + AMPA_DELIVERED) deliveredAt = t
  }
  return { latchAt, deliveredAt, actOnePeak, sent: next, taken }
}

/** ⚠ THE STORY, BUILT AND THEN MEASURED. Acts one to three are scripted; acts
 *  four and five are named after events the MODEL decides, so their boundaries
 *  are read off a walk rather than guessed. A chapter whose dot does not sit on
 *  the thing it names is a dot pointing at nothing. */
export function buildSpineStory(run: SynapseRun, cleft: CleftRun): SpineStory {
  const na = naPhase(run, cleft)
  const repeatPhase = Math.min(1, na + REPEAT_MARGIN)
  const messages: StoryMessage[] = []
  const acts: StoryAct[] = []

  /** A message's pulse is due when its DRAWN sodium is through the wall. */
  const push = (at: number, ms: number, phase: number, restock = 0) =>
    messages.push({ at, ms, phase, restock, fireAt: at + (ms * na) / phase })

  // ── act one: one message, in full, at the pace it was tuned to ────────────
  acts.push({ key: 'one', what: 'One message', from: 0, to: SPINE_SCREEN_MS, rate: 1 })
  push(0, SPINE_SCREEN_MS, 1)

  // ── act two: a few, spread out — each warms the head and lets it cool ─────
  const act2From = SPINE_SCREEN_MS
  const spreadRestock = restockMsFor(SPREAD_GAP_MS)
  // ⚠ THE FIRST OF THEM STARTS A RESTOCK LATER, so its own restock has somewhere
  // to happen. Without the lead it ran DURING act one's release — the terminal
  // was restocked while it was still releasing, and act one's last second was
  // hurried along by a walk-home that belonged to the gap after it.
  const act2To = act2From + spreadRestock + SPREAD_N * SPREAD_GAP_MS
  acts.push({ key: 'spread', what: 'A few, spread out', from: act2From, to: act2To, rate: 1 })
  for (let i = 0; i < SPREAD_N; i++) {
    push(
      act2From + spreadRestock + i * SPREAD_GAP_MS,
      SPREAD_GAP_MS * SPREAD_PLAY_SHARE,
      repeatPhase,
      spreadRestock,
    )
  }

  // ── act three: a run of them, close together ─────────────────────────────
  const burstStep = BURST_GAP_MS * BURST_STRETCH
  const act3From = act2To
  const burstRestock0 = restockMsFor(burstStep)
  const act3To = act3From + burstRestock0 + BURST_N * burstStep
  acts.push({
    key: 'burst',
    what: 'A run of them, close together',
    from: act3From,
    to: act3To,
    rate: 1 / BURST_STRETCH,
  })
  // ⚠ EACH LEAVES ROOM FOR ITS OWN RESTOCK, so the bubbles that fuse in one
  // message are visibly replaced before the next one opens.
  const burstRestock = burstRestock0
  for (let i = 0; i < BURST_N; i++) {
    push(
      act3From + burstRestock + i * burstStep,
      burstStep - burstRestock,
      repeatPhase,
      burstRestock,
    )
  }

  // ── and now WALK it, so the rest of the chapters land on their own events ─
  // Acts four and five have to EXIST before the walk can run through them, so
  // the cascade's leg goes in at a length nothing can reach and is cut back to
  // the measured moment afterwards. The rate is what the walk needs; the
  // boundary is what the walk decides.
  const open = 120000
  acts.push({
    key: 'switch',
    what: 'Something flips',
    from: act3To,
    to: act3To + open,
    rate: 1 / CASCADE_STRETCH,
  })
  const walk = walkStory({ messages, acts, ms: act3To + open, mark: 0, markFrom: 0 })
  const latch = walk.latchAt ?? act3To + 4000
  const delivered = walk.deliveredAt ?? latch + 6000
  acts[3].to = latch + ACT_BEAT_MS
  acts.push({
    key: 'deliver',
    what: 'New catchers arrive',
    from: acts[3].to,
    to: delivered + ACT_BEAT_MS,
    rate: 1 / CASCADE_STRETCH,
  })

  // ── act six: the very same message as act one, and the head goes further ─
  const act6From = acts[4].to
  const ms = act6From + SPINE_SCREEN_MS
  acts.push({ key: 'again', what: 'The same message again', from: act6From, to: ms, rate: 1 })
  push(act6From, SPINE_SCREEN_MS, 1, RESTOCK_MS)

  return { messages, acts, ms, mark: walk.actOnePeak, markFrom: SPINE_SCREEN_MS }
}
