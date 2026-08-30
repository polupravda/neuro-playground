import { describe, expect, it } from 'vitest'
import { PUMP_K_IN, PUMP_NA_OUT } from '../core/proteins'
import { MEMBRANE_PX } from './layout'
import {
  LEAK_CYCLE_MS,
  PROTEIN_OUT,
  PUMP_CYCLE_MS,
  carriedDepth,
  channelIonsAt,
  membraneProteins,
  proteinIn,
  pumpStateAt,
} from './proteins'
import { CHANNELS } from '../core/channels'
import { ION_KINDS, IONS, particlesFor } from '../core/ions'
import { nernstMv } from '../core/voltage'
import type { IonCounts } from '../state/ionStore'

const realCounts: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

const sweep = (steps = 700) =>
  Array.from({ length: steps }, (_, i) => {
    const ms = (i / steps) * PUMP_CYCLE_MS
    return { ms, s: pumpStateAt(ms) }
  })

describe('the pump cycle a kid can count', () => {
  it('runs its phases in order and returns to the start', () => {
    const order = ['load-na', 'spend-atp', 'release-na', 'load-k', 'reset', 'release-k']
    const seen: string[] = []
    for (const { s } of sweep()) {
      if (seen[seen.length - 1] !== s.phase) seen.push(s.phase)
    }
    expect(seen).toEqual(order)
    expect(pumpStateAt(0).phase).toBe(pumpStateAt(PUMP_CYCLE_MS).phase)
  })

  it('carries exactly three sodium, never more or fewer', () => {
    for (const { s } of sweep()) {
      if (s.carried[0]?.kind === 'na') expect(s.carried).toHaveLength(PUMP_NA_OUT)
    }
  })

  it('carries exactly two potassium', () => {
    for (const { s } of sweep()) {
      if (s.carried[0]?.kind === 'k') expect(s.carried).toHaveLength(PUMP_K_IN)
    }
  })

  it('takes sodium from the inside and puts it outside', () => {
    const na = sweep().filter(({ s }) => s.carried[0]?.kind === 'na')
    const us = na.flatMap(({ s }) => s.carried.map((c) => c.u))
    // Starts on the cytoplasm side (+) and ends outside (−).
    expect(Math.max(...us)).toBeGreaterThan(0.9)
    expect(Math.min(...us)).toBeLessThan(-0.9)
    const first = na[0].s.carried[0].u
    const last = na[na.length - 1].s.carried[0].u
    expect(first).toBeGreaterThan(last)
  })

  it('takes potassium from outside and puts it inside — the other way round', () => {
    const k = sweep().filter(({ s }) => s.carried[0]?.kind === 'k')
    const first = k[0].s.carried[0].u
    const last = k[k.length - 1].s.carried[0].u
    expect(first).toBeLessThan(last)
  })

  it('never has both ion species inside it at once', () => {
    for (const { s } of sweep()) {
      const kinds = new Set(s.carried.map((c) => c.kind))
      expect(kinds.size).toBeLessThanOrEqual(1)
    }
  })

  it('spends energy exactly once per cycle, while both mouths are shut', () => {
    const flashing = sweep().filter(({ s }) => s.atpFlash > 0.01)
    expect(flashing.length).toBeGreaterThan(0)
    for (const { s } of flashing) {
      expect(s.phase).toBe('spend-atp')
      expect(s.openTo).toBe('closed')
    }
  })

  it('never opens both sides at once — that would make it a hole, not a pump', () => {
    for (const { s } of sweep()) {
      expect(['inside', 'outside', 'closed']).toContain(s.openTo)
    }
  })

  it('opens to the inside while loading sodium and to the outside while releasing it', () => {
    const at = (phase: string) => sweep().find(({ s }) => s.phase === phase)!.s
    expect(at('load-na').openTo).toBe('inside')
    expect(at('release-na').openTo).toBe('outside')
    expect(at('load-k').openTo).toBe('outside')
    expect(at('release-k').openTo).toBe('inside')
  })
})

describe('flow through an open channel', () => {
  // Flow depends on the voltage as well as the crowding, so watching a channel
  // means naming the voltage. REST is the resting potential for the real
  // gradients; at that voltage potassium leaves and sodium arrives.
  const REST = -72
  const sweepChannel = (
    channel: typeof CHANNELS['leak-k'],
    counts = realCounts,
    vm = REST,
  ) => {
    const seen: Array<{ ms: number; ions: ReturnType<typeof channelIonsAt> }> = []
    // A long window on purpose. The crossing rate now scales with the driving
    // force, and at rest potassium is pushed by only about 17 mV — a trickle,
    // which is exactly what a resting leak is.
    for (let ms = 0; ms < LEAK_CYCLE_MS * 40; ms += 20) {
      seen.push({ ms, ions: channelIonsAt(channel, 0, ms, counts, vm) })
    }
    return seen
  }

  it('passes only the ion the channel is selective for', () => {
    for (const channel of [CHANNELS['leak-k'], CHANNELS['voltage-na']]) {
      for (const { ions } of sweepChannel(channel)) {
        for (const ion of ions) expect(channel.passes).toContain(ion.kind)
      }
    }
  })

  it('sends potassium out and sodium in — each following its own gradient', () => {
    const k = sweepChannel(CHANNELS['leak-k']).flatMap((f) => f.ions)
    const na = sweepChannel(CHANNELS['voltage-na']).flatMap((f) => f.ions)
    // Outward means u falls from +1; inward means it rises from −1.
    expect(Math.max(...k.map((i) => i.u))).toBeGreaterThan(0.9)
    expect(Math.min(...k.map((i) => i.u))).toBeLessThan(-0.9)
    expect(Math.max(...na.map((i) => i.u))).toBeGreaterThan(0.9)
    expect(Math.min(...na.map((i) => i.u))).toBeLessThan(-0.9)
  })

  it('stops where the ion is CONTENT, not where the crowding is even', () => {
    // This test used to say "a flat gradient means no flow", and that was the
    // misconception the driving force exists to remove. An ion is pushed by its
    // crowding AND by the voltage, and it stops only where the two cancel — its
    // own Nernst voltage. With the crowding even, that voltage is zero.
    const flat: IonCounts = ION_KINDS.reduce((acc, kind) => {
      acc[kind] = { outside: 40, inside: 40 }
      return acc
    }, {} as IonCounts)

    // At 0 mV, nothing moves through it, however wide open it is.
    for (const { ions } of sweepChannel(CHANNELS['leak-k'], flat, 0)) {
      expect(ions).toHaveLength(0)
    }
    // Held anywhere else, the voltage alone drives it — with the crowding even.
    const pushed = sweepChannel(CHANNELS['leak-k'], flat, -72).flatMap((f) => f.ions)
    expect(pushed.length).toBeGreaterThan(0)
    // Below its own voltage, potassium is pushed IN: u rises from −1.
    expect(Math.min(...pushed.map((i) => i.u))).toBeLessThan(-0.9)
  })

  it('stops at the reversal potential even with a steep gradient', () => {
    // The knife edge: potassium is crowded inside and still does not budge,
    // because the membrane is sitting exactly where it is content.
    const eK = nernstMv('k', realCounts)
    for (const { ions } of sweepChannel(CHANNELS['leak-k'], realCounts, eK)) {
      expect(ions).toHaveLength(0)
    }
  })

  it('pushes harder the further the voltage is from where the ion is content', () => {
    // Counting STARTS, not busy frames — the trap the conductance test below
    // already names: each crossing is shorter as well as more frequent, so the
    // busy fraction does not move.
    const crossings = (vm: number) => {
      const frames = sweepChannel(CHANNELS['leak-k'], realCounts, vm)
      return frames.filter((f, i) => f.ions.length > 0 && frames[i - 1]?.ions.length === 0)
        .length
    }
    // At rest potassium is pushed by 17 mV; at the top of a spike, by 148.
    expect(crossings(60)).toBeGreaterThan(crossings(-72) * 3)
  })

  it('reverses when the gradient is reversed, still without being told to', () => {
    const flipped: IonCounts = {
      ...realCounts,
      k: { outside: realCounts.k.inside, inside: realCounts.k.outside },
    }
    const normal = sweepChannel(CHANNELS['leak-k']).flatMap((f) => f.ions)
    const reversed = sweepChannel(CHANNELS['leak-k'], flipped).flatMap((f) => f.ions)
    // The first crossing starts at the crowded side, whichever that now is.
    expect(normal[0].u).toBeGreaterThan(0)
    expect(reversed[0].u).toBeLessThan(0)
  })

  it('crosses only intermittently — the rest of the trip is spent approaching', () => {
    const frames = sweepChannel(CHANNELS['leak-k'])
    const crossing = frames.filter((f) => f.ions.some((i) => Math.abs(i.u) < 1))
    expect(crossing.length).toBeGreaterThan(0)
    expect(crossing.length).toBeLessThan(frames.length / 2)
  })

  it('comes out of the crowd and leaves into it, never appearing at the mouth', () => {
    // Anything visible near the channel must have travelled there: an ion is
    // only ever drawn at full strength once it is close, and is transparent
    // while far out among the others.
    for (const { ions } of sweepChannel(CHANNELS['leak-k'])) {
      for (const ion of ions) {
        if (Math.abs(ion.u) < 2) expect(ion.alpha).toBeGreaterThan(0.5)
      }
    }
  })

  it('reaches well out into the crowd on both sides', () => {
    const us = sweepChannel(CHANNELS['leak-k']).flatMap((f) => f.ions.map((i) => i.u))
    expect(Math.max(...us)).toBeGreaterThan(2.5)
    expect(Math.min(...us)).toBeLessThan(-2.5)
  })

  it('is invisible at both ends of its journey, so nothing pops', () => {
    const frames = sweepChannel(CHANNELS['leak-k'])
    const far = frames.flatMap((f) => f.ions).filter((i) => Math.abs(i.u) > 3.1)
    expect(far.length).toBeGreaterThan(0)
    for (const ion of far) expect(ion.alpha).toBeLessThan(0.35)
  })

  it('sends more ions through a higher-conductance channel in the same time', () => {
    // Not "is busier a larger fraction of the time" — each crossing is shorter
    // as well as more frequent, so that fraction is the same. What differs is
    // how many ions get through.
    const crossings = (channel: typeof CHANNELS['leak-k']) => {
      const frames = sweepChannel(channel)
      return frames.filter((f, i) => f.ions.length > 0 && frames[i - 1]?.ions.length === 0)
        .length
    }
    expect(crossings(CHANNELS['voltage-na'])).toBeGreaterThan(crossings(CHANNELS['leak-k']))
  })

  it('staggers channels so they do not all pass an ion together', () => {
    const a = channelIonsAt(CHANNELS['leak-k'], 0, 300, realCounts, REST)
    const b = channelIonsAt(CHANNELS['leak-k'], 0.62, 300, realCounts, REST)
    expect(a[0]?.u).not.toBe(b[0]?.u)
  })
})

describe('placement in the membrane', () => {
  it('puts a pump and a couple of leak channels in each patch', () => {
    const proteins = membraneProteins()
    expect(proteins.filter((p) => p.kind === 'pump').length).toBeGreaterThanOrEqual(1)
    expect(proteins.filter((p) => p.kind === 'channel').length).toBeGreaterThanOrEqual(3)
    for (const p of proteins) expect(p.half).toBeGreaterThan(0)
  })

  it('makes every protein at least as wide as the membrane is thick', () => {
    for (const p of membraneProteins()) {
      expect(p.half * 2).toBeGreaterThanOrEqual(MEMBRANE_PX)
    }
  })

  it('spreads them along the membrane rather than stacking them', () => {
    const alongs = membraneProteins().map((p) => p.along)
    expect(new Set(alongs).size).toBeGreaterThan(1)
  })
})

describe('carriedDepth', () => {
  it('puts a fully-loaded ion clear of the bilayer on the right side', () => {
    expect(carriedDepth(1, 'na', 'pump')).toBeGreaterThan(MEMBRANE_PX / 2)
    expect(carriedDepth(-1, 'k', 'pump')).toBeLessThan(-MEMBRANE_PX / 2)
  })

  it('keeps an ion mid-transit inside the membrane', () => {
    expect(Math.abs(carriedDepth(0, 'na', 'pump'))).toBeLessThan(MEMBRANE_PX / 2)
  })

  it('clears the pump\u2019s cytoplasmic head, not just the barrel — otherwise a\n     released ion still looks stuck inside the protein', () => {
    expect(carriedDepth(1, 'na', 'pump')).toBeGreaterThan(proteinIn('pump'))
    expect(carriedDepth(1, 'na', 'pump')).toBeGreaterThan(carriedDepth(1, 'na', 'channel'))
  })

  it('reaches further into the cell than out of it, because the pump does', () => {
    expect(proteinIn('pump')).toBeGreaterThan(PROTEIN_OUT)
    expect(proteinIn('channel')).toBeCloseTo(PROTEIN_OUT)
  })
})

describe('the ions must be countable AND stay in the pore', () => {
  it('holds the three sodium at distinct depths, so they are three not one', () => {
    const held = pumpStateAt(1800) // mid ATP phase, occluded in the protein
    expect(held.phase).toBe('spend-atp')
    expect(held.carried).toHaveLength(PUMP_NA_OUT)
    expect(new Set(held.carried.map((c) => c.u.toFixed(3))).size).toBe(PUMP_NA_OUT)
  })

  it('holds the two potassium at distinct depths too', () => {
    const held = pumpStateAt(PUMP_CYCLE_MS - 1900) // mid reset phase
    expect(held.carried).toHaveLength(PUMP_K_IN)
    expect(new Set(held.carried.map((c) => c.u.toFixed(3))).size).toBe(PUMP_K_IN)
  })

  it('never spaces ions ACROSS the channel — a pore fits one ion, so anything\n     offset sideways would travel through solid protein', () => {
    for (let ms = 0; ms < PUMP_CYCLE_MS; ms += 25) {
      for (const carried of pumpStateAt(ms).carried) {
        expect(Object.keys(carried).sort()).toEqual(['alpha', 'kind', 'u'])
      }
    }
    for (const ion of channelIonsAt(CHANNELS['leak-k'], 0, 200, realCounts, -72)) {
      expect(Object.keys(ion).sort()).toEqual(['alpha', 'kind', 'u'])
    }
  })

  it('keeps the queue in order and evenly spaced while it files through', () => {
    for (let ms = 0; ms < PUMP_CYCLE_MS; ms += 25) {
      const carried = pumpStateAt(ms).carried
      if (carried.length < 2) continue
      const gaps = carried.slice(1).map((c, i) => Math.abs(c.u - carried[i].u))
      // No two ions ever land on top of each other.
      for (const gap of gaps) expect(gap).toBeGreaterThan(0.01)
    }
  })

  it('fetches from the crowd and delivers into it, fading only out there', () => {
    const all = Array.from({ length: 400 }, (_, i) =>
      pumpStateAt((i / 400) * PUMP_CYCLE_MS).carried,
    ).flat()
    // Reaches out among the other ions on both sides...
    expect(Math.max(...all.map((c) => c.u))).toBeGreaterThan(2.5)
    expect(Math.min(...all.map((c) => c.u))).toBeLessThan(-2.5)
    // ...and anything near the pump is solid, never half-there.
    for (const carried of all) {
      if (Math.abs(carried.u) < 1.2) expect(carried.alpha).toBeGreaterThan(0.6)
    }
  })
})
