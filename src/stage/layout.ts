import type { NeuronPartId, TeachingPara } from '../core/neuron'
import {
  AXON_DIAMETER_UM,
  LIPID_HEAD_NM,
  MEMBRANE_FACTS,
  MEMBRANE_THICKNESS_UM,
  SOMA_DIAMETER_UM,
} from '../core/membrane'
import { ION_FACTS } from '../core/ions'
import { LEAK_FACTS, PUMP_FACTS } from '../core/proteins'
import { CHANNELS, CHANNEL_OVERVIEW } from '../core/channels'
import { VOLTAGE_FACTS } from '../core/voltage'

// Geometry of the whole scene: three input neurons, the focus neuron, and its
// target. Partners are drawn small and clipped by the canvas edges — the
// frame is a window on a network that keeps going, not the whole world.
export const STAGE_W = 1060
export const STAGE_H = Math.max(
  660,
  (typeof window !== 'undefined' ? window.innerHeight : 660) - 46,
)

export interface Pt {
  x: number
  y: number
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

const len = (p: Pt): number => Math.hypot(p.x, p.y)
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y })
const norm = (p: Pt): Pt => {
  const l = len(p) || 1
  return { x: p.x / l, y: p.y / l }
}

/** Points along a quadratic curve through a bowed control point. */
function quadratic(p0: Pt, p2: Pt, bow: number, steps = 24): Pt[] {
  const mid = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 }
  const d = norm(sub(p2, p0))
  const p1 = { x: mid.x - d.y * bow, y: mid.y + d.x * bow }
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    const u = 1 - t
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    }
  })
}

/** Sample a polyline by arc length, t ∈ [0, 1]. */
export function polylinePoint(path: Pt[], t: number): Pt {
  if (path.length < 2) return path[0]
  const lens = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y))
  const total = lens.reduce((a, b) => a + b, 0)
  let d = clamp01(t) * total
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] === 0 ? 0 : clamp01(d / lens[i])
      return {
        x: path[i].x + (path[i + 1].x - path[i].x) * f,
        y: path[i].y + (path[i + 1].y - path[i].y) * f,
      }
    }
    d -= lens[i]
  }
  return path[path.length - 1]
}

/** Total length of a polyline, in scene pixels. */
export function pathLength(path: Pt[]): number {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
  }
  return total
}

export interface WallSample {
  /** Point on the wall — the middle of the membrane. */
  at: Pt
  /** Unit vector along the membrane. */
  tangent: Pt
  /** Unit vector from the membrane toward the cell interior. */
  inward: Pt
}

/** A point on one wall of a tube-shaped process, with the local directions
 *  needed to draw membrane structure there. `side` picks which wall. */
export function wallSample(
  centre: Pt[],
  halfWidth: number,
  side: 1 | -1,
  t: number,
): WallSample {
  const eps = 0.002
  const a = polylinePoint(centre, Math.max(0, t - eps))
  const b = polylinePoint(centre, Math.min(1, t + eps))
  const tangent = norm(sub(b, a))
  const normal = { x: -tangent.y, y: tangent.x }
  const here = polylinePoint(centre, t)
  return {
    at: {
      x: here.x + normal.x * side * halfWidth,
      y: here.y + normal.y * side * halfWidth,
    },
    tangent,
    // The interior is always back toward the centreline.
    inward: { x: -normal.x * side, y: -normal.y * side },
  }
}

// ---------------------------------------------------------------- focus cell

export const SOMA: Pt = { x: 430, y: STAGE_H * 0.46 }
export const SOMA_R = 44
export const AXON_END: Pt = { x: 872, y: STAGE_H * 0.46 }
export const BOUTON_R = 10

// The scene has ONE honest scale, set by the soma, and the axon's drawn width
// follows from real biology rather than from what looks nice. Everything
// smaller (the membrane, a lipid head) is then genuinely too thin to see until
// the camera zooms in — which is the point.
export const PX_PER_UM = (2 * SOMA_R) / SOMA_DIAMETER_UM
export const AXON_W = AXON_DIAMETER_UM * PX_PER_UM
/** Membrane thickness in scene pixels: about a fortieth of a pixel. */
export const MEMBRANE_PX = MEMBRANE_THICKNESS_UM * PX_PER_UM
/** One phospholipid head, in scene pixels. */
export const LIPID_PX = (LIPID_HEAD_NM / 1000) * PX_PER_UM
/** Centre-to-centre spacing of neighbouring lipids, as a fraction of a head.
 *  Slightly over 1, leaving a small gap: a bilayer is a LIQUID, and drawing it
 *  as a seamless wall of bricks is its own misconception. The gaps are kept
 *  narrow and are jittered per molecule (see drawScene) so they read as a
 *  jostling crowd rather than a row of fixed pores — ions never cross through
 *  gaps at all, whatever their size. */
export const LIPID_PACKING = 1.16
/** How much each lipid is nudged along and across the membrane, as a fraction
 *  of a head. Deterministic per molecule, so the crowd looks irregular without
 *  shimmering every frame. */
export const LIPID_JITTER = 0.2

/** Magnification at which a process stops being a line and reads as a tube. */
export const TUBE_SCALE = 5
/** Magnification at which a membrane resolves into individual lipids. */
export const BILAYER_SCALE = 500
/** Magnification that renders the bilayer at a comfortable ~68 px — big enough
 *  that an ion (smaller than a lipid head, honestly so) is still legible. */
export const MEMBRANE_ZOOM = Math.round(68 / MEMBRANE_PX / 100) * 100
/** Width of a synaptic gap on screen (hugely exaggerated: a real cleft is
 *  ~20 nm, about a thousandth of the soma's width). */
export const CLEFT = 14

/** Point on the axon's gentle curve, t ∈ [0, 1]. */
export function axonPoint(t: number): Pt {
  const p0: Pt = { x: SOMA.x + SOMA_R - 6, y: SOMA.y }
  const p1: Pt = { x: (p0.x + AXON_END.x) / 2, y: SOMA.y - 44 }
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * AXON_END.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * AXON_END.y,
  }
}

export const AXON_POLYLINE: Pt[] = Array.from({ length: 41 }, (_, i) => axonPoint(i / 40))

/** Where along the axon the propagation view is entered. Far enough from the
 *  soma to be plainly "the cable" rather than "where the cable starts", and
 *  clear of the membrane-patch marker further along. */
export const AXON_SIGNAL_T = 0.3

/** ⚠ WHERE THE SECOND AXON EXHIBIT LIVES (user, 2026-08-31: "let's follow
 *  'Axonal conduction and myelin' pattern, and add another entry point:
 *  magnifying glass on the 'big neuron'").
 *
 *  Passive spread is a place on this cell, not a thought about it, so it gets a
 *  marker of its own — the app's own dashed ring with a 🔎 inside it — rather
 *  than a drawer over the scene. It sits FURTHER DOWN the axon than the
 *  conduction view, chosen so the two axon doors never overlap: measured, the
 *  markers along the axon land at x ≈ 589 (conduction), 690 (membrane patch),
 *  800 (here) and 938 (the outgoing synapse), against a marker radius of 14. */
export const AXON_PASSIVE_T = 0.82

/** How wide the axon is drawn when the camera is at the propagation view, px.
 *  Fat enough to be a tube with an inside, rather than a line. */
const AXON_VIEW_PX = 86

/** Magnification of the propagation view — derived, so it is whatever it takes
 *  to draw this axon's real width at a readable size, rather than a number
 *  chosen to make a picture work. */
export const AXON_VIEW_SCALE = Math.round(AXON_VIEW_PX / AXON_W)

/** What the camera settles at for the synapse view.
 *
 *  The bouton is ~1 µm across (`BOUTON_DIAMETER_UM`) and the drawing gives it
 *  about 42% of a 1060 px stage, so the magnification is what makes a
 *  micrometre fill four hundred pixels. Derived rather than picked: change how
 *  big the terminal is drawn and the camera follows it. */
export const SYNAPSE_VIEW_SCALE = Math.round((STAGE_W * 0.42) / (1 * PX_PER_UM))


/** Which way this stretch of axon runs, radians. */
function axonSlopeAt(t: number): number {
  const a = axonPoint(Math.max(0, t - 0.002))
  const b = axonPoint(Math.min(1, t + 0.002))
  return Math.atan2(b.y - a.y, b.x - a.x)
}

/** How far the camera turns on arriving at the propagation view: exactly enough
 *  to bring this stretch of axon level. Level matters here in a way it does not
 *  at a membrane patch — a ruler in millimetres and a graph of voltage against
 *  distance both have to be square to the screen to be readable, and the axon
 *  they belong to has to be square to them. */
export const AXON_SIGNAL_TURN = -axonSlopeAt(AXON_SIGNAL_T)
export const AXON_PASSIVE_TURN = -axonSlopeAt(AXON_PASSIVE_T)
export const AXON_FLAT: number[] = AXON_POLYLINE.flatMap((p) => [p.x, p.y])
/** Where the axon leaves the soma — where an action potential is born. */
export const HILLOCK: Pt = axonPoint(0.015)

/** How long the drawn axon is, in the scene's own honest micrometres.
 *
 *  Measured off the curve rather than stated, and it comes out at well under a
 *  tenth of a millimetre — which is why propagation cannot be shown on this
 *  stage at any magnification, and why the view that does show it puts THIS
 *  number on its ruler as a tick. See core/cable.ts. */
export const DRAWN_AXON_UM = pathLength(AXON_POLYLINE) / PX_PER_UM

export interface DendriteSeg {
  x1: number
  y1: number
  x2: number
  y2: number
  w: number
  trunk: number
  /** 0 = trunk, 1 = branch, 2 = twig — drives the growth animation. */
  depth: number
}

export interface DendriteTrunk {
  segs: DendriteSeg[]
  /** Root→tip chain used for travelling ripples. */
  path: Pt[]
}

const MAX_DEPTH = 2

function grow(
  x: number,
  y: number,
  angle: number,
  length: number,
  w: number,
  depth: number,
  trunk: number,
  segs: DendriteSeg[],
): void {
  const x2 = x + Math.cos(angle) * length
  const y2 = y + Math.sin(angle) * length
  segs.push({ x1: x, y1: y, x2, y2, w, trunk, depth })
  if (depth === MAX_DEPTH) return
  // First child pushed first, so segs[0..MAX_DEPTH] is a root→tip chain.
  grow(x2, y2, angle - 0.45, length * 0.58, w * 0.6, depth + 1, trunk, segs)
  grow(x2, y2, angle + 0.4, length * 0.54, w * 0.55, depth + 1, trunk, segs)
}

/** Deterministic dendritic tree fanning over the soma's left hemisphere
 *  (canvas angles 100°–260° = down-left through up-left). */
function buildTrunks(): DendriteTrunk[] {
  return [100, 132, 164, 196, 228, 260].map((deg, i) => {
    const a = (deg * Math.PI) / 180
    const segs: DendriteSeg[] = []
    grow(
      SOMA.x + Math.cos(a) * (SOMA_R - 6),
      SOMA.y + Math.sin(a) * (SOMA_R - 6),
      a,
      76 + (i % 3) * 16,
      5,
      0,
      i,
      segs,
    )
    const chain = segs.slice(0, MAX_DEPTH + 1)
    const path: Pt[] = [
      { x: chain[0].x1, y: chain[0].y1 },
      ...chain.map((s) => ({ x: s.x2, y: s.y2 })),
    ]
    return { segs, path }
  })
}

export const DENDRITE_TRUNKS: DendriteTrunk[] = buildTrunks()
export const DENDRITE_SEGS: DendriteSeg[] = DENDRITE_TRUNKS.flatMap((t) => t.segs)

export interface Terminal {
  end: Pt
  /** Unit vector pointing away from the axon — the way vesicles drift. */
  dir: Pt
}

/** Terminal branches fanning right from the axon's end, a bouton at each tip. */
export const TERMINALS: Terminal[] = [-52, -17, 18, 53].map((deg) => {
  const a = (deg * Math.PI) / 180
  return {
    end: { x: AXON_END.x + Math.cos(a) * 56, y: AXON_END.y + Math.sin(a) * 56 },
    dir: { x: Math.cos(a), y: Math.sin(a) },
  }
})

/** Three vesicles per bouton, at fixed offsets so they never jitter. */
export const VESICLE_OFFSETS: Pt[] = [
  { x: -3.2, y: -2.4 },
  { x: 2.6, y: -3 },
  { x: -0.6, y: 3 },
]
export const VESICLE_R = 2

// -------------------------------------------------------------- input cells

/** Dendrite trunks that carry an incoming synapse. */
export const SYNAPSE_TRUNKS = [2, 3, 4]

/** The far tip of a trunk's root→tip chain. It MUST be a point on `path`,
 *  because that is the route the graded ripple travels back to the soma —
 *  picking the tree's leftmost endpoint instead would put the synapse on a
 *  branch the ripple never follows. */
function synapseSite(trunk: DendriteTrunk): Pt {
  return trunk.path[trunk.path.length - 1]
}

export interface InputNeuron {
  id: number
  label: string
  soma: Pt
  somaR: number
  /** Clipped stubs hinting at the rest of its own dendritic tree. */
  stubs: Array<{ from: Pt; to: Pt }>
  /** Its axon, from soma edge to its bouton on our dendrite. */
  axon: Pt[]
  bouton: Pt
  /** The point on OUR dendrite it talks to. */
  site: Pt
  /** Which of our trunks carries this synapse. */
  trunk: number
}

const PARTNER_SOMA_R = 24

export const INPUTS: InputNeuron[] = SYNAPSE_TRUNKS.map((trunk) => ({
  trunk,
  site: synapseSite(DENDRITE_TRUNKS[trunk]),
}))
  // Top-to-bottom, so each input sits beside the branch it contacts and the
  // axons do not cross each other.
  .sort((a, b) => a.site.y - b.site.y)
  .map(({ trunk, site }, i) => {
    const soma: Pt = { x: 58, y: STAGE_H * [0.17, 0.5, 0.83][i] }
    const toSite = norm(sub(site, soma))
    const bouton: Pt = {
      x: site.x - toSite.x * CLEFT,
      y: site.y - toSite.y * CLEFT,
    }
    const from: Pt = {
      x: soma.x + toSite.x * PARTNER_SOMA_R,
      y: soma.y + toSite.y * PARTNER_SOMA_R,
    }
    return {
      id: i,
      label: `input ${i + 1}`,
      soma,
      somaR: PARTNER_SOMA_R,
      // Away from our neuron, running off the left edge.
      stubs: [150, 180, 210].map((deg) => {
        const a = (deg * Math.PI) / 180
        return {
          from: {
            x: soma.x + Math.cos(a) * (PARTNER_SOMA_R - 4),
            y: soma.y + Math.sin(a) * (PARTNER_SOMA_R - 4),
          },
          to: {
            x: soma.x + Math.cos(a) * (PARTNER_SOMA_R + 74),
            y: soma.y + Math.sin(a) * (PARTNER_SOMA_R + 74),
          },
        }
      }),
      axon: quadratic(from, bouton, i === 1 ? 10 : 26),
      bouton,
      site,
      trunk,
    }
  })

// -------------------------------------------------------------- target cell

export interface OutputNeuron {
  label: string
  soma: Pt
  somaR: number
  /** Dendrite stubs reaching left toward our boutons; [0] is the soma end. */
  dendrites: Array<{ from: Pt; to: Pt; fromTerminal: number }>
  /** Its own axon, running off the right edge. */
  axon: Pt[]
}

const OUT_SOMA: Pt = { x: STAGE_W - 24, y: STAGE_H * 0.46 }
const OUT_R = 28

export const OUTPUT: OutputNeuron = {
  label: 'target neuron',
  soma: OUT_SOMA,
  somaR: OUT_R,
  dendrites: [0, 1, 3].map((ti) => {
    const bouton = TERMINALS[ti].end
    const tip: Pt = { x: bouton.x + CLEFT + BOUTON_R, y: bouton.y }
    const toTip = norm(sub(tip, OUT_SOMA))
    return {
      from: {
        x: OUT_SOMA.x + toTip.x * (OUT_R - 4),
        y: OUT_SOMA.y + toTip.y * (OUT_R - 4),
      },
      to: tip,
      fromTerminal: ti,
    }
  }),
  axon: quadratic(
    { x: OUT_SOMA.x + OUT_R - 4, y: OUT_SOMA.y },
    { x: STAGE_W + 40, y: OUT_SOMA.y + 26 },
    8,
    8,
  ),
}

/** The synapse our neuron makes onto the target: used for the zoom target and
 *  the outgoing-transmitter animation. */
export const OUTGOING = {
  bouton: TERMINALS[OUTPUT.dendrites[1].fromTerminal].end,
  tip: OUTPUT.dendrites[1].to,
}

// ------------------------------------------------------------------- labels

export const LABELS: Array<{ part: NeuronPartId; text: string; x: number; y: number }> = [
  { part: 'dendrites', text: 'dendrites', x: SOMA.x - 76, y: SOMA.y - 196 },
  // Down-RIGHT of the soma: the dendrite fan covers the left hemisphere.
  { part: 'soma', text: 'soma', x: SOMA.x + 8, y: SOMA.y + SOMA_R + 30 },
  { part: 'axon', text: 'axon', x: (SOMA.x + AXON_END.x) / 2 - 14, y: SOMA.y - 72 },
  { part: 'terminals', text: 'axon terminals', x: AXON_END.x - 30, y: AXON_END.y + 84 },
]

// -------------------------------------------------------------- zoom targets

export interface ZoomTarget {
  id: string
  label: string
  center: Pt
  /** Magnification applied to the whole scene. */
  scale: number
  /** What the kid sees once zoomed — honest about what is not built yet. */
  promise: string
  /** Which upcoming milestone lives here. */
  roadmap: string
  /** Teaching content for a target whose view is actually built. When this is
   *  present the panel shows it instead of the promise. */
  content?: TeachingPara[]
  /** For a membrane patch: the local frame of the wall it sits on, so ions can
   *  be placed relative to the membrane rather than to the canvas. */
  frame?: WallSample
  /** How far the camera turns on arriving, radians. A membrane patch works its
   *  own out from the wall it sits on; anything else says so here. */
  turn?: number
  /** Arriving here replaces the scene with a view of its own, so the
   *  whole-neuron controls have nothing left to act on. A membrane patch is one
   *  of these already, by having a `frame`; this names the others. */
  presents?: 'axon' | 'synapse'
}

/** Whether arriving at this target puts up a view of its own rather than a
 *  closer look at the scene. Used by the side panels to decide what is worth
 *  showing: out there you can fire an input and pick a part of the neuron, and
 *  in here neither means anything. */
export function isOwnView(target: ZoomTarget | undefined): boolean {
  return target !== undefined && (target.frame !== undefined || target.presents !== undefined)
}

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** Frame for a membrane zoom: a point ON the wall of a process, so the
 *  membrane lands in the middle of the canvas with the outside on one side and
 *  the cytoplasm on the other. */
function membraneFrame(centre: Pt[], halfWidth: number, t: number): WallSample {
  // Prefer the wall whose outside faces up, so "outside" reads above the
  // membrane the way every textbook draws it.
  const upper = wallSample(centre, halfWidth, 1, t)
  return upper.inward.y > 0 ? upper : wallSample(centre, halfWidth, -1, t)
}

const DENDRITE_MEMBRANE = membraneFrame(
  DENDRITE_TRUNKS[1].path,
  DENDRITE_TRUNKS[1].segs[0].w / 2,
  0.3,
)
/** Where along the axon the membrane patch is cut, 0→1.
 *
 *  Exported because the whole-cell miniature needs it: the ring marking "the
 *  camera is here" has to sit at the same point along the axon that the camera is
 *  actually looking at, and a second 0.55 typed into the panel would be a second
 *  place for it to drift. */
export const AXON_MEMBRANE_T = 0.55
const AXON_MEMBRANE = membraneFrame(AXON_POLYLINE, AXON_W / 2, AXON_MEMBRANE_T)

/** Most tilt a membrane patch is allowed to keep on screen, radians.
 *
 *  A patch inherits the angle of the wall it sits on — 1.3° on the axon, 132° on
 *  a dendrite trunk — and that difference is worth keeping: arriving at a patch
 *  that is plainly slanted says you have come to a particular place on a
 *  particular branch, not to a diagram. But it cannot be kept in full. At 132° the
 *  ion crowd's rectangle no longer matches the screen and the corners empty out,
 *  and a "+" charge mark reads as a multiplication sign. A plus is unmistakably a
 *  plus up to about this much and ambiguous past 30°, so this is the constraint
 *  that sets the cap.
 *
 *  The crowd's extent is derived from the same number (see stage/ions.ts), so the
 *  two cannot drift apart. */
export const MAX_PATCH_TILT = (20 * Math.PI) / 180

/** A membrane is a line, so 132° and −48° are the same slope. Brings a slope into
 *  (−90°, 90°]. */
function wrapSlope(a: number): number {
  let t = a
  while (t > Math.PI / 2) t -= Math.PI
  while (t <= -Math.PI / 2) t += Math.PI
  return t
}

/** How far the camera turns on arriving at this patch, radians: enough to bring
 *  the membrane's tilt within MAX_PATCH_TILT, and no further. The tilt that is
 *  left keeps its direction, so two patches still look different from each other.
 *
 *  This has to mirror what the renderer does on entering a patch, INCLUDING its Y
 *  flip: a flipped frame needs the extra half-turn, or the cytoplasm ends up above
 *  the membrane instead of below it. */
export function patchTurnAngle(frame: WallSample): number {
  const theta = Math.atan2(frame.tangent.y, frame.tangent.x)
  const localY = { x: -frame.tangent.y, y: frame.tangent.x }
  const flipped = frame.inward.x * localY.x + frame.inward.y * localY.y < 0
  // The slope it would have with no turn at all.
  const natural = wrapSlope(flipped ? theta - Math.PI : theta)
  const kept = Math.max(-MAX_PATCH_TILT, Math.min(MAX_PATCH_TILT, natural))
  return kept + (flipped ? Math.PI : 0) - theta
}

export const ZOOM_TARGETS: ZoomTarget[] = [
  {
    id: 'incoming-synapse',
    label: 'Incoming synapse',
    center: mid(INPUTS[1].bouton, INPUTS[1].site),
    scale: 7,
    promise:
      'The gap where an input neuron talks to this one. Vesicles, chemical messengers and the receptors that catch them get built here.',
    roadmap: 'Synapse & neurotransmitter milestones',
  },
  {
    id: 'dendrite-membrane',
    label: 'Dendrite membrane',
    center: DENDRITE_MEMBRANE.at,
    scale: MEMBRANE_ZOOM,
    promise:
      'A patch of dendrite membrane. Receptor channels open here when messengers land, which is what starts a ripple.',
    roadmap: 'Ion-channel milestone',
    content: [
      ...MEMBRANE_FACTS,
      ...ION_FACTS,
      ...PUMP_FACTS,
      ...LEAK_FACTS,
      ...CHANNEL_OVERVIEW,
      ...CHANNELS['voltage-na'].facts,
      ...CHANNELS['voltage-k'].facts,
      ...CHANNELS.ligand.facts,
      ...VOLTAGE_FACTS,
    ],
    frame: DENDRITE_MEMBRANE,
  },
  {
    id: 'hillock',
    label: 'Axon hillock',
    center: HILLOCK,
    scale: 6,
    promise:
      'Where the added-up ripples are tested and an action potential is born. The threshold rule and the voltage trace live here.',
    roadmap: 'Action-potential milestone',
  },
  {
    id: 'axon-membrane',
    label: 'Axon membrane',
    center: AXON_MEMBRANE.at,
    scale: MEMBRANE_ZOOM,
    promise:
      'A patch of axon membrane: the oily bilayer, the sodium and potassium on either side, the pump and the channels. This is where the resting potential comes from.',
    roadmap: 'Membrane & ions milestones',
    content: [
      ...MEMBRANE_FACTS,
      ...ION_FACTS,
      ...PUMP_FACTS,
      ...LEAK_FACTS,
      ...CHANNEL_OVERVIEW,
      ...CHANNELS['voltage-na'].facts,
      ...CHANNELS['voltage-k'].facts,
      ...CHANNELS.ligand.facts,
      ...VOLTAGE_FACTS,
    ],
    frame: AXON_MEMBRANE,
  },
  {
    id: 'axon-signal',
    label: 'Along the axon',
    center: axonPoint(AXON_SIGNAL_T),
    scale: AXON_VIEW_SCALE,
    turn: AXON_SIGNAL_TURN,
    presents: 'axon',
    promise:
      'Follow one signal down the cable and watch how it gets to the far end — which is not by travelling. Every patch of membrane along the way wakes up the next one.',
    roadmap: 'Action-potential milestone',
  },
  {
    id: 'axon-passive',
    label: 'Passive spread',
    center: axonPoint(AXON_PASSIVE_T),
    scale: AXON_VIEW_SCALE,
    turn: AXON_PASSIVE_TURN,
    presents: 'axon',
    promise:
      'What a voltage does with nothing rebuilding it: two stretches of the same cable, one bare and one wrapped, and the same push sent down both.',
    roadmap: 'Cable-theory milestone',
  },
  {
    id: 'outgoing-synapse',
    // ⚠ A VIEW OF ITS OWN AGAIN (2026-08-31, milestone 4 step 20). The note
    // below was written when the molecular view was removed for redesign; the
    // redesign is here, built on the user's own bouton drawing, and the quarter
    // turn it asks for is honoured — this synapse lies along the x axis in the
    // scene, so its real cleft is vertical, and the camera performs the
    // rotation on the way in rather than the drawing pretending otherwise.
    presents: 'synapse',
    label: 'Outgoing synapse',
    center: mid(OUTGOING.bouton, OUTGOING.tip),
    scale: SYNAPSE_VIEW_SCALE,
    // ⚠ THE QUARTER TURN, and the note that earned it. This synapse lies along
    // the x axis in the scene, so its real cleft is VERTICAL — and the view
    // draws a cleft the textbook way, across the middle with the target below.
    // The camera performs the rotation itself on the way in, so the drawing
    // never has to pretend the anatomy is something it is not.
    //
    // ⚠ THE SIGN (user, 2026-09-01: "the zoom-in view does not correspond to
    // the perspective it lands on"). Konva's positive rotation is clockwise on
    // a y-down canvas, so +π/2 sends the scene's bouton→target direction (+x)
    // to DOWN — target below, axon arriving from the top — which is exactly
    // where the landed view puts them. −π/2 landed the world upside down
    // against the view that then faded in.
    turn: Math.PI / 2,
    promise:
      'Where this neuron stops being electrical. An action potential arrives, calcium doors open, and a packet of chemical crosses a gap to the next cell.',
    roadmap: 'Synapse milestone',
  },
  {
    // ⚠ THE SAME PLACE, DEEPER (user, 2026-09-01: "the same demo, but at the
    // scale in the image"). Not a new view: the synapse view itself keeps
    // running and the camera continues into it, four times closer, framed on
    // the active zone. Same run, same balls, same clock — watched closer.
    // The marker is offset a diameter along the dendrite from the synapse's
    // own marker: two doors at one place need two icons.
    id: 'active-zone',
    presents: 'synapse',
    label: 'Active zone',
    center: {
      x: mid(OUTGOING.bouton, OUTGOING.tip).x + 12,
      y: mid(OUTGOING.bouton, OUTGOING.tip).y + 38,
    },
    scale: SYNAPSE_VIEW_SCALE * 4,
    turn: Math.PI / 2,
    promise:
      'The release machinery at working distance: one calcium door, the vesicles it serves, and the receptors across the gap.',
    roadmap: 'Synapse milestone',
  },
]

/** How far the camera has arrived within a RANGE of magnifications — 1 inside
 *  [lo, hi], falling off over ARRIVE_DECADES beyond either end. The synapse
 *  view spans two places (the whole synapse and its active zone); a
 *  single-scale band would blink the view out midway between them. */
export function arrivalSpan(scale: number, lo: number, hi: number): number {
  if (scale <= 0 || lo <= 0 || hi <= 0) return 0
  const out = Math.max(0, Math.max(Math.log10(lo / scale), Math.log10(scale / hi)))
  return clamp01(1 - out / ARRIVE_DECADES)
}

/** Radius of a zoom marker on SCREEN (counter-scaled while zoomed). */
export const MARKER_R = 14

// -------------------------------------------------------------------- timing

/** How long a camera move takes. A hop to ×7 and a plunge to ×2400 cannot
 *  share a duration: the length follows how many powers of ten are crossed, so
 *  every zoom feels like the same rate of travel. */
export function cameraDuration(fromScale: number, toScale: number): number {
  const decades = Math.abs(Math.log10(toScale / fromScale))
  return Math.min(3000, 650 + 700 * decades)
}

// ------------------------------------------------- the whole cell, in miniature

/** Breathing room round the cell in the miniature, in scene units. */
export const MAP_PAD = 14
/** Width-to-height of the miniature. A real compromise: the map panel is
 *  permanent, so every pixel it takes is a pixel the describer below it does not
 *  get. At 2.2 it keeps about five sixths of the dendrite fan — enough that the
 *  shape still reads as a neuron — and costs the column ~136 px. */
export const MAP_ASPECT = 2.2

/** The box the whole-cell miniature is drawn in — scene coordinates.
 *
 *  Measured off the geometry rather than typed in, and it lives here rather than
 *  in the panel because there are now two miniatures: the permanent map at the top
 *  of the column, and the inset on the spike-train bench's graph. Two hand-picked
 *  boxes would be two pictures of the same cell that could drift apart.
 *
 *  Every ZOOM_TARGET centre is inside it by construction. The hand-picked box this
 *  replaces was cropped to the axon's own story and cut the left edge off at the
 *  soma, so the incoming synapse's "you are here" ring would have been drawn
 *  outside the picture. */
export const NEURON_MAP_BOX = (() => {
  const xs = [
    SOMA.x - SOMA_R,
    SOMA.x + SOMA_R,
    ...AXON_POLYLINE.map((p) => p.x),
    ...TERMINALS.map((t) => t.end.x),
    ...DENDRITE_SEGS.flatMap((seg) => [seg.x1, seg.x2]),
    ...ZOOM_TARGETS.map((t) => t.center.x),
  ]
  const ys = [
    SOMA.y - SOMA_R,
    SOMA.y + SOMA_R,
    ...AXON_POLYLINE.map((p) => p.y),
    ...TERMINALS.map((t) => t.end.y),
    ...DENDRITE_SEGS.flatMap((seg) => [seg.y1, seg.y2]),
    ...ZOOM_TARGETS.map((t) => t.center.y),
  ]
  const minX = Math.min(...xs) - MAP_PAD
  const width = Math.max(...xs) + MAP_PAD - minX
  // Cropped to a fixed shape about the cell's own middle, so a miniature keeps one
  // shape whatever is on it — better than a letterboxed drawing floating in a band
  // of empty panel.
  const height = width / MAP_ASPECT
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2
  return { minX, minY: midY - height / 2, width, height }
})()

/** The parts of the cell a miniature can light up. */
export type NeuronRegion = 'dendrites' | 'soma' | 'hillock' | 'axon' | 'terminals'

/** Where to put a glow for each region, in scene coordinates. More than one point
 *  for the parts that are more than one thing. */
export function regionPoints(region: NeuronRegion): Pt[] {
  switch (region) {
    case 'dendrites':
      return SYNAPSE_TRUNKS.map((trunk) => polylinePoint(DENDRITE_TRUNKS[trunk].path, 0.45))
    case 'soma':
      return [SOMA]
    case 'hillock':
      return [HILLOCK]
    case 'axon':
      return [0.25, 0.5, 0.75].map((t) => axonPoint(t))
    case 'terminals':
      return TERMINALS.map((t) => t.end)
  }
}

/** WHICH DENDRITE TRUNKS CARRY A SIGNAL on a given run.
 *
 *  ⚠ The miniature used to light every synapse-bearing trunk whenever anything
 *  fired, so choosing ONE input made all three dendrites flash (user,
 *  2026-08-28). That is the axon rule one structure earlier: a fan lighting as
 *  a unit says every input arrives whenever any input arrives — and it
 *  contradicts the control the child just used, which offered them a choice
 *  and then ignored it.
 *
 *  `null` means there is no run to ask about (a dendrite zoom, say), and then
 *  the whole fan is the honest answer: the view is about a patch of dendrite
 *  membrane, not about which branch was chosen.
 *
 *  The main canvas already read `run.inputs`; this is the one place that did
 *  not, which is exactly why it lives here now — one function, both readers. */
export function litTrunks(firedInputs: readonly number[] | null): number[] {
  if (firedInputs === null) return [...SYNAPSE_TRUNKS]
  return firedInputs
    .map((i) => INPUTS[i]?.trunk)
    .filter((t): t is number => t !== undefined)
}

/** Which part of the cell a zoom target sits on, for lighting a miniature. Null
 *  where the target is not a place a spike happens (the synapses get their own
 *  milestones). */
export function regionOfZoom(id: string | null): NeuronRegion | null {
  if (id === 'dendrite-membrane') return 'dendrites'
  if (id === 'axon-membrane' || id === 'axon-signal' || id === 'axon-passive') return 'axon'
  if (id === 'outgoing-synapse' || id === 'active-zone') return 'terminals'
  if (id === 'hillock') return 'hillock'
  return null
}

/** How near the camera has to be to a view's own magnification before that view is
 *  drawn, in decades of scale.
 *
 *  0.3 decades is a factor of two either side, which is exactly the ramp the axon
 *  view used when it only had to worry about being zoomed INTO. */
export const ARRIVE_DECADES = 0.3

/** How far a view of its own has faded in at this camera scale, 0→1.
 *
 *  Measured in DECADES, and from EITHER side, and both of those were bugs.
 *
 *  The old test was `(scale / viewScale - 0.5) / 0.5`, which is a ramp from half the
 *  view's magnification up to it. Approaching from below — zooming in from the whole
 *  cell — that is right. Approaching from ABOVE it is saturated: flying out from a
 *  membrane patch at ×3100 towards the axon at ×14, it read 1.00 for the entire
 *  journey, so the axon view was painted at full strength while the camera was still
 *  at ×2300. What should have been a zoom out was a cross-fade, and the shrinking
 *  membrane the scene was drawing underneath never got to be seen.
 *
 *  Decades rather than a ratio because that is how the camera actually moves: scale
 *  interpolates geometrically, so a fixed number of decades is a fixed portion of the
 *  flight whichever direction it is going and however far it has to travel. */
export function arrivalAt(scale: number, viewScale: number): number {
  if (scale <= 0 || viewScale <= 0) return 0
  return clamp01(1 - Math.abs(Math.log10(scale / viewScale)) / ARRIVE_DECADES)
}


/** Magnification below which the molecular bilayer has completely dissolved.
 *
 *  It used to be a hard switch at BILAYER_SCALE: lipids above it, a plain line
 *  below, nothing in between. Flying out of a membrane patch, a wall made of
 *  molecules therefore vanished in one frame and was replaced by a stroke — which
 *  is what "appears and disappears out of thin air" describes. Magnification does
 *  not work like that; things get smaller until you cannot see them. */
export const BILAYER_FADE_TO = 200

/** How much of the molecular bilayer to show at this magnification, 0→1. */
export function bilayerBlend(scale: number): number {
  if (scale >= BILAYER_SCALE) return 1
  if (scale <= BILAYER_FADE_TO) return 0
  const t = (scale - BILAYER_FADE_TO) / (BILAYER_SCALE - BILAYER_FADE_TO)
  // Smoothstep, so it neither starts nor ends abruptly.
  return t * t * (3 - 2 * t)
}

