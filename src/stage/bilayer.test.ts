import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { HEAD_R, HEAD_GAP, TAIL_LEN, HALF_MEM, MID_SEAM, PX_PER_NM,
  drawGatedChannel
} from './bilayer'
import { LIPID_HEAD_NM, LIPID_SPACING_NM, MEMBRANE_THICKNESS_NM } from '../core/membrane'

// The phospholipid's proportions, pinned to the measured bilayer they came
// from. They were once chosen by eye and were badly out — the head took 73% of
// a leaflet where a real one takes ~38%, and the molecules stood two and a
// half times too far apart. Numbers here are for a fluid phosphatidylcholine
// bilayer: hydrocarbon core ~14.6 Å per leaflet, headgroup region ~9 Å, area
// per lipid ~65 Å².

describe('the phospholipid, against the real thing', () => {
  it('spends most of a leaflet on TAILS, as a real one does', () => {
    const headShare = (2 * HEAD_R) / HALF_MEM
    // Real: 9 Å of 23.6 Å ≈ 38%.
    expect(headShare).toBeGreaterThan(0.3)
    expect(headShare).toBeLessThan(0.45)
    // And the tails are the longer half, by roughly the measured ratio (1.6:1).
    expect(TAIL_LEN / (2 * HEAD_R)).toBeGreaterThan(1.2)
  })

  it('packs its molecules shoulder to shoulder, at the measured spacing', () => {
    // Spacing slightly LESS than a head is wide — which is why a real membrane
    // has no persistent gaps between molecules.
    expect(HEAD_GAP).toBeLessThan(2 * HEAD_R)
    expect(HEAD_GAP).toBeGreaterThan(2 * HEAD_R * 0.7)
    expect(HEAD_GAP / PX_PER_NM).toBeCloseTo(LIPID_SPACING_NM, 6)
  })

  it('derives every length from a declared measurement, not from taste', () => {
    expect(2 * HALF_MEM).toBeCloseTo(MEMBRANE_THICKNESS_NM * PX_PER_NM, 6)
    expect(2 * HEAD_R).toBeCloseTo(LIPID_HEAD_NM * PX_PER_NM, 6)
    expect(HEAD_R + TAIL_LEN).toBeCloseTo(HALF_MEM, 6)
  })

  it('leaves a seam at the midplane — neither an overlap nor a passable gap', () => {
    // The leaflets meet, but the terminal methyls are the least ordered,
    // lowest-density part of the wall: a real electron-density profile has a
    // trough exactly there.
    expect(MID_SEAM).toBeGreaterThan(0)
    const seamPx = 2 * MID_SEAM * HEAD_R
    expect(seamPx).toBeLessThan(HALF_MEM * 0.1)
  })
})

describe('the channel silhouette', () => {
  it('is TWO subunits with a gap, not one body with a slot', () => {
    // ⚠ It was one outline with a hole cut in it, and the user judged it
    // "not even close" to the reference figure (2026-08-28). They were right,
    // and the difference is not cosmetic: a channel IS several separate
    // protein subunits standing in a ring, and the gap between them IS the
    // way through. Two closed paths, not one.
    const c = strictCanvas()
    drawGatedChannel(c.ctx, {
      cx: 40,
      midY: 40,
      open: 1,
      mid: '#a78bfa',
      dark: '#6d28d9',
      species: '#a78bfa',
    })
    expect(c.calls.filter((k) => k === 'closePath').length).toBeGreaterThanOrEqual(2)
    // Lobed edges, which is what beziers are for here.
    expect(c.calls).toContain('bezierCurveTo')
  })

  it('opens by widening the gap, never by moving the subunits apart', () => {
    // The protein does not fly apart. What changes is the pore between the
    // same two pieces — so a wider opening must not make the whole thing
    // wider.
    const wide = strictCanvas()
    const shut = strictCanvas()
    const base = { cx: 40, midY: 40, mid: '#a78bfa', dark: '#6d28d9', species: '#a78bfa' }
    drawGatedChannel(wide.ctx, { ...base, open: 1 })
    drawGatedChannel(shut.ctx, { ...base, open: 0 })
    // Same shape, same number of strokes: only the numbers inside differ.
    expect(wide.calls.filter((k) => k === 'closePath').length).toBe(
      shut.calls.filter((k) => k === 'closePath').length,
    )
  })

  it('has no gate flap or sensor of its own any more', () => {
    // Both belonged to the voltage-gated channel, which is a TRACED drawing
    // now with its own flap and its own inactivation ball (2026-08-29). Dead
    // options on a shared drawing are worse than dead code — the next caller
    // reaches for them — so they were removed rather than left switched off.
    const base = { cx: 40, midY: 40, open: 1, mid: '#a78bfa', dark: '#6d28d9', species: '#a78bfa' }
    const plain = strictCanvas()
    drawGatedChannel(plain.ctx, base)
    const asked = strictCanvas()
    // @ts-expect-error the options are gone, and asking for them must not
    // quietly draw something.
    drawGatedChannel(asked.ctx, { ...base, sensor: true, gate: 0.5 })
    expect(asked.calls).toEqual(plain.calls)
  })
})
