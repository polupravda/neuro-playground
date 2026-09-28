import { GLOSSY_COLORS, drawGlossyIon, glossySphere } from './particleStyle'
import { mix } from './bilayer'

// CALMODULIN AND CaMKII — the two proteins between the calcium and the change.
//
// ⚠ INVENTED, at the user's word (2026-09-11: "invent glyphs that reflect the
// app's level of detalisation"), and invented to the rule the rest of this app
// draws proteins by: a silhouette whose PARTS are the thing being taught. The
// traced channels show their subunits because "the subunits come apart" is how
// they open; the pump shows its two gates because it swings both ways. So these
// two show the parts that carry their own lesson, and nothing else.
//
//   · CALMODULIN is a DUMBBELL — two lobes on a flexible linker, each lobe
//     binding TWO calcium ions. The shape IS the four sites, and four sites is
//     exactly why the trigger is a fourth power rather than a line in the sand:
//     it is what turns a burst that is half as much calcium again into five
//     times the signal. A child counts the seats and has the reason.
//
//   · CaMKII is a HUB WITH SUBUNITS ON LEGS. The ring is why it is a SWITCH
//     rather than a dial: neighbours round the ring turn each other on, so once
//     enough of them are lit the rest follow and it stays lit after the calcium
//     has gone. Drawing it as one blob would have thrown that away.
//
// Both are drawn at the scale they are handed, in the app's own inks: calcium
// pink for what has caught calcium, slate for what has not.

const DARK = '#334155'
const COLD = '#64748b'

export interface Calmodulin {
  x: number
  y: number
  /** Half the dumbbell's length. */
  r: number
  /** How much calcium it is holding, 0…1 — the seats fill in order. */
  ca: number
}

/** How many calcium ions calmodulin binds. The number the trigger's steepness
 *  comes from, so the drawing and the model quote the SAME one. */
export const CAM_SEATS = 4

export function drawCalmodulin(ctx: CanvasRenderingContext2D, c: Calmodulin): void {
  const lobeR = c.r * 0.46
  const reach = c.r - lobeR
  const lit = Math.max(0, Math.min(1, c.ca))

  // the flexible linker, drawn first so the lobes sit on it
  ctx.save()
  ctx.strokeStyle = mix(COLD, GLOSSY_COLORS.ca.mid, lit)
  ctx.lineWidth = Math.max(1.2, c.r * 0.12)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(c.x - reach, c.y)
  ctx.lineTo(c.x + reach, c.y)
  ctx.stroke()
  ctx.restore()

  for (const side of [-1, 1]) {
    const lx = c.x + side * reach
    glossySphere(ctx, lx, c.y, lobeR, mix(DARK, GLOSSY_COLORS.ca.dark, lit))
    // ⚠ TWO SEATS PER LOBE, and they fill IN ORDER, so the count is readable at
    // any moment rather than only when full.
    for (const [k, up] of [[0, -1], [1, 1]] as const) {
      const index = (side < 0 ? 0 : 2) + k
      const held = Math.max(0, Math.min(1, lit * CAM_SEATS - index))
      const sx = lx + side * lobeR * 0.34
      const sy = c.y + up * lobeR * 0.42
      ctx.save()
      ctx.strokeStyle = COLD
      ctx.lineWidth = Math.max(0.8, c.r * 0.05)
      ctx.beginPath()
      ctx.arc(sx, sy, lobeR * 0.3, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      if (held > 0.02) drawGlossyIon(ctx, 'ca', sx, sy, lobeR * 0.26, held)
    }
  }
}

export interface CaMKII {
  x: number
  y: number
  /** Radius out to the tips of the subunits. */
  r: number
  /** How switched on it is, 0…1 — the subunits light round the ring. */
  lit: number
}

/** How many subunits are drawn. A real holoenzyme is twelve, in two stacked
 *  rings of six; ONE ring of six is drawn, which is what a section through it
 *  would show — declared in the info block. */
export const CAMK_SUBUNITS = 6

export function drawCaMKII(ctx: CanvasRenderingContext2D, c: CaMKII): void {
  const lit = Math.max(0, Math.min(1, c.lit))
  const hub = c.r * 0.34
  const knob = c.r * 0.26
  const reach = c.r - knob

  for (let i = 0; i < CAMK_SUBUNITS; i++) {
    const a = (i / CAMK_SUBUNITS) * Math.PI * 2 - Math.PI / 2
    const kx = c.x + Math.cos(a) * reach
    const ky = c.y + Math.sin(a) * reach
    // ⚠ THEY LIGHT ROUND THE RING, one after another — which is the switch
    // itself: each subunit turns its neighbour on, so the thing goes from off
    // to wholly on rather than gradually brightening all over.
    const on = Math.max(0, Math.min(1, lit * CAMK_SUBUNITS - i))
    ctx.save()
    ctx.strokeStyle = mix(COLD, GLOSSY_COLORS.ca.mid, on)
    ctx.lineWidth = Math.max(1.2, c.r * 0.11)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(c.x + Math.cos(a) * hub * 0.8, c.y + Math.sin(a) * hub * 0.8)
    ctx.lineTo(kx, ky)
    ctx.stroke()
    ctx.restore()
    glossySphere(ctx, kx, ky, knob, mix(DARK, GLOSSY_COLORS.ca.dark, on))
  }
  glossySphere(ctx, c.x, c.y, hub, mix(DARK, GLOSSY_COLORS.ca.dark, lit * 0.6))
}
