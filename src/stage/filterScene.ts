import { IONS } from '../core/ions'
import { FILTER_SITES } from '../core/channelStructure'
import {
  drawChargeDot,
  drawGlossyIon,
  drawIonCharge,
  glossySphere,
} from './particleStyle'
import { drawTraveller, TRAVELLER_MAG, ATOM_R_NM } from './permeaScene'
import { PX_PER_NM } from './bilayer'
import { PX_PER_UM } from './layout'
import { ELEMENT_COLOR } from './lipidLabScene'
import { HELIX_LIGHT, HELIX_MID, WATERS_IN_COAT, BODY_RGB } from './channelScene'
import { spoken, drawSpoken, type SpokenLabel } from './spokenLabels'

// D15 — inside the selectivity filter. ONE LANE PER PANEL, two panels side by
// side in their own containers, the equilibrium bench's layout.
//
// ── The mechanism, written down, because it has now been got wrong twice ───
//
// It is NOT a sieve, and it is NOT that sodium is somehow unwilling to
// undress. It is an EXCHANGE, and an exchange only happens if what is offered
// is as good as what is given up.
//
//   • In water no ion is bare: each wears a coat of water molecules held at a
//     particular distance. Sodium's coat is the BIGGER of the two — 0.72 nm
//     against potassium's 0.66 — even though bare sodium is the smaller ion.
//     A smaller ball with the same charge pulls water in harder and holds
//     more of it. (This is the answer to "but they look the same size": they
//     are not, and the one that looks fatter is the smaller ion.)
//   • Neither coat fits a filter 0.3 nm wide, so neither ion goes through
//     dressed. Something has to take the water's place.
//   • The filter offers carbonyl oxygens set at exactly the distance the
//     waters sit at FOR POTASSIUM. Each closing oxygen arrives where a water
//     was, the swap costs almost nothing, and potassium goes through wearing
//     oxygens instead of water.
//   • The protein does exactly the same thing when sodium arrives. It cannot
//     tell them apart and does not try. But sodium is smaller, so the oxygens
//     close to the same place and end up SHORT OF ITS SURFACE. Nothing worth
//     trading for arrives, the water is never displaced, and dressed, sodium
//     cannot get in.
//
// So: the water comes off only when something better arrives to replace it.
// The picture has to show an oxygen arriving and NOT REACHING — a gap of
// 0.04 nm, far too small to see at a scale that also shows the passage. Hence
// the inset: the app's own two-frame magnification, once per lane.

const VIEW_W = typeof window !== 'undefined' ? window.innerWidth : 1440
const VIEW_H = typeof window !== 'undefined' ? window.innerHeight : 860
const DRAWER_W = Math.min(VIEW_W, 1376)
const CONTENT_W = Math.max(660, DRAWER_W - 40 - 256 - 24 - 12)
const CONTENT_H = Math.max(520, VIEW_H - 48 - 8)

/** Two panels side by side, each in its own bordered container — the
 *  equilibrium bench's layout (user, 2026-08-28). One canvas holding two
 *  lanes read as one wide picture of one thing; two containers read as two
 *  experiments run side by side, which is what they are. */
const PANEL_GAP = 16
/** The controls have their own row above the panels, so the panels have to be
 *  measured AROUND it — the same lesson the channel bench's size key taught
 *  (2026-08-28). Button height, the gap under it, and the panels' own padding
 *  and border. */
export const CONTROL_ROW_H = 42 + 12
export const LANE_W = Math.floor((CONTENT_W - PANEL_GAP - 20) / 2)
export const LANE_H = Math.round(CONTENT_H - CONTROL_ROW_H - 22)
/** Everything the right-hand column stacks must fit inside this. */
export const FZ_BUDGET = CONTENT_H
export const FZ_BUDGET_W = CONTENT_W

export const LANE_KIND = ['k', 'na'] as const
export type LaneKind = (typeof LANE_KIND)[number]

const TOP_Y = 64
const BOT_Y = LANE_H - 56

/** Van der Waals radius of the filter's oxygens, from the app's one table. */
const OXY_R_NM = ATOM_R_NM.O
/** How far a gripping oxygen's CENTRE sits from the axis. The cage is built to
 *  touch POTASSIUM, so it is potassium's radius plus an oxygen's — and it is
 *  the SAME in both lanes, because it is the same filter doing the same
 *  thing. What differs is the ion that has to fill it. */
const CAGE_NM = IONS.k.bareNm / 2 + OXY_R_NM
/** Where they sit before an ion arrives. */
const REST_NM = CAGE_NM + 0.1
/** Rungs a third of a nanometre apart, as a real signature sequence's are. */
const SITE_NM = 0.33
/** The mouth below the filter, and the room above it — drawn so a panel shows
 *  a PASSAGE with something travelling through it, rather than two enormous
 *  atoms filling the frame (user, 2026-08-28). */
const MOUTH_NM = 1.5
const EXIT_NM = 0.7
const TRAVEL_NM = FILTER_SITES * SITE_NM + MOUTH_NM + EXIT_NM

/** ONE RULER for the panel, derived: tall enough to show the whole passage,
 *  narrow enough to fit the panel's width. */
const LANE_HALF_NM = CAGE_NM + OXY_R_NM + 0.55
export const FZ_PX_PER_NM = Math.min(
  (BOT_Y - TOP_Y) / TRAVEL_NM,
  LANE_W / 2 / LANE_HALF_NM,
)
export const FZ_MAG = Math.round(FZ_PX_PER_NM / (PX_PER_UM / 1000))

/** The inset's extra magnification on top of the panel's. The gap the whole
 *  exhibit is about is 0.04 nm — a few pixels at a scale that also shows the
 *  passage, and invisible. So it gets the two-frame treatment: a small amber
 *  ring on the site, a big one in the corner, dashed lines between. Magnify
 *  the whole inset, never one object inside it. */
export const INSET_MAG = 4.2
export const INSET_R = 72

const RUNG_GAP = SITE_NM * FZ_PX_PER_NM
const OXY_R = OXY_R_NM * FZ_PX_PER_NM
const REST_REACH = REST_NM * FZ_PX_PER_NM
const HOLD_REACH = CAGE_NM * FZ_PX_PER_NM
const WALL_X = LANE_HALF_NM * FZ_PX_PER_NM

const OXY = ELEMENT_COLOR.O
const CARB = ELEMENT_COLOR.C
const RING = '#f59e0b'

/** The daylight left round an ion once the oxygens have closed as far as the
 *  cage allows: zero for the ion the cage was built for, and a real distance
 *  for anything smaller. THE mechanism, as a number a test can hold. */
export function gripGapNm(kind: LaneKind): number {
  return CAGE_NM - OXY_R_NM - IONS[kind].bareNm / 2
}

/** Does the swap happen? Only where the oxygen actually arrives at the ion's
 *  surface. The one predicate the exhibit turns on — the drawing and the
 *  words both READ it rather than each deciding for themselves. */
export function swapHappens(kind: LaneKind): boolean {
  return gripGapNm(kind) < 0.01
}

export interface LanePose {
  /** Along the lane: 0 at the bottom mouth, 1 out of the top. */
  t: number
  /** How much of the water coat is still on, 1→0. */
  coat: number
  /** How far the oxygens have closed, 0→1. The SAME in both lanes. */
  reach: number
  settled: boolean
  /** It is out of the top and on its way. */
  gone: number
}

export const RUN_MS = 5200

/** Where site i sits along the lane, 0→1 — asked of the geometry, never a
 *  guessed fraction, so the ion stops ON a rung and not between two. */
export const siteT = (i: number): number =>
  (MOUTH_NM * FZ_PX_PER_NM + i * RUNG_GAP) / (BOT_Y - TOP_Y)

export function lanePoseAt(kind: LaneKind, ms: number): LanePose {
  const u = Math.max(0, Math.min(1, ms / RUN_MS))
  const first = siteT(0)
  // Leg 1 — up the mouth, coat on. Quick: it is only travelling.
  if (u < 0.2) return { t: (u / 0.2) * first, coat: 1, reach: 0, settled: false, gone: 0 }
  // Leg 2 — the WORK, and most of the window. The oxygens close, identically
  // in both lanes. Whether the coat goes is decided by whether they arrive.
  if (u < 0.66) {
    const w = (u - 0.2) / 0.46
    return {
      t: first,
      // Sodium's coat stirs and settles back: the swap is OFFERED to both and
      // completes for only one. A coat that never moved at all would say the
      // filter turned sodium away at the door, which is not what happens —
      // sodium gets there and finds nothing worth trading for.
      coat: swapHappens(kind) ? 1 - w : 1 - 0.18 * Math.sin(Math.PI * w),
      reach: w,
      settled: false,
      gone: 0,
    }
  }
  const e = (u - 0.66) / 0.34
  if (swapHappens(kind)) {
    return {
      t: first + e * (1 - first),
      coat: 0,
      reach: 1,
      settled: true,
      gone: Math.max(0, (e - 0.7) / 0.3),
    }
  }
  // Still dressed, so it cannot get in. Back down the way it came.
  return { t: first * (1 - e), coat: 1, reach: 1 - e, settled: true, gone: 0 }
}

export const runOver = (ms: number) => ms >= RUN_MS

const laneY = (t: number): number => BOT_Y - t * (BOT_Y - TOP_Y)

export function laneLabels(kind: LaneKind): SpokenLabel[] {
  return [
    spoken('carbonyl oxygen', 30, TOP_Y - 22),
    spoken('water coat', LANE_W - 30, TOP_Y - 22, 'right'),
    spoken(kind === 'k' ? 'potassium' : 'sodium', LANE_W / 2 - 24, LANE_H - 14),
  ]
}

/** The magnified site: one oxygen arriving at one ion, at four times the
 *  panel's scale, so 0.04 nm of daylight is daylight you can see. */
function drawInset(
  ctx: CanvasRenderingContext2D,
  kind: LaneKind,
  cx: number,
  cy: number,
  reach: number,
): void {
  const px = FZ_PX_PER_NM * INSET_MAG
  const bare = (IONS[kind].bareNm / 2) * px
  const oxy = OXY_R_NM * px
  const at = (REST_NM - (REST_NM - CAGE_NM) * reach) * px
  // The two SURFACES, with the daylight between them straddling the middle
  // of the frame. Whole spheres will not fit at this magnification and do not
  // need to: what is being looked at is whether an oxygen reaches an ion, and
  // that happens at their surfaces. The circle crops the rest.
  const gapPx = at - bare - oxy
  const ionX = cx - gapPx / 2 - bare
  const oxyX = cx + gapPx / 2 + oxy

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, INSET_R, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = 'rgba(2, 6, 23, 0.94)'
  ctx.fillRect(cx - INSET_R, cy - INSET_R, INSET_R * 2, INSET_R * 2)
  drawGlossyIon(ctx, kind, ionX, cy, bare)
  glossySphere(ctx, oxyX, cy, oxy, OXY)
  drawChargeDot(ctx, oxyX - oxy * 0.5, cy - oxy * 0.62, Math.min(9, oxy * 0.22), -1)
  ctx.restore()

  ctx.strokeStyle = RING
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(cx, cy, INSET_R, 0, Math.PI * 2)
  ctx.stroke()
}

export function drawLane(
  ctx: CanvasRenderingContext2D,
  kind: LaneKind,
  ms: number | null,
  labelsOn = true,
): void {
  const cx = LANE_W / 2
  const pose =
    ms === null
      ? { t: 0, coat: 1, reach: 0, settled: false, gone: 0 }
      : lanePoseAt(kind, ms)
  const ion = IONS[kind]
  const bare = (ion.bareNm / 2) * FZ_PX_PER_NM
  const coatR = (ion.hydratedNm / 2) * FZ_PX_PER_NM
  const ionY = laneY(pose.t)

  // The wall the passage runs through, in the channel's own violet.
  const wallW = LANE_W / 2 - WALL_X
  for (const side of [-1, 1] as const) {
    const g = ctx.createLinearGradient(
      cx + side * WALL_X,
      0,
      cx + side * (WALL_X + wallW),
      0,
    )
    g.addColorStop(0, `rgba(${BODY_RGB}, 0.85)`)
    g.addColorStop(1, `rgba(${BODY_RGB}, 0.3)`)
    ctx.fillStyle = g
    ctx.fillRect(side < 0 ? 0 : cx + WALL_X, TOP_Y - 34, wallW, BOT_Y - TOP_Y + 68)
  }

  const carbR = ATOM_R_NM.C * FZ_PX_PER_NM
  const filterFoot = BOT_Y - MOUTH_NM * FZ_PX_PER_NM
  let sitePoint = { x: cx, y: filterFoot }
  for (let i = 0; i < FILTER_SITES; i++) {
    const y = filterFoot - i * RUNG_GAP
    const near = Math.max(0, 1 - Math.abs(y - ionY) / (RUNG_GAP * 1.4))
    const reach = REST_REACH - (REST_REACH - HOLD_REACH) * pose.reach * near
    if (i === 0) sitePoint = { x: cx + reach, y }
    const touching = near > 0.6 && pose.reach > 0.6 && swapHappens(kind)
    for (const side of [-1, 1] as const) {
      const ox = cx + side * reach
      const cAtom = cx + side * (reach + carbR + OXY_R * 0.55)
      ctx.strokeStyle = HELIX_MID
      ctx.lineWidth = Math.max(2, OXY_R * 0.22)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cAtom, y)
      ctx.lineTo(cx + side * WALL_X, y)
      ctx.stroke()
      glossySphere(ctx, cAtom, y, carbR, CARB)
      if (touching) {
        ctx.save()
        ctx.globalAlpha *= Math.min(1, (pose.reach - 0.6) * 4)
        ctx.fillStyle = 'rgba(250, 204, 21, 0.22)'
        ctx.beginPath()
        ctx.arc(ox, y, OXY_R * 1.7, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      glossySphere(ctx, ox, y, OXY_R, OXY)
      // Every carbonyl oxygen is PARTLY negative, which is why a positive ion
      // is held rather than repelled. The app's one charge badge, small; the
      // describer says it is a part charge and not a whole one.
      drawChargeDot(ctx, ox, y - OXY_R * 0.72, OXY_R * 0.36, -1)
    }
  }

  // The coat, drawn as the water molecule this app draws everywhere, and
  // conserved: what comes off falls back down rather than vanishing.
  const waterMag = FZ_PX_PER_NM / (TRAVELLER_MAG * PX_PER_NM)
  const on = Math.round(WATERS_IN_COAT * pose.coat)
  for (let i = 0; i < WATERS_IN_COAT; i++) {
    const a = (Math.PI * 2 * i) / WATERS_IN_COAT - Math.PI / 2
    if (i < on) {
      const r = coatR - bare * 0.3
      drawTraveller(ctx, 'water', cx + Math.cos(a) * r, ionY + Math.sin(a) * r, waterMag)
    } else {
      const fell = 1 - pose.coat
      ctx.save()
      ctx.globalAlpha = Math.max(0, 0.85 - fell * 0.5)
      drawTraveller(
        ctx,
        'water',
        cx + Math.cos(a) * (coatR + fell * 22),
        ionY + Math.abs(Math.sin(a)) * 8 + fell * fell * 90,
        waterMag,
      )
      ctx.restore()
    }
  }

  ctx.save()
  if (pose.gone > 0) ctx.globalAlpha *= Math.max(0, 1 - pose.gone * pose.gone)
  drawGlossyIon(ctx, kind, cx, ionY, bare)
  drawIonCharge(ctx, cx, ionY, bare, ion.charge)
  ctx.restore()

  // The magnified site, in the corner, joined to the site itself by the
  // dashed lines this app uses everywhere a small thing is shown big.
  const ix = LANE_W - INSET_R - 18
  const iy = TOP_Y + INSET_R + 4
  ctx.save()
  ctx.strokeStyle = RING
  ctx.lineWidth = 1.4
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.arc(sitePoint.x, sitePoint.y, OXY_R * 1.9, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)'
  ctx.lineWidth = 2
  ctx.setLineDash([7, 6])
  ctx.beginPath()
  ctx.moveTo(sitePoint.x, sitePoint.y - OXY_R * 1.9)
  ctx.lineTo(ix - INSET_R * 0.72, iy + INSET_R * 0.68)
  ctx.moveTo(sitePoint.x + OXY_R * 1.9, sitePoint.y)
  ctx.lineTo(ix - INSET_R * 0.2, iy + INSET_R)
  ctx.stroke()
  ctx.restore()
  drawInset(ctx, kind, ix, iy, pose.reach)

  // ⚠ The lane's title used to repeat `ion.name` here, directly above the
  // spoken name for the same ion (found 2026-09-04) — the canvas saying one
  // thing twice, in two different styles. The spoken name below is the name.
  ctx.textAlign = 'center'
  ctx.fillStyle = HELIX_LIGHT
  ctx.font = '10px system-ui, sans-serif'
  ctx.fillText(`×${FZ_MAG.toLocaleString('en-US')} life size`, cx, LANE_H - 34)

  // ⚠ Gated by the app's one 🏷 switch (user, 2026-09-04: unify labels
  // "everywhere"). Readings on a scale are never hidden by it — a graph
  // without its axis is not a simpler graph — only NAMES.
  if (labelsOn) for (const l of laneLabels(kind)) drawSpoken(ctx, l)
}
