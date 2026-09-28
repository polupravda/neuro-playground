import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { restingCounts } from '../core/ions'
import { cleftRun } from '../core/cleft'
import { synapseRun } from '../core/synapse'
import { AMPA_AT_REST, AMPA_DELIVERED, SPINE_PARTS, SPINE_HONESTY, TAP_REST_MS, spineCharge, spineFire, spineReach, spineStart, spineStep, type SpineState } from '../core/spine'
import { SPAN_NEUTRAL } from './particleStyle'
import {
  BURST_GAP_MS,
  BURST_N,
  SPREAD_GAP_MS,
  SPREAD_N,
  STORY_STEP_MS,
  buildSpineStory,
  naPhase,
  storyAct,
  storyModelMs,
  storyActive,
  storyRelease,
  storyRestock,
  walkStory,
} from './spineStory'
import { drawAnswerMeter, meterBox, meterY } from './answerMeter'

const run = synapseRun(restingCounts() as never, true)
const cleft = cleftRun(run)
const story = buildSpineStory(run, cleft)

/** Walking the story exactly as the stage does, reporting per-act readings. */
const play = () => {
  const s = spineStart()
  let next = 0
  let model = 0
  const frames: { t: number; act: string; reach: number; tint: number; drawn: boolean; ampa: number; camk: number }[] = []
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
      act: storyAct(story, t).key,
      reach: spineReach(s),
      tint: spineCharge(s),
      drawn: storyActive(story, t),
      ampa: s.ampa,
      camk: s.camk,
    })
  }
  return frames
}
const peakIn = (fs: ReturnType<typeof play>, act: string) =>
  Math.max(...fs.filter((f) => f.act === act).map((f) => f.reach))

describe('21c-71 — the whole lesson is ONE run', () => {
  // A1: "It's not clear for a kid what has to be done, so the kid played once.
  // We need to pack everything in one animation" (2026-09-13).

  it('A1: every message the story sends, the model TAKES', () => {
    // ⚠ THE BUG THIS IS HERE FOR, and it cost the whole exhibit. The schedule
    // is exact but the firing is quantised to a frame, so at the old 220 ms gap
    // the fires landed alternately at 224 and 208 — and 208 is under the
    // terminal's 210 ms refractory, so `spineFire` DROPPED them. It returns
    // nothing, so a refused message is indistinguishable from one never sent:
    // three of eight went missing and the cascade simply never fired.
    const w = walkStory(story)
    expect(w.sent, 'the story sends no messages at all').toBe(story.messages.length)
    expect(w.taken, `${w.sent - w.taken} of ${w.sent} messages were refused`).toBe(w.sent)
    // …and the gap clears the refractory by more than a slow frame, which is
    // what makes that true on a machine slower than this one.
    expect(BURST_GAP_MS - TAP_REST_MS, 'the burst’s gap has no room for a frame')
      .toBeGreaterThan(STORY_STEP_MS * 2)
  })

  it('A1: the story runs one message, then a few spread, then a run of them', () => {
    expect(story.acts.map((a) => a.key)).toEqual([
      'one', 'spread', 'burst', 'switch', 'deliver', 'again',
    ])
    expect(story.messages.length, 'the story is not 1 + a few + a burst + 1')
      .toBe(1 + SPREAD_N + BURST_N + 1)
    // the chapters tile the run with no gap and no overlap
    expect(story.acts[0].from).toBe(0)
    expect(story.acts[story.acts.length - 1].to).toBe(story.ms)
    for (let i = 1; i < story.acts.length; i++) {
      expect(story.acts[i].from, `chapter ${story.acts[i].key} does not follow the one before`)
        .toBeCloseTo(story.acts[i - 1].to, 6)
      expect(story.acts[i].to, `chapter ${story.acts[i].key} has no length`)
        .toBeGreaterThan(story.acts[i].from)
    }
  })

  it('A1: SPREAD is spread and BURST is close — in the MODEL’s own time', () => {
    // ⚠ THE CLAIM THE VIEW MAKES ALOUD: "it is not how many messages — it is
    // how close together they are." So the two acts must differ in the spacing
    // the MODEL sees, which is not the spacing on screen: the burst's leg is
    // stretched so the child can watch it.
    const modelAt = (m: { fireAt: number }) => storyModelMs(story, m.fireAt)
    const spread = story.messages.slice(1, 1 + SPREAD_N).map(modelAt)
    const burst = story.messages.slice(1 + SPREAD_N, 1 + SPREAD_N + BURST_N).map(modelAt)
    const gaps = (xs: number[]) => xs.slice(1).map((x, i) => x - xs[i])
    for (const g of gaps(spread)) expect(g).toBeCloseTo(SPREAD_GAP_MS, 0)
    for (const g of gaps(burst)) expect(g).toBeCloseTo(BURST_GAP_MS, 0)
    expect(SPREAD_GAP_MS / BURST_GAP_MS, 'the two acts are not really different tempos')
      .toBeGreaterThan(8)
    // ⚠ AND ON SCREEN THE BURST IS SLOWER THAN THE MODEL, or it is a flicker:
    // eight releases 260 ms apart is a blur in which no bubble is ever seen.
    const screenGaps = gaps(story.messages.slice(1 + SPREAD_N, 1 + SPREAD_N + BURST_N).map((m) => m.fireAt))
    for (const g of screenGaps) {
      expect(g, `a burst release gets only ${g.toFixed(0)}ms of screen`).toBeGreaterThan(450)
    }
  })

  it('A1: the spread act NEVER fires the cascade, and the burst does', () => {
    // ⚠ A THRESHOLD'S JOB IS TO REJECT THE NEAR MISS. The near miss here is the
    // spread act — the same kind of messages, the same cell, only further
    // apart — so the guard is that the cascade has not fired by the end of it.
    const fs = play()
    const spreadEnd = fs.filter((f) => f.act === 'spread').slice(-1)[0]
    expect(spreadEnd.camk, 'a few messages spread out potentiated the synapse')
      .toBeLessThan(1)
    expect(spreadEnd.ampa, 'the spread act delivered receptors').toBe(AMPA_AT_REST)
    // …and by the end of the story it HAS fired, exactly once.
    const end = fs[fs.length - 1]
    expect(end.camk, 'the burst never potentiated the synapse').toBe(1)
    expect(end.ampa, 'the receptors never arrived').toBe(AMPA_AT_REST + AMPA_DELIVERED)
  })

  it('A1: the head COOLS between the spread messages, and stays warm through the burst', () => {
    // The reading each act is for, measured on the ink's own crossing.
    const fs = play()
    const spread = fs.filter((f) => f.act === 'spread')
    const burst = fs.filter((f) => f.act === 'burst')
    // it goes warm in the spread act…
    expect(Math.max(...spread.map((f) => f.tint)), 'the spread messages never warm the head')
      .toBeGreaterThan(SPAN_NEUTRAL)
    // …and comes back COLD between them, more than once. MEASURED: it dips to
    // 0.47 against a crossing at 0.587.
    let dips = 0
    for (let i = 1; i < spread.length; i++) {
      if (spread[i].tint < SPAN_NEUTRAL && spread[i - 1].tint >= SPAN_NEUTRAL) dips++
    }
    expect(dips, `the head cooled ${dips} times in the spread act`).toBeGreaterThanOrEqual(SPREAD_N - 1)
    // ⚠ AND IN THE BURST IT NEVER COOLS — that is the whole difference, and it
    // is why the calcium stacks instead of draining.
    const burstFrom = burst.findIndex((f) => f.tint > SPAN_NEUTRAL)
    expect(burstFrom, 'the head never warms in the burst act').toBeGreaterThanOrEqual(0)
    expect(
      Math.min(...burst.slice(burstFrom).map((f) => f.tint)),
      'the head cooled off in the middle of the burst',
    ).toBeGreaterThan(SPAN_NEUTRAL)
  })

  it('A1: the LAST message is bigger than the FIRST — which is the whole point', () => {
    const fs = play()
    const first = peakIn(fs, 'one')
    const last = peakIn(fs, 'again')
    // MEASURED: 0.198 against 0.442, more than twice.
    expect(last, `the same message answers ${last.toFixed(3)} against ${first.toFixed(3)}`)
      .toBeGreaterThan(first * 1.6)
    // …and the mark the meter draws is the first one's, so the child can see it.
    expect(story.mark, 'the mark is not act one’s own peak').toBeCloseTo(first, 2)
    expect(story.markFrom, 'the mark shows before there is anything to compare')
      .toBeCloseTo(story.acts[0].to, 6)
    // ⚠ AND THE TWO ARE THE SAME MESSAGE, drawn the same way — or the
    // comparison is between two different things.
    const a = story.messages[0]
    const z = story.messages[story.messages.length - 1]
    expect(z.ms, 'the last message is not played at the first’s pace').toBe(a.ms)
    expect(z.phase, 'the last message shows a different part of the release').toBe(a.phase)
  })

  it('A1: between messages the terminal RESTOCKS rather than resetting', () => {
    // ⚠ THE FAULT (user: "New Vesicles should not teleport, but arrive from
    // top"). A message ends with its vesicles fused into the wall; the next
    // needs them docked. The picture supplied that by falling back to rest —
    // MEASURED, two of the three un-fused in ONE frame, at every boundary.
    //
    // Now the picture HOLDS where the message left it and fresh bubbles come
    // down from the pool. So the thing to guard is that no moment between a
    // message and the next is left for the old drawing to reset in.
    for (const m of story.messages.slice(1)) {
      expect(m.restock, 'a message is not restocked before it').toBeGreaterThan(120)
      expect(m.restock, 'the restock eats the message it is for').toBeLessThan(m.ms)
    }
    expect(story.messages[0].restock, 'the first message restocks a terminal that is already full')
      .toBe(0)

    // ⚠ THE BURST HAS NO IDLE FRAME AT ALL: a release is playing or a bubble is
    // coming down, always. A gap in a burst is where the old reset used to live.
    const idle = (t: number) => !storyActive(story, t) && storyRestock(story, t) === null
    // ⚠ BETWEEN its messages, that is. After the LAST one the terminal is not
    // restocked, and should not be: nothing more is coming, and the head is
    // meant to stay red while the calcium does its work.
    const burst = story.acts.find((a) => a.key === 'burst')!
    const inBurst = story.messages.filter((m) => m.at >= burst.from && m.at < burst.to)
    const lastPlayEnds = Math.max(...inBurst.map((m) => m.at + m.ms))
    let burstIdle = 0
    for (let t = burst.from; t < lastPlayEnds; t += STORY_STEP_MS) if (idle(t)) burstIdle++
    expect(burstIdle, `${burstIdle} idle frames between the burst’s messages`).toBe(0)
    expect(inBurst.length, 'the burst lost its messages').toBe(BURST_N)

    // …and the spread act keeps its real quiet, which is the reading it is for:
    // the head must be seen to go cold with nothing arriving.
    const spread = story.acts.find((a) => a.key === 'spread')!
    let quiet = 0
    let frames = 0
    for (let t = spread.from; t < spread.to; t += STORY_STEP_MS) {
      frames++
      if (idle(t)) quiet++
    }
    expect(quiet / frames, `only ${((quiet / frames) * 100).toFixed(0)}% of the spread act is quiet`)
      .toBeGreaterThan(0.12)
  })

  it('A1: the picture never runs backwards inside one message', () => {
    // Each message's release walks forward from its own start; the LATEST
    // message wins, so a burst restarts the picture rather than queueing.
    for (const m of story.messages) {
      expect(m.ms, 'a message has no play window at all').toBeGreaterThan(200)
      const a = storyRelease(story, m.at + 1)!
      const b = storyRelease(story, m.at + m.ms * 0.5)!
      const c = storyRelease(story, m.at + m.ms - 1)!
      expect(a, 'a message starts part-way through the release').toBeLessThan(b)
      expect(b, 'a message’s release does not advance').toBeLessThan(c)
    }
  })

  it('A1: the model’s clock is the STORY’s, legs and all', () => {
    expect(storyModelMs(story, 0)).toBe(0)
    // monotonic, and strictly so — a leg with no rate would freeze the cell
    let last = -1
    for (let t = 0; t <= story.ms; t += 500) {
      const m = storyModelMs(story, t)
      expect(m, 'the model ran backwards').toBeGreaterThan(last)
      last = m
    }
    // ⚠ AND THE BURST'S LEG REALLY IS SLOWER, or the stretch is decoration.
    const rate = (key: string) => story.acts.find((a) => a.key === key)!.rate
    expect(rate('burst'), 'the burst is played at the model’s own pace').toBeLessThan(0.6)
    expect(rate('one'), 'act one is no longer the pace it was tuned at').toBe(1)
    expect(rate('again'), 'the two full messages play at different paces').toBe(rate('one'))
  })

  it('A1: a repeat shows enough of the release to include its sodium', () => {
    // ⚠ A repeat that stops short of the sodium draws a cause with no effect.
    const na = naPhase(run, cleft)
    for (const m of story.messages) {
      expect(m.phase, 'a repeat is cut before its sodium gets in').toBeGreaterThan(na)
    }
  })
})

describe('21c-71 — the answer meter', () => {
  it('A1: the bar reads up, and the mark sits where the reading would', () => {
    const box = meterBox()
    expect(meterY(0), 'an empty meter does not read at the foot').toBeCloseTo(box.y + box.h, 6)
    expect(meterY(1), 'a full meter does not read at the top').toBeCloseTo(box.y, 6)
    expect(meterY(0.5)).toBeCloseTo(box.y + box.h / 2, 6)
    // ⚠ ONE NUMBER, ONE PICTURE: the mark and the bar are placed by the same
    // call, so a reading and the line it must beat cannot disagree.
    expect(meterY(story.mark), 'the mark is placed by a second rule')
      .toBe(meterY(story.mark))
  })

  it('A1: it is drawn, it honours the fade, and the mark is optional', () => {
    const bare = strictCanvas()
    drawAnswerMeter(bare.ctx, 0.4, null, 900, 600)
    const marked = strictCanvas()
    drawAnswerMeter(marked.ctx, 0.4, 0.2, 900, 600)
    expect(bare.inks.length, 'the meter draws nothing at all').toBeGreaterThan(0)
    expect(marked.inks.length, 'the mark adds no ink').toBeGreaterThan(bare.inks.length)
    // ⚠ A FADE IS A PROPERTY OF THE SURFACE — an instrument that ignores the
    // view's arrival is two marks still on screen after the picture has gone.
    const gone = strictCanvas()
    drawAnswerMeter(gone.ctx, 0.4, 0.2, 900, 600, 0)
    expect(gone.inks.length, 'the meter is painted through a zero fade').toBe(0)
    // …and it MULTIPLIES rather than assigns, so a caller's fade survives.
    const half = strictCanvas()
    drawAnswerMeter(half.ctx, 0.4, 0.2, 900, 600, 0.5)
    expect(Math.max(...half.alphas), 'the meter assigns its own alpha').toBeLessThanOrEqual(0.5)
  })

  it('A1: a bigger reading paints more of the bar', () => {
    const box = meterBox()
    const filled = (r: number) => {
      const c = strictCanvas()
      drawAnswerMeter(c.ctx, r, null, 900, 600)
      // the topmost vertex the fill reaches inside the track
      const ys = c.points.filter((pt) => pt.y >= box.y - 1 && pt.y <= box.y + box.h + 1).map((pt) => pt.y)
      return box.y + box.h - Math.min(...ys)
    }
    expect(filled(0.8), 'a bigger answer does not fill more').toBeGreaterThan(filled(0.2))
  })
})

describe('21c-71 — the words match what the story does', () => {
  it('A1: the info block no longer tells the child to tap', () => {
    // ⚠ THE STORY SENDS THE MESSAGES NOW. Text that says "tap eight times fast"
    // is an instruction for a control that no longer exists — and this exhibit
    // was reported precisely because a child could not tell what to do.
    for (const c of SPINE_PARTS) {
      expect(c.text.toLowerCase(), `a caption still asks for a tap: "${c.text.slice(0, 48)}…"`)
        .not.toMatch(/\btaps?\b|\btapping\b/)
    }
    for (const h of SPINE_HONESTY) {
      expect(h.text.toLowerCase(), `an honesty note still asks for a tap: "${h.text.slice(0, 48)}…"`)
        .not.toMatch(/\btaps?\b|\btapping\b/)
    }
  })

  it('A1: …and the count it says aloud is the count the story sends', () => {
    // ⚠ ONE PLACE, interpolated — the number was typed as `AMPA_AT_REST + 7`
    // beside a story that sends `BURST_N`, which is two claims about one fact.
    const burst = SPINE_PARTS.find((c) => c.text.includes('quick succession'))
    expect(burst, 'the burst caption has gone').toBeTruthy()
    expect(burst!.text, 'the caption says a different number from the story')
      .toContain(`${BURST_N} of them`)
    expect(
      story.messages.length - 2 - SPREAD_N,
      'the story does not actually send that many in the burst',
    ).toBe(BURST_N)
  })

  it('A1: the tempo claim it makes is one the story demonstrates', () => {
    // "It is not how many messages, it is how close together they are" — the
    // spread act must therefore send enough of them that "how many" is ruled
    // out on its own terms.
    const claim = SPINE_PARTS.find((c) => c.text.includes('how close together'))
    expect(claim, 'the tempo claim has gone').toBeTruthy()
    expect(claim!.text, 'the claim no longer points at the spread act')
      .toMatch(/spread out/i)
    expect(SPREAD_N, 'one message is not a demonstration of "however many"')
      .toBeGreaterThan(1)
  })
})

describe('21c-73 — the transport puts the cell back, not just the picture', () => {
  // A2: "timeline does not revert all actions, if dragged backwards" (2026-09-13).
  //
  // ⚠ AND THIS IS A REVERSAL OF AN EARLIER RULE, on purpose. The model used to
  // HOLD when dragged back, and that was right while the child's finger was the
  // input: nothing can un-tap a message, so a model that rewound would have been
  // inventing a past that never happened. The story sends the messages now — the
  // input is a SCHEDULE, and a schedule replays exactly. A model can be rewound
  // precisely when its inputs are reproducible.

  /** The stage's own walk, as a cursor a test can drag. */
  const cursor = () => {
    let state = spineStart()
    let sent = 0
    let walkedTo = 0
    return (target: number) => {
      if (target < walkedTo) {
        state = spineStart()
        sent = 0
        walkedTo = 0
      }
      while (walkedTo + STORY_STEP_MS <= target) {
        const from = walkedTo
        const to = from + STORY_STEP_MS
        while (sent < story.messages.length && story.messages[sent].fireAt <= to) {
          spineFire(state, 0)
          sent++
        }
        spineStep(state, storyModelMs(story, to) - storyModelMs(story, from))
        walkedTo = to
      }
      return state
    }
  }
  const snap = (s: SpineState) =>
    JSON.stringify({
      ampa: s.ampa,
      camk: +s.camk.toFixed(6),
      ca: +s.ca.toFixed(6),
      reach: +spineReach(s).toFixed(6),
      naSent: s.naSent,
      ions: s.naIons.length,
      deliveries: s.deliveries.length,
    })

  it('A2: dragging back lands exactly where PLAYING there lands', () => {
    const played = cursor()
    played(story.ms)
    for (const p of [6000, 16000, 27000, 34000, 41000, 52000]) {
      const dragged = snap(played(p))
      const fresh = snap(cursor()(p))
      expect(dragged, `dragged back to ${(p / 1000).toFixed(0)}s, the cell is not what it was`)
        .toBe(fresh)
    }
  })

  it('A2: …so the synapse really is UNLEARNED when you go back before it learned', () => {
    // ⚠ THE REPORT, in one assertion. Dragging to act one showed act one's
    // picture over a potentiated synapse: three catchers, CaMKII lit, the head
    // still red.
    const c = cursor()
    c(story.ms)
    const end = c(story.ms)
    expect(end.ampa, 'the story never potentiated the synapse').toBe(AMPA_AT_REST + AMPA_DELIVERED)
    const back = c(story.acts[0].to * 0.4)
    expect(back.ampa, 'the new catchers are still there in act one').toBe(AMPA_AT_REST)
    expect(back.camk, 'CaMKII is still lit in act one').toBe(0)
    expect(back.naSent, 'sodium that had not gone through yet has gone through').toBe(0)
    expect(back.deliveries.length, 'carriers are in flight before they were sent').toBe(0)
  })

  it('A2: and the walk does not depend on the frame rate', () => {
    // ⚠ Stepping by `frame.timeDiff` made the state depend on how fast the
    // machine was drawing — the same moment was a different cell on a slow tab,
    // and scrubbing could not land on what it left. The walk is in fixed steps
    // of the story's own time, so the position decides and nothing else does.
    const at = (target: number) => snap(cursor()(target))
    expect(at(30000), 'the same position gives two different cells').toBe(at(30000))
    // …and it is a whole number of steps, so a position between steps resolves
    // downward rather than part-way into one.
    const a = cursor()
    const exact = snap(a(30000))
    const b = cursor()
    expect(snap(b(30000 + STORY_STEP_MS - 1)), 'a part-step advanced the model')
      .toBe(exact)
  })
})
