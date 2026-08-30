import { describe, expect, it } from 'vitest'
import { ION_KINDS, IONS, particlesFor } from './ions'
import type { IonCounts } from '../state/ionStore'
import { AXON_DIAMETER_UM } from './membrane'
import { DT, FIRE_STIMULUS } from './spikeModel'
import { cableTrajectory, lengthConstantUm } from './cable'
import {
  NODE_DENSITY,
  NODE_UM,
  compartments,
  fibreRun,
  internodeUm,
  lamellae,
  myelinFor,
  myelinFacts,
  raceFacts,
  myelinatedLengthConstantUm,
  saltation,
  type FibreOptions,
} from './fibre'

const real: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

const flatSodium: IonCounts = {
  ...real,
  na: { outside: real.na.inside, inside: real.na.inside },
}

const LENGTH = 2000
const common = { lengthUm: LENGTH, msTotal: 8, stimWidthUm: 400 }
const go = (opts: Partial<FibreOptions> = {}) =>
  fibreRun(real, true, FIRE_STIMULUS, { ...common, dxUm: 20, ...opts })

const bare = go()
const sheathed = go({ myelin: myelinFor() })

describe('how a myelinated fibre is put together', () => {
  it('derives the sheath from the axon rather than being given one', () => {
    // Internode about a hundred axon-diameters, and a wrap count from the
    // g-ratio. Both are relationships real nerve keeps across a wide range of
    // sizes, so neither is a number anybody picked.
    expect(internodeUm(AXON_DIAMETER_UM)).toBe(140)
    expect(lamellae(AXON_DIAMETER_UM)).toBeGreaterThan(10)
    expect(lamellae(AXON_DIAMETER_UM)).toBeLessThan(60)
    // Fatter axons get thicker sheaths and longer internodes; that is the whole
    // reason a fat myelinated fibre is fast.
    expect(lamellae(4)).toBeGreaterThan(lamellae(1))
    expect(internodeUm(4)).toBeGreaterThan(internodeUm(1))
  })

  it('alternates one short node with a long sheathed stretch', () => {
    const parts = compartments({ lengthUm: LENGTH, myelin: myelinFor() })
    const nodes = parts.filter((p) => p.excitable)
    expect(nodes.length).toBeGreaterThan(8)
    for (const node of nodes) expect(node.lengthUm).toBeCloseTo(NODE_UM, 6)
    // Almost all of the membrane is under sheath — that ratio IS myelination.
    const sheathedUm = parts
      .filter((p) => !p.excitable)
      .reduce((a, p) => a + p.lengthUm, 0)
    expect(sheathedUm / LENGTH).toBeGreaterThan(0.98)
  })

  it('tiles the fibre exactly, sheathed or bare', () => {
    for (const spec of [
      { lengthUm: LENGTH, dxUm: 20 },
      { lengthUm: LENGTH, myelin: myelinFor() },
    ]) {
      const parts = compartments(spec)
      const total = parts.reduce((a, p) => a + p.lengthUm, 0)
      expect(total).toBeCloseTo(LENGTH, 6)
      expect(parts[0].x).toBeCloseTo(parts[0].lengthUm / 2, 6)
    }
  })

  it('leaves a bare axon excitable everywhere and unwrapped', () => {
    for (const p of compartments({ lengthUm: LENGTH, dxUm: 20 })) {
      expect(p.excitable).toBe(true)
      expect(p.wraps).toBe(1)
      expect(p.density).toBe(1)
    }
  })
})

describe('the solver, held against the one it replaces', () => {
  it('gets the same speed on a bare axon as the explicit model does', () => {
    // Two solvers, two grids, two schemes — an even grid stepped explicitly in
    // cable.ts, and an uneven one stepped implicitly here. They have almost no
    // code in common, so agreeing on a bare axon is real evidence rather than a
    // tautology. Within a few per cent.
    const reference = cableTrajectory(real, true, FIRE_STIMULUS).speedMs
    expect(bare.speedMs).toBeGreaterThan(reference * 0.9)
    expect(bare.speedMs).toBeLessThan(reference * 1.1)
  })

  it('converges as the bare axon is chopped more finely', () => {
    const coarse = go({ dxUm: 40 }).speedMs
    const fine = go({ dxUm: 10 }).speedMs
    expect(fine).toBeCloseTo(coarse, 1)
  })

  it('converges as the step shrinks, on the stiff one', () => {
    // The whole reason the axial term is implicit: a sheathed fibre has a
    // hundredth of the capacitance and would need a step thousands of times
    // smaller to be stable explicitly. Here the step is set by the gates.
    const coarse = go({ myelin: myelinFor(), dtMs: DT * 2 }).speedMs
    const fine = go({ myelin: myelinFor(), dtMs: DT / 2 }).speedMs
    expect(fine).toBeCloseTo(coarse, 1)
  })
})

describe('what the sheath does', () => {
  it('lets a voltage reach much further before it fades', () => {
    // λ goes as the square root of the membrane resistance, and the wraps are
    // resistors in series — so the sheath multiplies it by the square root of
    // the wrap count. This is the mechanism, and everything else follows.
    expect(myelinatedLengthConstantUm()).toBeGreaterThan(lengthConstantUm() * 3)
    // Far enough that one node can reach several internodes ahead.
    expect(myelinatedLengthConstantUm()).toBeGreaterThan(internodeUm() * 5)
  })

  it('carries the spike the whole way, faster than the bare axon', () => {
    expect(bare.propagated).toBe(true)
    expect(sheathed.propagated).toBe(true)
    // MEASURED, both of them, off the same push through the same gradients.
    expect(sheathed.speedMs).toBeGreaterThan(bare.speedMs * 3)
  })

  it('puts nearly all the membrane under sheath and almost none at nodes', () => {
    const nodeLength =
      sheathed.parts.filter((p) => p.excitable).reduce((a, p) => a + p.lengthUm, 0) /
      LENGTH
    expect(nodeLength).toBeLessThan(0.02)
  })

  it('does NOT make the spike hop from node to node', () => {
    // The cartoon says a spike leaps over dark internodes. This model says it
    // runs smoothly and is merely REBUILT at the nodes, and the model is right:
    // a sheathed stretch is 140 µm against a length constant of 1,700, so there
    // is nothing to leap over, and most of the capacitance to charge is under the
    // sheath rather than at the nodes.
    //
    // Asserted rather than left to chance, because a picture of a hopping spike
    // is the easiest thing in the world to draw and this app must not draw one.
    const step = saltation(sheathed)
    expect(step.withinMs).toBeGreaterThan(0)
    expect(step.ratio).toBeGreaterThan(0.5)
    expect(step.ratio).toBeLessThan(2)
  })

  it('does make it very much quicker per millimetre', () => {
    expect(1 / sheathed.speedMs).toBeLessThan(1 / bare.speedMs / 3)
  })

  it('lets the voltage under the sheath swing nearly as far as at a node', () => {
    // Worth asserting because it caught this file's first attempt at the test
    // above, which assumed membrane under myelin barely moves. It moves: the
    // internode is a good cable and the axoplasm in it goes where its neighbours
    // go. What the sheath stops is CURRENT, not voltage.
    const swing = (i: number) => sheathed.peak[i] - sheathed.rest
    const nodePeak = Math.max(
      ...sheathed.parts.map((p, i) => (p.excitable ? swing(i) : 0)),
    )
    const underPeak = Math.max(
      ...sheathed.parts.map((p, i) => (p.excitable ? 0 : swing(i))),
    )
    expect(underPeak).toBeGreaterThan(nodePeak * 0.8)
  })

  it('needs the nodes to be crowded with channels, not merely to exist', () => {
    // Half of what myelination is. A node studded at ordinary axon density still
    // works, and is markedly slower — so the clustering earns its place in the
    // model rather than being decoration.
    const sparse = go({ myelin: myelinFor(), nodeDensity: 1 })
    expect(sparse.propagated).toBe(true)
    expect(sheathed.speedMs).toBeGreaterThan(sparse.speedMs * 1.4)
    expect(NODE_DENSITY).toBeGreaterThan(1)
  })
})

describe('when the cell cannot afford a spike', () => {
  it('propagates nothing on either fibre once sodium has nowhere to fall', () => {
    // Same failure, same reason, on both — and nothing written for the case. A
    // sheath makes a spike travel further and faster; it cannot make one happen.
    for (const opts of [{ dxUm: 20 }, { myelin: myelinFor() }]) {
      const dead = fibreRun(flatSodium, true, FIRE_STIMULUS, { ...common, ...opts })
      expect(dead.propagated).toBe(false)
      expect(dead.speedMs).toBe(0)
    }
  })
})


describe('what the view says about the sheath (spec: Scientific guardrails)', () => {
  const facts = myelinFacts(sheathed, bare.speedMs).map((f) => f.text)
  const joined = facts.join(' ').toLowerCase()

  it('refuses the hopping picture outright', () => {
    // N20's guardrail: "current spreads under myelin and APs regenerate at
    // nodes". The model says the spike does not leap, so the words must too —
    // and must say it in the same breath as the word every book uses.
    expect(joined).toContain('does not hop')
    expect(joined).toMatch(/spreads almost instantly|nothing there to leap over/)
    expect(joined).toContain('rebuilding')
  })

  it('quotes both speeds it measured, not one it was given', () => {
    expect(joined).toContain(sheathed.speedMs.toFixed(1))
    expect(joined).toContain(bare.speedMs.toFixed(2))
  })

  it('owns up to what the drawing exaggerates, and to what it does not', () => {
    // The nodes are drawn far wider than 1 µm and the sheath far thinner than its
    // real bulk. How MANY sleeves there are is honest, and the difference between
    // those two kinds of licence is worth stating.
    expect(joined).toContain('drawn bigger than life')
    expect(joined).toContain('not exaggerated')
  })

  it('says nothing about a speed when nothing propagated', () => {
    const dead = fibreRun(flatSodium, true, FIRE_STIMULUS, {
      ...common,
      myelin: myelinFor(),
    })
    const text = myelinFacts(dead, 0)
      .map((f) => f.text)
      .join(' ')
    expect(text).toContain('Nothing propagated')
    expect(text).not.toMatch(/times quicker/)
  })
})


describe('the race (N21)', () => {
  // Both fibres exactly as the canvas runs them: same window, untrimmed, so one
  // clock covers both.
  const shared = { ...common, msTotal: 14, trim: false as const }
  const bareRace = fibreRun(real, true, FIRE_STIMULUS, { ...shared, dxUm: 20 })
  const wrappedRace = fibreRun(real, true, FIRE_STIMULUS, { ...shared, myelin: myelinFor() })
  const arrival = (run: typeof bareRace) => run.crossedAt[run.crossedAt.length - 1]

  it('runs both fibres on one clock, or there is no race', () => {
    // The single-fibre view trims each run to its own finishing time, which is
    // right there and fatal here: two runs on two clocks cannot be raced. Same
    // window, same samples, same u meaning the same millisecond in both.
    expect(bareRace.t[bareRace.t.length - 1]).toBeCloseTo(
      wrappedRace.t[wrappedRace.t.length - 1],
      6,
    )
    expect(bareRace.t.length).toBe(wrappedRace.t.length)
  })

  it('sends them the same distance from the same push', () => {
    // Everything identical except the sheath. Anything else different and the
    // finishing times would be measuring the wrong thing.
    expect(bareRace.lengthUm).toBeCloseTo(wrappedRace.lengthUm, 6)
    expect(bareRace.rest).toBeCloseTo(wrappedRace.rest, 6)
    expect(bareRace.myelinated).toBe(false)
    expect(wrappedRace.myelinated).toBe(true)
  })

  it('has both actually finish, and the wrapped one first', () => {
    for (const run of [bareRace, wrappedRace]) {
      expect(run.propagated, run.myelinated ? 'wrapped' : 'bare').toBe(true)
      expect(Number.isFinite(arrival(run))).toBe(true)
    }
    expect(arrival(wrappedRace)).toBeLessThan(arrival(bareRace) / 3)
  })

  it('leaves the bare fibre well short when the wrapped one arrives', () => {
    // What the picture is for: at the moment one is home, the other is visibly
    // nowhere near. If this ever came out close, the race would be pointless.
    const whenWrappedHome = arrival(wrappedRace)
    let reached = 0
    bareRace.parts.forEach((part, i) => {
      if (bareRace.crossedAt[i] <= whenWrappedHome) reached = part.x
    })
    expect(reached / bareRace.lengthUm).toBeLessThan(0.45)
  })

  it('finishes inside the window it was given', () => {
    expect(arrival(bareRace)).toBeLessThan(14)
  })
})

describe('what the race says about itself (spec: relative speed, not exact scale)', () => {
  const shared = { ...common, msTotal: 14, trim: false as const }
  const b = fibreRun(real, true, FIRE_STIMULUS, { ...shared, dxUm: 20 })
  const w = fibreRun(real, true, FIRE_STIMULUS, { ...shared, myelin: myelinFor() })
  const joined = raceFacts(b, w).map((f) => f.text).join(' ')

  it('leads with the ratio and warns off the raw milliseconds', () => {
    // N21's guardrail, taken literally: the ratio is what survives the model's
    // squid gates at 6.3 °C, and the absolute times do not.
    const ratio = b.crossedAt[b.crossedAt.length - 1] / w.crossedAt[w.crossedAt.length - 1]
    expect(joined).toContain(ratio.toFixed(1))
    expect(joined).toMatch(/ratio survives/)
    expect(joined).toMatch(/6\.3 °C|body temperature/)
  })

  it('says that neither fibre is being helped along', () => {
    expect(joined).toMatch(/one rate/)
    expect(joined).toMatch(/thumb on the race/)
  })
})
