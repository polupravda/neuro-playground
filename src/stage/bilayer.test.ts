import { describe, expect, it } from 'vitest'
import { HEAD_R, HEAD_GAP, TAIL_LEN, HALF_MEM, MID_SEAM, PX_PER_NM } from './bilayer'
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

// ⚠ THE `drawGatedChannel` TESTS WENT WITH THE DRAWING (2026-08-30).
//
// They pinned a generic lobed silhouette that no longer exists: every caller
// now draws the protein it actually means, and each of those has its own
// tests. Keeping these would have been a suite defending a shape nothing
// renders — which is worse than no test, because it reads as coverage.
