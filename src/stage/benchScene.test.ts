import { describe, expect, it } from 'vitest'
import { ballsOf, fieldDirection, marksPerSide, radiusOf,
  ballSlot,
  PER_BALL_MM,
} from './benchScene'
import { needsIonKey } from './particleStyle'
import { VM_MAX, VM_MIN } from '../core/voltage'
import { pushesOn } from '../core/balance'
import { ION_KINDS, IONS, particlesFor } from '../core/ions'
import type { IonCounts } from '../state/ionStore'

const realCounts: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

// The battery dial's whole job is to be READABLE without reading a number, so
// what the marks and arrows claim has to be checked against the physics rather
// than looked at.

describe('charge marks', () => {
  it('shows nothing when there is nothing held apart', () => {
    expect(marksPerSide(0)).toBe(0)
  })

  it('grows with the voltage, because Q = C·V', () => {
    // Not merely monotonic — proportional. Twice the voltage really is twice the
    // charge separated, and a row that fudged that would be teaching a shape
    // rather than a quantity.
    const at = (mv: number) => marksPerSide(mv)
    expect(at(95)).toBe(2 * at(47.5))
    expect(at(60)).toBeGreaterThan(at(30))
    expect(at(30)).toBeGreaterThan(at(10))
  })

  it('does not care which way the charge is held, only how much', () => {
    for (const mv of [10, 40, 72, 95]) {
      expect(marksPerSide(-mv)).toBe(marksPerSide(mv))
    }
  })

  it('stays on the row it is given at the ends of the dial', () => {
    for (const mv of [VM_MIN, VM_MAX]) {
      expect(marksPerSide(mv)).toBeLessThanOrEqual(6)
      expect(marksPerSide(mv)).toBeGreaterThan(0)
    }
  })
})

describe('the field across the membrane', () => {
  // +1 is toward the cytoplasm, the side drawn below.
  it('pulls a cation IN when the inside is negative', () => {
    expect(fieldDirection(-72)).toBe(1)
    expect(fieldDirection(-95)).toBe(1)
  })

  it('pushes a cation OUT when the inside is positive', () => {
    expect(fieldDirection(75)).toBe(-1)
    expect(fieldDirection(1)).toBe(-1)
  })

  it('turns right round as the dial crosses zero', () => {
    expect(fieldDirection(-1)).toBe(-fieldDirection(1))
  })
})

describe('the arrow and the arithmetic agree', () => {
  // The one check that matters. `pushesOn` states the electrical push on an ion
  // as a signed number where POSITIVE means inward; the arrow states the same
  // fact as a direction. If these two ever disagree the picture contradicts the
  // panel sitting next to it, and the panel is the one people believe.
  it('matches the sign of the charge push, for every cation and every setting', () => {
    for (const mv of [-95, -72, -40, -8, 8, 40, 75, VM_MAX, VM_MIN]) {
      for (const ion of ION_KINDS) {
        if (IONS[ion].charge < 0) continue
        const push = pushesOn(ion, realCounts, mv).charge
        expect(Math.sign(push)).toBe(fieldDirection(mv))
      }
    }
  })

  it('sends an ANION the other way, which is why the arrow is drawn for a cation', () => {
    // Chloride at a negative interior is repelled outward by the very field that
    // is pulling potassium in. One arrow cannot speak for both, so it speaks for
    // the positive ion and the per-ion push arrows carry the rest.
    const push = pushesOn('cl', realCounts, -72).charge
    expect(Math.sign(push)).toBe(-fieldDirection(-72))
  })
})


describe('the balls in a chamber', () => {
  it('draws none at all when there is nothing in it', () => {
    // The bug this catches: the split is drawn as "the first N are outside, the
    // rest are inside", so a chamber with nothing in it reported zero outside and
    // therefore ALL of them inside — empty both sides and sixty balls appeared in
    // the cytoplasm. Something out of nothing, in the one exhibit whose promise is
    // that balls are conserved.
    expect(ballsOf(0, 0).total).toBe(0)
    expect(ballsOf(0, 0).outsideBalls).toBe(0)
  })

  it('draws a FIXED amount per ball, so a pile means the same thing everywhere', () => {
    // This test used to assert the opposite — that the set is always the same
    // size and each ball is a share of whatever is there. That was the bug
    // (user, 2026-08-28): empty the inside and drop the outside to a trace,
    // and the trace was still drawn as a chamber packed with sixty balls,
    // because "all of it outside" is the same RATIO whether there is a lot or
    // almost none. A quantity drawn as a count must have a fixed value per
    // item, or it is not a count.
    expect(ballsOf(145, 15).total).toBeGreaterThan(ballsOf(5, 5).total)
    expect(ballsOf(0, 145).total).toBe(ballsOf(145, 0).total)
    // Twice the stuff, twice the balls.
    expect(ballsOf(0, 100).total).toBe(2 * ballsOf(0, 50).total)
    // And a ball is worth the same in every chamber and at every setting.
    expect(ballsOf(145, 15).perBall).toBe(ballsOf(5, 0).perBall)
  })

  it('shows a trace as a trace — never as nothing, never as a crowd', () => {
    // Below one ball's worth, but present: one ball. Vanishing would say the
    // chamber is empty when it is not.
    expect(ballsOf(1, 0).total).toBe(1)
    expect(ballsOf(0, 1).total).toBe(1)
    expect(ballsOf(1, 0).total).toBeLessThan(ballsOf(145, 0).total)
  })

  it('puts them all on the side that has them', () => {
    const set = ballsOf(145, 0)
    expect(set.outsideBalls).toBe(set.total)
    expect(ballsOf(0, 15).outsideBalls).toBe(0)
  })

  it('is the bug report, exactly: nothing inside and little outside', () => {
    // "I make inside of the cell zero and going down with the outside, and
    // outside the ions appear in the big quantity." They did: sixty of them.
    const emptied = ballsOf(5, 0)
    expect(emptied.outsideBalls).toBeLessThan(4)
    expect(emptied.total).toBe(emptied.outsideBalls)
    // …and it keeps falling as the slider does, instead of holding steady.
    expect(ballsOf(40, 0).outsideBalls).toBeGreaterThan(ballsOf(20, 0).outsideBalls)
    expect(ballsOf(20, 0).outsideBalls).toBeGreaterThan(ballsOf(5, 0).outsideBalls)
  })
})

describe('ions too small to label', () => {
  it('draws its crowd below the legibility floor — which is why the header carries a key', () => {
    // The rule (2026-08-28): under ION_LABEL_MIN_PX an ion cannot wear its own
    // badge or name, so the VIEW must show a specimen at readable size in its
    // chrome instead of shrinking labels onto the stage. This bench is the
    // case that produced the rule; the test states why the key exists, so
    // nobody deletes it as decoration.
    for (const kind of ION_KINDS) {
      for (const w of [200, 260, 320]) {
        expect(needsIonKey(radiusOf(kind, w))).toBe(true)
      }
    }
  })
})

describe('the two crowds keep their places', () => {
  it('reports both sides, and the two add up', () => {
    const b = ballsOf(145, 15)
    expect(b.outsideBalls + b.insideBalls).toBe(b.total)
  })

  it('does not move an INSIDE ball when the outside changes', () => {
    // ⚠ The bug (2026-08-28). Balls shared one index space — outside first,
    // then inside — so adding ions to the outside re-labelled which balls
    // were inside. Two that had been in the cytoplasm jumped out through the
    // wall and two appeared inside from nowhere, for a change the child made
    // to the OUTSIDE only. Conservation broken by a numbering scheme.
    const W = 200
    const at = (rank: number) => ballSlot(rank, false, W, 80, 0, 80, 100)
    const before = ballsOf(145, 15)
    const after = ballsOf(195, 15)
    expect(after.outsideBalls).toBeGreaterThan(before.outsideBalls)
    // The inside crowd is the same size…
    expect(after.insideBalls).toBe(before.insideBalls)
    // …and every one of them is in exactly the same place.
    for (let k = 0; k < before.insideBalls; k++) expect(at(k)).toEqual(at(k))
    // A side's rank is all a ball needs: nothing about the other side is in
    // the sum that decides where it sits.
    expect(ballSlot(2, false, W, 80, 0, 80, 100)).toEqual(
      ballSlot(2, false, W, 80, 0, 80, 100),
    )
    expect(ballSlot(2, true, W, 80, 0, 80, 100)).not.toEqual(
      ballSlot(2, false, W, 80, 0, 80, 100),
    )
  })

  it('keeps the amounts the steppers ask for', () => {
    // What the user reported: the toggles should show the amount they set.
    // A press is PARTICLE_STEP, and one ball is PER_BALL_MM of it.
    const step = ballsOf(100, 0).outsideBalls - ballsOf(90, 0).outsideBalls
    expect(step).toBe(10 / PER_BALL_MM)
    expect(ballsOf(150, 0).outsideBalls).toBe(150 / PER_BALL_MM)
    expect(ballsOf(0, 150).insideBalls).toBe(150 / PER_BALL_MM)
  })
})
