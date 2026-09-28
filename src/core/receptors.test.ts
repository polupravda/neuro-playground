import { describe, expect, it } from 'vitest'
import {
  MG_HALF_MV,
  MG_SLOPE_MV,
  MV_MAX,
  MV_MIN,
  MV_REST,
  PLUG_TAU_MS,
  RECEPTOR_KINDS,
  SLOW,
  boundAt,
  elapsedFor,
  flowAt,
  legsOf,
  mgBlock,
  openAt,
  openMs,
  readingAt,
  receptorsFire,
  receptorsSetMv,
  receptorsStart,
  receptorsStep,
  runMs,
  stageAt,
  type ReceptorsState,
} from './receptors'

/** Walk the clock the way the bench does — many small frames, never one jump. */
const run = (s: ReceptorsState, ms: number, step = 16) => {
  for (let t = 0; t < ms; t += step) receptorsStep(s, Math.min(step, ms - t))
}

/** The middle of this receptor's OWN open stretch — the only time it makes
 *  sense to ask it what it is passing. The two are wildly apart, which is the
 *  whole point, so a shared sample time would measure one of them asleep. */
const midFlow = (kind: 'ampa' | 'nmda'): number => {
  let t = 0
  for (const leg of legsOf(kind)) {
    if (leg.stage === 'flowing') return t + leg.ms / 2
    t += leg.ms
  }
  throw new Error('no flowing leg')
}

const fired = (mv = MV_REST): ReceptorsState => {
  const s = receptorsStart()
  receptorsSetMv(s, mv)
  s.plug = mgBlock(mv)
  receptorsFire(s)
  return s
}

describe('D07 — two receptors, one transmitter', () => {
  // ── A2: the timing, and that NMDA is slow ────────────────────────────────
  it('A2: NMDA is slower than AMPA by SLOW — in its OWN legs, not in the pauses', () => {
    const a = legsOf('ampa')
    const n = legsOf('nmda')
    expect(n.length).toBe(a.length)
    for (let i = 0; i < a.length; i++) {
      expect(n[i].stage, 'the two runs have different shapes').toBe(a[i].stage)
      // ⚠ A HOLD IS THE EXHIBIT'S, NOT THE PROTEIN'S. Stretching the pauses
      // too would make NMDA look slow because the bench waited longer, which
      // is not the claim being made.
      expect(
        n[i].ms,
        `leg '${a[i].stage}' is ${a[i].ownSpeed ? 'the receptor’s own' : 'a hold'}`,
      ).toBeCloseTo(a[i].ownSpeed ? a[i].ms * SLOW : a[i].ms, 6)
    }
    expect(openMs('nmda')).toBeCloseTo(openMs('ampa') * SLOW, 6)
  })

  it('A2: the frame the comparison lives on — AMPA finished, NMDA still open', () => {
    // ⚠ THE CLAIM MEASURED WHERE THE CHILD READS IT, which is not "a number in
    // the model is bigger" but "one picture is still doing something after the
    // other has stopped". If this can ever be false the exhibit says nothing.
    const s = fired(MV_MAX)
    run(s, runMs('ampa') + 40)
    expect(elapsedFor(s, 'ampa'), 'AMPA is still running').toBe(null)
    expect(openAt('ampa', elapsedFor(s, 'ampa'))).toBe(0)
    // AMPA has been and gone, and NMDA has not even finished opening.
    const mid = openAt('nmda', elapsedFor(s, 'nmda'))
    expect(mid, 'NMDA was already shut when AMPA finished').toBeGreaterThan(0)
    expect(mid, 'NMDA was already fully open when AMPA finished').toBeLessThan(1)
    // …and it is still wide open at twice AMPA's whole run.
    run(s, runMs('ampa'))
    expect(openAt('nmda', elapsedFor(s, 'nmda')), 'NMDA did not outlast AMPA')
      .toBeGreaterThan(0.9)
  })

  it('A4: every hold is a hold — nothing moves during a pause', () => {
    // ⚠ "with pauses between actions" (user). A pause that something creeps
    // through is not a pause; this walks each hold leg and requires the two
    // things that can move to be pinned.
    for (const kind of RECEPTOR_KINDS) {
      let t = 0
      for (const leg of legsOf(kind)) {
        if (!leg.ownSpeed && leg.stage !== 'arriving') {
          const at = (u: number) => ({
            open: openAt(kind, t + u * leg.ms),
            bound: boundAt(kind, t + u * leg.ms),
          })
          const a = at(0.02)
          const b = at(0.98)
          expect(b.open, `${kind}'s pore moved during the '${leg.stage}' hold`)
            .toBeCloseTo(a.open, 6)
          expect(b.bound, `${kind}'s socket moved during the '${leg.stage}' hold`)
            .toBeCloseTo(a.bound, 6)
        }
        t += leg.ms
      }
    }
  })

  it('A2: the socket holds the transmitter for as long as the pore is open', () => {
    // A pore held open by nothing would draw the cause disappearing while the
    // effect carried on.
    for (const kind of RECEPTOR_KINDS) {
      for (let t = 0; t < runMs(kind); t += 20) {
        if (openAt(kind, t) > 0.5) {
          expect(boundAt(kind, t), `${kind}: the pore is open at ${t}ms with nothing bound`)
            .toBeGreaterThan(0.5)
        }
      }
    }
  })

  // ── A3: the voltage dependence ───────────────────────────────────────────
  it('A3: the block is a curve in the voltage, not a threshold', () => {
    expect(mgBlock(MG_HALF_MV), 'half-block is not at the half-block voltage')
      .toBeCloseTo(0.5, 6)
    // Monotone, over the whole range the slider can reach.
    let last = 1.1
    for (let mv = MV_MIN; mv <= MV_MAX; mv += 1) {
      const b = mgBlock(mv)
      expect(b, `the block rose going from ${mv - 1} to ${mv} mV`).toBeLessThan(last)
      last = b
    }
    // ⚠ AND IT IS THE RIGHT CURVE. One e-fold of the odds per MG_SLOPE_MV is
    // what "a charge sitting part way down the electric field" means; a
    // logistic with any other slope would be a shape that merely looks similar.
    const odds = (mv: number) => (1 - mgBlock(mv)) / mgBlock(mv)
    expect(odds(MG_HALF_MV + MG_SLOPE_MV) / odds(MG_HALF_MV)).toBeCloseTo(Math.E, 6)
    expect(odds(MG_HALF_MV + 2 * MG_SLOPE_MV) / odds(MG_HALF_MV)).toBeCloseTo(Math.E ** 2, 6)
  })

  it('A3: at rest it is all but shut, and depolarised it is all but clear', () => {
    expect(mgBlock(MV_REST), 'resting block is not near-total').toBeGreaterThan(0.9)
    expect(mgBlock(MV_MAX), 'depolarised block has not cleared').toBeLessThan(0.15)
  })

  it('A3: the same message gets a different answer, and ONLY from NMDA', () => {
    // ⚠ THE EXHIBIT'S ONE CLAIM, pinned end to end: identical glutamate, two
    // voltages, and the difference must appear in NMDA and NOT in AMPA — or
    // the child is being shown a voltage knob that changes everything.
    const at = (kind: 'ampa' | 'nmda', mv: number) => {
      const s = fired(mv)
      run(s, midFlow(kind))
      return flowAt(s, kind)
    }
    expect(at('ampa', MV_REST), 'AMPA is not flowing at rest').toBeGreaterThan(0.9)
    expect(at('ampa', MV_MAX), 'AMPA changed with the voltage — it must not')
      .toBeCloseTo(at('ampa', MV_REST), 6)
    expect(at('nmda', MV_REST), 'NMDA leaked at rest').toBeLessThan(0.1)
    expect(at('nmda', MV_MAX), 'NMDA never woke up').toBeGreaterThan(0.5)
  })

  it('A3: the frame the bench exists for — wide open and passing nothing', () => {
    const s = fired(MV_REST)
    run(s, midFlow('nmda'))
    expect(openAt('nmda', elapsedFor(s, 'nmda')), 'NMDA is not open here').toBeGreaterThan(0.9)
    expect(flowAt(s, 'nmda'), 'it is open AND flowing — there is no lesson').toBeLessThan(0.1)
    expect(readingAt(s, 'nmda'), 'the reading does not say what is happening').toBe('blocked')
    // …and 'blocked' is a THIRD word, never a dressed-up 'shut': the same
    // receptor at the same moment, with only the voltage changed, says 'open'.
    const clear = fired(MV_MAX)
    run(clear, midFlow('nmda'))
    expect(readingAt(clear, 'nmda')).toBe('open')
    const early = fired(MV_REST)
    run(early, midFlow('ampa'))
    expect(readingAt(early, 'ampa')).toBe('open')
    expect(readingAt(receptorsStart(), 'nmda')).toBe('shut')
  })

  // ── A4: the plug is animated ─────────────────────────────────────────────
  it('A4: the magnesium MOVES — it is never set to where it belongs', () => {
    const s = receptorsStart()
    expect(s.plug).toBeCloseTo(mgBlock(MV_REST), 6)
    receptorsSetMv(s, MV_MAX)
    // ⚠ GUARD THE MIDDLE, not the ends: a plug that teleported would also pass
    // "it started high and ended low". These sample the journey and require it
    // to be somewhere in between, in both directions.
    const seen: number[] = []
    for (let i = 0; i < 40; i++) {
      receptorsStep(s, 16)
      seen.push(s.plug)
    }
    const mid = seen.filter((p) => p > 0.25 && p < 0.75)
    expect(mid.length, `the plug passed through no middle: ${seen.slice(0, 6).join(', ')}`)
      .toBeGreaterThan(3)
    expect(s.plug, 'it never arrived').toBeLessThan(0.2)

    // …and back down again when the cell repolarises, which is what makes the
    // dependence read as a dependence rather than a one-way trick.
    receptorsSetMv(s, MV_MIN)
    const back: number[] = []
    for (let i = 0; i < 40; i++) {
      receptorsStep(s, 16)
      back.push(s.plug)
    }
    expect(back.filter((p) => p > 0.25 && p < 0.75).length, 'it snapped back').toBeGreaterThan(3)
    expect(s.plug, 'it did not come back').toBeGreaterThan(0.85)
  })

  it('A4: the plug’s journey is the same at 30 fps and at 120', () => {
    // A teleport does not scale with the frame — so walk two framerates over
    // the same screen time and require the same place.
    const at = (step: number) => {
      const s = receptorsStart()
      receptorsSetMv(s, MV_MAX)
      run(s, PLUG_TAU_MS * 2, step)
      return s.plug
    }
    expect(at(33.3), 'the plug moves at whatever speed the frames arrive')
      .toBeCloseTo(at(8.3), 2)
  })

  it('A4: one press, one run — hammering cannot restart it mid-pause', () => {
    const s = receptorsStart()
    receptorsFire(s)
    const began = s.firedAt
    run(s, 400)
    receptorsFire(s)
    receptorsFire(s)
    expect(s.firedAt, 'a second press restarted the run').toBe(began)
    run(s, runMs('nmda'))
    receptorsFire(s)
    expect(s.firedAt, 'it never became ready again').not.toBe(began)
  })

  it('A3: the slider cannot leave the range the exhibit is honest over', () => {
    const s = receptorsStart()
    receptorsSetMv(s, 9999)
    expect(s.mv).toBe(MV_MAX)
    receptorsSetMv(s, -9999)
    expect(s.mv).toBe(MV_MIN)
  })

  it('stageAt never returns NaN, at any time a frame could land on', () => {
    for (const kind of RECEPTOR_KINDS) {
      for (const t of [-5, 0, 0.5, runMs(kind) - 0.5, runMs(kind), runMs(kind) + 500]) {
        const { p } = stageAt(kind, t)
        expect(Number.isFinite(p), `p is ${p} at ${t}ms of ${kind}`).toBe(true)
        expect(Number.isFinite(openAt(kind, t))).toBe(true)
      }
    }
  })
})
