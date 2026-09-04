import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { HALF_MEM } from './bilayer'
import { drawAquaporin, aquaporinHalfWidth } from './aquaporin'
import { leakHalfWidth } from './leakChannel'

const base = {
  cx: 0,
  midY: 0,
  halfHeight: HALF_MEM,
  species: '#60a5fa',
  speciesDark: '#1d4ed8',
}

describe('the aquaporin is not an ion channel', () => {
  it('draws with real colours and finite numbers', () => {
    const c = strictCanvas()
    drawAquaporin(c.ctx, base)
    expect(c.calls.filter((k) => k === 'fill').length).toBeGreaterThanOrEqual(2)
    expect(c.calls).toContain('stroke')
  })

  it('has a WAIST — the pore is narrower in the middle than at its mouths', () => {
    // ⚠ The whole mechanism, and the thing the generic channel drawing did not
    // have (user, 2026-08-30). The constriction is why water goes through in
    // single file and why a hydrated sodium ion cannot follow it. A
    // parallel-sided pore would delete the reason this protein works.
    const c = strictCanvas()
    drawAquaporin(c.ctx, base)
    // The narrowest drawn point either side of the axis, and the widest — read
    // off the picture rather than off the constants, so a change to the
    // drawing that flattened the pore fails here.
    const inner = c.points.filter((p) => Math.abs(p.x) < aquaporinHalfWidth(HALF_MEM) * 0.9)
    const atWaist = inner.filter((p) => Math.abs(p.y) < HALF_MEM * 0.25)
    const atMouth = inner.filter((p) => Math.abs(p.y) > HALF_MEM * 0.9)
    expect(atWaist.length).toBeGreaterThan(0)
    expect(atMouth.length).toBeGreaterThan(0)
    const waist = Math.min(...atWaist.map((p) => Math.abs(p.x)))
    const mouth = Math.max(...atMouth.map((p) => Math.abs(p.x)))
    expect(waist).toBeLessThan(mouth * 0.5)
  })

  it('has NOTHING that moves — no gate, no openness at all', () => {
    // An aquaporin is open all the time. There is deliberately no `open`
    // parameter: an option that can only take one value is an invitation to
    // animate something that does not animate.
    const a = strictCanvas()
    const b = strictCanvas()
    drawAquaporin(a.ctx, base)
    drawAquaporin(b.ctx, base)
    expect(a.points).toEqual(b.points)
    expect('open' in base).toBe(false)
  })

  it('is a different silhouette from any of the ion doors', () => {
    // It was drawn with the ion channels' shape, which said it was one of
    // them. It is squatter, and its pore pinches where theirs do not.
    expect(aquaporinHalfWidth(HALF_MEM)).not.toBeCloseTo(leakHalfWidth(HALF_MEM), 2)
  })

  it('scales with the wall it is put in', () => {
    // A result that does not change when the input changes is a broken
    // parameter.
    expect(aquaporinHalfWidth(20)).toBeGreaterThan(aquaporinHalfWidth(10))
    const small = strictCanvas()
    const big = strictCanvas()
    drawAquaporin(small.ctx, { ...base, halfHeight: 8 })
    drawAquaporin(big.ctx, { ...base, halfHeight: 24 })
    const span = (c: ReturnType<typeof strictCanvas>) =>
      Math.max(...c.points.map((p) => Math.abs(p.y)))
    expect(span(big)).toBeGreaterThan(span(small) * 2)
  })
})
