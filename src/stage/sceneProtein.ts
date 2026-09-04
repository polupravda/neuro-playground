import type { ChannelType } from '../core/channels'
import { HALF_MEM as DRAW_HALF_MEM } from './bilayer'
import { drawLeakChannel } from './leakChannel'
import { drawVoltageChannel } from './voltageChannel'
import { drawLigandChannel, ligandSeat } from './ligandChannel'
import { DRAW_UNIT } from './proteins'

// HOW THE NEURON SCENE DRAWS ONE CHANNEL.
//
// ⚠ IT LIVES IN ITS OWN FILE BECAUSE THE SCALING IS THE WHOLE POINT, AND IT
// BROKE THE AXON MEMBRANE VIEW COMPLETELY (user, 2026-08-30: "no membrane, no
// channels. I only see yellow background").
//
// The traced proteins are authored in a space where one unit is about one
// screen pixel: line widths near 1, and a charge badge with a floor of 2.4 so
// it never disappears at bench size. The scene's world is nothing like that —
// the entire membrane is 0.022 units across. Handed a world-sized reach, those
// floors stop being floors and become the largest things on the canvas. It was
// measured at sixty membranes out, and one badge covered the view.
//
// So the protein is drawn at bench size inside a context scaled by `DRAW_UNIT`,
// exactly as a magnified frame would be. The traced modules need to know
// nothing about it, and every constant inside them keeps the proportion it was
// chosen for.
//
// It is exported, and the scene has no other way to draw a channel, so a test
// can reach the ACTUAL call site. A first attempt at that test called the
// traced drawing directly and passed with the bug put back — the fault was
// never in the drawing, it was in what the scene handed it.

export interface SceneChannel {
  channel: ChannelType
  open: boolean
  species: string
  speciesDark: string
  transmitter: boolean
  /** The colour a bound messenger is drawn in. */
  messenger?: string
}

export function drawSceneChannel(ctx: CanvasRenderingContext2D, c: SceneChannel): void {
  const openT = c.open ? 1 : 0
  ctx.save()
  ctx.scale(DRAW_UNIT, DRAW_UNIT)
  if (c.channel.gating === 'always') {
    drawLeakChannel(ctx, {
      cx: 0,
      midY: 0,
      halfHeight: DRAW_HALF_MEM,
      species: c.species,
      speciesDark: c.speciesDark,
    })
  } else if (c.channel.gating === 'voltage') {
    drawVoltageChannel(ctx, {
      cx: 0,
      midY: 0,
      halfHeight: DRAW_HALF_MEM,
      species: c.species,
      speciesDark: c.speciesDark,
      open: openT,
      // The sensor rides with the door: this scene has no separate
      // inactivation to time a ball against, so the ball hangs and never plugs.
      sensor: openT,
      plug: 0,
      seat: 0,
      // ⚠ Only the sodium channel has one. The delayed rectifier repolarises
      // the spike by STAYING open.
      ball: c.channel.id === 'voltage-na',
    })
  } else {
    drawLigandChannel(ctx, {
      cx: 0,
      midY: 0,
      halfHeight: DRAW_HALF_MEM,
      species: c.species,
      speciesDark: c.speciesDark,
      open: openT,
      socket: true,
    })
    if (c.transmitter) {
      // The messenger, in the socket the channel says its own site is — asked
      // of the drawing rather than worked out a second time here.
      const seat = ligandSeat(0, 0, openT, DRAW_HALF_MEM)
      ctx.fillStyle = c.messenger ?? '#fb923c'
      ctx.beginPath()
      ctx.arc(seat.x, seat.y, seat.r * 0.85, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}
