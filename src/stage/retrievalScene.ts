import { paveMembrane } from './bilayer'
import {
  LIPID,
  LUMEN,
  OUTSIDE,
  lumenArc,
  omegaRing,
  wallShiftFor,
  snareGeometry,
  wallPoints,
  type SnareGeometry,
} from './snareScene'
import { retrievalOf, type RetrievalId } from '../core/retrieval'
import { transmitterDot } from './synapseScene'
import { coatFlyAt, coatOrder, coatSettleAt, drawDynamin, drawTriskelion } from './clathrin'

// S14 — SYNAPTIC VESICLE ENDOCYTOSIS: three panels, one mechanism each.
//
// ⚠ REBUILT FROM SCRATCH (21c-5, user: "let's re-implement from scratch, the
// picture is too busy. Create a 3 container, full-width layout … On each view,
// display bilayer with a vesicle, the way it is displayed in 'Vesicles & snare'
// … No timeline, no additional labels or explanations on the canvas").
//
// The version before this drew the whole synapse scene and animated one site in
// it. Everything else in that frame — the spine, the astrocyte, the cleft, four
// other vesicles, every ion in the bath — was context for a question nobody was
// asking, and it buried the one thing being compared.
//
// So each panel is a piece of terminal wall and ONE vesicle, and nothing else.
// Three of them side by side is the comparison, made by looking rather than by
// remembering what the last run did.
//
// ⚠ AND THE WALL AND THE VESICLE ARE THE SNARE BENCH'S OWN. `wallPoints`,
// `omegaRing`, `lumenArc` and the shared paver, at that bench's register: the
// same molecules, the same spacing. What is new here is only what no view has
// drawn — a mouth that never widens, a clathrin basket, a dynamin collar, and a
// dent bigger than a vesicle.

/** ⚠ NOTHING IS LETTERED ON THESE CANVASES. The mechanism's name lives above
 *  its panel, in the page, where it can be pressed and read aloud; the
 *  explanation lives in the info block. A canvas that has to be read is a
 *  canvas a child skips. */

export interface Bubble {
  cx: number
  cy: number
  r: number
  /** How much of the clathrin basket is on this one, 0→1. */
  coat: number
}

/** ⚠ WHERE THE VESICLE IS, for one mechanism at one moment — the whole model,
 *  named so a guard can ask it instead of counting marks.
 *
 *  `cy` is the centre's height against the wall, and it is the ONLY thing that
 *  has to be right: `omegaRing` turns a centre into a ring of molecules and
 *  unrolls whatever has passed the wall along it. A vesicle sunk one radius
 *  past the wall IS wall. So "it never opens up" is the claim that this number
 *  never reaches the wall, and it is checkable. */
export function bubblesAt(g: SnareGeometry, route: RetrievalId, u: number): Bubble[] {
  const t = Math.max(0, Math.min(1, u))
  const r = g.r
  const dock = g.wallY - r
  const flat = g.wallY + r
  const high = g.highY + r
  const seg = (from: number, to: number) => Math.max(0, Math.min(1, (t - from) / (to - from)))
  const ease = (q: number) => q * q * (3 - 2 * q)
  const arrive = ease(seg(0, 0.12))
  const cyIn = high + (dock - high) * arrive

  if (route === 'kiss') {
    // ⚠ IT NEVER FLATTENS, AND ITS MOUTH IS TINY. Both are the claim. Measured
    // at a fifth of a radius: the mouth came out 44 px across on a 70 px
    // vesicle — half its own width, which is not "barely wider than one
    // molecule", it is a collapse that stopped early. At three hundredths the
    // mouth is 17 px, and the wall parts a sixth as far as a full collapse
    // makes it part.
    const dip = r * 0.03
    const down = ease(seg(0.16, 0.34))
    const up = ease(seg(0.56, 0.74))
    const away = ease(seg(0.78, 1))
    const cy = cyIn + dip * down - dip * up + (high - dock) * away
    return [{ cx: g.cx, cy, r, coat: 0 }]
  }

  if (route === 'clathrin') {
    // ⚠ THE COAT IS THE MOTOR (21c-10, user: "display sucking-in animation, as
    // more clathrin is building up" — the handover's panel B, adopted as
    // behaviour). The bud used to curl back on its own clock while the coat
    // rode along; now ONE number drives both: the bud's depth out of the wall
    // IS the coat's coverage, so a membrane visibly comes back exactly as fast
    // as triskelions land on it, and cannot lead or lag them.
    const sink = ease(seg(0.14, 0.34))
    // ⚠ The depth follows the coat's BUILD, not its stripped value: once the
    // pinch has freed the bubble, the basket coming off must not push it back
    // into the wall — which is exactly what `depth = coatAt` did (measured: it
    // ended the run re-sunk, never reaching the crowd).
    const build = clathrinBuildAt(t)
    // ⚠ The bud rises EARLY in the neck window and rises further (0.5r → 0.9r,
    // 21c-13, user: "give the sucked-in vesicle a more visible neck") — the
    // stalk under it is only as tall as this lift, and at 0.5r late it stood
    // for barely a beat before the cut.
    const pinch = ease(seg(0.66, 0.74))
    const away = ease(seg(0.84, 1))
    const cy =
      cyIn + (flat - dock) * sink - (flat - dock) * build - r * 0.9 * pinch + (high - dock) * away
    return [{ cx: g.cx, cy, r, coat: coatAt(route, t) }]
  }

  // ⚠ ULTRAFAST: the vesicle goes right in, and then the wall dents BESIDE it —
  // a piece far bigger than a vesicle, taken in one gulp. Both the size and the
  // place are the point; a small pit at the same spot is just clathrin without
  // a basket.
  const sink = ease(seg(0.14, 0.3))
  // ⚠ THE MERGED VESICLE IS ABSORBED, NOT CULLED (21c-9, user: "'ultrafast
  // endocytosis': bilayer twitches after exocytosis"). It used to be dropped
  // from the list the instant `sink` reached 1 — and the wall's opening is
  // derived from the bubbles, so 110 px of parted crowd snapped shut in one
  // frame, then snapped open again when the dent appeared. Twice.
  //
  // Now its radius runs down to nothing while it lies flat in the wall. That
  // is not membrane destroyed, it is membrane ABSORBED, and the arithmetic
  // says so: a fully merged ring's unrolled length is 2πr and the room the
  // wall makes for it is 2 × πr — the same number. Shrinking r closes both at
  // exactly the same rate, so the crowd packs in as the ring shortens, with no
  // gap and no overlap at any moment.
  const absorb = ease(seg(0.3, 0.38))
  // ⚠ The pit's window grew with the pit (21c-11): 2.4× the membrane moving in
  // the same time is 2.4× the speed, and the twitch guard measured it at
  // 8.7 px a frame. Same speed as before, more time.
  const pit = ease(seg(0.38, 0.68))
  const off = ease(seg(0.68, 0.78))
  const bud = seg(0.78, 1)
  const out: Bubble[] = []
  const rSink = r * (1 - absorb)
  if (rSink > 0.5) {
    out.push({ cx: g.cx, cy: cyIn + (flat - dock) * sink, r: rSink, coat: 0 })
  }
  if (pit > 0.001) {
    // ⚠ SIZED FROM THE PANEL, NOT FROM THE VESICLE (21c-11, user: "make 'large
    // vesicle' larger, so it takes almost all div width, before it splits").
    // A bulk endosome really is several vesicles' worth of membrane in one
    // piece — r × 1.55 undersold it. It takes what the frame can give: nearly
    // the half-span, capped so a margin survives on both sides, and offset as
    // far right of the active zone as that size allows.
    const big = endosomeR(g)
    const at = Math.min(g.cx + r * 2.6, g.right - big)
    // ⚠ A PIT DEEPENS — IT DOES NOT APPEAR (21c-9). The dent used to arrive
    // already at `bigFlat`, a whole vesicle's worth of membrane laid flat in
    // one frame, which is the second half of the twitch: the wall had to part
    // 170 px instantly to make room for it. It grows instead: a circle whose
    // radius runs 0 → big while its centre climbs from the wall line to a full
    // radius above it, so it reads as a dimple deepening into a sphere on a
    // neck, and the room the wall makes for it grows from nothing.
    const rr = big * pit
    const cy = g.wallY + rr * (1 - 2 * pit) - big * 0.45 * off
    // ⚠ IT RESOLVES INTO THREE, AND ALL THREE STAY (21c-9, user: "large vesicle
    // turns into 3, but only 2 remain on the last frame. 1 disappears").
    // The buds were half the endosome each, so the endosome was consumed to
    // nothing and dropped out of the picture — a vesicle that vanishes, which
    // is the very thing the conservation rule exists to forbid. Thirds: two
    // buds and the remnant, each big/3, and Σr is still exactly `big`.
    const buds = [
      { dir: -0.78 * Math.PI, grow: seg2(bud, 0, 0.4), go: seg2(bud, 0.44, 1) },
      { dir: -0.22 * Math.PI, grow: seg2(bud, 0.16, 0.56), go: seg2(bud, 0.6, 1) },
    ].map((b) => ({ ...b, rb: (big / 3) * ease(b.grow) }))
    const rEndo = Math.max(0, rr - buds.reduce((sum, b) => sum + b.rb, 0))
    // ⚠ And they BUD, not appear: each grows ON the shrinking endosome's
    // surface — attached, its centre at R_endo + r_bud along its own direction
    // — and only then pinches off and climbs to the crowd, which is what
    // budding looks like and is also the part that really takes seconds.
    for (const b of buds) {
      if (b.rb < 0.5) continue
      const seat = {
        x: at + Math.cos(b.dir) * (rEndo + b.rb),
        y: cy + Math.sin(b.dir) * (rEndo + b.rb),
      }
      const homeY = g.highY + b.rb
      out.push({
        cx: seat.x,
        cy: seat.y + (homeY - seat.y) * ease(b.go),
        r: b.rb,
        coat: 0,
      })
    }
    if (rEndo > 0.5) {
      // The remnant is a vesicle too, and it goes home last.
      const homeY = g.highY + rEndo
      const goHome = ease(seg2(bud, 0.68, 1))
      out.push({ cx: at, cy: cy + (homeY - cy) * goHome, r: rEndo, coat: 0 })
    }
  }
  return out
}

/** ⚠ THE ENDOSOME'S SIZE — solved from the panel, not from the vesicle
 *  (21c-11, user: "make 'large vesicle' larger, so it takes almost all div
 *  width, before it splits"). A bulk endosome is several vesicles' worth of
 *  membrane in one piece; nearly the half-span, capped by the room above the
 *  wall, and named once so the drawing and the guards read one number. */
export function endosomeR(g: SnareGeometry): number {
  return Math.min((g.right - g.left) * 0.42, g.wallY * 0.5)
}

/** A ramp inside a ramp: how far through [from, to] of an outer 0→1 leg. */
const seg2 = (outer: number, from: number, to: number): number =>
  Math.max(0, Math.min(1, (outer - from) / (to - from)))

/** ⚠ THE BASKET AND THE COLLAR, and which mechanism owns them. Named because
 *  "is the basket still on while the neck is squeezed?" is a question about the
 *  biology, not about the ink. Clathrin alone: a basket on kiss-and-run would
 *  be the exhibit contradicting its own point. */
// ⚠ THE SUCK-IN IS A RATCHET OF PULLS (21c-12, user: "clathrin animates with
// pull up ease: it moves away with a small gap → slows down → lipid ball
// 'snaps' towards it, bouncing"). One eased curve moved coat and membrane as
// one object; a ratchet is TWO curves with a phase between them:
//
//   • the COAT leads — each pull it climbs a step fast and eases to a stop
//     (a lattice stiffens; it does not glide), opening a small gap;
//   • the MEMBRANE lags, then SNAPS across the gap — fast off the mark, and it
//     hits the lattice and rebounds a little before settling against it.
//
// Both are pure in u, and they agree at every pull's end — the gap always
// closes, because the coat is still the only motor.
export const CLATHRIN_PULLS = 3
const BUILD_FROM = 0.38
const BUILD_TO = 0.66

const pullPhase = (u: number): { k: number; q: number } => {
  const t = Math.max(0, Math.min(1, (u - BUILD_FROM) / (BUILD_TO - BUILD_FROM)))
  const raw = Math.min(CLATHRIN_PULLS - 1e-9, t * CLATHRIN_PULLS)
  return { k: Math.floor(raw), q: raw - Math.floor(raw) }
}

/** The coat's own progress, 0→1 — the LEADING curve. Monotone: a ratchet never
 *  gives back. */
export function clathrinPullAt(u: number): number {
  if (u <= BUILD_FROM) return 0
  if (u >= BUILD_TO) return 1
  const { k, q } = pullPhase(u)
  // Fast start, eased stop, finished by 45% of the pull — then it WAITS, which
  // is the "slows down" the membrane snaps into.
  const step = Math.min(1, q / 0.45)
  return (k + (1 - (1 - step) * (1 - step))) / CLATHRIN_PULLS
}

/** The membrane's depth, 0→1 — the LAGGING curve, and the snap. Holds while the
 *  coat pulls away, crosses the gap fast, rebounds off the lattice, settles. */
export function clathrinBuildAt(u: number): number {
  if (u <= BUILD_FROM) return 0
  if (u >= BUILD_TO) return 1
  const { k, q } = pullPhase(u)
  if (q < 0.25) return k / CLATHRIN_PULLS
  const s = Math.min(1, (q - 0.25) / 0.75)
  // The snap: ease-OUT — all the speed at the start, which is what a snap is.
  // Then the bounce: it reaches the lattice at 55% and dips a tenth of the
  // step before settling against it.
  //
  // ⚠ EXCEPT THE LAST PULL (21c-12): its rebound dipped the bud's foot back
  // through the wall it had just cleared, and `wallShiftFor` flickered 17 px
  // on/off — measured, a 14 px twitch at u = 0.66. The final pull lands
  // without a rebound, settling against the finished lattice, which is also
  // what running out of slack looks like.
  const last = k === CLATHRIN_PULLS - 1
  const p =
    s <= 0.55
      ? 1 - (1 - s / 0.55) * (1 - s / 0.55)
      : last
        ? 1
        : 1 - 0.1 * Math.sin((Math.PI * (s - 0.55)) / 0.45)
  return (k + p) / CLATHRIN_PULLS
}

/** ⚠ THE NECK (21c-12, user: "lipid ball creates a 'neck', which gets…
 *  tightened and cut by dynamin"). Between the build's end and the cut, the
 *  bud stands on a stalk of membrane: two strands from the wall's opening to
 *  the bud's foot, narrowing as the coil squeezes, gone at the cut. Null
 *  outside that window. */
export const NECK_FROM = BUILD_TO
export const NECK_CUT = 0.82

export function clathrinNeckAt(
  g: SnareGeometry,
  u: number,
): { baseHalf: number; topY: number; squeeze: number } | null {
  if (u < NECK_FROM || u >= NECK_CUT) return null
  const b = bubblesAt(g, 'clathrin', u)[0]
  const squeeze = Math.max(0, Math.min(1, (u - NECK_FROM) / (NECK_CUT - NECK_FROM)))
  const baseHalf = g.r * 0.52 * (1 - 0.82 * squeeze) + 2
  return { baseHalf, topY: b.cy + b.r * 0.92, squeeze }
}

/** ⚠ THE CUT, VISIBLE (21c-13, user: "…a more visible neck which gets cut").
 *  The stalk used to vanish between two frames; a severed thing has two ENDS.
 *  For a beat after the cut, the neck's two stubs recoil — the lower one down
 *  into the wall, the upper one up into the freed bud — fading as they go.
 *  Null outside that beat. */
export const NECK_STUB_MS = 0.035

export function clathrinStubsAt(
  g: SnareGeometry,
  u: number,
): { cutY: number; lowerTop: number; upperBot: number; half: number; alpha: number } | null {
  if (u < NECK_CUT || u >= NECK_CUT + NECK_STUB_MS) return null
  const b = bubblesAt(g, 'clathrin', u)[0]
  const topY = b.cy + b.r * 0.92
  const cutY = (topY + g.wallY) / 2
  const w = (u - NECK_CUT) / NECK_STUB_MS
  return {
    cutY,
    lowerTop: cutY + (g.wallY - cutY) * w,
    upperBot: cutY + (topY - cutY) * w,
    half: g.r * 0.52 * 0.18 + 2,
    alpha: 1 - w,
  }
}

export function coatAt(route: RetrievalId, u: number): number {
  if (route !== 'clathrin') return 0
  const t = Math.max(0, Math.min(1, u))
  // ⚠ Builds GRADUALLY across a third of the run (21c-10): the coverage is the
  // motor, so its ramp is the sucking-in the child watches — triskelions
  // landing one by one while the membrane curls back under them. Stripped over
  // 0.84→0.94, AFTER the pinch has freed the bubble.
  if (t < 0.84) return clathrinPullAt(t)
  return Math.max(0, 1 - (t - 0.84) / 0.1)
}

export function collarAt(route: RetrievalId, u: number): number {
  if (route !== 'clathrin') return 0
  const t = Math.max(0, Math.min(1, u))
  if (t < 0.68 || t > 0.84) return 0
  return Math.sin(((t - 0.68) / 0.16) * Math.PI)
}

/** ⚠ THE PANEL'S GEOMETRY — the SNARE bench's, with ONE number changed.
 *
 *  That bench sizes its vesicle at a seventh of its frame, which is right when
 *  the frame is the whole drawer and the vesicle is the subject. Here there are
 *  three frames across one drawer AND the ultrafast dent has to stand beside the
 *  vesicle without touching it. Measured at the bench's own ratio: the dent
 *  either overlapped the vesicle it is meant to be beside, or ran off the right
 *  edge — there was no offset that did neither. A smaller vesicle buys the room,
 *  and nothing else about the wall or its molecules changes. */
export function panelGeometry(w: number, h: number): SnareGeometry {
  const g = snareGeometry(w, h)
  // ⚠ Sized off the WIDTH, mostly: a panel here is a portrait column (measured
  // at a real viewport: 317 × 696), and the SNARE bench's own ratio — a
  // seventh of the frame — makes a vesicle far too big for the width and far
  // too small for the height. The width is what has to hold the vesicle AND
  // the dent beside it, so the width sets the size and the height becomes the
  // journey down from the crowd, which is what the height is for.
  const r = Math.min(w * 0.11, h * 0.08)
  return { ...g, r, highY: r + 84, freeY: g.wallY - LIPID.halfMem - r - r * 0.55 }
}

// ⚠ The coat's and dynamin's inks and shapes live in `stage/clathrin.ts` — one
// owner, shared with the SNARE bench (21c-10).

export interface PanelView {
  route: RetrievalId
  u: number
  width: number
  height: number
  /** ⚠ THE THERMAL CLOCK — screen time, not the run's position. Molecules
   *  jostle whether or not anything is happening; a membrane that freezes when
   *  the animation ends is a membrane made of stone. */
  ms?: number
}

const hash = (i: number, salt: number): number => {
  const h = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return h - Math.floor(h)
}

export const CARGO_N = 7

/** ⚠ THE TRANSMITTER (21c-8, user: "display neurotransmitter release. The NT
 *  balls then drift away from the screen").
 *
 *  The panels showed retrieval as if the vesicle arrived empty — but every one
 *  of these runs BEGINS with exocytosis, and exocytosis without cargo is a
 *  bubble docking for no reason. Seven balls, seeded seats, one model for the
 *  three routes; only the MOUTH differs, which is the honest difference:
 *
 *   • kiss-and-run — out single file through the narrow pore, while it is open
 *     and only while it is open;
 *   • the collapsing routes — out through the widening mouth as the vesicle
 *     opens into the wall.
 *
 *  Released balls drift down into the cleft — the outside is below the wall in
 *  this register — and off the frame, collected by machinery this panel does
 *  not show. Nothing fades: they leave by travelling. */
export function cargoAt(
  g: SnareGeometry,
  route: RetrievalId,
  u: number,
): { x: number; y: number; free: boolean }[] {
  const t = Math.max(0, Math.min(1, u))
  const out: { x: number; y: number; free: boolean }[] = []
  // When each ball is let out: single file through kiss-and-run's pore (its
  // open window), through the widening mouth as the collapsing routes flatten.
  const window: [number, number] = route === 'kiss' ? [0.24, 0.46] : [0.17, 0.29]
  for (let i = 0; i < CARGO_N; i++) {
    const uRel = window[0] + ((window[1] - window[0]) * (i + 0.5)) / CARGO_N
    // ⚠ ITS SEAT, IN THE VESICLE, FROM THE FIRST FRAME — and FROZEN at the
    // moment it leaves (21c-9, user: "NTs should be present in vesicles from
    // the 1st frame. Currently teleport"). Seeded, so the same ball has the
    // same seat every run.
    const a = hash(i, 1) * Math.PI * 2
    const rr = Math.sqrt(hash(i, 2)) * 0.6
    const seatIn = (at: number) => {
      const carrier = bubblesAt(g, route, at)[0]
      const cr = carrier?.r ?? g.r
      return {
        x: (carrier?.cx ?? g.cx) + Math.cos(a) * rr * cr,
        y: (carrier?.cy ?? g.wallY) + Math.sin(a) * rr * cr,
      }
    }
    if (t < uRel) {
      out.push({ ...seatIn(t), free: false })
      continue
    }
    // ⚠ AND IT TRAVELS OUT THROUGH THE MOUTH. It used to jump from its seat
    // straight to a point below the wall on the frame it was released — the
    // teleport. The pass is a quadratic pinched at the mouth: it leaves the
    // seat it was sitting in, threads the opening, and carries on in the very
    // direction it left with, so there is no corner either.
    const carrier = bubblesAt(g, route, uRel)[0]
    const from = seatIn(uRel)
    const mouth = {
      x: route === 'kiss' ? (carrier?.cx ?? g.cx) : g.cx + (hash(i, 4) - 0.5) * g.r,
      y: g.wallY,
    }
    const vx = (hash(i, 3) - 0.5) * (route === 'kiss' ? 0.12 : 0.5) * g.wallY
    const vy = g.wallY * 1.4
    const dt = t - uRel
    if (dt < CARGO_EXIT_U) {
      const q = dt / CARGO_EXIT_U
      const exit = { x: mouth.x + vx * CARGO_EXIT_U, y: mouth.y + vy * CARGO_EXIT_U }
      const p1 = { x: from.x + (mouth.x - from.x) * q, y: from.y + (mouth.y - from.y) * q }
      const p2 = { x: mouth.x + (exit.x - mouth.x) * q, y: mouth.y + (exit.y - mouth.y) * q }
      out.push({
        x: p1.x + (p2.x - p1.x) * q,
        y: p1.y + (p2.y - p1.y) * q,
        // It counts as free the moment it is past the wall line.
        free: p1.y + (p2.y - p1.y) * q > g.wallY,
      })
      continue
    }
    out.push({ x: mouth.x + vx * dt, y: mouth.y + vy * dt, free: true })
  }
  return out
}

/** How long a ball takes to thread the mouth, in u. */
export const CARGO_EXIT_U = 0.05

/** ⚠ HOW FAR THE WALL IS PARTED, AND WHERE — a named decision, so "does the
 *  bilayer twitch?" is a question a guard can ask instead of a thing an eye
 *  has to catch (21c-9).
 *
 *  The room the crowd must make is `wallShiftFor` asked of whichever bubble is
 *  furthest into the wall, and it is made AROUND that bubble, because the
 *  ultrafast dent opens the wall beside the active zone rather than in it.
 *
 *  ⚠ Its CONTINUITY is a property of the bubbles, not of a smoothing applied
 *  here: nothing is eased or clamped in this function. A vesicle absorbed into
 *  the wall shrinks to nothing rather than being culled, and a pit grows from
 *  nothing rather than arriving whole — so this comes out continuous by
 *  construction, and the guard that walks it is testing the model, not a
 *  filter over it. */
export function wallOpenAt(
  g: SnareGeometry,
  route: RetrievalId,
  u: number,
): { shift: number; about: number } {
  let shift = 0
  let about = g.cx
  for (const b of bubblesAt(g, route, u)) {
    const s = wallShiftFor(g, b.cy, b.r)
    if (s > shift) {
      shift = s
      about = b.cx
    }
  }
  // ⚠ WHILE THE NECK STANDS, THE WALL STAYS OPEN NECK-WIDE (21c-12): the bud
  // has cleared the wall, so `wallShiftFor` says 0 — but a neck passes through
  // the wall, and a crowd closed under a standing stalk is a wall drawn through
  // a membrane. The opening tracks the neck's own base and fades shut over the
  // beat after the cut, so nothing snaps.
  if (route === 'clathrin') {
    const neck = clathrinNeckAt(g, u)
    if (neck) {
      // Fading IN too: at the build's end `wallShiftFor` has just run out (the
      // bud is clear), and an opening that arrives whole is the same one-frame
      // snap the cut's fade-out exists to prevent.
      const grow = Math.min(1, (u - NECK_FROM) / 0.025)
      shift = Math.max(shift, (neck.baseHalf + 2) * grow)
    } else if (u >= NECK_CUT && u < NECK_CUT + 0.04) {
      const lastHalf = g.r * 0.45 * (1 - 0.82) + 2
      shift = Math.max(shift, (lastHalf + 2) * (1 - (u - NECK_CUT) / 0.04))
    }
  }
  return { shift, about }
}

export const COAT_N = 11

export interface CoatPiece {
  /** ⚠ WHICH triskelion this is (21c-15) — loose matter has identity in this
   *  app, and a guard that tracks smoothness has to follow the SAME piece from
   *  frame to frame. Keyed by its seat along the arc. */
  k: number
  at: Pt2
  rot: number
  size: number
  /** 0 → just setting off, 1 → stuck to the membrane. */
  landed: number
}

interface Pt2 {
  x: number
  y: number
}

/** ⚠ THE COAT'S PIECES — where each triskelion IS, at full strength (21c-14).
 *
 *  A piece is either on its way, stuck, or gone; it is never a ghost. It flies
 *  in from the cytosol — which in this register is ABOVE the wall, off the top
 *  of the frame — to its own seat on the bud's cytosolic face, tumbling as it
 *  goes and settling to its final angle. They land APEX FIRST and each later
 *  one is added on the membrane side of those already there.
 *
 *  On the way out they do the reverse: pushed off the rim outward and up, back
 *  the way they came, rather than dissolving where they stand.
 *
 *  Returns only pieces that are actually in the picture, so a caller cannot
 *  draw a not-yet-started one by accident. */
export function coatPiecesAt(
  g: SnareGeometry,
  route: RetrievalId,
  u: number,
): CoatPiece[] {
  if (route !== 'clathrin') return []
  const b = bubblesAt(g, route, u)[0]
  if (!b) return []
  const cover = clathrinPullAt(u)
  if (cover <= 0) return []
  // The lattice leads the membrane (21c-12): its centre rides the coat's own
  // curve, so during a pull the pinwheels hover a visible gap above the bud.
  const latticeCy = b.cy - (cover - clathrinBuildAt(u)) * (2 * g.r)
  // How far the coat has been stripped, 0→1 — the same window `coatAt` sheds
  // over, read here so the flight out and the coverage cannot disagree.
  const shed = Math.max(0, Math.min(1, (u - 0.84) / 0.1))
  const size = Math.max(6, b.r * 0.34)
  const rr = b.r + LIPID.halfMem * 1.3
  const out: CoatPiece[] = []
  for (let k = 0; k < COAT_N; k++) {
    const h = Math.sin(k * 91.7 + 2.3) * 43758.5453
    const j = h - Math.floor(h)
    const order = coatOrder(k, COAT_N)
    const a = Math.PI + ((k + 0.5) / COAT_N) * Math.PI
    const seat = { x: b.cx + Math.cos(a) * rr, y: latticeCy + Math.sin(a) * rr }
    // Only the part standing proud of the wall wears the lattice.
    if (seat.y > g.wallY - 2) continue
    // ⚠ IN FROM THE LEFT AND THE RIGHT (21c-15, user: "clathrin should fly from
    // left and right"). Each piece comes from the side its own seat is on, so
    // the two arms of the arc are fed by two streams and nothing crosses the
    // dome to reach its place.
    const side: -1 | 1 = seat.x < b.cx ? -1 : 1
    // ⚠ AND IT WAITS AT A STATIC POINT. The hover is anchored to the WALL, not
    // to the bud: the bud's height ratchets, and a piece parked on a ratcheting
    // reference bobs with it — a jerk with no cause the child can see. Hovering
    // here, the only ratcheted motion left is the settle itself, which is the
    // one the user asked to see.
    const hover = {
      x: b.cx + side * g.r * (2.5 + 0.5 * j),
      y: g.wallY - g.r * (1 + 1.1 * order + 0.35 * j),
    }
    const from = { x: side < 0 ? g.left - size * 3 : g.right + size * 3, y: hover.y }
    const fly = coatFlyAt(order, u, BUILD_FROM, BUILD_TO - BUILD_FROM)
    if (fly <= 0) continue
    const land = coatSettleAt(order, u, BUILD_FROM, BUILD_TO - BUILD_FROM)
    // Leaving: the rim goes first, back out the way it came.
    const off = Math.max(0, Math.min(1, (shed - (1 - order) * 0.3) / 0.7))
    if (off >= 1) continue
    // ⚠ ONE CONTINUOUS PATH, in two eased legs: off-frame → its waiting place →
    // its seat. Both legs are smooth at both ends, so there is no break where
    // they meet.
    const wx = from.x + (hover.x - from.x) * fly
    const wy = from.y + (hover.y - from.y) * fly
    const at = {
      x: wx + (seat.x - wx) * land + (seat.x - b.cx) * off * 1.4,
      y: wy + (seat.y - wy) * land - off * g.r * 1.6,
    }
    out.push({
      k,
      at,
      // Tumbling on the way in, straightening as it takes its place.
      rot: a + j * 2 + (1 - fly) * 2.2 + (1 - land) * 1.2,
      size,
      landed: land,
    })
  }
  return out
}

export function drawPanel(ctx: CanvasRenderingContext2D, v: PanelView): void {
  const g = panelGeometry(v.width, v.height)
  const bubbles = bubblesAt(g, v.route, v.u)
  const collar = collarAt(v.route, v.u)

  ctx.clearRect(0, 0, v.width, v.height)
  // ⚠ EXACTLY THE SNARE BENCH'S ONE WASH, and nothing else (21c-7, user:
  // "change background color, unless strictly necessary for animation
  // effect"). This panel used to fill its whole canvas and then wash the
  // WRONG side — cytoplasm below the wall, where the cleft is. The snare
  // bench paints one rect: OUTSIDE below the wall. That one is necessary —
  // the lumen is painted in the same ink, which is what makes fusion
  // seamless — and everything above the wall is the container's own ground,
  // like every other panel in this layout.
  ctx.fillStyle = OUTSIDE
  ctx.fillRect(0, g.wallY, v.width, v.height - g.wallY)

  // Each vesicle's lumen first — it IS the outside, folded in, which is why
  // nothing has to change colour when the mouth opens.
  for (const b of bubbles) {
    const lum = lumenArc(g, b.cy)
    ctx.fillStyle = LUMEN
    ctx.beginPath()
    if (lum === 'full') {
      ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2)
    } else if (lum !== 'none') {
      ctx.arc(b.cx, b.cy, lum.rLum, Math.PI - lum.a, lum.a, false)
    }
    ctx.closePath()
    ctx.fill()
  }

  // ⚠ THE WALL OPENS (21c-6, user: "cell membrane remains solid during
  // animation. Expected: it visually opens up"). It was paved at shift 0 — a
  // wall that stays whole while a vesicle merges into it, which is the one
  // thing a merge is not. The room the crowd has to make is `wallShiftFor`, the
  // SNARE bench's own arithmetic, asked of whichever vesicle is furthest into
  // the wall — and it is made AROUND that vesicle, because ultrafast's dent
  // opens the wall beside the active zone rather than in it.
  const open = wallOpenAt(g, v.route, v.u)
  paveMembrane(ctx, wallPoints(g, open.shift, open.about), {
    geom: LIPID,
    first: 0,
    taperOver: 3,
    // ⚠ AND IT IS ALIVE (21c-6): the thermal clock, so the crowd jostles.
    ms: v.ms ?? 0,
    jitter: 0.5,
  })

  // …and each vesicle, as molecules, on the same paver. `omegaRing` unrolls
  // whatever has passed the wall ALONG it, so a vesicle becomes wall by
  // travelling and never by vanishing.
  for (const [i, b] of bubbles.entries()) {
    paveMembrane(ctx, omegaRing(g, b.cx, b.cy, b.r), {
      geom: LIPID,
      first: 500 + i * 97,
      taperOver: 0,
      ms: v.ms ?? 0,
      jitter: 0.5,
    })
  }

  // ⚠ THE TRANSMITTER — released through the mouth, drifting off the frame.
  for (const c of cargoAt(g, v.route, v.u)) {
    if (c.y > v.height + 6) continue
    transmitterDot(ctx, c.x, c.y, 3.2)
  }

  // ⚠ THE COAT — TRISKELIONS, not studs or arcs (21c-10, handover panel A/B).
  // Each lands on the bud's cytosolic face on its own staggered beat, and the
  // count the child sees grow IS the number driving the bud's depth, because
  // `bubblesAt` derives the depth from the same `coatAt`.
  // ⚠ THE COAT — triskelions that FLY IN and STICK (21c-10, 21c-14). Every one
  // is drawn at full strength: a piece is on its way, stuck, or gone, never a
  // ghost. `coatPiecesAt` owns where each one is.
  for (const piece of coatPiecesAt(g, v.route, v.u)) {
    drawTriskelion(ctx, piece.at, piece.size, piece.rot, 1)
  }

  // ⚠ THE NECK — membrane, not a gap (21c-12). Two strands of the same lipids
  // from the wall's opening to the bud's foot, their lumen the outside's own
  // ink (it IS the outside, up the stalk), narrowing under the coil until the
  // cut.
  if (v.route === 'clathrin') {
    const neck = clathrinNeckAt(g, v.u)
    if (neck) {
      const b = bubbles[0]
      ctx.fillStyle = LUMEN
      ctx.beginPath()
      ctx.moveTo(b.cx - neck.baseHalf, g.wallY)
      ctx.lineTo(b.cx - neck.baseHalf * 0.8, neck.topY)
      ctx.lineTo(b.cx + neck.baseHalf * 0.8, neck.topY)
      ctx.lineTo(b.cx + neck.baseHalf, g.wallY)
      ctx.closePath()
      ctx.fill()
      for (const side of [-1, 1] as const) {
        const pts = []
        const nSeg = 4
        for (let i = 0; i <= nSeg; i++) {
          const f = i / nSeg
          const x = b.cx + side * (neck.baseHalf + (neck.baseHalf * 0.8 - neck.baseHalf) * f)
          const y = g.wallY + (neck.topY - g.wallY) * f
          pts.push({
            at: { x, y },
            tangent: { x: 0, y: -1 },
            inward: { x: side, y: 0 },
          })
        }
        paveMembrane(ctx, pts, { geom: LIPID, first: 900 + (side + 1) * 40, taperOver: 0, ms: v.ms ?? 0 })
      }
    }
    // ⚠ The cut has two ENDS (21c-13): for a beat the severed stubs recoil —
    // down into the wall, up into the freed bud — in the same lipids, fading.
    const stubs = clathrinStubsAt(g, v.u)
    if (stubs) {
      const b = bubbles[0]
      ctx.save()
      ctx.globalAlpha *= stubs.alpha
      for (const side of [-1, 1] as const) {
        for (const [from, to, seed] of [
          [g.wallY, stubs.lowerTop, 900],
          [stubs.upperBot, b.cy + b.r * 0.92, 960],
        ] as const) {
          if (Math.abs(to - from) < 3) continue
          const pts = []
          const nSeg = 2
          for (let i = 0; i <= nSeg; i++) {
            const f = i / nSeg
            pts.push({
              at: { x: b.cx + side * stubs.half, y: from + (to - from) * f },
              tangent: { x: 0, y: -1 },
              inward: { x: side, y: 0 },
            })
          }
          paveMembrane(ctx, pts, {
            geom: LIPID,
            first: seed + (side + 1) * 40,
            taperOver: 0,
            ms: v.ms ?? 0,
          })
        }
      }
      ctx.restore()
    }
  }

  // ⚠ DYNAMIN — a COIL of turns wrapped round the NECK, as the handover draws
  // it, squeezing as it constricts. The bar it replaces was also wearing NSF's
  // fuchsia; the coil wears dynamin's own blue.
  if (collar > 0.02) {
    const b = bubbles[0]
    const neckTop = b.cy + b.r * 0.55
    const height = Math.max(6, g.wallY - neckTop) * 0.7
    drawDynamin(
      ctx,
      { x: b.cx, y: (neckTop + g.wallY) / 2 },
      b.r * 0.5,
      height,
      collar,
      collar,
    )
  }
}

/** How long one run takes on screen. The three are played at the SAME length on
 *  purpose — the shapes are what is being compared; their real times differ by
 *  more than tenfold and are said in the info block, where a number can be read
 *  aloud. ⚠ 7 s → 11 s (21c-13, user: "make endocytosis slower") — the ratchet
 *  gained beats worth watching, and at 7 s each pull was under a second. */
export const PANEL_MS = 11000

// ⚠ THE PANELS ARE MEASURED THE WAY 'ION CHANNEL TYPES' MEASURES ITS OWN
// (21c-7). D04 — the layout this exhibit copies — solves its sizes from the
// drawer's real content box, then subtracts what each container stacks around
// its canvas: the headline row, the gap, the action button. Same arithmetic,
// three containers instead of four, a run-all row above them, and no caption
// slot (nothing needs explaining that the info block does not carry).
const VIEW_W2 = typeof window !== 'undefined' ? window.innerWidth : 1440
const VIEW_H2 = typeof window !== 'undefined' ? window.innerHeight : 860
const DRAWER_W = Math.min(VIEW_W2, 1376)
const CONTENT_W = Math.max(660, DRAWER_W - 40 - 256 - 24 - 12)
const CONTENT_H = Math.max(520, VIEW_H2 - 48 - 8)
/** Three containers, their gaps, their padding and their borders. */
const PANEL_CHROME = 3 * (2 * 8 + 2) + 2 * 10
/** What each container stacks besides its canvas: the action button and the
 *  column's gaps. The headline is the 22 the height arithmetic below carries,
 *  exactly as D04 carries its own. */
const PANEL_HEAD = 38 + 8
/** The run-all row above the three containers, and its gap. */
export const RUNBAR_H = 38 + 8

export const PANEL_W = Math.floor((CONTENT_W - 20 - PANEL_CHROME) / 3)
export const PANEL_H = Math.round(CONTENT_H - 22 - PANEL_HEAD - 18 - RUNBAR_H)

export { retrievalOf }
