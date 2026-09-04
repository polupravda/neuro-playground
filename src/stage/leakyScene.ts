import {
  BARE_WALL,
  WRAPPED_WALL,
  holeExposed,
  holePlaces,
  sleeveSpans,
  lambdaUm,
  pulseAt,
  sparkAt,
  survivesAt,
} from '../core/leaky'
import { GLOSSY_COLORS } from './particleStyle'
import { AXON_VIEW_SCALE, AXON_W, STAGE_H, STAGE_W } from './layout'
import { flowAt, flowFade, flowSpread } from '../core/ionFlow'
import {
  OUTSIDE_H,
  atMid,
  drawOutside,
  drawSheathBands,
  drawScaleRuler,
  drawTube,
  DOOR_HALF_HEIGHT,
  signalAura,
  ribbonGeometry,
  wallY,
} from './axonRibbon'
import { SIGNAL_CORE, SIGNAL_RGB, softGlow } from './signal'
import { spoken, drawSpoken, type SpokenLabel } from './spokenLabels'
import { drawLeakChannel } from './leakChannel'

// The nodes and sleeves are the MODEL's (see `core/leaky`): a node IS one of
// the holes, so the two cannot be worked out separately and come to disagree.
export { nodePlaces, sleeveSpans } from '../core/leaky'

// D05's face — how far a signal reaches, and what decides.
//
// One fibre, seen from the side, with a voltage pushed in at the left end. The
// glow inside it fades along its length because charge is leaking out through
// the wall the whole way, and λ is marked where it has faded to a third.
//
// ⚠ THE FIBRE IS THE HOSE (user, 2026-08-30). A garden hose with holes in it
// was the other option and was turned down: this app reuses its own pictures
// rather than inventing a second one for the same idea, and the analogy lives
// in the words where an analogy belongs.

// ⚠ THIS IS A PLACE ON THE CELL NOW, NOT A DRAWER (user, 2026-08-31: "you've
// placed the bench in the drawer. Instead, let's follow 'Axonal conduction and
// myelin' pattern, and add another entry point: magnifying glass on the 'big
// neuron'").
//
// Which settles three complaints with one move. A drawer covers the column, so
// the whole-cell miniature had to be redrawn on the canvas to say where we
// were — a picture the app already has, in the place the app already keeps it.
// A drawer's chrome is DOM around a canvas, so the controls sat outside the
// picture instead of on it. And the exhibit is a stretch of axon, which by this
// app's own placement law is a PLACE.
//
// ⚠ It is also a comparison, and the written rule sent comparisons to drawers.
// The rule was already out of step with the app: *Axonal conduction & myelin*
// compares two fibres and has always been a place. The rule now says what the
// app does — see 03-architecture, *Where a concept lives*.

export const LK_W = STAGE_W
/** How far an escaping ion gets before it is lost in the bath. */
export const LEAK_REACH = 54
/** How many are in the air out of one hole at full leak, and how wide the
 *  little plume opens. The flow model is the app's own — a current leaving
 *  through a hole is the same drawing as a current crossing a channel. */
const LEAK_IONS = 5
const LEAK_FAN = 9
/** How fast they drift, ms per journey. */
const LEAK_MS = 900

/** ⚠ ROOM FOR THE ESCAPING CHARGE, taken from how far it gets rather than
 *  chosen: a pipe with less margin than this clips its own leak. */
const LANE_MARGIN = LEAK_REACH + 16
/** Clear space between the two pipes, so neither one's flashes reach the
 *  other's wall. */
const BETWEEN_LANES = 30

/** How much of the stage the control pill takes off the top before the pipes
 *  are laid out — the axon view's own floating control, same height, same
 *  place. The picture must not be centred underneath it. */
export const CONTROL_ROW = 58

/** ⚠ THE AXON VIEWS' DISTANCE SCALE, kept (user, 2026-08-31: "use the layout
 *  seen on 'Axonal conduction and myelin' view"). Every axon view in this app
 *  puts a ruler on its floor, and this one — the only view whose whole point is
 *  HOW FAR — had none, so λ was a mark at an unlabelled place. Room for it at
 *  the foot, taken out before the pipes are centred. */
const RULER_FLOOR = 34

export const LK_H = STAGE_H

/** How much fibre is on stage, µm. Fixed, and wide enough to hold a
 *  myelinated λ — a span that rescaled itself as the wall changed would hide
 *  the very comparison this exhibit is for. */
export const SPAN_UM = 3000

/** ⚠ THE AXON VIEWS' OWN AXON, to the pixel (user, 2026-08-31: "the axons look
 *  much slimmer… using same images is better for recognition, unify"). This
 *  bench had picked 54 px where the race draws 86 — the same fibre at two
 *  thicknesses is two fibres as far as recognising it goes. */
const TUBE_PX = AXON_W * AXON_VIEW_SCALE
const INK = 'rgba(148, 163, 184, 0.85)'

/** The two pipes, bare above and wrapped below — the race view's own layout.
 *  ⚠ ONE source for the drawing AND the hit tests: a control that answers
 *  somewhere other than where its thing is drawn is the oldest bug in this
 *  file's family. */
export function lanes() {
  const base = ribbonGeometry(LK_W, LK_H, TUBE_PX)
  // ⚠ THE TWO PIPES, CENTRED, WITH ROOM TO FLASH INTO (user, 2026-08-31:
  // "give bigger margin on top and bottom of both axons").
  //
  // `raceLayout` builds its lanes UP from the ruler on the canvas floor, which
  // is right for the race — every axon view puts its ruler in the same place —
  // and wrong here, where there is no ruler and the whole block should sit in
  // the middle. Asking it for taller lanes just pushed everything up: measured,
  // 331 px of nothing above the top pipe against 121 below.
  //
  // The pipe itself is still the axon views' (`atMid` + `drawTube`); only
  // where the two sit is this bench's own business.
  const half = base.tubeHalf + LANE_MARGIN
  const block = half * 4 + BETWEEN_LANES
  // ⚠ CENTRED IN WHAT IS THE PICTURE'S: the control pill floats over the top
  // of the stage and the ruler sits on the floor, so the pipes are centred in
  // what is left rather than in the whole canvas.
  const top = CONTROL_ROW + (LK_H - CONTROL_ROW - RULER_FLOOR - block) / 2
  return [
    { geo: atMid(base, top + half), wall: BARE_WALL },
    { geo: atMid(base, top + half * 3 + BETWEEN_LANES), wall: WRAPPED_WALL },
  ]
}




/** Where the ruler sits, and the marks on it — whole half-millimetres across
 *  the 3 mm on stage. Exported so a test can put a mark where it claims to be. */
export const RULER_Y = LK_H - RULER_FLOOR + 8

export function rulerTicks(): { x: number; label: string }[] {
  const geo = lanes()[0].geo
  const out: { x: number; label: string }[] = []
  for (let um = 0; um <= SPAN_UM; um += 500) {
    out.push({ x: xOnLane(geo, um), label: `${um / 1000} mm` })
  }
  return out
}

/** Where a distance along the fibre falls on a lane, in px. */
export function xOnLane(geo: { left: number; right: number }, um: number): number {
  return geo.left + (Math.max(0, Math.min(SPAN_UM, um)) / SPAN_UM) * (geo.right - geo.left)
}

/** The holes, as fractions along the fibre — the SAME in both pipes, because
 *  they are the same membrane. Myelin covers most of them; it does not take
 *  any away. */
export function doorsAt(): number[] {
  return holePlaces()
}

const LAMBDA_TERM = 'length constant'

export function leakyLabels(): SpokenLabel[] {
  // ⚠ ABOVE THE λ AND CLEAR OF THE FIBRE (user, 2026-08-31: "'length constant'
  // label is placed on the axon body. Place it outside of the axon, above the
  // gamma letter"). It sat on the tube, where this app's own rule says only
  // names and readings belong — and a word lying across the thing it names is
  // the hardest place to read it.
  const bare = lanes()[0]
  const x = xOnLane(bare.geo, lambdaUm(bare.wall))
  return [
    spoken(
      LAMBDA_TERM,
      // Centred over the λ mark: the glyph hangs 18 px left of the anchor and
      // the word runs right of it, so the anchor is not the middle.
      x - (LAMBDA_TERM.length * 6.2 - 18) / 2,
      bare.geo.tubeMid - bare.geo.tubeHalf - OUTSIDE_H - 32,
    ),
  ]
}


// ⚠ NO LOCATOR ON THE CANVAS (user, 2026-08-31: "small neuron is placed on the
// canvas. Should be placed in the same location as across the app").
//
// There WAS one here, drawn top-left, and it was the right answer to the wrong
// question: a drawer covers the column, so the exhibit had to redraw the map
// the app already keeps. Now that this is a place rather than a drawer, the
// column is on screen and its permanent miniature is doing its job — with the
// dashed ring on this view's own zoom target, which is exactly the app's rule.

export function drawLeaky(
  ctx: CanvasRenderingContext2D,
  u: number | null,
  ms: number,
  /** How far this view has arrived, 0→1 — the same gate every view of its own
   *  gets, in decades, from either side. The scene underneath is given the
   *  SAME number as its own opacity, so exactly one axon is ever on screen. */
  fade = 1,
): void {
  // ⚠ NO clearRect. Konva clears a layer before drawing its children, and a
  // shape that wipes the canvas erases whatever sibling drew before it rather
  // than tidying up after itself — the bug that cost this app a day on the
  // axon layer. This view owns its layer and clears nothing.
  if (fade <= 0.002) return
  ctx.save()
  // ⚠ MULTIPLY, NEVER ASSIGN — the whole view's arrival rides on this, and an
  // assignment further in would wipe it (see the note in `strictCanvas` on
  // `alphas`). Everything below it multiplies for the same reason.
  ctx.globalAlpha *= fade

  // ⚠ THIS IS THE RACE VIEW'S PIPE, not a second drawing of an axon (user,
  // 2026-08-30: "use this view, do not reinvent"). `ribbonGeometry` +
  // `raceLayout` + `drawTube` are the axon views' own, so the wobbling
  // outline, the rounded sealed ends and the bath either side all come for
  // free — and cannot drift from the fibre the rest of the app draws.
  const pulse = u === null ? null : pulseAt(u)

  for (const lane of lanes()) {
    const geo = lane.geo
    const lambda = lambdaUm(lane.wall)

    drawOutside(ctx, geo)
    // How much of the push is still here — the cable's own exponential, fed to
    // the axon views' own tube as its heat. Before a race is run the pipe
    // shows what it WOULD hold, dimmed, so it is never a blank.
    drawTube(ctx, geo, (p) =>
      pulse === null ? 0 : p <= pulse ? survivesAt(lane.wall, p * SPAN_UM) * 0.95 : 0,
    )
    // ⚠ THE HOLES GO DOWN BEFORE THE SLEEVES, so the sleeves can cover them
    // (user, 2026-08-31: "on myelinated axons, there are ghost channels
    // 'under' myelin layers. Remove them or make invisible").
    //
    // They were drawn AFTER the sheath and faded to 28% — so they were not
    // under anything, they were painted on top of the myelin at low opacity,
    // which is precisely what a ghost is. Putting them down first lets the
    // sleeve occlude them the way a real sheath occludes a real channel: no
    // alpha trick, nothing hovering, and the anatomy still true — a covered
    // channel is still there, it simply cannot be seen or leak.
    //
    // The ones at nodes sit in the gaps, so nothing paints over them.
    for (const place of doorsAt()) {
      const x = xOnLane(geo, place * SPAN_UM)
      for (const side of [-1, 1] as const) {
        ctx.save()
        ctx.translate(x, wallY(geo, x, side))
        drawLeakChannel(ctx, {
          cx: 0,
          midY: 0,
          halfHeight: DOOR_HALF_HEIGHT,
          species: GLOSSY_COLORS.k.mid,
          speciesDark: GLOSSY_COLORS.k.dark,
        })
        ctx.restore()
      }
    }


    if (lane.wall.myelin) drawSheathBands(ctx, geo, sleeveSpans())

    // WHAT IS GETTING OUT, over everything — the escaping light has to cross
    // the sleeve's own thickness to reach the water, so it cannot be painted
    // under it.
    if (pulse !== null) {
      for (const place of doorsAt()) {
        if (!holeExposed(lane.wall, place)) continue
        const spark = sparkAt(lane.wall, place, pulse)
        if (spark < 0.02) continue
        const x = xOnLane(geo, place * SPAN_UM)
        for (const side of [-1, 1] as const) {
          // ⚠ WHAT LEAVES IS MADE OF THE SIGNAL (user, 2026-08-31: "a better
          // relation visually between the signal and the leaking signal").
          // Drawn as purple potassium the two were unrelated pictures, with
          // nothing to say one caused the other. What escapes IS the signal —
          // the charge that was carrying it — so it leaves wearing the
          // signal's own light, out of a blob that visibly shrinks as it goes.
          //
          // What makes this NOT the axon views' node burst, which means
          // "rebuilt here", is that it MOVES AWAY.
          const wy = wallY(geo, x, side)
          for (const bit of flowAt(spark, ms / LEAK_MS + place * 7, LEAK_IONS)) {
            const out = bit.progress * LEAK_REACH
            const bx = x + flowSpread(bit) * LEAK_FAN
            const by = wy + side * out
            const fade = flowFade(bit) * Math.min(1, spark * 1.6)
            softGlow(ctx, bx, by, 9 + 7 * fade, SIGNAL_RGB, 0.7 * fade)
            ctx.save()
            ctx.globalAlpha *= fade
            ctx.fillStyle = SIGNAL_CORE
            ctx.beginPath()
            ctx.arc(bx, by, 2.4, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }
        }
      }
    }

    // ⚠ AXIAL RESISTANCE, drawn as what it is: the inside is a POOR WIRE, so
    // the push has to fight its way along. A row of kinks down the middle that
    // the charge visibly gets past, one after another.
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)'
    ctx.lineWidth = 1.4
    const kinks = 26
    for (let i = 1; i < kinks; i++) {
      const p = i / kinks
      const x = geo.left + p * (geo.right - geo.left)
      const h = geo.tubeHalf * 0.42
      const wob = Math.sin(i * 2.3 + geo.tubeMid) * 3
      ctx.beginPath()
      ctx.moveTo(x - 4, geo.tubeMid - h + wob)
      ctx.lineTo(x + 4, geo.tubeMid + wob)
      ctx.lineTo(x - 4, geo.tubeMid + h + wob)
      ctx.stroke()
    }

    // ⚠ NO STANDING LIGHT AT THE INLET (user, 2026-08-31: "at the start, there
    // are static yellow lights. Remove them").
    //
    // Each pipe wore a pulsing glow at its left end whether or not anything
    // was running — and this app has just settled that a bright thing SITTING
    // STILL means "the signal is here", which at an idle inlet is untrue. The
    // signal arriving is the signal starting at the left; nothing needs to
    // mark the spot in advance.
    if (pulse !== null) {
      // ⚠ THE APP'S OWN SIGNAL, at the app's own size (user, 2026-08-31: "we
      // display a very bright signal, as you see it in 'Axonal conduction and
      // myelin'"). `signalAura` is the glow the axon views put on a lit
      // stretch — five times the tube's half-height — where this had been
      // drawing its own at two and a half, a dimmer thing in the same colour.
      //
      // Its brightness is how much of the push is LEFT, so the blob visibly
      // dies away along the bare pipe and stays lit along the wrapped one.
      // That shrinking, and the bits streaming out of every hole behind it,
      // are the same fact drawn twice — which is what makes one the reason for
      // the other.
      const left = survivesAt(lane.wall, pulse * SPAN_UM)
      const px = xOnLane(geo, pulse * SPAN_UM)
      signalAura(ctx, geo, px, Math.pow(left, 0.5))
      softGlow(ctx, px, geo.tubeMid, geo.tubeHalf * (1 + 1.2 * left), SIGNAL_RGB, 0.75 * left)
      ctx.save()
      ctx.globalAlpha *= left
      ctx.fillStyle = SIGNAL_CORE
      ctx.beginPath()
      ctx.arc(px, geo.tubeMid, 4 + 5 * left, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // λ, on the pipe it belongs to.
    const lx = xOnLane(geo, lambda)
    ctx.strokeStyle = '#fca5a5'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(lx, geo.tubeMid - geo.tubeHalf - OUTSIDE_H)
    ctx.lineTo(lx, geo.tubeMid + geo.tubeHalf + OUTSIDE_H)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#fca5a5'
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`λ = ${Math.round(lambda)} µm`, lx, geo.tubeMid - geo.tubeHalf - OUTSIDE_H - 6)

    ctx.fillStyle = INK
    ctx.font = '12px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(
      lane.wall.myelin ? 'wrapped in myelin' : 'bare',
      geo.left,
      geo.tubeMid + geo.tubeHalf + OUTSIDE_H + 14,
    )
  }

  const floor = lanes()[0].geo
  ctx.font = '11px system-ui, sans-serif'
  drawScaleRuler(ctx, floor.left, floor.right, RULER_Y, rulerTicks())

  for (const l of leakyLabels()) drawSpoken(ctx, l)
  ctx.restore()
}
