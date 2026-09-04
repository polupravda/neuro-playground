import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { drawSceneChannel } from './sceneProtein'
import { drawLeakChannel } from './leakChannel'
import { HALF_MEM } from './bilayer'
import { CHANNELS } from '../core/channels'
import { GLOSSY_COLORS } from './particleStyle'
import type { IonKind } from '../core/ions'

// ACTION LIST 2026-08-30 A4: "check channels color-coding in this demo. K⁺
// channel does not look purple enough. Fix, check other channels."
//
// ⚠ IT WAS A DOUBLE TINT. The neuron scene muted a channel toward its ion by
// 0.38 — and the traced drawing then muted it AGAIN by 0.55, because tinting a
// protein with what it passes is the drawing's own job. Two mixes in series
// washed every channel back to bronze:
//
//     potassium  #9d8b88  (brownish grey)   should be  #a18bb9
//     sodium     #ae9958  (muddy olive)     should be  #cfaf3b
//     chloride   #8a9d6e  (olive)           should be  #6eb976
//
// The scene hands over the ion's own colour now and lets the drawing do its
// single mix. This test is the guard, and it compares the two views' OUTPUT
// rather than their inputs — the same protein has to look the same wherever it
// is drawn.

const paint = (fn: (c: ReturnType<typeof strictCanvas>) => void) => {
  const c = strictCanvas()
  fn(c)
  return c.styles
}

describe('a channel wears its ion, in every view', () => {
  it('paints the scene\'s leak channel exactly as the bench paints it', () => {
    const bench = paint((c) =>
      drawLeakChannel(c.ctx, {
        cx: 0,
        midY: 0,
        halfHeight: HALF_MEM,
        species: GLOSSY_COLORS.k.mid,
        speciesDark: GLOSSY_COLORS.k.dark,
      }),
    )
    const scene = paint((c) =>
      drawSceneChannel(c.ctx, {
        channel: CHANNELS['leak-k'],
        open: false,
        species: GLOSSY_COLORS.k.mid,
        speciesDark: GLOSSY_COLORS.k.dark,
        transmitter: false,
      }),
    )
    // Gradients aside, the flat colours a channel is painted with must match.
    expect(new Set(scene)).toEqual(new Set(bench))
  })

  it('gives every channel a colour that still reads as its ion', () => {
    // The failure mode is a wash toward bronze, so the test is that the ion's
    // OWN dominant channel survives the tinting.
    const dominant = (hex: string) => {
      const n = hex.replace('#', '')
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16))
      return r >= g && r >= b ? 'r' : g >= b ? 'g' : 'b'
    }
    for (const id of ['leak-k', 'voltage-na', 'ligand'] as const) {
      const ion = CHANNELS[id].passes[0] as IonKind
      const styles = paint((c) =>
        drawSceneChannel(c.ctx, {
          channel: CHANNELS[id],
          open: false,
          species: GLOSSY_COLORS[ion].mid,
          speciesDark: GLOSSY_COLORS[ion].dark,
          transmitter: false,
        }),
      ).filter((s) => s.startsWith('#'))
      expect(styles.length).toBeGreaterThan(0)
      // At least one of the colours it is painted with leans the way its ion
      // leans — potassium blue-violet, sodium red-yellow, chloride green.
      const want = dominant(GLOSSY_COLORS[ion].mid)
      expect(styles.some((s) => dominant(s) === want)).toBe(true)
    }
  })
})
