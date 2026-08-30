import { describe, expect, it } from 'vitest'
import {
  NETWORK_CONTEXT,
  NEURON_OVERVIEW,
  NEURON_PARTS,
  allTeachingText,
  neuronPart,
} from './neuron'

const joined = (id: 'soma' | 'dendrites' | 'axon' | 'terminals') =>
  neuronPart(id)
    .explanation.map((e) => e.text.toLowerCase())
    .join(' ')

describe('neuron part model', () => {
  it('has the four canonical parts with unique ids', () => {
    const ids = NEURON_PARTS.map((p) => p.id)
    expect(ids).toEqual(['dendrites', 'soma', 'axon', 'terminals'])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every part a role, a flow direction, explanations and a simplification', () => {
    for (const part of NEURON_PARTS) {
      expect(part.name.length).toBeGreaterThan(0)
      expect(part.icon.length).toBeGreaterThan(0)
      expect(part.role.length).toBeGreaterThan(0)
      expect(part.flow.length).toBeGreaterThan(0)
      expect(part.simplification.length).toBeGreaterThan(20)
      expect(part.explanation.length).toBeGreaterThanOrEqual(2)
      for (const para of part.explanation) {
        expect(para.icon.length).toBeGreaterThan(0)
        expect(para.text.length).toBeGreaterThan(20)
      }
    }
  })

  it('looks parts up by id and rejects unknown ones', () => {
    expect(neuronPart('axon').name).toBe('Axon')
    // @ts-expect-error — guarding the runtime path for a bad id
    expect(() => neuronPart('mitochondria')).toThrow()
  })
})

describe('scientific guardrails (spec: Scientific guardrails)', () => {
  it('never anthropomorphizes the soma into a decision-maker (N04)', () => {
    for (const text of allTeachingText()) {
      expect(text.toLowerCase()).not.toMatch(/\bdecide|\bdecides|\bdecision|wants to\b/)
    }
  })

  it('puts the action potential’s birthplace at the hillock, never mid-axon (N19)', () => {
    const axon = joined('axon')
    expect(axon).toContain('hillock')
    expect(axon).toMatch(/never partway along the cable/)
    expect(axon).toMatch(/never on its own/)
  })

  it('teaches the axon signal as regenerated, not as something that travels along the cable', () => {
    const axon = joined('axon')
    expect(axon).toContain('rebuilt')
    expect(axon).toMatch(/nothing runs down the cable/)
  })

  it('names the hillock as where the summed total is tested (N18)', () => {
    expect(joined('soma')).toContain('hillock')
  })

  it('distinguishes electrical propagation from synaptic transmission (N05)', () => {
    const axon = joined('axon')
    expect(axon).toContain('chemical')
    expect(axon).toContain('separate')
  })

  it('marks the graded-vs-all-or-nothing contrast in both directions (N03/N18)', () => {
    expect(joined('dendrites')).toContain('graded')
    expect(joined('dendrites')).toMatch(/fades as it spreads/)
    expect(joined('axon')).toMatch(/all-or-nothing/)
    expect(joined('axon')).toMatch(/does not fade/)
  })

  it('states that dendrites never generate their own signals', () => {
    expect(joined('dendrites')).toMatch(/never make signals of their own/)
  })

  it('says one output ripple cannot fire the target on its own', () => {
    expect(joined('terminals')).toMatch(/not enough to fire it/)
  })
})

describe('framing the scene as a network', () => {
  it('states that real neurons vary in shape (N01/N02)', () => {
    const overview = NEURON_OVERVIEW.map((p) => p.text.toLowerCase()).join(' ')
    expect(overview).toMatch(/real neurons come in wildly different shapes/)
  })

  it('says the network continues past the edges of the picture', () => {
    const overview = NEURON_OVERVIEW.map((p) => p.text.toLowerCase()).join(' ')
    expect(overview).toMatch(/network keeps going/)
  })

  it('explains why the neighbours are drawn, and admits how few they are', () => {
    const context = NETWORK_CONTEXT.map((p) => p.text.toLowerCase()).join(' ')
    expect(context).toMatch(/on its own does nothing/)
    expect(context).toMatch(/thousands of synapses/)
  })
})
