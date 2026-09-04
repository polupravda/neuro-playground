import { boundsOf, parsePath, tracePath, type Seg } from './svgPath'
import { drawChargeDot } from './particleStyle'
import { CHANNEL_DARK, CHANNEL_MID, HALF_MEM, mix } from './bilayer'

// THE VOLTAGE-GATED CHANNEL, traced from the user's drawing (2026-08-29),
// which gives it in three states: CLOSED, OPEN and INACTIVE.
//
// ── What moves, and why it must not teleport ──────────────────────────────
//
// The drawing shows the two moving parts twice each, in their end positions.
// Drawn that way, an animation would jump: one path swapped for another is a
// cut, not a movement, and a child watching a cut learns that the door changes
// rather than that something moves it. So both parts are ONE piece that
// travels:
//
//   • THE GATE FLAP is a single traced shape that ROTATES about its hinge.
//     Measured off the drawing, the closed flap points along 168° from the
//     hinge and the open one along 102°, so it is the same flap through 66°.
//     Rotating it reaches both drawn positions and every position between.
//   • THE BALL travels along an arc from where it hangs to where it sits, and
//     the CHAIN is redrawn to follow it — so the chain is always attached at
//     both ends, which a swapped pair of paths cannot promise.
//
// ⚠ AND THE BALL IS AN INACTIVATION BALL, not a voltage sensor.
//
// Two rounds earlier this app read a ball-on-a-stalk in a different figure as
// the S4 SENSOR and animated it being pushed by the field. That was wrong for
// THIS drawing and the drawing settles it: in the third state the ball has
// moved INTO THE PORE. A sensor does not plug the channel it senses for; an
// inactivation ball does, and that is what makes the third state a third state
// rather than a repeat of the first.
//
// A real voltage-gated sodium channel has BOTH — an S4 that feels the field
// and swings the gate, and a tethered ball that plugs the open pore a moment
// later. This drawing shows the gate and the ball and not the sensor, so
// neither does this: the cause is drawn instead as the charge itself flipping
// across the wall, which is what S4 would be responding to. Declared in the
// honesty note rather than invented into the picture.

/** The three subunits, back one first so the two in front paint over it. */
export const BODY_PATHS = [
  // The back subunit, seen between the two in front.
  'm13.5-12.64c8.67-0.3 12.22 0.49 13.67 1.17-3.47 1.25-5.96 4.57-5.96 8.48l-0.18 42.5 2.84 1.73c1.63 1.46 2.15 2.49 2.19 4.49 0.03 1.43-1.3 3.83-0.58 4.88-4.38-1.49-9.94-1.36-11.95-1.66-1.78 0.26-6.47 0.2-10.6 1.19 0.22-1.18-0.78-3.16-0.76-4.41 0.04-2 0.56-3.03 2.19-4.49l2.84-1.73-0.18-42.5c0-4.19-2.86-7.71-6.72-8.72 1.81-0.61 5.53-1.19 13.2-0.93z',
  // Front left.
  'm-1.99-12c4.97 0 9.01 4.03 9.01 9.01l0.18 42.5-2.84 1.73c-1.63 1.46-2.15 2.49-2.19 4.49-0.03 1.6 1.63 4.4 0.23 5.18-1.3 0.73-2.79 1.15-4.39 1.15-4.98 0-9.01-4.04-9.01-9.01v-46.04c0-4.98 4.03-9.01 9.01-9.01z',
  // Front right.
  'm30.22-12c-4.97 0-9.01 4.03-9.01 9.01l-0.18 42.5 2.84 1.73c1.63 1.46 2.15 2.49 2.19 4.49 0.03 1.6-1.63 4.4-0.23 5.18 1.3 0.73 2.8 1.15 4.39 1.15 4.98 0 9.01-4.04 9.01-9.01v-46.04c0-4.98-4.03-9.01-9.01-9.01z',
]

/** The gate flap, traced in its CLOSED position. It is rotated from here. */
export const GATE_PATH =
  'm34.55 62.11c-3.11 2.75-8.83 4.41-14.33 2.31-7.21-2.74-10.96-8.43-13.36-11.94-1.84-2.69-2.29-5.53-0.56-6.94 1.73-1.42 4.25-1.4 6.46 1.52 2.21 2.91 4.23 7.05 7.15 8.82 2.91 1.78 6.89 3.65 8.73 1.7 1.12-1.19 1.1-3.07 0.69-4.57q0.44 0.05 0.89 0.05c4.58 0 8.35-3.41 8.93-7.83-0.04 3.2-0.16 7.57-0.47 8.81-0.52 2.02-0.94 5.26-4.13 8.07z'

/** Where the flap is hinged — the corner both drawn positions share. */
const HINGE = { x: 38, y: 45 }
/** How far it swings, radians. Measured off the drawing: the closed flap lies
 *  along 168° from the hinge and the open one along 102°. */
export const GATE_SWING = ((102 - 168) * Math.PI) / 180

/** Where the ball hangs, where it seats, and where its chain is anchored —
 *  all read off the drawing rather than chosen. */
const BALL_HANGING = { x: -6, y: 78.1 }
const BALL_SEATED = { x: 14, y: 47.1 }
const BALL_R = 7
const CHAIN_AT = { x: -2.67, y: 51.84 }
/** The ball swings OUT AND ROUND rather than cutting through the protein: a
 *  straight line from where it hangs to where it seats would pass through the
 *  channel's own foot. Pinned by a test, because "it looks fine" is not a
 *  reason and the straight line is the tempting one. */
const BALL_VIA = { x: 10, y: 76 }

const BODY: Seg[][] = BODY_PATHS.map(parsePath)
const GATE: Seg[] = parsePath(GATE_PATH)
/** The box the PROTEIN occupies — the ball and the flap hang below it and must
 *  not be counted, or the channel would be fitted small to make room for its
 *  own dangling parts. */
const BOX = boundsOf(BODY.flat())

export interface VoltageChannel {
  cx: number
  midY: number
  halfHeight?: number
  species: string
  speciesDark: string
  /** 0 = flap across the pore, 1 = swung clear. The membrane's own charge
   *  flipping is what drives this. */
  open: number
  /** 0 = ball hanging, 1 = ball seated in the mouth — INACTIVATION, the third
   *  state, and the reason the door stops conducting while the cause is still
   *  being applied. */
  plug: number
  /** 0 = the voltage sensor is down, 1 = shoved fully outward.
   *
   *  ⚠ NOT IN THE TRACED DRAWING, and added on purpose (2026-08-30). The
   *  source gives the pore, the flap and the ball, which is everything the
   *  channel does and nothing about WHY — and a child watching it asked
   *  exactly the question the picture could not answer. The S4 helix is a real
   *  part of a real Nav channel, it really does carry a row of positive
   *  charges, and it really is what the membrane's field pushes on. Leaving it
   *  out was not neutrality: it left the flap swinging for no visible reason,
   *  which invites the wrong answer (that the charge pulls the ball). */
  sensor?: number
  /** A clock, ms, for the ball's restlessness. See `drawVoltageChannel`.
   *
   *  ⚠ THE BALL IS ALWAYS TRYING (user, 2026-08-30, twice: "what makes ball
   *  swing?"). Nothing pulls it — it is three greasy amino acids on a tether,
   *  jostled by everything around it, and it can only stick once the gate
   *  opens and uncovers a pocket shaped to hold it. Drawn still, its sudden
   *  move looked caused, and the only cause on the panel is the charge, so the
   *  charge is what a child concluded. Drawn JOSTLING from the very start, and
   *  going still the moment it seats, the picture answers the question by
   *  itself: it was bumping around the whole time and there was nowhere to
   *  hold on.
   *
   *  Omit it and the ball is drawn at rest — a still frame stays still. */
  restlessMs?: number
  /** Whether this channel HAS a ball-and-chain at all. Default true.
   *
   *  ⚠ NOT EVERY VOLTAGE-GATED CHANNEL INACTIVATES (2026-08-30). The axon's
   *  delayed-rectifier K⁺ channel does not — staying open is exactly how it
   *  repolarises the spike — and the patch clamp's own model is a two-state
   *  open/closed channel with no inactivation in it at all. Drawing a ball on
   *  those would put a mechanism on the screen that the record underneath is
   *  visibly not doing. The silhouette is shared; the ball is not. */
  ball?: boolean
  /** 0 = the ball has nowhere to land, 1 = its seat inside the mouth is
   *  available. Drawn, because "the seat only exists once the door is open" is
   *  the answer to why the ball waits, and an answer nobody can see is not an
   *  answer. */
  seat?: number
}

/** How wide the traced protein is at the height it is drawn at, so a caller
 *  can cut a gap in the bilayer that actually fits it. */
export function voltageHalfWidth(halfHeight = HALF_MEM): number {
  return (BOX.w * fitScale(halfHeight)) / 2
}

const fitScale = (halfHeight: number) => (2 * halfHeight * 1.12) / BOX.h

/** Where the ball is at a moment, in the drawing's own coordinates. A
 *  quadratic through `BALL_VIA`, so it swings out and up rather than sliding
 *  through the protein it is supposed to be going round. */
export function ballPathAt(plug: number): { x: number; y: number } {
  const t = Math.max(0, Math.min(1, plug))
  const u = 1 - t
  return {
    x: u * u * BALL_HANGING.x + 2 * u * t * BALL_VIA.x + t * t * BALL_SEATED.x,
    y: u * u * BALL_HANGING.y + 2 * u * t * BALL_VIA.y + t * t * BALL_SEATED.y,
  }
}

export function drawVoltageChannel(ctx: CanvasRenderingContext2D, c: VoltageChannel): void {
  const reach = c.halfHeight ?? HALF_MEM
  const k = fitScale(reach)
  const map = (x: number, y: number) => ({
    x: c.cx + (x - (BOX.x + BOX.w / 2)) * k,
    y: c.midY + (y - (BOX.y + BOX.h / 2)) * k,
  })

  const mid = mix(CHANNEL_MID, c.species, 0.55)
  const dark = mix(CHANNEL_DARK, c.speciesDark, 0.45)
  const paint = (back: boolean) => {
    const g = ctx.createLinearGradient(c.cx - BOX.w * k * 0.5, 0, c.cx + BOX.w * k * 0.5, 0)
    g.addColorStop(0, back ? mix(dark, '#000000', 0.35) : dark)
    g.addColorStop(0.42, back ? mix(mid, '#000000', 0.4) : mid)
    g.addColorStop(1, back ? mix(dark, '#000000', 0.35) : dark)
    return g
  }

  for (const [i, segs] of BODY.entries()) {
    const back = i === 0
    ctx.beginPath()
    tracePath(ctx, segs, map)
    ctx.fillStyle = paint(back)
    ctx.fill()
    ctx.strokeStyle = back ? mix(dark, '#000000', 0.2) : c.species
    ctx.lineWidth = back ? 0.8 : 1.1
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  // THE FLAP, rotated about its hinge — one piece travelling, never two paths
  // swapped.
  //
  // ⚠ DRAWN OVER THE BODY, NOT UNDER IT (user, 2026-08-30). It used to go down
  // first, so the protein's dark middle was painted across the end of it: shut,
  // the flap appeared to stop halfway and vanish into the shadow, which is the
  // worst possible thing to hide on this panel — the flap IS the door. Behind
  // the body was the anatomically tidier choice and the less legible one, and
  // the panel exists to be read.
  {
    const swing = GATE_SWING * Math.max(0, Math.min(1, c.open))
    const h = map(HINGE.x, HINGE.y)
    const cos = Math.cos(swing)
    const sin = Math.sin(swing)
    const spin = (x: number, y: number) => {
      const p = map(x, y)
      const dx = p.x - h.x
      const dy = p.y - h.y
      return { x: h.x + dx * cos - dy * sin, y: h.y + dx * sin + dy * cos }
    }
    ctx.beginPath()
    tracePath(ctx, GATE, spin)
    ctx.fillStyle = paint(true)
    ctx.fill()
    // ⚠ THE SPECIES OUTLINE, like the body it belongs to (user, 2026-08-30:
    // "I did not mean the ball, but the other moving part, 'leg' on the right
    // side of the channel body"). It was strokedeep-dark, as a piece drawn
    // BEHIND the protein — which made the one part that actually swings the
    // hardest part to see moving. It is the activation gate: the thing the
    // sensor drags open, and the thing the whole panel is about.
    ctx.strokeStyle = c.species
    ctx.lineWidth = 1.1
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  // THE VOLTAGE SENSOR — the only part of this that the charge acts on
  // directly. A short bar on the protein's flank carrying plus charges, shoved
  // OUTWARD as the inside goes positive, because two positives push apart.
  // Everything else on this panel is downstream of this one movement.
  {
    const out = Math.max(0, Math.min(1, c.sensor ?? 0))
    const sx = BOX.x + BOX.w * 0.115
    // Down in the inner half at rest, up into the outer half when shoved.
    const sy = BOX.y + BOX.h * (0.6 - 0.26 * out)
    const p = map(sx, sy)
    const barW = BOX.w * 0.1 * k
    const barH = BOX.h * 0.19 * k
    ctx.save()
    // A hint of the push itself: a warm glow behind the sensor while it is
    // travelling, brightest at the moment it moves.
    const shove = Math.sin(Math.PI * out)
    if (shove > 0.01) {
      ctx.globalAlpha = 0.5 * shove
      ctx.fillStyle = 'rgba(253, 224, 71, 1)'
      ctx.beginPath()
      ctx.arc(p.x, p.y, barH * 0.9, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    const g = ctx.createLinearGradient(p.x - barW, 0, p.x + barW, 0)
    g.addColorStop(0, mix(dark, '#ffffff', 0.15))
    g.addColorStop(0.5, mix(mid, '#ffffff', 0.35))
    g.addColorStop(1, mix(dark, '#ffffff', 0.15))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(p.x - barW, p.y - barH, barW * 2, barH * 2, barW * 0.8)
    ctx.fill()
    ctx.strokeStyle = mix(c.species, '#ffffff', 0.4)
    ctx.lineWidth = 1
    ctx.stroke()
    // Its charges, which are the whole reason it moves.
    for (let i = -1; i <= 1; i++) {
      drawChargeDot(ctx, p.x, p.y + i * barH * 0.55, Math.max(2.4, barW * 0.62), 1)
    }
    ctx.restore()
  }

  // THE SEAT. It appears in the pore's mouth only once the flap is clear —
  // which is the answer to "what makes the ball go in": nothing pulls it, it
  // simply had nowhere to go until now.
  {
    const ready = c.ball === false ? 0 : Math.max(0, Math.min(1, c.seat ?? 0))
    if (ready > 0.01 && (c.plug ?? 0) < 0.6) {
      // ⚠ A HOLE, NOT A DASHED RING ROUND ONE (user, 2026-08-30: "remove the
      // yellow dashed outline… unless it's required to explain its
      // mechanics"). It IS required — it is the whole answer to why the ball
      // waits — but a yellow dashed halo was drawing an ANNOTATION of the
      // socket rather than the socket. A dark recess opening in the mouth is
      // the thing itself, and it stops competing with the flap's outline.
      const st = map(BALL_SEATED.x, BALL_SEATED.y)
      const r = BALL_R * k * 1.12
      ctx.save()
      ctx.globalAlpha = 0.85 * ready
      const hole = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, r)
      hole.addColorStop(0, mix(dark, '#000000', 0.72))
      hole.addColorStop(0.7, mix(dark, '#000000', 0.55))
      hole.addColorStop(1, `rgba(0, 0, 0, 0)`)
      ctx.fillStyle = hole
      ctx.beginPath()
      ctx.arc(st.x, st.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  if (c.ball === false) return

  // THE BALL AND ITS CHAIN. The ball travels; the chain is redrawn to follow
  // it, so it is attached at both ends at every moment of the journey — which
  // is exactly what swapping one drawn chain for another cannot promise.
  {
    const at = ballPathAt(c.plug)
    const b = map(at.x, at.y)
    // The jostling, damped to nothing as it seats: a ball that kept twitching
    // in its socket would say it had not really bound. Two frequencies that do
    // not share a period, so it never looks like a pendulum.
    if (c.restlessMs !== undefined) {
      const loose = 1 - Math.max(0, Math.min(1, c.plug))
      const ms = c.restlessMs
      b.x += Math.sin(ms / 197) * 2.6 * k * loose + Math.sin(ms / 71) * 1.1 * k * loose
      b.y += Math.sin(ms / 143 + 1.7) * 2.1 * k * loose + Math.sin(ms / 59) * 0.9 * k * loose
    }
    const anchor = map(CHAIN_AT.x, CHAIN_AT.y)
    // The chain bows away from the protein, by more when the ball is hanging
    // and hardly at all when it is seated — a taut chain and a slack one look
    // different, and it is slack that says "hanging".
    const slack = 1 - Math.max(0, Math.min(1, c.plug))
    ctx.strokeStyle = mid
    ctx.lineWidth = Math.max(1, 3 * k)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(anchor.x, anchor.y)
    ctx.quadraticCurveTo(
      anchor.x - 14 * k * slack + (b.x - anchor.x) * 0.3,
      (anchor.y + b.y) / 2 + 6 * k * slack,
      b.x,
      b.y,
    )
    ctx.stroke()

    const r = BALL_R * k
    const g = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.3, 0, b.x, b.y, r)
    g.addColorStop(0, mix(c.species, '#ffffff', 0.35))
    g.addColorStop(1, c.speciesDark)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
    ctx.fill()
    // ⚠ THE SPECIES OUTLINE, like every other part of this protein (user,
    // 2026-08-30: "give the 'ball' an outline of corresponding color, same
    // outline that the body has"). It went dark for one round while the flap's
    // own outline was being fixed; with the flap now painted over the body and
    // clearly the thing that swings, the ball can wear the family rim too
    // without the two competing. What does NOT come back is the extra ring
    // that used to appear as it seated: the ball says that by going still,
    // which is the mechanism rather than an annotation of it.
    ctx.strokeStyle = c.species
    ctx.lineWidth = 1.1
    ctx.stroke()
  }
}
