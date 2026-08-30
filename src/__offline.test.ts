import { describe, expect, it } from 'vitest'

// RUNNING WITH NO INTERNET (2026-08-29).
//
// The app is meant to work on a laptop that is not online: a child at a
// kitchen table, a classroom with no wifi. Nothing here reaches the network at
// runtime — the photographs are bundled, Tailwind is compiled into the
// bundle, and there are no web fonts — so what offline actually needs is that
// nothing in the SOURCE quietly starts fetching something.
//
// These read the source through Vite rather than through node's fs, so the
// test needs no node typings and sees what the build sees.

const SOURCES = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const isTest = (path: string) => path.includes('.test.')

describe('it runs with no internet', () => {
  it('has source to check', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(30)
  })

  it('never fetches anything at runtime', () => {
    // A `fetch`, an XHR or a dynamically injected script would all be a
    // silent dependency on being online.
    const offenders: string[] = []
    for (const [path, src] of Object.entries(SOURCES)) {
      if (isTest(path)) continue
      for (const [what, re] of [
        ['fetch(', /\bfetch\s*\(/],
        ['XMLHttpRequest', /XMLHttpRequest/],
        ['importScripts', /importScripts/],
      ] as const) {
        if (re.test(src)) offenders.push(`${path}: ${what}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('loads no asset from another host', () => {
    // http(s) in the source is fine where it is a CREDIT — `realPhotos.ts`
    // links to where each photograph came from, which is a licence
    // requirement — but never where something is being LOADED.
    const offenders: string[] = []
    const loaders = /(?:src|href|url)\s*[:=(]\s*[`'"]https?:\/\//i
    for (const [path, src] of Object.entries(SOURCES)) {
      if (isTest(path)) continue
      if (loaders.test(src)) offenders.push(path)
    }
    expect(offenders).toEqual([])
  })

  it('keeps the photographs local, and reachable from anywhere', () => {
    // They come out of `public/real/`, addressed relative to index.html — so
    // the same build works on a web host, in a folder, and behind any local
    // server. An absolute path would tie it to one URL.
    const panel = SOURCES['./ui/RealPhotoPanel.tsx']
    expect(panel).toBeTruthy()
    expect(panel).toContain('BASE_URL')
    expect(panel).toContain('real/')
    expect(panel).not.toMatch(/https?:\/\/[^`'"]*\.jpg/)
  })
})
