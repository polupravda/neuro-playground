import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { spoken, drawSpoken } from './spokenLabels'

describe('a spoken name is a name, not a button', () => {
  it('draws its plate with NO outline round it', () => {
    // ⚠ The plate exists for legibility — these sit on lipid heads and bright
    // proteins, and a name that disappears into its background is a name
    // nobody can tap. A RIM round it made the word look like a button, which
    // it is not: the speaker beside it is the control (user, 2026-08-30:
    // "on voicing labels, remove outline on the container"). It also put a
    // ruled rectangle on drawings this app takes trouble to keep unruled.
    //
    // Counted rather than forbidden, because the speaker glyph legitimately
    // strokes its two sound waves. An outlined plate is a THIRD stroke.
    const c = strictCanvas()
    drawSpoken(c.ctx, spoken('axon', 40, 40))
    expect(c.calls.filter((k) => k === 'stroke').length).toBe(2)
    // The plate itself is still there.
    expect(c.calls).toContain('roundRect')
    expect(c.calls.filter((k) => k === 'fill').length).toBeGreaterThanOrEqual(2)
  })

  it('still writes the word and draws its speaker', () => {
    const c = strictCanvas()
    drawSpoken(c.ctx, spoken('dendrite', 40, 40))
    expect(c.texts).toContain('dendrite')
    expect(c.calls.filter((k) => k === 'arc').length).toBe(2)
  })
})
