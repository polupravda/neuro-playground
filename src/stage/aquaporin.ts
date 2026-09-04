import { CHANNEL_DARK, CHANNEL_MID, HALF_MEM, mix } from './bilayer'

// THE AQUAPORIN — a water channel, and NOT one of the four doors.
//
// ⚠ It was being drawn with the generic ion-channel silhouette, which said it
// was one of them (user, 2026-08-30, who asked for it to have its own shape).
// It is not. It has no gate, it passes no ions at all, and the single feature
// that makes it work is the one the generic drawing does not have: a WAIST.
//
// What the shape has to carry, and why each part is here:
//
//   • AN HOURGLASS, not a tube. Wide vestibules at both mouths funnelling down
//     to a constriction about 2.8 Å across — narrower than a hydrated ion and
//     barely wider than one water molecule. That pinch IS the selectivity: it
//     is why water goes through in single file and why sodium, which is
//     smaller than a water molecule but travels in a coat of them, cannot.
//     Drawing it parallel-sided would delete the mechanism.
//   • NO GATE, NO SENSOR, NO BINDING SITE, and nothing that moves. An
//     aquaporin is open all the time. There is no `open` parameter here on
//     purpose: an option that can only take one value is an invitation to
//     animate something that does not animate.
//   • THE TWO HALF-HELICES that meet at the waist, drawn as the pair of nubs
//     reaching in from either side. They carry the NPA motifs, and the reason
//     they are worth two marks on a small drawing is that they are what stops
//     PROTONS — a proton can hop along a chain of water molecules, and this is
//     the thing that breaks the chain.
//
// Drawn as two mirrored halves, because that is how the pore is made: the
// waist is the gap between them, not a hole cut in one piece.

export interface Aquaporin {
  cx: number
  midY: number
  /** How far it reaches either side of the membrane's middle. */
  halfHeight?: number
  /** Water's colour — the app's rule is that a channel is tinted with what
   *  goes through it, and what goes through this one is water. */
  species: string
  speciesDark: string
}

/** Half its width, as a fraction of how tall it is. Squatter than an ion
 *  channel, which is also true of the real protein. */
const WIDTH_RATIO = 0.92
/** The waist, as a fraction of the half-width. Small on purpose: this is the
 *  whole point of the protein, and a timid pinch says "slightly narrower
 *  here" instead of "only one molecule at a time". */
const WAIST = 0.15
/** How far the mouths flare, as a fraction of the half-width. */
const MOUTH = 0.62

export function aquaporinHalfWidth(halfHeight = HALF_MEM): number {
  return halfHeight * 1.12 * WIDTH_RATIO
}

export function drawAquaporin(ctx: CanvasRenderingContext2D, c: Aquaporin): void {
  const reach = (c.halfHeight ?? HALF_MEM) * 1.12
  const w = aquaporinHalfWidth(c.halfHeight ?? HALF_MEM)
  const waist = w * WAIST
  const mouth = w * MOUTH

  const mid = mix(CHANNEL_MID, c.species, 0.55)
  const dark = mix(CHANNEL_DARK, c.speciesDark, 0.45)

  for (const side of [-1, 1] as const) {
    ctx.beginPath()
    // Down the outside, which is a plain rounded flank.
    ctx.moveTo(c.cx + side * w, c.midY - reach)
    ctx.bezierCurveTo(
      c.cx + side * w * 1.08,
      c.midY - reach * 0.3,
      c.cx + side * w * 1.08,
      c.midY + reach * 0.3,
      c.cx + side * w,
      c.midY + reach,
    )
    // Back up the INSIDE, and this edge is the protein: it funnels from a wide
    // mouth to the waist and out again.
    ctx.lineTo(c.cx + side * mouth, c.midY + reach)
    ctx.bezierCurveTo(
      c.cx + side * mouth * 0.72,
      c.midY + reach * 0.42,
      c.cx + side * waist,
      c.midY + reach * 0.3,
      c.cx + side * waist,
      c.midY,
    )
    ctx.bezierCurveTo(
      c.cx + side * waist,
      c.midY - reach * 0.3,
      c.cx + side * mouth * 0.72,
      c.midY - reach * 0.42,
      c.cx + side * mouth,
      c.midY - reach,
    )
    ctx.closePath()

    const g = ctx.createLinearGradient(c.cx - w, 0, c.cx + w, 0)
    g.addColorStop(0, dark)
    g.addColorStop(0.5, mid)
    g.addColorStop(1, dark)
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = c.species
    ctx.lineWidth = 1.1
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  // The two half-helices meeting at the waist — the pair that carries the NPA
  // motifs and breaks the water chain a proton would otherwise hop along. One
  // reaches in from below on the left, one from above on the right, which is
  // how they actually meet.
  ctx.fillStyle = mix(dark, '#000000', 0.25)
  for (const side of [-1, 1] as const) {
    const from = side * reach * 0.16
    ctx.beginPath()
    ctx.moveTo(c.cx + side * mouth * 0.9, c.midY + from * 1.7)
    ctx.lineTo(c.cx + side * waist * 1.15, c.midY + from * 0.15)
    ctx.lineTo(c.cx + side * mouth * 0.9, c.midY - from * 0.35)
    ctx.closePath()
    ctx.fill()
  }
}
