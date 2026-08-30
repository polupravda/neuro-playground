import { describe, expect, it } from 'vitest'
import {
  CHANNELS,
  CHANNEL_IDS,
  CHANNEL_OVERVIEW,
  SPIKE_IONS,
  TRANSMITTER_MS,
  gateNote,
  gateOf,
  type GateEnv,
} from './channels'

// The spike's own conductance envelopes are what the voltage-gated pair answer
// to now, so a moment of a spike is described by how wide each door is.
const resting: GateEnv = { ap: null, transmitter: false }
const upstroke: GateEnv = { ap: { na: 0.8, k: 0.05 }, transmitter: false }
const downstroke: GateEnv = { ap: { na: 0.02, k: 0.85 }, transmitter: false }
const messenger: GateEnv = { ap: null, transmitter: true }

describe('the channel registry', () => {
  it('describes four channels with the three kinds of gating', () => {
    expect(CHANNEL_IDS).toHaveLength(4)
    const gatings = new Set(CHANNEL_IDS.map((id) => CHANNELS[id].gating))
    expect(gatings).toEqual(new Set(['always', 'voltage', 'ligand']))
  })

  it('gives every channel a name, a rule, something to pass and a size', () => {
    for (const id of CHANNEL_IDS) {
      const channel = CHANNELS[id]
      expect(channel.name.length).toBeGreaterThan(0)
      expect(channel.short.length).toBeGreaterThan(0)
      expect(channel.opensWhen.length).toBeGreaterThan(10)
      expect(channel.passes.length).toBeGreaterThan(0)
      expect(channel.conductance).toBeGreaterThan(0)
      expect(channel.widthNm).toBeGreaterThan(0)
      expect(channel.facts.length).toBeGreaterThan(0)
    }
  })

  it('declares the ligand-gated drawing a stand-in, naming the real family', () => {
    // The generic channel must say it is generic: once AMPA and GABA-A exist at
    // the synapse, an unnamed "ligand-gated channel" would read as a fifth kind.
    const text = CHANNELS.ligand.facts.map((f) => f.text).join(' ')
    expect(text).toMatch(/stand-in/)
    expect(text).toMatch(/AMPA/)
    expect(text).toMatch(/GABA/)
  })

  it('is selective — no channel here passes everything', () => {
    for (const id of CHANNEL_IDS) {
      expect(CHANNELS[id].passes.length).toBeLessThan(4)
    }
  })

  it('makes the sodium channel the fastest, as the upstroke needs', () => {
    expect(CHANNELS['voltage-na'].conductance).toBeGreaterThan(
      CHANNELS['voltage-k'].conductance,
    )
    expect(CHANNELS['voltage-na'].conductance).toBeGreaterThan(CHANNELS['leak-k'].conductance)
  })

  it('opens opposite ions for the two voltage-gated channels', () => {
    expect(CHANNELS['voltage-na'].passes).toEqual(['na'])
    expect(CHANNELS['voltage-k'].passes).toEqual(['k'])
  })
})

describe('which ions a spike is about', () => {
  it('is sodium and potassium, and says so by looking at the channels', () => {
    expect([...SPIKE_IONS].sort()).toEqual(['k', 'na'])
  })

  it('names only ions a voltage-gated channel actually carries', () => {
    for (const ion of SPIKE_IONS) {
      const carriers = CHANNEL_IDS.filter(
        (id) => CHANNELS[id].gating === 'voltage' && CHANNELS[id].passes.includes(ion),
      )
      expect(carriers.length).toBeGreaterThan(0)
    }
  })

  it('leaves out ions that only have an ungated way through', () => {
    // Chloride crosses the whole time on its background permeability, but no
    // voltage-gated channel carries it, so it is not what a spike is about.
    expect(SPIKE_IONS).not.toContain('cl')
  })
})

describe('the leak channel has no gate', () => {
  it('is open in every circumstance', () => {
    for (const env of [resting, upstroke, downstroke, messenger]) {
      expect(gateOf(CHANNELS['leak-k'], env)).toBe('open')
    }
  })
})

describe('voltage gating (N14)', () => {
  it('keeps both voltage-gated channels shut at rest', () => {
    expect(gateOf(CHANNELS['voltage-na'], resting)).toBe('closed')
    expect(gateOf(CHANNELS['voltage-k'], resting)).toBe('closed')
  })

  it('opens sodium on the upstroke while potassium is still shut', () => {
    expect(gateOf(CHANNELS['voltage-na'], upstroke)).toBe('open')
    expect(gateOf(CHANNELS['voltage-k'], upstroke)).toBe('closed')
  })

  it('has them the other way round on the way down — sodium shuts itself', () => {
    expect(gateOf(CHANNELS['voltage-na'], downstroke)).toBe('closed')
    expect(gateOf(CHANNELS['voltage-k'], downstroke)).toBe('open')
  })

  it('reads each channel’s OWN door rather than one shared flag', () => {
    // The whole point: the two never simply agree.
    expect(gateOf(CHANNELS['voltage-na'], upstroke)).not.toBe(
      gateOf(CHANNELS['voltage-k'], upstroke),
    )
    expect(gateOf(CHANNELS['voltage-na'], downstroke)).not.toBe(
      gateOf(CHANNELS['voltage-k'], downstroke),
    )
  })

  it('shuts both again when no spike is running', () => {
    expect(gateOf(CHANNELS['voltage-na'], resting)).toBe('closed')
    expect(gateOf(CHANNELS['voltage-k'], resting)).toBe('closed')
  })

  it('ignores neurotransmitter entirely', () => {
    expect(gateOf(CHANNELS['voltage-na'], messenger)).toBe('closed')
    expect(gateOf(CHANNELS['voltage-k'], messenger)).toBe('closed')
  })
})

describe('ligand gating (N15)', () => {
  it('opens only when a messenger is held', () => {
    expect(gateOf(CHANNELS.ligand, resting)).toBe('closed')
    expect(gateOf(CHANNELS.ligand, messenger)).toBe('open')
  })

  it('ignores voltage entirely — the point of separating the two kinds', () => {
    expect(gateOf(CHANNELS.ligand, upstroke)).toBe('closed')
    expect(gateOf(CHANNELS.ligand, downstroke)).toBe('closed')
  })

  it('holds open long enough to be watched', () => {
    expect(TRANSMITTER_MS).toBeGreaterThan(1000)
  })
})

describe('teaching text', () => {
  it('says a channel is never a switch, and names the differences', () => {
    const text = CHANNEL_OVERVIEW.map((p) => p.text.toLowerCase()).join(' ')
    expect(text).toMatch(/none of them is a switch you flip/)
    expect(text).toMatch(/different gates, different rules/)
  })

  it('says channels are selective and that it matters', () => {
    const text = CHANNEL_OVERVIEW.map((p) => p.text.toLowerCase()).join(' ')
    expect(text).toMatch(/picky/)
    expect(text).toMatch(/opposite effects/)
  })

  it('explains the potassium lag as the reason a spike comes back down', () => {
    const text = CHANNELS['voltage-k'].facts.map((p) => p.text.toLowerCase()).join(' ')
    expect(text).toMatch(/lateness is not a flaw/)
    expect(text).toMatch(/swings back down/)
  })

  it('gives the voltage sensor a physical explanation', () => {
    const text = CHANNELS['voltage-na'].facts.map((p) => p.text.toLowerCase()).join(' ')
    expect(text).toMatch(/voltage sensor/)
    expect(text).toMatch(/feel the electrical field/)
  })

  it('names where chemical becomes electrical (N15)', () => {
    const text = CHANNELS.ligand.facts.map((p) => p.text.toLowerCase()).join(' ')
    expect(text).toMatch(/chemical signal becomes an electrical one/)
  })
})

describe('gateNote', () => {
  it('never calls a gateless channel "open" as if it could shut', () => {
    expect(gateNote(CHANNELS['leak-k'], 'open')).toBe('always open')
    expect(gateNote(CHANNELS['voltage-na'], 'open')).toBe('open')
    expect(gateNote(CHANNELS['voltage-na'], 'closed')).toBe('shut')
  })
})
