import { drawLeakChannel } from './leakChannel'
import {
  HALF_MEM,
  HEAD_R,
  HEAD_GAP,
  PX_PER_NM,
  drawLipids,
  mix,
  CHANNEL_MID,
  CHANNEL_DARK,
  LIPID_HEAD_LIGHT,
  LIPID_HEAD_MID,
  LIPID_HEAD_DARK,
} from './bilayer'
import { PX_PER_UM } from './layout'
import {
  drawGlossyIon,
  drawIonCharge,
  drawChargeDot,
  glossySphere,
  badgeMinR,
  GLOSSY_COLORS,
} from './particleStyle'
import { ELEMENT_COLOR } from './lipidLabScene'
import { drawTraveller, TRAVELLER_MAG } from './permeaScene'
import { spoken, drawSpoken, drawConnector, type SpokenLabel } from './spokenLabels'
import { IONS } from '../core/ions'
import {
  FILTER_NM,
  FILTER_SITES,
  SENSOR_CHARGES,
  SUBUNITS,
  filterVerdict,
} from '../core/channelStructure'

// D03 — the channel, cut open and looked down.
//
// Two pictures of ONE object, side by side, with the app's own marker grammar
// joining them: a dashed amber box round the filter in the side view, and the
// top view is what you see looking down through that box.

const VIEW_W = typeof window !== 'undefined' ? Math.min(window.innerWidth, 1376) : 1280
const VIEW_H = typeof window !== 'undefined' ? window.innerHeight : 860
// Capped the way the drawer is (86rem): measuring against the raw viewport
// makes the panels wider than what holds them on a wide screen.
const DRAWER_W = Math.min(VIEW_W, 1376)
const CONTENT_W = Math.max(700, DRAWER_W - 40 - 256 - 24 - 12)
// The drawer is h-screen with p-5 and the grid adds pt-2, so what the column
// really has is VIEW_H − 48. It was measured 56 px more cautiously than that
// and the panels were leaving a band of the drawer empty (2026-08-28); the
// 8 px that is left is the safety margin.
const CONTENT_H = Math.max(540, VIEW_H - 48 - 8)
const PANEL_PAD = 20

/** Both panels are drawn to ONE ruler, the membrane's own. */
export const CH_SCALE = 6
export const TOP_W = Math.round((CONTENT_W - PANEL_PAD * 2 - 16) * 0.38)
export const SIDE_W = Math.round(CONTENT_W - PANEL_PAD * 2 - 16 - TOP_W)
/** The size-key strip above the two panels, and the room it needs. The
 *  panels have to be measured AROUND it or they run off the bottom of the
 *  drawer, which is exactly what happened when the key was first added
 *  (2026-08-28). */
export const KEY_H = 124
/** Everything the right-hand column stacks must fit inside this. */
export const CH_BUDGET = CONTENT_H
export const CH_H = Math.round(CONTENT_H - PANEL_PAD - KEY_H - 8)
export const CH_MAG = Math.round((CH_SCALE * PX_PER_NM) / (PX_PER_UM / 1000))

/** Logical (pre-scale) sizes. */
const sideW = SIDE_W / CH_SCALE
const sideH = CH_H / CH_SCALE
const topW = TOP_W / CH_SCALE
const topH = CH_H / CH_SCALE

/** The control pill floats over the top of the side panel (the ⚡ button's
 *  grammar), so the drawing is pushed down out from under it rather than
 *  drawn behind it — labels vanishing under a button is not a layout. */
const CTRL_BAND = 64

/** The membrane runs across the middle of the side view, less that band. */
export const WALL_Y = Math.round(sideH * 0.5 + (CTRL_BAND / CH_SCALE) * 0.62)
export const CH_X = Math.round(sideW * 0.5)

/** Half-width of the protein where it is widest, logical px. A Kv channel is
 *  about 6 nm across its transmembrane part. */
/** Half-width of the protein where it is widest. Widened from 3 nm to 3.7
 *  (2026-08-28) to make room for the third helix a side that was missing —
 *  and it is the more honest number anyway: a Kv channel's pore module is
 *  about 6 nm across and the whole thing, sensors included, is wider still. */
const HALF_W = 3.7 * PX_PER_NM
/** The filter sits at the OUTSIDE end of the pore. */
export const FILTER_Y = WALL_Y - HALF_MEM * 0.55
const FILTER_HALF = (FILTER_NM / 2) * PX_PER_NM
/** The gate, where the four subunits cross, at the inside end. */
const GATE_Y = WALL_Y + HALF_MEM * 0.8
const MOUTH_HALF = 1.1 * PX_PER_NM

// ── The try-it run ─────────────────────────────────────────────────────────

export type TryKind = 'na' | 'k'
/** Model ms for one attempt at the filter. */
export const TRY_MS = 3200

export interface TryState {
  kind: TryKind
  /** Clock ms when the attempt began. */
  startedMs: number
}

export interface TryPose {
  /** Where the ion is, logical px. */
  y: number
  /** Once it is through: how far out of the pore it has come, 0→1. The top
   *  view uses it to swell the ion and drift it away. */
  emerge: number
  /** How much of its water coat it still wears, 1 → 0. */
  coat: number
  /** Whether it has been turned back and is on its way out. */
  leaving: boolean
  done: boolean
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Where the tried ion is, and how dressed, at this moment.
 *
 *  Potassium: comes up the pore, meets the filter, TRADES its coat for the
 *  filter's oxygens, and files through. Sodium: comes up, meets the filter,
 *  cannot be paid for its coat, and is turned back still wearing it. Pure in
 *  (state, ms), so a test can walk the whole attempt. */
export function tryPoseAt(s: TryState, ms: number): TryPose {
  const t = clamp01((ms - s.startedMs) / TRY_MS)
  const from = WALL_Y + HALF_MEM * 1.9
  const meet = FILTER_Y + FILTER_HALF * 2.4
  const out = WALL_Y - HALF_MEM * 2.1
  const through = filterVerdict(s.kind) === 'through'
  // Leg 1: the approach, always the same for both — which is the point.
  if (t < 0.34) {
    return {
      y: from + (meet - from) * (t / 0.34),
      emerge: 0,
      coat: 1,
      leaving: false,
      done: false,
    }
  }
  // Leg 2: at the filter, where the two stories part.
  if (t < 0.62) {
    const u = (t - 0.34) / 0.28
    return through
      ? {
          y: meet - (meet - FILTER_Y) * u,
          emerge: 0,
          coat: 1 - u,
          leaving: false,
          done: false,
        }
      : // Sodium presses in, holds its coat, and is pushed back out.
        {
          y: meet - FILTER_HALF * 0.8 * Math.sin(Math.PI * u),
          emerge: 0,
          coat: 1,
          leaving: false,
          done: false,
        }
  }
  // Leg 3: away — through and out, or back the way it came.
  const u = (t - 0.62) / 0.38
  return through
    ? {
        y: FILTER_Y + (out - FILTER_Y) * u,
        emerge: u,
        coat: 0,
        leaving: false,
        done: t >= 1,
      }
    : { y: meet + (from - meet) * u, emerge: 0, coat: 1, leaving: true, done: t >= 1 }
}

/** A name out on the canvas's own background, with a line reaching in to the
 *  thing it names. Labels used to sit against the structure and collided with
 *  it (2026-08-28); a name that overlaps what it is naming is worse than no
 *  name, because the reader has to unpick which ink is which. */
interface SideLabel {
  label: SpokenLabel
  /** Where the leader lands, in logical coordinates. */
  target: { x: number; y: number }
}

const MARGIN = 18
/** A right-aligned name puts its speaker glyph to the RIGHT of the anchor, so
 *  the anchor has to sit further in than the margin — which is exactly why
 *  these were cropped at the border (2026-08-28). */
const RIGHT_ANCHOR_PAD = 28
/** The schematic gate's box in the corner — the lipid lab's inset, here. */
const INSET_W = 78
const INSET_H = 66

export function sideLabelPlan(): SideLabel[] {
  return [
    {
      // High and clear of the top edge; its leader does the reaching.
      label: spoken(
        'selectivity filter',
        SIDE_W - MARGIN - RIGHT_ANCHOR_PAD,
        (WALL_Y - HALF_MEM) * CH_SCALE - 26,
        'right',
      ),
      target: { x: CH_X + FILTER_HALF + 3.4, y: FILTER_Y - FILTER_HALF },
    },
    {
      label: spoken('gate', MARGIN + 18, (GATE_Y + 2) * CH_SCALE + 20),
      target: { x: CH_X - MOUTH_HALF * 1.2, y: GATE_Y },
    },
    {
      // The short slanted one that does not cross the membrane, named because
      // it is the piece the drawing was missing and the piece that explains
      // why the middle of the wall is habitable for a plus (2026-08-28).
      label: spoken('pore helix', MARGIN + 18, (WALL_Y - HALF_MEM * 0.1) * CH_SCALE),
      target: { x: CH_X - (FILTER_HALF + 1.6), y: FILTER_Y + HALF_MEM * 0.4 },
    },
    {
      // The chain that becomes the filter, named where it arches out of the
      // membrane — so the filter can be traced back to the protein it is part
      // of rather than read as a separate gadget (2026-08-28).
      label: spoken('pore loop', MARGIN + 18, (WALL_Y - HALF_MEM) * CH_SCALE - 60),
      target: { x: CH_X - (FILTER_HALF + 1.0), y: WALL_Y - HALF_MEM - 0.7 * PX_PER_NM },
    },
    {
      label: spoken('voltage sensor', MARGIN + 18, (WALL_Y - HALF_MEM) * CH_SCALE - 20),
      target: { x: CH_X - HALF_W - 0.7 * PX_PER_NM, y: WALL_Y - HALF_MEM * 0.5 },
    },
    {
      // …and this one low, so the two right-hand names cannot collide.
      label: spoken(
        'pore',
        SIDE_W - MARGIN - RIGHT_ANCHOR_PAD,
        (WALL_Y + HALF_MEM) * CH_SCALE + 34,
        'right',
      ),
      target: { x: CH_X + MOUTH_HALF * 0.5, y: (FILTER_Y + GATE_Y) / 2 },
    },
    {
      // Named, because a ring of somethings round an ion means nothing until
      // it is called what it is (2026-08-28).
      label: spoken('water coat', MARGIN + 18, (WALL_Y + HALF_MEM) * CH_SCALE + 46),
      target: { x: CH_X - 2.2, y: WALL_Y + HALF_MEM * 1.7 },
    },
  ]
}

/** The way in to D15: a magnifier sitting beside the filter, because the
 *  filter is where the close-up is OF. Spatial navigation — you get to
 *  another view by going to the place on the object, never by picking a page
 *  out of a list. */
export function filterZoomChip(): { cx: number; cy: number; r: number } {
  return {
    cx: (CH_X + FILTER_HALF + 6.4) * CH_SCALE,
    cy: FILTER_Y * CH_SCALE,
    r: 17,
  }
}

export function filterZoomChipAt(x: number, y: number): boolean {
  const c = filterZoomChip()
  return Math.hypot(x - c.cx, y - c.cy) <= c.r
}

/** THE ONE MAGNIFIER, drawn the same everywhere (2026-08-28).
 *
 *  A door that opens another view wears this and nothing else: a round dark
 *  plate with the amber ring this app uses for "there is more of this to see",
 *  and a lens inside it. It was a rounded rectangle here and a bare lens on
 *  the spike bench's probe, which meant the two doors did not look like the
 *  same kind of thing — and a child learns an affordance once or not at all.
 *  Round, because a lens is round. */
export function drawMagnifier(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.save()
  ctx.fillStyle = 'rgba(2, 6, 23, 0.92)'
  ctx.strokeStyle = RING
  ctx.lineWidth = Math.max(1.4, r * 0.1)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.lineWidth = Math.max(1.4, r * 0.11)
  ctx.beginPath()
  ctx.arc(cx - r * 0.1, cy - r * 0.1, r * 0.4, 0, Math.PI * 2)
  ctx.moveTo(cx + r * 0.18, cy + r * 0.18)
  ctx.lineTo(cx + r * 0.52, cy + r * 0.52)
  ctx.stroke()
  ctx.restore()
}

/** The protein's mass, painted as a radial fade squashed into an ellipse.
 *
 *  ⚠ THE GRADIENT IS BUILT INSIDE THE TRANSFORM IT IS FILLED IN, and that is
 *  the whole reason this is a function (2026-08-28). A canvas gradient is
 *  resolved in USER SPACE at fill time, not where it was created. The side
 *  view built one around the body's centre and THEN translated the context to
 *  that centre before filling, which threw the gradient's origin out to twice
 *  the distance — so the ellipse was painted entirely from the transparent
 *  tail and the body was very nearly invisible. Three rounds of "the aura is
 *  not purple" chased the COLOUR; the colour was never being drawn.
 *
 *  One copy, used by both views, because a second copy of a fixed bug is a
 *  bug that comes back — and because two pictures of one object have to share
 *  the profile as well as the colour.
 *
 *  `squash` is the vertical scale: 1 for a circle. */
export function paintChannelBody(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  squash: number,
): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1, squash)
  const body = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r)
  body.addColorStop(0, `rgba(${BODY_RGB}, 0.95)`)
  body.addColorStop(0.66, `rgba(${BODY_RGB}, 0.78)`)
  body.addColorStop(0.88, `rgba(${BODY_RGB}, 0.34)`)
  body.addColorStop(0.95, `rgba(${BODY_RGB}, 0.12)`)
  // …to nothing at the rim, in EVERY direction: a protein has no edge, it
  // meets the lipids.
  body.addColorStop(1, `rgba(${BODY_RGB}, 0)`)
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function sideLabels(): SpokenLabel[] {
  return sideLabelPlan().map((l) => l.label)
}

// ── Drawing ────────────────────────────────────────────────────────────────
//
// Two registers in one exhibit, and the layout is the lipid lab's (2026-08-28,
// the user's own instruction): the REALISTIC structure fills the big panel,
// and the SCHEMATIC gate — the little bronze door this app draws everywhere
// else — sits in a small amber box in the corner, joined to it by wide dashed
// lines. Same "that shape IS this thing" grammar, one level down.
//
// The realistic drawing follows two published figures the user supplied: a
// teepee of coiled ribbon helices with the selectivity filter drawn atom by
// atom between them, and, looking down the pore, four helices in a pinwheel
// with the ion at their centre. One deliberate departure, ruled by the user:
// the atoms keep THIS APP'S molecular palette rather than the figures' CPK,
// because red and sky mean charge here and nothing else.

const LABEL = '#cbd5e1'
const RING = '#f59e0b'
/** The protein, in the app's own protein bronze, cooled toward potassium. */
export const HELIX_LIGHT = mix(
  mix(CHANNEL_MID, GLOSSY_COLORS.k.mid, 0.18),
  '#ffffff',
  0.32,
)
export const HELIX_MID = mix(CHANNEL_MID, GLOSSY_COLORS.k.mid, 0.18)
export const HELIX_DARK = mix(
  mix(CHANNEL_DARK, GLOSSY_COLORS.k.dark, 0.15),
  '#ffffff',
  0.2,
)
const OXY = ELEMENT_COLOR.O
/** The protein's own body — the mass the helices are packed into. Drawn
 *  behind them in both views so there are no see-through gaps, and faded at
 *  the edges because a protein has no rim, it meets the lipids.
 *
 *  Deliberately DARKER than the darkest turn of a helix (2026-08-28): it was
 *  the same bronze, and a coil's shadow side vanished into it.
 *
 *  And VIOLET, because the schematic gate beside it is violet: this app tints
 *  every channel with the species it passes, and a potassium channel is a
 *  potassium channel in both registers or the two pictures are not obviously
 *  the same object (user, 2026-08-28). The helices keep protein bronze, so the
 *  body reads as the mass they sit in rather than as more helix. */
// Back to the potassium-derived plum, confirmed by the user 2026-08-28 after
// a round of it being pushed to violet-700. The colour is a mix of the
// channel's own bronze with potassium's blue, and that provenance is the
// point: this app tints every channel with the species it passes, so a
// potassium channel carries potassium's colour in both registers. A brighter,
// purer violet reads more obviously as purple and says less.
//
// ONE colour, in BOTH views. The side view and the top view are two pictures
// of one object, and an object does not change colour when you walk round it.
export const BODY_RGB = '68, 40, 104'
/** How many waters are drawn clinging to an ion. A real shell round sodium or
 *  potassium holds about six, and six is what fits round a circle legibly. */
export const WATERS_IN_COAT = 6
/** The permeability bench magnifies its travellers ×2 and says so; this view
 *  draws everything at true size, so its water is asked for at 1/that. */
const TRUE_SIZE = 1 / TRAVELLER_MAG
const CARB = ELEMENT_COLOR.C

/** One α-helix as a coiled ribbon: the turns that face us are drawn light and
 *  thick, the ones behind dark and thin, which is the whole of why a flat
 *  drawing of a coil reads as a coil. */
function helixRibbon(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width: number,
  turns: number,
): void {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len
  const py = dx / len
  const N = Math.max(24, Math.round(turns * 14))
  const at = (t: number, phase: number) => {
    const th = Math.PI * 2 * turns * t + phase
    return {
      x: ax + dx * t + px * Math.sin(th) * width * 0.5,
      y: ay + dy * t + py * Math.sin(th) * width * 0.5,
      face: Math.cos(th),
    }
  }
  ctx.lineCap = 'round'
  for (const pass of [0, 1]) {
    for (let i = 0; i < N; i++) {
      const a = at(i / N, 0)
      const b = at((i + 1) / N, 0)
      const face = (a.face + b.face) / 2
      const front = face > 0
      if ((pass === 0) === front) continue
      ctx.strokeStyle = front
        ? mix(HELIX_LIGHT, HELIX_MID, 1 - Math.abs(face))
        : mix(HELIX_DARK, HELIX_MID, 1 - Math.abs(face))
      ctx.lineWidth = width * (0.34 + 0.3 * Math.abs(face))
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  }
}

/** THE HELICES ARE ONE STRING (2026-08-28, user: "in the textbook they look
 *  connected by a string").
 *
 *  A subunit is a single polypeptide chain, not a bundle of separate sticks,
 *  and drawing six free-floating ribbons says the opposite of the truth. The
 *  loops matter for more than tidiness: the one between the fifth and sixth
 *  helices is not a linker at all — it dips back INTO the membrane and its
 *  backbone oxygens are the selectivity filter. The filter is a piece of the
 *  chain, so it has to be drawn joined to the chain.
 *
 *  Loops go on BEFORE the helices, so a helix always sits in front of the
 *  string that runs into it. */
function chainLoop(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  c1x: number,
  c1y: number,
  c2x: number,
  c2y: number,
  width: number,
  colour: string,
): void {
  ctx.strokeStyle = colour
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.bezierCurveTo(c1x, c1y, c2x, c2y, bx, by)
  ctx.stroke()
}

/** The filter's own atoms: two walls of backbone with their carbonyl oxygens
 *  turned inward, drawn in the app's molecular palette. */
function filterAtoms(ctx: CanvasRenderingContext2D, grip = 0): void {
  // `grip` is the exchange happening: as an ion sheds its water, the filter's
  // own oxygens close in and take the water's place. The words claimed a trade
  // and the drawing showed nothing being traded (user, 2026-08-28); this is
  // the trade.
  for (const sign of [-1, 1] as const) {
    const x = CH_X + sign * (FILTER_HALF + 0.9 - 0.45 * grip)
    for (let i = 0; i <= FILTER_SITES; i++) {
      const y = FILTER_Y - FILTER_HALF * 1.7 + (i * FILTER_HALF * 3.4) / FILTER_SITES
      // The backbone carbon, and the oxygen it points at the ion.
      ctx.strokeStyle = mix(CARB, '#0b1016', 0.15)
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(x + sign * 0.9, y - 0.9)
      ctx.lineTo(x, y)
      ctx.lineTo(x - sign * 0.8, y)
      ctx.stroke()
      glossySphere(ctx, x + sign * 0.9, y - 0.9, 0.55, CARB)
      if (grip > 0.05) {
        ctx.save()
        ctx.globalAlpha *= grip * 0.5
        ctx.fillStyle = OXY
        ctx.beginPath()
        ctx.arc(x - sign * 0.8, y, 0.55 + 0.5 * grip, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      glossySphere(ctx, x - sign * 0.8, y, 0.55 + 0.12 * grip, OXY)
    }
  }
}

export function drawSide(
  ctx: CanvasRenderingContext2D,
  tried: TryState | null,
  ms: number,
  labelsOn = true,
): void {
  ctx.save()
  ctx.scale(CH_SCALE, CH_SCALE)
  ctx.fillStyle = 'rgba(100, 116, 139, 0.05)'
  ctx.fillRect(0, 0, sideW, WALL_Y)
  ctx.fillStyle = 'rgba(100, 116, 139, 0.13)'
  ctx.fillRect(0, WALL_Y, sideW, sideH - WALL_Y)

  // The wall it is built into — this app's own bilayer, parted for it.
  drawLipids(ctx, {
    midY: WALL_Y,
    from: 0,
    to: sideW,
    gaps: [[CH_X - HALF_W - 1.2 * PX_PER_NM, CH_X + HALF_W + 1.2 * PX_PER_NM]],
  })

  // The teepee: four helices leaning together, wide at the inside face and
  // meeting under the filter — the shape that gives a potassium channel its
  // water-filled cavity halfway through the wall.
  const topY = WALL_Y - HALF_MEM * 0.9
  const botY = WALL_Y + HALF_MEM + 1.6 * PX_PER_NM

  // The body first, behind them: without it the spaces BETWEEN the helices
  // read as ways through, and a child asks why an ion bothers with the little
  // hole (the same fault the top view had, 2026-08-28). Faded at its edges,
  // because a protein meets the lipids rather than stopping at a line.
  const bodyCx = CH_X
  const bodyCy = WALL_Y + HALF_MEM * 0.15
  const bodyR = HALF_W + 2.2 * PX_PER_NM
  paintChannelBody(ctx, bodyCx, bodyCy, bodyR, (HALF_MEM * 2.1) / bodyR)

  const helixW = 1.5 * PX_PER_NM * 0.58
  for (const sign of [-1, 1] as const) {
    // THREE HELICES A SIDE, PLUS THE SENSOR (2026-08-28, the user, against
    // the textbook — and they were right).
    //
    // The classic cross-section of a potassium channel's pore module shows
    // three per subunit, and we drew two. Worse, the two we drew were
    // mislabelled: the outer one was called the voltage sensor (S4, which
    // belongs to a different domain) and the inner one was called the pore
    // helix (it is S6, which lines the pore). The actual pore helix — the
    // short slanted one that does not cross the membrane at all — was simply
    // absent, and it is not a detail: its far end points at the middle of the
    // wall, and that end is what makes the cavity a comfortable place for a
    // positive ion to sit halfway through a greasy membrane.
    //
    // So, from the outside in: S4 the sensor (standing for the whole
    // four-helix sensing domain, declared in the honesty note), S5 the outer
    // helix, the P helix tucked in behind, and S6 lining the way through.
    const sensorTop = {
      x: CH_X + sign * (HALF_W + 0.15 * PX_PER_NM),
      y: WALL_Y - HALF_MEM - 0.4 * PX_PER_NM,
    }
    const sensorBot = { x: CH_X + sign * (HALF_W + 0.5 * PX_PER_NM), y: botY }
    const outerTop = { x: CH_X + sign * (HALF_W - 1.0 * PX_PER_NM), y: topY }
    const outerBot = { x: CH_X + sign * (HALF_W - 0.55 * PX_PER_NM), y: botY }
    const innerTop = { x: CH_X + sign * (FILTER_HALF + 1.4), y: topY }
    const innerBot = { x: CH_X + sign * (MOUTH_HALF * 1.9), y: botY }
    // The pore helix: short, slanted, starting near the outer surface and
    // ending under the filter with its tip aimed at the axis.
    const pTop = {
      x: CH_X + sign * (FILTER_HALF + 3.9 * PX_PER_NM * 0.5),
      y: topY + 0.25 * PX_PER_NM,
    }
    const pBot = { x: CH_X + sign * (FILTER_HALF + 1.1), y: FILTER_Y + HALF_MEM * 0.62 }

    // The chain first, so every helix sits in front of the string it is part
    // of. Following it from the sensor: down and across the inside face to
    // S5, up S5, over the top to the pore helix, down into the wall, back up
    // as the FILTER, then down S6 and out into the cell.
    chainLoop(
      ctx,
      sensorBot.x,
      sensorBot.y,
      outerBot.x,
      outerBot.y,
      sensorBot.x,
      botY + 0.9 * PX_PER_NM,
      outerBot.x,
      botY + 0.9 * PX_PER_NM,
      helixW * 0.3,
      HELIX_MID,
    )
    chainLoop(
      ctx,
      outerTop.x,
      outerTop.y,
      pTop.x,
      pTop.y,
      outerTop.x,
      WALL_Y - HALF_MEM - 1.0 * PX_PER_NM,
      pTop.x,
      WALL_Y - HALF_MEM - 1.0 * PX_PER_NM,
      helixW * 0.3,
      HELIX_MID,
    )
    // The PORE LOOP proper: out of the pore helix's tip, up to the outer
    // surface, and back down into the filter. It is drawn brighter and a
    // little thicker because it is not a linker — its backbone oxygens ARE
    // the filter, and a child should be able to trace the filter back into
    // the chain with a finger.
    chainLoop(
      ctx,
      pBot.x,
      pBot.y,
      CH_X + sign * FILTER_HALF,
      FILTER_Y - FILTER_HALF * 0.6,
      pBot.x + sign * 0.8 * PX_PER_NM,
      WALL_Y - HALF_MEM - 0.8 * PX_PER_NM,
      CH_X + sign * (FILTER_HALF + 0.2 * PX_PER_NM),
      WALL_Y - HALF_MEM - 0.7 * PX_PER_NM,
      helixW * 0.42,
      HELIX_LIGHT,
    )
    chainLoop(
      ctx,
      CH_X + sign * (FILTER_HALF + 0.4),
      FILTER_Y - FILTER_HALF,
      innerTop.x,
      innerTop.y,
      CH_X + sign * (FILTER_HALF + 1.6),
      WALL_Y - HALF_MEM - 0.5 * PX_PER_NM,
      innerTop.x,
      topY - 0.6 * PX_PER_NM,
      helixW * 0.3,
      HELIX_MID,
    )

    // The pore helix goes on FIRST and a shade darker: it sits behind the
    // two that cross the membrane, which is where it really is.
    ctx.save()
    ctx.globalAlpha *= 0.82
    helixRibbon(ctx, pTop.x, pTop.y, pBot.x, pBot.y, helixW * 0.9, 2.5)
    ctx.restore()
    helixRibbon(ctx, sensorTop.x, sensorTop.y, sensorBot.x, sensorBot.y, helixW, 5)
    helixRibbon(ctx, outerTop.x, outerTop.y, outerBot.x, outerBot.y, helixW, 5)
    helixRibbon(ctx, innerTop.x, innerTop.y, innerBot.x, innerBot.y, helixW, 6)
  }

  // THERE IS NO DARK CAVITY DRAWN HERE ANY MORE (user, 2026-08-28: "remove
  // the hole completely").
  //
  // A dark wedge between the helices was doing more harm than good. Flat, it
  // read as a solid black shape painted onto the protein; shaded to look like
  // a recess, it read as a big open mouth — and either way it invited the one
  // question this drawer exists to kill: if there is a hole that size, why is
  // the channel picky at all? The truth is that a channel is a packed mass of
  // protein with a thread of water down the middle, far too narrow to draw at
  // this scale as a space. So the body simply continues, the helices sit in
  // it, and the only thing that marks the way through is what actually marks
  // it: the filter's atoms, and the ion travelling between them.

  filterAtoms(ctx, tried ? 1 - tryPoseAt(tried, ms).coat : 0)

  // The ion being tried.
  if (tried) {
    const pose = tryPoseAt(tried, ms)
    const ion = IONS[tried.kind]
    const bare = (ion.bareNm / 2) * PX_PER_NM
    const coatR = (ion.hydratedNm / 2) * PX_PER_NM
    if (pose.coat > 0.02) {
      // Its water coat — and it is drawn as WATER, the same molecule the
      // permeability bench fires at the wall, at its own true size.
      //
      // A ring of anonymous dots was tried first and the user could not tell
      // what it meant (2026-08-28), which is fair: this app had never drawn a
      // hydration shell, so a decoration round an ion referred to nothing the
      // child had seen. If a picture needs a new idea, the idea has to be
      // something they already know — here, water molecules — and it has to
      // be named. The dashed outline and the "water coat" label do the
      // naming; `drawTraveller` does the drawing, so the water in the two
      // drawers is one molecule.
      const r = bare + (coatR - bare) * pose.coat
      ctx.save()
      ctx.globalAlpha *= Math.min(1, pose.coat * 1.4)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)'
      ctx.lineWidth = 0.14
      ctx.setLineDash([0.9, 0.7])
      ctx.beginPath()
      ctx.arc(CH_X, pose.y, r + 0.9, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      for (let i = 0; i < WATERS_IN_COAT; i++) {
        const a = (Math.PI * 2 * i) / WATERS_IN_COAT - Math.PI / 2
        drawTraveller(
          ctx,
          'water',
          CH_X + Math.cos(a) * r,
          pose.y + Math.sin(a) * r,
          TRUE_SIZE,
        )
      }
      ctx.restore()
    }
    // The waters it TOOK OFF do not vanish — nothing in this app vanishes.
    // They fall back down the way the ion came and rejoin the water in the
    // cell, fading only once they are far enough down to be lost among the
    // rest (the same rule the pump's ions follow at the membrane view).
    const shed = 1 - pose.coat
    if (shed > 0.02 && !pose.leaving) {
      ctx.save()
      for (let i = 0; i < WATERS_IN_COAT; i++) {
        const a = (Math.PI * 2 * i) / WATERS_IN_COAT - Math.PI / 2
        const spread = coatR + shed * 3.2
        const fall = shed * shed * HALF_MEM * 2.6
        const x = CH_X + Math.cos(a) * spread
        const y = FILTER_Y + FILTER_HALF * 2.4 + Math.abs(Math.sin(a)) * 1.5 + fall
        ctx.globalAlpha =
          Math.max(0, 0.9 - shed * 0.55) * Math.max(0, 1 - fall / (HALF_MEM * 3))
        drawTraveller(ctx, 'water', x, y, TRUE_SIZE)
      }
      ctx.restore()
    }
    drawGlossyIon(ctx, tried.kind, CH_X, pose.y, bare)
    drawIonCharge(ctx, CH_X, pose.y, bare, ion.charge, undefined, badgeMinR(CH_SCALE))
  }
  ctx.restore()

  // The charges, as the badges everything else in this app wears.
  const badgeR = HEAD_R * CH_SCALE * 0.8
  for (const sign of [-1, 1] as const) {
    const x = (CH_X + sign * (HALF_W + 0.7 * PX_PER_NM)) * CH_SCALE
    for (let i = 0; i < SENSOR_CHARGES; i++) {
      const y =
        (WALL_Y - HALF_MEM * 0.62 + (i * HALF_MEM * 1.24) / (SENSOR_CHARGES - 1)) *
        CH_SCALE
      drawChargeDot(ctx, x, y, badgeR * 0.62, 1)
    }
  }
  // ONE minus per wall, not one per site (user, 2026-08-28) — and the science
  // agrees: what the lining carries is a partial negative smeared along it,
  // δ− on every carbonyl oxygen, not four separate charges to be counted. Four
  // badges implied four things; one says "this surface is negative", which is
  // the true claim and the readable one.
  for (const sign of [-1, 1] as const) {
    drawChargeDot(
      ctx,
      (CH_X + sign * (FILTER_HALF + 3.4)) * CH_SCALE,
      FILTER_Y * CH_SCALE,
      badgeR * 0.9,
      -1,
    )
  }

  // The magnifier that opens the close-up, on the filter itself.
  {
    const c = filterZoomChip()
    drawMagnifier(ctx, c.cx, c.cy, c.r)
  }

  // The schematic gate, in its own amber box in the corner, joined to the
  // realistic drawing by wide dashed lines: the lipid lab's exact pattern.
  const ix = SIDE_W - INSET_W - 10
  const iy = CH_H - INSET_H - 10
  ctx.save()
  ctx.translate(ix + INSET_W / 2, iy + INSET_H / 2)
  ctx.scale(1.15, 1.15)
  // ⚠ THE INSET IS THE SAME PROTEIN SMALL, NOT A CARTOON OF IT (user,
  // 2026-08-30). The pair is realistic-and-magnified, joined by dashed lines —
  // so a generic lobed shape in the amber box was the old "one silhouette for
  // every channel" hiding in a corner of a view whose whole subject is how
  // THIS channel is built. It is a potassium channel with no gate on it, so it
  // is the traced leak drawing, in potassium's purple.
  drawLeakChannel(ctx, {
    cx: 0,
    midY: 0,
    species: GLOSSY_COLORS.k.mid,
    speciesDark: GLOSSY_COLORS.k.dark,
  })
  ctx.restore()
  ctx.strokeStyle = RING
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  ctx.roundRect(ix, iy, INSET_W, INSET_H, 8)
  ctx.stroke()

  // …and the BIG half of the same relation. A magnification takes two frames
  // joined by connectors: the lipid lab has both, and this view had only the
  // little one, which said "that shape is a magnification of" and never
  // finished the sentence (2026-08-28).
  const fx = (CH_X - HALF_W - 2.1 * PX_PER_NM) * CH_SCALE
  const fy = (WALL_Y - HALF_MEM - 2.3 * PX_PER_NM) * CH_SCALE
  const fw = (2 * HALF_W + 4.2 * PX_PER_NM) * CH_SCALE
  const fh = (2 * HALF_MEM + 5 * PX_PER_NM) * CH_SCALE
  ctx.beginPath()
  ctx.roundRect(fx, fy, fw, fh, 10)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)'
  ctx.lineWidth = 2.5
  ctx.setLineDash([7, 6])
  // Corner to corner, the two lines of a magnifier's cone: the inset's two
  // nearest corners to the big frame's matching ones. They used to run to
  // arbitrary points near the frame and read as crossed wires (2026-08-28).
  ctx.beginPath()
  ctx.moveTo(ix, iy)
  ctx.lineTo(fx + fw, fy)
  ctx.moveTo(ix, iy + INSET_H)
  ctx.lineTo(fx + fw, fy + fh)
  ctx.stroke()
  ctx.setLineDash([])
  // The caption under the inset is gone (user, 2026-08-28). The dashed frames
  // and the connectors already say "that shape is this thing"; a sentence
  // repeating it is the canvas explaining itself, which is the one thing the
  // canvas does not do.

  ctx.fillStyle = LABEL
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('outside the cell', 12, 18)
  ctx.fillText('inside the cell', 12, CH_H - 10)
  ctx.textAlign = 'right'
  ctx.fillText(`×${CH_MAG.toLocaleString('en-US')}`, SIDE_W - 8, 18)

  // ⚠ ONE LEADER IDIOM (user, 2026-09-04, unifying on the vesicle view): this
  // one had its own ink and left the label's INK EDGE rather than its box
  // centre, so the same gesture looked like two on two canvases. Gated by the
  // app's one 🏷 switch; readings above it are never hidden.
  if (labelsOn) {
    for (const { label, target } of sideLabelPlan()) {
      drawConnector(ctx, label, { x: target.x * CH_SCALE, y: target.y * CH_SCALE })
      drawSpoken(ctx, label)
    }
  }
}

export function topLabels(): SpokenLabel[] {
  return [spoken('four subunits', 26, 40), spoken('lipid heads', 26, CH_H - 16)]
}

/** Looking straight down at the membrane from outside: a field of lipid heads
 *  with the channel set into it, its four helices in a pinwheel round the way
 *  through — the composition of the second reference the user supplied. */
export function drawTop(
  ctx: CanvasRenderingContext2D,
  tried: TryState | null = null,
  ms = 0,
  labelsOn = true,
): void {
  const cx = topW / 2
  const cy = topH / 2
  ctx.save()
  ctx.scale(CH_SCALE, CH_SCALE)
  const outer = Math.min(topW, topH) * 0.3
  const inner = FILTER_HALF

  // The membrane seen face on: heads packed shoulder to shoulder, jittered so
  // it reads as a crowd, thinned out where the protein sits.
  // FEWER of them, but every one of them SOLID (2026-08-28). Packed shoulder
  // to shoulder the field filled the panel and left the channel small, so the
  // spacing is opened out — but the first attempt also faded them with
  // distance, and a half-transparent lipid head reads as a lipid head that is
  // somehow not quite there. Nothing here is partly present. Density is the
  // dial; opacity is not.
  const spacing = HEAD_GAP * 1.32
  const holeR = outer * 1.42 + HEAD_R * 0.75
  for (let gy = spacing * 0.5; gy < topH; gy += spacing * 0.92) {
    for (let gx = spacing * 0.5; gx < topW; gx += spacing * 0.92) {
      const jx = ((Math.sin(gx * 12.9 + gy * 4.7) * 43758.5) % 1) * spacing * 0.35
      const jy = ((Math.sin(gx * 3.3 + gy * 19.1) * 12345.7) % 1) * spacing * 0.35
      const x = gx + jx
      const y = gy + jy
      const d = Math.hypot(x - cx, y - cy)
      if (d < holeR) continue
      const g = ctx.createRadialGradient(x - 1, y - 1, 0, x, y, HEAD_R)
      g.addColorStop(0, LIPID_HEAD_LIGHT)
      g.addColorStop(0.55, LIPID_HEAD_MID)
      g.addColorStop(1, LIPID_HEAD_DARK)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, HEAD_R, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // THE PROTEIN IS SOLID, and it has to look it (2026-08-28).
  //
  // Drawn as helices alone, the gaps between them read as ways through, and a
  // child rightly asks why an ion bothers with the little hole in the middle
  // when there is all that space around it. The honest answer is that there
  // is no space: a channel is a packed mass of protein, and the only water in
  // it is the thread down the pore. So a filled body goes under the helices —
  // no see-through gaps — and the lipids crowd right up against it.
  paintChannelBody(ctx, cx, cy, outer * 1.5, 1)

  // The four subunits, each a pair of helices seen end-on, arranged with the
  // pinwheel handedness those figures show.
  for (let i = 0; i < SUBUNITS; i++) {
    const a = (Math.PI * 2 * i) / SUBUNITS
    const ends: { sx: number; sy: number; ex: number; ey: number }[] = []
    // Three a side here too: the outer helix, the pore helix behind it, and
    // the inner one lining the way through (2026-08-28).
    for (const [rr] of [[outer * 1.02], [outer * 0.76], [outer * 0.52]] as const) {
      ends.push({
        sx: cx + Math.cos(a + 0.42) * rr,
        sy: cy + Math.sin(a + 0.42) * rr,
        ex: cx + Math.cos(a + 0.02) * rr * 0.72,
        ey: cy + Math.sin(a + 0.02) * rr * 0.72,
      })
    }
    // Seen from above, the loop that joins a subunit's two helices swings out
    // round the outside — the same chain as in the side view, just viewed
    // down the pore. Drawn first, so the helices sit on top of it.
    const [outerEnd, pEnd, innerEnd] = ends
    // Seen from above, the chain joining a subunit's helices swings round the
    // outside — the same string as in the side view, viewed down the pore.
    // Drawn first, so the helices sit on top of it.
    chainLoop(
      ctx,
      outerEnd.ex,
      outerEnd.ey,
      pEnd.sx,
      pEnd.sy,
      cx + Math.cos(a - 0.28) * outer * 0.95,
      cy + Math.sin(a - 0.28) * outer * 0.95,
      cx + Math.cos(a - 0.1) * outer * 0.82,
      cy + Math.sin(a - 0.1) * outer * 0.82,
      1.5 * PX_PER_NM * 0.2,
      HELIX_MID,
    )
    chainLoop(
      ctx,
      pEnd.ex,
      pEnd.ey,
      innerEnd.sx,
      innerEnd.sy,
      cx + Math.cos(a - 0.16) * outer * 0.62,
      cy + Math.sin(a - 0.16) * outer * 0.62,
      cx + Math.cos(a + 0.02) * outer * 0.56,
      cy + Math.sin(a + 0.02) * outer * 0.56,
      1.5 * PX_PER_NM * 0.2,
      HELIX_MID,
    )
    // And the pore loop, reaching in to the filter's ring of oxygens: the
    // filter is part of the chain here too.
    chainLoop(
      ctx,
      innerEnd.ex,
      innerEnd.ey,
      cx + Math.cos(a + 0.18) * inner * 2.1,
      cy + Math.sin(a + 0.18) * inner * 2.1,
      cx + Math.cos(a - 0.05) * outer * 0.4,
      cy + Math.sin(a - 0.05) * outer * 0.4,
      cx + Math.cos(a + 0.1) * outer * 0.28,
      cy + Math.sin(a + 0.1) * outer * 0.28,
      1.5 * PX_PER_NM * 0.26,
      HELIX_LIGHT,
    )
    for (const [i2, w, turns] of [
      [0, 1.5 * PX_PER_NM * 0.58, 3],
      // The pore helix, behind and a little slighter: it is the short one.
      [1, 1.5 * PX_PER_NM * 0.46, 2],
      [2, 1.4 * PX_PER_NM * 0.55, 3],
    ] as const) {
      const e = ends[i2]
      helixRibbon(ctx, e.sx, e.sy, e.ex, e.ey, w, turns)
    }
  }

  // The way through, its ring of oxygens, and the ion in the middle.
  // Looking straight DOWN a hole: black in the middle, opening out into the
  // protein at the rim, with a thread of light on the near lip.
  const well = ctx.createRadialGradient(cx, cy, 0, cx, cy, inner * 2.6)
  well.addColorStop(0, 'rgba(2, 4, 12, 1)')
  well.addColorStop(0.6, 'rgba(6, 8, 20, 0.95)')
  well.addColorStop(1, `rgba(${BODY_RGB}, 0.5)`)
  ctx.fillStyle = well
  ctx.beginPath()
  ctx.arc(cx, cy, inner * 2.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.18)'
  ctx.lineWidth = 0.35
  ctx.beginPath()
  ctx.arc(cx, cy, inner * 2.4, Math.PI * 1.1, Math.PI * 1.9)
  ctx.stroke()
  for (let i = 0; i < SUBUNITS * 2; i++) {
    const a = (Math.PI * 2 * i) / (SUBUNITS * 2)
    glossySphere(
      ctx,
      cx + Math.cos(a) * inner * 1.9,
      cy + Math.sin(a) * inner * 1.9,
      0.55,
      OXY,
    )
  }

  // The charges go on BEFORE the ion, and out of its path: it used to arrive
  // underneath its own labels, which read as the ion being behind them
  // (2026-08-28). Screen space, so their size is their own.
  ctx.restore()
  const badgeR = HEAD_R * CH_SCALE * 0.85
  for (let i = 0; i < SUBUNITS; i++) {
    const a = (Math.PI * 2 * (i + 0.5)) / SUBUNITS
    drawChargeDot(
      ctx,
      (cx + Math.cos(a) * outer * 1.14) * CH_SCALE,
      (cy + Math.sin(a) * outer * 1.14) * CH_SCALE,
      badgeR,
      1,
    )
    // The lining's negative, out where the pore's wall is rather than over
    // the way through.
    drawChargeDot(
      ctx,
      (cx + Math.cos(a) * outer * 0.62) * CH_SCALE,
      (cy + Math.sin(a) * outer * 0.62) * CH_SCALE,
      badgeR * 0.7,
      -1,
    )
  }
  ctx.save()
  ctx.scale(CH_SCALE, CH_SCALE)

  if (tried) {
    const pose = tryPoseAt(tried, ms)
    const ion = IONS[tried.kind]
    const bare = (ion.bareNm / 2) * PX_PER_NM
    const inFilter = 1 - Math.min(1, Math.abs(pose.y - FILTER_Y) / (FILTER_HALF * 4))
    const out = pose.emerge
    if (out > 0.001) {
      // Up out of the hole, toward the viewer, and away past the frame.
      const drift = out * out
      ctx.save()
      ctx.globalAlpha *= Math.max(0, 1 - Math.pow(out, 3))
      drawGlossyIon(
        ctx,
        tried.kind,
        cx + Math.cos(-0.7) * drift * topW * 0.85,
        cy + Math.sin(-0.7) * drift * topH * 0.85,
        bare * (1 + 3.4 * out),
      )
      ctx.restore()
    } else if (inFilter > 0.02) {
      ctx.save()
      ctx.globalAlpha *= inFilter
      drawGlossyIon(ctx, tried.kind, cx, cy, bare)
      ctx.restore()
    }
  }
  ctx.restore()

  // No amber frame here (2026-08-28). Amber dashed boxes mean "this small
  // thing is that big thing" — a magnification relation. This panel is a
  // different VIEW of the same object, not a magnified piece of the other
  // one, and framing it in the marker's colour claimed a relation that does
  // not exist.
  ctx.fillStyle = LABEL
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('looking down at the membrane', TOP_W / 2, 22)
  if (labelsOn) for (const l of topLabels()) drawSpoken(ctx, l)
}
