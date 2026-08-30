import { describe, expect, it } from 'vitest'
import { ION_KINDS, IONS, particlesFor } from './ions'
import type { IonCounts } from '../state/ionStore'
import { AP_MS, apVmAt, kOpenFraction, naOpenFraction, potassiumLagMs } from './actionPotential'
import { OPEN_FRACTION } from './channels'
import {
  DWELL_TOTAL_MS,
  advance,
  apSteps,
  runLengthMs,
  gateMoments,
  justChanged,
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
    const u = moments.naOpens + 0.02
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
