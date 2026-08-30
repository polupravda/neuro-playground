import { describe, expect, it } from 'vitest'

// A HOOK BELOW AN EARLY RETURN IS A WHITE PAGE (2026-08-28).
//
// `InfoPanel` grew two `useMemo` calls below `if (target?.presents === 'axon')
// return <AxonInfoPanel />`. Arriving at the axon skipped them, React saw
// fewer hooks than the render before, and the whole tree came down — a blank
// page, on that one view. Neither the typechecker nor the build says a word
// about it, and there is no linter in this project, so it gets a test.
//
// Deliberately crude: it reads the source and looks for a `use…(` after a
// top-level `return` inside a component. A real ESLint pass would be better;
// this costs nothing and catches the shape that actually bit.

const HOOK = /^\s{2}(?:const|let)?\s*.*\buse[A-Z]\w*\(/
const EARLY_RETURN = /^\s{2}if \(.*\breturn\b/
const COMPONENT = /^export function [A-Z]/

function offenders(source: string): string[] {
  const lines = source.split('\n')
  const bad: string[] = []
  let inComponent = false
  let returned: string | null = null
  for (const [i, line] of lines.entries()) {
    if (COMPONENT.test(line)) {
      inComponent = true
      returned = null
      continue
    }
    if (!inComponent) continue
    if (line === '}') {
      inComponent = false
      continue
    }
    if (EARLY_RETURN.test(line)) returned = line.trim()
    else if (returned && HOOK.test(line) && !line.trim().startsWith('//')) {
      bad.push(`line ${i + 1}: ${line.trim()}  (after: ${returned})`)
    }
  }
  return bad
}

// Read through Vite rather than through node's fs, so the test needs no
// node typings and runs the same way the app is built.
const SOURCES = import.meta.glob('./*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('hooks run on every render or none', () => {
  it('has components to check', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(5)
  })

  it('never calls a hook below an early return', () => {
    const found: string[] = []
    for (const [file, source] of Object.entries(SOURCES)) {
      for (const hit of offenders(source)) found.push(`${file} ${hit}`)
    }
    expect(found).toEqual([])
  })

  it('would have caught the bug it was written for', () => {
    // Break it on purpose, right here, and check the check fails.
    const broken = [
      'export function Thing() {',
      '  const a = useThing((s) => s.a)',
      '  if (!a) return null',
      '  const b = useOther((s) => s.b)',
      '  return b',
      '}',
    ].join('\n')
    expect(offenders(broken)).toHaveLength(1)
  })
})
