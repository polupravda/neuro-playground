import { describe, expect, it } from 'vitest'
import { ION_KINDS, IONS, particlesFor, type IonKind, type Side } from '../core/ions'
import type { IonCounts } from '../state/ionStore'
import { MEMBRANE_PX, MEMBRANE_ZOOM, PX_PER_UM } from './layout'
import { ION_SCALE, ionAt, ionCloud, ionRadius, minDepth } from './ions'

const real: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

const empty: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = { outside: 0, inside: 0 }
  return acc
}, {} as IonCounts)

describe('ion sizes on screen', () => {
  it('draws every ion smaller than a lipid head, as in life', () => {
    for (const kind of ION_KINDS) {
      // A lipid head is 1 nm across; every hydrated ion here is under that.
      // (In the scene's own scale, not a hardcoded 4.4 px/µm — the honest
      // scale is solved from the traced soma since 2026-09-04.)
      expect(ionRadius(kind) * 2).toBeLessThan(0.001 * PX_PER_UM)
    }
  })

  it('makes hydrated sodium the bigger ball, though the bare atom is smaller', () => {
    expect(ionRadius('na')).toBeGreaterThan(ionRadius('k'))
  })

  it('only becomes visible after the bilayer does, and at a workable size', () => {
    expect(ION_SCALE).toBeGreaterThan(500)
    expect(ionRadius('na') * 2 * ION_SCALE).toBeGreaterThan(3)
    expect(ionRadius('na') * 2 * MEMBRANE_ZOOM).toBeGreaterThan(6)
  })
})

describe('nothing may enter the membrane', () => {
  it('keeps every resting ion clear of the bilayer', () => {
    for (const side of ['outside', 'inside'] as Side[]) {
      for (const ion of ionCloud(real, side)) {
        expect(ion.depth).toBeGreaterThan(MEMBRANE_PX / 2 + ion.radius)
      }
    }
  })

  it('keeps every jiggling ion clear of it too, at every moment', () => {
    for (const side of ['outside', 'inside'] as Side[]) {
      for (const ion of ionCloud(real, side)) {
        for (let ms = 0; ms < 12_000; ms += 90) {
          expect(ionAt(ion, ms).depth).toBeGreaterThanOrEqual(minDepth(ion.radius))
        }
      }
    }
  })
})

describe('ionCloud', () => {
  it('draws exactly the requested crowd', () => {
    const outside = ionCloud(real, 'outside')
    const inside = ionCloud(real, 'inside')
    const count = (list: typeof outside, kind: IonKind) =>
      list.filter((i) => i.kind === kind).length
    for (const kind of ION_KINDS) {
      expect(count(outside, kind)).toBe(real[kind].outside)
      expect(count(inside, kind)).toBe(real[kind].inside)
    }
  })

  it('puts more sodium outside and more potassium inside', () => {
    const outside = ionCloud(real, 'outside')
    const inside = ionCloud(real, 'inside')
    expect(outside.filter((i) => i.kind === 'na').length).toBeGreaterThan(
      inside.filter((i) => i.kind === 'na').length,
    )
    expect(inside.filter((i) => i.kind === 'k').length).toBeGreaterThan(
      outside.filter((i) => i.kind === 'k').length,
    )
  })

  it('leaves calcium out of the cytoplasm entirely', () => {
    expect(ionCloud(real, 'inside').some((i) => i.kind === 'ca')).toBe(false)
    expect(ionCloud(real, 'outside').some((i) => i.kind === 'ca')).toBe(true)
  })

  it('mixes the species in space rather than sorting them into bands', () => {
    const cloud = ionCloud(real, 'outside')
    let mixedNeighbours = 0
    for (const ion of cloud) {
      let nearest = cloud[0]
      let best = Infinity
      for (const other of cloud) {
        if (other === ion) continue
        const d = Math.hypot(other.along - ion.along, other.depth - ion.depth)
        if (d < best) {
          best = d
          nearest = other
        }
      }
      if (nearest.kind !== ion.kind) mixedNeighbours += 1
    }
    expect(mixedNeighbours).toBeGreaterThan(cloud.length / 3)
  })

  it('spreads the crowd over the whole patch, not one corner', () => {
    const cloud = ionCloud(real, 'outside')
    const alongs = cloud.map((i) => i.along)
    const depths = cloud.map((i) => i.depth)
    expect(Math.min(...alongs)).toBeLessThan(0)
    expect(Math.max(...alongs)).toBeGreaterThan(0)
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(0)
  })

  it('copes with an emptied side', () => {
    expect(ionCloud(empty, 'outside')).toEqual([])
    expect(ionCloud(empty, 'inside')).toEqual([])
  })

  it('is deterministic — the same crowd every call', () => {
    expect(ionCloud(real, 'outside')).toEqual(ionCloud(real, 'outside'))
  })
})

describe('changing one count must not disturb the rest', () => {
  const withNa = (outside: number): IonCounts => ({
    ...real,
    na: { outside, inside: real.na.inside },
  })

  it('leaves every existing ion exactly where it was when one is added', () => {
    const before = ionCloud(real, 'outside')
    const after = ionCloud(withNa(real.na.outside + 1), 'outside')
    expect(after).toHaveLength(before.length + 1)
    for (const ion of before) expect(after).toContainEqual(ion)
  })

  it('leaves every other ion where it was when one is removed', () => {
    const before = ionCloud(real, 'outside')
    const after = ionCloud(withNa(real.na.outside - 1), 'outside')
    expect(after).toHaveLength(before.length - 1)
    for (const ion of before.filter((i) => i.kind !== 'na')) {
      expect(after).toContainEqual(ion)
    }
    // And the surviving sodium keeps its own places, rather than reshuffling.
    const survivors = after.filter((i) => i.kind === 'na')
    expect(survivors).toEqual(
      before.filter((i) => i.kind === 'na').slice(0, survivors.length),
    )
  })

  it('never changes an untouched ion’s jiggle rhythm, so nothing twitches', () => {
    const before = ionCloud(real, 'outside').filter((i) => i.kind === 'k')
    const after = ionCloud(withNa(1), 'outside').filter((i) => i.kind === 'k')
    expect(after.map((i) => i.seed)).toEqual(before.map((i) => i.seed))
  })

  it('keeps the two sides independent of each other', () => {
    const before = ionCloud(real, 'inside')
    const after = ionCloud(withNa(3), 'inside')
    expect(after).toEqual(before)
  })
})

describe('ionAt', () => {
  it('keeps every ion moving — they are never still', () => {
    const ion = ionCloud(real, 'outside')[0]
    const a = ionAt(ion, 0)
    const b = ionAt(ion, 700)
    expect(Math.hypot(a.along - b.along, a.depth - b.depth)).toBeGreaterThan(0)
  })

  it('keeps each one near its own patch — jiggling is not travelling', () => {
    for (const ion of ionCloud(real, 'outside')) {
      for (let ms = 0; ms < 12_000; ms += 130) {
        const now = ionAt(ion, ms)
        expect(Math.abs(now.along - ion.along)).toBeLessThan(ion.radius * 2)
      }
    }
  })
})
