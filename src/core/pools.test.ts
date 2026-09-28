import { describe, expect, it } from 'vitest'
import { SINK_TOUCH } from './vesicleCycle'
import {
  CARGO_MS,
  DOCKED_SLOTS,
  FILL_DELAY_MS,
  FILL_MS,
  FLASH_MS,
  FUSE_MS,
  NT_PER_VESICLE,
  RECOVER_MS,
  REDOCK_MS,
  RELEASE_PER_SPIKE,
  SITE_CLEAR_P,
  STORAGE_N,
  TAP_REST_MS,
  TOTAL_VESICLES,
  countIn,
  flashesAt,
  fusingAt,
  lowestFreeRank,
  poolsSpike,
  poolsStart,
  poolsStep,
  tapQueue,
  type PoolsState,
} from './pools'

/** ⚠ TIME PASSING, IN FRAMES — the way the bench drives it.
 *
 *  `poolsStep` is a per-frame state machine: a bubble becomes storage in one
 *  call and can only be primed into a space on a LATER one. One big step
 *  carries it through a single stage, so a guard that hands it a whole second
 *  at once sees a terminal that never refills — a fact about the guard. */
const run = (s: PoolsState, ms: number): void => {
  const FR = 1000 / 60
  for (let t = 0; t < ms; t += FR) poolsStep(s, FR)
}

/** ⚠ THE CHILD'S OWN HAND — a press every `tapMs`, with the terminal's own
 *  refractory deciding whether it answers. This is exactly what `PoolsBench`
 *  does, and it is the whole experiment now. */
const child = (tapMs: number, secs = 24) => {
  const s = poolsStart()
  const FR = 1000 / 60
  let readyAt = 0
  let sent = 0
  let through = 0
  let firstDead = -1
  const marks: string[] = []
  for (let f = 0; f < 60 * secs; f++) {
    const now = f * FR
    poolsStep(s, FR)
    if (now % tapMs >= FR) continue
    if (s.now < readyAt) continue
    readyAt = s.now + TAP_REST_MS
    sent++
    const n = poolsSpike(s)
    if (n > 0) through++
    else if (firstDead < 0) firstDead = sent
    if (marks.length < 30) marks.push(n > 0 ? '*' : '.')
  }
  return { s, sent, through, firstDead, marks: marks.join('') }
}

describe('D18 — one terminal, and the child is the experiment', () => {
  it('A1: three parked and two in store, and only the parked ones can go', () => {
    const s = poolsStart()
    expect(s.ves.length).toBe(TOTAL_VESICLES)
    expect(TOTAL_VESICLES).toBe(DOCKED_SLOTS + STORAGE_N)
    expect(countIn(s, 'docked')).toBe(DOCKED_SLOTS)
    expect(countIn(s, 'storage')).toBe(STORAGE_N)

    const before = countIn(s, 'storage')
    const n = poolsSpike(s)
    expect(n).toBe(RELEASE_PER_SPIKE)
    expect(countIn(s, 'out')).toBe(n)
    expect(countIn(s, 'storage'), 'a message reached into storage').toBe(before)
    expect(s.ves.length, 'a bubble was minted or lost').toBe(TOTAL_VESICLES)
  })

  it('A2: a message spends exactly one parked bubble — no luck involved', () => {
    // ⚠ THIS REPLACED A COIN FLIP, and it is a correction, not a shortcut.
    // Release probability belongs to an individual vesicle; each bubble here
    // stands for hundreds, and averaging hundreds of coin flips gives a steady
    // share, not a gamble. It is also what makes the picture countable.
    expect(poolsSpike(poolsStart())).toBe(1)
    const a = child(500)
    const b = child(500)
    expect(a.marks, 'the same tapping gave two different answers').toBe(b.marks)
  })

  it('A3: THE EXPERIMENT — tap gently and it never fails; hammer and it runs out', () => {
    // ⚠ THE WHOLE EXHIBIT, and the child runs it (2026-09-08, user: "kids would
    // press the fire button continuously… that's what the kid already does").
    // Two terminals comparing two stimuli was answering a question no child
    // could ask, because they could not see that one panel was doing something
    // their own finger was not. Now the variable IS the finger.
    for (const tapMs of [2000, 1200]) {
      const gentle = child(tapMs)
      expect(
        gentle.firstDead,
        `pressing every ${tapMs}ms, message #${gentle.firstDead} found nothing: ${gentle.marks}`,
      ).toBe(-1)
      expect(gentle.through).toBe(gentle.sent)
    }
    for (const tapMs of [900, 500, 200, 80]) {
      const hard = child(tapMs)
      expect(
        hard.firstDead,
        `pressing every ${tapMs}ms it never ran out: ${hard.marks}`,
      ).toBeGreaterThan(0)
      expect(hard.through, 'it got everything through while being hammered').toBeLessThan(
        hard.sent,
      )
    }
  })

  it('A3: and the COUNT ON SCREEN is how many messages it has in it', () => {
    // ⚠ THE PROPERTY THAT MAKES IT PREDICTABLE (user: "more quantifiable for a
    // human eye"). Count the bubbles, press that many times, and the next press
    // is the one that fails — at every speed past the threshold.
    for (const tapMs of [900, 500, 200, 80]) {
      const hard = child(tapMs)
      expect(
        hard.firstDead,
        `pressing every ${tapMs}ms the first dead message was #${hard.firstDead}, not #${TOTAL_VESICLES + 1}: ${hard.marks}`,
      ).toBe(TOTAL_VESICLES + 1)
    }
  })

  it('A3: and "nothing left" is FOR A WHILE, not for ever', () => {
    // ⚠ Raised with the user as a science point: a synapse that goes
    // permanently silent is wrong, and a child would take it literally.
    const { s } = child(200, 4)
    expect(countIn(s, 'docked'), 'it still had something parked').toBe(0)
    expect(poolsSpike(s), 'the terminal had something left').toBe(0)
    run(s, RECOVER_MS + REDOCK_MS + 400)
    expect(countIn(s, 'docked'), 'it never refilled').toBeGreaterThan(0)
    expect(poolsSpike(s), 'it never worked again').toBe(1)
  })

  it('A4: the refractory stops the wrist becoming the model', () => {
    // ⚠ However fast the button is pressed, the terminal answers at its own top
    // speed — which a real axon does too. Without it, a child's hand sets the
    // firing rate and the exhibit measures the child rather than the synapse.
    const fast = child(80, 12)
    const presses = Math.floor(12000 / 80)
    expect(fast.sent, `${fast.sent} messages from ${presses} presses`).toBeLessThan(presses / 2)
    expect(fast.sent, 'the refractory swallowed everything').toBeGreaterThan(12000 / TAP_REST_MS / 3)
    // …and a deliberate press is never swallowed.
    expect(TAP_REST_MS, 'a deliberate press would be ignored').toBeLessThan(600)
  })

  it('A5: a parking space is not free while a bubble is merging out of it', () => {
    const s = poolsStart()
    poolsSpike(s)
    expect(countIn(s, 'docked')).toBe(DOCKED_SLOTS - 1)
    expect(fusingAt(s).length, 'nothing is merging').toBe(1)
    // ⚠ Sampled in the window where it matters — past the priming time, before
    // the space clears. Earlier, the docking gate holds storage back anyway.
    const after = REDOCK_MS + 40
    expect(after, 'no window between priming and the space clearing').toBeLessThan(
      FUSE_MS * SITE_CLEAR_P,
    )
    run(s, after)
    expect(countIn(s, 'docked'), 'a bubble docked into an occupied space').toBe(DOCKED_SLOTS - 1)
    run(s, FUSE_MS + REDOCK_MS + 200)
    expect(countIn(s, 'docked'), 'no space ever opened').toBe(DOCKED_SLOTS)
    const slots = s.ves.filter((v) => v.pool === 'docked').map((v) => v.slot)
    expect(new Set(slots).size, 'two bubbles share one space').toBe(slots.length)
  })

  it('A5: a bubble keeps its place, and a returning one takes a free one', () => {
    const s = poolsStart()
    const held = new Map(s.ves.filter((v) => v.pool === 'storage').map((v) => [v.id, v.rank]))
    poolsSpike(s)
    run(s, FUSE_MS + REDOCK_MS + 200)
    for (const v of s.ves.filter((x) => x.pool === 'storage')) {
      if (held.has(v.id)) expect(v.rank, `bubble ${v.id} was shuffled`).toBe(held.get(v.id))
    }
    // ⚠ AND A RETURNING BUBBLE MEETS AN OCCUPIED STORE. Built by hand: after one
    // message the store has emptied into the freed space by the time anything
    // comes back, so there is nobody for it to collide with.
    const busy = poolsStart()
    for (const d of busy.ves.filter((x) => x.pool === 'docked')) {
      d.pool = 'out'
      d.t = 10
    }
    busy.ves.find((x) => x.pool === 'out')!.t = RECOVER_MS - 30
    run(busy, 120)
    const back = busy.ves.filter((x) => x.pool === 'storage')
    expect(back.length, 'nothing came back into an occupied store').toBe(STORAGE_N + 1)
    const ranks = back.map((x) => x.rank)
    expect(new Set(ranks).size, `two share a place: ${ranks.join(',')}`).toBe(back.length)
    expect(ranks, 'the lowest free place is occupied').not.toContain(lowestFreeRank(busy, 'storage'))
  })

  it('A5: a retrieved bubble comes back EMPTY and is refilled', () => {
    // ⚠ (user, 2026-09-08: "let's symbolically fill recovered vesicles with
    // NTs".) A spent bubble used to reappear fully stocked, as if the terminal
    // got its transmitter for nothing. The membrane is what is retrieved; the
    // transmitter is pumped in afterwards — which is the step that makes the
    // loop a loop, and the vesicles-and-SNARE bench draws it molecule by
    // molecule at its own register.
    const s = poolsStart()
    for (const v of s.ves) expect(v.fill, 'a rested terminal is not stocked').toBe(1)

    poolsSpike(s)
    const gone = s.ves.find((v) => v.pool === 'out')!
    run(s, RECOVER_MS + 30)
    expect(gone.pool, 'it never came back').toBe('storage')
    expect(gone.fill, 'it came back already full').toBeLessThan(0.2)

    // …and it fills, all the way, and stops there — after its empty moment.
    run(s, FILL_DELAY_MS + FILL_MS + 60)
    expect(gone.fill, 'it never filled up').toBe(1)
    run(s, FILL_MS)
    expect(gone.fill, 'it overfilled').toBe(1)
  })

  it('A5: it is BORN EMPTY, and stays visibly empty before anything appears', () => {
    // ⚠ THE REPORTED FAILURE (user, 2026-09-08: "vesicle look to be born with
    // NTs in. Let them appear after certain time after vesicle birth").
    // Filling used to begin on the frame a bubble arrived, so the first ball
    // was already a third of the way in before a child could see the bubble was
    // empty at all.
    const s = poolsStart()
    poolsSpike(s)
    const v = s.ves.find((x) => x.pool === 'out')!
    run(s, RECOVER_MS + 30)
    expect(v.pool, 'it never came back').toBe('storage')

    // Nothing appears for the whole of the delay — sampled across it, not just
    // at its start.
    for (const at of [0, 0.25, 0.5, 0.9]) {
      expect(
        v.fill,
        `${Math.round(at * FILL_DELAY_MS)}ms after coming back it was already ${v.fill} full`,
      ).toBe(0)
      run(s, FILL_DELAY_MS * 0.25)
    }
    // …and the emptiness lasts long enough to be seen, next to the second or so
    // the bubble takes to glide to its place.
    expect(FILL_DELAY_MS, 'the empty moment is too brief to notice').toBeGreaterThan(300)

    // Then it fills, all the way, and stops.
    run(s, FILL_MS + 60)
    expect(v.fill, 'it never filled up').toBe(1)
    run(s, FILL_MS)
    expect(v.fill, 'it overfilled').toBe(1)
  })

  it('A5: an empty bubble cannot be parked — and refilling is now the slow step', () => {
    // ⚠ THE CLAIM CHANGED WITH THE DELAY (2026-09-08). Filling used to be
    // quicker than the parking clock, so the rule was real but never bound.
    // Waiting to be seen empty pushed the two together past `REDOCK_MS`, so a
    // returning bubble now waits on its transmitter rather than on the clock —
    // which is the honest order: a vesicle with nothing in it is not
    // releasable however well parked.
    expect(FILL_DELAY_MS + FILL_MS, 'filling is still not the slow step').toBeGreaterThan(REDOCK_MS)

    const s = poolsStart()
    for (const d of s.ves.filter((v) => v.pool === 'docked')) {
      d.pool = 'out'
      d.t = FUSE_MS
    }
    for (const v of s.ves.filter((x) => x.pool === 'storage')) {
      v.t = REDOCK_MS * 3
      v.fill = 0
    }
    run(s, 1000 / 60)
    expect(countIn(s, 'docked'), 'an empty bubble was parked').toBe(0)
    run(s, FILL_MS + 100)
    expect(countIn(s, 'docked'), 'a full bubble never parked').toBeGreaterThan(0)

    // ⚠ AND THE EXHIBIT'S TUNING SURVIVES IT. Coming back is the slow part
    // already, so lengthening its tail costs the sustainable rate very little —
    // measured, 1.04 messages a second before the delay and 0.96 after, both
    // comfortably inside the band that puts the threshold where a hand can feel
    // it. `A6` pins that band.
    const cycle = RECOVER_MS + Math.max(REDOCK_MS, FILL_DELAY_MS + FILL_MS)
    expect((TOTAL_VESICLES * 1000) / cycle).toBeGreaterThan(0.8)
  })

  it('A6: the clock hangs together', () => {
    expect(FUSE_MS, 'the fusion is too quick to follow').toBeGreaterThan(500)
    expect(RECOVER_MS, 'a bubble comes back while still merging').toBeGreaterThan(FUSE_MS)
    expect(RECOVER_MS, 'coming back is no slower than parking').toBeGreaterThan(REDOCK_MS * 4)
    // The flash lands exactly as the bubble it triggers touches the wall.
    expect(FLASH_MS).toBe(Math.round(SINK_TOUCH * FUSE_MS))
    expect(FLASH_MS, 'the flash is a single frame').toBeGreaterThan(80)
    expect(CARGO_MS, 'the cargo has no time to cross').toBeGreaterThan(FUSE_MS * SINK_TOUCH * 2)
    expect(CARGO_MS, 'the cargo outstays its own bubble by too far').toBeLessThan(FUSE_MS * 2)
    // ⚠ AND THE LINE BETWEEN GENTLE AND HARD FALLS WHERE A CHILD CAN FEEL IT:
    // the terminal sustains about one message a second, so a deliberate press
    // is safe and anything faster is not. Measured: works for ever at 1200 ms,
    // runs out at 900.
    const sustainable =
      (TOTAL_VESICLES * 1000) /
      (RECOVER_MS + Math.max(REDOCK_MS, FILL_DELAY_MS + FILL_MS))
    expect(sustainable, 'a deliberate press already outruns it').toBeGreaterThan(0.8)
    expect(sustainable, 'even hammering could not run it down').toBeLessThan(1.6)
  })

  it('A7: taps do not pile up, and one message means one flash', () => {
    expect(tapQueue(0, 1)).toBe(1)
    let owed = 0
    for (let k = 0; k < 20; k++) owed = tapQueue(owed, 1)
    expect(owed, `twenty clicks owed ${owed} messages`).toBe(1)

    const s = poolsStart()
    poolsSpike(s)
    expect(flashesAt(s).length).toBe(1)
    run(s, FLASH_MS + 20)
    expect(flashesAt(s).length, 'a flash lingered').toBe(0)
    expect(NT_PER_VESICLE).toBeGreaterThan(0)
  })
})
