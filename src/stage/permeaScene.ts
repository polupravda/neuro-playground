import { drawResetChip, resetChipBox, resetChipHit, RESET_LABEL } from './resetChip'
import { drawAquaporin } from './aquaporin'
import { HALF_MEM, HEAD_GAP, PX_PER_NM, drawLipids } from './bilayer'
import { PX_PER_UM } from './layout'
import {
  glossySphere,
  drawGlossyIon,
  drawIonCharge,
  badgeMinR,
  needsIonKey,
} from './particleStyle'
import { ELEMENT_COLOR } from './lipidLabScene'
import { spoken, drawSpoken, type SpokenLabel } from './spokenLabels'
import {
  TRAVELLERS,
  travellerOf,
  AQUAPORIN_WATER_BOOST,
  type TravellerId,
} from '../core/permeability'
import type { TeachingPara } from '../core/neuron'

// D02 — the permeability bench. Containers of real substances above a bare
// lipid wall: click one and a squirt of it is released at the wall, to cross
// or to bounce. The tank shows the ORDER (its odds are declared compressed);
// the true coefficients are printed in the describer's "Keep in mind". An
// aquaporin can be plugged in — from a chip ON the wall — to give water its
// real fast path. (A log-ladder side panel existed briefly and was removed at
// the user's request in the 27a round; its numbers moved into the words.)

// ── Layout, viewport-measured at module load (the lab's pattern) ───────────

const VIEW_W = typeof window !== 'undefined' ? Math.min(window.innerWidth, 1376) : 1280
const VIEW_H = typeof window !== 'undefined' ? window.innerHeight : 860
// Measured against what the drawer ACTUALLY gives (h-screen, p-5, the grid's
// pt-2, and the 86rem cap on its width). The old numbers were 56 px more
// cautious vertically, which left a band of the drawer empty under the tank
// (2026-08-28).
const DRAWER_W = Math.min(VIEW_W, 1376)
const CONTENT_W = Math.max(700, DRAWER_W - 40 - 256 - 24 - 12)
const CONTENT_H = Math.max(540, VIEW_H - 48 - 8)
const PANEL_PAD = 20

/** Twice the magnification of the other benches (2026-08-28). The travellers
 *  are now drawn at their real size against a wall drawn at its real size, and
 *  a carbon dioxide molecule is a third of a nanometre: at the ×2 the other
 *  benches use it would be under four pixels across. Zooming the whole bench
 *  keeps ONE scale for everything in it — the honest fix — rather than giving
 *  the molecules a private exaggeration. The declared ×N follows automatically. */
export const PERMEA_SCALE = 4
export const PT_W = Math.round((CONTENT_W - PANEL_PAD) / PERMEA_SCALE)
export const PT_H = Math.round((CONTENT_H - PANEL_PAD) / PERMEA_SCALE)

/** The wall sits low so the shots have room to fall and bounce. */
export const WALL_Y = Math.round(PT_H * 0.62)

/** Same bilayer, same scale, same declared magnification as the lipid lab. */
export const PERMEA_MAG = Math.round((PERMEA_SCALE * PX_PER_NM) / (PX_PER_UM / 1000))

// ── Containers ──────────────────────────────────────────────────────────────

export interface Container {
  sp: TravellerId
  cx: number
  /** Beaker box, logical. */
  x: number
  y: number
  w: number
  h: number
}

// The distributor tray, in the atom builder's own proportions: a flat rounded
// box (124×52 css there; 62×26 logical here at ×2), the sample perched on its
// rim, the name inside the tray's lower half.
/** The tray's sample is the SAME size as the thing it fires (2026-08-28): now
 *  that the travellers are legible on the stage, a magnified key would make
 *  the tray promise a different creature from the one that comes out. The
 *  tray is a bucket of that substance, not a diagram of it. */
export const TRAY_KEY_MAG = 1

/** The tray's corner radius and rim, in THIS bench's logical units — exported
 *  so the resting bench can be checked against them rather than against a
 *  number copied by eye. Both are drawn inside a ×`PERMEA_SCALE` context, so
 *  on screen they are four times these (2026-08-30). */
export const PERMEA_TRAY_R = 6
export const PERMEA_TRAY_LINE = 1

const CONT_W = 112 / PERMEA_SCALE
const CONT_H = 26 / PERMEA_SCALE
/** Pushed well clear of the canvas's own top chrome, so a child reaching for
 *  a bucket cannot land on something else (2026-08-28). */
const CONT_Y = 62 / PERMEA_SCALE

export function containers(): Container[] {
  const n = TRAVELLERS.length
  const spacing = PT_W / n
  return TRAVELLERS.map((t, i) => {
    const cx = spacing * (i + 0.5)
    return { sp: t.id, cx, x: cx - CONT_W / 2, y: CONT_Y, w: CONT_W, h: CONT_H }
  })
}

export function containerAt(x: number, y: number): TravellerId | null {
  for (const c of containers()) {
    // The tray and the sample perched on its rim — but NOT the name below it,
    // which belongs to the speaker. A bucket that fires when you meant to hear
    // its name, or speaks when you meant to fire it, is the same bug twice.
    if (x >= c.x - 4 && x <= c.x + c.w + 4 && y >= c.y - 14 && y <= c.y + c.h + 2) return c.sp
  }
  return null
}

/** Where the aquaporin sits in the wall: the MIDDLE of the tank, under the
 *  water tray. Its switch lives over at the right-hand end, deliberately not
 *  above the pore — a control stacked on the thing it changes hides it. */
export const AQP_X = Math.round(PT_W / 2)

// ── The motes ───────────────────────────────────────────────────────────────

export interface Mote {
  id: number
  sp: TravellerId
  x: number
  y: number
  vx: number
  vy: number
  /** How many times it has knocked on the wall — each knock rolls its own die. */
  knocks: number
  /** While crossing: the x it is easing onto — the pore's centre if it went
   *  in at the door, its own entry point otherwise. */
  lane?: number
  side: 'above' | 'crossing' | 'below'
}

export const MOTES_PER_SHOT = 12
export const MAX_MOTES = 240

function hash01(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** One squirt: MOTES_PER_SHOT motes fanned downward from the container's
 *  mouth. Deterministic in (startId). */
export function shootMotes(sp: TravellerId, startId: number): Mote[] {
  const c = containers().find((k) => k.sp === sp)!
  const out: Mote[] = []
  for (let i = 0; i < MOTES_PER_SHOT; i++) {
    const id = startId + i
    out.push({
      id,
      sp,
      x: c.cx + (hash01(id, 1) - 0.5) * CONT_W * 0.6,
      y: c.y + CONT_H + 4,
      vx: (hash01(id, 2) - 0.5) * 26,
      vy: 30 + hash01(id, 3) * 26,
      knocks: 0,
      side: 'above',
    })
  }
  return out
}

/** The odds a knock on the wall gets through — the tank's declared-compressed
 *  numbers, with the aquaporin's boost for water near its mouth. */
export function oddsFor(sp: TravellerId, aquaporin: boolean, x: number): number {
  const base = travellerOf(sp).visualOdds
  // The mouth's catchment is drawn generously (a real membrane carries MANY
  // aquaporins; this bench draws one and lets it stand for them).
  // The door is a DOOR: only a molecule actually at its mouth goes through it.
  // A wide catchment made water cross "at the pore" from a fifth of the tank
  // away, and the drawing then had to snap it sideways into the channel — a
  // teleport (reported 2026-08-28). The funnel brings water here; the mouth
  // itself is narrow.
  if (aquaporin && sp === 'water' && Math.abs(x - AQP_X) < PORE_HALF * 1.6) {
    return Math.min(0.9, base * AQUAPORIN_WATER_BOOST)
  }
  return base
}

const TOP_LIMIT = CONT_Y + CONT_H + 2
const R = 5 // a mote's collision radius, generous over its drawn size

/** Advance every mote by dt. Stateful by design (a bench keeps its crossings
 *  in refs, like the balance chambers); every random draw is a hash of the
 *  mote's id, so a run is reproducible. Nothing is ever created or destroyed
 *  here — conservation is the caller's to keep, via reset. */
/** Half-width of the aquaporin's mouth, logical px — the column a water
 *  molecule files down. */
export const PORE_HALF = 8

/** How strongly the pore gathers water from the sheet of it above the wall.
 *
 *  A real aquaporin does not reach out and pull: water arrives by diffusion,
 *  and a real membrane carries MILLIONS of these pores, so wherever a molecule
 *  lands it is already next to one. This bench draws a single pore, and with
 *  one pore in a wide wall almost no molecule ever knocks near it — the door
 *  looked inert (reported 2026-08-28). The funnel stands in for the pores that
 *  are not drawn. Declared in the honesty note. */
const FUNNEL = 5
/** How far up from the wall the pore's pull is felt, logical px. Widened
 *  2026-08-28: a molecule wandering anywhere near the door should lean toward
 *  it, not only one already grazing the wall. */
const FUNNEL_REACH = 260

export function stepMotes(motes: Mote[], dtMs: number, ms: number, aquaporin: boolean): void {
  const dt = Math.min(50, dtMs) / 1000
  const epoch = Math.floor(ms / 240)
  for (const m of motes) {
    // Water finds its door: a gentle drift toward the pore, strongest for the
    // molecules already close to the wall, none at all for anything else —
    // an aquaporin passes water and nothing else, including in this steering.
    if (aquaporin && m.sp === 'water' && m.side === 'above') {
      const nearWall = Math.max(0, Math.min(1, 1 - (WALL_Y - m.y) / FUNNEL_REACH))
      m.vx += (AQP_X - m.x) * FUNNEL * nearWall * dt
    }
    // Thermal kicks, deterministic per (mote, epoch).
    m.vx += (hash01(m.id, epoch) - 0.5) * 60 * dt * 10
    m.vy += (hash01(m.id, epoch + 0.5) - 0.5) * 60 * dt * 10
    // Drag keeps the jostle from winding up.
    m.vx *= 1 - 1.2 * dt
    m.vy *= 1 - 1.2 * dt
    if (m.side === 'crossing') {
      // Through the oil: slow, downward, no kicks strong enough to matter —
      // and sliding onto its lane rather than jumping to it.
      m.vy = 16
      m.vx = 0
      if (m.lane !== undefined) m.x += (m.lane - m.x) * Math.min(1, 6 * dt)
      m.y += m.vy * dt
      if (m.y > WALL_Y + HALF_MEM + R) m.side = 'below'
      continue
    }
    m.x += m.vx * dt
    m.y += m.vy * dt
    // Side walls.
    if (m.x < R) {
      m.x = R
      m.vx = Math.abs(m.vx)
    }
    if (m.x > PT_W - R) {
      m.x = PT_W - R
      m.vx = -Math.abs(m.vx)
    }
    if (m.side === 'above') {
      if (m.y < TOP_LIMIT + R) {
        m.y = TOP_LIMIT + R
        m.vy = Math.abs(m.vy)
      }
      if (m.y > WALL_Y - HALF_MEM - R) {
        // A knock on the wall: roll this knock's die.
        m.knocks += 1
        if (hash01(m.id, 900 + m.knocks) < oddsFor(m.sp, aquaporin, m.x)) {
          m.side = 'crossing'
          // Which lane it is taking down: the pore's own centre if it entered
          // at the mouth, otherwise wherever it happened to dissolve in. It is
          // EASED toward that lane while crossing, never snapped — an
          // aquaporin is barely wider than one molecule, and water files
          // through it in single file, but it arrives by swimming.
          m.lane =
            aquaporin && m.sp === 'water' && Math.abs(m.x - AQP_X) < PORE_HALF * 1.6
              ? AQP_X
              : m.x
        } else {
          m.y = WALL_Y - HALF_MEM - R
          m.vy = -Math.abs(m.vy) - 10
        }
      }
    } else {
      // Below the wall.
      if (m.y < WALL_Y + HALF_MEM + R) {
        m.y = WALL_Y + HALF_MEM + R
        m.vy = Math.abs(m.vy)
      }
      if (m.y > PT_H - R) {
        m.y = PT_H - R
        m.vy = -Math.abs(m.vy)
      }
    }
  }
}

/** One squirt per container: a substance already in the tank cannot be fired
 *  again until ↺ Reset — derived from the motes themselves, so it can never
 *  disagree with what is on screen. */
export function firedSpecies(motes: readonly Mote[]): Set<TravellerId> {
  return new Set(motes.map((m) => m.sp))
}

/** Crossed counts per species — the readings collecting at the tank's foot. */
export function crossedCounts(motes: readonly Mote[]): Record<TravellerId, number> {
  const out = { o2: 0, co2: 0, water: 0, glucose: 0, na: 0 } as Record<TravellerId, number>
  for (const m of motes) if (m.side === 'below') out[m.sp] += 1
  return out
}

// ── Drawing ─────────────────────────────────────────────────────────────────

const LABEL = '#cbd5e1'
const WATER_TINT = 'rgba(96, 165, 250, 0.05)'
const AQP_TINT = ELEMENT_COLOR.O

// ── Molecules, built from atoms ────────────────────────────────────────────
//
// Every molecule is a list of real atoms at real positions, in NANOMETRES.
// That fixes an error worth naming: the drawing used to normalise each
// molecule to a unit span and scale it by its own size, so a carbon in
// glucose came out 1.85× bigger than the carbon in carbon dioxide. A carbon
// is a carbon. Sizes now emerge from the atoms, and every element is the same
// size everywhere in the app.

/** Van der Waals radii, nm. */
export const ATOM_R_NM: Record<'H' | 'C' | 'N' | 'O' | 'NA', number> = {
  H: 0.11,
  C: 0.17,
  N: 0.155,
  O: 0.152,
  NA: 0.102, // an ion, so its ionic radius — the bare thing, water coat aside
}

const ATOM_INK: Record<'H' | 'C' | 'N' | 'O' | 'NA', string> = {
  H: ELEMENT_COLOR.H,
  C: ELEMENT_COLOR.C,
  N: ELEMENT_COLOR.N,
  O: ELEMENT_COLOR.O,
  NA: '', // drawn as the app's glossy sodium instead
}

interface Atom {
  el: keyof typeof ATOM_R_NM
  x: number
  y: number
}

/** Real bond lengths: O=O 0.121, C=O 0.116, O–H 0.096 at 104.5°, C–C 0.153. */
const MOLECULES: Record<TravellerId, Atom[]> = {
  o2: [
    { el: 'O', x: -0.0605, y: 0 },
    { el: 'O', x: 0.0605, y: 0 },
  ],
  co2: [
    { el: 'O', x: -0.116, y: 0 },
    { el: 'C', x: 0, y: 0 },
    { el: 'O', x: 0.116, y: 0 },
  ],
  water: [
    { el: 'O', x: 0, y: 0 },
    { el: 'H', x: -0.0757, y: 0.0586 },
    { el: 'H', x: 0.0757, y: 0.0586 },
  ],
  glucose: [
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 6
      return { el: 'C' as const, x: Math.cos(a) * 0.153, y: Math.sin(a) * 0.153 }
    }),
    { el: 'O', x: 0.28, y: -0.06 },
    { el: 'O', x: -0.2, y: 0.21 },
    { el: 'O', x: -0.08, y: -0.28 },
  ],
  na: [{ el: 'NA', x: 0, y: 0 }],
}

/** How far a molecule reaches from its centre, nm — its own atoms decide. */
export function reachNm(sp: TravellerId): number {
  return Math.max(...MOLECULES[sp].map((a) => Math.hypot(a.x, a.y) + ATOM_R_NM[a.el]))
}

/** How narrow it is across its slimmest axis, nm — what actually has to fit
 *  through a gap, and why a long molecule turns side-on to cross. */
export function narrowNm(sp: TravellerId): number {
  return 2 * Math.max(...MOLECULES[sp].map((a) => Math.abs(a.y) + ATOM_R_NM[a.el]))
}

/** ONE exaggeration, shared by every traveller and declared in the honesty
 *  note. At true size against a wall drawn true, the gases are a fifth of a
 *  lipid head — indistinguishable specks. Magnifying them all by the same
 *  factor keeps every comparison BETWEEN them honest (sodium still the
 *  smallest, glucose still the bulkiest) while making them legible, and keeps
 *  the wall as the one honest ruler on the canvas. */
export const TRAVELLER_MAG = 2

/** Drawn extent of a traveller, in logical px. */
export function drawnReach(sp: TravellerId): number {
  return reachNm(sp) * TRAVELLER_MAG * PX_PER_NM
}

/** One traveller, drawn from its own atoms. `mag` is for the trays only,
 *  which are chrome and show a magnified key. */
export function drawTraveller(
  ctx: CanvasRenderingContext2D,
  sp: TravellerId,
  x: number,
  y: number,
  mag = 1,
  squeeze = 1,
  rot = 0,
  /** True where this specimen is a KEY rather than one of the crowd. A key
   *  wears its charge whatever its size — that is what a key is for. The
   *  crowd does not, because at four pixels the badge would be bigger than
   *  the ion (2026-08-28: sodium was left with no charge shown ANYWHERE in
   *  this bench, because the tray specimen is drawn at crowd size and the
   *  size guard silenced it there too). */
  isKey = false,
): void {
  const unit = TRAVELLER_MAG * PX_PER_NM * mag
  ctx.save()
  ctx.translate(x, y)
  if (rot !== 0) ctx.rotate(rot)
  if (squeeze !== 1) ctx.scale(1, squeeze)
  for (const a of MOLECULES[sp]) {
    const r = ATOM_R_NM[a.el] * unit
    if (a.el === 'NA') drawGlossyIon(ctx, 'na', a.x * unit, a.y * unit, r)
    else glossySphere(ctx, a.x * unit, a.y * unit, r, ATOM_INK[a.el])
  }
  ctx.restore()
  // Its charge, but only where a badge could be read: on the stage these are
  // a few pixels across, and the rule there is a KEY in the chrome.
  const t = travellerOf(sp)
  const bodyPx = ATOM_R_NM.NA * unit * PERMEA_SCALE
  if (t.charged && (isKey || !needsIonKey(bodyPx))) {
    drawIonCharge(ctx, x, y, ATOM_R_NM.NA * unit, 1, undefined, badgeMinR(PERMEA_SCALE))
  }
}

/** The container names, speakable (F04), centred INSIDE each tray the way the
 *  atom builder centres its bucket labels. CSS px. */
export function permeaLabels(): SpokenLabel[] {
  return containers().map((c) => {
    const term = travellerOf(c.sp).term
    const ax = c.cx * PERMEA_SCALE - (term.length * 6.2) / 2 + 10
    // BELOW the tray: the speaker and the bucket must not share a hit area.
    return spoken(term, ax, (c.y + c.h) * PERMEA_SCALE + 20)
  })
}

/** The aquaporin's own control, sitting just above the wall it plugs into —
 *  the thing it changes is right below the button (css px). */
export function aquaporinChip(): { x: number; y: number; w: number; h: number } {
  const w = 168
  const h = 30
  return {
    x: PT_W * PERMEA_SCALE - w - 14,
    y: (WALL_Y - HALF_MEM) * PERMEA_SCALE - h - 14,
    w,
    h,
  }
}

/** ↺ Reset, on the canvas rather than above it — the drawer has no room to
 *  spare and a control belongs with the thing it controls (2026-08-28).
 *
 *  ⚠ Its geometry moved to `stage/resetChip` (2026-08-30): this bench is the
 *  source of truth for how a reset looks, so the numbers had to be somewhere
 *  every other bench could reach them rather than here where they were copied
 *  from by eye. */
export function resetChip(): { x: number; y: number; w: number; h: number } {
  return resetChipBox()
}

export function resetChipAt(x: number, y: number): boolean {
  return resetChipHit(x, y)
}

export function aquaporinChipAt(x: number, y: number): boolean {
  const c = aquaporinChip()
  return x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h
}

export function drawPermea(
  ctx: CanvasRenderingContext2D,
  motes: readonly Mote[],
  aquaporin: boolean,
): void {
  const counts = crossedCounts(motes)
  // The wall OPENS around whoever is crossing: its molecules are shoved aside
  // along the membrane, leaving room where the traveller is dissolving
  // through. (A midline bow was tried first and read as the wall closing over
  // it — see `LipidRun.pushAt`.)
  const crossers = motes.filter((m) => m.side === 'crossing')
  // The wall opens only as much as the thing crossing it needs — and the
  // widest it ever gets must stay NARROWER THAN GLUCOSE, or the picture asks
  // "so why doesn't that fit through?" and teaches sieving all over again
  // (user, 2026-08-28). Since glucose never crosses, the wall is never seen
  // opening for it; and since the parting is sized by the crosser, the gap a
  // child does see is always the size of a gas.
  const REACH = HEAD_GAP * 1.2
  const openFor = (sp: TravellerId) => narrowNm(sp) * TRAVELLER_MAG * PX_PER_NM * 0.3
  const pushAt =
    crossers.length === 0
      ? undefined
      : (x: number) =>
          crossers.reduce((sum, m) => {
            const d = x - m.x
            // How far into the wall it has got: the parting swells as it
            // enters and closes behind it.
            const depth = Math.min(1, Math.max(0, (m.y - (WALL_Y - HALF_MEM)) / (2 * HALF_MEM)))
            const envelope = Math.sin(Math.PI * depth)
            return sum + Math.sign(d) * openFor(m.sp) * envelope * Math.exp(-((d / REACH) ** 2))
          }, 0)

  ctx.save()
  ctx.scale(PERMEA_SCALE, PERMEA_SCALE)
  ctx.fillStyle = WATER_TINT
  ctx.fillRect(0, 0, PT_W, PT_H)

  // The distributor trays, in the atom builder's grammar: a flat rounded box,
  // the sample sitting on its rim, the name inside. A spent tray dims — one
  // squirt each, until ↺ Reset refills them.
  const fired = firedSpecies(motes)
  ctx.lineWidth = 1
  for (const c of containers()) {
    ctx.save()
    if (fired.has(c.sp)) ctx.globalAlpha *= 0.3
    ctx.fillStyle = '#1e293b'
    ctx.strokeStyle = '#334155'
    ctx.beginPath()
    ctx.roundRect(c.x, c.y, c.w, c.h, PERMEA_TRAY_R)
    ctx.fill()
    ctx.stroke()
    // A spent tray keeps a GHOST of what it held: the bucket is empty, but
    // the child still needs to know which one it was — and, once several have
    // been fired, what all five were (2026-08-28).
    //
    // ⚠ PERCHED ON THE RIM, and this REVERSES the 2026-08-28 decision recorded
    // here, at the user's request (2026-08-30: "place the molecules 'sitting'
    // on the buckets").
    //
    // The old reasoning was that a sample balanced on the edge reads as a
    // separate object that happens to be nearby. What settles it the other way
    // is the resting bench, whose buckets you DRAG things off: there, sitting
    // on the rim is what says "there are more of these, take one". The two
    // benches were drawn differently for a round, the user saw both, and chose
    // this one for both. Overlapping the rim rather than floating above it is
    // what keeps the tray reading as holding it.
    drawTraveller(ctx, c.sp, c.cx, c.y, TRAY_KEY_MAG, 1, 0, true)
    ctx.restore()
  }

  // The wall — the app's one bilayer, parted where the aquaporin sits,
  // bowing around whoever is mid-squeeze.
  const gap: Array<readonly [number, number]> = aquaporin
    ? [[AQP_X - 14, AQP_X + 14] as const]
    : []
  drawLipids(ctx, { midY: WALL_Y, from: 0, to: PT_W, gaps: gap, pushAt })
  if (aquaporin) {
    // ⚠ ITS OWN PROTEIN, not an ion channel wearing a different tint (user,
    // 2026-08-30). It used to borrow the generic gated-channel drawing with
    // `open: 0.45` — a door held permanently ajar — which said an aquaporin is
    // one of the four doors, half-open. It is not one of them at all: no gate,
    // no ions, and a WAIST too narrow for a hydrated one. That pinch is the
    // whole mechanism and the generic shape did not have it.
    drawAquaporin(ctx, {
      cx: AQP_X,
      midY: WALL_Y,
      halfHeight: 13,
      species: AQP_TINT,
      speciesDark: AQP_TINT,
    })
  }

  // Every mote, wherever its jostling has taken it — and a crosser turns
  // side-on and squeezes as it goes.
  //
  // This is the compromise (2026-08-28). It was removed for a round because at
  // true size a gas has nothing to squeeze past, and a molecule wriggling
  // through a gap teaches SIEVING — the misconception this bench exists to
  // kill. But drawing from real atoms brings back areal reason for it: a
  // molecule is not a ball. Carbon dioxide is a ROD, half a nanometre long and
  // three tenths wide, and what has to fit through a gap is its narrow face —
  // which is exactly why chemists quote a "kinetic diameter" rather than a
  // length. So a long molecule turning side-on to cross is real, and the
  // slight squeeze stands for the give in both the molecule and the tails.
  // What is NOT allowed back is a gap wide enough to invite the sieve
  // question: see OPEN above.
  for (const m of motes) {
    let squeeze = 1
    let rot = 0
    if (m.side === 'crossing') {
      const depth = Math.min(1, Math.max(0, (m.y - (WALL_Y - HALF_MEM)) / (2 * HALF_MEM)))
      const envelope = Math.sin(Math.PI * depth)
      squeeze = 1 - 0.15 * envelope
      // Turn its slimmest axis into the wall — but only a molecule that HAS a
      // slim axis; a round one has nothing to turn.
      if (narrowNm(m.sp) < reachNm(m.sp) * 1.5) rot = (Math.PI / 2) * envelope
    }
    drawTraveller(ctx, m.sp, m.x, m.y, 1, squeeze, rot)
  }

  // The crossed counts collect at the tank's foot, one reading per species.
  let countX = 16
  const countTexts: Array<{ x: number; n: number }> = []
  for (const t of TRAVELLERS) {
    const n = counts[t.id]
    if (n === 0) continue
    drawTraveller(ctx, t.id, countX, PT_H - 14)
    countTexts.push({ x: countX + 12, n })
    countX += 52
  }
  ctx.restore()

  // Screen-space chrome: magnification, counts, the aquaporin's control and
  // name, the containers' speakable names.
  ctx.fillStyle = LABEL
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`×${PERMEA_MAG.toLocaleString('en-US')}`, PT_W * PERMEA_SCALE - 8, 16)
  ctx.textAlign = 'left'
  for (const c of countTexts) {
    ctx.fillText(`×${c.n}`, c.x * PERMEA_SCALE, (PT_H - 10) * PERMEA_SCALE)
  }
  // A switch, not a wordy chip: a track with a knob that slides, which a
  // child reads as on/off without reading anything.
  // The way back to an empty tank, always in the same corner.
  drawResetChip(ctx)

  const chip = aquaporinChip()
  ctx.fillStyle = 'rgba(30, 41, 59, 0.92)'
  ctx.strokeStyle = '#475569'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(chip.x, chip.y, chip.w, chip.h, 10)
  ctx.fill()
  ctx.stroke()

  const trackW = 34
  const trackH = 18
  const trackX = chip.x + chip.w - trackW - 10
  const trackY = chip.y + (chip.h - trackH) / 2
  // Sky-500 when on — the sibling app's switch colour.
  ctx.fillStyle = aquaporin ? '#0ea5e9' : '#334155'
  ctx.strokeStyle = aquaporin ? '#38bdf8' : '#475569'
  ctx.beginPath()
  ctx.roundRect(trackX, trackY, trackW, trackH, trackH / 2)
  ctx.fill()
  ctx.stroke()
  const knobX = aquaporin ? trackX + trackW - trackH / 2 : trackX + trackH / 2
  ctx.fillStyle = aquaporin ? '#f8fafc' : '#94a3b8'
  ctx.beginPath()
  ctx.arc(knobX, trackY + trackH / 2, trackH / 2 - 2.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = LABEL
  ctx.textAlign = 'left'
  ctx.fillText('🚰 aquaporin', chip.x + 12, chip.y + chip.h / 2 + 4)
  if (aquaporin) {
    ctx.fillText('aquaporin', AQP_X * PERMEA_SCALE, (WALL_Y + HALF_MEM + 16) * PERMEA_SCALE)
  }
  for (const l of permeaLabels()) drawSpoken(ctx, l)
}

// ── Words ───────────────────────────────────────────────────────────────────

export function permeaRightNow(lastShot: TravellerId | null, aquaporin: boolean): TeachingPara[] {
  const out: TeachingPara[] = []
  if (lastShot === null) {
    out.push({
      icon: '🫗',
      text: `Five containers, one bare lipid wall. Click a container to squirt its contents at the wall — one squirt each, ${RESET_LABEL} refills them — and watch which of them get through. The crossings collect as counts at the tank’s foot; the measured numbers are under “How easily it crosses”.`,
    })
  } else {
    const t = travellerOf(lastShot)
    out.push({
      icon: '🎯',
      text: `You fired ${t.name}: ${t.why}. Watch the wall — and the count at the tank's foot.`,
    })
  }
  out.push(
    aquaporin
      ? {
          icon: '🚰',
          text: 'An aquaporin is in the wall: a door so narrow water passes single file — and so picky that even a charged proton is turned away. Fire water near it and compare.',
        }
      : {
          icon: '🧱',
          text: 'The wall is bare lipid — no doors of any kind. This is the membrane a cell would have if it built nothing into it.',
        },
  )
  return out
}
