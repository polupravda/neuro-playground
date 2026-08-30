import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { speakAloud } from './SpeakButton'

// The voice was reported as "not working" (2026-08-28). Every way it can fail
// is SILENT — no error, no exception — so these pin the three browser quirks
// that swallow an utterance.

class FakeUtterance {
  lang = ''
  rate = 1
  voice: unknown = null
  constructor(public text: string) {}
}

function fakeSynth(voices: Array<{ lang: string }>) {
  const listeners: Record<string, Array<() => void>> = {}
  return {
    spoken: [] as string[],
    cancelled: 0,
    resumed: 0,
    voices,
    getVoices() {
      return this.voices
    },
    cancel() {
      this.cancelled++
    },
    resume() {
      this.resumed++
    },
    speak(u: FakeUtterance) {
      this.spoken.push(u.text)
    },
    addEventListener(name: string, fn: () => void) {
      ;(listeners[name] ??= []).push(fn)
    },
    fire(name: string) {
      for (const fn of listeners[name] ?? []) fn()
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  ;(globalThis as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance
})
afterEach(() => {
  vi.useRealTimers()
  delete (globalThis as Record<string, unknown>).speechSynthesis
  delete (globalThis as Record<string, unknown>).SpeechSynthesisUtterance
})

describe('speaking a term', () => {
  it('speaks when voices are ready', () => {
    const synth = fakeSynth([{ lang: 'en-GB' }])
    ;(globalThis as Record<string, unknown>).speechSynthesis = synth
    speakAloud('choline')
    vi.runAllTimers()
    expect(synth.spoken).toEqual(['choline'])
  })

  it('speaks inside the tap itself, and clears a stuck queue first', () => {
    // Synchronous on purpose: Safari wants speak() inside the gesture, and a
    // timer between the tap and the speaking is enough to lose it.
    const synth = fakeSynth([{ lang: 'en-US' }])
    ;(globalThis as Record<string, unknown>).speechSynthesis = synth
    speakAloud('glycerol')
    expect(synth.spoken).toEqual(['glycerol'])
    expect(synth.cancelled).toBe(1)
    expect(synth.resumed).toBe(1)
  })

  it('waits for voices when the browser has not loaded them yet', () => {
    const synth = fakeSynth([])
    ;(globalThis as Record<string, unknown>).speechSynthesis = synth
    speakAloud('vesicle')
    expect(synth.spoken).toEqual([])
    synth.voices = [{ lang: 'en-US' }]
    synth.fire('voiceschanged')
    vi.runAllTimers()
    expect(synth.spoken).toEqual(['vesicle'])
  })

  it('still speaks if voiceschanged never fires (Safari)', () => {
    const synth = fakeSynth([])
    ;(globalThis as Record<string, unknown>).speechSynthesis = synth
    speakAloud('bilayer')
    vi.runAllTimers()
    expect(synth.spoken).toEqual(['bilayer'])
  })

  it('says a term once, never twice, when both paths fire', () => {
    const synth = fakeSynth([])
    ;(globalThis as Record<string, unknown>).speechSynthesis = synth
    speakAloud('potassium')
    synth.fire('voiceschanged')
    vi.runAllTimers()
    expect(synth.spoken).toEqual(['potassium'])
  })

  it('is silent, not broken, where the browser has no speech at all', () => {
    delete (globalThis as Record<string, unknown>).speechSynthesis
    expect(() => speakAloud('oxygen')).not.toThrow()
  })
})
