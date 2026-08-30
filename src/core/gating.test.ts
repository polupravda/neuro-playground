import { describe, expect, it } from 'vitest'
import {
  FAMILIES,
  EC50_UM,
  HILL_N,
  V_HALF_MV,
  P_HALF_MMHG,
  GATING_WINDOW_MS,
  GATING_PARTS,
  GATING_HONESTY,
  familyOf,
  openProbabilityOf,
  respondsTo,
  familyRecord,
  familyMeasuredPo,
  poUpTo,
  familyOpenAt,
  curveOf,
  curveRange,
  gatingRightNow,
  isGated,
  type FamilyId,
} from './gating'


describe('three families, one kind of door', () => {
  it('gives each family its own cause and its own dial', () => {
    expect(FAMILIES.map((f) => f.id)).toEqual(['leak', 'voltage', 'ligand', 'mechanical'])
    for (const f of FAMILIES) {
      // The leak has one setting — it has no gate, so it has no dial.
      expect(f.steps.length).toBeGreaterThanOrEqual(isGated(f.id) ? 3 : 1)
      // Low to high, so a dial reads left to right.
      const values = f.steps.map((s) => s.value)
      expect([...values].sort((a, b) => a - b)).toEqual(values)
      expect(f.opensWhen.length).toBeGreaterThan(10)
    }
  })

  it('⚠ makes each door DEAF to the other causes', () => {
    // The whole lesson, and the thing that would be easiest to lose: a bench
    // where every lane quietly answered every dial would look fine and teach
    // the opposite of "gated".
    for (const f of FAMILIES) {
      for (const other of FAMILIES) {
        expect(respondsTo(f.id, other.id)).toBe(f.id === other.id)
      }
    }
  })

  it('opens each family half the time at its own half-point', () => {
    // The laws, checked at the number each one is named by.
    expect(openProbabilityOf('voltage', V_HALF_MV)).toBeCloseTo(0.5, 6)
    expect(openProbabilityOf('ligand', EC50_UM)).toBeCloseTo(0.5, 6)
    expect(openProbabilityOf('mechanical', P_HALF_MMHG)).toBeCloseTo(0.5, 6)
  })

  it('climbs, and never past certainty or below never', () => {
    for (const f of FAMILIES.filter((x) => isGated(x.id))) {
      const [lo, hi] = curveRange(f.id)
      expect(openProbabilityOf(f.id, hi)).toBeGreaterThan(openProbabilityOf(f.id, lo))
      for (const p of curveOf(f.id)) {
        expect(p.po).toBeGreaterThanOrEqual(0)
        expect(p.po).toBeLessThanOrEqual(1)
      }
    }
  })

  it('needs TWO messengers, which is what makes the ligand curve S-shaped', () => {
    // A Hill coefficient of 1 would be a slow climb from nothing; 2 is a
    // curve that hangs back and then goes. Check the shape, not the constant.
    expect(HILL_N).toBe(2)
    const quarter = openProbabilityOf('ligand', EC50_UM / 2)
    // With n = 2, half the EC50 gives a fifth, not a quarter — the hanging
    // back is real and measurable.
    expect(quarter).toBeLessThan(0.25)
    expect(quarter).toBeGreaterThan(0.15)
  })

  it('gives every dial setting a visibly different answer', () => {
    // A result that does not change when the input changes is a broken
    // parameter. Every step of every dial has to move the odds.
    for (const f of FAMILIES.filter((x) => isGated(x.id))) {
      const odds = f.steps.map((s) => openProbabilityOf(f.id, s.value))
      for (let i = 1; i < odds.length; i++) {
        expect(odds[i] - odds[i - 1]).toBeGreaterThan(0.15)
      }
    }
  })
})

describe('reading it off the record', () => {
  it('MEASURES how much of the time it was open, never reads the law', () => {
    // Measure, never assert — and keep the disagreement, because the
    // disagreement is what tells a child this is a measurement.
    let differed = 0
    for (const f of FAMILIES.filter((x) => isGated(x.id))) {
      for (const step of f.steps) {
        const measured = familyMeasuredPo(f.id, step.value)
        const law = openProbabilityOf(f.id, step.value)
        expect(measured).toBeGreaterThanOrEqual(0)
        expect(measured).toBeLessThanOrEqual(1)
        // Near the law, but not identical to it.
        expect(Math.abs(measured - law)).toBeLessThan(0.15)
        if (Math.abs(measured - law) > 1e-6) differed++
      }
    }
    expect(differed).toBeGreaterThan(0)
  })

  it('fills as the run goes, and lands on the final reading', () => {
    const id: FamilyId = 'voltage'
    const at = familyOf(id).steps[1].value
    const record = familyRecord(id, at)
    expect(poUpTo(record, 0)).toBe(0)
    expect(poUpTo(record, GATING_WINDOW_MS)).toBeCloseTo(familyMeasuredPo(id, at), 9)
    for (const ms of [50, 150, 300]) {
      expect(poUpTo(record, ms)).toBeGreaterThanOrEqual(0)
      expect(poUpTo(record, ms)).toBeLessThanOrEqual(1)
    }
  })

  it('has the door and the record agreeing at every moment', () => {
    // The picture and the paper are one fact seen twice.
    for (const f of FAMILIES.filter((x) => isGated(x.id))) {
      const at = f.steps[1].value
      const record = familyRecord(f.id, at)
      for (let ms = 0; ms < GATING_WINDOW_MS; ms += 7) {
        const fromRecord = record.some((d) => d.open && ms >= d.fromMs && ms < d.toMs)
        expect(familyOpenAt(f.id, at, ms)).toBe(fromRecord)
      }
    }
  })

  it('is seeded, and the three lanes are not one flicker three times', () => {
    expect(familyRecord('voltage', 0)).toEqual(familyRecord('voltage', 0))
    const edges = (id: FamilyId) =>
      familyRecord(id, familyOf(id).steps[familyOf(id).steps.length - 1].value).map((d) => d.fromMs)
    expect(edges('voltage')).not.toEqual(edges('ligand'))
    expect(edges('ligand')).not.toEqual(edges('mechanical'))
  })
})

describe('what it says', () => {
  it('teaches the deafness and the never-wider rule', () => {
    const said = GATING_PARTS.map((p) => p.text).join(' ')
    expect(said).toMatch(/deaf|nothing at all|ignores/i)
    expect(said).toMatch(/how OFTEN|more gold|never with taller/i)
    // Inactivation IS shown now — the ball plugging its own pore — so the
    // words have to name it.
    expect(said).toMatch(/INACTIVATION/i)
  })

  it('declares what is calibrated and what is left out', () => {
    const honesty = GATING_HONESTY.map((p) => p.text).join(' ')
    expect(honesty).toMatch(/CALIBRATED/)
    expect(honesty).toMatch(/SEEDED/)
    expect(honesty).toMatch(/SIMPLIFIED/)
    // ⚠ The voltage-gated channel's real SENSOR is a thing this bench does not
    // draw — the traced source does not show one — and saying so is the
    // difference between simplifying and misleading (2026-08-29).
    expect(honesty).toMatch(/VOLTAGE SENSOR/i)
  })

  it('says something different for each family, right now', () => {
    const busy = FAMILIES.reduce(
      (acc, f) => {
        acc[f.id] = f.id === 'voltage'
        return acc
      },
      {} as Record<FamilyId, boolean>,
    )
    const said = gatingRightNow(busy)
    expect(said).toHaveLength(FAMILIES.length)
    expect(new Set(said.map((p) => p.text)).size).toBe(FAMILIES.length)
  })
})
