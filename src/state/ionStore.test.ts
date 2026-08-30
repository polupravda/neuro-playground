import { describe, expect, it } from 'vitest'
import { ION_KINDS, type IonKind } from '../core/ions'
import { inColour } from './ionStore'

const focus = (...kinds: IonKind[]): Record<IonKind, boolean> =>
  ION_KINDS.reduce(
    (acc, kind) => {
      acc[kind] = kinds.includes(kind)
      return acc
    },
    {} as Record<IonKind, boolean>,
  )

const none = focus()

describe('what is drawn in colour', () => {
  it('shows everything when nothing is focused and nothing is happening', () => {
    for (const kind of ION_KINDS) expect(inColour(none, kind)).toBe(true)
  })

  it('dims everything but the focused species', () => {
    const only = focus('cl')
    expect(inColour(only, 'cl')).toBe(true)
    expect(inColour(only, 'na')).toBe(false)
  })

  it('allows several species in focus at once', () => {
    const two = focus('na', 'k')
    expect(inColour(two, 'na')).toBe(true)
    expect(inColour(two, 'k')).toBe(true)
    expect(inColour(two, 'cl')).toBe(false)
  })

  it('brings sodium and potassium forward during a spike', () => {
    expect(inColour(none, 'na', true)).toBe(true)
    expect(inColour(none, 'k', true)).toBe(true)
    expect(inColour(none, 'cl', true)).toBe(false)
    expect(inColour(none, 'ca', true)).toBe(false)
  })

  it('never overrides a choice the kid made', () => {
    // Someone studying chloride does not lose it because a spike started, and
    // there is nothing to restore when the spike ends.
    const studyingChloride = focus('cl')
    expect(inColour(studyingChloride, 'cl', true)).toBe(true)
    expect(inColour(studyingChloride, 'na', true)).toBe(false)
    expect(inColour(studyingChloride, 'cl', false)).toBe(true)
  })
})
