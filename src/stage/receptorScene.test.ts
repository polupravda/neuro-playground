import { describe, expect, it } from 'vitest'
import { RECEPTOR_HONESTY } from '../core/receptors'
import { SPINE_CEILING_MV, SPINE_HONESTY } from '../core/spine'

const BENCH = import.meta.glob('../ui/ReceptorBench.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>
import { strictCanvas } from './strictCanvas'
import {
  CONTENT_W,
  PANEL_CHROME,
  RECEPTOR_H,
  RECEPTOR_W,
  ROW_GAP,
  barFrac,
  barMark,
  drawReceptor,
  innerFace,
  ionAt,
  ION_SLOTS,
  outerFace,
  plugAt,
  receptorGeometry,
  stoneIn,
} from './receptorScene'
import {
  MG_DELTA,
  MV_MAX,
  MV_MIN,
  MV_REST,
  RECEPTOR_KINDS,
  SLOW,
  legsOf,
  mgBlock,
  openMs,
  receptorsFire,
  receptorsStart,
  receptorsStep,
  runMs,
  type ReceptorKind,
  type ReceptorsState,
} from '../core/receptors'

const G = receptorGeometry()

const run = (s: ReceptorsState, ms: number, step = 16) => {
  for (let t = 0; t < ms; t += step) receptorsStep(s, Math.min(step, ms - t))
}

/** A settled membrane at a chosen voltage, nothing sent. */
const at = (mv: number): ReceptorsState => {
  const s = receptorsStart()
  s.mv = mv
  s.plug = mgBlock(mv)
  return s
}

/** …and one mid-run, with the magnesium settled for that voltage. */
const firedTo = (mv: number, ms: number): ReceptorsState => {
  const s = at(mv)
  receptorsFire(s)
  run(s, ms)
  return s
}

const paint = (kind: ReceptorKind, s: ReceptorsState, ms = 0) => {
  const c = strictCanvas()
  drawReceptor(c.ctx, { kind, state: s, ms })
  return c
}

/** The middle of a receptor's own open stretch. */
const midFlow = (kind: ReceptorKind): number => {
  let t = 0
  for (const leg of legsOf(kind)) {
    if (leg.stage === 'flowing') return t + leg.ms / 2
    t += leg.ms
  }
  throw new Error('no flowing leg')
}

/** An `rgba(r, g, b, a)` or `rgb(r, g, b)` string, as numbers. */
const rgbOf = (css: string): [number, number, number] | null => {
  const m = css.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

describe('D07 — the two receptors, drawn', () => {
  // ── A1: the side-by-side layout ──────────────────────────────────────────
  it('A1: two panels and their chrome fit the drawer, with nothing overlapping', () => {
    // ⚠ ASK FOR WHAT THE BUDGET PROMISED, not merely for the absence of
    // collision: the row is two containers and one gap, and it must come out
    // no wider than the content column it was solved from.
    const used = RECEPTOR_W * 2 + ROW_GAP + PANEL_CHROME * 2
    expect(used, `the row asks for ${used}px of a ${CONTENT_W}px column`)
      .toBeLessThanOrEqual(CONTENT_W)
    expect(used, 'the row is leaving most of the column empty')
      .toBeGreaterThan(CONTENT_W - 4)

    // …and vertically the parts are in order, none of them off the panel.
    expect(0).toBeLessThan(outerFace(G))
    expect(outerFace(G)).toBeLessThan(innerFace(G))
    expect(innerFace(G)).toBeLessThan(G.drawH)
    expect(G.drawH).toBeLessThanOrEqual(G.barY)
    expect(G.barY + G.barH).toBeLessThanOrEqual(G.h)
    expect(RECEPTOR_H).toBeGreaterThan(240)
  })

  it('A1: the two panels draw the SAME protein — one glyph, one size', () => {
    // ⚠ "One protein, one drawing — across REGISTERS too." It is the whole
    // exhibit: two receptors of one family, built alike, and everything that
    // separates them is a single stone. Two silhouettes would give the child a
    // reason to expect them to behave differently, and there would be nothing
    // left to be surprised by.
    //
    // Measured on the ink, with the panels' own extras arranged out of the
    // band: fully depolarised so the magnesium has risen clear of the membrane,
    // and nothing sent, so there is no transmitter and no traveller.
    const band = G.hm * 0.95
    const inWall = (kind: ReceptorKind) =>
      paint(kind, at(MV_MAX))
        .points.filter((p) => Math.abs(p.y - G.wallY) < band)
        .sort((a, b) => a.x - b.x || a.y - b.y)
    const a = inWall('ampa')
    const n = inWall('nmda')
    expect(a.length, 'nothing was drawn in the membrane band').toBeGreaterThan(200)
    expect(n.length, `${a.length} marks in one wall against ${n.length} in the other`)
      .toBe(a.length)
    for (let i = 0; i < a.length; i++) {
      expect(Math.hypot(a[i].x - n[i].x, a[i].y - n[i].y), `mark ${i} sits elsewhere`)
        .toBeLessThan(0.001)
    }
  })

  it('A1: the canvas letters NOTHING but the reading', () => {
    // The canvas carries names and readings on a scale; everything else is in
    // the info block.
    for (const kind of RECEPTOR_KINDS) {
      for (const s of [at(MV_REST), firedTo(MV_REST, midFlow(kind)), firedTo(MV_MAX, midFlow(kind))]) {
        for (const t of paint(kind, s).texts) {
          expect(['shut', 'open', 'blocked'], `the canvas said "${t}"`).toContain(t)
        }
      }
    }
  })

  // ── A5: the negative inside is colour-coded ──────────────────────────────
  it('A5: the inside reads BLUE while the magnesium blocks, and warms as it clears', () => {
    // ⚠ MEASURED WHERE THE CHILD READS IT — the actual colours the wash lays
    // down, not the number handed to `polarityT`. A guard on the input can be
    // green, true, and pointing the wrong way.
    // ⚠ THE WASH IS ISOLATED BY DIFFERENCE, not by picking the most colourful
    // stop. The panel is full of slate rgba() — the oily core, the bar's track,
    // the cleft — and slate leans blue, so "the bluest stop" happily returned a
    // lipid and passed. The voltage is the ONLY thing changed between these two
    // renders, so every colour that differs belongs to the wash and nothing
    // else can sneak in.
    const stopsAt = (kind: ReceptorKind, mv: number) =>
      paint(kind, at(mv)).styles.filter((c) => c.startsWith('rgba('))
    const washPair = (kind: ReceptorKind, a: number, b: number) => {
      const x = stopsAt(kind, a)
      const y = stopsAt(kind, b)
      expect(y.length, `${kind}: the two renders drew different things`).toBe(x.length)
      const diff = x.map((c, i) => [c, y[i]] as const).filter(([p, q]) => p !== q)
      expect(diff.length, `${kind}: the voltage changed no colour at all`).toBeGreaterThan(0)
      const lean = (c: string) => {
        const v = rgbOf(c)!
        return v[2] - v[0]
      }
      return { a: Math.max(...diff.map(([p]) => lean(p))), b: Math.max(...diff.map(([, q]) => lean(q))) }
    }
    for (const kind of RECEPTOR_KINDS) {
      const ends = washPair(kind, MV_REST, MV_MAX)
      expect(ends.a, `${kind}: at rest the inside does not lean blue`).toBeGreaterThan(20)
      expect(ends.b, `${kind}: depolarised the inside still leans blue`).toBeLessThan(0)
      // ⚠ AND THE MIDDLE OF THE TRANSITION, or a guard on the two ends could
      // pass over a colour that jumps between them.
      const mid = washPair(kind, MV_REST, -35)
      expect(mid.b, `${kind}: −35 mV is not between the two ends`).toBeLessThan(ends.a)
      expect(mid.b, `${kind}: −35 mV has already gone warm`).toBeGreaterThan(ends.b)
    }
  })

  it('A5: the wash is on the INSIDE, and it is in BOTH panels', () => {
    // It is one membrane potential and one cell. Painting it only under NMDA
    // would have made the cell's own state look like a property of NMDA.
    for (const kind of RECEPTOR_KINDS) {
      const c = paint(kind, at(MV_REST))
      const washTop = c.points
        .filter((p) => p.x === 0 && p.y > 0)
        .map((p) => p.y)
        .sort((a, b) => a - b)[0]
      expect(washTop, `${kind}: nothing is painted below the membrane`).toBeDefined()
      expect(washTop, `${kind}: the wash starts at ${washTop}, above the inner face`)
        .toBeGreaterThanOrEqual(innerFace(G))
    }
  })

  // ── A4: the magnesium, animated ──────────────────────────────────────────
  it('A4 (21c-74): the stone’s DEPTH is the block, and it lifts with the voltage', () => {
    // ⚠ THIS REVERSES 21c-35, at the user’s word (2026-09-13: "Do not demo
    // probability of Mg block, either keep closed or open. Lift or deepen
    // depending on the voltage").
    //
    // 21c-35 ruled the other way: one drawn stone has only its own TIME to
    // spend, so a 47% block was a stone in its seat 47% of the time — true to
    // the physics, and unreadable on a dial. Turning the knob changed how OFTEN
    // the stone was in, which no eye can integrate, so the one thing this
    // drawer exists to show could not be seen. The fraction is spent on DEPTH
    // now, and the simplification is declared.
    const open = firedTo(MV_REST, midFlow('nmda'))
    const depth = (mv: number) => stoneIn({ ...open, mv, plug: mgBlock(mv) })
    for (const mv of [MV_REST, -40, -17, 0, MV_MAX]) {
      expect(
        depth(mv),
        `at ${mv} mV the stone sits ${(depth(mv) * 100).toFixed(0)}% down, against a ${(mgBlock(mv) * 100).toFixed(0)}% block`,
      ).toBeCloseTo(mgBlock(mv), 2)
    }
    // ⚠ AND IT IS MONOTONE, which is what "lift or deepen" means: every turn
    // of the dial moves it the same way, with nothing in between to read as
    // chance.
    let last = 1.1
    for (let mv = MV_MIN; mv <= MV_MAX; mv += 5) {
      const d = depth(mv)
      expect(d, `the stone got DEEPER between ${mv - 5} and ${mv} mV`).toBeLessThanOrEqual(last)
      last = d
    }
    // …and it really does travel: deep at the bottom of the dial, clear at the top.
    expect(depth(MV_MIN), 'the stone is not seated at the most negative voltage')
      .toBeGreaterThan(0.9)
    expect(depth(MV_MAX), 'the stone never lifts clear, even at the dial’s top')
      .toBeLessThan(0.15)
  })

  it('A4 (21c-74): it holds STILL at a voltage — no flicker to read as chance', () => {
    // ⚠ THE POINT OF THE REVERSAL. The old stone moved constantly at a fixed
    // voltage, spending the block as time; this one does not move at all unless
    // the voltage does. "Do not demo probability" is exactly this assertion.
    const out = outerFace(G) - G.hm * 1.3
    const seat = outerFace(G) + 2 * G.hm * MG_DELTA
    for (const mv of [MV_REST, -40, -15, 0, MV_MAX]) {
      const st = firedTo(mv, midFlow('nmda'))
      st.plug = mgBlock(mv)
      const at = (ms: number) => (plugAt(G, st, ms).y - out) / (seat - out)
      const first = at(0)
      let worst = 0
      for (let i = 0; i < 4000; i++) worst = Math.max(worst, Math.abs(at(i * 333.7) - first))
      expect(worst, `at ${mv} mV the stone still moves by ${(worst * 100).toFixed(0)}% of the pore`)
        .toBeLessThan(0.001)
    }
    expect(seat).toBeGreaterThan(outerFace(G))
  })

  it('A4 (21c-74): the share of ions that get in is the share the stone leaves clear', () => {
    // ⚠ AND THIS IS WHY THE PASS RULE HAD TO CHANGE WITH IT. The decision was
    // `stoneIn(…) < 0.5` — right while the stone was a coin over time, because
    // ions arriving at different moments met it in different states. A depth
    // gives every ion the SAME answer, so a threshold made it all-or-nothing:
    // MEASURED at −30 mV, 0% of ions got in against a block leaving 31% of the
    // current flowing.
    //
    // *When one drawn thing stands for many, probabilities become FRACTIONS.*
    // Each ion takes a share of its own, so the cast realises the number the
    // stone is drawing — one number, two readings that cannot disagree.
    for (const mv of [MV_REST, -30, -15, 0, MV_MAX]) {
      const st = firedTo(mv, midFlow('nmda'))
      let crossings = 0
      let got = 0
      for (let c = 0; c < 900; c++) {
        for (let i = 0; i < ION_SLOTS; i++) {
          crossings++
          if (ionAt(G, 'nmda', st, i, c * 1000 + 40).passes) got++
        }
      }
      const share = got / crossings
      expect(
        share,
        `at ${mv} mV, ${(share * 100).toFixed(0)}% of ions get in but the stone leaves ${((1 - mgBlock(mv)) * 100).toFixed(0)}% clear`,
      ).toBeCloseTo(1 - mgBlock(mv), 1)
    }
  })

  it('A4 (21c-74): a fully seated stone lets NOTHING past', () => {
    // ⚠ A threshold's job is to reject the near miss, and the near miss here is
    // the resting cell: the block is 96%, not 100%, so a trickle is right — but
    // at the very bottom of the dial nothing at all may get through.
    const deep = firedTo(MV_MIN, midFlow('nmda'))
    deep.plug = 1
    let through = 0
    for (let c = 0; c < 400; c++) {
      for (let i = 0; i < ION_SLOTS; i++) {
        if (ionAt(G, 'nmda', deep, i, c * 1000 + 40).passes) through++
      }
    }
    expect(through, 'ions get past a stone that is all the way in').toBe(0)
  })

  it('A3: a blocked channel is drawn TURNING IONS BACK, not drawn empty', () => {
    // ⚠ A FAILURE MUST BE DRAWN, or the exhibit teaches the opposite. An open
    // pore with nothing near it says "nothing was sent"; an open pore with ions
    // piling up against a stone says "they were sent and they could not pass".
    const blocked = firedTo(MV_REST, midFlow('nmda'))
    const seen = Array.from({ length: ION_SLOTS }, (_, i) =>
      Array.from({ length: 24 }, (_, f) => ionAt(G, 'nmda', blocked, i, f * 40)),
    ).flat()
    const drawn = seen.filter((p) => p.alpha > 0.1)
    expect(drawn.length, 'no ions are drawn at a blocked channel at all')
      .toBeGreaterThan(20)
    // ⚠ A FRACTION, NOT A ZERO. The block is 96%, not 100%, and the drawing now
    // spends that fraction on HOW MANY of the travellers pass rather than on
    // shortening all of them — so the honest claim is "almost none", and an
    // exact zero would be a guard that only held while the sample was short.
    const past = drawn.filter((p) => p.y > innerFace(G)).length / drawn.length
    expect(past, `${(past * 100).toFixed(1)}% of ions got past the stone`)
      .toBeLessThan(0.05)

    // …and the same channel, same instant, with the voltage up: they get in.
    const clear = firedTo(MV_MAX, midFlow('nmda'))
    const got = Array.from({ length: ION_SLOTS }, (_, i) =>
      Array.from({ length: 24 }, (_, f) => ionAt(G, 'nmda', clear, i, f * 40)),
    )
      .flat()
      .filter((p) => p.alpha > 0.1 && p.y > innerFace(G))
    expect(got.length, 'nothing gets through even when the stone has gone')
      .toBeGreaterThan(5)
  })

  it('A1 (21c-33): the ions reach the BOTTOM EDGE, and NMDA’s go as far as AMPA’s', () => {
    // ⚠ THE REPORTED FAULT (user, 2026-09-11: "let ions in nmda reach the
    // bottom edge of the canvas, same as in ampa case"). Every NMDA ion's path
    // used to be blended toward the bounce by the block fraction, so even a
    // nearly-clear channel pulled all of them a tenth of the way back and none
    // ever arrived. Measured before: NMDA stopped 8px short of AMPA and, once
    // the tail fade was added, NO ion at the edge was above half alpha.
    const sweep = (kind: ReceptorKind, mv: number) =>
      Array.from({ length: 200 }, (_, f) =>
        Array.from({ length: ION_SLOTS }, (_, i) =>
          ionAt(G, kind, firedTo(mv, midFlow(kind)), i, f * 20),
        ),
      )
        .flat()
        .filter((p) => p.alpha > 0.1)

    const deepest = (kind: ReceptorKind, mv: number) =>
      Math.max(...sweep(kind, mv).map((p) => p.y))

    // Both arrive at the bottom of the drawing area, within an ion's radius.
    for (const [kind, mv] of [['ampa', MV_REST], ['nmda', MV_MAX]] as const) {
      expect(
        deepest(kind, mv),
        `${kind} stops ${(G.drawH - deepest(kind, mv)).toFixed(0)}px short of the edge`,
      ).toBeGreaterThan(G.drawH - G.hm * 0.2)
    }
    expect(
      Math.abs(deepest('nmda', MV_MAX) - deepest('ampa', MV_REST)),
      'the two panels’ ions stop at different depths',
    ).toBeLessThan(G.hm * 0.1)

    // ⚠ AND SOLID WHEN THEY GET THERE. An ion that fades out over the last few
    // pixels has not reached the edge as far as an eye is concerned — which is
    // exactly the fault, wearing a different hat.
    for (const [kind, mv] of [['ampa', MV_REST], ['nmda', MV_MAX]] as const) {
      const atEdge = sweep(kind, mv).filter((p) => p.y > G.drawH - G.hm * 0.3)
      expect(atEdge.length, `${kind}: nothing is drawn at the bottom edge`).toBeGreaterThan(0)
      expect(
        Math.max(...atEdge.map((p) => p.alpha)),
        `${kind}: every ion at the edge is a ghost`,
      ).toBeGreaterThan(0.9)
    }
  })

  it('A3: AMPA passes ions at every voltage — it is not the one that changes', () => {
    const past = (mv: number) =>
      Array.from({ length: ION_SLOTS }, (_, i) =>
        Array.from({ length: 24 }, (_, f) => ionAt(G, 'ampa', firedTo(mv, midFlow('ampa')), i, f * 40)),
      )
        .flat()
        .filter((p) => p.alpha > 0.1 && p.y > innerFace(G)).length
    expect(past(MV_REST), 'AMPA passes nothing at rest').toBeGreaterThan(5)
    expect(past(MV_MAX), 'AMPA changed with the voltage — only NMDA may')
      .toBe(past(MV_REST))
  })

  // ── A2: the timing, where the child reads it ─────────────────────────────
  it('A2: the bars measure the same thing, so NMDA’s is SLOW times longer', () => {
    // ⚠ MEASURE THE CLAIM WHERE THE CHILD READS IT. "NMDA is slow" is a fact
    // about two bar lengths on one scale, not about a constant in the model.
    const ends: Record<string, number> = {}
    for (const kind of RECEPTOR_KINDS) {
      const s = firedTo(MV_MAX, runMs(kind) + 200)
      ends[kind] = barFrac(kind, s)
    }
    expect(ends.nmda / ends.ampa, 'the bars do not show the ratio they promise')
      .toBeCloseTo(SLOW, 4)
    expect(ends.nmda, 'the longer bar does not fill its track').toBeCloseTo(1, 6)
    // Each panel carries the OTHER's full length as a tick, so the comparison
    // needs no memory of a picture that has gone.
    expect(barMark('ampa')).toBeCloseTo(openMs('ampa') / openMs('nmda'), 6)
    expect(barMark('nmda')).toBeCloseTo(1, 6)
  })

  it('A2: the bar HOLDS after the run — the two can be compared at leisure', () => {
    const s = firedTo(MV_MAX, runMs('nmda') + 50)
    const held = barFrac('ampa', s)
    run(s, 4000)
    expect(barFrac('ampa', s), 'the bar drained away and took the comparison with it')
      .toBeCloseTo(held, 6)
    expect(held, 'the bar never filled').toBeGreaterThan(0.1)
  })

  it('A2: and it is visibly on screen — both bars inside the panel', () => {
    const s = firedTo(MV_MAX, runMs('nmda') + 50)
    for (const kind of RECEPTOR_KINDS) {
      const c = paint(kind, s)
      const bars = c.points
        .filter((p) => p.y >= G.barY && p.y <= G.barY + G.barH)
        .sort((a, b) => a.x - b.x)
      // Three strips: the track, this receptor's fill, and the OTHER's tick.
      expect(bars.length, `${kind}: the bar is not three strips`).toBe(3)
      for (const p of bars) {
        expect(p.x, `${kind}: the bar runs off the panel at ${p.x}`).toBeGreaterThanOrEqual(-1)
        expect(p.x).toBeLessThanOrEqual(RECEPTOR_W + 1)
      }
      // ⚠ ASK FOR WHAT THE LAYOUT PROMISED: the tick stands at the other
      // receptor's full length along this panel's own track, so the two panels
      // can be compared without remembering a picture that has gone.
      const pad = 12
      const track = RECEPTOR_W - pad * 2
      const other: ReceptorKind = kind === 'ampa' ? 'nmda' : 'ampa'
      expect(bars[2].x, `${kind}: the tick is not at the other bar's length`)
        .toBeCloseTo(pad + track * barMark(other) - 1, 6)
    }
  })
})

describe('21c-65 — the dial says where one synapse stops', () => {
  it('A1: the ceiling is marked on the knob, and the note explains it', () => {
    // ⚠ (user, 2026-09-13: "'the block lifts, it never opens' … this is not what
    // you have displayed in 'AMPA & NMDA receptors' drawer. Align across
    // visualisations".) The alignment is not a change to either drawing — they
    // share `mgBlock` and `stoneSeated` and agree at every voltage. It is that
    // the dial reaches somewhere a synapse cannot take itself, and the picture
    // now SAYS so where the child is turning it.
    const src = BENCH['../ui/ReceptorBench.tsx']
    expect(src, 'the bench did not load').toBeTruthy()
    expect(src, 'the one-synapse ceiling is not marked on the dial')
      .toContain('SPINE_CEILING_MV - MV_MIN')
    expect(src, 'the mark has nothing to say for itself')
      .toContain('cannot make itself less negative than this')
    // …and the mark lands INSIDE the dial, or it marks nothing.
    const at = (SPINE_CEILING_MV - MV_MIN) / (MV_MAX - MV_MIN)
    expect(at, 'the ceiling is off the left of the dial').toBeGreaterThan(0.05)
    expect(at, 'the ceiling is off the right of the dial').toBeLessThan(0.95)
    // …and both views point at each other, so neither reads as a contradiction.
    expect(RECEPTOR_HONESTY.some((n) => n.text.includes('dendritic spine view')))
      .toBe(true)
    expect(SPINE_HONESTY.some((n) => n.text.includes('AMPA & NMDA drawer')))
      .toBe(true)
  })
})
