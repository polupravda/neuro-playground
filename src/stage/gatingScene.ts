import {
  ballInAt,
  boundAt,
  familyOf,
  gateOpennessAt,
  isGated,
  pokeAt,
  type FamilyId,
} from '../core/gating'
import { IONS } from '../core/ions'
import { drawLipids, HALF_MEM, mix } from './bilayer'
import { drawLeakChannel, leakHalfWidth } from './leakChannel'
import { drawLigandChannel, ligandHalfWidth, ligandSeat } from './ligandChannel'
import { drawMechanicalChannel, mechanicalHalfWidth } from './mechanicalChannel'
import { drawVoltageChannel, voltageHalfWidth } from './voltageChannel'
import {
  GLOSSY_COLORS,
  chargeWash,
  drawChargeDot,
  drawGlossyIon,
  drawIonCharge,
  badgeMinR,
} from './particleStyle'
import { spoken, drawSpoken, type SpokenLabel } from './spokenLabels'

// D04's face, rebuilt (user, 2026-08-28: "the whole visualisation is not
// kids-friendly at all").
//
// FOUR DOORS, FOUR CONTAINERS, side by side in the equilibrium bench's
// grammar — one panel each, the way the reference figure lays them out. Each
// panel is a piece of the app's own wall with one door in it, and each door is
// TINTED ITS OWN COLOUR, because a child reads colour long before words.
//
// And the cause is APPLIED PHYSICALLY. A gate is not a switch wired to a
// button: something comes and does something to it, and that is the thing
// worth watching.
//
//   🕳️ leak       — no gate at all; ions simply trickle through, always
//   ⚡ voltage    — the charge across the wall FLASHES over, and it opens
//   🥄 ligand     — a messenger flies in and LANDS on it, and it opens
//   👆 mechanical — the wall is PUSHED, curves, and the stretch opens it
//
// The leak is not a fourth dial: it is the control the other three are read
// against, and it is why the word "gated" means anything.

// The four panels share the drawer's width and STRETCH to its bottom (user,
// 2026-08-28), so the exhibit fills the room it has rather than sitting in a
// band across the top.
const VIEW_W = typeof window !== 'undefined' ? window.innerWidth : 1440
const VIEW_H = typeof window !== 'undefined' ? window.innerHeight : 860
const DRAWER_W = Math.min(VIEW_W, 1376)
const CONTENT_W = Math.max(660, DRAWER_W - 40 - 256 - 24 - 12)
const CONTENT_H = Math.max(520, VIEW_H - 48 - 8)
/** Four containers, their gaps, their padding and their borders. */
const PANEL_CHROME = 4 * (2 * 8 + 2) + 3 * 10
/** The button and the two lines of heading each panel carries above its
 *  canvas. */
const PANEL_HEAD = 38 + 8 + 34

export const PANEL_W = Math.floor((CONTENT_W - 20 - PANEL_CHROME) / 4)
export const PANEL_H = Math.round(CONTENT_H - 22 - PANEL_HEAD - 18)

const WALL_Y = PANEL_H * 0.5
const SCALE = 2.4
const FAINT = 'rgba(148, 163, 184, 0.75)'

// ── The push, and what the membrane does about it ──────────────────────────
//
// ⚠ A PUSH BENDS A SHEET; IT DOES NOT MOVE IT (user, 2026-08-30: "visualize
// push with slight membrane curving"). The first version slid the whole wall
// down by a fixed offset — which draws a membrane on a lift, and says nothing
// about why the door opens. What actually opens a mechanically-gated channel
// is that the sheet is STRETCHED: it curves under the finger, and the tension
// that curve puts in the bilayer pulls the subunits apart.
//
// So the wall stays where it is at the panel's edges and sinks only under the
// finger, and the channel rides down with the lowest point of the curve.

/** How deep the dip goes at full press, px. Deliberately SLIGHT — about one
 *  membrane half-thickness. A membrane folded double would be a rupture, not a
 *  stretch, and the exhibit is about the stretch. */
const DIP_PX = HALF_MEM * SCALE * 0.8
/** How far along the wall the bend reaches. Wide, because a stiff local kink
 *  reads as a hole being poked; a shallow, broad sag reads as a sheet under
 *  tension — and it is a FRACTION OF THE PANEL, so the wall always has flat
 *  ground either side of the sag to be measured against. A bend wider than the
 *  panel would tilt the whole wall, which is the lift again. */
const BEND_HALF_PX = PANEL_W * 0.42

/** A raised cosine: 1 under the finger, 0 at the edge of its reach, and FLAT
 *  where it meets the undisturbed wall — so no crease shows at the join. */
function bell(u: number): number {
  if (Math.abs(u) >= 1) return 0
  return 0.5 * (1 + Math.cos(Math.PI * u))
}

export interface Bend {
  /** How far the membrane's middle has sunk under the finger, px. */
  dip: number
  /** How far it has sunk at this distance from the finger, px. */
  at: (dx: number) => number
  /** dy/dx there, so each lipid can stand square to the sagging surface. */
  slope: (dx: number) => number
}

/** The bend a press of this strength puts in the wall. A pure function of the
 *  press, so a test can walk it without a canvas. */
export function membraneBend(strength: number): Bend {
  const press = Math.max(0, Math.min(1, strength))
  const dip = DIP_PX * press
  return {
    dip,
    at: (dx) => dip * bell(dx / BEND_HALF_PX),
    slope: (dx) => {
      const u = dx / BEND_HALF_PX
      if (Math.abs(u) >= 1) return 0
      return (dip * -0.5 * Math.PI * Math.sin(Math.PI * u)) / BEND_HALF_PX
    },
  }
}

export function panelLabels(id: FamilyId): SpokenLabel[] {
  return [
    spoken('extracellular', 34, 26),
    spoken('intracellular', 34, PANEL_H - 58),
    spoken(familyOf(id).name.toLowerCase(), 34, PANEL_H - 12),
  ]
}

/** THE CHARGE ON THE TWO FACES, as the reference figure draws it: plus above
 *  and minus below at rest, and swapped over while the voltage cause is being
 *  applied. Drawn on EVERY panel, not just the voltage one — a membrane is
 *  charged whether or not anybody is pushing on it, and showing it only where
 *  it is being changed would teach that it appears when you press a button. */
function drawFaces(ctx: CanvasRenderingContext2D, flipped: number, bend: Bend): void {
  const t = Math.max(0, Math.min(1, flipped))
  for (let i = 0; i < 5; i++) {
    const x = 30 + (i * (PANEL_W - 60)) / 4
    // The charges are ON the two faces, so they sag with them. Marks left
    // hanging in a straight line over a bent wall would say the charge is a
    // decoration painted on the panel rather than something the membrane
    // carries.
    const sag = bend.at(x - PANEL_W / 2)
    const outerY = WALL_Y + sag - HALF_MEM * SCALE - 10
    const innerY = WALL_Y + sag + HALF_MEM * SCALE + 10
    // The two faces cross over: the outside fades from plus to minus as the
    // inside fades the other way, so the flip reads as a swap rather than as
    // two independent flickers.
    ctx.save()
    ctx.globalAlpha = 1 - t
    drawChargeDot(ctx, x, outerY, 6, 1)
    drawChargeDot(ctx, x, innerY, 6, -1)
    ctx.restore()
    if (t > 0.01) {
      ctx.save()
      ctx.globalAlpha = t
      drawChargeDot(ctx, x, outerY, 6, -1)
      drawChargeDot(ctx, x, innerY, 6, 1)
      ctx.restore()
    }
  }
}

/** How open this door is at a moment of its poke.
 *
 *  MECHANICS, not odds (user, 2026-08-28). The cause arrives, the door opens,
 *  it holds open for a moment, and it shuts again — and then the cause can be
 *  applied afresh. The flicker and the percentage belong to the patch clamp,
 *  which is the exhibit about how OFTEN; this one is about what happens. */
export function opennessAt(id: FamilyId, sinceMs: number | null): number {
  if (!isGated(id)) return 1
  return gateOpennessAt(pokeAt(sinceMs))
}

/** The cause, drawn doing its work. Each one is a different physical thing,
 *  which is the whole reason the four panels exist. */
function drawCause(
  ctx: CanvasRenderingContext2D,
  id: FamilyId,
  sinceMs: number | null,
  ms: number,
): void {
  const poke = pokeAt(sinceMs)
  const cx = PANEL_W / 2
  const tint = GLOSSY_COLORS[familyOf(id).tint]

  if (id === 'voltage') {
    // THE CHARGE FLASHES OVER. The wash this app uses for a charged cytoplasm,
    // swung positive while the cause is on, with ± marks flaring on the two
    // faces at the moment it flips.
    if (poke.strength > 0.01) {
      ctx.save()
      ctx.globalAlpha = poke.strength
      const from = WALL_Y + HALF_MEM * SCALE
      ctx.fillStyle = chargeWash(ctx, from, PANEL_H, 0.9)
      ctx.fillRect(0, from, PANEL_W, PANEL_H - from)
      ctx.restore()
    }
    return
  }

  if (id === 'ligand') {
    // A MESSENGER FLIES IN AND LANDS. It comes from outside, sits in the
    // receptor's mouth while the cause is on, and leaves again.
    // BINDING AS A PUZZLE (user, 2026-08-28): the channel has a socket cut
    // into its extracellular mouth, and the messenger is the piece that fits
    // it. It flies in, drops into the hole, and STAYS THERE while the door is
    // open — so "binds" is something a child watches happen, and so the door
    // is never open with nothing holding it.
    if (boundAt(poke) <= 0.001) return
    // The socket's own place, ASKED OF THE CHANNEL rather than worked out
    // twice — and it MOVES as the channel opens, because the socket is cut
    // into a subunit that slides. A messenger that stayed put while its own
    // binding site slid out from under it would be the same fault as landing
    // beside the hole in the first place.
    const openNow = opennessAt(id, sinceMs)
    const s0 = ligandSeat(0, 0, openNow, HALF_MEM)
    const seat = { x: cx + s0.x * SCALE, y: WALL_Y + s0.y * SCALE }
    const round = Math.max(2, s0.r * SCALE * 0.95)
    const from = { x: cx + 70, y: 14 }
    // Its own clock: in, down into the hole, SEATED for as long as the door is
    // open, and away only once the door has shut behind it.
    const bound = boundAt(poke)
    const p = Math.min(1, bound * 3)
    const x = from.x + (seat.x - from.x) * p
    const y = from.y + (seat.y - from.y) * p
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, bound < 1 && poke.t > 0.5 ? bound : 1))
    const r = round * 1.05
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
    g.addColorStop(0, mix(tint.light, '#ffffff', 0.3))
    g.addColorStop(1, tint.dark)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    if (bound > 0.9) {
      // Seated: a rim where the piece meets its hole, so "in" reads as in.
      ctx.strokeStyle = tint.mid
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(x, y, r + 1.5, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
    return
  }

  if (id === 'mechanical') {
    // A FINGER PUSHES. The wall CURVES under it — the bilayer is drawn sagging
    // where the finger meets it and flat out at the edges, so the push is done
    // TO the membrane rather than mimed above it.
    if (poke.approach <= 0.001) return
    const press = poke.strength
    // The fingertip ends ON the surface it is pressing — which is itself
    // moving, so the two are read off the SAME bend. A finger that stopped at
    // the wall's resting height would be pressing on nothing by the time the
    // wall had given way.
    const rest = WALL_Y - HALF_MEM * SCALE - 34
    const y = 18 + rest * Math.min(1, poke.approach) + membraneBend(press).dip
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, poke.approach))
    ctx.fillStyle = mix(tint.mid, '#ffffff', 0.15)
    ctx.beginPath()
    ctx.roundRect(cx - 11, y - 26, 22, 34, 10)
    ctx.fill()
    ctx.fillStyle = `rgba(${tint.glow}, ${0.25 * press})`
    ctx.beginPath()
    ctx.arc(cx, y + 10, 16 * press + 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  // The leak has no cause. Its ions simply keep going, which is drawn below.
  void ms
}

/** One panel: the wall, its door, its cause and its traffic. */
export function drawFamilyPanel(
  ctx: CanvasRenderingContext2D,
  id: FamilyId,
  sinceMs: number | null,
  ms: number,
): void {
  const family = familyOf(id)
  const tint = GLOSSY_COLORS[family.tint]
  const cx = PANEL_W / 2
  const poke = pokeAt(sinceMs)
  const open = opennessAt(id, sinceMs)

  // The cause goes UNDER the wall it acts on, except the finger, which is in
  // front of it — you can see a finger, you cannot see a charge.
  if (id !== 'mechanical') drawCause(ctx, id, sinceMs, ms)

  // How far the wall has given way under the finger — nothing at all on the
  // other three panels, which is `membraneBend(0)`.
  const bend = membraneBend(id === 'mechanical' ? poke.strength : 0)
  const dip = bend.dip

  // The charge on the two faces, on EVERY panel: a membrane is charged whether
  // or not anybody is pushing on it. Only the voltage panel's swaps over.
  drawFaces(ctx, id === 'voltage' ? poke.strength : 0, bend)

  // The wall. The origin goes to the BOTTOM of the bend, because that is where
  // the channel sits; the lipids either side climb back out of it via `waveAt`.
  ctx.save()
  ctx.translate(cx, WALL_Y + dip)
  ctx.scale(SCALE, SCALE)
  const half = cx / SCALE
  // The gap in the wall is cut to fit whatever protein goes in it: the leak
  // is a traced shape and is wider than the drawn gate, so one fixed gap
  // would leave lipids standing inside it.
  const fits =
    id === 'leak'
      ? leakHalfWidth(HALF_MEM) * 1.06
      : id === 'voltage'
        ? voltageHalfWidth(HALF_MEM) * 1.06
        : id === 'ligand'
          ? ligandHalfWidth(HALF_MEM) * 1.06
          : mechanicalHalfWidth(HALF_MEM) * 1.06
  drawLipids(ctx, {
    midY: 0,
    from: -half,
    to: half,
    gaps: [[-fits, fits]],
    // Local coordinates: x here is panel px divided by SCALE, and the origin
    // is already at the bottom of the dip — so the wave is how far this
    // molecule sits ABOVE that, which is zero under the finger and the full
    // dip out at the edges. A slope of dy/dx is scale-free, so it needs no
    // conversion.
    ...(dip > 0.01
      ? {
          waveAt: (x: number) => (bend.at(x * SCALE) - dip) / SCALE,
          slopeAt: (x: number) => bend.slope(x * SCALE),
        }
      : {}),
  })

  // ⚠ A LEAK CHANNEL IS NOT A GATE WITH THE GATE LEFT OUT (user, 2026-08-29,
  // who supplied the drawing). It has no gate, no sensor and no binding site,
  // and its shape says so: three subunits shoulder to shoulder with the back
  // one showing between the two in front, and a way through that is simply
  // always there. Drawing it with the gated silhouette was making the app say
  // the two are one object with different labels.
  if (id === 'leak') {
    drawLeakChannel(ctx, {
      cx: 0,
      midY: 0,
      halfHeight: HALF_MEM,
      // Tinted with the ion it passes, like every channel in this app.
      species: tint.mid,
      speciesDark: tint.dark,
    })
    ctx.restore()
    drawTrafficAndReading(ctx, id, open, dip, ms)
    for (const l of panelLabels(id)) drawSpoken(ctx, l)
    return
  }

  // ⚠ THE VOLTAGE-GATED CHANNEL IS TRACED (user, 2026-08-29), from a drawing
  // that gives it in three states — closed, open, INACTIVE. Its two moving
  // parts TRAVEL rather than being swapped between drawn positions: the flap
  // rotates about its hinge, and the ball rides an arc with its chain redrawn
  // to follow it. The ball plugs the pore in the third state, which is what
  // makes it an inactivation ball rather than a sensor.
  if (id === 'voltage') {
    drawVoltageChannel(ctx, {
      cx: 0,
      midY: 0,
      halfHeight: HALF_MEM,
      species: tint.mid,
      speciesDark: tint.dark,
      open,
      plug: ballInAt(poke),
    })
    ctx.restore()
    drawCause(ctx, id, sinceMs, ms)
    drawTrafficAndReading(ctx, id, open, dip, ms)
    for (const l of panelLabels(id)) drawSpoken(ctx, l)
    return
  }

  // ⚠ THE LIGAND-GATED CHANNEL IS TRACED TOO (user, 2026-08-29), and it opens
  // by a DIFFERENT MECHANISM: nothing swings and nothing plugs — the subunits
  // themselves come apart. That difference is worth the second traced drawing,
  // because two doors that open differently are the whole reason this bench
  // has four panels.
  if (id === 'ligand') {
    drawLigandChannel(ctx, {
      cx: 0,
      midY: 0,
      halfHeight: HALF_MEM,
      species: tint.mid,
      speciesDark: tint.dark,
      open,
      socket: true,
    })
    ctx.restore()
    drawCause(ctx, id, sinceMs, ms)
    drawTrafficAndReading(ctx, id, open, dip, ms)
    for (const l of panelLabels(id)) drawSpoken(ctx, l)
    return
  }

  // ⚠ THE MECHANICALLY-GATED CHANNEL IS TRACED (user, 2026-08-30). It opens
  // the way the ligand-gated one does — the subunits come apart, by the same 8
  // units measured off both drawings — but its silhouette is its own: flared
  // shoulders and splayed feet where the other has a notch and a straight
  // foot. Two doors that open alike can still be two different doors.
  //
  // Nothing touches it. What opens it is the CURVE in the wall around it: the
  // sheet is stretched, and the stretch pulls the subunits apart. That is why
  // this panel has no sensor, no messenger and no socket — the cause is drawn
  // in the bilayer, not on the protein.
  drawMechanicalChannel(ctx, {
    cx: 0,
    midY: 0,
    halfHeight: HALF_MEM,
    species: tint.mid,
    speciesDark: tint.dark,
    open,
  })
  ctx.restore()
  drawCause(ctx, id, sinceMs, ms)

  drawTrafficAndReading(ctx, id, open, dip, ms)
}

/** The traffic through an open door, the direction arrow, and the one-word
 *  reading — shared, because every panel ends the same way whatever protein it
 *  drew. */
function drawTrafficAndReading(
  ctx: CanvasRenderingContext2D,
  id: FamilyId,
  open: number,
  dip: number,
  ms: number,
): void {
  const family = familyOf(id)
  const tint = GLOSSY_COLORS[family.tint]
  const cx = PANEL_W / 2
  // WHICH WAY, as the reference figure's black arrow through the pore. It is
  // drawn only while the door is open, because a way through that is shut is
  // not a way anywhere.
  if (open > 0.5) {
    const up = family.tint === 'k'
    const from = WALL_Y + dip + (up ? HALF_MEM * SCALE + 30 : -HALF_MEM * SCALE - 30)
    const to = WALL_Y + dip + (up ? -HALF_MEM * SCALE - 34 : HALF_MEM * SCALE + 34)
    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = tint.mid
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(cx, from)
    ctx.lineTo(cx, to)
    ctx.stroke()
    const head = up ? 1 : -1
    ctx.fillStyle = tint.mid
    ctx.beginPath()
    ctx.moveTo(cx, to)
    ctx.lineTo(cx - 6, to + head * 9)
    ctx.lineTo(cx + 6, to + head * 9)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // THE TRAFFIC. Ions go through only while the door is open — which for the
  // leak is always, and that is the point of it being here.
  const r = 7
  const ionKind = family.tint
  if (open > 0.5) {
    for (let i = 0; i < 3; i++) {
      const phase = ((ms / 900 + i / 3) % 1)
      // Potassium leaves the cell; sodium and calcium come in. Which way an
      // ion goes is the gradient's business, not the gate's, and it must not
      // be the same arrow for all four.
      const span = HALF_MEM * SCALE * 2 + 54
      const up = family.tint === 'k'
      const y = up
        ? WALL_Y + dip + HALF_MEM * SCALE + 27 - phase * span
        : WALL_Y + dip - HALF_MEM * SCALE - 27 + phase * span
      const x = cx + Math.sin(phase * 6 + i) * 5
      ctx.save()
      ctx.globalAlpha = Math.min(1, 2 - Math.abs(phase - 0.5) * 4)
      drawGlossyIon(ctx, ionKind, x, y, r)
      drawIonCharge(ctx, x, y, r, IONS[ionKind].charge, undefined, badgeMinR(1))
      ctx.restore()
    }
  }

  // The reading, and only the reading: open or shut. The percentage went with
  // the probabilities (user, 2026-08-28) — how OFTEN is the patch clamp's
  // exhibit, and two exhibits answering the same question is one too many.
  ctx.fillStyle = open > 0.5 ? tint.mid : FAINT
  ctx.font = '13px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(open > 0.5 ? 'open' : 'shut', cx, PANEL_H - 26)

  for (const l of panelLabels(id)) drawSpoken(ctx, l)
}
