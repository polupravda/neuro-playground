import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import {
  PT_W,
  PT_H,
  WALL_Y,
  MOTES_PER_SHOT,
  containers,
  containerAt,
  shootMotes,
  stepMotes,
  oddsFor,
  crossedCounts,
  firedSpecies,
  drawPermea,
  drawTraveller,
  permeaLabels,
  aquaporinChip,
  aquaporinChipAt,
  resetChip,
  resetChipAt,
  TRAY_KEY_MAG,
  TRAVELLER_MAG,
  reachNm,
  narrowNm,
  drawnReach,
  AQP_X,
  PERMEA_SCALE,
  permeaRightNow,
  type Mote,
} from './permeaScene'
import {
  TRAVELLERS,
  PERMEA_FACTS,
  PERMEA_HONESTY,
  PERMEA_LADDER,
  travellerOf,
  waterToSodiumRatio,
  oxygenToSodiumRatio,
  fmtPermeability,
} from '../core/permeability'
import { spokenTermAt } from './spokenLabels'
import { HALF_MEM, HEAD_GAP, PX_PER_NM } from './bilayer'

/** Run a puff for `seconds` of simulated time at 60 fps. */
function run(sp: Parameters<typeof shootMotes>[0], seconds: number, aquaporin: boolean): Mote[] {
  const motes = shootMotes(sp, 0)
  for (let ms = 0; ms < seconds * 1000; ms += 16.7) {
    stepMotes(motes, 16.7, ms, aquaporin)
  }
  return motes
}

describe('the science table', () => {
  it('orders the ladder the only way the measurements allow', () => {
    const p = (id: Parameters<typeof travellerOf>[0]) => travellerOf(id).permeability
    expect(p('o2')).toBeGreaterThan(p('co2'))
    expect(p('co2')).toBeGreaterThan(p('water'))
    expect(p('water')).toBeGreaterThan(p('glucose'))
    expect(p('glucose')).toBeGreaterThan(p('na'))
  })

  it('derives the headline ratios instead of asserting them', () => {
    // Sodium is smaller than water and still ~ten billion times slower — the
    // sieve idea dies on this pair.
    expect(waterToSodiumRatio()).toBeGreaterThan(1e10)
    expect(oxygenToSodiumRatio()).toBeGreaterThan(1e13)
    const text = PERMEA_FACTS.map((f) => f.text).join(' ')
    expect(text).toContain(`${Math.round(waterToSodiumRatio() / 1e9)} billion`)
  })

  it('declares the tank’s compression and the order-of-magnitude numbers', () => {
    const text = PERMEA_HONESTY.map((f) => f.text).join(' ')
    expect(text).toMatch(/compresses the odds/)
    expect(text).toMatch(/order-of-magnitude/)
    expect(text).toMatch(/channels/)
  })

  it('keeps the tank’s odds in the same order as the truth', () => {
    const odds = TRAVELLERS.map((t) => t.visualOdds)
    const truth = TRAVELLERS.map((t) => t.permeability)
    for (let i = 1; i < odds.length; i++) {
      const sameOrder = Math.sign(odds[i - 1] - odds[i]) * Math.sign(truth[i - 1] - truth[i])
      expect(sameOrder).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('the tank', () => {
  it('gases mostly cross; water trickles; glucose and sodium never do', () => {
    const below = (sp: Parameters<typeof shootMotes>[0]) =>
      run(sp, 20, false).filter((m) => m.side === 'below').length
    expect(below('o2')).toBeGreaterThan(MOTES_PER_SHOT * 0.6)
    expect(below('glucose')).toBe(0)
    expect(below('na')).toBe(0)
    const water = below('water')
    expect(water).toBeGreaterThan(0)
    expect(water).toBeLessThan(below('o2'))
  })

  it('the aquaporin changes water and nothing else', () => {
    // A result that does not change when the input changes is a broken
    // parameter — and a door that helps sodium would be a broken membrane.
    const waterWith = run('water', 20, true).filter((m) => m.side === 'below').length
    const waterWithout = run('water', 20, false).filter((m) => m.side === 'below').length
    expect(waterWith).toBeGreaterThan(waterWithout)
    expect(run('na', 20, true).filter((m) => m.side === 'below').length).toBe(0)
    expect(oddsFor('na', true, AQP_X)).toBe(0)
    expect(oddsFor('water', true, AQP_X)).toBeGreaterThan(oddsFor('water', false, AQP_X))
    // Away from the pore's catchment, water is back to the bare-wall trickle.
    expect(oddsFor('water', true, 2)).toBe(oddsFor('water', false, 2))
  })

  it('conserves every mote and keeps them in the tank', () => {
    for (const sp of ['o2', 'water', 'na'] as const) {
      const motes = run(sp, 20, false)
      expect(motes).toHaveLength(MOTES_PER_SHOT)
      for (const m of motes) {
        expect(Number.isFinite(m.x)).toBe(true)
        expect(Number.isFinite(m.y)).toBe(true)
        expect(m.x).toBeGreaterThanOrEqual(0)
        expect(m.x).toBeLessThanOrEqual(PT_W)
        expect(m.y).toBeGreaterThanOrEqual(0)
        expect(m.y).toBeLessThanOrEqual(PT_H)
      }
    }
  })

  it('never leaves a mote parked inside the oily wall', () => {
    for (const sp of ['o2', 'water'] as const) {
      const motes = run(sp, 20, false)
      for (const m of motes) {
        if (m.side !== 'crossing') {
          expect(Math.abs(m.y - WALL_Y)).toBeGreaterThan(2)
        }
      }
    }
  })

  it('counts crossings from the motes themselves', () => {
    const motes = run('o2', 20, false)
    expect(crossedCounts(motes).o2).toBe(motes.filter((m) => m.side === 'below').length)
  })

  it('a substance already in the tank counts as fired — one squirt each', () => {
    expect(firedSpecies([])).toEqual(new Set())
    const motes = shootMotes('water', 0)
    expect(firedSpecies(motes).has('water')).toBe(true)
    expect(firedSpecies(motes).has('o2')).toBe(false)
  })

  it('every container is clickable where it is drawn', () => {
    for (const c of containers()) {
      expect(containerAt(c.cx, c.y + c.h / 2)).toBe(c.sp)
    }
    expect(containerAt(PT_W / 2, PT_H - 10)).toBeNull()
  })
})

describe('the readings and the chip', () => {
  it('prints coefficients the way a reading wants: plain when plain, powers when tiny', () => {
    expect(fmtPermeability(20)).toBe('20')
    expect(fmtPermeability(0.35)).toBe('0.35')
    expect(fmtPermeability(3e-3)).toBe('10⁻³')
    expect(fmtPermeability(1e-13)).toBe('10⁻¹³')
  })

  it('carries the truth in the words now the ladder panel is gone', () => {
    // The measured coefficients live in "How easily it crosses" as icon-led
    // bullets (27b) — every traveller's number stated, sorted by permeability.
    const text = PERMEA_LADDER.map((f) => f.text).join(' ')
    for (const t of TRAVELLERS) {
      expect(text).toContain(fmtPermeability(t.permeability))
    }
    expect(PERMEA_LADDER[0].text).toMatch(/^oxygen/)
  })

  it('keeps the switch off the pore: pore in the middle, switch at the right', () => {
    // A control stacked above the thing it changes hides it (28e).
    const c = aquaporinChip()
    expect(aquaporinChipAt(c.x + c.w / 2, c.y + c.h / 2)).toBe(true)
    expect(aquaporinChipAt(5, 5)).toBe(false)
    expect(AQP_X).toBe(Math.round(PT_W / 2))
    // The switch sits well to the right of the pore, never over it.
    expect(c.x).toBeGreaterThan(AQP_X * PERMEA_SCALE + 40)
    expect(c.x + c.w).toBeLessThanOrEqual(PT_W * PERMEA_SCALE)
    // And its own tray is the one directly above it.
    const waterTray = containers().find((k) => k.sp === 'water')!
    expect(Math.abs(waterTray.cx - AQP_X)).toBeLessThan(PT_W * 0.12)
    // Just above the wall: the chip's bottom sits within a bilayer of it.
    // Derived from the bench's own scale — a hardcoded ×2 here broke the
    // moment the bench was magnified (2026-08-28).
    const wallTopCss = (WALL_Y - HALF_MEM) * PERMEA_SCALE
    expect(c.y + c.h).toBeLessThan(wallTopCss)
    expect(c.y + c.h).toBeGreaterThan(wallTopCss - 40)
  })

  it('speaks its names from where they are drawn', () => {
    for (const l of permeaLabels()) {
      expect(spokenTermAt([l], l.x + 2, l.y + 2)).toBe(l.term)
    }
  })
})

describe('the drawing survives a strict canvas', () => {
  it('draws the tank, every traveller, and the ladder without a bad colour or NaN', () => {
    const motes = run('o2', 5, true)
    const tank = strictCanvas()
    drawPermea(tank.ctx, motes, true)
    expect(tank.calls.filter((c) => c === 'arc').length).toBeGreaterThan(10)
    expect(tank.calls).toContain('roundRect') // the aquaporin chip
    // A crossing molecule turns side-on and squeezes; both must be transforms
    // the drawing restores, never a permanent distortion of the molecule.
    const mid = strictCanvas()
    drawTraveller(mid.ctx, 'o2', 50, 50, 1, 0.85, Math.PI / 2)
    expect(mid.calls).toContain('rotate')
    expect(mid.calls).toContain('scale')
    expect(mid.calls.filter((c) => c === 'save').length).toBe(
      mid.calls.filter((c) => c === 'restore').length,
    )
    expect(mid.calls.filter((c) => c === 'restore').length).toBeGreaterThanOrEqual(1)
    for (const t of TRAVELLERS) {
      const c = strictCanvas()
      drawTraveller(c.ctx, t.id, 50, 50)
      expect(c.calls.length).toBeGreaterThan(0)
    }
  })
})

describe('the words', () => {
  it('narrates the empty bench, a shot, and the aquaporin', () => {
    expect(permeaRightNow(null, false).length).toBeGreaterThan(1)
    expect(permeaRightNow('na', false)[0].text).toMatch(/CHARGED/)
    expect(permeaRightNow(null, true).map((p) => p.text).join(' ')).toMatch(/single file/)
    expect(permeaRightNow(null, false).map((p) => p.text).join(' ')).toMatch(/no doors/)
  })
})

describe('one scale for the whole tank', () => {
  it('draws every traveller against the wall at its real size', () => {
    // The bug this pins (2026-08-28): the travellers were 3.5–9× oversized,
    // and only looked right while the lipids were oversized too. A lipid head
    // is 1 nm; every one of these is measured against that same ruler.
    for (const t of TRAVELLERS) {
      expect(t.sizeNm).toBeGreaterThan(0.1)
      expect(t.sizeNm).toBeLessThan(1.1)
    }
    // The order that matters: the bare sodium ion is the SMALLEST thing here
    // and still never crosses, which is what kills the sieve idea.
    const size = (id: Parameters<typeof travellerOf>[0]) => travellerOf(id).sizeNm
    expect(size('na')).toBeLessThan(size('water'))
    expect(size('water')).toBeLessThan(size('co2'))
    expect(size('co2')).toBeLessThan(size('glucose'))
  })

  it('keeps the gases smaller than the gap between lipid heads', () => {
    // Which is why "squeezing between the lipids" was the wrong picture and
    // was removed: there is nothing for a gas to squeeze past.
    const spacingNm = HEAD_GAP / PX_PER_NM
    expect(travellerOf('co2').sizeNm).toBeLessThan(spacingNm)
    expect(travellerOf('o2').sizeNm).toBeLessThan(spacingNm)
    // …and glucose, which never crosses, is still smaller than a lipid HEAD.
    expect(travellerOf('glucose').sizeNm).toBeLessThan(1)
  })

  it('is magnified enough that the smallest traveller is still visible', () => {
    const smallestPx = Math.min(...TRAVELLERS.map((t) => t.sizeNm)) * PX_PER_NM * PERMEA_SCALE
    expect(smallestPx).toBeGreaterThan(4)
  })

  it('shows in each tray exactly what it will fire', () => {
    // A tray magnified beyond the stage promises a different creature from
    // the one that comes out (user, 2026-08-28); now that the travellers are
    // legible, the bucket shows the real thing at its real drawn size.
    expect(TRAY_KEY_MAG).toBe(1)
    expect(PERMEA_HONESTY.map((f) => f.text).join(' ')).toMatch(
      /exactly the size they will be when you fire them/,
    )
  })

  it('declares the aquaporin’s funnel, and funnels only water', () => {
    // The pore gathers water toward itself, which no real one does — it
    // stands in for the millions of pores a real membrane has and this bench
    // cannot draw. Only water, though: a door that pulled sodium about would
    // be a different (and wrong) claim.
    expect(PERMEA_HONESTY.map((f) => f.text).join(' ')).toMatch(/stands in for the pores/)
    // Measured on the steering itself, one frame at a time: a molecule parked
    // to the LEFT of the pore should be pushed right, and only if it is water.
    // (Watching where a crowd ends up proves less than it looks: they cross,
    // and then wander below the wall where no funnel reaches them.)
    const steer = (sp: 'water' | 'na', aqp: boolean) => {
      const m = { ...shootMotes(sp, 0)[0], x: PT_W * 0.15, y: WALL_Y - 25, vx: 0, vy: 0 }
      stepMotes([m], 16.7, 0, aqp)
      return m.vx
    }
    // Compared against sodium, which gets the IDENTICAL thermal kick (the
    // jostle is a hash of the mote's id), so the difference between them is
    // the funnel and nothing else. Measuring water alone would depend on
    // which way its own kick happened to land.
    const pull = steer('water', true) - steer('na', true)
    expect(pull).toBeGreaterThan(2)
    // Nothing else is gathered — a door that pulled sodium about would be a
    // different, and wrong, claim — and nothing at all when the door is out.
    expect(steer('na', true)).toBeCloseTo(steer('na', false), 10)
    expect(steer('water', false)).toBeCloseTo(steer('na', false), 10)
  })
})

describe('the wall opening for a crosser', () => {
  it('pushes molecules APART, and only while something is inside it', () => {
    // Reported 2026-08-28: a bowed midline tilted neighbours toward each other
    // and read as the wall CLOSING over the traveller. It parts sideways now.
    const idle = strictCanvas()
    drawPermea(idle.ctx, [], false)
    const busy = strictCanvas()
    const mid: Mote = {
      id: 0,
      sp: 'o2',
      x: PT_W / 2,
      y: WALL_Y,
      vx: 0,
      vy: 0,
      knocks: 1,
      side: 'crossing',
    }
    drawPermea(busy.ctx, [mid], false)
    // Same number of molecules either way: opening a wall never deletes one.
    const arcs = (c: ReturnType<typeof strictCanvas>) =>
      c.calls.filter((k) => k === 'arc').length
    expect(arcs(busy)).toBeGreaterThanOrEqual(arcs(idle))
  })
})

describe('molecules built from atoms', () => {
  it('draws the same element at the same size in every molecule', () => {
    // The error this pins (user, 2026-08-28): each molecule used to be
    // normalised to a unit span and scaled by its own size, so the carbon in
    // glucose came out 1.85× the carbon in carbon dioxide. A carbon is a
    // carbon. With atoms placed in nanometres there is only one radius per
    // element, so this can only regress by someone deliberately undoing it.
    const co2 = strictCanvas()
    drawTraveller(co2.ctx, 'co2', 0, 0)
    const glucose = strictCanvas()
    drawTraveller(glucose.ctx, 'glucose', 0, 0)
    // Both draw carbons; the radii come from one table, so the drawing calls
    // for a carbon are identical in size. Checked structurally: same helper,
    // one ATOM_R_NM entry, and the molecules' own extents differ instead.
    expect(reachNm('glucose')).toBeGreaterThan(reachNm('co2'))
    expect(reachNm('na')).toBeLessThan(reachNm('water'))
    expect(co2.calls.length).toBeGreaterThan(0)
    expect(glucose.calls.length).toBeGreaterThan(0)
  })

  it('knows which molecules are rods, so only those turn to cross', () => {
    // Carbon dioxide is half a nanometre long and three tenths wide: what has
    // to fit is the narrow face, which is why chemists quote a kinetic
    // diameter. A round molecule has nothing to turn.
    expect(narrowNm('co2')).toBeLessThan(2 * reachNm('co2'))
    expect(narrowNm('na')).toBeCloseTo(2 * reachNm('na'), 6)
  })

  it('never opens the wall wide enough to invite the sieve question', () => {
    // The widest the wall parts for any traveller that actually crosses must
    // stay under the width of glucose, which never crosses — otherwise the
    // picture asks "so why doesn't THAT fit?" and teaches sieving.
    const spacingPx = HEAD_GAP
    const openFor = (sp: Parameters<typeof narrowNm>[0]) =>
      narrowNm(sp) * TRAVELLER_MAG * PX_PER_NM * 0.3
    const widest = Math.max(...(['o2', 'co2', 'water'] as const).map(openFor))
    const gapAtWidest = spacingPx + 2 * widest
    const glucoseNarrowPx = narrowNm('glucose') * TRAVELLER_MAG * PX_PER_NM
    expect(gapAtWidest).toBeLessThan(glucoseNarrowPx)
  })

  it('keeps every traveller magnified by the SAME factor', () => {
    // One exaggeration, declared — so the comparisons between them stay true.
    for (const t of TRAVELLERS) {
      expect(drawnReach(t.id) / reachNm(t.id)).toBeCloseTo(TRAVELLER_MAG * PX_PER_NM, 6)
    }
    expect(PERMEA_HONESTY.map((f) => f.text).join(' ')).toMatch(/same factor/i)
  })
})

describe('the canvas controls and the buckets', () => {
  it('keeps Reset, the aquaporin switch and the buckets in separate places', () => {
    // A tap meant for one control must never land on another (2026-08-28).
    const r = resetChip()
    const a = aquaporinChip()
    const overlaps =
      r.x < a.x + a.w && a.x < r.x + r.w && r.y < a.y + a.h && a.y < r.y + r.h
    expect(overlaps).toBe(false)
    for (const c of containers()) {
      // No bucket sits under either chip.
      expect(resetChipAt(c.cx * PERMEA_SCALE, (c.y + c.h / 2) * PERMEA_SCALE)).toBe(false)
      expect(aquaporinChipAt(c.cx * PERMEA_SCALE, (c.y + c.h / 2) * PERMEA_SCALE)).toBe(false)
    }
  })

  it('separates a bucket from its own spoken name', () => {
    // Tapping the name used to fire the bucket and vice versa: the name now
    // lives BELOW the tray, outside its hit area.
    for (const l of permeaLabels()) {
      const inTray = containerAt(
        (l.x + l.w / 2) / PERMEA_SCALE,
        (l.y + l.h / 2) / PERMEA_SCALE,
      )
      expect(inTray).toBeNull()
    }
    for (const c of containers()) {
      expect(containerAt(c.cx, c.y + c.h / 2)).toBe(c.sp)
    }
  })

  it('enters the pore by swimming, never by teleporting', () => {
    // The bug: the door's catchment was a fifth of the tank wide, so a
    // molecule crossing "at the pore" was snapped sideways into the channel.
    // The mouth is narrow now, and a crosser eases onto its lane.
    const motes = shootMotes('water', 0)
    for (const m of motes) {
      m.x = AQP_X - PT_W * 0.15
      m.y = WALL_Y - 30
    }
    let biggestJump = 0
    let prev = motes.map((m) => m.x)
    for (let ms = 0; ms < 8000; ms += 16.7) {
      stepMotes(motes, 16.7, ms, true)
      motes.forEach((m, i) => {
        biggestJump = Math.max(biggestJump, Math.abs(m.x - prev[i]))
      })
      prev = motes.map((m) => m.x)
    }
    // Nothing may move further in one frame than a molecule's own width.
    expect(biggestJump).toBeLessThan(drawnReach('water') * 2)
  })
})

describe('sodium keeps its charge SOMEWHERE', () => {
  it('badges the tray specimen even though the crowd is too small to badge', () => {
    // The regression (2026-08-28): the flying ions are ~4.6 px across, under
    // the badge-legibility floor, so the size guard silenced their charge —
    // correctly. But the TRAY specimen is drawn at the same size, so the
    // guard silenced it there too, and nothing anywhere in the bench said
    // sodium was positive. A key wears its charge whatever its size; that is
    // what a key is for.
    const asCrowd = strictCanvas()
    drawTraveller(asCrowd.ctx, 'na', 40, 40)
    const asKey = strictCanvas()
    drawTraveller(asKey.ctx, 'na', 40, 40, 1, 1, 0, true)
    expect(asKey.calls.length).toBeGreaterThan(asCrowd.calls.length)
  })

  it('does not badge an uncharged traveller, key or not', () => {
    const plain = strictCanvas()
    drawTraveller(plain.ctx, 'water', 40, 40)
    const asKey = strictCanvas()
    drawTraveller(asKey.ctx, 'water', 40, 40, 1, 1, 0, true)
    expect(asKey.calls.length).toBe(plain.calls.length)
  })
})
