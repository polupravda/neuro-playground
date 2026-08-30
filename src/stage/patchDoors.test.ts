import { describe, expect, it } from 'vitest'
import { patchDoors } from './patchDoors'
import { DEMOS } from '../state/demoStore'
import { ENTRIES } from '../core/contents'

describe('the doors on the patch', () => {
  it('carries every drawer exhibit the patch has — all six, together', () => {
    // They were split for a while: four pinned to structures on the picture,
    // and two — equilibrium potential and the spike train — left in the
    // column because they are not PLACES. That reasoning was entirely about
    // being pinned. A row in a corner points at nothing by design, so the
    // distinction stopped doing any work when the pins went (2026-08-28).
    const ids = patchDoors().map((d) => d.id)
    expect(new Set(ids)).toEqual(
      new Set(DEMOS.filter((d) => d.drawer).map((d) => d.id)),
    )
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
    expect(ids[ids.length - 1]).toBe('train')
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
    for (const demo of DEMOS.filter((d) => d.drawer)) {
      expect(inMenu.has(demo.id as never)).toBe(true)
      expect(onShelf.has(demo.id)).toBe(true)
    }
  })
})
