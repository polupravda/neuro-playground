import { lipidSpacing, paveMembrane, type LipidGeom } from './bilayer'
import {
  LIPID,
  LUMEN,
  OUTSIDE,
  fusedCentreFor,
  omegaRing,
  snareGeometry,
  wallPointsMany,
  wallShiftFor,
  type SnareGeometry,
} from './snareScene'
import { transmitterDot } from './synapseScene'
import { drawGlossyIon, GLOSSY_COLORS } from './particleStyle'
import { drawLigandChannel, ligandHalfWidth } from './ligandChannel'
import { SIGNAL_CORE, SIGNAL_RGB, softGlow } from './signal'
import { hash01 } from '../core/noise'
import { SINK_TOUCH } from '../core/vesicleCycle'
import {
  CARGO_MS,
  DOCKED_SLOTS,
  FUSE_MS,
  NT_PER_VESICLE,
  STORAGE_N,
  flashesAt,
  fusingAt,
  type PoolId,
  type PoolsState,
  type Vesicle,
} from '../core/pools'

// D18 — THE VESICLE POOLS, drawn.
//
// ⚠ EVERY OBJECT HERE IS ONE THE CHILD HAS ALREADY MET (user, 2026-09-06: "use
// already introduced visuals"). The wall is the SNARE bench's own molecules
// through the shared paver; a bubble is a bilayer sphere with transmitter
// inside, as the SNARE bench draws it; a fusion is the SNARE bench's own sink
// and omega (`fusedCentreFor`, `omegaRing`) on this exhibit's clock; the balls
// are the app's own glossy transmitter dots. What is new is the only thing no
// view has: two pools that can run dry, and the flash train.
//
// ⚠ AND THE BUBBLES ARE NOW MADE OF SOMETHING (2026-09-06, user: "make vesicles
// have visible lipids", "make vesicles be filled with neurotransmitters"). They
// used to be plain rings, on the level-of-detail rule — and the arithmetic said
// so: at the old size ONE shared lipid was 32.7 px thick against a 31 px
// bubble. The fix was not to draw a molecule smaller than a pixel but to make
// the bubbles bigger and fewer, which is what the user chose. See LIP_HEAD for
// the exaggeration that remains, declared.

const VIEW_W = typeof window !== 'undefined' ? window.innerWidth : 1440
const VIEW_H = typeof window !== 'undefined' ? window.innerHeight : 860
const DRAWER_W = Math.min(VIEW_W, 1376)
const CONTENT_W = Math.max(660, DRAWER_W - 40 - 256 - 24 - 12)
/** ⚠ THE DRAWER'S REAL VERTICAL CHROME, counted off the markup (21c-23, user:
 *  "stretch the canvas full page height") — the same exercise the SNARE bench
 *  did in 21c-3. `SideDrawer` is `h-screen` with `p-5` (40), the bench grid adds
 *  `pt-2` (8). Everything below is this panel's own. */
const CONTENT_H = Math.max(520, VIEW_H - 40 - 8)
/** ⚠ ONE CONTAINER NOW, NOT TWO (2026-09-08). The exhibit lost its second panel
 *  when the child became the experiment, so the whole content column is one
 *  terminal's: border (2) + `p-2` (16) on each side. */
const PANEL_CHROME = 2 * 8 + 2 * 2
export const FIRE_BAR_H = 0
/** `SideBySide`'s container: border (2) + `p-2` (16), then its `gap-2` (8)
 *  above and below the canvas, the headline, and the action button at the foot.
 *  The old arithmetic reserved 38 for a headline that is one line of 13 px text
 *  beside a speaker button, and an unexplained 22 on top — 44 px of canvas
 *  given away for nothing. */
const PANEL_BORDER_PAD = 2 + 16
const PANEL_HEAD = 26
const PANEL_GAPS = 8 * 2
/** ⚠ THE BUTTON LIVES IN THE PANEL NOW. With two terminals it had to sit on a
 *  bar above them, because one hand had to reach both; with one terminal it
 *  belongs at the foot of the thing it fires. */
const PANEL_FOOT = 38

export const POOL_W = Math.floor(CONTENT_W - PANEL_CHROME)
export const POOL_H = Math.round(
  CONTENT_H - FIRE_BAR_H - PANEL_BORDER_PAD - PANEL_HEAD - PANEL_GAPS - PANEL_FOOT,
)

// ── the layout, SOLVED from the budget ──────────────────────────────────────
//
// ⚠ NOT CHOSEN. The crowd stands in ranks; the widest rank and the number of
// ranks are facts about the pool counts, so the bubble's size follows from them
// and the frame, and the seats follow from the bubble. Nothing here is a magic
// multiplier — which is what the previous version had, and those multipliers
// put the back rank at y = −13 the moment the bubbles grew.

/** How many storage bubbles stand abreast, and how many rows they need. */
export const RESERVE_PER_ROW = STORAGE_N
export const RESERVE_ROWS = 1
/** ⚠ AND HOW MANY THE WORKING CROWD NEEDS — two rows, not one (21c-21).
 *
 *  Storage holds `STORAGE_N`, in one row behind the parked ones. */
/** ⚠ TWO RANKS NOW (2026-09-07): the parked row at the wall and one row of
 *  storage behind it. Thirteen bubbles in five rows became five in two, which
 *  is what lets each one be drawn twice the size. */
export const RANK_ROWS = 1 + RESERVE_ROWS
const WIDEST = Math.max(DOCKED_SLOTS, RESERVE_PER_ROW)
/** Clear space between neighbours, in units of a bubble's own outer radius. */
/** ⚠ WIDER APART ON A WIDE PANEL. Three bubbles at the old spacing left the
 *  terminal's wall two-thirds empty either side of them; the parking spaces are
 *  spread over the wall they actually belong to. */
const GAP_X = 1.35
const GAP_Y = 0.5
/** Water left above the back rank, so the crowd is IN the terminal and not
 *  jammed against a frame edge that is not a surface. */
const TOP_MARGIN = 0.6

/** ⚠ ONE LIPID FOR THE WHOLE PANEL — the wall's and the bubbles' (21c-19, user:
 *  "lipids in membrane and vesicles are different, unify").
 *
 *  They WERE different, and not merely in size. A lipid's shape is set by
 *  `halfMem / headR`: `drawLipidAt` puts the head at `halfMem - headR` and runs
 *  the tail down to `headR x MID_SEAM`, so the tail's length is
 *  `halfMem - 1.75 x headR`. The shared molecule's ratio is 5.0 — a small head
 *  on long tails. The bubbles' was 2.5 — a fat head on stubs. Two different
 *  molecules, side by side in one picture, in a panel whose whole point is that
 *  a vesicle's skin JOINS the wall's skin.
 *
 *  So there is one molecule here, and it is the app's own molecule scaled: the
 *  same head-to-tail proportions, the same two leaflets, at `LIPID_SCALE` of
 *  the size the SNARE bench draws it. That scale is this register's, declared —
 *  see docs/05-visual-language.md — and it is chosen against three measured
 *  limits: a head under ~2 px stops reading, a lumen under ~3.5 cargo balls has
 *  nowhere to put the transmitter, and the bubble must not end up mostly skin.
 *
 *  ⚠ AND THE SAMPLERS ARE TOLD ABOUT IT. `omegaRing` and `wallPointsMany` took
 *  their spacing from the shared lipid until 21c-19, so paving them with any
 *  other molecule left gaps between the heads. */
export const LIPID_SCALE = 0.7

export const POOL_LIPID: LipidGeom = {
  headR: LIPID.headR * LIPID_SCALE,
  halfMem: LIPID.halfMem * LIPID_SCALE,
}

/** How far apart these molecules stand — the wall's and a bubble's alike. */
export const POOL_SPACING = lipidSpacing(POOL_LIPID)

/** Kept as a function because every caller reads it that way; the molecule no
 *  longer depends on the panel, which is the point. */
export const poolLipid = (_g?: SnareGeometry): LipidGeom => POOL_LIPID

/** A bubble's drawn half-width: its ring plus the membrane standing out from
 *  it. The seats are spaced on THIS, not on the ring — spacing on the ring
 *  overlaps every neighbour by a membrane's thickness. */
export const outerR = (g: SnareGeometry): number => g.r + POOL_LIPID.halfMem

/** How much room there is inside a bubble for its cargo. */
export const lumenR = (g: SnareGeometry): number => g.r - POOL_LIPID.halfMem

/** The panel's geometry — the SNARE bench's frame, with the bubble sized so the
 *  whole crowd fits the budget above. */
/** ⚠ HOW DEEP THE GAP IS (21c-22). The SNARE bench puts its wall at 0.85 of the
 *  frame because everything above it is the story. Here the far side of the gap
 *  is half the story — a message that gets through has to be seen getting
 *  through — so the wall comes up and the gap gets room for a receiving cell
 *  and a cleft for the transmitter to cross. */
const WALL_AT = 0.55
/** …and where the receiving cell's own membrane runs. The gauge no longer needs
 *  a strip of its own under it — it sits on a plate in the corner — so the far
 *  membrane comes back down near the foot and the whole picture LIFTS
 *  (2026-09-07, user: "lift the image slightly up"). */
const POST_AT = 0.82

export function poolsGeometry(w = POOL_W, h = POOL_H): SnareGeometry {
  const g = { ...snareGeometry(w, h), wallY: h * WALL_AT }
  const wide = (WIDEST - 1) * (2 + GAP_X) + 2
  const tall = (RANK_ROWS - 1) * (2 + GAP_Y) + 2 + TOP_MARGIN
  // ⚠ THE HEIGHT USUALLY WINS NOW. With one full-width panel the width budget
  // would allow a bubble a quarter of the frame across; what actually limits it
  // is the two ranks having to fit above the wall.
  const outer = Math.min(
    (g.right - g.left) / wide,
    (g.wallY - POOL_LIPID.halfMem) / tall,
  )
  // ⚠ The molecule is a fixed size, so the RING is what the budget leaves after
  // the membrane has taken its share — not a fraction of the whole.
  return { ...g, r: Math.max(POOL_LIPID.halfMem * 1.5, outer - POOL_LIPID.halfMem) }
}

export interface Seat {
  x: number
  y: number
}

/** ⚠ THE SPACING THE BUDGET SOLVED FOR — exported so a guard can ask what was
 *  REQUESTED rather than only whether the bubbles happen not to overlap. A
 *  break that spaced the ranks on the ring instead of the outer radius left
 *  94.8 px between 92 px bubbles: no overlap, 2 px of air, and a
 *  "do they overlap?" guard passed it. */
export const pitchX = (g: SnareGeometry): number => outerR(g) * (2 + GAP_X)
export const pitchY = (g: SnareGeometry): number => outerR(g) * (2 + GAP_Y)

const perRowOf = (pool: PoolId): number =>
  pool === 'docked' ? DOCKED_SLOTS : RESERVE_PER_ROW

/** Which rank-row a place falls in, counting back from the wall. */
const rowOf = (pool: PoolId, i: number): number =>
  pool === 'docked' ? 0 : 1 + Math.floor(i / RESERVE_PER_ROW)

/** ⚠ WHERE EACH POOL LIVES — three ranks, and the order is the lesson: the
 *  parked few ON the wall, and storage just behind them. A child should be able
 *  to see that the back rank is further from the door. */
export function poolSeats(g: SnareGeometry, pool: PoolId, i: number): Seat {
  const R = outerR(g)
  const perRow = perRowOf(pool)
  const col = i % perRow
  const row = rowOf(pool, i)
  return {
    x: g.cx + (col - (perRow - 1) / 2) * R * (2 + GAP_X),
    // The docked rank TOUCHES the wall: its outer face against the membrane's
    // inner one. Every rank behind is one pitch further in.
    y: g.wallY - POOL_LIPID.halfMem - R - row * R * (2 + GAP_Y),
  }
}

/** ⚠ HOW DEEP A FUSING BUBBLE HAS SUNK, and where its parking space is — the
 *  SNARE bench's own sink on this exhibit's clock (user chose "reuse the SNARE
 *  bench's own fusion", 2026-09-06). This is the bubble ALONE: what other
 *  fusions do to its position is `fusionSites`' job. */
export function fusingCentre(g: SnareGeometry, slot: number, p: number): Seat {
  const from = poolSeats(g, 'docked', slot)
  return { x: from.x, y: fusedCentreFor(g, from.y, g.r, p) }
}

export interface FusionSite {
  v: Vesicle
  p: number
  /** Still merging, and so still drawn as a bubble. False once it has become
   *  wall and is only waiting to be taken back. */
  merging: boolean
  slot: number
  /** Its parking space's x — where it sits in the wall's OWN coordinates, which
   *  is what decides who gets pushed which way. */
  home: number
  /** …and where it is actually DRAWN, once the other fusions have shoved it. */
  x: number
  y: number
  /** How far this one opening pushes the wall aside, each way. */
  shift: number
}

/** ⚠ EVERY FUSION ON SCREEN, AND WHERE IT IS ACTUALLY DRAWN (21c-18).
 *
 *  ⚠ THIS IS THE FIX FOR "MEMBRANE BREAKS APART AT EXOCYTOSIS" (user,
 *  2026-09-07). Each fusion inserts its bubble's membrane into the wall, so it
 *  pushes everything on either side of it aside — INCLUDING THE OTHER FUSIONS.
 *  A bubble drawn at its parking space while the gap it is supposed to be
 *  filling has been shoved 55 px down the wall leaves a hole with nothing in
 *  it. Measured before the fix: two bubbles fusing together tore a **59 px hole
 *  at x = 52**, with neither fusion anywhere near it (they were at 131.7 and
 *  357.3). One fusion alone was always sound, which is why it took a burst to
 *  show up.
 *
 *  So a fusion's drawn position is its parking space displaced by every OTHER
 *  fusion, by the same rule the wall's own molecules obey. `home` stays the
 *  undisplaced x, because that is the coordinate the pushing is decided in. */
export function fusionSites(g: SnareGeometry, s: PoolsState): FusionSite[] {
  const merging = new Set(fusingAt(s).map((f) => f.v.id))
  // ⚠ AND THE WALL NO LONGER SLIDES (21c-21, user: "vesicles are all the time
  // moving around, I am not able to track which are gone").
  //
  // A fusion adds its bubble's membrane, and the wall used to make room by
  // pushing every molecule outward — with the docked row riding along, because
  // it is stuck to them. Measured over 24 seconds: something moving in 100% of
  // frames, a docked bubble shoved 336 px from its space on a 489 px panel, and
  // three or four bubbles ending up off the panel entirely.
  //
  // ⚠ THE SLIDING WAS THE ARTIFACT, not the fix. Conserving the material inside
  // the frame is right at the SNARE bench, where one vesicle fills the picture.
  // Here the terminal's real membrane runs far beyond this window, so one
  // vesicle's worth of new membrane would move nothing a child could see. So
  // the wall stays put, and where a bubble is merging its own molecules ARE the
  // membrane for that stretch — the wall simply does not draw its own there.
  return s.ves
    .filter((v) => merging.has(v.id))
    .map((v) => {
      const p = Math.min(1, v.t / FUSE_MS)
      const c = fusingCentre(g, v.slot, p)
      return {
        v,
        p,
        merging: true,
        slot: v.slot,
        home: c.x,
        x: c.x,
        y: c.y,
        shift: wallShiftFor(g, c.y, g.r),
      }
    })
}

/** ⚠ WHERE THE WALL IS BEING OPENED, and how wide — one site per fusion, so
 *  four bubbles going at once open the wall in four places. `shift` is the
 *  reach of the merging bubble's own membrane each way from its centre: exactly
 *  the stretch the wall leaves to it. */
export function wallSites(
  g: SnareGeometry,
  s: PoolsState,
): { about: number; shift: number }[] {
  return fusionSites(g, s).map(({ home, shift }) => ({ about: home, shift }))
}

/** ⚠ THE WALL'S OWN MOLECULES — every one except those in a stretch a merging
 *  bubble has taken over. Nothing is moved; the openings are simply not the
 *  wall's to draw. */
export function wallMolecules(g: SnareGeometry, s: PoolsState) {
  const sites = wallSites(g, s)
  // ⚠ THE SEAM IS CLOSED BY HALF A MOLECULE. The wall's samples and the omega's
  // are two grids that do not line up, so leaving the full stretch left a gap
  // of up to two spacings where they met — measured at 8.7 px against the
  // wall's own 3.1. Reaching half a spacing further in makes them meet; where
  // they overlap by a fraction of a molecule, that reads as packing, not as a
  // hole, and a hole is the thing being avoided.
  const bite = POOL_SPACING * 0.5
  return wallPointsMany(g, [], POOL_SPACING).filter((pt) =>
    sites.every((site) => Math.abs(pt.at.x - site.about) > site.shift - bite),
  )
}

/** ⚠ WHERE A VESICLE ACTUALLY IS — its seat in its own pool. A docked bubble
 *  sits in ITS OWN parking space, never in whatever order the array happens to
 *  be in. */
export function vesicleSeats(
  g: SnareGeometry,
  s: PoolsState,
): { v: Vesicle; at: Seat }[] {
  const out: { v: Vesicle; at: Seat }[] = []
  for (const v of s.ves) {
    if (v.pool === 'out') continue
    // ⚠ ITS OWN PLACE, never the array's order (21c-20). Indexing by position
    // in the array meant that one bubble leaving a pool renumbered every other
    // bubble in it, and they all jumped.
    const i = v.pool === 'docked' ? v.slot : v.rank
    // ⚠ IN THE WALL'S OWN COORDINATES. What the openings do to it is added at
    // painting time by `paintedAt` — see there for why the two must be kept
    // apart.
    out.push({ v, at: poolSeats(g, v.pool, i) })
  }
  return out
}

/** ⚠ THE DOCKING SITES (21c-21, user: "I am not able to track which are gone").
 *
 *  A patch of the wall at each parking space, so an EMPTY space reads as an
 *  empty space rather than as plain wall — which is half of knowing which
 *  bubbles have gone. Not an invention: an active zone really is marked out by
 *  a dense web of protein, and release happens at those spots and nowhere else.
 *  No words, no numbers: a place, drawn as a place. */
export const SITE_INK = 'rgba(148, 163, 184, 0.22)'

export function dockSites(
  g: SnareGeometry,
  s?: PoolsState,
): { x: number; half: number; shown: boolean }[] {
  const half = outerR(g) * 0.78
  // ⚠ A SPACE WITH A BUBBLE MERGING OUT OF IT IS NOT AN EMPTY SPACE, so it is
  // not marked as one (2026-09-09, user: "a place on membrane where vesicle
  // merges, gets grey bg after exocytosis").
  //
  // The mark is a tinted patch of the WALL, and it is painted under the wall's
  // molecules so it reads as a denser stretch of membrane. During a merge the
  // wall gives up its molecules over that whole stretch — the merging bubble's
  // own membrane is what is there instead — so the patch was left with nothing
  // drawn on top of it, and a tint meant to be seen THROUGH molecules became a
  // bare grey block, exactly where the bubble had gone in.
  const merging = new Set(s ? fusionSites(g, s).map((f) => f.slot) : [])
  const out: { x: number; half: number; shown: boolean }[] = []
  for (let i = 0; i < DOCKED_SLOTS; i++) {
    out.push({ x: poolSeats(g, 'docked', i).x, half, shown: !merging.has(i) })
  }
  return out
}

/** ⚠ THE SCAFFOLD AND THE ROPES ARE GONE (2026-09-07, user: "drop them —
 *  storage is just behind"). Synapsin tethering the reserve to actin is real,
 *  and 21c-21 drew the scaffold so the rope could be read at all — but with two
 *  storage bubbles the mechanism costs two object types on a picture the user
 *  is asking to quieten, and buys a moment that barely happens. Storage now
 *  simply sits behind the parked row. The model lost its mobilisation with
 *  them: there is nothing to cut loose. */

// ── moving, never jumping ───────────────────────────────────────────────────
//
// ⚠ NOTHING TELEPORTS (21c-20, user: "avoid teleporting. Vesicles should slowly
// move and re-order").
//
// A bubble's PLACE is a fact about the model — which parking space, which place
// in storage — but where it is DRAWN is a per-frame value, and by this app's own
// rule those live outside the model. So the bench holds a map of drawn positions
// and hands it to both of the functions below, exactly as the permeability
// bench holds its motes and hands them to `stepMotes`.

export interface Glide extends Seat {
  /** How far it currently is from where the rules put it, and how fast that
   *  gap is closing. */
  ox: number
  oy: number
  vx: number
  vy: number
  /** ⚠ WHICH RULE IS PLACING IT. When this changes — it docks, it comes back,
   *  it starts merging — the place it belongs jumps, and that is the ONLY
   *  moment a jump can happen. */
  key: string
}

/** Where each bubble is actually drawn, by vesicle id. Owned by the bench. */
export type Drawn = Map<number, Glide>

/** ⚠ HOW SLOWLY — the spring's time constant, ms. Critically damped, so a
 *  bubble sets off from REST, reaches its quickest around one of these, and
 *  arrives without overshooting.
 *
 *  ⚠ A SPRING, NOT AN EXPONENTIAL DECAY. The first version decayed toward the
 *  target, which is fastest at the very start: measured, a bubble crossing the
 *  panel moved 19.3 px in its FIRST frame and then crawled — it read as a dart,
 *  which is the thing being fixed. */
export const SETTLE_TAU_MS = 320

/** ⚠ WHERE THE RULES PUT A BUBBLE, exactly — no easing, no history — with a key
 *  naming the rule that produced it. */
export function placeOf(
  g: SnareGeometry,
  v: Vesicle,
  seat: Seat | undefined,
  site: FusionSite | undefined,
): { at: Seat; key: string } {
  const home = poolSeats(g, 'docked', Math.max(0, v.slot))
  const at = seat ?? { x: home.x, y: site?.merging ? site.y : g.wallY }
  return { at, key: `${v.pool}|${v.rank}|${v.slot}|${site?.merging ? 1 : 0}` }
}

/** Advance every bubble toward where the rules put it. Mutates `drawn`; a
 *  bubble it has not seen before starts THERE, because a panel opens with its
 *  crowd already arranged rather than flying in. */
export function settlePools(
  g: SnareGeometry,
  s: PoolsState,
  drawn: Drawn,
  dtMs: number,
): void {
  const dt = Math.min(0.05, Math.max(0, dtMs) / 1000)
  const w = 1000 / SETTLE_TAU_MS
  const byId = new Map(fusionSites(g, s).map((f) => [f.v.id, f]))
  const seats = new Map(vesicleSeats(g, s).map((x) => [x.v.id, x.at]))
  for (const v of s.ves) {
    const site = byId.get(v.id)
    const { at: want, key } = placeOf(g, v, seats.get(v.id), site)
    const glide = drawn.get(v.id)
    if (!glide) {
      drawn.set(v.id, { ...want, ox: 0, oy: 0, vx: 0, vy: 0, key })
      continue
    }
    // ⚠ A CHANGE OF RULE IS THE ONLY PLACE A JUMP CAN COME FROM, so it is the
    // only place one is absorbed: the whole difference becomes an offset, which
    // leaves the bubble exactly where it was, and the spring then walks that
    // offset to nothing. Everything else — the fusion's own sink — passes
    // through untouched and on time.
    if (glide.key !== key) {
      glide.ox = glide.x - want.x
      glide.oy = glide.y - want.y
      glide.key = key
    }
    glide.vx += (-2 * w * glide.vx - w * w * glide.ox) * dt
    glide.vy += (-2 * w * glide.vy - w * w * glide.oy) * dt
    glide.ox += glide.vx * dt
    glide.oy += glide.vy * dt
    glide.x = want.x + glide.ox
    glide.y = want.y + glide.oy
  }
  for (const id of [...drawn.keys()]) {
    if (!s.ves.some((v) => v.id === id)) drawn.delete(id)
  }
}

/** ⚠ WHERE EACH BUBBLE IS FINALLY PAINTED — what it has glided to, or, with no
 *  glide to read, exactly where the rules put it. A still frame and a test both
 *  want the second.
 *
 *  ⚠ NOTHING THAT IS NOT DRAWN HAS A POSITION. A bubble away being made ready
 *  again is off the picture entirely; its glide keeps tracking the wall it will
 *  come back from, but asking where it "is" invites a guard to count it as
 *  something moving on screen. */
export function paintedAt(
  g: SnareGeometry,
  s: PoolsState,
  drawn?: Drawn,
): Map<number, Seat> {
  const byId = new Map(fusionSites(g, s).map((f) => [f.v.id, f]))
  const seats = new Map(vesicleSeats(g, s).map((x) => [x.v.id, x.at]))
  const out = new Map<number, Seat>()
  for (const v of s.ves) {
    if (v.pool === 'out' && !byId.get(v.id)?.merging) continue
    const glide = drawn?.get(v.id)
    out.set(
      v.id,
      glide ? { x: glide.x, y: glide.y } : placeOf(g, v, seats.get(v.id), byId.get(v.id)).at,
    )
  }
  return out
}

// ── the cargo ───────────────────────────────────────────────────────────────
//
// ⚠ IN THE BUBBLE FROM ITS FIRST FRAME, and out through the MOUTH — the rule
// the endocytosis panels were corrected into (21c-9, user: "NTs should be
// present in vesicles from the 1st frame. Currently teleport."). Nothing in the
// gap ever appears there: every ball in the gap came out of a bubble a child
// watched open.

/** A transmitter ball's radius — sized off the LUMEN it has to live in, not off
 *  the bubble, so thinning or thickening the membrane cannot crowd the cargo
 *  out of its own bubble. */
export const cargoR = (g: SnareGeometry): number => lumenR(g) * 0.2

/** Where a ball sits inside its bubble, in the bubble's own frame — seeded, and
 *  jostling on the SCREEN clock, because a bubble's contents are a liquid too. */
export function cargoOffset(
  g: SnareGeometry,
  id: number,
  k: number,
  ms: number,
): Seat {
  const room = Math.max(0, lumenR(g) - cargoR(g) * 1.15)
  const key = id * 31 + k
  const a = hash01(key, 1) * Math.PI * 2
  // √ of a uniform draw fills the disc evenly instead of crowding the middle.
  const rad = Math.sqrt(hash01(key, 2)) * room
  const wob = g.r * 0.05
  return {
    x: Math.cos(a) * rad + Math.sin(ms / 430 + hash01(key, 3) * 9) * wob,
    y: Math.sin(a) * rad + Math.sin(ms / 510 + hash01(key, 4) * 9) * wob,
  }
}

/** ⚠ HOW LONG A BUBBLE TAKES TO EMPTY once its mouth is open, ms.
 *
 *  ⚠ IT USED TO BE 0.6 OF THE WHOLE FUSION — 1.8 seconds of balls dribbling
 *  out one at a time. A real vesicle empties in well under a millisecond, and
 *  the cost of stretching it that far was that the answer on the far side never
 *  got bright: only one or two balls were ever on the receptors at once, so a
 *  release of four bubbles looked the same as a release of one. */
const EMPTY_MS = 140

/** ⚠ HOW SOLIDLY BALL `k` IS THERE at this fullness (2026-09-08, user: "let's
 *  symbolically fill recovered vesicles with NTs. Fine if NTs just appear in
 *  vesicles after restore (fade-in)").
 *
 *  ⚠ A FADE IS THE RIGHT IDIOM HERE, and it is worth saying why, because this
 *  app forbids fading elsewhere: a PROTEIN arriving must travel, because it is
 *  an object with a place it came from. Transmitter being pumped into a vesicle
 *  is a CONCENTRATION rising, and these five balls stand for thousands of
 *  molecules — so there is no journey to draw, only more of it than there was.
 *
 *  They come up one at a time rather than all together, so the reading is a
 *  count a child can watch reach five. */
export function ballAlpha(fill: number, k: number): number {
  const at = (fill * NT_PER_VESICLE - k) / 0.7
  return Math.max(0, Math.min(1, at))
}

/** ⚠ WHEN BALL `k` STARTS FOR THE MOUTH, in ms after its bubble began merging.
 *  Never before the mouth opens — `SINK_TOUCH` of the fusion is the instant the
 *  two membranes actually join, and nothing can leave through a mouth that is
 *  not there. Staggered across `EMPTY_MS`, because a pore lets them out one
 *  after another rather than as a lump. */
export function cargoStartMs(k: number): number {
  return SINK_TOUCH * FUSE_MS + (k / NT_PER_VESICLE) * EMPTY_MS
}

/** The same instant as a fraction of the fusion — kept for the guards that ask
 *  the schedule rather than the clock. */
export const cargoStartP = (k: number): number => cargoStartMs(k) / FUSE_MS

/** ⚠ A BALL'S JOURNEY, IN REAL TIME (21c-22) — out through the mouth, across
 *  the gap, and a moment held on the receiving cell before it is taken up.
 *
 *  ⚠ IT USED TO BE A FRACTION OF `CARGO_MS`, and that put the answer 4.4
 *  SECONDS after the message that caused it — measured. No child links a cause
 *  to an effect across four seconds; the light has to follow the flash closely
 *  enough to be its answer. Now the whole crossing is about a second, whatever
 *  the rest of the clock does. (Real transmitter crosses a cleft in well under
 *  a millisecond; every one of these is a declared stretch.) */
const EXIT_MS = 140
const CROSS_MS = 300
const BOUND_MS = 220

const smooth = (q: number): number => {
  const t = Math.max(0, Math.min(1, q))
  return t * t * (3 - 2 * t)
}

export interface Dot {
  x: number
  y: number
  r: number
  /** Still in a bubble, as against out in the gap. */
  inside: boolean
  /** ⚠ HOW SOLIDLY IT IS THERE, 0→1 — a ball in a bubble that is still filling
   *  is not there yet. Balls arrive one after another as the bubble fills, so
   *  what a child sees is a COUNT going up rather than a glow brightening. */
  alpha: number
  /** ⚠ WHOSE BALL THIS IS — the vesicle's id, kept for its whole life. This
   *  app gives every piece of loose matter an identity, and a guard needs it:
   *  "is this ball still inside its own bubble?" cannot be asked of a bare
   *  position, and a first attempt measured a NEIGHBOUR's cargo instead. */
  id: number
}

/** ⚠ EVERY TRANSMITTER BALL ON SCREEN, wherever it is in its life: sitting in a
 *  parked bubble, riding one down as it merges, squeezing out through the mouth,
 *  or drifting off down the gap. ONE function, because it is one ball — a second
 *  function for "the puff" is exactly how a ball ends up teleporting into the
 *  gap, which is the bug this exhibit's cousins were corrected for. */
export function cargoDots(
  g: SnareGeometry,
  s: PoolsState,
  ms: number,
  height: number,
  /** Where the bubbles are actually drawn. Absent, the cargo rides the places
   *  they are heading for — which is right for a still frame and for a test. */
  drawn?: Drawn,
): Dot[] {
  const out: Dot[] = []
  const dr = cargoR(g)
  const painted = paintedAt(g, s, drawn)
  for (const { v, at: seat } of vesicleSeats(g, s)) {
    const at = painted.get(v.id) ?? seat
    for (let k = 0; k < NT_PER_VESICLE; k++) {
      const alpha = ballAlpha(v.fill, k)
      if (alpha <= 0) continue
      const off = cargoOffset(g, v.id, k, ms)
      out.push({ x: at.x + off.x, y: at.y + off.y, r: dr, inside: true, alpha, id: v.id })
    }
  }
  // ⚠ THE CARGO RIDES THE BUBBLE AS DRAWN, and leaves by the mouth as drawn —
  // both displaced by whatever other fusions are going on. A ball aimed at an
  // undisplaced mouth crosses the wall where there is no opening.
  for (const v of s.ves) {
    if (v.pool !== 'out' || v.t >= CARGO_MS) continue
    const p = Math.max(0, Math.min(1, v.t / FUSE_MS))
    const c = painted.get(v.id) ?? fusingCentre(g, v.slot, p)
    const mouth = { x: c.x, y: g.wallY }
    for (let k = 0; k < NT_PER_VESICLE; k++) {
      const off = cargoOffset(g, v.id, k, ms)
      const startMs = cargoStartMs(k)
      const since = v.t - startMs
      const from = { x: c.x + off.x, y: c.y + off.y }
      if (since <= 0) {
        // Still aboard, riding the bubble down. Held above the wall: a ball
        // still in its bubble cannot be out in the gap.
        out.push({
          x: from.x,
          y: Math.min(from.y, g.wallY - dr),
          r: dr,
          inside: true,
          alpha: 1,
          id: v.id,
        })
        continue
      }
      if (since < EXIT_MS) {
        const e = smooth(since / EXIT_MS)
        const x = from.x + (mouth.x - from.x) * e
        const y = from.y + (mouth.y - from.y) * e
        out.push({ x, y, r: dr, inside: y < g.wallY, alpha: 1, id: v.id })
        continue
      }
      if (since > EXIT_MS + CROSS_MS + BOUND_MS) continue
      // ⚠ AND THEN IT CROSSES THE GAP AND LANDS ON THE FAR SIDE (21c-22). It
      // used to drift off the bottom of the frame; now it arrives, because
      // arriving is the whole point — a message that got through is a message
      // whose transmitter reached the other cell.
      const e = smooth(Math.min(1, (since - EXIT_MS) / CROSS_MS))
      const spread = (hash01(v.id * 31 + k, 5) - 0.5) * g.r * 2.6
      const land = postY(height) - dr * 0.9
      out.push({
        x: mouth.x + spread * e,
        y: Math.min(land, mouth.y + (land - mouth.y) * e),
        r: dr,
        inside: false,
        alpha: 1,
        id: v.id,
      })
    }
  }
  return out
}

/** The balls out in the gap — what "the puff got smaller" IS. Fewer bubbles
 *  opened means fewer balls, and there is no other reading anywhere. */
export function gapCargo(
  g: SnareGeometry,
  s: PoolsState,
  ms: number,
  height: number,
): Dot[] {
  return cargoDots(g, s, ms, height).filter((d) => !d.inside)
}

// ── the far side of the gap ─────────────────────────────────────────────────
//
// ⚠ WITHOUT THIS THE EXHIBIT TAUGHT THE OPPOSITE OF ITS POINT (21c-22, user:
// "which conclusion am I supposed to draw? What I read: no matter how intense
// and how many signals the bouton gets, it manages to pass down the signal").
//
// The model was saying the right thing all along — measured over 30 seconds of
// tapping, the burst terminal sends 190 messages and releases 40 vesicles, and
// 84% of its messages release NOTHING, start to finish. None of that was on
// screen. A failed message was drawn as a flash arriving and nothing happening,
// and "nothing happening" reads as "nothing to look at", not as "that one
// failed" — while the puffs that did come out kept arriving, so the terminal
// looked like it was coping.
//
// So the gap gets its other side. Every message now has a visible consequence
// or a visible lack of one: the receiving cell lights up by exactly as much
// transmitter as reaches it, and a message that released nothing lights nothing.

/** The receiving cell's own membrane, with a strip of that cell below it. */
export const postY = (height: number): number => height * POST_AT

// ── what the far side is MADE of ────────────────────────────────────────────
//
// ⚠ LANDMARKS, so the place can be recognised (21c-23, user: "on the
// postsynaptic side, place 2 glutamate receptors, so users can recognize the
// location. Place ion soup (Ca, Na) for the same purpose").
//
// Both are the app's own drawings, not new ones: the receptor is
// `drawLigandChannel` — the traced ligand-gated channel from the ion-channel
// bench, which opens the way a real one does, by its subunits coming APART —
// and the ions are `drawGlossyIon` in the colours every other view gives them.

/** How many receptors, and where they sit in the far membrane. */
export const RECEPTOR_N = 2

export function receptorSeats(g: SnareGeometry, height: number): Seat[] {
  const y = postY(height)
  const span = (g.right - g.left) * 0.28
  // ⚠ LEFT OF CENTRE, to keep clear of the dial's plate in the right-hand
  // corner. A postsynaptic density is a PATCH facing the release sites, not a
  // thing that has to be centred — and a landmark hidden behind chrome is not a
  // landmark. Measured against `gaugePlate` by a guard.
  const mid = g.left + (g.right - g.left) * 0.41
  const out: Seat[] = []
  for (let i = 0; i < RECEPTOR_N; i++) {
    out.push({ x: mid + (i - (RECEPTOR_N - 1) / 2) * span, y })
  }
  return out
}

/** ⚠ THE SOUP THE GAP IS FULL OF — sodium and calcium, the two ions a
 *  glutamate receptor lets through, drifting in the cleft. They are scenery
 *  with a job: they say "this is the outside of a cell" at a glance, and they
 *  are what the receptors are FOR. Seeded, and adrift on the screen clock. */
export const SOUP_N = 22

export function soupAt(
  g: SnareGeometry,
  height: number,
  ms: number,
): { x: number; y: number; kind: 'na' | 'ca'; r: number }[] {
  const top = g.wallY + POOL_LIPID.halfMem * 1.6
  const bottom = postY(height) - POOL_LIPID.halfMem * 1.6
  const out: { x: number; y: number; kind: 'na' | 'ca'; r: number }[] = []
  if (bottom <= top) return out
  for (let i = 0; i < SOUP_N; i++) {
    // ⚠ IT JIGGLES WHERE IT STANDS (2026-09-07, user: "make ion soup jiggle in
    // place, not move across the scene"). A soup that drifts across the picture
    // reads as a current going somewhere, which is a thing this gap does not
    // do; jostling on the spot is what a warm solution actually looks like, and
    // it leaves the eye free for the one thing that IS travelling.
    const fx = hash01(i, 1)
    const fy = hash01(i, 2)
    const wob = Math.min(g.r * 0.16, (bottom - top) * 0.06)
    out.push({
      x:
        g.left +
        fx * (g.right - g.left) +
        Math.sin(ms / 640 + hash01(i, 6) * 9) * wob,
      y: top + fy * (bottom - top) + Math.sin(ms / 900 + hash01(i, 3) * 9) * wob,
      // Two thirds sodium: it is the one that carries the message in, and a
      // soup that is half calcium would say the wrong thing about the gap.
      kind: hash01(i, 4) < 0.68 ? 'na' : 'ca',
      r: cargoR(g) * (0.5 + hash01(i, 5) * 0.16),
    })
  }
  return out
}

/** How near the far membrane a ball has to be to be ON it. */
const BIND_BAND = (g: SnareGeometry): number => cargoR(g) * 3

/** ⚠ WHERE THE ANSWER IS DRAWN — a band INSIDE the receiving cell, starting at
 *  its own membrane and fading downward into it. Named so a guard can ask which
 *  side of the membrane it is on without counting ink. */
export function responseGlow(g: SnareGeometry, height: number): { y: number; h: number } {
  const y = postY(height)
  return { y, h: Math.max(1, Math.min(height - y, outerR(g) * 1.2)) }
}

/** ⚠ HOW BRIGHTLY THE FAR SIDE IS LIT — the count of transmitter balls actually
 *  touching it, against the most that could ever arrive at once (every parked
 *  bubble going together). 0 = the message got through nothing at all.
 *
 *  ⚠ SCALED BY THE WHOLE PARKED ROW, not by one bubble. Against one bubble it
 *  saturated: a single vesicle lit it as brightly as four, so "a strong message
 *  got through" and "a feeble one did" looked the same — measured, 1.0 for one
 *  vesicle and 1.0 for three.
 *
 *  Derived from the very balls that are drawn, never from a separate number: if
 *  a child can see three balls on the far membrane, the light is what three
 *  balls make. */
export function responseAt(
  g: SnareGeometry,
  s: PoolsState,
  ms: number,
  height: number,
): number {
  const y = postY(height)
  const band = BIND_BAND(g)
  const on = cargoDots(g, s, ms, height).filter((d) => !d.inside && d.y > y - band)
  return Math.min(1, on.length / (NT_PER_VESICLE * DOCKED_SLOTS))
}

// ── the gauge ───────────────────────────────────────────────────────────────
//
// ⚠ THE READING THE EXHIBIT IS ABOUT (21c-23, user: "add a speedometer-like
// gauge on top of both postsynaptic specializations, with a line for 'signal
// received'… once the threshold passed: it sparkles").
//
// It measures the one thing the two panels are being compared on: how close
// this message came to being HEARD. The needle is the transmitter actually on
// the receptors — the same number that lights the cell and opens its doors, not
// a third invention — and the threshold is the point where enough of it has
// arrived to count as a message received.

/** ⚠ WHERE "HEARD" BEGINS — measured, not picked. Walking real runs, the
 *  needle's peak per message falls into two clean groups: **0.25 and up** when
 *  at least one bubble's worth of transmitter arrived, and **0.09 or less**
 *  when a message found an empty parking row and only a dribble of somebody
 *  else's cargo was still crossing. 0.2 sits in the gap between them, so the
 *  line means exactly "a bubble went, and its message got across". */
export const GAUGE_THRESHOLD = 0.2

/** ⚠ THE DIAL'S TWO STATES, IN COLOUR (2026-09-07, user: "once threshold
 *  achieved, the gauge sparks yellow. Until then, choose a different color for
 *  the gradient").
 *
 *  Yellow is this app's signal colour everywhere — the flash, the response, the
 *  spark — so it must mean "the message got through" here too, and nothing
 *  less. Below the line the sweep is slate: something is arriving, but it is not
 *  a signal yet. The change of colour AT the line is what a child reads, before
 *  they have looked at where the needle is. */
export const GAUGE_BELOW_RGB = '148, 163, 184'

/** How fast the needle falls back once the transmitter is taken up, ms. It
 *  rises with the arrival — a needle that lagged the thing it is measuring
 *  would be measuring itself — and sweeps back down, which is what makes it
 *  readable as a dial rather than a flicker. */
export const GAUGE_FALL_MS = 620

/** The needle's next position: straight to the reading when it is climbing,
 *  easing down when it is not. */
export function gaugeNext(prev: number, target: number, dtMs: number): number {
  if (target >= prev) return target
  return Math.max(target, prev * Math.exp(-Math.max(0, dtMs) / GAUGE_FALL_MS))
}

export interface Gauge {
  cx: number
  cy: number
  r: number
}

/** ⚠ WHERE THE DIAL SITS: the bottom-RIGHT corner, on a plate of its own
 *  (2026-09-07, user: "make gauge prominent, on a non-transparent bg, visually
 *  above the membrane, above the action button, in the corner").
 *
 *  It used to be set into the receiving cell, sharing ground with the membrane,
 *  the receptors and the drifting ions — a reading competing with the thing it
 *  is reading. A dial is chrome: it belongs on top of the picture, on its own
 *  opaque ground, where a child's eye can go to it and come back. */
export function gaugeAt(height: number, width = POOL_W): Gauge {
  // ⚠ SIZED TO THE RECEIVING CELL'S OWN STRIP, so the plate cannot reach up and
  // cover the cleft the transmitter has to be seen crossing. A first attempt at
  // 19% of the width put a 227 x 135 plate over the right-hand receptor and the
  // bottom third of the gap.
  // ⚠ THE WHOLE PLATE has to fit below the far membrane, not just the dial: at
  // 0.8 of the strip the plate reached 46 px up into the cleft the transmitter
  // has to be seen crossing. The plate is 1.45 times the dial's radius tall.
  const r = Math.min(width * 0.16, (height - postY(height)) * 0.68)
  const pad = r * 0.22
  return { cx: width - pad - r, cy: height - pad - r * 0.16, r }
}

/** The plate it stands on — opaque, so nothing shows through it. */
export function gaugePlate(
  at: Gauge,
): { x: number; y: number; w: number; h: number; r: number } {
  const pad = at.r * 0.22
  return {
    x: at.cx - at.r - pad,
    y: at.cy - at.r - pad * 1.7,
    w: (at.r + pad) * 2,
    h: at.r + pad * 2.04,
    r: pad,
  }
}

/** The angle the hand points at for a reading of `t` — a half-turn, left to
 *  right, the way a speedometer reads. */
export const gaugeAngle = (t: number): number =>
  Math.PI + Math.max(0, Math.min(1, t)) * Math.PI

// ── the message ─────────────────────────────────────────────────────────────

/** ⚠ HOW FAR DOWN THE TERMINAL A FLASH HAS GOT. 0 = just above the top edge,
 *  1 = landed on the wall — where a bubble is touching it at that very moment,
 *  because `FLASH_MS` is derived from the fusion's own contact fraction. */
export function flashY(g: SnareGeometry, p: number): number {
  const lead = outerR(g) * 0.4
  return -lead + p * (g.wallY + lead)
}

/** Where the bolt rides: down the terminal's own edge, clear of the crowd, so
 *  five of them can be counted without a bubble in the way. */
export const boltX = (g: SnareGeometry): number => g.left * 0.55

/** A lightning bolt, as a path — the same mark as the button's own icon, so the
 *  thing the child pressed is the thing they see arrive. */
export function boltPoints(cx: number, cy: number, h: number): Seat[] {
  const w = h * 0.34
  return [
    { x: cx - w * 0.25, y: cy - h / 2 },
    { x: cx + w * 0.55, y: cy - h * 0.1 },
    { x: cx - w * 0.1, y: cy - h * 0.02 },
    { x: cx + w * 0.35, y: cy + h / 2 },
  ]
}

export interface PoolsView {
  state: PoolsState
  width: number
  height: number
  ms?: number
  /** The gauge's hand, eased by the bench. Absent, it reads the answer as it is
   *  this instant — right for a still frame and for a guard. */
  gauge?: number
  /** Where the bubbles have actually glided to. Absent, they are drawn in their
   *  places — a still frame, and what every guard that is not about the gliding
   *  itself wants. */
  drawn?: Drawn
}

export function drawPools(ctx: CanvasRenderingContext2D, v: PoolsView): void {
  const g = poolsGeometry(v.width, v.height)
  const lipid = poolLipid(g)
  const ms = v.ms ?? 0
  ctx.clearRect(0, 0, v.width, v.height)
  // The gap below the wall, in the bath's own ink — the one wash this panel
  // needs, exactly as the endocytosis panels paint theirs.
  ctx.fillStyle = OUTSIDE
  ctx.fillRect(0, g.wallY, v.width, v.height - g.wallY)

  // ── the messages coming down, BEHIND the crowd they travel through
  //
  // ⚠ ONE FLASH PER SPIKE, ALL THE SAME SIZE (user chose this over their own
  // "big flash for a big message", 2026-09-06). A burst puts five on screen at
  // once, 45 ms apart — a train a child can count. A bigger flash would read
  // faster and teach that a stronger message is a bigger spike, which is false:
  // action potentials are all-or-none, and the spike-train bench says so.
  for (const p of flashesAt(v.state)) {
    const y = flashY(g, p)
    const band = outerR(g) * 0.5
    ctx.save()
    const grad = ctx.createLinearGradient(0, y - band, 0, y + band)
    grad.addColorStop(0, `rgba(${SIGNAL_RGB}, 0)`)
    grad.addColorStop(0.5, `rgba(${SIGNAL_RGB}, 0.5)`)
    grad.addColorStop(1, `rgba(${SIGNAL_RGB}, 0)`)
    ctx.fillStyle = grad
    ctx.fillRect(0, y - band, v.width, band * 2)
    ctx.globalAlpha *= 0.85
    ctx.strokeStyle = SIGNAL_CORE
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(v.width, y)
    ctx.stroke()
    ctx.restore()
    // …and the bolt itself, so the mark that arrives is the mark on the button.
    const h = outerR(g) * 0.85
    const bx = boltX(g)
    softGlow(ctx, bx, y, h * 0.9, SIGNAL_RGB, 0.5)
    ctx.save()
    ctx.strokeStyle = SIGNAL_CORE
    ctx.lineWidth = Math.max(2, h * 0.13)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (const [i, pt] of boltPoints(bx, y, h).entries()) {
      if (i === 0) ctx.moveTo(pt.x, pt.y)
      else ctx.lineTo(pt.x, pt.y)
    }
    ctx.stroke()
    ctx.restore()
  }

  // ── the parking spaces, marked on the wall so an empty one shows
  for (const site of dockSites(g, v.state)) {
    if (!site.shown) continue
    ctx.save()
    ctx.fillStyle = SITE_INK
    ctx.fillRect(
      site.x - site.half,
      g.wallY - POOL_LIPID.halfMem,
      site.half * 2,
      POOL_LIPID.halfMem * 2,
    )
    ctx.restore()
  }

  // ── the wall, as molecules, from the SNARE bench's own paver — its own
  // molecules everywhere except the stretches a merging bubble has taken over.
  paveMembrane(ctx, wallMolecules(g, v.state), {
    geom: POOL_LIPID,
    first: 0,
    taperOver: 3,
    // Rule 2: the membrane is not this exhibit's actor — but the panel is never
    // still (the crowd is always moving), so it jostles with everything else.
    ms,
  })

  // ── the bubbles: a bilayer sphere each, and a fusing one merging into the
  // wall by the SNARE bench's own omega. Clipped above the wall, so a mouth
  // that has opened really is a hole and not a lumen painted over the gap.
  const bubble = (cx: number, cy: number, id: number) => {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, v.width, g.wallY)
    ctx.clip()
    ctx.beginPath()
    ctx.arc(cx, cy, Math.max(0.5, lumenR(g)), 0, Math.PI * 2)
    ctx.fillStyle = LUMEN
    ctx.fill()
    ctx.restore()
    // ⚠ A CLOSED RING IS NEVER TAPERED: a vesicle has no ends, and tapering one
    // puts a bald patch on a complete object.
    paveMembrane(ctx, omegaRing(g, cx, cy, g.r, POOL_SPACING), {
      geom: lipid,
      first: id * 97,
      taperOver: 0,
      ms,
    })
  }
  const painted = paintedAt(g, v.state, v.drawn)
  for (const { v: ves, at: seat } of vesicleSeats(g, v.state)) {
    const at = painted.get(ves.id) ?? seat
    bubble(at.x, at.y, ves.id)
  }
  for (const site of fusionSites(g, v.state)) {
    if (!site.merging) continue
    const at = painted.get(site.v.id) ?? { x: site.x, y: site.y }
    bubble(at.x, at.y, site.v.id)
  }

  // ── the far side of the gap: the cell this terminal is talking TO
  const py = postY(v.height)
  const lit = responseAt(g, v.state, ms, v.height)
  if (lit > 0) {
    // ⚠ THE ANSWER, drawn as light — as much of it as actually arrived. A
    // message that released nothing lights nothing, which is the whole reading.
    //
    // ⚠ AND IT GLOWS INSIDE THE RECEIVING CELL (2026-09-07, user: "display
    // signal yellow spark in postsynaptic area, not in synaptic cleft"). The
    // gap is where the chemical travels; the ANSWER happens in the cell that
    // heard it. Lighting the gap said the message was the event, when the event
    // is the cell reacting to it.
    const band = responseGlow(g, v.height)
    const glow = ctx.createLinearGradient(0, band.y, 0, band.y + band.h)
    glow.addColorStop(0, `rgba(${SIGNAL_RGB}, ${(0.62 * Math.sqrt(lit)).toFixed(3)})`)
    glow.addColorStop(1, `rgba(${SIGNAL_RGB}, 0)`)
    ctx.fillStyle = glow
    ctx.fillRect(0, band.y, v.width, band.h)
  }
  // ── the soup in the gap: what the outside of a cell is full of
  for (const ion of soupAt(g, v.height, ms)) {
    drawGlossyIon(ctx, ion.kind, ion.x, ion.y, ion.r, 0.62)
  }

  // ── the far membrane, with its receptors set into it
  const seats = receptorSeats(g, v.height)
  const half = ligandHalfWidth(POOL_LIPID.halfMem, lit)
  paveMembrane(ctx, wallPointsMany({ ...g, wallY: py }, [], POOL_SPACING), {
    geom: POOL_LIPID,
    first: 500,
    taperOver: 3,
    ms,
    // The lipids part to admit a protein, exactly as they do everywhere else.
    displacedBy: seats.map((at) => ({ at, half })),
  })
  for (const at of seats) {
    // ⚠ IT OPENS BY HOW MUCH ARRIVED. A receptor is a ligand-gated channel:
    // transmitter binds and the subunits come apart. So the same number that
    // lights the cell opens its doors — one reading, not two.
    drawLigandChannel(ctx, {
      cx: at.x,
      midY: at.y,
      halfHeight: POOL_LIPID.halfMem,
      species: GLOSSY_COLORS.na.mid,
      speciesDark: GLOSSY_COLORS.na.dark,
      open: lit,
      socket: true,
    })
  }

  // ── the transmitter: in the bubbles, and out in the gap
  for (const d of cargoDots(g, v.state, ms, v.height, v.drawn)) {
    if (d.y > v.height + d.r * 2) continue
    if (d.alpha >= 0.999) {
      transmitterDot(ctx, d.x, d.y, d.r)
      continue
    }
    // ⚠ MULTIPLIED, never assigned — a caller's own fade must survive.
    ctx.save()
    ctx.globalAlpha *= d.alpha
    transmitterDot(ctx, d.x, d.y, d.r)
    ctx.restore()
  }

  // ── the gauge, in the receiving cell, reading how close this message came
  drawGauge(ctx, gaugeAt(v.height, v.width), v.gauge ?? lit, ms)
}

/** ⚠ THE DIAL. A half-turn from nothing to everything, the arc it has already
 *  passed picked out, the threshold marked and named, and sparks once it is
 *  over — because the one thing a child must be able to see is whether this
 *  message got through. */
export function drawGauge(
  ctx: CanvasRenderingContext2D,
  at: Gauge,
  value: number,
  ms: number,
): void {
  const t = Math.max(0, Math.min(1, value))
  const { cx, cy, r } = at
  ctx.save()
  ctx.lineCap = 'round'

  // ⚠ ITS OWN GROUND, and it is not see-through. The dial is the one thing on
  // this canvas a child is meant to read as a number rather than as a picture,
  // and it cannot do that with a membrane and a soup of ions showing through it.
  const plate = gaugePlate(at)
  ctx.fillStyle = '#0b1220'
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(plate.x, plate.y, plate.w, plate.h, plate.r)
  ctx.fill()
  ctx.stroke()

  // The dial's own track, unlit.
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'
  ctx.lineWidth = Math.max(3, r * 0.15)
  ctx.beginPath()
  ctx.arc(cx, cy, r, Math.PI, Math.PI * 2)
  ctx.stroke()

  // ⚠ THE PATH ALREADY PASSED, in a radial gradient — brightening outward, so
  // the far end of the sweep is the bright one.
  if (t > 0.002) {
    // ⚠ SLATE UNTIL THE LINE, YELLOW PAST IT.
    const rgb = t >= GAUGE_THRESHOLD ? SIGNAL_RGB : GAUGE_BELOW_RGB
    const grad = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r * 1.12)
    grad.addColorStop(0, `rgba(${rgb}, 0.28)`)
    grad.addColorStop(1, `rgba(${rgb}, 0.95)`)
    ctx.strokeStyle = grad
    ctx.lineWidth = Math.max(3, r * 0.15)
    ctx.beginPath()
    ctx.arc(cx, cy, r, Math.PI, gaugeAngle(t))
    ctx.stroke()
  }

  // The threshold: a line across the track, and its name.
  const th = gaugeAngle(GAUGE_THRESHOLD)
  ctx.strokeStyle = t >= GAUGE_THRESHOLD ? SIGNAL_CORE : 'rgba(226, 232, 240, 0.85)'
  ctx.lineWidth = Math.max(2, r * 0.07)
  ctx.beginPath()
  ctx.moveTo(cx + Math.cos(th) * r * 0.76, cy + Math.sin(th) * r * 0.76)
  ctx.lineTo(cx + Math.cos(th) * r * 1.24, cy + Math.sin(th) * r * 1.24)
  ctx.stroke()
  // ⚠ AND IT IS NOT LABELLED (2026-09-07, user: "remove 'signal received'
  // label"). The canvas is back to carrying no words at all: the line's meaning
  // is taught by the colour changing as the needle crosses it, and said in the
  // info block, which is written to be read aloud.

  // The hand.
  const a = gaugeAngle(t)
  ctx.strokeStyle = t >= GAUGE_THRESHOLD ? SIGNAL_CORE : `rgba(${GAUGE_BELOW_RGB}, 0.95)`
  ctx.lineWidth = Math.max(2, r * 0.075)
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9)
  ctx.stroke()
  ctx.fillStyle = t >= GAUGE_THRESHOLD ? SIGNAL_CORE : `rgba(${GAUGE_BELOW_RGB}, 0.95)`
  ctx.beginPath()
  ctx.arc(cx, cy, Math.max(2.5, r * 0.075), 0, Math.PI * 2)
  ctx.fill()

  // ⚠ AND IT SPARKS once the message has got through — the moment the whole
  // exhibit is comparing, so it is the one thing that is unmistakable.
  if (t >= GAUGE_THRESHOLD) {
    const tip = { x: cx + Math.cos(a) * r * 0.95, y: cy + Math.sin(a) * r * 0.95 }
    for (let i = 0; i < 6; i++) {
      const phase = (ms / 220 + i / 6) % 1
      const spread = r * (0.12 + phase * 0.42)
      const ang = hash01(i, 11) * Math.PI * 2 + ms / 700
      const alpha = (1 - phase) * 0.9
      softGlow(
        ctx,
        tip.x + Math.cos(ang) * spread,
        tip.y + Math.sin(ang) * spread,
        Math.max(1.5, r * 0.1),
        SIGNAL_RGB,
        alpha,
      )
    }
  }
  ctx.restore()
}
