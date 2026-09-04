import { describe, expect, it } from 'vitest'
import { useSnareStore } from './snareStore'

describe('D06 store — the run belongs to the button (2026-09-02)', () => {
  it('opening the drawer does NOT start the animation', () => {
    // "Start animation on button click only": the drawer opens on the
    // labelled still, and only ▶ sets it moving.
    useSnareStore.getState().openBench()
    expect(useSnareStore.getState().open).toBe(true)
    expect(useSnareStore.getState().u).toBe(0)
    expect(useSnareStore.getState().playing).toBe(false)
    useSnareStore.getState().play()
    expect(useSnareStore.getState().playing).toBe(true)
    useSnareStore.getState().closeBench()
  })
})
