import { describe, expect, it } from 'vitest'
import {
  PARTS,
  PLANNED,
  ENTRIES,
  entriesIn,
  inCourseOrder,
  notBuiltYet,
} from './contents'
import { FRONTIER_SHORT } from './neuron'
import { RETRIEVALS } from './retrieval'
import { ZOOM_TARGETS } from '../stage/layout'
import { planFor, travels } from '../state/contentsNav'

describe('the contents', () => {
  it('follows the course, and every part is there', () => {
    expect(PARTS.map((p) => p.id)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'])
    // Every part says what it is about, so a child can be read the shape of
    // the whole course even where nothing in it is built.
    for (const p of PARTS) {
      expect(p.title.length).toBeGreaterThan(4)
      expect(p.gist.length).toBeGreaterThan(20)
    }
  })

  it('lists entries in lecture order inside each part', () => {
    for (const p of PARTS) {
      const lectures = entriesIn(p.id).map((e) => e.lecture)
      expect([...lectures].sort((a, b) => a - b)).toEqual(lectures)
    }
    expect(inCourseOrder().length).toBe(ENTRIES.length)
  })

  it('sends every entry somewhere that EXISTS', () => {
    // A menu row that goes nowhere is worse than no row: the whole point of
    // this is that nothing has to be found by accident.
    const zooms = new Set(ZOOM_TARGETS.map((t) => t.id))
    for (const e of ENTRIES) {
      if (e.to.zoom !== null) expect(zooms.has(e.to.zoom)).toBe(true)
      expect(e.icon.length).toBeGreaterThan(0)
      expect(e.title.length).toBeGreaterThan(3)
      // A name for the adult AND a question for the kid — words have
      // audiences, and a menu row is read by both of them.
      expect(e.asks).toMatch(/\?$/)
    }
  })

  it('has no duplicate ids and no two rows going to the same place', () => {
    expect(new Set(ENTRIES.map((e) => e.id)).size).toBe(ENTRIES.length)
    const dests = ENTRIES.map((e) => `${e.to.zoom}|${e.to.drawer}|${e.to.then ?? ''}`)
    expect(new Set(dests).size).toBe(dests.length)
  })

  it('reaches every drawer the app has built', () => {
    // The audit that matters: if an exhibit exists and the menu does not name
    // it, it is still findable only by accident.
    const reached = new Set(ENTRIES.map((e) => e.to.drawer).filter(Boolean))
    for (const drawer of [
      'balance',
      'train',
      'lipid',
      'permea',
      'capacitor',
      'channel',
      'filter',
      'patch',
      'scales',
    ]) {
      expect(reached.has(drawer as never)).toBe(true)
    }
  })

  it('keeps the claim about what is built in ONE place', () => {
    // The FRONTIER rule: a claim about what the app contains rots, so it is
    // interpolated and never retyped.
    expect(notBuiltYet()).toContain(FRONTIER_SHORT)
  })

  it('marks the entries the course does not name', () => {
    // The structure is the lecture course ENRICHED — several things this app
    // teaches are not lecture headings, and they are flagged rather than
    // smuggled in.
    const extras = ENTRIES.filter((e) => e.extra).map((e) => e.id)
    expect(extras).toContain('whole-cell')
    expect(extras).toContain('tour')
    expect(extras.length).toBeGreaterThan(1)
  })
})

describe('going there', () => {
  it('flies to the place BEFORE opening the exhibit', () => {
    // This is what keeps "spatial navigation, not pages" true with a menu in
    // the app. If the drawer ever opened first, the menu would be a page
    // switcher and the geography would stop being taught.
    const legs = planFor({ zoom: 'dendrite-membrane', drawer: 'lipid' }, null)
    expect(legs[0]).toEqual({ kind: 'zoom-to', arg: 'dendrite-membrane' })
    expect(legs[legs.length - 1]).toEqual({ kind: 'open', arg: 'lipid' })
    expect(travels(legs)).toBe(true)
  })

  it('does not fly anywhere it already is', () => {
    // Arriving where you already are must not stall for a second on an empty
    // flight before the drawer opens.
    const legs = planFor({ zoom: 'dendrite-membrane', drawer: 'channel' }, 'dendrite-membrane')
    expect(legs).toEqual([{ kind: 'open', arg: 'channel' }])
    expect(travels(legs)).toBe(false)
  })

  it('zooms OUT for the entries that are about the whole cell', () => {
    expect(planFor({ zoom: null, drawer: null }, 'axon-signal')).toEqual([{ kind: 'zoom-out' }])
    // …and does nothing at all if the camera is already out there.
    expect(planFor({ zoom: null, drawer: null }, null)).toEqual([])
  })

  it('sets a mode before opening', () => {
    const race = planFor({ zoom: 'axon-signal', drawer: null, then: 'race' }, null)
    expect(race).toEqual([{ kind: 'zoom-to', arg: 'axon-signal' }, { kind: 'race' }])
  })

  it('opens the three-sizes exhibit like any other drawer', () => {
    // It was a guided tour driven by a side effect, then a switch on the
    // canvas; it draws its own three views now, so it is simply a drawer
    // (user, 2026-08-28).
    const row = ENTRIES.find((e) => e.id === 'tour')!
    expect(row.to.drawer).toBe('scales')
    expect(planFor(row.to, 'hillock')).toEqual([
      { kind: 'zoom-out' },
      { kind: 'open', arg: 'scales' },
    ])
  })

  it('plans a route for every entry, and none of them is empty by accident', () => {
    for (const e of ENTRIES) {
      const legs = planFor(e.to, 'hillock')
      expect(legs.length).toBeGreaterThan(0)
    }
  })
})

describe('A2: the planned rows, and how they stay honest', () => {
  it('goes nowhere — inert by construction, not by styling', () => {
    // ⚠ "Make them inactive" (user, 2026-08-31). A greyed-out button that
    // still navigates is the worst of both, so the guard is on the DATA: a
    // planned row has no destination at all, and there is nothing for a stray
    // click to do even if the markup forgot to disable it.
    for (const e of PLANNED) {
      expect(e.planned).toBe(true)
      expect(e.to).toBeNull()
    }
    // And the two flags cannot come apart: planned ⇔ no destination.
    for (const e of [...ENTRIES, ...PLANNED]) {
      expect(e.planned === true).toBe(e.to === null)
    }
  })

  it('never lists as planned something the app already reaches', () => {
    // The rot this replaces the old "list only what exists" rule with. A
    // planned row claims what the SPEC contains; the moment an exhibit is
    // built, its promise has to come off the list or the menu is lying.
    const built = new Set(ENTRIES.map((e) => e.id))
    const titles = new Set(ENTRIES.map((e) => e.title.toLowerCase()))
    for (const e of PLANNED) {
      expect(built.has(e.id)).toBe(false)
      expect(titles.has(e.title.toLowerCase())).toBe(false)
    }
    expect(new Set(PLANNED.map((e) => e.id)).size).toBe(PLANNED.length)
    // Every planned row carries the spec ID it came from, and no two share one.
    const specs = PLANNED.map((e) => e.spec!)
    expect(specs.every((s) => /^[A-Z]\d{2}$/.test(s))).toBe(true)
    expect(new Set(specs).size).toBe(specs.length)
  })

  it('reads like a real row, because it is one', () => {
    // "Make it look as similar to active chapters as the plan allows" — so a
    // planned row is held to the SAME rules as a built one: an icon for the
    // kid, a name for the adult, a question either can be asked.
    for (const e of PLANNED) {
      expect(e.icon.length).toBeGreaterThan(0)
      expect(e.title.length).toBeGreaterThan(3)
      expect(e.asks).toMatch(/\?$/)
      expect(PARTS.map((p) => p.id)).toContain(e.part)
    }
  })

  it('gives every Part something to show', () => {
    // The whole reason the user asked: an overview. A Part with neither a
    // built row nor a planned one is a hole in the plan, not a tidy menu.
    for (const part of PARTS) {
      expect(entriesIn(part.id).length).toBeGreaterThan(0)
    }
    // And the two lists interleave by lecture rather than sitting in blocks:
    // Part II's planned rows come after its built ones because their lectures
    // are later, not because they are planned.
    const II = entriesIn('II')
    expect(II.map((e) => e.lecture)).toEqual([...II.map((e) => e.lecture)].sort((a, b) => a - b))
  })

  it('A1 (21c-3n): the synapse row names the round trip, and S14 sits with the machinery it deepens', () => {
    // ⚠ (user, 2026-09-06: "rename 'the synapse: arrival to binding' to reflect
    // updated demo", and "place it closer to 'Vesicles & the SNARE machinery',
    // we will display it in a drawer".)
    const III = entriesIn('III')
    const synapse = III.find((e) => e.id === 'synapse')
    expect(synapse).toBeDefined()
    // ⚠ THE ROW MUST NOT PROMISE AN ENDING THE RUN NO LONGER HAS. Since 21c the
    // demo goes past the receptors, round the glutamate–glutamine loop, and
    // closes on the frame it opened with — so neither the name nor the question
    // may still stop at binding.
    expect(synapse?.title).not.toMatch(/binding/i)
    expect(synapse?.asks).not.toMatch(/binding/i)
    // ⚠ AND S14 IS THE ROW AFTER THE SNARE BENCH. The menu is sorted by
    // lecture, so the lecture it is filed under IS its position: it was filed
    // under 10, as a journey leg of its own, and it is a deeper look at the
    // machinery this view already runs.
    const i = III.findIndex((e) => e.id === 's14')
    expect(i, 'S14 has left the menu').toBeGreaterThan(0)
    expect(III[i - 1].id, 'S14 is not beside the SNARE bench').toBe('snare')
    // ⚠ BUILT NOW (21c-4), and built as what the move said it was: a DRAWER
    // over the view it deepens, not a place of its own. It was a promise with
    // `to: null` until 2026-09-06.
    expect(III[i].planned).toBeFalsy()
    expect(III[i].to).toEqual({ zoom: 'outgoing-synapse', drawer: 's14' })
    // ⚠ AND ITS NAME IS WHAT IS BEHIND IT (21c-4d, user: "the name says
    // clearance and recycling. But what I see is the type of vesicle merge
    // mechanisms"). "Clearance & recycling" covers about sixteen mechanisms;
    // this exhibit shows THREE, all from the recycling half, and every one of
    // the clearance ones is the round trip's job already. A row that promises a
    // topic and opens a corner of it is a claim about the app that has rotted.
    expect(RETRIEVALS.length, 'the exhibit grew past the fork').toBe(3)
    expect(III[i].title, 'the row promises clearance').not.toMatch(/clearance/i)
    expect(III[i].asks, 'the question promises clearance').not.toMatch(/clearance/i)
  })

  it('keeps `inCourseOrder` to what a child can actually reach', () => {
    // Other code walks this to audit doors; a promise in it would be counted
    // as an exhibit.
    expect(inCourseOrder().every((e) => e.to !== null)).toBe(true)
    expect(inCourseOrder().length).toBe(ENTRIES.length)
  })
})

