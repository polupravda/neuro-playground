import { describe, expect, it } from 'vitest'
import {
  PARTS,
  ENTRIES,
  entriesIn,
  inCourseOrder,
  notBuiltYet,
} from './contents'
import { FRONTIER_SHORT } from './neuron'
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
