import { describe, expect, it } from 'vitest'
import { ION_KINDS, IONS, particlesFor } from '../core/ions'
import type { IonCounts } from '../state/ionStore'
import { FIRE_STIMULUS } from '../core/spikeModel'
import { AXON_DIAMETER_UM } from '../core/membrane'
import { fibreRun } from '../core/fibre'
import { DEFAULT_PATCH } from '../state/axonStore'
import { drawRibbon, viewFibre } from './axonRibbon'
import {
  AXON_VIEW_SCALE,
  AXON_W,
  DRAWN_AXON_UM,
  STAGE_H,
  STAGE_W,
} from './layout'
import { mix } from './bilayer'
import { strictCanvas } from './strictCanvas'

const real: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

describe('mix', () => {
  it('never returns NaN, whatever it is given', () => {
    // The bug. It read hex only, sliced characters, and handed back
    // `rgb(NaN, NaN, NaN)` for anything else — harmless as a fillStyle, fatal in
    // addColorStop.
    for (const a of ['#5eead4', '#abc', 'rgba(30, 41, 59, 1)', 'rgb(1,2,3)', 'nonsense']) {
      for (const b of ['#9a8b6a', 'rgba(112, 26, 117, 0.5)', '#fff']) {
        for (const t of [0, 0.37, 1]) {
          expect(mix(a, b, t), `${a} → ${b} @ ${t}`).not.toContain('NaN')
        }
      }
    }
  })

  it('blends both hex and rgba, and keeps alpha', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('rgba(128, 128, 128, 1)')
    expect(mix('rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 1)', 0.5)).toBe('rgba(0, 0, 0, 0.5)')
  })
})

describe('the axon ribbon, drawn against a canvas that complains', () => {
  const run = fibreRun(real, true, FIRE_STIMULUS, viewFibre(false))

  it('draws every moment of the run without a browser objecting', () => {
    // The scene this tool was written for has been removed and will be rebuilt, but
    // the tool must stay exercised — an unused strict stand-in rots, and the class of
    // bug it catches (a colour or a coordinate that a permissive mock accepts and a
    // browser rejects) is not specific to any one view.
    for (let i = 0; i <= 12; i++) {
      const c = strictCanvas()
      const draw = () =>
        drawRibbon(c.ctx, {
          width: STAGE_W,
          height: STAGE_H,
          axonPx: AXON_W * AXON_VIEW_SCALE,
          axonUm: AXON_DIAMETER_UM,
          run,
          u: i / 12,
          counts: real,
          patch: DEFAULT_PATCH,
          drawnAxonUm: DRAWN_AXON_UM,
          fade: 1,
        })
      expect(draw, `u = ${(i / 12).toFixed(2)}`).not.toThrow()
      expect(c.calls.length).toBeGreaterThan(200)
    }
  })
})

describe('the stand-in restores what a browser restores', () => {
  it('puts back globalAlpha, styles and line width on restore', () => {
    // ⚠ IT DID NOT, AND THAT LET A BUG THROUGH (2026-08-31). `save`/`restore`
    // tracked the transform and nothing else, so a colour or an alpha set
    // inside a save block was still readable afterwards — the stand-in being
    // MORE forgiving than a browser, which is the direction that hides faults.
    const c = strictCanvas()
    c.ctx.globalAlpha = 0.4
    c.ctx.fillStyle = '#111111'
    c.ctx.lineWidth = 3
    c.ctx.save()
    c.ctx.globalAlpha = 1
    c.ctx.fillStyle = '#ffffff'
    c.ctx.lineWidth = 12
    c.ctx.restore()
    expect(c.ctx.globalAlpha).toBe(0.4)
    expect(c.ctx.fillStyle).toBe('#111111')
    expect(c.ctx.lineWidth).toBe(3)
  })

  it('records the alpha in force at every ink-laying call', () => {
    const c = strictCanvas()
    c.ctx.globalAlpha = 0.2
    c.ctx.fillStyle = '#123456'
    c.ctx.beginPath()
    c.ctx.fill()
    c.ctx.save()
    c.ctx.globalAlpha *= 0.5
    c.ctx.stroke()
    c.ctx.restore()
    c.ctx.fill()
    expect(c.alphas).toEqual([0.2, 0.1, 0.2])
  })
})

