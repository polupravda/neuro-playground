import { boutonPath } from './boutonShape'
import { drawGlossyIon } from './particleStyle'
import { drawSpoken, spoken, type SpokenLabel } from './spokenLabels'
import {
  CLEFT_PX,
  CYTOPLASM,
  OUTSIDE,
  SYN_H,
  SYN_W,
  TRANSMITTER_INK,
  astroRest,
  astrocyteFinger,
  drawAstroFinger,
  membraneBand,
  spinePath,
  synapseGeometry,
  transmitterDot,
  wallAt,
  type SynapseGeometry,
} from './synapseScene'
import {
  ASTRO_DOORS,
  DOTS,
  EAAT_FARE,
  dotAt,
  reuptakeStageAt,
  through,
  uAtThrough,
  type Dot,
  type Species,
} from '../core/reuptake'

// D17 — WHERE THE TRANSMITTER GOES.
//
// ⚠ REBUILT FROM SCRATCH (user, 2026-09-04: "the new visualisation is not
// kids-friendly, is torn out of context. Make clear: where is astrocyte?
// where is neuron? Reuse the visuals kid already knows").
//
// The first version invented its own composition — two horizontal walls and a
// vertical one — and it was a diagram of a PROCESS rather than a picture of a
// PLACE. A child arriving from the synapse view had to work out what they were
// looking at before they could learn anything, and the answer to "where is the
// astrocyte" was "the grey-green band down the right-hand side", which is no
// answer at all.
//
// So this drawer now opens on exactly the picture they just left: the same
// `synapseGeometry`, the same bouton, the same cleft, the same spine, and the
// SAME two green glial fingers, drawn by the synapse view's own
// `drawAstroFinger` — asked for, never copied (03 → *One biology, one
// drawing*). What is new is only what this exhibit is about: the doors ON
// those fingers, and the journey the transmitter makes through them.
//
// The answers then live in the picture instead of in a caption. Where is the
// astrocyte? The green thing at both mouths of the gap — the one the synapse
// view already named. Where is the neuron? The two grey cells above and below
// it, which the child has been inside since the first milestone.

export const RU_W = SYN_W
export const RU_H = SYN_H

const INK = 'rgba(148, 163, 184, 0.85)'
const GLIA = '134, 184, 158'
/** ⚠ GLUTAMINE'S INK, chosen by the user from three candidates and reconciled
 *  in 05: orange, the one hue the cast had left. Kept plainly orange, drawn at
 *  transmitter size, and never placed against a charge mark. */
export const GLUTAMINE_INK = { light: '#fed7aa', mid: '#fb923c', dark: '#9a3412' }
const ENZYME = 'rgba(196, 181, 253, 0.55)'
const TRANSMITTER_R = 3.2

export interface ReuptakeGeometry {
  syn: SynapseGeometry
  width: number
  height: number
  /** The two mouths of the gap, each with the finger that drains it. */
  fingers: { side: 1 | -1; tip: { x: number; y: number } }[]
  /** Inside the astrocyte, where its enzyme works — within the finger the
   *  child can see, so the conversion happens somewhere they can point at. */
  synthetase: { x: number; y: number }
  /** Inside the terminal, above its own wall. */
  glutaminase: { x: number; y: number }
  /** Where the terminal keeps what comes home. */
  stock: { x: number; y: number }
  r: number
}

export function reuptakeGeometry(width = RU_W, height = RU_H): ReuptakeGeometry {
  const syn = synapseGeometry(width, height)
  const right = astrocyteFinger(syn, 1)
  const left = astrocyteFinger(syn, -1)
  // The enzyme sits INSIDE the right-hand finger, on its own centreline, far
  // enough along that a molecule visibly travels into the cell before it
  // changes — a conversion at the doorway would read as the door doing it.
  const synthetase = {
    x: right.tip.x + (right.base.x - right.tip.x) * 0.42,
    y: right.tip.y + (right.base.y - right.tip.y) * 0.42,
  }
  const wallY = wallAt(syn, syn.foot.x)
  return {
    syn,
    width,
    height,
    fingers: [
      { side: 1, tip: right.tip },
      { side: -1, tip: left.tip },
    ],
    synthetase,
    glutaminase: { x: syn.foot.x - syn.activeHalf * 0.5, y: wallY - 104 },
    stock: { x: syn.foot.x + syn.activeHalf * 0.55, y: wallY - 156 },
    r: TRANSMITTER_R,
  }
}

// ------------------------------------------------------------- where a dot is

/** Which mouth this molecule leaves by. The astrocyte reaches in at BOTH
 *  flanks, so the crowd splits either way instead of all filing to one side. */
function fingerSideOf(dot: Dot): 1 | -1 {
  return dot.id % 2 === 0 ? 1 : -1
}

/** Where the transporters sit: ON the finger's tip, at the mouth it drains —
 *  the same place the synapse view already puts its transporter ticks. */
export function doorAt(
  g: ReuptakeGeometry,
  side: 1 | -1,
  i: number,
): { x: number; y: number } {
  const f = astrocyteFinger(g.syn, side)
  const spread = (i - (ASTRO_DOORS - 1) / 2) * 20
  return { x: f.tip.x - side * f.rTip * 0.5, y: f.tip.y + spread }
}

/** The terminal's own door — the minority route, on the bouton's own wall. */
export function neuronDoor(g: ReuptakeGeometry): { x: number; y: number } {
  const x = g.syn.foot.x - g.syn.activeHalf * 0.85
  return { x, y: wallAt(g.syn, x) }
}

/** ⚠ ONE MOLECULE'S JOURNEY, as places in the picture the child can already
 *  name. The model says how far along it is; this says what that means here. */
export function dotWaypoints(g: ReuptakeGeometry, dot: Dot): { x: number; y: number }[] {
  const cleftY = wallAt(g.syn, g.syn.foot.x) + CLEFT_PX * 0.5
  const start = {
    x: g.syn.foot.x + (dot.lane - 0.5) * g.syn.activeHalf * 1.7,
    y: cleftY,
  }
  if (dot.route === 'neuron') {
    // Straight back into the terminal it came from, through its own door and
    // into the store. It never changes kind: it is already the right molecule.
    const door = neuronDoor(g)
    return [start, door, { x: door.x, y: door.y - 52 }, g.stock]
  }
  const side = fingerSideOf(dot)
  const door = doorAt(g, side, dot.door)
  const inside = astroRest(astrocyteFinger(g.syn, side), dot.phase, dot.lane)
  return [
    start,
    door,
    inside,
    g.synthetase,
    // Out of the astrocyte and up past the terminal's wall…
    { x: door.x, y: door.y - CLEFT_PX * 1.4 },
    // …in through the terminal's own door, to its enzyme, then the store.
    neuronDoor(g),
    g.glutaminase,
    g.stock,
  ]
}

/** Where this dot is now — a pure function of the model's progress. */
export function dotPoint(
  g: ReuptakeGeometry,
  dot: Dot,
  u: number,
): { x: number; y: number; species: Species } {
  const pts = dotWaypoints(g, dot)
  const st = dotAt(dot, u)
  const legs = pts.length - 1
  const walked = st.progress * legs
  const i = Math.min(legs - 1, Math.floor(walked))
  const f = walked - i
  return {
    x: pts[i].x + (pts[i + 1].x - pts[i].x) * f,
    y: pts[i].y + (pts[i + 1].y - pts[i].y) * f,
    species: st.species,
  }
}

// --------------------------------------------------------------------- names

/** ⚠ THE NAMES THAT ANSWER "WHERE AM I". The first three are the whole point
 *  of the rebuild: the child is told which green thing is the astrocyte and
 *  which grey things are the neurons, IN the picture, before anything moves. */
export function reuptakeCallouts(
  g: ReuptakeGeometry,
  u: number,
): { label: SpokenLabel; to: { x: number; y: number } }[] {
  const out: { label: SpokenLabel; to: { x: number; y: number } }[] = []
  const right = astrocyteFinger(g.syn, 1)
  const wallY = wallAt(g.syn, g.syn.foot.x)

  out.push({
    label: spoken('astrocyte', right.tip.x + 104, right.tip.y + 84),
    to: { x: right.tip.x + 34, y: right.tip.y + 40 },
  })
  out.push({
    label: spoken(
      'axon terminal',
      g.syn.foot.x - g.syn.activeHalf - 60,
      wallY - 132,
      'right',
    ),
    to: { x: g.syn.foot.x - g.syn.activeHalf * 0.7, y: wallY - 54 },
  })
  out.push({
    label: spoken(
      'dendritic spine',
      g.syn.foot.x + g.syn.head.rx + 40,
      g.syn.shaftTop + 42,
    ),
    to: { x: g.syn.foot.x + g.syn.head.rx * 0.5, y: g.syn.shaftTop + 10 },
  })
  out.push({
    label: spoken('transporter', doorAt(g, 1, 0).x + 78, doorAt(g, 1, 0).y - 34),
    to: doorAt(g, 1, 0),
  })

  const stage = reuptakeStageAt(u).stage.id
  if (stage === 'released' || stage === 'caught') {
    out.push({
      label: spoken(
        'transmitter',
        g.syn.foot.x - g.syn.activeHalf * 1.6,
        wallY + CLEFT_PX * 0.5 + 40,
        'right',
      ),
      to: { x: g.syn.foot.x - g.syn.activeHalf * 0.8, y: wallY + CLEFT_PX * 0.5 },
    })
  }
  if (stage === 'converted' || stage === 'shipped') {
    out.push({
      label: spoken('glutamine', g.synthetase.x + 96, g.synthetase.y + 10),
      to: g.synthetase,
    })
  }
  if (stage === 'restored' || stage === 'stocked') {
    out.push({
      label: spoken('back in store', g.stock.x + 80, g.stock.y - 10),
      to: g.stock,
    })
  }
  return out
}

export function reuptakeLabels(g: ReuptakeGeometry, u: number): SpokenLabel[] {
  return reuptakeCallouts(g, u).map((c) => c.label)
}

/** ⚠ THE ONE MOMENT THE FARE IS DRAWN (user's alignment answer): a single
 *  capture is held and fully costed; every other catch is just the molecule
 *  going through. */
export const FARE_AT = uAtThrough('caught', 0.62)

export function fareAt(u: number): number {
  return Math.max(0, 1 - Math.abs(u - FARE_AT) / 0.06)
}

// -------------------------------------------------------------------- drawing

/** A transporter, in the door grammar the app already uses: a barrel with a
 *  bore through it, so a molecule PASSES rather than arrives. */
function barrel(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  along: { x: number; y: number },
  half: number,
  tint: string,
): void {
  const perp = { x: -along.y, y: along.x }
  ctx.save()
  ctx.strokeStyle = tint
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(
      at.x + perp.x * half * side - along.x * half,
      at.y + perp.y * half * side - along.y * half,
    )
    ctx.lineTo(
      at.x + perp.x * half * side + along.x * half,
      at.y + perp.y * half * side + along.y * half,
    )
    ctx.stroke()
  }
  ctx.restore()
}

function speciesDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  species: Species,
): void {
  if (species === 'glutamate') {
    transmitterDot(ctx, x, y, r)
    return
  }
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r)
  grad.addColorStop(0, GLUTAMINE_INK.light)
  grad.addColorStop(0.55, GLUTAMINE_INK.mid)
  grad.addColorStop(1, GLUTAMINE_INK.dark)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

export interface ReuptakeView {
  width: number
  height: number
  u: number
  labelsOn?: boolean
}

export function drawReuptake(ctx: CanvasRenderingContext2D, v: ReuptakeView): void {
  const g = reuptakeGeometry(v.width, v.height)
  const syn = g.syn

  ctx.fillStyle = OUTSIDE
  ctx.fillRect(0, 0, v.width, v.height)

  // ── THE SAME PICTURE THEY ARRIVED FROM, asked for rather than redrawn, and
  // stacked in the same order the synapse view stacks it: the fingers behind
  // both neurons, the postsynaptic side under the terminal.
  drawAstroFinger(ctx, syn, 1)
  drawAstroFinger(ctx, syn, -1)

  ctx.fillStyle = CYTOPLASM
  spinePath(ctx, syn, v.width, true, v.height)
  ctx.fill()
  membraneBand(ctx, () => spinePath(ctx, syn, v.width, false, v.height))

  ctx.fillStyle = CYTOPLASM
  boutonPath(ctx, syn.fit)
  ctx.fill()
  membraneBand(
    ctx,
    () => boutonPath(ctx, syn.fit),
    [],
    (x) => wallAt(syn, x),
  )

  // ── what THIS exhibit adds: the doors, on the fingers the child can see.
  for (const f of g.fingers) {
    for (let i = 0; i < ASTRO_DOORS; i++) {
      barrel(ctx, doorAt(g, f.side, i), { x: 1, y: 0 }, 10, `rgba(${GLIA}, 0.95)`)
    }
  }
  barrel(ctx, neuronDoor(g), { x: 1, y: 0 }, 10, INK)

  // The two enzymes, each inside its own cell.
  for (const at of [g.synthetase, g.glutaminase]) {
    ctx.save()
    ctx.fillStyle = ENZYME
    ctx.beginPath()
    ctx.ellipse(at.x, at.y, 20, 14, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Where what comes home is kept.
  ctx.save()
  ctx.strokeStyle = 'rgba(45, 212, 191, 0.45)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.ellipse(g.stock.x, g.stock.y, 38, 24, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // ── the fare, once, at its own moment
  const fare = fareAt(v.u)
  if (fare > 0.01) {
    const at = doorAt(g, 1, 1)
    ctx.save()
    ctx.globalAlpha *= fare
    for (let i = 0; i < EAAT_FARE.naIn; i++) {
      drawGlossyIon(ctx, 'na', at.x - 38 - i * 11, at.y - 16, 4)
    }
    drawGlossyIon(ctx, 'h', at.x - 38, at.y + 12, 3.4)
    drawGlossyIon(ctx, 'k', at.x + 26, at.y + 20, 4)
    ctx.restore()
  }

  // ── the molecules, each one continuous from first frame to last
  for (const dot of DOTS) {
    const p = dotPoint(g, dot, v.u)
    speciesDot(ctx, p.x, p.y, g.r, p.species)
  }

  if (v.labelsOn !== false) {
    for (const co of reuptakeCallouts(g, v.u)) {
      ctx.strokeStyle = INK
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(co.label.x + co.label.w / 2, co.label.y + co.label.h / 2)
      ctx.lineTo(co.to.x, co.to.y)
      ctx.stroke()
      drawSpoken(ctx, co.label)
    }
  }
}

/** How long the cycle takes on screen. Declared: real uptake is milliseconds
 *  and the glutamine round trip is seconds to minutes, so no single number is
 *  honest about both — this is choreography. */
export const REUPTAKE_SCREEN_MS = 26000

export { TRANSMITTER_INK, through }
