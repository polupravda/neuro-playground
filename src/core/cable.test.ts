import { describe, expect, it } from 'vitest'
import { ION_KINDS, IONS, particlesFor } from './ions'
import type { IonCounts } from '../state/ionStore'
import { DT, FIRE_STIMULUS } from './spikeModel'
import { apRestMv } from './actionPotential'
import { hInf, mInf, nInf, tauH, tauN } from './spikeModel'
import {
  CABLE_LENGTH_UM,
  CABLE_MS,
  COMPARTMENT_UM,
  axialCoupling,
  cableFactList,
  readingOf,
  cableTrajectory,
  carried,
  decrement,
  drawnAxonFraction,
  frontAt,
  lengthConstantUm,
  sampleCable,
  stableStep,
  tabulatedGates,
  waveReport,
  type CableTrajectory,
} from './cable'

const real: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

/** Sodium's gradient flattened: the cell has as much outside as in. */
const flatSodium: IonCounts = {
  ...real,
  na: { outside: real.na.inside, inside: real.na.inside },
}

const run = cableTrajectory(real, true, FIRE_STIMULUS)
const index = (traj: CableTrajectory, fraction: number) =>
  Math.floor(fraction * (traj.x.length - 1))
/** Position 0→1 through the run, at a time in ms. */
const uAt = (traj: CableTrajectory, ms: number) => ms / traj.t[traj.t.length - 1]

describe('the cable, before any spike', () => {
  it('derives its length constant from the axon rather than being given one', () => {
    // √(d·Rm / 4·Ra) for a 1.4 µm axon with HH's leak and ordinary cytoplasm.
    // A few hundred micrometres is the answer for a thin unmyelinated fibre, and
    // if any of those three numbers changes this moves with it.
    expect(lengthConstantUm()).toBeGreaterThan(250)
    expect(lengthConstantUm()).toBeLessThan(450)
  })

  it('is many length constants long, or there would be no wave to watch', () => {
    expect(CABLE_LENGTH_UM / lengthConstantUm()).toBeGreaterThan(10)
  })

  it('resolves the cable finely enough that the grid is not doing the physics', () => {
    expect(COMPARTMENT_UM).toBeLessThanOrEqual(lengthConstantUm() / 4)
  })

  it('integrates well inside the step an explicit scheme is stable at', () => {
    // Above C/2k the diffusive term blows up — quietly, and a blown-up cable
    // looks like a very fast axon rather than like a bug.
    expect(DT).toBeLessThan(stableStep(COMPARTMENT_UM) / 10)
  })

  it('couples harder through a shorter patch, as 1/Δx² and nothing else', () => {
    expect(axialCoupling(COMPARTMENT_UM / 2) / axialCoupling(COMPARTMENT_UM)).toBeCloseTo(4, 6)
  })

  it('starts every patch at the resting voltage one patch rests at', () => {
    // The two views must not quote different numbers for the same membrane.
    expect(run.rest).toBeCloseTo(apRestMv(real, true), 6)
    for (const row of run.vm) expect(row[0]).toBeCloseTo(run.rest, 6)
  })
})

describe('what the cable does with a push at one end', () => {
  it('carries the spike the whole way', () => {
    expect(run.propagated).toBe(true)
    expect(run.reachedUm).toBeGreaterThan(CABLE_LENGTH_UM * 0.95)
  })

  it('fires the patches in order, each after the one behind it', () => {
    // The definition of regeneration, checked rather than asserted: no patch
    // crosses zero before its neighbour on the stimulated side.
    for (let i = 1; i < run.crossedAt.length; i++) {
      expect(run.crossedAt[i]).toBeGreaterThanOrEqual(run.crossedAt[i - 1])
    }
  })

  it('takes real time to get there — it is not one event everywhere at once', () => {
    const near = run.crossedAt[index(run, 0.1)]
    const far = run.crossedAt[index(run, 0.9)]
    // Several milliseconds, which is the whole reason this view is millimetres
    // long: over the 93 µm of axon drawn on the main stage the same delay is
    // about a tenth of one.
    expect(far - near).toBeGreaterThan(3)
  })

  it('does not fade on the way — all-or-nothing means what it says', () => {
    // A dendrite ripple loses most of itself over one length constant. This
    // crosses seventeen of them and arrives the same size, because every patch
    // rebuilds it.
    expect(Math.abs(decrement(run))).toBeLessThan(0.02)
    const near = run.peak[index(run, 0.25)]
    const far = run.peak[index(run, 0.75)]
    expect(far).toBeGreaterThan(0)
    expect(Math.abs(far - near)).toBeLessThan(2)
  })

  it('measures a speed in the right ballpark for a thin unmyelinated axon', () => {
    // Half a metre a second or so: slower than walking, which is exactly why
    // vertebrates bothered to invent myelin. Not typed in — the slope of when
    // each patch crossed zero.
    expect(run.speedMs).toBeGreaterThan(0.2)
    expect(run.speedMs).toBeLessThan(3)
  })

  it('reports a speed that survives the grid being refined', () => {
    // The one real risk in a cable model: a "measured" velocity that is really
    // an artefact of how coarsely the axon was chopped up, or of the time step.
    const finerSpace = cableTrajectory(real, true, FIRE_STIMULUS, {
      dxUm: COMPARTMENT_UM / 2,
    })
    const finerTime = cableTrajectory(real, true, FIRE_STIMULUS, { dtMs: DT / 2 })
    expect(finerSpace.speedMs).toBeCloseTo(run.speedMs, 1)
    expect(finerTime.speedMs).toBeCloseTo(run.speedMs, 2)
  })

  it('finishes crossing well before the run ends, so the far end can be watched', () => {
    expect(run.crossedAt[run.x.length - 1]).toBeLessThan(CABLE_MS * 0.75)
  })
})

describe('why it cannot come back', () => {
  it('leaves the patches behind the wave depolarized past rest and latched shut', () => {
    // The refractory period, doing a job rather than being asserted to exist
    // (N22 will name it). At the moment the front is three quarters of the way
    // along, look back at the quarter mark: below its resting voltage, and its
    // sodium door barely open.
    const u = uAt(run, run.crossedAt[index(run, 0.75)])
    expect(sampleCable(run, 'vm', u, 0.25)).toBeLessThan(run.rest)
    const gNaAtPeak = Math.max(...run.gNa[index(run, 0.25)])
    expect(sampleCable(run, 'gNa', u, 0.25)).toBeLessThan(gNaAtPeak * 0.02)
  })

  it('sends a push in the middle of the axon BOTH ways at once', () => {
    // The demonstration that settles the argument. Nothing that travels can go
    // two directions at the same time; a hundred patches taking their turn
    // outward from the middle can, and does, symmetrically.
    const mid = cableTrajectory(real, true, FIRE_STIMULUS, {
      stimAtUm: CABLE_LENGTH_UM / 2,
    })
    expect(mid.crossedAt[0]).toBeLessThan(Infinity)
    expect(mid.crossedAt[mid.x.length - 1]).toBeLessThan(Infinity)
    expect(mid.crossedAt[0]).toBeCloseTo(mid.crossedAt[mid.x.length - 1], 1)
  })
})

describe('when the cell cannot afford a spike', () => {
  it('propagates nothing at all once sodium has nowhere to fall', () => {
    // The same failure the single-patch model has, for the same reason, without
    // anything being written for the case: no gradient, no inward current, no
    // spike to hand on.
    const dead = cableTrajectory(flatSodium, true, FIRE_STIMULUS)
    expect(dead.propagated).toBe(false)
    expect(dead.speedMs).toBe(0)
    expect(dead.reachedUm).toBe(0)
  })
})

describe('what has actually crossed', () => {
  it('starts at nothing and never goes backwards', () => {
    // Cumulative, and only counting what crossed the right way. An ion drawn in a
    // pore is positioned by this, so if it could fall it would drag the traffic
    // backwards through the membrane.
    let last = -1
    for (let i = 0; i <= 60; i++) {
      const now = carried(run, 'na', i / 60, 0.5)
      expect(now).toBeGreaterThanOrEqual(last)
      last = now
    }
    expect(carried(run, 'na', 0, 0.5)).toBe(0)
    expect(carried(run, 'na', 1, 0.5)).toBeGreaterThan(0)
  })

  it('moves fastest while the door is widest', () => {
    // The traffic in the lens is drawn from this, so it has to be the current and
    // not a clock: most of the sodium crosses in the sliver of the run when the
    // sodium conductance is up.
    const at = (u: number) => carried(run, 'na', u, 0.5)
    const openAt = uAt(run, run.crossedAt[index(run, 0.5)])
    const during = at(openAt + 0.02) - at(openAt - 0.01)
    const after = at(Math.min(1, openAt + 0.35)) - at(Math.min(1, openAt + 0.32))
    expect(during).toBeGreaterThan(after * 5)
  })

it('puts visibly less through on a run that fails than on one that fires', () => {
    // This is the reason `carried` is an amount and not a share of its own run.
    // Sodium really does come in when the gradient is flat — with E_Na at zero
    // there is a big pull inward — it just cannot take the membrane past zero, so
    // there is no overshoot and nothing to hand on. The traffic in the lens
    // should show that as fewer ions through the pore, and a share would have
    // shown exactly as many as a real spike.
    const dead = cableTrajectory(flatSodium, true, FIRE_STIMULUS)
    expect(dead.propagated).toBe(false)
    const fails = carried(dead, 'na', 1, 0.5)
    const fires = carried(run, 'na', 1, 0.5)
    expect(fails).toBeGreaterThan(0)
    expect(fails).toBeLessThan(fires * 0.6)
  })
})

describe('reading the table', () => {
  it('returns the stored value at a stored patch and moment', () => {
    const last = run.x.length - 1
    expect(sampleCable(run, 'vm', 0, 0)).toBeCloseTo(run.vm[0][0], 6)
    expect(sampleCable(run, 'vm', 1, 1)).toBeCloseTo(
      run.vm[last][run.t.length - 1],
      6,
    )
  })

  it('clamps rather than running off either end', () => {
    expect(sampleCable(run, 'vm', -1, -1)).toBeCloseTo(run.vm[0][0], 6)
    expect(sampleCable(run, 'vm', 2, 2)).toBeCloseTo(
      run.vm[run.x.length - 1][run.t.length - 1],
      6,
    )
  })

  it('reports the front only after something has actually crossed zero', () => {
    expect(frontAt(run, 0)).toBeNull()
    const front = frontAt(run, 1)
    expect(front).not.toBeNull()
    expect(front as number).toBeGreaterThan(0.9)
  })

  it('moves the front forward through the run, never back', () => {
    let last = -1
    for (let i = 0; i <= 40; i++) {
      const front = frontAt(run, i / 40)
      if (front === null) continue
      expect(front).toBeGreaterThanOrEqual(last)
      last = front
    }
  })
})

describe('the tabulated gates', () => {
  it('agree with the functions they are built from, across everything a membrane can reach', () => {
    // The table is an optimisation and must be invisible. Checked on a grid
    // deliberately offset from the table's own, so interpolation is tested
    // rather than the stored points.
    for (let v = -139.37; v < 100; v += 0.37) {
      expect(tabulatedGates.mInf(v)).toBeCloseTo(mInf(v), 5)
      expect(tabulatedGates.hInf(v)).toBeCloseTo(hInf(v), 5)
      expect(tabulatedGates.nInf(v)).toBeCloseTo(nInf(v), 5)
      expect(tabulatedGates.tauH(v)).toBeCloseTo(tauH(v), 4)
      expect(tabulatedGates.tauN(v)).toBeCloseTo(tauN(v), 4)
    }
  })

  it('covers a range no membrane in this app can leave', () => {
    const [lo, hi] = tabulatedGates.range
    for (const row of run.vm) {
      for (const v of row) {
        expect(v).toBeGreaterThan(lo)
        expect(v).toBeLessThan(hi)
      }
    }
  })
})

describe('what the view says about itself (spec: Scientific guardrails)', () => {
  const facts = cableFactList(readingOf(run), 93).map((f) => f.text)
  const joined = facts.join(' ').toLowerCase()

  it('says outright that nothing moves along the axon', () => {
    expect(joined).toContain('nothing is moving along this axon')
    expect(joined).toMatch(/rebuilt|starts it off/)
  })

  it('never describes the spike as a thing being carried or pushed along', () => {
    for (const text of facts) {
      expect(text.toLowerCase()).not.toMatch(
        /travels down|travels along|runs down the axon|pushed along|carried along/,
      )
    }
  })

  it('quotes the speed the model measured, not a number of its own', () => {
    expect(joined).toContain(run.speedMs.toFixed(1))
  })

  it('never lets "the whole axon fires at once" stand on its own', () => {
    // The question a child asks next, and the one this app must not walk into:
    // if an axon fires all at once, what would myelin be for? The answer has to
    // live in the same breath as the claim — over 93 µm there is no delay worth
    // seeing, over the length of a real nerve there is nothing but delay — and it
    // has to be worked out from the speed this run measured rather than asserted.
    expect(joined).toContain('93 µm')
    expect(joined).toContain('myelin')
    expect(joined).toContain((1 / run.speedMs).toFixed(1))
  })

  it('claims no journey time when there is no speed to claim one from', () => {
    const dead = cableTrajectory(flatSodium, true, FIRE_STIMULUS)
    const text = cableFactList(readingOf(dead), 93)
      .map((f) => f.text)
      .join(' ')
    expect(text).not.toMatch(/seconds to get there/)
  })

  it('owns up to the scale break instead of hiding it', () => {
    expect(joined).toContain('93 µm')
    expect(drawnAxonFraction(93)).toBeLessThan(0.02)
  })

  it('says nothing about a speed when nothing propagated', () => {
    const dead = cableTrajectory(flatSodium, true, FIRE_STIMULUS)
    const text = cableFactList(readingOf(dead), 93)
      .map((f) => f.text)
      .join(' ')
    expect(text).toContain('Nothing propagated')
    expect(text).not.toMatch(/metres per second/)
  })
})

describe('what the axon is doing at one instant', () => {
  it('reports nothing happening before the push has done anything', () => {
    const r = waveReport(run, 0)
    expect(r.frontUm).toBeNull()
    expect(r.activeUm).toBe(0)
    expect(r.refractoryUm).toBe(0)
    expect(r.untouchedUm).toBeCloseTo(CABLE_LENGTH_UM, -2)
  })

  it('finds a lit stretch far shorter than the axon, which is why there is a wave', () => {
    // Half way through the crossing: a band a millimetre or two long is above
    // zero, and the rest of the axon is either waiting or recovering. If this
    // ever covered the whole cable the view would have nothing to show.
    const half = uAt(run, run.crossedAt[index(run, 0.5)])
    const r = waveReport(run, half)
    expect(r.activeUm).toBeGreaterThan(200)
    expect(r.activeUm).toBeLessThan(CABLE_LENGTH_UM / 2)
  })

  it('leaves a recovering tail behind the front and untouched axon ahead of it', () => {
    const half = uAt(run, run.crossedAt[index(run, 0.5)])
    const r = waveReport(run, half)
    expect(r.refractoryUm).toBeGreaterThan(0)
    expect(r.untouchedUm).toBeGreaterThan(0)
    expect(r.frontUm as number).toBeGreaterThan(CABLE_LENGTH_UM * 0.4)
  })
})
