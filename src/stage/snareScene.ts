import {
  HALF_MEM,
  HEAD_R,
  OILY_CORE,
  lipidSpacing,
  paveMembrane,
  type LipidGeom,
  type WallPoint,
} from './bilayer'
import { GLOSSY_COLORS, drawGlossyIon } from './particleStyle'
import { coatFlyAt, coatOrder, coatSettleAt, drawDynamin, drawTriskelion } from './clathrin'
import { softGlow } from './signal'
import { drawSpoken, spoken, type SpokenLabel } from './spokenLabels'
import {
  CLAMP_OFF,
  PRIMED_ZIP,
  SINK_TOUCH,
  STAGE_SPANS,
  clampArriveAt,
  disassembleAt,
  descentAt,
  gtpAt,
  poreAt,
  pressedAt,
  rabGoneAt,
  retrievedAt,
  sitesFilled,
  stageAt,
  NT_COUNT,
  syntaxinOpenAt,
  tetherHoldAt,
  through,
  uAtLoadFill,
  STAGE_WEIGHT,
  uAtMouthOpen,
  uAtThrough,
  zipAt,
} from '../core/vesicleCycle'
import { HILL_N } from '../core/synapse'
import {
  CHANNEL_INK,
  SNARE_ANCHOR_A,
  SNARE_CIS_LEN,
  SNARE_STRANDS,
  transmitterDot,
} from './synapseScene'
import { TURN_IN, VGLUT_GLYPH, drawMovingGlyph, transportOpen } from './channelShapes'

// D06's face — one vesicle, one patch of terminal wall, and the machinery.
//
// ⚠ THE MOLECULES ARE DRAWN HERE, and that is the whole reason this drawer
// exists. Out on the synapse scene the bouton is a micrometre across and the
// membrane is two pixels, so a phospholipid is a third of a pixel and the wall
// has to be a band. Here one 40 nm vesicle fills the frame, the molecules are
// bigger than a fingertip, and the bilayer is drawn out of the app's own
// `paveMembrane` — the SAME code the whole-neuron scene uses. A second private
// drawing of a membrane is forbidden, and this is what the shared paver was
// extracted for.

const VIEW_W = typeof window !== 'undefined' ? window.innerWidth : 1440
const VIEW_H = typeof window !== 'undefined' ? window.innerHeight : 860

export const SN_W = Math.max(560, Math.min(VIEW_W, 1376) - 40 - 256 - 24 - 32)
// The drawer's real vertical chrome, measured (2026-09-03, "stretch the
// canvas"): SideDrawer p-5 top+bottom (40) + the bench grid's pt-2 (8) + the
// canvas plate's border and p-2 (18). The old −58 was the pre-20av controls
// row below the canvas, which no longer exists — reclaimed.
export const SN_H = Math.max(360, VIEW_H - 40 - 8 - 18)

/** The molecule, drawn big — this is the one view where it is resolvable. */
export const LIPID: LipidGeom = { headR: HEAD_R * 1.15, halfMem: HALF_MEM * 1.15 }
/** How far apart the molecules stand along a wall. */
const SPACING = lipidSpacing(LIPID)

/** ⚠ VGLUT AT THIS MAGNIFICATION (21c-3o). The synapse view draws it several
 *  times its membrane's drawn thickness — a declared exaggeration, because
 *  there the membrane is 5 px and the protein would vanish. Here the bilayer is
 *  resolved molecule by molecule, so no exaggeration is needed or wanted: the
 *  protein spans the membrane, which is what a transporter does. Sized to the
 *  barrel it replaces, so nothing else in the frame had to move. */
const VGLUT_SPAN_SN = LIPID.halfMem * 2.3

const INK = 'rgba(148, 163, 184, 0.85)'
export const OUTSIDE = 'rgba(30, 41, 59, 0.5)'
// The upstream cast's inks — none reuses a SNARE strand colour, so a child can
// tell the catchers from the pullers by colour alone.
const TETHER_INK = '#8b5cf6'
const RAB_INK = '#f97316'
const GTP_LIT = '#fde047'
const GTP_DIM = '#475569'
const GTP_GLOW = '253, 224, 71'
const MUNC18_INK = '#94a3b8'
const MUNC13_INK = '#2dd4bf'
const COMPLEXIN_INK = '#fbbf24'
// ⚠ NSF moved off red (2026-09-04): red is the two playgrounds' + charge
// colour, and the protons now wear it (the atomic playground's own proton
// ink, via GLOSSY_COLORS.h). Fuchsia keeps the barrel loud without stealing
// a reserved meaning.
const NSF_INK = '#c026d3'
// ⚠ Clathrin's ink and shape live in `stage/clathrin.ts` now (21c-10) — one
// owner, shared with the endocytosis drawer.
/** ⚠ THE V-ATPase, IN ITS CARGO'S OWN FAMILY (21c-3o, user: "align 'vesicle &
 *  snare' with elements introduced in 'The synapse: the round trip'"). It wore
 *  `#6366f1` — which is EAAT's wall exactly, the astrocyte's glutamate
 *  transporter, in a view that has no astrocyte in it — and it shared that ink
 *  with the vesicle's own transmitter transporter beside it, so two machines
 *  doing opposite jobs were one colour.
 *
 *  Red, because a channel wears what it passes and this one passes protons.
 *  ⚠ NOT the protons' own body ink (`GLOSSY_COLORS.h.dark`, `#dc2626`): a
 *  protein painted in its cargo's exact colour is the fault VGLUT's first teal
 *  had — it makes "count the cargo's ink" unanswerable. A shade darker, so the
 *  family reads and the count still works. */
export const V_ATPASE_INK = '#b91c1c'
/** ⚠ THE VESICLE'S LUMEN, in the bath's own ink (user, 2026-08-31). It is not a
 *  colour that happens to match the outside — the lumen IS outside, folded in,
 *  and that is exactly why exocytosis works. Painting it so means the moment
 *  the pore opens nothing has to change colour: what was always the same space
 *  simply stops being separated.
 *
 *  ⚠ THE SAME PAINT, not a hex that approximates it (user, 2026-09-03: "align
 *  bg inside vesicle with bg outside of the cell for a seamless fusion").
 *  The lumen arc never reaches below the wall line, so the two washes are
 *  never layered on each other — same ink over the same backdrop, one colour. */
export const LUMEN = OUTSIDE

export interface SnareGeometry {
  /** The terminal's wall — pushed to the frame's lower reaches (0.85 of the
   *  height, was 0.72) so the top of the canvas is free water for the
   *  approach (user, 2026-09-03: "start with an undocked vesicle at the top"). */
  wallY: number
  left: number
  right: number
  /** The vesicle's centre while it is up in the crowd, before the approach. */
  highY: number
  /** …and once the tether holds it near the wall. */
  freeY: number
  cx: number
  r: number
}

export function snareGeometry(width = SN_W, height = SN_H): SnareGeometry {
  // Slightly smaller than before (0.16/0.24): the frame now has to hold the
  // whole journey, and a vesicle sized for the old two-thirds frame left no
  // water above it to arrive through.
  const r = Math.min(width * 0.14, height * 0.17)
  const wallY = height * 0.85
  return {
    wallY,
    left: width * 0.06,
    right: width * 0.94,
    // Below the transport plate that overlays the canvas top (~52 px deep).
    highY: r + 84,
    freeY: wallY - LIPID.halfMem - r - r * 0.55,
    cx: width / 2,
    r,
  }
}

/** Where the vesicle's centre is at this moment: down from the crowd on the
 *  approach, pulled onto the wall as it docks, and dragged the last of the way
 *  by the zip. */
export function vesicleCentre(g: SnareGeometry, u: number): { x: number; y: number } {
  const touching = g.wallY - LIPID.halfMem - g.r
  const held = g.highY + (g.freeY - g.highY) * descentAt(u)
  return { x: g.cx, y: held + (touching - held) * pressedAt(u) }
}

/** Where the fusing vesicle's centre is: the docked position until the pore
 *  opens, then sinking THROUGH the wall as the omega unrolls — fully
 *  submerged (centre one radius past the wall) means every molecule of it now
 *  lies ON the wall. The approach-to-contact fraction (`SINK_TOUCH`) is the
 *  core's own — one copy, shared with the cargo's exit schedule. */

/** ⚠ THE SINK, ASKED OF A PROGRESS (21c-17). How deep a fusing vesicle's centre
 *  has got, given where it started, how big it is, and how far through its
 *  fusion it is — extracted from `fusedCentreY` so a second exhibit can play
 *  the SAME fusion on its own clock.
 *
 *  D18 draws up to three vesicles fusing at once on a 1.4 s ramp, nothing like
 *  the SNARE cycle's single 20 s run; what must not differ is the SHAPE of the
 *  sink. So the schedule is the caller's and this rule is shared: the first
 *  `SINK_TOUCH` of the progress is the approach to contact, and the rest sweeps
 *  the intersection ANGLE at a constant rate — which is what bounds every
 *  lipid's speed, because a sphere's waterline sweeps at infinite rate the
 *  instant it touches a plane. */
export function fusedCentreFor(
  g: SnareGeometry,
  from: number,
  r: number,
  p: number,
): number {
  const touch = g.wallY - r
  if (p <= SINK_TOUCH) return from + (p / SINK_TOUCH) * (touch - from)
  const aR = Math.PI / 2 - ((p - SINK_TOUCH) / (1 - SINK_TOUCH)) * Math.PI
  return g.wallY - r * Math.sin(aR)
}

export function fusedCentreY(g: SnareGeometry, u: number): number {
  const pressed = vesicleCentre(g, u).y
  const p = poreAt(u)
  const back = retrievedAt(u)
  const lift = through(u, 'refill')
  // ⚠ DRIVEN BY THE WATERLINE'S ANGLE, not by depth. A sphere's waterline
  // sweeps at INFINITE rate the instant it touches a plane (the √-ramp), so a
  // depth-linear sink made the first- and last-submerged lipids flick
  // sideways (measured: 36 px in one step). Sweeping the intersection ANGLE
  // at a constant rate bounds every lipid's speed and eases both contacts —
  // the depth then follows a sine, slow exactly where it must be.
  const touch = g.wallY - g.r
  if (back <= 0 && lift <= 0) return fusedCentreFor(g, pressed, g.r, p)
  // ⚠ THE SAME BUBBLE COMES BACK, AT THE SAME SPOT (user, 2026-09-02: "the
  // new vesicle is formed in a location different from the original — fix";
  // "the membrane stays enclosed — fix"). Retrieval is the sink's own
  // angle-sweep run BACKWARDS on the same centre line: the wall opens again,
  // the pocket stands back up OPEN to the wall — a budding vesicle is
  // continuous with the membrane until the pinch, which is what the enclosed
  // second bubble got wrong — and it seals exactly as the sweep completes.
  if (lift <= 0) {
    const aB = -Math.PI / 2 + back * Math.PI
    return g.wallY - g.r * Math.sin(aB)
  }
  // Refilled: it lifts off the wall all the way back up to the crowd — the
  // very height the cycle's first frame showed, so the loop visibly closes.
  const e = lift * lift * (3 - 2 * lift)
  return touch - (touch - g.highY) * e
}

/** ⚠ THE OMEGA, UNROLLED — every phospholipid keeps its identity (user,
 *  2026-09-01: "give identity to phospholipids, so they merge with the
 *  membrane without teleporting").
 *
 *  The old drawing DELETED the mouth's molecules and then the whole ring.
 *  Now each molecule keeps its ring angle for ever; the part of the circle
 *  that has passed the wall is UNROLLED along it — arclength onto the line,
 *  exact material conservation — so a vesicle molecule becomes a wall
 *  molecule by travelling, and when the centre has sunk one radius past the
 *  wall the whole ring lies flat: it IS wall now, and stays drawn as such. */
export function omegaRing(
  g: SnareGeometry,
  cx: number,
  cy: number,
  r: number,
  /** ⚠ The spacing of the molecule this ring is going to be paved with. A ring
   *  sampled for one lipid and painted with another is either gappy or piled
   *  up — and until 21c-19 that was not even sayable. */
  spacing = SPACING,
): WallPoint[] {
  const n = Math.max(12, Math.round((2 * Math.PI * r) / spacing))
  const yw = g.wallY
  const sinStar = (yw - cy) / r
  const out: WallPoint[] = []
  if (sinStar >= 1) return ringPoints(cx, cy, r, undefined, undefined, spacing)
  const aR = Math.asin(Math.max(-1, Math.min(1, sinStar)))
  const aL = Math.PI - aR
  const footR = cx + r * Math.cos(aR)
  const footL = cx - r * Math.cos(aR)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    if (a > aR && a < aL) {
      // Past the wall: unrolled along it, outward from its own side's foot.
      const onWall =
        a <= Math.PI / 2
          ? { x: footR + r * (a - aR), y: yw }
          : { x: footL - r * (aL - a), y: yw }
      out.push({
        at: onWall,
        tangent: { x: 1, y: 0 },
        // Down is into the terminal, same as the wall's own molecules.
        inward: { x: 0, y: -1 },
      })
      continue
    }
    out.push({
      at: { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r },
      tangent: { x: -Math.sin(a), y: Math.cos(a) },
      inward: { x: -Math.cos(a), y: -Math.sin(a) },
    })
  }
  return out
}

/** The fusing vesicle's molecules at this moment — ALWAYS the full ring. */
export function vesicleRing(g: SnareGeometry, u: number): WallPoint[] {
  return omegaRing(g, g.cx, fusedCentreY(g, u), g.r)
}

/** How far each side of the original wall has been PUSHED OUTWARD by the
 *  material the omega adds: the mouth's chord plus the unrolled arclength.
 *  Zero until the walls have actually merged. */
export function wallShift(g: SnareGeometry, u: number): number {
  return wallShiftFor(g, fusedCentreY(g, u), g.r)
}

/** ⚠ THE SAME SHIFT, ASKED OF A CENTRE (21c-6, user: "cell membrane remains
 *  solid during animation. Expected: it visually opens up").
 *
 *  How far the wall's own molecules must move aside is a fact about where the
 *  vesicle's centre is, not about where the SNARE cycle has got to — and the
 *  endocytosis panels drive their vesicles themselves. Same arithmetic, one
 *  owner: the merging circle's foot is at `r·cos(a*)`, and the arc that has
 *  already unrolled past it is `r·(π/2 − a*)` long, so together they are the
 *  room the crowd has to make. */
export function wallShiftFor(g: SnareGeometry, cy: number, r = g.r): number {
  const sinStar = (g.wallY - cy) / r
  if (sinStar >= 1) return 0
  const aR = Math.asin(Math.max(-1, Math.min(1, sinStar)))
  return r * Math.cos(aR) + r * (Math.PI / 2 - aR)
}

/** Which copy of the ring's machinery: 1 = the right of the vesicle (the
 *  original cast), −1 = its mirror image on the left. Everything is computed
 *  right-handed and reflected across the centre line — one geometry, two
 *  copies, which is what a section through a ring is (user, 2026-09-03). */
export type Side = 1 | -1

const reflect = (g: SnareGeometry, p: { x: number; y: number }, side: Side) =>
  side === 1 ? p : { x: 2 * g.cx - p.x, y: p.y }

/** The ring angle where the v-SNARE's molecule sits. ⚠ MOVED OFF THE BOTTOM
 *  (user, 2026-09-03: "place SNARE complex and Ca binding areas further away
 *  from the center, as currently they collide"): at the old ~87° the two
 *  mirrored copies' rope ends were ±0.05 r from the centre line — on top of
 *  each other. At 1.1 rad the anchor sits at ±0.45 r, so the pair reads as a
 *  ring's section instead of a tangle. */
const V_ANCHOR_A = SNARE_ANCHOR_A

/** The flat cis-complex's length along the wall, in radii — the distance the
 *  wall end keeps beyond the vesicle molecule once both lie in one membrane. */
const CIS_LEN = SNARE_CIS_LEN

/** Where syntaxin stands on the wall, in radii from the centre: exactly one
 *  cis-length beyond the point where the v-SNARE's molecule lands when the
 *  omega unrolls, so the moment the rope lies flat nothing has to jump. */
const WALL_ANCHOR = Math.cos(V_ANCHOR_A) + CIS_LEN

/** The rope's two ends — one named decision, shared by the rope, the sensor's
 *  grip and the tests, so they can never disagree about where the machine is.
 *
 *  ⚠ BOTH ENDS RIDE THE MEMBRANE THEY LIVE IN (user, 2026-09-03: "when the
 *  vesicle fuses, the SNARE complex stays hanging at the same place and
 *  disappears — confusing"). Syntaxin is a wall protein, so the wall end is
 *  pushed outward with `wallShift` like every other wall molecule; the
 *  synaptobrevin end is a vesicle molecule at a fixed ring angle, so it
 *  follows the omega's unrolling — the same math the lipids obey. After
 *  fusion the rope therefore lies FLAT in the one membrane (a cis-SNARE
 *  complex, which is real) and travels outward with the flow instead of
 *  hanging in the water where the bubble used to be. */
export function ropeEnds(
  g: SnareGeometry,
  u: number,
  side: Side = 1,
): { wall: { x: number; y: number }; ves: { x: number; y: number } } {
  // ⚠ BOLTED TO ITS OWN LIPID AT ALL TIMES (user, 2026-09-04: "Ca binder and
  // snare helices do not follow membrane all the time"). The earlier freeze
  // (from retrieval) and 1.6 r cap parked the rope while the membrane visibly
  // streamed past and slid home beneath it. Now the v-SNARE end obeys the
  // material rule the lipids obey at EVERY u — unrolled out with the flow,
  // rolled home with the retrieval, up onto the reforming bud (which is made
  // of the very patch that flattened) — and NSF takes the rope apart there.
  const wallY = g.wallY - LIPID.halfMem
  const cy = fusedCentreY(g, u)
  const sinStar = (g.wallY - cy) / g.r
  let ves: { x: number; y: number }
  let wall: { x: number; y: number }
  const aR = sinStar >= 1 ? Math.PI / 2 : Math.asin(Math.max(-1, Math.min(1, sinStar)))
  if (sinStar < 1 && V_ANCHOR_A > aR) {
    // Past the wall: the v-SNARE molecule is unrolled along it, outward from
    // the right foot — the identical rule `omegaRing` applies to the lipids —
    // and the joined complex rides it as ONE flat object, the wall end a
    // cis-length beyond. (WALL_ANCHOR is built from CIS_LEN, so the switch
    // between the two rules moves nothing. And no wall shift is added to the
    // wall end: once joined, the complex is governed by its v-SNARE side —
    // adding the shift opened a measured 119 px jump at the branch switch.)
    const footR = g.cx + g.r * Math.cos(aR)
    ves = { x: footR + g.r * (V_ANCHOR_A - aR), y: g.wallY }
    wall = { x: ves.x + g.r * CIS_LEN, y: wallY }
  } else {
    ves = { x: g.cx + Math.cos(V_ANCHOR_A) * g.r, y: cy + Math.sin(V_ANCHOR_A) * g.r }
    wall = { x: g.cx + g.r * WALL_ANCHOR, y: wallY }
  }
  return { wall: reflect(g, wall, side), ves: reflect(g, ves, side) }
}

/** ⚠ HOW THE SENSOR ACTS ON THE ROPE (user, 2026-09-02: "it's not clear how
 *  synaptotagmin affects the SNARE complex to start pulling"). The clamp
 *  picture, drawn as a body that TOUCHES the thing it controls: the head —
 *  anchored to the vesicle by its own stalk — GRIPS the half-wound rope
 *  through docking, priming and the calcium count (the famous pause IS this
 *  grip), and when the fourth ion lands it LETS GO and swings down onto the
 *  wall. The release is what frees the zip to finish; the swing plus the
 *  go-flash running down the rope are that cause, on screen. */
export function sensorHead(g: SnareGeometry, u: number, side: Side = 1): { x: number; y: number } {
  const ends = ropeEnds(g, u)
  const grip = {
    x: (ends.wall.x + ends.ves.x) / 2 + g.r * 0.3,
    y: (ends.wall.y + ends.ves.y) / 2,
  }
  // ⚠ BEFORE THE ROPE EXISTS, THE SENSOR RIDES ITS VESICLE (2026-09-03, with
  // the approach leg). Synaptotagmin lives in the vesicle's own membrane, so
  // on the way down it sits just off the lower-right shoulder; it steps onto
  // the rope exactly as docking joins the strands into one. The shoulder is
  // the FUSED centre's — identical to `vesicleCentre` before fusion, and the
  // reformed, lifting bubble after it (the walk-home must land on the bubble
  // that actually rises, not on the pre-fusion path's parking spot).
  const cy = fusedCentreY(g, u)
  const ride = { x: g.cx + Math.cos(0.9) * g.r * 1.18, y: cy + Math.sin(0.9) * g.r * 1.18 }
  const o = syntaxinOpenAt(u)
  const held =
    o >= 1 ? grip : { x: ride.x + (grip.x - ride.x) * o, y: ride.y + (grip.y - ride.y) * o }
  const q = Math.min(1, through(u, 'zipper') / CLAMP_OFF)
  if (q <= 0) return reflect(g, held, side)
  const e = q * q * (3 - 2 * q)
  const down = { x: held.x + g.r * 0.34, y: g.wallY - LIPID.halfMem - g.r * 0.16 }
  const swung = { x: held.x + (down.x - held.x) * e, y: held.y + (down.y - held.y) * e }
  // ⚠ AND WALKS HOME with the recycling (2026-09-03): synaptotagmin is
  // vesicle membrane protein, sorted back into the bud — by the lift it is
  // riding its shoulder again, empty-handed, ready for the next round.
  const back = disassembleAt(u)
  if (back <= 0) return reflect(g, swung, side)
  return reflect(g, lerpP(swung, ride, back), side)
}

/** The four calcium sites, an arc across the sensor's own head — they ride it
 *  (grip, then the release swing) but never rearrange: a sensor whose sites
 *  shuffled as they filled would be two things changing at once. */
export function sensorSites(
  g: SnareGeometry,
  u: number,
  side: Side = 1,
): { x: number; y: number; full: boolean }[] {
  const h = sensorHead(g, u, side)
  const filled = sitesFilled(u)
  const out: { x: number; y: number; full: boolean }[] = []
  for (let i = 0; i < HILL_N; i++) {
    const a = -Math.PI * 0.5 + (i - (HILL_N - 1) / 2) * 0.62
    out.push({
      x: h.x + side * Math.cos(a) * g.r * 0.17,
      y: h.y + Math.sin(a) * g.r * 0.17,
      full: i < filled,
    })
  }
  return out
}

// ── the upstream cast (2026-09-03): the machinery that catches a vesicle
// before the SNAREs ever touch — Rab-GTP riding the bubble, the tether that
// recognises it, the minders that keep syntaxin shut until the landing site,
// and the complexin clamp. Each is a pure position function, so the tests ask
// the DECISION and the drawing merely inks it.

/** The fixed shoulder the Rab rides at — upper-left, facing the tether. */
const RAB_ANGLE = -2.2

/** A wall protein's x at this moment (user, 2026-09-03: "make elements follow
 *  membrane when it moves, so they look anchored to the place"): anchored IN
 *  the membrane, it rides the material shift the fusing bubble pushes through
 *  the wall — outward as membrane is added, home again as retrieval takes it
 *  back — by the very rule the wall's own lipids obey (`wallPoints`). */
function wallRideX(g: SnareGeometry, u: number, x0: number): number {
  return x0 + Math.sign(x0 - g.cx) * wallShift(g, u)
}

const lerpP = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

/** Where the Rab is, how lit its GTP badge is, and how faded it is. While
 *  attached it rides the vesicle's shoulder; once spent (GDP) it is extracted
 *  across priming — it drifts off and fades, job done. */
export function rabAt(
  g: SnareGeometry,
  u: number,
  side: Side = 1,
): { x: number; y: number; gtp: number; alpha: number } {
  // The shoulder is the FUSED centre's (identical to vesicleCentre before
  // fusion): the re-armed Rab returning at the end must land on the bubble
  // that actually lifted, not on the pre-fusion path's parking spot.
  const c = { x: g.cx, y: fusedCentreY(g, u) }
  const anchor = {
    x: c.x + Math.cos(RAB_ANGLE) * g.r * 1.02,
    y: c.y + Math.sin(RAB_ANGLE) * g.r * 1.02,
  }
  const gone = rabGoneAt(u)
  const e = gone * gone * (3 - 2 * gone)
  const p = reflect(g, { x: anchor.x - e * g.r * 0.9, y: anchor.y - e * g.r * 1.1 }, side)
  return { ...p, gtp: gtpAt(u), alpha: 1 - e }
}

/** The tether's two ends. Its base stands on the wall, left of the landing
 *  site; its tip idles curled until the vesicle is close, reaches up and takes
 *  the Rab's shoulder (the catch IS the tether stage), and slides home again
 *  across priming as the SNAREs take over. */
export function tetherAt(
  g: SnareGeometry,
  u: number,
  side: Side = 1,
): { base: { x: number; y: number }; tip: { x: number; y: number }; hold: number } {
  // Out at 1.85 r (was 1.55): the mirrored copy's tether reflects to the far
  // side, and at 1.55 r it stood exactly where THIS copy's SNAP-25 lies on
  // the wall — two proteins in one spot reads as one tangle. Anchored in the
  // membrane: it rides the wall's material shift like every wall lipid.
  const base = { x: wallRideX(g, u, g.cx - g.r * 1.85), y: g.wallY - LIPID.halfMem }
  const idle = { x: base.x - g.r * 0.25, y: base.y - g.r * 0.45 }
  const hold = tetherHoldAt(u)
  const c = vesicleCentre(g, u)
  const shoulder = {
    x: c.x + Math.cos(RAB_ANGLE) * g.r * 1.02,
    y: c.y + Math.sin(RAB_ANGLE) * g.r * 1.02,
  }
  return { base: reflect(g, base, side), tip: reflect(g, lerpP(idle, shoulder, hold), side), hold }
}

export interface SnareStub {
  from: { x: number; y: number }
  to: { x: number; y: number }
  colour: string
}

/** The three SNAREs BEFORE they are a rope: synaptobrevin (the v-SNARE)
 *  hanging from the vesicle, syntaxin standing on the wall — folded shut until
 *  Munc13 opens it — and SNAP-25 lying along the wall. Their tips converge on
 *  the meeting point as docking runs, and the moment they join this returns
 *  null and the rope is the drawing: the two representations are never both on
 *  screen. */
export function snareStubs(
  g: SnareGeometry,
  u: number,
  side: Side = 1,
): { vs: SnareStub; syx: SnareStub; s25: SnareStub } | null {
  const o = syntaxinOpenAt(u)
  const dis = disassembleAt(u)
  if (o >= 1 && dis <= 0) return null
  // The homes — where each strand lives when free. The v-SNARE's home rides
  // the bubble itself (`fusedCentreY`), which is what carries it back up at
  // the run's end; the wall pair's homes are syntaxin's stand.
  const cy = fusedCentreY(g, u)
  const vsFrom = { x: g.cx + Math.cos(V_ANCHOR_A) * g.r, y: cy + Math.sin(V_ANCHOR_A) * g.r }
  const wallA = { x: wallRideX(g, u, g.cx + g.r * WALL_ANCHOR), y: g.wallY - LIPID.halfMem }
  const vsFree = { x: vsFrom.x + g.r * 0.1, y: vsFrom.y + g.r * 0.42 }
  const syxShut = { x: wallA.x - g.r * 0.18, y: wallA.y - g.r * 0.3 }
  const s25From = { x: wallA.x + g.r * 0.25, y: wallA.y - 4 }
  const s25Flat = { x: s25From.x + g.r * 0.5, y: s25From.y }
  const stub = (from: { x: number; y: number }, to: { x: number; y: number }, colour: string) => ({
    from: reflect(g, from, side),
    to: reflect(g, to, side),
    colour,
  })
  if (dis > 0) {
    // ⚠ WALKING HOME (user, 2026-09-03: "display how the vesicle gets ready
    // to be reused"): NSF has split the flat rope into three, and each strand
    // travels from its segment of the spent rope back to its post —
    // synaptobrevin to the bud, syntaxin and SNAP-25 to their stands. At
    // dis = 1 they ARE the free stubs, so the run's end is the run's start.
    const flat = ropeEnds(g, u)
    const seg = (k: number) => ({
      from: lerpP(flat.ves, flat.wall, k / 3),
      to: lerpP(flat.ves, flat.wall, (k + 1) / 3),
    })
    const walk = (
      k: number,
      homeFrom: { x: number; y: number },
      homeTo: { x: number; y: number },
      colour: string,
    ) => {
      const s = seg(k)
      return stub(lerpP(s.from, homeFrom, dis), lerpP(s.to, homeTo, dis), colour)
    }
    return {
      vs: walk(0, vsFrom, vsFree, SNARE_STRANDS[0]),
      syx: walk(1, wallA, syxShut, SNARE_STRANDS[1]),
      s25: walk(2, s25From, s25Flat, SNARE_STRANDS[2]),
    }
  }
  const meet = { x: (vsFrom.x + wallA.x) / 2, y: (vsFrom.y + wallA.y) / 2 }
  return {
    vs: stub(vsFrom, lerpP(vsFree, meet, o), SNARE_STRANDS[0]),
    syx: stub(wallA, lerpP(syxShut, meet, o), SNARE_STRANDS[1]),
    s25: stub(s25From, lerpP(s25Flat, meet, o), SNARE_STRANDS[2]),
  }
}

/** Where syntaxin's minder is. Munc18 clasps the folded tip until Munc13
 *  opens it, then slides aside along the wall and fades across priming. */
export function munc18At(
  g: SnareGeometry,
  u: number,
  side: Side = 1,
): { x: number; y: number; alpha: number } {
  // Anchored to syntaxin's STAND (not the travelling rope), riding the wall's
  // material shift like the stand itself, and driven by the NET openness —
  // open across docking, folded shut again as the recycling returns syntaxin
  // home, when the minder fades back in to re-clasp it: ready for next round.
  const wallA = { x: wallRideX(g, u, g.cx + g.r * WALL_ANCHOR), y: g.wallY - LIPID.halfMem }
  const shut = { x: wallA.x - g.r * 0.18, y: wallA.y - g.r * 0.3 }
  const o = syntaxinOpenAt(u) * (1 - disassembleAt(u))
  const p = reflect(g, { x: shut.x - o * g.r * 0.45, y: shut.y + o * g.r * 0.2 }, side)
  return { ...p, alpha: Math.max(1 - through(u, 'prime'), through(u, 'refill')) }
}

/** The opener's arm: Munc13 lies along the wall until docking, then stands up
 *  to syntaxin's folded tip — the visible cause of it opening. */
export function munc13At(
  g: SnareGeometry,
  u: number,
  side: Side = 1,
): { base: { x: number; y: number }; tip: { x: number; y: number }; engaged: number } {
  // Anchored a fixed reach short of syntaxin's stand, so it moves out with
  // the wall anchor rather than being marooned at the centre. Driven by the
  // NET openness, so it lies back down as the recycling refolds syntaxin.
  const base = { x: wallRideX(g, u, g.cx + g.r * (WALL_ANCHOR - 0.28)), y: g.wallY - LIPID.halfMem }
  const idle = { x: base.x - g.r * 0.42, y: base.y - g.r * 0.06 }
  const wallA = { x: wallRideX(g, u, g.cx + g.r * WALL_ANCHOR), y: g.wallY - LIPID.halfMem }
  const shut = { x: wallA.x - g.r * 0.18, y: wallA.y - g.r * 0.3 }
  const up = { x: shut.x - g.r * 0.02, y: shut.y - g.r * 0.06 }
  const o = syntaxinOpenAt(u) * (1 - disassembleAt(u))
  const e = Math.min(1, o * 1.6)
  return {
    base: reflect(g, base, side),
    tip: reflect(g, lerpP(idle, up, e * e * (3 - 2 * e)), side),
    engaged: o,
  }
}

/** The complexin clamp: it floats in from beyond the frame's left edge over
 *  priming's last quarter, lies across the half-wound rope through the whole
 *  calcium count, and is flicked up and away over the zip's first strokes —
 *  the same release window as the sensor's swing (`CLAMP_OFF`), so the two
 *  hands visibly open together. Null while it has not arrived. */
export function complexinAt(
  g: SnareGeometry,
  u: number,
  side: Side = 1,
): { x: number; y: number; angle: number; alpha: number } | null {
  const arrive = clampArriveAt(u)
  if (arrive <= 0) return null
  const ends = ropeEnds(g, u)
  const seat = {
    x: ends.wall.x + (ends.ves.x - ends.wall.x) * 0.42 - g.r * 0.14,
    y: ends.wall.y + (ends.ves.y - ends.wall.y) * 0.42,
  }
  const start = { x: -60, y: seat.y - g.r * 0.9 }
  const eA = arrive * arrive * (3 - 2 * arrive)
  const rel = Math.min(1, through(u, 'zipper') / CLAMP_OFF)
  const held = lerpP(start, seat, eA)
  const ropeAngle = Math.atan2(ends.ves.y - ends.wall.y, ends.ves.x - ends.wall.x)
  const p = reflect(g, { x: held.x + rel * g.r * 0.5, y: held.y - rel * g.r * 0.65 }, side)
  return {
    ...p,
    // A reflected rod's tilt is the negated angle (it is a line through its
    // own centre, so ±π is the same rod).
    angle: side * (ropeAngle + Math.PI / 2 + rel * 1.3),
    // Full ink while it is a thing on screen; the flick-off is the fade. The
    // model's own presence number (`clampAt`) covers the same two ramps.
    alpha: 1 - rel,
  }
}

/** Where NSF is — the machine that prises the spent rope apart. It drops in
 *  from the cytosol above at the taking-apart's start, sits on the flat rope
 *  while the strands separate, and lifts away spent. Null off-duty. */
export function nsfAt(
  g: SnareGeometry,
  u: number,
  side: Side = 1,
): { x: number; y: number; alpha: number } | null {
  const t = through(u, 'recycle')
  if (t <= 0 || t >= 1) return null
  const flat = ropeEnds(g, u)
  const target = { x: (flat.ves.x + flat.wall.x) / 2, y: flat.ves.y - g.r * 0.16 }
  const arrive = Math.min(1, t / 0.22)
  const eA = arrive * arrive * (3 - 2 * arrive)
  const start = { x: target.x - g.r * 0.4, y: target.y - g.r * 1.6 }
  const leave = Math.max(0, (t - 0.78) / 0.22)
  const eL = leave * leave * (3 - 2 * leave)
  const pos =
    leave > 0
      ? { x: target.x + eL * g.r * 0.3, y: target.y - eL * g.r * 1.4 }
      : lerpP(start, target, eA)
  return { ...reflect(g, pos, side), alpha: Math.min(1, arrive * 2) * (1 - leave) }
}

/** How many studs the clathrin coat is drawn with. */
export const COAT_N = 14

/** The clathrin coat's studs: they assemble (staggered) on the OUTSIDE of the
 *  reforming bud — the cytosolic face, which is where the real lattice sits —
 *  only on the part standing proud of the wall, and are shed radially as the
 *  taking-apart runs. Empty before retrieval and after shedding. */
export function clathrinAt(
  g: SnareGeometry,
  u: number,
): { x: number; y: number; angle: number; alpha: number }[] {
  const grow = through(u, 'retrieve')
  const shed = disassembleAt(u)
  if (grow <= 0 || shed >= 1) return []
  const cy = fusedCentreY(g, u)
  const out: { x: number; y: number; angle: number; alpha: number }[] = []
  for (let k = 0; k < COAT_N; k++) {
    const h = Math.sin(k * 91.7 + 2.3) * 43758.5453
    const j = h - Math.floor(h)
    const a = -Math.PI / 2 + ((k + 0.5) / COAT_N) * Math.PI * 2
    const rad = g.r + LIPID.halfMem + 5 + shed * g.r * 0.35
    const seatX = g.cx + Math.cos(a) * rad
    const seatY = cy + Math.sin(a) * rad
    // Only the standing part wears the coat.
    if (seatY > g.wallY - 2) continue
    // ⚠ IT FLIES IN FROM THE SIDE AND STICKS — it does not fade up (21c-14/15,
    // user: "clathrin currently fades in and becomes transparent
    // occasionally"; "clathrin should fly from left and right"). The same two
    // rules the endocytosis panels use, from the shared module: a steady
    // approach on its own clock to a STATIC waiting place beside the bud, then
    // an eased settle when the space opens. Apex first, each later piece added
    // on the membrane side, every piece at full strength or not at all.
    const order = coatOrder(k, COAT_N)
    const side: -1 | 1 = seatX < g.cx ? -1 : 1
    const hoverX = g.cx + side * g.r * (2.2 + 0.4 * j)
    const hoverY = g.wallY - g.r * (1 + 1.1 * order + 0.3 * j)
    const fromX = side < 0 ? g.left - g.r : g.right + g.r
    const span = STAGE_SPANS.find((sp) => sp.id === 'retrieve')
    const fly = coatFlyAt(order, u, span?.from ?? 0, (span?.to ?? 1) - (span?.from ?? 0))
    if (fly <= 0) continue
    const land = coatSettleAt(order, u, span?.from ?? 0, (span?.to ?? 1) - (span?.from ?? 0))
    const wx = fromX + (hoverX - fromX) * fly
    const wy = hoverY
    out.push({
      x: wx + (seatX - wx) * land,
      y: wy + (seatY - wy) * land,
      angle: a + (1 - fly) * 2.2 + (1 - land) * 1.2,
      // ⚠ Kept in the shape for the shed's own fade only — the ARRIVAL is a
      // journey now, never an opacity.
      alpha: 1,
    })
  }
  return out
}

/** ⚠ WHERE THE SNARE BENCH'S OWN DYNAMIN IS (21c-10) — null off duty. It works
 *  the NECK of the reforming bud, late in the retrieval, while the pocket is
 *  still open to the wall: squeezing is what separates the bud, so the coil's
 *  squeeze runs up to the moment the pocket seals and it is gone once the
 *  bubble is free. */
export function snareDynaminAt(
  g: SnareGeometry,
  u: number,
): { y: number; halfW: number; height: number; squeeze: number; alpha: number } | null {
  const back = through(u, 'retrieve')
  if (back < 0.55 || back >= 1) return null
  const squeeze = Math.min(1, (back - 0.55) / 0.4)
  const alpha = Math.min(1, (back - 0.55) / 0.12) * Math.min(1, (1 - back) / 0.06)
  const cy = fusedCentreY(g, u)
  const neckTop = cy + g.r * 0.55
  const height = Math.max(6, (g.wallY - neckTop) * 0.7)
  return { y: (neckTop + g.wallY) / 2, halfW: g.r * 0.5, height, squeeze, alpha }
}

/** The ring angle the proton pump rides at, and where it is (null before it
 *  arrives): it fades in as NSF finishes and rides the lifting bubble — the
 *  machine that will make the inside sour, the battery the transmitter pumps
 *  need. One drawn pump stands for the vesicle's V-ATPase. */
const PUMP_A = -0.7
export function pumpAt(
  g: SnareGeometry,
  u: number,
): { x: number; y: number; a: number; alpha: number } | null {
  // In as NSF finishes; out once its battery has been spent by the trade —
  // the machine lives in the wall all along (the info block says so), it is
  // drawn only while it works, so the closing frame matches the opening one.
  const alpha =
    Math.max(0, Math.min(1, (through(u, 'recycle') - 0.75) / 0.25)) *
    (1 - Math.max(0, Math.min(1, (through(u, 'load') - 0.8) / 0.2)))
  if (alpha <= 0.01) return null
  const cy = fusedCentreY(g, u)
  return { x: g.cx + Math.cos(PUMP_A) * g.r, y: cy + Math.sin(PUMP_A) * g.r, a: PUMP_A, alpha }
}

/** Where the transmitter TRANSPORTER sits — the antiporter that spends the
 *  acid: protons out, transmitter in. Upper-left of the bubble, opposite the
 *  pump; drawn only while it trades (the load leg), same declaration as the
 *  pump. Null off-duty. */
const TRANS_A = -2.6

/** Where the transporter's DOOR is at this moment, visible or not — the one
 *  point the trade's traffic may cross the membrane at. Exported so the guard
 *  that pins "never through bare membrane" asks the same spot the drawing
 *  and the flight paths use. */
export function transporterSpot(g: SnareGeometry, u: number): { x: number; y: number } {
  const cy = fusedCentreY(g, u)
  return { x: g.cx + Math.cos(TRANS_A) * g.r, y: cy + Math.sin(TRANS_A) * g.r }
}

export function transporterAt(
  g: SnareGeometry,
  u: number,
): { x: number; y: number; a: number; alpha: number } | null {
  const t = through(u, 'load')
  const alpha =
    Math.min(1, t / 0.12) * (1 - Math.max(0, Math.min(1, (t - 0.85) / 0.15)))
  if (t <= 0 || alpha <= 0.01) return null
  return { ...transporterSpot(g, u), a: TRANS_A, alpha }
}

/** ⚠ HOW LONG ONE MOLECULE IS IN THE BORE, in u. Named once (21c-3o): the
 *  cargo's pass, the transporter's own cycle and the guard all read it, so the
 *  gates cannot swing at a moment nothing is crossing. */
/** ⚠ ONE MOLECULE'S SLOT AT THE PORE, in u — SOLVED, not chosen (21c-3o). The
 *  refill is booked on `uAtLoadFill`, so consecutive molecules seat a fixed
 *  step apart; that step IS the slot. */
export const NT_SLOT_U = uAtLoadFill(1.5 / NT_COUNT) - uAtLoadFill(0.5 / NT_COUNT)

/** ⚠ ONE TURN AT THE PORE — approach, bore, release. It was a flat 0.03 of the
 *  run, nearly a third of the whole load stage, so seven molecules were inside
 *  one pore at once, which a pore does not do. A shade under its slot, so no
 *  pass overlaps its neighbour's and there is a beat between one leaving and
 *  the next arriving. */
export const NT_TURN_U = NT_SLOT_U * 0.95

/** ⚠ AND THE DRIFT TO ITS SEAT IS NOT THE PORE'S BUSINESS (21c-3o). Folding it
 *  into the turn made the last leg — up to 88 px across the lumen — run at
 *  1,170 px/s, and the guard that watches for teleports caught it at 25 px a
 *  frame. Once a molecule is through, it diffuses to its place while the
 *  transporter gets on with the next; several may be drifting at once, and only
 *  one is ever in the bore. */
export const NT_SETTLE_U = NT_SLOT_U * 2

/** ⚠ NOR IS THE WALK UP TO THE DOOR (21c-3o). Folding it into the turn's first
 *  beat ran a 73 px approach in 64 ms — 1,140 px/s, caught by the teleport
 *  guard at 27 px a frame. The queue shuffles up to the outer mouth over its
 *  own window, and arrives there as the gates open on that side. */
export const NT_APPROACH_U = NT_SLOT_U * 2

/** When molecule `i` begins its turn — worked out once, so the cargo's path and
 *  the transporter's own gates cannot disagree about when it is being carried.
 *  It is booked BACKWARD from the moment the ledger says the bag is that much
 *  fuller, so the picture still matches `cargoAt`. */
export function ntTurnStart(i: number): number {
  return uAtLoadFill((i + 0.5) / NT_COUNT) - NT_TURN_U - NT_SETTLE_U
}

/** ⚠ VGLUT'S CYCLE AT THIS MAGNIFICATION (21c-3o, user: "align 'vesicle &
 *  snare' with elements introduced in 'The synapse: the round trip'").
 *
 *  The bench drew a static barrel while the synapse view had already been given
 *  a transporter that WORKS — one molecule at a time, open to the cytoplasm,
 *  shut around it, swung over, released. This is the close-up: it should show
 *  the cycle better than the wide view, not worse.
 *
 *  The beats are the shared ones (`transportOpen`), run over the very window
 *  each molecule takes to thread the bore, so the gates and the cargo cannot
 *  disagree. Between molecules it stands open to the cytoplasm, waiting for the
 *  next; off duty it is shut. Signed the transporter's way — −1 open to where
 *  the cargo comes from — and the drawing does the mirroring. */
export function vglutOpenAt(g: SnareGeometry, u: number): number {
  if (!transporterAt(g, u)) return 0
  for (let i = 0; i < NT_COUNT; i++) {
    const start = ntTurnStart(i)
    if (u < start) return -1
    if (u <= start + NT_TURN_U) return transportOpen((u - start) / NT_TURN_U)
  }
  return -1
}

/** How many protons are shown. A handful stands for the flood. */
export const PROTON_N = 3

/** The protons, each with an identity: proton k waits in the cytosol near the
 *  pump, enters through it during the lift, sits INSIDE riding the bubble —
 *  and is TRADED OUT through the transporter during the load leg, drifting
 *  away off the frame's top. None is left on the closing frame. */
export function protonsAt(
  g: SnareGeometry,
  u: number,
): { x: number; y: number; inside: boolean }[] {
  const lift = through(u, 'refill')
  if (lift <= 0 || Math.max(0, Math.min(1, (through(u, 'recycle') - 0.75) / 0.25)) <= 0.01) {
    return []
  }
  const cy = fusedCentreY(g, u)
  const pump = { x: g.cx + Math.cos(PUMP_A) * g.r, y: cy + Math.sin(PUMP_A) * g.r }
  const trans = { x: g.cx + Math.cos(TRANS_A) * g.r, y: cy + Math.sin(TRANS_A) * g.r }
  const load = through(u, 'load')
  const out: { x: number; y: number; inside: boolean }[] = []
  for (let k = 0; k < PROTON_N; k++) {
    const h = Math.sin(k * 41.3 + 3.1) * 43758.5453
    const j = h - Math.floor(h)
    const t0 = 0.12 + k * 0.24
    const dur = 0.16
    const start = { x: pump.x + g.r * (0.45 + j * 0.35), y: pump.y - g.r * (0.3 + j * 0.35) }
    const seatA = j * Math.PI * 2
    const seat = { x: g.cx + Math.cos(seatA) * g.r * 0.4, y: cy + Math.sin(seatA) * g.r * 0.4 }
    // The trade out: proton k leaves through the transporter at its own
    // moment of the load, and drifts away off the frame's top. ⚠ Scheduled
    // WITH the filling (from 0.45 of the leg, not 0.1 — user, 2026-09-04:
    // "I see no label for proton"): at the exchange stop the trade is
    // mid-swap, protons still on stage to be named, and the last one is gone
    // by 0.89 — the closing frame stays clean.
    const tOut = 0.45 + k * 0.14
    const dOut = 0.08
    if (load >= tOut) {
      const gone = { x: trans.x - g.r * (0.5 + k * 0.2), y: -30 - k * 20 }
      if (load < tOut + dOut) out.push({ ...lerpP(seat, trans, (load - tOut) / dOut), inside: false })
      else if (load < tOut + 2 * dOut) {
        out.push({ ...lerpP(trans, gone, (load - tOut - dOut) / dOut), inside: false })
      } else out.push({ ...gone, inside: false })
      continue
    }
    if (lift < t0) out.push({ ...start, inside: false })
    else if (lift < t0 + dur) out.push({ ...lerpP(start, pump, (lift - t0) / dur), inside: false })
    else if (lift < t0 + 2 * dur) {
      out.push({ ...lerpP(pump, seat, (lift - t0 - dur) / dur), inside: true })
    } else out.push({ ...seat, inside: true })
  }
  return out
}

/** The lumen's shape at a given centre height — the DECISION the wash is
 *  drawn from. ⚠ SOLVED ON THE LUMEN'S OWN RADIUS (user, 2026-09-03: "a gap
 *  or an overlap is occurring between bg of vesicle and outside the cell
 *  space"): the old drawing took the mouth angle from the RING's radius and
 *  painted the arc on the lumen's smaller one, so the closing chord missed
 *  the wall line by up to half a membrane — a bright gap while the mouth was
 *  above centre, a double-painted dark band once below, and a stray arc even
 *  after the lumen was wholly under the wall. The angle here is asin on the
 *  radius that is actually painted, so the chord lies exactly ON the wall
 *  line — and a submerged lumen is 'none', not a smear. */
export function lumenArc(
  g: SnareGeometry,
  cy: number,
): { rLum: number; a: number } | 'full' | 'none' {
  const rLum = g.r - LIPID.halfMem * 0.5
  const s = (g.wallY - cy) / rLum
  if (s >= 1) return 'full'
  if (s <= -1) return 'none'
  return { rLum, a: Math.asin(s) }
}

/** Sample a circle as a wall, with `inward` pointing at its middle. */
function ringPoints(
  cx: number,
  cy: number,
  r: number,
  skipFrom?: number,
  skipTo?: number,
  /** ⚠ The spacing of the molecule that will pave it — the same one the omega
   *  uses. A resting ring sampled at one spacing and a merging ring at another
   *  makes a bubble's molecules visibly close up the instant it starts to
   *  fuse. */
  spacing = SPACING,
): WallPoint[] {
  const n = Math.max(12, Math.round((2 * Math.PI * r) / spacing))
  const out: WallPoint[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    // The mouth of a fusion pore is a gap in the ring: the vesicle's wall has
    // become the terminal's there, so there is nothing left to draw.
    if (skipFrom !== undefined && skipTo !== undefined) {
      const t = ((a + Math.PI * 2.5) % (Math.PI * 2)) / (Math.PI * 2)
      if (t > skipFrom && t < skipTo) continue
    }
    out.push({
      at: { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r },
      tangent: { x: -Math.sin(a), y: Math.cos(a) },
      inward: { x: -Math.cos(a), y: -Math.sin(a) },
    })
  }
  return out
}

/** The terminal's wall. ⚠ NO MOLECULE IS EVER SKIPPED: the fusing vesicle
 *  ADDS membrane, so the original wall's molecules are pushed OUTWARD by
 *  `shift` on each side — identity for the wall's own lipids too. The ones
 *  that slide past the frame's edge leave the picture by travelling. */
/** ⚠ EXPORTED (21c-5). The endocytosis exhibit draws three little terminals of
 *  its own, and every one of them needs THIS wall — the same molecules, the
 *  same spacing, the same paver. A second private drawing of a membrane is
 *  forbidden here, and that rule does not stop at this file's edge. */
export function wallPoints(
  g: SnareGeometry,
  shift: number,
  /** ⚠ WHERE THE WALL IS BEING OPENED (21c-6). Its own middle, until an
   *  exhibit opens it somewhere else — ultrafast endocytosis dents the wall
   *  BESIDE the active zone, and a gap that opens at the frame's centre while
   *  the dent forms to the right is a wall parting where nothing is happening. */
  about = g.cx,
  spacing = SPACING,
): WallPoint[] {
  return wallPointsMany(g, [{ about, shift }], spacing)
}

/** ⚠ THE SAME WALL, OPENED IN SEVERAL PLACES AT ONCE (21c-17).
 *
 *  D18's terminal fuses up to three vesicles at a time, at three different
 *  docked slots, and one `shift` about one `about` cannot say that: a wall that
 *  parts in the middle while bubbles merge left and right is a wall parting
 *  where nothing is happening — the very bug `about` was added for, one step
 *  further out.
 *
 *  ⚠ AND THE SHIFTS ADD UP, which is the honest part. Each fusion ADDS its
 *  vesicle's membrane to the wall, so a molecule is pushed aside by every
 *  opening it is not inside — sum the displacement over the sites, each with
 *  its own side. Two fusions either side of a molecule cancel, and that is
 *  right too: it is being crowded equally from both directions. */
export function wallPointsMany(
  g: SnareGeometry,
  sites: readonly { about: number; shift: number }[],
  /** The spacing of the molecule this wall is going to be paved with. */
  spacing = SPACING,
): WallPoint[] {
  const out: WallPoint[] = []
  const n = Math.round((g.right - g.left) / spacing)
  for (let i = 0; i <= n; i++) {
    const x0 = g.left + (i / n) * (g.right - g.left)
    let x = x0
    for (const site of sites) {
      if (site.shift <= 0) continue
      // ⚠ NO MOLECULE STAYS IN THE MOUTH (21c-8, user: "1 lipid remains in the
      // center of opening"). `Math.sign(0)` is 0, so the slot that lands
      // exactly at the opening's own centre was shoved NOWHERE — one lipid left
      // floating in the parted gap, in front of the merging vesicle. The centre
      // slot goes right; there is no honest side for it, only a side.
      x += (x0 >= site.about ? 1 : -1) * site.shift
    }
    out.push({
      at: { x, y: g.wallY },
      tangent: { x: 1, y: 0 },
      // Down is into the terminal: the vesicle is inside the cell, above.
      inward: { x: 0, y: -1 },
    })
  }
  return out
}

/** The SNARE rope: three strands that wind together from the wall to the
 *  vesicle. `zip` 0 = loose ends, 1 = fully wound. */
function drawSnare(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  zip: number,
): void {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux
  // Three strands: synaptobrevin from the vesicle, syntaxin and SNAP-25 from
  // the wall. Named in the info block; here they are three colours — the SAME
  // three the pre-docking stubs and the synapse's snareMini wear.
  const strands = SNARE_STRANDS
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = 3.2
  for (const [i, colour] of strands.entries()) {
    ctx.strokeStyle = colour
    ctx.beginPath()
    const phase = (i / strands.length) * Math.PI * 2
    const steps = 26
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      // ⚠ WOUND FROM THE FAR END BACKWARDS. Zippering runs from the ends that
      // are already joined toward the membranes, and that direction is the
      // reason it pulls: the closer the winding gets to the two walls, the
      // less slack is left between them.
      const wound = t > 1 - zip ? 1 : 0
      const amp = wound ? 4.5 : 11
      const turns = wound ? 5 : 1.4
      const off = Math.sin(t * Math.PI * 2 * turns + phase) * amp
      const x = from.x + ux * len * t + nx * off
      const y = from.y + uy * len * t + ny * off
      if (s === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()
}

/** One strand on its own — the same wiggling grammar as the rope's loose
 *  state, so the moment docking joins the stubs into the rope nothing changes
 *  material, only ownership. */
function drawStrand(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  colour: string,
  phase: number,
): void {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = 3.2
  ctx.strokeStyle = colour
  ctx.beginPath()
  const steps = 14
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    const off = Math.sin(t * Math.PI * 2 * 1.3 + phase) * 5 * Math.min(1, len / 60)
    const x = from.x + ux * len * t + nx * off
    const y = from.y + uy * len * t + ny * off
    if (s === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()
}

/** How much of the run one calcium ion spends travelling in or out. */
export const CA_FLIGHT_U = 0.045

/** ⚠ EACH CALCIUM ION FLOATS IN, SEATS, AND FLOATS OUT (user, 2026-09-01:
 *  "make Ca ions appear by floating in, not teleporting"). Ion i enters from
 *  beyond the frame's right edge — the doors it came through are not in this
 *  frame, which the info block says — arriving at its own site at the exact
 *  moment the model fills it, riding the vesicle with the sensor while
 *  seated, and leaving the same way when the collapse lets it go. One
 *  continuous trajectory per ion; the same fixed order every frame. */
export function calciumFlight(
  g: SnareGeometry,
  u: number,
  width = SN_W,
  side: Side = 1,
): { x: number; y: number; seated: boolean }[] {
  const sites = sensorSites(g, u, side)
  const out: { x: number; y: number; seated: boolean }[] = []
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  for (let i = 0; i < HILL_N; i++) {
    // The exact moments the MODEL fills and empties this site — see
    // `sitesFilled`'s rounding: site i fills at (i+0.5)/N through the trigger
    // and empties at (N−i−0.5)/N through the collapse. `uAtThrough` inverts
    // the ramp, so a stage's still beat cannot desync an ion from its site.
    const uFill = uAtThrough('trigger', (i + 0.5) / HILL_N)
    const uOut = uAtThrough('collapse', (HILL_N - i - 0.5) / HILL_N)
    // The left copy's ions come from beyond the LEFT edge — its doors are on
    // its own side of the frame.
    const start = reflect(g, { x: width + 40 + i * 18, y: g.wallY - g.r * (1.6 + i * 0.35) }, side)
    const gone = reflect(g, { x: width + 60, y: 0 }, side).x
    const site = sites[i]
    if (u < uFill - CA_FLIGHT_U) {
      out.push({ ...start, seated: false })
    } else if (u < uFill) {
      const q = (u - (uFill - CA_FLIGHT_U)) / CA_FLIGHT_U
      out.push({ x: lerp(start.x, site.x, q), y: lerp(start.y, site.y, q), seated: false })
    } else if (u < uOut) {
      out.push({ x: site.x, y: site.y, seated: true })
    } else if (u < uOut + CA_FLIGHT_U) {
      const q = (u - uOut) / CA_FLIGHT_U
      out.push({
        x: lerp(site.x, gone, q),
        y: lerp(site.y, site.y - g.r * 0.8, q),
        seated: false,
      })
    } else {
      out.push({ x: gone, y: site.y - g.r * 0.8, seated: false })
    }
  }
  return out
}

/** How much of the run one molecule spends squeezing out through the mouth. */
export const NT_FLIGHT_U = 0.03

export interface NtDot {
  x: number
  y: number
  /** Generation 1 (the release): inside → leaving → away. Generation 2 (the
   *  refill trade): staged (off-frame, in the crowd) → entering (the rain
   *  down) → waiting (queued at the transporter's outside) → entering (the
   *  pass through the door) → inside. */
  phase: 'inside' | 'leaving' | 'away' | 'staged' | 'entering' | 'waiting'
}

/** ⚠ EVERY TRANSMITTER MOLECULE HAS AN IDENTITY (user, 2026-09-03: "NTs
 *  should leave the cell in animated way, not teleport"). The same rule the
 *  lipids and the calcium already obey, applied to the cargo: one fixed set of
 *  molecules, each with a seeded seat inside the vesicle that RIDES the
 *  sinking bubble, its own exit moment on the same ramp `cargoAt` empties on
 *  (`uAtThrough('pore', …)`, so picture and model can never disagree about how
 *  full the bag is), a flight out through the pore's mouth, and then a seeded
 *  outward drift through the gap and OFF the frame — it leaves the scene by
 *  travelling, collected by machinery this frame does not show. Nothing ever
 *  fades; nothing ever swaps. Pure function of u, no Math.random. */
export function transmitterAt(
  g: SnareGeometry,
  u: number,
  width = SN_W,
  height = SN_H,
): NtDot[] {
  const out: NtDot[] = []
  const cyF = fusedCentreY(g, u)
  // The drift is scaled from the frame, so a molecule is off the page by the
  // run's end on ANY viewport: the slowest one leaves the mouth with ~0.2 of
  // the run left, and the shallowest velocity crosses the gap in that time.
  const gap = height - g.wallY
  for (let i = 0; i < NT_COUNT; i++) {
    const h = Math.sin(i * 51.3 + 1.7) * 43758.5453
    const j = h - Math.floor(h)
    const h2 = Math.sin(i * 23.9 + 6.1) * 24634.6345
    const j2 = h2 - Math.floor(h2)
    const h3 = Math.sin(i * 12.9898 + 78.233) * 43758.5453
    const j3 = h3 - Math.floor(h3)
    const a = j * Math.PI * 2
    const rr = Math.sqrt(j2) * g.r * 0.66
    // ⚠ Booked on the MOUTH's schedule, not the raw pore ramp (user,
    // 2026-09-03: "NTs start leaving too early — fly through the membrane"):
    // uAtMouthOpen(0) is the instant the membranes fuse, so no molecule is
    // ever in flight while the bag is still sealed.
    const uExit = uAtMouthOpen((i + 0.5) / NT_COUNT)
    if (u <= uExit) {
      // Its seat, riding the bubble down.
      out.push({ x: g.cx + Math.cos(a) * rr, y: cyF + Math.sin(a) * rr, phase: 'inside' })
      continue
    }
    // The seat it left from — frozen at the moment it left.
    const cyExit = fusedCentreY(g, uExit)
    const seat = { x: g.cx + Math.cos(a) * rr, y: cyExit + Math.sin(a) * rr }
    const mouth = { x: g.cx + (j - 0.5) * g.r * 0.24, y: g.wallY }
    const vx = (j3 - 0.5) * width * 0.9
    const vy = gap * (5.5 + 3 * j2)
    const t = u - uExit
    if (t < NT_FLIGHT_U) {
      // A quadratic through the mouth: pinched at the pore, and leaving it
      // with the very velocity the drift continues at — no kink, no jump.
      const q = t / NT_FLIGHT_U
      const exit = { x: mouth.x + vx * NT_FLIGHT_U, y: mouth.y + vy * NT_FLIGHT_U }
      const p1 = lerpP(seat, mouth, q)
      const p2 = lerpP(mouth, exit, q)
      out.push({ ...lerpP(p1, p2, q), phase: 'leaving' })
      continue
    }
    out.push({ x: mouth.x + vx * t, y: mouth.y + vy * t, phase: 'away' })
  }
  // ⚠ GENERATION 2 — THE REFILL TRADE (user, 2026-09-04). The released
  // molecules are gone for good; the new load is NEW transmitter, made and
  // recycled up in the crowd. Each molecule rains in from beyond the frame's
  // top DURING THE LIFT to a waiting queue just outside the transporter, and
  // passes inside only through the transporter's bore — two segments pinned
  // to the door, never through bare membrane (user: "NTs enter the vesicle
  // through membrane — fix"). Seating is booked on `uAtLoadFill`, the very
  // ramp `cargoAt` refills on, and every dot takes the SAME seeded seat its
  // predecessor held: the closing frame is the opening frame, dot for dot.
  const trans = transporterSpot(g, u)
  for (let i = 0; i < NT_COUNT; i++) {
    const h = Math.sin(i * 51.3 + 1.7) * 43758.5453
    const j = h - Math.floor(h)
    const h2 = Math.sin(i * 23.9 + 6.1) * 24634.6345
    const j2 = h2 - Math.floor(h2)
    const a = j * Math.PI * 2
    const rr = Math.sqrt(j2) * g.r * 0.66
    const seat = { x: g.cx + Math.cos(a) * rr, y: cyF + Math.sin(a) * rr }
    const staged = { x: trans.x + (j - 0.5) * g.r * 1.2, y: -30 - j2 * 60 }
    // The queue: an arc of spots on the door's OUTSIDE, riding the bubble.
    const waitA = TRANS_A + (j - 0.5) * 0.9
    const waitR = g.r + LIPID.halfMem + 10 + j2 * g.r * 0.22
    const wait = { x: g.cx + Math.cos(waitA) * waitR, y: cyF + Math.sin(waitA) * waitR }
    const uWait = uAtThrough('refill', 0.3 + 0.6 * ((i + 0.5) / NT_COUNT))
    const uIn = uAtLoadFill((i + 0.5) / NT_COUNT)
    const RAIN = 0.03
    const turn = ntTurnStart(i)
    if (u >= uIn) {
      out.push({ ...seat, phase: 'inside' })
      continue
    }
    if (u > turn + NT_TURN_U) {
      // Through, and drifting to its own seat — the pore has no further part
      // in it, and it is already carrying the next molecule.
      const mouthR = LIPID.halfMem + 5
      const inMouth = {
        x: trans.x - Math.cos(TRANS_A) * mouthR,
        y: trans.y - Math.sin(TRANS_A) * mouthR,
      }
      const q = (u - (turn + NT_TURN_U)) / NT_SETTLE_U
      out.push({ ...lerpP(inMouth, seat, Math.min(1, q)), phase: 'entering' })
      continue
    }
    if (u > turn) {
      // ⚠ THREADS THE BORE (user, 2026-09-04: "let them penetrate the vesicle
      // through the channel"): a quadratic only passes NEAR its control
      // point, and dots were visibly crossing beside the barrel. The pass is
      // piecewise through the barrel's two mouths — outer, then inner — so
      // every molecule crosses the membrane INSIDE the transporter.
      //
      // ⚠ AND ON THE TRANSPORTER'S OWN BEATS (21c-3o): it comes up to the outer
      // mouth while the gates are open on that side, crosses while they are
      // shut around it and swing, and is let go as they open on the lumen. The
      // split is `TURN_IN` — the shared cycle's first beat — not a number typed
      // beside it, so the cargo and the gates cannot drift apart.
      const mouthR = LIPID.halfMem + 5
      const outMouth = {
        x: trans.x + Math.cos(TRANS_A) * mouthR,
        y: trans.y + Math.sin(TRANS_A) * mouthR,
      }
      const inMouth = {
        x: trans.x - Math.cos(TRANS_A) * mouthR,
        y: trans.y - Math.sin(TRANS_A) * mouthR,
      }
      const p = (u - turn) / NT_TURN_U
      const pos =
        p < TURN_IN
          ? // Held at the mouth while the gates open on this side — the same
            // stillness the synapse view's cargo keeps in its seat.
            outMouth
          : lerpP(outMouth, inMouth, (p - TURN_IN) / (1 - TURN_IN))
      out.push({ ...pos, phase: 'entering' })
      continue
    }
    if (u > turn - NT_APPROACH_U) {
      const mouthR = LIPID.halfMem + 5
      const outMouth = {
        x: trans.x + Math.cos(TRANS_A) * mouthR,
        y: trans.y + Math.sin(TRANS_A) * mouthR,
      }
      const q = (u - (turn - NT_APPROACH_U)) / NT_APPROACH_U
      out.push({ ...lerpP(wait, outMouth, q), phase: 'entering' })
      continue
    }
    if (u >= uWait) {
      out.push({ ...wait, phase: 'waiting' })
      continue
    }
    if (u > uWait - RAIN) {
      const q = (u - (uWait - RAIN)) / RAIN
      out.push({ ...lerpP(staged, wait, q), phase: 'entering' })
      continue
    }
    out.push({ ...staged, phase: 'staged' })
  }
  return out
}

/** How far into the run the callouts survive — they belong to the still
 *  picture, and the run is the animation's turn to explain. */
export const LABEL_FADE_U = 0.04

/** ⚠ LABELLED CHECKPOINTS (user, 2026-09-04: "stop the animation at a point
 *  where the elements are still on the stage, display labels, pause, labels
 *  disappear, animation continues"). Two mid-run stops — one is not enough,
 *  because NSF and the coat do not exist yet while calcium and complexin are
 *  on stage: the RELEASE stop, the instant the fourth calcium seats (the
 *  transient release cast is all present and the leg's own hold keeps the
 *  picture still), and the RECYCLING stop, early in the taking-apart (NSF on
 *  the rope, the coat still on). The player pauses at each, labels up. */
export const LABEL_STOPS: readonly number[] = [
  uAtThrough('trigger', 1),
  (() => {
    const s = STAGE_SPANS.find((x) => x.id === 'recycle')!
    return s.from + (s.to - s.from) * 0.3
  })(),
  // The EXCHANGE stop (2026-09-04): mid-trade, pump and transporter both at
  // work, protons leaving, transmitter arriving through the door.
  uAtThrough('load', 0.7),
]

/** How long each labelled checkpoint holds the run. */
export const LABEL_HOLD_MS = 3000

/** ⚠ EACH NAME TIED TO ITS PART (user, 2026-09-02: "give labels connector
 *  lines to the elements they represent"): a callout is a label plus the
 *  point on the machine it names. */
export function snareCallouts(
  g: SnareGeometry,
  u: number,
): { label: SpokenLabel; to: { x: number; y: number } }[] {
  const [stopA, stopB, stopC] = LABEL_STOPS

  if (u >= stopC && u < 1) {
    // ⚠ THE EXCHANGE STILL (2026-09-04): the trade's cast, on stage only here.
    const cy = fusedCentreY(g, u)
    const list: { label: SpokenLabel; to: { x: number; y: number } }[] = [
      {
        label: spoken('transmitter', g.cx + g.r + 60, cy + g.r * 0.22, 'left'),
        to: { x: g.cx + g.r * 0.3, y: cy + g.r * 0.15 },
      },
    ]
    const tr = transporterAt(g, u)
    if (tr) {
      list.push({
        label: spoken('transporter', tr.x - g.r * 1.4, tr.y - 20),
        to: { x: tr.x - 10, y: tr.y - 4 },
      })
    }
    const pm = pumpAt(g, u)
    if (pm) {
      list.push({
        label: spoken('proton pump', pm.x + g.r * 0.42, pm.y + 6, 'left'),
        to: { x: pm.x + 8, y: pm.y },
      })
    }
    const pr = protonsAt(g, u).filter(
      (p) => p.x > 0 && p.x < g.cx * 2 && p.y > 0,
    )
    if (pr.length) {
      // Point at a SEATED proton when one is still inside — a name tied to a
      // ball mid-flight is a name tied to a blur.
      const target = pr.find((p) => p.inside) ?? pr[0]
      list.push({
        label: spoken('protons', g.cx - g.r - 140, cy + g.r * 0.45),
        to: { x: target.x, y: target.y },
      })
    }
    return list
  }

  if (u >= stopA && u < stopB) {
    // ⚠ THE RELEASE STILL (2026-09-04): the transient cast — on stage only
    // mid-run, so this is its one chance to be named. Right-side copies only,
    // like every label set.
    const ends = ropeEnds(g, u)
    const mid = { x: (ends.wall.x + ends.ves.x) / 2, y: (ends.wall.y + ends.ves.y) / 2 }
    const head = sensorHead(g, u)
    const sites = sensorSites(g, u)
    const cy = fusedCentreY(g, u)
    const cpx = complexinAt(g, u)
    const list: { label: SpokenLabel; to: { x: number; y: number } }[] = [
      {
        label: spoken('SNARE complex', mid.x + g.r * 0.66, mid.y - g.r * 0.22, 'left'),
        to: { x: mid.x + 6, y: mid.y - 4 },
      },
      {
        label: spoken('calcium', head.x + g.r * 0.6, head.y - g.r * 0.6, 'left'),
        to: sites[Math.min(3, sites.length - 1)],
      },
      {
        label: spoken('transmitter', g.cx - g.r - 120, cy),
        to: { x: g.cx - g.r * 0.3, y: cy + g.r * 0.2 },
      },
    ]
    if (cpx && cpx.alpha > 0.01) {
      list.push({
        label: spoken('complexin', cpx.x - g.r * 0.9, cpx.y + g.r * 0.3),
        to: { x: cpx.x, y: cpx.y + 4 },
      })
    }
    return list
  }

  if (u >= stopB && u < 1) {
    // ⚠ THE RECYCLING STILL: the take-apart crew, present only here.
    const list: { label: SpokenLabel; to: { x: number; y: number } }[] = []
    const nsf = nsfAt(g, u)
    if (nsf) {
      list.push({
        label: spoken('NSF', nsf.x + g.r * 0.45, nsf.y - g.r * 0.34, 'left'),
        to: { x: nsf.x + g.r * 0.08, y: nsf.y - g.r * 0.08 },
      })
    }
    const studs = clathrinAt(g, u)
    if (studs.length) {
      const top = studs.reduce((a, b) => (b.y < a.y ? b : a))
      list.push({
        label: spoken('clathrin', g.cx - g.r - 150, top.y - 8),
        to: { x: top.x - 4, y: top.y },
      })
    }
    return list
  }

  // The RESTING cast — the opening still, and (Rab out, pump in) the closing
  // one: the run starts with the whole catching crew on screen and ends with
  // the readied bubble, and both stills are labelled from the same list.
  // "SNARE complex" is absent here because at rest there is no complex — the
  // strands are named as the v- and t-SNARE they arrive as and return to.
  const c = { x: g.cx, y: fusedCentreY(g, u) }
  const head = sensorHead(g, u)
  const rab = rabAt(g, u)
  const teth = tetherAt(g, u)
  const stubs = snareStubs(g, u)
  const m18 = munc18At(g, u)
  const m13 = munc13At(g, u)
  const list: { label: SpokenLabel; to: { x: number; y: number } }[] = [
    {
      label: spoken('vesicle', c.x - g.r - 130, c.y - g.r * 0.1),
      to: { x: c.x - g.r * 0.94, y: c.y - g.r * 0.12 },
    },
    {
      label: spoken('synaptotagmin', head.x + g.r * 0.55, head.y + g.r * 0.24, 'left'),
      to: { x: head.x + g.r * 0.14, y: head.y + g.r * 0.06 },
    },
    {
      label: spoken('tether', teth.base.x - g.r * 0.9, teth.tip.y - g.r * 0.1),
      to: lerpP(teth.base, teth.tip, 0.55),
    },
    {
      label: spoken('Munc13', m13.base.x - g.r * 0.9, g.wallY + 58),
      to: lerpP(m13.base, m13.tip, 0.5),
    },
    {
      label: spoken('Munc18', m18.x - g.r * 1.5, g.wallY + 26),
      to: { x: m18.x - 6, y: m18.y + 4 },
    },
  ]
  if (rab.alpha > 0.01) {
    list.push({
      // Beside the Rab, not above it: the transport plate overlays the canvas
      // top, and a name under a control plate is a name nobody gets.
      label: spoken('Rab-GTP', rab.x - g.r - 40, rab.y + 4),
      to: { x: rab.x - 12, y: rab.y - 2 },
    })
  }
  if (stubs) {
    list.push(
      {
        label: spoken('v-SNARE', stubs.vs.to.x - g.r * 1.15, stubs.vs.to.y + g.r * 0.1),
        to: stubs.vs.to,
      },
      {
        label: spoken('t-SNARE', stubs.s25.to.x + g.r * 0.35, g.wallY + 42, 'left'),
        to: lerpP(stubs.syx.to, stubs.s25.to, 0.5),
      },
    )
  }
  // (No pump or transporter entries here: at rest both machines have faded —
  // drawn only while they work — so the closing still carries exactly the
  // opening still's eight names, Rab-GTP back among them.)
  return list
}

/** The spoken labels — only while the callouts are visible (user, 2026-09-02:
 *  "let them disappear when animation starts"): an invisible label must not
 *  stay clickable. Visible at rest, at the run's END (2026-09-04: the closing
 *  still describes all visible elements), and while a labelled checkpoint
 *  HOLDS the run (`held`, driven by the player's own clock). */
export function snareLabels(g: SnareGeometry, u: number, held = false): SpokenLabel[] {
  if (!held && u >= LABEL_FADE_U && u < 1) return []
  return snareCallouts(g, u).map((co) => co.label)
}

export interface SnareView {
  u: number
  width?: number
  height?: number
  /** Label ink override, 0..1 — the player passes 1 while a labelled
   *  checkpoint holds the run. Left undefined, labels show at rest (fading
   *  over the first LABEL_FADE_U) and at the run's end. */
  labelAlpha?: number
  /** ⚠ The thermal clock, screen time (21c-8, Rule 2): the bilayer is this
   *  exhibit's actor, so its molecules jostle — including while the run is
   *  parked on a labelled still. Absent, still, so tests stay deterministic. */
  ms?: number
}

export function drawSnare2(ctx: CanvasRenderingContext2D, v: SnareView): void {
  const width = v.width ?? SN_W
  const height = v.height ?? SN_H
  const g = snareGeometry(width, height)
  const u = Math.max(0, Math.min(1, v.u))

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = OUTSIDE
  ctx.fillRect(0, g.wallY, width, height - g.wallY)

  const zip = zipAt(u)
  const c = vesicleCentre(g, u)
  const cyF = fusedCentreY(g, u)
  const shift = wallShift(g, u)
  // The chord between the omega's feet — where the straight wall is OPEN and
  // the membrane detours up over the arc instead.
  const sinStar = (g.wallY - cyF) / g.r
  const chordHalf =
    sinStar >= 1 ? 0 : g.r * Math.cos(Math.asin(Math.max(-1, Math.min(1, sinStar))))

  // ── the terminal's wall: its oily core stops at the omega's feet.
  ctx.save()
  ctx.strokeStyle = OILY_CORE
  ctx.lineWidth = LIPID.halfMem * 2
  ctx.beginPath()
  if (chordHalf > 0.5) {
    ctx.moveTo(g.left, g.wallY)
    ctx.lineTo(g.cx - chordHalf, g.wallY)
    ctx.moveTo(g.cx + chordHalf, g.wallY)
    ctx.lineTo(g.right, g.wallY)
  } else {
    ctx.moveTo(g.left, g.wallY)
    ctx.lineTo(g.right, g.wallY)
  }
  ctx.stroke()
  ctx.restore()
  // ⚠ Rule 2 (21c-8): membranes are this exhibit's ACTORS — fusion and
  // retrieval are things that happen TO the bilayer — so it jiggles.
  paveMembrane(ctx, wallPoints(g, shift), {
    geom: LIPID,
    first: 0,
    taperOver: 3,
    ms: v.ms ?? 0,
  })

  // ── the transmitter, WITH IDENTITY (user, 2026-09-03): the same molecules
  // from first frame to last — riding the bubble, squeezing out through the
  // mouth each at its own moment, and drifting away off the frame. The two
  // old crossfading dot sets (one inside, one outside) are gone: nothing here
  // fades, everything travels. The ink is the synapse scene's own
  // transmitterDot — the same molecules at a different magnification.
  for (const d of transmitterAt(g, u, width, height)) {
    if (d.x < -12 || d.x > width + 12 || d.y > height + 12 || d.y < -12) continue
    transmitterDot(ctx, d.x, d.y, 3)
  }

  // ── the vesicle itself. Its LUMEN first, in the bath's own ink, then its
  // wall as molecules — this is the one view where they are resolvable, which
  // is what the drawer is for. The ring is the OMEGA: every molecule kept,
  // the merged part unrolled along the wall.
  //
  // ⚠ NO TAPER on a closed ring: it has no ends, and fading its first and last
  // molecules puts a bald patch on a complete object.
  const ring = vesicleRing(g, u)
  const lum = lumenArc(g, cyF)
  if (lum === 'full') {
    // Free bubble: a full round lumen.
    ctx.save()
    ctx.fillStyle = LUMEN
    ctx.beginPath()
    ctx.arc(c.x, cyF, g.r - LIPID.halfMem * 0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  } else if (lum !== 'none') {
    // The pocket still standing proud of the wall — its inside is the same
    // space as the outside below, which the open mouth now shows. The chord
    // closing the arc lies exactly ON the wall line (`lumenArc`), so lumen
    // wash and outside wash meet edge to edge: no gap, no double paint.
    ctx.save()
    ctx.fillStyle = LUMEN
    ctx.beginPath()
    ctx.arc(g.cx, cyF, lum.rLum, Math.PI - lum.a, lum.a, false)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  paveMembrane(ctx, ring, { geom: LIPID, first: 500, taperOver: 0, ms: v.ms ?? 0 })

  // ⚠ NO SECOND BUBBLE. The retrieval used to grow a separate omega at
  // cx − 1.9r — an enclosed circle sitting on an intact wall, in the wrong
  // place (user, 2026-09-02). The retrieval is now the MAIN ring's own sweep
  // run backwards (`fusedCentreY`), so the one bubble reforms open-mouthed at
  // the very spot it fused, and everything above — lumen, chord, wall shift —
  // follows it for free.

  // ── the machinery. Upstream first (2026-09-03): the tether and the Rab
  // badge that CATCH the vesicle, the minders that keep syntaxin honest, then
  // the SNAREs — three separate stubs until docking joins them, the rope
  // after, never both — the clamp, and the sensor that commands it all.
  //
  // ⚠ TWO OF EVERYTHING (user, 2026-09-03: "add a second, mirrored on the
  // left"): the whole cast is drawn once per side — a section through the
  // RING the real machinery stands in around the landing site.
  //
  // ⚠ AND NOTHING VANISHES ANY MORE (user, 2026-09-03: "keep snare and other
  // parts in the membrane"). The rope's ends ride the membranes they live in
  // (`ropeEnds` — the cis-complex lies flat, is set aside by the flow, and
  // STAYS there until NSF lands on it); the sensor and the strands walk home
  // during the taking-apart; the tether and stands simply remain. Each part
  // manages its own ink — there is no machinery-wide fade.
  for (const side of [1, -1] as const) {
    const ends = ropeEnds(g, u, side)
    const stubs = snareStubs(g, u, side)

    // The tether: a long violet arm standing on the wall. Its tip idles
    // curled, reaches up as the bubble comes down, and holds the Rab's
    // shoulder until the SNAREs take over.
    const teth = tetherAt(g, u, side)
    {
      const tdx = teth.tip.x - teth.base.x
      const tdy = teth.tip.y - teth.base.y
      const tlen = Math.hypot(tdx, tdy) || 1
      const tux = tdx / tlen
      const tuy = tdy / tlen
      ctx.save()
      ctx.strokeStyle = TETHER_INK
      ctx.lineWidth = 3.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      const steps = 22
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        // The waves straighten as it stretches out to hold — a coiled spring
        // paying itself out, not a rod growing longer.
        const off = Math.sin(t * Math.PI * 2 * 2.2) * 8 * (1 - teth.hold * 0.72) * (1 - t * 0.35)
        ctx.lineTo(teth.base.x + tux * tlen * t + -tuy * off, teth.base.y + tuy * tlen * t + tux * off)
      }
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(teth.tip.x, teth.tip.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = TETHER_INK
      ctx.fill()
      ctx.restore()
    }

    // The Rab and its badge: a lit GTP while it rides ("I am full and
    // ready"), dimming to GDP across docking, and off the vesicle by the end
    // of priming — extracted, job done.
    const rab = rabAt(g, u, side)
    if (rab.alpha > 0.01) {
      ctx.save()
      ctx.globalAlpha *= rab.alpha
      ctx.beginPath()
      ctx.arc(rab.x, rab.y, g.r * 0.09, 0, Math.PI * 2)
      ctx.fillStyle = RAB_INK
      ctx.fill()
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)'
      ctx.lineWidth = 1.6
      ctx.stroke()
      const bx = rab.x + side * g.r * 0.075
      const by = rab.y - g.r * 0.075
      if (rab.gtp > 0.01) softGlow(ctx, bx, by, 15, GTP_GLOW, 0.55 * rab.gtp)
      ctx.beginPath()
      ctx.arc(bx, by, 5, 0, Math.PI * 2)
      ctx.fillStyle = GTP_DIM
      ctx.fill()
      if (rab.gtp > 0.01) {
        ctx.save()
        ctx.globalAlpha *= rab.gtp
        ctx.beginPath()
        ctx.arc(bx, by, 5, 0, Math.PI * 2)
        ctx.fillStyle = GTP_LIT
        ctx.fill()
        ctx.restore()
      }
      ctx.restore()
    }

    // Syntaxin's minders: Munc18 clasping the folded tip shut, and Munc13's
    // arm standing up at docking to open it. Both fade across priming — their
    // work is over once the rope is winding.
    const m18 = munc18At(g, u, side)
    if (m18.alpha > 0.01) {
      const m13 = munc13At(g, u, side)
      ctx.save()
      ctx.globalAlpha *= m18.alpha
      ctx.strokeStyle = MUNC13_INK
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(m13.base.x, m13.base.y)
      ctx.quadraticCurveTo(
        (m13.base.x + m13.tip.x) / 2 - side * g.r * 0.06,
        (m13.base.y + m13.tip.y) / 2 + g.r * 0.05,
        m13.tip.x,
        m13.tip.y,
      )
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(m18.x, m18.y, g.r * 0.085, g.r * 0.065, -0.5, 0, Math.PI * 2)
      ctx.fillStyle = MUNC18_INK
      ctx.fill()
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)'
      ctx.lineWidth = 1.4
      ctx.stroke()
      ctx.restore()
    }

    // The SNAREs themselves.
    if (stubs) {
      drawStrand(ctx, stubs.vs.from, stubs.vs.to, stubs.vs.colour, 0)
      drawStrand(ctx, stubs.syx.from, stubs.syx.to, stubs.syx.colour, 2.1)
      drawStrand(ctx, stubs.s25.from, stubs.s25.to, stubs.s25.colour, 4.2)
    } else {
      drawSnare(ctx, ends.wall, ends.ves, zip)
    }

    // The complexin clamp: floats in late in priming, lies across the
    // half-wound rope through the whole count, and is flicked away by the
    // same release that frees the sensor — two hands opening together.
    const cpx = complexinAt(g, u, side)
    if (cpx && cpx.alpha > 0.01) {
      ctx.save()
      ctx.globalAlpha *= cpx.alpha
      ctx.translate(cpx.x, cpx.y)
      ctx.rotate(cpx.angle)
      ctx.strokeStyle = COMPLEXIN_INK
      ctx.lineWidth = 4.2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-g.r * 0.17, 0)
      ctx.lineTo(g.r * 0.17, 0)
      ctx.stroke()
      ctx.restore()
    }

    const head = sensorHead(g, u, side)
    const headR = g.r * 0.2
    // The sensor's own anchor: a stalk from the membrane it CURRENTLY sits
    // in — the vesicle while riding and gripping, the wall after the release
    // swing (its membrane became wall), and the vesicle again once the
    // recycling has sorted it home. Drawing the stalk is what makes the head
    // a part instead of four floating dots.
    const av = Math.atan2(head.y - cyF, head.x - g.cx)
    const vesAnchor = { x: g.cx + Math.cos(av) * g.r, y: cyF + Math.sin(av) * g.r }
    const wallAnchor = { x: head.x - side * g.r * 0.08, y: g.wallY - LIPID.halfMem }
    const swing =
      Math.min(1, through(u, 'zipper') / CLAMP_OFF) * (1 - disassembleAt(u))
    const anchor = lerpP(vesAnchor, wallAnchor, swing)
    ctx.save()
    ctx.strokeStyle = GLOSSY_COLORS.ca.dark
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(anchor.x, anchor.y)
    ctx.quadraticCurveTo(
      (anchor.x + head.x) / 2 + side * g.r * 0.12,
      (anchor.y + head.y) / 2,
      head.x,
      head.y,
    )
    ctx.stroke()
    // ⚠ THE GRIP, drawn as contact (user, 2026-09-02: "not clear how
    // synaptotagmin affects the SNARE complex"): while the sensor is still
    // counting, a clamp band crosses the rope exactly where the head holds
    // it — the pause has a visible hand on the machine.
    const release = Math.min(1, through(u, 'zipper') / CLAMP_OFF)
    // The grip band exists only once there IS a rope to grip — on the way
    // down the sensor rides its vesicle empty-handed.
    if (!stubs && release < 1) {
      const gripX = (ends.wall.x + ends.ves.x) / 2
      const gripY = (ends.wall.y + ends.ves.y) / 2
      ctx.globalAlpha *= 1 - release
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(gripX - side * g.r * 0.22, gripY - 3)
      ctx.lineTo(head.x, head.y)
      ctx.stroke()
    }
    ctx.restore()
    // The go-flash: the moment the full sensor lets go, a glow runs from its
    // grip point down the rope toward the wall — cause travelling to effect.
    if (release > 0 && release < 1) {
      const gx = (ends.wall.x + ends.ves.x) / 2
      const gy = (ends.wall.y + ends.ves.y) / 2
      softGlow(
        ctx,
        gx + (ends.wall.x - gx) * release,
        gy + (ends.wall.y - gy) * release,
        14,
        GLOSSY_COLORS.ca.glow,
        0.6 * (1 - release * 0.5),
      )
    }
    // The head itself, wearing its four sites.
    ctx.save()
    ctx.beginPath()
    ctx.arc(head.x, head.y, headR, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'
    ctx.fill()
    ctx.strokeStyle = GLOSSY_COLORS.ca.dark
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
    const sites = sensorSites(g, u, side)
    for (const s of sites) {
      ctx.beginPath()
      ctx.arc(s.x, s.y, 6.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
      ctx.fill()
      ctx.strokeStyle = GLOSSY_COLORS.ca.dark
      ctx.lineWidth = 1.6
      ctx.stroke()
      if (s.full) softGlow(ctx, s.x, s.y, 16, GLOSSY_COLORS.ca.glow, 0.5)
    }

    // NSF: the red barrel that drops onto the spent rope and takes it apart —
    // the visible cause of the strands walking home.
    const nsf = nsfAt(g, u, side)
    if (nsf) {
      ctx.save()
      ctx.globalAlpha *= nsf.alpha
      ctx.beginPath()
      ctx.arc(nsf.x, nsf.y, g.r * 0.12, 0, Math.PI * 2)
      ctx.fillStyle = NSF_INK
      ctx.fill()
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)'
      ctx.lineWidth = 1.8
      ctx.stroke()
      // The barrel's bore — NSF is a ring machine, and the hole says so.
      ctx.beginPath()
      ctx.arc(nsf.x, nsf.y, g.r * 0.045, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'
      ctx.fill()
      ctx.restore()
    }
  }

  // ── the clathrin coat, as TRISKELIONS (21c-10, handover of 2026-09-06).
  // They were flat studs; the endocytosis drawer now draws the coat as the
  // three-legged pinwheels the protein actually is, from the shared module —
  // and one coat must be one object across the app, so this bench draws the
  // very same shape at its own magnification.
  for (const stud of clathrinAt(g, u)) {
    drawTriskelion(ctx, stud, g.r * 0.24, stud.angle * 2.399, stud.alpha)
  }

  // ── dynamin, at THIS bench's own neck (21c-10, user: "adjust 'vesicle &
  // snare machinery' with the newly created elements"). The pinch that frees
  // the reforming bud had no machine doing it — a neck that snapped by itself.
  // The same coil, late in the retrieval, squeezing as the bud comes free.
  const dyn = snareDynaminAt(g, u)
  if (dyn) {
    drawDynamin(ctx, { x: g.cx, y: dyn.y }, dyn.halfW, dyn.height, dyn.squeeze, dyn.alpha)
  }

  // ── the proton pump and the transporter, riding the readied bubble, and
  // the protons: in through the pump (the souring), OUT through the
  // transporter as the transmitter is traded in. Both machines drawn only
  // while they work; the protons are the atomic playground's own glossy red —
  // the shared + charge colour — and MUCH smaller than a transmitter dot,
  // because a proton is.
  const pump = pumpAt(g, u)
  if (pump) {
    ctx.save()
    ctx.globalAlpha *= pump.alpha
    ctx.translate(pump.x, pump.y)
    ctx.rotate(pump.a + Math.PI / 2)
    ctx.fillStyle = V_ATPASE_INK
    ctx.beginPath()
    ctx.roundRect(-5, -LIPID.halfMem * 1.1, 4, LIPID.halfMem * 2.2, 2)
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(1, -LIPID.halfMem * 1.1, 4, LIPID.halfMem * 2.2, 2)
    ctx.fill()
    ctx.restore()
  }
  const trans = transporterAt(g, u)
  if (trans) {
    // ⚠ IT IS VGLUT, AND IT LOOKS LIKE VGLUT (21c-3o). It was a hand-drawn
    // barrel in the pump family's indigo — which is EAAT's ink — while the
    // synapse view drew the same protein from the user's own handover in
    // purple. One biology, one drawing: the traced glyph, the code book's
    // colour, and the cycle it runs there, at the register where the bilayer is
    // resolved so the protein can span it honestly.
    //
    // ⚠ MIRRORED HERE, at the one place it is drawn: the glyph stands across
    // the bubble's wall with its far end in the LUMEN, so the transporter's own
    // sign — −1 open to where the cargo comes from — is flipped for the
    // drawing, exactly as the synapse view flips it.
    ctx.save()
    ctx.globalAlpha *= trans.alpha
    drawMovingGlyph(
      ctx,
      VGLUT_GLYPH,
      { x: trans.x, y: trans.y },
      trans.a + Math.PI / 2,
      CHANNEL_INK.vglut,
      VGLUT_SPAN_SN,
      -vglutOpenAt(g, u),
    )
    ctx.restore()
  }
  for (const p of protonsAt(g, u)) {
    if (p.x < -8 || p.x > width + 8 || p.y < -8 || p.y > height + 8) continue
    drawGlossyIon(ctx, 'h', p.x, p.y, 2, 0.95)
  }
  // ── the calcium ions themselves — each FLOATS IN from beyond the frame (its
  // doors are not in this picture; the left sensor's come from the left edge),
  // seats on its own site at the moment the model fills it, and floats out
  // when the collapse lets go. The seated ion IS the site's filling: one ball,
  // one identity, never a swap.
  for (const side of [1, -1] as const) {
    for (const ion of calciumFlight(g, u, width, side)) {
      drawGlossyIon(ctx, 'ca', ion.x, ion.y, 5.5, 0.9)
    }
  }

  // ── what stage this is, named. A reading on the canvas, not an explanation.
  // At the BOTTOM, with the calcium count: the transport now overlays the
  // canvas top (user, 2026-09-02: "place button bars onto the canvas"), and a
  // reading under a control plate is a reading nobody gets.
  const { stage } = stageAt(u)
  ctx.fillStyle = INK
  ctx.font = 'bold 14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(stage.title, width / 2, height - 30)
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText(`${sitesFilled(u)} of ${HILL_N} calcium`, width / 2, height - 12)

  // ── the callouts: each name tied to its part by a connector line. Visible
  // at rest (fading over the run's first few percent — user, 2026-09-02:
  // "let them disappear when animation starts"), at the run's END (the
  // closing still describes all visible elements), and while a labelled
  // checkpoint holds the run (the player passes labelAlpha = 1).
  const labelA = v.labelAlpha ?? Math.max(u >= 1 ? 1 : 0, 1 - u / LABEL_FADE_U)
  if (labelA > 0.01) {
    ctx.save()
    ctx.globalAlpha *= labelA
    for (const co of snareCallouts(g, u)) {
      const l = co.label
      ctx.strokeStyle = INK
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(l.x + l.w / 2, l.y + l.h / 2)
      ctx.lineTo(co.to.x, co.to.y)
      ctx.stroke()
      drawSpoken(ctx, l)
    }
    ctx.restore()
  }
}

/** How long the cycle takes on screen. Declared, like every other clock here:
 *  the real thing is under a millisecond from calcium to pore. Raised
 *  13 s → 20 s (user, 2026-09-03: "make animation slower"), alongside the
 *  still beats the stage `hold`s insert after each important event. */
/** ⚠ SCALED BY THE STAGES' OWN WEIGHT (21c-3o). It was a flat 20 s; when the
 *  refill trade was given the time its cycle needs, keeping 20 s would have
 *  squeezed every other stage to pay for it. Multiplying by the weight means
 *  each stage keeps `share × 20 s` of screen whatever the others do — measured:
 *  the run goes 20 s → ~30 s, and only the trade is longer. */
export const SNARE_SCREEN_MS = Math.round(20000 * STAGE_WEIGHT)

export { PRIMED_ZIP }
