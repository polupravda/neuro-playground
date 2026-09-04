import { drawSceneChannel } from './sceneProtein'
import { TRANSMITTER_INK } from './synapseScene'
import { BOUTON_BOX, BOUTON_FOOT, boutonPath, type BoutonFit } from './boutonShape'
import type { NeuronPartId } from '../core/neuron'
import { SIGNAL_CORE, SIGNAL_RGB, softGlow } from './signal'
import {
  LABEL_INK,
  LABEL_PLATE,
  LABEL_PX,
  drawConnector,
  labelFont,
  speakerGlyph,
} from './spokenLabels'
import { THRESHOLD } from '../core/integration'
import {
  AXON_POLYLINE,
  AXON_W,
  BILAYER_SCALE,
  bilayerBlend,
  BOUTON_R,
  CLEFT,
  DENDRITE_STROKES,
  strokeWidthAt,
  type DendriteStroke,
  DENDRITE_TRUNKS,
  HILLOCK,
  INPUTS,
  LABELS,
  LIPID_JITTER,
  LIPID_PACKING,
  LIPID_PX,
  MARKER_R,
  MEMBRANE_PX,
  OUTPUT,
  ASTROCYTES,
  DENDRITE_ASTROCYTES,
  astroShape,
  astroNucleus,
  OUTGOING,
  SOMA,
  SOMA_OUTLINE,
  sceneTermSpeaks,
  SOMA_R,
  SPINE_HEAD_R,
  spineHead,
  TERMINAL_BRANCHES,
  TERMINALS,
  ARBOR_TAIL_PX,
  arborFronts,
  terminalArrival,
  TUBE_SCALE,
  VESICLE_OFFSETS,
  VESICLE_R,
  ZOOM_TARGETS,
  clamp01,
  pathLength,
  polylinePoint,
  wallSample,
  STAGE_H,
  STAGE_W,
  type Pt,
  type WallSample,
} from './layout'
import type { ChainState } from './chain'
import { ION_SCALE, ionAt, ionRadius, type IonInstance } from './ions'
import {
  PROTEIN_BARREL_IN,
  PROTEIN_OUT,
  PUMP_HEAD,
  carriedDepth,
  channelIonsAt,
  proteinIn,
  type CarriedIon,
  pumpStateAt,
  type ProteinInstance,
} from './proteins'
import { gateOf, type ChannelType, type GateEnv } from '../core/channels'
import { VM_MAX, VM_MIN, nernstMv } from '../core/voltage'
import { AP_REAL_MS, polarizationT, spotlightState } from '../core/actionPotential'
import type { IonCounts } from '../state/ionStore'
import { IONS, ION_KINDS, type IonKind } from '../core/ions'
import {
  GLOSSY_COLORS,
  chargeWash,
  ionGradient,
  drawIonCharge,
  badgeMinR,
} from './particleStyle'
import { mix, paveMembrane, type LipidGeom } from './bilayer'

// Everything on the canvas is painted here, on the raw 2D context, so growth,
// glow and travelling signals can be driven per frame from refs. Hit
// detection is NOT done here — transparent Konva primitives handle that.

/** Placeholder anchor for labels pinned to the canvas, which ignore it. */
const ORIGIN: Pt = { x: 0, y: 0 }

const MEMBRANE = '#94a3b8'
// Only a little brighter than resting membrane: the travelling signal is
// near-white, and a white "highlight" would swallow it.
const MEMBRANE_HOT = '#b8c4d4'
const PARTNER = '#5b6879'
const PARTNER_HOT = '#8fa0b4'
const CYTOPLASM = 'rgba(148, 163, 184, 0.12)'
const CYTOPLASM_SOLID = 'rgba(100, 116, 139, 0.24)'
/** ⚠ A SPINE HEAD IS A SWELLING OF THE DENDRITE, SO IT IS FILLED LIKE ONE
 *  (user, 2026-09-04: "make dendritic thickenings filled — currently outline
 *  only"). The cytoplasm wash the branches are drawn with is 0.12 and reads
 *  as nothing at a six-pixel bulb: a shape that small needs a body, or it is
 *  a ring. */
const SPINE_FILL = 'rgba(148, 163, 184, 0.62)'
const SPINE_FILL_PARTNER = 'rgba(100, 116, 139, 0.7)'
/** ⚠ HOW PROMINENT THE DENDRITIC FIELD'S GLIA ARE (user, 2026-09-04: "make
 *  astrocytes on the left side slightly transparent, so they are not as
 *  prominent"). They are the neighbourhood the branches run through, not the
 *  subject — the two at the synapse stay at full strength because that
 *  synapse is a place the app teaches. */
const DENDRITE_GLIA_ALPHA = 0.5
const NUCLEUS = 'rgba(71, 85, 105, 0.85)'
/** The glial nucleus: the cell's own green, taken darker — a nucleus is
 *  denser than the cytoplasm round it, and reading as a different SUBSTANCE
 *  from the neurons' slate is the point of the green in the first place. */
const ASTRO_NUCLEUS = 'rgba(56, 102, 80, 0.9)'
const VESICLE = '#cbd5e1'
// ⚠ ONE LABEL STYLE, THE APP'S (user, 2026-09-04: "unify labels across the
// app. Source of truth: vesicle view"). This scene ran a second system —
// 13px `ui-sans-serif`, a slate plate, and an ink two steps dimmer than every
// other canvas — so the same word looked like two different kinds of thing
// depending on which view you were standing in. The plate, the ink and the
// font now come from `spokenLabels`, which is what the vesicle view draws
// with. NAMES here still do not carry a speaker: voice is per term.
const LABEL = LABEL_INK
const LABEL_HOT = '#f8fafc'
const PLATE_PAD = 5
/** ⚠ NAVIGATION IS YELLOW (user, 2026-09-04: "make nav dashed circles
 *  yellow"). A door was first made findable in near-white — chrome rather
 *  than anatomy — with the yellow held back for hover. The user's call goes
 *  further and is better: the map's "you are here" ring was ALREADY amber,
 *  so a yellow dashed circle now means one thing everywhere, on the stage
 *  and on the miniature alike — this is a place you can go, or the place you
 *  are. Hover is still unmistakable: it adds the glow and the name. */
const MARKER_HOT = '250, 204, 21'
const MARKER_REST = MARKER_HOT
// A whisper of tint marks the hydrophobic middle — a genuinely different
// chemical environment, and the reason ions need channels at all. Deliberately
// faint: the tails themselves show where the core is, and an opaque band there
// reads as filler.
const OILY_CORE = 'rgba(148, 163, 184, 0.1)'
// Proteins get their own family: copper for the pump, cooler bronze for a
// channel. Distinct from the lipids (pale slate), the ions (gold/violet/green/
// pink) and the amber reserved for explanation.
const PROTEIN_MID = '#c08552'
const PROTEIN_DARK = '#7a5232'
const CHANNEL_MID = '#9a8b6a'
const CHANNEL_DARK = '#5f5540'
const PROTEIN_EDGE = 'rgba(247, 210, 165, 0.55)'
const CHANNEL_EDGE = 'rgba(226, 214, 184, 0.4)'
// A protein's colours come in three strengths. Fading alpha alone turned out not
// to be enough: a bronze shape at a third opacity still reads as bronze, and the
// eye keeps finding it. The drained pair takes the copper out as well, so the
// difference is hue and not just weight.
const PROTEIN_TINT = {
  mid: PROTEIN_MID,
  dark: PROTEIN_DARK,
  edge: PROTEIN_EDGE,
}
// Drained takes the COLOUR out; it must not take the substance out. A protein
// faded down toward the background left its slot in the lipids reading as a gap
// in the membrane — and a hole in the barrier is a worse lie than a distracting
// protein, because "ions cannot cross except at a channel" is the lesson the
// whole bilayer exists to teach. So the grey stays as light as the lipids are.
const DRAINED_TINT = {
  mid: '#68717f',
  dark: '#48505d',
  edge: 'rgba(148, 163, 184, 0.34)',
}
// The spotlight is WHITE light, deliberately: gold would be read as sodium and
// violet as potassium, and this has to mean "look here", not "this species".
const SPOT_RGB = '255, 251, 235'
const SPOT_EDGE = 'rgba(255, 251, 235, 0.85)'

// `mix` used to be defined here TOO — a private copy identical to the one in
// bilayer.ts, including its bug: it read hexadecimal only and returned
// `rgb(NaN, NaN, NaN)` for anything else. One copy was fixed; a second copy of a
// fixed bug is a bug that comes back. Imported now.

/** A channel wears the colour of what it lets through (N13).
 *
 *  Blended INTO the protein bronze rather than replacing it — a channel drawn in
 *  flat sodium gold would read as being made of sodium, and the palette's whole
 *  point is that proteins, lipids and ions are three different kinds of thing.
 *  The selectivity filter, the narrow waist of the pore that actually does the
 *  choosing, is the one part painted at full species strength: that is precisely
 *  where "only potassium fits" happens. */
function channelTint(channel: ChannelType): {
  mid: string
  dark: string
  edge: string
  filter: string
} {
  const c = GLOSSY_COLORS[channel.passes[0]]
  return {
    // Enough to name the ion, not enough to stop looking like protein: at much
    // above this the violet channels went from tinted bronze to lilac plastic.
    mid: mix(CHANNEL_MID, c.mid, 0.38),
    dark: mix(CHANNEL_DARK, c.dark, 0.34),
    edge: CHANNEL_EDGE,
    filter: c.mid,
  }
}

/** The pump keeps its copper. It carries both ions, so a single species colour
 *  would be a lie — and staying uncoloured is the visible half of "a machine,
 *  not a hole", which is the lesson it exists to teach. */
const PORE = 'rgba(2, 6, 23, 0.6)'
const ATP_RGB = '134, 239, 172'
// Red is charge, per the shared palette — so a voltage sensor's charged
// residues are drawn in it.

// Electricity is drawn as warm light (gold is also the Na⁺ family colour, and
// depolarization IS Na⁺ influx). Chemistry is drawn as discrete particles in
// the transmitter's own ink — THE SAME CONSTANT the synapse scene uses, not a
// colour that happens to match (2026-09-01: transmitter went teal everywhere
// at once). Keeping the two grammars apart is the point: the hand-off between
// them is a transformation, not a continuation.
const MESSENGER = TRANSMITTER_INK.mid

/** Visible area in scene coordinates. */
export interface ViewRect {
  left: number
  right: number
  top: number
  bottom: number
}

export interface SceneState {
  /** ⚠ Whether the scene draws its NAMES (the app's one 🏷 switch,
   *  2026-09-04). Readings on a scale — the voltage panel, the magnification,
   *  the hillock meter's `threshold`/`total`, a channel's `open`/`shut` — are
   *  never hidden by it: a graph without its axis is not a simpler graph. */
  labelsOn?: boolean
  selected: NeuronPartId | null
  hovered: NeuronPartId | null
  hoveredInput: number | null
  hoveredMarker: string | null
  /** Which input neurons are taking part in the current run. */
  firedInputs: number[]
  chain: ChainState
  /** Camera magnification, so chrome can be counter-scaled to stay legible. */
  cameraScale: number
  showMarkers: boolean
  view: ViewRect
  /** The ion crowds on either side of a membrane patch, laid out once and
   *  jiggled procedurally from `timeMs`. */
  ions: Record<'outside' | 'inside', IonInstance[]>
  /** Species in focus; the rest are drawn grey. */
  highlighted: Record<IonKind, boolean>
  /** Proteins embedded in the membrane patches. */
  proteins: ProteinInstance[]
  pumpOn: boolean
  leaksOn: boolean
  /** What the channel gates are answering to right now. */
  gateEnv: GateEnv
  /** Current ion counts, so a channel's flow follows the real gradient. */
  counts: IonCounts
  /** Membrane voltage right now, mV — settled toward its target, not snapped. */
  vm: number
  /** The voltage a spike would trace, sampled evenly across it (N17). Present
   *  whenever a membrane patch is in view, spike or no spike: the shape is a
   *  pure function of the gradients, so it can be shown before one is fired —
   *  and it visibly changes shape the moment a gradient is dragged. */
  apTrace: number[]
  /** How far through a spike we are, 0→1, or null at rest. */
  apU: number | null
  /** How recently each voltage-gated channel changed state, 1→0, keyed by
   *  channel id. Null when no spike is running. */
  gateFlash: Record<string, number> | null
  /** How brightly to draw each protein, keyed by channel id and 'pump'. Null
   *  when nothing is being singled out, which is most of the time. */
  emphasis: Record<string, number> | null
  /** What the voltage would be at rest, mV. The aura shows the DIFFERENCE from
   *  this: that difference is exactly what the words depolarized and
   *  hyperpolarized mean. */
  vmRest: number
  timeMs: number
}

/** Konva's context wrapper hides the real 2D context we draw on. */
export function nativeCtx(ctx: unknown): CanvasRenderingContext2D {
  return (ctx as { _context: CanvasRenderingContext2D })._context
}

// ---------------------------------------------------------------- visibility

function inView(v: ViewRect, p: Pt, pad = 0): boolean {
  return (
    p.x >= v.left - pad &&
    p.x <= v.right + pad &&
    p.y >= v.top - pad &&
    p.y <= v.bottom + pad
  )
}

/** Crude bounding-box overlap — enough to skip work that cannot be seen. */
function spanInView(v: ViewRect, a: Pt, b: Pt, pad = 0): boolean {
  return (
    Math.min(a.x, b.x) <= v.right + pad &&
    Math.max(a.x, b.x) >= v.left - pad &&
    Math.min(a.y, b.y) <= v.bottom + pad &&
    Math.max(a.y, b.y) >= v.top - pad
  )
}

function pathInView(v: ViewRect, path: Pt[], pad = 0): boolean {
  for (let i = 1; i < path.length; i++) {
    if (spanInView(v, path[i - 1], path[i], pad)) return true
  }
  return false
}

// -------------------------------------------------------------------- basics

function partAlpha(
  part: NeuronPartId,
  selected: NeuronPartId | null,
  hovered: NeuronPartId | null,
): number {
  if (selected === null) return hovered === part ? 1 : 0.85
  if (selected === part) return 1
  return 0.28
}

export interface ScreenLabel {
  text: string
  /** Scene point the label belongs to. */
  at: Pt
  /** Nudge in SCREEN pixels from that point. */
  dx?: number
  dy?: number
  color: string
  size?: number
  align?: CanvasTextAlign
  alpha?: number
  /** A label already inside a panel does not need a plate of its own. */
  plate?: boolean
  /** Ring the plate, for the one thing currently being pointed at. */
  accent?: boolean
  /** ⚠ THE TERM THIS LABEL SAYS ALOUD (F04), if it has been given a voice.
   *
   *  Voice is per term, on request — so this is set only where the user has
   *  asked for it (2026-09-04: "add voice on the labels, which name neuron
   *  parts (not navigation)"). A marker's label names a DOOR, not a part of
   *  the cell, and gets none. */
  speak?: string
  /** ⚠ THE THING THIS NAME NAMES, in scene coordinates — a leader is drawn to
   *  it (user, 2026-09-04, unifying on the vesicle view, which ties every
   *  name to its part).
   *
   *  Given ONLY for a name that points at a discrete thing. A name for an
   *  extended structure (the dendritic fan, the axon, the arbor) gets none:
   *  a line to one point on a two-hundred-pixel fan reads as "this one
   *  branch". Nor does a half-plane (`outside the cell`), which has no point
   *  to aim at. And never for a reading on a scale — a leader from "−70 mV"
   *  to a membrane would claim the number is a name for it. */
  to?: Pt
  /** Treat dx/dy as absolute CANVAS pixels and ignore `at` entirely.
   *
   *  For chrome pinned to a corner of the canvas. It used to be given a scene
   *  anchor at the view's top-left, which worked only while the camera was an
   *  unrotated scale: once it could turn to face a membrane, the view rect became
   *  a bounding box, that corner stopped being the screen's corner, and the
   *  voltage panel's numbers and the magnification readout were flung off the
   *  canvas. Chrome pinned to the canvas belongs in canvas coordinates. */
  screen?: boolean
}

/** A queued label, already resolved to screen pixels. */
interface PlacedLabel {
  text: string
  x: number
  y: number
  color: string
  size: number
  align: CanvasTextAlign
  alpha: number
  plate: boolean
  accent: boolean
  /** Where the leader points, already in screen pixels. */
  to?: { x: number; y: number }
  speak?: string
  /** Device pixel ratio in force when it was queued. */
  ratio: number
}

// Labels are collected through the frame and painted at the very END of it, so
// nothing drawn later can cross the words — on a membrane patch the ion crowd
// was drifting straight over the channel names. Each is resolved to a screen
// position as it is queued, under the transform in force at that moment, so
// deferring the paint cannot move it.
let queuedLabels: PlacedLabel[] = []

/** ⚠ THE SPOKEN LABELS OF THE FRAME JUST DRAWN, in CANVAS pixels.
 *
 *  The scene's names are painted on a canvas, not laid out as elements, and
 *  their final places are only known once the frame has been composed — the
 *  camera has moved them and the keep-out nudger may have pushed them
 *  sideways. So the drawing records where each spoken name actually landed
 *  and the stage hit-tests against THAT, which is the same rule the other
 *  views follow: a hit box is built from the geometry the drawing used. */
let spokenBoxes: { term: string; x: number; y: number; w: number; h: number }[] = []

/** Which spoken name is under this canvas point, if any. */
export function sceneSpokenTermAt(x: number, y: number): string | null {
  for (const b of spokenBoxes) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.term
  }
  return null
}

/** Screen rects a label may not sit on. Painting the labels last keeps the words
 *  on top of the ions, but it also puts them on top of the instruments, and the
 *  channel nearest a corner had its name landing on the voltage meter on any
 *  short window. So each piece of corner chrome declares its footprint and
 *  labels step around it. */
let labelKeepOut: Array<{ x: number; y: number; w: number; h: number }> = []

/** Gap left between a nudged label and the thing it stepped around. */
const KEEP_OUT_GAP = 8

/** Queue labels to be drawn in SCREEN space, at a real font size.
 *
 *  Text cannot be drawn in scene coordinates: counter-scaling the font by
 *  1/magnification means asking for a 0.005 px font at ×3100, which the canvas
 *  simply refuses to render. So each anchor is mapped through the layer matrix
 *  by hand here, and the text is painted at a normal size by `flushLabels`
 *  once the rest of the frame is done. */
function screenLabels(
  ctx: CanvasRenderingContext2D,
  s: SceneState,
  labels: ScreenLabel[],
): void {
  if (labels.length === 0) return
  const m = ctx.getTransform()
  // The MAGNITUDE of the transform's first column, not m.a: the layer may be
  // rotated (it turns to face a membrane patch), and m.a is then scale·cosθ,
  // which would put every label in the wrong place by that factor.
  const ratio = s.cameraScale === 0 ? 1 : Math.hypot(m.a, m.b) / s.cameraScale
  for (const l of labels) {
    queuedLabels.push({
      text: l.text,
      x: l.screen
        ? (l.dx ?? 0)
        : (m.a * l.at.x + m.c * l.at.y + m.e) / ratio + (l.dx ?? 0),
      y: l.screen
        ? (l.dy ?? 0)
        : (m.b * l.at.x + m.d * l.at.y + m.f) / ratio + (l.dy ?? 0),
      color: l.color,
      size: l.size ?? LABEL_PX,
      align: l.align ?? 'left',
      alpha: l.alpha ?? 1,
      plate: l.plate ?? true,
      accent: l.accent ?? false,
      speak: l.speak,
      to:
        l.to === undefined
          ? undefined
          : {
              x: (m.a * l.to.x + m.c * l.to.y + m.e) / ratio,
              y: (m.b * l.to.x + m.d * l.to.y + m.f) / ratio,
            },
      ratio,
    })
  }
}

/** Paint every queued label, each on its own dark plate, above the scene. */
function flushLabels(ctx: CanvasRenderingContext2D): void {
  if (queuedLabels.length === 0) return
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  for (const l of queuedLabels) {
    ctx.setTransform(l.ratio, 0, 0, l.ratio, 0, 0)
    ctx.globalAlpha = l.alpha
    ctx.font = labelFont(l.size)
    ctx.textAlign = l.align
    // Plate height comes from the font size, not from these particular glyphs,
    // so a row of labels lines up whatever letters it happens to contain.
    const w = ctx.measureText(l.text).width
    const top = l.y - l.size * 0.95
    const h = l.size * 1.35
    let left = l.align === 'right' ? l.x - w : l.align === 'center' ? l.x - w / 2 : l.x
    let x = l.x
    // Labels inside a panel (plate: false) belong there and are left alone.
    if (l.plate) {
      for (const k of labelKeepOut) {
        if (
          left - PLATE_PAD < k.x + k.w &&
          left + w + PLATE_PAD > k.x &&
          top < k.y + k.h &&
          top + h > k.y
        ) {
          // Sideways, not upward: the channel names sit in a band just under the
          // membrane, and lifting one out of that band would read as belonging
          // to something else. Push away from whichever edge is nearer, so this
          // works for a left-hand instrument and a right-hand one alike.
          const toRight = left + w / 2 > k.x + k.w / 2
          const shift = toRight
            ? k.x + k.w + KEEP_OUT_GAP - (left - PLATE_PAD)
            : k.x - KEEP_OUT_GAP - (left + w + PLATE_PAD)
          left += shift
          x += shift
        }
      }
    }
    // ⚠ THE LEADER IS DRAWN FROM THE LABEL'S FINAL PLATE, after the keep-out
    // nudge above has moved it. Drawn from the anchor the label was queued
    // with, it would miss its own plate by up to a plate's width whenever a
    // panel pushed the name aside.
    if (l.to) {
      drawConnector(ctx, { x: left - PLATE_PAD, y: top, w: w + PLATE_PAD * 2, h }, l.to)
    }
    if (l.plate) {
      ctx.fillStyle = LABEL_PLATE
      ctx.beginPath()
      ctx.roundRect(left - PLATE_PAD, top, w + PLATE_PAD * 2, h, 5)
      ctx.fill()
      if (l.accent) {
        ctx.strokeStyle = SPOT_EDGE
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
    ctx.fillStyle = l.color
    ctx.fillText(l.text, x, l.y)
    // ⚠ F04's speaker, and the box a finger has to land in — recorded from
    // the label's FINAL position, after the keep-out nudge, so the target is
    // exactly where the word ended up. Never a second set of numbers.
    if (l.speak !== undefined) {
      const gx = left - PLATE_PAD - 9
      speakerGlyph(ctx, gx, l.y - l.size * 0.3)
      spokenBoxes.push({
        term: l.speak,
        x: gx - 10,
        y: top - 4,
        w: w + PLATE_PAD * 2 + 20,
        h: h + 8,
      })
    }
  }
  ctx.restore()
  queuedLabels = []
}

/** Run `draw` with the transform reset to plain canvas pixels, for chrome that
 *  is geometry rather than text (see screenLabels for why scene space will not
 *  do at high magnification). */
function withScreen(
  ctx: CanvasRenderingContext2D,
  s: SceneState,
  draw: (c: CanvasRenderingContext2D, toScreen: (p: Pt) => Pt) => void,
): void {
  const m = ctx.getTransform()
  const ratio = s.cameraScale === 0 ? 1 : Math.hypot(m.a, m.b) / s.cameraScale
  const toScreen = (p: Pt): Pt => ({
    x: (m.a * p.x + m.c * p.y + m.e) / ratio,
    y: (m.b * p.x + m.d * p.y + m.f) / ratio,
  })
  ctx.save()
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  draw(ctx, toScreen)
  ctx.restore()
}

function line(
  ctx: CanvasRenderingContext2D,
  a: Pt,
  b: Pt,
  width: number,
  color: string,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

function strokePath(
  ctx: CanvasRenderingContext2D,
  path: Pt[],
  width: number,
  color: string,
): void {
  if (path.length < 2) return
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y)
  ctx.stroke()
}

function disc(ctx: CanvasRenderingContext2D, c: Pt, r: number, fill: string): void {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
  ctx.fill()
}

// ------------------------------------------------------------ membrane (N07)

const HALF_MEM = MEMBRANE_PX / 2
const HEAD_R = LIPID_PX / 2

/** The scene's molecule is the SAME molecule the benches draw — one shape,
 *  one set of proportions, in `stage/bilayer.ts` — at this view's own honest,
 *  magnification-derived size. Only the size differs, which is the whole point
 *  of the scene: out here a lipid is as big as a lipid really is.
 *
 *  (Until 2026-08-28 this file had its own version, with curved tails, a wider
 *  splay and a bigger gap at the midplane. Two drawings of one molecule.) */
const SCENE_LIPID: LipidGeom = { headR: HEAD_R, halfMem: HALF_MEM }

/** The charge on an ion. One line, because there is one way to draw this in
 *  the whole app now (`drawIonCharge`, 2026-08-28): a ± badge just off the
 *  ball's top-right shoulder, in the charge inks.
 *
 *  It used to be a dark mark stamped INSIDE the ion here, a big red plus
 *  floating above it in the permeability bench, and briefly a ring in the
 *  charge bench. Three drawings of one property is how a visual language
 *  stops being one. */
function chargeMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  positive: boolean,
  cameraScale: number,
): void {
  // The camera's magnification is what turns these world units into screen
  // pixels, so it is what converts the badge's screen-space floor.
  drawIonCharge(ctx, x, y, radius, positive ? 1 : -1, undefined, badgeMinR(cameraScale))
}

/** Enter a membrane patch's local frame: +x along the membrane, +y toward the
 *  cytoplasm. Everything living at a patch is drawn in these coordinates, so
 *  "inside" means inside the cell rather than lower on the canvas. */
function enterPatch(ctx: CanvasRenderingContext2D, frame: WallSample): void {
  ctx.translate(frame.at.x, frame.at.y)
  ctx.rotate(Math.atan2(frame.tangent.y, frame.tangent.x))
  const localY = { x: -frame.tangent.y, y: frame.tangent.x }
  if (frame.inward.x * localY.x + frame.inward.y * localY.y < 0) ctx.scale(1, -1)
}

/** One protein embedded in the membrane: the pump mid-cycle, or an always-open
 *  leak channel (N11/N12). Drawn in the patch frame, at `along`. */
/** How brightly this protein should be drawn, or NULL when no spotlight is in
 *  effect at all.
 *
 *  Those two are not the same thing and conflating them was a bug: "everything
 *  at full strength" is the resting picture, and treating it as "everything is
 *  starring" ringed all five proteins at once. No spotlight means no highlight
 *  AND no dimming. */
function proteinEmphasis(protein: ProteinInstance, s: SceneState): number | null {
  if (!s.emphasis) return null
  return s.emphasis[protein.channel ? protein.channel.id : 'pump'] ?? null
}

function drawProtein(
  ctx: CanvasRenderingContext2D,
  protein: ProteinInstance,
  s: SceneState,
  emph: number | null,
): void {
  const state = spotlightState(emph)
  const starring = state === 'starring'
  const drained = state === 'drained'
  const isPump = protein.kind === 'pump'
  const channel = protein.channel
  const half = protein.half
  const pump = isPump && s.pumpOn ? pumpStateAt(s.timeMs) : null
  // A channel's gate answers to its own rule — never to a click.
  const gate =
    channel && (channel.gating !== 'always' || s.leaksOn)
      ? gateOf(channel, s.gateEnv)
      : 'closed'
  const top = -PROTEIN_OUT
  const barrelIn = PROTEIN_BARREL_IN
  // Where the protein's inner surface actually is — the pore must reach it, or
  // the opening looks walled off.
  const innerFace = proteinIn(protein.kind)

  ctx.save()
  ctx.translate(protein.along, 0)

  const tint = drained
    ? DRAINED_TINT
    : isPump || !channel
      ? PROTEIN_TINT
      : channelTint(channel)

  // A gate CHANGING is much easier to notice than a gate that is merely in a
  // different state, and the change is the whole lesson here — so the instant one
  // opens or shuts, it gets a ring that expands and fades. Without this, "sodium
  // first, potassium second" was two words swapping in a label.
  const flash = channel ? (s.gateFlash?.[channel.id] ?? 0) : 0
  if (flash > 0) {
    ctx.save()
    ctx.globalAlpha = flash
    ctx.strokeStyle = SPOT_EDGE
    ctx.lineWidth = (2.6 * flash) / s.cameraScale
    // A tight ring rather than a wide one: at three times the protein's width it
    // read as a stray bubble on the membrane instead of as this door reacting.
    const r = half * (1.05 + (1 - flash) * 0.7)
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    softGlow(ctx, 0, 0, half * 2.2, SPOT_RGB, 0.5 * flash)
  }
  // Lit from behind, so the halo spills onto the membrane and both faces around
  // it — the protein looks picked out by a lamp rather than outlined by the app.
  //
  // ONE glow, not two. It used to stack a wide one and a tight one to brighten the
  // middle, and stacking radial gradients is how you draw a circle by accident:
  // the inner one stops dead at its own radius, so their sum has an edge there,
  // and that edge read as a hard ring sitting behind the channel for as long as it
  // was the protein carrying the current. A single gradient has nowhere to put a
  // seam.
  if (starring) softGlow(ctx, 0, 0, half * 3.4, SPOT_RGB, 0.46)

  // ⚠ THE CHANNELS ARE THE TRACED PROTEINS HERE TOO (user, 2026-08-30:
  // "'Resting membrane potential', 'trace one signal' still preserves old
  // channel visualisation"). This scene was the last place drawing a channel
  // as a generic pinched barrel — and it is the scene the whole app opens on,
  // so it was the one view teaching that every door is the same object with a
  // different tint, while every drawer said otherwise.
  //
  // FITTED BY HEIGHT, and the membrane gap follows the drawing rather than the
  // other way round (`channelHalf` in `proteins.ts`). Fitting them all to one
  // width was tried and measured first: the ligand-gated channel is much
  // narrower for its height than the leak, so a shared width made it stand 61%
  // taller than its neighbours. Every one of these straddles the same wall,
  // which is what is actually true of them; their widths differ, which is also
  // true.
  //
  // THE PUMP KEEPS ITS BARREL. It is not a channel: it has a domed cytoplasmic
  // head, it is only ever open on one side, and it spends energy. Dressing it
  // in a channel's silhouette would be the aquaporin's mistake again.
  if (channel) {
    drawSceneChannel(ctx, {
      channel,
      open: gate === 'open',
      // ⚠ THE PURE ION COLOUR, not this scene's pre-muted one (user,
      // 2026-08-30: "K⁺ channel does not look purple enough. Fix, check other
      // channels").
      //
      // `channelTint` mutes toward the species by 0.38 — and the traced
      // drawing then mutes AGAIN by 0.55, because tinting a protein with what
      // it passes is its own job. Two mixes in series washed every channel
      // back to bronze: potassium came out #9d8b88, a brownish grey, where the
      // gating bench shows #a18bb9. Sodium and chloride were olive.
      //
      // Handing over the ion's own colour lets the drawing do the single mix
      // it was built for, and the scene then matches the benches exactly.
      species: drained ? tint.mid : GLOSSY_COLORS[channel.passes[0]].mid,
      speciesDark: drained ? tint.dark : GLOSSY_COLORS[channel.passes[0]].dark,
      transmitter: s.gateEnv.transmitter,
      messenger: MESSENGER,
    })
    drawCargo(ctx, protein, s, gate, pump)
    ctx.restore()
    return
  }

  const grad = ctx.createLinearGradient(-half, 0, half, 0)
  grad.addColorStop(0, tint.dark)
  grad.addColorStop(0.38, tint.mid)
  grad.addColorStop(1, tint.dark)
  ctx.fillStyle = grad
  ctx.strokeStyle = starring ? SPOT_EDGE : tint.edge
  ctx.lineWidth = (starring ? 2.8 : 1.6) / s.cameraScale

  // A barrel through the bilayer, pinched at its waist, with a domed
  // cytoplasmic head on the pump — a lump of folded protein, not a brick.
  const waist = half * 0.74
  ctx.beginPath()
  ctx.moveTo(-half, top)
  ctx.quadraticCurveTo(-waist, 0, -half, barrelIn)
  if (isPump) {
    // The head: a good part of this protein's bulk sits inside the cell. The
    // control point is twice the head depth, so the curve itself peaks at it.
    ctx.quadraticCurveTo(0, barrelIn + PUMP_HEAD * 2, half, barrelIn)
  } else {
    ctx.lineTo(half, barrelIn)
  }
  ctx.quadraticCurveTo(waist, 0, half, top)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // The pore, and its gates. A pump is only ever open on ONE side; a leak
  // channel is a hole straight through. It runs the protein's full depth and
  // flares at whichever mouth is open, so "open" is unmistakable.
  const mouth = half * 0.3
  const flare = 1.25
  const shut = 0.08
  const openOut = (isPump ? pump?.openTo === 'outside' : gate === 'open') ? flare : shut
  const openIn = (isPump ? pump?.openTo === 'inside' : gate === 'open') ? flare : shut
  ctx.fillStyle = PORE
  ctx.beginPath()
  ctx.moveTo(-mouth * openOut, top)
  ctx.quadraticCurveTo(-mouth * 0.62, 0, -mouth * openIn, innerFace)
  ctx.lineTo(mouth * openIn, innerFace)
  ctx.quadraticCurveTo(mouth * 0.62, 0, mouth * openOut, top)
  ctx.closePath()
  ctx.fill()

  // The selectivity filter: the narrowest ring of the pore, and the part that
  // does the choosing. Painted in the colour of whatever fits through it, so
  // "this door is for potassium" is on the drawing rather than only in the label.
  if (channel && !drained) {
    const filter = channelTint(channel).filter
    const arm = mouth * 0.66
    ctx.save()
    ctx.strokeStyle = filter
    ctx.lineWidth = half * 0.075
    ctx.lineCap = 'round'
    for (const side of [-1, 1] as const) {
      ctx.beginPath()
      ctx.moveTo(side * arm, -half * 0.1)
      ctx.lineTo(side * arm, half * 0.1)
      ctx.stroke()
    }
    ctx.restore()
  }

  if (isPump && pump) {
    // Energy being spent: the one thing that separates a pump from a hole. Held
    // well back while something else is carrying the current — a bright green
    // flash on a drained protein out-shouts the thing being pointed at, and the
    // pump takes no part in a spike anyway.
    softGlow(
      ctx,
      0,
      innerFace * 0.8,
      half * 1.7,
      ATP_RGB,
      pump.atpFlash * 0.85 * (drained ? 0.3 : 1),
    )
  }

  // ⚠ THE SENSOR MARKS AND THE BINDING CUP USED TO BE DRAWN HERE, and they
  // are gone (2026-08-30). They were this scene's private way of writing what
  // opens a channel onto its body — three little plus signs, and a cup with a
  // dot in it. The traced proteins carry both properly: the voltage-gated one
  // has a real S4 sensor that MOVES, and the ligand-gated one has a socket cut
  // into a subunit that slides. Two drawings of one idea is how a visual
  // language stops being one, and the private pair was the worse of them.

  drawCargo(ctx, protein, s, gate, pump)
  ctx.restore()
}

/** WHAT THIS PROTEIN IS CARRYING RIGHT NOW.
 *
 *  ⚠ CHANNELS CARRY NOTHING FOR THE MOMENT (user, 2026-08-30: "remove the 1-3
 *  balls animation. Let channels open and close with no flow") — step one of
 *  debugging the action-potential view together.
 *
 *  ⚠ AND THIS IS WHERE THE BUG ACTUALLY WAS. Three rounds of work went into
 *  the axon lens's `drawTraffic`, and `drawRibbon` only runs at the
 *  `axon-signal` camera. The action-potential row goes to `axon-membrane`,
 *  which is drawn by `drawScene` — so none of that work was ever on the screen
 *  being looked at. The "1-3 balls" were `channelIonsAt`, called from here.
 *
 *  ⚠ EXPORTED so a test can reach the decision itself rather than something
 *  next to it, which is the trap this file's history is made of.
 *
 *  The pump keeps its cargo: it was not what was reported, and it is the one
 *  thing here that visibly SPENDS something. */
export function cargoOf(
  protein: ProteinInstance,
  gate: 'open' | 'closed',
  pump: ReturnType<typeof pumpStateAt> | null,
  flow?: { timeMs: number; counts: IonCounts; vm: number },
): CarriedIon[] {
  if (protein.kind === 'pump') return pump?.carried ?? []
  // A hole does no pushing: a shut door carries nothing, and an open one
  // carries whatever the gradient and the voltage are actually driving.
  if (!protein.channel || gate !== 'open' || !flow) return []
  return channelIonsAt(protein.channel, protein.phase, flow.timeMs, flow.counts, flow.vm)
}

/** Draws whatever `cargoOf` says it has — shared, because a channel and a pump
 *  differ in everything except this. */
function drawCargo(
  ctx: CanvasRenderingContext2D,
  protein: ProteinInstance,
  s: SceneState,
  // Kept in the signature: the next step of this debug puts a flow back, and
  // whether the door is open is what it will be gated on.
  gate: 'open' | 'closed',
  pump: ReturnType<typeof pumpStateAt> | null,
): void {
  for (const ion of cargoOf(protein, gate, pump, {
    timeMs: s.timeMs,
    counts: s.counts,
    vm: s.vm,
  })) {
    const radius = ionRadius(ion.kind)
    ctx.save()
    ctx.globalAlpha = ion.alpha
    // Straight down the middle of the pore — see CarriedIon.
    // Along the pore, and — once clear of the protein — a little across it, so
    // the current fans out the way the patch clamp's does.
    ctx.translate(
      (ion.across ?? 0) * ionRadius(ion.kind) * 6,
      carriedDepth(ion.u, ion.kind, protein.kind),
    )
    ctx.fillStyle = ionGradient(ctx, ion.kind, radius)
    ctx.beginPath()
    ctx.arc(0, 0, radius * 1.5, 0, Math.PI * 2)
    ctx.fill()
    chargeMark(ctx, 0, 0, radius, IONS[ion.kind].charge > 0, s.cameraScale)
    ctx.restore()
  }
}

function drawProteins(ctx: CanvasRenderingContext2D, s: SceneState): void {
  if (s.cameraScale < BILAYER_SCALE) return
  const labels: ScreenLabel[] = []
  for (const target of ZOOM_TARGETS) {
    if (!target.frame) continue
    if (!inView(s.view, target.frame.at, (s.view.right - s.view.left) * 1.5)) continue
    const here = s.proteins.filter((p) => p.frame === target.frame)
    ctx.save()
    enterPatch(ctx, target.frame)
    for (const protein of here) {
      const emph = proteinEmphasis(protein, s)
      ctx.save()
      // Hue does the dimming; alpha barely helps and quickly hurts. The contrast
      // comes from the starring protein being LIT, not from the others
      // dissolving into the membrane.
      ctx.globalAlpha = emph === null ? 1 : 0.74 + 0.26 * emph
      drawProtein(ctx, protein, s, emph)
      ctx.restore()
    }
    ctx.restore()
    // Named, because four channel types are only worth showing if you can tell
    // which is which.
    for (const protein of here) {
      const open =
        protein.channel && (protein.channel.gating !== 'always' || s.leaksOn)
          ? gateOf(protein.channel, s.gateEnv) === 'open'
          : false
      const emph = proteinEmphasis(protein, s)
      const state = spotlightState(emph)
      const starring = state === 'starring'
      const drained = state === 'drained'
      if (s.labelsOn !== false)
        labels.push({
          text: protein.channel ? protein.channel.short : 'Na⁺/K⁺ pump',
          at: protein.at,
          // The name points AT the protein it names: a discrete thing, so it
          // gets a leader like every other name in the app.
          to: protein.at,
          dy: 96,
          color: starring
            ? '#fffbeb'
            : drained
              ? '#6b7280'
              : protein.channel
                ? open
                  ? '#e7d9b8'
                  : '#7d7360'
                : '#e0a56a',
          size: 11,
          align: 'center',
          alpha: drained ? 0.75 : 1,
          accent: starring,
        })
      if (protein.channel) {
        labels.push({
          text: open ? 'open' : 'shut',
          at: protein.at,
          dy: 110,
          color: drained ? '#5b6472' : open ? '#86efac' : '#64748b',
          size: 10,
          align: 'center',
          alpha: drained ? 0.75 : 1,
        })
      }
    }
  }
  screenLabels(ctx, s, labels)
}

/** The ion crowds on both sides of a membrane patch (N08/N09). Drawn in the
 *  patch's own frame, so "which side" means inside/outside rather than
 *  up/down on the canvas. */
function drawIons(ctx: CanvasRenderingContext2D, s: SceneState): void {
  if (s.cameraScale < ION_SCALE) return
  for (const target of ZOOM_TARGETS) {
    if (!target.frame) continue
    const frame = target.frame
    if (!inView(s.view, frame.at, (s.view.right - s.view.left) * 1.5)) continue

    ctx.save()
    ctx.translate(frame.at.x, frame.at.y)
    ctx.rotate(Math.atan2(frame.tangent.y, frame.tangent.x))
    // Local +y must point at the cytoplasm, so `inside` really is inside.
    const localY = { x: -frame.tangent.y, y: frame.tangent.x }
    if (frame.inward.x * localY.x + frame.inward.y * localY.y < 0) ctx.scale(1, -1)

    // One gradient per species per focus state, reused across the whole crowd
    // by moving the context — a few hundred ions must not mean a few hundred
    // gradient objects every frame.
    const paint = new Map<string, CanvasGradient>()
    const fillFor = (ion: IonInstance, muted: boolean) => {
      const key = `${ion.kind}${muted ? '-m' : ''}`
      let grad = paint.get(key)
      if (!grad) {
        grad = ionGradient(ctx, ion.kind, ion.radius, muted)
        paint.set(key, grad)
      }
      return grad
    }

    const marksLegible = ION_KINDS.some((kind) => ionRadius(kind) * s.cameraScale > 3.4)
    for (const side of ['outside', 'inside'] as const) {
      const sign = side === 'inside' ? 1 : -1
      for (const ion of s.ions[side]) {
        const muted = !s.highlighted[ion.kind]
        const now = ionAt(ion, s.timeMs)
        const y = sign * now.depth
        ctx.save()
        ctx.globalAlpha = muted ? 0.4 : 1
        ctx.translate(now.along, y)
        ctx.fillStyle = fillFor(ion, muted)
        ctx.beginPath()
        ctx.arc(0, 0, ion.radius * 1.5, 0, Math.PI * 2)
        ctx.fill()
        if (marksLegible && !muted) {
          chargeMark(ctx, 0, 0, ion.radius, IONS[ion.kind].charge > 0, s.cameraScale)
        }
        ctx.restore()
      }
    }
    ctx.restore()
  }
}

/** Fill a band of half-thickness `half` centred on a run of wall samples. */
function fillBand(
  ctx: CanvasRenderingContext2D,
  samples: WallSample[],
  half: number,
  color: string,
): void {
  if (samples.length < 2 || half <= 0) return
  ctx.fillStyle = color
  ctx.beginPath()
  samples.forEach((w, i) => {
    const p = { x: w.at.x - w.inward.x * half, y: w.at.y - w.inward.y * half }
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  for (let i = samples.length - 1; i >= 0; i--) {
    const w = samples[i]
    ctx.lineTo(w.at.x + w.inward.x * half, w.at.y + w.inward.y * half)
  }
  ctx.closePath()
  ctx.fill()
}

/** Draw the visible stretch of one wall as a lipid bilayer.
 *
 *  `tNear` is the point on the wall closest to the middle of the view. The
 *  visible range is then derived from the view's own size — probing the whole
 *  path for visibility would be hopeless here, because at ×2400 the canvas
 *  covers about a thousandth of the axon and a coarse probe overestimates the
 *  span by more than ten times, which is what spread the lipids too thin. */
function drawBilayer(
  ctx: CanvasRenderingContext2D,
  centre: Pt[],
  halfWidth: number,
  side: 1 | -1,
  s: SceneState,
  tNear: number,
): void {
  const total = pathLength(centre)
  if (total <= 0) return
  const halfDiagonal =
    0.5 * Math.hypot(s.view.right - s.view.left, s.view.bottom - s.view.top)
  const tHalf = (halfDiagonal + LIPID_PX * 4) / total
  const tMin = Math.max(0, tNear - tHalf)
  const tMax = Math.min(1, tNear + tHalf)

  // Molecules are indexed by absolute distance along the membrane, so each one
  // keeps its own jitter no matter where the camera is looking.
  const spacing = LIPID_PX * LIPID_PACKING
  const first = Math.ceil((tMin * total) / spacing)
  const last = Math.min(first + 460, Math.floor((tMax * total) / spacing))
  if (last < first) return

  const samples: WallSample[] = []
  for (let k = first; k <= last; k++) {
    samples.push(wallSample(centre, halfWidth, side, (k * spacing) / total))
  }
  // Just a whisper of tint on the hydrophobic middle.
  fillBand(ctx, samples, HALF_MEM - LIPID_PX, OILY_CORE)

  // ⚠ THE SHARED PAVER (`bilayer.paveMembrane`), not a loop of its own. It was
  // this function's private loop until the synapse needed the same membrane
  // along a different wall (2026-08-31) — and one structure, one code path.
  paveMembrane(ctx, samples, {
    geom: SCENE_LIPID,
    first,
    jitter: LIPID_JITTER,
    displacedBy: s.proteins,
  })
}

/** Parameter of the point on a wall closest to `target`: a coarse sweep, then
 *  a few refining passes, because at high magnification the answer has to be
 *  precise to a fraction of a scene pixel. */
function nearestT(centre: Pt[], halfWidth: number, side: 1 | -1, target: Pt): number {
  const coarse = 160
  let best = 0
  let bestDist = Infinity
  const distanceAt = (t: number): number => {
    const p = wallSample(centre, halfWidth, side, t).at
    return (p.x - target.x) ** 2 + (p.y - target.y) ** 2
  }
  for (let i = 0; i <= coarse; i++) {
    const t = i / coarse
    const d = distanceAt(t)
    if (d < bestDist) {
      bestDist = d
      best = t
    }
  }
  let window = 1 / coarse
  for (let pass = 0; pass < 3; pass++) {
    const fine = 16
    let localBest = best
    let localDist = Infinity
    for (let i = 0; i <= fine; i++) {
      const t = clamp01(best - window + (2 * window * i) / fine)
      const d = distanceAt(t)
      if (d < localDist) {
        localDist = d
        localBest = t
      }
    }
    best = localBest
    window = (2 * window) / fine
  }
  return best
}

/** Tint the cytoplasm side of a membrane and name both sides, so it is obvious
 *  the membrane separates two different worlds (N07). */
function drawCompartments(
  ctx: CanvasRenderingContext2D,
  centre: Pt[],
  halfWidth: number,
  side: 1 | -1,
  s: SceneState,
  tNear: number,
): void {
  const best = wallSample(centre, halfWidth, side, tNear)
  const angle = Math.atan2(best.tangent.y, best.tangent.x)
  // After rotating by `angle`, local +y maps to this scene direction.
  const localY = { x: -Math.sin(angle), y: Math.cos(angle) }
  const inwardIsPlusY = best.inward.x * localY.x + best.inward.y * localY.y > 0
  const reach = (s.view.right - s.view.left) * 2

  ctx.save()
  ctx.translate(best.at.x, best.at.y)
  ctx.rotate(angle)
  ctx.fillStyle = CYTOPLASM_SOLID
  ctx.fillRect(
    -reach,
    inwardIsPlusY ? MEMBRANE_PX / 2 : -MEMBRANE_PX / 2 - reach,
    reach * 2,
    reach,
  )
  ctx.restore()

  // Name both sides, a third of the canvas away from the membrane. Names, so
  // the 🏷 switch hides them — and no leader: a half-plane has no point to
  // aim a line at.
  if (s.labelsOn === false) return
  const reachPx = STAGE_H * 0.32
  screenLabels(ctx, s, [
    {
      text: 'outside the cell',
      at: best.at,
      dx: -best.inward.x * reachPx,
      dy: -best.inward.y * reachPx,
      color: '#94a3b8',
      align: 'center',
    },
    {
      text: 'inside the cell — cytoplasm',
      at: best.at,
      dx: best.inward.x * reachPx,
      dy: best.inward.y * reachPx,
      color: '#94a3b8',
      align: 'center',
    },
  ])
}

/** A process (axon or dendrite branch) at magnification: a tube with a wall on
 *  each side, and — once the camera is close enough — a real bilayer. */
function drawProcessTube(
  ctx: CanvasRenderingContext2D,
  centre: Pt[],
  halfWidth: number,
  s: SceneState,
  membraneColor: string,
): void {
  const scale = s.cameraScale
  // The interior, painted by stroking the centreline at full width.
  strokePath(ctx, centre, halfWidth * 2, CYTOPLASM)

  // How much molecular detail this magnification earns, and it is a BLEND rather
  // than a switch. See bilayerBlend.
  const blend = bilayerBlend(scale)
  for (const side of [1, -1] as const) {
    const wall: Pt[] = []
    const steps = centre.length > 2 ? centre.length : 8
    for (let i = 0; i <= steps; i++) {
      wall.push(wallSample(centre, halfWidth, side, i / steps).at)
    }
    if (!pathInView(s.view, wall, MEMBRANE_PX * 4)) continue

    // The plain wall, underneath — but fading out exactly as the molecular one
    // fades in, so at full bilayer magnification it is not drawn at all.
    //
    // Drawing it unconditionally was the obvious way to guarantee a continuous
    // membrane at every scale, and it was wrong: a grey line then sat UNDER the
    // bilayer at the membrane patch, visible through the gaps between lipids and
    // along a tilted wall. A schematic and a molecular drawing of the same wall
    // are two drawings of one thing, and they must not both be on screen. The
    // blend hands over between them instead.
    if (blend < 0.999) {
      ctx.save()
      ctx.globalAlpha *= 1 - blend
      strokePath(ctx, wall, Math.max(MEMBRANE_PX, 1.3 / scale), membraneColor)
      ctx.restore()
    }

    if (blend > 0.01) {
      const tNear = nearestT(centre, halfWidth, side, {
        x: (s.view.left + s.view.right) / 2,
        y: (s.view.top + s.view.bottom) / 2,
      })
      ctx.save()
      ctx.globalAlpha *= blend
      drawCompartments(ctx, centre, halfWidth, side, s, tNear)
      drawBilayer(ctx, centre, halfWidth, side, s, tNear)
      ctx.restore()
    }
  }
}

// --------------------------------------------------------------- input cells

/** Chemical transmission: discrete pale particles crossing a gap. Deliberately
 *  NOT a glow — the hand-off from electrical to chemical must look different. */
function messengers(
  ctx: CanvasRenderingContext2D,
  from: Pt,
  to: Pt,
  progress: number,
): void {
  const spread = [-0.18, 0, 0.16, 0.3]
  ctx.save()
  for (let i = 0; i < spread.length; i++) {
    const p = clamp01(progress + spread[i])
    if (p <= 0 || p >= 1) continue
    const perp = { x: -(to.y - from.y), y: to.x - from.x }
    const l = Math.hypot(perp.x, perp.y) || 1
    const wobble = ((i % 2 === 0 ? 1 : -1) * (2.2 + i)) / l
    ctx.globalAlpha = 0.35 + 0.65 * Math.sin(Math.PI * p)
    disc(
      ctx,
      {
        x: from.x + (to.x - from.x) * p + perp.x * wobble,
        y: from.y + (to.y - from.y) * p + perp.y * wobble,
      },
      1.9,
      MESSENGER,
    )
  }
  ctx.restore()
}

/** A travelling patch of excited membrane: bright, constant amplitude, with a
 *  glowing leading edge. Never a particle running along the cable. */
function travellingSignal(
  ctx: CanvasRenderingContext2D,
  path: Pt[],
  head: number,
  width: number,
  tailLength: number,
): void {
  const tail = Math.max(0, head - tailLength)
  const at = (f: number) => polylinePoint(path, tail + (head - tail) * f)
  ctx.save()
  for (let i = 0; i <= 6; i++) {
    const f = i / 6
    const p = at(f)
    softGlow(ctx, p.x, p.y, width * 1.4 + width * f, SIGNAL_RGB, 0.16 + 0.34 * f)
  }
  ctx.lineCap = 'round'
  ctx.strokeStyle = SIGNAL_CORE
  ctx.lineWidth = width
  ctx.globalAlpha = 0.95
  ctx.beginPath()
  const start = at(0)
  ctx.moveTo(start.x, start.y)
  for (let i = 1; i <= 12; i++) {
    const p = at(i / 12)
    ctx.lineTo(p.x, p.y)
  }
  ctx.stroke()
  ctx.globalAlpha = 1
  const h = at(1)
  softGlow(ctx, h.x, h.y, width * 2.6, SIGNAL_RGB, 0.75)
  ctx.restore()
}

/** A simplified partner cell body: the traced star soma (the same species as
 *  the focus cell — re-drawn 2026-09-04, see 05 → Reconciliation —
 *  neuron (1).svg), flat, dimmer, no nucleus, cone turned toward `facing`
 *  (where its axon leaves) — so the focus neuron stays the subject. */
function partnerSoma(
  ctx: CanvasRenderingContext2D,
  outline: Pt[],
  c: Pt,
  r: number,
  hot: boolean,
): void {
  const g = ctx.createRadialGradient(c.x - r * 0.3, c.y - r * 0.3, 0, c.x, c.y, r)
  g.addColorStop(0, hot ? 'rgba(203, 213, 225, 0.5)' : 'rgba(148, 163, 184, 0.3)')
  g.addColorStop(1, 'rgba(100, 116, 139, 0.1)')
  ctx.fillStyle = g
  ctx.strokeStyle = hot ? PARTNER_HOT : PARTNER
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  ctx.beginPath()
  for (const [i, p] of outline.entries()) {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // A nucleus, dim: a cell body with something in it reads as a cell body.
  disc(ctx, { x: c.x + r * 0.1, y: c.y + r * 0.08 }, r * 0.26, 'rgba(100, 116, 139, 0.5)')
}

/** ⚠ THE POSTSYNAPTIC SPECIALIZATION, at the scene's register (user,
 *  2026-09-04): the receiving dendrite swells into a spine head on a narrow
 *  neck — the object the synapse view magnifies — so a thickening means
 *  exactly one thing, "a synapse lands here", and the stand-in now looks
 *  like what it dissolves into. */
function drawSpine(
  ctx: CanvasRenderingContext2D,
  dendrite: Pt[],
  ink: string,
  fill: string,
): void {
  const { head, neck } = spineHead(dendrite)
  ctx.save()
  ctx.lineCap = 'round'
  // The neck first, under the head: a neck is a neck, not a pedestal.
  line(ctx, head, neck, SPINE_HEAD_R * 0.62, ink)
  ctx.beginPath()
  ctx.arc(head.x, head.y, SPINE_HEAD_R, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = ink
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.restore()
}

/** A stub process fading out toward its far end — the cell keeps going where
 *  the drawing stops, and the same ink says so. `pts` runs far-tip → soma. */
function fadingPath(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  w: number,
  rgb: string,
  alpha: number,
): void {
  const a = pts[0]
  const b = pts[pts.length - 1]
  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
  g.addColorStop(0, `rgba(${rgb}, 0)`)
  g.addColorStop(1, `rgba(${rgb}, ${alpha})`)
  ctx.save()
  ctx.strokeStyle = g
  ctx.lineWidth = w
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
  ctx.stroke()
  ctx.restore()
}

/** ⚠ HOW FAR THE OUTGOING SYNAPSE HAS TURNED INTO ITS OWN ANATOMY at this
 *  zoom (user, 2026-09-01: "improve the zoomed-in big image with the demo
 *  synapse"). The wide view's stand-ins — a blob for the bouton, a bare line
 *  for the target's dendrite — read fine at ×1 and were nonsense at ×100. On
 *  the way down to the demo's own scale, the stand-ins dissolve OUT (×8→×16)
 *  and the demo's shapes — the user's traced bouton, the spine-tipped
 *  dendrite — dissolve IN (×16→×40). The ramps do not overlap: level of
 *  detail dissolves, and the two representations are never both on screen. */
export function outgoingDetailAt(zoom: number): {
  standIn: number
  anatomy: number
} {
  const d = Math.log10(Math.max(1e-9, zoom))
  const gone = Math.min(1, Math.max(0, (d - Math.log10(8)) / 0.3))
  const here = Math.min(1, Math.max(0, (d - Math.log10(16)) / 0.4))
  return { standIn: 1 - gone, anatomy: here }
}

/** One astrocyte at the scene's register (21b-1b; re-created 2026-09-04 as a
 *  faithful TRACE of the user's astrocyte.svg — see 05 → Reconciliation): the
 *  shared `astroShape` glyph, drawn in the glial greened wash. The same
 *  geometry feeds the miniature's SVG, so the kid meets one recognisable
 *  star everywhere. */
function drawAstrocyteCell(
  ctx: CanvasRenderingContext2D,
  a: { soma: Pt; r: number; reach: Pt },
  alpha: number,
): void {
  if (alpha <= 0.01) return
  const shape = astroShape(a)
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  for (const [i, p] of shape.soma.entries()) {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  }
  ctx.closePath()
  // Corrections 2026-09-04: a FILLED body (the 0.10 wash read as hollow) and
  // a heavier outline at the scene's register.
  ctx.fillStyle = 'rgba(134, 184, 158, 0.4)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(134, 184, 158, 0.75)'
  ctx.lineWidth = 2.5
  ctx.stroke()
  for (const pl of shape.processes) {
    ctx.beginPath()
    for (const [i, p] of pl.entries()) {
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()
  }
  // Its nucleus (user, 2026-09-04) — the same mark every neuron here carries,
  // so a cell body reads as a cell body whichever kind of cell it belongs to.
  const nuc = astroNucleus(a)
  disc(ctx, nuc.at, nuc.r, ASTRO_NUCLEUS)
  ctx.restore()
}

/** The demo synapse's own anatomy, seated in the scene at the outgoing
 *  synapse — the traced bouton over a spine-tipped dendrite running to the
 *  target's soma, oriented so the landing quarter-turn brings it into exact
 *  register with the view that then fades in. */
function outgoingAnatomy(ctx: CanvasRenderingContext2D, alpha: number): void {
  const b = OUTGOING.bouton
  const tip = OUTGOING.tip
  const stub = OUTPUT.dendrites[1]
  // The demo frame, seated in the scene: this frame's +y points along the
  // dendrite toward the target's soma — the direction the landing turn maps
  // to "down".
  const ang = Math.atan2(stub.from.y - tip.y, stub.from.x - tip.x)
  const mid = { x: (b.x + tip.x) / 2, y: (b.y + tip.y) / 2 }
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.translate(mid.x, mid.y)
  ctx.rotate(ang - Math.PI / 2)
  const k = (BOUTON_R * 2.6) / BOUTON_BOX.w
  const cleftHalf = 1.4
  const fit: BoutonFit = {
    k,
    ox: -(BOUTON_BOX.x + BOUTON_BOX.w / 2) * k,
    oy: -cleftHalf - BOUTON_FOOT.y * k,
  }
  // The bouton: the user's own outline, foot one half-cleft above the middle.
  boutonPath(ctx, fit)
  ctx.fillStyle = 'rgba(148, 163, 184, 0.14)'
  ctx.fill()
  ctx.strokeStyle = '#b8c4d4'
  ctx.lineWidth = 1.2
  ctx.stroke()
  // Its docked vesicles, along the foot.
  ctx.fillStyle = VESICLE
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.arc((i - 2) * BOUTON_R * 0.42, -cleftHalf - 3, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }
  // The target's dendrite tip: spine head apposed across the cleft, neck,
  // and the trunk widening away toward its soma — the demo's own shape.
  const wh = BOUTON_R * 1.05
  const neck = wh * 0.22
  const trunkHalf = wh * 0.55
  const L = Math.hypot(stub.from.x - tip.x, stub.from.y - tip.y)
  const headTop = cleftHalf
  const headBot = cleftHalf + wh * 0.62
  ctx.beginPath()
  ctx.moveTo(-trunkHalf, L)
  ctx.bezierCurveTo(-neck * 1.05, L * 0.5, -neck, headBot + wh * 0.4, -neck, headBot)
  ctx.bezierCurveTo(-neck, headTop + wh * 0.45, -wh, headTop + wh * 0.45, -wh, headTop)
  ctx.lineTo(wh, headTop)
  ctx.bezierCurveTo(wh, headTop + wh * 0.45, neck, headTop + wh * 0.45, neck, headBot)
  ctx.bezierCurveTo(neck, headBot + wh * 0.4, neck * 1.05, L * 0.5, trunkHalf, L)
  ctx.closePath()
  ctx.fillStyle = 'rgba(91, 104, 121, 0.22)'
  ctx.fill()
  ctx.strokeStyle = PARTNER
  ctx.lineWidth = 1.2
  ctx.stroke()
  // ⚠ THE GLIAL FINGERS AT THE MOUTHS (21b-1b), at the anatomy's own
  // register: in this seated frame the landing quarter-turn maps them to the
  // synapse view's left/right flanks, so the picture the camera lands on is
  // the picture that faded out. Proportions are the view's own, in units of
  // its active-zone half-width.
  const aH = (BOUTON_BOX.w / 2) * k * 0.72
  for (const sd of [1, -1] as const) {
    const tip = { x: sd * aH * 1.51, y: 0 }
    const base = { x: sd * aH * 2.6, y: aH * 0.46 }
    const rT = aH * 0.17
    const rB = aH * 0.38
    const th = Math.atan2(base.y - tip.y, base.x - tip.x)
    ctx.beginPath()
    ctx.arc(tip.x, tip.y, rT, th + Math.PI / 2, th - Math.PI / 2)
    ctx.arc(base.x, base.y, rB, th - Math.PI / 2, th + Math.PI / 2)
    ctx.closePath()
    ctx.fillStyle = 'rgba(134, 184, 158, 0.18)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(134, 184, 158, 0.7)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.restore()
}

/** A bouton with its vesicles: used for both incoming and outgoing synapses. */
function bouton(
  ctx: CanvasRenderingContext2D,
  c: Pt,
  dir: Pt,
  r: number,
  hot: boolean,
  drift: number,
  release: number,
  outline?: Pt[],
): void {
  softGlow(
    ctx,
    c.x + dir.x * r * 0.9,
    c.y + dir.y * r * 0.9,
    r * 2.1,
    SIGNAL_RGB,
    release * 0.55,
  )
  const g = ctx.createRadialGradient(c.x - 3, c.y - 3, 0, c.x, c.y, r)
  g.addColorStop(0, hot ? '#e2e8f0' : '#b8c4d4')
  g.addColorStop(1, '#64748b')
  ctx.fillStyle = g
  ctx.beginPath()
  if (outline) {
    // The focus cell's boutons are the trace's own teardrops (neuron (1).svg);
    // a partner's bouton, which has no traced outline, stays a disc.
    for (const [i, p] of outline.entries()) {
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
    ctx.closePath()
  } else {
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
  }
  ctx.fill()
  ctx.save()
  ctx.fillStyle = VESICLE
  for (const off of VESICLE_OFFSETS) {
    ctx.globalAlpha = 1 - 0.45 * drift
    ctx.beginPath()
    ctx.arc(
      c.x + off.x + dir.x * r * 0.85 * drift,
      c.y + off.y + dir.y * r * 0.85 * drift,
      VESICLE_R,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
  ctx.restore()
}

function drawInputs(ctx: CanvasRenderingContext2D, s: SceneState): void {
  const { chain } = s
  for (const input of INPUTS) {
    if (!pathInView(s.view, input.axon, input.somaR * 2)) continue
    const firing = s.firedInputs.includes(input.id)
    const hot = s.hoveredInput === input.id
    // Partners are deliberately thinner and dimmer than the focus neuron:
    // they are context, not the subject.
    ctx.save()
    ctx.globalAlpha = s.selected === null ? 0.75 : 0.32
    ctx.lineCap = 'round'

    const ink = hot ? '203, 213, 225' : '148, 163, 184'
    // Its WHOLE dendrite fan, far ends fading — the rest of that cell's tree
    // is off the story, not off a cliff.
    for (const stroke of input.fan) fadingPath(ctx, stroke, 2.2, ink, 0.9)
    // The rest of its terminal arbor: this axon contacts other cells too, and
    // saying so is what stops the one bouton reading as the whole ending.
    for (const br of input.branches) fadingPath(ctx, [...br].reverse(), 1.6, ink, 0.55)
    for (const b of input.otherBoutons) disc(ctx, b, BOUTON_R * 0.4, `rgba(${ink}, 0.5)`)
    strokePath(ctx, input.axon, 2.6, hot ? PARTNER_HOT : PARTNER)

    const toSite = {
      x: (input.site.x - input.bouton.x) / CLEFT,
      y: (input.site.y - input.bouton.y) / CLEFT,
    }
    bouton(
      ctx,
      input.bouton,
      toSite,
      BOUTON_R * 0.85,
      hot || firing,
      firing && chain.crossing !== null ? 1 : 0,
      firing && chain.crossing !== null ? 0.8 : 0,
    )
    partnerSoma(ctx, input.outline, input.soma, input.somaR, hot || firing)

    if (firing) {
      // Its own action potential, running to its bouton.
      softGlow(
        ctx,
        input.soma.x,
        input.soma.y,
        input.somaR * 1.8,
        SIGNAL_RGB,
        chain.presynFlash * 0.6,
      )
      if (chain.presynAP !== null) {
        travellingSignal(ctx, input.axon, chain.presynAP, 5, 0.16)
      }
      if (chain.crossing !== null) {
        messengers(ctx, input.bouton, input.site, chain.crossing)
      }
    }
    ctx.restore()

    // Name plus the invitation to fire it.
    const anchor = { x: input.soma.x, y: input.soma.y + input.somaR }
    const alpha = s.selected === null ? 0.9 : 0.35
    if (s.labelsOn === false) continue
    screenLabels(ctx, s, [
      {
        text: input.label,
        at: anchor,
        to: input.soma,
        dy: 16,
        color: hot ? LABEL_HOT : LABEL,
        align: 'center',
        alpha,
      },
      ...(hot
        ? [
            {
              text: 'click to fire',
              at: anchor,
              dy: 31,
              color: '#fbbf24',
              align: 'center' as CanvasTextAlign,
              alpha,
            },
          ]
        : []),
    ])
  }
}

// --------------------------------------------------------------- focus cell

/** A process drawn as ONE shape: the stroke walked up one side and back down
 *  the other, at the width the taper gives each point, then filled once.
 *
 *  A polyline stroke cannot taper, and a per-segment stroke double-composites
 *  its joins (see DENDRITE_STROKES). A ribbon does neither — and its ends are
 *  rounded by hand, so a branch still finishes like a branch rather than a
 *  cut cable. */
function taperedRibbon(
  ctx: CanvasRenderingContext2D,
  st: DendriteStroke,
  ink: string,
): void {
  const n = st.pts.length
  if (n < 2) return
  const half = (i: number) => strokeWidthAt(st, i / (n - 1)) / 2
  /** The unit normal at point i, from the direction the stroke runs there. */
  const normalAt = (i: number): Pt => {
    const a = st.pts[Math.max(0, i - 1)]
    const b = st.pts[Math.min(n - 1, i + 1)]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const l = Math.hypot(dx, dy) || 1
    return { x: -dy / l, y: dx / l }
  }
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const nrm = normalAt(i)
    const h = half(i)
    const x = st.pts[i].x + nrm.x * h
    const y = st.pts[i].y + nrm.y * h
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  // Round the tip, then come back down the other side.
  const tipN = normalAt(n - 1)
  const tipH = half(n - 1)
  ctx.arc(
    st.pts[n - 1].x,
    st.pts[n - 1].y,
    tipH,
    Math.atan2(tipN.y, tipN.x),
    Math.atan2(-tipN.y, -tipN.x),
    true,
  )
  for (let i = n - 1; i >= 0; i--) {
    const nrm = normalAt(i)
    const h = half(i)
    ctx.lineTo(st.pts[i].x - nrm.x * h, st.pts[i].y - nrm.y * h)
  }
  const rootN = normalAt(0)
  const rootH = half(0)
  ctx.arc(
    st.pts[0].x,
    st.pts[0].y,
    rootH,
    Math.atan2(-rootN.y, -rootN.x),
    Math.atan2(rootN.y, rootN.x),
    true,
  )
  ctx.closePath()
  ctx.fillStyle = ink
  ctx.fill()
}

function drawDendrites(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  hot: boolean,
  s: SceneState,
): void {
  const tube = s.cameraScale >= TUBE_SCALE
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = hot ? MEMBRANE_HOT : MEMBRANE
  // ⚠ ONE BRANCH, ONE MARK (user, 2026-09-04: "visible dots on the places
  // where its pieces collide"). Stroking the segments one at a time put a
  // round cap at both sides of every join, and under this function's own
  // globalAlpha the two overlapping caps composite TWICE — a bright dot at
  // each of some thirty joins per branch. A branch is now laid down as a
  // single tapered ribbon and filled once, so a join is not an event.
  for (const st of DENDRITE_STROKES) {
    if (!pathInView(s.view, st.pts, Math.max(st.w0, st.w1) * 2)) continue
    if (tube) {
      drawProcessTube(
        ctx,
        st.pts,
        Math.max(st.w0, st.w1) / 2,
        s,
        hot ? MEMBRANE_HOT : MEMBRANE,
      )
    } else {
      taperedRibbon(ctx, st, hot ? MEMBRANE_HOT : MEMBRANE)
    }
  }
  // ⚠ WHERE A SYNAPSE LANDS, THE DENDRITE SWELLS (user, 2026-09-04). Only the
  // three tips that actually receive an input get a spine head — a thickening
  // is a claim, and drawing one on all eleven would say every tip is a
  // synapse. This is the object the synapse view magnifies.
  for (const input of INPUTS) {
    if (!inView(s.view, input.site, SPINE_HEAD_R * 6)) continue
    drawSpine(
      ctx,
      DENDRITE_TRUNKS[input.trunk].path,
      hot ? MEMBRANE_HOT : MEMBRANE,
      SPINE_FILL,
    )
  }
  ctx.restore()
}

function drawAxon(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  hot: boolean,
  s: SceneState,
): void {
  if (!pathInView(s.view, AXON_POLYLINE, AXON_W * 2)) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineCap = 'round'
  if (s.cameraScale >= TUBE_SCALE) {
    drawProcessTube(ctx, AXON_POLYLINE, AXON_W / 2, s, hot ? MEMBRANE_HOT : MEMBRANE)
  } else {
    strokePath(ctx, AXON_POLYLINE, AXON_W, hot ? MEMBRANE_HOT : MEMBRANE)
  }
  ctx.restore()
}

function drawTerminals(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  hot: boolean,
  s: SceneState,
): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineCap = 'round'
  const arrival = s.chain.terminalAP
  const m0 = ctx.getTransform()
  const detail = outgoingDetailAt(Math.hypot(m0.a, m0.b))
  const outgoingIndex = OUTPUT.dendrites[1].fromTerminal
  // The arbor's own branch strokes, as traced (neuron (1).svg) — the ink the
  // seven boutons hang from, drawn once, not a chord per bouton.
  for (const br of TERMINAL_BRANCHES) {
    if (!pathInView(s.view, br, BOUTON_R * 3)) continue
    strokePath(ctx, br, 3, hot ? MEMBRANE_HOT : MEMBRANE)
  }
  const head = s.chain.terminalHead
  for (const [ti, t] of TERMINALS.entries()) {
    if (!pathInView(s.view, t.path, BOUTON_R * 3)) continue
    // The bouton glows when the wave actually reaches IT, near boutons first.
    // Drawn under the bouton so the vesicles and the release stay on top of
    // it — this is the membrane going, not the release happening.
    const arr = terminalArrival(head, ti)
    if (arrival > 0.01 && arr > 0.01) {
      softGlow(ctx, t.end.x, t.end.y, BOUTON_R * 3.4, SIGNAL_RGB, arr * arrival * 0.7)
    }
    // The outgoing bouton's blob stand-in has dissolved by the time the
    // demo's own anatomy arrives — see `outgoingDetailAt`.
    const standIn = ti === outgoingIndex ? detail.standIn : 1
    if (standIn > 0.01) {
      ctx.save()
      ctx.globalAlpha *= standIn
      bouton(
        ctx,
        t.end,
        t.dir,
        BOUTON_R,
        hot,
        s.chain.terminalDrift,
        s.chain.terminalRelease,
        t.outline,
      )
      ctx.restore()
    }
  }
  // ⚠ THE SPIKE TRAVELS THE ARBOR AS A DOT WITH A TAIL, the axon's own
  // (user, 2026-09-04: "a yellow glowing dot with white tail moves along the
  // lines, same as on axon body"). It was a lit prefix growing along each
  // route — progressive, but a different animal from the cable's signal, and
  // the arbor IS the cable. Drawn LAST so the fronts pass over the boutons
  // rather than under them, and deduped by `arborFronts`, so one dot leaves
  // the axon and becomes many at the forks instead of seven stacking into a
  // flare on the shared limb.
  if (arrival > 0.01) {
    ctx.save()
    ctx.globalAlpha = alpha * arrival
    for (const front of arborFronts(head)) {
      const route = TERMINALS[front.ti].path
      if (!pathInView(s.view, route, BOUTON_R * 3)) continue
      travellingSignal(ctx, route, front.t, 5, ARBOR_TAIL_PX / pathLength(route))
    }
    ctx.restore()
  }
  ctx.restore()
}

function drawSoma(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  hot: boolean,
  level: number,
  s: SceneState,
): void {
  if (!inView(s.view, SOMA, SOMA_R * 2)) return
  const r = SOMA_R
  ctx.save()
  ctx.globalAlpha = alpha

  // The cell body flushes warm in proportion to how much has added up.
  softGlow(ctx, SOMA.x, SOMA.y, r * 1.9, SIGNAL_RGB, level * 0.45)

  const body = ctx.createRadialGradient(
    SOMA.x - r * 0.35,
    SOMA.y - r * 0.35,
    0,
    SOMA.x,
    SOMA.y,
    r,
  )
  body.addColorStop(0, hot ? 'rgba(226, 232, 240, 0.62)' : 'rgba(203, 213, 225, 0.5)')
  body.addColorStop(1, CYTOPLASM)
  ctx.fillStyle = body
  ctx.strokeStyle = hot ? MEMBRANE_HOT : MEMBRANE
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  // The traced star outline (neuron (1).svg) — the seven-point body with its
  // hillock cone, in place of the old circle.
  ctx.beginPath()
  for (const [i, p] of SOMA_OUTLINE.entries()) {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  disc(ctx, { x: SOMA.x + 6, y: SOMA.y + 4 }, r * 0.28, NUCLEUS)
  ctx.restore()
}

// --------------------------------------------------------------- target cell

function drawOutput(ctx: CanvasRenderingContext2D, s: SceneState): void {
  const { chain } = s
  if (
    !inView(s.view, OUTPUT.soma, (s.view.right - s.view.left) * 0.6 + OUTPUT.somaR * 4)
  ) {
    return
  }
  ctx.save()
  ctx.globalAlpha = s.selected === null ? 0.75 : 0.32
  ctx.lineCap = 'round'
  const mOut = ctx.getTransform()
  const detail = outgoingDetailAt(Math.hypot(mOut.a, mOut.b))
  // The rest of its own fan — a whole cell, not three stubs.
  for (const stroke of OUTPUT.fan) fadingPath(ctx, stroke, 2.2, '148, 163, 184', 0.9)
  for (const [di, d] of OUTPUT.dendrites.entries()) {
    // The synapsing dendrite's stand-in gives way to the demo's own
    // spine-tipped dendrite as the camera plunges.
    const standIn = di === 1 ? detail.standIn : 1
    if (standIn <= 0.01) continue
    ctx.save()
    ctx.globalAlpha *= standIn
    strokePath(ctx, d.path, 2.8, PARTNER)
    // Its postsynaptic specialization: the spine head our bouton speaks to.
    drawSpine(ctx, d.path, PARTNER, SPINE_FILL_PARTNER)
    ctx.restore()
  }
  if (detail.anatomy > 0.01) outgoingAnatomy(ctx, detail.anatomy)
  // ⚠ THE TWO ASTROCYTES (21b-1b): the third cell on the map, one per glial
  // finger of the synapse view. Stand-ins at the scene's register, they
  // dissolve OUT on the dive exactly as the bouton stand-in does — the
  // anatomy's own mouth-fingers dissolve IN — so the two representations are
  // never both on screen.
  for (const a of ASTROCYTES) drawAstrocyteCell(ctx, a, detail.standIn)
  strokePath(ctx, OUTPUT.axon, 2.6, PARTNER)
  partnerSoma(ctx, OUTPUT.outline, OUTPUT.soma, OUTPUT.somaR, chain.targetFlash > 0)

  if (chain.outgoingCrossing !== null) {
    messengers(ctx, OUTGOING.bouton, OUTGOING.tip, chain.outgoingCrossing)
  }
  if (chain.targetRipple !== null) {
    // One small ripple spreading toward its soma — visibly weaker than the
    // action potential that caused it.
    const target = OUTPUT.dendrites[1]
    // Along its own traced dendrite, tip → soma.
    const p = polylinePoint([...target.path].reverse(), chain.targetRipple)
    softGlow(ctx, p.x, p.y, 13, SIGNAL_RGB, 0.7)
    disc(ctx, p, 2.8, SIGNAL_CORE)
  }
  softGlow(
    ctx,
    OUTPUT.soma.x,
    OUTPUT.soma.y,
    OUTPUT.somaR * 1.8,
    SIGNAL_RGB,
    chain.targetFlash * 0.4,
  )

  ctx.restore()

  if (s.labelsOn === false) return
  screenLabels(ctx, s, [
    {
      text: OUTPUT.label,
      at: { x: OUTPUT.soma.x, y: OUTPUT.soma.y + OUTPUT.somaR },
      to: OUTPUT.soma,
      dx: -26,
      dy: 16,
      color: LABEL,
      align: 'center',
      alpha: s.selected === null ? 0.9 : 0.35,
    },
  ])
}

// ------------------------------------------------------------------- signals

function drawFocusSignals(ctx: CanvasRenderingContext2D, s: SceneState): void {
  const { chain } = s

  // Graded ripples: one per firing input, travelling its own branch inward and
  // fading as it goes.
  if (chain.ripple !== null) {
    for (const id of s.firedInputs) {
      const input = INPUTS.find((i) => i.id === id)
      if (!input) continue
      const path = DENDRITE_TRUNKS[input.trunk].path
      // Path runs soma → tip; the ripple travels the other way.
      const p = polylinePoint(path, 1 - chain.ripple)
      const strength = chain.rippleStrength / 0.5
      softGlow(ctx, p.x, p.y, 9 * strength + 3, SIGNAL_RGB, 0.75 * strength)
      ctx.save()
      ctx.globalAlpha = strength
      disc(ctx, p, 2.6 * strength + 0.8, SIGNAL_CORE)
      ctx.restore()
    }
  }

  if (chain.hillockFlash > 0) {
    softGlow(ctx, HILLOCK.x, HILLOCK.y, 34, SIGNAL_RGB, chain.hillockFlash * 0.85)
  }
  if (chain.axonHead !== null) {
    travellingSignal(ctx, AXON_POLYLINE, chain.axonHead, 8, 0.11)
  }
}

/** The instrument that makes threshold visible: a running total at the hillock
 *  with the threshold marked on it. Counter-scaled, so it stays readable at
 *  any magnification. */
/** The instrument that makes threshold visible: a running total at the hillock
 *  with the threshold marked on it. Counter-scaled, so it stays readable at
 *  any magnification. */
function drawHillockMeter(ctx: CanvasRenderingContext2D, s: SceneState): void {
  const k = 1 / s.cameraScale
  const h = 74 * k
  const w = 9 * k
  const x = HILLOCK.x - 30 * k
  const y = HILLOCK.y - 96 * k
  if (!inView(s.view, { x, y }, h)) return
  const level = clamp01(s.chain.hillockLevel)
  const alpha = s.selected === null || s.selected === 'soma' ? 1 : 0.35

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)'
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'
  ctx.lineWidth = 1 * k
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.fill()
  ctx.stroke()

  if (level > 0) {
    const fill = h * level
    const grad = ctx.createLinearGradient(x, y + h - fill, x, y + h)
    grad.addColorStop(0, `rgba(${SIGNAL_RGB}, 0.95)`)
    grad.addColorStop(1, `rgba(${SIGNAL_RGB}, 0.45)`)
    ctx.fillStyle = grad
    ctx.fillRect(x, y + h - fill, w, fill)
  }

  // Threshold line.
  const ty = y + h - h * THRESHOLD
  ctx.strokeStyle = '#f87171'
  ctx.lineWidth = 1.5 * k
  ctx.setLineDash([3 * k, 2 * k])
  ctx.beginPath()
  ctx.moveTo(x - 4 * k, ty)
  ctx.lineTo(x + w + 4 * k, ty)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  screenLabels(ctx, s, [
    {
      text: 'threshold',
      at: HILLOCK,
      dx: -30 + 9 + 7,
      dy: -96 + 74 - 74 * THRESHOLD + 3,
      color: '#f87171',
      size: 10,
      alpha,
    },
    {
      text: 'total',
      at: HILLOCK,
      dx: -30 + 4.5,
      dy: -96 - 5,
      color: LABEL,
      size: 10,
      align: 'center',
      alpha,
    },
  ])
}

// ------------------------------------------------------------ labels & marks

function drawLabels(ctx: CanvasRenderingContext2D, s: SceneState): void {
  if (s.labelsOn === false) return
  const pad = 80 / s.cameraScale
  screenLabels(
    ctx,
    s,
    LABELS.flatMap((l) => {
      if (!inView(s.view, { x: l.x, y: l.y }, pad)) return []
      const hot = s.selected === l.part || s.hovered === l.part
      return [
        {
          text: l.text,
          at: { x: l.x, y: l.y },
          // ⚠ Asked, never assumed: one predicate decides what the scene
          // says aloud, and the markers below ask the same one.
          speak: sceneTermSpeaks(l.text) ? l.text : undefined,
          // Only the soma is a THING to point at. `dendrites`, `axon` and
          // `axon terminals` name extended structures, and a leader to one
          // point on a two-hundred-pixel fan reads as "this one branch".
          to: l.part === 'soma' ? SOMA : undefined,
          color: hot ? LABEL_HOT : LABEL,
          alpha: partAlpha(l.part, s.selected, s.hovered),
        },
      ]
    }),
  )
}

/** Dashed rings marking the places we can zoom into — the visible map of
 *  what is coming next. */
/** ⚠ HOW A ZOOM MARKER LOOKS, resting and hovered (user, 2026-09-04:
 *  "magnifying glass areas are not visible on the big neuron, as things got
 *  more cluttered. Make the hover state into active state, but without
 *  labels. On hover add yellow glow and labels").
 *
 *  The scene has gained a great deal since these were drawn — a traced fan
 *  with twigs, seven boutons, four partner cells, six astrocytes — and a
 *  marker at 0.75 alpha in the same slate as everything else stopped being
 *  findable. A door nobody can see is a door that is not there.
 *
 *  So the RESTING marker now carries the prominence the hover state used to:
 *  a full-strength ring and icon, on a dark backing disc — the same answer
 *  the app already uses for a name that would otherwise disappear into what
 *  it lies on. The backing is what makes it survive clutter, rather than yet
 *  more brightness competing with a bright scene.
 *
 *  HOVER is then free to mean one thing only: the yellow glow, and the name.
 *  Yellow stays reserved for hover here, so "which door is under my pointer"
 *  is answered by colour and not by a difference in strength nobody can see.
 *
 *  Returned as numbers rather than drawn inline so the choice can be asked
 *  directly (03 → *Ask the DECISION, not the ink*). */
export interface MarkerStyle {
  /** Opacity of the dark disc behind the ring — 0 for none. */
  backing: number
  ringAlpha: number
  iconAlpha: number
  /** The yellow glow. Hover only. */
  glow: number
  /** The ink, as an `r, g, b` triple. */
  ink: string
  /** Whether the target's name is drawn beside it. */
  label: boolean
}

export function markerStyle(hot: boolean): MarkerStyle {
  return hot
    ? {
        backing: 0.62,
        ringAlpha: 1,
        iconAlpha: 1,
        glow: 0.55,
        ink: MARKER_HOT,
        label: true,
      }
    : {
        backing: 0.55,
        ringAlpha: 1,
        iconAlpha: 1,
        glow: 0,
        ink: MARKER_REST,
        label: false,
      }
}

function drawMarkers(ctx: CanvasRenderingContext2D, s: SceneState): void {
  if (!s.showMarkers) return
  const k = 1 / s.cameraScale
  const labels: ScreenLabel[] = []
  ctx.save()
  for (const target of ZOOM_TARGETS) {
    const st = markerStyle(s.hoveredMarker === target.id)
    const r = MARKER_R * k
    if (st.glow > 0) {
      softGlow(ctx, target.center.x, target.center.y, r * 2.1, st.ink, st.glow)
    }
    // The backing disc: a marker has to be findable over a traced dendrite, a
    // bouton or an astrocyte's body, and darkening what is behind it does
    // that without shouting.
    disc(ctx, target.center, r * 1.06, `rgba(2, 6, 23, ${st.backing})`)
    ctx.strokeStyle = `rgba(${st.ink}, ${st.ringAlpha})`
    ctx.lineWidth = 1.8 * k
    ctx.setLineDash([4 * k, 3 * k])
    ctx.beginPath()
    ctx.arc(target.center.x, target.center.y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    labels.push({
      text: '🔎',
      at: target.center,
      dy: 4,
      color: `rgba(${st.ink}, ${st.iconAlpha})`,
      size: 11,
      align: 'center',
      // No plate: it sits inside its own dashed ring, and a dark box behind it
      // reads as a second, squarer marker fighting the round one.
      plate: false,
    })
    if (st.label) {
      labels.push({
        // A door's name goes through the SAME predicate the parts do — which
        // says no, and would have to be changed on purpose to say otherwise.
        speak: sceneTermSpeaks(target.label) ? target.label : undefined,
        text: target.label,
        at: target.center,
        dy: -MARKER_R - 8,
        color: `rgba(${st.ink}, 1)`,
        size: 12,
        align: 'center',
      })
    }
  }
  ctx.restore()
  screenLabels(ctx, s, labels)
}

/** Live magnification, pinned to the corner of the canvas. Makes the scale
 *  journey legible: the number climbs while the camera plunges. */
/** The membrane voltage: what it is now, and what it does over a spike (N10,
 *  N16, N17) — one instrument.
 *
 *  These were two panels in two corners, and they were showing the same
 *  quantity: the number in one, and a marker sitting at exactly that number in
 *  the other. Merging them removes an instrument from a crowded picture and, more
 *  to the point, makes the relationship visible — the reading and the dot on the
 *  curve are plainly the same thing.
 *
 *  The number is the panel's SUBJECT and the trace its body, which is the right
 *  way round: the reading is always true, while the curve is a prediction until a
 *  spike is running. Merging them the other way would have filed the resting
 *  voltage inside something captioned "what a spike would do".
 *
 *  The trace is drawn whether or not a spike is running, because it is a pure
 *  function of the gradients rather than a recording. Dim means "what a spike
 *  would do from here"; bright means "how far this one has got". Drag a gradient
 *  flat and the curve visibly collapses before anything is fired. */
function drawVoltagePanel(ctx: CanvasRenderingContext2D, s: SceneState): void {
  if (s.cameraScale < BILAYER_SCALE || s.apTrace.length < 2) return
  // The stage, not the view: under rotation the view rect is a bounding box and
  // would put this panel off the edge of the canvas.
  const screenW = STAGE_W
  const screenH = STAGE_H
  const panel = { w: 330, h: 200, x: 0, y: 0 }
  panel.x = screenW - panel.w - 14
  panel.y = screenH - panel.h - 14
  labelKeepOut.push(panel)

  const t = polarizationT(
    s.vm,
    s.vmRest,
    nernstMv('na', s.counts),
    nernstMv('k', s.counts),
  )
  const resting = Math.abs(s.vm - s.vmRest) < 3
  const up = t > 0
  const state = resting ? '#94a3b8' : up ? '#fca5a5' : '#7dd3fc'
  const word = resting ? 'resting' : up ? 'DEPOLARIZED' : 'HYPERPOLARIZED'
  // The sentence that used to go under the word now lives in the describer —
  // see `voltageNote` in core/actionPotential.ts.

  const plot = {
    left: panel.x + 48,
    right: panel.x + panel.w - 12,
    top: panel.y + 82,
    bottom: panel.y + panel.h - 24,
  }
  const yFor = (mv: number) =>
    plot.bottom - clamp01((mv - VM_MIN) / (VM_MAX - VM_MIN)) * (plot.bottom - plot.top)
  const xFor = (u: number) => plot.left + clamp01(u) * (plot.right - plot.left)

  withScreen(ctx, s, (c) => {
    c.fillStyle = LABEL_PLATE
    c.strokeStyle = resting ? 'rgba(148, 163, 184, 0.32)' : state
    c.lineWidth = resting ? 1 : 1.6
    c.beginPath()
    c.roundRect(panel.x, panel.y, panel.w, panel.h, 10)
    c.fill()
    c.stroke()
    // A stripe of the direction's colour down the edge, so which way it has gone
    // registers before any of the words are read.
    if (!resting) {
      c.fillStyle = state
      c.beginPath()
      c.roundRect(panel.x, panel.y + 10, 4, 62, 2)
      c.fill()
    }

    // Each ion's own voltage, and zero — the membrane sits at an average pulled
    // between them, and the curve never outruns either.
    c.setLineDash([3, 3])
    c.lineWidth = 1
    for (const [mv, colour] of [
      [nernstMv('na', s.counts), GLOSSY_COLORS.na.mid],
      [nernstMv('k', s.counts), GLOSSY_COLORS.k.mid],
    ] as const) {
      c.strokeStyle = colour
      c.beginPath()
      c.moveTo(plot.left, yFor(mv))
      c.lineTo(plot.right, yFor(mv))
      c.stroke()
    }
    c.setLineDash([])
    c.strokeStyle = 'rgba(203, 213, 225, 0.3)'
    c.beginPath()
    c.moveTo(plot.left, yFor(0))
    c.lineTo(plot.right, yFor(0))
    c.stroke()

    // Resting, as a line to judge the dip against: the undershoot only means
    // anything next to where it started.
    c.strokeStyle = 'rgba(148, 163, 184, 0.45)'
    c.setLineDash([1, 4])
    c.beginPath()
    c.moveTo(plot.left, yFor(s.vmRest))
    c.lineTo(plot.right, yFor(s.vmRest))
    c.stroke()
    c.setLineDash([])

    const path = (from: number, to: number) => {
      c.beginPath()
      for (let i = from; i <= to; i++) {
        const u = i / (s.apTrace.length - 1)
        const p = { x: xFor(u), y: yFor(s.apTrace[i]) }
        if (i === from) c.moveTo(p.x, p.y)
        else c.lineTo(p.x, p.y)
      }
      c.stroke()
    }

    // Only what has already happened. The whole curve used to be drawn faintly
    // underneath, as the shape a spike WOULD take — which gave the answer away.
    // A child watching this for the first time should be able to wonder what
    // comes next, and be surprised by the dip. What is lost is being able to
    // reshape the curve with the gradient sliders BEFORE firing; the consequence
    // panel makes that point in words instead.
    const last = s.apTrace.length - 1
    const upto = s.apU === null ? -1 : Math.round(s.apU * last)

    // THE SPIKE, COLOUR-CODED (user, 2026-08-28). The part of the run that has
    // happened is shaded between the trace and the RESTING line — red where
    // the inside has gone positive, blue where it has dipped below where it
    // started. Same two colours the cytoplasm's own tint uses, and the same
    // translucent alphas the spike-train bench bands with, so a child who has
    // learned "red means depolarized" out on the canvas reads this without
    // being told again.
    if (upto > 0) {
      const restY = yFor(s.vmRest)
      for (const [above, ink] of [
        [true, 'rgba(248, 113, 113, 0.17)'],
        [false, 'rgba(125, 211, 252, 0.15)'],
      ] as const) {
        c.fillStyle = ink
        c.beginPath()
        c.moveTo(xFor(0), restY)
        for (let i = 0; i <= upto; i++) {
          const u = i / last
          const mv = s.apTrace[i]
          const on = above ? mv > s.vmRest : mv < s.vmRest
          c.lineTo(xFor(u), on ? yFor(mv) : restY)
        }
        c.lineTo(xFor(upto / last), restY)
        c.closePath()
        c.fill()
      }
    }

    c.lineJoin = 'round'
    c.lineCap = 'round'
    if (upto > 0) {
      c.strokeStyle = '#fcd34d'
      c.lineWidth = 2.4
      path(0, upto)
      const x = xFor(s.apU ?? 0)
      const y = yFor(s.apTrace[upto])
      c.strokeStyle = 'rgba(252, 211, 77, 0.35)'
      c.lineWidth = 1
      c.beginPath()
      c.moveTo(x, plot.top)
      c.lineTo(x, plot.bottom)
      c.stroke()
      // The marker and the big number are the same reading. Drawn in the
      // direction's colour to say so.
      c.fillStyle = state
      c.strokeStyle = '#fffbeb'
      c.lineWidth = 1.2
      c.beginPath()
      c.arc(x, y, 4, 0, Math.PI * 2)
      c.fill()
      c.stroke()
    }
  })

  const label = (
    text: string,
    dx: number,
    dy: number,
    color: string,
    size = 10,
    align?: CanvasTextAlign,
  ) => ({
    text,
    at: ORIGIN,
    dx,
    dy,
    color,
    size,
    align,
    plate: false,
    screen: true,
  })

  screenLabels(ctx, s, [
    label(
      `${s.vm > 0 ? '+' : '−'}${Math.abs(s.vm).toFixed(0)} mV`,
      panel.x + 16,
      panel.y + 34,
      state,
      25,
    ),
    // The state's NAME stays — it is the reading's label, and a number with no
    // name is not a reading. The sentence that used to sit under it has gone to
    // the describer: "inside negative, as it always is" explains the number rather
    // than labelling it, and explanation on the canvas is explanation in the one
    // place a child cannot scroll back to.
    label(word, panel.x + 16, panel.y + 56, state, 11),
    label(`+${Math.round(VM_MAX)} mV`, plot.left - 6, plot.top + 4, LABEL, 9, 'right'),
    label(`−${Math.abs(VM_MIN)}`, plot.left - 6, plot.bottom + 4, LABEL, 9, 'right'),
    label(
      // Just the real duration. "N seconds shown" was ambiguous once playback
      // began pausing between steps — the curve is the same real milliseconds
      // either way, and that is the number worth knowing.
      s.apU === null
        ? `${AP_REAL_MS} ms of real time, once something happens`
        : `this spike · ${AP_REAL_MS} ms of real time`,
      plot.right,
      panel.y + panel.h - 8,
      s.apU === null ? LABEL : '#fcd34d',
      9,
      'right',
    ),
  ])
}

function drawMagnification(ctx: CanvasRenderingContext2D, s: SceneState): void {
  if (s.cameraScale < 1.05) return
  // Top RIGHT: the zoom-out button overlays the top left.
  screenLabels(ctx, s, [
    {
      text: `×${Math.round(s.cameraScale)}`,
      at: ORIGIN,
      dx: STAGE_W - 14,
      dy: 24,
      color: '#cbd5e1',
      align: 'right',
      alpha: 0.9,
      screen: true,
    },
  ])
}

// The colour field over the cytoplasm runs through a neutral middle rather than
// switching between two hues — cold sky, through slate at rest, to warm red. Both
// ends are the palette's charge colours, and the middle is the membrane's own
// grey, so nothing new is introduced and there is no point at which the colour
// jumps.
/** How far from rest the membrane is, as a colour over the cytoplasm (N16).
 *
 *  Two decisions worth writing down. First, it shows the difference from REST,
 *  not the absolute polarity — a cell at rest is already polarized, and if the
 *  aura showed that it would be permanently blue and the small hyperpolarizing
 *  dip invisible against it. Difference-from-rest is what the words depolarized
 *  and hyperpolarized actually mean, and the absolute polarity is still on
 *  screen as the + and − marks on the two faces.
 *
 *  Second, it tints the INSIDE. The voltage is the inside measured against the
 *  outside, so the inside is what the number is about; and the colours are the
 *  ones the charge marks already use — red for positive-going, sky for
 *  negative-going. */
function drawAura(ctx: CanvasRenderingContext2D, s: SceneState): void {
  if (s.cameraScale < BILAYER_SCALE) return
  const t = polarizationT(
    s.vm,
    s.vmRest,
    nernstMv('na', s.counts),
    nernstMv('k', s.counts),
  )
  // Never quite off. A field that blinks out at rest and back in with the other
  // hue reads as a flicker; one that is always there, changing colour, reads as
  // something warming up and cooling down — which is what it is. The floor is
  // folded into the wash's peak rather than into `t`, so the COLOUR still comes
  // from the real polarization.
  const strength = 0.11 + 0.89 * Math.abs(t)

  for (const target of ZOOM_TARGETS) {
    if (!target.frame) continue
    if (!inView(s.view, target.frame.at, (s.view.right - s.view.left) * 1.5)) continue
    const span = (s.view.right - s.view.left) * 1.6
    const depth = (s.view.bottom - s.view.top) * 1.6
    ctx.save()
    enterPatch(ctx, target.frame)
    // Strongest against the membrane and fading inward, because the charge the
    // voltage IS sits in a thin skin against the membrane rather than spread
    // evenly through the cell.
    // Fades in from nothing at the wall's edge — see `chargeWash`; the peak
    // stays a sliver inside the water, where the charge really sits.
    ctx.fillStyle = chargeWash(
      ctx,
      HALF_MEM,
      depth,
      t,
      (0.6 * strength) / Math.max(0.02, Math.abs(t)),
    )
    ctx.fillRect(-span, HALF_MEM, span * 2, depth)
    ctx.restore()
  }
}

/** The charge itself: a thin skin of excess ions hugging each face. This is
 *  what the voltage IS, and only a vanishing number of ions are involved —
 *  which is why the two crowds never visibly change. */
function drawMembraneCharge(ctx: CanvasRenderingContext2D, s: SceneState): void {
  if (s.cameraScale < BILAYER_SCALE) return
  const strength = Math.min(1, Math.abs(s.vm) / 80)
  if (strength < 0.05) return
  // Negative voltage means the inside carries the excess negative charge.
  const insideNegative = s.vm < 0
  const spacing = LIPID_PX * 7
  const offset = HALF_MEM + LIPID_PX * 1.6

  for (const target of ZOOM_TARGETS) {
    if (!target.frame) continue
    if (!inView(s.view, target.frame.at, (s.view.right - s.view.left) * 1.5)) continue
    const span = (s.view.right - s.view.left) * 0.62
    ctx.save()
    enterPatch(ctx, target.frame)
    ctx.lineCap = 'round'
    ctx.lineWidth = LIPID_PX * 0.22
    for (let along = -span; along <= span; along += spacing) {
      for (const side of [-1, 1] as const) {
        // side −1 is outside the cell, +1 the cytoplasm.
        const negative = side === 1 ? insideNegative : !insideNegative
        ctx.strokeStyle = negative
          ? `rgba(125, 211, 252, ${0.35 + strength * 0.5})`
          : `rgba(248, 113, 113, ${0.35 + strength * 0.5})`
        const y = side * offset
        const arm = LIPID_PX * 0.5
        ctx.beginPath()
        ctx.moveTo(along - arm, y)
        ctx.lineTo(along + arm, y)
        if (!negative) {
          ctx.moveTo(along, y - arm)
          ctx.lineTo(along, y + arm)
        }
        ctx.stroke()
      }
    }
    ctx.restore()
  }
}

export function drawScene(ctx: CanvasRenderingContext2D, s: SceneState): void {
  const hot = (part: NeuronPartId) => s.selected === part || s.hovered === part
  const alpha = (part: NeuronPartId) => partAlpha(part, s.selected, s.hovered)
  queuedLabels = []
  spokenBoxes = []
  labelKeepOut = []

  // Backdrop first: how far the membrane is from resting.
  drawAura(ctx, s)
  drawInputs(ctx, s)
  drawOutput(ctx, s)
  // ⚠ THE ASTROCYTES AMONG THE DENDRITES (user, 2026-09-04). Under the
  // neuron, like the other partner cells: the third cell is a neighbour the
  // branches pass through, not something laid over them. They do NOT dissolve
  // with the synapse dive — they belong to the dendritic field, not to that
  // one synapse's level of detail.
  for (const a of DENDRITE_ASTROCYTES) drawAstrocyteCell(ctx, a, DENDRITE_GLIA_ALPHA)

  // Processes first, cell body last, so the branches tuck under the soma.
  drawDendrites(ctx, alpha('dendrites'), hot('dendrites'), s)
  drawAxon(ctx, alpha('axon'), hot('axon'), s)
  drawTerminals(ctx, alpha('terminals'), hot('terminals'), s)
  drawSoma(ctx, alpha('soma'), hot('soma'), s.chain.hillockLevel, s)

  drawMembraneCharge(ctx, s)
  drawProteins(ctx, s)
  drawIons(ctx, s)
  drawFocusSignals(ctx, s)
  drawLabels(ctx, s)
  drawHillockMeter(ctx, s)
  drawMarkers(ctx, s)
  drawVoltagePanel(ctx, s)
  drawMagnification(ctx, s)
  // Last of all: words on top of everything.
  flushLabels(ctx)
}
