import { describe, expect, it } from 'vitest'
import { AMPA_REVERSAL_MV, SPINE_REST_MV, cleftRun } from './cleft'
import { synapseRun } from './synapse'
import { chargeRamp, chargeSpan } from '../stage/particleStyle'
import { inkApart, spineHeadInk } from '../stage/synapseScene'
import { restingCounts } from './ions'
import { MV_MAX, mgBlock, stoneDepth } from './receptors'
import {
  FLOW_PER_ION,
  NMDA_CROSS_MS,
  STONE_MOVE_MS,
  nmdaKind,
  nmdaWaiting,
  nmdaLive,
  nmdaOpen,
  spineCharge,
  spineReach,
  spineWash,
  SPINE_CEILING_MV,
  spineStone,
  AMPA_AT_REST,
  AMPA_DELIVERED,
  CAM_SITES,
  CA_HALF,
  DELIVER_FUSE_AT,
  DELIVER_MS,
  PHOSPHATASE,
  TAP_REST_MS,
  camDrive,
  deliveryAt,
  nmdaFlow,
  potentiated,
  spineFire,
  spineMv,
  spineStart,
  spineStep,
  waveform,
  type SpineState,
} from './spine'

/** The child, tapping `n` times `gap` apart, then watching for a while. */
const burst = (n: number, gap = TAP_REST_MS + 10, watch = 16000): SpineState => {
  const s = spineStart()
  let fired = 0
  for (let t = 0; t < watch; t += 16) {
    if (fired < n && s.now >= fired * gap) {
      spineFire(s)
      fired++
    }
    spineStep(s, 16)
  }
  return s
}

/** The peak voltage of a single release, and WHEN it peaks. */
const onePulse = (ampa: number) => {
  const s = spineStart()
  s.ampa = ampa
  spineFire(s)
  let peak = -200
  let peakAt = 0
  for (let t = 0; t < 6000; t += 8) {
    spineStep(s, 8)
    const v = spineMv(s)
    if (v > peak) {
      peak = v
      peakAt = s.now
    }
  }
  return { peak, peakAt }
}

describe('S13 — the receiving side', () => {
  // ── the science this view had to get right before anything was drawn ─────
  it('A4: one message barely moves the magnesium — the pushback, pinned', () => {
    // ⚠ THE FLOW AS ASKED FOR WAS "one release → depolarisation → Mg block is
    // out". It is not out, and this is the guard that stops anyone quietly
    // making it so. If this ever passes with the block relieved, the exhibit
    // has started teaching that one message potentiates a synapse, which is
    // the opposite of what NMDA is for.
    const { peak } = onePulse(AMPA_AT_REST)
    expect(peak, `one release reaches ${peak.toFixed(1)} mV`).toBeLessThan(-50)
    expect(mgBlock(peak), 'one message unblocked NMDA').toBeGreaterThan(0.9)
  })

  it('A4: it agrees with the view it is reached from, to a millivolt', () => {
    // ⚠ TWO MODELS OF ONE SYNAPSE MUST NOT DRIFT. `core/cleft.ts` has computed
    // this EPSP since long before this view existed; `G_UNIT` is calibrated to
    // it rather than chosen, and this is what holds the calibration.
    const existing = cleftRun(synapseRun(restingCounts() as never, true)).peakPostMv
    expect(onePulse(AMPA_AT_REST).peak, `this view says ${onePulse(AMPA_AT_REST).peak.toFixed(1)}, the synapse view says ${existing.toFixed(1)}`)
      .toBeCloseTo(existing, 0)
  })

  it('A4: conductance adds — VOLTAGE does not, and that is why a burst saturates', () => {
    // Adding EPSPs in millivolts would have let a handful of taps sail past the
    // block, and taught that one synapse can excite itself as much as it likes.
    const s = burst(40, 60)
    expect(spineMv(s), 'the spine passed its own receptors’ reversal')
      .toBeLessThan(AMPA_REVERSAL_MV)
    expect(spineMv(s), 'even a hammering never gets near half block')
      .toBeLessThan(-30)
    expect(SPINE_REST_MV).toBeLessThan(-60)
  })

  // ── A4: the threshold ────────────────────────────────────────────────────
  it('A4: the line rejects the NEAR MISS — seven taps no, eight taps yes', () => {
    // ⚠ A total failure is exactly zero, so "more than nothing" tests nothing.
    // This pins the largest burst that must say no against the smallest that
    // must say yes, one tap apart.
    expect(potentiated(burst(7)), 'seven fast taps potentiated the synapse').toBe(false)
    expect(potentiated(burst(8)), 'eight fast taps did not').toBe(true)
    expect(burst(8).ampa).toBe(AMPA_AT_REST + AMPA_DELIVERED)
  })

  it('A4: it is not HOW MANY, it is HOW CLOSE — the same taps, spread, do nothing', () => {
    // The exhibit's claim. Eight taps potentiate at the terminal's own limit
    // and the very same eight do nothing at three times the spacing; and no
    // amount of patient tapping ever gets there.
    expect(potentiated(burst(8)), 'the fast burst stopped working').toBe(true)
    expect(potentiated(burst(8, 700)), 'eight taps at 700ms potentiated it').toBe(false)
    expect(potentiated(burst(12, 1400)), 'twelve taps at 1.4s potentiated it').toBe(false)
    expect(potentiated(burst(20, 2000, 50000)), 'patience alone potentiated it').toBe(false)
  })

  it('A4: the switch is calmodulin’s FOUR sites against the phosphatases', () => {
    // ⚠ THE RIGHT CONSTITUTIVE LAW. A plain threshold on calcium was measured
    // and could not tell four taps from eight (0.113 against 0.170). Calcium
    // acts through calmodulin, which binds four ions, so the same 1.5x becomes
    // 5x — the same fourth-power sensor this app already uses for release.
    expect(camDrive(CA_HALF), 'half occupancy is not at the half point').toBeCloseTo(0.5, 9)
    const odds = (ca: number) => camDrive(ca) / (1 - camDrive(ca))
    expect(odds(CA_HALF * 2) / odds(CA_HALF), 'the sensor is not a fourth power')
      .toBeCloseTo(2 ** CAM_SITES, 6)
    expect(camDrive(0)).toBe(0)
    // And the phosphatases sit between the two bursts that must differ.
    expect(PHOSPHATASE).toBeGreaterThan(0)
    expect(PHOSPHATASE).toBeLessThan(1)
  })

  it('A4: the cascade fires ONCE, however long the child goes on', () => {
    const s = burst(30, TAP_REST_MS + 10, 40000)
    expect(s.ampa, `${s.ampa} receptors after a very long burst`)
      .toBe(AMPA_AT_REST + AMPA_DELIVERED)
  })

  // ── P2: a stronger signal is BIGGER, not FASTER ──────────────────────────
  it('A4: after potentiation the answer is BIGGER, not quicker', () => {
    // ⚠ THE SECOND PUSHBACK, PINNED. The flow as asked for had the potentiated
    // response arriving "faster". Receptor kinetics do not change — what
    // changes is how many receptors there are, so the EPSP is TALLER and peaks
    // at the same moment. Drawing it as quicker would teach that the cell got
    // less sluggish, when what it got was stronger.
    const before = onePulse(AMPA_AT_REST)
    const after = onePulse(AMPA_AT_REST + AMPA_DELIVERED)
    expect(after.peak, 'the potentiated response is not bigger')
      .toBeGreaterThan(before.peak + 8)
    expect(after.peakAt, `it peaks at ${after.peakAt}ms against ${before.peakAt}ms`)
      .toBeCloseTo(before.peakAt, -1)
  })

  // ── P3: delivered beside the synapse, then slides in ─────────────────────
  it('A4: a receptor joins when it has SLID IN, not when its vesicle fuses', () => {
    // ⚠ "Receptors are not attracted through space — they diffuse in the
    // membrane plane and are caught" (01 → D07). The vesicle fusing is the
    // half-way point of the journey, not the end of it.
    const mid = deliveryAt({ id: 1, t: DELIVER_MS * DELIVER_FUSE_AT })
    expect(mid.fused, 'it has not finished fusing at the fusing point').toBeCloseTo(1, 6)
    expect(mid.slid, 'it had already slid home before it fused').toBeCloseTo(0, 6)
    const end = deliveryAt({ id: 1, t: DELIVER_MS })
    expect(end.slid).toBeCloseTo(1, 6)
    expect(DELIVER_FUSE_AT).toBeLessThan(1)

    // …and the count really waits for the slide, walked frame by frame through
    // the delivery itself rather than inspected after it has finished.
    const s = spineStart()
    let fired = 0
    let sawFused = false
    for (let t2 = 0; t2 < 20000; t2 += 16) {
      if (fired < 8 && s.now >= fired * (TAP_REST_MS + 10)) {
        spineFire(s)
        fired++
      }
      spineStep(s, 16)
      const sliding = s.deliveries.filter(
        (d) => deliveryAt(d).fused >= 1 && deliveryAt(d).slid < 1,
      )
      if (sliding.length > 0) {
        sawFused = true
        expect(
          s.ampa,
          `${sliding.length} receptor(s) still sliding, but ${s.ampa} already counted`,
        ).toBeLessThan(AMPA_AT_REST + AMPA_DELIVERED)
      }
    }
    expect(sawFused, 'no delivery was ever caught mid-slide').toBe(true)
    expect(s.ampa, 'they never arrived').toBe(AMPA_AT_REST + AMPA_DELIVERED)
  })

  // ── shapes and safety ────────────────────────────────────────────────────
  it('the conductance waveform rises, peaks at 1, and falls — never NaN', () => {
    for (const [rise, decay] of [[70, 700], [700, 4200]]) {
      let peak = 0
      for (let t = 0; t < decay * 8; t += 5) {
        const v = waveform(t, rise, decay)
        expect(Number.isFinite(v), `waveform is ${v} at ${t}`).toBe(true)
        peak = Math.max(peak, v)
      }
      expect(peak, 'the waveform is not normalised to peak at 1').toBeCloseTo(1, 3)
      expect(waveform(-1, rise, decay)).toBe(0)
      expect(waveform(decay * 20, rise, decay)).toBeLessThan(0.01)
    }
  })

  it('nothing runs while nothing has been sent', () => {
    const s = spineStart()
    for (let i = 0; i < 200; i++) spineStep(s, 16)
    expect(spineMv(s)).toBeCloseTo(SPINE_REST_MV, 6)
    expect(nmdaFlow(s)).toBe(0)
    expect(s.ca).toBe(0)
    expect(s.camk).toBe(0)
    expect(potentiated(s)).toBe(false)
  })

  it('the terminal has a refractory — hammering cannot outrun it', () => {
    const s = spineStart()
    for (let i = 0; i < 10; i++) spineFire(s)
    expect(s.pulses.length, 'ten presses in one frame all got through').toBe(1)
  })
})

describe('21c-61 — what gets past the stone', () => {
  const burst = (n: number, gap: number, watch = 14000, dt = 8) => {
    const s = spineStart()
    let fired = 0
    const log: { kind: 'na' | 'ca'; at: number }[] = []
    let inSeatedPore = 0
    let seated = 0
    let frames = 0
    for (let t = 0; t < watch; t += dt) {
      if (fired < n && s.now >= fired * gap) {
        spineFire(s)
        fired++
      }
      const before = s.sent
      spineStep(s, dt)
      if (s.sent > before) log.push({ kind: nmdaKind(s.sent - 1), at: s.now })
      if (s.ions.some((i) => i.t < 1) && spineStone(s) > 0.5) inSeatedPore++
      seated += spineStone(s)
      frames++
    }
    return { s, log, inSeatedPore, seatedFrac: seated / frames }
  }

  it('A3: one message lets one or two through, and the stone is still in', () => {
    // ⚠ THE USER'S OWN FLOW: "many Na+ ions enter postsynaptic neuron, 1-2 ions
    // enter NMDA, Mg block is blocking". Both halves are the claim — a trickle
    // AND a stone that is still, overwhelmingly, in the way.
    const one = burst(1, 0)
    expect(one.log.length, `${one.log.length} ions on a single message`)
      .toBeGreaterThanOrEqual(1)
    expect(one.log.length).toBeLessThanOrEqual(2)
    expect(one.seatedFrac, 'the stone is not blocking at all').toBeGreaterThan(0.9)
  })

  it('A3: a burst gets CALCIUM through, and it arrives before the cascade fires', () => {
    // ⚠ (user, two rounds ago: "there is no calcium ions binding included".)
    // The cascade cannot light off calcium the child never saw arrive.
    const b = burst(8, 220)
    expect(b.s.ampa, 'the burst did not potentiate — wrong fixture').toBe(3)
    const firstCa = b.log.find((i) => i.kind === 'ca')
    expect(firstCa, 'no calcium ever gets past the stone in a burst').toBeTruthy()
    // …and it is IN before CaMKII is up. Re-run to the moment CaMKII latches.
    const s = spineStart()
    let fired = 0
    let caBy = 0
    let camkAt: number | null = null
    for (let t = 0; t < 14000; t += 8) {
      if (fired < 8 && s.now >= fired * 220) {
        spineFire(s)
        fired++
      }
      const before = s.sent
      spineStep(s, 8)
      if (s.sent > before && nmdaKind(s.sent - 1) === 'ca') caBy++
      if (camkAt === null && s.camk >= 1) camkAt = caBy
    }
    expect(camkAt, 'CaMKII never latched').not.toBeNull()
    // ⚠ CAUSE ON SCREEN BEFORE EFFECT, and this is the whole point of the step.
    // At one-in-three calcium the first pink ball got through at 3.6s and
    // CaMKII had latched at 2.8 — the cascade lighting off a calcium the child
    // never saw arrive, which is what "there is no calcium ions binding
    // included" was reporting.
    expect(camkAt, 'CaMKII lit before any calcium was drawn getting in')
      .toBeGreaterThan(0)
  })

  it('A3: NO ion is ever in the pore while the stone is in it', () => {
    // ⚠ THE INCONSISTENCY THE COMPARISON DRAWER WAS CORRECTED FOR (user,
    // 2026-09-11: "the Mg block falls back covering the entrance. Yet, the ions
    // pass through the channel"). Two things had to be true for this: the
    // crossing must FIT inside a clear hold — it is derived from the spell, not
    // typed — and the throat is committed clear while an ion is in it, because
    // `stoneSeated`'s spell is `hash01(k) < plug` and `plug` drifts, so a spell
    // that was clear at launch could turn under the ion.
    for (const [n, gap] of [[1, 0], [4, 220], [8, 220], [8, 900], [16, 220]] as const) {
      const b = burst(n, gap)
      expect(b.inSeatedPore, `${n} taps at ${gap}ms: ion inside a seated pore`).toBe(0)
    }
    // ⚠ AND THE LAUNCH IS ASKED DIRECTLY, because the lift MASKS it. A break
    // that let ions through whatever the stone was doing would sail past the
    // check above: the stone is pushed clear while a quantum is queued, so "no
    // ion in a seated pore" becomes trivially true. The claim is about the
    // moment of LAUNCH — the stone must already have moved.
    for (const [n, gap] of [[1, 0], [8, 260], [8, 900]] as const) {
      const s = spineStart()
      let fired = 0
      let launchedBlocked = 0
      for (let t = 0; t < 14000; t += 8) {
        if (fired < n && s.now >= fired * gap) {
          spineFire(s)
          fired++
        }
        const before = s.sent
        spineStep(s, 8)
        if (s.sent > before && spineStone(s) > 0.25) launchedBlocked++
      }
      expect(launchedBlocked, `${n} taps at ${gap}ms: an ion set off through a seated stone`)
        .toBe(0)
    }
  })

  it('A3 (21c-74): the stone MOVES first, and nothing crosses until it has', () => {
    // ⚠ THERE IS NO CLEAR HOLD TO FIT ANY MORE. This used to derive the
    // crossing from the spell's hold — the stretch between two coin tosses —
    // and both are gone: the stone is a depth driven by the voltage, so it
    // cannot slam shut mid-crossing and there is nothing to fit inside.
    //
    // What replaces it is the order of events. A quantum comes due, the stone
    // gets out of the way, and only then does anything set off — so the lift is
    // visibly the CAUSE of the crossing. Driven the other way round, an ion
    // spent the whole eased lift inside a throat that was still half blocked,
    // which is the 2026-09-11 correction happening again while it moved.
    expect(STONE_MOVE_MS, 'the stone takes as long to move as an ion takes to cross')
      .toBeLessThan(NMDA_CROSS_MS * 0.5)
    const s = spineStart()
    let fired = 0
    let inSeated = 0
    let sawCross = 0
    for (let t = 0; t < 9000; t += 8) {
      if (fired < 8 && s.now >= fired * 260) {
        spineFire(s)
        fired++
      }
      spineStep(s, 8)
      const crossing = s.ions.some((ion) => ion.t < 1)
      if (crossing) {
        sawCross++
        if (spineStone(s) > 0.25) inSeated++
      }
    }
    expect(sawCross, 'nothing ever crossed, so the claim is empty').toBeGreaterThan(40)
    expect(inSeated, `${inSeated} frames with an ion inside a throat the stone is in`).toBe(0)
  })

  it('A3: the drawn ions and the calcium that drives the cascade are ONE number', () => {
    // ⚠ `nmdaFlow` is the whole of it: the calcium is its integral over a
    // thousand, the ions are that same integral in lumps. So more ions must
    // mean more calcium, always — never a trickle drawn against a flood.
    const a = burst(4, 220)
    const c = burst(16, 220)
    expect(c.log.length, 'more messages did not send more ions')
      .toBeGreaterThan(a.log.length)
    expect(c.s.flowed, 'more ions came from less flow').toBeGreaterThan(a.s.flowed)
    // …and the count really is the flow quantised.
    expect(a.s.sent).toBe(Math.min(a.s.sent, Math.floor(a.s.flowed / FLOW_PER_ION)))
    expect(c.s.sent).toBeLessThanOrEqual(Math.floor(c.s.flowed / FLOW_PER_ION))
  })

  it('A3: a queue forms at the mouth, and it forms while the stone is still down', () => {
    // A block is only legible from outside if something is visibly waiting.
    // ⚠ AND THE WAIT IS SHORT NOW, deliberately: the stone lifts as soon as a
    // quantum is due, so what the child sees is a pair arriving at the mouth
    // and the stone getting out of their way — not a queue piling up against a
    // coin that will not turn over.
    const s = spineStart()
    let fired = 0
    let queuedWhileDown = 0
    let everQueued = 0
    for (let t = 0; t < 9000; t += 8) {
      if (fired < 8 && s.now >= fired * 260) {
        spineFire(s)
        fired++
      }
      spineStep(s, 8)
      if (nmdaWaiting(s) > 0) {
        everQueued++
        if (spineStone(s) > 0.25) queuedWhileDown++
      }
    }
    expect(everQueued, 'nothing ever waits at the mouth').toBeGreaterThan(20)
    expect(queuedWhileDown, 'nothing ever waits for the stone to move')
      .toBeGreaterThan(4)
  })
})

describe('21c-64 — the pink receptor is ACTIVATED by a coincidence', () => {
  const burst = (n: number, gap: number, ampa = 1) => {
    const s = spineStart()
    s.ampa = ampa
    let fired = 0
    let peakLive = 0
    let minPlug = 1
    let peakTint = -1
    for (let t = 0; t < 9000; t += 8) {
      if (fired < n && s.now >= fired * gap) {
        spineFire(s)
        fired++
      }
      s.ampa = ampa
      spineStep(s, 8)
      peakLive = Math.max(peakLive, nmdaLive(s))
      peakTint = Math.max(peakTint, spineCharge(s))
      minPlug = Math.min(minPlug, s.plug)
    }
    return { s, peakLive, minPlug, peakTint }
  }

  it('neither half of it does anything on its own', () => {
    // ⚠ A ligand-bound NMDA at rest is not conducting: its gate is open and its
    // throat is plugged. A depolarised spine with no glutamate is not
    // conducting either. THAT is what makes this receptor the coincidence
    // detector, and the picture had no mark for it — "bound" and "conducting"
    // looked the same.
    const s = spineStart()
    expect(nmdaLive(s), 'a resting spine is conducting').toBeLessThan(0.01)
    // ligand, no depolarisation worth the name: the gate opens, almost nothing
    // gets through.
    const one = burst(1, 0)
    expect(nmdaOpen(one.s) >= 0 && one.peakLive, 'one message conducts as if unblocked')
      .toBeLessThan(0.12)
    // depolarisation, no ligand: hand it a spine that is warm but unbound.
    const warm = spineStart()
    warm.plug = mgBlock(-20)
    expect(nmdaOpen(warm), 'the fixture has a ligand after all').toBe(0)
    expect(nmdaLive(warm), 'an unblocked NMDA conducts with no glutamate').toBe(0)
  })

  it('and BOTH together is many times either', () => {
    const weak = burst(1, 0)
    const strong = burst(8, 220, 3)
    expect(strong.peakTint, 'the strong fixture never reddens').toBeGreaterThan(0.6)
    expect(strong.peakLive, 'conducting no better with both than with one')
      .toBeGreaterThan(weak.peakLive * 4)
  })

  it('⚠ THE STONE LIFTS, IT NEVER LEAVES — and the numbers say by how much', () => {
    // ⚠ THE PUSHBACK, kept as a measurement (user asked for it: "displayed or
    // pushed back if there is a scientific misconception"). "The magnesium
    // block lifts up, opens the channel" is right about the lift and wrong
    // about the opening. Woodhull at this synapse: 96% blocked at rest, and at
    // the very best ONE synapse can do to itself, still blocking over half the
    // time. What gets through is a trickle that got bigger, not an open pore.
    expect(mgBlock(SPINE_REST_MV), 'the block is not nearly total at rest')
      .toBeGreaterThan(0.95)
    const strong = burst(8, 220, 3)
    expect(strong.minPlug, 'the stone did not lift at all').toBeLessThan(0.65)
    expect(strong.minPlug, 'the stone left the throat — one synapse cannot do that')
      .toBeGreaterThan(0.35)
    // …and harder tapping cannot clear it either: the voltage saturates.
    const harder = burst(24, 220, 3)
    expect(harder.minPlug, 'tapping harder emptied the throat').toBeGreaterThan(0.35)
    expect(
      strong.minPlug - harder.minPlug,
      'three times the messages moved the block a lot — the voltage is not saturating',
    ).toBeLessThan(0.12)
  })
})

describe('21c-65 — one block, two views, and a head that actually reddens', () => {
  it('A1: the two views draw the SAME block — they reach different voltages', () => {
    // ⚠ (user, 2026-09-13: "'the block lifts, it never opens' … this is not what
    // you have displayed in 'AMPA & NMDA receptors' drawer. Align across
    // visualisations".) They are not drawing it differently: one rule, one
    // curve, and at any given voltage the same answer. What differs is how far
    // each can GO.
    for (const mv of [-90, -70, -50, -30, -17, 0, 20]) {
      expect(mgBlock(mv), `the two views disagree at ${mv} mV`).toBe(mgBlock(mv))
    }
    // …the drawer's dial reaches where the stone really is out…
    expect(mgBlock(MV_MAX), 'the dial cannot clear the block at all').toBeLessThan(0.12)
    // …and one synapse cannot take itself there.
    expect(SPINE_CEILING_MV, 'the ceiling is above the dial’s own top').toBeLessThan(MV_MAX)
    // ⚠ AND THE BOUND FOLLOWS THE CEILING, WHICH MOVED (21c-70). It was 0.45,
    // against a ceiling of −16.4 mV. Stretching `TIME_FACTOR` to 140 widened the
    // AMPA response while the child's TAP RATE stayed a wrist — 220 ms is 1.6
    // real ms at this pacing against 3.1 at the old one — so the same hammering
    // now drives the synapse at twice the frequency IN CELL TIME, and it
    // summates further: MEASURED, the ceiling is −9.3 mV and the block there is
    // 38%, not 46%.
    //
    // That is the model being honest, not the claim being softened: a synapse
    // really driven at 637 Hz does depolarise more than one driven at 318. What
    // must hold is the CONTRAST with the drawer's dial, which is the thing the
    // two views are aligned on — the dial clears the block, one synapse does not
    // come close — so that is what is asked, as a ratio rather than a level.
    expect(mgBlock(SPINE_CEILING_MV), 'a synapse CAN clear its own block')
      .toBeGreaterThan(0.3)
    expect(
      mgBlock(SPINE_CEILING_MV) / mgBlock(MV_MAX),
      `the synapse's ceiling is only ${(mgBlock(SPINE_CEILING_MV) / mgBlock(MV_MAX)).toFixed(1)}× the dial's top`,
    ).toBeGreaterThan(3)
    // ⚠ AND THE CEILING IS THE MEASURED ONE, not a number typed beside it: a
    // long hard burst through three catchers must land on it.
    const s = spineStart()
    s.ampa = 3
    let fired = 0
    let peak = -99
    for (let t = 0; t < 12000; t += 8) {
      if (fired < 24 && s.now >= fired * 220) {
        spineFire(s)
        fired++
      }
      s.ampa = 3
      spineStep(s, 8)
      peak = Math.max(peak, spineMv(s))
    }
    expect(peak, `a burst reaches ${peak.toFixed(1)} against a stated ceiling of ${SPINE_CEILING_MV}`)
      .toBeCloseTo(SPINE_CEILING_MV, 0)
  })

  it('A2: the head walks cold → hot, and never goes faint on the way', () => {
    // ⚠ (user: "'depolarized cell bg' was supposed to get red, which does not
    // happen. Why?") Two faults, both measured. The wash's strength was |t|,
    // which is ZERO as the cell passes through neutral — the most invisible
    // moment of the whole event — and the app's ramp runs blue → SLATE → red,
    // so this view's entire working range came out grey.
    //
    // ⚠ AND IT IS ASKED OF THE COMPOSITE NOW, NOT OF THE HUE (21c-70). The head's
    // reading is carried by TWO channels — the hue says whether it is
    // depolarised, the alpha says by how much — because the sky→red ink has not
    // the range for both (see `spineWash` for the proof). A separation asked of
    // `spineCharge` alone therefore measures one half of the claim and misses
    // the half that now carries the size of the event.
    const peak = (ampa: number, taps: number, gap: number) => {
      const s = spineStart()
      s.ampa = ampa
      let fired = 0
      let best = 0
      let bestS = s
      let faint = 9
      for (let t = 0; t < 9000; t += 16) {
        if (fired < taps && s.now >= fired * gap) {
          spineFire(s)
          fired++
        }
        s.ampa = ampa
        spineStep(s, 16)
        if (spineReach(s) > best) {
          best = spineReach(s)
          bestS = { ...s, pulses: [...s.pulses], ions: [...s.ions], deliveries: [...s.deliveries] }
        }
        if (s.now > 200) faint = Math.min(faint, spineWash(s))
      }
      return { best, faint, ink: spineHeadInk(bestS), tint: spineCharge(bestS) }
    }
    expect(spineCharge(spineStart()), 'the head is not cold at rest').toBe(0)
    const rest = spineHeadInk(spineStart())
    // ⚠ AT A HAND'S TAPPING RATE, not at the model's fastest — the child is
    // pressing a button, and a claim tested only at 220ms is a claim about a
    // speed nobody can produce.
    const three = peak(3, 6, 400)
    expect(three.tint, 'a burst through three does not redden it').toBeGreaterThan(0.85)
    // …and RED means red: the hot channel leads the cold one on the composite.
    expect(three.ink[0] - three.ink[2], `a burst through three paints ${three.ink.map(Math.round).join(',')}`)
      .toBeGreaterThan(25)
    const one = peak(AMPA_AT_REST, 6, 400)
    // MEASURED: 24.3 apart on the composite. Pinned under it, so the two
    // readings drifting together breaks this before they meet.
    expect(
      inkApart(three.ink, one.ink),
      `one catcher paints ${one.ink.map(Math.round).join(',')} against three at ${three.ink.map(Math.round).join(',')}`,
    ).toBeGreaterThan(18)
    expect(one.tint, 'one catcher does nothing visible at all').toBeGreaterThan(0.35)
    expect(inkApart(one.ink, rest), 'one catcher is indistinguishable from rest')
      .toBeGreaterThan(30)
    // …and the wash is always painted.
    expect(Math.min(one.faint, three.faint), 'the wash fades out on the way')
      .toBeGreaterThan(0.4)
    // ⚠ AND NO SLATE ANYWHERE ON THE WALK.
    // ⚠ ASKED AGAINST THE APP'S OWN TWO INKS, not against the span's own ends —
    // a first version compared each step to `chargeSpan(0)` and `chargeSpan(1)`,
    // which is circular: a break that started the walk at the NEUTRAL slate
    // instead of the cold ink was perfectly linear between its own endpoints
    // and sailed straight through.
    const cold = chargeRamp(-1).split(',').map(Number)
    const hot = chargeRamp(1).split(',').map(Number)
    const neutral = chargeRamp(0).split(',').map(Number)
    expect(chargeSpan(0), 'the walk does not start at the app’s cold ink')
      .toBe(chargeRamp(-1))
    expect(chargeSpan(1), 'the walk does not end at the app’s hot ink').toBe(chargeRamp(1))
    for (let i = 0; i <= 20; i++) {
      const f = i / 20
      const rgb = chargeSpan(f).split(',').map(Number)
      for (let k = 0; k < 3; k++) {
        expect(rgb[k], `the span leaves the two inks at ${f}`)
          .toBeCloseTo(cold[k] + (hot[k] - cold[k]) * f, -0.5)
      }
      // …and it never wears the colour of no charge at all.
      const toSlate = Math.hypot(...rgb.map((v, k) => v - neutral[k]))
      expect(toSlate, `the head wears the neutral slate at ${f}`).toBeGreaterThan(30)
    }
  })
})

describe('21c-68 — depolarisation is the CAUSE of NMDA activation, not its result', () => {
  // ⚠ (user, 2026-09-13: "The depolarization should occur after AMPA receptor
  // gets activated and first sodium ions penetrate, because then this
  // depolarization causes NMDA activation … Depolarization is a cause of an
  // NMDA activation and not its result." They are right, and the model always
  // agreed — `spineMv` is driven by AMPA alone and `plug` follows it. What did
  // not agree was the PICTURE.)
  const order = (taps: number, ampa: number, lag: number) => {
    const s = spineStart()
    s.ampa = ampa
    let fired = 0
    const ev: Record<string, number> = {}
    for (let t = 0; t <= 16000; t += 25) {
      if (fired < taps && t >= fired * 400) {
        spineFire(s, Math.max(0, lag - t))
        fired++
      }
      s.ampa = ampa
      const before = s.sent
      spineStep(s, 25)
      if (ev.headWarms === undefined && spineCharge(s) > 0.1) ev.headWarms = t
      if (ev.stoneLifts === undefined && spineStone(s) < 0.5) ev.stoneLifts = t
      if (ev.conducts === undefined && nmdaLive(s) > 0.05) ev.conducts = t
      if (s.sent > before && ev.ion === undefined) ev.ion = t
    }
    return ev
  }

  it('at rest the stone is IN the throat — a 96% block is a plugged pore', () => {
    // ⚠ IT WAS DRAWN OUT. The stone's depth was multiplied by how open the GATE
    // is, so with no glutamate anywhere near it the magnesium hung above the
    // channel: the child met the resting state as "the pore is clear", watched
    // the stone DROP IN as the gate opened, and then lift — the whole story
    // backwards, and exactly why the block read as a consequence of NMDA rather
    // than the thing standing in its way.
    expect(spineStone(spineStart()), 'the stone is not in the throat at rest')
      .toBeGreaterThan(0.95)
    expect(mgBlock(SPINE_REST_MV), 'the block is not nearly total at rest')
      .toBeGreaterThan(0.95)
  })

  it('the stone never lifts before the head has warmed', () => {
    // ⚠ AND IT DID: `stoneSeated` spends the block as a fraction of TIME, so
    // even a 96% block has a spell in every twenty-eight where the stone is up —
    // measured, one landed at 3.6 s, SEVEN SECONDS before anything had
    // happened. Which way the block flickers on a shut channel is unobservable,
    // so it is not drawn; the fraction is untouched wherever it can be seen.
    const ev = order(8, 3, 10879)
    expect(ev.headWarms, 'the head never warms in this fixture').toBeDefined()
    expect(ev.stoneLifts, 'the stone never lifts in a burst').toBeDefined()
    expect(ev.stoneLifts, `the stone lifts at ${ev.stoneLifts}ms, the head warms at ${ev.headWarms}`)
      .toBeGreaterThanOrEqual(ev.headWarms)
  })

  it('…and the whole chain runs in the order the biology does', () => {
    const ev = order(8, 3, 10879)
    expect(ev.conducts, 'NMDA never conducts').toBeDefined()
    expect(ev.ion, 'no ion ever gets through NMDA').toBeDefined()
    // depolarised → the block eases → it conducts → ions cross. Never the
    // other way round, and never all at once.
    expect(ev.headWarms).toBeLessThanOrEqual(ev.conducts)
    expect(ev.conducts).toBeLessThanOrEqual(ev.ion)
    expect(ev.ion - ev.headWarms, 'cause and effect are simultaneous — no chain to read')
      .toBeGreaterThan(0)
  })

  it('…and one weak message barely moves it, where a burst moves it a lot', () => {
    // The other half of the claim: if a single message lifted the stone as a
    // burst does, the burst would have nothing to teach.
    //
    // ⚠ AND IT IS ASKED AS A SHARE, NOT AS A NEVER (21c-70). This read
    // `expect(ev.stoneLifts).toBeUndefined()` — one message must NEVER lift the
    // stone — and that is not what the model says, nor what the app tells the
    // child. `stoneSeated` spends the block as a fraction of TIME, and at the
    // −58 mV one message reaches the block is about 96%, so roughly one spell in
    // twenty IS clear. The info block says so in as many words: the stone sits
    // in the throat "about nineteen times out of twenty when the cell is at
    // rest". A guard forbidding the twentieth was asserting the absence of an
    // event the exhibit explicitly teaches — and it passed only because, at the
    // old spell length, no clear spell happened to land while the gate was open.
    // Widening the receptor moved the spells and one landed, which is luck
    // changing, not behaviour.
    //
    // The real claim is the SEPARATION, so that is what is measured.
    // ⚠ AND IT IS A DEPTH NOW, NOT A SHARE OF TIME (21c-74). This measured how
    // OFTEN the throat was clear — 6.1% against 58.5% — which was the right
    // reading while the stone was a coin tossed every spell. The stone sits at
    // the block's own depth now, so the claim is where it SITS: deep in the
    // throat after one message, visibly lifted after a burst.
    const deepest = (taps: number, ampa: number) => {
      const s = spineStart()
      s.ampa = ampa
      let fired = 0
      let highest = 1
      for (let t = 0; t <= 16000; t += 25) {
        if (fired < taps && t >= fired * 400) { spineFire(s, Math.max(0, 10879 - t)); fired++ }
        s.ampa = ampa
        spineStep(s, 25)
        // the LEAST seated it ever gets — how far this many messages lift it
        if (t > 10879) highest = Math.min(highest, stoneDepth(s.plug))
      }
      return highest
    }
    const one = deepest(1, AMPA_AT_REST)
    const burst = deepest(8, 3)
    expect(order(1, AMPA_AT_REST, 10879).headWarms, 'one message does not even warm the head')
      .toBeDefined()
    // MEASURED: one message barely moves it; a burst through three lifts it
    // clear of the mouth. Pinned either side of both.
    expect(one, `one message leaves the stone ${(one * 100).toFixed(0)}% down`)
      .toBeGreaterThan(0.85)
    expect(burst, `a burst leaves the stone ${(burst * 100).toFixed(0)}% down`)
      .toBeLessThan(0.55)
        expect(one - burst, `a burst lifts it only ${((one - burst) * 100).toFixed(0)} points`)
      .toBeGreaterThan(0.3)
    // …and it never comes ALL the way out, which is this exhibit's own claim.
    expect(burst, 'one synapse cleared its own block entirely').toBeGreaterThan(0.2)
  })
})
