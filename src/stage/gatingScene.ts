import {
  ballInAt,
  boundAt,
  familyOf,
  gateOpennessAt,
  isGated,
  ligandLockedAt,
  stretchOpenAt,
  pokeAt,
  seatOpenAt,
  sensorOutAt,
  type FamilyId,
} from '../core/gating'
import { IONS } from '../core/ions'
import { drawLipids, HALF_MEM, HEAD_GAP, mix } from './bilayer'
import { drawMagnifier } from './channelScene'
import { SIGNAL_RGB, softGlow } from './signal'
import { ELEMENT_COLOR } from './lipidLabScene'
import { drawLeakChannel, leakHalfWidth } from './leakChannel'
import { drawLigandChannel, ligandHalfWidth, ligandSeat } from './ligandChannel'
import { drawMechanicalChannel, mechanicalHalfWidth } from './mechanicalChannel'
import { drawVoltageChannel, voltageHalfWidth } from './voltageChannel'
import {
  GLOSSY_COLORS,
  glossySphere,
  chargeWash,
  drawChargeDot,
  drawGlossyIon,
  drawIonCharge,
  badgeMinR,
} from './particleStyle'

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
/** The button and the heading each panel carries above its canvas — the
 *  heading block being a FIXED 46 px, three lines' worth, so that all four
 *  walls sit at the same height whatever their sentences say (2026-08-30). */
const PANEL_HEAD = 38 + 8 + 46

export const PANEL_W = Math.floor((CONTENT_W - 20 - PANEL_CHROME) / 4)
export const PANEL_H = Math.round(CONTENT_H - 22 - PANEL_HEAD - 18)

/** Where the wall sits in a panel, and how much the membrane's own units are
 *  magnified to fill it. Exported so a test can look at the right piece of the
 *  picture rather than guessing where it is. */
export const WALL_Y = PANEL_H * 0.5
export const WALL_SCALE = 2.4
const SCALE = WALL_SCALE

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

// ⚠ THE CANVAS CARRIES NO LABELS AT ALL HERE (user, 2026-08-30: "place
// loudspeakers in front of the title, in the header. No need for additional
// labeling").
//
// Each panel is about a hand's width. Three spoken words stacked down the left
// of it were competing with the one thing the panel is for — a door being
// opened — and the family's name was on the canvas AND in the heading directly
// above it, which is this app's "if the canvas already says it, the column
// must not repeat it" the wrong way round. The speaker button moved to the
// heading, where the word it pronounces actually is.
//
// The term is still spoken; it is just spoken from where it is written.
/** ⚠ THE MAGNIFIER LIVES ON THE CANVAS, not in the button row (user,
 *  2026-08-30: "'How it is built' in 'channel types' is incorrectly placed. It
 *  does a different action than the rest of the buttons").
 *
 *  It was sitting in the slot the other three panels use for their CAUSE — the
 *  thing that opens that door — so a control that navigates somewhere else
 *  wore the costume of a control that acts on the panel. Wrong promise, right
 *  next to three buttons keeping it.
 *
 *  On the canvas it is the app's own zoom grammar instead: a magnifier says
 *  "there is more to see here", and it sits ON the protein it opens, which is
 *  the potassium channel the structure exhibit takes apart. */
export function lensChip(): { cx: number; cy: number; r: number } {
  return { cx: PANEL_W - 34, cy: WALL_Y - HALF_MEM * SCALE - 30, r: 14 }
}

export function lensChipAt(x: number, y: number): boolean {
  const c = lensChip()
  return Math.hypot(x - c.cx, y - c.cy) <= c.r * 1.3
}

export function panelTerm(id: FamilyId): string {
  return familyOf(id).name.toLowerCase()
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
  const poke = pokeAt(sinceMs)
  // ⚠ The stretch-gated door has NO middle step, so it has no pause: the sheet
  // bending is the thing that opens it (user, 2026-08-30). The other two wait
  // on something — a sensor, or a messenger finishing its landing — and there
  // the pause is what makes the chain legible.
  if (id === 'mechanical') return stretchOpenAt(poke)
  return gateOpennessAt(poke)
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
    // ⚠ A FLASH, NOT A PICTURE OF A FLASH (user, 2026-08-30: "display signal
    // as flash, not a flash icon"). The first cut drew a lightning-bolt
    // zig-zag, which is a SYMBOL for electricity sitting on the canvas — and
    // this app already has one way of saying "the signal is here": the yellow
    // bloom the axon views use, `SIGNAL_RGB` with its near-white core. Drawing
    // a second, private idiom for the same idea is how one visual language
    // stops being one.
    //
    // It arrives at the TOP OF THE PANEL and washes down onto the wall, so the
    // signal reads as having come from somewhere else rather than being
    // generated here by the button.
    const strike = Math.max(0, Math.min(1, poke.contact * 2.2)) * (1 - poke.t / 0.42)
    if (strike > 0.01) {
      const lit = Math.max(0, Math.min(1, strike))
      // ⚠ ROUND, LIKE A TORCH SHONE ON IT (user, 2026-08-30). A band across
      // the whole top edge lights everything equally and so points at nothing;
      // a round pool has a centre, and the centre is the door. It still
      // arrives from beyond the top edge, so the signal reads as having come
      // from somewhere else rather than being made here by the button.
      const from = { x: cx, y: -18 }
      const spread = PANEL_W * 0.62 + PANEL_W * 0.2 * lit
      ctx.save()
      const g = ctx.createRadialGradient(from.x, from.y, 0, from.x, from.y, spread)
      g.addColorStop(0, `rgba(${SIGNAL_RGB}, ${0.95 * lit})`)
      g.addColorStop(0.35, `rgba(${SIGNAL_RGB}, ${0.42 * lit})`)
      g.addColorStop(0.72, `rgba(${SIGNAL_RGB}, ${0.12 * lit})`)
      g.addColorStop(1, `rgba(${SIGNAL_RGB}, 0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(from.x, from.y, spread, 0, Math.PI * 2)
      ctx.fill()
      // Its white-hot middle, small and right at the source.
      softGlow(ctx, from.x, from.y, 34 + 22 * lit, '255, 255, 255', 0.85 * lit)
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
    // ⚠ IT TRAVELS FOR AS LONG AS IT IS ARRIVING (user, 2026-08-30: "ion in
    // ligand-gated should move slower"). It used to cover the whole distance
    // in the first third of its arrival and then hover by the socket waiting
    // for the clock, which read as a jump followed by a stall.
    const p = bound
    const x = from.x + (seat.x - from.x) * p
    const y = from.y + (seat.y - from.y) * p
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, bound < 1 && poke.t > 0.5 ? bound : 1))
    const r = round * 1.05
    // ⚠ IT IS NOT AN ION — AND IT HAS TO LOOK LIKE A MOLECULE TO SAY SO
    // (user, 2026-08-30: "we've earlier color-coded Cl⁻ green… you display it
    // brown in ligand-gated demo").
    //
    // The brown thing is THIS, and it was being read as the chloride ion. A
    // previous round gave it its own orange, on the reasoning that a colour
    // belonging to no species says "not one of the four" — and that reasoning
    // was too subtle to survive contact. A single glossy ball IS what this app
    // means by "ion", whatever colour it is painted, so painting it a spare
    // colour just made it look like a fifth ion.
    //
    // Drawn from ATOMS instead, in the app's own element colours and with its
    // bonds showing, exactly as the water molecules in the permeability bench
    // are. That is a difference of KIND, not of shade: ions here are lone
    // spheres wearing a ± badge, and nothing else in the app is a cluster of
    // bonded atoms. GABA really is N-C-C-C-COOH; three heavy atoms is as much
    // of that as survives at this size, and they are the right three.
    const atoms = [
      { dx: -0.72, dy: 0.34, k: 'N' as const, rr: 0.56 },
      { dx: 0.06, dy: -0.1, k: 'C' as const, rr: 0.52 },
      { dx: 0.78, dy: 0.3, k: 'O' as const, rr: 0.56 },
    ]
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, bound < 1 && poke.t > 0.5 ? bound : 1))
    // The bonds first, so the atoms sit on top of them.
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.75)'
    ctx.lineWidth = Math.max(1.1, r * 0.3)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x + atoms[0].dx * r, y + atoms[0].dy * r)
    ctx.lineTo(x + atoms[1].dx * r, y + atoms[1].dy * r)
    ctx.lineTo(x + atoms[2].dx * r, y + atoms[2].dy * r)
    ctx.stroke()
    for (const a of atoms) {
      glossySphere(ctx, x + a.dx * r, y + a.dy * r, r * a.rr, ELEMENT_COLOR[a.k])
    }
    // THE COLLAR — the receptor closing on what it has caught. It arrives a
    // beat AFTER the molecule has settled, on its own clock, so the landing and
    // the catching read as two events rather than one (user, 2026-08-30).
    // Thick, because at this size a hairline round a small shape is a smudge.
    const locked = ligandLockedAt(poke)
    if (locked > 0.01) {
      ctx.globalAlpha = Math.min(ctx.globalAlpha, locked)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2.6
      ctx.beginPath()
      ctx.arc(x, y, r * 1.75, 0, Math.PI * 2)
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

/** Whether this panel draws the ± marks on its two faces.
 *
 *  Exported because the rule is a DECISION, not a shape — and the way to pin a
 *  decision is to test the decision, not to go hunting for its consequences in
 *  a list of drawing calls. */
export function showsCharge(id: FamilyId): boolean {
  return id === 'voltage'
}

/** How far this door reaches either side of the pore's centre at this
 *  openness — the two separating channels genuinely widen, the other two do
 *  not. */
export function channelHalfWidthAt(id: FamilyId, open: number): number {
  if (id === 'leak') return leakHalfWidth(HALF_MEM)
  if (id === 'voltage') return voltageHalfWidth(HALF_MEM)
  if (id === 'ligand') return ligandHalfWidth(HALF_MEM, open)
  return mechanicalHalfWidth(HALF_MEM, open)
}

/** ⚠ THE GAP CUT IN THE WALL IS THE SHUT WIDTH, NOT THE OPEN ONE (user,
 *  2026-08-30: "ligand-gated and mechanically-gated have a visual hole in the
 *  membrane, place lipids there").
 *
 *  The two separating channels used to cut the width they would eventually
 *  reach, which is correct for the one moment they are fully open and a bare
 *  hole in the wall for all the rest of the run. Cutting the shut width and
 *  SHOVING the neighbours aside as it widens is this app's own rule about what
 *  making room looks like — and it means the wall is never drawn with a gap
 *  that nothing is standing in.
 *
 *  Exported because the bug was in WHICH NUMBER gets cut, so that is the thing
 *  worth pinning. A test that only looked at the picture passed on the bug. */
export function wallGapAt(id: FamilyId): number {
  return channelHalfWidthAt(id, 0) * 1.06
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

  // ⚠ ONLY ON THE VOLTAGE PANEL (user, 2026-08-30: "keep charge labels in
  // voltage-gated only, to emphasize the fact that charge is irrelevant in
  // other cases").
  //
  // This reverses an earlier decision of mine, and the reason it was made is
  // still true: a real membrane is charged whether or not anybody is pushing
  // on it, so marks that appear on one panel only can be read as "this is the
  // charged one". What outweighs it is that the other three panels were
  // showing a quantity that has NOTHING to do with what opens them, and a
  // child looking for the cause found charge drawn on all four doors. The cost
  // is paid off in words instead: the info block now says outright that every
  // membrane is charged and only one of these doors cares.
  if (showsCharge(id)) drawFaces(ctx, poke.strength, bend)

  // The wall. The origin goes to the BOTTOM of the bend, because that is where
  // the channel sits; the lipids either side climb back out of it via `waveAt`.
  ctx.save()
  ctx.translate(cx, WALL_Y + dip)
  ctx.scale(SCALE, SCALE)
  const half = cx / SCALE
  // The gap in the wall is cut to fit whatever protein goes in it: the leak
  // is a traced shape and is wider than the drawn gate, so one fixed gap
  // would leave lipids standing inside it.
  //
  // ⚠ AND CUT TO WHAT IS ACTUALLY THERE, NOT TO WHAT WILL BE (user,
  // 2026-08-30: "ligand-gated and mechanically-gated have a visual hole in the
  // membrane, place lipids there"). The two separating channels were cutting
  // their FULLY-OPEN width, which is right for one moment of the run and a
  // bare hole in the wall for all the rest of it. They now cut their SHUT
  // width and shove the neighbouring lipids aside as they widen — which is
  // this app's own rule about what making room looks like, and it means the
  // wall is never drawn with a gap nothing is standing in.
  const fits = wallGapAt(id)
  // How much wider than shut it is right now, and therefore how far the
  // molecules beside it have to give way.
  const grow = channelHalfWidthAt(id, open) - channelHalfWidthAt(id, 0)
  /** Full shove right at the pore's lip, dying away over a few molecules.
   *
   *  MEASURED against the lipid spacing rather than picked: the channel widens
   *  by about 2 px a side and the molecules sit 4.6 px apart, so a reach of one
   *  spacing would move the first molecule 2 px and its neighbour not at all —
   *  which closes a 4.6 px gap to 2.6 and piles two heads on top of each other.
   *  Spread over three, each one gives a little and the row stays a row. */
  const REACH = HEAD_GAP * 3
  const shoveAt = (x: number) => {
    if (grow <= 0.001) return 0
    const past = Math.abs(x) - fits
    if (past < 0) return 0
    if (past >= REACH) return 0
    return Math.sign(x) * grow * 0.5 * (1 + Math.cos((Math.PI * past) / REACH))
  }
  drawLipids(ctx, {
    midY: 0,
    from: -half,
    to: half,
    gaps: [[-fits, fits]],
    ...(grow > 0.001 ? { pushAt: shoveAt } : {}),
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
    drawTrafficAndReading(ctx, id, open, dip, ms, ballInAt(poke))
    // The way in to how this one is BUILT — the structure exhibit takes apart
    // a potassium channel with no gate on it, which is precisely this door.
    const lens = lensChip()
    drawMagnifier(ctx, lens.cx, lens.cy, lens.r)
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
      // The chain, in the order it really happens: the charge shoves the
      // SENSOR, the sensor drags the gate open, and only then does a seat
      // exist for the ball.
      sensor: sensorOutAt(poke),
      seat: seatOpenAt(poke),
      // It jostles on its tether from the very first frame — before the flash,
      // before anything — which is what makes "nothing pulls it in" something
      // a child watches rather than something a paragraph claims.
      restlessMs: ms,
    })
    ctx.restore()
    drawCause(ctx, id, sinceMs, ms)
    drawTrafficAndReading(ctx, id, open, dip, ms, ballInAt(poke))
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
    drawTrafficAndReading(ctx, id, open, dip, ms, ballInAt(poke))
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

  drawTrafficAndReading(ctx, id, open, dip, ms, ballInAt(poke))
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
  /** How far the inactivation ball has seated, 0→1 — and a seated ball is a
   *  BLOCKED PORE (user, 2026-08-30: "the ions keep flowing above the ball. It
   *  should stop the moment the ball gets plugged in").
   *
   *  Traffic used to be drawn on `open` alone, so ions went on streaming past
   *  a ball sitting in the mouth. That is not a cosmetic slip: stopping the
   *  current is the entire function of inactivation, and drawing it still
   *  flowing said the ball does nothing. */
  plug = 0,
): void {
  const family = familyOf(id)
  const tint = GLOSSY_COLORS[family.tint]
  const cx = PANEL_W / 2
  // A pore is a way through only while it is BOTH open and unplugged. The ball
  // seats while the door is still open — that is what makes it the thing that
  // stops the channel rather than a decoration following the door — so the
  // openness alone cannot answer "is anything crossing".
  const conducting = open > 0.5 && plug < 0.5
  // WHICH WAY, as the reference figure's black arrow through the pore. It is
  // drawn only while the door is open, because a way through that is shut is
  // not a way anywhere.
  if (conducting) {
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
  if (conducting) {
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

  // ⚠ AND NOTHING IS WRITTEN (user, 2026-08-30: "remove 'open - close'
  // labels"). The word was a caption for a picture that already says it: the
  // door is visibly apart or visibly together, ions are visibly going through
  // or visibly not, and the arrow is drawn only when there is a way for it to
  // point along. A word that repeats the picture is not a reading, it is
  // noise — and it was the only thing on the canvas competing with the door.
}
