import { ION_KINDS, IONS, type IonKind, type Side } from '../core/ions'
import type { IonCounts } from '../state/ionStore'
import { proteinFootprints, type ProteinFootprint } from './proteins'
import {
  MAX_PATCH_TILT,
  MEMBRANE_PX,
  MEMBRANE_ZOOM,
  PX_PER_UM,
  STAGE_H,
  STAGE_W,
} from './layout'

// Where the ions sit, in the LOCAL frame of a membrane patch: `along` runs
// parallel to the membrane, `depth` is distance from its middle (always
// positive — which side is which is decided by the caller).
//
// Positions are deterministic and the jiggle is procedural, so no per-ion
// state is needed and nothing shimmers between frames.

/** Magnification at which ions become big enough to be worth drawing. They are
 *  smaller than the lipids, so they show up only after the bilayer does. */
export const ION_SCALE = 1200

/** Drawn radius of an ion, in scene pixels, from its real hydrated size. */
export function ionRadius(kind: IonKind): number {
  return ((IONS[kind].hydratedNm / 1000) * PX_PER_UM) / 2
}

const LARGEST = Math.max(...ION_KINDS.map(ionRadius))

/** The box the crowd fills, sized to the canvas at membrane magnification. */
// The crowd has to fill the canvas at any tilt a patch is allowed to keep, or the
// corners empty out and it reads as though ions only exist near the membrane. So
// the rectangle it occupies is the screen's own rectangle turned by that much —
// derived from MAX_PATCH_TILT rather than guessed, so the two cannot drift apart.
const COS_TILT = Math.abs(Math.cos(MAX_PATCH_TILT))
const SIN_TILT = Math.abs(Math.sin(MAX_PATCH_TILT))
const COVER_ALONG = COS_TILT * STAGE_W + SIN_TILT * STAGE_H
const COVER_DEEP = SIN_TILT * STAGE_W + COS_TILT * STAGE_H
const HALF_ALONG = ((COVER_ALONG / MEMBRANE_ZOOM) * 1.06) / 2
const MAX_DEPTH = ((COVER_DEEP / MEMBRANE_ZOOM) * 1.04) / 2

/** Closest an ion of this size may come to the middle of the membrane. Nothing
 *  may ever overlap the bilayer: that would say ions can be inside it. */
export function minDepth(radius: number): number {
  return MEMBRANE_PX / 2 + radius * 1.15
}

export interface IonInstance {
  kind: IonKind
  radius: number
  /** Resting position, parallel to the membrane. */
  along: number
  /** Resting distance from the middle of the membrane. */
  depth: number
  /** 0–1, drives this ion's own jiggle rhythm. */
  seed: number
}

function hash(a: number, b: number): number {
  const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return h - Math.floor(h)
}

// A JITTERED GRID: every ion gets its own cell of a fixed grid, then a random
// offset within that cell.
//
// The grid is fixed — its size never depends on how many ions there are — so an
// ion's place is still a pure function of its own identity and nothing budges
// when a count changes. The full-cell jitter is what stops it looking like a
// grid. (An additive low-discrepancy sequence was tried first and covers the
// area just as evenly, but its points lie on families of parallel lines, and
// the eye reads those as stripes.)
const CELLS_ALONG = 15
const CELLS_DEEP = 9
const CELL_COUNT = CELLS_ALONG * CELLS_DEEP
/** Coprime with CELL_COUNT, so consecutive ions land far apart and a species
 *  visits every cell before reusing one. */
const CELL_STRIDE = 7

// Species and sides start at different cells, so they interleave in space.
const SPECIES_CELL: Record<IonKind, number> = { na: 0, k: 34, cl: 67, ca: 101 }
const SIDE_CELL: Record<Side, number> = { outside: 0, inside: 17 }
const SPECIES_SEED: Record<IonKind, number> = { na: 3, k: 11, cl: 19, ca: 27 }

/** Lay one side's crowd out. Position is a pure function of (species, side,
 *  index) — never of how many ions there are in total, which is what used to
 *  make the whole crowd jump whenever one count changed. */
/** Push an ion clear of anything solid it landed on.
 *
 *  Sideways rather than deeper, so the depth distribution survives — how close to
 *  the membrane the ions sit is carrying the charge-skin idea, while a few
 *  millimetres along the membrane means nothing. Chooses the nearer edge, and the
 *  result depends only on the ion's own grid position and the fixed protein
 *  layout, so nothing shuffles when a count changes. */
function clearOfProteins(
  along: number,
  depth: number,
  radius: number,
  blocked: ProteinFootprint[],
): number {
  for (const p of blocked) {
    // Generous on depth: the thermal jiggle moves an ion by up to about twice
    // its radius, and an ion that was left alone at layout time must not be able
    // to wander into solid protein afterwards.
    if (depth > p.reach + radius * 3) continue
    const room = p.half + radius * 1.9
    if (Math.abs(along - p.along) >= room) continue
    return along < p.along ? p.along - room : p.along + room
  }
  return along
}

export function ionCloud(counts: IonCounts, side: Side): IonInstance[] {
  const near = minDepth(LARGEST)
  const depthSpan = Math.max(MAX_DEPTH - near, near)
  const blocked = proteinFootprints(side)
  const out: IonInstance[] = []

  for (const kind of ION_KINDS) {
    const radius = ionRadius(kind)
    for (let i = 0; i < counts[kind][side]; i++) {
      const cell =
        (SPECIES_CELL[kind] + SIDE_CELL[side] + i * CELL_STRIDE) % CELL_COUNT
      const col = cell % CELLS_ALONG
      const row = Math.floor(cell / CELLS_ALONG)
      // Unique per ion, and independent of every other ion.
      const id = SPECIES_SEED[kind] * 977 + (side === 'inside' ? 491 : 0) + i
      const depth = Math.max(
        minDepth(radius),
        near + ((row + hash(id, 2)) / CELLS_DEEP) * depthSpan,
      )
      const along = -HALF_ALONG + ((col + hash(id, 1)) / CELLS_ALONG) * 2 * HALF_ALONG
      out.push({
        kind,
        radius,
        along: clearOfProteins(along, depth, radius, blocked),
        depth,
        seed: hash(id, 3),
      })
    }
  }
  return out
}

/** Where an ion is right now. Thermal jiggling: ions are never still, but
 *  without a channel they cannot get anywhere either. */
export function ionAt(ion: IonInstance, timeMs: number): { along: number; depth: number } {
  const t = timeMs / 1000
  const swing = ion.radius * 1.2
  const along =
    ion.along +
    swing * Math.sin(t * (0.6 + ion.seed * 0.9) + ion.seed * 6.3) +
    swing * 0.5 * Math.sin(t * (1.7 + ion.seed) + 2)
  const depth =
    ion.depth +
    swing * Math.sin(t * (0.8 + ion.seed * 1.1) + 1.1) +
    swing * 0.4 * Math.sin(t * (2.1 - ion.seed * 0.5))
  return { along, depth: Math.max(minDepth(ion.radius), depth) }
}
