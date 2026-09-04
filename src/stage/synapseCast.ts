import type { SynapseRun } from '../core/synapse'
import type { CleftRun } from '../core/cleft'
import { ligandSeat } from './ligandChannel'
import {
  MEM_PX,
  activeZone,
  astroRest,
  astrocyteFinger,
  cargoIn,
  faceAt,
  fusedShape,
  receptorSites,
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
    const collect =
      ESCAPE_START_MS + ESCAPE_SPREAD_MS + ESCAPE_EXIT_MS + ESCAPE_TRAVEL_MS * 1.6
    latest = Math.max(latest, tf + EMERGE_STAGGER_MS + maxTravel + collect)
    void v
  }
  return latest
}

export interface NtDot {
  x: number
  y: number
  where: 'vesicle' | 'gap' | 'seat' | 'bath' | 'glia' | 'spine'
}

/** How many of the escapees the NEURON itself reclaims — the declared minor
 *  route (a dendritic transporter): everything else goes to the astrocyte. */
export const NEURON_UPTAKE_FRAC = 0.15

/** ⚠ Out of the nearest end of the gap and COLLECTED (21b-1, user,
 *  2026-09-04): clearance as arrival somewhere, never as a fade. Most
 *  escapees travel to the astrocyte finger on their own side — in through a
 *  transporter tick, resting visibly INSIDE the glial cell — and a seeded few
 *  are reclaimed by the spine's own transporter, the minor route. */
function escapePos(
  g: SynapseGeometry,
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
  if (H(id, 23) < NEURON_UPTAKE_FRAC) {
    // The neuronal route: a transporter on the spine's shoulder, just past
    // the zone's edge on this ball's own side.
    const tickX = g.foot.x + side * g.activeHalf * 1.35
    const tick = { x: tickX, y: faceAt(g, tickX) }
    const inside = { x: tickX - side * 8, y: tick.y + 16 + H(id, 24) * 12 }
    const q1 = clamp01((ms - t1) / (ESCAPE_TRAVEL_MS * 0.7))
    if (q1 < 1)
      return { x: lerp(exit.x, tick.x, q1), y: lerp(exit.y, tick.y, q1), where: 'bath' }
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
  const fin = astrocyteFinger(g, side)
  const tick = fin.ticks[H(id, 25) < 0.5 ? 0 : 1]
  const rest = astroRest(fin, H(id, 21), H(id, 22))
  const q1 = clamp01((ms - t1) / ESCAPE_TRAVEL_MS)
  if (q1 < 1)
    return { x: lerp(exit.x, tick.x, q1), y: lerp(exit.y, tick.y, q1), where: 'bath' }
  const q2 = clamp01((ms - t1 - ESCAPE_TRAVEL_MS) / (ESCAPE_TRAVEL_MS * 0.6))
  if (q2 < 1)
    return { x: lerp(tick.x, rest.x, q2), y: lerp(tick.y, rest.y, q2), where: 'glia' }
  return {
    x: rest.x + wobX(jiggleMs, id) * 0.6,
    y: rest.y + wobY(jiggleMs, id) * 0.6,
    where: 'glia',
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
  const sites = receptorSites(g)
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
  const sites = receptorSites(g)
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
  // ⚠ THE PAIR STAYS PLUGGED FOR THE WHOLE TRANSACTION (user, 2026-09-01:
  // "signal neurotransmitters leave the channel while ions still go through —
  // expected: stay put… glow disappears, NTs fly away, channel closes"). On a
  // receptor whose gate opens, release is scheduled OFF THE DOOR — this lead
  // before its close, after the ions and the reflection pause. Only a
  // receptor that never opens falls back to the model's own unbinding.
  const ow = receptorOpenWindow(g, run, cleft, rIdx)
  if (ow !== null) return { seatedAt: seated, releasedAt: ow.closeAt - NT_DEPART_LEAD_MS }
  const mine = (rIdx + 0.5) / receptorSites(g).length
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
  const sites = receptorSites(g)
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
        out.push({ ...alongGap(g, mouthX, 0.16, standX, standF, q), where: 'gap' })
        continue
      }
      const stand = inGap(g, standX, standF)
      const wander = { x: stand.x + wobX(jiggleMs, id), y: stand.y + wobY(jiggleMs, id) }

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
          out.push({ ...alongGap(g, standX, standF, seat0.x, seatF, q), where: 'gap' })
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
      out.push(escapePos(g, id, standX, standF, tEsc, ms, jiggleMs))
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────── the calcium

export const CA_N = 14
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
const CA_TIMES = new WeakMap<
  SynapseRun,
  { te: (number | null)[]; tc: (number | null)[] }
>()

function calciumTimes(run: SynapseRun): { te: (number | null)[]; tc: (number | null)[] } {
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
      Math.min(
        g.foot.x + g.activeHalf * 0.95,
        anchor0.x + (H(i, 11) - 0.5) * g.activeHalf * 0.5,
      ),
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
    const door = doors.reduce((a, b) =>
      Math.abs(a.x - waitX) < Math.abs(b.x - waitX) ? a : b,
    )
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
      out.push({ ...alongGap(g, waitX, waitF, door.x, belowF, q), where: 'cleft' })
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
    const deep = { x: dx, y: wallAt(g, dx) - MEM_PX - r * (1.2 + H(i, 17) * 1.4) }
    const q = clamp01((ms - clear) / CA_BUFFERED_TRAVEL_MS)
    if (q < 1) {
      out.push({ x: lerp(feet.x, deep.x, q), y: lerp(feet.y, deep.y, q), where: 'zone' })
      continue
    }
    // Buffered means bound — a grabbed ion is held by a protein, so it rests
    // as still as one seated on a sensor.
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
  const sites = receptorSites(g)
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
  const site = receptorSites(g)[rIdx]
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
): { x: number; y: number; a: number }[] {
  const out: { x: number; y: number; a: number }[] = []
  const docked = activeZone(g).docked
  const { te } = calciumTimes(run)
  // Only the ions that actually SEAT pulse — a free surplus ion settling
  // nearby is not a binding, so it must not borrow binding's snap.
  for (let i = 0; i < docked.length * 2 && i < CA_N; i++) {
    const enter = te[i]
    if (enter === null) continue
    const arrive = enter + CA_APPROACH_MS + CA_CROSS_MS + CA_SETTLE_MS
    const q = (ms - arrive) / BIND_PULSE_MS
    if (q < 0 || q >= 1) continue
    const anchor = docked[i % docked.length]
    const knob = snareMini(g, anchor).knobs[Math.floor(i / docked.length) % 2]
    out.push({ x: knob.x, y: knob.y, a: 1 - q })
  }
  const sites = receptorSites(g)
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
  const sites = receptorSites(g)
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
        out.push({ ...alongGap(g, waitX, waitF, mouthX, mouthF, q), where: 'cleft' })
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
