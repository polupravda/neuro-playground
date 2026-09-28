import { describe, expect, it } from 'vitest'
import { restingCounts } from '../core/ions'
import { cleftRun } from '../core/cleft'
import { synapseRun } from '../core/synapse'
import {
  SYN_H,
  SYN_W,
  spineArrivalSeat,
  spineReceptorSeats,
  spineRowSeats,
  synapseGeometry,
  wallQueueX,
  MEM_PX,
  faceAt,
  drawSynapse,
  membraneLipids,
  activeZone,
  cargoIn,
} from './synapseScene'
import { strictCanvas } from './strictCanvas'
import { ligandHalfWidth } from './ligandChannel'

/** What one bubble carries — `cargoIn`'s own default, never a second number. */
const CARGO_N = 7
const TRANSMITTER_R = 3.2
import { receptorOpenFrac, receptorSeatWindow } from './synapseCast'
import { SPINE_TO_MS, spineDensityX } from './spineScene'
import { stoneDepth } from '../core/receptors'

const SRC = import.meta.glob('./synapseScene.ts', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
import {
  AMPA_AT_REST,
  AMPA_DELIVERED,
  DELIVER_MS,
  SIGNAL_MS,
  NMDA_PAIR,
  camkPulse,
  nmdaGate,
  nmdaKind,
  spineStone,
  deliveryAt,
  dispatchAt,
  spineAmpaShown,
  spineFire,
  spineStart,
  spineStep,
  naAlpha,
  naCrossing,
  naSettling,
  NA_FADE_IN_MS,
  NA_DWELL_MS,
  NA_FADE_OUT_MS,
  NA_INSIDE_MS,
  AMPA_SETTLE_MS,
  AMPA_CROSS_MS,
  type SpineState,
} from '../core/spine'
import {
  STORY_STEP_MS,
  buildSpineStory,
  storyModelMs,
  storyRelease,
  storyRestock,
} from './spineStory'

const run = synapseRun(restingCounts() as never, true)
const cleft = cleftRun(run)
const base = synapseGeometry(SYN_W, SYN_H)
const density = spineDensityX()

describe('21c-72 — a receptor JOINS the density, it does not appear in it', () => {
  // A4: "Newly transported AMPAs are overlapped with membrane and do not get
  // active at ion binding" (2026-09-13).

  it('A4: an arriving receptor’s destination is a SEAT, not a place near one', () => {
    // ⚠ THE FAULT, MEASURED. The slide's target was a formula of its own —
    // `density + side × activeHalf × (0.13 + slot × 0.12)` — and it put the
    // receptor at x = 320.4 and 295.6 against seats at 307.9, 331.7, 362.4 and
    // 391.8. Eleven and twelve pixels out: standing on bare membrane between two
    // receptors, which is the "overlapped with membrane" of the report.
    //
    // ⚠ AND IT IS WHY IT LOOKED DEAD, TOO. A transmitter ball is drawn at the
    // SEAT. A receptor eleven pixels away from its seat is a receptor with
    // somebody else's ligand floating beside it — "does not get active at ion
    // binding" is the same bug seen from the other end.
    for (const shown of [1, 1.5, 2, 2.5]) {
      const seat = spineArrivalSeat(base, shown, density)
      const row = spineReceptorSeats(base, Math.floor(shown + 1e-9) + 1, density)
      const nearest = row.reduce((a, b) => (Math.abs(b.x - seat.x) < Math.abs(a.x - seat.x) ? b : a))
      expect(Math.abs(nearest.x - seat.x), `the arrival at ${shown} lands off its seat`)
        .toBeLessThan(0.001)
    }
    // …and it is the NEAR end of the row, which is the end it comes from: a
    // receptor joining the middle would have walked through the ones standing
    // there.
    const queue = wallQueueX(base, 0, density)
    const seat = spineArrivalSeat(base, AMPA_AT_REST, density)
    const row = spineReceptorSeats(base, AMPA_AT_REST + 1, density)
    for (const p of row.slice(1)) {
      expect(Math.abs(seat.x - queue), 'the arrival joins further from the queue than its neighbours')
        .toBeLessThan(Math.abs(p.x - queue))
    }
  })

  it('A4: the row WIDENS — it never jumps', () => {
    // ⚠ MEASURED AT 26 px, twice. The row's width is a function of how many
    // receptors are in it, so an integer count made the whole density teleport
    // the instant `ampa` ticked over: the original catcher moved 26 px and the
    // NMDA 31, in one frame. Both drawings were correct, which is exactly why
    // nothing caught it.
    let worst = 0
    let prev = spineRowSeats(base, 1, density)
    for (let n = 1; n <= 3.0001; n += 0.01) {
      const row = spineRowSeats(base, n, density)
      if (row.length === prev.length) {
        for (let i = 0; i < row.length; i++) worst = Math.max(worst, Math.abs(row[i].x - prev[i].x))
      } else {
        // ⚠ AND THE STEP WHERE THE ROW GAINS A SEAT IS CONTINUOUS TOO — the
        // receptors already standing keep their places, shifted by one index,
        // and the new seat is exactly where the arrival had got to.
        expect(row.length, 'the row gained more than one seat at once').toBe(prev.length + 1)
        for (let i = 0; i < prev.length; i++) {
          expect(Math.abs(row[i + 1].x - prev[i].x), 'a standing receptor jumped as the row grew')
            .toBeLessThan(2.5)
        }
      }
      prev = row
    }
    expect(worst, `the row moves ${worst.toFixed(1)}px in one step`).toBeLessThan(2.5)
  })

  it('A4: the count the row is solved from is CONTINUOUS across the arrival', () => {
    // `ampa` steps; `spineAmpaShown` does not, because the delivery that is
    // about to be removed is worth exactly the 1 that `ampa` gains.
    const s = spineStart()
    s.ampa = AMPA_AT_REST
    s.deliveries = [{ id: 0, t: DELIVER_MS - 1 }]
    const before = spineAmpaShown(s)
    const after = spineAmpaShown({ ...s, ampa: AMPA_AT_REST + 1, deliveries: [] })
    expect(after - before, 'the count jumps as a receptor lands').toBeLessThan(0.02)
    // …and it really does track the SLIDE, not the fusion: a carrier that has
    // arrived at the wall but not yet slid in has not widened the row.
    const fusing = spineAmpaShown({ ...s, deliveries: [{ id: 0, t: DELIVER_MS * 0.5 }] })
    expect(fusing, 'the row widened before the receptor started sliding').toBe(AMPA_AT_REST)
    expect(deliveryAt({ id: 0, t: DELIVER_MS * 0.5 }).slid).toBe(0)
  })

  it('A4: …and once it has landed it BINDS and OPENS like the others', () => {
    // ⚠ ASK THE DECISION, NOT THE INK. These are the two calls the drawing
    // makes per receptor, so a new one that never seats or never opens is a new
    // one the child sees do nothing.
    const seats = spineReceptorSeats(base, AMPA_AT_REST + AMPA_DELIVERED, density)
    const g = { ...base, seats, slowSeat: seats.length - 1 }
    expect(seats.length).toBe(AMPA_AT_REST + AMPA_DELIVERED + 1)
    for (let i = 0; i < seats.length - 1; i++) {
      const w = receptorSeatWindow(g as never, run, cleft, i)
      expect(w.seatedAt, `catcher ${i} never gets a transmitter`).not.toBeNull()
      let peak = 0
      for (let ms = 0; ms <= run.windowMs; ms += 0.2) {
        peak = Math.max(peak, receptorOpenFrac(g as never, run, cleft, i, ms))
      }
      expect(peak, `catcher ${i} never opens`).toBeGreaterThan(0.9)
    }
    // …and the NMDA is still the slow seat, which is what makes it the slow one.
    expect(g.slowSeat).toBe(seats.length - 1)
    expect(receptorSeatWindow(g as never, run, cleft, g.slowSeat).releasedAt,
      'the NMDA let its glutamate go').toBeNull()
  })
})

describe('21c-72 — nothing in this picture teleports', () => {
  const story = buildSpineStory(run, cleft)

  /** The story, walked exactly as the stage walks it. */
  const play = () => {
    const s = spineStart()
    let next = 0
    let model = 0
    const frames: { t: number; s: SpineState; seats: { x: number; y: number }[] }[] = []
    for (let t = 0; t <= story.ms; t += STORY_STEP_MS) {
      while (next < story.messages.length && t >= story.messages[next].fireAt) {
        spineFire(s, 0)
        next++
      }
      const was = model
      model = storyModelMs(story, t)
      spineStep(s, Math.max(0, model - was))
      frames.push({
        t,
        s: { ...s, naIons: s.naIons.map((i) => ({ ...i })), deliveries: s.deliveries.map((d) => ({ ...d })) },
        seats: spineRowSeats(base, spineAmpaShown(s), density),
      })
    }
    return frames
  }

  it('A2/A1: every sodium ion has a NAME, and moves a pixel at a time', () => {
    // ⚠ THE FAULT, MEASURED. `sodiumCast` is a pure function of the run's own
    // millisecond. The story plays thirteen messages through one drawing, so at
    // every boundary it was asked for a position at 2.6 ms having just been
    // asked for one at 17.9: the ions leapt **69 px**, from settled deep inside
    // the cell back out into the gap.
    //
    // ⚠ AND ITS POSITION IS READ THE WAY THE DRAWING READS IT (21c-76): the two
    // stage fractions, not a raw `t`. An ion's `t` restarts at each stage, so a
    // guard that treated it as one 0…2 ramp measured a jump the picture never
    // makes — and would have missed one the picture did.
    const frames = play()
    // ⚠ MIRRORING THE DRAWING, including its LEAD — a crossing ion is carried
    // from where it stood into the mouth over the first third, so it does not
    // snap to the pore's centre before setting off. A guard that started it AT
    // the mouth reported a 17.5px jump the picture never makes.
    const depth = (ion: { stage: string; t: number; seat: number }, seatY: number) => {
      const wait = seatY - MEM_PX * 5
      const mouth = seatY - MEM_PX * 1.5
      const inside = seatY + MEM_PX * 3.2
      if (ion.stage === 'arriving' || ion.stage === 'waiting') return wait
      if (ion.stage === 'crossing') {
        const q = naCrossing(ion as never)
        const e = q * q * (3 - 2 * q)
        const my = wait + (mouth - wait) * Math.min(1, q / 0.35)
        return my + (inside - my) * e
      }
      return inside + MEM_PX * 8 * naSettling(ion as never)
    }
    const lastY = new Map<number, number>()
    let worst = 0
    let ids = 0
    for (const f of frames) {
      for (const ion of f.s.naIons) {
        const seat = f.seats[Math.min(ion.seat, Math.max(0, f.seats.length - 2))]
        if (!seat) continue
        const y = depth(ion, seat.y)
        const was = lastY.get(ion.id)
        if (was === undefined) ids++
        else worst = Math.max(worst, Math.abs(y - was))
        lastY.set(ion.id, y)
      }
    }
    expect(ids, 'no sodium ever appeared at all').toBeGreaterThan(20)
    expect(worst, `a named ion moved ${worst.toFixed(1)}px in one frame`).toBeLessThan(6)
  })

  it('A1/A2: an ion lives ONE life — arriving, waiting, crossing, inside', () => {
    // ⚠ THE SECOND HALF OF THE FAULT (user, 2026-09-21: "let's improve the Na
    // ions behavior… Let them go through the channel when the channel opens").
    // There used to be TWO populations and only one was alive: the ions waiting
    // in the gap were the cast asked at a frozen millisecond, so they jiggled
    // and never moved, and a DIFFERENT ion came through when the channel
    // opened. The one the child is looking at is the one that goes now.
    const frames = play()
    const order = new Map<number, string[]>()
    for (const f of frames) {
      for (const ion of f.s.naIons) {
        const seen = order.get(ion.id) ?? []
        if (seen[seen.length - 1] !== ion.stage) seen.push(ion.stage)
        order.set(ion.id, seen)
      }
    }
    const allowed = ['arriving', 'waiting', 'crossing', 'inside']
    let crossed = 0
    for (const [id, seen] of order) {
      // every life is a PREFIX of the one order, never a jump backwards
      let at = -1
      for (const st of seen) {
        const i = allowed.indexOf(st)
        expect(i, `ion ${id} reached an impossible stage ${st}`).toBeGreaterThan(at)
        at = i
      }
      if (seen.includes('crossing')) {
        crossed++
        // ⚠ AND IT WAS IN THE GAP FIRST. An ion that crosses without ever
        // having stood there is one conjured at the mouth — the old bug
        // exactly. ⚠ Asked as "it began by arriving", not "a frame caught it
        // waiting": the two stages turn over inside one step, so an ion whose
        // quantum was due the instant it finished fading in is never SAMPLED
        // waiting — and it was still drawn in the gap for the whole fade.
        expect(seen[0], `ion ${id} appeared already crossing`).toBe('arriving')
      }
    }
    expect(crossed, 'nothing ever went through the channel').toBeGreaterThan(20)
  })

  it('A3: a fresh row fades IN, and only once the gap is empty', () => {
    // ⚠ (user: "New ions should fade-in when no ions are left in the cleft".)
    const frames = play()
    let births = 0
    for (let i = 1; i < frames.length; i++) {
      const before = frames[i - 1].s.naIons
      const now = frames[i].s.naIons
      const fresh = now.filter((n) => !before.some((b) => b.id === n.id))
      if (fresh.length === 0) continue
      births++
      // they arrive TOGETHER, as a row…
      expect(fresh.every((n) => n.stage === 'arriving'), 'an ion was born already waiting')
        .toBe(true)
      expect(fresh.length, 'the gap refills one ion at a time, like a conveyor')
        .toBeGreaterThan(1)
      // …and only into a gap with nothing left in it. ⚠ MEASURED IN THE FRAME
      // THE ROW ARRIVES, not the one before: the last ion can set off in the
      // very step that refills, so the frame before still shows it waiting.
      const left = now.filter(
        (n) => !fresh.some((f2) => f2.id === n.id) && (n.stage === 'arriving' || n.stage === 'waiting'),
      )
      expect(left.length, `a row faded in over ${left.length} ions still in the gap`).toBe(0)
    }
    expect(births, 'the gap never refilled at all').toBeGreaterThan(2)
    // …and fading in is a FADE: a new ion is not drawn solid on its first frame.
    expect(naAlpha({ id: 0, seat: 0, stage: 'arriving', t: 0 }), 'a new ion pops in').toBe(0)
    expect(naAlpha({ id: 0, seat: 0, stage: 'arriving', t: NA_FADE_IN_MS }), 'it never finishes arriving')
      .toBe(1)
    expect(NA_FADE_IN_MS, 'the fade is too quick to read as one').toBeGreaterThan(100)
  })

  it('A4: once inside it STAYS a while, then fades slowly', () => {
    // ⚠ (user: "After they penetrated the postsynaptic cell, they should slowly
    // fade out after a while".) Two claims: a dwell, and then a slow fade —
    // not a blink at the end of the crossing.
    const solid = (t: number) => naAlpha({ id: 0, seat: 0, stage: 'inside', t })
    expect(solid(0), 'an ion that has just got in is already fading').toBe(1)
    expect(solid(AMPA_SETTLE_MS + NA_DWELL_MS), 'it starts fading before its dwell is up').toBe(1)
    expect(solid(NA_INSIDE_MS), 'it is still visible at the end of its life').toBe(0)
    expect(solid(AMPA_SETTLE_MS + NA_DWELL_MS + NA_FADE_OUT_MS / 2), 'the fade is not gradual')
      .toBeCloseTo(0.5, 2)
    // ⚠ AND THE FADE IS THE SLOW PART, or "slowly" is not what it does.
    expect(NA_FADE_OUT_MS, 'the fade out is quicker than the fade in')
      .toBeGreaterThan(NA_FADE_IN_MS * 2)
    expect(NA_DWELL_MS, 'there is no dwell before it goes').toBeGreaterThan(AMPA_CROSS_MS * 4)
    // …and it really does happen in the run: ions vanish, and the last thing
    // they do is get fainter.
    const frames = play()
    const faded = frames.some((f) => f.s.naIons.some((i) => {
      const a = naAlpha(i)
      return i.stage === 'inside' && a > 0.05 && a < 0.95
    }))
    expect(faded, 'no ion was ever caught part-way through fading out').toBe(true)
  })

  it('A2: …and the count is QUANTISED from the flow, so more receptors send more', () => {
    // ⚠ Draw a flow by quantising it, never by animating beside it. The payoff
    // is that the potentiated synapse passes visibly MORE sodium with no second
    // number to keep in step — a count for a count.
    const sent = (ampa: number) => {
      const s = spineStart()
      s.ampa = ampa
      spineFire(s)
      for (let t = 0; t < 9000; t += 16) {
        s.ampa = ampa
        spineStep(s, 16)
      }
      return s.naSent
    }
    const one = sent(AMPA_AT_REST)
    const three = sent(AMPA_AT_REST + AMPA_DELIVERED)
    expect(one, 'one message through one catcher sends no sodium').toBeGreaterThan(1)
    expect(three / one, `three catchers send ${three} against ${one}`).toBeGreaterThan(2.2)
    // …and a receptor that never opens never sends one.
    const quiet = spineStart()
    for (let t = 0; t < 4000; t += 16) spineStep(quiet, 16)
    expect(quiet.naSent, 'sodium goes through a shut channel').toBe(0)
  })

  it('A1: the terminal is RESTOCKED between messages — it never un-fuses', () => {
    // ⚠ (user: "New Vesicles should not teleport, but arrive from top".) A
    // message ends with its vesicles fused into the wall; the next needs them
    // docked. The picture used to supply that by falling back to rest —
    // MEASURED, two of three un-fused in ONE frame, thirteen times over.
    for (const m of story.messages.slice(1)) {
      expect(m.restock, 'a message is not restocked before it').toBeGreaterThan(120)
      const q0 = storyRestock(story, m.at - m.restock + 1)
      const q1 = storyRestock(story, m.at - 1)
      expect(q0, 'the restock does not start before its message').not.toBeNull()
      expect(q1, 'the restock does not run up to its message').not.toBeNull()
      expect(q1!, 'the restock runs backwards').toBeGreaterThan(q0!)
      // ⚠ AND IT MUST NOT OVERLAP THE MESSAGE BEFORE IT. It did: act two's
      // restock ran during act one's release, so the terminal was restocked
      // while it was still releasing.
      for (const other of story.messages) {
        if (other === m) continue
        const overlaps = other.at < m.at && other.at + other.ms > m.at - m.restock
        expect(overlaps, 'a restock runs during the release before it').toBe(false)
      }
    }
  })

  it('A1: …and the picture is walked HOME across that gap, not snapped', () => {
    // The window's end is where the gap is cleared; its start is where the
    // bubbles are docked. Walking from one to the other during the restock
    // means the wrap changes nothing that is on screen except the bubbles the
    // restock has just brought down.
    for (const m of story.messages.slice(1)) {
      const before = storyRelease(story, m.at - m.restock - 1)
      const atEnd = storyRelease(story, m.at - 1)
      expect(before, 'nothing is held before the restock').not.toBeNull()
      expect(atEnd, 'the restock leaves the picture nowhere').not.toBeNull()
      expect(atEnd!, 'the restock does not carry the picture forward').toBeGreaterThan(before!)
      expect(atEnd!, 'the restock overshoots the window').toBeLessThanOrEqual(
        SPINE_TO_MS / 60 + 1e-9,
      )
    }
  })

  it('A3: CaMKII SENDS for the carriers — the switch and the errand are linked', () => {
    // ⚠ (user: "I expected the 2 pink glyphs to do some work… They get color,
    // but it's not visually clear what is their role".) The carriers used to
    // set off on the frame CaMKII latched: two things happening at once, and
    // neither causing the other on screen.
    const frames = play()
    const latch = frames.find((f) => f.s.camk >= 1)
    expect(latch, 'the cascade never fires in the story').toBeDefined()
    // a word is on its way before anything moves
    const signalling = frames.filter((f) => f.s.deliveries.some((d) => dispatchAt(d) !== null))
    expect(signalling.length, 'no signal is ever drawn').toBeGreaterThan(4)
    for (const f of signalling) {
      for (const d of f.s.deliveries) {
        if (dispatchAt(d) === null) continue
        expect(deliveryAt(d).u, 'the carrier set off before it was told').toBe(0)
      }
    }
    // …and the signal runs forward, exactly once per carrier, then hands over.
    const first = signalling[0].t
    const moved = frames.find((f) => f.s.deliveries.some((d) => deliveryAt(d).u > 0))
    expect(moved, 'no carrier ever sets off').toBeDefined()
    expect(moved!.t, 'the carrier moved before the word arrived').toBeGreaterThan(first)
    expect(SIGNAL_MS, 'the word arrives in no time at all').toBeGreaterThan(200)
  })
})

describe('21c-74 — the pink receptor says what it is doing', () => {
  const story74 = buildSpineStory(run, cleft)
  const walk = () => {
    const s = spineStart()
    let next = 0
    let model = 0
    const out: SpineState[] = []
    for (let t = 0; t <= story74.ms; t += STORY_STEP_MS) {
      while (next < story74.messages.length && t >= story74.messages[next].fireAt) {
        spineFire(s, 0)
        next++
      }
      const was = model
      model = storyModelMs(story74, t)
      spineStep(s, Math.max(0, model - was))
      out.push({ ...s, ions: s.ions.map((i) => ({ ...i })), deliveries: s.deliveries.map((d) => ({ ...d })) })
    }
    return out
  }

  it('A1: the stone LIFTS AND DEEPENS with the voltage, and never flickers', () => {
    // ⚠ THIS REVERSES 21c-35 at the user's word ("do not demo probability").
    // The block is spent on DEPTH now, so the same voltage must always give the
    // same stone — no flicker anywhere for the eye to read as chance.
    for (const plug of [0.99, 0.8, 0.5, 0.2]) {
      const at = (now: number) => stoneDepth({ ...spineStart(), plug, now }.plug)
      expect(at(0), 'the stone moves without the voltage moving').toBe(at(97531))
      expect(stoneDepth(plug), 'the depth is not the block').toBeCloseTo(plug, 9)
    }
    // …and it is monotone: more block, deeper stone, always.
    let last = -1
    for (let p = 0; p <= 1.0001; p += 0.05) {
      expect(stoneDepth(p), 'the stone got shallower as the block grew').toBeGreaterThan(last)
      last = stoneDepth(p)
    }
  })

  it('A1: …and NOTHING crosses until it has moved out of the way', () => {
    // ⚠ The lift is the CAUSE of the crossing, not something happening beside
    // it — so it must complete first, and no ion may be drawn inside a throat
    // the stone is still in.
    const frames = walk()
    let crossing = 0
    let inSeated = 0
    for (const s of frames) {
      if (!s.ions.some((i) => i.t < 1)) continue
      crossing++
      if (spineStone(s) > 0.25) inSeated++
    }
    expect(crossing, 'nothing ever crossed in the whole story').toBeGreaterThan(20)
    expect(inSeated, `${inSeated} frames with an ion inside a seated throat`).toBe(0)
  })

  it('A1: the pore passes BOTH, as a pair — one after the other', () => {
    // ⚠ (user: "alter both, one goes after the other".) NMDA is permeable to
    // sodium and calcium, and it alternated one at a time: measured, the order
    // was already a perfect `na ca na ca` and nobody could see it, because one
    // ball at a time seconds apart is a stream of singles that happen to differ.
    const frames = walk()
    const seen: { kind: string; t: number }[] = []
    let last = 0
    frames.forEach((s, i) => {
      while (last < s.sent) {
        seen.push({ kind: nmdaKind(last), t: i * STORY_STEP_MS })
        last++
      }
    })
    expect(seen.length, 'nothing went through NMDA in the whole story').toBeGreaterThan(5)
    // strictly alternating, and the pairs are tight against the gaps between them
    seen.forEach((x, i) => expect(x.kind).toBe(i % 2 === 0 ? 'na' : 'ca'))
    const within: number[] = []
    const between: number[] = []
    for (let i = 1; i < seen.length; i++) {
      ;(i % 2 === 1 ? within : between).push(seen[i].t - seen[i - 1].t)
    }
    expect(within.length, 'no pair ever completed').toBeGreaterThan(1)
    const worstWithin = Math.max(...within)
    const bestBetween = Math.min(...between)
    expect(
      worstWithin,
      `a pair took ${worstWithin}ms while the gap between pairs was ${bestBetween}ms`,
    ).toBeLessThan(bestBetween)
    expect(NMDA_PAIR, 'a quantum no longer buys a pair').toBe(2)
  })

  it('A1: both conditions get a light, and the throat lights only for BOTH', () => {
    // ⚠ A coincidence needs a mark of its own. "Holding the chemical" and
    // "conducting" looked identical, so the one state this receptor exists to
    // detect had no ink at all.
    const rest = spineStart()
    expect(nmdaGate(rest, false).open, 'a receptor with neither condition is conducting').toBe(0)
    expect(nmdaGate(rest, true).open, 'holding the chemical alone opens it').toBeLessThan(0.06)
    const warm = { ...spineStart(), plug: 0.1 }
    expect(nmdaGate(warm, false).open, 'a warm cell alone opens it').toBe(0)
    expect(nmdaGate(warm, true).open, 'both together do NOT open it').toBeGreaterThan(0.8)
    // …and the two halves are reported separately, so each pip has its own answer.
    expect(nmdaGate(warm, false).warm, 'the warm half does not read the stone')
      .toBeGreaterThan(0.8)
    expect(nmdaGate(rest, true).ligand, 'the ligand half does not read the seat').toBe(true)
    // ⚠ AND THE DRAWING CONSUMES IT — one function, three marks.
    expect(SRC['./synapseScene.ts'], 'the pips do not ask the one decision')
      .toContain('nmdaGate(sp, nmdaSeated)')
  })

  it('A3: CaMKII beats for each errand, and answers when one lands', () => {
    // ⚠ (user: "relations between CaMKII and new AMPA should be clear to a
    // kid".) A count for a count: two carriers, two departures, two answers.
    const frames = walk()
    const beats: number[] = []
    let was = 0
    frames.forEach((s, i) => {
      const b = camkPulse(s)
      if (b > 0.5 && was <= 0.5) beats.push(i * STORY_STEP_MS)
      was = b
    })
    expect(beats.length, `CaMKII beat ${beats.length} times for two carriers`)
      .toBeGreaterThanOrEqual(2)
    // …and it answers AFTER a catcher has landed, not only before one sets off.
    const landed = frames.find((s) => s.landedAt !== null)
    expect(landed, 'no catcher ever landed').toBeDefined()
    const answered = frames.some((s) => s.landedAt !== null && camkPulse(s) > 0.5)
    expect(answered, 'the switch never answers for a catcher that arrived').toBe(true)
    // ⚠ AND THE CARRIER WEARS THE SENDER'S INK on the way.
    expect(SRC['./synapseScene.ts'], 'the carrier is not marked as the switch’s errand')
      .toContain('softGlow(ctx, x, y, rr * (2.1 - fused * 0.7)')
    expect(SRC['./synapseScene.ts'], 'CaMKII never beats').toContain('camkPulse(sp)')
  })
})

describe('21c-75 — the wall lets the receptors through, and the bubbles arrive full', () => {
  const spine3: SpineState = { ...spineStart(), ampa: 3, camk: 1, delivered: 2 }
  const seats3 = spineRowSeats(base, spineAmpaShown(spine3), density)
  /** Lipid heads are the small arcs; nothing else in this frame is that size. */
  const headsNear = (c: ReturnType<typeof strictCanvas>, x: number, y: number, dx: number) =>
    c.arcs.filter((a) => a.r < 1.6 && Math.abs(a.x - x) < dx && Math.abs(a.y - y) < MEM_PX * 2.5)

  it('A2: no lipid stands ON a receptor, open or shut', () => {
    // ⚠ THE FAULT (user: "3 new AMPA receptors are covered by a membrane"). A
    // ligand channel's subunits PART as it opens, so an open receptor is wider
    // than a shut one — MEASURED, 10.69 px against 8.82. The paver punched its
    // hole at the SHUT width, so the nearest lipids stood at 9.5 and 9.9 and
    // every receptor put on a pair of shoulder-pads the moment it did its job.
    const c = strictCanvas()
    drawSynapse(c.ctx, {
      run,
      cleft,
      u: 14 / run.windowMs,
      spine: spine3,
      densityX: density,
      chrome: 0,
      labelsOn: false,
      width: SYN_W,
      height: SYN_H,
    })
    for (const [i, s] of seats3.entries()) {
      const open = i === seats3.length - 1 ? 0 : receptorOpenFrac(
        { ...base, seats: seats3, slowSeat: seats3.length - 1 } as never,
        run,
        cleft,
        i,
        14,
      )
      const half = ligandHalfWidth(MEM_PX * 2.6, open)
      const on = headsNear(c, s.x, faceAt(base, s.x), half)
      expect(on.length, `catcher ${i} is wearing ${on.length} lipids (open ${open.toFixed(2)})`).toBe(0)
    }
    // …and this really is a measurement of something: there ARE lipids either
    // side, or the guard would pass on a bare wall.
    const flanking = headsNear(c, seats3[1].x, faceAt(base, seats3[1].x), 16)
    expect(flanking.length, 'there is no membrane here at all to be clear of')
      .toBeGreaterThan(2)
  })

  it('A2: …and the paver honours the room a site asks for', () => {
    // ⚠ ASK THE DECISION. The hole is the paver's, and a site now says how wide
    // it needs to be — so a wider ask must clear more wall.
    // ⚠ ON THE SPINE'S FACE, not the terminal's wall — `membraneLipids` paves
    // both, and the receptors stand in only one of them.
    const onFace = (w: { at: { x: number; y: number } }) =>
      Math.abs(w.at.y - faceAt(base, w.at.x)) < MEM_PX * 2
    const at = (half: number) =>
      membraneLipids(base, [], { sites: [{ x: density, half }], doors: [], onWalls: [] })
        .filter((w) => onFace(w) && Math.abs(w.at.x - density) < half)
        .length
    expect(at(8.82), 'the shut width is not cleared').toBe(0)
    expect(at(10.69), 'an open receptor is not given its extra room').toBe(0)
    // …and a site that asks for nothing gets the wall back, or this measures
    // nothing at all.
    const none = membraneLipids(base, [], { sites: [], doors: [], onWalls: [] })
      .filter((w) => onFace(w) && Math.abs(w.at.x - density) < 10.69).length
    expect(none, 'the wall is empty here whatever the site asks').toBeGreaterThan(4)
  })

  it('A3: a restocking vesicle arrives FILLED', () => {
    // ⚠ (user: "vesicles should arrive filled, not NT teleport".) A bubble came
    // down empty and its transmitter appeared the instant the next message
    // began — cargo teleporting into a container already at the dock.
    const full = strictCanvas()
    drawSynapse(full.ctx, {
      run,
      cleft,
      u: null,
      spine: spineStart(),
      densityX: density,
      chrome: 0,
      labelsOn: false,
      restock: 0.45,
      width: SYN_W,
      height: SYN_H,
    })
    const empty = strictCanvas()
    drawSynapse(empty.ctx, {
      run,
      cleft,
      u: null,
      spine: spineStart(),
      densityX: density,
      chrome: 0,
      labelsOn: false,
      width: SYN_W,
      height: SYN_H,
    })
    // ⚠ ISOLATED BY DIFFERENCE — change only the restock and diff the renders,
    // rather than hunting transmitter-sized marks in a crowded frame.
    const dots = (c: ReturnType<typeof strictCanvas>) =>
      c.arcs.filter((a) => Math.abs(a.r - TRANSMITTER_R) < 0.6).length
    expect(dots(full) - dots(empty), 'the descending bubbles carry no transmitter')
      .toBeGreaterThanOrEqual(CARGO_N * 2)
  })

  it('A3: …and it carries what a docked one carries, in the same places', () => {
    // ⚠ One object at two moments. At the hand-over the descending bubble IS
    // the docked bubble, so the cargo must not shift as the label changes: both
    // ask `cargoIn`, so the count and the places are one answer, not two.
    const zone = activeZone(base)
    const d = zone.docked[0]
    const arriving = cargoIn(d.x, d.y, d.r)
    expect(arriving.length, 'a bubble carries a different number on the way')
      .toBe(CARGO_N)
    for (const p of arriving) {
      expect(Math.hypot(p.x - d.x, p.y - d.y), 'cargo is drawn outside its own bubble')
        .toBeLessThan(d.r)
    }
  })
})
