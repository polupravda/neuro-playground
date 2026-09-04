import { describe, expect, it } from 'vitest'
import { sayAs, speakAloud } from './SpeakButton'

describe('what the voice is given to say', () => {
  it('hands an American voice an American spelling of -ise words', () => {
    // ⚠ The voice is `en-US` and this app is written in British English (user,
    // 2026-08-30: "voicing says [depolarEIsed] instead of [AI]"). Given
    // "depolarised" it mangles the vowel; given "depolarized" it says it
    // correctly. What the child HEARS is the point, so the sound wins over the
    // spelling — and nothing on screen changes.
    expect(sayAs('Depolarised')).toBe('depolarized')
    expect(sayAs('Hyperpolarised')).toBe('hyperpolarized')
    expect(sayAs('repolarisation')).toBe('repolarization')
  })

  it('leaves every other word exactly as written', () => {
    for (const word of ['Resting', 'extracellular', 'potassium', 'axon']) {
      expect(sayAs(word)).toBe(word)
    }
  })

  it('is case-insensitive, so a heading and a caption need one entry', () => {
    expect(sayAs('DEPOLARISED')).toBe(sayAs('depolarised'))
  })
})

describe('what actually reaches the synthesiser', () => {
  // ⚠ A TEST ON `sayAs` ALONE PASSES WITH THE BUG PUT BACK, because the fault
  // would be in `speakAloud` forgetting to call it. This is the third time
  // that trap has been walked into in this app, so this one goes through the
  // function the buttons actually call.
  const said: string[] = []

  class FakeUtterance {
    text: string
    lang = ''
    rate = 1
    voice: unknown = null
    constructor(text: string) {
      this.text = text
    }
  }

  const install = () => {
    said.length = 0
    const g = globalThis as Record<string, unknown>
    g.SpeechSynthesisUtterance = FakeUtterance
    g.speechSynthesis = {
      cancel: () => {},
      resume: () => {},
      getVoices: () => [{ lang: 'en-US' }],
      speak: (u: { text: string }) => said.push(u.text),
      addEventListener: () => {},
    }
  }

  it('speaks the American spelling, not the one on screen', () => {
    install()
    speakAloud('Depolarised')
    expect(said).toEqual(['depolarized'])
  })

  it('leaves everything else untouched', () => {
    install()
    speakAloud('extracellular')
    expect(said).toEqual(['extracellular'])
  })
})
