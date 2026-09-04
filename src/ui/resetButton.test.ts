import { describe, expect, it } from 'vitest'
import { RESET_LABEL, RESET_W, RESET_H } from '../stage/resetChip'

// ⚠ THE APP HAD FIVE RESETS (user, 2026-08-30: "adjust 'reset' button across
// the app. Source of truth: 'membrane permeability' view").
//
// An amber chip on one canvas, two grey text links reading "↺ start again", a
// big amber pill saying "↺ Back to rest", a tiny "↺ real" — each invented where
// it was needed. A control that does the same thing in every exhibit has to
// look and read the same in every exhibit, or the child learns each one
// separately.
//
// This guard is structural on purpose: the failure is not a wrong value, it is
// somebody writing a SIXTH one. Nothing outside `resetChip.ts` may spell the
// glyph itself.

/** Every source file in the two folders, read as text. Vite's own glob rather
 *  than the filesystem, so the test needs no node typings and runs wherever
 *  the app builds. */
const SOURCES = import.meta.glob('../{ui,stage}/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('one reset for the whole app', () => {
  it('is spelled in exactly one place', () => {
    const offenders: string[] = []
    expect(Object.keys(SOURCES).length).toBeGreaterThan(20)
    for (const [path, src] of Object.entries(SOURCES)) {
      if (path.endsWith('resetChip.ts') || path.includes('.test.')) continue
      for (const [i, line] of src.split('\n').entries()) {
        // Prose about the control is fine; a control drawn or written here is
        // not. Comment lines are where the history of it is recorded.
        const code = line.trim()
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) continue
        if (code.includes('↺')) offenders.push(`${path}:${i + 1}  ${code}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps the permeability bench as the source of truth', () => {
    expect(RESET_W).toBe(92)
    expect(RESET_H).toBe(28)
    expect(RESET_LABEL).toBe('↺ Reset')
  })
})
