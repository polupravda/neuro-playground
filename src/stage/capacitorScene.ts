import { HALF_MEM, drawLipids, PX_PER_NM } from './bilayer'
import { PX_PER_UM } from './layout'
import { drawGlossyIon, drawIonCharge, badgeMinR, chargeWash, polarityT } from './particleStyle'
import { IONS } from '../core/ions'
import { spoken, drawSpoken, type SpokenLabel } from './spokenLabels'
import { chargesFor, potassiumInside, fmtBig, REST_MV } from '../core/capacitor'

// D12 — the charge skin, and the crowd it is borrowed from.
//
// Two things on one canvas, and the gap between them IS the exhibit: the
// cell's potassium crowd drawn in bulk (hundreds of ions, unchanging), and
// the charge skin on the two faces drawn mark by mark (a sliver, following
// the dial). Everything the marks claim is derived in core/capacitor.ts.

const VIEW_W = typeof window !== 'undefined' ? Math.min(window.innerWidth, 1376) : 1280
const VIEW_H = typeof window !== 'undefined' ? window.innerHeight : 860
const CONTENT_W = Math.max(700, VIEW_W - 40 - 256 - 24 - 12)
const CONTENT_H = Math.max(540, VIEW_H - 40 - 64)
const PANEL_PAD = 20

export const CAP_SCALE = 2
/** The patch takes the whole column: the abstract counter panel that used to
 *  sit beside it was removed in 28b (a kid could not read it), which gives
 *  the picture the width and removes the sideways-scroll risk entirely. */
export const CAP_W = Math.round((CONTENT_W - PANEL_PAD) / CAP_SCALE)
export const CAP_H = Math.round((CONTENT_H - PANEL_PAD) / CAP_SCALE)
/** The wall runs across the middle: outside above, cytoplasm below. */
export const CAP_WALL_Y = Math.round(CAP_H * 0.42)

/** Same bilayer, same drawn magnification as every other bench. */
export const CAP_MAG = Math.round((CAP_SCALE * PX_PER_NM) / (PX_PER_UM / 1000))

/** Voltage range of the dial, mV. */
export const CAP_MIN_MV = -95
export const CAP_MAX_MV = 60

/** Marks per face at the largest voltage the dial allows. The number of marks
 *  is what follows the voltage; each stands for a crowd (declared). */
export const MAX_MARKS = 26

export function marksFor(mv: number): number {
  const full = Math.max(Math.abs(CAP_MIN_MV), Math.abs(CAP_MAX_MV))
  return Math.round((Math.abs(mv) / full) * MAX_MARKS)
}

/** How many real charges one drawn mark stands for at this voltage. */
export function chargesPerMark(mv: number): number {
  const m = marksFor(mv)
  return m === 0 ? 0 : chargesFor(mv) / m
}

// ── The bulk crowd ──────────────────────────────────────────────────────────

/** The cytoplasm's potassium: a fixed crowd whose COUNT never changes with
 *  the voltage — but which leans toward or away from the wall as the field
 *  across it changes, because a field moves charges. */
export const BULK_IONS = 340
/** Body radius of a drawn potassium ion. Big enough to wear a charge ring. */
export const ION_R = 3.4

function hash01(i: number, k: number): number {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export interface BulkIon {
  x: number
  y: number
}

const BULK_TOP = CAP_WALL_Y + HALF_MEM + 6
const BULK_BOTTOM = CAP_H - 10

/** How hard the crowd leans, −1→+1 across the dial. Potassium is a CATION: a
 *  negative interior pushes it back from the inner face (which is what leaves
 *  the negative skin behind), a positive interior pulls it against the face. */
export function leanOf(mv: number): number {
  const full = Math.max(Math.abs(CAP_MIN_MV), Math.abs(CAP_MAX_MV))
  return Math.max(-1, Math.min(1, mv / full))
}

/** Warp a depth fraction (0 at the wall, 1 at the far edge) toward or away
 *  from the wall. Monotone and endpoint-preserving: no ion overtakes another,
 *  none leaves the cytoplasm, and none can enter the wall.
 *
 *  The exponent's sign is physics and was wrong once: `exp(−0.9·lean)` made a
 *  NEGATIVE interior gather cations AGAINST the inner face, which is the
 *  opposite of what a negative face does to a positive ion. A test that
 *  counts ions near the wall caught it. */
function warp(t: number, lean: number): number {
  return Math.pow(t, Math.exp(0.9 * lean))
}

/** Jittered grid, sized by the tank and never by the count, so nothing
 *  reshuffles when anything else changes — but the crowd DOES lean with the
 *  voltage. The lean is exaggerated, and the honesty note says so: the true
 *  shift is one ion in tens of thousands, which no picture can show. */
export function bulkAt(ms: number, mv: number): BulkIon[] {
  const cols = 30
  const rows = Math.ceil(BULK_IONS / cols)
  const cw = (CAP_W - 20) / cols
  const span = BULK_BOTTOM - BULK_TOP
  const lean = leanOf(mv)
  const out: BulkIon[] = []
  for (let i = 0; i < BULK_IONS; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const jx = 1.6 * Math.sin(ms * 0.0013 + i * 2.399)
    const jy = 1.6 * Math.sin(ms * 0.0011 + i * 1.731)
    const t = (row + 0.2 + 0.6 * hash01(i, 2)) / rows
    out.push({
      x: 10 + (col + 0.2 + 0.6 * hash01(i, 1)) * cw + jx,
      y: BULK_TOP + warp(t, lean) * span + jy,
    })
  }
  return out
}

// ── Drawing ─────────────────────────────────────────────────────────────────

const LABEL = '#cbd5e1'
const OUTSIDE_TINT = 'rgba(100, 116, 139, 0.05)'
const INSIDE_TINT = 'rgba(100, 116, 139, 0.13)'
const POSITIVE = '#ef4444'
const NEGATIVE = '#38bdf8'

/** The skin's marks, evenly spread along a face. */
export function markXs(mv: number): number[] {
  const n = marksFor(mv)
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(((i + 0.5) / n) * CAP_W)
  return out
}

/** Which faces get drawn marks: −1 is the outside face, +1 the inside one.
 *  The inside face is only marked while it is NEGATIVE — when it is positive
 *  the potassium crowd pressed against the wall already IS that charge, drawn
 *  in the round, and a second abstract copy underneath the ions read as a plus
 *  attracting a plus (2026-08-28). Symbolise only what is not already shown. */
export function skinFaces(mv: number): readonly (-1 | 1)[] {
  return mv < 0 ? [-1, 1] : [-1]
}

/** The two faces are named ON the picture, beside the marks that live on
 *  them — "face" was a word the exhibit used and never showed (28b). */
export const OUTER_FACE_Y = (CAP_WALL_Y - HALF_MEM - 16) * CAP_SCALE
export const INNER_FACE_Y = (CAP_WALL_Y + HALF_MEM + 26) * CAP_SCALE

export function capacitorLabels(): SpokenLabel[] {
  return [
    spoken('outside face', 30, OUTER_FACE_Y),
    spoken('inside face', 30, INNER_FACE_Y),
    spoken('potassium', 30, (CAP_H - 12) * CAP_SCALE),
  ]
}

export function drawCapacitor(ctx: CanvasRenderingContext2D, mv: number, ms: number): void {
  ctx.save()
  ctx.scale(CAP_SCALE, CAP_SCALE)

  // Two compartments, told apart by lightness only — hue is spoken for.
  ctx.fillStyle = OUTSIDE_TINT
  ctx.fillRect(0, 0, CAP_W, CAP_WALL_Y)
  ctx.fillStyle = INSIDE_TINT
  ctx.fillRect(0, CAP_WALL_Y, CAP_W, CAP_H - CAP_WALL_Y)

  // The charge the dial is imposing, as a wash over the CYTOPLASM — the same
  // device the equilibrium bench uses, and the same shared ramp, because a
  // voltage is the inside measured against the outside. Strongest against the
  // membrane and fading away from it: the charge a voltage IS sits in a thin
  // skin there, not through the whole cell.
  const t = polarityT(mv)
  if (Math.abs(t) > 0.01) {
    // Starts BELOW the wall's own thickness, never under it, and fades in
    // from nothing at that edge (`chargeWash`): a tint that reaches into the
    // membrane makes the wall look charged rather than the water beside it.
    const from = CAP_WALL_Y + HALF_MEM
    ctx.fillStyle = chargeWash(ctx, from, CAP_H, t)
    ctx.fillRect(0, from, CAP_W, CAP_H - from)
  }

  // The crowd: hundreds of potassium ions in the cytoplasm, jostling, never
  // leaving, and leaning with the field. This is the denominator of the lesson.
  //
  // Each wears its CHARGE as a red ring, because the whole explanation of the
  // lean depends on the child knowing these balls are positive — and a violet
  // ball says nothing about charge.
  for (const ion of bulkAt(ms, mv)) {
    drawGlossyIon(ctx, 'k', ion.x, ion.y, ION_R)
    drawIonCharge(ctx, ion.x, ion.y, ION_R, IONS.k.charge, undefined, badgeMinR(CAP_SCALE))
  }

  // The wall.
  drawLipids(ctx, { midY: CAP_WALL_Y, from: 0, to: CAP_W })

  // The skin: marks hugging the faces, minus inside when the voltage is
  // negative, flipping together when it crosses zero.
  //
  // The inside face is drawn with marks ONLY WHILE IT IS NEGATIVE (2026-08-28).
  // A negative inner face is made of charge this picture never draws — an
  // excess of anions, a shortfall of cations — so it needs a symbol or it is
  // invisible. A POSITIVE inner face does not: it is the potassium crowd
  // pressed against the wall, already on screen, in the round. Drawing plus
  // marks there as well put a second, abstract copy of the same charge
  // underneath the ions, and a child reading the collision saw a plus being
  // pulled onto a plus. Symbolise only the charge you are not already showing.
  const insideNegative = mv < 0
  const faces = skinFaces(mv)
  const offset = HALF_MEM + 6
  const arm = 3
  ctx.lineCap = 'round'
  ctx.lineWidth = 2
  for (const x of markXs(mv)) {
    for (const side of faces) {
      const negative = side === 1 ? insideNegative : !insideNegative
      ctx.strokeStyle = negative ? NEGATIVE : POSITIVE
      const y = CAP_WALL_Y + side * offset
      ctx.beginPath()
      ctx.moveTo(x - arm, y)
      ctx.lineTo(x + arm, y)
      if (!negative) {
        ctx.moveTo(x, y - arm)
        ctx.lineTo(x, y + arm)
      }
      ctx.stroke()
    }
  }
  ctx.restore()

  // Screen-space chrome: the compartments named, the two faces named beside
  // their own marks, and each population's count as a reading next to the
  // thing it counts — so "what is held, and against what" is answered where
  // the child is looking rather than in an abstract panel elsewhere (28b).
  ctx.fillStyle = LABEL
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`×${CAP_MAG.toLocaleString('en-US')}`, CAP_W * CAP_SCALE - 8, 16)
  ctx.textAlign = 'left'
  ctx.fillText('outside the cell', 12, 18)
  ctx.fillText('inside the cell — cytoplasm', 12, 40)

  const q = chargesFor(mv)
  ctx.textAlign = 'right'
  ctx.fillStyle = q > 0 ? (mv < 0 ? NEGATIVE : POSITIVE) : '#64748b'
  ctx.fillText(
    q > 0 ? `${fmtBig(q)} charges stuck here` : 'nothing stuck here',
    CAP_W * CAP_SCALE - 12,
    OUTER_FACE_Y,
  )
  ctx.fillStyle = 'rgba(167, 139, 250, 0.95)'
  ctx.fillText(
    `${fmtBig(potassiumInside())} potassium ions in here`,
    CAP_W * CAP_SCALE - 12,
    (CAP_H - 12) * CAP_SCALE,
  )
  for (const l of capacitorLabels()) drawSpoken(ctx, l)
}

export const CAPACITOR_TERMS = ['charge', 'potassium', 'membrane'] as const

/** Where the meter's needle sits, 0→1 across the dial's range. */
export function meterT(mv: number): number {
  return (mv - CAP_MIN_MV) / (CAP_MAX_MV - CAP_MIN_MV)
}

export { REST_MV }
