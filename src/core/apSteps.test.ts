import { describe, expect, it } from 'vitest'
import { ION_KINDS, IONS, particlesFor } from './ions'
import type { IonCounts } from '../state/ionStore'
import { AP_MS, apVmAt, kOpenFraction, naOpenFraction, potassiumLagMs } from './actionPotential'
import { OPEN_FRACTION } from './channels'
import {
  DWELL_TOTAL_MS,
  STEP_NAMES,
  apBar,
  advance,
  apSteps,
  runLengthMs,
  gateMoments,
  justChanged,
  gateFlashAt,
  FLASH_WINDOW,
  stepAt,
  stepCrossed,
} from './apSteps'

const real: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

const steps = apSteps(real)
const moments = gateMoments(real)

describe('the staged moments of a spike', () => {
  it('tells the story in the order the model actually does it', () => {
    // THE test of this file. The captions are written by hand and the positions
    // are measured off the model, so they can disagree — and they did: with the
    // old threshold, "now potassium opens" sat BEFORE the peak, and the caption
    // at the peak claimed potassium was still shut when it was not. If this
    // fails, the model changed and the words have to be rewritten to match.
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].at).toBeGreaterThanOrEqual(steps[i - 1].at)
    }
  })

  it('has sodium open, and potassium still shut, at the top of the spike', () => {
    const peak = steps.find((s) => s.key === 'peak')!
    expect(naOpenFraction(peak.at, real)).toBeGreaterThan(OPEN_FRACTION)
    expect(kOpenFraction(peak.at, real)).toBeLessThan(OPEN_FRACTION)
  })

  it('puts each moment where the thing it names really happens', () => {
    const at = (key: string) => steps.find((s) => s.key === key)!.at
    expect(at('na-opens')).toBeCloseTo(moments.naOpens, 3)
    expect(at('k-opens')).toBeCloseTo(moments.kOpens, 3)
    expect(at('falling')).toBeCloseTo(moments.naShuts, 3)
    // The peak and the dip are the extremes of the trace, not chosen numbers.
    const peak = at('peak')
    const trough = at('undershoot')
    for (let i = 0; i <= 100; i++) {
      const u = i / 100
      expect(apVmAt(u, real)).toBeLessThanOrEqual(apVmAt(peak, real) + 0.01)
      expect(apVmAt(u, real)).toBeGreaterThanOrEqual(apVmAt(trough, real) - 0.01)
    }
  })

  it('quotes a lag in the right ballpark for a real neuron', () => {
    // Textbook figure for the potassium conductance delay is well under 1 ms.
    expect(potassiumLagMs(real)).toBeGreaterThan(0.2)
    expect(potassiumLagMs(real)).toBeLessThan(2.5)
  })

  it('names the lag in the caption, from the measurement', () => {
    const step = steps.find((s) => s.key === 'k-opens')!
    expect(step.title).toContain(potassiumLagMs(real).toFixed(1))
  })

  it('holds still on every moment, the last one included', () => {
    // The last is held too, and then the spike is over — it used to be zero, so
    // "back to resting" flashed past unread while playback stopped dead at the
    // end waiting to be dismissed.
    for (const step of steps) expect(step.dwellMs).toBeGreaterThan(1000)
  })

  it('holds longest on the moment the whole thing is about', () => {
    const longest = steps.reduce((a, b) => (b.dwellMs > a.dwellMs ? b : a))
    expect(longest.key).toBe('k-opens')
  })

  it('adds its pauses up to the total the teaching note quotes', () => {
    expect(DWELL_TOTAL_MS).toBe(steps.reduce((sum, s) => sum + s.dwellMs, 0))
  })
})

describe('finding the moment we are in', () => {
  it('reports the last moment reached', () => {
    expect(stepAt(steps, 0).key).toBe('ready')
    expect(stepAt(steps, 0.999).key).toBe('undershoot')
    expect(stepAt(steps, 1).key).toBe('back')
  })

  it('fires a moment once, when it is passed', () => {
    const na = steps.find((s) => s.key === 'na-opens')!
    expect(stepCrossed(steps, na.at - 0.002, na.at)?.key).toBe('na-opens')
    // Already holding at it: must not fire again, or playback would never move.
    // A small window on purpose — the early moments sit close together, because
    // the spike itself is a fifth of the window the model runs for.
    expect(stepCrossed(steps, na.at, na.at + 0.002)).toBeNull()
  })
})

describe('flashing a gate at the instant it changes', () => {
  it('is brightest exactly at the change and fades either side', () => {
    expect(justChanged(moments.naOpens, moments.naOpens)).toBe(1)
    expect(justChanged(moments.naOpens + 0.03, moments.naOpens)).toBeLessThan(1)
    expect(justChanged(moments.naOpens + 0.2, moments.naOpens)).toBe(0)
  })

  it('never fires BEFORE the change', () => {
    // A centred window pre-announced the event: at the top of the spike the
    // potassium channel was glowing while its own caption said it was still
    // shut. A flash may only report what has already happened.
    expect(justChanged(moments.kOpens - 0.001, moments.kOpens)).toBe(0)
    expect(justChanged(moments.kOpens - 0.02, moments.kOpens)).toBe(0)
  })

  it('is a function of position, so scrubbing back and forth is consistent', () => {
    // Not a change detector watching frames — which is why dragging the
    // timeline backwards through a gate opening shows the flash again.
    // ⚠ Offset taken FROM the window rather than typed: it was 0.02, chosen
    // when the window was 0.05, and shortening the flash (2026-08-30) put it
    // outside — so the test failed for a reason that had nothing to do with
    // what it checks.
    const u = moments.naOpens + FLASH_WINDOW / 2
    expect(justChanged(u, moments.naOpens)).toBe(
      justChanged(u, moments.naOpens),
    )
    expect(justChanged(u, moments.naOpens)).toBeGreaterThan(0)
  })
})

describe('playing a whole spike through', () => {
  /** Run the sequencer frame by frame and report what happened. This cannot be
   *  checked in a browser screenshot: headless reports a frame delta of zero, so
   *  playback never moves and the picture sits on the first moment for ever. */
  function play(dtMs = 16) {
    const visited: string[] = []
    let u = 0
    // The opening pause is applied when a spike starts, because the first moment
    // sits AT the start and so is never crossed.
    let dwell = steps[0].dwellMs
    let elapsed = 0
    let overCount = 0
    for (let i = 0; i < 20000; i++) {
      const seen = stepAt(steps, u).key
      if (visited[visited.length - 1] !== seen) visited.push(seen)
      const tick = advance(steps, u, dwell, dtMs, AP_MS)
      u = tick.u
      dwell = tick.dwellLeft
      elapsed += dtMs
      if (tick.over) {
        overCount++
        break
      }
    }
    return { visited, elapsed, overCount }
  }

  it('stops on every moment, in order, and finishes', () => {
    const { visited, overCount } = play()
    expect(visited).toEqual(steps.map((s) => s.key))
    expect(overCount).toBe(1)
  })

  it('ends by itself — there is nothing to dismiss', () => {
    const { overCount } = play()
    expect(overCount).toBe(1)
  })

  it('takes about as long as the movement plus every pause', () => {
    const { elapsed } = play()
    expect(elapsed).toBeGreaterThan(runLengthMs(AP_MS) * 0.9)
    expect(elapsed).toBeLessThan(runLengthMs(AP_MS) * 1.15)
  })

  it('finishes whatever the frame rate', () => {
    // A slow machine takes bigger steps; it must not skip a moment or overrun.
    for (const dt of [8, 16, 33, 60]) {
      const { visited, overCount } = play(dt)
      expect(overCount).toBe(1)
      expect(visited).toEqual(steps.map((s) => s.key))
    }
  })

  it('holds still while a pause is running, then moves on', () => {
    const held = advance(steps, 0.5, 900, 16, AP_MS)
    expect(held.u).toBe(0.5)
    expect(held.dwellLeft).toBe(884)
    expect(held.over).toBe(false)
    const freed = advance(steps, 0.5, 0, 16, AP_MS)
    expect(freed.u).toBeGreaterThan(0.5)
  })

  it('stops exactly ON a moment rather than just past it', () => {
    const na = steps.find((s) => s.key === 'na-opens')!
    const tick = advance(steps, na.at - 0.001, 0, 16, AP_MS)
    expect(tick.u).toBe(na.at)
    expect(tick.dwellLeft).toBe(na.dwellMs)
  })

  it('never runs past the end', () => {
    expect(advance(steps, 0.999, 0, 5000, AP_MS).u).toBe(1)
  })
})

describe('A3: the ring flashes when a door OPENS, and not when it shuts', () => {
  // ⚠ It used to flash on both (user, 2026-08-30: "remove flash before the
  // channel closes"). A door closing is already visible twice over — the flap
  // swings back and the flow stops — so flashing it put a bright interruption
  // exactly where the thing to watch was the current dying away.
  //
  // ⚠ And the decision was four inline calls inside a React component, where
  // no test could reach it. It is `gateFlashAt` now.
  // The same run the rest of this file uses.

  it('flares at the moment each door opens', () => {
    expect(gateFlashAt(moments.naOpens, moments)['voltage-na']).toBe(1)
    expect(gateFlashAt(moments.kOpens, moments)['voltage-k']).toBe(1)
  })

  it('stays dark at the moment each door SHUTS', () => {
    // The moments the old version also flashed on.
    // Below anything anyone could see — the fade leaves a float's worth of
    // dust rather than a clean zero.
    expect(gateFlashAt(moments.naShuts, moments)['voltage-na']).toBeLessThan(0.01)
    expect(gateFlashAt(moments.kShuts, moments)['voltage-k']).toBeLessThan(0.01)
  })

  it('is dark for most of the time the door is open, and long before it shuts', () => {
    // ⚠ THE RING WAS STILL THERE (user, 2026-08-30: "I still can see a ring,
    // shortly before the channel closes"). It already fired on opening only —
    // but the sodium door is open for 0.053 of the run and the flash lasted
    // 0.05 of it, so the opening flare was still fading seven thousandths
    // before the door shut, and read as belonging to the closing.
    //
    // A flash that outlasts the state it announces has stopped being an event
    // marker. This pins it to the START of each opening.
    for (const [key, opens, shuts] of [
      ['voltage-na', moments.naOpens, moments.naShuts],
      ['voltage-k', moments.kOpens, moments.kShuts],
    ] as const) {
      const halfway = opens + (shuts - opens) / 2
      expect(gateFlashAt(halfway, moments)[key]).toBe(0)
      expect(gateFlashAt(shuts, moments)[key]).toBeLessThan(0.01)
      // And it really did flare at the start, or this passes for the wrong
      // reason.
      expect(gateFlashAt(opens, moments)[key]).toBe(1)
    }
  })

  it('never outlasts the briefest opening it has to mark', () => {
    // Measured against the model rather than eyeballed: whichever door is open
    // for the shortest time sets the longest a flash may last.
    const shortest = Math.min(moments.naShuts - moments.naOpens, moments.kShuts - moments.kOpens)
    expect(FLASH_WINDOW).toBeLessThan(shortest / 2)
  })

  it('fades rather than switching off', () => {
    const flare = gateFlashAt(moments.naOpens, moments)['voltage-na']
    const later = gateFlashAt(moments.naOpens + FLASH_WINDOW / 2, moments)['voltage-na']
    expect(later).toBeLessThan(flare)
    expect(later).toBeGreaterThan(0)
  })
})

// ── The timeline tool (user, 2026-09-01): the spike's moments become named
// dots on the transport's bar (that round's A5), so every step key must carry
// a chip-sized, speakable name.

describe('the timeline tool — chip names for the moments', () => {
  it('every moment a run can produce has a short spoken name (A5)', () => {
    for (const s of steps) expect(STEP_NAMES[s.key].length).toBeGreaterThan(0)
    for (const name of Object.values(STEP_NAMES)) {
      // Chip grammar: a name, not a sentence — and spelled in speakable words.
      expect(name).not.toMatch(/[.!⁺⁻]/)
      expect(name.length).toBeLessThanOrEqual(16)
    }
  })
})

describe('the dwell-weighted bar (2026-09-02)', () => {
  const bar = apBar(steps, AP_MS)

  it('spreads the clustered moments by the time playback spends on them', () => {
    // The five middle moments sit inside a fifth of the model window; on the
    // bar each must own a readable slice — the anti-overlap fact itself.
    expect(bar.ofU(0)).toBe(0)
    expect(bar.ofU(1)).toBe(1)
    for (let i = 1; i < steps.length; i++) {
      const gap = bar.ofU(steps[i].at) - bar.ofU(steps[i - 1].at)
      expect(gap, `${steps[i - 1].key} → ${steps[i].key}`).toBeGreaterThan(0.1)
    }
  })

  it('is exactly invertible, so the thumb and the scrub cannot disagree', () => {
    for (let i = 0; i <= 200; i++) {
      const u = i / 200
      expect(bar.uOf(bar.ofU(u))).toBeCloseTo(u, 6)
    }
  })
})
