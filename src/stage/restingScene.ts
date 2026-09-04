import { drawResetChip, resetChipBox, resetChipHit } from './resetChip'
import {
  MAX_DOORS,
  type DoorKind,
  VOTERS,
  alongTug,
  contentAt,
  stateOf,

  type Doors,
} from '../core/resting'
import { REST_MV } from '../core/capacitor'
import { IONS } from '../core/ions'
import { HALF_MEM, drawLipids } from './bilayer'
import { drawLeakChannel, leakHalfWidth } from './leakChannel'
import {
  GLOSSY_COLORS,
  badgeMinR,
  chargeWash,
  drawGlossyIon,
  drawIonCharge,
  polarityT,
} from './particleStyle'
import { spoken, drawSpoken, speakerGlyph, type SpokenLabel } from './spokenLabels'

// D16's face — the resting potential as a VOTE, with the doors as the votes,
// and the child building the wall that casts them.

const VIEW_W = typeof window !== 'undefined' ? window.innerWidth : 1440
const VIEW_H = typeof window !== 'undefined' ? window.innerHeight : 860
const DRAWER_W = Math.min(VIEW_W, 1376)

export const RS_W = Math.max(560, DRAWER_W - 40 - 256 - 24 - 32)
// ⚠ ALL THE WAY DOWN (user, 2026-08-30: "stretch the canvas to the bottom of
// the page"). The drawer's own padding is 48, the grid adds 8, and the frame
// round the canvas costs 6 — nothing else is under it any more, so everything
// left belongs to the picture.
export const RS_H = Math.max(470, VIEW_H - 48 - 8 - 6)

const SCALE_Y = 116
const SCALE_X0 = 96
const SCALE_X1 = RS_W - 96
// ⚠ THE PERMEABILITY BENCH'S OWN TRAY, TO THE PIXEL (user, 2026-08-30:
// "align buckets appearance with those seen in the 'membrane permeability'
// demo. Currently shape, height, outline, margin are wrong"). 112 × 26 with a
// 6 px radius, a slate box and a lighter rim — the atom builder's proportions,
// which both benches now inherit rather than each guessing at.
export const TRAY_W = 112
export const TRAY_H = 26
/** Fully rounded ends: the reference's radius exceeds half its height, and
 *  canvas clamps a radius to that — so the box is a pill. */
export const TRAY_R = TRAY_H / 2
/** Four screen pixels, because the reference strokes 1 unit inside a ×4
 *  context. */
export const TRAY_LINE = 4
export const TRAY_FILL = '#1e293b'
export const TRAY_EDGE = '#334155'
export const TRAY_Y = RS_H - 76

/** Midway between the scale it answers and the trays it is built from — the
 *  share bar used to sit in between and take a third of that space. */
const WALL_Y = (SCALE_Y + 56 + (TRAY_Y - TRAY_H)) / 2
const SCALE = 2.0
const FAINT = 'rgba(148, 163, 184, 0.4)'
const INK = 'rgba(148, 163, 184, 0.85)'

// ⚠ TRAYS IN THE PERMEABILITY BENCH'S OWN GRAMMAR (user, 2026-08-30:
// "channels should be drafted from platforms which you can find on membrane
// permeability demo"). A flat rounded box with the thing it holds drawn ON it
// rather than perched above its rim — a sample balanced on an edge reads as a
// separate object that happens to be nearby, and the tray is meant to be
// holding it. One tray per kind of door, the name spoken from underneath.
export const TRAY_KINDS: DoorKind[] = ['k', 'cl', 'na']
// ⚠ AND ITS SPACING: evenly across the width, each tray centred in its own
// slot, exactly as `containers()` lays the permeability bench's out. A fixed
// gap round a centred cluster was the "margin" that read as wrong — the
// reference spreads them, and spreading them is also symmetric.
export const TRAY: Array<{ kind: DoorKind; x: number }> = TRAY_KINDS.map((kind, i) => ({
  kind,
  x: (RS_W / TRAY_KINDS.length) * (i + 0.5),
}))
export const CHIP_R = 22

export function restingLabels(): SpokenLabel[] {
  return [
    spoken('extracellular', 48, SCALE_Y + 62),
    spoken('intracellular', 48, TRAY_Y - 92),
    // The tray names, spoken from BELOW each tray — the tray and the name must
    // not share a hit area, or a child hears a word when they meant to pick up
    // a door.
    // ⚠ CENTRED UNDER ITS OWN TRAY (user, 2026-08-30: "align each bucket with
    // the voicing button vertically"). A spoken label's ink runs from 18 px
    // LEFT of its anchor (the speaker glyph) to the end of the word, so its
    // middle is the anchor plus half of (word − glyph): anchoring at the
    // tray's centre put the pair noticeably off to the right of it.
    ...TRAY.map((t) => {
      const tw = IONS[t.kind].name.length * 6.2
      return spoken(IONS[t.kind].name, t.x - (tw - 18) / 2, TRAY_Y + TRAY_H / 2 + 26)
    }),
  ]
}

export function markAt(mv: number): number {
  return SCALE_X0 + alongTug(mv) * (SCALE_X1 - SCALE_X0)
}

/** Where each door stands in the wall. Spread evenly and deterministically —
 *  a scatter that moved when the count changed would make the doors look like
 *  they were walking. */
export function doorsAt(doors: Doors): Array<{ x: number; kind: DoorKind }> {
  const kinds: DoorKind[] = []
  for (const kind of TRAY_KINDS) {
    for (let i = 0; i < doors[kind]; i++) kinds.push(kind)
  }
  const total = Math.min(MAX_DOORS, kinds.length)
  const out: Array<{ x: number; kind: DoorKind }> = []
  const from = 128
  const to = RS_W - 128
  for (let i = 0; i < total; i++) {
    const u = total === 1 ? 0.5 : i / (total - 1)
    out.push({ x: from + u * (to - from), kind: kinds[i] })
  }
  return out
}

/** Which tray chip is under this point, if any — so a pointer handler asks the
 *  drawing where things are instead of keeping a second copy of the layout. */
export function chipAt(x: number, y: number): DoorKind | null {
  for (const t of TRAY) {
    if (
      x >= t.x - TRAY_W / 2 - 4 &&
      x <= t.x + TRAY_W / 2 + 4 &&
      y >= TRAY_Y - TRAY_H / 2 - 4 &&
      y <= TRAY_Y + TRAY_H / 2 + 4
    ) {
      return t.kind
    }
  }
  return null
}

/** The big reading's own speaker. ⚠ The word is never spoken on its own (user,
 *  2026-08-30: "voicing should not occur on its own"): something that talks
 *  when you did not ask is startling, and this one would have talked on every
 *  door dropped. It is a button, and this is where it is. */
export const LABEL_SPEAKER = { x: 0, y: 40, r: 15 }

/** ⚠ THE RESET IS ON THE CANVAS, beside the reading it undoes (user,
 *  2026-08-30). Under the canvas it was the only thing left in a row of its
 *  own — a control marooned away from everything it acts on, and a whole strip
 *  of height spent on one button. */
/** ⚠ THE APP'S ONE RESET (user, 2026-08-30). It used to be a private box with
 *  its own size, colour and wording — "↺ back to a real cell" — which is a
 *  fourth invention of a control that already exists. The corner it sits in is
 *  the same corner every canvas reset sits in, so a child never hunts for it. */
export const RESET_BOX = resetChipBox()

export function resetBoxAt(x: number, y: number): boolean {
  return resetChipHit(x, y, RESET_BOX)
}

export function labelSpeakerAt(x: number, y: number): boolean {
  return Math.hypot(x - (RS_W / 2 + LABEL_SPEAKER.x), y - LABEL_SPEAKER.y) <= LABEL_SPEAKER.r * 1.4
}

/** Which door in the wall is under this point, if any. */
export function doorAt(doors: Doors, x: number, y: number): number | null {
  if (Math.abs(y - WALL_Y) > HALF_MEM * SCALE * 1.6) return null
  const built = doorsAt(doors)
  for (const [i, d] of built.entries()) {
    if (Math.abs(x - d.x) <= leakHalfWidth(HALF_MEM) * SCALE * 1.2) return i
  }
  return null
}

/** Is this point in the wall, i.e. would a dropped door plug in here? */
export function overWall(y: number): boolean {
  return Math.abs(y - WALL_Y) <= HALF_MEM * SCALE * 2.4
}

/** THE SCALE. Its ends are the two extreme ions' own voltages, and chloride is
 *  marked on it too — a voter with a share on the board and no end of its own
 *  is a number from nowhere (user, 2026-08-30). */
function drawScaleBar(ctx: CanvasRenderingContext2D, mv: number): void {
  const g = ctx.createLinearGradient(SCALE_X0, 0, SCALE_X1, 0)
  g.addColorStop(0, `rgba(${GLOSSY_COLORS.k.glow}, 0.5)`)
  g.addColorStop(0.5, 'rgba(100, 116, 139, 0.3)')
  g.addColorStop(1, `rgba(${GLOSSY_COLORS.na.glow}, 0.5)`)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.roundRect(SCALE_X0, SCALE_Y - 7, SCALE_X1 - SCALE_X0, 14, 7)
  ctx.fill()

  // A real neuron's own resting voltage, so every reading has something to be
  // measured against — which is what makes the state words honest.
  const real = markAt(REST_MV)
  ctx.strokeStyle = FAINT
  ctx.lineWidth = 1
  ctx.setLineDash([3, 4])
  ctx.beginPath()
  ctx.moveTo(real, SCALE_Y - 30)
  ctx.lineTo(real, SCALE_Y + 40)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = FAINT
  ctx.fillText('a real cell', real, SCALE_Y + 52)

  ctx.font = '12px system-ui, sans-serif'
  for (const kind of VOTERS) {
    const value = contentAt(kind)
    const x = markAt(value)
    const tint = GLOSSY_COLORS[kind]
    ctx.fillStyle = tint.mid
    ctx.beginPath()
    ctx.arc(x, SCALE_Y, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = tint.light
    ctx.fillText(IONS[kind].symbol, x, SCALE_Y - 16)
    ctx.fillStyle = FAINT
    ctx.fillText(`${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(0)}`, x, SCALE_Y + 26)
  }

  // THE NEEDLE — where this membrane actually is, on the app's own polarity ramp.
  const x = markAt(mv)
  const hot = polarityT(mv) >= 0 ? '#f87171' : '#38bdf8'
  ctx.strokeStyle = hot
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, SCALE_Y - 22)
  ctx.lineTo(x, SCALE_Y + 22)
  ctx.stroke()
  ctx.fillStyle = hot
  ctx.beginPath()
  ctx.moveTo(x, SCALE_Y - 24)
  ctx.lineTo(x - 7, SCALE_Y - 36)
  ctx.lineTo(x + 7, SCALE_Y - 36)
  ctx.closePath()
  ctx.fill()
}

/** A door on its own, for the tray and for the thing under a dragging finger. */
/** One door on its own — on a tray, or under a dragging finger. */
function drawChip(
  ctx: CanvasRenderingContext2D,
  kind: DoorKind,
  x: number,
  y: number,
  tray: boolean,
): void {
  const tint = GLOSSY_COLORS[kind]
  if (tray) {
    // ⚠ A PILL WITH A THICK RIM — which is what the permeability bench's tray
    // actually is (user, 2026-08-30, twice: "buckets look incorrect, they
    // should look identical").
    //
    // That bench draws inside a context scaled by 4, so its `roundRect(…, 6)`
    // and `lineWidth = 1` are 24 px and 4 px ON SCREEN — and a 24 px radius on
    // a 26 px-tall box is clamped by canvas to half the height, giving fully
    // rounded ends. Copying its raw numbers gave a gently-rounded rectangle
    // with a hairline; copying what it LOOKS LIKE needs the scale applying.
    //
    // ⚠ And the test that let this through compared width and height only.
    ctx.fillStyle = TRAY_FILL
    ctx.strokeStyle = TRAY_EDGE
    ctx.lineWidth = TRAY_LINE
    ctx.beginPath()
    ctx.roundRect(x - TRAY_W / 2, y - TRAY_H / 2, TRAY_W, TRAY_H, TRAY_R)
    ctx.fill()
    ctx.stroke()
  }
  // ⚠ PERCHED ON THE RIM, NOT SAT INSIDE (user, 2026-08-30: "overlapping with
  // the top border of the bucket… as if it would be sitting slightly on the
  // top of it"). Drawn at the tray's top edge so it straddles it — the bucket
  // reads as holding a supply of these, with the next one ready to be picked
  // off the top.
  //
  // ⚠ Worth naming: the permeability bench draws its trays the OPPOSITE way,
  // sample overlapping the middle, and says why (2026-08-28) — a sample on the
  // edge there read as a separate object that happened to be nearby. These
  // hold something you DRAG OFF rather than something you fire, which is the
  // difference; but the two benches now differ, deliberately.
  ctx.save()
  ctx.translate(x, tray ? y - TRAY_H / 2 : y)
  drawLeakChannel(ctx, {
    cx: 0,
    midY: 0,
    halfHeight: HALF_MEM * 0.66,
    species: tint.mid,
    speciesDark: tint.dark,
  })
  ctx.restore()
}

export function drawResting(
  ctx: CanvasRenderingContext2D,
  doors: Doors,
  mv: number,
  ms: number,
  dragging: { kind: DoorKind; x: number; y: number } | null,
): void {
  ctx.clearRect(0, 0, RS_W, RS_H)

  const t = polarityT(mv)
  if (Math.abs(t) > 0.01) {
    const from = WALL_Y + HALF_MEM * SCALE
    ctx.fillStyle = chargeWash(ctx, from, RS_H, t, 0.8)
    ctx.fillRect(0, from, RS_W, RS_H - from)
  }

  // THE READING, big, at the top — and always with what it is measured against
  // (user, 2026-08-30). The word alone would say a built wall is a broken cell.
  const st = stateOf(doors)
  ctx.textAlign = 'center'
  ctx.fillStyle = polarityT(mv) >= 0 ? '#fca5a5' : '#7dd3fc'
  ctx.font = 'bold 30px system-ui, sans-serif'
  const wordW = ctx.measureText(st.word).width
  ctx.fillText(st.word, RS_W / 2 + LABEL_SPEAKER.r + 6, 50)
  // ⚠ ITS SPEAKER, and the ONLY way the word is ever said (user, 2026-08-30).
  // A reading that talks whenever it changes talks over the child at the
  // moment they are looking hardest.
  const sx = RS_W / 2 + LABEL_SPEAKER.x - wordW / 2 - 2
  ctx.fillStyle = 'rgba(251, 191, 36, 0.16)'
  ctx.beginPath()
  ctx.arc(sx, LABEL_SPEAKER.y, LABEL_SPEAKER.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.save()
  ctx.translate(sx, LABEL_SPEAKER.y)
  ctx.scale(1.5, 1.5)
  speakerGlyph(ctx, 0, 0)
  ctx.restore()
  ctx.fillStyle = INK
  ctx.font = '13px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(st.line, RS_W / 2, 74)

  // The way back to an ordinary cell, in the corner every reset lives in.
  drawResetChip(ctx, RESET_BOX)

  drawScaleBar(ctx, mv)

  const built = doorsAt(doors)
  const fits = leakHalfWidth(HALF_MEM) * 1.06
  ctx.save()
  ctx.translate(0, WALL_Y)
  ctx.scale(SCALE, SCALE)
  drawLipids(ctx, {
    midY: 0,
    from: 0,
    to: RS_W / SCALE,
    gaps: built.map((d) => [d.x / SCALE - fits, d.x / SCALE + fits] as const),
  })
  for (const d of built) {
    const tint = GLOSSY_COLORS[d.kind]
    drawLeakChannel(ctx, {
      cx: d.x / SCALE,
      midY: 0,
      halfHeight: HALF_MEM,
      species: tint.mid,
      speciesDark: tint.dark,
    })
  }
  ctx.restore()

  // THE TRAFFIC. A leak channel is never shut, so every door in the wall is
  // carrying its ion — which is what makes the vote a thing that happens
  // rather than a diagram of one.
  for (const [i, d] of built.entries()) {
    const up = d.kind === 'k'
    const span = HALF_MEM * SCALE * 2 + 52
    for (let n = 0; n < 2; n++) {
      const phase = (ms / 1600 + i * 0.31 + n / 2) % 1
      const y = up
        ? WALL_Y + HALF_MEM * SCALE + 26 - phase * span
        : WALL_Y - HALF_MEM * SCALE - 26 + phase * span
      const x = d.x + Math.sin(phase * 6 + i) * 4
      const r = 6
      ctx.save()
      ctx.globalAlpha = Math.min(1, 2 - Math.abs(phase - 0.5) * 4) * 0.9
      drawGlossyIon(ctx, d.kind, x, y, r)
      drawIonCharge(ctx, x, y, r, IONS[d.kind].charge, undefined, badgeMinR(1))
      ctx.restore()
    }
  }

  // ⚠ THE SHARE BAR IS GONE (user, 2026-08-30: "remove the percentage graph.
  // Remove it completely. It's clear from the picture how many of which
  // channels are present. We don't need a duplication").
  //
  // It drew each ion's weight in the equation as a length — and the doors in
  // the wall above it are that same weight, in the same colours, already. Two
  // pictures of one quantity is the canvas repeating itself, which is the same
  // fault as the column repeating the canvas.
  //
  // ⚠ What went with it, and is worth naming: the paler part of each bar was
  // the answer to "why is chloride in the sum with no chloride channel". That
  // answer now lives only in words — in "Right now" and in the honesty note —
  // and in the chloride tray, which lets a child give it a door and watch it
  // matter. If the question comes back, this is where the answer used to be.

  // THE TRAY. Drag one into the wall; drag one out of it to take it away.
  // ⚠ NO INSTRUCTION LINE (user, 2026-08-30). A tray with a door sitting on it
  // beside a wall with doors in it is a sentence already; "drag a door into
  // the wall" was the canvas explaining itself, which this app has a rule
  // against. The `title` on the canvas still says it for anyone who hovers.
  for (const chip of TRAY) drawChip(ctx, chip.kind, chip.x, TRAY_Y, true)

  // Whatever is under the finger, drawn last so it rides over everything.
  if (dragging) {
    ctx.save()
    ctx.globalAlpha = 0.92
    drawChip(ctx, dragging.kind, dragging.x, dragging.y, false)
    ctx.restore()
  }

  for (const l of restingLabels()) drawSpoken(ctx, l)
}
