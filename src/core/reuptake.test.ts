import { describe, expect, it } from 'vitest'
import {
  ASTROCYTE_SHARE_RANGE,
  REUPTAKE_HONESTY,
  REUPTAKE_PARTS,
  ASTRO_DOORS,
  DOTS,
  DOT_COUNT,
  EAAT_FARE,
  REUPTAKE_SPANS,
  REUPTAKE_STAGES,
  cleftLoad,
  dotAt,
  reuptakeStageAt,
  routeCounts,
  stockedCount,
  through,
  uAtThrough,
} from './reuptake'

/** Dense sampling of a whole run. */
const sweep = (n = 401) => Array.from({ length: n }, (_, i) => i / (n - 1))

describe('D17 — the transmitter is RECOVERED, not consumed', () => {
  it('A8: every molecule is accounted for at the end — nothing is lost', () => {
    // The conservation this drawer exists to show. A dot that simply stopped
    // being drawn would teach that transmitter is used up.
    expect(stockedCount(1)).toBe(DOT_COUNT)
    expect(DOTS).toHaveLength(DOT_COUNT)
    expect(new Set(DOTS.map((d) => d.id)).size).toBe(DOT_COUNT)
  })

  it('A8: the gap fills, empties, and empties because something CARRIED it', () => {
    expect(cleftLoad(0)).toBe(1)
    expect(cleftLoad(1)).toBe(0)
    // Monotonic: the gap never refills, so nothing is quietly re-released.
    const loads = sweep().map(cleftLoad)
    for (let i = 1; i < loads.length; i++) {
      expect(loads[i]).toBeLessThanOrEqual(loads[i - 1])
    }
    // And it empties by CATCHING: every dot that has left the cleft is one
    // that threaded a door.
    expect(DOTS.every((d) => dotAt(d, 1).taken)).toBe(true)
  })

  it('A8: the declared astrocytic split is the split that is drawn', () => {
    // ⚠ A number that lived only in the picture would be a claim nothing
    // could check. The drawing reads this; so does this test.
    const counts = routeCounts()
    expect(counts.astrocyte + counts.neuron).toBe(DOT_COUNT)
    // ⚠ Inside the BAND the literature gives (80–90%), not equal to a single
    // tidy number: a whole-molecule picture can only draw the splits its dot
    // count allows, and asserting 0.8 while drawing 6:7 = 86% would be the
    // app claiming a precision it does not have.
    const drawn = counts.astrocyte / DOT_COUNT
    expect(drawn).toBeGreaterThanOrEqual(ASTROCYTE_SHARE_RANGE.low)
    expect(drawn).toBeLessThanOrEqual(ASTROCYTE_SHARE_RANGE.high)
    // The minority route is VISIBLE — not rounded away to nothing.
    expect(counts.neuron).toBeGreaterThan(0)
    expect(counts.astrocyte).toBeGreaterThan(counts.neuron)
  })

  it('A8: a dot changes KIND between the two enzymes, and only there', () => {
    const astro = DOTS.find((d) => d.route === 'astrocyte')!
    const kinds = sweep().map((u) => dotAt(astro, u).species)
    // It starts as transmitter, becomes something else, and comes back.
    expect(kinds[0]).toBe('glutamate')
    expect(kinds[kinds.length - 1]).toBe('glutamate')
    expect(kinds).toContain('glutamine')
    // Exactly ONE spell as glutamine — it does not flicker between kinds.
    let runs = 0
    for (let i = 0; i < kinds.length; i++) {
      if (kinds[i] === 'glutamine' && kinds[i - 1] !== 'glutamine') runs++
    }
    expect(runs).toBe(1)
  })

  it('A8: what the NEURON takes back never converts — it is already home', () => {
    const mine = DOTS.find((d) => d.route === 'neuron')!
    for (const u of sweep()) expect(dotAt(mine, u).species).toBe('glutamate')
  })

  it('A8: every dot moves forward only — one continuous path, never a jump back', () => {
    for (const dot of DOTS) {
      const p = sweep().map((u) => dotAt(dot, u).progress)
      for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThanOrEqual(p[i - 1])
      expect(p[0]).toBeCloseTo(0, 6)
      expect(p[p.length - 1]).toBeCloseTo(1, 6)
    }
  })
})

describe('D17’s clock follows the interest', () => {
  it('A8: the stages run in order and fill the window exactly once', () => {
    expect(REUPTAKE_SPANS[0].from).toBeCloseTo(0, 9)
    expect(REUPTAKE_SPANS[REUPTAKE_SPANS.length - 1].to).toBeCloseTo(1, 9)
    for (let i = 1; i < REUPTAKE_SPANS.length; i++) {
      expect(REUPTAKE_SPANS[i].from).toBeCloseTo(REUPTAKE_SPANS[i - 1].to, 9)
    }
    expect(REUPTAKE_SPANS.map((s) => s.id)).toEqual(REUPTAKE_STAGES.map((s) => s.id))
  })

  it('A8: the CATCH gets the most screen time — it is the payload', () => {
    const caught = REUPTAKE_STAGES.find((s) => s.id === 'caught')!
    for (const st of REUPTAKE_STAGES) {
      if (st.id !== 'caught') expect(caught.share).toBeGreaterThan(st.share)
    }
  })

  it('A8: a leg with a hold finishes its action before its span ends', () => {
    // The still beat: `through` reaches 1 while the stage is still running,
    // so the picture rests before the next event begins.
    const held = REUPTAKE_SPANS.find((s) => s.hold > 0)!
    expect(through(held.to - 1e-6, held.id)).toBe(1)
    expect(
      through(held.from + (held.to - held.from) * (1 - held.hold) * 0.5, held.id),
    ).toBeLessThan(1)
  })

  it('A8: a label stop lands inside the leg it names', () => {
    for (const span of REUPTAKE_SPANS) {
      const u = uAtThrough(span.id, 0.5)
      expect(u).toBeGreaterThanOrEqual(span.from)
      expect(u).toBeLessThanOrEqual(span.to)
      expect(reuptakeStageAt(u).stage.id).toBe(span.id)
    }
  })

  it('A8: every stage says what it is and what to watch', () => {
    for (const st of REUPTAKE_STAGES) {
      expect(st.title.length).toBeGreaterThan(0)
      expect(st.watch.length).toBeGreaterThan(30)
    }
  })
})

describe('D17’s declared facts', () => {
  it('A8: the EAAT fare is the settled stoichiometry', () => {
    // 3 Na⁺ and 1 H⁺ in, 1 K⁺ out, per glutamate. Not adjustable to taste.
    expect(EAAT_FARE).toEqual({ naIn: 3, hIn: 1, kOut: 1 })
  })

  it('A8: there are more astrocyte doors than neuronal ones', () => {
    // The picture must not say the two routes are equally equipped.
    expect(ASTRO_DOORS).toBeGreaterThan(1)
    for (const d of DOTS) {
      if (d.route === 'astrocyte') expect(d.door).toBeLessThan(ASTRO_DOORS)
      else expect(d.door).toBe(0)
    }
  })
})

describe('D17 says WHICH transmitter its claim is about (2026-09-04)', () => {
  // The astrocyte claim is true of glutamate and FALSE of several other
  // transmitters — GABA and the monoamines are largely recovered by the
  // neuron that released them. Unqualified beside a synapse the app never
  // named, "the astrocyte does most of the clearing" reads as a fact about
  // transmitters in general, which is the misconception this drawer exists
  // to correct, arriving by the back door.
  const said = [...REUPTAKE_PARTS, ...REUPTAKE_HONESTY].map((p) => p.text).join(' ')

  it('A2: it names the transmitter its story is about', () => {
    expect(said.toLowerCase()).toContain('glutamate')
  })

  it('A2: and says plainly that other transmitters do it differently', () => {
    // The specificity qualifier. Without it the drawer over-generalises.
    expect(said.toLowerCase()).toMatch(
      /other chemicals|different transmitter|not the rule/,
    )
  })

  it('A2: the measured split is stated AS being about glutamate', () => {
    const measured = REUPTAKE_HONESTY.map((p) => p.text).find((t) =>
      t.includes('MEASURED'),
    )!
    expect(measured.toLowerCase()).toContain('glutamate')
  })
})
