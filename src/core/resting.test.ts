import { describe, expect, it } from 'vitest'
import {
  EMPTY_WALL,
  MAX_DOORS,
  REAL_WALL,
  RESTING_HONESTY,
  RESTING_PARTS,
  SAME_MV,
  VOTERS,
  alongTug,
  conductancesOf,
  contentAt,
  restingMvOf,
  backgroundPartOf,
  restingRightNow,
  shareOf,
  stateOf,
  tugEnds,
  type Doors,
} from './resting'
import { REST_MV } from './capacitor'
import { ION_KINDS } from './ions'

const WALLS: Doors[] = [
  EMPTY_WALL,
  REAL_WALL,
  { k: 4, cl: 0, na: 0 },
  { k: 1, cl: 0, na: 3 },
  { k: 0, cl: 0, na: 3 },
]

describe('the resting potential is a weighted vote', () => {
  it('lands a real cell\'s wall on the resting voltage the app commits to', () => {
    // ⚠ THE COROBORATION THIS EXHIBIT RESTS ON, and it was not arranged: one
    // potassium door against the app's own declared background leak, on its
    // own declared concentrations, through the same chord-conductance function
    // the action potential uses, comes out on the resting voltage the rest of
    // the app was already using. If these two ever disagree, one is wrong.
    expect(restingMvOf(REAL_WALL)).toBeCloseTo(REST_MV, 0)
    expect(stateOf(REAL_WALL).word).toBe('Resting')
  })

  it('sits between the ions, and much nearer potassium at rest', () => {
    expect(contentAt('k')).toBeLessThan(-80)
    expect(contentAt('na')).toBeGreaterThan(50)
    // Chloride sits BETWEEN them, which is why it can pull either way.
    expect(contentAt('cl')).toBeGreaterThan(contentAt('k'))
    expect(contentAt('cl')).toBeLessThan(contentAt('na'))
    expect(alongTug(restingMvOf(REAL_WALL))).toBeLessThan(0.25)
  })

  it('moves toward the ion whose doors you add, and only then', () => {
    // ⚠ A result that does not change when the input changes is a broken
    // parameter.
    expect(restingMvOf({ k: 4, cl: 0, na: 0 })).toBeLessThan(restingMvOf(REAL_WALL))
    expect(restingMvOf({ k: 1, cl: 0, na: 3 })).toBeGreaterThan(restingMvOf(REAL_WALL))
    // A weighted average of numbers cannot leave the interval they span.
    for (const w of WALLS) {
      expect(restingMvOf(w)).toBeGreaterThan(contentAt('k'))
      expect(restingMvOf(w)).toBeLessThan(contentAt('na'))
    }
    // Strictly monotone in the doors, so every single door the child adds
    // moves the answer — never a step that does nothing.
    let last = restingMvOf(EMPTY_WALL)
    for (let k = 1; k <= MAX_DOORS; k++) {
      const now = restingMvOf({ k, cl: 0, na: 0 })
      expect(now).toBeLessThan(last)
      last = now
    }
  })

  it('answers "what is chloride for" by letting it become the loudest', () => {
    // ⚠ Chloride had a share on the board and nothing to explain it (user,
    // 2026-08-30). Take every potassium door out and it is suddenly most of
    // the vote, and it drags the membrane to its own voltage — which is what
    // it was quietly doing all along.
    const bare = shareOf(EMPTY_WALL, 'cl')
    expect(bare).toBeGreaterThan(0.7)
    expect(bare).toBeGreaterThan(shareOf(REAL_WALL, 'cl'))
    // And where it lands is chloride's doing. ⚠ NOT "closer to E_Cl than
    // before" — that was the first version of this test and it was FALSE: a
    // real wall already sits at −72, which happens to be within 8 mV of
    // chloride's −64, while the stripped wall sits at −41, some 23 mV away.
    // The truth is the one worth teaching: with potassium's pull gone,
    // chloride is what is holding the membrane anywhere near negative at all.
    const v = restingMvOf(EMPTY_WALL)
    expect(Math.abs(v - contentAt('cl'))).toBeLessThan(Math.abs(v - contentAt('na')))
    expect(v).toBeLessThan(0)
    // And it has moved AWAY from potassium's end, because potassium lost its
    // voice — not toward it.
    expect(alongTug(v)).toBeGreaterThan(alongTug(restingMvOf(REAL_WALL)))
  })

  it('gives the loudest ion the biggest share, every time', () => {
    for (const w of WALLS) {
      const total = ION_KINDS.reduce((sum, ion) => sum + shareOf(w, ion), 0)
      expect(total).toBeCloseTo(1, 9)
    }
    expect(shareOf(REAL_WALL, 'k')).toBeGreaterThan(shareOf(REAL_WALL, 'na'))
    expect(shareOf({ k: 1, cl: 0, na: 3 }, 'na')).toBeGreaterThan(shareOf({ k: 1, cl: 0, na: 3 }, 'k'))
  })

  it('leaves the membrane something that can cross even when stripped bare', () => {
    // A wall with no conductance has no voltage at all and the equation would
    // return a bare zero rather than an answer. Real membranes always leak.
    const g = conductancesOf(EMPTY_WALL)
    expect(ION_KINDS.reduce((sum, ion) => sum + g[ion], 0)).toBeGreaterThan(0)
    expect(Number.isFinite(restingMvOf(EMPTY_WALL))).toBe(true)
  })

  it('names the state against a REAL cell, never on its own', () => {
    // ⚠ "Hyperpolarised" and "depolarised" are defined relative to a cell's
    // own resting potential and describe a cell MOVED off it. A wall built
    // with different doors is a different membrane resting somewhere else, so
    // every reading has to carry what it is being compared with.
    for (const w of WALLS) {
      const st = stateOf(w)
      expect(st.line).toMatch(/rests at/)
      expect(st.line).toMatch(/real cell/)
    }
    expect(stateOf({ k: 8, cl: 0, na: 0 }).word).toBe('Hyperpolarised')
    expect(stateOf({ k: 0, cl: 0, na: 4 }).word).toBe('Depolarised')
    // The band around a real cell is what "the same" means, and it is small.
    expect(SAME_MV).toBeLessThan(12)
  })

  it('scales the tug to the ions, not to round numbers', () => {
    const ends = tugEnds()
    expect(ends.from).toBeCloseTo(contentAt('k'), 9)
    expect(ends.to).toBeCloseTo(contentAt('na'), 9)
    expect(alongTug(ends.from)).toBe(0)
    expect(alongTug(ends.to)).toBe(1)
    // Every voter has an end on that scale, including chloride.
    for (const ion of VOTERS) {
      expect(alongTug(contentAt(ion))).toBeGreaterThanOrEqual(0)
      expect(alongTug(contentAt(ion))).toBeLessThanOrEqual(1)
    }
  })

  it('reads its numbers off the model rather than repeating them', () => {
    for (const w of WALLS) {
      const said = restingRightNow(w).map((p) => p.text).join(' ')
      expect(said).toContain(`${Math.abs(restingMvOf(w)).toFixed(0)} mV`)
      expect(said).toContain(`${w.k} potassium door`)
    }
  })

  it('says plainly that the pump is not in the equation', () => {
    const said = [...RESTING_PARTS, ...RESTING_HONESTY].map((p) => p.text).join(' ')
    expect(said).toMatch(/pump/i)
    expect(said).toMatch(/not in (this|the) equation|no battery, and no pump/i)
  })
})

describe('chloride has a say, and the board says where it comes from', () => {
  // ⚠ "Cl⁻ is displayed in the equation, but the channels are not present"
  // (user, 2026-08-30). It is real — every membrane is slightly permeable to
  // everything through doors too many to draw, and for chloride that leak is
  // large — but a number with nothing behind it on the board is a number from
  // nowhere. Two answers: the leak is drawn as the paler part of each bar, and
  // chloride can now be given doors of its own.
  it('gives chloride a say with no chloride door in the wall', () => {
    expect(REAL_WALL.cl).toBe(0)
    expect(shareOf(REAL_WALL, 'cl')).toBeGreaterThan(0.2)
    // And ALL of that say is background, because it earned none from doors.
    expect(backgroundPartOf(REAL_WALL, 'cl')).toBeCloseTo(1, 6)
  })

  it('lets a chloride door earn it a say of its own', () => {
    const withDoor: Doors = { k: 1, cl: 2, na: 0 }
    expect(shareOf(withDoor, 'cl')).toBeGreaterThan(shareOf(REAL_WALL, 'cl'))
    // The background is now a SMALLER fraction of a bigger share — which is
    // exactly what the paler part of the bar has to shrink to show.
    expect(backgroundPartOf(withDoor, 'cl')).toBeLessThan(
      backgroundPartOf(REAL_WALL, 'cl'),
    )
  })

  it('pulls the membrane toward what chloride wanted', () => {
    // A door has to DO something, or it is a decoration.
    const many: Doors = { k: 0, cl: 6, na: 0 }
    expect(Math.abs(restingMvOf(many) - contentAt('cl'))).toBeLessThan(
      Math.abs(restingMvOf(EMPTY_WALL) - contentAt('cl')),
    )
  })

  it('says potassium has no background at all', () => {
    // Which is why stripping its doors silences it completely, and why that is
    // the demonstration that makes chloride visible.
    expect(backgroundPartOf(EMPTY_WALL, 'k')).toBe(0)
    expect(shareOf(EMPTY_WALL, 'k')).toBe(0)
  })
})
