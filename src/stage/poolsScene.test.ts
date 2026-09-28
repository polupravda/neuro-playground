import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { LIPID, omegaRing, snareGeometry } from './snareScene'
import { SIGNAL_RGB } from './signal'
import { lipidSpacing } from './bilayer'
import { SINK_TOUCH } from '../core/vesicleCycle'
import {
  GAUGE_BELOW_RGB,
  GAUGE_THRESHOLD,
  POOL_H,
  POOL_LIPID,
  POOL_SPACING,
  POOL_W,
  RANK_ROWS,
  RECEPTOR_N,
  SETTLE_TAU_MS,
  SOUP_N,
  ballAlpha,
  boltPoints,
  boltX,
  cargoDots,
  cargoOffset,
  cargoR,
  SITE_INK,
  dockSites,
  drawGauge,
  drawPools,
  flashY,
  fusingCentre,
  fusionSites,
  gapCargo,
  gaugeAngle,
  gaugeAt,
  gaugeNext,
  gaugePlate,
  lumenR,
  outerR,
  paintedAt,
  pitchX,
  pitchY,
  poolLipid,
  poolSeats,
  poolsGeometry,
  postY,
  receptorSeats,
  responseAt,
  responseGlow,
  settlePools,
  soupAt,
  vesicleSeats,
  wallMolecules,
  wallSites,
  type Drawn,
} from './poolsScene'
import {
  CARGO_MS,
  DOCKED_SLOTS,
  FLASH_MS,
  FUSE_MS,
  NT_PER_VESICLE,
  RECOVER_MS,
  REDOCK_MS,
  SITE_CLEAR_P,
  STORAGE_N,
  TAP_REST_MS,
  TOTAL_VESICLES,
  countIn,
  flashesAt,
  poolsSpike,
  poolsStart,
  poolsStep,
  type PoolsState,
} from '../core/pools'

const G = poolsGeometry()

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y)

/** Exactly the bubbles named, exactly this far through their merge. */
const merging = (slots: number[], p: number): PoolsState => {
  const s = poolsStart()
  for (const k of slots) {
    const v = s.ves.find((x) => x.pool === 'docked' && x.slot === k)!
    v.pool = 'out'
    v.t = FUSE_MS * p
  }
  return s
}

/** One message, then `ms` of its bubble merging. */
const fusing = (ms: number): PoolsState => {
  const s = poolsStart()
  poolsSpike(s)
  poolsStep(s, ms)
  return s
}

/** ⚠ A TERMINAL WITH NO BUBBLES IN IT — the only way to measure the wall's own
 *  molecules and nothing else. A parked bubble RESTS on the wall, so its skin
 *  falls inside any band drawn round the wall. */
const bareWall = (): PoolsState => {
  const s = poolsStart()
  for (const v of s.ves) {
    v.pool = 'out'
    v.t = RECOVER_MS + 1
  }
  return s
}

/** The wall's molecules as drawn, left to right — the picture, not the helper. */
const wallBand = (c: ReturnType<typeof strictCanvas>): { x: number; y: number }[] =>
  c.points
    .filter((p) => Math.abs(p.y - G.wallY) < POOL_LIPID.halfMem * 2.2)
    .sort((a, b) => a.x - b.x)

describe('D18 — five bubbles, drawn', () => {
  it('B1: two ranks, ordered by distance from the wall, and the parked ones touch it', () => {
    const parked = poolSeats(G, 'docked', 1).y
    const stored = poolSeats(G, 'storage', 1).y
    expect(RANK_ROWS).toBe(2)
    expect(parked, 'the parked row is not against the wall').toBeGreaterThan(stored)
    // Its OUTER face rests on the membrane's inner one.
    expect(G.wallY - POOL_LIPID.halfMem - parked).toBeCloseTo(outerR(G), 3)
  })

  it('B1: the layout is SOLVED — every seat on the panel, no two bubbles touching', () => {
    const seats = vesicleSeats(G, poolsStart())
    const R = outerR(G)
    expect(seats.length).toBe(TOTAL_VESICLES)
    for (const { at } of seats) {
      expect(at.x, `x ${at.x.toFixed(1)} against R ${R.toFixed(1)}`).toBeGreaterThan(R)
      expect(at.x).toBeLessThan(POOL_W - R)
      expect(at.y, `y ${at.y.toFixed(1)} is off the top`).toBeGreaterThan(R)
      expect(at.y, 'a bubble is drawn outside the terminal').toBeLessThanOrEqual(
        G.wallY - POOL_LIPID.halfMem - R + 0.001,
      )
    }
    let worst = Infinity
    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        worst = Math.min(worst, dist(seats[i].at, seats[j].at))
      }
    }
    // ⚠ AGAINST WHAT THE BUDGET ASKED FOR, and against the DRAWN extent — ring
    // plus the membrane standing out from it — spelled out from the molecule
    // rather than read off `outerR`, which a break can move.
    expect(worst).toBeGreaterThan(Math.min(pitchX(G), pitchY(G)) - 0.01)
    const drawnR = G.r + POOL_LIPID.halfMem
    expect(worst, `closest pair ${worst.toFixed(1)}px against 2 x ${drawnR.toFixed(1)}`)
      .toBeGreaterThan(drawnR * 2)
    expect(poolSeats(G, 'docked', 0).y + drawnR).toBeCloseTo(G.wallY - POOL_LIPID.halfMem, 3)

    // ⚠ AND THE PARKED ROW USES THE WALL IT BELONGS TO. On one full-width panel
    // the bubble's size is set by the HEIGHT, so nothing stops the three of them
    // huddling in the middle of a wall twice as wide as they need — measured,
    // 51% of it against 71% when they are spread. A break that pulled them
    // together left them neither overlapping nor off the panel, and every other
    // layout guard passed it.
    const ends = [poolSeats(G, 'docked', 0).x, poolSeats(G, 'docked', DOCKED_SLOTS - 1).x]
    const span = ends[1] - ends[0] + drawnR * 2
    const wall = G.right - G.left
    expect(
      span / wall,
      `the parked row covers ${((span / wall) * 100).toFixed(0)}% of the wall`,
    ).toBeGreaterThan(0.6)
    expect(span, 'the parked row runs off the wall').toBeLessThanOrEqual(wall)
  })

  it('B1: FEWER means BIGGER — a bubble you can see into', () => {
    // ⚠ (user, 2026-09-07: "display 3 docked vesicles. Make each larger.") Five
    // bubbles in two ranks instead of thirteen in five is what pays for it.
    const lipid = poolLipid(G)
    expect(G.r, 'the bubbles did not get bigger').toBeGreaterThan(45)
    expect(lipid.halfMem * 2, 'the membrane is thicker than the bubble').toBeLessThan(G.r)
    expect(lipid.headR).toBeGreaterThan(1.2)
    expect(lipid.headR).toBeLessThanOrEqual(lipid.halfMem)
    const ring = omegaRing(G, G.cx, poolSeats(G, 'storage', 0).y, G.r, POOL_SPACING)
    expect(ring.length, `${ring.length} molecules round a bubble`).toBeGreaterThan(20)
    // Room inside for cargo a child can count.
    expect(lumenR(G) / cargoR(G)).toBeGreaterThan(3)
    expect(cargoR(G), 'the cargo balls are too small to see').toBeGreaterThan(5)
  })

  it('B2: the wall and the bubbles are made of the SAME molecule', () => {
    // ⚠ A lipid's SHAPE is halfMem/headR — the tail is `halfMem - 1.75 x headR`.
    // The wall's ratio was 5.0 against the bubbles' 2.5: a small head on long
    // tails beside a fat head on stubs, in one picture.
    const c = strictCanvas()
    drawPools(c.ctx, { state: poolsStart(), width: POOL_W, height: POOL_H, ms: 0 })
    const lo = POOL_LIPID.halfMem * 0.45
    const hi = POOL_LIPID.halfMem * 1.1

    const bare = strictCanvas()
    drawPools(bare.ctx, { state: bareWall(), width: POOL_W, height: POOL_H, ms: 0 })
    const wallOff = bare.points
      .map((p) => Math.abs(p.y - G.wallY))
      .filter((d) => d >= lo && d <= hi)
    expect(wallOff.length, 'no wall heads found').toBeGreaterThan(40)
    const wallHalf = wallOff.reduce((a, b) => a + b, 0) / wallOff.length

    const seat = poolSeats(G, 'storage', 0)
    const ringOff = c.points
      .map((p) => Math.abs(Math.hypot(p.x - seat.x, p.y - seat.y) - G.r))
      .filter((d) => d >= lo && d <= hi)
    expect(ringOff.length, 'no bubble heads found').toBeGreaterThan(20)
    const ringHalf = ringOff.reduce((a, b) => a + b, 0) / ringOff.length
    expect(
      Math.abs(wallHalf - ringHalf),
      `wall leaflets ${wallHalf.toFixed(2)}px from the midline, a bubble's ${ringHalf.toFixed(2)}px`,
    ).toBeLessThan(0.3)

    // …and PACKED the same, measured on what was drawn.
    expect(POOL_SPACING).toBeCloseTo(lipidSpacing(POOL_LIPID), 9)
    const wallPerPx = wallOff.length / (G.right - G.left)
    const ringPerPx = ringOff.length / (2 * Math.PI * G.r)
    expect(wallPerPx / ringPerPx, 'packed differently').toBeCloseTo(1, 1)
    // The molecule keeps the app's own head-to-tail proportions.
    expect(POOL_LIPID.halfMem / POOL_LIPID.headR).toBeCloseTo(LIPID.halfMem / LIPID.headR, 6)
  })

  it('B2: a bubble does not change molecule when it starts to fuse', () => {
    const resting = omegaRing(G, G.cx, poolSeats(G, 'storage', 0).y, G.r, POOL_SPACING)
    const mergingRing = omegaRing(G, G.cx, G.wallY - G.r * 0.2, G.r, POOL_SPACING)
    expect(resting.length).toBe(mergingRing.length)
  })

  it('B3: the fusion is the SNARE bench’s own sink — down, through, and flat', () => {
    const from = poolSeats(G, 'docked', 0).y
    let last = -Infinity
    for (let i = 0; i <= 20; i++) {
      const y = fusingCentre(G, 0, i / 20).y
      expect(y, 'the bubble rose during its own fusion').toBeGreaterThan(last)
      last = y
    }
    expect(fusingCentre(G, 0, 0).y).toBeCloseTo(from, 6)
    expect(fusingCentre(G, 0, 1).y).toBeCloseTo(G.wallY + G.r, 6)
    expect(fusingCentre(G, 0, SINK_TOUCH).y).toBeCloseTo(G.wallY - G.r, 6)
    // The wall does not part before contact.
    expect(wallSites(G, fusing(FUSE_MS * SINK_TOUCH * 0.5))[0].shift).toBe(0)
    expect(wallSites(G, fusing(FUSE_MS * 0.6))[0].shift).toBeGreaterThan(0)
    // And it merges at ITS OWN parking space.
    const at = fusing(FUSE_MS * 0.6)
    const slot = at.ves.find((v) => v.pool === 'out')!.slot
    expect(wallSites(G, at)[0].about).toBeCloseTo(poolSeats(G, 'docked', slot).x, 6)
  })

  it('B3: two bubbles merging at once open the wall in TWO places', () => {
    const s = merging([0, 2], 0.6)
    const sites = wallSites(G, s)
    expect(sites.length).toBe(2)
    const at = sites.map((x) => x.about).sort((a, b) => a - b)
    expect(at[0]).toBeCloseTo(poolSeats(G, 'docked', 0).x, 6)
    expect(at[1]).toBeCloseTo(poolSeats(G, 'docked', 2).x, 6)

    // The wall does not SLIDE; it simply is not the wall's to draw where a
    // bubble's own membrane has taken over.
    const shut = wallMolecules(G, poolsStart()).map((p) => p.at.x)
    const open = wallMolecules(G, s).map((p) => p.at.x)
    const gone = shut.filter((x) => !open.some((q) => Math.abs(q - x) < 1e-6))
    expect(gone.length, 'the wall gave up nothing').toBeGreaterThan(15)
    for (const x of open) {
      expect(shut.some((q) => Math.abs(q - x) < 1e-6), `a molecule slid to ${x.toFixed(1)}`).toBe(true)
    }
    for (const site of sites) {
      expect(
        gone.filter((x) => Math.abs(x - site.about) <= site.shift).length,
        `nothing given up at the fusion at ${site.about.toFixed(0)}`,
      ).toBeGreaterThan(4)
    }
    for (const x of gone) {
      expect(
        sites.some((site) => Math.abs(x - site.about) <= site.shift),
        `the wall dropped a molecule at ${x.toFixed(0)}, away from any fusion`,
      ).toBe(true)
    }
  })

  it('B3: the membrane stays CONTINUOUS through a fusion — every hole is a pore', () => {
    const bare = strictCanvas()
    drawPools(bare.ctx, { state: bareWall(), width: POOL_W, height: POOL_H, ms: 0 })
    const gapsOf = (pts: { x: number; y: number }[]) => {
      const xs = pts.map((q) => q.x).filter((x) => x > -20 && x < POOL_W + 20).sort((a, b) => a - b)
      const out: { width: number; at: number }[] = []
      for (let i = 1; i < xs.length; i++) out.push({ width: xs[i] - xs[i - 1], at: (xs[i] + xs[i - 1]) / 2 })
      return out
    }
    const spacing = Math.max(...gapsOf(wallBand(bare)).map((h) => h.width))
    expect(spacing, `bare wall spacing ${spacing.toFixed(1)}px`).toBeLessThan(8)

    let worst = { width: 0, at: 0, n: 0, p: 0 }
    for (const slots of [[0], [0, 2], [1], [0, 1, 2]]) {
      for (let i = 1; i < 24; i++) {
        const p = i / 24
        const st = merging(slots, p)
        const c = strictCanvas()
        drawPools(c.ctx, { state: st, width: POOL_W, height: POOL_H, ms: 0 })
        const mouths = fusionSites(G, st).map((f) => f.x)
        for (const hole of gapsOf(wallBand(c))) {
          if (mouths.some((m) => Math.abs(hole.at - m) < G.r)) continue
          if (hole.width > worst.width) worst = { ...hole, n: slots.length, p }
        }
      }
    }
    expect(
      worst.width,
      `worst tear ${worst.width.toFixed(1)}px at x=${worst.at.toFixed(0)} with ${worst.n} fusing at p=${worst.p.toFixed(2)}`,
    ).toBeLessThan(POOL_SPACING * 2)
  })

  it('B3: a parking space is clear when the model says it is', () => {
    const lipid = poolLipid(G)
    for (let slot = 0; slot < DOCKED_SLOTS; slot++) {
      const top = fusingCentre(G, slot, SITE_CLEAR_P).y - G.r - lipid.halfMem
      const freshBottom = poolSeats(G, 'docked', slot).y + outerR(G)
      const proud = freshBottom - top
      expect(
        proud,
        `at SITE_CLEAR_P the merging bubble stands ${proud.toFixed(1)}px proud, head ${lipid.headR.toFixed(1)}px`,
      ).toBeLessThanOrEqual(lipid.headR)
    }
    expect(SITE_CLEAR_P).toBeLessThan(1)
    expect(SITE_CLEAR_P).toBeGreaterThan(0.5)
  })

  it('B4: the cargo is inside from the first frame, and leaves by the MOUTH', () => {
    const rest = poolsStart()
    const atRest = cargoDots(G, rest, 0, POOL_H)
    expect(atRest.length).toBe(TOTAL_VESICLES * NT_PER_VESICLE)
    expect(atRest.every((d) => d.inside)).toBe(true)
    const lumen = lumenR(G)
    for (const { v, at } of vesicleSeats(G, rest)) {
      const mine = atRest.filter((d) => d.id === v.id)
      expect(mine.length, `bubble ${v.id} lost its cargo`).toBe(NT_PER_VESICLE)
      for (const d of mine) expect(dist(d, at)).toBeLessThanOrEqual(lumen)
    }

    // ⚠ NOTHING LEAVES ITS BUBBLE BEFORE THE MOUTH OPENS, asked of the ball's
    // OWN bubble and of its exact resting place — "inside the lumen" was too
    // weak to break, because a ball that set off on frame one has crept only a
    // pixel or two by contact.
    for (const ms of [0, FUSE_MS * SINK_TOUCH * 0.5, FUSE_MS * SINK_TOUCH * 0.98]) {
      const before = fusing(ms)
      const v = before.ves.find((x) => x.pool === 'out')!
      const c = fusingCentre(G, v.slot, v.t / FUSE_MS)
      const mine = cargoDots(G, before, 0, POOL_H).filter((d) => d.id === v.id)
      expect(mine.length).toBe(NT_PER_VESICLE)
      for (const [k, d] of mine.entries()) {
        const off = cargoOffset(G, v.id, k, 0)
        expect(
          Math.hypot(d.x - (c.x + off.x), d.y - (c.y + off.y)),
          `at ${ms.toFixed(0)}ms ball ${k} had already set off`,
        ).toBeLessThan(1e-6)
      }
    }
    expect(gapCargo(G, fusing(0), 0, POOL_H).length).toBe(0)

    // …and what has just crossed is at ITS OWN mouth. One message releases one
    // bubble now, but the guard still asks per ball, by identity.
    const s = fusing(FUSE_MS * 0.45)
    const dr = cargoR(G)
    const mouths = new Map(fusionSites(G, s).map((f) => [f.v.id, f.x]))
    const fresh = gapCargo(G, s, 0, POOL_H).filter((d) => d.y < G.wallY + dr * 4)
    expect(fresh.length, 'nothing came out at all').toBeGreaterThan(0)
    for (const d of fresh) {
      expect(Math.abs(d.x - mouths.get(d.id)!)).toBeLessThan(G.r)
    }
  })

  it('B4: the puff THINS with the release, and the cargo is taken up', () => {
    const CROSSING = 700
    const one = poolsStart()
    one.ves[0].pool = 'out'
    one.ves[0].t = CROSSING
    one.now = CROSSING
    const two = poolsStart()
    for (const i of [0, 1]) {
      two.ves[i].pool = 'out'
      two.ves[i].t = CROSSING
    }
    two.now = CROSSING
    const nOne = gapCargo(G, one, 0, POOL_H).length
    const nTwo = gapCargo(G, two, 0, POOL_H).length
    expect(nTwo, `two bubbles gave ${nTwo} balls, one gave ${nOne}`).toBeGreaterThan(nOne)
    expect(nOne).toBeGreaterThan(0)
    expect(gapCargo(G, poolsStart(), 0, POOL_H).length, 'a failed message puffed').toBe(0)
    for (const d of gapCargo(G, two, 0, POOL_H)) {
      expect(d.y, 'a gap ball is inside the terminal').toBeGreaterThanOrEqual(G.wallY)
    }
    const gone = poolsStart()
    gone.ves[0].pool = 'out'
    gone.ves[0].t = CARGO_MS + 1
    expect(gapCargo(G, gone, 0, POOL_H).length).toBe(0)
  })

  it('B4: a refilling bubble shows its cargo arriving, one ball at a time', () => {
    // ⚠ (user, 2026-09-08: "fine if NTs just appear in vesicles after restore
    // (fade-in)".) They come up one after another rather than all brightening
    // together, so what a child sees is a COUNT reaching five.
    expect(ballAlpha(0, 0), 'an empty bubble shows a ball').toBe(0)
    for (let k = 0; k < NT_PER_VESICLE; k++) {
      expect(ballAlpha(1, k), `ball ${k} is faint in a full bubble`).toBe(1)
    }
    // Half full: the first balls are solid, the last are not there yet.
    const half = [...Array(NT_PER_VESICLE).keys()].map((k) => ballAlpha(0.5, k))
    expect(half.filter((a) => a >= 0.999).length, 'nothing is solid half way').toBeGreaterThan(0)
    expect(half.filter((a) => a <= 0.001).length, 'everything is there half way').toBeGreaterThan(0)
    // It only ever goes up.
    for (let k = 0; k < NT_PER_VESICLE; k++) {
      let last = -1
      for (const f of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
        const a = ballAlpha(f, k)
        expect(a, `ball ${k} went backwards as the bubble filled`).toBeGreaterThanOrEqual(last)
        last = a
      }
    }

    // And the drawing carries it: a half-filled bubble's cargo is part-faded,
    // a full one's is not.
    const s = poolsStart()
    const filling = s.ves.find((v) => v.pool === 'storage')!
    filling.fill = 0.5
    const mine = cargoDots(G, s, 0, POOL_H).filter((d) => d.id === filling.id)
    expect(mine.length, 'a half-filled bubble shows all its cargo').toBeLessThan(NT_PER_VESICLE)
    expect(mine.length, 'a half-filled bubble shows none of it').toBeGreaterThan(0)
    const full = cargoDots(G, poolsStart(), 0, POOL_H).filter((d) => d.inside)
    expect(full.every((d) => d.alpha === 1), 'a full bubble draws faded cargo').toBe(true)
    expect(full.length).toBe(TOTAL_VESICLES * NT_PER_VESICLE)

    // ⚠ AND NOTHING THAT HAS LEFT A BUBBLE IS EVER FADED — it came out of a
    // full one. Asked of every ball belonging to a spent bubble, by identity,
    // not just of those already in the gap: a ball halfway through the mouth is
    // still flagged as inside, and a break that faded exactly those sailed
    // through a guard that only looked at the gap.
    const goneOut = fusing(FUSE_MS * 0.45)
    const spent = new Set(goneOut.ves.filter((v) => v.pool === 'out').map((v) => v.id))
    const leaving = cargoDots(G, goneOut, 0, POOL_H).filter((d) => spent.has(d.id))
    expect(leaving.length, 'nothing was on its way out').toBeGreaterThan(0)
    for (const d of leaving) {
      expect(d.alpha, 'a ball leaving a spent bubble is half there').toBe(1)
    }
  })

  it('B5: one message is ONE flash, a strong signal sends them one at a time', () => {
    const one = poolsStart()
    poolsSpike(one)
    const h = outerR(G) * 0.85
    const win = h * 0.34 * 0.55 + 2
    const boltPts = (st: PoolsState) => {
      const c = strictCanvas()
      drawPools(c.ctx, { state: st, width: POOL_W, height: POOL_H, ms: 0 })
      return c.points.filter((p) => Math.abs(p.x - boltX(G)) < win)
    }
    const marksOf = (p: number) => [flashY(G, p), ...boltPoints(0, flashY(G, p), h).map((q) => q.y)]
    const a = boltPts(one)
    expect(a.length, 'no bolt was drawn').toBe(marksOf(0).length)
    const want = flashesAt(one).flatMap(marksOf).sort((x, y) => x - y)
    const got = a.map((q) => q.y).sort((x, y) => x - y)
    for (const [i, y] of got.entries()) expect(y).toBeCloseTo(want[i], 6)
    // ⚠ A GENTLE TAP PUTS ONE MESSAGE IN THE AIR; A STRONG ONE PUTS SEVERAL.
    // That is the difference a child counts, and since the burst became a real
    // one (170 ms apart) they really are in the air together.
    expect(flashesAt(one).length, 'one press is not one flash').toBe(1)
    // ⚠ AND NEVER TWO AT ONCE, even hammered: the terminal's refractory is
    // longer than a flash's flight, so each message is its own event all the
    // way down. Measured: a 120 ms flight against a 250 ms refractory.
    expect(FLASH_MS, 'two messages can be in the air at once').toBeLessThan(TAP_REST_MS)
    const many = poolsStart()
    for (let k = 0; k < 3; k++) {
      poolsSpike(many)
      expect(flashesAt(many).length, 'two messages in the air at once').toBe(1)
      poolsStep(many, TAP_REST_MS)
    }
    // ⚠ AND THE FLASH IS SHORT — 120 ms, derived so it lands exactly as the
    // bubble touches the wall (`SINK_TOUCH` of a fusion). Pinned so it cannot
    // silently become a single frame; if it reads as a blink the fix is the
    // fusion's own pace, not a number invented here.
    expect(FLASH_MS, 'the flash is a single frame').toBeGreaterThan(80)
    expect(FLASH_MS).toBe(Math.round(SINK_TOUCH * FUSE_MS))
  })

  it('B5: a flash starts off-frame and lands ON the wall', () => {
    expect(flashY(G, 0)).toBeLessThan(0)
    expect(flashY(G, 1)).toBeCloseTo(G.wallY, 6)
  })

  it('B6: the panel letters NOTHING on its canvas', () => {
    // ⚠ Back to nothing at all (2026-09-07, user: "remove 'signal received'
    // label"). The dial's line is taught by the COLOUR changing as the needle
    // crosses it, and said in the info block, which is written to be read aloud.
    const c = strictCanvas()
    drawPools(c.ctx, { state: fusing(FUSE_MS * 0.5), width: POOL_W, height: POOL_H, ms: 800 })
    expect(c.texts, `the canvas wrote ${JSON.stringify(c.texts)}`).toEqual([])
  })

  it('B6: a bubble ring is never tapered, and a fade it is handed survives', () => {
    const c = strictCanvas()
    drawPools(c.ctx, { state: poolsStart(), width: POOL_W, height: POOL_H, ms: 0 })
    // Two open-ended membranes taper 3 samples at each end; the ion soup is
    // drawn at 0.62. Anything beyond that is a bubble being tapered.
    const TAPERED_WALLS = 2
    const dim = c.alphas.filter((a) => a < 0.999)
    expect(
      dim.length,
      `${dim.length} part-faded marks (walls and soup alone are ${TAPERED_WALLS * 24 + SOUP_N})`,
    ).toBeLessThan(TAPERED_WALLS * 24 + SOUP_N + 8)

    const faded = strictCanvas()
    faded.ctx.globalAlpha = 0.4
    drawPools(faded.ctx, { state: fusing(FUSE_MS * 0.5), width: POOL_W, height: POOL_H, ms: 300 })
    const over = faded.alphas.filter((a) => a > 0.4001)
    expect(over.length, `${over.length} marks ignored the fade`).toBe(0)
  })

  it('B7: the wall jostles — the panel is never a still picture', () => {
    const s = bareWall()
    const a = strictCanvas()
    const b = strictCanvas()
    drawPools(a.ctx, { state: s, width: POOL_W, height: POOL_H, ms: 0 })
    drawPools(b.ctx, { state: s, width: POOL_W, height: POOL_H, ms: 700 })
    const pa = wallBand(a)
    const pb = wallBand(b)
    expect(pa.length).toBeGreaterThan(20)
    // ⚠ Counted with a molecule's own slack: a head jiggling across the band's
    // edge changes the count by one, which is the jiggle, not a fault.
    expect(Math.abs(pa.length - pb.length)).toBeLessThan(4)
    const n = Math.min(pa.length, pb.length)
    const moved = pa.slice(0, n).filter((p, i) => dist(p, pb[i]) > 0.2).length
    expect(moved, 'the membrane was held still').toBeGreaterThan(n * 0.5)
  })

  it('B8: NOTHING teleports — walked frame by frame at two framerates', () => {
    // ⚠ A teleport does not scale with the frame: real motion covers twice the
    // ground in twice the time, a jump is the same size however often you look.
    const walk = (fps: number, tapMs: number) => {
      const s = poolsStart()
      const drawn: Drawn = new Map()
      settlePools(G, s, drawn, 0)
      const FR = 1000 / fps
      let worst = 0
      let readyAt = 0
      for (let f = 0; f < fps * 24; f++) {
        const now = f * FR
        const before = paintedAt(G, s, drawn)
        poolsStep(s, FR)
        if (now % tapMs < FR && s.now >= readyAt) {
          readyAt = s.now + TAP_REST_MS
          poolsSpike(s)
        }
        settlePools(G, s, drawn, FR)
        for (const [id, p] of paintedAt(G, s, drawn)) {
          const b = before.get(id)
          if (!b) continue
          worst = Math.max(worst, dist(p, b))
        }
      }
      return worst
    }
    for (const per of [1400, 200]) {
      const fast = walk(60, per)
      const slow = walk(30, per)
      expect(fast, `worst move ${fast.toFixed(1)}px in one 60fps frame`).toBeLessThan(G.r * 0.5)
      expect(
        slow / fast,
        `${fast.toFixed(1)}px at 60fps against ${slow.toFixed(1)}px at 30fps — a jump does not scale`,
      ).toBeGreaterThan(1.6)
    }
  })

  it('B8: only what is GOING somewhere moves — everything else is still', () => {
    const s = poolsStart()
    const drawn: Drawn = new Map()
    settlePools(G, s, drawn, 0)
    const FR = 1000 / 60
    let readyAt = 0
    let strays = 0
    const changedAt = new Map<number, number>()
    const keys = new Map(s.ves.map((v) => [v.id, `${v.pool}:${v.rank}:${v.slot}`]))
    for (let f = 0; f < 60 * 20; f++) {
      const now = f * FR
      const before = paintedAt(G, s, drawn)
      poolsStep(s, FR)
      if (now % 1600 < FR && s.now >= readyAt) {
        readyAt = s.now + TAP_REST_MS
        poolsSpike(s)
      }
      for (const v of s.ves) {
        const k = `${v.pool}:${v.rank}:${v.slot}`
        if (keys.get(v.id) !== k) {
          changedAt.set(v.id, now)
          keys.set(v.id, k)
        }
      }
      settlePools(G, s, drawn, FR)
      const busy = new Set(fusionSites(G, s).map((x) => x.v.id))
      for (const [id, p] of paintedAt(G, s, drawn)) {
        const b = before.get(id)
        if (!b || dist(p, b) <= 0.4) continue
        if (busy.has(id)) continue
        if (now - (changedAt.get(id) ?? -1e9) < SETTLE_TAU_MS * 6) continue
        strays++
      }
    }
    expect(strays, `${strays} frames of a bubble moving with nowhere to be going`).toBe(0)
  })

  it('B8: left alone, the panel comes completely to rest', () => {
    const s = poolsStart()
    const drawn: Drawn = new Map()
    settlePools(G, s, drawn, 0)
    const FR = 1000 / 60
    for (let k = 0; k < TOTAL_VESICLES; k++) {
      poolsSpike(s)
      for (let f = 0; f < 57; f++) {
        poolsStep(s, FR)
        settlePools(G, s, drawn, FR)
      }
    }
    let stillFor = 0
    for (let f = 0; f < 60 * 30 && stillFor < 60; f++) {
      const before = paintedAt(G, s, drawn)
      poolsStep(s, FR)
      settlePools(G, s, drawn, FR)
      let moved = 0
      for (const [id, p] of paintedAt(G, s, drawn)) {
        const b = before.get(id)
        if (b && dist(p, b) > 0.02) moved++
      }
      stillFor = moved === 0 ? stillFor + 1 : 0
    }
    expect(stillFor, 'the panel never settles').toBeGreaterThanOrEqual(60)
    for (const [id, p] of paintedAt(G, s, drawn)) {
      const want = paintedAt(G, s).get(id)
      if (!want) continue
      expect(dist(p, want), `bubble ${id} came to rest off its place`).toBeLessThan(0.5)
    }
  })

  it('B9: the far side answers by exactly as much as ARRIVED', () => {
    const release = (n: number) => {
      const st = poolsStart()
      for (let i = 0; i < n; i++) {
        const v = st.ves.find((x) => x.pool === 'docked' && x.slot === i)!
        v.pool = 'out'
        v.t = 0
      }
      return st
    }
    const peakOf = (st: PoolsState) => {
      let g = 0
      let peak = 0
      for (let f = 0; f < 500; f++) {
        poolsStep(st, 1000 / 60)
        g = gaugeNext(g, responseAt(G, st, 0, POOL_H), 1000 / 60)
        peak = Math.max(peak, g)
      }
      return peak
    }
    // ⚠ A MESSAGE THAT SENT NOTHING LIGHTS NOTHING. The whole point.
    expect(peakOf(release(0)), 'a failed message lit the far side').toBe(0)
    expect(peakOf(release(1)), 'one bubble did not clear the line').toBeGreaterThan(GAUGE_THRESHOLD)
    const peaks = [1, 2, 3].map((n) => peakOf(release(n)))
    for (let i = 1; i < peaks.length; i++) {
      expect(peaks[i], `${i + 1} bubbles lit no brighter than ${i}`).toBeGreaterThan(peaks[i - 1])
    }
    // ⚠ THE LINE MUST REJECT THE NEAR MISS, not merely the empty case: a total
    // failure is exactly zero, so "above zero" tests nothing.
    const perBall = 1 / (NT_PER_VESICLE * DOCKED_SLOTS)
    expect(GAUGE_THRESHOLD, 'the line trips on a stray ball or two').toBeGreaterThan(perBall * 2)
    expect(GAUGE_THRESHOLD, 'the line is above a whole bubble').toBeLessThan(perBall * NT_PER_VESICLE)
  })

  it('B9: the answer follows its message closely, and is a pulse', () => {
    const s = poolsStart()
    const v = s.ves.find((x) => x.pool === 'docked' && x.slot === 0)!
    v.pool = 'out'
    v.t = 0
    let peakAt = 0
    let peak = 0
    let lit = 0
    for (let f = 0; f < 400; f++) {
      poolsStep(s, 1000 / 60)
      const r = responseAt(G, s, 0, POOL_H)
      if (r > peak) {
        peak = r
        peakAt = s.now
      }
      if (r > 0.02) lit++
    }
    // ⚠ Bounded in absolute time, not against the burst's own spacing: a real
    // burst's messages are 170 ms apart and their answers necessarily overlap,
    // which is what a burst looks like. What matters is that an answer follows
    // its message closely enough to be recognised as its answer.
    expect(peakAt, `the answer peaked ${(peakAt / 1000).toFixed(2)}s after the message`).toBeLessThan(
      1200,
    )
    const litMs = (lit * 1000) / 60
    expect(litMs, `lit for ${litMs.toFixed(0)}ms`).toBeLessThan(1400)
    expect(litMs, 'too brief to see').toBeGreaterThan(200)
  })

  it('B10: the dial is prominent — its own opaque plate, in the corner, on top', () => {
    // ⚠ (user, 2026-09-07: "make gauge prominent, on a non-transparent bg,
    // visually above the membrane, above the action button, in the corner".)
    const at = gaugeAt(POOL_H, POOL_W)
    const plate = gaugePlate(at)
    expect(at.r, 'the dial is too small to read').toBeGreaterThan(50)
    // In the corner, wholly on the panel.
    expect(plate.x + plate.w).toBeLessThanOrEqual(POOL_W + 0.001)
    expect(plate.y + plate.h).toBeLessThanOrEqual(POOL_H + 0.001)
    expect(plate.x, 'not in a corner').toBeGreaterThan(POOL_W * 0.4)
    expect(plate.y, 'not at the foot').toBeGreaterThan(POOL_H * 0.5)
    // ⚠ AND IT DOES NOT COVER THE LANDMARKS IT SITS BESIDE. A first attempt put
    // a 227 x 135 plate over the right-hand receptor and the bottom of the gap.
    for (const seat of receptorSeats(G, POOL_H)) {
      expect(seat.x, 'the plate covers a receptor').toBeLessThan(plate.x)
    }
    expect(plate.y, 'the plate covers the gap the transmitter crosses').toBeGreaterThan(
      postY(POOL_H) - at.r * 0.4,
    )

    // Drawn on an OPAQUE ground, and it is the last thing drawn.
    const c = strictCanvas()
    drawGauge(c.ctx, at, 0.5, 0)
    expect(c.calls, 'the plate is not filled').toContain('roundRect')
    expect(c.styles.some((k) => k === '#0b1220'), 'the plate is see-through').toBe(true)
  })

  it('B10: the hand sweeps a half turn, rises with the answer, and eases back', () => {
    expect(gaugeAngle(0)).toBeCloseTo(Math.PI, 6)
    expect(gaugeAngle(1)).toBeCloseTo(Math.PI * 2, 6)
    expect(gaugeAngle(0.5)).toBeCloseTo(Math.PI * 1.5, 6)
    expect(gaugeAngle(-3)).toBe(Math.PI)
    expect(gaugeAngle(9)).toBe(Math.PI * 2)
    expect(gaugeNext(0.1, 0.8, 16), 'the needle lagged a rising answer').toBe(0.8)
    const falling = gaugeNext(0.8, 0, 16)
    expect(falling).toBeGreaterThan(0.7)
    expect(falling).toBeLessThan(0.8)
    let v = 0.8
    for (let f = 0; f < 180; f++) v = gaugeNext(v, 0, 1000 / 60)
    expect(v, 'the needle never returns to rest').toBeLessThan(0.02)
  })

  it('B10: it sparks only once past the line', () => {
    const sparks = (value: number) => {
      const c = strictCanvas()
      drawGauge(c.ctx, gaugeAt(POOL_H, POOL_W), value, 400)
      return c.calls.filter((k) => k === 'createRadialGradient').length
    }
    const below = sparks(GAUGE_THRESHOLD - 0.02)
    const above = sparks(GAUGE_THRESHOLD + 0.02)
    expect(above, 'it did not spark past the line').toBeGreaterThan(below)
    expect(sparks(0), 'a dead message sparked').toBeLessThan(below + 1)
    const c = strictCanvas()
    drawGauge(c.ctx, gaugeAt(POOL_H, POOL_W), 0.5, 0)
    expect(c.texts, 'the dial is labelled').toEqual([])
  })

  it('B10: the dial is COLOUR-CODED — slate below the line, yellow past it', () => {
    // ⚠ (user, 2026-09-07: "once threshold achieved, the gauge sparks yellow.
    // Until then, choose a different color for the gradient".) Yellow is this
    // app's signal colour everywhere, so on this dial it has to mean "the
    // message got through" and nothing less. The change of colour AT the line is
    // what a child reads before they have looked at where the needle is.
    // ⚠ COUNTED, not merely present. The dial's TRACK is slate at every value,
    // so "does it mention slate?" is true on both sides of the line — a break
    // that left the sweep slate past the line survived exactly that. Measured:
    // below the line 6 slate marks and no yellow; above, 2 slate and 20 yellow.
    const inks = (value: number) => {
      const c = strictCanvas()
      drawGauge(c.ctx, gaugeAt(POOL_H, POOL_W), value, 400)
      const styles = c.styles.filter((k): k is string => typeof k === 'string')
      return {
        slate: styles.filter((k) => k.includes(GAUGE_BELOW_RGB)).length,
        yellow: styles.filter((k) => k.includes(SIGNAL_RGB)).length,
      }
    }
    const below = inks(GAUGE_THRESHOLD - 0.02)
    const above = inks(GAUGE_THRESHOLD + 0.02)
    expect(below.yellow, 'the dial is already yellow below the line').toBe(0)
    expect(below.slate, 'the sub-threshold sweep has no colour of its own').toBeGreaterThan(2)
    expect(above.yellow, 'the dial did not turn yellow past the line').toBeGreaterThan(0)
    // ⚠ AND BY ENOUGH THAT THE SWEEP ITSELF MUST HAVE FLIPPED. Past the line
    // the only slate left is the unlit track — measured, 2 marks against 6
    // below, the difference being the sweep's own two gradient stops and the
    // hand. "Fewer than below" was not enough: a break that left the sweep
    // slate still dropped the hand to yellow and squeaked under it.
    expect(
      above.slate,
      `${above.slate} slate marks past the line against ${below.slate} below — the sweep did not flip`,
    ).toBeLessThan(below.slate - 2)
  })

  it('B10: the answer glows INSIDE the receiving cell, not in the gap', () => {
    // ⚠ (user, 2026-09-07: "display signal yellow spark in postsynaptic area,
    // not in synaptic cleft".) The gap is where the chemical travels; the
    // answer happens in the cell that heard it. This went unnoticed once
    // because the edit silently did not apply and no guard was watching.
    const band = responseGlow(G, POOL_H)
    expect(band.y, 'the answer glows in the gap').toBeGreaterThanOrEqual(postY(POOL_H))
    expect(band.y + band.h, 'the glow runs off the panel').toBeLessThanOrEqual(POOL_H + 0.001)
    expect(band.h, 'there is no glow to see').toBeGreaterThan(10)
    // Nothing of it reaches up into the cleft the transmitter is crossing.
    expect(band.y, 'the glow reaches into the cleft').toBeGreaterThan(G.wallY)
  })

  it('B11: the far side is recognisable — two receptors and an ion soup', () => {
    const seats = receptorSeats(G, POOL_H)
    expect(seats.length).toBe(RECEPTOR_N)
    for (const at of seats) {
      expect(at.y, 'a receptor is not in the far membrane').toBeCloseTo(postY(POOL_H), 6)
      expect(at.x).toBeGreaterThan(G.left)
      expect(at.x).toBeLessThan(G.right)
    }
    expect(Math.abs(seats[0].x - seats[1].x), 'the receptors overlap').toBeGreaterThan(G.r * 0.6)

    const soup = soupAt(G, POOL_H, 900)
    expect(soup.length).toBe(SOUP_N)
    for (const ion of soup) {
      expect(ion.y, 'an ion is inside the terminal').toBeGreaterThan(G.wallY)
      expect(ion.y, 'an ion is through the far membrane').toBeLessThan(postY(POOL_H))
      expect(ion.x).toBeGreaterThanOrEqual(G.left - 0.001)
      expect(ion.x).toBeLessThanOrEqual(G.right + 0.001)
    }
    expect(soup.some((i) => i.kind === 'na'), 'no sodium').toBe(true)
    expect(soup.some((i) => i.kind === 'ca'), 'no calcium').toBe(true)
    // ⚠ IT JIGGLES, AND IT STAYS PUT (2026-09-07, user: "make ion soup jiggle in
    // place, not move across the scene"). A soup that drifts across the picture
    // reads as a current going somewhere, and steals the eye from the one thing
    // that really is travelling.
    // ⚠ IT JIGGLES IN BOTH DIRECTIONS. Asked separately, because a break that
    // froze only the sideways wobble left the up-and-down one moving and
    // sailed through a guard that asked for "any" movement.
    const later = soupAt(G, POOL_H, 1700)
    expect(
      Math.max(...later.map((p, i) => Math.abs(p.x - soup[i].x))),
      'the soup does not jiggle sideways',
    ).toBeGreaterThan(1)
    expect(
      Math.max(...later.map((p, i) => Math.abs(p.y - soup[i].y))),
      'the soup does not jiggle up and down',
    ).toBeGreaterThan(1)
    let worst = 0
    for (const ms of [0, 700, 1900, 4300, 9000, 21000]) {
      const then = soupAt(G, POOL_H, ms)
      for (const [i, p] of then.entries()) worst = Math.max(worst, Math.abs(p.x - soup[i].x))
    }
    expect(worst, `an ion wandered ${worst.toFixed(1)}px from where it started`).toBeLessThan(
      G.r * 0.5,
    )
  })

  it('B12: the parking spaces are marked, so an empty one shows', () => {
    const sites = dockSites(G)
    expect(sites.length).toBe(DOCKED_SLOTS)
    for (const [i, site] of sites.entries()) {
      expect(site.x).toBeCloseTo(poolSeats(G, 'docked', i).x, 6)
      expect(site.half).toBeGreaterThan(G.r * 0.5)
      expect(site.shown, 'a space on a rested terminal is not marked').toBe(true)
    }
    expect(sites[0].half * 2, 'a mark is wider than its own space').toBeLessThan(pitchX(G))
    const c = strictCanvas()
    drawPools(c.ctx, { state: poolsStart(), width: POOL_W, height: POOL_H, ms: 0 })
    expect(
      c.styles.filter((k) => k === SITE_INK).length,
      'a rested terminal does not mark every space',
    ).toBe(DOCKED_SLOTS)
  })

  it('B12: a space with a bubble MERGING out of it is not marked', () => {
    // ⚠ THE REPORTED FAILURE (user, 2026-09-09: "a place on membrane where
    // vesicle merges, gets grey bg after exocytosis").
    //
    // The mark is a tint on the WALL, painted under the wall's molecules so it
    // reads as a denser stretch of membrane. During a merge the wall gives up
    // its molecules over that whole stretch, so the tint was left with nothing
    // on top of it — a bare grey block, exactly where the bubble had gone in.
    for (const p of [0.2, 0.5, 0.8, 0.99]) {
      const st = merging([1], p)
      const site = dockSites(G, st)[1]
      expect(site.shown, `at ${p} of a merge the space was still marked`).toBe(false)
      // The other spaces are untouched.
      for (const other of [0, 2]) {
        expect(dockSites(G, st)[other].shown, `space ${other} was hidden too`).toBe(true)
      }
      const c = strictCanvas()
      drawPools(c.ctx, { state: st, width: POOL_W, height: POOL_H, ms: 0 })
      expect(
        c.styles.filter((k) => k === SITE_INK).length,
        `${c.styles.filter((k) => k === SITE_INK).length} grey marks drawn with one space merging`,
      ).toBe(DOCKED_SLOTS - 1)
    }

    // ⚠ AND THIS IS WHY IT MATTERED — measured: from halfway through a merge
    // the wall gives up 143 to 199 px either side while the mark reaches only
    // 58, so an unhidden mark sits ENTIRELY inside the bare stretch.
    const mid = merging([1], 0.5)
    const shift = wallSites(G, mid)[0].shift
    expect(shift, 'the wall gave up less than the mark covers').toBeGreaterThan(
      dockSites(G)[1].half,
    )
    // Nothing of the wall's own is left across the mark to cover it.
    const across = wallMolecules(G, mid)
      .map((q) => q.at.x)
      .filter((x) => Math.abs(x - poolSeats(G, 'docked', 1).x) < dockSites(G)[1].half)
    expect(across.length, 'the wall still covers the mark, so it could stay').toBe(0)

    // Once the merge is over, the space is marked again — and by then the
    // wall's own molecules are back across it too, so the two return together.
    const done = merging([1], 1)
    expect(fusionSites(G, done).length, 'it is still merging').toBe(0)
    expect(dockSites(G, done)[1].shown, 'the space never came back').toBe(true)
  })

  it('B13: the panel is solved from the drawer, and the picture sits up in it', () => {
    expect(POOL_W).toBeGreaterThan(200)
    expect(POOL_H).toBeGreaterThan(500)
    const g = snareGeometry(POOL_W, POOL_H)
    expect(G.r).toBeLessThan(g.r)
    expect(G.r).toBeGreaterThan(POOL_LIPID.halfMem * 2)
    expect(countIn(poolsStart(), 'docked')).toBe(DOCKED_SLOTS)
    expect(countIn(poolsStart(), 'storage')).toBe(STORAGE_N)
    // ⚠ LIFTED (user: "lift the image slightly up"). The terminal's wall sits
    // well above halfway, leaving the gap and the receiving cell the lower
    // third — where before the wall was at 0.80 and everything crowded the foot.
    expect(G.wallY / POOL_H, 'the picture still sits low').toBeLessThan(0.62)
    expect(G.wallY / POOL_H, 'the terminal has no room').toBeGreaterThan(0.45)
    expect(postY(POOL_H) - G.wallY, 'no gap to cross').toBeGreaterThan(outerR(G) * 1.5)
    // …and the crowd is not jammed against the top edge.
    expect(poolSeats(G, 'storage', 0).y - outerR(G), 'the crowd touches the top').toBeGreaterThan(20)
  })

  it('B14: the docking clock and the wall agree about REDOCK', () => {
    // A space clears before a bubble can be primed into it, so the two never
    // race — the model's own ordering, asked here because the drawing depends
    // on it (a bubble must not appear over a merging one).
    expect(REDOCK_MS).toBeLessThan(FUSE_MS * SITE_CLEAR_P + REDOCK_MS)
    expect(RECOVER_MS).toBeGreaterThan(FUSE_MS)
  })
})
