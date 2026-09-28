import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { drawSceneChannel } from './sceneProtein'
import { drawLeakChannel } from './leakChannel'
import { HALF_MEM } from './bilayer'
import { CHANNELS } from '../core/channels'
import { GLOSSY_COLORS } from './particleStyle'
import { drawLigandChannel } from './ligandChannel'
import { drawReceptor } from './receptorScene'
import { TRANSMITTER_INK } from './synapseScene'
import { receptorsStart } from '../core/receptors'
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

// ⚠ D07 BROKE THIS RULE ON THE DAY IT WAS BUILT (21c-34, user: "would it make
// sense to replace receptors in 'vesicle: round trip view' to AMPA
// (color-coding), for consistency?"). The two views did disagree — but the
// round trip was the one that had it right, drawing its receptor in sodium's
// gold. D07 had painted AMPA in the TRANSMITTER's teal, the colour of what it
// catches, and NMDA in magnesium's stone, the colour of what BLOCKS it.
describe('the glutamate receptors wear their ions too', () => {
  it('paints D07’s AMPA exactly as a sodium channel is painted', () => {
    const direct = paint((c) =>
      drawLigandChannel(c.ctx, {
        cx: 0,
        midY: 0,
        halfHeight: HALF_MEM,
        open: 0.5,
        species: GLOSSY_COLORS.na.mid,
        speciesDark: GLOSSY_COLORS.na.dark,
        socket: true,
      }),
    )
    const bench = paint((c) =>
      drawReceptor(c.ctx, { kind: 'ampa', state: receptorsStart(), ms: 0 }),
    )
    expect(direct.length, 'the reference painted nothing').toBeGreaterThan(3)
    for (const colour of new Set(direct)) {
      expect(bench, `AMPA is not wearing sodium — ${colour} is missing`).toContain(colour)
    }
  })

  it('paints D07’s NMDA in CALCIUM — the ion that makes it a different receptor', () => {
    const direct = paint((c) =>
      drawLigandChannel(c.ctx, {
        cx: 0,
        midY: 0,
        halfHeight: HALF_MEM,
        open: 0.5,
        species: GLOSSY_COLORS.ca.mid,
        speciesDark: GLOSSY_COLORS.ca.dark,
        socket: true,
      }),
    )
    const bench = paint((c) =>
      drawReceptor(c.ctx, { kind: 'nmda', state: receptorsStart(), ms: 0 }),
    )
    for (const colour of new Set(direct)) {
      expect(bench, `NMDA is not wearing calcium — ${colour} is missing`).toContain(colour)
    }
  })

  it('and neither wears what it CATCHES or what BLOCKS it', () => {
    // The two wrong answers, named so a future edit cannot drift back to them.
    const wrong = paint((c) =>
      drawLigandChannel(c.ctx, {
        cx: 0,
        midY: 0,
        halfHeight: HALF_MEM,
        open: 0.5,
        species: TRANSMITTER_INK.mid,
        speciesDark: TRANSMITTER_INK.dark,
        socket: true,
      }),
    )
    const bench = paint((c) =>
      drawReceptor(c.ctx, { kind: 'ampa', state: receptorsStart(), ms: 0 }),
    )
    const shared = [...new Set(wrong)].filter((colour) => bench.includes(colour))
    expect(
      shared.length,
      `AMPA is still wearing the transmitter's own ink (${shared.join(', ')})`,
    ).toBeLessThan(new Set(wrong).size)
  })
})
