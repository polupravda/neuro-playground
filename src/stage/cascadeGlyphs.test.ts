import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { CAMK_SUBUNITS, CAM_SEATS, drawCaMKII, drawCalmodulin } from './cascadeGlyphs'
import { GLOSSY_COLORS } from './particleStyle'
import { CAM_SITES } from '../core/spine'

const paint = (fn: (c: ReturnType<typeof strictCanvas>) => void) => {
  const c = strictCanvas()
  fn(c)
  return c
}

describe('S13 — calmodulin and CaMKII', () => {
  it('A2: calmodulin shows FOUR seats, because four is the lesson', () => {
    // ⚠ THE SHAPE IS THE SCIENCE. Four calcium sites is exactly why the trigger
    // is a fourth power, so the drawing and the model must quote ONE number —
    // a glyph with three seats beside a model with four would be the app
    // teaching two different things about the same protein.
    expect(CAM_SEATS, 'the drawing and the model disagree about calmodulin')
      .toBe(CAM_SITES)
    const empty = paint((c) => drawCalmodulin(c.ctx, { x: 0, y: 0, r: 40, ca: 0 }))
    const full = paint((c) => drawCalmodulin(c.ctx, { x: 0, y: 0, r: 40, ca: 1 }))
    // Every seat is drawn empty or full — the sockets are always there.
    const sockets = empty.calls.filter((n) => n === 'arc').length
    expect(sockets, 'the seats are not drawn at all').toBeGreaterThanOrEqual(CAM_SEATS)
    // …and filling them adds calcium, which nothing else here is painted in.
    const ca = (c: ReturnType<typeof strictCanvas>) =>
      c.styles.filter((x) => x === GLOSSY_COLORS.ca.light || x === GLOSSY_COLORS.ca.mid).length
    expect(ca(full), 'a full calmodulin holds no calcium').toBeGreaterThan(ca(empty))
  })

  it('A2: the seats fill IN ORDER, so the count can be read part-way', () => {
    const held = (ca: number) =>
      paint((c) => drawCalmodulin(c.ctx, { x: 0, y: 0, r: 40, ca })).styles.filter(
        (x) => x === GLOSSY_COLORS.ca.light,
      ).length
    expect(held(0), 'it holds calcium before any has arrived').toBe(0)
    expect(held(0.5), 'half-full holds nothing').toBeGreaterThan(0)
    expect(held(1), 'full holds no more than half-full').toBeGreaterThan(held(0.5))
  })

  it('A2: CaMKII is a RING of subunits — which is why it is a switch', () => {
    // Neighbours round the ring turn each other on. Drawn as one blob, there
    // would be nothing to explain why it latches.
    expect(CAMK_SUBUNITS).toBeGreaterThan(3)
    const off = paint((c) => drawCaMKII(c.ctx, { x: 0, y: 0, r: 40, lit: 0 }))
    const on = paint((c) => drawCaMKII(c.ctx, { x: 0, y: 0, r: 40, lit: 1 }))
    // One leg drawn per subunit, lit or not.
    expect(off.calls.filter((n) => n === 'moveTo').length).toBeGreaterThanOrEqual(CAMK_SUBUNITS)
    // ⚠ COUNTED BY WARMTH, not by an exact colour. A lit subunit is `mix`ed
    // toward calcium pink, and `mix` returns a blended `rgb(...)` — so looking
    // for the literal ink found nothing however lit the ring was, and the guard
    // passed on zero against zero. Pink leans red of blue; slate does not.
    const warm = (c: ReturnType<typeof strictCanvas>) =>
      c.styles.filter((x) => {
        const m = x.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
        return m !== null && Number(m[1]) > Number(m[3]) + 20
      }).length
    expect(warm(on), 'a switched-on CaMKII looks the same as an off one')
      .toBeGreaterThan(warm(off))
    const half = paint((c) => drawCaMKII(c.ctx, { x: 0, y: 0, r: 40, lit: 0.5 }))
    expect(warm(half)).toBeGreaterThan(warm(off))
    expect(warm(half)).toBeLessThan(warm(on))
  })

  it('neither glyph paints outside the radius it was given', () => {
    for (const draw of [drawCalmodulin, drawCaMKII]) {
      const c = paint((x) =>
        (draw as (ctx: CanvasRenderingContext2D, o: never) => void)(x.ctx, {
          x: 200,
          y: 200,
          r: 40,
          ca: 1,
          lit: 1,
        } as never),
      )
      for (const p of c.points) {
        expect(Math.hypot(p.x - 200, p.y - 200), 'the glyph spills past its own radius')
          .toBeLessThan(40 * 1.35)
      }
    }
  })
})
