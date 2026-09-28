import { SYNAPSE_MS, type SynapseRun } from '../core/synapse'
import type { CleftRun } from '../core/cleft'
import { ligandSeat } from './ligandChannel'
import { outsideOn } from './astrocyteShape'
import { TURN_IN, TURN_SHUT, TURN_FLIP, TURN_OUT, transportOpen } from './channelShapes'
import {
  MEM_PX,
  activeZone,
  astroCellRest,
  astrocyteCell as cellOf,
  insideDoor,
  loopDoors,
  CHANNEL_SPAN,
  outsideDoor,
  vglutAt,
  vglutSeatAt,
  caSeatAt,
  boutonHolds,
  astrocyteCell,
  cargoIn,
  faceAt,
  fusedShape,
  castSeats,
  snareMini,
  vesicleR,
  wallAt,
  type SynapseGeometry,
} from './synapseScene'

// THE CAST — every loose particle in the synapse view, WITH IDENTITY.
//
// ⚠ THE RULING THIS FILE EXISTS FOR (user, 2026-09-01): "I want all ions and
// all neurotransmitter balls to have identity. They should live in the soup,
// visible from the very beginning. Each ball should have its own travel
// trajectory. None of them fades out, none of them materializes from nowhere,
// none of them teleports."
//
// So each population is a FIXED-SIZE array — the same members at every moment
// of the run — and each member's position is one continuous piecewise
// trajectory, a pure function of the run position like everything else here.
// Presence changes only by TRAVEL: a cleared calcium ion does not dim, it is
// grabbed by the terminal's buffers and drifts deeper inside (that is what
// the model's BUFFER_RATIO describes); a cleared transmitter molecule does
// not dim, it leaves the gap at an end and joins the bath's loose matter.
// Every function returns its whole cast in a FIXED ORDER, so a test can
// follow ball i through the entire run and measure that it never jumps.
//
// ⚠ A PATH THROUGH THE GAP FOLLOWS THE GAP. The cleft is a thin CURVED band;
// a straight line between two points in it cuts through the walls near the
// ends (measured: a ball 13 px inside the bouton). So travel inside the gap
// is parametrised as (x, fraction-between-the-walls) and the y is asked of
// the two membranes at every step — the same put-things-ON-the-shape rule,
// applied to motion.
//
// The clocks in here are DRAWING schedules for events below the model's time
// step (a single ion's transit, one molecule's puff) — declared, as always.
// The model still owns every WHEN: fusions, the bound/open populations, the
// integrated calcium current, the terminal's clearance.

const H = (a: number, b: number): number => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t))
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** The thermal jiggle every resting particle wears — bounded, and on the
 *  model's own clock, so the beats hold it still too. */
const wobX = (ms: number, salt: number): number => Math.sin(ms * 0.7 + salt * 2.399) * 1.6
const wobY = (ms: number, salt: number): number => Math.cos(ms * 0.5 + salt * 1.171) * 1.4

/** A point in the gap at this x, `frac` of the way from the presynaptic wall
 *  to the postsynaptic face. */
function inGap(g: SynapseGeometry, x: number, frac: number): { x: number; y: number } {
  const top = wallAt(g, x) + MEM_PX + 2
  const bottom = faceAt(g, x) - MEM_PX - 2
  return { x, y: top + Math.max(0, bottom - top) * frac }
}

/** Where a y sits between the two walls at this x, 0→1. */
function gapFrac(g: SynapseGeometry, x: number, y: number): number {
  const top = wallAt(g, x) + MEM_PX + 2
  const bottom = faceAt(g, x) - MEM_PX - 2
  return clamp01((y - top) / Math.max(1e-6, bottom - top))
}

/** Travel INSIDE the gap: x and wall-fraction interpolate, y is asked of the
 *  walls at every step — so the path bends with the band it lives in. */
function alongGap(
  g: SynapseGeometry,
  x0: number,
  f0: number,
  x1: number,
  f1: number,
  q: number,
): { x: number; y: number } {
  return inGap(g, lerp(x0, x1, q), lerp(f0, f1, q))
}

// (The old open-bath resting spot is gone — 21b-1: an escaping ball's journey
// now ENDS somewhere, inside the astrocyte finger or the spine, which is what
// clearance is. The finger was placed around the very pocket the balls used
// to rest in, so the routes barely changed.)

/** Series threshold-crossings, memoised per run — these are asked for every
 *  ball on every frame, and the answer never changes. */
type Cross = { tUp: number | null; tDown: number | null }
const CROSS_CACHE = new WeakMap<number[], Map<number, Cross>>()

function crossings(series: number[], windowMs: number, mine: number): Cross {
  let byMine = CROSS_CACHE.get(series)
  if (!byMine) {
    byMine = new Map()
    CROSS_CACHE.set(series, byMine)
  }
  const hit = byMine.get(mine)
  if (hit) return hit
  const dt = windowMs / Math.max(1, series.length - 1)
  let tUp: number | null = null
  let tDown: number | null = null
  let above = false
  for (let k = 0; k < series.length; k++) {
    const a = series[k] > mine
    if (a && !above && tUp === null) tUp = k * dt
    if (!a && above && tUp !== null && tDown === null) tDown = k * dt
    above = a
  }
  const res = { tUp, tDown }
  byMine.set(mine, res)
  return res
}

// ─────────────────────────────────────────────────────────── the transmitter

export const EMERGE_STAGGER_MS = 1.2
/** ⚠ ONE SPEED FROM BUBBLE TO STANDING PLACE, px per model ms (user,
 *  2026-09-01: "make the green balls move with constant speed — they speed up
 *  without a reason after release"). The emerge and spread legs used to have
 *  their own durations, ~25× apart in speed, so a ball lurched the instant it
 *  cleared the mouth. Now each leg's DURATION is its distance over this one
 *  speed — the cast and the seat windows share the same arithmetic. Stands
 *  stay local to their own mouth, so no trip ever reads as the crossing. */
export const NT_SPEED = 30

/** Legacy names kept for the guards that bound the schedule: the emerge leg
 *  is about 1.3 radii long, the spread at most the local stand offset. */
export const EMERGE_TRAVEL_MS = 1.5
export const DISPERSE_MS = 0.18
export const CAPTURE_MS = 0.9
/** Long, because releases happen in the compressed tail leg — anything
 *  shorter flicks (user, 2026-09-01: "replace abrupt jerky movements"). */
export const RELEASE_MS = 4
export const ESCAPE_START_MS = 0.5
export const ESCAPE_SPREAD_MS = 1.6
export const ESCAPE_EXIT_MS = 3.5
/** Long enough that a ball released in the fast tail leg still GLIDES to the
 *  bath on screen instead of flicking there. */
export const ESCAPE_TRAVEL_MS = 7
/** One opacity for every cast particle at every moment. NONE OF THEM FADES. */
export const CAST_ALPHA = 0.95

/** By when every emitted ball has reached its standing place — the guards'
 *  bound, computed with the same speed arithmetic. */
export function ntSettledBy(g: SynapseGeometry, run: SynapseRun): number {
  const docked = activeZone(g).docked
  let latest = 0
  for (const [v, d] of docked.entries()) {
    const tf = run.vesicles[d.index]?.fusedAtMs ?? null
    if (tf === null) continue
    const maxTravel = (d.r * 1.3) / NT_SPEED + (g.activeHalf * 1.0 + 60) / NT_SPEED
    // …and the collection legs (21b-1): escape start + spread, the exit, the
    // flight to a transporter tick, and the settle inside the collector.
    const collect = ESCAPE_START_MS + ESCAPE_SPREAD_MS + ESCAPE_EXIT_MS + ESCAPE_TRAVEL_MS * 1.6
    latest = Math.max(latest, tf + EMERGE_STAGGER_MS + maxTravel + collect)
    void v
  }
  return latest
}

export interface NtDot {
  x: number
  y: number
  where:
    | 'vesicle'
    | 'gap'
    | 'seat'
    | 'bath'
    | 'glia'
    | 'spine'
    /** Outside again, crossing from the astrocyte's door to the terminal's. */
    | 'shipping'
    /** Inside the presynaptic terminal. */
    | 'terminal'
    /** In the terminal's standing pool of glutamate. */
    | 'stock'
    /** Gone from the picture — it left the frame under its own travel, and the
     *  collectors it reaches are the ones ringing this synapse off-screen. */
    | 'away'
  /** ⚠ WHAT KIND IT CURRENTLY IS, 0 = glutamate, 1 = glutamine — and the
   *  fractions between are the conversion happening on screen. The drawing
   *  blends the two inks by this number; the model owns the change of kind,
   *  the picture never decides it. */
  glutamine?: number
  /** 0 → 1 → 0 across the change of kind: the enzyme's work, marked as an
   *  event rather than left as a slow tint. */
  flash?: number
}

/** How many of the escapees the NEURON itself reclaims — the declared minor
 *  route (a dendritic transporter): everything else goes to the astrocyte. */
/** ⚠ NO DRAWN BALL TAKES THE NEURONAL ROUTE ANY MORE (21c-3b, user: "there's a
 *  channel outside of the astrocyte, which takes 2 NT balls. These 2 balls
 *  remain in place till the end of the animation. Expected: channel is on
 *  astrocyte, the NTs go through the same process as other NTs").
 *
 *  It was a DEAD END on the picture: the spine's own transporter took a few
 *  balls in and nothing ever happened to them, so the run ended with two or
 *  three of them parked in the postsynaptic cell while everything else went
 *  round. That is honest biology drawn as an unfinished sentence.
 *
 *  ⚠ What is LOST by setting this to zero, said plainly: postsynaptic uptake is
 *  real, and the glutamate it takes is largely metabolised rather than sent
 *  back — which is exactly why those balls had nowhere to go. The fact keeps
 *  its place in the info block; it is no longer drawn. The constant stays so
 *  the route can be brought back if it is ever given an ending. */
export const NEURON_UPTAKE_FRAC = 0

/** ⚠ THE LOOP'S MODEL TIMES — the same boundaries the clock legs use, so the
 *  transport bar's caption and the balls always agree about which stage the
 *  run is in. Choreography, and declared as such: real uptake is milliseconds
 *  while the glutamine round trip is seconds to minutes. */
export const CONVERT_FROM_MS = 36
export const SHIP_FROM_MS = 41
export const CROSS_FROM_MS = 45
export const ENTER_FROM_MS = 48
export const BACK_FROM_MS = 50
export const STOCK_FROM_MS = 53
/** ⚠ WHEN THE FIRST BUBBLE STARTS FILLING. Moved 56 → 55.2 (21c-3l) to buy the
 *  turns room: the last ball reaches the pool at STOCK_FROM_MS + the widest
 *  beat, which is 55.0, so this is the earliest a queue can honestly begin. */
export const REFILL_FROM_MS = 55.2
/** ⚠ …and when the last one has to be IN, before the run's own last frame — a
 *  ball still in flight on the closing frame never reads as having arrived. */
export const REFILL_END_MS = 59.4
/** The four beats of one turn at VGLUT, as shares of a slot: take it in, shut
 *  around it, swing to the lumen, let it go.
 *
 *  ⚠ THE SHARED CYCLE (21c-3o). These were four numbers of their own until the
 *  SNARE bench needed the same protein to do the same thing at its own
 *  magnification; the beats and the curve now live in `channelShapes` and both
 *  views read them. The gap between one ball leaving and the next arriving is
 *  what `TURN_OUT` leaves over. */
export const FILL_IN = TURN_IN
export const FILL_SHUT = TURN_SHUT
export const FILL_FLIP = TURN_FLIP
export const FILL_OUT = TURN_OUT * 0.8
/** ⚠ How far apart the refilling balls set off, model ms — the spread that
 *  turns one dot into a queue. Bounded so the last one still lands in time. */
export const REFILL_STAGGER_MS = 1.4

/** ⚠ HOW FAR APART THE BALLS GO ROUND THE LOOP, model ms (21c-3i, user: "let
 *  glutamine exit astrocyte and enter the bouton as single balls, not merged
 *  into one ball").
 *
 *  Every ball converted, left, crossed and entered on the SAME clock, so a
 *  dozen of them were one dot for the whole return. Each now runs the loop on
 *  its own beat — spaced by the golden ratio, which separates consecutive ids
 *  further than any hash — so they thread the doors one at a time. That is also
 *  what a pore does: one molecule at a time.
 *
 *  Bounded so the last ball is still stocked before the run ends. */
export const LOOP_STAGGER_MS = 2.0

/** The ball's own offset into the loop's legs — deterministic, and the same
 *  every run. */
export const loopBeat = (id: number): number =>
  ((id * 0.618033988749895) % 1) * LOOP_STAGGER_MS

/** ⚠ AND ITS OWN LANE (21c-3i). A beat alone is not enough: the balls all
 *  travel the SAME line, and at a door they converge on the same point, so two
 *  with nearby beats still come out overlapping — measured, 1.3 px apart. A
 *  small sideways offset makes them a loose file rather than a single thread,
 *  which is what a stream of molecules looks like anyway. Seeded, so a ball
 *  keeps its lane for the whole journey. */
export const loopLane = (id: number): number => {
  // ⚠ THE LANE IS THE BEAT'S COMPLEMENT (21c-3i). A random lane lets two balls
  // share one, and two balls with nearly equal beats then travel on top of each
  // other anyway — measured, 1.7 px apart. Multiplying the beat's fraction
  // before taking it modulo one means balls that are CLOSE IN TIME are far
  // apart in space: separate one way or the other, always.
  const t = (loopBeat(id) / LOOP_STAGGER_MS) * 5
  return ((t % 1) - 0.5) * 15
}
/** ⚠ WHEN THE FAR-SIDE BALLS COME BACK — the same moment the near-side ones
 *  cross the gap, so both routes are on one clock and the transport bar's
 *  caption is true of every ball. */
export const RETURN_FROM_MS = CROSS_FROM_MS
/** ⚠ WHEN THE LINGERERS GIVE UP THE GAP (21c-3). The ten balls that bound and
 *  were let go used to stay in the cleft for the whole run, on the 2026-09-01
 *  reasoning that "the transporters that reclaim THOSE work on a slower clock
 *  than this run". The run has since grown a second act and is 33 s long, so
 *  that reasoning no longer holds — it got long enough. They still linger far
 *  longer than the rest, which was the point; they simply no longer linger for
 *  ever. Timed so their journey completes before the conversion leg opens:
 *  21 + exit 3.5 + travel 7 + settle 4.2 = 35.7, against 36. */
export const LINGER_ESCAPE_MS = 21

/** ⚠ THE CALCIUM'S WAY OUT (21c-3). Choreography, and squeezed like the rest of
 *  the loop: a real terminal clears its calcium in tens to hundreds of
 *  milliseconds, which is far quicker than the glutamine round trip drawn
 *  beside it. Timed to finish before the run does, so the last frame is the
 *  first frame. */
// ⚠ ONE ION AT A TIME, AND A REAL CYCLE (21c-3k, user: "each ion goes one after
// the other (not merged into one ball). Ca ball enters, stays in the center,
// not moving → ATP binds → binding flash → channel changes its conformation →
// Ca leaves on the other side").
//
// The ions used to cross together on one clock, so a pump moved once and a
// handful of balls went through it as a blob. Each now takes its TURN at its
// own pump: it waits its slot, sits still in the pore while the ATP binds and
// flashes, the gates swap, and only then does it leave. The pump's own gates
// and hexagon are drawn from whichever ion is in it — the machine and the cargo
// cannot disagree, because they read the same schedule.
//
// ⚠ Started earlier than before (40 → 30 ms) because a queue takes longer than
// a crowd: seven ions a pump at 2.2 ms each is 15 ms of turns, and they all
// have to be back in the cleft before the run ends.
export const CA_N = 14
const CA_DRIFT_BACK_MS_RAW = 8
export const CA_EXTRUDE_FROM_MS = 30
export const CA_TO_PUMP_MS = 4
/** ⚠ HOW LONG EACH ION HAS THE PORE TO ITSELF — SOLVED, not chosen. Every ion
 *  has to be back in the cleft before the run ends, so the slot is whatever
 *  divides the time left between the longest queue's turns. Written as a
 *  constant would be a number to re-tune every time the ion count changed. */
export const CA_SLOT_MS = (() => {
  const perPump = Math.ceil(CA_N / 2)
  const room = SYNAPSE_MS - 1 - CA_DRIFT_BACK_MS_RAW - (CA_EXTRUDE_FROM_MS + CA_TO_PUMP_MS)
  return Math.min(2.2, room / perPump)
})()
/** The four beats of one turn: sit still, bind the ATP, swap the gates, leave. */
export const CA_SIT_MS = 0.6
export const CA_ATP_MS = 0.5
export const CA_FLIP_MS = 0.4
export const CA_OUT_MS = 0.5
export const CA_TURN_MS = CA_SIT_MS + CA_ATP_MS + CA_FLIP_MS + CA_OUT_MS
/** Kept for the legs that still speak of a crossing as one span. */
export const CA_THROUGH_MS = CA_TURN_MS
export const CA_DRIFT_BACK_MS = CA_DRIFT_BACK_MS_RAW

/** Where an ion is resting when the pumps start — the point its pump is chosen
 *  from. Kept beside the queue so both read the same thing. */
export function restOfIon(
  g: SynapseGeometry,
  run: SynapseRun,
  i: number,
): { x: number; y: number } {
  const docked = activeZone(g).docked
  const r = vesicleR(g)
  const anchor = docked[i % docked.length]
  const bound = i < docked.length * 2
  const knob = snareMini(g, anchor).knobs[Math.floor(i / docked.length) % 2]
  const freeX = anchor.x + (H(i, 21) - 0.5) * r * 3
  const feet = bound
    ? { x: knob.x, y: knob.y }
    : { x: freeX, y: wallAt(g, freeX) - MEM_PX - r * (1.5 + H(i, 22) * 1.5) }
  const dx = feet.x + (H(i, 16) - 0.5) * r * 2.5
  void run
  return { x: dx, y: wallAt(g, dx) - MEM_PX - r * (1.2 + H(i, 17) * 1.4) }
}

/** ⚠ WHERE AN ION WAITS ITS TURN — just inside the pump, on the pore's own
 *  axis, and stepped back by its place in the queue so the waiting ions are a
 *  line rather than a heap. */
export function insideOfPump(
  g: SynapseGeometry,
  pump: { x: number; y: number },
  slot: number,
): { x: number; y: number } {
  const outward = outsideDoor(g, pump, 1)
  const ix = pump.x - (outward.x - pump.x)
  const iy = pump.y - (outward.y - pump.y)
  const k = 16 + slot * 9
  return { x: pump.x + (ix - pump.x) * k, y: pump.y + (iy - pump.y) * k }
}

/** ⚠ WHICH PUMP EACH ION USES, AND ITS PLACE IN THAT PUMP'S QUEUE — worked out
 *  once, so the ions, the gates and the hexagon all read the same schedule. */
const CA_QUEUE = new WeakMap<SynapseGeometry, { pump: number; slot: number }[]>()

export function caQueue(
  g: SynapseGeometry,
  restOf: (i: number) => { x: number; y: number },
): { pump: number; slot: number }[] {
  const hit = CA_QUEUE.get(g)
  if (hit) return hit
  const pumps = loopDoors(g).caPumps
  // ⚠ BALANCED, not merely nearest (21c-3k). Assigned by proximity alone, one
  // pump took ten of the fourteen — and the tail of that queue was still inside
  // the terminal when the run ended, which breaks the closing frame. Each ion
  // still prefers its nearer pump; the overflow goes to the other, farthest
  // first, so no queue is more than one longer than the other.
  const cap = Math.ceil(CA_N / pumps.length)
  const want = Array.from({ length: CA_N }, (_, i) => {
    const from = restOf(i)
    let p = 0
    let best = Infinity
    for (const [k, q] of pumps.entries()) {
      const d = Math.abs(q.x - from.x)
      if (d < best) {
        best = d
        p = k
      }
    }
    return { i, p, gain: Math.abs(pumps[1 - p].x - from.x) - best }
  })
  const mine = pumps.map(() => 0)
  const out: { pump: number; slot: number }[] = Array.from({ length: CA_N }, () => ({
    pump: 0,
    slot: 0,
  }))
  // The ions with least to lose by moving are the ones that move.
  for (const w of [...want].sort((a, b) => b.gain - a.gain)) {
    const p = mine[w.p] < cap ? w.p : 1 - w.p
    out[w.i] = { pump: p, slot: mine[p]++ }
  }
  CA_QUEUE.set(g, out)
  return out
}

/** When this ion's turn at the pore begins. */
export const caTurnAt = (slot: number): number =>
  CA_EXTRUDE_FROM_MS + CA_TO_PUMP_MS + slot * CA_SLOT_MS

/** ⚠ A TRANSPORT CYCLE, NOT A FLAP (21c-3f, user: "it should imitate actual
 *  transportation: ATP binds, Ca ion loads, opens up on the other side, Ca
 *  leaves").
 *
 *  The openness is SIGNED: −1 is open to the INSIDE, 0 is shut, +1 is open to
 *  the OUTSIDE. That single number is what makes a transporter a transporter
 *  rather than a door — the two sides are never open at once, which is the
 *  whole reason a pump can move something against a gradient. The drawing
 *  rotates the gates by `SWING_RAD × open`, so the sign falls out of it.
 *
 *  ⚠ THE ORDER IS THE PUMP'S, NOT THE ONE ASKED FOR — pushed back and built
 *  this way. PMCA is a P-type ATPase: the calcium binds FIRST, on the inside;
 *  phosphorylation from ATP then drives the flip to the outward-open state; the
 *  calcium leaves; dephosphorylation resets it. So it is load → spend → flip →
 *  release, not ATP → load → flip → release.
 *
 *  ⚠ This lived in `synapseScene` as one stroke on the run's own clock; since
 *  each pore runs a queue (21c-3k) the state belongs to the ion in it, and the
 *  old stroke was left drawing nothing. One owner.
 *
 *  ⚠ THE PUMP'S OWN STATE, read off whichever ion is in it (21c-3k). Returns
 *  the signed gate opening, how much ATP is left, and the binding flash — so
 *  the drawing shows the machine doing what the ion is doing. */
export function caPumpStateAt(
  g: SynapseGeometry,
  restOf: (i: number) => { x: number; y: number },
  ms: number,
  pumpIdx: number,
): { open: number; atp: number; flash: number } {
  const q = caQueue(g, restOf)
  for (const [i, seat] of q.entries()) {
    void i
    if (seat.pump !== pumpIdx) continue
    const t0 = caTurnAt(seat.slot)
    if (ms < t0 - 0.6 || ms > t0 + CA_TURN_MS) continue
    const t = ms - t0
    // Waiting for it, and just after it, the inside is open to take the next.
    if (t < 0) return { open: -1, atp: 0, flash: 0 }
    if (t < CA_SIT_MS) return { open: -1, atp: 0, flash: 0 }
    // ⚠ ONE CONTINUOUS STROKE, inward → shut → outward (21c-3l). The gates used
    // to jump from open-inward to shut the instant the fuel arrived, and then
    // travel the whole way from inward to outward during the flip — which drew
    // the pore re-opening on the side the ion had already left. It closes AS
    // the ATP binds and opens the far side afterwards, which is the cycle.
    if (t < CA_SIT_MS + CA_ATP_MS) {
      const u = (t - CA_SIT_MS) / CA_ATP_MS
      return { open: u - 1, atp: 1, flash: Math.sin(u * Math.PI) ** 2 }
    }
    if (t < CA_SIT_MS + CA_ATP_MS + CA_FLIP_MS) {
      const u = (t - CA_SIT_MS - CA_ATP_MS) / CA_FLIP_MS
      return { open: u, atp: 1 - u, flash: 0 }
    }
    return { open: 1, atp: 0, flash: 0 }
  }
  return { open: 0, atp: 0, flash: 0 }
}

/** ⚠ WHICH BUBBLE EACH RETURNING BALL FILLS, AND ITS PLACE IN THAT BUBBLE'S
 *  QUEUE (21c-3l, user: "improve animation for NT pump in vesicles: same
 *  animation mechanics as Ca channels").
 *
 *  The same shape as `caQueue`, and for the same reason: a pore carries one
 *  molecule at a time, so the balls have to be told what order they go in. Each
 *  ball keeps the bubble its own seed chose; a bubble that would take more than
 *  its share hands the overflow to the emptiest one, so no queue outlives the
 *  run. Slots are dealt in the order the balls reach the pool — the first one
 *  there is the first one in, which is what a queue is.
 *
 *  `slotMs` is SOLVED from the room left, exactly as the calcium's is. */
const REFILL_Q = new WeakMap<
  SynapseGeometry,
  WeakMap<
    SynapseRun,
    {
      seats: Map<number, { bubble: number; slot: number }>
      slotMs: number
    }
  >
>()

export function refillQueue(
  g: SynapseGeometry,
  run: SynapseRun,
): {
  seats: Map<number, { bubble: number; slot: number }>
  slotMs: number
} {
  let byRun = REFILL_Q.get(g)
  if (!byRun) {
    byRun = new WeakMap()
    REFILL_Q.set(g, byRun)
  }
  const hit = byRun.get(run)
  if (hit) return hit
  const docked = activeZone(g).docked
  const loose: number[] = []
  for (const [v, d] of docked.entries()) {
    if ((run.vesicles[d.index]?.fusedAtMs ?? null) === null) continue
    for (let c = 0; c < 7; c++) loose.push(v * 7 + c)
  }
  loose.sort((a, b) => loopBeat(a) - loopBeat(b) || a - b)
  const cap = Math.max(1, Math.ceil(loose.length / Math.max(1, docked.length)))
  const mine = docked.map(() => 0)
  const seats = new Map<number, { bubble: number; slot: number }>()
  for (const id of loose) {
    let want = Math.floor(H(id, 33) * docked.length) % docked.length
    if (mine[want] >= cap) want = mine.indexOf(Math.min(...mine))
    seats.set(id, { bubble: want, slot: mine[want]++ })
  }
  const out = {
    seats,
    slotMs: (REFILL_END_MS - REFILL_FROM_MS) / cap,
  }
  byRun.set(run, out)
  return out
}

/** When this ball's turn at its VGLUT begins. */
export function fillTurnAt(g: SynapseGeometry, run: SynapseRun, id: number): number | null {
  const { seats, slotMs } = refillQueue(g, run)
  const seat = seats.get(id)
  return seat ? REFILL_FROM_MS + seat.slot * slotMs : null
}

/** ⚠ THE POOL KEEPS OFF THE PORES (21c-3l). A resting spot in the standing pool
 *  is a point projected along the way from the terminal's door to a vesicle's
 *  filler — and the far end of that line IS the filler, so a ball waiting in the
 *  pool could sit 2 px inside a pore it was not in. It reads as a blocked
 *  transporter, and it made "one ball at a time" unmeasurable. Any spot too
 *  close to a seat is stepped back out along that seat's own axis. */
const FILLER_CLEAR = 12

/** ⚠ THE BUBBLES' SEATS, MEMOISED. Every ball asks whether it is standing in
 *  somebody's pore, on every frame, and the answer costs five door solves —
 *  measured, it was a third of the whole draw. Pure in `g`, so it cannot go
 *  stale. */
const SEATS = new WeakMap<SynapseGeometry, { x: number; y: number }[]>()

function fillerSeats(g: SynapseGeometry): { x: number; y: number }[] {
  const hit = SEATS.get(g)
  if (hit) return hit
  const out = activeZone(g).docked.map((d) => vglutSeatAt(g, d))
  SEATS.set(g, out)
  return out
}

function clearOfFillers(
  g: SynapseGeometry,
  p: { x: number; y: number },
): { x: number; y: number } {
  let out = p
  for (const [k, d] of activeZone(g).docked.entries()) {
    const chair = fillerSeats(g)[k]
    const ax0 = chair.x - d.x
    const ay0 = chair.y - d.y
    const an0 = Math.hypot(ax0, ay0) || 1
    // ⚠ AND NOT INSIDE A BUBBLE AT ALL. The pool's spots are points on the way
    // from the terminal's own door to a vesicle's filler, and for the leftmost
    // bubble that line runs straight THROUGH it — measured, a ball resting in
    // the pool sat 8.8 px from a lumen's centre, inside a vesicle it had not
    // entered. Pushed out of the wall, and out on the side its own pore is on,
    // so the trip to the back of the queue cannot cross the bubble either.
    const rx = out.x - d.x
    const ry = out.y - d.y
    const rn = Math.hypot(rx, ry)
    if (rn < d.r + 5) {
      const mx = (ax0 / an0) * 1.2 + (rn > 1e-6 ? (rx / rn) * 0.8 : 0)
      const my = (ay0 / an0) * 1.2 + (rn > 1e-6 ? (ry / rn) * 0.8 : 0)
      const mn = Math.hypot(mx, my) || 1
      out = { x: d.x + (mx / mn) * (d.r + 7), y: d.y + (my / mn) * (d.r + 7) }
    }
    const dx = out.x - chair.x
    const dy = out.y - chair.y
    const n = Math.hypot(dx, dy)
    if (n >= FILLER_CLEAR) continue
    // Out along the door's own axis, which is the one direction that cannot
    // put it inside the bubble.
    const ax = chair.x - d.x
    const ay = chair.y - d.y
    const an = Math.hypot(ax, ay) || 1
    out = { x: chair.x + (ax / an) * FILLER_CLEAR, y: chair.y + (ay / an) * FILLER_CLEAR }
  }
  return out
}

/** ⚠ WHERE A BALL WAITS ITS TURN: IN THE POOL (21c-3l). It waited in a line
 *  standing off the door, like the calcium's queue inside the terminal — but
 *  the terminal's pool is already the waiting room, and a line off the door put
 *  a ball FURTHER from the bubble than the pool spot it left (measured: an 11 px
 *  turn-back, against a 7 px guard that exists to catch exactly that). The pool
 *  is the queue; a ball leaves it only when the pore is its own.
 *
 *  Nothing to compute, so nothing is exported — the note is the decision. */

/** ⚠ ONE VGLUT'S OWN STATE, read off whichever ball is in it (21c-3l) — the
 *  same contract as `caPumpStateAt`, so the filler and its cargo cannot
 *  disagree either.
 *
 *  Signed the way a transporter is: −1 open to the side the cargo COMES from,
 *  0 shut around it, +1 open to where it GOES. VGLUT stands on the bubble the
 *  other way up from a wall channel — its glyph's far end faces the lumen — so
 *  the drawing mirrors this, and that mirroring lives at the one draw site.
 *
 *  ⚠ AND NO ATP (kept from 21c-3f): VGLUT is not an ATPase. It is driven by the
 *  proton gradient the vesicle's V-ATPase makes, which is why this cycle has a
 *  shut beat where the calcium pump has a hexagon. */
export function fillerStateAt(
  g: SynapseGeometry,
  run: SynapseRun,
  ms: number,
  bubble: number,
): { open: number } {
  const { seats, slotMs } = refillQueue(g, run)
  for (const [, seat] of seats) {
    if (seat.bubble !== bubble) continue
    const t0 = REFILL_FROM_MS + seat.slot * slotMs
    if (ms < t0 - slotMs * 0.35 || ms > t0 + slotMs * (FILL_IN + FILL_SHUT + FILL_FLIP + FILL_OUT))
      continue
    return { open: transportOpen((ms - t0) / slotMs) }
  }
  return { open: 0 }
}

/** ⚠ Out of the nearest end of the gap and COLLECTED (21b-1, user,
 *  2026-09-04): clearance as arrival somewhere, never as a fade. Most
 *  escapees travel to the astrocyte finger on their own side — in through a
 *  transporter tick, resting visibly INSIDE the glial cell — and a seeded few
 *  are reclaimed by the spine's own transporter, the minor route. */
function escapePos(
  g: SynapseGeometry,
  run: SynapseRun,
  id: number,
  fromX: number,
  fromFrac: number,
  t0: number,
  ms: number,
  jiggleMs: number,
): NtDot {
  const side = fromX >= g.foot.x ? 1 : -1
  const exitX = g.foot.x + side * g.activeHalf * 1.05
  if (ms < t0 + ESCAPE_EXIT_MS) {
    const q = (ms - t0) / ESCAPE_EXIT_MS
    return { ...alongGap(g, fromX, fromFrac, exitX, 0.5, q), where: 'gap' }
  }
  const exit = inGap(g, exitX, 0.5)
  const t1 = t0 + ESCAPE_EXIT_MS
  // ⚠ NOTHING CROSSES THE BOUTON TO GET TO THE ASTROCYTE (user, 2026-09-05:
  // "the neurotransmitters should not rush to the astrocyte through the
  // presynaptic bouton"). The cell is on the right; a ball leaving by the LEFT
  // mouth was flying the whole width of the terminal to reach it.
  //
  // ⚠ And it leaves BY TRAVEL, not by fading (the 2026-09-01 ruling stands, and
  // the user chose this reading when the conflict was put to them): it drifts
  // out of the left edge and is gone because it has left the picture. That is
  // also the truth of it — astrocyte processes ring every synapse, and the one
  // drawn is simply the one this frame can see; the collectors those balls
  // reach are off-frame, which the info block says.
  if (side < 0) {
    // ⚠ SCATTERED, NOT A STREAM (user, 2026-09-05: "should leave by travelling,
    // but scatter into space instead of forming a stream line"). Every ball was
    // given the same destination, so they queued into a single line — which is
    // the one thing diffusion never looks like. Each now takes its OWN seeded
    // heading and its own speed, in a fan that only has to be leftward and
    // off the page; and the heading is drawn from the ball's id, so it is the
    // same journey every run.
    const spread = (H(id, 26) - 0.5) * 1.5 // ±0.75 rad about straight left
    const dir = Math.PI + spread
    const reach = 620 + H(id, 27) * 380
    const away = {
      x: exit.x + Math.cos(dir) * reach,
      y: exit.y - Math.sin(dir) * reach * 0.55,
    }
    const q = clamp01((ms - t1) / (ESCAPE_TRAVEL_MS * (1.4 + H(id, 28) * 1.6)))
    // ⚠ AND IT COMES BACK (21c-3, user: "it's presumed, but not visualized,
    // that there's another astrocyte on the left, so all NTs which went left,
    // withstood transformations and will return back"). The ball drifts off the
    // page, is out of the picture through the middle of the run — where a cell
    // this frame does not show takes it up and converts it — and returns as
    // GLUTAMINE through the terminal's own left-hand door, converting back
    // inside like every other. One grammar for both routes; the only difference
    // is that one route's astrocyte is off-frame, which the info block says.
    const lbeat = loopBeat(id)
    if (ms < RETURN_FROM_MS + lbeat) {
      return {
        x: lerp(exit.x, away.x, q) + wobX(jiggleMs, id) * (1 - q) * 1.4,
        y: lerp(exit.y, away.y, q) + wobY(jiggleMs, id) * (1 - q) * 1.4,
        where: q < 1 ? 'bath' : 'away',
      }
    }
    const leftDoor = loopDoors(g).snatInLeft
    if (ms < ENTER_FROM_MS + lbeat) {
      // ⚠ Straight at the door for the last stretch, so the approach cannot cut
      // through the cell's flank on its way to the hole in it.
      const hold = loopDoors(g).snatHolds[1] ?? outsideDoor(g, leftDoor)
      const r = clamp01((ms - RETURN_FROM_MS - lbeat) / (ENTER_FROM_MS - RETURN_FROM_MS))
      const bend = 0.72
      const p =
        r < bend
          ? { x: lerp(away.x, hold.x, r / bend), y: lerp(away.y, hold.y, r / bend) }
          : {
              x: lerp(hold.x, leftDoor.x, (r - bend) / (1 - bend)),
              y: lerp(hold.y, leftDoor.y, (r - bend) / (1 - bend)),
            }
      const dx2 = leftDoor.x - away.x
      const dy2 = leftDoor.y - away.y
      const n2 = Math.hypot(dx2, dy2) || 1
      const lane2 = loopLane(id) * Math.sin(r * Math.PI)
      return {
        x: p.x + (-dy2 / n2) * lane2,
        y: p.y + (dx2 / n2) * lane2,
        where: 'bath',
        glutamine: 1,
      }
    }
    return homeStretch(g, run, id, leftDoor, ms, jiggleMs)
  }
  if (H(id, 23) < NEURON_UPTAKE_FRAC) {
    // The neuronal route: a transporter on the spine's shoulder, just past
    // the zone's edge on this ball's own side.
    const tickX = g.foot.x + side * g.activeHalf * 1.35
    const tick = { x: tickX, y: faceAt(g, tickX) }
    const inside = { x: tickX - side * 8, y: tick.y + 16 + H(id, 24) * 12 }
    const q1 = clamp01((ms - t1) / (ESCAPE_TRAVEL_MS * 0.7))
    if (q1 < 1)
      return {
        x: lerp(exit.x, tick.x, q1),
        y: lerp(exit.y, tick.y, q1),
        where: 'bath',
      }
    const q2 = clamp01((ms - t1 - ESCAPE_TRAVEL_MS * 0.7) / (ESCAPE_TRAVEL_MS * 0.4))
    if (q2 < 1) {
      return {
        x: lerp(tick.x, inside.x, q2),
        y: lerp(tick.y, inside.y, q2),
        where: 'spine',
      }
    }
    return {
      x: inside.x + wobX(jiggleMs, id) * 0.5,
      y: inside.y + wobY(jiggleMs, id) * 0.5,
      where: 'spine',
    }
  }
  // ⚠ ONE CELL, ON THE RIGHT (21c-1). Escapees from BOTH gap ends now travel
  // to the same astrocyte — which is what having one astrocyte means, and what
  // a real asymmetric glial wrap looks like: the transmitter that leaves by
  // the far mouth still ends up in the cell that is there.
  const cell = astrocyteCell(g)
  const tick = cell.ticks[H(id, 25) < 0.5 ? 0 : 1]
  // ⚠ NOT UNDER A DOOR (21c-3g, user: "when they are inside the finger, they
  // overlap the channels"). The pockets are filtered against the astrocyte's
  // own intake doors when the cell is built, but the EXIT door is chosen later
  // — it depends on the cell — so the cell cannot know about it. The resting
  // spot is nudged along the chain here, where both are in view.
  const restDoors = [...cell.ticks, loopDoors(g).snatOut]
  let rest = astroCellRest(cell, H(id, 21), H(id, 22))
  for (let n = 1; n <= 6; n++) {
    if (!restDoors.some((d) => Math.hypot(rest.x - d.x, rest.y - d.y) < CHANNEL_SPAN * 0.9)) break
    rest = astroCellRest(cell, (H(id, 21) + n * 0.17) % 1, H(id, 22))
  }
  // ⚠ SQUARE INTO THE DOOR (21c-3f, user: "adjust NTs astrocyte enter path.
  // Currently: enters via membrane"). A straight line from the gap's mouth to
  // the transporter crosses the cell's outline wherever that line happens to
  // meet it, which on a wavy process is not the door. The ball comes to a
  // point straight out from the door and then goes in through it.
  // ⚠ SOLVED ONCE PER CELL, not per ball per frame (21c-3h). The approach has
  // to clear the cell all the way, not merely end outside it — a straight line
  // to a holding point can still clip a process, and then the ball enters 17 px
  // from the door it was aiming for. Searching for that per frame timed the
  // continuity walk out, so the cell works it out when it is built.
  const hold = cell.holds[H(id, 25) < 0.5 ? 0 : 1] ?? tick
  const q1 = clamp01((ms - t1) / ESCAPE_TRAVEL_MS)
  if (q1 < 1) {
    const bend = 0.74
    const p =
      q1 < bend
        ? { x: lerp(exit.x, hold.x, q1 / bend), y: lerp(exit.y, hold.y, q1 / bend) }
        : {
            x: lerp(hold.x, tick.x, (q1 - bend) / (1 - bend)),
            y: lerp(hold.y, tick.y, (q1 - bend) / (1 - bend)),
          }
    return { ...p, where: 'bath' }
  }
  // ⚠ IN THROUGH THE DOOR AND THEN ALONG THE PROCESS — not straight to the
  // resting spot. The reaching process is wavy, so a straight line from the
  // transporter to a pocket deep inside leaves the cell and comes back: the
  // guard caught a ball crossing the outline at (718, 332), 41 px from any
  // door. Inside the cell, travel follows the pockets.
  // ⚠ THROUGH THE PORE BEFORE TURNING (21c-3g, user: "the path crosses the
  // sides of the channels"). Heading for the resting pocket straight from the
  // door takes the ball out of the barrel sideways, through a subunit rather
  // than through the opening. It steps in along the line it arrived on first.
  const q2 = clamp01((ms - t1 - ESCAPE_TRAVEL_MS) / (ESCAPE_TRAVEL_MS * 0.6))
  if (q2 < 1) return {
      ...alongPockets(cell.pockets, insideDoor(cell, tick), rest, q2),
      where: 'glia',
    }
  // ── THE ROUND TRIP HOME (21c-2) ──────────────────────────────────────────
  //
  // ⚠ The stages and their model times are the LOOP'S OWN CLOCK LEGS, so what
  // the transport bar says is happening is what the balls are doing. Every
  // membrane crossing goes through a door: out of the astrocyte at its SNAT,
  // into the terminal at its SNAT — never through the wall (user, 2026-09-05:
  // "neurotransmitter balls should enter through the hole, not through
  // membrane").
  const doors = loopDoors(g)
  const wob = (p: { x: number; y: number }, k = 0.6) => ({
    x: p.x + wobX(jiggleMs, id) * k,
    y: p.y + wobY(jiggleMs, id) * k,
  })
  // ⚠ EACH BALL ON ITS OWN BEAT (21c-3i). Every leg boundary below is shifted
  // by this ball's own offset, so the cell empties as a queue rather than all
  // at once — and the balls stay separate objects the whole way home.
  const beat = loopBeat(id)
  // Sitting in the astrocyte until the conversion leg begins.
  if (ms < CONVERT_FROM_MS + beat) return { ...wob(rest), where: 'glia', glutamine: 0 }
  // CONVERTED: glutamine synthetase — a visible change of kind, in place.
  if (ms < SHIP_FROM_MS + beat) {
    const q = clamp01((ms - CONVERT_FROM_MS - beat) / (SHIP_FROM_MS - CONVERT_FROM_MS))
    // ⚠ AND IT FLASHES (user, 2026-09-05: "conversion should be accompanied by
    // a flash of the neurotransmitters, and not just a silent color change").
    // An enzyme doing work is an EVENT; a colour easing from teal to orange
    // over two seconds is not something a child notices happening. The flash
    // peaks where the change is fastest and is gone by the end of the leg, so
    // it marks the moment rather than tinting the stage.
    return { ...wob(rest), where: 'glia', glutamine: q, flash: Math.sin(q * Math.PI) ** 2 }
  }
  // ⚠ OUT THROUGH THE CELL, NOT THROUGH ITS WALL. A straight line from a
  // resting spot to the exit door leaves the process and comes back — the
  // guard measured a ball crossing the astrocyte's outline 41 px from any
  // door, at (718, 332). The processes are wavy, so travel inside the cell
  // follows the POCKETS, which are the points already measured to be inside
  // it, and only the last short hop reaches the door itself.
  if (ms < CROSS_FROM_MS + beat) {
    const q = clamp01((ms - SHIP_FROM_MS - beat) / (CROSS_FROM_MS - SHIP_FROM_MS))
    return {
      // …and out the same way: the last hop is the pore's own axis, so the ball
      // leaves through the opening rather than past a subunit.
      // ⚠ ENDS AT THE DOOR ITSELF, through its axis (21c-3h). Ending at the
      // point inside left the ball 17 px short of where the next leg begins —
      // a jump small enough to slip under the continuity walk's threshold and
      // still be visible.
      ...alongPockets(
        cell.pockets,
        rest,
        doors.snatOut,
        q,
        doors.exitVia,
        insideDoor(cell, doors.snatOut),
      ),
      where: 'glia',
      glutamine: 1,
    }
  }
  // Across the outside, from one door to the other — squared up to the
  // terminal's wall for the last stretch, for the same reason.
  if (ms < ENTER_FROM_MS + beat) {
    const q = clamp01((ms - CROSS_FROM_MS - beat) / (ENTER_FROM_MS - CROSS_FROM_MS))
    // ⚠ A CURVE, NOT TWO STRAIGHT LEGS (21c-3j, user: "make glutamine path
    // between astrocyte and bouton, to a curvy path"). A cubic whose control
    // points lie ON EACH DOOR'S OWN OUTWARD NORMAL: that is what makes the
    // curve leave the astrocyte square to its pore and arrive square to the
    // terminal's, which is the property the straight legs were there to keep.
    // The bend in the middle is the holding point the old path turned at, so
    // the route is the same route — drawn as one sweep instead of a dog-leg.
    const hold = doors.snatHolds[0] ?? outsideDoor(g, doors.snatIn)
    const outAstro = outsideOn(cellOf(g).placement, doors.snatOut, 1)
    const c1 = {
      x: doors.snatOut.x + (outAstro.x - doors.snatOut.x) * 90,
      y: doors.snatOut.y + (outAstro.y - doors.snatOut.y) * 90,
    }
    const outTerm = outsideDoor(g, doors.snatIn, 1)
    const c2 = {
      x: doors.snatIn.x + (outTerm.x - doors.snatIn.x) * 110 + (hold.x - doors.snatIn.x) * 0.35,
      y: doors.snatIn.y + (outTerm.y - doors.snatIn.y) * 110 + (hold.y - doors.snatIn.y) * 0.35,
    }
    const u = 1 - q
    const bez = (a0: number, b0: number, c0: number, d0: number) =>
      u * u * u * a0 + 3 * u * u * q * b0 + 3 * u * q * q * c0 + q * q * q * d0
    const p = {
      x: bez(doors.snatOut.x, c1.x, c2.x, doors.snatIn.x),
      y: bez(doors.snatOut.y, c1.y, c2.y, doors.snatIn.y),
    }
    // Its own lane across the gap, easing to nothing at both doors so it still
    // goes in through the pore.
    const dx = doors.snatIn.x - doors.snatOut.x
    const dy = doors.snatIn.y - doors.snatOut.y
    const n = Math.hypot(dx, dy) || 1
    const lane = loopLane(id) * Math.sin(q * Math.PI)
    return {
      x: p.x + (-dy / n) * lane,
      y: p.y + (dx / n) * lane,
      where: 'shipping',
      glutamine: 1,
    }
  }
  // In through the terminal's door, and converted back by glutaminase — the
  // same way home both routes take.
  return homeStretch(g, run, id, doors.snatIn, ms, jiggleMs)
}

/** ⚠ THE FIRST POCKET INSIDE A DOOR, MEMOISED (21c-4). Pure in the geometry and
 *  the door — it is walked in along the door's own normal until the bouton's
 *  traced outline says the point is inside — but it was being solved for EVERY
 *  ball on EVERY frame, and each attempt is a point-in-polygon test against the
 *  whole outline. Measured: the refilling leg's cast cost 2.7 ms a frame, and
 *  the guard that walks it 1,700 times timed out. There are two doors. */
const POCKETS = new WeakMap<object, { x: number; y: number }>()

function pocketInside(
  g: SynapseGeometry,
  door: { x: number; y: number },
): { x: number; y: number } {
  const hit = POCKETS.get(door)
  if (hit) return hit
  const outward = outsideDoor(g, door, 1)
  const inX = door.x - (outward.x - door.x)
  const inY = door.y - (outward.y - door.y)
  const along = (k: number) => ({ x: door.x + (inX - door.x) * k, y: door.y + (inY - door.y) * k })
  let inside = along(26)
  for (let step = 10; step <= 90; step += 6) {
    if (boutonHolds(g, along(step))) {
      inside = along(step + 14)
      break
    }
  }
  POCKETS.set(door, inside)
  return inside
}

/** ⚠ THE WAY HOME, SHARED BY BOTH ROUTES (21c-3). In through a door on the
 *  terminal's wall, converted back by glutaminase — with the flash — and then
 *  one drift to the bubble it is filling, passing through the standing pool on
 *  the way. The left route and the right route differ only in which door they
 *  arrive at, so they are drawn by one piece of code and cannot come to
 *  disagree about what happens after it. */
function homeStretch(
  g: SynapseGeometry,
  run: SynapseRun,
  id: number,
  door: { x: number; y: number },
  ms: number,
  jiggleMs: number,
): NtDot {
  const doors = loopDoors(g)
  const bubble = refillTarget(g, run, id)
  const wob = (p: { x: number; y: number }, k = 0.6) => ({
    x: p.x + wobX(jiggleMs, id) * k,
    y: p.y + wobY(jiggleMs, id) * k,
  })
  // ⚠ A POCKET MEASURABLY INSIDE THE TERMINAL — walked in from the door until
  // the bouton's own outline says the point is inside. Offsetting by a fixed
  // (−26, −34) put it OUTSIDE the cell at the door's real position, which is
  // a ball entering the wall rather than the terminal.
  // ⚠ AIMED AT THE BUBBLE FROM THE DOOR (user, 2026-09-05: "the balls should go
  // towards the newly created vesicles, and not onto the depth of the cell
  // first, and angle their path after"). The first pocket inside was stepped
  // toward the STOCK, which sits high in the terminal, so a returning ball rose
  // deep into the cell and then turned back down to the active zone — a dogleg
  // with no reason in it. It is stepped toward the bubble it is heading for, so
  // the whole way home is one drift toward the vesicles.
  // ⚠ Aimed at the DOOR the ball will use, not at the spot beyond it, so every
  // leg of the way home heads for the same place.
  const slot = refillSlot(g, run, id)
  // ⚠ STRAIGHT IN ALONG THE DOOR'S OWN NORMAL (21c-3h). Stepping toward the
  // SLOT put the first stretch along the wall rather than through it, so the
  // ball crossed the bouton 17.8 px from the door it had just used. It goes in
  // perpendicular first — through the pore — and turns afterwards.
  const inside = pocketInside(g, door)
  const beat = loopBeat(id)
  if (ms < BACK_FROM_MS + beat) {
    const q = clamp01((ms - ENTER_FROM_MS - beat) / (BACK_FROM_MS - ENTER_FROM_MS))
    // Its lane again, easing to nothing at the door so it still goes in through
    // the pore — two balls arriving together are side by side, never one dot.
    const dx = inside.x - door.x
    const dy = inside.y - door.y
    const n = Math.hypot(dx, dy) || 1
    // Zero at the door — it must go in through the pore — and full once it is
    // inside, so two balls that arrive together settle side by side.
    const lane = loopLane(id) * Math.sin((q * Math.PI) / 2) * 0.9
    return {
      x: lerp(door.x, inside.x, q) + (-dy / n) * lane,
      y: lerp(door.y, inside.y, q) + (dx / n) * lane,
      where: 'terminal',
      glutamine: 1,
    }
  }
  // ⚠ EVERY BALL GOES ON INTO A BUBBLE (21c-3, user: "all NTs should be
  // reuptaked … drift towards newly restored vesicles, and get pumped into
  // it"). The pool is still drawn and still named — it is a standing
  // concentration the drawn balls pass THROUGH, and the info block keeps the
  // point that a vesicle fills from it rather than from a particular returning
  // molecule — but no drawn ball stops there any more, because the run has to
  // end on the frame it started on.
  const seeded = {
    x: doors.stock.x + (H(id, 30) - 0.5) * doors.stock.r * 1.5,
    y: doors.stock.y + (H(id, 31) - 0.5) * doors.stock.r * 1.1,
  }
  const dx = slot.x - inside.x
  const dy = slot.y - inside.y
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(
    0.15,
    Math.min(0.85, ((seeded.x - inside.x) * dx + (seeded.y - inside.y) * dy) / len2),
  )
  const n = Math.sqrt(len2)
  // ⚠ Spread by the LANE, not by a fresh hash (21c-3i): a ball keeps the same
  // sideways offset the whole way home, so two that converge on the pool arrive
  // beside each other rather than on top.
  const off = loopLane(id) * 1.4
  const stockSpot = clearOfFillers(g, {
    x: inside.x + dx * t + (-dy / n) * off,
    y: inside.y + dy * t + (dx / n) * off,
  })
  if (ms < STOCK_FROM_MS + beat) {
    const q = clamp01((ms - BACK_FROM_MS - beat) / (STOCK_FROM_MS - BACK_FROM_MS))
    // ⚠ AND THIS CONVERSION SPARKLES TOO (user, 2026-09-05: "after entering
    // presynaptic neuron, glutamate should also sparkle at conversion"). Two
    // enzymes do work in this loop — glutamine synthetase in the astrocyte and
    // glutaminase here — and only one of them was an event on screen.
    // ⚠ The lane is carried IN from the previous leg and eased out (21c-3i).
    // Dropping it at the leg boundary snapped every ball back onto one line —
    // measured, a pair 2.5 px apart the instant the conversion began.
    const dx2 = stockSpot.x - inside.x
    const dy2 = stockSpot.y - inside.y
    const n2 = Math.hypot(dx2, dy2) || 1
    const lane2 = loopLane(id) * 0.9 * (1 - q)
    return {
      x: lerp(inside.x, stockSpot.x, q) + (-dy2 / n2) * lane2,
      y: lerp(inside.y, stockSpot.y, q) + (dx2 / n2) * lane2,
      where: 'terminal',
      glutamine: 1 - q,
      flash: Math.sin(q * Math.PI) ** 2,
    }
  }
  // ⚠ INTO THE STOCK, NOT INTO A VESICLE. The pool is the point: a vesicle
  // fills from the terminal's standing glutamate, it does not wait for the
  // molecule it released. Whether a given ball then goes on into a bubble is
  // seeded, so the pool visibly keeps some — a budget, not a conveyor.
  // ⚠ ONE BALL AT A TIME THROUGH ONE PORE (21c-3l, user: "improve animation for
  // NT pump in vesicles: same animation mechanics as Ca channels"). Every
  // returning ball used to set off on its own beat and swim straight into the
  // lumen — a filler with no cycle, and two balls could be inside the same pore
  // at once. It now waits in line, takes its turn, is held while VGLUT shuts
  // around it and swings, and only then drops into the bubble.
  const mySeat = refillQueue(g, run).seats.get(id)
  const slotMs = refillQueue(g, run).slotMs
  if (!mySeat) {
    return { ...wob(stockSpot, 0.5), where: 'stock', glutamine: 0 }
  }
  const dock = fillBubble(g, run, id)
  const t0 = REFILL_FROM_MS + mySeat.slot * slotMs
  // Its turn has not come: it is one of the pool, wandering.
  if (ms < t0) {
    return { ...wob(stockSpot, 0.5), where: 'stock', glutamine: 0 }
  }
  const chair = vglutSeatAt(g, dock)
  const tt = ms - t0
  // Out of the pool, in through the pore, and then HELD — no wobble while the
  // filler is shut around it, the same stillness the calcium keeps in its seat.
  if (tt < slotMs * (FILL_IN + FILL_SHUT + FILL_FLIP)) {
    const e = clamp01(tt / (slotMs * FILL_IN))
    return {
      x: lerp(stockSpot.x, chair.x, e) + wobX(jiggleMs, id) * (1 - e) * 0.4,
      y: lerp(stockSpot.y, chair.y, e) + wobY(jiggleMs, id) * (1 - e) * 0.4,
      where: 'stock',
      glutamine: 0,
    }
  }
  const eOut = clamp01(
    (tt - slotMs * (FILL_IN + FILL_SHUT + FILL_FLIP)) / (slotMs * FILL_OUT),
  )
  if (eOut < 1) {
    return {
      x: lerp(chair.x, bubble.x, eOut),
      y: lerp(chair.y, bubble.y, eOut),
      where: 'stock',
      glutamine: 0,
    }
  }
  return { ...wob(bubble, 0.35), where: 'vesicle', glutamine: 0 }
}

/** ⚠ TRAVEL INSIDE A CELL FOLLOWS ITS OWN INSIDE. The pockets were gathered by
 *  walking the reaching process and keeping only the points the traced outline
 *  really holds, so the chain of them is a path that cannot leave the cell.
 *  This walks from a start point onto that chain, along it toward whichever
 *  pocket is nearest the door, and only then out to the door. */
function alongPockets(
  pockets: { x: number; y: number }[],
  from: { x: number; y: number },
  door: { x: number; y: number },
  q: number,
  approach?: { x: number; y: number },
  /** ⚠ A last waypoint on the DOOR'S OWN AXIS (21c-3h, user: "crossing the
   *  orange channel expected going around it and into the pore"). Without it
   *  the hop from the last pocket to the door comes in from whatever side the
   *  pocket happens to be on, which is across the protein rather than along
   *  its pore. */
  throughAxis?: { x: number; y: number },
): { x: number; y: number } {
  if (pockets.length < 2) return { x: lerp(from.x, door.x, q), y: lerp(from.y, door.y, q) }
  const nearest = (p: { x: number; y: number }) => {
    let bi = 0
    let bd = Infinity
    for (const [i, k] of pockets.entries()) {
      const d = Math.hypot(k.x - p.x, k.y - p.y)
      if (d < bd) {
        bd = d
        bi = i
      }
    }
    return bi
  }
  const a = nearest(from)
  // ⚠ THE CHAIN STOPS AT THE APPROACH, not at whichever pocket happens to lie
  // nearest the door. Running to the nearest one carried the ball PAST the door
  // and back — measured, out of the cell at (724, 320) — because the pockets
  // walk the process and the door is on its wall, so "nearest to the door" can
  // be further along the process than the door is.
  const b = approach ? nearest(approach) : nearest(door)
  const raw: { x: number; y: number }[] = [from]
  const step = b >= a ? 1 : -1
  for (let i = a; i !== b + step; i += step) raw.push(pockets[i])
  if (throughAxis) raw.push(throughAxis)
  raw.push(door)
  // ⚠ AND THE LAST HOP IS THE ONE THAT WAS SOLVED (21c-3a). The pockets run
  // along the process's CENTRELINE while a door sits on its wall, so the hop to
  // the door has to be chosen — measured, an unchosen one overshot and left the
  // cell at (724, 320), 47 px from any door. `approach` is the pocket that hop
  // was verified from, worked out once per cell rather than per ball per frame,
  // which is what the continuity walk could not afford.
  const chain = raw
  // Walk the chain by arc length, so the ball keeps one speed through it.
  const segs = chain.slice(1).map((p, i) => Math.hypot(p.x - chain[i].x, p.y - chain[i].y))
  const total = segs.reduce((t, l) => t + l, 0) || 1
  let want = clamp01(q) * total
  for (const [i, len] of segs.entries()) {
    if (want <= len || i === segs.length - 1) {
      const t = clamp01(want / Math.max(1e-6, len))
      return {
        x: lerp(chain[i].x, chain[i + 1].x, t),
        y: lerp(chain[i].y, chain[i + 1].y, t),
      }
    }
    want -= len
  }
  return door
}

/** A point just inside the terminal, from a door on its wall: stepped toward
 *  the stock until `boutonHolds` agrees, so the first frame after the door is
 *  really in the cytoplasm. */
export function insideFrom(
  g: SynapseGeometry,
  door: { x: number; y: number },
  toward: { x: number; y: number },
): { x: number; y: number } {
  const dx = toward.x - door.x
  const dy = toward.y - door.y
  const len = Math.hypot(dx, dy) || 1
  for (let step = 10; step <= 90; step += 5) {
    const q = { x: door.x + (dx / len) * step, y: door.y + (dy / len) * step }
    if (boutonHolds(g, q)) return q
  }
  return { x: door.x + (dx / len) * 40, y: door.y + (dy / len) * 40 }
}

/** The VGLUT door on the bubble this ball is filling — the hole it goes in by. */
function refillSlot(g: SynapseGeometry, run: SynapseRun, id: number): { x: number; y: number } {
  return vglutAt(g, fillBubble(g, run, id)).at
}

/** ⚠ THE BUBBLE THIS BALL FILLS — ONE OWNER (21c-3l). The door, the resting
 *  spot and the queue each worked it out from the same hash, which is three
 *  copies of one decision; the queue balances the load, so the other two have
 *  to ask IT or they end up filling a different bubble than the one whose pore
 *  the ball is standing in. */
function fillBubble(
  g: SynapseGeometry,
  run: SynapseRun,
  id: number,
): { x: number; y: number; r: number; index: number } {
  const docked = activeZone(g).docked
  const seat = refillQueue(g, run).seats.get(id)
  return docked[seat ? seat.bubble : Math.floor(H(id, 33) * docked.length) % docked.length]
}

/** Which refilling bubble this ball rains into, and where inside it — seeded,
 *  so the same ball always goes to the same place. */
function refillTarget(g: SynapseGeometry, run: SynapseRun, id: number): { x: number; y: number } {
  const d = fillBubble(g, run, id)
  // ⚠ JUST INSIDE THE DOOR IT CAME THROUGH (21c-3e). A freely seeded spot in
  // the lumen can sit on the far side of the bubble's centre from VGLUT, and
  // then coming in through the door means briefly moving AWAY from where the
  // ball is going — measured, a 2.2 px turn-back, which is the same dogleg in
  // miniature. Settling on the door's own side keeps the whole way home
  // monotone, and reads better besides: it arrives where it came in.
  const slot = vglutAt(g, d).at
  const inward = Math.atan2(d.y - slot.y, d.x - slot.x)
  const step = d.r * (0.35 + H(id, 35) * 0.5)
  // ⚠ A SMALL sideways spread only. At ±0.35 r the resting spot sat far enough
  // off the door's own line that arriving at the door and then turning to it
  // moved a ball AWAY from where it was going for a couple of pixels — the
  // dogleg again, at the last corner. ±0.09 r still keeps them off each other.
  const spread = (H(id, 34) - 0.5) * d.r * 0.18
  return {
    x: slot.x + Math.cos(inward) * step - Math.sin(inward) * spread,
    y: slot.y + Math.sin(inward) * step + Math.cos(inward) * spread,
  }
}

/** How much longer a caught pair stays SEATED after the model's bound
 *  population has fallen past its receptor's rung (user, 2026-09-01: "bound
 *  neurotransmitters should stay bound longer, so users have time to
 *  understand causes"). A declared reading-speed hold — the model's counts
 *  are the info panel's; the picture holds each pair a beat longer. */
export const RELEASE_HOLD_MS = 5

const spanXOf = (g: SynapseGeometry) => (x: number) =>
  Math.max(g.foot.x - g.activeHalf * 0.95, Math.min(g.foot.x + g.activeHalf * 0.95, x))

/** ⚠ WHERE A BALL STANDS AFTER RELEASE (user, 2026-09-01): the LEFT fusing
 *  vesicle's transmitter spreads leftward, the RIGHT one's rightward, and
 *  the middle one's across the whole receptor row. One function, used by the
 *  cast, the fates, the seat windows and the bind pulses alike. */
function standXOf(g: SynapseGeometry, d: { x: number }, id: number): number {
  const spanX = spanXOf(g)
  const side = Math.sign(d.x - g.foot.x)
  if (side === 0) {
    return spanX(g.foot.x + (H(id, 1) - 0.5) * 2 * g.activeHalf * 0.8)
  }
  return spanX(d.x + side * (0.05 + H(id, 1) * 0.6) * g.activeHalf)
}

/** The capture fates, assigned deterministically: each receptor that binds
 *  takes the two emitted balls whose standing places sit nearest it. Shared
 *  by the cast and by `receptorSeatWindow`, so the drawing and the channel
 *  states can never disagree about who is seated where. */
function assignFates(
  g: SynapseGeometry,
  run: SynapseRun,
  cleft: CleftRun,
): Map<number, { r: number; k: number }> {
  const docked = activeZone(g).docked
  const sites = castSeats(g)
  const emitted: { id: number; xs: number }[] = []
  for (const [v, d] of docked.entries()) {
    const tf = run.vesicles[d.index]?.fusedAtMs ?? null
    if (tf === null) continue
    for (let c = 0; c < 7; c++) {
      const id = v * 7 + c
      emitted.push({ id, xs: standXOf(g, d, id) })
    }
  }
  const fate = new Map<number, { r: number; k: number }>()
  const taken = new Set<number>()
  for (const [r, site] of sites.entries()) {
    const mine = (r + 0.5) / sites.length
    const { tUp } = crossings(cleft.bound, cleft.windowMs, mine)
    if (tUp === null) continue
    const nearest = emitted
      .filter((e) => !taken.has(e.id))
      .sort((a, b) => Math.abs(a.xs - site.x) - Math.abs(b.xs - site.x))
      .slice(0, 2)
    for (const [k, e] of nearest.entries()) {
      taken.add(e.id)
      fate.set(e.id, { r, k })
    }
  }
  return fate
}

/** ⚠ WHEN A RECEPTOR'S PAIR IS TRULY SEATED, AND WHEN IT IS LET GO (user,
 *  2026-09-01: "postsynaptic channels open before neurotransmitters got
 *  bound"). The drawn channel may only show bound/open once the LATER of its
 *  two balls has finished settling — the same clocks the cast animates, so
 *  the picture cannot contradict itself. */
function seatedAtOf(
  g: SynapseGeometry,
  run: SynapseRun,
  cleft: CleftRun,
  rIdx: number,
): number | null {
  const sites = castSeats(g)
  const docked = activeZone(g).docked
  const mine = (rIdx + 0.5) / sites.length
  const { tUp } = crossings(cleft.bound, cleft.windowMs, mine)
  if (tUp === null) return null
  const fate = assignFates(g, run, cleft)
  let latest: number | null = null
  for (const [id, f] of fate) {
    if (f.r !== rIdx) continue
    const v = Math.floor(id / 7)
    const d = docked[v]
    const tf = run.vesicles[d.index]?.fusedAtMs
    if (tf === null || tf === undefined) continue
    const start = tf + H(id, 2) * EMERGE_STAGGER_MS
    // The SAME per-ball travel arithmetic the cast animates.
    const mouthX = d.x + (H(id, 3) - 0.5) * 10
    const mouth = inGap(g, mouthX, 0.16)
    const standPt = inGap(g, standXOf(g, d, id), 0.15 + H(id, 4) * 0.7)
    const travel =
      (d.r * 1.3) / NT_SPEED +
      Math.max(4, Math.hypot(standPt.x - mouth.x, standPt.y - mouth.y)) / NT_SPEED
    const done = Math.max(tUp, start + travel) + CAPTURE_MS
    latest = latest === null ? done : Math.max(latest, done)
  }
  return latest
}

export function receptorSeatWindow(
  g: SynapseGeometry,
  run: SynapseRun,
  cleft: CleftRun,
  rIdx: number,
): { seatedAt: number | null; releasedAt: number | null } {
  const seated = seatedAtOf(g, run, cleft, rIdx)
  if (seated === null) return { seatedAt: null, releasedAt: null }
  // ⚠ A SLOW SEAT KEEPS ITS LIGAND. NMDA's glutamate stays bound for hundreds
  // of milliseconds against AMPA's one or two, and that slow unbinding is the
  // whole reason NMDA is the slow one. On this run's sixty-millisecond window
  // "for the rest of it" is the honest answer, so the ball stays put.
  if (rIdx === g.slowSeat) return { seatedAt: seated, releasedAt: null }
  // ⚠ THE PAIR STAYS PLUGGED FOR THE WHOLE TRANSACTION (user, 2026-09-01:
  // "signal neurotransmitters leave the channel while ions still go through —
  // expected: stay put… glow disappears, NTs fly away, channel closes"). On a
  // receptor whose gate opens, release is scheduled OFF THE DOOR — this lead
  // before its close, after the ions and the reflection pause. Only a
  // receptor that never opens falls back to the model's own unbinding.
  const ow = receptorOpenWindow(g, run, cleft, rIdx)
  if (ow !== null) return { seatedAt: seated, releasedAt: ow.closeAt - NT_DEPART_LEAD_MS }
  const mine = (rIdx + 0.5) / castSeats(g).length
  const { tDown } = crossings(cleft.bound, cleft.windowMs, mine)
  return {
    seatedAt: seated,
    // ⚠ Once seated, a pair holds at least a readable beat even if the
    // model's population unbound while it was still travelling.
    releasedAt: tDown === null ? null : Math.max(tDown + RELEASE_HOLD_MS, seated + 2.5),
  }
}

/** ⚠ EVERY TRANSMITTER BALL IN THE VIEW, from first frame to last: 7 per
 *  docked vesicle, in a fixed order (vesicle-major), so ball i can be
 *  followed through the whole run.
 *
 *  A ball's life: in its bubble → (if the bubble fuses) out through the mouth
 *  → a blink of a puff to its standing place near that mouth → thermal wander
 *  → its FATE: captured onto a receptor's seat (two per receptor that binds,
 *  released again if the receptor lets go) or out an end of the gap into the
 *  bath, where it stays. What empties the gap is DEPARTURE, which is what
 *  clearance physically is. */
export function transmitterCast(
  g: SynapseGeometry,
  run: SynapseRun,
  cleft: CleftRun,
  ms: number,
  /** The ambient thermal clock — screen-time from the caller, so the jiggle
   *  never pauses with the legs. Defaults to the run's ms (deterministic in
   *  tests). */
  jiggleMs = ms,
): NtDot[] {
  const docked = activeZone(g).docked
  const sites = castSeats(g)
  // ⚠ INSIDE THE APPOSED REGION only: past ~±activeHalf the bulb's flank
  // veers steeply up and the "gap" flares tall — a ball travelling along it
  // there plunges 100 px in a step (measured). Stands, waits and exits all
  // keep clear of the cliff.
  const spanX = spanXOf(g)

  const fate = assignFates(g, run, cleft)

  const out: NtDot[] = []
  for (const [v, d] of docked.entries()) {
    const tf = run.vesicles[d.index]?.fusedAtMs ?? null
    for (let c = 0; c < 7; c++) {
      const id = v * 7 + c
      const shape = tf === null || ms < tf ? null : fusedShape(g, d.x, ms - tf, d.r)
      const cy = shape ? shape.cy : d.y
      const inBubble = cargoIn(d.x, cy, d.r)[c]
      const start = tf === null ? Infinity : tf + H(id, 2) * EMERGE_STAGGER_MS
      if (ms < start) {
        out.push({ x: inBubble.x, y: inBubble.y, where: 'vesicle' })
        continue
      }
      // Out through the mouth…
      const mouthX = d.x + (H(id, 3) - 0.5) * 10
      const mouth = inGap(g, mouthX, 0.16)
      const emergeDur = (d.r * 1.3) / NT_SPEED
      const emergeEnd = start + emergeDur
      if (ms < emergeEnd) {
        const q = (ms - start) / emergeDur
        out.push({
          x: lerp(inBubble.x, mouth.x, q),
          y: lerp(inBubble.y, mouth.y, q),
          where: 'gap',
        })
        continue
      }
      // …then along the gap to its standing place, AT THE SAME SPEED — the
      // left vesicle's leftward, the right one's rightward, the middle's
      // across the receptor row.
      const standX = standXOf(g, d, id)
      const standF = 0.15 + H(id, 4) * 0.7
      const standPt = inGap(g, standX, standF)
      const disperseDur =
        Math.max(4, Math.hypot(standPt.x - mouth.x, standPt.y - mouth.y)) / NT_SPEED
      const disperseEnd = emergeEnd + disperseDur
      if (ms < disperseEnd) {
        const q = (ms - emergeEnd) / disperseDur
        out.push({
          ...alongGap(g, mouthX, 0.16, standX, standF, q),
          where: 'gap',
        })
        continue
      }
      const stand = inGap(g, standX, standF)
      const wander = {
        x: stand.x + wobX(jiggleMs, id),
        y: stand.y + wobY(jiggleMs, id),
      }

      const myFate = fate.get(id)
      if (myFate) {
        const site = sites[myFate.r]
        const mine = (myFate.r + 0.5) / sites.length
        const { tUp } = crossings(cleft.bound, cleft.windowMs, mine)
        const tCap = Math.max(tUp ?? Infinity, disperseEnd)
        if (ms < tCap) {
          out.push({ ...wander, where: 'gap' })
          continue
        }
        // The CLOSED seat is the capture target; once plugged, the ball reads
        // the channel's own separation every frame and rides the mouth apart
        // (user, 2026-09-01: "stay put, visually following their plugged
        // position with respect to the channel moving as it opens") — put
        // things ON the shape, applied to a shape that moves.
        const seat0 = ntSeatAt(g, myFate.r, myFate.k, 0)
        const seatF = gapFrac(g, seat0.x, seat0.y)
        if (ms < tCap + CAPTURE_MS) {
          const q = (ms - tCap) / CAPTURE_MS
          out.push({
            ...alongGap(g, standX, standF, seat0.x, seatF, q),
            where: 'gap',
          })
          continue
        }
        // ⚠ ONE owner for the release time — the shared seat window, which
        // schedules it off the door's own close (glow off → fly away → shut).
        const tRel = receptorSeatWindow(g, run, cleft, myFate.r).releasedAt
        if (tRel === null || ms < tRel) {
          const seat = ntSeatAt(
            g,
            myFate.r,
            myFate.k,
            receptorOpenFrac(g, run, cleft, myFate.r, ms),
          )
          // Plugged means PLUGGED: no wobble — the stillness is the boundness.
          out.push({ x: seat.x, y: seat.y, where: 'seat' })
          continue
        }
        // ⚠ LET GO, NOT SENT AWAY (user, 2026-09-01: "after binding, the
        // transmitter should not rush away — it should stay in the synaptic
        // cleft for future reuptake"). And that is the science: a molecule
        // unbinding this late in the window really is still in the gap, and
        // the transporters that will reclaim it work on a slower clock than
        // this run. So it lifts off the seat and WAITS in the cleft nearby.
        // Lift-off starts from wherever the seat stands AT release — the
        // subunits are still parted then, so leaving from the closed seat
        // would be a sideways teleport.
        const seatRel = ntSeatAt(
          g,
          myFate.r,
          myFate.k,
          receptorOpenFrac(g, run, cleft, myFate.r, tRel),
        )
        const seatRelF = gapFrac(g, seatRel.x, seatRel.y)
        const liftF = Math.max(0.15, seatRelF - 0.45)
        const lingerX = spanX(site.x + (H(id, 6) - 0.5) * 40)
        if (ms < tRel + RELEASE_MS) {
          const q = (ms - tRel) / RELEASE_MS
          out.push({
            ...alongGap(g, seatRel.x, seatRelF, lingerX, liftF, q),
            where: 'gap',
          })
          continue
        }
        const linger = inGap(g, lingerX, liftF)
        // ⚠ …AND THEN THEY GO TOO (21c-3, user: "all NTs should be reuptaked").
        // They held the gap for the whole run, which left ten balls sitting in
        // the cleft on the last frame — the demo could not end on the frame it
        // started on. They still linger far longer than the rest; they simply
        // no longer linger for ever, and they split by the side they are on:
        // left ones out of the picture and home the far way, right ones to the
        // astrocyte, exactly like the escapees.
        // ⚠ IT CANNOT LEAVE BEFORE IT HAS ARRIVED. Starting every lingerer's
        // escape at a fixed 21 ms teleported the ones still gliding to their
        // linger spot: they vanished mid-glide and reappeared 60% of the way to
        // the gap's mouth — measured as an 80 px jump at 23.1 ms by the J1
        // continuity walk, which is exactly the fault J1 exists to catch. The
        // escape starts at 21 ms OR when the glide ends, whichever is later.
        const tLingerGo = Math.max(LINGER_ESCAPE_MS, tRel + RELEASE_MS)
        if (ms >= tLingerGo) {
          out.push(escapePos(g, run, id, lingerX, liftF, tLingerGo, ms, jiggleMs))
          continue
        }
        out.push({
          x: linger.x + wobX(jiggleMs, id),
          y: linger.y + wobY(jiggleMs, id),
          where: 'gap',
        })
        continue
      }
      // The rest leave the gap at an end during the decay — clearance as
      // departure, never as a fade.
      const tEsc = disperseEnd + ESCAPE_START_MS + H(id, 5) * ESCAPE_SPREAD_MS
      if (ms < tEsc) {
        out.push({ ...wander, where: 'gap' })
        continue
      }
      out.push(escapePos(g, run, id, standX, standF, tEsc, ms, jiggleMs))
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────── the calcium

/** ⚠ Slowed (user, 2026-09-01: "Ca ions rush toward the channel; at 4 ms
 *  they rush"): the LATE entries — the ones paced by the charge rungs rather
 *  than a fusion deadline — play in the gap leg, where 0.3 ms was a third of
 *  a second over two hundred pixels. */
export const CA_APPROACH_MS = 1.0
export const CA_CROSS_MS = 0.6
export const CA_SETTLE_MS = 0.7
/** ⚠ Long, because the clearances play in the COMPRESSED tail leg (51 model
 *  ms in ~2.4 s of screen): at 8 ms this drift flashed by in a third of a
 *  second (user, 2026-09-01: "pink balls still rush at the end"). Long
 *  enough that the short slip off the knob is a calm drift wherever it
 *  plays. */
export const CA_BUFFERED_TRAVEL_MS = 20

export interface CaDot {
  x: number
  y: number
  where: 'cleft' | 'zone' | 'deep'
}

/** When each calcium ion ENTERS: ion i goes when the model's own integrated
 *  calcium current crosses its rung — the count inside always tracks the real
 *  charge carried. And when it LEAVES the zone: when the terminal's clearing
 *  average falls back below that same rung, it is grabbed by the buffers and
 *  drifts deeper inside (BUFFER_RATIO is the model's own fact), where it
 *  stays. Nothing dims. Memoised per run: the answer never changes. */
const CA_TIMES = new WeakMap<SynapseRun, { te: (number | null)[]; tc: (number | null)[] }>()

function calciumTimes(run: SynapseRun): {
  te: (number | null)[]
  tc: (number | null)[]
} {
  const hit = CA_TIMES.get(run)
  if (hit) return hit
  const n = run.ica.length
  const dt = run.windowMs / Math.max(1, n - 1)
  let total = 0
  const prefix: number[] = []
  for (let k = 0; k < n; k++) {
    total += Math.max(0, -run.ica[k])
    prefix.push(total)
  }
  const te: (number | null)[] = []
  const tc: (number | null)[] = []
  const caDt = run.windowMs / Math.max(1, run.caUm.length - 1)
  const swing = Math.max(1e-9, run.peakCaUm - run.restUm)
  // ⚠ THE TRIGGER ARRIVES BEFORE THE TRIGGERED (user, 2026-09-01: "vesicles
  // should only start merging when calcium is bound at the SNARE"). Fusion IS
  // calcium seated at the vesicle — so for every vesicle that fuses, the two
  // earliest ions anchored to its slot are scheduled to be RESTING at its
  // feet before its fusion instant. A curation of the drawn schedule, and the
  // more honest one: the charge those ions carry genuinely came in first.
  const mustArriveBy: (number | null)[] = []
  for (let i = 0; i < CA_N; i++) {
    const v = i % run.vesicles.length
    const tf = run.vesicles[v]?.fusedAtMs ?? null
    // The two lowest-rung ions of each fused slot carry the deadline.
    mustArriveBy.push(tf !== null && i < run.vesicles.length * 2 ? tf : null)
  }
  for (let i = 0; i < CA_N; i++) {
    const rung = (i + 0.5) / CA_N
    let enter: number | null = null
    if (total > 0) {
      for (let k = 0; k < n; k++) {
        if (prefix[k] / total >= rung) {
          enter = k * dt
          break
        }
      }
    }
    const deadline = mustArriveBy[i]
    if (enter !== null && deadline !== null) {
      // The margin below buys the SEATED HOLD the user asked for: on the
      // legged clock (a beat sits between the calcium's settling and the
      // exocytosis) the ion rests on its knob for well over a second of
      // screen time before its vesicle goes.
      // Floored: the slower legs push the earliest deadline-clamped entries
      // toward t = 0; an ion may not start before the run does.
      enter = Math.max(
        0.15,
        Math.min(enter, deadline - (CA_APPROACH_MS + CA_CROSS_MS + CA_SETTLE_MS) - 0.45),
      )
    }
    te.push(enter)
    let clear: number | null = null
    for (let k = 0; k < run.caUm.length; k++) {
      const t = k * caDt
      if (t <= run.caPeakMs) continue
      if ((run.caUm[k] - run.restUm) / swing < rung) {
        clear = t
        break
      }
    }
    tc.push(clear)
  }
  const res = { te, tc }
  CA_TIMES.set(run, res)
  return res
}

export function calciumCast(
  g: SynapseGeometry,
  run: SynapseRun,
  ms: number,
  jiggleMs = ms,
): CaDot[] {
  const { te, tc } = calciumTimes(run)
  const { docked, doors } = activeZone(g)
  const r = vesicleR(g)
  const out: CaDot[] = []
  for (let i = 0; i < CA_N; i++) {
    // ⚠ WAITS NEAR ITS OWN ANCHOR (user, 2026-09-01: ions "rush to the
    // sides" — an ion whose wait spot and destination knob sat at opposite
    // ends of the zone dashed across during its settle). Waiting beside the
    // anchor means entering through an adjacent door and settling a few
    // pixels: it stays in the vicinity for its whole life.
    const anchor0 = docked[i % docked.length]
    const waitX = Math.max(
      g.foot.x - g.activeHalf * 0.95,
      Math.min(g.foot.x + g.activeHalf * 0.95, anchor0.x + (H(i, 11) - 0.5) * g.activeHalf * 0.5),
    )
    const waitF = 0.25 + H(i, 12) * 0.5
    const wait = inGap(g, waitX, waitF)
    const enter = te[i]
    if (enter === null || ms < enter) {
      out.push({
        x: wait.x + wobX(jiggleMs, i + 40),
        y: wait.y + wobY(jiggleMs, i + 40),
        where: 'cleft',
      })
      continue
    }
    const door = doors.reduce((a, b) => (Math.abs(a.x - waitX) < Math.abs(b.x - waitX) ? a : b))
    const belowF = gapFrac(g, door.x, wallAt(g, door.x) + MEM_PX + 10)
    const above = { x: door.x, y: wallAt(g, door.x) - MEM_PX - 12 }
    const anchor = docked[i % docked.length]
    // ⚠ EXACTLY ON THE PLACEHOLDER (user, 2026-09-01: "some Ca ions are not
    // fitting their binding placeholders"): there are two synaptotagmin knobs
    // per vesicle, so exactly `2 × slots` ions can bind — each of the first
    // ten gets its OWN knob, dead centre, no offsets. The invented "tier"
    // stacking that hovered ions beside the rings is gone: the surplus ions
    // do not pretend to bind — they settle nearby as FREE calcium (the honest
    // picture: calcium beyond the sensors' capacity stays free in the
    // terminal until the buffers grab it).
    const bound = i < docked.length * 2
    const knob = snareMini(g, anchor).knobs[Math.floor(i / docked.length) % 2]
    const freeX = anchor.x + (H(i, 21) - 0.5) * r * 3
    const feet = bound
      ? { x: knob.x, y: knob.y }
      : { x: freeX, y: wallAt(g, freeX) - MEM_PX - r * (1.5 + H(i, 22) * 1.5) }
    if (ms < enter + CA_APPROACH_MS) {
      // Along the gap to the door's mouth — never through a wall on the way.
      const q = (ms - enter) / CA_APPROACH_MS
      out.push({
        ...alongGap(g, waitX, waitF, door.x, belowF, q),
        where: 'cleft',
      })
      continue
    }
    const below = inGap(g, door.x, belowF)
    if (ms < enter + CA_APPROACH_MS + CA_CROSS_MS) {
      const q = (ms - enter - CA_APPROACH_MS) / CA_CROSS_MS
      out.push({ x: below.x, y: lerp(below.y, above.y, q), where: 'zone' })
      continue
    }
    if (ms < enter + CA_APPROACH_MS + CA_CROSS_MS + CA_SETTLE_MS) {
      const q = (ms - enter - CA_APPROACH_MS - CA_CROSS_MS) / CA_SETTLE_MS
      out.push({
        x: lerp(above.x, feet.x, q),
        y: lerp(above.y, feet.y, q),
        where: 'zone',
      })
      continue
    }
    const clear = tc[i]
    // ⚠ EVERY ION LEAVES, not only the buffered ones (21c-3). The four whose
    // sensors never let go within the window would otherwise still be inside on
    // the last frame — and the whole point of the extrusion is that the frame
    // closes. An ion still seated when the pumps start simply leaves from its
    // seat, which is what unbinding and extrusion look like together.
    const dxOut = feet.x + (H(i, 16) - 0.5) * r * 2.5
    const deepSpot = {
      x: dxOut,
      y: wallAt(g, dxOut) - MEM_PX - r * (1.2 + H(i, 17) * 1.4),
    }
    if (ms >= CA_EXTRUDE_FROM_MS) {
      const buffered = clear !== null && ms >= clear + CA_BUFFERED_TRAVEL_MS
      const from = buffered ? deepSpot : feet
      const pumps = loopDoors(g).caPumps
      const seat = caQueue(g, (k) => restOfIon(g, run, k))[i]
      const pump = pumps[seat.pump]
      const t0 = caTurnAt(seat.slot)
      // ⚠ WAITS ITS TURN, just inside the pump (21c-3k). The approach is short
      // and the wait is the rest — which is what a queue at a transporter is.
      if (ms < t0) {
        const wait = insideOfPump(g, pump, seat.slot)
        const e1 = clamp01((ms - CA_EXTRUDE_FROM_MS) / CA_TO_PUMP_MS)
        out.push({
          x: lerp(from.x, wait.x, e1) + wobX(jiggleMs, i + 40) * (1 - e1) * 0.6,
          y: lerp(from.y, wait.y, e1) + wobY(jiggleMs, i + 40) * (1 - e1) * 0.6,
          where: 'zone',
        })
        continue
      }
      const t = ms - t0
      const justOut = outsideDoor(g, pump, 30)
      // ⚠ IN ITS SEAT, AND STILL (21c-3l, user: "positioned not in the middle
      // of the channel, but closer to the entrance … circle shaped slot"). The
      // chamber the handover draws, not the middle of the wall — `caSeatAt`
      // finds it on the trace. No wobble while it is there, because being held
      // is the whole point of this beat.
      const chair = caSeatAt(g, pump)
      if (t < CA_SIT_MS + CA_ATP_MS + CA_FLIP_MS) {
        const wait = insideOfPump(g, pump, seat.slot)
        const enter = clamp01(t / CA_SIT_MS)
        out.push({
          x: lerp(wait.x, chair.x, enter),
          y: lerp(wait.y, chair.y, enter),
          where: 'zone',
        })
        continue
      }
      // …and only then out, through the pore it was sitting in.
      const e2 = clamp01((t - CA_SIT_MS - CA_ATP_MS - CA_FLIP_MS) / CA_OUT_MS)
      if (e2 < 1) {
        out.push({
          x: lerp(chair.x, justOut.x, e2),
          y: lerp(chair.y, justOut.y, e2),
          where: 'cleft',
        })
        continue
      }
      const which = seat.pump
      const path = [justOut, ...(loopDoors(g).caSkirt[which] ?? []), wait]
      const e3 = clamp01((ms - t0 - CA_TURN_MS) / CA_DRIFT_BACK_MS)
      const spans = path.slice(1).map((q2, k2) => Math.hypot(q2.x - path[k2].x, q2.y - path[k2].y))
      const total = spans.reduce((tt, l) => tt + l, 0) || 1
      let want = e3 * total
      let p = path[path.length - 1]
      for (const [k2, len] of spans.entries()) {
        if (want <= len || k2 === spans.length - 1) {
          const t2 = clamp01(want / Math.max(1e-6, len))
          p = {
            x: lerp(path[k2].x, path[k2 + 1].x, t2),
            y: lerp(path[k2].y, path[k2 + 1].y, t2),
          }
          break
        }
        want -= len
      }
      out.push({
        x: p.x + wobX(jiggleMs, i + 40) * e3,
        y: p.y + wobY(jiggleMs, i + 40) * e3,
        where: 'cleft',
      })
      continue
    }
    if (clear === null || ms < clear) {
      // ⚠ A BOUND ION IS STILL (user, 2026-09-01: "bound Ca ions stay put and
      // do not move") — the sensor is holding it. A free one keeps the soup's
      // thermal jiggle: motion is what says which is which.
      if (bound) out.push({ x: feet.x, y: feet.y, where: 'zone' })
      else
        out.push({
          x: feet.x + wobX(jiggleMs, i + 40),
          y: feet.y + wobY(jiggleMs, i + 40),
          where: 'zone',
        })
      continue
    }
    // ⚠ Buffered IN PLACE (user, 2026-09-01: "at 9 ms Ca ions rush up —
    // expected: stay in vicinity"; and the science agrees: the buffer
    // proteins are everywhere, so a grabbed ion stops where it is). It slips
    // a short way off its knob into the nearby cytoplasm and rests there.
    const dx = feet.x + (H(i, 16) - 0.5) * r * 2.5
    const deep = {
      x: dx,
      y: wallAt(g, dx) - MEM_PX - r * (1.2 + H(i, 17) * 1.4),
    }
    const q = clamp01((ms - clear) / CA_BUFFERED_TRAVEL_MS)
    if (q < 1) {
      out.push({
        x: lerp(feet.x, deep.x, q),
        y: lerp(feet.y, deep.y, q),
        where: 'zone',
      })
      continue
    }
    // Buffered means bound — a grabbed ion is held by a protein, so it rests
    // as still as one seated on a sensor, until the pumps start.
    out.push({ x: deep.x, y: deep.y, where: 'deep' })
  }
  return out
}

/** ⚠ THE POSTSYNAPTIC CHAIN, per receptor (user, 2026-09-01: "NT binds →
 *  stays ~1 s → channel opens → short pause → ions flow → short pause →
 *  flash"). All on the shared seat windows, so no link can precede its
 *  cause. The hold is a declared reading-speed schedule; the model's own
 *  population counts stay in the info panel. */
export const BIND_HOLD_MS = 1.2
/** ⚠ THE REFLECTION PAUSES (user, 2026-09-01: "create a pause between binding
 *  and ions flowing in the channel, and before the signal leaves and the
 *  channel closes — give users time to reflect"). Sized in model ms FOR THE
 *  LEG THEY PLAY IN: the chain leg runs at ~0.28 s of screen per model ms, so
 *  ~3.5 ms reads as the chosen ~1 s. */
export const NA_PAUSE_MS = 2.5
/** ⚠ THE END OF THE CHAIN, IN ORDER (user, 2026-09-01: "1 s pause, channel
 *  stays open. White glow disappears, NTs fly away. Channel closes."): the
 *  plugged transmitter's white aura fades out over this... */
export const GLOW_FADE_MS = 1.0
/** ...finishing exactly when the transmitter pair lifts off, this long before
 *  the channel closes — so glow-off, departure and closing read as three
 *  beats, in that order. */
export const NT_DEPART_LEAD_MS = 1.2
/** Open long enough for the pause, both ions' crossings (the second starts
 *  0.8 ms after the first, each 3.6 ms door-to-rest), a ~1 s reflection AFTER
 *  the last ion has settled, and then the glow-off → departure → close tail —
 *  the door visibly outlives the traffic through it, instead of closing on
 *  the second ion mid-pore as it used to. */
export const RECEPTOR_OPEN_MS = NA_PAUSE_MS + 4.4 + 3.5 + GLOW_FADE_MS + NT_DEPART_LEAD_MS
/** ⚠ THE SUBUNITS PART OVER A MOMENT, NOT A FRAME: the drawn channel and the
 *  transmitter plugged into its sliding seat both ease over this, so the pair
 *  visibly rides the mouth apart (user: "visually following their plugged
 *  position with respect to the channel moving as it opens"). */
export const OPEN_EASE_MS = 1.0

/** When this receptor's gate visibly opens and closes — null for one whose
 *  gate the model never opened at all: it caught its pair and stayed shut,
 *  which really happens and is worth seeing. */
export function receptorOpenWindow(
  g: SynapseGeometry,
  run: SynapseRun,
  cleft: CleftRun,
  rIdx: number,
): { openAt: number; closeAt: number } | null {
  const sites = castSeats(g)
  const mine = (rIdx + 0.5) / sites.length
  if (crossings(cleft.open, cleft.windowMs, mine).tUp === null) return null
  const seated = seatedAtOf(g, run, cleft, rIdx)
  if (seated === null) return null
  const openAt = seated + BIND_HOLD_MS
  return { openAt, closeAt: openAt + RECEPTOR_OPEN_MS }
}

/** How far apart the drawn subunits are at `ms`, 0→1 — eased at both edges
 *  over `OPEN_EASE_MS`. The drawing passes this to the channel, and the
 *  plugged transmitter reads the same number, so the pair rides the mouth as
 *  it moves and can never hover beside it. */
export function receptorOpenFrac(
  g: SynapseGeometry,
  run: SynapseRun,
  cleft: CleftRun,
  rIdx: number,
  ms: number,
): number {
  const ow = receptorOpenWindow(g, run, cleft, rIdx)
  if (ow === null) return 0
  const up = clamp01((ms - ow.openAt) / OPEN_EASE_MS)
  const down = clamp01((ms - ow.closeAt) / OPEN_EASE_MS)
  return up * (1 - down)
}

/** Where receptor `rIdx`'s two plugged transmitter balls sit, for a given
 *  separation — THE DRAWN SOCKET's own position (k = 0), mirrored across the
 *  channel's centre for its partner (k = 1), so both travel outward with the
 *  subunits they are plugged into. */
export function ntSeatAt(
  g: SynapseGeometry,
  rIdx: number,
  k: number,
  openFrac: number,
): { x: number; y: number } {
  const site = castSeats(g)[rIdx]
  const s = ligandSeat(site.x, site.y, openFrac, MEM_PX * 2.6)
  return k === 0 ? { x: s.x, y: s.y } : { x: 2 * site.x - s.x, y: s.y }
}

/** ⚠ THE SNAP OF BINDING (user, 2026-09-01: the ligand bench's own idiom —
 *  "a white aura appears, the ion snaps into place"). One brief white pulse
 *  at the instant of seating: calcium onto its knob, transmitter into its
 *  receptor cup — computed from the same arrival arithmetic the casts move
 *  by, so the pulse can never fire beside an empty seat. */
export const BIND_PULSE_MS = 1.0

export function bindPulses(
  g: SynapseGeometry,
  run: SynapseRun,
  cleft: CleftRun,
  ms: number,
  /** ⚠ Whether the CALCIUM's binding snaps too (user, 2026-09-13: "remove Ca
   *  binding purple circles, together with sparkle on binding"). A framing that
   *  draws no calcium and no sensor must not flash where they would have met;
   *  the transmitter's own snap, below, is not affected. */
  calcium = true,
): { x: number; y: number; a: number }[] {
  const out: { x: number; y: number; a: number }[] = []
  const docked = activeZone(g).docked
  const { te } = calciumTimes(run)
  // Only the ions that actually SEAT pulse — a free surplus ion settling
  // nearby is not a binding, so it must not borrow binding's snap.
  // ⚠ AND THE FLAG SKIPS THE LOOP, it does NOT blank `te`. A first version
  // wrote `te.fill(null)` — and `calciumTimes` is MEMOISED per run, so that
  // would have emptied the cache every other view shares and taken the round
  // trip's calcium out with it, permanently, from one frame at the spine.
  for (let i = 0; calcium && i < docked.length * 2 && i < CA_N; i++) {
    const enter = te[i]
    if (enter === null) continue
    const arrive = enter + CA_APPROACH_MS + CA_CROSS_MS + CA_SETTLE_MS
    const q = (ms - arrive) / BIND_PULSE_MS
    if (q < 0 || q >= 1) continue
    const anchor = docked[i % docked.length]
    const knob = snareMini(g, anchor).knobs[Math.floor(i / docked.length) % 2]
    out.push({ x: knob.x, y: knob.y, a: 1 - q })
  }
  const sites = castSeats(g)
  const fate = assignFates(g, run, cleft)
  for (const [id, f] of fate) {
    const v = Math.floor(id / 7)
    const d = docked[v]
    const tf = run.vesicles[d.index]?.fusedAtMs
    if (tf === null || tf === undefined) continue
    const mine = (f.r + 0.5) / sites.length
    const { tUp } = crossings(cleft.bound, cleft.windowMs, mine)
    if (tUp === null) continue
    const start = tf + H(id, 2) * EMERGE_STAGGER_MS
    const mouthX = d.x + (H(id, 3) - 0.5) * 10
    const mouth = inGap(g, mouthX, 0.16)
    const standPt = inGap(g, standXOf(g, d, id), 0.15 + H(id, 4) * 0.7)
    const travel =
      (d.r * 1.3) / NT_SPEED +
      Math.max(4, Math.hypot(standPt.x - mouth.x, standPt.y - mouth.y)) / NT_SPEED
    const done = Math.max(tUp, start + travel) + CAPTURE_MS
    if (ms < done) continue
    // ⚠ THE AURA STAYS WHILE THE PAIR IS PLUGGED (user, 2026-09-01: "white
    // aura stays… white glow disappears, NTs fly away, channel closes"): full
    // strength from this ball's own capture, fading out to end exactly at the
    // pair's release. The position rides the sliding seat, like the ball.
    const rel = receptorSeatWindow(g, run, cleft, f.r).releasedAt
    let a = 1
    if (rel !== null) {
      if (ms >= rel) continue
      a = ms < rel - GLOW_FADE_MS ? 1 : (rel - ms) / GLOW_FADE_MS
    }
    const seat = ntSeatAt(g, f.r, f.k, receptorOpenFrac(g, run, cleft, f.r, ms))
    out.push({ x: seat.x, y: seat.y, a })
  }
  // ⚠ NO AURA ON THE SODIUM (user, 2026-09-02: "Na ions should not get white
  // aura after they penetrated the postsynaptic cell"). The snap is the
  // ligand bench's BINDING idiom, and an ion that has crossed is not bound to
  // anything — it is simply inside. Only the plugged transmitter glows.
  return out
}

// ──────────────────────────────────────────────────────────────── the sodium

export const NA_PER_RECEPTOR = 2
export const NA_APPROACH_MS = 0.9
export const NA_CROSS_MS = 1.5
export const NA_SETTLE_MS = 1.2

export interface NaDot {
  x: number
  y: number
  where: 'cleft' | 'spine'
}

/** ⚠ TWO SODIUM IONS WAIT ABOVE EACH RECEPTOR from the first frame; when its
 *  gate opens (the model's own `open` series crossing that receptor's rung)
 *  they cross through, one after the other, and settle in the spine, where
 *  they stay. A receptor that never opens keeps its pair waiting for ever —
 *  which is the honest picture of a shut door. */
export function sodiumCast(
  g: SynapseGeometry,
  run: SynapseRun,
  cleft: CleftRun,
  ms: number,
  jiggleMs = ms,
): NaDot[] {
  const sites = castSeats(g)
  const out: NaDot[] = []
  for (const [r, site] of sites.entries()) {
    // ⚠ AFTER the drawn open, never the model's early crossing (user,
    // 2026-09-01: "Na ions penetrate before neurotransmitters bound").
    const ow = receptorOpenWindow(g, run, cleft, r)
    const tUp = ow === null ? null : ow.openAt + NA_PAUSE_MS
    for (let k = 0; k < NA_PER_RECEPTOR; k++) {
      const id = r * NA_PER_RECEPTOR + k + 100
      // ⚠ IN the gap's own interior, near its receptor.
      const waitX = site.x + (k === 0 ? -1 : 1) * (9 + H(id, 31) * 6)
      const waitF = 0.3 + H(id, 32) * 0.35
      const wait = inGap(g, waitX, waitF)
      const t0 = tUp === null ? null : tUp + k * 0.8
      if (t0 === null || ms < t0) {
        out.push({
          x: wait.x + wobX(jiggleMs, id),
          y: wait.y + wobY(jiggleMs, id),
          where: 'cleft',
        })
        continue
      }
      // ⚠ STRICTLY THROUGH THE PORE (user, 2026-09-01): both balls cross at
      // the channel's own centre, one after the other — the stagger is in
      // TIME, never in x.
      const mouthX = site.x
      const mouthF = gapFrac(g, mouthX, site.y - MEM_PX * 3.2)
      const inside = { x: mouthX, y: site.y + 26 }
      const rest = {
        x: site.x + (H(id, 33) - 0.5) * 30,
        y: faceAt(g, site.x) + MEM_PX * 2.6 + 10 + H(id, 34) * g.head.ry * 0.55,
      }
      if (ms < t0 + NA_APPROACH_MS) {
        const q = (ms - t0) / NA_APPROACH_MS
        out.push({
          ...alongGap(g, waitX, waitF, mouthX, mouthF, q),
          where: 'cleft',
        })
        continue
      }
      const mouth = inGap(g, mouthX, mouthF)
      if (ms < t0 + NA_APPROACH_MS + NA_CROSS_MS) {
        const q = (ms - t0 - NA_APPROACH_MS) / NA_CROSS_MS
        out.push({ x: mouth.x, y: lerp(mouth.y, inside.y, q), where: 'cleft' })
        continue
      }
      if (ms < t0 + NA_APPROACH_MS + NA_CROSS_MS + NA_SETTLE_MS) {
        const q = (ms - t0 - NA_APPROACH_MS - NA_CROSS_MS) / NA_SETTLE_MS
        out.push({
          x: lerp(inside.x, rest.x, q),
          y: lerp(inside.y, rest.y, q),
          where: 'spine',
        })
        continue
      }
      // ⚠ STILL once settled (user, 2026-09-01: "bound ions stay put — they do
      // not budge or juggle"). Declared exaggeration: sodium in the cytosol is
      // really still free and jostling — the stillness marks "this one has
      // arrived and is done", the same reading the white aura carries.
      out.push({ x: rest.x, y: rest.y, where: 'spine' })
    }
  }
  return out
}
