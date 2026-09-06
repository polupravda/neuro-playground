import {
  HEAD_GAP,
  HEAD_R,
  HALF_MEM,
  TAIL_LEN,
  PX_PER_NM,
  OILY_CORE,
  drawLipid,
  lipidJiggle,
} from './bilayer'
import { PX_PER_UM } from './layout'
import { glossySphere } from './particleStyle'
import { spoken, drawSpoken, drawConnector, type SpokenLabel } from './spokenLabels'
import type { TeachingPara } from '../core/neuron'

// D01 — the lipid lab. What the wall is actually made of, why it assembles
// itself, and that it is a liquid you can pull a molecule out of.
//
// Everything here is a pure function of (state, clock) so the whole
// choreography can be walked in a test: nothing teleports, everything ends in
// its slot, and a seed change rearranges the scatter. The drawing reuses the
// one molecule this app has (`drawLipid`) — the lab enlarges the wall's own
// molecule, it does not invent a second one.

// The lab measures itself against the viewport once at module load (the same
// pattern as stage/layout.ts): the drawer reaches the bottom of the screen,
// row 1 (the molecule and the vesicle) gets the larger share of the height,
// row 2 (the wall) is shorter and takes the width.
const VIEW_W = typeof window !== 'undefined' ? Math.min(window.innerWidth, 1376) : 1280
const VIEW_H = typeof window !== 'undefined' ? window.innerHeight : 860
/** The exhibit column: drawer padding, describer column and gaps removed. */
const CONTENT_W = Math.max(700, VIEW_W - 40 - 256 - 24 - 12)
/** Height under the drawer's controls row. */
const CONTENT_H = Math.max(540, VIEW_H - 40 - 64)
const ROW_GAP = 12
export const ROW1_H = Math.round(CONTENT_H * 0.62)
export const ROW2_H = CONTENT_H - ROW1_H - ROW_GAP
/** Panel chrome: p-2 padding and the border, both axes. */
const PANEL_PAD = 20

/** Logical lab size, in bilayer px. The view scales by LAB_SCALE. */
export const LAB_SCALE = 2
export const LAB_W = Math.round((CONTENT_W - PANEL_PAD) / LAB_SCALE)
export const LAB_H = Math.round((ROW2_H - PANEL_PAD) / LAB_SCALE)

/** The wall fills the tank edge to edge, its leaflets sized by what fits at
 *  ~HEAD_GAP — the frame is a window on a wall that keeps going, not a
 *  floating plank with bare edges (never invent a surface that is off the
 *  page; an exposed bilayer edge would be one). */
export const PER_LEAFLET = Math.round(LAB_W / HEAD_GAP)
export const LAB_LIPIDS = PER_LEAFLET * 2

export const WALL_SPAN = LAB_W
export const WALL_FROM = 0
export const WALL_TO = LAB_W
export const WALL_MID_Y = LAB_H * 0.58

/** The two transports. Settling is the payload and gets the screen time;
 *  scattering is the reset and is quick. */
export const SETTLE_MS = 6000
export const SCATTER_MS = 1600

/** Declared magnifications, derived rather than asserted: how much bigger this
 *  drawing is than the same membrane on the whole-neuron scene at ×1
 *  (where 5 nm is 0.022 px). The describer interpolates these. */
const SCENE_PX_PER_NM = PX_PER_UM / 1000
export const WALL_MAG = Math.round((LAB_SCALE * PX_PER_NM) / SCENE_PX_PER_NM)

/** The molecule panel's scale hangs on one true length: a carbon–carbon bond
 *  is 0.154 nm, and the panel gives it CC_STEP logical px times the panel's
 *  own viewport-fitted scale. The magnification derives from that, never from
 *  what looked right. */
export const CC_STEP = 9.5
export const CC_BOND_NM = 0.154
/** Molecule-local logical height, scaled to fill row 1. */
export const MOL_LOGICAL_H = 268
export const MOL_SCALE = Math.max(1, (ROW1_H - PANEL_PAD) / MOL_LOGICAL_H)
export const MOLECULE_MAG = Math.round(
  (CC_STEP * MOL_SCALE) / CC_BOND_NM / SCENE_PX_PER_NM,
)

/** Row 1's width is shared between the two panels — both stretch, so the row
 *  fills the drawer edge to edge. */
const ROW1_GAP = 16
export const MOLECULE_W = Math.round((CONTENT_W - ROW1_GAP - PANEL_PAD * 2) * 0.46)
export const VES_PANEL_W = CONTENT_W - ROW1_GAP - PANEL_PAD * 2 - MOLECULE_W

export interface LipidPose {
  x: number
  y: number
  /** Rotation of the molecule. 0 = a top-leaflet lipid (head up), π = bottom. */
  angle: number
}

/** Deterministic per-(lipid, key) noise — the lab's only randomness, seeded. */
export function hash01(i: number, k: number): number {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return s - Math.floor(s)
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (u: number): number => {
  const t = clamp01(u)
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u
const lerpAngle = (a: number, b: number, u: number): number => {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * u
}

/** Slot j of `count` in one leaflet, spread edge to edge across the wall —
 *  the same flexing rule drawLipids uses, which is what lets the wall close
 *  over a missing molecule: fewer lipids, same span, slightly wider spacing. */
export function slotX(j: number, count: number): number {
  const spacing = WALL_SPAN / count
  return WALL_FROM + spacing * (j + 0.5)
}

/** Lipid → slot-within-its-leaflet. Identity until drags rearrange the wall. */
export type SlotMap = ReadonlyArray<number>

export const identitySlots = (): number[] =>
  Array.from({ length: LAB_LIPIDS }, (_, i) => (i < PER_LEAFLET ? i : i - PER_LEAFLET))

export function slotPose(i: number, slots?: SlotMap): LipidPose {
  const top = i < PER_LEAFLET
  const j = slots ? slots[i] : top ? i : i - PER_LEAFLET
  return { x: slotX(j, PER_LEAFLET), y: WALL_MID_Y, angle: top ? 0 : Math.PI }
}

/** A released lipid rejoins the wall at the NEAREST place, not its old one —
 *  the shortest path back to the membrane. Pure list-move within its leaflet:
 *  it takes the slot closest to `x`, the members in between shift by one, their
 *  relative order untouched (which is what keeps the reopening ease continuous),
 *  and the other leaflet never moves. */
export function reinsertSlots(slots: SlotMap, i: number, x: number): number[] {
  const spacing = WALL_SPAN / PER_LEAFLET
  const target = Math.min(
    PER_LEAFLET - 1,
    Math.max(0, Math.round((x - WALL_FROM) / spacing - 0.5)),
  )
  const from = slots[i]
  const next = [...slots]
  if (target === from) return next
  const top = i < PER_LEAFLET
  for (let m = top ? 0 : PER_LEAFLET; m < (top ? PER_LEAFLET : LAB_LIPIDS); m++) {
    if (m === i) continue
    const s = next[m]
    if (from < target && s > from && s <= target) next[m] = s - 1
    else if (target < from && s >= target && s < from) next[m] = s + 1
  }
  next[i] = target
  return next
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
/** The scatter bijection's multiplier must be coprime with the (now
 *  viewport-derived) lipid count, or two lipids would share a cell. */
const coprimeTo = (n: number): number => {
  let m = 7
  while (gcd(m, n) !== 1) m += 2
  return m
}
const SCATTER_M = coprimeTo(LAB_LIPIDS)
const SCATTER_COLS = Math.max(6, Math.ceil(LAB_LIPIDS / 6))
const SCATTER_ROWS = Math.ceil(LAB_LIPIDS / SCATTER_COLS)

/** Where lipid i floats when scattered. A jittered grid — a fixed grid with a
 *  per-lipid cell (a seed-shifted bijection, so no two share one) and a
 *  deterministic offset inside it — so the crowd looks thrown, never queued,
 *  and the same seed always throws it the same way. */
export function scatterPose(i: number, seed: number): LipidPose {
  const cell = (i * SCATTER_M + Math.floor(seed) * 13) % LAB_LIPIDS
  const col = cell % SCATTER_COLS
  const row = Math.floor(cell / SCATTER_COLS)
  const M = 20
  const cw = (LAB_W - 2 * M) / SCATTER_COLS
  const ch = (LAB_H - 2 * M) / SCATTER_ROWS
  return {
    x: M + (col + 0.15 + 0.7 * hash01(i, seed + 1)) * cw,
    y: M + (row + 0.15 + 0.7 * hash01(i, seed + 2)) * ch,
    angle: hash01(i, seed + 3) * Math.PI * 2,
  }
}

export type TransitDir = 'settle' | 'scatter'

/** One lipid mid-transport. Staggered starts (settling is a straggle, not a
 *  parade), a sideways swim that is zero at both ends so the endpoints are
 *  exact, and a tumble that dies out on arrival. Pure in (i, ms, seed). */
/** The shared transport core — one choreography for the wall and the vesicle,
 *  so the two panels move as one weather. */
function travel(
  from: LipidPose,
  to: LipidPose,
  i: number,
  msSince: number,
  dir: TransitDir,
  seed: number,
): LipidPose {
  const dur = dir === 'settle' ? SETTLE_MS : SCATTER_MS
  const S = dir === 'settle' ? 0.45 : 0.3
  const t = clamp01(msSince / dur)
  const start = S * hash01(i, seed + 4)
  const u = smooth((t - start) / (1 - S))
  const wob = u * (1 - u)
  const phi = hash01(i, seed + 5) * Math.PI * 2
  return {
    x: lerp(from.x, to.x, u) + Math.cos(phi) * 20 * wob,
    y: lerp(from.y, to.y, u) + Math.sin(phi) * 14 * wob,
    angle:
      lerpAngle(from.angle, to.angle, u) + Math.sin(u * Math.PI * 2 + phi) * 1.2 * wob,
  }
}

export function transitPose(
  i: number,
  msSince: number,
  dir: TransitDir,
  seed: number,
  slots?: SlotMap,
): LipidPose {
  const from = dir === 'settle' ? scatterPose(i, seed) : slotPose(i, slots)
  const to = dir === 'settle' ? slotPose(i, slots) : scatterPose(i, seed)
  return travel(from, to, i, msSince, dir, seed)
}

/** A held molecule cannot be dragged through the wall. That is the science,
 *  not just a guard: pushing a charged head through the oily middle is as
 *  forbidden as pushing an ion through, and a lipid flipping to the other
 *  leaflet is a once-in-hours event in a real membrane. The pointer's y is
 *  clamped to the held lipid's own side, so the wall FEELS solid. */
export function clampHeldY(i: number, y: number): number {
  const top = i < PER_LEAFLET
  return top
    ? Math.min(y, WALL_MID_Y - HALF_MEM - 3)
    : Math.max(y, WALL_MID_Y + HALF_MEM + 3)
}

/** Thermal jiggle, a pure function of the clock and the lipid's identity —
 *  no per-lipid state, nothing to shimmer. Free lipids tumble more than
 *  lipids packed in the wall.
 *
 *  ⚠ ONE OWNER (21c-6): the maths moved into `bilayer`, so the shared paver can
 *  jiggle a wall with the very numbers this lab tumbles a free lipid with. A
 *  second copy is a second copy of every correction ever made to it. */
export const jiggle = lipidJiggle

/** Where lipid i belongs when `held` has been pulled out of the wall: its own
 *  leaflet re-spreads edge to edge over the same span — the wall closes, which
 *  is the drag's whole lesson — and the other leaflet does not move. */
export function wallTargetX(i: number, held: number | null, slots?: SlotMap): number {
  if (held === null || held === i) return slotPose(i, slots).x
  const top = i < PER_LEAFLET
  const heldTop = held < PER_LEAFLET
  if (top !== heldTop) return slotPose(i, slots).x
  const j = slots ? slots[i] : top ? i : i - PER_LEAFLET
  const heldJ = slots ? slots[held] : heldTop ? held : held - PER_LEAFLET
  const shifted = j > heldJ ? j - 1 : j
  return slotX(shifted, PER_LEAFLET - 1)
}

export type LabPhase = 'wall' | 'scattered' | 'settling' | 'scattering'

export interface LabState {
  phase: LabPhase
  /** Clock ms when the current transit began. The run owns its clock. */
  phaseStart: number
  seed: number
  /** Where each lipid sits in the wall. Rearranged by drags (a released lipid
   *  rejoins at the nearest place); reset to identity by a scatter. */
  slots: SlotMap
  /** A lipid held by the pointer, in logical lab coordinates. */
  held: { i: number; x: number; y: number; since: number } | null
  /** A lipid on its way home after release. */
  returning: { i: number; x: number; y: number; at: number } | null
  /** The vesicle's own arrangement and drag state — same grammar, on a ring. */
  vesSlots: SlotMap
  vesHeld: { k: number; x: number; y: number; since: number } | null
  vesReturning: { k: number; x: number; y: number; at: number } | null
}

const CLOSE_MS = 280
const RETURN_MS = 450

/** Every lipid's pose at this moment — the one function the view draws from
 *  and the tests walk. */
export function posesAt(s: LabState, ms: number): LipidPose[] {
  const poses: LipidPose[] = []
  for (let i = 0; i < LAB_LIPIDS; i++) {
    if (s.phase === 'settling' || s.phase === 'scattering') {
      poses.push(
        transitPose(
          i,
          ms - s.phaseStart,
          s.phase === 'settling' ? 'settle' : 'scatter',
          s.seed,
          s.slots,
        ),
      )
      continue
    }
    if (s.phase === 'scattered') {
      const p = scatterPose(i, s.seed)
      const j = jiggle(i, ms, true)
      poses.push({ x: p.x + j.dx, y: p.y + j.dy, angle: p.angle + j.dth })
      continue
    }
    // The wall.
    if (s.held && s.held.i === i) {
      const j = jiggle(i, ms, true)
      poses.push({
        x: s.held.x + j.dx * 0.4,
        y: s.held.y + j.dy * 0.4,
        angle: slotPose(i, s.slots).angle + j.dth * 2,
      })
      continue
    }
    if (s.returning && s.returning.i === i) {
      const u = smooth((ms - s.returning.at) / RETURN_MS)
      const home = slotPose(i, s.slots)
      const j = jiggle(i, ms, u < 1)
      poses.push({
        x: lerp(s.returning.x, home.x, u) + j.dx * (1 - u),
        y: lerp(s.returning.y, home.y, u) + j.dy * (1 - u),
        angle: home.angle + j.dth,
      })
      continue
    }
    // A wall lipid, possibly making room or closing back up.
    const home = slotPose(i, s.slots)
    let x = home.x
    if (s.held) {
      const u = smooth((ms - s.held.since) / CLOSE_MS)
      x = lerp(home.x, wallTargetX(i, s.held.i, s.slots), u)
    } else if (s.returning) {
      const u = smooth((ms - s.returning.at) / CLOSE_MS)
      x = lerp(wallTargetX(i, s.returning.i, s.slots), home.x, u)
    }
    const j = jiggle(i, ms, false)
    poses.push({ x: x + j.dx, y: home.y + j.dy, angle: home.angle + j.dth })
  }
  return poses
}

/** How assembled the wall reads right now, 0→1 — drives the oily core's
 *  presence, since the hydrophobic middle only exists once tails are hidden
 *  together. */
export function coreAlphaAt(s: LabState, ms: number): number {
  if (s.phase === 'wall') return 1
  if (s.phase === 'scattered') return 0
  const t = clamp01(
    (ms - s.phaseStart) / (s.phase === 'settling' ? SETTLE_MS : SCATTER_MS),
  )
  return s.phase === 'settling' ? t * t : (1 - t) * (1 - t)
}

export function transitDone(s: LabState, ms: number): boolean {
  if (s.phase === 'settling') return ms - s.phaseStart >= SETTLE_MS
  if (s.phase === 'scattering') return ms - s.phaseStart >= SCATTER_MS
  return false
}

/** The nearest wall lipid to a pointer, or null if none is within reach.
 *  Only wall-phase lipids are grabbable. */
export function lipidAt(s: LabState, ms: number, x: number, y: number): number | null {
  if (s.phase !== 'wall') return null
  const poses = posesAt(s, ms)
  let best: number | null = null
  let bestD = 14
  for (let i = 0; i < poses.length; i++) {
    const top = i < PER_LEAFLET
    const hy = poses[i].y + (top ? -1 : 1) * (HALF_MEM - HEAD_R)
    const d = Math.hypot(poses[i].x - x, hy - y)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

// ── The vesicle panel ──────────────────────────────────────────────────────
//
// The same molecule's other shape: a bilayer closed into a bag. It assembles
// and scatters with the wall — one press moves both panels — because "these
// are the same molecules" IS the exhibit. Its inside is tinted a soft rose
// (chosen 2026-08-27: a translucent wash, deliberately far from the saturated
// glossy pink that is Ca²⁺'s ball), and the tint only exists once the bag has
// closed: an inside is something a closed membrane MAKES.

/** The vesicle is drawn at the WALL's own magnification — same bilayer, same
 *  scale, same ×N (a bilayer must look the same wherever the scale is the
 *  same). Its panel is big and mostly water; the bag floats small in it. */
export const VES_SCALE = LAB_SCALE
export const VES_MAG = WALL_MAG
export const VES_W = Math.round(VES_PANEL_W / VES_SCALE)
export const VES_H = Math.round((ROW1_H - PANEL_PAD) / VES_SCALE)
/** The bag's membrane-middle radius. Chosen (a bubble this size keeps its
 *  molecules countable), with the ring COUNTS derived from it — the other way
 *  round, tightening the packing to its real value collapsed the bag. */
export const VES_R_MID = 27
/** Each leaflet carries as many molecules as fit at the real spacing on its
 *  own circumference — the outer one is bigger, so it holds more. */
export const VES_OUT = Math.round(
  (2 * Math.PI * (VES_R_MID + HALF_MEM - HEAD_R)) / HEAD_GAP,
)
export const VES_IN = Math.round(
  (2 * Math.PI * (VES_R_MID - HALF_MEM + HEAD_R)) / HEAD_GAP,
)
export const VES_LIPIDS = VES_OUT + VES_IN
const VES_CX = VES_W / 2
const VES_CY = VES_H / 2
/** The drawn bag's outer diameter in nm — well under the ~40 nm of the
 *  smallest real vesicles, so the molecules stay countable. Declared. */
export const VES_NM = Math.round((2 * (VES_R_MID + HALF_MEM)) / PX_PER_NM)

const vesTheta = (j: number, n: number, outer: boolean): number =>
  (Math.PI * 2 * (j + (outer ? 0 : 0.5))) / n - Math.PI / 2

export const identityVesSlots = (): number[] =>
  Array.from({ length: VES_LIPIDS }, (_, k) => (k < VES_OUT ? k : k - VES_OUT))

export function vesSlotPose(k: number, slots?: SlotMap): LipidPose {
  const outer = k < VES_OUT
  const n = outer ? VES_OUT : VES_IN
  const j = slots ? slots[k] : outer ? k : k - VES_OUT
  const theta = vesTheta(j, n, outer)
  return {
    x: VES_CX + VES_R_MID * Math.cos(theta),
    y: VES_CY + VES_R_MID * Math.sin(theta),
    // Outer heads face outward, inner heads face the lumen — every head wet.
    angle: theta + (outer ? Math.PI / 2 : -Math.PI / 2),
  }
}

/** Where lipid k belongs while `held` is out of the ring: its own leaflet
 *  re-spreads evenly round the full circle — the bag closes — and the other
 *  leaflet does not move. */
export function vesTargetPose(
  k: number,
  held: number | null,
  slots?: SlotMap,
): LipidPose {
  const outer = k < VES_OUT
  if (held === null || held === k || outer !== held < VES_OUT)
    return vesSlotPose(k, slots)
  const n = outer ? VES_OUT : VES_IN
  const j = slots ? slots[k] : outer ? k : k - VES_OUT
  const heldJ = slots ? slots[held] : held < VES_OUT ? held : held - VES_OUT
  const rank = j > heldJ ? j - 1 : j
  const theta = vesTheta(rank, n - 1, outer)
  return {
    x: VES_CX + VES_R_MID * Math.cos(theta),
    y: VES_CY + VES_R_MID * Math.sin(theta),
    angle: theta + (outer ? Math.PI / 2 : -Math.PI / 2),
  }
}

/** A released vesicle lipid rejoins the ring at the NEAREST place — the same
 *  shortest-path rule as the wall, on a circle. */
export function vesReinsertSlots(
  slots: SlotMap,
  k: number,
  x: number,
  y: number,
): number[] {
  const outer = k < VES_OUT
  const n = outer ? VES_OUT : VES_IN
  const phi = Math.atan2(y - VES_CY, x - VES_CX)
  let target = Math.round(((phi + Math.PI / 2) / (Math.PI * 2)) * n - (outer ? 0 : 0.5))
  target = ((target % n) + n) % n
  const from = slots[k]
  const next = [...slots]
  if (target === from) return next
  const lo = outer ? 0 : VES_OUT
  const hi = outer ? VES_OUT : VES_LIPIDS
  for (let m = lo; m < hi; m++) {
    if (m === k) continue
    const s = next[m]
    if (from < target && s > from && s <= target) next[m] = s - 1
    else if (target < from && s >= target && s < from) next[m] = s + 1
  }
  next[k] = target
  return next
}

/** A held vesicle lipid cannot cross the bag's wall, for the same reason as
 *  at the flat wall — a charged head cannot be pushed through oil, and a flip
 *  to the other leaflet is a job for special enzymes. So an outer molecule
 *  stays outside the ring, and an inner one is genuinely TRAPPED in the
 *  lumen — which is the finding. */
export function clampVesHeld(k: number, x: number, y: number): { x: number; y: number } {
  const outer = k < VES_OUT
  let dx = x - VES_CX
  let dy = y - VES_CY
  const r = Math.hypot(dx, dy)
  if (r < 0.001) {
    dx = 0
    dy = -1
  }
  const unit = r < 0.001 ? 1 : r
  if (outer) {
    const min = VES_R_MID + HALF_MEM + 2
    if (r < min) {
      x = VES_CX + (dx / unit) * min
      y = VES_CY + (dy / unit) * min
    }
    return {
      x: Math.min(VES_W - 8, Math.max(8, x)),
      y: Math.min(VES_H - 8, Math.max(8, y)),
    }
  }
  const max = VES_R_MID - HALF_MEM - 2
  if (r > max) {
    x = VES_CX + (dx / unit) * max
    y = VES_CY + (dy / unit) * max
  }
  return { x, y }
}

/** The nearest grabbable vesicle head, or null. Wall phase only. */
export function vesLipidAt(s: LabState, ms: number, x: number, y: number): number | null {
  if (s.phase !== 'wall') return null
  const poses = vesPosesAt(s, ms)
  const off = HALF_MEM - HEAD_R
  let best: number | null = null
  let bestD = 14
  for (let k = 0; k < poses.length; k++) {
    const hx = poses[k].x + Math.sin(poses[k].angle) * off
    const hy = poses[k].y - Math.cos(poses[k].angle) * off
    const d = Math.hypot(hx - x, hy - y)
    if (d < bestD) {
      bestD = d
      best = k
    }
  }
  return best
}

export function vesScatterPose(k: number, seed: number): LipidPose {
  const COLS = 6
  const ROWS = 5
  const cell = (k * 7 + Math.floor(seed) * 11) % VES_LIPIDS
  const col = cell % COLS
  const row = Math.floor(cell / COLS)
  const M = 10
  const cw = (VES_W - 2 * M) / COLS
  const ch = (VES_H - 2 * M) / ROWS
  return {
    x: M + (col + 0.15 + 0.7 * hash01(k + 200, seed + 1)) * cw,
    y: M + (row + 0.15 + 0.7 * hash01(k + 200, seed + 2)) * ch,
    angle: hash01(k + 200, seed + 3) * Math.PI * 2,
  }
}

/** The radial orientation a lipid keeps while carried around the bag. */
const vesHeldAngle = (k: number, x: number, y: number): number =>
  Math.atan2(y - VES_CY, x - VES_CX) + (k < VES_OUT ? Math.PI / 2 : -Math.PI / 2)

/** Every vesicle lipid's pose — driven by the same phase and clock as the
 *  wall, offset in identity space so its stagger and jiggle are its own.
 *  Dragging mirrors the wall exactly: the ring makes room in CLOSE_MS, a
 *  released molecule swims to the nearest place in RETURN_MS. */
export function vesPosesAt(s: LabState, ms: number): LipidPose[] {
  const poses: LipidPose[] = []
  for (let k = 0; k < VES_LIPIDS; k++) {
    if (s.phase === 'settling' || s.phase === 'scattering') {
      const dir: TransitDir = s.phase === 'settling' ? 'settle' : 'scatter'
      const from =
        dir === 'settle' ? vesScatterPose(k, s.seed) : vesSlotPose(k, s.vesSlots)
      const to = dir === 'settle' ? vesSlotPose(k, s.vesSlots) : vesScatterPose(k, s.seed)
      poses.push(travel(from, to, k + 100, ms - s.phaseStart, dir, s.seed))
      continue
    }
    if (s.phase === 'scattered') {
      const p = vesScatterPose(k, s.seed)
      const j = jiggle(k + 100, ms, true)
      poses.push({ x: p.x + j.dx, y: p.y + j.dy, angle: p.angle + j.dth })
      continue
    }
    // The standing bag.
    if (s.vesHeld && s.vesHeld.k === k) {
      const j = jiggle(k + 100, ms, true)
      poses.push({
        x: s.vesHeld.x + j.dx * 0.4,
        y: s.vesHeld.y + j.dy * 0.4,
        angle: vesHeldAngle(k, s.vesHeld.x, s.vesHeld.y) + j.dth * 2,
      })
      continue
    }
    if (s.vesReturning && s.vesReturning.k === k) {
      const u = smooth((ms - s.vesReturning.at) / RETURN_MS)
      const home = vesSlotPose(k, s.vesSlots)
      const j = jiggle(k + 100, ms, u < 1)
      poses.push({
        x: lerp(s.vesReturning.x, home.x, u) + j.dx * (1 - u),
        y: lerp(s.vesReturning.y, home.y, u) + j.dy * (1 - u),
        angle:
          lerpAngle(vesHeldAngle(k, s.vesReturning.x, s.vesReturning.y), home.angle, u) +
          j.dth,
      })
      continue
    }
    const home = vesSlotPose(k, s.vesSlots)
    let p = home
    if (s.vesHeld) {
      const u = smooth((ms - s.vesHeld.since) / CLOSE_MS)
      const t = vesTargetPose(k, s.vesHeld.k, s.vesSlots)
      p = {
        x: lerp(home.x, t.x, u),
        y: lerp(home.y, t.y, u),
        angle: lerpAngle(home.angle, t.angle, u),
      }
    } else if (s.vesReturning) {
      const u = smooth((ms - s.vesReturning.at) / CLOSE_MS)
      const t = vesTargetPose(k, s.vesReturning.k, s.vesSlots)
      p = {
        x: lerp(t.x, home.x, u),
        y: lerp(t.y, home.y, u),
        angle: lerpAngle(t.angle, home.angle, u),
      }
    }
    const j = jiggle(k + 100, ms, false)
    poses.push({ x: p.x + j.dx, y: p.y + j.dy, angle: p.angle + j.dth })
  }
  return poses
}

// ── Drawing ────────────────────────────────────────────────────────────────

const WATER = 'rgba(96, 165, 250, 0.05)'
const RING = '#f59e0b'
const LABEL = '#cbd5e1'
const KINK = 1.6

// Speakable names (F04) live in stage/spokenLabels.ts, shared with every
// exhibit that names things on a canvas. Re-exported so this scene's callers
// keep one import site.
export { spokenTermAt, type SpokenLabel } from './spokenLabels'

/** The tank's speakable names, in CSS px of the tank canvas. */
export const tankLabels = (): SpokenLabel[] => [
  spoken('bilayer', 28, LAB_H * LAB_SCALE - 12),
]

/** The vesicle panel's speakable names. */
export const vesicleLabels = (): SpokenLabel[] => [
  spoken('vesicle', 28, VES_H * VES_SCALE - 12),
]

/** The water box: faint water, the oily middle once it exists, and every
 *  lipid wherever its pose puts it — the held one drawn last, on top. */
export function drawLab(
  ctx: CanvasRenderingContext2D,
  s: LabState,
  ms: number,
  labelsOn = true,
): void {
  ctx.save()
  ctx.scale(LAB_SCALE, LAB_SCALE)
  ctx.fillStyle = WATER
  ctx.fillRect(0, 0, LAB_W, LAB_H)

  const core = coreAlphaAt(s, ms)
  if (core > 0.02) {
    ctx.save()
    ctx.globalAlpha *= core
    ctx.fillStyle = OILY_CORE
    ctx.fillRect(WALL_FROM, WALL_MID_Y - TAIL_LEN, WALL_SPAN, TAIL_LEN * 2)
    ctx.restore()
  }

  const poses = posesAt(s, ms)
  const order = [...poses.keys()]
  if (s.held) order.push(order.splice(order.indexOf(s.held.i), 1)[0])
  for (const i of order) {
    const p = poses[i]
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.angle)
    drawLipid(ctx, 0, 0, -1, 0, KINK)
    ctx.restore()
  }

  // (The wall used to carry an amber marker on one lipid, pointing at the
  //  molecule panel. Removed 2026-08-27 at the user's request: the relation
  //  is already carried inside the molecule panel itself — the corner
  //  schematic joined to the atomic frame — and a second marker out here
  //  competed with the exhibit.)
  ctx.restore()

  // The declared magnification, screen-space, in the corner — the same
  // grammar as every zoomed view — and the wall's own speakable name.
  ctx.fillStyle = LABEL
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`×${WALL_MAG.toLocaleString('en-US')}`, LAB_W * LAB_SCALE - 8, 16)
  // ⚠ Gated by the app's one 🏷 switch (user, 2026-09-04: unify labels
  // "everywhere"). Readings on a scale are never hidden by it — a graph
  // without its axis is not a simpler graph — only NAMES.
  if (labelsOn) for (const l of tankLabels()) drawSpoken(ctx, l)
}

const ROSE = '244, 171, 189'

/** The vesicle tank: same water, same molecules, the closed shape. */
export function drawVesicle(
  ctx: CanvasRenderingContext2D,
  s: LabState,
  ms: number,
  labelsOn = true,
): void {
  ctx.save()
  ctx.scale(VES_SCALE, VES_SCALE)
  ctx.fillStyle = WATER
  ctx.fillRect(0, 0, VES_W, VES_H)

  const core = coreAlphaAt(s, ms)
  if (core > 0.02) {
    // The bag's own inside — it exists exactly as much as the bag does. The
    // rose fades toward the wall rather than ending in a hard rim: a tint of
    // a space, not a painted disc.
    const rl = Math.max(1, VES_R_MID - HALF_MEM + 2)
    const lumen = ctx.createRadialGradient(VES_CX, VES_CY, 0, VES_CX, VES_CY, rl)
    lumen.addColorStop(0, `rgba(${ROSE}, ${0.3 * core})`)
    lumen.addColorStop(0.62, `rgba(${ROSE}, ${0.22 * core})`)
    lumen.addColorStop(1, `rgba(${ROSE}, 0)`)
    ctx.fillStyle = lumen
    ctx.beginPath()
    ctx.arc(VES_CX, VES_CY, rl, 0, Math.PI * 2)
    ctx.fill()
    // The oily middle, as a ring under the molecules.
    ctx.save()
    ctx.globalAlpha *= core
    ctx.strokeStyle = OILY_CORE
    ctx.lineWidth = TAIL_LEN * 2
    ctx.beginPath()
    ctx.arc(VES_CX, VES_CY, VES_R_MID, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  const poses = vesPosesAt(s, ms)
  const order = [...poses.keys()]
  if (s.vesHeld) order.push(order.splice(order.indexOf(s.vesHeld.k), 1)[0])
  for (const k of order) {
    const p = poses[k]
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.angle)
    drawLipid(ctx, 0, 0, -1, 0, KINK)
    ctx.restore()
  }
  ctx.restore()

  ctx.fillStyle = LABEL
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`×${VES_MAG.toLocaleString('en-US')}`, VES_W * VES_SCALE - 8, 16)
  if (labelsOn) for (const l of vesicleLabels()) drawSpoken(ctx, l)
}

/** CSS height of the molecule panel's canvas (its width is set with the row
 *  split above; the molecule centres itself in whatever width it gets). */
export const MOLECULE_H = Math.round(MOL_LOGICAL_H * MOL_SCALE)

// ── The molecule, atom by atom ─────────────────────────────────────────────
//
// The panel's star is a SPACE-FILLING model: every atom a glossy sphere,
// overlapping where bonds are — a molecule really is a crowd of overlapping
// atoms, not balls on rods (a ball-and-stick handover was set aside with the
// user, 2026-08-27). The wall's schematic lipid sits in the panel's corner
// under an amber ring, and the realistic view is magnified out of it — the
// ghost-and-locator grammar, one level further down. This is the bridge to
// the Atomic Playground: the shapes a kid met there were made of atoms, and
// so is this one.
//
// Element identity is carried the way the bonding lab carries it — by SIZE
// and by name (describer + voice terms), never by the reserved inks. The
// colours are a muted earth family of this exhibit's own, deliberately
// quieter than the glossy saturated ion balls: no red, no blue — those mean
// charge, and the real charges here wear them (the + at choline, the − at
// the phosphate).

export type ElementK = 'C' | 'H' | 'O' | 'N' | 'P'

/** Van-der-Waals-ish size ratios: H 0.45, O/N 1.05, P 1.25 of carbon. */
export const ELEMENT_R: Record<ElementK, number> = {
  C: 6.5,
  H: 3,
  O: 6.8,
  N: 6.8,
  P: 8.1,
}

export const ELEMENT_COLOR: Record<ElementK, string> = {
  C: '#6b7688', // graphite — the same grey family as the schematic tails
  H: '#ddd6c9', // ivory
  O: '#c9a15a', // ochre
  N: '#93a06b', // olive
  P: '#b4714f', // terracotta
}

/** Real tails run 16 and 18 carbons; fewer are drawn, declared, so each atom
 *  stays visible — the same countability trade the ion piles make. */
export const TAIL_C_REAL: readonly [number, number] = [16, 18]
export const TAIL_C_DRAWN: readonly [number, number] = [9, 10]

export interface MoleculeAtom {
  k: ElementK
  x: number
  y: number
}

export interface Phospholipid {
  /** Heavy atoms in draw order, top of the molecule first. */
  heavy: MoleculeAtom[]
  /** Hydrogens — drawn first, so they peek out from behind the chain. */
  hydrogens: MoleculeAtom[]
  /** The cis double-bond joint on the unsaturated tail: the kink. */
  kink: { x: number; y: number }
  nitrogen: { x: number; y: number }
  /** The phosphate oxygen that carries the minus. */
  oMinus: { x: number; y: number }
  leftTailEnd: { x: number; y: number }
}

/** The whole truncated phosphatidylcholine, laid out in molecule-local
 *  coordinates (origin at the choline nitrogen, +y downward). Pure and
 *  deterministic, so tests can count it and measure the kink. */
export function buildPhospholipid(): Phospholipid {
  const heavy: MoleculeAtom[] = []
  const hydrogens: MoleculeAtom[] = []
  const C = (x: number, y: number) => heavy.push({ k: 'C', x, y })
  const O = (x: number, y: number) => heavy.push({ k: 'O', x, y })
  const H = (x: number, y: number) => hydrogens.push({ k: 'H', x, y })

  // Choline: a nitrogen bonded to four carbons — three methyls, each dressed
  // in three hydrogens, and the bridge running down to the phosphate.
  const nitrogen = { x: 0, y: 0 }
  heavy.push({ k: 'N', ...nitrogen })
  for (const [mx, my] of [
    [-11, -6],
    [11, -6],
    [0, -13],
  ] as const) {
    C(mx, my)
    const away = Math.atan2(my, mx)
    for (const d of [-0.75, 0, 0.75]) {
      H(mx + Math.cos(away + d) * 6.4, my + Math.sin(away + d) * 6.4)
    }
  }
  C(7, 9)
  H(13.5, 7)
  H(3, 14.5)
  C(1, 19)
  H(-5.5, 17)
  H(7, 23.5)
  O(-1, 29)

  // Phosphate: phosphorus in its tetrahedron of oxygens — one up to choline,
  // one down to glycerol, two out to the sides; one side oxygen is the minus.
  heavy.push({ k: 'P', x: 1, y: 40 })
  const oMinus = { x: -11, y: 37 }
  O(oMinus.x, oMinus.y)
  O(13, 43)
  O(1, 52)

  // Glycerol: the three-carbon bridge.
  C(-2, 62)
  H(5, 60)
  C(-9, 70)
  H(-16, 68)
  C(-6, 80)
  H(1, 83)

  // Two ester links — each an oxygen and a carbonyl carbon with its own
  // double-bonded oxygen — where the tails are bolted on.
  O(-20, 86)
  C(-24, 96)
  O(-33, 92)
  O(8, 84)
  C(14, 94)
  O(23, 89)

  // A tail: zigzag carbons, two hydrogens flanking each, an extra hydrogen
  // capping the terminal methyl. `kinkAfter` bends the chain at a cis double
  // bond — the joint the schematic draws as the kink.
  const tail = (
    x0: number,
    y0: number,
    count: number,
    dir: { dx: number; dy: number },
    kinkAfter: number | null,
    kinkDir: { dx: number; dy: number },
  ) => {
    let x = x0
    let y = y0
    let d = dir
    let kink: { x: number; y: number } | null = null
    for (let i = 0; i < count; i++) {
      if (kinkAfter !== null && i === kinkAfter) {
        d = kinkDir
        kink = { x, y }
      }
      const len = Math.hypot(d.dx, d.dy)
      const px = -d.dy / len
      const py = d.dx / len
      const zig = i % 2 === 0 ? -2.6 : 2.6
      const cx = x + px * zig
      const cy = y + py * zig
      C(cx, cy)
      H(cx + px * 6.2, cy + py * 6.2)
      H(cx - px * 6.2, cy - py * 6.2)
      if (i === count - 1) H(cx + (d.dx / len) * 6.2, cy + (d.dy / len) * 6.2)
      x += d.dx
      y += d.dy
    }
    return { end: { x, y }, kink }
  }

  // sn-1 (left): saturated, straight-ish, leaning left.
  const left = tail(-26, 106, TAIL_C_DRAWN[0], { dx: -2.0, dy: 9.3 }, null, {
    dx: 0,
    dy: 0,
  })
  // sn-2 (right): unsaturated — four carbons down, then the cis bend.
  const right = tail(16, 104, TAIL_C_DRAWN[1], { dx: 2.0, dy: 9.3 }, 4, {
    dx: 6.6,
    dy: 6.9,
  })

  return {
    heavy,
    hydrogens,
    kink: right.kink!,
    nitrogen,
    oMinus,
    leftTailEnd: left.end,
  }
}

const MOLECULE = buildPhospholipid()
/** Exposed so a test can check the head circle really holds the head. */
export const MOLECULE_ATOMS = MOLECULE
/** Where the molecule's local origin sits in the panel's LOGICAL frame —
 *  horizontally centred in whatever width the row split gave the panel (the
 *  molecule's own extent runs about −56…+78 around its origin). */
const MOL_OX = Math.round(MOLECULE_W / MOL_SCALE / 2 - 11)
const MOL_OY = 40
/** A molecule-local coordinate, in the panel's CSS px. */
const P = (v: number) => v * MOL_SCALE

/** The amber frame around the atomic view — the relation-marker rectangle the
 *  corner inset connects to. */
export const MOL_FRAME = {
  x: P(MOL_OX - 58),
  y: P(MOL_OY - 26),
  w: P(129),
  h: P(224),
}

/** The corner inset: the wall's own schematic lipid, at a FIXED small size so
 *  it always reads as the familiar one from the tanks. */
const INSET_W = 56
const INSET_H = 78
const INSET = {
  x: MOLECULE_W - INSET_W - 4,
  y: MOLECULE_H - INSET_H - 6,
  w: INSET_W,
  h: INSET_H,
}

/** The molecule panel's speakable names, with their leader targets. */
export function moleculeLabels(): Array<SpokenLabel & { tx?: number; ty?: number }> {
  const kxs = P(MOL_OX + MOLECULE.kink.x)
  const kys = P(MOL_OY + MOLECULE.kink.y)
  const tex = P(MOL_OX + MOLECULE.leftTailEnd.x)
  const tey = P(MOL_OY + MOLECULE.leftTailEnd.y)
  return [
    spoken('phospholipid', MOL_FRAME.x + 18, Math.max(16, MOL_FRAME.y - 6)),
    {
      ...spoken('choline', P(MOL_OX + 40) + 14, P(MOL_OY - 12)),
      tx: P(MOL_OX + 15),
      ty: P(MOL_OY - 8),
    },
    {
      ...spoken('phosphate', P(MOL_OX + 42) + 14, P(MOL_OY + 44)),
      tx: P(MOL_OX + 22),
      ty: P(MOL_OY + 43),
    },
    {
      ...spoken('glycerol', P(MOL_OX - 44) - 14, P(MOL_OY + 62), 'right'),
      tx: P(MOL_OX - 12),
      ty: P(MOL_OY + 66),
    },
    { ...spoken('kink', kxs + 42, kys + 4), tx: kxs + 10, ty: kys },
    { ...spoken('fatty-acid tails', tex + 16, tey + 26), tx: tex + 4, ty: tey + 8 },
  ]
}

/** THE HEAD'S OWN CIRCLE, computed from the atoms that make it (2026-08-28,
 *  the user's suggestion, and a good one).
 *
 *  The schematic lipid this app draws everywhere is a circle and two tails.
 *  Blown up to atoms, the circle disappears into a crowd of spheres, and the
 *  child is left to work out on their own which part of the crowd the circle
 *  WAS. This puts it back: a soft disc, in the schematic head's own colour,
 *  sitting behind exactly the atoms the circle stands for — choline and
 *  phosphate, down to the oxygen that hands over to glycerol.
 *
 *  Deliberately in the HEAD'S colour rather than a neutral grey, and
 *  deliberately without a hard edge. This app has just taught a coat of water
 *  round an ion, and a crisp ring of some substance round a head would be
 *  read as more of the same. This is not a substance — it is the schematic
 *  shape, laid over the thing it is a schematic OF.
 *
 *  Derived, never a typed-in radius: it is the smallest circle that holds the
 *  head's atoms, so it follows the molecule if the molecule ever changes. */
export function headCircle(): { x: number; y: number; r: number } {
  const HEAD_BELOW = 56
  const atoms = [
    ...MOLECULE.heavy
      .filter((a) => a.y <= HEAD_BELOW)
      .map((a) => ({ ...a, r: ELEMENT_R[a.k] })),
    ...MOLECULE.hydrogens
      .filter((a) => a.y <= HEAD_BELOW)
      .map((a) => ({ ...a, r: ELEMENT_R.H })),
  ]
  const xs = atoms.map((a) => a.x)
  const ys = atoms.map((a) => a.y)
  const x = (Math.min(...xs) + Math.max(...xs)) / 2
  const y = (Math.min(...ys) + Math.max(...ys)) / 2
  const r = Math.max(...atoms.map((a) => Math.hypot(a.x - x, a.y - y) + a.r))
  return { x, y, r }
}

/** One molecule of the wall, atoms and all, gently vibrating. Names and
 *  leader lines only — every sentence is in the describer. */
export function drawMolecule(
  ctx: CanvasRenderingContext2D,
  ms: number,
  labelsOn = true,
): void {
  const sphere = (x: number, y: number, r: number, base: string) =>
    glossySphere(ctx, x, y, r, base)

  // Thermal vibration: the whole molecule sways a hair and every atom adds a
  // sub-pixel tremble — alive, not drafted, but never boiling. Pure in the
  // clock and each atom's index.
  const sway = 0.012 * Math.sin(ms * 0.0009)
  ctx.save()
  ctx.scale(MOL_SCALE, MOL_SCALE)
  ctx.translate(MOL_OX, MOL_OY + 80)
  ctx.rotate(sway)
  ctx.translate(0, -80)
  const tremble = (i: number) => ({
    dx: 0.35 * Math.sin(ms * 0.0021 + i * 2.399),
    dy: 0.35 * Math.sin(ms * 0.0017 + i * 1.731),
  })
  // The schematic head's circle, behind the atoms it stands for.
  {
    const h = headCircle()
    const g = ctx.createRadialGradient(h.x, h.y, h.r * 0.2, h.x, h.y, h.r * 1.16)
    g.addColorStop(0, 'rgba(148, 163, 184, 0.3)')
    g.addColorStop(0.68, 'rgba(148, 163, 184, 0.22)')
    g.addColorStop(1, 'rgba(148, 163, 184, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(h.x, h.y, h.r * 1.16, 0, Math.PI * 2)
    ctx.fill()
  }

  MOLECULE.hydrogens.forEach((a, i) => {
    const t = tremble(i + 500)
    sphere(a.x + t.dx, a.y + t.dy, ELEMENT_R.H, ELEMENT_COLOR.H)
  })
  MOLECULE.heavy.forEach((a, i) => {
    const t = tremble(i)
    sphere(a.x + t.dx, a.y + t.dy, ELEMENT_R[a.k], ELEMENT_COLOR[a.k])
  })
  ctx.restore()

  // The atomic view's own amber frame — the big half of the relation the
  // corner inset's frame connects to.
  ctx.strokeStyle = RING
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  ctx.roundRect(MOL_FRAME.x, MOL_FRAME.y, MOL_FRAME.w, MOL_FRAME.h, 10)
  ctx.stroke()
  ctx.setLineDash([])

  // The locator: the wall's own schematic lipid in the corner, in its own
  // rounded amber frame, with WIDE dashed lines running to the big frame —
  // so THAT shape and THIS crowd of atoms are unmistakably one molecule.
  ctx.save()
  ctx.translate(INSET.x + INSET.w / 2, INSET.y + INSET.h - 12)
  ctx.scale(2, 2)
  drawLipid(ctx, 0, 0, -1, 0, KINK)
  ctx.restore()
  ctx.strokeStyle = RING
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  ctx.roundRect(INSET.x, INSET.y, INSET.w, INSET.h, 8)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)'
  ctx.lineWidth = 2.5
  ctx.setLineDash([7, 6])
  ctx.beginPath()
  ctx.moveTo(INSET.x, INSET.y + 8)
  ctx.lineTo(MOL_FRAME.x + MOL_FRAME.w, MOL_FRAME.y + MOL_FRAME.h * 0.3)
  ctx.moveTo(INSET.x, INSET.y + INSET.h - 8)
  ctx.lineTo(MOL_FRAME.x + MOL_FRAME.w, MOL_FRAME.y + MOL_FRAME.h - 12)
  ctx.stroke()
  ctx.setLineDash([])

  // The real charges, in the two colours charge always wears.
  const nx = P(MOL_OX + MOLECULE.nitrogen.x)
  const ny = P(MOL_OY + MOLECULE.nitrogen.y)
  const mx = P(MOL_OX + MOLECULE.oMinus.x)
  const my = P(MOL_OY + MOLECULE.oMinus.y)
  ctx.lineCap = 'round'
  ctx.lineWidth = 2
  ctx.strokeStyle = '#ef4444'
  ctx.beginPath()
  ctx.moveTo(nx - 22, ny - 12)
  ctx.lineTo(nx - 14, ny - 12)
  ctx.moveTo(nx - 18, ny - 16)
  ctx.lineTo(nx - 18, ny - 8)
  ctx.stroke()
  ctx.strokeStyle = '#38bdf8'
  ctx.beginPath()
  ctx.moveTo(mx - 17, my - 3)
  ctx.lineTo(mx - 9, my - 3)
  ctx.stroke()

  // Names, each with its voice glyph; leaders to their parts — the app's one
  // leader idiom (2026-09-04), which leaves the label's box centre rather
  // than its ink edge.
  if (labelsOn) {
    for (const l of moleculeLabels()) {
      if (l.tx !== undefined && l.ty !== undefined) {
        drawConnector(ctx, l, { x: l.tx, y: l.ty })
      }
      drawSpoken(ctx, l)
    }
  }

  ctx.fillStyle = LABEL
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`×${MOLECULE_MAG.toLocaleString('en-US')}`, MOLECULE_W - 8, 16)
}

// ── Words ──────────────────────────────────────────────────────────────────

/** The live line, by phase. Read in the describer's "Right now". */
export function labRightNow(phase: LabPhase, holding: boolean): TeachingPara[] {
  if (holding)
    return [
      {
        icon: '🖐️',
        text: 'You are holding one molecule out of its membrane — and look: the others have already flowed together behind it. A membrane is a liquid; it has no holes to leave. Let go and the molecule dives back in, at the nearest place.',
      },
    ]
  switch (phase) {
    case 'wall':
      return [
        {
          icon: '🧱',
          text: 'The wall is standing: two layers of molecules, every charged head facing water, every oily tail hidden in the middle. And in the small tank, the SAME molecules have closed into a bubble — a bag with its own inside. Try dragging a molecule out of the wall, or scatter everything and watch both come back.',
        },
      ]
    case 'scattered':
      return [
        {
          icon: '💧',
          text: `${LAB_LIPIDS + VES_LIPIDS} phospholipids adrift in two tanks of water, oily tails exposed on every side. Water molecules batter everything, all the time — and an arrangement that leaves oil touching water does not survive the battering for long.`,
        },
      ]
    case 'settling':
      return [
        {
          icon: '🌊',
          text: 'No glue, and no plan: each molecule is only being jostled. But every jostle that hides a tail sticks, and every one that exposes a tail gets undone — so the crowds drift into the arrangements with no oil left touching water: a flat wall in one tank, a closed bubble in the other. Same molecule, two shapes.',
        },
      ]
    case 'scattering':
      return [
        {
          icon: '💨',
          text: 'Torn apart — which costs energy; your press paid it. Watch what the water does with the pieces.',
        },
      ]
  }
}

/** The terms this view says aloud (F04) — spoken from the canvas labels
 *  themselves (an amber 🔊 glyph before each name; tap it), because a kid
 *  cannot relate a side-panel word list to the picture. */
export const LIPID_TERMS = [
  'phospholipid',
  'choline',
  'phosphate',
  'glycerol',
  'kink',
  'fatty-acid tails',
  'bilayer',
  'vesicle',
] as const

/** The molecule, named. Real names, kid sentences. */
export const LIPID_MOLECULE_FACTS: TeachingPara[] = [
  {
    icon: '🔵',
    text: 'The round part is the PHOSPHATE HEAD. It carries charge — a minus on the phosphate, a plus right beside it — and water clings to charge, so the head is happiest wet.',
  },
  {
    icon: '〰️',
    text: 'The two legs are FATTY-ACID TAILS: chains of oil. Oil and water refuse to mix, so the tails are happiest hidden from water — one molecule with a wet-loving end and a wet-hating end, and the whole membrane follows from that one fact.',
  },
  {
    icon: '📐',
    text: 'One tail has a KINK — a bend at a double bond that the molecule cannot straighten. Kinked neighbours cannot pack into a solid, and that is a big part of why the wall stays a liquid instead of freezing into a shell.',
  },
  {
    icon: '⚛️',
    text: 'Zoomed all the way in, the molecule is ATOMS — the same atoms as in the atom playground. The tails are chains of grey CARBON dressed in small ivory HYDROGENS; the head holds ochre OXYGENS around one terracotta PHOSPHORUS, and the top carries one olive NITROGEN with its three carbon arms. The kink is where two carbons share a stiff DOUBLE BOND — the chain cannot swivel there, so it stays bent.',
  },
  {
    icon: '🔁',
    text: "Try pulling a molecule from the bubble's INNER layer: you can slide it around the inside, but it cannot leave the bag — getting out would mean dragging its charged head through the oily middle. Real membranes move a molecule between their two layers only rarely, and cells keep special enzymes just to do it on purpose.",
  },
]

/** Honesty notes. Each one declares a simplification beside the real number. */
export const LIPID_HONESTY: TeachingPara[] = [
  {
    icon: '⏱️',
    text: 'The settling here is choreographed and hugely sped up so it can be watched: each molecule swims straight to its place. Real assembly is chaotic — molecules join, leave and rejoin — but it ends in the same wall, for the same reason.',
  },
  {
    icon: '🫧',
    text: `A flat sheet has edges, and an edge exposes tails — so a small patch curls up and closes. That is the bubble in the small tank: a vesicle, a bag of this same wall with its own sealed inside (the rose space — nothing gets in or out except through the wall). A cell is exactly such a bag, and so is every vesicle inside one. The bubble is drawn about ${VES_NM} nm across so its molecules stay countable; the smallest real vesicles are ~40 nm. The big wall runs off both edges of its tank because a real one keeps going — the frame is a window, not the wall's ends.`,
  },
  {
    icon: '🧀',
    text: 'A real membrane is not pure lipid: cholesterol molecules sit between the tails, and proteins — the pumps and channels this app builds elsewhere — stud the whole wall. This bench shows the lipids alone, because they are what the wall itself is.',
  },
  {
    icon: '✂️',
    text: `The tails in the atom view are drawn short on purpose: real fatty-acid tails run ${TAIL_C_REAL[0]} and ${TAIL_C_REAL[1]} carbons; ${TAIL_C_DRAWN[0]} and ${TAIL_C_DRAWN[1]} are drawn so each atom stays visible — the same trade the ion piles make.`,
  },
  {
    icon: '📏',
    text: `Real sizes: one phospholipid is about 2 nm across and the finished wall 5 nm thin. The wall here is drawn about ×${WALL_MAG.toLocaleString('en-US')} the scene's size, and the single molecule about ×${MOLECULE_MAG.toLocaleString('en-US')} — a scale set by giving the real ${CC_BOND_NM} nm carbon–carbon bond ${CC_STEP} px.`,
  },
]
