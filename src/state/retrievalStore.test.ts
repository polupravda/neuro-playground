import { describe, expect, it } from 'vitest'
import { useRetrievalStore } from './retrievalStore'
import { RETRIEVALS } from '../core/retrieval'

describe('S14 store — run, pause, resume (21c-11)', () => {
  it('A2: the pressed button’s three states are the store’s three transitions', () => {
    // ⚠ (user: "allow to pause animation. Turn pressed button into 'pause'
    // mode".) `start` restarts AND plays; `pause` freezes without touching the
    // restart counter — a pause that also rewound would make the button a stop
    // — and `resume` plays on, again without a restart.
    const st = () => useRetrievalStore.getState()
    st().openBench()
    expect(RETRIEVALS.every((r) => !st().playing[r.id])).toBe(true)
    const n0 = st().nonce.kiss
    st().start('kiss')
    expect(st().playing.kiss).toBe(true)
    expect(st().nonce.kiss).toBe(n0 + 1)
    st().pause('kiss')
    expect(st().playing.kiss).toBe(false)
    expect(st().nonce.kiss, 'pause rewound the run').toBe(n0 + 1)
    st().resume('kiss')
    expect(st().playing.kiss).toBe(true)
    expect(st().nonce.kiss, 'resume restarted the run').toBe(n0 + 1)
    // A finished run reports itself, so the button reads "run", not "pause",
    // over a still last frame.
    st().finished('kiss')
    expect(st().playing.kiss).toBe(false)
    // ⚠ ONE PRESS, ALL THREE, ON ONE COUNTER TICK — the comparison is the
    // exhibit — and one press freezes all three together.
    const before = { ...st().nonce }
    st().startAll()
    for (const r of RETRIEVALS) {
      expect(st().playing[r.id]).toBe(true)
      expect(st().nonce[r.id]).toBe(before[r.id] + 1)
    }
    st().pauseAll()
    expect(RETRIEVALS.every((r) => !st().playing[r.id])).toBe(true)
    st().resumeAll()
    expect(RETRIEVALS.every((r) => st().playing[r.id])).toBe(true)
    // Opening the drawer arrives on a still, playing nothing.
    st().openBench()
    expect(RETRIEVALS.every((r) => !st().playing[r.id])).toBe(true)
  })
})
