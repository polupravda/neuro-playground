import { describe, expect, it } from 'vitest'
import { PUMP_K_IN, PUMP_NA_OUT } from '../core/proteins'
import { MEMBRANE_PX } from './layout'
import { HALF_MEM as DRAW_HALF_MEM } from './bilayer'
import { drawVoltageChannel } from './voltageChannel'
import { strictCanvas } from './strictCanvas'
import {
  LEAK_CYCLE_MS,
  DRAW_UNIT,
  PROTEIN_OUT,
  roomFor,
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
    // ⚠ Collected, then asserted ONCE per channel. A pore carries a real
    // current now — tens of ions a frame across a long sweep — and one
    // `expect` per ion made this test time out at five seconds. A test that
    // dies of its own measurement says nothing, and the claim is about the SET
    // of species that ever appear, not about each ball individually.
    for (const channel of [CHANNELS['leak-k'], CHANNELS['voltage-na']]) {
      const seen = new Set<string>()
      for (const { ions } of sweepChannel(channel)) {
        for (const ion of ions) seen.add(ion.kind)
      }
      expect(seen.size).toBeGreaterThan(0)
      expect([...seen].every((kind) => channel.passes.includes(kind as never))).toBe(true)
    }
  })

  it('sends potassium out and sodium in — each following its own gradient', () => {
    const k = sweepChannel(CHANNELS['leak-k']).flatMap((f) => f.ions)
    const na = sweepChannel(CHANNELS['voltage-na']).flatMap((f) => f.ions)
    // Outward means u falls from +1; inward means it rises from −1.
    // ⚠ Reduced rather than spread: the pores carry a real current now, so a
    // sweep is tens of thousands of ions and `Math.max(...arr)` overflows the
    // stack. A test that dies of its own measurement says nothing.
    const hi = (xs: typeof k) => xs.reduce((m, i) => Math.max(m, i.u), -Infinity)
    const lo = (xs: typeof k) => xs.reduce((m, i) => Math.min(m, i.u), Infinity)
    expect(hi(k)).toBeGreaterThan(0.9)
    expect(lo(k)).toBeLessThan(-0.9)
    expect(hi(na)).toBeGreaterThan(0.9)
    expect(lo(na)).toBeLessThan(-0.9)
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
    // ⚠ COUNTING 0 → SOMETHING NO LONGER WORKS: the pore carries a continuous
    // current now (A2, 2026-08-30), so it never returns to empty. Throughput is
    // occupancy × speed, and a harder push raises both.
    const occupancy = (vm: number) =>
      sweepChannel(CHANNELS['leak-k'], realCounts, vm).reduce((n, f) => n + f.ions.length, 0)
    // At rest potassium is pushed by 17 mV; at the top of a spike, by 148 — and
    // that is drawn as more ions on the way, not as the same few hurrying.
    expect(occupancy(60)).toBeGreaterThan(occupancy(-72))
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
    // ⚠ THE OLD MEASUREMENT COUNTED 0 → SOMETHING TRANSITIONS, and a conducting
    // pore never returns to zero now: it carries a QUEUE (2026-08-30). The
    // claim is unchanged and still the right one — more ions get through — but
    // throughput is occupancy TIMES speed, so both halves are measured.
    const occupancy = (channel: typeof CHANNELS['leak-k']) =>
      sweepChannel(channel).reduce((sum, f) => sum + f.ions.length, 0)

    /** How far the queue shifts in one small step of the clock — the whole
     *  train translates together, so comparing the sorted positions gives the
     *  speed without needing to identify individual ions. */

    // ⚠ Throughput is occupancy × speed, and the SPEED is now fixed for every
    // channel (2026-08-30) — see "a changing rate must not rewrite history"
    // below. So a busier channel is a fuller one, and that is the difference.
    expect(occupancy(CHANNELS['voltage-na'])).toBeGreaterThan(occupancy(CHANNELS['leak-k']))
  })

  it('carries a QUEUE through a fast channel, not one ion at a time', () => {
    // ⚠ A single open sodium channel carries about 1.2 pA — 7.5 MILLION ions a
    // second, some 7,500 in one millisecond of opening (user, 2026-08-30:
    // "would it be scientifically correct if we display ions as a current of
    // balls?"). It would; one ball was three orders of magnitude the wrong way
    // and taught that a current is a trickle of individuals.
    // ⚠ A2 (2026-08-30): this is the view the action-potential demo actually
    // draws, and it now uses the app's one flow model. The cap is how many fit
    // along the journey without becoming a bar, not a policy number.
    const spike = sweepChannel(CHANNELS['voltage-na'])
    const most = Math.max(...spike.map((f) => f.ions.length))
    expect(most).toBeGreaterThan(5)
    expect(most).toBeLessThanOrEqual(
      roomFor('na') * CHANNELS['voltage-na'].passes.length,
    )
    // And it never empties: a stream that stopped between balls would be back
    // to counting individuals.
    expect(Math.min(...spike.map((f) => f.ions.length))).toBeGreaterThan(0)
  })

  it('still dribbles through a slow one, so the difference is visible', () => {
    // The point of a stream is lost if everything streams. A resting potassium
    // leak is pushed by about 17 mV and really is a trickle.
    // ⚠ THE DIFFERENCE IS NOW DENSITY, NOT GAPS (A2, 2026-08-30). The old
    // drawing emptied a slow channel between crossings; a real leak carries a
    // continuous, thin current, and the honest contrast is that the spike's
    // door runs several times thicker. Asserting it empties would be asking the
    // picture to lie in the other direction.
    const leak = Math.max(...sweepChannel(CHANNELS['leak-k']).map((f) => f.ions.length))
    const spike = Math.max(...sweepChannel(CHANNELS['voltage-na']).map((f) => f.ions.length))
    expect(leak).toBeGreaterThan(0)
    expect(leak).toBeLessThan(spike / 2)
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

  it('makes every protein about as wide as the membrane is thick', () => {
    // The guard is against a protein drawn as a SLIVER — something too thin to
    // read as a lump of folded protein straddling a wall.
    //
    // ⚠ The bound was exactly MEMBRANE_PX (2026-08-30). These widths used to
    // come from a number in the data with one generic barrel stretched to fit
    // it; each channel is now its own traced protein and therefore has a real
    // shape and a real width. MEASURED, as multiples of the membrane's
    // thickness:
    //
    //     leak-k 1.02 | voltage-na 0.95 | pump 1.20 | voltage-k 0.95
    //     ligand 0.75
    //
    // The ligand-gated one is genuinely the slimmest of them in the drawing it
    // was traced from, and the drawing is the better source — a channel is not
    // obliged to be as wide as its membrane is thick. What this test is for is
    // the SLIVER: something too thin to read as a lump of folded protein. Set
    // just under the narrowest real one, which still catches one.
    for (const p of membraneProteins()) {
      expect(p.half * 2).toBeGreaterThanOrEqual(MEMBRANE_PX * 0.7)
      // And none of them is a post: no wider than twice the wall either.
      expect(p.half * 2).toBeLessThan(MEMBRANE_PX * 2)
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

  it('never spaces ions across the PORE, whatever it does outside it', () => {
    // ⚠ THE RULE IS ABOUT THE PORE, and this test used to enforce it by
    // forbidding the field entirely — which is stricter than the reason for it
    // (2026-08-30). The reason is that a pore is barely wider than one ion, so
    // anything offset sideways IN THERE would travel through solid protein.
    // That stops applying the moment an ion is out in the crowd, and the
    // current now fans into a plume there, as the patch clamp's does.
    //
    // So: inside the protein, dead straight; outside, free to spread.
    for (let ms = 0; ms < PUMP_CYCLE_MS; ms += 25) {
      for (const carried of pumpStateAt(ms).carried) {
        expect(Math.abs(carried.across ?? 0)).toBe(0)
      }
    }
    for (let ms = 0; ms < 2000; ms += 20) {
      for (const ion of channelIonsAt(CHANNELS['voltage-na'], 0, ms, realCounts, -20)) {
        if (Math.abs(ion.u) <= 1) expect(Math.abs(ion.across ?? 0)).toBe(0)
      }
    }
  })

  it('opens into a plume once the ions are clear of the protein', () => {
    // The patch clamp's look, which is what this was asked to match (user,
    // 2026-08-30: "the ion flow will look like on 'patch clamp' recording
    // bench").
    let widest = 0
    for (let ms = 0; ms < 2000; ms += 20) {
      for (const ion of channelIonsAt(CHANNELS['voltage-na'], 0, ms, realCounts, -20)) {
        if (Math.abs(ion.u) > 2) widest = Math.max(widest, Math.abs(ion.across ?? 0))
      }
    }
    expect(widest).toBeGreaterThan(0.1)
    // And it stays a stream from one hole, not a spray.
    expect(widest).toBeLessThan(1)
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

describe('the scene draws each channel as its own protein', () => {
  // ⚠ The neuron scene was the LAST place drawing a channel as a generic
  // pinched barrel (user, 2026-08-30: "'Resting membrane potential', 'trace
  // one signal' still preserves old channel visualisation"). It is the view
  // the app opens on, so it was the one place teaching that every door is the
  // same object with a different tint while every drawer said otherwise.

  it('gives the three families three different widths', () => {
    // The widths come from the drawings now, not from one number in the data
    // stretched to fit — so three different proteins are three different
    // widths. If these ever collapse to one value, the barrel is back.
    const byId = new Map<string, number>()
    for (const p of membraneProteins()) {
      if (p.channel) byId.set(p.channel.gating, p.half)
    }
    expect(byId.size).toBe(3)
    expect(new Set(byId.values()).size).toBe(3)
  })

  it('keeps the pump out of it — it is not a channel', () => {
    // Same reasoning that kept the aquaporin out: it has a domed cytoplasmic
    // head, it is only ever open on one side, and it spends energy. Dressing
    // it in a channel's silhouette would be a lie about what it does.
    const pumps = membraneProteins().filter((p) => p.kind === 'pump')
    expect(pumps.length).toBeGreaterThan(0)
    for (const p of pumps) expect(p.channel).toBeNull()
  })

  it('reaches further out of the wall than the wall is thick', () => {
    // A protein flush with the membrane reads as a hole in it. Every traced
    // drawing is fitted to PROTEIN_OUT and extends past it, so all of them
    // straddle the same wall — which is the thing that is actually true of
    // them, and the reason they are fitted by HEIGHT and not by width.
    expect(PROTEIN_OUT * 2).toBeGreaterThan(MEMBRANE_PX * 0.9)
  })
})

describe('a drawing authored in pixels, used in a world', () => {
  // ⚠ THIS BROKE THE AXON MEMBRANE VIEW COMPLETELY (2026-08-30): no membrane,
  // no channels, a flat yellow wash.
  //
  // The traced proteins are authored in a space where one unit is about one
  // screen pixel — line widths of 1.1, and a charge badge with a floor of 2.4
  // so it never disappears at bench size. The scene's world is nothing like
  // that: the whole membrane is 0.022 units across. Given a world-sized
  // `halfHeight` those floors stop being floors and become the largest things
  // on the canvas.
  //
  // The fix is that the scene scales a pixel-sized space into the world. These
  // tests pin BOTH halves of it: what goes wrong without the scaling, and that
  // the scaling actually puts the ink where the protein is.

  const paint = (halfHeight: number, unit: number) => {
    const c = strictCanvas()
    c.ctx.scale(unit, unit)
    drawVoltageChannel(c.ctx, {
      cx: 0,
      midY: 0,
      halfHeight,
      species: '#facc15',
      speciesDark: '#a16207',
      open: 0,
      plug: 0,
    })
    // strictCanvas records path points through the CURRENT TRANSFORM, so this
    // is where the ink actually lands in the world.
    return Math.max(...c.points.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))))
  }

  it('keeps a scene protein inside its own patch of membrane', () => {
    const reach = paint(DRAW_HALF_MEM, DRAW_UNIT)
    expect(reach).toBeLessThan(MEMBRANE_PX * 2)
    // And it is actually there — not scaled away to nothing.
    expect(reach).toBeGreaterThan(MEMBRANE_PX * 0.4)
  })

  it('shows what goes wrong if the drawing is shrunk instead of scaled', () => {
    // Handed the world-sized reach directly, with no transform — which is what
    // the broken version did. The pixel floors dominate and the ink lands tens
    // of membranes away. Kept as a test because the failure is silent: nothing
    // throws, the canvas simply fills with one colour.
    const reach = paint(PROTEIN_OUT, 1)
    expect(reach).toBeGreaterThan(MEMBRANE_PX * 20)
  })

  it('puts the protein where the membrane gap was cut for it', () => {
    // The gap and the drawing have to be one number, or there is a hole or an
    // overlap. `channelHalf` asks the drawing; this checks the answer survives
    // the scaling.
    for (const p of membraneProteins()) {
      if (!p.channel) continue
      expect(p.half).toBeGreaterThan(MEMBRANE_PX * 0.3)
      expect(p.half).toBeLessThan(MEMBRANE_PX * 1.2)
    }
  })
})

describe('a changing rate must not rewrite history', () => {
  // ⚠ THE BUG THE USER FOUND (2026-08-30: "leak channel lets out large amount
  // of K⁺ ions. This happens on inconsistent rate").
  //
  // The large amount is CORRECT — potassium's driving force is 17 mV at rest
  // and 129 mV at the peak of a spike, so a leak really does pour 7.6× harder
  // when the cell depolarises. The inconsistency was not.
  //
  // The clock was `ms / period`, i.e. `ms × rate`, which assumes the rate has
  // always been whatever it is now. So every time the driving force moved, the
  // whole accumulated phase moved with it — and the longer the app had been
  // running, the worse it got. Measured before the fix: at a two-minute clock,
  // a change in vm of a TENTH of a millivolt moved every ion 0.377 of the way
  // down the pore in a single frame.
  const at = (ms: number, vm: number) =>
    channelIonsAt(CHANNELS['leak-k'], 0, ms, realCounts, vm)
      .map((i) => i.u)
      .sort((a, b) => a - b)

  /** The furthest any ion moves between two frames. */
  const step = (ms0: number, vm0: number, ms1: number, vm1: number) => {
    const a = at(ms0, vm0)
    const b = at(ms1, vm1)
    const n = Math.min(a.length, b.length)
    if (n === 0) return 0
    return a.slice(0, n).reduce((most, u, i) => Math.max(most, Math.abs(b[i] - u)), 0)
  }

  it('moves no further when the voltage shifts than when it holds still', () => {
    const steady = step(120000, -72, 120016, -72)
    const shifting = step(120000, -72, 120016, -71.9)
    expect(shifting).toBeCloseTo(steady, 3)
  })

  it('does not get worse the longer the app has been running', () => {
    // The old fault grew with the clock, because the error was ms × Δrate.
    //
    // ⚠ Measured as the ERROR — how much a shifting voltage changes the step
    // compared with a steady one — not as the step itself. The step alone
    // differs between two clocks for an innocent reason: `transit` is not
    // linear, so the same phase advance moves an ion further in some parts of
    // its journey than others. Comparing steps at two clocks measures that
    // curve, not the fault.
    const err = (ms: number) =>
      Math.abs(step(ms, -72, ms + 16, -71.9) - step(ms, -72, ms + 16, -72))
    expect(err(1000)).toBeLessThan(0.002)
    expect(err(600000)).toBeLessThan(0.002)
  })

  it('still pours harder when the cell depolarises — which is the science', () => {
    // 17 mV of push at rest against 129 at the peak: the leak really does
    // surge during a spike, and the picture has to say so.
    const atRest = channelIonsAt(CHANNELS['leak-k'], 0, 0, realCounts, -72).length
    const atPeak = channelIonsAt(CHANNELS['leak-k'], 0, 0, realCounts, 40).length
    expect(atPeak).toBeGreaterThan(atRest * 3)
  })

  it('empties the pore where the ion stops caring, rather than freezing it', () => {
    // At its own Nernst voltage potassium has no reason to go anywhere. The old
    // model sent the period to infinity and left ions stranded mid-pore for
    // ever; a current of zero is an empty pore.
    expect(channelIonsAt(CHANNELS['leak-k'], 0, 500, realCounts, -89).length).toBe(0)
  })
})
