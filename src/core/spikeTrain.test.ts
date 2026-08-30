import { describe, expect, it } from 'vitest'
import { ION_KINDS, IONS, particlesFor } from './ions'
import type { IonCounts } from '../state/ionStore'
import { FIRE_STIMULUS, trajectory } from './spikeModel'
import { STIMULI } from './scenarios'
import { absoluteRefractoryMs, relativeRefractoryMs } from './refractory'
import { STIM_FLASH_MS, stimFlash } from './spikeTrain'
import {
  TRAIN_WINDOW_MS,
  pressPush,
  recoveryAt,
  recoveryNow,
  sinceSpikeMs,
  trainAdvance,
  trainNarration,
  trainStart,
  type TrainState,
} from './spikeTrain'

const real: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

/** Fire once, wait, push again with `amp`, and report what the second push did. */
function pair(gapMs: number, amp: number): { fired: boolean; peak: number } {
  const s = trainStart(real, true)
  pressPush(s, FIRE_STIMULUS, 'first')
  trainAdvance(s, gapMs)
  const at = s.tMs
  pressPush(s, amp, 'second')
  trainAdvance(s, 12)
  let peak = -200
  for (const sample of s.samples) if (sample.t > at) peak = Math.max(peak, sample.v)
  return { fired: s.pushes[1].fired === true, peak }
}

describe('the live membrane', () => {
  it('starts at rest and stays there when nothing is done to it', () => {
    const s = trainStart(real, true)
    const rest = s.v
    trainAdvance(s, 20)
    // The resting frame solves for a true equilibrium, so this is not "close
    // enough to see" — it should not drift at all over a whole spike's worth of
    // time. A drifting baseline would make every band on the graph a lie.
    expect(Math.abs(s.v - rest)).toBeLessThan(0.2)
    expect(s.spikes).toBe(0)
  })

  it('fires on an ordinary push, and does not on a weak one', () => {
    const strong = trainStart(real, true)
    pressPush(strong, STIMULI.spike.amplitude, 'fire')
    trainAdvance(strong, 8)
    expect(strong.spikes).toBe(1)
    expect(strong.pushes[0].fired).toBe(true)

    const weak = trainStart(real, true)
    pressPush(weak, STIMULI.nudge.amplitude, 'weak')
    trainAdvance(weak, 8)
    expect(weak.spikes).toBe(0)
    expect(weak.pushes[0].fired).toBe(false)
  })

  it('refuses EVERY push inside the absolute refractory period', () => {
    // Nothing in spikeTrain.ts knows what a refractory period is. Sodium's h gate
    // is simply still shut, because it is the same gate that shut at the top of
    // the first spike. This is the test that would catch it being faked.
    const absolute = absoluteRefractoryMs(real, true)
    for (const amp of [STIMULI.spike.amplitude, STIMULI.hard.amplitude, 400, 1000]) {
      expect(pair(absolute * 0.6, amp).fired, `amp ${amp}`).toBe(false)
    }
  })

  it('lets a HARD push through where an ordinary one still fails', () => {
    // The reason there are three buttons rather than two: this window is the
    // relative refractory period, and it is invisible with only one amplitude.
    const gap = 6
    expect(pair(gap, STIMULI.spike.amplitude).fired).toBe(false)
    expect(pair(gap, STIMULI.hard.amplitude).fired).toBe(true)
  })

  it('gives a SMALLER spike for a push that lands early', () => {
    const early = pair(5, STIMULI.hard.amplitude)
    const rested = pair(20, STIMULI.hard.amplitude)
    expect(early.fired).toBe(true)
    expect(rested.fired).toBe(true)
    expect(early.peak).toBeLessThan(rested.peak - 10)
  })

  it('fires an ordinary push again once the relative period is over', () => {
    const relative = relativeRefractoryMs(real, true)
    expect(pair(relative + 3, STIMULI.spike.amplitude).fired).toBe(true)
  })

  it('advances by the same amount however the time is chopped up', () => {
    // The bench integrates on whatever frame times the browser hands it. If a
    // 60 Hz tab and a 144 Hz tab ran different physics, every number on the graph
    // would depend on the machine it was drawn on. `debtMs` is what prevents it.
    const whole = trainStart(real, true)
    pressPush(whole, FIRE_STIMULUS, 'x')
    trainAdvance(whole, 6)
    const chopped = trainStart(real, true)
    pressPush(chopped, FIRE_STIMULUS, 'x')
    for (let i = 0; i < 600; i++) trainAdvance(chopped, 0.01)
    expect(chopped.v).toBeCloseTo(whole.v, 3)
    expect(chopped.tMs).toBeCloseTo(whole.tMs, 6)
  })

  it('throws nothing away that is still on screen, and keeps nothing that is not', () => {
    const s = trainStart(real, true)
    pressPush(s, FIRE_STIMULUS, 'x')
    trainAdvance(s, TRAIN_WINDOW_MS * 2)
    expect(s.pushes).toHaveLength(0)
    expect(s.spikesAt).toHaveLength(0)
    // The running tally is NOT trimmed: a count that shrank as the graph scrolled
    // would be telling the child they had not done what they had just done.
    expect(s.presses).toBe(1)
    expect(s.spikes).toBe(1)
    const oldest = s.samples[0].t
    expect(oldest).toBeGreaterThan(s.tMs - TRAIN_WINDOW_MS - 1)
  })

  it('blames the right press, and only one of them', () => {
    const s = trainStart(real, true)
    pressPush(s, STIMULI.nudge.amplitude, 'weak')
    trainAdvance(s, 6)
    pressPush(s, FIRE_STIMULUS, 'fire')
    trainAdvance(s, 6)
    expect(s.pushes[0].fired).toBe(false)
    expect(s.pushes[1].fired).toBe(true)
    expect(s.spikes).toBe(1)
  })

  it('gives one pulse per press, however hard the button is drummed on', () => {
    // Not a detail. Letting a press restart a live pulse turns the weak button
    // into a current you can hold on for as long as you like, and a weak current
    // held on for long enough fires any cell — so the button labelled "not
    // enough" fired the membrane whenever a child drummed on it.
    const s = trainStart(real, true)
    expect(pressPush(s, STIMULI.nudge.amplitude, 'weak')).toBe(true)
    for (let i = 0; i < 10; i++) {
      expect(pressPush(s, STIMULI.nudge.amplitude, 'weak')).toBe(false)
      trainAdvance(s, 0.05)
    }
    trainAdvance(s, 10)
    expect(s.presses).toBe(1)
    expect(s.spikes).toBe(0)
  })

  it('DOES let separate weak pushes add up, because real membranes do', () => {
    // Temporal summation, and it is deliberately not suppressed. The membrane's
    // time constant is about 3 ms, so a push landing a millisecond after the last
    // one starts from where that one left off. It is the same effect the app
    // teaches in milestone 1 with two inputs firing together, and a bench that hid
    // it to keep "the weak one never works" true would be teaching a tidier cell
    // than the real one. The describer says so out loud.
    const s = trainStart(real, true)
    for (let i = 0; i < 8 && s.spikes === 0; i++) {
      pressPush(s, STIMULI.nudge.amplitude, 'weak')
      trainAdvance(s, 0.8)
    }
    expect(s.spikes).toBe(1)
    expect(s.presses).toBeGreaterThan(1)
  })
})

describe('what the bench says about itself', () => {
  const after = (gapMs: number, amp: number): TrainState => {
    const s = trainStart(real, true)
    pressPush(s, FIRE_STIMULUS, 'first')
    trainAdvance(s, gapMs)
    pressPush(s, amp, 'second')
    trainAdvance(s, 5)
    return s
  }
  const absolute = absoluteRefractoryMs(real, true)
  const relative = relativeRefractoryMs(real, true)

  it('names the absolute period when the press landed in it', () => {
    const s = after(absolute * 0.5, STIMULI.hard.amplitude)
    // Asked of the PRESS, not of now: by the time there is anything to say, the
    // membrane has recovered, and `recoveryNow` reports every refused push as
    // having landed on a rested membrane.
    const press = s.pushes[s.pushes.length - 1].atMs
    expect(recoveryAt(s, press, absolute, relative)).toBe('absolute')
    expect(recoveryNow(s, absolute, relative)).not.toBe('absolute')
    expect(trainNarration(s, absolute, relative)[0].text).toContain('cannot be fired at all')
  })

  it('points at the hard push when the press landed in the relative period', () => {
    const s = after((absolute + relative) / 2, STIMULI.spike.amplitude)
    expect(trainNarration(s, absolute, relative)[0].text).toContain('HARD')
  })

  it('blames the push, not the timing, when the membrane was rested', () => {
    const s = trainStart(real, true)
    pressPush(s, STIMULI.nudge.amplitude, 'weak')
    trainAdvance(s, 5)
    expect(sinceSpikeMs(s)).toBeNull()
    expect(trainNarration(s, absolute, relative)[0].text).toContain('not big enough')
  })

  it('counts presses and spikes separately, which is the whole point', () => {
    const s = after(1, STIMULI.spike.amplitude)
    expect(s.presses).toBe(2)
    expect(s.spikes).toBe(1)
    expect(trainNarration(s, absolute, relative).at(-1)!.text).toContain('2 presses')
  })
})

describe('the little cell in the spike-train bench', () => {
  it('burns through the whole spike, and not at all for a push that fails', () => {
    // The rule the bench draws with, restated here so it cannot drift: bright
    // measured from THIS membrane's own rest to its own peak, squared so the
    // bottom of the range stays dark.
    const spike = trajectory(real, true, STIMULI.spike.amplitude)
    const glow = (v: number) => {
      const t = Math.max(0, Math.min(1, (v - spike.rest) / Math.max(1, spike.peak - spike.rest)))
      return t * t
    }
    // A real spike lights the cell well before its overshoot — the first
    // version lit only above 0 mV, which is why the neuron looked inert.
    expect(glow(spike.peak)).toBeCloseTo(1, 6)
    expect(glow(0)).toBeGreaterThan(0.25)
    expect(glow(-20)).toBeGreaterThan(0.1)
    // A weak push barely leaves rest, and must light nothing: the inset does
    // not draw below 0.02.
    const nudge = trajectory(real, true, STIMULI.nudge.amplitude)
    expect(nudge.peak).toBeLessThan(0)
    expect(glow(nudge.peak)).toBeLessThan(0.02)
    // And resting is dark, always.
    expect(glow(spike.rest)).toBe(0)
  })
})

describe('what a press shows as its cause', () => {
  const pressed = (amplitude: number, afterMs: number) => {
    const state = trainStart(real, true)
    pressPush(state, amplitude, 'test')
    state.tMs += afterMs
    return stimFlash(state)
  }

  it('flashes the electrode the moment a button is pressed', () => {
    // A patch that lights with nothing having happened teaches that neurons
    // fire by themselves. What pushes this membrane is a current injected
    // into one spot, so the cause drawn is the electrode injecting it —
    // apparatus, not a synapse, because a synapse is not what the model
    // computes (user, 2026-08-28).
    expect(pressed(STIMULI.spike.amplitude, 0)).not.toBeNull()
    expect(pressed(STIMULI.nudge.amplitude, 0)).not.toBeNull()
  })

  it('flashes harder for a harder push', () => {
    const weak = pressed(STIMULI.nudge.amplitude, 0)!
    const strong = pressed(STIMULI.spike.amplitude, 0)!
    const hard = pressed(STIMULI.hard.amplitude, 0)!
    expect(weak.strength).toBeLessThan(strong.strength)
    expect(hard.strength).toBeGreaterThanOrEqual(strong.strength)
  })

  it('is an event, not a state the cell sits in', () => {
    expect(pressed(STIMULI.spike.amplitude, STIM_FLASH_MS * 1.1)).toBeNull()
    expect(stimFlash(trainStart(real, true))).toBeNull()
    // And it fades rather than switching off.
    const early = pressed(STIMULI.spike.amplitude, STIM_FLASH_MS * 0.1)!
    const late = pressed(STIMULI.spike.amplitude, STIM_FLASH_MS * 0.8)!
    expect(late.strength).toBeLessThan(early.strength)
  })
})

describe('naming the apparatus', () => {
  it('tells the reader the probe is an electrode and not part of the cell', () => {
    // The canvas carries names and readings, never sentences — so the one
    // thing a child cannot work out from a thin line touching a neuron has to
    // be said in the column.
    const words = trainNarration(trainStart(real, true), 3, 8)
      .map((p) => p.text)
      .join(' ')
    expect(words).toMatch(/ELECTRODE/)
    expect(words).toMatch(/not part of the neuron/)
    // And it says where a real push comes from, so the electrode is not
    // mistaken for how neurons normally work.
    expect(words).toMatch(/dendrites/)
  })
})
