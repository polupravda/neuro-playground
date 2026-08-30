import { describe, expect, it } from 'vitest'
import { CHANNELS } from './channels'
import { ION_KINDS, IONS, particlesFor } from './ions'
import type { IonCounts } from '../state/ionStore'
import { membraneVoltageMv } from './voltage'
import { consequenceOf, type Snapshot } from './consequences'

const real: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

const snap = (counts: IonCounts, open = [CHANNELS['leak-k']]): Snapshot => ({
  counts,
  leaksOn: open.includes(CHANNELS['leak-k']),
  vm: membraneVoltageMv(counts, open),
})

const resting = snap(real)

describe('every consequence has all three parts', () => {
  const events = [
    { kind: 'ion', ion: 'k', side: 'inside' } as const,
    { kind: 'ions-reset' } as const,
    { kind: 'pump', on: false } as const,
    { kind: 'pump', on: true } as const,
    { kind: 'leaks', on: false } as const,
    { kind: 'leaks', on: true } as const,
    { kind: 'action-potential', stimulus: 'spike' } as const,
    { kind: 'transmitter' } as const,
  ]

  it('says what changed, what happened, and what follows', () => {
    for (const event of events) {
      const c = consequenceOf(event, resting, resting)
      expect(c.what.length).toBeGreaterThan(10)
      expect(c.immediate.length).toBeGreaterThan(10)
      expect(c.downstream.length).toBeGreaterThan(10)
    }
  })
})

describe('shutting the leaks — the checkpoint-A experiment', () => {
  const after = snap(real, [])
  const c = consequenceOf({ kind: 'leaks', on: false }, resting, after)

  it('reports the voltage climbing', () => {
    expect(c.downstream).toMatch(/climbed from −\d+ mV to −\d+ mV/)
  })

  it('points out the gradients did not change', () => {
    expect(c.downstream).toMatch(/gradients are untouched/)
  })

  it('credits permeability rather than the pile', () => {
    expect(c.downstream).toMatch(/being ABLE to cross, not from the pile/)
  })
})

describe('stopping the pump', () => {
  // Same channels open, so the voltage target does not move.
  const c = consequenceOf({ kind: 'pump', on: false }, resting, resting)

  it('notices that the voltage barely moved', () => {
    expect(c.downstream).toMatch(/barely moved/)
  })

  it('says outright that the pump is not what makes the voltage', () => {
    expect(c.downstream).toMatch(/not what makes the voltage/)
  })

  it('is honest that the collapse would come, just not yet', () => {
    expect(c.downstream).toMatch(/over minutes/i)
    expect(c.downstream).toMatch(/not in the next few seconds/)
  })
})

describe('firing a spike', () => {
  const c = consequenceOf({ kind: 'action-potential', stimulus: 'spike' }, resting, resting)

  it('names the order the two doors act in', () => {
    expect(c.immediate).toMatch(/Sodium doors flew open/)
    // In REAL milliseconds, the same figure the on-canvas banner quotes — this
    // used to be animation time, which read as a fact about neurons.
    expect(c.immediate).toMatch(/potassium doors answered \d\.\d ms later/)
  })

  it('reports the overshoot and the undershoot past rest', () => {
    expect(c.immediate).toMatch(/up to \+\d+ mV/)
    expect(c.immediate).toMatch(/past resting, to −\d+ mV/)
  })

  it('is honest that the gradients barely moved', () => {
    expect(c.downstream).toMatch(/they did not move/)
    expect(c.downstream).toMatch(/one ball on those bars is a whole 1 mM/)
    expect(c.downstream).toMatch(/about \d+ spikes in a row to shift a single ball/)
  })

  it('refuses to call it a spike when the push never reaches threshold', () => {
    // Sodium spread evenly: threshold climbs past what the button delivers, so
    // the membrane depolarizes and leaks back. Reported as no spike at all,
    // rather than as a small one.
    const flat: IonCounts = { ...real, na: { outside: 80, inside: 80 } }
    const failed = consequenceOf(
      { kind: 'action-potential', stimulus: 'spike' },
      resting,
      snap(flat),
    )
    expect(failed.immediate).toMatch(/leaked back down. No spike/)
    expect(failed.downstream).toMatch(/not a small spike — it is NO spike/)
    expect(failed.downstream).toMatch(/All or nothing/)
  })

  it('says the same of a push that is simply too small', () => {
    const nudged = consequenceOf(
      { kind: 'action-potential', stimulus: 'nudge' },
      resting,
      resting,
    )
    expect(nudged.immediate).toMatch(/No spike/)
    expect(nudged.downstream).toMatch(/the size of the push stops mattering/)
  })
})

describe('changing a gradient', () => {
  it('reports the new shape and the ion’s own voltage moving', () => {
    const flattened: IonCounts = { ...real, k: { outside: 140, inside: 140 } }
    const c = consequenceOf(
      { kind: 'ion', ion: 'k', side: 'outside' },
      resting,
      snap(flattened),
    )
    expect(c.what).toMatch(/potassium outside/)
    expect(c.immediate).toMatch(/no gradient left at all/)
    expect(c.downstream).toMatch(/preferred voltage moved from/)
  })

  it('names which way an ion would now move', () => {
    const reversed: IonCounts = {
      ...real,
      k: { outside: real.k.inside, inside: real.k.outside },
    }
    const c = consequenceOf(
      { kind: 'ion', ion: 'k', side: 'outside' },
      resting,
      snap(reversed),
    )
    expect(c.immediate).toMatch(/crowded outside/)
    expect(c.immediate).toMatch(/would move in/)
  })

  it('quotes the actual numbers it moved between', () => {
    const fewer: IonCounts = { ...real, k: { outside: real.k.outside, inside: 90 } }
    const c = consequenceOf({ kind: 'ion', ion: 'k', side: 'inside' }, resting, snap(fewer))
    expect(c.what).toContain(`${real.k.inside} → 90`)
  })
})

describe('the messenger', () => {
  const after = snap(real, [CHANNELS['leak-k'], CHANNELS.ligand])
  const c = consequenceOf({ kind: 'transmitter' }, resting, after)

  it('says the gate opened without any change in voltage', () => {
    expect(c.immediate).toMatch(/no change in voltage needed/)
  })

  it('connects the nudge to what one neuron does to the next', () => {
    expect(c.downstream).toMatch(/one neuron does to the next/)
    expect(c.downstream).toMatch(/enough of them together/)
  })
})
