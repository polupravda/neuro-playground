import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { drawSceneChannel } from './sceneProtein'
import { CHANNELS, type ChannelId } from '../core/channels'
import { MEMBRANE_PX } from './layout'
import { membraneProteins } from './proteins'

// ⚠ THIS IS THE TEST THAT WAS MISSING WHEN THE AXON MEMBRANE VIEW BROKE
// (user, 2026-08-30: "no membrane, no channels. I only see yellow background").
//
// The traced proteins are authored in a space where one unit is about one
// screen pixel. The scene's world is nothing like that — its whole membrane is
// 0.022 units across — so a pixel-sized floor handed a world-sized reach became
// the biggest thing on the canvas.
//
// TWO EARLIER ATTEMPTS AT THIS TEST WERE WORSE THAN NONE:
//   • one called the traced drawing directly and PASSED with the bug put back,
//     because the fault was never in the drawing — it was in what the scene
//     handed it;
//   • one bounded ALL the scene's ink, which fails honestly: at a membrane
//     camera a full-bleed path really does map hundreds of thousands of pixels
//     out, and that is not a bug.
//
// The measurement that means something is this one: the ink of ONE channel,
// drawn by the function the scene actually calls, against the membrane it has
// to sit in.

const IDS = Object.keys(CHANNELS) as ChannelId[]

const reachOf = (id: ChannelId, open: boolean) => {
  const c = strictCanvas()
  drawSceneChannel(c.ctx, {
    channel: CHANNELS[id],
    open,
    species: '#facc15',
    speciesDark: '#a16207',
    transmitter: true,
  })
  // strictCanvas records path points through the CURRENT TRANSFORM, so this is
  // where the ink lands in the scene's world.
  return Math.max(...c.points.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))))
}

describe('a channel drawn into the scene stays the size of a channel', () => {
  it('keeps every channel inside a couple of membranes', () => {
    for (const id of IDS) {
      for (const open of [false, true]) {
        const reach = reachOf(id, open)
        expect(Number.isFinite(reach)).toBe(true)
        expect(reach).toBeLessThan(MEMBRANE_PX * 2)
      }
    }
  })

  it('and is actually THERE — not scaled away to nothing', () => {
    // The other half of the same mistake: a drawing shrunk until it is a dot
    // fails just as silently as one blown up until it is a wash.
    for (const id of IDS) {
      expect(reachOf(id, false)).toBeGreaterThan(MEMBRANE_PX * 0.3)
    }
  })

  it('reaches further out of the wall than the wall is thick', () => {
    // A protein flush with the membrane reads as a hole in it.
    for (const id of IDS) {
      expect(reachOf(id, false)).toBeGreaterThan(MEMBRANE_PX * 0.5)
    }
  })

  it('agrees with the gap the wall was cut for it', () => {
    // The gap and the drawing have to be one number, or there is a hole or an
    // overlap beside every protein.
    for (const p of membraneProteins()) {
      if (!p.channel) continue
      const reach = reachOf(p.channel.id, false)
      expect(p.half).toBeLessThan(reach * 1.2)
      expect(p.half).toBeGreaterThan(reach * 0.3)
    }
  })
})
