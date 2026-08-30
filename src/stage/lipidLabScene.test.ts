import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { HEAD_GAP, HALF_MEM, HEAD_R } from './bilayer'
import {
  LAB_LIPIDS,
  PER_LEAFLET,
  LAB_W,
  LAB_H,
  WALL_FROM,
  WALL_TO,
  WALL_SPAN,
  WALL_MID_Y,
  SETTLE_MS,
  SCATTER_MS,
  WALL_MAG,
  MOLECULE_MAG,
  slotPose,
  scatterPose,
  transitPose,
  wallTargetX,
  posesAt,
  coreAlphaAt,
  lipidAt,
  identitySlots,
  reinsertSlots,
  clampHeldY,
  drawVesicle,
  vesSlotPose,
  vesScatterPose,
  vesPosesAt,
  VES_W,
  VES_H,
  VES_OUT,
  VES_LIPIDS,
  VES_R_MID,
  VES_NM,
  LIPID_TERMS,
  buildPhospholipid,
  ELEMENT_R,
  TAIL_C_DRAWN,
  moleculeLabels,
  vesicleLabels,
  tankLabels,
  spokenTermAt,
  identityVesSlots,
  vesReinsertSlots,
  clampVesHeld,
  vesLipidAt,
  VES_IN,
  drawLab,
  drawMolecule,
  labRightNow,
  LIPID_MOLECULE_FACTS,
  LIPID_HONESTY,
  type LabState,
  headCircle,
  MOLECULE_ATOMS,
} from './lipidLabScene'

const wallState = (over: Partial<LabState> = {}): LabState => ({
  phase: 'wall',
  phaseStart: 0,
  seed: 1,
  slots: identitySlots(),
  held: null,
  returning: null,
  vesSlots: identityVesSlots(),
  vesHeld: null,
  vesReturning: null,
  ...over,
})

describe('the wall', () => {
  it('parks every lipid in its own slot, evenly, and the wall touches both edges', () => {
    const xsTop: number[] = []
    for (let i = 0; i < LAB_LIPIDS; i++) {
      const p = slotPose(i)
      expect(p.x).toBeGreaterThan(WALL_FROM)
      expect(p.x).toBeLessThan(WALL_TO)
      expect(p.y).toBe(WALL_MID_Y)
      if (i < PER_LEAFLET) xsTop.push(p.x)
    }
    const spacing = WALL_SPAN / PER_LEAFLET
    for (let j = 1; j < xsTop.length; j++) {
      expect(xsTop[j] - xsTop[j - 1]).toBeCloseTo(spacing, 6)
    }
    // The forced spacing stays honest packing — within a few percent of the
    // bilayer's own gap...
    expect(Math.abs(spacing - HEAD_GAP)).toBeLessThan(HEAD_GAP * 0.06)
    // ...and the wall runs edge to edge: no bare water strip at either end.
    expect(xsTop[0]).toBeLessThan(spacing)
    expect(xsTop[xsTop.length - 1]).toBeGreaterThan(LAB_W - spacing)
  })

  it('faces every head at the water: top-leaflet heads above the middle, bottom below', () => {
    for (let i = 0; i < LAB_LIPIDS; i++) {
      const p = slotPose(i)
      // The head sits at (0, −(HALF_MEM − HEAD_R)) in the molecule's own frame.
      const headY = p.y + Math.cos(p.angle) * -(HALF_MEM - HEAD_R)
      if (i < PER_LEAFLET) expect(headY).toBeLessThan(WALL_MID_Y)
      else expect(headY).toBeGreaterThan(WALL_MID_Y)
    }
  })
})

describe('the scatter', () => {
  it('is deterministic for a seed, and a different seed rearranges it', () => {
    let moved = 0
    for (let i = 0; i < LAB_LIPIDS; i++) {
      const a = scatterPose(i, 3)
      const b = scatterPose(i, 3)
      expect(a).toEqual(b)
      const c = scatterPose(i, 4)
      if (Math.hypot(c.x - a.x, c.y - a.y) > 5) moved++
    }
    // A result that does not change when the input changes is a broken parameter.
    expect(moved).toBeGreaterThan(LAB_LIPIDS / 2)
  })

  it('keeps every lipid inside the water box, off the walls', () => {
    for (const seed of [1, 2, 9]) {
      for (let i = 0; i < LAB_LIPIDS; i++) {
        const p = scatterPose(i, seed)
        expect(p.x).toBeGreaterThan(10)
        expect(p.x).toBeLessThan(LAB_W - 10)
        expect(p.y).toBeGreaterThan(10)
        expect(p.y).toBeLessThan(LAB_H - 10)
      }
    }
  })
})

describe('the two transports', () => {
  it('settling starts exactly at the scatter and ends exactly in the slots', () => {
    for (let i = 0; i < LAB_LIPIDS; i++) {
      const start = transitPose(i, 0, 'settle', 7)
      const scatter = scatterPose(i, 7)
      expect(start.x).toBeCloseTo(scatter.x, 6)
      expect(start.y).toBeCloseTo(scatter.y, 6)
      const end = transitPose(i, SETTLE_MS, 'settle', 7)
      const slot = slotPose(i)
      expect(end.x).toBeCloseTo(slot.x, 6)
      expect(end.y).toBeCloseTo(slot.y, 6)
    }
  })

  it('scattering runs the other way, and also lands exactly', () => {
    for (let i = 0; i < LAB_LIPIDS; i++) {
      const end = transitPose(i, SCATTER_MS, 'scatter', 7)
      const scatter = scatterPose(i, 7)
      expect(end.x).toBeCloseTo(scatter.x, 6)
      expect(end.y).toBeCloseTo(scatter.y, 6)
    }
  })

  it('never teleports a lipid: every 40 ms step is a small move', () => {
    for (const [dir, dur, bound] of [
      ['settle', SETTLE_MS, 14],
      ['scatter', SCATTER_MS, 28],
    ] as const) {
      for (let i = 0; i < LAB_LIPIDS; i++) {
        let prev = transitPose(i, 0, dir, 5)
        for (let ms = 40; ms <= dur; ms += 40) {
          const p = transitPose(i, ms, dir, 5)
          expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThan(bound)
          prev = p
        }
      }
    }
  })

  it('the oily middle only exists as much as the wall does', () => {
    expect(coreAlphaAt(wallState(), 100)).toBe(1)
    expect(coreAlphaAt(wallState({ phase: 'scattered' }), 100)).toBe(0)
    const early = coreAlphaAt(wallState({ phase: 'settling', phaseStart: 0 }), SETTLE_MS * 0.3)
    const late = coreAlphaAt(wallState({ phase: 'settling', phaseStart: 0 }), SETTLE_MS * 0.8)
    expect(early).toBeGreaterThan(0)
    expect(late).toBeGreaterThan(early)
    expect(late).toBeLessThan(1)
  })
})

describe('pulling one molecule out', () => {
  const held = { i: 4, x: 120, y: 60, since: 1000 }
  const state = wallState({ held })
  const settled = 1000 + 2000 // long after the closing ease is done

  it('the held lipid is at the pointer, give or take a jiggle', () => {
    const p = posesAt(state, settled)[held.i]
    expect(Math.hypot(p.x - held.x, p.y - held.y)).toBeLessThan(1.5)
  })

  it("the held lipid's own leaflet closes the gap over the same span", () => {
    const xs: number[] = []
    for (let i = 0; i < PER_LEAFLET; i++) {
      if (i !== held.i) xs.push(wallTargetX(i, held.i))
    }
    xs.sort((a, b) => a - b)
    const spacing = WALL_SPAN / (PER_LEAFLET - 1)
    for (let j = 1; j < xs.length; j++) {
      expect(xs[j] - xs[j - 1]).toBeCloseTo(spacing, 6)
    }
    // Closed means no gap wider than a molecule and a half.
    expect(spacing).toBeLessThan(HEAD_GAP * 1.6)
  })

  it('the other leaflet does not move', () => {
    for (let i = PER_LEAFLET; i < LAB_LIPIDS; i++) {
      expect(wallTargetX(i, held.i)).toBe(slotPose(i).x)
    }
  })

  it('a held molecule cannot be dragged through the wall', () => {
    // Top-leaflet lipid pushed toward the bottom: clamped above the wall.
    expect(clampHeldY(2, LAB_H - 10)).toBeLessThan(WALL_MID_Y - HALF_MEM)
    // Bottom-leaflet lipid pushed toward the top: clamped below it.
    expect(clampHeldY(PER_LEAFLET + 2, 10)).toBeGreaterThan(WALL_MID_Y + HALF_MEM)
    // A legal position on its own side passes through untouched.
    expect(clampHeldY(2, 30)).toBe(30)
  })

  it('a molecule is conserved: a full crowd of poses in every phase', () => {
    expect(posesAt(state, settled)).toHaveLength(LAB_LIPIDS)
    expect(posesAt(wallState({ phase: 'scattered' }), 50)).toHaveLength(LAB_LIPIDS)
    expect(posesAt(wallState({ phase: 'settling' }), 50)).toHaveLength(LAB_LIPIDS)
  })

  it('a released molecule rejoins the wall at the NEAREST slot, not its old one', () => {
    // The reported bug: a lipid pulled from the left and released far right
    // swam all the way back to its old place. The shortest path wins now.
    const slots = identitySlots()
    const i = 2 // old home near the wall's left end
    const releaseX = WALL_TO - 10 // let go near the right end
    const next = reinsertSlots(slots, i, releaseX)
    const newHome = slotPose(i, next)
    const oldHome = slotPose(i, slots)
    expect(Math.abs(newHome.x - releaseX)).toBeLessThan(HEAD_GAP)
    expect(Math.abs(newHome.x - releaseX)).toBeLessThan(Math.abs(oldHome.x - releaseX))
  })

  it('a reinsertion is a permutation: every slot filled once, the other leaflet untouched', () => {
    const next = reinsertSlots(identitySlots(), 2, WALL_TO - 10)
    const top = next.slice(0, PER_LEAFLET)
    expect([...top].sort((a, b) => a - b)).toEqual([...Array(PER_LEAFLET).keys()])
    for (let m = PER_LEAFLET; m < LAB_LIPIDS; m++) {
      expect(next[m]).toBe(m - PER_LEAFLET)
    }
    // The bystanders keep their relative order — what keeps the reopen smooth.
    const others = [...Array(PER_LEAFLET).keys()].filter((m) => m !== 2)
    const ranks = others.map((m) => next[m])
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
  })

  it('the moment of release is seamless: no lipid moves more than a jiggle', () => {
    const heldAt = { i: 2, x: WALL_TO - 10, y: 60, since: 0 }
    const before = posesAt(wallState({ held: heldAt }), 5000)
    const after = posesAt(
      wallState({
        slots: reinsertSlots(identitySlots(), 2, heldAt.x),
        returning: { i: 2, x: heldAt.x, y: heldAt.y, at: 5000 },
      }),
      5000,
    )
    for (let m = 0; m < LAB_LIPIDS; m++) {
      expect(Math.hypot(after[m].x - before[m].x, after[m].y - before[m].y)).toBeLessThan(2)
    }
  })

  it('grabbing works on a wall head and nowhere else', () => {
    const s = wallState()
    const target = slotPose(2)
    const headY = target.y - (HALF_MEM - HEAD_R)
    expect(lipidAt(s, 0, target.x, headY)).toBe(2)
    expect(lipidAt(s, 0, 10, 10)).toBeNull()
    expect(lipidAt(wallState({ phase: 'scattered' }), 0, target.x, headY)).toBeNull()
  })
})

describe('the vesicle', () => {
  it('closes into a ring: every lipid sits on the membrane-middle circle', () => {
    for (let k = 0; k < VES_LIPIDS; k++) {
      const p = vesSlotPose(k)
      const r = Math.hypot(p.x - VES_W / 2, p.y - VES_H / 2)
      expect(r).toBeCloseTo(VES_R_MID, 6)
    }
  })

  it('every head faces water: outer heads outward, inner heads into the lumen', () => {
    for (let k = 0; k < VES_LIPIDS; k++) {
      const p = vesSlotPose(k)
      // The head sits at (0, −(HALF_MEM − HEAD_R)) in the molecule's own frame.
      const off = HALF_MEM - HEAD_R
      const hx = p.x + Math.sin(p.angle) * off
      const hy = p.y - Math.cos(p.angle) * off
      const headR = Math.hypot(hx - VES_W / 2, hy - VES_H / 2)
      if (k < VES_OUT) expect(headR).toBeGreaterThan(VES_R_MID)
      else expect(headR).toBeLessThan(VES_R_MID)
    }
  })

  it('assembles and scatters with the wall, landing exactly, from the same clock', () => {
    const seed = 3
    for (let k = 0; k < VES_LIPIDS; k++) {
      const settled = vesPosesAt(wallState({ phase: 'settling', phaseStart: 0, seed }), SETTLE_MS)[k]
      const slot = vesSlotPose(k)
      expect(settled.x).toBeCloseTo(slot.x, 4)
      expect(settled.y).toBeCloseTo(slot.y, 4)
      const scattered = vesPosesAt(
        wallState({ phase: 'scattering', phaseStart: 0, seed }),
        SCATTER_MS,
      )[k]
      const home = vesScatterPose(k, seed)
      expect(scattered.x).toBeCloseTo(home.x, 4)
      expect(scattered.y).toBeCloseTo(home.y, 4)
    }
  })

  it('a released vesicle lipid rejoins the ring at the NEAREST place', () => {
    // Outer lipid 0 lives at the ring's top; release it at the ring's right.
    const next = vesReinsertSlots(identityVesSlots(), 0, VES_W / 2 + 60, VES_H / 2)
    expect(next[0]).toBe(VES_OUT / 4)
    // A valid permutation of the outer leaflet; the inner one untouched.
    const outer = next.slice(0, VES_OUT)
    expect([...outer].sort((a, b) => a - b)).toEqual([...Array(VES_OUT).keys()])
    for (let m = VES_OUT; m < VES_LIPIDS; m++) expect(next[m]).toBe(m - VES_OUT)
  })

  it('the bag wall is not crossable: outer stays out, inner is trapped in the lumen', () => {
    const cx = VES_W / 2
    const cy = VES_H / 2
    // An outer lipid shoved at the centre is pushed back outside the ring.
    const out = clampVesHeld(0, cx + 1, cy)
    expect(Math.hypot(out.x - cx, out.y - cy)).toBeGreaterThanOrEqual(VES_R_MID + HALF_MEM + 1.9)
    // An inner lipid dragged far away is held inside the lumen.
    const inn = clampVesHeld(VES_OUT, cx + 500, cy - 500)
    expect(Math.hypot(inn.x - cx, inn.y - cy)).toBeLessThanOrEqual(VES_R_MID - HALF_MEM - 1.9)
  })

  it('grabbing works on a bag head in the wall phase, and not when scattered', () => {
    const p = vesSlotPose(2)
    const off = HALF_MEM - HEAD_R
    const hx = p.x + Math.sin(p.angle) * off
    const hy = p.y - Math.cos(p.angle) * off
    expect(vesLipidAt(wallState(), 0, hx, hy)).toBe(2)
    expect(vesLipidAt(wallState({ phase: 'scattered' }), 0, hx, hy)).toBeNull()
  })

  it('the ring closes round a held lipid: its leaflet re-spreads, the other stays', () => {
    const held = { k: 0, x: VES_W / 2, y: 8, since: 0 }
    const poses = vesPosesAt(wallState({ vesHeld: held }), 3000)
    const angles = poses
      .slice(1, VES_OUT)
      .map((p) => Math.atan2(p.y - VES_H / 2, p.x - VES_W / 2))
      .sort((a, b) => a - b)
    // Two neighbours can each jiggle by a fixed 1.6 px, which is a bigger
    // ANGULAR share on a densely packed ring than on a sparse one — so the
    // tolerance is the nominal gap plus that, not a flat multiplier.
    const jiggleRad = (2 * 1.6) / VES_R_MID
    for (let j = 1; j < angles.length; j++) {
      const gap = angles[j] - angles[j - 1]
      expect(gap).toBeLessThan(((Math.PI * 2) / (VES_OUT - 1)) * 1.2 + jiggleRad)
    }
    // The inner leaflet has not moved beyond its jiggle.
    for (let k = VES_OUT; k < VES_LIPIDS; k++) {
      const home = vesSlotPose(k)
      expect(Math.hypot(poses[k].x - home.x, poses[k].y - home.y)).toBeLessThan(2.5)
    }
    expect(VES_IN).toBe(VES_LIPIDS - VES_OUT)
  })

  it('is declared smaller than any real vesicle', () => {
    expect(VES_NM).toBeLessThan(40)
    expect(LIPID_HONESTY.map((f) => f.text).join(' ')).toContain(`${VES_NM} nm`)
  })
})

describe('the drawing survives a strict canvas', () => {
  it('draws the wall, a transit, a drag and the big molecule without a bad colour or a NaN', () => {
    for (const s of [
      wallState(),
      wallState({ phase: 'scattered' }),
      wallState({ phase: 'settling', phaseStart: 0 }),
      wallState({ held: { i: 4, x: 120, y: 60, since: 100 } }),
      wallState({ returning: { i: 4, x: 120, y: 60, at: 100 } }),
    ]) {
      const { ctx, calls } = strictCanvas()
      drawLab(ctx, s, 2400)
      expect(calls.filter((c) => c === 'arc').length).toBeGreaterThanOrEqual(LAB_LIPIDS)
    }
    const { ctx, calls } = strictCanvas()
    drawMolecule(ctx, 1234)
    expect(calls).toContain('fillText')
    for (const s of [
      wallState(),
      wallState({ phase: 'scattered' }),
      wallState({ phase: 'settling', phaseStart: 0 }),
    ]) {
      const v = strictCanvas()
      drawVesicle(v.ctx, s, 1800)
      expect(v.calls.filter((c) => c === 'arc').length).toBeGreaterThanOrEqual(VES_LIPIDS)
    }
  })
})

describe('the molecule, atom by atom', () => {
  const m = buildPhospholipid()

  it('has the right census: one P, one N, eight O, twenty-nine C, fifty-six H', () => {
    const count = (k: string) => m.heavy.filter((a) => a.k === k).length
    expect(count('P')).toBe(1)
    expect(count('N')).toBe(1)
    expect(count('O')).toBe(8)
    // 3 choline methyls + 2 bridge + 3 glycerol + 2 carbonyls + 19 tail carbons.
    expect(count('C')).toBe(3 + 2 + 3 + 2 + TAIL_C_DRAWN[0] + TAIL_C_DRAWN[1])
    expect(m.hydrogens).toHaveLength(56)
  })

  it('sizes elements the honest way round: P > O = N > C > H', () => {
    expect(ELEMENT_R.P).toBeGreaterThan(ELEMENT_R.O)
    expect(ELEMENT_R.O).toBe(ELEMENT_R.N)
    expect(ELEMENT_R.N).toBeGreaterThan(ELEMENT_R.C)
    expect(ELEMENT_R.C).toBeGreaterThan(ELEMENT_R.H)
  })

  it('bends at the cis double bond: the chain veers after the kink', () => {
    expect(Number.isFinite(m.kink.x)).toBe(true)
    expect(m.kink.y).toBeGreaterThan(100)
    // After the kink the unsaturated tail drifts well rightward of the joint.
    const maxX = Math.max(...m.heavy.map((a) => a.x))
    expect(maxX).toBeGreaterThan(m.kink.x + 25)
  })

  it('keeps every atom finite and inside the panel frame', () => {
    for (const a of [...m.heavy, ...m.hydrogens]) {
      expect(Number.isFinite(a.x)).toBe(true)
      expect(Number.isFinite(a.y)).toBe(true)
      expect(a.x).toBeGreaterThan(-70)
      expect(a.x).toBeLessThan(90)
      expect(a.y).toBeGreaterThan(-25)
      expect(a.y).toBeLessThan(200)
    }
  })

  it('declares the truncation and derives the magnification from the bond', () => {
    const text = LIPID_HONESTY.map((f) => f.text).join(' ')
    expect(text).toContain('16 and 18')
    expect(text).toContain(`×${MOLECULE_MAG.toLocaleString('en-US')}`)
    expect(text).toContain('carbon–carbon bond')
  })
})

describe('the words', () => {
  it('names the real parts: phosphate, fatty acids, the kink, the charge', () => {
    const text = LIPID_MOLECULE_FACTS.map((f) => f.text).join(' ')
    expect(text).toMatch(/PHOSPHATE HEAD/)
    expect(text).toMatch(/FATTY-ACID TAILS/)
    expect(text).toMatch(/KINK/)
    expect(text).toMatch(/charge/)
  })

  it('declares the exaggerations: choreography, the flat patch, the missing cast, the sizes', () => {
    const text = LIPID_HONESTY.map((f) => f.text).join(' ')
    expect(text).toMatch(/sped up/)
    expect(text).toMatch(/bubble/)
    expect(text).toMatch(/vesicle/)
    expect(text).toMatch(/cholesterol/)
    expect(text).toContain(`×${WALL_MAG.toLocaleString('en-US')}`)
    expect(text).toContain(`×${MOLECULE_MAG.toLocaleString('en-US')}`)
    expect(text).toMatch(/5 nm/)
  })

  it('offers a voice for the real terms (F04), spoken from the canvas labels', () => {
    expect(LIPID_TERMS).toContain('phospholipid')
    expect(LIPID_TERMS).toContain('choline')
    expect(LIPID_TERMS).toContain('bilayer')
    expect(LIPID_TERMS).toContain('vesicle')
    // Every term is an actual on-canvas label, and every label is a term —
    // the list and the picture cannot drift apart.
    const onCanvas = [
      ...moleculeLabels(),
      ...vesicleLabels(),
      ...tankLabels(),
    ].map((l) => l.term)
    expect(new Set(onCanvas)).toEqual(new Set(LIPID_TERMS))
  })

  it('every spoken label answers a tap inside its own box, and nowhere else', () => {
    const labels = moleculeLabels()
    for (const l of labels) {
      expect(spokenTermAt(labels, l.x + 2, l.y + 2)).toBe(l.term)
    }
    expect(spokenTermAt(labels, -40, -40)).toBeNull()
    expect(spokenTermAt(tankLabels(), 28, LAB_H * 2 - 14)).toBe('bilayer')
  })

  it('narrates every phase, and the drag names the finding: a liquid', () => {
    for (const phase of ['wall', 'scattered', 'settling', 'scattering'] as const) {
      expect(labRightNow(phase, false).length).toBeGreaterThan(0)
    }
    expect(labRightNow('wall', true)[0].text).toMatch(/liquid/)
  })
})

describe("the schematic head's circle", () => {
  it('is derived from the head atoms, not a typed-in radius', () => {
    const h = headCircle()
    expect(Number.isFinite(h.x)).toBe(true)
    expect(Number.isFinite(h.y)).toBe(true)
    expect(h.r).toBeGreaterThan(0)
    // It holds every atom it claims to stand for, and reaches no further
    // than it has to.
    const HEAD_BELOW = 56
    const head = [
      ...MOLECULE_ATOMS.heavy.filter((a) => a.y <= HEAD_BELOW),
      ...MOLECULE_ATOMS.hydrogens.filter((a) => a.y <= HEAD_BELOW),
    ]
    expect(head.length).toBeGreaterThan(10)
    for (const a of head) {
      expect(Math.hypot(a.x - h.x, a.y - h.y)).toBeLessThanOrEqual(h.r + 0.001)
    }
    // …and it stops above the tails: a circle swallowing the tails would be
    // saying the schematic head is the whole molecule.
    const tail = MOLECULE_ATOMS.heavy.filter((a) => a.y > HEAD_BELOW + 30)
    expect(tail.length).toBeGreaterThan(0)
    for (const a of tail) {
      expect(Math.hypot(a.x - h.x, a.y - h.y)).toBeGreaterThan(h.r)
    }
  })
})
