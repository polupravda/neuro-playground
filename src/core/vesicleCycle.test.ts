import { describe, expect, it } from 'vitest'
import {
  CLAMP_OFF,
  PRIMED_ZIP,
  SNARE_HONESTY,
  SNARE_PARTS,
  STAGES,
  STAGE_SPANS,
  cargoAt,
  clampAt,
  coatAt,
  descentAt,
  disassembleAt,
  gtpAt,
  poreAt,
  pressedAt,
  rabGoneAt,
  retrievedAt,
  sitesFilled,
  stageAt,
  mouthOpenAt,
  syntaxinOpenAt,
  tetherHoldAt,
  through,
  uAtMouthOpen,
  uAtThrough,
  zipAt,
} from './vesicleCycle'
import { HILL_N } from './synapse'

describe('D06 — the vesicle cycle', () => {
  it('A3: the stages tile the run exactly once, in order', () => {
    expect(STAGE_SPANS[0].from).toBe(0)
    expect(STAGE_SPANS[STAGE_SPANS.length - 1].to).toBeCloseTo(1, 9)
    for (let i = 1; i < STAGE_SPANS.length; i++) {
      expect(STAGE_SPANS[i].from).toBeCloseTo(STAGE_SPANS[i - 1].to, 9)
    }
    expect(STAGE_SPANS.map((s) => s.id)).toEqual(STAGES.map((s) => s.id))
  })

  it('A3: the clock follows the interest, not even time', () => {
    // "Split the window into legs and give the payload most of the screen
    // time." The payload here is the trigger and the zip — four calcium ions
    // landing and two membranes being pulled together.
    const share = (id: string) => STAGES.find((s) => s.id === id)!.share
    const even = 1 / STAGES.length
    expect(share('trigger')).toBeGreaterThan(even)
    expect(share('zipper')).toBeGreaterThan(even)
    // …at the expense of the housekeeping.
    expect(share('refill')).toBeLessThan(even)
    expect(share('retrieve')).toBeLessThan(even)
  })

  it('A3: walking the clock lands in every stage, none skipped', () => {
    // The check the architecture asks for: walk it, do not assert it.
    const seen = new Set<string>()
    for (let i = 0; i <= 400; i++) seen.add(stageAt(i / 400).stage.id)
    expect(seen.size).toBe(STAGES.length)
  })

  it('A3: the zip STOPS at half and waits for calcium', () => {
    // ⚠ The pause is the mechanism. A complex winding smoothly from nought to
    // one would be a picture of fusion with no trigger in it.
    const primeEnd = STAGE_SPANS.find((s) => s.id === 'prime')!.to
    const triggerEnd = STAGE_SPANS.find((s) => s.id === 'trigger')!.to
    expect(zipAt(primeEnd)).toBeCloseTo(PRIMED_ZIP, 6)
    // Held, unchanged, right through the calcium stage.
    expect(zipAt(triggerEnd)).toBeCloseTo(PRIMED_ZIP, 6)
    expect(zipAt((primeEnd + triggerEnd) / 2)).toBeCloseTo(PRIMED_ZIP, 6)
    // And only then does it finish.
    expect(zipAt(STAGE_SPANS.find((s) => s.id === 'zipper')!.to)).toBeCloseTo(1, 6)
  })

  it('A3: it takes FOUR sites, and three is not enough', () => {
    // The count is the scene's own Hill exponent, not a number typed again.
    const trigger = STAGE_SPANS.find((s) => s.id === 'trigger')!
    expect(sitesFilled(trigger.from)).toBe(0)
    expect(sitesFilled(trigger.to)).toBe(HILL_N)
    // It fills one at a time, and reaches every count on the way.
    const counts = new Set<number>()
    for (let i = 0; i <= 200; i++) counts.add(sitesFilled(trigger.from + ((trigger.to - trigger.from) * i) / 200))
    for (let n = 0; n <= HILL_N; n++) expect(counts.has(n)).toBe(true)
    // ⚠ AND NOTHING FUSES BEFORE THE FOURTH. The pore stays shut for every
    // moment the sensor is short of a full set.
    for (let i = 0; i <= 300; i++) {
      const u = i / 300
      if (sitesFilled(u) < HILL_N && u < trigger.to) expect(poreAt(u)).toBe(0)
    }
  })

  it('A3: the order is dock → prime → trigger → zip → pore → collapse', () => {
    // Each step waits for the one before — checked as "first moment above
    // zero", which is the claim rather than a value at a chosen instant.
    const firstAbove = (f: (u: number) => number) => {
      for (let i = 0; i <= 1000; i++) if (f(i / 1000) > 0) return i / 1000
      return Infinity
    }
    const dock = firstAbove(pressedAt)
    const zip = firstAbove((u) => Math.max(0, zipAt(u) - PRIMED_ZIP))
    const sites = firstAbove(sitesFilled)
    const pore = firstAbove(poreAt)
    const back = firstAbove(retrievedAt)
    expect(dock).toBeLessThan(sites)
    expect(sites).toBeLessThan(zip)
    expect(zip).toBeLessThan(pore)
    expect(pore).toBeLessThan(back)
  })

  it('A2 (2026-09-03): the clock RESTS between events — a held leg finishes early and sits still', () => {
    // "Add gaps between important events": the legs after the big joins carry
    // a `hold` — the action completes in the first (1 − hold) of the span and
    // the picture rests for the remainder.
    // Extended 2026-09-04 ("slow down after 'taken apart', add pauses"): the
    // tail legs rest too.
    for (const id of ['dock', 'prime', 'trigger', 'zipper', 'pore', 'recycle', 'refill', 'load'] as const) {
      const span = STAGE_SPANS.find((s) => s.id === id)!
      expect(span.hold, id).toBeGreaterThan(0)
      const doneAt = uAtThrough(id, 1)
      expect(doneAt, id).toBeLessThan(span.to)
      // Finished at the ramp's end, and STILL for the whole rest of the leg.
      expect(through(doneAt, id)).toBeCloseTo(1, 9)
      expect(through((doneAt + span.to) / 2, id)).toBe(1)
    }
    // A leg without a hold is unchanged: its ramp fills the whole span.
    const approach = STAGE_SPANS.find((s) => s.id === 'approach')!
    expect(approach.hold).toBe(0)
    expect(uAtThrough('approach', 1)).toBeCloseTo(approach.to, 9)
  })

  it('A2: the run opens UPSTREAM — the vesicle descends before anything touches it', () => {
    // The cycle's first leg is now the approach (user, 2026-09-03): undocked,
    // up in the crowd, coming down.
    expect(STAGES[0].id).toBe('approach')
    expect(descentAt(0)).toBe(0)
    const approach = STAGE_SPANS.find((s) => s.id === 'approach')!
    expect(descentAt(approach.to)).toBeCloseTo(1, 9)
    // Monotone on the way: a drift, not a bounce.
    let prev = 0
    for (let i = 0; i <= 100; i++) {
      const d = descentAt(approach.from + (approach.to - approach.from) * (i / 100))
      expect(d).toBeGreaterThanOrEqual(prev)
      prev = d
    }
    // And nothing presses it onto the wall during the approach or the tether.
    expect(pressedAt(STAGE_SPANS.find((s) => s.id === 'tether')!.to)).toBe(0)
  })

  it('A3: the tether catches by the lit badge, and hands over to the SNAREs', () => {
    const span = (id: string) => STAGE_SPANS.find((s) => s.id === id)!
    const mid = (id: string) => (span(id).from + span(id).to) / 2
    // Not attached at the start; holding through the tether and dock stages;
    // gone by the end of priming — the hand-over, as numbers.
    expect(tetherHoldAt(0)).toBe(0)
    expect(tetherHoldAt(mid('tether'))).toBeCloseTo(1, 9)
    expect(tetherHoldAt(span('dock').to)).toBeCloseTo(1, 9)
    expect(tetherHoldAt(span('prime').to)).toBe(0)
    // The badge: lit (GTP) all the way to docking, spent (GDP) after it.
    expect(gtpAt(mid('tether'))).toBe(1)
    expect(gtpAt(span('dock').to)).toBe(0)
    // And the spent Rab is extracted across priming.
    expect(rabGoneAt(span('dock').to)).toBe(0)
    expect(rabGoneAt(span('prime').to)).toBe(1)
  })

  it('A3: syntaxin is opened AT docking, and complexin clamps the primed rope', () => {
    const span = (id: string) => STAGE_SPANS.find((s) => s.id === id)!
    // Folded shut until the landing site; open once docked.
    expect(syntaxinOpenAt(span('dock').from)).toBe(0)
    expect(syntaxinOpenAt(span('dock').to)).toBeCloseTo(1, 9)
    // The clamp: absent through docking, on through the whole calcium count,
    // flicked off within the zip's first strokes (the sensor's own window).
    expect(clampAt(span('dock').to)).toBe(0)
    const trig = span('trigger')
    for (let i = 0; i <= 20; i++) {
      expect(clampAt(trig.from + (trig.to - trig.from) * (i / 20))).toBeCloseTo(1, 9)
    }
    const zipSpan = span('zipper')
    expect(clampAt(zipSpan.from + (zipSpan.to - zipSpan.from) * CLAMP_OFF)).toBe(0)
    // ⚠ While the clamp holds, the zip has not moved past primed — the clamp
    // is a hand ON the mechanism, not decoration.
    expect(zipAt(trig.to)).toBeCloseTo(PRIMED_ZIP, 6)
  })

  it('A1 (2026-09-03): the bag stays FULL until the membranes have fused — nothing crosses a sealed bilayer', () => {
    // The complaint: "NTs start leaving the vesicle too early (visually fly
    // through the membrane)." The pore ramp's first SINK_TOUCH is the
    // approach to contact; the mouth exists only beyond it, and the cargo may
    // only empty on the mouth's own schedule.
    const uFused = uAtMouthOpen(0)
    expect(mouthOpenAt(uFused)).toBeCloseTo(0, 9)
    for (let i = 0; i <= 60; i++) {
      expect(cargoAt(uFused * (i / 60))).toBeCloseTo(1, 9)
    }
    // The schedule and the state read one ramp: at the u booked for fraction
    // f, the mouth is exactly f open.
    for (const f of [0.1, 0.5, 0.9]) {
      expect(mouthOpenAt(uAtMouthOpen(f))).toBeCloseTo(f, 6)
    }
    // And it still empties completely within the pore leg.
    expect(cargoAt(STAGE_SPANS.find((s) => s.id === 'pore')!.to)).toBeCloseTo(0, 9)
  })

  it('A1+A2 (reuse round): the rope stays wound until NSF, and the coat lives retrieve→recycle', () => {
    const span = (id: string) => STAGE_SPANS.find((s) => s.id === id)!
    const mid = (id: string) => (span(id).from + span(id).to) / 2
    // Wound and intact right through retrieval — a spent rope loosening on
    // its own was the wrong cause; NSF (the recycle leg) is the cause.
    expect(zipAt(mid('retrieve'))).toBeCloseTo(1, 6)
    expect(disassembleAt(mid('retrieve'))).toBe(0)
    expect(disassembleAt(span('recycle').to)).toBeCloseTo(1, 9)
    expect(zipAt(span('recycle').to)).toBeCloseTo(0, 6)
    // The coat: absent before retrieval, fully assembled when the bud is
    // pinched, shed by the taking-apart's end.
    expect(coatAt(mid('collapse'))).toBe(0)
    expect(coatAt(span('retrieve').to)).toBeCloseTo(1, 6)
    expect(coatAt(span('recycle').to)).toBeCloseTo(0, 6)
  })

  it('A3+A4: the cargo goes out, the bubble stays empty until the TRADE, and ends full (2026-09-04)', () => {
    expect(cargoAt(0)).toBeCloseTo(1, 6)
    // Empty by the time it has flattened out…
    const colEnd = STAGE_SPANS.find((s) => s.id === 'collapse')!.to
    expect(cargoAt(colEnd)).toBeCloseTo(0, 6)
    // …and it STAYS empty through retrieval, recycling and the lift — nothing
    // refills a bag before the transporter starts trading (supersedes 20az's
    // "stays empty to the end": the trade is on stage now).
    const loadFrom = STAGE_SPANS.find((s) => s.id === 'load')!.from
    for (let i = 0; i <= 50; i++) {
      expect(cargoAt(colEnd + (loadFrom - colEnd) * (i / 50))).toBe(0)
    }
    // The load leg fills it back to exactly full: the closing frame is the
    // opening frame (user, 2026-09-04).
    expect(cargoAt(1)).toBeCloseTo(1, 6)
    // The badge story closes too: spent at docking, re-armed by the end.
    expect(gtpAt(1)).toBe(1)
    expect(rabGoneAt(1)).toBe(0)
    // And a new vesicle really is pinched back off the wall.
    expect(retrievedAt(1)).toBeCloseTo(1, 6)
  })

  it('A3: every value is finite everywhere, and none runs outside 0→1', () => {
    // Silent NaN is the fault, not the throw.
    for (let i = -20; i <= 120; i++) {
      const u = i / 100
      for (const [name, f] of [
        ['zip', zipAt],
        ['pore', poreAt],
        ['pressed', pressedAt],
        ['retrieved', retrievedAt],
      ] as const) {
        const v = f(u)
        expect(Number.isFinite(v), `${name} at ${u}`).toBe(true)
        expect(v, `${name} at ${u}`).toBeGreaterThanOrEqual(0)
        expect(v, `${name} at ${u}`).toBeLessThanOrEqual(1)
      }
      expect(Number.isFinite(cargoAt(u))).toBe(true)
      expect(Number.isInteger(sitesFilled(u))).toBe(true)
    }
    expect(through(0.5, 'prime')).toBeGreaterThanOrEqual(0)
  })

  it('A3: says which numbers are measured and which are not', () => {
    // "Say which numbers are calibrated, and which are not drawn."
    const said = [...SNARE_PARTS, ...SNARE_HONESTY].map((p) => p.text).join(' ')
    expect(said).toMatch(/MEASURED/)
    expect(said).toMatch(/NOT MEASURED/)
    expect(said).toContain(String(HILL_N))
    // The cast is named, on both sides of the join.
    expect(said).toMatch(/synaptobrevin/i)
    expect(said).toMatch(/syntaxin/i)
    expect(said).toMatch(/SNAP-25/i)
    expect(said).toMatch(/synaptotagmin/i)
    // A3 (2026-09-03): and the upstream cast too, with its own honesty — the
    // one drawn tether stands for a family, and the GTP timing is declared.
    expect(said).toMatch(/\bRab\b/)
    expect(said).toMatch(/GTP/)
    expect(said).toMatch(/tether/i)
    expect(said).toMatch(/Munc18/)
    expect(said).toMatch(/Munc13/)
    expect(said).toMatch(/complexin/i)
    expect(said).toMatch(/Rab effectors/)
    // A1/A5 (2026-09-03): the mirrored pair is explained as a slice through a
    // RING with an unsettled count, and the flat rope's afterlife (NSF) is
    // named rather than silently faded.
    expect(said).toMatch(/RING/)
    expect(said).toMatch(/not settled/i)
    expect(said).toMatch(/NSF/)
  })
})
