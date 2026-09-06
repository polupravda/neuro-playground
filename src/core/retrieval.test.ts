import { describe, expect, it } from 'vitest'
import {
  ADDED_PER_FUSION,
  BOUTON_NM,
  FUSIONS_TO_TENTH,
  RELEASED_PER_VESICLE,
  RETRIEVALS,
  VESICLE_NM,
  retrievalOf,
  retrievalStageAt,
  stageSpans,
} from './retrieval'

describe('S14 — retrieval, three ways', () => {
  it('A1 (21c-4c): three routes, and they differ in the way that matters', () => {
    // ⚠ (user, 2026-09-06, choosing "delete legs 1–2; the drawer starts at leg
    // 3".) The exhibit exists because retrieval is DEBATED and the big view has
    // to pick one. Three routes, each with its own real time — and the times
    // are the interesting part: they differ more than tenfold.
    expect(RETRIEVALS.map((r) => r.id)).toEqual(['kiss', 'clathrin', 'ultrafast'])
    const fastest = Math.min(...RETRIEVALS.map((r) => r.realS))
    const slowest = Math.max(...RETRIEVALS.map((r) => r.realS))
    expect(slowest / fastest, 'the routes take about the same time').toBeGreaterThan(10)
    // ⚠ AND ONE OF THEM NEVER COLLAPSES. That is the whole disagreement: if
    // every route flattened the bubble into the wall there would be nothing to
    // choose between them.
    expect(RETRIEVALS.filter((r) => !r.collapses).length).toBe(1)
    expect(retrievalOf('kiss').collapses).toBe(false)
  })

  it('A1 (21c-4c): every route is a button a child can press and read', () => {
    for (const r of RETRIEVALS) {
      // A picture for the child, a name for the adult — icons rank, they do not
      // name, and a button with no name is the same failure as a sentence in it.
      expect(r.icon.length).toBeGreaterThan(0)
      expect(r.label.length).toBeGreaterThan(0)
      expect(r.label).not.toMatch(/[.!]/)
      expect(r.what.length).toBeGreaterThan(60)
      expect(r.stages.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('A1 (21c-4c): each route’s stages tile its run, and say what to watch', () => {
    for (const r of RETRIEVALS) {
      const spans = stageSpans(r)
      expect(spans.length).toBe(r.stages.length)
      expect(spans[0].from).toBe(0)
      expect(spans[spans.length - 1].to).toBeCloseTo(1, 9)
      for (let i = 1; i < spans.length; i++) {
        expect(spans[i].from).toBeCloseTo(spans[i - 1].to, 9)
      }
      expect(retrievalStageAt(r, 0).stage.id).toBe(r.stages[0].id)
      expect(retrievalStageAt(r, 1).stage.id).toBe(r.stages[r.stages.length - 1].id)
      for (const s of r.stages) {
        expect(s.title.length).toBeGreaterThan(0)
        expect(s.title).not.toMatch(/[.!]/)
        expect(s.watch.length).toBeGreaterThan(20)
        expect(s.share).toBeGreaterThan(0)
      }
    }
  })

  it('A1 (21c-4): what the wall owes is MEASURED from the two sizes', () => {
    // ⚠ Not a number typed into a caption: a 40 nm vesicle's skin against a
    // 1 µm bouton's. It is the reason retrieval has to happen at all, and every
    // route gives back exactly this much.
    expect(VESICLE_NM).toBeLessThan(BOUTON_NM)
    expect(ADDED_PER_FUSION).toBeGreaterThan(0.001)
    expect(ADDED_PER_FUSION).toBeLessThan(0.01)
    expect(FUSIONS_TO_TENTH * ADDED_PER_FUSION).toBeGreaterThanOrEqual(0.1)
    expect((FUSIONS_TO_TENTH - 1) * ADDED_PER_FUSION).toBeLessThan(0.1)
    expect(RELEASED_PER_VESICLE).toBeGreaterThan(1000)
  })
})
