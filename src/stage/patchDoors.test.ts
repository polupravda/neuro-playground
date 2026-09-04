import { describe, expect, it } from 'vitest'
import { membraneDrawers, patchDoors } from './patchDoors'
import { DEMOS } from '../state/demoStore'
import { ENTRIES } from '../core/contents'
import { ZOOM_TARGETS } from './layout'

describe('the doors on the patch', () => {
  it('carries every drawer exhibit the patch has — all six, together', () => {
    // They were split for a while: four pinned to structures on the picture,
    // and two — equilibrium potential and the spike train — left in the
    // column because they are not PLACES. That reasoning was entirely about
    // being pinned. A row in a corner points at nothing by design, so the
    // distinction stopped doing any work when the pins went (2026-08-28).
    // ⚠ THE DRAWERS WHOSE HOME IS THIS PATCH (2026-08-31). Every drawer used to
    // extend the membrane, so "all the drawers" and "this patch's drawers" were
    // the same set. D06 extends the synapse, and a shelf on the membrane that
    // claimed it would be pointing somewhere the child is not.
    const ids = patchDoors().map((d) => d.id)
    expect(new Set(ids)).toEqual(new Set(membraneDrawers().map((d) => d.id)))
  })

  it('takes its icons and full names from the ONE registry', () => {
    // A door and its drawer must not come to disagree about what it is
    // called, so neither is retyped.
    for (const door of patchDoors()) {
      const demo = DEMOS.find((d) => d.id === door.id)
      expect(door.icon).toBe(demo?.icon)
      expect(door.full).toBe(demo?.name)
    }
  })

  it('keeps the row labels short enough to sit six abreast', () => {
    for (const door of patchDoors()) {
      expect(door.label.length).toBeGreaterThan(2)
      expect(door.label.length).toBeLessThanOrEqual(13)
      // Short is not nameless: an icon ranks, it does not name, so every
      // chip still carries a word — and the full name is in `title`.
      expect(door.full.length).toBeGreaterThan(door.label.length - 1)
    }
  })

  it('has a second door for every one of them, in the contents', () => {
    // The rule the whole exercise was for: two entry points each, never one.
    const inMenu = new Set(ENTRIES.map((e) => e.to.drawer))
    for (const d of patchDoors()) expect(inMenu.has(d.id)).toBe(true)
  })

  it('meets them in the order the course does', () => {
    const ids = patchDoors().map((d) => d.id)
    expect(ids.indexOf('lipid')).toBeLessThan(ids.indexOf('channel'))
    expect(ids.indexOf('capacitor')).toBeLessThan(ids.indexOf('train'))
    // ⚠ The last door is no longer 'train': two benches were added after it
    // (2026-08-30) and the course meets them where they are in the list, not
    // at a fixed end. What the ORDER has to say is still checked above, and
    // now the two new ones too.
    expect(ids.indexOf('balance')).toBeLessThan(ids.indexOf('resting'))
    expect(ids.indexOf('resting')).toBeLessThan(ids.indexOf('train'))
  })
})

describe('every exhibit has more than one way in', () => {
  it('gives the patch clamp a door on the shelf, not only on the probe', () => {
    // It had exactly one door out on the picture — the magnifier on the probe
    // INSIDE the spike-train bench — which nobody finds unless they are
    // already there (user, 2026-08-28). It is about a patch of membrane, so
    // the patch's own shelf is where it belongs.
    expect(patchDoors().map((d) => d.id)).toContain('patch')
  })

  it('leaves no drawer with fewer than two doors', () => {
    // The rule the whole navigation exercise exists for. Every drawer must
    // appear in the contents AND somewhere you can reach by looking at the
    // picture.
    const onShelf = new Set<string>(patchDoors().map((d) => d.id))
    const inMenu = new Set(ENTRIES.map((e) => e.to.drawer))
    for (const demo of membraneDrawers()) {
      expect(inMenu.has(demo.id as never)).toBe(true)
      expect(onShelf.has(demo.id)).toBe(true)
    }
    // And a drawer that lives somewhere else still needs its two: the menu,
    // and a door drawn on the view it extends.
    for (const demo of DEMOS.filter((d) => d.drawer && d.home === 'synapse')) {
      expect(inMenu.has(demo.id as never)).toBe(true)
      expect(onShelf.has(demo.id)).toBe(false)
    }
  })
})

describe('the two benches added on 2026-08-30 have a second way in', () => {
  // The navigation rule: every view gets a menu entry AND a discovery entry.
  // "What sets the membrane voltage" is about a patch of membrane, so the
  // patch's own shelf is where its second one belongs.
  it('puts "what sets the membrane voltage" on the shelf', () => {
    const ids = patchDoors().map((d) => d.id)
    expect(ids).toContain('resting')
  })

  it('A3: passive spread is a PLACE, so its second door is on the neuron', () => {
    // ⚠ "You've placed the bench in the drawer. Instead, let's follow 'Axonal
    // conduction and myelin' pattern, and add another entry point: magnifying
    // glass on the 'big neuron'" (user, 2026-08-31).
    //
    // The two-doors rule does not change; where the second door IS changes.
    // Off the patch's shelf entirely — it is not about this patch — and onto
    // the axon, where a child can see which stretch is being talked about.
    expect(patchDoors().map((d) => d.id)).not.toContain('leaky')

    const row = ENTRIES.find((e) => e.id === 'leaky')!
    expect(row.to.drawer).toBeNull()
    expect(row.to.zoom).toBe('axon-passive')
    // And the marker it flies to really exists on the cell.
    expect(ZOOM_TARGETS.map((t) => t.id)).toContain('axon-passive')
  })

  it('names them from the exhibit registry, not by retyping', () => {
    for (const id of ['resting'] as const) {
      const door = patchDoors().find((d) => d.id === id)!
      expect(door.icon.length).toBeGreaterThan(0)
      expect(door.full.length).toBeGreaterThan(6)
      // The short label is what fits on the shelf; the full name is the
      // exhibit's own, so a door and its drawer cannot come to disagree.
      expect(door.label.length).toBeLessThanOrEqual(door.full.length)
    }
  })
})
